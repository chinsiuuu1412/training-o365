package app

import (
	"context"
	"fmt"
	"sync"
	"testing"
	"time"
)

func TestV2RolesProfilesAndRevocation(t *testing.T) {
	a, admin, mgr, stu, c := fixture(t)
	replenish(a)
	s, m := admin.call("POST", "/admin/users", M{"email": "extra@example.test", "full_name": "Admin", "role": "admin", "password": "test-password-123"})
	requireStatus(t, 400, s, m)
	for _, path := range []string{"/admin/users/1", "/admin/users/1/status", "/admin/users/1/reset-password"} {
		method, body := "PUT", M{"email": "admin@example.test", "full_name": "X"}
		if path == "/admin/users/1/status" {
			method = "PATCH"
			body = M{"is_active": false, "reason": "X"}
		}
		if path == "/admin/users/1/reset-password" {
			method = "POST"
			body = M{"new_password": "test-password-456"}
		}
		s, m = admin.call(method, path, body)
		requireStatus(t, 403, s, m)
	}
	uid := userID(t, stu)
	s, m = admin.call("PUT", fmt.Sprintf("/admin/users/%d", uid), M{"email": "student@sis.hust.edu.vn", "full_name": "Student", "role": "class_manager"})
	requireStatus(t, 400, s, m)
	p := M{"email": "zeros@sis.hust.edu.vn", "full_name": "Student 0", "role": "student", "password": "test-password-123", "student_id": "000012345", "school_or_institute": "SOICT", "university_class": "K71", "phone_number": "+84912345678", "gender": "other"}
	s, m = admin.call("POST", "/admin/users", p)
	requireStatus(t, 201, s, m)
	if str(result(m)["user"].(map[string]any), "student_id") != "000012345" {
		t.Fatal("lost leading zeros")
	}
	p["email"] = "duplicate@sis.hust.edu.vn"
	s, m = admin.call("POST", "/admin/users", p)
	requireStatus(t, 409, s, m)
	for _, bad := range []string{"20251234", "2025123456"} {
		p["student_id"] = bad
		s, m = admin.call("POST", "/admin/users", p)
		requireStatus(t, 400, s, m)
	}
	replenish(a)
	mid := id(c, "manager_id")
	s, m = admin.call("PATCH", fmt.Sprintf("/admin/users/%d/status", mid), M{"is_active": false})
	requireStatus(t, 400, s, m)
	s, m = admin.call("PATCH", fmt.Sprintf("/admin/users/%d/status", mid), M{"is_active": false, "reason": "Tạm nghỉ"})
	requireStatus(t, 200, s, m)
	s, m = mgr.call("GET", "/auth/me", nil)
	requireStatus(t, 401, s, m)
	if count(context.Background(), a.DB.Reader, "SELECT count(*) FROM classes WHERE manager_id=?", mid) != 1 {
		t.Fatal("suspension changed assignments")
	}
	s, m = admin.call("PATCH", fmt.Sprintf("/admin/users/%d/status", mid), M{"is_active": true, "reason": "Trở lại"})
	requireStatus(t, 200, s, m)
	s, m = mgr.call("GET", "/auth/me", nil)
	requireStatus(t, 401, s, m)
	s, m = stu.call("POST", "/auth/change-password", M{"current_password": "test-password-123", "new_password": "different-password-123"})
	requireStatus(t, 200, s, m)
	s, m = stu.call("GET", "/auth/me", nil)
	requireStatus(t, 401, s, m)
}
func TestV2RequestCancelDeclineLifetimeAndCapacity(t *testing.T) {
	a, admin := setup(t)
	manager := createUser(t, admin, "manager@example.test", "class_manager")
	createUser(t, admin, "s@sis.hust.edu.vn", "student")
	c := createClass(t, admin, manager)
	mgr := loginClient(t, a, "manager@example.test", "test-password-123")
	stu := loginClient(t, a, "s@sis.hust.edu.vn", "test-password-123")
	now := time.Now().UTC()
	setClock(a, now)
	studentBase, managerBase := classPath("student", c), classPath("manager", c)
	request := func(reason string) M {
		t.Helper()
		replenish(a)
		s, m := stu.call("POST", studentBase+"/enrollment-requests", M{"reason": reason})
		requireStatus(t, 201, s, m)
		return result(m)["request"].(map[string]any)
	}
	r := request("Học")
	s, m := stu.call("POST", fmt.Sprintf("%s/enrollment-requests/%.0f/cancel", studentBase, num(r, "id")), M{})
	requireStatus(t, 200, s, m)
	for i := 0; i < 3; i++ {
		r = request(fmt.Sprintf("Lý do %d", i))
		s, m = mgr.call("POST", fmt.Sprintf("%s/enrollment-requests/%.0f/review", managerBase, num(r, "id")), M{"decision": "decline"})
		requireStatus(t, 400, s, m)
		s, m = mgr.call("POST", fmt.Sprintf("%s/enrollment-requests/%.0f/review", managerBase, num(r, "id")), M{"decision": "decline", "reason": "Chưa phù hợp"})
		requireStatus(t, 200, s, m)
		s, m = stu.call("POST", studentBase+"/enrollment-requests", M{"reason": "Mới"})
		requireStatus(t, 409, s, m)
		now = now.Add(10*time.Minute - time.Nanosecond)
		setClock(a, now)
		replenish(a)
		s, m = stu.call("POST", studentBase+"/enrollment-requests", M{"reason": "Mới"})
		requireStatus(t, 409, s, m)
		now = now.Add(time.Nanosecond)
		setClock(a, now)
		if i < 2 {
			s, m = stu.call("POST", studentBase+"/enrollment-requests", M{"reason": fmt.Sprintf("Lý do %d", i)})
			requireStatus(t, 422, s, m)
			cancelled := request("Lý do hủy")
			s, m = stu.call("POST", fmt.Sprintf("%s/enrollment-requests/%.0f/cancel", studentBase, num(cancelled, "id")), M{})
			requireStatus(t, 200, s, m)
		}
	}
	s, m = stu.call("POST", studentBase+"/enrollment-requests", M{"reason": "Lần bốn"})
	requireStatus(t, 409, s, m)
	if count(context.Background(), a.DB.Reader, "SELECT count(*) FROM enrollment_requests WHERE status='declined'") != 3 {
		t.Fatal("decline count reset")
	}
}
func TestV2ConcurrentCapacityAndCurrentManager(t *testing.T) {
	a, admin := setup(t)
	manager := createUser(t, admin, "manager@example.test", "class_manager")
	other := createUser(t, admin, "other@example.test", "class_manager")
	createUser(t, admin, "a@sis.hust.edu.vn", "student")
	createUser(t, admin, "b@sis.hust.edu.vn", "student")
	c := createClass(t, admin, manager)
	mgr := loginClient(t, a, "manager@example.test", "test-password-123")
	newmgr := loginClient(t, a, "other@example.test", "test-password-123")
	replenish(a)
	body := pick(c, "code name description manager_id capacity end_date min_attendance_percent min_quiz_percent")
	body["capacity"] = 1
	s, m := admin.call("PUT", classPath("admin", c), body)
	requireStatus(t, 200, s, m)
	students := []*client{loginClient(t, a, "a@sis.hust.edu.vn", "test-password-123"), loginClient(t, a, "b@sis.hust.edu.vn", "test-password-123")}
	requests := []M{}
	for _, stu := range students {
		s, m = stu.call("POST", classPath("student", c)+"/enrollment-requests", M{"reason": "Học"})
		requireStatus(t, 201, s, m)
		requests = append(requests, result(m)["request"].(map[string]any))
	}
	body["manager_id"] = other["id"]
	s, m = admin.call("PUT", classPath("admin", c), body)
	requireStatus(t, 400, s, m)
	body["reassignment_reason"] = "Đổi phụ trách"
	body["confirm_reassignment"] = true
	s, m = admin.call("PUT", classPath("admin", c), body)
	requireStatus(t, 200, s, m)

	s, m = mgr.call("POST", fmt.Sprintf("%s/enrollment-requests/%.0f/review", classPath("manager", c), num(requests[0], "id")), M{"decision": "approve"})
	requireStatus(t, 404, s, m)
	statuses := make(chan int, 2)
	var wg sync.WaitGroup
	for _, r := range requests {
		wg.Add(1)
		go func(r M) {
			defer wg.Done()
			s, _ := clone(newmgr).call("POST", fmt.Sprintf("%s/enrollment-requests/%.0f/review", classPath("manager", c), num(r, "id")), M{"decision": "approve"})
			statuses <- s
		}(r)
	}
	wg.Wait()
	close(statuses)
	ok, full := 0, 0
	for s := range statuses {
		if s == 200 {
			ok++
		}
		if s == 409 {
			full++
		}
	}
	if ok != 1 || full != 1 {
		t.Fatalf("capacity statuses success=%d conflict=%d", ok, full)
	}
	if count(context.Background(), a.DB.Reader, "SELECT count(*) FROM class_enrollments WHERE status='enrolled'") != 1 {
		t.Fatal("capacity oversubscribed")
	}
	body["capacity"] = 0
	replenish(a)
	s, m = admin.call("PUT", classPath("admin", c), body)
	requireStatus(t, 400, s, m)
	pending := one(context.Background(), a.DB.Reader, "SELECT * FROM enrollment_requests WHERE status='pending'")
	status, payload := students[0].call("POST", classPath("student", c)+"/enrollment-requests", M{"reason": "Lớp đầy"})
	if status != 409 {
		t.Fatalf("full class request accepted: %d %v", status, payload)
	}
	enrolled := one(context.Background(), a.DB.Reader, "SELECT * FROM class_enrollments WHERE status='enrolled'")
	status, payload = newmgr.call("POST", fmt.Sprintf("%s/enrollments/%d/remove", classPath("manager", c), id(enrolled, "id")), M{"reason": "Đổi khóa"})
	requireStatus(t, 200, status, payload)
	oldRequest := one(context.Background(), a.DB.Reader, "SELECT * FROM enrollment_requests WHERE id=?", id(enrolled, "request_id"))
	status, payload = newmgr.call("POST", fmt.Sprintf("%s/enrollment-requests/%d/review", classPath("manager", c), id(oldRequest, "id")), M{"decision": "approve"})
	requireStatus(t, 409, status, payload)
	_ = pending
	if count(context.Background(), a.DB.Reader, "SELECT count(*) FROM audit_log WHERE action='manager_reassignment'") != 1 {
		t.Fatal("missing reassignment audit")
	}
}
