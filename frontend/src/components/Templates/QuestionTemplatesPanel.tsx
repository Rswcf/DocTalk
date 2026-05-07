"use client";

import React, { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Clock3,
  Download,
  FileText,
  Pencil,
  Play,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import {
  ApiError,
  createQuestionTemplate,
  deleteQuestionTemplate,
  exportQuestionTemplateRun,
  getQuestionTemplateRun,
  listCollectionQuestionTemplateRuns,
  listDocumentQuestionTemplateRuns,
  listQuestionTemplates,
  runCollectionQuestionTemplate,
  runDocumentQuestionTemplate,
  updateQuestionTemplate,
} from "../../lib/api";
import { trackEvent } from "../../lib/analytics";
import { billingHref } from "../../lib/billingLinks";
import { useLocale } from "../../i18n";
import type { Citation, ExtractionJob, NormalizedBBox, QuestionTemplate } from "../../types";

type TemplateScope =
  | { type: "document"; documentId: string; collectionId?: never }
  | { type: "collection"; collectionId: string; documentId?: never };

interface QuestionTemplatesPanelProps {
  scope: TemplateScope;
  onCitationClick: (citation: Citation) => void;
  userPlan?: string;
  documentCount?: number;
}

function splitQuestions(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function asArray(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value) ? value.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object")) : [];
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

function toCitation(raw: Record<string, unknown>): Citation | null {
  const refIndex = Number(raw.ref_index);
  const page = Number(raw.page);
  const chunkId = typeof raw.chunk_id === "string" ? raw.chunk_id : "";
  if (!refIndex || !page || !chunkId) return null;
  const rawBboxes = Array.isArray(raw.bboxes) ? raw.bboxes : [];
  const bboxes = rawBboxes.filter((bb): bb is NormalizedBBox => {
    if (!bb || typeof bb !== "object") return false;
    const rec = bb as Record<string, unknown>;
    return ["x", "y", "w", "h"].every((key) => typeof rec[key] === "number");
  });
  return {
    refIndex,
    chunkId,
    page,
    pageEnd: typeof raw.page_end === "number" ? raw.page_end : undefined,
    bboxes,
    textSnippet: typeof raw.text_snippet === "string" ? raw.text_snippet : "",
    offset: 0,
    documentId: typeof raw.document_id === "string" ? raw.document_id : undefined,
    documentFilename: typeof raw.document_filename === "string" ? raw.document_filename : undefined,
    confidenceScore: typeof raw.confidence_score === "number" ? raw.confidence_score : undefined,
    contextText: typeof raw.context_text === "string" ? raw.context_text : undefined,
  };
}

export default function QuestionTemplatesPanel({
  scope,
  onCitationClick,
  userPlan,
  documentCount,
}: QuestionTemplatesPanelProps) {
  const { tOr, locale } = useLocale();
  const [templates, setTemplates] = useState<QuestionTemplate[]>([]);
  const [runs, setRuns] = useState<ExtractionJob[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [questionsText, setQuestionsText] = useState("");
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paywall, setPaywall] = useState<{ code: string; requiredPlan: string } | null>(null);

  const refreshRuns = useCallback(async () => {
    const data = scope.type === "document"
      ? await listDocumentQuestionTemplateRuns(scope.documentId)
      : await listCollectionQuestionTemplateRuns(scope.collectionId);
    setRuns(data);
    return data;
  }, [scope]);

  const refreshTemplates = useCallback(async () => {
    const data = await listQuestionTemplates();
    setTemplates(data);
    setSelectedTemplateId((current) => current || data[0]?.id || null);
    return data;
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([refreshTemplates(), refreshRuns()])
      .then(() => {
        if (!cancelled) setLoading(false);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load question templates");
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [refreshRuns, refreshTemplates]);

  useEffect(() => {
    if (!runs.some((run) => run.status === "queued" || run.status === "running")) return;
    const timer = window.setInterval(() => {
      void refreshRuns().catch(() => undefined);
    }, 2500);
    return () => window.clearInterval(timer);
  }, [refreshRuns, runs]);

  const activeRun = runs[0] || null;
  const selectedTemplate = templates.find((template) => template.id === selectedTemplateId) || templates[0] || null;
  const questions = splitQuestions(questionsText);
  const estimatedCells = (selectedTemplate?.questions.length || 0) * Math.max(1, documentCount || 1);

  const resetForm = useCallback(() => {
    setEditingId(null);
    setName("");
    setDescription("");
    setQuestionsText("");
  }, []);

  const editTemplate = useCallback((template: QuestionTemplate) => {
    setEditingId(template.id);
    setName(template.name);
    setDescription(template.description || "");
    setQuestionsText(template.questions.join("\n"));
  }, []);

  const saveTemplate = useCallback(async (event: FormEvent) => {
    event.preventDefault();
    if (saving || questions.length === 0) return;
    setSaving(true);
    setError(null);
    try {
      const saved = editingId
        ? await updateQuestionTemplate({ templateId: editingId, name, description, questions })
        : await createQuestionTemplate({ name, description, questions });
      setTemplates((prev) => [saved, ...prev.filter((item) => item.id !== saved.id)]);
      setSelectedTemplateId(saved.id);
      resetForm();
      trackEvent("question_template_created", {
        source: scope.type === "collection" ? "collection_reader" : "document_reader",
        reason: editingId ? "updated" : "created",
        plan: userPlan,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Template save failed");
    } finally {
      setSaving(false);
    }
  }, [description, editingId, name, questions, resetForm, saving, scope.type, userPlan]);

  const removeTemplate = useCallback(async (template: QuestionTemplate) => {
    setError(null);
    try {
      await deleteQuestionTemplate(template.id);
      setTemplates((prev) => prev.filter((item) => item.id !== template.id));
      setSelectedTemplateId((current) => current === template.id ? null : current);
      if (editingId === template.id) resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Template delete failed");
    }
  }, [editingId, resetForm]);

  const runTemplate = useCallback(async () => {
    if (!selectedTemplate || running) return;
    setRunning(true);
    setError(null);
    setPaywall(null);
    try {
      const job = scope.type === "document"
        ? await runDocumentQuestionTemplate({ documentId: scope.documentId, templateId: selectedTemplate.id, locale })
        : await runCollectionQuestionTemplate({ collectionId: scope.collectionId, templateId: selectedTemplate.id, locale });
      setRuns((prev) => [job, ...prev.filter((item) => item.id !== job.id)]);
      trackEvent("question_template_run_created", {
        source: scope.type === "collection" ? "collection_reader" : "document_reader",
        reason: scope.type,
        plan: userPlan,
      });
      window.setTimeout(() => {
        void getQuestionTemplateRun(job.id)
          .then((updated) => setRuns((prev) => [updated, ...prev.filter((item) => item.id !== updated.id)]))
          .catch(() => undefined);
      }, 1200);
    } catch (err) {
      if (err instanceof ApiError && (err.code === "PLAN_REQUIRED" || err.code === "INSUFFICIENT_CREDITS")) {
        const requiredPlan = typeof err.detail.required_plan === "string" ? err.detail.required_plan : scope.type === "collection" ? "pro" : "plus";
        setPaywall({ code: err.code, requiredPlan });
      } else {
        setError(err instanceof Error ? err.message : "Question template run failed");
      }
    } finally {
      setRunning(false);
    }
  }, [locale, running, scope, selectedTemplate, userPlan]);

  const handleExport = useCallback(async (run: ExtractionJob, format: "md" | "csv") => {
    try {
      const blob = await exportQuestionTemplateRun(run.id, format);
      downloadBlob(blob, `question-template-${run.id.slice(0, 8)}.${format}`);
      trackEvent("question_template_export_clicked", {
        source: scope.type === "collection" ? "collection_reader" : "document_reader",
        reason: format,
        plan: userPlan,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
    }
  }, [scope.type, userPlan]);

  if (loading) {
    return <div className="p-4 text-sm text-zinc-500 dark:text-zinc-400">{tOr("common.loading", "Loading...")}</div>;
  }

  const isWorking = running || activeRun?.status === "queued" || activeRun?.status === "running";
  const upgradePlan = paywall?.requiredPlan === "pro" ? "pro" : "plus";

  return (
    <div className="h-full overflow-y-auto bg-white px-4 py-4 dark:bg-zinc-950 sm:px-5">
      <div className="mx-auto max-w-5xl min-w-0 space-y-4">
        <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="font-mono text-[11px] font-semibold uppercase text-zinc-500 dark:text-zinc-400">
                {scope.type === "collection"
                  ? tOr("templates.collectionKicker", "Batch question template")
                  : tOr("templates.documentKicker", "Reusable question template")}
              </p>
              <h2 className="mt-1 text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                {scope.type === "collection"
                  ? tOr("templates.collectionTitle", "Ask every document the same questions")
                  : tOr("templates.documentTitle", "Run a saved checklist")}
              </h2>
              <p className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                {scope.type === "collection"
                  ? tOr("templates.collectionSubtitle", "Pro runs produce a cited answer matrix across the collection.")
                  : tOr("templates.documentSubtitle", "Plus runs turn repeated review questions into cited answers.")}
              </p>
            </div>
            <button
              type="button"
              onClick={() => resetForm()}
              className="inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border border-zinc-200 px-3 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              <Plus size={14} aria-hidden="true" />
              {tOr("templates.newTemplate", "New template")}
            </button>
          </div>
        </section>

        <div className="grid min-w-0 gap-4">
          <section className="min-w-0 rounded-lg border border-zinc-200 bg-white p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                {tOr("templates.savedTemplates", "Saved templates")}
              </h3>
              <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                {templates.length}
              </span>
            </div>
            {templates.length === 0 ? (
              <p className="rounded-lg border border-dashed border-zinc-300 p-4 text-sm leading-6 text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
                {tOr("templates.empty", "Create a template or start from a preset.")}
              </p>
            ) : (
              <div className="space-y-2">
                {templates.map((template) => {
                  const active = selectedTemplate?.id === template.id;
                  return (
                    <div
                      key={template.id}
                      className={`rounded-lg border p-3 ${
                        active
                          ? "border-zinc-900 bg-zinc-50 dark:border-zinc-100 dark:bg-zinc-800/70"
                          : "border-zinc-200 dark:border-zinc-800"
                      }`}
                    >
                      <button type="button" onClick={() => setSelectedTemplateId(template.id)} className="block w-full text-left">
                        <span className="block truncate text-sm font-semibold text-zinc-950 dark:text-zinc-50">{template.name}</span>
                        <span className="mt-1 block text-xs text-zinc-500 dark:text-zinc-400">
                          {tOr("templates.questionCount", "{count} questions", { count: template.questions.length })}
                        </span>
                      </button>
                      <div className="mt-3 flex gap-1">
                        <button
                          type="button"
                          onClick={() => editTemplate(template)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-700 dark:hover:text-zinc-100"
                          aria-label={tOr("templates.edit", "Edit")}
                        >
                          <Pencil size={14} aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={() => void removeTemplate(template)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-zinc-500 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/40 dark:hover:text-red-300"
                          aria-label={tOr("templates.delete", "Delete")}
                        >
                          <Trash2 size={14} aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <div className="min-w-0 space-y-4">
            <section className="min-w-0 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <form onSubmit={(event) => void saveTemplate(event)} className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-[1fr,1fr]">
                  <label className="block">
                    <span className="text-xs font-medium text-zinc-600 dark:text-zinc-300">{tOr("templates.name", "Template name")}</span>
                    <input
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      placeholder={tOr("templates.namePlaceholder", "e.g. Contract review checklist")}
                      className="mt-1 h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs font-medium text-zinc-600 dark:text-zinc-300">{tOr("templates.description", "Description")}</span>
                    <input
                      value={description}
                      onChange={(event) => setDescription(event.target.value)}
                      placeholder={tOr("templates.descriptionPlaceholder", "Optional internal note")}
                      className="mt-1 h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                    />
                  </label>
                </div>
                <label className="block">
                  <span className="text-xs font-medium text-zinc-600 dark:text-zinc-300">{tOr("templates.questions", "Questions")}</span>
                  <textarea
                    value={questionsText}
                    onChange={(event) => setQuestionsText(event.target.value)}
                    placeholder={tOr("templates.questionsPlaceholder", "One question per line")}
                    rows={5}
                    className="mt-1 w-full resize-y rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm leading-6 text-zinc-900 outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                  />
                </label>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    {tOr("templates.saveHint", "{count} questions will be saved.", { count: questions.length })}
                  </p>
                  <button
                    type="submit"
                    disabled={saving || !name.trim() || questions.length === 0}
                    className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-zinc-900 px-3 text-sm font-medium text-white shadow-sm transition-colors hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
                  >
                    <Save size={14} aria-hidden="true" />
                    {editingId ? tOr("templates.update", "Update template") : tOr("templates.save", "Save template")}
                  </button>
                </div>
              </form>
            </section>

            <section className="min-w-0 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                    {selectedTemplate?.name || tOr("templates.selectTemplate", "Select a template")}
                  </h3>
                  <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                    {selectedTemplate
                      ? tOr("templates.runEstimate", "{count} answer cells will be generated.", { count: estimatedCells })
                      : tOr("templates.noTemplateSelected", "Create or select a template first.")}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void runTemplate()}
                  disabled={!selectedTemplate || isWorking}
                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-zinc-900 px-3 text-sm font-medium text-white shadow-sm transition-colors hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
                >
                  <Play size={14} aria-hidden="true" />
                  {isWorking ? tOr("templates.running", "Running...") : tOr("templates.run", "Run template")}
                </button>
              </div>
              {paywall && (
                <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">
                  <p className="font-medium">
                    {paywall.code === "INSUFFICIENT_CREDITS"
                      ? tOr("credits.insufficientCredits", "Insufficient Credits")
                      : tOr("templates.planRequired", "This workflow requires an upgrade.")}
                  </p>
                  <Link
                    href={billingHref({ plan: upgradePlan, source: "question_templates", reason: paywall.code.toLowerCase() })}
                    className="mt-2 inline-flex text-sm font-medium underline"
                  >
                    {upgradePlan === "pro" ? tOr("credits.upgradeToPro", "Upgrade to Pro") : tOr("credits.upgradeToPlus", "Upgrade to Plus")}
                  </Link>
                </div>
              )}
              {error && (
                <div className="mt-3 flex gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-100">
                  <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
                  <span>{error}</span>
                </div>
              )}
            </section>

            {activeRun && (
              <section className="min-w-0 overflow-hidden rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-2">
                    {activeRun.status === "succeeded" ? (
                      <CheckCircle2 size={16} className="text-emerald-600" aria-hidden="true" />
                    ) : activeRun.status === "failed" ? (
                      <AlertTriangle size={16} className="text-red-600" aria-hidden="true" />
                    ) : (
                      <Clock3 size={16} className="text-amber-600" aria-hidden="true" />
                    )}
                    <div>
                      <h3 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                        {asString(activeRun.input_scope?.template_name) || tOr("templates.latestRun", "Latest template run")}
                      </h3>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        {activeRun.status === "succeeded"
                          ? tOr("extract.status.succeeded", "Ready")
                          : activeRun.status === "failed"
                            ? tOr("extract.status.failed", "Failed")
                            : tOr("extract.status.running", "Working...")}
                      </p>
                    </div>
                  </div>
                  {activeRun.status === "succeeded" && (
                    <div className="flex gap-2">
                      <button type="button" onClick={() => void handleExport(activeRun, "md")} className="inline-flex items-center gap-1 rounded-md border border-zinc-200 px-2.5 py-1.5 text-xs font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800">
                        <Download size={13} aria-hidden="true" /> MD
                      </button>
                      <button type="button" onClick={() => void handleExport(activeRun, "csv")} className="inline-flex items-center gap-1 rounded-md border border-zinc-200 px-2.5 py-1.5 text-xs font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800">
                        <Download size={13} aria-hidden="true" /> CSV
                      </button>
                    </div>
                  )}
                </div>
                {activeRun.status === "failed" && (
                  <p className="text-sm text-red-700 dark:text-red-300">
                    {activeRun.error_message || tOr("templates.failed", "Question template run failed.")}
                  </p>
                )}
                {(activeRun.status === "queued" || activeRun.status === "running") && (
                  <div className="space-y-2">
                    <div className="h-2 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
                      <div className="h-full w-1/2 animate-pulse rounded-full bg-zinc-900 motion-reduce:animate-none dark:bg-zinc-50" />
                    </div>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">
                      {tOr("templates.runningHint", "DocTalk is applying the checklist and building cited answers.")}
                    </p>
                  </div>
                )}
                {activeRun.status === "succeeded" && activeRun.result && (
                  <TemplateResult data={activeRun.result.structured_json} onCitationClick={onCitationClick} tOr={tOr} />
                )}
              </section>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function TemplateResult({
  data,
  onCitationClick,
  tOr,
}: {
  data: Record<string, unknown>;
  onCitationClick: (citation: Citation) => void;
  tOr: (key: string, fallback: string, params?: Record<string, string | number>) => string;
}) {
  const answers = asArray(data.answers);
  if (answers.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-zinc-300 p-4 text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
        {tOr("templates.noAnswers", "No answers were generated.")}
      </p>
    );
  }
  return (
    <div className="max-w-full overflow-x-auto">
      <table className="w-full min-w-[760px] text-left text-sm">
        <thead className="text-xs uppercase text-zinc-500 dark:text-zinc-400">
          <tr>
            <th className="border-b border-zinc-200 px-2 py-2 font-medium dark:border-zinc-800">{tOr("templates.document", "Document")}</th>
            <th className="border-b border-zinc-200 px-2 py-2 font-medium dark:border-zinc-800">{tOr("templates.question", "Question")}</th>
            <th className="border-b border-zinc-200 px-2 py-2 font-medium dark:border-zinc-800">{tOr("templates.answer", "Answer")}</th>
            <th className="w-36 border-b border-zinc-200 px-2 py-2 font-medium dark:border-zinc-800">{tOr("templates.sources", "Sources")}</th>
          </tr>
        </thead>
        <tbody>
          {answers.map((answer, index) => {
            const citations = asArray(answer.citations).map(toCitation).filter((item): item is Citation => Boolean(item));
            return (
              <tr key={`${asString(answer.document_id)}-${asString(answer.question_index)}-${index}`} className="align-top">
                <td className="border-b border-zinc-100 px-2 py-3 text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                  <span className="inline-flex max-w-[180px] items-center gap-1 truncate">
                    <FileText size={13} aria-hidden="true" />
                    {asString(answer.document_filename) || "Document"}
                  </span>
                </td>
                <td className="border-b border-zinc-100 px-2 py-3 font-medium text-zinc-900 dark:border-zinc-800 dark:text-zinc-100">
                  {asString(answer.question)}
                </td>
                <td className="border-b border-zinc-100 px-2 py-3 leading-6 text-zinc-700 dark:border-zinc-800 dark:text-zinc-200">
                  {asString(answer.answer) || <span className="text-zinc-400">{tOr("templates.noAnswer", "No answer")}</span>}
                </td>
                <td className="border-b border-zinc-100 px-2 py-3 dark:border-zinc-800">
                  <div className="flex flex-wrap gap-1">
                    {citations.length === 0 ? (
                      <span className="text-xs text-zinc-400">-</span>
                    ) : (
                      citations.map((citation, citationIndex) => (
                        <button
                          key={`${citation.chunkId}-${citation.refIndex}-${citationIndex}`}
                          type="button"
                          onClick={() => onCitationClick(citation)}
                          className="inline-flex min-h-6 items-center rounded bg-amber-50 px-1.5 text-[11px] font-semibold text-amber-800 ring-1 ring-amber-200 hover:bg-amber-100 dark:bg-amber-950/30 dark:text-amber-200 dark:ring-amber-900"
                          title={tOr("citation.jumpTo", "Jump to page {page}", { page: citation.page })}
                        >
                          p.{citation.page}
                        </button>
                      ))
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
