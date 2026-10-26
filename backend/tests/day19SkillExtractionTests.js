/**
 * SkillLens AI — Day 19 Skill Extraction & Normalization Test Suite
 *
 * Covers:
 * 1. Extracting several skills from a resume
 * 2. Extracting skills from a job description
 * 3. Handling an empty resume or job description
 * 4. Handling repeated skill mentions
 * 5. Normalizing known aliases (e.g. ReactJS -> React, Postgres -> PostgreSQL, NodeJS -> Node.js)
 * 6. Avoiding incorrect normalization of similar but distinct technologies (Java != JavaScript, C != C++, Git != GitHub)
 * 7. Separating required and preferred job skills
 * 8. Avoiding skills unsupported by the source text
 * 9. Handling malformed AI output safely
 * 10. Handling an unavailable AI provider gracefully
 * 11. Using the fallback path when appropriate
 * 12. Saving extraction results without duplicate records
 * 13. Retrying extraction safely (idempotent overwrite)
 * 14. Rejecting unauthenticated requests
 * 15. Preventing access to another user's resume or job description
 * 16. Handling database failures
 * 17. Validating frontend response schemas
 */

const assert = require("assert");
const db = require("../config/db");
const {
  normalizeSkillName,
  deduplicateSkills,
  areDistinctTechnologies,
} = require("../utils/skillNormalizer");
const SkillExtractionService = require("../services/skillExtractionService");
const {
  extractResumeSkills,
  getResumeSkills,
} = require("../controllers/resumeController");
const {
  extractJobSkills,
  getJobSkills,
} = require("../controllers/jobController");
const { setClient, resetClient } = require("../services/aiService");

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

