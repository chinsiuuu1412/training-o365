"use client";

import { useState } from "react";
import { FileText, Video } from "lucide-react";
import type { Role } from "@/types/lms";
import { useLms } from "@/state/lms-provider";
import { getLibraryMaterials, getMaterialLessons, getMaterialStatus } from "@/mocks/services/library";
import { isExpired } from "@/mocks/services/management";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/states";
import { StatusBadge } from "@/components/shared/status-badge";
import { Field, Feedback, ActionForm } from "@/components/shared/management-ui";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { formatDate } from "@/features/dashboard/dashboard-parts";
import { MaterialForm } from "./material-form";
import { MaterialContent } from "./material-content";

const statusLabels = { available: "Có thể truy cập", expired: "Tài liệu hết hạn", "class-expired": "Lớp hết hạn", removed: "Đã gỡ", unavailable: "Không có quyền truy cập" };

export function LibraryWorkspace({ role, classId }: { role: Role; classId?: string }) {
  const { account } = useLms();
  return <LibraryView key={`${account(role).id}-${classId ?? "all"}`} role={role} classId={classId} />;
}

function LibraryView({ role, classId }: { role: Role; classId?: string }) {
  const { state, now, account, run } = useLms();
  const actor = account(role);
  const [search, setSearch] = useState("");
  const [classFilter, setClass] = useState(classId ?? "all");
  const [lessonFilter, setLesson] = useState("all");
  const [kind, setKind] = useState("all");
  const [status, setStatus] = useState("all");
  const [upload, setUpload] = useState(false);
  const [detailId, setDetail] = useState<string | null>(null);
  const [removalId, setRemoval] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");
  const visible = getLibraryMaterials(state, actor.id).filter(material => !classId || material.classId === classId);
  const classes = state.classes.filter(course => role === "admin" || course.teacherId === actor.id || (role === "student" && state.enrollments.some(enrollment => enrollment.studentId === actor.id && enrollment.classId === course.id && enrollment.status === "approved")));
  const canUpload = role === "teacher" && classes.some(course => (!classId || course.id === classId) && !isExpired(course, now));
  const lessons = state.lessons.filter(lesson => classes.some(course => course.id === lesson.classId) && (classFilter === "all" || lesson.classId === classFilter));
  const query = search.trim().toLocaleLowerCase("vi");
  const rows = visible.filter(material => {
    const attached = getMaterialLessons(state, material);
    const materialStatus = getMaterialStatus(state, actor.id, material, now);
    const course = state.classes.find(item => item.id === material.classId);
    return (classFilter === "all" || material.classId === classFilter)
      && (kind === "all" || material.kind === kind)
      && (status === "all" || materialStatus === status)
      && (lessonFilter === "all" || (lessonFilter === "general" ? !attached.length : attached.some(lesson => lesson.id === lessonFilter)))
      && `${material.title} ${material.description ?? ""} ${material.fileName ?? ""} ${course?.name ?? ""}`.toLocaleLowerCase("vi").includes(query);
  });
  const detail = visible.find(material => material.id === detailId);
  const detailStatus = detail ? getMaterialStatus(state, actor.id, detail, now) : "unavailable";
  const removal = visible.find(material => material.id === removalId && !material.removedAt);

  return <div className="dashboard-page space-y-6">
    <PageHeader title={classId ? "Course materials" : "Thư viện"} description="Tài liệu chung của lớp và tài liệu theo buổi học." actions={canUpload ? <Button onClick={() => setUpload(true)}>Thêm tài liệu</Button> : undefined} />
    <Feedback message={message} />
    <Card className="grid gap-4 p-5 sm:grid-cols-2 xl:grid-cols-5">
      <Field label="Tìm tài liệu"><input type="search" className="form-control" value={search} onChange={event => setSearch(event.target.value)} placeholder="Tên, mô tả, tên tệp…" /></Field>
      {!classId && <Field label="Lọc theo lớp"><select className="form-control" value={classFilter} onChange={event => { setClass(event.target.value); setLesson("all"); }}><option value="all">Tất cả lớp có quyền xem</option>{classes.map(course => <option key={course.id} value={course.id}>{course.name}</option>)}</select></Field>}
      <Field label="Lọc theo buổi"><select className="form-control" value={lessonFilter} onChange={event => setLesson(event.target.value)}><option value="all">Tất cả buổi / toàn khóa</option><option value="general">Chung toàn khóa</option>{lessons.map(lesson => <option key={lesson.id} value={lesson.id}>{state.classes.find(course => course.id === lesson.classId)?.code} · {lesson.name}</option>)}</select></Field>
      <Field label="Loại tài liệu"><select className="form-control" value={kind} onChange={event => setKind(event.target.value)}><option value="all">Document & Video</option><option value="document">Document</option><option value="video">Video</option></select></Field>
      <Field label="Trạng thái truy cập"><select className="form-control" value={status} onChange={event => setStatus(event.target.value)}><option value="all">Tất cả trạng thái</option>{Object.entries(statusLabels).filter(([value]) => value !== "unavailable").map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
    </Card>
    <p role="status" className="text-sm text-muted-foreground">{rows.length} tài liệu phù hợp</p>
    {rows.length ? <div className="grid items-start gap-4 md:grid-cols-2 xl:grid-cols-3">{rows.map(material => {
      const materialStatus = getMaterialStatus(state, actor.id, material, now);
      const course = state.classes.find(item => item.id === material.classId)!;
      const attached = getMaterialLessons(state, material);
      const Icon = material.kind === "video" ? Video : FileText;
      const canRemove = !material.removedAt && (role === "admin" || (role === "teacher" && !isExpired(course, now)));
      return <Card key={material.id} className="min-w-0 space-y-4 p-5 transition-shadow hover:shadow-md">
        <div className="flex items-start justify-between gap-3"><Icon size={22} className="shrink-0 text-primary" /><StatusBadge status={materialStatus === "available" ? "active" : materialStatus === "removed" ? "removed" : "expired"} label={statusLabels[materialStatus]} /></div>
        <div><p className="text-xs text-primary">{course.name} · {material.kind === "video" ? "Video" : "Document"}</p><h2 className="mt-2 break-words text-lg font-semibold">{material.title}</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">{attached.length ? attached.map(lesson => lesson.name).join(" · ") : "Tài liệu chung toàn khóa"}</p></div>
        <p className="text-xs text-muted-foreground">{material.expiresAt ? `Hạn riêng ${formatDate(material.expiresAt)}` : "Không có hạn riêng"}{material.source === "youtube" && " · YouTube miễn hạn riêng"}</p>
        {material.removedAt && <p className="break-words text-sm text-red-800">{material.removalReason || "Giảng viên đã gỡ tài liệu."}</p>}
        <div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" disabled={materialStatus !== "available"} onClick={() => setDetail(material.id)}>Xem tài liệu mock</Button>{canRemove && <Button variant="outline" size="sm" onClick={() => { setRemoval(material.id); setReason(""); }}>Gỡ tài liệu</Button>}</div>
      </Card>;
    })}</div> : <EmptyState title="Không có tài liệu phù hợp" description="Thử đổi tìm kiếm hoặc bộ lọc. Tài liệu chỉ hiển thị trong phạm vi vai trò hiện tại." />}
    <Dialog open={upload} onOpenChange={setUpload} title="Thêm tài liệu minh họa" description="Lưu metadata và chia sẻ cho học viên của lớp.">
      {upload && <MaterialForm classId={classId} onCancel={() => setUpload(false)} onSaved={() => { setUpload(false); setMessage("Đã thêm metadata tài liệu và đồng bộ vào lớp học."); }} />}
    </Dialog>
    <Dialog open={detailId !== null} onOpenChange={open => { if (!open) setDetail(null); }} title={detail?.title ?? "Tài liệu không khả dụng"} description="Xem metadata tệp minh họa.">
      {detail && detailStatus === "available" ? <MaterialContent material={detail} /> : <EmptyState title={statusLabels[detailStatus]} description="Quyền truy cập và thời hạn được kiểm tra lại theo shared state." />}
    </Dialog>
    <Dialog open={removalId !== null} onOpenChange={open => { if (!open) setRemoval(null); }} title="Gỡ tài liệu?" description={removal?.title ?? "Tài liệu đã được gỡ hoặc bạn không còn quyền quản lý."}>
      {removal && <ActionForm submitLabel="Xác nhận gỡ tài liệu" onCancel={() => setRemoval(null)} onSubmit={async () => {
        await run(actor.id, { type: "removeMaterial", materialId: removal.id, reason });
        setRemoval(null); setMessage(role === "admin" ? "Đã gỡ tài liệu và gửi lý do cho giảng viên phụ trách." : "Đã gỡ tài liệu khỏi lớp và các buổi học.");
      }}><p className="text-sm leading-6">Học viên sẽ mất quyền truy cập tài liệu và các đính kèm liên quan sẽ được gỡ.</p><Field label={role === "admin" ? "Lý do gỡ *" : "Ghi chú gỡ tài liệu"}><textarea required={role === "admin"} maxLength={1000} className="form-control min-h-24" value={reason} onChange={event => setReason(event.target.value)} /></Field></ActionForm>}
    </Dialog>
  </div>;
}
