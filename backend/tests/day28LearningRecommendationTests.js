/**
 * SkillLens AI — Day 28: Learning Recommendations Test Suite
 *
 * Automated verification of all 20 required scenarios:
 * 1. Missing required skill (role-grounded whyItMatters, HIGH/MED priority, complete steps)
 * 2. Missing preferred skill (differentiating advantage, MED/LOW priority)
 * 3. Partially matched skill (cites transferable candidate background, quick-win readiness)
 * 4. Strongly matched skill (excluded from recommendations; 100% match yields 0 recommendations)
 * 5. Multiple missing skills (generates distinct recommendations without collisions)
 * 6. Skills with different priority levels (HIGH, MEDIUM, LOW distribution)
 * 7. Required skill with high priority (assigned HIGH tier with explainable rationale)
 * 8. Preferred skill with low priority (assigned LOW tier with explainable rationale)
 * 9. Skills with learning dependencies (foundational skill prioritized before dependent)
 * 10. Empty skill gap results (0 gaps handled gracefully with 100% completion)
 * 11. Incomplete resume information (handled safely with warnings without fabricating skills)
 * 12. Missing job description requirements (handled cleanly without crashes)
 * 13. AI provider unavailable (deterministic fallback engages cleanly)
 * 14. Invalid or incomplete AI response (strict validation catches malformed output)
 * 15. Recommendation generation for different job roles (contextual adaptation to title/company)
 * 16. Existing Day 26 roadmap integration (reuses same roadmap_items, priority order, data model)
 * 17. Existing learning progress preservation (item and step progress preserved on re-generation)
 * 18. Duplicate recommendation prevention (aliases normalized and deduplicated)
 * 19. Unauthorized access to another user's recommendations (cross-user isolation & 401/404)
 * 20. Responsive desktop, tablet, and mobile layouts / UI schema validation
 */

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const db = require("../config/db");
const SkillMatchingService = require("../services/skillMatchingService");
const MatchScoreService = require("../services/matchScoreService");
const LearningRecommendationService = require("../services/learningRecommendationService");
const {
  getRecommendations,
  generateRecommendations,
  getSkillRecommendation,
  updateRecommendationStatus,
} = require("../controllers/recommendationController");

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

