package app

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestV2RouteSurfaceAndStrictBoundaries(t *testing.T) {
	a, admin, mgr, stu, c := fixture(t)
	banned := []string{"invite", "leave-request", "archive", "presign", "photo", "playback", "watch-video", "violation", "telemetry", "confirm", "direct"}
	seen := map[string]bool{}
	for _, r := range a.Routes {
		key := r.Method + " " + r.Path
		if seen[key] {
			t.Fatal("duplicate route", key)
		}
		seen[key] = true
		for _, s := range banned {
			if strings.Contains(r.Path, s) {
				t.Fatal("post-MVP route remains registered", key)
			}
		}
	}
	t.Logf("registered routes: %d", len(a.Routes))
	for _, body := range []string{"null", "[]", "{} {}", "{\"is_active\":false,\"reason\":\"x\",\"role\":\"admin\"}", strings.Repeat("x", (1<<20)+1)} {
		r := httptest.NewRequest("PATCH", "https://lms.test/api/v1/admin/users/2/status", strings.NewReader(body))
		r.Header.Set("Origin", "https://lms.test")
		r.Header.Set("Content-Type", "application/json")
		r.Header.Set("X-CSRF-Token", admin.CSRF)
		r.AddCookie(admin.Cookie)
		w := httptest.NewRecorder()
		a.Handler().ServeHTTP(w, r)
		if w.Code != 400 && w.Code != 413 {
			t.Fatalf("invalid payload accepted: %d", w.Code)
		}
	}
	replenish(a)
	original := stu.Cookie.Value
	stu.Cookie = &http.Cookie{Name: "lms_session", Value: original + "tamper"}
	s, m := stu.call("GET", "/auth/me", nil)
	requireStatus(t, 401, s, m)
	stu.Cookie = &http.Cookie{Name: "lms_session", Value: original}
	s, m = stu.call("GET", classPath("manager", c)+"/enrollments", nil)
	requireStatus(t, 403, s, m)
	other := createUser(t, admin, "other@example.test", "class_manager")
	_ = other
	otherClient := loginClient(t, a, "other@example.test", "test-password-123")
	s, m = otherClient.call("GET", classPath("manager", c)+"/enrollments", nil)
	requireStatus(t, 404, s, m)
	replenish(a)
	for i := 0; i < 10; i++ {
		s, m = mgr.call("POST", "/manager/announcements", M{"recipient_ids": []int64{userID(t, stu)}, "title": "Thông báo", "content": "MOS"})
		requireStatus(t, 201, s, m)
	}
	s, m = mgr.call("POST", "/manager/announcements", M{"recipient_ids": []int64{userID(t, stu)}, "title": "Thông báo", "content": "MOS"})
	requireStatus(t, 429, s, m)
}
func TestV2SeedPristineOnly(t *testing.T) {
	a, _ := setup(t)
	if e := Seed(context.Background(), a.DB, "test-password-123", "test-password-123", "test-password-123"); e == nil {
		t.Fatal("seed changed nonempty db")
	}
	if count(context.Background(), a.DB.Reader, "SELECT count(*) FROM users") != 1 {
		t.Fatal("seed touched existing data")
	}
}
func TestV2QuizValidationCapsOpenAndShortCutoff(t *testing.T) {
	a, _, mgr, stu, c := fixture(t)
	now := time.Now().UTC()
	setClock(a, now)
	replenish(a)
	input := quizInputFor(now, "assignment", 120)
	input["attempt_limit"] = 2
	s, m := mgr.call("POST", classPath("manager", c)+"/quizzes", input)
	requireStatus(t, 201, s, m)
	q := result(m)["quiz"].(map[string]any)
	path := fmt.Sprintf("%s/quizzes/%.0f", classPath("manager", c), num(q, "id"))
	s, m = mgr.call("POST", path+"/publish", M{})
	requireStatus(t, 200, s, m)
	for i := 0; i < 2; i++ {
		replenish(a)
		at := start(t, stu, c, q, 10+i)
		s, m = stu.callHeaders("POST", attemptPath(c, at)+"/submit", M{"enrollment_id": at["enrollment_id"], "expected_revision": 0}, key(20+i))
		requireStatus(t, 200, s, m)
	}
	e := enrollment(t, stu, c)
	s, m = stu.callHeaders("POST", fmt.Sprintf("%s/quizzes/%.0f/start", classPath("student", c), num(q, "id")), M{"enrollment_id": e["id"]}, key(30))
	requireStatus(t, 409, s, m)
	input = quizInputFor(now, "test", 1)
	input["open_at"] = timestamp(now.Add(time.Minute))
	input["deadline"] = timestamp(now.Add(2 * time.Minute))
	replenish(a)
	s, m = mgr.call("POST", classPath("manager", c)+"/quizzes", input)
	requireStatus(t, 201, s, m)
	q = result(m)["quiz"].(map[string]any)
	path = fmt.Sprintf("%s/quizzes/%.0f", classPath("manager", c), num(q, "id"))
	s, m = mgr.call("POST", path+"/publish", M{})
	requireStatus(t, 200, s, m)
	s, m = stu.callHeaders("POST", fmt.Sprintf("%s/quizzes/%.0f/start", classPath("student", c), num(q, "id")), M{"enrollment_id": e["id"]}, key(31))
	requireStatus(t, 409, s, m)
	setClock(a, now.Add(time.Minute))
	at := start(t, stu, c, q, 32)
	setClock(a, now.Add(time.Minute+666666666*time.Nanosecond))
	s, m = stu.callHeaders("POST", attemptPath(c, at)+"/submit", M{"enrollment_id": e["id"], "expected_revision": 0}, key(33))
	requireStatus(t, 422, s, m)
	setClock(a, now.Add(time.Minute+666666667*time.Nanosecond))
	s, m = stu.callHeaders("POST", attemptPath(c, at)+"/submit", M{"enrollment_id": e["id"], "expected_revision": 0}, key(33))
	requireStatus(t, 200, s, m)
	// Deadline earlier than 2/3 still auto-submits saved answers, without grace.
	replenish(a)
	input = quizInputFor(a.Now(), "test", 120)
	input["deadline"] = timestamp(a.Now().Add(time.Second))
	s, m = mgr.call("POST", classPath("manager", c)+"/quizzes", input)
	requireStatus(t, 201, s, m)
	q = result(m)["quiz"].(map[string]any)
	s, m = mgr.call("POST", fmt.Sprintf("%s/quizzes/%.0f/publish", classPath("manager", c), num(q, "id")), M{})
	requireStatus(t, 200, s, m)
	at = start(t, stu, c, q, 34)
	setClock(a, parseTime(str(at, "effective_cutoff_at")))
	if err := a.StartupScan(context.Background()); err != nil {
		t.Fatal(err)
	}
	stored := one(context.Background(), a.DB.Reader, "SELECT * FROM quiz_attempts WHERE id=?", id(at, "id"))
	if str(stored, "status") != "submitted" || num(stored, "score_percent") != 0 {
		t.Fatal("deadline did not force early finalization")
	}
}
