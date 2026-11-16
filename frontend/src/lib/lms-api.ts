import { apiRequest, buildQuery, fetchAllPages } from "@/lib/api-client";
import type {
  AnnouncementDto,
  AttemptResultData,
  AttemptRunnerData,
  AttendanceDto,
  AttendanceRow,
  AuditDto,
  AuthSessionData,
  ClassDto,
  ClassSummary,
  DashboardDto,
  DiscoverClassDto,
  EnrollmentHistoryItem,
  EnrollmentProgressRow,
  EnrollmentRequest,
  Gender,
  MaterialDto,
  Page,
  PendingScheduleProposal,
  PreviewUpcomingSession,
  Progress,
  ProposalDto,
  QuizDto,
  QuizQuestionDto,
  RouteRole,
  SessionDto,
  StaffAbsenceRow,
  StaffAttemptItem,
  StaffEnrollmentRequest,
  StaffEnrollmentRow,
  StudentQuizDto,
  User,
} from "@/types/api";

export const authApi = {
  login: (email: string, password: string) =>
    apiRequest<AuthSessionData>("/auth/login", {
      method: "POST",
      body: { email, password },
      skipUnauthorizedHandler: true,
    }),
  me: (signal?: AbortSignal) =>
    apiRequest<AuthSessionData>("/auth/me", { signal, skipUnauthorizedHandler: true }),
  logout: () => apiRequest<Record<string, never>>("/auth/logout", { method: "POST", body: {} }),
  changePassword: (current_password: string, new_password: string) =>
    apiRequest<Record<string, never>>("/auth/change-password", {
      method: "POST",
      body: { current_password, new_password },
    }),
};

export const announcementsApi = {
  list: (params: { is_read?: boolean; page?: number; page_size?: number }, signal?: AbortSignal) =>
    apiRequest<Page<AnnouncementDto>>(
      `/announcements${buildQuery({
        is_read: params.is_read,
        page: params.page ?? 1,
        page_size: params.page_size ?? 20,
      })}`,
      { signal },
    ),
  get: (id: number, signal?: AbortSignal) =>
    apiRequest<{ announcement: AnnouncementDto }>(`/announcements/${id}`, { signal }),
  setRead: (id: number, is_read: boolean) =>
    apiRequest<Record<string, never>>(`/announcements/${id}/read`, {
      method: "PATCH",
      body: { is_read },
    }),
  listAllRecipients: (role: "admin" | "manager") =>
    fetchAllPages<User>((page, page_size) =>
      apiRequest<Page<User>>(`/${role}/recipients${buildQuery({ page, page_size })}`),
    ),
  send: (
    role: "admin" | "manager",
    payload: { recipient_ids: number[]; title: string; content: string },
  ) =>
    apiRequest<{ announcement_id: number; recipient_count: number }>(`/${role}/announcements`, {
      method: "POST",
      body: payload,
    }),
};

export interface CreateUserInput {
  email: string;
  full_name: string;
  role: "student" | "class_manager";
  password: string;
  student_id?: string | null;
  school_or_institute?: string | null;
  university_class?: string | null;
  phone_number?: string | null;
  gender?: Gender | null;
}

export interface UpdateUserInput {
  email: string;
  full_name: string;
  student_id?: string | null;
  school_or_institute?: string | null;
  university_class?: string | null;
  phone_number?: string | null;
  gender?: Gender | null;
}

export const adminUsersApi = {
  list: (
    params: {
      search?: string;
      role?: "student" | "class_manager";
      is_active?: boolean;
      page?: number;
      page_size?: number;
    },
    signal?: AbortSignal,
  ) =>
    apiRequest<Page<User>>(
      `/admin/users${buildQuery({
        search: params.search,
        role: params.role,
        is_active: params.is_active,
        page: params.page ?? 1,
        page_size: params.page_size ?? 20,
      })}`,
      { signal },
    ),
  listAllActiveManagers: () =>
    fetchAllPages<User>((page, page_size) =>
      apiRequest<Page<User>>(
        `/admin/users${buildQuery({ role: "class_manager", is_active: true, page, page_size })}`,
      ),
    ),
  create: (payload: CreateUserInput) =>
    apiRequest<{ user: User }>("/admin/users", { method: "POST", body: payload }),
  update: (id: number, payload: UpdateUserInput) =>
    apiRequest<{ user: User }>(`/admin/users/${id}`, { method: "PUT", body: payload }),
  setStatus: (id: number, payload: { is_active: boolean; reason: string }) =>
    apiRequest<{ user: User }>(`/admin/users/${id}/status`, { method: "PATCH", body: payload }),
  resetPassword: (id: number, new_password: string) =>
    apiRequest<Record<string, never>>(`/admin/users/${id}/reset-password`, {
      method: "POST",
      body: { new_password },
    }),
};

