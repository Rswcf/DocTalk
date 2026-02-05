"use client";

import Link from 'next/link';
import { FileText, BookOpen, FileSignature } from 'lucide-react';
import { useLocale } from '../../i18n';

const SAMPLES = [
  {
    id: '10k',
    icon: FileText,
    titleKey: 'demo.sample.10k.title',
    descKey: 'demo.sample.10k.desc',
    questionKey: 'demo.sample.10k.question',
  },
  {
    id: 'paper',
    icon: BookOpen,
    titleKey: 'demo.sample.paper.title',
    descKey: 'demo.sample.paper.desc',
    questionKey: 'demo.sample.paper.question',
  },
  {
    id: 'contract',
    icon: FileSignature,
    titleKey: 'demo.sample.contract.title',
    descKey: 'demo.sample.contract.desc',
    questionKey: 'demo.sample.contract.question',
  },
];

export default function DemoPage() {
  const { t } = useLocale();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gray-50 dark:bg-gray-900">
      <h1 className="text-2xl font-bold mb-2 dark:text-white">{t('demo.title')}</h1>
      <p className="text-gray-600 dark:text-gray-400 mb-8 text-center max-w-md">
        {t('demo.subtitle')}
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-4xl w-full">
        {SAMPLES.map((sample) => {
          const Icon = sample.icon;
          return (
            <Link
              key={sample.id}
              href={`/demo/${sample.id}`}
              className="flex flex-col p-6 bg-white dark:bg-gray-800 rounded-xl border 
                         border-gray-200 dark:border-gray-700 hover:border-blue-500 
                         dark:hover:border-blue-400 hover:shadow-lg transition group"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                  <Icon size={24} className="text-blue-600 dark:text-blue-400" />
                </div>
                <h2 className="font-semibold dark:text-white group-hover:text-blue-600 
                               dark:group-hover:text-blue-400 transition">
                  {t(sample.titleKey)}
                </h2>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                {t(sample.descKey)}
              </p>
              <div className="mt-auto pt-3 border-t dark:border-gray-700">
                <p className="text-xs text-gray-400 dark:text-gray-500 italic">
                  &ldquo;{t(sample.questionKey)}&rdquo;
                </p>
              </div>
            </Link>
          );
        })}
      </div>

      <p className="mt-8 text-sm text-gray-500 dark:text-gray-400">
        💡 {t('demo.hint')}
      </p>

      <Link href="/" className="mt-4 text-blue-600 hover:underline text-sm">
        ← {t('demo.backToHome')}
      </Link>
    </div>
  );
}

