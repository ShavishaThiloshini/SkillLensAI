# SkillLens AI

## UI/UX Design Brief

**Project:** SkillLens AI
**Subtitle:** AI-Powered Resume & Skill Gap Analyzer
**Document:** UI/UX Design Brief
**Version:** 1.0

---

## 1. Design Overview

SkillLens AI is an AI-powered career analysis platform that helps users understand how well their resume matches a target job and identify the skills they need to improve.

The UI/UX should communicate:

* Intelligence
* Career growth
* Trust
* Clarity
* Professionalism
* Progress
* Simplicity

The interface should feel like a **modern career intelligence platform**, not a generic AI chatbot or a traditional resume website.

The design must be:

* Modern
* Clean
* Professional
* Visually engaging
* Responsive
* Accessible
* Easy for first-time users
* Suitable for a portfolio-level software engineering project

### Core UX Principle

> **Upload → Compare → Understand → Improve → Prepare**

Every major interface decision should support this journey.

---

# 2. Design Goals

### Primary Goals

1. Make resume analysis simple for beginners.
2. Clearly communicate the user's job-match score.
3. Make missing skills immediately visible.
4. Explain AI-generated recommendations in an understandable way.
5. Turn analysis results into actionable learning steps.
6. Keep navigation simple and predictable.
7. Make sensitive resume information feel secure.
8. Create a polished experience suitable for a professional product.

### Secondary Goals

* Encourage users to complete their first analysis.
* Help users return to previous analyses.
* Make progress visually understandable.
* Reduce information overload.
* Provide useful feedback during AI processing.

---

# 3. Target User Experience

The user should feel:

### Before Analysis

> "I want to know whether I'm ready for this job."

### During Analysis

> "The system is processing my information and comparing it with the job."

### After Analysis

> "Now I understand exactly what I'm missing and what I should learn."

### Overall Feeling

**Confident → Informed → Motivated**

The product should avoid making users feel judged by their score.

Instead of:

> "Your resume is bad."

The interface should communicate:

> "Here are the areas that can strengthen your application."

---

# 4. Visual Design Direction

## Design Style

The visual style should combine:

* SaaS dashboard design
* AI product aesthetics
* Career platform professionalism
* Data visualization
* Subtle futuristic elements

Avoid excessive:

* Neon effects
* Glowing elements everywhere
* Heavy gradients
* Overly futuristic interfaces
* Excessive animations
* Generic AI robot imagery

The product should feel **intelligent without looking gimmicky**.

---

# 5. Suggested Color System

A professional dark-blue/indigo foundation with fresh accent colors is recommended.

### Primary

**Deep Navy**

`#0F172A`

Used for:

* Sidebar
* Headers
* Primary text
* Dark sections

### Primary Accent

**Indigo**

`#6366F1`

Used for:

* Primary buttons
* Active navigation
* Links
* Important UI elements

### Secondary Accent

**Cyan**

`#06B6D4`

Used for:

* AI-related indicators
* Secondary highlights
* Progress elements

### Success

**Emerald**

`#10B981`

Used for:

* Matched skills
* Successful processing
* Positive recommendations
* High readiness

### Warning

**Amber**

`#F59E0B`

Used for:

* Partial matches
* Medium-priority skills
* Warnings

### Danger

**Red**

`#EF4444`

Used for:

* Missing skills
* Failed processing
* Critical warnings

### Background

**Light**

`#F8FAFC`

Primary application background.

### Card

**White**

`#FFFFFF`

Used for:

* Dashboard cards
* Analysis sections
* Forms
* Tables

### Text

Primary:

`#0F172A`

Secondary:

`#64748B`

Muted:

`#94A3B8`

---

# 6. Typography

The typography should be modern, highly readable, and professional.

## Recommended Font

**Inter**

Alternative:

**Plus Jakarta Sans**

### Typography Hierarchy

#### H1

Large, bold page titles.

Example:

> Your Career Readiness

#### H2

Section headings.

Example:

> Skill Match Overview

#### H3

Card and component headings.

