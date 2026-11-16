# API Request & Response Examples — Approved-v2 Backend

Source-checked against `backend/internal/app/*.go` and `backend/internal/db/001_initial.sql`. Covers all **94** registered routes (`7` Shared + `29` Admin + `33` Manager + `25` Student) under `/api/v1`.

## Common Conventions & Required Headers

- **Base prefix:** `/api/v1`
- **Success envelope:** `{"data": <payload>, "error": null}` (empty actions return `data: {}`, never `204`).
- **Error envelope:** `{"data": null, "error": {"code": "<error_code>", "message": "<vietnamese_message>", "details": null | <object>}}`.
- **Pagination query params (all `Page` endpoints):** `?page=1&page_size=20` (`page` `1..1000000`, `page_size` `1..100`).
- **Required headers by request type:**
  - **Authenticated `GET`:** `Cookie: lms_session=<jwt>`
  - **`POST /api/v1/auth/login`:** `Content-Type: application/json`, `Origin: <SITE_ORIGIN>`
  - **All other `POST`/`PUT`/`PATCH`/`DELETE`:** `Cookie: lms_session=<jwt>`, `Content-Type: application/json`, `Origin: <SITE_ORIGIN>`, `X-CSRF-Token: <csrf_token>`
  - **Quiz `start` and `submit`:** also require `Idempotency-Key: <uuid>` (format `8-4-4-4-12` hex).
- **Important type notes from handlers:**
  - `user.student_id` is a 9-digit MSSV string (`"202512345"`), while `enrollment_requests.student_id`, `class_enrollments.student_id`, `quiz_attempts.student_id`, `attendance.student_id`, and `absences.student_id` are numeric `users.id` values.
  - `attendance.attended`, `attendance.overridden`, `announcements.automated`, and `announcement_recipients.is_read` are returned as `0` or `1` integers (raw SQLite columns), whereas `user.is_active`, `class.is_expired`, `quiz.is_published`, `option.is_correct`, `attempt.is_passed` (when submitted), and `progress.completed` are JSON booleans.
  - `audit_log.before_json` and `audit_log.after_json` are JSON-encoded strings, not nested JSON objects.

---

## 0. Error Envelope Examples

```json
// 400 invalid_request (bad JSON, unknown fields, validation failure)
{"data":null,"error":{"code":"invalid_request","message":"Vui lòng kiểm tra lại thông tin đã nhập.","details":null}}

// 401 unauthenticated (missing/expired/revoked session or bad login credentials)
{"data":null,"error":{"code":"unauthenticated","message":"Vui lòng đăng nhập.","details":null}}

// 403 forbidden (wrong role, wrong Origin, invalid X-CSRF-Token)
{"data":null,"error":{"code":"forbidden","message":"Nguồn yêu cầu không hợp lệ.","details":null}}

// 403 class_expired
{"data":null,"error":{"code":"class_expired","message":"Lớp học đã hết hạn.","details":null}}

// 404 not_found
{"data":null,"error":{"code":"not_found","message":"Không tìm thấy dữ liệu.","details":null}}

// 409 conflict (e.g., duplicate_student_id, quiz_frozen, draft_revision_conflict)
{"data":null,"error":{"code":"duplicate_student_id","message":"MSSV đã được sử dụng.","details":null}}

// 410 attempt_expired
{"data":null,"error":{"code":"attempt_expired","message":"Bài đã hết thời gian.","details":null}}

// 422 wrong_attendance_code (only error with non-null details)
{"data":null,"error":{"code":"wrong_attendance_code","message":"Mã điểm danh không đúng.","details":{"remaining_attempts":2}}}

// 429 rate_limited (with Retry-After: 12 on login, Retry-After: 1 on writes)
{"data":null,"error":{"code":"rate_limited","message":"Thao tác quá nhanh. Vui lòng thử lại.","details":null}}
```

---

## 1. Shared Routes (7)

### 1.1 `POST /api/v1/auth/login`
- **Role:** `public` (`Content-Type`, `Origin`; sets `Set-Cookie: lms_session=...; HttpOnly; Secure; SameSite=Lax`)
- **Request:**
```json
{
  "email": "student001@sis.hust.edu.vn",
  "password": "student-secret-password"
}
```
- **Response `200`:**
```json
{
  "data": {
    "user": {
      "id": 5,
      "email": "student001@sis.hust.edu.vn",
      "full_name": "Nguyễn An",
      "role": "student",
      "is_active": true,
      "student_id": "202512345",
      "school_or_institute": "Trường CNTT và Truyền thông",
      "university_class": "K71",
      "phone_number": "0912345678",
      "gender": "male"
    },
    "csrf_token": "bW9ja19jc3JmX3Rva2VuX2V4YW1wbGU"
  },
  "error": null
}
```

### 1.2 `GET /api/v1/auth/me`
- **Role:** `any`
- **Request:** None
- **Response `200`:**
```json
{
  "data": {
    "user": {
      "id": 1,
      "email": "admin@example.edu.vn",
      "full_name": "Quản trị viên",
      "role": "admin",
      "is_active": true,
      "student_id": null,
      "school_or_institute": null,
      "university_class": null,
      "phone_number": null,
      "gender": null
    },
    "csrf_token": "bW9ja19jc3JmX3Rva2VuX2V4YW1wbGU"
  },
  "error": null
}
```

### 1.3 `POST /api/v1/auth/logout`
- **Role:** `any` (revokes current session and clears `lms_session` cookie)
- **Request:**
```json
{}
```
- **Response `200`:**
```json
{
  "data": {},
  "error": null
}
```

### 1.4 `POST /api/v1/auth/change-password`
- **Role:** `any` (revokes all sessions and clears `lms_session` cookie)
- **Request:**
```json
{
  "current_password": "old-password-1234",
  "new_password": "new-strong-password-5678"
}
```
- **Response `200`:**
```json
{
  "data": {},
  "error": null
}
```

### 1.5 `GET /api/v1/announcements`
- **Role:** `any` · **Query:** `?is_read=true|false&page=1&page_size=20`
- **Request:** None
- **Response `200`:**
```json
{
  "data": {
    "items": [
      {
        "id": 12,
        "sender_id": null,
        "class_id": 1,
        "title": "Lịch: approved",
        "content": "Buổi 1: Làm quen Word ",
        "automated": 1,
        "created_at": "2026-11-15T02:00:00Z",
        "is_read": 0
      },
      {
        "id": 10,
        "sender_id": 2,
        "class_id": null,
        "title": "Nhắc lịch học",
        "content": "Các em xem trước tài liệu Word.",
        "automated": 0,
        "created_at": "2026-11-14T10:00:00Z",
        "is_read": 1
      }
    ],
    "page": 1,
    "page_size": 20,
    "total": 2
  },
  "error": null
}
```

### 1.6 `GET /api/v1/announcements/{id}`
- **Role:** `any` (does **not** mark the announcement as read)
- **Request:** None
- **Response `200`:**
```json
{
  "data": {
    "announcement": {
      "id": 12,
      "sender_id": null,
      "class_id": 1,
      "title": "Lịch: approved",
      "content": "Buổi 1: Làm quen Word ",
      "automated": 1,
      "created_at": "2026-11-15T02:00:00Z",
      "is_read": 0
    }
  },
  "error": null
}
```

### 1.7 `PATCH /api/v1/announcements/{id}/read`
- **Role:** `any`
- **Request:**
```json
{
  "is_read": true
}
```
- **Response `200`:**
```json
{
  "data": {},
  "error": null
}
```

---

## 2. Admin Routes (29)

### 2.1 `GET /api/v1/admin/users`
- **Role:** `admin` · **Query:** `?search=...&role=student|class_manager&is_active=true|false&page=1&page_size=20` (excludes `admin` users)
- **Request:** None
- **Response `200`:**
```json
{
  "data": {
    "items": [
      {
        "id": 2,
        "email": "manager1@example.edu.vn",
        "full_name": "Trần Quản Lý",
        "role": "class_manager",
        "is_active": true,
        "student_id": null,
        "school_or_institute": null,
        "university_class": null,
        "phone_number": null,
        "gender": null
      },
      {
        "id": 5,
        "email": "student001@sis.hust.edu.vn",
        "full_name": "Nguyễn An",
        "role": "student",
        "is_active": true,
        "student_id": "202512345",
        "school_or_institute": "Trường CNTT và Truyền thông",
        "university_class": "K71",
        "phone_number": "0912345678",
        "gender": "male"
      }
    ],
    "page": 1,
    "page_size": 20,
    "total": 2
  },
  "error": null
}
```

### 2.2 `POST /api/v1/admin/users`
- **Role:** `admin` (`role` must be `"student"` or `"class_manager"`; for `"class_manager"`, profile fields must be omitted or `null`)
- **Request (Student):**
```json
{
  "email": "student001@sis.hust.edu.vn",
  "full_name": "Nguyễn An",
  "role": "student",
  "password": "initial-student-password",
  "student_id": "202512345",
  "school_or_institute": "Trường CNTT và Truyền thông",
  "university_class": "K71",
  "phone_number": "0912345678",
  "gender": null
}
```
- **Response `201`:**
```json
{
  "data": {
    "user": {
      "id": 5,
      "email": "student001@sis.hust.edu.vn",
      "full_name": "Nguyễn An",
      "role": "student",
      "is_active": true,
      "student_id": "202512345",
      "school_or_institute": "Trường CNTT và Truyền thông",
      "university_class": "K71",
      "phone_number": "0912345678",
      "gender": null
    }
  },
  "error": null
}
```

