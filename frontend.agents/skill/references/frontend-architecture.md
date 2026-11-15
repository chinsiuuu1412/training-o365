# Kiến trúc frontend LMS · approved-v2

Giữ Next.js App Router, TypeScript, AppShell và component hiện có. Đọc package.json để lấy lệnh. [Đặc tả màn hình](screen-specification.md) mô tả thao tác cần nối theo từng vai trò.

## Dữ liệu và phiên

- UI gọi qua lớp dữ liệu có kiểu rõ ràng. Lớp này gọi /api/v1, giải envelope data/error và ánh xạ DTO thay vì để màn hình đọc kho mock toàn cục. Xử lý snake_case, null, cờ 0/1 và phân trang. Giữ nguyên ý nghĩa ID. User.student_id là MSSV chuỗi, còn student_id trong enrollment/attempt là ID tài khoản số. enrollment_id xác định cycle hiện hành.
- Cookie lms_session do backend cấp và browser quản lý. Lấy CSRF từ login hoặc /auth/me, giữ trong bộ nhớ, gửi X-CSRF-Token khi contract yêu cầu. Gửi JSON cho mọi thao tác ghi kể cả DELETE, dùng {} nếu endpoint yêu cầu body rỗng. Dùng 401 đã xác nhận để kết thúc phiên. Với lỗi mạng hoặc 5xx khi khôi phục, hiển thị trạng thái có thể thử lại. Không lưu mật khẩu, session token hoặc CSRF vào browser storage.
- Sau ghi thành công, đọc lại hoặc làm mới dữ liệu liên quan. Với lỗi mạng mà chưa biết thao tác đã ghi hay chưa, đọc lại trước khi gửi lại, nhất là grant và announcement. Dùng mã lỗi và details từ contract khi có.
- Fixture dev/test dùng cùng request/response và adapter với API thật. Mô phỏng quyền, thời gian, lỗi và dữ liệu tổng hợp. Cô lập fixture và control demo khỏi bản deploy. Chế độ API báo lỗi đúng khi kết nối thất bại. Giữ ngoài điều hướng các luồng chưa được kiểm chứng trên backend.

## Quiz và dữ liệu phụ thuộc thời gian

- Student detail chỉ nhận metadata. Dùng start/recovery để lấy Runner, phân biệt Result đã nộp. Bản ghi Student không có đáp án đúng, review là null.
- Draft lưu toàn bộ tập đáp án với enrollment_id và expected_revision. Đợi xác nhận revision rồi submit revision đã lưu, body submit không có answers. Xử lý xung đột bằng đọc lại và hòa giải thay đổi. UUID Idempotency-Key dùng cho start/submit và giữ nguyên khi thử lại cùng thao tác. Không dùng lại key sang cycle khác.
- Hiển thị đồng hồ theo mốc server/API trả về. Test nộp tay từ đúng 2/3 thời lượng. Cutoff là mốc được lưu tại start; grant không nới cutoff đang chạy. Lấy kết quả tự nộp từ backend hoặc fixture tương ứng. Backend là nguồn cho Progress, Completed và lý do chưa hoàn thành.

## Build và deploy

### Trạng thái đợt nền tảng Static/Auth (15/11/2026)

Đã có client/dto/auth cùng accounts/classes/enrollments/dashboard/sessions/quizzes/progress/messages/materials trong `src/lib/api`. Root cấp AuthProvider và ApiDataProvider theo phiên/role. UI gọi provider → service → transport, fixture và fetch cùng DTO/error adapter. QuizAttemptController tuần tự hóa lưu/nộp và giữ đáp án cục bộ khi cần đối chiếu. Module mock cũ được giữ để hồi quy riêng.

`next.config.ts` export tĩnh, trailingSlash, base path lúc build. Role/section generateStaticParams theo danh sách vai trò, chi tiết đọc query tại `role-workspace.tsx` với Suspense. `routes.ts` là resolver chung cho canonical query và legacy URLs; custom 404 chuyển client-side cho ID path chưa được export, sau đó SessionGate kiểm tra lại. Không có Next runtime rewrite trên Pages.

Biến build gồm NEXT_PUBLIC_DATA_SOURCE (dev mặc định fixture, build mặc định api), NEXT_PUBLIC_BASE_PATH, NEXT_PUBLIC_AUTH_ENABLED, NEXT_PUBLIC_MANAGEMENT_ENABLED, NEXT_PUBLIC_SCHEDULING_ENABLED, NEXT_PUBLIC_QUIZZES_ENABLED và NEXT_PUBLIC_COMMUNICATIONS_ENABLED. Các cờ tính năng mặc định false đến khi backend được kiểm chứng. Build ghi out/.nojekyll. Import fixture cần điều kiện env tại chỗ để bundler loại code khỏi artifact API, kiểm tra output sau build. URL cũ dùng custom 404 chuyển client-side.

Fixture dùng kho `o365-approved-v2-management-fixture-v4`, version 4, chuyển dữ liệu từ management v1/v2/v3 và giữ kho gốc. Clock browser có mốc epoch để chạy liên tục qua reload/offline, Node test dùng clock cố định. Web Locks tuần tự hóa đọc/ghi có finalization. Password chỉ ở memory, revision phiên được persist. Service phân biệt UserId, RequestId và EnrollmentId, lấy đầy đủ trang request trước khi tính lifetime decline. Sau write refetch mounted resources, lỗi quyền xóa dữ liệu cũ. Backend bảo đảm transaction, quyền, unique constraints, server clock, worker cutoff và lịch sử enrollment_id.

Inbox GET detail không ghi trạng thái đọc; PATCH cập nhật riêng delivery của người nhận. Chọn tất cả duyệt đủ trang recipients/roster, dedup và gửi User ID cụ thể; backend kiểm tra lại toàn bộ audience trong một giao dịch. Library dùng HTTPS, scope lớp/buổi, nullable expiry theo DTO; mở link đọc lại quyền và thời gian, không coi URL ngoài là tài nguyên LMS có thể thu hồi. Cả Admin/Manager gỡ với lý do, audit và feedback. Không dùng upload/Sent/yêu cầu tự do trong MVP. Fixture notifications dùng chung nguồn với unread dashboard/badge, giữ riêng trạng thái đọc từng người.

- Static export cho GitHub Pages. Next server rewrites/proxy chỉ có thể hỗ trợ môi trường có runtime phù hợp. Bản Pages dùng reverse proxy do nhóm cấu hình tại hostname LMS để phục vụ UI và /api/v1 cùng origin. SITE_ORIGIN phải khớp origin người dùng mở. Chốt hostname và URL nguồn Pages ở đợt nghiệm thu.
- Prerender các trang có đường dẫn biết trước. ID lớp/quiz phát sinh sau build được đọc ở trình duyệt từ URL của trang tĩnh, ví dụ query string. Kiểm tra deep link, reload, đường dẫn assets và base path của cấu hình thực tế. Dữ liệu riêng lấy sau khi có phiên ở runtime.
