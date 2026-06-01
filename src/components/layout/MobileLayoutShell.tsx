"use client";

import { useState } from "react";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import type { Role } from "@/types";

interface MobileLayoutShellProps {
  role: Role;
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
  children: React.ReactNode;
}

export function MobileLayoutShell({ role, user, children }: MobileLayoutShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  // Desktop sidebar: true = expanded (240px), false = icon-only (64px)
  const [desktopExpanded, setDesktopExpanded] = useState(true);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar
        role={role}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
        desktopExpanded={desktopExpanded}
        onDesktopToggle={() => setDesktopExpanded((v) => !v)}
      />
      <div className="flex flex-col flex-1 overflow-hidden min-w-0">
        <Header user={user} onMenuClick={() => setMobileOpen(true)} />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
