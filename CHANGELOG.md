# CHANGELOG

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