### 2.3 `PUT /api/v1/admin/users/{id}`
- **Role:** `admin` (`role` and `password` are not accepted here; email change revokes user sessions)
- **Request (Student):**
```json
{
  "email": "student001@sis.hust.edu.vn",
  "full_name": "Nguyễn Văn An",
  "student_id": "202512345",
  "school_or_institute": "Trường CNTT và Truyền thông",
  "university_class": "IT-E6 K70",
  "phone_number": "+84912345678",
  "gender": "male"
}
```
- **Response `200`:**
```json
{
  "data": {
    "user": {
      "id": 5,
      "email": "student001@sis.hust.edu.vn",
      "full_name": "Nguyễn Văn An",
      "role": "student",
      "is_active": true,
      "student_id": "202512345",
      "school_or_institute": "Trường CNTT và Truyền thông",
      "university_class": "IT-E6 K70",
      "phone_number": "+84912345678",
      "gender": "male"
    }
  },
  "error": null
}
```

### 2.4 `PATCH /api/v1/admin/users/{id}/status`
- **Role:** `admin` (if `is_active` changes, revokes user sessions and writes `account_status` audit log)
- **Request:**
```json
{
  "is_active": false,
  "reason": "Bảo lưu theo đề nghị của học viên."
}
```
- **Response `200`:**
```json
{
  "data": {
    "user": {
      "id": 5,
      "email": "student001@sis.hust.edu.vn",
      "full_name": "Nguyễn Văn An",
      "role": "student",
      "is_active": false,
      "student_id": "202512345",
      "school_or_institute": "Trường CNTT và Truyền thông",
      "university_class": "IT-E6 K70",
      "phone_number": "+84912345678",
      "gender": "male"
    }
  },
  "error": null
}
```

### 2.5 `POST /api/v1/admin/users/{id}/reset-password`
- **Role:** `admin` (revokes user sessions)
- **Request:**
```json
{
  "new_password": "reset-password-12345"
}
```
- **Response `200`:**
```json
{
  "data": {},
  "error": null
}
```

### 2.6 `GET /api/v1/admin/classes`
- **Role:** `admin` · **Query:** `?search=...&page=1&page_size=20`
- **Request:** None
- **Response `200`:**
```json
{
  "data": {
    "items": [
      {
        "id": 1,
        "code": "MOS-WORD-01",
        "name": "MOS Word Cơ bản",
        "description": "Khóa luyện thi MOS Word 365",
        "manager_id": 2,
        "capacity": 40,
        "end_date": "2026-12-31",
        "expires_at": "2026-12-31T17:00:00Z",
        "total_sessions": 6,
        "min_attendance_percent": 80,
        "min_quiz_percent": 70,
        "is_expired": false,
        "manager": {
          "id": 2,
          "email": "manager1@example.edu.vn",
          "full_name": "Trần Quản Lý",
          "role": "class_manager",
          "is_active": true,
          "student_id": null,
          "school_or_institute": null,
          "university_class": null,
          "phone_number": null,
          "gender": null
        },
        "enrolled_count": 25,
        "ended_sessions": 1
      }
    ],
    "page": 1,
    "page_size": 20,
    "total": 1
  },
  "error": null
}
```

### 2.7 `GET /api/v1/admin/classes/{classId}`
- **Role:** `admin`
- **Request:** None
- **Response `200`:**
```json
{
  "data": {
    "class": {
      "id": 1,
      "code": "MOS-WORD-01",
      "name": "MOS Word Cơ bản",
      "description": "Khóa luyện thi MOS Word 365",
      "manager_id": 2,
      "capacity": 40,
      "end_date": "2026-12-31",
      "expires_at": "2026-12-31T17:00:00Z",
      "total_sessions": 6,
      "min_attendance_percent": 80,
      "min_quiz_percent": 70,
      "is_expired": false,
      "manager": {
        "id": 2,
        "email": "manager1@example.edu.vn",
        "full_name": "Trần Quản Lý",
        "role": "class_manager",
        "is_active": true,
        "student_id": null,
        "school_or_institute": null,
        "university_class": null,
        "phone_number": null,
        "gender": null
      },
      "enrolled_count": 25,
      "ended_sessions": 1
    }
  },
  "error": null
}
```

### 2.8 `POST /api/v1/admin/classes`
- **Role:** `admin` (`code` is uppercased server-side; `total_sessions` starts `null`)
- **Request:**
```json
{
  "code": "mos-excel-01",
  "name": "MOS Excel Cơ bản",
  "description": "Khóa luyện thi MOS Excel 365",
  "manager_id": 2,
  "capacity": 40,
  "end_date": "2026-12-31",
  "min_attendance_percent": 80,
  "min_quiz_percent": 70
}
```
- **Response `201`:**
```json
{
  "data": {
    "class": {
      "id": 2,
      "code": "MOS-EXCEL-01",
      "name": "MOS Excel Cơ bản",
      "description": "Khóa luyện thi MOS Excel 365",
      "manager_id": 2,
      "capacity": 40,
      "end_date": "2026-12-31",
      "expires_at": "2026-12-31T17:00:00Z",
      "total_sessions": null,
      "min_attendance_percent": 80,
      "min_quiz_percent": 70,
      "is_expired": false,
      "manager": {
        "id": 2,
        "email": "manager1@example.edu.vn",
        "full_name": "Trần Quản Lý",
        "role": "class_manager",
        "is_active": true,
        "student_id": null,
        "school_or_institute": null,
        "university_class": null,
        "phone_number": null,
        "gender": null
      },
      "enrolled_count": 0,
      "ended_sessions": 0
    }
  },
  "error": null
}
```

### 2.9 `PUT /api/v1/admin/classes/{classId}`
- **Role:** `admin` (`reassignment_reason` and `confirm_reassignment: true` required only when `manager_id` changes)
- **Request:**
```json
{
  "code": "MOS-EXCEL-01",
  "name": "MOS Excel 365 K71",
  "description": "Cập nhật mô tả lớp",
  "manager_id": 3,
  "capacity": 45,
  "end_date": "2027-01-15",
  "min_attendance_percent": 80,
  "min_quiz_percent": 75,
  "reassignment_reason": "Điều chuyển quản lý phụ trách học kỳ mới.",
  "confirm_reassignment": true
}
```
- **Response `200`:**
```json
{
  "data": {
    "class": {
      "id": 2,
      "code": "MOS-EXCEL-01",
      "name": "MOS Excel 365 K71",
      "description": "Cập nhật mô tả lớp",
      "manager_id": 3,
      "capacity": 45,
      "end_date": "2027-01-15",
      "expires_at": "2027-01-15T17:00:00Z",
      "total_sessions": null,
      "min_attendance_percent": 80,
      "min_quiz_percent": 75,
      "is_expired": false,
      "manager": {
        "id": 3,
        "email": "manager2@example.edu.vn",
        "full_name": "Lê Quản Lý",
        "role": "class_manager",
        "is_active": true,
        "student_id": null,
        "school_or_institute": null,
        "university_class": null,
        "phone_number": null,
        "gender": null
      },
      "enrolled_count": 0,
      "ended_sessions": 0
    }
  },
  "error": null
}
```

### 2.10 `GET /api/v1/admin/classes/{classId}/enrollment-requests`
- **Role:** `admin` · **Query:** `?page=1&page_size=20`
- **Request:** None
- **Response `200`:**
```json
{
  "data": {
    "items": [
      {
        "id": 7,
        "class_id": 1,
        "student_id": 5,
        "reason": "Em muốn ôn thi chứng chỉ MOS Word.",
        "status": "pending",
        "decision_reason": null,
        "decided_by": null,
        "created_at": "2026-11-15T01:30:00Z",
        "decided_at": null,
        "full_name": "Nguyễn An",
        "student_number": "202512345"
      }
    ],
    "page": 1,
    "page_size": 20,
    "total": 1
  },
  "error": null
}
```

### 2.11 `GET /api/v1/admin/classes/{classId}/enrollments`
- **Role:** `admin` · **Query:** `?page=1&page_size=20`
- **Request:** None
- **Response `200`:**
```json
{
  "data": {
    "items": [
      {
        "id": 12,
        "class_id": 1,
        "student_id": 5,
        "cycle_number": 1,
        "request_id": 7,
        "status": "enrolled",
        "approved_at": "2026-11-15T01:35:00Z",
        "removed_at": null,
        "removal_reason": null,
        "student": {
          "id": 5,
          "email": "student001@sis.hust.edu.vn",
          "full_name": "Nguyễn An",
          "role": "student",
          "is_active": true,
          "student_id": "202512345",
          "school_or_institute": "Trường CNTT và Truyền thông",
          "university_class": "K71",
          "phone_number": "0912345678",
          "gender": "male"
        },
        "progress": {
          "enrollment_id": 12,
          "attendance_count": 1,
          "total_sessions": 6,
          "attendance_percent": 16.666666666666664,
          "passed_quiz_count": 0,
          "published_quiz_count": 1,
          "quiz_percent": 0,
          "ended_sessions": 1,
          "completed": false,
          "incomplete_reasons": [
            "required_sessions_not_ended",
            "attendance_below_threshold",
            "quiz_below_threshold"
          ]
        }
      }
    ],
    "page": 1,
    "page_size": 20,
    "total": 1
  },
  "error": null
}
```

### 2.12 `POST /api/v1/admin/classes/{classId}/enrollments/{enrollmentId}/remove`
- **Role:** `admin`
- **Request:**
```json
{
  "reason": "Học viên chuyển sang lớp khác."
}
```
- **Response `200`:**
```json
{
  "data": {},
  "error": null
}
```

