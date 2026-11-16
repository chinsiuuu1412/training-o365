import { StatusBadge } from "@/components/shared/status-badge";

export function SessionScheduleStatus({
  approvedProposalId,
  startsAt,
  endsAt,
  latestProposalStatus,
  nowMs,
}: {
  approvedProposalId: number | null;
  startsAt: string | null;
  endsAt: string | null;
  latestProposalStatus?: "draft" | "pending" | "approved" | "rejected";
  nowMs: number;
}) {
  if (approvedProposalId && startsAt && endsAt) {
    const startMs = Date.parse(startsAt);
    const endMs = Date.parse(endsAt);
    if (nowMs >= endMs) {
      return <StatusBadge status="completed" label="Đã kết thúc" />;
    }
    if (nowMs >= startMs) {
      return <StatusBadge status="active" label="Đang diễn ra" />;
    }
    return <StatusBadge status="approved" label="Đã duyệt lịch" />;
  }
  if (latestProposalStatus === "pending") {
    return <StatusBadge status="pending" label="Chờ Admin duyệt" />;
  }
  if (latestProposalStatus === "rejected") {
    return <StatusBadge status="rejected" label="Bị từ chối" />;
  }
  return <StatusBadge status="draft" label="Bản nháp" />;
}
