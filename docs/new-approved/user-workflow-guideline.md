---
name: user-workflow-guideline
description: Workflow và phạm vi MVP của CLB o365 HUST - Khóa học Kĩ năng mềm
version: 2
status: approved-product-workflow
updated: 2026-11-14
---

# CLB o365 HUST - Khóa học Kĩ năng mềm — User Workflow

## 1. Mục tiêu, nguồn quyết định và cách đọc

Khóa học do **CLB o365 - HUST tổ chức và quản lí**, giúp sinh viên thực hành bộ công cụ Microsoft cơ bản: Word, Excel và Powerpoint. Tên sản phẩm: **CLB o365 HUST - Khóa học Kĩ năng mềm**. Giao diện bằng tiếng Việt; tone chủ đạo theo CLB là **xanh navy - trắng**, sử dụng màu xanh CLB làm điểm nhấn.

Tài liệu này kết hợp workflow cũ, các đề xuất trong `API_DEFINITIONS.md`, `ARCHITECTURE.md`, `DECISIONS.md` và các quyết định người dùng/nhóm đã xác nhận ngày 14/11/2026. Quyết định mới được xác nhận có ưu tiên hơn quy tắc cũ mâu thuẫn với nó. Không coi câu “approved/single source of truth” trong một file kỹ thuật là quyền tự thay đổi nghiệp vụ.

Phạm vi được ghi bằng hai nhãn:

- **[MVP]**: bắt buộc cho bản demo MVP end-to-end. Luồng thực sự chạy qua backend/database với dữ liệu mẫu; không dùng localStorage làm database thật hoặc báo thành công mock thay cho thao tác API chưa có.
- **[SAU MVP]**: tính năng vẫn được giữ trong danh sách sản phẩm nhưng không chặn nghiệm thu MVP 6 ngày. Chỉ mở rộng sau khi thiết kế, quyền và API tương ứng được thống nhất; không tự bật vì “còn thời gian” nếu làm thay đổi luồng đã chốt.

“Chọn demo” trong các quyết định là chọn **quy tắc nghiệp vụ của demo hiện tại**, không phải chọn triển khai chỉ bằng dữ liệu giả ở frontend. Tài liệu mô tả yêu cầu, không khẳng định frontend/backend đã đáp ứng bản mới.

Vai trò: **Admin — Quản trị viên**, **Manager — Quản lý lớp** (tương ứng Teacher trong demo cũ), **Student — Học viên**. Một Manager được phụ trách nhiều lớp. Hệ thống xác định role, phạm vi lớp và người thao tác từ phiên đăng nhập phía server.

## 2. Ma trận phạm vi sản phẩm

| Nhóm tính năng | MVP bắt buộc | Bổ sung sau MVP |
|---|---|---|
| Trang công khai | Giới thiệu CLB → giới thiệu khóa học → đăng nhập; đi thẳng đến đăng nhập. | Hoàn thiện nội dung/nhận diện và hiệu ứng nâng cao theo tài sản thương hiệu được cung cấp. |
| Tài khoản | Admin cấp/quản lý Student, Manager; đăng nhập/đăng xuất/đổi/reset mật khẩu; gửi mật khẩu thủ công qua email đã đăng ký. | Mailer cấp/reset tự động; quên mật khẩu tự phục vụ qua email; quản lý tài khoản Admin; tích hợp hệ thống đăng ký bên ngoài. |
| Hồ sơ | Admin nhập/sửa bộ thông tin Student; Student xem thông tin tài khoản. | Student/Manager tự sửa hồ sơ. |
| Lớp học | Tạo/sửa tên, mã, mô tả, Manager, sĩ số, ngày hết hạn, ngưỡng hoàn thành; Manager đặt số buổi cố định. | Manual archive/unarchive, quy trình dọn dữ liệu và retention. |
| Đăng ký | Student tìm lớp, gửi/hủy yêu cầu, Manager duyệt/từ chối; cooldown và giới hạn decline; tái ghi danh theo cycle riêng. | Staff mời Student vào lớp; Student yêu cầu rời lớp có staff duyệt. |
| Lịch | Manager lưu/gửi lịch; Admin duyệt/từ chối có lý do; giữ lịch cũ khi thay đổi còn pending. | Teacher confirm trước 24h; xin nghỉ Manager/lịch bù và các quyết định riêng; cảnh báo/can thiệp trước 12h; Admin sửa lịch trực tiếp và xử lý supersede nâng cao. |
| Attendance | Mã trong thời gian buổi được duyệt; tối đa ba lần sai; Manager override trực tiếp có lý do/lịch sử; xin nghỉ một buổi tự duyệt, không được Attendance. | Liên kết Quiz cuối buổi làm điều kiện Attendance; selfie/proof, R2/presigned upload; xoay mã/TTL tùy chỉnh. |
| Video makeup | Link video dùng làm tài liệu tham khảo, không cấp điểm Attendance từ lượt xem. | Theo dõi ≥90% coverage, trusted duration, heartbeat/seek handling; watched_video và review với provider không hỗ trợ. |
| Quiz | Test và Assignment; single-choice; ngưỡng đạt, thời lượng, giờ mở/hạn; draft/preview/publish; player, autosave, recovery và history. | Multi-select, trọng số/dạng câu hỏi khác, metadata editing nâng cao, leaderboard/sort/cache nâng cao, telemetry vi phạm. |
| Làm lại Quiz | Manager cấp thêm lượt cho một Student/cả lớp, có lý do và hạn mới tăng lên. | Student gửi yêu cầu làm lại → Manager duyệt/từ chối. |
| Điều chỉnh kết quả | Manager chỉ được override Attendance; Admin chỉ xem kết quả học tập. | Vô hiệu hóa từng attempt Quiz, lịch sử quyết định và quy trình yêu cầu/duyệt điều chỉnh Quiz. |
| Progress | Hai track Attendance/Quiz riêng, dùng công thức demo, một bài/buổi chỉ đóng góp một lần. | Báo cáo/analytics nâng cao; không tự thay bằng công thức điểm trung bình. |
| Hoàn thành | Completed tự tính sau khi mọi buổi bắt buộc kết thúc và đủ hai ngưỡng; tính lại khi dữ liệu thay đổi. | Chốt kết quả phục vụ chứng chỉ, certificate/snapshot/email, appeal, completion exception, cross-approval/24h, revoke/reissue. |
| Thông báo | In-app inbox; Admin gửi Manager/Student, Manager gửi Student; Student nhận; chỉ báo và thao tác đọc/chưa đọc. | Đã gửi/danh sách người nhận, gửi ngược Student → Manager/Manager → Admin, yêu cầu tự do, email delivery. |
| Library | Link HTTPS Document/Video, chung lớp/theo buổi; quyền xem, hạn tài liệu và thao tác gỡ có phản hồi. | Upload/lưu trữ tệp thật, signed URLs và retention; taxonomy Slide/Link nâng cao. |

