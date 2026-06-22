"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Bell, X, CheckCheck } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import type { INotification } from "@/models/Notification";
import { useRouter } from "next/navigation";

type NotifRow = Omit<INotification, "_id"> & { _id: string };

const TYPE_COLORS: Record<INotification["type"], string> = {
  order_created: "text-[#185FA5]",
  order_approved: "text-success",
  order_cancelled: "text-danger",
  low_stock: "text-warning",
  info: "text-muted-foreground",
};

const TYPE_DOT: Record<INotification["type"], string> = {
  order_created: "bg-[#185FA5]",
  order_approved: "bg-success",
  order_cancelled: "bg-danger",
  low_stock: "bg-warning",
  info: "bg-muted-foreground",
};

export function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotifRow[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isMarkingAll, setIsMarkingAll] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  // ── Fetch existing notifications ──────────────────────────────────────────

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications");
      if (!res.ok) return;
      const data = await res.json();
      setNotifications((data.notifications as NotifRow[]).map((n) => ({ ...n, _id: String(n._id) })));
      setUnreadCount(data.unreadCount as number);
    } catch { /* silent */ }
  }, []);

  // ── SSE connection for real-time pushes ───────────────────────────────────

  useEffect(() => {
    fetchNotifications();

    // Connect to SSE stream
    const es = new EventSource("/api/notifications/stream");
    eventSourceRef.current = es;

    es.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as { type: string; notification: NotifRow };
        if (payload.type === "notification") {
          const notif = { ...payload.notification, _id: String(payload.notification._id) };
          // Deduplicate — only add if we don't already have this ID
          setNotifications((prev) => {
            if (prev.some((n) => n._id === notif._id)) return prev;
            return [notif, ...prev].slice(0, 50);
          });
          setUnreadCount((c) => c + 1);
        }
      } catch { /* ignore malformed */ }
    };

    es.onerror = () => {
      // SSE reconnects automatically — no action needed
    };

    return () => {
      es.close();
      eventSourceRef.current = null;
    };
  }, [fetchNotifications]);

  // ── Close on outside click ────────────────────────────────────────────────

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // ── Close on Escape ───────────────────────────────────────────────────────

  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) { if (e.key === "Escape") setOpen(false); }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open]);

  // ── Actions ───────────────────────────────────────────────────────────────

  async function markAllRead() {
    setIsMarkingAll(true);
    try {
      await fetch("/api/notifications", { method: "PUT" });
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch { /* silent */ }
    finally { setIsMarkingAll(false); }
  }

  async function handleNotifClick(n: NotifRow) {
    // Mark as read
    if (!n.read) {
      try {
        await fetch(`/api/notifications/${n._id}`, { method: "PATCH" });
        setNotifications((prev) => prev.map((x) => x._id === n._id ? { ...x, read: true } : x));
        setUnreadCount((c) => Math.max(0, c - 1));
      } catch { /* silent */ }
    }
    // Navigate if link present
    if (n.link) {
      setOpen(false);
      router.push(n.link);
    }
  }

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell button */}
      <button
        onClick={() => { setOpen((v) => !v); }}
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
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    onClick={markAllRead}
                    disabled={isMarkingAll}
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline disabled:opacity-50"
                  >
                    <CheckCheck className="size-3.5" aria-hidden="true" />
                    Mark all read
                  </button>
                )}
                <button
                  onClick={() => setOpen(false)}
                  className="inline-flex items-center justify-center size-6 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  aria-label="Close"
                >
                  <X className="size-3.5" aria-hidden="true" />
                </button>
              </div>
            </div>

            {/* List */}
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
                      onClick={() => handleNotifClick(n)}
                      className={cn(
                        "flex gap-3 px-4 py-3 transition-colors",
                        n.link ? "cursor-pointer" : "cursor-default",
                        !n.read ? "bg-primary/5 hover:bg-primary/10" : "hover:bg-muted/40"
                      )}
                      role={n.link ? "button" : undefined}
                      tabIndex={n.link ? 0 : undefined}
                      onKeyDown={n.link ? (e) => { if (e.key === "Enter") handleNotifClick(n); } : undefined}
                    >
                      {/* Colored dot */}
                      <div
                        className={cn(
                          "mt-1.5 flex-shrink-0 size-2 rounded-full",
                          !n.read ? TYPE_DOT[n.type] ?? "bg-primary" : "bg-muted"
                        )}
                        aria-hidden="true"
                      />

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
                        {n.link && (
                          <p className="text-[10px] text-primary mt-1">Tap to view →</p>
                        )}
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
