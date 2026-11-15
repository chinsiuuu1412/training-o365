"use client";
import { useState } from 'react';
import type { QuizResult } from '@/lib/api/quizzes';
import { useApiResource, formatApiDate } from '@/state/api-data-provider';
import { Card } from '@/components/ui/card';
import { StatusBadge } from '@/components/shared/status-badge';
import { Pagination, ResourceFeedback } from '@/components/shared/management-ui';

export function clockLabel(milliseconds: number) {
    const total = Math.max(0, Math.ceil(milliseconds / 1000)), seconds = String(total % 60).padStart(2, '0'), minutes = Math.floor(total / 60);
    return minutes >= 60 ? Math.floor(minutes / 60) + ':' + String(minutes % 60).padStart(2, '0') + ':' + seconds : String(minutes).padStart(2, '0') + ':' + seconds;
}
export function QuizResultSummary({ result }: { result: QuizResult }) {
    const attempt = result.attempt;
    return <Card className="space-y-3 p-5">
        <h2 className="text-xl font-semibold">Kết quả lượt {attempt.attempt_number}</h2>
        <StatusBadge status={attempt.is_passed ? 'passed' : 'failed'} label={attempt.is_passed ? 'Đạt' : 'Chưa đạt'} />
        <p className="text-3xl font-semibold">{attempt.score_percent}%</p>
        <p className="text-sm">Điểm {attempt.score}/{attempt.max_score} · Đã nộp {formatApiDate(attempt.submitted_at)}</p>
        <p className="text-sm">Enrollment ID {attempt.enrollment_id} · Thời gian làm {attempt.time_spent_seconds} giây</p>
    </Card>;
}
export function AttemptHistory({ classId, quizId }: { classId: number; quizId: number }) {
    const [page, setPage] = useState(1);
    const resource = useApiResource('my-quiz-history:' + classId + ':' + quizId + ':' + page, s => s.quizzes.history(classId, quizId, page));
    return <section className="space-y-4">
        <h2 className="text-xl font-semibold">Lịch sử lượt làm</h2><ResourceFeedback resource={resource} />
        {resource.data && <>
            {resource.data.items.map(({ attempt }) => <article key={attempt.id} className="space-y-2 rounded-xl border bg-white p-4 text-sm">
                <h3 className="font-semibold">Lượt {attempt.attempt_number} · {attempt.status === 'in_progress' ? 'Đang làm' : attempt.is_passed ? 'Đạt' : 'Chưa đạt'}</h3>
                <p>{attempt.score_percent === null ? 'Chưa có điểm' : 'Điểm ' + attempt.score_percent + '%'}</p>
                <p>Bắt đầu {formatApiDate(attempt.started_at)}{attempt.submitted_at && ' · Nộp ' + formatApiDate(attempt.submitted_at)}</p>
            </article>)}
            {!resource.data.items.length && <p className="text-sm">Chưa có lượt làm.</p>}<Pagination {...resource.data} onPage={setPage} />
        </>}
    </section>;
}
