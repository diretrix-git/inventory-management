"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ViewModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: string;
}

export function ViewModal({
  open,
  onClose,
  title,
  children,
  footer,
  maxWidth = "max-w-lg",
}: ViewModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  // Sync open state with native <dialog>
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open) {
      if (!dialog.open) dialog.showModal();
    } else {
      if (dialog.open) dialog.close();
    }
  }, [open]);

  // Escape key is handled natively by <dialog> — onClose fires via onClose handler
  if (!open) return null;

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      className={cn(
        "fixed inset-0 z-50 m-auto w-[calc(100%-2rem)] rounded-xl border border-border bg-popover p-0 shadow-2xl",
        "backdrop:bg-black/60 backdrop:backdrop-blur-sm",
        "open:flex open:flex-col",
        maxWidth
      )}
      aria-labelledby="view-modal-title"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-5 py-4 flex-shrink-0">
        <h2 id="view-modal-title" className="text-base font-semibold text-foreground">
          {title}
        </h2>
        <button
          onClick={onClose}
          className="inline-flex items-center justify-center size-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          aria-label="Close (Esc)"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>

      {/* Body */}
      <div className="overflow-y-auto flex-1 p-5">
        {children}
      </div>

      {/* Footer */}
      {footer && (
        <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-4 flex-shrink-0">
          {footer}
        </div>
      )}
    </dialog>
  );
}
