/**
 * Standard Skill Catalogue for SkillLens AI
 * Groups common industry technical and soft skills into categories.
 */
const SKILL_CATALOGUE = [
  // PROGRAMMING
  { name: "JavaScript", category: "PROGRAMMING", aliases: ["javascript", "js", "ecmascript"] },
  { name: "TypeScript", category: "PROGRAMMING", aliases: ["typescript", "ts"] },
  { name: "Python", category: "PROGRAMMING", aliases: ["python", "python3", "py"] },
  { name: "Java", category: "PROGRAMMING", aliases: ["java", "core java"] },
  { name: "C++", category: "PROGRAMMING", aliases: ["c++", "cpp"] },
  { name: "C#", category: "PROGRAMMING", aliases: ["c#", "csharp", "c-sharp"] },
  { name: "C", category: "PROGRAMMING", aliases: ["c language"] },
  { name: "Go", category: "PROGRAMMING", aliases: ["golang", "go lang"] },
  { name: "Rust", category: "PROGRAMMING", aliases: ["rust", "rustlang"] },
  { name: "PHP", category: "PROGRAMMING", aliases: ["php", "php8", "php7"] },
  { name: "Ruby", category: "PROGRAMMING", aliases: ["ruby", "ruby on rails"] },
  { name: "Swift", category: "PROGRAMMING", aliases: ["swift", "swiftui"] },
  { name: "Kotlin", category: "PROGRAMMING", aliases: ["kotlin"] },
  { name: "SQL", category: "PROGRAMMING", aliases: ["sql", "structured query language", "t-sql", "pl/sql"] },
  { name: "R", category: "PROGRAMMING", aliases: ["r programming", "r language"] },
  { name: "Dart", category: "PROGRAMMING", aliases: ["dart"] },
  { name: "Scala", category: "PROGRAMMING", aliases: ["scala"] },
  { name: "Shell Scripting", category: "PROGRAMMING", aliases: ["bash", "shell scripting", "powershell", "zsh", "sh"] },

  // FRAMEWORK & LIBRARIES
  { name: "React", category: "FRAMEWORK", aliases: ["react", "react.js", "reactjs"] },
  { name: "Next.js", category: "FRAMEWORK", aliases: ["next.js", "nextjs", "next"] },
  { name: "Node.js", category: "FRAMEWORK", aliases: ["node.js", "nodejs", "node"] },
  { name: "Express.js", category: "FRAMEWORK", aliases: ["express.js", "expressjs", "express"] },
  { name: "Vue.js", category: "FRAMEWORK", aliases: ["vue", "vue.js", "vuejs", "vue3"] },
  { name: "Angular", category: "FRAMEWORK", aliases: ["angular", "angularjs", "angular 2+"] },
  { name: "Django", category: "FRAMEWORK", aliases: ["django", "django rest framework", "drf"] },
  { name: "Flask", category: "FRAMEWORK", aliases: ["flask"] },
  { name: "FastAPI", category: "FRAMEWORK", aliases: ["fastapi", "fast api"] },
  { name: "Spring Boot", category: "FRAMEWORK", aliases: ["spring boot", "springboot", "spring framework", "spring"] },
  { name: "ASP.NET", category: "FRAMEWORK", aliases: ["asp.net", "dotnet", ".net", ".net core", "asp.net core"] },
  { name: "Laravel", category: "FRAMEWORK", aliases: ["laravel"] },
  { name: "Tailwind CSS", category: "FRAMEWORK", aliases: ["tailwind", "tailwindcss", "tailwind css"] },
  { name: "Bootstrap", category: "FRAMEWORK", aliases: ["bootstrap", "bootstrap 5"] },
  { name: "Redux", category: "FRAMEWORK", aliases: ["redux", "redux toolkit", "rtk"] },
  { name: "GraphQL", category: "FRAMEWORK", aliases: ["graphql", "apollo graphql"] },
  { name: "REST API", category: "FRAMEWORK", aliases: ["rest api", "restful api", "restful apis", "rest apis", "restful web services"] },
  { name: "HTML5", category: "FRAMEWORK", aliases: ["html", "html5"] },
  { name: "CSS3", category: "FRAMEWORK", aliases: ["css", "css3", "sass", "scss", "less"] },
  { name: "jQuery", category: "FRAMEWORK", aliases: ["jquery"] },
  { name: "NestJS", category: "FRAMEWORK", aliases: ["nestjs", "nest.js"] },
  { name: "Flutter", category: "FRAMEWORK", aliases: ["flutter"] },
  { name: "React Native", category: "FRAMEWORK", aliases: ["react native"] },

  // DATABASE
  { name: "MySQL", category: "DATABASE", aliases: ["mysql", "mysql workbench"] },
  { name: "PostgreSQL", category: "DATABASE", aliases: ["postgresql", "postgres", "psql"] },
  { name: "MongoDB", category: "DATABASE", aliases: ["mongodb", "mongo", "mongoose"] },
  { name: "Redis", category: "DATABASE", aliases: ["redis"] },
  { name: "SQLite", category: "DATABASE", aliases: ["sqlite", "sqlite3"] },
  { name: "Oracle DB", category: "DATABASE", aliases: ["oracle", "oracle database", "oracle db"] },
  { name: "Microsoft SQL Server", category: "DATABASE", aliases: ["ms sql", "sql server", "mssql"] },
  { name: "Cassandra", category: "DATABASE", aliases: ["cassandra", "apache cassandra"] },
  { name: "Elasticsearch", category: "DATABASE", aliases: ["elasticsearch", "elastic search", "elk stack"] },
  { name: "DynamoDB", category: "DATABASE", aliases: ["dynamodb", "aws dynamodb"] },
  { name: "Firebase Firestore", category: "DATABASE", aliases: ["firestore", "firebase firestore", "firebase realtime database"] },
  { name: "Supabase", category: "DATABASE", aliases: ["supabase"] },

  // CLOUD & DEVOPS
  { name: "AWS", category: "CLOUD", aliases: ["aws", "amazon web services", "ec2", "s3", "lambda", "cloudfront"] },
  { name: "Microsoft Azure", category: "CLOUD", aliases: ["azure", "microsoft azure"] },
  { name: "Google Cloud Platform", category: "CLOUD", aliases: ["gcp", "google cloud", "google cloud platform"] },
  { name: "Docker", category: "CLOUD", aliases: ["docker", "docker compose", "containerization"] },
  { name: "Kubernetes", category: "CLOUD", aliases: ["kubernetes", "k8s"] },
  { name: "CI/CD", category: "CLOUD", aliases: ["ci/cd", "continuous integration", "github actions", "gitlab ci", "jenkins", "circleci"] },
  { name: "Terraform", category: "CLOUD", aliases: ["terraform"] },
  { name: "Linux", category: "CLOUD", aliases: ["linux", "ubuntu", "debian", "centos", "redhat"] },
  { name: "Nginx", category: "CLOUD", aliases: ["nginx"] },
  { name: "Apache", category: "CLOUD", aliases: ["apache", "apache http server"] },

  // TOOL
  { name: "Git", category: "TOOL", aliases: ["git", "version control"] },
  { name: "GitHub", category: "TOOL", aliases: ["github"] },
  { name: "GitLab", category: "TOOL", aliases: ["gitlab"] },
  { name: "Jira", category: "TOOL", aliases: ["jira"] },
  { name: "Postman", category: "TOOL", aliases: ["postman"] },
  { name: "VS Code", category: "TOOL", aliases: ["vs code", "vscode", "visual studio code"] },
  { name: "Webpack", category: "TOOL", aliases: ["webpack"] },
  { name: "Vite", category: "TOOL", aliases: ["vite", "vitejs"] },
  { name: "npm / yarn / pnpm", category: "TOOL", aliases: ["npm", "yarn", "pnpm"] },

  // DESIGN
  { name: "Figma", category: "DESIGN", aliases: ["figma"] },
  { name: "Adobe XD", category: "DESIGN", aliases: ["adobe xd"] },
  { name: "UI/UX Design", category: "DESIGN", aliases: ["ui/ux", "ui design", "ux design", "user experience", "user interface"] },
  { name: "Photoshop", category: "DESIGN", aliases: ["photoshop", "adobe photoshop"] },
  { name: "Illustrator", category: "DESIGN", aliases: ["illustrator", "adobe illustrator"] },

  // OTHER / DATA & AI
  { name: "Machine Learning", category: "OTHER", aliases: ["machine learning", "ml", "deep learning"] },
  { name: "Artificial Intelligence", category: "OTHER", aliases: ["artificial intelligence", "ai", "generative ai", "genai", "llm"] },
  { name: "Pandas", category: "OTHER", aliases: ["pandas"] },
  { name: "NumPy", category: "OTHER", aliases: ["numpy"] },
  { name: "TensorFlow", category: "OTHER", aliases: ["tensorflow"] },
  { name: "PyTorch", category: "OTHER", aliases: ["pytorch"] },
  { name: "Scikit-Learn", category: "OTHER", aliases: ["scikit-learn", "sklearn"] },
  { name: "Agile / Scrum", category: "SOFT_SKILL", aliases: ["agile", "scrum", "kanban", "sprint planning"] },
];

