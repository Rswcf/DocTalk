"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { MessageSquare, Send, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useLocale } from "../i18n";
import { submitFeedback, type FeedbackRequest } from "../lib/api";
import { useUserProfile } from "../lib/useUserProfile";

type FeedbackType = FeedbackRequest["type"];
type FeedbackArea = FeedbackRequest["area"];
type FeedbackSeverity = FeedbackRequest["severity"];

type LocalizedOption<T extends string = string> = {
  value: T;
  labelKey: string;
  fallback: string;
};

const TYPE_OPTIONS: LocalizedOption<FeedbackType>[] = [
  { value: "feature_request", labelKey: "feedback.type.feature_request", fallback: "Need a feature" },
  { value: "bug", labelKey: "feedback.type.bug", fallback: "Found a bug" },
  { value: "answer_quality", labelKey: "feedback.type.answer_quality", fallback: "Answer quality" },
  { value: "citation_problem", labelKey: "feedback.type.citation_problem", fallback: "Citation problem" },
  { value: "billing_pricing", labelKey: "feedback.type.billing_pricing", fallback: "Billing or pricing" },
  { value: "usability", labelKey: "feedback.type.usability", fallback: "Usability" },
  { value: "other", labelKey: "feedback.type.other", fallback: "Other" },
];

const AREA_OPTIONS: LocalizedOption<FeedbackArea>[] = [
  { value: "upload_parse", labelKey: "feedback.area.upload_parse", fallback: "Upload / parsing" },
  { value: "chat_answer", labelKey: "feedback.area.chat_answer", fallback: "Chat answer" },
  { value: "citation_jump", labelKey: "feedback.area.citation_jump", fallback: "Citation jump" },
  { value: "collections", labelKey: "feedback.area.collections", fallback: "Collections" },
  { value: "export", labelKey: "feedback.area.export", fallback: "Export" },
  { value: "billing", labelKey: "feedback.area.billing", fallback: "Billing" },
  { value: "account", labelKey: "feedback.area.account", fallback: "Account" },
  { value: "performance", labelKey: "feedback.area.performance", fallback: "Performance" },
  { value: "mobile", labelKey: "feedback.area.mobile", fallback: "Mobile" },
  { value: "localization", labelKey: "feedback.area.localization", fallback: "Language / locale" },
];

const SEVERITY_OPTIONS: LocalizedOption<FeedbackSeverity>[] = [
  { value: "low", labelKey: "feedback.severity.low", fallback: "Low" },
  { value: "medium", labelKey: "feedback.severity.medium", fallback: "Medium" },
  { value: "high", labelKey: "feedback.severity.high", fallback: "High" },
  { value: "blocking", labelKey: "feedback.severity.blocking", fallback: "Blocking" },
];

