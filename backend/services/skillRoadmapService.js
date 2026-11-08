/**
 * SkillLens AI — Skill Gap Roadmap Service
 * Day 26: Personalized Skill Gap Learning Roadmap Engine
 *
 * Transforms skill matching results into an actionable, explainable, and prioritized
 * learning path:
 * 1. Analyzes actual current skills from candidate resume
 * 2. Identifies missing and partial skills against target job requirements
 * 3. Prioritizes skills using explainable rules (required vs preferred, job importance,
 *    foundational prerequisites, and candidate readiness)
 * 4. Generates personalized practical learning paths (Objective, Stages, Exercises,
 *    Mini-project, and Completion Criteria)
 * 5. Supports persistent progress tracking (NOT_STARTED, IN_PROGRESS, COMPLETED)
 *
 * Adheres strictly to docs/PRD.md, docs/TRD.md, docs/APP_FLOW.md, and docs/DATABASE_SCHEMA.md.
 */

const db = require("../config/db");
const { normalizeSkillName, areDistinctTechnologies, deduplicateSkills } = require("../utils/skillNormalizer");
const SkillMatchingService = require("./skillMatchingService");
const MatchScoreService = require("./matchScoreService");
const ResumeService = require("./resumeService");
const JobRequirementExtractionService = require("./jobRequirementExtractionService");
const { generateText, validateAiConfig } = require("./aiService");

const ROADMAP_ALGORITHM_VERSION = "1.0";

/**
 * Reliable, conservative foundational prerequisite relationships.
 * Skill Key: normalized name of the dependent skill
 * Value: { prereq: normalized name of foundational skill, rationale: string }
 */
const KNOWN_PREREQUISITES = {
  typescript: {
    prereq: "javascript",
    rationale: "TypeScript builds directly upon JavaScript syntax, semantics, and ECMAScript features.",
  },
  react: {
    prereq: "javascript",
    rationale: "React applications require foundational mastery of modern JavaScript (ES6+, closures, promises, array methods).",
  },
  "next.js": {
    prereq: "react",
    rationale: "Next.js is a full-stack framework built on React; React components, hooks, and lifecycle are foundational prerequisites.",
  },
  vue: {
    prereq: "javascript",
    rationale: "Vue.js component composition and reactivity require foundational modern JavaScript knowledge.",
  },
  angular: {
    prereq: "typescript",
    rationale: "Angular applications are authored in TypeScript and rely strictly on static typing, decorators, and classes.",
  },
  "node.js": {
    prereq: "javascript",
    rationale: "Node.js runs JavaScript on the server; understanding asynchronous execution and the event loop is essential.",
  },
  "express.js": {
    prereq: "node.js",
    rationale: "Express.js is an HTTP server framework running within the Node.js runtime environment.",
  },
  nestjs: {
    prereq: "node.js",
    rationale: "NestJS is a progressive Node.js framework leveraging TypeScript and server-side architecture patterns.",
  },
  django: {
    prereq: "python",
    rationale: "Django is a high-level Python web framework; solid Python object-oriented programming is a prerequisite.",
  },
  flask: {
    prereq: "python",
    rationale: "Flask is a lightweight Python web framework requiring core Python programming proficiency.",
  },
  fastapi: {
    prereq: "python",
    rationale: "FastAPI relies on Python type annotations and asynchronous coroutines.",
  },
  "spring boot": {
    prereq: "java",
    rationale: "Spring Boot is an enterprise Java framework; Java OOP principles, collections, and generics are foundational.",
  },
  kubernetes: {
    prereq: "docker",
    rationale: "Kubernetes orchestrates containerized workloads; understanding Docker images and container lifecycles is foundational.",
  },
  "ci/cd": {
    prereq: "git",
    rationale: "Automated CI/CD pipelines trigger on version control commits, pull requests, and Git branching workflows.",
  },
  terraform: {
    prereq: "docker",
    rationale: "Infrastructure-as-code deployments build upon containerization and cloud infrastructure primitives.",
  },
  postgresql: {
    prereq: "sql",
    rationale: "PostgreSQL is a relational database relying on core SQL queries, relational joins, and transaction management.",
  },
  mysql: {
    prereq: "sql",
    rationale: "MySQL administration and query optimization build upon foundational relational database design and SQL.",
  },
  "c++": {
    prereq: "c",
    rationale: "C++ builds directly upon C procedural programming, memory management, and pointers.",
  },
};

/**
 * Curated, high-quality learning paths for common industry skills.
 * Provides rich, realistic, and practical learning plans without hallucinations or fake URLs.
 */
