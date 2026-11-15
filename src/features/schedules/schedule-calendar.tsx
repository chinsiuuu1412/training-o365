"use client";
import { useState } from 'react';
import Link from 'next/link';
import type { Role } from '@/types/lms';
import { useApiResource, formatApiDate, useApiData } from '@/state/api-data-provider';
import { detailHref } from '@/config/routes';
import { schedulingEnabled } from '@/state/auth-provider';
import { PageHeader } from '@/components/shared/page-header';
import { ResourceFeedback } from '@/components/shared/management-ui';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { EmptyState, LoadingState } from '@/components/shared/states';
export function ScheduleCalendar({ role, classId }: {
    role: Role;
    classId?: string;
}) {
    const { now } = useApiData();
    const today = new Date(now + 7 * 3600000).toISOString().slice(0, 7);
    const [selectedMonth, setMonth] = useState(''), [selectedDay, setDay] = useState('');
    const month = selectedMonth || today;
    const [year, number] = month.split('-').map(Number);
    const resource = useApiResource('dashboard:' + role, s => s.dashboard.get(role));
    const sessions = (resource.data?.agenda.upcoming_sessions ?? []).filter(session => !classId || session.class_id === Number(classId));
    const day = (value: string | null) => value ? new Date(Date.parse(value) + 7 * 3600000).toISOString().slice(0, 10) : '';
    const visible = sessions.filter(session => day(session.starts_at).startsWith(month) && (!selectedDay || day(session.starts_at) === selectedDay));
    const days = new Date(Date.UTC(year, number, 0)).getUTCDate(), offset = (new Date(Date.UTC(year, number - 1, 1)).getUTCDay() + 6) % 7;
    function move(amount: number) {
        setMonth(new Date(Date.UTC(year, number - 1 + amount, 1)).toISOString().slice(0, 7));
        setDay('');
    }
    if (!now)
        return <LoadingState />;
    return <section className="space-y-5">
    <PageHeader title="Lịch học sắp tới" description="Dùng agenda từ response dashboard. Chỉ có buổi sắp tới còn quyền truy cập, không phải lịch sử toàn bộ lớp." actions={<Button variant="outline" onClick={() => void resource.refresh()}>Làm mới</Button>}/>
    <ResourceFeedback resource={resource}/>
    <Card className="space-y-4 p-4 sm:p-6">
    <div className="flex flex-wrap justify-between gap-3">
    <h2 className="text-xl font-semibold">Lịch học · {number}/{year}
    </h2>
    <div className="flex gap-2">
    <Button variant="outline" aria-label="Tháng trước" onClick={() => move(-1)}>←</Button>
    <Button variant="outline" onClick={() => {
            setMonth(today);
            setDay('');
        }}>Hôm nay</Button>
    <Button variant="outline" aria-label="Tháng sau" onClick={() => move(1)}>→</Button>
    </div>
    </div>
    <div className="grid grid-cols-7 gap-1 text-center text-xs">
        {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map(text => <span key={text}>
        {text}
        </span>)}{Array.from({
            length: offset
        }, (_, i) => <span key={'blank' + i}/>)}{Array.from({
            length: days
        }, (_, i) => {
            const date = month + '-' + String(i + 1).padStart(2, '0'), count = sessions.filter(session => day(session.starts_at) === date).length;
            return <button key={date} className="min-h-14 rounded-lg border border-border p-1 hover:bg-blue-50" aria-label={date + ', ' + count + ' buổi học'} aria-pressed={selectedDay === date} onClick={() => setDay(selectedDay === date ? '' : date)}>
            {i + 1}{count > 0 && <span className="block text-[10px] text-primary">
                {count} buổi</span>}
            </button>;
        })}
    </div>
    </Card>
        {visible.map(session => <Card key={session.id} className="space-y-3 p-5">
        <h3 className="font-semibold">
        {session.title}
        </h3>
        <p className="text-sm">
        {formatApiDate(session.starts_at)} — {formatApiDate(session.ends_at)} (Việt Nam)</p>
        <p className="text-sm">
        {session.location}
        </p>
        <Button asChild variant="outline">
        <Link href={detailHref(role, String(session.class_id), undefined, schedulingEnabled ? 'lessons' : 'overview') + (schedulingEnabled ? '&sessionId=' + session.id : '')}>{schedulingEnabled ? 'Xem buổi học / Điểm danh' : 'Xem lớp'}</Link>
        </Button>
        </Card>)}{resource.data && !visible.length && <EmptyState title="Không có buổi sắp tới ở thời gian đã chọn" description="Chuyển tháng hoặc bỏ chọn ngày. Agenda không cung cấp lịch sử buổi cũ."/>}
    </section>;
}
