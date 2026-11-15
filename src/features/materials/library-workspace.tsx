"use client";
import { useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { Role } from '@/types/lms';
import type { ApiMaterial } from '@/lib/api/materials';
import { materialStatus, youtubeExpiryExempt } from '@/lib/api/materials';
import { useApiData, useApiResource, formatApiDate } from '@/state/api-data-provider';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/states';
import { Field, Feedback, Pagination, ResourceFeedback, ConfirmAction } from '@/components/shared/management-ui';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { StatusBadge } from '@/components/shared/status-badge';
import { MaterialForm } from './material-form';
import { MaterialContent, materialStatusLabels } from './material-content';

export function LibraryWorkspace({ role, classId, sessionId }: { role: Role; classId?: number; sessionId?: number }) {
    return classId ? <ClassLibrary key={role + ':' + classId + ':' + sessionId} role={role} classId={classId} sessionId={sessionId} /> : <LibraryDirectory role={role} />;
}
function LibraryDirectory({ role }: { role: Role }) {
    const query = useSearchParams(), router = useRouter();
    const classes = useApiResource('library-classes:' + role, s => s.classes.all(role));
    const id = Number(query.get('classId')) || classes.data?.[0]?.id || 0;
    return <div className="dashboard-page space-y-5">
        <PageHeader title="Thư viện" description="Link Document và Video theo lớp, buổi học và hạn truy cập." />
        <ResourceFeedback resource={classes} />
        <Field label="Lớp tài liệu"><select className="form-control max-w-xl" value={id || ''} onChange={event => router.replace('/' + role + '/library/?classId=' + event.target.value)}><option value="" disabled>Chọn lớp</option>{classes.data?.map(course => <option key={course.id} value={course.id}>{course.name}{course.is_expired ? ' · Đã hết hạn' : ''}</option>)}</select></Field>
        {id ? <ClassLibrary key={role + ':' + id} role={role} classId={id} /> : classes.data && <EmptyState title="Chưa có lớp để xem tài liệu" description="Student cần enrollment hiện hành, Manager cần phân công lớp." />}
    </div>;
}
function ClassLibrary({ role, classId, sessionId }: { role: Role; classId: number; sessionId?: number }) {
    const query = useSearchParams(), router = useRouter(), pathname = usePathname(), { services, write, now } = useApiData();
    const [search, setSearch] = useState(''), [type, setType] = useState(''), [session, setSession] = useState(''), [page, setPage] = useState(1);
    const [editor, setEditor] = useState<ApiMaterial | 'new' | null>(null), [message, setMessage] = useState('');
    const course = useApiResource('library-class:' + role + ':' + classId, s => s.classes.detail(role, classId));
    const sessions = useApiResource('library-sessions:' + role + ':' + classId, s => s.sessions.all(role, classId));
    const selectedSession = sessionId ?? (session ? Number(session) : undefined);
    const resource = useApiResource('materials:' + role + ':' + classId + ':' + selectedSession + ':' + type + ':' + search + ':' + page, s => s.materials.list(role, classId, { page, search, type: type ? type as 'document' | 'video' : undefined, sessionId: selectedSession }));
    const detail = Number(query.get('materialId')) || 0;
    function selectDetail(id: number) {
        const next = new URLSearchParams(query.toString());
        next.set('classId', String(classId));
        if (id) next.set('materialId', String(id)); else next.delete('materialId');
        router.replace(pathname + '?' + next, { scroll: false });
    }
    const expired = course.data?.is_expired ?? true;
    return <section className="space-y-5">
        <div className="flex flex-wrap justify-between gap-3"><h2 className="text-xl font-semibold">{sessionId ? 'Tài liệu buổi học' : 'Link tài liệu của lớp'}</h2><div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => void resource.refresh()}>Làm mới tài liệu</Button>{role === 'manager' && !expired && <Button onClick={() => setEditor('new')}>Thêm link tài liệu</Button>}</div></div>
        <Feedback message={message} /><ResourceFeedback resource={course} />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <Field label="Tìm tài liệu"><input type="search" className="form-control" value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} /></Field>
            <Field label="Loại tài liệu"><select className="form-control" value={type} onChange={event => { setType(event.target.value); setPage(1); }}><option value="">Document và Video</option><option value="document">Document</option><option value="video">Video</option></select></Field>
            {!sessionId && <Field label="Buổi tài liệu"><select className="form-control" value={session} onChange={event => { setSession(event.target.value); setPage(1); }}><option value="">Tất cả buổi / Chung lớp</option>{sessions.data?.map(row => <option key={row.id} value={row.id}>Buổi {row.session_number} · {row.title}</option>)}</select></Field>}
        </div>
        <ResourceFeedback resource={resource} /><ResourceFeedback resource={sessions} />
        {resource.data && course.data && <>
            <div className="grid items-start gap-4 md:grid-cols-2 xl:grid-cols-3">{resource.data.items.map(material => {
                const status = materialStatus(material, course.data!.expires_at, now);
                return <Card key={material.id} className="space-y-3 p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3"><h3 className="break-words text-lg font-semibold">{material.title}</h3><StatusBadge status={status === 'available' ? 'available' : status === 'removed' ? 'removed' : 'expired'} label={materialStatusLabels[status]} /></div>
                    <p className="text-sm">{material.material_type === 'document' ? 'Document' : 'Video'} · {material.session_id ? 'Buổi ID ' + material.session_id : 'Chung lớp'}</p>
                    <p className="text-sm">{material.expires_at ? 'Hạn riêng ' + formatApiDate(material.expires_at) : 'Không có hạn riêng'}{youtubeExpiryExempt(material) && ' · YouTube miễn hạn riêng'}</p>
                    {material.deletion_reason && <p className="whitespace-pre-wrap text-sm text-red-800">Lý do gỡ · {material.deletion_reason}</p>}
                    <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => selectDetail(material.id)}>Xem link · {material.title}</Button>
                        {role === 'manager' && !expired && !material.deleted_at && <Button variant="outline" onClick={() => setEditor(material)}>Sửa link · {material.title}</Button>}
                        {role !== 'student' && !expired && !material.deleted_at && <ConfirmAction title="Gỡ link tài liệu?" trigger={'Gỡ link · ' + material.title} reasonLimit={2000} description="Link sẽ bị gỡ khỏi LMS. Lý do được lưu trong lịch sử, Admin gỡ sẽ thông báo Manager." onConfirm={async reason => {
                            await write(async () => (await services).materials.remove(role, classId, material.id, reason));
                            setMessage(role === 'admin' ? 'Đã gỡ link và gửi phản hồi đến Manager.' : 'Đã gỡ link và lưu lý do.');
                        }} />}
                    </div>
                </Card>;
            })}</div>
            {!resource.data.items.length && <EmptyState title="Không có link tài liệu phù hợp" description="Đổi bộ lọc hoặc làm mới dữ liệu. Student chỉ thấy link còn quyền truy cập." />}<Pagination {...resource.data} onPage={setPage} />
        </>}
        <Dialog open={editor !== null} onOpenChange={open => { if (!open) setEditor(null); }} title={editor === 'new' ? 'Thêm link tài liệu' : 'Sửa link tài liệu'} description="Dùng link HTTPS. Chọn phạm vi chung lớp hoặc buổi thuộc cùng lớp.">
            {editor && <MaterialForm key={editor === 'new' ? 'new' : editor.id} classId={classId} sessionId={sessionId} material={editor === 'new' ? undefined : editor} onCancel={() => setEditor(null)} onSaved={() => { setEditor(null); setMessage('Đã lưu link tài liệu và làm mới dữ liệu.'); }} />}
        </Dialog>
        <Dialog open={detail > 0} onOpenChange={open => { if (!open) selectDetail(0); }} title="Chi tiết link tài liệu" description="Quyền được kiểm tra lại trước khi mở dịch vụ bên ngoài.">
            {detail > 0 && <MaterialContent key={role + ':' + classId + ':' + detail} role={role} classId={classId} materialId={detail} />}
        </Dialog>
    </section>;
}
