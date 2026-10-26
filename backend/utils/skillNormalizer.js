/**
 * SkillLens AI — Shared Skill Normalizer Utility
 * Day 19: AI-Powered Skill Extraction & Normalization
 *
 * Implements conservative, explainable skill normalization rules:
 * - Maps known aliases to canonical display names and categories.
 * - Prevents incorrect merging of distinct technologies (e.g., Java != JavaScript, C != C++, Git != GitHub).
 * - Generates consistent canonical identifiers (normalizedName).
 * - Deduplicates skill collections while preserving highest priority and evidence.
 */

const { SKILL_CATALOGUE } = require("./skillCatalogue");

// Fast lookup maps constructed once from SKILL_CATALOGUE
// alias (lowercased) -> { name, category, normalizedName }
const ALIAS_MAP = new Map();
// canonical name (lowercased) -> { name, category, normalizedName }
const CANONICAL_MAP = new Map();

for (const skill of SKILL_CATALOGUE) {
  const normalizedKey = skill.name.toLowerCase().trim();
  const canonicalObj = {
    name: skill.name,
    category: skill.category,
    normalizedName: normalizedKey,
  };

  CANONICAL_MAP.set(normalizedKey, canonicalObj);

  // Map each alias
  if (Array.isArray(skill.aliases)) {
    for (const alias of skill.aliases) {
      const aliasKey = alias.toLowerCase().trim();
      if (!ALIAS_MAP.has(aliasKey)) {
        ALIAS_MAP.set(aliasKey, canonicalObj);
      }
    }
  }
}

// Explicit distinct technology guard to prevent false merges
const DISTINCT_TECHNOLOGY_GUARDS = [
  { term1: "java", term2: "javascript" },
  { term1: "c", term2: "c++" },
  { term1: "c", term2: "c#" },
  { term1: "c++", term2: "c#" },
  { term1: "git", term2: "github" },
  { term1: "git", term2: "gitlab" },
  { term1: "python", term2: "pytorch" },
  { term1: "sql", term2: "nosql" },
  { term1: "r", term2: "rust" },
  { term1: "go", term2: "google cloud platform" },
];

/**
 * Checks whether two skill names represent distinct, non-interchangeable technologies.
 *
 * @param {string} nameA
 * @param {string} nameB
 * @returns {boolean} True if technologies must remain strictly separate
 */
function areDistinctTechnologies(nameA, nameB) {
  if (!nameA || !nameB) return false;
  const a = nameA.toLowerCase().trim();
  const b = nameB.toLowerCase().trim();
  if (a === b) return false;

  for (const pair of DISTINCT_TECHNOLOGY_GUARDS) {
    if ((a === pair.term1 && b === pair.term2) || (a === pair.term2 && b === pair.term1)) {
      return true;
    }
  }
  return false;
}

/**
 * Generates a clean canonical normalized identifier for a skill name.
 * e.g., "React.js" -> "react", "Node.js" -> "node.js", "C++" -> "c++"
 *
 * @param {string} name
 * @returns {string}
 */
