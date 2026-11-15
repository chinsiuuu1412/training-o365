# Hệ thống thiết kế LMS · CLB o365 HUST

## Nhận diện

Tên sản phẩm là **CLB o365 HUST - Khóa học Kĩ năng mềm**. Giữ phong cách Balanced, nền trắng sáng, điều hướng navy và xanh CLB làm điểm nhấn. Giao diện và phản hồi bằng tiếng Việt. Dùng nhãn Quản trị viên, Quản lý lớp và Học viên nhất quán với workflow v2.

## Color Tokens

Primary Navy: #0B1F3A
Secondary Navy: #153C70
Action Blue: #2563EB
Hover Blue: #1D4ED8
Light Blue: #DBEAFE
Canvas: #F8FAFC
Surface: #FFFFFF
Text Primary: #0F172A
Text Secondary: #64748B
Border: #E2E8F0

Semantic colors:
Success: #16A34A
Warning: #D97706
Danger: #DC2626

Xanh CLB là accent nhận diện, không đồng nhất với semantic Success. Chưa có mã hex xanh CLB chính thức được chốt trong hai tài liệu nghiệp vụ; không tự coi Action Blue hoặc Success là màu thương hiệu đã duyệt. Trong đợt tài liệu giữ token hiện có; khi triển khai nhận diện cần xác nhận hoặc nhận asset/token xanh CLB. Kiểm tra độ tương phản cho chữ, biểu tượng và focus: chữ thường tối thiểu 4.5:1, chữ lớn và thành phần UI tối thiểu 3:1 theo ngữ cảnh WCAG.

Trong đợt Workflows 1/11, người dùng đã chọn teal hiện có làm accent tạm cho hai trang giới thiệu; UI ghi rõ chưa phải token xanh CLB chính thức. Đây không phải thay đổi mã màu thương hiệu trong hai nguồn nghiệp vụ.

## Color Distribution

- 70% white / light surfaces
- 20% navy identity
- 10% accent nhận diện xanh CLB và hành động có chủ đích

Dùng tỷ lệ này cho AppShell. Hai trang giới thiệu công khai có nền navy theo workflow v2.

## Typography

Preferred font: Inter or Geist Sans

Page Heading: 28-32px
Section Heading: 20-24px
Card Heading: 16-18px
Body: 14-16px
Caption: 12-13px

Use a consistent type scale.

## Spacing

Base spacing scale: 4px

Recommended page padding:
Desktop: 24-32px
Tablet: 20-24px
Mobile: 16px

Card padding: 20-24px
Card gap: 16-24px

## Radius

Cards: 12-16px
Buttons: 8-10px
Inputs: 8-10px
Dialogs: 16px

## Shadow

Prefer subtle shadows and soft borders.
Do not use exaggerated floating effects.

## Trang công khai

Hiển thị nội dung và tiêu đề theo [workflow v2](user-workflow-guideline.md). Trang giới thiệu CLB và khóa học có bố cục riêng, đường đến đăng nhập trực tiếp và điều khiển bằng nút/bàn phím tương đương thao tác vuốt. Giữ nội dung và CTA khả dụng ngay, kể cả với reduced motion. Gắn nhãn rõ cho đăng nhập và công cụ mô phỏng.

Giữ nguyên copy CLB/khóa học trong Workflow 1; không tự biến Word/Excel/Powerpoint thành ba lớp cố định. Title CLB dùng xanh CLB, “o365” trắng, “- HUST” xanh CLB trên nền navy. Nút Trước/Tiếp/Đăng nhập hoạt động bằng Tab, Enter/Space; focus có thứ tự và không bị mất sau đổi trang. Không khóa nội dung theo animation, swipe hoặc thời gian chờ. `prefers-reduced-motion` bỏ chuyển động không cần thiết, vẫn hiển thị đủ nội dung và điều khiển.

Tất cả điều khiển tài khoản/clock/dữ liệu demo hiển thị **Chế độ mô phỏng**. Toast không được báo gửi email, upload thật hoặc xác thực thành công với dịch vụ thật.

## Trạng thái theo nguồn dữ liệu

Giữ nhận diện, token và component Next.js hiện có. Ở bản API, dùng nhãn đăng nhập và đổi mật khẩu thật. Giới hạn nhãn “Chế độ mô phỏng” và công cụ demo trong môi trường fixture. Các màn hình đã kết nối có trạng thái tải, rỗng, lỗi, hết phiên và nút thử lại khi phù hợp. Hiển thị thành công sau khi nguồn dữ liệu xác nhận thao tác.

## App Shell

Desktop:
- Navy sidebar, 256px expanded
- Collapsible navigation
- White/light topbar
- Light canvas
- Flexible content region

Mobile:
- Sidebar becomes a drawer
- Compact topbar
- Single-column main content
- Scrollable tables or adapted cards

Điều hướng Manager dùng nhãn **Quản lý lớp** và base `/manager`; danh sách tài khoản Manager ở `/admin/managers`. Duyệt lịch của Admin là entry point riêng, không còn nhãn “Phê duyệt lịch & điểm danh”. MVP có hai progress track và trạng thái Hoàn thành/Chưa hoàn thành; không dùng chứng chỉ làm icon/CTA hoàn thành bắt buộc. Không hiển thị Đã gửi, yêu cầu tự do, Student retake, confirmation 24h hoặc sửa điểm Quiz trong navigation/quick actions MVP.

Drawer có tên truy cập, focus trap, Escape và trả focus về nút mở; đóng khi đi tới route mới hoặc chuyển desktop. Sidebar thu gọn giữ accessible name và `aria-current`. Không sao chép AppShell cho public hoặc focused quiz player; public dùng bố cục phù hợp, khu vực role tiếp tục dùng shell hiện có.

## Components

Shared:
- AppShell
- Sidebar
- PageHeader
- StatCard
- ClassCard
- DataTable
- ProgressCard
- StatusBadge
- EmptyState
- ConfirmationDialog
- ApprovalDialog
- NotificationItem

Use shadcn/ui where appropriate.

## Buttons

Primary:
- Action Blue background
- White text
- Main action of current context

Secondary:
- Neutral surface
- Subtle border

Destructive:
- Danger semantic styling
- Require confirmation for important actions

## Animation

Sidebar: 200-250ms
Page transition: 180-240ms
Hover: 150-180ms
Dialog: 160-220ms
Tab indicator: 150-200ms
Progress animation: 200-250ms, chỉ minh họa giá trị thật từ selector

Prefer opacity and transform animations.

Respect prefers-reduced-motion.

## UX Rules

- Never rely on color alone for status.
- Use labels and icons together where useful.
- Keep primary actions predictable.
- Display meaningful loading and empty states.
- Preserve clear focus indicators.
- Avoid unnecessary decorative motion.

- Form có label liên kết, hint/lỗi theo field; lỗi được thông báo và focus phù hợp. Không chỉ dùng placeholder làm label.
- Button/field/dialog dùng component hiện có; mục tiêu chạm chính khoảng 44px, nhãn tiếng Việt dài không bị cắt mất ý nghĩa.
- Dialog có tiêu đề, mô tả hậu quả, hủy/xác nhận và trạng thái đang xử lý; giữ focus. Table có caption/header và vùng cuộn được nhận biết trên mobile.
- Dùng skeleton khi đang khôi phục mock store; phân biệt rỗng, không có quyền, hết hạn, lỗi storage và lưu thành công. Thao tác lỗi không tạo toast thành công.
- Kiểm tra 320/375px, 768px và 1280/1440px; không dùng animation/trang trí hoặc chart không có thông tin để lấp chỗ trống.
