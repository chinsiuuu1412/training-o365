package app

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"o365-lms/backend/internal/db"
	"time"
)

// Seed only accepts a pristine v2 database. Passwords supplied by operator.
func Seed(ctx context.Context, d *db.DB, adminPassword, managerPassword, studentPassword string) error {
	for _, p := range []string{adminPassword, managerPassword, studentPassword} {
		if len(p) < 12 || len(p) > 72 {
			return errors.New("seed passwords must contain 12–72 bytes")
		}
	}
	var n int
	if e := d.Reader.QueryRowContext(ctx, "SELECT count(*) FROM users").Scan(&n); e != nil {
		return e
	}
	if n != 0 {
		return errors.New("seed requires pristine database")
	}
	adminHash, managerHash, studentHash := string(hashPassword(adminPassword)), string(hashPassword(managerPassword)), string(hashPassword(studentPassword))
	return d.Write(ctx, func(tx *sql.Tx) error {
		if e := tx.QueryRowContext(ctx, "SELECT count(*) FROM users").Scan(&n); e != nil {
			return e
		}
		if n != 0 {
			return errors.New("seed requires pristine database")
		}
		now := time.Now().UTC()
		stamp := timestamp(now)
		if _, e := tx.ExecContext(ctx, "INSERT INTO users(email,password_hash,full_name,role,created_at,updated_at) VALUES('admin@example.test',?,'Quản trị viên mẫu','admin',?,?)", adminHash, stamp, stamp); e != nil {
			return e
		}
		for i := 1; i <= 3; i++ {
			r, e := tx.ExecContext(ctx, "INSERT INTO users(email,password_hash,full_name,role,created_at,updated_at) VALUES(?,?,?,'class_manager',?,?)", fmt.Sprintf("manager%d@example.test", i), managerHash, fmt.Sprintf("Quản lý %d", i), stamp, stamp)
			if e != nil {
				return e
			}
			uid, e := r.LastInsertId()
			if e != nil {
				return e
			}
			end := now.In(vietnam).AddDate(0, 1, 0).Format("2006-01-02")
			if _, e = tx.ExecContext(ctx, "INSERT INTO classes(code,name,description,manager_id,capacity,end_date,expires_at,total_sessions,min_attendance_percent,min_quiz_percent,created_at,updated_at) VALUES(?,?,?,?,?,?,?,3,80,60,?,?)", fmt.Sprintf("MOS-%d", i), fmt.Sprintf("MOS %d", i), "Lớp mẫu v2", uid, 40, end, timestamp(endOfVietnamDay(end)), stamp, stamp); e != nil {
				return e
			}
		}
		for i := 1; i <= 100; i++ {
			r, e := tx.ExecContext(ctx, "INSERT INTO users(email,password_hash,full_name,role,student_id,school_or_institute,university_class,phone_number,created_at,updated_at) VALUES(?,?,?,'student',?,?,?,?,?,?)", fmt.Sprintf("student%03d@sis.hust.edu.vn", i), studentHash, fmt.Sprintf("Học viên %03d", i), fmt.Sprintf("2025%05d", i), "Trường CNTT và Truyền thông", "K71", "0912345678", stamp, stamp)
			if e != nil {
				return e
			}
			uid, e := r.LastInsertId()
			if e != nil {
				return e
			}
			cid := 1 + (i-1)%3
			r, e = tx.ExecContext(ctx, "INSERT INTO enrollment_requests(class_id,student_id,reason,status,created_at,decided_at,decided_by) VALUES(?,?,'Dữ liệu mẫu','approved',?,?,?)", cid, uid, stamp, stamp, cid+1)
			if e != nil {
				return e
			}
			rid, e := r.LastInsertId()
			if e != nil {
				return e
			}
			if _, e = tx.ExecContext(ctx, "INSERT INTO class_enrollments(class_id,student_id,cycle_number,request_id,status,approved_at) VALUES(?,?,1,?,'enrolled',?)", cid, uid, rid, stamp); e != nil {
				return e
			}
		}
		return nil
	})
}
