# Role dashboards — 14/11/2026

## Phạm vi hoàn thành

- `/admin`: KPI hệ thống, thống kê học viên/giảng viên, ba lớp, so sánh Attendance và Quiz với bảng số liệu thay thế, tiến độ giảng dạy, lịch chờ duyệt, hoạt động gần đây, thao tác nhanh.
- `/teacher`: bộ chọn lớp, lớp phụ trách, tiến độ giảng dạy và học tập, buổi học sắp tới, yêu cầu đăng ký, yêu cầu làm lại Test, thông báo. Bộ lọc áp dụng cho các khu vực liên quan và KPI.
- `/student`: Assignment đang làm dở, các lớp đã đăng ký, Attendance/Quiz độc lập, buổi học đã xác nhận, hạn Assignment theo thứ tự gần nhất, thông báo học tập.

Theo lựa chọn trong quiz: xem chi tiết mock tại dashboard; các thao tác duyệt/tạo/học bài bị vô hiệu hóa và có nhãn chưa hỗ trợ. Trần Hoàng Nam phụ trách Giải tích và Đại số. Continue learning ưu tiên Assignment đang làm dở, không mở lại Test. Không có thay đổi trạng thái dữ liệu hoặc lưu trữ trình duyệt.

## Cấu trúc thay đổi

- `src/types/lms.ts`, `src/mocks/seed.ts`: lịch học có trạng thái/thời gian, deadline Quiz, Assignment draft, loại yêu cầu và người nhận thông báo. Giữ ba lớp, 12 học viên và ba tài khoản giảng viên; hai giảng viên đang phụ trách lớp.
- `src/mocks/services/dashboard.ts`: các projection Admin/Teacher/Student; đăng ký pending không tính vào sĩ số. Attendance/Quiz cùng tính từ một bộ bản ghi, không đếm trùng. Student không có quyền truy cập lớp hết hạn.
- `src/components/shared/`: dùng chung StatCard, ClassCard, ProgressCard, StatusBadge. Card hover 160ms, progress 400ms.
- `src/features/dashboard/`: các view theo vai trò; dùng chung danh sách buổi học, yêu cầu, thông báo và định dạng ngày UTC+7. Chi tiết mở bằng native disclosure hỗ trợ bàn phím.
- `src/app/[role]/page.tsx`: phân phối dữ liệu cho ba dashboard trong layout có sẵn. AppShell và navigation config không thay đổi.
- `src/app/globals.css`: page entry 200ms, hover nhẹ, hỗ trợ reduced motion.
- `tests/dashboard.test.ts`: công thức, tham chiếu seed, quyền sở hữu dữ liệu, trường hợp pending/expired, tương quan số liệu giữa các vai trò.

## Mốc dữ liệu demo

09:00 ngày 14/11/2026 (UTC+7), hiển thị rõ trên mỗi dashboard. Upcoming/deadline được tính tương đối với mốc này, không theo đồng hồ thật. Lịch chưa xác nhận không hiển thị như buổi có thể tham gia. Thống kê học viên Admin là tài khoản duy nhất; lượt đăng ký lớp có thể tính cùng một học viên ở nhiều lớp và được ghi nhãn rõ.

## Kiểm tra

- Unit: 9/9 pass, gồm tiến độ/không đếm trùng, mẫu số 0, tham chiếu dữ liệu, quyền sở hữu hai lớp, pending enrollment, Test-retake, Assignment continuation, lịch tương lai đã xác nhận, lớp hết hạn và yêu cầu đã xử lý.
- Browser: Chrome headless, cả ba vai trò ở 1440×1100, 768×1100 và 375×1100; không tràn ngang toàn trang, chỉ một main/AppShell. Đã xem ảnh desktop/mobile.
- Tương tác: Admin search/reset/filter chart/bảng số liệu/chi tiết yêu cầu; Teacher filter cards/KPI/progress/lessons/requests/notifications; Enter mở chi tiết; Student Assignment/50% Attendance/50% Quiz của Giải tích; nút unsupported disabled; lịch chờ duyệt ẩn khỏi upcoming.
- AppShell regression: mobile drawer mở, Escape đóng, trả focus; role switch trên mobile. Không có pageerror trong các kịch bản đã chạy.
- Reduced motion: page animation rút xuống .01ms theo CSS.
- Workflow SHA256 không đổi: `A686B4F9E73126696814A9958AB88FD016A8C241A20A030926F6B3A5ECDC0EB2`.

- `npm test`: exit 0, 9/9 pass. Node 22.16 phát ExperimentalWarning cho cơ chế strip-types có sẵn của test runner.
- `npm run lint`: exit 0, không lỗi/cảnh báo ESLint.
- `npm run typecheck`: exit 0.
- `npm run build`: exit 0, Next 16.4.6 production build thành công.
- Rà soát độc lập: không phát hiện Critical/Important/Minor trong phạm vi mã nguồn đã review; xác nhận dữ liệu và workflow hash.
- Đã chạy lại toàn bộ browser smoke trên production build cuối sau thay đổi bố cục ba card desktop; tất cả kiểm tra pass. Preview tại `http://localhost:3002/{admin,teacher,student}` trong phiên thực hiện.

## Giới hạn

Không có backend, xác thực/phân quyền thật, duyệt yêu cầu, tạo lớp/tài khoản hay màn hình làm bài. Các trang quản lý vẫn có nhãn giữ chỗ. Dùng loading/error boundary có sẵn; chưa fault-inject error boundary hoặc kiểm thử với screen reader thật. Không thay đổi quyết định search topbar đang chờ ở milestone AppShell.

Kiểm tra dependencies/build trên bản sao trong `%TEMP%/vscode-agent-codex-sandbox-xmIuBd/lms-verify` theo giới hạn dung lượng đã ghi ở milestone trước. Mã nguồn bàn giao ở workspace. Không thêm dependency sản phẩm; browser smoke dùng Playwright tạm có sẵn. Thư mục workspace chưa là Git repository, nên không tạo commit/branch.