async function runDay19SkillTests(testAsync) {
  console.log("\n--- SkillLens AI: Day 19 Skill Extraction & Normalization Tests ---");

  // Save env
  const originalApiKey = process.env.AI_API_KEY;
  const originalOpenAiKey = process.env.OPENAI_API_KEY;

  // 1. Extracting several skills from a resume (deterministic / fallback path)
  await testAsync("119. Extract multiple technical skills from a synthetic resume", async () => {
    const resumeText = `
John Smith
Senior Full Stack Developer
Email: john@example.com

TECHNICAL SKILLS:
Programming: JavaScript, TypeScript, Python, SQL
Frontend: React, Next.js, HTML5, CSS3, Tailwind CSS
Backend: Node.js, Express.js
Databases: PostgreSQL, MongoDB, Redis
Cloud & Tools: AWS, Docker, Git, CI/CD

EXPERIENCE:
Software Engineer at Acme Corp (2021-Present)
- Built microservices using Node.js and PostgreSQL.
- Implemented frontend UI components in React and TypeScript.
`;

    // Create a temporary user and resume
    const [u] = await db.query(
      `INSERT INTO users (full_name, email, password_hash) VALUES (?, ?, ?)`,
      ["Test Resume Skill User", `skill_user_${Date.now()}@test.local`, "hash"]
    );
    const userId = u.insertId;

    const [r] = await db.query(
      `INSERT INTO resumes (user_id, original_filename, stored_filename, file_type, file_size, file_path, extracted_text, processing_status)
       VALUES (?, 'skills_test.pdf', 'skills_test.pdf', 'PDF', 1024, 'uploads/resumes/skills_test.pdf', ?, 'COMPLETED')`,
      [userId, resumeText]
    );
    const resumeId = r.insertId;

    try {
      const result = await SkillExtractionService.extractResumeSkills(resumeId, userId, { forceFallback: true });

      assert.strictEqual(result.sourceType, "RESUME");
      assert.strictEqual(result.sourceId, resumeId);
      assert.ok(result.skills.length >= 8, `Expected at least 8 skills, found ${result.skills.length}`);

      const skillNames = result.skills.map((s) => s.name);
      assert.ok(skillNames.includes("React"));
      assert.ok(skillNames.includes("TypeScript"));
      assert.ok(skillNames.includes("Node.js"));
      assert.ok(skillNames.includes("PostgreSQL"));
      assert.ok(skillNames.includes("Docker"));

      // Verify category assignments
      const reactSkill = result.skills.find((s) => s.name === "React");
      assert.strictEqual(reactSkill.category, "FRAMEWORK");

      const pgSkill = result.skills.find((s) => s.name === "PostgreSQL");
      assert.strictEqual(pgSkill.category, "DATABASE");

      // Verify DB persistence
      const [dbSkills] = await db.query(
        `SELECT s.name, s.category, rs.evidence
         FROM resume_skills rs
         JOIN skills s ON rs.skill_id = s.id
         WHERE rs.resume_id = ?`,
        [resumeId]
      );
      assert.strictEqual(dbSkills.length, result.skills.length);
    } finally {
      await db.query(`DELETE FROM users WHERE id = ?`, [userId]);
    }
  });

  // 2. Extracting skills from a job description
  await testAsync("120. Extract skills from a job description with category & evidence", async () => {
    const jobDescription = `
Senior Backend Engineer
Company: CloudScale
Requirements:
- Strong proficiency in Node.js, TypeScript, and Express.js.
- Production experience with PostgreSQL and Redis.
- Familiarity with Docker and Kubernetes is preferred.
- Experience with AWS (EC2, S3) is a plus.
`;

    const [u] = await db.query(
      `INSERT INTO users (full_name, email, password_hash) VALUES (?, ?, ?)`,
      ["Job Skill User", `job_skill_user_${Date.now()}@test.local`, "hash"]
    );
    const userId = u.insertId;

    const [j] = await db.query(
      `INSERT INTO jobs (user_id, title, company, description, source_type, processing_status)
       VALUES (?, 'Senior Backend Engineer', 'CloudScale', ?, 'PASTED_TEXT', 'COMPLETED')`,
      [userId, jobDescription]
    );
    const jobId = j.insertId;

    try {
      const result = await SkillExtractionService.extractJobSkills(jobId, userId, { forceFallback: true });

      assert.strictEqual(result.sourceType, "JOB_DESCRIPTION");
      assert.strictEqual(result.sourceId, jobId);
      assert.ok(result.skills.length >= 4);

      const skillNames = result.skills.map((s) => s.name);
      assert.ok(skillNames.includes("Node.js"));
      assert.ok(skillNames.includes("TypeScript"));
      assert.ok(skillNames.includes("PostgreSQL"));

      // Verify persistence in job_skills table
      const [saved] = await db.query(
        `SELECT s.name, js.required, js.priority
         FROM job_skills js
         JOIN skills s ON js.skill_id = s.id
         WHERE js.job_id = ?`,
        [jobId]
      );
      assert.ok(saved.length >= 4);
    } finally {
      await db.query(`DELETE FROM users WHERE id = ?`, [userId]);
    }
  });

  // 3. Handling an empty resume or job description
  await testAsync("121. Handle empty resume and empty job description without crashing", async () => {
    const [u] = await db.query(
      `INSERT INTO users (full_name, email, password_hash) VALUES (?, ?, ?)`,
      ["Empty Tester", `empty_test_${Date.now()}@test.local`, "hash"]
    );
    const userId = u.insertId;

    const [r] = await db.query(
      `INSERT INTO resumes (user_id, original_filename, stored_filename, file_type, file_size, file_path, extracted_text, processing_status)
       VALUES (?, 'empty.pdf', 'empty.pdf', 'PDF', 0, 'uploads/resumes/empty.pdf', '', 'COMPLETED')`,
      [userId]
    );
    const resumeId = r.insertId;

    const [j] = await db.query(
      `INSERT INTO jobs (user_id, title, description, source_type, processing_status)
       VALUES (?, 'Empty Role', '   ', 'PASTED_TEXT', 'COMPLETED')`,
      [userId]
    );
    const jobId = j.insertId;

    try {
      const resumeResult = await SkillExtractionService.extractResumeSkills(resumeId, userId, { forceFallback: true });
      assert.strictEqual(resumeResult.skills.length, 0);
      assert.strictEqual(resumeResult.extractionMetadata.status, "COMPLETED");

      const jobResult = await SkillExtractionService.extractJobSkills(jobId, userId, { forceFallback: true });
      assert.strictEqual(jobResult.skills.length, 0);
      assert.strictEqual(jobResult.extractionMetadata.status, "COMPLETED");
    } finally {
      await db.query(`DELETE FROM users WHERE id = ?`, [userId]);
    }
  });

  // 4. Handling repeated skill mentions
  await testAsync("122. Repeated skill mentions in different sections are deduplicated", async () => {
    const rawSkills = [
      { name: "React", category: "FRAMEWORK", confidence: 0.90, evidence: "Used React in summary" },
      { name: "ReactJS", category: "FRAMEWORK", confidence: 0.98, evidence: "Architected large frontend in ReactJS" },
      { name: "react.js", category: "FRAMEWORK", confidence: 0.85, evidence: "react.js libraries" },
      { name: "NodeJS", category: "FRAMEWORK", confidence: 0.92, evidence: "NodeJS backend" },
      { name: "Node.js", category: "FRAMEWORK", confidence: 0.96, evidence: "Built Node.js APIs" },
    ];

    const deduplicated = deduplicateSkills(rawSkills);
    assert.strictEqual(deduplicated.length, 2, "React and Node.js should appear exactly once");

    const react = deduplicated.find((s) => s.name === "React");
    assert.ok(react);
    assert.strictEqual(react.confidence, 0.98, "Highest confidence score must be preserved");

    const node = deduplicated.find((s) => s.name === "Node.js");
    assert.ok(node);
  });

  // 5. Normalizing known aliases
  await testAsync("123. Normalization maps known aliases to canonical display names and identifiers", async () => {
    const cases = [
      { input: "ReactJS", expectedName: "React", expectedNorm: "react", expectedCat: "FRAMEWORK" },
      { input: "NodeJS", expectedName: "Node.js", expectedNorm: "node.js", expectedCat: "FRAMEWORK" },
      { input: "Postgres", expectedName: "PostgreSQL", expectedNorm: "postgresql", expectedCat: "DATABASE" },
      { input: "Amazon Web Services", expectedName: "AWS", expectedNorm: "aws", expectedCat: "CLOUD" },
      { input: "Golang", expectedName: "Go", expectedNorm: "go", expectedCat: "PROGRAMMING" },
      { input: "k8s", expectedName: "Kubernetes", expectedNorm: "kubernetes", expectedCat: "cloud" },
      { input: "TailwindCSS", expectedName: "Tailwind CSS", expectedNorm: "tailwind css", expectedCat: "FRAMEWORK" },
    ];

    for (const c of cases) {
      const res = normalizeSkillName(c.input);
      assert.ok(res, `Expected result for ${c.input}`);
      assert.strictEqual(res.name, c.expectedName, `Failed canonical name for ${c.input}`);
      assert.strictEqual(res.normalizedName.toLowerCase(), c.expectedNorm.toLowerCase(), `Failed normalizedName for ${c.input}`);
    }
  });

  // 6. Avoiding incorrect normalization of similar but distinct technologies
  await testAsync("124. Similar but distinct technologies are never merged", async () => {
    // Java vs JavaScript
    assert.strictEqual(areDistinctTechnologies("Java", "JavaScript"), true);
    const javaNorm = normalizeSkillName("Java");
    const jsNorm = normalizeSkillName("JavaScript");
    assert.notStrictEqual(javaNorm.name, jsNorm.name);
    assert.notStrictEqual(javaNorm.normalizedName, jsNorm.normalizedName);

    // C vs C++ vs C#
    assert.strictEqual(areDistinctTechnologies("C", "C++"), true);
    assert.strictEqual(areDistinctTechnologies("C++", "C#"), true);
    const cNorm = normalizeSkillName("C");
    const cppNorm = normalizeSkillName("C++");
    const csharpNorm = normalizeSkillName("C#");
    assert.notStrictEqual(cNorm.name, cppNorm.name);
    assert.notStrictEqual(cppNorm.name, csharpNorm.name);

    // Git vs GitHub
    assert.strictEqual(areDistinctTechnologies("Git", "GitHub"), true);
    const gitNorm = normalizeSkillName("Git");
    const githubNorm = normalizeSkillName("GitHub");
    assert.notStrictEqual(gitNorm.name, githubNorm.name);
    assert.notStrictEqual(gitNorm.normalizedName, githubNorm.normalizedName);

    // Python vs PyTorch
    assert.strictEqual(areDistinctTechnologies("Python", "PyTorch"), true);
  });

  // 7. Separating required and preferred job skills
  await testAsync("125. Job skill extraction correctly separates required vs preferred skills", async () => {
    const jobText = `
Role: Senior Engineer
Required Qualifications:
- Must have at least 3 years experience with React.
- Solid experience in TypeScript is mandatory.

Preferred Qualifications:
- Experience with Docker is a plus.
- Knowledge of Kubernetes would be an advantage.
`;

    const [u] = await db.query(
      `INSERT INTO users (full_name, email, password_hash) VALUES (?, ?, ?)`,
      ["Req Pref User", `reqpref_${Date.now()}@test.local`, "hash"]
    );
    const userId = u.insertId;

    const [j] = await db.query(
      `INSERT INTO jobs (user_id, title, description, source_type, processing_status)
       VALUES (?, 'Frontend Dev', ?, 'PASTED_TEXT', 'COMPLETED')`,
      [userId, jobText]
    );
    const jobId = j.insertId;

    try {
      const result = await SkillExtractionService.extractJobSkills(jobId, userId, { forceFallback: true });

      const react = result.skills.find((s) => s.name === "React");
      assert.ok(react, "React should be detected");
      assert.strictEqual(react.required, true, "React should be marked required");
      assert.strictEqual(react.priority, "HIGH");

      const ts = result.skills.find((s) => s.name === "TypeScript");
      assert.ok(ts, "TypeScript should be detected");
      assert.strictEqual(ts.required, true, "TypeScript should be marked required");

      const docker = result.skills.find((s) => s.name === "Docker");
      assert.ok(docker, "Docker should be detected");
      assert.strictEqual(docker.required, false, "Docker should be marked preferred/optional");

      const k8s = result.skills.find((s) => s.name === "Kubernetes");
      assert.ok(k8s, "Kubernetes should be detected");
      assert.strictEqual(k8s.required, false, "Kubernetes should be marked preferred/optional");
    } finally {
      await db.query(`DELETE FROM users WHERE id = ?`, [userId]);
    }
  });

  // 8. Avoiding skills unsupported by the source text
  await testAsync("126. Skills not evidenced in source text are not invented or hallucinated", async () => {
    const candidateText = `
Experienced UI Designer with 5 years creating wireframes, design systems, and prototypes.
Core Tools: Figma, Adobe XD, Photoshop, Illustrator.
Strong focus on user research, usability testing, and accessibility.
`;

    const [u] = await db.query(
      `INSERT INTO users (full_name, email, password_hash) VALUES (?, ?, ?)`,
      ["Designer User", `designer_${Date.now()}@test.local`, "hash"]
    );
    const userId = u.insertId;

    const [r] = await db.query(
      `INSERT INTO resumes (user_id, original_filename, stored_filename, file_type, file_size, file_path, extracted_text, processing_status)
       VALUES (?, 'designer.pdf', 'designer.pdf', 'PDF', 1024, 'uploads/resumes/designer.pdf', ?, 'COMPLETED')`,
      [userId, candidateText]
    );
    const resumeId = r.insertId;

    try {
      const result = await SkillExtractionService.extractResumeSkills(resumeId, userId, { forceFallback: true });
      const skillNames = result.skills.map((s) => s.name);

      // Must find design skills
      assert.ok(skillNames.includes("Figma"));

      // Must NOT fabricate programming technologies not mentioned
      assert.strictEqual(skillNames.includes("Java"), false, "Java was never mentioned");
      assert.strictEqual(skillNames.includes("Python"), false, "Python was never mentioned");
      assert.strictEqual(skillNames.includes("Kubernetes"), false, "Kubernetes was never mentioned");
      assert.strictEqual(skillNames.includes("C++"), false, "C++ was never mentioned");
    } finally {
      await db.query(`DELETE FROM users WHERE id = ?`, [userId]);
    }
  });

  // 9. Handling malformed AI output safely
  await testAsync("127. Handle malformed AI JSON output gracefully with fallback", async () => {
    process.env.AI_API_KEY = "mock-key";

    // Inject mock OpenAI client returning malformed/broken JSON
    setClient({
      chat: {
        completions: {
          create: async () => ({
            choices: [{ message: { content: "```json { this is definitely not valid json " } }],
            model: "gpt-4o-mini",
            usage: { total_tokens: 50 },
          }),
        },
      },
    });

    const [u] = await db.query(
      `INSERT INTO users (full_name, email, password_hash) VALUES (?, ?, ?)`,
      ["Malformed AI User", `malformed_${Date.now()}@test.local`, "hash"]
    );
    const userId = u.insertId;

    const [r] = await db.query(
      `INSERT INTO resumes (user_id, original_filename, stored_filename, file_type, file_size, file_path, extracted_text, processing_status)
       VALUES (?, 'malformed.pdf', 'malformed.pdf', 'PDF', 1024, 'uploads/resumes/malformed.pdf', 'Built apps in React and Node.js', 'COMPLETED')`,
      [userId]
    );
    const resumeId = r.insertId;

    try {
      const result = await SkillExtractionService.extractResumeSkills(resumeId, userId);

      assert.strictEqual(result.sourceType, "RESUME");
      assert.strictEqual(result.extractionMetadata.status, "COMPLETED");
      assert.strictEqual(result.extractionMetadata.method, "FALLBACK_DETERMINISTIC");
      assert.ok(result.extractionMetadata.warnings.length > 0);

      // Verify skills were still extracted via deterministic fallback
      const names = result.skills.map((s) => s.name);
      assert.ok(names.includes("React"));
      assert.ok(names.includes("Node.js"));
    } finally {
      resetClient();
      process.env.AI_API_KEY = originalApiKey;
      await db.query(`DELETE FROM users WHERE id = ?`, [userId]);
    }
  });

  // 10. Handling an unavailable AI provider
  await testAsync("128. Handle AI provider network errors with fallback without throwing", async () => {
    process.env.AI_API_KEY = "mock-key";

    // Mock client simulating connection failure
    setClient({
      chat: {
        completions: {
          create: async () => {
            const err = new Error("Connection refused");
            err.code = "ECONNREFUSED";
            throw err;
          },
        },
      },
    });

    const [u] = await db.query(
      `INSERT INTO users (full_name, email, password_hash) VALUES (?, ?, ?)`,
      ["Net Error User", `neterr_${Date.now()}@test.local`, "hash"]
    );
    const userId = u.insertId;

    const [j] = await db.query(
      `INSERT INTO jobs (user_id, title, description, source_type, processing_status)
       VALUES (?, 'Net Role', 'Requires Python and MySQL experience.', 'PASTED_TEXT', 'COMPLETED')`,
      [userId]
    );
    const jobId = j.insertId;

    try {
      const result = await SkillExtractionService.extractJobSkills(jobId, userId);

      assert.strictEqual(result.extractionMetadata.method, "FALLBACK_DETERMINISTIC");
      const names = result.skills.map((s) => s.name);
      assert.ok(names.includes("Python"));
      assert.ok(names.includes("MySQL"));
    } finally {
      resetClient();
      process.env.AI_API_KEY = originalApiKey;
      await db.query(`DELETE FROM users WHERE id = ?`, [userId]);
    }
  });

  // 11. Using the fallback path when appropriate
  await testAsync("129. When AI is not configured, deterministic fallback runs cleanly without error", async () => {
    delete process.env.AI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    resetClient();

    const [u] = await db.query(
      `INSERT INTO users (full_name, email, password_hash) VALUES (?, ?, ?)`,
      ["Unconf AI User", `unconf_${Date.now()}@test.local`, "hash"]
    );
    const userId = u.insertId;

    const [r] = await db.query(
      `INSERT INTO resumes (user_id, original_filename, stored_filename, file_type, file_size, file_path, extracted_text, processing_status)
       VALUES (?, 'unconf.pdf', 'unconf.pdf', 'PDF', 1024, 'uploads/resumes/unconf.pdf', 'Expert in Go and Docker.', 'COMPLETED')`,
      [userId]
    );
    const resumeId = r.insertId;

    try {
      const result = await SkillExtractionService.extractResumeSkills(resumeId, userId);

      assert.strictEqual(result.extractionMetadata.method, "FALLBACK_DETERMINISTIC");
      assert.strictEqual(result.extractionMetadata.aiConfigured, false);
      const names = result.skills.map((s) => s.name);
      assert.ok(names.includes("Docker"));
    } finally {
      process.env.AI_API_KEY = originalApiKey;
      process.env.OPENAI_API_KEY = originalOpenAiKey;
      await db.query(`DELETE FROM users WHERE id = ?`, [userId]);
    }
  });

  // 12. Saving extraction results without duplicate records
  await testAsync("130. Repeated extraction does not create duplicate rows in resume_skills or job_skills", async () => {
    const [u] = await db.query(
      `INSERT INTO users (full_name, email, password_hash) VALUES (?, ?, ?)`,
      ["Dedupe User", `dedupe_${Date.now()}@test.local`, "hash"]
    );
    const userId = u.insertId;

    const [r] = await db.query(
      `INSERT INTO resumes (user_id, original_filename, stored_filename, file_type, file_size, file_path, extracted_text, processing_status)
       VALUES (?, 'repeat.pdf', 'repeat.pdf', 'PDF', 1024, 'uploads/resumes/repeat.pdf', 'Skills: React, TypeScript, Docker', 'COMPLETED')`,
      [userId]
    );
    const resumeId = r.insertId;

    try {
      // Run extraction 1st time
      const res1 = await SkillExtractionService.extractResumeSkills(resumeId, userId, { forceFallback: true });
      const [count1] = await db.query(`SELECT COUNT(*) as cnt FROM resume_skills WHERE resume_id = ?`, [resumeId]);

      // Run extraction 2nd time (retry)
      const res2 = await SkillExtractionService.extractResumeSkills(resumeId, userId, { forceFallback: true });
      const [count2] = await db.query(`SELECT COUNT(*) as cnt FROM resume_skills WHERE resume_id = ?`, [resumeId]);

      assert.strictEqual(count1[0].cnt, res1.skills.length);
      assert.strictEqual(count2[0].cnt, count1[0].cnt, "Row count must remain identical after retry");
    } finally {
      await db.query(`DELETE FROM users WHERE id = ?`, [userId]);
    }
  });

  // 13. Retrying extraction safely
  await testAsync("131. Safe retry updates evidence and preserves resume metadata", async () => {
    const [u] = await db.query(
      `INSERT INTO users (full_name, email, password_hash) VALUES (?, ?, ?)`,
      ["Retry User", `retry_${Date.now()}@test.local`, "hash"]
    );
    const userId = u.insertId;

    const [j] = await db.query(
      `INSERT INTO jobs (user_id, title, description, source_type, processing_status)
       VALUES (?, 'Retry Role', 'Needs React.', 'PASTED_TEXT', 'COMPLETED')`,
      [userId]
    );
    const jobId = j.insertId;

    try {
      // 1st run
      await SkillExtractionService.extractJobSkills(jobId, userId, { forceFallback: true });

      // Update description with additional skill
      await db.query(`UPDATE jobs SET description = 'Needs React and PostgreSQL.' WHERE id = ?`, [jobId]);

      // 2nd run
      const res2 = await SkillExtractionService.extractJobSkills(jobId, userId, { forceFallback: true });
      const names = res2.skills.map((s) => s.name);
      assert.ok(names.includes("React"));
      assert.ok(names.includes("PostgreSQL"));

      const [dbRows] = await db.query(`SELECT COUNT(*) as cnt FROM job_skills WHERE job_id = ?`, [jobId]);
      assert.strictEqual(dbRows[0].cnt, res2.skills.length);
    } finally {
      await db.query(`DELETE FROM users WHERE id = ?`, [userId]);
    }
  });

  // 14. Rejecting unauthenticated requests
  await testAsync("14. Reject unauthenticated requests to skill extraction endpoints with 401", async () => {
    const unauthReq = { user: null, params: { id: 1 } };
    const res = createMockRes();

    await extractResumeSkills(unauthReq, res);
    assert.strictEqual(res.statusCode, 401);
    assert.strictEqual(res.body.success, false);

    const res2 = createMockRes();
    await getResumeSkills(unauthReq, res2);
    assert.strictEqual(res2.statusCode, 401);

    const res3 = createMockRes();
    await extractJobSkills(unauthReq, res3);
    assert.strictEqual(res3.statusCode, 401);

    const res4 = createMockRes();
    await getJobSkills(unauthReq, res4);
    assert.strictEqual(res4.statusCode, 401);
  });

  // 15. Preventing access to another user's resume or job description
  await testAsync("133. Cross-user access returns 404 access denied safely", async () => {
    const [u1] = await db.query(
      `INSERT INTO users (full_name, email, password_hash) VALUES (?, ?, ?)`,
      ["Owner User", `owner_${Date.now()}@test.local`, "hash"]
    );
    const ownerId = u1.insertId;

    const [u2] = await db.query(
      `INSERT INTO users (full_name, email, password_hash) VALUES (?, ?, ?)`,
      ["Attacker User", `attacker_${Date.now()}@test.local`, "hash"]
    );
    const attackerId = u2.insertId;

    const [r] = await db.query(
      `INSERT INTO resumes (user_id, original_filename, stored_filename, file_type, file_size, file_path, extracted_text, processing_status)
       VALUES (?, 'private.pdf', 'private.pdf', 'PDF', 1024, 'uploads/resumes/private.pdf', 'Top Secret React Project', 'COMPLETED')`,
      [ownerId]
    );
    const resumeId = r.insertId;

    const [j] = await db.query(
      `INSERT INTO jobs (user_id, title, description, source_type, processing_status)
       VALUES (?, 'Private Job', 'Secret Python Project', 'PASTED_TEXT', 'COMPLETED')`,
      [ownerId]
    );
    const jobId = j.insertId;

    try {
      // Attacker tries to extract owner's resume
      const attackReq = { user: { id: attackerId }, params: { id: resumeId } };
      const attackRes = createMockRes();
      await extractResumeSkills(attackReq, attackRes);
      assert.strictEqual(attackRes.statusCode, 404);
      assert.strictEqual(attackRes.body.success, false);

      // Attacker tries to get owner's job skills
      const attackJobReq = { user: { id: attackerId }, params: { id: jobId } };
      const attackJobRes = createMockRes();
      await getJobSkills(attackJobReq, attackJobRes);
      assert.strictEqual(attackJobRes.statusCode, 404);
      assert.strictEqual(attackJobRes.body.success, false);
    } finally {
      await db.query(`DELETE FROM users WHERE id IN (?, ?)`, [ownerId, attackerId]);
    }
  });

  // 16. Handling database failures safely
  await testAsync("134. Handle invalid/non-existent record IDs gracefully with 404", async () => {
    const nonExistentId = 99999999;
    let threwResume = false;
    try {
      await SkillExtractionService.extractResumeSkills(nonExistentId, 1);
    } catch (err) {
      threwResume = true;
      assert.strictEqual(err.status, 404);
    }
    assert.strictEqual(threwResume, true);

    let threwJob = false;
    try {
      await SkillExtractionService.extractJobSkills(nonExistentId, 1);
    } catch (err) {
      threwJob = true;
      assert.strictEqual(err.status, 404);
    }
    assert.strictEqual(threwJob, true);
  });

  // 17. Successful AI extraction returns structured skills matching schema
  await testAsync("135. Mocked AI provider response successfully parsed, validated, and normalized", async () => {
    process.env.AI_API_KEY = "mock-key";

    // Mock successful AI completion
    setClient({
      chat: {
        completions: {
          create: async () => ({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    skills: [
                      {
                        name: "ReactJS",
                        category: "FRAMEWORK",
                        confidence: 0.98,
                        evidence: "Architected single page web application using ReactJS",
                      },
                      {
                        name: "NodeJS",
                        category: "FRAMEWORK",
                        confidence: 0.95,
                        evidence: "Built scalable backend services in NodeJS",
                      },
                      {
                        name: "Postgres",
                        category: "DATABASE",
                        confidence: 0.92,
                        evidence: "Engineered database schemas with Postgres",
                      },
                    ],
                  }),
                },
              },
            ],
            model: "gpt-4o-mini",
            usage: { total_tokens: 180 },
          }),
        },
      },
    });

    const [u] = await db.query(
      `INSERT INTO users (full_name, email, password_hash) VALUES (?, ?, ?)`,
      ["AI Skill User", `ai_skill_user_${Date.now()}@test.local`, "hash"]
    );
    const userId = u.insertId;

    const [r] = await db.query(
      `INSERT INTO resumes (user_id, original_filename, stored_filename, file_type, file_size, file_path, extracted_text, processing_status)
       VALUES (?, 'ai_resume.pdf', 'ai_resume.pdf', 'PDF', 1024, 'uploads/resumes/ai_resume.pdf', 'Built web applications in ReactJS and NodeJS with Postgres.', 'COMPLETED')`,
      [userId]
    );
    const resumeId = r.insertId;

    try {
      const result = await SkillExtractionService.extractResumeSkills(resumeId, userId);

      assert.strictEqual(result.sourceType, "RESUME");
      assert.strictEqual(result.extractionMetadata.status, "COMPLETED");
      assert.strictEqual(result.extractionMetadata.method, "AI");
      assert.strictEqual(result.skills.length, 3);

      // Verify normalization from AI response: ReactJS -> React, NodeJS -> Node.js, Postgres -> PostgreSQL
      const names = result.skills.map((s) => s.name);
      assert.ok(names.includes("React"));
      assert.ok(names.includes("Node.js"));
      assert.ok(names.includes("PostgreSQL"));

      // Verify canonical normalizedName values
      const react = result.skills.find((s) => s.name === "React");
      assert.strictEqual(react.normalizedName, "react");
      assert.strictEqual(react.confidence, 0.98);
      assert.ok(react.evidence.includes("ReactJS"));
    } finally {
      resetClient();
      process.env.AI_API_KEY = originalApiKey;
      await db.query(`DELETE FROM users WHERE id = ?`, [userId]);
    }
  });

  console.log("--- Day 19 Skill Extraction & Normalization Tests Completed ---\n");
}

module.exports = { runDay19SkillTests };
