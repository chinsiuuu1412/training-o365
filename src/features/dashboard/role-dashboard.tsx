"use client";
import type { Role } from "@/types/lms";
import { useLms } from "@/state/lms-provider";
import { getDashboard, getTeacherDashboard, getStudentDashboard } from "@/mocks/services/dashboard";
import { AdminDashboard } from "./admin-dashboard";
import { TeacherDashboard } from "./teacher-dashboard";
import { StudentDashboard } from "./student-dashboard";

export function RoleDashboard({ role }: { role: Role }) {
  const { state, account, now } = useLms();
  const snapshot = { ...state, referenceTime: new Date(now).toISOString() };
  if (role === "admin") return <AdminDashboard data={getDashboard(snapshot)} />;
  if (role === "teacher") return <TeacherDashboard key={account(role).id} data={getTeacherDashboard(account(role).id, snapshot)} displayName={account(role).name} />;
  return <StudentDashboard data={getStudentDashboard(account(role).id, snapshot)} displayName={account(role).name} />;
}
