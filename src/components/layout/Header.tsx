"use client";

import { useTheme } from "next-themes";
import { signOut } from "next-auth/react";
import { Moon, Sun, LogOut, User, Menu } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { NotificationBell } from "./NotificationBell";

interface HeaderProps {
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
  onMenuClick: () => void;
}

export function Header({ user, onMenuClick }: HeaderProps) {
  const { theme, setTheme } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    if (menuOpen) document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [menuOpen]);

  const initials = user.name
    ? user.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : (user.email?.[0] ?? "U").toUpperCase();

  return (
    <header className="h-16 border-b border-border bg-card flex items-center justify-between px-4 gap-3 flex-shrink-0">
      {/* Left: hamburger (mobile only) */}
      <button
        onClick={onMenuClick}
        className={cn(
          "md:hidden inline-flex items-center justify-center size-10 rounded-xl",
          "text-muted-foreground hover:text-foreground hover:bg-muted transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        )}
        aria-label="Open navigation menu"
        title="Open menu"
      >
        <Menu className="size-5" aria-hidden="true" />
      </button>

      {/* Spacer on desktop */}
      <div className="hidden md:flex flex-1" />

      {/* Right: action buttons */}
      <div className="flex items-center gap-1.5">
        {/* Theme toggle */}
        <button
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className={cn(
            "inline-flex items-center justify-center size-10 rounded-xl",
            "text-muted-foreground hover:text-foreground hover:bg-muted",
            "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          )}
          aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        >
          <Sun className="size-[18px] hidden dark:block" aria-hidden="true" />
          <Moon className="size-[18px] block dark:hidden" aria-hidden="true" />
        </button>

        {/* Notification bell */}
        <NotificationBell />

        {/* Divider */}
        <div className="w-px h-6 bg-border mx-1" aria-hidden="true" />

        {/* User menu */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen((prev) => !prev)}
            className={cn(
              "inline-flex items-center gap-2.5 rounded-xl px-2.5 py-1.5",
              "hover:bg-muted transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            )}
            aria-label="User menu"
            aria-haspopup="true"
            aria-expanded={menuOpen}
            title="Account menu"
          >
            {/* Avatar */}
            <div className={cn(
              "inline-flex items-center justify-center size-8 rounded-full overflow-hidden flex-shrink-0",
              "bg-primary text-primary-foreground text-xs font-semibold"
            )}>
              {user.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={user.image} alt={user.name ?? "User avatar"} className="size-8 object-cover" />
              ) : (
                initials
              )}
            </div>
            {/* Name (hidden on small screens) */}
            <div className="hidden sm:flex flex-col items-start min-w-0">
              {user.name && (
                <span className="text-sm font-medium text-foreground leading-tight truncate max-w-[120px]">
                  {user.name}
                </span>
              )}
              <span className="text-[10px] text-muted-foreground leading-tight">
                {user.name ? "Account" : user.email ?? "Account"}
              </span>
            </div>
          </button>

          {/* Dropdown */}
          {menuOpen && (
            <div
              role="menu"
              className={cn(
                "absolute right-0 top-full mt-2 w-60 z-50",
                "rounded-xl border border-border bg-popover text-popover-foreground shadow-lg py-1.5"
              )}
            >
              {/* User info header */}
              <div className="px-4 py-3 border-b border-border mb-1">
                <div className="flex items-center gap-3">
                  <div className="inline-flex items-center justify-center size-10 rounded-full bg-primary text-primary-foreground text-sm font-semibold flex-shrink-0 overflow-hidden">
                    {user.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={user.image} alt="" className="size-10 object-cover" />
                    ) : (
                      initials
                    )}
                  </div>
                  <div className="min-w-0">
                    {user.name && <p className="text-sm font-semibold truncate">{user.name}</p>}
                    {user.email && <p className="text-xs text-muted-foreground truncate">{user.email}</p>}
                  </div>
                </div>
              </div>

              {/* Profile link */}
              <a
                href="/profile"
                role="menuitem"
                className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-muted transition-colors cursor-pointer rounded-lg mx-1"
                onClick={() => setMenuOpen(false)}
              >
                <div className="flex items-center justify-center size-7 rounded-lg bg-muted flex-shrink-0">
                  <User className="size-3.5 text-muted-foreground" aria-hidden="true" />
                </div>
                <div>
                  <p className="font-medium">Profile</p>
                  <p className="text-xs text-muted-foreground">Manage your account</p>
                </div>
              </a>

              {/* Sign out */}
              <button
                role="menuitem"
                onClick={() => { setMenuOpen(false); signOut({ callbackUrl: "/login" }); }}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-sm hover:bg-muted transition-colors cursor-pointer rounded-lg mx-1 text-destructive"
              >
                <div className="flex items-center justify-center size-7 rounded-lg bg-destructive/10 flex-shrink-0">
                  <LogOut className="size-3.5 text-destructive" aria-hidden="true" />
                </div>
                <div className="text-left">
                  <p className="font-medium">Sign out</p>
                  <p className="text-xs text-destructive/70">End your session</p>
                </div>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
