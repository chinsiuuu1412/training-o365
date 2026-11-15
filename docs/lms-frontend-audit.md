# Báo cáo audit LMS frontend — 14/11/2026

> Báo cáo này ghi nhận bản demo và workflow v1 tại thời điểm audit, trước khi chốt MVP v2. Các quyết định MVP hiện hành nằm trong [user-workflow-guideline.md](../frontend.agents/skill/references/user-workflow-guideline.md); kết quả kiểm tra bên dưới không chứng minh ứng dụng đã đáp ứng các thay đổi MVP v2.

## Quản lý tài khoản, lớp và ghi danh qua DTO approved-v2 — 15/11/2026

Đợt này hoàn thiện frontend bằng fixture tổng hợp, giữ AppShell/component hiện có và hai tài liệu nghiệp vụ gốc. Kết quả v1 phía dưới chỉ còn giá trị hồi quy cho module cũ.

### Route và file ảnh hưởng

| Route | Đã hoàn thành qua service |
|---|---|
| `/admin/students/`, `/admin/managers/` | Search/filter/page, tạo/sửa, suspend/restore có lý do, cấp/reset mật khẩu và hướng dẫn gửi thủ công. Student đủ hồ sơ, Manager có trường Student null. |
| `/[role]/profile/`, `/[role]/settings/` | Hồ sơ tự xem chỉ đọc từ me, đổi mật khẩu qua client dùng chung. Staff xem Student trong roster đúng lớp phụ trách. |
| `/admin/classes/`, `/manager/classes/` | Danh sách, tạo/sửa lớp, capacity/ngưỡng/ngày Việt Nam, đổi Manager có lý do và xác nhận, đặt tổng buổi đúng một lần. |
| `/[role]/classes/?classId=…` | Tổng quan, roster, queue, lịch sử theo quyền. Manager cũ mất quyền, Manager mới tiếp nhận pending. Student preview qua response, nội dung bị chặn khi rời lớp/hết hạn. |
| `/student/classes/?view=find`, `requests`, `history` | Discovery/preview, gửi/hủy, lý do từ chối, cooldown, ba decline; lịch sử riêng từng enrollment_id. Pending chưa giữ chỗ. Tái ghi danh tạo cycle mới từ 0. |
| Role dashboard và `/student/schedule/` | Dashboard/progress và agenda lấy từ response theo role. Lịch Student chỉ có buổi sắp tới còn quyền. |

Chín file mới đúng danh sách được duyệt gồm accounts/classes/enrollments/dashboard trong `src/lib/api`, `src/state/api-data-provider.tsx`, `src/mocks/management-fixture.ts` và ba test api-management/api-enrollments/api-dashboard. Màn hình sửa tại file hiện có. Provider dùng cùng client/phiên, làm mới resource sau ghi, xóa dữ liệu khi quyền bị thu hồi và giữ dữ liệu đã tải khi refresh lỗi mạng.

### Kết quả thực tế

| Kiểm tra | Kết quả |
|---|---|
| `npm.cmd test` | 118/118 PASS, 0 fail/skip/cancel. Có 10 nhóm mới về tài khoản, quan hệ DTO, ghi danh và dashboard. Test v1 được giữ làm hồi quy riêng. |
| `npm.cmd run lint` | PASS. |
| `npm.cmd run typecheck -- --incremental false` | PASS. Lần có cache bị EPERM khi ghi tsbuildinfo do sandbox trỏ workspace cũ, đã chạy lại không cache. |
| Build fixture `/lms-qa` | PASS, 34 trang. 8 nhóm browser smoke PASS trên HTTP static server. |
| Browser fixture | CRUD/duplicate hồ sơ; Manager null fields/reset; discovery/request/cancel; reassignment; hai tab tranh suất cuối; full preview/remove/re-enroll; ba decline/cooldown; agenda/expired history/responsive. |
| Build API mở cờ chỉ để QA | PASS, 34 trang. 5 nhóm browser PASS với HTTP interception tổng hợp, gồm directory/lỗi mạng refresh, sai role, Student dashboard/agenda/request/history, Manager approve và endpoint/storage. |
| Artifact API cuối đợt | PASS, 34 trang, hai cờ chức năng mặc định false. `.nojekyll` có mặt, quét output không thấy credential/selector/namespace fixture hoặc seed cũ. Đã sửa import clock để bundler loại fixture khỏi API artifact. |
| Browser artifact mặc định | 1 nhóm smoke PASS, không control fixture, không gọi API và không ghi browser store. Axe login 375px có 0 violation. |
| Accessibility/layout | 3 lượt axe có 0 violation theo WCAG 2 A/AA và 2.1 AA tags. Rộng 320/375/768/1440px, bàn phím mobile, ảnh history 375px đã kiểm tra. Browser cuối có 0 pageerror và 0 asset lỗi. |

Test service kiểm tra 599999/600000 ms, decline thứ ba, email không phân biệt hoa thường, MSSV 9 chữ số và SĐT giữ số 0, session cũ sau reset/suspend, Manager scope, suất cuối, nửa đêm Việt Nam, lịch sử tách cycle và stale remove không xóa enrollment mới. Browser dùng fixture clock chung để thử cooldown/reload. Scripts/JSON/ảnh ở temp `o365-management-*`, dependency repo giữ nguyên.

### Giới hạn và bàn giao

- Cờ API `NEXT_PUBLIC_AUTH_ENABLED` và `NEXT_PUBLIC_MANAGEMENT_ENABLED` mặc định false, chỉ bật deploy sau kiểm chứng backend. Fixture dùng kho riêng `o365-approved-v2-management-fixture-v1`, version 1. Kho mock cũ giữ nguyên, slug cũ có thông báo và có reset dữ liệu mới. Mật khẩu fixture ở memory, reload dùng credential tổng hợp mặc định, revision phiên vẫn persist.
- Contract mới chốt MSSV chuỗi đúng 9 chữ số, VN mobile và gender male/female/other/null, chi tiết hơn user-information cũ. Đợt này áp dụng quyết định mới đã xác nhận, giữ tài liệu gốc.
- Backend cần kiểm tra HTTPS/cookie/CSRF, unique constraints, mọi quyền và trạng thái active, expiry/cooldown theo giờ server, giao dịch duyệt suất cuối, thu hồi phiên, quan hệ request/enrollment/user và phân quyền lịch sử. Chạy lại toàn bộ ca trên backend thật, gồm hai request đồng thời tranh suất cuối.
- Agenda cung cấp buổi sắp tới. Quiz/lesson management/library/inbox chưa nối API trong đợt này, menu chưa migrate đóng. Lịch sử Student chỉ tổng quát. Chưa tích hợp email. Web Locks mô phỏng ghi giữa tab, đồng thời thật phải do database bảo đảm. Fixture chỉ nghiệm thu frontend.

## Static export và nền tảng auth approved-v2 — 15/11/2026

Phạm vi được duyệt: static export, role/class/quiz routing, client/DTO/error và login/me/logout/đổi mật khẩu. Không nối các nghiệp vụ khác hoặc gọi backend thật. 12 file mới đã được người dùng duyệt trước khi tạo; giữ hai nguồn nghiệp vụ nguyên vẹn.

