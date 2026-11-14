"use client";

import { useState } from "react";
import type { Role } from "@/types/lms";
import { useLms } from "@/state/lms-provider";
import { getDirectRecipients, getMessageClasses } from "@/mocks/services/communications";
import { ActionForm, Field } from "@/components/shared/management-ui";
import { Button } from "@/components/ui/button";
import { roleNames } from "@/config/navigation";

export function MessageCompose({ role, request = false, onSent, onCancel }: { role: Role; request?: boolean; onSent: () => void; onCancel: () => void }) {
  const { state, account, run } = useLms();
  const actor = account(role);
  const classes = getMessageClasses(state, actor.id);
  const directRecipients = getDirectRecipients(state, actor.id).filter(user => !request || (role === "teacher" ? user.role === "admin" : user.role === "teacher"));
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [mode, setMode] = useState<"people" | "classes">("people");
  const [recipientIds, setRecipients] = useState<string[]>([]);
  const [classIds, setClasses] = useState<string[]>([]);
  const [includeTeachers, setIncludeTeachers] = useState(false);
  const [excludedStudents, setExcluded] = useState<string[]>([]);
  const [requestClass, setRequestClass] = useState("");
  const classStudents = state.users.filter(user => user.role === "student" && state.enrollments.some(enrollment => enrollment.studentId === user.id && enrollment.status === "approved" && classIds.includes(enrollment.classId)));
  const selectedStudents = classStudents.filter(user => !excludedStudents.includes(user.id));
  const teacherCount = includeTeachers ? new Set(classes.filter(course => classIds.includes(course.id)).map(course => course.teacherId)).size : 0;
  const count = mode === "people" || request ? recipientIds.length : selectedStudents.length + teacherCount;

  return <ActionForm submitLabel={request ? "Gửi yêu cầu" : "Gửi thông báo"} onCancel={onCancel} onSubmit={async () => {
    if (request) {
      if (recipientIds.length !== 1) throw new Error("Chọn đúng một người nhận yêu cầu.");
      await run(actor.id, { type: "sendGeneralRequest", recipientId: recipientIds[0], classId: requestClass || undefined, title, description });
    } else {
      await run(actor.id, { type: "sendNotification", title, description, audience: mode === "people"
        ? { type: "people", recipientIds }
        : { type: "classes", classIds, includeTeachers, studentIds: selectedStudents.map(user => user.id) } });
    }
    onSent();
  }}>
    {!request && role !== "student" && <Field label="Phạm vi gửi"><select className="form-control" value={mode} onChange={event => setMode(event.target.value as "people" | "classes")}><option value="people">Chọn người nhận trực tiếp</option><option value="classes">Gửi theo lớp</option></select></Field>}
    {mode === "people" || request ? <fieldset className="space-y-3"><legend className="mb-3 text-sm font-medium">{request ? "Người nhận yêu cầu *" : "Người nhận *"}</legend>
      {directRecipients.length ? <div className="max-h-56 space-y-3 overflow-y-auto rounded-xl border border-border p-3">{directRecipients.map(user => <label key={user.id} className="flex items-start gap-3 text-sm leading-6"><input type={request ? "radio" : "checkbox"} name="message-recipient" className="mt-1 size-4 shrink-0" checked={recipientIds.includes(user.id)} onChange={event => setRecipients(request ? [user.id] : event.target.checked ? [...recipientIds, user.id] : recipientIds.filter(id => id !== user.id))} /><span>{user.name}<span className="block text-xs text-muted-foreground">{roleNames[user.role]}{user.status === "suspended" ? " · Tài khoản đang bị vô hiệu hóa" : ""}</span></span></label>)}</div> : <p className="text-sm text-muted-foreground">Chưa có người nhận thuộc phạm vi được phép.</p>}
    </fieldset> : <div className="space-y-4">
      <fieldset className="space-y-3"><legend className="mb-3 text-sm font-medium">Lớp nhận thông báo *</legend><Button type="button" size="sm" variant="outline" onClick={() => setClasses(classes.map(course => course.id))}>Chọn tất cả lớp</Button>{classes.map(course => <label key={course.id} className="flex items-center gap-3 text-sm"><input type="checkbox" checked={classIds.includes(course.id)} onChange={event => setClasses(event.target.checked ? [...classIds, course.id] : classIds.filter(id => id !== course.id))} />{course.name}</label>)}</fieldset>
      {role === "admin" && <label className="flex items-center gap-3 text-sm"><input type="checkbox" checked={includeTeachers} onChange={event => setIncludeTeachers(event.target.checked)} />Bao gồm giảng viên phụ trách</label>}
      <fieldset><legend className="mb-3 text-sm font-medium">Học viên nhận thông báo</legend><div className="max-h-56 space-y-3 overflow-y-auto rounded-xl border border-border p-3">{classStudents.map(user => <label key={user.id} className="flex items-center gap-3 text-sm"><input type="checkbox" checked={!excludedStudents.includes(user.id)} onChange={event => setExcluded(event.target.checked ? excludedStudents.filter(id => id !== user.id) : [...excludedStudents, user.id])} />{user.name}</label>)}{!classStudents.length && <p className="text-sm text-muted-foreground">Chọn lớp có học viên đã được duyệt.</p>}</div><p className="mt-2 text-xs text-muted-foreground">Bỏ chọn để loại trừ học viên. Người thuộc nhiều lớp chỉ nhận một bản.</p></fieldset>
    </div>}
    {request && <Field label="Lớp liên quan (tùy chọn)"><select className="form-control" value={requestClass} onChange={event => setRequestClass(event.target.value)}><option value="">Không gắn lớp cụ thể</option>{classes.filter(course => role !== "student" || !recipientIds.length || course.teacherId === recipientIds[0]).map(course => <option key={course.id} value={course.id}>{course.name}</option>)}</select></Field>}
    <Field label="Tiêu đề *"><input required maxLength={150} className="form-control" value={title} onChange={event => setTitle(event.target.value)} /></Field>
    <Field label="Nội dung *"><textarea required maxLength={4000} className="form-control min-h-32" value={description} onChange={event => setDescription(event.target.value)} /></Field>
    <p role="status" className="text-sm text-muted-foreground">Đã chọn {count} người nhận</p>
  </ActionForm>;
}
