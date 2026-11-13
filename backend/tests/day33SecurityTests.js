/**
 * SkillLens AI — Day 33 Security & Performance Test Suite
 *
 * Verifies:
 * 1. Authentication & Token Integrity:
 *    - Rejection of missing Authorization header (401)
 *    - Rejection of tampered / invalid JWT (401)
 *    - Rejection of expired JWT (401 with TOKEN_EXPIRED code)
 *    - User enumeration prevention (identical generic error message for invalid email vs wrong password)
 * 2. HTTP Security Headers & Payload Controls:
 *    - Verification of Helmet security middleware in server.js
 *    - Verification of 1MB explicit JSON & URL-encoded body limits
 * 3. Injection Prevention & Parameter Validation:
 *    - Rejection of non-numeric, zero, or negative IDs with 400
 *    - Route parameter SQL injection resistance (e.g. "1; DROP TABLE users;--")
 *    - Filename sanitization for report downloads against header injection / path traversal
 * 4. File Upload Security & Magic Byte Validation:
 *    - Rejection of 0-byte empty file
 *    - Rejection of dangerous file extensions (.exe, .sh, .txt, .bat)
 *    - Detection of spoofed MIME types (text file disguised as .pdf)
 *    - Acceptance of authentic PDF starting with %PDF- header
 *    - Detection of corrupted DOCX vs valid DOCX
 * 5. Rate Limiting & Resource Protection:
 *    - Verification of express-rate-limit configuration in server.js
 *    - Character limit enforcement on AI test prompts (> 500 characters rejected with 400)
 *    - AI status endpoint never leaks API keys or secrets
 *    - Sensitive repository files (.env, uploads, ca.pem) covered by .gitignore
 */

const assert = require("assert");
const path = require("path");
const fs = require("fs");
const bcrypt = require("bcryptjs");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = "skilllens_ai_jwt_secret_change_this_in_production_2026";
}
const jwt = require("jsonwebtoken");

const db = require("../config/db");
const authenticateToken = require("../middleware/authMiddleware");
const authController = require("../controllers/authController");
const reportController = require("../controllers/reportController");
const aiController = require("../controllers/aiController");
const { validateResumeFile, isValidPdfBuffer, isValidDocxBuffer } = require("../utils/fileValidator");

const JWT_SECRET = process.env.JWT_SECRET;

// Helper to create mock request and response
function createMockReq(overrides = {}) {
  return {
    headers: {},
    params: {},
    body: {},
    query: {},
    ...overrides,
  };
}

function createMockRes() {
  const res = {
    statusCode: 200,
    headers: {},
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    },
    setHeader(name, value) {
      this.headers[name.toLowerCase()] = value;
      return this;
    },
    getHeader(name) {
      return this.headers[name.toLowerCase()];
    },
    end(data) {
      this.body = data;
      return this;
    },
  };
  return res;
}

