import "dotenv/config";
import express from "express";
import multer from "multer";
import mammoth from "mammoth";
import pdfParse from "pdf-parse";
import { unlink } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 8 * 1024 * 1024
  }
});

const PORT = process.env.PORT || 3000;
const DEFAULT_GEMINI_MODEL = "gemini-3.5-flash";
const DEFAULT_GEMINI_FALLBACK_MODELS = ["gemini-3.1-flash-lite", "gemini-3-flash"];
const DEPRECATED_GEMINI_MODELS = new Set(["gemini-2.5-flash", "models/gemini-2.5-flash"]);
const requestedGeminiModel = process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL;
const GEMINI_MODEL = DEPRECATED_GEMINI_MODELS.has(requestedGeminiModel)
  ? DEFAULT_GEMINI_MODEL
  : requestedGeminiModel;
const GEMINI_FALLBACK_MODELS = parseFallbackModels(process.env.GEMINI_FALLBACK_MODELS);
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";

app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

const supportedMimeTypes = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
]);

const supportedExtensions = new Set([".pdf", ".docx"]);

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    model: GEMINI_MODEL,
    fallbackModels: GEMINI_FALLBACK_MODELS,
    groqFallbackModel: GROQ_MODEL,
    geminiKeyConfigured: Boolean(GEMINI_API_KEY),
    groqKeyConfigured: Boolean(GROQ_API_KEY)
  });
});

app.post("/api/analyze", upload.single("resume"), async (req, res) => {
  try {
    if (!GEMINI_API_KEY && !GROQ_API_KEY) {
      return res.status(500).json({
        error: "GEMINI_API_KEY or GROQ_API_KEY is required. Add at least one provider key to your .env file."
      });
    }

    const jobDescription = String(req.body.jobDescription || "").trim();
    const hrChecklist = String(req.body.hrChecklist || "").trim();
    const resume = req.file;

    if (!resume) {
      return res.status(400).json({ error: "Please upload a resume file." });
    }

    if (!jobDescription) {
      return res.status(400).json({ error: "Please paste a job description." });
    }

    const extension = path.extname(resume.originalname || "").toLowerCase();

    if (!supportedMimeTypes.has(resume.mimetype) && !supportedExtensions.has(extension)) {
      return res.status(400).json({
        error: "Please upload a PDF or DOCX resume. Legacy .doc files are not supported by this MVP."
      });
    }

    const prompt = createPrompt({ jobDescription, hrChecklist });
    const geminiPayload = await buildGeminiPayload({
      resume,
      extension,
      prompt
    });

    const analysis = await callAnalysis({
      geminiPayload,
      prompt,
      resume,
      extension
    });
    res.json({ analysis });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: error.message || "Something went wrong while analyzing the resume."
    });
  } finally {
    await cleanupUploadedResume(req.file);
  }
});