Example:

> Missing Skills

#### Body

Readable regular text.

#### Caption

Used for:

* Metadata
* File information
* Timestamps
* Supporting information

The design should avoid using too many different font families.

---

# 7. Logo & Branding

## Product Name

**SkillLens AI**

The name should be visually emphasized.

### Logo Concept

A simple lens/target concept can represent:

* Skill discovery
* Analysis
* Career direction
* Focus
* AI insight

Possible logo structure:

**Lens + Skill Spark**

The logo should work in:

* Full logo
* Icon-only form
* Dark background
* Light background
* Favicon

### Tagline

> **See your skills. Find your gaps. Build your career.**

---

# 8. Overall Application Layout

The authenticated application should use a modern dashboard layout.

### Desktop

```text
┌─────────────────────────────────────────────────────┐
│ Logo                              Profile / Alerts  │
├───────────────┬─────────────────────────────────────┤
│               │                                     │
│ Dashboard     │                                     │
│ Resume        │            Main Content             │
│ Job Target    │                                     │
│ Analysis      │                                     │
│ History       │                                     │
│               │                                     │
│ Settings      │                                     │
│               │                                     │
│               │                                     │
└───────────────┴─────────────────────────────────────┘
```

### Sidebar

Navigation:

* Dashboard
* My Resume
* Job Target
* Analyze
* History
* Profile
* Settings

The active page should have a clear visual indicator.

---

# 9. Landing Page

The landing page should introduce SkillLens AI before authentication.

## Hero Section

Main headline:

> **Know How Ready You Are for Your Next Role.**

Supporting text:

> Upload your resume, compare it with a target job, discover your skill gaps, and get a personalized roadmap to improve.

Primary CTA:

**Analyze My Resume**

Secondary CTA:

**See How It Works**

### Hero Visual

A dashboard preview showing:

* Match score
* Skill categories
* Missing skills
* Learning recommendations

The visual should communicate the product immediately.

---

# 10. Landing Page Sections

### Section 1 — Hero

Product introduction and CTA.

### Section 2 — How It Works

Three or four steps:

1. Upload Resume
2. Add Target Job
3. Analyze Skills
4. Get Your Roadmap

### Section 3 — Key Benefits

Cards:

* Resume Analysis
* Skill Gap Detection
* AI Recommendations
* Learning Roadmap

### Section 4 — Analysis Preview

Show an example analysis dashboard.

### Section 5 — Trust & Privacy

Explain that user documents should be handled securely.

### Section 6 — Final CTA

Example:

> **Ready to see where your skills stand?**

Button:

**Start Your Analysis**

---

# 11. Authentication UI

Authentication should be simple and distraction-free.

## Login Page

Fields:

* Email
* Password

Actions:

* Login
* Forgot password if implemented
* Create account

## Register Page

Fields:

* Full name
* Email
* Password
* Confirm password

Optional:

* Terms/privacy agreement

### Design

Use a centered authentication card with:

* SkillLens AI logo
* Short supporting text
* Clearly labeled fields
* Visible validation
* Strong primary CTA

---

# 12. Dashboard

The dashboard is the user's primary workspace.

## Dashboard Header

Example:

> **Good morning, Shaa 👋**

Supporting text:

> Ready to see how your skills match your next opportunity?

---

## Main Dashboard Sections

### 1. Latest Analysis

Large card displaying:

* Match score
* Target job
* Analysis date
* Overall status

Example:

```text
Frontend Developer

82%
Strong Match

Analyzed:
Oct 05, 2026
```

### 2. Skill Overview

Display:

* Matched skills
* Partial skills
* Missing skills

Example:

```text
Matched       12
Partial        5
Missing        3
```

### 3. Skill Gap Summary

Show the highest-priority missing skills.

Example:

```text
High Priority
TypeScript
Testing
Docker
```

### 4. Recommended Learning

Display 3–5 recommended areas.

### 5. Recent Analyses

A compact history list.

---

# 13. Resume Upload Experience

Resume upload should be one of the most polished interactions in the application.

