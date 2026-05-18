"use client";

import React from "react";
import { ArrowUp, FileText, Globe2, Plus, ShieldCheck, Sparkles } from "lucide-react";
import { useLocale } from "../../i18n";

export default function HeroArtifact() {
  const { t, tOr } = useLocale();
  const prompts = [
    t("chat.suggestedQ1"),
    t("chat.suggestedQ2"),
    tOr("chat.suggestedExtractTables", "Extract all tables as CSV"),
  ];

  return (
    <div aria-hidden="true" className="relative mx-auto w-full max-w-5xl">
      <div className="dt-command-bar relative overflow-hidden rounded-[2rem] px-5 pb-5 pt-4 text-left sm:px-7 sm:pb-6 sm:pt-5">
        <div className="relative min-h-[11rem] sm:min-h-[14rem]">
          <p className="max-w-3xl text-xl font-medium leading-8 text-white/78 sm:text-2xl">
            {tOr("workbench.heroArtifact.command", "Ask DocTalk to read a PDF, verify every claim, and show the exact source passage.")}
          </p>
        </div>

        <div className="relative flex flex-wrap items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-full text-white/72">
            <Plus aria-hidden="true" size={22} />
          </span>
          <span className="inline-flex items-center gap-2 rounded-full bg-white/12 px-4 py-2 text-sm font-semibold text-white shadow-inner shadow-white/5">
            <FileText aria-hidden="true" size={16} />
            PDF
          </span>
          <span className="inline-flex items-center gap-2 rounded-full bg-white/7 px-4 py-2 text-sm font-medium text-white/72">
            <Globe2 aria-hidden="true" size={16} />
            URL
          </span>
          <span className="ml-auto inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-white">
            <Sparkles aria-hidden="true" size={16} />
            {tOr("modes.quick", "Flash")}
          </span>
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-full text-white/65">
            <ShieldCheck aria-hidden="true" size={18} />
          </span>
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-full text-white/45">
            <ArrowUp aria-hidden="true" size={18} />
          </span>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {prompts.map((prompt) => (
          <span
            key={prompt}
            className="max-w-[18rem] truncate rounded-full border border-white/14 bg-white/8 px-4 py-2 text-sm font-medium text-white/72 backdrop-blur-xl"
          >
            {prompt}
          </span>
        ))}
      </div>

      <p className="mt-4 text-center text-xs text-white/42">{t("chat.disclaimer")}</p>
    </div>
  );
}
