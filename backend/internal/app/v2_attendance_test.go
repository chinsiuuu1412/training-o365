package app

import (
	"context"
	"fmt"
	"testing"
	"time"
)

func TestV2ScheduleApprovalHistoryAndAttendanceBoundaries(t *testing.T) {
	a, admin, mgr, stu, c := fixture(t)
	now := time.Now().UTC()
	setClock(a, now)
	s := schedule(t, admin, mgr, c, 1, now.Add(time.Hour), now.Add(2*time.Hour))
	replenish(a)
	status, m := mgr.call("PUT", classPath("manager", c)+"/total-sessions", M{"total_sessions": 4})
	requireStatus(t, 409, status, m)
	p := draftSchedule(t, mgr, c, s, now.Add(3*time.Hour), now.Add(4*time.Hour))
	status, m = mgr.call("POST", proposalPath("manager", c, s, p)+"/submit", M{})
	requireStatus(t, 200, status, m)
	status, m = mgr.call("PUT", fmt.Sprintf("%s/sessions/%.0f/schedule-draft", classPath("manager", c), num(s, "id")), M{"starts_at": timestamp(now.Add(5 * time.Hour)), "ends_at": timestamp(now.Add(6 * time.Hour))})
	requireStatus(t, 409, status, m)
	status, m = stu.call("GET", fmt.Sprintf("%s/sessions/%.0f", classPath("student", c), num(s, "id")), nil)
	requireStatus(t, 200, status, m)
	if str(result(m)["session"].(map[string]any), "starts_at") != timestamp(now.Add(time.Hour)) {
		t.Fatal("pending proposal replaced schedule")
	}
	if _, ok := result(m)["session"].(map[string]any)["attendance_code"]; ok {
		t.Fatal("student sees attendance code")
	}
	status, m = admin.call("POST", proposalPath("admin", c, s, p)+"/review", M{"decision": "reject"})
	requireStatus(t, 400, status, m)
	status, m = admin.call("POST", proposalPath("admin", c, s, p)+"/review", M{"decision": "reject", "reason": "Đổi ngày khác"})
	requireStatus(t, 200, status, m)
	if str(result(m)["session"].(map[string]any), "starts_at") != timestamp(now.Add(time.Hour)) {
		t.Fatal("reject replaced schedule")
	}
	e := enrollment(t, stu, c)
	attendance := fmt.Sprintf("%s/sessions/%.0f/attend", classPath("student", c), num(s, "id"))
	body := M{"enrollment_id": e["id"], "code": "123456"}
	override := fmt.Sprintf("%s/sessions/%.0f/attendance/%d/override", classPath("manager", c), num(s, "id"), id(e, "id"))
	setClock(a, now.Add(time.Hour-time.Nanosecond))
	status, m = stu.call("POST", attendance, body)
	requireStatus(t, 409, status, m)
	status, m = mgr.call("POST", override, M{"attended": true, "reason": "Xác minh"})
	requireStatus(t, 409, status, m)
	setClock(a, now.Add(time.Hour))
	replenish(a)
	status, m = stu.call("POST", attendance, body)
	requireStatus(t, 200, status, m)
	status, m = stu.call("POST", attendance, body)
	requireStatus(t, 200, status, m)
	status, m = stu.call("POST", fmt.Sprintf("%s/sessions/%.0f/absence", classPath("student", c), num(s, "id")), M{"enrollment_id": e["id"], "reason": "Bận"})
	requireStatus(t, 409, status, m)
	status, m = mgr.call("PUT", fmt.Sprintf("%s/sessions/%.0f/schedule-draft", classPath("manager", c), num(s, "id")), M{"starts_at": timestamp(now.Add(5 * time.Hour)), "ends_at": timestamp(now.Add(6 * time.Hour))})
	requireStatus(t, 409, status, m)
	setClock(a, now.Add(2*time.Hour))
	status, m = stu.call("POST", attendance, body)
	requireStatus(t, 409, status, m)
	status, m = mgr.call("POST", override, M{"attended": false, "reason": "Xác minh không có mặt"})
	requireStatus(t, 200, status, m)
	if count(context.Background(), a.DB.Reader, "SELECT count(*) FROM attendance WHERE enrollment_id=? AND session_id=?", id(e, "id"), id(s, "id")) != 1 {
		t.Fatal("duplicate attendance credit")
	}
}
func TestV2WrongThreeDurableOverrideAndAbsence(t *testing.T) {
	a, admin, mgr, stu, c := fixture(t)
	now := time.Now().UTC()
	setClock(a, now)
	s := schedule(t, admin, mgr, c, 1, now.Add(time.Hour), now.Add(2*time.Hour))
	e := enrollment(t, stu, c)
	base := fmt.Sprintf("%s/sessions/%.0f", classPath("student", c), num(s, "id"))
	override := fmt.Sprintf("%s/sessions/%.0f/attendance/%d/override", classPath("manager", c), num(s, "id"), id(e, "id"))
	status, m := stu.call("POST", base+"/absence", M{"enrollment_id": e["id"], "reason": "Khám bệnh"})
	requireStatus(t, 201, status, m)
	if count(context.Background(), a.DB.Reader, "SELECT count(*) FROM attendance WHERE attended=1") != 0 {
		t.Fatal("absence granted attendance")
	}
	if count(context.Background(), a.DB.Reader, "SELECT count(*) FROM announcement_recipients r JOIN announcements a ON a.id=r.announcement_id WHERE a.title='Học viên xin nghỉ' AND r.user_id=?", id(c, "manager_id")) != 1 {
		t.Fatal("missing absence notification")
	}
	setClock(a, now.Add(time.Hour))
	replenish(a)
	for i := 1; i <= 3; i++ {
		status, m = stu.call("POST", base+"/attend", M{"enrollment_id": e["id"], "code": "wrong"})
		requireStatus(t, 422, status, m)
		if count(context.Background(), a.DB.Reader, "SELECT wrong_count FROM attendance WHERE enrollment_id=? AND session_id=?", id(e, "id"), id(s, "id")) != int64(i) {
			t.Fatal("failed response rolled back wrong attempt")
		}
	}
	status, m = stu.call("POST", base+"/attend", M{"enrollment_id": e["id"], "code": "123456"})
	requireStatus(t, 409, status, m)
	status, m = admin.call("POST", fmt.Sprintf("%s/sessions/%.0f/attendance/%d/override", classPath("admin", c), num(s, "id"), id(e, "id")), M{"attended": true, "reason": "X"})
	requireStatus(t, 404, status, m)
	status, m = mgr.call("POST", override, M{"attended": true, "reason": "Đã xác minh"})
	requireStatus(t, 200, status, m)
	status, m = mgr.call("POST", override, M{"attended": false, "reason": "Sửa xác minh"})
	requireStatus(t, 200, status, m)
	status, m = stu.call("POST", base+"/attend", M{"enrollment_id": e["id"], "code": "123456"})
	requireStatus(t, 200, status, m)
	if bval(result(m)["attendance"].(map[string]any), "attended") {
		t.Fatal("code overwrote authoritative denial")
	}
	audits := rows(context.Background(), a.DB.Reader, "SELECT * FROM audit_log WHERE action='attendance_override' ORDER BY id")
	if len(audits) != 2 || str(audits[1], "reason") != "Sửa xác minh" {
		t.Fatal("override audit history missing")
	}
	if !bval(readJSON(str(audits[1], "before_json")).(map[string]any), "attended") {
		t.Fatal("incorrect before state")
	}
	setClock(a, now.Add(2*time.Hour))
	replenish(a)
	status, m = stu.call("POST", base+"/absence", M{"enrollment_id": e["id"], "reason": "Muộn"})
	requireStatus(t, 409, status, m)
}
