import type { LmsState } from "../../types/lms.ts";
import { syncDueQuizAttempts } from "./quizzes.ts";
import { synchronizeCertificates } from "./certificates.ts";

export function synchronizeMockState(state: LmsState, now: number) {
  return synchronizeCertificates(syncDueQuizAttempts(state, now), now);
}
