# SkillLens AI

## Backend & Local Database Schema Document

**Project:** SkillLens AI
**Subtitle:** AI-Powered Resume & Skill Gap Analyzer
**Document:** Backend & Local Database Schema
**Version:** 1.0
**Database:** MySQL
**Backend:** Node.js + Express

---

# 1. Document Overview

This document defines the backend data architecture and local MySQL database structure for SkillLens AI.

The database will store and manage:

* User accounts
* Uploaded resumes
* Extracted resume information
* Target job descriptions
* Extracted job requirements
* Skills
* Resume skills
* Job-required skills
* Skill matches
* Analysis results
* Skill gaps
* AI recommendations
* Learning roadmap items
* Resume improvement suggestions
* Analysis history

The database should be designed to support the complete application flow:

> **User → Resume → Target Job → Analysis → Skill Matching → Recommendations → Roadmap**

---

# 2. Database Objectives

The database must:

1. Store user accounts securely.
2. Associate resumes with individual users.
3. Store uploaded resume metadata.
4. Store extracted resume information.
5. Store target job descriptions.
6. Store extracted job requirements.
7. Maintain reusable skill information.
8. Compare resume skills with job skills.
9. Store analysis results.
10. Store missing and partially matched skills.
11. Store AI-generated recommendations.
12. Store learning roadmap items.
13. Store resume improvement suggestions.
14. Preserve analysis history.
15. Support deletion and ownership rules.
16. Avoid unnecessary duplication of data.
17. Allow future expansion.

---

# 3. Database Name

Recommended local database name:

```text
skilllens_ai
```

MySQL connection example:

```text
localhost:3306
```

Database:

```text
skilllens_ai
```

---

# 4. High-Level Database Architecture

```text
                    ┌──────────────┐
                    │    USERS     │
                    └──────┬───────┘
                           │
             ┌─────────────┼─────────────┐
             │                           │
             ▼                           ▼
      ┌─────────────┐             ┌─────────────┐
      │   RESUMES   │             │    JOBS     │
      └──────┬──────┘             └──────┬──────┘
             │                           │
             ▼                           ▼
      ┌─────────────┐             ┌─────────────┐
      │RESUME SKILLS│             │  JOB SKILLS │
      └──────┬──────┘             └──────┬──────┘
             │                           │
             └─────────────┬─────────────┘
                           ▼
                    ┌──────────────┐
                    │  ANALYSES    │
                    └──────┬───────┘
                           │
          ┌────────────────┼─────────────────┐
          │                │                 │
          ▼                ▼                 ▼
   ┌─────────────┐  ┌──────────────┐  ┌──────────────┐
   │SKILL MATCHES│  │RECOMMENDATIONS│ │ROADMAP ITEMS │
   └─────────────┘  └──────────────┘  └──────────────┘
                           │
                           ▼
                   ┌────────────────┐
                   │RESUME SUGGESTIONS│
                   └────────────────┘
```

---

# 5. Main Database Tables

The initial database will contain the following core tables:

1. `users`
2. `resumes`
3. `resume_sections`
4. `jobs`
5. `job_requirements`
6. `skills`
7. `resume_skills`
8. `job_skills`
9. `analyses`
10. `skill_matches`
11. `recommendations`
12. `roadmap_items`
13. `resume_suggestions`

Optional future tables:

14. `refresh_tokens`
15. `user_preferences`
16. `notifications`

The MVP should avoid unnecessary tables until they are actually required.

---

# 6. Table: users

Stores registered application users.

### Purpose

Authentication and user ownership.

### Fields

| Field         | Type         | Constraints               | Description          |
| ------------- | ------------ | ------------------------- | -------------------- |
| id            | INT          | PK, AUTO_INCREMENT        | User ID              |
| full_name     | VARCHAR(100) | NOT NULL                  | User's name          |
| email         | VARCHAR(255) | NOT NULL, UNIQUE          | Login email          |
| password_hash | VARCHAR(255) | NOT NULL                  | Bcrypt password hash |
| created_at    | TIMESTAMP    | DEFAULT CURRENT_TIMESTAMP | Account creation     |
| updated_at    | TIMESTAMP    | DEFAULT CURRENT_TIMESTAMP | Last update          |

