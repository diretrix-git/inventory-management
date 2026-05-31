"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  Package,
  Truck,
  ShoppingCart,
  FileText,
  BarChart2,
  ClipboardList,
  TrendingUp,
  ScrollText,
  Users,
  Settings,
  UserCircle,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Role } from "@/types";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  roles: Role[];
}

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, roles: ["admin", "staff"] },
  { label: "Products", href: "/products", icon: Package, roles: ["admin", "staff"] },
  { label: "Suppliers", href: "/suppliers", icon: Truck, roles: ["admin", "staff"] },
  { label: "Orders", href: "/orders", icon: ShoppingCart, roles: ["admin", "staff"] },
  { label: "Invoices", href: "/invoices", icon: FileText, roles: ["admin", "staff"] },
  { label: "Analytics", href: "/analytics", icon: BarChart2, roles: ["admin"] },
  { label: "Inventory Report", href: "/inventory-report", icon: ClipboardList, roles: ["admin"] },
  { label: "Sales Report", href: "/sales-report", icon: TrendingUp, roles: ["admin"] },
  { label: "Audit Logs", href: "/audit-logs", icon: ScrollText, roles: ["admin"] },
  { label: "Users", href: "/users", icon: Users, roles: ["admin"] },
  { label: "Settings", href: "/settings", icon: Settings, roles: ["admin"] },
  { label: "Profile", href: "/profile", icon: UserCircle, roles: ["admin", "staff"] },
];

// ─── Shared nav content ───────────────────────────────────────────────────────

function NavContent({
  role,
  expanded,
  onNavClick,
}: {
  role: Role;
  expanded: boolean;
  onNavClick?: () => void;
}) {
  const pathname = usePathname();
  const visibleItems = NAV_ITEMS.filter((item) => item.roles.includes(role));

  return (
    <>
      {/* Logo */}
      <div className="flex items-center h-14 px-3 border-b border-sidebar-border flex-shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center flex-shrink-0">
            <Package className="w-4 h-4 text-primary-foreground" />
          </div>
          {expanded && (
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.15 }}
              className="font-semibold text-sm text-sidebar-foreground truncate"
            >
              Inventory
            </motion.span>
          )}
        </div>
      </div>

      {/* Nav items */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-3 px-2">
        <ul className="space-y-1" role="list">
          {visibleItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              pathname === item.href ||
              (item.href !== "/dashboard" && pathname.startsWith(item.href));

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={onNavClick}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-2 py-2 text-sm font-medium transition-colors",
                    "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                    isActive
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground"
                  )}
                  title={!expanded ? item.label : undefined}
                >
                  <Icon className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
                  {expanded && (
                    <motion.span
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.15 }}
                      className="truncate"
                    >
                      {item.label}
                    </motion.span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}

// ─── Desktop sidebar ──────────────────────────────────────────────────────────

function DesktopSidebar({ role }: { role: Role }) {
  const [expanded, setExpanded] = useState(true);

  return (
    <motion.aside
      animate={{ width: expanded ? 240 : 64 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="hidden md:flex flex-col h-full bg-sidebar border-r border-sidebar-border flex-shrink-0 overflow-hidden"
      aria-label="Sidebar navigation"
    >
      <NavContent role={role} expanded={expanded} />

      {/* Toggle button */}
      <div className="flex-shrink-0 border-t border-sidebar-border p-2">
        <button
          onClick={() => setExpanded((prev) => !prev)}
          className={cn(
            "flex items-center justify-center w-full rounded-md px-2 py-2 text-sm",
            "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
          )}
          aria-label={expanded ? "Collapse sidebar" : "Expand sidebar"}
        >
          {expanded ? (
            <span className="flex items-center gap-2">
              <ChevronLeft className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.15 }}
                className="text-xs"
              >
                Collapse
              </motion.span>
            </span>
          ) : (
            <ChevronRight className="w-4 h-4" aria-hidden="true" />
          )}
        </button>
      </div>
    </motion.aside>
  );
}

// ─── Mobile drawer ────────────────────────────────────────────────────────────

function MobileDrawer({
  role,
  open,
  onClose,
}: {
  role: Role;
  open: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();
  // Track if drawer has been opened at least once before closing on route change
  // This prevents the initial mount from triggering onClose
  const hasOpenedRef = useRef(false);

  useEffect(() => {
    if (open) {
      hasOpenedRef.current = true;
    }
  }, [open]);

  useEffect(() => {
    // Only close on route change if the drawer was previously opened
    if (hasOpenedRef.current) {
      onClose();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-black/50 md:hidden"
            aria-hidden="true"
            onClick={onClose}
          />

          {/* Drawer panel */}
          <motion.aside
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-sidebar border-r border-sidebar-border md:hidden"
            aria-label="Mobile navigation"
          >
            <NavContent role={role} expanded={true} onNavClick={onClose} />

            {/* Close button */}
            <div className="flex-shrink-0 border-t border-sidebar-border p-2">
              <button
                onClick={onClose}
                className="flex items-center justify-center w-full gap-2 rounded-md px-2 py-2 text-sm text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
                aria-label="Close navigation"
              >
                <X className="w-4 h-4" aria-hidden="true" />
                <span className="text-xs">Close</span>
              </button>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

// ─── Exported Sidebar (combines both) ────────────────────────────────────────

interface SidebarProps {
  role: Role;
  mobileOpen: boolean;
  onMobileClose: () => void;
}

export function Sidebar({ role, mobileOpen, onMobileClose }: SidebarProps) {
  return (
    <>
      <DesktopSidebar role={role} />
      <MobileDrawer role={role} open={mobileOpen} onClose={onMobileClose} />
    </>
  );
}