### Màn hình và file

| Khu vực | Đã hoàn thành trong đợt |
|---|---|
| Public `/`, `/course/`, `/login/` | Giữ giới thiệu/nhận diện và bàn phím/reduced motion. Login dùng AuthService, mật khẩu input không persist, fixture chọn ba role; hướng dẫn liên hệ Admin khi quên. Bản API mặc định đóng login đến khi bật sau kiểm chứng backend. |
| Role home và section | Prerender role/section biết trước; SessionGate kiểm tra User từ `/auth/me`, chặn sai role trước dữ liệu; lỗi mạng/5xx có retry, 401 hợp lệ về login. Giữ AppShell/drawer/component. |
| `/[role]/classes/?classId=…&tab=…` | Một trang tĩnh nhận ID mới sau build. Link lớp đã chuyển sang query; không sinh class ID allowlist. |
| `/student/classes/?classId=…&quizId=…` | Player fixture nhận ID mới sau build; API giữ trạng thái chưa nối dữ liệu, không giả Runner/Result. Role khác không được mở player Student. |
| `/[role]/profile/`, `/[role]/settings/` | Profile tự xem từ User DTO; staff profile null, Student MSSV/SĐT chuỗi. Đổi mật khẩu current/new/confirm, 12–72 UTF-8 bytes, lỗi hiện tại và xác nhận khớp; sau thành công đóng phiên/về login. |
| URL cũ | Teacher/teachers, class/quiz path cũ → resolver chung → query URL tương đương. Custom 404 cho ID chưa có HTML, JS chuyển tới trang có SessionGate. URL không hợp lệ không cấp quyền. |

File mới: `next.config.ts`; `src/config/routes.ts`; `src/lib/api/{client,dto,auth}.ts`; `src/mocks/api-fixture.ts`; `src/state/auth-provider.tsx`; `src/features/routing/{role-workspace,fixture-workspace}.tsx`; `tests/{api-client,api-auth,static-routes}.test.ts`.

File sửa: role layout/home/section, root layout/not-found và URL Teacher cũ; bỏ hai page động class ID/quiz ID; AppShell; login/session gate/public journey; profile/settings và các caller dialog; legacy mock provider chỉ phục vụ fixture; các link class/player/dashboard/calendar; package.json, README và references/báo cáo hiện có. Không thêm dependency, không tạo shell mới, không commit/push/deploy.

### Client, phiên và fixture

- `/api/v1` cùng origin, credentials include; không set Cookie/Origin hoặc dùng bearer token thủ công. Writes JSON, `{}` cho logout; envelope data/error, code/details/Retry-After; lỗi network/protocol riêng. DTO readers cho nullable, ID safe integer, cờ 0/1 và Page; User ánh xạ `class_manager` → `manager`, staff null và profile Student theo contract mới.
- CSRF từ login/me chỉ trong private memory của client; không vào storage hoặc DOM. Login/me/logout/change-password theo đúng bốn endpoint đã cung cấp. 401 envelope hợp lệ mới kết thúc phiên; lỗi mạng/5xx restore không được coi là logout. Unit RED→GREEN bảo vệ 401 cũ không xóa CSRF mới. Browser phát hiện race redirect sau đổi mật khẩu; đã thống nhất lý do anonymous trước khi redirect.
- Auth fixture dùng cùng transport interface, AuthService, envelope/DTO/error với API. Cookie selector tổng hợp công khai chỉ mô phỏng, không phải token an toàn/HttpOnly. Password fixture chỉ trong memory; reload reset credential tổng hợp. Backend guarantees không được suy từ fixture.
- Workspace nghiệp vụ cũ được lazy-load riêng ở chế độ fixture, vẫn có state/services v1–P3 để tiếp tục QA. Chúng **chưa đi qua DTO API nghiệp vụ**. Bản API không đọc mock, không mở menu nghiệp vụ chưa nối, không báo ghi thành công giả. Direct URL hợp lệ nhận trạng thái chưa khả dụng. Request/certificate SAU MVP không có menu/route hoạt động.
- Chế độ API đã quét artifact và không có tài khoản/mật khẩu mẫu, fixture cookie selector hoặc seed nghiệp vụ. Không chỉ ẩn control bằng CSS. Default deploy `NEXT_PUBLIC_AUTH_ENABLED=false`; chưa bật auth chỉ vì test fixture đã xanh.

### Kiểm tra thực tế

| Lệnh / kiểm tra | Kết quả |
|---|---|
| `npm.cmd test` | **108/108 PASS**, 0 fail/skip/cancelled; 99 baseline + 9 nhóm mới về client/DTO/auth/static URL. Baseline v1 còn lại không phải bằng chứng API nghiệp vụ đạt approved-v2. |
| `npm.cmd run lint` | PASS, không warning/error. |
| `npm.cmd run typecheck -- --incremental false` | PASS. Types dev sinh từ route ID cũ từng gây lỗi; đã dọn riêng generated `.next/dev/types`, không xóa source/data. |
| `npm.cmd run build` | PASS, **34 static pages**; không còn route cần Next runtime. Sinh `out/` và `.nojekyll`. Script next start cũ bỏ vì không hỗ trợ output export. |
| Build fixture + base path | `NEXT_PUBLIC_DATA_SOURCE=fixture`, `NEXT_PUBLIC_BASE_PATH=/lms-qa`: PASS; **6 nhóm browser PASS** qua HTTP server tĩnh, gồm public/ba role, wrong-role/URL Teacher cũ, tạo lớp sau build và reload, thêm Quiz sau build và player reload, restore lỗi/401, đổi mật khẩu/logout/mobile drawer. |
| Build API mở chỉ để QA | `NEXT_PUBLIC_DATA_SOURCE=api`, `NEXT_PUBLIC_AUTH_ENABLED=true`, base path rỗng: PASS; **7 nhóm browser PASS** với HTTP responses tổng hợp chặn tại browser; ba role, cookie + me reload, wrong-role, ID số mới, network/503 retry/401, CSRF + body và cookie clear sau logout/change-password. Không gọi server thật. |
| Artifact mặc định cuối đợt | API, auth chưa mở, base path rỗng: **1 nhóm browser PASS**; không control fixture, không gọi `/api/v1`, không ghi local/sessionStorage. Quét output không có fixture/seed, `.nojekyll` có mặt. |
| UI/accessibility/assets | Tổng **14 nhóm smoke**, 3 lượt axe (fixture class detail, API password, default login 375px) 0 violation theo WCAG 2 A/AA/2.1 AA tags. Fixture layout 320/375/768/1440px ổn định, drawer Escape; 0 pageerror và 0 asset lỗi trong các lượt cuối. Không phải chứng nhận WCAG toàn bộ ứng dụng. |

Scripts/JSON/ảnh kiểm tra ở temp `o365-static-*`; không thêm Playwright/axe vào dependencies. Các build đều local, không chạy GitHub Pages hoặc reverse proxy thật. URL query đã thử HTTP 200 và reload; legacy ID path chưa có HTML trả 404 đầu tiên rồi JS replace sang query, cần custom 404 trên host và JS bật. Đây không phải HTTP 301/308 phía server.

