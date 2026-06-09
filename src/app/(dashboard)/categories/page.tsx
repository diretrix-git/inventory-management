"use client";

import { useEffect, useState, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Plus, Tag, Loader2, Pencil, Trash2, Check, X } from "lucide-react";
import { PageTransition } from "@/components/shared/PageTransition";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Tooltip } from "@/components/shared/Tooltip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { friendlyError } from "@/lib/errors";

interface CategoryMeta {
  _id: string;
  name: string;
  description?: string;
  productCount: number;
  createdAt: string;
}

const categorySchema = z.object({
  name: z.string().min(1, "Category name is required").max(100, "Too long"),
  description: z.string().max(300, "Too long").optional(),
});
type CategoryFormValues = z.infer<typeof categorySchema>;

export default function CategoriesPage() {
  const [categories, setCategories] = useState<CategoryMeta[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<CategoryMeta | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CategoryFormValues>({
    resolver: zodResolver(categorySchema),
    defaultValues: { name: "", description: "" },
  });

  const fetchCategories = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/categories");
      if (!res.ok) { toast.error("Could not load categories. Please refresh."); return; }
      const json = await res.json();
      setCategories((json.categoriesWithMeta as CategoryMeta[]) ?? []);
    } catch {
      toast.error("Connection error. Please refresh the page.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchCategories(); }, [fetchCategories]);

  // ── Create ────────────────────────────────────────────────────────────────

  async function onSubmit(data: CategoryFormValues) {
    try {
      const res = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) { toast.error(friendlyError(json.error)); return; }
      toast.success(`Category "${data.name}" created`);
      reset();
      await fetchCategories();
    } catch {
      toast.error("Connection error. Please try again.");
    }
  }

  // ── Inline edit ───────────────────────────────────────────────────────────

  function startEdit(cat: CategoryMeta) {
    setEditingId(cat._id);
    setEditName(cat.name);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditName("");
  }

  async function saveEdit(cat: CategoryMeta) {
    const trimmed = editName.trim();
    if (!trimmed || trimmed === cat.name) { cancelEdit(); return; }
    setIsSavingEdit(true);
    try {
      const res = await fetch(`/api/categories/${cat._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      const json = await res.json();
      if (!res.ok) { toast.error(friendlyError(json.error)); return; }
      toast.success("Category renamed");
      cancelEdit();
      await fetchCategories();
    } catch {
      toast.error("Connection error. Please try again.");
    } finally {
      setIsSavingEdit(false);
    }
  }

  // ── Delete ────────────────────────────────────────────────────────────────

  async function handleDelete() {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/categories/${deleteTarget._id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) { toast.error(friendlyError(json.error)); return; }
      toast.success(`Category "${deleteTarget.name}" deleted`);
      setDeleteTarget(null);
      await fetchCategories();
    } catch {
      toast.error("Connection error. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <PageTransition>
      <PageHeader
        title="Categories"
        description="Add and manage product categories. Assign categories to products when creating or editing them."
      />

      <div className="mx-auto max-w-2xl space-y-6">
        {/* Add category form */}
        <section className="rounded-xl border border-border bg-card p-6">
          <h2 className="text-base font-semibold text-foreground mb-4">Add New Category</h2>
          <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-3">
            <div className="flex gap-3">
              <div className="flex-1 flex flex-col gap-1.5">
                <Label htmlFor="cat-name" className="sr-only">Category name</Label>
                <Input
                  id="cat-name"
                  type="text"
                  placeholder="e.g. Electronics, Beverages, Clothing…"
                  aria-invalid={!!errors.name}
                  {...register("name")}
                />
                {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
              </div>
              <Button type="submit" disabled={isSubmitting} aria-busy={isSubmitting}>
                {isSubmitting ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <><Plus className="size-4 mr-1" aria-hidden="true" />Add</>
                )}
              </Button>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cat-desc" className="text-xs text-muted-foreground">Description (optional)</Label>
              <Input
                id="cat-desc"
                type="text"
                placeholder="Brief description of this category"
                {...register("description")}
              />
            </div>
          </form>
        </section>

        {/* Category list */}
        <section className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
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
              description="Add your first category above to get started."
              icon={Tag}
              className="py-12"
            />
          ) : (
            <ul className="divide-y divide-border" role="list">
              {categories.map((cat) => (
                <li key={cat._id} className="flex items-center gap-3 px-5 py-3.5">
                  <div className="flex items-center justify-center size-8 rounded-lg bg-muted flex-shrink-0">
                    <Tag className="size-4 text-muted-foreground" aria-hidden="true" />
                  </div>

                  {editingId === cat._id ? (
                    /* Inline edit mode */
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <Input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") { e.preventDefault(); saveEdit(cat); }
                          if (e.key === "Escape") cancelEdit();
                        }}
                        className="h-7 text-sm"
                        autoFocus
                        aria-label="Edit category name"
                      />
                      <Tooltip content="Save">
                        <Button size="icon-xs" onClick={() => saveEdit(cat)} disabled={isSavingEdit} aria-label="Save">
                          {isSavingEdit ? <Loader2 className="size-3 animate-spin" /> : <Check className="size-3" />}
                        </Button>
                      </Tooltip>
                      <Tooltip content="Cancel">
                        <Button size="icon-xs" variant="outline" onClick={cancelEdit} aria-label="Cancel">
                          <X className="size-3" />
                        </Button>
                      </Tooltip>
                    </div>
                  ) : (
                    /* Display mode */
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">{cat.name}</p>
                      {cat.description && (
                        <p className="text-xs text-muted-foreground truncate">{cat.description}</p>
                      )}
                    </div>
                  )}

                  {editingId !== cat._id && (
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <span className="text-xs text-muted-foreground font-mono mr-2">
                        {cat.productCount} product{cat.productCount !== 1 ? "s" : ""}
                      </span>
                      <Tooltip content="Rename category">
                        <Button variant="ghost" size="icon-sm" onClick={() => startEdit(cat)} aria-label={`Rename ${cat.name}`}>
                          <Pencil className="size-3.5" aria-hidden="true" />
                        </Button>
                      </Tooltip>
                      <Tooltip content={cat.productCount > 0 ? "Reassign products first" : "Delete category"}>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => cat.productCount === 0 && setDeleteTarget(cat)}
                          aria-label={`Delete ${cat.name}`}
                          className={cat.productCount > 0
                            ? "text-muted-foreground opacity-40 cursor-not-allowed"
                            : "text-destructive hover:text-destructive hover:bg-destructive/10"
                          }
                        >
                          <Trash2 className="size-3.5" aria-hidden="true" />
                        </Button>
                      </Tooltip>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(v) => { if (!v) setDeleteTarget(null); }}
        title="Delete category?"
        description={`"${deleteTarget?.name}" will be permanently deleted. This cannot be undone.`}
        confirmLabel="Delete"
        destructive
        onConfirm={handleDelete}
        isLoading={isDeleting}
      />
    </PageTransition>
  );
}