### Notes

Passwords must **never** be stored as plain text.

---

# 7. Table: resumes

Stores uploaded resume information.

### Fields

| Field             | Type         | Constraints               | Description           |
| ----------------- | ------------ | ------------------------- | --------------------- |
| id                | INT          | PK, AUTO_INCREMENT        | Resume ID             |
| user_id           | INT          | FK                        | Owner                 |
| original_filename | VARCHAR(255) | NOT NULL                  | Original file name    |
| stored_filename   | VARCHAR(255) | NOT NULL                  | Server-side file name |
| file_type         | VARCHAR(20)  | NOT NULL                  | PDF/DOCX              |
| file_size         | BIGINT       | NOT NULL                  | File size             |
| file_path         | VARCHAR(500) | NOT NULL                  | Storage path          |
| extracted_text    | LONGTEXT     | NULL                      | Extracted resume text |
| processing_status | ENUM         | NOT NULL                  | Processing state      |
| created_at        | TIMESTAMP    | DEFAULT CURRENT_TIMESTAMP | Upload date           |
| updated_at        | TIMESTAMP    | DEFAULT CURRENT_TIMESTAMP | Update date           |

### Processing Status

Possible values:

```text
UPLOADED
PROCESSING
COMPLETED
FAILED
```

---

# 8. Table: resume_sections

Stores structured sections extracted from a resume.

### Possible Sections

* Summary
* Experience
* Education
* Skills
* Certifications
* Projects
* Languages

### Fields

| Field           | Type        | Constraints               |
| --------------- | ----------- | ------------------------- |
| id              | INT         | PK, AUTO_INCREMENT        |
| resume_id       | INT         | FK                        |
| section_type    | VARCHAR(50) | NOT NULL                  |
| section_content | LONGTEXT    | NOT NULL                  |
| display_order   | INT         | DEFAULT 0                 |
| created_at      | TIMESTAMP   | DEFAULT CURRENT_TIMESTAMP |

This allows the application to preserve structured resume information instead of relying only on raw extracted text.

---

# 9. Table: jobs

Stores target job descriptions.

### Fields

| Field             | Type         | Constraints               | Description      |
| ----------------- | ------------ | ------------------------- | ---------------- |
| id                | INT          | PK, AUTO_INCREMENT        | Job ID           |
| user_id           | INT          | FK                        | Owner            |
| title             | VARCHAR(200) | NOT NULL                  | Job title        |
| company           | VARCHAR(200) | NULL                      | Company          |
| description       | LONGTEXT     | NOT NULL                  | Job description  |
| source_type       | ENUM         | NOT NULL                  | PASTED/UPLOADED  |
| processing_status | ENUM         | NOT NULL                  | Processing state |
| created_at        | TIMESTAMP    | DEFAULT CURRENT_TIMESTAMP | Created date     |
| updated_at        | TIMESTAMP    | DEFAULT CURRENT_TIMESTAMP | Update date      |

---

# 10. Table: job_requirements

Stores structured requirements extracted from a job description.

### Fields

| Field            | Type      | Constraints               |
| ---------------- | --------- | ------------------------- |
| id               | INT       | PK, AUTO_INCREMENT        |
| job_id           | INT       | FK                        |
| requirement_type | ENUM      | NOT NULL                  |
| requirement_text | TEXT      | NOT NULL                  |
| priority         | ENUM      | NOT NULL                  |
| created_at       | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP |

### Requirement Types

```text
SKILL
EXPERIENCE
EDUCATION
CERTIFICATION
RESPONSIBILITY
OTHER
```

### Priority

```text
HIGH
MEDIUM
LOW
```

---

# 11. Table: skills

Central reusable skill catalogue.

Examples:

```text
JavaScript
React
TypeScript
Python
Node.js
MySQL
Git
Docker
AWS
Figma
```

### Fields

| Field       | Type         | Constraints               |
| ----------- | ------------ | ------------------------- |
| id          | INT          | PK, AUTO_INCREMENT        |
| name        | VARCHAR(100) | NOT NULL, UNIQUE          |
| category    | VARCHAR(50)  | NOT NULL                  |
| description | TEXT         | NULL                      |
| created_at  | TIMESTAMP    | DEFAULT CURRENT_TIMESTAMP |

