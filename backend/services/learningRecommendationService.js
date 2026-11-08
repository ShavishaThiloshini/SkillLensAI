/**
 * SkillLens AI — Learning Recommendation Service
 * Day 28: Personalized Skill Gap Learning Recommendations Engine
 *
 * Provides tailored, explainable, and practical learning recommendations for every
 * missing or partially matched skill identified in the candidate's resume-to-job analysis:
 * 1. Identifies missing required, missing preferred, and partially matched skills.
 * 2. Explains why each skill matters for the selected job (grounded in job requirements & resume evidence).
 * 3. Classifies priority into HIGH, MEDIUM, and LOW tiers with explainable rationale.
 * 4. Generates structured learning recommendations:
 *    - Recommended topics
 *    - Step-by-step learning stages (title, explanation, learning objective, practical activity)
 *    - Practical exercises
 *    - Mini-project (title, description, demonstration goal, expected outcome)
 *    - Measurable completion criteria / expected learning outcomes
 * 5. Integrates directly with Day 26 Roadmap:
 *    - Reuses the priority order and roadmap_items persistence
 *    - Preserves user learning progress (NOT_STARTED, IN_PROGRESS, COMPLETED)
 * 6. Never recommends strongly matched skills (unless genuine improvement need).
 * 7. Leverages Day 18 AI service with strict JSON validation and robust deterministic fallback.
 *
 * Adheres strictly to docs/PRD.md, docs/TRD.md, docs/APP_FLOW.md, and docs/DATABASE_SCHEMA.md.
 */

const db = require("../config/db");
const { normalizeSkillName } = require("../utils/skillNormalizer");
const SkillMatchingService = require("./skillMatchingService");
const MatchScoreService = require("./matchScoreService");
const SkillRoadmapService = require("./skillRoadmapService");
const { generateText, validateAiConfig } = require("./aiService");

const RECOMMENDATION_ALGORITHM_VERSION = "1.0";

/**
 * Conservative, verified foundational prerequisite relationships.
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
    rationale: "Next.js is a full-stack framework built on React; React components, hooks, and lifecycle are foundational.",
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
 * Curated, verified recommendation knowledge base for core technologies.
 * Each entry provides rich, practical learning content without hallucinated or external fake URLs.
 */
