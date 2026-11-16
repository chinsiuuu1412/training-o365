"use client";

import { useCallback, useEffect, useState } from "react";
import { KeyRound, Plus, Search } from "lucide-react";
import type { Gender, Page, User } from "@/types/api";
import { formatApiError } from "@/lib/api-client";
import { adminUsersApi, type CreateUserInput, type UpdateUserInput } from "@/lib/lms-api";
import { assertValidPasswordBytes, PASSWORD_POLICY_HINT } from "@/lib/password";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState, ErrorState, LoadingState } from "@/components/shared/states";
import {
  ActionForm,
  ConfirmAction,
  DataTable,
  Feedback,
  Field,
} from "@/components/shared/management-ui";
import { PaginationBar } from "@/components/shared/pagination-bar";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";

export function AccountsList({ roleFilter }: { roleFilter: "student" | "class_manager" }) {
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [data, setData] = useState<Page<User> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("");
  const [editing, setEditing] = useState<User | "new" | null>(null);
  const [resetTarget, setResetTarget] = useState<User | null>(null);

  const label = roleFilter === "student" ? "học viên" : "quản lý lớp";
  const title = roleFilter === "student" ? "Tài khoản Học viên" : "Tài khoản Quản lý lớp";

  const loadUsers = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setError(null);
      try {
        const res = await adminUsersApi.list(
          {
            role: roleFilter,
            search: search || undefined,
            is_active:
              statusFilter === "all" ? undefined : statusFilter === "active",
            page,
            page_size: 20,
          },
          signal,
        );
        setData(res);
      } catch (err) {
        if (signal?.aborted) return;
        setError(formatApiError(err, "Không thể tải danh sách tài khoản."));
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [roleFilter, search, statusFilter, page],
  );

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      if (!controller.signal.aborted) {
        void loadUsers(controller.signal);
      }
    });
    return () => controller.abort();
  }, [loadUsers]);

  const editingUser = typeof editing === "object" && editing !== null ? editing : null;

  return (
    <div className="dashboard-page management-content space-y-6">
      <PageHeader
        title={title}
        description="Tìm kiếm, tạo mới, cập nhật thông tin, đặt lại mật khẩu và khóa/mở khóa tài khoản."
        actions={
          <Button onClick={() => setEditing("new")}>
            <Plus size={16} />
            Thêm {label}
          </Button>
        }
      />

      <Feedback message={feedback} />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          setSearch(searchInput.trim());
        }}
        className="flex flex-wrap items-end gap-4"
      >
        <Field label="Tìm tài khoản">
          <div className="relative">
            <Search size={16} className="pointer-events-none absolute left-3 top-3.5 text-slate-400" />
            <input
              className="form-control pl-9 sm:w-72"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder={
                roleFilter === "student" ? "Họ tên, email hoặc MSSV" : "Họ tên hoặc email"
              }
            />
          </div>
        </Field>
        <Field label="Trạng thái">
          <select
            className="form-control"
            value={statusFilter}
            onChange={(e) => {
              setPage(1);
              setStatusFilter(e.target.value as "all" | "active" | "inactive");
            }}
          >
            <option value="all">Tất cả trạng thái</option>
            <option value="active">Đang hoạt động</option>
            <option value="inactive">Đã vô hiệu hóa</option>
          </select>
        </Field>
        <Button type="submit" variant="outline">
          Tìm kiếm
        </Button>
      </form>

      {loading && !data ? (
        <LoadingState label="Đang tải danh sách tài khoản" />
      ) : error && !data ? (
        <ErrorState message={error} onRetry={() => void loadUsers()} />
      ) : !data || data.items.length === 0 ? (
        <EmptyState
          title="Không có tài khoản phù hợp"
          description="Thử thay đổi từ khóa tìm kiếm hoặc bộ lọc trạng thái."
        />
      ) : (
        <>
          <DataTable
            caption={`Danh sách ${label}`}
            columns={
              roleFilter === "student"
                ? ["Họ tên & Email", "MSSV / Lớp", "Trường & SĐT", "Trạng thái", "Thao tác"]
                : ["Họ tên & Email", "Vai trò", "Trạng thái", "Thao tác"]
            }
          >
            {data.items.map((row) => (
              <tr key={row.id} className="hover:bg-slate-50">
                <th scope="row" className="px-4 py-3 font-medium">
                  <p>{row.full_name}</p>
                  <p className="mt-0.5 text-xs font-normal text-muted-foreground">{row.email}</p>
                </th>
                {roleFilter === "student" ? (
                  <>
                    <td className="tabular-nums px-4 py-3 text-xs">
                      <p className="font-medium">{row.student_id ?? "—"}</p>
                      <p className="mt-0.5 text-muted-foreground">{row.university_class ?? "—"}</p>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <p>{row.school_or_institute ?? "—"}</p>
                      <p className="tabular-nums mt-0.5 text-muted-foreground">
                        {row.phone_number ?? "—"}
                      </p>
                    </td>
                  </>
                ) : (
                  <td className="px-4 py-3 text-xs text-muted-foreground">Quản lý lớp</td>
                )}
                <td className="px-4 py-3">
                  <StatusBadge status={row.is_active ? "active" : "suspended"} />
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => setEditing(row)}>
                      Sửa
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setResetTarget(row)}>
                      <KeyRound size={14} />
                      Đặt lại mật khẩu
                    </Button>
                    <ConfirmAction
                      title={`${row.is_active ? "Vô hiệu hóa" : "Khôi phục"} ${row.full_name}?`}
                      description="Hệ thống giữ nguyên lịch sử học tập và ghi danh. Thay đổi trạng thái được ghi vào nhật ký hệ thống."
                      trigger={row.is_active ? "Vô hiệu hóa" : "Khôi phục"}
                      onConfirm={async (reason) => {
                        await adminUsersApi.setStatus(row.id, {
                          is_active: !row.is_active,
                          reason,
                        });
                        setFeedback(`Đã cập nhật trạng thái tài khoản ${row.full_name}.`);
                        await loadUsers();
                      }}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </DataTable>

          <PaginationBar
            page={data.page}
            pageSize={data.page_size}
            total={data.total}
            onPageChange={setPage}
          />
        </>
      )}

      <Dialog
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
        title={`${editingUser ? "Cập nhật" : "Tạo"} tài khoản ${label}`}
        description={
          roleFilter === "student"
            ? "Học viên cần email @sis.hust.edu.vn, MSSV 9 chữ số, Trường/Viện, Lớp sinh viên và số điện thoại Việt Nam."
            : "Quản lý lớp dùng họ tên, email hợp lệ và mật khẩu khi tạo mới."
        }
      >
        <ActionForm
          key={editingUser?.id ?? "new"}
          onCancel={() => setEditing(null)}
          onSubmit={async (formData) => {
            const full_name = String(formData.get("full_name") ?? "").trim();
            const email = String(formData.get("email") ?? "").trim();

            if (editingUser) {
              const payload: UpdateUserInput = {
                full_name,
                email,
              };
              if (roleFilter === "student") {
                const genderRaw = String(formData.get("gender") ?? "").trim();
                payload.student_id = String(formData.get("student_id") ?? "").trim();
                payload.school_or_institute = String(
                  formData.get("school_or_institute") ?? "",
                ).trim();
                payload.university_class = String(formData.get("university_class") ?? "").trim();
                payload.phone_number = String(formData.get("phone_number") ?? "").trim();
                payload.gender = (genderRaw || null) as Gender | null;
              }
              await adminUsersApi.update(editingUser.id, payload);
              setFeedback(`Đã cập nhật tài khoản ${full_name}.`);
            } else {
              const password = String(formData.get("password") ?? "");
              assertValidPasswordBytes(password, "Mật khẩu khởi tạo");
              const payload: CreateUserInput = {
                role: roleFilter,
                full_name,
                email,
                password,
              };
              if (roleFilter === "student") {
                const genderRaw = String(formData.get("gender") ?? "").trim();
                payload.student_id = String(formData.get("student_id") ?? "").trim();
                payload.school_or_institute = String(
                  formData.get("school_or_institute") ?? "",
                ).trim();
                payload.university_class = String(formData.get("university_class") ?? "").trim();
                payload.phone_number = String(formData.get("phone_number") ?? "").trim();
                payload.gender = (genderRaw || null) as Gender | null;
              }
              await adminUsersApi.create(payload);
              setFeedback(`Đã tạo tài khoản ${full_name}.`);
            }
            setEditing(null);
            await loadUsers();
          }}
        >
          <Field label="Họ và tên *">
            <input
              className="form-control"
              name="full_name"
              required
              maxLength={120}
              defaultValue={editingUser?.full_name ?? ""}
            />
          </Field>
          <Field
            label="Email *"
            hint={roleFilter === "student" ? "Phải dùng đuôi @sis.hust.edu.vn" : undefined}
          >
            <input
              className="form-control"
              name="email"
              type="email"
              required
              maxLength={200}
              defaultValue={editingUser?.email ?? ""}
            />
          </Field>
          {!editingUser && (
            <Field label="Mật khẩu khởi tạo *" hint={PASSWORD_POLICY_HINT}>
              <input
                className="form-control"
                name="password"
                type="password"
                required
                autoComplete="new-password"
              />
            </Field>
          )}
          {roleFilter === "student" && (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="MSSV (9 chữ số) *">
                  <input
                    className="form-control tabular-nums"
                    name="student_id"
                    required
                    pattern="[0-9]{9}"
                    maxLength={9}
                    defaultValue={editingUser?.student_id ?? ""}
                    placeholder="202312345"
                  />
                </Field>
                <Field label="Số điện thoại Việt Nam *">
                  <input
                    className="form-control tabular-nums"
                    name="phone_number"
                    type="tel"
                    required
                    maxLength={20}
                    defaultValue={editingUser?.phone_number ?? ""}
                    placeholder="0912345678"
                  />
                </Field>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Trường / Viện *">
                  <input
                    className="form-control"
                    name="school_or_institute"
                    required
                    maxLength={150}
                    defaultValue={editingUser?.school_or_institute ?? ""}
                    placeholder="Trường CNTT & TT"
                  />
                </Field>
                <Field label="Lớp sinh viên *">
                  <input
                    className="form-control"
                    name="university_class"
                    required
                    maxLength={80}
                    defaultValue={editingUser?.university_class ?? ""}
                    placeholder="IT1-01"
                  />
                </Field>
              </div>
              <Field label="Giới tính">
                <select
                  name="gender"
                  className="form-control"
                  defaultValue={editingUser?.gender ?? ""}
                >
                  <option value="">Không xác định</option>
                  <option value="male">Nam</option>
                  <option value="female">Nữ</option>
                  <option value="other">Khác</option>
                </select>
              </Field>
            </>
          )}
        </ActionForm>
      </Dialog>

      <Dialog
        open={resetTarget !== null}
        onOpenChange={(open) => {
          if (!open) setResetTarget(null);
        }}
        title={resetTarget ? `Đặt lại mật khẩu · ${resetTarget.full_name}` : "Đặt lại mật khẩu"}
        description="Mật khẩu mới sẽ thu hồi các phiên đăng nhập hiện tại của tài khoản này."
      >
        {resetTarget && (
          <ActionForm
            submitLabel="Đặt lại mật khẩu"
            onCancel={() => setResetTarget(null)}
            onSubmit={async (formData) => {
              const nextPassword = String(formData.get("new_password") ?? "");
              assertValidPasswordBytes(nextPassword, "Mật khẩu mới");
              await adminUsersApi.resetPassword(resetTarget.id, nextPassword);
              setFeedback(`Đã đặt lại mật khẩu cho ${resetTarget.full_name}.`);
              setResetTarget(null);
            }}
          >
            <Field label="Mật khẩu mới *" hint={PASSWORD_POLICY_HINT}>
              <input
                className="form-control"
                name="new_password"
                type="password"
                required
                autoComplete="new-password"
              />
            </Field>
          </ActionForm>
        )}
      </Dialog>
    </div>
  );
}
