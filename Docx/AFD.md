# SkillLens AI

## Application Flow Document

**Project Title:** SkillLens AI
**Subtitle:** AI-Powered Resume & Skill Gap Analyzer
**Project Type:** Solo Web Application
**Development Duration:** 35 Days
**Document Version:** 1.0
**Status:** Planned

---

# 1. Document Purpose

This document defines the complete navigation and interaction flow of SkillLens AI.

It describes:

* User journeys
* Screen-to-screen navigation
* Authentication flow
* Resume processing flow
* Job description flow
* AI analysis flow
* Skill gap flow
* Recommendation flow
* Learning roadmap flow
* Analysis history
* Report generation
* Error and recovery flows

The document will serve as a reference for UI/UX design and implementation.

---

# 2. Application Overview

The primary application journey is:

```text
Landing Page
     ↓
Register / Login
     ↓
Dashboard
     ↓
Upload Resume
     ↓
Enter Job Description
     ↓
Review Inputs
     ↓
Start Analysis
     ↓
Processing
     ↓
AI Analysis
     ↓
Match Score
     ↓
Skill Analysis
     ↓
Skill Gap
     ↓
Recommendations
     ↓
Learning Roadmap
     ↓
Resume Suggestions
     ↓
Save Analysis
     ↓
Generate Report
```

---

# 3. Application Navigation Structure

```text
SkillLens AI
│
├── Public
│   ├── Landing
│   ├── Login
│   └── Register
│
└── Protected
    │
    ├── Dashboard
    │
    ├── Resume
    │   ├── Upload
    │   ├── Preview
    │   └── Details
    │
    ├── Job Description
    │   ├── Create
    │   └── Details
    │
    ├── Analysis
    │   ├── Processing
    │   ├── Overview
    │   ├── Skills
    │   ├── Experience
    │   ├── Recommendations
    │   ├── Roadmap
    │   └── Resume Suggestions
    │
    ├── History
    │   └── Previous Analyses
    │
    ├── Report
    │
    └── Profile / Settings
```

---

# 4. Public User Flow

## 4.1 Landing Page

The user enters the application.

### Main actions

* Get Started
* Login
* Register
* Learn About SkillLens AI

### Flow

```text
Landing Page
    │
    ├── Get Started → Register
    │
    ├── Login → Login Page
    │
    └── Learn More → Product Information
```

---

# 5. Registration Flow

## Screen: Register

User provides:

* Name
* Email
* Password
* Confirm password

### Flow

```text
Register
   ↓
Enter Information
   ↓
Client Validation
   ↓
Submit
   ↓
Backend Validation
   ↓
Create Account
   ↓
Success
   ↓
Login / Dashboard
```

### Validation

If invalid:

```text
Register
   ↓
Invalid Data
   ↓
Display Error
   ↓
User Corrects Data
   ↓
Submit Again
```

---

# 6. Login Flow

## Screen: Login

User enters:

* Email
* Password

### Flow

```text
Login
   ↓
Enter Credentials
   ↓
Validate
   ↓
Send Login Request
   ↓
Verify Credentials
   ↓
Generate Authentication Token
   ↓
Login Success
   ↓
Dashboard
```

### Failed Login

```text
Login
   ↓
Invalid Credentials
   ↓
Error Message
   ↓
Try Again
```

---

# 7. Authentication State Flow

After login:

```text
Authenticated User
        ↓
Protected Application
```

If authentication is missing:

```text
Protected Page
      ↓
No Valid Authentication
      ↓
Redirect to Login
```

If authentication expires:

```text
API Request
    ↓
Unauthorized
    ↓
Clear Authentication
    ↓
Redirect to Login
```

---

# 8. Dashboard Flow

The dashboard is the main application hub.

### Dashboard should display:

* Welcome message
* Current resume status
* Start new analysis
* Recent analyses
* Average match score
* Top skill gap
* Quick actions

### Main flow

