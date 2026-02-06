"use client";

import React from 'react';

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
      return (
        <div className="min-h-screen w-full flex items-center justify-center dark:bg-zinc-900">
          <div className="text-center">
            <div className="text-lg font-medium mb-3 dark:text-zinc-100">出了点问题</div>
            <button
              className="px-4 py-2 bg-zinc-900 text-white rounded dark:bg-zinc-100 dark:text-zinc-900"
              onClick={this.handleRefresh}
            >
              刷新页面
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
