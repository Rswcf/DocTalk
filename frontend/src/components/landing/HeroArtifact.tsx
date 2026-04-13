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
      className="relative w-full max-w-md mx-auto lg:mx-0"
    >
      {/* Soft accent glow behind the artifact */}
      <div className="glow-accent absolute -inset-6 blur-2xl opacity-50 pointer-events-none" />

      {/* PDF page mock — slightly tilted, sits behind the chat */}
      <div className="relative rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-xl px-4 py-5 transform rotate-[-2deg] lg:rotate-[-1.5deg]">
        {/* Page header (filename + page n) */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            alphabet-q4-2023.pdf
          </span>
          <span className="text-[10px] font-mono text-zinc-500 dark:text-zinc-400">
            p. 4
          </span>
        </div>

        {/* Body text lines */}
        <div className="space-y-1.5">
          <div className="h-1.5 w-11/12 rounded-full bg-zinc-200 dark:bg-zinc-700" />
          <div className="h-1.5 w-10/12 rounded-full bg-zinc-200 dark:bg-zinc-700" />
          <div className="h-1.5 w-full rounded-full bg-zinc-200 dark:bg-zinc-700" />
          {/* Highlighted sentence — yellow band the chat will cite */}
          <div className="relative mt-2 mb-2 inline-block w-full">
            <span className="absolute inset-0 rounded-sm bg-amber-200/70 dark:bg-amber-400/35" />
            <div className="relative px-1 py-0.5">
              <div className="h-1.5 w-11/12 rounded-full bg-zinc-700 dark:bg-zinc-300" />
              <div className="h-1.5 w-9/12 rounded-full bg-zinc-700 dark:bg-zinc-300 mt-1.5" />
            </div>
          </div>
          <div className="h-1.5 w-10/12 rounded-full bg-zinc-200 dark:bg-zinc-700" />
          <div className="h-1.5 w-8/12 rounded-full bg-zinc-200 dark:bg-zinc-700" />
        </div>
      </div>

      {/* Chat reply card — overlapping bottom-right of the page */}
      <div className="relative -mt-8 ml-12 sm:ml-20 max-w-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-2xl p-4 transform rotate-[1.5deg] lg:rotate-[1deg]">
        {/* Avatar + label */}
        <div className="flex items-center gap-2 mb-2">
          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-accent-foreground">
            D
          </span>
          <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            doctalk
          </span>
        </div>

        {/* Reply text — real-looking, ends with citation pill */}
        <p className="text-[13px] leading-snug text-zinc-700 dark:text-zinc-200">
          Q4 net revenue grew{" "}
          <span className="text-zinc-900 dark:text-zinc-50 font-semibold">
            13% YoY
          </span>
          , driven by Search and YouTube ad gains
          {/* citation pill */}
          <span className="ml-1 inline-flex items-center gap-1 align-baseline">
            <span className="inline-flex items-center justify-center h-4 px-1.5 rounded bg-accent text-[10px] font-bold leading-none text-accent-foreground">
              1
            </span>
          </span>
        </p>
      </div>

      {/* Removed the absolute-positioned SVG connector — at narrow widths
          the fixed coords drifted off the highlight↔pill anchors. The
          visual story (highlight on page → matching colored pill in
          chat) is conveyed by color + overlap; the dashed arc was
          redundant and fragile. Codex P1 review flagged this. */}
    </div>
  );
}