### Skill Categories

Possible values:

```text
PROGRAMMING
FRAMEWORK
DATABASE
TOOL
CLOUD
DESIGN
SOFT_SKILL
OTHER
```

---

# 12. Table: resume_skills

Many-to-many relationship between resumes and skills.

A resume can contain many skills.

A skill can appear in many resumes.

### Fields

| Field       | Type      | Constraints               |
| ----------- | --------- | ------------------------- |
| id          | INT       | PK, AUTO_INCREMENT        |
| resume_id   | INT       | FK                        |
| skill_id    | INT       | FK                        |
| proficiency | ENUM      | NULL                      |
| evidence    | TEXT      | NULL                      |
| created_at  | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP |

### Proficiency

```text
BEGINNER
INTERMEDIATE
ADVANCED
EXPERT
UNKNOWN
```

The `evidence` field can store the resume text supporting the detected skill.

---

# 13. Table: job_skills

Stores skills associated with a target job.

### Fields

| Field      | Type      | Constraints               |
| ---------- | --------- | ------------------------- |
| id         | INT       | PK, AUTO_INCREMENT        |
| job_id     | INT       | FK                        |
| skill_id   | INT       | FK                        |
| priority   | ENUM      | NOT NULL                  |
| required   | BOOLEAN   | DEFAULT TRUE              |
| evidence   | TEXT      | NULL                      |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP |

### Example

```text
React      HIGH      TRUE
TypeScript HIGH      TRUE
Docker     MEDIUM    FALSE
AWS        LOW       FALSE
```

---

# 14. Table: analyses

Central table representing a resume-to-job comparison.

### Fields

| Field               | Type         | Constraints               |
| ------------------- | ------------ | ------------------------- |
| id                  | INT          | PK, AUTO_INCREMENT        |
| user_id             | INT          | FK                        |
| resume_id           | INT          | FK                        |
| job_id              | INT          | FK                        |
| overall_score       | DECIMAL(5,2) | NOT NULL                  |
| skill_score         | DECIMAL(5,2) | NULL                      |
| experience_score    | DECIMAL(5,2) | NULL                      |
| education_score     | DECIMAL(5,2) | NULL                      |
| certification_score | DECIMAL(5,2) | NULL                      |
| summary             | TEXT         | NULL                      |
| status              | ENUM         | NOT NULL                  |
| ai_model            | VARCHAR(100) | NULL                      |
| created_at          | TIMESTAMP    | DEFAULT CURRENT_TIMESTAMP |
| completed_at        | TIMESTAMP    | NULL                      |

### Status

```text
PENDING
PROCESSING
COMPLETED
FAILED
```

---

# 15. Match Score Calculation

The recommended initial weighting is:

| Category               | Weight |
| ---------------------- | -----: |
| Skills                 |    50% |
| Experience             |    25% |
| Education              |    15% |
| Certifications / Other |    10% |

Overall score:

```text
Overall Score =
(Skill Score × 0.50)
+
(Experience Score × 0.25)
+
(Education Score × 0.15)
+
(Certification Score × 0.10)
```

The weights should be configurable in backend logic rather than hard-coded throughout the application.

---

# 16. Table: skill_matches

Stores the result of comparing each job skill with the user's resume.

### Fields

| Field       | Type         | Constraints               |
| ----------- | ------------ | ------------------------- |
| id          | INT          | PK, AUTO_INCREMENT        |
| analysis_id | INT          | FK                        |
| skill_id    | INT          | FK                        |
| status      | ENUM         | NOT NULL                  |
| match_score | DECIMAL(5,2) | NULL                      |
| priority    | ENUM         | NULL                      |
| explanation | TEXT         | NULL                      |
| evidence    | TEXT         | NULL                      |
| created_at  | TIMESTAMP    | DEFAULT CURRENT_TIMESTAMP |

### Match Status

```text
MATCHED
PARTIAL
MISSING
```

### Priority

```text
HIGH
MEDIUM
LOW
```

---

# 17. Skill Matching Logic