### 2.13 `GET /api/v1/admin/classes/{classId}/sessions`
- **Role:** `admin` · **Query:** `?page=1&page_size=20`
- **Request:** None
- **Response `200`:**
```json
{
  "data": {
    "items": [
      {
        "id": 2,
        "class_id": 1,
        "session_number": 1,
        "title": "Buổi 1: Làm quen Word",
        "description": "Các thao tác văn bản cơ bản",
        "location": "D9-301",
        "starts_at": "2026-12-01T11:00:00Z",
        "ends_at": "2026-12-01T13:00:00Z",
        "approved_proposal_id": 3,
        "attendance_code": "WORD01"
      }
    ],
    "page": 1,
    "page_size": 20,
    "total": 1
  },
  "error": null
}
```

### 2.14 `GET /api/v1/admin/classes/{classId}/sessions/{sessionId}`
- **Role:** `admin`
- **Request:** None
- **Response `200`:**
```json
{
  "data": {
    "session": {
      "id": 2,
      "class_id": 1,
      "session_number": 1,
      "title": "Buổi 1: Làm quen Word",
      "description": "Các thao tác văn bản cơ bản",
      "location": "D9-301",
      "starts_at": "2026-12-01T11:00:00Z",
      "ends_at": "2026-12-01T13:00:00Z",
      "approved_proposal_id": 3,
      "attendance_code": "WORD01"
    },
    "proposals": [
      {
        "id": 3,
        "session_id": 2,
        "proposed_by": 2,
        "starts_at": "2026-12-01T11:00:00Z",
        "ends_at": "2026-12-01T13:00:00Z",
        "status": "approved",
        "reason": "",
        "reviewed_by": 1,
        "created_at": "2026-11-15T01:40:00Z",
        "reviewed_at": "2026-11-15T01:50:00Z"
      }
    ]
  },
  "error": null
}
```

### 2.15 `GET /api/v1/admin/schedule-proposals`
- **Role:** `admin` · **Query:** `?page=1&page_size=20` (pending proposals only)
- **Request:** None
- **Response `200`:**
```json
{
  "data": {
    "items": [
      {
        "id": 4,
        "session_id": 3,
        "proposed_by": 2,
        "starts_at": "2026-12-08T11:00:00Z",
        "ends_at": "2026-12-08T13:00:00Z",
        "status": "pending",
        "reason": null,
        "reviewed_by": null,
        "created_at": "2026-11-15T02:00:00Z",
        "reviewed_at": null,
        "class_id": 1,
        "session_number": 2,
        "title": "Buổi 2: Bảng và định dạng"
      }
    ],
    "page": 1,
    "page_size": 20,
    "total": 1
  },
  "error": null
}
```

### 2.16 `POST /api/v1/admin/classes/{classId}/sessions/{sessionId}/schedule-proposals/{proposalId}/review`
- **Role:** `admin` (`decision`: `"approve"` or `"reject"`; `reason` required on `"reject"`)
- **Request:**
```json
{
  "decision": "reject",
  "reason": "Trùng lịch phòng D9-301, vui lòng chọn khung giờ khác."
}
```
- **Response `200`:**
```json
{
  "data": {
    "session": {
      "id": 3,
      "class_id": 1,
      "session_number": 2,
      "title": "Buổi 2: Bảng và định dạng",
      "description": "Làm việc với Table và Styles",
      "location": "D9-301",
      "starts_at": null,
      "ends_at": null,
      "approved_proposal_id": null,
      "attendance_code": "WORD02"
    },
    "proposal": {
      "id": 4,
      "session_id": 3,
      "proposed_by": 2,
      "starts_at": "2026-12-08T11:00:00Z",
      "ends_at": "2026-12-08T13:00:00Z",
      "status": "rejected",
      "reason": "Trùng lịch phòng D9-301, vui lòng chọn khung giờ khác.",
      "reviewed_by": 1,
      "created_at": "2026-11-15T02:00:00Z",
      "reviewed_at": "2026-11-15T02:05:00Z"
    }
  },
  "error": null
}
```

### 2.17 `GET /api/v1/admin/classes/{classId}/quizzes`
- **Role:** `admin` · **Query:** `?page=1&page_size=20`
- **Request:** None
- **Response `200`:**
```json
{
  "data": {
    "items": [
      {
        "id": 4,
        "class_id": 1,
        "title": "Ôn tập Word buổi 1",
        "description": "Chọn một đáp án đúng nhất.",
        "quiz_type": "assignment",
        "duration_seconds": 600,
        "open_at": "2026-12-01T01:00:00Z",
        "deadline": "2026-12-05T13:00:00Z",
        "pass_score": 60,
        "attempt_limit": 10,
        "is_published": true,
        "created_at": "2026-11-15T01:00:00Z",
        "updated_at": "2026-11-15T01:10:00Z"
      }
    ],
    "page": 1,
    "page_size": 20,
    "total": 1
  },
  "error": null
}
```

### 2.18 `GET /api/v1/admin/classes/{classId}/quizzes/{quizId}`
- **Role:** `admin`
- **Request:** None
- **Response `200`:**
```json
{
  "data": {
    "quiz": {
      "id": 4,
      "class_id": 1,
      "title": "Ôn tập Word buổi 1",
      "description": "Chọn một đáp án đúng nhất.",
      "quiz_type": "assignment",
      "duration_seconds": 600,
      "open_at": "2026-12-01T01:00:00Z",
      "deadline": "2026-12-05T13:00:00Z",
      "pass_score": 60,
      "attempt_limit": 10,
      "is_published": true,
      "created_at": "2026-11-15T01:00:00Z",
      "updated_at": "2026-11-15T01:10:00Z"
    },
    "questions": [
      {
        "id": 6,
        "question_text": "Phím tắt lưu tài liệu trong Word?",
        "sort_order": 0,
        "question_type": "single_choice",
        "points": 1,
        "options": [
          {
            "id": 10,
            "option_text": "Ctrl + S",
            "is_correct": true,
            "sort_order": 0
          },
          {
            "id": 11,
            "option_text": "Ctrl + P",
            "is_correct": false,
            "sort_order": 1
          }
        ]
      }
    ]
  },
  "error": null
}
```

### 2.19 `GET /api/v1/admin/classes/{classId}/quizzes/{quizId}/attempts`
- **Role:** `admin` · **Query:** `?page=1&page_size=20` (note: no `review` key in staff attempt items)
- **Request:** None
- **Response `200`:**
```json
{
  "data": {
    "items": [
      {
        "attempt": {
          "id": 5,
          "quiz_id": 4,
          "student_id": 5,
          "enrollment_id": 12,
          "attempt_number": 1,
          "status": "submitted",
          "started_at": "2026-12-01T02:00:00Z",
          "effective_deadline": "2026-12-05T13:00:00Z",
          "effective_cutoff_at": "2026-12-01T02:10:00Z",
          "submitted_at": "2026-12-01T02:03:00Z",
          "time_spent_seconds": 180,
          "score": 1,
          "max_score": 1,
          "score_percent": 100,
          "is_passed": true,
          "draft_revision": 1
        },
        "answers": [
          {
            "question_id": 6,
            "option_ids": [10]
          }
        ]
      }
    ],
    "page": 1,
    "page_size": 20,
    "total": 1
  },
  "error": null
}
```

### 2.20 `GET /api/v1/admin/classes/{classId}/attendance`
- **Role:** `admin` · **Query:** `?page=1&page_size=20`
- **Request:** None
- **Response `200`:**
```json
{
  "data": {
    "items": [
      {
        "id": 8,
        "enrollment_id": 12,
        "session_id": 2,
        "attended": 1,
        "wrong_count": 0,
        "overridden": 0,
        "updated_at": "2026-12-01T11:05:00Z",
        "student_id": 5,
        "cycle_number": 1,
        "enrollment_status": "enrolled"
      }
    ],
    "page": 1,
    "page_size": 20,
    "total": 1
  },
  "error": null
}
```

### 2.21 `GET /api/v1/admin/classes/{classId}/audit`
- **Role:** `admin` · **Query:** `?page=1&page_size=20`
- **Request:** None
- **Response `200`:**
```json
{
  "data": {
    "items": [
      {
        "id": 15,
        "actor_id": 2,
        "class_id": 1,
        "action": "attendance_override",
        "target_id": 8,
        "before_json": "{\"attended\":false,\"overridden\":false}",
        "after_json": "{\"attended\":true,\"overridden\":true}",
        "reason": "Đã xác minh học viên có mặt.",
        "created_at": "2026-12-01T11:20:00Z"
      }
    ],
    "page": 1,
    "page_size": 20,
    "total": 1
  },
  "error": null
}
```

### 2.22 `GET /api/v1/admin/classes/{classId}/absences`
- **Role:** `admin` · **Query:** `?page=1&page_size=20`
- **Request:** None
- **Response `200`:**
```json
{
  "data": {
    "items": [
      {
        "id": 3,
        "enrollment_id": 13,
        "session_id": 2,
        "reason": "Em có lịch khám bệnh.",
        "created_at": "2026-12-01T08:00:00Z",
        "student_id": 6
      }
    ],
    "page": 1,
    "page_size": 20,
    "total": 1
  },
  "error": null
}
```

