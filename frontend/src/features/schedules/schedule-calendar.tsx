"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, MapPin, RefreshCw } from "lucide-react";
import type { ClassSummary, DashboardDto } from "@/types/api";
import { formatApiError } from "@/lib/api-client";
import { dashboardApi } from "@/lib/lms-api";
import { formatVietnamDateTime, toVietnamDateInput } from "@/lib/date";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState, ErrorState, LoadingState } from "@/components/shared/states";

export function ScheduleCalendar() {
  const [data, setData] = useState<DashboardDto<ClassSummary> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState("");

  const todayVn = toVietnamDateInput(new Date());
  const [month, setMonth] = useState(() => todayVn.slice(0, 7));

  const loadSchedule = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const res = await dashboardApi.get<ClassSummary>("student", signal);
      setData(res);
    } catch (err) {
      if (signal?.aborted) return;
      setError(formatApiError(err, "Không thể tải lịch học."));
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      if (!controller.signal.aborted) void loadSchedule(controller.signal);
    });
    return () => controller.abort();
  }, [loadSchedule]);

  const classMap = useMemo(() => {
    const map = new Map<number, ClassSummary>();
    data?.classes.forEach((entry) => map.set(entry.class.id, entry.class));
    return map;
  }, [data]);

  const sessions = data?.agenda.upcoming_sessions ?? [];
  const [year, monthNum] = month.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(year, monthNum, 0)).getUTCDate();
  const offset = (new Date(Date.UTC(year, monthNum - 1, 1)).getUTCDay() + 6) % 7;

  const sessionDayVn = (iso: string | null) => (iso ? toVietnamDateInput(new Date(iso)) : "");

  const visibleSessions = sessions.filter((s) => {
    const day = sessionDayVn(s.starts_at);
    return day.startsWith(month) && (!selectedDay || day === selectedDay);
  });

  function moveMonth(delta: number) {
    const d = new Date(Date.UTC(year, monthNum - 1 + delta, 1));
    setMonth(d.toISOString().slice(0, 7));
    setSelectedDay("");
  }

  return (
    <div className="dashboard-page space-y-6">
      <PageHeader
        title="Lịch học sắp tới"
        description="Hiển thị các buổi học đã được Admin phê duyệt thuộc các lớp bạn đang theo học (múi giờ Asia/Ho_Chi_Minh, UTC+7)."
        actions={
          <Button type="button" variant="outline" size="sm" onClick={() => void loadSchedule()}>
            <RefreshCw size={14} />
            Làm mới
          </Button>
        }
      />

      {loading && !data ? (
        <LoadingState label="Đang tải lịch học" />
      ) : error && !data ? (
        <ErrorState message={error} onRetry={() => void loadSchedule()} />
      ) : (
        <>
          <Card className="p-4 sm:p-6">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <h2 className="tabular-nums text-lg font-semibold">
                Tháng {monthNum}/{year}
              </h2>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => moveMonth(-1)} aria-label="Tháng trước">
                  ←
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setMonth(todayVn.slice(0, 7));
                    setSelectedDay("");
                  }}
                >
                  Tháng hiện tại
                </Button>
                <Button variant="outline" size="sm" onClick={() => moveMonth(1)} aria-label="Tháng sau">
                  →
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center text-xs">
              {["T2", "T3", "T4", "T5", "T6", "T7", "CN"].map((day) => (
                <span key={day} className="py-2 font-semibold text-muted-foreground">
                  {day}
                </span>
              ))}
              {Array.from({ length: offset }, (_, i) => (
                <span key={`blank-${i}`} />
              ))}
              {Array.from({ length: daysInMonth }, (_, idx) => {
                const day = `${month}-${String(idx + 1).padStart(2, "0")}`;
                const count = sessions.filter((s) => sessionDayVn(s.starts_at) === day).length;
                return (
                  <button
                    key={day}
                    type="button"
                    aria-label={`${day}, ${count} buổi học`}
                    aria-pressed={selectedDay === day}
                    onClick={() => setSelectedDay(selectedDay === day ? "" : day)}
                    className={`tabular-nums min-h-14 rounded-lg border p-1 transition-colors ${
                      selectedDay === day
                        ? "border-primary bg-blue-50 text-primary"
                        : "border-border hover:bg-slate-50"
                    }`}
                  >
                    <span className="block">{idx + 1}</span>
                    {count > 0 && (
                      <span className="mt-1 block text-[10px] font-semibold text-primary">
                        {count} buổi
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </Card>

          {visibleSessions.length === 0 ? (
            <Card>
              <EmptyState
                title="Không có buổi học trong thời gian đã chọn"
                description="Chuyển tháng hoặc bỏ chọn ngày để xem các buổi học sắp tới."
              />
            </Card>
          ) : (
            <div className="space-y-3">
              {visibleSessions.map((session) => {
                const cls = classMap.get(session.class_id);
                return (
                  <Card key={session.id} className="flex flex-wrap items-center justify-between gap-4 p-5">
                    <div>
                      <p className="text-xs font-medium text-primary">
                        {cls ? `${cls.code} · ${cls.name}` : `Lớp #${session.class_id}`}
                      </p>
                      <h3 className="mt-1 font-semibold">
                        Buổi {session.session_number}: {session.title}
                      </h3>
                      <p className="tabular-nums mt-1.5 flex items-center gap-1.5 text-sm text-muted-foreground">
                        <CalendarDays size={15} />
                        {formatVietnamDateTime(session.starts_at)} – {formatVietnamDateTime(session.ends_at)}
                      </p>
                      {session.location && (
                        <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                          <MapPin size={14} />
                          {session.location}
                        </p>
                      )}
                    </div>
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/student/classes/${session.class_id}?tab=lessons`}>
                        Vào buổi học & Điểm danh
                      </Link>
                    </Button>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
