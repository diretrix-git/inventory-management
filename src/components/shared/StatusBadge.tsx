import { cn } from "@/lib/utils";

// Status values per Requirement 14.5
type StatusValue =
  | "confirmed"
  | "pending"
  | "cancelled"
  | "issued"
  | "void"
  | "active"
  | "inactive";

// Color token mapping per design spec
const STATUS_STYLES: Record<StatusValue, string> = {
  confirmed: "bg-success/15 text-success border-success/30",
  pending: "bg-warning/15 text-warning border-warning/30",
  cancelled: "bg-danger/15 text-danger border-danger/30",
  issued: "bg-brand-blue/15 text-brand-blue border-brand-blue/30",
  void: "bg-muted text-muted-foreground border-border",
  active: "bg-success/15 text-success border-success/30",
  inactive: "bg-danger/15 text-danger border-danger/30",
};

const STATUS_LABELS: Record<StatusValue, string> = {
  confirmed: "Confirmed",
  pending: "Pending",
  cancelled: "Cancelled",
  issued: "Issued",
  void: "Void",
  active: "Active",
  inactive: "Inactive",
};

interface StatusBadgeProps {
  status: StatusValue | string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const key = status.toLowerCase() as StatusValue;
  const styles = STATUS_STYLES[key] ?? "bg-muted text-muted-foreground border-border";
  const label = STATUS_LABELS[key] ?? status;

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        styles,
        className
      )}
    >
      {label}
    </span>
  );
}
