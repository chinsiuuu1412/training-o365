# Checklist frontend LMS · approved-v2

Đợt quản lý 15/11/2026 có 118 test PASS, 8 nhóm browser fixture và 5 nhóm browser HTTP tổng hợp PASS. Có thêm smoke artifact API mặc định đóng và axe login 375px. Chạy lại trên backend với dữ liệu test trước khi mở deploy.

- [x] Kiểm thử MSSV 9 chữ số/SĐT dạng chuỗi, email không phân biệt hoa thường, trùng MSSV/email và staff null fields.
- [x] Manager mới nhận pending, Manager cũ bị chặn, hai tab tranh suất cuối, full/expired, mốc 599999/600000 ms và decline thứ ba.
- [x] Tái ghi danh tạo enrollment_id/cycle mới, stale remove không tác động cycle mới, lịch sử cũ theo quyền và reload.
- [x] Dashboard/agenda lấy response, network refresh có retry, sai role chặn dữ liệu, API mode không ghi browser store.
- [ ] Chạy lại quyền/validation/cooldown/transaction/session revocation với backend/database thật.

Đối chiếu [đặc tả màn hình](screen-specification.md) và [workflow v2](user-workflow-guideline.md). [Audit](../../../docs/lms-frontend-audit.md) là baseline demo. Báo riêng kết quả frontend với fixture và kết quả backend thật.

## Frontend trước tích hợp

Đợt nền tảng Static/Auth ngày 15/11/2026: 108/108 test, lint/typecheck/static build PASS; 6 nhóm browser fixture dưới /lms-qa + 7 nhóm HTTP tổng hợp nhánh API + 1 nhóm artifact đóng auth PASS, 3 axe scan không violation trong phạm vi đã chạy. Đã thử class/Quiz ID phát sinh sau build và reload, URL cũ, ba role/sai quyền, me/401/network/5xx, logout/change-password và storage rỗng của API. Các checkbox nghiệp vụ bên dưới vẫn là mục tiêu, không được đánh dấu toàn bộ từ kết quả auth. Cần kiểm chứng lại mọi bảo đảm cookie/CSRF/session và quyền với backend thật.

- [ ] Fixture đi qua cùng lớp xử lý DTO và lỗi với API thật. Bao phủ null, ID số, cờ 0/1, phân trang, loading/empty, lỗi mạng, 401, thiếu quyền và lớp hết hạn.
- [ ] Test validation hồ sơ theo contract. Kiểm tra ba role, mở URL sai quyền, class/quiz ID tạo sau build và reload trang tĩnh.
- [ ] Thử cooldown, giới hạn decline, đầy lớp và tái ghi danh. Lịch cũ giữ khi đề xuất sửa pending/reject. Attendance hiển thị sai mã 422 theo remaining_attempts và lịch sử override đúng quyền.
- [ ] Thử Test trước/đúng 2/3, cutoff sớm, Assignment hết lượt, reload khi đang làm, draft revision conflict, retry start/submit cùng key và grant với hạn hiệu lực khác nhau. Student không nhận correctness trong view dữ liệu.
- [ ] Thử Progress/Completed với lý do thiếu điều kiện, Inbox dùng thao tác đọc/chưa đọc rõ ràng và phân trang người nhận, Library HTTPS hết hạn và gỡ có lý do ở cả hai vai trò staff.
- [ ] Điều hướng, quick actions và trực tiếp URL không mở chức năng SAU MVP. Bản deploy không phát hành fixture, màn hình tạm hoặc hành vi thành công giả.
- [ ] Chạy lint, typecheck, test và static build theo package.json. Smoke browser với fixture trên desktop/mobile, kiểm tra bàn phím, focus, reload, deep link và assets. Báo ca chưa chạy.

## Nghiệm thu sau khi backend sẵn sàng

- [ ] Xác nhận hostname, nguồn Pages và reverse proxy cùng origin. Login cả ba role, reload + /auth/me, kiểm tra cookie, CSRF, logout/đổi mật khẩu, lỗi mạng và phiên hết hạn.
- [ ] Thử các luồng nghiệp vụ bằng dữ liệu test, kiểm tra lưu lại sau reload, quyền/ownership, clock server, quiz revision/retry và kết quả khi thao tác thật. Mở từng luồng trên bản deploy sau khi qua kiểm chứng.
