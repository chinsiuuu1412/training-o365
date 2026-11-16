"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import {
  Bell,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Menu,
  Settings,
  ShieldCheck,
  User as UserIcon,
} from "lucide-react";
import { MotionConfig } from "motion/react";
import { navigation, roleNames } from "@/config/navigation";
import { roleToRoute, type RouteRole } from "@/types/api";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { useAuth } from "@/state/auth-provider";
import { ErrorState, LoadingState } from "@/components/shared/states";
import { announcementsApi } from "@/lib/lms-api";

function getInitials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "U";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function AppShell({ role, children }: { role: RouteRole; children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { status, user, errorMessage, restoreSession, logout, sessionEpoch } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loggingOut, setLoggingOut] = useState(false);

  const focusedAssessment = role === "student" && pathname.includes("/quizzes/");
  const base = `/${role}`;
  const active = navigation[role].find((item) =>
    item.path
      ? pathname === `${base}/${item.path}` || pathname.startsWith(`${base}/${item.path}/`)
      : pathname === base,
  );
  const accountSection = pathname.slice(base.length + 1).split("/")[0];
  const pageTitle =
    active?.label ??
    ({
      profile: "Hồ sơ cá nhân",
      settings: "Đổi mật khẩu",
      "schedule-proposals": "Duyệt lịch học",
    } as Record<string, string>)[accountSection] ??
    "Không gian học tập";

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
    }
  }, [status, router]);

  const userRouteRole = user ? roleToRoute(user.role) : null;
  const roleMatches = userRouteRole === role;

  useEffect(() => {
    if (status !== "authenticated" || !roleMatches) return;
    const controller = new AbortController();
    announcementsApi
      .list({ is_read: false, page: 1, page_size: 1 }, controller.signal)
      .then((page) => setUnreadCount(page.total))
      .catch(() => {
        // Unread badge fetch is non-blocking; main view handles errors.
      });
    return () => controller.abort();
  }, [status, roleMatches, pathname, sessionEpoch]);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await logout();
      router.replace("/login");
    } finally {
      setLoggingOut(false);
    }
  }

  function sidebar(compact: boolean) {
    return (
      <div className="flex min-h-full flex-col px-4 py-6">
        <Link
          href={base}
          onClick={() => setMobileOpen(false)}
          className={cn(
            "mb-10 flex min-h-11 items-center gap-3 rounded-lg px-2",
            compact && "justify-center px-0",
          )}
          aria-label="CLB o365 HUST — Trang tổng quan"
        >
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-white p-1 shadow-sm">
            <Image
              src="/logo-o365.png"
              alt=""
              width={36}
              height={36}
              priority
              className="h-auto w-full object-contain"
            />
          </span>
          {!compact && (
            <span>
              <span className="block text-lg font-semibold tracking-tight">
                CLB o365<span className="text-blue-400">.</span>
              </span>
              <span className="text-[10px] tracking-[.15em] text-slate-400">KĨ NĂNG MỀM HUST</span>
            </span>
          )}
        </Link>
        {!compact && (
          <p className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-[.16em] text-slate-400">
            Điều hướng
          </p>
        )}
        <nav aria-label="Điều hướng chính" className="space-y-1.5">
          {navigation[role].map((item) => {
            const href = item.path ? `${base}/${item.path}` : base;
            const selected = item === active;
            const badgeCount = item.path === "notifications" ? unreadCount : 0;
            return (
              <Link
                key={item.path}
                href={href}
                onClick={() => setMobileOpen(false)}
                aria-current={selected ? "page" : undefined}
                aria-label={`${item.label}${badgeCount > 0 ? ` (${badgeCount} chưa đọc)` : ""}`}
                title={compact ? item.label : undefined}
                className={cn(
                  "flex min-h-11 items-center justify-between gap-3 rounded-lg px-3 text-[13px] font-medium transition-colors",
                  compact && "justify-center px-2",
                  selected
                    ? "bg-primary text-white shadow-sm"
                    : "text-slate-300 hover:bg-white/8 hover:text-white",
                )}
              >
                <span className="flex items-center gap-3">
                  <item.icon size={18} strokeWidth={1.7} />
                  {!compact && <span>{item.label}</span>}
                </span>
                {badgeCount > 0 && (
                  <span
                    className={cn(
                      "tabular-nums rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-semibold text-white",
                      compact && "size-2 p-0",
                    )}
                    aria-hidden={compact ? "true" : undefined}
                  >
                    {compact ? "" : badgeCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto space-y-2 pt-10">
          {!compact && (
            <div className="mb-4 rounded-xl border border-white/10 bg-white/5 p-4">
              <div className="mb-2 flex size-8 items-center justify-center rounded-lg bg-blue-400/15 text-blue-300">
                <BookOpen size={17} />
              </div>
              <p className="text-sm font-medium">CLB o365 - HUST</p>
              <p className="mt-1 text-xs leading-5 text-slate-400">
                Khóa học Kĩ năng mềm bộ công cụ Microsoft cơ bản.
              </p>
            </div>
          )}
          <Link
            href={`${base}/profile`}
            onClick={() => setMobileOpen(false)}
            className="flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm text-slate-300 hover:bg-white/8 hover:text-white"
            aria-label="Hồ sơ cá nhân"
          >
            <UserIcon size={18} />
            {!compact && "Hồ sơ cá nhân"}
          </Link>
          <Link
            href={`${base}/settings`}
            onClick={() => setMobileOpen(false)}
            className="flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm text-slate-300 hover:bg-white/8 hover:text-white"
            aria-label="Đổi mật khẩu"
          >
            <Settings size={18} />
            {!compact && "Đổi mật khẩu"}
          </Link>
          <button
            type="button"
            disabled={loggingOut}
            onClick={() => void handleLogout()}
            className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-sm text-slate-300 hover:bg-white/8 hover:text-white disabled:opacity-60"
            aria-label="Đăng xuất"
          >
            <LogOut size={18} />
            {!compact && (loggingOut ? "Đang đăng xuất…" : "Đăng xuất")}
          </button>
          {!compact && (
            <div className="mt-4 flex items-center gap-2 border-t border-white/10 px-3 pt-4 text-xs text-slate-400">
              <ShieldCheck size={14} />
              Dữ liệu đồng bộ máy chủ
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <MotionConfig reducedMotion="user">
      <div className={cn("min-h-screen bg-background", focusedAssessment && "assessment-focused")}>
        <a href="#main-content" className="skip-link">
          Đến nội dung chính
        </a>
        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-30 hidden overflow-y-auto bg-navy text-white transition-[width] duration-200 lg:block",
            collapsed ? "w-20" : "w-64",
            focusedAssessment && "!hidden",
          )}
        >
          {sidebar(collapsed)}
        </aside>
        <Sheet open={mobileOpen && !focusedAssessment} onOpenChange={setMobileOpen}>
          {sidebar(false)}
        </Sheet>
        <div
          className={cn(
            "min-w-0 transition-[padding] duration-200",
            focusedAssessment ? "" : collapsed ? "lg:pl-20" : "lg:pl-64",
          )}
        >
          <header className="flex h-20 items-center justify-between gap-3 border-b border-border bg-white px-4 sm:px-6 lg:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden"
                aria-label="Mở điều hướng"
                aria-haspopup="dialog"
                aria-expanded={mobileOpen}
                onClick={() => setMobileOpen(true)}
              >
                <Menu />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="hidden lg:inline-flex"
                aria-label={collapsed ? "Mở rộng thanh bên" : "Thu gọn thanh bên"}
                aria-expanded={!collapsed}
                onClick={() => setCollapsed(!collapsed)}
              >
                {collapsed ? <ChevronRight /> : <ChevronLeft />}
              </Button>
              <nav aria-label="Đường dẫn" className="flex items-center gap-2 text-sm text-muted-foreground">
                <Link href={base} className="hidden hover:text-primary sm:inline">
                  {roleNames[role]}
                </Link>
                <ChevronRight size={13} className="hidden sm:inline" />
                <span className="truncate font-medium text-foreground">{pageTitle}</span>
              </nav>
            </div>
            {user && roleMatches && (
              <div className="flex shrink-0 items-center gap-2 sm:gap-4">
                <Button
                  asChild
                  variant="ghost"
                  size="icon"
                  className="relative"
                  aria-label={`Xem thông báo (${unreadCount} chưa đọc)`}
                >
                  <Link href={`${base}/notifications`}>
                    <Bell size={19} />
                    {unreadCount > 0 && (
                      <span className="absolute right-2.5 top-2 size-1.5 rounded-full bg-red-500" />
                    )}
                  </Link>
                </Button>
                <div className="hidden h-7 w-px bg-border sm:block" />
                <Link
                  href={`${base}/profile`}
                  className="flex items-center gap-3 rounded-lg"
                  aria-label={`Hồ sơ ${user.full_name}`}
                >
                  <span className="flex size-9 items-center justify-center rounded-full bg-blue-50 text-xs font-semibold text-blue-700">
                    {getInitials(user.full_name)}
                  </span>
                  <span className="hidden md:block">
                    <span className="block text-xs font-semibold">{user.full_name}</span>
                    <span className="text-[11px] text-muted-foreground">{roleNames[role]}</span>
                  </span>
                </Link>
              </div>
            )}
          </header>

          <main id="main-content" tabIndex={-1} className="mx-auto max-w-[1600px] p-4 pb-8 outline-none sm:p-6 lg:p-8">
            {status === "loading" || status === "unauthenticated" ? (
              <LoadingState label="Đang kiểm tra phiên đăng nhập" />
            ) : status === "error" ? (
              <ErrorState
                title="Không thể khôi phục phiên đăng nhập"
                message={errorMessage ?? "Kết nối tới máy chủ tạm gián đoạn."}
                onRetry={() => void restoreSession()}
              />
            ) : !roleMatches ? (
              <div role="alert" className="space-y-4 rounded-2xl border border-amber-200 bg-amber-50 p-6">
                <h1 className="text-lg font-semibold text-amber-950">
                  Không đúng vai trò truy cập
                </h1>
                <p className="text-sm text-amber-900">
                  Tài khoản hiện tại thuộc vai trò {userRouteRole ? roleNames[userRouteRole] : "khác"}, không có quyền mở khu vực {roleNames[role]}.
                </p>
                {userRouteRole && (
                  <Button asChild size="sm">
                    <Link href={`/${userRouteRole}`}>Về trang {roleNames[userRouteRole]}</Link>
                  </Button>
                )}
              </div>
            ) : (
              children
            )}
          </main>

          <footer className="flex flex-wrap justify-between gap-2 px-4 pb-6 text-[11px] text-muted-foreground sm:px-6 lg:px-8">
            <span>© 2026 CLB o365 - HUST · Khóa học Kĩ năng mềm Microsoft Office.</span>
            <span>Múi giờ hiển thị: Asia/Ho_Chi_Minh (UTC+7)</span>
          </footer>
        </div>
      </div>
    </MotionConfig>
  );
}
