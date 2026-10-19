const { extractSkills } = require("../utils/skillCatalogue");

/**
 * Standard section heading detection patterns across industry resume formats.
 */
const SECTION_PATTERNS = [
  {
    type: "SUMMARY",
    pattern: /^(?:professional\s+summary|summary|profile|about\s+me|career\s+objective|objective|executive\s+summary|personal\s+profile|personal\s+statement|professional\s+profile|bio)\b/i,
  },
  {
    type: "EXPERIENCE",
    pattern: /^(?:work\s*(?:&|and)\s*professional\s+experience|professional\s+experience|work\s+experience|experience|employment\s+history|work\s+history|career\s+history|relevant\s+experience|employment|professional\s+background)\b/i,
  },
  {
    type: "EDUCATION",
    pattern: /^(?:education\s*(?:&|and)\s*qualifications|academic\s+background|academic\s+qualifications|educational\s+background|qualifications|academic\s+history|education)\b/i,
  },
  {
    type: "SKILLS",
    pattern: /^(?:technical\s+competencies|core\s+competencies|technical\s+skills|skills\s*(?:&|and)\s*technologies|tools\s*(?:&|and)\s*technologies|skills|technologies|proficiencies|key\s+skills|competencies|areas\s+of\s+expertise)\b/i,
  },
  {
    type: "PROJECTS",
    pattern: /^(?:projects|personal\s+projects|key\s+projects|academic\s+projects|featured\s+projects|technical\s+projects|selected\s+projects)\b/i,
  },
  {
    type: "CERTIFICATIONS",
    pattern: /^(?:professional\s+certifications|professional\s+certificates|certifications|certificates|licenses\s*(?:&|and)\s*certifications|credentials|licenses)\b/i,
  },
  {
    type: "LANGUAGES",
    pattern: /^(?:languages|language\s+proficiency)\b/i,
  },
];

/**
 * Builds the canonical Day 12 structured resume data model initialized with defaults.
 *
 * @param {number|null} [resumeId=null]
 * @returns {Object}
 */
function createStructuredResumeModel(resumeId = null) {
  return {
    resumeId: resumeId || null,
    personalInformation: {
      fullName: null,
      email: null,
      phone: null,
      location: null,
      linkedinUrl: null,
      githubUrl: null,
      portfolioUrl: null,
    },
    summary: null,
    skills: [],
    education: [],
    experience: [],
    projects: [],
    certifications: [],
    parsingMetadata: {
      status: "PENDING",
      parserVersion: "1.0",
      warnings: [],
    },
  };
}

/**
 * Normalizes text lines, segments into sections, extracts each section into
 * the structured resume data model, and executes validation.
 *
 * @param {string} rawText
 * @param {number|null} [resumeId=null]
 * @returns {Object} Canonical structured resume object
 */
function parseResume(rawText, resumeId = null) {
  const result = createStructuredResumeModel(resumeId);

  if (!rawText || !rawText.trim()) {
    result.parsingMetadata.status = "EMPTY";
    result.parsingMetadata.warnings.push("Document text is empty or corrupted.");
    return result;
  }

  const warnings = [];
  const lines = rawText.split("\n").map((l) => l.trim());

  // 1. Segment text into section blocks
  const sectionsMap = segmentSections(lines);

  // 2. Personal Information
  result.personalInformation = parsePersonalInformation(lines, sectionsMap.get("CONTACT") || "", warnings);

  // 3. Summary
  result.summary = parseSummary(sectionsMap.get("SUMMARY") || null);

  // 4. Skills
  result.skills = parseSkills(rawText, sectionsMap.get("SKILLS") || "", warnings);

  // 5. Education
  result.education = parseEducation(sectionsMap.get("EDUCATION") || "", warnings);

  // 6. Experience
  result.experience = parseExperience(sectionsMap.get("EXPERIENCE") || "", warnings);

  // 7. Projects
  result.projects = parseProjects(sectionsMap.get("PROJECTS") || "", warnings);

  // 8. Certifications
  result.certifications = parseCertifications(sectionsMap.get("CERTIFICATIONS") || "", warnings);

  // Check section coverage
  if (!result.summary) warnings.push("No summary or objective section identified.");
  if (result.skills.length === 0) warnings.push("No technical or professional skills recognized.");
  if (result.experience.length === 0) warnings.push("No work experience entries identified.");
  if (result.education.length === 0) warnings.push("No education entries identified.");

  // Validate structured model
  const validation = validateStructuredResume(result);
  warnings.push(...validation.warnings);

  result.parsingMetadata.warnings = Array.from(new Set(warnings));
  result.parsingMetadata.status = "SUCCESS";

  return result;
}

