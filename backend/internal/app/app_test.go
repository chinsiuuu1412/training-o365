package app

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"o365-lms/backend/internal/config"
	"o365-lms/backend/internal/db"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"
)

type client struct {
	Coverage *sync.Map
	Cookie   *http.Cookie
	CSRF     string
	App      *App
	t        *testing.T
}

func setup(t *testing.T) (*App, *client) {
	t.Helper()
	ctx := context.Background()
	dbPath := filepath.Join(t.TempDir(), "test.db")
	d, e := db.Open(ctx, dbPath, 8)
	if e != nil {
		t.Fatal(e)
	}
	t.Cleanup(d.Close)
	c := config.Config{DBPath: dbPath, JWTSecret: strings.Repeat("s", 48), Origin: "https://lms.test", SessionTTL: 24 * time.Hour, AdminEmail: "admin@example.test", AdminPassword: "test-password-123"}
	if e = Bootstrap(ctx, d, c); e != nil {
		t.Fatal(e)
	}
	a := New(c, d)
	return a, loginClient(t, a, c.AdminEmail, c.AdminPassword)
}
func loginClient(t *testing.T, a *App, email, password string) *client {
	t.Helper()
	c := &client{App: a, t: t, Coverage: &sync.Map{}}
	status, data := c.call("POST", "/auth/login", M{"email": email, "password": password})
	if status != 200 {
		t.Fatalf("login: %d %v", status, data)
	}
	c.CSRF = str(data["data"].(map[string]any), "csrf_token")
	return c
}
func (c *client) call(method, path string, body any) (int, M) {
	return c.callHeaders(method, path, body, nil)
}
func (c *client) callHeaders(method, path string, body any, headers map[string]string) (int, M) {
	c.t.Helper()
	b := ""
	if body != nil {
		b = jsonText(body)
	}
	r := httptest.NewRequest(method, "https://lms.test/api/v1"+path, strings.NewReader(b))
	r.RemoteAddr = "127.0.0.1:1234"
	r.Header.Set("Origin", "https://lms.test")
	r.Header.Set("Content-Type", "application/json")
	if c.Cookie != nil {
		r.AddCookie(c.Cookie)
	}
	r.Header.Set("X-CSRF-Token", c.CSRF)
	for k, v := range headers {
		r.Header.Set(k, v)
	}
	w := httptest.NewRecorder()
	c.App.Handler().ServeHTTP(w, r)
	if c.Coverage != nil && w.Code >= 200 && w.Code < 300 {
		c.Coverage.Store(method+" "+r.Pattern, true)
	}
	for _, v := range w.Result().Cookies() {
		c.Cookie = v
	}
	var out M
	if e := json.Unmarshal(w.Body.Bytes(), &out); e != nil {
		c.t.Fatalf("non JSON status %d: %s", w.Code, w.Body.String())
	}
	return w.Code, out
}
func requireStatus(t *testing.T, want, got int, m M) {
	t.Helper()
	if got != want {
		t.Fatalf("want %d got %d: %v", want, got, m)
	}
}
func result(m M) M { return m["data"].(map[string]any) }
func createUser(t *testing.T, c *client, email, role string) M {
	t.Helper()
	m := M{"email": email, "full_name": email, "role": role, "password": "test-password-123"}
	if role == "student" {
		m["student_id"] = fmt.Sprintf("2025%05d", 1+count(context.Background(), c.App.DB.Reader, "SELECT count(*) FROM users"))
		m["school_or_institute"] = "SOICT"
		m["university_class"] = "K71"
		m["phone_number"] = "0912345678"
	}
	s, m := c.call("POST", "/admin/users", m)
	requireStatus(t, 201, s, m)
	return result(m)["user"].(map[string]any)
}
func createClass(t *testing.T, c *client, manager M) M {
	t.Helper()
	s, m := c.call("POST", "/admin/classes", M{"code": fmt.Sprintf("MOS-%d", count(context.Background(), c.App.DB.Reader, "SELECT count(*) FROM classes")+1), "name": "MOS", "description": "", "manager_id": manager["id"], "capacity": 40, "end_date": time.Now().In(vietnam).AddDate(0, 0, 2).Format("2006-01-02"), "min_attendance_percent": 80, "min_quiz_percent": 60})
	requireStatus(t, 201, s, m)
	return result(m)["class"].(map[string]any)
}
func classPath(prefix string, c M) string {
	return fmt.Sprintf("/%s/classes/%.0f", prefix, num(c, "id"))
}
func TestAuthValidationAndRevocation(t *testing.T) {
	a, admin := setup(t)
	s, m := admin.call("POST", "/admin/users", M{"email": "bad@example.test", "full_name": "Bad", "role": "student", "password": "test-password-123"})
	requireStatus(t, 422, s, m)
	s, m = admin.call("POST", "/admin/users", M{"email": "student@sis.hust.edu.vn", "full_name": "Student", "role": "student", "password": "short"})
	requireStatus(t, 400, s, m)
	s, m = admin.call("POST", "/admin/users", M{"email": "student@sis.hust.edu.vn", "full_name": "Student", "role": "student", "password": "test-password-123", "extra": 1})
	requireStatus(t, 400, s, m)
	u := createUser(t, admin, "student@sis.hust.edu.vn", "student")
	stu := loginClient(t, a, "student@sis.hust.edu.vn", "test-password-123")
	s, m = stu.call("GET", "/admin/users", nil)
	requireStatus(t, 403, s, m)
	s, m = stu.callHeaders("POST", "/auth/logout", M{}, map[string]string{"X-CSRF-Token": "bad"})
	requireStatus(t, 403, s, m)
	s, m = stu.callHeaders("POST", "/auth/logout", M{}, map[string]string{"Origin": "https://evil.test"})
	requireStatus(t, 403, s, m)
	s, m = admin.call("POST", fmt.Sprintf("/admin/users/%.0f/reset-password", u["id"]), M{"new_password": "changed-password-123"})
	requireStatus(t, 200, s, m)
	s, m = stu.call("GET", "/auth/me", nil)
	requireStatus(t, 401, s, m)
	if e := Bootstrap(context.Background(), a.DB, a.Config); e != nil {
		t.Fatal(e)
	}
	if count(context.Background(), a.DB.Reader, "SELECT count(*) FROM users") != 2 {
		t.Fatal("bootstrap mutated existing DB")
	}
}