Các biến thể **không áp dụng cho MVP**: invitation thay luồng Student gửi yêu cầu; Homework unlimited; tính Quiz progress bằng điểm trung bình; Attendance bằng watched_video; tự chấm 0 chỉ vì chuyển tab; Teacher xác nhận 24h như điều kiện mở buổi; Admin duyệt/xóa điểm trong MVP. Đây không phải những chức năng được tự động cộng vào MVP từ tài liệu cũ.

## 3. Ma trận quyền MVP

| Thao tác | Admin | Manager | Student |
|---|---|---|---|
| Quản lý tài khoản Student/Manager | Có, có lý do khi vô hiệu hóa | Xem thông tin của mình | Xem thông tin của mình |
| Tạo/sửa lớp, đổi Manager, đặt capacity/ngưỡng/hạn | Có | Xem lớp phụ trách | Xem lớp được phép/preview |
| Đặt số buổi cố định, tạo bài học/Quiz/link | Không thay Manager thực hiện nghiệp vụ giảng dạy | Lớp mình phụ trách | Không |
| Duyệt yêu cầu Student vào lớp | Xem, không thay Manager duyệt | Có, lớp mình | Gửi/hủy yêu cầu của mình |
| Xóa Student khỏi lớp | Có, bắt buộc lý do | Có, lớp mình, bắt buộc lý do | Không tự rời trong MVP |
| Phê duyệt lịch | Có | Gửi đề xuất | Xem lịch đã duyệt |
| Ghi Attendance bằng mã | Không | Không thay Student nhập mã | Của mình, đúng cửa sổ |
| Override Attendance | Chỉ xem | Trực tiếp, theo Workflow 4 | Không |
| Tạo/sửa/publish Quiz, cấp lượt | Chỉ xem định nghĩa/kết quả được phép | Có, lớp mình | Làm bài được phép |
| Xóa/vô hiệu hóa kết quả Quiz | Không trong MVP | Không trong MVP | Không |
| Gửi thông báo chủ động | Manager/Student được phép | Student đã enrolled trong lớp mình | Không trong MVP |
| Gỡ link Library | Có, có lý do và phản hồi | Link lớp mình phụ trách | Không |
| Đọc nội dung lớp còn hạn | Có | Lớp được phân công | Enrollment đã được duyệt |
| Lớp hết hạn | Xem lịch sử | Xem lịch sử lớp được phân công | Chỉ trạng thái/lịch sử tổng quát, không nội dung lớp |

“Admin chỉ xem kết quả” áp dụng Attendance/Quiz, không tước quyền Admin quản lý tài khoản/lớp, phê duyệt lịch hoặc kiểm soát Library.

## Workflow 1 — Giới thiệu CLB, khóa học và đăng nhập

### [MVP] Trang 1 — Giới thiệu CLB o365 - HUST

- Title: **CÂU LẠC BỘ** bằng màu xanh CLB; **o365** màu trắng; **- HUST** bằng màu xanh CLB.
- Header: **Đại sứ số học đường Đại học Bách Khoa Hà Nội**.
- Body, theo nội dung người dùng cung cấp:

> Một cộng đồng dành cho sinh viên Bách khoa cùng học hỏi, thực hành và phát triển kỹ năng tin học văn phòng. Tại o365-HUST, chúng mình cùng nhau khám phá công nghệ, chia sẻ kiến thức và tạo nên những giá trị thiết thực.

- Background navy; có chuyển động sống động nhưng không cản trở đọc/đăng nhập. Có reduced-motion; không bắt người dùng chờ animation.
- Vuốt lên để sang trang 2; có đường đi thẳng đến đăng nhập. Desktop/bàn phím có điều khiển tương đương, không bắt buộc thao tác vuốt.

### [MVP] Trang 2 — Giới thiệu khóa học

- Title: **Khóa học Kĩ năng mềm**.
- Body:

> CLB o365 - HUST hân hạnh giới thiệu khóa học Kĩ năng mềm về bộ công cụ Microsoft cơ bản, được thiết kế đặc biệt dành riêng cho các bạn sinh viên. Khóa học nhằm mục đích giúp sinh viên nắm vững và sử dụng thành thạo các tính năng cơ bản của bộ công cụ Microsoft (bao gồm Word, Excel, Powerpoint), hỗ trợ đắc lực trong học tập và các hoạt động ngoại khóa

- Background và chuyển động đồng bộ trang 1.
- Vuốt lên sang trang 3; vuốt xuống về trang 1; có nút điều hướng/bàn phím tương đương và đường đi đến đăng nhập.
- Không tự suy ra Word/Excel/Powerpoint là ba lớp riêng: cấu trúc và tên lớp do Admin cấu hình.

### [MVP] Trang 3 — Đăng nhập

