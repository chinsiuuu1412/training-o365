---
name: user-workflow-guideline
description: Mô tả user workflow cho hệ thống LMS
---

## Mục tiêu
Xác định, mô tả, kiểm thử user workflow thân thiện với người dùng

## Yêu cầu
- Khi đọc bản mô tả user workflow theo thứ tự từng gạch đầu dòng dưới đây, bạn hãy:
+ Giả lập bạn là người sử dụng.

## Workflow 1 - Truy cập vào trang web và đăng nhập

- Trang đầu tiên: Giới thiệu về đơn vị chủ quản
- Trang thứ hai: Giới thiệu về khóa học
- Trang thứ 3: Giao diện đăng nhập 
- Người dùng có quyền di chuyển thẳng đến giao diện đăng nhập ở trang đầu tiên.
- Bạn nhập email đăng kí tài khoản và mật khẩu (email đăng kí được nhập từ hệ thống khác, mật khẩu được cấp phát - gửi mail về người dùng)
- Nếu bạn nhập sai mật khẩu, hoặc sai tài khoản, hệ thống sẽ phản hồi "Tài khoản không tồn tại"
- Nếu bạn "Quên mật khẩu":
+ Bạn nhập email đăng kí tài khoản của mình
+ Hệ thống gửi mail xác thực danh tính
+ Bạn đổi mật khẩu.
- Sau khi đăng nhập thành công, admin, quản lí lớp, học viên đều vào trang chủ (trang chủ riêng ứng với vai trò riêng)

## Workflow 2 - Quản lí lớp học (admin, quản lí lớp)

- Bạn là admin và bạn khởi tạo lớp học
+ Đặt tên cho lớp học.
+ Gán account quản lí lớp
+ Mô tả nội dung giảng dạy.
+ Đặt expiration date
+ Đặt giới hạn sĩ số cho mỗi lớp
+ Đặt tiêu chí hoàn thành khóa học (dựa theo hai tiêu chí attendance & Quiz Score)
- Sau khi lớp học được khởi tạo thành công
+ Theo dõi được tiến độ giảng dạy của quản lí lớp
+ Theo dõi được tiến độ học tập của lớp và cá nhân mỗi học viên.
+ Kiểm soát tài liệu học tập (Course material - do quản lí lớp đăng tải), nếu bạn thấy không phù hợp, có thể xóa.
+ Tùy vào tình hình lớp học, bạn có thể đưa ra quyết định đổi quản lí lớp.
+ Nếu bạn đổi quản lí lớp, tài liệu lớp học giữ nguyên, các yêu cầu trong lớp học sẽ được quản lí mới duyệt.
+ Quản lí lớp sẽ được đổi ngay sau khi admin xác nhận đổi.

- Bạn là Quản lí lớp, sau khi admin gán account của bạn vào lớp học
+ Theo dõi được số lượng học viên lớp học.
+ Lên thời khóa biểu và gửi cho admin duyệt (điều này sẽ trình bày rõ hơn ở Workflow 5)
+ Bạn bắt buộc phải đặt số lượng buổi học cố định, và đảm bảo giảng dạy đúng số buổi đã đặt ra (nếu bạn nghỉ, sẽ phải có buổi học bù).
+ Trước khi đến lịch học (bao gồm giờ bắt đầu, và giờ kết thúc) ít nhất 24h, bạn xác nhận buổi học (trình bày rõ hơn ở Workflow 5)
+ Đăng tải và quản lý Course material (trình bày rõ hơn ở Workflow 10)
+ Đăng tải và quản lí Quiz (trình bày rõ hơn ở Workflow 4, 6, 7)
+ Quản lí học viên:
    - Bạn theo dõi được tiến độ học tập của từng học viên.
    - Nếu một học viên vi phạm quy định lớp học, bạn có quyền đuổi (xóa học viên khỏi lớp)

- Đối với học viên, sau khi kết thúc buổi học cuối cùng của lớp (trước expirartion date), kết quả sẽ được giữ nguyên (trừ trường hợp ngoại lệ), và được nhận chứng chỉ xác nhận hoàn thành lớp học ở email đăng kí tài khoản.

