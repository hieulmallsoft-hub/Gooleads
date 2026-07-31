# Hoàn thiện sản phẩm GG Ads

Tài liệu này mô tả các chức năng đã hoàn thiện, cách chúng hoạt động và cấu hình cần dùng khi triển khai.

## 1. Automation an toàn và có thể tạm dừng

### Chức năng

- Người có quyền `automation.manage` có thể chạy AI định kỳ, tắt lịch chạy và bật lại.
- Khi người dùng nhấn **Tắt**, lịch được vô hiệu hóa ngay. Lượt đang chạy hoàn tất mục đang gửi sang Google Ads nhưng kiểm tra lại lịch trước mỗi nhóm quảng cáo và không tạo thêm thay đổi mới.
- Lượt dừng giữa chừng được ghi trạng thái `PAUSED`.
- Mỗi lượt chạy cập nhật `last_heartbeat_at`. Backend dùng heartbeat thay vì chỉ dùng thời gian bắt đầu để phân biệt một lượt chạy lâu với một tiến trình thực sự bị treo.
- Mutation lỗi được ghi `FAILED`, không còn để yêu cầu con ở `APPLYING` vô thời hạn.
- Khi backend khởi động, yêu cầu `APPLYING` quá hạn được đóng an toàn với hướng dẫn đồng bộ và kiểm tra Google Ads. Hệ thống không tự gửi lại vì lần gọi cũ có thể đã thành công trên Google Ads.
- Khóa idempotency của yêu cầu thay đổi tiếp tục được lưu để phục vụ đối soát và chống thao tác trùng.

### Cách sử dụng

1. Vào **Cài đặt → AI định kỳ**.
2. Chọn chu kỳ và giới hạn số thay đổi.
3. Nhấn **Chạy ngay** để bật lịch và chạy lần đầu.
4. Nhấn **Tắt** khi muốn chuyển sang thay tài nguyên thủ công.
5. Sau khi tắt, các thay đổi đã áp dụng được giữ nguyên; người dùng vẫn thay văn bản, ảnh và video bình thường.

### Cấu hình

```env
AUTOMATION_POLL_INTERVAL_MS=60000
AUTOMATION_STALE_RUNNING_MINUTES=30
CHANGE_REQUEST_STALE_MINUTES=30
```

Migration `006_automation_recovery.sql` thêm heartbeat và chỉ mục cho truy vấn phục hồi.

## 2. Số liệu hiệu quả sau thay đổi

- Màn **Hiệu quả sau thay đổi** tìm kiếm và phân trang ở backend, không giới hạn tìm trong 100 dòng đã tải.
- So sánh cùng số ngày trước và sau thay đổi; ngày thay đổi được loại khỏi phép so sánh.
- Chỉ kết luận tăng hoặc giảm khi đã đủ toàn bộ cửa sổ 7, 14 hoặc 30 ngày.
- Có trạng thái chờ dữ liệu để tránh kết luận sai khi dữ liệu sau thay đổi chưa đủ.
- CTR và tỷ lệ chuyển đổi hiển thị theo phần trăm.
- Giá trị chuyển đổi/chi phí hiển thị theo phần trăm giống chỉ số tương ứng trong Google Ads.
- Nút **Đồng bộ Google Ads** lấy dữ liệu mới cho các thay đổi đang hiển thị.
- Chiến dịch và nhóm quảng cáo tạm dừng vẫn xuất hiện với trạng thái thực từ Google Ads.

### Cách sử dụng

1. Mở **Theo dõi thay đổi → Hiệu quả sau thay đổi**.
2. Chọn 7, 14 hoặc 30 ngày.
3. Nhập tên hoặc ID chiến dịch vào ô tìm kiếm.
4. Lọc theo AI tự động, AI đã duyệt hoặc thủ công.
5. Nhấn **Đồng bộ Google Ads** trước khi đánh giá dữ liệu mới nhất.

## 3. Lịch sử thay đổi

- Tìm kiếm toàn bộ database theo chiến dịch, nhóm quảng cáo, ID và nội dung liên quan.
- Lọc theo nguồn và trạng thái, phân trang ở backend.
- Nhấn một dòng để xem nội dung trước và sau thay đổi.
- Giao diện chi tiết chỉ trình bày dữ liệu hữu ích, không đưa khối JSON kỹ thuật ra màn hình chính.
- Hiển thị nguồn thay đổi: thủ công, AI được duyệt hoặc Automation.
- Hiển thị yêu cầu bị gián đoạn với lý do rõ ràng để người dùng không áp dụng lại mù quáng.

## 4. Giao diện tiếng Việt và responsive

- Sửa các nhãn tiếng Anh còn lại ở quản lý quy tắc từ khóa, phạm vi tài khoản và thông báo phê duyệt.
- Sửa cảnh báo React Hook bằng `useEffectEvent` và `useMemo`; lint không còn cảnh báo dependency.
- Việc đổi tài khoản, bộ lọc và màn hình sử dụng giá trị mới nhất mà không tạo vòng lặp tải API.
- Dựng lại trang **Hướng dẫn sử dụng** bằng tiếng Việt chuẩn.
- Trang hướng dẫn có hình mô phỏng đánh số vị trí cần nhấn khi chọn tài khoản, tìm chiến dịch, bật/tắt Automation, đồng bộ và xem hiệu quả.
- Hướng dẫn có mục xử lý lỗi, phân quyền và giải thích chỉ số.

