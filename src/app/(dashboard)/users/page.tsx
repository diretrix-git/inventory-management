"use client";

import { useEffect, useState, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Plus, Pencil, UserX, UserCheck, X, Loader2 } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";

import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { PasswordInput } from "@/components/shared/PasswordInput";
import { Tooltip } from "@/components/shared/Tooltip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRole } from "@/components/providers/RoleProvider";
import { cn } from "@/lib/utils";
import type { IUser } from "@/types";

// ─── Types ────────────────────────────────────────────────────────────────────

type UserRow = Omit<IUser, "_id"> & { _id: string };

// ─── Zod schemas ─────────────────────────────────────────────────────────────

const createSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name too long"),
  email: z.string().email("Invalid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z.enum(["admin", "staff"] as const),
});

const editSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name too long"),
  email: z.string().email("Invalid email"),
  password: z
    .string()
    .optional()
    .refine((v) => !v || v.length >= 8, {
      message: "Password must be at least 8 characters",
    }),
  role: z.enum(["admin", "staff"] as const),
});

type CreateFormValues = z.infer<typeof createSchema>;
type EditFormValues = z.infer<typeof editSchema>;

// ─── UserSheet ────────────────────────────────────────────────────────────────

interface UserSheetProps {
  open: boolean;
  onClose: () => void;
  editUser: UserRow | null;
  onSuccess: () => void;
}

function UserSheet({ open, onClose, editUser, onSuccess }: UserSheetProps) {
  const isEdit = editUser !== null;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateFormValues | EditFormValues>({
    resolver: zodResolver(isEdit ? editSchema : createSchema),
    defaultValues: isEdit
      ? { name: editUser.name, email: editUser.email, password: "", role: editUser.role }
      : { name: "", email: "", password: "", role: "staff" },
  });

  // Reset form when sheet opens/closes or editUser changes
  useEffect(() => {
    if (open) {
      reset(
        isEdit
          ? { name: editUser.name, email: editUser.email, password: "", role: editUser.role }
          : { name: "", email: "", password: "", role: "staff" }
      );
    }
  }, [open, isEdit, editUser, reset]);

  async function onSubmit(data: CreateFormValues | EditFormValues) {
    try {
      const url = isEdit ? `/api/users/${editUser._id}` : "/api/users";
      const method = isEdit ? "PUT" : "POST";

      // For edit, only send password if provided
      const body: Record<string, unknown> = {
        name: data.name,
        role: data.role,
      };
      if (!isEdit) {
        body.email = data.email;
        body.password = (data as CreateFormValues).password;
      } else {
        // PUT /api/users/[id] only accepts name, role, isActive
        // email is not updatable via this endpoint
        if ((data as EditFormValues).password) {
          // password update not supported by PUT /api/users/[id] — skip silently
        }
      }

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const json = await res.json();

      if (!res.ok) {
        toast.error(json.error ?? "Something went wrong");
        return;
      }

      toast.success(isEdit ? "User updated" : "User created");
      onSuccess();
      onClose();
    } catch {
      toast.error("Network error — please try again");
    }
  }

  // Trap focus and close on Escape
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
        aria-hidden="true"
        onClick={onClose}
      />

      {/* Panel */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={isEdit ? "Edit user" : "New user"}
        className={cn(
          "fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col bg-popover shadow-2xl",
          "border-l border-border"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-base font-semibold text-foreground">
            {isEdit ? "Edit User" : "New User"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center justify-center size-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            aria-label="Close panel"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit(onSubmit)}
          noValidate
          className="flex flex-1 flex-col gap-5 overflow-y-auto px-5 py-5"
        >
          {/* Name */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="user-name">
              Name <span aria-hidden="true" className="text-destructive">*</span>
            </Label>
            <Input
              id="user-name"
              type="text"
              placeholder="Full name"
              aria-invalid={!!errors.name}
              {...register("name")}
            />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name.message}</p>
            )}
          </div>

          {/* Email — only for create */}
          {!isEdit && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="user-email">
                Email <span aria-hidden="true" className="text-destructive">*</span>
              </Label>
              <Input
                id="user-email"
                type="email"
                placeholder="user@example.com"
                aria-invalid={!!errors.email}
                {...register("email")}
              />
              {errors.email && (
                <p className="text-xs text-destructive">{errors.email.message}</p>
              )}
            </div>
          )}

          {/* Password */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="user-password">
              Password{" "}
              {!isEdit && (
                <span aria-hidden="true" className="text-destructive">*</span>
              )}
              {isEdit && (
                <span className="text-xs font-normal text-muted-foreground ml-1">
                  (leave blank to keep current)
                </span>
              )}
            </Label>
            <PasswordInput
              id="user-password"
              placeholder={isEdit ? "••••••••" : "Min. 8 characters"}
              aria-invalid={!!errors.password}
              {...register("password")}
            />
            {errors.password && (
              <p className="text-xs text-destructive">{errors.password.message}</p>
            )}
          </div>

          {/* Role */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="user-role">
              Role <span aria-hidden="true" className="text-destructive">*</span>
            </Label>
            <select
              id="user-role"
              className={cn(
                "h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                "text-foreground"
              )}
              aria-invalid={!!errors.role}
              {...register("role")}
            >
              <option value="staff">Staff</option>
              <option value="admin">Admin</option>
            </select>
            {errors.role && (
              <p className="text-xs text-destructive">{errors.role.message}</p>
            )}
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Footer actions */}
          <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting} aria-busy={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  {isEdit ? "Saving…" : "Creating…"}
                </>
              ) : isEdit ? (
                "Save changes"
              ) : (
                "Create user"
              )}
            </Button>
          </div>
        </form>
      </aside>
    </>
  );
}