export interface ClassInputPayload {
  code: string;
  name: string;
  description: string;
  manager_id: number;
  capacity: number;
  end_date: string;
  min_attendance_percent: number;
  min_quiz_percent: number;
  reassignment_reason?: string;
  confirm_reassignment?: boolean;
}

export const dashboardApi = {
  get: <TClass = ClassDto | ClassSummary>(role: RouteRole, signal?: AbortSignal) =>
    apiRequest<DashboardDto<TClass>>(`/${role}/dashboard`, { signal }),
};

export const dashboardsApi = dashboardApi;

export const classesApi = {
  list: (
    role: RouteRole,
    params: { search?: string; page?: number; page_size?: number },
    signal?: AbortSignal,
  ) =>
    apiRequest<Page<ClassDto>>(
      `/${role}/classes${buildQuery({
        search: params.search,
        page: params.page ?? 1,
        page_size: params.page_size ?? 20,
      })}`,
      { signal },
    ),
  get: (role: RouteRole, classId: number, signal?: AbortSignal) =>
    apiRequest<{ class: ClassDto }>(`/${role}/classes/${classId}`, { signal }),
  create: (payload: ClassInputPayload) =>
    apiRequest<{ class: ClassDto }>("/admin/classes", { method: "POST", body: payload }),
  update: (classId: number, payload: ClassInputPayload) =>
    apiRequest<{ class: ClassDto }>(`/admin/classes/${classId}`, { method: "PUT", body: payload }),
  setTotalSessions: (classId: number, total_sessions: number) =>
    apiRequest<{ class: ClassDto }>(`/manager/classes/${classId}/total-sessions`, {
      method: "PUT",
      body: { total_sessions },
    }),
  discover: (params: { search?: string; page?: number; page_size?: number }, signal?: AbortSignal) =>
    apiRequest<Page<DiscoverClassDto>>(
      `/student/discover/classes${buildQuery({
        search: params.search,
        page: params.page ?? 1,
        page_size: params.page_size ?? 20,
      })}`,
      { signal },
    ),
  preview: (classId: number, signal?: AbortSignal) =>
    apiRequest<{ class: ClassDto; upcoming_sessions: PreviewUpcomingSession[] }>(
      `/student/classes/${classId}/preview`,
      { signal },
    ),
  studentPreview: (classId: number, signal?: AbortSignal) =>
    apiRequest<{ class: ClassDto; upcoming_sessions: PreviewUpcomingSession[] }>(
      `/student/classes/${classId}/preview`,
      { signal },
    ),
  staffProgress: (
    role: "admin" | "manager",
    classId: number,
    params: { page?: number; page_size?: number },
    signal?: AbortSignal,
  ) =>
    apiRequest<Page<EnrollmentProgressRow>>(
      `/${role}/classes/${classId}/progress${buildQuery({
        page: params.page ?? 1,
        page_size: params.page_size ?? 20,
      })}`,
      { signal },
    ),
  studentProgress: (classId: number, signal?: AbortSignal) =>
    apiRequest<{ progress: Progress }>(`/student/classes/${classId}/progress`, { signal }),
};

export const progressApi = {
  studentGet: classesApi.studentProgress,
  staffList: classesApi.staffProgress,
};

