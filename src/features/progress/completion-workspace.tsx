"use client";

import { useState } from "react";
import { Award, Users, ClipboardCheck, AlertTriangle } from "lucide-react";
import type { Role } from "@/types/lms";
import { useLms } from "@/state/lms-provider";
import { getClassCompletion, getCompletionEligibility, getCurrentCertificate, getProgressClasses, getUnissuedCompletionApproval } from "@/mocks/services/completion";
import { isExpired } from "@/mocks/services/management";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { ProgressCard } from "@/components/shared/progress-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/states";
import { ConfirmAction, DataTable, Field } from "@/components/shared/management-ui";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { formatDate } from "@/features/dashboard/dashboard-parts";
import { CertificateHistory } from "@/features/certificates/certificate-history";
import { CompletionAppealButton, CompletionProposal } from "@/features/certificates/completion-actions";
import { CompletionAppeals, CompletionQueue } from "@/features/certificates/completion-queue";
import { LearnerProgress, SnapshotProgress, displayPercent } from "./learner-progress";

export function CompletionWorkspace({ role, initialClassId }: { role: Role; initialClassId?: string }) {
  const { account } = useLms();
  return <Workspace key={`${account(role).id}-${initialClassId ?? "default"}`} role={role} initialClassId={initialClassId} />;
}

function Workspace({ role, initialClassId }: { role: Role; initialClassId?: string }) {
  const { state, now, account } = useLms();
  const classes = getProgressClasses(state, account(role).id);
  const [selectedClass, setClass] = useState(initialClassId ?? classes[0]?.id ?? "");
  const course = classes.find(item => item.id === selectedClass);
  const summaries = role === "student" ? [] : classes.map(item => ({ course: item, summary: getClassCompletion(state, item.id, now) }));

  return <div className="dashboard-page space-y-6">
    <PageHeader title="Tiến độ & chứng chỉ" description={role === "student" ? "Theo dõi tiêu chí hoàn thành, khiếu nại và lịch sử các lần học." : "Xét tiến độ học viên, chốt kết quả và duyệt chéo các trường hợp ngoại lệ."} />
    <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">Chứng chỉ và email trên trang này được mô phỏng. Chứng chỉ demo không phải chứng nhận chính thức.</p>
    {role !== "student" && <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Users} label="Lượt học viên được duyệt" value={summaries.reduce((sum, row) => sum + row.summary.students.length, 0)} detail="Theo các lớp trong phạm vi quản lý" />
        <StatCard icon={ClipboardCheck} label="Đủ hai ngưỡng điểm" value={summaries.reduce((sum, row) => sum + row.summary.eligible, 0)} detail="Chỉ xét từ số liệu gốc, còn cần chốt kết quả" tone="teal" />
        <StatCard icon={Award} label="Chứng chỉ mock còn hiệu lực" value={summaries.reduce((sum, row) => sum + row.summary.issued, 0)} detail="Bao gồm lịch sử các lần ghi danh" tone="violet" />
        <StatCard icon={AlertTriangle} label="Chứng chỉ đang xem xét" value={summaries.reduce((sum, row) => sum + row.summary.underReview, 0)} detail="Cần đề xuất và quyết định chéo để thu hồi" tone="amber" />
      </div>
      <DataTable caption="Hiệu quả học tập theo lớp" columns={["Lớp", "Attendance TB", "Quiz TB", "Đủ / chưa đủ ngưỡng", "Issued / Under review / Revoked"]}>
        {summaries.map(({ course, summary }) => <tr key={course.id}><th scope="row" className="px-4 py-4"><Button variant="ghost" onClick={() => setClass(course.id)}>{course.name}</Button></th><td className="px-4 py-4">{summary.attendance}%</td><td className="px-4 py-4">{summary.quiz}%</td><td className="px-4 py-4">{summary.eligible} / {summary.ineligible}</td><td className="px-4 py-4">{summary.issued} / {summary.underReview} / {summary.revoked}</td></tr>)}
      </DataTable>
    </>}
    <Field label="Chọn lớp xem tiến độ và chứng chỉ"><select className="form-control max-w-lg" value={selectedClass} onChange={event => setClass(event.target.value)}><option value="">Chọn lớp</option>{classes.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
    {course ? <CompletionClassPanel key={`${account(role).id}-${course.id}`} role={role} classId={course.id} /> : <EmptyState title="Chưa có hồ sơ lớp trong phạm vi truy cập" description="Học viên có thể xem chứng chỉ đã cấp và snapshot trong lịch sử." />}
    {!course && role === "student" && <CertificateHistory role={role} />}
  </div>;
}

