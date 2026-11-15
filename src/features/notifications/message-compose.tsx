"use client";
import { useState } from 'react';
import type { Account } from '@/lib/api/accounts';
import type { UserId } from '@/lib/api/dto';
import { ApiError } from '@/lib/api/client';
import { useApiData, useApiResource } from '@/state/api-data-provider';
import { ActionForm, Field, Feedback, Pagination, ResourceFeedback } from '@/components/shared/management-ui';
import { Button } from '@/components/ui/button';

export function MessageCompose({ role, onCancel, onSent }: { role: 'admin' | 'manager'; onCancel: () => void; onSent: (count: number) => void }) {
    const { services, write } = useApiData();
    const [mode, setMode] = useState('people'), [page, setPage] = useState(1), [selected, setSelected] = useState<UserId[]>([]);
    const [classIds, setClasses] = useState<number[]>([]), [includeManagers, setIncludeManagers] = useState(false), [audience, setAudience] = useState<Account[]>([]);
    const [title, setTitle] = useState(''), [content, setContent] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('');
    const directory = useApiResource('recipients:' + role + ':' + page, s => s.messages.recipients(role, page));
    const classes = useApiResource('audience-classes:' + role, s => s.messages.audienceClasses(role));
    const rows = mode === 'people' ? directory.data?.items ?? [] : audience.slice((page - 1) * 20, page * 20);
    function clearSelection() { setSelected([]); setAudience([]); setPage(1); }
    async function selectAll() {
        setBusy(true); setError('');
        try {
            const s = await services, accounts = mode === 'people' ? await s.messages.allRecipients(role) : await s.messages.classAudience(role, classIds, includeManagers);
            if (mode === 'classes') setAudience(accounts);
            setSelected(accounts.map(row => row.userId));
            setPage(1);
        } catch (cause) { setError(cause instanceof Error ? cause.message : 'Không tải đủ người nhận.'); }
        finally { setBusy(false); }
    }
    return <div className="space-y-4">
        <Feedback message={error} error />
        <ActionForm submitLabel="Gửi thông báo" onCancel={onCancel} onSubmit={async () => {
            if (busy) throw new Error('Đang tải đầy đủ danh sách người nhận.');
            try {
                const receipt = await write(async () => (await services).messages.send(role, { recipient_ids: selected, title, content }));
                onSent(receipt.recipient_count);
            } catch (cause) {
                if (cause instanceof ApiError && cause.code === 'invalid_recipients') { clearSelection(); await directory.refresh(); }
                throw cause;
            }
        }}>
            <Field label="Phạm vi chọn"><select className="form-control" value={mode} disabled={busy} onChange={event => { setMode(event.target.value); clearSelection(); }}><option value="people">Chọn người nhận trực tiếp</option><option value="classes">Chọn theo lớp</option></select></Field>
            {mode === 'classes' && <fieldset className="space-y-3"><legend className="font-semibold">Lớp nhận thông báo</legend><ResourceFeedback resource={classes} />
                {classes.data?.map(course => <label key={course.id} className="flex items-start gap-3 text-sm"><input type="checkbox" disabled={busy} checked={classIds.includes(course.id)} onChange={event => { setClasses(previous => event.target.checked ? [...previous, course.id] : previous.filter(id => id !== course.id)); clearSelection(); }} /><span>{course.name}{course.is_expired && ' · Đã hết hạn'}</span></label>)}
                {role === 'admin' && <label className="flex items-start gap-3 text-sm"><input type="checkbox" disabled={busy} checked={includeManagers} onChange={event => { setIncludeManagers(event.target.checked); clearSelection(); }} /><span>Bao gồm Manager phụ trách</span></label>}
            </fieldset>}
            <Button type="button" variant="outline" disabled={busy || mode === 'classes' && !classIds.length} onClick={() => void selectAll()}>{busy ? 'Đang tải mọi trang…' : mode === 'people' ? 'Chọn tất cả người nhận (mọi trang)' : 'Chọn người nhận của các lớp (mọi trang)'}</Button>
            <Button type="button" variant="ghost" disabled={busy} onClick={() => setSelected([])}>Bỏ chọn tất cả</Button>
            {mode === 'people' && <ResourceFeedback resource={directory} />}
            <fieldset className="space-y-3"><legend className="font-semibold">Người nhận</legend>
                {rows.map(account => <label key={account.id} className="flex items-start gap-3 rounded-lg border p-3 text-sm">
                    <input type="checkbox" disabled={busy} checked={selected.includes(account.userId)} onChange={event => setSelected(previous => event.target.checked ? [...new Set([...previous, account.userId])] : previous.filter(id => id !== account.userId))} />
                    <span>{account.name} · {account.role === 'manager' ? 'Manager' : 'Student'}<span className="block break-all text-xs">{account.email} · User ID {account.userId}</span></span>
                </label>)}
                {!rows.length && <p className="text-sm">Chưa có người nhận trong danh sách hiện tại.</p>}
            </fieldset>
            {mode === 'people' && directory.data ? <Pagination {...directory.data} onPage={setPage} /> : mode === 'classes' && <Pagination page={page} pageSize={20} total={audience.length} onPage={setPage} />}
            <p role="status" className="text-sm">Đã chọn {selected.length} người nhận. Bỏ chọn từng người để loại trừ.</p>
            <Field label="Tiêu đề *"><input required maxLength={200} className="form-control" value={title} onChange={event => setTitle(event.target.value)} /></Field>
            <Field label="Nội dung *"><textarea required maxLength={20000} className="form-control min-h-32" value={content} onChange={event => setContent(event.target.value)} /></Field>
            <p className="text-xs leading-6 text-muted-foreground">Nếu mất phản hồi sau khi gửi, kiểm tra Inbox người nhận trước khi gửi lại. Hệ thống chưa tích hợp gửi email.</p>
        </ActionForm>
    </div>;
}
