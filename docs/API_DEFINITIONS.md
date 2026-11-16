# API contract — approved-v2 backend

Current implementation, source-checked 2026-11-15. **94 routes** replace legacy 83-route contract. Prefix remains `/api/v1`; workflow/schema v2 is breaking, not `/api/v2`. Existing `frontend/` and its integration tests still target legacy DTOs/routes; neither is v2-compatible acceptance evidence. No frontend code changed.

Product authority: [approved workflow](new-approved/user-workflow-guideline.md). Runtime sources: `backend/internal/app/{core,auth,accounts,classes,enrollments,sessions,attendance,quizzes,attempts,materials,announcements,dashboards,agenda}.go` and `backend/internal/db/001_initial.sql`. This document describes handlers, not new product permission.

## 1. Wire conventions

- Paths relative to `/api/v1`. Positive safe integer IDs (`1..9007199254740991`); revisions/counters nonnegative unless positive stated. **User.student_id is MSSV string**; request/enrollment/attempt `student_id` is numeric user ID. Staff request lists alias MSSV as `student_number`.
- Success: `{"data":<result>,"error":null}`. Empty result `{}`, not HTTP 204. Tables show success status; default 200. Error: `{"data":null,"error":{"code":"invalid_request","message":"Vui lòng kiểm tra lại thông tin đã nhập.","details":null}}`.
- Every non-GET, including login/logout/DELETE, requires `Content-Type: application/json`, one JSON object and exact `Origin == SITE_ORIGIN`. Send `{}` for empty actions. Unknown JSON fields rejected, including nested questions/options/answers. Body cap 1 MiB (413); bad JSON/type/shape/range normally 400 `invalid_request`. Unknown query keys are not generally rejected.
- Login public; others require active unrevoked `lms_session`. Cookie `HttpOnly; Secure; SameSite=Lax; Path=/`, host-only. Authenticated non-GET requires session-bound `X-CSRF-Token` from login/me. No bearer-token API. Same-origin SPA/proxy supported; separate API origin needs separately approved CORS work.
- Responses `Cache-Control: no-store`. Global 200 in-flight slots; bcrypt 2 slots; saturation 503. Authenticated writes: per-user bucket 1/s, burst 10, 429 `Retry-After: 1`. Login: per-client-IP 5/min, burst 5, 429 `Retry-After: 12`. Bounds, not load certification.
- `Page<T> = {items:T[],page:number,page_size:number,total:number}`. Every Page accepts `page` (default 1, 1..1000000), `page_size` (default 20, 1..100). Empty arrays `[]`, not null. Tables specify order; no unlisted sort contract.
- Times accept RFC3339 with offset/fraction; output normalized UTC RFC3339Nano. Compare parsed instants, not strings. Class `end_date` is `YYYY-MM-DD`: `expires_at` is **next Vietnam midnight**, exclusive. `2026-11-15` becomes `2026-11-15T17:00:00Z`; expired at `now >= expires_at`. No `start_date`.
- `?` means optional input. Null accepted only where stated. Required strings cannot be null. Nonempty names/reasons trim whitespace and count Unicode runes; passwords count UTF-8 bytes. Full PUT payloads replace supported fields, not PATCH. Omitted/null gender or material linkage/expiry clears those fields.
- `/manager` requires `class_manager`, not Admin hierarchy bypass. Manager needs current assignment (otherwise 404). Student content needs current enrolled cycle (otherwise 404). Expired class rejects all class-scoped writes and Student class reads with 403 `class_expired`; Admin/current Manager retain GET history. Preview/request routes waive enrollment, not expiry. Old Student cycles expose summaries through dashboard/history only.

## 2. Input schemas

Route tables reference schemas below. Unlisted fields rejected. Required means present and valid, not merely an allowed key.

