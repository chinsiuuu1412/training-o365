# Class Management & Enrollment — Prompt 03

## Phạm vi

Admin: Students/Teachers search + status filter, thêm/sửa họ tên/email/số điện thoại, kiểm tra email trùng, suspend/restore với lý do/xác nhận. Classes search/filter/card, tạo/sửa tên/mã/mô tả/sĩ số/hạn/tiêu chí Attendance và Quiz, phân công/đổi giảng viên có lý do và xác nhận. Class Detail có tổng quan, roster, giảng dạy/học tập, buổi học, materials và lịch.

Teacher: chỉ truy cập lớp được phân công; tabs riêng, roster/progress, xóa học viên có lý do/xác nhận; enrollment pending/history, Approve/Decline dialog. Với lớp mới, giảng viên cố định tổng số buổi một lần; chưa tạo lịch. Giảng viên mới nhận queue của lớp ngay khi Admin đổi phân công, dữ liệu lớp được giữ nguyên.

Student: Registered Classes, Find Classes, search/filter/card, class preview trước khi duyệt, gửi lý do đăng ký, Waiting for Approval, hủy pending, Declined với lý do/countdown và gửi lại. Yêu cầu của tôi giữ khả năng hủy pending ngay cả khi lớp đã hết hạn, trong khi Find Classes loại lớp hết hạn. Full ẩn nút gửi. Preview không có roster/materials/private tabs; được duyệt mới có nội dung lớp và progress ban đầu 0.

Materials/Schedule chỉ hiển thị metadata/trạng thái và kiểm soát truy cập; không upload/xóa/tải tệp hoặc tạo/duyệt/xác nhận lịch. Tài liệu lớp hết hạn bị chặn cho mọi vai trò theo Workflow 10; Admin/Teacher vẫn xem metadata lớp theo Workflow 2. Không triển khai backend/email/assessment, không tự chuyển Prompt 04.

## Các lựa chọn đã được xác nhận

- Họ tên và email bắt buộc, phone tùy chọn; không có password/email service.
- localStorage đồng bộ business state giữa vai trò/tab, reset có xác nhận.
- Chọn tài khoản demo theo vai trò trong AppShell hiện có; sessionStorage giữ lựa chọn riêng từng tab.
- Suspend giữ enrollment và phân công, khóa tài khoản khỏi thao tác; Admin đổi giảng viên riêng khi cần.
- Chỉ Decline tiêu hao giới hạn 3 lần. Hủy không tiêu hao và được gửi lại ngay nếu còn hợp lệ. Decline cần chờ đủ 10 phút và lý do mới.
- Materials/Schedule chỉ xem trong Prompt 03.

## Kiến trúc và file ảnh hưởng

- `src/types/lms.ts`: mở rộng account/class/enrollment/request, material và LmsState.
- `src/mocks/state.ts`: seed snapshot riêng, chuẩn hóa dữ liệu quản lý, kiểm tra snapshot lưu trước khi render.
- `src/mocks/services/management.ts`: pure immutable transitions, kiểm tra role/trạng thái/ownership/membership/capacity/expiry/retry, tạo thông báo.
- `src/mocks/services/dashboard.ts`: nhận snapshot tùy chọn, giữ công thức và compatibility với seed/tests cũ.
- `src/state/lms-provider.tsx`: state persistence + storage event; đọc dữ liệu mới nhất trước chuyển trạng thái, Web Locks tuần tự hóa thao tác giữa các tab có hỗ trợ. Storage không phải cơ chế phân quyền hay database thật.
- `src/components/ui/dialog.tsx`, `shared/management-ui.tsx`: dialog focus trap/Escape/restore focus, form validation/error feedback, confirmation và bảng cuộn ngang có thể focus bằng bàn phím.
- `src/features/accounts/`, `classes/`, `enrollments/`: presentation dùng services; route `/[role]/classes/[classId]` và thay thế các section placeholders liên quan.
- `src/features/dashboard/role-dashboard.tsx`: kết nối dashboard hiện có với state/account chung. Layout/dashboard components được giữ, chỉ bổ sung liên kết và dữ liệu cập nhật.
- `src/components/layout/app-shell.tsx`, `demo-controls.tsx`, root layout: provider, account selector, reset, suspended guard; không tạo AppShell/sidebar/navigation mới.
- `tests/management.test.ts`, `package.json`: thêm suite nghiệp vụ vào npm test. Không thêm dependency sản phẩm.

