# SkillLens AI

## Technical Requirements Document (TRD)

**Project Title:** SkillLens AI
**Subtitle:** AI-Powered Resume & Skill Gap Analyzer
**Project Type:** Solo Web Application
**Development Duration:** 35 Days
**Document Version:** 1.0
**Status:** Planned

---

# 1. Technical Overview

SkillLens AI will be developed as a full-stack web application that combines a React-based frontend, Node.js/Express backend, relational database, document-processing libraries, and an external AI service.

The system will process resumes and job descriptions, extract structured information, compare candidate capabilities against job requirements, and generate AI-powered recommendations.

### High-Level Architecture

```text
┌───────────────────────────────────────────────────────┐
│                     USER                              │
└─────────────────────────┬─────────────────────────────┘
                          │
                          ▼
┌───────────────────────────────────────────────────────┐
│                  REACT FRONTEND                       │
│                                                       │
│ Dashboard │ Resume │ Job │ Analysis │ Roadmap        │
└─────────────────────────┬─────────────────────────────┘
                          │ HTTPS / REST API
                          ▼
┌───────────────────────────────────────────────────────┐
│                NODE.JS / EXPRESS API                  │
│                                                       │
│ Auth │ Resume │ Jobs │ Analysis │ Recommendations    │
└───────────────┬──────────────────────┬────────────────┘
                │                      │
                ▼                      ▼
       ┌────────────────┐       ┌──────────────────┐
       │   Database     │       │     AI API       │
       │                │       │                  │
       │ Users          │       │ Skill Extraction │
       │ Resumes        │       │ Analysis         │
       │ Jobs           │       │ Recommendations  │
       │ Analyses       │       └──────────────────┘
       └────────────────┘
                │
                ▼
       ┌────────────────┐
       │ File Processing│
       │                │
       │ PDF / DOCX     │
       └────────────────┘
```

---

# 2. Technology Stack

## 2.1 Frontend

### React

React will be used to build the user interface.

Responsibilities:

* Page rendering
* Component management
* Form handling
* API communication
* Authentication state
* Analysis results
* Dashboard visualization
* Responsive UI

### JavaScript

JavaScript will be used as the primary frontend programming language.

### HTML

HTML will provide the semantic structure of application pages.

### CSS

CSS will control:

* Layout
* Typography
* Responsive behavior
* Animations
* Visual styling

### Recommended Supporting Libraries

The exact versions will be selected during implementation.

Potential libraries include:

* React Router
* Axios
* Lucide React
* Recharts
* Form validation library
* PDF/report generation library where appropriate

Libraries should only be added when they solve an actual project requirement.

---

# 3. Backend Technology

## Node.js

Node.js will provide the server-side runtime.

Responsibilities:

* API execution
* Authentication
* File processing
* Database communication
* AI API communication
* Business logic

## Express.js

Express.js will provide the REST API framework.

Responsibilities:

* Routing
* Middleware
* Request handling
* Authentication middleware
* Error handling
* File upload handling

---

# 4. Database

A relational database will be used.

### Recommended Database

**MySQL**

MySQL is suitable because the application contains structured relationships between:

* Users
* Resumes
* Job descriptions
* Analyses
* Skills
* Recommendations

### Database Responsibilities

The database will store:

* User accounts
* Resume metadata
* Extracted resume information
* Job descriptions
* Analysis results
* Skill matches
* Recommendations
* Learning roadmap data
* Analysis history

Actual table structures will be finalized in the **Backend / Local Database Schema Document**.

---

# 5. AI Technology

SkillLens AI will use an external Large Language Model API rather than training an AI model from scratch.

The AI layer will be responsible for:

* Resume understanding
* Skill extraction
* Job requirement extraction
* Skill comparison
* Natural-language analysis
* Learning recommendations
* Resume improvement suggestions

The AI provider should be selected based on:

* API availability
* Cost
* Structured-output support
* Response quality
* Rate limits
* Developer documentation
* Privacy considerations

The AI provider should be isolated behind a backend service layer so it can be replaced later without redesigning the application.

---

# 6. AI Service Architecture

The backend should not allow the frontend to communicate directly with the AI provider.

Instead:

```text
React
  │
  ▼
Express API
  │
  ▼
AI Service
  │
  ▼
AI Provider
```

This prevents exposing private API credentials.

---

# 7. Document Processing

SkillLens AI must process uploaded resume documents.

## Supported Formats

### PDF

A PDF extraction library will be used to extract textual content.

