package db

import (
	"context"
	"database/sql"
	_ "embed"
	"errors"
	_ "modernc.org/sqlite"
	"net/url"
	"os"
	"path/filepath"
	"time"
)

//go:embed 001_initial.sql
var schema string

const Contract = "approved-v2"

var ErrIncompatible = errors.New("incompatible database: approved-v2 clean baseline required; legacy databases are not migrated; use a separate new database path")

type DB struct{ Writer, Reader *sql.DB }
type Queryer interface {
	ExecContext(context.Context, string, ...any) (sql.Result, error)
	QueryContext(context.Context, string, ...any) (*sql.Rows, error)
	QueryRowContext(context.Context, string, ...any) *sql.Row
}

func Open(ctx context.Context, path string, readers int) (*DB, error) {
	return open(ctx, path, readers, true)
}
func OpenExisting(ctx context.Context, path string, readers int) (*DB, error) {
	if _, e := os.Stat(path); e != nil {
		return nil, e
	}
	return open(ctx, path, readers, false)
}
func open(ctx context.Context, path string, readers int, create bool) (*DB, error) {
	abs, e := filepath.Abs(path)
	if e != nil {
		return nil, e
	}
	if create {
		if e = os.MkdirAll(filepath.Dir(abs), 0700); e != nil {
			return nil, e
		}
	}
	p := filepath.ToSlash(abs)
	if filepath.VolumeName(abs) != "" {
		p = "/" + p
	}
	u := url.URL{Scheme: "file", Path: p}
	opts := "_pragma=busy_timeout(10000)&_pragma=foreign_keys(1)&_pragma=synchronous(NORMAL)&_pragma=cache_size(-4000)"
	// Inspect existing files read-only before any WAL pragma or schema mutation.
	if info, err := os.Stat(abs); err == nil && info.Size() > 0 {
		probe, err := sql.Open("sqlite", u.String()+"?mode=ro")
		if err != nil {
			return nil, err
		}
		err = compatible(ctx, probe)
		probe.Close()
		if err != nil {
			return nil, err
		}
	} else if !create {
		return nil, ErrIncompatible
	}
	mode := "rwc"
	if !create {
		mode = "rw"
	}
	w, e := sql.Open("sqlite", u.String()+"?mode="+mode+"&"+opts+"&_txlock=immediate")
	if e != nil {
		return nil, e
	}
	w.SetMaxOpenConns(1)
	w.SetMaxIdleConns(1)
	d := &DB{Writer: w}
	ok := false
	defer func() {
		if !ok {
			d.Close()
		}
	}()
	if create {
		e = d.Write(ctx, func(tx *sql.Tx) error {
			var n int
			if err := tx.QueryRowContext(ctx, "SELECT count(*) FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").Scan(&n); err != nil {
				return err
			}
			if n > 0 {
				return compatible(ctx, tx)
			}
			if _, err := tx.ExecContext(ctx, schema); err != nil {
				return err
			}
			_, err := tx.ExecContext(ctx, "CREATE TABLE schema_migrations(version INTEGER PRIMARY KEY,applied_at TEXT NOT NULL); INSERT INTO schema_migrations VALUES(1,?)", time.Now().UTC().Format(time.RFC3339Nano))
			return err
		})
		if e != nil {
			return nil, e
		}
	}
	var journal string
	if e = w.QueryRowContext(ctx, "PRAGMA journal_mode=WAL").Scan(&journal); e != nil {
		return nil, e
	}
	if journal != "wal" {
		return nil, errors.New("SQLite WAL unavailable")
	}
	r, e := sql.Open("sqlite", u.String()+"?mode=ro&"+opts)
	if e != nil {
		return nil, e
	}
	d.Reader = r
	if readers < 1 {
		readers = 1
	}
	r.SetMaxOpenConns(readers)
	r.SetMaxIdleConns(readers)
	r.SetConnMaxIdleTime(5 * time.Minute)
	if e = r.PingContext(ctx); e != nil {
		return nil, e
	}
	ok = true
	return d, nil
}
func compatible(ctx context.Context, q Queryer) error {
	var contract string
	var version int
	if e := q.QueryRowContext(ctx, "SELECT name FROM backend_contract WHERE id=1").Scan(&contract); e != nil || contract != Contract {
		return ErrIncompatible
	}
	if e := q.QueryRowContext(ctx, "SELECT max(version) FROM schema_migrations").Scan(&version); e != nil || version != 1 {
		return ErrIncompatible
	}
	return nil
}
func (d *DB) Write(ctx context.Context, fn func(*sql.Tx) error) error {
	tx, e := d.Writer.BeginTx(ctx, nil)
	if e != nil {
		return e
	}
	defer tx.Rollback()
	if e = fn(tx); e != nil {
		return e
	}
	return tx.Commit()
}
func (d *DB) Close() {
	if d.Reader != nil {
		d.Reader.Close()
	}
	if d.Writer != nil {
		d.Writer.Close()
	}
}