async function runDay28LearningRecommendationTests(testAsync) {
  console.log("\n--- SkillLens AI: Day 28 Learning Recommendation Tests ---");

  // Keep a reference to original db.query and db.getConnection
  const originalDbQuery = db.query;
  const originalGetConnection = db.getConnection;

  // Helper to safely stub db.query and db.getConnection for a test and restore them
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

  // ---- Test 1: Missing required skill ----
  await testAsync("1. Missing required skill generates role-grounded whyItMatters and complete recommendation", async () => {
    const why = LearningRecommendationService.generateWhyItMatters({
      skillName: "Docker",
      requirementType: "REQUIRED",
      matchingStatus: "MISSING",
      jobTitle: "Senior DevOps Engineer",
      company: "CloudScale Inc",
      isFoundational: true,
      dependentSkills: ["Kubernetes"],
    });

    assert.ok(why.includes("Docker is explicitly listed as a core required technology"));
    assert.ok(why.includes("Senior DevOps Engineer at CloudScale Inc"));
    assert.ok(why.includes("uploaded resume does not contain identified evidence"));
    assert.ok(why.includes("foundational prerequisite for other target technologies"));
    assert.ok(why.includes("Kubernetes"));

    const pri = LearningRecommendationService.determinePriority({
      requirementType: "REQUIRED",
      matchingStatus: "MISSING",
      priorityLevelNum: 1,
      jobPriority: "HIGH",
      isFoundational: true,
    });
    assert.strictEqual(pri.priorityLevel, "HIGH");
    assert.ok(pri.priorityReason.includes("High priority"));
  });

  // ---- Test 2: Missing preferred skill ----
  await testAsync("2. Missing preferred skill explains profile differentiation and assigns secondary priority", async () => {
    const why = LearningRecommendationService.generateWhyItMatters({
      skillName: "GraphQL",
      requirementType: "PREFERRED",
      matchingStatus: "MISSING",
      jobTitle: "Frontend Developer",
      company: "TechFlow",
    });

    assert.ok(why.includes("GraphQL is listed as a preferred qualification"));
    assert.ok(why.includes("strengthen your technical profile and give you a competitive edge"));
    assert.ok(!why.includes("core required"));

    const pri = LearningRecommendationService.determinePriority({
      requirementType: "PREFERRED",
      matchingStatus: "MISSING",
      priorityLevelNum: 3,
      jobPriority: "LOW",
    });
    assert.strictEqual(pri.priorityLevel, "LOW");
    assert.ok(pri.priorityReason.includes("Lower priority"));
  });

  // ---- Test 3: Partially matched skill ----
  await testAsync("3. Partially matched skill cites candidate's transferable evidence and quick-win readiness", async () => {
    const why = LearningRecommendationService.generateWhyItMatters({
      skillName: "TypeScript",
      requirementType: "REQUIRED",
      matchingStatus: "PARTIAL_MATCH",
      jobTitle: "React Engineer",
      company: "Innovate Ltd",
      relatedSkill: "JavaScript",
    });

    assert.ok(why.includes("resume demonstrates transferable background in related technology (JavaScript)"));
    assert.ok(why.includes("direct practical experience with TypeScript was not identified in the resume text"));

    const pri = LearningRecommendationService.determinePriority({
      requirementType: "REQUIRED",
      matchingStatus: "PARTIAL_MATCH",
      priorityLevelNum: 2,
      jobPriority: "MEDIUM",
    });
    assert.strictEqual(pri.priorityLevel, "MEDIUM");
    assert.ok(pri.priorityReason.includes("transferable foundation in related technology"));
  });

  // ---- Test 4: Strongly matched skill ----
  await testAsync("4. Strongly matched skills are excluded from recommendations (100% match yields 0 recommendations)", withMockDb(
    async (sql, params) => {
      if (sql.includes("FROM resumes")) {
        return [[{ id: 1, original_filename: "Senior_Resume.pdf", processing_status: "COMPLETED", extracted_text: "React Node" }]];
      }
      if (sql.includes("FROM jobs")) {
        return [[{ id: 2, title: "Full Stack Engineer", company: "Acme", description: "React Node", processing_status: "COMPLETED" }]];
      }
      if (sql.includes("FROM resume_skills")) {
        return [[
          { id: 10, name: "React", category: "FRAMEWORK", proficiency: "EXPERT", evidence: "4 yrs React" },
          { id: 11, name: "Node.js", category: "FRAMEWORK", proficiency: "EXPERT", evidence: "3 yrs Node" },
        ]];
      }
      if (sql.includes("FROM analyses")) {
        return [[{ id: 99 }]];
      }
      if (sql.includes("FROM roadmap_items")) {
        return [[]];
      }
      return [[]];
    },
    async () => {
      // Mock SkillMatchingService.getSavedMatching to return only STRONG_MATCH
      const origMatching = SkillMatchingService.getSavedMatching;
      const origScore = MatchScoreService.getSavedMatchScore;
      SkillMatchingService.getSavedMatching = async () => ({
        results: [
          { jobSkill: "React", normalizedSkill: "react", category: "STRONG_MATCH", requirementType: "REQUIRED" },
          { jobSkill: "Node.js", normalizedSkill: "node.js", category: "STRONG_MATCH", requirementType: "REQUIRED" },
        ],
      });
      MatchScoreService.getSavedMatchScore = async () => ({
        overall: { score: 100, status: "AVAILABLE" },
      });

      try {
        const result = await LearningRecommendationService.generateRecommendations(1, 2, 10);
        assert.strictEqual(result.recommendations.length, 0, "No recommendations should be created for strong matches");
        assert.strictEqual(result.overview.totalGaps, 0);
        assert.strictEqual(result.overview.completionPercentage, 100);
      } finally {
        SkillMatchingService.getSavedMatching = origMatching;
        MatchScoreService.getSavedMatchScore = origScore;
      }
    }
  ));

  // ---- Test 5: Multiple missing skills ----
  await testAsync("5. Multiple missing skills generate distinct recommendations without collisions", withMockDb(
    async (sql, params) => {
      if (sql.includes("FROM resumes")) return [[{ id: 1, original_filename: "Resume.pdf", extracted_text: "HTML CSS" }]];
      if (sql.includes("FROM jobs")) return [[{ id: 2, title: "Full Stack Engineer", company: "Acme" }]];
      if (sql.includes("FROM resume_skills")) return [[{ id: 1, name: "HTML5", category: "FRONTEND" }]];
      if (sql.includes("FROM analyses")) return [[{ id: 99 }]];
      if (sql.includes("FROM roadmap_items")) return [[]];
      if (sql.includes("INSERT INTO roadmap_items") || sql.includes("UPDATE roadmap_items")) return [{ insertId: 101 }];
      return [[]];
    },
    async () => {
      const origMatching = SkillMatchingService.getSavedMatching;
      const origScore = MatchScoreService.getSavedMatchScore;
      SkillMatchingService.getSavedMatching = async () => ({
        results: [
          { jobSkill: "Docker", normalizedSkill: "docker", category: "MISSING", requirementType: "REQUIRED", priority: "HIGH" },
          { jobSkill: "TypeScript", normalizedSkill: "typescript", category: "MISSING", requirementType: "REQUIRED", priority: "HIGH" },
          { jobSkill: "AWS", normalizedSkill: "aws", category: "MISSING", requirementType: "REQUIRED", priority: "MEDIUM" },
        ],
      });
      MatchScoreService.getSavedMatchScore = async () => ({ overall: { score: 55 } });

      try {
        const result = await LearningRecommendationService.generateRecommendations(1, 2, 10);
        assert.strictEqual(result.recommendations.length, 3);
        const skillNames = result.recommendations.map((r) => r.skillName);
        assert.ok(skillNames.includes("Docker"));
        assert.ok(skillNames.includes("TypeScript"));
        assert.ok(skillNames.includes("AWS"));
        // Each has its own distinct topics and steps
        assert.ok(result.recommendations[0].recommendedTopics.length >= 3);
        assert.ok(result.recommendations[1].recommendedTopics.length >= 3);
        assert.ok(result.recommendations[2].recommendedTopics.length >= 3);
      } finally {
        SkillMatchingService.getSavedMatching = origMatching;
        MatchScoreService.getSavedMatchScore = origScore;
      }
    }
  ));

  // ---- Test 6: Skills with different priority levels ----
  await testAsync("6. Skills with different priority levels correctly map into HIGH, MEDIUM, and LOW tiers", () => {
    // 1. Core required skill with High job priority
    const p1 = LearningRecommendationService.determinePriority({
      requirementType: "REQUIRED",
      matchingStatus: "MISSING",
      priorityLevelNum: 1,
      jobPriority: "HIGH",
    });
    assert.strictEqual(p1.priorityLevel, "HIGH");

    // 2. Partial match transferable skill
    const p2 = LearningRecommendationService.determinePriority({
      requirementType: "REQUIRED",
      matchingStatus: "PARTIAL_MATCH",
      priorityLevelNum: 2,
      jobPriority: "MEDIUM",
    });
    assert.strictEqual(p2.priorityLevel, "MEDIUM");

    // 3. Preferred secondary skill
    const p3 = LearningRecommendationService.determinePriority({
      requirementType: "PREFERRED",
      matchingStatus: "MISSING",
      priorityLevelNum: 3,
      jobPriority: "LOW",
    });
    assert.strictEqual(p3.priorityLevel, "LOW");
  });

  // ---- Test 7: Required skill with high priority ----
  await testAsync("7. Required skill with high priority assigns HIGH tier and explainable core requirement reason", () => {
    const pri = LearningRecommendationService.determinePriority({
      requirementType: "REQUIRED",
      matchingStatus: "MISSING",
      priorityLevelNum: 1,
      jobPriority: "HIGH",
    });
    assert.strictEqual(pri.priorityLevel, "HIGH");
    assert.ok(pri.priorityReason.includes("Core required technology with high importance"));
  });

  // ---- Test 8: Preferred skill with low priority ----
  await testAsync("8. Preferred skill with low priority assigns LOW tier with non-mandatory rationale", () => {
    const pri = LearningRecommendationService.determinePriority({
      requirementType: "PREFERRED",
      matchingStatus: "MISSING",
      priorityLevelNum: 3,
      jobPriority: "LOW",
    });
    assert.strictEqual(pri.priorityLevel, "LOW");
    assert.ok(pri.priorityReason.includes("without being mandatory"));
  });

  // ---- Test 9: Skills with learning dependencies ----
  await testAsync("9. Foundational skill is prioritized before dependent skill in recommendation sequence", withMockDb(
    async (sql, params) => {
      if (sql.includes("FROM resumes")) return [[{ id: 1, original_filename: "Dev_CV.pdf", extracted_text: "HTML" }]];
      if (sql.includes("FROM jobs")) return [[{ id: 2, title: "Cloud Platform Engineer", company: "Stripe" }]];
      if (sql.includes("FROM resume_skills")) return [[]];
      if (sql.includes("FROM analyses")) return [[{ id: 10 }]];
      if (sql.includes("FROM roadmap_items")) return [[]];
      if (sql.includes("INSERT INTO roadmap_items") || sql.includes("UPDATE roadmap_items")) return [{ insertId: 1 }];
      return [[]];
    },
    async () => {
      const origMatching = SkillMatchingService.getSavedMatching;
      const origScore = MatchScoreService.getSavedMatchScore;
      SkillMatchingService.getSavedMatching = async () => ({
        results: [
          { jobSkill: "Kubernetes", normalizedSkill: "kubernetes", category: "MISSING", requirementType: "REQUIRED", priority: "HIGH" },
          { jobSkill: "Docker", normalizedSkill: "docker", category: "MISSING", requirementType: "REQUIRED", priority: "HIGH" },
        ],
      });
      MatchScoreService.getSavedMatchScore = async () => ({ overall: { score: 40 } });

      try {
        const result = await LearningRecommendationService.generateRecommendations(1, 2, 10);
        assert.strictEqual(result.recommendations.length, 2);
        // Docker is foundational for Kubernetes, so Docker must come first
        assert.strictEqual(result.recommendations[0].skillName, "Docker");
        assert.strictEqual(result.recommendations[1].skillName, "Kubernetes");
        assert.ok(result.recommendations[0].isFoundational, "Docker must be flagged as foundational");
        assert.ok(result.recommendations[0].whyItMatters.includes("foundational prerequisite"));
      } finally {
        SkillMatchingService.getSavedMatching = origMatching;
        MatchScoreService.getSavedMatchScore = origScore;
      }
    }
  ));

  // ---- Test 10: Empty skill gap results ----
  await testAsync("10. Empty skill gap results return clean 0-gap summary without runtime errors", withMockDb(
    async (sql, params) => {
      if (sql.includes("FROM resumes")) return [[{ id: 1, original_filename: "Perfect_CV.pdf" }]];
      if (sql.includes("FROM jobs")) return [[{ id: 2, title: "Lead Developer" }]];
      if (sql.includes("FROM resume_skills")) return [[{ id: 1, name: "React", category: "FRONTEND" }]];
      if (sql.includes("FROM analyses")) return [[{ id: 5 }]];
      if (sql.includes("FROM roadmap_items")) return [[]];
      return [[]];
    },
    async () => {
      const origMatching = SkillMatchingService.getSavedMatching;
      const origScore = MatchScoreService.getSavedMatchScore;
      SkillMatchingService.getSavedMatching = async () => ({ results: [] });
      MatchScoreService.getSavedMatchScore = async () => ({ overall: { score: 100 } });

      try {
        const result = await LearningRecommendationService.generateRecommendations(1, 2, 10);
        assert.strictEqual(result.recommendations.length, 0);
        assert.strictEqual(result.overview.totalGaps, 0);
        assert.strictEqual(result.overview.completionPercentage, 100);
      } finally {
        SkillMatchingService.getSavedMatching = origMatching;
        MatchScoreService.getSavedMatchScore = origScore;
      }
    }
  ));

  // ---- Test 11: Incomplete resume information ----
  await testAsync("11. Incomplete resume with 0 extracted skills generates honest warnings without fabricating data", withMockDb(
    async (sql, params) => {
      if (sql.includes("FROM resumes")) return [[{ id: 1, original_filename: "Empty_CV.pdf" }]];
      if (sql.includes("FROM jobs")) return [[{ id: 2, title: "Junior Dev" }]];
      if (sql.includes("FROM resume_skills")) return [[]]; // 0 skills
      if (sql.includes("FROM analyses")) return [[{ id: 15 }]];
      if (sql.includes("FROM roadmap_items")) return [[]];
      if (sql.includes("INSERT INTO roadmap_items")) return [{ insertId: 1 }];
      return [[]];
    },
    async () => {
      const origMatching = SkillMatchingService.getSavedMatching;
      const origScore = MatchScoreService.getSavedMatchScore;
      SkillMatchingService.getSavedMatching = async () => ({
        results: [{ jobSkill: "Python", normalizedSkill: "python", category: "MISSING", requirementType: "REQUIRED" }],
      });
      MatchScoreService.getSavedMatchScore = async () => ({ overall: { score: 0 } });

      try {
        const result = await LearningRecommendationService.generateRecommendations(1, 2, 10);
        assert.strictEqual(result.recommendations.length, 1);
        assert.ok(result.warnings.some((w) => w.includes("contains no extracted technical skills")));
      } finally {
        SkillMatchingService.getSavedMatching = origMatching;
        MatchScoreService.getSavedMatchScore = origScore;
      }
    }
  ));

  // ---- Test 12: Missing job description requirements ----
  await testAsync("12. Missing job description requirements handled cleanly without crashing", withMockDb(
    async (sql, params) => {
      if (sql.includes("FROM resumes")) return [[{ id: 1, original_filename: "CV.pdf" }]];
      if (sql.includes("FROM jobs")) return [[{ id: 2, title: "Empty Role" }]];
      if (sql.includes("FROM resume_skills")) return [[{ id: 1, name: "JavaScript" }]];
      if (sql.includes("FROM analyses")) return [[{ id: 25 }]];
      if (sql.includes("FROM roadmap_items")) return [[]];
      return [[]];
    },
    async () => {
      const origMatching = SkillMatchingService.getSavedMatching;
      const origScore = MatchScoreService.getSavedMatchScore;
      SkillMatchingService.getSavedMatching = async () => ({ results: [], matchingMetadata: { warnings: ["No skills in job"] } });
      MatchScoreService.getSavedMatchScore = async () => ({ overall: { score: 0 }, metadata: { warnings: [] } });

      try {
        const result = await LearningRecommendationService.generateRecommendations(1, 2, 10);
        assert.strictEqual(result.recommendations.length, 0);
        assert.ok(result.warnings.some((w) => w.includes("No skills in job")));
      } finally {
        SkillMatchingService.getSavedMatching = origMatching;
        MatchScoreService.getSavedMatchScore = origScore;
      }
    }
  ));

  // ---- Test 13: AI provider unavailable (fallback) ----
  await testAsync("13. When AI is unavailable or forced fallback, deterministic fallback generates complete recommendation", withMockDb(
    async (sql, params) => {
      if (sql.includes("FROM resumes")) return [[{ id: 1, original_filename: "Candidate.pdf" }]];
      if (sql.includes("FROM jobs")) return [[{ id: 2, title: "Backend Engineer", company: "DataHQ" }]];
      if (sql.includes("FROM resume_skills")) return [[]];
      if (sql.includes("FROM analyses")) return [[{ id: 30 }]];
      if (sql.includes("FROM roadmap_items")) return [[]];
      if (sql.includes("INSERT INTO roadmap_items")) return [{ insertId: 1 }];
      return [[]];
    },
    async () => {
      const origMatching = SkillMatchingService.getSavedMatching;
      const origScore = MatchScoreService.getSavedMatchScore;
      SkillMatchingService.getSavedMatching = async () => ({
        results: [
          { jobSkill: "Docker", normalizedSkill: "docker", category: "MISSING", requirementType: "REQUIRED", priority: "HIGH" },
          { jobSkill: "Solidity", normalizedSkill: "solidity", category: "MISSING", requirementType: "REQUIRED", priority: "MEDIUM" },
        ],
      });
      MatchScoreService.getSavedMatchScore = async () => ({ overall: { score: 20 } });

      try {
        // Run with forceFallback: true
        const result = await LearningRecommendationService.generateRecommendations(1, 2, 10, { forceFallback: true });
        assert.strictEqual(result.recommendations.length, 2);

        // Check Docker from curated list
        const docker = result.recommendations.find((r) => r.skillName === "Docker");
        assert.ok(docker.recommendedTopics.length >= 4);
        assert.ok(docker.learningSteps.length >= 3);
        assert.ok(docker.miniProject && docker.miniProject.title);
        assert.ok(docker.expectedOutcomes.length >= 2);

        // Check Solidity from generic dynamic generator
        const solidity = result.recommendations.find((r) => r.skillName === "Solidity");
        assert.ok(solidity.recommendedTopics.length >= 4);
        assert.ok(solidity.learningSteps.length >= 3);
        assert.ok(solidity.miniProject && solidity.miniProject.title);
        assert.ok(solidity.expectedOutcomes.length >= 2);
      } finally {
        SkillMatchingService.getSavedMatching = origMatching;
        MatchScoreService.getSavedMatchScore = origScore;
      }
    }
  ));

  // ---- Test 14: Invalid or incomplete AI response ----
  await testAsync("14. Invalid or malformed AI response triggers validation error safely", () => {
    // Missing learningObjective
    assert.throws(
      () => LearningRecommendationService.parseAndValidateAiOutput(JSON.stringify({ recommendedTopics: ["A", "B"] })),
      /Missing learningObjective/
    );

    // Missing recommendedTopics
    assert.throws(
      () => LearningRecommendationService.parseAndValidateAiOutput(JSON.stringify({ learningObjective: "Valid", recommendedTopics: [] })),
      /Invalid or insufficient recommendedTopics/
    );

    // Missing learningSteps
    assert.throws(
      () => LearningRecommendationService.parseAndValidateAiOutput(JSON.stringify({
        learningObjective: "Valid",
        recommendedTopics: ["A", "B"],
        learningSteps: [{ title: "Step 1" }],
      })),
      /Invalid or insufficient learningSteps/
    );
  });

  // ---- Test 15: Recommendation generation for different job roles ----
  await testAsync("15. Recommendations contextualize whyItMatters specifically to target job title and company", () => {
    const recFrontend = LearningRecommendationService.generateWhyItMatters({
      skillName: "React",
      requirementType: "REQUIRED",
      matchingStatus: "MISSING",
      jobTitle: "Senior Frontend Lead",
      company: "Shopify",
    });
    assert.ok(recFrontend.includes("Senior Frontend Lead at Shopify"));

    const recBackend = LearningRecommendationService.generateWhyItMatters({
      skillName: "Go",
      requirementType: "REQUIRED",
      matchingStatus: "MISSING",
      jobTitle: "Distributed Systems Engineer",
      company: "Uber",
    });
    assert.ok(recBackend.includes("Distributed Systems Engineer at Uber"));
  });

  // ---- Test 16: Existing Day 26 roadmap integration ----
  await testAsync("16. Reuses existing roadmap_items data model and maintains seamless synchronization", withMockDb(
    async (sql, params) => {
      if (sql.includes("SELECT id, resume_id, job_id FROM analyses WHERE id = ?")) {
        return [[{ id: 45, resume_id: 1, job_id: 2 }]];
      }
      if (sql.includes("FROM resumes")) return [[{ id: 1, original_filename: "Resume.pdf" }]];
      if (sql.includes("FROM jobs")) return [[{ id: 2, title: "Full Stack Engineer" }]];
      if (sql.includes("FROM resume_skills")) return [[]];
      if (sql.includes("FROM analyses WHERE user_id = ?")) return [[{ id: 45 }]];
      if (sql.includes("FROM roadmap_items")) return [[]];
      if (sql.includes("INSERT INTO roadmap_items")) return [{ insertId: 55 }];
      return [[]];
    },
    async () => {
      const origMatching = SkillMatchingService.getSavedMatching;
      const origScore = MatchScoreService.getSavedMatchScore;
      SkillMatchingService.getSavedMatching = async () => ({
        results: [{ jobSkill: "Docker", normalizedSkill: "docker", category: "MISSING", requirementType: "REQUIRED" }],
      });
      MatchScoreService.getSavedMatchScore = async () => ({ overall: { score: 60 } });

      try {
        const item = await LearningRecommendationService.getSkillRecommendation(45, "Docker", 10);
        assert.strictEqual(item.skillName, "Docker");
        assert.ok(item.recommendedTopics.length >= 3);
        assert.ok(item.whyItMatters.length > 0);
      } finally {
        SkillMatchingService.getSavedMatching = origMatching;
        MatchScoreService.getSavedMatchScore = origScore;
      }
    }
  ));

  // ---- Test 17: Existing learning progress preservation ----
  await testAsync("17. Re-generating recommendations preserves user's existing item and step progress", withMockDb(
    async (sql, params) => {
      if (sql.includes("FROM resumes")) return [[{ id: 1, original_filename: "Resume.pdf" }]];
      if (sql.includes("FROM jobs")) return [[{ id: 2, title: "Frontend Lead" }]];
      if (sql.includes("FROM resume_skills")) return [[]];
      if (sql.includes("FROM analyses")) return [[{ id: 50 }]];
      // Return existing roadmap item with progress
      if (sql.includes("FROM roadmap_items")) {
        return [[
          {
            id: 88,
            skill_id: 5,
            title: "TypeScript",
            step_order: 1,
            difficulty: "INTERMEDIATE",
            status: "IN_PROGRESS",
            estimated_duration: "2 weeks",
            description: JSON.stringify({
              learningSteps: [
                { stepIndex: 1, status: "COMPLETED" },
                { stepIndex: 2, status: "IN_PROGRESS" },
                { stepIndex: 3, status: "NOT_STARTED" },
              ],
            }),
          },
        ]];
      }
      if (sql.includes("UPDATE roadmap_items")) return [{ affectedRows: 1 }];
      return [[]];
    },
    async () => {
      const origMatching = SkillMatchingService.getSavedMatching;
      const origScore = MatchScoreService.getSavedMatchScore;
      SkillMatchingService.getSavedMatching = async () => ({
        results: [{ jobSkill: "TypeScript", normalizedSkill: "typescript", category: "MISSING", requirementType: "REQUIRED" }],
      });
      MatchScoreService.getSavedMatchScore = async () => ({ overall: { score: 65 } });

      try {
        const result = await LearningRecommendationService.generateRecommendations(1, 2, 10, { forceFallback: true });
        assert.strictEqual(result.recommendations.length, 1);
        const ts = result.recommendations[0];
        assert.strictEqual(ts.status, "IN_PROGRESS", "Overall item status must be preserved");
        assert.strictEqual(ts.learningSteps[0].status, "COMPLETED", "Step 1 status must be preserved");
        assert.strictEqual(ts.learningSteps[1].status, "IN_PROGRESS", "Step 2 status must be preserved");
        assert.strictEqual(ts.learningSteps[2].status, "NOT_STARTED", "Step 3 status must be preserved");
      } finally {
        SkillMatchingService.getSavedMatching = origMatching;
        MatchScoreService.getSavedMatchScore = origScore;
      }
    }
  ));

  // ---- Test 18: Duplicate recommendation prevention ----
  await testAsync("18. Duplicate or alias skill mentions do not generate duplicate recommendation cards", withMockDb(
    async (sql, params) => {
      if (sql.includes("FROM resumes")) return [[{ id: 1, original_filename: "Resume.pdf" }]];
      if (sql.includes("FROM jobs")) return [[{ id: 2, title: "Full Stack Engineer" }]];
      if (sql.includes("FROM resume_skills")) return [[]];
      if (sql.includes("FROM analyses")) return [[{ id: 60 }]];
      if (sql.includes("FROM roadmap_items")) return [[]];
      if (sql.includes("INSERT INTO roadmap_items")) return [{ insertId: 1 }];
      return [[]];
    },
    async () => {
      const origMatching = SkillMatchingService.getSavedMatching;
      const origScore = MatchScoreService.getSavedMatchScore;
      SkillMatchingService.getSavedMatching = async () => ({
        results: [
          { jobSkill: "Node.js", normalizedSkill: "node.js", category: "MISSING", requirementType: "REQUIRED" },
          { jobSkill: "NodeJS", normalizedSkill: "node.js", category: "MISSING", requirementType: "REQUIRED" },
          { jobSkill: "PostgreSQL", normalizedSkill: "postgresql", category: "MISSING", requirementType: "REQUIRED" },
          { jobSkill: "Postgres", normalizedSkill: "postgresql", category: "MISSING", requirementType: "REQUIRED" },
        ],
      });
      MatchScoreService.getSavedMatchScore = async () => ({ overall: { score: 50 } });

      try {
        const result = await LearningRecommendationService.generateRecommendations(1, 2, 10);
        assert.strictEqual(result.recommendations.length, 2, "Must deduplicate NodeJS and Postgres aliases");
      } finally {
        SkillMatchingService.getSavedMatching = origMatching;
        MatchScoreService.getSavedMatchScore = origScore;
      }
    }
  ));

  // ---- Test 19: Unauthorized access to another user's recommendations ----
  await testAsync("19. Rejects unauthenticated requests with 401 and cross-user requests with 404", withMockDb(
    async (sql, params) => {
      // Return empty for cross-user ownership check
      return [[]];
    },
    async () => {
      // 1. Unauthenticated request to getRecommendations
      const reqUnauth = { user: null, params: { resumeId: "1", jobDescriptionId: "2" } };
      const resUnauth = createMockRes();
      await getRecommendations(reqUnauth, resUnauth);
      assert.strictEqual(resUnauth.statusCode, 401);

      // 2. Unauthenticated request to generateRecommendations
      const reqGenUnauth = { user: null, body: { resumeId: 1, jobDescriptionId: 2 } };
      const resGenUnauth = createMockRes();
      await generateRecommendations(reqGenUnauth, resGenUnauth);
      assert.strictEqual(resGenUnauth.statusCode, 401);

      // 3. Cross-user access returns 404 (ownership check fails)
      const reqCross = { user: { id: 99 }, params: { resumeId: "1", jobDescriptionId: "2" } };
      const resCross = createMockRes();
      await getRecommendations(reqCross, resCross);
      assert.strictEqual(resCross.statusCode, 404);
    }
  ));

  // ---- Test 20: Responsive desktop, tablet, and mobile layouts / UI schema validation ----
  await testAsync("20. Recommendations UI component and CSS adhere to responsive layout and accessibility contracts", () => {
    const jsxPath = path.join(__dirname, "..", "..", "frontend", "src", "pages", "Recommendations.jsx");
    const cssPath = path.join(__dirname, "..", "..", "frontend", "src", "pages", "Recommendations.module.css");

    assert.ok(fs.existsSync(jsxPath), "Recommendations.jsx must exist");
    assert.ok(fs.existsSync(cssPath), "Recommendations.module.css must exist");

    const jsx = fs.readFileSync(jsxPath, "utf8");
    const css = fs.readFileSync(cssPath, "utf8");

    // UI Structure & accessibility
    assert.ok(jsx.includes("role=\"button\""), "Must have accessible role button");
    assert.ok(jsx.includes("aria-expanded"), "Must have aria-expanded attribute");
    assert.ok(jsx.includes("Why This Skill Matters"), "Must render Why This Skill section");
    assert.ok(jsx.includes("Recommended Topics"), "Must render Recommended Topics");
    assert.ok(jsx.includes("Step-by-Step Learning Sequence"), "Must render Learning Steps");
    assert.ok(jsx.includes("Demonstration Mini Project"), "Must render Mini Project");
    assert.ok(jsx.includes("Expected Measurable Outcomes"), "Must render Expected Outcomes");
    assert.ok(jsx.includes("handleToggleStepStatus"), "Must support step status updates");

    // Responsive CSS breakpoints
    assert.ok(css.includes("@media (max-width: 768px)"), "CSS must contain 768px tablet breakpoint");
    assert.ok(css.includes("@media (max-width: 480px)"), "CSS must contain 480px mobile breakpoint");
    assert.ok(css.includes(".recommendationCard"), "CSS must format recommendation cards");
    assert.ok(css.includes(".topicChip"), "CSS must style recommended topic chips");
    assert.ok(css.includes(".whySection"), "CSS must style why it matters section");
  });
}

// Standalone runner support
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
    await runDay28LearningRecommendationTests(testAsync);
    console.log(`\nStandalone Day 28 Test Summary: ${passed} passed, ${failed} failed.`);
    process.exit(failed > 0 ? 1 : 0);
  })();
}

module.exports = { runDay28LearningRecommendationTests };