const CURATED_RECOMMENDATIONS = {
  docker: {
    difficulty: "INTERMEDIATE",
    estimatedDuration: "2 weeks",
    recommendedTopics: [
      "Containerization fundamentals vs virtual machines",
      "Docker images, layers, and container lifecycles",
      "Dockerfile authoring, multi-stage builds, and non-root security",
      "Docker CLI commands (run, ps, exec, logs, system prune)",
      "Docker bridge networks and named volume persistence",
      "Multi-container service orchestration with Docker Compose",
    ],
    learningSteps: [
      {
        stepIndex: 1,
        title: "Containerization Fundamentals & Docker CLI",
        explanation: "Understand container isolation, image registries, and foundational Docker CLI workflows.",
        learningObjective: "Run and inspect standalone containers locally using core CLI commands.",
        practicalActivity: "Install Docker, pull an Alpine Linux image, run an interactive shell container, and inspect running processes.",
        status: "NOT_STARTED",
      },
      {
        stepIndex: 2,
        title: "Authoring Dockerfiles & Image Layering",
        explanation: "Write production-ready Dockerfiles using FROM, WORKDIR, COPY, RUN, CMD, and EXPOSE.",
        learningObjective: "Package an application into a reproducible container image with layer caching.",
        practicalActivity: "Author a Dockerfile for a simple web service, build the image, and verify layer cache efficiency.",
        status: "NOT_STARTED",
      },
      {
        stepIndex: 3,
        title: "Multi-Stage Builds & Security Best Practices",
        explanation: "Separate build-time dependencies from runtime artifacts to produce minimal, secure production images.",
        learningObjective: "Create lean production images running under a non-root user account.",
        practicalActivity: "Convert a single-stage build into a multi-stage build, measure size reduction, and configure USER node/app.",
        status: "NOT_STARTED",
      },
      {
        stepIndex: 4,
        title: "Networking & Volume Persistence",
        explanation: "Configure user-defined bridge networks for service discovery and persistent named volumes.",
        learningObjective: "Connect independent containers securely and persist state across container recreation.",
        practicalActivity: "Connect an application container to a database container on a private bridge network with a persistent volume.",
        status: "NOT_STARTED",
      },
      {
        stepIndex: 5,
        title: "Multi-Container Orchestration with Docker Compose",
        explanation: "Define multi-service environments, environment variables, dependencies, and healthchecks in docker-compose.yml.",
        learningObjective: "Boot and manage an entire multi-service application stack with a single command.",
        practicalActivity: "Write a docker-compose.yml file linking an API, PostgreSQL database, and cache service with healthchecks.",
        status: "NOT_STARTED",
      },
    ],
    practicalExercises: [
      "Install Docker Desktop or Docker Engine and run 'docker run --rm hello-world'.",
      "Containerize an existing application using a multi-stage Dockerfile.",
      "Execute interactive commands inside a running container using 'docker exec -it'.",
      "Deploy a multi-service development stack using 'docker compose up -d' and verify data persistence.",
    ],
    miniProject: {
      title: "Production-Grade Containerized Web Service",
      description: "Containerize a full-stack web application with an API backend, relational database, and reverse proxy using Docker Compose with environment variables and healthchecks.",
      demonstrates: "Demonstrates multi-stage builds, non-root user security, volume persistence, and declarative multi-container orchestration.",
      expectedOutcome: "A reproducible container stack that starts cleanly with a single command and persists database state across restarts.",
    },
    expectedOutcomes: [
      "Able to write multi-stage Dockerfiles that build minimal, secure production container images.",
      "Able to orchestrate multi-container services with health checks and volume persistence using Docker Compose.",
      "Can diagnose and resolve common container startup, networking, and permission issues using Docker CLI.",
    ],
  },

  typescript: {
    difficulty: "INTERMEDIATE",
    estimatedDuration: "2-3 weeks",
    recommendedTopics: [
      "TypeScript static type system & tsconfig compiler options",
      "Primitive types, type inference, and union/intersection types",
      "Interfaces, type aliases, and object modeling",
      "Generic functions, generic interfaces, and reusable constraints",
      "Built-in utility types (Partial, Required, Pick, Omit, Record)",
      "Advanced type narrowing, discriminated unions, and strict mode",
    ],
    learningSteps: [
      {
        stepIndex: 1,
        title: "TypeScript Core Types & Compiler Configuration",
        explanation: "Configure tsconfig.json with strict mode, understand primitive types, type annotations, and inference.",
        learningObjective: "Set up a clean TypeScript project and compile type-checked JavaScript output.",
        practicalActivity: "Initialize a TypeScript sandbox, configure strict compiler flags, and write typed functions.",
        status: "NOT_STARTED",
      },
      {
        stepIndex: 2,
        title: "Interfaces, Type Aliases & Object Modeling",
        explanation: "Model complex domain data using interfaces, type aliases, optional properties, and index signatures.",
        learningObjective: "Accurately model domain entities with compile-time type safety.",
        practicalActivity: "Refactor a plain JavaScript data model into strongly typed interfaces with optional and readonly properties.",
        status: "NOT_STARTED",
      },
      {
        stepIndex: 3,
        title: "Functions, Generics & Utility Types",
        explanation: "Write generic functions with type parameters and utilize built-in utility types (Partial, Pick, Omit, Record).",
        learningObjective: "Author flexible, reusable functions and data structures without resorting to 'any'.",
        practicalActivity: "Implement a generic PaginatedResult<T> helper and a typed API response wrapper.",
        status: "NOT_STARTED",
      },
      {
        stepIndex: 4,
        title: "Discriminated Unions & Advanced Type Guards",
        explanation: "Model multi-state workflows using discriminated union types and custom type guard functions.",
        learningObjective: "Eliminate runtime type errors through exhaustive compile-time pattern matching.",
        practicalActivity: "Write a state machine for an asynchronous HTTP request (Idle, Loading, Success, Error) using discriminated unions.",
        status: "NOT_STARTED",
      },
      {
        stepIndex: 5,
        title: "Integration with Frameworks & Build Tools",
        explanation: "Integrate TypeScript into modern React/Node applications with typed props, event handlers, and API schemas.",
        learningObjective: "Deliver production code in a modern framework with zero type errors and clean IDE intellisense.",
        practicalActivity: "Convert a React component with complex state and props into strict TypeScript.",
        status: "NOT_STARTED",
      },
    ],
    practicalExercises: [
      "Configure a tsconfig.json with 'strict: true' and 'noImplicitAny: true'.",
      "Convert a plain JavaScript utility module with 5+ functions into typed TypeScript.",
      "Implement custom type guards using the 'is' keyword.",
      "Model a complex payment processing state machine using discriminated unions.",
    ],
    miniProject: {
      title: "Type-Safe Task Management Service",
      description: "Build an API service or CLI that manages tasks, priorities, and audit histories with complete type safety, custom generic validators, and zero runtime type errors.",
      demonstrates: "Demonstrates interfaces, generic functions, discriminated unions, and strict compiler enforcement.",
      expectedOutcome: "Codebase compiles with strict settings with zero type errors, no 'any' types, and comprehensive domain types.",
    },
    expectedOutcomes: [
      "Can explain the difference between interfaces and type aliases and apply each appropriately.",
      "Able to write generic functions and utilize built-in utility types effectively in real code.",
      "Successfully delivers production applications with strict compiler compliance and zero 'any' escapes.",
    ],
  },

  aws: {
    difficulty: "INTERMEDIATE",
    estimatedDuration: "3-4 weeks",
    recommendedTopics: [
      "Cloud architecture principles and the AWS Shared Responsibility Model",
      "AWS Identity and Access Management (IAM) users, roles, and least-privilege policies",
      "Object storage, bucket policies, and lifecycle management with Amazon S3",
      "Compute fundamentals: Amazon EC2 virtual machines and AWS Lambda serverless functions",
      "Managed databases: Amazon RDS relational databases and DynamoDB NoSQL basics",
      "Observability and cost guardrails: Amazon CloudWatch metrics, alarms, and AWS Budgets",
    ],
    learningSteps: [
      {
        stepIndex: 1,
        title: "Cloud Concepts & AWS IAM Security",
        explanation: "Learn cloud deployment models, shared responsibility, IAM users, groups, roles, and least-privilege policies.",
        learningObjective: "Configure secure cloud identities and programmatic access without root user credentials.",
        practicalActivity: "Create an IAM user with programmatic access and an IAM role with least-privilege S3 read permissions.",
        status: "NOT_STARTED",
      },
      {
        stepIndex: 2,
        title: "Object Storage & Static Assets with Amazon S3",
        explanation: "Create and configure S3 buckets, understand lifecycle policies, encryption, and bucket policies.",
        learningObjective: "Store and manage file assets securely in the cloud with access controls.",
        practicalActivity: "Create an S3 bucket with server-side encryption and upload/retrieve assets via AWS SDK.",
        status: "NOT_STARTED",
      },
      {
        stepIndex: 3,
        title: "Compute Fundamentals: EC2 & Serverless Lambda",
        explanation: "Launch EC2 instances with security groups; build and deploy basic serverless functions using AWS Lambda.",
        learningObjective: "Deploy backend application logic on both virtual machines and serverless compute.",
        practicalActivity: "Author and deploy an AWS Lambda function triggered by an HTTP API Gateway endpoint.",
        status: "NOT_STARTED",
      },
      {
        stepIndex: 4,
        title: "Managed Relational Databases with Amazon RDS",
        explanation: "Deploy a managed PostgreSQL or MySQL database on Amazon RDS, understanding subnets and security rules.",
        learningObjective: "Connect applications to managed cloud databases with automated backups and failover.",
        practicalActivity: "Launch a PostgreSQL RDS instance in a VPC and connect from a local client using security group rules.",
        status: "NOT_STARTED",
      },
      {
        stepIndex: 5,
        title: "Observability, Logging & Cloud Cost Control",
        explanation: "Set up Amazon CloudWatch alarms, review application logs, and configure AWS billing budget alerts.",
        learningObjective: "Monitor cloud application health and protect against unexpected cloud resource costs.",
        practicalActivity: "Configure a CloudWatch billing alarm and query application logs in CloudWatch Logs Insights.",
        status: "NOT_STARTED",
      },
    ],
    practicalExercises: [
      "Create an IAM user and configure local AWS CLI credentials securely.",
      "Upload and serve assets from a private S3 bucket using pre-signed URLs.",
      "Deploy a serverless AWS Lambda function that processes an event payload and logs to CloudWatch.",
      "Configure an AWS Budget alert with an email notification at 80% threshold.",
    ],
    miniProject: {
      title: "Serverless Document Processing Pipeline",
      description: "Build a serverless pipeline where uploading a file to an S3 bucket triggers an AWS Lambda function that parses metadata and stores the record in a database with CloudWatch logging.",
      demonstrates: "Demonstrates IAM security roles, S3 event triggers, serverless execution, and cloud observability.",
      expectedOutcome: "A working serverless workflow that automatically processes file uploads and logs metrics.",
    },
    expectedOutcomes: [
      "Can configure and deploy AWS resources using security best practices (no root access, least-privilege IAM).",
      "Successfully invoke and debug Lambda functions via CloudWatch logs.",
      "Able to explain architectural trade-offs between serverless (Lambda) and server-based (EC2/ECS) compute.",
    ],
  },

  kubernetes: {
    difficulty: "ADVANCED",
    estimatedDuration: "3-4 weeks",
    recommendedTopics: [
      "Kubernetes cluster architecture: control plane, kubelet, and worker nodes",
      "Declarative YAML manifests for Pods, Deployments, and ReplicaSets",
      "Cluster networking: ClusterIP, NodePort, LoadBalancer, and Ingress controllers",
      "Decoupled configuration and storage: ConfigMaps, Secrets, and PersistentVolumeClaims",
      "Application resilience: Liveness/Readiness probes, resource limits, and Horizontal Pod Autoscaling (HPA)",
    ],
    learningSteps: [
      {
        stepIndex: 1,
        title: "Kubernetes Architecture & Core Concepts",
        explanation: "Understand control plane components (api-server, etcd, scheduler) vs worker node kubelet/container runtime.",
        learningObjective: "Understand how Kubernetes maintains desired state across a distributed cluster.",
        practicalActivity: "Start a local cluster with Minikube or Kind and inspect cluster node status with kubectl.",
        status: "NOT_STARTED",
      },
      {
        stepIndex: 2,
        title: "Deployments, Pods & ReplicaSets",
        explanation: "Write declarative YAML manifests for Deployments, understand desired state, and execute rolling updates.",
        learningObjective: "Deploy scalable containerized applications with automated rolling updates and rollbacks.",
        practicalActivity: "Deploy a 3-replica web deployment manifest and execute a zero-downtime rolling update.",
        status: "NOT_STARTED",
      },
      {
        stepIndex: 3,
        title: "Services & Cluster Networking",
        explanation: "Expose applications using ClusterIP, NodePort, and LoadBalancer services; understand Ingress routing.",
        learningObjective: "Route internal and external network traffic to dynamic pod replicas reliably.",
        practicalActivity: "Create a ClusterIP service to expose backend pods and configure an Ingress rule for host routing.",
        status: "NOT_STARTED",
      },
      {
        stepIndex: 4,
        title: "ConfigMaps, Secrets & Volume Storage",
        explanation: "Inject configuration and sensitive credentials cleanly into pods; mount persistent storage.",
        learningObjective: "Decouple application configuration from container images and persist stateful data.",
        practicalActivity: "Mount a ConfigMap as environment variables and a Secret as a volume in an application pod.",
        status: "NOT_STARTED",
      },
      {
        stepIndex: 5,
        title: "Self-Healing Probes & Resource Management",
        explanation: "Configure HTTP/TCP liveness and readiness probes, compute requests/limits, and horizontal pod autoscalers.",
        learningObjective: "Ensure application self-healing and prevent runaway resource consumption.",
        practicalActivity: "Add readiness and liveness HTTP probes and simulate application recovery after forced failures.",
        status: "NOT_STARTED",
      },
    ],
    practicalExercises: [
      "Set up a local development cluster using Minikube or Kind.",
      "Author declarative YAML manifests for a Deployment, Service, and ConfigMap.",
      "Execute kubectl commands to scale replicas up and down dynamically.",
      "Inspect pod logs and execute interactive debugging shells with 'kubectl exec'.",
    ],
    miniProject: {
      title: "Resilient Microservice Deployment on Kubernetes",
      description: "Deploy a multi-tier web application with multiple replicas, health checks, ConfigMaps, and an Ingress route on a local cluster.",
      demonstrates: "Demonstrates declarative YAML authoring, zero-downtime deployments, self-healing probes, and cluster networking.",
      expectedOutcome: "A stable Kubernetes deployment that handles rolling updates and recovers automatically from pod termination.",
    },
    expectedOutcomes: [
      "Can manage cluster workloads fluently using kubectl commands and declarative manifests.",
      "All manifests apply cleanly with 'kubectl apply -f' without manual pod interventions.",
      "Application recovers automatically when individual pods fail or are restarted.",
    ],
  },

  react: {
    difficulty: "INTERMEDIATE",
    estimatedDuration: "2-3 weeks",
    recommendedTopics: [
      "Modern functional components, JSX syntax, and props composition",
      "Immutable state management with useState and complex state with useReducer",
      "Side effects and lifecycle synchronization with useEffect",
      "Custom hooks authoring and global state sharing with Context API",
      "Performance optimization with useMemo, useCallback, and React.memo",
    ],
    learningSteps: [
      {
        stepIndex: 1,
        title: "Components, JSX & Props Architecture",
        explanation: "Master JSX syntax, pure component design, props passing, and conditional rendering patterns.",
        learningObjective: "Build reusable, modular UI components following single-responsibility principles.",
        practicalActivity: "Build a reusable Card and Button component system with configurable props and variants.",
        status: "NOT_STARTED",
      },
      {
        stepIndex: 2,
        title: "State Management with useState & useReducer",
        explanation: "Manage component state immutably, handle complex forms, and implement reducer patterns for multi-step flows.",
        learningObjective: "Manage predictable, immutable state transitions across multi-step UI interactions.",
        practicalActivity: "Build an interactive multi-step form with input validation and useReducer.",
        status: "NOT_STARTED",
      },
      {
        stepIndex: 3,
        title: "Side Effects & the Component Lifecycle with useEffect",
        explanation: "Handle API data fetching, cleanup subscriptions, avoid infinite re-render loops, and understand dependency arrays.",
        learningObjective: "Synchronize components with external APIs and cleanup resources reliably.",
        practicalActivity: "Implement an asynchronous data-fetching component with loading, error, and abort controller cleanup.",
        status: "NOT_STARTED",
      },
      {
        stepIndex: 4,
        title: "Custom Hooks & Context API",
        explanation: "Extract reusable stateful logic into custom hooks; share global state (auth, theme) cleanly with Context.",
        learningObjective: "Eliminate prop-drilling and package shared logic into clean reusable hooks.",
        practicalActivity: "Build a custom useDebounce hook and an AuthContext provider managing authentication state.",
        status: "NOT_STARTED",
      },
      {
        stepIndex: 5,
        title: "Performance Optimization & Component Testing",
        explanation: "Apply useMemo, useCallback, and React.memo where appropriate; write unit tests for key user interactions.",
        learningObjective: "Profile and eliminate unnecessary re-renders in complex component trees.",
        practicalActivity: "Profile an interactive dashboard with React DevTools and memoize expensive filter computations.",
        status: "NOT_STARTED",
      },
    ],
    practicalExercises: [
      "Refactor a prop-drilling component hierarchy using React Context.",
      "Build a custom hook with request cancellation support using AbortController.",
      "Implement an accessible, controlled form with real-time field validation.",
      "Profile component rendering with React DevTools and optimize unnecessary renders.",
    ],
    miniProject: {
      title: "Interactive Analytics Dashboard",
      description: "Build a responsive dashboard with search, category filtering, pagination, and modal dialogs using custom hooks and Context.",
      demonstrates: "Demonstrates functional components, hooks composition, immutable state management, and responsive layout.",
      expectedOutcome: "A fully responsive React dashboard with smooth filtering, zero re-render lag, and clean modular code.",
    },
    expectedOutcomes: [
      "Application renders cleanly with zero console warnings or key errors.",
      "State flows predictably without mutation or race conditions in asynchronous effects.",
      "Demonstrates modular component separation following Single Responsibility Principle.",
    ],
  },

  "node.js": {
    difficulty: "INTERMEDIATE",
    estimatedDuration: "2-3 weeks",
    recommendedTopics: [
      "Node.js architecture: asynchronous non-blocking event loop and thread pool",
      "Core modules: fs/promises, streams, buffers, and event emitters",
      "Building modular RESTful APIs and request routing",
      "Asynchronous error handling middleware and request input validation",
      "Database connection pooling, transactions, and graceful process shutdowns",
    ],
    learningSteps: [
      {
        stepIndex: 1,
        title: "Node.js Architecture & Asynchronous Event Loop",
        explanation: "Understand the non-blocking event loop, microtask vs macrotask queues, and ES Modules vs CommonJS.",
        learningObjective: "Write asynchronous server code that maximizes throughput without blocking the event loop.",
        practicalActivity: "Write asynchronous scripts exploring setTimeout, process.nextTick, and Promise resolution ordering.",
        status: "NOT_STARTED",
      },
      {
        stepIndex: 2,
        title: "Core Modules: Streams, Buffers & File System",
        explanation: "Work with fs/promises, readable/writable streams, buffers, and event emitters for high-throughput processing.",
        learningObjective: "Process large data payloads efficiently with streaming pipelines and minimal memory usage.",
        practicalActivity: "Build a file streaming script that processes a large text file line-by-line using pipeline and zlib.",
        status: "NOT_STARTED",
      },
      {
        stepIndex: 3,
        title: "HTTP Servers & RESTful Routing",
        explanation: "Build modular HTTP APIs, implement request routing, parsing, headers, and status code handling.",
        learningObjective: "Design and implement standards-compliant RESTful API endpoints.",
        practicalActivity: "Build a modular REST API handling CRUD resources with parameterized URLs and query parameters.",
        status: "NOT_STARTED",
      },
      {
        stepIndex: 4,
        title: "Centralized Error Handling & Validation",
        explanation: "Implement centralized error middleware, async/await error boundaries, and robust request input validation.",
        learningObjective: "Prevent server crashes and return consistent, sanitized error responses to clients.",
        practicalActivity: "Write custom error classes (BadRequestError, NotFoundError) and centralized Express error middleware.",
        status: "NOT_STARTED",
      },
      {
        stepIndex: 5,
        title: "Database Integration & Graceful Shutdown",
        explanation: "Connect to databases using connection pooling, handle transactions, and manage environment configurations.",
        learningObjective: "Manage production database connections reliably and handle termination signals cleanly.",
        practicalActivity: "Set up a database connection pool and write SIGTERM/SIGINT handlers to close connections gracefully.",
        status: "NOT_STARTED",
      },
    ],
    practicalExercises: [
      "Build a file streaming script that processes large CSV files line-by-line with minimal memory usage.",
      "Implement a custom EventEmitter for pub/sub messaging inside a service.",
      "Write a centralized error handler catching unhandled promise rejections cleanly.",
      "Set up database connection pooling with graceful shutdown handlers.",
    ],
    miniProject: {
      title: "Production REST API with Authentication & Validation",
      description: "Build a modular REST API with JWT authentication, input validation middleware, rate limiting, and database connection pooling.",
      demonstrates: "Demonstrates asynchronous pipeline design, middleware architecture, error handling, and secure database access.",
      expectedOutcome: "A secure, resilient REST API with automated validation, robust error responses, and graceful process management.",
    },
    expectedOutcomes: [
      "Handles concurrent asynchronous requests without blocking the event loop.",
      "All API endpoints validate inputs and return consistent error response payloads.",
      "Server shuts down gracefully on SIGTERM/SIGINT, closing active database connections.",
    ],
  },

  postgresql: {
    difficulty: "INTERMEDIATE",
    estimatedDuration: "2 weeks",
    recommendedTopics: [
      "Relational schema design, foreign key integrity, and normalization (3NF)",
      "Advanced SQL querying: multi-table JOINs, subqueries, and window functions",
      "Indexing strategies: B-Tree, GIN, composite indexes, and EXPLAIN ANALYZE",
      "ACID transactions, locking mechanisms, and transaction isolation levels",
      "PostgreSQL advanced features: JSONB semi-structured queries and full-text search",
    ],
    learningSteps: [
      {
        stepIndex: 1,
        title: "Relational Schema Design & Normalization",
        explanation: "Design normalized relational tables (3NF), define primary/foreign keys, check constraints, and CASCADE rules.",
        learningObjective: "Design relational database schemas that enforce referential integrity and eliminate redundancy.",
        practicalActivity: "Design an entity-relationship schema for an order processing system and generate DDL migrations.",
        status: "NOT_STARTED",
      },
      {
        stepIndex: 2,
        title: "Complex Querying & Analytical Aggregations",
        explanation: "Master multi-table JOINs, subqueries, GROUP BY aggregations, and window functions (ROW_NUMBER, RANK).",
        learningObjective: "Author high-performance analytical queries to extract structured business metrics.",
        practicalActivity: "Write window functions to calculate running totals, category rankings, and month-over-month growth.",
        status: "NOT_STARTED",
      },
      {
        stepIndex: 3,
        title: "Indexing Strategies & Query Optimization",
        explanation: "Understand B-tree, GIN, and GiST indexes; analyze queries using EXPLAIN ANALYZE to identify sequential scans.",
        learningObjective: "Diagnose and optimize slow SQL queries using proper index strategies.",
        practicalActivity: "Analyze a slow query with EXPLAIN ANALYZE and add a composite index to reduce execution time.",
        status: "NOT_STARTED",
      },
      {
        stepIndex: 4,
        title: "Transactions, Isolation Levels & Concurrency",
        explanation: "Execute ACID transactions with BEGIN/COMMIT/ROLLBACK, handle deadlocks, and choose appropriate isolation levels.",
        learningObjective: "Ensure data consistency during concurrent updates and prevent partial write corruptions.",
        practicalActivity: "Write a transactional account transfer script with row-level locking (SELECT FOR UPDATE) to prevent race conditions.",
        status: "NOT_STARTED",
      },
      {
        stepIndex: 5,
        title: "PostgreSQL Advanced Features: JSONB & Indexing",
        explanation: "Store and query semi-structured data using JSONB columns with GIN indexes; configure basic full-text search.",
        learningObjective: "Leverage PostgreSQL hybrid relational and document database features effectively.",
        practicalActivity: "Query a JSONB column using the -> and ->> operators and verify GIN index acceleration.",
        status: "NOT_STARTED",
      },
    ],
    practicalExercises: [
      "Design an entity-relationship schema for an e-commerce platform and generate DDL migrations.",
      "Write analytical window functions to calculate running totals and top-selling categories.",
      "Analyze a slow query with EXPLAIN ANALYZE and add a composite index to reduce execution time.",
      "Query a JSONB column using the -> and ->> operators and verify GIN index acceleration.",
    ],
    miniProject: {
      title: "Optimized Multi-Tenant Analytics Database",
      description: "Create a relational database schema supporting user accounts, audit logging with JSONB metadata, and high-performance indexed queries.",
      demonstrates: "Demonstrates foreign key integrity, index optimization with EXPLAIN, transaction safety, and JSONB integration.",
      expectedOutcome: "A robust relational schema that runs queries under 5ms using index scans and maintains ACID consistency.",
    },
    expectedOutcomes: [
      "DDL migrations execute cleanly with foreign key constraints enforced.",
      "Queries run with index scans instead of full sequential scans on large datasets.",
      "Transactions maintain consistency without partial writes or unhandled concurrency conflicts.",
    ],
  },

  python: {
    difficulty: "BEGINNER",
    estimatedDuration: "2-3 weeks",
    recommendedTopics: [
      "Python 3 syntax, data structures (lists, dicts, sets, tuples), and list comprehensions",
      "Functions, variable scope, *args/**kwargs, and custom decorators",
      "Object-oriented programming (OOP): classes, inheritance, and dunder methods",
      "Context managers (with statements), structured exception handling, and virtual environments (venv)",
      "Automated testing with pytest and static typing with type hints (typing module)",
    ],
    learningSteps: [
      {
        stepIndex: 1,
        title: "Python Syntax, Data Structures & Control Flow",
        explanation: "Master lists, tuples, dictionaries, sets, list comprehensions, and control flow structures.",
        learningObjective: "Write clean, idiomatic Python code utilizing built-in data structures effectively.",
        practicalActivity: "Write scripts manipulating complex nested dictionary and list data structures with comprehensions.",
        status: "NOT_STARTED",
      },
      {
        stepIndex: 2,
        title: "Modular Functions, Scope & Decorators",
        explanation: "Write modular functions, understand *args/**kwargs, lambda expressions, and custom decorators.",
        learningObjective: "Author modular, reusable functions and apply decorator patterns for cross-cutting concerns.",
        practicalActivity: "Create a custom Python decorator that logs execution time and function arguments.",
        status: "NOT_STARTED",
      },
      {
        stepIndex: 3,
        title: "Object-Oriented Programming (OOP) in Python",
        explanation: "Create classes, implement encapsulation, inheritance, polymorphism, and dunder methods (__init__, __str__, __repr__).",
        learningObjective: "Model real-world systems using clean object-oriented Python classes.",
        practicalActivity: "Build an object-oriented inventory system with custom class methods and dunder operator overloading.",
        status: "NOT_STARTED",
      },
      {
        stepIndex: 4,
        title: "File I/O, Error Handling & Virtual Environments",
        explanation: "Use context managers (with statement), structured try/except/finally blocks, and manage environments with venv/pip.",
        learningObjective: "Handle external files and errors safely while isolating dependencies cleanly.",
        practicalActivity: "Write a safe file parsing utility with custom exception handling and virtual environment isolation.",
        status: "NOT_STARTED",
      },
      {
        stepIndex: 5,
        title: "Testing, Type Hints & Packaging",
        explanation: "Add type annotations (typing module), write unit tests with pytest, and structure code into importable packages.",
        learningObjective: "Deliver well-tested, type-annotated Python packages adhering to PEP 8 standards.",
        practicalActivity: "Write a suite of unit tests with pytest testing edge cases, exceptions, and fixture setup.",
        status: "NOT_STARTED",
      },
    ],
    practicalExercises: [
      "Write a command-line utility that parses JSON log files and generates a summary report.",
      "Create custom Python decorators to measure execution time and log function invocations.",
      "Build a custom class implementing iterator and context manager protocols.",
      "Write a suite of unit tests with pytest testing edge cases and exceptions.",
    ],
    miniProject: {
      title: "Automated Data Processing & Validation CLI",
      description: "Build a command-line data processing pipeline that reads multi-format input data, validates records against schemas, and outputs formatted metrics.",
      demonstrates: "Demonstrates OOP classes, custom generators, exception handling, and automated pytest coverage.",
      expectedOutcome: "A clean Python CLI with 90%+ pytest test coverage and complete type annotations.",
    },
    expectedOutcomes: [
      "Code adheres to PEP 8 styling conventions with explicit type annotations.",
      "All unit tests pass with pytest covering both valid inputs and error conditions.",
      "Virtual environment reproduces dependencies cleanly using requirements.txt.",
    ],
  },
};

