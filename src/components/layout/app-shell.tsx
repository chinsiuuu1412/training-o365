"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Bell, BookOpen, ChevronLeft, ChevronRight, ChevronsUpDown, CircleHelp, GraduationCap, Menu, Settings, ShieldCheck } from "lucide-react";
import { MotionConfig } from "motion/react";
import { navigation, roleNames } from "@/config/navigation";
import type { Role } from "@/types/lms";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { useLms } from "@/state/lms-provider";
import { DemoControls } from "./demo-controls";
import { LoadingState } from "@/components/shared/states";
import { getUnreadCounts } from "@/mocks/services/communications";

export function AppShell({ role, children }: { role: Role; children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const focusedAssessment = role === "student" && pathname.includes("/quizzes/");
  const base = `/${role}`;
  const activePath = pathname === "/admin/schedule-approvals" ? "/admin/requests" : pathname;
  const active = navigation[role].find(item => item.path ? (activePath === `${base}/${item.path}` || activePath.startsWith(`${base}/${item.path}/`)) : activePath === base);
  const accountSection = pathname.slice(base.length + 1).split("/")[0];
  const pageTitle = active?.label ?? ({ profile: "Hồ sơ cá nhân", settings: "Cài đặt tài khoản", "schedule-approvals": "Phê duyệt lịch & điểm danh" } as Record<string, string>)[accountSection] ?? "Không tìm thấy trang";
  const { account, ready, state } = useLms();
  const user = account(role);
  const name = user.name;
  const unread = getUnreadCounts(state, user.id);

  function sidebar(compact: boolean) {
    return <div className="flex min-h-full flex-col px-4 py-6">
      <Link href={base} onClick={() => setMobileOpen(false)} className={cn("mb-10 flex items-center gap-3 px-2", compact && "justify-center px-0")} aria-label="Học Việt — Trang tổng quan"><span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-blue-500"><GraduationCap size={25} /></span>{!compact && <span><span className="block text-xl font-semibold tracking-tight">Học Việt<span className="text-blue-400">.</span></span><span className="text-[10px] tracking-[.17em] text-slate-400">KHÔNG NGỪNG HỌC HỎI</span></span>}</Link>
      {!compact && <p className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-[.18em] text-slate-400">Không gian quản lý</p>}
      <nav aria-label="Điều hướng chính" className="space-y-1.5">{navigation[role].map(item => {
        const href = item.path ? `${base}/${item.path}` : base;
        const selected = item === active;
        const unreadCount = item.path === "notifications" ? unread.notifications : item.path === "requests" ? unread.requests : 0;
        return <Link key={item.path} href={href} onClick={() => setMobileOpen(false)} aria-current={selected ? "page" : undefined} aria-label={`${item.label}${unreadCount ? ` (${unreadCount} chưa đọc)` : ""}`} title={compact ? item.label : undefined} className={cn("flex min-h-11 items-center gap-3 rounded-lg px-3 text-[13px] font-medium transition-colors", compact && "justify-center px-2", selected ? "bg-primary text-white shadow-sm" : "text-slate-300 hover:bg-white/8 hover:text-white")}><item.icon size={18} strokeWidth={1.7} />{!compact && <span>{item.label}</span>}{ready && unreadCount > 0 && <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-red-400" />}</Link>;
      })}</nav>
      <div className="mt-auto pt-14">{!compact && <div className="mb-6 rounded-xl border border-white/10 bg-white/5 p-4"><div className="mb-3 flex size-8 items-center justify-center rounded-lg bg-blue-400/15 text-blue-300"><BookOpen size={17} /></div><p className="text-sm font-medium">Cùng nhau tiến bộ</p><p className="mt-1.5 text-xs leading-5 text-slate-400">Một không gian kết nối tri thức và phát triển mỗi ngày.</p></div>}<Link href={`${base}/settings`} className="flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm text-slate-300 hover:bg-white/8" aria-label="Cài đặt tài khoản"><Settings size={18} />{!compact && "Cài đặt tài khoản"}</Link>{!compact && <div className="mt-5 flex items-center gap-2 border-t border-white/10 px-3 pt-5 text-xs text-slate-400"><ShieldCheck size={14} />Môi trường minh họa</div>}</div>
    </div>;
  }
  return <MotionConfig reducedMotion="user"><div className={cn("min-h-screen bg-background", focusedAssessment && "assessment-focused")}><a href="#main-content" className="skip-link">Đến nội dung chính</a>
    <aside className={cn("fixed inset-y-0 left-0 z-30 hidden overflow-y-auto bg-navy text-white transition-[width] duration-200 lg:block", collapsed ? "w-20" : "w-64", focusedAssessment && "!hidden")}>{sidebar(collapsed)}</aside>
    <Sheet open={mobileOpen && !focusedAssessment} onOpenChange={setMobileOpen}>{sidebar(false)}</Sheet>
    <div className={cn("min-w-0 transition-[padding] duration-200", focusedAssessment ? "" : collapsed ? "lg:pl-20" : "lg:pl-64")}>
      <header className="flex h-20 items-center justify-between gap-3 border-b border-border bg-white px-4 sm:px-6 lg:px-8"><div className="flex min-w-0 items-center gap-3"><Button variant="ghost" size="icon" className="lg:hidden" aria-label="Mở điều hướng" aria-haspopup="dialog" aria-expanded={mobileOpen} onClick={() => setMobileOpen(true)}><Menu /></Button><Button variant="ghost" size="icon" className="hidden lg:inline-flex" aria-label={collapsed ? "Mở rộng thanh bên" : "Thu gọn thanh bên"} aria-expanded={!collapsed} onClick={() => setCollapsed(!collapsed)}>{collapsed ? <ChevronRight /> : <ChevronLeft />}</Button><nav aria-label="Đường dẫn" className="flex items-center gap-2 text-sm text-muted-foreground"><Link href={base} className="hidden hover:text-primary sm:inline">{roleNames[role]}</Link><ChevronRight size={13} className="hidden sm:inline" /><span className="truncate font-medium text-foreground">{pageTitle}</span></nav></div>
      <div className="flex shrink-0 items-center gap-2 sm:gap-5"><Button asChild variant="ghost" size="icon" className="relative" aria-label={`Xem thông báo (${unread.notifications} chưa đọc)`}><Link href={`${base}/notifications`}><Bell size={19} />{ready && unread.notifications > 0 && <span className="absolute right-2.5 top-2 size-1.5 rounded-full bg-red-500" />}</Link></Button><div className="hidden h-7 w-px bg-border sm:block" /><Link href={`${base}/profile`} className="flex items-center gap-3 rounded-lg" aria-label={`Hồ sơ ${name}`}><span className="flex size-9 items-center justify-center rounded-full bg-blue-50 text-xs font-semibold text-blue-700">{user.initials}</span><span className="hidden md:block"><span className="block text-xs font-semibold">{name}</span><span className="text-[11px] text-muted-foreground">{roleNames[role]}</span></span></Link></div></header>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-blue-100 bg-blue-50/60 px-4 py-2 text-[11px] sm:px-6 lg:px-8"><span className="flex items-center gap-2 text-slate-600"><CircleHelp size={13} />Bản demo giao diện · Dữ liệu minh họa</span><label className="flex items-center gap-2 text-slate-600">Vai trò:<span className="relative"><select aria-label="Chuyển vai trò demo" value={role} onChange={e => router.push(`/${e.target.value}`)} className="appearance-none rounded-md border border-blue-100 bg-white py-1 pl-2 pr-7 font-medium text-blue-700">{Object.entries(roleNames).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select><ChevronsUpDown size={12} className="pointer-events-none absolute right-2 top-1.5" /></span></label></div>
      {!focusedAssessment && <DemoControls role={role} />}
      <main id="main-content" tabIndex={-1} className="mx-auto max-w-[1600px] p-4 pb-8 outline-none sm:p-6 lg:p-8">{!ready ? <LoadingState /> : user.status === "suspended" ? <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-6"><h1 className="text-xl font-semibold text-red-800">Tài khoản đã bị vô hiệu hóa</h1><p className="mt-3 text-sm">{user.statusReason}</p><p className="mt-2 text-sm">Enrollment và dữ liệu lớp được giữ nguyên. Chọn vai trò Admin để khôi phục tài khoản trong bản demo.</p></div> : children}</main>
      <footer className="flex flex-wrap justify-between gap-2 px-4 pb-6 text-[11px] text-muted-foreground sm:px-6 lg:px-8"><span>© 2026 Học Việt. Kết nối tri thức, kiến tạo tương lai.</span><span>Phiên bản giao diện 0.1</span></footer>
    </div></div></MotionConfig>;
}
