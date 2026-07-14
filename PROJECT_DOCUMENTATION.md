# ResumeFit AI - Project Documentation

## 1. Project Overview

ResumeFit AI is a web application that compares a candidate resume with a job description and optional HR checklist. It uses Gemini first, then Groq as a provider fallback when configured, to extract resume information, understand job requirements, compare both sides, and generate a matching percentage with an HR-style report.

The application is designed as an MVP for resume screening.

## 2. Main Features

- Upload resume in PDF or DOCX format.
- Paste a job description.
- Add optional HR checklist items such as must-have skills, experience, location, or joining requirements.
- Send the resume and requirements to Gemini first.
- Fall back to Groq if Gemini fails and `GROQ_API_KEY` is configured.
- Generate:
  - Candidate details
  - Match percentage
  - Match decision
  - Matched skills
  - Missing required skills
  - Missing preferred skills
  - Strengths
  - Risks
  - Resume improvement suggestions
  - Interview questions
- Display results in a styled frontend report.
- Clear uploaded resume data after analysis.

## 3. Tech Stack

Frontend:

- HTML
- CSS
- JavaScript
- Tailwind CSS CDN

Backend:

- Node.js
- Express.js
- Multer
- Mammoth
- Gemini API
- Groq API

Package management:

- npm

## 4. Folder Structure

```txt
resume-gemini-matcher/
  public/
    index.html
    styles.css
    app.js
  .env.example
  .gitignore
  package.json
  package-lock.json
  README.md
  PROJECT_DOCUMENTATION.md
  server.js
```

## 5. Important Files

### `server.js`

This is the backend server. It:

- Starts the Express app.
- Serves frontend files from the `public` folder.
- Accepts resume uploads.
- Validates PDF and DOCX files.
- Sends PDF resumes directly to Gemini as inline document data.
- Extracts DOCX text using Mammoth, then sends the extracted text to Gemini.
- Extracts PDF or DOCX text locally when Groq fallback is used.
- Requests JSON output from Gemini.
- Requests JSON output from Groq when Gemini fails and Groq is configured.
- Returns the analysis to the frontend.
- Clears uploaded resume data after the request finishes.

### `public/index.html`

This is the main frontend page. It contains:

- Resume upload area.
- Job description textarea.
- HR checklist input.
- Run match button.
- Match report layout.
- Frontend privacy message explaining that files are not stored.

### `public/styles.css`

This file contains the custom visual design:

- Docket/case-file style.
- Paper background.
- Folder tabs.
- Result gauge.
- Chips for matched and missing skills.
- Report panels.

### `public/app.js`

This file controls frontend behavior:

- Resume file selection and drag/drop.
- HR checklist chips.
- Button enable/disable logic.
- API call to `/api/analyze`.
- Loading state.
- Error display.
- Rendering Gemini's match report.

### `.env.example`

Example environment file showing the required variables:

```env
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-3.5-flash
GEMINI_FALLBACK_MODELS=gemini-3.1-flash-lite,gemini-3-flash
GROQ_API_KEY=your_groq_api_key_here
GROQ_MODEL=llama-3.3-70b-versatile
PORT=3000
```

## 6. How The App Works

1. The user opens the frontend in the browser.
2. The user uploads a PDF or DOCX resume.
3. The user pastes the job description.
4. The user optionally adds HR checklist items.
5. The frontend sends the resume and text inputs to the backend using `FormData`.
6. The backend validates the uploaded file.
7. If the resume is PDF:
   - The backend sends the PDF to Gemini as base64 inline data.
8. If the resume is DOCX:
   - The backend extracts plain text using Mammoth.
   - The backend sends the text to Gemini.
9. If Gemini fails and Groq is configured:
   - The backend extracts PDF or DOCX text locally.
   - The backend sends the prompt and resume text to Groq.
10. The selected provider returns a JSON match report.
11. The backend returns the JSON to the frontend.
12. The frontend renders the match report.
13. The backend clears the uploaded resume data after the response.

## 7. Gemini Prompt Strategy

The backend asks the active AI provider to act as an expert HR resume screening assistant.

The AI provider is responsible for:

- Reading the resume.
- Reading the job description.
- Reading the HR checklist.
- Extracting candidate details.
- Comparing candidate skills and experience against the role.
- Creating the match percentage.
- Generating strengths, risks, missing skills, and interview questions.

The app relies on the AI provider for the percentage score. There is no local scoring formula.

## 8. Gemini JSON Response Format

The backend expects Gemini or Groq to return JSON like this:

```json
{
  "candidate": {
    "name": "",
    "email": "",
    "phone": "",
    "location": "",
    "totalExperience": ""
  },
  "matchPercentage": 0,
  "decision": "Strong Match | Good Match | Average Match | Low Match | Not a Match",
  "summary": "",
  "matchedSkills": [],
  "partialMatches": [],
  "missingRequiredSkills": [],
  "missingPreferredSkills": [],
  "experienceMatch": {
    "required": "",
    "candidate": "",
    "status": "matched | partial | missing"
  },
  "educationMatch": {
    "required": "",
    "candidate": "",
    "status": "matched | partial | missing | not_specified"
  },
  "categoryScores": {
    "skills": 0,
    "experience": 0,
    "projects": 0,
    "education": 0
  },
  "strengths": [],
  "risks": [],
  "resumeImprovements": [],
  "interviewQuestions": [],
  "fileHandlingNote": "The uploaded resume was processed only for this analysis and is not retained by the app."
}
```

