"use client";

import { useEffect, useState, useCallback } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, X, Loader2, AlertTriangle, Package } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";

import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { ErrorModal } from "@/components/shared/ErrorModal";
import { CloudinaryUpload } from "@/components/shared/CloudinaryUpload";
import { CategorySelect } from "@/components/shared/CategorySelect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRole } from "@/components/providers/RoleProvider";
import type { IProduct } from "@/types";

// ─── Types ────────────────────────────────────────────────────────────────────

type ProductRow = Omit<IProduct, "_id"> & { _id: string; isLowStock?: boolean };

// ─── Zod schema ───────────────────────────────────────────────────────────────

const productSchema = z.object({
  name: z.string().min(1, "Name is required").max(200, "Name too long"),
  sku: z.string().min(1, "SKU is required").max(50, "SKU too long"),
  category: z.string().max(100, "Category too long").optional(),
  description: z.string().optional(),
  price: z.preprocess((v) => parseFloat(String(v)), z.number().min(0, "Price must be ≥ 0")),
  quantity: z.preprocess((v) => parseInt(String(v), 10), z.number().int("Must be a whole number").min(0, "Quantity must be ≥ 0")),
  lowStockThreshold: z.preprocess((v) => parseInt(String(v), 10), z.number().int("Must be a whole number").min(0, "Must be ≥ 0")),
  supplierId: z.string().optional(),
});

type ProductFormValues = z.infer<typeof productSchema>;

// ─── ProductSheet ─────────────────────────────────────────────────────────────

interface ProductSheetProps {
  open: boolean;
  onClose: () => void;
  editProduct: ProductRow | null;
  onSuccess: () => void;
  categories: string[];
  onAddCategory: (name: string) => void;
}

