# CHANGELOG

## v2.3.0 — 2026-11-09 — Đúng dữ liệu (chi tiết: `docs/v2.3.0-thiet-ke.md`)

### Ngày giờ
- Máy chủ hiểu `from`/`to` dạng `yyyy-MM-dd` là 00:00–23:59 **giờ Việt Nam** (`parseDayBound_`) ở danh sách, báo cáo, xuất dữ liệu thô. Trước đây "hôm nay" ở Biên bản hiện trường ra 0 bản, mất các bản 0h–7h.
- Máy lấy ngày "hôm nay / tháng này" theo giờ máy (`localDateStr`), bỏ `toISOString().slice(0,10)` ở 7 trang.

### Không trùng, không mất khi mất mạng
- `client_id` cho mỗi bản mới; gửi lại / hàng chờ gửi 2 lần → máy chủ trả STT cũ, không ghi dòng mới (sheet phụ `client_ids`, tự dọn sau 90 ngày).
- Hàng chờ chuyển sang **IndexedDB**, mang theo **ảnh chụp lúc mất mạng** (tải lên khi có mạng). Tự chuyển hàng chờ cũ từ localStorage.
- Bản từ hàng chờ dùng **giờ bấm Lưu** làm Ngày khảo sát (≤ 72 giờ — anh Lâm chốt).
- Chỉ gửi bản của **người đang đăng nhập**; bản của tài khoản khác giữ lại, báo tên. Đăng xuất không xoá hàng chờ.
- Không chạy gửi hàng chờ chồng nhau (Web Locks). Lỗi phân loại mạng / máy chủ bận (thử lại có giãn cách) / dữ liệu sai (đánh dấu "cần sửa", bấm 📥 để mở lại form) / hết phiên.
- Ảnh tải lỗi không phải do mạng → chặn Lưu (trước bị bỏ qua im lặng). Bản nháp giữ cả ảnh đã tải.

### Máy chủ kiểm dữ liệu
- `FIELD_RULES` (sinh từ `js/schemas.js`, có test đồng bộ): thiếu trường bắt buộc, số đếm < 1 hoặc lẻ, số đo ≤ 0, số không bắt buộc âm/không phải số → từ chối, nêu tên trường. Nhận dấu phẩy thập phân, nhận 0 ở trường không bắt buộc. Năm lắp đặt không giới hạn khoảng.
- Máy chưa cập nhật (không gửi `client_id`): lỗi dữ liệu chỉ thành cảnh báo (giai đoạn chuyển tiếp).
- Toạ độ ngoài TP.HCM / (0,0) / đảo → vẫn lưu, bỏ trống toạ độ + link, cảnh báo.
- Báo cáo sự cố: Ngày giờ phát hiện ở tương lai bị từ chối.
- Chống chèn công thức thêm ở tài liệu, lịch công tác, họ tên, nhập Excel (nhập Excel không áp FIELD_RULES).

### Lưu vết
- Sửa bản ghi: chỉ kiểm trường đổi; Audit ghi `Trường: cũ → mới`.
- Xoá: **bắt buộc lý do** (≥ 5 ký tự) ghi Audit; **không xoá bản Nghiệm thu**; hỏi thêm khi xoá bản Đã thi công.
- Khôi phục: lấy ảnh Drive ra khỏi thùng rác, báo số ảnh lấy lại được.
- Sheet thiếu cột so với `HEADERS`: vẫn ghi, cảnh báo, Audit `header_mismatch` ghi giá trị bị rơi.
- Biên bản hiện trường escape chữ người dùng nhập.

### Vòng duyệt kết quả (nghiệp vụ)
- Báo cáo sự cố: phát hiện cũ hơn 30 ngày → cảnh báo; ô ngày giờ phải đúng mẫu `yyyy-MM-dd HH:mm` (chặn "09/11/2026" bị hiểu kiểu Mỹ).
- **Biên bản hiện trường chọn bản theo Ngày khảo sát** (ngày ra hiện trường), không theo lúc gửi lên.
- Bản "cần sửa" mở lại form giữ mã chống trùng + giờ bấm Lưu gốc; chỉ rời hàng chờ khi gửi lại thành công.
- Lý do xoá cần ít nhất 5 chữ/số.

