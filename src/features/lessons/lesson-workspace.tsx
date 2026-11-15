"use client";
import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { Role } from '@/types/lms';
import { useApiData, useApiResource, formatApiDate } from '@/state/api-data-provider';
import { ResourceFeedback, Pagination, Feedback, ConfirmAction } from '@/components/shared/management-ui';
import { EmptyState } from '@/components/shared/states';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { LessonForm, ScheduleDraftForm } from './lesson-form';
import { LessonAttendance } from './lesson-attendance';
import { LessonStatus } from './lesson-status';
import { detailHref } from '@/config/routes';
import { communicationsEnabled } from '@/state/auth-provider';
import { AttachedMaterials } from '@/features/materials/attached-materials';

export function LessonWorkspace({ role, classId, total, expired }: { role: Role; classId: number; total: number | null; expired: boolean }) {
    const query = useSearchParams(), router = useRouter(), { now } = useApiData();
    const [page, setPage] = useState(1);
    const selected = Number(query.get('sessionId')) || 0;
    const selectSession = (id: number) => router.replace(detailHref(role, String(classId), undefined, 'lessons') + '&sessionId=' + id, { scroll: false });
    const [create, setCreate] = useState(false), [message, setMessage] = useState('');
    const list = useApiResource('sessions:' + role + ':' + classId + ':' + page, s => s.sessions.list(role, classId, page));
    return <section className="space-y-5" aria-label="Buổi học và điểm danh">
        <div className="flex flex-wrap items-start justify-between gap-3">
            <div><h2 className="text-xl font-semibold">Buổi học</h2><p className="mt-2 text-sm text-muted-foreground">{total ?? 'Chưa thiết lập'} buổi bắt buộc · Thời gian Việt Nam</p></div>
            <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => void list.refresh()}>Làm mới buổi học</Button>
                {role === 'manager' && !expired && <Button disabled={!total} onClick={() => setCreate(true)}>Tạo buổi học</Button>}
            </div>
        </div>
        {expired && <p role="status" className="text-sm">Lớp đã hết hạn, chỉ xem lịch sử.</p>}
        <Feedback message={message} /><ResourceFeedback resource={list} />
        {list.data && <div className="grid items-start gap-5 xl:grid-cols-[minmax(220px,0.7fr)_minmax(0,2fr)]">
            <div className="min-w-0 space-y-4">
                <Card className="overflow-hidden"><ul className="divide-y divide-border">
                    {list.data.items.map(session => <li key={session.id}>
                        <button type="button" aria-pressed={selected === session.id} className={'w-full space-y-2 p-4 text-left transition-colors hover:bg-blue-50 ' + (selected === session.id ? 'bg-blue-50 ring-2 ring-inset ring-blue-500' : '')} onClick={() => selectSession(session.id)}>
                            <span className="block font-semibold">Buổi {session.session_number} · {session.title}</span>
                            <LessonStatus status={!session.approved_proposal_id ? 'draft' : now >= Date.parse(session.ends_at!) ? 'completed' : now >= Date.parse(session.starts_at!) ? 'active' : 'approved'} />
                            <span className="block text-xs">{session.approved_proposal_id ? formatApiDate(session.starts_at) : 'Chưa có lịch hiệu lực'}</span>
                        </button>
                    </li>)}
                </ul>{!list.data.items.length && <EmptyState title="Chưa có buổi học" description={role === 'student' ? 'Buổi học xuất hiện sau khi Admin duyệt lịch.' : 'Đặt tổng số buổi trong Tổng quan, sau đó tạo buổi học.'} />}</Card>
                <Pagination {...list.data} onPage={setPage} />
            </div>
            {selected ? <SessionDetail key={role + ':' + selected} role={role} classId={classId} sessionId={selected} expired={expired} /> : <EmptyState title="Chọn một buổi học" description="Xem lịch có hiệu lực và Attendance tại đây." />}
        </div>}
        <Dialog open={create} onOpenChange={setCreate} title="Tạo buổi học" description="Nội dung buổi học và mã điểm danh. Lịch được gửi duyệt riêng.">
            {create && <LessonForm classId={classId} total={total ?? 0} onCancel={() => setCreate(false)} onSaved={session => { selectSession(session.id); setCreate(false); setMessage('Đã tạo buổi học. Lưu bản nháp lịch để gửi duyệt.'); }} />}
        </Dialog>
    </section>;
}
function SessionDetail({ role, classId, sessionId, expired }: { role: Role; classId: number; sessionId: number; expired: boolean }) {
    const { now, services, write } = useApiData(), [edit, setEdit] = useState(false), [message, setMessage] = useState('');
    const resource = useApiResource('session:' + role + ':' + classId + ':' + sessionId, s => s.sessions.detail(role, classId, sessionId));
    const session = resource.data?.session, proposals = resource.data?.proposals ?? [];
    const draft = proposals.find(row => row.status === 'draft'), pending = proposals.some(row => row.status === 'pending');
    const editable = role === 'manager' && !expired && !pending && !!session && now > 0 && (!session.approved_proposal_id || now < Date.parse(session.starts_at!));
    return <div className="min-w-0 space-y-5">
        <ResourceFeedback resource={resource} /><Feedback message={message} />
        {session && <>
            <Card className="space-y-4 p-5">
                <h3 className="text-xl font-semibold">{session.title}</h3>
                <p className="whitespace-pre-wrap break-words text-sm leading-7">{session.description || 'Chưa có mô tả.'}</p>
                {session.location && <p className="break-words text-sm">Địa điểm / link học · {session.location}</p>}
                <div className="rounded-xl bg-slate-50 p-4 text-sm leading-7">
                    <h4 className="font-semibold">Lịch đang có hiệu lực</h4>
                    {session.approved_proposal_id ? <><p>{formatApiDate(session.starts_at)} — {formatApiDate(session.ends_at)} (Việt Nam)</p><p>Admin đã duyệt. Điểm danh mở trong giờ học.</p></> : <p>Chưa có lịch được duyệt.</p>}
                </div>
                {role !== 'student' && <p className="text-sm">Mã điểm danh · <strong className="font-mono">{session.attendance_code}</strong></p>}
                {role === 'manager' && <div className="flex flex-wrap gap-2">
                    <Button variant="outline" disabled={!editable} onClick={() => setEdit(true)}>{draft ? 'Sửa bản nháp lịch' : 'Tạo bản nháp lịch'}</Button>
                    {editable && draft && <ConfirmAction title="Gửi Admin duyệt lịch?" trigger="Gửi Admin duyệt lịch" needsReason={false} description="Lịch hiệu lực hiện tại được giữ trong thời gian chờ duyệt." onConfirm={async () => {
                        await write(async () => (await services).sessions.submit(classId, session.id, draft.id));
                        setMessage('Đã gửi đề xuất lịch cho Admin.');
                    }} />}
                </div>}
                {role !== 'student' && proposals.length > 0 && <div className="space-y-3 border-t pt-4">
                    <h4 className="font-semibold">Lịch sử đề xuất</h4>
                    {proposals.map(row => <article key={row.id} className="space-y-2 rounded-lg border p-3 text-sm">
                        <LessonStatus status={row.status} /><p>{formatApiDate(row.starts_at)} — {formatApiDate(row.ends_at)}</p>
                        <p>Người gửi #{row.proposed_by}{row.reviewed_by && ' · Người duyệt #' + row.reviewed_by}</p>
                        {row.reason && <p className="whitespace-pre-wrap text-red-800">Phản hồi · {row.reason}</p>}
                    </article>)}
                </div>}
            </Card>
            <LessonAttendance key={role + ':' + session.id} role={role} session={session} expired={expired} />
            {communicationsEnabled && <AttachedMaterials role={role} classId={classId} sessionId={session.id} />}
            <Dialog open={edit} onOpenChange={setEdit} title="Bản nháp lịch" description="Thời gian theo Việt Nam. Lịch cần Admin duyệt để có hiệu lực.">
                {edit && <ScheduleDraftForm classId={classId} session={session} draft={draft} onCancel={() => setEdit(false)} onSaved={() => { setEdit(false); setMessage('Đã lưu bản nháp lịch.'); }} />}
            </Dialog>
        </>}
    </div>;
}




