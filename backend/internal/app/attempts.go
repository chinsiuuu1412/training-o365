package app

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"o365-lms/backend/internal/db"
	"regexp"
	"sort"
	"strconv"
	"time"
)

var uuidPattern = regexp.MustCompile(`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$`)

func attemptDTO(at M) M {
	o := pick(at, "id quiz_id student_id enrollment_id attempt_number status started_at effective_deadline effective_cutoff_at submitted_at time_spent_seconds score max_score score_percent is_passed draft_revision")
	if str(at, "status") == "submitted" {
		o["is_passed"] = bval(at, "is_passed")
	}
	return o
}
func answerMap(s string) map[string][]int64 {
	out := map[string][]int64{}
	must(json.Unmarshal([]byte(s), &out))
	return out
}
func answerList(s string) []M {
	m := answerMap(s)
	keys := []int{}
	for k := range m {
		i, e := strconv.Atoi(k)
		must(e)
		keys = append(keys, i)
	}
	sort.Ints(keys)
	out := []M{}
	for _, i := range keys {
		k := strconv.Itoa(i)
		out = append(out, M{"question_id": i, "option_ids": m[k]})
	}
	return out
}
func (x *request) validateAnswers(qid int64, m M) string {
	out := map[string][]int64{}
	seen := map[int64]bool{}
	for _, raw := range arr(m, "answers") {
		v, ok := raw.(map[string]any)
		if !ok {
			invalid()
		}
		shape(v, "question_id option_ids", "")
		sid := id(v, "question_id")
		if seen[sid] || count(x.Ctx, x.Q, "SELECT count(*) FROM quiz_questions WHERE id=? AND quiz_id=?", sid, qid) != 1 {
			fail(422, "invalid_answers", "Câu hỏi không hợp lệ.")
		}
		seen[sid] = true
		opts := ids(v, "option_ids")
		if len(opts) > 1 || len(opts) != len(arr(v, "option_ids")) {
			fail(422, "invalid_answers", "Chỉ chọn một đáp án.")
		}
		if len(opts) > 0 {
			if count(x.Ctx, x.Q, "SELECT count(*) FROM quiz_options WHERE id=? AND question_id=?", opts[0], sid) != 1 {
				fail(422, "invalid_answers", "Lựa chọn không hợp lệ.")
			}
			out[strconv.FormatInt(sid, 10)] = opts
		}
	}
	return jsonText(out)
}
func (x *request) attemptResult(at M) M {
	return M{"attempt": attemptDTO(at), "answers": answerList(str(at, "answers_json")), "review": nil}
}
func (x *request) runner(at, q M) M {
	if str(at, "status") == "submitted" {
		return x.attemptResult(at)
	}
	return M{"attempt": attemptDTO(at), "quiz": quizDTO(q), "questions": x.questions(integer(q, "id"), false), "answers": answerList(str(at, "answers_json")), "review": nil}
}
func (x *request) quizAllowance(q M, eid int64) (time.Time, int64) {
	deadline := parseTime(str(q, "deadline"))
	allowed := integer(q, "attempt_limit")
	for _, g := range rows(x.Ctx, x.Q, "SELECT * FROM quiz_retake_grants WHERE quiz_id=? AND enrollment_id=?", integer(q, "id"), eid) {
		allowed += integer(g, "extra_attempts")
		d := parseTime(str(g, "deadline"))
		if d.After(deadline) {
			deadline = d
		}
	}
	return deadline, allowed
}
func (x *request) getAttempt() (M, M) {
	e := x.currentEnrollment()
	at := one(x.Ctx, x.Q, "SELECT a.* FROM quiz_attempts a JOIN quizzes q ON q.id=a.quiz_id WHERE a.id=? AND a.student_id=? AND a.enrollment_id=? AND q.class_id=?", pathID(x.R, "attemptId"), integer(x.User, "id"), integer(e, "id"), pathID(x.R, "classId"))
	return at, one(x.Ctx, x.Q, "SELECT * FROM quizzes WHERE id=?", integer(at, "quiz_id"))
}
func (x *request) idempotent(m M, eid int64, fn func() any) any {
	key := x.R.Header.Get("Idempotency-Key")
	if !uuidPattern.MatchString(key) {
		invalid()
	}
	sum := sha256.Sum256([]byte(jsonText(m)))
	hash := hex.EncodeToString(sum[:])
	uid := integer(x.User, "id")
	prior := rows(x.Ctx, x.Q, "SELECT * FROM idempotency_keys WHERE user_id=? AND method=? AND path=? AND idempotency_key=?", uid, x.R.Method, x.R.URL.Path, key)
	if len(prior) > 0 {
		p := prior[0]
		if integer(p, "enrollment_id") != eid {
			fail(409, "stale_idempotency_key", "Mã yêu cầu thuộc lần ghi danh cũ.")
		}
		if hash != str(p, "request_hash") {
			fail(409, "idempotency_key_reused", "Mã yêu cầu đã được dùng với nội dung khác.")
		}
		return readJSON(str(p, "response_json"))
	}
	out := fn()
	exec(x.Ctx, x.Q, "INSERT INTO idempotency_keys(user_id,enrollment_id,method,path,idempotency_key,request_hash,response_json,created_at) VALUES(?,?,?,?,?,?,?,?)", uid, eid, x.R.Method, x.R.URL.Path, key, hash, jsonText(out), timestamp(x.Now))
	return out
}
func grade(ctx context.Context, q db.Queryer, at M, now time.Time) {
	quiz := one(ctx, q, "SELECT * FROM quizzes WHERE id=?", integer(at, "quiz_id"))
	answers := answerMap(str(at, "answers_json"))
	score, total := 0.0, 0.0
	for _, question := range rows(ctx, q, "SELECT id FROM quiz_questions WHERE quiz_id=?", integer(quiz, "id")) {
		total++
		correct := one(ctx, q, "SELECT id FROM quiz_options WHERE question_id=? AND is_correct=1", integer(question, "id"))
		selected := answers[str(question, "id")]
		if len(selected) == 1 && selected[0] == integer(correct, "id") {
			score++
		}
	}
	percent := 0.0
	if total > 0 {
		percent = score / total * 100
	}
	cut := parseTime(str(at, "effective_cutoff_at"))
	if now.After(cut) {
		now = cut
	}
	elapsed := now.Sub(parseTime(str(at, "started_at"))).Seconds()
	if elapsed < 0 {
		elapsed = 0
	}
	r, err := q.ExecContext(ctx, "UPDATE quiz_attempts SET status='submitted',submitted_at=?,time_spent_seconds=?,score=?,max_score=?,score_percent=?,is_passed=? WHERE id=? AND status='in_progress'", timestamp(now), int64(elapsed), score, total, percent, percent >= num(quiz, "pass_score"), integer(at, "id"))
	must(err)
	changed, err := r.RowsAffected()
	must(err)
	if changed == 1 {
		x := &request{Ctx: ctx, Q: q, Now: now}
		x.notify([]int64{integer(at, "student_id")}, integer(quiz, "class_id"), "Kết quả Quiz", fmt.Sprintf("Bài làm #%d (Quiz #%d, lần ghi danh #%d): %.2f%%.", integer(at, "id"), integer(at, "quiz_id"), integer(at, "enrollment_id"), percent))
	}
}
func FinalizeDue(ctx context.Context, q db.Queryer, now time.Time, limit int) {
	// julianday only prefilters. Go compares exact nanoseconds, never rounded SQLite time.
	all := rows(ctx, q, "SELECT * FROM quiz_attempts WHERE status='in_progress' AND julianday(effective_cutoff_at)<=julianday(?) ORDER BY effective_cutoff_at,id", timestamp(now))
	done := 0
	for _, at := range all {
		cut := parseTime(str(at, "effective_cutoff_at"))
		if now.Before(cut) {
			continue
		}
		grade(ctx, q, at, cut)
		done++
		if limit > 0 && done >= limit {
			break
		}
	}
}
func (a *App) attemptRoutes() {
	base := "/student/classes/{classId}"
	a.add("POST", base+"/quizzes/{quizId}/start", "student", false, true, func(x *request) any {
		m := x.body("enrollment_id", "")
		e := x.cycle(m)
		q := x.getQuiz()
		eid, qid := integer(e, "id"), integer(q, "id")
		// Idempotency rows hold identity, not stale mutable runner snapshots.
		x.idempotent(m, eid, func() any {
			if !bval(q, "is_published") {
				fail(409, "quiz_not_available", "Bài chưa được xuất bản.")
			}
			active := rows(x.Ctx, x.Q, "SELECT * FROM quiz_attempts WHERE quiz_id=? AND enrollment_id=? AND status='in_progress'", qid, eid)
			if len(active) > 0 {
				return M{"attempt_id": active[0]["id"]}
			}
			deadline, allowed := x.quizAllowance(q, eid)
			if x.Now.Before(parseTime(str(q, "open_at"))) || !x.Now.Before(deadline) {
				fail(409, "quiz_not_available", "Bài chưa mở hoặc đã hết hạn.")
			}
			used := count(x.Ctx, x.Q, "SELECT count(*) FROM quiz_attempts WHERE quiz_id=? AND enrollment_id=?", qid, eid)
			if used >= allowed {
				fail(409, "attempt_limit_reached", "Bạn đã hết lượt làm bài.")
			}
			cutoff := x.Now.Add(time.Duration(integer(q, "duration_seconds")) * time.Second)
			if deadline.Before(cutoff) {
				cutoff = deadline
			}
			aid := exec(x.Ctx, x.Q, "INSERT INTO quiz_attempts(quiz_id,student_id,enrollment_id,attempt_number,status,started_at,effective_deadline,effective_cutoff_at) VALUES(?,?,?,?,'in_progress',?,?,?)", qid, integer(x.User, "id"), eid, used+1, timestamp(x.Now), timestamp(deadline), timestamp(cutoff))
			return M{"attempt_id": aid}
		})
		p := one(x.Ctx, x.Q, "SELECT response_json FROM idempotency_keys WHERE user_id=? AND method=? AND path=? AND idempotency_key=?", integer(x.User, "id"), x.R.Method, x.R.URL.Path, x.R.Header.Get("Idempotency-Key"))
		identity := readJSON(str(p, "response_json")).(map[string]any)
		at := one(x.Ctx, x.Q, "SELECT * FROM quiz_attempts WHERE id=? AND enrollment_id=?", id(identity, "attempt_id"), eid)
		return x.runner(at, q)
	})
	a.add("GET", base+"/quizzes/{quizId}/active-attempt", "student", false, true, func(x *request) any {
		q := x.getQuiz()
		e := x.currentEnrollment()
		at := one(x.Ctx, x.Q, "SELECT * FROM quiz_attempts WHERE quiz_id=? AND enrollment_id=? AND status='in_progress'", integer(q, "id"), integer(e, "id"))
		return x.runner(at, q)
	})
	a.add("GET", base+"/quizzes/{quizId}/attempts", "student", false, true, func(x *request) any {
		q := x.getQuiz()
		e := x.currentEnrollment()
		out := []M{}
		for _, at := range rows(x.Ctx, x.Q, "SELECT * FROM quiz_attempts WHERE quiz_id=? AND enrollment_id=? ORDER BY attempt_number DESC", integer(q, "id"), integer(e, "id")) {
			out = append(out, x.attemptResult(at))
		}
		return page(x.R, out)
	})
	a.add("GET", base+"/quiz-attempts/{attemptId}", "student", false, true, func(x *request) any { at, q := x.getAttempt(); return x.runner(at, q) })
	a.add("PUT", base+"/quiz-attempts/{attemptId}/draft", "student", false, true, func(x *request) any {
		m := x.body("enrollment_id expected_revision answers", "")
		x.cycle(m)
		at, q := x.getAttempt()
		if !x.Now.Before(parseTime(str(at, "effective_cutoff_at"))) {
			fail(410, "attempt_expired", "Bài đã hết thời gian.")
		}
		if str(at, "status") != "in_progress" {
			fail(409, "attempt_already_submitted", "Bài đã được nộp.")
		}
		revision := integer(m, "expected_revision")
		if revision != integer(at, "draft_revision") {
			fail(409, "draft_revision_conflict", "Bản lưu đã thay đổi. Vui lòng tải lại.")
		}
		answers := x.validateAnswers(integer(q, "id"), m)
		exec(x.Ctx, x.Q, "UPDATE quiz_attempts SET answers_json=?,draft_revision=draft_revision+1 WHERE id=?", answers, integer(at, "id"))
		return M{"attempt_id": at["id"], "draft_revision": revision + 1}
	})
	a.add("POST", base+"/quiz-attempts/{attemptId}/submit", "student", false, true, func(x *request) any {
		m := x.body("enrollment_id expected_revision", "")
		e := x.cycle(m)
		at, q := x.getAttempt()
		return x.idempotent(m, integer(e, "id"), func() any {
			if str(at, "status") == "submitted" {
				return x.attemptResult(at)
			}
			if integer(m, "expected_revision") != integer(at, "draft_revision") {
				fail(409, "draft_revision_conflict", "Bản lưu đã thay đổi.")
			}
			if str(q, "quiz_type") == "test" && x.Now.Sub(parseTime(str(at, "started_at")))*3 < time.Duration(integer(q, "duration_seconds"))*time.Second*2 {
				fail(422, "early_submission", "Chỉ được nộp sau hai phần ba thời gian.")
			}
			grade(x.Ctx, x.Q, at, x.Now)
			at, _ = x.getAttempt()
			return x.attemptResult(at)
		})
	})
}
