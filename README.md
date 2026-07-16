# ResumeFit AI

ResumeFit AI is an AI-powered resume-to-job matching web application. It compares a candidate resume with a job description and optional HR checklist, then generates a structured hiring-style report with a match percentage, missing skills, strengths, risks, and interview questions.

## Features

- Upload resumes in PDF or DOCX format
- Paste a job description
- Add optional HR checklist requirements
- Generate AI-based match percentage
- View matched skills and missing skills
- Get candidate strengths and hiring risks
- Generate resume improvement suggestions
- Generate interview questions
- Download the generated match report as a readable HTML report
- Gemini-first AI analysis with Groq fallback
- Privacy-focused in-memory file handling

## Tech Stack

- HTML
- CSS
- JavaScript
- Tailwind CSS
- Node.js
- Express.js
- Multer
- Mammoth
- pdf-parse
- Gemini API
- Groq API

## How It Works

1. The user uploads a PDF or DOCX resume.
2. The user enters a job description and optional HR checklist.
3. The backend validates the uploaded file.
4. Gemini analyzes the resume and job requirements.
5. If Gemini fails, Groq is used as a fallback provider.
6. The AI returns a structured JSON report.
7. The frontend displays the match score and hiring insights.
8. The user can download the generated report as a readable HTML file.
9. Uploaded resume data is cleared after the request.

## Installation

Clone the repository:

```bash
git clone https://github.com/your-username/resumefit-ai.git
cd resumefit-ai
```

Install dependencies:

```bash
npm install
```

Create a `.env` file:

```bash
copy .env.example .env
```

Add your API keys:

```env
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-3.5-flash
GEMINI_FALLBACK_MODELS=gemini-3.1-flash-lite,gemini-3-flash
GROQ_API_KEY=your_groq_api_key_here
GROQ_MODEL=llama-3.3-70b-versatile
PORT=3000
```

Start the app:

```bash
npm start
```

Open in browser:

```txt
http://localhost:3000
```

## Environment Variables

| Variable | Description |
| --- | --- |
| `GEMINI_API_KEY` | Gemini API key |
| `GEMINI_MODEL` | Primary Gemini model |
| `GEMINI_FALLBACK_MODELS` | Comma-separated Gemini fallback models |
| `GROQ_API_KEY` | Groq API key for provider fallback |
| `GROQ_MODEL` | Groq fallback model |
| `PORT` | Local server port |

At least one provider key is required. For best reliability, configure both Gemini and Groq.

## API Endpoints

### Health Check

```http
GET /api/health
```

Returns server status and configured provider information.

### Analyze Resume

```http
POST /api/analyze
```

Request type:

```txt
multipart/form-data
```

Fields:

- `resume`: PDF or DOCX resume file
- `jobDescription`: job description text
- `hrChecklist`: optional HR checklist text

## Privacy

ResumeFit AI does not permanently store uploaded resumes. Files are handled in memory during the request and cleared after the analysis response is returned.

The resume content is sent to the configured AI provider for analysis.

## Limitations

- Legacy `.doc` files are not supported
- Scanned PDFs may not work well without OCR
- AI-generated scores should be reviewed by a human
- Free deployment platforms may sleep after inactivity

## Future Improvements

- Add authentication
- Add report export as PDF
- Add OCR for scanned resumes
- Add resume history without storing original files
- Add dashboard for multiple candidates
- Add automated tests
- Add rate limiting for production use

## Project Status

This project is an MVP built for learning, portfolio, and placement preparation.