function ProductSheet({ open, onClose, editProduct, onSuccess, categories, onAddCategory }: ProductSheetProps) {
  const isEdit = editProduct !== null;
  const [imageUrl, setImageUrl] = useState<string>(editProduct?.imageUrl ?? "");

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isSubmitting },
  } = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema) as import("react-hook-form").Resolver<ProductFormValues>,
    defaultValues: isEdit
      ? { name: editProduct.name, sku: editProduct.sku, category: editProduct.category ?? "", description: editProduct.description ?? "", price: editProduct.price, quantity: editProduct.quantity, lowStockThreshold: editProduct.lowStockThreshold, supplierId: editProduct.supplierId ? String(editProduct.supplierId) : "" }
      : { name: "", sku: "", category: "", description: "", price: 0, quantity: 0, lowStockThreshold: 10, supplierId: "" },
  });

  useEffect(() => {
    if (open) {
      setImageUrl(editProduct?.imageUrl ?? "");
      reset(isEdit
        ? { name: editProduct.name, sku: editProduct.sku, category: editProduct.category ?? "", description: editProduct.description ?? "", price: editProduct.price, quantity: editProduct.quantity, lowStockThreshold: editProduct.lowStockThreshold, supplierId: editProduct.supplierId ? String(editProduct.supplierId) : "" }
        : { name: "", sku: "", category: "", description: "", price: 0, quantity: 0, lowStockThreshold: 10, supplierId: "" }
      );
    }
  }, [open, isEdit, editProduct, reset]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  async function onSubmit(data: ProductFormValues) {
    try {
      const url = isEdit ? `/api/products/${editProduct._id}` : "/api/products";
      const method = isEdit ? "PUT" : "POST";
      const body: Record<string, unknown> = {
        name: data.name,
        sku: data.sku.toUpperCase(),
        price: data.price,
        quantity: data.quantity,
        lowStockThreshold: data.lowStockThreshold,
      };
      if (data.category) body.category = data.category;
      if (data.description) body.description = data.description;
      if (data.supplierId) body.supplierId = data.supplierId;
      if (imageUrl) body.imageUrl = imageUrl;

      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const json = await res.json();
      if (!res.ok) { toast.error(json.error ?? "Something went wrong"); return; }
      toast.success(isEdit ? "Product updated" : "Product created");
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
      <aside role="dialog" aria-modal="true" aria-label={isEdit ? "Edit product" : "New product"}
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col bg-popover shadow-2xl border-l border-border">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-base font-semibold text-foreground">{isEdit ? "Edit Product" : "New Product"}</h2>
          <button type="button" onClick={onClose} className="inline-flex items-center justify-center size-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" aria-label="Close panel">
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-1 flex-col gap-4 overflow-y-auto px-5 py-5">
          {/* Name */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="p-name">Name <span className="text-destructive" aria-hidden="true">*</span></Label>
            <Input id="p-name" type="text" placeholder="Product name" aria-invalid={!!errors.name} {...register("name")} />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>

          {/* SKU */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="p-sku">SKU <span className="text-destructive" aria-hidden="true">*</span></Label>
            <Input id="p-sku" type="text" placeholder="e.g. PROD-001" aria-invalid={!!errors.sku} {...register("sku")} className="font-mono uppercase" />
            {errors.sku && <p className="text-xs text-destructive">{errors.sku.message}</p>}
          </div>

          {/* Category — dropdown with add new */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="p-category">Category</Label>
            <Controller
              name="category"
              control={control}
              render={({ field }) => (
                <CategorySelect
                  value={field.value ?? ""}
                  onChange={field.onChange}
                  categories={categories}
                  onAddCategory={onAddCategory}
                  placeholder="Select or add category"
                />
              )}
            />
          </div>

          {/* Price & Quantity */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="p-price">Price <span className="text-destructive" aria-hidden="true">*</span></Label>
              <Input id="p-price" type="number" min="0" step="0.01" placeholder="0.00" aria-invalid={!!errors.price} {...register("price")} />
              {errors.price && <p className="text-xs text-destructive">{errors.price.message}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="p-qty">Quantity <span className="text-destructive" aria-hidden="true">*</span></Label>
              <Input id="p-qty" type="number" min="0" step="1" placeholder="0" aria-invalid={!!errors.quantity} {...register("quantity")} />
              {errors.quantity && <p className="text-xs text-destructive">{errors.quantity.message}</p>}
            </div>
          </div>

          {/* Low stock threshold */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="p-threshold">Low Stock Threshold</Label>
            <Input id="p-threshold" type="number" min="0" step="1" placeholder="10" {...register("lowStockThreshold")} />
          </div>

          {/* Description */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="p-desc">Description</Label>
            <textarea id="p-desc" rows={3} placeholder="Optional description"
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
              {...register("description")} />
          </div>

          {/* Product image */}
          <div className="flex flex-col gap-1.5">
            <Label>Product Image</Label>
            <CloudinaryUpload value={imageUrl || null} onChange={setImageUrl} onClear={() => setImageUrl("")}
              label="Upload product image" folder="inventory/products" aspectRatio="aspect-video" />
          </div>

          <div className="flex-1" />

          <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting} aria-busy={isSubmitting}>
              {isSubmitting ? <><Loader2 className="size-4 animate-spin" aria-hidden="true" />{isEdit ? "Saving…" : "Creating…"}</> : isEdit ? "Save changes" : "Create product"}
            </Button>
          </div>
        </form>
      </aside>
    </>
  );
}

// ─── ProductsPage ─────────────────────────────────────────────────────────────

export default function ProductsPage() {
  const role = useRole();
  const isAdmin = role === "admin";

  const [products, setProducts] = useState<ProductRow[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editProduct, setEditProduct] = useState<ProductRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProductRow | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const fetchProducts = useCallback(async () => {
    setIsLoading(true);
    setFetchError(null);
    try {
      const [prodRes, catRes] = await Promise.all([
        fetch("/api/products", { cache: "no-store" }),
        fetch("/api/categories"),
      ]);
      if (!prodRes.ok) {
        const json = await prodRes.json().catch(() => ({}));
        setFetchError(json.error ?? "Failed to load products");
        return;
      }
      const prodJson = await prodRes.json();
      setProducts((prodJson.products as ProductRow[]).map((p) => ({ ...p, _id: String(p._id) })));
      if (catRes.ok) {
        const catJson = await catRes.json();
        setCategories(catJson.categories as string[]);
      }
    } catch {
      setFetchError("Network error — could not load products. Check your connection and try again.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  function handleAddCategory(name: string) {
    setCategories((prev) => [...new Set([...prev, name])].sort());
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/products/${deleteTarget._id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) {
        // Critical error — show modal instead of toast
        setDeleteError(json.error ?? "Failed to delete product");
        return;
      }
      toast.success("Product deleted");
      setDeleteTarget(null);
      await fetchProducts();
    } catch {
      setDeleteError("Network error — could not delete product. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  }

  // All product names for fuzzy search suggestions
  const productNames = products.map((p) => p.name);

  const columns: ColumnDef<ProductRow>[] = [
    {
      id: "image",
      header: "",
      enableSorting: false,
      enableHiding: false,
      cell: ({ row }) => {
        const p = row.original;
        return p.imageUrl ? (
          <div className="size-9 rounded-md overflow-hidden border border-border flex-shrink-0 bg-muted">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.imageUrl} alt={p.name} className="size-9 object-cover" />
          </div>
        ) : (
          <div className="size-9 rounded-md border border-border bg-muted flex items-center justify-center flex-shrink-0">
            <Package className="size-4 text-muted-foreground" aria-hidden="true" />
          </div>
        );
      },
    },
    {
      accessorKey: "name",
      header: "Name",
      cell: ({ row }) => <span className="font-medium text-foreground">{row.original.name}</span>,
    },
    {
      accessorKey: "sku",
      header: "SKU",
      cell: ({ row }) => <span className="font-mono text-xs text-muted-foreground tabular-nums">{row.original.sku}</span>,
    },
    {
      accessorKey: "category",
      header: "Category",
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {row.original.category ? (
            <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
              {row.original.category}
            </span>
          ) : "—"}
        </span>
      ),
    },
    {
      accessorKey: "price",
      header: "Unit Price",
      cell: ({ row }) => <span className="font-mono text-sm tabular-nums">${row.original.price.toFixed(2)}</span>,
    },
    {
      accessorKey: "quantity",
      header: "Stock",
      cell: ({ row }) => <span className="font-mono text-sm tabular-nums">{row.original.quantity}</span>,
    },
    {
      id: "stockStatus",
      header: "Status",
      cell: ({ row }) => {
        const p = row.original;
        if (p.isLowStock) {
          return (
            <span className="inline-flex items-center gap-1 rounded-full border border-warning/30 bg-warning/15 px-2.5 py-0.5 text-xs font-medium text-warning">
              <AlertTriangle className="size-3" aria-hidden="true" />
              Low Stock
            </span>
          );
        }
        return <StatusBadge status="active" />;
      },
    },
    ...(isAdmin ? ([{
      id: "actions",
      header: "",
      enableSorting: false,
      enableHiding: false,
      cell: ({ row }) => {
        const p = row.original;
        return (
          <div className="flex items-center justify-end gap-1.5">
            <Button variant="ghost" size="icon-sm" onClick={() => { setEditProduct(p); setSheetOpen(true); }} aria-label={`Edit ${p.name}`}>
              <Pencil className="size-3.5" aria-hidden="true" />
            </Button>
            <Button variant="ghost" size="icon-sm" onClick={() => setDeleteTarget(p)} aria-label={`Delete ${p.name}`} className="text-destructive hover:text-destructive hover:bg-destructive/10">
              <Trash2 className="size-3.5" aria-hidden="true" />
            </Button>
          </div>
        );
      },
    }] as ColumnDef<ProductRow>[]) : []),
  ];

  return (
    <>
      <PageHeader
        title="Products"
        description="Manage your product catalog."
        action={isAdmin ? (
          <Button onClick={() => { setEditProduct(null); setSheetOpen(true); }}>
            <Plus className="size-4" aria-hidden="true" />
            New Product
          </Button>
        ) : undefined}
      />

      <DataTable
        columns={columns}
        data={products}
        isLoading={isLoading}
        error={fetchError}
        searchKey="name"
        searchPlaceholder="Search by name…"
        emptyTitle="No products yet"
        emptyDescription={isAdmin ? "Add your first product using the button above." : "No products have been added to the catalog yet."}
        fuzzyValues={productNames}
      />

      {isAdmin && (
        <ProductSheet
          open={sheetOpen}
          onClose={() => setSheetOpen(false)}
          editProduct={editProduct}
          onSuccess={fetchProducts}
          categories={categories}
          onAddCategory={handleAddCategory}
        />
      )}

      {isAdmin && deleteTarget && (
        <ConfirmDialog
          open={!!deleteTarget}
          onOpenChange={(v) => { if (!v) setDeleteTarget(null); }}
          title="Delete product?"
          description={`"${deleteTarget.name}" will be permanently deleted. This cannot be undone.`}
          confirmLabel="Delete"
          destructive
          onConfirm={handleDelete}
          isLoading={isDeleting}
        />
      )}

      {/* Critical error modal for delete failures */}
      <ErrorModal
        open={!!deleteError}
        onClose={() => setDeleteError(null)}
        title="Could not delete product"
        message={deleteError ?? ""}
        actionLabel="Try again"
        onAction={handleDelete}
      />
    </>
  );
}
