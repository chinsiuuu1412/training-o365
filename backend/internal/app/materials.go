package app

import (
	"net/url"
	"strings"
)

func httpsLink(s string) string {
	u, e := url.Parse(s)
	if e != nil || u.Scheme != "https" || u.Hostname() == "" || u.User != nil || len(s) > 4000 || strings.ContainsAny(s, "\r\n") {
		invalid()
	}
	return u.String()
}
func youtubeMaterial(m M) bool {
	if str(m, "material_type") != "video" {
		return false
	}
	u, e := url.Parse(str(m, "url"))
	if e != nil {
		return false
	}
	host := strings.ToLower(u.Hostname())
	return host == "youtube.com" || host == "www.youtube.com" || host == "m.youtube.com" || host == "youtu.be" || host == "www.youtube-nocookie.com"
}
func (x *request) materialInput() M {
	m := x.body("title description material_type url", "session_id expires_at")
	m["title"] = name(m, "title", 200)
	limited(m, "description", 10000)
	enum(text(m, "material_type"), "document", "video")
	m["url"] = httpsLink(text(m, "url"))
	if m["session_id"] != nil {
		if count(x.Ctx, x.Q, "SELECT count(*) FROM class_sessions WHERE id=? AND class_id=?", id(m, "session_id"), pathID(x.R, "classId")) != 1 {
			invalid()
		}
	}
	if m["expires_at"] != nil {
		m["expires_at"] = timestamp(parseTime(text(m, "expires_at")))
	}
	return m
}
func (a *App) materialRoutes() {
	for _, r := range []struct{ prefix, role string }{{"admin", "admin"}, {"manager", "class_manager"}, {"student", "student"}} {
		base := "/" + r.prefix + "/classes/{classId}/materials"
		a.add("GET", base, r.role, false, false, func(x *request) any {
			s := "SELECT * FROM materials WHERE class_id=?"
			args := []any{pathID(x.R, "classId")}
			if kind := x.R.URL.Query().Get("material_type"); kind != "" {
				enum(kind, "document", "video")
				s += " AND material_type=?"
				args = append(args, kind)
			}
			if sid := x.R.URL.Query().Get("session_id"); sid != "" {
				s += " AND session_id=?"
				args = append(args, queryInt(x.R, "session_id", 0, 1, 1000000000))
			}
			if search := x.R.URL.Query().Get("search"); search != "" {
				s += " AND (title LIKE ? OR description LIKE ?)"
				args = append(args, "%"+search+"%", "%"+search+"%")
			}
			out := []M{}
			for _, m := range rows(x.Ctx, x.Q, s+" ORDER BY id", args...) {
				if str(x.User, "role") == "student" {
					if m["deleted_at"] != nil {
						continue
					}
					if m["expires_at"] != nil && !youtubeMaterial(m) && !x.Now.Before(parseTime(str(m, "expires_at"))) {
						continue
					}
				}
				out = append(out, m)
			}
			return page(x.R, out)
		})
		a.add("GET", base+"/{materialId}", r.role, false, false, func(x *request) any {
			m := one(x.Ctx, x.Q, "SELECT * FROM materials WHERE id=? AND class_id=?", pathID(x.R, "materialId"), pathID(x.R, "classId"))
			if str(x.User, "role") == "student" && (m["deleted_at"] != nil || (m["expires_at"] != nil && !youtubeMaterial(m) && !x.Now.Before(parseTime(str(m, "expires_at"))))) {
				fail(403, "material_expired", "Tài liệu không còn được phép truy cập.")
			}
			return M{"material": m}
		})
		if r.role != "student" {
			a.add("DELETE", base+"/{materialId}", r.role, false, true, func(x *request) any {
				m := x.body("reason", "")
				reason := name(m, "reason", 2000)
				material := one(x.Ctx, x.Q, "SELECT * FROM materials WHERE id=? AND class_id=? AND deleted_at IS NULL", pathID(x.R, "materialId"), pathID(x.R, "classId"))
				exec(x.Ctx, x.Q, "UPDATE materials SET deleted_at=?,deletion_reason=?,updated_at=? WHERE id=?", timestamp(x.Now), reason, timestamp(x.Now), integer(material, "id"))
				x.audit("material_delete", integer(material, "id"), material, nil, reason)
				if str(x.User, "role") == "admin" {
					x.notify([]int64{integer(x.getClass(), "manager_id")}, pathID(x.R, "classId"), "Admin gỡ tài liệu", str(material, "title")+": "+reason)
				}
				return M{}
			})
		}
	}
	a.add("POST", "/manager/classes/{classId}/materials", "class_manager", true, true, func(x *request) any {
		m := x.materialInput()
		mid := exec(x.Ctx, x.Q, "INSERT INTO materials(class_id,session_id,title,description,material_type,url,expires_at,created_by,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)", pathID(x.R, "classId"), m["session_id"], m["title"], m["description"], m["material_type"], m["url"], m["expires_at"], integer(x.User, "id"), timestamp(x.Now), timestamp(x.Now))
		return M{"material": one(x.Ctx, x.Q, "SELECT * FROM materials WHERE id=?", mid)}
	})
	a.add("PUT", "/manager/classes/{classId}/materials/{materialId}", "class_manager", false, true, func(x *request) any {
		old := one(x.Ctx, x.Q, "SELECT * FROM materials WHERE id=? AND class_id=? AND deleted_at IS NULL", pathID(x.R, "materialId"), pathID(x.R, "classId"))
		m := x.materialInput()
		exec(x.Ctx, x.Q, "UPDATE materials SET session_id=?,title=?,description=?,material_type=?,url=?,expires_at=?,updated_at=? WHERE id=?", m["session_id"], m["title"], m["description"], m["material_type"], m["url"], m["expires_at"], timestamp(x.Now), integer(old, "id"))
		return M{"material": one(x.Ctx, x.Q, "SELECT * FROM materials WHERE id=?", integer(old, "id"))}
	})
}