| Schema | Exact fields / validation |
|---|---|
| Login | `email:string,password:string`; generic 401 for wrong credentials/inactive account. |
| ChangePassword | `current_password:string,new_password:string`; new 12–72 bytes. |
| CreateUser | `email,full_name,role,password`; role `student\|class_manager`, full_name nonempty <=200 runes, email normalized trim/lowercase <=254 bytes, password 12–72 bytes. Profile keys allowed as below; Student fields conditionally required. |
| UpdateUser | `email,full_name` plus profile keys below; role immutable, no password here. |
| Student profile | Required for Student: `student_id` string `^[0-9]{9}$` (4-digit enrollment year + 5-digit student ID, e.g. `202512345`; preserve leading zeros, unique among Students), `school_or_institute,university_class,phone_number`: nonempty trimmed strings <=200 runes. Phone `^(0\|\+84)(3\|5\|7\|8\|9)[0-9]{8}$`. `gender?:male\|female\|other\|null`; absent means null. Student email ends exactly `@sis.hust.edu.vn` case-insensitively. Staff profile keys absent/null only; output null. |
| UserStatus | `is_active:boolean,reason:string`; reason nonempty <=2000. Manager suspension retains assignments. Admin management disabled. |
| ResetPassword | `new_password:string` 12–72 bytes; manual credential delivery, no email job. |
| ClassInput | `code,name,description,manager_id,capacity,end_date,min_attendance_percent,min_quiz_percent`. Code nonempty <=60 runes, uppercase, unique case-insensitively; name nonempty <=200; description string <=10000 (empty allowed); manager active on create/reassignment; capacity positive integer; thresholds numeric 0..100; date as §1. Optional `reassignment_reason,confirm_reassignment`; changed Manager requires nonempty reason <=2000 and boolean true. No total_sessions input here. |
| FixedSessions | `total_sessions`: positive integer <=10000, set once. |
| Reason | `reason`: nonempty trimmed string <=2000. |
| EnrollmentReview | `decision:approve\|decline,reason?:string`; decline requires Reason. Approve stores empty decision_reason; optional reason ignored. |
| SessionInput | `session_number,title,description,location,attendance_code`; positive session_number <= fixed total, unique per class; title nonempty <=200, description string <=10000, location string <=2000 (empty allowed), code nonempty trimmed <=100. No times here. |
| ScheduleDraft | `starts_at,ends_at`: RFC3339 strings; start strictly future, end strictly after start. |
| ScheduleReview | `decision:approve\|reject,reason?:string`; reject requires Reason; approve stores empty reason. |
| Attend | `enrollment_id` current cycle ID, `code:string`. |
| Absence | `enrollment_id` current cycle ID, `reason` as Reason. |
| Override | `attended:boolean,reason` as Reason; enrollment ID from URL. |
| QuizInput | `title,description,quiz_type,duration_seconds,open_at,deadline,pass_score,questions`; `attempt_limit?:positive integer\|null`. Title nonempty <=200, description string <=10000, quiz_type `test\|assignment`, duration 1..31536000 seconds, open_at < deadline, pass_score numeric 0..100. Test cap defaults 1 and must equal 1; Assignment defaults 10, custom positive integer (not unlimited). Missing/null attempt_limit uses default. |
| Questions | QuizInput questions array 1..500; each `{question_text,options}` only, text nonempty <=10000. Options 2..100, each `{option_text,is_correct:boolean}` only, text nonempty <=10000; exactly one correct. Input IDs/question_type/points/sort_order rejected; server assigns IDs/order and weight 1. |
| Start | `enrollment_id` current cycle ID. Required header `Idempotency-Key`: UUID-form string, 8-4-4-4-12 hex. |
| Draft | `enrollment_id,expected_revision,answers`; revision nonnegative integer. `answers:[{question_id,option_ids:[]\|[optionId]}]`; unique Quiz questions, no duplicate/multiple options, option belongs to question. Replaces entire saved answer set; omitted questions/empty option arrays mean unanswered. No client score/time. |
| Submit | `enrollment_id,expected_revision`; required UUID-form `Idempotency-Key`. **No answers**: submit saved revision only. |
| Grant | `enrollment_ids:[positive IDs],reason,deadline,extra_attempts?:positive integer\|null`; IDs deduped, 1..10000 distinct; reason <=2000. Extra defaults 1; Assignment max 10, Test positive integer. Deadline strictly future and strictly later than each selected cycle effective deadline. Every recipient active Student/current enrolled cycle in class; atomic batch. |
| MaterialInput | `title,description,material_type,url,session_id?,expires_at?`; title nonempty <=200, description string <=10000, type `document\|video`. URL HTTPS, hostname required, no credentials/CR/LF, <=4000 bytes. Optional nullable session_id positive, same class; optional nullable expires_at RFC3339 (no future-only check). |
| AnnouncementInput | `recipient_ids:[positive user IDs],title,content`; IDs deduped, 1..10000 distinct; title nonempty <=200, content nonempty <=20000 runes. All recipients validated atomically. |
| ReadState | `is_read:boolean`; explicit true/false, not toggle. |
| Empty | `{}` only. |

## 3. Output DTOs / nullability

Types describe `data`, not full envelope. SQL row DTOs retain numeric flags where noted; not all 0/1 values become JSON booleans.

