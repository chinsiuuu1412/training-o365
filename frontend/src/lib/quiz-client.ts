import type { AnswerDto } from "@/types/api";

export class CycleKeyRegistry {
  private keys = new Map<string, string>();

  getOrCreate(
    scope: string,
    enrollmentId: number,
    body: unknown,
    uuidFactory: () => string = () => crypto.randomUUID(),
  ): string {
    const keyId = `${scope}:e=${enrollmentId}:b=${JSON.stringify(body)}`;
    const existing = this.keys.get(keyId);
    if (existing) return existing;
    const next = uuidFactory();
    this.keys.set(keyId, next);
    return next;
  }

  retire(scope: string, enrollmentId: number, body: unknown) {
    const keyId = `${scope}:e=${enrollmentId}:b=${JSON.stringify(body)}`;
    this.keys.delete(keyId);
  }

  clearScope(scope: string) {
    for (const key of this.keys.keys()) {
      if (key.startsWith(`${scope}:`)) {
        this.keys.delete(key);
      }
    }
  }

  clearAll() {
    this.keys.clear();
  }
}

export function quizStartKeyScope(quizId: number, usedAttempts: number): string {
  return `start:${quizId}:used:${usedAttempts}`;
}

export interface BoundedPollOptions {
  maxAttempts?: number;
  intervalMs?: number;
  poll: (attemptIndex: number) => Promise<boolean>;
  onExhausted?: () => void;
  onError?: (err: unknown, attemptIndex: number) => void;
  scheduleFn?: (cb: () => void, ms: number) => ReturnType<typeof setTimeout>;
  cancelFn?: (id: ReturnType<typeof setTimeout>) => void;
}

export function startBoundedPoll({
  maxAttempts = 8,
  intervalMs = 2000,
  poll,
  onExhausted,
  onError,
  scheduleFn = (cb, ms) => globalThis.setTimeout(cb, ms),
  cancelFn = (id) => globalThis.clearTimeout(id),
}: BoundedPollOptions): () => void {
  let cancelled = false;
  let timerId: ReturnType<typeof setTimeout> | null = null;
  let attempts = 0;

  const scheduleNext = () => {
    if (cancelled) return;
    if (attempts >= maxAttempts) {
      onExhausted?.();
      return;
    }
    timerId = scheduleFn(async () => {
      timerId = null;
      if (cancelled) return;
      attempts += 1;
      try {
        const done = await poll(attempts);
        if (cancelled || done) return;
      } catch (err) {
        if (cancelled) return;
        onError?.(err, attempts);
      }
      scheduleNext();
    }, intervalMs);
  };

  scheduleNext();

  return () => {
    cancelled = true;
    if (timerId !== null) {
      cancelFn(timerId);
      timerId = null;
    }
  };
}

export const cycleKeyRegistry = new CycleKeyRegistry();

export function buildAnswersPayload(answersByQuestion: Record<number, number | null>): AnswerDto[] {
  return Object.entries(answersByQuestion)
    .map(([qid, optionId]) => ({ questionId: Number(qid), optionId }))
    .filter((entry): entry is { questionId: number; optionId: number } => Number.isInteger(entry.questionId) && entry.optionId !== null)
    .sort((a, b) => a.questionId - b.questionId)
    .map((entry) => ({ question_id: entry.questionId, option_ids: [entry.optionId] }));
}

export function answersListToMap(answers: AnswerDto[]): Record<number, number | null> {
  const out: Record<number, number | null> = {};
  for (const item of answers) {
    out[item.question_id] = item.option_ids.length > 0 ? item.option_ids[0] : null;
  }
  return out;
}

export function canManualSubmitTest(
  startedAtIso: string,
  durationSeconds: number,
  serverNowMs: number,
): { allowed: boolean; remainingToUnlockMs: number } {
  const startedMs = Date.parse(startedAtIso);
  if (Number.isNaN(startedMs) || durationSeconds <= 0) {
    return { allowed: false, remainingToUnlockMs: 0 };
  }
  const elapsedMs = Math.max(0, serverNowMs - startedMs);
  const requiredMs = (durationSeconds * 1000 * 2) / 3;
  if (elapsedMs * 3 >= durationSeconds * 1000 * 2) {
    return { allowed: true, remainingToUnlockMs: 0 };
  }
  return { allowed: false, remainingToUnlockMs: Math.max(0, Math.ceil(requiredMs - elapsedMs)) };
}

export class SerializedDraftController {
  private savedRevision: number;
  private latestAnswers: Record<number, number> = {};
  private dirty = false;
  private inFlight: Promise<number> | null = null;
  private conflictDetected = false;
  private saveFn: (answers: Record<number, number>, expectedRevision: number) => Promise<number>;

  constructor(
    initialRevision: number,
    saveFn: (answers: Record<number, number>, expectedRevision: number) => Promise<number>,
  ) {
    this.savedRevision = initialRevision;
    this.saveFn = saveFn;
  }

  get revision(): number {
    return this.savedRevision;
  }

  hasPendingChanges(): boolean {
    return this.dirty;
  }

  isInConflict(): boolean {
    return this.conflictDetected;
  }

  reset(serverRevision: number) {
    this.savedRevision = serverRevision;
    this.dirty = false;
    this.conflictDetected = false;
  }

  enqueue(answers: Record<number, number>): Promise<number> {
    this.latestAnswers = { ...answers };
    this.dirty = true;
    return this.flush();
  }

  async flush(): Promise<number> {
    if (this.conflictDetected) {
      throw new Error("draft_revision_conflict_unresolved");
    }
    if (this.inFlight) {
      return this.inFlight;
    }
    if (!this.dirty) {
      return this.savedRevision;
    }

    this.inFlight = (async () => {
      try {
        while (this.dirty && !this.conflictDetected) {
          const snapshot = { ...this.latestAnswers };
          const expectedRevision = this.savedRevision;
          this.dirty = false;
          try {
            const nextRevision = await this.saveFn(snapshot, expectedRevision);
            this.savedRevision = nextRevision;
          } catch (err) {
            this.dirty = true;
            if (
              typeof err === "object" &&
              err !== null &&
              "code" in err &&
              (err as { code?: string }).code === "draft_revision_conflict"
            ) {
              this.conflictDetected = true;
            }
            throw err;
          }
        }
        return this.savedRevision;
      } finally {
        this.inFlight = null;
      }
    })();

    return this.inFlight;
  }
}

export const INCOMPLETE_REASON_LABELS: Record<string, string> = {
  total_sessions_not_set: "Quản lý lớp chưa thiết lập tổng số buổi cố định",
  required_sessions_not_ended: "Chưa kết thúc đủ tất cả buổi học bắt buộc đã duyệt",
  attendance_below_threshold: "Tỷ lệ điểm danh chưa đạt ngưỡng của lớp",
  quiz_below_threshold: "Tỷ lệ bài kiểm tra/bài tập đạt ngưỡng chưa đủ",
};

export function translateIncompleteReason(reason: string): string {
  return INCOMPLETE_REASON_LABELS[reason] ?? reason;
}