- Sau khi lớp hết hạn, học viên không được truy cập vào lớp học được nữa. Dữ liệu lớp vẫn được truy cập bới quản lí lớp và admin. Sau khi đã cấp hết chứng chỉ, xét xong trường hợp ngoại lệ, chứng chỉ đã cấp vẫn được lưu trữ, các dữ liệu còn lại của lớp sẽ được xóa bởi admin.

## Workflow 3 - Tìm kiếm và đăng kí lớp học (học viên và quản lí lớp)

- Học viên sau khi đăng nhập, hệ thống sẽ dựa theo data có sẵn và hiển thị lớp đã được đăng kí cho học viên.
- Nếu học viên muốn đăng kí thêm lớp nào khác.
    + Vào Find Classes, nhập tên lớp muốn đăng kí.
    + Thông tin lớp hiện ra gồm có tên lớp, tên quản lí lớp, mô tả nội dung giảng dạy, sĩ số lớp hiện tại, tiến độ giảng dạy, expiration date, thời gian cho buổi học chuẩn bị tới.
    + Nếu lớp ấy đã đăng kí, hiện Registered Class.
    + Nếu lớp ấy chưa đăng kí, hiện nút Send Request.
    + Sau khi nhấn nút Send Request, viết lí do tham gia và nhấn xác nhận đăng kí.
    + Học viên đợi Quản lí lớp approve, hiển thị giao diện (Waiting for Approval), nút Send Request sẽ bị vô hiệu hóa.
    + Nếu quản lí lớp decline, hiển thị nút (Declined), bạn sẽ nhận được thông báo kèm lí do không được duyệt. Bạn có thể gửi lại yêu cầu sau 10 phút với lí do mới. Bạn không được gửi yêu cầu quá 3 lần (tính cả lần đầu tiên).
    + Bạn có thể hủy yêu cầu đăng kí đang chờ duyệt và gửi lại sau khi hủy.
    + Nếu quản lí lớp approve, hiển thị Registered Class, bạn sẽ nhận được thông báo.
    + Lớp đã hết hạn sẽ không hiện trên Find Classes.
    + Lớp đã đủ sĩ số, sĩ số sẽ hiện thông tin Full, và bạn không thể Send Request (nút Send Request bị ẩn)
- Nếu bạn là quản lí lớp khi thấy request của học viên:
    + Nếu bạn approve, học viên ấy sẽ truy cập vào lớp, tài liệu học tập riêng của lớp và lịch học sẽ được cập nhật cho học viên.
    + Nếu bạn decline, viết lí do decline.
- Nếu bạn là học viên vào lớp giữa chừng, điểm Attendance và Quiz của bạn sẽ được tính bắt đầu từ 0.

## Workflow 4 - Tham gia buổi học, và tính điểm Attendance/Quiz cuối buổi (admin, học viên, quản lí lớp)

- Bạn là quản lí lớp, và buổi học được xác nhận khởi tạo
+ Bạn lập mã điểm danh
+ Mã điểm danh có thời hạn trong thời gian buổi học.
+ Đăng tải tài liệu tham khảo (nếu có)
+ Sau khi kết thúc buổi học, bạn đăng tải video bài giảng (đăng trên YouTube - không công khai, gán link lên), link sẽ được lưu trữ trong Course material.
+ Bạn đăng tải Quiz Test cuối buổi 
+ Nếu bạn có phương pháp điểm danh khác, và nhận ra có học viên không tham gia buổi học nhưng vẫn hoàn thành Attendance, bạn có quyền gửi yêu cầu xóa điểm Attendance cho admin.
+ Nếu bạn phát hiện học viên gian lận khi làm Quiz, bạn có quyền gửi yêu cầu xóa điểm Quiz cho admin.
+ Bạn có thể điểm danh thủ công cho học viên trong thời gian buổi học diễn ra, bao gồm trường hợp đã nhập sai mã 3 lần, sau khi xác minh việc tham gia buổi học.