/**
 * Dynamic fallback generator that produces high-quality, personalized recommendations
 * for any technology not in the curated dictionary.
 */
function generateDynamicRecommendation(skillName, requirementType, isPartial, relatedSkill, targetJobTitle, company) {
  const isReq = requirementType === "REQUIRED";
  const skillTitle = skillName.charAt(0).toUpperCase() + skillName.slice(1);
  const contextRole = targetJobTitle ? `for roles such as ${targetJobTitle}` : "for professional development";

  const objective = isPartial && relatedSkill
    ? `Build upon existing ${relatedSkill} background to acquire hands-on proficiency in ${skillTitle} ${contextRole}.`
    : `Acquire practical, production-ready proficiency in ${skillTitle} ${contextRole}.`;

  const duration = isPartial ? "1-2 weeks" : isReq ? "2-3 weeks" : "1-2 weeks";
  const difficulty = isPartial ? "INTERMEDIATE" : isReq ? "INTERMEDIATE" : "BEGINNER";

  const recommendedTopics = [
    `${skillTitle} architectural fundamentals and core concepts`,
    `${skillTitle} development environment setup and tooling`,
    `Core syntax, standard APIs, and configuration workflows for ${skillTitle}`,
    `Integration patterns, data handling, and common architectural idioms`,
    `Error handling, debugging techniques, and edge case resilience in ${skillTitle}`,
    `Testing, security practices, and production deployment standards`,
  ];

  const learningSteps = [
    {
      stepIndex: 1,
      title: `${skillTitle} Core Concepts & Setup`,
      explanation: isPartial && relatedSkill
        ? `Review ${skillTitle} architecture and identify key similarities and differences compared to your existing ${relatedSkill} knowledge.`
        : `Understand the core architecture, installation, development environment setup, and fundamental concepts of ${skillTitle}.`,
      learningObjective: `Understand the fundamental design principles and execute a verified setup for ${skillTitle}.`,
      practicalActivity: `Set up a local development environment and run a verified hello-world or test suite using ${skillTitle}.`,
      status: "NOT_STARTED",
    },
    {
      stepIndex: 2,
      title: "Key Syntax, Configuration & Core APIs",
      explanation: `Learn the primary syntax, standard configuration options, and fundamental API methods of ${skillTitle}.`,
      learningObjective: `Master core configuration, parameters, and foundational operations in ${skillTitle}.`,
      practicalActivity: `Write focused coding exercises or configuration scripts applying 3 or more key features of ${skillTitle}.`,
      status: "NOT_STARTED",
    },
    {
      stepIndex: 3,
      title: "Practical Application & Hands-On Exercises",
      explanation: `Implement small standalone components or scripts to practice essential ${skillTitle} workflows in realistic scenarios.`,
      learningObjective: `Apply ${skillTitle} to solve common domain problems and manipulate representative data payloads.`,
      practicalActivity: isPartial && relatedSkill
        ? `Implement a side-by-side comparison task highlighting how ${skillTitle} addresses scenarios previously handled in ${relatedSkill}.`
        : `Build a standalone utility or module implementing error handling and input validation in ${skillTitle}.`,
      status: "NOT_STARTED",
    },
    {
      stepIndex: 4,
      title: "Integration with Real-World Project Workflows",
      explanation: `Integrate ${skillTitle} into a representative project workflow, handling external dependencies, environment variables, and asynchronous flows.`,
      learningObjective: `Seamlessly integrate ${skillTitle} into existing application architectures and build pipelines.`,
      practicalActivity: `Connect ${skillTitle} to an existing application or service and test end-to-end data flow.`,
      status: "NOT_STARTED",
    },
    {
      stepIndex: 5,
      title: "Testing, Optimization & Verification",
      explanation: `Review code quality, implement automated tests, optimize performance, and verify that the implementation meets industry best practices.`,
      learningObjective: `Verify production readiness and demonstrate measurable mastery of ${skillTitle}.`,
      practicalActivity: `Write unit or integration tests verifying core behavior and run a linter/audit tool against your code.`,
      status: "NOT_STARTED",
    },
  ];

  const practicalExercises = [
    `Set up a verified local development environment or sandbox for ${skillTitle}.`,
    `Build a practical coding exercise applying 3 or more key features of ${skillTitle}.`,
    isPartial && relatedSkill
      ? `Document 3 practical differences between ${relatedSkill} and ${skillTitle} in real scenarios.`
      : `Implement error handling and edge case validation for a standard ${skillTitle} workflow.`,
    `Review official documentation and write sample code demonstrating typical production use cases.`,
  ];

  const miniProject = {
    title: `${skillTitle} Integration Project`,
    description: `Build a focused project incorporating ${skillTitle} into a practical application demonstrating key requirements of ${targetJobTitle || "the target role"}.`,
    demonstrates: `Demonstrates configuration, core syntax, error handling, and practical implementation of ${skillTitle}.`,
    expectedOutcome: `A working implementation that fulfills key requirements of ${skillTitle} without syntax or runtime failures.`,
  };

  const expectedOutcomes = [
    `Project runs reliably without unhandled errors, warnings, or syntax failures.`,
    `Demonstrates clean separation of concerns and adherence to standard ${skillTitle} conventions.`,
    `Able to explain key architectural decisions, benefits, and trade-offs when applying ${skillTitle} in ${targetJobTitle || "production"}.`,
  ];

  return {
    difficulty,
    estimatedDuration: duration,
    learningObjective: objective,
    recommendedTopics,
    learningSteps,
    practicalExercises,
    miniProject,
    expectedOutcomes,
  };
}

