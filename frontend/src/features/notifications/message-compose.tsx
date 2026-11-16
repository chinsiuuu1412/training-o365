"use client";

import { useEffect, useMemo, useState } from "react";
import type { User } from "@/types/api";
import { roleNames } from "@/config/navigation";
import { roleToBackendRole } from "@/types/api";
import { announcementsApi } from "@/lib/lms-api";
import { formatApiError } from "@/lib/api-client";
import { ActionForm, Field } from "@/components/shared/management-ui";
import { LoadingState } from "@/components/shared/states";
import { Button } from "@/components/ui/button";

export function MessageCompose({
  role,
  onSent,
  onCancel,
}: {
  role: "admin" | "manager";
  onSent: (recipientCount: number) => Promise<void> | void;
  onCancel: () => void;
}) {
  const [recipients, setRecipients] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  useEffect(() => {
    let active = true;
    announcementsApi
      .listAllRecipients(role)
      .then((list) => {
        if (!active) return;
        const dedup = new Map<number, User>();
        for (const u of list) dedup.set(u.id, u);
        setRecipients([...dedup.values()]);
      })
      .catch((err) => {
        if (!active) return;
        setLoadError(formatApiError(err, "Không thể tải danh sách người nhận."));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [role]);

  const filtered = useMemo(() => {
    const q = search.trim().toLocaleLowerCase("vi");
    if (!q) return recipients;
    return recipients.filter((u) =>
      `${u.full_name} ${u.email} ${u.student_id ?? ""}`.toLocaleLowerCase("vi").includes(q),
    );
  }, [recipients, search]);

  if (loading) return <LoadingState label="Đang tải toàn bộ danh sách người nhận" />;
  if (loadError) return <p className="text-sm text-red-700">{loadError}</p>;

  function toggleOne(id: number, checked: boolean) {
    setSelectedIds((prev) =>
      checked ? [...new Set([...prev, id])] : prev.filter((item) => item !== id),
    );
  }

  function selectAllExpanded() {
    setSelectedIds([...new Set(recipients.map((u) => u.id))]);
  }

  function clearAll() {
    setSelectedIds([]);
  }

  return (
    <ActionForm
      submitLabel={`Gửi thông báo (${selectedIds.length})`}
      onCancel={onCancel}
      onSubmit={async () => {
        const cleanIds = [...new Set(selectedIds)];
        if (cleanIds.length === 0) {
          throw new Error("Vui lòng chọn ít nhất một người nhận.");
        }
        const res = await announcementsApi.send(role, {
          recipient_ids: cleanIds,
          title: title.trim(),
          content: content.trim(),
        });
        await onSent(res.recipient_count);
      }}
    >
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm font-medium">
            Người nhận * ({selectedIds.length}/{recipients.length} người)
          </span>
          <div className="flex gap-2">
            <Button type="button" size="sm" variant="outline" onClick={selectAllExpanded}>
              Chọn tất cả ({recipients.length})
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={clearAll}>
              Bỏ chọn
            </Button>
          </div>
        </div>

        <input
          type="search"
          className="form-control"
          placeholder="Lọc người nhận theo tên, email hoặc MSSV…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        {filtered.length === 0 ? (
          <p className="rounded-lg border border-border p-3 text-xs text-muted-foreground">
            Không có người nhận phù hợp.
          </p>
        ) : (
          <div className="max-h-56 space-y-2 overflow-y-auto rounded-xl border border-border p-3">
            {filtered.map((user) => {
              const r = user.role === "class_manager" ? "manager" : user.role;
              return (
                <label key={user.id} className="flex items-start gap-3 text-sm">
                  <input
                    type="checkbox"
                    className="mt-1 size-4 shrink-0"
                    checked={selectedIds.includes(user.id)}
                    onChange={(e) => toggleOne(user.id, e.target.checked)}
                  />
                  <span>
                    <span className="font-medium">{user.full_name}</span>
                    <span className="block text-xs text-muted-foreground">
                      {user.email} · {roleNames[r] ?? roleToBackendRole(r)}
                      {user.student_id ? ` · ${user.student_id}` : ""}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        )}
      </div>

      <Field label="Tiêu đề *">
        <input
          required
          maxLength={200}
          className="form-control"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </Field>
      <Field label="Nội dung *">
        <textarea
          required
          maxLength={5000}
          className="form-control min-h-32"
          value={content}
          onChange={(e) => setContent(e.target.value)}
        />
      </Field>
    </ActionForm>
  );
}
