import { ApiClient } from './client.ts';
import { protocol } from './accounts.ts';
import { object, positiveId, pageOf } from './dto.ts';
import { progressFromDto } from './classes.ts';
import { enrollmentFromDto } from './enrollments.ts';
export class ProgressService {
    private client: ApiClient;
    constructor(client: ApiClient) { this.client = client; }
    async list(role: 'admin' | 'manager', classId: number, page = 1) {
        const value = await this.client.request('/' + role + '/classes/' + positiveId(classId) + '/progress?page=' + page + '&page_size=20');
        return protocol(() => pageOf(value => {
            const row = object(value), enrollment = enrollmentFromDto(row.enrollment), progress = progressFromDto(row.progress);
            if (enrollment.class_id !== classId || progress.enrollment_id !== enrollment.id) throw new Error('Progress không khớp lớp hoặc cycle.');
            return { enrollment, progress };
        })(value));
    }
}
