"use client";

import React from 'react';
import { Check, X } from 'lucide-react';
import { useLocale } from '../i18n';

interface RowDef {
  labelKey: string;
  free: string | boolean;
  pro: string | boolean;
}

const ROWS: RowDef[] = [
  { labelKey: 'billing.comparison.monthlyCredits', free: '10,000', pro: '100,000' },
  { labelKey: 'billing.comparison.uploads', free: '50 MB / file', pro: '50 MB / file' },
  { labelKey: 'billing.comparison.models', free: '9 AI models', pro: '9 AI models' },
  { labelKey: 'billing.comparison.citations', free: true, pro: true },
  { labelKey: 'billing.comparison.ocr', free: true, pro: true },
  { labelKey: 'billing.comparison.priority', free: false, pro: true },
];

export default function PricingTable() {
  const { t } = useLocale();

  const renderCell = (value: string | boolean) => {
    if (typeof value === 'boolean') {
      return value ? (
        <Check size={18} className="text-green-600 dark:text-green-400 mx-auto" />
      ) : (
        <X size={18} className="text-zinc-300 dark:text-zinc-600 mx-auto" />
      );
    }
    return <span className="text-sm text-zinc-700 dark:text-zinc-300">{value}</span>;
  };

  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-200 dark:border-zinc-800">
            <th className="text-left py-4 px-4 sm:px-6 font-medium text-zinc-500 dark:text-zinc-400 w-1/2">
              {t('billing.comparison.feature')}
            </th>
            <th className="text-center py-4 px-3 font-medium text-zinc-500 dark:text-zinc-400 w-1/4">
              {t('billing.comparison.free')}
            </th>
            <th className="text-center py-4 px-3 font-semibold text-zinc-900 dark:text-zinc-50 w-1/4 bg-zinc-50 dark:bg-zinc-900">
              {t('billing.comparison.pro')}
            </th>
          </tr>
        </thead>
        <tbody>
          {ROWS.map((row, idx) => (
            <tr key={idx} className="border-b border-zinc-100 dark:border-zinc-800/50 last:border-b-0">
              <td className="py-3.5 px-4 sm:px-6 text-zinc-700 dark:text-zinc-300">
                {t(row.labelKey)}
              </td>
              <td className="py-3.5 px-3 text-center">
                {renderCell(row.free)}
              </td>
              <td className="py-3.5 px-3 text-center bg-zinc-50/50 dark:bg-zinc-900/50">
                {renderCell(row.pro)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
