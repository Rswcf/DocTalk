"use client";

import React from "react";
import { FileText, Globe2, ShieldCheck, Sparkles } from "lucide-react";
import { useLocale } from "../../i18n";

export default function HeroArtifact() {
  const { t, tOr } = useLocale();
  const prompts = [
    t("chat.suggestedQ1"),
    t("chat.suggestedQ2"),
    tOr("chat.suggestedExtractTables", "Extract all tables as CSV"),
  ];

  return (
    <div aria-hidden="true" className="w-full px-5 py-5 sm:px-7 sm:py-6">
      {/* Command text */}
      <p
        className="ed-body max-w-3xl text-[17px] leading-7 text-[var(--ed-ink)]"
        style={{ fontFamily: "var(--dt-body)" }}
      >
        {tOr(
          "workbench.heroArtifact.command",
          "Ask DocTalk to read a PDF, verify every claim, and show the exact source passage."
        )}
      </p>

      {/* Input affordance row */}
      <div className="mt-5 flex flex-wrap items-center gap-2">
        {/* PDF tag */}
        <span
          className="inline-flex items-center gap-1.5 rounded-[3px] border border-[var(--ed-rule)] bg-[var(--ed-paper)] px-2.5 py-1.5 text-[var(--ed-ink-2)]"
          style={{
            fontFamily: "var(--dt-mono)",
            fontSize: "11px",
            letterSpacing: "0.04em",
          }}
        >
          <FileText
            aria-hidden="true"
            size={12}
            className="text-[var(--ed-ink-3)]"
          />
          PDF
        </span>

        {/* URL tag */}
        <span
          className="inline-flex items-center gap-1.5 rounded-[3px] border border-[var(--ed-rule)] bg-[var(--ed-paper)] px-2.5 py-1.5 text-[var(--ed-ink-3)]"
          style={{
            fontFamily: "var(--dt-mono)",
            fontSize: "11px",
            letterSpacing: "0.04em",
          }}
        >
          <Globe2
            aria-hidden="true"
            size={12}
            className="text-[var(--ed-ink-3)]"
          />
          URL
        </span>

        {/* Flash mode tag — signal accent */}
        <span
          className="ml-auto inline-flex items-center gap-1.5 rounded-[3px] border border-[var(--ed-signal)] bg-[var(--ed-paper)] px-2.5 py-1.5 text-[var(--ed-signal)]"
          style={{
            fontFamily: "var(--dt-mono)",
            fontSize: "11px",
            letterSpacing: "0.04em",
          }}
        >
          <Sparkles
            aria-hidden="true"
            size={12}
            className="text-[var(--ed-signal)]"
          />
          {tOr("modes.quick", "Flash")}
        </span>

        {/* Shield icon */}
        <ShieldCheck
          aria-hidden="true"
          size={16}
          className="text-[var(--ed-ink-3)]"
        />
      </div>

      {/* Hairline rule */}
      <div
        className="mt-5 border-t border-[var(--ed-rule)]"
        role="separator"
      />

      {/* Suggested prompts */}
      <div className="mt-4 flex flex-wrap gap-2">
        {prompts.map((prompt) => (
          <span
            key={prompt}
            className="max-w-[22rem] truncate rounded-[3px] border border-[var(--ed-rule)] bg-[var(--ed-paper)] px-2.5 py-1.5 text-[var(--ed-ink-3)]"
            style={{
              fontFamily: "var(--dt-mono)",
              fontSize: "11px",
              letterSpacing: "0.04em",
            }}
          >
            {prompt}
          </span>
        ))}
      </div>

      {/* Disclaimer */}
      <p className="ed-caption mt-4">{t("chat.disclaimer")}</p>
    </div>
  );
}
