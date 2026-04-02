import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Download,
  LoaderCircle,
  Moon,
  RefreshCcw,
  Sparkles,
  SunMedium,
  Upload,
  WandSparkles,
} from "lucide-react";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const apiBase = import.meta.env.VITE_API_BASE_URL || "";
const THEME_STORAGE_KEY = "resume-builder-theme";

const editableSections = [
  {
    key: "summary",
    label: "Professional Summary",
    helper: "Refresh your intro without changing the rest of the resume.",
    placeholder: "Enter new summary (leave blank to keep original)...",
  },
  {
    key: "experience",
    label: "Work Experience",
    helper: "Add your latest role, achievements, or responsibilities.",
    placeholder:
      "Describe new work experience (leave blank to keep original)...",
  },
  {
    key: "skills",
    label: "Skills",
    helper: "Update tools, technologies, and strengths for this version.",
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

const getInitialTheme = () => {
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === "dark" || stored === "light") return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
};

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

const parseHtmlToBlocks = (html) => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div>${html}</div>`, "text/html");
  const root = doc.body.firstElementChild;
  const blocks = [];

  const pushParagraph = (text) => {
    const cleaned = text.replace(/\s+/g, " ").trim();
    if (cleaned) {
      blocks.push({ type: "paragraph", text: cleaned });
    }
  };

  const walk = (node) => {
    if (!node) return;

    if (node.nodeType === Node.TEXT_NODE) {
      pushParagraph(node.textContent || "");
      return;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return;

    const tag = node.tagName.toLowerCase();

    if (/^h[1-6]$/.test(tag)) {
      const level = Number(tag.replace("h", ""));
      const text = node.textContent?.trim();
      if (text) blocks.push({ type: "heading", level, text });
      return;
    }

    if (tag === "p") {
      pushParagraph(node.textContent || "");
      return;
    }

    if (tag === "ul" || tag === "ol") {
      const items = Array.from(node.querySelectorAll(":scope > li"))
        .map((item) => item.textContent?.replace(/\s+/g, " ").trim())
        .filter(Boolean);
      if (items.length) {
        blocks.push({ type: "list", items });
      }
      return;
    }

    Array.from(node.childNodes).forEach(walk);
  };

  Array.from(root.childNodes).forEach(walk);
  return blocks;
};

const getExportBlocks = (html, fallbackText) => {
  const source = html || buildFallbackHtml(fallbackText);
  const blocks = parseHtmlToBlocks(source);
  return blocks.length ? blocks : [{ type: "paragraph", text: source }];
};
const makeDocxParagraphs = (blocks, docx) => {
  const {
    AlignmentType,
    BorderStyle,
    HeadingLevel,
    Paragraph,
    TextRun,
  } = docx;

  return blocks
    .map((block, index) => {
      if (block.type === "heading") {
        if (block.level === 1 || index === 0) {
          return new Paragraph({
            children: [
              new TextRun({
                text: block.text,
                bold: true,
                size: 34,
                font: "Aptos Display",
                color: "0F172A",
              }),
            ],
            spacing: { after: 180 },
            heading: HeadingLevel.TITLE,
          });
        }

        return new Paragraph({
          children: [
            new TextRun({
              text: block.text.toUpperCase(),
              bold: true,
              size: 22,
              font: "Aptos",
              color: "1D4ED8",
            }),
          ],
          spacing: { before: 220, after: 120 },
          border: {
            bottom: {
              color: "CBD5E1",
              style: BorderStyle.SINGLE,
              size: 4,
            },
          },
          heading: HeadingLevel.HEADING_2,
        });
      }

      if (block.type === "list") {
        return block.items.map((item) =>
          new Paragraph({
            text: item,
            bullet: { level: 0 },
            spacing: { after: 90 },
            indent: { left: 360, hanging: 180 },
            alignment: AlignmentType.LEFT,
          }),
        );
      }

      return new Paragraph({
        children: [
          new TextRun({
            text: block.text,
            size: 21,
            font: "Aptos",
            color: "334155",
          }),
        ],
        spacing: { after: 110 },
        alignment: AlignmentType.LEFT,
      });
    })
    .flat();
};

const formatErrorMessage = (message = "") => {
  const normalized = message.toLowerCase();

  if (
    normalized.includes("quota") ||
    normalized.includes("free-tier") ||
    normalized.includes("rate limit")
  ) {
    return "Resume generation is temporarily unavailable because the current Gemini API key has no quota left right now. Wait a little and try again, or replace the server key with one that has available quota.";
  }

  return message;
};

function App() {
  const [theme, setTheme] = useState(getInitialTheme);
  const [resumeFile, setResumeFile] = useState(null);
  const [parsedText, setParsedText] = useState("");
  const [parsedSections, setParsedSections] = useState([]);
  const [updates, setUpdates] = useState({
    summary: "",
    experience: "",
    skills: "",
  });
  const [generatedHtml, setGeneratedHtml] = useState("");
  const [activeModel, setActiveModel] = useState("");
  const [isParsing, setIsParsing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState("");
  const [retryable, setRetryable] = useState(false);
  const previewRef = useRef(null);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

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

  const completedCount = comparisonRows.filter(
    (row) => row.status === "Updated",
  ).length;

  const exportBlocks = useMemo(
    () => getExportBlocks(generatedHtml, parsedText),
    [generatedHtml, parsedText],
  );

  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0];
    setError("");
    setRetryable(false);
    setGeneratedHtml("");
    setActiveModel("");

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
        formatErrorMessage(
          data?.error ||
            "Resume generation failed. Please try again in a moment.",
        ),
      );
    }

    if (!data?.html) {
      throw new Error("The server did not return resume content.");
    }

    setActiveModel(data.model || "");
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
        formatErrorMessage(
          generationError.message ||
            "Resume generation failed. Please try again.",
        ),
      );
      setRetryable(true);
    } finally {
      setIsGenerating(false);
    }
  };
  const handleDownloadPdf = async () => {
    const { default: jsPDF } = await import("jspdf");
    const pdf = new jsPDF("p", "mm", "a4");
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 16;
    const usableWidth = pageWidth - margin * 2;
    let y = 18;

    const ensureSpace = (height) => {
      if (y + height > pageHeight - 16) {
        pdf.addPage();
        y = 18;
      }
    };

    const drawTextBlock = ({
      text,
      fontSize,
      color = [51, 65, 85],
      bold = false,
      indent = 0,
      gapAfter = 2.5,
    }) => {
      pdf.setFont("helvetica", bold ? "bold" : "normal");
      pdf.setFontSize(fontSize);
      pdf.setTextColor(...color);
      const lines = pdf.splitTextToSize(text, usableWidth - indent);
      const lineHeight = fontSize * 0.42;
      const blockHeight = lines.length * lineHeight + gapAfter;
      ensureSpace(blockHeight + 2);
      pdf.text(lines, margin + indent, y);
      y += lines.length * lineHeight + gapAfter;
    };

    exportBlocks.forEach((block, index) => {
      if (block.type === "heading") {
        if (block.level === 1 || index === 0) {
          drawTextBlock({
            text: block.text,
            fontSize: 20,
            color: [15, 23, 42],
            bold: true,
            gapAfter: 3.5,
          });
          return;
        }

        y += 2;
        drawTextBlock({
          text: block.text.toUpperCase(),
          fontSize: 10.5,
          color: [29, 78, 216],
          bold: true,
          gapAfter: 1.8,
        });
        pdf.setDrawColor(203, 213, 225);
        pdf.line(margin, y - 0.4, pageWidth - margin, y - 0.4);
        y += 2.4;
        return;
      }

      if (block.type === "list") {
        block.items.forEach((item) => {
          drawTextBlock({
            text: `• ${item}`,
            fontSize: 10.5,
            color: [51, 65, 85],
            indent: 2,
            gapAfter: 1.5,
          });
        });
        y += 1;
        return;
      }

      drawTextBlock({
        text: block.text,
        fontSize: 10.8,
        color: [51, 65, 85],
        gapAfter: 2.2,
      });
    });

    pdf.save("resume-builder-output.pdf");
  };

  const handleDownloadDocx = async () => {
    const docx = await import("docx");
    const { Document, Packer } = docx;
    const doc = new Document({
      sections: [
        {
          properties: {
            page: {
              margin: {
                top: 720,
                right: 720,
                bottom: 720,
                left: 720,
              },
            },
          },
          children: makeDocxParagraphs(exportBlocks, docx),
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

  const cardSurface =
    "rounded-[24px] border border-slate-200/90 bg-white/95 p-5 shadow-card backdrop-blur sm:p-6 dark:border-slate-800 dark:bg-slate-950/90";

  return (
    <main className="min-h-screen px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
      <div className="mx-auto max-w-[1460px] space-y-6 animate-rise">
        <section className="overflow-hidden rounded-[30px] border border-slate-200/80 bg-white/90 shadow-card backdrop-blur dark:border-slate-800 dark:bg-slate-950/90">
          <div className="grid gap-8 px-5 py-6 sm:px-8 sm:py-8 lg:grid-cols-[1.22fr_0.78fr] lg:px-10 lg:py-10 xl:gap-10">
            <div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                  <Sparkles size={14} className="text-brand" />
                  Resume Builder
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setTheme((current) =>
                      current === "dark" ? "light" : "dark",
                    )
                  }
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  {theme === "dark" ? (
                    <SunMedium size={16} />
                  ) : (
                    <Moon size={16} />
                  )}
                  {theme === "dark" ? "Light mode" : "Dark mode"}
                </button>
              </div>
              <h1 className="mt-5 max-w-3xl text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl lg:text-5xl dark:text-white">
                Turn your existing resume into a sharper, cleaner, job-ready
                version.
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-8 text-slate-600 sm:text-lg dark:text-slate-300">
                Upload your current resume, update only the sections you want to
                change, and generate a polished ATS-friendly version without
                losing your original structure.
              </p>
              <div className="mt-6 flex flex-wrap gap-3 text-sm text-slate-600 dark:text-slate-300">
                <span className="rounded-full bg-slate-100 px-3 py-2 dark:bg-slate-900">
                  Better PDF spacing
                </span>
                <span className="rounded-full bg-slate-100 px-3 py-2 dark:bg-slate-900">
                  Structured Word export
                </span>
                <span className="rounded-full bg-slate-100 px-3 py-2 dark:bg-slate-900">
                  Persistent light and dark mode
                </span>
              </div>
            </div>

            <div className="grid gap-4 rounded-[24px] border border-slate-800 bg-slate-950 p-5 text-white shadow-2xl shadow-slate-900/20 sm:grid-cols-3 lg:grid-cols-1 dark:border-slate-700 dark:bg-slate-900">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                  Resume file
                </p>
                <p className="mt-2 break-words text-xl font-semibold">
                  {resumeFile?.name || "Not uploaded"}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                  Updated sections
                </p>
                <p className="mt-2 text-xl font-semibold">{completedCount}/3</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                  Generation model
                </p>
                <p className="mt-2 break-words text-xl font-semibold">
                  {activeModel || "Ready"}
                </p>
              </div>
            </div>
          </div>
        </section>
        <section className="grid gap-6 xl:grid-cols-[0.88fr_1.12fr]">
          <div className="space-y-6">
            <div className={cardSurface}>
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                    Step 1
                  </p>
                  <h2 className="mt-1 text-xl font-semibold text-slate-950 dark:text-white">
                    Upload your base resume
                  </h2>
                  <p className="mt-2 text-sm leading-7 text-slate-600 dark:text-slate-300">
                    Accepted formats: PDF, DOC, DOCX. File size up to 5MB.
                  </p>
                </div>
                <label className="inline-flex min-h-[48px] cursor-pointer items-center justify-center gap-2 rounded-2xl bg-brand px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700">
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

              <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200">
                {isParsing ? (
                  <span className="inline-flex items-center gap-2 text-brand">
                    <LoaderCircle className="animate-spin" size={16} />
                    Parsing your resume...
                  </span>
                ) : resumeFile && parsedText ? (
                  <span className="inline-flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
                    <CheckCircle2 size={18} />
                    {resumeFile.name}
                  </span>
                ) : (
                  <span className="text-slate-500 dark:text-slate-400">
                    No file uploaded yet.
                  </span>
                )}
              </div>
            </div>

            <div className={cardSurface}>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                    Step 2
                  </p>
                  <h2 className="mt-1 text-xl font-semibold text-slate-950 dark:text-white">
                    Update the sections you want
                  </h2>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:bg-slate-900 dark:text-slate-300">
                  Leave blank to keep original
                </span>
              </div>

              <div className="mt-5 space-y-4">
                {editableSections.map((section) => (
                  <div
                    key={section.key}
                    className={`rounded-3xl border p-4 transition duration-300 sm:p-5 ${updates[section.key].trim() ? "border-emerald-200 bg-emerald-50/70 dark:border-emerald-900 dark:bg-emerald-950/30" : "border-slate-200 bg-slate-50/80 dark:border-slate-800 dark:bg-slate-900/70"}`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                          {section.label}
                        </h3>
                        <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">
                          {section.helper}
                        </p>
                      </div>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${updates[section.key].trim() ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300" : "bg-white text-slate-600 dark:bg-slate-800 dark:text-slate-300"}`}
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
                      rows={section.key === "skills" ? 4 : 5}
                      className="mt-4 min-h-[138px] w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900 outline-none transition focus:border-brand focus:ring-4 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:placeholder:text-slate-500 dark:focus:ring-blue-950"
                    />
                    <div className="mt-3 flex items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
                      <span>{section.helper}</span>
                      <span>{updates[section.key].length} characters</span>
                    </div>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={handleGenerate}
                disabled={isGenerating || isParsing}
                className="mt-5 inline-flex min-h-[54px] w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-base font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70 dark:bg-brand dark:hover:bg-blue-700"
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
                <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
                  <div className="flex items-start gap-3">
                    <AlertCircle size={18} className="mt-0.5 shrink-0" />
                    <div className="flex-1">
                      <p className="font-medium">Generation couldn't finish.</p>
                      <p className="mt-1 leading-6">{error}</p>
                      {retryable ? (
                        <button
                          type="button"
                          onClick={handleGenerate}
                          className="mt-3 inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-amber-200 bg-white px-4 py-2 font-semibold text-amber-900 transition hover:bg-amber-100 dark:border-amber-800 dark:bg-slate-900 dark:text-amber-100 dark:hover:bg-slate-800"
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
          </div>

          <div className="space-y-6">
            <div className={cardSurface}>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                    Change Overview
                  </p>
                  <h2 className="mt-1 text-xl font-semibold text-slate-950 dark:text-white">
                    What will stay and what will change
                  </h2>
                </div>
                <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:bg-slate-900 dark:text-slate-300">
                  <ArrowRight size={14} />
                  {completedCount} section
                  {completedCount === 1 ? "" : "s"} updated
                </div>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-3 xl:grid-cols-3">
                {comparisonRows.map((row) => (
                  <div
                    key={row.key}
                    className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/70"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                        {row.label}
                      </h3>
                      <span
                        className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${row.status === "Updated" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300" : "bg-white text-slate-600 dark:bg-slate-800 dark:text-slate-300"}`}
                      >
                        {row.status}
                      </span>
                    </div>
                    <p className="mt-3 line-clamp-5 whitespace-pre-line text-sm leading-6 text-slate-600 dark:text-slate-300">
                      {row.status === "Updated" ? row.updated : row.original}
                    </p>
                  </div>
                ))}
              </div>
            </div>
            <div className={cardSurface}>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                    Final Resume
                  </p>
                  <h2 className="mt-1 text-xl font-semibold text-slate-950 dark:text-white">
                    Preview and export
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                    Review the generated result, then export it as PDF or Word.
                  </p>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <button
                    type="button"
                    onClick={handleDownloadPdf}
                    disabled={!generatedHtml}
                    className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-2xl bg-rose-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Download size={18} />
                    Download PDF
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadDocx}
                    disabled={!generatedHtml}
                    className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-2xl bg-brand px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Download size={18} />
                    Download Word
                  </button>
                </div>
              </div>

              <div className="resume-preview-frame mt-5 overflow-x-hidden rounded-[28px] border border-slate-200 bg-slate-100/80 p-3 dark:border-slate-800 dark:bg-slate-900/70 sm:p-5">
                <div
                  ref={previewRef}
                  className="resume-preview-page mx-auto w-full max-w-[850px] rounded-[24px] border border-slate-200 bg-white p-6 shadow-[0_24px_70px_rgba(15,23,42,0.08)] sm:p-8 lg:p-10"
                  dangerouslySetInnerHTML={{
                    __html: generatedHtml || buildFallbackHtml(parsedText),
                  }}
                />
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

export default App;
