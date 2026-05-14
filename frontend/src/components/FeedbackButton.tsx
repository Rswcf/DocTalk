"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { MessageSquare, Send, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useLocale } from "../i18n";
import { submitFeedback, type FeedbackRequest } from "../lib/api";
import { useUserProfile } from "../lib/useUserProfile";

type FeedbackType = FeedbackRequest["type"];
type FeedbackArea = FeedbackRequest["area"];
type FeedbackSeverity = FeedbackRequest["severity"];

const TYPE_OPTIONS: { value: FeedbackType; label: string }[] = [
  { value: "feature_request", label: "Need a feature" },
  { value: "bug", label: "Found a bug" },
  { value: "answer_quality", label: "Answer quality" },
  { value: "citation_problem", label: "Citation problem" },
  { value: "billing_pricing", label: "Billing or pricing" },
  { value: "usability", label: "Usability" },
  { value: "other", label: "Other" },
];

const AREA_OPTIONS: { value: FeedbackArea; label: string }[] = [
  { value: "upload_parse", label: "Upload / parsing" },
  { value: "chat_answer", label: "Chat answer" },
  { value: "citation_jump", label: "Citation jump" },
  { value: "collections", label: "Collections" },
  { value: "export", label: "Export" },
  { value: "billing", label: "Billing" },
  { value: "account", label: "Account" },
  { value: "performance", label: "Performance" },
  { value: "mobile", label: "Mobile" },
  { value: "localization", label: "Language / locale" },
];

const SEVERITY_OPTIONS: { value: FeedbackSeverity; label: string }[] = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "blocking", label: "Blocking" },
];

const OPTION_BANK: Record<FeedbackType, string[]> = {
  feature_request: [
    "Compare multiple documents",
    "Reusable prompt templates",
    "Better table extraction",
    "Export answers with citations",
    "Team workspace",
  ],
  bug: [
    "Upload failed",
    "Answer did not load",
    "Citation opened the wrong place",
    "Billing state looked wrong",
    "Mobile layout broke",
  ],
  answer_quality: [
    "Missed key facts",
    "Answer was too shallow",
    "Used weak evidence",
    "Needed more structure",
    "Wrong language",
  ],
  citation_problem: [
    "Wrong page",
    "Highlight missing",
    "Source passage too short",
    "Citation unavailable",
    "Citation contradicted answer",
  ],
  billing_pricing: [
    "Price is unclear",
    "Limits are unclear",
    "Need a different plan",
    "Checkout issue",
    "Need invoice support",
  ],
  usability: [
    "Hard to find feature",
    "Too many steps",
    "Confusing copy",
    "Slow workflow",
    "Keyboard or accessibility issue",
  ],
  other: ["General feedback", "Question", "Integration request", "Data privacy concern"],
};

function toggleItem(items: string[], item: string): string[] {
  return items.includes(item) ? items.filter((value) => value !== item) : [...items, item];
}

