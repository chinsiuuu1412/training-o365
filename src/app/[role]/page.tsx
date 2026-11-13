import { notFound } from "next/navigation";
import { isRole } from "@/config/navigation";
import { RoleDashboard } from "@/features/dashboard/role-dashboard";
export default async function RoleHome({ params }: { params: Promise<{ role: string }> }) {
  const { role } = await params;
  if (!isRole(role)) notFound();
  return <RoleDashboard role={role} />;
}