## Upload Area

Large drag-and-drop card.

Example:

```text
        ↑

Drop your resume here

PDF or DOCX
Maximum file size: X MB

[ Browse Files ]
```

### Supported States

#### Empty

Display upload instructions.

#### Dragging

Highlight the upload area.

#### Uploading

Show:

* File name
* Upload progress
* Progress indicator

#### Processing

Show:

> Analyzing your resume structure...

Possible steps:

```text
✓ File uploaded
✓ Text extracted
● Detecting skills
○ Preparing resume profile
```

#### Success

Show:

> Resume ready for analysis.

#### Error

Show a clear explanation and retry button.

---

# 14. Resume Preview

After processing, show a resume summary.

### Information

* File name
* Upload date
* File type
* Extracted name
* Contact information
* Education
* Experience
* Skills
* Certifications

Avoid displaying an overwhelming amount of extracted text.

Use organized sections.

---

# 15. Job Description Interface

The user should have two possible input methods if implemented:

### Option A

Paste job description.

### Option B

Upload job description document.

---

## Job Input Screen

Header:

> **What role are you targeting?**

Fields:

* Job title
* Company
* Job description

Large text area:

> Paste the job description here...

CTA:

**Analyze Job Requirements**

---

# 16. Job Requirement Preview

Before analysis begins, show extracted requirements.

Example:

### Required Skills

* JavaScript
* React
* Git
* REST APIs

### Preferred Skills

* TypeScript
* Docker
* AWS

### Experience

> 1–3 years of software development experience

### Education

> Bachelor's degree or equivalent

This allows the user to verify that the system understood the job description.

---

# 17. Analysis Processing Screen

AI analysis may take several seconds.

The user should never see a blank screen.

Display an engaging processing experience.

Example:

```text
Analyzing Your Career Fit

✓ Resume processed
✓ Job requirements identified
● Comparing your skills
○ Evaluating experience
○ Preparing recommendations
```

Supporting message:

> We're comparing your resume with the role requirements and preparing personalized insights.

Avoid fake progress percentages unless the actual process supports them.

---

# 18. Analysis Results Dashboard

This is the **most important UI screen** in SkillLens AI.

The results page should immediately communicate the user's overall position.

---

## Hero Result Card

Large score display:

```text
82%

Strong Match

Frontend Developer
```

Supporting text:

> Your resume aligns well with most of the technical requirements for this role.

---

# 19. Match Score Visualization

Use a circular progress chart or large radial score.

Example:

```text
       ╭───────╮
      │  82%   │
       ╰───────╯

Strong Match
```

The score should not be the only information displayed.

Always provide context.

---

# 20. Match Breakdown

Use cards or a horizontal chart.

Example:

| Category       | Score |
| -------------- | ----: |
| Skills         |   90% |
| Experience     |   75% |
| Education      |   85% |
| Certifications |   70% |

This makes the score explainable.

---

# 21. Skill Matching Interface

Skills should be grouped into three clear categories.

## Matched Skills

Use success styling.

Example:

* JavaScript
* React
* HTML
* CSS
* Git

## Partial Matches

Use warning styling.

Example:

* TypeScript
* Testing

## Missing Skills

Use danger styling.

Example:

* Docker
* AWS
* CI/CD

Each skill can be displayed as a badge/chip.

---

# 22. Skill Detail View

Clicking a skill should reveal more information.

Example:

### TypeScript

**Status:** Partial Match

**Why:**

> The target role requires TypeScript, but it is not clearly demonstrated in your resume.

**Priority:** High

**Recommendation:**

> Build a small React project using TypeScript and add the experience to your portfolio.

---

# 23. Skill Gap Dashboard

The skill gap section should prioritize what the user should learn first.

### Priority levels

🔴 **High**

Required for the target role and currently missing.

🟡 **Medium**

Useful or partially demonstrated skills.

🟢 **Low**

Optional skills that can improve competitiveness.

---

# 24. Experience Alignment

Display a clear comparison.

Example:

```text
Required Experience
2+ years

Your Resume
1.5 years

Alignment
Partial
```

Provide a short explanation rather than only showing a number.

---

# 25. Education Alignment

Example:

```text
Required:
Bachelor's Degree

Detected:
BSc in Software Engineering

Status:
✓ Aligned
```

The system should avoid making definitive claims when information is ambiguous.

---

# 26. AI Recommendations

Recommendations should be displayed as actionable cards.

Example:

### Improve TypeScript

**Why it matters**

TypeScript is listed as a required skill for the target role.

**What to do**

1. Learn TypeScript fundamentals.
2. Convert a small React project.
3. Practice interfaces and generics.
4. Add the project to your portfolio.

CTA:

**Add to Roadmap**

---

# 27. Learning Roadmap

The roadmap should visually represent progress.

Example:

```text
STEP 01
TypeScript Fundamentals
       │
       ▼
STEP 02
TypeScript + React
       │
       ▼
STEP 03
Build a Project
       │
       ▼
STEP 04
Update Resume
```

Each step should contain:

* Skill
* Objective
* Suggested action
* Estimated difficulty
* Completion status

---

# 28. Resume Improvement Suggestions

Display suggestions separately from skill gaps.

Examples:

### Experience Section

> Add measurable outcomes to your project descriptions.

### Skills Section

> Move role-relevant technical skills higher in the section.

### Projects

> Include technologies used and the impact of each project.

Suggestions should be specific and actionable.

---

# 29. Analysis History

The history page should allow users to revisit previous analyses.

Example table:

| Job                | Match | Date   | Status    |
| ------------------ | ----: | ------ | --------- |
| Frontend Developer |   82% | Oct 05 | Completed |
| UI Engineer        |   74% | Oct 02 | Completed |
| React Developer    |   68% | Sep 29 | Completed |

Actions:

* View
* Download Report
* Delete

---

# 30. Progress & Analytics

If implemented, users can see career progress over time.

Possible charts:

### Match Score Over Time

Line chart showing previous analysis scores.

### Skill Gap Progress

Bar chart showing improvement.

### Skill Category Distribution

Chart displaying:

* Technical
* Soft Skills
* Tools
* Frameworks
* Cloud
* Other

Charts should communicate useful information rather than simply decorate the dashboard.

---

# 31. Report Page

The report should provide a clean summary of the analysis.

Sections:

1. Candidate summary
2. Target role
3. Match score
4. Skill breakdown
5. Missing skills
6. Experience alignment
7. Education alignment
8. Recommendations
9. Learning roadmap
10. Resume suggestions

CTA:

**Download Report**

If PDF generation is implemented, the generated report should use a clean print-friendly layout.

---

# 32. Navigation

## Desktop Navigation

Sidebar:

* Dashboard
* Resume
* Job Target
* Analyze
* History
* Profile
* Settings

Bottom area:

* Help
* User profile
* Logout

## Mobile Navigation

Use a compact mobile navigation system.

Possible structure:

```text
┌───────────────────────┐
│ SkillLens AI      ☰   │
├───────────────────────┤
│                       │
│      Page Content     │
│                       │
├───────────────────────┤
│ Home │ Resume │ More  │
└───────────────────────┘
```

---

# 33. Responsive Design

The application must work across:

* Desktop
* Laptop
* Tablet
* Mobile

### Desktop

Use:

* Sidebar
* Multi-column dashboard
* Large charts
* Wide analysis cards

### Tablet

Use:

* Collapsible sidebar
* Two-column layouts where appropriate
* Reduced spacing

### Mobile

Use:

* Single-column layout
* Bottom navigation or compact header
* Stacked cards
* Horizontal scrolling for certain charts/tables when necessary
* Large touch targets
* Simplified data visualizations

---

# 34. Component Design System

Reusable components should be created.

### Buttons

Variants:

* Primary
* Secondary
* Outline
* Danger
* Ghost

### Cards

Variants:

* Standard
* Highlight
* Score
* Recommendation
* Skill
* Roadmap