/**
 * Splits document lines into identified sections using boundary analysis.
 *
 * @param {string[]} lines
 * @returns {Map<string, string>}
 */
function segmentSections(lines) {
  const sectionsMap = new Map();
  let currentSection = "CONTACT"; // Top of document is typically candidate header
  let currentLines = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;

    // Detect if line looks like a major section heading
    // Ignore lines that begin with bullet symbols or contain items followed by a colon with content
    const isBullet = /^[•\-*▪●⁃◦‣\u2022\u2023\u25E6\u2043\u2219\u25CF\u25AA\u25AB]/.test(line);
    const hasColonContent = line.includes(":") && line.split(":")[1].trim().length > 0;
    const isShort = line.length <= 50;
    // Strip bullet chars, markdown headers, and numbering like "1. ", "II. "
    const cleanHeading = line
      .replace(/^[•\-*▪●⁃◦‣\u2022\u2023\u25E6\u2043\u2219\u25CF\u25AA\u25AB\s]+/, "")
      .replace(/^(?:[0-9]+|[IVXLCDM]+)[\.\)\-\:\s]+/i, "")
      .replace(/[:\-#*]/g, "")
      .trim();

    let matchedType = null;
    if (!isBullet && !hasColonContent && isShort && cleanHeading.length >= 3) {
      for (const def of SECTION_PATTERNS) {
        if (def.pattern.test(cleanHeading)) {
          matchedType = def.type;
          break;
        }
      }
    }

    if (matchedType) {
      if (currentLines.length > 0) {
        const prevContent = sectionsMap.get(currentSection) || "";
        sectionsMap.set(
          currentSection,
          (prevContent ? prevContent + "\n" : "") + currentLines.join("\n")
        );
      }
      currentSection = matchedType;
      currentLines = [];
    } else {
      currentLines.push(line);
    }
  }

  if (currentLines.length > 0) {
    const prevContent = sectionsMap.get(currentSection) || "";
    sectionsMap.set(
      currentSection,
      (prevContent ? prevContent + "\n" : "") + currentLines.join("\n")
    );
  }

  return sectionsMap;
}

/**
 * Validates a URL string safely.
 *
 * @param {string} urlStr
 * @returns {boolean}
 */
