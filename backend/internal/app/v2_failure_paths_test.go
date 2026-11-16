package app

import (
	"context"
	"database/sql"
	"fmt"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"
)

func TestV2AuthorizationLossFinalizerAndNoLateWrites(t *testing.T) {
	for _, mode := range []string{"suspend", "expire_class", "remove"} {
		t.Run(mode, func(t *testing.T) {
			a, admin, mgr, stu, c := fixture(t)
			now := time.Now().UTC()
			setClock(a, now)
			q, answers := newQuiz(t, mgr, c, "assignment", 10)
			at := start(t, stu, c, q, 1)
			save(t, stu, c, at, 0, answers)
			replenish(a)
			switch mode {
			case "suspend":
				s, m := admin.call("PATCH", fmt.Sprintf("/admin/users/%d/status", userID(t, stu)), M{"is_active": false, "reason": "Tạm khóa"})
				requireStatus(t, 200, s, m)
			case "expire_class":
				must(a.DB.Write(context.Background(), func(tx *sql.Tx) error {
					exec(context.Background(), tx, "UPDATE classes SET expires_at=? WHERE id=?", timestamp(now.Add(time.Second)), id(c, "id"))
					return nil
				}))
				setClock(a, now.Add(time.Second))
			case "remove":
				s, m := mgr.call("POST", fmt.Sprintf("%s/enrollments/%d/remove", classPath("manager", c), id(at, "enrollment_id")), M{"reason": "Ngừng học"})
				requireStatus(t, 200, s, m)
			}
			s, m := stu.call("PUT", attemptPath(c, at)+"/draft", M{"enrollment_id": at["enrollment_id"], "expected_revision": 1, "answers": []M{}})
			want := 404
			if mode == "suspend" {
				want = 401
			}
			if mode == "expire_class" {
				want = 403
			}
			requireStatus(t, want, s, m)
			setClock(a, now.Add(10*time.Second))
			if err := a.scanDue(context.Background(), 100); err != nil {
				t.Fatal(err)
			}
			stored := one(context.Background(), a.DB.Reader, "SELECT * FROM quiz_attempts WHERE id=?", id(at, "id"))
			if str(stored, "status") != "submitted" || num(stored, "score_percent") != 100 || integer(stored, "draft_revision") != 1 {
				t.Fatal("revocation corrupted saved result")
			}
		})
	}
}
func TestV2QueuedRequestUsesSingleAuthorizationClock(t *testing.T) {
	a, _, mgr, stu, c := fixture(t)
	now := time.Now().UTC()
	setClock(a, now)
	q, answers := newQuiz(t, mgr, c, "assignment", 1)
	at := start(t, stu, c, q, 1)
	e := enrollment(t, stu, c)
	// Once body/preflight are complete, one transaction timestamp controls finalization and mutation.
	var calls atomic.Int32
	a.Now = func() time.Time {
		if calls.Add(1) <= 3 {
			return now.Add(time.Second - time.Nanosecond)
		}
		return now.Add(time.Second)
	}
	s, m := stu.call("PUT", attemptPath(c, at)+"/draft", M{"enrollment_id": e["id"], "expected_revision": 0, "answers": answers})
	requireStatus(t, 200, s, m)
	stored := one(context.Background(), a.DB.Reader, "SELECT * FROM quiz_attempts WHERE id=?", id(at, "id"))
	if integer(stored, "draft_revision") != 1 {
		t.Fatal("valid pre-cutoff mutation lost")
	}
	setClock(a, now.Add(time.Second))
	if err := a.StartupScan(context.Background()); err != nil {
		t.Fatal(err)
	}
	stored = one(context.Background(), a.DB.Reader, "SELECT * FROM quiz_attempts WHERE id=?", id(at, "id"))
	if num(stored, "score_percent") != 100 {
		t.Fatal("single-clock grade wrong")
	}
}

type slowBody struct {
	data   *strings.Reader
	finish func()
	done   bool
}

