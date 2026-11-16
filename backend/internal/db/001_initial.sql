-- Approved workflow v2 clean baseline. Never apply over legacy tables.
CREATE TABLE backend_contract (id INTEGER PRIMARY KEY CHECK(id=1), name TEXT NOT NULL CHECK(name='approved-v2'));
INSERT INTO backend_contract VALUES(1,'approved-v2');
CREATE TABLE users (
 id INTEGER PRIMARY KEY, email TEXT NOT NULL COLLATE NOCASE UNIQUE, password_hash TEXT NOT NULL,
 full_name TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('admin','class_manager','student')),
 is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0,1)), token_version INTEGER NOT NULL DEFAULT 0,
 student_id TEXT, school_or_institute TEXT, university_class TEXT, phone_number TEXT, gender TEXT CHECK(gender IN ('male','female','other')),
 status_reason TEXT, created_at TEXT NOT NULL DEFAULT '', updated_at TEXT NOT NULL DEFAULT '',
 CHECK((role='student' AND student_id IS NOT NULL AND length(student_id)=9 AND student_id NOT GLOB '*[^0-9]*' AND school_or_institute IS NOT NULL AND university_class IS NOT NULL AND phone_number IS NOT NULL) OR (role<>'student' AND student_id IS NULL AND school_or_institute IS NULL AND university_class IS NULL AND phone_number IS NULL AND gender IS NULL))
);
CREATE UNIQUE INDEX student_number_unique ON users(student_id) WHERE role='student';
CREATE TABLE user_sessions(id TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), token_version INTEGER NOT NULL, expires_at TEXT NOT NULL, revoked_at TEXT, created_at TEXT NOT NULL);
CREATE INDEX user_sessions_user ON user_sessions(user_id);
CREATE TABLE classes (
 id INTEGER PRIMARY KEY, code TEXT NOT NULL COLLATE NOCASE UNIQUE, name TEXT NOT NULL, description TEXT NOT NULL,
 manager_id INTEGER NOT NULL REFERENCES users(id), capacity INTEGER NOT NULL CHECK(capacity>0),
 end_date TEXT NOT NULL, expires_at TEXT NOT NULL, total_sessions INTEGER CHECK(total_sessions>0),
 min_attendance_percent REAL NOT NULL CHECK(min_attendance_percent BETWEEN 0 AND 100),
 min_quiz_percent REAL NOT NULL CHECK(min_quiz_percent BETWEEN 0 AND 100), created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE audit_log(id INTEGER PRIMARY KEY, actor_id INTEGER NOT NULL REFERENCES users(id), class_id INTEGER REFERENCES classes(id), action TEXT NOT NULL, target_id INTEGER NOT NULL, before_json TEXT NOT NULL, after_json TEXT NOT NULL, reason TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE enrollment_requests(id INTEGER PRIMARY KEY, class_id INTEGER NOT NULL REFERENCES classes(id), student_id INTEGER NOT NULL REFERENCES users(id), reason TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('pending','approved','declined','cancelled')), decision_reason TEXT, decided_by INTEGER REFERENCES users(id), created_at TEXT NOT NULL, decided_at TEXT);
CREATE UNIQUE INDEX request_one_pending ON enrollment_requests(class_id,student_id) WHERE status='pending';
CREATE INDEX request_pair ON enrollment_requests(class_id,student_id,id);
CREATE TABLE class_enrollments(id INTEGER PRIMARY KEY, class_id INTEGER NOT NULL REFERENCES classes(id), student_id INTEGER NOT NULL REFERENCES users(id), cycle_number INTEGER NOT NULL CHECK(cycle_number>0), request_id INTEGER NOT NULL UNIQUE REFERENCES enrollment_requests(id), status TEXT NOT NULL CHECK(status IN ('enrolled','removed')), approved_at TEXT NOT NULL, removed_at TEXT, removal_reason TEXT, UNIQUE(class_id,student_id,cycle_number));
CREATE UNIQUE INDEX enrollment_current ON class_enrollments(class_id,student_id) WHERE status='enrolled';
CREATE TABLE class_sessions(id INTEGER PRIMARY KEY, class_id INTEGER NOT NULL REFERENCES classes(id), session_number INTEGER NOT NULL CHECK(session_number>0), title TEXT NOT NULL, description TEXT NOT NULL, location TEXT NOT NULL, attendance_code TEXT NOT NULL, starts_at TEXT, ends_at TEXT, approved_proposal_id INTEGER, UNIQUE(class_id,session_number));
CREATE TABLE schedule_proposals(id INTEGER PRIMARY KEY, session_id INTEGER NOT NULL REFERENCES class_sessions(id), proposed_by INTEGER NOT NULL REFERENCES users(id), starts_at TEXT NOT NULL, ends_at TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('draft','pending','approved','rejected')), reason TEXT, reviewed_by INTEGER REFERENCES users(id), created_at TEXT NOT NULL, reviewed_at TEXT);
CREATE UNIQUE INDEX schedule_one_open ON schedule_proposals(session_id) WHERE status IN ('draft','pending');
CREATE TABLE attendance(id INTEGER PRIMARY KEY, enrollment_id INTEGER NOT NULL REFERENCES class_enrollments(id), session_id INTEGER NOT NULL REFERENCES class_sessions(id), attended INTEGER NOT NULL DEFAULT 0 CHECK(attended IN (0,1)), wrong_count INTEGER NOT NULL DEFAULT 0 CHECK(wrong_count BETWEEN 0 AND 3), overridden INTEGER NOT NULL DEFAULT 0 CHECK(overridden IN (0,1)), updated_at TEXT NOT NULL, UNIQUE(enrollment_id,session_id));
CREATE TABLE absences(id INTEGER PRIMARY KEY, enrollment_id INTEGER NOT NULL REFERENCES class_enrollments(id), session_id INTEGER NOT NULL REFERENCES class_sessions(id), reason TEXT NOT NULL, created_at TEXT NOT NULL, UNIQUE(enrollment_id,session_id));
CREATE TABLE quizzes(id INTEGER PRIMARY KEY, class_id INTEGER NOT NULL REFERENCES classes(id), title TEXT NOT NULL, description TEXT NOT NULL, quiz_type TEXT NOT NULL CHECK(quiz_type IN ('test','assignment')), duration_seconds INTEGER NOT NULL CHECK(duration_seconds BETWEEN 1 AND 31536000), open_at TEXT NOT NULL, deadline TEXT NOT NULL, pass_score REAL NOT NULL CHECK(pass_score BETWEEN 0 AND 100), attempt_limit INTEGER NOT NULL CHECK(attempt_limit>0), is_published INTEGER NOT NULL DEFAULT 0 CHECK(is_published IN (0,1)), created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE quiz_questions(id INTEGER PRIMARY KEY, quiz_id INTEGER NOT NULL REFERENCES quizzes(id), question_text TEXT NOT NULL, sort_order INTEGER NOT NULL);
CREATE TABLE quiz_options(id INTEGER PRIMARY KEY, question_id INTEGER NOT NULL REFERENCES quiz_questions(id) ON DELETE CASCADE, option_text TEXT NOT NULL, is_correct INTEGER NOT NULL CHECK(is_correct IN (0,1)), sort_order INTEGER NOT NULL);
CREATE TABLE quiz_attempts(id INTEGER PRIMARY KEY, quiz_id INTEGER NOT NULL REFERENCES quizzes(id), student_id INTEGER NOT NULL REFERENCES users(id), enrollment_id INTEGER NOT NULL REFERENCES class_enrollments(id), attempt_number INTEGER NOT NULL, status TEXT NOT NULL CHECK(status IN ('in_progress','submitted')), started_at TEXT NOT NULL, effective_deadline TEXT NOT NULL, effective_cutoff_at TEXT NOT NULL, submitted_at TEXT, time_spent_seconds INTEGER, score REAL, max_score REAL, score_percent REAL, is_passed INTEGER, draft_revision INTEGER NOT NULL DEFAULT 0, answers_json TEXT NOT NULL DEFAULT '{}', UNIQUE(quiz_id,enrollment_id,attempt_number));
CREATE UNIQUE INDEX attempt_one_active ON quiz_attempts(quiz_id,enrollment_id) WHERE status='in_progress';
CREATE INDEX attempt_due ON quiz_attempts(status,effective_cutoff_at);
CREATE TABLE quiz_retake_grants(id INTEGER PRIMARY KEY, quiz_id INTEGER NOT NULL REFERENCES quizzes(id), enrollment_id INTEGER NOT NULL REFERENCES class_enrollments(id), extra_attempts INTEGER NOT NULL CHECK(extra_attempts>0), deadline TEXT NOT NULL, reason TEXT NOT NULL, granted_by INTEGER NOT NULL REFERENCES users(id), created_at TEXT NOT NULL);
CREATE INDEX grant_cycle ON quiz_retake_grants(quiz_id,enrollment_id);
CREATE TABLE idempotency_keys(id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), enrollment_id INTEGER NOT NULL REFERENCES class_enrollments(id), method TEXT NOT NULL, path TEXT NOT NULL, idempotency_key TEXT NOT NULL, request_hash TEXT NOT NULL, response_json TEXT NOT NULL, created_at TEXT NOT NULL, UNIQUE(user_id,method,path,idempotency_key));
CREATE TABLE announcements(id INTEGER PRIMARY KEY, sender_id INTEGER REFERENCES users(id), class_id INTEGER REFERENCES classes(id), title TEXT NOT NULL, content TEXT NOT NULL, automated INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL);
CREATE TABLE announcement_recipients(id INTEGER PRIMARY KEY, announcement_id INTEGER NOT NULL REFERENCES announcements(id), user_id INTEGER NOT NULL REFERENCES users(id), is_read INTEGER NOT NULL DEFAULT 0 CHECK(is_read IN (0,1)), UNIQUE(announcement_id,user_id));
CREATE INDEX inbox_user ON announcement_recipients(user_id,is_read,announcement_id);
CREATE TABLE materials(id INTEGER PRIMARY KEY, class_id INTEGER NOT NULL REFERENCES classes(id), session_id INTEGER REFERENCES class_sessions(id), title TEXT NOT NULL, description TEXT NOT NULL, material_type TEXT NOT NULL CHECK(material_type IN ('document','video')), url TEXT NOT NULL, expires_at TEXT, created_by INTEGER NOT NULL REFERENCES users(id), deleted_at TEXT, deletion_reason TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);