const OPTION_BANK: Record<FeedbackType, LocalizedOption[]> = {
  feature_request: [
    { value: "compare_multiple_documents", labelKey: "feedback.option.compare_multiple_documents", fallback: "Compare multiple documents" },
    { value: "reusable_prompt_templates", labelKey: "feedback.option.reusable_prompt_templates", fallback: "Reusable prompt templates" },
    { value: "better_table_extraction", labelKey: "feedback.option.better_table_extraction", fallback: "Better table extraction" },
    { value: "export_answers_with_citations", labelKey: "feedback.option.export_answers_with_citations", fallback: "Export answers with citations" },
    { value: "team_workspace", labelKey: "feedback.option.team_workspace", fallback: "Team workspace" },
  ],
  bug: [
    { value: "upload_failed", labelKey: "feedback.option.upload_failed", fallback: "Upload failed" },
    { value: "answer_did_not_load", labelKey: "feedback.option.answer_did_not_load", fallback: "Answer did not load" },
    { value: "citation_opened_wrong_place", labelKey: "feedback.option.citation_opened_wrong_place", fallback: "Citation opened the wrong place" },
    { value: "billing_state_wrong", labelKey: "feedback.option.billing_state_wrong", fallback: "Billing state looked wrong" },
    { value: "mobile_layout_broke", labelKey: "feedback.option.mobile_layout_broke", fallback: "Mobile layout broke" },
  ],
  answer_quality: [
    { value: "missed_key_facts", labelKey: "feedback.option.missed_key_facts", fallback: "Missed key facts" },
    { value: "answer_too_shallow", labelKey: "feedback.option.answer_too_shallow", fallback: "Answer was too shallow" },
    { value: "used_weak_evidence", labelKey: "feedback.option.used_weak_evidence", fallback: "Used weak evidence" },
    { value: "needed_more_structure", labelKey: "feedback.option.needed_more_structure", fallback: "Needed more structure" },
    { value: "wrong_language", labelKey: "feedback.option.wrong_language", fallback: "Wrong language" },
  ],
  citation_problem: [
    { value: "wrong_page", labelKey: "feedback.option.wrong_page", fallback: "Wrong page" },
    { value: "highlight_missing", labelKey: "feedback.option.highlight_missing", fallback: "Highlight missing" },
    { value: "source_passage_too_short", labelKey: "feedback.option.source_passage_too_short", fallback: "Source passage too short" },
    { value: "citation_unavailable", labelKey: "feedback.option.citation_unavailable", fallback: "Citation unavailable" },
    { value: "citation_contradicted_answer", labelKey: "feedback.option.citation_contradicted_answer", fallback: "Citation contradicted answer" },
  ],
  billing_pricing: [
    { value: "price_unclear", labelKey: "feedback.option.price_unclear", fallback: "Price is unclear" },
    { value: "limits_unclear", labelKey: "feedback.option.limits_unclear", fallback: "Limits are unclear" },
    { value: "need_different_plan", labelKey: "feedback.option.need_different_plan", fallback: "Need a different plan" },
    { value: "checkout_issue", labelKey: "feedback.option.checkout_issue", fallback: "Checkout issue" },
    { value: "need_invoice_support", labelKey: "feedback.option.need_invoice_support", fallback: "Need invoice support" },
  ],
  usability: [
    { value: "hard_to_find_feature", labelKey: "feedback.option.hard_to_find_feature", fallback: "Hard to find feature" },
    { value: "too_many_steps", labelKey: "feedback.option.too_many_steps", fallback: "Too many steps" },
    { value: "confusing_copy", labelKey: "feedback.option.confusing_copy", fallback: "Confusing copy" },
    { value: "slow_workflow", labelKey: "feedback.option.slow_workflow", fallback: "Slow workflow" },
    { value: "keyboard_accessibility_issue", labelKey: "feedback.option.keyboard_accessibility_issue", fallback: "Keyboard or accessibility issue" },
  ],
  other: [
    { value: "general_feedback", labelKey: "feedback.option.general_feedback", fallback: "General feedback" },
    { value: "question", labelKey: "feedback.option.question", fallback: "Question" },
    { value: "integration_request", labelKey: "feedback.option.integration_request", fallback: "Integration request" },
    { value: "data_privacy_concern", labelKey: "feedback.option.data_privacy_concern", fallback: "Data privacy concern" },
  ],
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
  const [mounted, setMounted] = useState(false);

  const commonOptions = useMemo(() => OPTION_BANK[type], [type]);

  useEffect(() => {
    setMounted(true);
  }, []);

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

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
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

      {mounted && open && createPortal(
        <div
          className="fixed inset-0 z-[12000] isolate flex items-center justify-center overflow-y-auto overscroll-contain px-3 py-5 sm:px-6"
          aria-live="polite"
        >
          <button
            type="button"
            className="absolute inset-0 cursor-default bg-zinc-950/75 backdrop-blur-md"
            onClick={() => setOpen(false)}
            aria-label={tOr("common.close", "Close")}
          />
          <div
            className="relative z-10 flex max-h-[min(92dvh,760px)] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white text-zinc-950 shadow-2xl shadow-black/35 ring-1 ring-black/5 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:ring-white/10"
            role="dialog"
            aria-modal="true"
            aria-labelledby="feedback-dialog-title"
          >
            <div className="flex shrink-0 items-center justify-between gap-4 border-b border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950">
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

            <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
              <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto bg-white p-4 dark:bg-zinc-950">
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
                      <option key={option.value} value={option.value}>{tOr(option.labelKey, option.fallback)}</option>
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
                        <option key={option.value} value={option.value}>{tOr(option.labelKey, option.fallback)}</option>
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
                        <option key={option.value} value={option.value}>{tOr(option.labelKey, option.fallback)}</option>
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
                        key={option.value}
                        className="flex min-h-11 items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-800 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900"
                      >
                        <input
                          type="checkbox"
                          checked={selectedOptions.includes(option.value)}
                          onChange={() => setSelectedOptions((items) => toggleItem(items, option.value))}
                          className="h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-500 dark:border-zinc-700"
                        />
                        <span>{tOr(option.labelKey, option.fallback)}</span>
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

              <div className="flex shrink-0 justify-end gap-2 border-t border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950">
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
        </div>,
        document.body,
      )}
    </>
  );
}