### 2.23 `GET /api/v1/admin/classes/{classId}/materials`
- **Role:** `admin` · **Query:** `?search=...&material_type=document|video&session_id=2&page=1&page_size=20` (includes deleted/expired)
- **Request:** None
- **Response `200`:**
```json
{
  "data": {
    "items": [
      {
        "id": 3,
        "class_id": 1,
        "session_id": 2,
        "title": "Slide bài giảng Word buổi 1",
        "description": "Tài liệu tham khảo buổi 1",
        "material_type": "document",
        "url": "https://example.edu.vn/word-b1.pdf",
        "expires_at": "2026-12-31T17:00:00Z",
        "created_by": 2,
        "deleted_at": null,
        "deletion_reason": null,
        "created_at": "2026-11-15T01:00:00Z",
        "updated_at": "2026-11-15T01:00:00Z"
      }
    ],
    "page": 1,
    "page_size": 20,
    "total": 1
  },
  "error": null
}
```

### 2.24 `GET /api/v1/admin/classes/{classId}/materials/{materialId}`
- **Role:** `admin`
- **Request:** None
- **Response `200`:**
```json
{
  "data": {
    "material": {
      "id": 3,
      "class_id": 1,
      "session_id": 2,
      "title": "Slide bài giảng Word buổi 1",
      "description": "Tài liệu tham khảo buổi 1",
      "material_type": "document",
      "url": "https://example.edu.vn/word-b1.pdf",
      "expires_at": "2026-12-31T17:00:00Z",
      "created_by": 2,
      "deleted_at": null,
      "deletion_reason": null,
      "created_at": "2026-11-15T01:00:00Z",
      "updated_at": "2026-11-15T01:00:00Z"
    }
  },
  "error": null
}
```

### 2.25 `DELETE /api/v1/admin/classes/{classId}/materials/{materialId}`
- **Role:** `admin` (soft-deletes, logs audit, and notifies class manager)
- **Request:**
```json
{
  "reason": "Đường dẫn tài liệu không còn hợp lệ."
}
```
- **Response `200`:**
```json
{
  "data": {},
  "error": null
}
```

### 2.26 `GET /api/v1/admin/dashboard`
- **Role:** `admin`
- **Request:** None
- **Response `200`:**
```json
{
  "data": {
    "classes": [
      {
        "class": {
          "id": 1,
          "code": "MOS-WORD-01",
          "name": "MOS Word Cơ bản",
          "description": "Khóa luyện thi MOS Word 365",
          "manager_id": 2,
          "capacity": 40,
          "end_date": "2026-12-31",
          "expires_at": "2026-12-31T17:00:00Z",
          "total_sessions": 6,
          "min_attendance_percent": 80,
          "min_quiz_percent": 70,
          "is_expired": false,
          "manager": {
            "id": 2,
            "email": "manager1@example.edu.vn",
            "full_name": "Trần Quản Lý",
            "role": "class_manager",
            "is_active": true,
            "student_id": null,
            "school_or_institute": null,
            "university_class": null,
            "phone_number": null,
            "gender": null
          },
          "enrolled_count": 1,
          "ended_sessions": 0
        },
        "enrollments": [
          {
            "enrollment": {
              "id": 12,
              "class_id": 1,
              "student_id": 5,
              "cycle_number": 1,
              "request_id": 7,
              "status": "enrolled",
              "approved_at": "2026-11-15T01:35:00Z",
              "removed_at": null,
              "removal_reason": null
            },
            "progress": {
              "enrollment_id": 12,
              "attendance_count": 0,
              "total_sessions": 6,
              "attendance_percent": 0,
              "passed_quiz_count": 0,
              "published_quiz_count": 1,
              "quiz_percent": 0,
              "ended_sessions": 0,
              "completed": false,
              "incomplete_reasons": [
                "required_sessions_not_ended",
                "attendance_below_threshold",
                "quiz_below_threshold"
              ]
            }
          }
        ]
      }
    ],
    "enrolled_count": 1,
    "unread_count": 2,
    "student_count": 100,
    "manager_count": 3,
    "pending_schedules": 1,
    "agenda": {
      "upcoming_sessions": [
        {
          "id": 2,
          "class_id": 1,
          "session_number": 1,
          "title": "Buổi 1: Làm quen Word",
          "description": "Các thao tác văn bản cơ bản",
          "location": "D9-301",
          "starts_at": "2026-12-01T11:00:00Z",
          "ends_at": "2026-12-01T13:00:00Z",
          "approved_proposal_id": 3
        }
      ],
      "quizzes": [
        {
          "id": 4,
          "class_id": 1,
          "title": "Ôn tập Word buổi 1",
          "description": "Chọn một đáp án đúng nhất.",
          "quiz_type": "assignment",
          "duration_seconds": 600,
          "open_at": "2026-12-01T01:00:00Z",
          "deadline": "2026-12-05T13:00:00Z",
          "pass_score": 60,
          "attempt_limit": 10,
          "is_published": true,
          "created_at": "2026-11-15T01:00:00Z",
          "updated_at": "2026-11-15T01:10:00Z"
        }
      ],
      "active_attempts": [],
      "pending_enrollment_requests": 1
    }
  },
  "error": null
}
```

### 2.27 `GET /api/v1/admin/classes/{classId}/progress`
- **Role:** `admin` · **Query:** `?page=1&page_size=20`
- **Request:** None
- **Response `200`:**
```json
{
  "data": {
    "items": [
      {
        "enrollment": {
          "id": 12,
          "class_id": 1,
          "student_id": 5,
          "cycle_number": 1,
          "request_id": 7,
          "status": "enrolled",
          "approved_at": "2026-11-15T01:35:00Z",
          "removed_at": null,
          "removal_reason": null
        },
        "progress": {
          "enrollment_id": 12,
          "attendance_count": 5,
          "total_sessions": 6,
          "attendance_percent": 83.33333333333334,
          "passed_quiz_count": 1,
          "published_quiz_count": 1,
          "quiz_percent": 100,
          "ended_sessions": 6,
          "completed": true,
          "incomplete_reasons": []
        }
      }
    ],
    "page": 1,
    "page_size": 20,
    "total": 1
  },
  "error": null
}
```

### 2.28 `GET /api/v1/admin/recipients`
- **Role:** `admin` · **Query:** `?page=1&page_size=20` (active `student` and `class_manager` accounts)
- **Request:** None
- **Response `200`:**
```json
{
  "data": {
    "items": [
      {
        "id": 2,
        "email": "manager1@example.edu.vn",
        "full_name": "Trần Quản Lý",
        "role": "class_manager",
        "is_active": true,
        "student_id": null,
        "school_or_institute": null,
        "university_class": null,
        "phone_number": null,
        "gender": null
      },
      {
        "id": 5,
        "email": "student001@sis.hust.edu.vn",
        "full_name": "Nguyễn An",
        "role": "student",
        "is_active": true,
        "student_id": "202512345",
        "school_or_institute": "Trường CNTT và Truyền thông",
        "university_class": "K71",
        "phone_number": "0912345678",
        "gender": "male"
      }
    ],
    "page": 1,
    "page_size": 20,
    "total": 2
  },
  "error": null
}
```

### 2.29 `POST /api/v1/admin/announcements`
- **Role:** `admin` (`recipient_ids` are deduplicated server-side)
- **Request:**
```json
{
  "recipient_ids": [2, 5, 5],
  "title": "Thông báo lịch thi thử MOS",
  "content": "Các lớp kiểm tra lịch làm bài thử trong tuần này."
}
```
- **Response `201`:**
```json
{
  "data": {
    "announcement_id": 25,
    "recipient_count": 2
  },
  "error": null
}
```

---

## 3. Manager Routes (`class_manager`) (33)

### 3.1 `GET /api/v1/manager/classes`
- **Role:** `class_manager` · **Query:** `?search=...&page=1&page_size=20` (assigned classes only)
- **Request:** None
- **Response `200`:** Same shape as `2.6` (`Page<Class>`).

### 3.2 `GET /api/v1/manager/classes/{classId}`
- **Role:** `class_manager`
- **Request:** None
- **Response `200`:** Same shape as `2.7` (`{"class": Class}`).

### 3.3 `PUT /api/v1/manager/classes/{classId}/total-sessions`
- **Role:** `class_manager` (can only be set once, `1..10000`)
- **Request:**
```json
{
  "total_sessions": 6
}
```
- **Response `200`:**
```json
{
  "data": {
    "class": {
      "id": 2,
      "code": "MOS-EXCEL-01",
      "name": "MOS Excel Cơ bản",
      "description": "Khóa luyện thi MOS Excel 365",
      "manager_id": 2,
      "capacity": 40,
      "end_date": "2026-12-31",
      "expires_at": "2026-12-31T17:00:00Z",
      "total_sessions": 6,
      "min_attendance_percent": 80,
      "min_quiz_percent": 70,
      "is_expired": false,
      "manager": {
        "id": 2,
        "email": "manager1@example.edu.vn",
        "full_name": "Trần Quản Lý",
        "role": "class_manager",
        "is_active": true,
        "student_id": null,
        "school_or_institute": null,
        "university_class": null,
        "phone_number": null,
        "gender": null
      },
      "enrolled_count": 0,
      "ended_sessions": 0
    }
  },
  "error": null
}
```

### 3.4 `GET /api/v1/manager/classes/{classId}/enrollment-requests`
- **Role:** `class_manager` · **Query:** `?page=1&page_size=20`
- **Request:** None
- **Response `200`:** Same shape as `2.10` (`Page<staff EnrollmentRequest>`).

### 3.5 `GET /api/v1/manager/classes/{classId}/enrollments`
- **Role:** `class_manager` · **Query:** `?page=1&page_size=20`
- **Request:** None
- **Response `200`:** Same shape as `2.11` (`Page<{...Enrollment, student, progress}>`).