```text
Dashboard
   │
   ├── Upload Resume
   │
   ├── Start New Analysis
   │
   ├── View Previous Analysis
   │
   └── Profile / Settings
```

---

# 9. First-Time User Flow

A new user may not have a resume.

```text
Login
  ↓
Dashboard
  ↓
No Resume Detected
  ↓
Upload Resume
  ↓
Resume Processing
  ↓
Resume Ready
  ↓
Start Analysis
```

---

# 10. Resume Upload Flow

## Screen: Resume Upload

User selects a file.

Supported:

* PDF
* DOCX

### Flow

```text
Resume Upload
      ↓
Select File
      ↓
File Validation
      ↓
Valid?
 ┌────┴────┐
 │         │
YES        NO
 │         │
 ▼         ▼
Upload   Error
 │
 ▼
Processing
```

---

# 11. Invalid Resume Flow

If the file is invalid:

```text
Select File
    ↓
Validation
    ↓
Invalid
    ↓
Show Error
    ↓
User Selects Another File
```

Possible messages:

> Unsupported file type.

> File size exceeds the allowed limit.

> Unable to read this document.

---

# 12. Resume Processing Flow

After successful upload:

```text
Upload
  ↓
Store File
  ↓
Extract Text
  ↓
Clean Text
  ↓
Identify Sections
  ↓
Parse Resume
  ↓
Generate Structured Data
  ↓
Save Resume Data
  ↓
Processing Complete
```

---

# 13. Resume Processing UI

While processing, the user should see progress.

Example:

```text
Processing your resume...

✓ Uploading resume
✓ Extracting text
✓ Identifying sections
● Analyzing skills
○ Preparing resume profile
```

After completion:

```text
Resume Ready ✓
```

---

# 14. Resume Details Flow

After processing:

```text
Resume Ready
     ↓
Resume Details
```

The user can view:

* Name
* Summary
* Skills
* Education
* Experience
* Projects
* Certifications

### Actions

* Replace resume
* Delete resume
* Continue to job description

---

# 15. Job Description Flow

## Screen: Job Description

The user can paste the target job description.

### Flow

```text
Job Description
      ↓
Enter Text
      ↓
Validate
      ↓
Save
      ↓
Process Requirements
```

---

# 16. Job Description Validation

If empty:

```text
Empty Input
    ↓
Show Message
    ↓
User Adds Description
```

If too short:

```text
Insufficient Information
    ↓
Ask User for More Details
```

The system should avoid sending meaningless input to the AI service.

---

# 17. Job Requirement Processing

After the job description is submitted:

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
Job Data Ready
```

---

# 18. Job Requirement Preview

Before starting the analysis, the user may see:

```text
Target Role
Frontend Developer

Required Skills
✓ React
✓ JavaScript
✓ Git

Preferred Skills
○ TypeScript
○ Docker

Experience
2+ years
```

### Action

**Continue to Analysis**

---

# 19. Analysis Preparation Flow

The system should verify:

```text
Resume Available?
       ↓
Job Description Available?
       ↓
Both Valid?
       ↓
Start Analysis
```

If either is missing:

```text
Analysis Cannot Start
        ↓
Identify Missing Input
        ↓
Return User to Required Step
```

---

# 20. Start Analysis Flow

User selects:

**Analyze My Resume**

Then:

```text
Start Analysis
      ↓
Create Analysis Record
      ↓
Collect Resume Data
      ↓
Collect Job Data
      ↓
Send Analysis Request
      ↓
AI Processing
```

---

# 21. AI Processing Flow

The analysis process:

```text
Resume Data
      │
      ├───────────────┐
      │               │
      ▼               ▼
Resume Skills     Experience
      │               │
      └───────┬───────┘
              │
              ▼
       Job Requirements
              │
              ▼
         AI Analysis
              │
              ▼
       Structured Result
              │
              ▼
      Validate Response
              │
              ▼
       Calculate Score
              │
              ▼
       Save Analysis