export const enrollmentsApi = {
  studentRequests: (params: { page?: number; page_size?: number }, signal?: AbortSignal) =>
    apiRequest<Page<EnrollmentRequest>>(
      `/student/enrollment-requests${buildQuery({ page: params.page ?? 1, page_size: params.page_size ?? 20 })}`,
      { signal },
    ),
  studentAllRequests: (signal?: AbortSignal) =>
    fetchAllPages<EnrollmentRequest>((page, page_size) =>
      apiRequest<Page<EnrollmentRequest>>(
        `/student/enrollment-requests${buildQuery({ page, page_size })}`,
        { signal },
      ),
    ),
  createRequest: (classId: number, reason: string) =>
    apiRequest<{ request: EnrollmentRequest }>(`/student/classes/${classId}/enrollment-requests`, {
      method: "POST",
      body: { reason },
    }),
  studentRequest: (classId: number, reason: string) =>
    apiRequest<{ request: EnrollmentRequest }>(`/student/classes/${classId}/enrollment-requests`, {
      method: "POST",
      body: { reason },
    }),
  cancelRequest: (classId: number, requestId: number) =>
    apiRequest<Record<string, never>>(
      `/student/classes/${classId}/enrollment-requests/${requestId}/cancel`,
      { method: "POST", body: {} },
    ),
  studentHistory: (params: { page?: number; page_size?: number }, signal?: AbortSignal) =>
    apiRequest<Page<EnrollmentHistoryItem>>(
      `/student/enrollment-history${buildQuery({ page: params.page ?? 1, page_size: params.page_size ?? 20 })}`,
      { signal },
    ),
  studentAllHistory: (signal?: AbortSignal) =>
    fetchAllPages<EnrollmentHistoryItem>((page, page_size) =>
      apiRequest<Page<EnrollmentHistoryItem>>(
        `/student/enrollment-history${buildQuery({ page, page_size })}`,
        { signal },
      ),
    ),
  staffRequests: (
    role: "admin" | "manager",
    classId: number,
    params: { page?: number; page_size?: number },
    signal?: AbortSignal,
  ) =>
    apiRequest<Page<StaffEnrollmentRequest>>(
      `/${role}/classes/${classId}/enrollment-requests${buildQuery({
        page: params.page ?? 1,
        page_size: params.page_size ?? 20,
      })}`,
      { signal },
    ),
  reviewRequest: (
    classId: number,
    requestId: number,
    payload: { decision: "approve" | "decline"; reason?: string },
  ) =>
    apiRequest<{ request: EnrollmentRequest }>(
      `/manager/classes/${classId}/enrollment-requests/${requestId}/review`,
      { method: "POST", body: payload },
    ),
  staffRoster: (
    role: "admin" | "manager",
    classId: number,
    params: { page?: number; page_size?: number },
    signal?: AbortSignal,
  ) =>
    apiRequest<Page<StaffEnrollmentRow>>(
      `/${role}/classes/${classId}/enrollments${buildQuery({
        page: params.page ?? 1,
        page_size: params.page_size ?? 20,
      })}`,
      { signal },
    ),
  staffAllRoster: (role: "admin" | "manager", classId: number, signal?: AbortSignal) =>
    fetchAllPages<StaffEnrollmentRow>((page, page_size) =>
      apiRequest<Page<StaffEnrollmentRow>>(
        `/${role}/classes/${classId}/enrollments${buildQuery({ page, page_size })}`,
        { signal },
      ),
    ),
  listAllRoster: (role: "admin" | "manager", classId: number, signal?: AbortSignal) =>
    fetchAllPages<StaffEnrollmentRow>((page, page_size) =>
      apiRequest<Page<StaffEnrollmentRow>>(
        `/${role}/classes/${classId}/enrollments${buildQuery({ page, page_size })}`,
        { signal },
      ),
    ),
  removeEnrollment: (role: "admin" | "manager", classId: number, enrollmentId: number, reason: string) =>
    apiRequest<Record<string, never>>(
      `/${role}/classes/${classId}/enrollments/${enrollmentId}/remove`,
      { method: "POST", body: { reason } },
    ),
  removeStudent: (role: "admin" | "manager", classId: number, enrollmentId: number, reason: string) =>
    apiRequest<Record<string, never>>(
      `/${role}/classes/${classId}/enrollments/${enrollmentId}/remove`,
      { method: "POST", body: { reason } },
    ),
};

