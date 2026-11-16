"use client";

import { roleNames } from "@/config/navigation";
import { roleToRoute, type Gender } from "@/types/api";
import { useAuth } from "@/state/auth-provider";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card } from "@/components/ui/card";

const genderLabels: Record<Gender, string> = {
  male: "Nam",
  female: "Nữ",
  other: "Khác",
};

export function ProfileView() {
  const { user } = useAuth();
  if (!user) return null;

  const routeRole = roleToRoute(user.role);

  return (
    <div className="dashboard-page space-y-6">
      <PageHeader
        title="Hồ sơ cá nhân"
        description="Thông tin tài khoản được đồng bộ trực tiếp từ máy chủ. Nếu cần điều chỉnh thông tin học viên, vui lòng liên hệ quản trị viên."
      />

      <Card className="p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
          <div>
            <h2 className="text-lg font-semibold">{user.full_name}</h2>
            <p className="text-sm text-muted-foreground">{user.email}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
              {roleNames[routeRole]}
            </span>
            <StatusBadge status={user.is_active ? "active" : "suspended"} />
          </div>
        </div>

        <dl className="mt-5 grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs text-muted-foreground">Mã tài khoản</dt>
            <dd className="tabular-nums mt-1 text-sm font-medium">#{user.id}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Email đăng nhập</dt>
            <dd className="mt-1 text-sm font-medium">{user.email}</dd>
          </div>

          {user.role === "student" && (
            <>
              <div>
                <dt className="text-xs text-muted-foreground">MSSV</dt>
                <dd className="tabular-nums mt-1 text-sm font-medium">{user.student_id ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Trường / Viện</dt>
                <dd className="mt-1 text-sm font-medium">{user.school_or_institute ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Lớp sinh viên</dt>
                <dd className="mt-1 text-sm font-medium">{user.university_class ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Số điện thoại</dt>
                <dd className="tabular-nums mt-1 text-sm font-medium">{user.phone_number ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Giới tính</dt>
                <dd className="mt-1 text-sm font-medium">
                  {user.gender ? genderLabels[user.gender] : "Chưa cập nhật"}
                </dd>
              </div>
            </>
          )}
        </dl>
      </Card>
    </div>
  );
}