- Bạn là học viên
+ Nếu bạn muốn nghỉ học, nhấn nút nghỉ học và viết lí do nghỉ, sau đấy yêu cầu xin nghỉ học được gửi về hệ thống còn lí do nghỉ học được gửi về quản lí lớp, và hệ thống tự approve bạn nghỉ. Nếu bạn hoàn thành đầy đủ bài tập (bao gồm Quiz Test cuối buổi), bạn vẫn sẽ được tính điểm Quiz trong track tiến độ Quiz nếu bạn đạt mức điểm lớn hơn hoặc bằng ngưỡng điểm đạt, nhưng không được tính Attendance.
+ Khi bạn nhập mã điểm danh, hệ thống sẽ không ẩn mã. Bạn có thể soát xem đã nhập đúng mã điểm danh chưa.
+ Bạn phải nhập mã điểm danh để được tính điểm Attendance, trừ trường hợp được quản lí điểm danh thủ công sau khi xác minh.
+ Nếu bạn nhập đúng mã, bạn sẽ được tính điểm Attendance, và nhận được phản hồi "Đã điểm danh thành công". Sau đó bạn sẽ không nhập được mã điểm danh nữa, phần nhập mã điểm danh bị ẩn.
+ Nếu bạn nhập không đúng mã, hệ thống phản hồi "Bạn chưa nhập đúng mã, bạn còn x lượt nhập" bạn có quyền được nhập lại (không quá 3 lần, tính cả lần nhập sai đầu tiên).
+ Nếu bạn không nhập mã và không được quản lí điểm danh thủ công, bạn không được tính điểm Attendance.
+ Sau khi kết thúc buổi học, bạn phải đạt mức điểm lớn hơn hoặc bằng mức điểm đạt ở Quiz Test cuối buổi để được tính điểm Quiz.
+ Nếu không đạt, điểm Quiz sẽ không được tính vào track tiến độ Quiz sẽ không được tính.
+ Nếu bạn đạt tiêu chí nào, bạn sẽ nhận được thông báo đã đạt, track tiến độ của bạn sẽ tăng
+ Nếu không đạt, bạn sẽ nhận được thông báo không đạt + lí do, track tiến độ của bạn giữ nguyên.

- Bạn là admin
+ Nếu bạn nhận được yêu cầu xóa điểm Attendance/Quiz từ quản lí lớp, bạn có thể approve hoặc decline. Nếu bạn approve, track Attendance/Quiz của học viên sẽ giảm.
+ Nếu bạn decline, đưa ra lí do.
+ Nếu bạn nhận ra một học sinh cheating trong Attendance/Quiz, bạn có quyền xóa kết quả, và đưa ra lí do. Nếu bạn hủy kết quả, track Attendance/Quiz của học viên sẽ giảm.

## Workflow 5 - Tạo thời khóa biểu, duyệt lịch học, xác nhận lịch học, khởi tạo buổi học (admin, quản lí lớp)

- Bạn là quản lí lớp
+ Bạn tạo thời khóa biểu cụ thể và gửi cho admin duyệt.
+ Nếu bạn không được duyệt, xem kĩ lí do admin gửi, sửa, và gửi lại
+ Nếu thời khóa biểu được duyệt, bạn phải xác nhận buổi học có diễn ra không ít nhất 24 giờ trước giờ bắt đầu.
    - Nếu không diễn ra, gửi yêu cầu xin nghỉ cho admin duyệt và gửi lịch học bù, gửi thông báo cho học viên ít nhất 24h trước khi buổi học bắt đầu. Bạn phải gửi lịch học bù thì mới được gửi yêu cầu xin nghỉ.
    - Nếu bạn không xác nhận buổi học trước ít nhất 24h trước khi buổi học bắt đầu, hệ thống gửi thông báo về cho admin quyết định.
    - Nếu diễn ra, bạn khởi tạo buổi học và gửi thông báo cho học viên, buổi học bù vẫn sẽ được tính trong tổng số buổi.
    - Nếu lịch học bù bị từ chối, bạn đề xuất lịch mới; buổi học bù tiếp tục chờ duyệt.

