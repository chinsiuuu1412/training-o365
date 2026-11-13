"use client";
import { useLms } from "@/state/lms-provider";
import type { Role } from "@/types/lms";
import { ConfirmAction, Feedback } from "@/components/shared/management-ui";
import { SimulationControls } from "./simulation-controls";

export function DemoControls({ role }: { role: Role }) {
  const { state, account, selectAccount, reset, storageError, ready } = useLms();
  return <div className="space-y-2 border-b border-border bg-white px-4 py-3 sm:px-6 lg:px-8"><div className="flex flex-wrap items-center justify-between gap-3"><label className="flex min-w-0 flex-wrap items-center gap-2 text-xs text-slate-600">Tài khoản demo<select aria-label="Chọn tài khoản demo" value={account(role).id} disabled={!ready} onChange={e => selectAccount(role, e.target.value)} className="max-w-full rounded-lg border border-border bg-white px-3 py-2 text-sm">{state.users.filter(u => u.role === role).map(u => <option key={u.id} value={u.id}>{u.name}{u.status === "suspended" ? " · Đã vô hiệu hóa" : ""}</option>)}</select></label><ConfirmAction title="Khôi phục dữ liệu demo?" description="Xóa các thay đổi demo trong trình duyệt và trở về dữ liệu ban đầu. Các tab khác cũng được đồng bộ." trigger="Khôi phục demo" needsReason={false} onConfirm={reset} /></div>{storageError && <Feedback error message={storageError} />}<SimulationControls /></div>;
}
