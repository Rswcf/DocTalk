"use client";

import React, { Component, type ErrorInfo, type ReactNode } from 'react';

interface MessageErrorBoundaryProps {
  children: ReactNode;
  messageId: string;
}

interface MessageErrorBoundaryState {
  hasError: boolean;
}

export default class MessageErrorBoundary extends Component<MessageErrorBoundaryProps, MessageErrorBoundaryState> {
  constructor(props: MessageErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): MessageErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(`Error rendering message ${this.props.messageId}:`, error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm">
          Failed to render message
        </div>
      );
    }

    return this.props.children;
  }
}
