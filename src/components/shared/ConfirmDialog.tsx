"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  /** When true, the confirm button uses destructive styling */
  destructive?: boolean;
  isLoading?: boolean;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onConfirm,
  destructive = true,
  isLoading = false,
}: ConfirmDialogProps) {
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

  // Close on backdrop click
  function handleBackdropClick(e: React.MouseEvent<HTMLDialogElement>) {
    const rect = dialogRef.current?.getBoundingClientRect();
    if (!rect) return;
    const clickedOutside =
      e.clientX < rect.left ||
      e.clientX > rect.right ||
      e.clientY < rect.top ||
      e.clientY > rect.bottom;
    if (clickedOutside) onOpenChange(false);
  }

  if (!open) return null;

  return (
    <dialog
      ref={dialogRef}
      onClose={() => onOpenChange(false)}
      onClick={handleBackdropClick}
      className={cn(
        "fixed inset-0 z-50 m-auto w-full max-w-md rounded-xl border border-border bg-popover p-0 shadow-xl",
        "backdrop:bg-black/50 backdrop:backdrop-blur-sm",
        "open:flex open:flex-col"
      )}
      aria-labelledby="confirm-dialog-title"
      aria-describedby={description ? "confirm-dialog-description" : undefined}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <h2
          id="confirm-dialog-title"
          className="text-base font-semibold text-foreground"
        >
          {title}
        </h2>
        <button
          onClick={() => onOpenChange(false)}
          className="inline-flex items-center justify-center size-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          aria-label="Close dialog"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>

      {/* Body */}
      {description && (
        <div className="px-5 py-4">
          <p
            id="confirm-dialog-description"
            className="text-sm text-muted-foreground"
          >
            {description}
          </p>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-4">
        <Button
          variant="outline"
          onClick={() => onOpenChange(false)}
          disabled={isLoading}
        >
          {cancelLabel}
        </Button>
        <Button
          variant={destructive ? "destructive" : "default"}
          onClick={onConfirm}
          disabled={isLoading}
          aria-busy={isLoading}
        >
          {isLoading ? "Loading…" : confirmLabel}
        </Button>
      </div>
    </dialog>
  );
}
