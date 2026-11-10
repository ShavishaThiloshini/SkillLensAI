/**
 * SkillLens AI — Report Generation Service
 * Day 31: AI Resume Skill Gap Report (PDF Generation & Preview)
 *
 * Gathers verified analysis data across all modules:
 * 1. Report Header & Metadata (branding, dates, role, candidate)
 * 2. Resume Summary (summary, skills, experience, projects, education)
 * 3. Target Role Requirements (required/preferred skills, experience, education)
 * 4. Overall Match Score & Category Breakdown (Day 21 backend formula)
 * 5. Matching Skills (Strong & Partial with evidence and badges)
 * 6. Missing Skills (Required & Preferred with priorities and rationale)
 * 7. Recommendations (Technical, Projects, Resume, Professional)
 * 8. Learning Roadmap (Day 26 ordered steps, exercises, mini-projects, progress status)
 *
 * Renders into an A4 multi-page PDF document using PdfDocumentBuilder.
 * Strictly adheres to security, user ownership, and factual integrity guardrails.
 */

const db = require("../config/db");
const PdfDocumentBuilder = require("../utils/pdfDocumentBuilder");
const SkillMatchingService = require("./skillMatchingService");
const MatchScoreService = require("./matchScoreService");

const REPORT_ALGORITHM_VERSION = "1.0";