### Inputs

* Text input
* Password
* Textarea
* Select
* File upload

### Feedback

* Toast
* Alert
* Modal
* Confirmation dialog

### Data Display

* Badge
* Progress bar
* Score indicator
* Chart
* Timeline
* Table

---

# 35. Iconography

Use one consistent icon system.

Recommended:

**Lucide React**

Icons should support the interface rather than replace labels.

Examples:

* Dashboard → LayoutDashboard
* Resume → FileText
* Job → Briefcase
* Analysis → ScanSearch
* History → History
* Settings → Settings
* Profile → User
* Upload → Upload
* Skills → Sparkles / Brain
* Roadmap → Map

---

# 36. Interaction & Animation

Animations should be subtle and purposeful.

Recommended:

* Card hover transitions
* Button hover states
* Upload drag animation
* Progress animation
* Chart entrance animation
* Modal transitions
* Sidebar transitions
* Skill badge appearance

Avoid:

* Constant floating animations
* Excessive glowing
* Long transitions
* Distracting motion

### Animation Duration

Most UI transitions should feel fast, approximately:

**150–300ms**

---

# 37. Loading States

Every asynchronous operation should have a visible state.

Required:

* Login loading
* Register loading
* Resume upload
* Resume processing
* Job processing
* AI analysis
* Report generation
* Data loading

Use skeletons where appropriate.

---

# 38. Empty States

Empty states should guide the user.

### No Resume

> You haven't uploaded a resume yet.

CTA:

**Upload Resume**

### No Analysis

> Complete your first analysis to see your career match.

CTA:

**Start Analysis**

### No History

> Your completed analyses will appear here.

---

# 39. Error States

Errors should be understandable and actionable.

Avoid:

> Error 500.

Prefer:

> We couldn't process your resume right now.

Actions:

**Try Again**

or

**Upload Another File**

---

# 40. Accessibility

The UI must follow accessibility best practices.

Requirements:

* Sufficient color contrast
* Keyboard navigation
* Visible focus states
* Semantic HTML
* Accessible labels
* Descriptive buttons
* Alternative text for meaningful images
* Do not rely only on color to communicate status
* Responsive text sizing
* Touch-friendly controls

For example, missing skills should not be communicated only through red color.

Use:

**Missing — High Priority**

instead.

---

# 41. Privacy & Trust UX

Because resumes contain personal information, the interface should communicate privacy clearly.

Include:

* Secure upload messaging
* File type information
* Clear delete controls
* Confirmation before deleting sensitive data
* Privacy explanation
* No unnecessary exposure of personal information

Example:

> Your resume is used to generate your analysis and is associated with your account.

Avoid making unsupported claims such as "100% secure" unless technically verified.

---

# 42. AI Transparency

AI-generated information should be presented responsibly.

Where appropriate, use labels such as:

**AI Insight**

**AI Recommendation**

**AI-Generated Summary**

The interface should remind users that recommendations are suggestions and should be reviewed.

Example:

> AI-generated recommendation. Review before using it in your final resume.

---

# 43. Confirmation Dialogs

Destructive actions should require confirmation.

Examples:

### Delete Resume

> Delete this resume?

> This will remove the uploaded resume and associated information.

Buttons:

**Cancel**

**Delete Resume**

### Delete Analysis

> Delete this analysis?

Buttons:

**Cancel**

**Delete Analysis**

---

# 44. Mobile Analysis Experience

The results page is information-heavy, so mobile design must prioritize hierarchy.

Recommended order:

1. Match Score
2. Match Summary
3. Skill Summary
4. Missing Skills
5. Experience
6. Education
7. Recommendations
8. Learning Roadmap
9. Resume Suggestions
10. Download Report

This prevents users from facing a huge wall of information.

---

# 45. Figma Design Structure

The Figma project should be organized into pages.

```text
SkillLens AI
│
├── Cover
├── Design System
├── Components
├── Landing Page
├── Authentication
├── Dashboard
├── Resume
├── Job Target
├── Analysis
├── History
├── Roadmap
├── Report
├── Profile
└── Mobile
```

