/**
 * SkillLens AI — Day 29: Resume Improvement Suggestions Test Suite
 *
 * Automated verification of all 20 required scenarios:
 * 1. Resume with strong existing summary
 * 2. Resume with no professional summary
 * 3. Resume with generic summary
 * 4. Resume with multiple projects
 * 5. Resume with very short project descriptions
 * 6. Resume with detailed project descriptions
 * 7. Resume with relevant job keywords already present
 * 8. Resume with missing required keywords
 * 9. Resume with missing preferred keywords
 * 10. Resume with skills that are poorly organized
 * 11. Resume with duplicate skills
 * 12. Resume with no project section
 * 13. Resume with incomplete extracted information
 * 14. Job description with limited requirements
 * 15. AI provider unavailable (deterministic fallback)
 * 16. Invalid or incomplete AI response (schema validation / fallback)
 * 17. AI-generated suggestions containing unsupported claims (anti-hallucination sanitization)
 * 18. Attempt to access another user's resume or job (401/404 isolation)
 * 19. Historical suggestion retrieval
 * 20. Responsive desktop, tablet, and mobile layouts / UI schema validation
 */

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const db = require("../config/db");
const ResumeImprovementService = require("../services/resumeImprovementService");
const {
  getSuggestions,
  generateSuggestions,
} = require("../controllers/resumeImprovementController");

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

