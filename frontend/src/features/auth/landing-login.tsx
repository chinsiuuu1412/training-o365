"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { BookOpenCheck, CalendarClock, CheckCircle2, Lock, Mail, RefreshCw } from "lucide-react";
import { ApiClientError, formatApiError } from "@/lib/api-client";
import { roleToRoute } from "@/types/api";
import { useAuth } from "@/state/auth-provider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export function LandingLogin({ mode }: { mode: "landing" | "login" }) {
  const router = useRouter();
  const { status, user, errorMessage, restoreSession, login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (status === "authenticated" && user) {
      router.replace(`/${roleToRoute(user.role)}`);
    }
  }, [status, user, router]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitError(null);
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setSubmitError("Vui lòng nhập đầy đủ email và mật khẩu.");
      return;
    }
    setSubmitting(true);
    try {
      const nextUser = await login(trimmedEmail, password);
      router.replace(`/${roleToRoute(nextUser.role)}`);
    } catch (err) {
      if (err instanceof ApiClientError) {
        if (err.status === 401) {
          setSubmitError("Email hoặc mật khẩu không đúng.");
        } else if (err.code === "account_inactive") {
          setSubmitError("Tài khoản đã bị vô hiệu hóa. Liên hệ quản trị viên để được hỗ trợ.");
        } else {
          setSubmitError(formatApiError(err, "Không thể đăng nhập."));
        }
      } else {
        setSubmitError(formatApiError(err, "Không thể đăng nhập."));
      }
    } finally {
      setSubmitting(false);
    }
  }

  const targetRoute = user ? `/${roleToRoute(user.role)}` : null;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-white">
        <div className="mx-auto flex h-18 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <Link href="/" className="flex min-w-0 items-center gap-2.5 sm:gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-border/80 bg-white p-1">
              <Image
                src="/logo-o365.png"
                alt=""
                width={36}
                height={36}
                priority
                className="h-auto w-full object-contain"
              />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-base font-semibold tracking-tight text-foreground">
                CLB o365 - HUST
              </span>
              <span className="block truncate text-xs text-muted-foreground">
                Khóa học Kĩ năng mềm Microsoft Office
              </span>
            </span>
          </Link>
          {mode === "landing" ? (
            <Button asChild size="sm" variant="outline" className="shrink-0">
              <Link href="/login">Đăng nhập</Link>
            </Button>
          ) : (
            <Button asChild size="sm" variant="ghost" className="shrink-0">
              <Link href="/">Trang giới thiệu</Link>
            </Button>
          )}
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[1.2fr_0.9fr] lg:items-start lg:py-16">
        <section className="space-y-6">
          <div className="space-y-4">
            <h1 className="max-w-xl text-3xl font-semibold tracking-tight text-navy sm:text-4xl">
              Hệ thống học tập Khóa học Kĩ năng mềm bộ công cụ Microsoft cơ bản
            </h1>
            <p className="max-w-xl text-base leading-7 text-slate-600">
              Cổng học tập và quản lý lớp chính thức của CLB o365 - HUST: theo dõi lịch học đã duyệt, điểm danh bằng mã buổi học, hoàn thành bài kiểm tra và tra cứu tài liệu khóa học.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Card className="p-5">
              <CalendarClock size={20} className="text-primary" />
              <h2 className="mt-3 text-sm font-semibold">Lịch học & điểm danh</h2>
              <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
                Xem lịch học chính thức theo múi giờ Việt Nam, điểm danh bằng mã hoặc gửi báo vắng.
              </p>
            </Card>
            <Card className="p-5">
              <BookOpenCheck size={20} className="text-primary" />
              <h2 className="mt-3 text-sm font-semibold">Kiểm tra & đánh giá</h2>
              <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
                Làm bài thi và bài tập trực tuyến đồng bộ tiến độ trực tiếp với máy chủ.
              </p>
            </Card>
            <Card className="p-5">
              <CheckCircle2 size={20} className="text-primary" />
              <h2 className="mt-3 text-sm font-semibold">Theo dõi điều kiện</h2>
              <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
                Cập nhật rõ tỷ lệ chuyên cần, bài kiểm tra đạt và lý do chưa hoàn thành.
              </p>
            </Card>
          </div>

          <div className="rounded-xl border border-blue-100 bg-blue-50/70 p-4 text-sm text-slate-700">
            Tài khoản học viên, quản lý lớp và quản trị viên được cấp từ ban tổ chức CLB o365 - HUST. Nếu chưa có tài khoản hoặc quên mật khẩu, liên hệ quản trị viên để đặt lại.
          </div>
        </section>

        <Card className="p-6 sm:p-8">
          <h2 className="text-xl font-semibold text-foreground">Đăng nhập hệ thống</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Sử dụng email và mật khẩu được cấp để vào không gian làm việc của bạn.
          </p>

          {status === "loading" && (
            <div role="status" className="mt-5 rounded-lg border border-border bg-slate-50 px-4 py-3 text-sm text-slate-600">
              Đang kiểm tra phiên đăng nhập hiện tại…
            </div>
          )}

          {status === "error" && (
            <div role="alert" className="mt-5 flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <span>{errorMessage ?? "Không thể kết nối máy chủ để khôi phục phiên."}</span>
              <Button type="button" size="sm" variant="outline" onClick={() => void restoreSession()}>
                <RefreshCw size={14} />
                Thử lại
              </Button>
            </div>
          )}

          {status === "authenticated" && targetRoute && (
            <div className="mt-5 space-y-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
              <p>Bạn đã đăng nhập với tài khoản {user?.full_name}.</p>
              <Button asChild size="sm">
                <Link href={targetRoute}>Chuyển tới trang làm việc</Link>
              </Button>
            </div>
          )}

          <form onSubmit={(e) => void handleSubmit(e)} className="mt-6 space-y-4" noValidate>
            <div>
              <label htmlFor="login-email" className="mb-1.5 block text-sm font-medium text-foreground">
                Email
              </label>
              <div className="relative">
                <Mail size={16} className="pointer-events-none absolute left-3.5 top-3.5 text-slate-400" />
                <input
                  id="login-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ten.sv@sis.hust.edu.vn"
                  className="form-control pl-10"
                />
              </div>
            </div>

            <div>
              <label htmlFor="login-password" className="mb-1.5 block text-sm font-medium text-foreground">
                Mật khẩu
              </label>
              <div className="relative">
                <Lock size={16} className="pointer-events-none absolute left-3.5 top-3.5 text-slate-400" />
                <input
                  id="login-password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Nhập mật khẩu"
                  className="form-control pl-10"
                />
              </div>
            </div>

            {submitError && (
              <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                {submitError}
              </div>
            )}

            <Button type="submit" disabled={submitting} className="w-full">
              {submitting ? "Đang đăng nhập…" : "Đăng nhập"}
            </Button>
          </form>
        </Card>
      </main>
    </div>
  );
}