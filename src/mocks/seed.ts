import type { User, Class, Enrollment, Lesson, Attendance, Quiz, QuizAttempt, ApprovalRequest, Notification, Schedule, AssignmentDraft } from "../types/lms.ts";

export const referenceTime = "2026-11-14T09:00:00+07:00";

export const users: User[] = [
  { id: "a1", name: "Nguyễn Minh Anh", role: "admin", initials: "MA" },
  { id: "t1", name: "Trần Hoàng Nam", role: "teacher", initials: "HN" },
  { id: "t2", name: "Lê Thu Hà", role: "teacher", initials: "TH" },
  { id: "t3", name: "Phạm Minh Đức", role: "teacher", initials: "MĐ" },
  ...["Nguyễn An", "Trần Bình", "Lê Chi", "Phạm Dũng", "Hoàng Giang", "Đỗ Hạnh", "Vũ Khánh", "Bùi Linh", "Ngô Mai", "Đặng Ngọc", "Hồ Phúc", "Đinh Quân"].map((name, i): User => ({ id: `s${i + 1}`, name, role: "student", initials: name.split(" ").map(x => x[0]).join("") })),
];
export const classes: Class[] = [
  { id: "giai-tich", name: "Giải tích", code: "MATH101", teacherId: "t1", capacity: 30, totalLessons: 12, expiresAt: "2027-02-28", color: "blue" },
  { id: "dai-so", name: "Đại số", code: "MATH102", teacherId: "t1", capacity: 25, totalLessons: 10, expiresAt: "2027-02-28", color: "violet" },
  { id: "nhap-mon-cntt", name: "Nhập môn Công nghệ thông tin", code: "IT101", teacherId: "t3", capacity: 30, totalLessons: 8, expiresAt: "2027-01-31", color: "teal" },
];
export const enrollments: Enrollment[] = classes.flatMap((c, ci) => users.filter(u => u.role === "student").filter((_, i) => ci === 0 || (i + ci) % 3 !== 0).map(u => ({ classId: c.id, studentId: u.id, status: "approved" as const })));
export const lessons: Lesson[] = classes.flatMap((c, ci) => Array.from({ length: c.totalLessons }, (_, i) => ({ id: `${c.id}-l${i + 1}`, classId: c.id, name: `Buổi ${i + 1}`, completed: i < [8, 5, 6][ci] })));
export const attendance: Attendance[] = enrollments.flatMap((e, ei) => lessons.filter(l => l.classId === e.classId && l.completed).map((l, i) => ({ studentId: e.studentId, lessonId: l.id, recorded: (i + ei) % 5 !== 0 })));
export const quizzes: Quiz[] = classes.flatMap((c, ci) => Array.from({ length: 6 }, (_, i) => ({ id: `${c.id}-q${i + 1}`, classId: c.id, kind: i % 2 === 0 ? "test" as const : "assignment" as const, passingScore: 60, title: i === 5 ? ["Ứng dụng đạo hàm", "Bài tập không gian vector", "Thực hành mạng máy tính"][ci] : `${i % 2 === 0 ? "Test" : "Assignment"} ${i + 1}`, opensAt: "2026-11-01T08:00:00+07:00", dueAt: i === 5 ? `2026-11-${16 + ci}T23:59:00+07:00` : "2026-11-12T23:59:00+07:00", timeLimitMinutes: 30 })));
export const attempts: QuizAttempt[] = enrollments.flatMap((e, ei) => quizzes.filter(q => q.classId === e.classId).slice(0, 5).map((q, i) => ({ quizId: q.id, studentId: e.studentId, score: (i + ei) % 4 === 0 ? 40 : 80, valid: true })));
export const requests: ApprovalRequest[] = [
  { id: "r1", kind: "schedule", classId: "giai-tich", senderId: "t1", title: "Phê duyệt thời khóa biểu", description: "Lịch học cho các buổi còn lại của lớp Giải tích, bắt đầu từ buổi 10 ngày 19/11.", createdAt: "2026-11-14T08:15:00+07:00", status: "waiting" },
  { id: "r2", kind: "schedule", classId: "dai-so", senderId: "t1", title: "Xin nghỉ và đề xuất lịch học bù", description: "Đề xuất học bù lúc 09:00 ngày 21/11/2026, thay buổi 18/11/2026.", createdAt: "2026-11-14T07:30:00+07:00", status: "waiting" },
  { id: "r3", kind: "schedule", classId: "nhap-mon-cntt", senderId: "t3", title: "Phê duyệt thời khóa biểu", description: "Lịch buổi thực hành cuối khóa ngày 20/11, sau buổi đã xác nhận ngày 18/11.", createdAt: "2026-11-13T16:00:00+07:00", status: "waiting" },
  { id: "r4", kind: "enrollment", classId: "dai-so", senderId: "s3", title: "Đăng ký lớp Đại số", description: "Em muốn củng cố kiến thức về vector để hỗ trợ môn Giải tích.", createdAt: "2026-11-14T08:20:00+07:00", status: "waiting" },
  { id: "r5", kind: "enrollment", classId: "nhap-mon-cntt", senderId: "s2", title: "Đăng ký lớp Nhập môn CNTT", description: "Em muốn bổ sung kiến thức nền tảng về máy tính.", createdAt: "2026-11-14T08:00:00+07:00", status: "waiting" },
  { id: "r6", kind: "test-retake", classId: "giai-tich", senderId: "s1", quizId: "giai-tich-q1", title: "Xin làm lại Test 1", description: "Em chưa đạt mức điểm yêu cầu và muốn được ôn tập, làm lại bài.", createdAt: "2026-11-14T07:40:00+07:00", status: "waiting" },
  { id: "r7", kind: "test-retake", classId: "dai-so", senderId: "s7", quizId: "dai-so-q1", title: "Xin làm lại Test 1", description: "Em chưa đạt ở lần làm trước, xin được làm lại sau khi ôn tập.", createdAt: "2026-11-13T17:00:00+07:00", status: "waiting" },
];
// Pending applicants have no learning records until their enrollment is approved.
enrollments.push({ classId: "dai-so", studentId: "s3", status: "pending" }, { classId: "nhap-mon-cntt", studentId: "s2", status: "pending" });
export const notifications: Notification[] = [
  { id: "n1", recipientId: "a1", classId: "giai-tich", title: "Thời khóa biểu mới cần xem xét", description: "Trần Hoàng Nam đã gửi lịch học lớp Giải tích.", createdAt: "2026-11-14T08:15:00+07:00", href: "/admin/requests" },
  { id: "n2", recipientId: "a1", classId: "dai-so", title: "Có đề xuất lịch học bù", description: "Trần Hoàng Nam gửi yêu cầu nghỉ kèm lịch học bù lớp Đại số.", createdAt: "2026-11-14T07:30:00+07:00", href: "/admin/requests" },
  { id: "n3", recipientId: "a1", title: "Đã cập nhật kết quả Quiz", description: "Dữ liệu minh họa của 3 lớp đã được đồng bộ.", createdAt: "2026-11-13T16:00:00+07:00", href: "/admin" },
  { id: "n4", recipientId: "t1", classId: "dai-so", title: "Có yêu cầu đăng ký lớp", description: "Lê Chi gửi yêu cầu tham gia lớp Đại số; đang chờ bạn xem xét.", createdAt: "2026-11-14T08:20:00+07:00", href: "/teacher" },
  { id: "n5", recipientId: "t1", classId: "giai-tich", title: "Học viên xin làm lại Test", description: "Nguyễn An đã gửi lý do xin làm lại Test 1 lớp Giải tích.", createdAt: "2026-11-14T07:40:00+07:00", href: "/teacher" },
  { id: "n6", recipientId: "s1", classId: "giai-tich", title: "Assignment đang làm dở", description: "Ứng dụng đạo hàm: bài làm được lưu, hạn nộp 23:59 ngày 16/11.", createdAt: "2026-11-14T08:30:00+07:00", href: "/student" },
  { id: "n7", recipientId: "s1", classId: "giai-tich", title: "Yêu cầu làm lại Test đang chờ duyệt", description: "Test 1 vẫn giữ nguyên kết quả; chưa được mở thêm lượt làm.", createdAt: "2026-11-14T07:40:00+07:00", href: "/student" },
  { id: "n8", recipientId: "s1", classId: "dai-so", title: "Buổi học Đại số đã xác nhận", description: "Buổi 6 diễn ra lúc 19:00 ngày 17/11. Kiểm tra lịch học để chuẩn bị.", createdAt: "2026-11-13T15:00:00+07:00", href: "/student/schedule" },
];

