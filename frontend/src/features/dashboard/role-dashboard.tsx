"use client";

import { useCallback, useEffect, useState } from "react";
import type { ClassDto, ClassSummary, DashboardDto, RouteRole } from "@/types/api";
import { formatApiError } from "@/lib/api-client";
import { dashboardApi } from "@/lib/lms-api";
import { useAuth } from "@/state/auth-provider";
import { DashboardSkeleton, ErrorState } from "@/components/shared/states";
import { Feedback } from "@/components/shared/management-ui";
import { AdminDashboard } from "./admin-dashboard";
import { ManagerDashboard } from "./manager-dashboard";
import { StudentDashboard } from "./student-dashboard";

const STAFF_POLL_MS = 180_000;

export function RoleDashboard({ role }: { role: RouteRole }) {
  const { user, sessionEpoch } = useAuth();
  const [data, setData] = useState<DashboardDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);

  const loadDashboard = useCallback(
    async (signal?: AbortSignal, silent = false) => {
      if (silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);
      try {
        const next = await dashboardApi.get(role, signal);
        setData(next);
        setLastUpdatedAt(new Date());
      } catch (err) {
        if (signal?.aborted) return;
        setError(formatApiError(err, "Không thể tải dữ liệu tổng quan."));
      } finally {
        if (!signal?.aborted) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [role],
  );

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      if (!controller.signal.aborted) {
        setData(null);
        void loadDashboard(controller.signal, false);
      }
    });

    let timer: ReturnType<typeof setInterval> | null = null;
    if (role === "admin" || role === "manager") {
      timer = setInterval(() => {
        void loadDashboard(undefined, true);
      }, STAFF_POLL_MS);
    }

    return () => {
      controller.abort();
      if (timer) clearInterval(timer);
    };
  }, [role, sessionEpoch, loadDashboard]);

  if (loading && !data) {
    return <DashboardSkeleton />;
  }

  if (!data) {
    return (
      <ErrorState
        message={error ?? "Không thể tải tổng quan."}
        onRetry={() => void loadDashboard(undefined, false)}
      />
    );
  }

  const refreshBanner = error ? <Feedback message={error} error /> : null;

  if (role === "admin") {
    return (
      <div className="space-y-4">
        {refreshBanner}
        <AdminDashboard
          data={data as DashboardDto<ClassDto>}
          onRefresh={() => void loadDashboard(undefined, true)}
          refreshing={refreshing}
          lastUpdatedAt={lastUpdatedAt}
        />
      </div>
    );
  }

  if (role === "manager") {
    return (
      <div className="space-y-4">
        {refreshBanner}
        <ManagerDashboard
          data={data as DashboardDto<ClassDto>}
          onRefresh={() => void loadDashboard(undefined, true)}
          refreshing={refreshing}
          lastUpdatedAt={lastUpdatedAt}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {refreshBanner}
      <StudentDashboard
        data={data as DashboardDto<ClassSummary>}
        displayName={user?.full_name ?? "Học viên"}
        onRefresh={() => void loadDashboard(undefined, true)}
        refreshing={refreshing}
      />
    </div>
  );
}
