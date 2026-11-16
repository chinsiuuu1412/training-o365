"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Plus, RefreshCw } from "lucide-react";
import type {
  ClassDto,
  RouteRole,
  SessionDto,
} from "@/types/api";
import { formatApiError, getServerNowMs } from "@/lib/api-client";
import {
  beginLessonDetailLoad,
  hasReliableLessonDetail,
  INITIAL_LESSON_DETAIL_STATE,
  resolveLessonDetailError,
  resolveLessonDetailSuccess,
  type LessonDetailState,
} from "@/lib/class-helpers";
import { sessionsApi } from "@/lib/lms-api";
import { formatVietnamDateTime } from "@/lib/date";
import { AttachedMaterials } from "@/features/materials/attached-materials";
import { EmptyState, ErrorState, LoadingState } from "@/components/shared/states";
import { Feedback } from "@/components/shared/management-ui";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { LessonForm } from "./lesson-form";
import { LessonAttendance } from "./lesson-attendance";
import { SessionScheduleStatus } from "./lesson-status";

export function LessonWorkspace({
  role,
  classDto,
  enrollmentId,
}: {
  role: RouteRole;
  classDto: ClassDto;
  enrollmentId?: number | null;
}) {
  const [sessions, setSessions] = useState<SessionDto[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<LessonDetailState>(INITIAL_LESSON_DETAIL_STATE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [editorMode, setEditorMode] = useState<"new" | "draft" | null>(null);
  const [busySubmit, setBusySubmit] = useState(false);
  const detailAbortRef = useRef<AbortController | null>(null);

  const loadSessions = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setError(null);
      try {
        const list = await sessionsApi.listAll(role, classDto.id, signal);
        setSessions(list);
        setSelectedId((prev) =>
          prev && list.some((s) => s.id === prev) ? prev : list[0]?.id ?? null,
        );
      } catch (err) {
        if (signal?.aborted) return;
        setError(formatApiError(err, "Không thể tải danh sách buổi học."));
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [role, classDto.id],
  );

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      if (!controller.signal.aborted) void loadSessions(controller.signal);
    });
    return () => controller.abort();
  }, [loadSessions]);

  const loadDetail = useCallback(
    async (sessionId: number, externalSignal?: AbortSignal) => {
      detailAbortRef.current?.abort();
      const controller = new AbortController();
      detailAbortRef.current = controller;

      const onExternalAbort = () => controller.abort();
      if (externalSignal) {
        if (externalSignal.aborted) {
          controller.abort();
          return;
        }
        externalSignal.addEventListener("abort", onExternalAbort, { once: true });
      }

      setDetail((prev) => beginLessonDetailLoad(prev, sessionId));

      try {
        const res = await sessionsApi.get(role, classDto.id, sessionId, controller.signal);
        if (controller.signal.aborted) return;
        setDetail(resolveLessonDetailSuccess(sessionId, res.proposals ?? []));
      } catch (err) {
        if (
          controller.signal.aborted ||
          (err instanceof Error && err.name === "AbortError")
        ) {
          return;
        }
        setDetail((prev) =>
          resolveLessonDetailError(
            prev,
            sessionId,
            formatApiError(err, "Không thể tải chi tiết đề xuất lịch buổi học."),
          ),
        );
      } finally {
        externalSignal?.removeEventListener("abort", onExternalAbort);
      }
    },
    [role, classDto.id],
  );

  useEffect(() => {
    if (!selectedId) {
      detailAbortRef.current?.abort();
      return;
    }
    const controller = new AbortController();
    queueMicrotask(() => {
      if (!controller.signal.aborted) void loadDetail(selectedId, controller.signal);
    });
    return () => {
      controller.abort();
      detailAbortRef.current?.abort();
    };
  }, [selectedId, loadDetail]);

  const selected = sessions.find((s) => s.id === selectedId) ?? null;
  const activeProposals =
    selected && detail.sessionId === selected.id ? detail.proposals : [];
  const hasReliableDetail = hasReliableLessonDetail(detail, selected?.id ?? null);
  const detailLoading = Boolean(selected && detail.sessionId === selected.id && detail.loading);
  const detailError =
    selected && detail.sessionId === selected.id ? detail.error : null;
  const latestProposal = activeProposals[0];
  const draftProposal = activeProposals.find((p) => p.status === "draft");
  const hasPendingProposal = activeProposals.some((p) => p.status === "pending");
  const nowMs = getServerNowMs();
  const canCreate =
    role === "manager" &&
    !classDto.is_expired &&
    (classDto.total_sessions ?? 0) > 0 &&
    sessions.length < (classDto.total_sessions ?? 0);
  const sessionStarted =
    Boolean(selected?.starts_at) && nowMs >= Date.parse(selected!.starts_at!);
  const canEditSchedule =
    role === "manager" &&
    !classDto.is_expired &&
    selected !== null &&
    hasReliableDetail &&
    !sessionStarted &&
    !hasPendingProposal;

  return (
    <section className="space-y-5" aria-label="Buổi học và điểm danh">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Buổi học & điểm danh</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {classDto.total_sessions
              ? `${sessions.length}/${classDto.total_sessions} buổi đã khởi tạo`
              : "Quản lý lớp cần thiết lập tổng số buổi cố định ở tab Tổng quan trước."}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => void loadSessions()}>
            <RefreshCw size={14} />
            Làm mới
          </Button>
          {role === "manager" && (
            <Button size="sm" disabled={!canCreate} onClick={() => setEditorMode("new")}>
              <Plus size={15} />
              Tạo buổi học
            </Button>
          )}
        </div>
      </div>

      <Feedback message={message} />
      {error && <Feedback message={error} error />}

      {loading && sessions.length === 0 ? (
        <LoadingState label="Đang tải buổi học" />
      ) : error && sessions.length === 0 ? (
        <ErrorState message={error} onRetry={() => void loadSessions()} />
      ) : sessions.length === 0 ? (
        <Card>
          <EmptyState
            title={role === "student" ? "Chưa có buổi học được duyệt lịch" : "Chưa có buổi học"}
            description={
              role === "student"
                ? "Buổi học sẽ hiển thị sau khi Admin phê duyệt đề xuất lịch."
                : "Hãy thiết lập tổng số buổi ở Tổng quan rồi tạo các buổi học và gửi duyệt lịch."
            }
          />
        </Card>
      ) : (
        <div className="grid items-start gap-5 xl:grid-cols-[minmax(240px,0.75fr)_minmax(0,2fr)]">
          <Card className="overflow-hidden">
            <ul className="divide-y divide-border">
              {sessions.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    aria-pressed={selectedId === s.id}
                    onClick={() => {
                      setSelectedId(s.id);
                      setMessage("");
                    }}
                    className={`w-full space-y-1.5 p-4 text-left transition-colors hover:bg-blue-50 ${
                      selectedId === s.id ? "bg-blue-50 ring-2 ring-inset ring-blue-500" : ""
                    }`}
                  >
                    <span className="block text-sm font-semibold">
                      Buổi {s.session_number}: {s.title}
                    </span>
                    <SessionScheduleStatus
                      approvedProposalId={s.approved_proposal_id}
                      startsAt={s.starts_at}
                      endsAt={s.ends_at}
                      nowMs={nowMs}
                    />
                    <span className="tabular-nums block text-xs text-muted-foreground">
                      {s.starts_at
                        ? formatVietnamDateTime(s.starts_at)
                        : "Chưa có lịch được duyệt"}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </Card>

          {selected ? (
            <div className="min-w-0 space-y-5">
              <Card className="space-y-4 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-xl font-semibold">
                      Buổi {selected.session_number}: {selected.title}
                    </h3>
                    {selected.location && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Địa điểm: {selected.location}
                      </p>
                    )}
                  </div>
                  <SessionScheduleStatus
                    approvedProposalId={selected.approved_proposal_id}
                    startsAt={selected.starts_at}
                    endsAt={selected.ends_at}
                    latestProposalStatus={latestProposal?.status}
                    nowMs={nowMs}
                  />
                </div>

                {selected.description && (
                  <p className="whitespace-pre-wrap text-sm leading-7 text-slate-600">
                    {selected.description}
                  </p>
                )}

                {selected.starts_at && selected.ends_at ? (
                  <div className="tabular-nums rounded-xl bg-slate-50 p-4 text-sm leading-7">
                    <p>
                      <strong>Bắt đầu:</strong> {formatVietnamDateTime(selected.starts_at)} (UTC+7)
                    </p>
                    <p>
                      <strong>Kết thúc:</strong> {formatVietnamDateTime(selected.ends_at)} (UTC+7)
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Chưa có lịch học được duyệt.</p>
                )}

                {role === "manager" && (
                  <div className="space-y-3 border-t border-border pt-4">
                    {detailError && (
                      <ErrorState
                        message={detailError}
                        onRetry={() => void loadDetail(selected.id)}
                      />
                    )}

                    {detailLoading && !detail.loaded && (
                      <p className="text-xs text-muted-foreground">
                        Đang tải chi tiết đề xuất lịch…
                      </p>
                    )}

                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!canEditSchedule}
                        onClick={() => setEditorMode("draft")}
                      >
                        {draftProposal ? "Sửa bản nháp lịch" : "Đề xuất / Đổi lịch"}
                      </Button>

                      {draftProposal && (
                        <Button
                          size="sm"
                          disabled={busySubmit || !canEditSchedule}
                          onClick={async () => {
                            setBusySubmit(true);
                            setError(null);
                            try {
                              await sessionsApi.submitProposal(
                                classDto.id,
                                selected.id,
                                draftProposal.id,
                              );
                              setMessage("Đã gửi đề xuất lịch lên Admin duyệt.");
                              await loadDetail(selected.id);
                            } catch (err) {
                              setError(formatApiError(err, "Không thể gửi đề xuất lịch."));
                            } finally {
                              setBusySubmit(false);
                            }
                          }}
                        >
                          Gửi Admin duyệt
                        </Button>
                      )}
                    </div>

                    {hasPendingProposal && (
                      <p className="text-xs text-amber-800">
                        Đang có đề xuất lịch chờ Admin phê duyệt.
                      </p>
                    )}

                    {activeProposals.length > 0 && (
                      <div className="space-y-2 rounded-xl bg-slate-50 p-3 text-xs">
                        <p className="font-semibold text-slate-700">Lịch sử đề xuất lịch</p>
                        {activeProposals.map((p) => (
                          <div key={p.id} className="tabular-nums flex flex-wrap justify-between gap-2">
                            <span>
                              #{p.id} · {formatVietnamDateTime(p.starts_at)} –{" "}
                              {formatVietnamDateTime(p.ends_at)}
                            </span>
                            <span className="font-medium">
                              {p.status}
                              {p.reason ? ` (${p.reason})` : ""}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <AttachedMaterials role={role} classId={classDto.id} sessionId={selected.id} />
              </Card>

              <LessonAttendance
                key={`${role}-${selected.id}`}
                role={role}
                classId={classDto.id}
                session={selected}
                enrollmentId={enrollmentId}
                isExpired={classDto.is_expired}
              />
            </div>
          ) : null}
        </div>
      )}

      {role === "manager" && (
        <Dialog
          open={editorMode !== null}
          onOpenChange={(open) => {
            if (!open) setEditorMode(null);
          }}
          title={editorMode === "new" ? "Tạo buổi học mới" : "Đề xuất lịch buổi học"}
          description="Lưu bản nháp lịch hoặc gửi ngay lên Quản trị viên phê duyệt."
        >
          {editorMode && (
            <LessonForm
              key={editorMode === "new" ? "new" : selected?.id ?? "draft"}
              classDto={classDto}
              existingSessions={sessions}
              session={editorMode === "draft" ? selected ?? undefined : undefined}
              latestProposal={editorMode === "draft" ? draftProposal : undefined}
              onCancel={() => setEditorMode(null)}
              onSaved={async (sid) => {
                setEditorMode(null);
                setMessage("Đã lưu buổi học / bản nháp lịch.");
                await loadSessions();
                setSelectedId(sid);
                await loadDetail(sid);
              }}
            />
          )}
        </Dialog>
      )}
    </section>
  );
}