export const sessionsApi = {
  list: (
    role: RouteRole,
    classId: number,
    params: { page?: number; page_size?: number },
    signal?: AbortSignal,
  ) =>
    apiRequest<Page<SessionDto>>(
      `/${role}/classes/${classId}/sessions${buildQuery({
        page: params.page ?? 1,
        page_size: params.page_size ?? 20,
      })}`,
      { signal },
    ),
  listAll: (role: RouteRole, classId: number, signal?: AbortSignal) =>
    fetchAllPages<SessionDto>((page, page_size) =>
      apiRequest<Page<SessionDto>>(`/${role}/classes/${classId}/sessions${buildQuery({ page, page_size })}`, {
        signal,
      }),
    ),
  get: (role: RouteRole, classId: number, sessionId: number, signal?: AbortSignal) =>
    apiRequest<{ session: SessionDto; proposals?: ProposalDto[] }>(
      `/${role}/classes/${classId}/sessions/${sessionId}`,
      { signal },
    ),
  create: (
    classId: number,
    payload: {
      session_number: number;
      title: string;
      description: string;
      location: string;
      attendance_code: string;
    },
  ) =>
    apiRequest<{ session: SessionDto }>(`/manager/classes/${classId}/sessions`, {
      method: "POST",
      body: payload,
    }),
  saveDraft: (classId: number, sessionId: number, payload: { starts_at: string; ends_at: string }) =>
    apiRequest<{ proposal: ProposalDto }>(
      `/manager/classes/${classId}/sessions/${sessionId}/schedule-draft`,
      { method: "PUT", body: payload },
    ),
  saveScheduleDraft: (classId: number, sessionId: number, payload: { starts_at: string; ends_at: string }) =>
    apiRequest<{ proposal: ProposalDto }>(
      `/manager/classes/${classId}/sessions/${sessionId}/schedule-draft`,
      { method: "PUT", body: payload },
    ),
  submitProposal: (classId: number, sessionId: number, proposalId: number) =>
    apiRequest<{ proposal: ProposalDto }>(
      `/manager/classes/${classId}/sessions/${sessionId}/schedule-proposals/${proposalId}/submit`,
      { method: "POST", body: {} },
    ),
  adminPendingProposals: (params: { page?: number; page_size?: number }, signal?: AbortSignal) =>
    apiRequest<Page<PendingScheduleProposal>>(
      `/admin/schedule-proposals${buildQuery({ page: params.page ?? 1, page_size: params.page_size ?? 20 })}`,
      { signal },
    ),
  adminReviewProposal: (
    classId: number,
    sessionId: number,
    proposalId: number,
    payload: { decision: "approve" | "reject"; reason?: string },
  ) =>
    apiRequest<{ session: SessionDto; proposal: ProposalDto }>(
      `/admin/classes/${classId}/sessions/${sessionId}/schedule-proposals/${proposalId}/review`,
      { method: "POST", body: payload },
    ),
};

