package app

import (
	"context"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"database/sql"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"golang.org/x/crypto/bcrypt"
	"net/http"
	"net/mail"
	"o365-lms/backend/internal/config"
	"o365-lms/backend/internal/db"
	"strings"
	"time"
)

func hashPassword(p string) []byte {
	h, e := bcrypt.GenerateFromPassword([]byte(p), 10)
	must(e)
	return h
}
func password(p string) {
	if len(p) < 12 || len(p) > 72 {
		invalid()
	}
}
func validEmail(email, role string) string {
	email = strings.ToLower(strings.TrimSpace(email))
	a, e := mail.ParseAddress(email)
	if e != nil || a.Address != email || len(email) > 254 {
		invalid()
	}
	if role == "student" && !strings.HasSuffix(email, "@sis.hust.edu.vn") {
		fail(422, "email_domain_required", "Email học viên phải thuộc miền @sis.hust.edu.vn.")
	}
	return email
}
func randomID() string {
	b := make([]byte, 24)
	_, e := rand.Read(b)
	must(e)
	return hex.EncodeToString(b)
}
func secureEqual(a, b string) bool { return subtle.ConstantTimeCompare([]byte(a), []byte(b)) == 1 }
func (a *App) sign(s string) string {
	h := hmac.New(sha256.New, []byte(a.Config.JWTSecret))
	h.Write([]byte(s))
	return base64.RawURLEncoding.EncodeToString(h.Sum(nil))
}
func (a *App) csrf(session string) string { return a.sign("csrf:" + session) }

type claims struct {
	Sub     int64  `json:"sub"`
	JTI     string `json:"jti"`
	Version int64  `json:"ver"`
	Exp     int64  `json:"exp"`
	Iat     int64  `json:"iat"`
}

func (a *App) jwt(c claims) string {
	header := base64.RawURLEncoding.EncodeToString([]byte(`{"alg":"HS256","typ":"JWT"}`))
	payload := base64.RawURLEncoding.EncodeToString([]byte(jsonText(c)))
	s := header + "." + payload
	return s + "." + a.sign(s)
}
func (a *App) authenticate(x *request) {
	cookie, e := x.R.Cookie("lms_session")
	if e != nil {
		fail(401, "unauthenticated", "Vui lòng đăng nhập.")
	}
	parts := strings.Split(cookie.Value, ".")
	if len(parts) != 3 || !secureEqual(a.sign(parts[0]+"."+parts[1]), parts[2]) {
		fail(401, "unauthenticated", "Phiên đăng nhập không hợp lệ.")
	}
	h, e := base64.RawURLEncoding.DecodeString(parts[0])
	if e != nil || string(h) != `{"alg":"HS256","typ":"JWT"}` {
		fail(401, "unauthenticated", "Phiên đăng nhập không hợp lệ.")
	}
	p, e := base64.RawURLEncoding.DecodeString(parts[1])
	var c claims
	if e != nil || json.Unmarshal(p, &c) != nil || c.Exp <= x.Now.Unix() || c.Sub < 1 || c.JTI == "" {
		fail(401, "unauthenticated", "Phiên đăng nhập đã hết hạn.")
	}
	users := rows(x.Ctx, x.Q, `SELECT u.* FROM users u JOIN user_sessions s ON s.user_id=u.id WHERE u.id=? AND u.is_active=1 AND u.token_version=? AND s.id=? AND s.token_version=u.token_version AND s.revoked_at IS NULL`, c.Sub, c.Version, c.JTI)
	if len(users) != 1 {
		fail(401, "unauthenticated", "Phiên đăng nhập đã bị thu hồi.")
	}
	session := one(x.Ctx, x.Q, "SELECT expires_at FROM user_sessions WHERE id=?", c.JTI)
	if !x.Now.Before(parseTime(str(session, "expires_at"))) {
		fail(401, "unauthenticated", "Phiên đăng nhập đã hết hạn.")
	}
	x.User = users[0]
	x.Session = c.JTI
}
func cookie(w http.ResponseWriter, token string, expiry time.Time, maxAge int) {
	http.SetCookie(w, &http.Cookie{Name: "lms_session", Value: token, Path: "/", HttpOnly: true, Secure: true, SameSite: http.SameSiteLaxMode, Expires: expiry, MaxAge: maxAge})
}
func (x *request) body(required, optional string) M {
	shape(x.Body, required, optional)
	return x.Body
}
func (x *request) revoke(uid int64) {
	exec(x.Ctx, x.Q, "UPDATE users SET token_version=token_version+1,updated_at=? WHERE id=?", timestamp(x.Now), uid)
	exec(x.Ctx, x.Q, "UPDATE user_sessions SET revoked_at=? WHERE user_id=? AND revoked_at IS NULL", timestamp(x.Now), uid)
}

