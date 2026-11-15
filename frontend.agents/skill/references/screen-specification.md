# Đặc tả màn hình LMS · approved-v2

Đã nối tài khoản, lớp, ghi danh, dashboard, agenda, lịch/Attendance, builder, Runner/Result, Progress, Library và Inbox qua DTO/service dùng chung. Hồ sơ chỉ đọc, Student history tách enrollment_id, Manager queue chuyển quyền khi reassignment. Bản API mở từng cờ sau kiểm chứng backend; Inbox/Library dùng NEXT_PUBLIC_COMMUNICATIONS_ENABLED. Chi tiết Inbox dùng notificationId, Library dùng classId/materialId trên trang tĩnh, có thể reload. Kết quả kiểm thử được báo trong cuộc trò chuyện, README ghi cấu hình chạy.

Người dùng đã chốt grant Assignment được phép cả trước hạn, theo điều kiện contract mới về từng enrollment_id, lý do và hạn mới vượt hạn hiệu lực. Cutoff đang chạy giữ nguyên. Quyết định này bổ sung mô tả mở lại khi hết hạn trong nguồn workflow gốc.

Dựa trên [workflow v2](user-workflow-guideline.md) và [user information](user-information-guideline.md). Các điểm đã chốt theo contract mới gồm MSSV 9 chữ số, SĐT di động Việt Nam, gender male/female/other/null, staff profile null và grant Assignment theo hạn hiệu lực của từng enrollment. Dùng API_DEFINITIONS và API_REQUEST_RESPONSE_EX để chốt endpoint, request và lỗi trước khi sửa.

| Màn hình | Hành vi đích |
| --- | --- |
| Public và phiên | Giữ giới thiệu CLB/khóa học và lối vào đăng nhập trực tiếp. Login, khôi phục phiên, logout và đổi mật khẩu theo /auth. Hồ sơ cá nhân chỉ đọc. Hiển thị đúng vai trò; lỗi mạng khi khôi phục phiên có nút thử lại. |
| Admin và Manager | Giữ /admin/managers và /manager. Manager xem lớp được phân công. Admin quản lý Student/Manager, lớp và lịch duyệt. Đổi Manager cần lý do và xác nhận. Admin chỉ xem Attendance và kết quả Quiz. |
| Dashboard và lớp | Dashboard theo role lấy dữ liệu API. Student dùng agenda cho lịch và Quiz, discovery/preview để tìm lớp, cycle summary cho lịch sử. Lớp hết hạn hoặc đã bị gỡ chỉ hiện lịch sử được phép. |
| Enrollment | Student gửi/hủy yêu cầu. Manager lớp xét duyệt. Hiển thị đầy lớp, cooldown 10 phút, lý do và giới hạn ba decline. Tái ghi danh dùng enrollment_id mới và giữ lịch sử. |
| Lịch và Attendance | Manager draft/submit, Admin review. Giữ lịch đang có hiệu lực trong lúc chờ duyệt hoặc từ chối lịch thay thế. Student điểm danh trong cửa sổ đã duyệt và xin nghỉ tự duyệt, riêng với credit. Dùng remaining_attempts ở lỗi mã sai 422. Manager override có lý do và audit. |
| Quiz và Progress | Test nộp tay từ đúng 2/3; Assignment mặc định 10 lượt và đồng hồ tiếp tục chạy khi reload/offline. Hiển thị Runner hoặc Result, trạng thái lưu và recovery. Grant theo enrollment IDs và hạn mới lớn hơn hạn hiệu lực từng người, với giới hạn lượt theo contract. Progress hai track và Completed lấy từ response kèm incomplete_reasons. |
| Inbox và Library | Mở chi tiết Inbox riêng với PATCH đọc/chưa đọc. Staff gửi đúng phạm vi với ID người nhận rõ ràng và danh sách phân trang. Library quản lý link HTTPS Document/Video, tùy chọn gắn buổi/hạn; cả Admin và Manager gỡ có lý do. Ngoại lệ YouTube chỉ áp hạn riêng tài liệu. |

Giữ các màn hình SAU MVP ngoài điều hướng, quick actions và liên kết của bản API, gồm xác nhận lịch 24 giờ, retake request, sửa điểm Quiz, Đã gửi/yêu cầu tự do, upload, email tự động và cấp chứng chỉ. Tách tác dụng phụ mock cũ khỏi các luồng đã chuyển.

Giữ AppShell và component hiện có. Route chi tiết dùng trang tương thích static export và mở được ID lớp/quiz mới. Mỗi màn hình xử lý loading, rỗng, lỗi, thiếu quyền, hết hạn và trường hợp đang lưu. Điều hướng cũ chỉ dùng khi có đích tương đương và kiểm tra quyền phù hợp.

Đợt Static/Auth đã triển khai query route: `/[role]/classes/?classId=…&tab=…`, player `/student/classes/?classId=…&quizId=…`. Role/section tĩnh, ID đọc tại client; legacy Teacher/class/quiz path qua resolver/custom 404. Login/profile/settings dùng AuthService + me; 401 xác nhận về login, network/5xx restore có retry. Bản API mặc định chưa mở auth trước kiểm chứng backend; các nghiệp vụ còn lại chỉ có trạng thái chưa khả dụng, không đọc mock. Fixture workspace giữ màn hình cũ để QA, chưa phải nghiệp vụ API đạt contract. Chi tiết kết quả và việc cần backend ở audit đợt Static/Auth.