```

---

# 22. AI Processing Screen

The system should communicate progress.

Example:

```text
🔍 Analyzing your resume...

✓ Resume information extracted
✓ Job requirements identified
✓ Skills compared
● Calculating compatibility
○ Generating recommendations
○ Building learning roadmap
```

The user should not be able to accidentally submit multiple analyses while processing.

---

# 23. AI Failure Flow

If AI processing fails:

```text
AI Request
    ↓
Failure
    ↓
Retry
```

If retry succeeds:

```text
Retry
  ↓
Analysis Continues
```

If retry fails:

```text
Retry Failed
    ↓
Display Friendly Error
    ↓
Analysis Marked Failed
    ↓
User Can Try Again
```

Example:

> We couldn't complete your analysis right now. Please try again.

---

# 24. Analysis Results Flow

After successful processing:

```text
AI Analysis Complete
        ↓
Results Dashboard
```

The results page begins with the overall match score.

Example:

```text
Your Match Score

78%
```

---

# 25. Results Overview

The overview should contain:

```text
┌────────────────────────────┐
│       MATCH SCORE          │
│           78%              │
└────────────────────────────┘

🟢 Strong Matches
🟡 Partial Matches
🔴 Skill Gaps

Experience: Strong
Education: Good
Overall: Good Match
```

---

# 26. Skill Analysis Flow

The user can open the Skills section.

```text
Analysis
   ↓
Skills
   ↓
Matching Skills
Partial Skills
Missing Skills
```

### Example

```text
🟢 Matching
React
JavaScript
Git

🟡 Partial
Node.js

🔴 Missing
TypeScript
Docker
AWS
```

---

# 27. Skill Detail Flow

When the user selects a skill:

```text
Skill
 ↓
Skill Details
 ↓
Why It Matters
 ↓
Current Status
 ↓
Priority
 ↓
Recommendation
```

Example:

```text
TypeScript

Status: Missing
Priority: High

Why it matters:
Required by the target position.

Recommendation:
Build TypeScript fundamentals
and convert a React project to TypeScript.
```

---

# 28. Experience Analysis Flow

```text
Analysis
   ↓
Experience
```

The page displays:

* Candidate experience
* Required experience
* Experience alignment
* AI explanation

Example:

```text
Required: 2+ years
Candidate: 1.5 years

Assessment:
Partially aligned
```

---

# 29. Education Analysis Flow

```text
Analysis
   ↓
Education
```

Displays:

* Candidate education
* Required education
* Alignment
* Explanation

---

# 30. Recommendations Flow

```text
Analysis
   ↓
Recommendations
```

The system displays:

### Immediate Improvements

* Learn TypeScript
* Improve Docker knowledge
* Add relevant keywords

### Longer-Term Improvements

* Cloud fundamentals
* Advanced backend development
* DevOps knowledge

---

# 31. Learning Roadmap Flow

```text
Missing Skills
      ↓
Prioritize Skills
      ↓
Determine Learning Order
      ↓
Generate Roadmap
```

Example:

```text
1. TypeScript
       ↓
2. Docker
       ↓
3. AWS
```

Each roadmap item can contain:

* Skill name
* Priority
* Reason
* Suggested learning areas

---

# 32. Resume Improvement Flow

```text
Analysis
   ↓
Resume Suggestions
```

The system may show:

### Summary

> Consider making your professional summary more specific to frontend development.

### Projects

> Add measurable outcomes to your project descriptions where possible.

### Skills

> Consider highlighting TypeScript if you gain practical experience with it.

---

# 33. Analysis Navigation

The results dashboard should allow navigation between:

```text
Overview
   │
   ├── Skills
   ├── Experience
   ├── Education
   ├── Recommendations
   ├── Learning Roadmap
   └── Resume Suggestions
```

The user should be able to move between sections without losing the analysis.

---

# 34. Save Analysis Flow

After successful analysis:

```text
Analysis Complete
      ↓
Save Result
      ↓
Database
      ↓
