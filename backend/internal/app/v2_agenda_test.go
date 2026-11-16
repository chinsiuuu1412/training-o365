package app

import (
	"testing"
	"time"
)

func TestV2DashboardAgendaAndExpiredSummaryOnly(t *testing.T) {
	a, _, mgr, stu, c := fixture(t)
	now := time.Now().UTC()
	setClock(a, now)
	q, _ := newQuiz(t, mgr, c, "assignment", 60)
	start(t, stu, c, q, 1)
	s, m := stu.call("GET", "/student/dashboard", nil)
	requireStatus(t, 200, s, m)
	agenda := result(m)["agenda"].(map[string]any)
	if len(agenda["active_attempts"].([]any)) != 1 || len(agenda["quizzes"].([]any)) != 1 {
		t.Fatal("dashboard cannot continue current attempt")
	}
	setClock(a, parseTime(str(c, "expires_at")))
	replenish(a)
	stu = loginClient(t, a, "student@sis.hust.edu.vn", "test-password-123")
	s, m = stu.call("GET", "/student/dashboard", nil)
	requireStatus(t, 200, s, m)
	agenda = result(m)["agenda"].(map[string]any)
	if len(agenda["active_attempts"].([]any)) != 0 || len(agenda["quizzes"].([]any)) != 0 {
		t.Fatal("expired content leaked through dashboard")
	}
	if len(result(m)["classes"].([]any)) != 1 {
		t.Fatal("expired summary absent")
	}
}