- **User** `{id,email,full_name,role,is_active:boolean,student_id,school_or_institute,university_class,phone_number,gender}`. Required Student profile strings, nullable gender; all five null for staff. No password/hash/token_version/status_reason/timestamps.
- **Class** `{id,code,name,description,manager_id,capacity,end_date,expires_at,total_sessions:null|integer,min_attendance_percent,min_quiz_percent,is_expired:boolean,manager:User,enrolled_count,ended_sessions}`. Discovery adds `is_enrolled:boolean`. **ClassSummary** `{id,code,name,end_date}`. Ended counts approved sessions whose ends_at <= now.
- **EnrollmentRequest** raw row `{id,class_id,student_id,reason,status,decision_reason:null|string,decided_by:null|ID,created_at,decided_at:null|string}`; status `pending|approved|declined|cancelled`. Staff list adds `full_name,student_number` (MSSV). Cancel sets decided_at, not decided_by/decision_reason.
- **Enrollment** raw row `{id,class_id,student_id,cycle_number,request_id,status,approved_at,removed_at:null|string,removal_reason:null|string}`; status `enrolled|removed`. Staff roster adds `student:User,progress:Progress`. History item `{enrollment:Enrollment,class:ClassSummary,progress:Progress}`.
- **Session** `{id,class_id,session_number,title,description,location,starts_at:null|string,ends_at:null|string,approved_proposal_id:null|ID}`. Staff adds `attendance_code:string`; Student/agenda never receive code. Staff detail adds sibling `proposals:Proposal[]`. Student sees approved sessions only. Preview upcoming reduced to `{id,session_number,title,starts_at,ends_at}` with ends_at > now.
- **Proposal** raw row `{id,session_id,proposed_by,starts_at,ends_at,status,reason:null|string,reviewed_by:null|ID,created_at,reviewed_at:null|string}`; status `draft|pending|approved|rejected`. Global pending list adds `class_id,session_number,title`.
- **Attendance** raw row `{id,enrollment_id,session_id,attended:0|1,wrong_count:0..3,overridden:0|1,updated_at}`. List adds `student_id,cycle_number,enrollment_status`. Check-in `{attendance:Attendance,authoritative_override?:true}`; override `{attendance:Attendance}`.
- **Absence** raw row `{id,enrollment_id,session_id,reason,created_at}`. Creation `{absence:Absence,status:"approved"}`; staff list adds numeric student_id. No credit implied.
- **Audit** raw row `{id,actor_id,class_id:null|ID,action,target_id,before_json:string,after_json:string,reason,created_at}`. before/after are JSON-encoded strings, not expanded objects; embedded attendance attended/overridden values boolean. Class actions: manager_reassignment, enrollment_remove, attendance_override, material_delete. account_status has null class_id, no global audit-list route.
- **Quiz** `{id,class_id,title,description,quiz_type,duration_seconds,open_at,deadline,pass_score,attempt_limit,is_published:boolean,created_at,updated_at}`. Student list adds `effective_deadline,allowed_attempts,used_attempts,best_score_percent:null|number,is_passed:boolean` for current cycle. Student detail only `{quiz:Quiz}`, no questions. Staff definition/create/update/preview `{quiz:Quiz,questions:Question[]}`.
- **Question** `{id,question_text,sort_order,question_type:"single_choice",points:1,options:Option[]}`; **Option** `{id,option_text,sort_order}`; staff only adds `is_correct:boolean`. No Student answer key after submission either.
- **Attempt** `{id,quiz_id,student_id,enrollment_id,attempt_number,status,started_at,effective_deadline,effective_cutoff_at,submitted_at,time_spent_seconds,score,max_score,score_percent,is_passed,draft_revision}`; status `in_progress|submitted`. Until submitted: submitted_at/time_spent_seconds/score/max_score/score_percent/is_passed null. Submitted is_passed boolean, time_spent_seconds integer, scores numeric. No answers_json.
- **Answer[]** `[{question_id,option_ids:[optionId]}]`, numeric question-ID order; unanswered omitted. **Result** `{attempt:Attempt,answers:Answer[],review:null}`. In-progress **Runner** adds `quiz:Quiz,questions:Question[]` without correctness; submitted Runner equals Result (quiz/questions absent). **StaffAttempt** `{attempt:Attempt,answers:Answer[]}`, no review key.
- **Progress** `{enrollment_id,attendance_count,total_sessions,attendance_percent,passed_quiz_count,published_quiz_count,quiz_percent,ended_sessions,completed:boolean,incomplete_reasons:string[]}`. Unset total_sessions represented as 0 here, not null. Reasons: `total_sessions_not_set`, `required_sessions_not_ended`, `attendance_below_threshold`, `quiz_below_threshold`.
- **Material** raw row `{id,class_id,session_id:null|ID,title,description,material_type,url,expires_at:null|string,created_by,deleted_at:null|string,deletion_reason:null|string,created_at,updated_at}`. Staff sees removed/expired metadata; Student list excludes removed/material-expired; detail denies them.
- **Announcement** `{id,sender_id:null|ID,class_id:null|ID,title,content,automated:0|1,created_at,is_read:0|1}`. Automated sender null; manual class_id null. GET detail does not mark read. Intended recipient only; sender has no sent-box route.
- **Dashboard** (not paged) `{classes:[{class,enrollments:[{enrollment,progress}]}],enrolled_count,unread_count,agenda}`. Class is Class for staff, ClassSummary for Student, including removed/expired history; Student enrollments own only, staff all authorized cycles. Admin adds `student_count,manager_count,pending_schedules`; counts include inactive users. enrolled_count counts enrolled rows including expired classes, not active agenda only.
- **Agenda** `{upcoming_sessions:Session[],quizzes:Quiz[],active_attempts:[{attempt:Attempt,quiz:Quiz}],pending_enrollment_requests}`: unexpired classes only; Student current enrollment only. Student Quiz entries add effective_deadline/allowed_attempts. Sessions end > now, start ascending; published Quizzes deadline (effective for Student) > now, deadline ascending, may include not-yet-open Quizzes. Student pending count 0; active_attempts only populated for Student (not Assignment-only). No timetable-range endpoint.

## 4. Complete route inventory

Results refer to DTOs above; Page wraps items. All Page routes accept pagination. **Shared 7 + Admin 29 + Manager 33 + Student 25 = 94.**

