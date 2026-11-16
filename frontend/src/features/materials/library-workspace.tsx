"use client";

import { useCallback, useEffect, useState } from "react";
import { ExternalLink, FileText, Pencil, Plus, Search, Video } from "lucide-react";
import type { ClassDto, MaterialDto, Page, RouteRole, SessionDto } from "@/types/api";
import { fetchAllPages, formatApiError } from "@/lib/api-client";
import { classesApi, materialsApi, sessionsApi } from "@/lib/lms-api";
import { formatVietnamDateTime } from "@/lib/date";
import { getMaterialActionPermissions } from "@/lib/class-helpers";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState, ErrorState, LoadingState } from "@/components/shared/states";
import { ConfirmAction, Feedback, Field } from "@/components/shared/management-ui";
import { PaginationBar } from "@/components/shared/pagination-bar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { MaterialForm } from "./material-form";

export function LibraryWorkspace({
  role,
  classId: fixedClassId,
  isExpired,
}: {
  role: RouteRole;
  classId?: number;
  isExpired?: boolean;
}) {
  const [classes, setClasses] = useState<ClassDto[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<number | null>(fixedClassId ?? null);
  const [fixedClassExpired, setFixedClassExpired] = useState<boolean>(isExpired ?? true);
  const [fixedClassMetaReady, setFixedClassMetaReady] = useState<boolean>(
    !fixedClassId || isExpired !== undefined,
  );
  const [sessions, setSessions] = useState<SessionDto[]>([]);
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [materialType, setMaterialType] = useState<"" | "document" | "video">("");
  const [sessionId, setSessionId] = useState<string>("");
  const [data, setData] = useState<Page<MaterialDto> | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("");
  const [editing, setEditing] = useState<MaterialDto | "new" | null>(null);

  useEffect(() => {
    if (fixedClassId) {
      queueMicrotask(() => setSelectedClassId(fixedClassId));
      if (isExpired !== undefined) {
        queueMicrotask(() => {
          setFixedClassExpired(isExpired);
          setFixedClassMetaReady(true);
        });
        return;
      }
      const controller = new AbortController();
      queueMicrotask(() => {
        if (!controller.signal.aborted) {
          setFixedClassMetaReady(false);
        }
      });
      classesApi
        .get(role, fixedClassId, controller.signal)
        .then((res) => {
          if (controller.signal.aborted) return;
          setFixedClassExpired(res.class.is_expired);
          setFixedClassMetaReady(true);
        })
        .catch(() => {
          if (controller.signal.aborted) return;
          setFixedClassExpired(true);
          setFixedClassMetaReady(true);
        });
      return () => controller.abort();
    }
    let active = true;
    fetchAllPages<ClassDto>((p, ps) => classesApi.list(role, { page: p, page_size: ps }))
      .then((list) => {
        if (!active) return;
        setClasses(list);
        if (list.length > 0) {
          setSelectedClassId((prev) => (prev && list.some((c) => c.id === prev) ? prev : list[0].id));
        } else {
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!active) return;
        setError(formatApiError(err, "Không thể tải danh sách lớp."));
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [role, fixedClassId, isExpired]);

  useEffect(() => {
    if (!selectedClassId) return;
    const controller = new AbortController();
    sessionsApi
      .listAll(role, selectedClassId, controller.signal)
      .then(setSessions)
      .catch(() => {
        // Session filter list is supplemental.
      });
    return () => controller.abort();
  }, [role, selectedClassId]);

  const loadMaterials = useCallback(
    async (signal?: AbortSignal) => {
      if (!selectedClassId) return;
      setLoading(true);
      setError(null);
      try {
        const res = await materialsApi.list(
          role,
          selectedClassId,
          {
            search: search || undefined,
            material_type: materialType || undefined,
            session_id: sessionId ? Number(sessionId) : undefined,
            page,
            page_size: 12,
          },
          signal,
        );
        setData(res);
      } catch (err) {
        if (signal?.aborted) return;
        setError(formatApiError(err, "Không thể tải danh sách tài liệu."));
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [role, selectedClassId, search, materialType, sessionId, page],
  );

  useEffect(() => {
    if (!selectedClassId) return;
    const controller = new AbortController();
    queueMicrotask(() => {
      if (!controller.signal.aborted) void loadMaterials(controller.signal);
    });
    return () => controller.abort();
  }, [selectedClassId, loadMaterials]);

  const activeClass = classes.find((c) => c.id === selectedClassId);
  const isClassExpired = fixedClassId
    ? isExpired !== undefined
      ? isExpired
      : !fixedClassMetaReady || fixedClassExpired
    : activeClass
      ? activeClass.is_expired
      : true;
  const canCreate = role === "manager" && selectedClassId !== null && !isClassExpired;

  return (
    <div className="dashboard-page space-y-6">
      <PageHeader
        title={fixedClassId ? "Tài liệu lớp học" : "Thư viện liên kết tài liệu"}
        description="Lưu trữ và chia sẻ liên kết HTTPS chính thức tới tài liệu hoặc video học tập (Google Drive, OneDrive, YouTube…)."
        actions={
          canCreate ? (
            <Button size="sm" onClick={() => setEditing("new")}>
              <Plus size={15} />
              Thêm liên kết tài liệu
            </Button>
          ) : undefined
        }
      />

      <Feedback message={feedback} />
      {error && data && <Feedback message={error} error />}

      {!fixedClassId && classes.length === 0 && !loading ? (
        <Card>
          <EmptyState
            title="Chưa có lớp học khả dụng"
            description="Bạn cần thuộc ít nhất một lớp học để xem tài liệu của lớp đó."
          />
        </Card>
      ) : (
        <>
          <Card className="p-5">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setPage(1);
                setSearch(searchInput.trim());
              }}
              className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5"
            >
              {!fixedClassId && (
                <Field label="Lớp học">
                  <select
                    className="form-control"
                    value={selectedClassId ?? ""}
                    onChange={(e) => {
                      setSelectedClassId(Number(e.target.value));
                      setSessionId("");
                      setPage(1);
                    }}
                  >
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.code} · {c.name}
                      </option>
                    ))}
                  </select>
                </Field>
              )}

              <Field label="Tìm tài liệu">
                <div className="relative">
                  <Search size={16} className="pointer-events-none absolute left-3 top-3.5 text-slate-400" />
                  <input
                    type="search"
                    className="form-control pl-9"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    placeholder="Tên hoặc mô tả…"
                  />
                </div>
              </Field>

              <Field label="Loại">
                <select
                  className="form-control"
                  value={materialType}
                  onChange={(e) => {
                    setPage(1);
                    setMaterialType(e.target.value as "" | "document" | "video");
                  }}
                >
                  <option value="">Tất cả</option>
                  <option value="document">Tài liệu (Document)</option>
                  <option value="video">Video</option>
                </select>
              </Field>

              <Field label="Buổi học">
                <select
                  className="form-control"
                  value={sessionId}
                  onChange={(e) => {
                    setPage(1);
                    setSessionId(e.target.value);
                  }}
                >
                  <option value="">Tất cả buổi</option>
                  {sessions.map((s) => (
                    <option key={s.id} value={String(s.id)}>
                      Buổi {s.session_number}: {s.title}
                    </option>
                  ))}
                </select>
              </Field>

              <div className="flex items-end">
                <Button type="submit" variant="outline" className="w-full">
                  Lọc tài liệu
                </Button>
              </div>
            </form>
          </Card>

          {loading && !data ? (
            <LoadingState label="Đang tải tài liệu" />
          ) : error && !data ? (
            <ErrorState message={error} onRetry={() => void loadMaterials()} />
          ) : !data || data.items.length === 0 ? (
            <Card>
              <EmptyState
                title="Chưa có tài liệu nào"
                description="Thử đổi bộ lọc hoặc đợi Quản lý lớp cập nhật liên kết tài liệu mới."
              />
            </Card>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {data.items.map((item) => {
                  const Icon = item.material_type === "video" ? Video : FileText;
                  const linkedSession = sessions.find((s) => s.id === item.session_id);
                  const perms = getMaterialActionPermissions({
                    role,
                    isClassExpired,
                    deletedAt: item.deleted_at,
                  });
                  return (
                    <Card key={item.id} className="flex flex-col justify-between space-y-4 p-5">
                      <div className="space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <span className="flex size-9 items-center justify-center rounded-lg bg-blue-50 text-primary">
                            <Icon size={18} />
                          </span>
                          <div className="flex flex-wrap items-center gap-1.5">
                            {perms.isDeleted && <StatusBadge status="deleted" />}
                            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
                              {item.material_type === "video" ? "Video" : "Tài liệu"}
                            </span>
                          </div>
                        </div>
                        <h2 className="text-base font-semibold">{item.title}</h2>
                        {item.description && (
                          <p className="text-sm leading-6 text-muted-foreground">{item.description}</p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          {linkedSession
                            ? `Buổi ${linkedSession.session_number}: ${linkedSession.title}`
                            : "Tài liệu chung toàn lớp"}
                        </p>
                        <p className="tabular-nums text-xs text-muted-foreground">
                          {item.expires_at
                            ? `Hạn xem: ${formatVietnamDateTime(item.expires_at)} (YouTube miễn hạn)`
                            : "Không giới hạn thời gian riêng"}
                        </p>
                        {perms.isDeleted && (
                          <p className="tabular-nums text-xs text-red-700">
                            Đã xóa lúc {formatVietnamDateTime(item.deleted_at)}
                            {item.deletion_reason ? ` · Lý do: ${item.deletion_reason}` : ""}
                          </p>
                        )}
                      </div>

                      {(perms.canOpen || perms.canEdit || perms.canDelete) && (
                        <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
                          {perms.canOpen && (
                            <Button asChild size="sm" variant="outline">
                              <a href={item.url} target="_blank" rel="noopener noreferrer">
                                <ExternalLink size={14} />
                                Mở liên kết ngoài
                              </a>
                            </Button>
                          )}

                          {perms.canEdit && (
                            <Button size="sm" variant="outline" onClick={() => setEditing(item)}>
                              <Pencil size={14} />
                              Sửa
                            </Button>
                          )}

                          {perms.canDelete &&
                            (role === "manager" || role === "admin") &&
                            selectedClassId && (
                            <ConfirmAction
                              title={`Xóa tài liệu "${item.title}"?`}
                              description="Tài liệu sẽ không còn truy cập được và lý do xóa được ghi vào nhật ký hệ thống."
                              trigger="Xóa"
                              onConfirm={async (reason) => {
                                await materialsApi.remove(role, selectedClassId, item.id, reason);
                                setFeedback(`Đã xóa tài liệu "${item.title}".`);
                                await loadMaterials();
                              }}
                            />
                          )}
                        </div>
                      )}
                    </Card>
                  );
                })}
              </div>

              <PaginationBar
                page={data.page}
                pageSize={data.page_size}
                total={data.total}
                onPageChange={setPage}
              />
            </>
          )}
        </>
      )}

      {selectedClassId && !isClassExpired && (
        <Dialog
          open={editing !== null}
          onOpenChange={(open) => {
            if (!open) setEditing(null);
          }}
          title={editing === "new" ? "Thêm liên kết tài liệu" : "Chỉnh sửa tài liệu"}
          description="Chỉ chấp nhận đường dẫn HTTPS hợp lệ."
        >
          {editing && (
            <MaterialForm
              key={editing === "new" ? "new" : editing.id}
              classId={selectedClassId}
              sessions={sessions}
              material={editing === "new" ? undefined : editing}
              onCancel={() => setEditing(null)}
              onSaved={async () => {
                setEditing(null);
                setFeedback("Đã lưu thông tin tài liệu.");
                await loadMaterials();
              }}
            />
          )}
        </Dialog>
      )}
    </div>
  );
}
