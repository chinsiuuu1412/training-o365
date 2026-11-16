"use client";

import { useCallback, useEffect, useState } from "react";
import { Bell, MailCheck, MailOpen, Plus, RefreshCw } from "lucide-react";
import type { AnnouncementDto, Page, RouteRole } from "@/types/api";
import { formatApiError } from "@/lib/api-client";
import { announcementsApi } from "@/lib/lms-api";
import { formatVietnamDateTime } from "@/lib/date";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState, ErrorState, LoadingState } from "@/components/shared/states";
import { Feedback, Field } from "@/components/shared/management-ui";
import { PaginationBar } from "@/components/shared/pagination-bar";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { MessageCompose } from "./message-compose";

export function NotificationInbox({ role }: { role: RouteRole }) {
  const [page, setPage] = useState(1);
  const [readFilter, setReadFilter] = useState<"all" | "unread" | "read">("all");
  const [data, setData] = useState<Page<AnnouncementDto> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [composeOpen, setComposeOpen] = useState(false);
  const [detail, setDetail] = useState<AnnouncementDto | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const loadInbox = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setError(null);
      try {
        const res = await announcementsApi.list(
          {
            is_read:
              readFilter === "all" ? undefined : readFilter === "read",
            page,
            page_size: 20,
          },
          signal,
        );
        setData(res);
      } catch (err) {
        if (signal?.aborted) return;
        setError(formatApiError(err, "Không thể tải hộp thư thông báo."));
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [readFilter, page],
  );

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      if (!controller.signal.aborted) void loadInbox(controller.signal);
    });
    return () => controller.abort();
  }, [loadInbox]);

  async function openDetail(id: number) {
    setError(null);
    try {
      const res = await announcementsApi.get(id);
      setDetail(res.announcement);
    } catch (err) {
      setError(formatApiError(err, "Không thể tải chi tiết thông báo."));
    }
  }

  async function toggleRead(item: AnnouncementDto, nextRead: boolean) {
    setBusyId(item.id);
    setError(null);
    try {
      await announcementsApi.setRead(item.id, nextRead);
      if (detail?.id === item.id) {
        setDetail({ ...detail, is_read: nextRead ? 1 : 0 });
      }
      await loadInbox();
    } catch (err) {
      setError(formatApiError(err, "Không thể cập nhật trạng thái đọc."));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="dashboard-page space-y-6">
      <PageHeader
        title="Thông báo"
        description="Hộp thư thông báo nội bộ. Mở xem chi tiết không tự động đánh dấu đã đọc; sử dụng nút đánh dấu để cập nhật trạng thái."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => void loadInbox()}>
              <RefreshCw size={14} />
              Làm mới
            </Button>
            {(role === "admin" || role === "manager") && (
              <Button size="sm" onClick={() => setComposeOpen(true)}>
                <Plus size={15} />
                Gửi thông báo
              </Button>
            )}
          </div>
        }
      />

      <Feedback message={message} />
      {error && data && <Feedback message={error} error />}

      <Card className="flex flex-wrap items-end gap-4 p-5">
        <Field label="Lọc trạng thái đọc">
          <select
            className="form-control sm:w-56"
            value={readFilter}
            onChange={(e) => {
              setPage(1);
              setReadFilter(e.target.value as "all" | "unread" | "read");
            }}
          >
            <option value="all">Tất cả thông báo</option>
            <option value="unread">Chưa đọc</option>
            <option value="read">Đã đọc</option>
          </select>
        </Field>
      </Card>

      {loading && !data ? (
        <LoadingState label="Đang tải thông báo" />
      ) : error && !data ? (
        <ErrorState message={error} onRetry={() => void loadInbox()} />
      ) : !data || data.items.length === 0 ? (
        <Card>
          <EmptyState
            title="Không có thông báo"
            description="Các thông báo hệ thống và tin nhắn nội bộ sẽ xuất hiện tại đây."
          />
        </Card>
      ) : (
        <>
          <div className="space-y-3">
            {data.items.map((item) => {
              const isUnread = item.is_read === 0;
              return (
                <Card
                  key={item.id}
                  className={`space-y-3 p-5 ${isUnread ? "border-blue-200 bg-blue-50/40" : ""}`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-primary">
                        <Bell size={17} />
                      </span>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="text-base font-semibold">{item.title}</h2>
                          <StatusBadge status={isUnread ? "unread" : "read"} />
                          {item.automated === 1 && (
                            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-600">
                              Tự động
                            </span>
                          )}
                        </div>
                        <p className="tabular-nums mt-1 text-xs text-muted-foreground">
                          {formatVietnamDateTime(item.created_at)}
                          {item.class_id ? ` · Lớp #${item.class_id}` : ""}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => void openDetail(item.id)}
                      >
                        <MailOpen size={14} />
                        Xem chi tiết
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={busyId === item.id}
                        onClick={() => void toggleRead(item, isUnread)}
                      >
                        <MailCheck size={14} />
                        {isUnread ? "Đánh dấu đã đọc" : "Đánh dấu chưa đọc"}
                      </Button>
                    </div>
                  </div>
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

      {(role === "admin" || role === "manager") && (
        <Dialog
          open={composeOpen}
          onOpenChange={setComposeOpen}
          title="Gửi thông báo nội bộ"
          description="Chọn danh sách người nhận hợp lệ trong phạm vi quản lý của bạn."
        >
          {composeOpen && (
            <MessageCompose
              role={role}
              onCancel={() => setComposeOpen(false)}
              onSent={async (count) => {
                setComposeOpen(false);
                setMessage(`Đã gửi thông báo tới ${count} người nhận.`);
                await loadInbox();
              }}
            />
          )}
        </Dialog>
      )}

      <Dialog
        open={detail !== null}
        onOpenChange={(open) => {
          if (!open) setDetail(null);
        }}
        title={detail?.title ?? "Chi tiết thông báo"}
        description={detail ? formatVietnamDateTime(detail.created_at) : ""}
      >
        {detail && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={detail.is_read === 0 ? "unread" : "read"} />
              {detail.class_id && (
                <span className="tabular-nums text-xs text-muted-foreground">
                  Lớp #{detail.class_id}
                </span>
              )}
            </div>
            <p className="whitespace-pre-wrap break-words text-sm leading-7 text-slate-700">
              {detail.content}
            </p>
            <div className="flex justify-end gap-2 border-t border-border pt-4">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busyId === detail.id}
                onClick={() => void toggleRead(detail, detail.is_read === 0)}
              >
                {detail.is_read === 0 ? "Đánh dấu đã đọc" : "Đánh dấu chưa đọc"}
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}