function createNormalizedIdentifier(name) {
  if (!name || typeof name !== "string") return "";
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

/**
 * Normalizes a raw skill name using conservative, context-aware rules.
 *
 * @param {string} rawName - Raw skill mention from resume or job text
 * @param {Object} [options]
 * @param {string} [options.categoryHint] - Optional category hint if known
 * @param {string} [options.context] - Surrounding context string for disambiguation
 * @returns {{ name: string, normalizedName: string, category: string, isAmbiguous: boolean }}
 */
function normalizeSkillName(rawName, options = {}) {
  if (!rawName || typeof rawName !== "string") {
    return null;
  }

  // Strip leading/trailing punctuation, bullet markers, brackets, and quotes
  let cleaned = rawName
    .replace(/^[\s•\-*#>\d.)]+/, "")
    .replace(/[;:,."'`]+$/, "")
    .trim();

  if (!cleaned) return null;

  const lower = cleaned.toLowerCase();

  // 1. Direct canonical name match
  if (CANONICAL_MAP.has(lower)) {
    const matched = CANONICAL_MAP.get(lower);
    return {
      name: matched.name,
      normalizedName: matched.normalizedName,
      category: matched.category,
      isAmbiguous: false,
    };
  }

  // 2. Direct alias match
  if (ALIAS_MAP.has(lower)) {
    // Special context checks for short/ambiguous aliases
    if (lower === "js") {
      const context = (options.context || "").toLowerCase();
      // Only treat "js" as JavaScript if context indicates coding or frontend/backend
      const hasJsContext =
        context.includes("script") ||
        context.includes("react") ||
        context.includes("node") ||
        context.includes("web") ||
        context.includes("html") ||
        context.includes("css") ||
        context.includes("code") ||
        context.includes("frontend") ||
        context.includes("typescript") ||
        context.includes("programming");

      if (!hasJsContext && !options.context) {
        // If standalone and explicitly in a skill list, accept with flag
        const matched = ALIAS_MAP.get("js");
        return {
          name: matched.name,
          normalizedName: matched.normalizedName,
          category: matched.category,
          isAmbiguous: true,
        };
      }
    }

    const matched = ALIAS_MAP.get(lower);
    return {
      name: matched.name,
      normalizedName: matched.normalizedName,
      category: matched.category,
      isAmbiguous: false,
    };
  }

  // 3. Normalized punctuation checks (e.g. "ReactJS" -> "react.js", "NodeJS" -> "node.js")
  const compactLower = lower.replace(/[\s._-]+/g, "");
  for (const [alias, canonical] of ALIAS_MAP.entries()) {
    const compactAlias = alias.replace(/[\s._-]+/g, "");
    if (compactLower === compactAlias) {
      return {
        name: canonical.name,
        normalizedName: canonical.normalizedName,
        category: canonical.category,
        isAmbiguous: false,
      };
    }
  }

  // 4. Handle "Amazon Web Services" -> "AWS" or "GCP" -> "Google Cloud Platform"
  if (lower === "amazon web services" || lower === "aws cloud") {
    const canonical = ALIAS_MAP.get("aws");
    return {
      name: canonical.name,
      normalizedName: canonical.normalizedName,
      category: canonical.category,
      isAmbiguous: false,
    };
  }

  if (lower === "google cloud" || lower === "google cloud platform" || lower === "gcp") {
    const canonical = ALIAS_MAP.get("gcp");
    return {
      name: canonical.name,
      normalizedName: canonical.normalizedName,
      category: canonical.category,
      isAmbiguous: false,
    };
  }

  // 5. Unknown or uncatalogued skill: preserve original display name cleanly without unsupported assumptions
  // Title-case single words unless already mixed case (e.g., GraphQL, PyTorch)
  let formattedName = cleaned;
  if (/^[a-z]+$/.test(cleaned) && cleaned.length > 1) {
    formattedName = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  }

  return {
    name: formattedName,
    normalizedName: createNormalizedIdentifier(cleaned),
    category: options.categoryHint || "OTHER",
    isAmbiguous: false,
  };
}

/**
 * Deduplicates an array of skill objects by normalizedName.
 * Merges evidence, prioritizes required over preferred for jobs,
 * and keeps highest confidence score.
 *
 * @param {Array<Object>} skills
 * @returns {Array<Object>}
 */
function deduplicateSkills(skills) {
  if (!Array.isArray(skills) || skills.length === 0) {
    return [];
  }

  const map = new Map();

  for (const raw of skills) {
    if (!raw || !raw.name) continue;

    const normalized = normalizeSkillName(raw.name, {
      categoryHint: raw.category,
      context: raw.evidence || "",
    });

    if (!normalized) continue;

    const key = normalized.normalizedName;

    if (!map.has(key)) {
      map.set(key, {
        name: normalized.name,
        normalizedName: key,
        category: raw.category && raw.category !== "OTHER" ? raw.category : normalized.category,
        confidence: typeof raw.confidence === "number" ? Math.min(Math.max(raw.confidence, 0), 1) : null,
        evidence: (raw.evidence || "").trim(),
        required: raw.required !== undefined ? Boolean(raw.required) : undefined,
        priority: raw.priority || (raw.required ? "HIGH" : "MEDIUM"),
      });
    } else {
      const existing = map.get(key);

      // Keep required = true if either occurrence is required
      if (raw.required === true || existing.required === true) {
        existing.required = true;
        existing.priority = "HIGH";
      } else if (!existing.priority && raw.priority) {
        existing.priority = raw.priority;
      }

      // Keep higher confidence
      if (typeof raw.confidence === "number") {
        if (existing.confidence === null || raw.confidence > existing.confidence) {
          existing.confidence = raw.confidence;
        }
      }

      // Combine or keep longer evidence snippet
      if (raw.evidence && (!existing.evidence || raw.evidence.length > existing.evidence.length)) {
        existing.evidence = raw.evidence.trim();
      }

      // Upgrade category if previously OTHER
      if (existing.category === "OTHER" && raw.category && raw.category !== "OTHER") {
        existing.category = raw.category;
      }
    }
  }

  return Array.from(map.values());
}

module.exports = {
  normalizeSkillName,
  deduplicateSkills,
  areDistinctTechnologies,
  createNormalizedIdentifier,
  CANONICAL_MAP,
  ALIAS_MAP,
};