## 9. File Privacy And Cleanup

The app does not permanently save uploaded resumes.

Current behavior:

- Multer uses memory storage.
- The resume is available only during the request.
- After analysis, the backend clears the file buffer.
- If file-based storage is added later, the cleanup function also supports deleting `file.path`.

Important note:

Gemini and/or Groq may receive the resume content for analysis depending on which provider handles the request. The app itself does not retain the uploaded file after the request.

## 10. Setup Instructions

### Step 1: Open the project folder

```bash
cd C:\Users\deves\Documents\Codex\2026-07-14\i\outputs\resume-gemini-matcher
```

### Step 2: Install dependencies

```bash
npm install
```

If npm has permission issues with the global cache, use:

```bash
npm install --cache .\.npm-cache
```

### Step 3: Create `.env`

Copy `.env.example` to `.env`.

On Windows Command Prompt:

```bash
copy .env.example .env
```

On PowerShell:

```powershell
Copy-Item .env.example .env
```

### Step 4: Add Gemini API key

Open `.env` and add your key:

```env
GEMINI_API_KEY=your_actual_gemini_api_key
GEMINI_MODEL=gemini-3.5-flash
GEMINI_FALLBACK_MODELS=gemini-3.1-flash-lite,gemini-3-flash
GROQ_API_KEY=your_actual_groq_api_key
GROQ_MODEL=llama-3.3-70b-versatile
PORT=3000
```

### Step 5: Start the server

```bash
npm start
```

### Step 6: Open the app

Open this URL in your browser:

```txt
http://localhost:3000
```

## 11. Development Mode

For development with automatic server restart:

```bash
npm run dev
```

This uses:

```bash
node --watch server.js
```

## 12. API Endpoints

### `GET /api/health`

Checks whether the backend is running.

Example response:

```json
{
  "ok": true,
  "model": "gemini-3.5-flash",
  "fallbackModels": ["gemini-3.1-flash-lite", "gemini-3-flash"],
  "groqFallbackModel": "llama-3.3-70b-versatile",
  "geminiKeyConfigured": true,
  "groqKeyConfigured": true
}
```

### `POST /api/analyze`

Analyzes resume against job description and HR checklist.

Request type:

```txt
multipart/form-data
```

Fields:

- `resume`: PDF or DOCX file
- `jobDescription`: pasted job description
- `hrChecklist`: optional checklist text

Response:

```json
{
  "analysis": {
    "matchPercentage": 82,
    "decision": "Strong Match"
  }
}
```

## 13. Supported File Types

Supported:

- `.pdf`
- `.docx`

Not supported in this MVP:

- `.doc`
- Images
- Scanned resumes without selectable text may produce weaker results

## 14. Common Errors

### `GEMINI_API_KEY is missing`

Cause:

The `.env` file does not contain a Gemini or Groq API key.

Fix:

Create `.env` and set at least one provider key:

```env
GEMINI_API_KEY=your_actual_key
GROQ_API_KEY=your_actual_groq_key
```

### `address already in use :::3000`

Cause:

Another process is already using port 3000.

Fix:

Either stop the old process or change the port in `.env`:

```env
PORT=3001
```

Then open:

```txt
http://localhost:3001
```

### `This model is currently experiencing high demand`

Cause:

Gemini is temporarily overloaded or rate limited for the selected model.

Fix:

The backend now retries temporary Gemini failures automatically. You can also set fallback models in `.env`:

```env
GEMINI_FALLBACK_MODELS=gemini-3.1-flash-lite,gemini-3-flash
```

If one fallback model is unavailable for your account, remove it from the list or replace it with another model available in your Google AI Studio account.

If the Gemini provider still fails and `GROQ_API_KEY` is configured, the backend will use Groq as the provider fallback.

### `Please upload a PDF or DOCX resume`

Cause:

The uploaded file is not a supported format.

Fix:

Upload a `.pdf` or `.docx` file.

## 15. Future Improvements

Possible next features:

- Login for HR users.
- Store past match reports without storing resume files.
- Export report as PDF.
- Add candidate ranking for multiple resumes.
- Add role templates.
- Add analytics dashboard.
- Add admin controls for required scoring categories.
- Add database support with MongoDB or PostgreSQL.
- Add OCR for scanned PDF resumes.

## 16. Security Notes

For production:

- Never commit `.env`.
- Add authentication.
- Add rate limiting.
- Validate uploaded file content more strictly.
- Add file type sniffing.
- Add request size limits.
- Use HTTPS.
- Review Gemini data handling requirements for your use case.
- Avoid storing resumes unless you have explicit consent and a retention policy.

## 17. Quick Start

```bash
cd C:\Users\deves\Documents\Codex\2026-07-14\i\outputs\resume-gemini-matcher
npm install
copy .env.example .env
npm start
```

Then open:

```txt
http://localhost:3000
```
