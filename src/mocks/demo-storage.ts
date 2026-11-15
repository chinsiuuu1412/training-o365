import type { LmsState } from '../types/lms.ts';
import { isValidState } from './state.ts';
import { migrateScheduleAttendance } from './services/lessons.ts';
import { migrateEnrollmentCycles } from './services/enrollment-cycles.ts';
export const DEMO_STORE_KEY = 'o365-hust-lms-demo-v2';
export const DEMO_SESSION_KEY = `${DEMO_STORE_KEY}-session`;
export const LEGACY_DEMO_KEY = 'hoc-viet-lms-prompt03-v1';
export interface DemoStore { version: 4; state: LmsState; demoEpoch: number; realEpoch: number; migrationNotice?: string }
export function decodeDemoStore(raw: string): DemoStore {
  try {
    const value = JSON.parse(raw) as Omit<DemoStore, 'version'> & { version: number };
    if (![2, 3, 4].includes(value?.version) || !Number.isFinite(value.demoEpoch) || !Number.isFinite(value.realEpoch) || !isValidState(value.state) || typeof value.state.mockGeneration !== 'string' || !Array.isArray(value.state.mockSessions)) throw new Error();
    const cycles = value.version === 2 ? migrateEnrollmentCycles(value.state) : value.state;
    const state = value.version < 4 ? migrateScheduleAttendance(cycles) : cycles;
    if (!state.enrollmentCycles || state.lessonWorkflowVersion !== 2 || !Array.isArray(state.attendanceOverrides) || !isValidState(state)) throw new Error();
    return { ...value, version: 4, state, ...(value.version < 4 ? { migrationNotice: 'Đã nâng kho demo lên schema 4: giữ tài khoản/phiên/cycle, lịch đã duyệt có hiệu lực không cần confirm; đóng luồng confirm/nghỉ-bù/sửa Attendance cũ, không tự đổi credit. Không khôi phục được record v1 từng bị xóa.' } : {}) };
  } catch { throw new Error('Dữ liệu demo không đúng schema 4 (workflow v2) hoặc bị hỏng. Chọn Khôi phục demo để bắt đầu lại; dữ liệu v1 không bị tự ghi đè.'); }
}