- Bạn là admin
+ Bạn nhận được yêu cầu phê duyệt thời khóa biểu.
+ Đến hạn xác nhận, nếu quản lí chưa xác nhận và cũng chưa xin nghỉ, buổi học chưa được mở; admin quyết định cách xử lý.
    - Admin đổi quản lí lớp nếu tìm được quản lí lớp khác phù hợp
    - Nếu không tìm được quản lí lớp khác phù hợp, admin sẽ hủy buổi học đấy, và tạo lịch học bù.
+ Tùy vào quyết định của admin, admin sẽ gửi thông báo phù hợp đến học viên ít nhất 12h trước khi buổi học bắt đầu.
+ Bạn có quyền duyệt thời khóa biểu hoặc không.
+ Nếu bạn không duyệt, gửi lí do phản hồi cho quản lí lớp để sửa, và quản lí lớp gửi lại yêu cầu phê duyệt cho bạn.
+ Nếu bạn duyệt, trước khi buổi học diễn ra, bạn cần kiểm tra xem quản lí lớp có xác nhận buổi học không. Nếu quản lí xin nghỉ, bạn cần xem xét phê duyệt cho yêu cầu nghỉ của quản lí lớp, và xem xét phê duyệt lịch học bù. Nếu yêu cầu nghỉ không hợp lệ, bạn có quyền từ chối. Nếu lịch học bù không hợp lí, bạn có quyền từ chối.

## Workflow 6 - Khởi tạo và triển khai Quiz Test (học viên, quản lí lớp)

- Bạn là quản lí lớp
+ Bạn khởi tạo Quiz Test (100% Trắc nghiệm)
+ Bạn nhập câu hỏi + kết quả.
+ Bạn đặt mức điểm đạt cho từng bài; kết quả bằng hoặc cao hơn mức điểm đạt được tính là Đạt.
+ Bạn đặt hẹn giờ mở Test
+ Bạn nhập thời gian làm test
+ Bạn nhập thời hạn làm bài (expiration date)
+ Bạn giới hạn mỗi học viên chỉ được làm test 1 lần
+ Bạn xem được kết quả của học viên (được cập nhật 5 phút/lần)
+ Quản lí lớp có thể mở lại Quiz Test cho cả lớp hoặc từng học viên tùy tình huống thực tế, phải thông báo cho admin kèm lí do.
+ Khi mở lại Quiz Test, quản lí tự đặt số lượt làm bổ sung, mặc định là 1 lượt, và bắt buộc đặt thời hạn làm bài mới.

- Bạn là học viên
+ Nếu bạn vào làm test trước expiration date, bạn được làm bài, nếu không, bạn sẽ không được tính kết quả làm Test, track tiến độ Quiz giữ nguyên.
+ Bạn xác nhận tham gia làm Quiz Test.
+ Khi tham gia làm Quiz Test, nếu bạn thoát tab làm Quiz (bao gồm chuyển tab, mất mạng, tải lại trang, xóa tab, tắt màn hình), bạn sẽ thoát luôn bài kiểm tra, và hệ thống tính 0 điểm, track tiến độ Quiz không tăng.
+ Bạn có quyền gửi yêu cầu + lí do làm lại Quiz Test cho quản lí lớp. Nếu quản lí lớp duyệt, bạn được làm lại bài, nếu không, kết quả giữ nguyên là 0 điểm.
+ Bạn không thể nộp bài sớm. Hết thời gian làm test, hệ thống sẽ tự động nộp bài.
+ Nếu bạn đang làm Test, tuy nhiên lại đến expiration date, hệ thống sẽ tự động nộp bài, và tính điểm theo số câu bạn đã làm đúng đến thời điểm nộp bài.
+ Sau khi nộp bài, bạn sẽ xem được kết quả, nhưng không xem được đáp án.
+ Bạn không thể làm lại bài Quiz Test nếu quản lí lớp không mở lại.
+ Nếu quản lí lớp mở lại Quiz Test, kết quả cuối cùng của bạn sẽ được lấy theo kết quả cao hơn.
+ Nếu kết quả cao nhất hợp lệ của bạn bằng hoặc cao hơn mức điểm đạt, bài được ghi nhận là Đạt và tiến độ Quiz được cập nhật theo Workflow 8.
+ Nếu kết quả cao nhất hợp lệ của bạn thấp hơn mức điểm đạt, bài chưa được ghi nhận là Đạt.

