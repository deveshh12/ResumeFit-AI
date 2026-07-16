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
const downloadReportButton = document.querySelector("#downloadReportButton");

const CIRCUMFERENCE = 2 * Math.PI * 78;
let requirements = [];
let currentReport = null;

[heroStartButton, navStartButton].forEach((button) => {
  button?.addEventListener("click", () => {
    analyzer.scrollIntoView({ behavior: "smooth", block: "start" });
  });
});

downloadReportButton?.addEventListener("click", () => {
  if (!currentReport) return;
  downloadReport(currentReport);
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
  currentReport = analysis;
  downloadReportButton.disabled = false;

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

function downloadReport(analysis) {
  const candidateName = analysis?.candidate?.name || "candidate";
  const safeName = candidateName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "candidate";
  const fileName = `resumefit-ai-report-${safeName}-${new Date().toISOString().slice(0, 10)}.html`;
  const html = buildReportHtml(analysis);
  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function buildReportHtml(analysis) {
  const candidate = analysis.candidate || {};
  const score = clampScore(analysis.matchPercentage);
  const categoryScores = analysis.categoryScores || {};
  const missingSkills = [
    ...normalizeList(analysis.missingRequiredSkills),
    ...normalizeList(analysis.missingPreferredSkills)
  ];

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>ResumeFit AI Report - ${escapeHtml(candidate.name || "Candidate")}</title>
  <style>
    :root { --ink:#16233d; --soft:#4c5b78; --paper:#f4f2ec; --raised:#fbfaf6; --teal:#0f6e66; --amber:#c68a2e; --rose:#a6433d; --line:#dad4c4; }
    * { box-sizing: border-box; }
    body { margin: 0; background: var(--paper); color: var(--ink); font-family: Arial, sans-serif; line-height: 1.55; }
    main { max-width: 920px; margin: 0 auto; padding: 40px 22px; }
    header, section { background: var(--raised); border: 1px solid var(--line); border-radius: 10px; padding: 24px; margin-bottom: 18px; }
    h1, h2 { margin: 0; }
    h1 { font-size: 38px; }
    h2 { font-size: 20px; margin-bottom: 12px; }
    .meta { color: var(--soft); margin-top: 8px; }
    .score { display: inline-flex; align-items: baseline; gap: 10px; margin-top: 18px; color: var(--teal); }
    .score strong { font-size: 56px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; }
    .item { border: 1px solid var(--line); border-radius: 8px; padding: 12px; background: white; }
    .label { color: var(--soft); font-size: 12px; text-transform: uppercase; letter-spacing: .08em; }
    .chips { display: flex; flex-wrap: wrap; gap: 8px; }
    .chip { border-radius: 999px; padding: 6px 10px; font-size: 13px; background: white; border: 1px solid var(--line); }
    .good { color: var(--teal); border-color: rgba(15,110,102,.3); }
    .bad { color: var(--rose); border-color: rgba(166,67,61,.3); }
    .bar { height: 8px; background: rgba(218,212,196,.8); border-radius: 999px; overflow: hidden; margin-top: 7px; }
    .fill { height: 100%; border-radius: 999px; background: var(--teal); }
    li { margin-bottom: 7px; }
    footer { color: var(--soft); font-size: 13px; text-align: center; padding: 14px; }
  </style>
</head>
<body>
  <main>
    <header>
      <p class="label">ResumeFit AI Match Report</p>
      <h1>${escapeHtml(analysis.decision || "Match Report")}</h1>
      <p class="meta">Candidate: ${escapeHtml(candidate.name || "Not found")}</p>
      <div class="score"><strong>${score}%</strong><span>overall fit</span></div>
      <p>${escapeHtml(analysis.summary || "No summary returned.")}</p>
    </header>

    <section>
      <h2>Candidate Details</h2>
      <div class="grid">
        ${detailItem("Email", candidate.email || "Not found")}
        ${detailItem("Phone", candidate.phone || "Not found")}
        ${detailItem("Location", candidate.location || "Not found")}
        ${detailItem("Experience", candidate.totalExperience || "Not found")}
      </div>
    </section>

    <section>
      <h2>Category Scores</h2>
      ${scoreBar("Skills", categoryScores.skills ?? score)}
      ${scoreBar("Experience", categoryScores.experience ?? statusToScore(analysis.experienceMatch?.status))}
      ${scoreBar("Projects", categoryScores.projects ?? score)}
      ${scoreBar("Education", categoryScores.education ?? statusToScore(analysis.educationMatch?.status))}
    </section>

    <section>
      <h2>Matched Skills</h2>
      <div class="chips">${chipList(analysis.matchedSkills, "good", "No matched skills reported.")}</div>
    </section>

    <section>
      <h2>Missing Skills</h2>
      <div class="chips">${chipList(missingSkills, "bad", "No missing skills reported.")}</div>
    </section>

    <section>
      <h2>Strengths</h2>
      ${htmlList(analysis.strengths, "No strengths reported.")}
    </section>

    <section>
      <h2>Risks</h2>
      ${htmlList(analysis.risks, "No risks reported.")}
    </section>

    <section>
      <h2>Interview Questions</h2>
      ${htmlList(analysis.interviewQuestions, "No interview questions reported.")}
    </section>

    <section>
      <h2>File Handling</h2>
      <p>${escapeHtml(analysis.fileHandlingNote || "The uploaded resume was processed for this report and cleared after the result was returned.")}</p>
    </section>

    <footer>Generated by ResumeFit AI on ${new Date().toLocaleString()}</footer>
  </main>
</body>
</html>`;
}

function detailItem(label, value) {
  return `<div class="item"><div class="label">${escapeHtml(label)}</div><strong>${escapeHtml(value)}</strong></div>`;
}

function scoreBar(label, value) {
  const score = clampScore(value);
  return `<div class="item"><strong>${escapeHtml(label)}</strong><span style="float:right">${score}%</span><div class="bar"><div class="fill" style="width:${score}%"></div></div></div>`;
}

function chipList(items, className, emptyText) {
  const list = normalizeList(items);
  if (!list.length) return `<span class="chip">${escapeHtml(emptyText)}</span>`;
  return list.map((item) => `<span class="chip ${className}">${escapeHtml(item)}</span>`).join("");
}

function htmlList(items, emptyText) {
  const list = normalizeList(items);
  if (!list.length) return `<p>${escapeHtml(emptyText)}</p>`;
  return `<ul>${list.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
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