## 5. Bảo vệ production

### Đã bổ sung

- Security headers: chống đoán MIME, chống nhúng iframe, referrer policy, permissions policy, cross-origin opener policy và HSTS trong production.
- Rate limit đăng nhập: 5 lần trong 15 phút cho mỗi địa chỉ máy khách.
- Rate limit AI, Automation và API thay tài nguyên: 20 lần/phút.
- Phản hồi `429` bằng thông báo tiếng Việt.
- Giới hạn JSON và form body mặc định 1 MB.
- Upload ảnh giới hạn 10 MB và service kiểm tra MIME được hỗ trợ.
- Chỉ đọc `X-Forwarded-For` khi quản trị viên bật `TRUST_PROXY`.
- CORS dùng danh sách domain từ `FRONTEND_ORIGIN`.

### Cấu hình production đề xuất

```env
NODE_ENV=production
DATABASE_SSL=true
DATABASE_SYNCHRONIZE=false
DATABASE_SEED_ENABLED=false
AUTH_COOKIE_SECURE=true
FRONTEND_ORIGIN=https://ads.example.com
TRUST_PROXY=true
JSON_BODY_LIMIT=1mb
FORM_BODY_LIMIT=1mb
```

Chỉ đặt `TRUST_PROXY=true` khi backend nằm sau reverse proxy do chính đơn vị vận hành quản lý. TLS/HTTPS nên kết thúc tại Nginx, Caddy hoặc load balancer; backend không nên mở trực tiếp ra Internet.

## 6. Kiểm thử

Các lớp kiểm tra hiện có:

- đăng nhập, cookie session, mật khẩu và phân quyền;
- quyền truy cập tài khoản/campaign;
- Google Ads query phân trang và trạng thái campaign/ad group đã tạm dừng;
- thay văn bản, ảnh/video và xử lý mutation lỗi;
- AI review và lưu quyết định;
- tính hiệu quả, tìm kiếm và phân trang lịch sử;
- Automation, múi giờ, giới hạn thay đổi và heartbeat;
- giao diện đăng nhập, tài nguyên, lịch sử, hiệu quả, Việt hóa và trang hướng dẫn;
- ESLint React Hook/accessibility, TypeScript và production build.

```powershell
cd backend
npm test
npx tsc --noEmit

cd ..\frontend
npm run lint
npm test
npm run build
```

Nếu Vite dev server đang khóa `.vite-temp`, chạy:

```powershell
npx vitest run --configLoader runner
```

## 7. Vận hành và triển khai

1. Chạy `npm run db:migrate` trong thư mục backend.
2. Đặt secret trong biến môi trường, không commit `.env`.
3. Tắt seed production và dùng mật khẩu quản trị mạnh.
4. Cấu hình HTTPS, CORS và cookie secure.
5. Chạy toàn bộ test, lint và build.
6. Kiểm tra `/health/database`.
7. Sao lưu PostgreSQL và thử khôi phục bản sao lưu.
8. Sau lần khởi động đầu tiên, kiểm tra lịch sử các yêu cầu từng bị `APPLYING`.

> Trạng thái `FAILED` do phục hồi không khẳng định Google Ads chưa thay đổi. Nó cho biết backend không nhận được kết quả cuối cùng. Hãy đồng bộ Google Ads và kiểm tra nội dung thực tế trước khi tạo yêu cầu mới.

## 8. Tối ưu tải màn hiệu quả và đồng bộ

- Tìm kiếm, nguồn thay đổi, kết quả, phân trang và tổng số được xử lý trực tiếp trong PostgreSQL.
- Backend chỉ đưa tối đa số dòng của trang hiện tại về Node.js, thay vì tải toàn bộ lịch sử vào RAM rồi lọc.
- Các index chuyên dụng được thêm cho thay đổi đã áp dụng và metric theo nhóm quảng cáo/ngày.
- Tổng quan tự làm mới mỗi 30 giây thay vì 5 giây và không gọi API khi tab trình duyệt đang ẩn.
- Đồng bộ màn hiệu quả tạo một `sync_batch_job` trong PostgreSQL rồi trả response ngay.
- Worker xử lý từng nhóm quảng cáo tuần tự để hạn chế quota Google Ads.
- Mỗi tài khoản chỉ có một job `PENDING` hoặc `RUNNING`, vì vậy bấm lặp không tạo nhiều lượt đồng bộ song song.
- Worker dùng `FOR UPDATE SKIP LOCKED`, an toàn khi sau này chạy nhiều backend.
- Giao diện hiển thị số nhóm hoàn thành, lỗi và nhóm đang xử lý; người dùng có thể chuyển sang màn khác trong lúc job chạy.

Cấu hình hàng đợi:

```env
SYNC_QUEUE_WORKER_DISABLED=false
SYNC_QUEUE_POLL_INTERVAL_MS=2000
```

