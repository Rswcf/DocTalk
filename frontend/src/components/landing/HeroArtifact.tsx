"use client";

import React from "react";

/**
 * Hero artifact — a hand-composed mock that shows DocTalk's product truth
 * in a single static visual: a PDF page on the left with a highlighted
 * sentence, a chat reply on the right whose citation pill points back to
 * the highlight via an SVG arrow.
 *
 * Replaces the previous video-in-macOS-chrome treatment in the hero.
 * Codex r1 (.collab/dialogue/2026-04-13-design-overhaul-codex-r1.md) noted
 * the video should be demoted, not deleted — kept as a section below.
 *
 * All visuals here are decorative, hence aria-hidden on the root.
 */
export default function HeroArtifact() {
  return (
    <div
      aria-hidden="true"
      className="relative mx-auto w-full max-w-lg lg:mx-0"
    >
      <div className="glow-accent pointer-events-none absolute -inset-8 blur-2xl opacity-60" />

      <div className="relative overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex items-center justify-between border-b border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
          </div>
          <div className="rounded-md border border-zinc-200 bg-white px-2.5 py-1 font-mono text-[10px] text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
            verified-reading-desk
          </div>
          <div className="w-12" />
        </div>

        <div className="grid min-h-[360px] grid-cols-1 sm:grid-cols-[0.95fr_1.05fr]">
          <div className="relative border-b border-zinc-200 bg-[#f4f1ea] p-4 dark:border-zinc-800 dark:bg-[#181713] sm:border-b-0 sm:border-r">
            <div className="mb-3 flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                The AI layoff trap.pdf
              </span>
              <span className="rounded bg-white px-1.5 py-0.5 font-mono text-[10px] text-zinc-500 shadow-sm dark:bg-zinc-900 dark:text-zinc-400">
                p. 34
              </span>
            </div>

            <div className="mx-auto min-h-[250px] max-w-[190px] rounded-sm border border-zinc-200 bg-white px-4 py-5 shadow-md dark:border-zinc-700 dark:bg-zinc-900">
              <div className="mb-4 h-2 w-2/3 rounded-full bg-zinc-300 dark:bg-zinc-600" />
              <div className="space-y-2">
                <div className="h-1.5 w-full rounded-full bg-zinc-200 dark:bg-zinc-700" />
                <div className="h-1.5 w-11/12 rounded-full bg-zinc-200 dark:bg-zinc-700" />
                <div className="h-1.5 w-10/12 rounded-full bg-zinc-200 dark:bg-zinc-700" />
                <div className="relative my-3 rounded-sm bg-amber-200/75 px-1 py-1 dark:bg-amber-400/30">
                  <div className="h-1.5 w-full rounded-full bg-zinc-800 dark:bg-zinc-200" />
                  <div className="mt-1.5 h-1.5 w-4/5 rounded-full bg-zinc-800 dark:bg-zinc-200" />
                </div>
                <div className="h-1.5 w-full rounded-full bg-zinc-200 dark:bg-zinc-700" />
                <div className="h-1.5 w-9/12 rounded-full bg-zinc-200 dark:bg-zinc-700" />
                <div className="h-1.5 w-10/12 rounded-full bg-zinc-200 dark:bg-zinc-700" />
              </div>
            </div>

            <div className="absolute bottom-4 right-4 rounded-md border border-amber-200 bg-white px-2 py-1 font-mono text-[10px] font-semibold text-amber-700 shadow-sm dark:border-amber-400/30 dark:bg-zinc-900 dark:text-amber-300">
              source highlight
            </div>
          </div>

          <div className="flex flex-col bg-white p-4 dark:bg-zinc-950">
            <div className="mb-3 flex justify-end">
              <div className="max-w-[210px] rounded-lg rounded-br-sm bg-zinc-900 px-3 py-2 text-[12px] leading-5 text-white dark:bg-zinc-100 dark:text-zinc-950">
                What is the core risk for workers?
              </div>
            </div>

            <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-[12px] leading-5 text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200">
              <div className="mb-2 flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-accent-foreground">
                  D
                </span>
                <span className="font-mono text-[10px] uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  answer with evidence
                </span>
              </div>
              Competitive automation can reduce worker income faster than
              demand recovers, creating an over-automation wedge
              <span className="ml-1 inline-flex h-4 min-w-4 items-center justify-center rounded bg-accent px-1.5 align-baseline text-[10px] font-bold leading-none text-accent-foreground">
                1
              </span>
              .
            </div>

            <div className="mt-3 space-y-2">
              {[
                ['1', 'Document', 'p. 34'],
                ['2', 'Document', 'p. 36'],
              ].map(([num, source, page]) => (
                <div
                  key={num}
                  className="flex items-center gap-2 rounded-md border border-zinc-200 bg-white px-2.5 py-2 shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
                >
                  <span className="flex h-5 w-5 items-center justify-center rounded bg-accent text-[10px] font-bold text-accent-foreground">
                    {num}
                  </span>
                  <span className="text-xs font-medium text-zinc-700 dark:text-zinc-200">
                    {source}
                  </span>
                  <span className="ml-auto font-mono text-[10px] text-zinc-500 dark:text-zinc-400">
                    {page}
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-auto grid grid-cols-3 gap-2 pt-4">
              {['Flash', 'Pro', 'OCR'].map((label) => (
                <div
                  key={label}
                  className="rounded-md border border-zinc-200 bg-zinc-50 py-1.5 text-center font-mono text-[10px] text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400"
                >
                  {label}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
