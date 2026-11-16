package app

import (
	"context"
	"fmt"
	"sync"
	"testing"
	"time"
)

func replenish(a *App) { a.limitsMu.Lock(); a.limits = map[string]bucket{}; a.limitsMu.Unlock() }
func fixture(t *testing.T) (*App, *client, *client, *client, M) {
	t.Helper()
	a, admin := setup(t)
	manager := createUser(t, admin, "manager@example.test", "class_manager")
	student := createUser(t, admin, "student@sis.hust.edu.vn", "student")
	c := createClass(t, admin, manager)
	mgr := loginClient(t, a, "manager@example.test", "test-password-123")
	stu := loginClient(t, a, "student@sis.hust.edu.vn", "test-password-123")
	enroll(t, mgr, stu, c, "Học MOS")
	_ = student
	return a, admin, mgr, stu, c
}
func enroll(t *testing.T, mgr, stu *client, c M, reason string) M {
	t.Helper()
	replenish(stu.App)
	s, m := stu.call("POST", classPath("student", c)+"/enrollment-requests", M{"reason": reason})
	requireStatus(t, 201, s, m)
	r := result(m)["request"].(map[string]any)
	s, m = mgr.call("POST", fmt.Sprintf("%s/enrollment-requests/%.0f/review", classPath("manager", c), num(r, "id")), M{"decision": "approve"})
	requireStatus(t, 200, s, m)
	return one(context.Background(), mgr.App.DB.Reader, "SELECT * FROM class_enrollments WHERE class_id=? AND student_id=? AND status='enrolled'", id(c, "id"), userID(t, stu))
}
func userID(t *testing.T, c *client) int64 {
	t.Helper()
	s, m := c.call("GET", "/auth/me", nil)
	requireStatus(t, 200, s, m)
	return id(result(m)["user"].(map[string]any), "id")
}
func enrollment(t *testing.T, c *client, cl M) M {
	t.Helper()
	return one(context.Background(), c.App.DB.Reader, "SELECT * FROM class_enrollments WHERE class_id=? AND student_id=? AND status='enrolled'", id(cl, "id"), userID(t, c))
}
func key(i int) map[string]string {
	return map[string]string{"Idempotency-Key": fmt.Sprintf("00000000-0000-4000-8000-%012d", i)}
}
func newQuiz(t *testing.T, mgr *client, c M, kind string, duration int) (M, []M) {
	t.Helper()
	replenish(mgr.App)
	now := mgr.App.Now()
	input := quizInputFor(now, kind, duration)
	s, m := mgr.call("POST", classPath("manager", c)+"/quizzes", input)
	requireStatus(t, 201, s, m)
	q := result(m)["quiz"].(map[string]any)
	qs := result(m)["questions"].([]any)
	answers := []M{}
	for _, raw := range qs {
		question := raw.(map[string]any)
		for _, raw := range question["options"].([]any) {
			o := raw.(map[string]any)
			if bval(o, "is_correct") {
				answers = append(answers, M{"question_id": question["id"], "option_ids": []any{o["id"]}})
			}
		}
	}
	s, m = mgr.call("GET", fmt.Sprintf("%s/quizzes/%.0f/preview", classPath("manager", c), num(q, "id")), nil)
	requireStatus(t, 200, s, m)
	s, m = mgr.call("POST", fmt.Sprintf("%s/quizzes/%.0f/publish", classPath("manager", c), num(q, "id")), M{})
	requireStatus(t, 200, s, m)
	return result(m)["quiz"].(map[string]any), answers
}
func quizInputFor(now time.Time, kind string, duration int) M {
	return M{"title": "MOS quiz", "description": "", "quiz_type": kind, "duration_seconds": duration, "open_at": timestamp(now.Add(-time.Hour)), "deadline": timestamp(now.Add(2 * time.Hour)), "pass_score": 60, "questions": []M{{"question_text": "Một cộng một?", "options": []M{{"option_text": "Hai", "is_correct": true}, {"option_text": "Ba", "is_correct": false}}}, {"question_text": "Hai cộng hai?", "options": []M{{"option_text": "Bốn", "is_correct": true}, {"option_text": "Năm", "is_correct": false}}}}}
}
func start(t *testing.T, stu *client, c, q M, k int) M {
	t.Helper()
	e := enrollment(t, stu, c)
	s, m := stu.callHeaders("POST", fmt.Sprintf("%s/quizzes/%.0f/start", classPath("student", c), num(q, "id")), M{"enrollment_id": e["id"]}, key(k))
	requireStatus(t, 200, s, m)
	return result(m)["attempt"].(map[string]any)
}
func attemptPath(c, at M) string {
	return fmt.Sprintf("%s/quiz-attempts/%.0f", classPath("student", c), num(at, "id"))
}
func save(t *testing.T, stu *client, c, at M, revision int, answers []M) {
	t.Helper()
	e := enrollment(t, stu, c)
	s, m := stu.call("PUT", attemptPath(c, at)+"/draft", M{"enrollment_id": e["id"], "expected_revision": revision, "answers": answers})
	requireStatus(t, 200, s, m)
}
func schedule(t *testing.T, admin, mgr *client, c M, number int, start, end time.Time) M {
	t.Helper()
	replenish(mgr.App)
	base := classPath("manager", c)
	if count(context.Background(), mgr.App.DB.Reader, "SELECT count(*) FROM classes WHERE id=? AND total_sessions IS NOT NULL", id(c, "id")) == 0 {
		s, m := mgr.call("PUT", base+"/total-sessions", M{"total_sessions": 3})
		requireStatus(t, 200, s, m)
	}
	s, m := mgr.call("POST", base+"/sessions", M{"session_number": number, "title": "Buổi MOS", "description": "", "location": "HUST", "attendance_code": "123456"})
	requireStatus(t, 201, s, m)
	session := result(m)["session"].(map[string]any)
	p := draftSchedule(t, mgr, c, session, start, end)
	s, m = mgr.call("POST", proposalPath("manager", c, session, p)+"/submit", M{})
	requireStatus(t, 200, s, m)
	s, m = admin.call("POST", proposalPath("admin", c, session, p)+"/review", M{"decision": "approve"})
	requireStatus(t, 200, s, m)
	return result(m)["session"].(map[string]any)
}
func draftSchedule(t *testing.T, mgr *client, c, s M, start, end time.Time) M {
	t.Helper()
	status, m := mgr.call("PUT", fmt.Sprintf("%s/sessions/%.0f/schedule-draft", classPath("manager", c), num(s, "id")), M{"starts_at": timestamp(start), "ends_at": timestamp(end)})
	requireStatus(t, 200, status, m)
	return result(m)["proposal"].(map[string]any)
}
func proposalPath(prefix string, c, s, p M) string {
	return fmt.Sprintf("%s/sessions/%.0f/schedule-proposals/%.0f", classPath(prefix, c), num(s, "id"), num(p, "id"))
}
func setClock(a *App, now time.Time) { a.Now = func() time.Time { return now } }
func clone(c *client) *client {
	return &client{App: c.App, Cookie: c.Cookie, CSRF: c.CSRF, t: c.t, Coverage: &sync.Map{}}
}
