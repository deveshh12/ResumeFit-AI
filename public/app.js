const form = document.querySelector("#matchForm");
const resumeInput = document.querySelector("#resume");
const dropZone = document.querySelector("#dropZone");
const fileRow = document.querySelector("#fileRow");
const fileName = document.querySelector("#fileName");
const clearFile = document.querySelector("#clearFile");
const jobDescription = document.querySelector("#jobDescription");
const reqInput = document.querySelector("#reqInput");
const addRequirement = document.querySelector("#addRequirement");
const requirementChips = document.querySelector("#requirementChips");
const runButton = document.querySelector("#runButton");
const runButtonText = document.querySelector("#runButtonText");
const buttonSpinner = document.querySelector("#buttonSpinner");
const runIcon = document.querySelector("#runIcon");
const errorBox = document.querySelector("#errorBox");
const report = document.querySelector("#report");
const scanLine = document.querySelector("#scanLine");
const heroStartButton = document.querySelector("#heroStartButton");
const navStartButton = document.querySelector("#navStartButton");
const analyzer = document.querySelector("#analyzer");

const CIRCUMFERENCE = 2 * Math.PI * 78;
let requirements = [];

[heroStartButton, navStartButton].forEach((button) => {
  button?.addEventListener("click", () => {
    analyzer.scrollIntoView({ behavior: "smooth", block: "start" });
  });
});

resumeInput.addEventListener("change", () => {
  const file = resumeInput.files?.[0];
  if (file) setResumeFile(file);
});

["dragenter", "dragover"].forEach((eventName) => {
  dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropZone.classList.add("drag-over");
  });
});

["dragleave", "drop"].forEach((eventName) => {
  dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropZone.classList.remove("drag-over");
  });
});

dropZone.addEventListener("drop", (event) => {
  const file = event.dataTransfer.files?.[0];
  if (!file) return;

  const transfer = new DataTransfer();
  transfer.items.add(file);
  resumeInput.files = transfer.files;
  setResumeFile(file);
});

clearFile.addEventListener("click", () => {
  resumeInput.value = "";
  fileName.textContent = "";
  fileRow.classList.add("hidden");
  fileRow.classList.remove("flex");
  dropZone.classList.remove("hidden");
  updateRunState();
});

jobDescription.addEventListener("input", updateRunState);
addRequirement.addEventListener("click", addRequirementChip);
reqInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    addRequirementChip();
  }
});