const CURATED_LEARNING_PATHS = {
  typescript: {
    difficulty: "INTERMEDIATE",
    estimatedDuration: "2-3 weeks",
    learningObjective:
      "Master TypeScript static typing, interfaces, generics, and compiler configuration to build type-safe scalable applications.",
    learningSteps: [
      {
        stepIndex: 1,
        title: "TypeScript Core Types & Setup",
        description:
          "Configure tsconfig.json, learn primitive types, type inference, union types, and type narrowing.",
        status: "NOT_STARTED",
      },
      {
        stepIndex: 2,
        title: "Interfaces, Type Aliases & Object Modeling",
        description:
          "Define interfaces, type aliases, optional properties, readonly modifiers, and index signatures.",
        status: "NOT_STARTED",
      },
      {
        stepIndex: 3,
        title: "Functions, Generics & Utility Types",
        description:
          "Type function parameters and returns, create reusable generic functions/classes, and use built-in utility types (Partial, Pick, Omit, Record).",
        status: "NOT_STARTED",
      },
      {
        stepIndex: 4,
        title: "Integration with Frameworks & Build Tools",
        description:
          "Integrate TypeScript into modern React/Node applications with proper typed props, hooks, and API responses.",
        status: "NOT_STARTED",
      },
      {
        stepIndex: 5,
        title: "Strict Mode & Advanced Type Narrowing",
        description:
          "Enable strict compiler flags, write custom type guards, handle discriminated unions, and eliminate 'any' types.",
        status: "NOT_STARTED",
      },
    ],
    practicalActivities: [
      "Set up a TypeScript sandbox with ts-node and explore compiler options.",
      "Convert a plain JavaScript utility library with 5+ functions into fully typed TypeScript.",
      "Create reusable generic data structures (e.g. Result<T, E>, PaginatedResponse<T>).",
      "Write discriminated union types to model complex multi-state UI or API responses.",
    ],
    miniProject: {
      title: "Type-Safe Task Management Service",
      description:
        "Build a command-line or small API service that manages tasks, priorities, and audit histories with complete type safety, custom generic validators, and zero runtime type errors.",
      demonstrates:
        "Demonstrates interfaces, generic functions, discriminated unions, and strict compiler enforcement.",
    },
    completionCriteria: [
      "Successfully compiles with 'strict: true' and zero type errors or 'any' escape hatches.",
      "Candidate can explain the difference between interfaces and type aliases and when to use each.",
      "Able to write generic functions and utilize built-in utility types effectively in real code.",
    ],
  },

  docker: {
    difficulty: "INTERMEDIATE",
    estimatedDuration: "2 weeks",
    learningObjective:
      "Understand containerization principles, create optimized multi-stage Dockerfiles, and orchestrate multi-container services with Docker Compose.",
    learningSteps: [
      {
        stepIndex: 1,
        title: "Containerization Fundamentals & Docker CLI",
        description:
          "Understand images vs containers, Docker architecture, and core CLI commands (run, ps, stop, rm, exec, logs).",
        status: "NOT_STARTED",
      },
      {
        stepIndex: 2,
        title: "Authoring Dockerfiles & Image Layering",
        description:
          "Write Dockerfiles using FROM, WORKDIR, COPY, RUN, CMD, and EXPOSE while optimizing caching and image size.",
        status: "NOT_STARTED",
      },
      {
        stepIndex: 3,
        title: "Multi-Stage Builds & Security Best Practices",
        description:
          "Implement multi-stage builds to create lean production images and run containers as non-root users.",
        status: "NOT_STARTED",
      },
      {
        stepIndex: 4,
        title: "Networking & Volume Persistence",
        description:
          "Configure Docker bridge networks for container communication and bind mounts/named volumes for data persistence.",
        status: "NOT_STARTED",
      },
      {
        stepIndex: 5,
        title: "Multi-Container Orchestration with Docker Compose",
        description:
          "Define multi-service environments (e.g. app server + PostgreSQL + Redis) using docker-compose.yml.",
        status: "NOT_STARTED",
      },
    ],
    practicalActivities: [
      "Containerize an existing Node.js or Python backend application using a clean Dockerfile.",
      "Convert a single-stage build into a multi-stage build and measure the resulting image size reduction.",
      "Create a docker-compose.yml file linking an API application with a PostgreSQL database and volume.",
      "Inspect running container logs, environment variables, and execute interactive shells inside containers.",
    ],
    miniProject: {
      title: "Production-Ready Containerized Web Stack",
      description:
        "Containerize a full-stack web application with an API backend, relational database, and reverse proxy using Docker Compose with environment variables and healthchecks.",
      demonstrates:
        "Demonstrates multi-stage builds, non-root user security, volume persistence, and service networking.",
    },
    completionCriteria: [
      "Image builds reproducibly across different development environments.",
      "Production container runs with minimal footprint and without running as root user.",
      "Multi-container application boots cleanly with 'docker compose up' and persists data across restarts.",
    ],
  },

  aws: {
    difficulty: "INTERMEDIATE",
    estimatedDuration: "3-4 weeks",
    learningObjective:
      "Gain practical competency with core AWS cloud services (IAM, S3, EC2, Lambda, RDS) and cloud architecture best practices.",
    learningSteps: [
      {
        stepIndex: 1,
        title: "Cloud Concepts & AWS Identity and Access Management (IAM)",
        description:
          "Learn cloud deployment models, shared responsibility, IAM users, groups, roles, and least-privilege policies.",
        status: "NOT_STARTED",
      },
      {
        stepIndex: 2,
        title: "Object Storage & Static Hosting with Amazon S3",
        description:
          "Create and configure S3 buckets, understand lifecycle policies, encryption, and bucket policies.",
        status: "NOT_STARTED",
      },
      {
        stepIndex: 3,
        title: "Compute Fundamentals: EC2 & Serverless Lambda",
        description:
          "Launch and configure EC2 instances with security groups; build and deploy basic serverless functions using AWS Lambda.",
        status: "NOT_STARTED",
      },
      {
        stepIndex: 4,
        title: "Managed Databases & Networking (RDS & VPC Basics)",
        description:
          "Deploy a managed PostgreSQL or MySQL database on Amazon RDS and understand basic VPC subnetting and security rules.",
        status: "NOT_STARTED",
      },
      {
        stepIndex: 5,
        title: "Monitoring, Logging & Cost Awareness",
        description:
          "Set up Amazon CloudWatch alarms, review application logs, and configure AWS billing budget alerts.",
        status: "NOT_STARTED",
      },
    ],
    practicalActivities: [
      "Create an IAM user with programmatic access and least-privilege permissions.",
      "Upload and serve assets from a private S3 bucket using pre-signed URLs or IAM role authentication.",
      "Deploy a serverless AWS Lambda function that processes an event payload and logs output to CloudWatch.",
      "Configure an AWS Budget alert to guard against unexpected cloud resource costs.",
    ],
    miniProject: {
      title: "Serverless Document Processing Workflow",
      description:
        "Build a serverless pipeline where uploading a file to an S3 bucket triggers an AWS Lambda function that parses metadata and stores the record in a database with CloudWatch logging.",
      demonstrates:
        "Demonstrates IAM security roles, S3 event triggers, serverless execution, and cloud observability.",
    },
    completionCriteria: [
      "Candidate can configure and deploy AWS resources using security best practices (no root access, no wildcard policies).",
      "Successfully invoke and debug Lambda functions via CloudWatch logs.",
      "Able to explain architectural trade-offs between serverless (Lambda) and server-based (EC2/ECS) compute.",
    ],
  },

  kubernetes: {
    difficulty: "ADVANCED",
    estimatedDuration: "3-4 weeks",
    learningObjective:
      "Deploy, manage, and scale containerized applications on Kubernetes clusters using standard declarative manifests.",
    learningSteps: [
      {
        stepIndex: 1,
        title: "Kubernetes Architecture & Core Concepts",
        description:
          "Understand control plane vs worker nodes, kube-apiserver, etcd, kubelet, and the Pod lifecycle.",
        status: "NOT_STARTED",
      },
      {
        stepIndex: 2,
        title: "Deployments, Pods & ReplicaSets",
        description:
          "Write declarative YAML manifests for Deployments, understand desired state, and execute rolling updates and rollbacks.",
        status: "NOT_STARTED",
      },
      {
        stepIndex: 3,
        title: "Services & Networking",
        description:
          "Expose applications using ClusterIP, NodePort, and LoadBalancer services; understand Ingress controllers.",
        status: "NOT_STARTED",
      },
      {
        stepIndex: 4,
        title: "ConfigMaps, Secrets & Persistent Volumes",
        description:
          "Inject decoupled configuration via ConfigMaps and Secrets; attach PersistentVolumeClaims for stateful workloads.",
        status: "NOT_STARTED",
      },
      {
        stepIndex: 5,
        title: "Cluster Management & Health Probes",
        description:
          "Implement liveness and readiness probes, resource requests/limits, and horizontal pod autoscaling.",
        status: "NOT_STARTED",
      },
    ],
    practicalActivities: [
      "Set up a local development cluster using Minikube or Kind.",
      "Deploy a multi-replica web service manifest and test zero-downtime rolling updates with kubectl.",
      "Create ConfigMaps and Secrets to securely pass database credentials to a running application pod.",
      "Configure readiness and liveness HTTP probes and simulate application failure recovery.",
    ],
    miniProject: {
      title: "Resilient Microservice Deployment on Kubernetes",
      description:
        "Deploy a web application with multiple replicas, health checks, ConfigMaps, and an Ingress route on a local cluster.",
      demonstrates:
        "Demonstrates declarative YAML authoring, zero-downtime deployments, self-healing probes, and cluster networking.",
    },
    completionCriteria: [
      "Candidate can manage cluster resources fluently with kubectl commands.",
      "All manifests apply cleanly with 'kubectl apply -f' without manual pod interventions.",
      "Application recovers automatically when individual pods are terminated.",
    ],
  },

  react: {
    difficulty: "INTERMEDIATE",
    estimatedDuration: "2-3 weeks",
    learningObjective:
      "Build modular, responsive frontend applications using modern React functional components, hooks, and clean state management.",
    learningSteps: [
      {
        stepIndex: 1,
        title: "Components, JSX & Props",
        description:
          "Master JSX syntax, pure component design, props passing, and conditional rendering patterns.",
        status: "NOT_STARTED",
      },
      {
        stepIndex: 2,
        title: "State Management with useState & useReducer",
        description:
          "Manage component state immutably, handle complex forms, and implement reducer patterns for multi-step workflows.",
        status: "NOT_STARTED",
      },
      {
        stepIndex: 3,
        title: "Side Effects & the Component Lifecycle with useEffect",
        description:
          "Handle API data fetching, cleanup subscriptions, avoid infinite re-render loops, and understand dependency arrays.",
        status: "NOT_STARTED",
      },
      {
        stepIndex: 4,
        title: "Custom Hooks & Context API",
        description:
          "Extract reusable stateful logic into custom hooks; share global state (e.g. auth, theme) cleanly with Context.",
        status: "NOT_STARTED",
      },
      {
        stepIndex: 5,
        title: "Performance Optimization & Component Testing",
        description:
          "Apply useMemo, useCallback, and React.memo where appropriate; write unit tests for key user interactions.",
        status: "NOT_STARTED",
      },
    ],
    practicalActivities: [
      "Refactor a prop-drilling component hierarchy using React Context.",
      "Build a custom hook (e.g. useDebounce or useFetch) with cancellation support.",
      "Implement an accessible, controlled form with real-time field validation.",
      "Profile component rendering with React DevTools and optimize unnecessary renders.",
    ],
    miniProject: {
      title: "Interactive Search & Filter Dashboard",
      description:
        "Build a responsive dashboard with search, category filtering, pagination, and modal dialogs using custom hooks and Context.",
      demonstrates:
        "Demonstrates functional components, hooks composition, immutable state management, and responsive layout.",
    },
    completionCriteria: [
      "Application renders cleanly with zero console warnings or key errors.",
      "State flows predictably without mutation or race conditions in asynchronous effects.",
      "Demonstrates modular component separation following Single Responsibility Principle.",
    ],
  },

  "node.js": {
    difficulty: "INTERMEDIATE",
    estimatedDuration: "2-3 weeks",
    learningObjective:
      "Develop reliable, high-performance backend services and RESTful APIs using the Node.js runtime environment.",
    learningSteps: [
      {
        stepIndex: 1,
        title: "Node.js Architecture & Event Loop",
        description:
          "Understand the non-blocking asynchronous event loop, microtask vs macrotask queues, and CommonJS vs ES Modules.",
        status: "NOT_STARTED",
      },
      {
        stepIndex: 2,
        title: "Core Modules: Streams, Buffers & File System",
        description:
          "Work with fs/promises, readable/writable streams, buffers, and event emitters for high-throughput data processing.",
        status: "NOT_STARTED",
      },
      {
        stepIndex: 3,
        title: "HTTP Servers & RESTful Routing",
        description:
          "Build modular HTTP APIs, implement request routing, parsing, headers, and status code handling.",
        status: "NOT_STARTED",
      },
      {
        stepIndex: 4,
        title: "Asynchronous Error Handling & Validation",
        description:
          "Implement centralized error middleware, async/await error boundaries, and robust request input validation.",
        status: "NOT_STARTED",
      },
      {
        stepIndex: 5,
        title: "Database Integration & Environment Management",
        description:
          "Connect to relational/NoSQL databases with connection pooling, handle transactions, and manage environment configurations.",
        status: "NOT_STARTED",
      },
    ],
    practicalActivities: [
      "Build a file streaming script that processes large CSV files line-by-line with minimal memory usage.",
      "Implement a custom EventEmitter for pub/sub messaging inside a service.",
      "Write a centralized error handler catching unhandled promise rejections cleanly.",
      "Set up database connection pooling with graceful shutdown handlers.",
    ],
    miniProject: {
      title: "Production REST API with Authentication & Validation",
      description:
        "Build a modular REST API with JWT authentication, input validation middleware, rate limiting, and database connection pooling.",
      demonstrates:
        "Demonstrates asynchronous pipeline design, middleware architecture, error handling, and secure database access.",
    },
    completionCriteria: [
      "Handles concurrent asynchronous requests without blocking the event loop.",
      "All API endpoints validate inputs and return consistent error response payloads.",
      "Server shuts down gracefully on SIGTERM/SIGINT, closing active database connections.",
    ],
  },

  postgresql: {
    difficulty: "INTERMEDIATE",
    estimatedDuration: "2 weeks",
    learningObjective:
      "Design normalized relational database schemas, write optimized SQL queries, and leverage PostgreSQL-specific features.",
    learningSteps: [
      {
        stepIndex: 1,
        title: "Relational Schema Design & Normalization",
        description:
          "Design normalized relational tables (3NF), define primary/foreign keys, check constraints, and CASCADE rules.",
        status: "NOT_STARTED",
      },
      {
        stepIndex: 2,
        title: "Complex Querying & Aggregations",
        description:
          "Master multi-table JOINs, subqueries, GROUP BY aggregations, and window functions (ROW_NUMBER, RANK).",
        status: "NOT_STARTED",
      },
      {
        stepIndex: 3,
        title: "Indexing Strategies & Query Performance",
        description:
          "Understand B-tree, GIN, and GiST indexes; analyze queries using EXPLAIN ANALYZE to identify sequential scans.",
        status: "NOT_STARTED",
      },
      {
        stepIndex: 4,
        title: "Transactions, Isolation Levels & Concurrency",
        description:
          "Execute ACID transactions with BEGIN/COMMIT/ROLLBACK, handle deadlocks, and choose appropriate isolation levels.",
        status: "NOT_STARTED",
      },
      {
        stepIndex: 5,
        title: "PostgreSQL Advanced Features: JSONB & Full-Text Search",
        description:
          "Store and query semi-structured data using JSONB columns with GIN indexes; configure basic full-text search.",
        status: "NOT_STARTED",
      },
    ],
    practicalActivities: [
      "Design an entity-relationship schema for an e-commerce platform and generate DDL migrations.",
      "Write analytical window functions to calculate running totals and top-selling categories.",
      "Analyze a slow query with EXPLAIN ANALYZE and add a composite index to reduce execution time.",
      "Query a JSONB column using the -> and ->> operators and verify GIN index acceleration.",
    ],
    miniProject: {
      title: "Optimized Multi-Tenant Analytics Database",
      description:
        "Create a relational database schema supporting user accounts, audit logging with JSONB metadata, and high-performance indexed queries.",
      demonstrates:
        "Demonstrates foreign key integrity, index optimization with EXPLAIN, transaction safety, and JSONB integration.",
    },
    completionCriteria: [
      "DDL migrations execute cleanly with foreign key constraints enforced.",
      "Queries run with index scans instead of full sequential scans on large datasets.",
      "Transactions maintain consistency without partial writes or unhandled concurrency conflicts.",
    ],
  },

  python: {
    difficulty: "BEGINNER",
    estimatedDuration: "2-3 weeks",
    learningObjective:
      "Master modern Python programming paradigms including object-oriented patterns, data structures, and standard libraries.",
    learningSteps: [
      {
        stepIndex: 1,
        title: "Python Syntax, Data Structures & Control Flow",
        description:
          "Master lists, tuples, dictionaries, sets, list comprehensions, and control flow structures.",
        status: "NOT_STARTED",
      },
      {
        stepIndex: 2,
        title: "Functions, Scope & Functional Patterns",
        description:
          "Write modular functions, understand *args/**kwargs, lambda expressions, decorators, and generator functions.",
        status: "NOT_STARTED",
      },
      {
        stepIndex: 3,
        title: "Object-Oriented Programming (OOP) in Python",
        description:
          "Create classes, implement encapsulation, inheritance, polymorphism, and dunder methods (__init__, __str__, __repr__).",
        status: "NOT_STARTED",
      },
      {
        stepIndex: 4,
        title: "File I/O, Error Handling & Virtual Environments",
        description:
          "Use context managers (with statement), structured try/except/finally blocks, and manage environments with venv/pip.",
        status: "NOT_STARTED",
      },
      {
        stepIndex: 5,
        title: "Testing, Type Hints & Packaging",
        description:
          "Add type annotations (typing module), write unit tests with pytest, and structure code into importable packages.",
        status: "NOT_STARTED",
      },
    ],
    practicalActivities: [
      "Write a command-line utility that parses JSON log files and generates a summary report.",
      "Create custom Python decorators to measure execution time and log function invocations.",
      "Build a custom class implementing iterator and context manager protocols.",
      "Write a suite of unit tests with pytest testing edge cases and exceptions.",
    ],
    miniProject: {
      title: "Automated Data Processing & Validation CLI",
      description:
        "Build a command-line data processing pipeline that reads multi-format input data, validates records against schemas, and outputs formatted metrics.",
      demonstrates:
        "Demonstrates OOP classes, custom generators, exception handling, and automated pytest coverage.",
    },
    completionCriteria: [
      "Code adheres to PEP 8 styling conventions with explicit type annotations.",
      "All unit tests pass with pytest covering both valid inputs and error conditions.",
      "Virtual environment reproduces dependencies cleanly using requirements.txt.",
    ],
  },
};

