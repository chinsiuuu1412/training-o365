package app

import (
	"strings"
	"time"
)

var vietnam = time.FixedZone("Asia/Ho_Chi_Minh", 7*60*60)

func endOfVietnamDay(s string) time.Time {
	t, e := time.ParseInLocation("2006-01-02", s, vietnam)
	if e != nil {
		invalid()
	}
	return t.AddDate(0, 0, 1).UTC()
}
func (x *request) class(c M) M {
	o := pick(c, "id code name description manager_id capacity end_date expires_at total_sessions min_attendance_percent min_quiz_percent")
	o["is_expired"] = archived(c, x.Now)
	o["manager"] = userDTO(one(x.Ctx, x.Q, "SELECT * FROM users WHERE id=?", integer(c, "manager_id")))
	o["enrolled_count"] = count(x.Ctx, x.Q, "SELECT count(*) FROM class_enrollments WHERE class_id=? AND status='enrolled'", integer(c, "id"))
	ended := int64(0)
	for _, s := range rows(x.Ctx, x.Q, "SELECT ends_at FROM class_sessions WHERE class_id=? AND approved_proposal_id IS NOT NULL", integer(c, "id")) {
		if !x.Now.Before(parseTime(str(s, "ends_at"))) {
			ended++
		}
	}
	o["ended_sessions"] = ended
	return o
}
func (x *request) classInput() M {
	m := x.body("code name description manager_id capacity end_date min_attendance_percent min_quiz_percent", "reassignment_reason confirm_reassignment")
	m["code"] = strings.ToUpper(name(m, "code", 60))
	m["name"] = name(m, "name", 200)
	limited(m, "description", 10000)
	id(m, "capacity")
	m["expires_at"] = timestamp(endOfVietnamDay(text(m, "end_date")))
	for _, k := range []string{"min_attendance_percent", "min_quiz_percent"} {
		v := num(m, k)
		if v < 0 || v > 100 {
			invalid()
		}
	}
	return m
}
func (x *request) validateManager(uid int64) {
	if count(x.Ctx, x.Q, "SELECT count(*) FROM users WHERE id=? AND role='class_manager' AND is_active=1", uid) != 1 {
		invalid()
	}
}
func (a *App) classRoutes() {
	for _, r := range []struct{ prefix, role string }{{"admin", "admin"}, {"manager", "class_manager"}, {"student", "student"}} {
		a.add("GET", "/"+r.prefix+"/classes", r.role, false, false, func(x *request) any {
			all := rows(x.Ctx, x.Q, "SELECT c.* FROM classes c JOIN users u ON u.id=c.manager_id WHERE (c.name LIKE ? OR c.code LIKE ? OR u.full_name LIKE ?) ORDER BY c.id", "%"+x.R.URL.Query().Get("search")+"%", "%"+x.R.URL.Query().Get("search")+"%", "%"+x.R.URL.Query().Get("search")+"%")
			out := []M{}
			for _, c := range all {
				role := str(x.User, "role")
				if role == "class_manager" && integer(c, "manager_id") != integer(x.User, "id") {
					continue
				}
				if role == "student" {
					if archived(c, x.Now) {
						continue
					}
					if count(x.Ctx, x.Q, "SELECT count(*) FROM class_enrollments WHERE class_id=? AND student_id=? AND status='enrolled'", integer(c, "id"), integer(x.User, "id")) == 0 {
						continue
					}
				}
				out = append(out, x.class(c))
			}
			return page(x.R, out)
		})
		a.add("GET", "/"+r.prefix+"/classes/{classId}", r.role, false, false, func(x *request) any { return M{"class": x.class(x.getClass())} })
	}
	a.add("GET", "/student/discover/classes", "student", false, false, func(x *request) any {
		search := "%" + x.R.URL.Query().Get("search") + "%"
		out := []M{}
		for _, c := range rows(x.Ctx, x.Q, "SELECT c.* FROM classes c JOIN users u ON u.id=c.manager_id WHERE c.name LIKE ? OR c.code LIKE ? OR u.full_name LIKE ? ORDER BY c.id", search, search, search) {
			if !archived(c, x.Now) {
				o := x.class(c)
				o["is_enrolled"] = count(x.Ctx, x.Q, "SELECT count(*) FROM class_enrollments WHERE class_id=? AND student_id=? AND status='enrolled'", integer(c, "id"), integer(x.User, "id")) > 0
				out = append(out, o)
			}
		}
		return page(x.R, out)
	})
	a.add("GET", "/student/classes/{classId}/preview", "student", false, false, func(x *request) any {
		c := x.getClass()
		upcoming := []M{}
		for _, s := range rows(x.Ctx, x.Q, "SELECT id,session_number,title,starts_at,ends_at FROM class_sessions WHERE class_id=? AND approved_proposal_id IS NOT NULL ORDER BY session_number", integer(c, "id")) {
			if x.Now.Before(parseTime(str(s, "ends_at"))) {
				upcoming = append(upcoming, s)
			}
		}
		return M{"class": x.class(c), "upcoming_sessions": upcoming}
	})
	a.add("POST", "/admin/classes", "admin", true, true, func(x *request) any {
		m := x.classInput()
		x.validateManager(id(m, "manager_id"))
		if count(x.Ctx, x.Q, "SELECT count(*) FROM classes WHERE code=?", m["code"]) > 0 {
			fail(409, "duplicate_code", "Mã lớp đã tồn tại.")
		}
		cid := exec(x.Ctx, x.Q, "INSERT INTO classes(code,name,description,manager_id,capacity,end_date,expires_at,min_attendance_percent,min_quiz_percent,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)", m["code"], m["name"], m["description"], id(m, "manager_id"), id(m, "capacity"), m["end_date"], m["expires_at"], num(m, "min_attendance_percent"), num(m, "min_quiz_percent"), timestamp(x.Now), timestamp(x.Now))
		return M{"class": x.class(one(x.Ctx, x.Q, "SELECT * FROM classes WHERE id=?", cid))}
	})
	a.add("PUT", "/admin/classes/{classId}", "admin", false, true, func(x *request) any {
		c := x.getClass()
		cid := integer(c, "id")
		m := x.classInput()
		manager := id(m, "manager_id")
		if count(x.Ctx, x.Q, "SELECT count(*) FROM classes WHERE code=? AND id<>?", m["code"], cid) > 0 {
			fail(409, "duplicate_code", "Mã lớp đã tồn tại.")
		}
		if id(m, "capacity") < count(x.Ctx, x.Q, "SELECT count(*) FROM class_enrollments WHERE class_id=? AND status='enrolled'", cid) {
			fail(409, "capacity_below_enrolled", "Sĩ số tối đa thấp hơn số học viên.")
		}
		if manager != integer(c, "manager_id") {
			x.validateManager(manager)
			reason := name(m, "reassignment_reason", 2000)
			if !boolean(m, "confirm_reassignment") {
				invalid()
			}
			x.audit("manager_reassignment", cid, c["manager_id"], manager, reason)
			x.notify([]int64{manager, integer(c, "manager_id")}, cid, "Đổi quản lý lớp", reason)
		}
		exec(x.Ctx, x.Q, "UPDATE classes SET code=?,name=?,description=?,manager_id=?,capacity=?,end_date=?,expires_at=?,min_attendance_percent=?,min_quiz_percent=?,updated_at=? WHERE id=?", m["code"], m["name"], m["description"], manager, id(m, "capacity"), m["end_date"], m["expires_at"], num(m, "min_attendance_percent"), num(m, "min_quiz_percent"), timestamp(x.Now), cid)
		return M{"class": x.class(x.getClass())}
	})
	a.add("PUT", "/manager/classes/{classId}/total-sessions", "class_manager", false, true, func(x *request) any {
		c := x.getClass()
		m := x.body("total_sessions", "")
		n := id(m, "total_sessions")
		if n > 10000 {
			invalid()
		}
		if c["total_sessions"] != nil {
			fail(409, "total_sessions_fixed", "Tổng số buổi chỉ được đặt một lần.")
		}
		exec(x.Ctx, x.Q, "UPDATE classes SET total_sessions=?,updated_at=? WHERE id=?", n, timestamp(x.Now), integer(c, "id"))
		return M{"class": x.class(x.getClass())}
	})
}
