/**
 * Error Boundary Component
 *
 * Catches rendering errors in child components and displays a fallback UI
 * instead of crashing the entire application. Critical for a trading terminal
 * where users need to see and manage positions even if one section breaks.
 */

'use client';

import React from 'react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  /** Optional fallback UI. Receives the error and a reset function. */
  fallback?: React.ComponentType<{ error: Error; reset: () => void }>;
  /** Optional callback when an error is caught (for logging/monitoring) */
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('[ErrorBoundary] Caught error:', error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  reset = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): React.ReactNode {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        const FallbackComponent = this.props.fallback;
        return <FallbackComponent error={this.state.error} reset={this.reset} />;
      }

      return <DefaultErrorFallback error={this.state.error} reset={this.reset} />;
    }

    return this.props.children;
  }
}

/**
 * Default error fallback UI
 */
function DefaultErrorFallback({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center p-6 rounded-sm border border-red-500/20 bg-red-500/5 m-4">
      <h3 className="text-red-400 font-semibold text-sm mb-2">Something went wrong</h3>
      <p className="text-muted-foreground text-xs text-center mb-4 max-w-md">
        {error.message || 'An unexpected error occurred.'}
      </p>
      <button
        onClick={reset}
        className="px-4 py-2 text-xs font-medium rounded-sm bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
      >
        Try again
      </button>
    </div>
  );
}

/**
 * Convenience wrapper for sections — shows a compact error instead of crashing
 */
export function SectionErrorBoundary({ children, name }: { children: React.ReactNode; name?: string }) {
  return (
    <ErrorBoundary
      fallback={({ error, reset }) => (
        <div className="flex items-center justify-between p-3 rounded border border-red-500/20 bg-red-500/5 text-xs">
          <span className="text-red-400">
            {name ? `${name} failed to load` : 'Section failed to load'}:{' '}
            <span className="text-muted-foreground">{error.message}</span>
          </span>
          <button
            onClick={reset}
            className="ml-2 px-2 py-1 rounded bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
          >
            Retry
          </button>
        </div>
      )}
    >
      {children}
    </ErrorBoundary>
  );
}