export const attendanceApi = {
  list: (
    role: RouteRole,
    classId: number,
    params: { page?: number; page_size?: number },
    signal?: AbortSignal,
  ) =>
    apiRequest<Page<AttendanceRow>>(
      `/${role}/classes/${classId}/attendance${buildQuery({
        page: params.page ?? 1,
        page_size: params.page_size ?? 20,
      })}`,
      { signal },
    ),
  listAttendance: (
    role: RouteRole,
    classId: number,
    params: { page?: number; page_size?: number },
    signal?: AbortSignal,
  ) =>
    apiRequest<Page<AttendanceRow>>(
      `/${role}/classes/${classId}/attendance${buildQuery({
        page: params.page ?? 1,
        page_size: params.page_size ?? 20,
      })}`,
      { signal },
    ),
  listAll: (role: RouteRole, classId: number, signal?: AbortSignal) =>
    fetchAllPages<AttendanceRow>((page, page_size) =>
      apiRequest<Page<AttendanceRow>>(
        `/${role}/classes/${classId}/attendance${buildQuery({ page, page_size })}`,
        { signal },
      ),
    ),
  attend: (classId: number, sessionId: number, payload: { enrollment_id: number; code: string }) =>
    apiRequest<{ attendance: AttendanceDto; authoritative_override?: true }>(
      `/student/classes/${classId}/sessions/${sessionId}/attend`,
      { method: "POST", body: payload },
    ),
  submitAbsence: (
    classId: number,
    sessionId: number,
    payload: { enrollment_id: number; reason: string },
  ) =>
    apiRequest<{ absence: { id: number; enrollment_id: number; session_id: number; reason: string; created_at: string }; status: "approved" }>(
      `/student/classes/${classId}/sessions/${sessionId}/absence`,
      { method: "POST", body: payload },
    ),
  absence: (
    classId: number,
    sessionId: number,
    payload: { enrollment_id: number; reason: string },
  ) =>
    apiRequest<{ absence: { id: number; enrollment_id: number; session_id: number; reason: string; created_at: string }; status: "approved" }>(
      `/student/classes/${classId}/sessions/${sessionId}/absence`,
      { method: "POST", body: payload },
    ),
  override: (
    classId: number,
    sessionId: number,
    enrollmentId: number,
    payload: { attended: boolean; reason: string },
  ) =>
    apiRequest<{ attendance: AttendanceDto }>(
      `/manager/classes/${classId}/sessions/${sessionId}/attendance/${enrollmentId}/override`,
      { method: "POST", body: payload },
    ),
  listAbsences: (
    role: "admin" | "manager",
    classId: number,
    params: { page?: number; page_size?: number },
    signal?: AbortSignal,
  ) =>
    apiRequest<Page<StaffAbsenceRow>>(
      `/${role}/classes/${classId}/absences${buildQuery({
        page: params.page ?? 1,
        page_size: params.page_size ?? 20,
      })}`,
      { signal },
    ),
  listAudit: (
    role: "admin" | "manager",
    classId: number,
    params: { page?: number; page_size?: number },
    signal?: AbortSignal,
  ) =>
    apiRequest<Page<AuditDto>>(
      `/${role}/classes/${classId}/audit${buildQuery({
        page: params.page ?? 1,
        page_size: params.page_size ?? 20,
      })}`,
      { signal },
    ),
};

export interface QuizInputPayload {
  title: string;
  description: string;
  quiz_type: "test" | "assignment";
  duration_seconds: number;
  open_at: string;
  deadline: string;
  pass_score: number;
  attempt_limit?: number | null;
  questions: {
    question_text: string;
    options: { option_text: string; is_correct: boolean }[];
  }[];
}