### Shared — 7

| Method | Path | Input / query | data / status |
|---|---|---|---|
| POST | `/auth/login` | Login; public | `{user:User,csrf_token}`; sets cookie |
| GET | `/auth/me` | authenticated | `{user:User,csrf_token}` |
| POST | `/auth/logout` | Empty | `{}`; revokes current session, expires cookie |
| POST | `/auth/change-password` | ChangePassword | `{}`; revokes all own sessions, expires cookie |
| GET | `/announcements` | `is_read=true\|false` | Page<Announcement>, ID descending |
| GET | `/announcements/{id}` | own recipient | `{announcement:Announcement}` |
| PATCH | `/announcements/{id}/read` | ReadState | `{}` |

### Admin — 29

| Method | Path | Input / query | data / status |
|---|---|---|---|
| GET | `/admin/users` | `search` name/email/MSSV; `role=student\|class_manager`; `is_active=true\|false` | Page<User>, ID ascending; excludes Admin |
| POST | `/admin/users` | CreateUser | `{user:User}`; 201 |
| PUT | `/admin/users/{id}` | UpdateUser | `{user:User}`; email change revokes sessions |
| PATCH | `/admin/users/{id}/status` | UserStatus | `{user:User}`; actual status change revokes sessions |
| POST | `/admin/users/{id}/reset-password` | ResetPassword | `{}`; revokes sessions |
| GET | `/admin/classes` | `search` name/code/Manager name | Page<Class>, ID ascending |
| GET | `/admin/classes/{classId}` | — | `{class:Class}` |
| POST | `/admin/classes` | ClassInput | `{class:Class}`; 201 |
| PUT | `/admin/classes/{classId}` | ClassInput | `{class:Class}` |
| GET | `/admin/classes/{classId}/enrollment-requests` | — | Page<staff EnrollmentRequest>, ID descending |
| GET | `/admin/classes/{classId}/enrollments` | — | Page<Enrollment + student + progress>, ID descending |
| POST | `/admin/classes/{classId}/enrollments/{enrollmentId}/remove` | Reason | `{}` |
| GET | `/admin/classes/{classId}/sessions` | — | Page<staff Session>, session_number ascending |
| GET | `/admin/classes/{classId}/sessions/{sessionId}` | — | `{session:staff Session,proposals:Proposal[]}`; proposals ID descending |
| GET | `/admin/schedule-proposals` | pending only | Page<Proposal + class_id/session_number/title>, ID ascending |
| POST | `/admin/classes/{classId}/sessions/{sessionId}/schedule-proposals/{proposalId}/review` | ScheduleReview | `{session:staff Session,proposal:Proposal}` |
| GET | `/admin/classes/{classId}/quizzes` | — | Page<Quiz>, ID ascending |
| GET | `/admin/classes/{classId}/quizzes/{quizId}` | — | `{quiz:Quiz,questions:staff Question[]}` |
| GET | `/admin/classes/{classId}/quizzes/{quizId}/attempts` | — | Page<StaffAttempt>, enrollment_id then attempt_number ascending |
| GET | `/admin/classes/{classId}/attendance` | — | Page<Attendance + student_id/cycle_number/enrollment_status>, attendance ID ascending |
| GET | `/admin/classes/{classId}/audit` | — | Page<Audit>, ID descending |
| GET | `/admin/classes/{classId}/absences` | — | Page<Absence + student_id>, ID descending |
| GET | `/admin/classes/{classId}/materials` | `search`, `material_type=document\|video`, `session_id` positive <=1000000000 | Page<Material>, ID ascending; includes removed/expired |
| GET | `/admin/classes/{classId}/materials/{materialId}` | — | `{material:Material}` |
| DELETE | `/admin/classes/{classId}/materials/{materialId}` | Reason JSON required | `{}`; soft removal, audit, notify Manager |
| GET | `/admin/dashboard` | — | Dashboard |
| GET | `/admin/classes/{classId}/progress` | — | Page<{enrollment:Enrollment,progress:Progress}>, enrollment ID ascending |
| GET | `/admin/recipients` | active Students/Managers only | Page<User>, ID ascending |
| POST | `/admin/announcements` | AnnouncementInput | `{announcement_id,recipient_count}`; 201 |

Admin has no enrollment approval, teaching creation, attendance override or Quiz result mutation route.

### Manager (`class_manager`) — 33

