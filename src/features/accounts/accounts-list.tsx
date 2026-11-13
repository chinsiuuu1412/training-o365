"use client";
import { useState } from "react";
import { Plus } from "lucide-react";
import type { User } from "@/types/lms";
import { useLms } from "@/state/lms-provider";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/states";
import { ActionForm, ConfirmAction, DataTable, Feedback, Field } from "@/components/shared/management-ui";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";

export function AccountsList({ role }: { role: "student" | "teacher" }) {
  const { state, account, run } = useLms();
  const [query, setQuery] = useState(""); const [status, setStatus] = useState("all");
  const [editing, setEditing] = useState<User | "new" | null>(null); const [feedback, setFeedback] = useState("");
  const label = role === "student" ? "học viên" : "giảng viên";
  const rows = state.users.filter(u => u.role === role && `${u.name} ${u.email} ${u.phone}`.toLocaleLowerCase("vi").includes(query.trim().toLocaleLowerCase("vi")) && (status === "all" || (u.status ?? "active") === status));
  const user = typeof editing === "object" ? editing : null;
  return <div className="dashboard-page management-content space-y-6"><PageHeader eyebrow="Quản lý tài khoản" title={role === "student" ? "Học viên" : "Giảng viên"} description="Quản lý thông tin và trạng thái tài khoản. Vô hiệu hóa không xóa đăng ký lớp." actions={<Button onClick={() => setEditing("new")}><Plus />Thêm {label}</Button>} />
    <Feedback message={feedback} />
    <div className="flex flex-wrap gap-4"><Field label="Tìm tài khoản"><input className="form-control sm:w-72" value={query} onChange={e => setQuery(e.target.value)} placeholder="Họ tên, email, số điện thoại" /></Field><Field label="Trạng thái"><select className="form-control" value={status} onChange={e => setStatus(e.target.value)}><option value="all">Tất cả trạng thái</option><option value="active">Đang hoạt động</option><option value="suspended">Đã vô hiệu hóa</option></select></Field></div>
    <p className="text-sm text-muted-foreground" aria-live="polite">{rows.length} tài khoản phù hợp</p>
    {rows.length ? <DataTable caption={`Danh sách ${label}`} columns={["Họ tên", "Liên hệ", "Lớp học", "Trạng thái", "Thao tác"]}>{rows.map(row => <tr key={row.id} className="hover:bg-slate-50"><th scope="row" className="px-4 py-4 font-medium">{row.name}</th><td className="px-4 py-4"><p>{row.email}</p><p className="mt-1 text-xs text-muted-foreground">{row.phone || "Chưa có số điện thoại"}</p></td><td className="px-4 py-4">{role === "teacher" ? state.classes.filter(c => c.teacherId === row.id).length : state.enrollments.filter(e => e.studentId === row.id && e.status === "approved").length}</td><td className="px-4 py-4"><StatusBadge status={row.status === "suspended" ? "suspended" : "active"} />{row.statusReason && <p className="mt-2 max-w-56 text-xs leading-5 text-muted-foreground">{row.statusReason}</p>}</td><td className="px-4 py-4"><div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => setEditing(row)} aria-label={`Sửa tài khoản ${row.name}`}>Sửa</Button><ConfirmAction title={`${row.status === "suspended" ? "Khôi phục" : "Vô hiệu hóa"} ${row.name}?`} description="Enrollment, lớp phụ trách và kết quả học tập được giữ nguyên. Tài khoản vô hiệu hóa không được thao tác." trigger={row.status === "suspended" ? "Khôi phục" : "Vô hiệu hóa"} onConfirm={async reason => { await run(account("admin").id, { type: "setAccountStatus", userId: row.id, suspended: row.status !== "suspended", reason }); setFeedback(`Đã cập nhật trạng thái ${row.name}.`); }} /></div></td></tr>)}</DataTable> : <EmptyState title="Không tìm thấy tài khoản" description="Thử thay đổi từ khóa hoặc bộ lọc trạng thái." />}
    <Dialog open={editing !== null} onOpenChange={open => { if (!open) setEditing(null); }} title={`${user ? "Sửa" : "Thêm"} ${label}`} description="Họ tên và email bắt buộc. Đây là tài khoản mock; không tạo mật khẩu hoặc gửi email."><ActionForm key={user?.id ?? "new"} onCancel={() => setEditing(null)} onSubmit={async data => { await run(account("admin").id, { type: "saveAccount", userId: user?.id, role, name: String(data.get("name")), email: String(data.get("email")), phone: String(data.get("phone")) }); setEditing(null); setFeedback(`Đã ${user ? "cập nhật" : "thêm"} tài khoản ${label}.`); }}>
      <Field label="Họ tên *"><input className="form-control" name="name" required maxLength={120} defaultValue={user?.name ?? ""} autoComplete="name" /></Field><Field label="Email *"><input className="form-control" name="email" type="email" required maxLength={200} defaultValue={user?.email ?? ""} autoComplete="email" /></Field><Field label="Số điện thoại"><input className="form-control" name="phone" type="tel" maxLength={20} defaultValue={user?.phone ?? ""} autoComplete="tel" /></Field>
    </ActionForm></Dialog>
  </div>;
}
