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
  console.log("=== SkillLens AI — Day 11 Text Extraction & Parsing Test Suite ===");
  const testDir = path.join(__dirname, "temp_test_files");
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true });
  }

  let passed = 0;
  let failed = 0;

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

  // Cleanup temp files
  try {
    fs.rmSync(testDir, { recursive: true, force: true });
  } catch (_) {}

  console.log(`\nResults: ${passed} passed, ${failed} failed.`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();