class ReportGenerationService {
  /**
   * Retrieves and formats complete structured report data for an analysis.
   *
   * @param {number} analysisId
   * @param {number} userId
   * @returns {Promise<Object>}
   */
  static async getReportData(analysisId, userId) {
    if (!analysisId || !userId) {
      const err = new Error("Analysis ID and User ID are required.");
      err.status = 400;
      throw err;
    }

    const numAnalysisId = Number(analysisId);
    const numUserId = Number(userId);

    if (Number.isNaN(numAnalysisId) || Number.isNaN(numUserId) || numAnalysisId <= 0 || numUserId <= 0) {
      const err = new Error("Analysis ID and User ID must be valid positive integers.");
      err.status = 400;
      throw err;
    }

    // 1. Fetch analysis with ownership check
    const [analyses] = await db.query(
      `SELECT a.id, a.user_id, a.resume_id, a.job_id, a.overall_score, a.skill_score,
              a.experience_score, a.education_score, a.certification_score, a.summary,
              a.status, a.algorithm_version, a.created_at, a.completed_at
       FROM analyses a
       WHERE a.id = ? AND a.user_id = ?
       LIMIT 1`,
      [numAnalysisId, numUserId]
    );

    if (!analyses || analyses.length === 0) {
      const err = new Error("Analysis record not found or access denied.");
      err.status = 404;
      throw err;
    }

    const analysis = analyses[0];

    // 2. Fetch resume record & sections
    const [resumes] = await db.query(
      `SELECT id, user_id, original_filename, stored_filename, file_type, file_size, extracted_text, created_at
       FROM resumes
       WHERE id = ? AND user_id = ?
       LIMIT 1`,
      [analysis.resume_id, numUserId]
    );

    if (!resumes || resumes.length === 0) {
      const err = new Error("Associated resume record not found or access denied.");
      err.status = 404;
      throw err;
    }

    const resume = resumes[0];

    const [sections] = await db.query(
      `SELECT section_type, section_content, display_order
       FROM resume_sections
       WHERE resume_id = ?
       ORDER BY display_order ASC`,
      [analysis.resume_id]
    );

    // 3. Fetch job record & requirements
    const [jobs] = await db.query(
      `SELECT id, user_id, title, company, description, created_at
       FROM jobs
       WHERE id = ? AND user_id = ?
       LIMIT 1`,
      [analysis.job_id, numUserId]
    );

    if (!jobs || jobs.length === 0) {
      const err = new Error("Associated job description not found or access denied.");
      err.status = 404;
      throw err;
    }

    const job = jobs[0];

    const [jobRequirements] = await db.query(
      `SELECT requirement_type, requirement_text, priority
       FROM job_requirements
       WHERE job_id = ?`,
      [analysis.job_id]
    );

    // 4. Fetch resume skills & job skills
    const [candidateSkills] = await db.query(
      `SELECT s.id, s.name, s.category, rs.proficiency, rs.evidence
       FROM resume_skills rs
       JOIN skills s ON rs.skill_id = s.id
       WHERE rs.resume_id = ?`,
      [analysis.resume_id]
    );

    const [jobSkills] = await db.query(
      `SELECT s.id, s.name, s.category, js.priority, js.required, js.evidence
       FROM job_skills js
       JOIN skills s ON js.skill_id = s.id
       WHERE js.job_id = ?`,
      [analysis.job_id]
    );

    // 5. Fetch skill matches from database (Day 20 matching)
    let [skillMatches] = await db.query(
      `SELECT sm.id, sm.skill_id, s.name AS job_skill_name, s.category AS skill_category,
              sm.status, sm.requirement_type, sm.match_score, sm.priority, sm.explanation, sm.evidence
       FROM skill_matches sm
       JOIN skills s ON sm.skill_id = s.id
       WHERE sm.analysis_id = ?`,
      [numAnalysisId]
    );

    // Fallback if skill_matches table row wasn't pre-populated for this analysis
    if (!skillMatches || skillMatches.length === 0) {
      const computedMatches = SkillMatchingService.compareSkillSets(candidateSkills, jobSkills);
      skillMatches = (computedMatches.results || []).map((m) => ({
        job_skill_name: m.jobSkill,
        skill_category: m.skillCategory,
        status: m.category,
        requirement_type: m.requirementType,
        priority: m.priority,
        explanation: m.explanation,
        evidence: Array.isArray(m.resumeEvidence) ? m.resumeEvidence.join("; ") : m.resumeEvidence,
      }));
    }

    // 6. Fetch roadmap items (Day 26 roadmap)
    const [roadmapRows] = await db.query(
      `SELECT r.id, r.title, r.description, r.step_order, r.difficulty, r.status, r.estimated_duration, s.name AS skill_name
       FROM roadmap_items r
       LEFT JOIN skills s ON r.skill_id = s.id
       WHERE r.analysis_id = ?
       ORDER BY r.step_order ASC`,
      [numAnalysisId]
    );

    // 7. Parse structured analysis summary JSON (contains AI analysis, Day 29 suggestions, Day 30 career insights)
    let parsedSummary = {};
    if (analysis.summary) {
      try {
        parsedSummary = JSON.parse(analysis.summary);
      } catch (_) {
        parsedSummary = { rawSummary: analysis.summary };
      }
    }

    // 8. Assemble structured models
    const structuredResume = this.assembleStructuredResume(sections, resume.extracted_text || "");

    // Separate matching skills & missing skills
    const strongMatches = [];
    const partialMatches = [];
    const missingRequired = [];
    const missingPreferred = [];

    for (const sm of skillMatches) {
      const item = {
        name: sm.job_skill_name || sm.name,
        category: sm.skill_category || "TECHNICAL",
        requirementType: sm.requirement_type || "REQUIRED",
        priority: sm.priority || "MEDIUM",
        evidence: sm.evidence || "",
        explanation: sm.explanation || "",
      };

      if (sm.status === "STRONG_MATCH") {
        strongMatches.push(item);
      } else if (sm.status === "PARTIAL_MATCH") {
        partialMatches.push(item);
      } else if (sm.requirement_type === "REQUIRED") {
        missingRequired.push(item);
      } else {
        missingPreferred.push(item);
      }
    }

    // Recommendations aggregation (Day 28 recommendations, Day 29 resume, Day 30 career insights)
    const recommendations = this.compileRecommendations(parsedSummary, missingRequired, partialMatches);

    // Formatted score object
    const matchScores = {
      overall: analysis.overall_score !== null ? Number(analysis.overall_score) : null,
      skills: analysis.skill_score !== null ? Number(analysis.skill_score) : null,
      experience: analysis.experience_score !== null ? Number(analysis.experience_score) : null,
      education: analysis.education_score !== null ? Number(analysis.education_score) : null,
      certifications: analysis.certification_score !== null ? Number(analysis.certification_score) : null,
      scores: {
        skills: {
          score: analysis.skill_score !== null ? Number(analysis.skill_score) : null,
          weight: "50%",
          status: analysis.skill_score !== null ? "AVAILABLE" : "NOT_APPLICABLE",
        },
        experience: {
          score: analysis.experience_score !== null ? Number(analysis.experience_score) : null,
          weight: "25%",
          status: analysis.experience_score !== null ? "AVAILABLE" : "NOT_APPLICABLE",
        },
        education: {
          score: analysis.education_score !== null ? Number(analysis.education_score) : null,
          weight: "15%",
          status: analysis.education_score !== null ? "AVAILABLE" : "NOT_APPLICABLE",
        },
        certifications: {
          score: analysis.certification_score !== null ? Number(analysis.certification_score) : null,
          weight: "10%",
          status: analysis.certification_score !== null ? "AVAILABLE" : "NOT_APPLICABLE",
        },
      },
      explanation: "Calculated using the verified Day 21 scoring algorithm (50% Skills, 25% Experience, 15% Education, 10% Certifications).",
    };

    const expReq = (jobRequirements || []).find((r) => r.requirement_type === "EXPERIENCE");
    let expYears = 5;
    if (expReq && expReq.requirement_text) {
      const match = expReq.requirement_text.match(/(\d+)/);
      if (match) expYears = parseInt(match[1], 10);
    }

    const resumeObj = {
      id: resume.id,
      filename: resume.original_filename,
      candidateName: structuredResume.personalInfo?.name || structuredResume.candidateName || "Candidate",
      summary: structuredResume.summary || "No professional summary provided in resume.",
      professionalSummary: structuredResume.summary || "No professional summary provided in resume.",
      skills: candidateSkills.map((s) => s.name),
      experience: structuredResume.experience || [],
      projects: structuredResume.projects || [],
      education: structuredResume.education || [],
      certifications: structuredResume.certifications || [],
    };

    const jobObj = {
      id: job.id,
      title: job.title,
      jobTitle: job.title,
      company: job.company || "Not specified",
      description: job.description || "",
      requiredSkills: jobSkills.filter((s) => s.required).map((s) => s.name),
      preferredSkills: jobSkills.filter((s) => !s.required).map((s) => s.name),
      requiredYears: expYears,
      requirements: jobRequirements || [],
    };

    const headerObj = {
      title: "AI Resume Skill Gap Report",
      branding: "SkillLens AI",
      reportGenerationDate: new Date().toISOString(),
      analysisDate: analysis.completed_at || analysis.created_at,
      targetJob: job.title,
      company: job.company || "Not specified",
      resumeName: resume.original_filename,
    };

    const matchingSkillsObj = {
      strong: strongMatches,
      partial: partialMatches,
      strongMatches: strongMatches.map((m) => ({
        ...m,
        jobSkill: m.name,
        matchedSkill: m.name,
        evidence: Array.isArray(m.evidence) ? m.evidence : [m.evidence].filter(Boolean),
      })),
      partialMatches: partialMatches.map((m) => ({
        ...m,
        jobSkill: m.name,
        matchedSkill: m.name,
        evidence: Array.isArray(m.evidence) ? m.evidence : [m.evidence].filter(Boolean),
      })),
      totalMatchedCount: strongMatches.length + partialMatches.length,
    };

    const missingSkillsObj = {
      required: missingRequired,
      preferred: missingPreferred,
      requiredGaps: missingRequired.map((m) => ({ ...m, jobSkill: m.name })),
      preferredGaps: missingPreferred.map((m) => ({ ...m, jobSkill: m.name })),
      totalMissingCount: missingRequired.length + missingPreferred.length,
      note: "Note: An item missing from the resume does not guarantee lack of competence; it may simply be omitted or phrased differently.",
    };

    const roadmapObj = {
      steps: roadmapRows.map((r) => ({
        id: r.id,
        stepOrder: r.step_order,
        title: r.title,
        skillName: r.skill_name || "",
        description: r.description,
        difficulty: r.difficulty || "INTERMEDIATE",
        status: r.status || "NOT_STARTED",
        estimatedDuration: r.estimated_duration || "1-2 weeks",
        exercises: r.exercises ? (typeof r.exercises === "string" ? JSON.parse(r.exercises) : r.exercises) : [],
        project: r.project || "",
      })),
      totalSteps: roadmapRows.length,
    };

    return {
      analysisId: numAnalysisId,
      analysisDate: analysis.completed_at || analysis.created_at,
      reportGenerationDate: new Date().toISOString(),
      header: headerObj,
      resumeSummary: resumeObj,
      targetRole: jobObj,
      matchScore: matchScores,
      resume: resumeObj,
      job: jobObj,
      scores: matchScores,
      matchingSkills: matchingSkillsObj,
      missingSkills: missingSkillsObj,
      recommendations,
      roadmap: roadmapObj,
      algorithmVersion: analysis.algorithm_version || REPORT_ALGORITHM_VERSION,
    };
  }

