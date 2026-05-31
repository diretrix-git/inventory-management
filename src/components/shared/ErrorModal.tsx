"use client";

import { useEffect, useRef } from "react";
import { AlertTriangle, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface ErrorModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  message: string;
  /** Optional action label — e.g. "Retry" */
  actionLabel?: string;
  onAction?: () => void;
}

export function ErrorModal({
  open,
  onClose,
  title = "Something went wrong",
  message,
  actionLabel,
  onAction,
}: ErrorModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open) {
      if (!dialog.open) dialog.showModal();
    } else {
      if (dialog.open) dialog.close();
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      className={cn(
        "fixed inset-0 z-50 m-auto w-[calc(100%-2rem)] max-w-md rounded-xl border border-border bg-popover p-0 shadow-xl",
        "backdrop:bg-black/50 backdrop:backdrop-blur-sm",
        "open:flex open:flex-col"
      )}
      aria-labelledby="error-modal-title"
      aria-describedby="error-modal-desc"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center size-8 rounded-full bg-destructive/10 flex-shrink-0">
            <AlertTriangle className="size-4 text-destructive" aria-hidden="true" />
          </div>
          <h2 id="error-modal-title" className="text-base font-semibold text-foreground">
            {title}
          </h2>
        </div>
        <button
          onClick={onClose}
          className="inline-flex items-center justify-center size-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          aria-label="Close"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>

      {/* Body */}
      <div className="px-5 py-4">
        <p id="error-modal-desc" className="text-sm text-muted-foreground leading-relaxed">
          {message}
        </p>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-4">
        <Button variant="outline" onClick={onClose}>
          Dismiss
        </Button>
        {actionLabel && onAction && (
          <Button onClick={() => { onAction(); onClose(); }}>
            {actionLabel}
          </Button>
        )}
      </div>
    </dialog>
  );
}
