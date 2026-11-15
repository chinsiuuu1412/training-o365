import { ApiClient, ApiError } from './client.ts';
import { protocol, requiredText } from './accounts.ts';
import { object, text, positiveId, count, numeric, bool, nullable, items, pageOf, enrollmentId, type EnrollmentId } from './dto.ts';
import type { Role } from '../../types/lms.ts';

export interface ApiQuiz {
    id: number;
    class_id: number;
    title: string;
    description: string;
    quiz_type: 'test' | 'assignment';
    duration_seconds: number;
    open_at: string;
    deadline: string;
    pass_score: number;
    attempt_limit: number;
    is_published: boolean;
    created_at: string;
    updated_at: string;
}
export interface StudentQuiz extends ApiQuiz {
    effective_deadline: string;
    allowed_attempts: number;
    used_attempts: number;
    best_score_percent: number | null;
    is_passed: boolean;
}
export interface QuizOption { id: number; option_text: string; sort_order: number; is_correct?: boolean }
export interface QuizQuestion { id: number; question_text: string; sort_order: number; question_type: 'single_choice'; points: 1; options: QuizOption[] }
export interface Answer { question_id: number; option_ids: number[] }
export interface Attempt {
    id: number;
    quiz_id: number;
    student_id: number;
    enrollment_id: EnrollmentId;
    attempt_number: number;
    status: 'in_progress' | 'submitted';
    started_at: string;
    effective_deadline: string;
    effective_cutoff_at: string;
    submitted_at: string | null;
    time_spent_seconds: number | null;
    score: number | null;
    max_score: number | null;
    score_percent: number | null;
    is_passed: boolean | null;
    draft_revision: number;
}
export interface QuizResult { attempt: Attempt; answers: Answer[]; review: null }
export interface QuizRunner extends QuizResult { quiz: ApiQuiz; questions: QuizQuestion[] }
export type AttemptPayload = QuizRunner | QuizResult;
export interface QuestionInput { question_text: string; options: { option_text: string; is_correct: boolean }[] }
export interface QuizInput {
    title: string; description: string; quiz_type: 'test' | 'assignment'; duration_seconds: number;
    open_at: string; deadline: string; pass_score: number; attempt_limit: number; questions: QuestionInput[];
}
export function timestamp(value: unknown) {
    const result = text(value);
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(result) || !Number.isFinite(Date.parse(result))) throw new Error('Thời gian cần đúng định dạng RFC3339.');
    const date = result.slice(0, 10);
    if (new Date(date + 'T00:00:00Z').toISOString().slice(0, 10) !== date) throw new Error('Ngày không tồn tại.');
    return result;
}
function percent(value: unknown) {
    const result = numeric(value);
    if (result < 0 || result > 100) throw new Error('Điểm phần trăm phải trong khoảng 0–100.');
    return result;
}
function description(value: unknown) {
    const result = text(value);
    if (Array.from(result).length > 10000) throw new Error('Mô tả tối đa 10000 ký tự.');
    return result;
}
export function validateQuizInput(input: Record<string, unknown>): QuizInput {
    const kind = text(input.quiz_type), duration = positiveId(input.duration_seconds);
    if (!['test', 'assignment'].includes(kind) || duration > 31536000) throw new Error('Loại bài hoặc thời lượng không hợp lệ.');
    const limit = input.attempt_limit == null ? kind === 'test' ? 1 : 10 : positiveId(input.attempt_limit);
    if (kind === 'test' && limit !== 1) throw new Error('Test có một lượt mặc định. Cấp thêm lượt qua Grant.');
    const open = timestamp(input.open_at), deadline = timestamp(input.deadline);
    if (Date.parse(open) >= Date.parse(deadline)) throw new Error('Hạn nộp phải sau giờ mở.');
    const questions = items(input.questions, value => {
        const row = object(value);
        if (Object.keys(row).some(key => !['question_text', 'options'].includes(key))) throw new Error('Câu hỏi chỉ gửi nội dung và lựa chọn.');
        const options = items(row.options, value => {
            const option = object(value);
            if (Object.keys(option).some(key => !['option_text', 'is_correct'].includes(key))) throw new Error('Lựa chọn chứa trường ngoài contract.');
            return { option_text: requiredText(option.option_text, 'Lựa chọn', 10000), is_correct: bool(option.is_correct) };
        });
        if (options.length < 2 || options.length > 100 || options.filter(option => option.is_correct).length !== 1) throw new Error('Mỗi câu cần 2–100 lựa chọn và đúng một đáp án đúng.');
        return { question_text: requiredText(row.question_text, 'Câu hỏi', 10000), options };
    });
    if (!questions.length || questions.length > 500) throw new Error('Quiz cần 1–500 câu hỏi.');
    return { title: requiredText(input.title, 'Tên Quiz'), description: description(input.description), quiz_type: kind as ApiQuiz['quiz_type'], duration_seconds: duration, open_at: open, deadline, pass_score: percent(input.pass_score), attempt_limit: limit, questions };
}
export function quizFromDto(value: unknown): ApiQuiz {
    const row = object(value), kind = text(row.quiz_type);
    if (!['test', 'assignment'].includes(kind)) throw new Error('Loại Quiz không hợp lệ.');
    return {
        id: positiveId(row.id), class_id: positiveId(row.class_id), title: text(row.title), description: text(row.description),
        quiz_type: kind as ApiQuiz['quiz_type'], duration_seconds: positiveId(row.duration_seconds), open_at: timestamp(row.open_at),
        deadline: timestamp(row.deadline), pass_score: percent(row.pass_score), attempt_limit: positiveId(row.attempt_limit),
        is_published: bool(row.is_published), created_at: timestamp(row.created_at), updated_at: timestamp(row.updated_at)
    };
}
export function studentQuizFromDto(value: unknown): StudentQuiz {
    const row = object(value);
    return { ...quizFromDto(row), effective_deadline: timestamp(row.effective_deadline), allowed_attempts: positiveId(row.allowed_attempts), used_attempts: count(row.used_attempts), best_score_percent: nullable(percent)(row.best_score_percent), is_passed: bool(row.is_passed) };
}
export function questionsFromDto(value: unknown, staff: boolean) {
    return items(value, value => {
        const row = object(value);
        if (row.question_type !== 'single_choice' || row.points !== 1) throw new Error('MVP chỉ hỗ trợ single choice, mỗi câu một điểm.');
        const options = items(row.options, value => {
            const option = object(value);
            if (!staff && 'is_correct' in option) throw new Error('Phản hồi Student có chứa đáp án đúng.');
            return { id: positiveId(option.id), option_text: text(option.option_text), sort_order: count(option.sort_order), ...(staff ? { is_correct: bool(option.is_correct) } : {}) };
        });
        return { id: positiveId(row.id), question_text: text(row.question_text), sort_order: count(row.sort_order), question_type: 'single_choice' as const, points: 1 as const, options };
    });
}
export function answersFromDto(value: unknown): Answer[] {
    const seen = new Set<number>();
    return items(value, value => {
        const row = object(value), id = positiveId(row.question_id), options = items(row.option_ids, positiveId);
        if (options.length > 1 || seen.has(id)) throw new Error('Đáp án single choice không hợp lệ.');
        seen.add(id);
        return { question_id: id, option_ids: options };
    }).sort((a, b) => a.question_id - b.question_id);
}
export function attemptFromDto(value: unknown): Attempt {
    const row = object(value), status = text(row.status);
    if (!['in_progress', 'submitted'].includes(status)) throw new Error('Trạng thái attempt không hợp lệ.');
    const result = {
        id: positiveId(row.id), quiz_id: positiveId(row.quiz_id), student_id: positiveId(row.student_id), enrollment_id: enrollmentId(row.enrollment_id),
        attempt_number: positiveId(row.attempt_number), status: status as Attempt['status'], started_at: timestamp(row.started_at),
        effective_deadline: timestamp(row.effective_deadline), effective_cutoff_at: timestamp(row.effective_cutoff_at),
        submitted_at: nullable(timestamp)(row.submitted_at), time_spent_seconds: nullable(count)(row.time_spent_seconds), score: nullable(numeric)(row.score),
        max_score: nullable(numeric)(row.max_score), score_percent: nullable(percent)(row.score_percent), is_passed: nullable(bool)(row.is_passed), draft_revision: count(row.draft_revision)
    };
    const graded = [result.submitted_at, result.time_spent_seconds, result.score, result.max_score, result.score_percent, result.is_passed];
    if (status === 'submitted' ? graded.some(value => value === null) : graded.some(value => value !== null)) throw new Error('Kết quả nullable không khớp trạng thái attempt.');
    return result;
}
export function attemptPayloadFromDto(value: unknown): AttemptPayload {
    const row = object(value), attempt = attemptFromDto(row.attempt);
    if (row.review !== null) throw new Error('Student chỉ xem điểm, review phải null.');
    const result: QuizResult = { attempt, answers: answersFromDto(row.answers), review: null };
    if (attempt.status === 'submitted') {
        if ('questions' in row || 'quiz' in row) throw new Error('Result đã nộp chứa nội dung ngoài contract.');
        return result;
    }
    if (!('quiz' in row)) return result;
    const quiz = quizFromDto(row.quiz), questions = questionsFromDto(row.questions, false);
    if (quiz.id !== attempt.quiz_id) throw new Error('Runner sai Quiz.');
    return { ...result, quiz, questions };
}
export function isRunner(payload: AttemptPayload): payload is QuizRunner {
    return payload.attempt.status === 'in_progress' && 'questions' in payload;
}
export function canSubmitManually(runner: QuizRunner, now: number) {
    return now < Date.parse(runner.attempt.effective_cutoff_at) && (runner.quiz.quiz_type === 'assignment' || (now - Date.parse(runner.attempt.started_at)) * 3 >= runner.quiz.duration_seconds * 1000 * 2);
}
export function quizAvailability(quiz: StudentQuiz, now: number) {
    if (now < Date.parse(quiz.open_at)) return 'not-open';
    if (now >= Date.parse(quiz.effective_deadline)) return 'expired';
    return quiz.used_attempts >= quiz.allowed_attempts ? 'exhausted' : 'available';
}
export class QuizzesService {
    private client: ApiClient;
    constructor(client: ApiClient) { this.client = client; }
    private path(role: Role, classId: number) { return '/' + role + '/classes/' + positiveId(classId); }
    async list(role: 'admin' | 'manager', classId: number, page = 1) {
        const value = await this.client.request(this.path(role, classId) + '/quizzes?page=' + page + '&page_size=20');
        return protocol(() => pageOf(quizFromDto)(value));
    }
    async studentList(classId: number, page = 1) {
        const value = await this.client.request(this.path('student', classId) + '/quizzes?page=' + page + '&page_size=100');
        return protocol(() => pageOf(studentQuizFromDto)(value));
    }
    async studentInfo(classId: number, quizId: number) {
        let page = await this.studentList(classId);
        for (;;) {
            const found = page.items.find(quiz => quiz.id === quizId);
            if (found) return found;
            if (page.page * page.pageSize >= page.total) throw new ApiError('Không tìm thấy Quiz đã phát hành.', { status: 404, code: 'not_found' });
            page = await this.studentList(classId, page.page + 1);
        }
    }
    async definition(role: 'admin' | 'manager', classId: number, quizId: number, preview = false) {
        const value = object(await this.client.request(this.path(role, classId) + '/quizzes/' + positiveId(quizId) + (preview ? '/preview' : '')));
        return protocol(() => ({ quiz: quizFromDto(value.quiz), questions: questionsFromDto(value.questions, true) }));
    }
    async save(classId: number, input: Record<string, unknown>, quizId?: number) {
        const value = object(await this.client.request(this.path('manager', classId) + '/quizzes' + (quizId ? '/' + positiveId(quizId) : ''), { method: quizId ? 'PUT' : 'POST', body: { ...validateQuizInput(input) } }));
        return protocol(() => ({ quiz: quizFromDto(value.quiz), questions: questionsFromDto(value.questions, true) }));
    }
    async publish(classId: number, quizId: number) {
        const value = object(await this.client.request(this.path('manager', classId) + '/quizzes/' + positiveId(quizId) + '/publish', { method: 'POST' }));
        return protocol(() => quizFromDto(value.quiz));
    }
    async active(classId: number, quizId: number): Promise<AttemptPayload | null> {
        try {
            const value = await this.client.request(this.path('student', classId) + '/quizzes/' + positiveId(quizId) + '/active-attempt');
            return protocol(() => attemptPayloadFromDto(value));
        } catch (error) {
            if (error instanceof ApiError && error.status === 404 && error.code === 'not_found') return null;
            throw error;
        }
    }
    async start(classId: number, quizId: number, cycle: EnrollmentId, key: string) {
        const value = await this.client.request(this.path('student', classId) + '/quizzes/' + positiveId(quizId) + '/start', { method: 'POST', body: { enrollment_id: enrollmentId(cycle) }, idempotencyKey: key });
        return protocol(() => attemptPayloadFromDto(value));
    }
    async attempt(classId: number, attemptId: number) {
        const value = await this.client.request(this.path('student', classId) + '/quiz-attempts/' + positiveId(attemptId));
        return protocol(() => attemptPayloadFromDto(value));
    }
    async saveAnswers(classId: number, attempt: Attempt, answers: Answer[]) {
        const value = object(await this.client.request(this.path('student', classId) + '/quiz-attempts/' + positiveId(attempt.id) + '/draft', { method: 'PUT', body: { enrollment_id: enrollmentId(attempt.enrollment_id), expected_revision: count(attempt.draft_revision), answers: answersFromDto(answers) } }));
        return protocol(() => {
            if (positiveId(value.attempt_id) !== attempt.id) throw new Error('Phản hồi lưu sai attempt.');
            const revision = count(value.draft_revision);
            if (revision !== attempt.draft_revision + 1) throw new Error('Revision lưu không tăng đúng một lần.');
            return revision;
        });
    }
    async submit(classId: number, attempt: Attempt, key: string) {
        const value = await this.client.request(this.path('student', classId) + '/quiz-attempts/' + positiveId(attempt.id) + '/submit', { method: 'POST', body: { enrollment_id: enrollmentId(attempt.enrollment_id), expected_revision: count(attempt.draft_revision) }, idempotencyKey: key });
        return protocol(() => attemptPayloadFromDto(value));
    }
    async history(classId: number, quizId: number, page = 1) {
        const value = await this.client.request(this.path('student', classId) + '/quizzes/' + positiveId(quizId) + '/attempts?page=' + page + '&page_size=20');
        return protocol(() => pageOf(attemptPayloadFromDto)(value));
    }
    async results(role: 'admin' | 'manager', classId: number, quizId: number, page = 1) {
        const value = await this.client.request(this.path(role, classId) + '/quizzes/' + positiveId(quizId) + '/attempts?page=' + page + '&page_size=20');
        return protocol(() => pageOf(value => {
            const row = object(value);
            return { attempt: attemptFromDto(row.attempt), answers: answersFromDto(row.answers) };
        })(value));
    }
    async grant(classId: number, quizId: number, ids: EnrollmentId[], reason: string, deadline: string, extra: number) {
        const enrollment_ids = [...new Set(ids.map(enrollmentId))];
        if (!enrollment_ids.length || enrollment_ids.length > 10000) throw new Error('Chọn 1–10000 lần ghi danh hiện hành.');
        const value = object(await this.client.request(this.path('manager', classId) + '/quizzes/' + positiveId(quizId) + '/grants', { method: 'POST', body: { enrollment_ids, reason: requiredText(reason, 'Lý do', 2000), deadline: timestamp(deadline), extra_attempts: positiveId(extra) } }));
        return protocol(() => ({ granted_enrollment_ids: items(value.granted_enrollment_ids, enrollmentId), extra_attempts: positiveId(value.extra_attempts), deadline: timestamp(value.deadline) }));
    }
}
