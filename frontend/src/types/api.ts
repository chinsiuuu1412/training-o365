export type BackendRole = "admin" | "class_manager" | "student";
export type RouteRole = "admin" | "manager" | "student";
export type Gender = "male" | "female" | "other";

export interface ApiErrorBody {
  code: string;
  message: string;
  details: Record<string, unknown> | null;
}

export interface ApiEnvelope<T> {
  data: T | null;
  error: ApiErrorBody | null;
}

export interface Page<T> {
  items: T[];
  page: number;
  page_size: number;
  total: number;
}

export interface User {
  id: number;
  email: string;
  full_name: string;
  role: BackendRole;
  is_active: boolean;
  student_id: string | null;
  school_or_institute: string | null;
  university_class: string | null;
  phone_number: string | null;
  gender: Gender | null;
}

export interface AuthSessionData {
  user: User;
  csrf_token: string;
}

export interface ClassSummary {
  id: number;
  code: string;
  name: string;
  end_date: string;
}

export interface ClassDto {
  id: number;
  code: string;
  name: string;
  description: string;
  manager_id: number;
  capacity: number;
  end_date: string;
  expires_at: string;
  total_sessions: number | null;
  min_attendance_percent: number;
  min_quiz_percent: number;
  is_expired: boolean;
  manager: User;
  enrolled_count: number;
  ended_sessions: number;
}

export interface DiscoverClassDto extends ClassDto {
  is_enrolled: boolean;
}

export interface EnrollmentRequest {
  id: number;
  class_id: number;
  student_id: number;
  reason: string;
  status: "pending" | "approved" | "declined" | "cancelled";
  decision_reason: string | null;
  decided_by: number | null;
  created_at: string;
  decided_at: string | null;
}

export interface StaffEnrollmentRequest extends EnrollmentRequest {
  full_name: string;
  student_number: string;
}

export interface Enrollment {
  id: number;
  class_id: number;
  student_id: number;
  cycle_number: number;
  request_id: number;
  status: "enrolled" | "removed";
  approved_at: string;
  removed_at: string | null;
  removal_reason: string | null;
}

export interface Progress {
  enrollment_id: number;
  attendance_count: number;
  total_sessions: number;
  attendance_percent: number;
  passed_quiz_count: number;
  published_quiz_count: number;
  quiz_percent: number;
  ended_sessions: number;
  completed: boolean;
  incomplete_reasons: string[];
}

export interface StaffEnrollmentRow extends Enrollment {
  student: User;
  progress: Progress;
}

export interface EnrollmentProgressRow {
  enrollment: Enrollment;
  progress: Progress;
}

export interface EnrollmentHistoryItem {
  enrollment: Enrollment;
  class: ClassSummary;
  progress: Progress;
}

export interface SessionDto {
  id: number;
  class_id: number;
  session_number: number;
  title: string;
  description: string;
  location: string;
  starts_at: string | null;
  ends_at: string | null;
  approved_proposal_id: number | null;
  attendance_code?: string;
}

export interface PreviewUpcomingSession {
  id: number;
  session_number: number;
  title: string;
  starts_at: string;
  ends_at: string;
}

export interface ProposalDto {
  id: number;
  session_id: number;
  proposed_by: number;
  starts_at: string;
  ends_at: string;
  status: "draft" | "pending" | "approved" | "rejected";
  reason: string | null;
  reviewed_by: number | null;
  created_at: string;
  reviewed_at: string | null;
}

export interface PendingScheduleProposal extends ProposalDto {
  class_id: number;
  session_number: number;
  title: string;
}

export interface AttendanceDto {
  id: number;
  enrollment_id: number;
  session_id: number;
  attended: 0 | 1;
  wrong_count: number;
  overridden: 0 | 1;
  updated_at: string;
}

export interface AttendanceRow extends AttendanceDto {
  student_id: number;
  cycle_number: number;
  enrollment_status: "enrolled" | "removed";
}

export interface AbsenceDto {
  id: number;
  enrollment_id: number;
  session_id: number;
  reason: string;
  created_at: string;
}