| Method | Path | Input / query | data / status |
|---|---|---|---|
| GET | `/manager/classes` | `search` name/code/Manager name | Page<Class>, ID ascending, current assignments |
| GET | `/manager/classes/{classId}` | — | `{class:Class}` |
| PUT | `/manager/classes/{classId}/total-sessions` | FixedSessions | `{class:Class}` |
| GET | `/manager/classes/{classId}/enrollment-requests` | — | Page<staff EnrollmentRequest>, ID descending |
| GET | `/manager/classes/{classId}/enrollments` | — | Page<Enrollment + student + progress>, ID descending |
| POST | `/manager/classes/{classId}/enrollments/{enrollmentId}/remove` | Reason | `{}` |
| POST | `/manager/classes/{classId}/enrollment-requests/{requestId}/review` | EnrollmentReview | `{request:EnrollmentRequest}` |
| GET | `/manager/classes/{classId}/sessions` | — | Page<staff Session>, session_number ascending |
| GET | `/manager/classes/{classId}/sessions/{sessionId}` | — | `{session:staff Session,proposals:Proposal[]}`; proposals ID descending |
| POST | `/manager/classes/{classId}/sessions` | SessionInput | `{session:staff Session}`; 201 |
| PUT | `/manager/classes/{classId}/sessions/{sessionId}/schedule-draft` | ScheduleDraft | `{proposal:Proposal}` |
| POST | `/manager/classes/{classId}/sessions/{sessionId}/schedule-proposals/{proposalId}/submit` | Empty | `{proposal:Proposal}` |
| GET | `/manager/classes/{classId}/quizzes` | — | Page<Quiz>, ID ascending |
| GET | `/manager/classes/{classId}/quizzes/{quizId}` | — | `{quiz:Quiz,questions:staff Question[]}` |
| GET | `/manager/classes/{classId}/quizzes/{quizId}/attempts` | — | Page<StaffAttempt>, enrollment_id then attempt_number ascending |
| POST | `/manager/classes/{classId}/quizzes` | QuizInput | `{quiz:Quiz,questions:staff Question[]}`; 201 |
| PUT | `/manager/classes/{classId}/quizzes/{quizId}` | QuizInput | `{quiz:Quiz,questions:staff Question[]}` |
| GET | `/manager/classes/{classId}/quizzes/{quizId}/preview` | — | `{quiz:Quiz,questions:staff Question[]}` |
| POST | `/manager/classes/{classId}/quizzes/{quizId}/publish` | Empty | `{quiz:Quiz}` |
| POST | `/manager/classes/{classId}/quizzes/{quizId}/grants` | Grant | `{granted_enrollment_ids:ID[],extra_attempts,deadline}`; 201 |
| GET | `/manager/classes/{classId}/attendance` | — | Page<Attendance + student_id/cycle_number/enrollment_status>, ID ascending |
| POST | `/manager/classes/{classId}/sessions/{sessionId}/attendance/{enrollmentId}/override` | Override | `{attendance:Attendance}` |
| GET | `/manager/classes/{classId}/audit` | — | Page<Audit>, ID descending |
| GET | `/manager/classes/{classId}/absences` | — | Page<Absence + student_id>, ID descending |
| GET | `/manager/classes/{classId}/materials` | `search`, `material_type=document\|video`, `session_id` positive <=1000000000 | Page<Material>, ID ascending; includes removed/expired |
| GET | `/manager/classes/{classId}/materials/{materialId}` | — | `{material:Material}` |
| DELETE | `/manager/classes/{classId}/materials/{materialId}` | Reason JSON required | `{}`; soft removal and audit |
| POST | `/manager/classes/{classId}/materials` | MaterialInput | `{material:Material}`; 201 |
| PUT | `/manager/classes/{classId}/materials/{materialId}` | MaterialInput | `{material:Material}` |
| GET | `/manager/dashboard` | — | Dashboard |
| GET | `/manager/classes/{classId}/progress` | — | Page<{enrollment:Enrollment,progress:Progress}>, enrollment ID ascending |
| GET | `/manager/recipients` | active Students enrolled in active assigned classes | Page<User>, ID ascending |
| POST | `/manager/announcements` | AnnouncementInput; permitted Students only | `{announcement_id,recipient_count}`; 201 |

### Student — 25