### Ca bắt buộc chạy lại với backend

1. Hostname/SITE_ORIGIN chính xác, HTTPS, project base path/assets trên Pages và reverse proxy `/api/v1` cùng origin; không tự chuyển sang API subdomain/CORS.
2. Cookie HttpOnly/Secure/SameSite thật, X-CSRF-Token/Origin thật; login ba role, me reload, logout, đổi/reset mật khẩu, suspend/restore và thu hồi mọi phiên theo server.
3. 401 đã xác nhận, 403 role/CSRF, network/5xx và retry; stale responses, nhiều tab, outcome chưa rõ sau write. Fixture không chứng minh bảo mật/race server hoặc persistence thật.
4. User DTO/profile/nullable và lỗi thật; endpoint phân trang, flags, details/Retry-After. Profile cập nhật, Student validation input và grant Assignment chưa nối ở đợt này.
5. Class/quiz/enrollment/Attendance/dashboard/Library/inbox/progress cần adapter nghiệp vụ và kiểm thử riêng trước khi mở trên API deploy; không dùng seed hoặc phép tính mock thay dữ liệu API.

Chưa chạy backend/API/DB, load/security, Safari/Firefox/thiết bị thật hoặc GitHub deployment. Không sửa workflow/user-information; SHA256 vẫn khớp các giá trị ghi ở P3 bên dưới.

## Cập nhật P3 — Workflows 4 và 5, ngày 15/11/2026

**Frontend v2 — mock.** Rà lại công việc dở từ hôm trước, hoàn thiện tích hợp và kiểm chứng; dừng ở bài học/lịch/Attendance. Không gọi API, dựng backend/database hoặc thay đổi hai nguồn nghiệp vụ.

| Role / route | Hành vi đã triển khai trên mock | Service / regression |
|---|---|---|
| Manager · `/manager/classes/[classId]?tab=lessons` | Lưu nháp trên buổi cố định; tiêu đề, mô tả, giờ Việt Nam, link/địa điểm tùy chọn, tài liệu cùng lớp và mã demo. Gửi một đề xuất pending/buổi; xem phản hồi và gửi lại. Không đổi buổi đang diễn ra/đã kết thúc. | `lessons.ts`: saveLesson, submitSchedule; `tests/lessons.test.ts`. |
| Admin · `/admin/schedule-approvals` | Menu Duyệt lịch riêng, chi tiết đề xuất, approve/reject; reject bắt buộc lý do. Chỉ duyệt schedule, không gộp correction/nghỉ-bù/alert 24h. | decideSchedule; lịch đã duyệt có hiệu lực ngay, giữ cùng lesson ID. |
| Student · Class Detail `tab=lessons`, `/student/schedule`, dashboard | Chỉ thấy buổi đã duyệt hoặc lịch sử legacy đã học; pending/reject giữ nguyên ngày/giờ, tiêu đề, địa điểm, mã và tài liệu chính thức cũ. Calendar tháng/ngày và upcoming dùng approved ngay. | effectiveSchedule/getLessonStatus; selectors/dashboard; kiểm tra chuyển tháng và dữ liệu xuyên role. |
| Student · Attendance | Nhập mã trong `[start,end)`; ba sai khóa theo buổi/cycle qua reload; thành công khóa nhập và retry không tăng credit. Mất quyền/hết hạn không truy cập nội dung. | getAttendanceStatus/enterAttendance; unit đúng start/end và trước start, idempotency, scope/cycle. |
| Manager / Admin · Attendance | Manager hiện phụ trách override từ start trở đi, kể cả sau end khi lớp còn hạn, bắt buộc lý do; audit actor/time/before/after/reason theo cycle. Bỏ credit chặn mã khôi phục; chỉ override tiếp mới phục hồi. Admin chỉ xem. Staff còn xem bảng/lịch sử sau hết hạn, không thay đổi. | overrideAttendance/getAttendanceHistory; chặn Admin/Student/Manager cũ/khác lớp/suspended, trước giờ, hết hạn, thiếu lý do; giữ record cycle cũ. |
| Student / Manager · Xin nghỉ | Tự duyệt khi buổi chưa kết thúc, gửi lý do cho Manager, không credit; chặn khi đã attended. Theo quyết định người dùng, Manager được xác minh và override sau xin nghỉ, giữ đơn/lý do nghỉ riêng. | requestAbsence; thông báo, không thay enrollment, chỉ override cấp credit. |

Đã gỡ nút/queue/alert confirm 24h, nghỉ-bù và đề nghị Admin sửa Attendance khỏi luồng P3; service cũng từ chối command cũ. Dashboard không còn câu “chờ xác nhận”; link xử lý lịch dẫn thẳng Duyệt lịch. Requests tổng hợp lọc các flow Attendance/nghỉ-bù đã hoãn. Quiz correction v1 chưa migrate được dẫn tới tab Quiz, không lẫn vào queue lịch.

Kho demo giữ namespace `o365-hust-lms-demo-v2`, **schema 4**. P1/schema 2 và P2/schema 3 nâng có thông báo, giữ tài khoản/phiên/cycle/credit; confirmed → approved, đóng pending flow đã hoãn, bỏ alert confirmation. `lessonWorkflowVersion: 2` giúp migration idempotent; `attendanceOverrides` là lịch sử riêng. Không khôi phục được dữ liệu từng bị v1 xóa. Dữ liệu legacy completed thiếu schedule vẫn được giữ dưới dạng lịch sử, không tự bịa phê duyệt mới.

### Kiểm tra thực tế P3

| Kiểm tra | Kết quả cuối |
|---|---|
| `npm.cmd test` | **99/99 PASS**, 0 fail/skip/cancelled. Trong đó **12/12** nhóm v2 ở `tests/lessons.test.ts`. Thay 15 nhóm v1 bằng 12 nhóm đúng v2; không giữ assertion confirm/correction đã hoãn chỉ để giữ số test P2 102. |
| `npm.cmd run lint` | PASS, không warning/error. |
| `npm.cmd run typecheck -- --incremental false` | PASS. |
| `npm.cmd run build` | PASS, Next.js production build; không thêm route động ngoài App Router hiện có. |
| Chrome headless · production localhost 3022 | **10 nhóm smoke PASS**: draft/pending; reject/sửa/approve; giữ lịch cũ; ba sai qua reload; override/bỏ credit/Admin đọc; absence/override; sau end/calendar; schema 3→4; responsive/keyboard; history lớp hết hạn. Dùng tài khoản và dữ liệu tổng hợp, clock mô phỏng. |
| Accessibility / responsive | 3 lượt axe trên queue Admin, bảng Attendance Manager và lesson Student 375px: **0 violation** theo WCAG 2 A/AA, 2.1 AA tags. Viewport 320/375/768/1440px ổn định không tràn trang. Dialog mở bằng Enter, đóng Escape/trả focus; reduced motion bật. **0 pageerror** trong smoke cuối. Không coi đây là chứng nhận accessibility toàn hệ thống. |
| Nguồn nghiệp vụ | SHA256 workflow `E5807B6A5327F51330C63B540587F303C839B072BC6E7D3DEEF358CF318581F8`; user information `0734DB71340C792CF5700357E72E64DA3E4EEE731A055B469EAC3E3ED1C91C66`, khớp trước đợt. |

