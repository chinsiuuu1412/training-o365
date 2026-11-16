package app

import (
	"context"
	"o365-lms/backend/internal/db"
	"path/filepath"
	"testing"
)

func TestV2SyntheticSeedUsesProfilesAndCycles(t *testing.T) {
	ctx := context.Background()
	d, e := db.Open(ctx, filepath.Join(t.TempDir(), "seed.db"), 4)
	if e != nil {
		t.Fatal(e)
	}
	defer d.Close()
	if e = Seed(ctx, d, "test-password-123", "test-password-456", "test-password-789"); e != nil {
		t.Fatal(e)
	}
	if count(ctx, d.Reader, "SELECT count(*) FROM users WHERE role='student' AND length(student_id)=9") != 100 || count(ctx, d.Reader, "SELECT count(*) FROM class_enrollments WHERE cycle_number=1") != 100 {
		t.Fatal("seed profiles/cycles missing")
	}
	if count(ctx, d.Reader, "SELECT count(*) FROM classes WHERE capacity=40 AND total_sessions=3") != 3 {
		t.Fatal("seed class contract missing")
	}
	if e = Seed(ctx, d, "test-password-123", "test-password-456", "test-password-789"); e == nil {
		t.Fatal("second seed accepted")
	}
	if count(ctx, d.Reader, "SELECT count(*) FROM users") != 104 {
		t.Fatal("second seed mutated data")
	}
}