## Đồng hồ và dữ liệu demo

Đồng hồ demo bắt đầu 09:00 ngày 14/11/2026 UTC+7, sau đó tiến theo số milliseconds thực đã trôi qua, giữ cùng anchor qua reload/tab. Countdown 10 phút không reset khi tải lại. Reset đưa thời gian và dữ liệu về ban đầu. Các ngày hiển thị UTC+7. Dữ liệu chỉ tồn tại ở trình duyệt/origin hiện tại; không đồng bộ thiết bị khác.

Tài khoản demo mặc định vẫn là a1/t1/s1. Lê Chi/s3 có pending Đại số, Trần Bình/s2 có pending CNTT. Có thể dùng các tài khoản này hoặc thêm tài khoản/lớp mới để thử flow mà không thay đổi seed dashboard ban đầu.

## Validation thực tế

- `npm test`: 15/15 pass, gồm 9 bài dashboard cũ; kiểm tra cancellation/decline delay/reason/limit, full/expired approval, suspended actors, duplicate email, capacity, reassignment, access guards và corrupt snapshot.
- `npm run lint`: exit 0.
- `npm run typecheck`: exit 0.
- `npm run build`: exit 0, Next.js 16.4.6; route detail mới được build thành công.
- Production browser: Admin thêm/search/duplicate account, dialog Escape trả focus; Student/Teacher ở các tab riêng gửi/hủy/Decline/lý do/countdown/gửi lại/Approve; reload vẫn registered; Attendance và Quiz mới đều 0; Teacher remove học viên làm mất private tabs ngay.
- Suspend/restore cập nhật tab Student và giữ enrollment; tạo lớp, Teacher cố định số buổi, tài khoản mới đăng ký, full class ẩn Send.
- Kiểm tra bổ sung: thêm Teacher, sửa Student và cập nhật tên trên tab khác; đổi Teacher kèm lý do chuyển queue, thay đổi tiêu chí hoàn thành, giảng viên cũ mất quyền; Find Classes tìm kiếm/preview, lớp hết hạn bị ẩn nhưng pending vẫn hủy được qua Yêu cầu của tôi.
- Mobile 375px: account/class lists, dialogs, focus trap không tràn ngang toàn trang; bảng có scroll riêng. Đã xem ảnh dialog mobile.
- Corrupt snapshot thiếu Student role: hiển thị feedback và reset khôi phục 12 học viên, không pageerror.
- Dashboard regression: cả ba vai trò ở 1440/768/375px, single main/AppShell, reduced motion, search/filter/detail/role switch/drawer/progress đều pass trên production build mới, không pageerror.
- Rà soát độc lập: một lỗi recovery storage và hai lỗi nhỏ về tab/focus đã được sửa, thêm test và xác minh trình duyệt.
- `user-workflow-guideline.md` giữ nguyên SHA256: `A686B4F9E73126696814A9958AB88FD016A8C241A20A030926F6B3A5ECDC0EB2`.

## Giới hạn kiểm tra và bàn giao

Không kiểm thử bằng screen reader thật. Browser test rút thời gian chờ bằng điều chỉnh clock trong fixture; service tests kiểm tra đúng mốc 599999/600000ms. Chưa xác minh concurrency trên trình duyệt không hỗ trợ Web Locks; fallback lưu localStorage không cung cấp transaction như backend. Không có xác thực hoặc bảo mật dữ liệu thật.

Theo giới hạn môi trường đã ghi trước đó, dependencies/build/browser smoke chạy trên bản sao `%TEMP%/vscode-agent-codex-sandbox-xmIuBd/lms-verify`, source bàn giao ở workspace. Preview phiên hiện tại: `http://localhost:3003`. Không thay đổi Git branch/index hoặc tự commit/push.
