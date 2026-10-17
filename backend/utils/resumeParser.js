const { extractSkills } = require("./skillCatalogue");
const {
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
} = require("../services/resumeParserService");

/**
 * Standard section heading regular expressions.
 * Exported for compatibility with Day 11 tests.
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
 * Retains backward-compatible fields (candidate, sections, raw_character_count)
 * while also attaching the Day 12 structured resume model.
 *
 * @param {string} rawText - Normalized resume text
 * @returns {Object} Structured resume object
 */
function parseResumeText(rawText) {
  if (!rawText || !rawText.trim()) {
    const emptyModel = createStructuredResumeModel();
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
      structuredModel: emptyModel,
    };
  }

  const lines = rawText.split("\n").map((l) => l.trim());
  const sectionsMap = segmentSections(lines);

  // Run canonical Day 12 structured parser
  const structuredModel = parseResume(rawText);

  // Backward compatible candidate object with snake_case fields
  const candidate = {
    full_name: structuredModel.personalInformation.fullName,
    email: structuredModel.personalInformation.email,
    phone: structuredModel.personalInformation.phone,
    location: structuredModel.personalInformation.location,
    linkedin_url: structuredModel.personalInformation.linkedinUrl,
    github_url: structuredModel.personalInformation.githubUrl,
    portfolio_url: structuredModel.personalInformation.portfolioUrl,
  };

  // Prepare sections list for database storage
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

  // Backward compatible skills list
  const skills = structuredModel.skills.map((s) => ({
    name: s.name,
    category: s.category,
    evidence: `Identified under ${s.sourceSection}`,
  }));

  // Backward compatible education list
  const education = structuredModel.education.map((e) => ({
    qualification: e.qualification,
    institution: e.institution || "Not detected",
    field_of_study: e.fieldOfStudy,
    dates: e.startDate && e.endDate ? `${e.startDate} - ${e.endDate}` : (e.startDate || e.endDate || null),
    grade: e.grade,
    details: e.description,
  }));

  // Backward compatible experience list
  const experience = structuredModel.experience.map((e) => ({
    title: e.jobTitle,
    company: e.company || "Not detected",
    dates: e.startDate && e.endDate ? `${e.startDate} - ${e.endDate}` : (e.startDate || e.endDate || "Not detected"),
    responsibilities: [...e.responsibilities, ...e.achievements].join(" ") || null,
  }));

  // Backward compatible projects list
  const projects = structuredModel.projects.map((p) => ({
    name: p.name || "Project",
    url: p.projectUrl || p.githubUrl || p.demoUrl || null,
    technologies: p.technologies?.join(", ") || null,
    description: p.description,
  }));

  // Backward compatible certifications list
  const certifications = structuredModel.certifications.map((c) => ({
    name: c.name,
    issuer: c.issuingOrganization || "Not detected",
    date: c.issueDate || null,
  }));

  return {
    candidate,
    summary: structuredModel.summary,
    sections: sectionsList,
    skills,
    education,
    experience,
    projects,
    certifications,
    raw_character_count: rawText.length,
    structuredModel,
  };
}

/**
 * Backward compatibility wrapper for extractContactDetails
 */
function extractContactDetails(allLines, headerContent) {
  const p = parsePersonalInformation(allLines, headerContent, []);
  return {
    full_name: p.fullName,
    email: p.email,
    phone: p.phone,
    location: p.location,
    linkedin_url: p.linkedinUrl,
    github_url: p.githubUrl,
    portfolio_url: p.portfolioUrl,
  };
}

module.exports = {
  parseResumeText,
  segmentSections,
  extractContactDetails,
  SECTION_PATTERNS,
};
