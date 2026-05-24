"use client";

import type { ElementType } from "react";
import { Minus, TrendingDown, TrendingUp } from "lucide-react";
import { formatNumber } from "../../lib/formatNumber";

interface KPICardProps {
  icon: ElementType;
  label: string;
  value: number | string;
  deltaPercent?: number | null;
  sparkline?: number[];
  suffix?: string;
}

function sparklinePath(values: number[]): string {
  if (values.length < 2) return "";
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;
  return values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * 92 + 4;
      const y = 34 - ((value - min) / range) * 26;
      return `${index === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
}

export default function KPICard({
  icon: Icon,
  label,
  value,
  deltaPercent,
  sparkline = [],
  suffix,
}: KPICardProps) {
  const positive = typeof deltaPercent === "number" && deltaPercent > 0;
  const negative = typeof deltaPercent === "number" && deltaPercent < 0;
  const DeltaIcon = positive ? TrendingUp : negative ? TrendingDown : Minus;
  const path = sparklinePath(sparkline);
  const renderedValue = typeof value === "number" ? formatNumber(value) : value;

  return (
    <div className="dt-kpi-card min-h-[132px] rounded-lg p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="rounded-md border border-zinc-200 bg-zinc-50 p-2 dark:border-zinc-800 dark:bg-zinc-900">
          <Icon aria-hidden="true" className="h-4 w-4 text-[#1D4ED8]" />
        </div>
        <div
          className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium tabular-nums ${
            positive
              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300"
              : negative
                ? "bg-red-50 text-red-700 dark:bg-red-400/10 dark:text-red-300"
                : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
          }`}
        >
          <DeltaIcon aria-hidden="true" className="h-3 w-3" />
          {typeof deltaPercent === "number" ? `${Math.abs(deltaPercent).toFixed(1)}%` : "0.0%"}
        </div>
      </div>
      <div className="mt-4">
        <p className="text-2xl font-semibold tabular-nums text-zinc-950 dark:text-zinc-50">
          {renderedValue}
          {suffix ? <span className="ml-1 text-base text-zinc-500 dark:text-zinc-400">{suffix}</span> : null}
        </p>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{label}</p>
      </div>
      <svg className="mt-3 h-9 w-full text-[#1D4ED8]" viewBox="0 0 100 40" aria-hidden="true">
        <path d="M4 35 H96" stroke="currentColor" strokeOpacity="0.12" strokeWidth="1" />
        {path ? (
          <path d={path} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        ) : null}
      </svg>
    </div>
  );
}