export const schedules: Schedule[] = [
  { id: "sch1", lessonId: "giai-tich-l9", startsAt: "2026-11-16T18:00:00+07:00", endsAt: "2026-11-16T20:00:00+07:00", status: "confirmed" },
  { id: "sch2", lessonId: "dai-so-l6", startsAt: "2026-11-17T19:00:00+07:00", endsAt: "2026-11-17T21:00:00+07:00", status: "confirmed" },
  { id: "sch3", lessonId: "nhap-mon-cntt-l7", startsAt: "2026-11-18T09:00:00+07:00", endsAt: "2026-11-18T11:00:00+07:00", status: "confirmed" },
  { id: "sch4", lessonId: "giai-tich-l10", startsAt: "2026-11-19T18:00:00+07:00", endsAt: "2026-11-19T20:00:00+07:00", status: "pending" },
  { id: "sch5", lessonId: "dai-so-l7", startsAt: "2026-11-21T09:00:00+07:00", endsAt: "2026-11-21T11:00:00+07:00", status: "pending" },
  { id: "sch6", lessonId: "nhap-mon-cntt-l8", startsAt: "2026-11-20T09:00:00+07:00", endsAt: "2026-11-20T11:00:00+07:00", status: "pending" },
];
export const assignmentDrafts: AssignmentDraft[] = [
  { studentId: "s1", quizId: "giai-tich-q6", answeredQuestions: 4, totalQuestions: 10, remainingMinutes: 18, updatedAt: "2026-11-14T08:30:00+07:00" },
];
