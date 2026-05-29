import { redirect } from "next/navigation";
import { auth } from "../../../auth";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { RoleProvider } from "@/components/providers/RoleProvider";
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

  return (
    <RoleProvider role={role}>
      <div className="flex h-screen overflow-hidden bg-background">
        <Sidebar role={role} />
        <div className="flex flex-col flex-1 overflow-hidden">
          <Header user={session.user} />
          <main className="flex-1 overflow-y-auto p-6">{children}</main>
        </div>
      </div>
    </RoleProvider>
  );
}
