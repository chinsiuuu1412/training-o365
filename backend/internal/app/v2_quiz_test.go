package app

import (
	"context"
	"fmt"
	"strings"
	"sync"
	"testing"
	"time"
)

func TestV2QuizCutoffRecoveryNoKeysAndTestTwoThirds(t *testing.T) {
	a, _, mgr, stu, c := fixture(t)
	now := time.Now().UTC()
	setClock(a, now)
	q, answers := newQuiz(t, mgr, c, "test", 90)
	at := start(t, stu, c, q, 1)
	eid := at["enrollment_id"]
	save(t, stu, c, at, 0, answers)
	s, m := stu.call("GET", attemptPath(c, at), nil)
	requireStatus(t, 200, s, m)
	if strings.Contains(jsonText(m), "is_correct") || result(m)["review"] != nil {
		t.Fatal("answer key exposed")
	}
	if num(result(m)["attempt"].(map[string]any), "draft_revision") != 1 {
		t.Fatal("recovery lost revision")
	}
	s, m = stu.call("PUT", attemptPath(c, at)+"/draft", M{"enrollment_id": eid, "expected_revision": 0, "answers": answers})
	requireStatus(t, 409, s, m)
	setClock(a, now.Add(60*time.Second-time.Nanosecond))
	replenish(a)
	s, m = stu.callHeaders("POST", attemptPath(c, at)+"/submit", M{"enrollment_id": eid, "expected_revision": 1}, key(2))
	requireStatus(t, 422, s, m)
	setClock(a, now.Add(60*time.Second))
	s, m = stu.callHeaders("POST", attemptPath(c, at)+"/submit", M{"enrollment_id": eid, "expected_revision": 1}, key(2))
	requireStatus(t, 200, s, m)
	if num(result(m)["attempt"].(map[string]any), "score_percent") != 100 || result(m)["review"] != nil || strings.Contains(jsonText(m), "is_correct") {
		t.Fatal("incorrect grade or key leak")
	}
	s, m = stu.callHeaders("POST", attemptPath(c, at)+"/submit", M{"enrollment_id": eid, "expected_revision": 1}, key(2))
	requireStatus(t, 200, s, m)
	s, m = stu.callHeaders("POST", fmt.Sprintf("%s/quizzes/%.0f/start", classPath("student", c), num(q, "id")), M{"enrollment_id": eid}, key(1))
	requireStatus(t, 200, s, m)
	if str(result(m)["attempt"].(map[string]any), "status") != "submitted" {
		t.Fatal("start replay returned stale in-progress snapshot")
	}
	s, m = stu.call("POST", attemptPath(c, at)+"/violation", M{"event_id": "00000000-0000-4000-8000-000000000001"})
	requireStatus(t, 404, s, m)
	s, m = mgr.call("PUT", fmt.Sprintf("%s/quizzes/%.0f", classPath("manager", c), num(q, "id")), quizInputFor(now, "test", 120))
	requireStatus(t, 409, s, m)
}
func TestV2QuizExactCutoffAndRevokedStartupFinalization(t *testing.T) {
	a, admin, mgr, stu, c := fixture(t)
	now := time.Now().UTC()
	setClock(a, now)
	q, answers := newQuiz(t, mgr, c, "assignment", 10)
	at := start(t, stu, c, q, 1)
	setClock(a, now.Add(10*time.Second-time.Nanosecond))
	replenish(a)
	save(t, stu, c, at, 0, answers)
	if str(one(context.Background(), a.DB.Reader, "SELECT * FROM quiz_attempts WHERE id=?", id(at, "id")), "status") != "in_progress" {
		t.Fatal("finalized one nanosecond early")
	}
	setClock(a, now.Add(10*time.Second))
	s, m := stu.call("PUT", attemptPath(c, at)+"/draft", M{"enrollment_id": at["enrollment_id"], "expected_revision": 1, "answers": []M{}})
	requireStatus(t, 410, s, m)
	stored := one(context.Background(), a.DB.Reader, "SELECT * FROM quiz_attempts WHERE id=?", id(at, "id"))
	if str(stored, "status") != "submitted" || num(stored, "score_percent") != 100 {
		t.Fatal("cutoff rollback lost saved grade")
	}
	setClock(a, now.Add(20*time.Second))
	replenish(a)
	q2, answers2 := newQuiz(t, mgr, c, "assignment", 10)
	at2 := start(t, stu, c, q2, 3)
	save(t, stu, c, at2, 0, answers2)
	e := enrollment(t, stu, c)
	s, m = mgr.call("POST", fmt.Sprintf("%s/enrollments/%d/remove", classPath("manager", c), id(e, "id")), M{"reason": "Hết tham gia"})
	requireStatus(t, 200, s, m)
	s, m = stu.call("PUT", attemptPath(c, at2)+"/draft", M{"enrollment_id": e["id"], "expected_revision": 1, "answers": []M{}})
	requireStatus(t, 404, s, m)
	setClock(a, now.Add(30*time.Second))
	if err := a.StartupScan(context.Background()); err != nil {
		t.Fatal(err)
	}
	stored = one(context.Background(), a.DB.Reader, "SELECT * FROM quiz_attempts WHERE id=?", id(at2, "id"))
	if str(stored, "status") != "submitted" || num(stored, "score_percent") != 100 {
		t.Fatal("revoked attempt not finalized")
	}
	_ = admin
}
func TestV2CycleIsolationStaleKeysAndBulkGrants(t *testing.T) {
	a, _, mgr, stu, c := fixture(t)
	now := time.Now().UTC()
	setClock(a, now)
	q, answers := newQuiz(t, mgr, c, "assignment", 60)
	at := start(t, stu, c, q, 1)
	old := enrollment(t, stu, c)
	save(t, stu, c, at, 0, answers)
	grant := fmt.Sprintf("%s/quizzes/%.0f/grants", classPath("manager", c), num(q, "id"))
	originalCut := str(at, "effective_cutoff_at")
	s, m := mgr.call("POST", grant, M{"enrollment_ids": []any{old["id"]}, "reason": "Ôn tập", "deadline": timestamp(now.Add(3 * time.Hour)), "extra_attempts": 2})
	requireStatus(t, 201, s, m)
	if str(one(context.Background(), a.DB.Reader, "SELECT * FROM quiz_attempts WHERE id=?", id(at, "id")), "effective_cutoff_at") != originalCut {
		t.Fatal("grant extended running cutoff")
	}
	s, m = mgr.call("POST", grant, M{"enrollment_ids": []any{old["id"], 999999}, "reason": "Atomic", "deadline": timestamp(now.Add(4 * time.Hour))})
	requireStatus(t, 404, s, m)
	if count(context.Background(), a.DB.Reader, "SELECT count(*) FROM quiz_retake_grants") != 1 {
		t.Fatal("bulk grant partially persisted")
	}
	s, m = mgr.call("POST", grant, M{"enrollment_ids": []any{old["id"]}, "reason": "Không tăng", "deadline": timestamp(now.Add(3 * time.Hour))})
	requireStatus(t, 422, s, m)
	s, m = mgr.call("POST", grant, M{"enrollment_ids": []any{old["id"]}, "reason": "Quá nhiều", "deadline": timestamp(now.Add(4 * time.Hour)), "extra_attempts": 11})
	requireStatus(t, 400, s, m)
	s, m = mgr.call("POST", fmt.Sprintf("%s/enrollments/%d/remove", classPath("manager", c), id(old, "id")), M{"reason": "Đổi khóa"})
	requireStatus(t, 200, s, m)
	fresh := enroll(t, mgr, stu, c, "Tham gia lại")
	if id(fresh, "id") == id(old, "id") {
		t.Fatal("cycle reused")
	}
	s, m = stu.callHeaders("POST", fmt.Sprintf("%s/quizzes/%.0f/start", classPath("student", c), num(q, "id")), M{"enrollment_id": fresh["id"]}, key(1))
	requireStatus(t, 409, s, m)
	s, m = stu.call("PUT", attemptPath(c, at)+"/draft", M{"enrollment_id": old["id"], "expected_revision": 1, "answers": []M{}})
	requireStatus(t, 409, s, m)
	s, m = stu.call("GET", attemptPath(c, at), nil)
	requireStatus(t, 404, s, m)
	at2 := start(t, stu, c, q, 2)
	if num(at2, "attempt_number") != 1 || str(at2, "effective_deadline") != str(q, "deadline") {
		t.Fatal("old attempts/grants leaked")
	}
	s, m = stu.call("GET", classPath("student", c)+"/progress", nil)
	requireStatus(t, 200, s, m)
	if num(result(m)["progress"].(map[string]any), "passed_quiz_count") != 0 {
		t.Fatal("old score leaked")
	}
	setClock(a, now.Add(60*time.Second))
	if err := a.StartupScan(context.Background()); err != nil {
		t.Fatal(err)
	}
	if count(context.Background(), a.DB.Reader, "SELECT count(*) FROM quiz_attempts WHERE status='submitted'") != 2 {
		t.Fatal("old cycle finalizer did not preserve history")
	}
}
func TestV2ConcurrentStartSubmitAndDraft(t *testing.T) {
	a, _, mgr, stu, c := fixture(t)
	q, answers := newQuiz(t, mgr, c, "assignment", 120)
	e := enrollment(t, stu, c)
	replenish(a)
	path := fmt.Sprintf("%s/quizzes/%.0f/start", classPath("student", c), num(q, "id"))
	var wg sync.WaitGroup
	statuses := make(chan int, 2)
	for i := 0; i < 2; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			s, _ := clone(stu).callHeaders("POST", path, M{"enrollment_id": e["id"]}, key(1))
			statuses <- s
		}()
	}
	wg.Wait()
	for i := 0; i < 2; i++ {
		if s := <-statuses; s != 200 {
			t.Fatal(s)
		}
	}
	if count(context.Background(), a.DB.Reader, "SELECT count(*) FROM quiz_attempts") != 1 {
		t.Fatal("duplicate start consumed attempts")
	}
	at := one(context.Background(), a.DB.Reader, "SELECT * FROM quiz_attempts")
	for i := 0; i < 2; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			s, _ := clone(stu).call("PUT", attemptPath(c, at)+"/draft", M{"enrollment_id": e["id"], "expected_revision": 0, "answers": answers})
			statuses <- s
		}()
	}
	wg.Wait()
	ok, conflict := 0, 0
	for i := 0; i < 2; i++ {
		s := <-statuses
		if s == 200 {
			ok++
		}
		if s == 409 {
			conflict++
		}
	}
	if ok != 1 || conflict != 1 {
		t.Fatalf("optimistic revision: %d %d", ok, conflict)
	}
	replenish(a)
	for i := 0; i < 2; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			s, _ := clone(stu).callHeaders("POST", attemptPath(c, at)+"/submit", M{"enrollment_id": e["id"], "expected_revision": 1}, key(2))
			statuses <- s
		}()
	}
	wg.Wait()
	for i := 0; i < 2; i++ {
		if s := <-statuses; s != 200 {
			t.Fatal(s)
		}
	}
	if count(context.Background(), a.DB.Reader, "SELECT count(*) FROM quiz_attempts WHERE status='submitted' AND score_percent=100") != 1 {
		t.Fatal("submit not retry safe")
	}
}
