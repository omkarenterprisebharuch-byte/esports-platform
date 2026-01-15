'use client';

import { useEffect } from 'react';
import Link from 'next/link';

interface ErrorBoundaryProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function Error({ error, reset }: ErrorBoundaryProps) {
  useEffect(() => {
    // Log error to monitoring service
    console.error('App error:', error);
    
    // In production, send to error tracking service
    if (process.env.NODE_ENV === 'production') {
      // Future: Sentry.captureException(error);
    }
  }, [error]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-4">
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
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
        
        <h2 className="text-xl font-bold mb-2 text-white">
          Oops! Something went wrong
        </h2>
        <p className="text-gray-400 mb-6">
          We encountered an error while loading this page. Please try again.
        </p>
        
        {process.env.NODE_ENV === 'development' && (
          <details className="mb-6 text-left bg-gray-900 rounded p-4 text-sm">
            <summary className="cursor-pointer text-gray-300 mb-2">
              Error Details
            </summary>
            <pre className="text-red-400 whitespace-pre-wrap overflow-auto max-h-48">
              {error.message}
            </pre>
            {error.digest && (
              <p className="mt-2 text-gray-500">Digest: {error.digest}</p>
            )}
          </details>
        )}
        
        <div className="flex gap-4 justify-center">
          <button
            onClick={reset}
            className="px-6 py-2 bg-orange-500 hover:bg-orange-600 rounded-lg font-medium transition-colors text-white"
          >
            Try Again
          </button>
          <Link
            href="/app"
            className="px-6 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg font-medium transition-colors text-white"
          >
            Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
