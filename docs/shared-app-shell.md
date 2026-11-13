# Shared App Shell — 14/11/2026

## Phạm vi
Một AppShell dùng chung cho Admin, Teacher và Student; chỉ điều hướng và layout. Giữ nguyên dashboard và mock business logic hiện có. Không sửa user-workflow-guideline.md.

## Đã có và đã hoàn thiện
- Sidebar navy #0B1F3A, expanded 256px, thu gọn 80px; active #2563EB.
- Mobile/tablet dùng Radix drawer: focus trap, Escape, khôi phục focus và đóng khi chọn trang.
- Hiệu ứng drawer mở 220ms, đóng 180ms; hỗ trợ reduced motion và giới hạn chiều rộng màn hình nhỏ.
- Topbar trắng với breadcrumb, thông báo và avatar liên kết tới trang tài khoản.
- Navigation config riêng từng role, AppShell không lặp logic theo vai trò.
- Nhãn truy cập rõ ràng khi sidebar chỉ hiện icon; active route khớp ranh giới segment.
- Breadcrumb Hồ sơ cá nhân/Cài đặt tài khoản hiển thị đúng tên.
- PageHeader, main content container, LoadingState và EmptyState tái sử dụng được. DashboardSkeleton dùng LoadingState.

## Chưa quyết định — search topbar
Đã gửi quiz cho người dùng. Chưa triển khai tìm kiếm topbar trong khi chờ xác định một trong ba phạm vi: tìm mục điều hướng theo role, ô chưa hỗ trợ có nhãn, hoặc tìm dữ liệu lớp/học liệu theo mô tả bổ sung. Không tự chọn hành vi.

## Validation đã chạy
- ESLint: exit 0, không lỗi/cảnh báo.
- TypeScript: exit 0.
- Production build: exit 0.
- Chrome headless: Admin/Teacher/Student × 1440px, 768px, 375px đều không tràn ngang toàn trang.
- Kiểm tra đúng mã màu canvas/sidebar/active, navigation khi thu gọn, mobile drawer Tab/focus trap, Escape/restore focus, đóng khi chọn trang: pass.
- Breadcrumb hồ sơ/cài đặt cho cả ba role và reduced motion: pass.
- Không có pageerror trong các kịch bản trên. Chưa kiểm thử bằng screen reader thật.
- SHA256 workflow trước và sau: A686B4F9E73126696814A9958AB88FD016A8C241A20A030926F6B3A5ECDC0EB2.

Kiểm tra dùng bản sao trong thư mục tạm ổ C do giới hạn dung lượng workspace đã ghi ở báo cáo milestone 1. Preview kiểm tra ở http://localhost:3001. Phần search cần được xác nhận và kiểm tra tiếp trước khi coi yêu cầu AppShell mới là hoàn tất.
