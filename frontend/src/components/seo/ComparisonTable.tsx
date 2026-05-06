"use client";

import React from 'react';
import { Check, X, Minus } from 'lucide-react';
import { useLocale } from '../../i18n';

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
  const { t } = useLocale();
  if (typeof value === 'boolean') {
    return value ? (
      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-950/40">
        <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" aria-label={t('common.yes')} />
      </span>
    ) : (
      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
        <X className="w-4 h-4 text-zinc-400 dark:text-zinc-500" aria-label={t('common.no')} />
      </span>
    );
  }
  if (value === 'Partial') {
    return (
      <span className="inline-flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-medium text-sm">
        <Minus className="w-4 h-4" />
        {t('comparison.partial')}
      </span>
    );
  }
  return <span className="text-sm">{value}</span>;
}

export default function ComparisonTable({ features, competitorName }: ComparisonTableProps) {
  const { t } = useLocale();
  return (
    <div className="relative overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      {/* Mobile scroll hint */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm min-w-[480px]">
          <thead>
            <tr>
              <th className="w-[40%] bg-zinc-50 px-5 py-4 text-left font-semibold text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
                {t('billing.comparison.feature')}
              </th>
              <th className="w-[30%] border-x border-accent/15 bg-accent-light px-5 py-4 text-center font-semibold text-zinc-900 dark:text-zinc-100">
                <span className="inline-flex items-center gap-1.5">
                  DocTalk
                </span>
              </th>
              <th className="w-[30%] bg-zinc-50 px-5 py-4 text-center font-semibold text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
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
                <td className="border-x border-accent/10 bg-accent-light/60 px-5 py-3.5 text-center text-zinc-700 dark:text-zinc-300">
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
