# Học Việt LMS

Design System, Shared App Shell và ba dashboard Admin, Teacher, Student. Nội dung giao diện tiếng Việt. Đây là demo frontend, không có backend hoặc xác thực thật.

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
- [App Router](src/app): role layouts và route giữ chỗ có nhãn.
- [UI primitives](src/components/ui): shadcn/ui pattern với Radix, CVA và Tailwind.
- [Shared shell](src/components/layout/app-shell.tsx): navigation chung và drawer mobile.
- [Dashboard](src/features/dashboard): giao diện từng vai trò, dùng chung StatCard, ClassCard, ProgressCard và StatusBadge.
- [Seed](src/mocks/seed.ts) và [service](src/mocks/services/dashboard.ts): entity có ID thống nhất, tiến độ tính theo Workflow 8.
- [Kiểm thử](tests/dashboard.test.ts): công thức tiến độ và tính nhất quán mock data.

`/admin`, `/teacher`, `/student` là các dashboard đầy đủ trong phạm vi demo. Các route quản lý ngoài dashboard vẫn là trang giữ chỗ. Chi tiết lớp, buổi học, yêu cầu và Assignment có thể xem ngay trên dashboard; các nút duyệt/tạo/học bài ghi rõ chưa hỗ trợ. Role switch chỉ là demo, không phải phân quyền. Tất cả thống kê lấy từ cùng bộ dữ liệu minh họa.

Teacher demo Trần Hoàng Nam phụ trách Giải tích và Đại số; class selector lọc toàn bộ nội dung liên quan. Student demo Nguyễn An học ba lớp, ưu tiên Assignment đang làm dở. Attendance và Quiz được tính riêng theo Workflow 8. Mốc demo cố định là 09:00 ngày 14/11/2026 (UTC+7), có nhãn trên mỗi dashboard.

## Kiểm tra và giới hạn môi trường

Kết quả kiểm tra mới nhất nằm trong [báo cáo dashboard](docs/role-dashboards.md); lịch sử milestone đầu trong [báo cáo milestone](docs/milestone-1.md).

Ổ D của môi trường thực hiện hết dung lượng, nên dependencies/build được chạy trên bản sao trong thư mục tạm ổ C. Source và lockfile được bàn giao tại workspace; cần đủ dung lượng và Node/npm để chạy các lệnh cài đặt ở trên. Font Geist được đóng gói cục bộ bằng package, không tải từ Google Fonts khi mở trang.
