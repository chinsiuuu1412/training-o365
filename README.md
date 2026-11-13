# Học Việt LMS

Design System, Shared App Shell, ba dashboard, Class Management & Enrollment và Lesson/Schedule/Attendance (Prompt 04). Nội dung giao diện tiếng Việt. Đây là demo frontend, không có backend hoặc xác thực thật.

## Chạy dự án

Yêu cầu Node.js 22.16+ và npm.

```sh
npm install
npm run dev
```

Mở http://localhost:3000. Route `/` chuyển tới `/admin` để demo. Đây không phải landing page/luồng đăng nhập của sản phẩm hoàn chỉnh.

```sh
npm test
npm run lint
npm run typecheck
npm run build
```

## Cấu trúc

- [Kế hoạch và phạm vi](docs/milestone-1.md)
- [Trạng thái Shared App Shell](docs/shared-app-shell.md)
- [Ba dashboard và kết quả kiểm tra](docs/role-dashboards.md)
- [Class Management & Enrollment — Prompt 03](docs/class-management.md)
- [Lesson, Schedule & Attendance — Prompt 04](docs/lessons-attendance.md)
- [App Router](src/app): role layouts và route giữ chỗ có nhãn.
- [UI primitives](src/components/ui): shadcn/ui pattern với Radix, CVA và Tailwind.
- [Shared shell](src/components/layout/app-shell.tsx): navigation chung và drawer mobile.
- [Dashboard](src/features/dashboard): giao diện từng vai trò, dùng chung StatCard, ClassCard, ProgressCard và StatusBadge.
- [Seed](src/mocks/seed.ts) và [service](src/mocks/services/dashboard.ts): entity có ID thống nhất, tiến độ tính theo Workflow 8.
- [Kiểm thử](tests/dashboard.test.ts): công thức tiến độ và tính nhất quán mock data.

`/admin`, `/teacher`, `/student` là các dashboard. Admin quản lý tài khoản tại `/admin/students`, `/admin/teachers`; cả ba vai trò có `/[role]/classes` và `/[role]/classes/[classId]`. Student có Registered Classes, Find Classes và Yêu cầu của tôi; Teacher xử lý enrollment trong tab Yêu cầu đăng ký của lớp. Admin duyệt lịch và yêu cầu sửa Attendance tại `/admin/requests`; Student xem lịch tại `/student/schedule`. Tab Buổi học/Lịch học hỗ trợ draft, approval, confirmation, học bù và attendance mô phỏng. Thư viện, tài khoản, bài làm và Test retake vẫn ngoài phạm vi. Role/account switch chỉ là demo, không phải phân quyền thật.

Dữ liệu quản lý/enrollment lưu localStorage và đồng bộ giữa các tab cùng origin. Bộ chọn tài khoản giữ riêng theo tab qua sessionStorage. Có Khôi phục demo với xác nhận. Vô hiệu hóa tài khoản giữ nguyên enrollment và phân công; xóa học viên khỏi lớp là thao tác riêng. Hủy đăng ký không tiêu hao lượt; sau Decline phải đợi 10 phút, nhập lý do mới và không vượt quá 3 lần bị từ chối.

Teacher demo Trần Hoàng Nam phụ trách Giải tích và Đại số; class selector lọc toàn bộ nội dung liên quan. Student demo Nguyễn An học ba lớp, ưu tiên Assignment đang làm dở. Chọn Lê Chi để thử yêu cầu Đại số hoặc Trần Bình để thử yêu cầu Nhập môn CNTT. Attendance và Quiz tính riêng theo Workflow 8. Đồng hồ demo bắt đầu lúc 09:00 ngày 14/11/2026 (UTC+7), tiến theo thời gian thực để kiểm tra chờ 10 phút và hạn lớp, được giữ qua tải lại và đồng bộ giữa các tab.

## Kiểm tra và giới hạn môi trường

Kết quả kiểm tra mới nhất nằm trong [báo cáo Prompt 04](docs/lessons-attendance.md); lịch sử dashboard trong [báo cáo dashboard](docs/role-dashboards.md) và milestone đầu trong [báo cáo milestone](docs/milestone-1.md).

Ổ D của môi trường thực hiện hết dung lượng, nên dependencies/build được chạy trên bản sao trong thư mục tạm ổ C. Source và lockfile được bàn giao tại workspace; cần đủ dung lượng và Node/npm để chạy các lệnh cài đặt ở trên. Font Geist được đóng gói cục bộ bằng package, không tải từ Google Fonts khi mở trang.
