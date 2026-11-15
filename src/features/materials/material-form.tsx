"use client";
import { useState } from 'react';
import type { ApiMaterial } from '@/lib/api/materials';
import { useApiData, useApiResource } from '@/state/api-data-provider';
import { ActionForm, Field, ResourceFeedback } from '@/components/shared/management-ui';
import { localLessonTime, utcLessonTime } from '@/features/lessons/lesson-status';

export function MaterialForm({ classId, sessionId, material, onSaved, onCancel }: { classId: number; sessionId?: number; material?: ApiMaterial; onSaved: () => void; onCancel: () => void }) {
    const { services, write } = useApiData();
    const [title, setTitle] = useState(material?.title ?? ''), [description, setDescription] = useState(material?.description ?? ''), [url, setUrl] = useState(material?.url ?? '');
    const [type, setType] = useState<'document' | 'video'>(material?.material_type ?? 'document'), [session, setSession] = useState(material ? material.session_id ? String(material.session_id) : '' : sessionId ? String(sessionId) : '');
    const [expiry, setExpiry] = useState(localLessonTime(material?.expires_at ?? undefined));
    const sessions = useApiResource('material-session-options:' + classId, s => s.sessions.all('manager', classId));
    return <ActionForm submitLabel="Lưu link tài liệu" onCancel={onCancel} onSubmit={async () => {
        await write(async () => (await services).materials.save(classId, { title, description, material_type: type, url, session_id: session ? Number(session) : null, expires_at: expiry ? utcLessonTime(expiry) : null }, material?.id));
        onSaved();
    }}>
        <Field label="Tên tài liệu *"><input required maxLength={200} className="form-control" value={title} onChange={event => setTitle(event.target.value)} /></Field>
        <Field label="Mô tả"><textarea maxLength={10000} className="form-control" value={description} onChange={event => setDescription(event.target.value)} /></Field>
        <Field label="Loại tài liệu *"><select className="form-control" value={type} onChange={event => setType(event.target.value as typeof type)}><option value="document">Document</option><option value="video">Video</option></select></Field>
        <Field label="Link HTTPS *"><input type="url" required className="form-control" value={url} onChange={event => setUrl(event.target.value)} placeholder="https://…" /></Field>
        <ResourceFeedback resource={sessions} />
        <Field label="Phạm vi tài liệu"><select className="form-control" value={session} onChange={event => setSession(event.target.value)}><option value="">Chung lớp</option>{sessions.data?.map(row => <option key={row.id} value={row.id}>Buổi {row.session_number} · {row.title}</option>)}</select></Field>
        <Field label="Hạn riêng (Việt Nam)" hint="Có thể để trống. Video YouTube được miễn hạn riêng, quyền lớp và enrollment vẫn áp dụng."><input type="datetime-local" className="form-control" value={expiry} onChange={event => setExpiry(event.target.value)} /></Field>
    </ActionForm>;
}
