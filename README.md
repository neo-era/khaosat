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
4. Lần đăng nhập đầu, app bắt **đặt mật khẩu riêng** — mật khẩu quản lý cấp chỉ là mật khẩu tạm. Đặt ≥8 ký tự, không trùng tên đăng nhập.

> Phiên đăng nhập kéo dài 8 tiếng và **mất khi đóng tab trình duyệt**. Đóng tab rồi mở lại thì phải đăng nhập lại.

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

Danh bạ tài khoản nằm trong sheet `taikhoan` (tên, họ tên, vai trò, trạng thái). **Mật khẩu KHÔNG nằm trong Google Sheets** — lưu riêng trong Script Properties dạng băm, mở file Sheets cũng không thấy.

Admin tạo/khoá user và đặt mật khẩu tạm qua trang **👥 Quản lý user** (`users.html`), không sửa sheet bằng tay. Xem `SETUP.md` Bước D.

---

## Cài đặt & vận hành

Người setup (1 lần duy nhất): xem `SETUP.md`.

---

## Known Issues

- **`js/config.js → cloudinaryName`** đang là placeholder `your-cloud-name`. Cập nhật giá trị thật từ Cloudinary Dashboard (SETUP.md Bước E) trước khi đi live, nếu không nút "Chụp ảnh" sẽ fail upload.
- **Trang `manage.html` — dropdown filter KTV** hiện rỗng (chỉ "Tất cả"). Workaround: dùng bộ lọc khác (loại / thời gian / search) hoặc mở Google Sheets xem trực tiếp. Sẽ thêm endpoint `apiUsers()` trong v1.1.
- **Khi xoá bản ghi (soft-delete) → ảnh Cloudinary xoá vĩnh viễn**, không khôi phục được. Đây là design intent (giải phóng storage Cloudinary free 25GB).
- **Apps Script `kpi` / `report` có thể chậm 3–8 giây** khi data >1000 bản. Nếu vượt 6 phút (quota free) sẽ timeout — chia nhỏ filter (chỉ 1 tháng/lần).
- **Token TTL 8 tiếng**. KTV làm việc xuyên đêm cần đăng nhập lại lúc sáng. Có thể tăng trong `js/config.js → sessionTimeoutHours` (nhưng cũng phải đổi `TOKEN_TTL_MS` trong Code.gs).
- **Sheet `Audit` chỉ tự tạo khi có lần delete/restore đầu tiên**. Trước đó sẽ không thấy sheet này — đúng design, không phải bug.
- **Repo PUBLIC trên GitHub** → URL Apps Script bị lộ. Bảo vệ qua token + role + rate limit. Đặt mật khẩu KTV mạnh ≥10 ký tự, mỗi người một mật khẩu riêng.
- **KHÔNG publish Google Sheets ra web.** Tháng 8/2026 từng bật nhầm, làm lộ cả sheet `taikhoan` ra internet. Đã tắt và bỏ `sheetsCsvUrl` khỏi `js/config.js`.

---

## Liên hệ hỗ trợ

- Quản trị: `admin@sapulico.local` _(placeholder)_
- Mọi sự cố kỹ thuật: tạo issue trong repo GitHub.