class LearningRecommendationService {
  /**
   * Generates a clear, grounded explanation of why a skill matters for the selected job.
   *
   * @param {Object} params
   * @param {string} params.skillName
   * @param {string} [params.requirementType='REQUIRED']
   * @param {string} [params.matchingStatus='MISSING']
   * @param {string} [params.jobTitle='Software Engineer']
   * @param {string} [params.company]
   * @param {string} [params.relatedSkill]
   * @param {boolean} [params.isFoundational=false]
   * @param {Array<string>} [params.dependentSkills=[]]
   * @returns {string} Role-grounded explanation
   */
  static generateWhyItMatters({
    skillName,
    requirementType = "REQUIRED",
    matchingStatus = "MISSING",
    jobTitle = "the target role",
    company = null,
    relatedSkill = null,
    isFoundational = false,
    dependentSkills = [],
  }) {
    const isReq = requirementType === "REQUIRED";
    const isPartial = matchingStatus === "PARTIAL_MATCH";
    const roleContext = company ? `${jobTitle} at ${company}` : `${jobTitle} role`;

    let explanation = "";

    if (isPartial && relatedSkill) {
      explanation = `${skillName} is specified as a ${isReq ? "core required" : "preferred"} qualification for the ${roleContext}. Your resume demonstrates transferable background in related technology (${relatedSkill}), which provides a helpful foundation. However, direct practical experience with ${skillName} was not identified in the resume text.`;
    } else if (isReq) {
      explanation = `${skillName} is explicitly listed as a core required technology for the ${roleContext}. The uploaded resume does not contain identified evidence of ${skillName} experience, making this an essential skill to develop for this position.`;
    } else {
      explanation = `${skillName} is listed as a preferred qualification for the ${roleContext}. While not strictly mandatory to apply, developing ${skillName} proficiency will strengthen your technical profile and give you a competitive edge over other applicants.`;
    }

    if (isFoundational && dependentSkills && dependentSkills.length > 0) {
      explanation += ` Additionally, ${skillName} serves as a foundational prerequisite for other target technologies in this role (${dependentSkills.join(", ")}).`;
    }

    return explanation;
  }