The system should not rely exclusively on exact text matching.

The matching process can use:

### Level 1 — Exact Match

Example:

```text
Resume: React
Job: React
```

Result:

```text
MATCHED
```

### Level 2 — Normalized Match

Example:

```text
Resume: NodeJS
Job: Node.js
```

Result:

```text
MATCHED
```

### Level 3 — Related Skill

Example:

```text
Resume: React
Job: React.js
```

Result:

```text
MATCHED / PARTIAL
```

### Level 4 — No Evidence

If the job requires:

```text
Docker
```

and the resume contains no evidence:

```text
MISSING
```

The system should avoid assuming a skill merely because another related technology appears.

---

# 18. Table: recommendations

Stores AI-generated career recommendations.

### Fields

| Field            | Type         | Constraints               |
| ---------------- | ------------ | ------------------------- |
| id               | INT          | PK, AUTO_INCREMENT        |
| analysis_id      | INT          | FK                        |
| skill_id         | INT          | NULL                      |
| title            | VARCHAR(200) | NOT NULL                  |
| reason           | TEXT         | NOT NULL                  |
| recommendation   | TEXT         | NOT NULL                  |
| priority         | ENUM         | NOT NULL                  |
| estimated_effort | VARCHAR(50)  | NULL                      |
| created_at       | TIMESTAMP    | DEFAULT CURRENT_TIMESTAMP |

### Example

```text
Title:
Improve TypeScript

Reason:
TypeScript is required for the target role.

Recommendation:
Build a React project using TypeScript.

Priority:
HIGH
```

---

# 19. Table: roadmap_items

Stores personalized learning roadmap steps.

### Fields

| Field              | Type         | Constraints               |
| ------------------ | ------------ | ------------------------- |
| id                 | INT          | PK, AUTO_INCREMENT        |
| analysis_id        | INT          | FK                        |
| skill_id           | INT          | NULL                      |
| title              | VARCHAR(200) | NOT NULL                  |
| description        | TEXT         | NOT NULL                  |
| step_order         | INT          | NOT NULL                  |
| difficulty         | ENUM         | NULL                      |
| status             | ENUM         | DEFAULT NOT_STARTED       |
| estimated_duration | VARCHAR(50)  | NULL                      |
| created_at         | TIMESTAMP    | DEFAULT CURRENT_TIMESTAMP |
| updated_at         | TIMESTAMP    | DEFAULT CURRENT_TIMESTAMP |

### Difficulty

```text
BEGINNER
INTERMEDIATE
ADVANCED
```

### Status

```text
NOT_STARTED
IN_PROGRESS
COMPLETED
```

---

# 20. Table: resume_suggestions

Stores resume improvement suggestions generated from analysis.

### Fields

| Field       | Type         | Constraints               |
| ----------- | ------------ | ------------------------- |
| id          | INT          | PK, AUTO_INCREMENT        |
| analysis_id | INT          | FK                        |
| section     | VARCHAR(100) | NOT NULL                  |
| suggestion  | TEXT         | NOT NULL                  |
| reason      | TEXT         | NULL                      |
| priority    | ENUM         | NOT NULL                  |
| created_at  | TIMESTAMP    | DEFAULT CURRENT_TIMESTAMP |

### Example

```text
Section:
Projects

Suggestion:
Add measurable results to project descriptions.

Priority:
MEDIUM
```

---

# 21. Entity Relationships

## Users → Resumes

```text
users.id
     ↓
resumes.user_id
```

One user can have many resumes.

```text
USER 1 ──────── * RESUMES
```

---

## Users → Jobs

```text
USER 1 ──────── * JOBS
```

One user can create multiple target jobs.

---

## Resumes → Resume Sections

```text
RESUME 1 ──────── * RESUME_SECTIONS
```

---

## Resumes → Skills

Many-to-many:

```text
RESUMES
   │
   ▼
RESUME_SKILLS
   ▲
   │
SKILLS
```

---

## Jobs → Skills

Many-to-many:

```text
JOBS
 │
 ▼
JOB_SKILLS
 ▲
 │
SKILLS
```

---

## Resume + Job → Analysis

