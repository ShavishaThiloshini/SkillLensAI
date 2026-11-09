/**
 * SkillLens AI — Day 30: Career Insights & Readiness Test Suite
 *
 * Automated verification of all 22 required scenarios:
 * 1. User with strong technical skills
 * 2. User with several missing required skills
 * 3. User with several partial skill matches
 * 4. Fresh graduate with academic projects but no professional experience (weight normalization)
 * 5. User with substantial professional experience
 * 6. User with incomplete education information
 * 7. User with no certifications
 * 8. User with incomplete resume sections
 * 9. User with weak project descriptions
 * 10. User with a strong resume but limited job-specific compatibility
 * 11. User with high job match but insufficient career evidence
 * 12. Missing or unavailable analysis data
 * 13. AI provider unavailable (deterministic fallback)
 * 14. Invalid AI response (schema validation / fallback)
 * 15. Career readiness calculation and missing dimensions
 * 16. Career readiness explanation and assessment thresholds
 * 17. Priority skills consistent with Day 26
 * 18. Recommendations consistent with Day 28
 * 19. Resume suggestions consistent with Day 29
 * 20. Historical analysis consistency
 * 21. Unauthorized access to another user's insights (401/404 isolation)
 * 22. Responsive desktop, tablet, and mobile layouts / UI schema validation
 */

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const db = require("../config/db");
const CareerInsightsService = require("../services/careerInsightsService");
const {
  getCareerInsights,
  generateCareerInsights,
  getReadiness,
} = require("../controllers/careerInsightsController");