export interface StaffAbsenceRow extends AbsenceDto {
  student_id: number;
}

export interface AuditDto {
  id: number;
  actor_id: number;
  class_id: number | null;
  action: "manager_reassignment" | "enrollment_remove" | "attendance_override" | "material_delete" | "account_status" | string;
  target_id: number;
  before_json: string;
  after_json: string;
  reason: string;
  created_at: string;
}

export interface QuizDto {
  id: number;
  class_id: number;
  title: string;
  description: string;
  quiz_type: "test" | "assignment";
  duration_seconds: number;
  open_at: string;
  deadline: string;
  pass_score: number;
  attempt_limit: number;
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

export interface StudentQuizDto extends QuizDto {
  effective_deadline: string;
  allowed_attempts: number;
  used_attempts: number;
  best_score_percent: number | null;
  is_passed: boolean;
}

export interface QuizOptionDto {
  id: number;
  option_text: string;
  sort_order: number;
  is_correct?: boolean;
}

export interface QuizQuestionDto {
  id: number;
  question_text: string;
  sort_order: number;
  question_type: "single_choice";
  points: 1;
  options: QuizOptionDto[];
}

export interface AttemptDto {
  id: number;
  quiz_id: number;
  student_id: number;
  enrollment_id: number;
  attempt_number: number;
  status: "in_progress" | "submitted";
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

export interface AnswerDto {
  question_id: number;
  option_ids: number[];
}

export interface AttemptResultData {
  attempt: AttemptDto;
  answers: AnswerDto[];
  review: null;
}

export interface AttemptRunnerData {
  attempt: AttemptDto;
  quiz?: QuizDto;
  questions?: QuizQuestionDto[];
  answers: AnswerDto[];
  review: null;
}

export interface StaffAttemptItem {
  attempt: AttemptDto;
  answers: AnswerDto[];
}

export interface MaterialDto {
  id: number;
  class_id: number;
  session_id: number | null;
  title: string;
  description: string;
  material_type: "document" | "video";
  url: string;
  expires_at: string | null;
  created_by: number;
  deleted_at: string | null;
  deletion_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface AnnouncementDto {
  id: number;
  sender_id: number | null;
  class_id: number | null;
  title: string;
  content: string;
  automated: 0 | 1;
  created_at: string;
  is_read: 0 | 1;
}

export interface DashboardClassEntry<TClass = ClassDto | ClassSummary> {
  class: TClass;
  enrollments: EnrollmentProgressRow[];
}

export interface AgendaDto {
  upcoming_sessions: SessionDto[];
  quizzes: (QuizDto & { effective_deadline?: string; allowed_attempts?: number })[];
  active_attempts: { attempt: AttemptDto; quiz: QuizDto }[];
  pending_enrollment_requests: number;
}

export interface DashboardDto<TClass = ClassDto | ClassSummary> {
  classes: DashboardClassEntry<TClass>[];
  enrolled_count: number;
  unread_count: number;
  agenda: AgendaDto;
  student_count?: number;
  manager_count?: number;
  pending_schedules?: number;
}

export function roleToRoute(role: BackendRole): RouteRole {
  return role === "class_manager" ? "manager" : role;
}

export function routeToBackendRole(role: string): BackendRole | null {
  if (role === "admin") return "admin";
  if (role === "manager") return "class_manager";
  if (role === "student") return "student";
  return null;
}

export const roleToBackendRole = routeToBackendRole;
export type ClassEnrollmentRosterItem = StaffEnrollmentRow;
export type DashboardClassSummary = DashboardClassEntry;
export type DashboardResponse<TClass = ClassDto | ClassSummary> = DashboardDto<TClass>;
export type AuditLogDto = AuditDto;
export type ScheduleProposalDto = ProposalDto;
export type ProgressDto = Progress;
export type StaffProgressItem = EnrollmentProgressRow;
export type QuizAttemptDto = AttemptDto;
export type QuizRunnerDto = AttemptRunnerData;
export type QuizAttemptResultDto = StaffAttemptItem;