Analysis History
```

The analysis should be associated with the authenticated user.

---

# 35. Analysis History Flow

## Screen: History

The user can view previous analyses.

Example:

```text
Analysis History

Frontend Developer
78%
Sep 28, 2026

React Developer
84%
Sep 25, 2026

Full Stack Developer
65%
Sep 20, 2026
```

### Actions

* View
* Generate report
* Delete

---

# 36. Previous Analysis Flow

```text
History
   ↓
Select Analysis
   ↓
Analysis Details
```

The system retrieves the saved analysis from the database.

---

# 37. Report Generation Flow

```text
Analysis
   ↓
Generate Report
   ↓
Prepare Report Data
   ↓
Create Report
   ↓
Preview
   ↓
Download
```

Report contents:

* Candidate information
* Target job
* Match score
* Skills
* Skill gaps
* Experience
* Education
* Recommendations
* Learning roadmap
* Resume suggestions

---

# 38. Profile Flow

```text
Dashboard
   ↓
Profile
```

The user can manage:

* Name
* Email
* Account settings
* Password
* Stored resume
* Account preferences

---

# 39. Delete Resume Flow

```text
Resume
   ↓
Delete
   ↓
Confirmation
   ↓
User Confirms
   ↓
Delete Resume Data
   ↓
Success
```

Confirmation example:

> Are you sure you want to delete this resume?

---

# 40. Delete Analysis Flow

```text
History
   ↓
Delete Analysis
   ↓
Confirmation
   ↓
Delete
   ↓
Refresh History
```

---

# 41. Logout Flow

```text
Dashboard
   ↓
Logout
   ↓
Clear Authentication
   ↓
Redirect to Landing/Login
```

---

# 42. Global Error Flow

Any unexpected error should follow:

```text
Action
  ↓
Error
  ↓
Capture Error
  ↓
Log Securely
  ↓
Show User-Friendly Message
```

The system should never expose technical stack traces to the user.

---

# 43. Network Error Flow

```text
API Request
    ↓
Network Failure
    ↓
Show Error
    ↓
Retry
```

Example:

> Unable to connect to SkillLens AI. Please check your internet connection and try again.

---

# 44. Session Expiration Flow

```text
User Activity
     ↓
API Request
     ↓
Token Expired
     ↓
401 Response
     ↓
Clear Session
     ↓
Redirect to Login
```

---

# 45. Empty State Flows

## No Resume

```text
Dashboard
   ↓
No Resume
   ↓
"Upload Your Resume"
```

## No Analysis

```text
History
   ↓
No Previous Analyses
   ↓
"Start Your First Analysis"
```

## No Recommendations

```text
Recommendations
   ↓
No Significant Gaps
   ↓
"Your profile strongly matches this role."
```

---

# 46. Complete New User Journey

The ideal first-time user experience:

```text
LANDING
   ↓
REGISTER
   ↓
LOGIN
   ↓
DASHBOARD
   ↓
UPLOAD RESUME
   ↓
RESUME PROCESSING
   ↓
RESUME READY
   ↓
ENTER JOB DESCRIPTION
   ↓
JOB PROCESSING
   ↓
REVIEW REQUIREMENTS
   ↓
START ANALYSIS
   ↓
AI PROCESSING
   ↓
RESULTS
   ↓
MATCH SCORE
   ↓
SKILL ANALYSIS
   ↓
SKILL GAPS
   ↓
RECOMMENDATIONS
   ↓
LEARNING ROADMAP
   ↓
RESUME SUGGESTIONS
   ↓
SAVE ANALYSIS
   ↓
GENERATE REPORT
```

---

# 47. Returning User Journey

```text
LOGIN
  ↓
DASHBOARD
  │
  ├── Existing Resume
  │       ↓
  │   Start New Analysis
  │
  ├── Recent Analysis
  │       ↓
  │   View Results
  │
  └── History
          ↓
      Previous Reports
