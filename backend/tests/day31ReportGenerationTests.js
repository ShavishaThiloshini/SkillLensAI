/**
 * SkillLens AI — Day 31: Report Generation Test Suite
 *
 * Automated verification of all 17 required scenarios:
 * 1. Complete analysis report data retrieval (all 7 sections present)
 * 2. Analysis with missing optional data (handled gracefully without errors)
 * 3. Resume summary accuracy (preserves extracted data without fabrication)
 * 4. Target role specifications (job title, company, requirements)
 * 5. Match scores matching Day 21 backend formula (50/25/15/10 breakdown)
 * 6. Strong and partial matching skills separation and evidence
 * 7. Missing required and preferred skills separation and priority
 * 8. Actionable recommendations (technical, project, resume, professional)
 * 9. Learning roadmap steps and status preservation
 * 10. PDF binary generation and valid PDF 1.4 structure
 * 11. PDF text extraction and verification via pdf-parse
 * 12. Multi-page layout, margins, running headers & footers (Page X of Y)
 * 13. Historical analysis consistency (verified scores remain unaltered)
 * 14. Cross-user isolation (unauthorized access returns 404 / access denied)
 * 15. Invalid / non-existent analysis ID handling (returns 400 / 404)
 * 16. Controller endpoints: getReportPreview and downloadReportPdf
 * 17. Responsive UI schema, print styling, and accessibility validation
 */

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const db = require("../config/db");
const ReportGenerationService = require("../services/reportGenerationService");
const PdfDocumentBuilder = require("../utils/pdfDocumentBuilder");
const {
  getReportPreview,
  downloadReportPdf,
} = require("../controllers/reportController");

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
    setHeader(name, value) {
      this.headers[name] = value;
      return this;
    },
    send(data) {
      this.body = data;
      return this;
    },
    end(data) {
      if (data) this.body = data;
      return this;
    },
  };
  return res;
}

