import Link from "next/link";
import { FileQuestion } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen text-center px-4 bg-background">
      <div className="flex items-center justify-center size-16 rounded-full bg-muted mb-6">
        <FileQuestion className="size-8 text-muted-foreground" aria-hidden="true" />
      </div>
      <h1 className="text-2xl font-semibold text-foreground mb-2">Page not found</h1>
      <p className="text-muted-foreground mb-6 max-w-sm">
        The page you&apos;re looking for doesn&apos;t exist or has been moved.
      </p>
      <Link
        href="/dashboard"
        className="inline-flex items-center justify-center h-8 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity"
      >
        Back to Dashboard
      </Link>
    </div>
  );
}
