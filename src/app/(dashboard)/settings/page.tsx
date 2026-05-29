"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { PageTransition } from "@/components/shared/PageTransition";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// ─── Schema ───────────────────────────────────────────────────────────────────

const settingsSchema = z.object({
  businessName: z.string().min(1, "Business name is required").max(200),
  businessAddress: z.string().max(500).optional(),
  taxRate: z.preprocess(
    (v) => parseFloat(String(v)),
    z.number().min(0, "Must be ≥ 0").max(100, "Must be ≤ 100")
  ),
  lowStockThreshold: z.preprocess(
    (v) => parseInt(String(v), 10),
    z.number().int("Must be a whole number").min(0, "Must be ≥ 0")
  ),
});

type SettingsFormValues = z.infer<typeof settingsSchema>;

// ─── SettingsPage ─────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsSchema) as import("react-hook-form").Resolver<SettingsFormValues>,
    defaultValues: {
      businessName: "",
      businessAddress: "",
      taxRate: 0,
      lowStockThreshold: 10,
    },
  });

  // Load current settings on mount
  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        if (data?.settings) {
          reset({
            businessName: data.settings.businessName ?? "",
            businessAddress: data.settings.businessAddress ?? "",
            taxRate: data.settings.taxRate ?? 0,
            lowStockThreshold: data.settings.lowStockThreshold ?? 10,
          });
        }
      })
      .catch(() => toast.error("Failed to load settings"))
      .finally(() => setIsLoadingSettings(false));
  }, [reset]);

  async function onSubmit(data: SettingsFormValues) {
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Failed to save settings");
        return;
      }
      toast.success("Settings saved");
      reset(data); // reset dirty state
    } catch {
      toast.error("Network error — please try again");
    }
  }

  return (
    <PageTransition>
      <PageHeader title="Settings" description="Configure business details and system defaults." />

      <div className="mx-auto max-w-2xl">
        {isLoadingSettings ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="size-6 animate-spin text-muted-foreground" aria-label="Loading settings" />
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-6">
            {/* Business details */}
            <section className="rounded-xl border border-border bg-card p-6">
              <h2 className="text-base font-semibold text-foreground mb-5">Business Details</h2>
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="s-biz-name">
                    Business Name <span className="text-destructive" aria-hidden="true">*</span>
                  </Label>
                  <Input
                    id="s-biz-name"
                    type="text"
                    placeholder="My Business"
                    aria-invalid={!!errors.businessName}
                    {...register("businessName")}
                  />
                  {errors.businessName && (
                    <p className="text-xs text-destructive">{errors.businessName.message}</p>
                  )}
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="s-biz-addr">Business Address</Label>
                  <textarea
                    id="s-biz-addr"
                    rows={3}
                    placeholder="Street, City, Country"
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                    {...register("businessAddress")}
                  />
                  {errors.businessAddress && (
                    <p className="text-xs text-destructive">{errors.businessAddress.message}</p>
                  )}
                </div>
              </div>
            </section>

            {/* Financial settings */}
            <section className="rounded-xl border border-border bg-card p-6">
              <h2 className="text-base font-semibold text-foreground mb-5">Financial &amp; Inventory</h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="s-tax">
                    Tax Rate (%)
                  </Label>
                  <Input
                    id="s-tax"
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    placeholder="0.00"
                    aria-invalid={!!errors.taxRate}
                    {...register("taxRate")}
                  />
                  {errors.taxRate && (
                    <p className="text-xs text-destructive">{errors.taxRate.message}</p>
                  )}
                  <p className="text-xs text-muted-foreground">Applied to all new orders at creation time.</p>
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="s-threshold">
                    Global Low Stock Threshold
                  </Label>
                  <Input
                    id="s-threshold"
                    type="number"
                    min="0"
                    step="1"
                    placeholder="10"
                    aria-invalid={!!errors.lowStockThreshold}
                    {...register("lowStockThreshold")}
                  />
                  {errors.lowStockThreshold && (
                    <p className="text-xs text-destructive">{errors.lowStockThreshold.message}</p>
                  )}
                  <p className="text-xs text-muted-foreground">Products with their own threshold override this value.</p>
                </div>
              </div>
            </section>

            {/* Save button */}
            <div className="flex justify-end">
              <Button type="submit" disabled={isSubmitting || !isDirty} aria-busy={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                    Saving…
                  </>
                ) : (
                  "Save Settings"
                )}
              </Button>
            </div>
          </form>
        )}
      </div>
    </PageTransition>
  );
}