async function runDay29ResumeImprovementTests(testAsync) {
  console.log("\n--- SkillLens AI: Day 29 Resume Improvement Suggestions Tests ---");

  // Keep references to original db methods
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

  // ---- Test 1: Resume with strong existing summary ----
  await testAsync("1. Resume with strong existing summary receives targeted role polish without overwriting core achievements", async () => {
    const summary = "Senior Full Stack Engineer with 6+ years of experience architecting scalable distributed systems using React, Node.js, and PostgreSQL. Experienced leading cross-functional teams to deliver cloud-native products.";
    const candidateSkills = [{ name: "React" }, { name: "Node.js" }, { name: "PostgreSQL" }];
    const jobRecord = { title: "Senior Full Stack Engineer", company: "TechCorp" };
    const matchedSkills = [{ jobSkill: "React" }, { jobSkill: "Node.js" }];

    const result = ResumeImprovementService.generateSummarySuggestions({
      summaryText: summary,
      candidateSkills,
      jobRecord,
      matchedSkills,
    });

    assert.strictEqual(result.hasOriginalSummary, true);
    assert.strictEqual(result.priority, "LOW", "Strong summary should receive LOW priority polish");
    assert.ok(result.suggestedSummary.includes("Targeted toward high-impact Senior Full Stack Engineer contributions"));
    assert.ok(result.strengthsIdentified.length > 0);
  });

  // ---- Test 2: Resume with no professional summary ----
  await testAsync("2. Resume with no professional summary generates a structured introduction grounded in candidate skills", async () => {
    const candidateSkills = [{ name: "React" }, { name: "TypeScript" }];
    const jobRecord = { title: "Frontend Developer", company: "Acme Corp" };
    const matchedSkills = [{ jobSkill: "React" }];

    const result = ResumeImprovementService.generateSummarySuggestions({
      summaryText: "",
      candidateSkills,
      jobRecord,
      matchedSkills,
    });

    assert.strictEqual(result.hasOriginalSummary, false);
    assert.strictEqual(result.priority, "HIGH", "Missing summary must be flagged as HIGH priority");
    assert.ok(result.identifiedProblems.some((p) => p.includes("missing an executive summary")));
    assert.ok(result.suggestedSummary.includes("Frontend Developer"));
    assert.ok(result.suggestedSummary.includes("React"));
  });

  // ---- Test 3: Resume with generic summary ----
  await testAsync("3. Resume with generic summary flags buzzwords and replaces clichés with concrete competencies", async () => {
    const genericSummary = "Hardworking and results-driven team player seeking an entry-level position to utilize my skills and contribute to company growth.";
    const candidateSkills = [{ name: "Python" }, { name: "Django" }, { name: "SQL" }];
    const jobRecord = { title: "Backend Engineer", company: "DataFlow" };
    const matchedSkills = [{ jobSkill: "Python" }, { jobSkill: "Django" }];

    const result = ResumeImprovementService.generateSummarySuggestions({
      summaryText: genericSummary,
      candidateSkills,
      jobRecord,
      matchedSkills,
    });

    assert.strictEqual(result.hasOriginalSummary, true);
    assert.strictEqual(result.priority, "HIGH");
    assert.ok(result.identifiedProblems.some((p) => p.includes("generic buzzwords") || p.includes("Focuses on what you want")));
    assert.ok(result.suggestedSummary.includes("Backend Engineer"));
    assert.ok(result.suggestedSummary.includes("Python"));
    assert.ok(!result.suggestedSummary.toLowerCase().includes("hardworking"));
  });

  // ---- Test 4: Resume with multiple projects ----
  await testAsync("4. Resume with multiple projects generates structured rewrites for each project", async () => {
    const projects = [
      {
        name: "E-Commerce Web App",
        description: "Built online store using React and Node.",
        technologies: ["React", "Node.js", "MongoDB"],
      },
      {
        name: "Real-Time Chat Engine",
        description: "Implemented WebSocket server with Redis pub-sub.",
        technologies: ["Node.js", "Redis", "WebSockets"],
      },
    ];

    const result = ResumeImprovementService.generateProjectSuggestions({
      projects,
      candidateSkills: [{ name: "React" }, { name: "Node.js" }],
      jobRecord: { title: "Full Stack Developer" },
      missingSkills: [],
    });

    assert.strictEqual(result.length, 2);
    assert.strictEqual(result[0].projectName, "E-Commerce Web App");
    assert.strictEqual(result[1].projectName, "Real-Time Chat Engine");
    assert.ok(result[0].improvedBullet.includes("[X]%"));
    assert.ok(result[1].improvedBullet.includes("[X]%"));
  });

  // ---- Test 5: Resume with very short project descriptions ----
  await testAsync("5. Resume with very short project descriptions transforms vague phrases into Action + Implementation + Result", async () => {
    const projects = [
      {
        name: "Inventory System",
        description: "Worked on website.",
        technologies: ["React"],
      },
    ];

    const result = ResumeImprovementService.generateProjectSuggestions({
      projects,
      candidateSkills: [{ name: "React" }],
      jobRecord: { title: "Software Engineer" },
      missingSkills: [],
    });

    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].priority, "HIGH");
    assert.ok(!result[0].improvedBullet.startsWith("Worked on"));
    assert.ok(result[0].improvedBullet.includes("[X]%"));
    assert.ok(result[0].improvementExplanation.includes("action verb"));
  });

  // ---- Test 6: Resume with detailed project descriptions ----
  await testAsync("6. Resume with detailed project descriptions preserves technical depth and recognizes metrics", async () => {
    const projects = [
      {
        name: "High-Throughput Gateway",
        description: "Architected distributed API gateway utilizing Go and gRPC, reducing average response latency by 35% across 50 microservices.",
        technologies: ["Go", "gRPC"],
      },
    ];

    const result = ResumeImprovementService.generateProjectSuggestions({
      projects,
      candidateSkills: [{ name: "Go" }],
      jobRecord: { title: "Backend Systems Engineer" },
      missingSkills: [],
    });

    assert.strictEqual(result.length, 1);
    assert.ok(result[0].improvementExplanation.includes("already well-structured") || result[0].improvedBullet.includes("35%"));
  });

  // ---- Test 7: Resume with relevant job keywords already present ----
  await testAsync("7. Resume with relevant job keywords classifies them as alreadyPresent without false missing alerts", async () => {
    const rawResumeText = "Experienced in React, TypeScript, and CSS modules.";
    const candidateSkills = [{ name: "React" }, { name: "TypeScript" }];
    const jobSkills = [
      { name: "React", required: true, priority: "HIGH" },
      { name: "TypeScript", required: true, priority: "HIGH" },
    ];

    const result = ResumeImprovementService.generateKeywordSuggestions({
      rawResumeText,
      candidateSkills,
      jobSkills,
      jobRequirements: [],
      matchResults: [],
    });

    assert.strictEqual(result.requiredMissing.length, 0);
    assert.strictEqual(result.alreadyPresent.length, 2);
    assert.strictEqual(result.alreadyPresent[0].keyword, "React");
    assert.strictEqual(result.alreadyPresent[1].keyword, "TypeScript");
  });

  // ---- Test 8: Resume with missing required keywords ----
  await testAsync("8. Resume with missing required keywords assigns HIGH importance and provides ethical placement guidance", async () => {
    const rawResumeText = "Building web applications with HTML, CSS, JavaScript.";
    const candidateSkills = [{ name: "JavaScript" }];
    const jobSkills = [
      { name: "Docker", required: true, priority: "HIGH" },
      { name: "Kubernetes", required: true, priority: "HIGH" },
    ];

    const result = ResumeImprovementService.generateKeywordSuggestions({
      rawResumeText,
      candidateSkills,
      jobSkills,
      jobRequirements: [],
      matchResults: [],
    });

    assert.strictEqual(result.requiredMissing.length, 2);
    const dockerItem = result.requiredMissing.find((k) => k.keyword === "Docker");
    assert.ok(dockerItem);
    assert.strictEqual(dockerItem.importance, "HIGH");
    assert.strictEqual(dockerItem.requirementType, "REQUIRED");
    assert.ok(dockerItem.ethicalNotice.includes("Never insert 'Docker' if you do not have practical knowledge"));
  });

  // ---- Test 9: Resume with missing preferred keywords ----
  await testAsync("9. Resume with missing preferred keywords assigns MEDIUM importance as competitive differentiators", async () => {
    const rawResumeText = "Frontend engineer specializing in React and CSS.";
    const candidateSkills = [{ name: "React" }];
    const jobSkills = [
      { name: "GraphQL", required: false, priority: "MEDIUM" },
    ];

    const result = ResumeImprovementService.generateKeywordSuggestions({
      rawResumeText,
      candidateSkills,
      jobSkills,
      jobRequirements: [],
      matchResults: [],
    });

    assert.strictEqual(result.preferredMissing.length, 1);
    assert.strictEqual(result.preferredMissing[0].keyword, "GraphQL");
    assert.strictEqual(result.preferredMissing[0].importance, "MEDIUM");
    assert.strictEqual(result.preferredMissing[0].requirementType, "PREFERRED");
  });

  // ---- Test 10: Resume with skills that are poorly organized ----
  await testAsync("10. Resume with skills that are poorly organized structures them into standard technical categories", async () => {
    const resumeSkills = [
      { name: "JavaScript", category: "PROGRAMMING" },
      { name: "Python", category: "PROGRAMMING" },
      { name: "React", category: "FRAMEWORK" },
      { name: "Node.js", category: "FRAMEWORK" },
      { name: "PostgreSQL", category: "DATABASE" },
      { name: "Docker", category: "CLOUD" },
      { name: "Git", category: "TOOL" },
    ];

    const result = ResumeImprovementService.generateSkillPresentationSuggestions({
      resumeSkills,
      jobSkills: [{ name: "React", category: "FRAMEWORK" }],
      rawResumeText: "",
    });

    const categories = Object.keys(result.recommendedCategories);
    assert.ok(categories.includes("Programming Languages"));
    assert.ok(categories.includes("Frameworks & Libraries"));
    assert.ok(categories.includes("Databases & Storage"));
    assert.ok(result.recommendedCategories["Frameworks & Libraries"][0] === "React", "Target job skill React should be prioritized first");
  });

  // ---- Test 11: Resume with duplicate skills ----
  await testAsync("11. Resume with duplicate skills detects aliases and recommends deduplication", async () => {
    const resumeSkills = [
      { name: "React" },
      { name: "ReactJS" },
      { name: "Node.js" },
      { name: "Node" },
    ];

    const result = ResumeImprovementService.generateSkillPresentationSuggestions({
      resumeSkills,
      jobSkills: [],
      rawResumeText: "",
    });

    assert.ok(result.deduplicatedSkills.length >= 1, "Should catch redundant alias pairs");
    const reactDup = result.deduplicatedSkills.find((d) => d.duplicateFound === "ReactJS");
    assert.ok(reactDup);
    assert.strictEqual(reactDup.canonical, "React");
  });

  // ---- Test 12: Resume with no project section ----
  await testAsync("12. Resume with no project section provides structured templates without failing", async () => {
    const result = ResumeImprovementService.generateProjectSuggestions({
      projects: [],
      candidateSkills: [{ name: "JavaScript" }],
      jobRecord: { title: "Junior Developer" },
      missingSkills: [],
    });

    assert.strictEqual(result.length, 1);
    assert.ok(result[0].originalBullet.includes("No project section"));
    assert.ok(result[0].improvedBullet.includes("Architected and deployed"));
    assert.strictEqual(result[0].priority, "HIGH");
  });

  // ---- Test 13: Resume with incomplete extracted information ----
  await testAsync("13. Resume with incomplete extracted information handles empty fields cleanly with safe fallbacks", async () => {
    const structuredModel = ResumeImprovementService.assembleStructuredResume([], "");
    assert.strictEqual(structuredModel.summary, "");
    assert.deepStrictEqual(structuredModel.experience, []);
    assert.deepStrictEqual(structuredModel.projects, []);

    const weak = ResumeImprovementService.generateWeakDescriptionSuggestions({
      structuredModel,
      rawText: "",
      jobRecord: {},
    });
    assert.ok(Array.isArray(weak));
    assert.ok(weak.length > 0);
  });

  // ---- Test 14: Job description with limited requirements ----
  await testAsync("14. Job description with limited requirements executes smoothly without null reference errors", async () => {
    const result = ResumeImprovementService.generateKeywordSuggestions({
      rawResumeText: "Experienced with Python.",
      candidateSkills: [{ name: "Python" }],
      jobSkills: [],
      jobRequirements: [],
      matchResults: [],
    });

    assert.strictEqual(result.requiredMissing.length, 0);
    assert.strictEqual(result.preferredMissing.length, 0);
    assert.strictEqual(result.alreadyPresent.length, 0);
    assert.ok(result.disclaimer.includes("Caution"));
  });

  // ---- Test 15: AI provider unavailable (deterministic fallback) ----
  await testAsync("15. AI provider unavailable successfully triggers deterministic rule-based suggestions", withMockDb(async (sql, params) => {
    const sqlUpper = typeof sql === "string" ? sql.toUpperCase() : "";

    if (sqlUpper.includes("FROM RESUMES")) {
      return [[{ id: 10, user_id: 1, original_filename: "resume.pdf", extracted_text: "React and Node developer." }]];
    }
    if (sqlUpper.includes("FROM JOBS")) {
      return [[{ id: 20, user_id: 1, title: "Full Stack Engineer", company: "WebCorp", description: "Looking for React developer." }]];
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
    if (sqlUpper.includes("FROM JOB_REQUIREMENTS")) {
      return [[]];
    }
    if (sqlUpper.includes("FROM ANALYSES")) {
      return [[{ id: 30, user_id: 1, resume_id: 10, job_id: 20, summary: "{}" }]];
    }
    if (sqlUpper.includes("INSERT INTO RESUME_SUGGESTIONS") || sqlUpper.includes("DELETE FROM RESUME_SUGGESTIONS") || sqlUpper.includes("UPDATE ANALYSES")) {
      return [{ affectedRows: 1 }];
    }
    return [[]];
  }, async () => {
    const payload = await ResumeImprovementService.generateSuggestions(10, 20, 1, { forceFallback: true });
    assert.ok(payload);
    assert.strictEqual(payload.analysisId, 30);
    assert.ok(payload.summary);
    assert.ok(payload.projects);
    assert.ok(payload.keywords);
    assert.ok(payload.metrics.totalSuggestions > 0);
  }));

  // ---- Test 16: Invalid or incomplete AI response ----
  await testAsync("16. Invalid or incomplete AI response safely caught and sanitized with schema fallback", async () => {
    const sanitizedEmpty = ResumeImprovementService.sanitizeAiSuggestions(null, "", []);
    assert.deepStrictEqual(sanitizedEmpty, {});

    const sanitizedBadTypes = ResumeImprovementService.sanitizeAiSuggestions({
      summary: { suggestedSummary: 123 },
      projects: "not an array",
    }, "", []);
    assert.deepStrictEqual(sanitizedBadTypes, {});
  });

  // ---- Test 17: AI-generated suggestions containing unsupported claims ----
  await testAsync("17. AI-generated suggestions containing unsupported numbers/dollar claims are sanitized with placeholders", async () => {
    const rawAi = {
      summary: {
        suggestedSummary: "Engineered fintech platform increasing annual revenue by $5.2M and user growth by 340%.",
        reason: "Role alignment",
      },
      projects: [
        {
          projectName: "Portal",
          improvedBullet: "Handled 1500000 transactions daily, boosting throughput by 85% and saving $400k.",
        },
      ],
    };

    const sanitized = ResumeImprovementService.sanitizeAiSuggestions(rawAi, "Plain text without numbers", []);
    assert.ok(sanitized.summary.suggestedSummary.includes("$[X]"), "Should replace specific dollar amounts with $[X]");
    assert.ok(sanitized.summary.suggestedSummary.includes("[X]%"), "Should replace percentages with [X]%");
    assert.ok(sanitized.projects[0].improvedBullet.includes("[X]%"));
    assert.ok(sanitized.projects[0].improvedBullet.includes("$[X]"));
  });

  // ---- Test 18: Attempt to access another user's resume or job (401/404) ----
  await testAsync("18. Unauthorized access attempts to another user's resume or job are blocked with 404/401", withMockDb(async (sql, params) => {
    const sqlUpper = typeof sql === "string" ? sql.toUpperCase() : "";
    if (sqlUpper.includes("FROM RESUMES")) {
      return [[]]; // Not found for user 999
    }
    return [[]];
  }, async () => {
    const req = {
      user: { id: 999 },
      params: { resumeId: "1", jobId: "2" },
    };
    const res = createMockRes();

    await getSuggestions(req, res);
    assert.strictEqual(res.statusCode, 404);
    assert.strictEqual(res.body.success, false);
    assert.ok(res.body.message.includes("Resume not found or access denied"));
  }));

  // ---- Test 19: Historical suggestion retrieval ----
  await testAsync("19. Historical suggestions are retrieved from existing analysis record when available", withMockDb(async (sql, params) => {
    const sqlUpper = typeof sql === "string" ? sql.toUpperCase() : "";

    if (sqlUpper.includes("FROM RESUMES")) {
      return [[{ id: 1, user_id: 10, original_filename: "my_resume.pdf" }]];
    }
    if (sqlUpper.includes("FROM JOBS")) {
      return [[{ id: 2, user_id: 10, title: "Frontend Lead", company: "StartupX" }]];
    }
    if (sqlUpper.includes("FROM ANALYSES")) {
      const summaryPayload = {
        resumeImprovementSuggestions: {
          analysisId: 55,
          jobTitle: "Frontend Lead",
          savedHistorical: true,
          metrics: { totalSuggestions: 5 },
        },
      };
      return [[{ id: 55, user_id: 10, resume_id: 1, job_id: 2, summary: JSON.stringify(summaryPayload) }]];
    }
    if (sqlUpper.includes("FROM RESUME_SUGGESTIONS")) {
      return [[
        { id: 1, analysis_id: 55, section: "SUMMARY", suggestion: "Saved summary suggestion" },
      ]];
    }
    return [[]];
  }, async () => {
    const result = await ResumeImprovementService.getSuggestions(1, 2, 10);
    assert.strictEqual(result.analysisId, 55);
    assert.strictEqual(result.savedHistorical, true);
  }));

  // ---- Test 20: Responsive desktop, tablet, and mobile layouts / UI schema validation ----
  await testAsync("20. Frontend components and CSS contain responsive breakpoints, design tokens, and ARIA attributes", async () => {
    const cssPath = path.resolve(__dirname, "../../frontend/src/pages/ResumeImprovements.module.css");
    const jsxPath = path.resolve(__dirname, "../../frontend/src/pages/ResumeImprovements.jsx");

    assert.ok(fs.existsSync(cssPath), "ResumeImprovements.module.css must exist");
    assert.ok(fs.existsSync(jsxPath), "ResumeImprovements.jsx must exist");

    const cssContent = fs.readFileSync(cssPath, "utf8");
    const jsxContent = fs.readFileSync(jsxPath, "utf8");

    // Check media queries for tablet/mobile responsiveness
    assert.ok(cssContent.includes("@media (max-width: 768px)"), "CSS must include mobile breakpoint @media (max-width: 768px)");
    assert.ok(cssContent.includes("var(--color-indigo)"), "CSS must use system design tokens for colors");
    assert.ok(cssContent.includes("var(--radius-xl)"), "CSS must use system design tokens for borders");

    // Check JSX accessibility and tabs
    assert.ok(jsxContent.includes('aria-label="Improvement Categories"'), "JSX must include ARIA labels for tab navigation");
    assert.ok(jsxContent.includes("handleCopy"), "JSX must implement copy-to-clipboard functionality");
    assert.ok(jsxContent.includes("Skill Gap Roadmap"), "JSX must provide link to Skill Gap Roadmap");
    assert.ok(jsxContent.includes("disclaimerBanner"), "JSX must display factual integrity notice");
  });
}

// Support direct execution via `node backend/tests/day29ResumeImprovementTests.js`
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

  runDay29ResumeImprovementTests(testAsync).then(() => {
    console.log(`\nDay 29 Tests: ${passed} passed, ${failed} failed.`);
    process.exit(failed > 0 ? 1 : 0);
  });
}

module.exports = { runDay29ResumeImprovementTests };

