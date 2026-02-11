"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html>
      <body className="min-h-screen flex items-center justify-center bg-white dark:bg-zinc-950 font-sans">
        <div className="text-center px-6">
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-4">Something went wrong</h2>
          <p className="text-zinc-500 dark:text-zinc-400 mb-6">An unexpected error occurred. Please try again.</p>
          <button
            onClick={() => reset()}
            className="px-6 py-3 bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 rounded-lg hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors font-medium"
          >
            Try Again
          </button>
        </div>
      </body>
    </html>
  );
}
