package app

import (
	"context"
	"database/sql"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestPasswordPreflightWriterFreeAndCredentialRace(t *testing.T) {
	for _, field := range []string{"password_hash", "token_version", "is_active", "role", "email"} {
		t.Run(field, func(t *testing.T) {
			a, _ := setup(t)
			ctx := context.Background()
			// Hold writer while preflight reads and bcrypt complete; no writer dependency allowed.
			tx, err := a.DB.Writer.BeginTx(ctx, nil)
			if err != nil {
				t.Fatal(err)
			}
			defer tx.Rollback()
			r := httptest.NewRequest("POST", "https://lms.test/api/v1/auth/login", strings.NewReader(""))
			x := &request{App: a, R: r, W: httptest.NewRecorder(), Ctx: ctx, Q: a.DB.Reader, Now: time.Now(), Body: M{"email": "admin@example.test", "password": "test-password-123"}}
			done := make(chan any, 1)
			go func() { defer func() { done <- recover() }(); a.preparePassword(route{Path: "/api/v1/auth/login"}, x) }()
			select {
			case p := <-done:
				if p != nil {
					t.Fatalf("preflight: %v", p)
				}
			case <-time.After(2 * time.Second):
				t.Fatal("password work needs writer")
			}
			switch field {
			case "password_hash":
				exec(ctx, tx, "UPDATE users SET password_hash='changed' WHERE id=1")
			case "token_version":
				exec(ctx, tx, "UPDATE users SET token_version=token_version+1 WHERE id=1")
			case "is_active":
				exec(ctx, tx, "UPDATE users SET is_active=0 WHERE id=1")
			case "role":
				exec(ctx, tx, "UPDATE users SET role='class_manager' WHERE id=1")
			case "email":
				exec(ctx, tx, "UPDATE users SET email='changed@example.test' WHERE id=1")
			}
			if err := tx.Commit(); err != nil {
				t.Fatal(err)
			}
			before := count(ctx, a.DB.Reader, "SELECT count(*) FROM user_sessions")
			func() {
				defer func() {
					p := recover()
					e, ok := p.(apiError)
					if !ok || e.Status != 401 {
						t.Fatalf("credential race not rejected: %v", p)
					}
				}()
				must(a.DB.Write(ctx, func(tx *sql.Tx) error { x.Q = tx; a.recheckCredential(x); a.login(x); return nil }))
			}()
			if count(ctx, a.DB.Reader, "SELECT count(*) FROM user_sessions") != before {
				t.Fatal("session created from stale credentials")
			}
		})
	}
}
