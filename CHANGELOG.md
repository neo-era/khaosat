# CHANGELOG

## v1.0.0 — 2026-05-27

### Lần phát hành đầu — Đầy đủ chức năng

**KTV (`user1`)**:
- 15 form khảo sát render động từ schema JSON.
- Header tiếng Việt NGUYÊN VĂN khớp Google Sheets.
- Trường "Người khảo sát" auto-fill từ tài khoản đăng nhập, readonly.
- Lấy GPS tự động + nút retry, accuracy 6 chữ số.
- Chụp ảnh nhiều file → nén client-side (max 1600px, JPEG 0.8) → upload song song Cloudinary.
- Auto-save draft `localStorage` mỗi 5s, khôi phục khi mở lại form.
- Offline queue: submit lúc mất mạng → tự đồng bộ khi online.
- PWA: cài lên màn hình chính, mở như app native.

**Admin (`admin` / `user`)**:
- Trang **KPI** (`kpi.html`): 5 chỉ tiêu chấm điểm KTV theo tháng (Tần suất / Chất lượng / Đa dạng / Đầy đủ / Ổn định), xếp loại A/B/C/D, biểu đồ cột SVG drill-down, export CSV.
- Trang **Quản lý bản ghi** (`manage.html`): filter đa chiều, soft-delete (xoá ảnh Cloudinary + đánh dấu Deleted At), khôi phục bản chữ.
- Trang **Báo cáo** (`report.html`): 3 vùng (bảng tổng quan / stacked bar chart timeseries / pivot KTV×Loại), 4 preset thời gian, export CSV combined.

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
- `manage.html` dropdown filter KTV chưa load (sẽ có v1.1).
- Apps Script `kpi`/`report` chậm với data lớn (chấp nhận v1).