### DOCX

A DOCX parser will be used to extract document content.

---

# 8. Resume Processing Pipeline

The resume processing pipeline will follow:

```text
Upload File
     ↓
Validate File
     ↓
Store File / Metadata
     ↓
Detect File Type
     ↓
Extract Text
     ↓
Clean Text
     ↓
Parse Sections
     ↓
Structure Resume Data
     ↓
Store Structured Data
```

---

# 9. File Validation

The backend must validate:

* File extension
* MIME type
* File size
* Empty files
* Corrupted files

Only supported formats should be processed.

Example:

```text
Allowed:
✓ PDF
✓ DOCX

Rejected:
✗ EXE
✗ ZIP
✗ JS
✗ Images unless explicitly supported
```

---

# 10. Job Description Processing

Job descriptions can initially be entered as plain text.

The processing flow:

```text
Job Description
       ↓
Text Cleaning
       ↓
Requirement Extraction
       ↓
Skill Extraction
       ↓
Experience Extraction
       ↓
Education Extraction
       ↓
Structured Job Data
```

---

# 11. AI Analysis Pipeline

The main AI pipeline will be:

```text
Resume Data
     +
Job Data
     ↓
AI Analysis Request
     ↓
Structured AI Response
     ↓
Response Validation
     ↓
Skill Matching
     ↓
Score Calculation
     ↓
Recommendations
     ↓
Database
     ↓
Frontend
```

---

# 12. Structured AI Output

AI responses should be requested in structured JSON where supported.

Example:

```json
{
  "skills": {
    "matched": [],
    "partial": [],
    "missing": []
  },
  "experience": {
    "candidate": "",
    "required": "",
    "assessment": ""
  },
  "education": {
    "assessment": ""
  },
  "summary": "",
  "recommendations": []
}
```

The exact schema will be refined during implementation.

---

# 13. AI Prompt Strategy

Prompts should clearly define:

* Role of the AI
* Input data
* Expected output
* Rules
* Restrictions
* JSON structure

The AI should be instructed:

* Do not invent skills.
* Do not invent experience.
* Do not assume qualifications.
* Base analysis only on provided information.
* Clearly distinguish facts from recommendations.
* Return predictable structured output.

---

# 14. Skill Matching Architecture

Skill matching will use multiple layers.

## Layer 1 — Exact Matching

Example:

```text
Resume: React
Job: React
```

Result:

**Strong Match**

## Layer 2 — Normalized Matching

Handle variations such as:

```text
JavaScript
Javascript
JS
```

where appropriate.

## Layer 3 — Related Skill Matching

AI may identify related skills.

Example:

```text
React
```

may be related to:

```text
React.js
ReactJS
```

However, related skills should not automatically be treated as identical skills unless the matching rules support it.

---

# 15. Match Score System

The application will generate a score from:

```text
0 – 100%
```

Potential scoring dimensions:

| Dimension              | Example Weight |
| ---------------------- | -------------: |
| Skills                 |            50% |
| Experience             |            25% |
| Education              |            15% |
| Certifications / Other |            10% |

These weights are configurable and may be adjusted during testing.

### Important

The score is an analytical indicator, **not a guarantee of employment or interview selection**.

---

# 16. Skill Classification

Each relevant skill should receive a classification.

```text
MATCHED
PARTIAL
MISSING
```

Potential internal representation:

```json
{
  "skill": "TypeScript",
  "status": "missing",
  "priority": "high"
}
```

---

# 17. Skill Priority Algorithm

Missing skills may receive a priority based on:

1. Required vs preferred classification.
2. Frequency in the job description.
3. Importance to the target role.
4. Relationship to other required skills.
5. AI analysis.

Example:

```text
Required + Frequently Mentioned
        ↓
       HIGH
```

```text
Preferred + Occasionally Mentioned
        ↓
       MEDIUM
```

```text
Optional / Low Importance
        ↓
        LOW
```

---

# 18. Recommendation Engine

Recommendations will combine:

### Deterministic Logic

Used for:

* Skill priority
* Score calculations
* Basic matching
* Required/preferred classification

### AI Reasoning

Used for:

* Explanations
* Learning recommendations
* Resume improvement
* Personalized suggestions

This hybrid approach is preferred over allowing AI to control every part of the system.

---

# 19. Authentication Architecture

Authentication will use:

* Email/password
* Password hashing
* JWT-based authentication
* Protected API routes

Flow:

