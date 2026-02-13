"use client";

import React from 'react';
import { Check, X } from 'lucide-react';
import { useLocale } from '../i18n';
import { PLAN_HIERARCHY, type PlanType } from '../lib/models';

interface RowDef {
  labelKey: string;
  free: string | boolean;
  plus: string | boolean;
  pro: string | boolean;
}

const ROWS: RowDef[] = [
  { labelKey: 'billing.comparison.monthlyCredits', free: '500', plus: '3,000', pro: '9,000' },
  { labelKey: 'billing.comparison.uploads', free: '25 MB', plus: '50 MB', pro: '100 MB' },
  { labelKey: 'billing.comparison.documents', free: '3', plus: '20', pro: 'billing.comparison.documentsUnlimited' },
  { labelKey: 'billing.comparison.models', free: 'billing.comparison.modelsFree', plus: 'billing.comparison.modelsAll', pro: 'billing.comparison.modelsAll' },
  { labelKey: 'billing.comparison.sessions', free: 'billing.comparison.sessionsFree', plus: 'billing.comparison.sessionsUnlimited', pro: 'billing.comparison.sessionsUnlimited' },
  { labelKey: 'billing.comparison.ocr', free: true, plus: true, pro: true },
  { labelKey: 'billing.comparison.export', free: false, plus: true, pro: true },
  { labelKey: 'billing.comparison.customPrompts', free: false, plus: false, pro: true },
  { labelKey: 'billing.comparison.citations', free: true, plus: true, pro: true },
];

interface PricingTableProps {
  currentPlan?: PlanType;
  onUpgrade?: (plan: PlanType) => void;
  selectedPlan?: 'plus' | 'pro';
  onSelectPlan?: (plan: 'plus' | 'pro') => void;
}