### Vòng duyệt kết quả (QA)
- Bản "cần sửa" mở lại form **đọc thẳng từ hàng chờ** (`form.html?type=…&queue=…`): giữ ảnh chưa tải, toạ độ hiện trường (không lấy GPS chỗ đang ngồi sửa), không ghi đè bản nháp đang có.
- Hàng chờ cũ (trước v2.3.0) không ghi người tạo → **không tự gửi**; trang chủ hỏi người đang đăng nhập có nhận không.
- Bản gửi lỗi quá 8 lần → "cần sửa", không chặn các bản sau. Máy không có IndexedDB → hàng chờ dùng localStorage (không nhận ảnh chờ mạng, báo rõ).
- Mã chống trùng của hàng chờ cũ suy từ id cũ (chuyển 2 lần vẫn cùng mã); dọn `client_ids` chạy trong khoá.

### Chưa đổi (cần anh chốt sau)
- **KPI và Báo cáo tổng hợp vẫn tính theo `Submitted At`** (lúc máy chủ nhận): bản gửi trễ qua ngày cuối tháng sẽ rơi sang tháng sau.

### Triển khai — Apps Script TRƯỚC, frontend sau
1. Dán `apps-script/Code.gs` (đã gồm v2.2.1) → Triển khai → Quản lý → sửa → **Phiên bản mới**.
2. Frontend v2.3.0 (`sw.js` → `khaosat-v33`) vẫn chạy được với máy chủ cũ; máy chủ mới chạy được với frontend cũ (trừ nút Xoá ở trang Quản lý bản cũ — cần lý do, sẽ báo lỗi rõ).

## v2.2.1 — 2026-11-09 — 🔒 Vá bảo mật khẩn (rà soát tổng thể 09/11/2026)

### Lỗ hổng đã vá (đều có test chứng minh trong `tests/security.test.mjs`)
- **Chiếm tài khoản qua "Quên mật khẩu"**: `reset_own_password` cho đặt mật khẩu mới chỉ bằng username + họ tên, không cần đăng nhập, không giới hạn số lần. → **Tắt hẳn** ở máy chủ, bỏ form trên `login.html`. Quên mật khẩu: admin cấp mật khẩu tạm ở `users.html`.
- **Đọc file Drive bất kỳ** (`photo_base64`): mọi token, kể cả demo, đọc được mọi file Drive của người deploy. → Chỉ đọc **ảnh** nằm trong `DRIVE_FOLDER_ID`; demo bị chặn; bỏ đường tải HTTP dự phòng.
- **Xoá file Drive bất kỳ khi xoá bản ghi** + **stored XSS** qua URL ảnh do client tự khai. → Máy chủ chỉ nhận URL ảnh Drive `uc?export=view&id=` hoặc Cloudinary đúng cloud; chỉ chuyển vào thùng rác ảnh trong thư mục app. Frontend chỉ đặt link `https://` (`safeHref`) ở bản đồ, băng rôn, quản lý bản ghi. Email báo admin escape URL.
- **Dò mật khẩu không giới hạn** → sai 5 lần khoá 5 phút theo tên đăng nhập (đếm cả tên không tồn tại, không phân biệt hoa/thường).
- **Token**: định dạng mới `v2` có thời điểm đăng nhập + số phiên bản mật khẩu.
  - Đổi mật khẩu / admin đặt lại mật khẩu → **mọi phiên cũ bị đăng xuất** (người vừa đổi nhận token mới).
  - Hạn tuyệt đối: phiên thường 12 tiếng, phiên "ghi nhớ" 1 năm kể từ lúc nhập mật khẩu; `refresh` không còn nâng phiên 8 tiếng thành 1 năm.
  - `must_change` chặn ở **máy chủ** (trước chỉ chặn ở trình duyệt).
  - So chữ ký token không phụ thuộc thời gian.