```text
RESUME ─────┐
            ├──→ ANALYSIS
JOB ────────┘
```

---

## Analysis → Skill Matches

```text
ANALYSIS 1 ──────── * SKILL_MATCHES
```

---

## Analysis → Recommendations

```text
ANALYSIS 1 ──────── * RECOMMENDATIONS
```

---

## Analysis → Roadmap

```text
ANALYSIS 1 ──────── * ROADMAP_ITEMS
```

---

## Analysis → Resume Suggestions

```text
ANALYSIS 1 ──────── * RESUME_SUGGESTIONS
```

---

# 22. Complete Relationship Diagram

```text
                         USERS
                           │
              ┌────────────┴────────────┐
              │                         │
              ▼                         ▼
          RESUMES                      JOBS
              │                         │
              ▼                         ▼
      RESUME_SECTIONS             JOB_REQUIREMENTS
              │                         │
              │                         │
              ▼                         ▼
        RESUME_SKILLS                JOB_SKILLS
              │                         │
              └──────────┬──────────────┘
                         │
                       SKILLS
                         │
                         │
              ┌──────────▼──────────┐
              │                     │
              ▼                     ▼
           ANALYSES          SKILL_MATCHES
              │
      ┌───────┼────────┬──────────────┐
      │       │        │              │
      ▼       ▼        ▼              ▼
RECOMMENDATIONS ROADMAP  RESUME     REPORT
                   ITEMS SUGGESTIONS
```

---

# 23. Foreign Key Rules

Recommended relationship behavior:

### Users → Resumes

When a user is deleted:

```text
ON DELETE CASCADE
```

### Users → Jobs

```text
ON DELETE CASCADE
```

### Resumes → Resume Sections

```text
ON DELETE CASCADE
```

### Resumes → Resume Skills

```text
ON DELETE CASCADE
```

### Jobs → Job Skills

```text
ON DELETE CASCADE
```

### Analyses → Skill Matches

```text
ON DELETE CASCADE
```

### Analyses → Recommendations

```text
ON DELETE CASCADE
```

### Analyses → Roadmap Items

```text
ON DELETE CASCADE
```

### Analyses → Resume Suggestions

```text
ON DELETE CASCADE
```

This prevents orphaned analysis records.

---

# 24. Indexing Strategy

Indexes should be added to frequently queried fields.

Recommended indexes:

### users

```text
email
```

### resumes

```text
user_id
processing_status
```

### jobs

```text
user_id
processing_status
```

### resume_sections

```text
resume_id
```

### job_requirements

```text
job_id
```

### resume_skills

```text
resume_id
skill_id
```

### job_skills

```text
job_id
skill_id
```

### analyses

```text
user_id
resume_id
job_id
status
created_at
```

### skill_matches

```text
analysis_id
skill_id
status
```

### recommendations

```text
analysis_id
priority
```

### roadmap_items

```text
analysis_id
step_order
status
```

---

# 25. Unique Constraints

Important uniqueness rules:

### Users

```text
email UNIQUE
```

### Skills

```text
name UNIQUE
```

### Resume Skills

Prevent duplicate skill associations:

```text
UNIQUE(resume_id, skill_id)
```

### Job Skills

Prevent duplicate skill associations:

```text
UNIQUE(job_id, skill_id)
```

---

# 26. Authentication Data Flow

```text
Register
   ↓
Validate input
   ↓
Check email
   ↓
Hash password using bcrypt
   ↓
Create user
   ↓
Return safe user information
```

Login:

```text
Login
   ↓
Find user by email
   ↓
Compare password using bcrypt
   ↓
Generate JWT
   ↓
Return token + user
```

The password hash must never be returned to the frontend.

---

# 27. Resume Upload Data Flow

```text
Upload Resume
      ↓
Validate file
      ↓
Validate file size
      ↓
Generate safe filename
      ↓
Store file
      ↓
Create resume record
      ↓
PROCESSING
      ↓
Extract text
      ↓
Parse sections
      ↓
Extract skills
      ↓
Store resume sections
      ↓
Store resume skills
      ↓
COMPLETED
```

If processing fails:

```text
PROCESSING
     ↓
FAILED
```

---