| Method | Path | Input / query | data / status |
|---|---|---|---|
| GET | `/student/classes` | `search` name/code/Manager name | Page<Class>, ID ascending; enrolled + unexpired only |
| GET | `/student/classes/{classId}` | — | `{class:Class}` |
| GET | `/student/discover/classes` | `search` name/code/Manager name | Page<Class + is_enrolled>, ID ascending; unexpired, full classes still visible |
| GET | `/student/classes/{classId}/preview` | no enrollment required | `{class:Class,upcoming_sessions:reduced Session[]}`; session_number ascending |
| POST | `/student/classes/{classId}/enrollment-requests` | Reason | `{request:EnrollmentRequest}`; 201 |
| GET | `/student/enrollment-requests` | own requests, all states | Page<EnrollmentRequest>, ID descending |
| POST | `/student/classes/{classId}/enrollment-requests/{requestId}/cancel` | Empty | `{}` |
| GET | `/student/enrollment-history` | own cycles, including removed/expired | Page<{enrollment:Enrollment,class:ClassSummary,progress:Progress}>, ID descending |
| GET | `/student/classes/{classId}/sessions` | approved only | Page<Session>, session_number ascending |
| GET | `/student/classes/{classId}/sessions/{sessionId}` | approved only | `{session:Session}` |
| GET | `/student/classes/{classId}/quizzes` | published only | Page<Quiz + current-cycle allowance/best/pass>, ID ascending |
| GET | `/student/classes/{classId}/quizzes/{quizId}` | published only | `{quiz:Quiz}` |
| POST | `/student/classes/{classId}/quizzes/{quizId}/start` | Start + Idempotency-Key | Runner; 200 even for new attempt |
| GET | `/student/classes/{classId}/quizzes/{quizId}/active-attempt` | current cycle | Runner; 404 without in-progress attempt |
| GET | `/student/classes/{classId}/quizzes/{quizId}/attempts` | current cycle | Page<Result>, attempt_number descending |
| GET | `/student/classes/{classId}/quiz-attempts/{attemptId}` | own current cycle | Runner |
| PUT | `/student/classes/{classId}/quiz-attempts/{attemptId}/draft` | Draft | `{attempt_id,draft_revision}` |
| POST | `/student/classes/{classId}/quiz-attempts/{attemptId}/submit` | Submit + Idempotency-Key | Result |
| GET | `/student/classes/{classId}/attendance` | current cycle only | Page<Attendance + student_id/cycle_number/enrollment_status>, ID ascending |
| POST | `/student/classes/{classId}/sessions/{sessionId}/attend` | Attend | `{attendance,authoritative_override?:true}` |
| POST | `/student/classes/{classId}/sessions/{sessionId}/absence` | Absence | `{absence:Absence,status:"approved"}`; 201 |
| GET | `/student/classes/{classId}/materials` | `search`, `material_type=document\|video`, `session_id` positive <=1000000000 | Page<Material>, ID ascending; permitted items only |
| GET | `/student/classes/{classId}/materials/{materialId}` | — | `{material:Material}` |
| GET | `/student/dashboard` | includes own historical summaries | Dashboard |
| GET | `/student/classes/{classId}/progress` | current cycle | `{progress:Progress}`, not Page |

## 5. State, time and retry rules

### Enrollment / class authority

Requests do not reserve seats. Create/approve recheck capacity inside serialized writer transaction. Pending duplicates rejected. Cancel only own pending request; no decline increment/new cooldown, but prior decline count/cooldown persists. Three **lifetime Student–class pair declines** stop requests. After decline wait 10 minutes (`now >= decided_at + 10m`); new reason differs from last declined request's **Student reason**, not Manager decision_reason. Only current Manager reviews. Approval creates new enrollment ID and incremented cycle_number, never reuses academic rows. Removal preserves results and requires reason. Student attendance/absence/start/draft/submit bind current enrollment_id; old grants/attempts never carry into new cycle. Reassignment immediately changes class/pending-request authority.

### Schedule / attendance

One draft/pending proposal per session. Draft PUT updates existing draft or creates one; pending blocks editing. Submit draft only; Admin reviews pending only. Approval must still be future. Existing approved session at/after start blocks all schedule changes. Pending/rejected proposals never replace approved times. No Teacher-confirm, direct Admin edit or overlap-validation promise.

Code window `[starts_at,ends_at)` on approved session. One credit per cycle/session. Wrong code commits durable wrong_count despite **422**, with `details:{remaining_attempts:2|1|0}`. Fourth try 409 attendance_locked. Reload cannot reset count. Manager override requires approved session at/after start, enrolled cycle, active class, reason; attended true/false authoritative. Later code within window returns stored attendance with authoritative_override true, cannot undo override. Attendance flags numeric; audit embedded flags boolean. Absence before approved session end autoapproves/notifies Manager, no credit; already attended/duplicate rejected. No Student absence-list route or Admin attendance mutation.

### Quiz saved-revision / cutoff / idempotency

Starting consumes one attempt; one in-progress attempt per Quiz/cycle. Another start returns active attempt, not parallel credit. Freeze all Quiz PUT configuration/questions after **any** attempt, including old cycles. Publish replay no-op after first publish; no delete/unpublish/metadata route.

Cutoff captured at start: `min(started_at + duration_seconds,effective_deadline)`. Effective deadline is max(base deadline, cycle grant deadlines); allowance is base cap + sum extra attempts. Grant never changes active cutoff or old scores. Continuous server clock; no pause on offline/blur/reload. Draft must reach authorized transaction execution strictly before cutoff; sending headers before cutoff is insufficient. Full body decoding precedes writer acquisition; one transaction clock governs scope/finalization/action. At cutoff saved answers auto-grade, no grace period or late answers. Startup, 1-second worker (up to 100 per scan), relevant reads/writes finalize due work even after Student suspension/removal/class expiry. Request-action savepoint rollback preserves already-due grading.

Draft compare-and-swap expected_revision increments on success. Conflict needs refetch and deliberate reconciliation. Save full answers, await successful revision, then submit that revision. Assignment may submit anytime. Test manual submit requires elapsed × 3 >= configured duration × 2, exact time rather than rounded seconds. Auto-submit can happen before 2/3 if deadline cutoff earlier. Submitted attempts return existing result; no regrade/key. Higher best submitted score survives lower later scores.

Only start/submit use Idempotency-Key. Scope `(user_id,method,path,key)`, body fingerprint, **permanent cycle binding**; no 24h cleanup. Different body same key: 409 idempotency_key_reused; reused path/key in new cycle: 409 stale_idempotency_key. Start stores identity and rebuilds current Runner; replay after finalization returns Result, not stale questions. Submit replays stored Result. Current auth/scope checked **before** replay, no access-loss bypass. Draft revisioned, not key-idempotent. Other writes lack general replay guarantee; inspect state after uncertain response, especially grants/announcements.