- Đăng nhập bằng email đã được cấp tài khoản và mật khẩu được cấp phát; không tự đăng ký tài khoản công khai.
- Student bắt buộc email kết thúc chính xác bằng `@sis.hust.edu.vn`, không phân biệt hoa thường. Admin/Manager dùng email hợp lệ, không bắt buộc domain này.
- Admin cấp/reset mật khẩu; người phụ trách gửi **thủ công** đến email đã đăng ký. Với Student đây là email HUST. MVP không tự gửi email.
- Nếu quên mật khẩu, người dùng liên hệ Admin để reset; đây không phải luồng email xác thực tự phục vụ.
- Sai tài khoản hoặc mật khẩu nhận thông báo chung, không tiết lộ riêng việc email có tồn tại.
- Sau đăng nhập, vào dashboard đúng vai trò; được đăng xuất và đổi mật khẩu của mình. Đổi/reset mật khẩu hoặc vô hiệu hóa làm mất hiệu lực phiên cũ.
- Không có bộ chuyển role/account/time giả trong chế độ API thật. Có thể giữ một mock mode riêng, gắn nhãn rõ, phục vụ phát triển.

### [SAU MVP]

Tự phục vụ quên mật khẩu qua email xác thực; mailer cấp/reset tự động; đồng bộ tài khoản từ hệ thống đăng ký bên ngoài. Không coi Admin reset là đã hoàn thành email-reset flow.

## Workflow 2 — Tạo và quản lý lớp

### [MVP] Admin

- Tạo/sửa tên, mã lớp, mô tả giảng dạy, Manager phụ trách, giới hạn sĩ số, ngày hết hạn và hai ngưỡng Attendance/Quiz từ 0–100%.
- Một Manager được phân công nhiều lớp. Chọn Manager đang hoạt động khi phân công mới.
- Theo dõi giảng dạy, roster, hai track progress của lớp và từng Student; dữ liệu lấy từ cùng nguồn đã lưu, không đặt số liệu riêng ở dashboard.
- Đổi Manager bắt buộc lý do và xác nhận. Có hiệu lực ngay: Manager mới nhận quyền của lớp/yêu cầu đang chờ; Manager cũ mất quyền quản lý. Không xóa tài liệu, enrollment hoặc kết quả.
- Không hạ capacity dưới số enrollment đã được duyệt; pending requests chưa chiếm chỗ. Kiểm tra lại capacity trong transaction khi duyệt.

### [MVP] Manager

- Sau khi được phân công, thiết lập tổng số buổi bắt buộc cố định, là số nguyên dương. Chỉ thiết lập một lần trong MVP; không tự tăng/giảm mẫu số để làm đẹp progress.
- Tạo nội dung/lịch cho các buổi nằm trong số buổi cố định; không tính một lần đổi lịch thành một buổi bắt buộc mới.
- Theo dõi roster/progress, quản lý bài học, Quiz và link tài liệu trong lớp mình.
- Được xóa Student khỏi lớp kèm lý do; không đồng nghĩa vô hiệu hóa tài khoản.

### [MVP] Lớp hết hạn

- Ngày hết hạn được hiểu theo ngày tại Việt Nam; UI và backend thống nhất ranh giới cuối ngày, không vô tình hết hạn từ đầu ngày. Nếu wire dùng UTC RFC3339, chuyển đổi rõ theo `Asia/Ho_Chi_Minh`.
- Lớp hết hạn không xuất hiện trong tìm lớp mới, không nhận đăng ký/duyệt vào lớp, không mở thêm bài/điểm danh hoặc tạo thay đổi giảng dạy mới.
- Manager được phân công và Admin vẫn xem lịch sử. Student chỉ xem tổng quát lần ghi danh/trạng thái hoàn thành của mình, không vào nội dung lớp/Quiz/lesson/material.
- Không xóa tự động dữ liệu học tập khi lớp hết hạn. Việc giữ lịch sử không đồng nghĩa cho phép sửa điểm sau hết hạn trong MVP.

### [SAU MVP]

Manual archive/unarchive; quy trình xác nhận đã xử lý hết các trường hợp để dọn dữ liệu; retention được tổ chức phê duyệt, bảo toàn kết quả/chứng chỉ/lịch sử. Không tự xóa academic records chỉ vì đã quá `end_date`.

## Workflow 3 — Tìm lớp, đăng ký và lần ghi danh

### [MVP] Student

1. Dashboard/Lớp đã đăng ký hiển thị enrollment được duyệt; tìm/lọc lớp theo tên, mã hoặc Manager.
2. Find Classes cho xem preview: tên, Manager, mô tả, sĩ số/capacity, tiến độ giảng dạy, ngày hết hạn và lịch đã duyệt sắp tới nếu có.
3. Lớp đã tham gia hiện Đã đăng ký; lớp chưa tham gia có Gửi yêu cầu, phải nhập lý do và xác nhận.
4. Pending/Chờ duyệt: không gửi trùng; chưa được truy cập nội dung lớp. Student được hủy pending; hủy không tiêu hao số lần decline và được gửi lại ngay nếu còn đủ điều kiện.
5. Manager decline phải có lý do. Student thấy lý do, chờ đủ 10 phút, gửi lý do mới khác lần bị từ chối; tối đa 3 lần bị decline, tính cả lần decline đầu tiên. Giữ cách đếm theo cặp Student–lớp của demo; không tự reset counter/cooldown khi hủy yêu cầu.
6. Lớp full không có thao tác gửi yêu cầu mới; lớp hết hạn không xuất hiện trên Find Classes. Backend kiểm tra lại khi gửi và khi duyệt, không chỉ khóa nút frontend.

### [MVP] Manager duyệt

