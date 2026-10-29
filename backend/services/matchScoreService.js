/**
 * SkillLens AI — Match Score Service
 * Day 21: Explainable & Deterministic Resume-to-Job Match Scoring Engine
 *
 * Calculates:
 *  1. Skills Match Score (using Day 20 Skill Matching Engine results)
 *  2. Experience Match Score (evaluating candidate experience against job requirements)
 *  3. Education Match Score (evaluating candidate qualifications against job requirements)
 *  4. Overall Match Score (weighted normalization across applicable categories)
 *
 * Adheres strictly to docs/DATABASE_SCHEMA.md, docs/PRD.md, and docs/TRD.md.
 */

const db = require("../config/db");
const SkillMatchingService = require("./skillMatchingService");
const ResumeService = require("./resumeService");
const JobRequirementExtractionService = require("./jobRequirementExtractionService");

const ALGORITHM_VERSION = "1.0";

/**
 * Documented baseline category weights (docs/DATABASE_SCHEMA.md Section 15 & docs/TRD.md Section 15)
 */
const SCORING_WEIGHTS = {
  skills: 0.50,
  experience: 0.25,
  education: 0.15,
  certifications: 0.10,
};

/**
 * Degree level hierarchy mapping for deterministic education level comparison.
 */
const DEGREE_LEVEL_HIERARCHY = {
  PHD: 5,
  DOCTORATE: 5,
  MASTER: 4,
  BACHELOR: 3,
  ASSOCIATE: 2,
  DIPLOMA: 1,
  HIGH_SCHOOL: 0,
};

/**
 * Standard technical fields of study that align with software and tech roles.
 */
const TECH_FIELDS_OF_STUDY = [
  "computer science",
  "software engineering",
  "information technology",
  "computer engineering",
  "data science",
  "information systems",
  "electrical engineering",
  "mathematics",
  "statistics",
];

const MONTH_MAP = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
  january: 1, february: 2, march: 3, april: 4,
  june: 6, july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
};

