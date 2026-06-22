"use client";

import { useEffect, useState, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { friendlyError } from "@/lib/errors";

import { Plus, Pencil, Trash2, X, Loader2 } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";

import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable } from "@/components/shared/DataTable";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRole } from "@/components/providers/RoleProvider";
import type { ISupplier } from "@/types";

// ─── Types ────────────────────────────────────────────────────────────────────

type SupplierRow = Omit<ISupplier, "_id"> & { _id: string; productCount: number };

// ─── Zod schema ───────────────────────────────────────────────────────────────

const supplierSchema = z.object({
  name: z.string().min(1, "Name is required").max(200, "Name too long"),
  contactPerson: z.string().min(1, "Contact person is required").max(100, "Too long"),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  phone: z.string().min(1, "Phone number is required").max(30, "Too long"),
  address: z.string().max(500, "Too long").optional(),
  notes: z.string().optional(),
});

type SupplierFormValues = z.infer<typeof supplierSchema>;

// ─── SupplierSheet ────────────────────────────────────────────────────────────

interface SupplierSheetProps {
  open: boolean;
  onClose: () => void;
  editSupplier: SupplierRow | null;
  onSuccess: () => void;
}

function SupplierSheet({ open, onClose, editSupplier, onSuccess }: SupplierSheetProps) {
  const isEdit = editSupplier !== null;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<SupplierFormValues>({
    resolver: zodResolver(supplierSchema),
    defaultValues: isEdit
      ? { name: editSupplier.name, contactPerson: editSupplier.contactPerson ?? "", email: editSupplier.email ?? "", phone: editSupplier.phone ?? "", address: editSupplier.address ?? "", notes: editSupplier.notes ?? "" }
      : { name: "", contactPerson: "", email: "", phone: "", address: "", notes: "" },
  });

  useEffect(() => {
    if (open) {
      reset(
        isEdit
          ? { name: editSupplier.name, contactPerson: editSupplier.contactPerson ?? "", email: editSupplier.email ?? "", phone: editSupplier.phone ?? "", address: editSupplier.address ?? "", notes: editSupplier.notes ?? "" }
          : { name: "", contactPerson: "", email: "", phone: "", address: "", notes: "" }
      );
    }
  }, [open, isEdit, editSupplier, reset]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  async function onSubmit(data: SupplierFormValues) {
    try {
      const url = isEdit ? `/api/suppliers/${editSupplier._id}` : "/api/suppliers";
      const method = isEdit ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) { toast.error(friendlyError(json.error)); return; }
      toast.success(isEdit ? "Supplier updated" : "Supplier created");
      onSuccess();
      onClose();
    } catch {
      toast.error("Network error — please try again");
    }
  }

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" aria-hidden="true" onClick={onClose} />
      <aside role="dialog" aria-modal="true" aria-label={isEdit ? "Edit supplier" : "New supplier"} className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col bg-popover shadow-2xl border-l border-border">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-base font-semibold text-foreground">{isEdit ? "Edit Supplier" : "New Supplier"}</h2>
          <button type="button" onClick={onClose} className="inline-flex items-center justify-center size-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" aria-label="Close panel">
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-1 flex-col gap-4 overflow-y-auto px-5 py-5">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="s-name">Name <span className="text-destructive" aria-hidden="true">*</span></Label>
            <Input id="s-name" type="text" placeholder="Supplier name" aria-invalid={!!errors.name} {...register("name")} />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="s-contact">Contact Person <span className="text-destructive" aria-hidden="true">*</span></Label>
            <Input id="s-contact" type="text" placeholder="Full name" aria-invalid={!!errors.contactPerson} {...register("contactPerson")} />
            {errors.contactPerson && <p className="text-xs text-destructive">{errors.contactPerson.message}</p>}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="s-phone">Phone <span className="text-destructive" aria-hidden="true">*</span></Label>
            <Input id="s-phone" type="tel" placeholder="+977 98XXXXXXXX" aria-invalid={!!errors.phone} {...register("phone")} />
            {errors.phone && <p className="text-xs text-destructive">{errors.phone.message}</p>}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="s-email">Email <span className="text-xs font-normal text-muted-foreground">(optional)</span></Label>
            <Input id="s-email" type="email" placeholder="contact@supplier.com" aria-invalid={!!errors.email} {...register("email")} />
            {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="s-address">Address <span className="text-xs font-normal text-muted-foreground">(optional)</span></Label>
            <textarea id="s-address" rows={3} placeholder="Street, City, Country" className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none" {...register("address")} />
          </div>

          <div className="flex-1" />

          <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting} aria-busy={isSubmitting}>
              {isSubmitting ? <><Loader2 className="size-4 animate-spin" aria-hidden="true" />{isEdit ? "Saving…" : "Creating…"}</> : isEdit ? "Save changes" : "Create supplier"}
            </Button>
          </div>
        </form>
      </aside>
    </>
  );
}

