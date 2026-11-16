  import {
    LayoutDashboard,
    Users,
    UserCog,
    BookOpen,
    LibraryBig,
    Bell,
    CalendarClock,
    CalendarDays,
  } from "lucide-react";
  import type { RouteRole } from "@/types/api";

  export interface NavItem {
    path: string;
    label: string;
    icon: typeof LayoutDashboard;
  }

  export const navigation: Record<RouteRole, NavItem[]> = {
    admin: [
      { path: "", label: "Tổng quan", icon: LayoutDashboard },
      { path: "students", label: "Học viên", icon: Users },
      { path: "managers", label: "Quản lý lớp", icon: UserCog },
      { path: "classes", label: "Lớp học", icon: BookOpen },
      { path: "schedule-proposals", label: "Duyệt lịch", icon: CalendarClock },
      { path: "library", label: "Thư viện", icon: LibraryBig },
      { path: "notifications", label: "Thông báo", icon: Bell },
    ],
    manager: [
      { path: "", label: "Tổng quan", icon: LayoutDashboard },
      { path: "classes", label: "Lớp phụ trách", icon: BookOpen },
      { path: "library", label: "Thư viện", icon: LibraryBig },
      { path: "notifications", label: "Thông báo", icon: Bell },
    ],
    student: [
      { path: "", label: "Tổng quan", icon: LayoutDashboard },
      { path: "classes", label: "Lớp học", icon: BookOpen },
      { path: "schedule", label: "Lịch học", icon: CalendarDays },
      { path: "library", label: "Thư viện", icon: LibraryBig },
      { path: "notifications", label: "Thông báo", icon: Bell },
    ],
  };

  export const roleNames: Record<RouteRole, string> = {
    admin: "Quản trị viên",
    manager: "Quản lý lớp",
    student: "Học viên",
  };

  export function isRouteRole(role: string): role is RouteRole {
    return role === "admin" || role === "manager" || role === "student";
  }