```

---

# 48. Complete System Flow

```text
                         ┌──────────────┐
                         │    LANDING   │
                         └──────┬───────┘
                                │
                     ┌──────────┴──────────┐
                     ▼                     ▼
                 REGISTER                LOGIN
                     │                     │
                     └──────────┬──────────┘
                                ▼
                         ┌─────────────┐
                         │  DASHBOARD  │
                         └──────┬──────┘
                                │
                    ┌───────────┴───────────┐
                    ▼                       ▼
              RESUME MANAGEMENT       HISTORY
                    │                       │
                    ▼                       ▼
              UPLOAD RESUME          VIEW ANALYSIS
                    │
                    ▼
              PROCESS RESUME
                    │
                    ▼
              RESUME READY
                    │
                    ▼
            JOB DESCRIPTION
                    │
                    ▼
            PROCESS JOB DATA
                    │
                    ▼
              START ANALYSIS
                    │
                    ▼
              AI PROCESSING
                    │
                    ▼
             VALIDATE RESULT
                    │
                    ▼
              MATCH SCORE
                    │
          ┌─────────┼─────────┐
          ▼         ▼         ▼
       MATCHED   PARTIAL    MISSING
          │         │         │
          └─────────┼─────────┘
                    ▼
             RECOMMENDATIONS
                    │
                    ▼
             LEARNING ROADMAP
                    │
                    ▼
           RESUME SUGGESTIONS
                    │
                    ▼
             SAVE ANALYSIS
                    │
                    ▼
             GENERATE REPORT
```

---

# 49. Navigation Rules

## Public Routes

```text
/
/login
/register
```

## Protected Routes

```text
/dashboard
/resume
/jobs
/analysis/:id
/history
/report/:id
/profile
/settings
```

Users attempting to access protected routes without authentication should be redirected to `/login`.

---

# 50. Back Navigation Rules

The user should be able to return to:

* Dashboard
* Previous analysis sections
* History
* Resume details

However, leaving an unfinished analysis should not accidentally discard data.

If necessary, the application should display a confirmation.

---

# 51. Analysis State Management

An analysis can have states such as:

```text
DRAFT
   ↓
PROCESSING
   ↓
COMPLETED
```

or:

```text
PROCESSING
   ↓
FAILED
```

Possible recovery:

```text
FAILED
  ↓
RETRY
  ↓
PROCESSING
  ↓
COMPLETED
```

---

# 52. User Flow Priorities

### Critical Flow

```text
Login
 ↓
Resume
 ↓
Job
 ↓
Analysis
 ↓
Results
```

### Secondary Flow

```text
Results
 ↓
Recommendations
 ↓
Roadmap
 ↓
Resume Suggestions
```

### Supporting Flow

```text
History
 ↓
Previous Analysis
 ↓
Report
```

---

# 53. App Flow Acceptance Criteria

The application flow will be considered complete when:

* A new user can register.
* A registered user can log in.
* An authenticated user can access the dashboard.
* A user can upload a supported resume.
* Resume processing provides clear feedback.
* A user can provide a job description.
* The system validates required inputs.
* A user can start an analysis.
* AI processing displays progress.
* Successful analysis leads to the results dashboard.
* Results can be navigated by section.
* Skill gaps are visible.
* Recommendations are visible.
* A learning roadmap is available.
* Analysis results are saved.
* Previous analyses can be opened.
* Reports can be generated.
* Errors have recovery paths.
* Protected information cannot be accessed by unauthorized users.

---

# 54. Final Application Journey

The core experience of SkillLens AI should feel like:

> **Upload → Compare → Understand → Improve → Prepare**

The application should minimize unnecessary steps and guide the user from their existing resume to a clear understanding of what they need to improve for their target role.

---

# 55. Final Flow Statement

SkillLens AI's application flow is designed around a single central objective:

> **Help the user move from “Do I qualify for this job?” to “I know exactly what I need to improve.”**

The flow should therefore remain simple, progressive, transparent, and actionable while the underlying system performs the complex document processing and AI analysis behind the scenes.