# 28. Job Processing Data Flow

```text
Job Description
      ↓
Validate
      ↓
Store Job
      ↓
PROCESSING
      ↓
Extract requirements
      ↓
Identify skills
      ↓
Store Job Requirements
      ↓
Store Job Skills
      ↓
COMPLETED
```

---

# 29. Analysis Data Flow

```text
Resume
   +
Job
   ↓
Create Analysis
   ↓
PROCESSING
   ↓
Compare Skills
   ↓
Evaluate Experience
   ↓
Evaluate Education
   ↓
Evaluate Certifications
   ↓
Calculate Match Score
   ↓
Generate AI Insights
   ↓
Validate AI Response
   ↓
Store Skill Matches
   ↓
Store Recommendations
   ↓
Store Roadmap
   ↓
Store Resume Suggestions
   ↓
COMPLETED
```

---

# 30. AI Data Architecture

The AI service should not directly control the database.

Recommended architecture:

```text
Frontend
   ↓
Express API
   ↓
Analysis Controller
   ↓
Analysis Service
   ↓
AI Service
   ↓
External LLM API
```

The backend should validate and process the AI response before storing it.

---

# 31. AI Response Validation

AI-generated responses should be treated as untrusted input.

The backend should validate:

* Required fields
* Score ranges
* Skill status values
* Priority values
* Recommendation structure
* Roadmap structure

Example score rule:

```text
0 ≤ score ≤ 100
```

Invalid AI output should not be stored as a completed analysis.

---

# 32. Suggested Analysis Response Structure

The AI service should ideally return structured data similar to:

```text
{
  overallScore,
  skillScore,
  experienceScore,
  educationScore,
  certificationScore,
  summary,
  skills[],
  recommendations[],
  roadmap[],
  resumeSuggestions[]
}
```

The exact implementation format can be defined during backend development.

---

# 33. API-to-Database Mapping

## Authentication

```text
POST /api/auth/register
→ users

POST /api/auth/login
→ users

GET /api/auth/me
→ users
```

## Resume

```text
POST /api/resumes
→ resumes

GET /api/resumes
→ resumes

GET /api/resumes/:id
→ resumes + sections + skills

DELETE /api/resumes/:id
→ resumes
```

## Jobs

```text
POST /api/jobs
→ jobs

GET /api/jobs
→ jobs

GET /api/jobs/:id
→ jobs + requirements + skills

DELETE /api/jobs/:id
→ jobs
```

## Analysis

```text
POST /api/analyses
→ analyses + matching pipeline

GET /api/analyses
→ analyses

GET /api/analyses/:id
→ analyses + skill matches + recommendations + roadmap + suggestions

DELETE /api/analyses/:id
→ analyses
```

## Recommendations

```text
GET /api/analyses/:id/recommendations
→ recommendations
```

---

# 34. Data Ownership Rules

Every protected resource must belong to the authenticated user.

For example:

```text
Authenticated User
       ↓
resume.user_id
       ↓
Allowed
```

If the resume belongs to another user:

```text
403 Forbidden
```

The backend must never rely only on the frontend to enforce ownership.

---

# 35. File Storage Strategy

For the first development version:

```text
backend/
└── uploads/
    └── resumes/
```

However, uploaded files should not be committed to Git.

Add to `.gitignore`:

```text
uploads/
.env
node_modules/
```

For production, cloud/object storage can be introduced later.

---

# 36. Sensitive Data Handling

The system may process:

* Names
* Email addresses
* Phone numbers
* Education information
* Employment history
* Skills
* Resume documents

Therefore:

* Never log raw resume contents unnecessarily.
* Never log passwords.
* Never expose password hashes.
* Never commit uploaded files.
* Never commit API keys.
* Use environment variables for secrets.
* Validate file uploads.
* Validate user ownership.
* Delete data when requested.
* Avoid sending unnecessary personal data to AI services.

---

# 37. Environment Variables

Backend configuration should use `.env`.

Example:

```text
PORT=
DB_HOST=
DB_PORT=
DB_USER=
DB_PASSWORD=
DB_NAME=

JWT_SECRET=

AI_API_KEY=

CLIENT_URL=
```

