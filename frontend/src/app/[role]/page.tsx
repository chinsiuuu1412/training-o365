import { notFound, redirect } from "next/navigation";
import { isRouteRole } from "@/config/navigation";
import { RoleDashboard } from "@/features/dashboard/role-dashboard";

export default async function RoleHome({ params }: { params: Promise<{ role: string }> }) {
  const { role } = await params;
  if (role === "teacher") redirect("/manager");
  if (!isRouteRole(role)) notFound();
  return <RoleDashboard role={role} />;
}
