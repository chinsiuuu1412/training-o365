package app

import (
	"context"
	"fmt"
	"testing"
	"time"
)

func TestV2ProgressZeroDenominatorsAllEndedAndDynamicThresholds(t *testing.T) {
	a, admin, mgr, stu, c := fixture(t)
	now := time.Now().UTC()
	setClock(a, now)
	progress := func() M {
		t.Helper()
		s, m := stu.call("GET", classPath("student", c)+"/progress", nil)
		requireStatus(t, 200, s, m)
		return result(m)["progress"].(map[string]any)
	}
	p := progress()
	if num(p, "attendance_percent") != 0 || num(p, "quiz_percent") != 0 || bval(p, "completed") {
		t.Fatal("zero denominator completion")
	}
	sessions := []M{}
	for i := 1; i <= 3; i++ {
		sessions = append(sessions, schedule(t, admin, mgr, c, i, now.Add(time.Duration(i)*time.Hour), now.Add(time.Duration(i)*time.Hour+30*time.Minute)))
	}
	q, answers := newQuiz(t, mgr, c, "assignment", 60)
	at := start(t, stu, c, q, 1)
	save(t, stu, c, at, 0, answers)
	s, m := stu.callHeaders("POST", attemptPath(c, at)+"/submit", M{"enrollment_id": at["enrollment_id"], "expected_revision": 1}, key(2))
	requireStatus(t, 200, s, m)
	setClock(a, now.Add(3*time.Hour))
	replenish(a)
	e := enrollment(t, stu, c)
	for _, session := range sessions {
		s, m = mgr.call("POST", fmt.Sprintf("%s/sessions/%.0f/attendance/%d/override", classPath("manager", c), num(session, "id"), id(e, "id")), M{"attended": true, "reason": "Đã xác minh"})
		requireStatus(t, 200, s, m)
	}
	p = progress()
	if num(p, "attendance_percent") != 100 || num(p, "quiz_percent") != 100 || bval(p, "completed") {
		t.Fatal("completed before final session ended")
	}
	setClock(a, now.Add(3*time.Hour+30*time.Minute-time.Nanosecond))
	if bval(progress(), "completed") {
		t.Fatal("ended one nanosecond early")
	}
	setClock(a, now.Add(3*time.Hour+30*time.Minute))
	if !bval(progress(), "completed") {
		t.Fatal("not completed at final end")
	}
	replenish(a)
	s, m = mgr.call("POST", fmt.Sprintf("%s/sessions/%.0f/attendance/%d/override", classPath("manager", c), num(sessions[0], "id"), id(e, "id")), M{"attended": false, "reason": "Không có mặt"})
	requireStatus(t, 200, s, m)
	p = progress()
	if bval(p, "completed") {
		t.Fatal("completion not recalculated")
	}
	body := pick(c, "code name description manager_id capacity end_date min_attendance_percent min_quiz_percent")
	body["min_attendance_percent"] = 66.66666666666667
	s, m = admin.call("PUT", classPath("admin", c), body)
	requireStatus(t, 200, s, m)
	if bval(progress(), "completed") {
		t.Fatal("rounded attendance incorrectly passed threshold")
	}
	body["min_attendance_percent"] = 66
	s, m = admin.call("PUT", classPath("admin", c), body)
	requireStatus(t, 200, s, m)
	if !bval(progress(), "completed") {
		t.Fatal("updated thresholds not applied")
	}
	// Published quizzes alone enter denominator; another attempt never adds another quiz credit.
	replenish(a)
	q2, _ := newQuiz(t, mgr, c, "test", 60)
	_ = q2
	p = progress()
	if num(p, "published_quiz_count") != 2 || num(p, "passed_quiz_count") != 1 || num(p, "quiz_percent") != 50 || bval(p, "completed") {
		t.Fatal("quiz formula not passed/published")
	}
	s, m = admin.call("GET", classPath("admin", c)+"/progress", nil)
	requireStatus(t, 200, s, m)
	staff := result(m)["items"].([]any)[0].(map[string]any)["progress"].(map[string]any)
	if jsonText(staff) != jsonText(progress()) {
		t.Fatal("staff/student progress diverged")
	}
}
func TestV2LibraryExpiryClassHistoryAndNotifications(t *testing.T) {
	a, admin, mgr, stu, c := fixture(t)
	now := time.Now().UTC()
	setClock(a, now)
	s := schedule(t, admin, mgr, c, 1, now.Add(time.Hour), now.Add(2*time.Hour))
	replenish(a)
	base := classPath("manager", c) + "/materials"
	create := func(kind, link string) M {
		t.Helper()
		status, m := mgr.call("POST", base, M{"title": "Tài liệu", "description": "MOS", "material_type": kind, "url": link, "session_id": s["id"], "expires_at": timestamp(now.Add(time.Minute))})
		requireStatus(t, 201, status, m)
		return result(m)["material"].(map[string]any)
	}
	doc := create("document", "https://example.test/document")
	video := create("video", "https://www.youtube.com/watch?v=abcdefghijk")
	other := create("video", "https://example.test/video")
	status, m := mgr.call("POST", base, M{"title": "Sai", "description": "", "material_type": "document", "url": "http://example.test/a"})
	requireStatus(t, 400, status, m)
	status, m = mgr.call("POST", base, M{"title": "Sai", "description": "", "material_type": "document", "url": "https://example.test/a", "session_id": 99999})
	requireStatus(t, 400, status, m)
	status, m = admin.call("POST", classPath("admin", c)+"/materials", M{})
	requireStatus(t, 404, status, m)
	setClock(a, now.Add(time.Minute-time.Nanosecond))
	status, m = stu.call("GET", fmt.Sprintf("%s/materials/%d", classPath("student", c), id(doc, "id")), nil)
	requireStatus(t, 200, status, m)
	setClock(a, now.Add(time.Minute))
	status, m = stu.call("GET", fmt.Sprintf("%s/materials/%d", classPath("student", c), id(doc, "id")), nil)
	requireStatus(t, 403, status, m)
	status, m = stu.call("GET", fmt.Sprintf("%s/materials/%d", classPath("student", c), id(video, "id")), nil)
	requireStatus(t, 200, status, m)
	status, m = stu.call("GET", fmt.Sprintf("%s/materials/%d", classPath("student", c), id(other, "id")), nil)
	requireStatus(t, 403, status, m)
	status, m = admin.call("DELETE", fmt.Sprintf("%s/materials/%d", classPath("admin", c), id(other, "id")), M{})
	requireStatus(t, 400, status, m)
	status, m = admin.call("DELETE", fmt.Sprintf("%s/materials/%d", classPath("admin", c), id(other, "id")), M{"reason": "Không phù hợp"})
	requireStatus(t, 200, status, m)
	if count(context.Background(), a.DB.Reader, "SELECT count(*) FROM announcements a JOIN announcement_recipients r ON r.announcement_id=a.id WHERE a.title='Admin gỡ tài liệu' AND r.user_id=?", id(c, "manager_id")) != 1 {
		t.Fatal("missing removal notification")
	}
	expires := parseTime(str(c, "expires_at"))
	if expires.In(vietnam).Format("15:04:05") != "00:00:00" {
		t.Fatal("class date not Vietnam end-of-day")
	}
	setClock(a, expires.Add(-time.Nanosecond))
	status, m = stu.call("GET", fmt.Sprintf("%s/materials/%d", classPath("student", c), id(video, "id")), nil)
	// Test sessions expire before class date; renew only session, never academic state.
	if status == 401 {
		replenish(a)
		stu = loginClient(t, a, "student@sis.hust.edu.vn", "test-password-123")
		mgr = loginClient(t, a, "manager@example.test", "test-password-123")
		admin = loginClient(t, a, "admin@example.test", "test-password-123")
		status, m = stu.call("GET", fmt.Sprintf("%s/materials/%d", classPath("student", c), id(video, "id")), nil)
	}
	requireStatus(t, 200, status, m)
	setClock(a, expires)
	status, m = stu.call("GET", fmt.Sprintf("%s/materials/%d", classPath("student", c), id(video, "id")), nil)
	requireStatus(t, 403, status, m)
	status, m = mgr.call("GET", base, nil)
	requireStatus(t, 200, status, m)
	status, m = admin.call("GET", classPath("admin", c)+"/enrollments", nil)
	requireStatus(t, 200, status, m)
	status, m = stu.call("GET", "/student/enrollment-history", nil)
	requireStatus(t, 200, status, m)
	if num(result(m), "total") != 1 {
		t.Fatal("expired summary lost")
	}
	status, m = stu.call("GET", "/student/discover/classes", nil)
	requireStatus(t, 200, status, m)
	if num(result(m), "total") != 0 {
		t.Fatal("expired class discoverable")
	}
	status, m = mgr.call("POST", base, M{"title": "X", "description": "", "material_type": "video", "url": "https://youtu.be/abcdefghijk"})
	requireStatus(t, 403, status, m)
	if count(context.Background(), a.DB.Reader, "SELECT count(*) FROM class_enrollments") != 1 {
		t.Fatal("expiry removed academic history")
	}
}
func TestV2InboxDedupAtomicScopeReadUnread(t *testing.T) {
	a, admin, mgr, stu, c := fixture(t)
	replenish(a)
	uid := userID(t, stu)
	status, m := mgr.call("POST", "/manager/announcements", M{"recipient_ids": []int64{uid, uid}, "title": "Thông báo", "content": "Nội dung"})
	requireStatus(t, 201, status, m)
	aid := id(result(m), "announcement_id")
	if num(result(m), "recipient_count") != 1 {
		t.Fatal("recipients not deduped")
	}
	before := count(context.Background(), a.DB.Reader, "SELECT count(*) FROM announcements")
	status, m = mgr.call("POST", "/manager/announcements", M{"recipient_ids": []int64{uid, 1}, "title": "Sai hướng", "content": "Không gửi"})
	requireStatus(t, 422, status, m)
	status, m = admin.call("POST", "/admin/announcements", M{"recipient_ids": []int64{uid, 99999}, "title": "Sai", "content": "Không gửi"})
	requireStatus(t, 422, status, m)
	if count(context.Background(), a.DB.Reader, "SELECT count(*) FROM announcements") != before {
		t.Fatal("invalid inbox batch partially persisted")
	}
	status, m = stu.call("POST", "/student/announcements", M{})
	requireStatus(t, 404, status, m)
	status, m = stu.call("PATCH", fmt.Sprintf("/announcements/%d/read", aid), M{"is_read": true})
	requireStatus(t, 200, status, m)
	status, m = stu.call("GET", fmt.Sprintf("/announcements/%d", aid), nil)
	requireStatus(t, 200, status, m)
	if num(result(m)["announcement"].(map[string]any), "is_read") != 1 {
		t.Fatal("read not persisted")
	}
	status, m = stu.call("PATCH", fmt.Sprintf("/announcements/%d/read", aid), M{"is_read": false})
	requireStatus(t, 200, status, m)
	status, m = admin.call("GET", fmt.Sprintf("/announcements/%d", aid), nil)
	requireStatus(t, 404, status, m)
	e := enrollment(t, stu, c)
	status, m = mgr.call("POST", fmt.Sprintf("%s/enrollments/%d/remove", classPath("manager", c), id(e, "id")), M{"reason": "Kết thúc"})
	requireStatus(t, 200, status, m)
	status, m = mgr.call("POST", "/manager/announcements", M{"recipient_ids": []int64{uid}, "title": "Không gửi", "content": "Đã rời"})
	requireStatus(t, 422, status, m)
}
