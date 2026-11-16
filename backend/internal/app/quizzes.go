package app

const quizKeys = "id class_id title description quiz_type duration_seconds open_at deadline pass_score attempt_limit is_published created_at updated_at"

func quizDTO(q M) M { o := pick(q, quizKeys); o["is_published"] = bval(q, "is_published"); return o }
func (x *request) getQuiz() M {
	return one(x.Ctx, x.Q, "SELECT * FROM quizzes WHERE id=? AND class_id=?", pathID(x.R, "quizId"), pathID(x.R, "classId"))
}
func (x *request) questions(qid int64, correct bool) []M {
	qs := rows(x.Ctx, x.Q, "SELECT id,question_text,sort_order FROM quiz_questions WHERE quiz_id=? ORDER BY sort_order,id", qid)
	for _, q := range qs {
		opts := rows(x.Ctx, x.Q, "SELECT id,option_text,is_correct,sort_order FROM quiz_options WHERE question_id=? ORDER BY sort_order,id", integer(q, "id"))
		for _, o := range opts {
			if correct {
				o["is_correct"] = bval(o, "is_correct")
			} else {
				delete(o, "is_correct")
			}
		}
		q["question_type"] = "single_choice"
		q["points"] = 1
		q["options"] = opts
	}
	return qs
}
func (x *request) quizInput() M {
	m := x.body("title description quiz_type duration_seconds open_at deadline pass_score questions", "attempt_limit")
	m["title"] = name(m, "title", 200)
	limited(m, "description", 10000)
	kind := enum(text(m, "quiz_type"), "test", "assignment")
	if id(m, "duration_seconds") > 31536000 {
		invalid()
	}
	open, end := parseTime(text(m, "open_at")), parseTime(text(m, "deadline"))
	if !open.Before(end) {
		invalid()
	}
	m["open_at"] = timestamp(open)
	m["deadline"] = timestamp(end)
	if n := num(m, "pass_score"); n < 0 || n > 100 {
		invalid()
	}
	if m["attempt_limit"] == nil {
		m["attempt_limit"] = 1
		if kind == "assignment" {
			m["attempt_limit"] = 10
		}
	}
	id(m, "attempt_limit")
	if kind == "test" && id(m, "attempt_limit") != 1 {
		invalid()
	}
	qs := arr(m, "questions")
	if len(qs) == 0 || len(qs) > 500 {
		invalid()
	}
	for _, raw := range qs {
		q, ok := raw.(map[string]any)
		if !ok {
			invalid()
		}
		shape(q, "question_text options", "")
		q["question_text"] = name(q, "question_text", 10000)
		opts := arr(q, "options")
		if len(opts) < 2 || len(opts) > 100 {
			invalid()
		}
		correct := 0
		for _, raw := range opts {
			o, ok := raw.(map[string]any)
			if !ok {
				invalid()
			}
			shape(o, "option_text is_correct", "")
			o["option_text"] = name(o, "option_text", 10000)
			if boolean(o, "is_correct") {
				correct++
			}
		}
		if correct != 1 {
			invalid()
		}
	}
	return m
}
func (x *request) saveQuestions(qid int64, m M) {
	for i, raw := range arr(m, "questions") {
		q := raw.(map[string]any)
		sid := exec(x.Ctx, x.Q, "INSERT INTO quiz_questions(quiz_id,question_text,sort_order) VALUES(?,?,?)", qid, q["question_text"], i)
		for j, raw := range arr(q, "options") {
			o := raw.(map[string]any)
			exec(x.Ctx, x.Q, "INSERT INTO quiz_options(question_id,option_text,is_correct,sort_order) VALUES(?,?,?,?)", sid, o["option_text"], boolean(o, "is_correct"), j)
		}
	}
}
func (x *request) freeze(qid int64) {
	if count(x.Ctx, x.Q, "SELECT count(*) FROM quiz_attempts WHERE quiz_id=?", qid) > 0 {
		fail(409, "quiz_frozen", "Bài đã có lượt làm; không thể thay đổi cấu hình.")
	}
}
func (a *App) quizRoutes() {
	for _, r := range []struct{ prefix, role string }{{"admin", "admin"}, {"manager", "class_manager"}, {"student", "student"}} {
		base := "/" + r.prefix + "/classes/{classId}/quizzes"
		a.add("GET", base, r.role, false, true, func(x *request) any {
			s := "SELECT * FROM quizzes WHERE class_id=?"
			if str(x.User, "role") == "student" {
				s += " AND is_published=1"
			}
			all := rows(x.Ctx, x.Q, s+" ORDER BY id", pathID(x.R, "classId"))
			for i, q := range all {
				all[i] = quizDTO(q)
				if str(x.User, "role") == "student" {
					e := x.currentEnrollment()
					deadline, allowed := x.quizAllowance(q, integer(e, "id"))
					all[i]["effective_deadline"] = timestamp(deadline)
					all[i]["allowed_attempts"] = allowed
					all[i]["used_attempts"] = count(x.Ctx, x.Q, "SELECT count(*) FROM quiz_attempts WHERE quiz_id=? AND enrollment_id=?", integer(q, "id"), integer(e, "id"))
					best := one(x.Ctx, x.Q, "SELECT max(score_percent) AS best_score_percent FROM quiz_attempts WHERE quiz_id=? AND enrollment_id=? AND status='submitted'", integer(q, "id"), integer(e, "id"))
					all[i]["best_score_percent"] = best["best_score_percent"]
					all[i]["is_passed"] = best["best_score_percent"] != nil && num(best, "best_score_percent") >= num(q, "pass_score")
				}
			}
			return page(x.R, all)
		})
		a.add("GET", base+"/{quizId}", r.role, false, false, func(x *request) any {
			q := x.getQuiz()
			staff := str(x.User, "role") != "student"
			if !staff && !bval(q, "is_published") {
				fail(404, "not_found", "Không tìm thấy bài.")
			}
			out := M{"quiz": quizDTO(q)}
			if staff {
				out["questions"] = x.questions(integer(q, "id"), true)
			}
			return out
		})
		if r.role != "student" {
			a.add("GET", base+"/{quizId}/attempts", r.role, false, true, func(x *request) any {
				q := x.getQuiz()
				all := rows(x.Ctx, x.Q, "SELECT * FROM quiz_attempts WHERE quiz_id=? ORDER BY enrollment_id,attempt_number", integer(q, "id"))
				out := []M{}
				for _, at := range all {
					out = append(out, M{"attempt": attemptDTO(at), "answers": answerList(str(at, "answers_json"))})
				}
				return page(x.R, out)
			})
		}
	}
	base := "/manager/classes/{classId}/quizzes"
	a.add("POST", base, "class_manager", true, true, func(x *request) any {
		m := x.quizInput()
		qid := exec(x.Ctx, x.Q, "INSERT INTO quizzes(class_id,title,description,quiz_type,duration_seconds,open_at,deadline,pass_score,attempt_limit,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)", pathID(x.R, "classId"), m["title"], m["description"], m["quiz_type"], id(m, "duration_seconds"), m["open_at"], m["deadline"], num(m, "pass_score"), id(m, "attempt_limit"), timestamp(x.Now), timestamp(x.Now))
		x.saveQuestions(qid, m)
		return M{"quiz": quizDTO(one(x.Ctx, x.Q, "SELECT * FROM quizzes WHERE id=?", qid)), "questions": x.questions(qid, true)}
	})
	a.add("PUT", base+"/{quizId}", "class_manager", false, true, func(x *request) any {
		q := x.getQuiz()
		qid := integer(q, "id")
		x.freeze(qid)
		m := x.quizInput()
		exec(x.Ctx, x.Q, "UPDATE quizzes SET title=?,description=?,quiz_type=?,duration_seconds=?,open_at=?,deadline=?,pass_score=?,attempt_limit=?,updated_at=? WHERE id=?", m["title"], m["description"], m["quiz_type"], id(m, "duration_seconds"), m["open_at"], m["deadline"], num(m, "pass_score"), id(m, "attempt_limit"), timestamp(x.Now), qid)
		exec(x.Ctx, x.Q, "DELETE FROM quiz_questions WHERE quiz_id=?", qid)
		x.saveQuestions(qid, m)
		return M{"quiz": quizDTO(x.getQuiz()), "questions": x.questions(qid, true)}
	})
	a.add("GET", base+"/{quizId}/preview", "class_manager", false, false, func(x *request) any {
		q := x.getQuiz()
		return M{"quiz": quizDTO(q), "questions": x.questions(integer(q, "id"), true)}
	})
	a.add("POST", base+"/{quizId}/publish", "class_manager", false, true, func(x *request) any {
		x.body("", "")
		q := x.getQuiz()
		if !bval(q, "is_published") {
			exec(x.Ctx, x.Q, "UPDATE quizzes SET is_published=1,updated_at=? WHERE id=?", timestamp(x.Now), integer(q, "id"))
			x.notify(x.classStudents(pathID(x.R, "classId")), pathID(x.R, "classId"), "Bài mới", str(q, "title"))
		}
		return M{"quiz": quizDTO(x.getQuiz())}
	})
	a.add("POST", base+"/{quizId}/grants", "class_manager", true, true, func(x *request) any {
		q := x.getQuiz()
		if !bval(q, "is_published") {
			invalid()
		}
		m := x.body("enrollment_ids reason deadline", "extra_attempts")
		eids := ids(m, "enrollment_ids")
		if len(eids) == 0 || len(eids) > 10000 {
			invalid()
		}
		reason := name(m, "reason", 2000)
		deadline := parseTime(text(m, "deadline"))
		if !deadline.After(x.Now) {
			invalid()
		}
		if m["extra_attempts"] == nil {
			m["extra_attempts"] = 1
		}
		extra := id(m, "extra_attempts")
		if str(q, "quiz_type") == "assignment" && extra > 10 {
			invalid()
		}
		students := []int64{}
		for _, eid := range eids {
			e := one(x.Ctx, x.Q, "SELECT e.* FROM class_enrollments e JOIN users u ON u.id=e.student_id WHERE e.id=? AND e.class_id=? AND e.status='enrolled' AND u.is_active=1", eid, pathID(x.R, "classId"))
			current, _ := x.quizAllowance(q, eid)
			if !deadline.After(current) {
				fail(422, "deadline_not_extended", "Hạn mới phải lớn hơn hạn hiệu lực của từng học viên.")
			}
			exec(x.Ctx, x.Q, "INSERT INTO quiz_retake_grants(quiz_id,enrollment_id,extra_attempts,deadline,reason,granted_by,created_at) VALUES(?,?,?,?,?,?,?)", integer(q, "id"), eid, extra, timestamp(deadline), reason, integer(x.User, "id"), timestamp(x.Now))
			students = append(students, integer(e, "student_id"))
		}
		x.notify(append(students, x.admins()...), pathID(x.R, "classId"), "Cấp thêm lượt làm bài", str(q, "title")+": "+reason)
		return M{"granted_enrollment_ids": eids, "extra_attempts": extra, "deadline": timestamp(deadline)}
	})
	a.attemptRoutes()
}
