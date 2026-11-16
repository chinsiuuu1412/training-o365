package db

import (
	"context"
	"database/sql"
	"errors"
	"path/filepath"
	"strings"
	"testing"
)

func TestWALImmediatePoolsMigrationAndRollback(t *testing.T) {
	ctx := context.Background()
	path := filepath.Join(t.TempDir(), "lms.db")
	d, e := Open(ctx, path, 8)
	if e != nil {
		t.Fatal(e)
	}
	if d.Writer.Stats().MaxOpenConnections != 1 || d.Reader.Stats().MaxOpenConnections != 8 {
		t.Fatal("pool limits")
	}
	var journal string
	if e = d.Reader.QueryRowContext(ctx, "PRAGMA journal_mode").Scan(&journal); e != nil || journal != "wal" {
		t.Fatal(journal, e)
	}
	if e = d.Write(ctx, func(tx *sql.Tx) error {
		_, e := tx.ExecContext(ctx, "INSERT INTO users(email,password_hash,full_name,role) VALUES('x@example.test','synthetic','X','admin')")
		return e
	}); e != nil {
		t.Fatal(e)
	}
	sentinel := errors.New("rollback")
	e = d.Write(ctx, func(tx *sql.Tx) error {
		if _, e := tx.ExecContext(ctx, "UPDATE users SET full_name='Wrong'"); e != nil {
			return e
		}
		return sentinel
	})
	if !errors.Is(e, sentinel) {
		t.Fatal(e)
	}
	var full string
	if e = d.Reader.QueryRowContext(ctx, "SELECT full_name FROM users").Scan(&full); e != nil || full != "X" {
		t.Fatal("rollback failure", e)
	}
	if _, e = d.Reader.ExecContext(ctx, "DELETE FROM users"); e == nil {
		t.Fatal("reader is writable")
	}
	for name, pool := range map[string]*sql.DB{"writer": d.Writer, "reader": d.Reader} {
		var enabled int
		if e = pool.QueryRowContext(ctx, "PRAGMA foreign_keys").Scan(&enabled); e != nil || enabled != 1 {
			t.Fatalf("%s foreign_keys=%d: %v", name, enabled, e)
		}
	}
	const orphanClass = "INSERT INTO classes(code,name,description,manager_id,capacity,end_date,expires_at,min_attendance_percent,min_quiz_percent,created_at,updated_at) VALUES('orphan','Invalid','Synthetic FK fixture',999,1,'2026-11-15','2026-11-15T17:00:00Z',0,0,'2026-11-15T00:00:00Z','2026-11-15T00:00:00Z')"
	if e = d.Write(ctx, func(tx *sql.Tx) error {
		_, e := tx.ExecContext(ctx, orphanClass)
		return e
	}); e == nil || !strings.Contains(e.Error(), "FOREIGN KEY constraint failed") {
		t.Fatalf("expected FOREIGN KEY constraint failed, got %v", e)
	}
	// Pin one connection; disable FK only here and restore before returning it to the pool.
	func() {
		conn, err := d.Writer.Conn(ctx)
		if err != nil {
			t.Fatal(err)
		}
		defer conn.Close()
		defer func() {
			if _, err := conn.ExecContext(ctx, "PRAGMA foreign_keys=ON"); err != nil {
				t.Fatal(err)
			}
		}()
		if _, err = conn.ExecContext(ctx, "PRAGMA foreign_keys=OFF"); err != nil {
			t.Fatal(err)
		}
		tx, err := conn.BeginTx(ctx, nil)
		if err != nil {
			t.Fatal(err)
		}
		defer tx.Rollback()
		if _, err = tx.ExecContext(ctx, orphanClass); err != nil {
			t.Fatalf("FK fixture must succeed with enforcement disabled: %v", err)
		}
	}()
	d.Close()
	d, e = Open(ctx, path, 8)
	if e != nil {
		t.Fatal(e)
	}
	defer d.Close()
	var version int
	if e = d.Reader.QueryRowContext(ctx, "SELECT max(version) FROM schema_migrations").Scan(&version); e != nil || version != 1 {
		t.Fatal("migration not idempotent", e)
	}
	var n int
	if e = d.Reader.QueryRowContext(ctx, "SELECT count(*) FROM users").Scan(&n); e != nil || n != 1 {
		t.Fatal("reopen lost data", e)
	}
}
