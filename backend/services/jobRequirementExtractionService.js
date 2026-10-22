/**
 * SkillLens AI — Job Requirement Extraction Service
 * Day 16: Deterministic, Explainable Job Requirement Extraction
 *
 * Extracts structured requirements from job description text across:
 *  - Required Skills (explicitly mandatory)
 *  - Preferred Skills (optional, nice-to-have, bonus)
 *  - Experience (min/max years, seniority level, domain details)
 *  - Education (degrees, fields of study, equivalent qualifications)
 *  - Tools (utilities, VCS, IDEs, CI/CD, project management)
 *  - Technologies (languages, frameworks, databases, cloud platforms)
 *  - Certifications (name, issuer, required vs preferred)
 *
 * Adheres to docs/DATABASE_SCHEMA.md, docs/PRD.md, and docs/TRD.md.
 */

const db = require("../config/db");
const { SKILL_CATALOGUE } = require("../utils/skillCatalogue");

// -----------------------------------------------------------------------------
// 1. SECTION HEADING DETECTION
// -----------------------------------------------------------------------------
const SECTION_PATTERNS = [
  {
    type: "PREFERRED",
    pattern: /^(?:preferred\s+qualifications|preferred\s+skills|nice\s+to\s+have|nice\s+to\s+haves|bonus\s+points|bonus\s+qualifications|what\s+will\s+make\s+you\s+stand\s+out|desired\s+skills|desired\s+qualifications|optional\s+skills|bonus\s+skills|good\s+to\s+have|pluses)\b/i,
  },
  {
    type: "REQUIRED",
    pattern: /^(?:required\s+qualifications|basic\s+qualifications|minimum\s+qualifications|must\s+haves|must\s+have|what\s+we(?:'re|\s+are)\s+looking\s+for|what\s+you\s+need|requirements|core\s+requirements|key\s+qualifications|mandatory\s+skills|required\s+skills|role\s+requirements)\b/i,
  },
  {
    type: "EDUCATION",
    pattern: /^(?:educational\s+requirements|education\s*(?:&|and)\s*qualifications|academic\s+requirements|education|academic\s+background)\b/i,
  },
  {
    type: "EXPERIENCE",
    pattern: /^(?:experience\s+requirements|relevant\s+experience|work\s+experience|experience\s+needed|prior\s+experience)\b/i,
  },
  {
    type: "RESPONSIBILITIES",
    pattern: /^(?:key\s+responsibilities|responsibilities|what\s+you(?:'ll|\s+will)\s+do|duties|your\s+role|about\s+the\s+role|role\s+overview|job\s+summary|the\s+role)\b/i,
  },
  {
    type: "CERTIFICATIONS",
    pattern: /^(?:certifications|licenses\s*(?:&|and)\s*certifications|certifications\s*(?:&|and)\s*licenses|required\s+certifications|preferred\s+certifications)\b/i,
  },
];

// Contextual cues for required vs preferred
const REQUIRED_CUES = [
  /\bmust\s+have\b/i,
  /\bmust\s+possess\b/i,
  /\bmust\s+be\b/i,
  /\brequired\b/i,
  /\brequirement\b/i,
  /\bessential\b/i,
  /\bmandatory\b/i,
  /\bnecessary\b/i,
  /\bproven\s+experience\b/i,
  /\bstrong\s+proficiency\b/i,
  /\bstrong\s+knowledge\b/i,
  /\bdeep\s+understanding\b/i,
  /\bminimum\s+of\b/i,
  /\bat\s+least\b/i,
];

const PREFERRED_CUES = [
  /\bpreferred\b/i,
  /\bnice\s+to\s+have\b/i,
  /\bbonus\b/i,
  /\bbonus\s+points\b/i,
  /\ban\s+advantage\b/i,
  /\ba\s+plus\b/i,
  /\bwould\s+be\s+a\s+plus\b/i,
  /\bfamiliarity\s+with\b/i,
  /\bexposure\s+to\b/i,
  /\bdesirable\b/i,
  /\bdesired\b/i,
  /\boptional\b/i,
  /\bideally\b/i,
];

// Negation patterns: lines that state something is NOT required
const NEGATION_PATTERNS = [
  /\bnot\s+required\b/i,
  /\bno\s+(?:degree|certification|experience)\s+(?:is\s+)?required\b/i,
  /\bwithout\s+(?:need\s+for|a\s+degree)\b/i,
  /\bnot\s+mandatory\b/i,
  /\bneither\s+required\b/i,
  /\boptional\b/i,
];

// -----------------------------------------------------------------------------
// 2. TOOLS, TECHNOLOGIES, AND SOFT SKILLS CATALOGUE
// -----------------------------------------------------------------------------
const TOOL_DEFINITIONS = [
  { name: "Git", category: "TOOL", aliases: ["git", "version control"] },
  { name: "GitHub", category: "TOOL", aliases: ["github"] },
  { name: "GitLab", category: "TOOL", aliases: ["gitlab"] },
  { name: "Bitbucket", category: "TOOL", aliases: ["bitbucket"] },
  { name: "Docker", category: "TOOL", aliases: ["docker", "docker compose", "containerization"] },
  { name: "Kubernetes", category: "TOOL", aliases: ["kubernetes", "k8s"] },
  { name: "Jira", category: "TOOL", aliases: ["jira"] },
  { name: "Confluence", category: "TOOL", aliases: ["confluence"] },
  { name: "Trello", category: "TOOL", aliases: ["trello"] },
  { name: "Postman", category: "TOOL", aliases: ["postman"] },
  { name: "VS Code", category: "TOOL", aliases: ["vs code", "vscode", "visual studio code"] },
  { name: "Visual Studio", category: "TOOL", aliases: ["visual studio"] },
  { name: "IntelliJ IDEA", category: "TOOL", aliases: ["intellij", "intellij idea"] },
  { name: "CI/CD", category: "TOOL", aliases: ["ci/cd", "ci / cd", "continuous integration", "github actions", "gitlab ci", "jenkins", "circleci", "travis ci", "argo cd"] },
  { name: "Jenkins", category: "TOOL", aliases: ["jenkins"] },
  { name: "Terraform", category: "TOOL", aliases: ["terraform"] },
  { name: "Ansible", category: "TOOL", aliases: ["ansible"] },
  { name: "Webpack", category: "TOOL", aliases: ["webpack"] },
  { name: "Vite", category: "TOOL", aliases: ["vite", "vitejs"] },
  { name: "Figma", category: "TOOL", aliases: ["figma"] },
  { name: "npm / yarn / pnpm", category: "TOOL", aliases: ["npm", "yarn", "pnpm"] },
  { name: "Swagger / OpenAPI", category: "TOOL", aliases: ["swagger", "openapi"] },
  { name: "Datadog", category: "TOOL", aliases: ["datadog"] },
  { name: "Grafana", category: "TOOL", aliases: ["grafana"] },
  { name: "Prometheus", category: "TOOL", aliases: ["prometheus"] },
];

const SOFT_SKILLS_CATALOGUE = [
  { name: "Problem Solving", aliases: ["problem solving", "problem-solving", "analytical skills", "troubleshooting", "analytical thinking"] },
  { name: "Communication Skills", aliases: ["communication skills", "communication", "verbal communication", "written communication"] },
  { name: "Teamwork & Collaboration", aliases: ["teamwork", "collaboration", "cross-functional collaboration", "team player", "collaborative"] },
  { name: "Leadership", aliases: ["leadership", "team leadership", "mentorship", "mentoring", "coaching"] },
  { name: "Time Management", aliases: ["time management", "prioritization", "organizational skills"] },
  { name: "Adaptability", aliases: ["adaptability", "flexibility", "fast learner", "quick learner"] },
  { name: "Critical Thinking", aliases: ["critical thinking", "decision making"] },
  { name: "Agile / Scrum", aliases: ["agile", "scrum", "kanban", "sprint planning", "scrum methodology"] },
];

// Recognized Certifications
const CERTIFICATION_CATALOGUE = [
  {
    name: "AWS Certified Solutions Architect",
    issuer: "Amazon Web Services",
    aliases: [
      "aws certified solutions architect",
      "aws certified solutions architect - associate",
      "aws certified solutions architect - professional",
      "aws solutions architect",
    ],
  },
  {
    name: "AWS Certified Developer",
    issuer: "Amazon Web Services",
    aliases: ["aws certified developer", "aws certified developer - associate"],
  },
  {
    name: "AWS Certified SysOps Administrator",
    issuer: "Amazon Web Services",
    aliases: ["aws certified sysops", "aws sysops administrator"],
  },
  {
    name: "AWS Certified DevOps Engineer",
    issuer: "Amazon Web Services",
    aliases: ["aws certified devops engineer", "aws devops engineer professional"],
  },
  {
    name: "AWS Certified Cloud Practitioner",
    issuer: "Amazon Web Services",
    aliases: ["aws certified cloud practitioner", "aws cloud practitioner"],
  },
  {
    name: "Microsoft Certified: Azure Fundamentals",
    issuer: "Microsoft",
    aliases: ["azure fundamentals", "az-900"],
  },
  {
    name: "Microsoft Certified: Azure Solutions Architect",
    issuer: "Microsoft",
    aliases: ["azure solutions architect", "az-305"],
  },
  {
    name: "Google Cloud Certified Professional Cloud Architect",
    issuer: "Google Cloud",
    aliases: ["gcp professional cloud architect", "google cloud certified architect", "google cloud professional architect"],
  },
  {
    name: "Certified Information Systems Security Professional (CISSP)",
    issuer: "ISC2",
    aliases: ["cissp", "certified information systems security professional"],
  },
  {
    name: "Certified Information Security Manager (CISM)",
    issuer: "ISACA",
    aliases: ["cism", "certified information security manager"],
  },
  {
    name: "CompTIA Security+",
    issuer: "CompTIA",
    aliases: ["comptia security+", "security+"],
  },
  {
    name: "CompTIA Network+",
    issuer: "CompTIA",
    aliases: ["comptia network+", "network+"],
  },
  {
    name: "CompTIA A+",
    issuer: "CompTIA",
    aliases: ["comptia a+", "a+ certification"],
  },
  {
    name: "Project Management Professional (PMP)",
    issuer: "Project Management Institute (PMI)",
    aliases: ["pmp", "project management professional", "pmp certification"],
  },
  {
    name: "Certified Scrum Master (CSM)",
    issuer: "Scrum Alliance",
    aliases: ["csm", "certified scrum master", "certified scrummaster"],
  },
  {
    name: "Professional Scrum Master (PSM)",
    issuer: "Scrum.org",
    aliases: ["psm", "psm i", "psm ii", "professional scrum master"],
  },
  {
    name: "Certified Kubernetes Administrator (CKA)",
    issuer: "Linux Foundation / CNCF",
    aliases: ["cka", "certified kubernetes administrator"],
  },
  {
    name: "Certified Kubernetes Application Developer (CKAD)",
    issuer: "Linux Foundation / CNCF",
    aliases: ["ckad", "certified kubernetes application developer"],
  },
  {
    name: "Cisco Certified Network Associate (CCNA)",
    issuer: "Cisco",
    aliases: ["ccna", "cisco certified network associate"],
  },
  {
    name: "Cisco Certified Network Professional (CCNP)",
    issuer: "Cisco",
    aliases: ["ccnp", "cisco certified network professional"],
  },
];

// Degree levels and field patterns
const DEGREE_PATTERNS = [
  {
    level: "DOCTORATE",
    name: "Doctor of Philosophy (Ph.D.)",
    pattern: /\b(?:ph\.?d\.?|doctorate|doctor\s+of\s+philosophy)\b/i,
  },
  {
    level: "MASTER",
    name: "Master's Degree",
    pattern: /\b(?:master(?:'s)?\s+degree|m\.?s\.?c?|m\.?tech|m\.?a\.?|m\.?b\.?a\.?|master\s+of\s+science|master\s+of\s+engineering)\b/i,
  },
  {
    level: "BACHELOR",
    name: "Bachelor's Degree",
    pattern: /\b(?:bachelor(?:'s)?(?:\s+degree)?|b\.?s\.?c?|b\.?tech|b\.?e\.?|b\.?a\.?|bachelor\s+of\s+science|bachelor\s+of\s+engineering|undergraduate\s+degree)\b/i,
  },
  {
    level: "ASSOCIATE",
    name: "Associate Degree",
    pattern: /\b(?:associate(?:'s)?\s+degree|a\.?s\.?c?|a\.?a\.?)\b/i,
  },
  {
    level: "DIPLOMA",
    name: "Diploma / Certificate",
    pattern: /\b(?:diploma|higher\s+national\s+diploma|hnd)\b/i,
  },
];

const FIELDS_OF_STUDY = [
  { name: "Computer Science", pattern: /\bcomputer\s+science\b/i },
  { name: "Software Engineering", pattern: /\bsoftware\s+engineering\b/i },
  { name: "Information Technology", pattern: /\binformation\s+technology\b/i },
  { name: "Computer Engineering", pattern: /\bcomputer\s+engineering\b/i },
  { name: "Data Science", pattern: /\bdata\s+science\b/i },
  { name: "Information Systems", pattern: /\binformation\s+systems\b/i },
  { name: "Electrical Engineering", pattern: /\belectrical\s+engineering\b/i },
  { name: "Mathematics / Statistics", pattern: /\b(?:mathematics|statistics|math)\b/i },
];

// Seniority level patterns
const SENIORITY_PATTERNS = [
  { level: "Executive", pattern: /\b(?:cto|vp|vice\s+president|director|head\s+of)\b/i },
  { level: "Principal / Staff", pattern: /\b(?:principal|staff|distinguished|architect)\b/i },
  { level: "Lead", pattern: /\b(?:team\s+lead|tech\s+lead|lead|engineering\s+lead)\b/i },
  { level: "Senior", pattern: /\b(?:senior|sr\.?|lead\s+developer|experienced)\b/i },
  { level: "Mid-Level", pattern: /\b(?:mid-level|mid\s+level|intermediate)\b/i },
  { level: "Junior", pattern: /\b(?:junior|jr\.?|associate)\b/i },
  { level: "Entry-Level", pattern: /\b(?:entry\s+level|entry-level|graduate|intern|trainee)\b/i },
];

// -----------------------------------------------------------------------------
// 3. TEXT HELPER UTILITIES
// -----------------------------------------------------------------------------
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractSentenceSnippet(text, matchStr, maxLen = 140) {
  if (!text || !matchStr) return "";
  const lowerText = text.toLowerCase();
  const lowerMatch = matchStr.toLowerCase();
  const idx = lowerText.indexOf(lowerMatch);
  if (idx === -1) return matchStr;

  // Find line boundaries or period boundaries
  const startLine = text.lastIndexOf("\n", idx);
  const endLine = text.indexOf("\n", idx + matchStr.length);

  const start = startLine === -1 ? Math.max(0, idx - 40) : startLine + 1;
  const end = endLine === -1 ? Math.min(text.length, idx + matchStr.length + 60) : endLine;

  let snippet = text.slice(start, end).replace(/\s+/g, " ").trim();
  if (snippet.length > maxLen) {
    snippet = snippet.slice(0, maxLen - 3) + "...";
  }
  return snippet;
}

// -----------------------------------------------------------------------------
// 4. CORE EXTRACTION SERVICE CLASS
// -----------------------------------------------------------------------------
class JobRequirementExtractionService {
  /**
   * Initializes the canonical structured requirements model.
   *
   * @param {number|null} [jobId=null]
   * @param {string|null} [jobTitle=null]
   * @returns {Object}
   */
  static createStructuredModel(jobId = null, jobTitle = null) {
    return {
      jobDescriptionId: jobId ? Number(jobId) : null,
      jobTitle: jobTitle || null,
      requiredSkills: [],
      preferredSkills: [],
      experience: {
        minimumYears: null,
        maximumYears: null,
        level: null,
        details: [],
      },
      education: [],
      tools: [],
      technologies: [],
      certifications: [],
      extractionMetadata: {
        status: "COMPLETED",
        extractorVersion: "1.0",
        warnings: [],
      },
    };
  }

  /**
   * Segments raw job description text into sections and classified lines.
   *
   * @param {string} rawText
   * @returns {Array<{ text: string, sectionType: string, isLineRequired: boolean, isLinePreferred: boolean, isNegated: boolean }>}
   */
  static segmentLines(rawText) {
    if (!rawText) return [];
    // Normalize inline section markers that appear on period boundaries into separate lines
    const normalizedText = rawText.replace(
      /\.\s+(?=(?:Preferred|Requirements|Required|Qualifications|Nice to have|Education|Experience|Responsibilities|Certifications):?)/gi,
      "\n"
    );
    const lines = normalizedText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

    let currentSection = "GENERAL"; // GENERAL, REQUIRED, PREFERRED, EDUCATION, EXPERIENCE, RESPONSIBILITIES, CERTIFICATIONS
    const classifiedLines = [];

    for (const line of lines) {
      // Check if this line introduces a new section heading
      let matchedSection = null;
      let headingRemainder = null;
      for (const sec of SECTION_PATTERNS) {
        const match = line.match(sec.pattern);
        if (match) {
          matchedSection = sec.type;
          const afterHeading = line.slice(match[0].length).replace(/^[:\-\s]+/, "").trim();
          if (afterHeading.length > 0) {
            headingRemainder = afterHeading;
          }
          break;
        }
      }

      if (matchedSection) {
        currentSection = matchedSection;
        if (!headingRemainder) {
          continue;
        }
      }

      const lineText = headingRemainder || line;

      // Check negation
      const isNegated = NEGATION_PATTERNS.some((pat) => pat.test(lineText));

      // Check line-level cues
      const hasReqCue = REQUIRED_CUES.some((pat) => pat.test(lineText));
      const hasPrefCue = PREFERRED_CUES.some((pat) => pat.test(lineText));

      let isLineRequired = false;
      let isLinePreferred = false;

      if (isNegated) {
        isLineRequired = false;
        isLinePreferred = false;
      } else if (hasPrefCue) {
        isLinePreferred = true;
      } else if (hasReqCue) {
        isLineRequired = true;
      } else if (currentSection === "PREFERRED") {
        isLinePreferred = true;
      } else if (currentSection === "REQUIRED" || currentSection === "EXPERIENCE" || currentSection === "EDUCATION") {
        isLineRequired = true;
      }

      classifiedLines.push({
        text: lineText,
        sectionType: currentSection,
        isLineRequired,
        isLinePreferred,
        isNegated,
      });
    }

    return classifiedLines;
  }

  /**
   * Extracts experience requirements: min/max years, seniority level, and domain details.
   */
  static extractExperience(rawText, classifiedLines, jobTitle = null, warnings = []) {
    const experienceResult = {
      minimumYears: null,
      maximumYears: null,
      level: null,
      details: [],
    };

    if (!rawText) return experienceResult;

    // 1. Detect Seniority Level from Job Title first, then body text
    const titleToCheck = (jobTitle || "") + " " + rawText.slice(0, 500);
    for (const s of SENIORITY_PATTERNS) {
      if (s.pattern.test(titleToCheck)) {
        experienceResult.level = s.level;
        break;
      }
    }

    // 2. Extract Years of Experience
    // Regex for numeric years range: "3-5 years", "3 to 5 years", "3 - 5 years of experience", "3-5 years of professional software development experience"
    const rangeRegex = /\b(\d{1,2})\s*(?:-|to|\/)\s*(\d{1,2})\s*(?:\+)?\s*(?:years?|yrs?)(?:(?:\s+of|\s+in)?(?:\s+[\w-]+){0,4})?\s+experience\b/i;
    // Regex for single year with plus / min / at least: "5+ years", "at least 3 years", "minimum of 4 years", "3+ years of experience"
    const minRegex = /(?:(?:minimum|at\s+least|min\.?)\s+(?:of\s+)?)?(\d{1,2})\s*(?:\+)?\s*(?:years?|yrs?)(?:(?:\s+of|\s+in)?(?:\s+[\w-]+){0,4})?\s+experience\b/i;
    // Contextual: "X+ years experience" or "X years in software"
    const genericYearsRegex = /\b(\d{1,2})\s*\+\s*(?:years?|yrs?)\b/i;

    let foundRange = false;
    let foundMin = false;

    for (const cl of classifiedLines) {
      if (cl.isNegated) continue;

      const rangeMatch = cl.text.match(rangeRegex);
      if (rangeMatch) {
        const min = parseInt(rangeMatch[1], 10);
        const max = parseInt(rangeMatch[2], 10);
        if (min <= max && min < 40) {
          experienceResult.minimumYears = min;
          experienceResult.maximumYears = max;
          foundRange = true;
          experienceResult.details.push(cl.text);
          break;
        }
      }

      const minMatch = cl.text.match(minRegex);
      if (minMatch && !foundMin) {
        const min = parseInt(minMatch[1], 10);
        if (min < 40) {
          experienceResult.minimumYears = min;
          foundMin = true;
          experienceResult.details.push(cl.text);
        }
      }
    }

    // Fallback if not found in classified lines: check full text
    if (!foundRange && !foundMin) {
      const fullRangeMatch = rawText.match(rangeRegex);
      if (fullRangeMatch) {
        experienceResult.minimumYears = parseInt(fullRangeMatch[1], 10);
        experienceResult.maximumYears = parseInt(fullRangeMatch[2], 10);
        experienceResult.details.push(extractSentenceSnippet(rawText, fullRangeMatch[0]));
      } else {
        const fullMinMatch = rawText.match(minRegex) || rawText.match(genericYearsRegex);
        if (fullMinMatch) {
          experienceResult.minimumYears = parseInt(fullMinMatch[1], 10);
          experienceResult.details.push(extractSentenceSnippet(rawText, fullMinMatch[0]));
        }
      }
    }

    // 3. Extract Additional Domain / Industry Experience Lines
    const domainCues = [
      /\bexperience\s+(?:with|in|building|designing|deploying|managing)\b/i,
      /\bbackground\s+in\b/i,
      /\btrack\s+record\s+of\b/i,
      /\bdomain\s+experience\b/i,
    ];

    for (const cl of classifiedLines) {
      if (cl.sectionType === "EXPERIENCE" || cl.isLineRequired || cl.isLinePreferred) {
        if (domainCues.some((c) => c.test(cl.text)) && !experienceResult.details.includes(cl.text)) {
          if (experienceResult.details.length < 5) {
            experienceResult.details.push(cl.text);
          }
        }
      }
    }

    return experienceResult;
  }

  /**
   * Extracts education requirements: degree, field, equivalent acceptance, required vs preferred.
   */
  static extractEducation(rawText, classifiedLines, warnings = []) {
    const educationItems = [];
    if (!rawText) return educationItems;

    // Check if degree is negated across whole text
    const degreeNegated = /\b(?:no\s+degree\s+(?:required|needed)|degree\s+(?:is\s+)?not\s+required)\b/i.test(rawText);

    for (const cl of classifiedLines) {
      if (cl.isNegated || degreeNegated) continue;

      // Check if this line mentions any degree pattern
      for (const d of DEGREE_PATTERNS) {
        if (d.pattern.test(cl.text)) {
          // Check relevant field of study
          let matchedField = null;
          for (const f of FIELDS_OF_STUDY) {
            if (f.pattern.test(cl.text)) {
              matchedField = f.name;
              break;
            }
          }

          // Check for equivalent qualifications acceptance
          const equivalentAccepted = /\b(?:or\s+equivalent(?:\s+practical|\s+work)?\s+experience|equivalent\s+(?:degree|experience|qualification)|or\s+relevant\s+experience)\b/i.test(
            cl.text
          );

          // Required vs Preferred
          let isRequired = true;
          if (cl.isLinePreferred || /\b(?:preferred|nice\s+to\s+have|a\s+plus|desirable)\b/i.test(cl.text)) {
            isRequired = false;
          }

          // Deduplicate if already extracted same level and field
          const exists = educationItems.some(
            (e) => e.level === d.level && e.field === matchedField && e.required === isRequired
          );

          if (!exists) {
            educationItems.push({
              degree: d.name,
              level: d.level,
              field: matchedField,
              required: isRequired,
              equivalentAccepted,
              evidence: cl.text,
            });
          }
        }
      }
    }

    // Fallback: If no education extracted via lines, do a regex pass over full text
    if (educationItems.length === 0 && !degreeNegated) {
      for (const d of DEGREE_PATTERNS) {
        if (d.pattern.test(rawText)) {
          const snippet = extractSentenceSnippet(rawText, d.name);
          let matchedField = null;
          for (const f of FIELDS_OF_STUDY) {
            if (f.pattern.test(rawText)) {
              matchedField = f.name;
              break;
            }
          }
          const equivalentAccepted = /\b(?:or\s+equivalent|equivalent\s+experience)\b/i.test(rawText);
          const isPreferred = /\b(?:preferred|nice\s+to\s+have|a\s+plus)\b/i.test(snippet);

          educationItems.push({
            degree: d.name,
            level: d.level,
            field: matchedField,
            required: !isPreferred,
            equivalentAccepted,
            evidence: snippet,
          });
          break; // take first degree match
        }
      }
    }

    return educationItems;
  }

  /**
   * Extracts certifications with issuer and required/preferred status.
   */
  static extractCertifications(rawText, classifiedLines, warnings = []) {
    const certs = [];
    if (!rawText) return certs;

    // Check if certification is explicitly negated
    const certNegated = /\b(?:certifications?\s+(?:are\s+|is\s+)?not\s+required|no\s+certifications?\s+required)\b/i.test(rawText);
    if (certNegated) {
      return certs;
    }

    const detectedNames = new Set();

    for (const certDef of CERTIFICATION_CATALOGUE) {
      for (const alias of certDef.aliases) {
        const pattern = new RegExp(`\\b${escapeRegex(alias)}\\b`, "i");

        for (const cl of classifiedLines) {
          if (cl.isNegated) continue;

          if (pattern.test(cl.text)) {
            if (detectedNames.has(certDef.name)) continue;

            let isRequired = false;
            if (cl.isLineRequired && !cl.isLinePreferred) {
              isRequired = true;
            } else if (/\b(?:required|must\s+have|mandatory|essential)\b/i.test(cl.text)) {
              isRequired = true;
            }

            detectedNames.add(certDef.name);
            certs.push({
              name: certDef.name,
              issuer: certDef.issuer,
              required: isRequired,
              evidence: cl.text,
            });
            break;
          }
        }
      }
    }

    // Also look for generic explicit certification phrases (e.g. "PMP certified", "AWS Certified")
    const genericCertRegex = /\b([A-Z][A-Za-z0-9\s-]{2,30}\s+(?:Certification|Certified))\b/g;
    let match;
    while ((match = genericCertRegex.exec(rawText)) !== null) {
      const foundName = match[1].trim();
      const alreadyCovered = Array.from(detectedNames).some(
        (dn) =>
          dn.toLowerCase().includes(foundName.toLowerCase()) ||
          foundName.toLowerCase().includes(dn.toLowerCase())
      );
      // Skip if already in detected names, covered by recognized catalogue entry, or degrees
      if (!alreadyCovered && !DEGREE_PATTERNS.some((d) => d.pattern.test(foundName))) {
        const snippet = extractSentenceSnippet(rawText, foundName);
        const isNeg = NEGATION_PATTERNS.some((n) => n.test(snippet));
        if (!isNeg) {
          const isReq = REQUIRED_CUES.some((r) => r.test(snippet)) && !PREFERRED_CUES.some((p) => p.test(snippet));
          detectedNames.add(foundName);
          certs.push({
            name: foundName,
            issuer: null,
            required: isReq,
            evidence: snippet,
          });
        }
      }
    }

    return certs;
  }

  /**
   * Matches an alias against a text string using boundary-aware regex.
   */
  static matchAliasInText(alias, text) {
    if (!text || !alias) return false;
    let pattern;
    if (alias === "c++") {
      pattern = /(?:^|[\s,;:(/])c\+\+(?:$|[\s,;:)/])/i;
    } else if (alias === "c#") {
      pattern = /(?:^|[\s,;:(/])c#(?:$|[\s,;:)/])/i;
    } else if (alias === "c" || alias === "r") {
      pattern = new RegExp(`(?:^|[\\s,;:(/])${escapeRegex(alias)}(?:$|[\\s,;:)/])`, "i");
    } else if (alias === "go") {
      pattern = /\b(?:golang|go\s+lang)\b/i;
    } else {
      pattern = new RegExp(`\\b${escapeRegex(alias)}\\b`, "i");
    }
    return pattern.test(text);
  }

  /**
   * Extracts Tools, Technologies, and Skills with boundary precision and classification.
   */
  static extractToolsAndTechnologies(rawText, classifiedLines, warnings = []) {
    const toolsMap = new Map();
    const techMap = new Map();
    const skillsMap = new Map();

    // 1. Process Tools from TOOL_DEFINITIONS
    for (const toolDef of TOOL_DEFINITIONS) {
      for (const alias of toolDef.aliases) {
        for (const cl of classifiedLines) {
          if (cl.isNegated) continue;

          if (this.matchAliasInText(alias, cl.text)) {
            const isPreferred = cl.isLinePreferred || (!cl.isLineRequired && cl.sectionType === "PREFERRED");
            const isRequired = !isPreferred && (cl.isLineRequired || cl.sectionType === "REQUIRED");

            const existing = toolsMap.get(toolDef.name);
            if (existing) {
              // If previously marked preferred but now found in required, upgrade to required
              if (!existing.required && isRequired) {
                existing.required = true;
                existing.priority = "HIGH";
                existing.evidence = cl.text;
              }
            } else {
              toolsMap.set(toolDef.name, {
                name: toolDef.name,
                category: toolDef.category,
                required: isRequired,
                priority: isRequired ? "HIGH" : "MEDIUM",
                evidence: cl.text,
              });
            }
            break;
          }
        }
      }
    }

    // 2. Process Technologies from SKILL_CATALOGUE
    // Categories PROGRAMMING, FRAMEWORK, DATABASE, CLOUD are treated as Technologies
    const techCategories = new Set(["PROGRAMMING", "FRAMEWORK", "DATABASE", "CLOUD", "OTHER"]);

    for (const item of SKILL_CATALOGUE) {
      // If it's already classified as a Tool, don't duplicate into technologies
      if (toolsMap.has(item.name) && item.category === "TOOL") continue;

      for (const alias of item.aliases) {
        for (const cl of classifiedLines) {
          if (cl.isNegated) continue;

          if (this.matchAliasInText(alias, cl.text)) {
            const isPreferred = cl.isLinePreferred || (!cl.isLineRequired && cl.sectionType === "PREFERRED");
            const isRequired = !isPreferred && (cl.isLineRequired || cl.sectionType === "REQUIRED");

            if (techCategories.has(item.category)) {
              const existingTech = techMap.get(item.name);
              if (existingTech) {
                if (!existingTech.required && isRequired) {
                  existingTech.required = true;
                  existingTech.priority = "HIGH";
                  existingTech.evidence = cl.text;
                }
              } else {
                techMap.set(item.name, {
                  name: item.name,
                  category: item.category,
                  required: isRequired,
                  priority: isRequired ? "HIGH" : "MEDIUM",
                  evidence: cl.text,
                });
              }
            } else {
              // Soft skill or design skill
              const existingSkill = skillsMap.get(item.name);
              if (existingSkill) {
                if (!existingSkill.required && isRequired) {
                  existingSkill.required = true;
                  existingSkill.priority = "HIGH";
                  existingSkill.evidence = cl.text;
                }
              } else {
                skillsMap.set(item.name, {
                  name: item.name,
                  category: item.category,
                  required: isRequired,
                  priority: isRequired ? "HIGH" : "MEDIUM",
                  evidence: cl.text,
                });
              }
            }
            break;
          }
        }
      }
    }

    // 3. Process Soft Skills catalogue
    for (const ss of SOFT_SKILLS_CATALOGUE) {
      for (const alias of ss.aliases) {
        for (const cl of classifiedLines) {
          if (cl.isNegated) continue;

          if (this.matchAliasInText(alias, cl.text)) {
            const isPreferred = cl.isLinePreferred || (!cl.isLineRequired && cl.sectionType === "PREFERRED");
            const isRequired = !isPreferred && (cl.isLineRequired || cl.sectionType === "REQUIRED");

            const existing = skillsMap.get(ss.name);
            if (existing) {
              if (!existing.required && isRequired) {
                existing.required = true;
                existing.priority = "HIGH";
                existing.evidence = cl.text;
              }
            } else {
              skillsMap.set(ss.name, {
                name: ss.name,
                category: "SOFT_SKILL",
                required: isRequired,
                priority: isRequired ? "HIGH" : "MEDIUM",
                evidence: cl.text,
              });
            }
            break;
          }
        }
      }
    }

    return {
      tools: Array.from(toolsMap.values()),
      technologies: Array.from(techMap.values()),
      skills: Array.from(skillsMap.values()),
    };
  }

  /**
   * Main requirement extraction engine.
   * Accepts job description text and returns the canonical structured requirements model.
   *
   * @param {string} rawText
   * @param {number|null} [jobId=null]
   * @param {string|null} [jobTitle=null]
   * @returns {Object} Structured Requirements Model
   */
  static extractRequirements(rawText, jobId = null, jobTitle = null) {
    const result = this.createStructuredModel(jobId, jobTitle);

    if (!rawText || !rawText.trim()) {
      result.extractionMetadata.status = "EMPTY";
      result.extractionMetadata.warnings.push("Job description text is empty or missing.");
      return result;
    }

    const warnings = [];

    if (rawText.trim().length < 80) {
      warnings.push("Job description is very short; some requirement categories may be incomplete.");
    }

    // 1. Line segmentation & classification
    const classifiedLines = this.segmentLines(rawText);

    // 2. Experience Extraction
    result.experience = this.extractExperience(rawText, classifiedLines, jobTitle, warnings);

    // 3. Education Extraction
    result.education = this.extractEducation(rawText, classifiedLines, warnings);

    // 4. Certifications Extraction
    result.certifications = this.extractCertifications(rawText, classifiedLines, warnings);

    // 5. Tools & Technologies & Skills Extraction
    const { tools, technologies, skills } = this.extractToolsAndTechnologies(
      rawText,
      classifiedLines,
      warnings
    );

    result.tools = tools;
    result.technologies = technologies;

    // 6. Build Required Skills and Preferred Skills partitions
    // All technologies, tools, and general skills are partitioned according to their required status
    const allExtractedItems = [...technologies, ...tools, ...skills];

    const requiredSkillsMap = new Map();
    const preferredSkillsMap = new Map();

    for (const item of allExtractedItems) {
      const summaryItem = {
        name: item.name,
        category: item.category,
        priority: item.priority || (item.required ? "HIGH" : "MEDIUM"),
        required: item.required,
        evidence: item.evidence || `Extracted as ${item.name}`,
      };

      if (item.required) {
        requiredSkillsMap.set(item.name, summaryItem);
      } else {
        // If an item is already required, it stays required (required takes precedence)
        if (!requiredSkillsMap.has(item.name)) {
          preferredSkillsMap.set(item.name, summaryItem);
        }
      }
    }

    // Check for conflict warnings
    for (const [name, reqItem] of requiredSkillsMap.entries()) {
      if (preferredSkillsMap.has(name)) {
        preferredSkillsMap.delete(name);
        warnings.push(`Skill '${name}' appeared in both required and preferred contexts; classified as Required.`);
      }
    }

    result.requiredSkills = Array.from(requiredSkillsMap.values());
    result.preferredSkills = Array.from(preferredSkillsMap.values());

    // 7. Quality & coverage checks
    if (result.requiredSkills.length === 0 && result.preferredSkills.length === 0) {
      warnings.push("No explicit technical skills or tools were recognized in the text.");
    }
    if (result.experience.minimumYears === null) {
      warnings.push("No explicit minimum years of experience specified.");
    }
    if (result.education.length === 0) {
      warnings.push("No explicit degree or formal education requirements specified.");
    }

    result.extractionMetadata.warnings = warnings;
    result.extractionMetadata.status = warnings.length > 0 ? "WARNING" : "COMPLETED";

    return result;
  }

  /**
   * Persists extracted structured requirements to MySQL in an atomic transaction.
   * Deletes previously saved requirements for this job to ensure safe idempotency.
   *
   * @param {number} jobId
   * @param {Object} structuredRequirements
   * @returns {Promise<boolean>}
   */
  static async persistRequirements(jobId, structuredRequirements) {
    if (!jobId || !structuredRequirements) {
      throw new Error("Job ID and structured requirements are required for persistence.");
    }

    const connection = await db.getConnection();

    try {
      await connection.beginTransaction();

      // 1. Remove previous records for this job (idempotent re-run)
      await connection.query(`DELETE FROM job_requirements WHERE job_id = ?`, [jobId]);
      await connection.query(`DELETE FROM job_skills WHERE job_id = ?`, [jobId]);

      // 2. Insert into job_requirements table
      const requirementsToInsert = [];

      // Required Skills
      for (const skill of structuredRequirements.requiredSkills || []) {
        requirementsToInsert.push([
          jobId,
          "SKILL",
          `${skill.name} (Required)`,
          skill.priority || "HIGH",
        ]);
      }

      // Preferred Skills
      for (const skill of structuredRequirements.preferredSkills || []) {
        requirementsToInsert.push([
          jobId,
          "SKILL",
          `${skill.name} (Preferred)`,
          skill.priority || "MEDIUM",
        ]);
      }

      // Tools
      for (const tool of structuredRequirements.tools || []) {
        requirementsToInsert.push([
          jobId,
          "TOOL",
          `${tool.name} (${tool.required ? "Required" : "Preferred"})`,
          tool.required ? "HIGH" : "MEDIUM",
        ]);
      }

      // Technologies
      for (const tech of structuredRequirements.technologies || []) {
        requirementsToInsert.push([
          jobId,
          "TECHNOLOGY",
          `${tech.name} (${tech.required ? "Required" : "Preferred"})`,
          tech.required ? "HIGH" : "MEDIUM",
        ]);
      }

      // Experience
      if (structuredRequirements.experience) {
        const exp = structuredRequirements.experience;
        let expText = "";
        if (exp.minimumYears !== null && exp.maximumYears !== null) {
          expText = `Experience: ${exp.minimumYears}-${exp.maximumYears} years`;
        } else if (exp.minimumYears !== null) {
          expText = `Experience: ${exp.minimumYears}+ years`;
        }
        if (exp.level) {
          expText += (expText ? ", Level: " : "Level: ") + exp.level;
        }
        if (expText) {
          requirementsToInsert.push([jobId, "EXPERIENCE", expText, "HIGH"]);
        }

        for (const detail of exp.details || []) {
          requirementsToInsert.push([jobId, "EXPERIENCE", detail, "MEDIUM"]);
        }
      }

      // Education
      for (const edu of structuredRequirements.education || []) {
        const eduDesc = `${edu.degree}${edu.field ? " in " + edu.field : ""}${
          edu.equivalentAccepted ? " (or equivalent experience)" : ""
        }`;
        requirementsToInsert.push([
          jobId,
          "EDUCATION",
          eduDesc,
          edu.required ? "HIGH" : "MEDIUM",
        ]);
      }

      // Certifications
      for (const cert of structuredRequirements.certifications || []) {
        const certDesc = `${cert.name}${cert.issuer ? " (" + cert.issuer + ")" : ""}`;
        requirementsToInsert.push([
          jobId,
          "CERTIFICATION",
          certDesc,
          cert.required ? "HIGH" : "MEDIUM",
        ]);
      }

      // Structured Data JSON Record (preserves the complete high-fidelity JSON object)
      requirementsToInsert.push([
        jobId,
        "STRUCTURED_DATA",
        JSON.stringify(structuredRequirements),
        "HIGH",
      ]);

      if (requirementsToInsert.length > 0) {
        await connection.query(
          `INSERT INTO job_requirements (job_id, requirement_type, requirement_text, priority) VALUES ?`,
          [requirementsToInsert]
        );
      }

      // 3. Upsert into skills and insert into job_skills
      const allSkills = [
        ...(structuredRequirements.requiredSkills || []),
        ...(structuredRequirements.preferredSkills || []),
      ];

      for (const s of allSkills) {
        // Upsert into master skills table
        await connection.query(
          `INSERT INTO skills (name, category)
           VALUES (?, ?)
           ON DUPLICATE KEY UPDATE category = VALUES(category)`,
          [s.name, s.category || "OTHER"]
        );

        // Fetch skill ID
        const [skillRow] = await connection.query(
          `SELECT id FROM skills WHERE name = ? LIMIT 1`,
          [s.name]
        );

        if (skillRow && skillRow.length > 0) {
          const skillId = skillRow[0].id;
          await connection.query(
            `INSERT INTO job_skills (job_id, skill_id, priority, required, evidence)
             VALUES (?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE priority = VALUES(priority), required = VALUES(required), evidence = VALUES(evidence)`,
            [
              jobId,
              skillId,
              s.priority || (s.required ? "HIGH" : "MEDIUM"),
              s.required ? 1 : 0,
              s.evidence || null,
            ]
          );
        }
      }

      await connection.commit();
      return true;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Retrieves saved extracted requirements for a job description.
   *
   * @param {number} jobId
   * @returns {Promise<Object|null>}
   */
  static async getSavedRequirements(jobId) {
    if (!jobId) return null;

    // Check for stored STRUCTURED_DATA
    const [rows] = await db.query(
      `SELECT requirement_text FROM job_requirements
       WHERE job_id = ? AND requirement_type = 'STRUCTURED_DATA'
       LIMIT 1`,
      [jobId]
    );

    if (rows && rows.length > 0 && rows[0].requirement_text) {
      try {
        return JSON.parse(rows[0].requirement_text);
      } catch (err) {
        console.warn("[JobRequirementExtraction] Error parsing stored structured data:", err.message);
      }
    }

    // Fallback: check if standard job_requirements exist
    const [allReqs] = await db.query(
      `SELECT requirement_type, requirement_text, priority FROM job_requirements
       WHERE job_id = ? AND requirement_type != 'STRUCTURED_DATA'`,
      [jobId]
    );

    if (!allReqs || allReqs.length === 0) {
      return null;
    }

    // Reconstruct basic model from rows
    const reconstructed = this.createStructuredModel(jobId);
    for (const req of allReqs) {
      if (req.requirement_type === "SKILL") {
        const isReq = req.priority === "HIGH";
        const item = {
          name: req.requirement_text.replace(/\s*\((?:Required|Preferred)\)/i, ""),
          category: "OTHER",
          priority: req.priority,
          required: isReq,
          evidence: req.requirement_text,
        };
        if (isReq) reconstructed.requiredSkills.push(item);
        else reconstructed.preferredSkills.push(item);
      }
    }

    return reconstructed;
  }

  /**
   * Complete workflow: fetches job by ID (verifying ownership), extracts requirements,
   * persists to database, and returns structured result.
   *
   * @param {number} jobId
   * @param {number} userId
   * @returns {Promise<{ success: boolean, requirements: Object }>}
   */
  static async processJobRequirements(jobId, userId) {
    if (!jobId || !userId) {
      const err = new Error("Job ID and User ID are required.");
      err.status = 400;
      throw err;
    }

    // Fetch job description and verify ownership
    const [jobs] = await db.query(
      `SELECT id, user_id, title, company, description FROM jobs WHERE id = ? AND user_id = ? LIMIT 1`,
      [jobId, userId]
    );

    if (!jobs || jobs.length === 0) {
      const err = new Error("Job description not found or access denied.");
      err.status = 404;
      throw err;
    }

    const job = jobs[0];

    // Extract requirements using deterministic explainable rules
    const structured = this.extractRequirements(job.description, job.id, job.title);

    // Persist requirements
    await this.persistRequirements(job.id, structured);

    return {
      success: true,
      jobId: job.id,
      jobTitle: job.title,
      requirements: structured,
    };
  }
}

module.exports = JobRequirementExtractionService;
