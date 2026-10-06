# SkillLens AI

## Product Requirements Document (PRD)

**Project Title:** SkillLens AI
**Subtitle:** AI-Powered Resume & Skill Gap Analyzer
**Project Type:** Solo Web Application
**Development Duration:** 35 Days
**Document Version:** 1.0
**Status:** Planned

---

# 1. Product Overview

## 1.1 Product Description

**SkillLens AI** is an AI-powered web application designed to help job seekers understand how well their resume matches a target job opportunity.

The system analyzes a user's resume against a selected job description and identifies:

* Matching skills
* Missing skills
* Partially matching skills
* Experience alignment
* Education and qualification alignment
* Overall job-match score
* Skill gaps
* Priority areas for improvement
* Personalized learning recommendations
* Resume improvement suggestions

The application transforms the analysis into an easy-to-understand dashboard so users can identify their strengths and understand what they need to improve before applying for a job.

---

# 2. Problem Statement

Many job seekers apply for positions without knowing how closely their current skills and experience match the requirements of the role.

Traditional resume review methods often require users to manually compare:

* Their resume
* Job requirements
* Required technical skills
* Experience requirements
* Qualifications
* Preferred technologies

This process can be time-consuming and difficult, particularly for students and early-career developers.

Users may also struggle to identify:

* Which skills they are missing
* Which skills are most important
* Whether their resume contains relevant keywords
* Which areas they should improve first
* Whether their resume effectively represents their experience

SkillLens AI addresses this problem by automatically analyzing the resume and target job description and presenting the differences in a structured and understandable way.

---

# 3. Proposed Solution

SkillLens AI provides a single platform where users can:

1. Create an account.
2. Upload their resume.
3. Enter or upload a target job description.
4. Allow the system to extract relevant information.
5. Analyze the resume against the job requirements.
6. Calculate a compatibility score.
7. Identify matching, partial, and missing skills.
8. Receive AI-generated explanations.
9. Receive personalized learning recommendations.
10. View a skill-gap roadmap.
11. Receive resume improvement suggestions.
12. Save and review previous analyses.
13. Generate a downloadable analysis report.

---

# 4. Product Vision

> **To help job seekers understand their career readiness and make smarter decisions about what skills to develop for their desired roles.**

SkillLens AI aims to turn a traditional resume review process into an interactive, intelligent, and personalized career-development experience.

---

# 5. Product Mission

SkillLens AI's mission is to make job preparation more transparent and accessible by helping users understand:

> **Where they are → Where they need to be → What they should learn next.**

---

# 6. Target Users

## 6.1 Primary Users

### Students

Students preparing for:

* Internships
* Graduate jobs
* Software engineering roles
* IT positions

### Recent Graduates

Graduates who want to understand whether their existing skills meet entry-level job requirements.

### Junior Developers

Developers who want to identify missing technologies and skills for their next career opportunity.

### Career Changers

People transitioning into a new technical or professional role.

---

# 7. User Personas

## Persona 01 — University Student

**Name:** Maya
**Age:** 22
**Goal:** Find a software engineering internship.

Maya has knowledge of React, JavaScript, Git, and basic Node.js but is unsure whether her resume matches a particular internship.

She uploads her resume and the internship description.

SkillLens AI identifies:

* Strong React match
* Strong JavaScript match
* Partial Node.js match
* Missing TypeScript
* Missing Docker

The system recommends which skills Maya should prioritize.

---

## Persona 02 — Junior Developer

**Name:** Alex
**Age:** 25
**Goal:** Apply for a full-stack developer position.

Alex wants to know whether his current experience is sufficient before applying.

SkillLens AI provides:

* Job-match percentage
* Skill comparison
* Experience comparison
* Missing technologies
* Resume improvement suggestions

---

# 8. Product Objectives

## Primary Objectives

1. Automatically analyze resumes against job descriptions.
2. Identify relevant skills from resumes.
3. Identify required skills from job descriptions.
4. Compare candidate skills with job requirements.
5. Calculate a meaningful compatibility score.
6. Identify skill gaps.
7. Prioritize important missing skills.
8. Generate personalized AI recommendations.
9. Provide actionable resume improvement suggestions.
10. Present results through an intuitive dashboard.

## Secondary Objectives

* Provide analysis history.
* Generate downloadable reports.
* Provide learning roadmaps.
* Support multiple resume formats.
* Provide responsive access across devices.

---

# 9. Project Goals

