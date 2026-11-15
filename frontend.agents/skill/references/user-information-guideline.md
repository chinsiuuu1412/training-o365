---
name: user-information-guideline
description: Thông tin tài khoản của CLB o365 HUST - Khóa học Kĩ năng mềm
version: 1
updated: 2026-11-14
---

# User-information — CLB o365 HUST

Tài liệu này bổ sung cho `user-workflow-guideline.md` phiên bản 2. Phạm vi đã được người dùng xác nhận; không coi các field đã có trong frontend/API cũ là đã đủ cho bộ thông tin mới.

## 1. Đăng nhập và cấp phát

- Người dùng đăng nhập bằng email đã được Admin cấp tài khoản và mật khẩu được cấp phát; không tự đăng ký tài khoản công khai.
- Student bắt buộc email có domain `sis.hust.edu.vn`, so sánh không phân biệt hoa thường. Không chấp nhận domain gần giống hoặc subdomain khác thay cho domain này.
- Admin/Manager chỉ cần email hợp lệ, không bắt buộc domain HUST. Email là duy nhất giữa các tài khoản, so sánh không phân biệt hoa thường.
- Admin tạo/cấp hoặc reset mật khẩu; người phụ trách gửi **thủ công** tới email đã đăng ký. Email Student là email HUST. Không có mailer tự động trong MVP.
- Có login/logout/đổi mật khẩu. Quên mật khẩu trong MVP: liên hệ Admin reset; khôi phục tự phục vụ qua email là sau MVP.
- Theo baseline kỹ thuật, mật khẩu 12–72 UTF-8 bytes, không ép composition; chỉ lưu hash. Không log, lưu plaintext hoặc đưa password/JWT vào localStorage; không cung cấp API đọc lại plaintext của mật khẩu cũ.
- Đổi/reset mật khẩu hoặc vô hiệu hóa phải thu hồi hiệu lực phiên cũ. Không tự bổ sung chức năng đăng ký tự do/SSO chỉ vì dùng email HUST.

## 2. Thông tin Student

| Thông tin | Bắt buộc | Ý nghĩa và quy tắc đã chốt |
|---|---|---|
| Họ và tên | Có | Họ tên Student, không để trống sau trim. |
| Giới tính | Không | Tùy chọn; không suy đoán từ họ tên/MSSV. Không có danh mục giá trị bắt buộc được chốt trong workflow này. |
| MSSV | Có | Mã số sinh viên, lưu **dạng chuỗi**, giữ số 0 đầu; không cho hai tài khoản Student trùng MSSV. Không tự ép định dạng số/cố định độ dài chưa được yêu cầu. |
| Trường | Có | **Trường/Viện đào tạo trực thuộc HUST**, nhập dưới dạng văn bản; không phải field mặc định “Đại học Bách khoa Hà Nội”. Chưa yêu cầu danh mục Trường/Viện hoặc tích hợp tra cứu ngoài. |
| Lớp - Khóa (ở Đại học) | Có | Thông tin lớp/khóa sinh viên tại đại học; không đồng nhất với lớp LMS hoặc dùng field này để cấp quyền enrollment. |
| Sđth / Số điện thoại | Có | Lưu dạng chuỗi để giữ số 0 đầu/ký hiệu số; không thay thế email làm định danh đăng nhập. |
| Email | Có | Email hợp lệ, domain chính xác `@sis.hust.edu.vn`, kiểm tra không phân biệt hoa thường, không trùng tài khoản khác. |

Khi tạo/sửa, báo lỗi field cụ thể cho Admin nếu thiếu/trùng/sai domain. Không tự tạo MSSV, Trường/Viện hoặc số điện thoại giả để lấp field bắt buộc của tài khoản thật.

## 3. Vai trò và quyền sửa

- MVP Admin quản lý Student và Manager. Manager/Admin có họ tên, email hợp lệ và thông tin cấp phát; không mặc định áp yêu cầu MSSV/domain Student lên hai role này.
- Student được xem thông tin của mình và đổi mật khẩu; tự sửa hồ sơ ở giai đoạn sau. MVP Admin thực hiện sửa thông tin tài khoản.
- Manager chỉ được thấy thông tin Student trong phạm vi lớp được phân công, phục vụ quản lý học tập; không có directory toàn hệ thống cho Student/Manager ngoài quyền.
- Vô hiệu hóa cần lý do; giữ dữ liệu học tập/enrollment, khóa thao tác của tài khoản. Xóa khỏi lớp là thao tác khác với vô hiệu hóa.
- Theo quyết định giữ demo, Admin được suspend Manager còn phụ trách lớp; không xóa phân công/dữ liệu. Admin đổi Manager riêng nếu cần.

## 4. Sau MVP

Tự sửa hồ sơ; mailer cấp/reset và quên mật khẩu qua email xác thực; quản lý thêm tài khoản Admin/đổi role với guard phù hợp; đồng bộ hệ thống đăng ký bên ngoài; danh mục thông tin chuẩn hóa nếu tổ chức cung cấp.

## 5. Ảnh hưởng API/database

- DTO `User` hiện trong ba tài liệu teammates chưa có MSSV, giới tính, Trường/Viện, Lớp - Khóa và phone đầy đủ. Cần bổ sung schema, create/update payload, responses, validation và scope trả field theo quyền.
- Không gửi các field mới vào endpoint đang reject unknown JSON fields rồi coi lỗi là đã lưu thành công.
- Có unique email không phân biệt hoa thường và unique MSSV của Student; MSSV/phone là text, không numeric ID.
- Phân biệt internal user ID, MSSV, lớp/khóa đại học, class ID/mã lớp LMS và enrollment cycle ID. Không dùng chúng thay thế nhau.
