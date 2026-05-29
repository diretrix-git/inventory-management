"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen text-center px-4 bg-background">
      <div className="flex items-center justify-center size-16 rounded-full bg-destructive/10 mb-6">
        <AlertTriangle className="size-8 text-destructive" aria-hidden="true" />
      </div>
      <h1 className="text-2xl font-semibold text-foreground mb-2">Something went wrong</h1>
      <p className="text-muted-foreground mb-6 max-w-sm">
        An unexpected error occurred. Please try again or contact support if the problem persists.
      </p>
      <button
        onClick={reset}
        className="inline-flex items-center justify-center h-8 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity"
      >
        Try again
      </button>
    </div>
  );
}
