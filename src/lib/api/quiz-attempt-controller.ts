import { ApiError } from './client.ts';
import { QuizzesService, isRunner, type Answer, type AttemptPayload, type QuizRunner } from './quizzes.ts';

const copy = (answers: Answer[]) => answers.map(answer => ({ ...answer, option_ids: [...answer.option_ids] }));
const same = (left: Answer[], right: Answer[]) => JSON.stringify(left) === JSON.stringify(right);
export interface AttemptViewState {
    payload: AttemptPayload;
    answers: Answer[];
    dirty: boolean;
    saving: boolean;
    submitting: boolean;
    recovering: boolean;
    conflict: QuizRunner | null;
    error: string;
    accessDenied: boolean;
}
export class QuizAttemptController {
    private service: QuizzesService;
    private classId: number;
    private state: AttemptViewState;
    private listeners = new Set<() => void>();
    private pendingSave: Promise<boolean> | null = null;
    private submitIntent: { revision: number; key: string } | null = null;
    private generation = 0;
    private recovery: Promise<void> | null = null;
    constructor(service: QuizzesService, classId: number, payload: AttemptPayload) {
        this.service = service;
        this.classId = classId;
        this.state = { payload, answers: copy(payload.answers), dirty: false, saving: false, submitting: false, recovering: false, conflict: null, error: '', accessDenied: false };
    }
    getSnapshot = () => this.state;
    subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
    private update(changes: Partial<AttemptViewState>) {
        this.state = { ...this.state, ...changes };
        for (const listener of this.listeners) listener();
    }
    select(questionId: number, optionId: number | null) {
        const state = this.state;
        if (!isRunner(state.payload) || state.submitting || state.conflict || state.recovering || state.accessDenied) return;
        const question = state.payload.questions.find(question => question.id === questionId);
        if (!question || optionId !== null && !question.options.some(option => option.id === optionId)) throw new Error('Lựa chọn không thuộc câu hỏi.');
        const answers = state.answers.filter(answer => answer.question_id !== questionId);
        if (optionId !== null) answers.push({ question_id: questionId, option_ids: [optionId] });
        answers.sort((a, b) => a.question_id - b.question_id);
        this.update({ answers, dirty: !same(answers, state.payload.answers), error: '' });
    }
    save(): Promise<boolean> {
        if (this.pendingSave) return this.pendingSave;
        const work = this.flush();
        this.pendingSave = work;
        void work.finally(() => { if (this.pendingSave === work) this.pendingSave = null; });
        return work;
    }
    private async flush() {
        while (this.state.dirty && isRunner(this.state.payload) && !this.state.conflict && !this.state.recovering && !this.state.accessDenied) {
            const payload = this.state.payload, answers = copy(this.state.answers), generation = this.generation;
            this.update({ saving: true, error: '' });
            try {
                const revision = await this.service.saveAnswers(this.classId, payload.attempt, answers);
                if (generation !== this.generation) return false;
                this.update({ payload: { ...payload, attempt: { ...payload.attempt, draft_revision: revision }, answers }, dirty: !same(this.state.answers, answers), saving: false });
            } catch (error) {
                this.update({ saving: false, error: error instanceof Error ? error.message : 'Không thể lưu đáp án.' });
                await this.recover(true);
                return false;
            }
        }
        return !this.state.dirty && !this.state.conflict && !this.state.recovering && isRunner(this.state.payload);
    }
    recover(forceReconcile = false): Promise<void> {
        if (this.recovery) return this.recovery;
        const work = this.readLatest(forceReconcile);
        this.recovery = work;
        void work.finally(() => { if (this.recovery === work) this.recovery = null; });
        return work;
    }
    private async readLatest(forceReconcile: boolean) {
        if (this.state.saving) return;
        this.update({ recovering: true });
        try {
            const remote = await this.service.attempt(this.classId, this.state.payload.attempt.id);
            if (!isRunner(remote)) {
                this.generation++;
                this.submitIntent = null;
                this.update({ payload: remote, answers: copy(remote.answers), dirty: false, saving: false, submitting: false, conflict: null, error: this.state.dirty ? 'Bài đã nộp bằng đáp án server đã lưu. Thay đổi chưa lưu không được tính.' : '' });
            } else if (this.state.dirty && !same(this.state.answers, remote.answers) || remote.attempt.draft_revision !== this.state.payload.attempt.draft_revision && (forceReconcile || this.state.dirty)) {
                this.update({ conflict: remote, error: 'Đã đọc bản server. Chọn dùng bản server hoặc giữ đáp án đang chọn sau khi đối chiếu.' });
            } else {
                this.generation++;
                this.update({ payload: remote, answers: copy(remote.answers), dirty: false, conflict: null });
            }
        } catch (error) {
            this.update({ error: error instanceof Error ? error.message : 'Chưa đọc lại được bài làm.', accessDenied: error instanceof ApiError && [401, 403, 404].includes(error.status) });
        } finally { this.update({ recovering: false }); }
    }
    reconcile(choice: 'server' | 'local') {
        const remote = this.state.conflict;
        if (!remote) return;
        this.generation++;
        this.submitIntent = null;
        const answers = choice === 'server' ? copy(remote.answers) : this.state.answers;
        this.update({ payload: remote, answers, dirty: !same(answers, remote.answers), conflict: null, error: '' });
    }
    async submit() {
        if (this.state.submitting || this.state.conflict || this.state.recovering || this.state.accessDenied || !isRunner(this.state.payload)) return;
        this.update({ submitting: true, error: '' });
        try {
            if (!await this.save() || !isRunner(this.state.payload)) return;
            const attempt = this.state.payload.attempt;
            if (!this.submitIntent || this.submitIntent.revision !== attempt.draft_revision) this.submitIntent = { revision: attempt.draft_revision, key: crypto.randomUUID() };
            const result = await this.service.submit(this.classId, attempt, this.submitIntent.key);
            this.generation++;
            this.update({ payload: result, answers: copy(result.answers), dirty: false, conflict: null });
            this.submitIntent = null;
        } catch (error) {
            this.update({ error: error instanceof Error ? error.message : 'Chưa xác định được kết quả nộp.' });
            if (!(error instanceof ApiError) || error.status === 409 || error.status === 410 || error.kind === 'network' || error.status >= 500) await this.recover(true);
        } finally { this.update({ submitting: false }); }
    }
}
