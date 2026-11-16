"use client";

import { useState } from "react";
import type { ClassDto, ScheduleProposalDto, SessionDto } from "@/types/api";
import { sessionsApi } from "@/lib/lms-api";
import { fromVietnamDatetimeLocal, toVietnamDatetimeLocal } from "@/lib/date";
import { ActionForm, Field } from "@/components/shared/management-ui";

export function LessonForm({
  classDto,
  existingSessions,
  session,
  latestProposal,
  onSaved,
  onCancel,
}: {
  classDto: ClassDto;
  existingSessions: SessionDto[];
  session?: SessionDto;
  latestProposal?: ScheduleProposalDto;
  onSaved: (sessionId: number) => Promise<void> | void;
  onCancel: () => void;
}) {
  const maxSessions = classDto.total_sessions ?? 0;
  const usedNumbers = new Set(existingSessions.map((s) => s.session_number));
  const nextNumber =
    Array.from({ length: maxSessions }, (_, idx) => idx + 1).find((n) => !usedNumbers.has(n)) ?? 1;

  const [sessionNumber, setSessionNumber] = useState(
    session ? String(session.session_number) : String(nextNumber),
  );
  const [title, setTitle] = useState(session?.title ?? "");
  const [description, setDescription] = useState(session?.description ?? "");
  const [location, setLocation] = useState(session?.location ?? "");
  const [attendanceCode, setAttendanceCode] = useState(session?.attendance_code ?? "");
  const [startsAt, setStartsAt] = useState(
    toVietnamDatetimeLocal(latestProposal?.starts_at ?? session?.starts_at),
  );
  const [endsAt, setEndsAt] = useState(
    toVietnamDatetimeLocal(latestProposal?.ends_at ?? session?.ends_at),
  );
  const [submitNow, setSubmitNow] = useState(false);

  return (
    <ActionForm
      submitLabel={
        session
          ? submitNow
            ? "Lưu nháp & gửi duyệt"
            : "Lưu nháp lịch học"
          : startsAt && endsAt
            ? submitNow
              ? "Tạo buổi & gửi duyệt"
              : "Tạo buổi & lưu nháp lịch"
            : "Tạo buổi học"
      }
      onCancel={onCancel}
      onSubmit={async () => {
        let targetSessionId = session?.id;
        if (!targetSessionId) {
          const created = await sessionsApi.create(classDto.id, {
            session_number: Number(sessionNumber),
            title: title.trim(),
            description: description.trim(),
            location: location.trim(),
            attendance_code: attendanceCode.trim(),
          });
          targetSessionId = created.session.id;
        }

        if (startsAt || endsAt) {
          if (!startsAt || !endsAt) {
            throw new Error("Cần nhập cả thời gian bắt đầu và kết thúc.");
          }
          const startIso = fromVietnamDatetimeLocal(startsAt);
          const endIso = fromVietnamDatetimeLocal(endsAt);
          if (Date.parse(endIso) <= Date.parse(startIso)) {
            throw new Error("Thời gian kết thúc phải sau thời gian bắt đầu.");
          }
          const draftRes = await sessionsApi.saveScheduleDraft(classDto.id, targetSessionId, {
            starts_at: startIso,
            ends_at: endIso,
          });
          if (submitNow) {
            await sessionsApi.submitProposal(
              classDto.id,
              targetSessionId,
              draftRes.proposal.id,
            );
          }
        }
        await onSaved(targetSessionId);
      }}
    >
      {!session ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Số thứ tự buổi *">
              <input
                required
                type="number"
                min={1}
                max={maxSessions || 10000}
                step={1}
                className="form-control"
                value={sessionNumber}
                onChange={(e) => setSessionNumber(e.target.value)}
              />
            </Field>
            <Field label="Mã điểm danh *">
              <input
                required
                maxLength={100}
                autoComplete="off"
                className="form-control"
                value={attendanceCode}
                onChange={(e) => setAttendanceCode(e.target.value)}
                placeholder="VD: BUOI1-O365"
              />
            </Field>
          </div>

          <Field label="Tên buổi học *">
            <input
              required
              maxLength={200}
              className="form-control"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </Field>

          <Field label="Địa điểm / Phòng học">
            <input
              maxLength={2000}
              className="form-control"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="VD: Phòng B1-302 hoặc Microsoft Teams"
            />
          </Field>

          <Field label="Mô tả nội dung">
            <textarea
              maxLength={10000}
              className="form-control min-h-24"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </Field>
        </>
      ) : (
        <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
          Buổi {session.session_number}: <strong>{session.title}</strong>
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={session ? "Bắt đầu (UTC+7) *" : "Bắt đầu dự kiến (UTC+7)"}>
          <input
            required={Boolean(session)}
            type="datetime-local"
            className="form-control"
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
          />
        </Field>
        <Field label={session ? "Kết thúc (UTC+7) *" : "Kết thúc dự kiến (UTC+7)"}>
          <input
            required={Boolean(session)}
            type="datetime-local"
            min={startsAt}
            className="form-control"
            value={endsAt}
            onChange={(e) => setEndsAt(e.target.value)}
          />
        </Field>
      </div>

      <label className="flex items-center gap-3 text-sm">
        <input
          type="checkbox"
          className="size-4"
          checked={submitNow}
          onChange={(e) => setSubmitNow(e.target.checked)}
        />
        Gửi Admin duyệt đề xuất lịch ngay sau khi lưu
      </label>
    </ActionForm>
  );
}