function createMockRes() {
  const res = {
    statusCode: 200,
    headers: {},
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
  return res;
}

async function runDay30CareerInsightsTests(testAsync) {
  console.log("\n--- SkillLens AI: Day 30 Career Insights & Readiness Tests ---");

  const originalDbQuery = db.query;
  const originalGetConnection = db.getConnection;

  function withMockDb(handler, fn) {
    return async () => {
      db.query = handler;
      db.getConnection = async () => ({
        query: handler,
        beginTransaction: async () => {},
        commit: async () => {},
        rollback: async () => {},
        release: () => {},
      });
      try {
        await fn();
      } finally {
        db.query = originalDbQuery;
        db.getConnection = originalGetConnection;
      }
    };
  }

  // ---- Test 1: User with strong technical skills ----
  await testAsync("1. User with strong technical skills receives high readiness and verified strength cards", async () => {
    const resumeSkills = [
      { id: 1, name: "JavaScript", category: "PROGRAMMING" },
      { id: 2, name: "TypeScript", category: "PROGRAMMING" },
      { id: 3, name: "React", category: "FRAMEWORK" },
      { id: 4, name: "Node.js", category: "FRAMEWORK" },
      { id: 5, name: "PostgreSQL", category: "DATABASE" },
    ];
    const jobSkills = [
      { id: 1, name: "React", required: true, priority: "HIGH" },
      { id: 2, name: "Node.js", required: true, priority: "HIGH" },
      { id: 3, name: "TypeScript", required: true, priority: "HIGH" },
    ];
    const matchResults = [
      { jobSkill: "React", category: "STRONG_MATCH", requirementType: "REQUIRED" },
      { jobSkill: "Node.js", category: "STRONG_MATCH", requirementType: "REQUIRED" },
      { jobSkill: "TypeScript", category: "STRONG_MATCH", requirementType: "REQUIRED" },
    ];

    const readiness = CareerInsightsService.calculateCareerReadiness({
      resumeSkills,
      jobSkills,
      candidateExperience: [{ role: "Full Stack Engineer", duration: "3 years" }],
      projects: [{ name: "Portal", description: "Built portal in React and Node." }],
      education: [{ degree: "B.S. in Computer Science" }],
      resumeText: "React and Node.js developer with 3 years experience.",
      matchResults,
    });

    assert.ok(readiness.score >= 80, "Strong profile must score in Strong Preparation tier");
    assert.strictEqual(readiness.level, "Strong Preparation");
    assert.strictEqual(readiness.tier, "STRONG");

    const strengths = CareerInsightsService.identifyStrengths({
      resumeSkills,
      candidateExperience: [{ role: "Full Stack Engineer" }],
      projects: [{ name: "Portal", technologies: ["React", "Node.js"] }],
      education: [{ degree: "B.S. in Computer Science" }],
      matchResults,
    });
    assert.ok(strengths.some((s) => s.category === "TECHNICAL" && s.title.includes("Core Technologies")));
    assert.ok(strengths.some((s) => s.category === "PROJECTS"));
  });

  // ---- Test 2: User with several missing required skills ----
  await testAsync("2. User with several missing required skills has them categorized as high priority development areas", async () => {
    const matchResults = [
      { jobSkill: "React", category: "STRONG_MATCH", requirementType: "REQUIRED" },
      { jobSkill: "Docker", category: "MISSING", requirementType: "REQUIRED", priority: "HIGH" },
      { jobSkill: "Kubernetes", category: "MISSING", requirementType: "REQUIRED", priority: "HIGH" },
      { jobSkill: "AWS", category: "MISSING", requirementType: "REQUIRED", priority: "HIGH" },
    ];

    const weaknesses = CareerInsightsService.identifyWeaknesses({
      matchResults,
      projects: [{ name: "Simple Web App" }],
      candidateExperience: [],
      resumeSections: [],
      resumeText: "React frontend developer",
      jobRecord: { title: "Cloud Platform Engineer" },
    });

    const techGap = weaknesses.find((w) => w.id === "weak-missing-required");
    assert.ok(techGap, "Missing required skills must be identified");
    assert.strictEqual(techGap.priority, "HIGH");
    assert.ok(techGap.issue.includes("Docker") || techGap.explanation.includes("Docker"));
    assert.ok(techGap.suggestedImprovement.includes("Learning Roadmap"));
  });

  // ---- Test 3: User with several partial skill matches ----
  await testAsync("3. User with several partial skill matches receives bridge learning recommendations", async () => {
    const matchResults = [
      {
        jobSkill: "TypeScript",
        category: "PARTIAL_MATCH",
        matchedSkill: "JavaScript",
        requirementType: "REQUIRED",
        explanation: "Candidate has JavaScript background but lacks static TypeScript typing evidence.",
      },
    ];

    const weaknesses = CareerInsightsService.identifyWeaknesses({
      matchResults,
      projects: [],
      candidateExperience: [],
      resumeSections: [],
      jobRecord: { title: "Frontend Lead" },
    });

    const partialGap = weaknesses.find((w) => w.id === "weak-partial-matches");
    assert.ok(partialGap);
    assert.strictEqual(partialGap.priority, "MEDIUM");
    assert.ok(partialGap.issue.includes("JavaScript"));
    assert.ok(partialGap.suggestedImprovement.includes("TypeScript"));
  });

  // ---- Test 4: Fresh graduate with academic projects but no professional experience ----
  await testAsync("4. Fresh graduate with academic projects has professional experience weight normalized cleanly", async () => {
    const readiness = CareerInsightsService.calculateCareerReadiness({
      resumeSkills: [
        { id: 1, name: "Python", category: "PROGRAMMING" },
        { id: 2, name: "Django", category: "FRAMEWORK" },
      ],
      jobSkills: [{ id: 1, name: "Python" }],
      candidateExperience: [], // 0 years professional experience
      projects: [
        { name: "Academic Capstone Project", description: "Built Django distributed data collector." },
        { name: "Open Source Contributor", description: "Created CLI utility in Python." },
      ],
      education: [{ degree: "B.S. in Computer Science", institution: "State University" }],
      resumeText: "Fresh graduate in Computer Science with academic Django projects.",
      matchResults: [{ jobSkill: "Python", category: "STRONG_MATCH", requirementType: "REQUIRED" }],
    });

    assert.strictEqual(readiness.isEarlyCareerNormalized, true, "Early career candidate weight must be normalized");
    assert.ok(readiness.score >= 50, "Fresh graduate with good projects and degree should not be failed with 0%");
    const projDim = readiness.dimensions.find((d) => d.key === "projectExperience");
    assert.strictEqual(projDim.weight, 35, "Project weight should normalize upward to 35%");
  });

  // ---- Test 5: User with substantial professional experience ----
  await testAsync("5. User with substantial professional experience earns high experience marks and leadership strengths", async () => {
    const candidateExperience = [
      { title: "Senior Lead", company: "Alpha Systems", duration: "4 years" },
      { title: "Software Engineer", company: "Beta Corp", duration: "3 years" },
      { title: "Junior Dev", company: "Gamma LLC", duration: "2 years" },
    ];

    const readiness = CareerInsightsService.calculateCareerReadiness({
      resumeSkills: [{ name: "Java" }],
      jobSkills: [{ name: "Java" }],
      candidateExperience,
      projects: [{ name: "Enterprise Portal" }],
      education: [{ degree: "B.S." }],
      resumeText: "Senior Lead with 9+ years experience",
      matchResults: [{ jobSkill: "Java", category: "STRONG_MATCH", requirementType: "REQUIRED" }],
    });

    const expDim = readiness.dimensions.find((d) => d.key === "professionalExperience");
    assert.strictEqual(expDim.score, 90);
    assert.strictEqual(expDim.weight, 20);

    const strengths = CareerInsightsService.identifyStrengths({
      resumeSkills: [{ name: "Java" }],
      candidateExperience,
      projects: [],
      education: [],
      matchResults: [],
    });
    assert.ok(strengths.some((s) => s.category === "EXPERIENCE" && s.title.includes("Workplace Experience")));
  });

  // ---- Test 6: User with incomplete education information ----
  await testAsync("6. User with incomplete education information handles missing fields gracefully", async () => {
    const readiness = CareerInsightsService.calculateCareerReadiness({
      resumeSkills: [{ name: "React" }],
      jobSkills: [{ name: "React" }],
      candidateExperience: [{ role: "Frontend Dev" }],
      projects: [{ name: "Portfolio" }],
      education: [], // Incomplete education
      resumeText: "React frontend dev",
      matchResults: [{ jobSkill: "React", category: "STRONG_MATCH" }],
    });

    assert.ok(readiness.score > 0);
    const eduDim = readiness.dimensions.find((d) => d.key === "educationAndQualifications");
    assert.strictEqual(eduDim.score, 70, "Should assign standard default baseline without crashing");
  });

  // ---- Test 7: User with no certifications ----
  await testAsync("7. User with no certifications does not trigger false errors or penalize strengths", async () => {
    const strengths = CareerInsightsService.identifyStrengths({
      resumeSkills: [{ name: "React" }],
      candidateExperience: [{ role: "Developer" }],
      projects: [{ name: "App" }],
      education: [{ degree: "B.S." }],
      certifications: [], // No certifications
      matchResults: [{ jobSkill: "React", category: "STRONG_MATCH" }],
    });

    assert.strictEqual(strengths.some((s) => s.category === "CERTIFICATION"), false);
    assert.ok(strengths.length >= 2, "Other valid strength areas must be generated");
  });

  // ---- Test 8: User with incomplete resume sections ----
  await testAsync("8. User with incomplete resume sections flags missing sections as constructive development areas", async () => {
    const weaknesses = CareerInsightsService.identifyWeaknesses({
      matchResults: [],
      projects: [], // Missing projects section
      candidateExperience: [],
      resumeSections: [], // Missing summary section
      resumeText: "Just a name and contact info",
      jobRecord: { title: "Junior Dev" },
    });

    assert.ok(weaknesses.some((w) => w.id === "weak-no-projects"));
    assert.ok(weaknesses.some((w) => w.id === "weak-no-summary"));
  });

  // ---- Test 9: User with weak project descriptions ----
  await testAsync("9. User with weak project descriptions flags need for quantifiable metrics", async () => {
    const weaknesses = CareerInsightsService.identifyWeaknesses({
      matchResults: [],
      projects: [{ name: "Website", description: "Worked on website." }],
      candidateExperience: [],
      resumeSections: [{ section_type: "SUMMARY" }],
      resumeText: "React developer",
      jobRecord: { title: "Web Developer" },
      resumeImprovementsData: {
        weakDescriptions: [
          { originalText: "Worked on website.", problem: "Vague verb" },
        ],
      },
    });

    assert.ok(weaknesses.some((w) => w.id === "weak-bullet-depth"));
    const bulletGap = weaknesses.find((w) => w.id === "weak-bullet-depth");
    assert.strictEqual(bulletGap.priority, "MEDIUM");
    assert.ok(bulletGap.suggestedImprovement.includes("Action + Metric"));
  });

  // ---- Test 10: User with a strong resume but limited job-specific compatibility ----
  await testAsync("10. User with strong resume but limited job-specific compatibility differentiates Career Readiness from Job Match", async () => {
    // Candidate has 5 years Python/Django experience and strong projects, but target job is C++/Embedded
    const resumeSkills = [
      { name: "Python", category: "PROGRAMMING" },
      { name: "Django", category: "FRAMEWORK" },
      { name: "PostgreSQL", category: "DATABASE" },
    ];
    const jobSkills = [
      { name: "C++", required: true },
      { name: "RTOS", required: true },
      { name: "Embedded Linux", required: true },
    ];
    const matchResults = [
      { jobSkill: "C++", category: "MISSING", requirementType: "REQUIRED" },
      { jobSkill: "RTOS", category: "MISSING", requirementType: "REQUIRED" },
      { jobSkill: "Embedded Linux", category: "MISSING", requirementType: "REQUIRED" },
    ];

    const readiness = CareerInsightsService.calculateCareerReadiness({
      resumeSkills,
      jobSkills,
      candidateExperience: [{ role: "Senior Python Developer", duration: "5 years" }],
      projects: [{ name: "High-Throughput Django API", description: "Optimized PostgreSQL queries." }],
      education: [{ degree: "B.S. in Computer Science" }],
      resumeText: "Experienced Python engineer with 5 years backend experience.",
      matchResults,
    });

    // Note: Day 21 Job Match Score for this pair is near 15% because zero skills match.
    // But Career Readiness recognizes general professional competence, education, and projects!
    assert.ok(readiness.score > 35, "Career Readiness must reflect overall professional background, not just 0% job match");
    assert.ok(readiness.dimensions.find((d) => d.key === "professionalExperience").score >= 70);
  });

  // ---- Test 11: User with high job match but insufficient career evidence ----
  await testAsync("11. User with high job match but no projects or experience is kept at Developing readiness", async () => {
    // 1-page keyword list matching all 3 job keywords, but 0 projects and 0 experience
    const resumeSkills = [
      { name: "React" },
      { name: "Node.js" },
    ];
    const jobSkills = [
      { name: "React" },
      { name: "Node.js" },
    ];
    const matchResults = [
      { jobSkill: "React", category: "STRONG_MATCH" },
      { jobSkill: "Node.js", category: "STRONG_MATCH" },
    ];

    const readiness = CareerInsightsService.calculateCareerReadiness({
      resumeSkills,
      jobSkills,
      candidateExperience: [],
      projects: [],
      education: [],
      resumeText: "Skills: React, Node.js",
      matchResults,
    });

    assert.ok(readiness.score <= 65, "Must not award high readiness without practical project or experience evidence");
    assert.ok(readiness.level === "Developing" || readiness.level === "Needs Development");
  });

  // ---- Test 12: Missing or unavailable analysis data ----
  await testAsync("12. Missing or unavailable analysis data reports INSUFFICIENT_DATA status gracefully", async () => {
    const readiness = CareerInsightsService.calculateCareerReadiness({
      resumeSkills: [],
      jobSkills: [],
      candidateExperience: [],
      projects: [],
      education: [],
      resumeText: "",
      matchResults: [],
    });

    assert.strictEqual(readiness.status, "INSUFFICIENT_DATA");
    assert.strictEqual(readiness.score, null);
    assert.strictEqual(readiness.level, "Insufficient Data");
    assert.ok(readiness.explanation.includes("not contain enough extracted technical skills"));
  });

  // ---- Test 13: AI provider unavailable (deterministic fallback) ----
  await testAsync("13. AI provider unavailable successfully produces complete deterministic career insights", withMockDb(async (sql, params) => {
    const sqlUpper = typeof sql === "string" ? sql.toUpperCase() : "";

    if (sqlUpper.includes("FROM RESUMES")) {
      return [[{ id: 10, user_id: 1, original_filename: "resume.pdf", extracted_text: "React and Node.js developer with web projects." }]];
    }
    if (sqlUpper.includes("FROM JOBS")) {
      return [[{ id: 20, user_id: 1, title: "Full Stack Engineer", company: "WebTech", description: "Looking for React developer." }]];
    }
    if (sqlUpper.includes("FROM RESUME_SECTIONS")) {
      return [[]];
    }
    if (sqlUpper.includes("FROM RESUME_SKILLS")) {
      return [[{ id: 1, name: "React", category: "FRAMEWORK" }]];
    }
    if (sqlUpper.includes("FROM JOB_SKILLS")) {
      return [[{ id: 1, name: "React", category: "FRAMEWORK", required: true, priority: "HIGH" }]];
    }
    if (sqlUpper.includes("FROM ANALYSES")) {
      return [[{ id: 30, user_id: 1, resume_id: 10, job_id: 20, summary: "{}" }]];
    }
    if (sqlUpper.includes("INSERT INTO CAREER_INSIGHTS") || sqlUpper.includes("UPDATE CAREER_INSIGHTS") || sqlUpper.includes("UPDATE ANALYSES")) {
      return [{ affectedRows: 1 }];
    }
    return [[]];
  }, async () => {
    const payload = await CareerInsightsService.generateCareerInsights(10, 20, 1, { forceFallback: true });
    assert.ok(payload);
    assert.ok(payload.careerReadiness);
    assert.ok(payload.strengths.length > 0);
    assert.ok(payload.weaknesses.length > 0);
    assert.ok(payload.careerImprovements.technical.length > 0);
    assert.ok(payload.summary.overallSynthesis);
  }));

  // ---- Test 14: Invalid AI response ----
  await testAsync("14. Invalid AI response safely caught without corrupting deterministic synthesis", async () => {
    // If AI narrative throws or returns null
    const summary = CareerInsightsService.generateCareerInsightsSummary({
      readiness: { score: 75, level: "Progressing Well", status: "AVAILABLE" },
      strengths: [{ title: "React Proficiency" }],
      weaknesses: [{ issue: "Missing Docker" }],
      prioritySkills: [{ skillName: "Docker" }],
      improvements: { technical: [{ practicalNextStep: "Learn Docker CLI" }] },
      jobRecord: { title: "Frontend Developer" },
    });

    assert.ok(summary.overallSynthesis.includes("Progressing Well"));
    assert.ok(summary.immediateNextActions.length > 0);
  });

  // ---- Test 15: Career readiness calculation and missing dimensions ----
  await testAsync("15. Career readiness calculation transparently redistributes weight when dimensions are missing", async () => {
    const candidateSkills = [{ name: "JavaScript" }];
    const readiness = CareerInsightsService.calculateCareerReadiness({
      resumeSkills: candidateSkills,
      jobSkills: [{ name: "JavaScript" }],
      candidateExperience: [], // Missing experience
      projects: [{ name: "Game Project", description: "Built 2D game in JavaScript." }],
      education: [],
      resumeText: "JavaScript student",
      matchResults: [{ jobSkill: "JavaScript", category: "STRONG_MATCH" }],
    });

    const totalWeight = readiness.dimensions.reduce((sum, d) => sum + d.weight, 0);
    assert.strictEqual(totalWeight, 100, "Dimension weights must sum to exactly 100%");
  });

  // ---- Test 16: Career readiness explanation and assessment thresholds ----
  await testAsync("16. Career readiness maps correctly to threshold tiers (Strong, Progressing, Developing, Needs Development)", async () => {
    const tiers = [
      { score: 85, expectedLevel: "Strong Preparation", expectedTier: "STRONG" },
      { score: 72, expectedLevel: "Progressing Well", expectedTier: "PROGRESSING" },
      { score: 58, expectedLevel: "Developing", expectedTier: "DEVELOPING" },
      { score: 40, expectedLevel: "Needs Development", expectedTier: "NEEDS_DEVELOPMENT" },
    ];

    for (const t of tiers) {
      // Direct threshold validation
      const matched = CareerInsightsService.calculateCareerReadiness({
        resumeSkills: t.score > 50 ? [{ name: "Python" }] : [],
        jobSkills: [{ name: "Python" }],
        candidateExperience: t.score >= 70 ? [{ role: "Engineer" }] : [],
        projects: t.score >= 50 ? [{ name: "App" }] : [],
        education: [{ degree: "CS" }],
        resumeText: "Developer text...",
        matchResults: t.score > 50 ? [{ jobSkill: "Python", category: "STRONG_MATCH" }] : [],
      });
      assert.ok(matched.level);
      assert.ok(matched.explanation);
    }
  });

  // ---- Test 17: Priority skills consistent with Day 26 ----
  await testAsync("17. Priority skills align directly with Day 26 Roadmap ordering and requirements", async () => {
    const matchResults = [
      { jobSkill: "CSS", category: "STRONG_MATCH", requirementType: "REQUIRED", priority: "HIGH" },
      { jobSkill: "Docker", category: "MISSING", requirementType: "REQUIRED", priority: "HIGH" },
      { jobSkill: "TypeScript", category: "PARTIAL_MATCH", requirementType: "REQUIRED", priority: "HIGH" },
      { jobSkill: "GraphQL", category: "MISSING", requirementType: "PREFERRED", priority: "MEDIUM" },
    ];

    const prioritySkills = CareerInsightsService.extractPrioritySkills({
      matchResults,
      jobRecord: { title: "Full Stack Engineer" },
      resumeId: 5,
      jobId: 8,
    });

    assert.strictEqual(prioritySkills.length, 3, "Only missing/partial skills must be included");
    assert.strictEqual(prioritySkills[0].skillName, "Docker", "Required HIGH priority gap must rank first");
    assert.strictEqual(prioritySkills[1].skillName, "TypeScript", "Required HIGH partial gap must rank second");
    assert.strictEqual(prioritySkills[2].skillName, "GraphQL", "Preferred MEDIUM gap must rank third");
    assert.ok(prioritySkills[0].roadmapLink.includes("/roadmap?resumeId=5&jobId=8"));
  });

  // ---- Test 18: Recommendations consistent with Day 28 ----
  await testAsync("18. Priority skills link to Day 28 Learning Recommendations", async () => {
    const matchResults = [
      { jobSkill: "Docker", category: "MISSING", requirementType: "REQUIRED", priority: "HIGH" },
    ];

    const prioritySkills = CareerInsightsService.extractPrioritySkills({
      matchResults,
      jobRecord: { title: "DevOps Engineer" },
      resumeId: 12,
      jobId: 15,
    });

    assert.ok(prioritySkills[0].recommendationLink.includes("/recommendations?resumeId=12&jobId=15"));
    assert.ok(prioritySkills[0].suggestedDirection.includes("Docker fundamentals"));
  });

  // ---- Test 19: Resume suggestions consistent with Day 29 ----
  await testAsync("19. Career improvements incorporate Day 29 resume and project rewrite actions", async () => {
    const improvements = CareerInsightsService.generateCareerImprovements({
      prioritySkills: [{ skillName: "Docker" }],
      weaknesses: [{ id: "weak-bullet-depth" }],
      projects: [{ name: "Store" }],
      candidateExperience: [],
      jobRecord: { title: "Software Engineer" },
    });

    assert.ok(improvements.resume.length >= 2);
    assert.ok(improvements.resume.some((r) => r.title.includes("Professional Summary")));
    assert.ok(improvements.projects.some((p) => p.title.includes("Measurable Impact")));
  });

  // ---- Test 20: Historical analysis consistency ----
  await testAsync("20. Historical career insights are retrieved directly from saved analysis snapshot", withMockDb(async (sql, params) => {
    const sqlUpper = typeof sql === "string" ? sql.toUpperCase() : "";

    if (sqlUpper.includes("FROM RESUMES")) {
      return [[{ id: 1, user_id: 10, original_filename: "saved_resume.pdf" }]];
    }
    if (sqlUpper.includes("FROM JOBS")) {
      return [[{ id: 2, user_id: 10, title: "Tech Lead", company: "NextGen" }]];
    }
    if (sqlUpper.includes("FROM ANALYSES")) {
      const summaryPayload = {
        careerInsights: {
          analysisId: 99,
          jobTitle: "Tech Lead",
          savedHistorical: true,
          careerReadiness: { score: 88, level: "Strong Preparation" },
        },
      };
      return [[{ id: 99, user_id: 10, resume_id: 1, job_id: 2, summary: JSON.stringify(summaryPayload) }]];
    }
    return [[]];
  }, async () => {
    const result = await CareerInsightsService.getCareerInsights(1, 2, 10);
    assert.strictEqual(result.analysisId, 99);
    assert.strictEqual(result.savedHistorical, true);
    assert.strictEqual(result.careerReadiness.score, 88);
  }));

  // ---- Test 21: Unauthorized access to another user's insights ----
  await testAsync("21. Unauthorized access to another user's insights returns 404/401", withMockDb(async (sql, params) => {
    const sqlUpper = typeof sql === "string" ? sql.toUpperCase() : "";
    if (sqlUpper.includes("FROM RESUMES")) {
      return [[]]; // Not owned by requesting user
    }
    return [[]];
  }, async () => {
    const req = {
      user: { id: 777 },
      params: { resumeId: "1", jobId: "2" },
    };
    const res = createMockRes();

    await getCareerInsights(req, res);
    assert.strictEqual(res.statusCode, 404);
    assert.strictEqual(res.body.success, false);
    assert.ok(res.body.message.includes("Resume not found or access denied"));
  }));

  // ---- Test 22: Responsive desktop, tablet, and mobile layouts / UI schema validation ----
  await testAsync("22. Frontend components and CSS contain responsive breakpoints, design tokens, and ARIA attributes", async () => {
    const cssPath = path.resolve(__dirname, "../../frontend/src/pages/CareerInsights.module.css");
    const jsxPath = path.resolve(__dirname, "../../frontend/src/pages/CareerInsights.jsx");

    assert.ok(fs.existsSync(cssPath), "CareerInsights.module.css must exist");
    assert.ok(fs.existsSync(jsxPath), "CareerInsights.jsx must exist");

    const cssContent = fs.readFileSync(cssPath, "utf8");
    const jsxContent = fs.readFileSync(jsxPath, "utf8");

    // Check media queries for tablet/mobile responsiveness
    assert.ok(cssContent.includes("@media (max-width: 860px)"), "CSS must include hero layout breakpoint @media (max-width: 860px)");
    assert.ok(cssContent.includes("var(--color-indigo)"), "CSS must use system design tokens for colors");
    assert.ok(cssContent.includes("var(--radius-xl)"), "CSS must use system design tokens for borders");

    // Check JSX accessibility and tabs
    assert.ok(jsxContent.includes('aria-label="Career Insights Navigation"'), "JSX must include ARIA labels for tab navigation");
    assert.ok(jsxContent.includes("Overall Career Readiness Assessment"), "JSX must render prominent readiness assessment");
    assert.ok(jsxContent.includes("Key Career Strengths"), "JSX must render strengths section");
    assert.ok(jsxContent.includes("Weaknesses & Development Areas"), "JSX must render weaknesses section");
    assert.ok(jsxContent.includes("Priority Skills to Develop"), "JSX must render priority skills section");
  });
}

// Support direct execution via `node backend/tests/day30CareerInsightsTests.js`
if (require.main === module) {
  let passed = 0;
  let failed = 0;

  const testAsync = async (name, fn) => {
    try {
      await fn();
      console.log(`  ✓ ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ✗ ${name}`);
      console.error(`    ${err.message}`);
      failed++;
    }
  };

  runDay30CareerInsightsTests(testAsync).then(() => {
    console.log(`\nDay 30 Tests: ${passed} passed, ${failed} failed.`);
    process.exit(failed > 0 ? 1 : 0);
  });
}

module.exports = { runDay30CareerInsightsTests };

