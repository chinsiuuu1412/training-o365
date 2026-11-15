import { validateAccountInput, passwordInput, requiredText } from '../lib/api/accounts.ts';
import { validateClassInput, type Progress } from '../lib/api/classes.ts';
import { enrollmentId } from '../lib/api/dto.ts';
import { validateSessionInput, validateScheduleInput, type Session, type Proposal, type Absence, type Audit } from '../lib/api/sessions.ts';
import { createQuizFixture, finalizeQuizFixture, handleQuizFixture, quizProgress, quizAgenda, activeQuizAgenda, QuizFixtureError, type QuizFixtureState } from './quiz-fixture.ts';
import { createCommunicationsFixture, addAnnouncement, inboxRows, handleInbox, sendManual, handleMaterials, CommunicationsError, type CommunicationsFixture } from './communications-fixture.ts';
export const MANAGEMENT_FIXTURE_KEY = 'o365-approved-v2-management-fixture-v4';
const previousQuizStoreKey = 'o365-approved-v2-management-fixture-v3';
const previousAcademicStoreKey = 'o365-approved-v2-management-fixture-v2';
const previousStoreKey = 'o365-approved-v2-management-fixture-v1';
interface WireAttendance {
    id: number;
    enrollment_id: number;
    session_id: number;
    attended: 0 | 1;
    wrong_count: number;
    overridden: 0 | 1;
    updated_at: string;
}
interface Notice { id: number; recipient_id: number; title: string; created_at: string }
export interface WireUser {
    id: number;
    email: string;
    full_name: string;
    role: 'admin' | 'class_manager' | 'student';
    is_active: boolean;
    student_id: string | null;
    school_or_institute: string | null;
    university_class: string | null;
    phone_number: string | null;
    gender: string | null;
}
interface WireClass {
    id: number;
    code: string;
    name: string;
    description: string;
    manager_id: number;
    capacity: number;
    end_date: string;
    total_sessions: number | null;
    min_attendance_percent: number;
    min_quiz_percent: number;
}
interface WireRequest {
    id: number;
    class_id: number;
    student_id: number;
    reason: string;
    status: 'pending' | 'approved' | 'declined' | 'cancelled';
    decision_reason: string | null;
    decided_by: number | null;
    created_at: string;
    decided_at: string | null;
}
interface WireEnrollment {
    id: number;
    class_id: number;
    student_id: number;
    cycle_number: number;
    request_id: number;
    status: 'enrolled' | 'removed';
    approved_at: string;
    removed_at: string | null;
    removal_reason: string | null;
}
interface FixtureState {
    version: 1 | 2 | 3 | 4;
    now: number;
    clockEpoch: number | null;
    users: WireUser[];
    classes: WireClass[];
    requests: WireRequest[];
    enrollments: WireEnrollment[];
    progress: Record<string, {
        attendance: number;
        quizzes: number;
    }>;
    revisions: Record<string, number>;
    sessions: Session[];
    proposals: Proposal[];
    attendance: WireAttendance[];
    absences: Absence[];
    audits: Audit[];
    notices: Notice[];
    quizData: QuizFixtureState;
    communicationData: CommunicationsFixture;
}
function initial(): FixtureState {
    const users: WireUser[] = [{
            id: 1, email: 'admin@example.test', full_name: 'Nguyễn Minh Anh', role: 'admin' as const
        }, {
            id: 2, email: 'manager1@example.test', full_name: 'Trần Hoàng Nam', role: 'class_manager' as const
        }, {
            id: 3, email: 'manager2@example.test', full_name: 'Lê Thu Hà', role: 'class_manager' as const
        }, ...[5, 6, 7].map((id, i) => ({
            id, email: 'student00' + (i + 1) + '@sis.hust.edu.vn', full_name: ['Nguyễn An', 'Trần Bình', 'Lê Chi'][i], role: 'student' as const
        }))].map(user => ({
        ...user, is_active: true, student_id: user.role === 'student' ? '00012345' + (user.id + 1) : null, school_or_institute: user.role === 'student' ? 'Trường CNTT và Truyền thông' : null, university_class: user.role === 'student' ? 'K71' : null, phone_number: user.role === 'student' ? '0912345678' : null, gender: null
    }));
    const state: FixtureState = {
        version: 4, now: Date.parse('2026-11-15T02:00:00Z'), clockEpoch: typeof window === 'undefined' ? null : Date.now(), quizData: createQuizFixture([], {}), communicationData: createCommunicationsFixture(users.map(user => user.id)), users, classes: [{
                id: 1, code: 'MOS-WORD-01', name: 'Word cơ bản', description: 'Kĩ năng soạn thảo văn bản', manager_id: 2, capacity: 3, end_date: '2026-12-31', total_sessions: 3, min_attendance_percent: 80, min_quiz_percent: 70
            }, {
                id: 2, code: 'MOS-EXCEL-01', name: 'Excel cơ bản', description: 'Thực hành bảng tính', manager_id: 2, capacity: 2, end_date: '2026-12-31', total_sessions: 3, min_attendance_percent: 80, min_quiz_percent: 70
            }, {
                id: 3, code: 'MOS-HISTORY', name: 'Khóa học đã hết hạn', description: 'Dữ liệu lịch sử tổng hợp', manager_id: 3, capacity: 10, end_date: '2026-11-14', total_sessions: 3, min_attendance_percent: 80, min_quiz_percent: 70
            }], requests: [{
                id: 100, class_id: 1, student_id: 5, reason: 'Dữ liệu tổng hợp ban đầu', status: 'approved', decision_reason: '', decided_by: 2, created_at: '2026-11-01T02:00:00Z', decided_at: '2026-11-01T02:00:00Z'
            }, {
                id: 101, class_id: 3, student_id: 5, reason: 'Lần học trước', status: 'approved', decision_reason: '', decided_by: 3, created_at: '2026-11-01T02:00:00Z', decided_at: '2026-11-01T02:00:00Z'
            }], enrollments: [{
                id: 1000, class_id: 1, student_id: 5, cycle_number: 1, request_id: 100, status: 'enrolled', approved_at: '2026-11-01T02:00:00Z', removed_at: null, removal_reason: null
            }, {
                id: 1001, class_id: 3, student_id: 5, cycle_number: 1, request_id: 101, status: 'enrolled', approved_at: '2026-11-01T02:00:00Z', removed_at: null, removal_reason: null
            }], progress: {
            1000: {
                attendance: 1, quizzes: 1
            }, 1001: {
                attendance: 3, quizzes: 1
            }
        }, revisions: {}, ...academicFixture()
    };
    state.quizData = createQuizFixture(state.enrollments, state.progress);
    return state;
}
function storage() {
    return typeof window === 'undefined' ? null : window.localStorage;
}
function academicFixture() {
    const sessions: Session[] = [1, 2, 3].flatMap(classId => {
        const dates = classId === 3 ? ['2026-11-01', '2026-11-06', '2026-11-12'] : ['2026-11-10', '2026-11-20'];
        return dates.map((date, index) => ({
            id: classId * 10 + index, class_id: classId, session_number: index + 1,
            title: 'Buổi ' + (index + 1) + (classId === 2 ? ' · Excel' : ' · Word'), description: 'Buổi học tổng hợp', location: 'Phòng học tổng hợp',
            starts_at: date + 'T02:00:00Z', ends_at: date + 'T04:00:00Z', approved_proposal_id: (classId * 10 + index) * 10,
            attendance_code: (classId === 2 ? 'EXCEL' : 'WORD') + '0' + (index + 1)
        }));
    });
    const proposals: Proposal[] = sessions.map(session => ({
        id: session.approved_proposal_id!, session_id: session.id, proposed_by: session.class_id === 3 ? 3 : 2,
        starts_at: session.starts_at!, ends_at: session.ends_at!, status: 'approved', reason: '', reviewed_by: 1,
        created_at: '2026-10-25T02:00:00Z', reviewed_at: '2026-10-26T02:00:00Z'
    }));
    const attendance: WireAttendance[] = sessions.filter(session => session.class_id === 3 || session.id === 10).map(session => ({
        id: session.id, enrollment_id: session.class_id === 3 ? 1001 : 1000, session_id: session.id,
        attended: 1, wrong_count: 0, overridden: 0, updated_at: session.ends_at!
    }));
    return { sessions, proposals, attendance, absences: [] as Absence[], audits: [] as Audit[], notices: [] as Notice[] };
}
function readStored(fallback: FixtureState): FixtureState {
    const raw = storage()?.getItem(MANAGEMENT_FIXTURE_KEY) ?? storage()?.getItem(previousQuizStoreKey) ?? storage()?.getItem(previousAcademicStoreKey) ?? storage()?.getItem(previousStoreKey);
    if (!raw)
        return fallback;
    const value = JSON.parse(raw) as FixtureState;
    if (![1, 2, 3, 4].includes(value.version) || !Number.isFinite(value.now) || !Array.isArray(value.users) || !Array.isArray(value.classes) || !Array.isArray(value.requests) || !Array.isArray(value.enrollments) || !value.progress || !value.revisions)
        throw new Error('Kho fixture hỏng; khôi phục dữ liệu tổng hợp.');
    if (value.version === 1) {
        const academic = academicFixture();
        academic.attendance = value.enrollments.flatMap(row => academic.sessions.filter(session => session.class_id === row.class_id).slice(0, value.progress[row.id]?.attendance ?? 0).map(session => ({
            id: row.id * 100 + session.id, enrollment_id: row.id, session_id: session.id, attended: 1 as const, wrong_count: 0, overridden: 0 as const, updated_at: session.ends_at!
        })));
        Object.assign(value, { version: 2, ...academic });
    }
    if (![value.sessions, value.proposals, value.attendance, value.absences, value.audits, value.notices].every(Array.isArray)) throw new Error('Kho buổi học hỏng; khôi phục dữ liệu tổng hợp.');
    if (value.version === 2) Object.assign(value, { version: 3, clockEpoch: typeof window === 'undefined' ? null : Date.now(), quizData: createQuizFixture(value.enrollments, value.progress) });
    if (!value.quizData || ![value.quizData.definitions, value.quizData.attempts, value.quizData.grants].every(Array.isArray) || !value.quizData.replays || value.clockEpoch !== null && !Number.isFinite(value.clockEpoch)) throw new Error('Kho Quiz hỏng; khôi phục dữ liệu tổng hợp.');
    if (value.version === 3) Object.assign(value, { version: 4, communicationData: createCommunicationsFixture(value.users.map(user => user.id), value.notices) });
    if (!value.communicationData || ![value.communicationData.announcements, value.communicationData.deliveries, value.communicationData.materials].every(Array.isArray)) throw new Error('Kho Inbox/Library hỏng; khôi phục dữ liệu tổng hợp.');
    if (value.clockEpoch !== null) {
        const realNow = Date.now();
        value.now += Math.max(0, realNow - value.clockEpoch);
        value.clockEpoch = realNow;
    }
    return value;
}
function persist(state: FixtureState) {
    storage()?.setItem(MANAGEMENT_FIXTURE_KEY, JSON.stringify(state));
}
export function resetManagementFixture() {
    persist(initial());
    if (typeof document !== 'undefined')
        document.cookie = 'o365-v2-fixture-user=; Max-Age=0; Path=/; SameSite=Lax';
}
export function fixtureNow() {
    return readStored(initial()).now;
}
async function clockWrite(action: (state: FixtureState) => void) {
    const execute = () => { const state = readStored(initial()); action(state); persist(state); };
    if (typeof navigator !== 'undefined' && navigator.locks) await navigator.locks.request(MANAGEMENT_FIXTURE_KEY, execute);
    else execute();
}
export async function advanceFixtureClock(milliseconds: number) {
    await clockWrite(state => { state.now += milliseconds; });
}
export async function setFixtureClock(timestamp: number) {
    if (!Number.isFinite(timestamp)) throw new Error('Mốc mô phỏng không hợp lệ.');
    await clockWrite(state => { state.now = timestamp; });
}
class DomainError extends Error {
    status: number;
    code: string;
    details: Record<string, unknown> | null;
    constructor(status: number, code: string, message: string, details: Record<string, unknown> | null = null) {
        super(message);
        this.status = status;
        this.code = code;
        this.details = details;
    }
}
function rule(condition: unknown, status: number, code: string, message: string): asserts condition {
    if (!condition)
        throw new DomainError(status, code, message);
}
function endedSessions(course: WireClass, state: FixtureState) {
    return state.sessions.filter(session => session.class_id === course.id && session.approved_proposal_id && session.ends_at && Date.parse(session.ends_at) <= state.now).length;
}
function expires(course: WireClass) {
    return Date.parse(course.end_date + 'T00:00:00+07:00') + 86400000;
}
export function createManagementFixture(onPassword: (id: number, password: string) => void = () => {
}) {
    let memory = readStored(initial());
    if (!storage()?.getItem(MANAGEMENT_FIXTURE_KEY))
        persist(memory);
    const get = () => memory = readStored(memory);
    const save = () => persist(memory);
    const now = () => get().now;
    function progress(row: WireEnrollment, state: FixtureState) {
        const course = state.classes.find(c => c.id === row.class_id)!, quizzes = quizProgress(state.quizData, course.id, row.id), total = course.total_sessions ?? 0, ended = endedSessions(course, state), attended = state.attendance.filter(record => record.enrollment_id === row.id && record.attended && state.sessions.some(session => session.id === record.session_id && session.approved_proposal_id)).length, attendance = total ? attended / total * 100 : 0, quiz = quizzes.published ? quizzes.passed / quizzes.published * 100 : 0;
        return {
            enrollment_id: enrollmentId(row.id), attendance_count: attended, total_sessions: total, attendance_percent: attendance, passed_quiz_count: quizzes.passed, published_quiz_count: quizzes.published, quiz_percent: quiz, ended_sessions: ended, completed: total > 0 && ended === total && attendance >= course.min_attendance_percent && quiz >= course.min_quiz_percent, incomplete_reasons: [...(!total ? ['total_sessions_not_set'] : []), ...(ended !== total ? ['required_sessions_not_ended'] : []), ...(attendance < course.min_attendance_percent ? ['attendance_below_threshold'] : []), ...(quiz < course.min_quiz_percent ? ['quiz_below_threshold'] : [])]
        } satisfies Progress;
    }
    function courseDto(course: WireClass, state: FixtureState) {
        return {
            ...course, expires_at: new Date(expires(course)).toISOString(), is_expired: state.now >= expires(course), manager: state.users.find(user => user.id === course.manager_id), enrolled_count: state.enrollments.filter(row => row.class_id === course.id && row.status === 'enrolled').length, ended_sessions: endedSessions(course, state)
        };
    }
    function summary(course: WireClass) {
        return {
            id: course.id, code: course.code, name: course.name, end_date: course.end_date
        };
    }
    function response(data: unknown, status = 200, state = get()) {
        return Response.json({
            data, error: null
        }, {
            status, headers: {
                Date: new Date(state.now).toUTCString()
            }
        });
    }
    function finalizeQuizzes(state: FixtureState) {
        const due = state.quizData.attempts.filter(row => row.attempt.status === 'in_progress' && state.now >= Date.parse(row.attempt.effective_cutoff_at));
        const changed = finalizeQuizFixture(state.quizData, state.now);
        for (const row of due) addAnnouncement(state.communicationData, [row.attempt.student_id], 'Đã có kết quả Quiz', 'Lượt ' + row.attempt.attempt_number + ' đạt ' + row.attempt.score_percent + '%.', state.now);
        return changed;
    }
    async function handle(actorId: number, url: string, init: RequestInit): Promise<Response> {
        const execute = () => {
            const state = get(), method = init.method ?? 'GET', path = new URL(url, 'https://fixture.invalid').pathname.replace('/api/v1', ''), query = new URL(url, 'https://fixture.invalid').searchParams, body = init.body ? JSON.parse(String(init.body)) as Record<string, unknown> : {};
            if (finalizeQuizzes(state)) save();
            try {
                const actor = state.users.find(user => user.id === actorId);
                rule(actor?.is_active, 401, 'unauthenticated', 'Vui lòng đăng nhập.');
                const parts = path.split('/').filter(Boolean), role = actor.role === 'class_manager' ? 'manager' : actor.role;
                rule(parts[0] === role || parts[0] === 'announcements', 403, 'forbidden', 'Bạn không có quyền thực hiện.');
                const paged = (rows: unknown[]) => {
                    const page = Number(query.get('page') ?? 1), size = Number(query.get('page_size') ?? 20);
                    rule(Number.isSafeInteger(page) && page > 0 && page <= 1000000 && Number.isSafeInteger(size) && size > 0 && size <= 100, 400, 'invalid_request', 'Phân trang không hợp lệ.');
                    return response({
                        items: rows.slice((page - 1) * size, page * size), page, page_size: size, total: rows.length
                    });
                };
                const current = (classId: number, studentId: number) => state.enrollments.find(row => row.class_id === classId && row.student_id === studentId && row.status === 'enrolled');
                const owned = (course: WireClass) => actor.role === 'admin' || actor.role === 'class_manager' && course.manager_id === actor.id;
                const courseFor = (id: number, preview = false) => {
                    const course = state.classes.find(c => c.id === id);
                    rule(course, 404, 'not_found', 'Không tìm thấy lớp.');
                    if (actor.role === 'class_manager')
                        rule(course.manager_id === actor.id, 404, 'not_found', 'Không tìm thấy lớp trong phạm vi.');
                    if (method !== 'GET' || actor.role === 'student')
                        rule(state.now < expires(course), 403, 'class_expired', 'Lớp đã hết hạn.');
                    if (actor.role === 'student' && !preview)
                        rule(current(id, actor.id), 404, 'not_found', 'Bạn không còn enrollment hiện hành.');
                    return course;
                };
                const update = () => save();
                const nextId = (rows: { id: number }[]) => Math.max(0, ...rows.map(row => row.id)) + 1;
                const studentSession = (session: Session) => {
                    const safe = { ...session };
                    delete safe.attendance_code;
                    return safe;
                };
                const notify = (recipients: number[], title: string) => {
                    addAnnouncement(state.communicationData, recipients, title, title, state.now);
                };
                if (parts[0] === 'announcements') {
                    const result = handleInbox(state.communicationData, actor.id, parts, method, query, body);
                    if (method !== 'GET') update();
                    return result.page ? paged(result.page) : response(result.data);
                }
                if (parts[1] === 'recipients' || parts[1] === 'announcements') {
                    rule(actor.role !== 'student', 403, 'forbidden', 'Student chỉ nhận thông báo.');
                    const recipients = state.users.filter(user => user.is_active && (actor.role === 'admin' ? ['student', 'class_manager'].includes(user.role) : user.role === 'student' && state.enrollments.some(row => row.student_id === user.id && row.status === 'enrolled' && state.classes.some(course => course.id === row.class_id && course.manager_id === actor.id && state.now < expires(course))))).sort((a, b) => a.id - b.id);
                    if (parts[1] === 'recipients' && parts.length === 2 && method === 'GET') return paged(recipients);
                    rule(parts[1] === 'announcements' && parts.length === 2 && method === 'POST', 404, 'not_found', 'Không có hộp thư đã gửi hoặc thao tác này.');
                    const receipt = sendManual(state.communicationData, actor.id, recipients.map(user => user.id), body, state.now);
                    update();
                    return response(receipt, 201);
                }
                if (parts[1] === 'schedule-proposals' && method === 'GET') {
                    rule(actor.role === 'admin', 403, 'forbidden', 'Chỉ Admin xem hàng đợi.');
                    return paged(state.proposals.filter(row => row.status === 'pending').sort((a, b) => a.id - b.id).map(row => {
                        const session = state.sessions.find(session => session.id === row.session_id)!;
                        return { ...row, class_id: session.class_id, session_number: session.session_number, title: session.title };
                    }));
                }
                if (parts[1] === 'users') {
                    rule(actor.role === 'admin', 403, 'forbidden', 'Chỉ Admin quản lý tài khoản.');
                    const id = Number(parts[2]), user = state.users.find(user => user.id === id && user.role !== 'admin');
                    if (method === 'GET') {
                        const search = (query.get('search') ?? '').toLowerCase();
                        return paged(state.users.filter(user => user.role !== 'admin' && (!query.get('role') || user.role === query.get('role')) && (!query.has('is_active') || String(user.is_active) === query.get('is_active')) && [user.full_name, user.email, user.student_id ?? ''].join(' ').toLowerCase().includes(search)).sort((a, b) => a.id - b.id));
                    }
                    if (parts[3] === 'status') {
                        rule(user, 404, 'not_found', 'Không thấy tài khoản.');
                        rule(typeof body.is_active === 'boolean', 400, 'invalid_request', 'Trạng thái không hợp lệ.');
                        requiredText(body.reason, 'Lý do', 2000);
                        if (user.is_active !== body.is_active)
                            state.revisions[id] = (state.revisions[id] ?? 1) + 1;
                        user.is_active = body.is_active;
                        update();
                        return response({
                            user
                        });
                    }
                    if (parts[3] === 'reset-password') {
                        rule(user, 404, 'not_found', 'Không thấy tài khoản.');
                        const password = passwordInput(body.new_password);
                        onPassword(id, password);
                        state.revisions[id] = (state.revisions[id] ?? 1) + 1;
                        update();
                        return response({});
                    }
                    rule(method === 'POST' || method === 'PUT', 404, 'not_found', 'Không có thao tác.');
                    if (method === 'PUT')
                        rule(user, 404, 'not_found', 'Không thấy tài khoản.');
                    const input = validateAccountInput({
                        ...body, role: method === 'POST' ? body.role : user!.role
                    }, method === 'POST');
                    rule(!state.users.some(other => other.id !== user?.id && other.email.toLowerCase() === input.email), 409, 'duplicate_email', 'Email đã được sử dụng.');
                    rule(input.student_id === null || !state.users.some(other => other.id !== user?.id && other.role === 'student' && other.student_id === input.student_id), 409, 'duplicate_student_id', 'MSSV đã được sử dụng.');
                    if (user) {
                        if (user.email !== input.email)
                            state.revisions[user.id] = (state.revisions[user.id] ?? 1) + 1;
                        Object.assign(user, input);
                        update();
                        return response({
                            user
                        });
                    }
                    const newUser = {
                        ...input, id: Math.max(...state.users.map(user => user.id)) + 1, is_active: true
                    } as unknown as WireUser;
                    delete (newUser as unknown as Record<string, unknown>).password;
                    state.users.push(newUser);
                    onPassword(newUser.id, String(input.password));
                    update();
                    return response({
                        user: newUser
                    }, 201);
                }
                if (parts[1] === 'dashboard') {
                    const courses = state.classes.filter(course => actor.role === 'student' ? state.enrollments.some(row => row.class_id === course.id && row.student_id === actor.id) : owned(course));
                    const active = courses.filter(course => state.now < expires(course) && (actor.role !== 'student' || current(course.id, actor.id)));
                    const sessions = state.sessions.filter(session => active.some(course => course.id === session.class_id) && session.approved_proposal_id && session.ends_at && Date.parse(session.ends_at) > state.now).sort((a, b) => Date.parse(a.starts_at!) - Date.parse(b.starts_at!)).map(studentSession);
                    return response({
                        classes: courses.map(course => ({
                            class: actor.role === 'student' ? summary(course) : courseDto(course, state), enrollments: state.enrollments.filter(row => row.class_id === course.id && (actor.role !== 'student' || row.student_id === actor.id)).map(enrollment => ({
                                enrollment, progress: progress(enrollment, state)
                            }))
                        })), enrolled_count: state.enrollments.filter(row => row.status === 'enrolled' && courses.some(course => course.id === row.class_id) && (actor.role !== 'student' || row.student_id === actor.id)).length, unread_count: inboxRows(state.communicationData, actor.id).filter(row => row.is_read === 0).length, ...(actor.role === 'admin' ? {
                            student_count: state.users.filter(u => u.role === 'student').length, manager_count: state.users.filter(u => u.role === 'class_manager').length, pending_schedules: state.proposals.filter(row => row.status === 'pending').length
                        } : {}), agenda: {
                            upcoming_sessions: sessions, quizzes: quizAgenda(state.quizData, active.map(course => course.id), classId => current(classId, actor.id)?.id, actor.role === 'student', state.now), active_attempts: actor.role === 'student' ? activeQuizAgenda(state.quizData, actor.id, active.map(course => current(course.id, actor.id)!.id)) : [], pending_enrollment_requests: actor.role === 'student' ? 0 : state.requests.filter(r => r.status === 'pending' && active.some(c => c.id === r.class_id)).length
                        }
                    });
                }
                if (parts[1] === 'enrollment-history' && method === 'GET')
                    return paged(state.enrollments.filter(row => row.student_id === actor.id).sort((a, b) => b.id - a.id).map(enrollment => ({
                        enrollment, class: summary(state.classes.find(c => c.id === enrollment.class_id)!), progress: progress(enrollment, state)
                    })));
                if (parts[1] === 'enrollment-requests' && method === 'GET')
                    return paged(state.requests.filter(row => row.student_id === actor.id).sort((a, b) => b.id - a.id));
                const discover = parts[1] === 'discover', classIndex = discover ? 2 : 1;
                rule(parts[classIndex] === 'classes', 404, 'not_found', 'Fixture chưa có endpoint này.');
                const id = Number(parts[classIndex + 1]);
                if (!id && method === 'GET') {
                    const search = (query.get('search') ?? '').toLowerCase();
                    return paged(state.classes.filter(course => (actor.role !== 'class_manager' || owned(course)) && (actor.role !== 'student' || state.now < expires(course) && (discover || current(course.id, actor.id))) && [course.name, course.code, state.users.find(u => u.id === course.manager_id)?.full_name].join(' ').toLowerCase().includes(search)).map(course => ({
                        ...courseDto(course, state), ...(discover ? {
                            is_enrolled: !!current(course.id, actor.id)
                        } : {})
                    })));
                }
                if (actor.role === 'admin' && ((!id && method === 'POST') || (id && method === 'PUT' && parts.length === 3))) {
                    const existing = id ? courseFor(id) : undefined, input = validateClassInput(body);
                    if (existing)
                        rule(Number(input.capacity) >= state.enrollments.filter(row => row.class_id === id && row.status === 'enrolled').length, 409, 'capacity_below_enrolled', 'Sĩ số thấp hơn số đã ghi danh.');
                    rule(!state.classes.some(c => c.id !== id && c.code.toLowerCase() === String(input.code).toLowerCase()), 409, 'duplicate_code', 'Mã lớp đã được sử dụng.');
                    const manager = state.users.find(u => u.id === input.manager_id && u.role === 'class_manager');
                    rule(manager && (manager.is_active || existing?.manager_id === manager.id), 400, 'invalid_request', 'Manager không hoạt động.');
                    if (existing && existing.manager_id !== input.manager_id)
                        rule(input.confirm_reassignment === true && !!input.reassignment_reason, 400, 'invalid_request', 'Đổi Manager cần lý do và xác nhận.');
                    if (existing) {
                        Object.assign(existing, input);
                        update();
                        return response({
                            class: courseDto(existing, state)
                        });
                    }
                    const course = {
                        ...input, id: Math.max(...state.classes.map(c => c.id)) + 1, total_sessions: null
                    } as unknown as WireClass;
                    state.classes.push(course);
                    update();
                    return response({
                        class: courseDto(course, state)
                    }, 201);
                }
                const action = parts[3], preview = actor.role === 'student' && (action === 'preview' || action === 'enrollment-requests'), course = courseFor(id, preview);
                if (action === 'materials') {
                    const result = handleMaterials(state.communicationData, { actor, classId: id, managerId: course.manager_id, classExpires: new Date(expires(course)).toISOString(), sessionIds: state.sessions.filter(row => row.class_id === id).map(row => row.id), now: state.now, parts, method, query, body, audit: (material, before, reason) => state.audits.push({ id: nextId(state.audits), actor_id: actor.id, class_id: id, action: 'material_delete', target_id: material.id, before_json: JSON.stringify(before), after_json: JSON.stringify(material), reason, created_at: new Date(state.now).toISOString() }) });
                    if (method !== 'GET') update();
                    return result.page ? paged(result.page) : response(result.data, result.status);
                }
                if (action === 'quizzes' || action === 'quiz-attempts') {
                    const result = handleQuizFixture(state.quizData, { actor, classId: id, now: state.now, method, parts, body, headers: new Headers(init.headers), enrollments: state.enrollments, activeStudentIds: state.users.filter(user => user.role === 'student' && user.is_active).map(user => user.id), adminIds: state.users.filter(user => user.role === 'admin' && user.is_active).map(user => user.id), notify });
                    if (method !== 'GET') update();
                    return result.page ? paged(result.page) : response(result.data, result.status);
                }
                if (action === 'progress' && method === 'GET') {
                    rule(actor.role !== 'student', 403, 'forbidden', 'Progress Student lấy từ dashboard hoặc lịch sử.');
                    return paged(state.enrollments.filter(row => row.class_id === id).sort((a, b) => a.id - b.id).map(enrollment => ({ enrollment, progress: progress(enrollment, state) })));
                }
                if (parts.length === 3 && method === 'GET')
                    return response({
                        class: courseDto(course, state)
                    });
                if (action === 'preview' && method === 'GET')
                    return response({
                        class: courseDto(course, state), upcoming_sessions: state.sessions.filter(row => row.class_id === id && row.approved_proposal_id && row.ends_at && Date.parse(row.ends_at) > state.now).map(row => ({ id: row.id, session_number: row.session_number, title: row.title, starts_at: row.starts_at, ends_at: row.ends_at }))
                    });
                if (action === 'sessions') {
                    if (parts.length === 4 && method === 'GET') return paged(state.sessions.filter(row => row.class_id === id && (actor.role !== 'student' || row.approved_proposal_id)).sort((a, b) => a.session_number - b.session_number).map(row => actor.role === 'student' ? studentSession(row) : row));
                    if (parts.length === 4 && method === 'POST') {
                        rule(actor.role === 'class_manager', 403, 'forbidden', 'Chỉ Manager tạo buổi học.');
                        const input = validateSessionInput(body);
                        rule(course.total_sessions && input.session_number <= course.total_sessions, 400, 'invalid_request', 'Thiết lập tổng số buổi và chọn số buổi trong giới hạn.');
                        rule(!state.sessions.some(row => row.class_id === id && row.session_number === input.session_number), 409, 'session_exists', 'Buổi học đã tồn tại.');
                        const session: Session = { id: nextId(state.sessions), class_id: id, ...input, starts_at: null, ends_at: null, approved_proposal_id: null };
                        state.sessions.push(session);
                        update();
                        return response({ session }, 201);
                    }
                    const session = state.sessions.find(row => row.class_id === id && row.id === Number(parts[4]));
                    rule(session && (actor.role !== 'student' || session.approved_proposal_id), 404, 'not_found', 'Không tìm thấy buổi đã duyệt trong phạm vi.');
                    const proposals = state.proposals.filter(row => row.session_id === session.id).sort((a, b) => b.id - a.id);
                    if (parts.length === 5 && method === 'GET') return response(actor.role === 'student' ? { session: studentSession(session) } : { session, proposals });
                    if (parts[5] === 'schedule-draft' || parts[5] === 'schedule-proposals') {
                        const review = parts[7] === 'review';
                        rule(review ? actor.role === 'admin' : actor.role === 'class_manager', 403, 'forbidden', 'Không có quyền thay đổi lịch.');
                        rule(!session.approved_proposal_id || state.now < Date.parse(session.starts_at!), 409, 'session_started', 'Buổi đang có hiệu lực đã bắt đầu, không đổi lịch.');
                        if (parts[5] === 'schedule-draft' && method === 'PUT') {
                            rule(!proposals.some(row => row.status === 'pending'), 409, 'schedule_pending', 'Đang có đề xuất chờ duyệt.');
                            const input = validateScheduleInput(body);
                            rule(Date.parse(input.starts_at) > state.now, 409, 'schedule_in_past', 'Giờ bắt đầu phải ở tương lai.');
                            let proposal = proposals.find(row => row.status === 'draft');
                            if (proposal) Object.assign(proposal, input, { proposed_by: actor.id });
                            else {
                                proposal = { id: nextId(state.proposals), session_id: session.id, proposed_by: actor.id, ...input, status: 'draft', reason: null, reviewed_by: null, created_at: new Date(state.now).toISOString(), reviewed_at: null };
                                state.proposals.push(proposal);
                            }
                            update();
                            return response({ proposal });
                        }
                        const proposal = proposals.find(row => row.id === Number(parts[6]));
                        rule(proposal, 404, 'not_found', 'Không tìm thấy đề xuất.');
                        if (!review && parts[7] === 'submit' && method === 'POST') {
                            rule(proposal.status === 'draft', 409, 'proposal_processed', 'Chỉ gửi bản nháp chưa gửi.');
                            rule(Date.parse(proposal.starts_at) > state.now, 409, 'schedule_in_past', 'Đề xuất đã qua giờ bắt đầu.');
                            proposal.status = 'pending';
                            notify(state.users.filter(user => user.role === 'admin' && user.is_active).map(user => user.id), 'Có đề xuất lịch cần duyệt');
                        } else if (review && method === 'POST') {
                            rule(proposal.status === 'pending', 409, 'proposal_processed', 'Đề xuất đã được xử lý.');
                            rule(body.decision === 'approve' || body.decision === 'reject', 400, 'invalid_request', 'Quyết định không hợp lệ.');
                            if (body.decision === 'approve') {
                                rule(Date.parse(proposal.starts_at) > state.now, 409, 'schedule_in_past', 'Lịch duyệt phải ở tương lai.');
                                session.starts_at = proposal.starts_at;
                                session.ends_at = proposal.ends_at;
                                session.approved_proposal_id = proposal.id;
                                proposal.reason = '';
                            } else proposal.reason = requiredText(body.reason, 'Lý do từ chối', 2000);
                            proposal.status = body.decision === 'approve' ? 'approved' : 'rejected';
                            proposal.reviewed_by = actor.id;
                            proposal.reviewed_at = new Date(state.now).toISOString();
                            notify([course.manager_id, ...(body.decision === 'approve' ? state.enrollments.filter(row => row.class_id === id && row.status === 'enrolled').map(row => row.student_id) : [])], body.decision === 'approve' ? 'Lịch học đã được duyệt' : 'Đề xuất lịch bị từ chối');
                        } else throw new DomainError(404, 'not_found', 'Không có thao tác lịch này.');
                        update();
                        return response(review ? { session, proposal } : { proposal });
                    }
                    const iso = new Date(state.now).toISOString();
                    if (parts[5] === 'attend' || parts[5] === 'absence') {
                        rule(actor.role === 'student', 403, 'forbidden', 'Chỉ Student gửi điểm danh hoặc xin nghỉ.');
                        const enrollment = current(id, actor.id);
                        rule(enrollment && body.enrollment_id === enrollment.id, 409, 'stale_enrollment', 'Lần ghi danh đã thay đổi, tải lại lớp.');
                        rule(method === 'POST', 404, 'not_found', 'Không có thao tác này.');
                        const recorded = state.attendance.find(row => row.enrollment_id === enrollment.id && row.session_id === session.id);
                        if (parts[5] === 'absence') {
                            rule(state.now < Date.parse(session.ends_at!), 409, 'session_ended', 'Buổi học đã kết thúc.');
                            rule(!recorded?.attended, 409, 'already_attended', 'Đã điểm danh, không gửi xin nghỉ.');
                            rule(!state.absences.some(row => row.enrollment_id === enrollment.id && row.session_id === session.id), 409, 'absence_exists', 'Đã có đơn nghỉ được tự duyệt.');
                            const absence: Absence = { id: nextId(state.absences), enrollment_id: enrollmentId(enrollment.id), session_id: session.id, reason: requiredText(body.reason, 'Lý do', 2000), created_at: iso };
                            state.absences.push(absence);
                            notify([course.manager_id], 'Student xin nghỉ buổi ' + session.session_number + ' · ' + absence.reason);
                            update();
                            return response({ absence, status: 'approved' }, 201);
                        }
                        rule(state.now >= Date.parse(session.starts_at!) && state.now < Date.parse(session.ends_at!), 409, 'attendance_closed', 'Ngoài thời gian điểm danh.');
                        if (recorded?.overridden) return response({ attendance: recorded, authoritative_override: true });
                        if (recorded?.attended) return response({ attendance: recorded });
                        rule((recorded?.wrong_count ?? 0) < 3, 409, 'attendance_locked', 'Đã sai mã ba lần, liên hệ Manager.');
                        rule(typeof body.code === 'string', 400, 'invalid_request', 'Mã phải là chuỗi.');
                        const attendance: WireAttendance = recorded ?? { id: nextId(state.attendance), enrollment_id: enrollment.id, session_id: session.id, attended: 0, wrong_count: 0, overridden: 0, updated_at: iso };
                        if (!recorded) state.attendance.push(attendance);
                        attendance.updated_at = iso;
                        if (body.code !== session.attendance_code) {
                            attendance.wrong_count++;
                            update();
                            throw new DomainError(422, 'wrong_attendance_code', 'Mã điểm danh không đúng.', { remaining_attempts: 3 - attendance.wrong_count });
                        }
                        attendance.attended = 1;
                        update();
                        return response({ attendance });
                    }
                    if (parts[5] === 'attendance' && parts[7] === 'override' && method === 'POST') {
                        rule(actor.role === 'class_manager', 403, 'forbidden', 'Chỉ Manager được override Attendance, Admin chỉ xem.');
                        rule(session.approved_proposal_id, 409, 'session_not_approved', 'Buổi chưa được duyệt.');
                        rule(state.now >= Date.parse(session.starts_at!), 409, 'session_not_started', 'Chưa đến giờ bắt đầu.');
                        const enrollment = state.enrollments.find(row => row.id === Number(parts[6]) && row.class_id === id && row.status === 'enrolled');
                        rule(enrollment, 409, 'stale_enrollment', 'Lần ghi danh không hiện hành.');
                        rule(typeof body.attended === 'boolean', 400, 'invalid_request', 'Giá trị Attendance phải là boolean.');
                        const reason = requiredText(body.reason, 'Lý do', 2000);
                        let attendance = state.attendance.find(row => row.enrollment_id === enrollment.id && row.session_id === session.id);
                        const snapshot = (row?: WireAttendance) => JSON.stringify({ attended: !!row?.attended, overridden: !!row?.overridden });
                        const before_json = snapshot(attendance);
                        if (!attendance) {
                            attendance = { id: nextId(state.attendance), enrollment_id: enrollment.id, session_id: session.id, attended: 0, wrong_count: 0, overridden: 0, updated_at: iso };
                            state.attendance.push(attendance);
                        }
                        attendance.attended = body.attended ? 1 : 0;
                        attendance.overridden = 1;
                        attendance.updated_at = iso;
                        state.audits.push({ id: nextId(state.audits), actor_id: actor.id, class_id: id, action: 'attendance_override', target_id: attendance.id, before_json, after_json: snapshot(attendance), reason, created_at: iso });
                        update();
                        return response({ attendance });
                    }
                    throw new DomainError(404, 'not_found', 'Không có thao tác buổi học này.');
                }
                if (action === 'attendance' && method === 'GET') {
                    return paged(state.attendance.filter(row => state.sessions.some(session => session.id === row.session_id && session.class_id === id) && (actor.role !== 'student' || row.enrollment_id === current(id, actor.id)?.id)).sort((a, b) => a.id - b.id).map(row => {
                        const enrollment = state.enrollments.find(enrollment => enrollment.id === row.enrollment_id)!;
                        return { ...row, student_id: enrollment.student_id, cycle_number: enrollment.cycle_number, enrollment_status: enrollment.status };
                    }));
                }
                if ((action === 'absences' || action === 'audit') && method === 'GET') {
                    rule(actor.role !== 'student', 403, 'forbidden', 'Student không có quyền xem danh sách này.');
                    return action === 'audit' ? paged(state.audits.filter(row => row.class_id === id).sort((a, b) => b.id - a.id)) : paged(state.absences.filter(row => state.sessions.some(session => session.id === row.session_id && session.class_id === id)).sort((a, b) => b.id - a.id).map(row => ({ ...row, student_id: state.enrollments.find(enrollment => enrollment.id === row.enrollment_id)!.student_id })));
                }
                if (action === 'total-sessions' && method === 'PUT') {
                    rule(actor.role === 'class_manager', 403, 'forbidden', 'Chỉ Manager thiết lập buổi.');
                    rule(course.total_sessions === null, 409, 'total_sessions_fixed', 'Số buổi đã cố định.');
                    rule(Number.isSafeInteger(body.total_sessions) && Number(body.total_sessions) > 0 && Number(body.total_sessions) <= 10000, 400, 'invalid_request', 'Tổng số buổi không hợp lệ.');
                    course.total_sessions = Number(body.total_sessions);
                    update();
                    return response({
                        class: courseDto(course, state)
                    });
                }
                if (action === 'enrollments') {
                    rule(actor.role !== 'student', 403, 'forbidden', 'Không có quyền roster.');
                    if (method === 'GET')
                        return paged(state.enrollments.filter(row => row.class_id === id).sort((a, b) => b.id - a.id).map(row => ({
                            ...row, student: state.users.find(u => u.id === row.student_id), progress: progress(row, state)
                        })));
                    const enrollment = state.enrollments.find(row => row.id === Number(parts[4]) && row.class_id === id);
                    rule(enrollment?.status === 'enrolled', 409, 'stale_enrollment', 'Lần ghi danh không còn hiện hành.');
                    requiredText(body.reason, 'Lý do', 2000);
                    enrollment.status = 'removed';
                    enrollment.removed_at = new Date(state.now).toISOString();
                    enrollment.removal_reason = String(body.reason).trim();
                    update();
                    return response({});
                }
                if (action === 'enrollment-requests') {
                    if (method === 'GET') {
                        rule(actor.role !== 'student', 403, 'forbidden', 'Không có quyền xem.');
                        return paged(state.requests.filter(row => row.class_id === id).sort((a, b) => b.id - a.id).map(row => ({
                            ...row, full_name: state.users.find(u => u.id === row.student_id)!.full_name, student_number: state.users.find(u => u.id === row.student_id)!.student_id
                        })));
                    }
                    const iso = new Date(state.now).toISOString();
                    if (parts.length === 4) {
                        rule(actor.role === 'student', 403, 'forbidden', 'Chỉ Student gửi yêu cầu.');
                        rule(!current(id, actor.id), 409, 'already_enrolled', 'Bạn đã ghi danh.');
                        const rows = state.requests.filter(r => r.class_id === id && r.student_id === actor.id);
                        rule(!rows.some(r => r.status === 'pending'), 409, 'request_pending', 'Đã có yêu cầu chờ.');
                        const declined = rows.filter(r => r.status === 'declined').sort((a, b) => b.id - a.id);
                        rule(declined.length < 3, 409, 'decline_limit', 'Đã bị từ chối ba lần.');
                        const last = declined[0];
                        rule(!last || state.now >= Date.parse(last.decided_at!) + 600000, 409, 'decline_cooldown', 'Chưa đủ 10 phút từ lần từ chối.');
                        const reason = requiredText(body.reason, 'Lý do', 2000);
                        rule(!last || reason !== last.reason, 422, 'new_reason_required', 'Cần lý do tham gia mới.');
                        rule(courseDto(course, state).enrolled_count < course.capacity, 409, 'class_full', 'Lớp đã đủ sĩ số.');
                        const request: WireRequest = {
                            id: Math.max(99, ...state.requests.map(r => r.id)) + 1, class_id: id, student_id: actor.id, reason, status: 'pending', decision_reason: null, decided_by: null, created_at: iso, decided_at: null
                        };
                        state.requests.push(request);
                        update();
                        return response({
                            request
                        }, 201);
                    }
                    const request = state.requests.find(row => row.id === Number(parts[4]) && row.class_id === id);
                    if (parts[5] === 'cancel')
                        rule(actor.role === 'student' && request?.student_id === actor.id, 404, 'not_found', 'Không thấy yêu cầu của bạn.');
                    rule(request?.status === 'pending', 409, 'request_processed', 'Yêu cầu không còn chờ.');
                    if (parts[5] === 'cancel') {
                        rule(actor.role === 'student' && request.student_id === actor.id, 404, 'not_found', 'Không thấy yêu cầu của bạn.');
                        request.status = 'cancelled';
                        request.decided_at = iso;
                        update();
                        return response({});
                    }
                    rule(actor.role === 'class_manager', 403, 'forbidden', 'Chỉ Manager hiện tại phê duyệt.');
                    rule(['approve', 'decline'].includes(String(body.decision)), 400, 'invalid_request', 'Quyết định không hợp lệ.');
                    const student = state.users.find(u => u.id === request.student_id);
                    rule(student?.is_active, 409, 'student_inactive', 'Student không hoạt động.');
                    if (body.decision === 'approve') {
                        rule(!current(id, request.student_id), 409, 'already_enrolled', 'Đã ghi danh.');
                        rule(courseDto(course, state).enrolled_count < course.capacity, 409, 'class_full', 'Lớp đã đủ sĩ số.');
                        const enrollment: WireEnrollment = {
                            id: Math.max(999, ...state.enrollments.map(r => r.id)) + 1, class_id: id, student_id: request.student_id, cycle_number: Math.max(0, ...state.enrollments.filter(row => row.class_id === id && row.student_id === request.student_id).map(row => row.cycle_number)) + 1, request_id: request.id, status: 'enrolled', approved_at: iso, removed_at: null, removal_reason: null
                        };
                        state.enrollments.push(enrollment);
                        state.progress[enrollment.id] = {
                            attendance: 0, quizzes: 0
                        };
                        request.status = 'approved';
                        request.decision_reason = '';
                    }
                    else {
                        request.decision_reason = requiredText(body.reason, 'Lý do từ chối', 2000);
                        request.status = 'declined';
                    }
                    request.decided_by = actor.id;
                    request.decided_at = iso;
                    notify([request.student_id], request.status === 'approved' ? 'Yêu cầu ghi danh đã được duyệt' : 'Yêu cầu ghi danh bị từ chối · ' + request.decision_reason);
                    update();
                    return response({
                        request
                    });
                }
                throw new DomainError(404, 'not_found', 'Fixture chưa có endpoint này.');
            }
            catch (error) {
                const domain = error instanceof DomainError ? error : error instanceof QuizFixtureError || error instanceof CommunicationsError ? new DomainError(error.status, error.code, error.message) : new DomainError(400, 'invalid_request', error instanceof Error ? error.message : 'Dữ liệu không hợp lệ.');
                return Response.json({
                    data: null, error: {
                        code: domain.code, message: domain.message, details: domain.details
                    }
                }, {
                    status: domain.status
                });
            }
        };
        if (typeof navigator !== 'undefined' && navigator.locks)
            return navigator.locks.request(MANAGEMENT_FIXTURE_KEY, execute);
        return execute();
    }
    return {
        handle, synchronize: async () => {
            const execute = () => { const state = get(); if (finalizeQuizzes(state)) save(); };
            if (typeof navigator !== 'undefined' && navigator.locks) await navigator.locks.request(MANAGEMENT_FIXTURE_KEY, execute);
            else execute();
        }, users: () => get().users, revision: (id: number) => get().revisions[id] ?? 1, changePassword: (id: number, password: string) => {
            const state = get();
            onPassword(id, password);
            state.revisions[id] = (state.revisions[id] ?? 1) + 1;
            save();
        }, now, advanceTime: (milliseconds: number) => {
            get().now += milliseconds;
            save();
        }, setTime: (time: number) => {
            get().now = time;
            save();
        }
    };
}