Các lượt đầu phát hiện warning import không dùng, tên fixture browser sai và thiếu hiển thị Attendance cho staff sau hết hạn; đã sửa. Test migration mới ban đầu thiếu mockGeneration trong fixture; bổ sung đúng metadata như provider. Phép đo ngay lúc đổi viewport từng báo overflow 320px; không tái hiện ở layout ổn định, đo lại sau 300ms đạt cả bốn độ rộng. Không thêm CSS che tràn để làm xanh phép đo. Ảnh Student 375px đã xem trực tiếp. Scripts/JSON/ảnh nằm trong thư mục temp (`o365-p3-*`), không thêm Playwright/axe vào dependencies repo.

File chính: `features/lessons/{lesson-form,lesson-workspace,lesson-attendance,lesson-status}.tsx`, `features/schedules/{approval-queue,schedule-calendar}.tsx`, dashboard-parts/navigation/AppShell; `types/lms.ts`, `mocks/state.ts`, `demo-storage.ts`, provider; services lessons/communications/synchronization; tests lessons/enrollment-cycles/progress-certificates. README, architecture/screen/checklist được cập nhật. Giữ các thay đổi từ đợt trước, không tự commit/push.

### Backend và phần chưa nghiệm thu

- Server phải tự kiểm tra phiên/role/Manager hiện tại/enrollment cycle/lớp còn hạn, cửa sổ thời gian `[start,end)` và mã; client không cấp quyền bảo mật thật.
- Transaction/constraints cho một proposal pending/buổi, quyết định chỉ một lần, cập nhật lịch/nội dung nguyên tử; giữ approved cũ đến khi commit. Không sửa lịch đang diễn ra/đã xong; kiểm tra lịch không vượt hạn lớp.
- Unique credit `(lesson,cycle)`, counter ba sai chống race/retry, quyết định override chặn mã, audit bất biến với actor/time/before/after/reason; absence và audit override giữ riêng. Kiểm thử concurrent clients thật, clock authoritative và timezone Việt Nam.
- Persist thông báo đúng người, projection/history đúng scope/cycle, tiến độ tính lại từ credit; schema migration backend và kiểm thử tích hợp riêng. Browser/Web Locks không thay transaction đa máy.
- **Chưa chạy** API/DB, bảo mật/tải, Firefox/Safari/thiết bị thật hoặc browser fallback không có Web Locks. Chưa migrate Quiz 2/3 thời lượng/pause, Library HTTPS, inbox v2 hoặc Completed độc lập; các flow certificate/seal/exception v1 còn ở đợt sau. P3 bỏ alert lịch, chưa gỡ synchronization certificate của đợt khác. Không tuyên bố toàn bộ MVP/production đã hoàn tất.

## Cập nhật P2 — Workflows 2 và 3, frontend v2 trên mock

Đợt này chỉ migrate quản lý lớp/enrollment và phần cycle/history cần thiết; không coi các hành vi v1 khác đã đạt v2. Hai quyết định người dùng đã chốt: history tính lại từ record đúng cycle/ngưỡng hiện hành, không phục hồi quyền; lớp hết hạn chỉ đọc trong phạm vi đợt này, chưa mở lại/gia hạn.

- Admin Class Form giữ tạo/sửa tên/mã/mô tả, Manager, capacity, hạn và hai ngưỡng; ngày phải tồn tại trong lịch, còn hiệu lực đến hết ngày Việt Nam. Không hạ capacity dưới approved; đổi Manager có lý do/xác nhận, owner mới nhận pending queue, owner cũ bị chặn. Manager đặt tổng buổi đúng một lần, không thực hiện khi hết hạn.
- Student tìm/lọc/preview lớp, gửi/hủy pending; cancel không tăng decline hoặc reset cooldown/lý do bị từ chối. Đúng 10 phút mới gửi lại, lý do khác lần decline, tối đa ba decline theo cặp Student–lớp. Queue kiểm tra lại owner, account, capacity, trạng thái request và expiry khi quyết định.
- `enrollmentCycles` lưu từng lần đã được duyệt; approve mới tạo cycle riêng, remove kết thúc cycle có thời gian/lý do. Attendance/attempt/draft/grant cũ giữ nguyên, không DELETE để reset. Selectors/player/results/Attendance cô lập cycle; lượt cũ vẫn auto-finalize lịch sử nhưng không nhận answer hoặc cộng điểm vào lần mới. Stale command/request context không tác động cycle/request mới.
- `/student/classes?view=history` và `?tab=history` trong Class Detail cho aggregate lịch sử độc lập với chứng chỉ; staff xem trong scope lớp. Removed/expired chặn Student nội dung nhưng giữ history của mình. Lịch sử chỉ có số liệu/trạng thái, không answer key, mã Attendance hoặc link lesson/Quiz/material.
- Namespace giữ `o365-hust-lms-demo-v2`, payload nâng lên schema 3. P1/schema 2 được migrate có notice, giữ tài khoản/generation/phiên; không khôi phục được record đã bị demo v1 xóa. Hydrate/migration và mutation chung Web Lock; không ghi đè snapshot schema 3 chỉ vì reload. Dữ liệu v1/hỏng vẫn dùng recovery xác nhận.
- Thêm Tiến thêm 10 phút trong clock. Browser tìm thấy bước tiến dùng giờ UI cũ ngay sau reload; đã sửa để tính từ kho mới nhất trong lock, thêm unit regression.

| Kiểm tra P2 thực tế | Kết quả |
|---|---|
| `npm.cmd test` | **102/102 PASS**, 0 fail/skip/cancelled; 11 nhóm test mới trong `tests/enrollment-cycles.test.ts`, cập nhật assertion v1 từng yêu cầu xóa attempt khi tái ghi danh. |
| Lint / TypeScript / build | `npm.cmd run lint`, `npm.cmd run typecheck -- --incremental false`, `npm.cmd run build`: PASS. |
| Browser mock | **12 nhóm PASS**: tạo lớp/fixed sessions, preview/request/cancel, suất cuối, reassignment, capacity validation, remove/history, re-enroll/reload, cooldown/ba decline, Vietnam expiry, P1 migration/session, race đồng thời và responsive. |
| Race | Hai Manager tab cùng duyệt hai request tranh một chỗ: một approved, một lỗi đủ sĩ số, một pending còn lại; Chrome có Web Locks. |
| UI/accessibility | 320/375/768/1440px không tràn trang ngoài vùng cuộn có chủ đích; 3 lượt axe trên Class List/history: 0 violation theo WCAG 2 A/AA và 2.1 AA tags. 0 pageerror trong tập smoke cuối. |
| Nguồn nghiệp vụ | Không sửa workflow/user-information gốc; SHA256 được đối chiếu cuối đợt. |