### Progress / history

Attendance % = valid credited approved sessions in cycle / fixed total_sessions × 100. Quiz % = distinct passed published Quizzes in cycle / all published class Quizzes × 100. Zero denominators give 0; no average/required_quiz_ids/video score. Completed requires fixed positive total, every required session approved and ended (`ended_sessions == total_sessions`), and both **unrounded** percentages >= thresholds. No certificate/seal/exception workflow. Recomputed dynamically, may revert. Zero Quiz denominator can satisfy 0 threshold, not positive threshold. Old-cycle Student summaries via dashboard/history do not grant old attempt/content access. Current assignment controls staff history.

### Library / inbox

HTTPS links only. Material expiry at now >= expires_at, except Video hosts `youtube.com`, `www.youtube.com`, `m.youtube.com`, `youtu.be`, `www.youtube-nocookie.com` exempt **material** expiry. Never exempt class expiry/enrollment/removal. No upload, signed URL, photo, watch credit, heartbeat or provider API call. Known external links cannot be revoked by LMS. Manager and Admin DELETE both require JSON reason, soft-remove and audit; Admin additionally notifies Manager.

Admin sends only active Students/Managers. Manager sends active Students currently enrolled in unexpired assigned classes. Explicit recipient_ids, no class_ids/broadcast shorthand; select-all must expand every directory page. Any invalid recipient fails whole batch; dedup count returned. Inbox persisted in DB with transactional workflow notices. GET does not mark read; PATCH false restores unread. SMTP/email absent, not a 503 prerequisite.

## 6. Error reference

Codes below from handlers. Details null except wrong-code counter. Earlier auth/scope/body checks can determine error before domain check; not every stale URL yields same code.

| HTTP | Codes / cases |
|---|---|
| 400 | `invalid_request`: malformed/unknown fields, types/ranges/enums, missing values, UUID/time/profile/Quiz validation, same-class material binding |
| 401 | `unauthenticated`: missing/expired/revoked/tampered session, login failure, changed credentials |
| 403 | `forbidden`: role/Origin/CSRF; `admin_management_disabled`; `class_expired`; `material_expired` (also removed material detail) |
| 404 | `not_found`: missing/scoped-away row, other Manager class, no current enrollment, old-cycle attempt, unpublished Quiz, unapproved Student session, no active attempt, removed material mutation, removed route |
| 409 | `duplicate_email`, `duplicate_student_id`, `duplicate_code`, `capacity_below_enrolled`, `total_sessions_fixed`; `already_enrolled`, `request_pending`, `decline_limit`, `decline_cooldown`, `class_full`, `request_processed`, `student_inactive`, `stale_enrollment`; `session_started`, `session_exists`, `schedule_pending`, `proposal_processed`, `schedule_in_past`, `session_not_approved`, `attendance_closed`, `attendance_locked`, `session_ended`, `already_attended`, `absence_exists`, `session_not_started`; `quiz_frozen`, `quiz_not_available`, `attempt_limit_reached`, `draft_revision_conflict`, `attempt_already_submitted`, `stale_idempotency_key`, `idempotency_key_reused` |
| 410 | `attempt_expired`: draft at/after cutoff; saved result still finalizes |
| 413 | `payload_too_large` |
| 422 | `email_domain_required`, `invalid_current_password`, `new_reason_required`, `wrong_attendance_code` (counter commits), `invalid_answers`, `early_submission`, `deadline_not_extended`, `invalid_recipients` |
| 429 | `rate_limited`; Retry-After per §1 |
| 500 | `internal_error`: unexpected panic/DB failure; no retry-safety promise |
| 503 | `temporarily_unavailable`: in-flight/password slots saturated, not missing mail/storage configuration |

## 7. Representative requests

Non-login examples require cookie, Origin, JSON Content-Type and X-CSRF-Token. IDs synthetic; require matching authorized fixtures. Times assume class unexpired and future/time-window rules satisfied.

Student creation, `POST /admin/users` (201):
```json
{"email":"student001@sis.hust.edu.vn","full_name":"Nguyễn An","role":"student","password":"synthetic-only-password","student_id":"202512345","school_or_institute":"Trường CNTT và Truyền thông","university_class":"K71","phone_number":"0912345678","gender":null}
```

Request, cancel, approve/decline (distinct pending requests for each decision):
```http
POST /api/v1/student/classes/1/enrollment-requests
{"reason":"Em muốn học Word và Excel."}

POST /api/v1/student/classes/1/enrollment-requests/7/cancel
{}

POST /api/v1/manager/classes/1/enrollment-requests/8/review
{"decision":"approve"}

POST /api/v1/manager/classes/1/enrollment-requests/9/review
{"decision":"decline","reason":"Vui lòng bổ sung mục tiêu học tập."}
```
Create data `{request:{...status:"pending",decision_reason:null,decided_by:null,decided_at:null...}}`; cancel data `{}`; review returns updated request. Obtain enrollment cycle ID from roster or Student history/dashboard, **not request ID**.

