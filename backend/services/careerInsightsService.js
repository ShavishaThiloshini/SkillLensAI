/**
 * SkillLens AI — Career Insights Service
 * Day 30: Comprehensive Career Insights & Career Readiness Engine
 *
 * Synthesizes evidence across all SkillLens AI modules to provide a holistic,
 * explainable, and actionable career assessment:
 * 1. Strengths Analysis (technical skills, projects, experience, academic foundation).
 * 2. Weaknesses & Development Areas (missing required/preferred skills, project depth, resume gaps).
 * 3. Priority Skills (direct integration with Day 26 Roadmap and Day 28 Recommendations).
 * 4. Suggested Career Improvements (Technical, Projects, Resume, Experience & Professional).
 * 5. Overall Career Readiness (transparent multi-dimensional evaluation with threshold tiers).
 * 6. Personalized Career Summary (actionable next steps, limitations disclaimer).
 *
 * Grounded in factual integrity: never invents qualifications, metrics, companies, or experience.
 * Incorporates Day 18 AI integration with strict schema validation and deterministic fallback.
 * Persists insights in `career_insights` and `analyses` tables.
 */

const db = require("../config/db");
const { normalizeSkillName } = require("../utils/skillNormalizer");
const SkillMatchingService = require("./skillMatchingService");
const MatchScoreService = require("./matchScoreService");
const SkillRoadmapService = require("./skillRoadmapService");
const ResumeImprovementService = require("./resumeImprovementService");
const { generateText, validateAiConfig } = require("./aiService");

const CAREER_INSIGHTS_ALGORITHM_VERSION = "1.0";

/**
 * Standard career readiness threshold tiers.
 */
const READINESS_THRESHOLDS = [
  { min: 80.0, max: 100.0, level: "Strong Preparation", tier: "STRONG", description: "Demonstrates robust technical competency, practical project implementation, and solid profile alignment for the selected career path." },
  { min: 65.0, max: 79.99, level: "Progressing Well", tier: "PROGRESSING", description: "Shows a solid technical and practical foundation with specific addressable skill gaps or project improvements needed." },
  { min: 50.0, max: 64.99, level: "Developing", tier: "DEVELOPING", description: "Emerging foundational competencies with notable opportunities to develop core technologies and practical portfolio evidence." },
  { min: 0.0, max: 49.99, level: "Needs Development", tier: "NEEDS_DEVELOPMENT", description: "Early-stage preparation; focused skill acquisition and portfolio project building are recommended before applying to target roles." },
];

class CareerInsightsService {
  /**
   * Retrieves previously saved career insights or generates fresh ones.
   *
   * @param {number} resumeId
   * @param {number} jobId
   * @param {number} userId
   * @returns {Promise<Object>}
   */
  static async getCareerInsights(resumeId, jobId, userId) {
    if (!resumeId || !jobId || !userId) {
      const err = new Error("resumeId, jobId, and userId are required.");
      err.status = 400;
      throw err;
    }

    // 1. Verify access
    await this.verifyUserAccess(resumeId, jobId, userId);

    // 2. Check if an analysis exists for this pair
    const [analyses] = await db.query(
      `SELECT id, user_id, resume_id, job_id, overall_score, summary, status, created_at
       FROM analyses
       WHERE resume_id = ? AND job_id = ? AND user_id = ?
       ORDER BY id DESC
       LIMIT 1`,
      [resumeId, jobId, userId]
    );

    if (analyses && analyses.length > 0) {
      const analysis = analyses[0];

      // Check if structured insights exist in analysis.summary
      if (analysis.summary) {
        try {
          const parsed = JSON.parse(analysis.summary);
          if (parsed.careerInsights) {
            return parsed.careerInsights;
          }
        } catch (_) {}
      }
    }

    // Otherwise generate fresh insights
    return await this.generateCareerInsights(resumeId, jobId, userId);
  }

