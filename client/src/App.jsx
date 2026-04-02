import { useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileText,
  LoaderCircle,
  RefreshCcw,
  Upload,
  WandSparkles,
} from "lucide-react";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const apiBase = import.meta.env.VITE_API_BASE_URL || "";

const editableSections = [
  {
    key: "summary",
    label: "Update Professional Summary / Synopsis",
    placeholder: "Enter new summary (leave blank to keep original)...",
  },
  {
    key: "experience",
    label: "Update Work Experience",
    placeholder:
      "Describe new work experience (leave blank to keep original)...",
  },
  {
    key: "skills",
    label: "Update Skills",
    placeholder: "List new skills (leave blank to keep original)...",
  },
];

const sectionPatterns = [
  {
    key: "summary",
    title: "Professional Summary",
    aliases: [
      "professional summary",
      "summary",
      "profile",
      "synopsis",
      "career summary",
    ],
  },
  {
    key: "experience",
    title: "Work Experience",
    aliases: [
      "work experience",
      "professional experience",
      "experience",
      "employment history",
    ],
  },
  {
    key: "skills",
    title: "Skills",
    aliases: ["skills", "technical skills", "core competencies", "key skills"],
  },
  {
    key: "education",
    title: "Education",
    aliases: ["education", "academic background", "academic qualifications"],
  },
  {
    key: "certifications",
    title: "Certifications",
    aliases: ["certifications", "licenses", "certificates"],
  },
  {
    key: "projects",
    title: "Projects",
    aliases: ["projects", "selected projects"],
  },
  {
    key: "awards",
    title: "Awards",
    aliases: ["awards", "honors", "achievements"],
  },
];

const escapeHtml = (value = "") =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");

const normalizeWhitespace = (value = "") => value.replace(/\r/g, "").trim();

const sectionAliasMap = new Map(
  sectionPatterns.flatMap((section) =>
    section.aliases.map((alias) => [alias, section]),
  ),
);

const parseSectionsFromText = (text) => {
  const cleaned = normalizeWhitespace(text);
  if (!cleaned) return [];

  const lines = cleaned
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const sections = [];
  let current = {
    key: "general",
    title: "General Information",
    content: [],
  };

  const flush = () => {
    if (current.content.length) {
      sections.push({
        key: current.key,
        title: current.title,
        content: current.content.join("\n").trim(),
      });
    }
  };

  for (const line of lines) {
    const normalizedLine = line
      .toLowerCase()
      .replace(/[:\-]+$/g, "")
      .trim();
    const matched = sectionAliasMap.get(normalizedLine);

    if (matched) {
      flush();
      current = {
        key: matched.key,
        title: matched.title,
        content: [],
      };
      continue;
    }

    const inferredMatch = sectionPatterns.find((section) =>
      section.aliases.some(
        (alias) =>
          normalizedLine === alias || normalizedLine.startsWith(`${alias} `),
      ),
    );

    if (inferredMatch && line.length < 50) {
      flush();
      current = {
        key: inferredMatch.key,
        title: inferredMatch.title,
        content: [],
      };
      continue;
    }

    current.content.push(line);
  }

  flush();

  return sections.filter((section) => section.content);
};

const promptTemplate = ({
  originalResume,
  summary,
  experience,
  skills,
}) => `You are a professional resume writer. Below is a person's current resume text and some optional section updates they want to make.

ORIGINAL RESUME:
${originalResume}

SECTIONS TO UPDATE (only if provided, otherwise keep original):
- New Summary: ${summary || "NO CHANGE"}
- New Work Experience: ${experience || "NO CHANGE"}
- New Skills: ${skills || "NO CHANGE"}

Instructions:
1. Keep ALL sections from the original resume
2. Only replace sections marked with new content
3. For sections marked 'NO CHANGE', copy them exactly as-is
4. Return a complete, polished, ATS-friendly resume
5. Format output as clean HTML with proper headings and bullet points
6. Maintain professional tone throughout`;

const stripCodeFence = (text = "") =>
  text
    .replace(/^```html\s*/i, "")
    .replace(/```$/i, "")
    .trim();