By the end of development, SkillLens AI should provide a complete workflow:

```text
User
 ↓
Register / Login
 ↓
Upload Resume
 ↓
Enter Job Description
 ↓
Resume Processing
 ↓
Job Requirement Processing
 ↓
AI Analysis
 ↓
Skill Matching
 ↓
Match Score
 ↓
Skill Gap Analysis
 ↓
Recommendations
 ↓
Learning Roadmap
 ↓
Resume Suggestions
 ↓
Report
```

---

# 10. Core Features

## 10.1 User Authentication

Users should be able to:

* Register
* Login
* Logout
* Maintain a personal profile
* Access protected application areas

The system should protect user-specific resume and analysis information.

---

# 11. Resume Management

Users can upload their resume.

### Supported formats

* PDF
* DOCX

### Resume management features

* Upload resume
* Validate file type
* Validate file size
* Extract text
* Parse resume sections
* View extracted information
* Replace resume
* Delete resume
* View resume history

### Resume sections

The system should attempt to identify:

* Personal information
* Professional summary
* Skills
* Education
* Work experience
* Projects
* Certifications
* Other relevant sections

---

# 12. Job Description Management

Users should be able to provide a target job description.

### Input methods

* Paste job description text
* Upload supported document where applicable

The system should identify:

* Job title
* Required skills
* Preferred skills
* Technologies
* Tools
* Experience requirements
* Education requirements
* Certifications
* Other important requirements

---

# 13. AI Resume Analysis

The AI analysis engine is the core intelligence layer of SkillLens AI.

The system should analyze the relationship between:

```text
Resume
   +
Job Description
   ↓
AI Analysis Engine
```

The AI should identify relevant information from both sources.

---

# 14. Skill Extraction

The system should extract technical and relevant professional skills.

### Example

Resume:

```text
React
JavaScript
HTML
CSS
Node.js
Git
```

Job description:

```text
React
JavaScript
TypeScript
Node.js
Docker
AWS
Git
```

The system should produce:

### Matching

* React
* JavaScript
* Node.js
* Git

### Missing

* TypeScript
* Docker
* AWS

---

# 15. Skill Classification

Skills should be categorized into three primary groups.

## 🟢 Strong Match

Skills clearly demonstrated in the resume and required by the job.

## 🟡 Partial Match

Skills that appear related but may not fully satisfy the job requirement.

## 🔴 Missing

Required skills that are not sufficiently demonstrated in the resume.

---

# 16. Match Score

SkillLens AI should provide an overall compatibility score.

Example:

```text
Overall Match
78%
```

The system may consider multiple factors such as:

* Skills
* Experience
* Education
* Certifications
* Relevant keywords

Example:

```text
Skills       82%
Experience   75%
Education    90%
Overall      78%
```

The scoring algorithm should be documented separately in the Technical Requirements Document.

---

# 17. Skill Gap Analysis

The system should identify gaps between the user's current capabilities and the requirements of the target position.

Example:

```text
Target Role: Full Stack Developer

Current Skills
✓ React
✓ JavaScript
✓ Node.js
✓ Git

Skill Gaps
✗ TypeScript
✗ Docker
✗ AWS
```

The system should help the user understand the importance of each gap.

---

# 18. Skill Priority

Missing skills should be assigned a priority where possible.

Example:

| Skill      | Priority |
| ---------- | -------- |
| TypeScript | High     |
| Docker     | High     |
| AWS        | Medium   |
| Kubernetes | Low      |

Priority can be determined using factors such as:

* Whether the skill is required or preferred
* Frequency in the job description
* Relationship to other required skills
* Importance identified by the AI analysis

---

# 19. AI Career Analysis

The system should provide a natural-language explanation of the analysis.

Example:

> Your resume demonstrates strong frontend development skills, particularly React and JavaScript. However, the target role places additional emphasis on TypeScript and containerization. Improving these areas could significantly strengthen your application.

The explanation should be understandable to non-expert users.

---

# 20. Learning Recommendations

For identified skill gaps, SkillLens AI should provide learning recommendations.

Example:

### TypeScript

**Priority:** High

**Why learn it?**
The target position requires TypeScript and it complements your existing JavaScript knowledge.

**Suggested focus:**

* Type annotations
* Interfaces
* Generics
* Type narrowing
* React with TypeScript

---

# 21. Skill-Gap Learning Roadmap

SkillLens AI should transform missing skills into a prioritized learning path.

Example:

