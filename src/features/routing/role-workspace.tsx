"use client";
import { Suspense } from 'react';
import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import type { Role } from '@/types/lms';
import { AppShell } from '@/components/layout/app-shell';
import { LoadingState, EmptyState } from '@/components/shared/states';
import { AccountProfile } from '@/features/accounts/account-profile';
import { AccountSettings } from '@/features/accounts/account-settings';
import { AccountsList } from '@/features/accounts/accounts-list';
import { ClassesList } from '@/features/classes/classes-list';
import { ClassDetail } from '@/features/classes/class-detail';
import { RoleDashboard } from '@/features/dashboard/role-dashboard';
import { ScheduleCalendar } from '@/features/schedules/schedule-calendar';
import { managementEnabled, schedulingEnabled, quizzesEnabled, communicationsEnabled } from '@/state/auth-provider';
import { NotificationInbox } from '@/features/notifications/notification-inbox';
import { LibraryWorkspace } from '@/features/materials/library-workspace';
import { QuizPlayer } from '@/features/quizzes/quiz-player';
import { ApprovalQueue } from '@/features/schedules/approval-queue';
import { validRouteId, deferredMvpLocation } from '@/config/routes';
const FixtureControls = process.env.NEXT_PUBLIC_DATA_SOURCE === 'fixture' || process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_DATA_SOURCE !== 'api' ? dynamic(() => import('./fixture-workspace').then(module => module.FixtureDataControls)) : null;
function Content({ role, section }: {
    role: Role;
    section: string;
}) {
    const query = useSearchParams(), classId = query.get('classId') ?? undefined, quizId = query.get('quizId') ?? undefined;
    const invalid = classId !== undefined && !validRouteId(classId) || quizId !== undefined && (section !== 'classes' || !classId || role !== 'student' || !validRouteId(quizId)) || ['materialId', 'notificationId'].some(key => query.has(key) && !validRouteId(query.get(key)!));
    let content;
    if (deferredMvpLocation(section, new URLSearchParams(query.toString())))
        content = <EmptyState title="Chức năng thuộc giai đoạn sau MVP" description="Sử dụng Hộp thư đến, Library link HTTPS và các hàng đợi nghiệp vụ tại lớp học." />;
    else if (invalid)
        content = <EmptyState title="Đường dẫn chi tiết không hợp lệ" description="Dùng ID số của API. ID slug từ demo v1 không được tự ánh xạ thành ID tài khoản hoặc enrollment."/>;
    else if (section === 'settings')
        content = <AccountSettings />;
    else if (section === 'profile')
        content = <AccountProfile />;
    else if (!managementEnabled || quizId && !quizzesEnabled)
        content = <EmptyState title={quizId ? 'Quiz #' + quizId : classId ? 'Lớp #' + classId : 'Chức năng chưa mở'} description="Luồng này chưa được mở/kiểm chứng với backend trong bản triển khai. Player được nối ở đợt riêng."/>;
    else if (!section)
        content = <RoleDashboard role={role}/>;
    else if (section === 'notifications' && communicationsEnabled)
        content = <NotificationInbox role={role} />;
    else if (section === 'library' && communicationsEnabled)
        content = <LibraryWorkspace role={role} />;
    else if (role === 'student' && classId && quizId)
        content = <QuizPlayer key={classId + ':' + quizId} classId={classId} quizId={quizId} />;
    else if (role === 'admin' && section === 'schedule-approvals' && schedulingEnabled)
        content = <ApprovalQueue />;
    else if (role === 'admin' && (section === 'students' || section === 'managers'))
        content = <AccountsList key={section} role={section === 'students' ? 'student' : 'manager'}/>;
    else if (section === 'classes')
        content = classId ? <ClassDetail key={role + '-' + classId + '-' + query.get('tab') + '-' + query.get('preview')} role={role} classId={classId} initialTab={query.get('tab') ?? undefined} preview={query.get('preview') === '1'}/> : <ClassesList key={role} role={role} initialView={query.get('view') ?? undefined}/>;
    else if (role === 'student' && section === 'schedule')
        content = <ScheduleCalendar role={role}/>;
    else
        content = <EmptyState title="Chức năng chưa mở" description="Chỉ mở các luồng được nối và kiểm chứng ở đợt tương ứng."/>;
    return <AppShell role={role} demoControls={FixtureControls ? <FixtureControls /> : undefined}>
    {content}
    </AppShell>;
}
export function RoleWorkspace(props: {
    role: Role;
    section?: string;
}) {
    return <Suspense fallback={<LoadingState />}>
    <Content role={props.role} section={props.section ?? ''}/>
    </Suspense>;
}
