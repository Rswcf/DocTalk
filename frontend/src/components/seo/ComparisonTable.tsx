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
      <Check className="inline-block w-5 h-5 text-emerald-600" aria-label="Yes" />
    ) : (
      <X className="inline-block w-5 h-5 text-red-500" aria-label="No" />
    );
  }
  if (value === 'Partial') {
    return (
      <span className="inline-flex items-center gap-1 text-amber-500">
        <Minus className="w-4 h-4" />
        <span>Partial</span>
      </span>
    );
  }
  return <span>{value}</span>;
}

export default function ComparisonTable({ features, competitorName }: ComparisonTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm sm:text-base">
        <thead>
          <tr className="border-b-2 border-zinc-200 dark:border-zinc-700">
            <th className="text-left py-3 pr-4 font-semibold text-zinc-900 dark:text-zinc-100">Feature</th>
            <th className="text-center py-3 px-4 font-semibold text-zinc-900 dark:text-zinc-100">DocTalk</th>
            <th className="text-center py-3 pl-4 font-semibold text-zinc-900 dark:text-zinc-100">{competitorName}</th>
          </tr>
        </thead>
        <tbody>
          {features.map((feature, i) => (
            <tr
              key={i}
              className="border-b border-zinc-200 dark:border-zinc-800"
            >
              <td className="py-3 pr-4 text-zinc-700 dark:text-zinc-300">{feature.name}</td>
              <td className="py-3 px-4 text-center text-zinc-700 dark:text-zinc-300">
                <CellValue value={feature.doctalk} />
              </td>
              <td className="py-3 pl-4 text-center text-zinc-700 dark:text-zinc-300">
                <CellValue value={feature.competitor} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