  /**
   * Generates a complete, multi-page PDF binary buffer for the selected analysis.
   *
   * @param {number} analysisId
   * @param {number} userId
   * @returns {Promise<{ buffer: Buffer, filename: string, reportData: Object }>}
   */
  static async generatePdfReport(analysisId, userId) {
    const reportData = await this.getReportData(analysisId, userId);

    const doc = new PdfDocumentBuilder({
      headerTitle: `SkillLens AI — AI Resume Skill Gap Report | ${reportData.job.title}`,
      footerText: "SkillLens AI — Confidential Automated Skill Gap Report",
    });

    const cWidth = doc.contentWidth;
    const mLeft = doc.marginLeft;

    // ── 1. REPORT HEADER BANNER ───────────────────────────────────────────────
    // Dark Navy Header Box
    doc.drawRect(mLeft, doc.currentY - 42, cWidth, 54, {
      fill: [0.06, 0.09, 0.16], // #0f172a
    });

    // Branding & Title
    doc.drawRawText("SKILLLENS AI", mLeft + 14, doc.currentY + 2, {
      font: "Helvetica-Bold",
      fontSize: 10,
      color: [0.65, 0.70, 0.95], // Light indigo accent
    });
    doc.drawRawText("AI Resume Skill Gap Report", mLeft + 14, doc.currentY - 14, {
      font: "Helvetica-Bold",
      fontSize: 15,
      color: [1.0, 1.0, 1.0], // White
    });
    doc.drawRawText(
      `Generated: ${new Date(reportData.reportGenerationDate).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}`,
      doc.pageWidth - doc.marginRight - 120,
      doc.currentY - 14,
      {
        font: "Helvetica",
        fontSize: 8,
        color: [0.75, 0.80, 0.88],
      }
    );

    doc.currentY -= 54;

    // Sub-header Metadata Bar
    doc.drawRect(mLeft, doc.currentY - 14, cWidth, 22, {
      fill: [0.94, 0.95, 0.98], // Slate surface
      stroke: [0.85, 0.88, 0.92],
      lineWidth: 0.5,
    });

    const candidateLabel = reportData.resume.candidateName ? `Candidate: ${reportData.resume.candidateName}  |  ` : "";
    const metaString = `${candidateLabel}Resume: ${reportData.resume.filename}  |  Target Role: ${reportData.job.title} (${reportData.job.company})`;
    doc.drawRawText(metaString, mLeft + 10, doc.currentY - 8, {
      font: "Helvetica-Bold",
      fontSize: 8.5,
      color: [0.2, 0.25, 0.35],
    });

    doc.currentY -= 26;

    // ── 2. OVERALL MATCH SCORE SECTION ────────────────────────────────────────
    doc.drawSectionHeader("1. Overall Match Score & Score Breakdown", {
      accentColor: [0.31, 0.27, 0.90],
    });

    // Score KPI Cards Grid (4 mini boxes)
    const overallScore = reportData.scores.overall !== null ? `${Math.round(reportData.scores.overall)}%` : "N/A";
    const skillsScore = reportData.scores.skills !== null ? `${Math.round(reportData.scores.skills)}%` : "N/A";
    const expScore = reportData.scores.experience !== null ? `${Math.round(reportData.scores.experience)}%` : "N/A";
    const eduScore = reportData.scores.education !== null ? `${Math.round(reportData.scores.education)}%` : "N/A";

    const boxW = (cWidth - 18) / 4;
    const boxH = 42;
    const cardY = doc.currentY - boxH + 8;

    const scoreMetrics = [
      { label: "Overall Match", val: overallScore, color: [0.31, 0.27, 0.90] },
      { label: "Skills Score (50%)", val: skillsScore, color: [0.06, 0.65, 0.40] },
      { label: "Experience (25%)", val: expScore, color: [0.85, 0.45, 0.05] },
      { label: "Education (15%)", val: eduScore, color: [0.25, 0.45, 0.85] },
    ];

    for (let i = 0; i < scoreMetrics.length; i++) {
      const bx = mLeft + i * (boxW + 6);
      const m = scoreMetrics[i];

      doc.drawRect(bx, cardY, boxW, boxH, {
        fill: [0.98, 0.99, 1.0],
        stroke: [0.85, 0.88, 0.92],
        lineWidth: 0.5,
      });

      doc.drawRawText(m.label, bx + 8, cardY + 28, {
        font: "Helvetica",
        fontSize: 7.5,
        color: [0.45, 0.50, 0.60],
      });
      doc.drawRawText(m.val, bx + 8, cardY + 10, {
        font: "Helvetica-Bold",
        fontSize: 16,
        color: m.color,
      });
    }

    doc.currentY -= (boxH + 6);

    doc.drawParagraph(reportData.scores.explanation, {
      fontSize: 8,
      color: [0.45, 0.50, 0.60],
      lineHeight: 11,
      extraSpacing: 6,
    });

    // ── 3. RESUME SUMMARY ─────────────────────────────────────────────────────
    doc.drawSectionHeader("2. Candidate Resume Summary", {
      accentColor: [0.06, 0.65, 0.40],
    });

    if (reportData.resume.candidateName) {
      doc.drawKeyValue("Candidate Name:", reportData.resume.candidateName);
    }
    doc.drawKeyValue("Professional Summary:", reportData.resume.summary);

    if (reportData.resume.skills.length > 0) {
      const skillsStr = reportData.resume.skills.slice(0, 16).join(", ");
      doc.drawKeyValue("Extracted Skills:", skillsStr);
    }

    if (reportData.resume.experience.length > 0) {
      const expItems = reportData.resume.experience
        .slice(0, 2)
        .map((e) => `${e.role || e.title || "Developer"} at ${e.company || "Organization"} (${e.duration || "N/A"})`)
        .join("  |  ");
      doc.drawKeyValue("Experience:", expItems);
    }

    if (reportData.resume.projects.length > 0) {
      const projItems = reportData.resume.projects
        .slice(0, 2)
        .map((p) => `${p.name || "Project"}: ${p.description || "Technical project"}`)
        .join("  |  ");
      doc.drawKeyValue("Key Projects:", projItems);
    }

    if (reportData.resume.education.length > 0) {
      const eduItems = reportData.resume.education
        .slice(0, 2)
        .map((ed) => `${ed.degree || "Degree"} - ${ed.institution || ed.school || "Institution"}`)
        .join("  |  ");
      doc.drawKeyValue("Education:", eduItems);
    }

    doc.currentY -= 6;

    // ── 4. TARGET ROLE SPECIFICATIONS ─────────────────────────────────────────
    doc.drawSectionHeader("3. Target Role Specifications", {
      accentColor: [0.85, 0.45, 0.05],
    });

    doc.drawKeyValue("Target Job Title:", reportData.job.title);
    doc.drawKeyValue("Hiring Organization:", reportData.job.company);

    if (reportData.job.requiredSkills.length > 0) {
      doc.drawKeyValue("Required Skills:", reportData.job.requiredSkills.join(", "));
    }
    if (reportData.job.preferredSkills.length > 0) {
      doc.drawKeyValue("Preferred Skills:", reportData.job.preferredSkills.join(", "));
    }

    doc.currentY -= 6;

    // ── 5. MATCHING SKILLS SECTION ────────────────────────────────────────────
    doc.drawSectionHeader("4. Matching Skills (Evidence-Validated)", {
      accentColor: [0.06, 0.65, 0.40],
    });

    const allMatches = [
      ...reportData.matchingSkills.strong.map((s) => ({ ...s, matchType: "STRONG MATCH" })),
      ...reportData.matchingSkills.partial.map((s) => ({ ...s, matchType: "PARTIAL MATCH" })),
    ];

    if (allMatches.length === 0) {
      doc.drawParagraph("No direct matching skills were identified in the saved analysis.", {
        fontSize: 9,
        color: [0.5, 0.55, 0.65],
      });
    } else {
      for (const m of allMatches.slice(0, 6)) {
        doc.checkPageBreak(28);

        // Badge on left
        const isStrong = m.matchType === "STRONG MATCH";
        const badgeBg = isStrong ? [0.88, 0.97, 0.92] : [0.99, 0.95, 0.88];
        const badgeTextCol = isStrong ? [0.06, 0.50, 0.30] : [0.75, 0.40, 0.05];

        doc.drawBadge(m.matchType, mLeft, doc.currentY - 2, {
          bg: badgeBg,
          textColor: badgeTextCol,
          fontSize: 7.5,
        });

        // Skill name
        doc.drawRawText(m.name, mLeft + 85, doc.currentY + 1, {
          font: "Helvetica-Bold",
          fontSize: 9.5,
          color: [0.1, 0.15, 0.25],
        });

        // Requirement pill
        doc.drawBadge(m.requirementType, mLeft + 220, doc.currentY - 2, {
          bg: [0.93, 0.94, 0.97],
          textColor: [0.35, 0.40, 0.50],
          fontSize: 7,
        });

        doc.currentY -= 14;

        // Evidence line
        const evidenceStr = m.evidence ? `Evidence: ${m.evidence}` : m.explanation;
        if (evidenceStr) {
          doc.drawParagraph(evidenceStr, {
            x: mLeft + 15,
            fontSize: 8,
            color: [0.45, 0.50, 0.60],
            lineHeight: 11,
          });
        }
        doc.currentY -= 4;
      }
    }

    doc.currentY -= 4;

    // ── 6. MISSING SKILLS & GAPS SECTION ──────────────────────────────────────
    doc.drawSectionHeader("5. Identified Skill Gaps (To Develop)", {
      accentColor: [0.90, 0.20, 0.25], // Rose red
    });

    const allGaps = [
      ...reportData.missingSkills.required.map((g) => ({ ...g, reqType: "REQUIRED" })),
      ...reportData.missingSkills.preferred.map((g) => ({ ...g, reqType: "PREFERRED" })),
    ];

    if (allGaps.length === 0) {
      doc.drawParagraph("Zero skill gaps identified! The candidate's resume covers all target job requirements.", {
        fontSize: 9,
        color: [0.06, 0.65, 0.40],
      });
    } else {
      for (const g of allGaps.slice(0, 6)) {
        doc.checkPageBreak(28);

        const isReq = g.reqType === "REQUIRED";
        doc.drawBadge(isReq ? "REQUIRED GAP" : "PREFERRED GAP", mLeft, doc.currentY - 2, {
          bg: isReq ? [0.99, 0.90, 0.92] : [0.95, 0.95, 0.97],
          textColor: isReq ? [0.80, 0.15, 0.20] : [0.40, 0.45, 0.55],
          fontSize: 7.5,
        });

        doc.drawRawText(g.name, mLeft + 95, doc.currentY + 1, {
          font: "Helvetica-Bold",
          fontSize: 9.5,
          color: [0.1, 0.15, 0.25],
        });

        doc.drawBadge(`PRIORITY: ${g.priority || "MEDIUM"}`, mLeft + 240, doc.currentY - 2, {
          bg: [0.98, 0.94, 0.88],
          textColor: [0.75, 0.40, 0.05],
          fontSize: 7,
        });

        doc.currentY -= 14;

        const explanationText = g.explanation || `Core competency sought for ${reportData.job.title} positions.`;
        doc.drawParagraph(explanationText, {
          x: mLeft + 15,
          fontSize: 8,
          color: [0.45, 0.50, 0.60],
          lineHeight: 11,
        });
        doc.currentY -= 4;
      }
    }

    doc.drawParagraph(
      "Note: Missing resume keywords do not imply lack of ability; they denote areas not demonstrated in the uploaded document.",
      {
        fontSize: 7.5,
        color: [0.55, 0.60, 0.70],
        extraSpacing: 4,
      }
    );

    // ── 7. PRACTICAL RECOMMENDATIONS ──────────────────────────────────────────
    doc.drawSectionHeader("6. Personalized Actionable Recommendations", {
      accentColor: [0.31, 0.27, 0.90],
    });

    const recCategories = [
      { key: "technical", title: "A. Technical Development", items: reportData.recommendations.technical },
      { key: "projects", title: "B. Project Development", items: reportData.recommendations.projects },
      { key: "resume", title: "C. Resume Presentation", items: reportData.recommendations.resume },
    ];

    for (const cat of recCategories) {
      if (cat.items && cat.items.length > 0) {
        doc.checkPageBreak(25);
        doc.drawRawText(cat.title, mLeft, doc.currentY, {
          font: "Helvetica-Bold",
          fontSize: 9,
          color: [0.2, 0.25, 0.35],
        });
        doc.currentY -= 12;

        for (const item of cat.items.slice(0, 2)) {
          doc.checkPageBreak(22);
          doc.drawRawText(`• ${item.title}`, mLeft + 8, doc.currentY, {
            font: "Helvetica-Bold",
            fontSize: 8.5,
            color: [0.15, 0.18, 0.24],
          });
          doc.currentY -= 11;
          doc.drawParagraph(item.explanation, {
            x: mLeft + 16,
            fontSize: 8,
            color: [0.4, 0.45, 0.55],
            lineHeight: 11,
            extraSpacing: 3,
          });
        }
      }
    }

    doc.currentY -= 4;

    // ── 8. LEARNING ROADMAP ───────────────────────────────────────────────────
    doc.drawSectionHeader("7. Priority Learning Roadmap", {
      accentColor: [0.06, 0.65, 0.40],
    });

    const roadmapSteps = Array.isArray(reportData.roadmap)
      ? reportData.roadmap
      : (reportData.roadmap?.steps || []);

    if (roadmapSteps.length === 0) {
      doc.drawParagraph("No pending roadmap steps. Candidate satisfies core requirements for the target role.", {
        fontSize: 9,
        color: [0.45, 0.50, 0.60],
      });
    } else {
      for (const step of roadmapSteps.slice(0, 5)) {
        doc.checkPageBreak(30);

        // Step number badge
        doc.drawBadge(`STEP ${step.stepOrder}`, mLeft, doc.currentY - 2, {
          bg: [0.93, 0.95, 0.99],
          textColor: [0.25, 0.35, 0.85],
          fontSize: 7.5,
        });

        doc.drawRawText(step.title, mLeft + 65, doc.currentY + 1, {
          font: "Helvetica-Bold",
          fontSize: 9.5,
          color: [0.1, 0.15, 0.25],
        });

        doc.drawBadge(step.difficulty, mLeft + 250, doc.currentY - 2, {
          bg: [0.95, 0.95, 0.97],
          textColor: [0.45, 0.50, 0.60],
          fontSize: 7,
        });

        doc.drawBadge(step.status.replace("_", " "), mLeft + 335, doc.currentY - 2, {
          bg: step.status === "COMPLETED" ? [0.88, 0.97, 0.92] : [0.98, 0.95, 0.88],
          textColor: step.status === "COMPLETED" ? [0.06, 0.50, 0.30] : [0.75, 0.40, 0.05],
          fontSize: 7,
        });

        doc.currentY -= 14;

        doc.drawParagraph(step.description, {
          x: mLeft + 15,
          fontSize: 8,
          color: [0.45, 0.50, 0.60],
          lineHeight: 11,
        });
        doc.currentY -= 4;
      }
    }

    // Compile into PDF Buffer
    const buffer = doc.toBuffer();
    const safeJobTitle = reportData.job.title.replace(/[^a-zA-Z0-9_-]/g, "_");
    const filename = `SkillLens_AI_Skill_Gap_Report_${safeJobTitle}_Analysis_${analysisId}.pdf`;

    return {
      buffer,
      filename,
      contentType: "application/pdf",
      reportData,
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // HELPERS
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Reassembles structured resume sections from MySQL rows.
   */
  static assembleStructuredResume(sections, rawText) {
    const model = {
      personalInfo: null,
      summary: "",
      experience: [],
      projects: [],
      education: [],
      certifications: [],
    };

    for (const sec of sections) {
      const type = sec.section_type;
      const content = sec.section_content;

      if (type === "PERSONAL_INFO" || type === "CONTACT") {
        try {
          const parsed = typeof content === "string" ? JSON.parse(content) : content;
          model.personalInfo = parsed;
        } catch (_) {
          model.personalInfo = { name: content };
        }
      } else if (type === "SUMMARY") {
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

    if (!model.personalInfo?.name && rawText) {
      const firstLine = rawText.split("\n").map((l) => l.trim()).find((l) => l && l.length < 50 && !l.includes(":"));
      if (firstLine) {
        model.personalInfo = { ...(model.personalInfo || {}), name: firstLine };
      }
    }

    return model;
  }

  /**
   * Compiles multi-module recommendations into structured technical, project, and resume lists.
   */
  static compileRecommendations(parsedSummary, missingRequired, partialMatches) {
    const recs = {
      technical: [],
      projects: [],
      resume: [],
      professional: [],
    };

    // 1. From Career Insights (Day 30)
    if (parsedSummary.careerInsights?.careerImprovements) {
      const ci = parsedSummary.careerInsights.careerImprovements;
      if (Array.isArray(ci.technical)) recs.technical.push(...ci.technical);
      if (Array.isArray(ci.projects)) recs.projects.push(...ci.projects);
      if (Array.isArray(ci.resume)) recs.resume.push(...ci.resume);
      if (Array.isArray(ci.professional)) recs.professional.push(...ci.professional);
    }

    // 2. From Day 22 AI Analysis improvement suggestions
    if (Array.isArray(parsedSummary.improvementSuggestions)) {
      for (const item of parsedSummary.improvementSuggestions) {
        const area = (item.area || "").toLowerCase();
        const obj = { title: `${item.area || "Area"} Improvement`, explanation: item.suggestion, priority: "MEDIUM" };
        if (area.includes("tech") || area.includes("skill")) recs.technical.push(obj);
        else if (area.includes("proj")) recs.projects.push(obj);
        else if (area.includes("resume") || area.includes("format")) recs.resume.push(obj);
        else recs.professional.push(obj);
      }
    }

    // 3. From Resume Improvements (Day 29)
    if (parsedSummary.resumeImprovementSuggestions) {
      const ri = parsedSummary.resumeImprovementSuggestions;
      if (ri.summary && recs.resume.length === 0) {
        recs.resume.push({
          title: "Refine Executive Professional Summary",
          explanation: ri.summary.reason || "Align summary with target role requirements.",
          priority: ri.summary.priority || "HIGH",
        });
      }
      if (Array.isArray(ri.projects) && ri.projects.length > 0 && recs.projects.length === 0) {
        recs.projects.push({
          title: "Quantify Outcomes in Project Descriptions",
          explanation: "Incorporate action verbs and measurable performance metrics in project bullet points.",
          priority: "HIGH",
        });
      }
    }

    // 4. Fallback from missing required skills
    if (recs.technical.length === 0 && missingRequired.length > 0) {
      const topGap = missingRequired[0].name;
      recs.technical.push({
        title: `Master ${topGap} Fundamentals`,
        explanation: `${topGap} is a core requirement for this position. Completing a 2-week hands-on learning cycle addresses your most critical skill gap.`,
        priority: "HIGH",
      });
    }

    // 5. Default baseline items if still empty
    if (recs.technical.length === 0) {
      recs.technical.push({
        title: "Reinforce Core Technical Stack",
        explanation: "Deepen understanding of advanced patterns and ecosystem libraries in your primary programming languages.",
        priority: "MEDIUM",
      });
    }
    if (recs.projects.length === 0) {
      recs.projects.push({
        title: "Build and Deploy an End-to-End Application",
        explanation: "Create a public GitHub project demonstrating database persistence, API design, and automated testing.",
        priority: "MEDIUM",
      });
    }
    if (recs.resume.length === 0) {
      recs.resume.push({
        title: "Tailor Resume Keywords to Target Position",
        explanation: "Organize technical skills into distinct categories (Languages, Frameworks, Databases) and prioritize matching skills first.",
        priority: "MEDIUM",
      });
    }
    if (recs.professional.length === 0) {
      recs.professional.push({
        title: "Target Domain Networking & Contribution",
        explanation: "Engage with professional developer communities and contribute to relevant open-source libraries.",
        priority: "MEDIUM",
      });
    }

    return recs;
  }
}

module.exports = ReportGenerationService;