## Workflow 7 - Khởi tạo và triển khai Assignment (học viên, quản lí lớp)

- Bạn là quản lí lớp
+ Bạn khởi tạo Quiz Assignment (100% Trắc nghiệm)
+ Bạn nhập câu hỏi + kết quả.
+ Bạn đặt mức điểm đạt cho từng bài; kết quả bằng hoặc cao hơn mức điểm đạt được tính là Đạt.
+ Bạn nhập thời gian làm assignment
+ Bạn nhập thời hạn làm bài (expiration date)
+ Bạn có thể giới hạn số lần làm bài, nếu bạn không giới hạn, hệ thống mặc định giới hạn cho 10 lần nộp
+ Bạn xem được kết quả của học viên (được cập nhật 5 phút/lần)
+ Nếu Assignment hết thời hạn, bạn có thể mở lại cho cả lớp hoặc từng học viên tùy tình huống thực tế, phải thông báo cho admin kèm lí do.
+ Khi mở lại Assignment, quản lí tự đặt số lượt làm bổ sung từ 1 đến 10 lượt và bắt buộc đặt thời hạn làm bài mới.

- Bạn là học viên
+ Nếu bạn vào làm test trước expiration date, bạn được làm bài, nếu không, bạn sẽ không được tính kết quả làm Quiz, track tiến độ Quiz giữ nguyên.
+ Bạn xác nhận tham gia làm Quiz Assignment.
+ Nếu bạn mất mạng hoặc tải lại trang khi làm Assignment, hệ thống lưu bài làm và tạm dừng thời gian làm bài trong lúc gián đoạn; bạn được tiếp tục bài làm khi quay lại. Quy định tự động nộp khi đến expiration date vẫn áp dụng.
+ Bạn có thể nộp bài sớm. Nếu hết thời gian làm bài, hệ thống sẽ tự động nộp
+ Sau khi nộp bài, bạn sẽ xem được kết quả, nhưng không xem được đáp án.
+ Nếu bạn đang làm Quiz, tuy nhiên lại đến expiration date, hệ thống sẽ tự động nộp bài, và tính điểm theo số câu bạn đã làm đúng đến thời điểm nộp bài.
+ Bạn có thể làm lại bài, nếu chưa vượt quá giới hạn làm bài, và trước expiration date.
+ Ngay sau mỗi lần nộp hợp lệ, hệ thống ghi nhận kết quả cao nhất trong các lần nộp hợp lệ của bạn.
+ Nếu kết quả cao nhất hợp lệ của bạn bằng hoặc cao hơn mức điểm đạt, bài được ghi nhận là Đạt và tiến độ Quiz được cập nhật theo Workflow 8.
+ Nếu kết quả cao nhất hợp lệ của bạn thấp hơn mức điểm đạt, bài chưa được ghi nhận là Đạt.

## Workflow 8 - Đồng bộ 3 Dashboard (học viên, quản lí lớp, admin)

- Tiến độ Attendance = số buổi được điểm danh / tổng số buổi của lớp × 100%.
- Tiến độ Quiz = số bài đã đạt / tổng số bài × 100%. Quiz Test và Assignment được tính chung (vai trò tương đương) trong tiến độ Quiz.
- Mỗi buổi chỉ được ghi nhận Attendance một lần; mỗi bài chỉ đóng góp một lần vào số bài đã đạt. Làm lại bài đã đạt không làm tăng tiến độ thêm lần nữa.

- Bạn là học viên:
+ Nếu bạn được tính/trừ điểm Attendance, track tiến độ Attendance của bạn sẽ tăng/giảm, và được ghi nhận tăng/giảm ở track của quản lí lớp, và admin.
+ Nếu bạn được tính/trừ điểm Quiz, track tiến độ Quiz của bạn sẽ tăng/giảm, và được ghi nhận tăng/giảm ở track của quản lí lớp, và admin