// Password preflight uses readers only; transaction rechecks verified account state.
func (a *App) preparePassword(rt route, x *request) {
	switch {
	case rt.Path == "/api/v1/auth/login":
		if !a.allow("login:"+a.clientIP(x.R), 5.0/60, 5) {
			x.W.Header().Set("Retry-After", "12")
			fail(429, "rate_limited", "Đăng nhập quá nhiều lần. Vui lòng thử lại.")
		}
		m := x.body("email password", "")
		email := strings.ToLower(strings.TrimSpace(text(m, "email")))
		p := text(m, "password")
		if len(p) > 72 || len(email) > 254 {
			fail(401, "unauthenticated", "Email hoặc mật khẩu không đúng.")
		}
		users := rows(x.Ctx, x.Q, "SELECT * FROM users WHERE email=?", email)
		h := a.dummyHash
		if len(users) == 1 {
			h = []byte(str(users[0], "password_hash"))
		}
		a.passwordWork(func() {
			if bcrypt.CompareHashAndPassword(h, []byte(p)) != nil || len(users) != 1 || !bval(users[0], "is_active") {
				fail(401, "unauthenticated", "Email hoặc mật khẩu không đúng.")
			}
		})
		x.Credential = users[0]
	case rt.Path == "/api/v1/auth/change-password":
		m := x.body("current_password new_password", "")
		password(text(m, "new_password"))
		x.Credential = x.User
		a.passwordWork(func() {
			if bcrypt.CompareHashAndPassword([]byte(str(x.User, "password_hash")), []byte(text(m, "current_password"))) != nil {
				fail(422, "invalid_current_password", "Mật khẩu hiện tại không đúng.")
			}
			x.PasswordHash = string(hashPassword(text(m, "new_password")))
		})
	case rt.Path == "/api/v1/admin/users" && rt.Method == "POST":
		m := x.body("email full_name role password", profileFields)
		role := enum(text(m, "role"), "class_manager", "student")
		validEmail(text(m, "email"), role)
		profile(m, role)
		name(m, "full_name", 200)
		password(text(m, "password"))
		a.passwordWork(func() { x.PasswordHash = string(hashPassword(text(m, "password"))) })
	case rt.Path == "/api/v1/admin/users/{id}/reset-password":
		m := x.body("new_password", "")
		password(text(m, "new_password"))
		a.passwordWork(func() { x.PasswordHash = string(hashPassword(text(m, "new_password"))) })
	}
}
func (a *App) passwordWork(fn func()) {
	select {
	case a.hashSlots <- struct{}{}:
	default:
		fail(503, "temporarily_unavailable", "Hệ thống đang bận. Vui lòng thử lại.")
	}
	defer func() { <-a.hashSlots }()
	fn()
}
func (a *App) recheckCredential(x *request) {
	if x.Credential == nil {
		return
	}
	users := rows(x.Ctx, x.Q, "SELECT * FROM users WHERE id=?", integer(x.Credential, "id"))
	if len(users) != 1 {
		fail(401, "unauthenticated", "Thông tin đăng nhập đã thay đổi. Vui lòng đăng nhập lại.")
	}
	u := users[0]
	for _, k := range []string{"password_hash", "token_version", "is_active", "role", "email"} {
		if str(u, k) != str(x.Credential, k) {
			fail(401, "unauthenticated", "Thông tin đăng nhập đã thay đổi. Vui lòng đăng nhập lại.")
		}
	}
	if !bval(u, "is_active") {
		fail(401, "unauthenticated", "Thông tin đăng nhập đã thay đổi. Vui lòng đăng nhập lại.")
	}
	x.User = u
}
func (a *App) login(x *request) any {
	jti := randomID()
	expiry := x.Now.Add(a.Config.SessionTTL)
	exec(x.Ctx, x.Q, "INSERT INTO user_sessions(id,user_id,token_version,expires_at,created_at) VALUES(?,?,?,?,?)", jti, integer(x.User, "id"), integer(x.User, "token_version"), timestamp(expiry), timestamp(x.Now))
	token := a.jwt(claims{integer(x.User, "id"), jti, integer(x.User, "token_version"), expiry.Unix(), x.Now.Unix()})
	cookie(x.W, token, expiry, int(a.Config.SessionTTL.Seconds()))
	return M{"user": userDTO(x.User), "csrf_token": a.csrf(jti)}
}
func (a *App) authRoutes() {
	a.add("POST", "/auth/login", "public", false, true, a.login)
	a.add("GET", "/auth/me", "any", false, false, func(x *request) any { return M{"user": userDTO(x.User), "csrf_token": a.csrf(x.Session)} })
	a.add("POST", "/auth/logout", "any", false, true, func(x *request) any {
		x.body("", "")
		exec(x.Ctx, x.Q, "UPDATE user_sessions SET revoked_at=? WHERE id=?", timestamp(x.Now), x.Session)
		cookie(x.W, "", time.Unix(1, 0), -1)
		return M{}
	})
	a.add("POST", "/auth/change-password", "any", false, true, func(x *request) any {
		exec(x.Ctx, x.Q, "UPDATE users SET password_hash=? WHERE id=?", x.PasswordHash, integer(x.User, "id"))
		x.revoke(integer(x.User, "id"))
		cookie(x.W, "", time.Unix(1, 0), -1)
		return M{}
	})
}

func Bootstrap(ctx context.Context, d *db.DB, c config.Config) error {
	return d.Write(ctx, func(tx *sql.Tx) error {
		var n int
		if e := tx.QueryRowContext(ctx, "SELECT count(*) FROM users").Scan(&n); e != nil {
			return e
		}
		if n > 0 {
			return nil
		}
		if c.AdminEmail == "" || c.AdminPassword == "" {
			return errors.New("DB rỗng: cần ADMIN_INITIAL_EMAIL và ADMIN_INITIAL_PASSWORD")
		}
		if len(c.AdminPassword) < 12 || len(c.AdminPassword) > 72 {
			return errors.New("mật khẩu bootstrap không hợp lệ")
		}
		a, e := mail.ParseAddress(c.AdminEmail)
		if e != nil || a.Address != c.AdminEmail {
			return errors.New("email bootstrap không hợp lệ")
		}
		_, e = tx.ExecContext(ctx, "INSERT INTO users(email,password_hash,full_name,role,created_at,updated_at) VALUES(?,?,?,'admin',?,?)", strings.ToLower(c.AdminEmail), string(hashPassword(c.AdminPassword)), "Quản trị viên", timestamp(time.Now()), timestamp(time.Now()))
		return e
	})
}
