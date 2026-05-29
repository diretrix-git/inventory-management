"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Search, Plus, Minus, Trash2, Loader2, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { IProduct } from "@/types";

// ─── Types ────────────────────────────────────────────────────────────────────

type ProductResult = Pick<IProduct, "name" | "sku" | "price" | "quantity"> & { _id: string };

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
  notes: z.string().optional(),
});

type OrderFormValues = z.infer<typeof orderFormSchema>;

// ─── OrderForm ────────────────────────────────────────────────────────────────

export function OrderForm({ onSuccess, onCancel }: OrderFormProps) {
  const [cart, setCart] = useState<CartLine[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ProductResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [taxRate, setTaxRate] = useState(0); // stored as 0-100
  const searchRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<OrderFormValues>({
    resolver: zodResolver(orderFormSchema) as import("react-hook-form").Resolver<OrderFormValues>,
    defaultValues: { customerName: "", notes: "" },
  });

  // Fetch tax rate from settings on mount
  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        if (data?.settings?.taxRate !== undefined) {
          setTaxRate(data.settings.taxRate);
        }
      })
      .catch(() => {/* settings unavailable, use 0 */});
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Debounced product search (300ms)
  const searchProducts = useCallback((query: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) { setSearchResults([]); setShowDropdown(false); return; }

    debounceRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch("/api/products");
        if (!res.ok) return;
        const data = await res.json();
        const q = query.toLowerCase();
        const filtered = (data.products as ProductResult[]).filter(
          (p) =>
            p.name.toLowerCase().includes(q) ||
            p.sku.toLowerCase().includes(q)
        ).slice(0, 8);
        setSearchResults(filtered);
        setShowDropdown(filtered.length > 0);
      } catch {
        // silent
      } finally {
        setIsSearching(false);
      }
    }, 300);
  }, []);

  useEffect(() => {
    searchProducts(searchQuery);
  }, [searchQuery, searchProducts]);

  // Add product to cart (or increment if already present)
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
      return [
        ...prev,
        {
          productId: product._id,
          productName: product.name,
          sku: product.sku,
          unitPrice: product.price,
          quantity: 1,
          availableQty: product.quantity,
        },
      ];
    });
    setSearchQuery("");
    setShowDropdown(false);
  }

  function updateQty(productId: string, delta: number) {
    setCart((prev) =>
      prev
        .map((l) =>
          l.productId === productId
            ? { ...l, quantity: Math.max(0, Math.min(l.quantity + delta, l.availableQty)) }
            : l
        )
        .filter((l) => l.quantity > 0)
    );
  }

  function removeFromCart(productId: string) {
    setCart((prev) => prev.filter((l) => l.productId !== productId));
  }

  // Totals
  const subtotal = cart.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);
  const taxAmount = Math.round(subtotal * (taxRate / 100) * 100) / 100;
  const totalAmount = Math.round((subtotal + taxAmount) * 100) / 100;

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
          notes: data.notes,
          items: cart.map((l) => ({ productId: l.productId, quantity: l.quantity })),
        }),
      });
      const json = await res.json();
      if (!res.ok) { toast.error(json.error ?? "Failed to create order"); return; }
      toast.success(`Order ${json.order.orderNumber} created`);
      onSuccess();
    } catch {
      toast.error("Network error — please try again");
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
      {/* Customer name */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="order-customer">
          Customer Name <span className="text-destructive" aria-hidden="true">*</span>
        </Label>
        <Input
          id="order-customer"
          type="text"
          placeholder="Customer full name"
          aria-invalid={!!errors.customerName}
          {...register("customerName")}
        />
        {errors.customerName && (
          <p className="text-xs text-destructive">{errors.customerName.message}</p>
        )}
      </div>

      {/* Product search */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="order-search">Add Products</Label>
        <div className="relative" ref={searchRef}>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" aria-hidden="true" />
            <input
              id="order-search"
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => searchResults.length > 0 && setShowDropdown(true)}
              placeholder="Search by name or SKU…"
              className="h-8 w-full rounded-lg border border-input bg-background pl-8 pr-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              autoComplete="off"
            />
            {isSearching && (
              <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 size-4 animate-spin text-muted-foreground" aria-hidden="true" />
            )}
          </div>

          {/* Dropdown results */}
          {showDropdown && (
            <div className="absolute left-0 right-0 top-full mt-1 z-20 rounded-lg border border-border bg-popover shadow-md overflow-hidden">
              {searchResults.map((p) => (
                <button
                  key={p._id}
                  type="button"
                  onClick={() => addToCart(p)}
                  className="flex w-full items-center justify-between px-3 py-2 text-sm hover:bg-muted transition-colors text-left"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-foreground truncate">{p.name}</p>
                    <p className="text-xs text-muted-foreground font-mono">{p.sku}</p>
                  </div>
                  <div className="text-right ml-3 flex-shrink-0">
                    <p className="font-mono text-sm">${p.price.toFixed(2)}</p>
                    <p className={cn("text-xs", p.quantity <= 0 ? "text-destructive" : "text-muted-foreground")}>
                      {p.quantity} in stock
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Cart */}
      {cart.length > 0 ? (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Cart</p>
          <div className="rounded-lg border border-border overflow-hidden">
            {cart.map((line) => (
              <div key={line.productId} className="flex items-center gap-3 px-3 py-2.5 border-b border-border last:border-0 bg-card">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground truncate">{line.productName}</p>
                  <p className="text-xs text-muted-foreground font-mono">{line.sku} · ${line.unitPrice.toFixed(2)} each</p>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <Button type="button" variant="outline" size="icon-xs" onClick={() => updateQty(line.productId, -1)} aria-label="Decrease quantity">
                    <Minus className="size-3" aria-hidden="true" />
                  </Button>
                  <span className="font-mono text-sm tabular-nums w-8 text-center">{line.quantity}</span>
                  <Button type="button" variant="outline" size="icon-xs" onClick={() => updateQty(line.productId, 1)} disabled={line.quantity >= line.availableQty} aria-label="Increase quantity">
                    <Plus className="size-3" aria-hidden="true" />
                  </Button>
                  <Button type="button" variant="ghost" size="icon-xs" onClick={() => removeFromCart(line.productId)} aria-label={`Remove ${line.productName}`} className="text-destructive hover:text-destructive hover:bg-destructive/10 ml-1">
                    <Trash2 className="size-3" aria-hidden="true" />
                  </Button>
                </div>
                <span className="font-mono text-sm tabular-nums w-20 text-right flex-shrink-0">
                  ${(line.unitPrice * line.quantity).toFixed(2)}
                </span>
              </div>
            ))}
          </div>

          {/* Totals */}
          <div className="rounded-lg border border-border bg-muted/40 px-3 py-3 flex flex-col gap-1.5 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>Subtotal</span>
              <span className="font-mono tabular-nums">${subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Tax ({taxRate}%)</span>
              <span className="font-mono tabular-nums">${taxAmount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-semibold text-foreground border-t border-border pt-1.5 mt-0.5">
              <span>Total</span>
              <span className="font-mono tabular-nums">${totalAmount.toFixed(2)}</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-8 rounded-lg border border-dashed border-border text-center">
          <ShoppingCart className="size-8 text-muted-foreground mb-2" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">No products added yet</p>
          <p className="text-xs text-muted-foreground">Search above to add products</p>
        </div>
      )}

      {/* Notes */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="order-notes">Notes</Label>
        <textarea
          id="order-notes"
          rows={2}
          placeholder="Optional order notes"
          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
          {...register("notes")}
        />
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>Cancel</Button>
        <Button type="submit" disabled={isSubmitting || cart.length === 0} aria-busy={isSubmitting}>
          {isSubmitting ? (
            <><Loader2 className="size-4 animate-spin" aria-hidden="true" />Creating…</>
          ) : (
            "Create Order"
          )}
        </Button>
      </div>
    </form>
  );
}
