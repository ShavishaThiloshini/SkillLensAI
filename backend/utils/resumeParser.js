const { extractSkills } = require("./skillCatalogue");

/**
 * Standard section heading regular expressions.
 * Identifies standard variations of resume sections across industry formats.
 */
const SECTION_PATTERNS = [
  {
    type: "SUMMARY",
    pattern: /^(?:professional\s+summary|summary|profile|about\s+me|career\s+objective|objective|executive\s+summary|personal\s+profile)\b/i,
  },
  {
    type: "EXPERIENCE",
    pattern: /^(?:work\s+experience|professional\s+experience|experience|employment\s+history|work\s+history|career\s+history)\b/i,
  },
  {
    type: "EDUCATION",
    pattern: /^(?:education|academic\s+background|academic\s+qualifications|qualifications|academic\s+history)\b/i,
  },
  {
    type: "SKILLS",
    pattern: /^(?:technical\s+skills|core\s+competencies|skills\s*(?:&|and)\s*technologies|skills|technologies|proficiencies|tools\s*(?:&|and)\s*technologies)\b/i,
  },
  {
    type: "PROJECTS",
    pattern: /^(?:projects|personal\s+projects|key\s+projects|academic\s+projects|featured\s+projects)\b/i,
  },
  {
    type: "CERTIFICATIONS",
    pattern: /^(?:certifications|certificates|licenses\s*(?:&|and)\s*certifications|professional\s+certifications|credentials)\b/i,
  },
  {
    type: "LANGUAGES",
    pattern: /^(?:languages|language\s+proficiency)\b/i,
  },
];

/**
 * Parses raw extracted resume text into structured sections and details.
 *
 * @param {string} rawText - Normalized resume text
 * @returns {Object} Structured resume object
 */
function parseResumeText(rawText) {
  if (!rawText || !rawText.trim()) {
    return createEmptyResumeData();
  }

  const lines = rawText.split("\n").map((l) => l.trim());

  // 1. Segment text into sections
  const sectionsMap = segmentSections(lines);

  // 2. Extract Candidate Contact Information
  const candidate = extractContactDetails(lines, sectionsMap.get("CONTACT") || "");

  // 3. Extract Skills (from dedicated skills section and full text)
  const skills = extractSkills(rawText, sectionsMap.get("SKILLS") || "");

  // 4. Extract Education entries
  const education = extractEducationEntries(sectionsMap.get("EDUCATION") || "");

  // 5. Extract Experience entries
  const experience = extractExperienceEntries(sectionsMap.get("EXPERIENCE") || "");

  // 6. Extract Projects entries
  const projects = extractProjectEntries(sectionsMap.get("PROJECTS") || "");

  // 7. Extract Certifications entries
  const certifications = extractCertificationEntries(sectionsMap.get("CERTIFICATIONS") || "");

  // 8. Prepare sections list for database storage
  const sectionsList = [];
  let order = 0;
  for (const [secType, content] of sectionsMap.entries()) {
    if (content.trim()) {
      sectionsList.push({
        section_type: secType,
        section_content: content.trim(),
        display_order: order++,
      });
    }
  }

  return {
    candidate,
    sections: sectionsList,
    skills,
    education,
    experience,
    projects,
    certifications,
    raw_character_count: rawText.length,
  };
}

/**
 * Splits document lines into identified sections.
 */