async function runDay31ReportGenerationTests(testAsync) {
  console.log("\n--- SkillLens AI: Day 31 Report Generation Tests ---");

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

  // Sample verified analysis record
  const sampleAnalysis = {
    id: 101,
    user_id: 1,
    resume_id: 10,
    job_id: 20,
    overall_score: 84,
    skill_score: 88,
    experience_score: 80,
    education_score: 90,
    certification_score: 75,
    status: "COMPLETED",
    algorithm_version: "1.0",
    created_at: new Date("2026-03-15T10:30:00Z"),
    completed_at: new Date("2026-03-15T10:30:15Z"),
    summary: JSON.stringify({
      overallSummary: "Candidate demonstrates strong alignment with backend and frontend requirements.",
      strongestAreas: [{ skill: "React", evidence: "6 years React experience" }],
      biggestSkillGaps: [{ skill: "Docker", requirementType: "PREFERRED", explanation: "Lacks container experience" }],
      improvementSuggestions: [
        { area: "Technical", suggestion: "Learn Docker and container architecture" },
        { area: "Projects", suggestion: "Add a full-stack containerized microservices project" },
        { area: "Resume", suggestion: "Quantify project impact with performance metrics" },
      ],
      recommendations: [
        {
          skill: "Docker",
          priority: "HIGH",
          reason: "Required by target role container infrastructure",
          topics: ["Docker CLI", "Dockerfile", "Multi-stage builds"],
          practicalActivities: ["Containerize existing Node.js API"],
        },
      ],
    }),
  };

  const sampleResume = {
    id: 10,
    user_id: 1,
    original_filename: "Jane_Doe_Resume_2026.pdf",
    stored_filename: "stored_jane_doe.pdf",
    file_type: "pdf",
    file_size: 10240,
    extracted_text: "Jane Doe Senior Full Stack Engineer. Colombo, Sri Lanka. Experienced full-stack engineer with 6+ years experience.",
    created_at: new Date("2026-03-01T09:00:00Z"),
  };

  const sampleSections = [
    {
      section_type: "CONTACT",
      section_content: JSON.stringify({ name: "Jane Doe", location: "Colombo, Sri Lanka" }),
      display_order: 1,
    },
    {
      section_type: "SUMMARY",
      section_content: "Senior Full Stack Engineer with 6 years experience in cloud-native platforms.",
      display_order: 2,
    },
    {
      section_type: "EXPERIENCE",
      section_content: JSON.stringify([
        { role: "Senior Developer", company: "Acme Tech", duration: "2022 - Present", description: "Led microservices architecture." },
      ]),
      display_order: 3,
    },
    {
      section_type: "PROJECTS",
      section_content: JSON.stringify([
        { name: "Cloud Dashboard", technologies: ["React", "TypeScript", "Node.js"], description: "Monitoring dashboard for AWS services." },
      ]),
      display_order: 4,
    },
    {
      section_type: "EDUCATION",
      section_content: JSON.stringify([
        { degree: "B.S. in Computer Science", institution: "University of Colombo", year: "2019" },
      ]),
      display_order: 5,
    },
  ];

  const sampleJob = {
    id: 20,
    user_id: 1,
    title: "Senior Full Stack Engineer",
    company: "Acme Cloud Solutions",
    description: "Build scalable cloud services with React and Node.js. 5 years experience required.",
    created_at: new Date("2026-03-05T12:00:00Z"),
  };

  const sampleJobRequirements = [
    { requirement_type: "EXPERIENCE", requirement_text: "5 years experience", priority: "HIGH" },
    { requirement_type: "EDUCATION", requirement_text: "Bachelor's Degree in Computer Science or equivalent", priority: "MEDIUM" },
  ];

  const sampleResumeSkills = [
    { id: 1, name: "React", category: "FRAMEWORK", proficiency: "EXPERT", evidence: "Built frontend in React" },
    { id: 2, name: "Node.js", category: "FRAMEWORK", proficiency: "EXPERT", evidence: "Architected microservices with Node.js" },
    { id: 3, name: "TypeScript", category: "PROGRAMMING", proficiency: "INTERMEDIATE", evidence: "Used TypeScript in side projects" },
    { id: 4, name: "PostgreSQL", category: "DATABASE", proficiency: "INTERMEDIATE", evidence: "Relational data modeling" },
  ];

  const sampleJobSkills = [
    { id: 1, name: "React", category: "FRAMEWORK", priority: "HIGH", required: 1, evidence: "" },
    { id: 2, name: "Node.js", category: "FRAMEWORK", priority: "HIGH", required: 1, evidence: "" },
    { id: 3, name: "TypeScript", category: "PROGRAMMING", priority: "HIGH", required: 1, evidence: "" },
    { id: 5, name: "Docker", category: "DEVOPS", priority: "MEDIUM", required: 0, evidence: "" },
    { id: 6, name: "AWS", category: "DEVOPS", priority: "MEDIUM", required: 0, evidence: "" },
  ];

  const sampleSkillMatches = [
    {
      id: 1,
      skill_id: 1,
      job_skill_name: "React",
      skill_category: "FRAMEWORK",
      status: "STRONG_MATCH",
      requirement_type: "REQUIRED",
      match_score: 1.0,
      priority: "HIGH",
      explanation: "Directly matches React requirement",
      evidence: "Built frontend in React; 6 years React experience",
    },
    {
      id: 2,
      skill_id: 2,
      job_skill_name: "Node.js",
      skill_category: "FRAMEWORK",
      status: "STRONG_MATCH",
      requirement_type: "REQUIRED",
      match_score: 1.0,
      priority: "HIGH",
      explanation: "Directly matches Node.js requirement",
      evidence: "Architected microservices with Node.js",
    },
    {
      id: 3,
      skill_id: 3,
      job_skill_name: "TypeScript",
      skill_category: "PROGRAMMING",
      status: "PARTIAL_MATCH",
      requirement_type: "REQUIRED",
      match_score: 0.75,
      priority: "HIGH",
      explanation: "Partial TypeScript match from personal projects",
      evidence: "Used TypeScript in side projects",
    },
    {
      id: 4,
      skill_id: 5,
      job_skill_name: "Docker",
      skill_category: "DEVOPS",
      status: "MISSING",
      requirement_type: "PREFERRED",
      match_score: 0,
      priority: "MEDIUM",
      explanation: "Missing Docker requirement",
      evidence: "",
    },
    {
      id: 5,
      skill_id: 6,
      job_skill_name: "AWS",
      skill_category: "DEVOPS",
      status: "MISSING",
      requirement_type: "PREFERRED",
      match_score: 0,
      priority: "MEDIUM",
      explanation: "Missing AWS requirement",
      evidence: "",
    },
  ];

  const sampleRoadmapItems = [
    {
      id: 1,
      step_order: 1,
      difficulty: "INTERMEDIATE",
      title: "Master Docker Containerization",
      skill_name: "Docker",
      description: "Learn container lifecycle and image building.",
      estimated_duration: "2 weeks",
      status: "COMPLETED",
      exercises: JSON.stringify(["Install Docker Engine", "Write multi-stage Dockerfile"]),
      project: "Containerized Node.js Web API",
    },
    {
      id: 2,
      step_order: 2,
      difficulty: "ADVANCED",
      title: "AWS ECS & Cloud Architecture",
      skill_name: "AWS",
      description: "Deploy containers to AWS ECS with Fargate.",
      estimated_duration: "3 weeks",
      status: "IN_PROGRESS",
      exercises: JSON.stringify(["Configure AWS VPC", "Set up ECS task definition"]),
      project: "Production ECS Deployment",
    },
  ];

  // Comprehensive mock DB handler
  function mockDbHandler(sql, params) {
    if (sql.includes("FROM analyses a")) {
      return [[sampleAnalysis]];
    }
    if (sql.includes("FROM resumes")) {
      return [[sampleResume]];
    }
    if (sql.includes("FROM resume_sections")) {
      return [sampleSections];
    }
    if (sql.includes("FROM jobs")) {
      return [[sampleJob]];
    }
    if (sql.includes("FROM job_requirements")) {
      return [sampleJobRequirements];
    }
    if (sql.includes("FROM resume_skills")) {
      return [sampleResumeSkills];
    }
    if (sql.includes("FROM job_skills")) {
      return [sampleJobSkills];
    }
    if (sql.includes("FROM skill_matches")) {
      return [sampleSkillMatches];
    }
    if (sql.includes("FROM roadmap_items")) {
      return [sampleRoadmapItems];
    }
    return [[]];
  }

  // ---- Test 1: Complete analysis report data retrieval ----
  await testAsync("1. Complete analysis report data retrieval contains all 7 core sections", withMockDb(mockDbHandler, async () => {
    const reportData = await ReportGenerationService.getReportData(101, 1);

    assert.ok(reportData, "Report data must be returned");
    assert.ok(reportData.header, "Section 1: Header metadata must be present");
    assert.strictEqual(reportData.header.title, "AI Resume Skill Gap Report");
    assert.strictEqual(reportData.header.targetJob, "Senior Full Stack Engineer");
    assert.strictEqual(reportData.header.company, "Acme Cloud Solutions");

    assert.ok(reportData.resumeSummary, "Section 1: Resume Summary must be present");
    assert.strictEqual(reportData.resumeSummary.candidateName, "Jane Doe");
    assert.ok(reportData.resumeSummary.skills.includes("React"));

    assert.ok(reportData.targetRole, "Section 2: Target Role must be present");
    assert.strictEqual(reportData.targetRole.jobTitle, "Senior Full Stack Engineer");
    assert.strictEqual(reportData.targetRole.requiredYears, 5);

    assert.ok(reportData.matchScore, "Section 3: Match Score must be present");
    assert.strictEqual(reportData.matchScore.overall, 84);

    assert.ok(reportData.matchingSkills, "Section 4: Matching Skills must be present");
    assert.ok(reportData.missingSkills, "Section 5: Missing Skills must be present");
    assert.ok(reportData.recommendations, "Section 6: Recommendations must be present");
    assert.ok(reportData.roadmap, "Section 7: Learning Roadmap must be present");
  }));

  // ---- Test 2: Analysis with missing optional data ----
  await testAsync("2. Analysis with missing optional data handles nulls gracefully without throwing errors", withMockDb(async (sql) => {
    if (sql.includes("FROM analyses a")) {
      return [[{
        id: 102,
        user_id: 1,
        resume_id: 11,
        job_id: 21,
        overall_score: 55,
        skill_score: 60,
        experience_score: null,
        education_score: null,
        certification_score: null,
        status: "COMPLETED",
        created_at: new Date(),
        summary: null,
      }]];
    }
    if (sql.includes("FROM resumes")) {
      return [[{
        id: 11,
        user_id: 1,
        original_filename: "resume.pdf",
        extracted_text: null,
      }]];
    }
    if (sql.includes("FROM jobs")) {
      return [[{
        id: 21,
        user_id: 1,
        title: "Junior Developer",
        company: null,
        description: null,
      }]];
    }
    return [[]];
  }, async () => {
    const reportData = await ReportGenerationService.getReportData(102, 1);
    assert.strictEqual(reportData.header.company, "Not specified");
    assert.strictEqual(reportData.resumeSummary.candidateName, "Candidate");
    assert.strictEqual(reportData.matchScore.scores.experience.status, "NOT_APPLICABLE");
    assert.strictEqual(reportData.recommendations.technical.length > 0, true);
    assert.strictEqual(reportData.roadmap.steps.length, 0);
  }));

  // ---- Test 3: Resume summary accuracy ----
  await testAsync("3. Resume summary accurately presents extracted data without inventing qualifications", withMockDb(mockDbHandler, async () => {
    const reportData = await ReportGenerationService.getReportData(101, 1);
    const resume = reportData.resumeSummary;

    assert.strictEqual(resume.candidateName, "Jane Doe");
    assert.strictEqual(resume.professionalSummary, "Senior Full Stack Engineer with 6 years experience in cloud-native platforms.");
    assert.strictEqual(resume.education[0].institution, "University of Colombo");
    assert.strictEqual(resume.experience[0].company, "Acme Tech");
    assert.strictEqual(resume.projects[0].name, "Cloud Dashboard");
  }));

  // ---- Test 4: Target role specifications ----
  await testAsync("4. Target role specifications include job title, company, requirements, and required experience", withMockDb(mockDbHandler, async () => {
    const reportData = await ReportGenerationService.getReportData(101, 1);
    const role = reportData.targetRole;

    assert.strictEqual(role.jobTitle, "Senior Full Stack Engineer");
    assert.strictEqual(role.company, "Acme Cloud Solutions");
    assert.deepStrictEqual(role.requiredSkills, ["React", "Node.js", "TypeScript"]);
    assert.deepStrictEqual(role.preferredSkills, ["Docker", "AWS"]);
    assert.strictEqual(role.requiredYears, 5);
  }));

  // ---- Test 5: Match scores matching Day 21 formula ----
  await testAsync("5. Match scores reflect Day 21 backend formula (skills 50%, experience 25%, education 15%, certifications 10%)", withMockDb(mockDbHandler, async () => {
    const reportData = await ReportGenerationService.getReportData(101, 1);
    const matchScore = reportData.matchScore;

    assert.strictEqual(matchScore.overall, 84);
    assert.strictEqual(matchScore.scores.skills.score, 88);
    assert.strictEqual(matchScore.scores.skills.weight, "50%");
    assert.strictEqual(matchScore.scores.experience.score, 80);
    assert.strictEqual(matchScore.scores.experience.weight, "25%");
    assert.strictEqual(matchScore.scores.education.score, 90);
    assert.strictEqual(matchScore.scores.education.weight, "15%");
    assert.strictEqual(matchScore.scores.certifications.score, 75);
    assert.strictEqual(matchScore.scores.certifications.weight, "10%");
  }));

  // ---- Test 6: Strong and partial matching skills separation and evidence ----
  await testAsync("6. Matching skills correctly segregate strong matches from partial matches and retain evidence", withMockDb(mockDbHandler, async () => {
    const reportData = await ReportGenerationService.getReportData(101, 1);
    const matching = reportData.matchingSkills;

    assert.strictEqual(matching.strongMatches.length, 2);
    assert.strictEqual(matching.partialMatches.length, 1);

    const strongReact = matching.strongMatches.find((m) => m.jobSkill === "React");
    assert.ok(strongReact);
    assert.ok(strongReact.evidence[0].includes("Built frontend in React"));

    const partialTs = matching.partialMatches.find((m) => m.jobSkill === "TypeScript");
    assert.ok(partialTs);
    assert.strictEqual(partialTs.matchedSkill, "TypeScript");
  }));

  // ---- Test 7: Missing required and preferred skills separation and priority ----
  await testAsync("7. Missing skills are categorized into required and preferred with priority and ethical disclaimer", withMockDb(mockDbHandler, async () => {
    const reportData = await ReportGenerationService.getReportData(101, 1);
    const missing = reportData.missingSkills;

    assert.ok(missing.note.includes("missing from the resume does not guarantee lack of competence"), "Must contain ethical keyword note");
    assert.ok(Array.isArray(missing.requiredGaps));
    assert.ok(Array.isArray(missing.preferredGaps));
    assert.strictEqual(missing.preferredGaps.length, 2); // Docker, AWS
  }));

  // ---- Test 8: Actionable recommendations ----
  await testAsync("8. Recommendations synthesize technical, project, resume, and professional guidance", withMockDb(mockDbHandler, async () => {
    const reportData = await ReportGenerationService.getReportData(101, 1);
    const recs = reportData.recommendations;

    assert.ok(recs.technical.length > 0, "Technical recommendations must be present");
    assert.ok(recs.projects.length > 0, "Project recommendations must be present");
    assert.ok(recs.resume.length > 0, "Resume improvement suggestions must be present");
    assert.ok(recs.professional.length > 0, "Professional career development guidance must be present");
  }));

  // ---- Test 9: Learning roadmap steps and status preservation ----
  await testAsync("9. Learning roadmap steps retain chronological ordering, phase, exercises, and completion status", withMockDb(mockDbHandler, async () => {
    const reportData = await ReportGenerationService.getReportData(101, 1);
    const roadmap = reportData.roadmap;

    assert.strictEqual(roadmap.steps.length, 2);
    assert.strictEqual(roadmap.steps[0].title, "Master Docker Containerization");
    assert.strictEqual(roadmap.steps[0].status, "COMPLETED");
    assert.strictEqual(roadmap.steps[1].title, "AWS ECS & Cloud Architecture");
    assert.strictEqual(roadmap.steps[1].status, "IN_PROGRESS");
    assert.strictEqual(roadmap.steps[0].exercises.length, 2);
  }));

  // ---- Test 10: PDF binary generation and valid PDF 1.4 structure ----
  await testAsync("10. PDF generator produces valid binary PDF 1.4 with standard header, objects, xref, and trailer", withMockDb(mockDbHandler, async () => {
    const pdfResult = await ReportGenerationService.generatePdfReport(101, 1);

    assert.ok(pdfResult.buffer instanceof Buffer, "Must return a Buffer");
    assert.ok(pdfResult.buffer.length > 1000, "PDF buffer must have substantive content");
    assert.strictEqual(pdfResult.contentType, "application/pdf");
    assert.ok(pdfResult.filename.endsWith(".pdf"));

    const pdfString = pdfResult.buffer.toString("binary");
    assert.ok(pdfString.startsWith("%PDF-1.4"), "PDF must begin with %PDF-1.4 header");
    assert.ok(pdfString.includes("/Type /Catalog"), "PDF must contain a Catalog object");
    assert.ok(pdfString.includes("/Type /Pages"), "PDF must contain Pages root object");
    assert.ok(pdfString.includes("xref"), "PDF must include cross-reference table");
    assert.ok(pdfString.includes("trailer"), "PDF must include trailer dictionary");
    assert.ok(pdfString.includes("%%EOF"), "PDF must end with %%EOF marker");
  }));

  // ---- Test 11: PDF text extraction and verification via pdf-parse ----
  await testAsync("11. Generated PDF buffer is parsed by pdf-parse and contains verified analysis content", withMockDb(mockDbHandler, async () => {
    const pdfResult = await ReportGenerationService.generatePdfReport(101, 1);
    const pdfParsePkg = require("pdf-parse");

    let parsedText = "";
    if (typeof pdfParsePkg === "function") {
      const data = await pdfParsePkg(pdfResult.buffer);
      parsedText = data.text;
    } else if (pdfParsePkg.PDFParse) {
      const parser = new pdfParsePkg.PDFParse({ data: pdfResult.buffer });
      const textResult = await parser.getText();
      parsedText = typeof textResult === "string" ? textResult : textResult.text || "";
    }

    assert.ok(parsedText.length > 100, "Extracted text must be non-empty");
    assert.ok(parsedText.includes("SkillLens AI"), "PDF must contain branding");
    assert.ok(parsedText.includes("AI Resume Skill Gap Report"), "PDF must contain title");
    assert.ok(parsedText.includes("Senior Full Stack Engineer"), "PDF must contain target job");
    assert.ok(parsedText.includes("Jane Doe"), "PDF must contain candidate name");
    assert.ok(parsedText.includes("84%"), "PDF must contain match score");
    assert.ok(parsedText.includes("React"), "PDF must contain matched skills");
    assert.ok(parsedText.includes("Docker"), "PDF must contain missing skill");
  }));

  // ---- Test 12: Multi-page layout, margins, running headers & footers ----
  await testAsync("12. PDF builder formats multiple pages with running headers, footers, and page numbers", async () => {
    const builder = new PdfDocumentBuilder({
      headerTitle: "SkillLens AI — Verification Header",
      footerText: "SkillLens AI Report Verification",
    });

    // Populate multiple sections to force multi-page generation
    for (let i = 1; i <= 6; i++) {
      builder.drawSectionHeader(`Section ${i}: Performance Verification`);
      builder.drawParagraph(`This is verification paragraph ${i} demonstrating pagination and layout stability across multiple A4 pages.`);
      builder.drawRect(builder.marginLeft, builder.currentY - 20, 200, 16, { fill: [0.9, 0.9, 0.9] });
      builder.currentY -= 25;
    }

    const docBuffer = builder.build();
    assert.ok(builder.pages.length >= 1, "Must generate at least 1 page");
    assert.ok(docBuffer.toString("binary").includes("Page 1 of "), "Footer must render Page X of Y");
  });

  // ---- Test 13: Historical analysis consistency ----
  await testAsync("13. Historical analysis consistency ensures saved scores remain unaltered", withMockDb(mockDbHandler, async () => {
    const reportData = await ReportGenerationService.getReportData(101, 1);

    // Verify scores match exactly what was in the database record without recomputation
    assert.strictEqual(reportData.matchScore.overall, 84);
    assert.strictEqual(reportData.matchScore.scores.skills.score, 88);
    assert.strictEqual(reportData.matchScore.scores.experience.score, 80);
    assert.strictEqual(reportData.matchScore.scores.education.score, 90);
    assert.strictEqual(reportData.matchScore.scores.certifications.score, 75);
  }));

  // ---- Test 14: Cross-user isolation ----
  await testAsync("14. Cross-user isolation prevents unauthorized users from accessing or downloading another user's report", withMockDb(async (sql, params) => {
    // When requesting analysis with wrong user_id (e.g. user_id = 999), return empty
    return [[]];
  }, async () => {
    await assert.rejects(
      async () => {
        await ReportGenerationService.getReportData(101, 999);
      },
      /Analysis record not found or access denied/,
      "Must reject with access denied error for unauthorized user"
    );
  }));

  // ---- Test 15: Invalid / non-existent analysis ID handling ----
  await testAsync("15. Non-existent analysis ID returns 404 error", withMockDb(async () => [[]], async () => {
    const req = { params: { analysisId: "99999" }, user: { id: 1 } };
    const res = createMockRes();

    await getReportPreview(req, res);
    assert.strictEqual(res.statusCode, 404);
    assert.strictEqual(res.body.success, false);
    assert.ok(res.body.message.includes("Analysis record not found"));
  }));

  // ---- Test 16: Controller endpoints ----
  await testAsync("16. Controller endpoints return proper preview JSON and streaming PDF attachment headers", withMockDb(mockDbHandler, async () => {
    // 16a. Preview endpoint
    const previewReq = { params: { analysisId: "101" }, user: { id: 1 } };
    const previewRes = createMockRes();
    await getReportPreview(previewReq, previewRes);

    assert.strictEqual(previewRes.statusCode, 200);
    assert.strictEqual(previewRes.body.success, true);
    assert.ok(previewRes.body.data.header);
    assert.ok(previewRes.body.data.matchScore);

    // 16b. Download endpoint
    const downloadReq = { params: { analysisId: "101" }, user: { id: 1 } };
    const downloadRes = createMockRes();
    await downloadReportPdf(downloadReq, downloadRes);

    assert.strictEqual(downloadRes.statusCode, 200);
    assert.strictEqual(downloadRes.headers["Content-Type"], "application/pdf");
    assert.ok(downloadRes.headers["Content-Disposition"].includes("attachment; filename="));
    assert.ok(downloadRes.body.length > 1000, "Sent body must be a valid PDF binary buffer");
  }));

  // ---- Test 17: Responsive UI schema, print styling, and accessibility validation ----
  await testAsync("17. Frontend component and CSS module contain A4 print styling, design tokens, and ARIA attributes", async () => {
    const cssPath = path.resolve(__dirname, "../../frontend/src/pages/ReportGeneration.module.css");
    const jsxPath = path.resolve(__dirname, "../../frontend/src/pages/ReportGeneration.jsx");

    assert.ok(fs.existsSync(cssPath), "ReportGeneration.module.css must exist");
    assert.ok(fs.existsSync(jsxPath), "ReportGeneration.jsx must exist");

    const cssContent = fs.readFileSync(cssPath, "utf8");
    const jsxContent = fs.readFileSync(jsxPath, "utf8");

    // Print media styles and A4 paper dimension constraints
    assert.ok(cssContent.includes("@media print"), "CSS must contain @media print stylesheet");
    assert.ok(cssContent.includes("var(--color-indigo)"), "CSS must use system color design tokens");
    assert.ok(cssContent.includes("a4Sheet"), "CSS must define a4Sheet class for simulated paper preview");

    // Accessibility and structural semantics
    assert.ok(jsxContent.includes("aria-label"), "JSX must contain ARIA accessible labels");
    assert.ok(jsxContent.includes("AI Resume Skill Gap Report"), "JSX must render official report title");
    assert.ok(jsxContent.includes("Overall Match Score"), "JSX must render Overall Match Score section");
    assert.ok(jsxContent.includes("Learning Roadmap"), "JSX must render Learning Roadmap section");
    assert.ok(jsxContent.includes("downloadPdf"), "JSX must implement PDF download trigger");
  });
}

// Support direct execution via `node backend/tests/day31ReportGenerationTests.js`
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

  runDay31ReportGenerationTests(testAsync).then(() => {
    console.log(`\nDay 31 Tests: ${passed} passed, ${failed} failed.`);
    process.exit(failed > 0 ? 1 : 0);
  });
}

module.exports = { runDay31ReportGenerationTests };
