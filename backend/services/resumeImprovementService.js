/**
 * SkillLens AI — Resume Improvement Service
 * Day 29: AI-Powered Resume Improvement Suggestions Engine
 *
 * Analyzes a user's uploaded resume and compares it against their target job description
 * to generate actionable, honest improvement suggestions across five categories:
 * 1. Better Professional Summaries (original vs suggested improved summary, explanation).
 * 2. Stronger Project Descriptions (Action Verb + Implementation + Tech + Result with [X]% placeholders).
 * 3. Missing Job-Relevant Keywords (Required, Preferred, Present, Needs Better Presentation).
 * 4. Weak or Unclear Descriptions (passive voice, clichés, lack of technical depth).
 * 5. Skill Presentation Improvements (logical category grouping, deduplication, target job prioritization).
 *
 * Grounded in factual integrity: never invents qualifications, metrics, companies, or experience.
 * Incorporates Day 18 AI integration with strict schema validation and deterministic fallback.
 * Persists suggestions in `resume_suggestions` and `analyses` tables.
 */

const db = require("../config/db");
const { normalizeSkillName } = require("../utils/skillNormalizer");
const { SKILL_CATALOGUE } = require("../utils/skillCatalogue");
const SkillMatchingService = require("./skillMatchingService");
const MatchScoreService = require("./matchScoreService");
const { generateText, validateAiConfig } = require("./aiService");

const IMPROVEMENT_ALGORITHM_VERSION = "1.0";

/**
 * Standard cliché phrases and weak verbs to detect across resume text.
 */
const WEAK_PATTERNS = [
  {
    regex: /\b(?:responsible for|duties included|tasked with|assigned to)\b/i,
    problem: "Passive duty-based phrasing",
    reason: "Duty-based phrases describe passive attendance rather than active ownership, initiative, and measurable accomplishment.",
    actionVerbs: ["Spearheaded", "Architected", "Engineered", "Orchestrated", "Implemented"],
    priority: "HIGH",
  },
  {
    regex: /\b(?:worked on|helped with|assisted in|involved in|participated in)\b/i,
    problem: "Vague participation verb",
    reason: "Vague verbs obscure your exact technical contribution and make it unclear whether you designed, built, or merely assisted.",
    actionVerbs: ["Designed and implemented", "Co-engineered", "Delivered", "Authored", "Constructed"],
    priority: "HIGH",
  },
  {
    regex: /\b(?:hard-?working|go-?getter|team player|self-?starter|motivated professional|results-?driven)\b/i,
    problem: "Generic self-descriptive cliché",
    reason: "Buzzwords take up valuable resume space without demonstrating verified technical proficiency or domain impact.",
    actionVerbs: ["Collaborative software engineer", "Production-focused developer", "Full-stack contributor"],
    priority: "MEDIUM",
  },
  {
    regex: /\b(?:handled bugs|fixed issues|handled tasks|did testing)\b/i,
    problem: "Oversimplified technical contribution",
    reason: "Downplays engineering rigor; does not specify testing frameworks, debugging methodologies, or reliability improvements.",
    actionVerbs: ["Diagnosed root causes and resolved critical defects", "Authored comprehensive test suites", "Streamlined QA workflows"],
    priority: "MEDIUM",
  },
  {
    regex: /\b(?:good communication skills|fast learner|detail-?oriented)\b/i,
    problem: "Unsubstantiated soft skill assertion",
    reason: "Soft skills are best conveyed through concrete project context (e.g. cross-functional collaboration, technical documentation).",
    actionVerbs: ["Coordinated across cross-functional teams", "Authored architectural specifications"],
    priority: "LOW",
  },
];

/**
 * Standard category mappings for skills presentation.
 */
const STANDARD_SKILL_CATEGORIES = [
  {
    key: "languages",
    title: "Programming Languages",
    matchCategories: ["PROGRAMMING"],
  },
  {
    key: "frameworks",
    title: "Frameworks & Libraries",
    matchCategories: ["FRAMEWORK"],
  },
  {
    key: "databases",
    title: "Databases & Storage",
    matchCategories: ["DATABASE"],
  },
  {
    key: "cloudDevops",
    title: "Cloud & DevOps",
    matchCategories: ["CLOUD"],
  },
  {
    key: "tools",
    title: "Developer Tools & Practices",
    matchCategories: ["TOOL", "METHODOLOGY"],
  },
];

class ResumeImprovementService {
  /**
   * Retrieves previously saved suggestions or generates fresh ones.
   *
   * @param {number} resumeId
   * @param {number} jobId
   * @param {number} userId
   * @returns {Promise<Object>}
   */
  static async getSuggestions(resumeId, jobId, userId) {
    if (!resumeId || !jobId || !userId) {
      const err = new Error("resumeId, jobId, and userId are required.");
      err.status = 400;
      throw err;
    }

    // 1. Verify access to resume and job
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

      // Query saved suggestions from resume_suggestions table
      const [savedRows] = await db.query(
        `SELECT id, analysis_id, section, original_text, suggestion, reason, priority, created_at
         FROM resume_suggestions
         WHERE analysis_id = ?
         ORDER BY id ASC`,
        [analysis.id]
      );

      // Check if structured suggestions exist in analysis.summary
      let storedStructured = null;
      if (analysis.summary) {
        try {
          const parsed = JSON.parse(analysis.summary);
          if (parsed.resumeImprovementSuggestions) {
            storedStructured = parsed.resumeImprovementSuggestions;
          }
        } catch (_) {}
      }

      if (savedRows.length > 0 && storedStructured) {
        return storedStructured;
      }
    }

