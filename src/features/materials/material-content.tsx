"use client";
import { useEffect, useState } from 'react';
import type { Role } from '@/types/lms';
import { materialStatus, youtubeExpiryExempt } from '@/lib/api/materials';
import { useApiData, useApiResource, formatApiDate } from '@/state/api-data-provider';
import { Feedback, ResourceFeedback } from '@/components/shared/management-ui';
import { Button } from '@/components/ui/button';

export const materialStatusLabels = { available: 'Có thể truy cập', expired: 'Đã hết hạn tài liệu', 'class-expired': 'Lớp đã hết hạn', removed: 'Đã gỡ' };
export function MaterialContent({ role, classId, materialId }: { role: Role; classId: number; materialId: number }) {
    const { services, now, readNow } = useApiData(), [error, setError] = useState(''), [busy, setBusy] = useState(false), [denied, setDenied] = useState(false);
    const resource = useApiResource('material-detail:' + role + ':' + classId + ':' + materialId, async s => {
        const [material, course] = await Promise.all([s.materials.detail(role, classId, materialId), s.classes.detail(role, classId)]);
        return { material, course };
    });
    const refresh = resource.refresh;
    useEffect(() => { const timer = setInterval(() => void refresh(), 15000); return () => clearInterval(timer); }, [refresh]);
    const data = resource.data, status = data ? materialStatus(data.material, data.course.expires_at, now) : null;
    return <div className="space-y-4"><ResourceFeedback resource={resource} /><Feedback message={error} error />
        {data && !denied && <>
            <h2 className="break-words text-xl font-semibold">{data.material.title}</h2>
            <p className="whitespace-pre-wrap break-words text-sm leading-7">{data.material.description}</p>
            <p className="text-sm">{data.material.material_type === 'document' ? 'Document' : 'Video'} · {data.material.session_id ? 'Buổi ID ' + data.material.session_id : 'Chung lớp'}</p>
            <p className="text-sm">{materialStatusLabels[status!]} · {data.material.expires_at ? 'Hạn riêng ' + formatApiDate(data.material.expires_at) : 'Không có hạn riêng'}</p>
            {youtubeExpiryExempt(data.material) && <p className="text-sm">Video YouTube miễn hạn riêng. Quyền lớp và enrollment vẫn áp dụng.</p>}
            {data.material.deletion_reason && <p className="whitespace-pre-wrap text-sm text-red-800">Lý do gỡ · {data.material.deletion_reason}</p>}
            <p className="break-all text-sm">{data.material.url}</p>
            <Button disabled={busy || !now || status !== 'available' || !!resource.error || resource.loading} onClick={async () => {
                const popup = window.open('about:blank', '_blank');
                if (!popup) { setError('Trình duyệt đã chặn cửa sổ mới. Cho phép mở cửa sổ để xem link.'); return; }
                popup.opener = null;
                setBusy(true); setError('');
                try {
                    const s = await services;
                    const [material, course] = await Promise.all([s.materials.detail(role, classId, materialId), s.classes.detail(role, classId)]);
                    if (course.is_expired || materialStatus(material, course.expires_at, readNow()) !== 'available') throw new Error('Link đã hết hạn hoặc đã gỡ. Làm mới dữ liệu trước khi mở.');
                    popup.location.replace(material.url);
                } catch (cause) {
                    popup.close(); setDenied(true);
                    setError(cause instanceof Error ? cause.message : 'Không còn quyền mở link.');
                    await resource.refresh();
                } finally { setBusy(false); }
            }}>{busy ? 'Đang kiểm tra quyền…' : 'Mở link HTTPS'}</Button>
            <p className="text-xs leading-6 text-muted-foreground">Link mở ở dịch vụ bên ngoài. Quyền chia sẻ tại YouTube/Drive/OneDrive do chủ link quản lý; LMS không thu hồi được URL bạn đã biết.</p>
        </>}
        {denied && <Button variant="outline" onClick={async () => { if (await resource.refresh()) { setDenied(false); setError(''); } }}>Kiểm tra lại quyền truy cập</Button>}
    </div>;
}
