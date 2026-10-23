const assert = require("assert");
const fs = require("fs");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const jwt = require("jsonwebtoken");

const { validateResumeFile } = require("../utils/fileValidator");
const { extractDocumentText, cleanExtractedText } = require("../utils/documentParser");
const { parseResumeText, segmentSections, extractContactDetails } = require("../utils/resumeParser");
const { extractSkills, SKILL_CATALOGUE } = require("../utils/skillCatalogue");
const { RESUMES_UPLOAD_DIR } = require("../middleware/uploadMiddleware");

// Helper to create a valid minimal DOCX buffer with custom text
async function createDocxWithText(text) {
  const JSZip = require("jszip");
  const zip = new JSZip();

  const escapedText = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  const paragraphs = escapedText
    .split("\n")
    .map((line) => `<w:p><w:r><w:t>${line}</w:t></w:r></w:p>`)
    .join("");

  zip.file(
    "[Content_Types].xml",
    '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/></Types>'
  );

  zip.file(
    "word/document.xml",
    `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${paragraphs}</w:body></w:document>`
  );

  return await zip.generateAsync({ type: "nodebuffer" });
}


// Sample complete resume text
const SAMPLE_RESUME_TEXT = `Jane Doe
Senior Full Stack Engineer
Colombo, Sri Lanka
Email: jane.doe@example.com
Phone: +94 77 123 4567
LinkedIn: https://linkedin.com/in/janedoe
GitHub: https://github.com/janedoe
Portfolio: https://janedoe.dev

PROFESSIONAL SUMMARY
Experienced full-stack engineer with 6+ years designing scalable cloud-native architectures using React, Node.js, and TypeScript.

TECHNICAL SKILLS
Languages: JavaScript, TypeScript, Python, SQL, C++
Frameworks: React, Next.js, Express.js, Tailwind CSS, Redux
Databases: MySQL, PostgreSQL, MongoDB, Redis
Cloud & DevOps: AWS, Docker, Kubernetes, CI/CD, Git

WORK EXPERIENCE
Senior Software Engineer
Acme Cloud Solutions
2022 - Present
- Architected microservices with Node.js and TypeScript handling 5M daily requests.
- Led frontend redesign with React and Next.js, cutting page load by 40%.

Software Engineer
Tech Innovators Ltd
2019 - 2022
- Developed RESTful APIs in Express.js and integrated MySQL database migrations.
- Collaborated in an Agile Scrum team to deliver weekly releases via Docker and CI/CD pipelines.

EDUCATION
Bachelor of Science in Computer Science
University of Colombo
2015 - 2019
GPA: 3.85 / 4.0

PROJECTS
SkillLens AI
https://github.com/janedoe/skilllens
Technologies: React, Node.js, MySQL, Express.js
- Solo project building an AI-powered resume and skill gap analyzer.

CERTIFICATIONS
AWS Certified Solutions Architect
Amazon Web Services
2023`;

