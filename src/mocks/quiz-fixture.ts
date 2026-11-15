import { validateQuizInput, answersFromDto, timestamp, type ApiQuiz, type QuizQuestion, type Attempt, type Answer, type QuizInput } from '../lib/api/quizzes.ts';
import { requiredText } from '../lib/api/accounts.ts';
import { positiveId, enrollmentId, count, object } from '../lib/api/dto.ts';

interface Definition { quiz: ApiQuiz; questions: QuizQuestion[] }
interface SavedAttempt { attempt: Attempt; answers: Answer[] }
interface Grant { quiz_id: number; enrollment_id: number; extra_attempts: number; deadline: string; reason: string }
interface Replay { enrollment_id: number; fingerprint: string; attempt_id: number }
export interface QuizFixtureState { definitions: Definition[]; attempts: SavedAttempt[]; grants: Grant[]; replays: Record<string, Replay> }
interface EnrollmentRow { id: number; student_id: number; class_id: number; status: string }
export class QuizFixtureError extends Error {
    status: number;
    code: string;
    constructor(status: number, code: string, message: string) { super(message); this.status = status; this.code = code; }
}
function rule(condition: unknown, status: number, code: string, message: string): asserts condition {
    if (!condition) throw new QuizFixtureError(status, code, message);
}
function assignQuestions(input: QuizInput['questions'], startId: number) {
    let id = startId;
    return input.map((question, index) => ({
        id: id++, question_text: question.question_text, sort_order: index, question_type: 'single_choice' as const, points: 1 as const,
        options: question.options.map((option, order) => ({ id: id++, ...option, sort_order: order }))
    }));
}
export function createQuizFixture(enrollments: EnrollmentRow[], progress: Record<string, { quizzes: number }>): QuizFixtureState {
    const definitions = [1, 2, 3].map(classId => ({
        quiz: { id: classId * 100, class_id: classId, title: 'Bài luyện tập ' + (classId === 2 ? 'Excel' : 'Word'), description: 'Dữ liệu tổng hợp · Single choice', quiz_type: 'assignment' as const,
            duration_seconds: 600, open_at: '2026-11-01T00:00:00Z', deadline: '2026-12-01T10:00:00Z', pass_score: 70, attempt_limit: 10, is_published: true,
            created_at: '2026-11-01T00:00:00Z', updated_at: '2026-11-01T00:00:00Z' },
        questions: assignQuestions([
            { question_text: 'Phím tắt lưu tài liệu?', options: [{ option_text: 'Ctrl + S', is_correct: true }, { option_text: 'Ctrl + P', is_correct: false }] },
            { question_text: 'Thao tác sao chép?', options: [{ option_text: 'Ctrl + C', is_correct: true }, { option_text: 'Ctrl + X', is_correct: false }] }
        ], classId * 1000)
    }));
    const attempts = enrollments.filter(row => (progress[row.id]?.quizzes ?? 0) > 0 && row.class_id <= 3).map((row, index) => {
        const definition = definitions.find(def => def.quiz.class_id === row.class_id)!;
        return {
            attempt: { id: 5000 + index, quiz_id: definition.quiz.id, student_id: row.student_id, enrollment_id: enrollmentId(row.id), attempt_number: 1, status: 'submitted' as const,
                started_at: '2026-11-02T02:00:00Z', effective_deadline: definition.quiz.deadline, effective_cutoff_at: '2026-11-02T02:10:00Z', submitted_at: '2026-11-02T02:10:00Z', time_spent_seconds: 600,
                score: 2, max_score: 2, score_percent: 100, is_passed: true, draft_revision: 1 },
            answers: definition.questions.map(question => ({ question_id: question.id, option_ids: [question.options[0].id] }))
        };
    });
    return { definitions, attempts, grants: [], replays: {} };
}
function grade(record: SavedAttempt, definition: Definition, at: number) {
    const correct = definition.questions.filter(question => {
        const answer = record.answers.find(answer => answer.question_id === question.id);
        return answer?.option_ids.length === 1 && question.options.some(option => option.id === answer.option_ids[0] && option.is_correct);
    }).length;
    Object.assign(record.attempt, { status: 'submitted', submitted_at: new Date(at).toISOString(), time_spent_seconds: Math.floor((at - Date.parse(record.attempt.started_at)) / 1000),
        score: correct, max_score: definition.questions.length, score_percent: correct / definition.questions.length * 100, is_passed: correct / definition.questions.length * 100 >= definition.quiz.pass_score });
}
export function finalizeQuizFixture(state: QuizFixtureState, now: number) {
    let changed = false;
    for (const record of state.attempts) {
        if (record.attempt.status === 'in_progress' && now >= Date.parse(record.attempt.effective_cutoff_at)) {
            grade(record, state.definitions.find(def => def.quiz.id === record.attempt.quiz_id)!, Date.parse(record.attempt.effective_cutoff_at));
            changed = true;
        }
    }
    return changed;
}
export function quizAllowance(state: QuizFixtureState, quiz: ApiQuiz, cycle: number) {
    const grants = state.grants.filter(grant => grant.quiz_id === quiz.id && grant.enrollment_id === cycle);
    const attempts = state.attempts.filter(record => record.attempt.quiz_id === quiz.id && record.attempt.enrollment_id === cycle);
    const scores = attempts.filter(record => record.attempt.status === 'submitted').map(record => record.attempt.score_percent!);
    const best = scores.length ? Math.max(...scores) : null;
    return { effective_deadline: new Date(Math.max(Date.parse(quiz.deadline), ...grants.map(grant => Date.parse(grant.deadline)))).toISOString(),
        allowed_attempts: quiz.attempt_limit + grants.reduce((sum, grant) => sum + grant.extra_attempts, 0), used_attempts: attempts.length,
        best_score_percent: best, is_passed: best !== null && best >= quiz.pass_score };
}
export function quizProgress(state: QuizFixtureState, classId: number, cycle: number) {
    const published = state.definitions.filter(def => def.quiz.class_id === classId && def.quiz.is_published);
    return { published: published.length, passed: published.filter(def => quizAllowance(state, def.quiz, cycle).is_passed).length };
}
function runner(state: QuizFixtureState, record: SavedAttempt) {
    const result = { attempt: { ...record.attempt }, answers: record.answers.map(answer => ({ ...answer, option_ids: [...answer.option_ids] })), review: null };
    if (record.attempt.status === 'submitted') return result;
    const definition = state.definitions.find(def => def.quiz.id === record.attempt.quiz_id)!;
    return { ...result, quiz: { ...definition.quiz }, questions: definition.questions.map(question => ({ ...question, options: question.options.map(option => ({ id: option.id, option_text: option.option_text, sort_order: option.sort_order })) })) };
}
export function quizAgenda(state: QuizFixtureState, classIds: number[], cycleFor: (classId: number) => number | undefined, student: boolean, now: number) {
    return state.definitions.filter(def => def.quiz.is_published && classIds.includes(def.quiz.class_id)).map(def => ({ ...def.quiz, ...(student ? quizAllowance(state, def.quiz, cycleFor(def.quiz.class_id)!) : {}) })).filter(quiz => Date.parse('effective_deadline' in quiz ? String(quiz.effective_deadline) : quiz.deadline) > now).sort((a, b) => Date.parse('effective_deadline' in a ? String(a.effective_deadline) : a.deadline) - Date.parse('effective_deadline' in b ? String(b.effective_deadline) : b.deadline));
}
export function activeQuizAgenda(state: QuizFixtureState, studentId: number, cycles: number[]) {
    return state.attempts.filter(record => record.attempt.student_id === studentId && record.attempt.status === 'in_progress' && cycles.includes(record.attempt.enrollment_id)).map(record => ({ attempt: record.attempt, quiz: state.definitions.find(def => def.quiz.id === record.attempt.quiz_id)!.quiz }));
}
interface Context {
    actor: { id: number; role: string }; classId: number; now: number; method: string; parts: string[];
    body: Record<string, unknown>; headers: Headers; enrollments: EnrollmentRow[]; activeStudentIds: number[]; adminIds: number[];
    notify: (recipients: number[], title: string) => void;
}
export function handleQuizFixture(state: QuizFixtureState, ctx: Context): { data: unknown; status?: number; page?: unknown[] } {
    const { actor, classId, now, method, parts, body } = ctx, student = actor.role === 'student', manager = actor.role === 'class_manager';
    const definitions = state.definitions.filter(def => def.quiz.class_id === classId);
    const current = ctx.enrollments.find(row => row.class_id === classId && row.student_id === actor.id && row.status === 'enrolled');
    const staff = () => rule(!student, 403, 'forbidden', 'Student không xem định nghĩa giảng dạy.');
    const managerOnly = () => rule(manager, 403, 'forbidden', 'Chỉ Manager hiện tại được quản lý Quiz.');
    const findQuiz = (id: number) => {
        const definition = definitions.find(def => def.quiz.id === id);
        rule(definition && (!student || definition.quiz.is_published), 404, 'not_found', 'Không tìm thấy Quiz trong phạm vi.');
        return definition;
    };
    const iso = new Date(now).toISOString();
    if (parts[3] === 'quizzes' && parts.length === 4) {
        if (method === 'GET') return { data: null, page: definitions.filter(def => !student || def.quiz.is_published).sort((a, b) => a.quiz.id - b.quiz.id).map(def => ({ ...def.quiz, ...(student ? quizAllowance(state, def.quiz, current!.id) : {}) })) };
        managerOnly();
        rule(method === 'POST', 404, 'not_found', 'Không có thao tác này.');
        const input = validateQuizInput(body);
        const quiz: ApiQuiz = { ...input, id: Math.max(0, ...state.definitions.map(def => def.quiz.id)) + 1, class_id: classId, is_published: false, created_at: iso, updated_at: iso };
        delete (quiz as unknown as Record<string, unknown>).questions;
        const questions = assignQuestions(input.questions, Math.max(0, ...state.definitions.flatMap(def => def.questions.flatMap(question => [question.id, ...question.options.map(option => option.id)]))) + 1);
        state.definitions.push({ quiz, questions });
        return { data: { quiz, questions }, status: 201 };
    }
    if (parts[3] === 'quiz-attempts') {
        rule(student, 403, 'forbidden', 'Đường dẫn bài làm dành cho Student.');
        const record = state.attempts.find(record => record.attempt.id === Number(parts[4]) && record.attempt.student_id === actor.id && record.attempt.enrollment_id === current?.id && definitions.some(def => def.quiz.id === record.attempt.quiz_id));
        rule(record, 404, 'not_found', 'Không có bài làm trong lần ghi danh hiện tại.');
        if (method === 'GET' && parts.length === 5) return { data: runner(state, record) };
        rule(body.enrollment_id === current!.id, 409, 'stale_enrollment', 'Lần ghi danh đã thay đổi.');
        const definition = findQuiz(record.attempt.quiz_id);
        if (parts[5] === 'draft' && method === 'PUT') {
            rule(now < Date.parse(record.attempt.effective_cutoff_at), 410, 'attempt_expired', 'Đã tới cutoff, chỉ giữ đáp án server đã lưu.');
            rule(record.attempt.status === 'in_progress', 409, 'attempt_already_submitted', 'Bài đã nộp.');
            rule(count(body.expected_revision) === record.attempt.draft_revision, 409, 'draft_revision_conflict', 'Đáp án đã thay đổi ở phiên khác. Đọc lại và đối chiếu.');
            let answers: Answer[];
            try {
                answers = answersFromDto(body.answers);
                rule(answers.every(answer => definition.questions.some(question => question.id === answer.question_id && answer.option_ids.every(id => question.options.some(option => option.id === id)))), 422, 'invalid_answers', 'Lựa chọn không thuộc câu hỏi.');
            } catch { throw new QuizFixtureError(422, 'invalid_answers', 'Đáp án không hợp lệ.'); }
            record.answers = answers.filter(answer => answer.option_ids.length);
            record.attempt.draft_revision++;
            return { data: { attempt_id: record.attempt.id, draft_revision: record.attempt.draft_revision } };
        }
        if (parts[5] === 'submit' && method === 'POST') {
            rule(Object.keys(body).every(key => ['enrollment_id', 'expected_revision'].includes(key)), 400, 'invalid_request', 'Submit chỉ gửi cycle và revision đã lưu.');
            const replay = replayFor(ctx, state, current!.id);
            if (replay) return { data: runner(state, state.attempts.find(row => row.attempt.id === replay.attempt_id)!) };
            if (record.attempt.status !== 'submitted') {
                rule(count(body.expected_revision) === record.attempt.draft_revision, 409, 'draft_revision_conflict', 'Revision đã thay đổi. Đọc lại trước khi nộp.');
                rule(definition.quiz.quiz_type === 'assignment' || (now - Date.parse(record.attempt.started_at)) * 3 >= definition.quiz.duration_seconds * 1000 * 2, 422, 'early_submission', 'Test chỉ nộp tay từ đúng 2/3 thời lượng.');
                grade(record, definition, now);
                ctx.notify([actor.id], 'Kết quả Quiz · ' + definition.quiz.title + ' · ' + record.attempt.score_percent + '%');
            }
            remember(ctx, state, current!.id, record.attempt.id);
            return { data: runner(state, record) };
        }
        throw new QuizFixtureError(404, 'not_found', 'Không có thao tác bài làm này.');
    }
    const definition = findQuiz(Number(parts[4])), quiz = definition.quiz, action = parts[5];
    if (!action && method === 'GET') return { data: student ? { quiz } : definition };
    if (!action && method === 'PUT') {
        managerOnly();
        rule(!state.attempts.some(record => record.attempt.quiz_id === quiz.id), 409, 'quiz_frozen', 'Đã có attempt, nội dung và cấu hình bị khóa.');
        const input = validateQuizInput(body);
        Object.assign(quiz, { ...input, updated_at: iso });
        delete (quiz as unknown as Record<string, unknown>).questions;
        definition.questions = assignQuestions(input.questions, Math.max(0, ...state.definitions.flatMap(def => def.questions.flatMap(question => [question.id, ...question.options.map(option => option.id)]))) + 1);
        return { data: definition };
    }
    if (action === 'preview' && method === 'GET') { managerOnly(); return { data: definition }; }
    if (action === 'publish' && method === 'POST') {
        managerOnly();
        if (!quiz.is_published) {
            quiz.is_published = true;
            quiz.updated_at = iso;
            ctx.notify(ctx.enrollments.filter(row => row.class_id === classId && row.status === 'enrolled').map(row => row.student_id), 'Có Quiz mới được phát hành');
        }
        return { data: { quiz } };
    }
    const records = state.attempts.filter(record => record.attempt.quiz_id === quiz.id && (!student || record.attempt.enrollment_id === current!.id));
    if (action === 'attempts' && method === 'GET') return { data: null, page: student ? [...records].sort((a, b) => b.attempt.attempt_number - a.attempt.attempt_number).map(record => ({ attempt: record.attempt, answers: record.answers, review: null })) : [...records].sort((a, b) => a.attempt.enrollment_id - b.attempt.enrollment_id || a.attempt.attempt_number - b.attempt.attempt_number).map(record => ({ attempt: record.attempt, answers: record.answers })) };
    if (action === 'active-attempt' && method === 'GET') {
        rule(student, 403, 'forbidden', 'Chỉ Student khôi phục bài làm.');
        const active = records.find(record => record.attempt.status === 'in_progress');
        rule(active, 404, 'not_found', 'Không có bài đang làm.');
        return { data: runner(state, active) };
    }
    if (action === 'start' && method === 'POST') {
        rule(student, 403, 'forbidden', 'Chỉ Student bắt đầu Quiz.');
        rule(body.enrollment_id === current!.id, 409, 'stale_enrollment', 'Lần ghi danh đã thay đổi.');
        const replay = replayFor(ctx, state, current!.id);
        if (replay) return { data: runner(state, state.attempts.find(record => record.attempt.id === replay.attempt_id)!) };
        const active = records.find(record => record.attempt.status === 'in_progress');
        if (active) { remember(ctx, state, current!.id, active.attempt.id); return { data: runner(state, active) }; }
        const allowance = quizAllowance(state, quiz, current!.id);
        rule(now >= Date.parse(quiz.open_at) && now < Date.parse(allowance.effective_deadline), 409, 'quiz_not_available', 'Quiz chưa mở hoặc đã hết hạn.');
        rule(records.length < allowance.allowed_attempts, 409, 'attempt_limit_reached', 'Đã hết lượt làm.');
        const attempt: Attempt = { id: Math.max(0, ...state.attempts.map(row => row.attempt.id)) + 1, quiz_id: quiz.id, student_id: actor.id, enrollment_id: enrollmentId(current!.id), attempt_number: records.length + 1, status: 'in_progress',
            started_at: iso, effective_deadline: allowance.effective_deadline, effective_cutoff_at: new Date(Math.min(now + quiz.duration_seconds * 1000, Date.parse(allowance.effective_deadline))).toISOString(),
            submitted_at: null, time_spent_seconds: null, score: null, max_score: null, score_percent: null, is_passed: null, draft_revision: 0 };
        const record = { attempt, answers: [] };
        state.attempts.push(record);
        remember(ctx, state, current!.id, attempt.id);
        return { data: runner(state, record) };
    }
    if (action === 'grants' && method === 'POST') {
        managerOnly();
        const ids = [...new Set((Array.isArray(body.enrollment_ids) ? body.enrollment_ids : []).map(positiveId))];
        rule(ids.length > 0 && ids.length <= 10000, 400, 'invalid_request', 'Chọn lần ghi danh hiện hành.');
        const reason = requiredText(body.reason, 'Lý do', 2000), deadline = timestamp(body.deadline), extra = body.extra_attempts == null ? 1 : positiveId(body.extra_attempts);
        rule(quiz.quiz_type !== 'assignment' || extra <= 10, 400, 'invalid_request', 'Assignment cấp thêm tối đa 10 lượt mỗi lần.');
        rule(Date.parse(deadline) > now, 422, 'deadline_not_extended', 'Hạn mới phải ở tương lai.');
        const recipients = ids.map(id => {
            const row = ctx.enrollments.find(row => row.id === id && row.class_id === classId && row.status === 'enrolled' && ctx.activeStudentIds.includes(row.student_id));
            rule(row, 409, 'stale_enrollment', 'Có cycle không còn hiện hành hoặc Student đã bị vô hiệu hóa.');
            rule(Date.parse(deadline) > Date.parse(quizAllowance(state, quiz, id).effective_deadline), 422, 'deadline_not_extended', 'Hạn mới phải vượt hạn hiệu lực của mọi cycle được chọn.');
            return row.student_id;
        });
        for (const id of ids) state.grants.push({ quiz_id: quiz.id, enrollment_id: id, deadline, reason, extra_attempts: extra });
        ctx.notify([...recipients, ...ctx.adminIds], 'Manager đã cấp thêm lượt và hạn Quiz');
        return { data: { granted_enrollment_ids: ids, extra_attempts: extra, deadline }, status: 201 };
    }
    staff();
    throw new QuizFixtureError(404, 'not_found', 'Không có thao tác Quiz này.');
}
function scopeKey(ctx: Context) { return [ctx.actor.id, ctx.method, ctx.parts.join('/'), ctx.headers.get('Idempotency-Key')].join(':'); }
function replayFor(ctx: Context, state: QuizFixtureState, cycle: number) {
    const key = ctx.headers.get('Idempotency-Key');
    rule(key && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(key), 400, 'invalid_request', 'Thiếu UUID Idempotency-Key.');
    const replay = state.replays[scopeKey(ctx)];
    if (replay) {
        rule(replay.enrollment_id === cycle, 409, 'stale_idempotency_key', 'Khóa thao tác thuộc cycle cũ.');
        rule(replay.fingerprint === JSON.stringify(object(ctx.body)), 409, 'idempotency_key_reused', 'Khóa thao tác đã dùng với nội dung khác.');
    }
    return replay;
}
function remember(ctx: Context, state: QuizFixtureState, cycle: number, attemptId: number) {
    state.replays[scopeKey(ctx)] = { enrollment_id: cycle, fingerprint: JSON.stringify(ctx.body), attempt_id: attemptId };
}
