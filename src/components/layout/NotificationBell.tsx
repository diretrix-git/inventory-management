"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Bell, X, CheckCheck, ExternalLink } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import type { INotification } from "@/models/Notification";
import Link from "next/link";

type NotifRow = Omit<INotification, "_id"> & { _id: string };

const TYPE_COLORS: Record<INotification["type"], string> = {
  order_created: "bg-[#185FA5]/15 text-[#185FA5]",
  order_approved: "bg-success/15 text-success",
  order_cancelled: "bg-danger/15 text-danger",
  low_stock: "bg-warning/15 text-warning",
  info: "bg-muted text-muted-foreground",
};

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotifRow[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications");
      if (!res.ok) return;
      const data = await res.json();
      setNotifications((data.notifications as NotifRow[]).map((n) => ({ ...n, _id: String(n._id) })));
      setUnreadCount(data.unreadCount as number);
    } catch {
      // silent
    }
  }, []);

  // Poll every 30 seconds for new notifications
  useEffect(() => {
    fetchNotifications();
    pollRef.current = setInterval(fetchNotifications, 30000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [fetchNotifications]);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) { if (e.key === "Escape") setOpen(false); }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open]);

  async function markAllRead() {
    setIsLoading(true);
    try {
      await fetch("/api/notifications", { method: "PUT" });
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch { /* silent */ }
    finally { setIsLoading(false); }
  }

  async function markOneRead(id: string) {
    try {
      await fetch(`/api/notifications/${id}`, { method: "PATCH" });
      setNotifications((prev) => prev.map((n) => n._id === id ? { ...n, read: true } : n));
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch { /* silent */ }
  }

  function handleOpen() {
    setOpen((v) => !v);
    if (!open) fetchNotifications();
  }

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell button */}
      <button
        onClick={handleOpen}
        className={cn(
          "relative inline-flex items-center justify-center size-8 rounded-lg",
          "text-muted-foreground hover:text-foreground hover:bg-muted transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        )}
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
        aria-expanded={open}
      >
        <Bell className="size-4" aria-hidden="true" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[16px] h-4 rounded-full bg-destructive text-white text-[10px] font-bold px-1 leading-none">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className={cn(
              "absolute right-0 top-full mt-2 z-50",
              "w-80 sm:w-96 rounded-xl border border-border bg-popover shadow-xl",
              "flex flex-col max-h-[480px]"
            )}
            role="dialog"
            aria-label="Notifications"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
              <h3 className="text-sm font-semibold text-foreground">
                Notifications
                {unreadCount > 0 && (
                  <span className="ml-2 inline-flex items-center justify-center size-5 rounded-full bg-destructive text-white text-[10px] font-bold">
                    {unreadCount}
                  </span>
                )}
              </h3>
              <div className="flex items-center gap-1">
                {unreadCount > 0 && (
                  <button
                    onClick={markAllRead}
                    disabled={isLoading}
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline disabled:opacity-50"
                    aria-label="Mark all as read"
                  >
                    <CheckCheck className="size-3.5" aria-hidden="true" />
                    Mark all read
                  </button>
                )}
                <button
                  onClick={() => setOpen(false)}
                  className="ml-2 inline-flex items-center justify-center size-6 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  aria-label="Close notifications"
                >
                  <X className="size-3.5" aria-hidden="true" />
                </button>
              </div>
            </div>

            {/* Notification list */}
            <div className="overflow-y-auto flex-1">
              {notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center px-4">
                  <Bell className="size-8 text-muted-foreground mb-2" aria-hidden="true" />
                  <p className="text-sm font-medium text-foreground">All caught up</p>
                  <p className="text-xs text-muted-foreground">No notifications yet.</p>
                </div>
              ) : (
                <ul className="divide-y divide-border" role="list">
                  {notifications.map((n) => (
                    <li
                      key={n._id}
                      className={cn(
                        "flex gap-3 px-4 py-3 transition-colors",
                        !n.read ? "bg-primary/5" : "hover:bg-muted/40"
                      )}
                    >
                      {/* Type indicator dot */}
                      <div className={cn("mt-1 flex-shrink-0 size-2 rounded-full", !n.read ? "bg-primary" : "bg-transparent")} aria-hidden="true" />

                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className={cn("text-xs font-semibold", TYPE_COLORS[n.type] ?? "text-foreground")}>
                            {n.title}
                          </p>
                          <span className="text-[10px] text-muted-foreground flex-shrink-0 tabular-nums">
                            {new Date(n.createdAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{n.message}</p>
                        <div className="flex items-center gap-3 mt-1.5">
                          {n.link && (
                            <Link
                              href={n.link}
                              onClick={() => { markOneRead(n._id); setOpen(false); }}
                              className="inline-flex items-center gap-1 text-[10px] text-primary hover:underline"
                            >
                              <ExternalLink className="size-2.5" aria-hidden="true" />
                              View
                            </Link>
                          )}
                          {!n.read && (
                            <button
                              onClick={() => markOneRead(n._id)}
                              className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                            >
                              Mark read
                            </button>
                          )}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