- **`upload_photo`**: demo bị chặn; chỉ nhận JPEG/PNG ≤ 10 MB; thư mục chỉ `khaosat/<loại>`, `khaosat/banve/<loại>`, `Bangron`; tên file được làm sạch.
- **Chèn công thức vào Sheets** (submit/update): chuỗi bắt đầu bằng `= + @` (hoặc `-` không phải số) lưu dạng chữ. Các đường ghi khác (bulk import, lịch, sổ BBHT…) làm ở v2.3.0.
- Vòng duyệt chuyên gia: chống chèn công thức cả cột User Agent và khi có khoảng trắng/BOM đứng trước; bộ đếm sai mật khẩu tăng trong `LockService` (gửi song song không lách được); `change_password` dùng chung giới hạn 5 lượt; ghi Audit `login_locked`; URL Cloudinary chỉ nhận thư mục `khaosat/`, `Bangron/` và nhận cả cloud mặc định của frontend.
- Lỗi trả về không còn kèm `stack`. `randomPassword` dùng nguồn ngẫu nhiên an toàn.

### ⚠️ Việc admin phải làm khi triển khai — ĐÚNG THỨ TỰ
1. **Frontend trước**: đẩy code lên GitHub Pages (`sw.js` lên `khaosat-v32`). Đợi ~1 ngày làm việc để máy đã cài app nhận bản mới (app tự cập nhật khi mở). Frontend mới chạy được với Apps Script cũ.
2. **Sau đó mới Apps Script**: dán `apps-script/Code.gs` mới → **Triển khai → Quản lý → sửa → Phiên bản mới** (giữ nguyên URL). Nếu làm ngược lại, máy còn bản app cũ sẽ báo "Phiên đăng nhập đã hết hạn" mà không tự về trang đăng nhập.
3. **Mọi người phải đăng nhập lại 1 lần** (token định dạng cũ bị từ chối — cố ý, vì phiên cũ có thể đã bị chiếm). Hàng chờ offline được giữ, đăng nhập lại là tự gửi.
4. Tab **Audit** của Google Sheets: lọc cột action = `reset_own_password`. Dòng nào không phải do chính chủ làm → đặt lại mật khẩu tạm cho tài khoản đó ở `users.html`.
5. Kiểm tra Script Property `CLOUDINARY_CLOUD_NAME` (nếu có) — máy chủ nhận cả giá trị này và `dmlsqbe8c` của frontend.
6. Khuyến nghị: chạy `benchmarkHash()` rồi nâng `PWD_ITERS` (đang 100).
7. Ai bị khoá do người khác cố tình nhập sai: tự mở sau 5 phút (chưa có nút mở khoá cho admin).

### Chạy test
`node --test "tests/*.test.mjs"` (Node ≥ 21, có dấu nháy). Lệnh `node --test tests/` ghi trong `_harness.mjs` không chạy trên Node 22 — đã sửa chú thích.

## v2.2.0 — 2026-09-09 — Duy trì đăng nhập · sửa chọn ảnh trên điện thoại · ranh hành chính trên bản đồ

### Duy trì đăng nhập
- `login.html` thêm ô **"Ghi nhớ đăng nhập trên máy này"** (mặc định bật). Bật → token **1 năm** lưu `localStorage`, còn nguyên sau khi đóng trình duyệt. Tắt → giữ như cũ: token 8 tiếng trong `sessionStorage`.
- `Code.gs`: thêm `TOKEN_TTL_REMEMBER_MS` (1 năm), `generateToken(username, ttlMs)`, và **endpoint mới `action=refresh`** gia hạn token còn hiệu lực mà không cần nhập lại mật khẩu.
- `js/auth.js`: `requireAuth()` tự gọi refresh ngầm khi token còn dưới 180 ngày → người dùng đều đặn không bao giờ bị đăng xuất. Refresh lỗi (mất mạng) thì bỏ qua, không đá user ra ngoài.
- ⚠️ **Phải deploy lại Apps Script Web App** (tạo version mới) thì phần này mới có tác dụng — hạn token nằm trong chữ ký, sửa client không đủ.
- ⚠️ Thu hồi 1 phiên "ghi nhớ" (vd mất điện thoại): đặt `active = FALSE` cho user đó trong sheet `taikhoan`, có hiệu lực ngay ở request kế tiếp.