---

# 46. Design System Components

Before designing all pages, create reusable components in Figma.

### Foundations

* Colors
* Typography
* Spacing
* Shadows
* Border radius
* Icons

### Components

* Buttons
* Inputs
* Cards
* Badges
* Navigation
* Modal
* Progress indicators
* Score cards
* Skill chips
* Tables
* Charts
* Upload component

This will keep the interface visually consistent.

---

# 47. Spacing System

Use a consistent spacing scale.

Suggested base:

```text
4px
8px
12px
16px
24px
32px
48px
64px
```

Avoid arbitrary spacing values throughout the interface.

---

# 48. Border Radius

Recommended:

* Small controls: 8px
* Cards: 12–16px
* Large feature cards: 20px
* Buttons: 8–10px
* Upload area: 16–20px

The interface should feel modern without becoming overly rounded.

---

# 49. Shadow System

Use subtle shadows.

Avoid heavy floating-card effects.

Suggested visual hierarchy:

* Small shadow → inputs/cards
* Medium shadow → dropdowns/modals
* Stronger shadow → important overlays

---

# 50. UX Writing Guidelines

The product language should be:

* Clear
* Friendly
* Professional
* Encouraging
* Direct

Avoid overly technical language where possible.

Instead of:

> Execute semantic skill extraction pipeline.

Use:

> We're identifying the skills in your resume.

Instead of:

> Analysis failed due to parsing exception.

Use:

> We couldn't read this document. Try uploading another PDF or DOCX file.

---

# 51. Key CTA Strategy

Primary actions should be visually obvious.

Examples:

**Analyze My Resume**

**Upload Resume**

**Start Analysis**

**View Results**

**Add to Roadmap**

**Download Report**

Secondary actions should not visually compete with the primary CTA.

---

# 52. First-Time User Experience

A new user should receive a guided experience.

Dashboard should show:

### Step 1

Upload your resume.

### Step 2

Add a target job.

### Step 3

Run your first analysis.

### Step 4

Review your skill gaps.

### Step 5

Build your improvement roadmap.

This can be represented with a progress checklist.

---

# 53. Overall UX Flow

```text
Landing
   ↓
Register / Login
   ↓
Dashboard
   ↓
Upload Resume
   ↓
Resume Processing
   ↓
Resume Ready
   ↓
Add Target Job
   ↓
Job Processing
   ↓
Review Requirements
   ↓
Start Analysis
   ↓
AI Processing
   ↓
Analysis Results
   ↓
Match Score
   ↓
Skill Comparison
   ↓
Skill Gaps
   ↓
Recommendations
   ↓
Learning Roadmap
   ↓
Resume Suggestions
   ↓
Save Analysis
   ↓
Download Report
```

---

# 54. Design Success Criteria

The UI/UX design will be considered successful when:

* A new user understands the product within seconds.
* Resume upload is straightforward.
* Job description input is simple.
* AI processing states are understandable.
* Match score is immediately visible.
* Users can quickly identify missing skills.
* Recommendations are actionable.
* The learning roadmap is easy to follow.
* Previous analyses are easy to access.
* The application works well on mobile.
* The interface looks professional enough for a portfolio project.
* Accessibility is considered throughout the product.
* Sensitive resume information is handled with appropriate trust messaging.

---

# 55. Final Design Direction

SkillLens AI should feel like a **professional career intelligence dashboard** rather than a simple resume checker.

The visual identity should combine:

**Professional SaaS + AI Intelligence + Career Growth + Data Visualization**

The experience should guide users from uncertainty to action:

> **"Where do I stand?"**

↓

> **"What am I missing?"**

↓

> **"What should I improve?"**

↓

> **"What should I do next?"**

The final interface should make SkillLens AI feel like a product that could realistically be used by students, graduates, job seekers, and early-career professionals.

### Core Design Statement

> **SkillLens AI helps users see their current skills clearly, understand where they fall short, and turn those gaps into a practical path toward their target career.**