- Dashboard của mỗi vai trò sẽ được cập nhật sau mỗi lần có sự thay đổi trong track tiến độ Attendance/Quiz của học viên.

## Workflow 9 - Gửi thông báo (admin, quản lí lớp, học viên)

- Bạn là admin:
+ Bạn có quyền gửi thông báo cho riêng quản lí lớp hoặc học viên.
+ Bạn có quyền gửi thông báo chung cho mỗi lớp học (có thể bao gồm quản lí lớp hoặc không, hoặc loại trừ, lựa chọn học viên nào)
+ Bạn có quyền gửi thông báo chung cho toàn bộ lớp học (có thể bao gồm quản lí lớp hoặc không, hoặc loại trừ học viên, hoặc lựa chọn học viên nào)

- Bạn là quản lí lớp
+ Bạn có quyền gửi thông báo chung cho lớp học bạn quản lí (loại trừ, lựa chọn học viên nào)
+ Bạn có quyền gửi thông báo riêng cho học viên
+ Bạn có quyền gửi yêu cầu, thông báo cho admin

- Bạn là học viên
+ Bạn có quyền gửi yêu cầu/thông báo cho quản lí lớp bạn đang đăng kí.

- Nếu có thông báo/yêu cầu nào bạn chưa xem, bạn sẽ thấy dấu chấm đỏ ở thông báo/yêu cầu đó.
- Bạn có thể chuyển trạng thái thông báo/yêu cầu đã đọc sang chưa đọc.
- Chia rõ hai phần thông báo và yêu cầu.
- Trong phần yêu cầu, chia rõ hai phần đã duyệt (ghi rõ "Approval" hay "Decline") và đang chờ ("Waiting")
- Thông báo/Yêu cầu sẽ được gửi ngay trên hệ thống LMS.

## Workflow 10 - Quản lý và truy cập tài liệu Course material (admin, quản lí lớp, học viên)

- Bạn là học viên:
+ Bạn có quyền truy cập vào tài liệu Course material của lớp học bạn đang đăng kí.
+ Nếu bạn không còn trong lớp, hoặc lớp bạn đăng kí đã hết hạn, bạn không thể truy cập vào tài liệu

- Bạn là quản lí lớp
+ Bạn có quyền đăng tải tài liệu, phân loại tài liệu theo từng buổi học, hoặc tài liệu chung cho toàn khóa.
+ Bạn không thể đăng tải tài liệu riêng cho 1 học viên hay một nhóm học viên xem.
+ Bạn có thể gỡ tài liệu đã đăng tải.
+ Nếu bạn không còn trong lớp, hoặc lớp bạn đăng kí đã hết hạn, bạn không thể truy cập vào tài liệu
+ Bạn có thể đặt expiration date cho tài liệu bạn đăng tải.

- Bạn là admin:
+ Bạn không có quyền đăng tải tài liệu.
+ Bạn có quyền xóa tài liệu khỏi lớp học nếu không phù hợp với lớp học và gửi thông báo + lí do phản hồi cho quản lí lớp.
+ Bạn có quyền truy cập vào toàn bộ tài liệu của tất cả các lớp học.
+ Nếu có lớp học hết hạn, bạn không thể truy cập vào tài liệu của lớp học đấy.

- Nếu tài liệu đã hết hạn (ngoại trừ video bài giảng được up trên youtube), admin, quản lí lớp, học viên đều không thể truy cập vào tài liệu.

## Workflow 11 - Quản lí tài khoản (admin, quản lí lớp, học viên)

- Bạn là admin và bạn theo dõi và quản lí tài khoản của toàn bộ quản lí lớp và học viên:
+ Bạn có quyền vô hiệu hóa bất cứ tài khoản nào trên toàn hệ thống, và phải đưa ra lí do.
+ Bạn có quyền đổi quản lí lớp, và phải đưa ra lí do.
+ Bạn có quyền xóa học viên khỏi lớp, và phải đưa ra lí do.
+ Bạn có quyền tạo tài khoản cho học viên, thông tin yêu cầu bao gồm (thông tin cá nhân của học viên sẽ được nêu rõ hơn trong reference user-information-guideline.md), nếu tài khoản đã tồn tại, hệ thống sẽ phản hồi "Tài khoản đã tồn tại"