### Sửa lỗi: điện thoại không chọn được ảnh từ thư viện
- Nguyên nhân: input ảnh có `capture="environment"` → Android/iOS mở thẳng camera và **bỏ hẳn** lựa chọn ảnh có sẵn, dù nhãn nút ghi "Chụp ảnh / Chọn từ thư viện".
- Sửa: tách thành **2 nút** — "📷 Chụp ảnh" (có `capture`) và "🖼️ Thư viện" (không `capture`). Áp dụng cho cả ảnh hiện trường lẫn trường "Bản vẽ".
- Kèm sửa: dùng `setAttribute('capture', ...)` thay cho gán property `el.capture = ...` — Chrome không phản chiếu property này nên cách cũ không có tác dụng.

### Bản đồ: lớp ranh hành chính
- `map.html` thêm lớp **ranh giới 168 phường/xã TP.HCM sau sáp nhập 2025** (+ 8 xã khu Cần Giuộc), bật/tắt bằng layer control, hiện tên phường khi zoom ≥ 13.
- Dữ liệu `data/ranh-hanh-chinh-2025.geojson` (176 vùng, 528 KB) sinh bởi `tools/build-ranh-hanh-chinh.mjs` từ ThangLeQuoc/vietnamese-provinces-database (MIT). **Không sửa tay file .geojson** — sửa script rồi chạy lại.
- `sw.js`: `CACHE_NAME` lên `khaosat-v5` để đẩy bản mới cho máy đã cài PWA.

## v2.1.0 — 2026-08-16 — 🔒 Bảo mật: mật khẩu ra khỏi Google Sheets

### Sự cố phát hiện
- Sheet `taikhoan` (username + `password_hash` + họ tên + vai trò) **bị publish ra internet** qua URL CSV trong `js/config.js`. Kiểm chứng bằng `curl`: HTTP 200, tải về được toàn bộ, không cần đăng nhập.
- `SETUP.md` trong repo **public** ghi thẳng mật khẩu plaintext của 10 tài khoản (kể cả `admin`).
- ⇒ Bất kỳ ai cũng đăng nhập được quyền admin. **Toàn bộ mật khẩu cũ phải coi là đã lộ.**

### Khắc phục
- **Kho mật khẩu mới**: Script Properties `CRED_<username>`, salt riêng từng user + HMAC-SHA256 lặp `PWD_ITERS` vòng (cũ: SHA-256 1 vòng, salt dùng chung, lưu ngay trong sheet).
- **Bỏ cột `password_hash`** khỏi sheet `taikhoan` — sheet chỉ còn danh bạ.
- **Bắt đổi mật khẩu lần đầu**: trang `doi-mat-khau.html` mới + cờ `must_change`; admin đặt mật khẩu tạm, Người khảo sát tự đặt mật khẩu riêng. Admin không biết mật khẩu thật của ai.
- **Endpoint `change_password`** — mọi role đăng nhập tự đổi mật khẩu của mình.
- **Bỏ `sheetsCsvUrl`** khỏi `js/config.js` (không code nào dùng) + gỡ Bước H publish-to-web trong SETUP.md.
- **Xoá mật khẩu plaintext** khỏi SETUP.md. *(Git history vẫn còn — đó là lý do bắt buộc đổi hết mật khẩu.)*
- Thêm `PWD_PEPPER` (tách khỏi `AUTH_SALT`): đổi pepper không đá văng phiên đăng nhập, đổi salt không làm hỏng mật khẩu.
- Hàm quản trị mới: `benchmarkHash()`, `resetAllPasswords()`, `setPasswordThuCong()`. `migrateTaikhoan()` chuyển thành lỗi thời.
- Tương thích ngược: user chưa migrate vẫn đăng nhập bằng hash cũ, hệ thống tự chuyển sang kho mới + bắt đổi.

