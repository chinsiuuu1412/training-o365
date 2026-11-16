package app

import "regexp"

var studentNumber = regexp.MustCompile(`^[0-9]{9}$`)
var vietnamMobile = regexp.MustCompile(`^(0|\+84)(3|5|7|8|9)[0-9]{8}$`)

const profileFields = "student_id school_or_institute university_class phone_number gender"

func profile(m M, role string) M {
	p := M{"student_id": nil, "school_or_institute": nil, "university_class": nil, "phone_number": nil, "gender": nil}
	if role != "student" {
		for k := range p {
			if m[k] != nil {
				invalid()
			}
		}
		return p
	}
	for _, k := range []string{"student_id", "school_or_institute", "university_class", "phone_number"} {
		p[k] = name(m, k, 200)
	}
	if !studentNumber.MatchString(str(p, "student_id")) || !vietnamMobile.MatchString(str(p, "phone_number")) {
		invalid()
	}
	if m["gender"] != nil {
		p["gender"] = enum(text(m, "gender"), "male", "female", "other")
	}
	return p
}
func (x *request) managedUser() M {
	u := one(x.Ctx, x.Q, "SELECT * FROM users WHERE id=?", pathID(x.R, "id"))
	if str(u, "role") == "admin" {
		fail(403, "admin_management_disabled", "Không quản lý tài khoản Admin trong MVP.")
	}
	return u
}
func (x *request) uniqueProfile(email string, p M, uid int64) {
	if count(x.Ctx, x.Q, "SELECT count(*) FROM users WHERE email=? AND id<>?", email, uid) > 0 {
		fail(409, "duplicate_email", "Email đã được sử dụng.")
	}
	if p["student_id"] != nil && count(x.Ctx, x.Q, "SELECT count(*) FROM users WHERE student_id=? AND role='student' AND id<>?", p["student_id"], uid) > 0 {
		fail(409, "duplicate_student_id", "MSSV đã được sử dụng.")
	}
}
func (a *App) accountRoutes() {
	a.add("GET", "/admin/users", "admin", false, false, func(x *request) any {
		search := "%" + x.R.URL.Query().Get("search") + "%"
		s := "SELECT * FROM users WHERE role<>'admin' AND (full_name LIKE ? OR email LIKE ? OR student_id LIKE ?)"
		args := []any{search, search, search}
		if role := x.R.URL.Query().Get("role"); role != "" {
			enum(role, "student", "class_manager")
			s += " AND role=?"
			args = append(args, role)
		}
		if active := queryBool(x.R, "is_active"); active != nil {
			s += " AND is_active=?"
			args = append(args, *active)
		}
		all := rows(x.Ctx, x.Q, s+" ORDER BY id", args...)
		for i := range all {
			all[i] = userDTO(all[i])
		}
		return page(x.R, all)
	})
	a.add("POST", "/admin/users", "admin", true, true, func(x *request) any {
		m := x.body("email full_name role password", profileFields)
		role := enum(text(m, "role"), "student", "class_manager")
		p := profile(m, role)
		email := validEmail(text(m, "email"), role)
		x.uniqueProfile(email, p, 0)
		uid := exec(x.Ctx, x.Q, "INSERT INTO users(email,password_hash,full_name,role,student_id,school_or_institute,university_class,phone_number,gender,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)", email, x.PasswordHash, name(m, "full_name", 200), role, p["student_id"], p["school_or_institute"], p["university_class"], p["phone_number"], p["gender"], timestamp(x.Now), timestamp(x.Now))
		return M{"user": userDTO(one(x.Ctx, x.Q, "SELECT * FROM users WHERE id=?", uid))}
	})
	a.add("PUT", "/admin/users/{id}", "admin", false, true, func(x *request) any {
		u := x.managedUser()
		m := x.body("email full_name", profileFields)
		role := str(u, "role")
		p := profile(m, role)
		email := validEmail(text(m, "email"), role)
		uid := integer(u, "id")
		x.uniqueProfile(email, p, uid)
		exec(x.Ctx, x.Q, "UPDATE users SET email=?,full_name=?,student_id=?,school_or_institute=?,university_class=?,phone_number=?,gender=?,updated_at=? WHERE id=?", email, name(m, "full_name", 200), p["student_id"], p["school_or_institute"], p["university_class"], p["phone_number"], p["gender"], timestamp(x.Now), uid)
		if email != str(u, "email") {
			x.revoke(uid)
		}
		return M{"user": userDTO(one(x.Ctx, x.Q, "SELECT * FROM users WHERE id=?", uid))}
	})
	a.add("PATCH", "/admin/users/{id}/status", "admin", false, true, func(x *request) any {
		u := x.managedUser()
		m := x.body("is_active reason", "")
		active := boolean(m, "is_active")
		reason := name(m, "reason", 2000)
		uid := integer(u, "id")
		exec(x.Ctx, x.Q, "UPDATE users SET is_active=?,status_reason=?,updated_at=? WHERE id=?", active, reason, timestamp(x.Now), uid)
		if active != bval(u, "is_active") {
			x.revoke(uid)
		}
		x.audit("account_status", uid, bval(u, "is_active"), active, reason)
		return M{"user": userDTO(one(x.Ctx, x.Q, "SELECT * FROM users WHERE id=?", uid))}
	})
	a.add("POST", "/admin/users/{id}/reset-password", "admin", false, true, func(x *request) any {
		u := x.managedUser()
		m := x.body("new_password", "")
		password(text(m, "new_password"))
		uid := integer(u, "id")
		exec(x.Ctx, x.Q, "UPDATE users SET password_hash=? WHERE id=?", x.PasswordHash, uid)
		x.revoke(uid)
		return M{}
	})
}
