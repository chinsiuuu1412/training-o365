---
name: lms-frontend
description: Use when implementing or reviewing the CLB o365 HUST Next.js frontend against the approved-v2 API contract, including fixture-based development and later browser integration.
---

# LMS Frontend · CLB o365 HUST

## Nguồn và phạm vi

- [Workflow v2](references/user-workflow-guideline.md) quy định luồng nghiệp vụ và phạm vi MVP/SAU MVP. [User information](references/user-information-guideline.md) bổ sung ý nghĩa các trường hồ sơ.
- Dùng bộ tài liệu backend approved-v2 do nhóm cung cấp, ưu tiên API_DEFINITIONS và API_REQUEST_RESPONSE_EX cho request, response và lỗi. FRONTEND_SURFACE_CONTRACT, FRONTEND_VIDEO_INTEGRATION, ARCHITECTURE, DECISIONS, FEATURES và DEPLOYMENT bổ sung cách tích hợp và giới hạn. Áp dụng các quyết định mới đã chốt về hồ sơ Student và grant Assignment trong đặc tả màn hình.
- [Audit frontend](../../docs/lms-frontend-audit.md) dùng để tìm route, component và baseline demo. Hướng dẫn Vite trong handoff mô tả frontend khác. Repo này dùng Next.js App Router và lệnh trong package.json.

Hoàn thành frontend theo contract trước khi backend sẵn sàng. Dùng fixture tổng hợp đúng hình dạng API trong dev/test. Bản deploy dùng API thật và chỉ mở các luồng đã được kiểm chứng với backend. Giữ hostname triển khai dưới dạng cấu hình. Nghiệm thu cookie, CSRF, quyền và lưu dữ liệu thật ở đợt sau.

## Cách triển khai

1. Đối chiếu mỗi màn hình và thao tác với role, scope, endpoint, DTO, lỗi và ca kiểm thử. Đọc code và script repo trước khi chọn file thay đổi.
2. Giữ nhận diện tiếng Việt, AppShell, shared components và route vai trò. Ánh xạ role API class_manager thành manager tại lớp dữ liệu. Giữ lịch sử theo enrollment_id.
3. Dùng cùng đường đi UI và adapter cho fixture dev/test và API thật. Backend quyết định phiên, thời gian, quyền, điểm và kết quả ghi. Hiển thị lỗi hoặc trạng thái chưa khả dụng khi API chưa nối hoặc lỗi.
4. Chuẩn bị static export cho GitHub Pages. Các trang chi tiết phải mở được ID tạo sau build. Gọi /api/v1 theo đường dẫn tương đối. Reverse proxy và SITE_ORIGIN được xác nhận khi có hostname.
5. Chạy test hành vi đã đổi, lint, typecheck, static build và browser smoke với fixture. Báo rõ ca đã chạy và danh sách ca cần backend thật.

## References

- [Design system](references/design-system.md) cho nhận diện và component.
- [Đặc tả màn hình](references/screen-specification.md) cho quyền, route, trạng thái và API theo luồng.
- [Kiến trúc frontend](references/frontend-architecture.md) cho fixture, DTO, state và static export.
- [Checklist QA](references/ux-quality-checklist.md) cho kiểm thử frontend và bàn giao nghiệm thu.
