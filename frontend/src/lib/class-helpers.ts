import type { RouteRole, ScheduleProposalDto } from "@/types/api";

export const CLASS_DETAIL_TABS = new Set([
  "overview",
  "students",
  "progress",
  "lessons",
  "quizzes",
  "requests",
  "materials",
]);

export function normalizeClassTab(rawTab?: string | null): string {
  if (!rawTab) return "overview";
  const mapped = rawTab === "sessions" ? "lessons" : rawTab;
  return CLASS_DETAIL_TABS.has(mapped) ? mapped : "overview";
}

export function getMaterialActionPermissions(params: {
  role: RouteRole;
  isClassExpired: boolean;
  deletedAt: string | null;
}): {
  isDeleted: boolean;
  canOpen: boolean;
  canEdit: boolean;
  canDelete: boolean;
} {
  const isDeleted = Boolean(params.deletedAt);
  return {
    isDeleted,
    canOpen: !isDeleted,
    canEdit: params.role === "manager" && !params.isClassExpired && !isDeleted,
    canDelete:
      (params.role === "manager" || params.role === "admin") &&
      !params.isClassExpired &&
      !isDeleted,
  };
}

export interface LessonDetailState {
  sessionId: number | null;
  proposals: ScheduleProposalDto[];
  loaded: boolean;
  loading: boolean;
  error: string | null;
}

export const INITIAL_LESSON_DETAIL_STATE: LessonDetailState = {
  sessionId: null,
  proposals: [],
  loaded: false,
  loading: false,
  error: null,
};

export function beginLessonDetailLoad(
  prev: LessonDetailState,
  sessionId: number,
): LessonDetailState {
  const sameSession = prev.sessionId === sessionId;
  return {
    sessionId,
    proposals: sameSession ? prev.proposals : [],
    loaded: sameSession ? prev.loaded : false,
    loading: true,
    error: null,
  };
}

export function resolveLessonDetailSuccess(
  sessionId: number,
  proposals: ScheduleProposalDto[],
): LessonDetailState {
  return {
    sessionId,
    proposals,
    loaded: true,
    loading: false,
    error: null,
  };
}

export function resolveLessonDetailError(
  prev: LessonDetailState,
  sessionId: number,
  error: string,
): LessonDetailState {
  const sameSession = prev.sessionId === sessionId;
  return {
    sessionId,
    proposals: sameSession ? prev.proposals : [],
    loaded: sameSession ? prev.loaded : false,
    loading: false,
    error,
  };
}

export function hasReliableLessonDetail(
  detail: LessonDetailState,
  selectedSessionId: number | null,
): boolean {
  return Boolean(
    selectedSessionId &&
      detail.sessionId === selectedSessionId &&
      detail.loaded &&
      !detail.loading &&
      !detail.error,
  );
}
