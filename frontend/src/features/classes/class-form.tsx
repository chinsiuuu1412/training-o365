"use client";

import { useEffect, useState } from "react";
import type { ClassDto, User } from "@/types/api";
import { adminUsersApi, classesApi, type ClassInputPayload } from "@/lib/lms-api";
import { toVietnamDateInput } from "@/lib/date";
import { ActionForm, Field } from "@/components/shared/management-ui";
import { LoadingState } from "@/components/shared/states";

export function ClassForm({
  course,
  onSaved,
  onCancel,
}: {
  course?: ClassDto;
  onSaved: () => Promise<void> | void;
  onCancel: () => void;
}) {
  const [managers, setManagers] = useState<User[]>([]);
  const [loadingManagers, setLoadingManagers] = useState(true);
  const [managerLoadError, setManagerLoadError] = useState<string | null>(null);
  const [managerId, setManagerId] = useState<string>(course ? String(course.manager_id) : "");

  useEffect(() => {
    let active = true;
    adminUsersApi
      .listAllActiveManagers()
      .then((list) => {
        if (!active) return;
        const merged = [...list];
        if (course && !merged.some((m) => m.id === course.manager_id)) {
          merged.unshift(course.manager);
        }
        setManagers(merged);
      })
      .catch((err) => {
        if (!active) return;
        setManagerLoadError(err instanceof Error ? err.message : "Không thể tải danh sách quản lý lớp.");
      })
      .finally(() => {
        if (active) setLoadingManagers(false);
      });
    return () => {
      active = false;
    };
  }, [course]);

  if (loadingManagers) {
    return <LoadingState label="Đang tải danh sách quản lý lớp" />;
  }

  if (managerLoadError) {
    return <p className="text-sm text-red-700">{managerLoadError}</p>;
  }

  const changedManager = Boolean(course) && Number(managerId) !== course?.manager_id;

  return (
    <ActionForm
      submitLabel={changedManager ? "Xác nhận đổi quản lý và lưu" : "Lưu lớp học"}
      onCancel={onCancel}
      onSubmit={async (data) => {
        const capacity = Number(data.get("capacity"));
        if (course && capacity < course.enrolled_count) {
          throw new Error(`Sĩ số tối đa không được nhỏ hơn sĩ số hiện tại (${course.enrolled_count}).`);
        }
        const selectedManagerId = Number(managerId);
        if (!selectedManagerId) {
          throw new Error("Vui lòng chọn quản lý lớp phụ trách.");
        }
        const confirmReassignment = Boolean(data.get("confirm_reassignment"));
        const reassignmentReason = String(data.get("reassignment_reason") ?? "").trim();
        if (changedManager && (!confirmReassignment || !reassignmentReason)) {
          throw new Error("Cần xác nhận đổi quản lý lớp và nhập lý do đầy đủ.");
        }

        const payload: ClassInputPayload = {
          code: String(data.get("code") ?? "").trim(),
          name: String(data.get("name") ?? "").trim(),
          description: String(data.get("description") ?? "").trim(),
          manager_id: selectedManagerId,
          capacity,
          end_date: String(data.get("end_date") ?? "").trim(),
          min_attendance_percent: Number(data.get("min_attendance_percent")),
          min_quiz_percent: Number(data.get("min_quiz_percent")),
          ...(changedManager
            ? {
                confirm_reassignment: true,
                reassignment_reason: reassignmentReason,
              }
            : {}),
        };

        if (course) {
          await classesApi.update(course.id, payload);
        } else {
          await classesApi.create(payload);
        }
        await onSaved();
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Mã lớp *">
          <input
            name="code"
            required
            maxLength={30}
            className="form-control"
            defaultValue={course?.code}
            placeholder="O365-01"
          />
        </Field>
        <Field label="Tên lớp *">
          <input
            name="name"
            required
            maxLength={150}
            className="form-control"
            defaultValue={course?.name}
          />
        </Field>
      </div>

      <Field label="Mô tả nội dung *">
        <textarea
          name="description"
          required
          maxLength={2000}
          className="form-control min-h-24"
          defaultValue={course?.description}
        />
      </Field>

      <Field label="Quản lý lớp phụ trách *">
        <select
          required
          className="form-control"
          value={managerId}
          onChange={(e) => setManagerId(e.target.value)}
        >
          <option value="">Chọn quản lý lớp</option>
          {managers.map((m) => (
            <option key={m.id} value={String(m.id)}>
              {m.full_name} ({m.email}){!m.is_active ? " · Đã vô hiệu hóa" : ""}
            </option>
          ))}
        </select>
      </Field>

      {changedManager && (
        <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          <p>
            Đổi quản lý lớp sẽ bàn giao quyền xử lý yêu cầu ghi danh, lịch học và điểm danh cho quản lý mới; dữ liệu học viên và tiến độ được giữ nguyên.
          </p>
          <Field label="Lý do đổi quản lý lớp *">
            <textarea
              name="reassignment_reason"
              required
              maxLength={1000}
              className="form-control min-h-20"
            />
          </Field>
          <label className="flex items-start gap-2 text-sm font-medium">
            <input type="checkbox" name="confirm_reassignment" required className="mt-1 size-4" />
            <span>Tôi xác nhận chuyển quyền phụ trách lớp này.</span>
          </label>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Sĩ số tối đa *"
          hint={course ? `Hiện có ${course.enrolled_count} học viên đang học.` : undefined}
        >
          <input
            name="capacity"
            type="number"
            min={course ? Math.max(1, course.enrolled_count) : 1}
            step={1}
            required
            className="form-control tabular-nums"
            defaultValue={course?.capacity ?? 40}
          />
        </Field>
        <Field label="Ngày kết thúc (UTC+7) *">
          <input
            name="end_date"
            type="date"
            min={toVietnamDateInput(new Date())}
            required
            className="form-control tabular-nums"
            defaultValue={course?.end_date}
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Điểm danh tối thiểu (%) *">
          <input
            name="min_attendance_percent"
            type="number"
            min={0}
            max={100}
            step={1}
            required
            className="form-control tabular-nums"
            defaultValue={course?.min_attendance_percent ?? 80}
          />
        </Field>
        <Field label="Quiz đạt tối thiểu (%) *">
          <input
            name="min_quiz_percent"
            type="number"
            min={0}
            max={100}
            step={1}
            required
            className="form-control tabular-nums"
            defaultValue={course?.min_quiz_percent ?? 70}
          />
        </Field>
      </div>
    </ActionForm>
  );
}
