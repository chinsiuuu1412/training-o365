"use client";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Bell, ChevronLeft, ChevronRight, CircleHelp, GraduationCap, Menu, Settings, ShieldCheck } from "lucide-react";
import { MotionConfig } from "motion/react";
import { navigation, roleNames } from "@/config/navigation";
import type { Role } from "@/types/lms";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { useAuth, managementEnabled, schedulingEnabled, communicationsEnabled } from "@/state/auth-provider";
import { useApiResource } from "@/state/api-data-provider";
import { staticDestination, stripBasePath } from "@/config/routes";
import { LoadingState } from "@/components/shared/states";


export function AppShell({ role, children, demoControls, unreadNotifications = 0 }: { role: Role; children: ReactNode; demoControls?: ReactNode; unreadNotifications?: number }) {
  const pathname = usePathname().replace(/\/$/, "");
  const query = useSearchParams();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [logoutError, setLogoutError] = useState("");
  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 1024px)");
    const closeDrawerOnDesktop = () => { if (desktop.matches) setMobileOpen(false); };
    desktop.addEventListener("change", closeDrawerOnDesktop);
    return () => desktop.removeEventListener("change", closeDrawerOnDesktop);
  }, []);
  const focusedAssessment = role === "student" && !!query.get("quizId");
  const base = `/${role}`;
  const activePath = pathname;
  const active = navigation[role].find(item => item.path ? (activePath === `${base}/${item.path}` || activePath.startsWith(`${base}/${item.path}/`)) : activePath === base);
  const accountSection = pathname.slice(base.length + 1).split("/")[0];
  const pageTitle = active?.label ?? ({ profile: "Hồ sơ cá nhân", settings: "Cài đặt tài khoản", "schedule-approvals": "Duyệt lịch học" } as Record<string, string>)[accountSection] ?? "Không tìm thấy trang";
  const { user, status, logout, fixtureMode } = useAuth();
  const ready = status === "authenticated";
  const name = user?.name ?? "";
  const inboxCount = useApiResource('inbox-unread', async services => communicationsEnabled ? services.messages.unreadCount() : unreadNotifications);
  const unread = {notifications: inboxCount.data ?? 0};
  const menu = navigation[role].filter(item => managementEnabled ? ["", "classes", "students", "managers", "schedule", ...(schedulingEnabled ? ["schedule-approvals"] : []), ...(communicationsEnabled ? ["library", "notifications"] : [])].includes(item.path) : item.path === "");
  if (!user) return <LoadingState />;

  function sidebar(compact: boolean) {
    return <div className="flex min-h-full flex-col px-4 py-6">
      <Link href={base} onClick={() => setMobileOpen(false)} className={cn("mb-7 flex items-center gap-3 px-2", compact && "justify-center px-0")} aria-label="CLB o365 HUST — Trang tổng quan"><span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-blue-500"><GraduationCap size={25} /></span>{!compact && <span><span className="block text-xl font-semibold tracking-tight">o365<span className="text-teal-300"> HUST</span></span><span className="text-[10px] tracking-[.17em] text-slate-400">KHÓA HỌC KĨ NĂNG MỀM</span></span>}</Link>
      {!compact && <p className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-[.18em] text-slate-400">Không gian quản lý</p>}
      <nav aria-label="Điều hướng chính" className="space-y-1.5">{menu.map(item => {
        const href = item.path ? `${base}/${item.path}` : base;
        const selected = item === active;
        const unreadCount = item.path === "notifications" ? unread.notifications : 0;
        return <Link key={item.path} href={href} onClick={() => setMobileOpen(false)} aria-current={selected ? "page" : undefined} aria-label={`${item.label}${unreadCount ? ` (${unreadCount} chưa đọc)` : ""}`} title={compact ? item.label : undefined} className={cn("flex min-h-11 items-center gap-3 rounded-lg px-3 text-[13px] font-medium transition-colors", compact && "justify-center px-2", selected ? "bg-primary text-white shadow-sm" : "text-slate-300 hover:bg-white/8 hover:text-white")}><item.icon size={18} strokeWidth={1.7} />{!compact && <span>{item.label}</span>}{ready && unreadCount > 0 && <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-red-400" />}</Link>;
      })}</nav>
      <div className="mt-auto pt-6"><Link href={`${base}/settings`} onClick={() => setMobileOpen(false)} className="flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm text-slate-300 transition-colors duration-200 hover:bg-white/8" aria-label="Cài đặt tài khoản"><Settings size={18} />{!compact && "Cài đặt tài khoản"}</Link>{!compact && <div className="mt-5 flex items-center gap-2 border-t border-white/10 px-3 pt-5 text-xs text-slate-400"><ShieldCheck size={14} />{fixtureMode ? "Chế độ mô phỏng" : "Tài khoản LMS"}</div>}</div>
    </div>;
  }
  return <MotionConfig reducedMotion="user"><div onClickCapture={event => { if(event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;const anchor=(event.target as Element).closest("a");if(!anchor||anchor.target==="_blank")return;const url=new URL(anchor.href,window.location.origin);if(url.origin!==window.location.origin)return;const path=stripBasePath(url.pathname);const target=path===null?null:staticDestination(path+url.search);if(target){event.preventDefault();event.stopPropagation();router.push(target);} }} className={cn("min-h-screen bg-background", focusedAssessment && "assessment-focused")}><a href="#main-content" className="skip-link">Đến nội dung chính</a>
    <aside className={cn("fixed inset-y-0 left-0 z-30 hidden overflow-y-auto bg-navy text-white transition-[width] duration-200 lg:block", collapsed ? "w-20" : "w-64", focusedAssessment && "!hidden")}>{sidebar(collapsed)}</aside>
    <Sheet open={mobileOpen && !focusedAssessment} onOpenChange={setMobileOpen}>{sidebar(false)}</Sheet>
    <div className={cn("min-w-0 transition-[padding] duration-200", focusedAssessment ? "" : collapsed ? "lg:pl-20" : "lg:pl-64")}>
      <header className="flex h-16 items-center sm:h-20 justify-between gap-3 border-b border-border bg-white px-4 sm:px-6 lg:px-8"><div className="flex min-w-0 items-center gap-3"><Button variant="ghost" size="icon" className="lg:hidden" aria-label="Mở điều hướng" aria-haspopup="dialog" aria-expanded={mobileOpen} onClick={() => setMobileOpen(true)}><Menu /></Button><Button variant="ghost" size="icon" className="hidden lg:inline-flex" aria-label={collapsed ? "Mở rộng thanh bên" : "Thu gọn thanh bên"} aria-expanded={!collapsed} onClick={() => setCollapsed(!collapsed)}>{collapsed ? <ChevronRight /> : <ChevronLeft />}</Button><nav aria-label="Đường dẫn" className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground"><Link href={base} className="hidden hover:text-primary sm:inline">{roleNames[role]}</Link><ChevronRight size={13} className="hidden sm:inline" /><span className="truncate font-medium text-foreground">{pageTitle}</span></nav></div>
      <div className="flex shrink-0 items-center gap-2 sm:gap-5">{communicationsEnabled && <Button asChild variant="ghost" size="icon" className="relative" aria-label={`Xem thông báo (${unread.notifications} chưa đọc)`}><Link href={`${base}/notifications`}><Bell size={19} />{ready && unread.notifications > 0 && <span className="absolute right-2.5 top-2 size-1.5 rounded-full bg-red-500" />}</Link></Button>}<div className="hidden h-7 w-px bg-border sm:block" /><Link href={`${base}/profile`} className="flex items-center gap-3 rounded-lg" aria-label={`Hồ sơ ${name}`}><span className="flex size-9 items-center justify-center rounded-full bg-blue-50 text-xs font-semibold text-blue-700">{user.initials}</span><span className="hidden md:block"><span className="block text-xs font-semibold">{name}</span><span className="text-[11px] text-muted-foreground">{roleNames[role]}</span></span></Link></div></header>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-teal-100 bg-teal-50/60 px-4 py-2 text-xs sm:px-6 lg:px-8"><span className="flex items-center gap-2 text-slate-700"><CircleHelp size={13} />{fixtureMode ? "Chế độ mô phỏng · Tài khoản và dữ liệu tổng hợp" : "Phiên tài khoản · API approved-v2"}</span><Button size="sm" variant="outline" onClick={() => { void logout().then(() => router.replace('/login')).catch(cause => setLogoutError(cause instanceof Error ? cause.message : 'Không thể đăng xuất.')); }}>Đăng xuất / Đổi tài khoản</Button></div>{logoutError && <p role="alert" className="px-6 py-3 text-sm text-red-800">{logoutError}</p>}
      {!focusedAssessment && demoControls}
      <main id="main-content" tabIndex={-1} className="mx-auto min-w-0 max-w-[1600px] p-4 pb-8 outline-none sm:p-6 lg:p-8">{!ready ? <LoadingState /> : user.status === "suspended" ? <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-6"><h1 className="text-xl font-semibold text-red-800">Tài khoản đã bị vô hiệu hóa</h1><p className="mt-3 text-sm">{user.statusReason}</p><p className="mt-2 text-sm">Enrollment và dữ liệu lớp được giữ nguyên. Chọn vai trò Admin để khôi phục tài khoản trong bản demo.</p></div> : children}</main>
      <footer className="flex flex-wrap justify-between gap-2 px-4 pb-6 text-[11px] text-muted-foreground sm:px-6 lg:px-8"><span>CLB o365 HUST - Khóa học Kĩ năng mềm.</span><span>Phiên bản giao diện 0.1</span></footer>
    </div></div></MotionConfig>;
}
