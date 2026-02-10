"use client";

import React from 'react';
import { useLocale } from '../i18n';

function ErrorFallback({ onRefresh }: { onRefresh: () => void }) {
  const { t } = useLocale();
  return (
    <div className="min-h-screen w-full flex items-center justify-center dark:bg-zinc-900">
      <div className="text-center">
        <div className="text-lg font-medium mb-3 dark:text-zinc-100">{t('error.somethingWrong')}</div>
        <button
          className="px-4 py-2 bg-zinc-900 text-white rounded dark:bg-zinc-100 dark:text-zinc-900 focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900"
          onClick={onRefresh}
        >
          {t('error.refresh')}
        </button>
      </div>
    </div>
  );
}

type ErrorBoundaryState = { hasError: boolean };

export default class ErrorBoundary extends React.Component<React.PropsWithChildren, ErrorBoundaryState> {
  constructor(props: React.PropsWithChildren) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: any, errorInfo: any) {
    // Optionally log error
  }

  handleRefresh = () => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      return <ErrorFallback onRefresh={this.handleRefresh} />;
    }
    return this.props.children;
  }
}