async function buildGeminiPayload({ resume, extension, prompt }) {
  if (resume.mimetype === "application/pdf" || extension === ".pdf") {
    return {
      contents: [
        {
          role: "user",
          parts: [
            { text: prompt },
            {
              inline_data: {
                mime_type: "application/pdf",
                data: resume.buffer.toString("base64")
              }
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.1,
        response_mime_type: "application/json"
      }
    };
  }

  const resumeText = await extractResumeText(resume, extension);

  return {
    contents: [
      {
        role: "user",
        parts: [
          {
            text: `${prompt}\n\nResume text extracted from DOCX:\n${resumeText}`
          }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.1,
      response_mime_type: "application/json"
    }
  };
}

function createPrompt({ jobDescription, hrChecklist }) {
  return `
You are an expert HR resume screening assistant.

Analyze the resume against the job description and optional HR checklist.
Rely on your own understanding to extract resume details, identify requirements, compare them, and decide the final matching percentage.

Important rules:
- Return only valid JSON. No markdown.
- The matchPercentage must be an integer from 0 to 100.
- Be strict for required skills and experience.
- Do not invent candidate details that are not present in the resume.
- If a requirement is implied by related experience, mark it as partial instead of fully matched.
- Keep all arrays concise and useful for an HR user.

Return this exact JSON shape:
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

Job description:
${jobDescription}

Optional HR checklist:
${hrChecklist || "No separate HR checklist provided."}
`.trim();
}

async function callAnalysis({ geminiPayload, prompt, resume, extension }) {
  let lastGeminiError;

  if (GEMINI_API_KEY) {
    try {
      return await callGemini(geminiPayload);
    } catch (error) {
      lastGeminiError = error;
    }
  }

  if (GROQ_API_KEY) {
    const resumeText = await extractResumeText(resume, extension);
    return callGroq({ prompt, resumeText });
  }

  throw lastGeminiError || new Error("No AI provider is configured.");
}

async function callGemini(payload) {
  const modelCandidates = getGeminiModelCandidates();
  let lastError;

  for (const [index, model] of modelCandidates.entries()) {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        return await callGeminiModel(model, payload);
      } catch (error) {
        lastError = error;

        if (isModelUnavailableError(error) && index < modelCandidates.length - 1) {
          break;
        }

        if (!isRetryableGeminiError(error)) {
          throw error;
        }

        if (attempt < 3) {
          await delay(700 * attempt);
        }
      }
    }
  }

  throw new Error(
    `${lastError?.message || "Gemini request failed."} Tried models: ${modelCandidates.join(", ")}`
  );
}

async function callGeminiModel(model, payload) {
  const normalizedModel = normalizeGeminiModelName(model);
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    normalizedModel
  )}:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  const data = await response.json();

  if (!response.ok) {
    const message = data?.error?.message || `Gemini request failed with status ${response.status}`;
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }

  const text = data?.candidates?.[0]?.content?.parts
    ?.map((part) => part.text || "")
    .join("")
    .trim();

  if (!text) {
    const error = new Error("Gemini returned an empty response.");
    error.status = 503;
    throw error;
  }

  return parseProviderJson(text, "Gemini");
}

async function callGroq({ prompt, resumeText }) {
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${GROQ_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "user",
          content: `${prompt}\n\nResume text:\n${resumeText}`
        }
      ]
    })
  });

  const data = await response.json();

  if (!response.ok) {
    const message = data?.error?.message || `Groq request failed with status ${response.status}`;
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }

  const text = data?.choices?.[0]?.message?.content?.trim();

  if (!text) {
    throw new Error("Groq returned an empty response.");
  }

  return parseProviderJson(text, "Groq");
}

async function extractResumeText(resume, extension) {
  if (resume.mimetype === "application/pdf" || extension === ".pdf") {
    const parsed = await pdfParse(resume.buffer);
    const text = parsed.text.trim();

    if (!text) {
      throw new Error("Could not extract text from the PDF resume.");
    }

    return text;
  }

  const extracted = await mammoth.extractRawText({ buffer: resume.buffer });
  const text = extracted.value.trim();

  if (!text) {
    throw new Error("Could not extract text from the DOCX resume.");
  }

  return text;
}

function parseProviderJson(text, providerName) {
  const cleaned = text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");

    if (start !== -1 && end !== -1 && end > start) {
      return JSON.parse(cleaned.slice(start, end + 1));
    }

    throw new Error(`${providerName} did not return valid JSON.`);
  }
}

async function cleanupUploadedResume(file) {
  if (!file) return;

  if (file.path) {
    await unlink(file.path).catch(() => {});
  }

  if (file.buffer) {
    file.buffer = Buffer.alloc(0);
  }
}

function parseFallbackModels(value) {
  const models = value
    ? value.split(",").map((model) => model.trim()).filter(Boolean)
    : DEFAULT_GEMINI_FALLBACK_MODELS;

  return models.map(resolveDeprecatedGeminiModel).filter((model) => model !== GEMINI_MODEL);
}

function getGeminiModelCandidates() {
  return [...new Set([GEMINI_MODEL, ...GEMINI_FALLBACK_MODELS].map(resolveDeprecatedGeminiModel))];
}

function resolveDeprecatedGeminiModel(model) {
  return DEPRECATED_GEMINI_MODELS.has(model) ? DEFAULT_GEMINI_MODEL : model;
}

function normalizeGeminiModelName(model) {
  return model.replace(/^models\//, "");
}

function isRetryableGeminiError(error) {
  const retryableStatuses = new Set([408, 429, 500, 502, 503, 504]);
  const message = String(error?.message || "").toLowerCase();

  return (
    retryableStatuses.has(error?.status) ||
    message.includes("high demand") ||
    message.includes("temporarily unavailable") ||
    message.includes("try again later") ||
    message.includes("overloaded")
  );
}

function isModelUnavailableError(error) {
  const message = String(error?.message || "").toLowerCase();

  return (
    [400, 404].includes(error?.status) &&
    (message.includes("not found") ||
      message.includes("not supported") ||
      message.includes("not available") ||
      message.includes("is no longer available"))
  );
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

app.listen(PORT, () => {
  console.log(`ResumeFit AI running at http://localhost:${PORT}`);
});
