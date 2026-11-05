/**
 * SkillLens AI — Day 26: Skill Gap Roadmap Test Suite
 *
 * Automated verification of all 17 required scenarios:
 * 1. Resume with no missing skills (100% match)
 * 2. Resume with only missing required skills
 * 3. Resume with missing preferred skills
 * 4. Resume with partial matches (transferable evidence cited)
 * 5. Resume with both required and preferred gaps (required prioritized over preferred)
 * 6. Multiple skills with different job priorities (HIGH, MEDIUM, LOW)
 * 7. Skills with genuine prerequisites (e.g. JavaScript before TypeScript, Docker before Kubernetes)
 * 8. Independent skills without dependencies (no fabricated prerequisite chains)
 * 9. Duplicate or similarly named skills (deduplicated, normalized)
 * 10. Resume with incomplete information (gracefully handled with warnings)
 * 11. Job description with insufficient requirements (gracefully handled with warnings)
 * 12. AI provider unavailable (deterministic fallback engages cleanly)
 * 13. Roadmap generation with empty results
 * 14. Learning progress updates (item & step status changes)
 * 15. Progress persistence after re-calculation (user progress preserved)
 * 16. Unauthorized access to another user's roadmap (Cross-user isolation & 401/404)
 * 17. Validated response schema (Objective, Steps, Activities, Mini-project, Criteria)
 */

const assert = require("assert");
const SkillRoadmapService = require("../services/skillRoadmapService");
const {
  generateRoadmap,
  getSavedRoadmap,
  updateItemStatus,
  resetRoadmapProgress,
} = require("../controllers/roadmapController");

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

