"use client";
import type { Role } from '@/types/lms';
import { EmptyState } from '@/components/shared/states';
export function RequestInbox({ role }: { role: Role }) {
    return <EmptyState title="Yêu cầu tự do thuộc giai đoạn sau MVP" description={role === 'student' ? 'Xem yêu cầu ghi danh trong Lớp học.' : 'Xử lý ghi danh tại lớp học và đề xuất lịch tại Duyệt lịch.'} />;
}