### Việc admin phải làm
1. Dừng publish Google Sheets ra web.
2. Dán `Code.gs` mới → chạy `benchmarkHash()` → chỉnh `PWD_ITERS` → Deploy new version.
3. Chạy `resetAllPasswords()` → phát mật khẩu tạm riêng cho từng người.

---

## v1.0.0 — 2026-05-27

### Lần phát hành đầu — Đầy đủ chức năng

**Người khảo sát (`user1`)**:
- 15 form khảo sát render động từ schema JSON.
- Header tiếng Việt NGUYÊN VĂN khớp Google Sheets.
- Trường "Người khảo sát" auto-fill từ tài khoản đăng nhập, readonly.
- Lấy GPS tự động + nút retry, accuracy 6 chữ số.
- Chụp ảnh nhiều file → nén client-side (max 1600px, JPEG 0.8) → upload song song Cloudinary.
- Auto-save draft `localStorage` mỗi 5s, khôi phục khi mở lại form.
- Offline queue: submit lúc mất mạng → tự đồng bộ khi online.
- PWA: cài lên màn hình chính, mở như app native.

**Admin (`admin` / `user`)**:
- Trang **KPI** (`kpi.html`): 5 chỉ tiêu chấm điểm Người khảo sát theo tháng (Tần suất / Chất lượng / Đa dạng / Đầy đủ / Ổn định), xếp loại A/B/C/D, biểu đồ cột SVG drill-down, export CSV.
- Trang **Quản lý bản ghi** (`manage.html`): filter đa chiều, soft-delete (xoá ảnh Cloudinary + đánh dấu Deleted At), khôi phục bản chữ.
- Trang **Báo cáo** (`report.html`): 3 vùng (bảng tổng quan / stacked bar chart timeseries / pivot Người khảo sát×Loại), 4 preset thời gian, export CSV combined.

**Demo (`demo`)**:
- Đăng nhập + xem form, banner cảnh báo, nút Lưu disabled.

**Backend (Apps Script)**:
- 7 endpoint: `login` / `submit` / `list` / `delete` / `restore` / `kpi` / `report`.
- Mật khẩu hash SHA-256 + salt (server-side).
- Token stateless HMAC-SHA256, TTL 8h.
- Rate limit login 5 fail/phút → khoá 5 phút.
- PERMISSIONS đọc runtime từ sheet `phan quyen` (cache 60s), fallback DEFAULT hardcode.
- Cloudinary destroy khi soft-delete.
- Audit log mỗi delete/restore.
- Hàm `initSheets()` tự tạo 15 sheet KS + KPI_Targets + phan quyen.
- Hàm `migrateTaikhoan()` chuyển sheet cũ (Vietnamese cols + plaintext password) sang format mới.

**Phân quyền**: 4 role (`admin` = `user` > `user1` > `demo`) với 5 action (`submit`, `delete`, `kpi`, `manage`, `report`).

**Dữ liệu lookup**:
- 102 phường/xã mới TP.HCM × 22 quận cũ.
- 903 tủ điều khiển (TĐK 2026).

### Stack
- HTML + Vanilla JS (ES6 modules) + Tailwind CDN.
- GitHub Pages hosting (repo Public).
- Google Sheets + Apps Script backend.
- Cloudinary unsigned upload + Admin API destroy.

### Tổng quan code
- 31 file (excluding `.git`, `.xlsx`, `.gitattributes`).
- ~8000 dòng (4291 JS + ~1167 Apps Script + 908 HTML + docs).

### Known limitations (xem README.md)
- `cloudinaryName` cần điền thủ công sau setup Cloudinary.
- `manage.html` dropdown filter Người khảo sát chưa load (sẽ có v1.1).
- Apps Script `kpi`/`report` chậm với data lớn (chấp nhận v1).