File chính: Class Form/Detail/List, Enrollment Action/Queue/History, types/state/provider/storage, `class-policy.ts`, `enrollment-cycles.ts`, `enrollment-history.ts`, `demo-clock.ts`; progress, lesson/quiz selectors và các view được chỉnh để không đọc nhầm cycle. Phần sửa ở Quiz/Attendance phục vụ tách cycle, không triển khai quy tắc P3/P4 mới. Fixtures được normalize khi khởi tạo; mock services giữ actor/session/scope hiện có.

Browser scripts/JSON/ảnh viewport lưu trong thư mục temp; không thêm Playwright/axe vào dependency repo. Lượt chụp full-page khi mở nhiều tab gặp lỗi capture của Chrome; ảnh viewport 375px được chụp và kiểm tra sau khi đóng tab dư. Các ca chức năng/layout cuối đều PASS.

Backend phải triển khai transactions/unique constraints cho capacity, một cycle hiện hành, credit/attempt/grant; kiểm tra owner/session/cycle/request revision trên mỗi thao tác; clock và expiry Việt Nam authoritative; giữ dữ liệu cũ, chặn answer sau mất quyền, finalize vào cycle cũ và trả projection lịch sử đúng scope. Mock browser/Web Locks không bảo đảm concurrency đa máy hoặc bảo mật thật. Chưa chạy API/DB, load/security tests, browser không có Web Locks, Safari/Firefox hoặc thiết bị thật. Không tự thực hiện đợt kế tiếp.

## Cập nhật P1 — Workflows 1 và 11, frontend v2 trên mock

Phần này ghi nhận đợt triển khai sau audit v1; các phần bên dưới giữ làm lịch sử. Không khẳng định đã migrate toàn bộ Workflows 2–10/12.

- `/` giới thiệu CLB, `/course` giới thiệu khóa học và `/login` dùng copy v2, có đường đi thẳng login, nút/bàn phím thay vuốt và reduced motion. Navy–trắng với teal hiện có làm accent tạm theo lựa chọn của người dùng; chưa phải màu CLB chính thức.
- Teacher chuyển thành Manager trong types, navigation, services, fixtures và tests; Admin giữ nguyên. `/teacher`/đường con hợp lệ và `/admin/teachers` redirect sang `/manager`/đích tương đương và `/admin/managers`; class/tab hợp lệ được giữ. `SessionGate` kiểm tra phiên và role trước khi hiển thị AppShell/nội dung, còn services kiểm tra scope lớp/tài khoản.
- Tái sử dụng Accounts List cho Admin: bộ hồ sơ Student đầy đủ, email đúng domain/unique không phân biệt hoa thường, MSSV unique dạng chuỗi, SĐT chuỗi, giữ số 0 đầu; giới tính tùy chọn. Profile của mình chỉ đọc; Manager xem hồ sơ Student enrolled trong lớp phụ trách qua dialog roster; Admin sửa qua directory.
- Người dùng đã chọn **mã demo công khai theo phiên bản cấp phát**, thay việc lưu mật khẩu người nhập. Đổi/reset tăng `credentialVersion` và `sessionVersion`, thu hồi phiên cũ; suspend/restore chỉ tăng `sessionVersion`, giữ mã, enrollment và phân công. Registry và per-tab session chỉ là metadata mô phỏng, không phải token/session an toàn thật. Không gửi email; hướng dẫn cấp phát thủ công và liên hệ Admin khi quên mật khẩu.
- Namespace `o365-hust-lms-demo-v2`, schema 2 và sessionStorage `o365-hust-lms-demo-v2-session`. Kho v1/hỏng/không tương thích có thông báo và khôi phục xác nhận; không âm thầm ghi đè kho v1 hoặc xóa storage ứng dụng khác. Reset generation thu hồi phiên của dataset trước.

### File/route chính bị ảnh hưởng

`src/app/page.tsx`, `/course`, `/login`, role layout/section, các legacy redirects; AppShell/demo controls/navigation; `src/types/lms.ts`, provider, seed/state; `accounts-list.tsx`, `account-profile.tsx`, `account-settings.tsx`; `features/auth/*`, `services/accounts.ts`, `authentication.ts`, `session-command.ts`, `mocks/demo-storage.ts`, `config/legacy-routes.ts`. Hai component Teacher Dashboard/Quiz đổi tên thành Manager và các tham chiếu role được cập nhật xuyên source/tests. `tests/auth.test.ts` có 8 regression mới; script npm test đã bao gồm file này.

### Kiểm tra thực tế của đợt P1

| Kiểm tra | Kết quả |
|---|---|
| `npm.cmd test` | **91/91 PASS**, 0 fail/skip/cancelled: 83 ca hồi quy cũ đồng bộ role/fixture và 8 ca auth/profile/storage/legacy mới. |
| `npm.cmd run lint` | PASS. |
| `npm.cmd run typecheck -- --incremental false` | PASS. |
| `npm.cmd run build` | PASS; lần đầu sandbox chặn ghi `.next`, chạy lại với quyền được cấp thành công; bản cuối cũng build PASS. |
| Browser smoke Chrome headless | **11 nhóm PASS**: public/keyboard/reduced motion; logged-out/wrong-role URL; ba role login; legacy redirects; reset/đổi/logout; suspend/restore giữ dữ liệu; domain/email/MSSV/leading zero; responsive; v1 recovery. Smoke phiên được chạy lại trên bản build cuối. |
| Route regression | **34 lượt route role/detail/tab**, 0 pageerror trong tập đã chạy. Không khẳng định đã thao tác mọi chức năng ngoài P1. |
| Responsive | 320, 375, 768 và 1440px: public và Accounts List không tràn trang ngoài vùng bảng cuộn chủ ý. |
| Axe | **10 lượt quét** public/login, profile/settings ba role và dialog thêm Student: 0 violations theo tags WCAG 2 A/AA và 2.1 AA. Không phải chứng nhận accessibility toàn hệ thống. |
| Nguồn nghiệp vụ | SHA256 workflow và user-information không thay đổi trong đợt P1. |

Browser scripts/JSON/ảnh được lưu ở thư mục temp của phiên thực hiện, dùng Playwright/axe sẵn có và profile cách ly; chưa thêm browser runner/CI dependency vào repo. Chưa chạy Safari/Firefox, thiết bị thật, screen reader, API/DB, mail delivery, mật khẩu thật hoặc kiểm thử bảo mật đa máy.

### Handoff và giới hạn P1

Backend phải thực hiện bootstrap Admin, mật khẩu thật theo quy tắc 12–72 UTF-8 bytes/hash, login/logout/reset/change, session revocation, authorization/scope trên mọi request, unique email/MSSV, validation/schema hồ sơ và lưu lịch sử thích hợp. Mã demo công khai/metadata client không chứng minh bất kỳ bảo đảm bảo mật nào. Không chọn auth provider hoặc định nghĩa endpoint trong đợt này.