```text
Register
   ↓
Hash Password
   ↓
Store User
   ↓
Login
   ↓
Verify Password
   ↓
Generate JWT
   ↓
Frontend Stores Authentication State
   ↓
Protected Requests
```

Passwords must never be stored in plain text.

---

# 20. Authorization

Every protected request should identify the authenticated user.

Example:

```text
GET /api/analyses/:id
```

The backend must verify:

```text
Authenticated?
       ↓
Does analysis belong to user?
       ↓
Allow / Reject
```

Users must not be able to access another user's resumes or analyses by changing an ID.

---

# 21. REST API Architecture

The backend will follow REST principles.

### Authentication

```text
POST /api/auth/register
POST /api/auth/login
POST /api/auth/logout
GET  /api/auth/me
```

### Resume

```text
POST   /api/resumes
GET    /api/resumes
GET    /api/resumes/:id
DELETE /api/resumes/:id
```

### Job Descriptions

```text
POST   /api/jobs
GET    /api/jobs
GET    /api/jobs/:id
DELETE /api/jobs/:id
```

### Analysis

```text
POST   /api/analyses
GET    /api/analyses
GET    /api/analyses/:id
DELETE /api/analyses/:id
```

### Recommendations

```text
GET /api/analyses/:id/recommendations
```

The final endpoint list may change during implementation.

---

# 22. API Request Flow

Example analysis request:

```text
Frontend
   │
   │ POST /api/analyses
   ▼
Backend
   │
   ├── Authenticate User
   ├── Validate Resume
   ├── Validate Job
   ├── Retrieve Structured Data
   ├── Run AI Analysis
   ├── Validate AI Response
   ├── Calculate Score
   ├── Save Results
   │
   ▼
Response
   │
   ▼
Frontend Results Dashboard
```

---

# 23. Frontend Architecture

The frontend should use reusable components.

Suggested structure:

```text
src/
│
├── components/
│   ├── common/
│   ├── dashboard/
│   ├── resume/
│   ├── job/
│   ├── analysis/
│   └── roadmap/
│
├── pages/
│   ├── Landing/
│   ├── Login/
│   ├── Register/
│   ├── Dashboard/
│   ├── Resume/
│   ├── Job/
│   ├── Analysis/
│   ├── History/
│   └── Profile/
│
├── services/
│   └── api.js
│
├── context/
│   └── AuthContext.jsx
│
├── hooks/
│
├── utils/
│
├── assets/
│
└── App.jsx
```

The exact structure may evolve during development.

---

# 24. Backend Architecture

Suggested structure:

```text
backend/
│
├── controllers/
│   ├── authController.js
│   ├── resumeController.js
│   ├── jobController.js
│   └── analysisController.js
│
├── routes/
│   ├── authRoutes.js
│   ├── resumeRoutes.js
│   ├── jobRoutes.js
│   └── analysisRoutes.js
│
├── services/
│   ├── aiService.js
│   ├── resumeService.js
│   ├── jobService.js
│   └── analysisService.js
│
├── middleware/
│   ├── authMiddleware.js
│   ├── uploadMiddleware.js
│   └── errorMiddleware.js
│
├── utils/
│
├── config/
│
├── uploads/
│
├── database/
│
└── server.js
```

---

# 25. Database Architecture

The database should maintain relationships between:

```text
Users
  │
  ├── Resumes
  │
  ├── Job Descriptions
  │
  └── Analyses
          │
          ├── Skill Matches
          ├── Skill Gaps
          ├── Recommendations
          └── Learning Roadmap
```

The complete relational schema will be defined in the separate **Backend / Local Database Schema Document**.

---

# 26. Data Integrity

The system should enforce:

* Required fields
* Foreign key relationships
* Unique user emails
* Valid analysis ownership
* Consistent analysis references
* Valid status values
* Valid score ranges

Match scores should remain within:

```text
0 ≤ score ≤ 100
```

---

# 27. Security Requirements

## Authentication Security

* Password hashing
* JWT authentication
* Protected routes
* Secure token handling

## API Security

* Request validation
* Authentication middleware
* Authorization checks
* Error handling
* Rate limiting where appropriate

## File Security

* File type validation
* File size restrictions
* Safe file naming
* Controlled storage
* Avoid executable uploads

## Environment Security

Secrets must be stored in:

```text
.env
```

Examples:

```text
DATABASE_URL
JWT_SECRET
AI_API_KEY
```

`.env` must never be committed to GitHub.

---

# 28. CORS

