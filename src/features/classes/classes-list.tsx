"use client";
import { useState } from 'react';
import Link from 'next/link';
import type { Role } from '@/types/lms';
import { useApiData, useApiResource, formatApiDate } from '@/state/api-data-provider';
import { classCardData } from '@/lib/api/classes';
import { detailHref } from '@/config/routes';
import { ClassCard } from '@/components/shared/class-card';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/states';
import { Feedback, Field, Pagination, ResourceFeedback, ConfirmAction } from '@/components/shared/management-ui';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { ClassForm } from './class-form';
import { EnrollmentHistory } from '@/features/enrollments/enrollment-history';
export function ClassesList({ role, initialView }: {
    role: Role;
    initialView?: string;
    initialClassId?: string;
}) {
    const [view, setView] = useState(initialView ?? 'registered'), [search, setSearch] = useState(''), [page, setPage] = useState(1), [create, setCreate] = useState(false), [message, setMessage] = useState('');
    return <div className="dashboard-page management-content space-y-6">
    <PageHeader title={role === 'manager' ? 'Lớp phụ trách' : 'Lớp học'} description="Danh sách và quyền truy cập lấy từ API. Mỗi lần ghi danh giữ riêng kết quả." actions={role === 'admin' ? <Button onClick={() => setCreate(true)}>Tạo lớp học</Button> : undefined}/>
    <Feedback message={message}/>
        {role === 'student' && <div className="flex flex-wrap gap-2" aria-label="Danh sách lớp học">
            {[['registered', 'Lớp đã đăng ký'], ['find', 'Tìm lớp'], ['requests', 'Yêu cầu của tôi'], ['history', 'Lịch sử ghi danh']].map(([id, label]) => <Button key={id} variant={view === id ? 'default' : 'outline'} aria-pressed={view === id} onClick={() => {
                    setView(id);
                    setPage(1);
                    setSearch('');
                }}>
            {label}
            </Button>)}
        </div>}
 {role === 'student' && view === 'history' ? <EnrollmentHistory role={role}/> : role === 'student' && view === 'requests' ? <OwnRequests /> : <>
        <Field label="Tìm lớp học">
        <input className="form-control max-w-md" value={search} onChange={e => {
                setSearch(e.target.value);
                setPage(1);
            }} placeholder="Tên lớp, mã hoặc Manager"/>
        </Field>
        <Collection key={role + '-' + view} role={role} search={search} page={page} onPage={setPage} discover={view === 'find'}/>
        </>}
 <Dialog open={create} onOpenChange={setCreate} title="Tạo lớp học" description="Cấu hình Manager, capacity, ngày hết hạn Việt Nam và ngưỡng hoàn thành.">
        {create && <ClassForm onCancel={() => setCreate(false)} onSaved={() => {
                setCreate(false);
                setMessage('Đã tạo lớp và đọc lại dữ liệu.');
            }}/>}
    </Dialog>
    </div>;
}
function Collection({ role, search, page, onPage, discover }: {
    role: Role;
    search: string;
    page: number;
    onPage: (page: number) => void;
    discover: boolean;
}) {
    const resource = useApiResource('classes:' + role + ':' + discover + ':' + search + ':' + page, s => s.classes.list(role, {
        search, page, discover: role === 'student' && discover
    }));
    return <div className="space-y-5">
    <ResourceFeedback resource={resource}/>
    <Button variant="outline" onClick={() => void resource.refresh()}>Làm mới</Button>
        {resource.data && <>
            {resource.data.items.length ? <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                {resource.data.items.map(course => <ClassCard key={course.id} course={classCardData(course)} registered={role === 'student' && (!discover || course.is_enrolled)} expired={course.is_expired} href={detailHref(role, String(course.id)) + (role === 'student' && discover ? '&preview=1' : '')} actions={role === 'student' && discover ? <p className="text-sm">
                    {course.is_enrolled ? 'Đã ghi danh' : course.enrolled_count >= course.capacity ? 'Đủ sĩ số · Vẫn xem preview được' : 'Còn chỗ · Cần Manager duyệt'}
                    </p> : undefined}/>)}
            </div> : <EmptyState title="Không có lớp phù hợp" description={role === 'student' && !discover ? 'Lớp bị gỡ hoặc hết hạn nằm trong lịch sử ghi danh.' : 'Thử từ khóa khác.'}/>}<Pagination {...resource.data} onPage={onPage}/>
        </>}
    </div>;
}
function OwnRequests() {
    const { services, write } = useApiData();
    const [page, setPage] = useState(1);
    const resource = useApiResource('own-requests:' + page, s => s.enrollments.ownRequests(page));
    return <section className="space-y-4">
    <h2 className="text-xl font-semibold">Yêu cầu của tôi</h2>
    <ResourceFeedback resource={resource}/>
        {resource.data && <>
            {resource.data.items.map(row => <Card key={row.id} className="space-y-3 p-5">
            <h3 className="font-semibold">Lớp #{row.class_id} · Request #{row.id}
            </h3>
            <p className="text-sm">
            {({
                pending: 'Đang chờ', approved: 'Đã duyệt', declined: 'Từ chối', cancelled: 'Đã hủy'
            })[row.status]} · {formatApiDate(row.created_at)}
            </p>
            <p className="whitespace-pre-wrap text-sm">
            {row.reason}
            </p>
                {row.decision_reason && <p className="text-sm text-red-800">Lý do từ chối: {row.decision_reason}
                </p>}<Button asChild variant="outline">
            <Link href={detailHref('student', String(row.class_id)) + '&preview=1'}>Xem preview / gửi lại</Link>
            </Button>
                {row.status === 'pending' && <ConfirmAction title="Hủy yêu cầu?" trigger="Hủy yêu cầu" description="Không tăng số decline; không xóa lịch sử cũ." needsReason={false} onConfirm={async () => {
                        await write(async () => (await services).enrollments.cancel(row.class_id, row.id));
                    }}/>}
            </Card>)}{!resource.data.items.length && <EmptyState title="Chưa có yêu cầu" description="Tìm lớp để gửi yêu cầu tham gia."/>}<Pagination {...resource.data} onPage={setPage}/>
        </>}
    </section>;
}
