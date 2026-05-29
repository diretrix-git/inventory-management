"use client";

import { useSession } from "next-auth/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

// ─── Zod schemas ──────────────────────────────────────────────────────────────

const nameSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name must be 100 characters or fewer"),
});

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z.string().min(8, "New password must be at least 8 characters"),
    confirmNewPassword: z.string().min(1, "Please confirm your new password"),
  })
  .refine((data) => data.newPassword === data.confirmNewPassword, {
    message: "Passwords do not match",
    path: ["confirmNewPassword"],
  });

type NameFormValues = z.infer<typeof nameSchema>;
type PasswordFormValues = z.infer<typeof passwordSchema>;

// ─── Role badge ───────────────────────────────────────────────────────────────

function RoleBadge({ role }: { role: string }) {
  const isAdmin = role === "admin";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        isAdmin
          ? "bg-[#185FA5]/15 text-[#185FA5] border-[#185FA5]/30"
          : "bg-muted text-muted-foreground border-border"
      )}
    >
      {isAdmin ? "Admin" : "Staff"}
    </span>
  );
}

// ─── Avatar ───────────────────────────────────────────────────────────────────

function Avatar({ name }: { name: string }) {
  const initials = name
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div
      aria-hidden="true"
      className="flex size-16 shrink-0 items-center justify-center rounded-full bg-[#185FA5]/15 text-[#185FA5] text-xl font-semibold select-none"
    >
      {initials}
    </div>
  );
}

// ─── UpdateNameForm ───────────────────────────────────────────────────────────

function UpdateNameForm({ currentName, onSuccess }: { currentName: string; onSuccess: (name: string) => void }) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<NameFormValues>({
    resolver: zodResolver(nameSchema),
    defaultValues: { name: currentName },
  });

  async function onSubmit(data: NameFormValues) {
    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: data.name }),
      });

      const json = await res.json();

      if (!res.ok) {
        toast.error(json.error ?? "Failed to update name");
        return;
      }

      toast.success("Display name updated");
      onSuccess(data.name);
    } catch {
      toast.error("Network error — please try again");
    }
  }

  return (
    <section className="rounded-xl border border-border bg-card p-6">
      <h2 className="mb-4 text-base font-semibold text-foreground">Update name</h2>
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="profile-name">Display name</Label>
          <Input
            id="profile-name"
            type="text"
            placeholder="Your full name"
            aria-invalid={!!errors.name}
            {...register("name")}
          />
          {errors.name && (
            <p className="text-xs text-destructive">{errors.name.message}</p>
          )}
        </div>

        <div className="flex justify-end">
          <Button type="submit" disabled={isSubmitting} aria-busy={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                Saving…
              </>
            ) : (
              "Save name"
            )}
          </Button>
        </div>
      </form>
    </section>
  );
}

// ─── ChangePasswordForm ───────────────────────────────────────────────────────

function ChangePasswordForm() {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirmNewPassword: "" },
  });

  async function onSubmit(data: PasswordFormValues) {
    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: data.currentPassword,
          newPassword: data.newPassword,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        toast.error(json.error ?? "Failed to change password");
        return;
      }

      toast.success("Password changed successfully");
      reset();
    } catch {
      toast.error("Network error — please try again");
    }
  }

  return (
    <section className="rounded-xl border border-border bg-card p-6">
      <h2 className="mb-4 text-base font-semibold text-foreground">Change password</h2>
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        {/* Current password */}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="current-password">Current password</Label>
          <Input
            id="current-password"
            type="password"
            placeholder="••••••••"
            autoComplete="current-password"
            aria-invalid={!!errors.currentPassword}
            {...register("currentPassword")}
          />
          {errors.currentPassword && (
            <p className="text-xs text-destructive">{errors.currentPassword.message}</p>
          )}
        </div>

        {/* New password */}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="new-password">New password</Label>
          <Input
            id="new-password"
            type="password"
            placeholder="Min. 8 characters"
            autoComplete="new-password"
            aria-invalid={!!errors.newPassword}
            {...register("newPassword")}
          />
          {errors.newPassword && (
            <p className="text-xs text-destructive">{errors.newPassword.message}</p>
          )}
        </div>

        {/* Confirm new password */}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="confirm-new-password">Confirm new password</Label>
          <Input
            id="confirm-new-password"
            type="password"
            placeholder="Repeat new password"
            autoComplete="new-password"
            aria-invalid={!!errors.confirmNewPassword}
            {...register("confirmNewPassword")}
          />
          {errors.confirmNewPassword && (
            <p className="text-xs text-destructive">{errors.confirmNewPassword.message}</p>
          )}
        </div>

        <div className="flex justify-end">
          <Button type="submit" disabled={isSubmitting} aria-busy={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                Changing…
              </>
            ) : (
              "Change password"
            )}
          </Button>
        </div>
      </form>
    </section>
  );
}

// ─── ProfilePage ──────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const { data: session, update } = useSession();

  const user = session?.user;
  const displayName = user?.name ?? "";
  const email = user?.email ?? "";
  const role = (user as { role?: string } | undefined)?.role ?? "staff";

  async function handleNameSuccess(newName: string) {
    // Update the session so the header reflects the new name immediately
    await update({ name: newName });
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-6 animate-spin text-muted-foreground" aria-label="Loading profile" />
      </div>
    );
  }

  return (
    <>
      <PageHeader title="Profile" description="Manage your account details." />

      <div className="mx-auto max-w-2xl space-y-6">
        {/* Identity card */}
        <section className="flex items-center gap-4 rounded-xl border border-border bg-card p-6">
          <Avatar name={displayName || email} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-lg font-semibold text-foreground">
              {displayName || <span className="text-muted-foreground italic">No name set</span>}
            </p>
            <p className="truncate text-sm text-muted-foreground">{email}</p>
            <div className="mt-2">
              <RoleBadge role={role} />
            </div>
          </div>
        </section>

        {/* Update name form */}
        <UpdateNameForm currentName={displayName} onSuccess={handleNameSuccess} />

        {/* Change password form */}
        <ChangePasswordForm />
      </div>
    </>
  );
}