### 3.6 `POST /api/v1/manager/classes/{classId}/enrollments/{enrollmentId}/remove`
- **Role:** `class_manager`
- **Request:**
```json
{
  "reason": "Học viên xin rút khỏi lớp."
}
```
- **Response `200`:**
```json
{
  "data": {},
  "error": null
}
```

### 3.7 `POST /api/v1/manager/classes/{classId}/enrollment-requests/{requestId}/review`
- **Role:** `class_manager` (`decision`: `"approve"` or `"decline"`; `"decline"` requires `reason`)
- **Request (Approve):**
```json
{
  "decision": "approve"
}
```
- **Request (Decline):**
```json
{
  "decision": "decline",
  "reason": "Vui lòng bổ sung rõ lý do đăng ký."
}
```
- **Response `200` (Approve example):**
```json
{
  "data": {
    "request": {
      "id": 7,
      "class_id": 1,
      "student_id": 5,
      "reason": "Em muốn ôn thi chứng chỉ MOS Word.",
      "status": "approved",
      "decision_reason": "",
      "decided_by": 2,
      "created_at": "2026-11-15T01:30:00Z",
      "decided_at": "2026-11-15T01:35:00Z"
    }
  },
  "error": null
}
```

### 3.8 `GET /api/v1/manager/classes/{classId}/sessions`
- **Role:** `class_manager` · **Query:** `?page=1&page_size=20`
- **Request:** None
- **Response `200`:** Same shape as `2.13` (`Page<staff Session>` with `attendance_code`).

### 3.9 `GET /api/v1/manager/classes/{classId}/sessions/{sessionId}`
- **Role:** `class_manager`
- **Request:** None
- **Response `200`:** Same shape as `2.14` (`{"session": staff Session, "proposals": Proposal[]}`).

### 3.10 `POST /api/v1/manager/classes/{classId}/sessions`
- **Role:** `class_manager` (`total_sessions` must already be set; `1 <= session_number <= total_sessions`)
- **Request:**
```json
{
  "session_number": 1,
  "title": "Buổi 1: Làm quen Word",
  "description": "Các thao tác văn bản cơ bản",
  "location": "D9-301",
  "attendance_code": "WORD01"
}
```
- **Response `201`:**
```json
{
  "data": {
    "session": {
      "id": 2,
      "class_id": 1,
      "session_number": 1,
      "title": "Buổi 1: Làm quen Word",
      "description": "Các thao tác văn bản cơ bản",
      "location": "D9-301",
      "starts_at": null,
      "ends_at": null,
      "approved_proposal_id": null,
      "attendance_code": "WORD01"
    }
  },
  "error": null
}
```

### 3.11 `PUT /api/v1/manager/classes/{classId}/sessions/{sessionId}/schedule-draft`
- **Role:** `class_manager` (`starts_at` must be strictly in the future; `ends_at` strictly after `starts_at`)
- **Request:**
```json
{
  "starts_at": "2026-12-01T18:00:00+07:00",
  "ends_at": "2026-12-01T20:00:00+07:00"
}
```
- **Response `200`:**
```json
{
  "data": {
    "proposal": {
      "id": 3,
      "session_id": 2,
      "proposed_by": 2,
      "starts_at": "2026-12-01T11:00:00Z",
      "ends_at": "2026-12-01T13:00:00Z",
      "status": "draft",
      "reason": null,
      "reviewed_by": null,
      "created_at": "2026-11-15T01:40:00Z",
      "reviewed_at": null
    }
  },
  "error": null
}
```

### 3.12 `POST /api/v1/manager/classes/{classId}/sessions/{sessionId}/schedule-proposals/{proposalId}/submit`
- **Role:** `class_manager` (notifies active admins)
- **Request:**
```json
{}
```
- **Response `200`:**
```json
{
  "data": {
    "proposal": {
      "id": 3,
      "session_id": 2,
      "proposed_by": 2,
      "starts_at": "2026-12-01T11:00:00Z",
      "ends_at": "2026-12-01T13:00:00Z",
      "status": "pending",
      "reason": null,
      "reviewed_by": null,
      "created_at": "2026-11-15T01:40:00Z",
      "reviewed_at": null
    }
  },
  "error": null
}
```

### 3.13 `GET /api/v1/manager/classes/{classId}/quizzes`
- **Role:** `class_manager` · **Query:** `?page=1&page_size=20`
- **Request:** None
- **Response `200`:** Same shape as `2.17` (`Page<Quiz>`).

### 3.14 `GET /api/v1/manager/classes/{classId}/quizzes/{quizId}`
- **Role:** `class_manager`
- **Request:** None
- **Response `200`:** Same shape as `2.18` (`{"quiz": Quiz, "questions": staff Question[]}`).

### 3.15 `GET /api/v1/manager/classes/{classId}/quizzes/{quizId}/attempts`
- **Role:** `class_manager` · **Query:** `?page=1&page_size=20`
- **Request:** None
- **Response `200`:** Same shape as `2.19` (`Page<StaffAttempt>`).

### 3.16 `POST /api/v1/manager/classes/{classId}/quizzes`
- **Role:** `class_manager` (`quiz_type`: `"test"` or `"assignment"`; `"test"` requires `attempt_limit` omitted/`null` or `1`; `"assignment"` defaults to `10`; each question requires exactly one `is_correct: true` option)
- **Request:**
```json
{
  "title": "Ôn tập Word buổi 1",
  "description": "Chọn một đáp án đúng nhất.",
  "quiz_type": "assignment",
  "duration_seconds": 600,
  "open_at": "2026-12-01T08:00:00+07:00",
  "deadline": "2026-12-05T20:00:00+07:00",
  "pass_score": 60,
  "attempt_limit": 10,
  "questions": [
    {
      "question_text": "Phím tắt lưu tài liệu trong Word?",
      "options": [
        { "option_text": "Ctrl + S", "is_correct": true },
        { "option_text": "Ctrl + P", "is_correct": false }
      ]
    }
  ]
}
```
- **Response `201`:**
```json
{
  "data": {
    "quiz": {
      "id": 4,
      "class_id": 1,
      "title": "Ôn tập Word buổi 1",
      "description": "Chọn một đáp án đúng nhất.",
      "quiz_type": "assignment",
      "duration_seconds": 600,
      "open_at": "2026-12-01T01:00:00Z",
      "deadline": "2026-12-05T13:00:00Z",
      "pass_score": 60,
      "attempt_limit": 10,
      "is_published": false,
      "created_at": "2026-11-15T01:00:00Z",
      "updated_at": "2026-11-15T01:00:00Z"
    },
    "questions": [
      {
        "id": 6,
        "question_text": "Phím tắt lưu tài liệu trong Word?",
        "sort_order": 0,
        "question_type": "single_choice",
        "points": 1,
        "options": [
          {
            "id": 10,
            "option_text": "Ctrl + S",
            "is_correct": true,
            "sort_order": 0
          },
          {
            "id": 11,
            "option_text": "Ctrl + P",
            "is_correct": false,
            "sort_order": 1
          }
        ]
      }
    ]
  },
  "error": null
}
```

### 3.17 `PUT /api/v1/manager/classes/{classId}/quizzes/{quizId}`
- **Role:** `class_manager` (rejected with `409 quiz_frozen` if any attempt exists; replaces quiz fields and all questions/options)
- **Request:** Same body shape as `3.16`.
- **Response `200`:** Same shape as `3.16` (`{"quiz": Quiz, "questions": staff Question[]}`).

### 3.18 `GET /api/v1/manager/classes/{classId}/quizzes/{quizId}/preview`
- **Role:** `class_manager`
- **Request:** None
- **Response `200`:** Same shape as `2.18` (`{"quiz": Quiz, "questions": staff Question[]}`).

### 3.19 `POST /api/v1/manager/classes/{classId}/quizzes/{quizId}/publish`
- **Role:** `class_manager` (idempotent; notifies currently enrolled active students on first publish)
- **Request:**
```json
{}
```
- **Response `200`:**
```json
{
  "data": {
    "quiz": {
      "id": 4,
      "class_id": 1,
      "title": "Ôn tập Word buổi 1",
      "description": "Chọn một đáp án đúng nhất.",
      "quiz_type": "assignment",
      "duration_seconds": 600,
      "open_at": "2026-12-01T01:00:00Z",
      "deadline": "2026-12-05T13:00:00Z",
      "pass_score": 60,
      "attempt_limit": 10,
      "is_published": true,
      "created_at": "2026-11-15T01:00:00Z",
      "updated_at": "2026-11-15T01:10:00Z"
    }
  },
  "error": null
}
```