- Chỉ Manager hiện được phân công có quyền approve/decline yêu cầu lớp đó.
- Approve kiểm tra trạng thái request, Student và capacity/lớp còn hạn. Student nhận thông báo, được truy cập lớp/link/lịch; progress khởi đầu bằng 0.
- Decline ghi lý do và thông báo. Request đã xử lý không được quyết định lần hai; staff cũ mất quyền sau đổi Manager.

### [MVP] Xóa khỏi lớp và tái ghi danh

- Admin/Manager có quyền xóa Student kèm lý do. Student mất quyền nội dung; tài khoản và dữ liệu lịch sử không bị xóa.
- Cho phép gửi đăng ký lại sau khi bị xóa nếu còn đủ điều kiện đăng ký. Khi được duyệt tạo **lần ghi danh mới**, Attendance/Quiz lần mới từ 0.
- Giữ các bản ghi cũ theo lần ghi danh; không DELETE attendance/attempts cũ để reset. Không cộng điểm/attempt/grant của lần cũ vào lần mới.
- Các ghi nhận đang kết thúc của lần cũ không được cập nhật nhầm vào lần mới. Student xem lịch sử tổng quát của mình; Manager/Admin xem lịch sử được phép.

### [SAU MVP]

Staff invitation + Student accept/decline; candidate directory nâng cao. Student gửi yêu cầu rời hẳn lớp có lý do → Manager/Admin approve/decline; giữ enrollment tới khi được approve. **Rời lớp không phải xin nghỉ một buổi.**

## Workflow 4 — Bài học, Attendance và xin nghỉ buổi

### [MVP] Chuẩn bị buổi học

- Manager chọn lớp và buổi cố định, nhập tiêu đề/mô tả, thời gian, link/địa điểm nếu có; gắn các link tài liệu thuộc cùng lớp và thiết lập mã điểm danh.
- Buổi được Admin duyệt theo Workflow 5 mới có hiệu lực. Không còn bước Teacher-confirm riêng trong MVP.
- Mã chỉ hợp lệ từ giờ bắt đầu đến trước giờ kết thúc của buổi được duyệt; không dựa vào clock hoặc trạng thái do client tự gửi.

### [MVP] Student điểm danh

- Student phải có enrollment hiện hành được duyệt, tài khoản hoạt động và lớp còn hạn.
- Hiển thị rõ mã đang nhập để tự soát. Đúng mã trong cửa sổ hợp lệ → ghi Attendance và phản hồi Đã điểm danh thành công; không cần ảnh, pass Quiz hay review thường lệ.
- Một Student chỉ có một credit cho một buổi trong một lần ghi danh. Retry request không tạo credit thứ hai; sau thành công ẩn/khóa ô nhập mã.
- Tối đa ba lần nhập sai trong buổi/lần ghi danh, lưu server để reload/đổi tab không reset. Hiển thị số lượt còn lại; đủ ba sai khóa nhập, liên hệ Manager xác minh.
- Không nhập mã và không được Manager ghi nhận thủ công thì không có Attendance. Attendance và Quiz là hai tiêu chí độc lập.

### [MVP] Manager override trực tiếp

- Chỉ Manager đang phụ trách được đặt attended/không được ghi nhận Attendance, bắt buộc lý do; Admin chỉ xem, không duyệt hoặc xóa điểm.
- Chỉ áp dụng buổi đã được duyệt **từ giờ bắt đầu trở đi**, kể cả buổi đã kết thúc, và lớp còn hạn. Không ghi điểm danh trước buổi tương lai.
- Cho phép ghi nhận sau xác minh kể cả Student đã sai mã ba lần. Giữ lịch sử người thao tác, thời điểm, giá trị trước/sau và lý do.
- Override là quyết định có thẩm quyền: nhập lại mã không được ghi đè. Sau khi Manager bỏ credit, Student không tự lấy lại bằng mã; muốn khôi phục phải có Manager override tiếp theo.
- Credit thực tế đổi → progress/Completed tính lại. Không dùng quy trình Teacher đề nghị/Admin phê duyệt Attendance cũ trong MVP.

### [MVP] Student xin nghỉ một buổi

- Student chọn buổi đã được duyệt còn chưa kết thúc, nhập lý do; hệ thống tự duyệt nghỉ và gửi lý do cho Manager.
- Xin nghỉ không cấp Attendance, không phải rời lớp; Quiz vẫn được làm/tính riêng theo thời hạn và điểm đạt.
- Đã điểm danh thành công thì không gửi đơn nghỉ cho cùng buổi. Yêu cầu nghỉ không phải một cách xóa bản ghi Attendance hiện tại.

### [SAU MVP]

- Liên kết Quiz cuối buổi làm điều kiện điểm danh; ảnh selfie minh chứng, presigned upload/GET, review ảnh và các trạng thái prerequisite/awaiting_approval.
- Sinh lại/thu hồi mã, TTL tùy chỉnh ngoài quy tắc cửa sổ MVP.
- Video makeup: supported provider có trusted duration, ≥90% distinct coverage + linked quiz; xử lý seek/heartbeat, watched_video và review fallback cho provider không hỗ trợ/no quiz.
- Link video tham khảo trong MVP **không** có nghĩa đã chứng minh xem đủ video hoặc được credit Attendance.

## Workflow 5 — Đề xuất và phê duyệt lịch

### [MVP]

1. Manager lưu bản nháp, xem lại và gửi đề xuất ngày/giờ cụ thể theo Việt Nam cho Admin; chỉ một đề xuất pending cho một buổi.
2. Admin xem chi tiết, approve hoặc reject; reject bắt buộc ghi lý do để Manager sửa và gửi lại.
3. Lịch được approve có hiệu lực và Student nhìn thấy; có thông báo trong hệ thống. Không yêu cầu Manager xác nhận trước 24 giờ để mở Attendance.
4. Khi đề xuất sửa lịch đã duyệt còn pending, lịch cũ vẫn chính thức; không thay ngày/giờ hiện hành bằng dữ liệu nháp.
5. Reject giữ lịch đã duyệt trước đó. Approve cập nhật lịch, dùng cùng buổi cố định, không tăng tổng số buổi.
6. Không đổi lịch một buổi đang diễn ra/đã kết thúc bằng quy trình chỉnh draft MVP; lịch sử buổi đã học không bị âm thầm thay thế.

