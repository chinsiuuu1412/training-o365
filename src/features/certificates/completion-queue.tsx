"use client";

import { useState } from "react";
import type { Role } from "@/types/lms";
import { useLms } from "@/state/lms-provider";
import { getCompletionApprovers, getCompletionDecisionAccess, getCompletionEligibility, getEnrollmentCycle } from "@/mocks/services/completion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { ActionForm, ConfirmAction, Feedback, Field } from "@/components/shared/management-ui";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/states";
import { formatDate } from "@/features/dashboard/dashboard-parts";
import { LearnerProgress, SnapshotProgress } from "@/features/progress/learner-progress";

export function CompletionQueue({ role, classId }: { role: Role; classId: string }) {
  const { state, now, account, run, simulateTime } = useLms();
  const actor = account(role);
  const [filter, setFilter] = useState("waiting");
  const [decision, setDecision] = useState<{ id: string; approved: boolean; timeout: boolean } | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const course = state.classes.find(item => item.id === classId);
  const allowed = role === "admin" || (role === "teacher" && course?.teacherId === actor.id);
  const requests = allowed ? (state.completionRequests ?? []).filter(item => item.classId === classId && (filter === "all" || item.status === filter)).toReversed() : [];
  const selected = state.completionRequests?.find(item => item.id === decision?.id && item.classId === classId);

  return <section className="space-y-4">
    <div className="flex flex-wrap items-end justify-between gap-4"><div><h2 className="text-xl font-semibold">Hàng đợi duyệt hoàn thành & thu hồi</h2><p className="mt-2 text-sm text-muted-foreground">Teacher đề xuất → Admin duyệt. Admin đề xuất → Teacher duyệt.</p></div>
      <Field label="Trạng thái đề xuất"><select className="form-control" value={filter} onChange={event => setFilter(event.target.value)}><option value="waiting">Đang chờ</option><option value="approved">Đã duyệt</option><option value="declined">Từ chối</option><option value="cancelled">Đã đóng / hủy</option><option value="all">Tất cả</option></select></Field>
    </div>
    <Feedback message={error} error />
    {requests.length ? requests.map(request => {
      const access = getCompletionDecisionAccess(state, actor.id, request, now);
      const student = state.users.find(item => item.id === request.studentId);
      const appeal = state.completionAppeals?.find(item => item.id === request.appealId);
      const certificate = state.certificates?.find(item => item.id === request.certificateId);
      return <Card key={request.id} className="space-y-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3"><h3 className="text-lg font-semibold">{student?.name} · {request.kind === "exception" ? "Hoàn thành / cấp lại" : "Thu hồi chứng chỉ"}</h3><StatusBadge status={request.status} /></div>
        <p className="whitespace-pre-wrap break-words text-sm leading-6">{request.reason}</p>
        <p className="text-xs leading-6 text-muted-foreground">Đề xuất bởi {state.users.find(item => item.id === request.senderId)?.name} · {formatDate(request.createdAt)}<br />Bên duyệt {getCompletionApprovers(state, request).map(id => state.users.find(item => item.id === id)?.name).join(", ")}</p>
        <details className="dashboard-details" onToggle={event => {
          if (event.currentTarget.open) void run(actor.id, { type: "markRequestRead", source: "completion", requestId: request.id, read: true }, true).catch(cause => setError((cause as Error).message));
        }}><summary className="cursor-pointer text-sm font-medium text-primary">Xem hồ sơ xét duyệt</summary><div className="mt-4 space-y-4">
          {appeal && <p className="whitespace-pre-wrap text-sm leading-6">Khiếu nại gốc của học viên · {appeal.reason}</p>}
          {request.certificateId && <p className="break-all font-mono text-xs">Chứng chỉ {request.certificateId}</p>}
          {certificate && <SnapshotProgress snapshot={certificate.snapshot} />}
          {getEnrollmentCycle(state, classId, request.studentId) === request.enrollmentCycle && <LearnerProgress eligibility={getCompletionEligibility(state, classId, request.studentId, now)} />}
          {request.resolutionReason && <p className="whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm leading-6">Phản hồi · {request.resolutionReason}</p>}
          {request.resolvedAt && <p className="text-xs text-muted-foreground">{formatDate(request.resolvedAt)} · {request.status === "cancelled" ? "Đóng / hủy đề xuất" : request.decisionMode === "timeout" ? "Người đề xuất tự quyết sau 24 giờ" : "Quyết định duyệt chéo"}</p>}
        </div></details>
        {(access.crossApproval || access.timeout) && <div className="flex flex-wrap gap-3">
          <Button onClick={() => { setReason(""); setDecision({ id: request.id, approved: true, timeout: access.timeout }); }}>{access.timeout ? "Tự quyết Approve sau 24 giờ" : "Approve đề xuất"}</Button>
          <Button variant="outline" onClick={() => { setReason(""); setDecision({ id: request.id, approved: false, timeout: access.timeout }); }}>{access.timeout ? "Tự quyết Decline sau 24 giờ" : "Decline đề xuất"}</Button>
        </div>}
        {request.status === "waiting" && request.senderId === actor.id && !access.timeout && <div className="space-y-3"><p className="text-xs leading-6 text-muted-foreground">Được tự quyết từ {formatDate(new Date(access.availableAt).toISOString())}. Việc tự quyết cần thao tác xác nhận.</p>
          <ConfirmAction trigger="Mô phỏng chờ đủ 24 giờ" title="Đổi mốc thời gian demo?" description={`Chuyển thời gian dùng chung của tất cả tab tới ${formatDate(new Date(access.availableAt + 1).toISOString())}. Các hạn Quiz và lịch học cũng dùng mốc mới.`} needsReason={false} onConfirm={async () => { await simulateTime(access.availableAt + 1); }} />
        </div>}
      </Card>;
    }) : <EmptyState title="Không có đề xuất phù hợp" description="Các đề xuất hoàn thành ngoại lệ, cấp lại và thu hồi của lớp sẽ xuất hiện tại đây." />}
    <Dialog open={decision !== null} onOpenChange={open => { if (!open) setDecision(null); }} title={decision?.approved ? "Chấp thuận đề xuất?" : "Từ chối đề xuất?"} description={decision?.timeout ? "Bạn đang tự quyết theo quyền sau đủ 24 giờ. Quyết định này được ghi rõ trong lịch sử." : "Quyết định được lưu cùng người duyệt, thời điểm và phản hồi."}>
      {selected && decision && <ActionForm submitLabel="Xác nhận quyết định hoàn thành" onCancel={() => setDecision(null)} onSubmit={async () => {
        await run(actor.id, { type: "decideCompletion", requestId: selected.id, approved: decision.approved, reason, useTimeout: decision.timeout });
        setDecision(null);
      }}><p className="text-sm leading-6">{selected.kind === "revoke" ? "Nếu được duyệt, chứng chỉ mock sẽ chuyển Revoked. Nếu từ chối, chứng chỉ giữ Issued." : "Nếu được duyệt, quyền hoàn thành ngoại lệ được ghi nhận. Chứng chỉ vẫn chờ kết quả lớp đã chốt."}</p><Field label={decision.approved ? "Ghi chú quyết định" : "Lý do từ chối *"}><textarea required={!decision.approved} maxLength={2000} className="form-control min-h-28" value={reason} onChange={event => setReason(event.target.value)} /></Field></ActionForm>}
    </Dialog>
  </section>;
}