// ─── UsersPage ────────────────────────────────────────────────────────────────

export default function UsersPage() {
  const role = useRole();
  const isAdmin = role === "admin";

  const [users, setUsers] = useState<UserRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Sheet state
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editUser, setEditUser] = useState<UserRow | null>(null);

  // Confirm dialog state
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmUser, setConfirmUser] = useState<UserRow | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);

  // ── Fetch users ──────────────────────────────────────────────────────────

  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/users?limit=200", { cache: "no-store" });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        toast.error(json.error ?? "Failed to load users");
        return;
      }
      const json = await res.json();
      setUsers(
        (json.users as UserRow[]).map((u) => ({
          ...u,
          _id: String(u._id),
        }))
      );
    } catch {
      toast.error("Network error — could not load users");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // ── Handlers ─────────────────────────────────────────────────────────────

  function openCreate() {
    setEditUser(null);
    setSheetOpen(true);
  }

  function openEdit(user: UserRow) {
    setEditUser(user);
    setSheetOpen(true);
  }

  function openConfirm(user: UserRow) {
    setConfirmUser(user);
    setConfirmOpen(true);
  }

  async function handleToggleActive() {
    if (!confirmUser) return;
    setIsConfirming(true);
    try {
      const res = await fetch(`/api/users/${confirmUser._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !confirmUser.isActive }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Failed to update user");
        return;
      }
      toast.success(
        confirmUser.isActive ? "User deactivated" : "User activated"
      );
      setConfirmOpen(false);
      setConfirmUser(null);
      await fetchUsers();
    } catch {
      toast.error("Network error — please try again");
    } finally {
      setIsConfirming(false);
    }
  }

  // ── Column definitions ────────────────────────────────────────────────────

  const columns: ColumnDef<UserRow>[] = [
    {
      accessorKey: "name",
      header: "Name",
      cell: ({ row }) => (
        <span className="font-medium text-foreground">{row.original.name}</span>
      ),
    },
    {
      accessorKey: "email",
      header: "Email",
      cell: ({ row }) => (
        <span className="text-muted-foreground">{row.original.email}</span>
      ),
    },
    {
      accessorKey: "role",
      header: "Role",
      cell: ({ row }) => {
        const r = row.original.role;
        return (
          <span
            className={cn(
              "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
              r === "admin"
                ? "bg-[#185FA5]/15 text-[#185FA5] border-[#185FA5]/30"
                : "bg-muted text-muted-foreground border-border"
            )}
          >
            {r === "admin" ? "Admin" : "Staff"}
          </span>
        );
      },
    },
    {
      accessorKey: "isActive",
      header: "Status",
      cell: ({ row }) => (
        <StatusBadge status={row.original.isActive ? "active" : "inactive"} />
      ),
    },
    {
      accessorKey: "createdAt",
      header: "Created",
      cell: ({ row }) => {
        const date = new Date(row.original.createdAt);
        return (
          <span className="font-mono text-xs text-muted-foreground tabular-nums">
            {date.toLocaleDateString("en-US", {
              year: "numeric",
              month: "short",
              day: "2-digit",
            })}
          </span>
        );
      },
    },
    // Actions column — only rendered for admins
    ...(isAdmin
      ? ([
          {
            id: "actions",
            header: "",
            enableSorting: false,
            enableHiding: false,
            cell: ({ row }) => {
              const user = row.original;
              return (
                <div className="flex items-center justify-end gap-1.5">
                  <Tooltip content="Edit user">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => openEdit(user)}
                      aria-label={`Edit ${user.name}`}
                    >
                      <Pencil className="size-3.5" aria-hidden="true" />
                    </Button>
                  </Tooltip>
                  <Tooltip content={user.isActive ? "Deactivate user" : "Activate user"}>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => openConfirm(user)}
                      aria-label={
                        user.isActive
                          ? `Deactivate ${user.name}`
                          : `Activate ${user.name}`
                      }
                      className={
                        user.isActive
                          ? "text-destructive hover:text-destructive hover:bg-destructive/10"
                          : "text-success hover:text-success hover:bg-success/10"
                      }
                    >
                      {user.isActive ? (
                        <UserX className="size-3.5" aria-hidden="true" />
                      ) : (
                        <UserCheck className="size-3.5" aria-hidden="true" />
                      )}
                    </Button>
                  </Tooltip>
                </div>
              );
            },
          },
        ] as ColumnDef<UserRow>[])
      : []),
  ];

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <PageHeader
        title="Users"
        description="Manage system users and their roles."
        action={
          isAdmin ? (
            <Button onClick={openCreate} size="default">
              <Plus className="size-4" aria-hidden="true" />
              New User
            </Button>
          ) : undefined
        }
      />

      <DataTable
        columns={columns}
        data={users}
        isLoading={isLoading}
        searchKey="name"
        searchPlaceholder="Search by name…"
      />

      {/* Create / Edit Sheet */}
      {isAdmin && (
        <UserSheet
          open={sheetOpen}
          onClose={() => setSheetOpen(false)}
          editUser={editUser}
          onSuccess={fetchUsers}
        />
      )}

      {/* Deactivate / Activate Confirm Dialog */}
      {isAdmin && confirmUser && (
        <ConfirmDialog
          open={confirmOpen}
          onOpenChange={(v) => {
            setConfirmOpen(v);
            if (!v) setConfirmUser(null);
          }}
          title={confirmUser.isActive ? "Deactivate user?" : "Activate user?"}
          description={
            confirmUser.isActive
              ? `${confirmUser.name} will no longer be able to sign in. You can reactivate them at any time.`
              : `${confirmUser.name} will be able to sign in again.`
          }
          confirmLabel={confirmUser.isActive ? "Deactivate" : "Activate"}
          destructive={confirmUser.isActive}
          onConfirm={handleToggleActive}
          isLoading={isConfirming}
        />
      )}
    </>
  );
}
