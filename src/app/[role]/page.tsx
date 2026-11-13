import { notFound } from "next/navigation";
import { isRole } from "@/config/navigation";
import { getDashboard, getTeacherDashboard, getStudentDashboard } from "@/mocks/services/dashboard";
import { AdminDashboard } from "@/features/dashboard/admin-dashboard";
import { TeacherDashboard } from "@/features/dashboard/teacher-dashboard";
import { StudentDashboard } from "@/features/dashboard/student-dashboard";
export default async function RoleHome({ params }: { params: Promise<{ role: string }> }) {
  const { role } = await params;
  if (!isRole(role)) notFound();
  if (role === "admin") return <AdminDashboard data={getDashboard()} />;
  if (role === "teacher") return <TeacherDashboard data={getTeacherDashboard("t1")} />;
  return <StudentDashboard data={getStudentDashboard("s1")} />;
}