```text
Current Skills
      ↓
JavaScript
      ↓
TypeScript
      ↓
Node.js
      ↓
Docker
      ↓
AWS
      ↓
Target Role
```

The roadmap should help users understand the recommended order in which to develop missing skills.

---

# 22. Resume Improvement Suggestions

The AI should identify areas where the resume could be improved.

Possible suggestions include:

* Improve professional summary
* Add missing relevant keywords
* Improve project descriptions
* Clarify achievements
* Improve skill organization
* Highlight relevant experience
* Remove unnecessary information

The system should provide suggestions rather than automatically making potentially inaccurate claims.

---

# 23. Analysis Dashboard

The main results dashboard should display:

### Summary

* Target role
* Overall match percentage
* Overall assessment

### Skills

* Matching skills
* Partial skills
* Missing skills

### Experience

* Candidate experience
* Required experience
* Alignment

### Education

* Candidate education
* Required education
* Alignment

### Recommendations

* Priority skills
* Learning recommendations
* Resume suggestions

---

# 24. Analysis History

Users should be able to access previous analyses.

Example:

```text
Analysis History

Frontend Developer
78% Match
September 28, 2026

Full Stack Developer
65% Match
September 25, 2026

React Developer
84% Match
September 20, 2026
```

Users should be able to open previous reports.

---

# 25. Report Generation

Users should be able to generate a downloadable report containing:

* Candidate summary
* Target job
* Match score
* Matching skills
* Partial skills
* Missing skills
* Experience analysis
* Education analysis
* Recommendations
* Learning roadmap
* Resume improvement suggestions

---

# 26. Dashboard Analytics

The dashboard may provide useful high-level statistics such as:

```text
Total Analyses       8
Average Match        74%
Strongest Skill      React
Top Skill Gap        AWS
```

This feature should remain secondary to the core analysis functionality.

---

# 27. Functional Requirements

## FR-01 — User Registration

The system shall allow a new user to create an account.

## FR-02 — User Login

The system shall allow registered users to securely log in.

## FR-03 — Resume Upload

The system shall allow users to upload supported resume files.

## FR-04 — Resume Validation

The system shall validate file type and file size.

## FR-05 — Resume Text Extraction

The system shall extract readable text from supported documents.

## FR-06 — Resume Parsing

The system shall identify relevant resume sections.

## FR-07 — Job Description Input

The system shall allow users to enter or upload job descriptions.

## FR-08 — Job Requirement Extraction

The system shall identify relevant job requirements.

## FR-09 — AI Analysis

The system shall send relevant extracted information to the AI analysis service.

## FR-10 — Skill Extraction

The system shall identify relevant skills from the resume and job description.

## FR-11 — Skill Matching

The system shall compare candidate skills with job requirements.

## FR-12 — Match Score

The system shall generate an overall compatibility score.

## FR-13 — Skill Gap Detection

The system shall identify missing and partially matched skills.

## FR-14 — Recommendations

The system shall generate recommendations for identified skill gaps.

## FR-15 — Learning Roadmap

The system shall generate a prioritized learning path.

## FR-16 — Resume Suggestions

The system shall provide AI-generated resume improvement suggestions.

## FR-17 — Analysis History

The system shall save completed analyses for authenticated users.

## FR-18 — Report Generation

The system shall allow users to generate a downloadable analysis report.

## FR-19 — Analysis Retrieval

The system shall allow users to view previous analyses.

## FR-20 — Data Protection

The system shall restrict private user information to authorized users.

---

# 28. Non-Functional Requirements

## Performance

* Pages should load efficiently.
* UI interactions should feel responsive.
* AI processing should provide a visible loading state.
* Large files should be handled safely.

## Security

* Passwords must not be stored in plain text.
* Authentication must be implemented securely.
* Protected APIs must require authentication.
* Uploaded files must be validated.
* API credentials must not be exposed in frontend code.
* Sensitive configuration must use environment variables.

## Usability

* The interface should be simple and understandable.
* Results should use clear visual categories.
* Technical AI results should be explained in user-friendly language.

## Accessibility

The application should consider:

* Keyboard navigation
* Readable typography
* Sufficient contrast
* Clear labels
* Accessible form controls
* Meaningful error messages

## Scalability

The architecture should allow future expansion to:

* More AI providers
* Multiple resumes
* More job analyses
* Additional recommendation features
* More sophisticated matching algorithms

## Reliability

The system should gracefully handle:

* AI service failure
* Invalid files
* Network errors
* Empty input
* Incomplete resume data
* Malformed job descriptions

