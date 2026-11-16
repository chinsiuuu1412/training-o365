"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { CalendarClock, RefreshCw } from "lucide-react";
import type { Page, PendingScheduleProposal } from "@/types/api";
import { formatApiError } from "@/lib/api-client";
import { sessionsApi } from "@/lib/lms-api";
import { formatVietnamDateTime } from "@/lib/date";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState, ErrorState, LoadingState } from "@/components/shared/states";
import { ActionForm, Feedback, Field } from "@/components/shared/management-ui";
import { PaginationBar } from "@/components/shared/pagination-bar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";

export function ApprovalQueue() {
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Page<PendingScheduleProposal> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [selected, setSelected] = useState<{
    proposal: PendingScheduleProposal;
    decision: "approve" | "reject";
  } | null>(null);

  const loadProposals = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setError(null);
      try {
        const res = await sessionsApi.adminPendingProposals({ page, page_size: 20 }, signal);
        setData(res);
      } catch (err) {
        if (signal?.aborted) return;
        setError(formatApiError(err, "Không thể tải danh sách đề xuất lịch."));
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [page],
  );

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      if (!controller.signal.aborted) void loadProposals(controller.signal);
    });
    return () => controller.abort();
  }, [loadProposals]);

  return (
    <div className="dashboard-page space-y-6">
      <PageHeader
        title="Duyệt đề xuất lịch học"
        description="Các đề xuất lịch do Quản lý lớp gửi lên đang chờ Quản trị viên phê duyệt hoặc từ chối."
        actions={
          <Button type="button" variant="outline" size="sm" onClick={() => void loadProposals()}>
            <RefreshCw size={14} />
            Làm mới
          </Button>
        }
      />

      <Feedback message={message} />
      {error && data && <Feedback message={error} error />}

      {loading && !data ? (
        <LoadingState label="Đang tải đề xuất lịch học" />
      ) : error && !data ? (
        <ErrorState message={error} onRetry={() => void loadProposals()} />
      ) : !data || data.items.length === 0 ? (
        <Card>
          <EmptyState
            title="Không có đề xuất lịch chờ duyệt"
            description="Khi Quản lý lớp gửi đề xuất lịch mới, yêu cầu sẽ hiển thị tại đây."
          />
        </Card>
      ) : (
        <>
          <div className="space-y-3">
            {data.items.map((proposal) => (
              <Card key={proposal.id} className="space-y-3 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <CalendarClock size={16} className="text-primary" />
                      <h2 className="text-base font-semibold">
                        Lớp #{proposal.class_id} · Buổi {proposal.session_number}: {proposal.title}
                      </h2>
                      <StatusBadge status={proposal.status} />
                    </div>
                    <p className="tabular-nums mt-2 text-sm text-slate-700">
                      Thời gian đề xuất: {formatVietnamDateTime(proposal.starts_at)} –{" "}
                      {formatVietnamDateTime(proposal.ends_at)} (UTC+7)
                    </p>
                    <p className="tabular-nums mt-1 text-xs text-muted-foreground">
                      Đề xuất #{proposal.id} · Gửi lúc {formatVietnamDateTime(proposal.created_at)}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/admin/classes/${proposal.class_id}?tab=lessons`}>Xem lớp</Link>
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => setSelected({ proposal, decision: "approve" })}
                    >
                      Phê duyệt
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setSelected({ proposal, decision: "reject" })}
                    >
                      Từ chối
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          <PaginationBar
            page={data.page}
            pageSize={data.page_size}
            total={data.total}
            onPageChange={setPage}
          />
        </>
      )}

      <Dialog
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
        title={
          selected?.decision === "approve"
            ? "Phê duyệt lịch buổi học?"
            : "Từ chối đề xuất lịch?"
        }
        description={
          selected
            ? `Buổi ${selected.proposal.session_number}: ${selected.proposal.title} (${formatVietnamDateTime(selected.proposal.starts_at)})`
            : ""
        }
      >
        {selected && (
          <ActionForm
            onCancel={() => setSelected(null)}
            submitLabel={selected.decision === "approve" ? "Xác nhận phê duyệt" : "Xác nhận từ chối"}
            onSubmit={async (formData) => {
              const reason = String(formData.get("reason") ?? "").trim();
              await sessionsApi.adminReviewProposal(
                selected.proposal.class_id,
                selected.proposal.session_id,
                selected.proposal.id,
                selected.decision === "approve"
                  ? { decision: "approve" }
                  : { decision: "reject", reason },
              );
              setMessage(
                selected.decision === "approve"
                  ? `Đã phê duyệt lịch buổi ${selected.proposal.session_number}.`
                  : `Đã từ chối đề xuất lịch buổi ${selected.proposal.session_number}.`,
              );
              setSelected(null);
              await loadProposals();
            }}
          >
            {selected.decision === "reject" ? (
              <Field label="Lý do từ chối *">
                <textarea name="reason" required maxLength={1000} className="form-control min-h-24" />
              </Field>
            ) : (
              <p className="text-sm leading-6 text-slate-700">
                Lịch học sau khi duyệt sẽ hiển thị ngay cho Quản lý lớp và toàn bộ học viên đang theo học trong lớp.
              </p>
            )}
          </ActionForm>
        )}
      </Dialog>
    </div>
  );
}
