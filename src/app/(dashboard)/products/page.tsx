"use client";

import { useEffect, useState, useCallback } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, X, Loader2, AlertTriangle, Package, SlidersHorizontal } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";

import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { ErrorModal } from "@/components/shared/ErrorModal";
import { ViewModal } from "@/components/shared/ViewModal";
import { CloudinaryUpload } from "@/components/shared/CloudinaryUpload";
import { CategorySelect } from "@/components/shared/CategorySelect";
import { SupplierSelect } from "@/components/shared/SupplierSelect";
import { Tooltip } from "@/components/shared/Tooltip";
import { CsvImport } from "@/components/products/CsvImport";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRole } from "@/components/providers/RoleProvider";
import { cn } from "@/lib/utils";
import { friendlyError } from "@/lib/errors";
import type { IProduct } from "@/types";

// ─── Types ────────────────────────────────────────────────────────────────────

type ProductRow = Omit<IProduct, "_id"> & { _id: string; isLowStock?: boolean; supplierName?: string | null };

// ─── Zod schema ───────────────────────────────────────────────────────────────

const productSchema = z.object({
  name: z.string().min(1, "Name is required").max(200, "Name too long"),
  sku: z.string().max(50, "SKU too long").optional(),
  category: z.string().min(1, "Category is required").max(100, "Category too long"),
  description: z.string().optional(),
  price: z.preprocess((v) => parseFloat(String(v)), z.number().min(0, "Price must be ≥ 0")),
  quantity: z.preprocess((v) => parseInt(String(v), 10), z.number().int("Must be a whole number").min(0, "Quantity must be ≥ 0")),
  lowStockThreshold: z.preprocess((v) => parseInt(String(v), 10), z.number().int("Must be a whole number").min(0, "Must be ≥ 0")),
  supplierId: z.string().min(1, "Supplier is required"),
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
        price: data.price,
        quantity: data.quantity,
        lowStockThreshold: data.lowStockThreshold,
      };
      // Only include SKU on create (and only if provided — otherwise API auto-generates)
      if (!isEdit && data.sku?.trim()) body.sku = data.sku.toUpperCase();
      if (data.category) body.category = data.category;
      if (data.description) body.description = data.description;
      if (data.supplierId) body.supplierId = data.supplierId;
      if (imageUrl) body.imageUrl = imageUrl;

      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const json = await res.json();
      if (!res.ok) { toast.error(friendlyError(json.error)); return; }
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

          {/* SKU — optional on create, read-only on edit */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="p-sku">
              SKU{" "}
              {isEdit ? (
                <span className="ml-1.5 text-xs font-normal text-muted-foreground">(cannot be changed after creation)</span>
              ) : (
                <span className="ml-1.5 text-xs font-normal text-muted-foreground">(leave blank to auto-generate)</span>
              )}
            </Label>
            <Input
              id="p-sku"
              type="text"
              placeholder={isEdit ? editProduct.sku ?? "Auto-generated" : "e.g. PROD-001 or leave blank"}
              aria-invalid={!!errors.sku}
              {...register("sku")}
              readOnly={isEdit}
              className={isEdit ? "font-mono bg-muted cursor-not-allowed opacity-70" : "font-mono uppercase"}
            />
            {errors.sku && <p className="text-xs text-destructive">{errors.sku.message}</p>}
          </div>

          {/* Category — dropdown with add new */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="p-category">Category <span className="text-destructive" aria-hidden="true">*</span></Label>
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
            {errors.category && <p className="text-xs text-destructive">{errors.category.message}</p>}
          </div>

          {/* Supplier — searchable dropdown with inline add */}
          <div className="flex flex-col gap-1.5">
            <Label>Supplier <span className="text-destructive" aria-hidden="true">*</span></Label>
            <Controller
              name="supplierId"
              control={control}
              render={({ field }) => (
                <SupplierSelect
                  value={field.value ?? ""}
                  onChange={field.onChange}
                />
              )}
            />
            {errors.supplierId && <p className="text-xs text-destructive">{errors.supplierId.message}</p>}
            <p className="text-xs text-muted-foreground">Can&apos;t find your supplier? Add a new one inline from the dropdown.</p>
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
            <Label htmlFor="p-threshold">Low Stock Threshold <span className="text-xs font-normal text-muted-foreground">(optional)</span></Label>
            <Input id="p-threshold" type="number" min="0" step="1" placeholder="10" {...register("lowStockThreshold")} />
          </div>

          {/* Description */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="p-desc">Description <span className="text-xs font-normal text-muted-foreground">(optional)</span></Label>
            <textarea id="p-desc" rows={3} placeholder="Optional description"
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
              {...register("description")} />
          </div>

          {/* Product image */}
          <div className="flex flex-col gap-1.5">
            <Label>Product Image <span className="text-xs font-normal text-muted-foreground">(optional)</span></Label>
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
  const [viewProduct, setViewProduct] = useState<ProductRow | null>(null);
  // Filters
  const [filterCategory, setFilterCategory] = useState("");
  const [filterMinPrice, setFilterMinPrice] = useState("");
  const [filterMaxPrice, setFilterMaxPrice] = useState("");
  const [filterStock, setFilterStock] = useState<"all" | "low" | "ok">("all");

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
        setFetchError(friendlyError(json.error));
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
        setDeleteError(friendlyError(json.error));
        return;
      }
      toast.success("Product deleted");
      setDeleteTarget(null);
      await fetchProducts();
    } catch {
      setDeleteError(friendlyError("network"));
    } finally {
      setIsDeleting(false);
    }
  }

  // All product names for fuzzy search suggestions
  const productNames = products.map((p) => p.name);

  // Apply filters
  const filteredProducts = products.filter((p) => {
    if (filterCategory && p.category !== filterCategory) return false;
    if (filterMinPrice && p.price < parseFloat(filterMinPrice)) return false;
    if (filterMaxPrice && p.price > parseFloat(filterMaxPrice)) return false;
    if (filterStock === "low" && !p.isLowStock) return false;
    if (filterStock === "ok" && p.isLowStock) return false;
    return true;
  });

  const hasActiveFilters = filterCategory || filterMinPrice || filterMaxPrice || filterStock !== "all";

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
      cell: ({ row }) => (
        <span className="font-mono text-xs text-muted-foreground tabular-nums">
          {row.original.sku ?? <span className="italic text-muted-foreground/50">—</span>}
        </span>
      ),
    },
    {
      accessorKey: "category",
      header: "Category",
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {row.original.category ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setFilterCategory(
                  filterCategory === row.original.category ? "" : (row.original.category ?? "")
                );
              }}
              className={cn(
                "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium transition-colors",
                filterCategory === row.original.category
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted hover:bg-primary/10 hover:text-primary cursor-pointer"
              )}
              title={filterCategory === row.original.category ? "Click to clear filter" : `Filter by "${row.original.category}"`}
            >
              {row.original.category}
            </button>
          ) : "—"}
        </span>
      ),
    },
    {
      id: "supplier",
      header: "Supplier",
      cell: ({ row }) => (
        <span className="text-muted-foreground text-sm">
          {row.original.supplierName ?? "—"}
        </span>
      ),
    },
    {
      accessorKey: "price",
      header: "Unit Price",
      cell: ({ row }) => <span className="font-mono text-sm tabular-nums">Rs {row.original.price.toFixed(2)}</span>,
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
          <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
            <Tooltip content="Edit product">
              <Button variant="ghost" size="icon-sm" onClick={() => { setEditProduct(p); setSheetOpen(true); }} aria-label={`Edit ${p.name}`}>
                <Pencil className="size-3.5" aria-hidden="true" />
              </Button>
            </Tooltip>
            <Tooltip content="Delete product">
              <Button variant="ghost" size="icon-sm" onClick={() => setDeleteTarget(p)} aria-label={`Delete ${p.name}`} className="text-destructive hover:text-destructive hover:bg-destructive/10">
                <Trash2 className="size-3.5" aria-hidden="true" />
              </Button>
            </Tooltip>
          </div>
        );
      },
    }] as ColumnDef<ProductRow>[]) : []),
  ];

  return (
    <>
      <PageHeader
        title="Products"
        description="Manage your product catalog. Price filters apply as you type."
        action={isAdmin ? (
          <div className="flex items-center gap-2">
            <CsvImport onSuccess={fetchProducts} />
            <Button onClick={() => { setEditProduct(null); setSheetOpen(true); }}>
              <Plus className="size-4" aria-hidden="true" />
              New Product
            </Button>
          </div>
        ) : undefined}
      />

      {/* Filters bar */}
      <div className="flex flex-wrap items-center gap-3 mb-4 p-3 rounded-xl border border-border bg-card">
        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground flex-shrink-0">
          <SlidersHorizontal className="size-3.5" aria-hidden="true" />
          Filters
        </div>

        {/* Category filter */}
        {categories.length > 0 && (
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className={cn(
              "h-7 rounded-md border border-input bg-background px-2.5 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              filterCategory && "border-primary text-primary font-medium"
            )}
            aria-label="Filter by category"
          >
            <option value="">All categories</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        )}

        {/* Price range */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Price</span>
          <input
            type="number" min="0" step="0.01" placeholder="Min"
            value={filterMinPrice}
            onChange={(e) => setFilterMinPrice(e.target.value)}
            onBlur={(e) => setFilterMinPrice(e.target.value)}
            className="h-7 w-20 rounded-md border border-input bg-background px-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Minimum price"
          />
          <span className="text-xs text-muted-foreground">–</span>
          <input
            type="number" min="0" step="0.01" placeholder="Max"
            value={filterMaxPrice}
            onChange={(e) => setFilterMaxPrice(e.target.value)}
            onBlur={(e) => setFilterMaxPrice(e.target.value)}
            className="h-7 w-20 rounded-md border border-input bg-background px-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Maximum price"
          />
          <span className="text-xs text-muted-foreground/60 hidden sm:inline">applies on change</span>
        </div>

        {/* Stock status filter */}
        <select
          value={filterStock}
          onChange={(e) => setFilterStock(e.target.value as "all" | "low" | "ok")}
          className="h-7 rounded-md border border-input bg-background px-2.5 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Filter by stock status"
        >
          <option value="all">All stock</option>
          <option value="low">Low stock only</option>
          <option value="ok">In stock only</option>
        </select>

        {/* Clear filters */}
        {hasActiveFilters && (
          <button
            type="button"
            onClick={() => { setFilterCategory(""); setFilterMinPrice(""); setFilterMaxPrice(""); setFilterStock("all"); }}
            className="text-xs text-primary hover:underline underline-offset-2"
          >
            Clear filters
          </button>
        )}

        {hasActiveFilters && (
          <span className="text-xs text-muted-foreground ml-auto">
            {filteredProducts.length} of {products.length} products
          </span>
        )}
      </div>

      <DataTable
        columns={columns}
        data={filteredProducts}
        isLoading={isLoading}
        error={fetchError}
        searchKey="name"
        searchPlaceholder="Search by name…"
        emptyTitle="No products yet"
        emptyDescription={isAdmin ? "Add your first product using the button above." : "No products have been added to the catalog yet."}
        fuzzyValues={productNames}
        onRowClick={(p) => setViewProduct(p)}
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

      {/* Product view modal — opens on row click */}
      <ViewModal
        open={!!viewProduct}
        onClose={() => setViewProduct(null)}
        title="Product Details"
        footer={
          <>
            {isAdmin && viewProduct && (
              <Button variant="outline" onClick={() => { setViewProduct(null); setEditProduct(viewProduct); setSheetOpen(true); }}>
                <Pencil className="size-3.5 mr-1.5" aria-hidden="true" />Edit
              </Button>
            )}
            <Button variant="outline" onClick={() => setViewProduct(null)}>Close</Button>
          </>
        }
      >
        {viewProduct && (
          <div className="flex flex-col gap-4">
            {viewProduct.imageUrl && (
              <div className="aspect-video rounded-lg overflow-hidden border border-border bg-muted">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={viewProduct.imageUrl} alt={viewProduct.name} className="w-full h-full object-cover" />
              </div>
            )}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><p className="text-xs text-muted-foreground mb-0.5">Name</p><p className="font-medium">{viewProduct.name}</p></div>
              <div><p className="text-xs text-muted-foreground mb-0.5">SKU</p>
                <p className="font-mono text-sm">
                  {viewProduct.sku
                    ? <span>{viewProduct.sku}</span>
                    : <span className="text-muted-foreground italic text-xs">Auto-generated on save</span>
                  }
                </p>
              </div>
              <div><p className="text-xs text-muted-foreground mb-0.5">Category</p><p>{viewProduct.category ?? "—"}</p></div>
              <div><p className="text-xs text-muted-foreground mb-0.5">Supplier</p><p>{viewProduct.supplierName ?? "—"}</p></div>
              <div><p className="text-xs text-muted-foreground mb-0.5">Price</p><p className="font-mono">Rs {viewProduct.price.toFixed(2)}</p></div>
              <div><p className="text-xs text-muted-foreground mb-0.5">Stock</p><p className="font-mono">{viewProduct.quantity}</p></div>
              <div><p className="text-xs text-muted-foreground mb-0.5">Low Stock Threshold</p><p className="font-mono">{viewProduct.lowStockThreshold}</p></div>
              <div className="col-span-2">
                <p className="text-xs text-muted-foreground mb-0.5">Status</p>
                {viewProduct.isLowStock ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-warning/30 bg-warning/15 px-2.5 py-0.5 text-xs font-medium text-warning">
                    <AlertTriangle className="size-3" aria-hidden="true" />Low Stock
                  </span>
                ) : <StatusBadge status="active" />}
              </div>
              {viewProduct.description && (
                <div className="col-span-2"><p className="text-xs text-muted-foreground mb-0.5">Description</p><p className="text-sm text-muted-foreground">{viewProduct.description}</p></div>
              )}
            </div>
          </div>
        )}
      </ViewModal>
    </>
  );
}
