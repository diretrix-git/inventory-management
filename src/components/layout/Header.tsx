"use client";

import { useTheme } from "next-themes";
import { signOut } from "next-auth/react";
import { Moon, Sun, LogOut, User, Menu } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";

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
    <header className="h-14 border-b border-border bg-card flex items-center justify-between px-4 gap-2 flex-shrink-0">
      {/* Left: hamburger (mobile only) */}
      <button
        onClick={onMenuClick}
        className={cn(
          "md:hidden inline-flex items-center justify-center size-8 rounded-lg",
          "text-muted-foreground hover:text-foreground hover:bg-muted transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        )}
        aria-label="Open navigation menu"
      >
        <Menu className="size-5" aria-hidden="true" />
      </button>

      {/* Spacer on desktop (hamburger hidden, push right-side controls to end) */}
      <div className="hidden md:flex flex-1" />

      {/* Right: theme toggle + user menu */}
      <div className="flex items-center gap-2">
        {/* Theme toggle */}
        <button
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className={cn(
            "inline-flex items-center justify-center size-8 rounded-lg",
            "text-muted-foreground hover:text-foreground hover:bg-muted",
            "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          )}
          aria-label="Toggle theme"
        >
          <Sun className="size-4 hidden dark:block" aria-hidden="true" />
          <Moon className="size-4 block dark:hidden" aria-hidden="true" />
        </button>

        {/* User menu */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen((prev) => !prev)}
            className={cn(
              "inline-flex items-center justify-center size-8 rounded-full overflow-hidden",
              "bg-primary text-primary-foreground text-xs font-semibold",
              "hover:opacity-90 transition-opacity",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            )}
            aria-label="User menu"
            aria-haspopup="true"
            aria-expanded={menuOpen}
          >
            {user.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.image} alt={user.name ?? "User avatar"} className="size-8 object-cover" />
            ) : (
              initials
            )}
          </button>

          {menuOpen && (
            <div
              role="menu"
              className={cn(
                "absolute right-0 top-full mt-2 w-56 z-50",
                "rounded-lg border border-border bg-popover text-popover-foreground shadow-md py-1"
              )}
            >
              <div className="px-3 py-2 border-b border-border">
                <div className="flex items-center gap-2">
                  <div className="inline-flex items-center justify-center size-8 rounded-full bg-primary text-primary-foreground text-xs font-semibold flex-shrink-0 overflow-hidden">
                    {user.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={user.image} alt="" className="size-8 object-cover" />
                    ) : (
                      initials
                    )}
                  </div>
                  <div className="min-w-0">
                    {user.name && <p className="text-sm font-medium truncate">{user.name}</p>}
                    {user.email && <p className="text-xs text-muted-foreground truncate">{user.email}</p>}
                  </div>
                </div>
              </div>

              <a
                href="/profile"
                role="menuitem"
                className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors cursor-pointer"
                onClick={() => setMenuOpen(false)}
              >
                <User className="size-4 text-muted-foreground" aria-hidden="true" />
                Profile
              </a>

              <button
                role="menuitem"
                onClick={() => { setMenuOpen(false); signOut({ callbackUrl: "/login" }); }}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors cursor-pointer text-destructive hover:text-destructive"
              >
                <LogOut className="size-4" aria-hidden="true" />
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