export function CompletionClassPanel({ role, classId }: { role: Role; classId: string }) {
  const { state, account } = useLms();
  const actor = account(role);
  const course = getProgressClasses(state, actor.id).find(item => item.id === classId);
  if (!course) return <EmptyState title="Không có quyền xem hồ sơ hoàn thành" description="Kiểm tra phân công lớp hoặc lịch sử ghi danh." />;
  return role === "student" ? <StudentCompletion classId={classId} /> : <StaffCompletion key={`${actor.id}-${classId}`} role={role} classId={classId} />;
}

function StudentCompletion({ classId }: { classId: string }) {
  const { state, now, account } = useLms();
  const actor = account("student");
  const course = state.classes.find(item => item.id === classId)!;
  const expired = isExpired(course, now);
  const eligibility = getCompletionEligibility(state, classId, actor.id, now);
  const certificate = getCurrentCertificate(state, classId, actor.id);
  const history = state.certificates?.filter(item => item.classId === classId && item.studentId === actor.id) ?? [];
  const finalizedSnapshot = state.classFinalizations?.filter(item => item.classId === classId).toReversed().flatMap(item => item.snapshots ?? []).find(item => item.studentId === actor.id && item.enrollmentCycle === eligibility.enrollmentCycle)?.snapshot;
  const appeals = (state.completionAppeals ?? []).filter(item => item.classId === classId && item.studentId === actor.id && item.enrollmentCycle === eligibility.enrollmentCycle);
  const archivedSnapshot = certificate?.snapshot ?? finalizedSnapshot ?? appeals.at(-1)?.snapshot;
  const pendingAppeal = appeals.some(item => ["waiting", "forwarded"].includes(item.status));
  const approvedException = getUnissuedCompletionApproval(state, classId, actor.id);
  const canAppeal = eligibility.enrolled && !pendingAppeal && !approvedException && (!certificate || certificate.status === "revoked") && (!eligibility.meetsCriteria || certificate?.status === "revoked");
  return <div className="space-y-6">
    {eligibility.enrolled && !expired ? <LearnerProgress eligibility={eligibility} /> : archivedSnapshot ? <SnapshotProgress snapshot={archivedSnapshot} /> : <EmptyState title="Chưa có snapshot cho lần học này" description="Hồ sơ đã chốt, khiếu nại và lịch sử chứng chỉ được lưu riêng theo từng lần ghi danh." />}
    {expired && <p className="text-sm text-muted-foreground">Lớp đã hết hạn. Đang hiển thị hồ sơ đã ghi nhận; học viên còn enrollment đã duyệt có thể tiếp tục khiếu nại.</p>}
    <Card className="space-y-4 p-5"><h2 className="text-lg font-semibold">Trạng thái hoàn thành</h2>
      {certificate ? <><StatusBadge status={certificate.status === "under-review" ? "underReview" : certificate.status} /><p className="text-sm leading-6">{certificate.basis === "exception" ? "Đã được công nhận theo ngoại lệ. Điểm thực tế được giữ nguyên." : "Chứng chỉ gắn với tiến độ đã chốt của lần học này."}</p></> : <p className="text-sm leading-6">{approvedException ? "Ngoại lệ đã được duyệt. Đang chờ lớp kết thúc và chốt hết điểm để cấp chứng chỉ mock." : eligibility.meetsCriteria ? "Dự kiến đủ điều kiện; đang chờ lớp kết thúc và chốt kết quả." : "Chưa đủ hai ngưỡng hoàn thành thông thường."}</p>}
      {!certificate && history.length > 0 && eligibility.enrolled && <p className="text-sm text-muted-foreground">Bạn đang ở một lần ghi danh mới. Chứng chỉ các lần học trước được lưu riêng bên dưới.</p>}
      {!eligibility.finalization.finalized && eligibility.enrolled && <p className="text-sm text-muted-foreground">{eligibility.finalization.classFinished ? "Kết quả lớp chưa được chốt hoặc cần chốt lại." : "Lớp chưa kết thúc tất cả buổi bắt buộc."}</p>}
      {canAppeal && <CompletionAppealButton classId={classId} />}
      {pendingAppeal && <StatusBadge status="waiting" label="Khiếu nại đang được xử lý" />}
    </Card>
    <CompletionAppeals role="student" classId={classId} />
    <CertificateHistory role="student" classId={classId} />
  </div>;
}