runButton.addEventListener("click", async () => {
  if (runButton.disabled) return;

  setLoading(true);
  hideError();

  try {
    const body = new FormData(form);
    const jd = jobDescription.value.trim();
    const checklist = requirements.join("\n");

    body.set("jobDescription", jd || `Screen this resume against the HR checklist:\n${checklist}`);
    body.set("hrChecklist", checklist);

    const response = await fetch("/api/analyze", {
      method: "POST",
      body
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Analysis failed.");
    }

    renderReport(data.analysis);
  } catch (error) {
    showError(error.message);
  } finally {
    setLoading(false);
  }
});

function setResumeFile(file) {
  fileName.textContent = file.name;
  fileRow.classList.remove("hidden");
  fileRow.classList.add("flex");
  dropZone.classList.add("hidden");
  updateRunState();
}

function addRequirementChip() {
  const value = reqInput.value.trim();
  if (!value) return;

  requirements.push(value);
  reqInput.value = "";
  renderRequirementChips();
  updateRunState();
}

function renderRequirementChips() {
  requirementChips.innerHTML = requirements
    .map((item, index) => {
      return `<span class="chip chip-neutral">${escapeHtml(item)} <button type="button" class="chip-remove" data-index="${index}" aria-label="Remove requirement">x</button></span>`;
    })
    .join("");

  requirementChips.querySelectorAll(".chip-remove").forEach((button) => {
    button.addEventListener("click", () => {
      requirements.splice(Number(button.dataset.index), 1);
      renderRequirementChips();
      updateRunState();
    });
  });
}

function updateRunState() {
  const hasResume = Boolean(resumeInput.files?.[0]);
  const hasRequirements = Boolean(jobDescription.value.trim()) || requirements.length > 0;
  const ready = hasResume && hasRequirements;

  runButton.disabled = !ready;
  runButtonText.textContent = ready ? "Run match" : "Add resume and requirements";
  runIcon.classList.toggle("hidden", !ready);
}

function setLoading(isLoading) {
  runButton.disabled = isLoading;
  runButtonText.textContent = isLoading ? "Analyzing with AI" : "Run match";
  buttonSpinner.classList.toggle("hidden", !isLoading);
  runIcon.classList.toggle("hidden", isLoading);

  if (!isLoading) updateRunState();
}

function showError(message) {
  errorBox.textContent = message;
  errorBox.classList.remove("hidden");
}

function hideError() {
  errorBox.classList.add("hidden");
  errorBox.textContent = "";
}

function renderReport(analysis) {
  const score = clampScore(analysis.matchPercentage);
  const candidate = analysis.candidate || {};
  const missingSkills = [
    ...normalizeList(analysis.missingRequiredSkills),
    ...normalizeList(analysis.missingPreferredSkills)
  ];

  report.classList.remove("hidden");
  requestAnimationFrame(() => report.classList.add("shown"));

  scanLine.classList.remove("active");
  void scanLine.offsetWidth;
  scanLine.classList.add("active");

  setText("#candidateName", candidate.name || "Candidate");
  setText("#summaryTitle", analysis.decision || "Match Report");
  setText("#summary", analysis.summary || "Gemini returned the match report.");
  setText("#decision", analysis.decision || "Report ready");
  setText("#fileHandlingNote", analysis.fileHandlingNote || "The uploaded resume was processed for this report and cleared after the result was returned.");

  animateScore(score);
  renderCategories(analysis.categoryScores || {}, analysis);
  renderChips("#matchedSkills", normalizeList(analysis.matchedSkills), "chip-good", "No matched skills reported.");
  renderChips("#missingSkills", missingSkills, "chip-missing", "No missing skills reported.");
  renderList("#strengths", analysis.strengths, "No strengths reported.");
  renderList("#risks", analysis.risks, "No risks reported.");
  renderList("#interviewQuestions", analysis.interviewQuestions, "No interview questions reported.");

  report.scrollIntoView({ behavior: "smooth", block: "start" });
}

function animateScore(score) {
  const gauge = document.querySelector("#gaugeFg");
  const scoreNumber = document.querySelector("#scoreNumber");

  gauge.setAttribute("stroke-dasharray", CIRCUMFERENCE);
  gauge.style.stroke = colorForScore(score);
  gauge.style.strokeDashoffset = String(CIRCUMFERENCE - (score / 100) * CIRCUMFERENCE);

  let start = null;
  function step(timestamp) {
    if (!start) start = timestamp;
    const progress = Math.min((timestamp - start) / 900, 1);
    scoreNumber.textContent = `${Math.round(progress * score)}%`;
    if (progress < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

function renderCategories(scores, analysis) {
  const fallbackExperience = statusToScore(analysis.experienceMatch?.status);
  const fallbackEducation = statusToScore(analysis.educationMatch?.status);
  const categories = [
    ["Skills", scores.skills ?? analysis.matchPercentage],
    ["Experience", scores.experience ?? fallbackExperience],
    ["Projects", scores.projects ?? analysis.matchPercentage],
    ["Education", scores.education ?? fallbackEducation]
  ];

  document.querySelector("#categoryScores").innerHTML = categories
    .map(([label, value]) => {
      const score = clampScore(value);
      return `
        <div>
          <div class="mb-1.5 flex justify-between text-sm">
            <span class="font-semibold">${escapeHtml(label)}</span>
            <span class="font-mono text-[var(--ink-soft)]">${score}%</span>
          </div>
          <div class="h-2 overflow-hidden rounded-full bg-[rgba(218,212,196,0.7)]">
            <div class="bar-fill h-full rounded-full" style="width:${score}%; background:${colorForScore(score)}"></div>
          </div>
        </div>
      `;
    })
    .join("");
}

function renderChips(selector, items, className, emptyText) {
  const container = document.querySelector(selector);
  if (!items.length) {
    container.innerHTML = `<p class="text-sm text-[var(--ink-soft)]">${escapeHtml(emptyText)}</p>`;
    return;
  }

  container.innerHTML = items
    .map((item) => `<span class="chip ${className}">${escapeHtml(item)}</span>`)
    .join("");
}

function renderList(selector, items, emptyText) {
  const list = normalizeList(items);
  const container = document.querySelector(selector);

  if (!list.length) {
    container.innerHTML = `<li class="text-[var(--ink-soft)]">${escapeHtml(emptyText)}</li>`;
    return;
  }

  container.innerHTML = list.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
}

function normalizeList(items) {
  if (!Array.isArray(items)) return [];
  return items
    .map((item) => {
      if (typeof item === "string") return item;
      if (item && typeof item === "object") return Object.values(item).filter(Boolean).join(" - ");
      return "";
    })
    .filter(Boolean);
}

function statusToScore(status) {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "matched") return 100;
  if (normalized === "partial") return 55;
  if (normalized === "missing") return 0;
  return 50;
}

function colorForScore(score) {
  if (score >= 80) return "var(--teal)";
  if (score >= 55) return "var(--amber)";
  return "var(--rose)";
}

function clampScore(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.min(100, Math.round(number)));
}

function setText(selector, value) {
  document.querySelector(selector).textContent = value;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