function isValidUrl(urlStr) {
  if (!urlStr || typeof urlStr !== "string") return false;
  try {
    const parsed = new URL(urlStr);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Extracts and normalizes Personal Information from the header lines and document text.
 *
 * @param {string[]} allLines
 * @param {string} headerContent
 * @param {string[]} warnings
 * @returns {Object}
 */
function parsePersonalInformation(allLines, headerContent, warnings = []) {
  const fullDocument = allLines.join("\n");

  // 1. Email Address (RFC 5322 compatible conservative regex)
  let email = null;
  const emailMatch = fullDocument.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  if (emailMatch) {
    email = emailMatch[0].trim().toLowerCase();
  } else {
    warnings.push("Candidate email address not detected.");
  }

  // 2. Phone Number
  let phone = null;
  const phoneMatch = fullDocument.match(
    /(?:(?:\+?1\s*(?:[.-]\s*)?)?(?:\(\s*([2-9]1[02-9]|[2-9][02-8]1|[2-9][02-8][02-9])\s*\)|([2-9]1[02-9]|[2-9][02-8]1|[2-9][02-8][02-9]))\s*(?:[.-]\s*)?)?([2-9]1[02-9]|[2-9][02-9]1|[2-9][02-9]{2})\s*(?:[.-]\s*)?([0-9]{4})(?:\s*(?:#|x\.?|ext\.?|extension)\s*(\d+))?/i
  ) || fullDocument.match(/\+?\d{1,4}?[-.\s]?\(?\d{2,4}?\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4}/);

  if (phoneMatch) {
    const cleanPhone = phoneMatch[0].trim();
    const digitCount = (cleanPhone.match(/\d/g) || []).length;
    if (digitCount >= 7 && digitCount <= 15) {
      phone = cleanPhone;
    }
  }

  // 3. LinkedIn URL
  let linkedinUrl = null;
  const linkedinMatch = fullDocument.match(/https?:\/\/(?:www\.)?linkedin\.com\/in\/[a-zA-Z0-9_.-]+/i) ||
    fullDocument.match(/linkedin\.com\/in\/[a-zA-Z0-9_.-]+/i);
  if (linkedinMatch) {
    const rawLink = linkedinMatch[0].startsWith("http") ? linkedinMatch[0] : `https://${linkedinMatch[0]}`;
    if (isValidUrl(rawLink)) {
      linkedinUrl = rawLink;
    }
  }

  // 4. GitHub URL
  let githubUrl = null;
  const githubMatch = fullDocument.match(/https?:\/\/(?:www\.)?github\.com\/[a-zA-Z0-9_.-]+/i) ||
    fullDocument.match(/github\.com\/[a-zA-Z0-9_.-]+/i);
  if (githubMatch) {
    const lower = githubMatch[0].toLowerCase();
    if (!lower.includes("/features") && !lower.includes("/topics") && !lower.includes("/marketplace")) {
      const rawLink = githubMatch[0].startsWith("http") ? githubMatch[0] : `https://${githubMatch[0]}`;
      if (isValidUrl(rawLink)) {
        githubUrl = rawLink;
      }
    }
  }

  // 5. Portfolio URL
  let portfolioUrl = null;
  const urlMatches = fullDocument.match(/https?:\/\/[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(?:\/[^\s)"]*)?/g) || [];
  for (const url of urlMatches) {
    const lower = url.toLowerCase();
    if (
      !lower.includes("linkedin.com") &&
      !lower.includes("github.com") &&
      !lower.includes("w3.org") &&
      !lower.includes("schema.org") &&
      !lower.includes("schemas.openxmlformats.org")
    ) {
      if (isValidUrl(url)) {
        portfolioUrl = url;
        break;
      }
    }
  }

  // 6. Full Name
  // Heuristic: Candidate name is at the top of the resume in the header/preamble, 2-4 words, alphabetic only,
  // excluding contact keywords, titles, institutions, and section headers.
  let fullName = null;
  let candidateLines = [];
  if (typeof headerContent === "string" && headerContent.trim()) {
    candidateLines = headerContent.split("\n");
  } else if (headerContent === null || headerContent === undefined) {
    // If headerContent not supplied, scan allLines stopping at the first section heading
    for (const l of allLines) {
      const cleanHeading = l
        .replace(/^[•\-*▪●⁃◦‣\u2022\u2023\u25E6\u2043\u2219\u25CF\u25AA\u25AB\s]+/, "")
        .replace(/^(?:[0-9]+|[IVXLCDM]+)[\.\)\-\:\s]+/i, "")
        .replace(/[:\-#*]/g, "")
        .trim();
      const isSec = SECTION_PATTERNS.some((def) => def.pattern.test(cleanHeading) || def.pattern.test(l.trim()));
      if (isSec) break;
      candidateLines.push(l);
    }
  }

  for (const line of candidateLines.slice(0, 8)) {
    const clean = line.replace(/[•|,\-]/g, " ").trim();
    if (!clean) continue;
    if (clean.includes("@") || clean.includes("http") || clean.includes("www.") || /\d/.test(clean)) continue;
    if (/^(?:resume|curriculum\s+vitae|cv|page\s+\d|portfolio|contact|profile)/i.test(clean)) continue;
    if (/^(?:software|senior|junior|lead|principal|staff|full\s+stack|frontend|backend|devops|data|cloud|mobile|web|cloud|qa|systems)\s+(?:engineer|developer|architect|specialist|analyst|consultant|manager|administrator)\b/i.test(clean)) continue;
    if (/^(?:software\s+engineer|developer|architect|consultant|analyst|specialist|manager|director)\b/i.test(clean)) continue;

    const cleanHeading = line
      .replace(/^[•\-*▪●⁃◦‣\u2022\u2023\u25E6\u2043\u2219\u25CF\u25AA\u25AB\s]+/, "")
      .replace(/^(?:[0-9]+|[IVXLCDM]+)[\.\)\-\:\s]+/i, "")
      .replace(/[:\-#*]/g, "")
      .trim();
    const isSectionHeading = SECTION_PATTERNS.some(
      (def) => def.pattern.test(cleanHeading) || def.pattern.test(clean) || def.pattern.test(line.trim())
    );
    if (isSectionHeading) continue;

    const words = clean.split(/\s+/).filter(Boolean);
    if (words.length >= 2 && words.length <= 4) {
      const isAlpha = words.every((w) => /^[a-zA-Z.'-]+$/.test(w));
      if (isAlpha) {
        fullName = words.join(" ");
        break;
      }
    }
  }

  if (!fullName) {
    warnings.push("Candidate name could not be reliably determined from the document header.");
  }

  // 7. Location (City, Country / State)
  let location = null;
  const locRegex = /^[A-Z][a-zA-Z\s.-]+,\s*(?:[A-Z]{2,}|[A-Z][a-zA-Z\s]+)$/;
  for (const line of allLines.slice(0, 10)) {
    if (line.includes("@") || line.includes("http") || line.toLowerCase().includes("phone") || line.toLowerCase().includes("email")) continue;
    const cleanLine = line.trim();
    if (locRegex.test(cleanLine) && cleanLine.length < 50) {
      location = cleanLine;
      break;
    }
  }

  return {
    fullName,
    email,
    phone,
    location,
    linkedinUrl,
    githubUrl,
    portfolioUrl,
  };
}

/**
 * Parses and normalizes the professional summary.
 *
 * @param {string|null} summaryText
 * @returns {string|null}
 */
function parseSummary(summaryText) {
  if (!summaryText || typeof summaryText !== "string") return null;

  // Clean excessive whitespace, normalize linebreaks
  const cleaned = summaryText
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  return cleaned.length > 0 ? cleaned : null;
}

/**
 * Structures identified skills into canonical skill objects.
 *
 * @param {string} fullText
 * @param {string} skillsSectionText
 * @param {string[]} warnings
 * @returns {Array<{ name: string, category: string, sourceSection: string }>}
 */
function parseSkills(fullText, skillsSectionText = "", warnings = []) {
  const extracted = extractSkills(fullText, skillsSectionText);

  const seen = new Set();
  const structuredSkills = [];

  for (const item of extracted) {
    const normalizedKey = item.name.toLowerCase().trim();
    if (!seen.has(normalizedKey)) {
      seen.add(normalizedKey);
      structuredSkills.push({
        name: item.name,
        category: item.category || "OTHER",
        sourceSection: skillsSectionText ? "Skills" : "FullText",
      });
    }
  }

  return structuredSkills;
}

/**
 * Normalizes common date strings (e.g., "2020 - 2024", "Jan 2021 to Present") into startDate and endDate.
 *
 * @param {string|null} dateRangeStr
 * @returns {{ startDate: string|null, endDate: string|null, isCurrent: boolean|null }}
 */
function normalizeDateRange(dateRangeStr) {
  if (!dateRangeStr || typeof dateRangeStr !== "string") {
    return { startDate: null, endDate: null, isCurrent: null };
  }

  const parts = dateRangeStr.split(/\s*(?:-|–|—|to)\s*/i);
  const startDate = parts[0]?.trim() || null;
  const rawEnd = parts[1]?.trim() || null;

  let endDate = rawEnd;
  let isCurrent = null;

  if (rawEnd) {
    if (/present|current|now|ongoing/i.test(rawEnd)) {
      endDate = "Present";
      isCurrent = true;
    } else {
      isCurrent = false;
    }
  }

  return { startDate, endDate, isCurrent };
}

/**
 * Structures education records from the education section text.
 *
 * @param {string} educationText
 * @param {string[]} warnings
 * @returns {Array<Object>}
 */
function parseEducation(educationText, warnings = []) {
  if (!educationText || !educationText.trim()) return [];

  const lines = educationText.split("\n").map((l) => l.trim()).filter(Boolean);
  const degreeRegex = /(?:Bachelor|Master|Doctor|Ph\.?D|B\.?Sc|M\.?Sc|B\.?S|M\.?S|B\.?A|M\.?A|B\.?E|M\.?E|B\.?Tech|M\.?Tech|Associate|Diploma|High\s+School)/i;
  const instRegex = /(?:University|College|Institute|School|Academy|Polytechnic|\bMIT\b|\bStanford\b|\bHarvard\b|\bOxford\b|\bCambridge\b|\bCaltech\b)/i;
  const dateRegex = /(?:19|20)\d{2}\s*(?:-|–|—|to)\s*(?:(?:19|20)\d{2}|Present|Current|Expected(?:\s+(?:19|20)\d{2})?)/i;
  const gpaRegex = /(?:GPA|CGPA|Grade|Result)[\s:]*([0-4]\.\d{1,2}(?:\s*\/\s*4(?:\.0)?)?|\b[A-Za-z0-9.+%]+\b)/i;

  const entries = [];
  let current = null;

  for (const line of lines) {
    const isDegree = degreeRegex.test(line);
    const isInst = instRegex.test(line);
    const dateMatch = line.match(dateRegex);
    const gpaMatch = line.match(gpaRegex);

    if (isDegree) {
      if (current) entries.push(current);
      current = {
        qualification: line,
        institution: null,
        fieldOfStudy: null,
        startDate: null,
        endDate: null,
        grade: null,
        description: null,
      };
      if (dateMatch) {
        const { startDate, endDate } = normalizeDateRange(dateMatch[0]);
        current.startDate = startDate;
        current.endDate = endDate;
        current.qualification = line.replace(dateRegex, "").trim();
      }
    } else if (current) {
      if ((isInst || !current.institution) && !dateMatch && !gpaMatch && line.length < 80) {
        current.institution = line;
      } else if (dateMatch && (!current.startDate || !current.endDate)) {
        const { startDate, endDate } = normalizeDateRange(dateMatch[0]);
        current.startDate = startDate;
        current.endDate = endDate;
      } else if (gpaMatch && !current.grade) {
        current.grade = gpaMatch[0].trim();
      } else {
        current.description = (current.description ? current.description + " " : "") + line;
      }
    } else if (isInst) {
      current = {
        qualification: null,
        institution: line,
        fieldOfStudy: null,
        startDate: null,
        endDate: null,
        grade: null,
        description: null,
      };
    }
  }

  if (current) entries.push(current);

  return entries.map((e) => {
    let fieldOfStudy = null;
    if (e.qualification) {
      fieldOfStudy = e.qualification
        .replace(degreeRegex, "")
        .replace(/\bin\b/i, "")
        .replace(/\bof\b/i, "")
        .replace(/[,|\-:]/g, " ")
        .replace(/\s+/g, " ")
        .trim() || null;
    }

    return {
      qualification: e.qualification || null,
      institution: e.institution || null,
      fieldOfStudy,
      startDate: e.startDate || null,
      endDate: e.endDate || null,
      grade: e.grade || null,
      description: e.description || null,
    };
  });
}

/**
 * Structures work experience records from the experience section text.
 *
 * @param {string} expText
 * @param {string[]} warnings
 * @returns {Array<Object>}
 */
function parseExperience(expText, warnings = []) {
  if (!expText || !expText.trim()) return [];

  const lines = expText.split("\n").map((l) => l.trim()).filter(Boolean);
  const titleRegex = /(?:Software\s+Engineer|Developer|Manager|Analyst|Consultant|Architect|Intern|Designer|Administrator|Specialist|Lead|Director|Associate|DevOps|Data\s+Scientist|Engineer|Programmer)/i;
  const dateRegex = /(?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+)?(?:19|20)\d{2}\s*(?:-|–|—|to)\s*(?:(?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+)?(?:19|20)\d{2}|Present|Current)/i;

  const entries = [];
  let current = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isBullet = /^[•\-*]/.test(line);
    const hasDate = dateRegex.test(line);
    const hasTitle = titleRegex.test(line);

    if (hasTitle && !isBullet) {
      if (current) entries.push(current);
      const dateMatch = line.match(dateRegex);
      const cleanedTitle = line.replace(dateRegex, "").replace(/[-|•]/g, "").trim();

      const { startDate, endDate, isCurrent } = dateMatch
        ? normalizeDateRange(dateMatch[0])
        : { startDate: null, endDate: null, isCurrent: null };

      current = {
        jobTitle: cleanedTitle,
        company: null,
        location: null,
        startDate,
        endDate,
        isCurrent,
        responsibilities: [],
        achievements: [],
        technologies: [],
      };
    } else if (current) {
      if (hasDate && !current.startDate) {
        const dateMatch = line.match(dateRegex);
        if (dateMatch) {
          const { startDate, endDate, isCurrent } = normalizeDateRange(dateMatch[0]);
          current.startDate = startDate;
          current.endDate = endDate;
          current.isCurrent = isCurrent;
        }
      } else if (!current.company && !isBullet && line.length < 60) {
        current.company = line.trim();
      } else {
        const cleanContent = line.replace(/^[•\-*]\s*/, "").trim();
        if (/achievement|award|won|ranked|increased|reduced|delivered|launched|surpassed/i.test(cleanContent)) {
          current.achievements.push(cleanContent);
        } else {
          current.responsibilities.push(cleanContent);
        }
      }
    }
  }

  if (current) entries.push(current);

  return entries.map((e) => {
    // Detect mentioned technologies within bullet points
    const fullExpText = [...e.responsibilities, ...e.achievements].join(" ");
    const expSkills = extractSkills(fullExpText);
    const technologies = expSkills.map((s) => s.name);

    return {
      jobTitle: e.jobTitle || null,
      company: e.company || null,
      location: e.location || null,
      startDate: e.startDate || null,
      endDate: e.endDate || null,
      isCurrent: e.isCurrent ?? (e.endDate === "Present" ? true : null),
      responsibilities: e.responsibilities,
      achievements: e.achievements,
      technologies,
    };
  });
}

/**
 * Structures project records from the projects section text.
 *
 * @param {string} projText
 * @param {string[]} warnings
 * @returns {Array<Object>}
 */
function parseProjects(projText, warnings = []) {
  if (!projText || !projText.trim()) return [];

  const lines = projText.split("\n").map((l) => l.trim()).filter(Boolean);
  const entries = [];
  let current = null;

  for (const line of lines) {
    const isBullet = /^[•\-*]/.test(line);
    const hasUrl = /https?:\/\/[^\s]+/i.test(line) || /github\.com\/[^\s]+/i.test(line);
    const isTechHeader = /^(?:technologies|tech\s+stack|tools\s+used):/i.test(line);

    if (!isBullet && !hasUrl && !isTechHeader && line.length < 60) {
      if (current) entries.push(current);
      current = {
        name: line.replace(/[-|•]/g, "").trim(),
        description: [],
        technologies: [],
        responsibilities: [],
        projectUrl: null,
        githubUrl: null,
        demoUrl: null,
      };
    } else if (current) {
      if (hasUrl) {
        const urlMatch = line.match(/https?:\/\/[^\s]+/i);
        if (urlMatch) {
          const url = urlMatch[0];
          if (url.toLowerCase().includes("github.com")) {
            current.githubUrl = url;
          } else if (/demo|app\.|live/i.test(url)) {
            current.demoUrl = url;
          } else {
            current.projectUrl = url;
          }
        }
      } else if (isTechHeader) {
        const techPart = line.split(":")[1]?.trim() || "";
        const explicitTechs = techPart.split(/[,|;]/).map((t) => t.trim()).filter(Boolean);
        current.technologies.push(...explicitTechs);
      } else {
        const cleanContent = line.replace(/^[•\-*]\s*/, "").trim();
        current.description.push(cleanContent);
        if (isBullet) {
          current.responsibilities.push(cleanContent);
        }
      }
    }
  }

  if (current) entries.push(current);

  return entries.map((p) => {
    const combinedDesc = p.description.join(" ") || null;
    const detectedSkills = combinedDesc ? extractSkills(combinedDesc).map((s) => s.name) : [];
    const allTechs = Array.from(new Set([...p.technologies, ...detectedSkills]));

    return {
      name: p.name || null,
      description: combinedDesc,
      technologies: allTechs,
      responsibilities: p.responsibilities,
      projectUrl: p.projectUrl || null,
      githubUrl: p.githubUrl || null,
      demoUrl: p.demoUrl || null,
    };
  });
}

/**
 * Structures certification records from the certifications section text.
 *
 * @param {string} certText
 * @param {string[]} warnings
 * @returns {Array<Object>}
 */
function parseCertifications(certText, warnings = []) {
  if (!certText || !certText.trim()) return [];

  const lines = certText.split("\n").map((l) => l.trim()).filter(Boolean);
  const certOrgRegex = /(?:AWS|Amazon\s+Web\s+Services|Microsoft|Azure|Google\s+Cloud|Google|GCP|Cisco|CompTIA|Oracle|Coursera|edX|Udemy|IBM|Linux\s+Foundation)/i;
  const yearRegex = /\b(?:19|20)\d{2}\b/;
  const certTitleRegex = /(?:Certified|Certification|Certificate|Practitioner|Associate|Professional|Specialty|Expert|Architect|Engineer|Developer|Administrator|Specialist)\b/i;

  const entries = [];
  let current = null;

  for (const line of lines) {
    const clean = line.replace(/^[•\-*]\s*/, "").trim();
    if (!clean) continue;

    const isYearOnly = /^\b(?:19|20)\d{2}\b$/.test(clean);
    const orgMatch = clean.match(certOrgRegex);
    const isOrgOnly = orgMatch && (clean.toLowerCase() === orgMatch[0].toLowerCase() || clean.length < 30);
    const hasCertKeyword = certTitleRegex.test(clean);

    if (hasCertKeyword || !current) {
      if (current) entries.push(current);
      const yearMatch = clean.match(yearRegex);
      current = {
        name: clean.replace(yearRegex, "").trim(),
        issuingOrganization: orgMatch ? orgMatch[0] : null,
        issueDate: yearMatch ? yearMatch[0] : null,
        expirationDate: null,
        credentialId: null,
        credentialUrl: null,
      };
    } else if (current) {
      if (isYearOnly || yearRegex.test(clean)) {
        const yearMatch = clean.match(yearRegex);
        if (yearMatch && !current.issueDate) current.issueDate = yearMatch[0];
      } else if (isOrgOnly && !current.issuingOrganization) {
        current.issuingOrganization = clean;
      }
    }
  }

  if (current) entries.push(current);

  return entries;
}

/**
 * Validates the parsed resume object ensuring types, array invariants, and non-empty guarantees.
 *
 * @param {Object} parsed
 * @returns {{ isValid: boolean, warnings: string[] }}
 */
function validateStructuredResume(parsed) {
  const warnings = [];

  if (!parsed || typeof parsed !== "object") {
    return { isValid: false, warnings: ["Parsed resume is not a valid object."] };
  }

  // Personal Info validation
  if (!parsed.personalInformation || typeof parsed.personalInformation !== "object") {
    warnings.push("personalInformation is not an object.");
  } else {
    const { email, linkedinUrl, githubUrl, portfolioUrl } = parsed.personalInformation;
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      warnings.push("Email address formatting is suspect.");
    }
    if (linkedinUrl && !isValidUrl(linkedinUrl)) {
      warnings.push("LinkedIn URL is not a valid URL.");
    }
    if (githubUrl && !isValidUrl(githubUrl)) {
      warnings.push("GitHub URL is not a valid URL.");
    }
    if (portfolioUrl && !isValidUrl(portfolioUrl)) {
      warnings.push("Portfolio URL is not a valid URL.");
    }
  }

  // Collections validation
  const collections = ["skills", "education", "experience", "projects", "certifications"];
  for (const key of collections) {
    if (!Array.isArray(parsed[key])) {
      warnings.push(`Field '${key}' must be an array.`);
      parsed[key] = [];
    }
  }

  return {
    isValid: warnings.length === 0,
    warnings,
  };
}

module.exports = {
  parseResume,
  createStructuredResumeModel,
  segmentSections,
  parsePersonalInformation,
  parseSummary,
  parseSkills,
  parseEducation,
  parseExperience,
  parseProjects,
  parseCertifications,
  validateStructuredResume,
  normalizeDateRange,
};
