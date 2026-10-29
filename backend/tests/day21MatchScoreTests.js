/**
 * SkillLens AI — Day 21 Match Score Calculation Test Suite
 *
 * Automated verification of:
 * 1. Correct skills score from known matching results
 * 2. Correct handling of Strong, Partial, and Missing matches
 * 3. Required and preferred skill weighting
 * 4. Duplicate skills not being counted twice
 * 5. Experience score from supported data (candidate with required years)
 * 6. Education score from supported data (degree level & field match)
 * 7. Job with no experience requirement (marked NOT_APPLICABLE, score null)
 * 8. Job with no education requirement (marked NOT_APPLICABLE, score null)
 * 9. Missing candidate experience information (marked AVAILABLE with 0 or INSUFFICIENT_DATA)
 * 10. Missing candidate education information (marked AVAILABLE with 0)
 * 11. Overall score using the documented formula (Skills 50%, Experience 25%, Education 15%, Certifications 10%)
 * 12. Applicable-category weight normalization when categories are NOT_APPLICABLE
 * 13. No fabricated scores for insufficient data (returns null with INSUFFICIENT_DATA status)
 * 14. Scores always remaining within 0–100
 * 15. Rounding consistency (whole numbers)
 * 16. Missing or stale Day 20 matching results recalculated automatically
 * 17. Repeated score calculations are idempotent and do not create duplicate database records
 * 18. Unauthenticated requests are rejected with 401
 * 19. Access to another user's resume or job is denied (Cross-user isolation)
 * 20. Database and input validation errors handled safely (400 Bad Request)
 * 21. Non-overlapping date interval merging avoids double-counting concurrent experiences
 * 22. Response schema matches the Day 21 frontend contract completely
 */

const assert = require("assert");
const db = require("../config/db");
const MatchScoreService = require("../services/matchScoreService");
const SkillMatchingService = require("../services/skillMatchingService");
const { calculateMatchScore, getSavedMatchScore } = require("../controllers/matchingController");

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