export default function FeedbackButton() {
  const { locale, tOr } = useLocale();
  const pathname = usePathname();
  const { profile } = useUserProfile();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<FeedbackType>("feature_request");
  const [area, setArea] = useState<FeedbackArea>("chat_answer");
  const [severity, setSeverity] = useState<FeedbackSeverity>("medium");
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const commonOptions = useMemo(() => OPTION_BANK[type], [type]);

  useEffect(() => {
    setSelectedOptions([]);
  }, [type]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setStatus("idle");
    try {
      await submitFeedback({
        type,
        area,
        severity,
        selected_options: selectedOptions,
        message: message.trim() || null,
        path: pathname || null,
        locale,
        plan: profile?.plan || null,
      });
      setStatus("success");
      setMessage("");
      setSelectedOptions([]);
    } catch (e) {
      setStatus("error");
      setError(e instanceof Error ? e.message : "Feedback failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          setStatus("idle");
          setError(null);
        }}
        className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-zinc-200 text-zinc-700 transition-colors hover:bg-zinc-100 focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800 dark:focus-visible:ring-zinc-500 dark:focus-visible:ring-offset-zinc-900"
        aria-label={tOr("feedback.open", "Send feedback")}
        title={tOr("feedback.open", "Send feedback")}
      >
        <MessageSquare aria-hidden="true" size={17} />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/45 px-3 py-6 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="feedback-dialog-title"
        >
          <div className="max-h-[92vh] w-full max-w-lg overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-950">
            <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
              <div>
                <h2 id="feedback-dialog-title" className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                  {tOr("feedback.title", "Send feedback")}
                </h2>
                <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                  {tOr("feedback.subtitle", "Choose what fits; written detail is optional.")}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 focus-visible:ring-2 focus-visible:ring-zinc-400 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
                aria-label={tOr("common.close", "Close")}
              >
                <X aria-hidden="true" size={16} />
              </button>
            </div>

            <form onSubmit={onSubmit} className="max-h-[calc(92vh-57px)] overflow-y-auto p-4">
              <div className="grid gap-4">
                <label className="grid gap-1.5">
                  <span className="text-xs font-medium text-zinc-600 dark:text-zinc-300">
                    {tOr("feedback.type", "Type")}
                  </span>
                  <select
                    value={type}
                    onChange={(event) => setType(event.target.value as FeedbackType)}
                    className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-zinc-500"
                  >
                    {TYPE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="grid gap-1.5">
                    <span className="text-xs font-medium text-zinc-600 dark:text-zinc-300">
                      {tOr("feedback.area", "Area")}
                    </span>
                    <select
                      value={area}
                      onChange={(event) => setArea(event.target.value as FeedbackArea)}
                      className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-zinc-500"
                    >
                      {AREA_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </label>

                  <label className="grid gap-1.5">
                    <span className="text-xs font-medium text-zinc-600 dark:text-zinc-300">
                      {tOr("feedback.severity", "Severity")}
                    </span>
                    <select
                      value={severity}
                      onChange={(event) => setSeverity(event.target.value as FeedbackSeverity)}
                      className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-zinc-500"
                    >
                      {SEVERITY_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </label>
                </div>

                <fieldset className="grid gap-2">
                  <legend className="text-xs font-medium text-zinc-600 dark:text-zinc-300">
                    {tOr("feedback.quickChoices", "Quick choices")}
                  </legend>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {commonOptions.map((option) => (
                      <label
                        key={option}
                        className="flex min-h-10 items-center gap-2 rounded-md border border-zinc-200 px-3 py-2 text-sm text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-900"
                      >
                        <input
                          type="checkbox"
                          checked={selectedOptions.includes(option)}
                          onChange={() => setSelectedOptions((items) => toggleItem(items, option))}
                          className="h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-500 dark:border-zinc-700"
                        />
                        <span>{option}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>

                <label className="grid gap-1.5">
                  <span className="text-xs font-medium text-zinc-600 dark:text-zinc-300">
                    {tOr("feedback.message", "Optional details")}
                  </span>
                  <textarea
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                    maxLength={2000}
                    rows={4}
                    className="resize-y rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-zinc-500"
                    placeholder={tOr("feedback.placeholder", "What should change, or what went wrong?")}
                  />
                </label>

                {status === "success" && (
                  <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300">
                    {tOr("feedback.success", "Feedback received. Thank you.")}
                  </p>
                )}
                {status === "error" && (
                  <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
                    {error || tOr("feedback.error", "Could not send feedback.")}
                  </p>
                )}
              </div>

              <div className="mt-5 flex justify-end gap-2 border-t border-zinc-100 pt-4 dark:border-zinc-900">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 focus-visible:ring-2 focus-visible:ring-zinc-400 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
                >
                  {tOr("common.cancel", "Cancel")}
                </button>
                <button
                  type="submit"
                  disabled={submitting || (selectedOptions.length === 0 && message.trim().length === 0)}
                  className="inline-flex items-center gap-2 rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-zinc-400 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200"
                >
                  <Send aria-hidden="true" size={15} />
                  {submitting ? tOr("feedback.sending", "Sending") : tOr("feedback.submit", "Send")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