Migration liên quan: `007_background_sync_jobs.sql`.

## 9. Đổi mật khẩu người dùng

- Mỗi người dùng có thể vào **Cài đặt → Đổi mật khẩu**.
- Người dùng phải nhập đúng mật khẩu hiện tại.
- Mật khẩu mới phải có ít nhất 10 ký tự, gồm chữ hoa, chữ thường, số và ký tự đặc biệt.
- Backend lưu mật khẩu bằng hàm băm `scrypt`, không lưu mật khẩu rõ.
- Sau khi đổi thành công, backend thu hồi toàn bộ session của người dùng và xóa cookie hiện tại.
- Giao diện đưa người dùng về màn đăng nhập để đăng nhập lại bằng mật khẩu mới.
- API: `POST /auth/change-password`.

## 10. Dữ liệu khi triển khai sang server mới

Migration chỉ tạo cấu trúc bảng, không tự chuyển dữ liệu từ PostgreSQL cũ. Nếu tạo database
`ggads` mới trên server thì tổng quan, lịch sử, đề xuất và dữ liệu đồng bộ ban đầu đều bằng 0.

Có hai cách đưa dữ liệu vào:

1. Sao lưu database PostgreSQL cũ bằng `pg_dump` rồi phục hồi vào server bằng `pg_restore`.
2. Giữ database mới và đồng bộ lại dữ liệu trực tiếp từ Google Ads. Cách này không khôi phục
   người dùng, lịch sử thay đổi và các quyết định AI đã lưu ở database cũ.

Trước khi đưa vào sử dụng chính thức cần chọn một trong hai cách. Không nên vừa phát sinh dữ
liệu mới trên server vừa phục hồi đè database cũ vì có thể tạo xung đột hoặc mất dữ liệu mới.

## 11. Phạm vi quy tắc từ khóa

Migration `008_creative_term_scopes.sql` bổ sung phạm vi cho quy tắc từ khóa:

- toàn tài khoản;
- một chiến dịch;
- một nhóm quảng cáo;
- thị trường áp dụng.

Migration này sửa lỗi API `creative-operations/terms` trả `Internal server error` trên database
được tạo hoàn toàn bằng migration. Migration chỉ bổ sung cột và index, không xóa quy tắc hiện có.

## 12. Phạm vi Automation theo chiến dịch và nhóm quảng cáo

- Automation là một mục độc lập trên thanh điều hướng, không nằm trong Cài đặt.
- Trang Automation chứa phạm vi, lịch chạy, giới hạn thay đổi, trạng thái và nút chạy/dừng.
- Cài đặt chỉ giữ kết nối, người dùng, mật khẩu và chính sách nội dung.
- Quản trị viên và biên tập viên có quyền Automation được thêm hoặc xóa phạm vi; người xem chỉ được xem.
- Quản trị viên chọn chiến dịch trước, sau đó tích riêng từng nhóm quảng cáo bên trong.
- Chọn chiến dịch không tự động chọn toàn bộ nhóm quảng cáo hiện tại hoặc tương lai.
- Worker chỉ xử lý các `ad_group_id` đã được lưu trong `creative_policy_scopes`.
- Không có nhóm quảng cáo được chọn thì Automation không chạy và API bật/chạy ngay trả lỗi rõ ràng.
- Chiến dịch hoặc nhóm quảng cáo đang tạm dừng sẽ bị bỏ qua.
- Sau bước đồng bộ, worker kiểm tra lại trạng thái trong PostgreSQL trước khi gọi AI và áp dụng.
- Nút Chạy ngay tuân thủ `max_changes_per_run` trong chính sách.
- Danh sách cấu hình đọc từ PostgreSQL, không gọi thêm Google Ads khi mở Cài đặt.

API lưu phạm vi:

```http
PUT /creative-operations/automation/scope?customerId=1234567890
Content-Type: application/json

{
  "campaignIds": ["2001"],
  "adGroupIds": ["1001", "1002"]
}
```

### Tải nhóm quảng cáo theo từng chiến dịch

- Màn Automation ban đầu chỉ tải và hiển thị danh sách chiến dịch, không trả toàn bộ nhóm quảng cáo của mọi chiến dịch.
- Khi quản trị viên bấm **Chọn nhóm quảng cáo**, frontend mới gọi API chi tiết cho đúng một chiến dịch.
- Danh sách chi tiết hiển thị hiệu quả 14 ngày của chiến dịch và từng nhóm quảng cáo: lượt hiển thị, lượt nhấp, CTR, chi phí, chuyển đổi và ROAS.
- Các chỉ số lấy từ dữ liệu đã đồng bộ trong PostgreSQL nên việc mở danh sách không phát sinh request Google Ads và không tiêu tốn thêm quota.
- Nhóm quảng cáo của chiến dịch khác không được tải hoặc hiển thị. Người dùng đóng chi tiết rồi mở chiến dịch khác khi cần.

API tải chi tiết một chiến dịch:

```http
GET /creative-operations/automation/scope/campaigns/2001?customerId=1234567890&days=14
```
