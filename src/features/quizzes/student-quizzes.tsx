"use client";
import Link from 'next/link';
import { useState } from 'react';
import { useApiData, useApiResource, formatApiDate } from '@/state/api-data-provider';
import { quizAvailability } from '@/lib/api/quizzes';
import { detailHref } from '@/config/routes';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/shared/status-badge';
import { Pagination, ResourceFeedback } from '@/components/shared/management-ui';
import { EmptyState } from '@/components/shared/states';

export function StudentQuizzes({ classId }: { classId: number }) {
    const { now } = useApiData(), [page, setPage] = useState(1);
    const resource = useApiResource('student-quizzes:' + classId + ':' + page, s => s.quizzes.studentList(classId, page));
    const labels = { available: 'Có thể bắt đầu', 'not-open': 'Chưa đến giờ mở', expired: 'Đã hết hạn', exhausted: 'Đã dùng hết lượt' };
    return <section className="space-y-5">
        <h2 className="text-xl font-semibold">Test và Assignment</h2><ResourceFeedback resource={resource} />
        {resource.data && <>
            {resource.data.items.map(quiz => <Card key={quiz.id} className="space-y-3 p-5">
                <div className="flex flex-wrap items-center gap-3"><h3 className="text-lg font-semibold">{quiz.title}</h3><StatusBadge status={quiz.quiz_type === 'test' ? 'waiting' : 'available'} label={quiz.quiz_type === 'test' ? 'Test' : 'Assignment'} /></div>
                <p className="text-sm">{quiz.duration_seconds} giây · Điểm đạt {quiz.pass_score}% · Đã dùng {quiz.used_attempts}/{quiz.allowed_attempts} lượt</p>
                <p className="text-sm">Mở {formatApiDate(quiz.open_at)} · Hạn hiệu lực {formatApiDate(quiz.effective_deadline)}</p>
                <p className="text-sm">{now ? labels[quizAvailability(quiz, now)] : 'Đang đồng bộ thời gian'}</p>
                <p className="text-sm">Điểm cao nhất {quiz.best_score_percent === null ? 'Chưa có' : quiz.best_score_percent + '%'} · {quiz.is_passed ? 'Đạt' : 'Chưa đạt'}</p>
                <Button asChild variant="outline"><Link href={detailHref('student', String(classId), String(quiz.id))}>Xem / Làm bài · {quiz.title}</Link></Button>
            </Card>)}
            {!resource.data.items.length && <EmptyState title="Chưa có Quiz đã phát hành" description="Manager sẽ phát hành bài cho lớp." />}
            <Pagination {...resource.data} onPage={setPage} />
        </>}
    </section>;
}
