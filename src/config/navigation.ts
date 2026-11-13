import { LayoutDashboard, Users, GraduationCap, BookOpen, LibraryBig, Bell, ClipboardCheck, CalendarDays } from "lucide-react";
import type { Role } from "@/types/lms";
const shared = [{ path: "library", label: "Thư viện", icon: LibraryBig }, { path: "notifications", label: "Thông báo", icon: Bell }];
export const navigation = {
  admin: [{ path: "", label: "Tổng quan", icon: LayoutDashboard }, { path: "students", label: "Học viên", icon: Users }, { path: "teachers", label: "Giảng viên", icon: GraduationCap }, { path: "classes", label: "Lớp học", icon: BookOpen }, shared[0], { path: "requests", label: "Yêu cầu phê duyệt", icon: ClipboardCheck }, shared[1]],
  teacher: [{ path: "", label: "Tổng quan", icon: LayoutDashboard }, { path: "classes", label: "Lớp phụ trách", icon: BookOpen }, ...shared],
  student: [{ path: "", label: "Tổng quan", icon: LayoutDashboard }, { path: "classes", label: "Lớp học", icon: BookOpen }, shared[0], { path: "schedule", label: "Lịch học", icon: CalendarDays }, shared[1]],
} satisfies Record<Role, { path: string; label: string; icon: typeof LayoutDashboard }[]>;
export const roleNames: Record<Role, string> = { admin: "Quản trị viên", teacher: "Giảng viên", student: "Học viên" };
export function isRole(role: string): role is Role { return ["admin", "teacher", "student"].includes(role); }