Schedule draft, submit, reject; use returned proposal ID:
```http
PUT /api/v1/manager/classes/1/sessions/2/schedule-draft
{"starts_at":"2026-12-01T18:00:00+07:00","ends_at":"2026-12-01T20:00:00+07:00"}

POST /api/v1/manager/classes/1/sessions/2/schedule-proposals/3/submit
{}

POST /api/v1/admin/classes/1/sessions/2/schedule-proposals/3/review
{"decision":"reject","reason":"Đổi sang giờ phòng học còn trống."}
```

Attendance: send `{"enrollment_id":12,"code":"wrong"}` to `POST /student/classes/1/sessions/2/attend` in open window three times. Each 422 commits counter; third response:
```json
{"data":null,"error":{"code":"wrong_attendance_code","message":"Mã điểm danh không đúng.","details":{"remaining_attempts":0}}}
```
Manager verifies and overrides locked row:
```http
POST /api/v1/manager/classes/1/sessions/2/attendance/12/override
{"attended":true,"reason":"Đã xác minh học viên có mặt."}
```
Data contains Attendance with `attended:1,wrong_count:3,overridden:1`. No Admin approval. Absence instead uses `{"enrollment_id":12,"reason":"Em có lịch khám bệnh."}` on `/student/classes/1/sessions/2/absence` before end, only if not credited.

Quiz creation, `POST /manager/classes/1/quizzes` (201), then publish `{}`:
```json
{"title":"Ôn tập Word","description":"Chọn một đáp án.","quiz_type":"assignment","duration_seconds":600,"open_at":"2026-12-01T08:00:00+07:00","deadline":"2026-12-02T20:00:00+07:00","pass_score":60,"attempt_limit":10,"questions":[{"question_text":"Phím tắt lưu tài liệu?","options":[{"option_text":"Ctrl+S","is_correct":true},{"option_text":"Ctrl+P","is_correct":false}]}]}
```
Use returned question/option IDs, not authored indices. Saved-revision sequence:
```http
POST /api/v1/student/classes/1/quizzes/4/start
Idempotency-Key: 00000000-0000-4000-8000-000000000001
{"enrollment_id":12}

PUT /api/v1/student/classes/1/quiz-attempts/5/draft
{"enrollment_id":12,"expected_revision":0,"answers":[{"question_id":6,"option_ids":[10]}]}

POST /api/v1/student/classes/1/quiz-attempts/5/submit
Idempotency-Key: 00000000-0000-4000-8000-000000000002
{"enrollment_id":12,"expected_revision":1}
```
Draft success data `{attempt_id:5,draft_revision:1}`; submit data Result with `review:null`. On draft_revision_conflict refetch, never append answers to submit. Test waits 2/3 unless cutoff already auto-submitted.

Single/bulk grant same endpoint, one ID for single:
```http
POST /api/v1/manager/classes/1/quizzes/4/grants
{"enrollment_ids":[12,13],"reason":"Bổ sung lượt ôn tập.","deadline":"2026-12-05T20:00:00+07:00","extra_attempts":2}
```
201 data `{granted_enrollment_ids:[12,13],extra_attempts:2,deadline:"2026-12-05T13:00:00Z"}` only if both effective deadlines earlier; otherwise whole batch rolls back. Retry with later deadline can grant again; inspect state after uncertain response.

Material create/remove and inbox read/unread:
```http
POST /api/v1/manager/classes/1/materials
{"title":"Tài liệu Word","description":"Tài liệu tham khảo","material_type":"document","url":"https://example.edu.vn/word.pdf","session_id":2,"expires_at":null}

DELETE /api/v1/admin/classes/1/materials/3
{"reason":"Link không còn phù hợp."}

POST /api/v1/manager/announcements
{"recipient_ids":[20,21,20],"title":"Nhắc lịch học","content":"Kiểm tra lịch đã duyệt trong lớp."}

PATCH /api/v1/announcements/9/read
{"is_read":true}

PATCH /api/v1/announcements/9/read
{"is_read":false}
```
Announcement recipient_count 2 if both permitted. Read PATCH data `{}`; inspect own `/announcements?is_read=false` or dashboard unread_count.

## 8. Verification / handoff

Executed docs-phase: `go test ./internal/app -run '^TestV2RouteSurfaceAndStrictBoundaries$' -count=1 -v`, offline module settings; passed, logged **94** registered routes (app 0.707s). Source-loop-expanded method/path inventory compared against all 94 table rows. DTO/body/error review grounded in handlers/schema, not checkpoint alone. [Task state](task-state.md) records comparisons.

Prior implementation-agent results, not rerun here: `go test ./... -count=1` app 17.284s/config 0.623s/DB 1.293s; vet/build passed; modules verified. Race unavailable with CGO disabled. No performance, race, live-service or frontend/browser certification; no production operations.

[Architecture](ARCHITECTURE.md) · [Features](FEATURES.md) · [Operator setup](DEPLOYMENT.md) · [Frontend handoff](FRONTEND_SURFACE_CONTRACT.md)