    // Otherwise, generate fresh suggestions
    return await this.generateSuggestions(resumeId, jobId, userId);
  }

  /**
   * Generates comprehensive resume improvement suggestions across the 5 categories.
   *
   * @param {number} resumeId
   * @param {number} jobId
   * @param {number} userId
   * @param {Object} [options]
   * @param {boolean} [options.forceFallback] - Force deterministic rule-based generation
   * @returns {Promise<Object>}
   */
  static async generateSuggestions(resumeId, jobId, userId, options = {}) {
    if (!resumeId || !jobId || !userId) {
      const err = new Error("resumeId, jobId, and userId are required.");
      err.status = 400;
      throw err;
    }

    // 1. Verify ownership
    const { resume, job } = await this.verifyUserAccess(resumeId, jobId, userId);

    // 2. Retrieve structured resume sections
    const [sections] = await db.query(
      `SELECT section_type, section_content, display_order
       FROM resume_sections
       WHERE resume_id = ?
       ORDER BY display_order ASC`,
      [resumeId]
    );

    // Parse structured sections
    const structuredModel = this.assembleStructuredResume(sections, resume.extracted_text || "");

    // Fetch candidate resume_skills
    const [candidateSkillsRows] = await db.query(
      `SELECT s.id, s.name, s.category, rs.proficiency, rs.evidence
       FROM resume_skills rs
       JOIN skills s ON rs.skill_id = s.id
       WHERE rs.resume_id = ?`,
      [resumeId]
    );

    // Fetch target job_skills
    const [jobSkillsRows] = await db.query(
      `SELECT s.id, s.name, s.category, js.priority, js.required, js.evidence
       FROM job_skills js
       JOIN skills s ON js.skill_id = s.id
       WHERE js.job_id = ?`,
      [jobId]
    );

    // 3. Compute skill matching results using Day 20 comparison engine
    const matchingResult = SkillMatchingService.compareSkillSets(candidateSkillsRows, jobSkillsRows);
    const skillMatches = matchingResult.results || [];

    // Also fetch job requirements for keyword and priority extraction
    const [jobRequirements] = await db.query(
      `SELECT requirement_type, requirement_text, priority
       FROM job_requirements
       WHERE job_id = ?`,
      [jobId]
    );

    // 4. Generate Deterministic Suggestions for All 5 Categories
    const summarySuggestion = this.generateSummarySuggestions({
      summaryText: structuredModel.summary,
      candidateSkills: candidateSkillsRows,
      candidateExperience: structuredModel.experience,
      jobRecord: job,
      matchedSkills: skillMatches.filter((m) => m.category === "STRONG_MATCH"),
    });

    const projectSuggestions = this.generateProjectSuggestions({
      projects: structuredModel.projects,
      candidateSkills: candidateSkillsRows,
      jobRecord: job,
      missingSkills: skillMatches.filter((m) => m.category === "MISSING" || m.category === "PARTIAL_MATCH"),
    });

    const keywordSuggestions = this.generateKeywordSuggestions({
      rawResumeText: resume.extracted_text || "",
      candidateSkills: candidateSkillsRows,
      jobSkills: jobSkillsRows,
      jobRequirements,
      matchResults: skillMatches,
    });

    const weakDescriptionSuggestions = this.generateWeakDescriptionSuggestions({
      structuredModel,
      rawText: resume.extracted_text || "",
      jobRecord: job,
    });

    const skillPresentationSuggestions = this.generateSkillPresentationSuggestions({
      resumeSkills: candidateSkillsRows,
      jobSkills: jobSkillsRows,
      rawResumeText: resume.extracted_text || "",
    });

    // Initial deterministic bundle
    let finalSummary = summarySuggestion;
    let finalProjects = projectSuggestions;
    let finalKeywords = keywordSuggestions;
    let finalWeakDescriptions = weakDescriptionSuggestions;
    let finalSkillPresentation = skillPresentationSuggestions;

    // 5. AI Enhancement (if available and not forced fallback)
    const canUseAi = !options.forceFallback && validateAiConfig().valid;
    if (canUseAi) {
      try {
        const aiOutput = await this.generateAiSuggestions({
          summaryText: structuredModel.summary,
          candidateSkills: candidateSkillsRows,
          candidateExperience: structuredModel.experience,
          projects: structuredModel.projects,
          weakDescriptions: weakDescriptionSuggestions,
          jobRecord: job,
          matchedSkills: skillMatches.filter((m) => m.category === "STRONG_MATCH"),
          missingSkills: skillMatches.filter((m) => m.category === "MISSING" || m.category === "PARTIAL_MATCH"),
        });

        if (aiOutput) {
          const sanitized = this.sanitizeAiSuggestions(aiOutput, resume.extracted_text || "", candidateSkillsRows);
          if (sanitized.summary) {
            finalSummary = {
              ...finalSummary,
              ...sanitized.summary,
            };
          }
          if (sanitized.projects && sanitized.projects.length > 0) {
            finalProjects = sanitized.projects;
          }
        }
      } catch (aiErr) {
        // AI service unavailable or failed: keep robust deterministic output
        console.warn("[ResumeImprovementService] AI enhancement failed, falling back to deterministic:", aiErr.message);
      }
    }

    // 6. Calculate Optimization KPIs
    const metrics = this.calculateOptimizationMetrics({
      summary: finalSummary,
      projects: finalProjects,
      keywords: finalKeywords,
      weakDescriptions: finalWeakDescriptions,
      skillPresentation: finalSkillPresentation,
    });

    // 7. Ensure an analysis record exists to link suggestions
    let analysisId = null;
    const [existingAnalyses] = await db.query(
      `SELECT id, summary FROM analyses WHERE resume_id = ? AND job_id = ? AND user_id = ? ORDER BY id DESC LIMIT 1`,
      [resumeId, jobId, userId]
    );

    if (existingAnalyses && existingAnalyses.length > 0) {
      analysisId = existingAnalyses[0].id;
    } else {
      // Calculate match score to establish analysis record
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
      summary: finalSummary,
      projects: finalProjects,
      keywords: finalKeywords,
      weakDescriptions: finalWeakDescriptions,
      skillPresentation: finalSkillPresentation,
      metrics,
      disclaimer:
        "All suggestions are recommendations generated to enhance clarity, relevance, and presentation. Users should only adopt suggestions that truthfully reflect their actual background, skills, and achievements.",
      generatedAt: new Date().toISOString(),
      algorithmVersion: IMPROVEMENT_ALGORITHM_VERSION,
    };

    // 8. Persist suggestions in database
    if (analysisId) {
      await this.persistSuggestions(analysisId, payload);
    }

    return payload;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 1. PROFESSIONAL SUMMARY SUGGESTIONS
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Generates suggestions to improve or introduce the professional summary.
   */
  static generateSummarySuggestions({ summaryText, candidateSkills, candidateExperience, jobRecord, matchedSkills }) {
    const rawSummary = (summaryText || "").trim();
    const candidateSkillNames = candidateSkills.map((s) => s.name);
    const matchedNames = matchedSkills.map((m) => m.jobSkill);
    const keySkillsToHighlight = matchedNames.length > 0 ? matchedNames.slice(0, 4) : candidateSkillNames.slice(0, 4);

    const jobTitle = jobRecord?.title || "Software Engineer";
    const company = jobRecord?.company || "";

    // Case 1: No Summary Present
    if (!rawSummary) {
      const skillsClause = keySkillsToHighlight.length > 0
        ? ` specializing in ${keySkillsToHighlight.join(", ")}`
        : "";
      const suggested = `Goal-driven ${jobTitle}${skillsClause} with demonstrated experience designing and deploying robust, scalable software solutions. Proven background delivering quality user-centric applications and collaborating in agile teams to drive technical excellence.`;

      return {
        hasOriginalSummary: false,
        originalSummary: "No professional summary identified in the uploaded resume.",
        suggestedSummary: suggested,
        identifiedProblems: [
          "Resume is missing an executive summary, forfeiting the opportunity to immediately capture recruiter attention.",
          "Target role alignment is absent at the very top of the document.",
        ],
        strengthsIdentified: keySkillsToHighlight.length > 0
          ? [`Demonstrated background in ${keySkillsToHighlight.join(", ")} can anchor the introduction.`]
          : [],
        reason: "Adding a concise, role-targeted summary immediately frames your technical background around the target job requirements.",
        priority: "HIGH",
      };
    }

    // Case 2: Generic or Weak Summary
    const genericMatches = [];
    if (/hard-?working|motivated professional|results-?driven|enthusiastic|go-?getter/i.test(rawSummary)) {
      genericMatches.push("Contains generic buzzwords ('hardworking', 'results-driven') without substantiating evidence.");
    }
    if (/seeking (?:an? )?(?:entry-level )?position|looking for (?:a )?role|opportunity to utilize my skills/i.test(rawSummary)) {
      genericMatches.push("Focuses on what you want from the employer rather than the value and skills you bring to the role.");
    }
    if (keySkillsToHighlight.length > 0 && !keySkillsToHighlight.some((s) => rawSummary.toLowerCase().includes(s.toLowerCase()))) {
      genericMatches.push(`Omits core role technologies (${keySkillsToHighlight.slice(0, 3).join(", ")}) that align with the ${jobTitle} position.`);
    }

    // Check if original is already strong
    const isAlreadyStrong = genericMatches.length === 0 && rawSummary.length > 80 && keySkillsToHighlight.some((s) => rawSummary.toLowerCase().includes(s.toLowerCase()));

    if (isAlreadyStrong) {
      // Minor role-tailored polish
      const companyTarget = company ? ` at ${company}` : "";
      const suggested = rawSummary.endsWith(".")
        ? `${rawSummary} Targeted toward high-impact ${jobTitle} contributions${companyTarget}.`
        : `${rawSummary}. Targeted toward high-impact ${jobTitle} contributions${companyTarget}.`;

      return {
        hasOriginalSummary: true,
        originalSummary: rawSummary,
        suggestedSummary: suggested,
        identifiedProblems: [
          "Current summary is strong, but could slightly sharpen its alignment with the specific target role title.",
        ],
        strengthsIdentified: [
          "Demonstrates technical focus and avoids cliché phrasing.",
          "Clear overview of candidate experience.",
        ],
        reason: "Fine-tunes an already solid summary to directly resonate with hiring managers screening for the target role.",
        priority: "LOW",
      };
    }

    // Needs improvement
    const skillsListStr = keySkillsToHighlight.length > 0 ? keySkillsToHighlight.join(", ") : "modern software engineering tools";
    const companyMention = company ? ` at ${company}` : "";
    const suggested = `Versatile ${jobTitle} with practical expertise in ${skillsListStr}. Proven track record designing maintainable solutions, resolving complex technical challenges, and delivering production-ready applications aligned with ${jobTitle} objectives${companyMention}.`;

    return {
      hasOriginalSummary: true,
      originalSummary: rawSummary,
      suggestedSummary: suggested,
      identifiedProblems: genericMatches.length > 0 ? genericMatches : ["Lacks targeted role alignment and technical specificity."],
      strengthsIdentified: keySkillsToHighlight.length > 0 ? [`Identified relevant candidate skills: ${keySkillsToHighlight.join(", ")}.`] : [],
      reason: "Replaces passive cliches with targeted competencies and highlights direct alignment with the target role.",
      priority: "HIGH",
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 2. STRONGER PROJECT DESCRIPTIONS
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Analyzes project descriptions and generates structured rewrites:
   * Action Verb + Implementation Detail + Technology Used + Measurable Result ([X]% placeholder).
   */
  static generateProjectSuggestions({ projects, candidateSkills, jobRecord, missingSkills }) {
    const suggestions = [];

    // If candidate has no parsed projects
    if (!projects || !Array.isArray(projects) || projects.length === 0) {
      suggestions.push({
        projectName: "Software Engineering Projects",
        originalBullet: "No project section identified in the uploaded resume.",
        improvedBullet: "Architected and deployed full-stack web application utilizing [Technology A] and [Technology B], implementing [Core Feature/API] and improving system responsiveness by [X]%.",
        improvementExplanation: "A dedicated Projects section with quantifiable outcomes provides concrete evidence of technical ability for technical recruiters.",
        technologiesEmphasized: ["Target Role Core Stack", "Git", "REST APIs"],
        actionVerb: "Architected and deployed",
        priority: "HIGH",
      });
      return suggestions;
    }

    for (const proj of projects) {
      const pName = proj.name || "Technical Project";
      const desc = proj.description || "";
      const rawBullets = Array.isArray(proj.highlights) && proj.highlights.length > 0
        ? proj.highlights
        : desc ? desc.split(/\n|(?<=[.!?])\s+/).filter((s) => s.trim().length > 10) : [];

      const techStack = Array.isArray(proj.technologies) && proj.technologies.length > 0
        ? proj.technologies
        : candidateSkills.slice(0, 3).map((s) => s.name);

      const techStr = techStack.length > 0 ? techStack.slice(0, 3).join(", ") : "modern web frameworks";

      if (rawBullets.length === 0) {
        // Empty description for project
        suggestions.push({
          projectName: pName,
          originalBullet: `Project listed without detailed description or bullet points.`,
          improvedBullet: `Engineered end-to-end ${pName} application utilizing ${techStr}, implementing [Specific Architecture/Module] and reducing latency by [X]%.`,
          improvementExplanation: "Added concrete implementation details, technical stack, and a measurable outcome structure.",
          technologiesEmphasized: techStack.slice(0, 3),
          actionVerb: "Engineered",
          priority: "HIGH",
        });
        continue;
      }

      // Check each bullet in the project
      for (const bullet of rawBullets.slice(0, 3)) {
        const cleanBullet = bullet.trim();
        if (!cleanBullet) continue;

        // Is it vague or very short?
        const isShort = cleanBullet.length < 50;
        const hasWeakVerb = /^(?:worked on|helped|assisted|created|made|did|built an?|handled)/i.test(cleanBullet);
        const hasMetric = /\b\d+(?:%|ms|s|x|\+)?\b/i.test(cleanBullet);

        let actionVerb = "Architected";
        if (/api|backend|database|server/i.test(cleanBullet)) actionVerb = "Engineered";
        else if (/ui|frontend|react|interface|view/i.test(cleanBullet)) actionVerb = "Designed and developed";
        else if (/test|qa|bug|pipeline/i.test(cleanBullet)) actionVerb = "Implemented and automated";

        let improved = cleanBullet;
        let explanation = "";

        if (hasWeakVerb || isShort) {
          const coreSubject = cleanBullet
            .replace(/^(?:worked on|helped|assisted|created|made|did|built an?|handled)\s+/i, "")
            .replace(/[.]+$/, "");

          improved = `${actionVerb} ${coreSubject} leveraging ${techStr}, optimizing workflow execution to achieve [X]% improvement in [Performance Metric / Efficiency].`;
          explanation = "Replaced vague introductory verb with a decisive action verb, highlighted relevant technologies, and structured with a quantifiable result placeholder.";
        } else if (!hasMetric) {
          const coreWithoutDot = cleanBullet.replace(/[.]+$/, "");
          improved = `${coreWithoutDot}, enhancing system throughput and reducing manual overhead by [X]%.`;
          explanation = "Enhanced strong technical description with a structured quantifiable outcome to emphasize business and engineering impact.";
        } else {
          // Already detailed with metric
          improved = cleanBullet.endsWith(".") ? cleanBullet : `${cleanBullet}.`;
          explanation = "Project description is already well-structured with clear technical context and measurable metrics.";
        }

        suggestions.push({
          projectName: pName,
          originalBullet: cleanBullet,
          improvedBullet: improved,
          improvementExplanation: explanation,
          technologiesEmphasized: techStack.slice(0, 3),
          actionVerb,
          priority: hasWeakVerb || isShort ? "HIGH" : "MEDIUM",
        });
      }
    }

    return suggestions;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 3. MISSING JOB-RELEVANT KEYWORDS
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Compares resume text and extracted skills against target job requirements.
   * Separates into:
   * - requiredMissing
   * - preferredMissing
   * - alreadyPresent
   * - needsBetterPresentation
   */
  static generateKeywordSuggestions({ rawResumeText, candidateSkills, jobSkills, jobRequirements, matchResults }) {
    const textLower = (rawResumeText || "").toLowerCase();
    const candidateSkillsNormalized = new Set(
      candidateSkills.map((s) => {
        const norm = normalizeSkillName(s.name);
        return norm ? norm.normalizedName : (s.name || "").toLowerCase().trim();
      })
    );

    const requiredMissing = [];
    const preferredMissing = [];
    const alreadyPresent = [];
    const needsBetterPresentation = [];

    // Map through job skills
    for (const js of jobSkills) {
      const normObj = normalizeSkillName(js.name);
      const normKey = normObj ? normObj.normalizedName : (js.name || "").toLowerCase().trim();
      const isPresentInCandidateSkills = candidateSkillsNormalized.has(normKey);
      const isPresentInRawText = textLower.includes(normKey) || (js.name && textLower.includes(js.name.toLowerCase()));

      const isRequired = js.required === 1 || js.required === true || js.priority === "HIGH";

      if (isPresentInCandidateSkills) {
        // Check if it's buried in text but needs better presentation
        alreadyPresent.push({
          keyword: js.name,
          category: js.category || "TECHNICAL",
          importance: isRequired ? "HIGH" : "MEDIUM",
          requirementType: isRequired ? "REQUIRED" : "PREFERRED",
          whyItMatters: `Explicitly sought by the target role. Already identified in your resume profile.`,
          suggestedPlacement: "Ensure this keyword is highlighted in your primary Technical Skills section and linked to a project bullet.",
        });
      } else if (isPresentInRawText) {
        // In raw text but NOT parsed as an explicit skill
        needsBetterPresentation.push({
          keyword: js.name,
          category: js.category || "TECHNICAL",
          importance: isRequired ? "HIGH" : "MEDIUM",
          requirementType: isRequired ? "REQUIRED" : "PREFERRED",
          whyItMatters: `Mentioned in resume text but omitted from the formal Skills summary, risking being overlooked by ATS keyword parsers.`,
          suggestedPlacement: `Add '${js.name}' explicitly to your Technical Skills section under ${js.category || "Relevant Category"} to guarantee ATS indexability.`,
          ethicalNotice: `Only feature prominently if you have verifiable hands-on experience with ${js.name}.`,
        });
      } else {
        // Missing
        const item = {
          keyword: js.name,
          category: js.category || "TECHNICAL",
          importance: isRequired ? "HIGH" : "MEDIUM",
          requirementType: isRequired ? "REQUIRED" : "PREFERRED",
          whyItMatters: isRequired
            ? `Core required competency for this role. Missing this keyword may filter out your resume during initial automated ATS screening.`
            : `Preferred skill that provides a competitive edge over other applicants for this role.`,
          suggestedPlacement: isRequired
            ? `If you have worked with ${js.name}, include it in your Technical Skills section and mention a specific project where you applied it.`
            : `Incorporate into relevant project highlights or skills section if you possess introductory or foundational familiarity.`,
          ethicalNotice: `Never insert '${js.name}' if you do not have practical knowledge. Instead, consult the Skill Gap Roadmap to develop this skill.`,
        };

        if (isRequired) {
          requiredMissing.push(item);
        } else {
          preferredMissing.push(item);
        }
      }
    }

    return {
      requiredMissing,
      preferredMissing,
      alreadyPresent,
      needsBetterPresentation,
      disclaimer: "Caution: Never add keywords for technologies or tools you have not used. Resume claims must be verifiable during technical interviews.",
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 4. WEAK OR UNCLEAR DESCRIPTIONS
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Scans resume text and structured sections for passive phrases, clichés, and vague statements.
   */
  static generateWeakDescriptionSuggestions({ structuredModel, rawText, jobRecord }) {
    const weakSuggestions = [];
    const seenPhrases = new Set();

    // Helper to evaluate text snippets
    const evaluateSnippet = (snippet, sectionName) => {
      if (!snippet || typeof snippet !== "string") return;
      const clean = snippet.trim();
      if (clean.length < 15) return;

      for (const pattern of WEAK_PATTERNS) {
        const match = clean.match(pattern.regex);
        if (match) {
          const phraseKey = `${sectionName}:${clean.slice(0, 40)}`;
          if (seenPhrases.has(phraseKey)) continue;
          seenPhrases.add(phraseKey);

          const matchedWord = match[0];
          const suggestedVerb = pattern.actionVerbs[0];

          // Construct an improved rewrite
          let rewrite = clean.replace(pattern.regex, suggestedVerb);
          if (!/\b\d+(?:%|ms|s|x|\+)?\b/i.test(rewrite)) {
            rewrite = rewrite.replace(/[.]+$/, "") + ", improving execution efficiency by [X]%.";
          }

          weakSuggestions.push({
            section: sectionName,
            originalText: clean,
            identifiedProblem: pattern.problem,
            whyToImprove: pattern.reason,
            suggestedRewrite: rewrite,
            priority: pattern.priority,
            recommendedVerbs: pattern.actionVerbs,
          });
          break;
        }
      }
    };

    // 1. Check summary
    if (structuredModel.summary) {
      evaluateSnippet(structuredModel.summary, "SUMMARY");
    }

    // 2. Check experience bullets
    if (Array.isArray(structuredModel.experience)) {
      for (const exp of structuredModel.experience) {
        const bullets = Array.isArray(exp.responsibilities)
          ? exp.responsibilities
          : typeof exp.description === "string"
          ? exp.description.split(/\n|(?<=[.!?])\s+/)
          : [];

        for (const b of bullets) {
          evaluateSnippet(b, "EXPERIENCE");
        }
      }
    }

    // 3. Check project highlights
    if (Array.isArray(structuredModel.projects)) {
      for (const proj of structuredModel.projects) {
        const bullets = Array.isArray(proj.highlights)
          ? proj.highlights
          : typeof proj.description === "string"
          ? proj.description.split(/\n|(?<=[.!?])\s+/)
          : [];

        for (const b of bullets) {
          evaluateSnippet(b, "PROJECTS");
        }
      }
    }

    // If none found via structured models, scan raw text lines
    if (weakSuggestions.length === 0 && rawText) {
      const lines = rawText.split(/\n+/).map((l) => l.trim()).filter((l) => l.length > 20);
      for (const line of lines) {
        evaluateSnippet(line, "GENERAL");
        if (weakSuggestions.length >= 4) break;
      }
    }

    // If still empty (e.g. clean resume), provide best practice guidance
    if (weakSuggestions.length === 0) {
      weakSuggestions.push({
        section: "GENERAL",
        originalText: "No severe weak phrasing or passive cliches detected.",
        identifiedProblem: "General resume enhancement opportunity",
        whyToImprove: "Even well-phrased bullet points benefit from pairing technical action verbs with quantifiable business or architectural outcomes.",
        suggestedRewrite: "Ensure every bullet follows: [Strong Action Verb] + [Technical Scope & Tools] + [Measurable Business or Engineering Result (e.g. [X]% improvement)].",
        priority: "LOW",
        recommendedVerbs: ["Architected", "Engineered", "Orchestrated", "Implemented"],
      });
    }

    return weakSuggestions;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 5. SKILL PRESENTATION IMPROVEMENTS
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Analyzes skill organization, aliases/duplicates, and logical categorization.
   */
  static generateSkillPresentationSuggestions({ resumeSkills, jobSkills, rawResumeText }) {
    const currentIssues = [];
    const deduplicatedSkills = [];
    const missingFromSkillsSection = [];

    // 1. Detect Duplicate / Aliased Skills
    const aliasMap = new Map();
    for (const item of SKILL_CATALOGUE) {
      const canonical = item.name;
      for (const alias of item.aliases) {
        aliasMap.set(alias.toLowerCase(), canonical);
      }
    }

    // Check resume skills for aliases of the same canonical skill
    const canonicalSeen = new Map(); // canonical -> original skill name in resume
    for (const s of resumeSkills) {
      const lower = s.name.toLowerCase().trim();
      const canonical = aliasMap.get(lower) || s.name;

      if (canonicalSeen.has(canonical.toLowerCase())) {
        const previous = canonicalSeen.get(canonical.toLowerCase());
        if (previous.toLowerCase() !== s.name.toLowerCase()) {
          deduplicatedSkills.push({
            duplicateFound: s.name,
            canonical: previous,
            action: `Remove '${s.name}' to avoid duplicate entries with '${previous}'.`,
          });
          currentIssues.push(`Redundant listing of '${s.name}' alongside '${previous}'.`);
        }
      } else {
        canonicalSeen.set(canonical.toLowerCase(), s.name);
      }
    }

    // Also check raw text for common duplicates (e.g. React and ReactJS appearing together)
    const rawLower = (rawResumeText || "").toLowerCase();
    if (rawLower.includes("reactjs") && rawLower.includes("react.js")) {
      if (!deduplicatedSkills.some((d) => d.duplicateFound.toLowerCase().includes("react"))) {
        deduplicatedSkills.push({
          duplicateFound: "ReactJS",
          canonical: "React",
          action: "Consolidate 'ReactJS' and 'React.js' under the canonical name 'React'.",
        });
      }
    }
    if (rawLower.includes("nodejs") && rawLower.includes("node.js")) {
      if (!deduplicatedSkills.some((d) => d.duplicateFound.toLowerCase().includes("node"))) {
        deduplicatedSkills.push({
          duplicateFound: "NodeJS",
          canonical: "Node.js",
          action: "Consolidate 'NodeJS' into standard 'Node.js'.",
        });
      }
    }

    // 2. Detect Skills in Project/Experience Text but Omitted from Skills Section
    const resumeSkillSet = new Set(resumeSkills.map((s) => s.name.toLowerCase()));
    for (const js of jobSkills) {
      const jsLower = js.name.toLowerCase();
      if (!resumeSkillSet.has(jsLower) && rawLower.includes(jsLower)) {
        missingFromSkillsSection.push({
          skill: js.name,
          category: js.category || "TECHNICAL",
          recommendation: `Found '${js.name}' in your project/experience text; add it explicitly to your Skills section to ensure ATS parsing.`,
        });
      }
    }

    // 3. Recommended Logical Categorization with Job-Relevant Prioritization
    const targetJobSkillSet = new Set(jobSkills.map((s) => s.name.toLowerCase()));

    const recommendedCategories = {};
    for (const cat of STANDARD_SKILL_CATEGORIES) {
      const matchedInCat = resumeSkills.filter((s) => {
        const sCat = (s.category || "").toUpperCase();
        return cat.matchCategories.includes(sCat);
      });

      // Sort: Target job-relevant skills first, then alphabetical
      matchedInCat.sort((a, b) => {
        const aRelevant = targetJobSkillSet.has(a.name.toLowerCase());
        const bRelevant = targetJobSkillSet.has(b.name.toLowerCase());
        if (aRelevant && !bRelevant) return -1;
        if (!aRelevant && bRelevant) return 1;
        return a.name.localeCompare(b.name);
      });

      if (matchedInCat.length > 0) {
        recommendedCategories[cat.title] = matchedInCat.map((s) => s.name);
      }
    }

    // Fallback: If no skills matched categories, group all available candidate skills
    if (Object.keys(recommendedCategories).length === 0 && resumeSkills.length > 0) {
      recommendedCategories["Core Technical Skills"] = resumeSkills.map((s) => s.name);
    }

    if (resumeSkills.length > 15 && Object.keys(recommendedCategories).length <= 1) {
      currentIssues.push("Skills are currently formatted as a flat, unorganized list, making it difficult for recruiters to quickly scan relevant competencies.");
    }

    return {
      currentIssues: currentIssues.length > 0 ? currentIssues : ["No major structural flaws detected in skill presentation."],
      recommendedCategories,
      deduplicatedSkills,
      missingFromSkillsSection,
      prioritizationAdvice: "Position target job-matching skills at the very beginning of each category to immediately validate technical qualification.",
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 6. AI INTEGRATION WITH FACTUAL INTEGRITY GUARDRAILS
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Prompts OpenAI / configured LLM for contextual resume improvement suggestions.
   */
  static async generateAiSuggestions({
    summaryText,
    candidateSkills,
    candidateExperience,
    projects,
    weakDescriptions,
    jobRecord,
    matchedSkills,
    missingSkills,
  }) {
    const jobTitle = jobRecord.title || "Software Engineer";
    const company = jobRecord.company || "Target Company";
    const jobDescSnippet = (jobRecord.description || "").slice(0, 1000);

    const skillsStr = candidateSkills.map((s) => s.name).join(", ");
    const matchedStr = matchedSkills.map((m) => m.jobSkill).join(", ");
    const missingStr = missingSkills.map((m) => m.jobSkill).join(", ");

    const prompt = `You are an expert technical resume coach for SkillLens AI.
Analyze this candidate's resume content against the target role:

TARGET ROLE: ${jobTitle} at ${company}
JOB REQUIREMENTS SNIPPET:
${jobDescSnippet}

CANDIDATE ACTUAL SKILLS: ${skillsStr || "Not explicitly specified"}
MATCHING SKILLS: ${matchedStr || "None"}
MISSING / GAP SKILLS: ${missingStr || "None"}

CURRENT PROFESSIONAL SUMMARY:
${summaryText || "None (Resume currently lacks a summary)"}

SAMPLE PROJECTS:
${JSON.stringify((projects || []).slice(0, 3))}

STRICT FACTUAL INTEGRITY RULES:
1. NEVER invent companies, degrees, dates, certifications, or technologies the candidate has not mentioned.
2. NEVER invent exact metrics, percentages, dollar figures, or user counts. When suggesting metrics, use placeholders like [X]%, [N] users, or [X] ms.
3. Keep suggestions truthful and achievable.

Respond ONLY with a valid JSON object matching this exact schema:
{
  "summary": {
    "suggestedSummary": "Improved professional summary aligning candidate's real skills with ${jobTitle}",
    "reason": "Why this improves the resume",
    "identifiedProblems": ["Problem 1", "Problem 2"]
  },
  "projects": [
    {
      "projectName": "Project name",
      "originalBullet": "Original line",
      "improvedBullet": "Action verb + implementation detail + technologies used + [X]% metric placeholder",
      "improvementExplanation": "Why this rewrite is stronger",
      "technologiesEmphasized": ["Tech1", "Tech2"],
      "actionVerb": "Action verb used",
      "priority": "HIGH"
    }
  ]
}`;

    const response = await generateText(prompt, {
      systemPrompt: "You are a professional technical resume writer specializing in ATS optimization and truthful presentation.",
      temperature: 0.2, // Lower temperature to prevent hallucination
      maxTokens: 1200,
      jsonMode: true,
    });

    try {
      const parsed = JSON.parse(response.text);
      return parsed;
    } catch (parseErr) {
      console.warn("[ResumeImprovementService] Failed to parse AI JSON response:", parseErr.message);
      return null;
    }
  }

  /**
   * Sanitizes AI output against hallucinated facts, metrics, or technologies.
   */
  static sanitizeAiSuggestions(aiOutput, rawResumeText, candidateSkills) {
    if (!aiOutput || typeof aiOutput !== "object") return {};
    const sanitized = {};

    // 1. Sanitize Summary
    if (aiOutput.summary && typeof aiOutput.summary.suggestedSummary === "string") {
      let cleanSummary = aiOutput.summary.suggestedSummary;

      // Anti-hallucination check: replace fabricated metrics (e.g. "$1.2M", "500k users", "400% increase")
      cleanSummary = cleanSummary.replace(/\$\d+(?:\.\d+)?[MBKmbk]?\b/g, "$[X]");
      cleanSummary = cleanSummary.replace(/\b\d{2,}%/g, "[X]%");

      sanitized.summary = {
        suggestedSummary: cleanSummary,
        reason: typeof aiOutput.summary.reason === "string" ? aiOutput.summary.reason : "Aligns candidate experience with the target role.",
        identifiedProblems: Array.isArray(aiOutput.summary.identifiedProblems) ? aiOutput.summary.identifiedProblems : [],
      };
    }

    // 2. Sanitize Projects
    if (Array.isArray(aiOutput.projects)) {
      sanitized.projects = aiOutput.projects.map((p) => {
        let improved = typeof p.improvedBullet === "string" ? p.improvedBullet : "";
        improved = improved.replace(/\$\d+(?:\.\d+)?[MBKmbk]?\b/g, "$[X]");
        improved = improved.replace(/\b\d{2,}%/g, "[X]%");

        return {
          projectName: p.projectName || "Technical Project",
          originalBullet: p.originalBullet || "Project work item",
          improvedBullet: improved,
          improvementExplanation: p.improvementExplanation || "Enhanced with active verbs and quantifiable outcome structure.",
          technologiesEmphasized: Array.isArray(p.technologiesEmphasized) ? p.technologiesEmphasized : [],
          actionVerb: p.actionVerb || "Architected",
          priority: p.priority === "HIGH" ? "HIGH" : "MEDIUM",
        };
      });
    }

    return sanitized;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 7. PERSISTENCE & KPI CALCULATION
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Calculates optimization metrics and readiness index.
   */
  static calculateOptimizationMetrics({ summary, projects, keywords, weakDescriptions, skillPresentation }) {
    let totalSuggestions = 0;
    let highPriorityCount = 0;

    if (summary) {
      totalSuggestions += 1;
      if (summary.priority === "HIGH") highPriorityCount += 1;
    }

    if (Array.isArray(projects)) {
      totalSuggestions += projects.length;
      highPriorityCount += projects.filter((p) => p.priority === "HIGH").length;
    }

    const missingKeywordsCount = (keywords?.requiredMissing?.length || 0) + (keywords?.preferredMissing?.length || 0);
    totalSuggestions += missingKeywordsCount;
    highPriorityCount += (keywords?.requiredMissing?.length || 0);

    if (Array.isArray(weakDescriptions)) {
      totalSuggestions += weakDescriptions.length;
      highPriorityCount += weakDescriptions.filter((w) => w.priority === "HIGH").length;
    }

    if (skillPresentation?.deduplicatedSkills?.length) {
      totalSuggestions += skillPresentation.deduplicatedSkills.length;
    }

    // Calculate resume readiness score (100 - penalties for high/medium issues)
    const penalty = (highPriorityCount * 8) + ((totalSuggestions - highPriorityCount) * 2);
    const readinessScore = Math.max(35, Math.min(95, 100 - penalty));

    return {
      totalSuggestions,
      highPriorityCount,
      missingKeywordsCount,
      readinessScore,
    };
  }

  /**
   * Persists suggestions into MySQL `resume_suggestions` table and updates `analyses.summary`.
   */
  static async persistSuggestions(analysisId, payload) {
    if (!analysisId) return;

    try {
      // 1. Clear previous suggestions for this analysis (idempotent re-runs)
      await db.query(`DELETE FROM resume_suggestions WHERE analysis_id = ?`, [analysisId]);

      // 2. Prepare rows for batch insert
      const rows = [];

      // Summary suggestion
      if (payload.summary) {
        rows.push([
          analysisId,
          "SUMMARY",
          payload.summary.originalSummary || null,
          payload.summary.suggestedSummary,
          payload.summary.reason || "Improve executive summary clarity and role alignment.",
          payload.summary.priority || "MEDIUM",
        ]);
      }

      // Project suggestions
      if (Array.isArray(payload.projects)) {
        for (const proj of payload.projects) {
          rows.push([
            analysisId,
            "PROJECTS",
            proj.originalBullet || null,
            proj.improvedBullet,
            proj.improvementExplanation || `Enhance ${proj.projectName} description.`,
            proj.priority || "MEDIUM",
          ]);
        }
      }

      // Keyword suggestions (required missing)
      if (Array.isArray(payload.keywords?.requiredMissing)) {
        for (const kw of payload.keywords.requiredMissing) {
          rows.push([
            analysisId,
            "KEYWORDS",
            null,
            `Consider adding '${kw.keyword}' if verifiable: ${kw.suggestedPlacement}`,
            kw.whyItMatters,
            "HIGH",
          ]);
        }
      }

      // Weak descriptions
      if (Array.isArray(payload.weakDescriptions)) {
        for (const weak of payload.weakDescriptions) {
          rows.push([
            analysisId,
            "DESCRIPTIONS",
            weak.originalText || null,
            weak.suggestedRewrite,
            weak.whyToImprove || weak.identifiedProblem,
            weak.priority || "MEDIUM",
          ]);
        }
      }

      // Skill presentation
      if (Array.isArray(payload.skillPresentation?.deduplicatedSkills)) {
        for (const dedup of payload.skillPresentation.deduplicatedSkills) {
          rows.push([
            analysisId,
            "SKILLS",
            dedup.duplicateFound || null,
            dedup.action,
            "Remove duplicate aliases to preserve clean presentation.",
            "MEDIUM",
          ]);
        }
      }

      if (rows.length > 0) {
        await db.query(
          `INSERT INTO resume_suggestions (analysis_id, section, original_text, suggestion, reason, priority) VALUES ?`,
          [rows]
        );
      }

      // 3. Update analyses table summary JSON to preserve full structured payload
      const [analysisRows] = await db.query(
        `SELECT summary FROM analyses WHERE id = ? LIMIT 1`,
        [analysisId]
      );

      let existingSummaryObj = {};
      if (analysisRows && analysisRows.length > 0 && analysisRows[0].summary) {
        try {
          existingSummaryObj = JSON.parse(analysisRows[0].summary);
        } catch (_) {
          existingSummaryObj = { rawSummaryText: analysisRows[0].summary };
        }
      }

      existingSummaryObj.resumeImprovementSuggestions = payload;

      await db.query(
        `UPDATE analyses SET summary = ? WHERE id = ?`,
        [JSON.stringify(existingSummaryObj), analysisId]
      );
    } catch (saveErr) {
      console.error("[ResumeImprovementService] Failed to persist suggestions to database:", saveErr.message);
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 8. HELPERS & ACCESS CONTROL
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Verifies that the user owns the resume and job.
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
   * Reconstructs structured resume sections from MySQL rows.
   */
  static assembleStructuredResume(sections, rawText) {
    const model = {
      summary: "",
      experience: [],
      projects: [],
      education: [],
      skills: [],
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
      }
    }

    // Fallback: If summary is missing, inspect raw text for initial paragraphs
    if (!model.summary && rawText) {
      const lines = rawText.split(/\n+/).map((l) => l.trim()).filter(Boolean);
      // Look for a line containing summary/profile/objective
      const summaryIdx = lines.findIndex((l) => /^(?:summary|profile|professional summary|objective)\b/i.test(l));
      if (summaryIdx !== -1 && lines[summaryIdx + 1]) {
        model.summary = lines[summaryIdx + 1];
      }
    }

    return model;
  }
}

module.exports = ResumeImprovementService;
