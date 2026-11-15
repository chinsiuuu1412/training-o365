"use client";
import { useEffect, useState } from 'react';
import { Feedback } from '@/components/shared/management-ui';
import type { User } from '@/types/lms';
import { useAuth } from '@/state/auth-provider';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/shared/page-header';
export function ProfileContent({ user }: {
    user: User;
}) {
    const gender = user.gender ? ({
        male: 'Nam', female: 'Nữ', other: 'Khác'
    } as Record<string, string>)[user.gender] ?? user.gender : undefined;
    const fields = [['Họ và tên', user.name], ['Email', user.email], ...(user.role === 'student' ? [['MSSV', user.studentNumber], ['Trường/Viện HUST', user.school], ['Lớp–Khóa đại học', user.universityClass], ['Số điện thoại', user.phone], ['Giới tính', gender]] : [])];
    return <dl className="grid min-w-0 gap-4 sm:grid-cols-2">
        {fields.map(([label, value]) => <div className="min-w-0 rounded-lg bg-slate-50 p-4" key={label}>
        <dt className="text-xs font-medium text-muted-foreground">
        {label}
        </dt>
        <dd className="mt-2 break-words text-sm font-medium">
        {value || 'Chưa cung cấp'}
        </dd>
        </div>)}
    </dl>;
}
export function AccountProfileDialog({ user }: {
    user: User;
}) {
    const [open, setOpen] = useState(false);
    const { fixtureMode } = useAuth();
    return <>
    <Button variant="outline" size="sm" onClick={() => setOpen(true)}>Xem hồ sơ</Button>
    <Dialog open={open} onOpenChange={setOpen} title="Thông tin tài khoản" description={(fixtureMode ? 'Chế độ mô phỏng · ' : '') + 'Hồ sơ chỉ đọc trong phạm vi được phép.'}>
    {open && <ProfileContent user={user}/>}
    </Dialog>
    </>;
}
export function AccountProfile() {
    const { user, fixtureMode, refreshUser } = useAuth();
    const [error, setError] = useState('');
    useEffect(() => {
        let alive = true;
        void refreshUser().catch(cause => {
            if (alive)
                setError(cause instanceof Error ? cause.message : 'Không thể tải hồ sơ.');
        });
        return () => {
            alive = false;
        };
    }, [refreshUser]);
    return <div className="space-y-6">
    <PageHeader title="Hồ sơ của tôi" eyebrow={fixtureMode ? 'Chế độ mô phỏng' : undefined} description="Thông tin từ phiên hiện tại, chỉ đọc. Liên hệ Admin nếu cần cập nhật."/>
    <Feedback error message={error}/>
    <Button variant="outline" onClick={() => void refreshUser().then(() => setError('')).catch(cause => setError(cause instanceof Error ? cause.message : 'Không thể tải hồ sơ.'))}>Làm mới hồ sơ</Button>
    <Card className="p-5 sm:p-6">
    {user && <ProfileContent user={user}/>}
    </Card>
    </div>;
}