### [SAU MVP]

Xác nhận trước 24 giờ; Manager xin nghỉ kèm lịch bù; Admin duyệt nghỉ và lịch bù riêng; thông báo trước 24h/12h; xử lý Manager không xác nhận; đổi Manager/hủy và lập lịch bù; Admin direct edit/supersede và audit nâng cao. Khi phát triển các mục này phải bổ sung state/API, không coi chúng đã tồn tại trong MVP.

## Workflow 6 — Quiz Test

### [MVP] Manager tạo bài

- Chọn lớp; nhập tiêu đề, câu hỏi single-choice với ít nhất hai lựa chọn và đúng một đáp án; mỗi câu trọng số bằng nhau.
- Cấu hình pass score 0–100%, thời lượng dương, giờ mở và hạn kết thúc; hạn sau giờ mở. Có draft, validation và preview trước publish.
- Test có một lượt mặc định cho mỗi Student/lần ghi danh; mở thêm theo mục bên dưới.
- Sau attempt đầu tiên khóa nội dung/cách chấm, pass score và thời lượng. Không thay nội dung để chấm lại lịch sử. Việc cấp lượt/hạn mới dùng grant riêng.

### [MVP] Student làm Test

- Chỉ bắt đầu khi bài đã publish, tới giờ mở, chưa tới hạn, lớp/enrollment/tài khoản hợp lệ và còn lượt. Có xác nhận bắt đầu, navigator, chọn đáp án và timer.
- Đồng hồ do server kiểm soát, chạy liên tục khi chuyển tab, mất mạng hoặc reload; quay lại khôi phục cùng attempt và các đáp án server đã lưu.
- **Cho nộp thủ công khi elapsed time ≥ 2/3 thời lượng cấu hình.** Trước đó từ chối nộp sớm.
- Cutoff = thời điểm sớm hơn giữa `started_at + duration` và deadline hiệu lực của attempt. Khi tới cutoff tự nộp đáp án server đã lưu, kể cả cutoff xảy ra trước mốc 2/3; không có grace period hoặc sửa đáp án sau cutoff.
- Không tự chấm 0 vì visibility, blur, offline, reload hay tắt màn hình. Frontend được cảnh báo; telemetry/gian lận không phải bằng chứng chắc chắn. Công cụ mô phỏng không được sửa điểm thật.
- Nộp xong chỉ thấy điểm/Đạt–Chưa đạt, không công bố đáp án đúng. Best valid score được giữ; lượt sau thấp hơn không xóa kết quả cao hơn.
- Lưu attempts riêng; start/submit retry không tạo lượt hay điểm trùng. Server finalizes/recovery vẫn bảo toàn lượt đã bắt đầu khi client không còn quyền mở nội dung; không nhận đáp án mới sau khi quyền bị thu hồi.

### [MVP] Manager mở lại

- Có thể cấp cho một Student hoặc cả lớp đủ điều kiện, bắt buộc lý do, số lượt bổ sung và hạn mới.
- Hạn mới phải ở tương lai và **lớn hơn hạn hiệu lực hiện tại của từng người được cấp**; bulk phải đáp ứng điều kiện với mọi người được chọn.
- Test mặc định cấp thêm một lượt, số cấu hình là số nguyên dương. Lượt đang làm giữ cutoff đã lưu; grant không sửa kết quả đã nộp hoặc kéo dài âm thầm attempt hiện tại.
- Giữ kết quả/lịch sử cũ; hệ thống thông báo Student và thông báo Admin kèm lý do. Đây là thông báo hệ thống, không phải quyền Manager soạn thư gửi Admin trong MVP.

### [SAU MVP]

Student gửi request retake và Manager Approve/Decline có phản hồi; multi-select/dạng câu khác, weighted points; advisory violation telemetry; leaderboard nâng cao; review đáp án nếu có quyết định đổi chính sách; quản lý metadata nâng cao. Điều chỉnh/vô hiệu hóa từng attempt giữ audit trail là một workflow riêng, chưa có trong MVP.

## Workflow 7 — Quiz Assignment

### [MVP]

- Tạo/publish single-choice, pass score, thời lượng, giờ mở và deadline; giữ validation/preview và khóa nội dung sau attempt như Test.
- **Mặc định tối đa 10 lượt nộp** nếu không cấu hình; custom là số nguyên dương, không tự đổi thành unlimited. Một lượt bắt đầu dùng một attempt; chưa hoàn thành thì khôi phục lượt đó, không bắt đầu song song để vượt cap.
- Cho nộp sớm bất kỳ lúc nào trước cutoff, có xác nhận. Hết thời lượng hoặc tới deadline tự nộp bằng đáp án server đã lưu.
- **Không pause đồng hồ** khi mất mạng/reload trong MVP; server duration tiếp tục chạy. Có autosave/recovery; không hứa lưu được thay đổi chưa tới server trước cutoff.
- Trong hạn và còn lượt, Student tự làm lại; giữ điểm cao nhất hợp lệ, mỗi bài chỉ tăng progress một lần, không công bố đáp án đúng.
- Khi Assignment hết hạn, Manager được mở lại cho một người/cả lớp, ghi lý do, thêm 1–10 lượt và hạn mới theo cùng điều kiện kéo dài deadline của Workflow 6; thông báo Student/Admin.

### [SAU MVP]

Nếu muốn có pause thực sự, phải thiết kế lại server state/thời gian và điều kiện recovery trước khi triển khai; không dùng browser event làm nguồn thời gian đáng tin. Các dạng câu hỏi và thống kê nâng cao theo roadmap Quiz.

