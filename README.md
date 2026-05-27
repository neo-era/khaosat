# Khảo sát chiếu sáng SAPULICO

Web app cho **kỹ thuật viên (KTV) SAPULICO** khảo sát hiện trường hệ thống chiếu sáng đô thị TP.HCM. KTV nhập dữ liệu qua điện thoại (chụp ảnh, lấy GPS tự động), dữ liệu đẩy thẳng vào Google Sheets. Thay thế quy trình ghi giấy → nhập Excel văn phòng cũ.

- 🔗 **Mở app trên điện thoại**: https://<github-user>.github.io/khaosat/login.html (cập nhật sau khi deploy)
- 📊 **Google Sheets dữ liệu**: file `khao-sat-ke-hoach` (chỉ tài khoản SAPULICO truy cập)

---

## Dành cho KTV (role `user1`)

### 1. Đăng nhập lần đầu

1. Mở trình duyệt **Chrome** (Android) hoặc **Safari** (iPhone).
2. Vào URL ở trên.
3. Nhập **tên đăng nhập** và **mật khẩu** quản lý đã cấp.
4. Tick "Nhớ đăng nhập" để không phải gõ lại trong 8 tiếng.

### 2. Cài app vào màn hình chính (PWA)

Để mở nhanh như app:

**Android Chrome**:
- Bấm menu ⋮ (góc trên phải) → "Thêm vào màn hình chính" → đặt tên "KS Đèn" → Thêm.

**iPhone Safari**:
- Bấm nút Chia sẻ 📤 (giữa dưới) → "Thêm vào Màn hình chính" → đặt tên → Thêm.

Sau đó mở "KS Đèn" như app native.

### 3. Nhập khảo sát

1. Trang chủ — chọn 1 trong 15 loại khảo sát.
2. Cho phép lấy GPS khi trình duyệt hỏi.
3. Điền các trường (dấu `*` đỏ là bắt buộc).
4. Chụp ảnh hoặc chọn từ thư viện (nhiều ảnh được).
5. Bấm **Lưu**. App báo "Đã lưu STT #N".

### 4. Khi mất sóng

- App tự lưu draft mỗi 5 giây.
- Nếu submit lúc offline → bản ghi vào hàng chờ. Khi có mạng lại → tự đồng bộ.
- Mở `recent.html` để xem các bản đã submit hôm nay.

### 5. Đăng xuất

- Bấm menu góc phải → **Đăng xuất**. Token bị xoá. Đăng nhập lại nếu cần.

---

## Dành cho quản lý (role `admin` / `user`)

Sau đăng nhập, admin được đẩy thẳng vào **trang KPI**. Menu góc phải có thêm:

| Trang | Đường dẫn | Chức năng |
|---|---|---|
| **KPI** | `kpi.html` | Bảng chấm điểm KTV theo tháng — 5 chỉ tiêu, xếp loại A/B/C/D, export CSV |
| **Quản lý bản ghi** | `manage.html` | Tìm/xoá/khôi phục bản ghi cũ. Soft-delete (data có thể khôi phục, ảnh thì không) |
| **Báo cáo tổng hợp** | `report.html` | Tổng hợp số liệu theo loại / thời gian / KTV — bảng + biểu đồ + pivot, export CSV |

Sửa data trực tiếp trên **Google Sheets** (file `khao-sat-ke-hoach`) nếu cần điều chỉnh chi tiết — không có UI sửa trong app (an toàn).

---

## Phân quyền (4 role)

| Role | Đăng nhập | Submit | Xoá | KPI/Manage/Report |
|---|---|---|---|---|
| `admin` | ✓ | ✓ | ✓ | ✓ |
| `user` | ✓ | ✓ | ✓ | ✓ |
| `user1` | ✓ | ✓ | ✗ | ✗ |
| `demo` | ✓ | ✗ (xem thử) | ✗ | ✗ |

Tài khoản lưu trong sheet `taikhoan`. Admin tạo user qua Google Sheets (xem `SETUP.md` Bước D).

---

## Cài đặt & vận hành

Người setup (1 lần duy nhất): xem `SETUP.md`.

---

## Known Issues

_(Cập nhật sau khi hoàn tất test)_

---

## Liên hệ hỗ trợ

- Quản trị: `admin@sapulico.local` _(placeholder)_
- Mọi sự cố kỹ thuật: tạo issue trong repo GitHub.
