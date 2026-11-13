# Prompt 04 — Lesson, Schedule & Attendance

## Hoàn thành

- Teacher: tạo/sửa draft trong các buổi cố định, tên/mô tả/giờ UTC+7, chọn tài liệu có sẵn cùng lớp, mã điểm danh demo; gửi lịch duyệt, xem lý do từ chối, chỉnh sửa/gửi lại; xác nhận trước ít nhất 24 giờ; gửi lý do nghỉ kèm lịch bù. Buổi bù thay thế cùng slot, không tăng tổng số buổi.
- Admin: `/admin/requests` có queue/history/chi tiết, Approve/Reject và lý do; yêu cầu nghỉ và lịch bù được duyệt riêng, lịch bù chỉ áp dụng sau khi nghỉ được duyệt. Cảnh báo quá hạn xác nhận, liên kết đổi giảng viên, hoặc hủy lịch cũ/tạo lịch bù cùng slot có lý do; cảnh báo nếu đã lỡ mốc thông báo 12 giờ. Queue xử lý yêu cầu xóa Attendance.
- Student: lịch đã duyệt hiển thị dù chưa xác nhận, trạng thái chờ xác nhận rõ ràng; xem lịch tháng, chuyển tháng/ngày và chi tiết buổi trong Class Detail. Các buổi lịch sử đã hoàn thành được giữ lại.
- Attendance: nhập mã không che; chỉ mở trong `[start,end)` của buổi đã xác nhận, tối đa 3 lần sai lưu qua reload/tab. Mã đúng ghi nhận một lần và ẩn ô nhập; Teacher xác minh/điểm danh thủ công trong giờ kể cả đã khóa nhập mã. Xin nghỉ tự duyệt nhưng không cộng Attendance; đã điểm danh thì không xin nghỉ. Teacher đề nghị xóa, Admin duyệt hoặc tự xóa có lý do. Quiz không bị thay đổi.
- Đồng hồ mô phỏng trong AppShell hiện có: chọn buổi, trước giờ học 25 giờ / trong buổi / sau kết thúc, xác nhận đổi mốc; đồng bộ mọi tab và không xóa dữ liệu. Toast, validation, confirmation dialog, calendar navigation và trạng thái đồng bộ.

Lịch cũ đã duyệt vẫn có hiệu lực khi đề xuất sửa đang chờ; vẫn xác nhận được lịch hiện tại. Khi đề xuất được duyệt, cần xác nhận lại. Không cho đề xuất cũ thay lịch buổi đang diễn ra/đã kết thúc. Tiến độ giảng dạy tính cả buổi mới đã kết thúc theo đồng hồ mô phỏng.

## Kiến trúc và file chính

- `src/types/lms.ts`: optional lesson/draft/request/attendance fields, giữ tương thích dữ liệu cũ.
- `src/mocks/services/lessons.ts`: transitions và guards độc lập, command dispatch qua service quản lý hiện có.
- `src/mocks/state.ts`: migration localStorage Prompt 03 không reset dữ liệu, kiểm tra trường mới và quan hệ tham chiếu.
- `src/features/lessons/`: controlled form, list/detail/status và attendance tái sử dụng dialog/card/form/table.
- `src/features/schedules/`: calendar và queue Admin.
- `src/state/lms-provider.tsx`, `components/layout/simulation-controls.tsx`: đồng hồ dùng chung/toast, tích hợp vào DemoControls có sẵn.
- Class Detail và các route hiện có: thay nội dung tab Buổi học/Lịch học; hỗ trợ `?tab=lessons`, không tạo layout mới. Dashboard dùng dữ liệu cập nhật và liên kết thao tác đã triển khai.
- `tests/lessons.test.ts`, `package.json`: thêm suite nghiệp vụ và regression.

## Validation

- `npm test`: 28/28 pass; bao gồm 15 tests cũ và 13 tests lesson/schedule/attendance, chính xác tại các mốc 24 giờ/start/end, sai mã, quyền truy cập, học bù, stale approval, migration và teaching progress.
- `npm run lint`, `npm run typecheck`, `npm run build`: exit 0; Next 16.4.6 production build.
- Browser production: draft → submit → Admin approve → Student thấy pending confirmation → confirm → đổi clock chung → 3 lần sai → manual attendance sau khóa → reload → Teacher correction request → Admin approve; mã đúng và absence không cộng điểm; calendar navigation; Teacher/Admin/Student mobile 375px không tràn ngang toàn trang; không pageerror. Đã xem ảnh mobile.
- Regression Prompt 03: thêm/search/email trùng, cancel/decline/retry/approve/reload/zero progress/removal, suspend/restore, tạo lớp/số buổi/full, mobile dialog/focus, corrupt storage/reset đều pass.
- Regression dashboards: Admin/Teacher/Student ở 1440/768/375px, filter/search/details/role switch/drawer/reduced motion, một main/AppShell, không pageerror.
- Rà soát độc lập và tự kiểm tra đã sửa: khóa xác nhận lịch cũ khi có đề xuất, manual sau 3 lần sai, stale approval thay buổi đã diễn ra, migration malformed, retry học bù và progress giảng dạy.
- Workflow SHA256 giữ nguyên: `A686B4F9E73126696814A9958AB88FD016A8C241A20A030926F6B3A5ECDC0EB2`.

## Giới hạn

Tất cả là mô phỏng trình duyệt. Xác minh deadline/mã/quyền, gửi thông báo đúng giờ và bảo mật thật cần backend. Chỉ chọn tài liệu mock có sẵn, không upload. Không triển khai Quiz/certificate/email hoặc milestone kế tiếp. Chưa kiểm thử bằng screen reader thật. Các trường hợp rejection/học bù/late deadline có service tests; browser smoke tập trung luồng approve/attendance chính.

Dependencies/build và browser chạy trên bản sao tạm ổ C theo giới hạn dung lượng đã ghi ở milestone trước; source bàn giao trong workspace. Preview phiên hiện tại: `http://localhost:3004`. Không tự commit/push hay thay đổi workflow.