  /**
   * Determines priority level (HIGH, MEDIUM, LOW) and explainable rationale.
   *
   * @param {Object} params
   * @returns {{ priorityLevel: string, priorityReason: string }}
   */
  static determinePriority({
    requirementType = "REQUIRED",
    matchingStatus = "MISSING",
    priorityLevelNum = 2,
    jobPriority = "MEDIUM",
    isFoundational = false,
  }) {
    let level = "MEDIUM";
    let reason = "";

    const isReq = requirementType === "REQUIRED";
    const isPartial = matchingStatus === "PARTIAL_MATCH";

    if (priorityLevelNum === 1 || (isReq && jobPriority === "HIGH") || isFoundational) {
      level = "HIGH";
      if (isFoundational) {
        reason = "High priority: Essential foundational skill required before learning dependent technologies for this role.";
      } else {
        reason = "High priority: Core required technology with high importance for the target role.";
      }
    } else if (priorityLevelNum === 3 || (!isReq && (jobPriority === "LOW" || jobPriority === "MEDIUM"))) {
      level = "LOW";
      reason = "Lower priority: Preferred or supplementary skill that enhances your profile without being mandatory.";
    } else {
      level = "MEDIUM";
      if (isPartial) {
        reason = "Medium priority: Candidate possesses transferable foundation in related technology, making this a high-ROI quick win.";
      } else if (isReq) {
        reason = "Medium priority: Required skill with moderate immediate impact or secondary prerequisites.";
      } else {
        reason = "Medium priority: Preferred qualification with strong relevance to the target job responsibilities.";
      }
    }

    return { priorityLevel: level, priorityReason: reason };
  }

