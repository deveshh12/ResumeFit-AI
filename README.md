# ResumeFit AI

An HTML, CSS, JavaScript, Tailwind, Node.js, Gemini API, and Groq fallback app that compares a resume against a job description and HR checklist.

For detailed documentation, see `PROJECT_DOCUMENTATION.md`.

## What It Does

- Accepts PDF and DOCX resumes.
- Accepts a pasted job description.
- Accepts an optional HR checklist.
- Sends the resume and role requirements to Gemini first, then uses Groq if Gemini fails and Groq is configured.
- Returns a Gemini-generated match percentage, decision, matched skills, missing skills, risks, strengths, resume improvements, and interview questions.

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create `.env` from `.env.example`:

   ```bash
   copy .env.example .env
   ```

3. Add your Gemini API key:

   ```env
   GEMINI_API_KEY=your_gemini_api_key_here
   GEMINI_MODEL=gemini-3.5-flash
   GEMINI_FALLBACK_MODELS=gemini-3.1-flash-lite,gemini-3-flash
   GROQ_API_KEY=your_groq_api_key_here
   GROQ_MODEL=llama-3.3-70b-versatile
   PORT=3000
   ```

4. Start the app:

   ```bash
   npm start
   ```

5. Open:

   ```txt
   http://localhost:3000
   ```

## Notes

- PDF resumes are sent to Gemini as document input.
- DOCX resumes are converted to plain text first, then Gemini performs the resume extraction, comparison, and scoring.
- Legacy `.doc` files are not supported in this MVP.
- The app relies on the active AI provider for the match percentage rather than calculating the score locally.
- Uploaded files are not stored by the app. Multer keeps the resume in memory for the request, and the buffer is cleared after the report is returned.
- If Gemini returns a temporary high-demand error, the backend retries automatically and then tries the comma-separated fallback models in `GEMINI_FALLBACK_MODELS`.
- If Gemini still fails and `GROQ_API_KEY` is set, the backend extracts resume text locally and sends the analysis request to Groq using `GROQ_MODEL`.
