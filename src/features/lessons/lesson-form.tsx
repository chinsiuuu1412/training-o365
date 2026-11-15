"use client";
import { useState } from 'react';
import { useApiData } from '@/state/api-data-provider';
import type { Session, Proposal } from '@/lib/api/sessions';
import { ActionForm, Field } from '@/components/shared/management-ui';
import { localLessonTime, utcLessonTime } from './lesson-status';

export function LessonForm({ classId, total, onSaved, onCancel }: {
    classId: number; total: number; onSaved: (session: Session) => void; onCancel: () => void;
}) {
    const { services, write } = useApiData();
    const [number, setNumber] = useState(''), [title, setTitle] = useState(''), [description, setDescription] = useState('');
    const [location, setLocation] = useState(''), [code, setCode] = useState('');
    return <ActionForm submitLabel="Tạo buổi học" onCancel={onCancel} onSubmit={async () => {
        const session = await write(async () => (await services).sessions.create(classId, {
            session_number: Number(number), title, description, location, attendance_code: code
        }));
        onSaved(session);
    }}>
        <Field label="Buổi học số *" hint={'Trong tổng ' + total + ' buổi bắt buộc, mỗi số dùng một lần.'}>
            <input type="number" min="1" max={total} step="1" required className="form-control" value={number} onChange={event => setNumber(event.target.value)} />
        </Field>
        <Field label="Tên buổi học *"><input required maxLength={200} className="form-control" value={title} onChange={event => setTitle(event.target.value)} /></Field>
        <Field label="Mô tả"><textarea maxLength={10000} className="form-control" value={description} onChange={event => setDescription(event.target.value)} /></Field>
        <Field label="Link hoặc địa điểm"><input maxLength={2000} className="form-control" value={location} onChange={event => setLocation(event.target.value)} /></Field>
        <Field label="Mã điểm danh *" hint="Chia sẻ mã trong buổi học. Student không nhận mã qua dữ liệu buổi học.">
            <input required type="text" autoComplete="off" maxLength={100} className="form-control" value={code} onChange={event => setCode(event.target.value)} />
        </Field>
        <p className="text-sm text-muted-foreground">Sau khi tạo, lưu thời gian vào bản nháp rồi gửi Admin duyệt.</p>
    </ActionForm>;
}
export function ScheduleDraftForm({ classId, session, draft, onSaved, onCancel }: {
    classId: number; session: Session; draft?: Proposal; onSaved: () => void; onCancel: () => void;
}) {
    const { services, write } = useApiData();
    const [start, setStart] = useState(localLessonTime(draft?.starts_at ?? session.starts_at ?? undefined));
    const [end, setEnd] = useState(localLessonTime(draft?.ends_at ?? session.ends_at ?? undefined));
    return <ActionForm submitLabel="Lưu bản nháp lịch" onCancel={onCancel} onSubmit={async () => {
        await write(async () => (await services).sessions.saveDraft(classId, session.id, {
            starts_at: utcLessonTime(start), ends_at: utcLessonTime(end)
        }));
        onSaved();
    }}>
        <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Bắt đầu (Việt Nam) *"><input type="datetime-local" required className="form-control" value={start} onChange={event => setStart(event.target.value)} /></Field>
            <Field label="Kết thúc (Việt Nam) *"><input type="datetime-local" required className="form-control" value={end} onChange={event => setEnd(event.target.value)} /></Field>
        </div>
        <p className="text-sm leading-6">Lịch đã duyệt tiếp tục có hiệu lực đến khi Admin duyệt thay đổi. Giờ bắt đầu mới phải ở tương lai.</p>
    </ActionForm>;
}

