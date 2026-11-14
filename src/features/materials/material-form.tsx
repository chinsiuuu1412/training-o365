"use client";

import { useState } from "react";
import { useLms } from "@/state/lms-provider";
import { isExpired } from "@/mocks/services/management";
import { ActionForm, Field } from "@/components/shared/management-ui";
import { utcLessonTime } from "@/features/lessons/lesson-status";
import type { Material } from "@/types/lms";

export function MaterialForm({ classId, onSaved, onCancel }: { classId?: string; onSaved: () => void; onCancel: () => void }) {
  const { state, now, account, run } = useLms();
  const actor = account("teacher");
  const classes = state.classes.filter(course => course.teacherId === actor.id && !isExpired(course, now));
  const [selectedClass, setClass] = useState(classId ?? classes[0]?.id ?? "");
  const [lessonId, setLesson] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [kind, setKind] = useState<Material["kind"]>("document");
  const [source, setSource] = useState<"file" | "youtube">("file");
  const [fileName, setFileName] = useState("");
  const [sizeBytes, setSize] = useState("1048576");
  const [mimeType, setMime] = useState("application/pdf");
  const [youtubeUrl, setUrl] = useState("");
  const [expiresAt, setExpiration] = useState("");

  return <ActionForm submitLabel="Lưu tài liệu minh họa" onCancel={onCancel} onSubmit={async () => {
    await run(actor.id, {
      type: "addMaterial", classId: selectedClass, lessonId: lessonId || undefined, title, description, kind, source,
      fileName, sizeBytes: Number(sizeBytes), mimeType, youtubeUrl, expiresAt: expiresAt ? utcLessonTime(expiresAt) : undefined,
    });
    onSaved();
  }}>
    <p className="rounded-lg bg-blue-50 p-3 text-sm leading-6 text-blue-900">Nhập metadata tệp để mô phỏng đăng tải. Tài liệu được chia sẻ cho cả lớp.</p>
    <Field label="Lớp học *"><select required className="form-control" value={selectedClass} disabled={!!classId} onChange={event => { setClass(event.target.value); setLesson(""); }}>
      <option value="">Chọn lớp</option>{classes.map(course => <option key={course.id} value={course.id}>{course.name}</option>)}
    </select></Field>
    <Field label="Phân loại theo buổi học"><select className="form-control" value={lessonId} onChange={event => setLesson(event.target.value)}>
      <option value="">Tài liệu chung toàn khóa</option>{state.lessons.filter(lesson => lesson.classId === selectedClass).map(lesson => <option key={lesson.id} value={lesson.id}>{lesson.name}</option>)}
    </select></Field>
    <Field label="Tên tài liệu *"><input required maxLength={150} className="form-control" value={title} onChange={event => setTitle(event.target.value)} /></Field>
    <Field label="Mô tả"><textarea maxLength={2000} className="form-control min-h-24" value={description} onChange={event => setDescription(event.target.value)} /></Field>
    <Field label="Loại tài liệu *"><select className="form-control" value={kind} onChange={event => {
      const nextKind = event.target.value as Material["kind"];
      setKind(nextKind); setSource("file"); setMime(nextKind === "video" ? "video/mp4" : "application/pdf");
    }}><option value="document">Document</option><option value="video">Video</option></select></Field>
    {kind === "video" && <Field label="Nguồn video"><select className="form-control" value={source} onChange={event => setSource(event.target.value as "file" | "youtube")}><option value="file">Metadata tệp video</option><option value="youtube">Video bài giảng YouTube</option></select></Field>}
    {source === "youtube" ? <Field label="URL YouTube *" hint="Video YouTube được miễn hạn riêng của tài liệu. Thời hạn lớp vẫn áp dụng."><input required type="url" className="form-control" value={youtubeUrl} onChange={event => setUrl(event.target.value)} placeholder="https://www.youtube.com/watch?v=..." /></Field> : <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Tên tệp minh họa *"><input required maxLength={200} className="form-control" value={fileName} onChange={event => setFileName(event.target.value)} placeholder={kind === "video" ? "bai-giang.mp4" : "bai-giang.pdf"} /></Field>
      <Field label="Kích thước (byte) *"><input required type="number" min={1} step={1} className="form-control" value={sizeBytes} onChange={event => setSize(event.target.value)} /></Field>
      <Field label="MIME type *"><input required maxLength={100} className="form-control" value={mimeType} onChange={event => setMime(event.target.value)} /></Field>
    </div>}
    <Field label="Hạn truy cập tài liệu (UTC+7)" hint="Để trống nếu tài liệu không có hạn riêng."><input type="datetime-local" className="form-control" value={expiresAt} onChange={event => setExpiration(event.target.value)} /></Field>
  </ActionForm>;
}