export function CompletionAppeals({ role, classId }: { role: Role; classId: string }) {
  const { state, account, run } = useLms();
  const actor = account(role);
  const [review, setReview] = useState<{ id: string; forward: boolean } | null>(null);
  const [reason, setReason] = useState("");
  const appeals = (state.completionAppeals ?? []).filter(item => item.classId === classId && (role === "student" ? item.studentId === actor.id : role === "teacher" && state.classes.some(course => course.id === classId && course.teacherId === actor.id))).toReversed();
  const selected = appeals.find(item => item.id === review?.id);
  if (role === "admin") return null;
  return <section className="space-y-4"><h2 className="text-xl font-semibold">Khiếu nại hoàn thành</h2>
    {appeals.length ? appeals.map(appeal => <Card key={appeal.id} className="space-y-3 p-5"><div className="flex flex-wrap items-start justify-between gap-3"><h3 className="font-semibold">{appeal.snapshot.studentName}</h3><StatusBadge status={appeal.status === "forwarded" ? "waiting" : appeal.status} label={appeal.status === "forwarded" ? "Đã chuyển duyệt chéo" : undefined} /></div><p className="whitespace-pre-wrap break-words text-sm leading-6">{appeal.reason}</p><p className="text-xs text-muted-foreground">{formatDate(appeal.createdAt)}</p>{appeal.resolutionReason && <p className="whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm leading-6">{appeal.resolutionReason}</p>}
      {role === "teacher" && appeal.status === "waiting" && <div className="flex flex-wrap gap-3"><Button onClick={() => { setReason(""); setReview({ id: appeal.id, forward: true }); }}>Tiếp nhận và chuyển Admin</Button><Button variant="outline" onClick={() => { setReason(""); setReview({ id: appeal.id, forward: false }); }}>Từ chối khiếu nại</Button></div>}
    </Card>) : <EmptyState title="Chưa có khiếu nại hoàn thành" description="Khiếu nại và phản hồi được lưu theo từng lần ghi danh." />}
    <Dialog open={review !== null} onOpenChange={open => { if (!open) setReview(null); }} title={review?.forward ? "Tiếp nhận khiếu nại và gửi duyệt chéo?" : "Từ chối khiếu nại?"} description={selected?.reason ?? "Khiếu nại không còn khả dụng."}>
      {review && selected && <ActionForm submitLabel="Xác nhận xử lý khiếu nại" onCancel={() => setReview(null)} onSubmit={async () => {
        await run(actor.id, { type: "reviewCompletionAppeal", appealId: selected.id, forward: review.forward, reason });
        setReview(null);
      }}><Field label={review.forward ? "Lý do đề xuất (để trống sẽ dùng nội dung khiếu nại)" : "Lý do từ chối *"}><textarea required={!review.forward} maxLength={2000} className="form-control min-h-28" value={reason} onChange={event => setReason(event.target.value)} /></Field></ActionForm>}
    </Dialog>
  </section>;
}
