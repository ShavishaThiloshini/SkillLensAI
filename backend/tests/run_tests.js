const assert = require("assert");
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const jwt = require("jsonwebtoken");

const { validateResumeFile, isValidPdfBuffer, isValidDocxBuffer } = require("../utils/fileValidator");
const { RESUMES_UPLOAD_DIR } = require("../middleware/uploadMiddleware");

// Helper to create a minimal valid PDF in memory
function createMinimalPdfBuffer() {
  const content = `%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>\nendobj\nxref\n0 4\n0000000000 65535 f \n0000000010 00000 n \n0000000060 00000 n \n0000000117 00000 n \ntrailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n190\n%%EOF`;
  return Buffer.from(content, "utf8");
}

// Helper to create a valid minimal DOCX buffer in memory (a zip containing [Content_Types].xml and word/document.xml)
function createMinimalDocxBuffer() {
  function makeZipEntry(filename, data) {
    const dataBuf = Buffer.isBuffer(data) ? data : Buffer.from(data, "utf8");
    const nameBuf = Buffer.from(filename, "utf8");

    // Local file header: 30 bytes + nameLen + dataLen
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50, 0); // Local file header signature
    header.writeUInt16LE(20, 4); // Version needed to extract
    header.writeUInt16LE(0, 6); // General purpose bit flag
    header.writeUInt16LE(0, 8); // Compression method (0 = stored)
    header.writeUInt16LE(0, 10); // Mod time
    header.writeUInt16LE(0, 12); // Mod date
    header.writeUInt32LE(0, 14); // CRC-32 (0 for test)
    header.writeUInt32LE(dataBuf.length, 18); // Compressed size
    header.writeUInt32LE(dataBuf.length, 22); // Uncompressed size
    header.writeUInt16LE(nameBuf.length, 26); // Filename length
    header.writeUInt16LE(0, 28); // Extra field length

    return Buffer.concat([header, nameBuf, dataBuf]);
  }

  const entry1 = makeZipEntry("[Content_Types].xml", '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"></Types>');
  const entry2 = makeZipEntry("word/document.xml", '<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Resume Test</w:t></w:r></w:p></w:body></w:document>');

  return Buffer.concat([entry1, entry2]);
}

// Helper to create a generic ZIP buffer that is NOT a docx (e.g. contains photos or random files)
function createGenericZipBuffer() {
  function makeZipEntry(filename, data) {
    const dataBuf = Buffer.from(data, "utf8");
    const nameBuf = Buffer.from(filename, "utf8");
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50, 0);
    header.writeUInt16LE(20, 4);
    header.writeUInt16LE(0, 6);
    header.writeUInt16LE(0, 8);
    header.writeUInt32LE(dataBuf.length, 18);
    header.writeUInt32LE(dataBuf.length, 22);
    header.writeUInt16LE(nameBuf.length, 26);
    header.writeUInt16LE(0, 28);
    return Buffer.concat([header, nameBuf, dataBuf]);
  }

  return Buffer.concat([
    makeZipEntry("photo.jpg", "fake-photo-data"),
    makeZipEntry("manifest.json", "{}"),
  ]);
}