## Workflow 8 — Progress và ba dashboard

### [MVP] Công thức thống nhất

- **Attendance % = số buổi có credit hợp lệ của lần ghi danh / tổng buổi bắt buộc cố định của lớp × 100.**
- **Quiz % = số Quiz đã đạt của lần ghi danh / tổng Quiz đã publish thuộc lớp × 100.** Test và Assignment có vai trò ngang nhau; draft không vào mẫu số.
- Một buổi chỉ ghi một credit; một Quiz chỉ đóng góp một lần, dù có nhiều lượt đạt. Mỗi bài dùng best valid submitted score; bằng ngưỡng pass score là Đạt.
- Không dùng điểm trung bình hoặc chỉ số buổi đã tới giờ làm thay thế các công thức trên; video views không được Attendance trong MVP.
- Mẫu số bằng 0 hiển thị 0%, không NaN. Điều kiện Completed dùng số liệu chưa làm tròn và ngưỡng lớp; không dùng phần trăm đã làm tròn để xét đạt.
- Giữ hai track riêng ở Student, Manager và Admin; không hardcode thống kê dashboard độc lập hoặc tính tổng từ một trang dữ liệu pagination chưa đầy đủ.

### [MVP] Mục tiêu từng dashboard

- Admin: KPI hệ thống, tổng quan các lớp, số Student/Manager, tiến độ giảng dạy/học tập, lịch chờ duyệt, hoạt động và quick actions trong quyền.
- Manager: selector các lớp phụ trách, roster/progress từng Student, buổi tới, enrollment requests, Quiz/results và thông báo. Xem lịch sử attempts trong lớp; có làm mới kết quả, nhịp cập nhật tự động theo workflow cũ tối đa 5 phút.
- Student: continue Assignment đang làm, lớp đã đăng ký, Attendance/Quiz riêng, lịch tới, hạn Assignment, kết quả/historical attempts được phép và inbox.
- Sau thao tác làm thay đổi dữ liệu, API lưu kết quả trước khi phản hồi; UI refetch/invalidate phần liên quan. Các client khác nhận dữ liệu hiện hành khi đọc/làm mới/poll; MVP không bắt buộc websocket.

## Workflow 9 — In-app inbox và Requests

### [MVP]

- Admin được gửi riêng hoặc theo các lớp cho Manager/Student được phép. Manager được gửi Student đã enrolled trong lớp mình. Student nhận, không gửi chủ động trong MVP.
- UI chọn theo người/lớp, có thể loại trừ; backend nhận danh sách người nhận cụ thể, dedup và xác minh toàn bộ phạm vi/tài khoản hoạt động. Select-all không chỉ lấy một trang của directory.
- Lưu inbox trong hệ thống; có dấu chưa đọc, xem chi tiết và chuyển đọc/chưa đọc. Không giả báo đã gửi email.
- Yêu cầu nghiệp vụ được xử lý tại các màn hình riêng: đăng ký vào lớp, phê duyệt lịch và xin nghỉ một buổi. Có pending/approved/declined/cancelled phù hợp, lý do và thông báo; không trộn chúng thành thông báo có nút duyệt mọi loại.
- Các thông báo tự động về kết quả/đăng ký/lịch/mở lại Quiz vẫn được hệ thống gửi đúng người nhận; chúng khác với quyền gửi chủ động của từng role.

### [SAU MVP]

Đã gửi/người nhận, Student gửi Manager, Manager gửi Admin; yêu cầu tự do và Approve/Decline kèm phản hồi; notification/request receipts nâng cao; SMTP/API email, queue/retry/status delivery. Giữ Notifications và Requests tách biệt khi mở rộng.

## Workflow 10 — Library, tài liệu và video

### [MVP]

- Chỉ lưu và truy cập **link HTTPS**: ví dụ YouTube/Drive/OneDrive hoặc nguồn phù hợp; không upload byte tệp vào LMS, không yêu cầu R2.
- Manager thêm tên/mô tả, loại Document/Video, link; phân loại chung lớp hoặc gắn buổi thuộc cùng lớp. Không cấp tài liệu riêng cho một Student/nhóm nhỏ.
- Student enrolled được tìm/lọc theo lớp, buổi, Document/Video và truy cập link hợp lệ của lớp còn hạn. Rời/bị xóa khỏi lớp thì không có quyền xem link qua LMS.
- Manager quản lý/gỡ link lớp mình; Admin kiểm soát và được gỡ link không phù hợp, bắt buộc lý do và gửi phản hồi Manager. Admin không tạo tài liệu thay Manager.
- Có hạn truy cập tài liệu nếu Manager cấu hình. Theo workflow cũ, video YouTube được miễn hạn riêng của material; **không** miễn ràng buộc lớp/enrollment. Sau material/class expiry, LMS không mở link nội dung; staff vẫn xem metadata/lịch sử được phép.
- Backend không thể thu hồi link bên ngoài mà Student đã biết hoặc kiểm soát quyền chia sẻ của YouTube/Drive/OneDrive. Không hứa khóa/xóa nội dung trên dịch vụ bên ngoài.

### [SAU MVP]

Upload thật, Cloudflare R2/S3/presigned URLs, kiểm tra byte/MIME/ownership, giới hạn loại/kích thước tệp, cleanup orphan/retention, signed download/ảnh minh chứng. Hết hạn URL tải tạm không phải hết hạn tài liệu. Mở rộng taxonomy và video playback/telemetry chỉ khi có thiết kế tương ứng.

## Workflow 11 — Tài khoản và user-information

### [MVP]