/**
 * Escapes special regex characters.
 */
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Extracts skills from the resume text using exact boundary-aware matching.
 *
 * @param {string} fullText - Complete resume text
 * @param {string} [skillsSectionText] - Specific skills section if available
 * @returns {Array<{ name: string, category: string, evidence: string }>}
 */
function extractSkills(fullText, skillsSectionText = "") {
  if (!fullText) return [];

  const detected = new Map();
  const lowerFull = fullText.toLowerCase();
  const lowerSkillsSec = (skillsSectionText || "").toLowerCase();

  for (const skill of SKILL_CATALOGUE) {
    let matchedAlias = null;

    for (const alias of skill.aliases) {
      // Create word boundary regex. Handle C++ and C# safely
      let pattern;
      if (alias === "c++") {
        pattern = /(?:^|[\s,;:(/])c\+\+(?:$|[\s,;:)/])/i;
      } else if (alias === "c#") {
        pattern = /(?:^|[\s,;:(/])c#(?:$|[\s,;:)/])/i;
      } else if (alias === "c" || alias === "r") {
        // Single letter requires strict punctuation boundaries or specific context
        pattern = new RegExp(`(?:^|[\\s,;:(/])${escapeRegex(alias)}(?:$|[\\s,;:)/])`, "i");
      } else if (alias === "go") {
        // Avoid "go" matching normal English words ("go ahead", "go to") unless inside skill context
        if (lowerSkillsSec.includes("golang") || lowerSkillsSec.includes("go lang")) {
          matchedAlias = "golang";
          break;
        }
        continue;
      } else {
        pattern = new RegExp(`\\b${escapeRegex(alias)}\\b`, "i");
      }

      // First check skills section if available, else full text
      if (lowerSkillsSec && pattern.test(lowerSkillsSec)) {
        matchedAlias = alias;
        break;
      } else if (pattern.test(lowerFull)) {
        matchedAlias = alias;
        break;
      }
    }

    if (matchedAlias) {
      // Find a short snippet for evidence (max 120 chars)
      let evidence = "";
      const searchIdx = lowerFull.indexOf(matchedAlias.toLowerCase());
      if (searchIdx !== -1) {
        const start = Math.max(0, searchIdx - 30);
        const end = Math.min(fullText.length, searchIdx + matchedAlias.length + 50);
        evidence = fullText.slice(start, end).replace(/\s+/g, " ").trim();
        if (start > 0) evidence = "..." + evidence;
        if (end < fullText.length) evidence = evidence + "...";
      }

      detected.set(skill.name, {
        name: skill.name,
        category: skill.category,
        evidence: evidence || `Mentioned as "${matchedAlias}"`,
      });
    }
  }

  return Array.from(detected.values());
}

module.exports = {
  SKILL_CATALOGUE,
  extractSkills,
};
