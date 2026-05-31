"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, Plus, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface CategorySelectProps {
  value: string;
  onChange: (value: string) => void;
  categories: string[];
  onAddCategory?: (name: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function CategorySelect({
  value,
  onChange,
  categories,
  onAddCategory,
  placeholder = "Select or add category",
  disabled = false,
  className,
}: CategorySelectProps) {
  const [open, setOpen] = useState(false);
  const [newCat, setNewCat] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  function handleAddNew() {
    const trimmed = newCat.trim();
    if (!trimmed) return;
    onAddCategory?.(trimmed);
    onChange(trimmed);
    setNewCat("");
    setOpen(false);
  }

  const filteredCategories = categories.filter((c) =>
    c.toLowerCase().includes(newCat.toLowerCase())
  );

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      {/* Trigger */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => { setOpen((v) => !v); setTimeout(() => inputRef.current?.focus(), 50); }}
        className={cn(
          "flex h-8 w-full items-center justify-between rounded-lg border border-input bg-background px-3 text-sm",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          "disabled:cursor-not-allowed disabled:opacity-50",
          !value && "text-muted-foreground"
        )}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="truncate">{value || placeholder}</span>
        <ChevronDown className={cn("size-3.5 text-muted-foreground transition-transform flex-shrink-0", open && "rotate-180")} aria-hidden="true" />
      </button>

      {/* Dropdown */}
      {open && (
        <div
          className="absolute left-0 right-0 top-full mt-1 z-30 rounded-lg border border-border bg-popover shadow-lg overflow-hidden"
          role="listbox"
        >
          {/* Search / add input */}
          <div className="p-2 border-b border-border">
            <input
              ref={inputRef}
              type="text"
              value={newCat}
              onChange={(e) => setNewCat(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); handleAddNew(); }
              }}
              placeholder="Search or type new category…"
              className="h-7 w-full rounded-md border border-input bg-background px-2.5 text-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          {/* Existing categories */}
          <div className="max-h-48 overflow-y-auto py-1">
            {filteredCategories.length === 0 && !newCat && (
              <p className="px-3 py-2 text-xs text-muted-foreground">No categories yet. Type to add one.</p>
            )}
            {filteredCategories.length === 0 && newCat && (
              <p className="px-3 py-2 text-xs text-muted-foreground">No match — press Enter to add &ldquo;{newCat}&rdquo;</p>
            )}
            {filteredCategories.map((cat) => (
              <button
                key={cat}
                type="button"
                role="option"
                aria-selected={value === cat}
                onClick={() => { onChange(cat); setOpen(false); setNewCat(""); }}
                className={cn(
                  "flex w-full items-center justify-between px-3 py-2 text-sm hover:bg-muted transition-colors text-left",
                  value === cat && "bg-muted"
                )}
              >
                <span>{cat}</span>
                {value === cat && <Check className="size-3.5 text-primary" aria-hidden="true" />}
              </button>
            ))}
          </div>

          {/* Add new button */}
          {newCat.trim() && !filteredCategories.includes(newCat.trim()) && (
            <div className="border-t border-border p-2">
              <button
                type="button"
                onClick={handleAddNew}
                className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-xs font-medium text-primary hover:bg-primary/10 transition-colors"
              >
                <Plus className="size-3.5" aria-hidden="true" />
                Add &ldquo;{newCat.trim()}&rdquo; as new category
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
