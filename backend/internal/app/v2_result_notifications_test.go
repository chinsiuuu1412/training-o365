package app

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"testing"
	"time"
)

func assertResultNotice(t *testing.T, a *App, c, at M, percent float64) M {
	t.Helper()
	ctx := context.Background()
	prefix := fmt.Sprintf("Bài làm #%d (", id(at, "id"))
	notices := rows(ctx, a.DB.Reader, "SELECT * FROM announcements WHERE title='Kết quả Quiz' AND content LIKE ?", prefix+"%")
	if len(notices) != 1 {
		t.Fatalf("attempt %d: want exactly one result notice, got %d", id(at, "id"), len(notices))
	}
	n := notices[0]
	// Exact allowlist excludes answers, question/option text, keys and current-cycle identity.
	want := fmt.Sprintf("Bài làm #%d (Quiz #%d, lần ghi danh #%d): %.2f%%.", id(at, "id"), id(at, "quiz_id"), id(at, "enrollment_id"), percent)
	if str(n, "content") != want || id(n, "class_id") != id(c, "id") || !bval(n, "automated") || n["sender_id"] != nil {
		t.Fatalf("unsafe or misbound result notice: %v", n)
	}
	recipients := rows(ctx, a.DB.Reader, "SELECT * FROM announcement_recipients WHERE announcement_id=?", id(n, "id"))
	if len(recipients) != 1 || id(recipients[0], "user_id") != id(at, "student_id") || bval(recipients[0], "is_read") {
		t.Fatalf("result notice recipient/unread mismatch: %v", recipients)
	}
	return n
}

func TestV2ResultNotificationManualRetryAndRollback(t *testing.T) {
	a, admin, mgr, stu, c := fixture(t)
	now := time.Now().UTC()
	setClock(a, now)
	q, answers := newQuiz(t, mgr, c, "assignment", 60)
	at := start(t, stu, c, q, 1)
	save(t, stu, c, at, 0, answers[:1])
	ctx := context.Background()
	stale := one(ctx, a.DB.Reader, "SELECT * FROM quiz_attempts WHERE id=?", id(at, "id"))
	sentinel := errors.New("synthetic rollback")
	if err := a.DB.Write(ctx, func(tx *sql.Tx) error {
		grade(ctx, tx, stale, now)
		if count(ctx, tx, "SELECT count(*) FROM announcements WHERE title='Kết quả Quiz'") != 1 {
			t.Fatal("grade did not create result notice inside transaction")
		}
		return sentinel
	}); !errors.Is(err, sentinel) {
		t.Fatal(err)
	}
	if count(ctx, a.DB.Reader, "SELECT count(*) FROM announcements WHERE title='Kết quả Quiz'") != 0 || count(ctx, a.DB.Reader, "SELECT count(*) FROM quiz_attempts WHERE id=? AND status='in_progress'", id(at, "id")) != 1 {
		t.Fatal("result and notice did not roll back together")
	}
	for _, k := range []int{2, 2, 3} {
		s, m := stu.callHeaders("POST", attemptPath(c, at)+"/submit", M{"enrollment_id": at["enrollment_id"], "expected_revision": 1}, key(k))
		requireStatus(t, 200, s, m)
	}
	// Even a stale in-progress snapshot must not produce another notice.
	if err := a.DB.Write(ctx, func(tx *sql.Tx) error { grade(ctx, tx, stale, now); return nil }); err != nil {
		t.Fatal(err)
	}
	setClock(a, now.Add(time.Minute))
	if err := a.StartupScan(ctx); err != nil {
		t.Fatal(err)
	}
	n := assertResultNotice(t, a, c, at, 50)
	if count(ctx, a.DB.Reader, "SELECT count(*) FROM announcements WHERE title='Kết quả Quiz'") != 1 {
		t.Fatal("duplicate result notice")
	}
	path := fmt.Sprintf("/announcements/%d", id(n, "id"))
	s, m := stu.call("GET", path, nil)
	requireStatus(t, 200, s, m)
	if str(result(m)["announcement"].(map[string]any), "content") != str(n, "content") {
		t.Fatal("inbox changed safe result content")
	}
	for _, other := range []*client{admin, mgr} {
		s, m = other.call("GET", path, nil)
		requireStatus(t, 404, s, m)
	}
}

func TestV2ResultNotificationRevokedFinalization(t *testing.T) {
	for _, mode := range []string{"suspend", "expire_class", "new_cycle"} {
		t.Run(mode, func(t *testing.T) {
			a, admin, mgr, stu, c := fixture(t)
			now := time.Now().UTC()
			setClock(a, now)
			q, answers := newQuiz(t, mgr, c, "assignment", 10)
			at := start(t, stu, c, q, 1)
			save(t, stu, c, at, 0, answers)
			attempts := []M{at}
			replenish(a)
			ctx := context.Background()
			switch mode {
			case "suspend":
				s, m := admin.call("PATCH", fmt.Sprintf("/admin/users/%d/status", id(at, "student_id")), M{"is_active": false, "reason": "Tạm khóa"})
				requireStatus(t, 200, s, m)
			case "expire_class":
				must(a.DB.Write(ctx, func(tx *sql.Tx) error {
					exec(ctx, tx, "UPDATE classes SET expires_at=? WHERE id=?", timestamp(now.Add(time.Second)), id(c, "id"))
					return nil
				}))
			case "new_cycle":
				s, m := mgr.call("POST", fmt.Sprintf("%s/enrollments/%d/remove", classPath("manager", c), id(at, "enrollment_id")), M{"reason": "Đổi khóa"})
				requireStatus(t, 200, s, m)
				fresh := enroll(t, mgr, stu, c, "Tham gia lại")
				if id(fresh, "id") == id(at, "enrollment_id") {
					t.Fatal("cycle reused")
				}
				at2 := start(t, stu, c, q, 2)
				save(t, stu, c, at2, 0, answers)
				attempts = append(attempts, at2)
			}
			setClock(a, now.Add(10*time.Second))
			if err := a.StartupScan(ctx); err != nil {
				t.Fatal(err)
			}
			for i := 0; i < 2; i++ {
				if err := a.scanDue(ctx, 100); err != nil {
					t.Fatal(err)
				}
				if err := a.StartupScan(ctx); err != nil {
					t.Fatal(err)
				}
			}
			for _, attempt := range attempts {
				stored := one(ctx, a.DB.Reader, "SELECT * FROM quiz_attempts WHERE id=?", id(attempt, "id"))
				if str(stored, "status") != "submitted" || num(stored, "score_percent") != 100 {
					t.Fatal("revoked/cycle-bound result not finalized")
				}
				assertResultNotice(t, a, c, attempt, 100)
			}
			if count(ctx, a.DB.Reader, "SELECT count(*) FROM announcements WHERE title='Kết quả Quiz'") != int64(len(attempts)) {
				t.Fatal("repeated finalization duplicated result notices")
			}
		})
	}
}
