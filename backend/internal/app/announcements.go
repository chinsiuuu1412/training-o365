package app

func (x *request) notify(recipients []int64, cid int64, title, content string) {
	if len(recipients) == 0 {
		return
	}
	var class any
	if cid > 0 {
		class = cid
	}
	aid := exec(x.Ctx, x.Q, "INSERT INTO announcements(sender_id,class_id,title,content,automated,created_at) VALUES(NULL,?,?,?,1,?)", class, title, content, timestamp(x.Now))
	seen := map[int64]bool{}
	for _, uid := range recipients {
		if !seen[uid] {
			exec(x.Ctx, x.Q, "INSERT INTO announcement_recipients(announcement_id,user_id) VALUES(?,?)", aid, uid)
			seen[uid] = true
		}
	}
}
func (x *request) admins() []int64 {
	out := []int64{}
	for _, u := range rows(x.Ctx, x.Q, "SELECT id FROM users WHERE role='admin' AND is_active=1") {
		out = append(out, integer(u, "id"))
	}
	return out
}
func (x *request) classStudents(cid int64) []int64 {
	out := []int64{}
	for _, u := range rows(x.Ctx, x.Q, "SELECT e.student_id FROM class_enrollments e JOIN users u ON u.id=e.student_id WHERE e.class_id=? AND e.status='enrolled' AND u.is_active=1", cid) {
		out = append(out, integer(u, "student_id"))
	}
	return out
}
func (a *App) announcementRoutes() {
	a.add("GET", "/announcements", "any", false, false, func(x *request) any {
		s := "SELECT a.id,a.sender_id,a.class_id,a.title,a.content,a.automated,a.created_at,r.is_read FROM announcements a JOIN announcement_recipients r ON r.announcement_id=a.id WHERE r.user_id=?"
		args := []any{integer(x.User, "id")}
		if read := queryBool(x.R, "is_read"); read != nil {
			s += " AND r.is_read=?"
			args = append(args, *read)
		}
		return page(x.R, rows(x.Ctx, x.Q, s+" ORDER BY a.id DESC", args...))
	})
	a.add("GET", "/announcements/{id}", "any", false, false, func(x *request) any {
		return M{"announcement": one(x.Ctx, x.Q, "SELECT a.*,r.is_read FROM announcements a JOIN announcement_recipients r ON r.announcement_id=a.id WHERE a.id=? AND r.user_id=?", pathID(x.R, "id"), integer(x.User, "id"))}
	})
	a.add("PATCH", "/announcements/{id}/read", "any", false, true, func(x *request) any {
		m := x.body("is_read", "")
		rid := one(x.Ctx, x.Q, "SELECT id FROM announcement_recipients WHERE announcement_id=? AND user_id=?", pathID(x.R, "id"), integer(x.User, "id"))
		exec(x.Ctx, x.Q, "UPDATE announcement_recipients SET is_read=? WHERE id=?", boolean(m, "is_read"), integer(rid, "id"))
		return M{}
	})
	for _, r := range []struct{ prefix, role string }{{"admin", "admin"}, {"manager", "class_manager"}} {
		a.add("GET", "/"+r.prefix+"/recipients", r.role, false, false, func(x *request) any {
			s := "SELECT DISTINCT u.* FROM users u WHERE u.is_active=1 AND u.role IN ('student','class_manager')"
			args := []any{}
			if str(x.User, "role") == "class_manager" {
				s += " AND u.role='student' AND EXISTS(SELECT 1 FROM class_enrollments e JOIN classes c ON c.id=e.class_id WHERE e.student_id=u.id AND e.status='enrolled' AND c.manager_id=?)"
				args = append(args, integer(x.User, "id"))
			}
			all := rows(x.Ctx, x.Q, s+" ORDER BY u.id", args...)
			out := []M{}
			for _, u := range all {
				if str(x.User, "role") == "class_manager" && !x.canMessage(integer(u, "id")) {
					continue
				}
				out = append(out, userDTO(u))
			}
			return page(x.R, out)
		})
		a.add("POST", "/"+r.prefix+"/announcements", r.role, true, true, func(x *request) any {
			m := x.body("recipient_ids title content", "")
			recipients := ids(m, "recipient_ids")
			if len(recipients) == 0 || len(recipients) > 10000 {
				invalid()
			}
			title, content := name(m, "title", 200), name(m, "content", 20000)
			for _, uid := range recipients {
				if !x.canMessage(uid) {
					fail(422, "invalid_recipients", "Danh sách người nhận không hợp lệ.")
				}
			}
			aid := exec(x.Ctx, x.Q, "INSERT INTO announcements(sender_id,title,content,created_at) VALUES(?,?,?,?)", integer(x.User, "id"), title, content, timestamp(x.Now))
			for _, uid := range recipients {
				exec(x.Ctx, x.Q, "INSERT INTO announcement_recipients(announcement_id,user_id) VALUES(?,?)", aid, uid)
			}
			return M{"announcement_id": aid, "recipient_count": len(recipients)}
		})
	}
}
func (x *request) canMessage(uid int64) bool {
	if count(x.Ctx, x.Q, "SELECT count(*) FROM users WHERE id=? AND is_active=1 AND role IN ('student','class_manager')", uid) == 0 {
		return false
	}
	if str(x.User, "role") == "admin" {
		return true
	}
	for _, c := range rows(x.Ctx, x.Q, "SELECT c.* FROM classes c JOIN class_enrollments e ON e.class_id=c.id WHERE e.student_id=? AND e.status='enrolled' AND c.manager_id=?", uid, integer(x.User, "id")) {
		if !archived(c, x.Now) {
			return true
		}
	}
	return false
}
