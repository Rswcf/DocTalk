"use client";

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { getDemoDocuments } from '../../../lib/api';

/** Legacy demo route — redirects to /d/{documentId} for the matching demo slug. */
const SLUG_MAP: Record<string, string> = {
  '10k': 'nvidia-10k',
  'paper': 'attention-paper',
  'contract': 'nda-contract',
};

export default function DemoRedirectPage() {
  const { sample } = useParams<{ sample: string }>();
  const router = useRouter();
  const [error, setError] = useState(false);

  useEffect(() => {
    const targetSlug = SLUG_MAP[sample] || sample;
    getDemoDocuments()
      .then((docs) => {
        const match = docs.find((d) => d.slug === targetSlug);
        if (match) {
          router.replace(`/d/${match.document_id}`);
        } else {
          setError(true);
        }
      })
      .catch(() => setError(true));
  }, [sample, router]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 dark:text-gray-400 mb-4">Demo document not found</p>
          <button
            onClick={() => router.push('/demo')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            View all demos
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="animate-spin text-gray-400" size={32} />
    </div>
  );
}