  /**
   * Main service method: Retrieves or generates personalized learning recommendations.
   *
   * @param {number} resumeId
   * @param {number} jobId
   * @param {number} userId
   * @param {Object} [options]
   * @returns {Promise<Object>}
   */
  static async getRecommendations(resumeId, jobId, userId, options = {}) {
    if (!resumeId || !jobId || !userId) {
      const err = new Error("Resume ID, Job Description ID, and User ID are required.");
      err.status = 400;
      throw err;
    }

    // Delegate to generateRecommendations which checks database / saves atomically
    return await this.generateRecommendations(resumeId, jobId, userId, options);
  }

  /**
   * Generates recommendations for missing and partially matched skills.
   * Reuses the priority order from Day 26 roadmap and preserves user progress.
   *
   * @param {number} resumeId
   * @param {number} jobId
   * @param {number} userId
   * @param {Object} [options]
   * @returns {Promise<Object>}
   */
  static async generateRecommendations(resumeId, jobId, userId, options = {}) {
    const parsedResumeId = Number(resumeId);
    const parsedJobId = Number(jobId);
    const parsedUserId = Number(userId);

    if (Number.isNaN(parsedResumeId) || Number.isNaN(parsedJobId) || Number.isNaN(parsedUserId)) {
      const err = new Error("Resume ID, Job Description ID, and User ID must be valid integers.");
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

    // 3. Obtain Day 20 Matching Results
    let matchingResults = await SkillMatchingService.getSavedMatching(parsedResumeId, parsedJobId, parsedUserId);
    if (!matchingResults) {
      matchingResults = await SkillMatchingService.runMatching(parsedResumeId, parsedJobId, parsedUserId, options);
    }

    // 4. Obtain Day 21 Match Scores
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
      const [insertResult] = await db.query(
        `INSERT INTO analyses (user_id, resume_id, job_id, overall_score, status) VALUES (?, ?, ?, ?, 'COMPLETED')`,
        [parsedUserId, parsedResumeId, parsedJobId, scoreData?.overall?.score || 0]
      );
      analysisId = insertResult.insertId;
    }

    // 6. Read existing roadmap_items to preserve user's learning progress
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

    // 7. Extract missing and partial skills only (exclude strong matches)
    const matchItems = matchingResults?.results || [];
    const missingAndPartial = matchItems.filter(
      (m) => m.category === "MISSING" || m.category === "PARTIAL_MATCH"
    );

    // 8. Run Priority Engine from SkillRoadmapService to determine sensible ranking
    const prioritizedSkills = SkillRoadmapService.prioritizeSkills({
      missingAndPartialSkills: missingAndPartial,
      candidateSkills: rawResumeSkills || [],
      jobTitle: jobRecord.title,
    });

    // 9. Build rich recommendations for each prioritized skill
    const recommendations = [];

    for (let index = 0; index < prioritizedSkills.length; index++) {
      const skill = prioritizedSkills[index];
      const key = skill.normalizedName;
      const existing = existingItemsMap.get(key) || existingItemsMap.get(skill.rawName.toLowerCase().trim());

      let parsedExistingDesc = null;
      if (existing && existing.description) {
        try {
          parsedExistingDesc = JSON.parse(existing.description);
        } catch {
          // ignore parsing error
        }
      }

      // Generate or retrieve recommendation content
      let content = null;

      // A. Check curated recommendations
      if (CURATED_RECOMMENDATIONS[key]) {
        content = JSON.parse(JSON.stringify(CURATED_RECOMMENDATIONS[key]));
      } else {
        // B. Attempt AI personalization if configured and not fallback
        const aiConfig = validateAiConfig();
        const canUseAi = aiConfig.valid && options.forceFallback !== true;

        if (canUseAi) {
          try {
            content = await this.generateAiRecommendation({
              skillName: skill.rawName,
              requirementType: skill.requirementType,
              matchingStatus: skill.category,
              jobTitle: jobRecord.title,
              company: jobRecord.company,
              relatedSkill: skill.matchedSkill,
            });
          } catch (aiErr) {
            console.warn(`[LearningRecommendationService] AI call skipped: ${aiErr.message}`);
          }
        }

        // C. Deterministic generic fallback
        if (!content) {
          content = generateDynamicRecommendation(
            skill.rawName,
            skill.requirementType,
            skill.category === "PARTIAL_MATCH",
            skill.matchedSkill,
            jobRecord.title,
            jobRecord.company
          );
        }
      }

      // Preserve existing step statuses
      if (parsedExistingDesc?.learningSteps && Array.isArray(parsedExistingDesc.learningSteps)) {
        const stepStatusMap = new Map();
        for (const s of parsedExistingDesc.learningSteps) {
          if (s.stepIndex && s.status) {
            stepStatusMap.set(s.stepIndex, s.status);
          }
        }

        content.learningSteps = content.learningSteps.map((step) => {
          const savedStatus = stepStatusMap.get(step.stepIndex);
          return {
            ...step,
            status: savedStatus || step.status || "NOT_STARTED",
          };
        });
      }

      const initialStatus = existing?.status || "NOT_STARTED";

      // Build whyItMatters explanation
      const whyItMatters = this.generateWhyItMatters({
        skillName: skill.rawName,
        requirementType: skill.requirementType,
        matchingStatus: skill.category,
        jobTitle: jobRecord.title,
        company: jobRecord.company,
        relatedSkill: skill.matchedSkill,
        isFoundational: skill.isFoundational,
        dependentSkills: skill.dependentSkills,
      });

      // Priority determination
      const priorityInfo = this.determinePriority({
        requirementType: skill.requirementType,
        matchingStatus: skill.category,
        priorityLevelNum: skill.priorityLevel,
        jobPriority: skill.priority,
        isFoundational: skill.isFoundational,
      });

      // Build unified description payload for roadmap_items
      const descriptionPayload = {
        priorityLevel: skill.priorityLevel,
        priorityLevelStr: priorityInfo.priorityLevel,
        priorityLabel: skill.priorityLabel,
        priorityReason: priorityInfo.priorityReason,
        requirementType: skill.requirementType,
        matchingStatus: skill.category,
        whyItMatters,
        relatedJobRequirement: skill.rawName,
        relatedResumeSkill: skill.matchedSkill || null,
        prerequisites: skill.dependsOnMissing ? [skill.dependsOnMissing] : [],
        isFoundational: skill.isFoundational,
        dependentSkills: skill.dependentSkills || [],
        difficulty: content.difficulty || "INTERMEDIATE",
        estimatedDuration: content.estimatedDuration || "2 weeks",
        learningObjective: content.learningObjective,
        recommendedTopics: content.recommendedTopics || [],
        learningSteps: content.learningSteps || [],
        practicalExercises: content.practicalExercises || [],
        miniProject: content.miniProject || null,
        expectedOutcomes: content.expectedOutcomes || [],
      };

      recommendations.push({
        id: existing?.id || null,
        skillId: skill.id || null,
        skillName: skill.rawName,
        normalizedSkill: skill.normalizedName,
        matchingStatus: skill.category, // 'MISSING' | 'PARTIAL_MATCH'
        requirementType: skill.requirementType, // 'REQUIRED' | 'PREFERRED'
        whyItMatters,
        priorityLevel: priorityInfo.priorityLevel, // 'HIGH' | 'MEDIUM' | 'LOW'
        priorityReason: priorityInfo.priorityReason,
        status: initialStatus, // 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED'
        difficulty: content.difficulty || "INTERMEDIATE",
        estimatedDuration: content.estimatedDuration || "2 weeks",
        learningObjective: content.learningObjective,
        recommendedTopics: content.recommendedTopics || [],
        learningSteps: content.learningSteps || [],
        practicalExercises: content.practicalExercises || [],
        miniProject: content.miniProject || null,
        expectedOutcomes: content.expectedOutcomes || [],
        stepOrder: index + 1,
        relatedResumeSkill: skill.matchedSkill || null,
        isFoundational: skill.isFoundational,
        dependentSkills: skill.dependentSkills || [],
        descriptionPayload,
      });
    }

    // 10. Persist recommendations to database roadmap_items atomically
    if (analysisId && recommendations.length > 0) {
      await this.persistRecommendations(analysisId, recommendations);
    }

    // 11. Calculate summary metrics
    const totalGaps = recommendations.length;
    const highCount = recommendations.filter((r) => r.priorityLevel === "HIGH").length;
    const mediumCount = recommendations.filter((r) => r.priorityLevel === "MEDIUM").length;
    const lowCount = recommendations.filter((r) => r.priorityLevel === "LOW").length;
    const completedCount = recommendations.filter((r) => r.status === "COMPLETED").length;
    const inProgressCount = recommendations.filter((r) => r.status === "IN_PROGRESS").length;
    const completionPercentage = totalGaps > 0 ? Math.round((completedCount / totalGaps) * 100) : 100;

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
        totalGaps,
        highPriorityCount: highCount,
        mediumPriorityCount: mediumCount,
        lowPriorityCount: lowCount,
        completedCount,
        inProgressCount,
        completionPercentage,
        algorithmVersion: RECOMMENDATION_ALGORITHM_VERSION,
        generatedAt: new Date().toISOString(),
      },
      recommendations,
      warnings,
    };
  }

  /**
   * Retrieves recommendation details for an individual skill within an analysis.
   *
   * @param {number} analysisId
   * @param {string} skillName
   * @param {number} userId
   * @returns {Promise<Object>}
   */
  static async getSkillRecommendation(analysisId, skillName, userId) {
    if (!analysisId || !skillName || !userId) {
      const err = new Error("Analysis ID, skill name, and user ID are required.");
      err.status = 400;
      throw err;
    }

    const parsedId = Number(analysisId);
    const parsedUserId = Number(userId);

    // Verify analysis ownership
    const [analyses] = await db.query(
      `SELECT id, resume_id, job_id FROM analyses WHERE id = ? AND user_id = ? LIMIT 1`,
      [parsedId, parsedUserId]
    );

    if (!analyses || analyses.length === 0) {
      const err = new Error("Analysis not found or access denied.");
      err.status = 404;
      throw err;
    }

    const analysis = analyses[0];
    const recs = await this.getRecommendations(analysis.resume_id, analysis.job_id, parsedUserId);
    const target = recs.recommendations.find(
      (r) =>
        r.skillName.toLowerCase().trim() === skillName.toLowerCase().trim() ||
        r.normalizedSkill === skillName.toLowerCase().trim()
    );

    if (!target) {
      const err = new Error(`No recommendation found for skill "${skillName}" in this analysis.`);
      err.status = 404;
      throw err;
    }

    return target;
  }

  /**
   * Updates learning progress status of an item or a specific step within an item.
   *
   * @param {number} itemId
   * @param {Object} payload
   * @param {string} [payload.status]
   * @param {number} [payload.stepIndex]
   * @param {string} [payload.stepStatus]
   * @param {number} userId
   * @returns {Promise<Object>}
   */
  static async updateRecommendationItemStatus(itemId, payload, userId) {
    // Reuses SkillRoadmapService to ensure complete synchronization with roadmap_items
    return await SkillRoadmapService.updateItemStatus(itemId, payload, userId);
  }

  /**
   * Persists recommendation items into MySQL `roadmap_items` table.
   */
  static async persistRecommendations(analysisId, recommendations = []) {
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      const skillNames = recommendations.map((r) => r.skillName);
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

      const [existingRows] = await connection.query(
        `SELECT id, title, status FROM roadmap_items WHERE analysis_id = ?`,
        [analysisId]
      );
      const existingByTitle = new Map();
      for (const row of existingRows) {
        existingByTitle.set(row.title.toLowerCase().trim(), row);
      }

      for (const item of recommendations) {
        const titleKey = item.skillName.toLowerCase().trim();
        const existing = existingByTitle.get(titleKey);
        const skillId = skillIdMap.get(titleKey) || item.skillId || null;
        const jsonDesc = JSON.stringify(item.descriptionPayload || {});

        if (existing) {
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
          const [ins] = await connection.query(
            `INSERT INTO roadmap_items
             (analysis_id, skill_id, title, description, step_order, difficulty, status, estimated_duration)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              analysisId,
              skillId,
              item.skillName,
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
   * Generates a tailored recommendation using OpenAI with strict JSON output validation.
   */
  static async generateAiRecommendation({ skillName, requirementType, matchingStatus, jobTitle, company, relatedSkill }) {
    const prompt = `Generate a structured, practical learning recommendation for the following skill gap:

Skill Name: "${skillName}"
Requirement Type: "${requirementType}"
Matching Status: "${matchingStatus}"
Related Experience in Resume: "${relatedSkill || "None"}"
Target Role: "${jobTitle || "Software Engineer"}"
Target Company: "${company || "Target Company"}"

Output ONLY valid JSON conforming to the following schema:
{
  "difficulty": "BEGINNER" | "INTERMEDIATE" | "ADVANCED",
  "estimatedDuration": "X weeks",
  "learningObjective": "Clear statement of what candidate will master",
  "recommendedTopics": [
    "Topic 1",
    "Topic 2",
    "Topic 3",
    "Topic 4",
    "Topic 5"
  ],
  "learningSteps": [
    {
      "stepIndex": 1,
      "title": "Stage 1 Title",
      "explanation": "Short explanation of concepts",
      "learningObjective": "Stage learning objective",
      "practicalActivity": "Hands-on activity for this stage",
      "status": "NOT_STARTED"
    },
    {
      "stepIndex": 2,
      "title": "Stage 2 Title",
      "explanation": "Short explanation of concepts",
      "learningObjective": "Stage learning objective",
      "practicalActivity": "Hands-on activity for this stage",
      "status": "NOT_STARTED"
    },
    {
      "stepIndex": 3,
      "title": "Stage 3 Title",
      "explanation": "Short explanation of concepts",
      "learningObjective": "Stage learning objective",
      "practicalActivity": "Hands-on activity for this stage",
      "status": "NOT_STARTED"
    }
  ],
  "practicalExercises": [
    "Practical exercise 1",
    "Practical exercise 2",
    "Practical exercise 3"
  ],
  "miniProject": {
    "title": "Project Title",
    "description": "What to build",
    "demonstrates": "Key skills demonstrated",
    "expectedOutcome": "Measurable project outcome"
  },
  "expectedOutcomes": [
    "Measurable learning outcome 1",
    "Measurable learning outcome 2",
    "Measurable learning outcome 3"
  ]
}

CRITICAL RULES:
1. Do NOT include fake URLs, certification claims, or external course provider advertisements.
2. Ground all topics and exercises in practical application for the role of ${jobTitle}.
3. Keep the JSON strictly parseable without markdown formatting outside the JSON block.`;

    const systemPrompt = `You are the SkillLens AI Learning Recommendation Engine.
You provide honest, practical, and structured learning guidance tailored to real technical requirements.
Output only valid JSON conforming strictly to the requested schema.`;

    const response = await generateText({
      prompt,
      systemPrompt,
      temperature: 0.2,
      maxTokens: 1200,
      timeoutMs: 15000,
    });

    return this.parseAndValidateAiOutput(response.text);
  }

  /**
   * Strictly validates AI response structure to guard against malformed output.
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
    if (!Array.isArray(data.recommendedTopics) || data.recommendedTopics.length < 2) {
      throw new Error("Invalid or insufficient recommendedTopics in AI response");
    }
    if (!Array.isArray(data.learningSteps) || data.learningSteps.length < 2) {
      throw new Error("Invalid or insufficient learningSteps in AI response");
    }
    if (!Array.isArray(data.practicalExercises) || data.practicalExercises.length === 0) {
      throw new Error("Invalid practicalExercises in AI response");
    }
    if (!data.miniProject || typeof data.miniProject.title !== "string") {
      throw new Error("Missing miniProject in AI response");
    }
    if (!Array.isArray(data.expectedOutcomes) || data.expectedOutcomes.length === 0) {
      throw new Error("Invalid expectedOutcomes in AI response");
    }

    return data;
  }
}

module.exports = LearningRecommendationService;