Các hành vi v1 còn lại như confirmation 24h, pause Assignment, Admin correction, Requests nâng cao và certificates vẫn thuộc các đợt migration sau. Chuyển role xuyên những module đó chỉ đồng bộ tên/quyền role hiện có, không phải đã triển khai nghiệp vụ v2 của chúng. Hai tài liệu nghiệp vụ gốc không bị sửa để hợp thức hóa mock.

## Kết luận và phạm vi

Frontend có các workflow mock hoạt động xuyên Admin, Teacher và Student, dùng chung localStorage và mock services. **Chưa đủ căn cứ để gọi là production-ready.** Chưa có backend, xác thực thật, phân quyền phía server, kho tệp hay dịch vụ email/chứng chỉ thật.

Đối chiếu mã nguồn với LMS skill thực tế tại `frontend.agents/skill/skills.md`, toàn bộ Workflows 1–12, design system, screen specification, frontend architecture và UX checklist. Áp dụng các quyết định đã chốt trong hội thoại, đặc biệt chính sách mô phỏng Test, chốt kết quả trước cấp chứng chỉ, ngoại lệ/thu hồi phải duyệt chéo và lịch sử theo lần ghi danh.

Người dùng xác nhận trong đợt audit:

- Chỉ ghi nhận thiếu các trang giới thiệu, đăng nhập/quên mật khẩu, hồ sơ/cài đặt; chưa bổ sung các màn hình này.
- Chưa triển khai xóa dữ liệu lớp hết hạn vì điều kiện và phạm vi xóa chưa được định nghĩa đủ.
- Xóa kết quả Quiz áp dụng **từng lượt làm**, giữ lịch sử và tính lại điểm cao nhất từ các lượt còn hợp lệ.
- Sau khi Admin xóa Attendance, khóa nhập mã lại cho buổi đó; Teacher được ghi nhận thủ công trong giờ học sau khi xác minh lại.

Không sửa `user-workflow-guideline.md`. SHA256 trước/sau: `A686B4F9E73126696814A9958AB88FD016A8C241A20A030926F6B3A5ECDC0EB2`.

Các chỉnh sửa UI từ lượt polish trước audit được giữ nguyên, không hoàn tác. Không bổ sung backend hoặc thay AppShell/navigation.

## Findings theo mức độ

### Critical

Không phát hiện lỗi Critical trong phạm vi frontend mock và các kịch bản đã kiểm tra. Đây không phải kết luận về bảo mật production: người dùng vẫn có thể đổi vai trò demo và sửa dữ liệu/câu trả lời trong trình duyệt. Backend authentication, authorization, authoritative grading và lưu trữ giao dịch là điều kiện bắt buộc trước khi dùng thật.

### Major đã sửa

| ID | Phát hiện và tác động | Bản sửa / bằng chứng |
|---|---|---|
| M01 | Deep-link `?tab=quizzes` của Admin đi vào `StudentQuizzes`, có thể dùng ngữ cảnh tài khoản Student từ trang Admin. | Tạo `AdminQuizzes` để xem kết quả và điều chỉnh; tách nhánh role rõ ràng. Browser kiểm tra Admin không có nút bắt đầu bài. |
| M02 | Workflow 4 thiếu đề nghị xóa điểm Quiz, phê duyệt/từ chối và Admin xóa trực tiếp. | Thêm `quiz-corrections.ts`, thao tác trong lịch sử từng attempt, tích hợp hàng đợi/Requests. Lưu điểm gốc, số lượt, lý do, người/thời điểm vô hiệu hóa; giữ attempt, không sửa điểm gốc, không công bố đáp án. |
| M03 | Sau khi Admin xóa Attendance trong giờ học, Student có thể nhập lại mã để lấy lại điểm. | Theo quyết định mới của người dùng, lưu `codeEntryRevoked`; chặn tự nhập lại và giải thích trong UI. Teacher vẫn phải ghi lý do xác minh để điểm danh thủ công. Migration áp dụng cho bản ghi đã bị xóa có thông tin lịch sử. Unit và browser test qua ba vai trò. |
| M04 | Tiến độ giảng dạy ở danh sách lớp dùng `state.referenceTime` cũ, không cập nhật khi đồng hồ đi qua giờ kết thúc. | Dùng cùng `now` của provider khi gọi selector. Browser fixture tái hiện trước sửa: 67% → 67%; sau sửa: 67% → 75%, không cần thao tác khác. |
| M05 | Lịch quá hạn xác nhận có cảnh báo ở hàng đợi nhưng không tự tạo thông báo cho Admin. | `synchronizeLessonAlerts` gửi một thông báo mock/Admin/phiên bản lịch, qua pipeline đồng bộ chung; không cảnh báo buổi đã hoàn thành/lớp hết hạn. Browser ba tab xác nhận chỉ một thông báo. |
| M06 | Nộp Quiz cập nhật điểm nhưng thiếu thông báo Đạt/Chưa đạt cho Student. | Thông báo khi nộp thủ công, hết thời gian hoặc đến deadline; idempotent, không chứa đáp án. |
| M07 | UI cấm mở lại Assignment trước hạn nhưng mock service vẫn chấp nhận. | Kiểm tra cùng điều kiện ở service; fixture cấp lượt được cập nhật để dùng Assignment đã hết hạn. |
| M08 | Validation dữ liệu lưu chưa từ chối ID trùng hoặc request trỏ đến Quiz không tồn tại/khác lớp. | Kiểm tra uniqueness và các tham chiếu Quiz/attempt cùng lớp, cùng Student; validate metadata điều chỉnh. Khi tái ghi danh, hủy correction đang chờ của lần cũ, giữ lịch sử yêu cầu đã xử lý. |
| M09 | Nút trở về ở placeholder/404 luôn dẫn sang Admin; deep-link tab Học viên bị bỏ qua và một số tab không được phép cho ra vùng nội dung rỗng. | Trở về đúng vai trò; hỗ trợ deep-link tab Học viên; tab ngoài quyền về Tổng quan. Trang 404 có landmark và nút dùng chung. |
| M10 | Lớp hết hạn còn pending retake/Attendance correction không thể đóng yêu cầu, khiến chốt kết quả bị kẹt vĩnh viễn. | Cho đúng Teacher/Admin từ chối kèm lý do sau khi hết hạn; không cho mở lại/cấp lượt hay thay điểm bằng thao tác này. Đồng bộ trạng thái nút Quiz của lớp hết hạn. Unit và browser kiểm tra đóng cả hai yêu cầu, chốt và cấp chứng chỉ mock thành công. |

Correction Quiz đang chờ chặn chốt kết quả lớp. Khi vô hiệu hóa kết quả, fingerprint chốt kết quả thay đổi, tiến độ được tính lại và chứng chỉ thông thường có thể chuyển Under review; snapshot đã cấp không đổi. Chứng chỉ ngoại lệ giữ chính sách đã được người dùng chốt. Các trường hợp này có unit test.

### Major còn thiếu, được người dùng cho phép để ngoài phạm vi

