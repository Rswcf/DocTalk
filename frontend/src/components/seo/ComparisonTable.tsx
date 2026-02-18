"use client";

import React from 'react';
import { Check, X, Minus } from 'lucide-react';

interface Feature {
  name: string;
  doctalk: string | boolean;
  competitor: string | boolean;
}

interface ComparisonTableProps {
  features: Feature[];
  competitorName: string;
}

function CellValue({ value }: { value: string | boolean }) {
  if (typeof value === 'boolean') {
    return value ? (
      <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-emerald-50 dark:bg-emerald-950/40">
        <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" aria-label="Yes" />
      </span>
    ) : (
      <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-zinc-100 dark:bg-zinc-800">
        <X className="w-4 h-4 text-zinc-400 dark:text-zinc-500" aria-label="No" />
      </span>
    );
  }
  if (value === 'Partial') {
    return (
      <span className="inline-flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-medium text-sm">
        <Minus className="w-4 h-4" />
        Partial
      </span>
    );
  }
  return <span className="text-sm">{value}</span>;
}

export default function ComparisonTable({ features, competitorName }: ComparisonTableProps) {
  return (
    <div className="relative rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
      {/* Mobile scroll hint */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm min-w-[480px]">
          <thead>
            <tr>
              <th className="text-left py-4 px-5 font-semibold text-zinc-900 dark:text-zinc-100 bg-zinc-50 dark:bg-zinc-900/80 w-[40%]">
                Feature
              </th>
              <th className="text-center py-4 px-5 font-semibold text-zinc-900 dark:text-zinc-100 bg-indigo-50/60 dark:bg-indigo-950/20 w-[30%]">
                <span className="inline-flex items-center gap-1.5">
                  DocTalk
                </span>
              </th>
              <th className="text-center py-4 px-5 font-semibold text-zinc-900 dark:text-zinc-100 bg-zinc-50 dark:bg-zinc-900/80 w-[30%]">
                {competitorName}
              </th>
            </tr>
          </thead>
          <tbody>
            {features.map((feature, i) => (
              <tr
                key={i}
                className={`border-t border-zinc-100 dark:border-zinc-800/60 ${
                  i % 2 === 0
                    ? 'bg-white dark:bg-zinc-950'
                    : 'bg-zinc-50/50 dark:bg-zinc-900/30'
                }`}
              >
                <td className="py-3.5 px-5 text-zinc-700 dark:text-zinc-300 font-medium">
                  {feature.name}
                </td>
                <td className="py-3.5 px-5 text-center text-zinc-700 dark:text-zinc-300 bg-indigo-50/30 dark:bg-indigo-950/10">
                  <CellValue value={feature.doctalk} />
                </td>
                <td className="py-3.5 px-5 text-center text-zinc-700 dark:text-zinc-300">
                  <CellValue value={feature.competitor} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