The real values must never be committed to GitHub.

---

# 38. Local Development Database Setup

Recommended development process:

### Step 1

Install MySQL.

### Step 2

Create database:

```text
skilllens_ai
```

### Step 3

Create schema file:

```text
backend/database/schema.sql
```

### Step 4

Create environment file:

```text
backend/.env
```

### Step 5

Configure MySQL connection.

### Step 6

Run the backend.

### Step 7

Verify database connectivity.

---

# 39. Recommended Backend Folder Structure

```text
backend/
│
├── config/
│   └── db.js
│
├── controllers/
│   ├── authController.js
│   ├── resumeController.js
│   ├── jobController.js
│   └── analysisController.js
│
├── middleware/
│   ├── authMiddleware.js
│   ├── uploadMiddleware.js
│   └── errorMiddleware.js
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
│   ├── skillService.js
│   └── analysisService.js
│
├── utils/
│   ├── scoreCalculator.js
│   ├── skillMatcher.js
│   └── validators.js
│
├── database/
│   └── schema.sql
│
├── uploads/
│   └── resumes/
│
├── .env
├── .gitignore
└── server.js
```

---

# 40. Future Database Extensions

The initial version should remain manageable.

Possible future tables:

### user_preferences

Stores:

* Preferred learning style
* Career interests
* Notification preferences

### refresh_tokens

For more advanced authentication.

### notifications

For:

* Analysis completed
* Roadmap reminders
* Skill progress

### learning_resources

Stores curated:

* Courses
* Tutorials
* Documentation
* Videos

These should only be added if the corresponding features are implemented.

---

# 41. Database Design Principles

The database implementation should follow these principles:

### 1. Normalization

Avoid storing repeated information unnecessarily.

### 2. Ownership

Every user-owned resource must be traceable to its user.

### 3. Referential Integrity

Use foreign keys.

### 4. Validation

Validate both application input and AI output.

### 5. Security

Protect personal information.

### 6. Scalability

Avoid design decisions that make future features difficult.

### 7. Simplicity

Do not create unnecessary tables or relationships for features outside the MVP.

---

# 42. MVP Database Scope

For the first working version, the essential tables are:

```text
users
resumes
resume_sections
jobs
skills
resume_skills
job_skills
analyses
skill_matches
recommendations
roadmap_items
resume_suggestions
```

This is sufficient to support the core product.

---

# 43. Database Acceptance Criteria

The database design is considered complete when:

* Users can register and authenticate.
* Users can own multiple resumes.
* Resume metadata can be stored.
* Resume processing status can be tracked.
* Resume sections can be stored.
* Skills can be normalized.
* Resume skills can be associated with resumes.
* Job descriptions can be stored.
* Job requirements can be stored.
* Job skills can be associated with jobs.
* Analyses can connect a resume and job.
* Match results can be stored.
* AI recommendations can be stored.
* Learning roadmap items can be stored.
* Resume suggestions can be stored.
* User ownership is enforced.
* Foreign keys maintain referential integrity.
* Important fields are indexed.
* Sensitive information is protected.
* The database can support analysis history.

---

# 44. Final Database Architecture

The complete SkillLens AI backend data model follows this structure:

```text
USER
 │
 ├── RESUMES
 │    ├── RESUME SECTIONS
 │    └── RESUME SKILLS
 │             │
 │             └── SKILLS
 │
 └── JOBS
      ├── JOB REQUIREMENTS
      └── JOB SKILLS
               │
               └── SKILLS

RESUME + JOB
     │
     ▼
  ANALYSIS
     │
     ├── SKILL MATCHES
     ├── RECOMMENDATIONS
     ├── ROADMAP ITEMS
     └── RESUME SUGGESTIONS
```

---

# 45. Final Statement

The SkillLens AI database is designed around one central relationship:

> **A user's resume is compared against a target job to produce an actionable career analysis.**

The database should therefore preserve the complete journey:

> **Upload → Extract → Compare → Score → Identify Gaps → Recommend → Build Roadmap → Improve**

The architecture is intentionally modular so that the MVP can be developed within the project timeline while leaving room for future features such as learning resources, progress tracking, notifications, and advanced career analytics.
