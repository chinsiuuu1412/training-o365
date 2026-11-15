"use client";
import { useLms } from "@/state/lms-provider";
import type { Role } from "@/types/lms";
import { ConfirmAction, Feedback } from "@/components/shared/management-ui";
import { SimulationControls } from "./simulation-controls";

export function DemoControls({ role }: { role: Role }) {
  const { account, reset, storageError, migrationNotice } = useLms();
  return <div className="space-y-2 border-b border-border bg-white px-4 py-3 sm:px-6 lg:px-8"><div className="flex flex-wrap items-center justify-between gap-3"><p className="text-xs leading-6 text-slate-600">Chế độ mô phỏng · Tài khoản: <strong>{account(role).name}</strong> · Đổi tài khoản bằng đăng xuất rồi đăng nhập lại.</p><ConfirmAction title="Khôi phục dữ liệu demo v2?" description="Tạo lại bộ dữ liệu tổng hợp v2, thu hồi các phiên của bộ dữ liệu cũ. Kho v1 và kho ứng dụng khác được giữ nguyên." trigger="Khôi phục demo" needsReason={false} onConfirm={reset} /></div>{storageError && <Feedback error message={storageError} />}{migrationNotice && <Feedback message={migrationNotice} />}<SimulationControls /></div>;
}