export default function PricingTable({ currentPlan = 'free', onUpgrade, selectedPlan = 'plus', onSelectPlan }: PricingTableProps) {
  const { t } = useLocale();

  const renderCell = (value: string | boolean) => {
    if (typeof value === 'boolean') {
      return value ? (
        <span className="inline-flex items-center justify-center">
          <Check aria-label="Included" size={18} className="text-green-600 dark:text-green-400 mx-auto" />
          <span className="sr-only">Included</span>
        </span>
      ) : (
        <span className="inline-flex items-center justify-center">
          <X aria-label="Not included" size={18} className="text-zinc-300 dark:text-zinc-600 mx-auto" />
          <span className="sr-only">Not included</span>
        </span>
      );
    }
    // If value starts with "billing.", treat as i18n key
    const text = value.startsWith('billing.') ? t(value as any) : value;
    return <span className="text-sm text-zinc-700 dark:text-zinc-300 tabular-nums">{text}</span>;
  };

  const renderCta = (plan: PlanType) => {
    if (currentPlan === plan) {
      return (
        <button
          disabled
          className="w-full mt-4 px-4 py-2 rounded-lg text-sm font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 cursor-not-allowed"
        >
          {t('billing.currentPlan')}
        </button>
      );
    }
    if (plan === 'free') return null;
    const isDowngrade = PLAN_HIERARCHY[plan] < PLAN_HIERARCHY[currentPlan];
    return (
      <button
        onClick={() => onUpgrade?.(plan)}
        className="w-full mt-4 px-4 py-2 rounded-lg text-sm font-medium bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors shadow-sm focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900"
      >
        {isDowngrade ? t('billing.downgrade') : t('billing.upgrade')} {plan === 'plus' ? 'Plus' : 'Pro'}
      </button>
    );
  };

  return (
    <div className="w-full">
      {/* Mobile: stacked cards */}
      <div className="block lg:hidden space-y-4">
        {(['free', 'plus', 'pro'] as PlanType[]).map((plan) => {
          const isSelected = plan === selectedPlan;
          return (
            <div
              key={plan}
              onClick={() => (plan === 'plus' || plan === 'pro') ? onSelectPlan?.(plan) : undefined}
              className={`rounded-xl border p-5 ${
                isSelected
                  ? 'border-2 border-indigo-500 dark:border-indigo-400 cursor-pointer'
                  : plan === 'free' ? 'border-zinc-200 dark:border-zinc-800' : 'border-zinc-200 dark:border-zinc-800 cursor-pointer'
              }`}
            >
              <div className="flex items-center gap-2 mb-4">
                <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                  {t(`billing.comparison.${plan}` as any)}
                </h3>
                {plan === 'plus' && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-600 dark:bg-indigo-500 text-white font-medium">
                    {t('billing.mostPopular')}
                  </span>
                )}
              </div>
              <div className="space-y-3">
                {ROWS.map((row, idx) => (
                  <div key={idx} className="flex items-center justify-between text-sm">
                    <span className="text-zinc-500 dark:text-zinc-400">{t(row.labelKey as any)}</span>
                    <span>{renderCell(row[plan])}</span>
                  </div>
                ))}
              </div>
              {renderCta(plan)}
            </div>
          );
        })}
      </div>

      {/* Desktop: table */}
      <div className="hidden lg:block rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
        <table className="w-full text-sm" aria-label="Plan comparison">
          <thead>
            <tr className="border-b border-zinc-200 dark:border-zinc-800">
              <th className="text-left py-4 px-6 font-medium text-zinc-500 dark:text-zinc-400 w-[34%]">
                {t('billing.comparison.feature')}
              </th>
              <th className="text-center py-4 px-3 font-medium text-zinc-500 dark:text-zinc-400 w-[22%]">
                {t('billing.comparison.free')}
              </th>
              <th
                onClick={() => onSelectPlan?.('plus')}
                className={`text-center py-4 px-3 w-[22%] cursor-pointer ${
                  selectedPlan === 'plus'
                    ? 'border-x-2 border-t-2 border-indigo-500 dark:border-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/20'
                    : 'border-x border-t border-zinc-200 dark:border-zinc-800'
                }`}
              >
                <div className="flex flex-col items-center gap-1">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-600 dark:bg-indigo-500 text-white font-medium">
                    {t('billing.mostPopular')}
                  </span>
                  <span className="font-semibold text-zinc-900 dark:text-zinc-50">
                    {t('billing.comparison.plus')}
                  </span>
                </div>
              </th>
              <th
                onClick={() => onSelectPlan?.('pro')}
                className={`text-center py-4 px-3 w-[22%] cursor-pointer ${
                  selectedPlan === 'pro'
                    ? 'border-x-2 border-t-2 border-indigo-500 dark:border-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/20'
                    : 'font-semibold text-zinc-900 dark:text-zinc-50'
                }`}
              >
                {t('billing.comparison.pro')}
              </th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row, idx) => (
              <tr key={idx} className="border-b border-zinc-100 dark:border-zinc-800/50 last:border-b-0">
                <td className="py-3.5 px-6 text-zinc-700 dark:text-zinc-300">
                  {t(row.labelKey as any)}
                </td>
                <td className="py-3.5 px-3 text-center">
                  {renderCell(row.free)}
                </td>
                <td
                  onClick={() => onSelectPlan?.('plus')}
                  className={`py-3.5 px-3 text-center cursor-pointer ${
                    selectedPlan === 'plus'
                      ? 'border-x-2 border-indigo-500 dark:border-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/20'
                      : 'border-x border-zinc-200 dark:border-zinc-800'
                  }`}
                >
                  {renderCell(row.plus)}
                </td>
                <td
                  onClick={() => onSelectPlan?.('pro')}
                  className={`py-3.5 px-3 text-center cursor-pointer ${
                    selectedPlan === 'pro'
                      ? 'border-x-2 border-indigo-500 dark:border-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/20'
                      : ''
                  }`}
                >
                  {renderCell(row.pro)}
                </td>
              </tr>
            ))}
            {/* CTA row */}
            <tr>
              <td className="py-4 px-6" />
              <td className="py-4 px-3 text-center">
                {renderCta('free')}
              </td>
              <td
                onClick={() => onSelectPlan?.('plus')}
                className={`py-4 px-3 text-center cursor-pointer ${
                  selectedPlan === 'plus'
                    ? 'border-x-2 border-b-2 border-indigo-500 dark:border-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/20 rounded-b-xl'
                    : 'border-x border-zinc-200 dark:border-zinc-800'
                }`}
              >
                {renderCta('plus')}
              </td>
              <td
                onClick={() => onSelectPlan?.('pro')}
                className={`py-4 px-3 text-center cursor-pointer ${
                  selectedPlan === 'pro'
                    ? 'border-x-2 border-b-2 border-indigo-500 dark:border-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/20 rounded-b-xl'
                    : ''
                }`}
              >
                {renderCta('pro')}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