- Bạn là quản lí lớp:
+ Bạn có quyền được sửa thông tin cá nhân và đổi mật khẩu cho tài khoản của mình

- Bạn là học viên:
+ Bạn có quyền được sửa thông tin cá nhân và đổi mật khẩu cho tài khoản của mình

## Workflow 12 - Xác nhận hoàn thành lớp học (học viên, quản lí lớp, admin)

- Việc thay đổi kết quả hoàn thành áp dụng kiểm soát chéo: quản lí đề xuất thì admin duyệt; admin đề xuất thì quản lí duyệt.
- Khi được duyệt hoàn thành theo ngoại lệ dù chưa đủ tiêu chí, điểm thực tế được giữ nguyên; hệ thống ghi nhận hoàn thành theo ngoại lệ và cấp chứng chỉ.
- Nếu điểm bị điều chỉnh khiến học viên không còn đủ điều kiện sau khi đã nhận chứng chỉ, chứng chỉ chuyển sang trạng thái đang xem xét, chờ phê duyệt thu hồi theo quy trình kiểm soát chéo. Chứng chỉ chỉ bị thu hồi sau khi yêu cầu được duyệt.

- Bạn là học viên:
+ Nếu tiến độ Attendance và Quiz của bạn đều bằng hoặc cao hơn các ngưỡng hoàn thành lớp học do admin đặt khi khởi tạo lớp, bạn được xác nhận hoàn thành lớp học và nhận certificate.
+ Nếu có ít nhất một tiêu chí hoàn thành lớp học chưa đạt, bạn chưa được nhận certificate theo tiêu chí thông thường và nhận được thông báo lí do. Bạn có quyền gửi khiếu nại đến quản lí lớp; việc hoàn thành theo ngoại lệ phải được phê duyệt theo quy trình kiểm soát chéo.
+ Bạn sẽ được nhận Chứng chỉ ở email đăng kí tài khoản, ngay sau khi được cấp.

- Bạn là quản lí lớp:
+ Bạn xem được danh sách những học viên đã đạt trong lớp học. Nếu có học viên nào bạn thấy không đủ điều kiện nhưng được ghi nhận hoàn thành, bạn có quyền gửi yêu cầu hủy xác nhận + lí do đến admin.
+ Bạn xem được danh sách những học viên không đạt trong lớp học. Nếu có học viên nào bạn thấy có thể được xem xét để được duyệt hoàn thành, bạn có quyền gửi yêu cầu xác nhận + lí do đến admin.
+ Nếu bạn nhận được khiếu nại từ học viên, bạn có quyền từ chối nhận khiếu nại và đưa ra lí do phản hồi học viên. Bạn có quyền tiếp nhận đơn khiếu nại, và gửi admin duyệt.

- Bạn là admin:
+ Bạn có quyền xác nhận/đồng ý với yêu cầu được gửi từ quản lí lớp.
+ Bạn có quyền không đồng ý, và phải đưa ra lí do phản hồi.
+ Bạn có quyền hủy xác nhận hoàn thành lớp học của bất cứ học viên nào, tuy nhiên phải gửi yêu cầu đến quản lí lớp để được duyệt, nếu quản lí lớp duyệt, phải gửi thông báo + lí do cho học viên đấy, nếu quản lí lớp không duyệt, kết quả được giữ nguyên.
+ Bạn có quyền xác nhận hoàn thành lớp học của bất cứ học viên nào, tuy nhiên phải được gửi yêu cầu đến quản lí lớp để được duyệt, nếu quản lí lớp duyệt, phải gửi thông báo + lí do cho học viên đấy, nếu quản lí lớp không duyệt, kết quả được giữ nguyên.

- Nếu một trong hai bên phê duyệt không phản hồi trong nhiều nhất 24 tiếng kế từ khi yêu cầu được gửi, người gửi yêu cầu có quyền tự quyết định Phê duyệt yêu cầu hay không.