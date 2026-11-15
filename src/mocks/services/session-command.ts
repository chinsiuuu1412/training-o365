import type { LmsState, MockSession } from '../../types/lms.ts';
import { execute, type Command } from './management.ts';
import { requireMockSession } from './authentication.ts';

export function executeAuthenticated(state: LmsState, session: MockSession | null, command: Command, now: number) {
  const actor = requireMockSession(state, session);
  return execute(state, actor.id, command, now);
}
