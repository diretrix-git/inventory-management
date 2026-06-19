"use client";

import { useState, useRef } from "react";
import { Upload, Download, X, CheckCircle, AlertTriangle, Loader2, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { friendlyError } from "@/lib/errors";

interface ImportResult {
  created: number;
  skipped: number;
  errors: string[];
}

interface CsvImportProps {
  onSuccess: () => void;
}

// ─── CSV template ─────────────────────────────────────────────────────────────

const TEMPLATE_HEADERS = ["name", "category", "supplierName", "price", "quantity", "lowStockThreshold", "description", "sku"];
const TEMPLATE_EXAMPLE = [
  ["Coca Cola 500ml", "Beverages", "Nepal Beverages Co.", "35", "100", "20", "Chilled carbonated drink", "BEV-COLA-500"],
  ["Lay's Chips 30g", "Snacks", "Snack Distributors Pvt.", "25", "200", "30", "Salted potato chips", ""],
  ["Dettol Handwash 200ml", "Hygiene", "Health Products Nepal", "120", "50", "10", "Antibacterial handwash", ""],
];

function downloadTemplate() {
  const rows = [TEMPLATE_HEADERS, ...TEMPLATE_EXAMPLE];
  const csv = rows.map((r) => r.map((cell) => `"${cell}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "product-import-template.csv";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── Simple CSV parser ────────────────────────────────────────────────────────

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];

  const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, "").trim());
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    // Handle quoted fields with commas
    const values: string[] = [];
    let current = "";
    let inQuotes = false;
    for (const char of lines[i]) {
      if (char === '"') { inQuotes = !inQuotes; }
      else if (char === "," && !inQuotes) { values.push(current.trim()); current = ""; }
      else { current += char; }
    }
    values.push(current.trim());

    const row: Record<string, string> = {};
    headers.forEach((h, idx) => { row[h] = values[idx] ?? ""; });
    rows.push(row);
  }
  return rows;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function CsvImport({ onSuccess }: CsvImportProps) {
  const [open, setOpen] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function processFile(file: File) {
    if (!file.name.endsWith(".csv")) {
      toast.error("Please upload a CSV file (.csv)");
      return;
    }

    const text = await file.text();
    const rows = parseCsv(text);

    if (rows.length === 0) {
      toast.error("The CSV file is empty or has no data rows.");
      return;
    }

    // Validate required columns
    const firstRow = rows[0];
    const requiredCols = ["name", "category", "supplierName", "price", "quantity"];
    const missingCols = requiredCols.filter((c) => !(c in firstRow));
    if (missingCols.length > 0) {
      toast.error(`Missing required columns: ${missingCols.join(", ")}. Download the template to see the correct format.`);
      return;
    }

    setPreviewCount(rows.length);
    setResult(null);
    setIsUploading(true);

    try {
      const res = await fetch("/api/products/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(rows),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(friendlyError(json.error));
        return;
      }
      setResult(json as ImportResult);
      if ((json as ImportResult).created > 0) {
        onSuccess();
      }
    } catch {
      toast.error("Connection error. Please try again.");
    } finally {
      setIsUploading(false);
      setPreviewCount(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }

  function handleClose() {
    setOpen(false);
    setResult(null);
    setPreviewCount(null);
  }

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <FileSpreadsheet className="size-4 mr-1.5" aria-hidden="true" />
        Import CSV
      </Button>

      {/* Import modal */}
      {open && (
        <>
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" aria-hidden="true" onClick={handleClose} />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Import products from CSV"
            className="fixed inset-0 z-50 m-auto w-[calc(100%-2rem)] max-w-lg h-fit rounded-xl border border-border bg-popover shadow-2xl flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <h2 className="text-base font-semibold text-foreground">Import Products from CSV</h2>
              <button onClick={handleClose} className="inline-flex items-center justify-center size-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" aria-label="Close">
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>

            <div className="p-5 flex flex-col gap-4">
              {/* Template download */}
              <div className="flex items-center justify-between rounded-lg border border-border bg-muted/40 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-foreground">Download template</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Fill it in and upload below. Required: name, category, supplierName, price, quantity.</p>
                </div>
                <Button variant="outline" size="sm" onClick={downloadTemplate}>
                  <Download className="size-3.5 mr-1.5" aria-hidden="true" />
                  Template
                </Button>
              </div>

              {/* Drop zone */}
              {!result && (
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  onDragEnter={(e) => { e.preventDefault(); setIsDragOver(true); }}
                  onDragLeave={(e) => { e.preventDefault(); if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDragOver(false); }}
                  onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; }}
                  onDrop={handleDrop}
                  disabled={isUploading}
                  className={cn(
                    "flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-8 transition-colors cursor-pointer",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    isDragOver ? "border-primary bg-primary/5" : "border-input hover:border-ring",
                    isUploading && "opacity-60 cursor-not-allowed"
                  )}
                  aria-label="Upload CSV file"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="size-8 animate-spin text-muted-foreground" />
                      <p className="text-sm font-medium text-muted-foreground">
                        Importing {previewCount} product{previewCount !== 1 ? "s" : ""}…
                      </p>
                    </>
                  ) : isDragOver ? (
                    <>
                      <Upload className="size-8 text-primary" />
                      <p className="text-sm font-semibold text-primary">Drop to import</p>
                    </>
                  ) : (
                    <>
                      <Upload className="size-8 text-muted-foreground" />
                      <p className="text-sm font-medium text-foreground">Drag &amp; drop your CSV here</p>
                      <p className="text-xs text-muted-foreground">or <span className="text-primary underline underline-offset-2">click to browse</span></p>
                    </>
                  )}
                </button>
              )}

              {/* Results */}
              {result && (
                <div className="flex flex-col gap-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex items-center gap-2.5 rounded-lg border border-success/30 bg-success/8 px-4 py-3">
                      <CheckCircle className="size-5 text-success flex-shrink-0" />
                      <div>
                        <p className="text-xl font-bold text-foreground">{result.created}</p>
                        <p className="text-xs text-muted-foreground">Products imported</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2.5 rounded-lg border border-warning/30 bg-warning/8 px-4 py-3">
                      <AlertTriangle className="size-5 text-warning flex-shrink-0" />
                      <div>
                        <p className="text-xl font-bold text-foreground">{result.skipped}</p>
                        <p className="text-xs text-muted-foreground">Rows skipped</p>
                      </div>
                    </div>
                  </div>

                  {result.errors.length > 0 && (
                    <div className="rounded-lg border border-border bg-muted/40 p-3 max-h-40 overflow-y-auto">
                      <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Issues ({result.errors.length})</p>
                      {result.errors.map((err, i) => (
                        <p key={i} className="text-xs text-muted-foreground mb-1 leading-relaxed">{err}</p>
                      ))}
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => { setResult(null); }} className="flex-1">
                      Import another file
                    </Button>
                    <Button onClick={handleClose} className="flex-1">Done</Button>
                  </div>
                </div>
              )}

              <input
                ref={inputRef}
                type="file"
                accept=".csv"
                className="sr-only"
                onChange={handleFileChange}
                aria-hidden="true"
              />

              {/* Format guide */}
              {!result && (
                <div className="text-xs text-muted-foreground space-y-1">
                  <p className="font-medium text-foreground">CSV column guide:</p>
                  <p><span className="font-medium">name</span> — product name (required)</p>
                  <p><span className="font-medium">category</span> — category name (required, auto-created if new)</p>
                  <p><span className="font-medium">supplierName</span> — supplier name (required, auto-created if new)</p>
                  <p><span className="font-medium">price</span> — selling price in Rs (required)</p>
                  <p><span className="font-medium">quantity</span> — stock quantity (required)</p>
                  <p><span className="font-medium">lowStockThreshold</span> — optional, default 10</p>
                  <p><span className="font-medium">description</span> — optional</p>
                  <p><span className="font-medium">sku</span> — optional, auto-generated if blank</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}