// ─── SuppliersPage ────────────────────────────────────────────────────────────

export default function SuppliersPage() {
  const role = useRole();
  const isAdmin = role === "admin";

  const [suppliers, setSuppliers] = useState<SupplierRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editSupplier, setEditSupplier] = useState<SupplierRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SupplierRow | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchSuppliers = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/suppliers", { cache: "no-store" });
      if (!res.ok) { toast.error("Could not load suppliers. Please refresh the page."); return; }
      const json = await res.json();
      setSuppliers((json.suppliers as SupplierRow[]).map((s) => ({ ...s, _id: String(s._id) })));
    } catch {
      toast.error("Could not load suppliers. Please refresh the page.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchSuppliers(); }, [fetchSuppliers]);

  async function handleDelete() {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/suppliers/${deleteTarget._id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) { toast.error(friendlyError(json.error)); return; }
      toast.success("Supplier deleted");
      setDeleteTarget(null);
      await fetchSuppliers();
    } catch {
      toast.error("Network error — please try again");
    } finally {
      setIsDeleting(false);
    }
  }

  const columns: ColumnDef<SupplierRow>[] = [
    {
      accessorKey: "name",
      header: "Name",
      cell: ({ row }) => <span className="font-medium text-foreground">{row.original.name}</span>,
    },
    {
      accessorKey: "contactPerson",
      header: "Contact Person",
      cell: ({ row }) => <span className="text-muted-foreground">{row.original.contactPerson ?? "—"}</span>,
    },
    {
      accessorKey: "email",
      header: "Email",
      cell: ({ row }) => <span className="text-muted-foreground">{row.original.email ?? "—"}</span>,
    },
    {
      accessorKey: "phone",
      header: "Phone",
      cell: ({ row }) => <span className="text-muted-foreground">{row.original.phone ?? "—"}</span>,
    },
    {
      accessorKey: "productCount",
      header: "Products",
      cell: ({ row }) => (
        <span className="font-mono text-sm tabular-nums">{row.original.productCount}</span>
      ),
    },
    ...(isAdmin
      ? ([
          {
            id: "actions",
            header: "",
            enableSorting: false,
            enableHiding: false,
            cell: ({ row }) => {
              const s = row.original;
              return (
                <div className="flex items-center justify-end gap-1.5">
                  <Button variant="ghost" size="icon-sm" onClick={() => { setEditSupplier(s); setSheetOpen(true); }} aria-label={`Edit ${s.name}`}>
                    <Pencil className="size-3.5" aria-hidden="true" />
                  </Button>
                  <Button variant="ghost" size="icon-sm" onClick={() => setDeleteTarget(s)} aria-label={`Delete ${s.name}`} className="text-destructive hover:text-destructive hover:bg-destructive/10">
                    <Trash2 className="size-3.5" aria-hidden="true" />
                  </Button>
                </div>
              );
            },
          },
        ] as ColumnDef<SupplierRow>[])
      : []),
  ];

  return (
    <>
      <PageHeader
        title="Suppliers"
        description="Manage your supplier directory."
        action={
          isAdmin ? (
            <Button onClick={() => { setEditSupplier(null); setSheetOpen(true); }}>
              <Plus className="size-4" aria-hidden="true" />
              New Supplier
            </Button>
          ) : undefined
        }
      />

      <DataTable columns={columns} data={suppliers} isLoading={isLoading} searchKey="name" searchPlaceholder="Search by name…"
        emptyTitle="No suppliers yet"
        emptyDescription={isAdmin ? "Add your first supplier using the button above." : "No suppliers have been added yet."}
      />

      {isAdmin && (
        <SupplierSheet open={sheetOpen} onClose={() => setSheetOpen(false)} editSupplier={editSupplier} onSuccess={fetchSuppliers} />
      )}

      {isAdmin && deleteTarget && (
        <ConfirmDialog
          open={!!deleteTarget}
          onOpenChange={(v) => { if (!v) setDeleteTarget(null); }}
          title="Delete supplier?"
          description={`"${deleteTarget.name}" will be permanently deleted. This cannot be undone.`}
          confirmLabel="Delete"
          destructive
          onConfirm={handleDelete}
          isLoading={isDeleting}
        />
      )}
    </>
  );
}
