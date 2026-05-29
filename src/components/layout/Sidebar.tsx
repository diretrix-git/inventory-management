"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
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
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    roles: ["admin", "staff"],
  },
  {
    label: "Products",
    href: "/products",
    icon: Package,
    roles: ["admin", "staff"],
  },
  {
    label: "Suppliers",
    href: "/suppliers",
    icon: Truck,
    roles: ["admin", "staff"],
  },
  {
    label: "Orders",
    href: "/orders",
    icon: ShoppingCart,
    roles: ["admin", "staff"],
  },
  {
    label: "Invoices",
    href: "/invoices",
    icon: FileText,
    roles: ["admin", "staff"],
  },
  {
    label: "Analytics",
    href: "/analytics",
    icon: BarChart2,
    roles: ["admin"],
  },
  {
    label: "Inventory Report",
    href: "/inventory-report",
    icon: ClipboardList,
    roles: ["admin"],
  },
  {
    label: "Sales Report",
    href: "/sales-report",
    icon: TrendingUp,
    roles: ["admin"],
  },
  {
    label: "Audit Logs",
    href: "/audit-logs",
    icon: ScrollText,
    roles: ["admin"],
  },
  {
    label: "Users",
    href: "/users",
    icon: Users,
    roles: ["admin"],
  },
  {
    label: "Settings",
    href: "/settings",
    icon: Settings,
    roles: ["admin"],
  },
  {
    label: "Profile",
    href: "/profile",
    icon: UserCircle,
    roles: ["admin", "staff"],
  },
];

export function Sidebar({ role }: { role: Role }) {
  const [expanded, setExpanded] = useState(true);
  const pathname = usePathname();

  const visibleItems = NAV_ITEMS.filter((item) => item.roles.includes(role));

  return (
    <motion.nav
      animate={{ width: expanded ? 240 : 64 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="relative flex flex-col h-full bg-sidebar border-r border-sidebar-border flex-shrink-0 overflow-hidden"
      aria-label="Sidebar navigation"
    >
      {/* Logo / brand area */}
      <div className="flex items-center h-14 px-3 border-b border-sidebar-border flex-shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center flex-shrink-0">
            <Package className="w-4 h-4 text-primary-foreground" />
          </div>
          {expanded && (
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
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
                  className={cn(
                    "flex items-center gap-3 rounded-md px-2 py-2 text-sm font-medium transition-colors",
                    "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                    isActive
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground"
                  )}
                  title={!expanded ? item.label : undefined}
                >
                  <Icon
                    className="w-5 h-5 flex-shrink-0"
                    aria-hidden="true"
                  />
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
    </motion.nav>
  );
}
