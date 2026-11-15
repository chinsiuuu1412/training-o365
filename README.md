# LMS demo_frontend_v1 - CLB o365 - HUST

**Người phụ trách:** Ánh Ngọc
demo frontend: version 1
updated: 15/11/2026

## Các công nghệ sử dụng

Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, Radix UI và Recharts. Frontend xuất tĩnh và dùng chung client HTTP cho API và fixture.

## Giới thiệu về các tính năng

- Trang giới thiệu CLB, khóa học, đăng nhập và dashboard cho Quản trị viên, Quản lý lớp và Học viên.
- Quản lý tài khoản, lớp, ghi danh và lịch học. Học viên điểm danh bằng mã hoặc xin nghỉ. Quản lý lớp có thể điều chỉnh điểm danh kèm lý do.
- Test và Assignment trắc nghiệm có lưu bài, chấm điểm và cấp thêm lượt. Học viên theo dõi tiến độ và trạng thái hoàn thành.
- Hộp thư trong LMS và thư viện liên kết học liệu theo lớp hoặc buổi học.

## Các tài liệu tham khảo

- [User Workflow](frontend.agents/skill/references/user-workflow-guideline.md) mô tả luồng, phân quyền và phạm vi MVP.
- [User Information](frontend.agents/skill/references/user-information-guideline.md) quy định trường dữ liệu tài khoản.
- [Báo cáo audit](docs/lms-frontend-audit.md) ghi lại các đợt kiểm thử và giới hạn.

## Kết quả chạy kiểm thử

`npm test` dùng Node.js Test Runner để chạy kiểm thử nghiệp vụ và client HTTP với fixture. Kết quả **148/148 đạt**. ESLint và TypeScript đạt.

## Tình trạng bản demo hiện tại

Chạy `npm ci` rồi `npm run dev` với Node.js 22.16 trở lên. Dev mặc định dùng tài khoản và dữ liệu mẫu. Bản xuất tĩnh dùng chế độ API mặc định với các cờ tính năng đang tắt. Backend/DB thật còn chờ nghiệm thu.
