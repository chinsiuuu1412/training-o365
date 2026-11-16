"use client";

import { useState } from "react";
import type { MaterialDto, SessionDto } from "@/types/api";
import { materialsApi } from "@/lib/lms-api";
import { fromVietnamDatetimeLocal, toVietnamDatetimeLocal } from "@/lib/date";
import { ActionForm, Field } from "@/components/shared/management-ui";

export function MaterialForm({
  classId,
  sessions,
  material,
  onSaved,
  onCancel,
}: {
  classId: number;
  sessions: SessionDto[];
  material?: MaterialDto;
  onSaved: () => Promise<void> | void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(material?.title ?? "");
  const [description, setDescription] = useState(material?.description ?? "");
  const [materialType, setMaterialType] = useState<"document" | "video">(
    material?.material_type ?? "document",
  );
  const [url, setUrl] = useState(material?.url ?? "");
  const [sessionId, setSessionId] = useState<string>(
    material?.session_id ? String(material.session_id) : "",
  );
  const [expiresAt, setExpiresAt] = useState<string>(
    toVietnamDatetimeLocal(material?.expires_at),
  );

  return (
    <ActionForm
      submitLabel={material ? "Cập nhật tài liệu" : "Thêm tài liệu"}
      onCancel={onCancel}
      onSubmit={async () => {
        const cleanUrl = url.trim();
        if (!cleanUrl.startsWith("https://")) {
          throw new Error("Đường dẫn tài liệu bắt buộc phải sử dụng giao thức https://");
        }
        const payload = {
          session_id: sessionId ? Number(sessionId) : null,
          title: title.trim(),
          description: description.trim(),
          material_type: materialType,
          url: cleanUrl,
          expires_at: expiresAt ? fromVietnamDatetimeLocal(expiresAt) : null,
        };
        if (material) {
          await materialsApi.update(classId, material.id, payload);
        } else {
          await materialsApi.create(classId, payload);
        }
        await onSaved();
      }}
    >
      <Field label="Tiêu đề tài liệu *">
        <input
          required
          maxLength={200}
          className="form-control"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </Field>

      <Field label="Đường dẫn HTTPS *">
        <input
          required
          type="url"
          pattern="https://.*"
          placeholder="https://..."
          className="form-control"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Loại tài liệu *">
          <select
            className="form-control"
            value={materialType}
            onChange={(e) => setMaterialType(e.target.value as "document" | "video")}
          >
            <option value="document">Tài liệu (Document)</option>
            <option value="video">Video</option>
          </select>
        </Field>

        <Field label="Gắn với buổi học (tùy chọn)">
          <select
            className="form-control"
            value={sessionId}
            onChange={(e) => setSessionId(e.target.value)}
          >
            <option value="">Tài liệu chung toàn lớp</option>
            {sessions.map((s) => (
              <option key={s.id} value={String(s.id)}>
                Buổi {s.session_number}: {s.title}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Mô tả">
        <textarea
          maxLength={2000}
          className="form-control min-h-24"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </Field>

      <Field
        label="Hạn xem riêng (giờ Việt Nam UTC+7)"
        hint="Để trống nếu không giới hạn thời gian. Liên kết YouTube được hệ thống miễn hạn xem riêng."
      >
        <input
          type="datetime-local"
          className="form-control"
          value={expiresAt}
          onChange={(e) => setExpiresAt(e.target.value)}
        />
      </Field>
    </ActionForm>
  );
}
