"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Search, Plus, Minus, Trash2, Loader2, ShoppingCart, LayoutGrid, List, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { friendlyError } from "@/lib/errors";
import type { IProduct } from "@/types";

// ─── Types ────────────────────────────────────────────────────────────────────

type ProductResult = Pick<IProduct, "name" | "sku" | "price" | "quantity" | "category" | "imageUrl"> & { _id: string };

interface CartLine {
  productId: string;
  productName: string;
  sku: string;
  unitPrice: number;
  quantity: number;
  availableQty: number;
}

interface OrderFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

// ─── Zod schema ───────────────────────────────────────────────────────────────

const orderFormSchema = z.object({
  customerName: z
    .string()
    .min(1, "Customer name is required")
    .max(200, "Customer name too long")
    .refine((v) => v.trim().length > 0, "Customer name cannot be whitespace only"),
  customerEmail: z.string().email("Invalid email").optional().or(z.literal("")),
  notes: z.string().optional(),
});

type OrderFormValues = z.infer<typeof orderFormSchema>;

// ─── Product card ─────────────────────────────────────────────────────────────

function ProductCard({
  product,
  cartQty,
  onAdd,
  onRemove,
}: {
  product: ProductResult;
  cartQty: number;
  onAdd: () => void;
  onRemove: () => void;
}) {
  const outOfStock = product.quantity <= 0;
  const atMax = cartQty >= product.quantity;

  return (
    <div
      className={cn(
        "relative flex flex-col rounded-xl border bg-card overflow-hidden transition-shadow hover:shadow-md",
        outOfStock ? "opacity-60 border-border" : "border-border",
        cartQty > 0 && "ring-2 ring-primary"
      )}
    >
      {/* Image / placeholder */}
      <div className="aspect-video bg-muted flex items-center justify-center overflow-hidden">
        {product.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
        ) : (
          <Package className="size-8 text-muted-foreground" aria-hidden="true" />
        )}
      </div>

      {/* Info */}
      <div className="flex flex-col gap-1 p-3 flex-1">
        <p className="text-sm font-medium text-foreground leading-tight line-clamp-2">{product.name}</p>
        <p className="font-mono text-xs text-muted-foreground">{product.sku}</p>
        {product.category && (
          <span className="inline-flex w-fit items-center rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            {product.category}
          </span>
        )}
        <div className="flex items-center justify-between mt-auto pt-2">
          <span className="font-mono text-sm font-semibold">Rs {product.price.toFixed(2)}</span>
          <span className={cn("text-xs", outOfStock ? "text-destructive" : product.quantity <= 5 ? "text-warning" : "text-muted-foreground")}>
            {outOfStock ? "Out of stock" : `${product.quantity} left`}
          </span>
        </div>
      </div>

      {/* Cart controls */}
      {cartQty === 0 ? (
        <button
          type="button"
          onClick={onAdd}
          disabled={outOfStock}
          className={cn(
            "mx-3 mb-3 flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-medium transition-colors",
            outOfStock
              ? "bg-muted text-muted-foreground cursor-not-allowed"
              : "bg-primary text-primary-foreground hover:opacity-90"
          )}
          aria-label={`Add ${product.name} to cart`}
        >
          <Plus className="size-3.5" aria-hidden="true" />
          Add to order
        </button>
      ) : (
        <div className="mx-3 mb-3 flex items-center justify-between gap-2">
          <Button type="button" variant="outline" size="icon-xs" onClick={onRemove} aria-label="Decrease quantity">
            <Minus className="size-3" aria-hidden="true" />
          </Button>
          <span className="font-mono text-sm tabular-nums font-semibold flex-1 text-center">{cartQty}</span>
          <Button type="button" variant="outline" size="icon-xs" onClick={onAdd} disabled={atMax} aria-label="Increase quantity">
            <Plus className="size-3" aria-hidden="true" />
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── OrderForm ────────────────────────────────────────────────────────────────

export function OrderForm({ onSuccess, onCancel }: OrderFormProps) {
  const [allProducts, setAllProducts] = useState<ProductResult[]>([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [taxRate, setTaxRate] = useState(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<OrderFormValues>({
    resolver: zodResolver(orderFormSchema) as import("react-hook-form").Resolver<OrderFormValues>,
    defaultValues: { customerName: "", customerEmail: "", notes: "" },
  });

  // Load all products + settings on mount
  useEffect(() => {
    Promise.all([
      fetch("/api/products").then((r) => r.json()),
      fetch("/api/settings").then((r) => r.json()),
    ]).then(([prodData, settingsData]) => {
      if (prodData.products) {
        setAllProducts((prodData.products as ProductResult[]).map((p) => ({ ...p, _id: String(p._id) })));
      }
      if (settingsData?.settings?.taxRate !== undefined) {
        setTaxRate(settingsData.settings.taxRate);
      }
    }).catch(() => toast.error("Failed to load products"))
      .finally(() => setIsLoadingProducts(false));
  }, []);

  // Derived: filtered products
  const filteredProducts = allProducts.filter((p) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = !q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q);
    const matchesCategory = !selectedCategory || p.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // All unique categories
  const categories = [...new Set(allProducts.map((p) => p.category).filter(Boolean))] as string[];

  // Cart helpers
  function getCartQty(productId: string) {
    return cart.find((l) => l.productId === productId)?.quantity ?? 0;
  }

  function addToCart(product: ProductResult) {
    setCart((prev) => {
      const existing = prev.find((l) => l.productId === product._id);
      if (existing) {
        return prev.map((l) =>
          l.productId === product._id
            ? { ...l, quantity: Math.min(l.quantity + 1, l.availableQty) }
            : l
        );
      }
      return [...prev, {
        productId: product._id,
        productName: product.name,
        sku: product.sku,
        unitPrice: product.price,
        quantity: 1,
        availableQty: product.quantity,
      }];
    });
  }

  function removeFromCart(productId: string) {
    setCart((prev) =>
      prev.map((l) => l.productId === productId ? { ...l, quantity: Math.max(0, l.quantity - 1) } : l)
          .filter((l) => l.quantity > 0)
    );
  }

  function deleteFromCart(productId: string) {
    setCart((prev) => prev.filter((l) => l.productId !== productId));
  }

  // Totals
  const subtotal = cart.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);
  const taxAmount = Math.round(subtotal * (taxRate / 100) * 100) / 100;
  const totalAmount = Math.round((subtotal + taxAmount) * 100) / 100;
  const totalItems = cart.reduce((sum, l) => sum + l.quantity, 0);

  async function onSubmit(data: OrderFormValues) {
    if (cart.length === 0) {
      toast.error("Add at least one product to the order");
      return;
    }
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: data.customerName.trim(),
          customerEmail: data.customerEmail?.trim() || undefined,
          notes: data.notes,
          items: cart.map((l) => ({ productId: l.productId, quantity: l.quantity })),
        }),
      });
      const json = await res.json();
      if (!res.ok) { toast.error(friendlyError(json.error)); return; }

      if (json.requiresApproval) {
        toast.warning(`Order submitted for admin approval — total ≥ ₹15,000. Stock will be reserved once approved.`, { duration: 6000 });
      } else {
        toast.success(`Order ${json.order.orderNumber} confirmed automatically.`);
      }

      // Broadcast to admin dashboard (same-origin tabs via BroadcastChannel)
      try {
        const channel = new BroadcastChannel("order_notifications");
        channel.postMessage({
          type: "ORDER_CREATED",
          orderNumber: json.order.orderNumber,
          customerName: data.customerName.trim(),
          totalAmount: json.order.totalAmount,
        });
        channel.close();
      } catch {
        // BroadcastChannel not supported — silent fail
      }

      onSuccess();
    } catch {
      toast.error("Network error — please try again");
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
      {/* Customer info */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="order-customer">
            Customer Name <span className="text-destructive" aria-hidden="true">*</span>
          </Label>
          <Input id="order-customer" type="text" placeholder="Full name" aria-invalid={!!errors.customerName} {...register("customerName")} />
          {errors.customerName && <p className="text-xs text-destructive">{errors.customerName.message}</p>}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="order-email">Customer Email <span className="text-xs text-muted-foreground font-normal">(for invoice)</span></Label>
          <Input id="order-email" type="email" placeholder="customer@example.com" aria-invalid={!!errors.customerEmail} {...register("customerEmail")} />
          {errors.customerEmail && <p className="text-xs text-destructive">{errors.customerEmail.message}</p>}
        </div>
      </div>

      {/* Product browser */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium text-foreground">
            Products
            {totalItems > 0 && (
              <span className="ml-2 inline-flex items-center justify-center size-5 rounded-full bg-primary text-primary-foreground text-xs font-semibold">
                {totalItems}
              </span>
            )}
          </p>
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => setViewMode("grid")} aria-label="Grid view"
              className={cn("inline-flex items-center justify-center size-7 rounded-md transition-colors", viewMode === "grid" ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground")}>
              <LayoutGrid className="size-3.5" aria-hidden="true" />
            </button>
            <button type="button" onClick={() => setViewMode("list")} aria-label="List view"
              className={cn("inline-flex items-center justify-center size-7 rounded-md transition-colors", viewMode === "list" ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground")}>
              <List className="size-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Search + category filter */}
        <div className="flex gap-2 flex-wrap">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" aria-hidden="true" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => {
                if (debounceRef.current) clearTimeout(debounceRef.current);
                debounceRef.current = setTimeout(() => setSearchQuery(e.target.value), 200);
                // Update immediately for responsiveness
                setSearchQuery(e.target.value);
              }}
              placeholder="Search by name or SKU…"
              className="h-8 w-full rounded-lg border border-input bg-background pl-8 pr-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          {categories.length > 0 && (
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Filter by category"
            >
              <option value="">All categories</option>
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          )}
        </div>

        {/* Product grid/list */}
        {isLoadingProducts ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="size-6 animate-spin text-muted-foreground" aria-label="Loading products" />
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 rounded-lg border border-dashed border-border text-center">
            <Package className="size-8 text-muted-foreground mb-2" aria-hidden="true" />
            <p className="text-sm text-muted-foreground">No products found</p>
            {searchQuery && <p className="text-xs text-muted-foreground">Try a different search term</p>}
          </div>
        ) : viewMode === "grid" ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-72 overflow-y-auto pr-1">
            {filteredProducts.map((p) => (
              <ProductCard
                key={p._id}
                product={p}
                cartQty={getCartQty(p._id)}
                onAdd={() => addToCart(p)}
                onRemove={() => removeFromCart(p._id)}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col divide-y divide-border rounded-xl border border-border overflow-hidden max-h-72 overflow-y-auto">
            {filteredProducts.map((p) => {
              const qty = getCartQty(p._id);
              const outOfStock = p.quantity <= 0;
              return (
                <div key={p._id} className={cn("flex items-center gap-3 px-3 py-2.5 bg-card", qty > 0 && "bg-primary/5")}>
                  <div className="size-9 rounded-md overflow-hidden border border-border bg-muted flex-shrink-0 flex items-center justify-center">
                    {p.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.imageUrl} alt={p.name} className="size-9 object-cover" />
                    ) : (
                      <Package className="size-4 text-muted-foreground" aria-hidden="true" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">{p.name}</p>
                    <p className="font-mono text-xs text-muted-foreground">{p.sku} · Rs {p.price.toFixed(2)}</p>
                  </div>
                  <span className={cn("text-xs flex-shrink-0", outOfStock ? "text-destructive" : "text-muted-foreground")}>
                    {outOfStock ? "Out" : `${p.quantity}`}
                  </span>
                  {qty === 0 ? (
                    <Button type="button" size="icon-xs" onClick={() => addToCart(p)} disabled={outOfStock} aria-label={`Add ${p.name}`}>
                      <Plus className="size-3" aria-hidden="true" />
                    </Button>
                  ) : (
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <Button type="button" variant="outline" size="icon-xs" onClick={() => removeFromCart(p._id)} aria-label="Decrease">
                        <Minus className="size-3" aria-hidden="true" />
                      </Button>
                      <span className="font-mono text-xs w-5 text-center">{qty}</span>
                      <Button type="button" variant="outline" size="icon-xs" onClick={() => addToCart(p)} disabled={qty >= p.quantity} aria-label="Increase">
                        <Plus className="size-3" aria-hidden="true" />
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Cart summary */}
      {cart.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Order Summary</p>
          <div className="rounded-lg border border-border overflow-hidden">
            {cart.map((line) => (
              <div key={line.productId} className="flex items-center gap-3 px-3 py-2 border-b border-border last:border-0 bg-card">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground truncate">{line.productName}</p>
                  <p className="text-xs text-muted-foreground font-mono">{line.sku}</p>
                </div>
                <span className="font-mono text-xs text-muted-foreground flex-shrink-0">×{line.quantity}</span>
                <span className="font-mono text-sm tabular-nums flex-shrink-0">Rs {(line.unitPrice * line.quantity).toFixed(2)}</span>
                <button type="button" onClick={() => deleteFromCart(line.productId)} aria-label={`Remove ${line.productName}`}
                  className="text-muted-foreground hover:text-destructive transition-colors flex-shrink-0">
                  <Trash2 className="size-3.5" aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>
          <div className="rounded-lg border border-border bg-muted/40 px-3 py-3 flex flex-col gap-1.5 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>Subtotal</span>
              <span className="font-mono tabular-nums">Rs {subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Tax ({taxRate}%)</span>
              <span className="font-mono tabular-nums">Rs {taxAmount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-semibold text-foreground border-t border-border pt-1.5 mt-0.5">
              <span>Total</span>
              <span className="font-mono tabular-nums">Rs {totalAmount.toFixed(2)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Notes */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="order-notes">Notes</Label>
        <textarea id="order-notes" rows={2} placeholder="Optional order notes"
          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
          {...register("notes")} />
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>Cancel</Button>
        <Button type="submit" disabled={isSubmitting || cart.length === 0} aria-busy={isSubmitting}>
          {isSubmitting ? <><Loader2 className="size-4 animate-spin" aria-hidden="true" />Creating…</> : `Create Order${totalItems > 0 ? ` (${totalItems} item${totalItems > 1 ? "s" : ""})` : ""}`}
        </Button>
      </div>
    </form>
  );
}