func (b *slowBody) Read(p []byte) (int, error) {
	n, e := b.data.Read(p)
	if !b.done {
		b.done = true
		b.finish()
	}
	return n, e
}
func (b *slowBody) Close() error { return nil }
func TestV2SlowBodyCannotWritePastCutoff(t *testing.T) {
	a, _, mgr, stu, c := fixture(t)
	now := time.Now().UTC()
	setClock(a, now)
	q, answers := newQuiz(t, mgr, c, "assignment", 1)
	at := start(t, stu, c, q, 1)
	body := jsonText(M{"enrollment_id": at["enrollment_id"], "expected_revision": 0, "answers": answers})
	r := httptest.NewRequest("PUT", "https://lms.test/api/v1"+attemptPath(c, at)+"/draft", nil)
	r.Body = &slowBody{data: strings.NewReader(body), finish: func() { setClock(a, now.Add(time.Second)) }}
	r.Header.Set("Content-Type", "application/json")
	r.Header.Set("Origin", "https://lms.test")
	r.Header.Set("X-CSRF-Token", stu.CSRF)
	r.AddCookie(stu.Cookie)
	w := httptest.NewRecorder()
	a.Handler().ServeHTTP(w, r)
	if w.Code != 410 {
		t.Fatalf("slow body late write accepted: %d %s", w.Code, w.Body.String())
	}
	stored := one(context.Background(), a.DB.Reader, "SELECT * FROM quiz_attempts WHERE id=?", id(at, "id"))
	if num(stored, "score_percent") != 0 || integer(stored, "draft_revision") != 0 {
		t.Fatal("late answers applied")
	}
}
func TestV2ValidBulkGrantDifferentEffectiveDeadlines(t *testing.T) {
	a, admin, mgr, stu, c := fixture(t)
	now := time.Now().UTC()
	setClock(a, now)
	createUser(t, admin, "second@sis.hust.edu.vn", "student")
	other := loginClient(t, a, "second@sis.hust.edu.vn", "test-password-123")
	e2 := enroll(t, mgr, other, c, "Học")
	e1 := enrollment(t, stu, c)
	q, _ := newQuiz(t, mgr, c, "test", 60)
	path := fmt.Sprintf("%s/quizzes/%.0f/grants", classPath("manager", c), num(q, "id"))
	replenish(a)
	s, m := mgr.call("POST", path, M{"enrollment_ids": []any{e2["id"]}, "deadline": timestamp(now.Add(4 * time.Hour)), "reason": "Bổ sung"})
	requireStatus(t, 201, s, m)
	s, m = mgr.call("POST", path, M{"enrollment_ids": []any{e1["id"], e2["id"]}, "deadline": timestamp(now.Add(3 * time.Hour)), "reason": "Bulk sai"})
	requireStatus(t, 422, s, m)
	if count(context.Background(), a.DB.Reader, "SELECT count(*) FROM quiz_retake_grants WHERE enrollment_id=?", id(e1, "id")) != 0 {
		t.Fatal("failed second target retained first grant")
	}
	s, m = mgr.call("POST", path, M{"enrollment_ids": []any{e1["id"], e2["id"], e1["id"]}, "deadline": timestamp(now.Add(5 * time.Hour)), "reason": "Bulk đúng", "extra_attempts": 2})
	requireStatus(t, 201, s, m)
	if len(result(m)["granted_enrollment_ids"].([]any)) != 2 {
		t.Fatal("bulk not deduplicated")
	}
	for _, e := range []M{e1, e2} {
		if count(context.Background(), a.DB.Reader, "SELECT count(*) FROM announcement_recipients r JOIN announcements a ON a.id=r.announcement_id WHERE a.title='Cấp thêm lượt làm bài' AND a.content LIKE '%Bulk đúng%' AND r.user_id=?", id(e, "student_id")) != 1 {
			t.Fatal("student grant notification missing")
		}
	}
	if count(context.Background(), a.DB.Reader, "SELECT count(*) FROM announcement_recipients r JOIN announcements a ON a.id=r.announcement_id WHERE a.title='Cấp thêm lượt làm bài' AND a.content LIKE '%Bulk đúng%' AND r.user_id=1") != 1 {
		t.Fatal("admin grant notification missing")
	}
	// Grant starts after immutable quiz deadline, using cycle-specific extension and allowance.
	setClock(a, now.Add(3*time.Hour))
	replenish(a)
	at := start(t, stu, c, q, 1)
	if str(at, "effective_deadline") != timestamp(now.Add(5*time.Hour)) {
		t.Fatal("effective grant deadline ignored")
	}
}
