package app

func (x *request) progress(e M) M {
	FinalizeDue(x.Ctx, x.Q, x.Now, 0)
	cid, eid := integer(e, "class_id"), integer(e, "id")
	c := one(x.Ctx, x.Q, "SELECT * FROM classes WHERE id=?", cid)
	total := int64(0)
	if c["total_sessions"] != nil {
		total = integer(c, "total_sessions")
	}
	attended := count(x.Ctx, x.Q, "SELECT count(*) FROM attendance a JOIN class_sessions s ON s.id=a.session_id WHERE a.enrollment_id=? AND a.attended=1 AND s.class_id=? AND s.approved_proposal_id IS NOT NULL", eid, cid)
	published := count(x.Ctx, x.Q, "SELECT count(*) FROM quizzes WHERE class_id=? AND is_published=1", cid)
	passed := count(x.Ctx, x.Q, "SELECT count(DISTINCT q.id) FROM quizzes q JOIN quiz_attempts a ON a.quiz_id=q.id WHERE q.class_id=? AND q.is_published=1 AND a.enrollment_id=? AND a.status='submitted' AND a.is_passed=1", cid, eid)
	attendancePercent, quizPercent := 0.0, 0.0
	if total > 0 {
		attendancePercent = float64(attended) / float64(total) * 100
	}
	if published > 0 {
		quizPercent = float64(passed) / float64(published) * 100
	}
	ended := int64(0)
	for _, s := range rows(x.Ctx, x.Q, "SELECT ends_at FROM class_sessions WHERE class_id=? AND approved_proposal_id IS NOT NULL", cid) {
		if !x.Now.Before(parseTime(str(s, "ends_at"))) {
			ended++
		}
	}
	reasons := []string{}
	if total == 0 {
		reasons = append(reasons, "total_sessions_not_set")
	} else if ended != total {
		reasons = append(reasons, "required_sessions_not_ended")
	}
	if attendancePercent < num(c, "min_attendance_percent") {
		reasons = append(reasons, "attendance_below_threshold")
	}
	if quizPercent < num(c, "min_quiz_percent") {
		reasons = append(reasons, "quiz_below_threshold")
	}
	return M{"enrollment_id": eid, "attendance_count": attended, "total_sessions": total, "attendance_percent": attendancePercent, "passed_quiz_count": passed, "published_quiz_count": published, "quiz_percent": quizPercent, "ended_sessions": ended, "completed": len(reasons) == 0, "incomplete_reasons": reasons}
}
func (a *App) dashboardRoutes() {
	for _, r := range []struct{ prefix, role string }{{"admin", "admin"}, {"manager", "class_manager"}, {"student", "student"}} {
		a.add("GET", "/"+r.prefix+"/dashboard", r.role, false, true, func(x *request) any {
			role := str(x.User, "role")
			s := "SELECT c.* FROM classes c"
			args := []any{}
			if role == "class_manager" {
				s += " WHERE manager_id=?"
				args = append(args, integer(x.User, "id"))
			}
			if role == "student" {
				s += " WHERE EXISTS(SELECT 1 FROM class_enrollments e WHERE e.class_id=c.id AND e.student_id=?)"
				args = append(args, integer(x.User, "id"))
			}
			classes := rows(x.Ctx, x.Q, s+" ORDER BY c.id", args...)
			out := []M{}
			enrollmentCount := 0
			for _, c := range classes {
				es := "SELECT * FROM class_enrollments WHERE class_id=?"
				ea := []any{integer(c, "id")}
				if role == "student" {
					es += " AND student_id=?"
					ea = append(ea, integer(x.User, "id"))
				}
				enrollments := rows(x.Ctx, x.Q, es+" ORDER BY id DESC", ea...)
				summaries := []M{}
				for _, e := range enrollments {
					if str(e, "status") == "enrolled" {
						enrollmentCount++
					}
					summaries = append(summaries, M{"enrollment": e, "progress": x.progress(e)})
				}
				class := x.class(c)
				if role == "student" {
					class = pick(c, "id code name end_date")
				}
				out = append(out, M{"class": class, "enrollments": summaries})
			}
			response := M{"classes": out, "enrolled_count": enrollmentCount, "unread_count": count(x.Ctx, x.Q, "SELECT count(*) FROM announcement_recipients WHERE user_id=? AND is_read=0", integer(x.User, "id"))}
			if role == "admin" {
				response["student_count"] = count(x.Ctx, x.Q, "SELECT count(*) FROM users WHERE role='student'")
				response["manager_count"] = count(x.Ctx, x.Q, "SELECT count(*) FROM users WHERE role='class_manager'")
				response["pending_schedules"] = count(x.Ctx, x.Q, "SELECT count(*) FROM schedule_proposals WHERE status='pending'")
			}
			response["agenda"] = x.dashboardAgenda(classes)
			return response
		})
		a.add("GET", "/"+r.prefix+"/classes/{classId}/progress", r.role, false, true, func(x *request) any {
			if str(x.User, "role") == "student" {
				return M{"progress": x.progress(x.currentEnrollment())}
			}
			all := rows(x.Ctx, x.Q, "SELECT * FROM class_enrollments WHERE class_id=? ORDER BY id", pathID(x.R, "classId"))
			out := []M{}
			for _, e := range all {
				out = append(out, M{"enrollment": e, "progress": x.progress(e)})
			}
			return page(x.R, out)
		})
	}
}