class MatchScoreService {
  /**
   * Returns current scoring weights configuration.
   */
  static getWeights() {
    return { ...SCORING_WEIGHTS };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 1. DATE & EXPERIENCE UTILITIES
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Parses a date string into an approximate month index (year * 12 + month).
   * Supports: "2020", "Jan 2021", "03/2019", "2022-04", "Present", "Current".
   *
   * @param {string} dateStr
   * @returns {number|null}
   */
  static parseDateToMonthIndex(dateStr) {
    if (!dateStr || typeof dateStr !== "string") return null;
    const clean = dateStr.trim();

    if (/^(?:present|current|now|ongoing)$/i.test(clean)) {
      const now = new Date();
      return now.getFullYear() * 12 + (now.getMonth() + 1);
    }

    // Format: "Month Year" (e.g. "Jan 2021", "September 2019")
    const myMatch = clean.match(/^([a-z]+)\.?\s+(\d{4})$/i);
    if (myMatch) {
      const monthName = myMatch[1].toLowerCase();
      const month = MONTH_MAP[monthName] || 6;
      const year = parseInt(myMatch[2], 10);
      return year * 12 + month;
    }

    // Format: "MM/YYYY" or "YYYY-MM"
    const slashMatch = clean.match(/^(\d{1,2})[\/\-](\d{4})$/);
    if (slashMatch) {
      const month = Math.min(12, Math.max(1, parseInt(slashMatch[1], 10)));
      const year = parseInt(slashMatch[2], 10);
      return year * 12 + month;
    }
    const isoMatch = clean.match(/^(\d{4})[\/\-](\d{1,2})$/);
    if (isoMatch) {
      const year = parseInt(isoMatch[1], 10);
      const month = Math.min(12, Math.max(1, parseInt(isoMatch[2], 10)));
      return year * 12 + month;
    }

    // Format: "YYYY" (e.g. "2021")
    const yMatch = clean.match(/^(\d{4})$/);
    if (yMatch) {
      const year = parseInt(yMatch[1], 10);
      return year * 12 + 6; // Mid-year approximation
    }

    return null;
  }

  /**
   * Merges overlapping or contiguous month intervals to avoid double-counting
   * parallel jobs or overlapping experiences.
   *
   * @param {Array<{ start: number, end: number }>} intervals
   * @returns {Array<{ start: number, end: number }>}
   */
  static mergeDateIntervals(intervals) {
    if (!intervals || intervals.length === 0) return [];

    // Filter valid intervals where start <= end
    const valid = intervals
      .filter((i) => typeof i.start === "number" && typeof i.end === "number" && i.start <= i.end)
      .sort((a, b) => a.start - b.start);

    if (valid.length === 0) return [];

    const merged = [valid[0]];

    for (let i = 1; i < valid.length; i++) {
      const current = valid[i];
      const previous = merged[merged.length - 1];

      if (current.start <= previous.end) {
        // Overlapping or contiguous interval: extend previous end
        previous.end = Math.max(previous.end, current.end);
      } else {
        merged.push(current);
      }
    }

    return merged;
  }

  /**
   * Calculates total non-overlapping years of candidate experience from parsed resume entries.
   *
   * @param {Array<Object>} experienceEntries
   * @returns {{ totalYears: number, totalMonths: number, entriesCount: number, hasDatedEntries: boolean, warnings: string[] }}
   */
  static calculateCandidateExperienceYears(experienceEntries) {
    const warnings = [];

    if (!Array.isArray(experienceEntries) || experienceEntries.length === 0) {
      return {
        totalYears: 0,
        totalMonths: 0,
        entriesCount: 0,
        hasDatedEntries: false,
        warnings: ["No work experience entries documented in candidate resume."],
      };
    }

    const intervals = [];
    let undatedEntries = 0;

    for (const exp of experienceEntries) {
      let startIndex = this.parseDateToMonthIndex(exp.startDate);
      let endIndex = this.parseDateToMonthIndex(exp.endDate);

      // If isCurrent is true and endDate is missing, treat as current date
      if (exp.isCurrent && !endIndex) {
        const now = new Date();
        endIndex = now.getFullYear() * 12 + (now.getMonth() + 1);
      }

      if (startIndex && !endIndex) {
        // Assume at least 6 months if only start date given
        endIndex = startIndex + 6;
      }

      if (startIndex && endIndex && startIndex <= endIndex) {
        intervals.push({ start: startIndex, end: endIndex });
      } else {
        undatedEntries++;
      }
    }

    if (undatedEntries > 0) {
      warnings.push(`${undatedEntries} work experience entry/entries lacked verifiable dates.`);
    }

    const merged = this.mergeDateIntervals(intervals);
    let totalMonths = 0;
    for (const interval of merged) {
      totalMonths += Math.max(1, interval.end - interval.start);
    }

    const totalYears = Math.round((totalMonths / 12) * 10) / 10;

    return {
      totalYears,
      totalMonths,
      entriesCount: experienceEntries.length,
      hasDatedEntries: intervals.length > 0,
      warnings,
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 2. CATEGORY SCORE CALCULATORS
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Calculates the Skills Match Score (0–100%) from Day 20 skill matching results.
   *
   * Scoring formula:
   * - Strong Match: 1.0 points
   * - Partial Match: 0.5 points
   * - Missing: 0.0 points
   *
   * Weighting:
   * - Required skills carry base weight 1.0 (with priority multipliers: HIGH: 1.2, MEDIUM: 1.0, LOW: 0.8)
   * - Preferred skills carry base weight 0.5 (with priority multipliers: HIGH: 0.6, MEDIUM: 0.5, LOW: 0.4)
   * Missing preferred skills do not carry the same penalty as missing required skills.
   *
   * @param {Object} matchingResults - Output from Day 20 compareSkillSets
   * @returns {Object} { score: number|null, status: string, explanation: string, details: Object }
   */
  static calculateSkillsScore(matchingResults) {
    if (!matchingResults || !Array.isArray(matchingResults.results) || matchingResults.results.length === 0) {
      return {
        score: null,
        status: "NOT_APPLICABLE",
        explanation: "No specific skills were required or evaluated for this job description.",
        details: { totalEvaluated: 0, earnedPoints: 0, maxPoints: 0 },
      };
    }

    const evaluatedSkills = matchingResults.results;

    // Deduplicate skills by normalized skill name to prevent duplicate counting
    const uniqueSkillsMap = new Map();
    for (const item of evaluatedSkills) {
      const key = (item.normalizedSkill || item.jobSkill).toLowerCase().trim();
      if (!uniqueSkillsMap.has(key)) {
        uniqueSkillsMap.set(key, item);
      }
    }

    let earnedPoints = 0;
    let maxPoints = 0;
    let strongCount = 0;
    let partialCount = 0;
    let missingRequired = 0;
    let missingPreferred = 0;

    for (const item of uniqueSkillsMap.values()) {
      const isRequired = item.requirementType === "REQUIRED";
      const isPreferred = item.requirementType === "PREFERRED";

      // Base weight: required skills are weighted 1.0; preferred skills are weighted 0.5
      let weight = isRequired ? 1.0 : isPreferred ? 0.5 : 0.8;

      // Priority multiplier
      if (item.priority === "HIGH") weight *= 1.2;
      else if (item.priority === "LOW") weight *= 0.8;

      maxPoints += weight;

      if (item.category === "STRONG_MATCH") {
        earnedPoints += weight * 1.0;
        strongCount++;
      } else if (item.category === "PARTIAL_MATCH") {
        earnedPoints += weight * 0.5;
        partialCount++;
      } else {
        // MISSING
        if (isRequired) missingRequired++;
        else missingPreferred++;
      }
    }

    if (maxPoints === 0) {
      return {
        score: null,
        status: "NOT_APPLICABLE",
        explanation: "No weighted skills were identified in the job description.",
        details: { totalEvaluated: 0, earnedPoints: 0, maxPoints: 0 },
      };
    }

    const rawScore = (earnedPoints / maxPoints) * 100;
    const finalScore = Math.max(0, Math.min(100, Math.round(rawScore)));

    const explanation = `Evaluated ${uniqueSkillsMap.size} job skills: ${strongCount} strong match(es), ` +
      `${partialCount} partial match(es), and ${missingRequired + missingPreferred} missing ` +
      `(${missingRequired} required, ${missingPreferred} preferred).`;

    return {
      score: finalScore,
      status: "AVAILABLE",
      explanation,
      details: {
        totalEvaluated: uniqueSkillsMap.size,
        strongMatches: strongCount,
        partialMatches: partialCount,
        missingRequired,
        missingPreferred,
        earnedPoints: Math.round(earnedPoints * 100) / 100,
        maxPoints: Math.round(maxPoints * 100) / 100,
      },
    };
  }

  /**
   * Calculates the Experience Match Score (0–100%) by comparing candidate resume experience
   * against job experience requirements.
   *
   * @param {Object} candidateData - Structured resume data containing experience array
   * @param {Object} jobRequirements - Structured job requirements containing experience
   * @returns {Object} { score: number|null, status: string, explanation: string, details: Object }
   */
  static calculateExperienceScore(candidateData, jobRequirements) {
    const jobExp = jobRequirements?.experience || {};
    const minYears = jobExp.minimumYears !== null && jobExp.minimumYears !== undefined
      ? Number(jobExp.minimumYears)
      : null;
    const maxYears = jobExp.maximumYears !== null && jobExp.maximumYears !== undefined
      ? Number(jobExp.maximumYears)
      : null;
    const reqLevel = jobExp.level || null;
    const details = jobExp.details || [];

    // Check if job specifies any experience requirement
    const hasJobExpRequirement = minYears !== null || reqLevel !== null || (details && details.length > 0);

    if (!hasJobExpRequirement) {
      return {
        score: null,
        status: "NOT_APPLICABLE",
        explanation: "The target job description does not specify required years or seniority level of experience.",
        details: { requiredYears: null, candidateYears: null },
      };
    }

    const expEntries = candidateData?.experience || [];

    // Calculate candidate experience
    const candidateExp = this.calculateCandidateExperienceYears(expEntries);

    // If candidate has experience entries but none could be dated, check if data is ambiguous
    if (expEntries.length > 0 && !candidateExp.hasDatedEntries && minYears !== null && minYears > 0) {
      return {
        score: null,
        status: "INSUFFICIENT_DATA",
        explanation: "Candidate has documented work experience entries, but dates could not be reliably parsed to verify total years.",
        details: {
          requiredYears: minYears,
          candidateYears: null,
          entriesCount: expEntries.length,
          warnings: candidateExp.warnings,
        },
      };
    }

    const candYears = candidateExp.totalYears;

    // Case 1: Job explicitly specifies minimum years of experience
    if (minYears !== null) {
      if (minYears <= 0) {
        // Entry level / 0 years required
        return {
          score: 100,
          status: "AVAILABLE",
          explanation: "Entry-level position requiring no prior professional experience; requirement fully satisfied.",
          details: { requiredYears: minYears, candidateYears: candYears },
        };
      }

      if (candYears <= 0) {
        return {
          score: 0,
          status: "AVAILABLE",
          explanation: `The job requires ${minYears} year(s) of experience, but no professional work experience was verified in the resume.`,
          details: { requiredYears: minYears, candidateYears: 0 },
        };
      }

      // Proportional scoring: (candidateYears / minYears) * 100, capped at 100%
      let ratio = candYears / minYears;
      let score = Math.min(1.0, ratio) * 100;

      // Check seniority alignment bonus/penalty if specified
      if (reqLevel && /senior|lead|principal|architect/i.test(reqLevel)) {
        const hasSeniorTitle = expEntries.some((e) =>
          /senior|lead|principal|architect|head|director/i.test(e.jobTitle || "")
        );
        if (hasSeniorTitle && score >= 80) {
          score = Math.min(100, score + 10);
        } else if (!hasSeniorTitle && candYears >= minYears) {
          score = Math.max(70, score - 15); // Met years, but lacking evidenced senior title
        }
      }

      const finalScore = Math.max(0, Math.min(100, Math.round(score)));
      const explanation = `Candidate documents ${candYears} year(s) of professional experience ` +
        `against the required ${minYears} year(s) (${finalScore}% alignment).`;

      return {
        score: finalScore,
        status: "AVAILABLE",
        explanation,
        details: {
          requiredYears: minYears,
          candidateYears: candYears,
          seniorityRequired: reqLevel,
        },
      };
    }

    // Case 2: Job does not state numeric years, but states a seniority level
    if (reqLevel) {
      if (/entry[\s-]level|junior|intern|trainee|graduate/i.test(reqLevel)) {
        const score = candYears >= 0 ? 100 : 80;
        return {
          score,
          status: "AVAILABLE",
          explanation: `Target role is ${reqLevel}; candidate experience profile meets expectations.`,
          details: { requiredYears: null, candidateYears: candYears, seniorityRequired: reqLevel },
        };
      }

      if (/senior|lead|principal/i.test(reqLevel)) {
        let score = 0;
        if (candYears >= 5) score = 100;
        else if (candYears >= 3) score = 70;
        else if (candYears >= 1) score = 40;
        else score = 20;

        return {
          score,
          status: "AVAILABLE",
          explanation: `Target role requires ${reqLevel} experience; candidate documents ${candYears} year(s).`,
          details: { requiredYears: null, candidateYears: candYears, seniorityRequired: reqLevel },
        };
      }

      if (/mid[\s-]level|intermediate/i.test(reqLevel)) {
        let score = 0;
        if (candYears >= 2) score = 100;
        else if (candYears >= 1) score = 70;
        else score = 30;

        return {
          score,
          status: "AVAILABLE",
          explanation: `Target role requires ${reqLevel} experience; candidate documents ${candYears} year(s).`,
          details: { requiredYears: null, candidateYears: candYears, seniorityRequired: reqLevel },
        };
      }
    }

    // Fallback: details mentioned but no years/level
    return {
      score: null,
      status: "NOT_APPLICABLE",
      explanation: "No quantitative experience criteria specified in the job description.",
      details: { requiredYears: null, candidateYears: candYears },
    };
  }

  /**
   * Calculates the Education Match Score (0–100%) by comparing candidate education
   * against job education requirements.
   *
   * @param {Object} candidateData - Structured resume data containing education array
   * @param {Object} jobRequirements - Structured job requirements containing education array
   * @returns {Object} { score: number|null, status: string, explanation: string, details: Object }
   */
  static calculateEducationScore(candidateData, jobRequirements) {
    const jobEdu = jobRequirements?.education || [];

    if (!Array.isArray(jobEdu) || jobEdu.length === 0) {
      return {
        score: null,
        status: "NOT_APPLICABLE",
        explanation: "The target job description does not state mandatory or preferred degree requirements.",
        details: { jobEducation: [], candidateEducation: [] },
      };
    }

    const candEdu = candidateData?.education || [];

    if (!Array.isArray(candEdu) || candEdu.length === 0) {
      const isMandatory = jobEdu.some((e) => e.required === true);
      return {
        score: 0,
        status: "AVAILABLE",
        explanation: isMandatory
          ? "The job requires a degree, but no education qualifications were documented in the candidate resume."
          : "Job specifies preferred education, but no qualifications were found in candidate resume.",
        details: { jobEducation: jobEdu, candidateEducation: [] },
      };
    }

    // Determine candidate qualifications hierarchy, fields of study, and completion status
    const parsedCandEdu = candEdu.map((entry) => {
      const text = `${entry.qualification || ""} ${entry.fieldOfStudy || ""} ${entry.description || ""}`.toLowerCase();
      let level = "HIGH_SCHOOL";
      let levelRank = 0;

      if (/ph\.?d|doctorate|doctor\s+of\s+philosophy/i.test(text)) {
        level = "PHD";
        levelRank = 5;
      } else if (/master|m\.?sc|m\.?s\b|m\.?tech|m\.?e\b|m\.?b\.?a/i.test(text)) {
        level = "MASTER";
        levelRank = 4;
      } else if (/bachelor|b\.?sc|b\.?s\b|b\.?tech|b\.?e\b|undergraduate/i.test(text)) {
        level = "BACHELOR";
        levelRank = 3;
      } else if (/associate/i.test(text)) {
        level = "ASSOCIATE";
        levelRank = 2;
      } else if (/diploma|hnd/i.test(text)) {
        level = "DIPLOMA";
        levelRank = 1;
      }

      // Check if degree is ongoing / in-progress
      const isOngoing = entry.isCurrent === true ||
        /present|current|ongoing|expected/i.test(entry.endDate || "") ||
        /currently\s+pursuing|in\s+progress/i.test(text);

      // Check if field matches relevant tech fields
      const isTechField = TECH_FIELDS_OF_STUDY.some((field) => text.includes(field));

      return {
        qualification: entry.qualification,
        institution: entry.institution,
        level,
        levelRank,
        isOngoing,
        isTechField,
        fieldOfStudy: entry.fieldOfStudy,
      };
    });

    // Find candidate's highest completed and highest ongoing degree
    const highestRank = Math.max(...parsedCandEdu.map((e) => e.levelRank));
    const bestCandidateEntry = parsedCandEdu.find((e) => e.levelRank === highestRank);

    // Evaluate against each job education requirement
    let totalScore = 0;
    let comparisons = [];

    for (const req of jobEdu) {
      const targetRank = DEGREE_LEVEL_HIERARCHY[req.level] || 3; // Default to Bachelor's if unspecified
      let reqScore = 0;
      let rationale = "";

      if (highestRank >= targetRank) {
        // Degree level met or exceeded
        if (!bestCandidateEntry.isOngoing) {
          reqScore = 70; // 70% base for completed degree level
          if (bestCandidateEntry.isTechField || (req.field && (bestCandidateEntry.fieldOfStudy || "").toLowerCase().includes(req.field.toLowerCase()))) {
            reqScore += 30; // 100% total for relevant field match
            rationale = `Completed ${bestCandidateEntry.level} in relevant field (${bestCandidateEntry.fieldOfStudy || "Tech"}). Fully satisfies requirement.`;
          } else {
            reqScore += 15; // 85% for completed degree in other field
            rationale = `Completed ${bestCandidateEntry.level} held. Level satisfied, though field is non-specialized.`;
          }
        } else {
          // Degree is ongoing
          reqScore = 60;
          if (bestCandidateEntry.isTechField) reqScore += 10;
          rationale = `Candidate is currently pursuing ${bestCandidateEntry.level} (in-progress/ongoing). Partial credit awarded.`;
        }
      } else if (highestRank === targetRank - 1) {
        // 1 level below (e.g. Associate when Bachelor's required)
        if (req.equivalentAccepted) {
          reqScore = 70;
          rationale = `Candidate holds ${bestCandidateEntry.level}, and equivalent practical experience/qualification is accepted.`;
        } else {
          reqScore = 40;
          rationale = `Candidate holds ${bestCandidateEntry.level}, which is below required ${req.level}.`;
        }
      } else {
        // Significantly below required level
        reqScore = req.equivalentAccepted ? 40 : 10;
        rationale = `Qualification level (${bestCandidateEntry.level}) is substantially below required ${req.level}.`;
      }

      comparisons.push({
        requiredLevel: req.level,
        candidateLevel: bestCandidateEntry.level,
        score: reqScore,
        rationale,
      });

      totalScore = Math.max(totalScore, reqScore);
    }

    const finalScore = Math.max(0, Math.min(100, Math.round(totalScore)));
    const explanation = comparisons[0]?.rationale || "Evaluated candidate educational background against stated criteria.";

    return {
      score: finalScore,
      status: "AVAILABLE",
      explanation,
      details: {
        candidateDegree: bestCandidateEntry.qualification || bestCandidateEntry.level,
        candidateLevel: bestCandidateEntry.level,
        isOngoing: bestCandidateEntry.isOngoing,
        comparisons,
      },
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 3. OVERALL SCORE & WEIGHT NORMALIZATION
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Calculates the Overall Match Score by normalizing weights of applicable categories.
   *
   * Baseline weights:
   *  - Skills: 50%
   *  - Experience: 25%
   *  - Education: 15%
   *  - Certifications/Other: 10%
   *
   * If a category is NOT_APPLICABLE (e.g. job doesn't require experience or certifications),
   * its weight is redistributed proportionally among the applicable categories.
   *
   * @param {Object} categoryScores - Object containing skills, experience, education, certifications score objects
   * @returns {Object} Structured overall score result
   */
  static calculateOverallScore(categoryScores) {
    const includedCategories = [];
    const normalizedWeights = {};
    const warnings = [];

    // Identify applicable categories with valid numeric scores
    let applicableWeightSum = 0;

    for (const [catName, catResult] of Object.entries(categoryScores)) {
      if (catResult && catResult.status === "AVAILABLE" && typeof catResult.score === "number") {
        const baseWeight = SCORING_WEIGHTS[catName] || 0;
        applicableWeightSum += baseWeight;
        includedCategories.push(catName);
      } else if (catResult && catResult.status === "INSUFFICIENT_DATA") {
        warnings.push(`Category '${catName}' had insufficient data to calculate a reliable score and was excluded.`);
      }
    }

    if (includedCategories.length === 0 || applicableWeightSum <= 0) {
      return {
        score: null,
        status: "NOT_APPLICABLE",
        method: "UNAVAILABLE",
        includedCategories: [],
        normalizedWeights: {},
        explanation: "No applicable scoring categories could be evaluated.",
        warnings,
      };
    }

    // Normalize weights
    let weightedScoreSum = 0;
    for (const catName of includedCategories) {
      const baseWeight = SCORING_WEIGHTS[catName] || 0;
      const normalizedWeight = baseWeight / applicableWeightSum;
      normalizedWeights[catName] = Math.round(normalizedWeight * 1000) / 1000;

      const score = categoryScores[catName].score;
      weightedScoreSum += score * normalizedWeight;
    }

    const finalOverallScore = Math.max(0, Math.min(100, Math.round(weightedScoreSum)));

    const weightsSummary = includedCategories
      .map((c) => `${c.charAt(0).toUpperCase() + c.slice(1)} (${Math.round(normalizedWeights[c] * 100)}%)`)
      .join(", ");

    const explanation = `Overall match calculated from applicable categories: ${weightsSummary}.`;

    return {
      score: finalOverallScore,
      status: "AVAILABLE",
      method: "WEIGHTED_NORMALIZATION",
      includedCategories,
      normalizedWeights,
      explanation,
      warnings,
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 4. MAIN END-TO-END SCORING ORCHESTRATION & PERSISTENCE
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Executes end-to-end match score calculation between a user's resume and job description.
   *
   * 1. Validates inputs & ownership
   * 2. Retrieves structured resume data & structured job requirements
   * 3. Executes / retrieves Day 20 Skill Matching results
   * 4. Calculates Skills, Experience, Education, and Overall Match scores
   * 5. Atomically persists scores to `analyses` in MySQL
   * 6. Returns canonical structured response
   *
   * @param {number} resumeId
   * @param {number} jobId
   * @param {number} userId
   * @returns {Promise<Object>}
   */
  static async calculateMatchScore(resumeId, jobId, userId) {
    if (!resumeId || !jobId || !userId) {
      const err = new Error("Resume ID, Job Description ID, and User ID are required.");
      err.status = 400;
      throw err;
    }

    const parsedResumeId = Number(resumeId);
    const parsedJobId = Number(jobId);
    const parsedUserId = Number(userId);

    if (Number.isNaN(parsedResumeId) || Number.isNaN(parsedJobId) || Number.isNaN(parsedUserId)) {
      const err = new Error("Resume ID, Job Description ID, and User ID must be valid numbers.");
      err.status = 400;
      throw err;
    }

    // 1. Verify existence & ownership
    const [resumes] = await db.query(
      `SELECT id, original_filename, processing_status, extracted_text FROM resumes WHERE id = ? AND user_id = ? LIMIT 1`,
      [parsedResumeId, parsedUserId]
    );
    if (!resumes || resumes.length === 0) {
      const err = new Error("Resume not found or access denied.");
      err.status = 404;
      throw err;
    }

    const [jobs] = await db.query(
      `SELECT id, title, company, description, processing_status FROM jobs WHERE id = ? AND user_id = ? LIMIT 1`,
      [parsedJobId, parsedUserId]
    );
    if (!jobs || jobs.length === 0) {
      const err = new Error("Job description not found or access denied.");
      err.status = 404;
      throw err;
    }

    const resumeRecord = resumes[0];
    const jobRecord = jobs[0];

    // 2. Obtain structured resume data
    const resumeWithExtraction = await ResumeService.getResumeWithExtraction(parsedResumeId, parsedUserId);
    const structuredResume = resumeWithExtraction?.structuredModel ||
      resumeWithExtraction?.structuredData?.structuredModel || {};

    // 3. Obtain structured job requirements
    let jobRequirements = await JobRequirementExtractionService.getSavedRequirements(parsedJobId);
    if (!jobRequirements) {
      // Extract requirements if not yet extracted
      const extractionResult = await JobRequirementExtractionService.processJobRequirements(parsedJobId, parsedUserId);
      jobRequirements = extractionResult?.requirements;
    }

    // 4. Obtain Day 20 Skill Matching results
    let matchingResults = await SkillMatchingService.getSavedMatching(parsedResumeId, parsedJobId, parsedUserId);
    if (!matchingResults) {
      matchingResults = await SkillMatchingService.runMatching(parsedResumeId, parsedJobId, parsedUserId);
    }

    // 5. Calculate category scores
    const skillsScore = this.calculateSkillsScore(matchingResults);
    const experienceScore = this.calculateExperienceScore(structuredResume, jobRequirements);
    const educationScore = this.calculateEducationScore(structuredResume, jobRequirements);

    const categoryScores = {
      skills: skillsScore,
      experience: experienceScore,
      education: educationScore,
    };

    // 6. Calculate overall score with normalized weights
    const overallScore = this.calculateOverallScore(categoryScores);

    const allWarnings = [
      ...(overallScore.warnings || []),
      ...(matchingResults.matchingMetadata?.warnings || []),
    ];

    const calculatedAt = new Date().toISOString();

    // 7. Structure the response conforming to Day 21 specification
    const responsePayload = {
      resumeId: parsedResumeId,
      jobDescriptionId: parsedJobId,
      jobTitle: jobRecord.title,
      company: jobRecord.company || null,
      resumeFilename: resumeRecord.original_filename,
      scores: {
        skills: {
          score: skillsScore.score,
          status: skillsScore.status,
          weight: SCORING_WEIGHTS.skills,
          normalizedWeight: overallScore.normalizedWeights?.skills || null,
          explanation: skillsScore.explanation,
          details: skillsScore.details,
        },
        experience: {
          score: experienceScore.score,
          status: experienceScore.status,
          weight: SCORING_WEIGHTS.experience,
          normalizedWeight: overallScore.normalizedWeights?.experience || null,
          explanation: experienceScore.explanation,
          details: experienceScore.details,
        },
        education: {
          score: educationScore.score,
          status: educationScore.status,
          weight: SCORING_WEIGHTS.education,
          normalizedWeight: overallScore.normalizedWeights?.education || null,
          explanation: educationScore.explanation,
          details: educationScore.details,
        },
      },
      overall: {
        score: overallScore.score,
        status: overallScore.status,
        method: overallScore.method,
        includedCategories: overallScore.includedCategories,
        explanation: overallScore.explanation,
      },
      metadata: {
        algorithmVersion: ALGORITHM_VERSION,
        calculatedAt,
        weightsConfiguration: this.getWeights(),
        warnings: Array.from(new Set(allWarnings)),
      },
    };

    // 8. Persist scores to MySQL `analyses` table atomically
    await this.persistScores({
      userId: parsedUserId,
      resumeId: parsedResumeId,
      jobId: parsedJobId,
      payload: responsePayload,
    });

    return responsePayload;
  }

  /**
   * Persists the match scores in the `analyses` table in MySQL.
   * Idempotent: Updates existing record for (user_id, resume_id, job_id) or inserts new one.
   *
   * @param {Object} params
   */
  static async persistScores({ userId, resumeId, jobId, payload }) {
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      const overall = payload.overall.score !== null ? payload.overall.score : 0.00;
      const skill = payload.scores.skills.score !== null ? payload.scores.skills.score : null;
      const exp = payload.scores.experience.score !== null ? payload.scores.experience.score : null;
      const edu = payload.scores.education.score !== null ? payload.scores.education.score : null;
      const summaryText = JSON.stringify({
        overall: payload.overall,
        scores: {
          skills: { score: payload.scores.skills.score, status: payload.scores.skills.status },
          experience: { score: payload.scores.experience.score, status: payload.scores.experience.status },
          education: { score: payload.scores.education.score, status: payload.scores.education.status },
        },
        warnings: payload.metadata.warnings,
      });

      const [existing] = await connection.query(
        `SELECT id FROM analyses WHERE user_id = ? AND resume_id = ? AND job_id = ? LIMIT 1`,
        [userId, resumeId, jobId]
      );

      const now = new Date();

      if (existing && existing.length > 0) {
        await connection.query(
          `UPDATE analyses
           SET overall_score = ?, skill_score = ?, experience_score = ?, education_score = ?,
               summary = ?, status = 'COMPLETED', algorithm_version = ?, completed_at = ?
           WHERE id = ?`,
          [overall, skill, exp, edu, summaryText, ALGORITHM_VERSION, now, existing[0].id]
        );
      } else {
        await connection.query(
          `INSERT INTO analyses
           (user_id, resume_id, job_id, overall_score, skill_score, experience_score, education_score, summary, status, algorithm_version, completed_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'COMPLETED', ?, ?)`,
          [userId, resumeId, jobId, overall, skill, exp, edu, summaryText, ALGORITHM_VERSION, now]
        );
      }

      await connection.commit();
    } catch (err) {
      await connection.rollback();
      console.error("[MatchScoreService] Error persisting match scores:", err.message);
      throw err;
    } finally {
      connection.release();
    }
  }

  /**
   * Retrieves previously calculated and saved match score from MySQL.
   *
   * @param {number} resumeId
   * @param {number} jobId
   * @param {number} userId
   * @returns {Promise<Object|null>}
   */
  static async getSavedMatchScore(resumeId, jobId, userId) {
    if (!resumeId || !jobId || !userId) {
      const err = new Error("Resume ID, Job Description ID, and User ID are required.");
      err.status = 400;
      throw err;
    }

    const parsedResumeId = Number(resumeId);
    const parsedJobId = Number(jobId);
    const parsedUserId = Number(userId);

    if (Number.isNaN(parsedResumeId) || Number.isNaN(parsedJobId) || Number.isNaN(parsedUserId)) {
      const err = new Error("Resume ID and Job Description ID must be valid numbers.");
      err.status = 400;
      throw err;
    }

    // Verify ownership
    const [resumes] = await db.query(
      `SELECT id, original_filename FROM resumes WHERE id = ? AND user_id = ? LIMIT 1`,
      [parsedResumeId, parsedUserId]
    );
    if (!resumes || resumes.length === 0) {
      const err = new Error("Resume not found or access denied.");
      err.status = 404;
      throw err;
    }

    const [jobs] = await db.query(
      `SELECT id, title, company FROM jobs WHERE id = ? AND user_id = ? LIMIT 1`,
      [parsedJobId, parsedUserId]
    );
    if (!jobs || jobs.length === 0) {
      const err = new Error("Job description not found or access denied.");
      err.status = 404;
      throw err;
    }

    // Fetch analysis
    const [analyses] = await db.query(
      `SELECT id, overall_score, skill_score, experience_score, education_score, summary, status, algorithm_version, completed_at, created_at
       FROM analyses
       WHERE user_id = ? AND resume_id = ? AND job_id = ?
       ORDER BY id DESC LIMIT 1`,
      [parsedUserId, parsedResumeId, parsedJobId]
    );

    if (!analyses || analyses.length === 0) {
      return null;
    }

    const analysis = analyses[0];

    // If summary contains cached structure, parse it
    let summaryObj = null;
    if (analysis.summary) {
      try {
        summaryObj = JSON.parse(analysis.summary);
      } catch (_) {}
    }

    // If complete structured payload exists, return reconstructed response
    const skillsScore = analysis.skill_score !== null ? Number(analysis.skill_score) : null;
    const expScore = analysis.experience_score !== null ? Number(analysis.experience_score) : null;
    const eduScore = analysis.education_score !== null ? Number(analysis.education_score) : null;
    const overall = analysis.overall_score !== null ? Math.round(Number(analysis.overall_score)) : null;

    return {
      resumeId: parsedResumeId,
      jobDescriptionId: parsedJobId,
      jobTitle: jobs[0].title,
      company: jobs[0].company || null,
      resumeFilename: resumes[0].original_filename,
      scores: {
        skills: {
          score: skillsScore,
          status: skillsScore !== null ? "AVAILABLE" : (summaryObj?.scores?.skills?.status || "NOT_APPLICABLE"),
          weight: SCORING_WEIGHTS.skills,
          explanation: summaryObj?.scores?.skills?.explanation || "Based on evaluated job skill requirements.",
        },
        experience: {
          score: expScore,
          status: expScore !== null ? "AVAILABLE" : (summaryObj?.scores?.experience?.status || "NOT_APPLICABLE"),
          weight: SCORING_WEIGHTS.experience,
          explanation: summaryObj?.scores?.experience?.explanation || "Based on documented work experience and job requirements.",
        },
        education: {
          score: eduScore,
          status: eduScore !== null ? "AVAILABLE" : (summaryObj?.scores?.education?.status || "NOT_APPLICABLE"),
          weight: SCORING_WEIGHTS.education,
          explanation: summaryObj?.scores?.education?.explanation || "Based on stated education requirements.",
        },
      },
      overall: {
        score: overall,
        status: overall !== null ? "AVAILABLE" : "NOT_APPLICABLE",
        method: summaryObj?.overall?.method || "WEIGHTED_NORMALIZATION",
        includedCategories: summaryObj?.overall?.includedCategories || ["skills"],
        explanation: summaryObj?.overall?.explanation || "Calculated from applicable scoring categories.",
      },
      metadata: {
        algorithmVersion: analysis.algorithm_version || ALGORITHM_VERSION,
        calculatedAt: analysis.completed_at || analysis.created_at,
        warnings: summaryObj?.warnings || [],
      },
    };
  }
}

module.exports = MatchScoreService;