| Workflow | Thiếu gì | Trạng thái |
|---|---|---|
| 1 | Giới thiệu đơn vị, giới thiệu khóa học, đăng nhập, quên/đổi mật khẩu bằng xác thực email. `/` hiện chuyển tới `/admin` demo. | Chưa triển khai; không giả lập thành xác thực thật. |
| 11 | Hồ sơ và cài đặt tài khoản tự phục vụ cho Teacher/Student, đổi mật khẩu. | `/[role]/profile` và `/[role]/settings` là placeholder được ghi nhãn. |
| 2 | Dọn dữ liệu lớp hết hạn sau khi hoàn tất xét chứng chỉ/ngoại lệ. | Chưa có thao tác xóa; cần chốt điều kiện và retention trước khi triển khai. |

### Minor còn lại / điểm kiến trúc cần theo dõi

- Giao diện vẫn pha một số thuật ngữ tiếng Anh: Approve/Reject, Test/Assignment, Course materials trong tiêu đề thư viện của lớp và tên trạng thái chứng chỉ. Không thay đổi mã trạng thái nghiệp vụ.
- `QuizResults` còn tự tính điểm cao nhất hợp lệ từ các lượt nộp, thay vì gọi selector `getBestValidScore`. Hiện kết quả tương đương và các bài kiểm tra đều đạt; nên hợp nhất khi chỉnh module kết quả lần tới.
- Một số URL không hợp lệ trả giao diện 404 qua HTTP 200 khi route được stream. Browser xác nhận hiển thị trang không tìm thấy; cần xử lý status/SEO khi hoàn thiện public routing/deployment.
- Một số nhãn phụ trong AppShell/dashboard nhỏ hơn cỡ caption khuyến nghị 12–13px. Không tìm thấy lỗi tương phản trong các lượt axe đã chạy, nhưng cần kiểm tra thêm trên thiết bị thật và với người dùng.

## Màn hình và route đã triển khai

| Phạm vi | Route / màn hình | Mức hoàn thiện frontend |
|---|---|---|
| Admin | `/admin` | Dashboard KPI, lớp, tiến độ, lịch chờ, hoạt động và quick actions từ dữ liệu chung. |
| Admin | `/admin/students`, `/admin/teachers` | Tìm/lọc, thêm/sửa thông tin, xác nhận vô hiệu hóa/khôi phục. Không tạo mật khẩu/email. |
| Admin | `/admin/classes`, `/admin/classes/[classId]` | Tạo/sửa lớp, phân công Teacher, sĩ số/hạn/ngưỡng; tổng quan, học viên, tiến độ, buổi học, Quiz review, tài liệu và lịch. |
| Admin | `/admin/schedule-approvals` | Chi tiết và duyệt/từ chối lịch, xin nghỉ, Attendance, từng lượt Quiz; cảnh báo xác nhận và xử lý lịch bù. |
| Teacher | `/teacher`, `/teacher/classes`, Class Detail | Chọn lớp/phụ trách nhiều lớp, số buổi cố định, học viên/enrollment, bài học, lịch, tài liệu, Quiz builder/preview/publish/results/retake. |
| Student | `/student`, `/student/classes`, Class Detail | Continue Assignment, lớp đã đăng ký/tìm lớp/yêu cầu, preview, đăng ký/hủy, buổi học/điểm danh/nghỉ, Quiz và tiến độ riêng. |
| Student | `/student/schedule` | Calendar, tháng/ngày và các buổi đã được Admin duyệt, kể cả đang chờ Teacher xác nhận. |
| Student | `/student/classes/[classId]/quizzes/[quizId]` | Player tập trung, điều hướng câu hỏi, timer, chọn đáp án, xác nhận nộp/mô phỏng, kết quả/lịch sử. Role khác không được vào player. |
| Cả ba | `/[role]/library` và tab Tài liệu | Tìm/lọc lớp/buổi/Document–Video/trạng thái; metadata mock, quyền truy cập và expiration. Teacher thêm/gỡ, Admin gỡ kèm lý do. |
| Cả ba | `/[role]/notifications`, `/[role]/requests` | Hộp thư/đã gửi, soạn theo phạm vi được phép, đọc/chưa đọc; yêu cầu tách riêng, lọc trạng thái, phản hồi và liên kết tới màn hình nghiệp vụ. |
| Cả ba | `/[role]/certificates` và tab Tiến độ | Attendance/Quiz tách riêng, eligibility, chốt kết quả, khiếu nại, ngoại lệ, duyệt chéo/timeout, lịch sử chứng chỉ/snapshot/email mock. |
| Toàn cục | Loading/error/not-found, drawer, role/account/time demo controls | Có trạng thái và điều hướng phản hồi; công cụ demo có nhãn và xác nhận cần thiết. |

Các khu vực không có URL riêng như Lesson Detail, Quiz Builder, Approval Detail và Attempt History được triển khai bằng tab/dialog trong màn hình hiện có; không coi chúng là màn hình thiếu chỉ vì không có route riêng.

Không tìm thấy AppShell/sidebar/navigation bị nhân bản. Có một cấu hình navigation theo role và các thành phần chung: Button/Card/Badge/Dialog/Sheet, StatCard/ClassCard/ProgressCard/StatusBadge, Field/ActionForm/ConfirmAction/DataTable, Feedback/Toast/EmptyState/LoadingState. Không phát hiện nút chết trong các luồng đã thử; không khẳng định đã bấm mọi tổ hợp nút và trạng thái có thể có.

## Workflow mock đã kiểm tra

| Nhóm | Bằng chứng thực thi |
|---|---|
| Account/Class | Unit test: email trùng, quyền/suspend, giữ enrollment, capacity, expiration, đổi Teacher chuyển quyền duyệt; browser: form thêm tài khoản, lỗi trùng email, feedback/focus thành công. |
| Enrollment | Browser: Student hủy yêu cầu, gửi lại không mất lượt, Teacher duyệt, Student được truy cập xuyên tab và tiến độ từ 0. Unit: cooldown 10 phút, lý do mới, tối đa 3 decline, full/expired, quyền và tái ghi danh. |
| Lesson/Schedule | Browser: Teacher tạo draft, gửi, Admin reject kèm lý do, sửa/gửi lại, approve, Teacher confirm, Student thấy lịch trước xác nhận nhưng chưa điểm danh. Unit: chính xác mốc 24 giờ, lịch bù cùng slot, kiểm soát xin nghỉ và lịch bù riêng, bảo toàn lịch cũ khi đề xuất sửa chưa duyệt. |
| Attendance | Browser: đổi giờ demo, ba lần sai khóa mã, Teacher điểm danh thủ công, đề nghị xóa/Admin duyệt, nghỉ được tự duyệt nhưng không tính Attendance; bổ sung kiểm tra khóa nhập lại sau Admin xóa và Teacher xác minh lại. |
| Quiz | Browser: tạo/publish Test và Assignment; Assignment nộp sớm đạt 100; Test không có nộp sớm, mô phỏng thoát có xác nhận nhận 0; request retake/Teacher cấp lượt và hạn, thông báo Admin; tạm dừng/tiếp tục Assignment. Unit: deadline/timer auto-submit, giới hạn mặc định, best valid score, idempotence, khóa nội dung sau attempt, quyền/expiry và tách attempts. |
| Quiz correction | Browser: Teacher chọn một attempt, gửi đề nghị, Admin duyệt, Student thấy kết quả hợp lệ thay đổi; Admin vô hiệu hóa trực tiếp lượt khác. Unit: từ chối phải có lý do, không tự xóa bởi Teacher, giữ điểm gốc, xử lý stale request, chặn chốt và đưa chứng chỉ thường vào review khi tụt ngưỡng. |
| Library | Browser: Teacher thêm metadata, Student lọc/xem từ thư viện và bài học, Admin gỡ kèm lý do và Teacher nhận phản hồi. Unit: YouTube exception, file expiration, class expiry, mất enrollment/assignment/suspend và gỡ attachment. |
| Notifications/Requests | Browser: Student gửi Teacher, Admin broadcast có loại trừ và dedup, hộp thư/đọc/chưa đọc/đã gửi, Student/Teacher gửi yêu cầu tự do, Approve/Decline và phản hồi xuyên tab. |
| Progress/Certificates | Browser fixtures: chốt kết quả/cấp mock/log email, điều chỉnh Attendance → Under review → đề xuất/duyệt thu hồi; khiếu nại → Teacher chuyển → Admin duyệt ngoại lệ; tự quyết sau 24 giờ; điểm phục hồi giữ Issued và hủy pending revoke; đề xuất Admin phải do Teacher duyệt; snapshot khi lớp hết hạn; lịch sử khi tái ghi danh. Unit: 2 track, denominator, dedup, thresholds, seals, exceptions, revoked không tự cấp lại và certificate races. |

