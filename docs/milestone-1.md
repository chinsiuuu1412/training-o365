# LMS — Milestone 1

## Phạm vi và nguồn chuẩn
Design System + Shared App Shell + Admin Dashboard. Đọc skill và toàn bộ 5 references trong frontend.agents/skill. Workflow là nguồn chuẩn; không có backend hoặc chuyển trạng thái phê duyệt.

## Cấu trúc sản phẩm
Admin quản lý hệ thống; Teacher quản lý lớp được gán; Student theo dõi học tập. Dùng chung navigation theo role, typed entities và mock services. Teacher trong giao diện gọi là Giảng viên (vai trò quản lí lớp trong workflow).

## Route map
- / chuyển sang /admin cho demo, không đại diện trang chủ công khai trong Workflow 1.
- /admin: dashboard hoàn chỉnh trong milestone này.
- /admin/{students,teachers,classes,library,requests,notifications}: trang giữ chỗ ghi rõ phạm vi.
- /teacher và /student: trang giữ chỗ cho dashboard; navigation role-specific.
- /{role}/{profile,settings}: trang giữ chỗ.
- Mốc sau: /{role}/classes/[classId] và lessons, quizzes, materials, schedule; /student/schedule.

## Thành phần
UI primitives (Button, Card, Badge, Sheet), AppShell, Sidebar, Topbar, PageHeader, StatCard, ProgressTrack, EmptyState, dashboard chart/table/request/activity sections.

## Thiết kế
Navy #0B1F3A, blue #2563EB, canvas #F8FAFC, surface trắng; sidebar 256px, card 16px, spacing 4px. Font Geist Sans local package nếu khả dụng hoặc system sans; không phụ thuộc font CDN. Nội dung tiếng Việt. Motion nhẹ có reduced-motion; mobile drawer có focus trap và Escape.

## Kế hoạch thực hiện
- [x] Khởi tạo Next/TypeScript/Tailwind và shadcn-compatible primitives.
- [x] Tạo seed 3 lớp, người dùng, enrollment, lesson, attendance, quiz, attempt, yêu cầu và thông báo có liên kết.
- [x] Kiểm thử công thức tiến độ, zero denominators và referential integrity.
- [x] Tạo AppShell responsive và route giữ chỗ hợp lệ, role switch demo.
- [x] Tạo Admin dashboard, filter lớp, xem yêu cầu, activity và chart có dữ liệu dạng bảng thay thế.
- [x] Chạy test, lint, typecheck, build và kiểm tra browser.

## Giả định và giới hạn
Dữ liệu minh họa nhỏ; KPI lấy từ seed, không tuyên bố số liệu thật. Tiến độ Attendance và Quiz tách biệt; mỗi lesson/quiz chỉ được tính một lần. Không tính điểm tổng hợp không có trong workflow. Không có phê duyệt, tạo tài khoản hoặc tạo lớp thật ở mốc này. User-information-guideline.md chưa được cung cấp nên chưa thiết kế form tài khoản. Workflow 2 và 10 có điểm chưa rõ về truy cập dữ liệu lớp hết hạn, cần quyết định trước milestone thư viện. Landing/login công khai được hoãn; / vào admin là lối vào demo có nhãn.

## Validation cần chú ý
Keyboard và focus drawer, 375px không tràn ngang, empty search, failed/empty service state, reduced motion; công thức tiến độ và seed quan hệ. Không có Git repo ở thời điểm bắt đầu.

## Kết quả kiểm tra thực tế — 14/11/2026
- Node 22.16.0 portable; Next 16.4.6 được khóa trong package-lock.json.
- npm test: 4/4 pass. Kiểm tra công thức, chống đếm trùng, mẫu số 0, quan hệ seed và KPI.
- npm run lint: exit 0, không lỗi/cảnh báo trong lần chạy cuối.
- npm run typecheck: exit 0.
- npm run build: exit 0, production build thành công.
- Chrome headless với reduced motion: 1440×1100 và 375×812 không tràn ngang toàn trang; bảng cuộn riêng.
- Sidebar thu gọn; tìm lớp, empty/reset; filter chart; mở/đóng yêu cầu: pass.
- 8 route Admin giữ chỗ và chuyển role Teacher/Student: pass; route không tồn tại hiển thị trang không tìm thấy. Next streaming có thể trả HTTP 200 cho not-found ở dynamic route.
- Drawer mobile: 15 lần Tab giữ focus trong dialog, Escape đóng, trả focus nút mở, navigation đóng drawer: pass. Đã sửa lỗi focus restoration phát hiện trong smoke test.
- Không có pageerror trong kịch bản browser đã chạy. Đã xem ảnh full-page desktop và mobile.
- Loading skeleton, error boundary và empty state được triển khai; chưa fault-inject error boundary hoặc kiểm thử bằng screen reader thật.

## Giới hạn môi trường
Ổ D ban đầu hết dung lượng; tệp Node tải dở do agent tạo đã được xóa. Dependencies và build chạy trên bản sao mã nguồn trong thư mục tạm ổ C, không cài node_modules vào workspace. Source vẫn ở workspace; package-lock được chép về để cài đặt lặp lại. Browser smoke dùng Playwright tạm, không thêm vào dependencies sản phẩm. VS Code báo schema URL trong components.json chưa được trust; đây là cấu hình editor, không phải lỗi lint/TypeScript/build.

## Phạm vi chưa triển khai
Teacher/Student dashboard, danh sách/chi tiết lớp, lesson/quiz, thư viện, lịch, thông báo chi tiết, forms tạo tài khoản/lớp và business transitions thuộc milestone sau. Chưa đạt 70% toàn frontend; đây là milestone đầu tiên theo yêu cầu. Không có backend, authentication hoặc authorization thực.
