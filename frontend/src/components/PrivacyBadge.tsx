"use client";

import { useState } from 'react';
import { Shield, ChevronDown, ChevronUp } from 'lucide-react';
import { useLocale } from '../i18n';
import Link from 'next/link';

export function PrivacyBadge() {
  const [expanded, setExpanded] = useState(false);
  const { t } = useLocale();

  return (
    <div className="w-full max-w-xl mb-6">
      {/* Badge Line */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-center gap-2 text-sm text-gray-600 dark:text-gray-400
                   hover:text-gray-800 dark:hover:text-gray-200 transition w-full"
      >
        <Shield size={16} className="text-green-600" />
        <span>{t('privacy.badge')}</span>
        {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {/* Expanded Details */}
      {expanded && (
        <div className="mt-3 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg text-sm space-y-2">
          <p className="flex items-center gap-2">
            <span className="text-green-600">✓</span>
            <span className="text-gray-700 dark:text-gray-300">{t('privacy.noTraining')}</span>
          </p>
          <p className="flex items-center gap-2">
            <span className="text-green-600">✓</span>
            <span className="text-gray-700 dark:text-gray-300">{t('privacy.encrypted')}</span>
          </p>
          <p className="flex items-center gap-2">
            <span className="text-green-600">✓</span>
            <span className="text-gray-700 dark:text-gray-300">{t('privacy.deleteAnytime')}</span>
          </p>
          <div className="pt-2 border-t dark:border-gray-700 flex gap-4 text-xs">
            <Link href="/privacy" className="text-blue-600 hover:underline">{t('privacy.policyLink')}</Link>
            <Link href="/terms" className="text-blue-600 hover:underline">{t('privacy.termsLink')}</Link>
          </div>
        </div>
      )}
    </div>
  );
}