- Tổ chức khởi tạo Admin đầu tiên bằng cơ chế bootstrap bảo mật; không công khai đăng ký Admin và không quản lý thêm tài khoản Admin trong MVP.
- Admin tạo/sửa Student và Manager, cấp/reset mật khẩu, vô hiệu hóa/khôi phục kèm lý do. Email không trùng, so sánh không phân biệt hoa thường.
- Student có họ tên, MSSV, Trường/Viện thuộc HUST (văn bản), Lớp - Khóa đại học, SĐT và email bắt buộc; giới tính tùy chọn. Chi tiết tại `user-information-guideline.md` cùng thư mục.
- MSSV là chuỗi, giữ số 0 đầu và không trùng giữa hai tài khoản Student. Không đồng nhất Lớp - Khóa trong hồ sơ với enrollment lớp LMS.
- Student bắt buộc `@sis.hust.edu.vn`; Admin/Manager chỉ cần email hợp lệ. Không coi kiểm tra domain là tích hợp HUST SSO hay xác minh chính thức tình trạng sinh viên.
- Giữ quyết định demo trước đây: có thể suspend Manager đang phụ trách lớp; giữ phân công, enrollment, tài liệu và kết quả, khóa thao tác tài khoản. Admin đổi Manager riêng nếu cần; không áp dụng guard “phải chuyển hết lớp mới được suspend” của đề xuất kỹ thuật.
- Student bị suspend không được thao tác, nhưng suspend không xóa enrollment/kết quả. Xóa khỏi lớp không vô hiệu hóa tài khoản.
- Người dùng xem thông tin của mình, đổi mật khẩu; tự sửa hồ sơ ở giai đoạn sau. Không tự đổi role qua frontend; role switch chỉ thuộc mock mode.
- Mật khẩu theo baseline kỹ thuật: 12–72 UTF-8 bytes, không ép thành phần ký tự; chỉ lưu hash, không log/đưa vào localStorage. Admin chỉ biết mật khẩu được cấp/reset tại lúc thiết lập; hệ thống không cung cấp chức năng lấy lại plaintext đã lưu.

### [SAU MVP]

Tự sửa hồ sơ; thêm/quản lý Admin, đổi role và guard last active Admin; mailer/quên mật khẩu tự phục vụ; tích hợp dữ liệu đăng ký ngoài LMS. Mọi đổi role/status/password phải có server authorization và session revocation phù hợp.

## Workflow 12 — Completed status và roadmap chứng chỉ

### [MVP]

- Student **Completed** khi: có lần ghi danh đã được duyệt, mọi buổi bắt buộc đã có lịch được duyệt và đã kết thúc, Attendance % ≥ ngưỡng lớp và Quiz % ≥ ngưỡng lớp.
- Trước buổi cuối, dù đủ hai ngưỡng vẫn chỉ hiển thị đủ ngưỡng/dự kiến hoàn thành; chưa Completed.
- Chưa đủ điều kiện hiển thị Chưa hoàn thành và lý do cụ thể: thiếu buổi kết thúc, thiếu Attendance hoặc thiếu Quiz.
- Server tự tính lại khi kết quả/điều chỉnh hợp lệ hoặc cấu hình tiêu chí thay đổi. Có thể chuyển Completed về Chưa hoàn thành nếu tụt điều kiện; không cần chốt kết quả hoặc duyệt chéo trong MVP.
- Không có thao tác Admin/Manager ghi đè Completed bằng ngoại lệ trong MVP. Không chờ request sửa điểm/retake để “chốt” theo cơ chế certificate cũ.
- Student giữ quyền xem trạng thái/lịch sử tổng quát lần học của mình sau khi lớp hết hạn/bị xóa; không từ đó cấp quyền vào nội dung lớp hoặc lộ dữ liệu người khác.
- Trạng thái enrollment và hoàn thành là hai thông tin riêng: staff xóa Student khỏi lớp không tự xóa kết quả của lần học cũ; lần ghi danh mới không kế thừa credit cũ.
- Completed là trạng thái học tập, **không phải chứng chỉ** và không kéo theo email/chứng nhận chính thức.

### [SAU MVP] Giữ đầy đủ các nhóm chức năng cũ

1. Chốt kết quả phục vụ cấp chứng chỉ khi mọi buổi kết thúc, không có attempt đang làm hoặc yêu cầu sửa điểm/làm lại đang chờ; thay đổi điểm làm mất trạng thái chốt.
2. Cấp chứng chỉ và gửi email; lưu snapshot, lịch sử và delivery status, tách từng lần ghi danh; phân biệt chứng chỉ mô phỏng với chứng nhận thật.
3. Student khiếu nại; Manager từ chối có lý do hoặc tiếp nhận/chuyển cấp duyệt.
4. Hoàn thành theo ngoại lệ giữ điểm thực tế, cần kiểm soát chéo Manager đề xuất → Admin duyệt và ngược lại; không cấp chứng chỉ trước khi đủ điều kiện thời điểm/chốt.
5. Sau tối đa 24 giờ không phản hồi, người khởi tạo có quyền tự quyết định theo quy trình có audit, không tự động approve im lặng.
6. Chứng chỉ thường chuyển Under review khi điểm tụt; staff chủ động đề xuất, chỉ revoke sau quyết định hợp lệ. Điểm phục hồi đủ điều kiện khôi phục Issued/hủy pending revoke; từ chối revoke giữ Issued và ghi lịch sử.
7. Chứng chỉ theo ngoại lệ giữ hiệu lực ngoại lệ; chỉ đề xuất chủ động mới mở quy trình thu hồi. Chứng chỉ đã revoked không tự cấp lại; đề xuất/duyệt mới tạo record chứng chỉ mới, giữ lịch sử cũ.
8. Quyền xem chứng chỉ/snapshot sau hết hạn/rời lớp và quyền khiếu nại của enrollment được duyệt, cùng retention/dọn dữ liệu được phê duyệt.