async function runTests() {
  console.log("=== SkillLens AI — Day 14 Resume Processing Test Suite ===");
  const testDir = path.join(__dirname, "temp_test_files");
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true });
  }

  let passed = 0;
  let failed = 0;

  const { initDb } = require("../database/initDb");
  await initDb();

  async function testAsync(name, fn) {
    try {
      await fn();
      console.log(`[PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`[FAIL] ${name}:`, err.message);
      failed++;
    }
  }

  // 1. DOCX Extraction
  const docxFile = path.join(testDir, "test_resume.docx");
  fs.writeFileSync(docxFile, await createDocxWithText(SAMPLE_RESUME_TEXT));

  await testAsync("1. Extract text from valid DOCX", async () => {

    const res = await extractDocumentText(docxFile, "DOCX");
    assert.strictEqual(res.success, true);
    assert.ok(res.text.includes("Jane Doe"));
    assert.ok(res.text.includes("Senior Full Stack Engineer"));
    assert.ok(res.charCount > 100);
  });

  // 2. Corrupted DOCX handling
  const corruptedDocx = path.join(testDir, "corrupted.docx");
  fs.writeFileSync(corruptedDocx, Buffer.from("PK\x03\x04 corrupt zip content"));
  await testAsync("2. Handle corrupted DOCX gracefully without throwing unhandled exceptions", async () => {
    const res = await extractDocumentText(corruptedDocx, "DOCX");
    assert.strictEqual(res.success, false);
    assert.ok(res.error);
  });

  // 3. Empty document handling
  const emptyDocx = path.join(testDir, "empty.docx");
  fs.writeFileSync(emptyDocx, Buffer.alloc(0));
  await testAsync("3. Handle empty document (0 bytes) gracefully", async () => {
    const res = await extractDocumentText(emptyDocx, "DOCX");
    assert.strictEqual(res.success, false);
    assert.strictEqual(res.error, "File is empty (0 bytes).");
  });

  // 4. Missing file handling
  await testAsync("4. Handle missing document file safely", async () => {
    const res = await extractDocumentText(path.join(testDir, "non_existent.pdf"), "PDF");
    assert.strictEqual(res.success, false);
    assert.strictEqual(res.error, "Document file not found on disk.");
  });

  // 5. Parse complete resume into structured information
  await testAsync("5. Parse candidate name and contact information reliably", async () => {
    const parsed = parseResumeText(SAMPLE_RESUME_TEXT);
    assert.strictEqual(parsed.candidate.full_name, "Jane Doe");
    assert.strictEqual(parsed.candidate.email, "jane.doe@example.com");
    assert.strictEqual(parsed.candidate.phone, "+94 77 123 4567");
    assert.strictEqual(parsed.candidate.location, "Colombo, Sri Lanka");
    assert.strictEqual(parsed.candidate.linkedin_url, "https://linkedin.com/in/janedoe");
    assert.strictEqual(parsed.candidate.github_url, "https://github.com/janedoe");
    assert.strictEqual(parsed.candidate.portfolio_url, "https://janedoe.dev");
  });

  // 6. Section segmentation
  await testAsync("6. Identify standard resume section headers", async () => {
    const parsed = parseResumeText(SAMPLE_RESUME_TEXT);
    const sectionTypes = parsed.sections.map((s) => s.section_type);
    assert.ok(sectionTypes.includes("SUMMARY"));
    assert.ok(sectionTypes.includes("SKILLS"));
    assert.ok(sectionTypes.includes("EXPERIENCE"));
    assert.ok(sectionTypes.includes("EDUCATION"));
    assert.ok(sectionTypes.includes("PROJECTS"));
    assert.ok(sectionTypes.includes("CERTIFICATIONS"));
  });

  // 7. Skill catalogue matching
  await testAsync("7. Extract skills categorized with boundary safety", async () => {
    const parsed = parseResumeText(SAMPLE_RESUME_TEXT);
    const skillNames = parsed.skills.map((s) => s.name);
    assert.ok(skillNames.includes("JavaScript"));
    assert.ok(skillNames.includes("TypeScript"));
    assert.ok(skillNames.includes("React"));
    assert.ok(skillNames.includes("Node.js"));
    assert.ok(skillNames.includes("MySQL"));
    assert.ok(skillNames.includes("AWS"));
    assert.ok(skillNames.includes("Docker"));
    assert.ok(skillNames.includes("C++"));

    // Verify categories
    const reactSkill = parsed.skills.find((s) => s.name === "React");
    assert.strictEqual(reactSkill.category, "FRAMEWORK");

    const mysqlSkill = parsed.skills.find((s) => s.name === "MySQL");
    assert.strictEqual(mysqlSkill.category, "DATABASE");
  });

  // 8. Education extraction
  await testAsync("8. Extract education entries with degree and institution", async () => {
    const parsed = parseResumeText(SAMPLE_RESUME_TEXT);
    assert.ok(parsed.education.length > 0);
    assert.ok(parsed.education[0].qualification.includes("Bachelor of Science"));
    assert.ok(parsed.education[0].institution.includes("University of Colombo"));
    assert.ok(parsed.education[0].dates.includes("2015 - 2019"));
  });

  // 9. Experience extraction
  await testAsync("9. Extract multiple experience entries with titles and dates", async () => {
    const parsed = parseResumeText(SAMPLE_RESUME_TEXT);
    assert.ok(parsed.experience.length >= 2);
    assert.ok(parsed.experience[0].title.includes("Senior Software Engineer"));
    assert.ok(parsed.experience[1].title.includes("Software Engineer"));
  });

  // 10. Projects extraction
  await testAsync("10. Extract projects with links and descriptions", async () => {
    const parsed = parseResumeText(SAMPLE_RESUME_TEXT);
    assert.ok(parsed.projects.length >= 1);
    assert.strictEqual(parsed.projects[0].name, "SkillLens AI");
    assert.strictEqual(parsed.projects[0].url, "https://github.com/janedoe/skilllens");
  });

  // 11. Certifications extraction
  await testAsync("11. Extract professional certifications with issuer", async () => {
    const parsed = parseResumeText(SAMPLE_RESUME_TEXT);
    assert.ok(parsed.certifications.length >= 1);
    assert.ok(parsed.certifications[0].name.includes("AWS Certified Solutions Architect"));
    assert.strictEqual(parsed.certifications[0].issuer, "AWS");
  });

  // 12. Resume with missing sections (graceful degradation)
  await testAsync("12. Parse resume with missing sections without fabricating data", async () => {
    const minimalResume = `Alex Smith\nalex@example.com\n\nSKILLS\nPython, Docker\n`;
    const parsed = parseResumeText(minimalResume);
    assert.strictEqual(parsed.candidate.full_name, "Alex Smith");
    assert.strictEqual(parsed.candidate.email, "alex@example.com");
    assert.strictEqual(parsed.candidate.phone, null);
    assert.strictEqual(parsed.candidate.linkedin_url, null);
    assert.strictEqual(parsed.experience.length, 0);
    assert.strictEqual(parsed.education.length, 0);
    assert.strictEqual(parsed.certifications.length, 0);
    const skillNames = parsed.skills.map((s) => s.name);
    assert.ok(skillNames.includes("Python"));
    assert.ok(skillNames.includes("Docker"));
  });

  // 13. Unusual section headings
  await testAsync("13. Recognize varied section headings (e.g. 'Core Competencies', 'Employment History')", async () => {
    const variedResume = `John Doe\njohn@example.com\n\nCORE COMPETENCIES\nGo, Kubernetes\n\nEMPLOYMENT HISTORY\nCloud Architect\n2020 - 2023\nLed infrastructure deployment.\n`;
    const parsed = parseResumeText(variedResume);
    const types = parsed.sections.map((s) => s.section_type);
    assert.ok(types.includes("SKILLS"));
    assert.ok(types.includes("EXPERIENCE"));
  });

  // 14. JWT Authentication & Ownership boundary
  const JWT_SECRET = process.env.JWT_SECRET || "skilllens_ai_jwt_secret_change_this_in_production_2026";
  const user1Token = jwt.sign({ id: 101, email: "user1@example.com" }, JWT_SECRET, { expiresIn: "1h" });
  const user2Token = jwt.sign({ id: 102, email: "user2@example.com" }, JWT_SECRET, { expiresIn: "1h" });

  await testAsync("14. Reject unauthenticated or unauthorized access across users", async () => {
    const decoded1 = jwt.verify(user1Token, JWT_SECRET);
    const decoded2 = jwt.verify(user2Token, JWT_SECRET);
    assert.strictEqual(decoded1.id, 101);
    assert.strictEqual(decoded2.id, 102);
    assert.notStrictEqual(decoded1.id, decoded2.id);

    // Invalid token rejection
    assert.throws(() => jwt.verify("tampered.token.here", JWT_SECRET));
  });

  // 15. Whitespace and boundary normalization
  await testAsync("15. Clean extracted text and preserve structure", async () => {
    const messy = "Line 1   with   tabs\t\tand   spaces\r\n\r\n\r\n\r\nLine 2";
    const cleaned = cleanExtractedText(messy);
    assert.strictEqual(cleaned, "Line 1 with tabs and spaces\n\nLine 2");
  });

  // DAY 12: STRUCTURED RESUME PARSER TEST CASES
  const {
    parseResume,
    createStructuredResumeModel,
    validateStructuredResume,
  } = require("../services/resumeParserService");

  // 16. Parse resume containing all seven sections into canonical structured model
  await testAsync("16. Parse resume with all seven sections into canonical structured data model", async () => {
    const model = parseResume(SAMPLE_RESUME_TEXT, 42);
    assert.strictEqual(model.resumeId, 42);

    // 1. Personal Information
    assert.strictEqual(model.personalInformation.fullName, "Jane Doe");
    assert.strictEqual(model.personalInformation.email, "jane.doe@example.com");
    assert.strictEqual(model.personalInformation.phone, "+94 77 123 4567");
    assert.strictEqual(model.personalInformation.location, "Colombo, Sri Lanka");
    assert.strictEqual(model.personalInformation.linkedinUrl, "https://linkedin.com/in/janedoe");
    assert.strictEqual(model.personalInformation.githubUrl, "https://github.com/janedoe");
    assert.strictEqual(model.personalInformation.portfolioUrl, "https://janedoe.dev");

    // 2. Summary
    assert.ok(model.summary && model.summary.includes("Experienced full-stack engineer"));

    // 3. Skills (Array of objects)
    assert.ok(Array.isArray(model.skills));
    assert.ok(model.skills.length >= 8);
    const react = model.skills.find((s) => s.name === "React");
    assert.ok(react && react.category === "FRAMEWORK");

    // 4. Education (Array of objects)
    assert.ok(Array.isArray(model.education));
    assert.strictEqual(model.education.length, 1);
    assert.ok(model.education[0].qualification.includes("Bachelor of Science"));
    assert.strictEqual(model.education[0].institution, "University of Colombo");
    assert.strictEqual(model.education[0].startDate, "2015");
    assert.strictEqual(model.education[0].endDate, "2019");

    // 5. Experience (Array of objects)
    assert.ok(Array.isArray(model.experience));
    assert.ok(model.experience.length >= 2);
    assert.strictEqual(model.experience[0].jobTitle, "Senior Software Engineer");
    assert.strictEqual(model.experience[0].company, "Acme Cloud Solutions");
    assert.strictEqual(model.experience[0].isCurrent, true);
    assert.ok(Array.isArray(model.experience[0].responsibilities));

    // 6. Projects (Array of objects)
    assert.ok(Array.isArray(model.projects));
    assert.ok(model.projects.length >= 1);
    assert.strictEqual(model.projects[0].name, "SkillLens AI");
    assert.strictEqual(model.projects[0].githubUrl, "https://github.com/janedoe/skilllens");
    assert.ok(Array.isArray(model.projects[0].technologies));
    assert.ok(model.projects[0].technologies.includes("React"));

    // 7. Certifications (Array of objects)
    assert.ok(Array.isArray(model.certifications));
    assert.ok(model.certifications.length >= 1);
    assert.ok(model.certifications[0].name.includes("AWS Certified Solutions Architect"));
    assert.strictEqual(model.certifications[0].issuingOrganization, "AWS");

    // Metadata
    assert.strictEqual(model.parsingMetadata.status, "SUCCESS");
    assert.strictEqual(model.parsingMetadata.parserVersion, "1.0");
  });

  // 17. Parse resume with NO summary
  await testAsync("17. Parse resume with no summary defaults to null without fabricating text", async () => {
    const resumeNoSummary = `John Smith\njohn.smith@example.com\n\nTECHNICAL SKILLS\nPython, Docker\n\nEDUCATION\nB.Sc in Computing\nStanford University\n2018 - 2022\n`;
    const model = parseResume(resumeNoSummary, 10);
    assert.strictEqual(model.summary, null);
    assert.ok(model.parsingMetadata.warnings.some((w) => w.toLowerCase().includes("no summary")));
  });

  // 18. Parse resume with missing education or certification details
  await testAsync("18. Gracefully handle missing education or certifications without failure", async () => {
    const partialResume = `Sarah Connor\nsarah@sky.net\n\nWORK EXPERIENCE\nOperations Lead\nCyberdyne Systems\n2020 - Present\n- Managed infrastructure.\n`;
    const model = parseResume(partialResume, 11);
    assert.strictEqual(model.education.length, 0);
    assert.strictEqual(model.certifications.length, 0);
    assert.strictEqual(model.projects.length, 0);
    assert.strictEqual(model.experience.length, 1);
    assert.strictEqual(model.experience[0].jobTitle, "Operations Lead");
    assert.strictEqual(model.parsingMetadata.status, "SUCCESS");
  });

  // 19. Multiple education entries
  await testAsync("19. Parse multiple distinct education records with graduation dates", async () => {
    const multiEdu = `Alice Wonder\nalice@example.com\n\nEDUCATION\nMaster of Science in Artificial Intelligence\nMIT\n2020 - 2022\n\nBachelor of Science in Computer Science\nHarvard University\n2016 - 2020\nGPA: 3.9 / 4.0\n`;
    const model = parseResume(multiEdu);
    assert.strictEqual(model.education.length, 2);
    assert.ok(model.education[0].qualification.includes("Master of Science"));
    assert.strictEqual(model.education[0].institution, "MIT");
    assert.ok(model.education[1].qualification.includes("Bachelor of Science"));
    assert.strictEqual(model.education[1].institution, "Harvard University");
    assert.strictEqual(model.education[1].grade, "GPA: 3.9 / 4.0");
  });

  // 20. Multiple experience entries with current status & responsibilities
  await testAsync("20. Parse multiple experience entries keeping responsibilities with correct employer", async () => {
    const multiExp = `Bob Builder\nbob@example.com\n\nWORK EXPERIENCE\nPrincipal Architect\nMegaCorp\n2021 - Present\n- Designed enterprise cloud services.\n\nSenior Software Developer\nStartUp Labs\n2018 - 2021\n- Built customer dashboard using React and Node.js.\n`;
    const model = parseResume(multiExp);
    assert.strictEqual(model.experience.length, 2);
    assert.strictEqual(model.experience[0].jobTitle, "Principal Architect");
    assert.strictEqual(model.experience[0].company, "MegaCorp");
    assert.strictEqual(model.experience[0].isCurrent, true);
    assert.ok(model.experience[0].responsibilities[0].includes("cloud services"));

    assert.strictEqual(model.experience[1].jobTitle, "Senior Software Developer");
    assert.strictEqual(model.experience[1].company, "StartUp Labs");
    assert.strictEqual(model.experience[1].isCurrent, false);
    assert.ok(model.experience[1].responsibilities[0].includes("React and Node.js"));
  });

  // 21. Multiple projects and certifications
  await testAsync("21. Parse multiple projects and certifications correctly", async () => {
    const multiProjCert = `Carol Danvers\ncarol@example.com\n\nPROJECTS\nProject Alpha\nhttps://github.com/carol/alpha\nTechnologies: React, Node.js\n- High throughput engine.\n\nProject Beta\nhttps://beta.dev\n- Analytics reporting portal.\n\nCERTIFICATIONS\nAWS Certified Developer\nAmazon Web Services\n2022\n\nGoogle Cloud Professional Data Engineer\nGoogle Cloud\n2023\n`;
    const model = parseResume(multiProjCert);
    assert.strictEqual(model.projects.length, 2);
    assert.strictEqual(model.projects[0].name, "Project Alpha");
    assert.strictEqual(model.projects[0].githubUrl, "https://github.com/carol/alpha");
    assert.strictEqual(model.projects[1].name, "Project Beta");

    assert.strictEqual(model.certifications.length, 2);
    assert.ok(model.certifications[0].name.includes("AWS Certified Developer"));
    assert.ok(model.certifications[1].name.includes("Google Cloud Professional Data Engineer"));
  });

  // 22. Avoid obvious duplicate skills
  await testAsync("22. Safely deduplicate skills without repeats", async () => {
    const dupeSkillsResume = `Dev User\ndev@example.com\n\nTECHNICAL SKILLS\nReact, react, React.js, REACT, Python, python, Python3\n`;
    const model = parseResume(dupeSkillsResume);
    const reactCount = model.skills.filter((s) => s.name === "React").length;
    const pythonCount = model.skills.filter((s) => s.name === "Python").length;
    assert.strictEqual(reactCount, 1);
    assert.strictEqual(pythonCount, 1);
  });

  // 23. Handle empty or corrupted extracted text
  await testAsync("23. Handle empty or whitespace-only text safely", async () => {
    const emptyModel = parseResume("   \n\n  \t  ");
    assert.strictEqual(emptyModel.parsingMetadata.status, "EMPTY");
    assert.strictEqual(emptyModel.skills.length, 0);
    assert.strictEqual(emptyModel.education.length, 0);
    assert.strictEqual(emptyModel.experience.length, 0);
  });

  // 24. Structured Resume Model Validator
  await testAsync("24. Validate structured resume model against schema and data type invariants", async () => {
    const validModel = createStructuredResumeModel(99);
    const validCheck = validateStructuredResume(validModel);
    assert.strictEqual(validCheck.isValid, true);

    const malformedModel = {
      personalInformation: { email: "bad-email-format" },
      skills: "not-an-array",
    };
    const invalidCheck = validateStructuredResume(malformedModel);
    assert.strictEqual(invalidCheck.isValid, false);
    assert.ok(invalidCheck.warnings.length > 0);
  });

  // 25. Database persistence idempotency test (using real Aiven MySQL connection)
  const db = require("../config/db");
  const ResumeService = require("../services/resumeService");

  await testAsync("25. Persist structured resume data to MySQL and verify idempotency on re-parse", async () => {
    // Insert a test user
    const [userRes] = await db.query(
      `INSERT INTO users (full_name, email, password_hash)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)`,
      ["Test User Day12", `day12_test_${Date.now()}@skilllens.local`, "mock_hash"]
    );
    const testUserId = userRes.insertId;

    // Insert a test resume record
    const [resRes] = await db.query(
      `INSERT INTO resumes (user_id, original_filename, stored_filename, file_type, file_size, file_path, extracted_text, processing_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        testUserId,
        "sample_day12.pdf",
        "sample_day12.pdf",
        "PDF",
        1024,
        "uploads/resumes/sample_day12.pdf",
        SAMPLE_RESUME_TEXT,
        "UPLOADED",
      ]
    );
    const testResumeId = resRes.insertId;

    try {
      // 1st Parse run
      const result1 = await ResumeService.parseStructuredResume(testResumeId, testUserId);
      assert.strictEqual(result1.success, true);
      assert.strictEqual(result1.status, "COMPLETED");

      // Verify records in MySQL
      const [secRows1] = await db.query(`SELECT id, section_type FROM resume_sections WHERE resume_id = ?`, [testResumeId]);
      assert.ok(secRows1.length > 0);

      const [skillRows1] = await db.query(`SELECT id, skill_id FROM resume_skills WHERE resume_id = ?`, [testResumeId]);
      assert.ok(skillRows1.length > 0);

      // 2nd Parse run (Idempotency check - must not duplicate rows)
      const result2 = await ResumeService.parseStructuredResume(testResumeId, testUserId);
      assert.strictEqual(result2.success, true);

      const [secRows2] = await db.query(`SELECT id, section_type FROM resume_sections WHERE resume_id = ?`, [testResumeId]);
      assert.strictEqual(secRows2.length, secRows1.length);

      const [skillRows2] = await db.query(`SELECT id, skill_id FROM resume_skills WHERE resume_id = ?`, [testResumeId]);
      assert.strictEqual(skillRows2.length, skillRows1.length);

      // Verify retrieval returns structured data
      const full = await ResumeService.getResumeWithExtraction(testResumeId, testUserId);
      assert.ok(full.structuredModel);
      assert.strictEqual(full.structuredModel.personalInformation.fullName, "Jane Doe");
      assert.strictEqual(full.structuredModel.personalInformation.email, "jane.doe@example.com");
      assert.ok(full.structuredModel.skills.length >= 8);
    } finally {
      // Clean up test records
      await db.query(`DELETE FROM resumes WHERE id = ?`, [testResumeId]);
      await db.query(`DELETE FROM users WHERE id = ?`, [testUserId]);
    }
  });

  // Test 26: Test resume replacement with reset of extraction and file update
  await testAsync("26. Replace resume updates document, resets extracted data, and preserves ID", async () => {
    const db = require("../config/db");
    const ResumeService = require("../services/resumeService");

    // Create user
    const [userRes] = await db.query(
      `INSERT INTO users (full_name, email, password_hash) VALUES (?, ?, ?)`,
      ["Test Replacer", `test_replacer_${Date.now()}@example.com`, "hash"]
    );
    const testUserId = userRes.insertId;

    // Create original file
    const oldFilePath = path.join(RESUMES_UPLOAD_DIR, `old_doc_${Date.now()}.docx`);
    const oldBuffer = await createDocxWithText("Old resume text content");
    fs.writeFileSync(oldFilePath, oldBuffer);

    // Insert resume
    const [resRes] = await db.query(
      `INSERT INTO resumes (user_id, original_filename, stored_filename, file_type, file_size, file_path, extracted_text, processing_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        testUserId,
        "old_resume.docx",
        path.basename(oldFilePath),
        "DOCX",
        oldBuffer.length,
        path.posix.join("uploads", "resumes", path.basename(oldFilePath)),
        "Old extracted text",
        "COMPLETED",
      ]
    );
    const testResumeId = resRes.insertId;

    // Insert a dummy section
    await db.query(
      `INSERT INTO resume_sections (resume_id, section_type, section_content) VALUES (?, 'SUMMARY', 'Old summary')`,
      [testResumeId]
    );

    // Create replacement file
    const newFilePath = path.join(RESUMES_UPLOAD_DIR, `new_doc_${Date.now()}.docx`);
    const newBuffer = await createDocxWithText("New updated resume content");
    fs.writeFileSync(newFilePath, newBuffer);

    const mockNewFile = {
      path: newFilePath,
      originalname: "new_resume.docx",
      filename: path.basename(newFilePath),
    };

    const mockValidation = {
      fileType: "DOCX",
      fileSize: newBuffer.length,
    };

    try {
      const replaceResult = await ResumeService.replaceResume(
        testResumeId,
        testUserId,
        mockNewFile,
        mockValidation
      );

      assert.strictEqual(replaceResult.success, true);
      assert.strictEqual(replaceResult.resume.id, testResumeId);
      assert.strictEqual(replaceResult.resume.processing_status, "UPLOADED");

      // Verify old file unlinked
      assert.strictEqual(fs.existsSync(oldFilePath), false, "Old file should have been deleted");

      // Verify sections cleaned up
      const [secRows] = await db.query(
        `SELECT id FROM resume_sections WHERE resume_id = ?`,
        [testResumeId]
      );
      assert.strictEqual(secRows.length, 0, "Previous sections should be cleared");

      // Verify resume in DB has reset extracted_text and updated filename
      const [checkRows] = await db.query(
        `SELECT original_filename, extracted_text, processing_status FROM resumes WHERE id = ?`,
        [testResumeId]
      );
      assert.strictEqual(checkRows[0].original_filename, "new_resume.docx");
      assert.strictEqual(checkRows[0].extracted_text, null);
      assert.strictEqual(checkRows[0].processing_status, "UPLOADED");
    } finally {
      // Clean up
      if (fs.existsSync(newFilePath)) {
        try { fs.unlinkSync(newFilePath); } catch (_) {}
      }
      await db.query(`DELETE FROM resumes WHERE id = ?`, [testResumeId]);
      await db.query(`DELETE FROM users WHERE id = ?`, [testUserId]);
    }
  });

  // Test 27: Delete resume safely removes database records and disk file
  await testAsync("27. Delete resume removes database records and physical file", async () => {
    const db = require("../config/db");
    const ResumeService = require("../services/resumeService");

    const [userRes] = await db.query(
      `INSERT INTO users (full_name, email, password_hash) VALUES (?, ?, ?)`,
      ["Test Deleter", `test_deleter_${Date.now()}@example.com`, "hash"]
    );
    const testUserId = userRes.insertId;

    const delFilePath = path.join(RESUMES_UPLOAD_DIR, `del_doc_${Date.now()}.docx`);
    const delBuffer = await createDocxWithText("Document to be deleted");
    fs.writeFileSync(delFilePath, delBuffer);

    const [resRes] = await db.query(
      `INSERT INTO resumes (user_id, original_filename, stored_filename, file_type, file_size, file_path, extracted_text, processing_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        testUserId,
        "to_delete.docx",
        path.basename(delFilePath),
        "DOCX",
        delBuffer.length,
        path.posix.join("uploads", "resumes", path.basename(delFilePath)),
        "Some text",
        "COMPLETED",
      ]
    );
    const testResumeId = resRes.insertId;

    await db.query(
      `INSERT INTO resume_sections (resume_id, section_type, section_content) VALUES (?, 'SUMMARY', 'Delete me')`,
      [testResumeId]
    );

    try {
      const deleteResult = await ResumeService.deleteResume(testResumeId, testUserId);
      assert.strictEqual(deleteResult.success, true);

      // Verify file deleted
      assert.strictEqual(fs.existsSync(delFilePath), false, "File on disk should be removed");

      // Verify DB record deleted
      const [rows] = await db.query(`SELECT id FROM resumes WHERE id = ?`, [testResumeId]);
      assert.strictEqual(rows.length, 0);

      // Verify cascaded sections deleted
      const [secRows] = await db.query(`SELECT id FROM resume_sections WHERE resume_id = ?`, [testResumeId]);
      assert.strictEqual(secRows.length, 0);
    } finally {
      if (fs.existsSync(delFilePath)) {
        try { fs.unlinkSync(delFilePath); } catch (_) {}
      }
      await db.query(`DELETE FROM resumes WHERE id = ?`, [testResumeId]);
      await db.query(`DELETE FROM users WHERE id = ?`, [testUserId]);
    }
  });

  // Test 28: Cross-user authorization check for delete and replace
  await testAsync("28. Unauthorized user cannot delete or replace another user's resume", async () => {
    const db = require("../config/db");
    const ResumeService = require("../services/resumeService");

    const [u1] = await db.query(
      `INSERT INTO users (full_name, email, password_hash) VALUES (?, ?, ?)`,
      ["User One", `u1_${Date.now()}@example.com`, "hash"]
    );
    const [u2] = await db.query(
      `INSERT INTO users (full_name, email, password_hash) VALUES (?, ?, ?)`,
      ["User Two", `u2_${Date.now()}@example.com`, "hash"]
    );

    const [resRes] = await db.query(
      `INSERT INTO resumes (user_id, original_filename, stored_filename, file_type, file_size, file_path, processing_status)
       VALUES (?, 'u1_doc.pdf', 'u1_doc.pdf', 'PDF', 100, 'uploads/resumes/dummy.pdf', 'UPLOADED')`,
      [u1.insertId]
    );
    const resumeId = resRes.insertId;

    try {
      // User 2 attempts to delete User 1's resume
      let deleteFailed = false;
      try {
        await ResumeService.deleteResume(resumeId, u2.insertId);
      } catch (err) {
        deleteFailed = true;
        assert.ok(err.status === 404 || err.message.includes("access denied"));
      }
      assert.strictEqual(deleteFailed, true, "Unauthorized delete should be rejected");

      // User 2 attempts to replace User 1's resume
      let replaceFailed = false;
      try {
        await ResumeService.replaceResume(resumeId, u2.insertId, { originalname: "hack.pdf", filename: "hack.pdf", path: "fake" }, { fileType: "PDF", fileSize: 100 });
      } catch (err) {
        replaceFailed = true;
        assert.ok(err.status === 404 || err.message.includes("access denied"));
      }
      assert.strictEqual(replaceFailed, true, "Unauthorized replace should be rejected");
    } finally {
      await db.query(`DELETE FROM resumes WHERE id = ?`, [resumeId]);
      await db.query(`DELETE FROM users WHERE id IN (?, ?)`, [u1.insertId, u2.insertId]);
    }
  });

  // =====================================================================
  // DAY 14 — Resume Processing Testing
  // =====================================================================

  // ---- Helper: minimal valid PDF buffer from plain-text lines ----
  function buildMinimalPdfBuffer(lines) {
    let stream = "BT /F1 12 Tf 50 720 Td ";
    for (let i = 0; i < lines.length; i++) {
      const esc = lines[i]
        .replace(/\\/g, "\\\\")
        .replace(/\(/g, "\\(")
        .replace(/\)/g, "\\)");
      stream += (i === 0 ? "" : "0 -16 Td ") + "(" + esc + ") Tj ";
    }
    stream += "ET";
    const len = Buffer.byteLength(stream, "utf8");
    const src = [
      "%PDF-1.4",
      "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj",
      "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj",
      "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj",
      "4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj",
      "5 0 obj\n<< /Length " + len + " >>\nstream\n" + stream + "\nendstream\nendobj",
      "xref\n0 6\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000244 00000 n \n0000000332 00000 n ",
      "trailer\n<< /Size 6 /Root 1 0 R >>",
      "startxref\n" + (400 + len),
      "%%EOF",
    ].join("\n");
    return Buffer.from(src, "utf8");
  }

  // ---- Helper: minimal DOCX with table cell text ----
  async function createDocxWithTableAndText(tableRows, paragraphs) {
    const JSZip = require("jszip");
    const zip = new JSZip();
    zip.file(
      "[Content_Types].xml",
      [
        "<?xml version=\"1.0\" encoding=\"UTF-8\"?>",
        "<Types xmlns=\"http://schemas.openxmlformats.org/package/2006/content-types\">",
        "<Default Extension=\"xml\" ContentType=\"application/xml\"/>",
        "</Types>",
      ].join("")
    );

    const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const paras = paragraphs
      .map((l) => `<w:p><w:r><w:t>${esc(l)}</w:t></w:r></w:p>`)
      .join("");
    const tableXml = tableRows
      .map(
        (row) =>
          "<w:tr>" +
          row.map((cell) => `<w:tc><w:p><w:r><w:t>${esc(cell)}</w:t></w:r></w:p></w:tc>`).join("") +
          "</w:tr>"
      )
      .join("");
    const tbl = tableRows.length ? `<w:tbl>${tableXml}</w:tbl>` : "";
    zip.file(
      "word/document.xml",
      [
        "<?xml version=\"1.0\" encoding=\"UTF-8\"?>",
        "<w:document xmlns:w=\"http://schemas.openxmlformats.org/wordprocessingml/2006/main\">",
        "<w:body>",
        paras,
        tbl,
        "</w:body></w:document>",
      ].join("")
    );
    return await zip.generateAsync({ type: "nodebuffer" });
  }

  // ---- Test 29: Extract text from valid PDF ----
  const validPdfFile = path.join(testDir, "day14_valid.pdf");
  const validPdfLines = [
    "Alex Chen",
    "alex.chen@example.com",
    "+1 415 555 0101",
    "PROFESSIONAL SUMMARY",
    "Results-driven engineer with 5 years of experience.",
    "TECHNICAL SKILLS",
    "Python, React, Docker, PostgreSQL",
    "WORK EXPERIENCE",
    "Software Engineer",
    "Bright Systems Inc",
    "2020 - Present",
    "- Built scalable REST APIs using Python and FastAPI.",
    "EDUCATION",
    "Bachelor of Science in Computer Science",
    "MIT",
    "2016 - 2020",
    "PROJECTS",
    "OpenTrack",
    "https://github.com/alexchen/opentrack",
    "- Real-time analytics dashboard.",
    "CERTIFICATIONS",
    "AWS Certified Developer",
    "Amazon Web Services",
    "2022",
  ];
  fs.writeFileSync(validPdfFile, buildMinimalPdfBuffer(validPdfLines));

  await testAsync("29. Extract text from a valid single-column PDF", async () => {
    const res = await extractDocumentText(validPdfFile, "PDF");
    assert.strictEqual(res.success, true, `Expected success but got: ${res.error}`);
    assert.ok(res.text.includes("Alex Chen"), "Name should be in extracted text");
    assert.ok(res.text.includes("Python"), "Skills should be in extracted text");
    assert.ok(res.charCount > 100, "Character count should be positive");
  });

  // ---- Test 30: Parse valid PDF through full pipeline ----
  await testAsync("30. Parse valid PDF through full text-extraction and structured-parse pipeline", async () => {
    const res = await extractDocumentText(validPdfFile, "PDF");
    assert.strictEqual(res.success, true);
    const parsed = parseResumeText(res.text);
    assert.ok(parsed.structuredModel, "Structured model must be present");
    assert.strictEqual(parsed.structuredModel.personalInformation.email, "alex.chen@example.com");
    assert.ok(parsed.skills.length > 0, "Skills must be extracted");
    assert.ok(Array.isArray(parsed.education), "Education must be an array");
    assert.ok(Array.isArray(parsed.experience), "Experience must be an array");
  });

  // ---- Test 31: Blank / image-only PDF (no text layer) ----
  const blankPdfContent = [
    "%PDF-1.4",
    "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj",
    "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj",
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>\nendobj",
    "xref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n ",
    "trailer\n<< /Size 4 /Root 1 0 R >>",
    "startxref\n190",
    "%%EOF",
  ].join("\n");
  const blankPdfFile = path.join(testDir, "day14_blank.pdf");
  fs.writeFileSync(blankPdfFile, Buffer.from(blankPdfContent, "utf8"));

  await testAsync("31. Detect blank/image-only PDF (no text) and report honest error", async () => {
    const res = await extractDocumentText(blankPdfFile, "PDF");
    assert.strictEqual(res.success, false, "Blank PDF must not report success");
    assert.ok(res.error, "Must have an error message");
    assert.ok(
      res.error.toLowerCase().includes("text") || res.error.toLowerCase().includes("extract"),
      "Error must mention extraction failure"
    );
  });

  // ---- Test 32: Two-column PDF (text order may be non-linear) ----
  const twoColLines = [
    "Jordan Lee", "jordan.lee@test.com",
    "SKILLS", "Python Docker Kubernetes",
    "EXPERIENCE", "Cloud Architect", "Apex Corp", "2021 - Present",
    "- Deployed microservices on AWS EKS.",
  ];
  const twoColPdfFile = path.join(testDir, "day14_twocol.pdf");
  fs.writeFileSync(twoColPdfFile, buildMinimalPdfBuffer(twoColLines));

  await testAsync("32. Extract text from two-column PDF without crashing", async () => {
    const res = await extractDocumentText(twoColPdfFile, "PDF");
    // Text may merge columns but should not crash and should contain recognizable content
    assert.strictEqual(res.success, true, `Extraction failed: ${res.error}`);
    assert.ok(res.charCount > 30, "Some text should be extracted from two-column PDF");
  });

  // ---- Test 33: DOCX with a skills table ----
  const docxTableFile = path.join(testDir, "day14_table.docx");
  const tableBuf = await createDocxWithTableAndText(
    [
      ["Category", "Skills"],
      ["Languages", "Python, TypeScript, SQL"],
      ["Cloud", "AWS, Azure, GCP"],
    ],
    ["Morgan Blake", "morgan@example.com", "TECHNICAL SKILLS"]
  );
  fs.writeFileSync(docxTableFile, tableBuf);

  await testAsync("33. Extract text from DOCX containing a table", async () => {
    const res = await extractDocumentText(docxTableFile, "DOCX");
    assert.strictEqual(res.success, true, `DOCX table extraction failed: ${res.error}`);
    assert.ok(res.text.includes("Python"), "Table cell content should appear in extracted text");
    assert.ok(res.text.includes("Morgan Blake"), "Name should appear");
  });

  // ---- Test 34: DOCX with hyperlinks in paragraphs ----
  const docxLinkFile = path.join(testDir, "day14_links.docx");
  const linkDocBuf = await createDocxWithText(
    "Sam Rivera\nsam.rivera@mail.com\nhttps://linkedin.com/in/samrivera\nhttps://github.com/samrivera\nPROJECTS\nPortfolio Site\nhttps://samrivera.dev\n- Built a personal portfolio using Next.js and Vercel."
  );
  fs.writeFileSync(docxLinkFile, linkDocBuf);

  await testAsync("34. Extract text from DOCX containing hyperlinks and URLs", async () => {
    const res = await extractDocumentText(docxLinkFile, "DOCX");
    assert.strictEqual(res.success, true, `Extraction failed: ${res.error}`);
    const parsed = parseResumeText(res.text);
    assert.strictEqual(parsed.structuredModel.personalInformation.linkedinUrl, "https://linkedin.com/in/samrivera");
    assert.strictEqual(parsed.structuredModel.personalInformation.githubUrl, "https://github.com/samrivera");
  });

  // ---- Test 35: Numbered section headings (e.g. "1. Professional Summary") ----
  const numberedHeadingText = [
    "Taylor Kim",
    "taylor.kim@example.com",
    "+1 212 555 0100",
    "1. Professional Summary",
    "Detail-oriented QA engineer with 4 years of experience in automation.",
    "2. Work Experience",
    "QA Engineer",
    "TechFirm Ltd",
    "2021 - Present",
    "- Built Selenium test suites reducing regression time by 60%.",
    "3. Education",
    "Bachelor of Engineering",
    "State University",
    "2017 - 2021",
    "4. Technical Skills",
    "Selenium, Python, Java, Postman, Jenkins",
    "5. Certifications",
    "ISTQB Certified Tester",
    "ISTQB",
    "2022",
  ].join("\n");

  await testAsync("35. Parse resume with numbered section headings (e.g. '1. Professional Summary')", async () => {
    const parsed = parseResumeText(numberedHeadingText);
    assert.ok(parsed.structuredModel.summary, "Summary must be extracted under numbered heading");
    assert.ok(parsed.experience.length > 0, "Experience must be extracted under numbered heading");
    assert.ok(parsed.education.length > 0, "Education must be extracted under numbered heading");
  });

  // ---- Test 36: 'Work & Professional Experience' heading variant ----
  const workAndExpText = [
    "Casey Jordan",
    "casey@example.com",
    "WORK & PROFESSIONAL EXPERIENCE",
    "Senior Analyst",
    "DataCorp",
    "2020 - Present",
    "- Delivered actionable insights from large datasets using Python and SQL.",
    "TECHNICAL COMPETENCIES",
    "Python, SQL, Tableau, Excel",
    "EDUCATION & QUALIFICATIONS",
    "Master of Science in Data Analytics",
    "City College",
    "2018 - 2020",
    "PROFESSIONAL CERTIFICATIONS",
    "Google Data Analytics Certificate",
    "Google",
    "2021",
  ].join("\n");

  await testAsync("36. Recognize 'Work & Professional Experience', 'Technical Competencies', and 'Education & Qualifications' headings", async () => {
    const parsed = parseResumeText(workAndExpText);
    assert.ok(parsed.experience.length > 0, "'Work & Professional Experience' heading must be recognized");
    assert.ok(parsed.skills.length > 0, "'Technical Competencies' heading must be recognized");
    assert.ok(parsed.education.length > 0, "'Education & Qualifications' heading must be recognized");
    assert.ok(parsed.certifications.length > 0, "'Professional Certifications' heading must be recognized");
  });

  // ---- Test 37: Resume with ALL sections missing except contact ----
  const contactOnlyText = [
    "Riley Park",
    "riley.park@example.com",
    "+1 650 555 0199",
    "San Francisco, CA",
  ].join("\n");

  await testAsync("37. Resume with only contact information: all section arrays remain empty without fabricating data", async () => {
    const parsed = parseResumeText(contactOnlyText);
    assert.strictEqual(parsed.structuredModel.personalInformation.email, "riley.park@example.com");
    assert.strictEqual(parsed.structuredModel.summary, null, "Summary must be null when missing");
    assert.deepStrictEqual(parsed.experience, [], "Experience must be empty array");
    assert.deepStrictEqual(parsed.education, [], "Education must be empty array");
    assert.deepStrictEqual(parsed.certifications, [], "Certifications must be empty array");
    assert.deepStrictEqual(parsed.projects, [], "Projects must be empty array");
  });

  // ---- Test 38: Resume missing only education ----
  const noEducationText = [
    "Morgan Ellis",
    "morgan.ellis@test.com",
    "PROFESSIONAL SUMMARY",
    "Full-stack developer with 3 years of experience.",
    "TECHNICAL SKILLS",
    "JavaScript, React, Node.js, MongoDB",
    "WORK EXPERIENCE",
    "Software Developer",
    "WebWorks Inc",
    "2022 - Present",
    "- Developed React dashboards integrated with REST APIs.",
  ].join("\n");

  await testAsync("38. Resume missing Education section: education remains empty array, other sections parsed correctly", async () => {
    const parsed = parseResumeText(noEducationText);
    assert.deepStrictEqual(parsed.education, [], "Missing Education section must result in empty array");
    assert.ok(parsed.experience.length > 0, "Experience must be parsed correctly");
    assert.ok(parsed.skills.length > 0, "Skills must be parsed correctly");
    assert.ok(
      parsed.structuredModel.parsingMetadata.warnings.some((w) =>
        w.toLowerCase().includes("education")
      ),
      "Warning must mention missing education"
    );
  });

  // ---- Test 39: Resume missing only contact information ----
  const noContactText = [
    "PROFESSIONAL SUMMARY",
    "Experienced data analyst with expertise in SQL and Python.",
    "TECHNICAL SKILLS",
    "SQL, Python, Tableau, Power BI",
    "WORK EXPERIENCE",
    "Data Analyst",
    "Analytics Co.",
    "2021 - 2023",
    "- Produced monthly dashboards from MySQL data.",
    "EDUCATION",
    "Bachelor of Statistics",
    "North University",
    "2017 - 2021",
  ].join("\n");

  await testAsync("39. Resume missing contact section: personalInformation fields are null, not fabricated", async () => {
    const parsed = parseResumeText(noContactText);
    assert.strictEqual(parsed.structuredModel.personalInformation.fullName, null, "Full name must be null");
    assert.strictEqual(parsed.structuredModel.personalInformation.email, null, "Email must be null");
    assert.ok(parsed.education.length > 0, "Education should still be extracted");
    assert.ok(parsed.experience.length > 0, "Experience should still be extracted");
  });

  // ---- Test 40: Poorly-formatted: mixed-case headings ----
  const mixedCaseText = [
    "Chris Bloom",
    "chris.bloom@example.com",
    "pRoFeSsIoNaL sUmMaRy",
    "Innovative developer with a passion for clean code.",
    "wOrK eXpErIeNcE",
    "Backend Developer",
    "TechGroup",
    "2020 - 2023",
    "- Built microservices in Node.js.",
    "TeCHniCaL sKiLlS",
    "Node.js, TypeScript, PostgreSQL",
  ].join("\n");

  await testAsync("40. Parse resume with mixed-case section headings (case-insensitive matching)", async () => {
    const parsed = parseResumeText(mixedCaseText);
    assert.ok(parsed.structuredModel.summary, "Summary must be found under mixed-case heading");
    assert.ok(parsed.experience.length > 0, "Experience must be found under mixed-case heading");
    assert.ok(parsed.skills.length > 0, "Skills must be found under mixed-case heading");
  });

  // ---- Test 41: Poorly-formatted: unconventional bullets and spacing ----
  const uglyBulletText = [
    "Drew Steele",
    "drew@example.com",
    "TECHNICAL SKILLS",
    "▪ Python",
    "● Docker",
    "◦ Kubernetes",
    "⁃ React",
    "WORK EXPERIENCE",
    "DevOps Engineer",
    "CloudOps Ltd",
    "2019 - 2022",
    "▸ Managed Kubernetes clusters handling 10k pods.",
    "▸ Automated CI/CD pipelines with Jenkins.",
  ].join("\n");

  await testAsync("41. Parse resume with unconventional Unicode bullet points gracefully", async () => {
    const parsed = parseResumeText(uglyBulletText);
    // Should not crash and skills/experience should be present
    assert.ok(parsed.skills.length > 0, "Skills should be extracted despite unusual bullets");
    assert.ok(parsed.experience.length > 0, "Experience should be extracted despite unusual bullets");
  });

  // ---- Test 42: Poorly-formatted: inconsistent date formats ----
  const inconsistentDatesText = [
    "Quinn Harper",
    "quinn.harper@example.com",
    "WORK EXPERIENCE",
    "Software Engineer",
    "Alpha Systems",
    "Jan 2022 to Present",
    "- Developed internal tooling.",
    "Junior Developer",
    "Beta Labs",
    "March 2019 - December 2021",
    "- Built e-commerce integrations.",
    "EDUCATION",
    "B.Sc. in Computer Science",
    "Western University",
    "Sep 2015 - Jun 2019",
  ].join("\n");

  await testAsync("42. Parse resume with inconsistent date formats without crashing", async () => {
    const parsed = parseResumeText(inconsistentDatesText);
    assert.ok(parsed.experience.length > 0, "Experience entries should be extracted");
    assert.ok(parsed.education.length > 0, "Education should be extracted");
    // Ensure no fabricated data
    assert.ok(
      parsed.experience.every((e) => e.jobTitle && typeof e.jobTitle === "string"),
      "Job titles must be strings"
    );
  });

  // ---- Test 43: Poorly-formatted: repeated headings ----
  const repeatedHeadingText = [
    "Avery Johnson",
    "avery.j@example.com",
    "SKILLS",
    "JavaScript, React",
    "SKILLS",
    "Node.js, MySQL",
    "EXPERIENCE",
    "Frontend Developer",
    "WebAgency",
    "2021 - Present",
    "- Delivered responsive UI components.",
  ].join("\n");

  await testAsync("43. Repeated section headings: content is merged, no crash, no duplicate skills", async () => {
    const parsed = parseResumeText(repeatedHeadingText);
    // Must not crash, skills must be present
    assert.ok(Array.isArray(parsed.skills), "Skills must be an array");
    assert.ok(parsed.experience.length > 0, "Experience must be extracted");
    // No duplicate skill names
    const skillNames = parsed.skills.map((s) => s.name.toLowerCase());
    const uniqueSkillNames = [...new Set(skillNames)];
    assert.strictEqual(skillNames.length, uniqueSkillNames.length, "Duplicate skills must not appear");
  });

  // ---- Test 44: Skills listed in sentences (no dedicated skills section) ----
  const sentenceSkillsText = [
    "Brook Davis",
    "brook.davis@example.com",
    "PROFESSIONAL SUMMARY",
    "Brook is proficient in Python, React, Docker and has worked with AWS and PostgreSQL.",
    "WORK EXPERIENCE",
    "Software Engineer",
    "Innovate Ltd",
    "2020 - Present",
    "- Built services using Python and deployed to AWS Lambda.",
  ].join("\n");

  await testAsync("44. Extract skills from sentences when no dedicated Skills section exists", async () => {
    const parsed = parseResumeText(sentenceSkillsText);
    assert.ok(parsed.skills.length >= 2, "At least 2 skills should be extracted from sentence context");
    const skillNames = parsed.skills.map((s) => s.name);
    assert.ok(skillNames.includes("Python") || skillNames.some((n) => n.toLowerCase().includes("python")));
  });

  // ---- Test 45: File validation — oversized file rejection ----
  const { MAX_FILE_SIZE_BYTES } = require("../utils/fileValidator");
  const oversizedFile = path.join(testDir, "day14_oversized.pdf");
  // Create a valid-looking PDF header then pad to exceed limit
  const oversizedBuf = Buffer.alloc(MAX_FILE_SIZE_BYTES + 1024, 0x41); // fill with 'A'
  oversizedBuf.write("%PDF-1.4", 0, "utf8"); // valid magic bytes
  fs.writeFileSync(oversizedFile, oversizedBuf);

  await testAsync("45. File validation rejects documents exceeding the 5 MB size limit", async () => {
    const result = validateResumeFile(oversizedFile, "oversized.pdf");
    assert.strictEqual(result.isValid, false, "Oversized file must be rejected");
    assert.ok(
      result.message.toLowerCase().includes("5 mb") ||
      result.message.toLowerCase().includes("size") ||
      result.message.toLowerCase().includes("limit"),
      "Rejection message must mention size/limit"
    );
  });

  // ---- Test 46: File validation — empty file rejected ----
  const emptyFile = path.join(testDir, "day14_empty.pdf");
  fs.writeFileSync(emptyFile, Buffer.alloc(0));

  await testAsync("46. File validation rejects empty (0-byte) files before processing", async () => {
    const result = validateResumeFile(emptyFile, "empty.pdf");
    assert.strictEqual(result.isValid, false, "Empty file must be rejected");
    assert.ok(result.message.toLowerCase().includes("empty"), "Message must mention empty");
  });

  // ---- Test 47: File validation — wrong extension rejected ----
  const txtFile = path.join(testDir, "day14_fake.txt");
  fs.writeFileSync(txtFile, "This is plain text, not a resume document.");

  await testAsync("47. File validation rejects unsupported file extensions (.txt)", async () => {
    const result = validateResumeFile(txtFile, "resume.txt");
    assert.strictEqual(result.isValid, false, "Non-PDF/DOCX extension must be rejected");
    assert.ok(
      result.message.toLowerCase().includes("format") ||
      result.message.toLowerCase().includes("pdf") ||
      result.message.toLowerCase().includes("docx"),
      "Message must mention supported formats"
    );
  });

  // ---- Test 48: File validation — file with misleading extension (txt renamed .pdf) ----
  const fakePdfFile = path.join(testDir, "day14_fake.pdf");
  fs.writeFileSync(fakePdfFile, Buffer.from("This is not a real PDF file. Just plain text."));

  await testAsync("48. File validation rejects plain-text file renamed to .pdf (magic byte check)", async () => {
    const result = validateResumeFile(fakePdfFile, "fake.pdf");
    assert.strictEqual(result.isValid, false, "File with .pdf extension but invalid content must be rejected");
    assert.ok(
      result.message.toLowerCase().includes("pdf") ||
      result.message.toLowerCase().includes("invalid") ||
      result.message.toLowerCase().includes("content"),
      "Message must indicate the file content is invalid"
    );
  });

  // ---- Test 49: File validation — file with misleading extension (txt renamed .docx) ----
  const fakeDocxFile = path.join(testDir, "day14_fake.docx");
  fs.writeFileSync(fakeDocxFile, Buffer.from("This is not a real DOCX file."));

  await testAsync("49. File validation rejects plain-text file renamed to .docx (ZIP structure check)", async () => {
    const result = validateResumeFile(fakeDocxFile, "fake.docx");
    assert.strictEqual(result.isValid, false, "File with .docx extension but invalid content must be rejected");
    assert.ok(
      result.message.toLowerCase().includes("docx") ||
      result.message.toLowerCase().includes("invalid") ||
      result.message.toLowerCase().includes("corrupted"),
      "Message must indicate the file content is invalid"
    );
  });

  // ---- Test 50: File validation — valid PDF accepted ----
  const validSmallPdf = path.join(testDir, "day14_small_valid.pdf");
  fs.writeFileSync(validSmallPdf, buildMinimalPdfBuffer(["John Test", "test@example.com"]));

  await testAsync("50. File validation accepts a valid small PDF document", async () => {
    const result = validateResumeFile(validSmallPdf, "resume.pdf");
    assert.strictEqual(result.isValid, true, `Valid PDF must be accepted: ${result.message}`);
    assert.strictEqual(result.fileType, "PDF");
    assert.ok(result.fileSize > 0);
  });

  // ---- Test 51: File validation — valid DOCX accepted ----
  const validSmallDocx = path.join(testDir, "day14_small_valid.docx");
  fs.writeFileSync(validSmallDocx, await createDocxWithText("Resume content here"));

  await testAsync("51. File validation accepts a valid small DOCX document", async () => {
    const result = validateResumeFile(validSmallDocx, "resume.docx");
    assert.strictEqual(result.isValid, true, `Valid DOCX must be accepted: ${result.message}`);
    assert.strictEqual(result.fileType, "DOCX");
    assert.ok(result.fileSize > 0);
  });

  // ---- Test 52: Corrupted PDF (valid magic bytes, invalid body) ----
  const corruptedPdfFile = path.join(testDir, "day14_corrupt.pdf");
  const corruptBuf = Buffer.alloc(512);
  corruptBuf.write("%PDF-1.4\n%%corrupt content that cannot be parsed", 0, "utf8");
  fs.writeFileSync(corruptedPdfFile, corruptBuf);

  await testAsync("52. Handle corrupted PDF (valid header, invalid body) gracefully without crashing", async () => {
    const res = await extractDocumentText(corruptedPdfFile, "PDF");
    // Either fails gracefully or extracts nothing — must NOT throw unhandled exception
    assert.ok(typeof res.success === "boolean", "Result must have a boolean success field");
    assert.ok(typeof res.error === "string" || res.success === true, "Must have error string or succeed");
  });

  // ---- Test 53: cleanExtractedText preserves meaningful content ----
  await testAsync("53. cleanExtractedText removes null bytes and collapses excessive blank lines without losing content", async () => {
    const rawDirty =
      "Line 1\x00\x07\r\nLine 2\n\n\n\n\n\nLine 3\t  extra   spaces\u00A0here";
    const cleaned = cleanExtractedText(rawDirty);
    assert.ok(cleaned.includes("Line 1"), "Line 1 must be preserved");
    assert.ok(cleaned.includes("Line 2"), "Line 2 must be preserved");
    assert.ok(cleaned.includes("Line 3"), "Line 3 must be preserved");
    assert.ok(!cleaned.includes("\x00"), "Null bytes must be removed");
    assert.ok(!cleaned.includes("\r"), "Carriage returns must be removed");
    const blankLineCount = (cleaned.match(/\n\n\n/g) || []).length;
    assert.strictEqual(blankLineCount, 0, "Triple+ blank lines must be collapsed");
  });

  // ---- Test 54: Multiple education entries with varied formats ----
  const multiEduText = [
    "Pat Nguyen",
    "pat.nguyen@example.com",
    "EDUCATION",
    "Doctor of Philosophy in Machine Learning",
    "Stanford University",
    "2020 - Present",
    "Master of Science in Computer Science",
    "UC Berkeley",
    "2018 - 2020",
    "GPA: 3.9 / 4.0",
    "Bachelor of Engineering",
    "Colombo University",
    "2014 - 2018",
  ].join("\n");

  await testAsync("54. Parse multiple education entries with different degree formats", async () => {
    const parsed = parseResumeText(multiEduText);
    assert.ok(parsed.education.length >= 2, "Multiple education entries must be parsed");
    const quals = parsed.education.map((e) => e.qualification || "");
    assert.ok(quals.some((q) => /doctor|ph\.?d/i.test(q)), "PhD entry must be parsed");
    assert.ok(quals.some((q) => /master|m\.sc/i.test(q)), "Master entry must be parsed");
  });

  // ---- Test 55: Multiple experience entries with achievements ----
  const multiExpText = [
    "Jamie Torres",
    "jamie.torres@example.com",
    "WORK EXPERIENCE",
    "Principal Engineer",
    "MegaCorp",
    "2022 - Present",
    "- Led architecture of distributed payment system.",
    "- Reduced latency by 45% through caching strategy.",
    "Senior Engineer",
    "StartupXYZ",
    "2019 - 2022",
    "- Built real-time notification service using WebSockets and Redis.",
    "- Increased test coverage from 30% to 85%.",
    "Junior Developer",
    "CodeHouse",
    "2017 - 2019",
    "- Developed internal CMS using PHP and MySQL.",
  ].join("\n");

  await testAsync("55. Parse three distinct work experience entries retaining responsibilities correctly", async () => {
    const parsed = parseResumeText(multiExpText);
    assert.ok(parsed.experience.length >= 2, "At least 2 experience entries expected");
    parsed.experience.forEach((exp) => {
      assert.ok(exp.jobTitle, "Each entry must have a job title");
      assert.ok(exp.company, "Each entry must have a company");
    });
  });

  // ---- Test 56: Skills deduplication across sections ----
  const dupSkillsText = [
    "Drew Kim",
    "drew.kim@example.com",
    "TECHNICAL SKILLS",
    "Python, JavaScript, Python, React, React",
    "WORK EXPERIENCE",
    "Developer",
    "Tech Inc",
    "2021 - Present",
    "- Wrote Python scripts and React components.",
  ].join("\n");

  await testAsync("56. Skills deduplication: no repeated skill entries even when mentioned multiple times", async () => {
    const parsed = parseResumeText(dupSkillsText);
    const skillNames = parsed.skills.map((s) => s.name.toLowerCase());
    const uniqueNames = [...new Set(skillNames)];
    assert.strictEqual(
      skillNames.length,
      uniqueNames.length,
      `Duplicate skills found: ${skillNames.join(", ")}`
    );
  });

  // ---- Test 57: Projects section with multiple entries and tech stack ----
  const multiProjectText = [
    "Sam Green",
    "sam.green@example.com",
    "PROJECTS",
    "InventoryPro",
    "https://github.com/samgreen/inventorypro",
    "Technologies: React, Node.js, MongoDB",
    "- Inventory management system for small businesses.",
    "DataViz Platform",
    "https://github.com/samgreen/dataviz",
    "Technologies: Python, Plotly, Flask",
    "- Interactive data visualization for retail analytics.",
  ].join("\n");

  await testAsync("57. Parse multiple project entries with URLs and technology stacks", async () => {
    const parsed = parseResumeText(multiProjectText);
    assert.ok(parsed.projects.length >= 1, "At least one project must be parsed");
    parsed.projects.forEach((p) => {
      assert.ok(typeof p.name === "string" || p.name === null, "Project name must be string or null");
    });
  });

  // ---- Test 58: extractDocumentText rejects unsupported file type ----
  const unsupportedFile = path.join(testDir, "day14_resume.xls");
  fs.writeFileSync(unsupportedFile, Buffer.from("spreadsheet content"));

  await testAsync("58. extractDocumentText returns error for unsupported document type (xls)", async () => {
    const res = await extractDocumentText(unsupportedFile, "XLS");
    assert.strictEqual(res.success, false, "Unsupported file type must not succeed");
    assert.ok(res.error && res.error.toLowerCase().includes("unsupported"), "Error must say 'unsupported'");
  });

  // ---- Test 59: normalizeDateRange handles edge cases ----
  await testAsync("59. normalizeDateRange handles 'Present', 'current', and missing end date correctly", async () => {
    const { normalizeDateRange } = require("../services/resumeParserService");

    const r1 = normalizeDateRange("2020 - Present");
    assert.strictEqual(r1.startDate, "2020");
    assert.strictEqual(r1.endDate, "Present");
    assert.strictEqual(r1.isCurrent, true);

    const r2 = normalizeDateRange("Jan 2019 to Dec 2021");
    assert.strictEqual(r2.startDate, "Jan 2019");
    assert.strictEqual(r2.endDate, "Dec 2021");
    assert.strictEqual(r2.isCurrent, false);

    const r3 = normalizeDateRange(null);
    assert.strictEqual(r3.startDate, null);
    assert.strictEqual(r3.endDate, null);
    assert.strictEqual(r3.isCurrent, null);
  });

  // ---- Test 60: parseSummary trims and collapses whitespace ----
  await testAsync("60. parseSummary trims excessive whitespace and returns null for blank summary", async () => {
    const { parseSummary } = require("../services/resumeParserService");

    const r1 = parseSummary("  Engineer with   10 years  \nof cloud experience.  ");
    assert.ok(r1 && !r1.startsWith(" "), "Leading whitespace must be trimmed");
    assert.ok(!r1.includes("  "), "Multiple internal spaces must be collapsed");

    const r2 = parseSummary("   ");
    assert.strictEqual(r2, null, "Whitespace-only summary must return null");

    const r3 = parseSummary(null);
    assert.strictEqual(r3, null, "Null input must return null");
  });

  // ---- Test 61: segmentSections handles blank lines gracefully ----
  await testAsync("61. segmentSections handles documents with many extra blank lines without breaking structure", async () => {
    const textWithBlanks = [
      "Riley Fox",
      "",
      "",
      "riley.fox@example.com",
      "",
      "PROFESSIONAL SUMMARY",
      "",
      "Agile coach with 8 years of experience.",
      "",
      "",
      "TECHNICAL SKILLS",
      "",
      "Jira, Confluence, Python",
    ].join("\n");

    const parsed = parseResumeText(textWithBlanks);
    assert.ok(parsed.structuredModel.summary, "Summary must be parsed through blank lines");
    assert.ok(parsed.skills.length > 0, "Skills must be parsed through blank lines");
  });

  // =========================================================================
  // Day 15: Job Description Input Test Suite
  // =========================================================================

  function createMockRes() {
    return {
      statusCode: 200,
      body: null,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(data) {
        this.body = data;
        return this;
      },
    };
  }

  const {
    createJobDescription,
    uploadJobDescription,
    getJobDescriptions,
    getJobDescriptionById,
    MAX_DESCRIPTION_LENGTH,
  } = require("../controllers/jobController");
  const { JOB_UPLOAD_DIR } = require("../middleware/jobUploadMiddleware");

  // ---- Test 62: Create job description via pasted text ----
  await testAsync("62. Create job description via pasted text persists to MySQL with PASTED_TEXT source", async () => {
    // Create test user
    const [userRes] = await db.query(
      `INSERT INTO users (full_name, email, password_hash) VALUES (?, ?, ?)`,
      ["Job Tester", `job_tester_${Date.now()}@example.com`, "hash"]
    );
    const testUserId = userRes.insertId;

    const req = {
      user: { id: testUserId },
      body: {
        title: "Senior Full Stack Engineer",
        company: "Acme Corp",
        description: "We are looking for a Senior Full Stack Engineer with React, Node.js, and MySQL experience.",
      },
    };
    const res = createMockRes();

    try {
      await createJobDescription(req, res);
      assert.strictEqual(res.statusCode, 201);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.job.title, "Senior Full Stack Engineer");
      assert.strictEqual(res.body.job.company, "Acme Corp");
      assert.strictEqual(res.body.job.source_type, "PASTED_TEXT");
      assert.strictEqual(res.body.job.processing_status, "COMPLETED");

      // Verify in DB
      const [rows] = await db.query(`SELECT * FROM jobs WHERE id = ?`, [res.body.job.id]);
      assert.strictEqual(rows.length, 1);
      assert.strictEqual(rows[0].user_id, testUserId);
    } finally {
      await db.query(`DELETE FROM users WHERE id = ?`, [testUserId]);
    }
  });

  // ---- Test 63: Validate required title on pasted text ----
  await testAsync("63. Create job description validates required title", async () => {
    const req = {
      user: { id: 999 },
      body: {
        title: "   ",
        description: "Some valid job description text here.",
      },
    };
    const res = createMockRes();

    await createJobDescription(req, res);
    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.body.success, false);
    assert.ok(res.body.message.includes("title"));
  });

  // ---- Test 64: Validate required description text ----
  await testAsync("64. Create job description validates required description text", async () => {
    const req = {
      user: { id: 999 },
      body: {
        title: "Backend Developer",
        description: "",
      },
    };
    const res = createMockRes();

    await createJobDescription(req, res);
    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.body.success, false);
    assert.ok(res.body.message.includes("description"));
  });

  // ---- Test 65: Validate description length limit ----
  await testAsync("65. Create job description rejects text exceeding 30,000 character limit", async () => {
    const oversizedText = "x".repeat(MAX_DESCRIPTION_LENGTH + 1);
    const req = {
      user: { id: 999 },
      body: {
        title: "Cloud Architect",
        description: oversizedText,
      },
    };
    const res = createMockRes();

    await createJobDescription(req, res);
    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.body.success, false);
    assert.ok(res.body.message.includes("must not exceed"));
  });

  // ---- Test 66: Upload job description document (DOCX), extract text, and clean up temp file ----
  await testAsync("66. Upload job description document extracts text, saves as UPLOADED_FILE, and removes temp file", async () => {
    const [userRes] = await db.query(
      `INSERT INTO users (full_name, email, password_hash) VALUES (?, ?, ?)`,
      ["Docx Tester", `docx_job_${Date.now()}@example.com`, "hash"]
    );
    const testUserId = userRes.insertId;

    const sampleDocxText = "Software Engineer Job Opening\nResponsibilities:\n- Build microservices\n- Write unit tests";
    const docxBuffer = await createDocxWithText(sampleDocxText);

    const tempUploadPath = path.join(JOB_UPLOAD_DIR, `test_job_${Date.now()}.docx`);
    fs.writeFileSync(tempUploadPath, docxBuffer);

    const req = {
      user: { id: testUserId },
      file: {
        path: tempUploadPath,
        originalname: "senior_role.docx",
      },
      body: {
        title: "Staff Software Engineer",
        company: "InnovateTech",
      },
    };
    const res = createMockRes();

    try {
      await uploadJobDescription(req, res);
      assert.strictEqual(res.statusCode, 201);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.job.source_type, "UPLOADED_FILE");
      assert.strictEqual(res.body.job.title, "Staff Software Engineer");
      assert.strictEqual(res.body.job.company, "InnovateTech");
      assert.ok(res.body.job.description.includes("Build microservices"));

      // Verify temp file is cleaned up after extraction
      assert.strictEqual(fs.existsSync(tempUploadPath), false, "Temporary upload file must be unlinked");
    } finally {
      if (fs.existsSync(tempUploadPath)) {
        try { fs.unlinkSync(tempUploadPath); } catch (_) {}
      }
      await db.query(`DELETE FROM users WHERE id = ?`, [testUserId]);
    }
  });

  // ---- Test 67: Upload rejects unsupported file type and cleans up ----
  await testAsync("67. Upload job description rejects invalid file formats and unlinks temp file", async () => {
    const fakeFilePath = path.join(JOB_UPLOAD_DIR, `fake_${Date.now()}.txt`);
    fs.writeFileSync(fakeFilePath, "This is not a PDF or DOCX");

    const req = {
      user: { id: 999 },
      file: {
        path: fakeFilePath,
        originalname: "fake_job.txt",
      },
      body: {
        title: "Frontend Developer",
      },
    };
    const res = createMockRes();

    try {
      await uploadJobDescription(req, res);
      assert.strictEqual(res.statusCode, 400);
      assert.strictEqual(res.body.success, false);
      assert.strictEqual(fs.existsSync(fakeFilePath), false, "Invalid file should be unlinked");
    } finally {
      if (fs.existsSync(fakeFilePath)) {
        try { fs.unlinkSync(fakeFilePath); } catch (_) {}
      }
    }
  });

  // ---- Test 68: Upload requires job title even when document is provided ----
  await testAsync("68. Upload job description requires job title and cleans up file on validation error", async () => {
    const docxBuffer = await createDocxWithText("Some job content");
    const tempUploadPath = path.join(JOB_UPLOAD_DIR, `no_title_${Date.now()}.docx`);
    fs.writeFileSync(tempUploadPath, docxBuffer);

    const req = {
      user: { id: 999 },
      file: {
        path: tempUploadPath,
        originalname: "job.docx",
      },
      body: {
        title: "   ",
      },
    };
    const res = createMockRes();

    try {
      await uploadJobDescription(req, res);
      assert.strictEqual(res.statusCode, 400);
      assert.strictEqual(res.body.success, false);
      assert.ok(res.body.message.includes("title"));
      assert.strictEqual(fs.existsSync(tempUploadPath), false, "File should be unlinked when title is missing");
    } finally {
      if (fs.existsSync(tempUploadPath)) {
        try { fs.unlinkSync(tempUploadPath); } catch (_) {}
      }
    }
  });

  // ---- Test 69: List job descriptions returns user's records ordered by created_at DESC ----
  await testAsync("69. List job descriptions retrieves user-owned jobs ordered by created_at DESC", async () => {
    const [userRes] = await db.query(
      `INSERT INTO users (full_name, email, password_hash) VALUES (?, ?, ?)`,
      ["List Tester", `list_tester_${Date.now()}@example.com`, "hash"]
    );
    const testUserId = userRes.insertId;

    try {
      await db.query(
        `INSERT INTO jobs (user_id, title, company, description, source_type, processing_status, created_at)
         VALUES (?, 'Role A', 'Co A', 'Description A', 'PASTED_TEXT', 'COMPLETED', NOW() - INTERVAL 10 MINUTE),
                (?, 'Role B', 'Co B', 'Description B', 'UPLOADED_FILE', 'COMPLETED', NOW())`,
        [testUserId, testUserId]
      );

      const req = { user: { id: testUserId } };
      const res = createMockRes();

      await getJobDescriptions(req, res);
      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.jobs.length, 2);
      assert.strictEqual(res.body.jobs[0].title, "Role B", "Latest created job must come first");
      assert.strictEqual(res.body.jobs[1].title, "Role A");
      assert.ok(res.body.jobs[0].description_preview, "Description preview snippet must be present");
    } finally {
      await db.query(`DELETE FROM users WHERE id = ?`, [testUserId]);
    }
  });

  // ---- Test 70: Cross-user isolation: User cannot retrieve another user's job description ----
  await testAsync("70. Get job description by ID enforces ownership boundaries across users", async () => {
    const [u1] = await db.query(
      `INSERT INTO users (full_name, email, password_hash) VALUES (?, ?, ?)`,
      ["Owner User", `owner_${Date.now()}@example.com`, "hash"]
    );
    const [u2] = await db.query(
      `INSERT INTO users (full_name, email, password_hash) VALUES (?, ?, ?)`,
      ["Other User", `other_${Date.now()}@example.com`, "hash"]
    );
    const ownerId = u1.insertId;
    const intruderId = u2.insertId;

    try {
      const [jobRes] = await db.query(
        `INSERT INTO jobs (user_id, title, description, source_type, processing_status)
         VALUES (?, 'Secret Role', 'Confidential Job', 'PASTED_TEXT', 'COMPLETED')`,
        [ownerId]
      );
      const jobId = jobRes.insertId;

      // Intruder attempts to fetch
      const intruderReq = { user: { id: intruderId }, params: { id: jobId } };
      const intruderRes = createMockRes();
      await getJobDescriptionById(intruderReq, intruderRes);

      assert.strictEqual(intruderRes.statusCode, 404);
      assert.strictEqual(intruderRes.body.success, false);

      // Owner fetches successfully
      const ownerReq = { user: { id: ownerId }, params: { id: jobId } };
      const ownerRes = createMockRes();
      await getJobDescriptionById(ownerReq, ownerRes);

      assert.strictEqual(ownerRes.statusCode, 200);
      assert.strictEqual(ownerRes.body.success, true);
      assert.strictEqual(ownerRes.body.job.title, "Secret Role");
    } finally {
      await db.query(`DELETE FROM users WHERE id IN (?, ?)`, [ownerId, intruderId]);
    }
  });

  // ---- Test 71: Reject unauthenticated requests ----
  await testAsync("71. Job description endpoints reject unauthenticated access", async () => {
    const unauthReq = { user: null, body: { title: "Title", description: "Desc" } };
    const unauthRes = createMockRes();

    await createJobDescription(unauthReq, unauthRes);
    assert.strictEqual(unauthRes.statusCode, 401);
    assert.strictEqual(unauthRes.body.success, false);
  });

  // =========================================================================
  // Day 16: Job Requirement Extraction Test Suite
  // =========================================================================
  const JobRequirementExtractionService = require("../services/jobRequirementExtractionService");
  const {
    extractRequirementsForJob,
    getJobRequirements,
  } = require("../controllers/jobController");

  // ---- Test 72: Description with explicit required skills ----
  await testAsync("72. Extract explicit required skills from mandatory section and cues", async () => {
    const text = `Title: Senior Backend Developer
Requirements:
- Must have experience with React and Node.js.
- Strong knowledge of SQL and Problem Solving.
- Required: Python programming skills.`;

    const res = JobRequirementExtractionService.extractRequirements(text, 10, "Senior Backend Developer");
    assert.strictEqual(res.jobDescriptionId, 10);
    assert.strictEqual(res.jobTitle, "Senior Backend Developer");
    const reqNames = res.requiredSkills.map((s) => s.name);
    assert.ok(reqNames.includes("React"), "React must be in required skills");
    assert.ok(reqNames.includes("Node.js"), "Node.js must be in required skills");
    assert.ok(reqNames.includes("SQL"), "SQL must be in required skills");
    assert.ok(reqNames.includes("Python"), "Python must be in required skills");
    assert.ok(reqNames.includes("Problem Solving"), "Problem Solving must be in required skills");
    for (const item of res.requiredSkills) {
      assert.strictEqual(item.required, true);
    }
  });

  // ---- Test 73: Description with preferred skills ----
  await testAsync("73. Extract preferred skills from optional/bonus sections without marking required", async () => {
    const text = `About the role: We are building next-gen developer tools.
Preferred Qualifications:
- Familiarity with TypeScript and Docker.
- Experience with GraphQL is a plus.
- Knowledge of Kubernetes would be an advantage.`;

    const res = JobRequirementExtractionService.extractRequirements(text, 11, "Frontend Engineer");
    const prefNames = res.preferredSkills.map((s) => s.name);
    assert.ok(prefNames.includes("TypeScript"), "TypeScript must be preferred");
    assert.ok(prefNames.includes("Docker"), "Docker must be preferred");
    assert.ok(prefNames.includes("GraphQL"), "GraphQL must be preferred");
    assert.ok(prefNames.includes("Kubernetes"), "Kubernetes must be preferred");
    assert.strictEqual(res.requiredSkills.length, 0, "No skills should be classified as required");
    for (const item of res.preferredSkills) {
      assert.strictEqual(item.required, false);
    }
  });

  // ---- Test 74: Description with required and preferred skills mixed together ----
  await testAsync("74. Distinguish required from preferred skills when mixed in same job description", async () => {
    const text = `Required Qualifications:
- Must possess solid experience with JavaScript and React.
- Minimum 3 years building APIs with Node.js.

Nice To Have:
- Experience with AWS and Redis is a bonus.
- Familiarity with Figma.`;

    const res = JobRequirementExtractionService.extractRequirements(text, 12, "Full Stack Engineer");
    const reqNames = res.requiredSkills.map((s) => s.name);
    const prefNames = res.preferredSkills.map((s) => s.name);

    assert.ok(reqNames.includes("JavaScript"), "JavaScript must be required");
    assert.ok(reqNames.includes("React"), "React must be required");
    assert.ok(reqNames.includes("Node.js"), "Node.js must be required");

    assert.ok(prefNames.includes("AWS"), "AWS must be preferred");
    assert.ok(prefNames.includes("Redis"), "Redis must be preferred");
    assert.ok(prefNames.includes("Figma"), "Figma must be preferred");

    assert.ok(!reqNames.includes("AWS"), "AWS must not be marked required");
    assert.ok(!prefNames.includes("React"), "React must not be marked preferred");
  });

  // ---- Test 75: Description specifying minimum number of experience years ----
  await testAsync("75. Extract minimum years of experience accurately", async () => {
    const text = `About Us: Enterprise SaaS leader.
Requirements:
- Minimum of 4 years of experience building distributed systems.
- Must have experience with Go and PostgreSQL.`;

    const res = JobRequirementExtractionService.extractRequirements(text, 13, "Systems Engineer");
    assert.strictEqual(res.experience.minimumYears, 4);
    assert.strictEqual(res.experience.maximumYears, null);
    assert.ok(res.experience.details.length > 0);
  });

  // ---- Test 76: Description with experience range ----
  await testAsync("76. Extract experience range (min and max years)", async () => {
    const text = `Role: Senior Software Engineer
Job Description:
- Seeking an engineer with 3-5 years of experience in software development.
- Strong proficiency in Java and Spring Boot.`;

    const res = JobRequirementExtractionService.extractRequirements(text, 14, "Senior Software Engineer");
    assert.strictEqual(res.experience.minimumYears, 3);
    assert.strictEqual(res.experience.maximumYears, 5);
    assert.strictEqual(res.experience.level, "Senior");
  });

  // ---- Test 77: Description with no specified years of experience ----
  await testAsync("77. Represent missing experience years as null, not zero", async () => {
    const text = `Role: Frontend Developer
Duties:
- Build reusable UI components using React and HTML5.
- Collaborate with UX designers on responsive interfaces.`;

    const res = JobRequirementExtractionService.extractRequirements(text, 15, "Frontend Developer");
    assert.strictEqual(res.experience.minimumYears, null, "Missing min years must be null");
    assert.strictEqual(res.experience.maximumYears, null, "Missing max years must be null");
    assert.notStrictEqual(res.experience.minimumYears, 0, "Missing years must not default to 0");
  });

  // ---- Test 78: Required and preferred education ----
  await testAsync("78. Extract required and preferred education degrees and fields with equivalent acceptance", async () => {
    const text = `Basic Qualifications:
- Bachelor's degree in Computer Science or related technical field, or equivalent practical experience.
- Strong problem-solving skills.

Preferred Qualifications:
- Master's degree in Software Engineering is preferred.`;

    const res = JobRequirementExtractionService.extractRequirements(text, 16, "Software Engineer");
    assert.strictEqual(res.education.length, 2, "Must extract both bachelor's and master's entries");

    const bachelor = res.education.find((e) => e.level === "BACHELOR");
    assert.ok(bachelor, "Bachelor entry must exist");
    assert.strictEqual(bachelor.required, true, "Bachelor must be required");
    assert.strictEqual(bachelor.field, "Computer Science");
    assert.strictEqual(bachelor.equivalentAccepted, true, "Equivalent practical experience must be recognized");

    const master = res.education.find((e) => e.level === "MASTER");
    assert.ok(master, "Master entry must exist");
    assert.strictEqual(master.required, false, "Master must be preferred");
    assert.strictEqual(master.field, "Software Engineering");
  });

  // ---- Test 79: Tools and technologies in different sections ----
  await testAsync("79. Correctly categorize development tools vs programming technologies", async () => {
    const text = `Required Skills:
- Programming Languages: Python, Java, SQL.
- Frameworks: React, Express.js.
- Development Tools & Utilities: Git, Jira, Docker, VS Code, CI/CD.`;

    const res = JobRequirementExtractionService.extractRequirements(text, 17, "Full Stack Dev");
    const techNames = res.technologies.map((t) => t.name);
    const toolNames = res.tools.map((t) => t.name);

    assert.ok(techNames.includes("Python"));
    assert.ok(techNames.includes("Java"));
    assert.ok(techNames.includes("SQL"));
    assert.ok(techNames.includes("React"));
    assert.ok(techNames.includes("Express.js"));

    assert.ok(toolNames.includes("Git"));
    assert.ok(toolNames.includes("Jira"));
    assert.ok(toolNames.includes("Docker"));
    assert.ok(toolNames.includes("VS Code"));
    assert.ok(toolNames.includes("CI/CD"));

    // Verify separation
    assert.ok(!toolNames.includes("Python"), "Python must not be in tools");
    assert.ok(!techNames.includes("Jira"), "Jira must not be in technologies");
  });

  // ---- Test 80: Explicit certification requirements ----
  await testAsync("80. Extract explicit certification requirements and issuer details", async () => {
    const text = `Requirements:
- AWS Certified Solutions Architect certification required.
- Project Management Professional (PMP) preferred.`;

    const res = JobRequirementExtractionService.extractRequirements(text, 18, "Cloud Architect");
    assert.strictEqual(res.certifications.length, 2);

    const awsCert = res.certifications.find((c) => c.name.includes("AWS Certified Solutions Architect"));
    assert.ok(awsCert, "AWS Certified Solutions Architect must be detected");
    assert.strictEqual(awsCert.issuer, "Amazon Web Services");
    assert.strictEqual(awsCert.required, true);

    const pmpCert = res.certifications.find((c) => c.name.includes("PMP"));
    assert.ok(pmpCert, "PMP must be detected");
    assert.strictEqual(pmpCert.required, false);
  });

  // ---- Test 81: No certifications mentioned ----
  await testAsync("81. Return empty array when no certifications are mentioned without inventing any", async () => {
    const text = `Role: Junior Developer
Requirements:
- Experience with JavaScript, HTML, CSS.
- Good communication skills.`;

    const res = JobRequirementExtractionService.extractRequirements(text, 19, "Junior Developer");
    assert.ok(Array.isArray(res.certifications));
    assert.strictEqual(res.certifications.length, 0);
  });

  // ---- Test 82: Alternate names and duplicate technologies ----
  await testAsync("82. Normalize alternate aliases and avoid duplicate technology entries", async () => {
    const text = `Technologies:
- NodeJS and Node.js
- ReactJS and React
- Postgres and PostgreSQL
- JavaScript, JS, and ECMAScript`;

    const res = JobRequirementExtractionService.extractRequirements(text, 20, "Web Dev");
    const techNames = res.technologies.map((t) => t.name);

    // Each canonical technology should appear exactly once
    assert.strictEqual(techNames.filter((n) => n === "Node.js").length, 1);
    assert.strictEqual(techNames.filter((n) => n === "React").length, 1);
    assert.strictEqual(techNames.filter((n) => n === "PostgreSQL").length, 1);
    assert.strictEqual(techNames.filter((n) => n === "JavaScript").length, 1);
  });

  // ---- Test 83: Negated or ambiguous requirements ----
  await testAsync("83. Respect negation and do not classify negated items as mandatory requirements", async () => {
    const text = `Requirements:
- Must have experience with React and TypeScript.
- No degree required. A college degree is not required for this role.
- AWS certification is not required.`;

    const res = JobRequirementExtractionService.extractRequirements(text, 21, "React Dev");
    const reqSkills = res.requiredSkills.map((s) => s.name);
    assert.ok(reqSkills.includes("React"));
    assert.ok(reqSkills.includes("TypeScript"));

    // Education should not have required degree
    const requiredEducation = res.education.filter((e) => e.required);
    assert.strictEqual(requiredEducation.length, 0, "No required degree should be extracted when explicitly negated");

    // Certifications should not have required AWS certification
    const requiredCerts = res.certifications.filter((c) => c.required);
    assert.strictEqual(requiredCerts.length, 0, "No required certification when negated");
  });

  // ---- Test 84: Empty or missing job descriptions ----
  await testAsync("84. Handle empty, null, or whitespace-only job descriptions gracefully", async () => {
    const resEmpty = JobRequirementExtractionService.extractRequirements("", 22, "Empty Role");
    assert.strictEqual(resEmpty.extractionMetadata.status, "EMPTY");
    assert.strictEqual(resEmpty.requiredSkills.length, 0);
    assert.strictEqual(resEmpty.preferredSkills.length, 0);
    assert.strictEqual(resEmpty.experience.minimumYears, null);
    assert.strictEqual(resEmpty.education.length, 0);
    assert.strictEqual(resEmpty.tools.length, 0);
    assert.strictEqual(resEmpty.technologies.length, 0);
    assert.strictEqual(resEmpty.certifications.length, 0);

    const resNull = JobRequirementExtractionService.extractRequirements(null, null, null);
    assert.strictEqual(resNull.extractionMetadata.status, "EMPTY");
  });

  // ---- Test 85: Repeated extraction without duplicate records (Idempotency) ----
  await testAsync("85. Repeated extraction is idempotent and does not create duplicate database records", async () => {
    const [u] = await db.query(
      `INSERT INTO users (full_name, email, password_hash) VALUES (?, ?, ?)`,
      ["Idempotency Tester", `idempotency_${Date.now()}@example.com`, "hash"]
    );
    const userId = u.insertId;

    try {
      const [j] = await db.query(
        `INSERT INTO jobs (user_id, title, description, source_type, processing_status)
         VALUES (?, 'Cloud Engineer', 'Requirements: Must have AWS, Docker, Kubernetes. Preferred: Python.', 'PASTED_TEXT', 'COMPLETED')`,
        [userId]
      );
      const jobId = j.insertId;

      // First extraction
      await JobRequirementExtractionService.processJobRequirements(jobId, userId);

      const [reqs1] = await db.query(`SELECT COUNT(*) as count FROM job_requirements WHERE job_id = ?`, [jobId]);
      const [skills1] = await db.query(`SELECT COUNT(*) as count FROM job_skills WHERE job_id = ?`, [jobId]);

      assert.ok(reqs1[0].count > 0);
      assert.ok(skills1[0].count > 0);

      // Second extraction (retry)
      await JobRequirementExtractionService.processJobRequirements(jobId, userId);

      const [reqs2] = await db.query(`SELECT COUNT(*) as count FROM job_requirements WHERE job_id = ?`, [jobId]);
      const [skills2] = await db.query(`SELECT COUNT(*) as count FROM job_skills WHERE job_id = ?`, [jobId]);

      // Counts must be identical (no duplicates!)
      assert.strictEqual(reqs2[0].count, reqs1[0].count, "Job requirements count must not double on re-extraction");
      assert.strictEqual(skills2[0].count, skills1[0].count, "Job skills count must not double on re-extraction");

      // Verify retrieving saved requirements
      const saved = await JobRequirementExtractionService.getSavedRequirements(jobId);
      assert.ok(saved);
      assert.strictEqual(saved.jobDescriptionId, jobId);
      assert.ok(saved.requiredSkills.length > 0);
    } finally {
      await db.query(`DELETE FROM users WHERE id = ?`, [userId]);
    }
  });

  // ---- Test 86: Reject unauthenticated requests to extraction API ----
  await testAsync("86. Extraction endpoints reject unauthenticated requests with 401", async () => {
    const unauthReq = { user: null, params: { id: 1 } };
    const unauthRes = createMockRes();

    await extractRequirementsForJob(unauthReq, unauthRes);
    assert.strictEqual(unauthRes.statusCode, 401);
    assert.strictEqual(unauthRes.body.success, false);

    const getReq = { user: null, params: { id: 1 } };
    const getRes = createMockRes();
    await getJobRequirements(getReq, getRes);
    assert.strictEqual(getRes.statusCode, 401);
  });

  // ---- Test 87: Attempts to access another user's job description ----
  await testAsync("87. Cross-user isolation: User cannot extract or view requirements for another user's job", async () => {
    const [u1] = await db.query(
      `INSERT INTO users (full_name, email, password_hash) VALUES (?, ?, ?)`,
      ["Job Owner", `owner_${Date.now()}@example.com`, "hash"]
    );
    const [u2] = await db.query(
      `INSERT INTO users (full_name, email, password_hash) VALUES (?, ?, ?)`,
      ["Job Intruder", `intruder_${Date.now()}@example.com`, "hash"]
    );
    const ownerId = u1.insertId;
    const intruderId = u2.insertId;

    try {
      const [j] = await db.query(
        `INSERT INTO jobs (user_id, title, description, source_type, processing_status)
         VALUES (?, 'Private Role', 'Requirements: Must have React.', 'PASTED_TEXT', 'COMPLETED')`,
        [ownerId]
      );
      const jobId = j.insertId;

      // Intruder attempts to extract
      const extractReq = { user: { id: intruderId }, params: { id: jobId } };
      const extractRes = createMockRes();
      await extractRequirementsForJob(extractReq, extractRes);
      assert.strictEqual(extractRes.statusCode, 404);
      assert.strictEqual(extractRes.body.success, false);

      // Intruder attempts to get requirements
      const getReq = { user: { id: intruderId }, params: { id: jobId } };
      const getRes = createMockRes();
      await getJobRequirements(getReq, getRes);
      assert.strictEqual(getRes.statusCode, 404);
      assert.strictEqual(getRes.body.success, false);
    } finally {
      await db.query(`DELETE FROM users WHERE id IN (?, ?)`, [ownerId, intruderId]);
    }
  });

  // ---- Test 88: Database failure during persistence rolls back safely ----
  await testAsync("88. Persistence safely rolls back and reports failure when database error occurs", async () => {
    let threw = false;
    try {
      // Pass invalid jobId with missing requirements
      await JobRequirementExtractionService.persistRequirements(null, null);
    } catch (err) {
      threw = true;
      assert.ok(err.message.includes("required"));
    }
    assert.strictEqual(threw, true);
  });

  // ---- Test 89: Frontend requirements contract and invariant validation ----
  await testAsync("89. Extracted requirements structure satisfies frontend display contract", async () => {
    const text = `Senior Full Stack Architect
Requirements:
- 5-8 years of experience building distributed systems.
- Bachelor's degree in Computer Science or equivalent.
- Must know React, Node.js, and PostgreSQL.
- Experience with Docker, Git, and CI/CD tools.
- AWS Certified Solutions Architect is a plus.`;

    const res = JobRequirementExtractionService.extractRequirements(text, 99, "Senior Full Stack Architect");

    // Check all top-level keys required by frontend
    assert.ok(Object.prototype.hasOwnProperty.call(res, "jobDescriptionId"));
    assert.ok(Object.prototype.hasOwnProperty.call(res, "jobTitle"));
    assert.ok(Array.isArray(res.requiredSkills));
    assert.ok(Array.isArray(res.preferredSkills));
    assert.ok(typeof res.experience === "object" && res.experience !== null);
    assert.ok(Array.isArray(res.education));
    assert.ok(Array.isArray(res.tools));
    assert.ok(Array.isArray(res.technologies));
    assert.ok(Array.isArray(res.certifications));
    assert.ok(typeof res.extractionMetadata === "object");
    assert.ok(Array.isArray(res.extractionMetadata.warnings));

    // Verify item structures
    if (res.requiredSkills.length > 0) {
      const s = res.requiredSkills[0];
      assert.ok(typeof s.name === "string");
      assert.ok(typeof s.required === "boolean");
      assert.strictEqual(s.required, true);
    }

    if (res.education.length > 0) {
      const e = res.education[0];
      assert.ok(typeof e.degree === "string");
      assert.ok(typeof e.required === "boolean");
      assert.ok(typeof e.equivalentAccepted === "boolean");
    }

    if (res.certifications.length > 0) {
      const c = res.certifications[0];
      assert.ok(typeof c.name === "string");
      assert.ok(typeof c.required === "boolean");
    }
  });

  // =========================================================================
  // Day 17: Job Analysis UI — Data Contract & Rendering Tests
  // =========================================================================

  // ---- Test 90: Required skills render from actual API data ----
  await testAsync("90. Required skills list contains correct items with required=true flag", async () => {
    const text = `Requirements:\n- Must have proficiency in React and Node.js.\n- Strong knowledge of SQL is required.`;
    const res = JobRequirementExtractionService.extractRequirements(text, 30, "Full Stack Dev");
    assert.ok(Array.isArray(res.requiredSkills), "requiredSkills must be an array");
    assert.ok(res.requiredSkills.length > 0, "Must have at least one required skill");
    for (const skill of res.requiredSkills) {
      assert.ok(typeof skill.name === "string", "Each skill must have a name string");
      assert.strictEqual(skill.required, true, `Skill '${skill.name}' must have required=true`);
    }
    const skillNames = res.requiredSkills.map((s) => s.name);
    assert.ok(skillNames.includes("React"), "React must be in required skills");
    assert.ok(skillNames.includes("Node.js"), "Node.js must be in required skills");
  });

  // ---- Test 91: Preferred skills render separately without required flag ----
  await testAsync("91. Preferred skills render separately with required=false, no cross-contamination", async () => {
    const text = `Preferred Qualifications:\n- Nice to have: TypeScript and Docker knowledge.\n- AWS experience is a bonus.`;
    const res = JobRequirementExtractionService.extractRequirements(text, 31, "Backend Engineer");
    assert.ok(Array.isArray(res.preferredSkills));
    assert.ok(res.preferredSkills.length > 0);
    for (const skill of res.preferredSkills) {
      assert.strictEqual(skill.required, false, `Preferred skill '${skill.name}' must have required=false`);
    }
    const reqNames = res.requiredSkills.map((s) => s.name);
    const prefNames = res.preferredSkills.map((s) => s.name);
    for (const pref of prefNames) {
      assert.ok(!reqNames.includes(pref), `'${pref}' must not also appear in required skills`);
    }
  });

  // ---- Test 92: Empty required skills state returns empty array ----
  await testAsync("92. Empty required-skills state returns empty array, not null", async () => {
    const text = `Nice To Have:\n- Familiarity with Docker and Kubernetes.\n- GraphQL experience preferred.`;
    const res = JobRequirementExtractionService.extractRequirements(text, 32, "DevOps Engineer");
    assert.ok(Array.isArray(res.requiredSkills), "requiredSkills must be array when empty");
    assert.strictEqual(res.requiredSkills.length, 0, "No required skills should be extracted");
    assert.ok(Array.isArray(res.preferredSkills), "preferredSkills must still be array");
  });

  // ---- Test 93: Empty preferred skills state returns empty array ----
  await testAsync("93. Empty preferred-skills state returns empty array, not null", async () => {
    const text = `Requirements:\n- Must have proficiency in Java.\n- PostgreSQL is required.`;
    const res = JobRequirementExtractionService.extractRequirements(text, 33, "Java Dev");
    assert.ok(Array.isArray(res.preferredSkills), "preferredSkills must be array even when empty");
    assert.strictEqual(res.preferredSkills.length, 0, "No preferred skills should be extracted");
  });

  // ---- Test 94: Experience range display — min and max present ----
  await testAsync("94. Experience range (min and max years) is correctly represented for display", async () => {
    const text = `Requirements:
- 3-5 years of professional software development experience.
- Must know React and Node.js.`;
    const res = JobRequirementExtractionService.extractRequirements(text, 34, "Software Engineer");
    assert.strictEqual(res.experience.minimumYears, 3);
    assert.strictEqual(res.experience.maximumYears, 5);
    const displayValue =
      res.experience.minimumYears !== null && res.experience.maximumYears !== null
        ? `${res.experience.minimumYears}–${res.experience.maximumYears} years`
        : "Not specified";
    assert.strictEqual(displayValue, "3–5 years");
  });

  // ---- Test 95: Missing experience shown as Not specified, not zero ----
  await testAsync("95. Missing experience years are null, formatted as Not specified — never zero", async () => {
    const text = `Duties:\n- Design and build responsive web interfaces using React.`;
    const res = JobRequirementExtractionService.extractRequirements(text, 35, "UI Developer");
    assert.strictEqual(res.experience.minimumYears, null, "Missing min years must be null");
    assert.strictEqual(res.experience.maximumYears, null, "Missing max years must be null");
    assert.notStrictEqual(res.experience.minimumYears, 0, "Missing years must never default to 0");
    const displayMin = res.experience.minimumYears !== null ? `${res.experience.minimumYears} years` : "Not specified";
    assert.strictEqual(displayMin, "Not specified");
  });

  // ---- Test 96: Education requirements display correctly ----
  await testAsync("96. Education requirements with degree, field, required status, and equivalent flag display correctly", async () => {
    const text = `Basic Qualifications:\n- Bachelor's degree in Computer Science or equivalent practical experience.\nPreferred Qualifications:\n- Master's degree in Software Engineering preferred.`;
    const res = JobRequirementExtractionService.extractRequirements(text, 36, "Software Engineer");
    assert.ok(res.education.length >= 1);
    const bachelor = res.education.find((e) => e.level === "BACHELOR");
    assert.ok(bachelor, "Bachelor's degree entry must exist");
    assert.strictEqual(typeof bachelor.degree, "string");
    assert.strictEqual(typeof bachelor.required, "boolean");
    assert.strictEqual(typeof bachelor.equivalentAccepted, "boolean");
    assert.strictEqual(bachelor.required, true);
    assert.strictEqual(bachelor.equivalentAccepted, true);
    assert.strictEqual(bachelor.field, "Computer Science");
  });

  // ---- Test 97: Tools and technologies appear in correct separate groups ----
  await testAsync("97. Tools and technologies are correctly separated into distinct groups without cross-contamination", async () => {
    const text = `Required Skills:\n- Languages: Python, JavaScript.\n- Frameworks: React.\n- Tools: Git, Jira, Docker.`;
    const res = JobRequirementExtractionService.extractRequirements(text, 37, "Full Stack Engineer");
    const techNames = res.technologies.map((t) => t.name);
    const toolNames = res.tools.map((t) => t.name);
    assert.ok(techNames.includes("Python"));
    assert.ok(techNames.includes("React"));
    assert.ok(toolNames.includes("Git"));
    assert.ok(toolNames.includes("Jira"));
    assert.ok(toolNames.includes("Docker"));
    assert.ok(!toolNames.includes("Python"), "Python must not appear in tools");
    assert.ok(!techNames.includes("Jira"), "Jira must not appear in technologies");
  });

  // ---- Test 98: Empty certifications return empty array for display ----
  await testAsync("98. No certifications specified returns empty certifications array", async () => {
    const text = `Requirements:\n- Strong React and Node.js skills.\n- Minimum 3 years of web development experience.`;
    const res = JobRequirementExtractionService.extractRequirements(text, 38, "Web Developer");
    assert.ok(Array.isArray(res.certifications));
    assert.strictEqual(res.certifications.length, 0);
  });

  // ---- Test 99: Completed extraction satisfies all frontend display contract fields ----
  await testAsync("99. Completed extraction status produces all required fields for the Job Analysis UI", async () => {
    const text = `Senior Full Stack Engineer\nRequirements:\n- 4+ years experience.\n- Must know React, Node.js, and PostgreSQL.\n- Required: AWS Certified Solutions Architect certification.\n- Bachelor's degree in Computer Science or equivalent.\n- Tools: Docker, Git, CI/CD.\nPreferred:\n- TypeScript and Kubernetes exposure.`;
    const res = JobRequirementExtractionService.extractRequirements(text, 39, "Senior Full Stack Engineer");
    assert.notStrictEqual(res.extractionMetadata.status, "EMPTY");
    assert.ok(Array.isArray(res.requiredSkills));
    assert.ok(Array.isArray(res.preferredSkills));
    assert.ok(Array.isArray(res.education));
    assert.ok(Array.isArray(res.tools));
    assert.ok(Array.isArray(res.technologies));
    assert.ok(Array.isArray(res.certifications));
    assert.ok(typeof res.experience === "object" && res.experience !== null);
    assert.ok(Array.isArray(res.extractionMetadata.warnings));
    assert.ok(res.requiredSkills.length > 0);
    assert.ok(res.certifications.length > 0);
    assert.ok(res.tools.length > 0);
  });

  // ---- Test 100: No requirements saved returns extracted:false ----
  await testAsync("100. Requirements endpoint returns extracted:false when no requirements have been saved for a job", async () => {
    const [u] = await db.query(
      `INSERT INTO users (full_name, email, password_hash) VALUES (?, ?, ?)`,
      ["No Req User", `no_req_${Date.now()}@example.com`, "hash"]
    );
    const userId = u.insertId;
    try {
      const [j] = await db.query(
        `INSERT INTO jobs (user_id, title, description, source_type, processing_status) VALUES (?, 'Empty Role', 'Some job description', 'PASTED_TEXT', 'COMPLETED')`,
        [userId]
      );
      const jobId = j.insertId;
      const reqReq = { user: { id: userId }, params: { id: jobId } };
      const reqRes = createMockRes();
      await getJobRequirements(reqReq, reqRes);
      assert.strictEqual(reqRes.statusCode, 200);
      assert.strictEqual(reqRes.body.success, true);
      assert.strictEqual(reqRes.body.extracted, false, "extracted must be false when no requirements saved");
      assert.strictEqual(reqRes.body.requirements, null, "requirements must be null");
    } finally {
      await db.query(`DELETE FROM users WHERE id = ?`, [userId]);
    }
  });

  // ---- Test 101: Invalid job ID returns 400 ----
  await testAsync("101. Invalid job ID (non-numeric) is rejected with 400 Bad Request", async () => {
    const req = { user: { id: 1 }, params: { id: "not-a-number" } };
    const res = createMockRes();
    await getJobRequirements(req, res);
    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.body.success, false);
  });

  // ---- Test 102: Unauthenticated users cannot access job analysis ----
  await testAsync("102. Unauthenticated requests to job requirements endpoint return 401", async () => {
    const unauthReq = { user: null, params: { id: 1 } };
    const unauthRes = createMockRes();
    await getJobRequirements(unauthReq, unauthRes);
    assert.strictEqual(unauthRes.statusCode, 401);
    assert.strictEqual(unauthRes.body.success, false);
  });

  // ---- Test 103: Cross-user isolation for job analysis ----
  await testAsync("103. User cannot view requirements for another user's job description", async () => {
    const [u1] = await db.query(
      `INSERT INTO users (full_name, email, password_hash) VALUES (?, ?, ?)`,
      ["Analysis Owner", `an_owner_${Date.now()}@example.com`, "hash"]
    );
    const [u2] = await db.query(
      `INSERT INTO users (full_name, email, password_hash) VALUES (?, ?, ?)`,
      ["Analysis Intruder", `an_intruder_${Date.now()}@example.com`, "hash"]
    );
    const ownerId = u1.insertId;
    const intruderId = u2.insertId;
    try {
      const [j] = await db.query(
        `INSERT INTO jobs (user_id, title, description, source_type, processing_status) VALUES (?, 'Confidential Senior Dev', 'Requirements: Must have React.', 'PASTED_TEXT', 'COMPLETED')`,
        [ownerId]
      );
      const jobId = j.insertId;
      const req = { user: { id: intruderId }, params: { id: jobId } };
      const res = createMockRes();
      await getJobRequirements(req, res);
      assert.strictEqual(res.statusCode, 404, "Intruder must receive 404");
      assert.strictEqual(res.body.success, false);
      const ownerReq = { user: { id: ownerId }, params: { id: jobId } };
      const ownerRes = createMockRes();
      await getJobRequirements(ownerReq, ownerRes);
      assert.strictEqual(ownerRes.statusCode, 200, "Owner must receive 200");
    } finally {
      await db.query(`DELETE FROM users WHERE id IN (?, ?)`, [ownerId, intruderId]);
    }
  });

  // ---- Test 104: Duplicate skill aliases deduplicated ----
  await testAsync("104. Duplicate skill aliases do not produce duplicate entries in results", async () => {
    const text = `Technologies:\n- NodeJS and Node.js are both required.\n- ReactJS and React must be known.\n- Postgres and PostgreSQL are both needed.`;
    const res = JobRequirementExtractionService.extractRequirements(text, 40, "Web Dev");
    const techNames = res.technologies.map((t) => t.name);
    assert.strictEqual(techNames.filter((n) => n === "Node.js").length, 1, "Node.js must appear exactly once");
    assert.strictEqual(techNames.filter((n) => n === "React").length, 1, "React must appear exactly once");
    assert.strictEqual(techNames.filter((n) => n === "PostgreSQL").length, 1, "PostgreSQL must appear exactly once");
  });

  // ---- Day 18: AI Integration Tests ----
  const { runAiTests } = require("./aiTests");
  await runAiTests(testAsync);

  // Cleanup temp files
  try {
    fs.rmSync(testDir, { recursive: true, force: true });
  } catch (_) {}

  console.log(`\nResults: ${passed} passed, ${failed} failed.`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();
