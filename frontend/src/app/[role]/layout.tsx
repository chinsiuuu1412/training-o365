import { notFound, redirect } from "next/navigation";
import { isRouteRole } from "@/config/navigation";
import { AppShell } from "@/components/layout/app-shell";

export default async function RoleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ role: string }>;
}) {
  const { role } = await params;
  if (role === "teacher") redirect("/manager");
  if (!isRouteRole(role)) notFound();
  return <AppShell role={role}>{children}</AppShell>;
}