export const quizzesApi = {
  staffList: (
    role: "admin" | "manager",
    classId: number,
    params: { page?: number; page_size?: number },
    signal?: AbortSignal,
  ) =>
    apiRequest<Page<QuizDto>>(
      `/${role}/classes/${classId}/quizzes${buildQuery({
        page: params.page ?? 1,
        page_size: params.page_size ?? 20,
      })}`,
      { signal },
    ),
  studentList: (
    classId: number,
    params: { page?: number; page_size?: number },
    signal?: AbortSignal,
  ) =>
    apiRequest<Page<StudentQuizDto>>(
      `/student/classes/${classId}/quizzes${buildQuery({
        page: params.page ?? 1,
        page_size: params.page_size ?? 20,
      })}`,
      { signal },
    ),
  listAll: (role: RouteRole, classId: number, signal?: AbortSignal) =>
    role === "student"
      ? fetchAllPages<StudentQuizDto>((page, page_size) =>
          apiRequest<Page<StudentQuizDto>>(
            `/student/classes/${classId}/quizzes${buildQuery({ page, page_size })}`,
            { signal },
          ),
        )
      : fetchAllPages<QuizDto>((page, page_size) =>
          apiRequest<Page<QuizDto>>(
            `/${role}/classes/${classId}/quizzes${buildQuery({ page, page_size })}`,
            { signal },
          ),
        ),
  get: (role: RouteRole, classId: number, quizId: number, signal?: AbortSignal) =>
    apiRequest<{ quiz: QuizDto; questions?: QuizQuestionDto[] }>(
      `/${role}/classes/${classId}/quizzes/${quizId}`,
      { signal },
    ),
  staffGet: (role: "admin" | "manager", classId: number, quizId: number, signal?: AbortSignal) =>
    apiRequest<{ quiz: QuizDto; questions: QuizQuestionDto[] }>(
      `/${role}/classes/${classId}/quizzes/${quizId}`,
      { signal },
    ),
  studentGet: (classId: number, quizId: number, signal?: AbortSignal) =>
    apiRequest<{ quiz: QuizDto }>(`/student/classes/${classId}/quizzes/${quizId}`, { signal }),
  preview: (classId: number, quizId: number, signal?: AbortSignal) =>
    apiRequest<{ quiz: QuizDto; questions: QuizQuestionDto[] }>(
      `/manager/classes/${classId}/quizzes/${quizId}/preview`,
      { signal },
    ),
  create: (classId: number, payload: QuizInputPayload) =>
    apiRequest<{ quiz: QuizDto; questions: QuizQuestionDto[] }>(
      `/manager/classes/${classId}/quizzes`,
      { method: "POST", body: payload },
    ),
  update: (classId: number, quizId: number, payload: QuizInputPayload) =>
    apiRequest<{ quiz: QuizDto; questions: QuizQuestionDto[] }>(
      `/manager/classes/${classId}/quizzes/${quizId}`,
      { method: "PUT", body: payload },
    ),
  publish: (classId: number, quizId: number) =>
    apiRequest<{ quiz: QuizDto }>(`/manager/classes/${classId}/quizzes/${quizId}/publish`, {
      method: "POST",
      body: {},
    }),
  staffAttempts: (
    role: "admin" | "manager",
    classId: number,
    quizId: number,
    params: { page?: number; page_size?: number },
    signal?: AbortSignal,
  ) =>
    apiRequest<Page<StaffAttemptItem>>(
      `/${role}/classes/${classId}/quizzes/${quizId}/attempts${buildQuery({
        page: params.page ?? 1,
        page_size: params.page_size ?? 20,
      })}`,
      { signal },
    ),
  listAttempts: (
    role: "admin" | "manager",
    classId: number,
    quizId: number,
    params: { page?: number; page_size?: number },
    signal?: AbortSignal,
  ) =>
    apiRequest<Page<StaffAttemptItem>>(
      `/${role}/classes/${classId}/quizzes/${quizId}/attempts${buildQuery({
        page: params.page ?? 1,
        page_size: params.page_size ?? 20,
      })}`,
      { signal },
    ),
  grant: (
    classId: number,
    quizId: number,
    payload: {
      enrollment_ids: number[];
      reason: string;
      deadline: string;
      extra_attempts?: number | null;
    },
  ) =>
    apiRequest<{ granted_enrollment_ids: number[]; extra_attempts: number; deadline: string }>(
      `/manager/classes/${classId}/quizzes/${quizId}/grants`,
      { method: "POST", body: payload },
    ),
  grantAttempts: (
    classId: number,
    quizId: number,
    payload: {
      enrollment_ids: number[];
      reason: string;
      deadline: string;
      extra_attempts?: number | null;
    },
  ) =>
    apiRequest<{ granted_enrollment_ids: number[]; extra_attempts: number; deadline: string }>(
      `/manager/classes/${classId}/quizzes/${quizId}/grants`,
      { method: "POST", body: payload },
    ),
  startAttempt: (classId: number, quizId: number, enrollment_id: number, idempotencyKey: string) =>
    apiRequest<AttemptRunnerData>(`/student/classes/${classId}/quizzes/${quizId}/start`, {
      method: "POST",
      body: { enrollment_id },
      idempotencyKey,
    }),
  start: (
    classId: number,
    quizId: number,
    body: { enrollment_id: number },
    idempotencyKey: string,
  ) =>
    apiRequest<AttemptRunnerData>(`/student/classes/${classId}/quizzes/${quizId}/start`, {
      method: "POST",
      body,
      idempotencyKey,
    }),
  getActiveAttempt: (classId: number, quizId: number, signal?: AbortSignal) =>
    apiRequest<AttemptRunnerData>(`/student/classes/${classId}/quizzes/${quizId}/active-attempt`, {
      signal,
    }),
  studentActiveAttempt: (classId: number, quizId: number, signal?: AbortSignal) =>
    apiRequest<AttemptRunnerData>(`/student/classes/${classId}/quizzes/${quizId}/active-attempt`, {
      signal,
    }),
  studentAttempts: (
    classId: number,
    quizId: number,
    params: { page?: number; page_size?: number },
    signal?: AbortSignal,
  ) =>
    apiRequest<Page<AttemptResultData>>(
      `/student/classes/${classId}/quizzes/${quizId}/attempts${buildQuery({
        page: params.page ?? 1,
        page_size: params.page_size ?? 20,
      })}`,
      { signal },
    ),
  getAttempt: (classId: number, attemptId: number, signal?: AbortSignal) =>
    apiRequest<AttemptRunnerData>(`/student/classes/${classId}/quiz-attempts/${attemptId}`, {
      signal,
    }),
  studentAttempt: (classId: number, attemptId: number, signal?: AbortSignal) =>
    apiRequest<AttemptRunnerData>(`/student/classes/${classId}/quiz-attempts/${attemptId}`, {
      signal,
    }),
  saveDraft: (
    classId: number,
    attemptId: number,
    payload: {
      enrollment_id: number;
      expected_revision: number;
      answers: { question_id: number; option_ids: number[] }[];
    },
  ) =>
    apiRequest<{ attempt_id: number; draft_revision: number }>(
      `/student/classes/${classId}/quiz-attempts/${attemptId}/draft`,
      { method: "PUT", body: payload },
    ),
  submitAttempt: (
    classId: number,
    attemptId: number,
    payload: { enrollment_id: number; expected_revision: number },
    idempotencyKey: string,
  ) =>
    apiRequest<AttemptResultData>(
      `/student/classes/${classId}/quiz-attempts/${attemptId}/submit`,
      {
        method: "POST",
        body: payload,
        idempotencyKey,
      },
    ),
  submit: (
    classId: number,
    attemptId: number,
    payload: { enrollment_id: number; expected_revision: number },
    idempotencyKey: string,
  ) =>
    apiRequest<AttemptResultData>(
      `/student/classes/${classId}/quiz-attempts/${attemptId}/submit`,
      {
        method: "POST",
        body: payload,
        idempotencyKey,
      },
    ),
};

