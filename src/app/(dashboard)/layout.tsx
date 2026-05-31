import { redirect } from "next/navigation";
import { auth } from "../../../auth";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { RoleProvider } from "@/components/providers/RoleProvider";
import { MobileLayoutShell } from "@/components/layout/MobileLayoutShell";
import type { Role } from "@/types";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const role = (session.user.role ?? "staff") as Role;
  const user = {
    name: session.user.name ?? null,
    email: session.user.email ?? null,
    image: session.user.image ?? null,
  };

  return (
    <RoleProvider role={role}>
      <MobileLayoutShell role={role} user={user}>
        {children}
      </MobileLayoutShell>
    </RoleProvider>
  );
}
