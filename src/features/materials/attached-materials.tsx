"use client";
import type { Role } from '@/types/lms';
import { LibraryWorkspace } from './library-workspace';
export function AttachedMaterials({ role, classId, sessionId }: { role: Role; classId: number; sessionId: number }) {
    return <LibraryWorkspace role={role} classId={classId} sessionId={sessionId} />;
}