function segmentSections(lines) {
  const sectionsMap = new Map();
  let currentSection = "CONTACT"; // Top of document is typically header/contact
  let currentLines = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;

    // Check if line looks like a major section heading:
    // Usually short (< 40 chars), often uppercase or titlecase, matches a section regex
    const isShort = line.length <= 40;
    const cleanHeading = line.replace(/[:\-#*]/g, "").trim();

    let matchedType = null;
    if (isShort && cleanHeading.length >= 3) {
      for (const def of SECTION_PATTERNS) {
        if (def.pattern.test(cleanHeading)) {
          matchedType = def.type;
          break;
        }
      }
    }

    if (matchedType) {
      // Save prior accumulated section
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
 * Conservative contact and identity extraction.
 */
function extractContactDetails(allLines, headerContent) {
  const topText = headerContent || allLines.slice(0, 20).join("\n");
  const fullDocument = allLines.join("\n");

  // 1. Email Address (standard RFC-compliant conservative regex)
  let email = null;
  const emailMatch = fullDocument.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  if (emailMatch) {
    email = emailMatch[0].toLowerCase();
  }

  // 2. Phone Number
  let phone = null;
  const phoneMatch = fullDocument.match(
    /(?:(?:\+?1\s*(?:[.-]\s*)?)?(?:\(\s*([2-9]1[02-9]|[2-9][02-8]1|[2-9][02-8][02-9])\s*\)|([2-9]1[02-9]|[2-9][02-8]1|[2-9][02-8][02-9]))\s*(?:[.-]\s*)?)?([2-9]1[02-9]|[2-9][02-9]1|[2-9][02-9]{2})\s*(?:[.-]\s*)?([0-9]{4})(?:\s*(?:#|x\.?|ext\.?|extension)\s*(\d+))?/i
  ) || fullDocument.match(/\+?\d{1,4}?[-.\s]?\(?\d{2,4}?\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4}/);
  if (phoneMatch) {
    const cleanPhone = phoneMatch[0].trim();
    // Validate phone digits count (between 7 and 15 digits)
    const digitCount = (cleanPhone.match(/\d/g) || []).length;
    if (digitCount >= 7 && digitCount <= 15) {
      phone = cleanPhone;
    }
  }

  // 3. LinkedIn URL
  let linkedin = null;
  const linkedinMatch = fullDocument.match(/https?:\/\/(?:www\.)?linkedin\.com\/in\/[a-zA-Z0-9_-]+/i) ||
    fullDocument.match(/linkedin\.com\/in\/[a-zA-Z0-9_-]+/i);
  if (linkedinMatch) {
    linkedin = linkedinMatch[0].startsWith("http") ? linkedinMatch[0] : `https://${linkedinMatch[0]}`;
  }

  // 4. GitHub URL
  let github = null;
  const githubMatch = fullDocument.match(/https?:\/\/(?:www\.)?github\.com\/[a-zA-Z0-9_-]+/i) ||
    fullDocument.match(/github\.com\/[a-zA-Z0-9_-]+/i);
  if (githubMatch) {
    // Avoid generic links like github.com/topics
    if (!githubMatch[0].includes("/features") && !githubMatch[0].includes("/topics")) {
      github = githubMatch[0].startsWith("http") ? githubMatch[0] : `https://${githubMatch[0]}`;
    }
  }

  // 5. Portfolio or Website URL
  let portfolio = null;
  const urlMatches = fullDocument.match(/https?:\/\/[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(?:\/[^\s)"]*)?/g) || [];
  for (const url of urlMatches) {
    const lower = url.toLowerCase();
    if (!lower.includes("linkedin.com") && !lower.includes("github.com") && !lower.includes("w3.org") && !lower.includes("schema.org")) {
      portfolio = url;
      break;
    }
  }

  // 6. Candidate Name
  // Heuristic: Candidate name is typically in the top 5 non-empty lines,
  // 2 to 4 words, alphabetic characters only, no digits/emails/URLs/symbols, not a known section header or title.
  let fullName = null;
  const candidateLines = allLines.slice(0, 8);
  for (const line of candidateLines) {
    const clean = line.replace(/[•|,\-]/g, " ").trim();
    if (!clean) continue;
    if (clean.includes("@") || clean.includes("http") || clean.includes("www.") || /\d/.test(clean)) continue;
    if (/resume|curriculum\s+vitae|cv|page\s+\d/i.test(clean)) continue;

    // Check word count (typically 2 - 4 capitalized words)
    const words = clean.split(/\s+/).filter(Boolean);
    if (words.length >= 2 && words.length <= 4) {
      const isAlphaOnly = words.every((w) => /^[a-zA-Z.'-]+$/.test(w));
      if (isAlphaOnly) {
        fullName = words.join(" ");
        break;
      }
    }
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
    full_name: fullName,
    email,
    phone,
    location,
    linkedin_url: linkedin,
    github_url: github,
    portfolio_url: portfolio,
  };
}

/**
 * Extracts Education entries.
 */
function extractEducationEntries(educationText) {
  if (!educationText || !educationText.trim()) return [];

  const entries = [];
  const lines = educationText.split("\n").map((l) => l.trim()).filter(Boolean);

  const degreeRegex = /(?:Bachelor|Master|Doctor|Ph\.?D|B\.?Sc|M\.?Sc|B\.?S|M\.?S|B\.?A|M\.?A|B\.?E|M\.?E|B\.?Tech|M\.?Tech|Associate|Diploma|High\s+School)/i;
  const instRegex = /(?:University|College|Institute|School|Academy|Polytechnic)/i;
  const dateRegex = /(?:19|20)\d{2}\s*(?:-|–|to)\s*(?:(?:19|20)\d{2}|Present|Current|Expected)/i;
  const gpaRegex = /(?:GPA|CGPA|Grade|Result)[\s:]*([0-4]\.\d{1,2}(?:\s*\/\s*4(?:\.0)?)?|\b[A-Za-z0-9.+%]+\b)/i;

  let currentEntry = null;

  for (const line of lines) {
    const isDegree = degreeRegex.test(line);
    const isInst = instRegex.test(line);
    const dateMatch = line.match(dateRegex);
    const gpaMatch = line.match(gpaRegex);

    if (isDegree) {
      if (currentEntry) entries.push(currentEntry);
      currentEntry = {
        qualification: line,
        institution: null,
        dates: null,
        grade: null,
        details: null,
      };
    } else if (currentEntry) {
      if (isInst && !currentEntry.institution) {
        currentEntry.institution = line;
      } else if (dateMatch && !currentEntry.dates) {
        currentEntry.dates = dateMatch[0].trim();
      } else if (gpaMatch && !currentEntry.grade) {
        currentEntry.grade = gpaMatch[0].trim();
      } else {
        currentEntry.details = (currentEntry.details ? currentEntry.details + " " : "") + line;
      }
    } else if (isInst) {
      currentEntry = {
        qualification: "Degree / Qualification",
        institution: line,
        dates: null,
        grade: null,
        details: null,
      };
    }
  }


  if (currentEntry) entries.push(currentEntry);

  return entries.map((e) => ({
    qualification: e.qualification,
    institution: e.institution || "Not detected",
    field_of_study: e.qualification ? e.qualification.replace(degreeRegex, "").replace(/in\s+/i, "").replace(/of\s+/i, "").trim() || null : null,
    dates: e.dates || null,
    grade: e.grade || null,
    details: e.details || null,
  }));
}

/**
 * Extracts Experience entries.
 */
function extractExperienceEntries(expText) {
  if (!expText || !expText.trim()) return [];

  const entries = [];
  const lines = expText.split("\n").map((l) => l.trim()).filter(Boolean);

  const titleRegex = /(?:Software\s+Engineer|Developer|Manager|Analyst|Consultant|Architect|Intern|Designer|Administrator|Specialist|Lead|Director|Associate|DevOps|Data\s+Scientist)/i;
  const dateRegex = /(?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+)?(?:19|20)\d{2}\s*(?:-|–|to)\s*(?:(?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+)?(?:19|20)\d{2}|Present|Current)/i;

  let currentEntry = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isBullet = line.startsWith("•") || line.startsWith("-") || line.startsWith("*");
    const hasDate = dateRegex.test(line);
    const hasTitle = titleRegex.test(line);

    if (hasTitle && !isBullet) {
      if (currentEntry) entries.push(currentEntry);
      const dateMatch = line.match(dateRegex);
      currentEntry = {
        title: line.replace(dateRegex, "").replace(/[-|•]/g, "").trim(),
        company: null,
        dates: dateMatch ? dateMatch[0].trim() : null,
        description: [],
      };
    } else if (currentEntry) {
      if (hasDate && !currentEntry.dates) {
        const dateMatch = line.match(dateRegex);
        currentEntry.dates = dateMatch ? dateMatch[0].trim() : null;
      } else if (!currentEntry.company && !isBullet && line.length < 60) {
        currentEntry.company = line;
      } else {
        currentEntry.description.push(line.replace(/^[•\-*]\s*/, ""));
      }
    }
  }

  if (currentEntry) entries.push(currentEntry);

  return entries.map((e) => ({
    title: e.title,
    company: e.company || "Not detected",
    dates: e.dates || "Not detected",
    responsibilities: e.description.join(" ") || null,
  }));
}

/**
 * Extracts Project entries.
 */
function extractProjectEntries(projText) {
  if (!projText || !projText.trim()) return [];

  const entries = [];
  const lines = projText.split("\n").map((l) => l.trim()).filter(Boolean);

  let currentProject = null;

  for (const line of lines) {
    const isBullet = line.startsWith("•") || line.startsWith("-") || line.startsWith("*");
    const hasUrl = /https?:\/\/[^\s]+/i.test(line) || /github\.com\/[^\s]+/i.test(line);

    if (!isBullet && !hasUrl && line.length < 60 && !line.toLowerCase().startsWith("technologies:") && !line.toLowerCase().startsWith("tech stack:")) {
      if (currentProject) {
        entries.push(currentProject);
      }
      currentProject = {
        name: line.replace(/[-|•]/g, "").trim(),
        url: null,
        technologies: null,
        description: [],
      };
    } else if (currentProject) {
      if (hasUrl && !currentProject.url) {
        const urlMatch = line.match(/https?:\/\/[^\s]+/i);
        if (urlMatch) currentProject.url = urlMatch[0];
      } else if (line.toLowerCase().startsWith("technologies:") || line.toLowerCase().startsWith("tech stack:")) {
        currentProject.technologies = line.split(":")[1]?.trim() || null;
      } else {
        currentProject.description.push(line.replace(/^[•\-*]\s*/, ""));
      }
    }
  }

  if (currentProject) {
    entries.push(currentProject);
  }

  return entries.map((p) => ({
    name: p.name || "Project",
    url: p.url || null,
    technologies: p.technologies || null,
    description: p.description.join(" ") || null,
  }));
}


/**
 * Extracts Certification entries.
 */
function extractCertificationEntries(certText) {
  if (!certText || !certText.trim()) return [];

  const entries = [];
  const lines = certText.split("\n").map((l) => l.trim()).filter(Boolean);

  const certOrgRegex = /(?:AWS|Amazon|Microsoft|Azure|Google|GCP|Cisco|CompTIA|Oracle|Certified|Coursera|edX|Udemy|IBM)/i;

  for (const line of lines) {
    const clean = line.replace(/^[•\-*]\s*/, "").trim();
    if (clean.length < 4) continue;

    const orgMatch = clean.match(certOrgRegex);
    const dateMatch = clean.match(/(?:19|20)\d{2}/);

    entries.push({
      name: clean,
      issuer: orgMatch ? orgMatch[0] : "Not detected",
      date: dateMatch ? dateMatch[0] : null,
    });
  }

  return entries;
}

function createEmptyResumeData() {
  return {
    candidate: {
      full_name: null,
      email: null,
      phone: null,
      location: null,
      linkedin_url: null,
      github_url: null,
      portfolio_url: null,
    },
    sections: [],
    skills: [],
    education: [],
    experience: [],
    projects: [],
    certifications: [],
    raw_character_count: 0,
  };
}

module.exports = {
  parseResumeText,
  segmentSections,
  extractContactDetails,
};