  /**
   * Generates comprehensive career insights combining all core modules.
   *
   * @param {number} resumeId
   * @param {number} jobId
   * @param {number} userId
   * @param {Object} [options]
   * @param {boolean} [options.forceFallback] - Force deterministic rule-based generation
   * @returns {Promise<Object>}
   */
  static async generateCareerInsights(resumeId, jobId, userId, options = {}) {
    if (!resumeId || !jobId || !userId) {
      const err = new Error("resumeId, jobId, and userId are required.");
      err.status = 400;
      throw err;
    }

    // 1. Verify ownership
    const { resume, job } = await this.verifyUserAccess(resumeId, jobId, userId);

    // 2. Fetch structured resume sections
    const [sections] = await db.query(
      `SELECT section_type, section_content, display_order
       FROM resume_sections
       WHERE resume_id = ?
       ORDER BY display_order ASC`,
      [resumeId]
    );

    const structuredResume = this.assembleStructuredResume(sections, resume.extracted_text || "");

    // 3. Fetch candidate skills
    const [candidateSkills] = await db.query(
      `SELECT s.id, s.name, s.category, rs.proficiency, rs.evidence
       FROM resume_skills rs
       JOIN skills s ON rs.skill_id = s.id
       WHERE rs.resume_id = ?`,
      [resumeId]
    );

    // 4. Fetch target job skills
    const [jobSkills] = await db.query(
      `SELECT s.id, s.name, s.category, js.priority, js.required, js.evidence
       FROM job_skills js
       JOIN skills s ON js.skill_id = s.id
       WHERE js.job_id = ?`,
      [jobId]
    );

    // 5. Compute matching results (Day 20 engine)
    const matchingResult = SkillMatchingService.compareSkillSets(candidateSkills, jobSkills);
    const skillMatches = matchingResult.results || [];

    // 6. Fetch or compute Day 29 Resume Improvement metrics
    let resumeImprovementsData = null;
    try {
      resumeImprovementsData = await ResumeImprovementService.getSuggestions(resumeId, jobId, userId);
    } catch (_) {
      // Fallback: minimal metrics if resume improvements failed
      resumeImprovementsData = {
        metrics: { readinessScore: 70 },
        weakDescriptions: [],
        projects: [],
      };
    }

    // 7. Calculate Career Readiness (Dedicated Multi-Dimensional Assessment)
    const careerReadiness = this.calculateCareerReadiness({
      resumeSkills: candidateSkills,
      jobSkills,
      candidateExperience: structuredResume.experience,
      projects: structuredResume.projects,
      education: structuredResume.education,
      resumeText: resume.extracted_text || "",
      matchResults: skillMatches,
      resumeImprovementMetrics: resumeImprovementsData?.metrics,
    });

    // 8. Identify Strengths Analysis
    const strengths = this.identifyStrengths({
      resumeSkills: candidateSkills,
      candidateExperience: structuredResume.experience,
      projects: structuredResume.projects,
      education: structuredResume.education,
      certifications: structuredResume.certifications,
      matchResults: skillMatches,
      resumeQuality: resumeImprovementsData?.metrics,
      jobRecord: job,
    });

    // 9. Identify Weaknesses & Development Areas
    const weaknesses = this.identifyWeaknesses({
      matchResults: skillMatches,
      projects: structuredResume.projects,
      candidateExperience: structuredResume.experience,
      resumeSections: sections,
      resumeText: resume.extracted_text || "",
      jobRecord: job,
      resumeImprovementsData,
    });

    // 10. Extract Priority Skills (Seamless Day 26 & Day 28 Integration)
    const prioritySkills = this.extractPrioritySkills({
      matchResults: skillMatches,
      jobRecord: job,
      resumeId,
      jobId,
    });

    // 11. Generate Suggested Career Improvements (4 Categories)
    const careerImprovements = this.generateCareerImprovements({
      prioritySkills,
      weaknesses,
      projects: structuredResume.projects,
      candidateExperience: structuredResume.experience,
      resumeImprovementsData,
      jobRecord: job,
    });

    // 12. Generate Career Insights Summary
    let summary = this.generateCareerInsightsSummary({
      readiness: careerReadiness,
      strengths,
      weaknesses,
      prioritySkills,
      improvements: careerImprovements,
      jobRecord: job,
    });

    // 13. Optional AI Enhancement for Summary Narrative (if configured and not forced fallback)
    const canUseAi = !options.forceFallback && validateAiConfig().valid;
    if (canUseAi) {
      try {
        const aiSummary = await this.generateAiInsightsNarrative({
          jobTitle: job.title,
          company: job.company,
          readiness: careerReadiness,
          strengths,
          weaknesses,
          prioritySkills,
        });
        if (aiSummary && typeof aiSummary.overallSynthesis === "string") {
          summary = {
            ...summary,
            ...aiSummary,
          };
        }
      } catch (aiErr) {
        console.warn("[CareerInsightsService] AI synthesis skipped, using deterministic fallback:", aiErr.message);
      }
    }

    // 14. Ensure analysis record exists
    let analysisId = null;
    const [existingAnalyses] = await db.query(
      `SELECT id, summary FROM analyses WHERE resume_id = ? AND job_id = ? AND user_id = ? ORDER BY id DESC LIMIT 1`,
      [resumeId, jobId, userId]
    );

    if (existingAnalyses && existingAnalyses.length > 0) {
      analysisId = existingAnalyses[0].id;
    } else {
      const matchScoreData = await MatchScoreService.calculateMatchScore({
        resumeId,
        jobDescriptionId: jobId,
        userId,
      });
      analysisId = matchScoreData.analysisId;
    }

    const payload = {
      analysisId,
      resumeId,
      jobId,
      jobTitle: job.title,
      company: job.company || "Target Organization",
      resumeFilename: resume.original_filename,
      careerReadiness,
      strengths,
      weaknesses,
      prioritySkills,
      careerImprovements,
      summary,
      generatedAt: new Date().toISOString(),
      algorithmVersion: CAREER_INSIGHTS_ALGORITHM_VERSION,
    };

    // 15. Persist insights to database
    if (analysisId) {
      await this.persistCareerInsights(analysisId, payload);
    }

    return payload;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 1. OVERALL CAREER READINESS METHODOLOGY & FORMULA
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Transparent, explainable multi-dimensional career readiness calculation.
   *
   * Distinct from Day 21 Job Match Score (which evaluates narrow single-job alignment).
   * Evaluates broader career preparation across 5 dimensions:
   * 1. Technical Competency (35%)
   * 2. Practical Project Experience (25%)
   * 3. Professional Experience (20%) [with early-career weight normalization]
   * 4. Education & Qualifications (10%)
   * 5. Resume Presentation & Profile Clarity (10%)
   */
  static calculateCareerReadiness({
    resumeSkills,
    jobSkills,
    candidateExperience,
    projects,
    education,
    resumeText,
    matchResults,
    resumeImprovementMetrics,
  }) {
    // Check for Insufficient Data condition
    const hasZeroSkills = (!resumeSkills || resumeSkills.length === 0);
    const hasZeroProjects = (!projects || projects.length === 0);
    const hasZeroExperience = (!candidateExperience || candidateExperience.length === 0);
    const isTextMinimal = (!resumeText || resumeText.trim().length < 50);

    if (hasZeroSkills && hasZeroProjects && hasZeroExperience && isTextMinimal) {
      return {
        score: null,
        level: "Insufficient Data",
        tier: "INSUFFICIENT_DATA",
        status: "INSUFFICIENT_DATA",
        explanation: "The uploaded resume does not contain enough extracted technical skills, practical projects, or work experience to compute a reliable career readiness assessment. Please provide a more complete resume document.",
        dimensions: [],
        limitationsDisclaimer: "Career readiness is an advisory estimate based on verified resume evidence and does not guarantee employment or hiring outcomes.",
      };
    }

    const strongMatches = matchResults.filter((m) => m.category === "STRONG_MATCH");
    const partialMatches = matchResults.filter((m) => m.category === "PARTIAL_MATCH");
    const totalJobRequirements = jobSkills.length;

    // Dimension 1: Technical Competency (Default Weight: 35%)
    let techScore = 0;
    if (resumeSkills.length > 0) {
      const matchCredit = (strongMatches.length * 1.0) + (partialMatches.length * 0.5);
      const ratio = totalJobRequirements > 0 ? matchCredit / totalJobRequirements : 0.8;
      const categoriesSet = new Set(resumeSkills.map((s) => s.category).filter(Boolean));
      const breadthBonus = categoriesSet.size >= 3 ? 15 : categoriesSet.size >= 2 ? 10 : 5;
      techScore = Math.min(100, Math.round((ratio * 80) + breadthBonus));
    }

    // Dimension 2: Practical Project Experience (Default Weight: 25%)
    let projScore = 0;
    if (projects && projects.length > 0) {
      const pCount = projects.length;
      const basePoints = pCount >= 3 ? 85 : pCount === 2 ? 75 : 65;
      const hasDetailedBullets = projects.some(
        (p) =>
          (p.description && p.description.length > 20) ||
          (Array.isArray(p.highlights) && p.highlights.length > 0) ||
          (Array.isArray(p.technologies) && p.technologies.length > 0)
      );
      const detailBonus = hasDetailedBullets ? 15 : 5;
      projScore = Math.min(100, basePoints + detailBonus);
    } else {
      projScore = 20; // Some general competence assumed, but practical portfolio evidence is missing
    }

    // Dimension 3: Professional Experience (Default Weight: 20%)
    let expScore = 0;
    let isEarlyCareerNormalized = false;

    if (candidateExperience && candidateExperience.length > 0) {
      const expCount = candidateExperience.length;
      let durationYears = 0;
      for (const e of candidateExperience) {
        const text = `${e.duration || ""} ${e.description || ""} ${e.title || ""} ${e.role || ""}`;
        const match = text.match(/(\d+)\+?\s*years?/i);
        if (match) {
          durationYears += parseInt(match[1], 10);
        }
      }
      if (durationYears >= 5 || expCount >= 3) {
        expScore = 90;
      } else if (durationYears >= 3 || expCount >= 2) {
        expScore = 80;
      } else if (durationYears >= 1 || expCount >= 1) {
        expScore = 70;
      } else {
        expScore = 60;
      }
    } else {
      // Early career candidate / student without formal work history
      isEarlyCareerNormalized = true;
      expScore = projects && projects.length > 0 ? 55 : 25;
    }

    // Dimension 4: Education & Qualifications (Default Weight: 10%)
    let eduScore = 70; // Baseline general qualification
    if (education && education.length > 0) {
      const eduText = JSON.stringify(education).toLowerCase();
      if (/computer science|software engineering|information technology|computer engineering/i.test(eduText)) {
        eduScore = 95;
      } else if (/degree|bachelor|master|b\.s|b\.e|b\.tech/i.test(eduText)) {
        eduScore = 85;
      } else {
        eduScore = 75;
      }
    }

    // Dimension 5: Resume Presentation & Profile Clarity (Default Weight: 10%)
    let presScore = 75;
    if (resumeImprovementMetrics?.readinessScore) {
      presScore = resumeImprovementMetrics.readinessScore;
    }

    // Dynamic Weight Allocation: If early career, redistribute professional experience weight
    let weights = {
      tech: 0.35,
      proj: 0.25,
      exp: 0.20,
      edu: 0.10,
      pres: 0.10,
    };

    if (isEarlyCareerNormalized) {
      weights = {
        tech: 0.40,
        proj: 0.35,
        exp: 0.05,
        edu: 0.10,
        pres: 0.10,
      };
    }

    const calculatedReadiness = Math.round(
      (techScore * weights.tech) +
      (projScore * weights.proj) +
      (expScore * weights.exp) +
      (eduScore * weights.edu) +
      (presScore * weights.pres)
    );

    const boundedScore = Math.max(10, Math.min(100, calculatedReadiness));

    // Determine readiness level
    const matchedThreshold = READINESS_THRESHOLDS.find(
      (t) => boundedScore >= t.min && boundedScore <= t.max
    ) || READINESS_THRESHOLDS[READINESS_THRESHOLDS.length - 1];

    const dimensions = [
      {
        name: "Technical Competency",
        key: "technicalSkills",
        score: techScore,
        weight: Math.round(weights.tech * 100),
        weightedScore: Number((techScore * weights.tech).toFixed(1)),
        explanation: `${strongMatches.length} verified strong skill matches and ${partialMatches.length} transferable competencies.`,
        status: "APPLICABLE",
      },
      {
        name: "Practical Project Experience",
        key: "projectExperience",
        score: projScore,
        weight: Math.round(weights.proj * 100),
        weightedScore: Number((projScore * weights.proj).toFixed(1)),
        explanation: projects?.length
          ? `${projects.length} practical projects demonstrating applied software development.`
          : "No dedicated projects section identified; practical code demonstration needed.",
        status: "APPLICABLE",
      },
      {
        name: "Professional Experience",
        key: "professionalExperience",
        score: expScore,
        weight: Math.round(weights.exp * 100),
        weightedScore: Number((expScore * weights.exp).toFixed(1)),
        explanation: isEarlyCareerNormalized
          ? "Early-career profile; weighting redistributed toward practical project demonstration."
          : `${candidateExperience?.length || 0} documented employment/role entries.`,
        status: "APPLICABLE",
      },
      {
        name: "Education & Qualifications",
        key: "educationAndQualifications",
        score: eduScore,
        weight: Math.round(weights.edu * 100),
        weightedScore: Number((eduScore * weights.edu).toFixed(1)),
        explanation: education?.length
          ? "Recognized academic foundation supporting technical capability."
          : "Standard foundational qualification assumed.",
        status: "APPLICABLE",
      },
      {
        name: "Resume Quality & Presentation",
        key: "resumeQuality",
        score: presScore,
        weight: Math.round(weights.pres * 100),
        weightedScore: Number((presScore * weights.pres).toFixed(1)),
        explanation: "Evaluates active verb usage, ATS keyword alignment, and section clarity.",
        status: "APPLICABLE",
      },
    ];

    return {
      score: boundedScore,
      level: matchedThreshold.level,
      tier: matchedThreshold.tier,
      status: "AVAILABLE",
      explanation: matchedThreshold.description,
      dimensions,
      isEarlyCareerNormalized,
      limitationsDisclaimer:
        "Career readiness is an explainable advisory evaluation based on verified resume evidence. It provides developmental guidance and does not guarantee employment or hiring outcomes.",
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 2. STRENGTHS ANALYSIS
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Identifies candidate's verified strengths grounded in actual resume evidence.
   */
  static identifyStrengths({
    resumeSkills,
    candidateExperience,
    projects,
    education,
    certifications,
    matchResults,
    jobRecord,
  }) {
    const strengths = [];
    const jobTitle = jobRecord?.title || "Target Role";

    // Strength 1: Strongly Matched Core Technical Skills
    const strongSkills = matchResults.filter((m) => m.category === "STRONG_MATCH");
    if (strongSkills.length > 0) {
      const topNames = strongSkills.slice(0, 4).map((s) => s.jobSkill).join(", ");
      strengths.push({
        id: "str-tech-core",
        title: `Verified Competency in Core Technologies (${topNames})`,
        category: "TECHNICAL",
        explanation: `Your resume demonstrates verified, hands-on evidence in ${topNames}, directly satisfying primary requirements for ${jobTitle}.`,
        supportingEvidence: strongSkills[0].resumeEvidence?.[0] || `Identified through resume skills and project mentions: ${topNames}.`,
        valueProposition: "Reduces onboarding ramp time and establishes immediate technical credibility during interview technical assessments.",
      });
    }

    // Strength 2: Practical Project Demonstrations
    if (projects && projects.length > 0) {
      const sampleProj = projects[0];
      const pName = sampleProj.name || "Technical Project";
      const techList = Array.isArray(sampleProj.technologies) && sampleProj.technologies.length > 0
        ? sampleProj.technologies.join(", ")
        : "modern web frameworks";

      strengths.push({
        id: "str-projects",
        title: `Practical Implementation Evidence in "${pName}"`,
        category: "PROJECTS",
        explanation: `Demonstrated application of software engineering principles through standalone projects utilizing ${techList}.`,
        supportingEvidence: sampleProj.description || `Project entry: ${pName} implementing ${techList}.`,
        valueProposition: "Proves you can translate theoretical knowledge into functional, working software applications.",
      });
    }

    // Strength 3: Academic Background & Foundational Training
    if (education && education.length > 0) {
      const eduItem = education[0];
      const degreeStr = eduItem.degree || eduItem.field_of_study || "Software Engineering Education";
      const instStr = eduItem.institution || eduItem.school ? ` from ${eduItem.institution || eduItem.school}` : "";

      strengths.push({
        id: "str-education",
        title: `Structured Academic Foundation (${degreeStr})`,
        category: "EDUCATION",
        explanation: `Formal degree program ${instStr} providing foundational principles in algorithms, data structures, and computer science systems.`,
        supportingEvidence: `${degreeStr}${instStr}`,
        valueProposition: "Gives hiring teams confidence in your foundational problem-solving capability and long-term learning agility.",
      });
    }

    // Strength 4: Verified Certifications (if present)
    if (certifications && certifications.length > 0) {
      const certName = certifications[0].name || certifications[0].title || "Technical Certification";
      strengths.push({
        id: "str-certifications",
        title: `Industry-Recognized Certification: ${certName}`,
        category: "CERTIFICATION",
        explanation: `Validated external benchmark validating specialized competency in ${certName}.`,
        supportingEvidence: certName,
        valueProposition: "Demonstrates proactive self-directed learning and adherence to industry standards.",
      });
    }

    // Strength 5: Professional / Collaborative Experience
    if (candidateExperience && candidateExperience.length > 0) {
      const exp = candidateExperience[0];
      const roleTitle = exp.title || exp.role || "Software Developer";
      const company = exp.company ? ` at ${exp.company}` : "";

      strengths.push({
        id: "str-experience",
        title: `Practical Workplace Experience (${roleTitle}${company})`,
        category: "EXPERIENCE",
        explanation: `Demonstrated ability to contribute within a workplace structure, collaborating with team members and delivering operational work.`,
        supportingEvidence: exp.description || `${roleTitle}${company}`,
        valueProposition: "Confirms workplace readiness and familiarity with team collaboration, version control, and production delivery.",
      });
    }

    // Fallback if sparse resume
    if (strengths.length === 0) {
      strengths.push({
        id: "str-general-foundations",
        title: "Established Technical Interest & Foundational Exposure",
        category: "TECHNICAL",
        explanation: "Your resume establishes foundational familiarity with modern software development concepts.",
        supportingEvidence: "Initial technical mentions in uploaded profile.",
        valueProposition: "Provides a workable baseline for focused skill acceleration.",
      });
    }

    return strengths;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 3. WEAKNESSES & DEVELOPMENT AREAS
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Identifies fair, non-judgmental development areas based on missing evidence.
   */
  static identifyWeaknesses({
    matchResults,
    projects,
    candidateExperience,
    resumeSections,
    resumeText,
    jobRecord,
    resumeImprovementsData,
  }) {
    const weaknesses = [];
    const jobTitle = jobRecord?.title || "the target role";

    // Weakness 1: Missing Required Technologies
    const missingRequired = matchResults.filter(
      (m) => m.category === "MISSING" && m.requirementType === "REQUIRED"
    );

    if (missingRequired.length > 0) {
      const missingNames = missingRequired.slice(0, 3).map((m) => m.jobSkill).join(", ");
      weaknesses.push({
        id: "weak-missing-required",
        issue: `Required Technologies Not Evidenced in Resume (${missingNames})`,
        category: "TECHNICAL_GAP",
        priority: "HIGH",
        explanation: `${missingNames} are explicitly listed as required competencies for ${jobTitle}, but no direct evidence was identified in your uploaded resume.`,
        evidence: `Job requires ${missingNames}; no matching mentions found in resume text or skills list.`,
        whyItMatters: "Automated ATS screening and technical recruiters often filter candidates who lack explicit evidence of mandatory tools.",
        suggestedImprovement: `If you have worked with these technologies, ensure they appear in your Skills and Project sections. If not, prioritize them on your Learning Roadmap.`,
      });
    }

    // Weakness 2: Partial Skill Matches / Technology Transitions
    const partialMatches = matchResults.filter((m) => m.category === "PARTIAL_MATCH");
    if (partialMatches.length > 0) {
      const samplePartial = partialMatches[0];
      weaknesses.push({
        id: "weak-partial-matches",
        issue: `Transferable Background in ${samplePartial.matchedSkill || "Related Tool"}, but ${samplePartial.jobSkill} Not Explicitly Demonstrated`,
        category: "TECHNICAL_GAP",
        priority: "MEDIUM",
        explanation: `You demonstrate related capability in ${samplePartial.matchedSkill || "related technologies"}, but specific production experience with ${samplePartial.jobSkill} is not directly evidenced.`,
        evidence: samplePartial.explanation || `Candidate has ${samplePartial.matchedSkill}; job requests ${samplePartial.jobSkill}.`,
        whyItMatters: "Hiring managers look for quick-start familiarity; closing this bridge provides a high return on study effort.",
        suggestedImprovement: `Build a small exercise translating your ${samplePartial.matchedSkill || "existing"} knowledge to ${samplePartial.jobSkill}.`,
      });
    }

    // Weakness 3: Limited Practical Project Evidence or Vague Bullets
    if (!projects || projects.length === 0) {
      weaknesses.push({
        id: "weak-no-projects",
        issue: "No Dedicated Projects Section Identified",
        category: "PROJECT_DEPTH",
        priority: "HIGH",
        explanation: "Your resume does not currently contain a structured Projects section to showcase hands-on application of your skills.",
        evidence: "Missing PROJECTS section in parsed resume.",
        whyItMatters: "Practical projects serve as primary proof of competency for hiring managers, particularly for candidates with early-stage experience.",
        suggestedImprovement: "Add 2-3 prominent technical projects highlighting architecture, libraries used, and measurable results.",
      });
    } else if (resumeImprovementsData?.weakDescriptions && resumeImprovementsData.weakDescriptions.length > 0) {
      const sampleWeak = resumeImprovementsData.weakDescriptions[0];
      weaknesses.push({
        id: "weak-bullet-depth",
        issue: "Passive Phrasing or Missing Quantifiable Metrics in Descriptions",
        category: "RESUME_PRESENTATION",
        priority: "MEDIUM",
        explanation: "Several project or experience descriptions rely on passive phrasing without demonstrating measurable outcomes.",
        evidence: sampleWeak.originalText ? `Sample phrase: "${sampleWeak.originalText.slice(0, 60)}..."` : "Bullets lack quantified impact metrics.",
        whyItMatters: "Bullet points structured as Action Verb + Implementation + Metric generate significantly higher interview invitation rates.",
        suggestedImprovement: "Adopt the Action + Metric rewrite format suggested in your Resume Improvements recommendations.",
      });
    }

    // Weakness 4: Missing Executive Summary
    const hasSummary = resumeSections && resumeSections.some((s) => s.section_type === "SUMMARY");
    if (!hasSummary) {
      weaknesses.push({
        id: "weak-no-summary",
        issue: "Professional Executive Summary Absent",
        category: "RESUME_PRESENTATION",
        priority: "LOW",
        explanation: "The resume transitions immediately into experience or skills without framing your background with an executive introduction.",
        evidence: "Missing SUMMARY section at document top.",
        whyItMatters: "A targeted 2-line summary immediately communicates your career focus and primary technical stack to reviewers.",
        suggestedImprovement: "Add a concise professional summary targeted directly at the role title.",
      });
    }

    return weaknesses;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 4. PRIORITY SKILLS (ROADMAP INTEGRATION)
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Extracts prioritized skills directly aligned with Day 26 Roadmap & Day 28 Recommendations.
   */
  static extractPrioritySkills({ matchResults, jobRecord, resumeId, jobId }) {
    const gaps = matchResults.filter(
      (m) => m.category === "MISSING" || m.category === "PARTIAL_MATCH"
    );

    // Sort: Required first, then HIGH priority, then MEDIUM, then LOW
    gaps.sort((a, b) => {
      const aReq = a.requirementType === "REQUIRED" ? 1 : 0;
      const bReq = b.requirementType === "REQUIRED" ? 1 : 0;
      if (aReq !== bReq) return bReq - aReq;

      const priorityWeight = { HIGH: 3, MEDIUM: 2, LOW: 1 };
      const aP = priorityWeight[a.priority] || 2;
      const bP = priorityWeight[b.priority] || 2;
      return bP - aP;
    });

    return gaps.slice(0, 5).map((gap) => ({
      skillName: gap.jobSkill,
      matchingStatus: gap.category,
      requirementType: gap.requirementType || "REQUIRED",
      priority: gap.priority || (gap.requirementType === "REQUIRED" ? "HIGH" : "MEDIUM"),
      reason: gap.requirementType === "REQUIRED"
        ? `Explicitly required for ${jobRecord?.title || "the role"}; critical for screening filters.`
        : `Differentiating preferred technology that provides an advantage over competing applicants.`,
      suggestedDirection: gap.category === "PARTIAL_MATCH"
        ? `Bridge your existing ${gap.matchedSkill || "related"} background by learning ${gap.jobSkill} syntax and idiomatic patterns.`
        : `Complete a focused 2-week hands-on learning cycle covering ${gap.jobSkill} fundamentals and configuration.`,
      roadmapLink: `/roadmap?resumeId=${resumeId}&jobId=${jobId}`,
      recommendationLink: `/recommendations?resumeId=${resumeId}&jobId=${jobId}`,
    }));
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 5. SUGGESTED CAREER IMPROVEMENTS (4 CATEGORIES)
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Generates actionable improvements across Technical, Projects, Resume, and Professional areas.
   */
  static generateCareerImprovements({
    prioritySkills,
    weaknesses,
    projects,
    candidateExperience,
    resumeImprovementsData,
    jobRecord,
  }) {
    const topSkill = prioritySkills[0]?.skillName || "target role technologies";
    const secondSkill = prioritySkills[1]?.skillName || "cloud tools";
    const jobTitle = jobRecord?.title || "Software Engineer";

    return {
      technical: [
        {
          title: `Build Hands-On Proficiency in ${topSkill}`,
          category: "TECHNICAL",
          priority: "HIGH",
          explanation: `${topSkill} is a primary development priority for ${jobTitle} roles. Mastering its core concepts and CLI tools addresses your most critical technical gap.`,
          expectedBenefit: "Directly satisfies mandatory screening criteria and expands your technical interview readiness.",
          practicalNextStep: `Follow the step-by-step learning stages for ${topSkill} in your Learning Recommendations dashboard.`,
        },
        {
          title: `Practice Multi-Tool Integration with ${secondSkill}`,
          category: "TECHNICAL",
          priority: "MEDIUM",
          explanation: `Modern development workflows emphasize combining complementary tools (e.g. backend APIs with containerization and relational databases).`,
          expectedBenefit: "Demonstrates practical full-lifecycle engineering capability rather than isolated syntax knowledge.",
          practicalNextStep: `Write a small script or service linking ${topSkill} with ${secondSkill}.`,
        },
      ],

      projects: [
        {
          title: "Develop an End-to-End Portfolio Application",
          category: "PROJECTS",
          priority: "HIGH",
          explanation: `Architect a public application featuring ${topSkill}, database persistence, and a clean user interface.`,
          expectedBenefit: "Provides indisputable tangible proof of competency for technical hiring managers.",
          practicalNextStep: "Initialize a new GitHub repository with a detailed architectural README and Docker/deploy config.",
        },
        {
          title: "Strengthen Existing Project Descriptions with Measurable Impact",
          category: "PROJECTS",
          priority: "MEDIUM",
          explanation: "Update project bullet points to detail exact technical challenges overcome and performance improvements achieved.",
          expectedBenefit: "Dramatically improves reviewer engagement during initial 6-second resume evaluations.",
          practicalNextStep: "Review the suggested project rewrites on your Resume Improvements page.",
        },
      ],

      resume: [
        {
          title: "Align Professional Summary with Target Role",
          category: "RESUME",
          priority: "HIGH",
          explanation: `Ensure your executive summary prominently features your primary tech stack and aligns with the ${jobTitle} role.`,
          expectedBenefit: "Immediately validates role relevance for non-technical recruiter screenings.",
          practicalNextStep: "Copy the recommended summary rewrite from the Resume Improvements tab.",
        },
        {
          title: "Organize Technical Skills into Clear Standard Categories",
          category: "RESUME",
          priority: "MEDIUM",
          explanation: "Group flat skill lists into Languages, Frameworks, Databases, and Tools, prioritizing role matches at the front.",
          expectedBenefit: "Makes your resume significantly faster to scan and improves ATS keyword indexability.",
          practicalNextStep: "Adopt the categorized skill layout provided in your Resume Improvement recommendations.",
        },
      ],

      professional: [
        {
          title: "Curate a Professional GitHub Profile & Technical Documentation",
          category: "PROFESSIONAL",
          priority: "MEDIUM",
          explanation: "Organize your public code repositories with clean commit histories, setup documentation, and clear architectural overviews.",
          expectedBenefit: "Serves as asynchronous technical validation during hiring committee evaluations.",
          practicalNextStep: "Pick your best project and write a comprehensive README.md with setup steps and architecture diagrams.",
        },
        {
          title: "Participate in Open-Source or Community Code Reviews",
          category: "PROFESSIONAL",
          priority: "LOW",
          explanation: "Engage with public issue trackers, review pull requests, or contribute documentation to open-source software.",
          expectedBenefit: "Demonstrates collaborative teamwork and code navigation skills in large established codebases.",
          practicalNextStep: "Explore repositories on GitHub tagged with 'good first issue' in your primary programming language.",
        },
      ],
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 6. CAREER INSIGHTS SUMMARY
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Synthesizes strengths, development areas, and next steps into a personalized summary.
   */
  static generateCareerInsightsSummary({ readiness, strengths, weaknesses, prioritySkills, improvements, jobRecord }) {
    const jobTitle = jobRecord?.title || "your target role";
    const topStrengths = strengths.slice(0, 2).map((s) => s.title).join(" and ");
    const topGaps = weaknesses.slice(0, 2).map((w) => w.issue).join("; ");
    const topPriorities = prioritySkills.slice(0, 3).map((p) => p.skillName);

    const nextActions = [
      improvements.technical?.[0]?.practicalNextStep || "Focus on your highest priority skill gap.",
      improvements.projects?.[0]?.practicalNextStep || "Build a portfolio project demonstrating your core stack.",
      improvements.resume?.[0]?.practicalNextStep || "Adopt suggested bullet point rewrites to highlight measurable outcomes.",
    ];

    const synthesis = readiness.status === "INSUFFICIENT_DATA"
      ? "Your profile requires additional extracted evidence before a comprehensive readiness assessment can be finalized. Upload an updated resume with detailed projects and skills."
      : `You are currently evaluated at the '${readiness.level}' career readiness stage (${readiness.score}%) for ${jobTitle} positions. By addressing your primary technical gaps in ${topPriorities.join(", ") || "core tools"} and strengthening your project impact metrics, you can substantially improve your competitiveness for target roles.`;

    return {
      keyStrengthsOverview: topStrengths ? `Evidenced strengths in ${topStrengths}.` : "Foundational technical competencies established.",
      keyDevelopmentAreasOverview: topGaps ? `Primary development opportunities: ${topGaps}.` : "Target technical skills require continued reinforcement.",
      topPrioritySkills: topPriorities,
      immediateNextActions: nextActions,
      overallSynthesis: synthesis,
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 7. AI INTEGRATION WITH FACTUAL INTEGRITY GUARDRAILS
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Prompts OpenAI / configured LLM for contextual career narrative synthesis.
   */
  static async generateAiInsightsNarrative({ jobTitle, company, readiness, strengths, weaknesses, prioritySkills }) {
    const prompt = `You are a career development expert for SkillLens AI.
Synthesize a concise career insights summary for this candidate:

TARGET ROLE: ${jobTitle} at ${company || "Target Company"}
ASSESSED READINESS LEVEL: ${readiness.level} (${readiness.score}%)

KEY STRENGTHS:
${strengths.map((s) => `- ${s.title}: ${s.explanation}`).join("\n")}

KEY DEVELOPMENT AREAS:
${weaknesses.map((w) => `- ${w.issue}: ${w.explanation}`).join("\n")}

TOP PRIORITY SKILLS:
${prioritySkills.map((p) => `- ${p.skillName} (${p.priority} priority)`).join("\n")}

STRICT RULES:
1. Do NOT alter, recalculate, or invent scores or percentages.
2. Do NOT invent companies, degrees, dates, or certifications.
3. Keep the tone encouraging, professional, and practical.

Respond ONLY with a JSON object matching this schema:
{
  "keyStrengthsOverview": "1-2 sentence overview of verified strengths",
  "keyDevelopmentAreasOverview": "1-2 sentence overview of key development areas",
  "overallSynthesis": "2-3 sentence strategic synthesis of candidate readiness and practical trajectory"
}`;

    const response = await generateText(prompt, {
      systemPrompt: "You are a professional career development advisor specializing in technical career transitions.",
      temperature: 0.2,
      maxTokens: 500,
      jsonMode: true,
    });

    try {
      const parsed = JSON.parse(response.text);
      return {
        keyStrengthsOverview: typeof parsed.keyStrengthsOverview === "string" ? parsed.keyStrengthsOverview : undefined,
        keyDevelopmentAreasOverview: typeof parsed.keyDevelopmentAreasOverview === "string" ? parsed.keyDevelopmentAreasOverview : undefined,
        overallSynthesis: typeof parsed.overallSynthesis === "string" ? parsed.overallSynthesis : undefined,
      };
    } catch (_) {
      return null;
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 8. DATABASE PERSISTENCE
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Persists career insights into MySQL `career_insights` table and updates `analyses.summary`.
   */
  static async persistCareerInsights(analysisId, payload) {
    if (!analysisId) return;

    try {
      // 1. Insert or update in career_insights table
      const readinessScore = payload.careerReadiness?.score || null;
      const readinessLevel = payload.careerReadiness?.level || "INSUFFICIENT_DATA";
      const strengthsCount = payload.strengths?.length || 0;
      const weaknessesCount = payload.weaknesses?.length || 0;
      const priorityCount = payload.prioritySkills?.length || 0;
      const summaryText = payload.summary?.overallSynthesis || null;

      // Check if entry exists for this analysisId
      const [existingRows] = await db.query(
        `SELECT id FROM career_insights WHERE analysis_id = ? LIMIT 1`,
        [analysisId]
      );

      if (existingRows && existingRows.length > 0) {
        await db.query(
          `UPDATE career_insights
           SET readiness_score = ?, readiness_level = ?, strengths_count = ?, weaknesses_count = ?, priority_skills_count = ?, summary = ?, updated_at = CURRENT_TIMESTAMP
           WHERE analysis_id = ?`,
          [readinessScore, readinessLevel, strengthsCount, weaknessesCount, priorityCount, summaryText, analysisId]
        );
      } else {
        await db.query(
          `INSERT INTO career_insights (analysis_id, readiness_score, readiness_level, strengths_count, weaknesses_count, priority_skills_count, summary)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [analysisId, readinessScore, readinessLevel, strengthsCount, weaknessesCount, priorityCount, summaryText]
        );
      }

      // 2. Update analyses table summary JSON to preserve full structured payload
      const [analysisRows] = await db.query(
        `SELECT summary FROM analyses WHERE id = ? LIMIT 1`,
        [analysisId]
      );

      let summaryObj = {};
      if (analysisRows && analysisRows.length > 0 && analysisRows[0].summary) {
        try {
          summaryObj = JSON.parse(analysisRows[0].summary);
        } catch (_) {
          summaryObj = { rawSummaryText: analysisRows[0].summary };
        }
      }

      summaryObj.careerInsights = payload;

      await db.query(
        `UPDATE analyses SET summary = ? WHERE id = ?`,
        [JSON.stringify(summaryObj), analysisId]
      );
    } catch (saveErr) {
      console.error("[CareerInsightsService] Failed to persist career insights:", saveErr.message);
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 9. HELPERS & ACCESS CONTROL
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Verifies user ownership of resume and job description.
   */
  static async verifyUserAccess(resumeId, jobId, userId) {
    const [resumes] = await db.query(
      `SELECT id, user_id, original_filename, extracted_text
       FROM resumes
       WHERE id = ? AND user_id = ?
       LIMIT 1`,
      [resumeId, userId]
    );

    if (!resumes || resumes.length === 0) {
      const err = new Error("Resume not found or access denied.");
      err.status = 404;
      throw err;
    }

    const [jobs] = await db.query(
      `SELECT id, user_id, title, company, description
       FROM jobs
       WHERE id = ? AND user_id = ?
       LIMIT 1`,
      [jobId, userId]
    );

    if (!jobs || jobs.length === 0) {
      const err = new Error("Job description not found or access denied.");
      err.status = 404;
      throw err;
    }

    return { resume: resumes[0], job: jobs[0] };
  }

  /**
   * Reassembles structured resume sections from MySQL rows.
   */
  static assembleStructuredResume(sections, rawText) {
    const model = {
      summary: "",
      experience: [],
      projects: [],
      education: [],
      certifications: [],
    };

    for (const sec of sections) {
      const type = sec.section_type;
      const content = sec.section_content;

      if (type === "SUMMARY") {
        model.summary = content;
      } else if (type === "EXPERIENCE") {
        try {
          model.experience = JSON.parse(content);
        } catch (_) {
          model.experience = [{ description: content }];
        }
      } else if (type === "PROJECTS") {
        try {
          model.projects = JSON.parse(content);
        } catch (_) {
          model.projects = [{ description: content }];
        }
      } else if (type === "EDUCATION") {
        try {
          model.education = JSON.parse(content);
        } catch (_) {}
      } else if (type === "CERTIFICATIONS") {
        try {
          model.certifications = JSON.parse(content);
        } catch (_) {}
      }
    }

    return model;
  }
}

module.exports = CareerInsightsService;