const htmlToPlainText = (html = "") =>
  html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<li>/gi, "* ")
    .replace(/<\/li>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/h[1-6]>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

const buildFallbackHtml = (text) => {
  const sections = parseSectionsFromText(text);

  return sections
    .map((section) => {
      const body = escapeHtml(section.content)
        .split("\n")
        .map((line) => `<p>${line}</p>`)
        .join("");

      return `<section><h2>${escapeHtml(section.title)}</h2>${body}</section>`;
    })
    .join("");
};

const sectionContentMap = (sections) =>
  sections.reduce((acc, section) => {
    acc[section.key] = section.content;
    return acc;
  }, {});

const makeDocxParagraphs = (text, docx) => {
  const { HeadingLevel, Paragraph, TextRun } = docx;
  const lines = htmlToPlainText(text)
    .split("\n")
    .map((line) => line.trim());
  const paragraphs = [];

  for (const line of lines) {
    if (!line) {
      paragraphs.push(new Paragraph({ text: "" }));
      continue;
    }

    if (line.startsWith("* ")) {
      paragraphs.push(
        new Paragraph({
          text: line.replace(/^\*\s*/, ""),
          bullet: { level: 0 },
          spacing: { after: 120 },
        }),
      );
      continue;
    }

    const upper = line === line.toUpperCase() && line.length < 50;
    const headingLike = /^[A-Z][A-Za-z\s&/]+$/.test(line) && line.length < 40;

    paragraphs.push(
      new Paragraph({
        children: [new TextRun({ text: line, bold: upper || headingLike })],
        heading: upper || headingLike ? HeadingLevel.HEADING_2 : undefined,
        spacing: { after: 120 },
      }),
    );
  }

  return paragraphs;
};

function App() {
  const [resumeFile, setResumeFile] = useState(null);
  const [parsedText, setParsedText] = useState("");
  const [parsedSections, setParsedSections] = useState([]);
  const [updates, setUpdates] = useState({
    summary: "",
    experience: "",
    skills: "",
  });
  const [generatedHtml, setGeneratedHtml] = useState("");
  const [isParsing, setIsParsing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState("");
  const [retryable, setRetryable] = useState(false);
  const previewRef = useRef(null);

  const originalSectionMap = useMemo(
    () => sectionContentMap(parsedSections),
    [parsedSections],
  );

  const comparisonRows = useMemo(() => {
    return editableSections.map((section) => ({
      ...section,
      original:
        originalSectionMap[section.key] ||
        "Section not detected in the original resume.",
      updated: updates[section.key].trim(),
      status: updates[section.key].trim() ? "Updated" : "Original",
    }));
  }, [originalSectionMap, updates]);

  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0];
    setError("");
    setRetryable(false);
    setGeneratedHtml("");

    if (!file) return;

    const allowed = ["pdf", "doc", "docx"];
    const extension = file.name.split(".").pop()?.toLowerCase();

    if (!extension || !allowed.includes(extension)) {
      setResumeFile(null);
      setParsedText("");
      setParsedSections([]);
      setError(
        "Unsupported file type. Please upload a PDF, DOC, or DOCX file.",
      );
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setResumeFile(null);
      setParsedText("");
      setParsedSections([]);
      setError("File is too large. Please upload a file smaller than 5MB.");
      return;
    }

    setResumeFile(file);
    setIsParsing(true);

    try {
      const formData = new FormData();
      formData.append("resume", file);

      const response = await fetch(`${apiBase}/api/parse-resume`, {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to parse the uploaded resume.");
      }

      setParsedText(data.text);
      setParsedSections(parseSectionsFromText(data.text));
    } catch (uploadError) {
      setResumeFile(null);
      setParsedText("");
      setParsedSections([]);
      setError(
        uploadError.message ||
          "We could not parse that resume. Please try again.",
      );
    } finally {
      setIsParsing(false);
    }
  };

  const callGemini = async () => {
    const prompt = promptTemplate({
      originalResume: parsedText,
      summary: updates.summary.trim(),
      experience: updates.experience.trim(),
      skills: updates.skills.trim(),
    });

    const response = await fetch(`${apiBase}/api/generate-resume`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ prompt }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data?.error ||
          "Resume generation failed. Please try again in a moment.",
      );
    }

    if (!data?.html) {
      throw new Error("The server did not return resume content.");
    }

    return stripCodeFence(data.html);
  };

  const handleGenerate = async () => {
    setError("");
    setRetryable(false);

    if (!resumeFile || !parsedText) {
      setError("Upload a resume file before generating a new version.");
      return;
    }

    setIsGenerating(true);

    try {
      const resultHtml = await callGemini();
      setGeneratedHtml(
        resultHtml.startsWith("<") ? resultHtml : buildFallbackHtml(resultHtml),
      );
    } catch (generationError) {
      setError(
        generationError.message ||
          "Resume generation failed. Please try again.",
      );
      setRetryable(true);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!previewRef.current) return;
    const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
      import("html2canvas"),
      import("jspdf"),
    ]);

    const canvas = await html2canvas(previewRef.current, {
      scale: 2,
      backgroundColor: "#ffffff",
    });

    const imageData = canvas.toDataURL("image/png");
    const pdf = new jsPDF("p", "mm", "a4");
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const imageWidth = pageWidth - 20;
    const imageHeight = (canvas.height * imageWidth) / canvas.width;

    let heightLeft = imageHeight;
    let position = 10;

    pdf.addImage(imageData, "PNG", 10, position, imageWidth, imageHeight);
    heightLeft -= pageHeight - 20;

    while (heightLeft > 0) {
      position = heightLeft - imageHeight + 10;
      pdf.addPage();
      pdf.addImage(imageData, "PNG", 10, position, imageWidth, imageHeight);
      heightLeft -= pageHeight - 20;
    }

    pdf.save("resume-builder-output.pdf");
  };

  const handleDownloadDocx = async () => {
    const docx = await import("docx");
    const { Document, Packer } = docx;
    const doc = new Document({
      sections: [
        {
          properties: {},
          children: makeDocxParagraphs(generatedHtml, docx),
        },
      ],
    });

    const blob = await Packer.toBlob(doc);
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "resume-builder-output.docx";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main className="min-h-screen px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[860px] animate-rise rounded-[12px] border border-slate-200 bg-white shadow-card">
        <section className="px-5 py-6 sm:px-8 sm:py-8">
          <header>
            <h1 className="text-3xl font-bold tracking-tight text-ink">
              Resume Builder
            </h1>
            <p className="mt-2 text-sm leading-6 text-muted sm:text-base">
              Upload your existing resume, keep any sections you want unchanged,
              and generate a polished ATS-friendly version powered by Gemini.
            </p>
          </header>

          <div className="my-6 h-px bg-slate-200" />

          <div className="space-y-6">
            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
              <p className="text-sm font-semibold text-slate-800">
                AI generation is configured on the server.
              </p>
              <p className="mt-1 text-sm leading-6 text-muted">
                Your public app uses your protected Gemini API key from the backend environment, so visitors never see or manage the key in the browser.
              </p>
            </div>

            <div className="rounded-2xl border border-dashed border-blue-200 bg-blue-50/70 p-4 sm:p-5">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-800">
                    Step 1: Upload your resume
                  </p>
                  <p className="mt-1 text-sm text-muted">
                    Accepts PDF, DOC, and DOCX. Maximum size: 5MB.
                  </p>
                </div>
                <label className="inline-flex min-h-[48px] cursor-pointer items-center justify-center gap-2 rounded-xl bg-brand px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700">
                  <Upload size={18} />
                  Upload Resume
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                </label>
              </div>

              <div className="mt-4 min-h-[28px] text-sm text-slate-700">
                {isParsing ? (
                  <span className="inline-flex items-center gap-2 text-brand">
                    <LoaderCircle className="animate-spin" size={16} />
                    Parsing your resume...
                  </span>
                ) : resumeFile && parsedText ? (
                  <span className="inline-flex items-center gap-2 text-success">
                    <CheckCircle2 size={18} />
                    {resumeFile.name}
                  </span>
                ) : (
                  <span className="text-muted">No file uploaded yet.</span>
                )}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {editableSections.map((section) => (
                <div
                  key={section.key}
                  className={`rounded-2xl border p-4 transition duration-300 ${section.key === "skills" ? "md:col-span-2" : ""} ${updates[section.key].trim() ? "border-emerald-200 bg-emerald-50/60" : "border-slate-200 bg-white"}`}
                >
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <label className="text-sm font-semibold text-slate-800">
                      {section.label}
                    </label>
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${updates[section.key].trim() ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}
                    >
                      {updates[section.key].trim() ? "Updated" : "Original"}
                    </span>
                  </div>
                  <textarea
                    value={updates[section.key]}
                    onChange={(event) =>
                      setUpdates((current) => ({
                        ...current,
                        [section.key]: event.target.value,
                      }))
                    }
                    placeholder={section.placeholder}
                    rows={section.key === "skills" ? 5 : 6}
                    className="min-h-[150px] w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-base text-slate-900 outline-none transition focus:border-brand focus:bg-white focus:ring-4 focus:ring-blue-100"
                  />
                  <div className="mt-2 text-right text-xs text-muted">
                    {updates[section.key].length} characters
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={handleGenerate}
              disabled={isGenerating || isParsing}
              className="inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-success px-4 py-3 text-base font-semibold text-white shadow-sm transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isGenerating ? (
                <LoaderCircle className="animate-spin" size={18} />
              ) : (
                <WandSparkles size={18} />
              )}
              {isGenerating
                ? "Generating your resume..."
                : "Generate New Resume"}
            </button>

            {error ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                <div className="flex items-start gap-2">
                  <AlertCircle size={18} className="mt-0.5 shrink-0" />
                  <div className="flex-1">
                    <p>{error}</p>
                    {retryable ? (
                      <button
                        type="button"
                        onClick={handleGenerate}
                        className="mt-3 inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-2 font-semibold text-red-700 transition hover:bg-red-100"
                      >
                        <RefreshCcw size={16} />
                        Retry
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </section>

        {parsedSections.length > 0 || generatedHtml ? (
          <section className="border-t border-slate-200 bg-slate-50/70 px-5 py-6 sm:px-8 sm:py-8">
            <div className="grid gap-6 lg:grid-cols-[0.95fr_1.35fr]">
              <div className="space-y-4">
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="mb-4 flex items-center gap-2">
                    <FileText size={18} className="text-brand" />
                    <h2 className="text-lg font-semibold text-slate-900">
                      Change Overview
                    </h2>
                  </div>
                  <div className="space-y-3">
                    {comparisonRows.map((row) => (
                      <div
                        key={row.key}
                        className="rounded-xl border border-slate-200 p-3"
                      >
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <p className="text-sm font-semibold text-slate-800">
                            {row.label}
                          </p>
                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${row.status === "Updated" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}
                          >
                            {row.status}
                          </span>
                        </div>
                        <p className="line-clamp-4 whitespace-pre-line text-sm leading-6 text-slate-600">
                          {row.status === "Updated"
                            ? row.updated
                            : row.original}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex flex-col gap-3 sm:flex-row">
                  <button
                    type="button"
                    onClick={handleDownloadPdf}
                    disabled={!generatedHtml}
                    className="inline-flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-xl bg-danger px-4 py-3 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Download size={18} />
                    Download as PDF
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadDocx}
                    disabled={!generatedHtml}
                    className="inline-flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-xl bg-word px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Download size={18} />
                    Download as Word
                  </button>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-semibold text-slate-900">
                        Resume Preview
                      </h2>
                      <p className="text-sm text-muted">
                        Generated HTML preview with your preserved and updated
                        sections.
                      </p>
                    </div>
                    {isGenerating ? (
                      <span className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-brand">
                        <LoaderCircle className="animate-spin" size={14} />
                        Generating your resume...
                      </span>
                    ) : null}
                  </div>
                  <div
                    ref={previewRef}
                    className="resume-preview min-h-[320px] rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
                    dangerouslySetInnerHTML={{
                      __html: generatedHtml || buildFallbackHtml(parsedText),
                    }}
                  />
                </div>
              </div>
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}

export default App;
