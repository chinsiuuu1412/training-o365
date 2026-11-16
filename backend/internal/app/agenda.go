package app

import "sort"

// Agenda includes active content only; historical summaries stay separate.
func (x *request) dashboardAgenda(classes []M) M {
	sessions, quizzes, active := []M{}, []M{}, []M{}
	pendingRequests := int64(0)
	role := str(x.User, "role")
	for _, c := range classes {
		if archived(c, x.Now) {
			continue
		}
		cid := integer(c, "id")
		var eid int64
		if role == "student" {
			es := rows(x.Ctx, x.Q, "SELECT id FROM class_enrollments WHERE class_id=? AND student_id=? AND status='enrolled'", cid, integer(x.User, "id"))
			if len(es) == 0 {
				continue
			}
			eid = integer(es[0], "id")
		}
		if role != "student" {
			pendingRequests += count(x.Ctx, x.Q, "SELECT count(*) FROM enrollment_requests WHERE class_id=? AND status='pending'", cid)
		}
		for _, s := range rows(x.Ctx, x.Q, "SELECT * FROM class_sessions WHERE class_id=? AND approved_proposal_id IS NOT NULL", cid) {
			if x.Now.Before(parseTime(str(s, "ends_at"))) {
				sessions = append(sessions, sessionDTO(s, false))
			}
		}
		for _, q := range rows(x.Ctx, x.Q, "SELECT * FROM quizzes WHERE class_id=? AND is_published=1", cid) {
			o := quizDTO(q)
			deadline := parseTime(str(q, "deadline"))
			if role == "student" {
				d, allowed := x.quizAllowance(q, eid)
				deadline = d
				o["effective_deadline"] = timestamp(d)
				o["allowed_attempts"] = allowed
				for _, at := range rows(x.Ctx, x.Q, "SELECT * FROM quiz_attempts WHERE quiz_id=? AND enrollment_id=? AND status='in_progress'", integer(q, "id"), eid) {
					active = append(active, M{"attempt": attemptDTO(at), "quiz": quizDTO(q)})
				}
			}
			if x.Now.Before(deadline) {
				quizzes = append(quizzes, o)
			}
		}
	}
	sort.Slice(sessions, func(i, j int) bool {
		return parseTime(str(sessions[i], "starts_at")).Before(parseTime(str(sessions[j], "starts_at")))
	})
	sort.Slice(quizzes, func(i, j int) bool {
		a, b := str(quizzes[i], "deadline"), str(quizzes[j], "deadline")
		if quizzes[i]["effective_deadline"] != nil {
			a = str(quizzes[i], "effective_deadline")
		}
		if quizzes[j]["effective_deadline"] != nil {
			b = str(quizzes[j], "effective_deadline")
		}
		return parseTime(a).Before(parseTime(b))
	})
	return M{"upcoming_sessions": sessions, "quizzes": quizzes, "active_attempts": active, "pending_enrollment_requests": pendingRequests}
}