---

# 29. User Experience Requirements

The user should always understand:

1. What the system is doing.
2. What information is required.
3. Whether their resume was successfully processed.
4. Whether the job description was successfully analyzed.
5. How long AI processing is taking.
6. What their match score means.
7. Why a skill was classified as missing or partial.
8. What they should improve next.

---

# 30. UI Requirements

The application should provide a modern, professional career-oriented interface.

### Required screens

1. Landing Page
2. Register
3. Login
4. Dashboard
5. Resume Upload
6. Resume Preview/Details
7. Job Description Input
8. Analysis Processing
9. Analysis Results
10. Skill Gap Details
11. Learning Roadmap
12. Analysis History
13. Report View
14. Profile/Settings

---

# 31. Error Handling

The system should display meaningful messages for:

### Authentication

> Invalid email or password.

### File Upload

> Please upload a supported PDF or DOCX file.

### File Size

> The selected file exceeds the maximum allowed size.

### Empty Job Description

> Please provide a job description before starting the analysis.

### AI Failure

> We couldn't complete the analysis right now. Please try again.

### Network Error

> Unable to connect to the server. Please check your connection and try again.

---

# 32. Privacy Considerations

Resumes may contain sensitive personal and professional information.

Therefore:

* User data should only be accessible to authorized users.
* Resume files should be securely handled.
* API credentials must remain private.
* Uploaded documents should not be publicly accessible.
* Users should be able to delete their stored resume data.
* Users should be informed that AI-generated results are recommendations and may not always be perfectly accurate.

---

# 33. Scope

## In Scope

* User authentication
* Resume upload
* PDF/DOCX processing
* Resume information extraction
* Job description input
* Job requirement extraction
* AI skill analysis
* Skill matching
* Match score
* Skill gap analysis
* Recommendations
* Learning roadmap
* Resume improvement suggestions
* Analysis history
* Report generation
* Responsive UI

## Out of Scope for Initial Version

* Job application submission
* LinkedIn integration
* Automated job applications
* Job scraping
* Recruitment management
* Human recruiter accounts
* Training an AI model from scratch
* Real-time career coaching
* Complete learning platform
* Guaranteed job recommendations

These features may be considered for future versions.

---

# 34. MVP Definition

The Minimum Viable Product must include:

```text
✓ Registration/Login
✓ Resume Upload
✓ Resume Text Extraction
✓ Job Description Input
✓ Skill Extraction
✓ Skill Matching
✓ Match Score
✓ Missing Skills
✓ AI Analysis
✓ Results Dashboard
```

The MVP should be completed before implementing advanced features.

---

# 35. Future Enhancements

Potential future versions may include:

### Version 2

* Multiple resume profiles
* Multiple target jobs
* Job recommendation system
* LinkedIn profile analysis
* Advanced ATS analysis
* Resume rewriting assistant
* AI career chatbot

### Version 3

* Personalized learning platform
* Course recommendations
* Job market trend analysis
* Salary insights
* Career progression predictions
* Advanced semantic skill matching
* Vector database and embeddings

---

# 36. Success Metrics

The project can be considered successful when:

### Functional Success

* Users can register and log in.
* Users can upload valid resumes.
* Resume text can be extracted successfully.
* Job descriptions can be analyzed.
* Skills can be identified.
* Skills can be compared.
* Match scores can be generated.
* Skill gaps can be displayed.
* Recommendations can be generated.
* Previous analyses can be retrieved.

### User Experience Success

Users should be able to understand their results without requiring technical knowledge.

### Technical Success

The application should:

* Handle common resume formats.
* Protect user data.
* Handle AI/API errors.
* Work on desktop and mobile.
* Successfully operate in production.

---

# 37. Technology Direction

The final technology stack will be formally defined in the **Technical Requirements Document (TRD)**.

The expected architecture will include:

### Frontend

* React
* JavaScript
* HTML
* CSS
* UI component/library solutions as appropriate

### Backend

* Node.js
* Express.js
* REST APIs

### Database

A relational database such as:

* MySQL or PostgreSQL

### AI

An external Large Language Model API for:

* Resume analysis
* Skill extraction
* Skill comparison
* Recommendations
* Resume suggestions

### Document Processing

Libraries/services for:

* PDF text extraction
* DOCX text extraction

### Deployment

A cloud-hosted frontend and backend with a managed database.

The exact services will be finalized during the TRD stage.

---

