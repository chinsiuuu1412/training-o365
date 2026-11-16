package app

import (
	"context"
	"fmt"
	"o365-lms/backend/internal/db"
	"testing"
	"time"
)

func TestV2RestartPersistsWrongThreeAndWorkerFinalizes(t *testing.T) {
	a, admin, mgr, stu, c := fixture(t)
	now := time.Now().UTC()
	setClock(a, now)
	session := schedule(t, admin, mgr, c, 1, now.Add(time.Hour), now.Add(2*time.Hour))
	setClock(a, now.Add(time.Hour))
	replenish(a)
	e := enrollment(t, stu, c)
	path := fmt.Sprintf("%s/sessions/%.0f/attend", classPath("student", c), num(session, "id"))
	for i := 0; i < 3; i++ {
		s, m := stu.call("POST", path, M{"enrollment_id": e["id"], "code": "bad"})
		requireStatus(t, 422, s, m)
	}
	q, answers := newQuiz(t, mgr, c, "assignment", 1)
	at := start(t, stu, c, q, 1)
	save(t, stu, c, at, 0, answers)
	a.DB.Close()
	d, err := db.OpenExisting(context.Background(), a.Config.DBPath, 4)
	if err != nil {
		t.Fatal(err)
	}
	defer d.Close()
	restarted := New(a.Config, d)
	setClock(restarted, now.Add(time.Hour))
	stu.App = restarted
	s, m := stu.call("POST", path, M{"enrollment_id": e["id"], "code": "123456"})
	requireStatus(t, 409, s, m)
	setClock(restarted, now.Add(time.Hour+time.Second))
	ctx, cancel := context.WithCancel(context.Background())
	wait := restarted.StartWorkers(ctx)
	defer func() { cancel(); wait() }()
	deadline := time.Now().Add(4 * time.Second)
	for time.Now().Before(deadline) {
		if count(context.Background(), d.Reader, "SELECT count(*) FROM quiz_attempts WHERE id=? AND status='submitted'", id(at, "id")) == 1 {
			break
		}
		time.Sleep(20 * time.Millisecond)
	}
	stored := one(context.Background(), d.Reader, "SELECT * FROM quiz_attempts WHERE id=?", id(at, "id"))
	if str(stored, "status") != "submitted" || num(stored, "score_percent") != 100 {
		t.Fatal("worker did not finalize persisted saved answers")
	}
}
func TestV2QuizSingleChoiceValidationAndDefaults(t *testing.T) {
	a, _, mgr, _, c := fixture(t)
	now := time.Now().UTC()
	setClock(a, now)
	for _, modify := range []func(M){
		func(m M) { m["duration_seconds"] = 0 }, func(m M) { m["deadline"] = m["open_at"] }, func(m M) { m["pass_score"] = 101 }, func(m M) { m["attempt_limit"] = 0 }, func(m M) { m["quiz_type"] = "homework" },
		func(m M) { m["questions"] = []M{} }, func(m M) {
			m["questions"] = []M{{"question_text": "X", "options": []M{{"option_text": "X", "is_correct": true}}}}
		},
		func(m M) {
			m["questions"] = []M{{"question_text": "X", "options": []M{{"option_text": "X", "is_correct": true}, {"option_text": "Y", "is_correct": true}}}}
		},
		func(m M) {
			m["questions"] = []M{{"question_text": "X", "options": []M{{"option_text": "X", "is_correct": false}, {"option_text": "Y", "is_correct": false}}}}
		},
		func(m M) { m["show_answers_after_submit"] = true },
	} {
		input := quizInputFor(now, "assignment", 60)
		modify(input)
		replenish(a)
		s, m := mgr.call("POST", classPath("manager", c)+"/quizzes", input)
		requireStatus(t, 400, s, m)
	}
	q, _ := newQuiz(t, mgr, c, "assignment", 60)
	if num(q, "attempt_limit") != 10 {
		t.Fatal("assignment default not ten")
	}
	q, _ = newQuiz(t, mgr, c, "test", 60)
	if num(q, "attempt_limit") != 1 {
		t.Fatal("test default not one")
	}
}
func TestV2CapacityCannotDropBelowApprovedRoster(t *testing.T) {
	a, admin, mgr, _, c := fixture(t)
	createUser(t, admin, "second@sis.hust.edu.vn", "student")
	other := loginClient(t, a, "second@sis.hust.edu.vn", "test-password-123")
	enroll(t, mgr, other, c, "Học")
	replenish(a)
	body := pick(c, "code name description manager_id capacity end_date min_attendance_percent min_quiz_percent")
	body["capacity"] = 1
	s, m := admin.call("PUT", classPath("admin", c), body)
	requireStatus(t, 409, s, m)
	if count(context.Background(), a.DB.Reader, "SELECT capacity FROM classes WHERE id=?", id(c, "id")) != 40 {
		t.Fatal("failed capacity update persisted")
	}
}
