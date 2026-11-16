package db

import (
	"bytes"
	"context"
	"database/sql"
	"errors"
	"os"
	"path/filepath"
	"testing"
)

func TestV2RejectsLegacyAndUnmarkedFilesWithoutMutation(t *testing.T) {
	for _, legacy := range []string{
		"CREATE TABLE users(id INTEGER PRIMARY KEY,secret TEXT); INSERT INTO users VALUES(1,'synthetic'); CREATE TABLE schema_migrations(version INTEGER); INSERT INTO schema_migrations VALUES(1)",
		"CREATE TABLE schema_migrations(version INTEGER); INSERT INTO schema_migrations VALUES(2)",
		"CREATE TABLE unrelated(id INTEGER)",
	} {
		t.Run(legacy[:20], func(t *testing.T) {
			ctx := context.Background()
			path := filepath.Join(t.TempDir(), "legacy.db")
			raw, e := sql.Open("sqlite", path)
			if e != nil {
				t.Fatal(e)
			}
			if _, e = raw.Exec(legacy); e != nil {
				t.Fatal(e)
			}
			raw.Close()
			before, e := os.ReadFile(path)
			if e != nil {
				t.Fatal(e)
			}
			for _, open := range []func(context.Context, string, int) (*DB, error){Open, OpenExisting} {
				d, e := open(ctx, path, 2)
				if d != nil {
					d.Close()
					t.Fatal("legacy accepted")
				}
				if !errors.Is(e, ErrIncompatible) {
					t.Fatalf("unclear legacy failure: %v", e)
				}
			}
			after, e := os.ReadFile(path)
			if e != nil {
				t.Fatal(e)
			}
			if !bytes.Equal(before, after) {
				t.Fatal("legacy file modified")
			}
			for _, suffix := range []string{"-wal", "-shm"} {
				if _, e = os.Stat(path + suffix); !errors.Is(e, os.ErrNotExist) {
					t.Fatal("legacy open created WAL artifacts")
				}
			}
		})
	}
}
func TestV2ExistingRequiresContractAndNeverCreates(t *testing.T) {
	path := filepath.Join(t.TempDir(), "missing.db")
	if d, e := OpenExisting(context.Background(), path, 2); e == nil {
		d.Close()
		t.Fatal("created missing db")
	}
	if _, e := os.Stat(path); !errors.Is(e, os.ErrNotExist) {
		t.Fatal("missing db created")
	}
	d, e := Open(context.Background(), path, 2)
	if e != nil {
		t.Fatal(e)
	}
	d.Close()
	d, e = OpenExisting(context.Background(), path, 2)
	if e != nil {
		t.Fatal(e)
	}
	d.Close()
}
