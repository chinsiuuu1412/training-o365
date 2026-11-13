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

export function AppShell({ role, children }: { role: Role; children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const base = `/${role}`;
  const active = navigation[role].find(item => item.path ? (pathname === `${base}/${item.path}` || pathname.startsWith(`${base}/${item.path}/`)) : pathname === base);
  const accountSection = pathname.slice(base.length + 1).split("/")[0];
  const pageTitle = active?.label ?? ({ profile: "Hồ sơ cá nhân", settings: "Cài đặt tài khoản" } as Record<string, string>)[accountSection] ?? "Không tìm thấy trang";
  const name = role === "admin" ? "Nguyễn Minh Anh" : role === "teacher" ? "Trần Hoàng Nam" : "Nguyễn An";

  function sidebar(compact: boolean) {
    return <div className="flex min-h-full flex-col px-4 py-6">
      <Link href={base} onClick={() => setMobileOpen(false)} className={cn("mb-10 flex items-center gap-3 px-2", compact && "justify-center px-0")} aria-label="Học Việt — Trang tổng quan"><span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-blue-500"><GraduationCap size={25} /></span>{!compact && <span><span className="block text-xl font-semibold tracking-tight">Học Việt<span className="text-blue-400">.</span></span><span className="text-[10px] tracking-[.17em] text-slate-400">KHÔNG NGỪNG HỌC HỎI</span></span>}</Link>
      {!compact && <p className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-[.18em] text-slate-400">Không gian quản lý</p>}
      <nav aria-label="Điều hướng chính" className="space-y-1.5">{navigation[role].map(item => {
        const href = item.path ? `${base}/${item.path}` : base;
        const selected = item === active;
        return <Link key={item.path} href={href} onClick={() => setMobileOpen(false)} aria-current={selected ? "page" : undefined} aria-label={item.label} title={compact ? item.label : undefined} className={cn("flex min-h-11 items-center gap-3 rounded-lg px-3 text-[13px] font-medium transition-colors", compact && "justify-center px-2", selected ? "bg-primary text-white shadow-sm" : "text-slate-300 hover:bg-white/8 hover:text-white")}><item.icon size={18} strokeWidth={1.7} />{!compact && <span>{item.label}</span>}</Link>;
      })}</nav>
      <div className="mt-auto pt-14">{!compact && <div className="mb-6 rounded-xl border border-white/10 bg-white/5 p-4"><div className="mb-3 flex size-8 items-center justify-center rounded-lg bg-blue-400/15 text-blue-300"><BookOpen size={17} /></div><p className="text-sm font-medium">Cùng nhau tiến bộ</p><p className="mt-1.5 text-xs leading-5 text-slate-400">Một không gian kết nối tri thức và phát triển mỗi ngày.</p></div>}<Link href={`${base}/settings`} className="flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm text-slate-300 hover:bg-white/8" aria-label="Cài đặt tài khoản"><Settings size={18} />{!compact && "Cài đặt tài khoản"}</Link>{!compact && <div className="mt-5 flex items-center gap-2 border-t border-white/10 px-3 pt-5 text-xs text-slate-400"><ShieldCheck size={14} />Môi trường minh họa</div>}</div>
    </div>;
  }
  return <MotionConfig reducedMotion="user"><div className="min-h-screen bg-background"><a href="#main-content" className="skip-link">Đến nội dung chính</a>
    <aside className={cn("fixed inset-y-0 left-0 z-30 hidden overflow-y-auto bg-navy text-white transition-[width] duration-200 lg:block", collapsed ? "w-20" : "w-64")}>{sidebar(collapsed)}</aside>
    <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>{sidebar(false)}</Sheet>
    <div className={cn("min-w-0 transition-[padding] duration-200", collapsed ? "lg:pl-20" : "lg:pl-64")}>
      <header className="flex h-20 items-center justify-between gap-3 border-b border-border bg-white px-4 sm:px-6 lg:px-8"><div className="flex min-w-0 items-center gap-3"><Button variant="ghost" size="icon" className="lg:hidden" aria-label="Mở điều hướng" aria-haspopup="dialog" aria-expanded={mobileOpen} onClick={() => setMobileOpen(true)}><Menu /></Button><Button variant="ghost" size="icon" className="hidden lg:inline-flex" aria-label={collapsed ? "Mở rộng thanh bên" : "Thu gọn thanh bên"} aria-expanded={!collapsed} onClick={() => setCollapsed(!collapsed)}>{collapsed ? <ChevronRight /> : <ChevronLeft />}</Button><nav aria-label="Đường dẫn" className="flex items-center gap-2 text-sm text-muted-foreground"><Link href={base} className="hidden hover:text-primary sm:inline">{roleNames[role]}</Link><ChevronRight size={13} className="hidden sm:inline" /><span className="truncate font-medium text-foreground">{pageTitle}</span></nav></div>
      <div className="flex shrink-0 items-center gap-2 sm:gap-5"><Button asChild variant="ghost" size="icon" className="relative" aria-label="Xem thông báo"><Link href={`${base}/notifications`}><Bell size={19} /><span className="absolute right-2.5 top-2 size-1.5 rounded-full bg-primary" /></Link></Button><div className="hidden h-7 w-px bg-border sm:block" /><Link href={`${base}/profile`} className="flex items-center gap-3 rounded-lg" aria-label={`Hồ sơ ${name}`}><span className="flex size-9 items-center justify-center rounded-full bg-blue-50 text-xs font-semibold text-blue-700">{role === "admin" ? "MA" : role === "teacher" ? "HN" : "NA"}</span><span className="hidden md:block"><span className="block text-xs font-semibold">{name}</span><span className="text-[11px] text-muted-foreground">{roleNames[role]}</span></span></Link></div></header>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-blue-100 bg-blue-50/60 px-4 py-2 text-[11px] sm:px-6 lg:px-8"><span className="flex items-center gap-2 text-slate-600"><CircleHelp size={13} />Bản demo giao diện · Dữ liệu minh họa</span><label className="flex items-center gap-2 text-slate-600">Vai trò:<span className="relative"><select aria-label="Chuyển vai trò demo" value={role} onChange={e => router.push(`/${e.target.value}`)} className="appearance-none rounded-md border border-blue-100 bg-white py-1 pl-2 pr-7 font-medium text-blue-700">{Object.entries(roleNames).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select><ChevronsUpDown size={12} className="pointer-events-none absolute right-2 top-1.5" /></span></label></div>
      <main id="main-content" tabIndex={-1} className="mx-auto max-w-[1600px] p-4 pb-8 outline-none sm:p-6 lg:p-8">{children}</main>
      <footer className="flex flex-wrap justify-between gap-2 px-4 pb-6 text-[11px] text-muted-foreground sm:px-6 lg:px-8"><span>© 2026 Học Việt. Kết nối tri thức, kiến tạo tương lai.</span><span>Phiên bản giao diện 0.1</span></footer>
    </div></div></MotionConfig>;
}
