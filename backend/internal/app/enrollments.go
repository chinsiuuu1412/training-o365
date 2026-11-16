package app

import "time"

func (a *App) enrollmentRoutes() {
	a.add("POST", "/student/classes/{classId}/enrollment-requests", "student", true, true, func(x *request) any {
		m := x.body("reason", "")
		reason := name(m, "reason", 2000)
		cid, uid := pathID(x.R, "classId"), integer(x.User, "id")
		c := x.getClass()
		if count(x.Ctx, x.Q, "SELECT count(*) FROM class_enrollments WHERE class_id=? AND student_id=? AND status='enrolled'", cid, uid) > 0 {
			fail(409, "already_enrolled", "Bạn đã tham gia lớp.")
		}
		if count(x.Ctx, x.Q, "SELECT count(*) FROM enrollment_requests WHERE class_id=? AND student_id=? AND status='pending'", cid, uid) > 0 {
			fail(409, "request_pending", "Yêu cầu đang chờ duyệt.")
		}
		declines := rows(x.Ctx, x.Q, "SELECT * FROM enrollment_requests WHERE class_id=? AND student_id=? AND status='declined' ORDER BY id DESC", cid, uid)
		if len(declines) >= 3 {
			fail(409, "decline_limit", "Đã đạt giới hạn ba lần bị từ chối.")
		}
		if len(declines) > 0 {
			last := declines[0]
			if x.Now.Before(parseTime(str(last, "decided_at")).Add(10 * time.Minute)) {
				fail(409, "decline_cooldown", "Vui lòng chờ đủ 10 phút.")
			}
			if reason == str(last, "reason") {
				fail(422, "new_reason_required", "Cần lý do mới khác lần bị từ chối gần nhất.")
			}
		}
		if count(x.Ctx, x.Q, "SELECT count(*) FROM class_enrollments WHERE class_id=? AND status='enrolled'", cid) >= integer(c, "capacity") {
			fail(409, "class_full", "Lớp đã đủ sĩ số.")
		}
		rid := exec(x.Ctx, x.Q, "INSERT INTO enrollment_requests(class_id,student_id,reason,status,created_at) VALUES(?,?,?,'pending',?)", cid, uid, reason, timestamp(x.Now))
		x.notify([]int64{integer(c, "manager_id")}, cid, "Yêu cầu vào lớp", reason)
		return M{"request": one(x.Ctx, x.Q, "SELECT * FROM enrollment_requests WHERE id=?", rid)}
	})
	a.add("GET", "/student/enrollment-requests", "student", false, false, func(x *request) any {
		return page(x.R, rows(x.Ctx, x.Q, "SELECT * FROM enrollment_requests WHERE student_id=? ORDER BY id DESC", integer(x.User, "id")))
	})
	a.add("POST", "/student/classes/{classId}/enrollment-requests/{requestId}/cancel", "student", false, true, func(x *request) any {
		x.body("", "")
		r := one(x.Ctx, x.Q, "SELECT * FROM enrollment_requests WHERE id=? AND class_id=? AND student_id=?", pathID(x.R, "requestId"), pathID(x.R, "classId"), integer(x.User, "id"))
		if str(r, "status") != "pending" {
			fail(409, "request_processed", "Yêu cầu đã được xử lý.")
		}
		exec(x.Ctx, x.Q, "UPDATE enrollment_requests SET status='cancelled',decided_at=? WHERE id=?", timestamp(x.Now), integer(r, "id"))
		return M{}
	})
	for _, r := range []struct{ prefix, role string }{{"admin", "admin"}, {"manager", "class_manager"}} {
		base := "/" + r.prefix + "/classes/{classId}"
		a.add("GET", base+"/enrollment-requests", r.role, false, false, func(x *request) any {
			return page(x.R, rows(x.Ctx, x.Q, "SELECT r.*,u.full_name,u.student_id AS student_number FROM enrollment_requests r JOIN users u ON u.id=r.student_id WHERE class_id=? ORDER BY r.id DESC", pathID(x.R, "classId")))
		})
		a.add("GET", base+"/enrollments", r.role, false, true, func(x *request) any {
			all := rows(x.Ctx, x.Q, "SELECT * FROM class_enrollments WHERE class_id=? ORDER BY id DESC", pathID(x.R, "classId"))
			for _, e := range all {
				e["student"] = userDTO(one(x.Ctx, x.Q, "SELECT * FROM users WHERE id=?", integer(e, "student_id")))
				e["progress"] = x.progress(e)
			}
			return page(x.R, all)
		})
		a.add("POST", base+"/enrollments/{enrollmentId}/remove", r.role, false, true, func(x *request) any {
			m := x.body("reason", "")
			reason := name(m, "reason", 2000)
			e := one(x.Ctx, x.Q, "SELECT * FROM class_enrollments WHERE id=? AND class_id=?", pathID(x.R, "enrollmentId"), pathID(x.R, "classId"))
			if str(e, "status") != "enrolled" {
				fail(409, "stale_enrollment", "Lần ghi danh đã kết thúc.")
			}
			exec(x.Ctx, x.Q, "UPDATE class_enrollments SET status='removed',removed_at=?,removal_reason=? WHERE id=?", timestamp(x.Now), reason, integer(e, "id"))
			x.audit("enrollment_remove", integer(e, "id"), "enrolled", "removed", reason)
			x.notify([]int64{integer(e, "student_id")}, pathID(x.R, "classId"), "Đã bị xóa khỏi lớp", reason)
			return M{}
		})
	}
	a.add("POST", "/manager/classes/{classId}/enrollment-requests/{requestId}/review", "class_manager", false, true, func(x *request) any {
		m := x.body("decision", "reason")
		decision := enum(text(m, "decision"), "approve", "decline")
		r := one(x.Ctx, x.Q, "SELECT * FROM enrollment_requests WHERE id=? AND class_id=?", pathID(x.R, "requestId"), pathID(x.R, "classId"))
		if str(r, "status") != "pending" {
			fail(409, "request_processed", "Yêu cầu đã được xử lý.")
		}
		cid, uid := pathID(x.R, "classId"), integer(r, "student_id")
		reason := ""
		if decision == "decline" {
			reason = name(m, "reason", 2000)
		}
		if decision == "approve" {
			if count(x.Ctx, x.Q, "SELECT count(*) FROM users WHERE id=? AND role='student' AND is_active=1", uid) != 1 {
				fail(409, "student_inactive", "Tài khoản học viên không hoạt động.")
			}
			if count(x.Ctx, x.Q, "SELECT count(*) FROM class_enrollments WHERE class_id=? AND student_id=? AND status='enrolled'", cid, uid) > 0 {
				fail(409, "already_enrolled", "Học viên đã tham gia.")
			}
			if count(x.Ctx, x.Q, "SELECT count(*) FROM class_enrollments WHERE class_id=? AND status='enrolled'", cid) >= integer(x.getClass(), "capacity") {
				fail(409, "class_full", "Lớp đã đủ sĩ số.")
			}
			cycle := 1 + count(x.Ctx, x.Q, "SELECT coalesce(max(cycle_number),0) FROM class_enrollments WHERE class_id=? AND student_id=?", cid, uid)
			exec(x.Ctx, x.Q, "INSERT INTO class_enrollments(class_id,student_id,cycle_number,request_id,status,approved_at) VALUES(?,?,?,?,'enrolled',?)", cid, uid, cycle, integer(r, "id"), timestamp(x.Now))
		}
		status := "approved"
		if decision == "decline" {
			status = "declined"
		}
		exec(x.Ctx, x.Q, "UPDATE enrollment_requests SET status=?,decision_reason=?,decided_by=?,decided_at=? WHERE id=?", status, reason, integer(x.User, "id"), timestamp(x.Now), integer(r, "id"))
		x.notify([]int64{uid}, cid, "Kết quả đăng ký: "+status, reason)
		return M{"request": one(x.Ctx, x.Q, "SELECT * FROM enrollment_requests WHERE id=?", integer(r, "id"))}
	})
	a.add("GET", "/student/enrollment-history", "student", false, true, func(x *request) any {
		all := rows(x.Ctx, x.Q, "SELECT * FROM class_enrollments WHERE student_id=? ORDER BY id DESC", integer(x.User, "id"))
		out := []M{}
		for _, e := range all {
			c := one(x.Ctx, x.Q, "SELECT * FROM classes WHERE id=?", integer(e, "class_id"))
			out = append(out, M{"enrollment": e, "class": pick(c, "id code name end_date"), "progress": x.progress(e)})
		}
		return page(x.R, out)
	})
}
