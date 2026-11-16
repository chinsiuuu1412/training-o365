package app

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"
	"unicode/utf8"

	"o365-lms/backend/internal/config"
	"o365-lms/backend/internal/db"
)

type M = map[string]any
type apiError struct {
	Status        int
	Code, Message string
	Details       any
}

func fail(status int, code, message string) { panic(apiError{status, code, message, nil}) }
func invalid()                              { fail(400, "invalid_request", "Vui lòng kiểm tra lại thông tin đã nhập.") }
func must(e error) {
	if e != nil {
		panic(e)
	}
}
func text(m M, k string) string {
	v, ok := m[k].(string)
	if !ok {
		invalid()
	}
	return v
}
func str(m M, k string) string {
	v := m[k]
	if v == nil {
		return ""
	}
	return fmt.Sprint(v)
}
func num(m M, k string) float64 {
	switch v := m[k].(type) {
	case json.Number:
		n, e := v.Float64()
		if e != nil {
			invalid()
		}
		return n
	case float64:
		return v
	case int64:
		return float64(v)
	case int:
		return float64(v)
	}
	invalid()
	return 0
}
func integer(m M, k string) int64 {
	n := num(m, k)
	if n != float64(int64(n)) || n < 0 || n > 9007199254740991 {
		invalid()
	}
	return int64(n)
}
func boolean(m M, k string) bool {
	v, ok := m[k].(bool)
	if !ok {
		invalid()
	}
	return v
}
func bval(m M, k string) bool {
	switch v := m[k].(type) {
	case bool:
		return v
	case int64:
		return v != 0
	case int:
		return v != 0
	}
	return false
}
func id(m M, k string) int64 {
	n := integer(m, k)
	if n < 1 {
		invalid()
	}
	return n
}
func name(m M, k string, max int) string {
	s := strings.TrimSpace(text(m, k))
	if s == "" || utf8.RuneCountInString(s) > max {
		invalid()
	}
	return s
}
func limited(m M, k string, max int) string {
	s := text(m, k)
	if utf8.RuneCountInString(s) > max {
		invalid()
	}
	return s
}
func enum(s string, allowed ...string) string {
	for _, v := range allowed {
		if s == v {
			return s
		}
	}
	invalid()
	return ""
}
func timestamp(t time.Time) string { return t.UTC().Format(time.RFC3339Nano) }
func parseTime(s string) time.Time {
	t, e := time.Parse(time.RFC3339Nano, s)
	if e != nil {
		invalid()
	}
	return t
}
func arr(m M, k string) []any {
	a, ok := m[k].([]any)
	if !ok {
		invalid()
	}
	return a
}
func ids(m M, k string) []int64 {
	a := arr(m, k)
	out := []int64{}
	seen := map[int64]bool{}
	for _, v := range a {
		n := id(M{"id": v}, "id")
		if !seen[n] {
			out = append(out, n)
			seen[n] = true
		}
	}
	return out
}
func shape(m M, required, optional string) {
	allowed := map[string]bool{}
	for _, k := range strings.Fields(required) {
		allowed[k] = true
		if _, ok := m[k]; !ok {
			invalid()
		}
	}
	for _, k := range strings.Fields(optional) {
		allowed[k] = true
	}
	for k := range m {
		if !allowed[k] {
			invalid()
		}
	}
}
func decode(r *http.Request) M {
	if ct := r.Header.Get("Content-Type"); ct != "application/json" && !strings.HasPrefix(ct, "application/json;") {
		invalid()
	}
	d := json.NewDecoder(r.Body)
	d.UseNumber()
	var m M
	if e := d.Decode(&m); e != nil {
		var size *http.MaxBytesError
		if errors.As(e, &size) {
			fail(413, "payload_too_large", "Nội dung vượt quá giới hạn cho phép.")
		}
		invalid()
	}
	if m == nil {
		invalid()
	}
	var extra any
	if e := d.Decode(&extra); e != io.EOF {
		var size *http.MaxBytesError
		if errors.As(e, &size) {
			fail(413, "payload_too_large", "Nội dung vượt quá giới hạn cho phép.")
		}
		invalid()
	}
	return m
}
func rows(ctx context.Context, q db.Queryer, s string, args ...any) []M {
	r, e := q.QueryContext(ctx, s, args...)
	must(e)
	defer r.Close()
	cols, e := r.Columns()
	must(e)
	out := []M{}
	for r.Next() {
		values := make([]any, len(cols))
		ptr := make([]any, len(cols))
		for i := range values {
			ptr[i] = &values[i]
		}
		must(r.Scan(ptr...))
		m := M{}
		for i, k := range cols {
			v := values[i]
			if t, ok := v.(time.Time); ok {
				v = timestamp(t)
			}
			if b, ok := v.([]byte); ok {
				v = string(b)
			}
			m[k] = v
		}
		out = append(out, m)
	}
	must(r.Err())
	return out
}
func one(ctx context.Context, q db.Queryer, s string, args ...any) M {
	a := rows(ctx, q, s, args...)
	if len(a) == 0 {
		fail(404, "not_found", "Không tìm thấy dữ liệu.")
	}
	return a[0]
}
func exec(ctx context.Context, q db.Queryer, s string, args ...any) int64 {
	r, e := q.ExecContext(ctx, s, args...)
	must(e)
	n, e := r.LastInsertId()
	must(e)
	return n
}
func count(ctx context.Context, q db.Queryer, s string, args ...any) int64 {
	var n int64
	must(q.QueryRowContext(ctx, s, args...).Scan(&n))
	return n
}
func jsonText(v any) string { b, e := json.Marshal(v); must(e); return string(b) }
func readJSON(s string) any { var v any; must(json.Unmarshal([]byte(s), &v)); return v }
func pick(m M, keys string) M {
	out := M{}
	for _, k := range strings.Fields(keys) {
		out[k] = m[k]
	}
	return out
}
func userDTO(m M) M {
	o := pick(m, "id email full_name role is_active student_id school_or_institute university_class phone_number gender")
	o["is_active"] = bval(m, "is_active")
	return o
}
func queryInt(r *http.Request, key string, def, min, max int) int {
	v := r.URL.Query().Get(key)
	if v == "" {
		return def
	}
	n, e := strconv.Atoi(v)
	if e != nil || n < min || n > max {
		invalid()
	}
	return n
}
func pathID(r *http.Request, k string) int64 {
	v, e := strconv.ParseInt(r.PathValue(k), 10, 64)
	if e != nil || v < 1 || v > 9007199254740991 {
		invalid()
	}
	return v
}
func page(r *http.Request, a []M) M {
	p := queryInt(r, "page", 1, 1, 1000000)
	s := queryInt(r, "page_size", 20, 1, 100)
	start := (p - 1) * s
	if start > len(a) {
		start = len(a)
	}
	end := start + s
	if end > len(a) {
		end = len(a)
	}
	return M{"items": a[start:end], "page": p, "page_size": s, "total": len(a)}
}
func queryBool(r *http.Request, k string) *bool {
	v, ok := r.URL.Query()[k]
	if !ok {
		return nil
	}
	if len(v) != 1 || (v[0] != "true" && v[0] != "false") {
		invalid()
	}
	b := v[0] == "true"
	return &b
}

