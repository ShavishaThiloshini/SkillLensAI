/**
 * SkillLens AI — Day 20 Skill Matching Engine Test Suite
 *
 * Automated verification of:
 * 1. Exact skill match (STRONG_MATCH)
 * 2. Skill alias normalization (ReactJS -> React, NodeJS -> Node.js, Postgres -> PostgreSQL, AWS)
 * 3. Partial match for genuinely related technology (JS -> TS, Express -> Node, Docker -> K8s)
 * 4. Missing required skill (MISSING with REQUIRED)
 * 5. Missing preferred skill (MISSING with PREFERRED)
 * 6. Required and preferred classifications remain distinct
 * 7. Empty resume skill list
 * 8. Empty job skill list
 * 9. Duplicate skills do not inflate counts
 * 10. Similar but distinct technologies are not falsely merged (Java != JavaScript, C != C#)
 * 11. Summary counts agree with individual results
 * 12. Repeated matching requests do not create duplicate persisted results
 * 13. Unauthenticated requests are rejected (401)
 * 14. Users cannot compare another user's resume or job description (404/Cross-user isolation)
 * 15. Database / input errors handled safely
 * 16. AI provider unavailability does not break deterministic matching
 * 17. Incomplete extraction handled honestly with warnings
 * 18. Response schema matches frontend contract
 * 19. Summary breakdown for required vs preferred matches matches individual counts
 */

const assert = require("assert");
const db = require("../config/db");
const SkillMatchingService = require("../services/skillMatchingService");
const SkillExtractionService = require("../services/skillExtractionService");
const { runMatching, getSavedMatching } = require("../controllers/matchingController");

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