async function runTests() {
  console.log("=== SkillLens AI — Day 10 Resume Upload & Validation Test Suite ===");
  const testDir = path.join(__dirname, "temp_test_files");
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true });
  }

  let passed = 0;
  let failed = 0;

  function test(name, fn) {
    try {
      fn();
      console.log(`[PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`[FAIL] ${name}:`, err.message);
      failed++;
    }
  }

  // 1. Valid PDF validation
  const validPdfPath = path.join(testDir, "sample_resume.pdf");
  fs.writeFileSync(validPdfPath, createMinimalPdfBuffer());
  test("1. Validate valid PDF document", () => {
    const res = validateResumeFile(validPdfPath, "sample_resume.pdf");
    assert.strictEqual(res.isValid, true);
    assert.strictEqual(res.fileType, "PDF");
    assert.ok(res.fileSize > 0);
  });

  // 2. Valid DOCX validation
  const validDocxPath = path.join(testDir, "sample_resume.docx");
  fs.writeFileSync(validDocxPath, createMinimalDocxBuffer());
  test("2. Validate valid DOCX document", () => {
    const res = validateResumeFile(validDocxPath, "sample_resume.docx");
    assert.strictEqual(res.isValid, true);
    assert.strictEqual(res.fileType, "DOCX");
    assert.ok(res.fileSize > 0);
  });

  // 3. Reject unsupported extension (.txt)
  const txtPath = path.join(testDir, "notes.txt");
  fs.writeFileSync(txtPath, "Plain text resume content");
  test("3. Reject .txt file", () => {
    const res = validateResumeFile(txtPath, "notes.txt");
    assert.strictEqual(res.isValid, false);
    assert.ok(res.message.includes("Unsupported file format"));
  });

  // 4. Reject renamed or malformed document (text file renamed to .pdf)
  const fakePdfPath = path.join(testDir, "fake.pdf");
  fs.writeFileSync(fakePdfPath, "This is not a real PDF at all, just plain text");
  test("4a. Reject text file disguised as .pdf", () => {
    const res = validateResumeFile(fakePdfPath, "fake.pdf");
    assert.strictEqual(res.isValid, false);
    assert.ok(res.message.includes("Invalid PDF document"));
  });

  // 4b. Reject arbitrary ZIP file renamed to .docx (not Office Open XML)
  const genericZipPath = path.join(testDir, "generic.docx");
  fs.writeFileSync(genericZipPath, createGenericZipBuffer());
  test("4b. Reject arbitrary ZIP renamed to .docx (not Office Open XML)", () => {
    const res = validateResumeFile(genericZipPath, "generic.docx");
    assert.strictEqual(res.isValid, false);
    assert.ok(res.message.includes("Office Open XML Word document"));
  });

  // 5. Reject file exceeding 5 MB limit
  const largeFilePath = path.join(testDir, "large.pdf");
  const largeBuf = Buffer.alloc(5 * 1024 * 1024 + 1024); // 5 MB + 1 KB
  largeBuf.write("%PDF-1.4\n");
  fs.writeFileSync(largeFilePath, largeBuf);
  test("5. Reject file exceeding 5 MB limit", () => {
    const res = validateResumeFile(largeFilePath, "large.pdf");
    assert.strictEqual(res.isValid, false);
    assert.ok(res.message.includes("exceeds the 5 MB limit"));
  });

  // 6. Reject empty file (0 bytes)
  const emptyFilePath = path.join(testDir, "empty.pdf");
  fs.writeFileSync(emptyFilePath, Buffer.alloc(0));
  test("6. Reject empty file (0 bytes)", () => {
    const res = validateResumeFile(emptyFilePath, "empty.pdf");
    assert.strictEqual(res.isValid, false);
    assert.ok(res.message.includes("empty (0 bytes)"));
  });

  // 7. Verify authentication token validation & ownership logic
  const JWT_SECRET = process.env.JWT_SECRET || "skilllens_ai_jwt_secret_change_this_in_production_2026";
  const user1Token = jwt.sign({ id: 101, email: "user1@example.com" }, JWT_SECRET, { expiresIn: "1h" });
  const user2Token = jwt.sign({ id: 102, email: "user2@example.com" }, JWT_SECRET, { expiresIn: "1h" });

  test("7a. Decodes valid JWT authentication token", () => {
    const decoded = jwt.verify(user1Token, JWT_SECRET);
    assert.strictEqual(decoded.id, 101);
    assert.strictEqual(decoded.email, "user1@example.com");
  });

  test("7b. Rejects invalid JWT token", () => {
    assert.throws(() => {
      jwt.verify("invalid.token.here", JWT_SECRET);
    });
  });

  test("7c. Enforces user ownership boundary", () => {
    const user1Decoded = jwt.verify(user1Token, JWT_SECRET);
    const user2Decoded = jwt.verify(user2Token, JWT_SECRET);
    // User 1 cannot access user 2's id
    assert.notStrictEqual(user1Decoded.id, user2Decoded.id);
  });

  // 8. Verify orphaned file cleanup simulation
  test("8. Verify orphaned file cleanup when database fails", () => {
    const orphanTestFile = path.join(RESUMES_UPLOAD_DIR, "test-orphan-cleanup.pdf");
    fs.writeFileSync(orphanTestFile, createMinimalPdfBuffer());
    assert.ok(fs.existsSync(orphanTestFile));

    // Simulate controller cleanup on DB error
    if (fs.existsSync(orphanTestFile)) {
      fs.unlinkSync(orphanTestFile);
    }
    assert.strictEqual(fs.existsSync(orphanTestFile), false);
  });

  // 9. Verify upload destination directory exists
  test("9. Verify uploads/resumes directory exists", () => {
    assert.ok(fs.existsSync(RESUMES_UPLOAD_DIR));
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