Những quy trình tương lai này phải được đối chiếu lại với mô hình quyền khi triển khai. Không để state certificate/cross-approval cũ thành dependency ẩn của Completed MVP.

## 4. Các nguyên tắc dữ liệu/bảo mật phải có trong MVP

- Server kiểm tra session, role, lớp phụ trách/enrollment và class expiry cho từng thao tác; không dùng việc ẩn nút làm phân quyền.
- Điểm, clock, số lượt/cooldown, cutoff và đáp án đúng do server quản lý. Student không nhận answer key; không tin điểm/Completed do client tự gửi.
- Password hashing, bảo vệ session/cookie/CSRF/Origin, không log secrets, validation và lỗi tiếng Việt theo baseline kỹ thuật; tránh lộ việc tồn tại tài khoản cho login công khai.
- Giao dịch/constraints cho capacity approval, attendance, attempt start/submit và grants; idempotency/recovery bảo vệ retry, double-click và mất phản hồi.
- Mỗi dữ liệu học tập/grant thuộc đúng Student, lớp, buổi/Quiz và lần ghi danh; một cycle hiện hành, giữ lịch sử cũ và chống áp dụng action stale vào cycle mới.
- Không DELETE kết quả cũ để reset progress; không giữ dữ liệu thật, token/password/answer key của Student trong mock localStorage.
- Mục tiêu tải và nền tảng Go/SQLite/deployment thuộc đặc tả kỹ thuật; phải đo thực tế, không coi việc chọn stack là đã đạt 200 req/s. Không yêu cầu đổi Next.js/Vite trong tài liệu workflow này.

## 5. Tiêu chí nghiệm thu MVP end-to-end

1. Người dùng đi qua ba trang công khai hoặc vào thẳng login; role thật dẫn vào dashboard đúng quyền.
2. Admin tạo/sửa account với field/domain/MSSV hợp lệ; đổi/reset mật khẩu và suspend không bị bypass bằng phiên cũ; mật khẩu được gửi thủ công, không giả có mailer.
3. Admin tạo lớp/phân công/capacity/ngưỡng; Manager đặt số buổi cố định và quản lý nhiều lớp.
4. Student tìm/gửi/hủy/nhận quyết định enrollment; kiểm tra cooldown, ba decline, full/expired và xử lý đồng thời; tái ghi danh từ 0 nhưng giữ dữ liệu cycle cũ.
5. Manager draft/gửi lịch → Admin reject có lý do → sửa/gửi lại → approve; lịch cũ giữ nguyên tới quyết định, Student thấy lịch được duyệt, không bị chặn bởi confirmation 24h đã hoãn.
6. Student check-in bằng mã đúng giờ; ba sai khóa; Manager override sau giờ bắt đầu/khi đã kết thúc có lý do; Admin không sửa; không tự nhập mã ghi đè. Xin nghỉ không cấp Attendance.
7. Test single-choice: không nộp trước 2/3, nộp được từ 2/3, auto-submit theo cutoff; Assignment nộp sớm, giới hạn lượt, đồng hồ không pause; reload/offline recovery không mất dữ liệu đã lưu hoặc tạo lượt trùng.
8. Manager cấp thêm lượt/hạn tăng lên cho một người/cả lớp, giữ best score; không yêu cầu Student retake request đã hoãn. Không công bố đáp án hoặc chấm 0 bằng browser events.
9. Progress/counters khớp ba role, không duplicate credit, đúng mẫu số và cycle; Completed chỉ sau mọi buổi kết thúc và đủ ngưỡng, không cần chốt/chứng chỉ.
10. Inbox đúng hướng gửi/phạm vi, read/unread; link Library có quyền/class/lesson/expiry, gỡ có phản hồi, không có nút upload/email giả báo đã chạy thật.
11. Lớp hết hạn/mất enrollment chặn nội dung Student, giữ quyền xem lịch sử tổng quát và staff history theo quyền; không purge tự động.
12. Chạy các test role/relationship/race/deadline/persistence và UI responsive/keyboard/error/loading. Feature sau MVP được ghi nhãn/ẩn phù hợp, không bắt người dùng hoàn tất một flow chưa hỗ trợ.

## 6. Handoff: phần code và tài liệu kỹ thuật phải cập nhật tiếp

Đây là quyết định sản phẩm mới. Code demo, schema thiết kế và contract 83 endpoint cũ **chưa tự đồng bộ**. Các nhóm cần cập nhật trước khi coi là đã triển khai đúng bản này:

- Domain role mapping; Student profile/MSSV/domain và provisioning thủ công; class code/capacity/số buổi; policy suspend Manager đã được chọn.
- Enrollment requests/cancel/cooldown/decline thay invitation MVP; enrollment cycles và lịch sử không xóa.
- Draft/submit/review schedule, bỏ dependency Teacher-confirm 24h; Attendance bằng mã, ba sai, absence và Manager override/audit thay Admin approval.
- Quiz giờ mở, cap Assignment/custom, continuous timer/recovery, single-choice; Test 2/3; cấp grant có reason/deadline mới/bulk/cycle. Không dùng deadline bất biến của Quiz làm mất khả năng mở lại đã chốt.
- Formula progress/Completed chuẩn demo thay avg score/required_quiz_ids; không bắt certificate/seal/appeal là điều kiện Completed.
- Inbox read/unread/role send; link Library theo buổi/hạn/gỡ Admin; bỏ giả định MVP phải có R2/photo/video telemetry/email.
- Cập nhật frontend, DTO/API/DB, test fixtures và test assertions theo cùng phiên bản; các test pass cho demo trước đây không chứng minh phù hợp workflow mới.

Không tự đổi đồng thời `API_DEFINITIONS.md`, `ARCHITECTURE.md`, `DECISIONS.md`, design system hoặc code khi chỉ được giao cập nhật workflow. Bản workflow trước thay đổi được lưu riêng để truy vết.
