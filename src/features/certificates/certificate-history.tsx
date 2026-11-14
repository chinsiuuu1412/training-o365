"use client";

import type { Certificate, Role, User } from "@/types/lms";
import { useLms } from "@/state/lms-provider";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/states";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatDate } from "@/features/dashboard/dashboard-parts";
import { SnapshotProgress } from "@/features/progress/learner-progress";
import { CompletionProposal } from "./completion-actions";

export function CertificateRecord({ certificate, users }: { certificate: Certificate; users: User[] }) {
  return <Card className="min-w-0 space-y-5 p-5 sm:p-6">
    <p className="text-xs font-semibold leading-5 text-amber-900">CHỨNG CHỈ MÔ PHỎNG · KHÔNG PHẢI CHỨNG NHẬN CHÍNH THỨC</p>
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-lg font-semibold">{certificate.snapshot.className}</h3><p className="mt-2 text-sm">{certificate.snapshot.studentName}</p></div><StatusBadge status={certificate.status === "under-review" ? "underReview" : certificate.status} /></div>
    <p className="break-all font-mono text-xs text-muted-foreground">{certificate.id}</p>
    <p className="text-sm leading-6">Cấp lúc {formatDate(certificate.issuedAt)} · {certificate.basis === "exception" ? "Hoàn thành theo ngoại lệ đã được phê duyệt" : "Đạt tiêu chí thông thường sau khi chốt kết quả"}</p>
    <details className="dashboard-details"><summary className="cursor-pointer text-sm font-medium text-primary">Snapshot, lịch sử và log email mô phỏng</summary>
      <div className="mt-5 space-y-5">
        <SnapshotProgress snapshot={certificate.snapshot} />
        <section><h4 className="text-sm font-semibold">Lịch sử trạng thái</h4><ol className="mt-3 space-y-4">{certificate.history.map((event, index) => <li key={`${event.at}-${index}`} className="space-y-2 border-l-2 border-blue-100 pl-4 text-sm leading-6"><StatusBadge status={event.status === "under-review" ? "underReview" : event.status} /><p>{event.reason}</p><p className="text-xs text-muted-foreground">{formatDate(event.at)} · {users.find(user => user.id === event.actorId)?.name ?? "Hệ thống mô phỏng"}</p></li>)}</ol></section>
        <section><h4 className="text-sm font-semibold">Log email mô phỏng</h4><ul className="mt-3 space-y-3">{certificate.deliveries.map(delivery => <li key={delivery.id} className="break-words rounded-lg bg-slate-50 p-3 text-sm leading-6">{delivery.kind === "issuance" ? "Cấp chứng chỉ mock" : "Thông báo thu hồi mock"}<br />Người nhận {delivery.email || "Chưa có email"}<br /><span className="text-xs text-muted-foreground">{formatDate(delivery.at)} · Chỉ ghi log mô phỏng</span></li>)}</ul></section>
      </div>
    </details>
  </Card>;
}

export function CertificateHistory({ role, classId, studentId }: { role: Role; classId?: string; studentId?: string }) {
  const { state, account } = useLms();
  const actor = account(role);
  const certificates = (state.certificates ?? []).filter(certificate => {
    if (classId && certificate.classId !== classId) return false;
    if (studentId && certificate.studentId !== studentId) return false;
    if (role === "student") return certificate.studentId === actor.id;
    return role === "admin" || state.classes.some(course => course.id === certificate.classId && course.teacherId === actor.id);
  }).toReversed();
  return <section className="space-y-4"><h2 className="text-xl font-semibold">Chứng chỉ và lịch sử các lần học</h2>
    {certificates.length ? <div className="space-y-4">{certificates.map(certificate => <div key={certificate.id} className="space-y-3">
      <CertificateRecord certificate={certificate} users={state.users} />
      {role !== "student" && certificate.status !== "revoked" && <CompletionProposal role={role} classId={certificate.classId} studentId={certificate.studentId} kind="revoke" certificateId={certificate.id} trigger={`Đề xuất thu hồi · ${certificate.snapshot.studentName}`} />}
    </div>)}</div> : <EmptyState title="Chưa có chứng chỉ mô phỏng" description="Chứng chỉ được ghi nhận sau khi kết quả lớp đã chốt và đủ tiêu chí, hoặc có ngoại lệ được duyệt." />}
  </section>;
}