/**
 * Generic dynamic generator that builds a practical, sensible 5-stage learning path
 * for any technology or skill not in the curated dictionary.
 */
function generateGenericLearningPath(skillName, requirementType, isPartial, relatedSkill, targetJobTitle) {
  const isReq = requirementType === "REQUIRED";
  const skillTitle = skillName.charAt(0).toUpperCase() + skillName.slice(1);
  const contextRole = targetJobTitle ? `for roles such as ${targetJobTitle}` : "for professional development";

  const objective = isPartial && relatedSkill
    ? `Build upon existing ${relatedSkill} background to acquire hands-on proficiency in ${skillTitle} ${contextRole}.`
    : `Acquire practical, production-ready proficiency in ${skillTitle} ${contextRole}.`;

  const duration = isPartial ? "1-2 weeks" : isReq ? "2-3 weeks" : "1-2 weeks";
  const difficulty = isPartial ? "INTERMEDIATE" : isReq ? "INTERMEDIATE" : "BEGINNER";

  const steps = [
    {
      stepIndex: 1,
      title: `${skillTitle} Core Concepts & Fundamentals`,
      description: isPartial && relatedSkill
        ? `Review ${skillTitle} architecture and identify key similarities and differences compared to your existing ${relatedSkill} knowledge.`
        : `Understand the core architecture, installation, development environment setup, and fundamental concepts of ${skillTitle}.`,
      status: "NOT_STARTED",
    },
    {
      stepIndex: 2,
      title: "Key Syntax, Patterns & Idiomatic Usage",
      description: `Learn the primary syntax, standard patterns, configurations, and core features of ${skillTitle}.`,
      status: "NOT_STARTED",
    },
    {
      stepIndex: 3,
      title: "Practical Application & Hands-On Exercises",
      description: `Implement small standalone components or scripts to practice essential ${skillTitle} workflows and API methods.`,
      status: "NOT_STARTED",
    },
    {
      stepIndex: 4,
      title: "Integration with Real-World Project Workflows",
      description: `Integrate ${skillTitle} into a representative project workflow, handling configuration, error conditions, and dependencies.`,
      status: "NOT_STARTED",
    },
    {
      stepIndex: 5,
      title: "Testing, Optimization & Verification",
      description: `Review code quality, implement tests or validations, and verify that the implementation meets industry best practices.`,
      status: "NOT_STARTED",
    },
  ];

  const activities = [
    `Set up a local development environment and run a verified hello-world application using ${skillTitle}.`,
    `Build a practical coding exercise applying 3 or more key features of ${skillTitle}.`,
    isPartial && relatedSkill
      ? `Compare and document 3 practical differences between ${relatedSkill} and ${skillTitle} in real scenarios.`
      : `Implement error handling and edge case validation for a standard ${skillTitle} task.`,
    `Review official documentation and write sample code demonstrating typical production use cases.`,
  ];

  const miniProject = {
    title: `${skillTitle} Integration Project`,
    description: `Build a small, focused project incorporating ${skillTitle} into a practical application demonstrating key requirements of ${targetJobTitle || "the target role"}.`,
    demonstrates: `Demonstrates configuration, core syntax, error handling, and practical implementation of ${skillTitle}.`,
  };

  const criteria = [
    `Project runs reliably without unhandled errors or syntax failures.`,
    `Demonstrates clean separation of concerns and adherence to standard ${skillTitle} conventions.`,
    `Able to explain key architectural decisions and trade-offs when applying ${skillTitle}.`,
  ];

  return {
    difficulty,
    estimatedDuration: duration,
    learningObjective: objective,
    learningSteps: steps,
    practicalActivities: activities,
    miniProject,
    completionCriteria: criteria,
  };
}

