"use client";

import { useEffect, useState, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Plus, Tag, Loader2 } from "lucide-react";
import { PageTransition } from "@/components/shared/PageTransition";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const categorySchema = z.object({
  name: z.string().min(1, "Category name is required").max(100, "Too long"),
});
type CategoryFormValues = z.infer<typeof categorySchema>;

export default function CategoriesPage() {
  const [categories, setCategories] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [productCounts, setProductCounts] = useState<Record<string, number>>({});

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CategoryFormValues>({
    resolver: zodResolver(categorySchema),
    defaultValues: { name: "" },
  });

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [catRes, prodRes] = await Promise.all([
        fetch("/api/categories"),
        fetch("/api/products"),
      ]);
      const catJson = await catRes.json();
      const prodJson = await prodRes.json();

      const cats: string[] = catJson.categories ?? [];
      setCategories(cats);

      // Count products per category
      const counts: Record<string, number> = {};
      if (prodJson.products) {
        for (const p of prodJson.products as { category?: string }[]) {
          if (p.category) counts[p.category] = (counts[p.category] ?? 0) + 1;
        }
      }
      setProductCounts(counts);
    } catch {
      toast.error("Failed to load categories");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function onSubmit(data: CategoryFormValues) {
    const trimmed = data.name.trim();
    if (categories.includes(trimmed)) {
      toast.error(`Category "${trimmed}" already exists`);
      return;
    }
    // Categories are created by adding a product with that category.
    // Here we just add it to the local list — it will persist once a product uses it.
    // For a proper implementation, we'd have a Category collection.
    // For now, we create a placeholder product-less category by storing it in settings or
    // simply show it as a UI-only addition until a product is assigned.
    setCategories((prev) => [...new Set([...prev, trimmed])].sort());
    toast.success(`Category "${trimmed}" added. Assign it to products to persist it.`);
    reset();
  }

  return (
    <PageTransition>
      <PageHeader
        title="Categories"
        description="Manage product categories. Categories persist once assigned to a product."
      />

      <div className="mx-auto max-w-2xl space-y-6">
        {/* Add category form */}
        <section className="rounded-xl border border-border bg-card p-6">
          <h2 className="text-base font-semibold text-foreground mb-4">Add New Category</h2>
          <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex gap-3">
            <div className="flex-1 flex flex-col gap-1.5">
              <Label htmlFor="cat-name" className="sr-only">Category name</Label>
              <Input
                id="cat-name"
                type="text"
                placeholder="e.g. Electronics, Furniture, Clothing…"
                aria-invalid={!!errors.name}
                {...register("name")}
              />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>
            <Button type="submit" disabled={isSubmitting} aria-busy={isSubmitting}>
              {isSubmitting ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <><Plus className="size-4" aria-hidden="true" />Add</>
              )}
            </Button>
          </form>
        </section>

        {/* Category list */}
        <section className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <h2 className="text-base font-semibold text-foreground">
              All Categories
              <span className="ml-2 text-sm font-normal text-muted-foreground">({categories.length})</span>
            </h2>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="size-6 animate-spin text-muted-foreground" aria-label="Loading" />
            </div>
          ) : categories.length === 0 ? (
            <EmptyState
              title="No categories yet"
              description="Add your first category above, then assign it to products."
              icon={Tag}
              className="py-12"
            />
          ) : (
            <ul className="divide-y divide-border" role="list">
              {categories.map((cat) => (
                <li key={cat} className="flex items-center justify-between px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center size-8 rounded-lg bg-muted">
                      <Tag className="size-4 text-muted-foreground" aria-hidden="true" />
                    </div>
                    <span className="text-sm font-medium text-foreground">{cat}</span>
                  </div>
                  <span className="text-xs text-muted-foreground font-mono">
                    {productCounts[cat] ?? 0} product{(productCounts[cat] ?? 0) !== 1 ? "s" : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </PageTransition>
  );
}