The backend must only allow requests from trusted frontend origins.

Development:

```text
http://localhost:5173
```

Production:

```text
Production frontend URL
```

The exact production origin will be configured during deployment.

---

# 29. Error Handling Architecture

The backend should use centralized error handling.

Example:

```json
{
  "success": false,
  "message": "Unable to process resume."
}
```

Errors should not expose:

* Database credentials
* API keys
* Internal stack traces
* Sensitive user information

---

# 30. Loading States

AI operations may take longer than normal API requests.

The frontend should display:

```text
Analyzing your resume...
Comparing skills...
Identifying skill gaps...
Preparing recommendations...
```

The user should never be left wondering whether the application is frozen.

---

# 31. AI Failure Handling

If the AI service fails:

```text
Frontend
   ↓
Backend
   ↓
AI Request
   ↓
FAIL
   ↓
Retry / Error Handling
   ↓
User-Friendly Message
```

The system should not create incomplete or misleading analysis results.

---

# 32. Performance Requirements

The application should:

* Avoid unnecessary API requests.
* Cache appropriate data where useful.
* Paginate analysis history if required.
* Limit file sizes.
* Process documents efficiently.
* Avoid sending unnecessarily large prompts to the AI.
* Display progress/loading states.

---

# 33. Responsive Requirements

The application must support:

### Desktop

* 1440px+
* 1024px+

### Tablet

* 768px+

### Mobile

* 320px–767px

The analysis dashboard should remain usable on smaller screens.

---

# 34. Accessibility Requirements

The frontend should support:

* Semantic HTML
* Keyboard navigation
* Accessible form labels
* Focus states
* Readable typography
* Meaningful error messages
* Alternative text for meaningful images
* Accessible charts where possible

---

# 35. Logging

The backend should log useful operational information such as:

* Server errors
* Failed AI requests
* File processing failures
* Authentication failures
* API errors

Sensitive information must not be written to logs.

---

# 36. Environment Configuration

Development and production environments should use separate configurations.

Example:

```text
.env
.env.example
```

`.env.example` should contain placeholders:

```text
PORT=
DATABASE_URL=
JWT_SECRET=
AI_API_KEY=
FRONTEND_URL=
```

Actual secrets must remain local or inside the hosting provider's environment-variable system.

---

# 37. Development Environment

Recommended development tools:

* VS Code
* Git
* GitHub
* Node.js
* npm
* MySQL
* Browser Developer Tools
* API testing tool such as Postman/Thunder Client

---

# 38. Version Control

GitHub will be used for source-code management.

Recommended repository structure:

```text
SkillLens-AI/
│
├── frontend/
├── backend/
├── docs/
├── README.md
└── .gitignore
```

The repository should contain:

* Source code
* Documentation
* Configuration examples

The repository must not contain:

* `.env`
* API keys
* Passwords
* Private uploaded resumes
* Sensitive user data

---

# 39. Deployment Architecture

A possible production architecture:

```text
                 USERS
                   │
                   ▼
           ┌───────────────┐
           │   Frontend    │
           │   Hosting     │
           └───────┬───────┘
                   │ HTTPS
                   ▼
           ┌───────────────┐
           │   Backend     │
           │   Hosting     │
           └──────┬───┬────┘
                  │   │
          ┌───────┘   └─────────┐
          ▼                     ▼
    ┌───────────┐        ┌────────────┐
    │ Database  │        │ AI Provider│
    └───────────┘        └────────────┘
```

The final hosting providers will be selected during the deployment stage based on availability, cost, and compatibility.

---

# 40. API Security and AI Cost Control

Because AI API usage may incur cost, the backend should:

* Validate requests before sending them to AI.
* Avoid duplicate analysis requests.
* Limit excessively large inputs.
* Store completed results.
* Prevent unnecessary repeated analysis.
* Consider request rate limits.

---

# 41. AI Privacy Considerations

Resume information may contain personal information.

The system should:

* Send only necessary data to the AI provider.
* Avoid exposing unnecessary personal details where possible.
* Clearly communicate AI processing where appropriate.
* Follow the selected AI provider's data-handling policies.
* Avoid storing AI requests unnecessarily.

---

# 42. Testing Requirements

Testing should cover:

## Unit Testing

* Score calculations
* Skill normalization
* Validation functions
* Utility functions

## Integration Testing

* Authentication
* Resume processing
* AI service
* Database operations
* API endpoints

## Functional Testing

* Complete user workflows

## Security Testing

