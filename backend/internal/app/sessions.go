package app

func (x *request) getSession() M {
	return one(x.Ctx, x.Q, "SELECT * FROM class_sessions WHERE id=? AND class_id=?", pathID(x.R, "sessionId"), pathID(x.R, "classId"))
}
func (x *request) notStarted(s M) {
	if s["starts_at"] != nil && !x.Now.Before(parseTime(str(s, "starts_at"))) {
		fail(409, "session_started", "Không thể đổi lịch buổi đang diễn ra hoặc đã kết thúc.")
	}
}
func sessionDTO(s M, staff bool) M {
	o := pick(s, "id class_id session_number title description location starts_at ends_at approved_proposal_id")
	if staff {
		o["attendance_code"] = s["attendance_code"]
	}
	return o
}
func (a *App) sessionRoutes() {
	for _, r := range []struct{ prefix, role string }{{"admin", "admin"}, {"manager", "class_manager"}, {"student", "student"}} {
		base := "/" + r.prefix + "/classes/{classId}/sessions"
		a.add("GET", base, r.role, false, false, func(x *request) any {
			all := rows(x.Ctx, x.Q, "SELECT * FROM class_sessions WHERE class_id=? ORDER BY session_number", pathID(x.R, "classId"))
			out := []M{}
			for _, s := range all {
				if str(x.User, "role") == "student" && s["approved_proposal_id"] == nil {
					continue
				}
				out = append(out, sessionDTO(s, str(x.User, "role") != "student"))
			}
			return page(x.R, out)
		})
		a.add("GET", base+"/{sessionId}", r.role, false, false, func(x *request) any {
			s := x.getSession()
			if str(x.User, "role") == "student" && s["approved_proposal_id"] == nil {
				fail(404, "not_found", "Buổi học chưa được duyệt.")
			}
			out := M{"session": sessionDTO(s, str(x.User, "role") != "student")}
			if str(x.User, "role") != "student" {
				out["proposals"] = rows(x.Ctx, x.Q, "SELECT * FROM schedule_proposals WHERE session_id=? ORDER BY id DESC", integer(s, "id"))
			}
			return out
		})
	}
	a.add("POST", "/manager/classes/{classId}/sessions", "class_manager", true, true, func(x *request) any {
		m := x.body("session_number title description location attendance_code", "")
		c := x.getClass()
		number := id(m, "session_number")
		if c["total_sessions"] == nil || number > integer(c, "total_sessions") {
			invalid()
		}
		if count(x.Ctx, x.Q, "SELECT count(*) FROM class_sessions WHERE class_id=? AND session_number=?", integer(c, "id"), number) > 0 {
			fail(409, "session_exists", "Buổi học đã tồn tại.")
		}
		sid := exec(x.Ctx, x.Q, "INSERT INTO class_sessions(class_id,session_number,title,description,location,attendance_code) VALUES(?,?,?,?,?,?)", integer(c, "id"), number, name(m, "title", 200), limited(m, "description", 10000), limited(m, "location", 2000), name(m, "attendance_code", 100))
		return M{"session": sessionDTO(one(x.Ctx, x.Q, "SELECT * FROM class_sessions WHERE id=?", sid), true)}
	})
	a.add("PUT", "/manager/classes/{classId}/sessions/{sessionId}/schedule-draft", "class_manager", false, true, func(x *request) any {
		s := x.getSession()
		x.notStarted(s)
		m := x.body("starts_at ends_at", "")
		start, end := parseTime(text(m, "starts_at")), parseTime(text(m, "ends_at"))
		if !end.After(start) || !start.After(x.Now) {
			invalid()
		}
		open := rows(x.Ctx, x.Q, "SELECT * FROM schedule_proposals WHERE session_id=? AND status IN ('draft','pending')", integer(s, "id"))
		var pid int64
		if len(open) > 0 {
			if str(open[0], "status") == "pending" {
				fail(409, "schedule_pending", "Đã có lịch chờ duyệt.")
			}
			pid = integer(open[0], "id")
			exec(x.Ctx, x.Q, "UPDATE schedule_proposals SET starts_at=?,ends_at=?,proposed_by=? WHERE id=?", timestamp(start), timestamp(end), integer(x.User, "id"), pid)
		} else {
			pid = exec(x.Ctx, x.Q, "INSERT INTO schedule_proposals(session_id,proposed_by,starts_at,ends_at,status,created_at) VALUES(?,?,?,?,'draft',?)", integer(s, "id"), integer(x.User, "id"), timestamp(start), timestamp(end), timestamp(x.Now))
		}
		return M{"proposal": one(x.Ctx, x.Q, "SELECT * FROM schedule_proposals WHERE id=?", pid)}
	})
	a.add("POST", "/manager/classes/{classId}/sessions/{sessionId}/schedule-proposals/{proposalId}/submit", "class_manager", false, true, func(x *request) any {
		x.body("", "")
		s := x.getSession()
		x.notStarted(s)
		p := one(x.Ctx, x.Q, "SELECT * FROM schedule_proposals WHERE id=? AND session_id=?", pathID(x.R, "proposalId"), integer(s, "id"))
		if str(p, "status") != "draft" {
			fail(409, "proposal_processed", "Đề xuất không còn là bản nháp.")
		}
		if !x.Now.Before(parseTime(str(p, "starts_at"))) {
			invalid()
		}
		exec(x.Ctx, x.Q, "UPDATE schedule_proposals SET status='pending' WHERE id=?", integer(p, "id"))
		x.notify(x.admins(), pathID(x.R, "classId"), "Lịch chờ duyệt", str(s, "title"))
		return M{"proposal": one(x.Ctx, x.Q, "SELECT * FROM schedule_proposals WHERE id=?", integer(p, "id"))}
	})
	a.add("GET", "/admin/schedule-proposals", "admin", false, false, func(x *request) any {
		return page(x.R, rows(x.Ctx, x.Q, "SELECT p.*,s.class_id,s.session_number,s.title FROM schedule_proposals p JOIN class_sessions s ON s.id=p.session_id WHERE p.status='pending' ORDER BY p.id"))
	})
	a.add("POST", "/admin/classes/{classId}/sessions/{sessionId}/schedule-proposals/{proposalId}/review", "admin", false, true, func(x *request) any {
		s := x.getSession()
		x.notStarted(s)
		m := x.body("decision", "reason")
		decision := enum(text(m, "decision"), "approve", "reject")
		reason := ""
		if decision == "reject" {
			reason = name(m, "reason", 2000)
		}
		p := one(x.Ctx, x.Q, "SELECT * FROM schedule_proposals WHERE id=? AND session_id=?", pathID(x.R, "proposalId"), integer(s, "id"))
		if str(p, "status") != "pending" {
			fail(409, "proposal_processed", "Đề xuất đã được xử lý.")
		}
		state := "rejected"
		if decision == "approve" {
			if !x.Now.Before(parseTime(str(p, "starts_at"))) {
				fail(409, "schedule_in_past", "Lịch đã tới giờ bắt đầu.")
			}
			state = "approved"
			exec(x.Ctx, x.Q, "UPDATE class_sessions SET starts_at=?,ends_at=?,approved_proposal_id=? WHERE id=?", p["starts_at"], p["ends_at"], integer(p, "id"), integer(s, "id"))
		}
		exec(x.Ctx, x.Q, "UPDATE schedule_proposals SET status=?,reason=?,reviewed_by=?,reviewed_at=? WHERE id=?", state, reason, integer(x.User, "id"), timestamp(x.Now), integer(p, "id"))
		recipients := []int64{integer(x.getClass(), "manager_id")}
		if decision == "approve" {
			recipients = append(recipients, x.classStudents(pathID(x.R, "classId"))...)
		}
		x.notify(recipients, pathID(x.R, "classId"), "Lịch: "+state, str(s, "title")+" "+reason)
		return M{"session": sessionDTO(x.getSession(), true), "proposal": one(x.Ctx, x.Q, "SELECT * FROM schedule_proposals WHERE id=?", integer(p, "id"))}
	})
}
