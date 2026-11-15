"use client";
import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { Role } from '@/types/lms';
import { useApiData, useApiResource, formatApiDate } from '@/state/api-data-provider';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/states';
import { Feedback, Field, Pagination, ResourceFeedback } from '@/components/shared/management-ui';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { StatusBadge } from '@/components/shared/status-badge';
import { MessageCompose } from './message-compose';

export function NotificationInbox({ role }: { role: Role }) {
    const router = useRouter(), query = useSearchParams(), { services, write } = useApiData();
    const [filter, setFilter] = useState('all'), [page, setPage] = useState(1), [compose, setCompose] = useState(false), [message, setMessage] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false);
    const selected = Number(query.get('notificationId')) || 0;
    const resource = useApiResource('inbox:' + filter + ':' + page, s => s.messages.inbox(page, filter === 'all' ? undefined : filter === 'read'));
    function detail(id: number) {
        const next = new URLSearchParams(query.toString());
        if (id) next.set('notificationId', String(id)); else next.delete('notificationId');
        router.replace('/' + role + '/notifications/' + (next.size ? '?' + next : ''), { scroll: false });
    }
    return <div className="dashboard-page space-y-5">
        <PageHeader title="Hộp thư đến" description="Thông báo trong LMS. Mở chi tiết và đánh dấu đọc là hai thao tác riêng." actions={role !== 'student' ? <Button onClick={() => setCompose(true)}>Soạn thông báo</Button> : undefined} />
        <Feedback message={message} /><Feedback message={error} error />
        <div className="flex flex-wrap items-end gap-3"><Field label="Trạng thái đọc"><select className="form-control" value={filter} onChange={event => { setFilter(event.target.value); setPage(1); }}><option value="all">Tất cả</option><option value="unread">Chưa đọc</option><option value="read">Đã đọc</option></select></Field><Button variant="outline" onClick={() => void resource.refresh()}>Làm mới hộp thư</Button></div>
        <ResourceFeedback resource={resource} />
        {resource.data && <>
            {resource.data.items.map(row => <Card key={row.id} className={'space-y-3 p-5 ' + (!row.is_read ? 'border-blue-200 bg-blue-50/40' : '')}>
                <div className="flex flex-wrap items-start justify-between gap-3"><h2 className="min-w-0 break-words text-lg font-semibold">{row.title}</h2><StatusBadge status={row.is_read ? 'approved' : 'waiting'} label={row.is_read ? 'Đã đọc' : 'Chưa đọc'} /></div>
                <p className="text-sm text-muted-foreground">{row.automated ? 'Hệ thống LMS' : 'Tài khoản #' + row.sender_id} · {formatApiDate(row.created_at)}</p>
                <p className="line-clamp-2 break-words text-sm leading-7">{row.content}</p>
                <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => detail(row.id)}>Xem chi tiết · {row.title}</Button><Button variant="ghost" disabled={busy} onClick={async () => {
                    setBusy(true); setError('');
                    try { await write(async () => (await services).messages.read(row.id, !row.is_read)); setMessage('Đã cập nhật trạng thái đọc.'); }
                    catch (cause) { setError(cause instanceof Error ? cause.message : 'Không cập nhật được trạng thái.'); }
                    finally { setBusy(false); }
                }}>{row.is_read ? 'Đánh dấu chưa đọc' : 'Đánh dấu đã đọc'}</Button></div>
            </Card>)}
            {!resource.data.items.length && <EmptyState title="Không có thông báo phù hợp" description="Chọn trạng thái khác hoặc làm mới hộp thư." />}<Pagination {...resource.data} onPage={setPage} />
        </>}
        <Dialog open={compose} onOpenChange={setCompose} title="Soạn thông báo" description="Chọn người nhận theo quyền. Thông báo được lưu trong Inbox của người nhận.">
            {compose && role !== 'student' && <MessageCompose role={role} onCancel={() => setCompose(false)} onSent={count => { setCompose(false); setMessage('Đã gửi thông báo trong LMS đến ' + count + ' người nhận.'); }} />}
        </Dialog>
        <Dialog open={selected > 0} onOpenChange={open => { if (!open) detail(0); }} title="Chi tiết thông báo" description="Xem nội dung giữ nguyên trạng thái đọc hiện tại.">
            {selected > 0 && <AnnouncementDetail key={selected} id={selected} />}
        </Dialog>
    </div>;
}
function AnnouncementDetail({ id }: { id: number }) {
    const { services, write } = useApiData(), [error, setError] = useState(''), [busy, setBusy] = useState(false);
    const resource = useApiResource('announcement:' + id, s => s.messages.detail(id));
    return <div className="space-y-4"><ResourceFeedback resource={resource} /><Feedback message={error} error />
        {resource.data && <>
            <h2 className="break-words text-xl font-semibold">{resource.data.title}</h2>
            <p className="text-sm">{formatApiDate(resource.data.created_at)} · {resource.data.is_read ? 'Đã đọc' : 'Chưa đọc'}</p>
            <p className="whitespace-pre-wrap break-words text-sm leading-7">{resource.data.content}</p>
            <Button variant="outline" disabled={busy} onClick={async () => {
                setBusy(true); setError('');
                try { await write(async () => (await services).messages.read(id, !resource.data!.is_read)); }
                catch (cause) { setError(cause instanceof Error ? cause.message : 'Không cập nhật được trạng thái đọc.'); }
                finally { setBusy(false); }
            }}>{resource.data.is_read ? 'Đánh dấu chưa đọc' : 'Đánh dấu đã đọc'}</Button>
        </>}
    </div>;
}