* Unauthorized API access
* Invalid tokens
* File upload attacks
* Input validation
* User data isolation

## Responsive Testing

* Desktop
* Tablet
* Mobile

---

# 43. AI Testing

AI outputs should be tested using different input combinations.

### Test Case 01

Strongly matching resume.

Expected:

```text
High Match
```

### Test Case 02

Partially matching resume.

Expected:

```text
Medium Match
```

### Test Case 03

Poorly matching resume.

Expected:

```text
Low Match
```

### Test Case 04

Resume with missing sections.

Expected:

```text
Graceful processing
```

### Test Case 05

Unrelated resume and job.

Expected:

```text
Low compatibility
```

---

# 44. Technical Constraints

The project will be developed as a solo project within approximately 35 days.

Therefore:

* No custom AI model training.
* No unnecessarily complex microservice architecture.
* No premature optimization.
* No large-scale distributed infrastructure.
* No unnecessary third-party services.
* Core functionality must remain the priority.

The architecture should remain modular enough for future expansion.

---

# 45. Technical Priorities

Priority order:

### P0 — Critical

* Authentication
* Resume processing
* Job processing
* AI analysis
* Skill matching
* Match score
* Results dashboard

### P1 — Important

* Learning recommendations
* Skill roadmap
* Analysis history
* Resume suggestions
* Report generation

### P2 — Future

* AI career chatbot
* Job recommendations
* LinkedIn integration
* Advanced semantic search
* Vector database
* Learning platform

---

# 46. Technical Acceptance Criteria

The technical implementation will be considered successful when:

* Frontend communicates successfully with backend.
* Authentication works securely.
* Users can upload supported resumes.
* Resume text is extracted successfully.
* Job descriptions can be processed.
* AI analysis can be requested securely through the backend.
* AI output is validated.
* Skills are classified.
* Match score is calculated.
* Results are persisted.
* Users can retrieve previous analyses.
* Unauthorized users cannot access another user's data.
* Application works responsively.
* Production deployment works successfully.

---

# 47. Future Technical Architecture

The system should remain extensible enough to eventually support:

```text
             SkillLens AI
                   │
       ┌───────────┼───────────┐
       ▼           ▼           ▼
   Resume AI    Job AI      Career AI
       │           │           │
       └───────────┼───────────┘
                   ▼
             Recommendation
                Engine
                   │
        ┌──────────┼──────────┐
        ▼          ▼          ▼
     Skills     Courses      Jobs
```

Future versions may introduce:

* Embeddings
* Vector databases
* Semantic skill matching
* Job recommendation engines
* External course APIs
* Career chatbot functionality

These technologies are not required for the initial MVP.

---

# 48. Final Technical Stack

The planned initial stack is:

| Layer             | Technology                 |
| ----------------- | -------------------------- |
| Frontend          | React                      |
| Language          | JavaScript                 |
| Styling           | CSS / selected UI approach |
| Routing           | React Router               |
| API Client        | Axios or Fetch             |
| Backend           | Node.js                    |
| API Framework     | Express.js                 |
| Database          | MySQL                      |
| Authentication    | JWT                        |
| Password Security | bcrypt                     |
| AI                | External LLM API           |
| Resume Processing | PDF/DOCX parsing libraries |
| Charts            | Recharts or equivalent     |
| Version Control   | Git + GitHub               |
| Development       | VS Code                    |
| API Testing       | Postman / Thunder Client   |
| Frontend Hosting  | To be selected             |
| Backend Hosting   | To be selected             |
| Database Hosting  | To be selected             |

---

# 49. Technical Philosophy

SkillLens AI should follow these principles:

### Keep it modular

AI, authentication, document processing, and analysis should be separated into manageable services.

### Keep it explainable

The system should show users why a skill is considered matched or missing.

### Keep AI controlled

AI should assist the application rather than control every business rule.

### Keep security first

Resume data and authentication information must be protected.

### Keep the MVP realistic

A working core application is more valuable than many incomplete advanced features.

### Keep it extensible

Future AI and career features should be possible without rebuilding the entire system.

---

# 50. Final Technical Statement

SkillLens AI will be implemented as a modular full-stack web application using:

**React + JavaScript + Node.js + Express + MySQL + AI API + PDF/DOCX Processing**

The architecture will separate presentation, business logic, data management, document processing, and AI services.

The system will prioritize:

**Security + Reliability + Explainability + Usability + Modularity**

while maintaining a realistic technical scope for a solo 35-day development project.