## Kiểm tra thực tế và kết quả

Production build phục vụ tại `http://localhost:3011` khi kết thúc audit. Trình duyệt dùng local Chrome headless, Playwright, dữ liệu localStorage/context cách ly; không sửa dữ liệu demo trong profile trình duyệt đang dùng của người dùng.

| Kiểm tra | Kết quả |
|---|---|
| `npm.cmd run lint` | PASS. |
| `npm.cmd run typecheck -- --incremental false` | PASS. |
| `npm.cmd run build` | PASS; các route động của role, section, class và quiz player được build. |
| `npm.cmd test` | **83/83 PASS**, không skip; tăng từ 73 bài trước audit bằng các regression cho lỗi đã tìm được. |
| Route/browser crawl | **261** lượt mở màn hình: 28 entry của navigation/tài khoản/hàng đợi, các tab theo role trên 3 lớp, 18 player Quiz và các lượt responsive/deep-link. |
| Liên kết nội bộ | **52** URL lấy từ các trang được mở tiếp trong browser; **0** liên kết hỏng trong tập này. |
| Đường dẫn không hợp lệ | Kiểm tra 7 trường hợp unknown role/section, màn hình sai role và player sai role; đều hiện giao diện không tìm thấy. Phân biệt HTTP status với giao diện 404 như ghi nhận ở Minor. |
| Responsive | Crawl tại 320, 768, 1280, 1440px; kiểm tra bổ sung 375px và dialog landscape 667×375. **0** tràn ngang ngoài vùng bảng cuộn trong tập đã kiểm. |
| Axe | **29** lượt quét các trang navigation + Admin Quiz tại desktop: **0** violations theo WCAG 2 A/AA, 2.1 AA tags. Thêm 3 lượt quét error dialog, Quiz Builder và focused player: **0** violations. Không phải chứng nhận WCAG toàn hệ thống. |
| Keyboard/states | Focus trap và Escape/return focus của drawer/dialog; drawer đóng khi sang desktop; nhãn form; lỗi được focus; toast đóng được; chọn đáp án bằng bàn phím; reduced motion; skeleton ban đầu; long-dialog scroll đều đã thử. |
| Runtime | **0 pageerror** ở route crawl và các smoke workflows đã hoàn thành. |
| Source integrity | `git diff --check` đạt; workflow source giữ nguyên SHA256. |

Browser scripts và ảnh kiểm tra ở thư mục temp `lms-verify` của phiên làm việc; chưa cài Playwright vào project hoặc tạo pipeline E2E trong CI. Unit regressions được lưu trong `tests/management.test.ts`, `tests/lessons.test.ts`, `tests/quizzes.test.ts`, `tests/progress-certificates.test.ts` và chạy bằng script test hiện có.

## Phần chỉ hiển thị / phụ thuộc backend

- Hồ sơ/Cài đặt: placeholder có nhãn, không có form tự phục vụ; trang public/auth chưa có.
- File/video: thao tác metadata và access state có tác dụng mock; không upload, đọc nội dung, phát video hay download từ kho thật. Không có nút giả báo đã upload nội dung thành công.
- Chứng chỉ: record, snapshot, trạng thái, lịch sử và log email chạy mock; không phải chứng nhận chính thức, không có email thật, chữ ký hay hệ thống xác minh chứng chỉ.
- Authentication/RBAC: đổi vai trò/tài khoản là công cụ demo, không phải đăng nhập hay kiểm soát truy cập thật. Dữ liệu câu hỏi/đáp án trong client không được xem là bí mật an toàn.
- Thời gian và lịch: demo clock/timer/code/alerts hoạt động khi ứng dụng chạy hoặc đồng bộ lại; cần backend scheduler và clock để xác minh thời hạn, gửi thông báo khi không có tab mở và xử lý timezone đáng tin cậy.
- Bài thi: không dùng tab visibility/connectivity làm bằng chứng gian lận đáng tin. Test 0 điểm chỉ xảy ra khi người dùng chủ động mô phỏng và xác nhận theo yêu cầu đã chốt. Lifecycle persistence của Assignment là best effort.
- Dữ liệu/giao dịch: cần database, transactions, audit log bất biến, API validation và server authorization. Web Locks được dùng để đồng bộ mock nhiều tab khi trình duyệt hỗ trợ; fallback không đảm bảo giao dịch nguyên tử như backend.

## Giới hạn kiểm chứng và việc còn lại

Chỉ chạy Chrome headless trên Windows; chưa kiểm trên Safari/Firefox, thiết bị iOS/Android thật, NVDA/VoiceOver, mạng yếu/đứt thực tế, tải lớn, đa người dùng từ nhiều trình duyệt/máy hoặc bảo mật triển khai. Browser event detection và localStorage có thể bị chỉnh sửa; không chứng minh được tính toàn vẹn kỳ thi.

Các lần thi lại trong cùng lần ghi danh giữ attempts riêng và điểm cao nhất hợp lệ. Khi tái ghi danh, implementation hiện bắt đầu lại bằng cách xóa attendance/attempts cũ, giữ chứng chỉ/snapshot và lịch sử quyết định đã lưu; chưa có kho lưu trữ toàn bộ chi tiết attempt theo từng cycle. Nếu cần lưu trọn lịch sử học tập nhiều lần ghi danh, phải bổ sung thiết kế retention/API.

Các gap public/auth, self-service profile/password và class cleanup vẫn còn như người dùng đã xác nhận. Không tự triển khai milestone tiếp theo hoặc quyết định chính sách retention chưa được duyệt.
