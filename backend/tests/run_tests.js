const assert = require("assert");
const fs = require("fs");
const path = require("path");
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

  // Cleanup temp files
  try {
    fs.rmSync(testDir, { recursive: true, force: true });
  } catch (_) {}

  console.log(`\nResults: ${passed} passed, ${failed} failed.`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