### 3.20 `POST /api/v1/manager/classes/{classId}/quizzes/{quizId}/grants`
- **Role:** `class_manager` (`extra_attempts` optional/nullable, defaults to `1`; max `10` if `quiz_type == "assignment"`; `deadline` must be strictly after every target enrollment's current effective deadline)
- **Request:**
```json
{
  "enrollment_ids": [12, 13],
  "reason": "Bổ sung lượt làm bài do sự cố mạng.",
  "deadline": "2026-12-08T20:00:00+07:00",
  "extra_attempts": 2
}
```
- **Response `201`:**
```json
{
  "data": {
    "granted_enrollment_ids": [12, 13],
    "extra_attempts": 2,
    "deadline": "2026-12-08T13:00:00Z"
  },
  "error": null
}
```

### 3.21 `GET /api/v1/manager/classes/{classId}/attendance`
- **Role:** `class_manager` · **Query:** `?page=1&page_size=20`
- **Request:** None
- **Response `200`:** Same shape as `2.20`.

### 3.22 `POST /api/v1/manager/classes/{classId}/sessions/{sessionId}/attendance/{enrollmentId}/override`
- **Role:** `class_manager` (allowed only on approved session at/after `starts_at`; audits and notifies student)
- **Request:**
```json
{
  "attended": true,
  "reason": "Học viên có mặt nhưng nhập sai mã 3 lần."
}
```
- **Response `200`:**
```json
{
  "data": {
    "attendance": {
      "id": 8,
      "enrollment_id": 12,
      "session_id": 2,
      "attended": 1,
      "wrong_count": 3,
      "overridden": 1,
      "updated_at": "2026-12-01T11:20:00Z"
    }
  },
  "error": null
}
```

### 3.23 `GET /api/v1/manager/classes/{classId}/audit`
- **Role:** `class_manager` · **Query:** `?page=1&page_size=20`
- **Request:** None
- **Response `200`:** Same shape as `2.21`.

### 3.24 `GET /api/v1/manager/classes/{classId}/absences`
- **Role:** `class_manager` · **Query:** `?page=1&page_size=20`
- **Request:** None
- **Response `200`:** Same shape as `2.22`.

### 3.25 `GET /api/v1/manager/classes/{classId}/materials`
- **Role:** `class_manager` · **Query:** `?search=...&material_type=document|video&session_id=2&page=1&page_size=20`
- **Request:** None
- **Response `200`:** Same shape as `2.23`.

### 3.26 `GET /api/v1/manager/classes/{classId}/materials/{materialId}`
- **Role:** `class_manager`
- **Request:** None
- **Response `200`:** Same shape as `2.24`.

### 3.27 `DELETE /api/v1/manager/classes/{classId}/materials/{materialId}`
- **Role:** `class_manager` (soft-deletes and logs audit)
- **Request:**
```json
{
  "reason": "Cập nhật phiên bản tài liệu mới."
}
```
- **Response `200`:**
```json
{
  "data": {},
  "error": null
}
```

### 3.28 `POST /api/v1/manager/classes/{classId}/materials`
- **Role:** `class_manager` (`url` must be `https://...`; `session_id` and `expires_at` optional/nullable)
- **Request:**
```json
{
  "title": "Slide bài giảng Word buổi 1",
  "description": "Tài liệu tham khảo buổi 1",
  "material_type": "document",
  "url": "https://example.edu.vn/word-b1.pdf",
  "session_id": 2,
  "expires_at": "2026-12-31T23:59:59+07:00"
}
```
- **Response `201`:**
```json
{
  "data": {
    "material": {
      "id": 3,
      "class_id": 1,
      "session_id": 2,
      "title": "Slide bài giảng Word buổi 1",
      "description": "Tài liệu tham khảo buổi 1",
      "material_type": "document",
      "url": "https://example.edu.vn/word-b1.pdf",
      "expires_at": "2026-12-31T16:59:59Z",
      "created_by": 2,
      "deleted_at": null,
      "deletion_reason": null,
      "created_at": "2026-11-15T01:00:00Z",
      "updated_at": "2026-11-15T01:00:00Z"
    }
  },
  "error": null
}
```

### 3.29 `PUT /api/v1/manager/classes/{classId}/materials/{materialId}`
- **Role:** `class_manager` (replaces all fields; omitting or passing `null` for `session_id`/`expires_at` clears them)
- **Request:**
```json
{
  "title": "Video chữa bài tập Word buổi 1",
  "description": "Video hướng dẫn chi tiết",
  "material_type": "video",
  "url": "https://youtu.be/dQw4w9WgXcQ",
  "session_id": null,
  "expires_at": null
}
```
- **Response `200`:**
```json
{
  "data": {
    "material": {
      "id": 3,
      "class_id": 1,
      "session_id": null,
      "title": "Video chữa bài tập Word buổi 1",
      "description": "Video hướng dẫn chi tiết",
      "material_type": "video",
      "url": "https://youtu.be/dQw4w9WgXcQ",
      "expires_at": null,
      "created_by": 2,
      "deleted_at": null,
      "deletion_reason": null,
      "created_at": "2026-11-15T01:00:00Z",
      "updated_at": "2026-11-15T02:10:00Z"
    }
  },
  "error": null
}
```

### 3.30 `GET /api/v1/manager/dashboard`
- **Role:** `class_manager` (same shape as `2.26` except `student_count`, `manager_count`, and `pending_schedules` keys are omitted, and only classes assigned to this manager are included)
- **Request:** None
- **Response `200`:**
```json
{
  "data": {
    "classes": [
      {
        "class": {
          "id": 1,
          "code": "MOS-WORD-01",
          "name": "MOS Word Cơ bản",
          "description": "Khóa luyện thi MOS Word 365",
          "manager_id": 2,
          "capacity": 40,
          "end_date": "2026-12-31",
          "expires_at": "2026-12-31T17:00:00Z",
          "total_sessions": 6,
          "min_attendance_percent": 80,
          "min_quiz_percent": 70,
          "is_expired": false,
          "manager": {
            "id": 2,
            "email": "manager1@example.edu.vn",
            "full_name": "Trần Quản Lý",
            "role": "class_manager",
            "is_active": true,
            "student_id": null,
            "school_or_institute": null,
            "university_class": null,
            "phone_number": null,
            "gender": null
          },
          "enrolled_count": 1,
          "ended_sessions": 0
        },
        "enrollments": []
      }
    ],
    "enrolled_count": 1,
    "unread_count": 0,
    "agenda": {
      "upcoming_sessions": [],
      "quizzes": [],
      "active_attempts": [],
      "pending_enrollment_requests": 1
    }
  },
  "error": null
}
```

### 3.31 `GET /api/v1/manager/classes/{classId}/progress`
- **Role:** `class_manager` · **Query:** `?page=1&page_size=20`
- **Request:** None
- **Response `200`:** Same shape as `2.27`.

### 3.32 `GET /api/v1/manager/recipients`
- **Role:** `class_manager` · **Query:** `?page=1&page_size=20` (active students currently enrolled in unexpired classes managed by this manager)
- **Request:** None
- **Response `200`:**
```json
{
  "data": {
    "items": [
      {
        "id": 5,
        "email": "student001@sis.hust.edu.vn",
        "full_name": "Nguyễn An",
        "role": "student",
        "is_active": true,
        "student_id": "202512345",
        "school_or_institute": "Trường CNTT và Truyền thông",
        "university_class": "K71",
        "phone_number": "0912345678",
        "gender": "male"
      }
    ],
    "page": 1,
    "page_size": 20,
    "total": 1
  },
  "error": null
}
```

### 3.33 `POST /api/v1/manager/announcements`
- **Role:** `class_manager` (only active students enrolled in this manager's unexpired classes)
- **Request:**
```json
{
  "recipient_ids": [5, 6, 5],
  "title": "Nhắc lịch học buổi 1",
  "content": "Các bạn nhớ mang laptop đầy đủ."
}
```
- **Response `201`:**
```json
{
  "data": {
    "announcement_id": 26,
    "recipient_count": 2
  },
  "error": null
}
```

---

## 4. Student Routes (25)

### 4.1 `GET /api/v1/student/classes`
- **Role:** `student` · **Query:** `?search=...&page=1&page_size=20` (enrolled + unexpired classes only)
- **Request:** None
- **Response `200`:** Same shape as `2.6` (`Page<Class>`).

### 4.2 `GET /api/v1/student/classes/{classId}`
- **Role:** `student` (enrolled + unexpired only)
- **Request:** None
- **Response `200`:** Same shape as `2.7` (`{"class": Class}`).

### 4.3 `GET /api/v1/student/discover/classes`
- **Role:** `student` · **Query:** `?search=...&page=1&page_size=20` (all unexpired classes, adds `is_enrolled`)
- **Request:** None
- **Response `200`:**
```json
{
  "data": {
    "items": [
      {
        "id": 1,
        "code": "MOS-WORD-01",
        "name": "MOS Word Cơ bản",
        "description": "Khóa luyện thi MOS Word 365",
        "manager_id": 2,
        "capacity": 40,
        "end_date": "2026-12-31",
        "expires_at": "2026-12-31T17:00:00Z",
        "total_sessions": 6,
        "min_attendance_percent": 80,
        "min_quiz_percent": 70,
        "is_expired": false,
        "manager": {
          "id": 2,
          "email": "manager1@example.edu.vn",
          "full_name": "Trần Quản Lý",
          "role": "class_manager",
          "is_active": true,
          "student_id": null,
          "school_or_institute": null,
          "university_class": null,
          "phone_number": null,
          "gender": null
        },
        "enrolled_count": 25,
        "ended_sessions": 1,
        "is_enrolled": false
      }
    ],
    "page": 1,
    "page_size": 20,
    "total": 1
  },
  "error": null
}
```

### 4.4 `GET /api/v1/student/classes/{classId}/preview`
- **Role:** `student` (no enrollment required; rejects expired classes)
- **Request:** None
- **Response `200`:**
```json
{
  "data": {
    "class": {
      "id": 1,
      "code": "MOS-WORD-01",
      "name": "MOS Word Cơ bản",
      "description": "Khóa luyện thi MOS Word 365",
      "manager_id": 2,
      "capacity": 40,
      "end_date": "2026-12-31",
      "expires_at": "2026-12-31T17:00:00Z",
      "total_sessions": 6,
      "min_attendance_percent": 80,
      "min_quiz_percent": 70,
      "is_expired": false,
      "manager": {
        "id": 2,
        "email": "manager1@example.edu.vn",
        "full_name": "Trần Quản Lý",
        "role": "class_manager",
        "is_active": true,
        "student_id": null,
        "school_or_institute": null,
        "university_class": null,
        "phone_number": null,
        "gender": null
      },
      "enrolled_count": 25,
      "ended_sessions": 0
    },
    "upcoming_sessions": [
      {
        "id": 2,
        "session_number": 1,
        "title": "Buổi 1: Làm quen Word",
        "starts_at": "2026-12-01T11:00:00Z",
        "ends_at": "2026-12-01T13:00:00Z"
      }
    ]
  },
  "error": null
}
```

### 4.5 `POST /api/v1/student/classes/{classId}/enrollment-requests`
- **Role:** `student`
- **Request:**
```json
{
  "reason": "Em muốn ôn thi chứng chỉ MOS Word."
}
```
- **Response `201`:**
```json
{
  "data": {
    "request": {
      "id": 7,
      "class_id": 1,
      "student_id": 5,
      "reason": "Em muốn ôn thi chứng chỉ MOS Word.",
      "status": "pending",
      "decision_reason": null,
      "decided_by": null,
      "created_at": "2026-11-15T01:30:00Z",
      "decided_at": null
    }
  },
  "error": null
}
```

### 4.6 `GET /api/v1/student/enrollment-requests`
- **Role:** `student` · **Query:** `?page=1&page_size=20`
- **Request:** None
- **Response `200`:**
```json
{
  "data": {
    "items": [
      {
        "id": 7,
        "class_id": 1,
        "student_id": 5,
        "reason": "Em muốn ôn thi chứng chỉ MOS Word.",
        "status": "approved",
        "decision_reason": "",
        "decided_by": 2,
        "created_at": "2026-11-15T01:30:00Z",
        "decided_at": "2026-11-15T01:35:00Z"
      }
    ],
    "page": 1,
    "page_size": 20,
    "total": 1
  },
  "error": null
}
```

### 4.7 `POST /api/v1/student/classes/{classId}/enrollment-requests/{requestId}/cancel`
- **Role:** `student`
- **Request:**
```json
{}
```
- **Response `200`:**
```json
{
  "data": {},
  "error": null
}
```

### 4.8 `GET /api/v1/student/enrollment-history`
- **Role:** `student` · **Query:** `?page=1&page_size=20` (all own cycles, including removed/expired)
- **Request:** None
- **Response `200`:**
```json
{
  "data": {
    "items": [
      {
        "enrollment": {
          "id": 12,
          "class_id": 1,
          "student_id": 5,
          "cycle_number": 1,
          "request_id": 7,
          "status": "enrolled",
          "approved_at": "2026-11-15T01:35:00Z",
          "removed_at": null,
          "removal_reason": null
        },
        "class": {
          "id": 1,
          "code": "MOS-WORD-01",
          "name": "MOS Word Cơ bản",
          "end_date": "2026-12-31"
        },
        "progress": {
          "enrollment_id": 12,
          "attendance_count": 1,
          "total_sessions": 6,
          "attendance_percent": 16.666666666666664,
          "passed_quiz_count": 0,
          "published_quiz_count": 1,
          "quiz_percent": 0,
          "ended_sessions": 1,
          "completed": false,
          "incomplete_reasons": [
            "required_sessions_not_ended",
            "attendance_below_threshold",
            "quiz_below_threshold"
          ]
        }
      }
    ],
    "page": 1,
    "page_size": 20,
    "total": 1
  },
  "error": null
}
```

### 4.9 `GET /api/v1/student/classes/{classId}/sessions`
- **Role:** `student` · **Query:** `?page=1&page_size=20` (approved sessions only; `attendance_code` omitted)
- **Request:** None
- **Response `200`:**
```json
{
  "data": {
    "items": [
      {
        "id": 2,
        "class_id": 1,
        "session_number": 1,
        "title": "Buổi 1: Làm quen Word",
        "description": "Các thao tác văn bản cơ bản",
        "location": "D9-301",
        "starts_at": "2026-12-01T11:00:00Z",
        "ends_at": "2026-12-01T13:00:00Z",
        "approved_proposal_id": 3
      }
    ],
    "page": 1,
    "page_size": 20,
    "total": 1
  },
  "error": null
}
```

### 4.10 `GET /api/v1/student/classes/{classId}/sessions/{sessionId}`
- **Role:** `student` (approved session only; no `attendance_code` or `proposals`)
- **Request:** None
- **Response `200`:**
```json
{
  "data": {
    "session": {
      "id": 2,
      "class_id": 1,
      "session_number": 1,
      "title": "Buổi 1: Làm quen Word",
      "description": "Các thao tác văn bản cơ bản",
      "location": "D9-301",
      "starts_at": "2026-12-01T11:00:00Z",
      "ends_at": "2026-12-01T13:00:00Z",
      "approved_proposal_id": 3
    }
  },
  "error": null
}
```

### 4.11 `GET /api/v1/student/classes/{classId}/quizzes`
- **Role:** `student` · **Query:** `?page=1&page_size=20` (published quizzes only, enriched with current-cycle allowance/score)
- **Request:** None
- **Response `200`:**
```json
{
  "data": {
    "items": [
      {
        "id": 4,
        "class_id": 1,
        "title": "Ôn tập Word buổi 1",
        "description": "Chọn một đáp án đúng nhất.",
        "quiz_type": "assignment",
        "duration_seconds": 600,
        "open_at": "2026-12-01T01:00:00Z",
        "deadline": "2026-12-05T13:00:00Z",
        "pass_score": 60,
        "attempt_limit": 10,
        "is_published": true,
        "created_at": "2026-11-15T01:00:00Z",
        "updated_at": "2026-11-15T01:10:00Z",
        "effective_deadline": "2026-12-08T13:00:00Z",
        "allowed_attempts": 12,
        "used_attempts": 1,
        "best_score_percent": 100,
        "is_passed": true
      }
    ],
    "page": 1,
    "page_size": 20,
    "total": 1
  },
  "error": null
}
```

### 4.12 `GET /api/v1/student/classes/{classId}/quizzes/{quizId}`
- **Role:** `student` (published only; returns metadata without questions)
- **Request:** None
- **Response `200`:**
```json
{
  "data": {
    "quiz": {
      "id": 4,
      "class_id": 1,
      "title": "Ôn tập Word buổi 1",
      "description": "Chọn một đáp án đúng nhất.",
      "quiz_type": "assignment",
      "duration_seconds": 600,
      "open_at": "2026-12-01T01:00:00Z",
      "deadline": "2026-12-05T13:00:00Z",
      "pass_score": 60,
      "attempt_limit": 10,
      "is_published": true,
      "created_at": "2026-11-15T01:00:00Z",
      "updated_at": "2026-11-15T01:10:00Z"
    }
  },
  "error": null
}
```

### 4.13 `POST /api/v1/student/classes/{classId}/quizzes/{quizId}/start`
- **Role:** `student` · **Extra Header:** `Idempotency-Key: <uuid>` (always returns `200`)
- **Request:**
```json
{
  "enrollment_id": 12
}
```
- **Response `200` (while `in_progress`):**
```json
{
  "data": {
    "attempt": {
      "id": 5,
      "quiz_id": 4,
      "student_id": 5,
      "enrollment_id": 12,
      "attempt_number": 1,
      "status": "in_progress",
      "started_at": "2026-12-01T02:00:00Z",
      "effective_deadline": "2026-12-05T13:00:00Z",
      "effective_cutoff_at": "2026-12-01T02:10:00Z",
      "submitted_at": null,
      "time_spent_seconds": null,
      "score": null,
      "max_score": null,
      "score_percent": null,
      "is_passed": null,
      "draft_revision": 0
    },
    "quiz": {
      "id": 4,
      "class_id": 1,
      "title": "Ôn tập Word buổi 1",
      "description": "Chọn một đáp án đúng nhất.",
      "quiz_type": "assignment",
      "duration_seconds": 600,
      "open_at": "2026-12-01T01:00:00Z",
      "deadline": "2026-12-05T13:00:00Z",
      "pass_score": 60,
      "attempt_limit": 10,
      "is_published": true,
      "created_at": "2026-11-15T01:00:00Z",
      "updated_at": "2026-11-15T01:10:00Z"
    },
    "questions": [
      {
        "id": 6,
        "question_text": "Phím tắt lưu tài liệu trong Word?",
        "sort_order": 0,
        "question_type": "single_choice",
        "points": 1,
        "options": [
          {
            "id": 10,
            "option_text": "Ctrl + S",
            "sort_order": 0
          },
          {
            "id": 11,
            "option_text": "Ctrl + P",
            "sort_order": 1
          }
        ]
      }
    ],
    "answers": [],
    "review": null
  },
  "error": null
}
```
*(If replayed after the attempt was submitted/finalized, returns the `submitted` `Result` shape as in `4.18`.)*

### 4.14 `GET /api/v1/student/classes/{classId}/quizzes/{quizId}/active-attempt`
- **Role:** `student` (returns `404 not_found` if no `in_progress` attempt exists)
- **Request:** None
- **Response `200`:** Same `Runner` shape as `4.13`.

### 4.15 `GET /api/v1/student/classes/{classId}/quizzes/{quizId}/attempts`
- **Role:** `student` · **Query:** `?page=1&page_size=20` (`attempt_number` descending)
- **Request:** None
- **Response `200`:**
```json
{
  "data": {
    "items": [
      {
        "attempt": {
          "id": 5,
          "quiz_id": 4,
          "student_id": 5,
          "enrollment_id": 12,
          "attempt_number": 1,
          "status": "submitted",
          "started_at": "2026-12-01T02:00:00Z",
          "effective_deadline": "2026-12-05T13:00:00Z",
          "effective_cutoff_at": "2026-12-01T02:10:00Z",
          "submitted_at": "2026-12-01T02:03:00Z",
          "time_spent_seconds": 180,
          "score": 1,
          "max_score": 1,
          "score_percent": 100,
          "is_passed": true,
          "draft_revision": 1
        },
        "answers": [
          {
            "question_id": 6,
            "option_ids": [10]
          }
        ],
        "review": null
      }
    ],
    "page": 1,
    "page_size": 20,
    "total": 1
  },
  "error": null
}
```

### 4.16 `GET /api/v1/student/classes/{classId}/quiz-attempts/{attemptId}`
- **Role:** `student`
- **Request:** None
- **Response `200`:** Returns `Runner` (same as `4.13`) if `in_progress`, or `Result` (same as `4.18`) if `submitted`.

### 4.17 `PUT /api/v1/student/classes/{classId}/quiz-attempts/{attemptId}/draft`
- **Role:** `student` (replaces full saved answer set; `option_ids: []` or omitted question means unanswered)
- **Request:**
```json
{
  "enrollment_id": 12,
  "expected_revision": 0,
  "answers": [
    {
      "question_id": 6,
      "option_ids": [10]
    }
  ]
}
```
- **Response `200`:**
```json
{
  "data": {
    "attempt_id": 5,
    "draft_revision": 1
  },
  "error": null
}
```

### 4.18 `POST /api/v1/student/classes/{classId}/quiz-attempts/{attemptId}/submit`
- **Role:** `student` · **Extra Header:** `Idempotency-Key: <uuid>` (grades saved revision only; no `answers` field)
- **Request:**
```json
{
  "enrollment_id": 12,
  "expected_revision": 1
}
```
- **Response `200`:**
```json
{
  "data": {
    "attempt": {
      "id": 5,
      "quiz_id": 4,
      "student_id": 5,
      "enrollment_id": 12,
      "attempt_number": 1,
      "status": "submitted",
      "started_at": "2026-12-01T02:00:00Z",
      "effective_deadline": "2026-12-05T13:00:00Z",
      "effective_cutoff_at": "2026-12-01T02:10:00Z",
      "submitted_at": "2026-12-01T02:03:00Z",
      "time_spent_seconds": 180,
      "score": 1,
      "max_score": 1,
      "score_percent": 100,
      "is_passed": true,
      "draft_revision": 1
    },
    "answers": [
      {
        "question_id": 6,
        "option_ids": [10]
      }
    ],
    "review": null
  },
  "error": null
}
```

### 4.19 `GET /api/v1/student/classes/{classId}/attendance`
- **Role:** `student` · **Query:** `?page=1&page_size=20` (current enrollment cycle only)
- **Request:** None
- **Response `200`:** Same shape as `2.20`.

### 4.20 `POST /api/v1/student/classes/{classId}/sessions/{sessionId}/attend`
- **Role:** `student`
- **Request:**
```json
{
  "enrollment_id": 12,
  "code": "WORD01"
}
```
- **Response `200` (normal check-in):**
```json
{
  "data": {
    "attendance": {
      "id": 8,
      "enrollment_id": 12,
      "session_id": 2,
      "attended": 1,
      "wrong_count": 0,
      "overridden": 0,
      "updated_at": "2026-12-01T11:05:00Z"
    }
  },
  "error": null
}
```
- **Response `200` (if previously overridden by manager):**
```json
{
  "data": {
    "attendance": {
      "id": 8,
      "enrollment_id": 12,
      "session_id": 2,
      "attended": 0,
      "wrong_count": 0,
      "overridden": 1,
      "updated_at": "2026-12-01T11:04:00Z"
    },
    "authoritative_override": true
  },
  "error": null
}
```

### 4.21 `POST /api/v1/student/classes/{classId}/sessions/{sessionId}/absence`
- **Role:** `student` (auto-approved; notifies manager; does not grant attendance credit)
- **Request:**
```json
{
  "enrollment_id": 12,
  "reason": "Em có lịch khám bệnh."
}
```
- **Response `201`:**
```json
{
  "data": {
    "absence": {
      "id": 3,
      "enrollment_id": 12,
      "session_id": 2,
      "reason": "Em có lịch khám bệnh.",
      "created_at": "2026-12-01T08:00:00Z"
    },
    "status": "approved"
  },
  "error": null
}
```

### 4.22 `GET /api/v1/student/classes/{classId}/materials`
- **Role:** `student` · **Query:** `?search=...&material_type=document|video&session_id=2&page=1&page_size=20` (excludes deleted and non-YouTube expired materials)
- **Request:** None
- **Response `200`:** Same shape as `2.23`.

### 4.23 `GET /api/v1/student/classes/{classId}/materials/{materialId}`
- **Role:** `student` (returns `403 material_expired` if deleted or expired and not YouTube)
- **Request:** None
- **Response `200`:** Same shape as `2.24`.

### 4.24 `GET /api/v1/student/dashboard`
- **Role:** `student` (includes own historical cycles via `ClassSummary`, plus active-only `agenda`)
- **Request:** None
- **Response `200`:**
```json
{
  "data": {
    "classes": [
      {
        "class": {
          "id": 1,
          "code": "MOS-WORD-01",
          "name": "MOS Word Cơ bản",
          "end_date": "2026-12-31"
        },
        "enrollments": [
          {
            "enrollment": {
              "id": 12,
              "class_id": 1,
              "student_id": 5,
              "cycle_number": 1,
              "request_id": 7,
              "status": "enrolled",
              "approved_at": "2026-11-15T01:35:00Z",
              "removed_at": null,
              "removal_reason": null
            },
            "progress": {
              "enrollment_id": 12,
              "attendance_count": 1,
              "total_sessions": 6,
              "attendance_percent": 16.666666666666664,
              "passed_quiz_count": 0,
              "published_quiz_count": 1,
              "quiz_percent": 0,
              "ended_sessions": 1,
              "completed": false,
              "incomplete_reasons": [
                "required_sessions_not_ended",
                "attendance_below_threshold",
                "quiz_below_threshold"
              ]
            }
          }
        ]
      }
    ],
    "enrolled_count": 1,
    "unread_count": 1,
    "agenda": {
      "upcoming_sessions": [
        {
          "id": 2,
          "class_id": 1,
          "session_number": 1,
          "title": "Buổi 1: Làm quen Word",
          "description": "Các thao tác văn bản cơ bản",
          "location": "D9-301",
          "starts_at": "2026-12-01T11:00:00Z",
          "ends_at": "2026-12-01T13:00:00Z",
          "approved_proposal_id": 3
        }
      ],
      "quizzes": [
        {
          "id": 4,
          "class_id": 1,
          "title": "Ôn tập Word buổi 1",
          "description": "Chọn một đáp án đúng nhất.",
          "quiz_type": "assignment",
          "duration_seconds": 600,
          "open_at": "2026-12-01T01:00:00Z",
          "deadline": "2026-12-05T13:00:00Z",
          "pass_score": 60,
          "attempt_limit": 10,
          "is_published": true,
          "created_at": "2026-11-15T01:00:00Z",
          "updated_at": "2026-11-15T01:10:00Z",
          "effective_deadline": "2026-12-08T13:00:00Z",
          "allowed_attempts": 12
        }
      ],
      "active_attempts": [
        {
          "attempt": {
            "id": 5,
            "quiz_id": 4,
            "student_id": 5,
            "enrollment_id": 12,
            "attempt_number": 1,
            "status": "in_progress",
            "started_at": "2026-12-01T02:00:00Z",
            "effective_deadline": "2026-12-05T13:00:00Z",
            "effective_cutoff_at": "2026-12-01T02:10:00Z",
            "submitted_at": null,
            "time_spent_seconds": null,
            "score": null,
            "max_score": null,
            "score_percent": null,
            "is_passed": null,
            "draft_revision": 0
          },
          "quiz": {
            "id": 4,
            "class_id": 1,
            "title": "Ôn tập Word buổi 1",
            "description": "Chọn một đáp án đúng nhất.",
            "quiz_type": "assignment",
            "duration_seconds": 600,
            "open_at": "2026-12-01T01:00:00Z",
            "deadline": "2026-12-05T13:00:00Z",
            "pass_score": 60,
            "attempt_limit": 10,
            "is_published": true,
            "created_at": "2026-11-15T01:00:00Z",
            "updated_at": "2026-11-15T01:10:00Z"
          }
        }
      ],
      "pending_enrollment_requests": 0
    }
  },
  "error": null
}
```

### 4.25 `GET /api/v1/student/classes/{classId}/progress`
- **Role:** `student` (single `progress` object for current cycle, not `Page`)
- **Request:** None
- **Response `200`:**
```json
{
  "data": {
    "progress": {
      "enrollment_id": 12,
      "attendance_count": 5,
      "total_sessions": 6,
      "attendance_percent": 83.33333333333334,
      "passed_quiz_count": 1,
      "published_quiz_count": 1,
      "quiz_percent": 100,
      "ended_sessions": 6,
      "completed": true,
      "incomplete_reasons": []
    }
  },
  "error": null
}
```
