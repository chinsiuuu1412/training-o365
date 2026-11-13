import { notFound } from "next/navigation";
import { isRole } from "@/config/navigation";
import { AppShell } from "@/components/layout/app-shell";
export default async function RoleLayout({ children, params }: { children: React.ReactNode; params: Promise<{ role: string }> }) {
  const { role } = await params;
  if (!isRole(role)) notFound();
  return <AppShell role={role}>{children}</AppShell>;
}
