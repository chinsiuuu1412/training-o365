# Học Việt LMS

Ứng dụng frontend Next.js 16 / React 19 / Tailwind CSS 4 cho hệ thống **Học Việt LMS**, tích hợp trực tiếp với backend Go (`approved-v2`, 94 route `/api/v1`) tại [backend/](backend/). Toàn bộ giao diện tiếng Việt, giữ nhận diện xanh navy/CLB (`#0b1f3a`, `#2563eb`, `#f8fafc`, font Geist đóng gói cục bộ). Không dùng `localStorage`, `sessionStorage`, `IndexedDB`, dữ liệu giả hay đồng hồ mô phỏng; trạng thái phiên và CSRF chỉ giữ trong bộ nhớ tiến trình.

Xem [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) để biết kiến trúc triển khai VPS (nginx `127.0.0.1:5000` -> Go API `127.0.0.1:5001` / Next.js `127.0.0.1:5002`), cấu hình proxy phát triển cục bộ và giới hạn hiện tại.

## Chạy dự án

Yêu cầu Node.js 22.16+ và npm (thêm Go 1.24+ nếu chạy backend cục bộ để kiểm thử).

```sh
npm ci
npm test
npm run typecheck
npm run lint
npm run build
```

Chạy frontend dev cùng proxy tới backend cục bộ qua biến môi trường private trên server (`BACKEND_PROXY_TARGET`, chỉ chấp nhận loopback `127.0.0.1` / `localhost` / `::1` trong [next.config.ts](next.config.ts)):

```sh
BACKEND_PROXY_TARGET=http://127.0.0.1:5001 npm run dev
```

Mở `http://localhost:3000`. Route `/` khôi phục phiên qua `GET /api/v1/auth/me` rồi chuyển tới `/login` hoặc dashboard theo vai trò (`admin`, `class_manager` tại `/manager`, `student`; `/teacher` chuyển hướng tương thích tới `/manager`).

## Phạm vi chức năng đã tích hợp

- **Xác thực & hồ sơ (`/login`, `/[role]/profile`)**: đăng nhập (`POST /api/v1/auth/login`), khôi phục phiên (`GET /api/v1/auth/me`), đăng xuất (`POST /api/v1/auth/logout`), đổi mật khẩu (`POST /api/v1/auth/change-password`), gửi `credentials: "include"`, `X-CSRF-Token` và phân biệt lỗi 401 hết phiên với lỗi mạng/tạm thời.
- **Dashboard theo vai trò (`/admin`, `/manager`, `/student`)**: đọc DTO trực tiếp từ `GET /api/v1/{role}/dashboard`, hiển thị lịch theo múi giờ Việt Nam (UTC+7), làm mới kết quả cho nhân sự (`<= 5` phút).
- **Quản trị tài khoản (`/admin/students`, `/admin/managers`)**: tìm kiếm, lọc, phân trang server; tạo/cập nhật học viên (MSSV 9 chữ số, `@sis.hust.edu.vn`, trường/viện, lớp sinh viên, SĐT Việt Nam) và quản lý lớp; cập nhật trạng thái kèm lý do và đặt lại mật khẩu.
- **Lớp học & đăng ký (`/[role]/classes`, `/[role]/classes/[classId]`)**: tạo/cập nhật lớp (`admin`), cố định `total_sessions` một lần (`class_manager`), xem trước lớp cho học viên, gửi/hủy yêu cầu đăng ký kèm lý do, duyệt/từ chối và xóa học viên theo `enrollment_id` chu kỳ hiện tại.
- **Lịch học, điểm danh & xin nghỉ (`/[role]/schedule`, `/admin/schedule-proposals`, tab buổi học)**: `class_manager` lưu nháp/gửi duyệt lịch, `admin` duyệt/từ chối; học viên điểm danh bằng mã (giữ nguyên 422 `remaining_attempts`) và gửi đơn xin nghỉ tự động duyệt không tính chuyên cần; `class_manager` ghi đè chuyên cần kèm lý do; xem nhật ký kiểm toán.
- **Bài kiểm tra & bài tập (`/[role]/classes/[classId]/quizzes/[quizId]`)**: `class_manager` tạo/sửa câu hỏi một lựa chọn, phát hành, xem kết quả và cấp lượt/gia hạn theo `enrollment_id`; học viên làm bài với `Idempotency-Key` UUID theo chu kỳ, tự động lưu toàn bộ đáp án tuần tự theo `expected_revision` (xử lý `409` bằng nạp lại trạng thái), đồng hồ đếm ngược liên tục từ header `Date` của server, khóa nộp thủ công trước `2/3` thời lượng với `test` và không lộ đáp án đúng ở client.
- **Thư viện liên kết HTTPS, hộp thư thông báo & tiến độ**: CRUD liên kết HTTPS (`class_manager`), xóa kèm lý do (`admin`), xem danh sách liên kết được phép (`student`); hộp thư thông báo phân trang thật, đánh dấu đã đọc/chưa đọc tường minh qua `PATCH`, gửi thông báo nội bộ tới người nhận chọn qua danh bạ phân trang; xem tiến độ chu kỳ hiện tại và `incomplete_reasons` từ server.
- **Kiểm thử ([tests/api-client.test.ts](tests/api-client.test.ts), [tests/quiz-client.test.ts](tests/quiz-client.test.ts))**: dùng `node --experimental-strip-types --test` kiểm tra HTTP envelope, CSRF/Idempotency, xử lý `401`/`429`/lỗi mạng, phân trang đầy đủ, tuần tự `expected_revision`, xung đột `409` và giới hạn `2/3` thời lượng `test`.

## Tài nguyên nhận diện
- Logo chính thức của CLB (`assets/logo/Logo o365-01.png`, giữ nguyên bản gốc) được cắt viền trong suốt và tối ưu kích thước thành `public/logo-o365.png` (256×256) cùng favicon `public/icon-32.png` (32×32), `public/icon-64.png` (64×64) và `public/apple-icon.png` (180×180) phục vụ hiển thị trên header, sidebar và metadata trình duyệt.

## Giới hạn

- Các tính năng không có trong hợp đồng backend (`94` route `/api/v1`) đã bị loại bỏ khỏi UI (chuyển đổi tài khoản/vai trò demo, tải tệp lên, chứng chỉ giả lập, chấm điểm tại client).
- Đã chạy smoke test trình duyệt tích hợp cục bộ có chọn lọc với backend Go và SQLite tổng hợp tạm thời ngoài repository; dữ liệu này chỉ phục vụ cô lập, không phải dữ liệu demo được đóng gói. Đã kiểm tra đăng nhập cookie không chèn cookie thủ công, tạo manager qua UI, tạo/phát hành quiz, autosave và khôi phục sau reload, chấm điểm/nộp bài, lượt làm thứ hai riêng biệt, giao diện 390×844 không tràn ngang và từ chối truy cập sai vai trò. Đây không phải full E2E: chưa kiểm tra đầy đủ lịch, điểm danh, đăng ký, thông báo, grants, xung đột `409` hay mở khóa bài kiểm tra qua trình duyệt; chưa chứng nhận toàn bộ 94 route, hiệu năng/tải hoặc production. Chi tiết tại [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).
- Triển khai VPS production (`https://lms-demo.tuanmnk8.me`) qua nginx + systemd chưa thực hiện; môi trường production chưa được chứng nhận.