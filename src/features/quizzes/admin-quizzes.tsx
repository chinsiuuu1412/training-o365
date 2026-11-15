"use client";
import { ManagerQuizzes } from './manager-quizzes';
export function AdminQuizzes({ classId, expired }: { classId: number; expired: boolean }) {
    return <ManagerQuizzes role="admin" classId={classId} expired={expired} />;
}
