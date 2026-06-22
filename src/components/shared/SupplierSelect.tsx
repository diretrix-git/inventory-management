"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, Check, Plus, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { friendlyError } from "@/lib/errors";
import { toast } from "sonner";

interface SupplierOption {
  _id: string;
  name: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
}

interface SupplierSelectProps {
  value: string;        // supplierId
  onChange: (id: string) => void;
  disabled?: boolean;
  className?: string;
}

export function SupplierSelect({ value, onChange, disabled = false, className }: SupplierSelectProps) {
  const [open, setOpen] = useState(false);
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [search, setSearch] = useState("");

  // Inline "add new supplier" mini-form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newContact, setNewContact] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const selectedSupplier = suppliers.find((s) => s._id === value);

  // Load suppliers on open
  useEffect(() => {
    if (!open) return;
    setIsLoading(true);
    fetch("/api/suppliers")
      .then((r) => r.json())
      .then((data) => {
        setSuppliers((data.suppliers ?? []).map((s: SupplierOption) => ({
          _id: String(s._id ?? s._id),
          name: s.name,
          contactPerson: s.contactPerson,
          email: s.email,
          phone: s.phone,
        })));
      })
      .catch(() => toast.error("Could not load suppliers"))
      .finally(() => {
        setIsLoading(false);
        setTimeout(() => searchRef.current?.focus(), 50);
      });
  }, [open]);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setShowAddForm(false);
        setSearch("");
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); setShowAddForm(false); setSearch(""); } };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  const filtered = suppliers.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    (s.contactPerson ?? "").toLowerCase().includes(search.toLowerCase())
  );

  async function handleAddSupplier() {
    if (!newName.trim()) return;
    setIsSaving(true);
    try {
      const res = await fetch("/api/suppliers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName.trim(),
          contactPerson: newContact.trim(),
          email: newEmail.trim() || undefined,
          phone: newPhone.trim(),
        }),
      });
      const json = await res.json();
      if (!res.ok) { toast.error(friendlyError(json.error)); return; }

      const newSupplier: SupplierOption = {
        _id: String(json.supplier._id),
        name: json.supplier.name,
        contactPerson: json.supplier.contactPerson,
        email: json.supplier.email,
        phone: json.supplier.phone,
      };
      setSuppliers((prev) => [...prev, newSupplier].sort((a, b) => a.name.localeCompare(b.name)));
      onChange(newSupplier._id);
      toast.success(`Supplier "${newSupplier.name}" added`);
      setShowAddForm(false);
      setNewName(""); setNewContact(""); setNewEmail(""); setNewPhone("");
      setOpen(false);
    } catch {
      toast.error("Connection error — please try again");
    } finally {
      setIsSaving(false);
    }
  }

  function clearSelection(e: React.MouseEvent) {
    e.stopPropagation();
    onChange("");
  }

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      {/* Trigger */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => { setOpen((v) => !v); setShowAddForm(false); setSearch(""); }}
        className={cn(
          "flex h-8 w-full items-center justify-between rounded-lg border border-input bg-background px-3 text-sm",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          "disabled:cursor-not-allowed disabled:opacity-50",
          !value && "text-muted-foreground"
        )}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="truncate">
          {selectedSupplier ? selectedSupplier.name : "Select supplier (optional)"}
        </span>
        <div className="flex items-center gap-1 flex-shrink-0">
          {value && (
            <span
              onClick={clearSelection}
              className="inline-flex items-center justify-center size-4 rounded hover:bg-muted transition-colors cursor-pointer"
              role="button"
              aria-label="Clear supplier"
            >
              <X className="size-3 text-muted-foreground" aria-hidden="true" />
            </span>
          )}
          <ChevronDown className={cn("size-3.5 text-muted-foreground transition-transform", open && "rotate-180")} aria-hidden="true" />
        </div>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute left-0 right-0 top-full mt-1 z-30 rounded-xl border border-border bg-popover shadow-xl overflow-hidden">
          {/* Search */}
          {!showAddForm && (
            <div className="p-2 border-b border-border">
              <input
                ref={searchRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search suppliers…"
                className="h-7 w-full rounded-md border border-input bg-background px-2.5 text-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
          )}

          {!showAddForm ? (
            <>
              {/* Supplier list */}
              <div className="max-h-48 overflow-y-auto">
                {isLoading ? (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 className="size-4 animate-spin text-muted-foreground" aria-label="Loading" />
                  </div>
                ) : filtered.length === 0 ? (
                  <p className="px-3 py-3 text-xs text-muted-foreground text-center">
                    {search ? `No suppliers matching "${search}"` : "No suppliers yet — add one below"}
                  </p>
                ) : (
                  filtered.map((s) => (
                    <button
                      key={s._id}
                      type="button"
                      onClick={() => { onChange(s._id); setOpen(false); setSearch(""); }}
                      className={cn(
                        "flex w-full items-center justify-between px-3 py-2.5 text-sm hover:bg-muted transition-colors text-left",
                        value === s._id && "bg-muted"
                      )}
                      role="option"
                      aria-selected={value === s._id}
                    >
                      <div className="min-w-0">
                        <p className="font-medium text-foreground truncate">{s.name}</p>
                        {s.contactPerson && <p className="text-xs text-muted-foreground">{s.contactPerson}</p>}
                      </div>
                      {value === s._id && <Check className="size-3.5 text-primary flex-shrink-0" aria-hidden="true" />}
                    </button>
                  ))
                )}
              </div>

              {/* Add new supplier button */}
              <div className="border-t border-border p-2">
                <button
                  type="button"
                  onClick={() => setShowAddForm(true)}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium text-primary hover:bg-primary/10 transition-colors"
                >
                  <Plus className="size-3.5" aria-hidden="true" />
                  Add new supplier
                </button>
              </div>
            </>
          ) : (
            /* Inline add-supplier mini-form */
            <div className="p-3 flex flex-col gap-2.5">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-semibold text-foreground">New Supplier</p>
                <button
                  type="button"
                  onClick={() => { setShowAddForm(false); setNewName(""); setNewContact(""); setNewEmail(""); setNewPhone(""); }}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  ← Back
                </button>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground">
                  Name <span className="text-destructive" aria-hidden="true">*</span>
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Supplier name"
                  autoFocus
                  className="h-7 w-full rounded-md border border-input bg-background px-2.5 text-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground">
                  Contact person <span className="text-destructive" aria-hidden="true">*</span>
                </label>
                <input
                  type="text"
                  value={newContact}
                  onChange={(e) => setNewContact(e.target.value)}
                  placeholder="Full name"
                  className="h-7 w-full rounded-md border border-input bg-background px-2.5 text-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-muted-foreground">Email <span className="text-[10px] text-muted-foreground/60">(optional)</span></label>
                  <input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="supplier@example.com"
                    className="h-7 w-full rounded-md border border-input bg-background px-2.5 text-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-muted-foreground">
                    Phone <span className="text-destructive" aria-hidden="true">*</span>
                  </label>
                  <input
                    type="tel"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    placeholder="+977 98XXXXXXXX"
                    className="h-7 w-full rounded-md border border-input bg-background px-2.5 text-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={handleAddSupplier}
                disabled={!newName.trim() || !newContact.trim() || !newPhone.trim() || isSaving}
                className="mt-1 flex items-center justify-center gap-1.5 h-7 w-full rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
              >
                {isSaving ? <Loader2 className="size-3 animate-spin" aria-hidden="true" /> : <Plus className="size-3" aria-hidden="true" />}
                {isSaving ? "Adding…" : "Add Supplier"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