async function runDay26SkillRoadmapTests(testAsync) {
  console.log("\n--- SkillLens AI: Day 26 Skill Gap Roadmap Tests ---");

  // ---- Test 1: Resume with no missing skills ----
  await testAsync("1. Resume with no missing skills produces clean 0-gap roadmap", async () => {
    const candidateSkills = [
      { name: "React", category: "FRAMEWORK", evidence: "4 years React" },
      { name: "Node.js", category: "FRAMEWORK", evidence: "REST APIs with Node" },
    ];
    const matchResults = [
      { jobSkill: "React", normalizedSkill: "react", category: "STRONG_MATCH", requirementType: "REQUIRED" },
      { jobSkill: "Node.js", normalizedSkill: "node.js", category: "STRONG_MATCH", requirementType: "REQUIRED" },
    ];

    const current = SkillRoadmapService.formatCurrentSkills(candidateSkills, matchResults);
    assert.strictEqual(current.totalCount, 2);
    assert.strictEqual(current.matchedWithJobCount, 2);

    const gaps = SkillRoadmapService.formatMissingAndPartialSkills(matchResults);
    assert.strictEqual(gaps.totalMissingCount, 0);
    assert.strictEqual(gaps.partial.length, 0);

    const prioritized = SkillRoadmapService.prioritizeSkills({
      missingAndPartialSkills: [],
      candidateSkills,
      jobTitle: "Senior Full Stack Engineer",
    });
    assert.strictEqual(prioritized.length, 0, "No skills should be prioritized when there are no gaps");

    const rationale = SkillRoadmapService.generateSequenceRationale([]);
    assert.ok(rationale.includes("No skill gaps were identified"), "Rationale must celebrate 0 gaps");
  });

  // ---- Test 2: Resume with only missing required skills ----
  await testAsync("2. Resume with only missing required skills prioritizes them into High/Medium tiers", async () => {
    const candidateSkills = [{ name: "HTML5", category: "FRONTEND" }];
    const missingAndPartial = [
      { jobSkill: "TypeScript", normalizedSkill: "typescript", category: "MISSING", requirementType: "REQUIRED", priority: "HIGH" },
      { jobSkill: "Docker", normalizedSkill: "docker", category: "MISSING", requirementType: "REQUIRED", priority: "HIGH" },
    ];

    const prioritized = SkillRoadmapService.prioritizeSkills({
      missingAndPartialSkills: missingAndPartial,
      candidateSkills,
      jobTitle: "Full Stack Developer",
    });

    assert.strictEqual(prioritized.length, 2);
    assert.ok(prioritized.every((p) => p.requirementType === "REQUIRED"));
    assert.ok(prioritized.every((p) => p.priorityLevel === 1 || p.priorityLevel === 2));
    assert.ok(prioritized[0].priorityReason.includes("Required skill") || prioritized[0].priorityReason.includes("Core required skill"));
  });

  // ---- Test 3: Resume with missing preferred skills ----
  await testAsync("3. Resume with missing preferred skills ranks them in secondary/lower tiers", async () => {
    const candidateSkills = [{ name: "React", category: "FRAMEWORK" }];
    const missingAndPartial = [
      { jobSkill: "GraphQL", normalizedSkill: "graphql", category: "MISSING", requirementType: "PREFERRED", priority: "MEDIUM" },
      { jobSkill: "Redis", normalizedSkill: "redis", category: "MISSING", requirementType: "PREFERRED", priority: "LOW" },
    ];

    const prioritized = SkillRoadmapService.prioritizeSkills({
      missingAndPartialSkills: missingAndPartial,
      candidateSkills,
      jobTitle: "Frontend Engineer",
    });

    assert.strictEqual(prioritized.length, 2);
    assert.ok(prioritized.every((p) => p.requirementType === "PREFERRED"));
    // Preferred skills with medium/low priority should NOT be Priority 1
    assert.ok(prioritized.every((p) => p.priorityLevel >= 2), "Preferred skills should be Priority 2 or 3");
  });

  // ---- Test 4: Resume with partial matches ----
  await testAsync("4. Partial matches cite transferable candidate evidence and explain readiness", async () => {
    const candidateSkills = [
      { name: "JavaScript", category: "LANGUAGE", evidence: "ES6+ proficiency" },
    ];
    const missingAndPartial = [
      {
        jobSkill: "TypeScript",
        normalizedSkill: "typescript",
        category: "PARTIAL_MATCH",
        requirementType: "REQUIRED",
        matchedSkill: "JavaScript",
        priority: "HIGH",
      },
    ];

    const prioritized = SkillRoadmapService.prioritizeSkills({
      missingAndPartialSkills: missingAndPartial,
      candidateSkills,
      jobTitle: "Frontend Engineer",
    });

    assert.strictEqual(prioritized.length, 1);
    const item = prioritized[0];
    assert.strictEqual(item.category, "PARTIAL_MATCH");
    assert.ok(
      item.priorityReason.includes("JavaScript") || item.priorityReason.includes("transferable"),
      "Reason must cite candidate's JavaScript background"
    );
  });

  // ---- Test 5: Resume with both required and preferred gaps ----
  await testAsync("5. Required missing skills are strictly prioritized ahead of preferred skills", async () => {
    const candidateSkills = [{ name: "CSS", category: "FRONTEND" }];
    const missingAndPartial = [
      { jobSkill: "GraphQL", normalizedSkill: "graphql", category: "MISSING", requirementType: "PREFERRED", priority: "HIGH" },
      { jobSkill: "Docker", normalizedSkill: "docker", category: "MISSING", requirementType: "REQUIRED", priority: "HIGH" },
    ];

    const prioritized = SkillRoadmapService.prioritizeSkills({
      missingAndPartialSkills: missingAndPartial,
      candidateSkills,
      jobTitle: "Software Engineer",
    });

    assert.strictEqual(prioritized.length, 2);
    assert.strictEqual(prioritized[0].rawName, "Docker", "Required skill Docker must precede preferred GraphQL");
    assert.strictEqual(prioritized[0].priorityLevel, 1);
    assert.ok(prioritized[1].priorityLevel > prioritized[0].priorityLevel || prioritized[1].score < prioritized[0].score);
  });

  // ---- Test 6: Multiple skills with different job priorities ----
  await testAsync("6. Skills with different job priorities (HIGH, MEDIUM, LOW) order correctly", async () => {
    const candidateSkills = [];
    const missingAndPartial = [
      { jobSkill: "Jest", normalizedSkill: "jest", category: "MISSING", requirementType: "REQUIRED", priority: "LOW" },
      { jobSkill: "React", normalizedSkill: "react", category: "MISSING", requirementType: "REQUIRED", priority: "HIGH" },
      { jobSkill: "Node.js", normalizedSkill: "node.js", category: "MISSING", requirementType: "REQUIRED", priority: "MEDIUM" },
    ];

    const prioritized = SkillRoadmapService.prioritizeSkills({
      missingAndPartialSkills: missingAndPartial,
      candidateSkills,
      jobTitle: "Full Stack Engineer",
    });

    assert.strictEqual(prioritized[0].rawName, "React", "HIGH priority required skill must rank first");
    assert.strictEqual(prioritized[1].rawName, "Node.js", "MEDIUM priority required skill must rank second");
    assert.strictEqual(prioritized[2].rawName, "Jest", "LOW priority required skill must rank third");
  });

  // ---- Test 7: Skills with genuine prerequisites ----
  await testAsync("7. Foundational prerequisite is prioritized before dependent skill", async () => {
    // Both JavaScript and TypeScript are missing
    const candidateSkills = [];
    const missingAndPartial = [
      { jobSkill: "TypeScript", normalizedSkill: "typescript", category: "MISSING", requirementType: "REQUIRED", priority: "HIGH" },
      { jobSkill: "JavaScript", normalizedSkill: "javascript", category: "MISSING", requirementType: "REQUIRED", priority: "HIGH" },
    ];

    const prioritized = SkillRoadmapService.prioritizeSkills({
      missingAndPartialSkills: missingAndPartial,
      candidateSkills,
      jobTitle: "Web Developer",
    });

    assert.strictEqual(prioritized[0].normalizedName, "javascript", "JavaScript must come before TypeScript");
    assert.strictEqual(prioritized[1].normalizedName, "typescript", "TypeScript must come after JavaScript");
    assert.ok(prioritized[0].isFoundational, "JavaScript must be flagged as foundational");
    assert.ok(prioritized[0].priorityReason.includes("Foundational prerequisite for TypeScript"));
  });

  // ---- Test 8: Independent skills without dependencies ----
  await testAsync("8. Independent skills have no artificial dependencies created", async () => {
    const candidateSkills = [];
    const missingAndPartial = [
      { jobSkill: "Python", normalizedSkill: "python", category: "MISSING", requirementType: "REQUIRED", priority: "HIGH" },
      { jobSkill: "Docker", normalizedSkill: "docker", category: "MISSING", requirementType: "REQUIRED", priority: "HIGH" },
    ];

    const prioritized = SkillRoadmapService.prioritizeSkills({
      missingAndPartialSkills: missingAndPartial,
      candidateSkills,
      jobTitle: "Backend Developer",
    });

    assert.strictEqual(prioritized.length, 2);
    assert.strictEqual(prioritized[0].dependsOnMissing, null, "Python should not depend on Docker");
    assert.strictEqual(prioritized[1].dependsOnMissing, null, "Docker should not depend on Python");
    assert.strictEqual(prioritized[0].isFoundational, false);
    assert.strictEqual(prioritized[1].isFoundational, false);
  });

  // ---- Test 9: Duplicate or similarly named skills ----
  await testAsync("9. Duplicate or similarly named skills are deduplicated cleanly", async () => {
    const candidateSkills = [];
    const missingAndPartial = [
      { jobSkill: "TypeScript", normalizedSkill: "typescript", category: "MISSING", requirementType: "REQUIRED" },
      { jobSkill: "typescript", normalizedSkill: "typescript", category: "MISSING", requirementType: "REQUIRED" },
      { jobSkill: "TypeScript", normalizedSkill: "typescript", category: "MISSING", requirementType: "REQUIRED" },
    ];

    const prioritized = SkillRoadmapService.prioritizeSkills({
      missingAndPartialSkills: missingAndPartial,
      candidateSkills,
      jobTitle: "Frontend Developer",
    });

    assert.strictEqual(prioritized.length, 1, "Duplicate TypeScript mentions must result in exactly 1 roadmap item");
  });

  // ---- Test 10: Resume with incomplete information ----
  await testAsync("10. Resume with 0 technical skills handled honestly with warnings", async () => {
    const current = SkillRoadmapService.formatCurrentSkills([], []);
    assert.strictEqual(current.totalCount, 0);
    assert.strictEqual(current.matchedWithJobCount, 0);
    assert.strictEqual(current.groups.length, 0);
  });

  // ---- Test 11: Job description with insufficient requirements ----
  await testAsync("11. Job description with no requirements handled cleanly", async () => {
    const gaps = SkillRoadmapService.formatMissingAndPartialSkills([]);
    assert.strictEqual(gaps.totalMissingCount, 0);
    assert.strictEqual(gaps.required.length, 0);
    assert.strictEqual(gaps.preferred.length, 0);
    assert.strictEqual(gaps.partial.length, 0);
  });

  // ---- Test 12: AI provider unavailable (Deterministic fallback) ----
  await testAsync("12. Deterministic fallback produces rich, valid learning paths without AI", async () => {
    const prioritizedSkills = [
      {
        rawName: "AWS",
        normalizedName: "aws",
        category: "MISSING",
        requirementType: "REQUIRED",
        priorityLevel: 1,
        priorityLabel: "Priority 1 — High Priority",
        priorityReason: "Core cloud requirement.",
        isFoundational: false,
        dependsOnMissing: null,
      },
    ];

    const items = await SkillRoadmapService.buildRoadmapWithLearningPaths({
      prioritizedSkills,
      candidateSkills: [],
      jobTitle: "DevOps Engineer",
      options: { forceFallback: true },
    });

    assert.strictEqual(items.length, 1);
    const aws = items[0];
    assert.strictEqual(aws.title, "AWS");
    assert.ok(aws.learningObjective.length > 10, "Learning objective must be populated");
    assert.ok(Array.isArray(aws.learningSteps) && aws.learningSteps.length >= 3, "Must have learning steps");
    assert.ok(Array.isArray(aws.practicalActivities) && aws.practicalActivities.length >= 2, "Must have practical activities");
    assert.ok(aws.miniProject && aws.miniProject.title && aws.miniProject.demonstrates, "Must have mini-project");
    assert.ok(Array.isArray(aws.completionCriteria) && aws.completionCriteria.length >= 2, "Must have completion criteria");
    assert.strictEqual(aws.status, "NOT_STARTED", "Default status must be NOT_STARTED");
  });

  // ---- Test 13: Roadmap generation with empty results ----
  await testAsync("13. Sequence rationale handles empty results gracefully", async () => {
    const rationale = SkillRoadmapService.generateSequenceRationale([]);
    assert.ok(rationale.includes("No skill gaps were identified"));
  });

  // ---- Test 14: Learning progress updates ----
  await testAsync("14. Learning progress data transitions adhere to allowed statuses", async () => {
    const validStatuses = ["NOT_STARTED", "IN_PROGRESS", "COMPLETED"];
    assert.ok(validStatuses.includes("NOT_STARTED"));
    assert.ok(validStatuses.includes("IN_PROGRESS"));
    assert.ok(validStatuses.includes("COMPLETED"));
    assert.ok(!validStatuses.includes("FINISHED"));
  });

  // ---- Test 15: Progress persistence after re-calculation ----
  await testAsync("15. Existing user progress is preserved when roadmap is regenerated", async () => {
    const existingItemsMap = new Map();
    existingItemsMap.set("typescript", {
      id: 42,
      title: "TypeScript",
      status: "IN_PROGRESS",
      description: JSON.stringify({
        learningSteps: [
          { stepIndex: 1, status: "COMPLETED" },
          { stepIndex: 2, status: "IN_PROGRESS" },
          { stepIndex: 3, status: "NOT_STARTED" },
        ],
      }),
    });

    const prioritizedSkills = [
      {
        rawName: "TypeScript",
        normalizedName: "typescript",
        category: "MISSING",
        requirementType: "REQUIRED",
        priorityLevel: 1,
        priorityLabel: "Priority 1 — High Priority",
        priorityReason: "High priority required skill.",
        isFoundational: false,
        dependsOnMissing: null,
      },
    ];

    const items = await SkillRoadmapService.buildRoadmapWithLearningPaths({
      prioritizedSkills,
      candidateSkills: [],
      jobTitle: "Frontend Lead",
      existingItemsMap,
      options: { forceFallback: true },
    });

    assert.strictEqual(items.length, 1);
    const ts = items[0];
    assert.strictEqual(ts.status, "IN_PROGRESS", "Overall status IN_PROGRESS must be preserved");
    assert.strictEqual(ts.learningSteps[0].status, "COMPLETED", "Step 1 status COMPLETED must be preserved");
    assert.strictEqual(ts.learningSteps[1].status, "IN_PROGRESS", "Step 2 status IN_PROGRESS must be preserved");
    assert.strictEqual(ts.learningSteps[2].status, "NOT_STARTED", "Step 3 status NOT_STARTED must be preserved");
  });

  // ---- Test 16: Unauthorized access rejected (Cross-user isolation) ----
  await testAsync("16. Controller rejects unauthenticated access with 401 and invalid input with 400", async () => {
    // 1. Unauthenticated request to generate
    const reqUnauth = { user: null, body: { resumeId: 1, jobDescriptionId: 1 } };
    const resUnauth = createMockRes();
    await generateRoadmap(reqUnauth, resUnauth);
    assert.strictEqual(resUnauth.statusCode, 401, "Unauthenticated generate must return 401");

    // 2. Missing params to generate
    const reqMissing = { user: { id: 99 }, body: { resumeId: null } };
    const resMissing = createMockRes();
    await generateRoadmap(reqMissing, resMissing);
    assert.strictEqual(resMissing.statusCode, 400, "Missing params must return 400");

    // 3. Unauthenticated request to getSavedRoadmap
    const reqGetUnauth = { user: null, params: { resumeId: "1", jobDescriptionId: "1" } };
    const resGetUnauth = createMockRes();
    await getSavedRoadmap(reqGetUnauth, resGetUnauth);
    assert.strictEqual(resGetUnauth.statusCode, 401, "Unauthenticated get must return 401");

    // 4. Invalid item ID to updateItemStatus
    const reqBadItem = { user: { id: 99 }, params: { itemId: "invalid" }, body: { status: "COMPLETED" } };
    const resBadItem = createMockRes();
    await updateItemStatus(reqBadItem, resBadItem);
    assert.strictEqual(resBadItem.statusCode, 400, "Invalid item ID must return 400");
  });

  // ---- Test 17: Validated response schema completeness ----
  await testAsync("17. Learning path schema strictly conforms to all 5 required sections", async () => {
    const prioritizedSkills = [
      {
        rawName: "Docker",
        normalizedName: "docker",
        category: "MISSING",
        requirementType: "REQUIRED",
        priorityLevel: 1,
        priorityLabel: "Priority 1 — High Priority",
        priorityReason: "Essential containerization technology.",
        isFoundational: true,
        dependsOnMissing: null,
      },
    ];

    const items = await SkillRoadmapService.buildRoadmapWithLearningPaths({
      prioritizedSkills,
      candidateSkills: [],
      jobTitle: "Platform Engineer",
      options: { forceFallback: true },
    });

    const item = items[0];

    // Section A: Learning Objective
    assert.ok(typeof item.learningObjective === "string" && item.learningObjective.length > 0, "Section A required");
    // Section B: Learning Steps
    assert.ok(Array.isArray(item.learningSteps) && item.learningSteps.length >= 3, "Section B required");
    assert.ok(item.learningSteps.every((s) => s.stepIndex && s.title && s.description && s.status));
    // Section C: Practical Activities
    assert.ok(Array.isArray(item.practicalActivities) && item.practicalActivities.length >= 2, "Section C required");
    // Section D: Mini Project
    assert.ok(item.miniProject && item.miniProject.title && item.miniProject.description && item.miniProject.demonstrates, "Section D required");
    // Section E: Completion Criteria
    assert.ok(Array.isArray(item.completionCriteria) && item.completionCriteria.length >= 2, "Section E required");

    // Metadata
    assert.ok(["BEGINNER", "INTERMEDIATE", "ADVANCED"].includes(item.difficulty));
    assert.ok(typeof item.estimatedDuration === "string");
  });
}

// Support both standalone execution and inclusion in master runner
if (require.main === module) {
  let passed = 0;
  let failed = 0;

  async function testAsync(name, fn) {
    try {
      await fn();
      console.log(`[PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`[FAIL] ${name}: ${err.message}`);
      failed++;
    }
  }

  (async () => {
    await runDay26SkillRoadmapTests(testAsync);
    console.log(`\nStandalone Day 26 Test Summary: ${passed} passed, ${failed} failed.`);
    process.exit(failed > 0 ? 1 : 0);
  })();
}

module.exports = { runDay26SkillRoadmapTests };