export interface MaterialInputPayload {
  title: string;
  description: string;
  material_type: "document" | "video";
  url: string;
  session_id?: number | null;
  expires_at?: string | null;
}

export const materialsApi = {
  list: (
    role: RouteRole,
    classId: number,
    params: {
      search?: string;
      material_type?: "document" | "video";
      session_id?: number;
      page?: number;
      page_size?: number;
    },
    signal?: AbortSignal,
  ) =>
    apiRequest<Page<MaterialDto>>(
      `/${role}/classes/${classId}/materials${buildQuery({
        search: params.search,
        material_type: params.material_type,
        session_id: params.session_id,
        page: params.page ?? 1,
        page_size: params.page_size ?? 20,
      })}`,
      { signal },
    ),
  get: (role: RouteRole, classId: number, materialId: number, signal?: AbortSignal) =>
    apiRequest<{ material: MaterialDto }>(`/${role}/classes/${classId}/materials/${materialId}`, {
      signal,
    }),
  create: (classId: number, payload: MaterialInputPayload) =>
    apiRequest<{ material: MaterialDto }>(`/manager/classes/${classId}/materials`, {
      method: "POST",
      body: payload,
    }),
  update: (classId: number, materialId: number, payload: MaterialInputPayload) =>
    apiRequest<{ material: MaterialDto }>(`/manager/classes/${classId}/materials/${materialId}`, {
      method: "PUT",
      body: payload,
    }),
  remove: (role: "admin" | "manager", classId: number, materialId: number, reason: string) =>
    apiRequest<Record<string, never>>(`/${role}/classes/${classId}/materials/${materialId}`, {
      method: "DELETE",
      body: { reason },
    }),
};