# 38. High-Level System Flow

```text
                    USER
                      │
                      ▼
              ┌───────────────┐
              │ Authentication│
              └───────┬───────┘
                      │
                      ▼
                ┌───────────┐
                │ Dashboard │
                └─────┬─────┘
                      │
          ┌───────────┴───────────┐
          ▼                       ▼
   ┌─────────────┐        ┌──────────────┐
   │ Resume      │        │ Job           │
   │ Upload      │        │ Description   │
   └──────┬──────┘        └──────┬───────┘
          │                       │
          ▼                       ▼
   ┌─────────────┐        ┌──────────────┐
   │ Resume      │        │ Job           │
   │ Processing  │        │ Processing    │
   └──────┬──────┘        └──────┬───────┘
          │                       │
          └──────────┬────────────┘
                     ▼
             ┌───────────────┐
             │  AI Analysis  │
             └───────┬───────┘
                     │
                     ▼
             ┌───────────────┐
             │ Skill Matching│
             └───────┬───────┘
                     │
                     ▼
             ┌───────────────┐
             │ Match Score   │
             └───────┬───────┘
                     │
          ┌──────────┼───────────┐
          ▼          ▼           ▼
       Matching    Missing     Partial
       Skills      Skills      Skills
          │          │           │
          └──────────┼───────────┘
                     ▼
             ┌───────────────┐
             │ Recommendations│
             └───────┬───────┘
                     │
                     ▼
             ┌───────────────┐
             │ Learning       │
             │ Roadmap        │
             └───────┬───────┘
                     │
                     ▼
             ┌───────────────┐
             │ Final Report   │
             └───────────────┘
```

---

# 39. Constraints

The project is being developed as a **solo project** within approximately **35 days**.

Therefore:

* Core features have priority over advanced features.
* Existing technologies should be used where appropriate.
* Complex AI model training is excluded.
* External AI services may be used.
* Development should proceed incrementally.
* Advanced features should not delay the MVP.

---

# 40. Risks

| Risk                   | Impact | Mitigation                          |
| ---------------------- | ------ | ----------------------------------- |
| AI API limitations     | High   | Design modular AI service           |
| Incorrect AI analysis  | High   | Validate and structure AI output    |
| Poor resume formatting | Medium | Support common document structures  |
| Large files            | Medium | File size limits                    |
| API cost               | High   | Control requests and token usage    |
| AI hallucination       | High   | Structured prompts and validation   |
| Security issues        | High   | Authentication and input validation |
| Deployment problems    | Medium | Deploy incrementally                |
| Scope creep            | High   | Prioritize MVP                      |

---

# 41. AI Reliability Strategy

Because AI-generated results may not always be perfect, SkillLens AI should not present AI output as absolute truth.

The system should:

* Use structured AI prompts.
* Request structured output.
* Validate AI responses.
* Separate extracted facts from AI recommendations.
* Explain that recommendations are suggestions.
* Avoid inventing candidate experience or skills.
* Avoid claiming that a user will definitely get a job.

---

# 42. Acceptance Criteria

The project will be considered ready for final deployment when a user can successfully:

```text
1. Create an account
2. Log in
3. Upload a resume
4. Have the resume processed
5. Enter a target job description
6. Start an analysis
7. Receive an AI-generated analysis
8. View the match score
9. View matching skills
10. View partial skills
11. View missing skills
12. View recommendations
13. View a learning roadmap
14. View resume improvement suggestions
15. Save the analysis
16. Reopen the analysis later
17. Generate/download the report
18. Use the application on mobile and desktop
```

---

# 43. Definition of Done

SkillLens AI will be considered complete when:

* All MVP requirements are implemented.
* Core user flows work without critical errors.
* Resume processing works with supported formats.
* AI analysis produces structured results.
* Match scoring works consistently.
* Skill gaps are displayed correctly.
* Recommendations are generated.
* User data is protected.
* Responsive UI is completed.
* Production deployment is successful.
* Final testing is completed.
* Project documentation is finalized.
* README and setup instructions are available.

---

# 44. Final Product Statement

**SkillLens AI** is an AI-powered resume and career-readiness platform that helps users understand how closely their skills match a target job and provides a personalized path for closing their skill gaps.

The product combines:

**Resume Analysis + AI + Skill Matching + Career Recommendations + Learning Roadmaps**

to transform a static resume into an actionable career-development tool.

> **SkillLens AI — See your skills. Find your gaps. Build your career.**
