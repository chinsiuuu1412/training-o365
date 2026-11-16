package app

func (x *request) attendanceRow(eid, sid int64) M {
	exec(x.Ctx, x.Q, "INSERT INTO attendance(enrollment_id,session_id,updated_at) VALUES(?,?,?) ON CONFLICT(enrollment_id,session_id) DO NOTHING", eid, sid, timestamp(x.Now))
	return one(x.Ctx, x.Q, "SELECT * FROM attendance WHERE enrollment_id=? AND session_id=?", eid, sid)
}
func (x *request) approvedSession() M {
	s := x.getSession()
	if s["approved_proposal_id"] == nil {
		fail(409, "session_not_approved", "Buổi học chưa được duyệt.")
	}
	return s
}
func (a *App) attendanceRoutes() {
	base := "/student/classes/{classId}/sessions/{sessionId}"
	a.add("POST", base+"/attend", "student", false, true, func(x *request) any {
		m := x.body("enrollment_id code", "")
		e := x.cycle(m)
		s := x.approvedSession()
		if x.Now.Before(parseTime(str(s, "starts_at"))) || !x.Now.Before(parseTime(str(s, "ends_at"))) {
			fail(409, "attendance_closed", "Ngoài thời gian điểm danh.")
		}
		at := x.attendanceRow(integer(e, "id"), integer(s, "id"))
		if bval(at, "overridden") {
			return M{"attendance": at, "authoritative_override": true}
		}
		if bval(at, "attended") {
			return M{"attendance": at}
		}
		if integer(at, "wrong_count") >= 3 {
			fail(409, "attendance_locked", "Đã nhập sai ba lần. Liên hệ quản lý.")
		}
		if !secureEqual(text(m, "code"), str(s, "attendance_code")) {
			wrong := integer(at, "wrong_count") + 1
			exec(x.Ctx, x.Q, "UPDATE attendance SET wrong_count=?,updated_at=? WHERE id=?", wrong, timestamp(x.Now), integer(at, "id"))
			// Return error after commit: rejected code must still consume its durable try.
			return apiError{422, "wrong_attendance_code", "Mã điểm danh không đúng.", M{"remaining_attempts": 3 - wrong}}
		}
		exec(x.Ctx, x.Q, "UPDATE attendance SET attended=1,updated_at=? WHERE id=?", timestamp(x.Now), integer(at, "id"))
		return M{"attendance": x.attendanceRow(integer(e, "id"), integer(s, "id"))}
	})
	a.add("POST", base+"/absence", "student", true, true, func(x *request) any {
		m := x.body("enrollment_id reason", "")
		e := x.cycle(m)
		s := x.approvedSession()
		reason := name(m, "reason", 2000)
		if !x.Now.Before(parseTime(str(s, "ends_at"))) {
			fail(409, "session_ended", "Buổi học đã kết thúc.")
		}
		if count(x.Ctx, x.Q, "SELECT count(*) FROM attendance WHERE enrollment_id=? AND session_id=? AND attended=1", integer(e, "id"), integer(s, "id")) > 0 {
			fail(409, "already_attended", "Đã điểm danh; không thể xin nghỉ.")
		}
		if count(x.Ctx, x.Q, "SELECT count(*) FROM absences WHERE enrollment_id=? AND session_id=?", integer(e, "id"), integer(s, "id")) > 0 {
			fail(409, "absence_exists", "Đã xin nghỉ buổi này.")
		}
		aid := exec(x.Ctx, x.Q, "INSERT INTO absences(enrollment_id,session_id,reason,created_at) VALUES(?,?,?,?)", integer(e, "id"), integer(s, "id"), reason, timestamp(x.Now))
		x.notify([]int64{integer(x.getClass(), "manager_id")}, pathID(x.R, "classId"), "Học viên xin nghỉ", reason)
		return M{"absence": one(x.Ctx, x.Q, "SELECT * FROM absences WHERE id=?", aid), "status": "approved"}
	})
	a.add("POST", "/manager/classes/{classId}/sessions/{sessionId}/attendance/{enrollmentId}/override", "class_manager", false, true, func(x *request) any {
		m := x.body("attended reason", "")
		reason := name(m, "reason", 2000)
		attended := boolean(m, "attended")
		s := x.approvedSession()
		if x.Now.Before(parseTime(str(s, "starts_at"))) {
			fail(409, "session_not_started", "Buổi học chưa bắt đầu.")
		}
		e := one(x.Ctx, x.Q, "SELECT * FROM class_enrollments WHERE id=? AND class_id=? AND status='enrolled'", pathID(x.R, "enrollmentId"), pathID(x.R, "classId"))
		at := x.attendanceRow(integer(e, "id"), integer(s, "id"))
		exec(x.Ctx, x.Q, "UPDATE attendance SET attended=?,overridden=1,updated_at=? WHERE id=?", attended, timestamp(x.Now), integer(at, "id"))
		x.audit("attendance_override", integer(at, "id"), M{"attended": bval(at, "attended"), "overridden": bval(at, "overridden")}, M{"attended": attended, "overridden": true}, reason)
		x.notify([]int64{integer(e, "student_id")}, pathID(x.R, "classId"), "Điều chỉnh điểm danh", reason)
		return M{"attendance": x.attendanceRow(integer(e, "id"), integer(s, "id"))}
	})
	for _, r := range []struct{ prefix, role string }{{"admin", "admin"}, {"manager", "class_manager"}, {"student", "student"}} {
		a.add("GET", "/"+r.prefix+"/classes/{classId}/attendance", r.role, false, false, func(x *request) any {
			s := "SELECT a.*,e.student_id,e.cycle_number,e.status AS enrollment_status FROM attendance a JOIN class_enrollments e ON e.id=a.enrollment_id WHERE e.class_id=?"
			args := []any{pathID(x.R, "classId")}
			if str(x.User, "role") == "student" {
				s += " AND e.id=?"
				args = append(args, integer(x.currentEnrollment(), "id"))
			}
			return page(x.R, rows(x.Ctx, x.Q, s+" ORDER BY a.id", args...))
		})
	}
	for _, r := range []struct{ prefix, role string }{{"admin", "admin"}, {"manager", "class_manager"}} {
		a.add("GET", "/"+r.prefix+"/classes/{classId}/audit", r.role, false, false, func(x *request) any {
			return page(x.R, rows(x.Ctx, x.Q, "SELECT * FROM audit_log WHERE class_id=? ORDER BY id DESC", pathID(x.R, "classId")))
		})
		a.add("GET", "/"+r.prefix+"/classes/{classId}/absences", r.role, false, false, func(x *request) any {
			return page(x.R, rows(x.Ctx, x.Q, "SELECT a.*,e.student_id FROM absences a JOIN class_enrollments e ON e.id=a.enrollment_id WHERE e.class_id=? ORDER BY a.id DESC", pathID(x.R, "classId")))
		})
	}
}
