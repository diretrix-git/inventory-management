import Link from "next/link";
import { ShieldOff } from "lucide-react";

export default function UnauthorizedPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <div className="flex items-center justify-center size-16 rounded-full bg-destructive/10 mb-6">
        <ShieldOff className="size-8 text-destructive" aria-hidden="true" />
      </div>
      <h1 className="text-2xl font-semibold text-foreground mb-2">Access Denied</h1>
      <p className="text-muted-foreground mb-6 max-w-sm">
        You don&apos;t have permission to view this page. Contact your administrator if you think this is a mistake.
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