class SkillRoadmapService {
  /**
   * Main service entry point: Generates or retrieves a personalized skill gap roadmap.
   *
   * @param {number} resumeId
   * @param {number} jobId
   * @param {number} userId
   * @param {Object} [options]
   * @param {boolean} [options.forceFallback] - Force deterministic fallback without invoking AI
   * @returns {Promise<Object>} Full roadmap payload
   */
  static async generateRoadmap(resumeId, jobId, userId, options = {}) {
    if (!resumeId || !jobId || !userId) {
      const err = new Error("Resume ID, Job Description ID, and User ID are required.");
      err.status = 400;
      throw err;
    }

    const parsedResumeId = Number(resumeId);
    const parsedJobId = Number(jobId);
    const parsedUserId = Number(userId);

    if (Number.isNaN(parsedResumeId) || Number.isNaN(parsedJobId) || Number.isNaN(parsedUserId)) {
      const err = new Error("Resume ID, Job Description ID, and User ID must be valid numbers.");
      err.status = 400;
      throw err;
    }

    // 1. Verify existence & ownership
    const [resumes] = await db.query(
      `SELECT id, original_filename, processing_status, extracted_text FROM resumes WHERE id = ? AND user_id = ? LIMIT 1`,
      [parsedResumeId, parsedUserId]
    );
    if (!resumes || resumes.length === 0) {
      const err = new Error("Resume not found or access denied.");
      err.status = 404;
      throw err;
    }

    const [jobs] = await db.query(
      `SELECT id, title, company, description, processing_status FROM jobs WHERE id = ? AND user_id = ? LIMIT 1`,
      [parsedJobId, parsedUserId]
    );
    if (!jobs || jobs.length === 0) {
      const err = new Error("Job description not found or access denied.");
      err.status = 404;
      throw err;
    }

    const resumeRecord = resumes[0];
    const jobRecord = jobs[0];

    // 2. Obtain candidate resume skills
    const [rawResumeSkills] = await db.query(
      `SELECT s.id, s.name, s.category, rs.proficiency, rs.evidence
       FROM resume_skills rs
       JOIN skills s ON rs.skill_id = s.id
       WHERE rs.resume_id = ?
       ORDER BY s.category ASC, s.name ASC`,
      [parsedResumeId]
    );

    // 3. Obtain or run Day 20 Skill Matching
    let matchingResults = await SkillMatchingService.getSavedMatching(parsedResumeId, parsedJobId, parsedUserId);
    if (!matchingResults) {
      matchingResults = await SkillMatchingService.runMatching(parsedResumeId, parsedJobId, parsedUserId, options);
    }

    // 4. Obtain or calculate Day 21 Match Scores
    let scoreData = await MatchScoreService.getSavedMatchScore(parsedResumeId, parsedJobId, parsedUserId);
    if (!scoreData) {
      scoreData = await MatchScoreService.calculateMatchScore(parsedResumeId, parsedJobId, parsedUserId, options);
    }

    // 5. Find or create analysis record
    let analysisId = null;
    const [existingAnalyses] = await db.query(
      `SELECT id FROM analyses WHERE user_id = ? AND resume_id = ? AND job_id = ? ORDER BY id DESC LIMIT 1`,
      [parsedUserId, parsedResumeId, parsedJobId]
    );
    if (existingAnalyses && existingAnalyses.length > 0) {
      analysisId = existingAnalyses[0].id;
    } else {
      // Create minimal analysis record if none existed
      const [insertResult] = await db.query(
        `INSERT INTO analyses (user_id, resume_id, job_id, overall_score, status) VALUES (?, ?, ?, ?, 'COMPLETED')`,
        [parsedUserId, parsedResumeId, parsedJobId, scoreData?.overall?.score || 0]
      );
      analysisId = insertResult.insertId;
    }

    // 6. Read any existing roadmap_items to preserve user's learning progress
    const existingItemsMap = new Map();
    if (analysisId) {
      const [existingItems] = await db.query(
        `SELECT id, skill_id, title, description, step_order, difficulty, status, estimated_duration
         FROM roadmap_items
         WHERE analysis_id = ?`,
        [analysisId]
      );
      if (existingItems && existingItems.length > 0) {
        for (const item of existingItems) {
          existingItemsMap.set(item.title.toLowerCase().trim(), item);
        }
      }
    }

    // 7. Structure Current Skills section
    const currentSkills = this.formatCurrentSkills(rawResumeSkills || [], matchingResults?.results || []);

    // 8. Structure Missing & Partial Skills
    const missingAndPartial = this.formatMissingAndPartialSkills(matchingResults?.results || []);

    // 9. Prioritize skills using Priority Skills Engine
    const prioritizedSkills = this.prioritizeSkills({
      missingAndPartialSkills: matchingResults?.results?.filter(
        (r) => r.category === "MISSING" || r.category === "PARTIAL_MATCH"
      ) || [],
      candidateSkills: rawResumeSkills || [],
      jobTitle: jobRecord.title,
    });

    // 10. Generate personalized learning paths for prioritized skills
    const roadmapItems = await this.buildRoadmapWithLearningPaths({
      prioritizedSkills,
      candidateSkills: rawResumeSkills || [],
      jobTitle: jobRecord.title,
      existingItemsMap,
      options,
    });

    // 11. Persist roadmap items to MySQL `roadmap_items` table atomically
    if (analysisId && roadmapItems.length > 0) {
      await this.persistRoadmapItems(analysisId, roadmapItems);
    }

    // 12. Calculate overall roadmap completion progress
    const totalItems = roadmapItems.length;
    const completedItems = roadmapItems.filter((i) => i.status === "COMPLETED").length;
    const inProgressItems = roadmapItems.filter((i) => i.status === "IN_PROGRESS").length;
    const completionPercentage = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 100;

    // 13. Construct explainable learning sequence rationale
    const sequenceRationale = this.generateSequenceRationale(roadmapItems);

    const warnings = [
      ...(matchingResults.matchingMetadata?.warnings || []),
      ...(scoreData.metadata?.warnings || []),
    ];

    if (rawResumeSkills.length === 0) {
      warnings.push("Candidate resume contains no extracted technical skills.");
    }

    return {
      overview: {
        analysisId,
        resumeId: parsedResumeId,
        jobId: parsedJobId,
        jobTitle: jobRecord.title,
        company: jobRecord.company || null,
        resumeFilename: resumeRecord.original_filename,
        overallScore: scoreData?.overall?.score ?? null,
        overallStatus: scoreData?.overall?.status || "AVAILABLE",
        currentSkillsCount: currentSkills.totalCount,
        missingSkillsCount: missingAndPartial.totalMissingCount,
        partialSkillsCount: missingAndPartial.partial.length,
        prioritySkillsCount: roadmapItems.length,
        completionPercentage,
        completedItemsCount: completedItems,
        inProgressItemsCount: inProgressItems,
        algorithmVersion: ROADMAP_ALGORITHM_VERSION,
        generatedAt: new Date().toISOString(),
      },
      currentSkills,
      missingSkills: missingAndPartial,
      roadmap: roadmapItems,
      learningSequenceRationale: sequenceRationale,
      warnings,
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // CURRENT SKILLS FORMATTER
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Formats the user's actual resume skills, grouped by category,
   * indicating matches with job requirements and user's strengths.
   */
  static formatCurrentSkills(resumeSkills = [], matchResults = []) {
    // Map job matched skills for quick lookup
    const strongMap = new Map();
    const partialMap = new Map();

    for (const res of matchResults) {
      if (res.category === "STRONG_MATCH") {
        strongMap.set((res.matchedSkill || res.jobSkill).toLowerCase().trim(), res);
        strongMap.set((res.normalizedSkill || "").toLowerCase().trim(), res);
      } else if (res.category === "PARTIAL_MATCH") {
        partialMap.set((res.matchedSkill || res.jobSkill).toLowerCase().trim(), res);
      }
    }

    const categoriesMap = {};
    let matchedCount = 0;

    for (const skill of resumeSkills) {
      const rawName = skill.name || "";
      const lower = rawName.toLowerCase().trim();
      const norm = normalizeSkillName(rawName);
      const normKey = norm ? norm.normalizedName : lower;
      const category = (skill.category || norm?.category || "OTHER").toUpperCase();

      const strongMatch = strongMap.get(lower) || strongMap.get(normKey);
      const partialMatch = partialMap.get(lower) || partialMap.get(normKey);

      const matchesJob = Boolean(strongMatch || partialMatch);
      if (matchesJob) matchedCount++;

      const skillObj = {
        id: skill.id,
        name: rawName,
        category,
        proficiency: skill.proficiency && skill.proficiency !== "UNKNOWN" ? skill.proficiency : null,
        evidence: skill.evidence || null,
        matchesJob,
        matchingStatus: strongMatch ? "STRONG_MATCH" : partialMatch ? "PARTIAL_MATCH" : "NOT_SPECIFIED_IN_JOB",
        matchedJobRequirement: strongMatch?.jobSkill || partialMatch?.jobSkill || null,
        requirementType: strongMatch?.requirementType || partialMatch?.requirementType || null,
        isStrength: Boolean(strongMatch && (strongMatch.requirementType === "REQUIRED" || skill.evidence)),
      };

      if (!categoriesMap[category]) {
        categoriesMap[category] = [];
      }
      categoriesMap[category].push(skillObj);
    }

    // Sort categories deterministically
    const grouped = Object.keys(categoriesMap)
      .sort()
      .map((cat) => ({
        category: cat,
        count: categoriesMap[cat].length,
        skills: categoriesMap[cat],
      }));

    return {
      totalCount: resumeSkills.length,
      matchedWithJobCount: matchedCount,
      groups: grouped,
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // MISSING & PARTIAL SKILLS FORMATTER
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Separates missing required, missing preferred, and partial match skills.
   */
  static formatMissingAndPartialSkills(matchResults = []) {
    const missingRequired = [];
    const missingPreferred = [];
    const partialMatches = [];

    for (const item of matchResults) {
      if (item.category === "STRONG_MATCH") {
        continue;
      }

      if (item.category === "PARTIAL_MATCH") {
        partialMatches.push({
          skillName: item.jobSkill,
          normalizedSkill: item.normalizedSkill,
          requirementType: item.requirementType,
          matchingStatus: "PARTIAL_MATCH",
          relatedResumeSkill: item.matchedSkill,
          reason: `Partial match: The candidate demonstrates background in related technology (${item.matchedSkill}), but full proficiency in ${item.jobSkill} is not directly evidenced.`,
          evidence: item.resumeEvidence || [],
          jobRequirement: item.jobSkill,
          priority: item.priority || "MEDIUM",
        });
      } else if (item.category === "MISSING") {
        const isReq = item.requirementType === "REQUIRED";
        const entry = {
          skillName: item.jobSkill,
          normalizedSkill: item.normalizedSkill,
          requirementType: item.requirementType,
          matchingStatus: "MISSING",
          relatedResumeSkill: null,
          reason: isReq
            ? `Required skill: Specified as a core requirement for this role, but not evidenced in the candidate resume.`
            : `Preferred skill: Listed as a preferred qualification for this role, but not evidenced in the candidate resume.`,
          evidence: [],
          jobRequirement: item.jobSkill,
          priority: item.priority || (isReq ? "HIGH" : "MEDIUM"),
        };

        if (isReq) {
          missingRequired.push(entry);
        } else {
          missingPreferred.push(entry);
        }
      }
    }

    return {
      totalMissingCount: missingRequired.length + missingPreferred.length,
      required: missingRequired,
      preferred: missingPreferred,
      partial: partialMatches,
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // PRIORITY SKILLS ENGINE
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Evaluates missing and partial skills to determine which should be learned first.
   * Priority levels:
   *  Priority 1 — High priority
   *  Priority 2 — Medium priority
   *  Priority 3 — Lower priority
   *
   * @param {Object} params
   * @param {Array<Object>} params.missingAndPartialSkills
   * @param {Array<Object>} params.candidateSkills
   * @param {string} params.jobTitle
   * @returns {Array<Object>} Ordered, prioritized skills
   */
  static prioritizeSkills({ missingAndPartialSkills = [], candidateSkills = [], jobTitle = "" }) {
    if (!missingAndPartialSkills || missingAndPartialSkills.length === 0) {
      return [];
    }

    // 1. Build fast candidate skill lookup
    const candidateNormSet = new Set();
    for (const s of candidateSkills) {
      const raw = s.name || "";
      candidateNormSet.add(raw.toLowerCase().trim());
      const norm = normalizeSkillName(raw);
      if (norm) candidateNormSet.add(norm.normalizedName);
    }

    // 2. Deduplicate missing and partial skills to prevent duplicate roadmap items
    const uniqueSkillsMap = new Map();
    for (const item of missingAndPartialSkills) {
      const rawName = item.jobSkill || item.name || "";
      const lower = rawName.toLowerCase().trim();
      const norm = normalizeSkillName(rawName);
      const normKey = norm ? norm.normalizedName : lower;

      // Do NOT include skills candidate already strongly matches
      if (item.category === "STRONG_MATCH") {
        continue;
      }

      if (!uniqueSkillsMap.has(normKey)) {
        uniqueSkillsMap.set(normKey, {
          rawName,
          normalizedName: normKey,
          category: item.category,
          requirementType: item.requirementType || "REQUIRED",
          priority: item.priority || (item.requirementType === "REQUIRED" ? "HIGH" : "MEDIUM"),
          matchedSkill: item.matchedSkill || null,
          explanation: item.explanation || "",
        });
      }
    }

    const targetList = Array.from(uniqueSkillsMap.values());
    const targetKeysSet = new Set(targetList.map((t) => t.normalizedName));

    // 3. Score and evaluate each skill
    const evaluated = targetList.map((skill) => {
      let score = 0;
      const reasons = [];

      const isRequired = skill.requirementType === "REQUIRED";
      const isPreferred = skill.requirementType === "PREFERRED";
      const isPartial = skill.category === "PARTIAL_MATCH";
      const jobPriority = (skill.priority || (isRequired ? "HIGH" : "MEDIUM")).toUpperCase();

      // Base weight from Requirement Type + Job Priority
      if (isRequired) {
        if (jobPriority === "HIGH") {
          score += 90;
          reasons.push("Core required skill with High job priority");
        } else if (jobPriority === "MEDIUM") {
          score += 80;
          reasons.push("Required skill with Medium job priority");
        } else {
          score += 70;
          reasons.push("Required skill with Low job priority");
        }
      } else if (isPreferred) {
        if (jobPriority === "HIGH") {
          score += 60;
          reasons.push("Preferred qualification with High job importance");
        } else if (jobPriority === "MEDIUM") {
          score += 50;
          reasons.push("Preferred qualification for the role");
        } else {
          score += 40;
          reasons.push("Secondary preferred skill");
        }
      } else {
        score += 55;
        reasons.push("Specified job requirement");
      }

      // Check Prerequisite Relationships
      const prereqDef = KNOWN_PREREQUISITES[skill.normalizedName];
      let dependsOnMissing = null;
      let hasPrerequisiteInResume = false;

      if (prereqDef) {
        const prereqKey = prereqDef.prereq.toLowerCase().trim();
        // Check if candidate already has the prerequisite in resume
        if (candidateNormSet.has(prereqKey)) {
          hasPrerequisiteInResume = true;
          score += 5; // Boost: Candidate already has prerequisite, ready to adopt!
          reasons.push(`Candidate already possesses prerequisite (${prereqDef.prereq}), enabling rapid adoption`);
        } else if (targetKeysSet.has(prereqKey)) {
          // Prerequisite is ALSO missing and in roadmap
          dependsOnMissing = prereqKey;
          // Must learn prerequisite first: cap score so prerequisite ranks higher
          score -= 15;
          reasons.push(`Recommended to learn after foundational ${prereqDef.prereq} concepts`);
        }
      }

      // Check if this skill is a prerequisite for OTHER skills in the target roadmap
      const dependentSkills = [];
      for (const other of targetList) {
        if (other.normalizedName !== skill.normalizedName) {
          const otherPrereq = KNOWN_PREREQUISITES[other.normalizedName];
          if (otherPrereq && otherPrereq.prereq === skill.normalizedName) {
            dependentSkills.push(other.rawName);
          }
        }
      }

      if (dependentSkills.length > 0) {
        score += 20; // High foundational boost!
        reasons.push(`Foundational prerequisite for ${dependentSkills.join(", ")}`);
      }

      // Partial Match evaluation: candidate has adjacent/transferable experience
      if (isPartial) {
        score += 5;
        reasons.push(
          `Candidate demonstrates transferable foundation in ${skill.matchedSkill || "related technology"}, making this a high-ROI quick win`
        );
      }

      // Assign Priority Level
      let priorityLevel = 2;
      let priorityLabel = "Priority 2 — Medium Priority";

      if (score >= 80) {
        priorityLevel = 1;
        priorityLabel = "Priority 1 — High Priority";
      } else if (score >= 60) {
        priorityLevel = 2;
        priorityLabel = "Priority 2 — Medium Priority";
      } else {
        priorityLevel = 3;
        priorityLabel = "Priority 3 — Lower Priority";
      }

      const priorityReason = reasons.join(". ") + ".";

      return {
        ...skill,
        score,
        priorityLevel,
        priorityLabel,
        priorityReason,
        dependsOnMissing,
        hasPrerequisiteInResume,
        isFoundational: dependentSkills.length > 0,
        dependentSkills,
      };
    });

    // 4. Sort deterministically:
    //    a. Priority level (1 first, then 2, then 3)
    //    b. Prerequisite before dependent
    //    c. Score DESC
    //    d. Alphabetical by normalizedName ASC
    evaluated.sort((a, b) => {
      if (a.priorityLevel !== b.priorityLevel) {
        return a.priorityLevel - b.priorityLevel;
      }

      // Prerequisite should come before its dependent
      if (a.dependsOnMissing === b.normalizedName) return 1;
      if (b.dependsOnMissing === a.normalizedName) return -1;

      if (b.score !== a.score) {
        return b.score - a.score;
      }

      return a.normalizedName.localeCompare(b.normalizedName);
    });

    return evaluated;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // PERSONALIZED LEARNING PATH GENERATION
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Generates or adapts learning paths for prioritized skills.
   * Leverages curated paths, AI (when available/configured), and deterministic generators.
   */
  static async buildRoadmapWithLearningPaths({
    prioritizedSkills = [],
    candidateSkills = [],
    jobTitle = "",
    existingItemsMap = new Map(),
    options = {},
  }) {
    const roadmapItems = [];

    for (let index = 0; index < prioritizedSkills.length; index++) {
      const item = prioritizedSkills[index];
      const stepOrder = index + 1;
      const key = item.normalizedName;

      // Check if user already had progress on this item
      const existing = existingItemsMap.get(key) || existingItemsMap.get(item.rawName.toLowerCase().trim());
      let parsedExistingDesc = null;
      if (existing && existing.description) {
        try {
          parsedExistingDesc = JSON.parse(existing.description);
        } catch {
          // ignore parsing error
        }
      }

      // Generate learning path:
      // 1. Check curated paths
      // 2. If AI is configured and not forced fallback, attempt AI personalization
      // 3. Fallback to generic structured generator
      let learningPath = null;

      if (CURATED_LEARNING_PATHS[key]) {
        learningPath = JSON.parse(JSON.stringify(CURATED_LEARNING_PATHS[key]));
      } else {
        // Attempt AI generation if configured
        const aiConfig = validateAiConfig();
        const canUseAi = aiConfig.valid && options.forceFallback !== true;

        if (canUseAi) {
          try {
            learningPath = await this.generateAiLearningPath({
              skillName: item.rawName,
              requirementType: item.requirementType,
              matchingStatus: item.category,
              jobTitle,
              relatedSkill: item.matchedSkill,
            });
          } catch (aiErr) {
            console.warn(`[SkillRoadmapService] AI path generation skipped: ${aiErr.message}`);
          }
        }

        // Deterministic generic fallback if AI was not used or failed
        if (!learningPath) {
          learningPath = generateGenericLearningPath(
            item.rawName,
            item.requirementType,
            item.category === "PARTIAL_MATCH",
            item.matchedSkill,
            jobTitle
          );
        }
      }

      // Preserve existing user step statuses if user previously made progress
      if (parsedExistingDesc?.learningSteps && Array.isArray(parsedExistingDesc.learningSteps)) {
        const stepStatusMap = new Map();
        for (const s of parsedExistingDesc.learningSteps) {
          if (s.stepIndex && s.status) {
            stepStatusMap.set(s.stepIndex, s.status);
          }
        }

        learningPath.learningSteps = learningPath.learningSteps.map((step) => {
          const savedStatus = stepStatusMap.get(step.stepIndex);
          return {
            ...step,
            explanation: step.explanation || step.description,
            learningObjective: step.learningObjective || step.description,
            practicalActivity: step.practicalActivity || (learningPath.practicalActivities && learningPath.practicalActivities[step.stepIndex - 1]) || "Hands-on practice task.",
            status: savedStatus || step.status || "NOT_STARTED",
          };
        });
      } else if (Array.isArray(learningPath.learningSteps)) {
        learningPath.learningSteps = learningPath.learningSteps.map((step) => ({
          ...step,
          explanation: step.explanation || step.description,
          learningObjective: step.learningObjective || step.description,
          practicalActivity: step.practicalActivity || (learningPath.practicalActivities && learningPath.practicalActivities[step.stepIndex - 1]) || "Hands-on practice task.",
          status: step.status || "NOT_STARTED",
        }));
      }

      // Preserve overall status
      const initialStatus = existing?.status || "NOT_STARTED";
      const priorityStr = item.priorityLevel === 1 ? "HIGH" : item.priorityLevel === 3 ? "LOW" : "MEDIUM";

      // Build consolidated description object for database and frontend
      const descriptionPayload = {
        priorityLevel: item.priorityLevel,
        priorityLevelStr: priorityStr,
        priorityLabel: item.priorityLabel,
        priorityReason: item.priorityReason,
        requirementType: item.requirementType,
        matchingStatus: item.category,
        relatedJobRequirement: item.rawName,
        relatedResumeSkill: item.matchedSkill || null,
        prerequisites: item.dependsOnMissing ? [item.dependsOnMissing] : [],
        isFoundational: item.isFoundational,
        learningObjective: learningPath.learningObjective,
        recommendedTopics: learningPath.recommendedTopics || [],
        learningSteps: learningPath.learningSteps,
        practicalActivities: learningPath.practicalActivities,
        practicalExercises: learningPath.practicalActivities || [],
        miniProject: learningPath.miniProject,
        completionCriteria: learningPath.completionCriteria,
        expectedOutcomes: learningPath.completionCriteria || [],
      };

      roadmapItems.push({
        id: existing?.id || null,
        stepOrder,
        title: item.rawName,
        normalizedTitle: item.normalizedName,
        difficulty: learningPath.difficulty || "INTERMEDIATE",
        estimatedDuration: learningPath.estimatedDuration || "2 weeks",
        status: initialStatus,
        priorityLevel: item.priorityLevel,
        priorityLevelStr: priorityStr,
        priorityLabel: item.priorityLabel,
        priorityReason: item.priorityReason,
        requirementType: item.requirementType,
        matchingStatus: item.category,
        relatedJobRequirement: item.rawName,
        relatedResumeSkill: item.matchedSkill || null,
        prerequisites: item.dependsOnMissing ? [item.dependsOnMissing] : [],
        learningObjective: learningPath.learningObjective,
        recommendedTopics: learningPath.recommendedTopics || [],
        learningSteps: learningPath.learningSteps,
        practicalActivities: learningPath.practicalActivities,
        practicalExercises: learningPath.practicalActivities || [],
        miniProject: learningPath.miniProject,
        completionCriteria: learningPath.completionCriteria,
        expectedOutcomes: learningPath.completionCriteria || [],
        descriptionPayload,
      });
    }

    return roadmapItems;
  }

  /**
   * Generates a tailored learning path using OpenAI with prompt injection defense
   * and strict JSON output validation.
   */
  static async generateAiLearningPath({ skillName, requirementType, matchingStatus, jobTitle, relatedSkill }) {
    const prompt = `Generate a structured, practical learning path for developing the following technical skill:
Skill Name: "${skillName}"
Requirement Type: "${requirementType}"
Matching Status: "${matchingStatus}"
Related Experience: "${relatedSkill || "None"}"
Target Role: "${jobTitle || "Software Engineer"}"

Output ONLY valid JSON conforming to the following schema:
{
  "difficulty": "BEGINNER" | "INTERMEDIATE" | "ADVANCED",
  "estimatedDuration": "X weeks",
  "learningObjective": "Clear statement of what candidate will master",
  "learningSteps": [
    { "stepIndex": 1, "title": "...", "description": "...", "status": "NOT_STARTED" },
    { "stepIndex": 2, "title": "...", "description": "...", "status": "NOT_STARTED" },
    { "stepIndex": 3, "title": "...", "description": "...", "status": "NOT_STARTED" },
    { "stepIndex": 4, "title": "...", "description": "...", "status": "NOT_STARTED" },
    { "stepIndex": 5, "title": "...", "description": "...", "status": "NOT_STARTED" }
  ],
  "practicalActivities": ["Exercise 1", "Exercise 2", "Exercise 3"],
  "miniProject": {
    "title": "Project Name",
    "description": "What to build",
    "demonstrates": "Key skills demonstrated"
  },
  "completionCriteria": ["Measurable criteria 1", "Measurable criteria 2"]
}

CRITICAL RULES:
1. Do NOT include fake URLs, certification claims, or external course provider advertisements.
2. Ensure activities are realistic, hands-on, and relevant to the target role.
3. Keep the JSON strictly parseable without markdown formatting outside the JSON block.`;

    const systemPrompt = `You are the SkillLens AI Learning Roadmap Engine.
You generate honest, practical, and structured learning paths tailored to technical job requirements.
Output only valid JSON conforming strictly to the requested schema.`;

    const response = await generateText({
      prompt,
      systemPrompt,
      temperature: 0.2,
      maxTokens: 1000,
      timeoutMs: 15000,
    });

    const parsed = this.parseAndValidateAiOutput(response.text);
    return parsed;
  }

  /**
   * Strictly validates AI response structure to prevent hallucinated or broken shapes.
   */
  static parseAndValidateAiOutput(rawText) {
    if (!rawText || typeof rawText !== "string") {
      throw new Error("Empty AI response text");
    }

    let jsonStr = rawText.trim();
    if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
    }

    const data = JSON.parse(jsonStr);

    if (!data.learningObjective || typeof data.learningObjective !== "string") {
      throw new Error("Missing learningObjective in AI response");
    }
    if (!Array.isArray(data.learningSteps) || data.learningSteps.length < 2) {
      throw new Error("Invalid or insufficient learningSteps in AI response");
    }
    if (!Array.isArray(data.practicalActivities) || data.practicalActivities.length === 0) {
      throw new Error("Missing practicalActivities in AI response");
    }
    if (!data.miniProject || !data.miniProject.title || !data.miniProject.description) {
      throw new Error("Missing miniProject in AI response");
    }
    if (!Array.isArray(data.completionCriteria) || data.completionCriteria.length === 0) {
      throw new Error("Missing completionCriteria in AI response");
    }

    // Sanitize any accidental hallucinated URLs
    const urlPattern = /https?:\/\/[^\s]+/gi;
    data.learningObjective = data.learningObjective.replace(urlPattern, "[reference topic]");
    data.practicalActivities = data.practicalActivities.map((a) => a.replace(urlPattern, "[reference topic]"));
    data.completionCriteria = data.completionCriteria.map((c) => c.replace(urlPattern, "[reference topic]"));

    return {
      difficulty: ["BEGINNER", "INTERMEDIATE", "ADVANCED"].includes(data.difficulty)
        ? data.difficulty
        : "INTERMEDIATE",
      estimatedDuration: data.estimatedDuration || "2 weeks",
      learningObjective: data.learningObjective,
      learningSteps: data.learningSteps.map((s, idx) => ({
        stepIndex: idx + 1,
        title: s.title || `Stage ${idx + 1}`,
        description: s.description || "",
        status: "NOT_STARTED",
      })),
      practicalActivities: data.practicalActivities,
      miniProject: data.miniProject,
      completionCriteria: data.completionCriteria,
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // DATABASE PERSISTENCE & RETRIEVAL
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Persists roadmap items into MySQL `roadmap_items` table.
   * If items already exist for this analysis, updates them or replaces cleanly
   * while maintaining database referential integrity.
   */
  static async persistRoadmapItems(analysisId, roadmapItems = []) {
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      // Look up skill IDs from `skills` catalogue
      const skillNames = roadmapItems.map((item) => item.title);
      const skillIdMap = new Map();

      if (skillNames.length > 0) {
        const [rows] = await connection.query(
          `SELECT id, name FROM skills WHERE name IN (?)`,
          [skillNames]
        );
        for (const row of rows) {
          skillIdMap.set(row.name.toLowerCase().trim(), row.id);
        }
      }

      // Check existing roadmap items for this analysis
      const [existingRows] = await connection.query(
        `SELECT id, title, status FROM roadmap_items WHERE analysis_id = ?`,
        [analysisId]
      );
      const existingByTitle = new Map();
      for (const row of existingRows) {
        existingByTitle.set(row.title.toLowerCase().trim(), row);
      }

      for (const item of roadmapItems) {
        const titleKey = item.title.toLowerCase().trim();
        const existing = existingByTitle.get(titleKey);
        const skillId = skillIdMap.get(titleKey) || null;
        const jsonDesc = JSON.stringify(item.descriptionPayload || {});

        if (existing) {
          // Update existing record, preserving user's status
          await connection.query(
            `UPDATE roadmap_items
             SET skill_id = ?, description = ?, step_order = ?, difficulty = ?,
                 estimated_duration = ?, updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
            [
              skillId,
              jsonDesc,
              item.stepOrder,
              item.difficulty,
              item.estimatedDuration,
              existing.id,
            ]
          );
          item.id = existing.id;
        } else {
          // Insert new record
          const [ins] = await connection.query(
            `INSERT INTO roadmap_items
             (analysis_id, skill_id, title, description, step_order, difficulty, status, estimated_duration)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              analysisId,
              skillId,
              item.title,
              jsonDesc,
              item.stepOrder,
              item.difficulty,
              item.status || "NOT_STARTED",
              item.estimatedDuration,
            ]
          );
          item.id = ins.insertId;
        }
      }

      await connection.commit();
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  }

  /**
   * Retrieves saved roadmap by resumeId, jobId, and userId.
   */
  static async getSavedRoadmap(resumeId, jobId, userId) {
    const parsedResumeId = Number(resumeId);
    const parsedJobId = Number(jobId);
    const parsedUserId = Number(userId);

    // Verify ownership
    const [resumes] = await db.query(
      `SELECT id, original_filename FROM resumes WHERE id = ? AND user_id = ? LIMIT 1`,
      [parsedResumeId, parsedUserId]
    );
    if (!resumes || resumes.length === 0) return null;

    const [jobs] = await db.query(
      `SELECT id, title, company FROM jobs WHERE id = ? AND user_id = ? LIMIT 1`,
      [parsedJobId, parsedUserId]
    );
    if (!jobs || jobs.length === 0) return null;

    const [analyses] = await db.query(
      `SELECT id, overall_score, status, completed_at, created_at
       FROM analyses
       WHERE user_id = ? AND resume_id = ? AND job_id = ?
       ORDER BY id DESC LIMIT 1`,
      [parsedUserId, parsedResumeId, parsedJobId]
    );
    if (!analyses || analyses.length === 0) return null;

    const analysis = analyses[0];

    // Retrieve saved roadmap_items
    const [rows] = await db.query(
      `SELECT id, analysis_id, skill_id, title, description, step_order, difficulty, status, estimated_duration, created_at, updated_at
       FROM roadmap_items
       WHERE analysis_id = ?
       ORDER BY step_order ASC`,
      [analysis.id]
    );

    if (!rows || rows.length === 0) {
      // If no roadmap items persisted yet, return null so caller can generate
      return null;
    }

    // Retrieve resume skills
    const [rawResumeSkills] = await db.query(
      `SELECT s.id, s.name, s.category, rs.proficiency, rs.evidence
       FROM resume_skills rs
       JOIN skills s ON rs.skill_id = s.id
       WHERE rs.resume_id = ?`,
      [parsedResumeId]
    );

    // Retrieve saved matching results
    const matchingResults = await SkillMatchingService.getSavedMatching(parsedResumeId, parsedJobId, parsedUserId);

    const currentSkills = this.formatCurrentSkills(rawResumeSkills || [], matchingResults?.results || []);
    const missingAndPartial = this.formatMissingAndPartialSkills(matchingResults?.results || []);

    const roadmapItems = rows.map((row) => {
      let descObj = {};
      try {
        descObj = JSON.parse(row.description);
      } catch {
        descObj = { learningObjective: row.description };
      }

      return {
        id: row.id,
        analysisId: row.analysis_id,
        skillId: row.skill_id,
        stepOrder: row.step_order,
        title: row.title,
        difficulty: row.difficulty,
        status: row.status,
        estimatedDuration: row.estimated_duration,
        priorityLevel: descObj.priorityLevel || 2,
        priorityLabel: descObj.priorityLabel || `Priority ${descObj.priorityLevel || 2}`,
        priorityReason: descObj.priorityReason || "",
        requirementType: descObj.requirementType || "REQUIRED",
        matchingStatus: descObj.matchingStatus || "MISSING",
        relatedJobRequirement: descObj.relatedJobRequirement || row.title,
        relatedResumeSkill: descObj.relatedResumeSkill || null,
        prerequisites: descObj.prerequisites || [],
        learningObjective: descObj.learningObjective || "",
        learningSteps: descObj.learningSteps || [],
        practicalActivities: descObj.practicalActivities || [],
        miniProject: descObj.miniProject || null,
        completionCriteria: descObj.completionCriteria || [],
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    });

    const totalItems = roadmapItems.length;
    const completedItems = roadmapItems.filter((i) => i.status === "COMPLETED").length;
    const inProgressItems = roadmapItems.filter((i) => i.status === "IN_PROGRESS").length;
    const completionPercentage = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 100;

    return {
      overview: {
        analysisId: analysis.id,
        resumeId: parsedResumeId,
        jobId: parsedJobId,
        jobTitle: jobs[0].title,
        company: jobs[0].company || null,
        resumeFilename: resumes[0].original_filename,
        overallScore: analysis.overall_score ?? null,
        overallStatus: "AVAILABLE",
        currentSkillsCount: currentSkills.totalCount,
        missingSkillsCount: missingAndPartial.totalMissingCount,
        partialSkillsCount: missingAndPartial.partial.length,
        prioritySkillsCount: roadmapItems.length,
        completionPercentage,
        completedItemsCount: completedItems,
        inProgressItemsCount: inProgressItems,
        algorithmVersion: ROADMAP_ALGORITHM_VERSION,
        retrievedAt: new Date().toISOString(),
      },
      currentSkills,
      missingSkills: missingAndPartial,
      roadmap: roadmapItems,
      learningSequenceRationale: this.generateSequenceRationale(roadmapItems),
      warnings: [],
    };
  }

  /**
   * Updates the progress status of a roadmap item or individual learning step.
   * Enforces user ownership via analyses.user_id check.
   *
   * @param {number} itemId - roadmap_items.id
   * @param {number} userId - authenticated user id
   * @param {Object} updateData - { status, stepIndex, stepStatus }
   * @returns {Promise<Object>} Updated roadmap item
   */
  static async updateItemStatus(itemId, userId, updateData = {}) {
    const parsedItemId = Number(itemId);
    const parsedUserId = Number(userId);

    if (!parsedItemId || !parsedUserId) {
      const err = new Error("Valid itemId and userId are required.");
      err.status = 400;
      throw err;
    }

    // Verify ownership
    const [rows] = await db.query(
      `SELECT ri.id, ri.analysis_id, ri.title, ri.description, ri.status, ri.step_order, a.user_id
       FROM roadmap_items ri
       JOIN analyses a ON ri.analysis_id = a.id
       WHERE ri.id = ? AND a.user_id = ?
       LIMIT 1`,
      [parsedItemId, parsedUserId]
    );

    if (!rows || rows.length === 0) {
      const err = new Error("Roadmap item not found or access denied.");
      err.status = 404;
      throw err;
    }

    const item = rows[0];
    let descObj = {};
    try {
      descObj = JSON.parse(item.description);
    } catch {
      descObj = {};
    }

    const validStatuses = ["NOT_STARTED", "IN_PROGRESS", "COMPLETED"];
    let newStatus = item.status;

    // 1. Update individual step status if specified
    if (updateData.stepIndex !== undefined && updateData.stepStatus) {
      const stepIdx = Number(updateData.stepIndex);
      const stepStat = updateData.stepStatus.toUpperCase();

      if (!validStatuses.includes(stepStat)) {
        const err = new Error(`Invalid stepStatus. Allowed: ${validStatuses.join(", ")}`);
        err.status = 400;
        throw err;
      }

      if (Array.isArray(descObj.learningSteps)) {
        const targetStep = descObj.learningSteps.find((s) => s.stepIndex === stepIdx);
        if (targetStep) {
          targetStep.status = stepStat;
        }

        // Auto-evaluate overall item status based on steps if not explicitly overridden
        const allCompleted = descObj.learningSteps.every((s) => s.status === "COMPLETED");
        const anyActive = descObj.learningSteps.some((s) => s.status === "IN_PROGRESS" || s.status === "COMPLETED");

        if (allCompleted) {
          newStatus = "COMPLETED";
        } else if (anyActive && item.status === "NOT_STARTED") {
          newStatus = "IN_PROGRESS";
        }
      }
    }

    // 2. Explicit item status override if provided
    if (updateData.status) {
      const upperStatus = updateData.status.toUpperCase();
      if (!validStatuses.includes(upperStatus)) {
        const err = new Error(`Invalid status. Allowed: ${validStatuses.join(", ")}`);
        err.status = 400;
        throw err;
      }
      newStatus = upperStatus;

      // If user marks the entire item as COMPLETED, also mark all steps completed
      if (newStatus === "COMPLETED" && Array.isArray(descObj.learningSteps)) {
        descObj.learningSteps = descObj.learningSteps.map((s) => ({ ...s, status: "COMPLETED" }));
      } else if (newStatus === "NOT_STARTED" && Array.isArray(descObj.learningSteps)) {
        descObj.learningSteps = descObj.learningSteps.map((s) => ({ ...s, status: "NOT_STARTED" }));
      }
    }

    // Persist updates
    const updatedDescStr = JSON.stringify(descObj);
    await db.query(
      `UPDATE roadmap_items
       SET status = ?, description = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [newStatus, updatedDescStr, parsedItemId]
    );

    return {
      id: parsedItemId,
      title: item.title,
      status: newStatus,
      stepOrder: item.step_order,
      learningSteps: descObj.learningSteps || [],
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * Resets all roadmap items for an analysis back to NOT_STARTED.
   */
  static async resetRoadmapProgress(analysisId, userId) {
    const parsedAnalysisId = Number(analysisId);
    const parsedUserId = Number(userId);

    const [analyses] = await db.query(
      `SELECT id FROM analyses WHERE id = ? AND user_id = ? LIMIT 1`,
      [parsedAnalysisId, parsedUserId]
    );
    if (!analyses || analyses.length === 0) {
      const err = new Error("Analysis not found or access denied.");
      err.status = 404;
      throw err;
    }

    const [items] = await db.query(
      `SELECT id, description FROM roadmap_items WHERE analysis_id = ?`,
      [parsedAnalysisId]
    );

    for (const item of items) {
      let desc = {};
      try {
        desc = JSON.parse(item.description);
      } catch {
        desc = {};
      }
      if (Array.isArray(desc.learningSteps)) {
        desc.learningSteps = desc.learningSteps.map((s) => ({ ...s, status: "NOT_STARTED" }));
      }

      await db.query(
        `UPDATE roadmap_items
         SET status = 'NOT_STARTED', description = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [JSON.stringify(desc), item.id]
      );
    }

    return { success: true, message: "Roadmap progress reset successfully." };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // SEQUENCE RATIONALE GENERATOR
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Generates a clear explanation of why skills were placed in this recommended order.
   */
  static generateSequenceRationale(roadmapItems = []) {
    if (!roadmapItems || roadmapItems.length === 0) {
      return "No skill gaps were identified for this role. Your resume strongly demonstrates the required skills.";
    }

    const p1Count = roadmapItems.filter((i) => i.priorityLevel === 1).length;
    const p2Count = roadmapItems.filter((i) => i.priorityLevel === 2).length;
    const p3Count = roadmapItems.filter((i) => i.priorityLevel === 3).length;

    const sections = [];

    sections.push(
      `The learning roadmap is organized into ${roadmapItems.length} prioritized step${roadmapItems.length === 1 ? "" : "s"} designed to maximize your hiring readiness:`
    );

    if (p1Count > 0) {
      sections.push(
        `• Priority 1 (High): ${p1Count} foundational or core required skill${p1Count === 1 ? "" : "s"} that represent critical job blockers. Address these first.`
      );
    }
    if (p2Count > 0) {
      sections.push(
        `• Priority 2 (Medium): ${p2Count} secondary required or high-impact partial skill${p2Count === 1 ? "" : "s"}. These build directly on your existing strengths or foundational skills.`
      );
    }
    if (p3Count > 0) {
      sections.push(
        `• Priority 3 (Lower): ${p3Count} preferred or specialized skill${p3Count === 1 ? "" : "s"} to develop once core competencies are solid.`
      );
    }

    // Specific prerequisite callouts
    const prereqPairs = [];
    for (const item of roadmapItems) {
      if (item.prerequisites && item.prerequisites.length > 0) {
        prereqPairs.push(`${item.title} is sequenced after ${item.prerequisites.join(", ")}`);
      }
    }

    if (prereqPairs.length > 0) {
      sections.push(`Prerequisite ordering: ${prereqPairs.join("; ")}.`);
    }

    return sections.join("\n");
  }
}

module.exports = SkillRoadmapService;

