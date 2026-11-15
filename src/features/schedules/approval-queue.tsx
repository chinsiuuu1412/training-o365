"use client";
import Link from 'next/link';
import { useState } from 'react';
import { useApiData, useApiResource, formatApiDate } from '@/state/api-data-provider';
import type { PendingProposal } from '@/lib/api/sessions';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { ActionForm, Field, Feedback, Pagination, ResourceFeedback } from '@/components/shared/management-ui';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/states';
import { detailHref } from '@/config/routes';

export function ApprovalQueue() {
    const { services, write } = useApiData(), [page, setPage] = useState(1), [message, setMessage] = useState('');
    const [selected, setSelected] = useState<{ proposal: PendingProposal; approve: boolean } | null>(null);
    const resource = useApiResource('schedule-queue:' + page, s => s.sessions.pending(page));
    return <div className="dashboard-page space-y-6">
        <PageHeader title="Duyệt lịch học" description="Duyệt hoặc từ chối đề xuất của Manager. Lịch đã duyệt giữ hiệu lực khi thay đổi còn chờ hoặc bị từ chối." actions={<Button variant="outline" onClick={() => void resource.refresh()}>Làm mới</Button>} />
        <Feedback message={message} /><ResourceFeedback resource={resource} />
        {resource.data && <>
            {resource.data.items.map(row => <Card key={row.id} className="space-y-4 p-5">
                <h2 className="text-lg font-semibold">{row.title} · Buổi {row.session_number}</h2>
                <p className="text-sm">Lớp #{row.class_id} · Đề xuất #{row.id} · Người gửi #{row.proposed_by}</p>
                <p className="text-sm">{formatApiDate(row.starts_at)} — {formatApiDate(row.ends_at)} (Việt Nam)</p>
                <p className="text-sm">Gửi lúc {formatApiDate(row.created_at)}</p>
                <div className="flex flex-wrap gap-2">
                    <Button asChild variant="outline"><Link href={detailHref('admin', String(row.class_id), undefined, 'lessons') + '&sessionId=' + row.session_id}>Xem lịch hiện tại và chi tiết</Link></Button>
                    <Button onClick={() => setSelected({ proposal: row, approve: true })}>Phê duyệt</Button>
                    <Button variant="outline" onClick={() => setSelected({ proposal: row, approve: false })}>Từ chối</Button>
                </div>
            </Card>)}
            {!resource.data.items.length && <EmptyState title="Không có lịch chờ duyệt" description="Đề xuất đã xử lý được giữ trong lịch sử buổi học của lớp." />}
            <Pagination {...resource.data} onPage={setPage} />
        </>}
        <Dialog open={!!selected} onOpenChange={open => { if (!open) setSelected(null); }} title={selected?.approve ? 'Phê duyệt lịch?' : 'Từ chối lịch?'} description={selected?.proposal.title ?? 'Xem xét đề xuất lịch'}>
            <ActionForm key={selected?.proposal.id + '-' + selected?.approve} submitLabel="Xác nhận quyết định" onCancel={() => setSelected(null)} onSubmit={async form => {
                if (!selected) return;
                const row = selected.proposal;
                await write(async () => (await services).sessions.review(row.class_id, row.session_id, row.id, selected.approve ? 'approve' : 'reject', String(form.get('reason') ?? '')));
                setSelected(null);
                setMessage('Đã xử lý đề xuất lịch và làm mới dữ liệu.');
            }}>
                {selected?.approve ? <p className="text-sm leading-6">Lịch mới sẽ có hiệu lực sau khi được duyệt. Hệ thống kiểm tra lại thời gian và trạng thái đề xuất.</p> : <Field label="Lý do từ chối *"><textarea name="reason" required maxLength={2000} className="form-control" /></Field>}
            </ActionForm>
        </Dialog>
    </div>;
}