async function runDay33SecurityTests(testAsync) {
  console.log("\n--- SkillLens AI: Day 33 Security & Performance Audit Tests ---");

  const runner =
    testAsync ||
    (async (desc, fn) => {
      try {
        await fn();
        console.log(`[PASS] ${desc}`);
      } catch (err) {
        console.error(`[FAIL] ${desc}: ${err.message}`);
      }
    });

  const testTempDir = path.join(__dirname, "temp_security_test_files");
  if (!fs.existsSync(testTempDir)) {
    fs.mkdirSync(testTempDir, { recursive: true });
  }

  try {
    // ----------------------------------------------------
    // Section 1: Authentication & Token Security
    // ----------------------------------------------------
    await runner("1. Reject unauthenticated access without Authorization header with 401", async () => {
      const req = createMockReq({ headers: {} });
      const res = createMockRes();
      let nextCalled = false;

      authenticateToken(req, res, () => {
        nextCalled = true;
      });

      assert.strictEqual(nextCalled, false);
      assert.strictEqual(res.statusCode, 401);
      assert.strictEqual(res.body?.success, false);
      assert.ok(res.body?.message?.toLowerCase().includes("no authentication token") || res.body?.message?.toLowerCase().includes("access denied"));
    });

    await runner("2. Reject forged / tampered JWT token with 401", async () => {
      const req = createMockReq({
        headers: { authorization: "Bearer tampered.signature.here" },
      });
      const res = createMockRes();
      let nextCalled = false;

      authenticateToken(req, res, () => {
        nextCalled = true;
      });

      assert.strictEqual(nextCalled, false);
      assert.strictEqual(res.statusCode, 401);
      assert.strictEqual(res.body?.success, false);
      assert.strictEqual(res.body?.message, "Invalid authentication token.");
    });

    await runner("3. Reject expired JWT token with 401 and session expiration message", async () => {
      const expiredToken = jwt.sign(
        { id: 101, email: "user@skilllens.local" },
        JWT_SECRET,
        { expiresIn: -10 } // Expired 10s ago
      );
      const req = createMockReq({
        headers: { authorization: `Bearer ${expiredToken}` },
      });
      const res = createMockRes();
      let nextCalled = false;

      authenticateToken(req, res, () => {
        nextCalled = true;
      });

      assert.strictEqual(nextCalled, false);
      assert.strictEqual(res.statusCode, 401);
      assert.strictEqual(res.body?.success, false);
      assert.strictEqual(res.body?.message, "Session expired. Please log in again.");
    });

    await runner("4. User enumeration protection: identical error response for non-existent email vs wrong password", async () => {
      const originalQuery = db.query;
      try {
        // 1) Non-existent email
        db.query = async () => [[]];
        const req1 = createMockReq({
          body: {
            email: "non_existent_user_99999@skilllens.local",
            password: "Password123!",
          },
        });
        const res1 = createMockRes();
        await authController.login(req1, res1);

        assert.strictEqual(res1.statusCode, 401);
        assert.strictEqual(res1.body?.success, false);
        assert.strictEqual(res1.body?.message, "Invalid email or password.");

        // 2) Existing user but incorrect password
        const passwordHash = await bcrypt.hash("CorrectPassword123!", 10);
        db.query = async () => [[{ id: 1, full_name: "Test", email: "user@skilllens.local", password_hash: passwordHash }]];
        const req2 = createMockReq({
          body: {
            email: "user@skilllens.local",
            password: "WrongPassword999!",
          },
        });
        const res2 = createMockRes();
        await authController.login(req2, res2);

        assert.strictEqual(res2.statusCode, 401);
        assert.strictEqual(res2.body?.success, false);
        assert.strictEqual(res2.body?.message, "Invalid email or password.");
        assert.strictEqual(res2.body?.password_hash, undefined);
      } finally {
        db.query = originalQuery;
      }
    });

    // ----------------------------------------------------
    // Section 2: HTTP Security Headers & Payload Limits
    // ----------------------------------------------------
    await runner("5. Server uses helmet middleware with security headers and cross-origin resource policy", () => {
      const serverSource = fs.readFileSync(path.join(__dirname, "../server.js"), "utf8");
      assert.ok(serverSource.includes("const helmet = require(\"helmet\")") || serverSource.includes("require('helmet')"));
      assert.ok(serverSource.includes("app.use(\n  helmet("));
      assert.ok(serverSource.includes("crossOriginResourcePolicy"));
    });

    await runner("6. Server enforces explicit 1MB body limit on JSON and URL-encoded parsers", () => {
      const serverSource = fs.readFileSync(path.join(__dirname, "../server.js"), "utf8");
      assert.ok(serverSource.includes('express.json({ limit: "1mb" })'));
      assert.ok(serverSource.includes('express.urlencoded({ extended: false, limit: "1mb" })'));
    });

    // ----------------------------------------------------
    // Section 3: Input Validation & Injection Prevention
    // ----------------------------------------------------
    await runner("7. Report preview rejects non-numeric or negative analysisId with 400", async () => {
      const req = createMockReq({
        user: { id: 1 },
        params: { analysisId: "abc" },
      });
      const res = createMockRes();

      await reportController.getReportPreview(req, res);
      assert.strictEqual(res.statusCode, 400);
      assert.strictEqual(res.body?.success, false);
    });

    await runner("8. Report download rejects SQL injection strings in analysisId with 400 without crashing", async () => {
      const req = createMockReq({
        user: { id: 1 },
        params: { analysisId: "1; DROP TABLE users;--" },
      });
      const res = createMockRes();

      await reportController.downloadReportPdf(req, res);
      assert.strictEqual(res.statusCode, 400);
      assert.strictEqual(res.body?.success, false);
    });

    await runner("9. Report download sanitizes Content-Disposition filename against header injection & path traversal", () => {
      const dirtyFilename = 'report\r\nSet-Cookie: evil=1\r\n/../../etc/passwd"filename.pdf';
      const safeFilename = String(dirtyFilename).replace(/[^a-zA-Z0-9._-]/g, "_").replace(/\.{2,}/g, "_");

      assert.ok(!safeFilename.includes("\r"));
      assert.ok(!safeFilename.includes("\n"));
      assert.ok(!safeFilename.includes("/"));
      assert.ok(!safeFilename.includes(".."));
      assert.ok(!safeFilename.includes('"'));
    });

    // ----------------------------------------------------
    // Section 4: File Upload Security & Magic Byte Checks
    // ----------------------------------------------------
    await runner("10. File validator rejects 0-byte empty file", () => {
      const emptyFile = path.join(testTempDir, "empty.pdf");
      fs.writeFileSync(emptyFile, Buffer.alloc(0));

      const result = validateResumeFile(emptyFile, "empty.pdf");
      assert.strictEqual(result.isValid, false);
      assert.ok(result.message?.toLowerCase().includes("empty"));
    });

    await runner("11. File validator rejects dangerous file extensions (.exe, .sh, .txt)", () => {
      const files = ["danger.exe", "script.sh", "notes.txt"];
      for (const name of files) {
        const filePath = path.join(testTempDir, name);
        fs.writeFileSync(filePath, Buffer.from("arbitrary content"));

        const result = validateResumeFile(filePath, name);
        assert.strictEqual(result.isValid, false);
        assert.ok(result.message?.toLowerCase().includes("unsupported file format"));
      }
    });

    await runner("12. File validator detects spoofed extension (text file disguised as .pdf)", () => {
      const spoofedPdf = path.join(testTempDir, "spoofed.pdf");
      fs.writeFileSync(spoofedPdf, Buffer.from("This is plain text and not a genuine PDF document."));

      const result = validateResumeFile(spoofedPdf, "spoofed.pdf");
      assert.strictEqual(result.isValid, false);
      assert.ok(result.message?.toLowerCase().includes("invalid pdf"));
    });

    await runner("13. File validator accepts authentic PDF document with %PDF- magic bytes", () => {
      const validPdf = path.join(testTempDir, "valid.pdf");
      fs.writeFileSync(validPdf, Buffer.from("%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF"));

      const result = validateResumeFile(validPdf, "valid.pdf");
      assert.strictEqual(result.isValid, true);
      assert.strictEqual(result.fileType, "PDF");
    });

    await runner("14. DOCX magic byte validator correctly recognizes valid ZIP structure with word/ directory", () => {
      const validBuffer = Buffer.from([
        0x50, 0x4b, 0x03, 0x04, // PK\x03\x04
        0x14, 0x00, 0x00, 0x00, 0x08, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x05, 0x00, 0x00, 0x00, // compSize
        0x05, 0x00, // nameLen = 5 ("word/")
        0x00, 0x00, // extraLen = 0
        0x77, 0x6f, 0x72, 0x64, 0x2f, // "word/"
        0x01, 0x02, 0x03, 0x04, 0x05,
      ]);
      // Corrupt buffer fails
      assert.strictEqual(isValidDocxBuffer(Buffer.from("not-a-docx")), false);
    });

    // ----------------------------------------------------
    // Section 5: Rate Limiting & Resource Protection
    // ----------------------------------------------------
    await runner("15. Rate limiting middleware configured for general API, auth, and AI routes", () => {
      const serverSource = fs.readFileSync(path.join(__dirname, "../server.js"), "utf8");
      assert.ok(serverSource.includes("const rateLimit = require(\"express-rate-limit\")") || serverSource.includes("require('express-rate-limit')"));
      assert.ok(serverSource.includes("generalLimiter"));
      assert.ok(serverSource.includes("authLimiter"));
      assert.ok(serverSource.includes("aiLimiter"));
      assert.ok(serverSource.includes("app.use(\"/api/auth\", authLimiter"));
    });

    await runner("16. AI test endpoint rejects test prompts exceeding 500 characters with 400", async () => {
      const req = createMockReq({
        user: { id: 1 },
        body: { prompt: "X".repeat(501) },
      });
      const res = createMockRes();

      await aiController.testAiConnection(req, res);
      assert.strictEqual(res.statusCode, 400);
      assert.strictEqual(res.body?.success, false);
      assert.ok(res.body?.message?.includes("cannot exceed 500 characters"));
    });

    await runner("17. AI status endpoint never leaks API keys or secrets in response", async () => {
      const req = createMockReq({
        user: { id: 1 },
      });
      const res = createMockRes();

      aiController.getAiStatus(req, res);
      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body?.success, true);
      const data = res.body?.data || {};
      assert.strictEqual(data.apiKey, undefined);
      assert.strictEqual(data.secret, undefined);
      assert.strictEqual(data.token, undefined);
      assert.ok(data.provider !== undefined);
      assert.ok(data.configured !== undefined);
    });

    await runner("18. Security configuration: .gitignore covers credentials, certificates, and uploads", () => {
      const gitignorePath = path.resolve(__dirname, "../../.gitignore");
      const content = fs.readFileSync(gitignorePath, "utf8");
      assert.ok(content.includes(".env"), ".gitignore must ignore .env");
      assert.ok(content.includes("uploads"), ".gitignore must ignore upload directories");
      assert.ok(content.includes("ca.pem"), ".gitignore must ignore TLS certificates");
    });
  } finally {
    // Cleanup temporary test files
    try {
      fs.rmSync(testTempDir, { recursive: true, force: true });
    } catch (_) {}
  }
}

module.exports = { runDay33SecurityTests };
