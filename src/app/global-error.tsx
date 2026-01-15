'use client';

import { useEffect } from 'react';

interface ErrorBoundaryProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: ErrorBoundaryProps) {
  useEffect(() => {
    // Log error to monitoring service
    console.error('Global error:', error);
    
    // In production, send to error tracking service
    if (process.env.NODE_ENV === 'production') {
      // Future: Sentry.captureException(error);
    }
  }, [error]);

  return (
    <html>
      <body>
        <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white p-4">
          <div className="max-w-md w-full bg-gray-800 rounded-lg p-8 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/20 flex items-center justify-center">
              <svg
                className="w-8 h-8 text-red-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            
            <h1 className="text-2xl font-bold mb-2">Something went wrong!</h1>
            <p className="text-gray-400 mb-6">
              We apologize for the inconvenience. An unexpected error has occurred.
            </p>
            
            {process.env.NODE_ENV === 'development' && (
              <details className="mb-6 text-left bg-gray-900 rounded p-4 text-sm">
                <summary className="cursor-pointer text-gray-300 mb-2">
                  Error Details
                </summary>
                <pre className="text-red-400 whitespace-pre-wrap overflow-auto max-h-48">
                  {error.message}
                  {error.stack && `\n\n${error.stack}`}
                </pre>
                {error.digest && (
                  <p className="mt-2 text-gray-500">Digest: {error.digest}</p>
                )}
              </details>
            )}
            
            <div className="flex gap-4 justify-center">
              <button
                onClick={reset}
                className="px-6 py-2 bg-orange-500 hover:bg-orange-600 rounded-lg font-medium transition-colors"
              >
                Try Again
              </button>
              <a
                href="/"
                className="px-6 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg font-medium transition-colors"
              >
                Go Home
              </a>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