function StaffCompletion({ role, classId }: { role: Role; classId: string }) {
  const { state, now, account, run } = useLms();
  const actor = account(role);
  const summary = getClassCompletion(state, classId, now);
  const course = state.classes.find(item => item.id === classId)!;
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [studentId, setStudent] = useState<string | null>(null);
  const rows = summary.students.filter(row => (filter === "all" || (filter === "eligible" ? row.eligibility.meetsCriteria : !row.eligibility.meetsCriteria)) && `${row.student.name} ${row.student.email}`.toLocaleLowerCase("vi").includes(search.trim().toLocaleLowerCase("vi")));
  const student = summary.students.find(row => row.student.id === studentId);
  return <div className="space-y-6">
    <div className="grid items-start gap-4 lg:grid-cols-2"><ProgressCard title="Tiến độ giảng dạy" description={course.name} metrics={[
      { label: `${summary.finalization.finishedLessons}/${course.totalLessons} buổi bắt buộc đã kết thúc`, value: course.totalLessons ? displayPercent(summary.finalization.finishedLessons / course.totalLessons * 100) : 0, detail: "Buổi học bù dùng cùng buổi cố định." },
      { label: "Attendance trung bình", value: summary.attendance, detail: `${summary.students.length} học viên đã được duyệt` },
      { label: "Quiz trung bình", value: summary.quiz, detail: `${summary.eligible} đủ ngưỡng · ${summary.ineligible} chưa đủ ngưỡng`, color: "teal" },
    ]} /><Card className="space-y-4 p-5"><h2 className="text-lg font-semibold">Chốt kết quả lớp</h2><StatusBadge status={summary.finalization.finalized ? "approved" : "waiting"} label={summary.finalization.finalized ? "Đã chốt hết điểm" : summary.finalization.record ? "Cần chốt lại kết quả" : "Chưa chốt kết quả"} />
      {summary.finalization.record && <p className="text-xs text-muted-foreground">Lần chốt gần nhất {formatDate(summary.finalization.record.finalizedAt)} · {state.users.find(item => item.id === summary.finalization.record?.finalizedBy)?.name}</p>}
      <p className="text-sm leading-6">Sau khi chốt, shared mock state tự cấp chứng chỉ khi đủ tiêu chí hoặc có ngoại lệ đã duyệt. Thay đổi điểm làm mất trạng thái chốt và cần chốt lại.</p>
      {summary.finalization.blockers.length > 0 && <ul className="list-inside list-disc space-y-2 text-sm text-amber-900">{summary.finalization.blockers.map(blocker => <li key={blocker}>{blocker}</li>)}</ul>}
      {!summary.finalization.finalized && !summary.finalization.blockers.length ? <ConfirmAction trigger="Chốt kết quả lớp" title="Xác nhận đã chốt hết điểm?" description="Xác nhận Attendance và mọi kết quả Quiz của lớp. Học viên chưa nộp hợp lệ được giữ trạng thái chưa đạt bài đó. Các chứng chỉ được cấp chỉ là mô phỏng." needsReason={false} onConfirm={async () => { await run(actor.id, { type: "finalizeClassResults", classId }); }} /> : <Button disabled variant="outline">{summary.finalization.finalized ? "Đã chốt kết quả" : "Chốt kết quả lớp"}</Button>}
    </Card></div>
    <div className="grid gap-4 sm:grid-cols-2"><Field label="Tìm học viên theo tên hoặc email"><input type="search" className="form-control" value={search} onChange={event => setSearch(event.target.value)} /></Field><Field label="Điều kiện hoàn thành"><select className="form-control" value={filter} onChange={event => setFilter(event.target.value)}><option value="all">Tất cả học viên</option><option value="eligible">Đủ hai ngưỡng</option><option value="ineligible">Chưa đủ hai ngưỡng</option></select></Field></div>
    {rows.length ? <DataTable caption="Tiến độ và điều kiện từng học viên" columns={["Học viên", "Attendance", "Quiz", "Điều kiện điểm", "Chứng chỉ hiện tại", "Thao tác"]}>
      {rows.map(row => {
        const pending = state.completionRequests?.some(item => item.kind === "exception" && item.classId === classId && item.studentId === row.student.id && item.enrollmentCycle === row.eligibility.enrollmentCycle && item.status === "waiting");
        const canPropose = !pending && !getUnissuedCompletionApproval(state, classId, row.student.id) && (!row.certificate || row.certificate.status === "revoked") && (!row.eligibility.meetsCriteria || row.certificate?.status === "revoked");
        return <tr key={row.student.id}><th scope="row" className="px-4 py-4 font-medium">{row.student.name}<p className="mt-2 text-xs font-normal text-muted-foreground">{row.student.email}</p></th><td className="px-4 py-4">{row.progress.attendedSessions}/{row.progress.requiredSessions}<br />{displayPercent(row.progress.attendancePercent)}%</td><td className="px-4 py-4">{row.progress.passedQuizzes}/{row.progress.requiredQuizzes}<br />{displayPercent(row.progress.quizPercent)}%</td><td className="px-4 py-4"><StatusBadge status={row.eligibility.meetsCriteria ? "eligible" : "ineligible"} /></td><td className="px-4 py-4">{row.certificate ? <StatusBadge status={row.certificate.status === "under-review" ? "underReview" : row.certificate.status} /> : "Chưa cấp"}</td><td className="px-4 py-4"><div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" onClick={() => setStudent(row.student.id)}>Xem tiến độ · {row.student.name}</Button>{canPropose && <CompletionProposal role={role} classId={classId} studentId={row.student.id} kind="exception" trigger={row.certificate?.status === "revoked" ? "Đề xuất cấp lại" : "Đề xuất ngoại lệ"} />}{pending && <span className="text-xs text-amber-800">Đề xuất đang chờ</span>}</div></td></tr>;
      })}
    </DataTable> : <EmptyState title="Không có học viên phù hợp" description="Chỉ enrollment đã được duyệt được tính vào tiến độ lớp." />}
    <CompletionAppeals role={role} classId={classId} />
    <CompletionQueue role={role} classId={classId} />
    <CertificateHistory role={role} classId={classId} />
    <Dialog open={studentId !== null} onOpenChange={open => { if (!open) setStudent(null); }} title={student?.student.name ?? "Học viên không còn trong lớp"} description="Tiến độ hiện tại và lịch sử chứng chỉ theo từng lần ghi danh.">
      {student && <div className="space-y-6"><LearnerProgress eligibility={student.eligibility} /><CertificateHistory role={role} classId={classId} studentId={student.student.id} /></div>}
    </Dialog>
  </div>;
}