async function runDay21MatchScoreTests(testAsync) {
  console.log("\n--- SkillLens AI: Day 21 Match Score Calculation Tests ---");

  // ---- Test 1: Correct skills score from known matching results ----
  await testAsync("1. Correct skills score calculated from known matching results", async () => {
    // 3 skills: React (Strong: 1.0), TypeScript (Partial: 0.5), Docker (Missing: 0.0)
    // All equal weight (required, medium priority) -> (1.0 + 0.5 + 0.0) / 3 * 100 = 50%
    const mockMatching = {
      summary: { totalJobSkills: 3 },
      results: [
        { jobSkill: "React", normalizedSkill: "react", requirementType: "REQUIRED", priority: "MEDIUM", category: "STRONG_MATCH" },
        { jobSkill: "TypeScript", normalizedSkill: "typescript", requirementType: "REQUIRED", priority: "MEDIUM", category: "PARTIAL_MATCH" },
        { jobSkill: "Docker", normalizedSkill: "docker", requirementType: "REQUIRED", priority: "MEDIUM", category: "MISSING" },
      ],
    };

    const res = MatchScoreService.calculateSkillsScore(mockMatching);
    assert.strictEqual(res.status, "AVAILABLE");
    assert.strictEqual(res.score, 50, "Score must be exactly 50%");
    assert.strictEqual(res.details.strongMatches, 1);
    assert.strictEqual(res.details.partialMatches, 1);
    assert.strictEqual(res.details.missingRequired, 1);
  });

  // ---- Test 2: Correct handling of Strong, Partial, and Missing matches ----
  await testAsync("2. Correct points awarded for Strong (1.0), Partial (0.5), and Missing (0.0)", async () => {
    // 2 skills: Python (Strong: 1.0), Django (Partial: 0.5) -> (1.0 + 0.5) / 2 * 100 = 75%
    const mockMatching = {
      summary: { totalJobSkills: 2 },
      results: [
        { jobSkill: "Python", normalizedSkill: "python", requirementType: "REQUIRED", priority: "MEDIUM", category: "STRONG_MATCH" },
        { jobSkill: "Django", normalizedSkill: "django", requirementType: "REQUIRED", priority: "MEDIUM", category: "PARTIAL_MATCH" },
      ],
    };

    const res = MatchScoreService.calculateSkillsScore(mockMatching);
    assert.strictEqual(res.score, 75);
    assert.strictEqual(res.status, "AVAILABLE");
    assert.ok(res.explanation.includes("1 strong match(es)"));
    assert.ok(res.explanation.includes("1 partial match(es)"));
  });

  // ---- Test 3: Required and preferred skill weighting ----
  await testAsync("3. Missing preferred skill carries less penalty than missing required skill", async () => {
    // Scenario A: Missing a preferred skill
    const scenarioA = {
      summary: { totalJobSkills: 2 },
      results: [
        { jobSkill: "React", normalizedSkill: "react", requirementType: "REQUIRED", priority: "MEDIUM", category: "STRONG_MATCH" },
        { jobSkill: "GraphQL", normalizedSkill: "graphql", requirementType: "PREFERRED", priority: "MEDIUM", category: "MISSING" },
      ],
    };
    const resA = MatchScoreService.calculateSkillsScore(scenarioA);

    // Scenario B: Missing a required skill
    const scenarioB = {
      summary: { totalJobSkills: 2 },
      results: [
        { jobSkill: "React", normalizedSkill: "react", requirementType: "PREFERRED", priority: "MEDIUM", category: "STRONG_MATCH" },
        { jobSkill: "GraphQL", normalizedSkill: "graphql", requirementType: "REQUIRED", priority: "MEDIUM", category: "MISSING" },
      ],
    };
    const resB = MatchScoreService.calculateSkillsScore(scenarioB);

    assert.ok(resA.score > resB.score, "Candidate missing preferred skill must score higher than candidate missing required skill");
    // In A: React earned 1.0 (wt 1.0) out of total 1.5 wt -> 1.0/1.5 * 100 = 67%
    assert.strictEqual(resA.score, 67);
    // In B: React earned 0.5 (wt 0.5) out of total 1.5 wt -> 0.5/1.5 * 100 = 33%
    assert.strictEqual(resB.score, 33);
  });

  // ---- Test 4: Duplicate skills not being counted twice ----
  await testAsync("4. Duplicate skills in matching results do not inflate total evaluated count or score", async () => {
    const mockMatching = {
      summary: { totalJobSkills: 3 },
      results: [
        { jobSkill: "React", normalizedSkill: "react", requirementType: "REQUIRED", priority: "MEDIUM", category: "STRONG_MATCH" },
        { jobSkill: "ReactJS", normalizedSkill: "react", requirementType: "REQUIRED", priority: "MEDIUM", category: "STRONG_MATCH" }, // Duplicate normalized
        { jobSkill: "Docker", normalizedSkill: "docker", requirementType: "REQUIRED", priority: "MEDIUM", category: "MISSING" },
      ],
    };

    const res = MatchScoreService.calculateSkillsScore(mockMatching);
    // Should evaluate 2 unique skills: React (1.0) and Docker (0.0) -> 50%
    assert.strictEqual(res.details.totalEvaluated, 2);
    assert.strictEqual(res.score, 50);
  });

  // ---- Test 5: Experience score from supported data (candidate with required years) ----
  await testAsync("5. Experience score calculates alignment from documented non-overlapping years", async () => {
    const candidateData = {
      experience: [
        { jobTitle: "Software Engineer", company: "Acme", startDate: "2021", endDate: "2023", isCurrent: false },
        { jobTitle: "Junior Developer", company: "Beta", startDate: "2019", endDate: "2021", isCurrent: false },
      ],
    };
    // Candidate has 4 years (2019 to 2023)
    const jobRequirements = {
      experience: { minimumYears: 4, maximumYears: null, level: "Mid-Level" },
    };

    const res = MatchScoreService.calculateExperienceScore(candidateData, jobRequirements);
    assert.strictEqual(res.status, "AVAILABLE");
    assert.strictEqual(res.score, 100, "Candidate with 4 years out of 4 required years must score 100%");
    assert.ok(res.explanation.includes("4 year(s) of professional experience"));
  });

  // ---- Test 6: Experience proportional score when candidate has partial years ----
  await testAsync("6. Candidate with partial experience receives proportional score", async () => {
    const candidateData = {
      experience: [
        { jobTitle: "Frontend Developer", company: "WebCorp", startDate: "2021", endDate: "2023", isCurrent: false }, // 2 years
      ],
    };
    const jobRequirements = {
      experience: { minimumYears: 4, maximumYears: null, level: "Mid-Level" },
    };

    const res = MatchScoreService.calculateExperienceScore(candidateData, jobRequirements);
    assert.strictEqual(res.status, "AVAILABLE");
    // 2 years / 4 years = 50%
    assert.strictEqual(res.score, 50);
  });

  // ---- Test 7: Non-overlapping date interval merging avoids double counting ----
  await testAsync("7. Overlapping concurrent jobs are merged so years are not double-counted", async () => {
    const candidateData = {
      experience: [
        // Two concurrent jobs during the same 2-year period
        { jobTitle: "Full Stack Engineer", company: "Company A", startDate: "2020", endDate: "2022", isCurrent: false },
        { jobTitle: "Part-time Consultant", company: "Company B", startDate: "2020", endDate: "2022", isCurrent: false },
      ],
    };
    const jobRequirements = {
      experience: { minimumYears: 4, level: "Mid-Level" },
    };

    const res = MatchScoreService.calculateExperienceScore(candidateData, jobRequirements);
    // Should merge 2020-2022 into 2 years total (NOT 4 years!) -> 2/4 = 50%
    assert.strictEqual(res.details.candidateYears, 2);
    assert.strictEqual(res.score, 50);
  });

  // ---- Test 8: Job with no experience requirement ----
  await testAsync("8. Job with no experience requirement is marked NOT_APPLICABLE with score null", async () => {
    const candidateData = {
      experience: [{ jobTitle: "Engineer", startDate: "2020", endDate: "2023" }],
    };
    const jobRequirements = {
      experience: { minimumYears: null, maximumYears: null, level: null, details: [] },
    };

    const res = MatchScoreService.calculateExperienceScore(candidateData, jobRequirements);
    assert.strictEqual(res.status, "NOT_APPLICABLE");
    assert.strictEqual(res.score, null, "Score must be null when category is NOT_APPLICABLE");
  });

  // ---- Test 9: Education score from supported data (degree level & field match) ----
  await testAsync("9. Education score awards full marks for completed degree matching required level & field", async () => {
    const candidateData = {
      education: [
        { qualification: "Bachelor of Science in Computer Science", fieldOfStudy: "Computer Science", endDate: "2022", isCurrent: false },
      ],
    };
    const jobRequirements = {
      education: [
        { level: "BACHELOR", degree: "Bachelor's Degree", field: "Computer Science", required: true },
      ],
    };

    const res = MatchScoreService.calculateEducationScore(candidateData, jobRequirements);
    assert.strictEqual(res.status, "AVAILABLE");
    assert.strictEqual(res.score, 100);
    assert.ok(res.explanation.includes("Fully satisfies requirement"));
  });

  // ---- Test 10: Candidate with ongoing degree receives partial credit ----
  await testAsync("10. Candidate with ongoing degree receives partial credit without assuming completion", async () => {
    const candidateData = {
      education: [
        { qualification: "Bachelor of Science in Software Engineering", fieldOfStudy: "Software Engineering", endDate: "Present", isCurrent: true },
      ],
    };
    const jobRequirements = {
      education: [
        { level: "BACHELOR", degree: "Bachelor's Degree", field: "Software Engineering", required: true },
      ],
    };

    const res = MatchScoreService.calculateEducationScore(candidateData, jobRequirements);
    assert.strictEqual(res.status, "AVAILABLE");
    assert.strictEqual(res.score, 70, "Ongoing degree receives partial credit (70%)");
    assert.ok(res.explanation.includes("in-progress/ongoing"));
  });

  // ---- Test 11: Job with no education requirement ----
  await testAsync("11. Job with no education requirement is marked NOT_APPLICABLE with score null", async () => {
    const candidateData = {
      education: [{ qualification: "B.Sc. Computer Science", endDate: "2022" }],
    };
    const jobRequirements = {
      education: [],
    };

    const res = MatchScoreService.calculateEducationScore(candidateData, jobRequirements);
    assert.strictEqual(res.status, "NOT_APPLICABLE");
    assert.strictEqual(res.score, null);
  });

  // ---- Test 12: Missing candidate experience information ----
  await testAsync("12. Missing candidate experience documents 0% when experience is required", async () => {
    const candidateData = { experience: [] };
    const jobRequirements = {
      experience: { minimumYears: 3, level: "Mid-Level" },
    };

    const res = MatchScoreService.calculateExperienceScore(candidateData, jobRequirements);
    assert.strictEqual(res.status, "AVAILABLE");
    assert.strictEqual(res.score, 0, "No experience on resume must yield 0%, not fabricated score");
    assert.strictEqual(res.details.candidateYears, 0);
  });

  // ---- Test 13: Missing candidate education information ----
  await testAsync("13. Missing candidate education documents 0% when degree is mandatory", async () => {
    const candidateData = { education: [] };
    const jobRequirements = {
      education: [{ level: "BACHELOR", degree: "Bachelor's Degree", required: true }],
    };

    const res = MatchScoreService.calculateEducationScore(candidateData, jobRequirements);
    assert.strictEqual(res.status, "AVAILABLE");
    assert.strictEqual(res.score, 0);
    assert.ok(res.explanation.includes("no education qualifications were documented"));
  });

  // ---- Test 14: Overall score using documented formula and weight normalization ----
  await testAsync("14. Overall score normalizes applicable category weights accurately", async () => {
    // Skills (80%), Experience (60%), Education (100%), Certifications (N/A)
    // Base weights: Skills 0.50, Experience 0.25, Education 0.15 (Sum = 0.90)
    // Normalized: Skills = 0.50/0.90 = 0.5556, Experience = 0.25/0.90 = 0.2778, Education = 0.15/0.90 = 0.1667
    // Weighted sum = (80 * 0.5556) + (60 * 0.2778) + (100 * 0.1667) = 44.44 + 16.67 + 16.67 = 77.78 -> 78%
    const categoryScores = {
      skills: { score: 80, status: "AVAILABLE" },
      experience: { score: 60, status: "AVAILABLE" },
      education: { score: 100, status: "AVAILABLE" },
      certifications: { score: null, status: "NOT_APPLICABLE" },
    };

    const res = MatchScoreService.calculateOverallScore(categoryScores);
    assert.strictEqual(res.status, "AVAILABLE");
    assert.strictEqual(res.score, 78, "Overall score must be 78% rounded");
    assert.deepStrictEqual(res.includedCategories, ["skills", "experience", "education"]);
    assert.strictEqual(res.normalizedWeights.skills, 0.556);
    assert.strictEqual(res.normalizedWeights.experience, 0.278);
    assert.strictEqual(res.normalizedWeights.education, 0.167);
  });

  // ---- Test 15: Redistribution when both Education and Certifications are NOT_APPLICABLE ----
  await testAsync("15. Weights redistribute across Skills and Experience when others are NOT_APPLICABLE", async () => {
    // Skills (80%), Experience (50%)
    // Base weights: 0.50 and 0.25 (Sum = 0.75)
    // Normalized: Skills = 0.50/0.75 = 66.67%, Experience = 0.25/0.75 = 33.33%
    // Weighted sum = (80 * 0.6667) + (50 * 0.3333) = 53.33 + 16.67 = 70%
    const categoryScores = {
      skills: { score: 80, status: "AVAILABLE" },
      experience: { score: 50, status: "AVAILABLE" },
      education: { score: null, status: "NOT_APPLICABLE" },
      certifications: { score: null, status: "NOT_APPLICABLE" },
    };

    const res = MatchScoreService.calculateOverallScore(categoryScores);
    assert.strictEqual(res.score, 70);
    assert.strictEqual(res.normalizedWeights.skills, 0.667);
    assert.strictEqual(res.normalizedWeights.experience, 0.333);
  });

  // ---- Test 16: No fabricated scores for insufficient data ----
  await testAsync("16. Insufficient data returns null score with warnings and is excluded from overall calculation", async () => {
    // If experience entries have unparseable dates, candidate experience cannot be reliably determined
    const candidateData = {
      experience: [
        { jobTitle: "Developer", company: "Startup", startDate: "invalid-date", endDate: "unknown" },
      ],
    };
    const jobRequirements = {
      experience: { minimumYears: 3, level: "Mid-Level" },
    };

    const expRes = MatchScoreService.calculateExperienceScore(candidateData, jobRequirements);
    assert.strictEqual(expRes.status, "INSUFFICIENT_DATA");
    assert.strictEqual(expRes.score, null, "Score must be null when data is insufficient");

    // Overall calculation excludes insufficient data and emits a warning
    const categoryScores = {
      skills: { score: 90, status: "AVAILABLE" },
      experience: expRes,
      education: { score: 100, status: "AVAILABLE" },
    };

    const overallRes = MatchScoreService.calculateOverallScore(categoryScores);
    assert.strictEqual(overallRes.status, "AVAILABLE");
    assert.ok(overallRes.warnings.length > 0);
    assert.ok(overallRes.warnings[0].includes("insufficient data"));
    assert.deepStrictEqual(overallRes.includedCategories, ["skills", "education"]);
  });

  // ---- Test 17: Scores always remain within 0 to 100 ----
  await testAsync("17. Scores never exceed 100 or drop below 0", async () => {
    const highMatching = {
      summary: { totalJobSkills: 1 },
      results: [
        { jobSkill: "React", normalizedSkill: "react", requirementType: "REQUIRED", priority: "HIGH", category: "STRONG_MATCH" },
      ],
    };
    const resHigh = MatchScoreService.calculateSkillsScore(highMatching);
    assert.ok(resHigh.score <= 100);
    assert.ok(resHigh.score >= 0);

    const emptyMatching = {
      summary: { totalJobSkills: 2 },
      results: [
        { jobSkill: "A", normalizedSkill: "a", requirementType: "REQUIRED", category: "MISSING" },
        { jobSkill: "B", normalizedSkill: "b", requirementType: "REQUIRED", category: "MISSING" },
      ],
    };
    const resLow = MatchScoreService.calculateSkillsScore(emptyMatching);
    assert.strictEqual(resLow.score, 0);
  });

  // ---- Test 18: Unauthenticated requests rejected with 401 ----
  await testAsync("18. Score calculation endpoint rejects unauthenticated requests with 401", async () => {
    const req = { user: null, body: { resumeId: 1, jobDescriptionId: 1 } };
    const res = createMockRes();

    await calculateMatchScore(req, res);
    assert.strictEqual(res.statusCode, 401);
    assert.strictEqual(res.body.success, false);
  });

  // ---- Test 19: Missing payload parameters rejected with 400 ----
  await testAsync("19. Missing resumeId or jobDescriptionId rejected with 400 Bad Request", async () => {
    const req = { user: { id: 1 }, body: { resumeId: null, jobDescriptionId: null } };
    const res = createMockRes();

    await calculateMatchScore(req, res);
    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.body.success, false);
  });

  // ---- Test 20: Cross-user isolation and ownership verification ----
  await testAsync("20. Cross-user isolation: User cannot calculate match scores for another user's records", async () => {
    const [u1] = await db.query(
      `INSERT INTO users (full_name, email, password_hash) VALUES (?, ?, ?)`,
      ["Owner User", `owner_${Date.now()}@example.com`, "hash"]
    );
    const [u2] = await db.query(
      `INSERT INTO users (full_name, email, password_hash) VALUES (?, ?, ?)`,
      ["Intruder User", `intruder_${Date.now()}@example.com`, "hash"]
    );
    const ownerId = u1.insertId;
    const intruderId = u2.insertId;

    try {
      const [r] = await db.query(
        `INSERT INTO resumes (user_id, original_filename, stored_filename, file_type, file_size, file_path, processing_status)
         VALUES (?, 'resume.pdf', 'resume.pdf', 'pdf', 1024, 'uploads/resumes/resume.pdf', 'COMPLETED')`,
        [ownerId]
      );
      const [j] = await db.query(
        `INSERT INTO jobs (user_id, title, description, source_type, processing_status)
         VALUES (?, 'Job Title', 'Description text with React required.', 'PASTED_TEXT', 'COMPLETED')`,
        [ownerId]
      );

      const resumeId = r.insertId;
      const jobId = j.insertId;

      // Intruder attempts to calculate score on owner's records
      const req = { user: { id: intruderId }, body: { resumeId, jobDescriptionId: jobId } };
      const res = createMockRes();

      await calculateMatchScore(req, res);
      assert.strictEqual(res.statusCode, 404, "Intruder must be denied with 404 Not Found");
      assert.strictEqual(res.body.success, false);
    } finally {
      await db.query(`DELETE FROM users WHERE id IN (?, ?)`, [ownerId, intruderId]);
    }
  });

  // ---- Test 21: Repeated score calculations are idempotent ----
  await testAsync("21. Repeated score calculations are idempotent and do not create duplicate database records", async () => {
    const [u] = await db.query(
      `INSERT INTO users (full_name, email, password_hash) VALUES (?, ?, ?)`,
      ["Test User", `score_user_${Date.now()}@example.com`, "hash"]
    );
    const userId = u.insertId;

    try {
      const [r] = await db.query(
        `INSERT INTO resumes (user_id, original_filename, stored_filename, file_type, file_size, file_path, processing_status, extracted_text)
         VALUES (?, 'jane.pdf', 'jane.pdf', 'pdf', 1024, 'uploads/resumes/jane.pdf', 'COMPLETED', 'React, JavaScript. 3 years experience. B.Sc. in Computer Science.')`,
        [userId]
      );
      const [j] = await db.query(
        `INSERT INTO jobs (user_id, title, description, source_type, processing_status)
         VALUES (?, 'Software Engineer', 'Requirements: React, Node.js. 2+ years experience. Degree in CS required.', 'PASTED_TEXT', 'COMPLETED')`,
        [userId]
      );

      const resumeId = r.insertId;
      const jobId = j.insertId;

      // Run score calculation first time
      const res1 = await MatchScoreService.calculateMatchScore(resumeId, jobId, userId);
      assert.ok(res1.overall.score !== null);

      // Run score calculation second time
      const res2 = await MatchScoreService.calculateMatchScore(resumeId, jobId, userId);
      assert.strictEqual(res1.overall.score, res2.overall.score, "Scores must be identical");

      // Verify only ONE analysis record exists in database
      const [analyses] = await db.query(
        `SELECT COUNT(*) AS total FROM analyses WHERE user_id = ? AND resume_id = ? AND job_id = ?`,
        [userId, resumeId, jobId]
      );
      assert.strictEqual(Number(analyses[0].total), 1, "Must maintain exactly one analysis record per (user, resume, job)");

      // Retrieve via controller getSavedMatchScore
      const getReq = { user: { id: userId }, params: { resumeId, jobDescriptionId: jobId } };
      const getRes = createMockRes();
      await getSavedMatchScore(getReq, getRes);
      assert.strictEqual(getRes.statusCode, 200);
      assert.strictEqual(getRes.body.data.overall.score, res1.overall.score);
    } finally {
      await db.query(`DELETE FROM users WHERE id = ?`, [userId]);
    }
  });

  // ---- Test 22: Canonical response contract conformance ----
  await testAsync("22. Response structure strictly adheres to Day 21 schema specification", async () => {
    const [u] = await db.query(
      `INSERT INTO users (full_name, email, password_hash) VALUES (?, ?, ?)`,
      ["Schema User", `schema_${Date.now()}@example.com`, "hash"]
    );
    const userId = u.insertId;

    try {
      const [r] = await db.query(
        `INSERT INTO resumes (user_id, original_filename, stored_filename, file_type, file_size, file_path, processing_status, extracted_text)
         VALUES (?, 'my_resume.pdf', 'my_resume.pdf', 'pdf', 1024, 'uploads/resumes/my_resume.pdf', 'COMPLETED', 'Python, SQL. 2 years experience.')`,
        [userId]
      );
      const [j] = await db.query(
        `INSERT INTO jobs (user_id, title, description, source_type, processing_status)
         VALUES (?, 'Data Analyst', 'Requirements: Python, SQL. 2 years experience.', 'PASTED_TEXT', 'COMPLETED')`,
        [userId]
      );

      const resumeId = r.insertId;
      const jobId = j.insertId;

      const result = await MatchScoreService.calculateMatchScore(resumeId, jobId, userId);

      // Check required top-level keys
      assert.ok("resumeId" in result);
      assert.ok("jobDescriptionId" in result);
      assert.ok("scores" in result);
      assert.ok("overall" in result);
      assert.ok("metadata" in result);

      // Check scores object
      assert.ok("skills" in result.scores);
      assert.ok("experience" in result.scores);
      assert.ok("education" in result.scores);

      // Check skills score format
      assert.ok(typeof result.scores.skills.score === "number");
      assert.ok("status" in result.scores.skills);
      assert.ok("weight" in result.scores.skills);
      assert.ok("explanation" in result.scores.skills);

      // Check overall format
      assert.ok(typeof result.overall.score === "number");
      assert.ok("status" in result.overall);
      assert.ok("method" in result.overall);
      assert.ok(Array.isArray(result.overall.includedCategories));
      assert.ok("explanation" in result.overall);

      // Check metadata
      assert.strictEqual(result.metadata.algorithmVersion, "1.0");
      assert.ok("calculatedAt" in result.metadata);
      assert.ok(Array.isArray(result.metadata.warnings));
    } finally {
      await db.query(`DELETE FROM users WHERE id = ?`, [userId]);
    }
  });

  console.log("--- Day 21 Match Score Calculation Tests Completed ---");
}

module.exports = { runDay21MatchScoreTests };