type route struct {
	Method, Path, Role string
	Created, Write     bool
	Handler            func(*request) any
}
type request struct {
	App           *App
	R             *http.Request
	W             http.ResponseWriter
	Ctx           context.Context
	Q             db.Queryer
	User          M
	Session       string
	Role          string
	Now, Received time.Time
	Body          M
	Credential    M
	PasswordHash  string
}
type bucket struct {
	Tokens float64
	At     time.Time
}
type App struct {
	Config    config.Config
	DB        *db.DB
	Now       func() time.Time
	mux       *http.ServeMux
	Routes    []route
	limitsMu  sync.Mutex
	limits    map[string]bucket
	slots     chan struct{}
	hashSlots chan struct{}
	dummyHash []byte
}

func New(c config.Config, d *db.DB) *App {
	a := &App{Config: c, DB: d, Now: time.Now, mux: http.NewServeMux(), limits: map[string]bucket{}, slots: make(chan struct{}, 200), hashSlots: make(chan struct{}, 2)}
	a.dummyHash = hashPassword("synthetic-dummy-password")
	a.register()
	return a
}
func (a *App) add(method, path, role string, created, write bool, h func(*request) any) {
	rt := route{method, "/api/v1" + path, role, created, write, h}
	a.Routes = append(a.Routes, rt)
	a.mux.HandleFunc(method+" "+rt.Path, func(w http.ResponseWriter, r *http.Request) { a.serve(rt, w, r) })
}
func (a *App) Handler() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		w.Header().Set("Cache-Control", "no-store")
		w.Header().Set("X-Content-Type-Options", "nosniff")
		select {
		case a.slots <- struct{}{}:
			defer func() { <-a.slots }()
		default:
			writeError(w, apiError{503, "temporarily_unavailable", "Hệ thống đang bận. Vui lòng thử lại.", nil})
			return
		}
		_, pattern := a.mux.Handler(r)
		if pattern == "" {
			writeError(w, apiError{404, "not_found", "Không tìm thấy đường dẫn.", nil})
			return
		}
		a.mux.ServeHTTP(w, r)
	})
}
func writeError(w http.ResponseWriter, e apiError) {
	w.WriteHeader(e.Status)
	json.NewEncoder(w).Encode(M{"data": nil, "error": M{"code": e.Code, "message": e.Message, "details": e.Details}})
}
func (a *App) serve(rt route, w http.ResponseWriter, r *http.Request) {
	defer func() {
		if p := recover(); p != nil {
			if e, ok := p.(apiError); ok {
				writeError(w, e)
			} else {
				writeError(w, apiError{500, "internal_error", "Có lỗi hệ thống. Vui lòng thử lại.", nil})
			}
		}
	}()
	ctx, cancel := context.WithTimeout(r.Context(), 12*time.Second)
	defer cancel()
	r.Body = http.MaxBytesReader(w, r.Body, 1<<20)
	req := &request{App: a, R: r, W: w, Ctx: ctx, Role: rt.Role}
	if rt.Method != "GET" {
		if r.Header.Get("Origin") != a.Config.Origin {
			fail(403, "forbidden", "Nguồn yêu cầu không hợp lệ.")
		}
	}
	// Never read client bodies or run password work while holding SQLite's sole writer.
	if rt.Method != "GET" {
		req.Body = decode(r)
	}
	req.Received = a.Now().UTC()
	req.Now = req.Received
	req.Q = a.DB.Reader
	a.authorize(rt, req)
	if rt.Role != "public" && rt.Method != "GET" && !a.allow("write:"+str(req.User, "id"), 1, 10) {
		w.Header().Set("Retry-After", "1")
		fail(429, "rate_limited", "Thao tác quá nhanh. Vui lòng thử lại.")
	}
	a.preparePassword(rt, req)
	var result any
	run := func(q db.Queryer) {
		req.Q = q
		result = rt.Handler(req)
	}
	if rt.Write {
		var domainError *apiError
		must(a.DB.Write(ctx, func(tx *sql.Tx) error {
			req.Q = tx
			req.Now = a.Now().UTC()
			// Recheck revocation, role, class scope and verified credentials after queueing.
			a.authorize(rt, req)
			a.recheckCredential(req)
			// Due results survive a rejected late draft/submit; unrelated mutations roll back.
			if strings.Contains(rt.Path, "/quiz") || strings.HasSuffix(rt.Path, "/dashboard") {
				FinalizeDue(ctx, tx, req.Now, 0)
			}
			exec(ctx, tx, "SAVEPOINT request_action")
			defer func() {
				if p := recover(); p != nil {
					if e, ok := p.(apiError); ok {
						exec(ctx, tx, "ROLLBACK TO request_action")
						domainError = &e
					} else {
						panic(p)
					}
				}
			}()
			run(tx)
			return nil
		}))
		if domainError != nil {
			panic(*domainError)
		}
	} else {
		run(a.DB.Reader)
	}
	if e, ok := result.(apiError); ok {
		panic(e)
	}
	status := 200
	if rt.Created {
		status = 201
	}
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(M{"data": result, "error": nil})
}
func (a *App) authorize(rt route, x *request) {
	if rt.Role != "public" {
		a.authenticate(x)
		if rt.Role != "any" && str(x.User, "role") != rt.Role {
			fail(403, "forbidden", "Bạn không có quyền thực hiện thao tác này.")
		}
		if rt.Method != "GET" && !secureEqual(x.R.Header.Get("X-CSRF-Token"), a.csrf(x.Session)) {
			fail(403, "forbidden", "Mã bảo vệ yêu cầu không hợp lệ.")
		}
	}
	a.scope(x)
}
func (a *App) allow(k string, rate, burst float64) bool {
	a.limitsMu.Lock()
	defer a.limitsMu.Unlock()
	now := a.Now()
	if len(a.limits) > 10000 {
		for key, b := range a.limits {
			if now.Sub(b.At) > 10*time.Minute {
				delete(a.limits, key)
			}
		}
		if len(a.limits) > 10000 {
			return false
		}
	}
	b, ok := a.limits[k]
	if !ok {
		b = bucket{burst, now}
	}
	b.Tokens += now.Sub(b.At).Seconds() * rate
	if b.Tokens > burst {
		b.Tokens = burst
	}
	b.At = now
	allowed := b.Tokens >= 1
	if allowed {
		b.Tokens--
	}
	a.limits[k] = b
	return allowed
}
func (a *App) scope(x *request) {
	if x.R.PathValue("classId") == "" {
		return
	}
	c := x.getClass()
	role := str(x.User, "role")
	if role == "class_manager" && integer(c, "manager_id") != integer(x.User, "id") {
		fail(404, "not_found", "Không tìm thấy lớp học.")
	}
	// Preview and enrollment requests never expose class content.
	preview := role == "student" && (strings.HasSuffix(x.R.URL.Path, "/preview") || strings.Contains(x.R.URL.Path, "/enrollment-requests"))
	if role == "student" && !preview {
		x.currentEnrollment()
	}
	if archived(c, x.Now) && (x.R.Method != "GET" || role == "student") {
		fail(403, "class_expired", "Lớp học đã hết hạn.")
	}
}
func archived(c M, now time.Time) bool { return !now.Before(parseTime(str(c, "expires_at"))) }
func (x *request) getClass() M {
	return one(x.Ctx, x.Q, "SELECT * FROM classes WHERE id=?", pathID(x.R, "classId"))
}
func (x *request) currentEnrollment() M {
	return one(x.Ctx, x.Q, "SELECT * FROM class_enrollments WHERE class_id=? AND student_id=? AND status='enrolled'", pathID(x.R, "classId"), integer(x.User, "id"))
}
func (x *request) cycle(m M) M {
	e := x.currentEnrollment()
	if id(m, "enrollment_id") != integer(e, "id") {
		fail(409, "stale_enrollment", "Lần ghi danh đã thay đổi.")
	}
	return e
}
func (x *request) audit(action string, target int64, before, after any, reason string) {
	var cid any
	if x.R.PathValue("classId") != "" {
		cid = pathID(x.R, "classId")
	}
	exec(x.Ctx, x.Q, "INSERT INTO audit_log(actor_id,class_id,action,target_id,before_json,after_json,reason,created_at) VALUES(?,?,?,?,?,?,?,?)", integer(x.User, "id"), cid, action, target, jsonText(before), jsonText(after), reason, timestamp(x.Now))
}