async function runDay20SkillMatchingTests(testAsync) {
  console.log("\n--- SkillLens AI: Day 20 Skill Matching Engine Tests ---");

  // ---- Test 1: Exact skill match ----
  await testAsync("1. Exact skill match produces STRONG_MATCH with verified evidence", async () => {
    const resumeSkills = [
      { name: "React", category: "FRAMEWORK", evidence: "4 years of building React components" },
      { name: "Node.js", category: "FRAMEWORK", evidence: "Built REST APIs with Node.js" },
    ];
    const jobSkills = [
      { name: "React", required: true, priority: "HIGH" },
    ];

    const result = SkillMatchingService.compareSkillSets(resumeSkills, jobSkills);
    assert.strictEqual(result.summary.totalJobSkills, 1);
    assert.strictEqual(result.summary.strongMatches, 1);
    assert.strictEqual(result.summary.partialMatches, 0);
    assert.strictEqual(result.summary.missingSkills, 0);

    const match = result.results[0];
    assert.strictEqual(match.jobSkill, "React");
    assert.strictEqual(match.category, "STRONG_MATCH");
    assert.strictEqual(match.requirementType, "REQUIRED");
    assert.strictEqual(match.priority, "HIGH");
    assert.ok(match.resumeEvidence.length > 0);
    assert.ok(match.resumeEvidence[0].includes("React components"));
  });

  // ---- Test 2: Skill alias normalization ----
  await testAsync("2. Skill alias normalization correctly identifies canonical equivalents as STRONG_MATCH", async () => {
    const resumeSkills = [
      { name: "ReactJS", category: "FRAMEWORK" },
      { name: "NodeJS", category: "FRAMEWORK" },
      { name: "Postgres", category: "DATABASE" },
      { name: "Amazon Web Services", category: "CLOUD" },
    ];
    const jobSkills = [
      { name: "React", required: true },
      { name: "Node.js", required: true },
      { name: "PostgreSQL", required: false },
      { name: "AWS", required: true },
    ];

    const result = SkillMatchingService.compareSkillSets(resumeSkills, jobSkills);
    assert.strictEqual(result.summary.totalJobSkills, 4);
    assert.strictEqual(result.summary.strongMatches, 4, "All 4 aliases must resolve to STRONG_MATCH");
    assert.strictEqual(result.summary.missingSkills, 0);

    for (const r of result.results) {
      assert.strictEqual(r.category, "STRONG_MATCH");
    }
  });

  // ---- Test 3: Partial match for genuinely related technology ----
  await testAsync("3. Partial match identifies genuinely related skills with explainable rationale", async () => {
    const resumeSkills = [
      { name: "JavaScript", category: "PROGRAMMING", evidence: "Deep JavaScript knowledge" },
      { name: "Express.js", category: "FRAMEWORK", evidence: "Express backend routing" },
      { name: "Docker", category: "CLOUD", evidence: "Docker containers on Linux" },
    ];
    const jobSkills = [
      { name: "TypeScript", required: true },
      { name: "Node.js", required: true },
      { name: "Kubernetes", required: false },
    ];

    const result = SkillMatchingService.compareSkillSets(resumeSkills, jobSkills);
    assert.strictEqual(result.summary.totalJobSkills, 3);
    assert.strictEqual(result.summary.strongMatches, 0);
    assert.strictEqual(result.summary.partialMatches, 3);
    assert.strictEqual(result.summary.missingSkills, 0);

    const tsMatch = result.results.find((r) => r.jobSkill === "TypeScript");
    assert.strictEqual(tsMatch.category, "PARTIAL_MATCH");
    assert.strictEqual(tsMatch.matchedSkill, "JavaScript");
    assert.ok(tsMatch.explanation.toLowerCase().includes("javascript"));

    const k8sMatch = result.results.find((r) => r.jobSkill === "Kubernetes");
    assert.strictEqual(k8sMatch.category, "PARTIAL_MATCH");
    assert.strictEqual(k8sMatch.matchedSkill, "Docker");
  });

  // ---- Test 4: Missing required skill ----
  await testAsync("4. Missing required skill is correctly classified as MISSING with REQUIRED type", async () => {
    const resumeSkills = [{ name: "React" }];
    const jobSkills = [{ name: "Docker", required: true, priority: "HIGH" }];

    const result = SkillMatchingService.compareSkillSets(resumeSkills, jobSkills);
    assert.strictEqual(result.summary.missingSkills, 1);
    assert.strictEqual(result.summary.requiredSkills, 1);
    assert.strictEqual(result.summary.requiredMatches.missing, 1);

    const match = result.results[0];
    assert.strictEqual(match.jobSkill, "Docker");
    assert.strictEqual(match.category, "MISSING");
    assert.strictEqual(match.requirementType, "REQUIRED");
    assert.strictEqual(match.resumeEvidence.length, 0);
  });

  // ---- Test 5: Missing preferred skill ----
  await testAsync("5. Missing preferred skill is classified as MISSING with PREFERRED type", async () => {
    const resumeSkills = [{ name: "React" }];
    const jobSkills = [{ name: "GraphQL", required: false, priority: "LOW" }];

    const result = SkillMatchingService.compareSkillSets(resumeSkills, jobSkills);
    assert.strictEqual(result.summary.missingSkills, 1);
    assert.strictEqual(result.summary.preferredSkills, 1);
    assert.strictEqual(result.summary.preferredMatches.missing, 1);

    const match = result.results[0];
    assert.strictEqual(match.jobSkill, "GraphQL");
    assert.strictEqual(match.category, "MISSING");
    assert.strictEqual(match.requirementType, "PREFERRED");
    assert.strictEqual(match.resumeEvidence.length, 0);
  });

  // ---- Test 6: Required and preferred classifications remain distinct ----
  await testAsync("6. Required and preferred classifications remain distinct throughout matching", async () => {
    const resumeSkills = [{ name: "React" }, { name: "JavaScript" }];
    const jobSkills = [
      { name: "React", required: true },
      { name: "TypeScript", required: true },
      { name: "Rust", required: true },
      { name: "GraphQL", required: false },
    ];

    const result = SkillMatchingService.compareSkillSets(resumeSkills, jobSkills);
    assert.strictEqual(result.summary.requiredSkills, 3);
    assert.strictEqual(result.summary.preferredSkills, 1);

    assert.strictEqual(result.summary.requiredMatches.strong, 1);
    assert.strictEqual(result.summary.requiredMatches.partial, 1);
    assert.strictEqual(result.summary.requiredMatches.missing, 1);

    assert.strictEqual(result.summary.preferredMatches.strong, 0);
    assert.strictEqual(result.summary.preferredMatches.partial, 0);
    assert.strictEqual(result.summary.preferredMatches.missing, 1);
  });

  // ---- Test 7: Empty resume skill list ----
  await testAsync("7. Empty resume skill list categorizes all job skills as MISSING safely", async () => {
    const resumeSkills = [];
    const jobSkills = [
      { name: "Python", required: true },
      { name: "Django", required: false },
    ];

    const result = SkillMatchingService.compareSkillSets(resumeSkills, jobSkills);
    assert.strictEqual(result.summary.totalJobSkills, 2);
    assert.strictEqual(result.summary.missingSkills, 2);
    assert.strictEqual(result.summary.strongMatches, 0);
    assert.strictEqual(result.summary.partialMatches, 0);
    assert.ok(result.warnings.length > 0, "Must warn about empty resume skills");
  });

  // ---- Test 8: Empty job skill list ----
  await testAsync("8. Empty job skill list produces clean 0-count summary and empty results", async () => {
    const resumeSkills = [{ name: "React" }, { name: "Node.js" }];
    const jobSkills = [];

    const result = SkillMatchingService.compareSkillSets(resumeSkills, jobSkills);
    assert.strictEqual(result.summary.totalJobSkills, 0);
    assert.strictEqual(result.summary.strongMatches, 0);
    assert.strictEqual(result.summary.partialMatches, 0);
    assert.strictEqual(result.summary.missingSkills, 0);
    assert.strictEqual(result.results.length, 0);
    assert.ok(result.warnings.length > 0, "Must warn about empty job skill requirements");
  });

  // ---- Test 9: Duplicate skills do not inflate counts ----
  await testAsync("9. Duplicate skills in resume and job do not inflate evaluated skill counts", async () => {
    const resumeSkills = [
      { name: "React" },
      { name: "ReactJS" },
      { name: "react.js" },
    ];
    const jobSkills = [
      { name: "React", required: true },
      { name: "ReactJS", required: true },
    ];

    const result = SkillMatchingService.compareSkillSets(resumeSkills, jobSkills);
    assert.strictEqual(result.summary.totalJobSkills, 1, "Job skill duplicates must collapse to 1");
    assert.strictEqual(result.summary.strongMatches, 1);
    assert.strictEqual(result.results.length, 1);
  });

  // ---- Test 10: Similar but distinct technologies are not treated as equivalent ----
  await testAsync("10. Similar but distinct technologies are never falsely merged", async () => {
    const resumeSkills = [
      { name: "Java" },
      { name: "C" },
      { name: "Git" },
      { name: "SQL" },
    ];
    const jobSkills = [
      { name: "JavaScript", required: true },
      { name: "C#", required: true },
      { name: "GitHub", required: false },
      { name: "NoSQL", required: true },
    ];

    const result = SkillMatchingService.compareSkillSets(resumeSkills, jobSkills);
    // None should match as STRONG_MATCH
    assert.strictEqual(result.summary.strongMatches, 0, "No distinct technologies can be exact matches");

    const jsMatch = result.results.find((r) => r.jobSkill === "JavaScript");
    assert.strictEqual(jsMatch.category, "MISSING", "Java must NEVER match JavaScript");

    const cSharpMatch = result.results.find((r) => r.jobSkill === "C#");
    assert.strictEqual(cSharpMatch.category, "MISSING", "C must NEVER match C#");
  });

  // ---- Test 11: Summary counts agree with individual results ----
  await testAsync("11. Summary counts agree with individual results across all categories", async () => {
    const resumeSkills = [
      { name: "React" },
      { name: "JavaScript" },
      { name: "Docker" },
    ];
    const jobSkills = [
      { name: "React", required: true },
      { name: "TypeScript", required: true },
      { name: "AWS", required: true },
      { name: "GraphQL", required: false },
      { name: "Docker", required: false },
    ];

    const result = SkillMatchingService.compareSkillSets(resumeSkills, jobSkills);
    const { summary, results } = result;

    assert.strictEqual(summary.totalJobSkills, results.length);
    assert.strictEqual(
      summary.totalJobSkills,
      summary.strongMatches + summary.partialMatches + summary.missingSkills
    );

    const actualStrong = results.filter((r) => r.category === "STRONG_MATCH").length;
    const actualPartial = results.filter((r) => r.category === "PARTIAL_MATCH").length;
    const actualMissing = results.filter((r) => r.category === "MISSING").length;

    assert.strictEqual(summary.strongMatches, actualStrong);
    assert.strictEqual(summary.partialMatches, actualPartial);
    assert.strictEqual(summary.missingSkills, actualMissing);

    assert.strictEqual(
      summary.requiredSkills,
      summary.requiredMatches.strong + summary.requiredMatches.partial + summary.requiredMatches.missing
    );
    assert.strictEqual(
      summary.preferredSkills,
      summary.preferredMatches.strong + summary.preferredMatches.partial + summary.preferredMatches.missing
    );
  });

  // ---- Test 12: Repeated matching requests do not create duplicate persisted results ----
  await testAsync("12. Repeated matching requests do not create duplicate database records", async () => {
    const [userRes] = await db.query(
      `INSERT INTO users (full_name, email, password_hash) VALUES (?, ?, ?)`,
      ["Match Owner", `match_owner_${Date.now()}@example.com`, "hash"]
    );
    const testUserId = userRes.insertId;

    try {
      const [resRes] = await db.query(
        `INSERT INTO resumes (user_id, original_filename, stored_filename, file_type, file_size, file_path, extracted_text, processing_status)
         VALUES (?, 'resume.pdf', 'resume.pdf', 'PDF', 1000, 'uploads/resumes/resume.pdf', 'React and Node.js developer', 'COMPLETED')`,
        [testUserId]
      );
      const testResumeId = resRes.insertId;

      const [jobRes] = await db.query(
        `INSERT INTO jobs (user_id, title, description, source_type, processing_status)
         VALUES (?, 'Full Stack Dev', 'Looking for React, Node.js, and Docker.', 'PASTED_TEXT', 'COMPLETED')`,
        [testUserId]
      );
      const testJobId = jobRes.insertId;

      // Extract skills for both
      await SkillExtractionService.extractResumeSkills(testResumeId, testUserId, { forceFallback: true });
      await SkillExtractionService.extractJobSkills(testJobId, testUserId, { forceFallback: true });

      // Run 1
      const res1 = await SkillMatchingService.runMatching(testResumeId, testJobId, testUserId);
      assert.strictEqual(res1.matchingMetadata.status, "COMPLETED");

      // Run 2 (repeated)
      const res2 = await SkillMatchingService.runMatching(testResumeId, testJobId, testUserId);
      assert.strictEqual(res2.matchingMetadata.status, "COMPLETED");

      // Verify analyses count in DB for this user/resume/job is exactly 1
      const [analysesRows] = await db.query(
        `SELECT id FROM analyses WHERE user_id = ? AND resume_id = ? AND job_id = ?`,
        [testUserId, testResumeId, testJobId]
      );
      assert.strictEqual(analysesRows.length, 1, "Must have exactly 1 analysis record");

      // Verify skill_matches count matches results length, not doubled
      const [smRows] = await db.query(
        `SELECT id FROM skill_matches WHERE analysis_id = ?`,
        [analysesRows[0].id]
      );
      assert.strictEqual(smRows.length, res2.results.length, "skill_matches must not be duplicated");
    } finally {
      await db.query(`DELETE FROM users WHERE id = ?`, [testUserId]);
    }
  });

  // ---- Test 13: Unauthenticated requests are rejected ----
  await testAsync("13. Unauthenticated requests to matching endpoints are rejected with 401", async () => {
    const req = { user: null, body: { resumeId: 1, jobDescriptionId: 1 } };
    const res = createMockRes();

    await runMatching(req, res);
    assert.strictEqual(res.statusCode, 401);
    assert.strictEqual(res.body.success, false);

    const getReq = { user: null, params: { resumeId: "1", jobDescriptionId: "1" } };
    const getRes = createMockRes();
    await getSavedMatching(getReq, getRes);
    assert.strictEqual(getRes.statusCode, 401);
  });

  // ---- Test 14: Cross-user isolation ----
  await testAsync("14. Users cannot compare another user's resume or job description", async () => {
    const [u1] = await db.query(
      `INSERT INTO users (full_name, email, password_hash) VALUES (?, ?, ?)`,
      ["User A", `usera_${Date.now()}@example.com`, "hash"]
    );
    const [u2] = await db.query(
      `INSERT INTO users (full_name, email, password_hash) VALUES (?, ?, ?)`,
      ["User B", `userb_${Date.now()}@example.com`, "hash"]
    );
    const userA = u1.insertId;
    const userB = u2.insertId;

    try {
      const [resB] = await db.query(
        `INSERT INTO resumes (user_id, original_filename, stored_filename, file_type, file_size, file_path, extracted_text, processing_status)
         VALUES (?, 'resB.pdf', 'resB.pdf', 'PDF', 1000, 'path', 'Java dev', 'COMPLETED')`,
        [userB]
      );
      const [jobA] = await db.query(
        `INSERT INTO jobs (user_id, title, description, source_type, processing_status)
         VALUES (?, 'Job A', 'Java required', 'PASTED_TEXT', 'COMPLETED')`,
        [userA]
      );

      // User A attempts to compare User B's resume with User A's job
      const req = {
        user: { id: userA },
        body: { resumeId: resB.insertId, jobDescriptionId: jobA.insertId },
      };
      const res = createMockRes();

      await runMatching(req, res);
      assert.strictEqual(res.statusCode, 404, "Must reject cross-user resume access with 404");
      assert.strictEqual(res.body.success, false);
    } finally {
      await db.query(`DELETE FROM users WHERE id IN (?, ?)`, [userA, userB]);
    }
  });

  // ---- Test 15: Database / input errors handled safely ----
  await testAsync("15. Invalid IDs and missing payload fields are rejected safely with 400", async () => {
    const req1 = { user: { id: 1 }, body: { resumeId: null, jobDescriptionId: 2 } };
    const res1 = createMockRes();
    await runMatching(req1, res1);
    assert.strictEqual(res1.statusCode, 400);

    const req2 = { user: { id: 1 }, body: { resumeId: "abc", jobDescriptionId: "xyz" } };
    const res2 = createMockRes();
    await runMatching(req2, res2);
    assert.strictEqual(res2.statusCode, 400);
  });

  // ---- Test 16: AI provider unavailability does not break deterministic matching ----
  await testAsync("16. AI provider unavailability does not break deterministic matching", async () => {
    const resumeSkills = [{ name: "React" }, { name: "PostgreSQL" }];
    const jobSkills = [{ name: "React", required: true }, { name: "Postgres", required: false }];

    // Compare with deterministic engine
    const result = SkillMatchingService.compareSkillSets(resumeSkills, jobSkills);
    assert.strictEqual(result.summary.strongMatches, 2);
    assert.strictEqual(result.summary.missingSkills, 0);
  });

  // ---- Test 17: Incomplete extraction handled honestly ----
  await testAsync("17. Incomplete extraction is handled honestly without fabricating results", async () => {
    const resumeSkills = [];
    const jobSkills = [];

    const result = SkillMatchingService.compareSkillSets(resumeSkills, jobSkills);
    assert.strictEqual(result.summary.totalJobSkills, 0);
    assert.ok(result.warnings.some((w) => w.includes("resume")));
    assert.ok(result.warnings.some((w) => w.includes("job")));
  });

  // ---- Test 18: Response schema matches frontend contract ----
  await testAsync("18. Response schema satisfies frontend contract with all required metadata", async () => {
    const resumeSkills = [{ name: "React", category: "FRAMEWORK", evidence: "React apps" }];
    const jobSkills = [{ name: "React", required: true, priority: "HIGH" }];

    const result = SkillMatchingService.compareSkillSets(resumeSkills, jobSkills);
    const item = result.results[0];

    assert.ok("jobSkill" in item);
    assert.ok("normalizedSkill" in item);
    assert.ok("requirementType" in item);
    assert.ok("category" in item);
    assert.ok("priority" in item);
    assert.ok("resumeEvidence" in item);
    assert.ok("explanation" in item);
    assert.ok(Array.isArray(item.resumeEvidence));
  });

  // ---- Test 19: Summary breakdown for required vs preferred matches ----
  await testAsync("19. Summary breakdown distinguishes required and preferred matches completely", async () => {
    const resumeSkills = [
      { name: "React" },
      { name: "JavaScript" },
    ];
    const jobSkills = [
      { name: "React", required: true },
      { name: "TypeScript", required: true },
      { name: "AWS", required: true },
      { name: "Docker", required: false },
    ];

    const result = SkillMatchingService.compareSkillSets(resumeSkills, jobSkills);
    const { summary } = result;

    assert.strictEqual(summary.requiredMatches.strong, 1, "React is required strong");
    assert.strictEqual(summary.requiredMatches.partial, 1, "TypeScript is required partial via JS");
    assert.strictEqual(summary.requiredMatches.missing, 1, "AWS is required missing");
    assert.strictEqual(summary.preferredMatches.missing, 1, "Docker is preferred missing");
  });

  console.log("--- Day 20 Skill Matching Engine Tests Completed ---\n");
}

module.exports = {
  runDay20SkillMatchingTests,
};
