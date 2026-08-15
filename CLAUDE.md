# CLAUDE.md — Dự án Website Khảo sát Hiện trường Chiếu sáng Đô thị

> Tài liệu này là **nguồn chân lý duy nhất** cho Claude Code (hoặc AI khác) khi thực hiện dự án. Đọc kỹ toàn bộ file trước khi bắt đầu code.

---

## 1. Tổng quan dự án

### Mục tiêu
Xây website cho phép **kỹ thuật viên (KTV) khảo sát hiện trường** hệ thống chiếu sáng công cộng tại TP.HCM, nhập dữ liệu qua điện thoại (có chụp ảnh, lấy GPS), dữ liệu tự động đẩy vào Google Sheets. Thay thế cách làm hiện tại (KTV ghi giấy → nhập Excel văn phòng).

### Người dùng & phân quyền

Có 4 role, mỗi role có set quyền riêng. Trường `role` trong sheet `taikhoan` nhận 1 trong 4 giá trị: `admin`, `user`, `user1`, `demo`.

| Role | Đăng nhập | Submit form | Xoá bản ghi | Xem KPI | Quản lý bản ghi cũ | Xem báo cáo | Mô tả |
|---|---|---|---|---|---|---|---|
| `admin` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | Quản lý văn phòng |
| `user` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | Alias của admin (cùng quyền, khác tên cho lịch sử) |
| `user1` | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | **KTV hiện trường mặc định** — submit nhưng không xoá được |
| `demo` | ✓ | ✗ (readonly) | ✗ | ✗ | ✗ | ✗ | Chỉ xem form, dùng để đào tạo / demo |

**Quy ước**:
- Sau đăng nhập, frontend lưu `role` trong session và check quyền ở mỗi action.
- `admin` và `user` được xử lý như nhau trong code (dùng helper `isFullAccess(role)`).
- Apps Script verify quyền ở server-side, không tin client. Mọi endpoint kiểm role từ token.
- Trường "Người khảo sát" auto-fill từ `full_name` của user đã đăng nhập (readonly).

### Phạm vi
- **16 loại khảo sát** (mỗi loại là 1 form độc lập, ghi vào 1 sheet riêng trong Google Sheets).
- Mỗi bản ghi có thể đính kèm **nhiều ảnh hiện trường**.
- Có **lấy GPS tự động** (cho các form khảo sát tuyến).
- **Có đăng nhập** — username + password lưu trong sheet `taikhoan` của cùng file Google Sheets. Mật khẩu hash SHA-256 + salt. **4 role** (`admin`/`user`/`user1`/`demo`) với 3 mức quyền (xem bảng dưới).
- **Trang KPI cho quản lý** (`admin`/`user`) — đọc lại data từ Google Sheets qua Apps Script, tính KPI theo tháng cho từng KTV.
- **Trang quản lý bản ghi** (`admin`/`user`) — tìm/xoá/sửa bản ghi cũ. Dùng **soft-delete** (đánh dấu `Deleted At`, không xoá thật) để khôi phục được khi lỡ tay.
- **Xoá ảnh Cloudinary** kèm khi soft-delete bản ghi (qua Cloudinary Admin API, dùng `api_key`/`api_secret` lưu trong Script Properties).

### Các nguyên tắc quan trọng (đọc kỹ)
1. **Header Google Sheets phải giữ NGUYÊN VĂN tiếng Việt** giống file Excel gốc (kể cả dấu chấm, dấu phẩy, viết hoa/thường lẻ tẻ). Đây là dữ liệu sản xuất, đổi sẽ vỡ workflow downstream của SAPULICO.
2. **Mỗi loại khảo sát = 1 sheet riêng trong cùng 1 Google Sheets file** (không gộp, không tách thành nhiều file).
3. **Form render động từ JSON schema** — KHÔNG hardcode 15 form HTML riêng. Đây là yêu cầu kiến trúc bắt buộc.
4. **Không tạo backend** — chỉ dùng Google Apps Script làm proxy ghi data, GitHub Pages host frontend tĩnh.
5. **Khi không chắc, HỎI** thay vì giả định. Ví dụ: nếu thấy header có khoảng trắng cuối (`"Hẻm "`) → hỏi user có muốn trim không, đừng tự ý sửa.

---

## 2. Stack công nghệ (CHỐT — không thay đổi nếu không hỏi)

| Lớp | Công nghệ | Lý do |
|---|---|---|
| Frontend | **HTML + Vanilla JavaScript (ES6 modules) + Tailwind CSS qua CDN** | Không cần build, deploy 1 click lên GitHub Pages, debug dễ |
| Hosting | **GitHub Pages** (branch `main`, thư mục `/` hoặc `/docs`) | Miễn phí, HTTPS sẵn (bắt buộc để dùng GPS + Camera API) |
| Database | **Google Sheets** (1 file, 15 sheet) | KTV/quản lý xem trực tiếp được, xuất Excel dễ |
| API ghi data | **Google Apps Script Web App** (deploy as "Anyone") | Miễn phí, không cần OAuth client-side |
| Ảnh | **Cloudinary** (unsigned upload preset) | Tự nén ảnh, có CDN, free tier 25GB |
| PWA | Manifest + Service Worker đơn giản | KTV "Add to Home Screen" như app native, cache offline |

**Không dùng:** React/Vue/Angular, không bundler (webpack/vite), không npm install. Tất cả thư viện qua CDN.

**Thư viện CDN được phép dùng:**
- Tailwind CSS: `https://cdn.tailwindcss.com`
- (Không cần thư viện nào khác. Tất cả viết bằng Vanilla JS.)

---

## 3. Cấu trúc thư mục dự án

```
/  (repo root)
├── CLAUDE.md                  ← file này
├── README.md                  ← hướng dẫn người dùng (KTV) ngắn gọn
├── SETUP.md                   ← hướng dẫn setup Google Sheets, Apps Script, Cloudinary
├── login.html                 ← trang đăng nhập (entry point cho cả KTV và admin)
├── index.html                 ← trang chủ: chọn 1 trong 16 loại khảo sát (cần đăng nhập)
├── form.html                  ← trang form chung, render động theo ?type=...
├── recent.html                ← trang xem các bản ghi gần đây trong ngày (KTV xem của mình)
├── manage.html                ← trang quản lý bản ghi (admin/user — tìm/sửa/xoá)
├── kpi.html                   ← trang KPI tháng (CHỈ admin/user truy cập được)
├── report.html                ← trang báo cáo tổng hợp theo loại KS / thời gian / KTV (admin/user)
├── bbht.html                  ← biên bản hiện trường (admin/user)
├── bangron.html               ← báo cáo riêng loại "Tháo gỡ băng rôn", kèm ảnh (admin/user) — mục 15b
├── manifest.json              ← PWA manifest
├── sw.js                      ← Service Worker (cache shell + offline)
├── assets/
│   ├── icon-192.png           ← icon PWA (tạo placeholder)
│   └── icon-512.png
├── js/
│   ├── config.js              ← các URL/key cấu hình (KHÔNG commit secret thật, dùng placeholder)
│   ├── schemas.js             ← 16 schema form (đối tượng JS, export default)
│   ├── lookups.js             ← dữ liệu Phường/Xã (102 mục) và TĐK (903 mục) cho dropdown/autocomplete
│   ├── form-renderer.js       ← engine render form từ schema
│   ├── api.js                 ← gọi Apps Script + upload Cloudinary
│   ├── auth.js                ← login, session token, route-guard, đọc user hiện tại
│   ├── kpi.js                 ← tính KPI tháng từ data, render bảng/biểu đồ
│   ├── report.js              ← tổng hợp báo cáo + render bảng/biểu đồ
│   ├── bbht.js                ← logic biên bản hiện trường
│   ├── bangron.js             ← logic báo cáo băng rôn (2 kiểu trình bày + In/PDF/Excel)
│   ├── manage.js              ← logic trang manage.html (list/delete/restore)
│   ├── gps.js                 ← lấy tọa độ GPS
│   ├── camera.js              ← xử lý ảnh (compress trước khi upload)
│   ├── storage.js             ← localStorage: lưu nháp form, queue khi offline
│   └── utils.js               ← helper chung
├── css/
│   └── style.css              ← override Tailwind nếu cần
└── apps-script/
    └── Code.gs                ← file Google Apps Script (copy paste vào script.google.com)
```

---

## 4. Danh sách 16 loại khảo sát (CHỐT)

15 sheet đầu lấy từ file `khao_sat_tang_cuong_den.xlsx` mà user đã cung cấp; loại thứ 16 (`thao_go_bang_ron`) là nghiệp vụ bổ sung 2026-08-15, không có trong file Excel gốc. **Tên sheet trong Google Sheets phải đặt CHÍNH XÁC như cột "Sheet name"** — không sửa, không bỏ khoảng trắng, không thay dấu.

| # | `key` (dùng trong code) | Sheet name (trong Google Sheets) | Số cột | Hàng header trong file gốc |
|---|---|---|---|---|
| 1 | `tang_cuong_den` | `Tang cuong den` | 22 | 1 |
| 2 | `ngam_hoa` | `Ngam Hoa` | 23 | 1 |
| 3 | `thay_den` | `Thay den` | 16 | 1 |
| 4 | `hkn` | `4, HKN` | 12 | 1 |
| 5 | `tc_noi` | `5. TCNoi` | 12 | 2 |
| 6 | `cap_luon_can` | `6, Cap luon can` | 13 | 1 |
| 7 | `tc_ngam` | `7. TCNgam` | 13 | 1 |
| 8 | `thay_can` | `8. Thay Can` | 14 | 1 |
| 9 | `thay_tru` | `9. Thay thế tru` | 15 | 1 |
| 10 | `choa_den` | `10.choa den` | 12 | 1 |
| 11 | `nap_tru` | `11. Nap tru` | 12 | 1 |
| 12 | `vo_tu` | `12, Vo tu` | 11 | 1 |
| 13 | `tc_den_kc_xa` | `13 Tăng cường đèn kc xa` | 16 | 1 |
| 14 | `decal_so_tru` | `14 Decal số trụ` | 12 | 1 |
| 15 | `nang_mong` | `15. Nâng móng` | 15 | 1 |
| 16 | `thao_go_bang_ron` | `16. Thao go bang ron` | 13 | — (sheet mới, không từ Excel) |

> **Cách tạo nhanh**: KHÔNG cần thao tác tay tạo 16 sheet. Sau khi tạo file Google Sheets trống và bind Apps Script, admin chạy hàm `initSheets()` 1 lần — script tự tạo đủ 16 sheet với header chính xác + 2 sheet phụ + conditional format. Hàm idempotent: chạy lại chỉ tạo sheet còn thiếu, không đụng dữ liệu cũ. Chi tiết ở mục 7.

**Cột bổ sung cho TẤT CẢ 16 sheet** (thêm vào cuối, sau cột cuối cùng của header gốc):
- `Ảnh (URLs)` — chuỗi các URL Cloudinary, phân tách bằng `|`
- `Submitted At` — timestamp ISO khi Apps Script nhận request (server-side, không phải client time)
- `User Agent` — để debug khi cần
- `Username` — username của KTV submit (server-side gán từ token đã xác thực, không tin client). Cột này dùng cho tính KPI.
- `Deleted At` — soft-delete flag. Rỗng = bản ghi còn hiệu lực. Có giá trị (timestamp) = đã bị xoá. KPI và `recent.html` lọc bỏ các row có `Deleted At`. Trên Google Sheets row vẫn nhìn thấy nhưng được tô màu xám/strikethrough (conditional format).
- `Deleted By` — username của admin/user thực hiện xoá. Rỗng nếu chưa xoá.

### Sheet phụ trong cùng file Google Sheets

Ngoài 15 sheet khảo sát, file Google Sheets có thêm:

**Sheet `taikhoan`** — danh sách người dùng đăng nhập được (tên sheet viết liền, không dấu):

| Cột | Kiểu | Ghi chú |
|---|---|---|
| `username` | text | Duy nhất, không dấu, vd: `ktv01`, `admin`, `demo` |
| `password_hash` | text | SHA-256(password + salt), salt giữ trong Script Properties. **Plaintext không chấp nhận** — verify bằng length 64 hex. |
| `full_name` | text | Họ tên đầy đủ — auto-fill vào trường "Người khảo sát" |
| `role` | text | 1 trong 4: `admin` / `user` / `user1` / `demo` (xem mục 1) |
| `active` | boolean | `TRUE`/`FALSE` — admin có thể vô hiệu hoá account mà không xoá. Nếu cột không tồn tại → ngầm hiểu TRUE. |
| `created_at` | datetime | Khi tạo account |

Quản lý thêm/sửa user **bằng tay** trực tiếp trên sheet. Khi đổi mật khẩu, admin chạy script trợ giúp (function `hashPassword` trong Apps Script) để sinh hash mới rồi paste vào. Code đọc theo TÊN cột (không theo index) — cho phép sắp xếp cột tuỳ ý.

**Sheet `phan quyen`** — bảng quyền theo role, **admin sửa bằng tick checkbox trực tiếp trên sheet** (không cần sửa code):

| Cột | Kiểu | Ghi chú |
|---|---|---|
| `vaiTro` | text | Tên role: `admin`/`user`/`user1`/`demo` |
| `submit` | boolean (checkbox) | TRUE = role được submit form |
| `delete` | boolean (checkbox) | TRUE = role được xoá bản ghi |
| `kpi` | boolean (checkbox) | TRUE = role xem được trang KPI |
| `manage` | boolean (checkbox) | TRUE = role vào được trang quản lý |
| `report` | boolean (checkbox) | TRUE = role xem được báo cáo |
| `moTa` | text | Mô tả vai trò (chỉ để người xem) |

Code đọc sheet này runtime với cache 60s (CacheService). Khi admin tick/untick → áp dụng trong vòng 1 phút. Nếu sheet bị xoá/lỗi → fallback sang DEFAULT_PERMISSIONS hardcode trong Code.gs (đồng bộ với bảng mục 1) → app vẫn chạy.

Data default 4 dòng (initSheets tự tạo):
- `admin` | TRUE TRUE TRUE TRUE TRUE | Quản lý văn phòng — toàn quyền
- `user`  | TRUE TRUE TRUE TRUE TRUE | Quản lý phụ (cùng quyền admin)
- `user1` | TRUE FALSE FALSE FALSE FALSE | KTV hiện trường — chỉ nhập KS
- `demo`  | FALSE FALSE FALSE FALSE FALSE | Tài khoản xem thử — readonly

**Sheet `KPI_Targets`** (tuỳ chọn, để admin chỉnh chỉ tiêu mà không cần sửa code):

| Cột | Giá trị mặc định |
|---|---|
| `target_submissions_per_month` | 50 |
| `target_distinct_types` | 5 |
| `target_active_days` | 20 |
| `weight_frequency` | 0.40 |
| `weight_quality` | 0.30 |
| `weight_diversity` | 0.15 |
| `weight_completeness` | 0.10 |
| `weight_stability` | 0.05 |

Nếu sheet này không tồn tại, Apps Script dùng giá trị mặc định hardcode.

---

## 5. Schema chi tiết từng form (NGUỒN CHÂN LÝ)

> Đây là schema bạn phải dùng để dựng `js/schemas.js`. KHÔNG được tự nghĩ ra trường mới hoặc bỏ trường. Nếu thấy có trường nào nghi vấn (vd `STT` — có nên cho KTV nhập không?), HỎI user trước.

### Quy ước chung
- `STT` (số thứ tự): **KTV không nhập**. Apps Script tự đánh = số dòng hiện tại (max row + 1 trừ header). Không gửi từ frontend.
- `ngày khảo sát` / `Ngày khảo sát`: **KTV không nhập tay**. Apps Script tự ghi `new Date()` khi nhận request, theo timezone `Asia/Ho_Chi_Minh`, format `yyyy-MM-dd HH:mm:ss`.
- `kinh độ`, `vĩ độ`: lấy tự động bằng `navigator.geolocation`, KTV có nút "Lấy lại GPS" nếu cần.
- `link` / `Link Google Map`: tự sinh `https://www.google.com/maps?q=<lat>,<lng>` nếu có GPS, để trống nếu không.
- `Bản vẽ`: upload ảnh (`image_url`) — KTV chụp ảnh bản vẽ thiết kế tại hiện trường, upload Cloudinary, lưu URL vào cột. Không bắt buộc. (chốt 2026-05-26: cho nhập; update 2026-05-28: đổi từ `text` → `image_url` để KTV chụp ảnh bản vẽ giấy — đã implement trong `js/schemas.js`)
- `Ghi chú`: luôn là `textarea`, không bắt buộc.

### GPS trên từng loại khảo sát (CHỐT — đồng bộ `NO_GPS_TYPES` trong Code.gs)

Có 3 mức GPS, ảnh hưởng đến KPI `pct_gps` và UX form:

| Mức | Trường lưu | Loại hình khảo sát |
|---|---|---|
| **GPS đầy đủ** (lat+lng+link) | `kinh độ`, `vĩ độ`, `Link Google Map` | `tang_cuong_den`, `thao_go_bang_ron` |
| **GPS tọa độ** (lat+lng, không có cột link) | `kinh độ`, `vĩ độ` | `ngam_hoa` ⚠️ |
| **GPS link-only** (chỉ lưu link) | `link` (link_gmap) | `thay_den`, `tc_noi`, `cap_luon_can`, `tc_ngam`, `thay_can`, `thay_tru`, `choa_den`, `nap_tru`, `vo_tu`, `tc_den_kc_xa`, `decal_so_tru`, `nang_mong` |
| **Không có GPS** | — | `hkn` |

⚠️ **`ngam_hoa` thiếu cột `link`**: Sheet này không có cột `Link Google Map` (đúng theo file Excel gốc — 23 cột). Hệ quả: link Google Map sinh ra trong form nhưng **không lưu vào Google Sheets**. Nếu muốn thêm cột `link`, phải thêm vào sheet Excel gốc + cập nhật HEADERS trong Code.gs + schema.

> **`NO_GPS_TYPES`** trong Code.gs **chỉ có `['hkn']`** (không phải `['hkn', 'vo_tu']` — `vo_tu` có `link_gmap`). Hằng số này dùng để loại `hkn` ra khỏi mẫu số khi tính `pct_gps`.
- `Người khảo sát`: **KTV không nhập tay**. Sau khi đăng nhập, frontend đọc `full_name` của user từ session và tự điền vào trường này (hiển thị readonly). KHÔNG cho phép sửa để tránh giả mạo. Server-side cũng overwrite trường này từ token để chắc chắn (defense in depth).
- `Quận`, `Phường`: dropdown lấy từ `lookups.js`. Quận chọn trước → lọc danh sách phường thuộc quận đó.
- `Tủ điều khiển`: autocomplete (datalist) từ `lookups.js`, cho phép nhập tự do (vì có thể TĐK mới chưa có trong danh mục).

### Loại trường (`type`) hỗ trợ
- `text` — input text 1 dòng
- `number` — input number
- `decimal` — input number với `step="0.1"` (cho độ rộng đường…)
- `textarea` — nhiều dòng
- `date_auto` — server tự gán, ẩn khỏi UI
- `stt_auto` — server tự gán, ẩn khỏi UI
- `gps_lat` / `gps_lng` — tự lấy, hiển thị readonly với nút refresh
- `select` — dropdown, cần `options: []`
- `quan` — dropdown đặc biệt (Quận, load từ lookups)
- `phuong` — dropdown đặc biệt (Phường, lọc theo Quận đã chọn)
- `tdk` — autocomplete (datalist) từ lookups
- `link_gmap` — auto-generated từ gps, ẩn khỏi UI
- `image_url` — upload ảnh lên Cloudinary, lưu URL; dùng cho trường `Bản vẽ` (chụp bản vẽ thiết kế)
- `skip` — không hiển thị, không gửi (dự phòng)

### Schema chi tiết — sao chép NGUYÊN VĂN tên trường vào `label` (để khớp header Google Sheets)

**5.1 `tang_cuong_den` — "Tang cuong den"**

| Order | Label (= header sheet) | Field key | Type | Required | Note |
|---|---|---|---|---|---|
| 1 | STT | stt | stt_auto | — | |
| 2 | Hẻm | hem | text | No | |
| 3 | Tuyến đường | tuyen_duong | text | **Yes** | |
| 4 | Quận | quan | quan | **Yes** | |
| 5 | Phường | phuong | phuong | **Yes** | lọc theo Quận |
| 6 | Tủ điều khiển | tdk | tdk | **Yes** | |
| 7 | Độ rộng đường | do_rong_duong | decimal | No | mét |
| 8 | Dãy phân cách | day_phan_cach | select | No | options: `["Có", "Không"]` |
| 9 | Số làn xe | so_lan_xe | number | No | |
| 10 | Đầu tuyến | dau_tuyen | text | No | |
| 11 | Cuối tuyến | cuoi_tuyen | text | No | |
| 12 | Số đèn dự kiến | so_den | number | **Yes** | |
| 13 | ngày khảo sát | ngay_ks | date_auto | — | |
| 14 | kinh độ | lng | gps_lng | — | |
| 15 | vĩ độ | lat | gps_lat | — | |
| 16 | Người khảo sát | nguoi_ks | text | **Yes** | |
| 17 | Bản vẽ | ban_ve | image_url | No | KTV chụp ảnh bản vẽ thiết kế tại hiện trường |
| 18 | Ghi chú | ghi_chu | textarea | No | |
| 19 | Vị trí | vi_tri | text | No | |
| 20 | Tên hẻm | ten_hem | text | No | |
| 21 | Trạng thái thiết kế | trang_thai | select | No | options: `["", "Đã thiết kế", "Chưa thiết kế"]` |
| 22 | Link Google Map | link_gmap | link_gmap | — | auto từ GPS |

**5.2 `ngam_hoa` — "Ngam Hoa"**

| Order | Label | Field key | Type | Required |
|---|---|---|---|---|
| 1 | STT | stt | stt_auto | — |
| 2 | Tuyến đường | tuyen_duong | text | **Yes** |
| 3 | Quận | quan | quan | **Yes** |
| 4 | Phường | phuong | phuong | **Yes** |
| 5 | Tủ điều khiển | tdk | tdk | **Yes** |
| 6 | Độ rộng đường | do_rong_duong | decimal | No |
| 7 | Dãy phân cách | day_phan_cach | select | No |
| 8 | Số làn xe | so_lan_xe | number | No |
| 9 | Đầu tuyến | dau_tuyen | text | No |
| 10 | Cuối tuyến | cuoi_tuyen | text | No |
| 11 | Số đèn dự kiến | so_den | number | **Yes** |
| 12 | Đường nhựa | duong_nhua | decimal | No | mét |
| 13 | Vỉa hè các loại | vh_cac_loai | decimal | No |
| 14 | Vỉa hè bê tông | vh_be_tong | decimal | No |
| 15 | Vỉa hè đá | vh_da | decimal | No |
| 16 | Số đèn thu hồi | so_den_th | number | No |
| 17 | CD cáp thu hồi | cd_cap_th | decimal | No | chiều dài, mét |
| 18 | ngày khảo sát | ngay_ks | date_auto | — |
| 19 | kinh độ | lng | gps_lng | — |
| 20 | vĩ độ | lat | gps_lat | — |
| 21 | Người khảo sát | nguoi_ks | text | **Yes** |
| 22 | Bản vẽ | ban_ve | image_url | No | Chụp ảnh bản vẽ thiết kế |
| 23 | Ghi chú | ghi_chu | textarea | No |

> ⚠️ **`ngam_hoa` không có cột `link_gmap`** — đúng theo file Excel gốc (23 cột, không có `Link Google Map`). Form vẫn lấy GPS và lưu `kinh độ`/`vĩ độ`, nhưng link Google Maps không được ghi vào sheet. Nếu muốn thêm về sau phải thêm cột vào sheet + cập nhật `HEADERS` trong Code.gs.

**5.3 `thay_den` — "Thay den"**

| Order | Label | Field key | Type | Required |
|---|---|---|---|---|
| 1 | STT | stt | stt_auto | — |
| 2 | Tuyến đường | tuyen_duong | text | **Yes** |
| 3 | Quận | quan | quan | **Yes** |
| 4 | Phường | phuong | phuong | **Yes** |
| 5 | Tủ điều khiển | tdk | tdk | **Yes** |
| 6 | Đầu tuyến | dau_tuyen | text | No |
| 7 | Cuối tuyến | cuoi_tuyen | text | No |
| 8 | Số đèn hiện hữu | so_den_hh | number | **Yes** |
| 9 | Công suất đèn hiện hữu | cong_suat | text | No | vd: "150/100W và 150W" |
| 10 | Dây lên đèn | day_len_den | text | No |
| 11 | Năm lắp đặt | nam_ld | number | No |
| 12 | ngày khảo sát | ngay_ks | date_auto | — |
| 13 | Người khảo sát | nguoi_ks | text | **Yes** |
| 14 | Bản vẽ | ban_ve | image_url | No | Chụp ảnh bản vẽ thiết kế |
| 15 | Ghi chú | ghi_chu | textarea | No |
| 16 | link | link_gmap | link_gmap | — |

**5.4 `hkn` — "4, HKN"** (Hộp kín nước)

| Order | Label | Field key | Type | Required |
|---|---|---|---|---|
| 1 | STT | stt | stt_auto | — |
| 2 | Tuyến đường | tuyen_duong | text | **Yes** |
| 3 | Quận | quan | quan | **Yes** |
| 4 | Phường | phuong | phuong | **Yes** |
| 5 | Tủ điều khiển | tdk | tdk | **Yes** |
| 6 | Năm lắp đặt | nam_ld | number | No |
| 7 | Số lượng | so_luong | number | **Yes** |
| 8 | Loại hộp (6A, 10A) | loai_hop | select | **Yes** | options: `["6A", "10A"]` |
| 9 | Người khảo sát | nguoi_ks | text | **Yes** |
| 10 | Ngày khảo sát | ngay_ks | date_auto | — |
| 11 | Số đầu cáp | so_dau_cap | text | No | vd: "2 đầu cáp" |
| 12 | Ghi chú | ghi_chu | textarea | No |

**5.5 `tc_noi` — "5. TCNoi"** (Thay cáp nổi)

| Order | Label | Field key | Type | Required |
|---|---|---|---|---|
| 1 | STT | stt | stt_auto | — |
| 2 | Tuyến đường | tuyen_duong | text | **Yes** |
| 3 | Quận | quan | quan | **Yes** |
| 4 | Phường | phuong | phuong | **Yes** |
| 5 | Tủ điều khiển | tdk | tdk | **Yes** |
| 6 | Năm lắp đặt | nam_ld | number | No |
| 7 | Loại cáp hiện hữu | loai_cap | text | No | vd: "5x10" |
| 8 | Số lượng | so_luong | number | **Yes** | mét |
| 9 | Người khảo sát | nguoi_ks | text | **Yes** |
| 10 | Ngày khảo sát | ngay_ks | date_auto | — |
| 11 | Ghi chú | ghi_chu | textarea | No |
| 12 | link | link_gmap | link_gmap | — |

**5.6 `cap_luon_can` — "6, Cap luon can"**

| Order | Label | Field key | Type | Required |
|---|---|---|---|---|
| 1 | STT | stt | stt_auto | — |
| 2 | Vị trí | vi_tri | text | No |
| 3 | Tuyến đường | tuyen_duong | text | **Yes** |
| 4 | Quận | quan | quan | **Yes** |
| 5 | Phường | phuong | phuong | **Yes** |
| 6 | Tủ điều khiển | tdk | tdk | **Yes** |
| 7 | Năm lắp đặt | nam_ld | number | No |
| 8 | Loại cáp | loai_cap | text | No |
| 9 | Số lượng | so_luong | text | **Yes** | vd: "14 đèn ( 2TN 3m)" — KTV nhập tự do |
| 10 | Người khảo sát | nguoi_ks | text | **Yes** |
| 11 | Ngày khảo sát | ngay_ks | date_auto | — |
| 12 | Ghi chú | ghi_chu | textarea | No |
| 13 | link | link_gmap | link_gmap | — |

**5.7 `tc_ngam` — "7. TCNgam"** (Thay cáp ngầm)

| Order | Label | Field key | Type | Required |
|---|---|---|---|---|
| 1 | STT | stt | stt_auto | — |
| 2 | Tuyến đường | tuyen_duong | text | **Yes** |
| 3 | Quận | quan | quan | **Yes** |
| 4 | Phường | phuong | phuong | **Yes** |
| 5 | Tủ điều khiển | tdk | tdk | **Yes** |
| 6 | Năm lắp đặt | nam_ld | number | No |
| 7 | Số lượng | so_luong | text | **Yes** | vd: "30m" |
| 8 | Loại cáp | loai_cap | text | No |
| 9 | Loại mương cáp | loai_muong | text | No |
| 10 | Người khảo sát | nguoi_ks | text | **Yes** |
| 11 | Ngày khảo sát | ngay_ks | date_auto | — |
| 12 | Ghi chú | ghi_chu | textarea | No |
| 13 | link | link_gmap | link_gmap | — |

**5.8 `thay_can` — "8. Thay Can"**

| Order | Label | Field key | Type | Required |
|---|---|---|---|---|
| 1 | STT | stt | stt_auto | — |
| 2 | Vị trí | vi_tri | text | No |
| 3 | Tuyến đường | tuyen_duong | text | **Yes** |
| 4 | Quận | quan | quan | **Yes** |
| 5 | Phường | phuong | phuong | **Yes** |
| 6 | Tủ điều khiển | tdk | tdk | **Yes** |
| 7 | Năm lắp đặt | nam_ld | number | No |
| 8 | Số lượng | so_luong | number | **Yes** |
| 9 | Loại kiềng (HTLT, TTLT, B2...) | loai_kieng | select | **Yes** | options: `["HTLT", "TTLT", "TTLT Đôi dọc", "B2", "Khác"]` |
| 10 | Loại cần (3,8m ; 3m...) | loai_can | text | No |
| 11 | Người khảo sát | nguoi_ks | text | **Yes** |
| 12 | Ngày khảo sát | ngay_ks | date_auto | — |
| 13 | Ghi chú | ghi_chu | textarea | No |
| 14 | link | link_gmap | link_gmap | — |

**5.9 `thay_tru` — "9. Thay thế tru"**

| Order | Label | Field key | Type | Required |
|---|---|---|---|---|
| 1 | STT | stt | stt_auto | — |
| 2 | Vị trí | vi_tri | text | No |
| 3 | Tuyến đường | tuyen_duong | text | **Yes** |
| 4 | Quận | quan | quan | **Yes** |
| 5 | Phường | phuong | phuong | **Yes** |
| 6 | Tủ điều khiển | tdk | tdk | **Yes** |
| 7 | Số lượng | so_luong | number | **Yes** |
| 8 | Loại sự cố (mục, gỉ sét, hư mặt bích,...) | loai_su_co | textarea | **Yes** |
| 9 | Quy cách trụ (loại trụ: chiều cao VD: STK 9m; be tông 8,4m; trang trí;...) | quy_cach_tru | text | **Yes** |
| 10 | Quy cách móng | quy_cach_mong | text | No | vd: "M22 260×260" |
| 11 | Năm lắp đặt | nam_ld | number | No |
| 12 | Người khảo sát | nguoi_ks | text | **Yes** |
| 13 | Ngày khảo sát | ngay_ks | date_auto | — |
| 14 | Ghi chú (kèm thay cần đèn,...) | ghi_chu | textarea | No |
| 15 | link | link_gmap | link_gmap | — |

**5.10 `choa_den` — "10.choa den"**

| Order | Label | Field key | Type | Required |
|---|---|---|---|---|
| 1 | STT | stt | stt_auto | — |
| 2 | Tuyến đường | tuyen_duong | text | **Yes** |
| 3 | Quận | quan | quan | **Yes** |
| 4 | Phường | phuong | phuong | **Yes** |
| 5 | Tủ điều khiển | tdk | tdk | **Yes** |
| 6 | Năm lắp đặt | nam_ld | number | No |
| 7 | Số lượng | so_luong | number | **Yes** |
| 8 | Loại chóa | loai_choa | text | **Yes** | vd: "Onyx", "Trang trí Bông huệ" |
| 9 | Người khảo sát | nguoi_ks | text | **Yes** |
| 10 | Ngày khảo sát | ngay_ks | date_auto | — |
| 11 | Ghi chú | ghi_chu | textarea | No |
| 12 | link | link_gmap | link_gmap | — |

**5.11 `nap_tru` — "11. Nap tru"**

| Order | Label | Field key | Type | Required |
|---|---|---|---|---|
| 1 | STT | stt | stt_auto | — |
| 2 | Tuyến đường | tuyen_duong | text | **Yes** |
| 3 | Quận | quan | quan | **Yes** |
| 4 | Phường | phuong | phuong | **Yes** |
| 5 | Tủ điều khiển | tdk | tdk | **Yes** |
| 6 | Số trụ | so_tru | text | **Yes** | vd: "Trụ số 6 và Trụ số 13" |
| 7 | Số lượng | so_luong | number | **Yes** |
| 8 | Quy cách | quy_cach | text | No | vd: "35×25" |
| 9 | Người khảo sát | nguoi_ks | text | **Yes** |
| 10 | Ngày khảo sát | ngay_ks | date_auto | — |
| 11 | Ghi chú | ghi_chu | textarea | No |
| 12 | link | link_gmap | link_gmap | — |

**5.12 `vo_tu` — "12, Vo tu"**

| Order | Label | Field key | Type | Required |
|---|---|---|---|---|
| 1 | STT | stt | stt_auto | — |
| 2 | Tuyến đường | tuyen_duong | text | **Yes** |
| 3 | Quận | quan | quan | **Yes** |
| 4 | Phường | phuong | phuong | **Yes** |
| 5 | Tủ điều khiển | tdk | tdk | **Yes** |
| 6 | Năm lắp đặt | nam_ld | number | No |
| 7 | Số lượng | so_luong | number | **Yes** |
| 8 | Người khảo sát | nguoi_ks | text | **Yes** |
| 9 | Ngày khảo sát | ngay_ks | date_auto | — |
| 10 | Ghi chú | ghi_chu | textarea | No |
| 11 | link | link_gmap | link_gmap | — |

**5.13 `tc_den_kc_xa` — "13 Tăng cường đèn kc xa"**

| Order | Label | Field key | Type | Required |
|---|---|---|---|---|
| 1 | STT | stt | stt_auto | — |
| 2 | Vị trí | vi_tri | text | No |
| 3 | Tuyến đường | tuyen_duong | text | **Yes** |
| 4 | Quận | quan | quan | **Yes** |
| 5 | Phường | phuong | phuong | **Yes** |
| 6 | Tủ điều khiển | tdk | tdk | **Yes** |
| 7 | Chủng loại đèn | chung_loai_den | text | **Yes** |
| 8 | Số lượng | so_luong | number | **Yes** |
| 9 | Chủng loại cần đèn | chung_loai_can | text | No |
| 10 | Quy cách kiềng cần đèn | quy_cach_kieng | text | No |
| 11 | Kéo thêm cáp nguồn | keo_them_cap | select | No | options: `["", "Có", "Không"]` |
| 12 | Khoảng cách giữa 2 trụ | kc_2_tru | decimal | No | mét |
| 13 | Người khảo sát | nguoi_ks | text | **Yes** |
| 14 | Ngày khảo sát | ngay_ks | date_auto | — |
| 15 | Ghi chú | ghi_chu | textarea | No |
| 16 | link | link_gmap | link_gmap | — |

**5.14 `decal_so_tru` — "14 Decal số trụ"**

| Order | Label | Field key | Type | Required |
|---|---|---|---|---|
| 1 | STT | stt | stt_auto | — |
| 2 | Vị trí | vi_tri | text | No | vd: "1 đến 35" |
| 3 | Tuyến đường | tuyen_duong | text | **Yes** |
| 4 | Quận | quan | quan | **Yes** |
| 5 | Phường | phuong | phuong | **Yes** |
| 6 | Tủ điều khiển | tdk | tdk | **Yes** |
| 7 | Số lượng | so_luong | number | **Yes** |
| 8 | Quy cách | quy_cach | text | No |
| 9 | Người khảo sát | nguoi_ks | text | **Yes** |
| 10 | Ngày khảo sát | ngay_ks | date_auto | — |
| 11 | Ghi chú | ghi_chu | textarea | No |
| 12 | link | link_gmap | link_gmap | — |

**5.15 `nang_mong` — "15. Nâng móng"**

| Order | Label | Field key | Type | Required |
|---|---|---|---|---|
| 1 | STT | stt | stt_auto | — |
| 2 | Vị trí | vi_tri | text | No |
| 3 | Tuyến đường | tuyen_duong | text | **Yes** |
| 4 | Quận | quan | quan | **Yes** |
| 5 | Phường | phuong | phuong | **Yes** |
| 6 | Tủ điều khiển | tdk | tdk | **Yes** |
| 7 | Năm lắp đặt | nam_ld | number | No |
| 8 | Độ cao nâng | do_cao_nang | text | **Yes** | vd: "200" (mm) |
| 9 | Số lượng | so_luong | number | **Yes** |
| 10 | Quy cách móng | quy_cach_mong | text | No | vd: "M16 × 400" |
| 11 | Chiều cao nắp cửa trụ (từ mặt bích đến nắp cửa trụ) | chieu_cao_nap | text | No | vd: "1250" |
| 12 | Người khảo sát | nguoi_ks | text | **Yes** |
| 13 | Ngày khảo sát | ngay_ks | date_auto | — |
| 14 | Ghi chú | ghi_chu | textarea | No |
| 15 | link | link_gmap | link_gmap | — |

**5.16 `thao_go_bang_ron` — "16. Thao go bang ron"** *(bổ sung 2026-08-15)*

Nghiệp vụ tháo gỡ băng rôn / quảng cáo trái phép treo trên trụ đèn chiếu sáng. Trước đây nhân viên báo qua Zalo (chùm ảnh + 1 dòng "Tháo băng rôn đường X, phường Y: N tấm"); nay nhập thẳng vào app. **Không có trường `Tủ điều khiển`** — nghiệp vụ này gắn với tuyến đường, không gắn với TĐK.

| Order | Label | Field key | Type | Required | Note |
|---|---|---|---|---|---|
| 1 | STT | stt | stt_auto | — | |
| 2 | Tuyến đường | tuyen_duong | text | **Yes** | |
| 3 | Quận | quan | quan | **Yes** | |
| 4 | Phường | phuong | phuong | **Yes** | lọc theo Quận |
| 5 | Vị trí | vi_tri | text | No | đoạn đường, vd: "từ số 63 đến số 120" |
| 6 | Loại quảng cáo | loai_qc | select | **Yes** | options: `["Băng rôn", "Cờ phướn", "Poster/áp phích", "Hỗn hợp"]` |
| 7 | Số lượng | so_luong | number | **Yes** | số tấm đã tháo |
| 8 | Người khảo sát | nguoi_ks | text | **Yes** | auto-fill readonly |
| 9 | Ngày khảo sát | ngay_ks | date_auto | — | |
| 10 | kinh độ | lng | gps_lng | — | |
| 11 | vĩ độ | lat | gps_lat | — | |
| 12 | Ghi chú | ghi_chu | textarea | No | |
| 13 | Link Google Map | link_gmap | link_gmap | — | auto từ GPS |

> **Ảnh: tối đa 5** (các loại khác là 3). Khai bằng khoá `maxPhotos: 5` trong `js/schemas.js`; `js/form-renderer.js` đọc `state.schema.maxPhotos || 3` nên 15 loại cũ giữ nguyên mức 3. Ảnh vẫn lưu chung 1 ô `Ảnh (URLs)` phân tách bằng `|` — backend không đổi.

---

## 6. Dữ liệu lookup (Quận/Phường, TĐK)

Trong file Excel gốc có sẵn 2 sheet:
- **`Phường-Xã 2025`**: 102 phường/xã mới của TP.HCM (sau sáp nhập), kèm quận/huyện cũ. Cột B = tên phường, cột D = quận cũ.
- **`TĐK`**: 903 tủ điều khiển, cột C = `TĐK 2026` (tên hiện hành), cột F = phường mới thuộc về.

### Cách trích xuất
**Trước khi viết code, Claude Code phải:**
1. Mở file Excel gốc (user sẽ cung cấp lại trong repo, hoặc upload lại — nếu không có, HỎI user).
2. Đọc 2 sheet trên bằng `openpyxl` hoặc `pandas`.
3. Xuất ra `js/lookups.js` theo format:

```javascript
// js/lookups.js — KHÔNG sửa tay file này, regen từ Excel khi nguồn cập nhật
export const PHUONG_XA = [
  { ten: "Hiệp Bình", quan_cu: "TP Thủ Đức" },
  { ten: "Tam Bình", quan_cu: "TP Thủ Đức" },
  // ... 102 mục
];

export const QUAN_LIST = [...new Set(PHUONG_XA.map(p => p.quan_cu))].sort();

export const TDK_LIST = [
  "Trần Phú - 3",
  "Trần Phú - 4",
  // ... 903 mục
];
```

### Logic dropdown trong form
- Field `Quận` (type `quan`): dropdown từ `QUAN_LIST`.
- Field `Phường` (type `phuong`): khi `Quận` đổi → filter `PHUONG_XA` theo `quan_cu` → render options. KTV cũng được phép nhập tự do (cho phép gõ vào nếu không có trong danh sách, nhưng dropdown ưu tiên).
- Field `Tủ điều khiển` (type `tdk`): dùng `<input list="tdk-list">` + `<datalist id="tdk-list">` với 903 mục. Cho phép gõ tự do.

---

## 7. Google Apps Script — `apps-script/Code.gs`

### Yêu cầu
- 1 hàm `doPost(e)` duy nhất nhận JSON body có trường `action`:
  - `action: "login"` — body `{ username, password }` → trả `{ ok, token, full_name, role }`
  - `action: "submit"` — body `{ token, type, data, photos: [urls] }` → ghi row vào sheet tương ứng. Reject nếu role là `demo`.
  - `action: "list"` — body `{ token, type?, username?, from?, to?, includeDeleted? }` → trả danh sách bản ghi (cho `recent.html` và `manage.html`). Role `user1`/`demo` chỉ thấy của mình; `admin`/`user` thấy tất cả.
  - `action: "delete"` — body `{ token, type, stt }` → soft-delete (set `Deleted At` + `Deleted By`) + xoá ảnh Cloudinary kèm. Chỉ `admin`/`user` được gọi.
  - `action: "restore"` — body `{ token, type, stt }` → undo soft-delete (clear `Deleted At` + `Deleted By`). Không restore được ảnh (đã xoá Cloudinary). Chỉ `admin`/`user`.
  - `action: "kpi"` — body `{ token, month: "2026-05" }` → trả KPI tất cả KTV trong tháng. Chỉ `admin`/`user`.
  - `action: "report"` — body `{ token, types?: [...], from?, to?, usernames?: [...], status?, groupBy? }` → trả aggregation đa chiều (3 vùng A/B/C) cho trang báo cáo. Chỉ `admin`/`user`. Chi tiết ở mục 15.
  - `action: "export_raw"` — body `{ token, types: [...], from?, to?, usernames?: [], status? }` → trả raw rows theo đúng thứ tự cột của từng sheet (array of arrays) để xuất Excel/CSV. Không aggregate. Chỉ `admin`/`user`. Chi tiết ở mục 15.
  - `action: "photo_base64"` — body `{ token, url }` → đọc 1 ảnh Drive trả `{ ok, mimeType, base64 }`. Chỉ cần token hợp lệ. **Lý do tồn tại**: `drive.google.com/uc?export=view` không trả header CORS nên `html2canvas` vẽ ra ô trắng; trang báo cáo phải nội tuyến ảnh thành `data:` URL trước khi capture. Xem mục 15b.
- Mở Google Sheets theo ID (set qua Script Properties, không hardcode).
- Tìm sheet theo bảng mapping `type → sheet name` (ở mục 4).
- Đọc header row của sheet đó → tạo row mới với giá trị theo đúng thứ tự cột.
- Server-side gán: `STT` (= maxRow của sheet trừ header rows + 1), `ngày khảo sát` (= `Utilities.formatDate(new Date(), "Asia/Ho_Chi_Minh", "yyyy-MM-dd HH:mm:ss")`), `Người khảo sát` (= `full_name` từ user của token), `Username` (= username từ token).
- Append row.
- Trả về JSON `{ ok: true, stt: <số>, sheet: <tên> }` với `ContentService.createTextOutput().setMimeType(JSON)`.
- Bắt lỗi → `{ ok: false, error: <msg> }` và `Logger.log`.
- **CORS**: Apps Script khi deploy as Web App `Anyone` đã tự cho phép. Frontend gọi bằng `fetch(URL, { method: 'POST', mode: 'no-cors' ... })` ban đầu sẽ KHÔNG đọc được response → giải pháp: dùng `Content-Type: text/plain` để tránh preflight CORS, vẫn POST được. Hoặc dùng `application/x-www-form-urlencoded`. **Test kỹ trên mobile Safari trước khi nói đã xong.**

### Authentication & phân quyền
- **Password hashing**: SHA-256(password + salt). Salt cố định, lấy từ `PropertiesService.getScriptProperties().getProperty('AUTH_SALT')` (set thủ công trong Project Settings → Script Properties, vd salt 32 ký tự random).
- **Token**: sau khi login thành công, sinh token = `base64(username + "|" + expiresAt + "|" + HMAC_SHA256(username + expiresAt, salt))`. `expiresAt` = now + 8h. Stateless, không cần lưu DB.
- **Verify token** mỗi request: decode → kiểm tra expiresAt > now → recompute HMAC → match thì OK, trả lại `{ username, role, full_name }` (đọc lại từ sheet `taikhoan`, để role/full_name luôn fresh nếu admin sửa).
- **Rate limiting nhẹ**: giới hạn 5 lần login sai/phút từ cùng 1 username bằng `CacheService`. Sai quá → khoá 5 phút.
- **active=FALSE** trong sheet `taikhoan` → từ chối login với message "Tài khoản đã bị khoá".

**Permissions**: Apps Script đọc từ sheet `phan quyen` (mục 4) với cache 60s. Frontend `js/auth.js` chỉ giữ DEFAULT_PERMISSIONS hardcode đồng bộ để render UI (hide/show menu) — server vẫn là source of truth.

```javascript
// Hardcode default trong cả Code.gs và js/auth.js (đồng bộ với data default sheet phan quyen)
const DEFAULT_PERMISSIONS = {
  admin:  { submit: true,  delete: true,  kpi: true,  manage: true,  report: true  },
  user:   { submit: true,  delete: true,  kpi: true,  manage: true,  report: true  },
  user1:  { submit: true,  delete: false, kpi: false, manage: false, report: false },
  demo:   { submit: false, delete: false, kpi: false, manage: false, report: false }
};

// Code.gs: đọc runtime từ sheet, fallback default
function getPermissions() {
  const cache = CacheService.getScriptCache();
  const cached = cache.get('permissions');
  if (cached) return JSON.parse(cached);
  try {
    const sheet = getSpreadsheet().getSheetByName('phan quyen');
    const data = sheet.getDataRange().getValues();
    const header = data[0];
    const idxRole = header.indexOf('vaiTro');
    const actions = ['submit', 'delete', 'kpi', 'manage', 'report'];
    const perms = {};
    for (let i = 1; i < data.length; i++) {
      const role = data[i][idxRole];
      if (!role) continue;
      perms[role] = {};
      actions.forEach(a => {
        perms[role][a] = data[i][header.indexOf(a)] === true;
      });
    }
    cache.put('permissions', JSON.stringify(perms), 60);
    return perms;
  } catch (err) {
    Logger.log('getPermissions fallback to default: ' + err);
    return DEFAULT_PERMISSIONS;
  }
}

function can(role, action) {
  const p = getPermissions();
  return !!(p[role] && p[role][action]);
}
function isFullAccess(role) { return role === 'admin' || role === 'user'; }
```

Mỗi endpoint kiểm tra `can(role, action)` đầu hàm, fail thì trả `{ ok: false, error: "forbidden" }`. Frontend cũng check để ẩn UI, nhưng server-side check là **bắt buộc** (không tin client).

### Soft-delete
- Hàm `softDelete(type, stt, deletedByUsername)`:
  1. Verify role có quyền `delete`.
  2. Mở sheet, tìm row có `STT` khớp.
  3. Đọc cột `Ảnh (URLs)` → parse các `public_id` Cloudinary → gọi Cloudinary Admin API xoá (xem mục 8).
  4. Set cột `Deleted At` = now, `Deleted By` = username.
  5. Trả `{ ok: true }`.
- Hàm `restore(type, stt)`:
  1. Verify role.
  2. Clear `Deleted At`, `Deleted By`.
  3. **Không khôi phục được ảnh** đã xoá Cloudinary — báo cảnh báo "Ảnh đính kèm đã bị xoá vĩnh viễn, chỉ khôi phục được dữ liệu chữ".

### Conditional format cho row deleted
Trong file SETUP.md, hướng dẫn admin set conditional formatting cho 15 sheet: nếu cột `Deleted At` không rỗng → tô màu xám + strikethrough. Giúp nhìn trực quan trong Google Sheets. **`initSheets()` tự áp conditional format khi tạo sheet, user không cần thao tác tay.**

### Hàm `initSheets()` — tự tạo cấu trúc Google Sheets
Để tránh user phải tạo thủ công 15 sheet + paste header tiếng Việt (dễ sai), Apps Script phải có hàm public `initSheets()`. Admin tạo file Google Sheets trống → bind Apps Script → chạy `initSheets()` 1 lần là xong toàn bộ cấu trúc.

**Yêu cầu hàm `initSheets()`:**
1. Đọc spreadsheet hiện tại (qua `SpreadsheetApp.openById(SPREADSHEET_ID)` lấy từ Script Properties).
2. Với mỗi entry trong `SHEET_MAP` (15 loại KS):
   - Nếu sheet đã tồn tại với tên đúng → SKIP (không ghi đè để bảo toàn dữ liệu).
   - Nếu chưa → tạo mới với tên đúng (chính xác từng ký tự, kể cả khoảng trắng/dấu chấm).
   - Set header row 1 = `[...HEADERS[type], 'Ảnh (URLs)', 'Submitted At', 'User Agent', 'Username', 'Deleted At', 'Deleted By']`.
   - Freeze row 1 (`sheet.setFrozenRows(1)`).
   - Set conditional format: nếu cột `Deleted At` của row hiện tại không rỗng → tô xám nhạt (#f0f0f0) + strikethrough toàn row.
   - Tự động set column width vừa phải cho cột STT (40px), Ngày khảo sát (140px), Người khảo sát (120px), Ảnh URLs (200px).
3. Tạo sheet `taikhoan` nếu chưa có:
   - Header: `[username, password_hash, full_name, role, active, created_at]`.
   - Freeze row 1.
   - Data validation cho cột `role`: chỉ chấp nhận `admin`/`user`/`user1`/`demo`.
   - Data validation cho cột `active`: checkbox TRUE/FALSE.
4. Tạo sheet `KPI_Targets` nếu chưa có:
   - 2 cột: `param`, `value`.
   - 8 row default theo mục 4 (target_submissions_per_month=50, target_distinct_types=5, …, weight_stability=0.05).
5. Sheet `Audit` không tạo sẵn — sẽ tự sinh khi có lần delete/restore đầu tiên.
6. Xoá sheet "Sheet1" mặc định nếu vẫn còn và trống.
7. Trả về `{ok: true, created: [...], skipped: [...], message: "..."}` để admin xem kết quả.

**Tách const `HEADERS`** ở đầu Code.gs:
```javascript
const HEADERS = {
  tang_cuong_den: ['STT','Hẻm','Tuyến đường','Quận','Phường','Tủ điều khiển',
                   'Độ rộng đường','Dãy phân cách','Số làn xe','Đầu tuyến','Cuối tuyến',
                   'Số đèn dự kiến','ngày khảo sát','kinh độ','vĩ độ','Người khảo sát',
                   'Bản vẽ','Ghi chú','Vị trí','Tên hẻm','Trạng thái thiết kế','Link Google Map'],
  ngam_hoa: [...],  // 23 cột
  // ... đủ 15 loại, label nguyên văn theo mục 5
};
```

**Lưu ý đồng bộ**: nội dung `HEADERS` trong Code.gs PHẢI khớp NGUYÊN VĂN với `label` trong `js/schemas.js` và bảng schema mục 5. Khi sửa schema, sửa cả 2 nơi.

Ngoài ra, có thể thêm hàm `validateSheets()` (tuỳ chọn) — quét tất cả sheet, so sánh header thực tế với `HEADERS`, báo lỗi nếu lệch. Hữu ích khi nghi sheet bị sửa nhầm.

### Hàm `migrateTaikhoan()` — chuyển sheet `taikhoan` cũ sang format mới

Vì file Google Sheets `khao-sat-ke-hoach` đã có sẵn sheet `taikhoan` với header tiếng Việt cũ (`tenDangNhap`, `matKhau`, `hoTen`, `vaiTro`, `Ngày cấp`) và mật khẩu **plaintext**, cần hàm migration chạy 1 lần để chuyển sang format mới:

1. Phát hiện header cũ → đổi tên:
   - `tenDangNhap` → `username`
   - `matKhau` → `password_hash`
   - `hoTen` → `full_name`
   - `vaiTro` → `role`
   - `Ngày cấp` → `created_at`
2. Thêm cột `active` nếu chưa có, default TRUE cho tất cả row.
3. Với mỗi row, nếu `password_hash` length != 64 (= không phải SHA-256 hex) → coi là plaintext, hash lại bằng `hashPassword(plain)` và ghi đè. Log từng user đã migrate.
4. Idempotent: chạy lại an toàn (đã hash thì skip).
5. Return JSON `{ok, migrated_users: [...], skipped: [...], renamed_columns: bool, added_active: bool}`.

### Endpoint `action=kpi` chi tiết
- Chỉ chấp nhận khi `role === "admin"`. Token role=ktv → trả `{ ok: false, error: "forbidden" }`.
- Input: `month` định dạng `YYYY-MM` (vd `2026-05`).
- Xử lý:
  1. Đọc sheet `taikhoan` → danh sách KTV active.
  2. Đọc 15 sheet khảo sát, filter row có `Submitted At` thuộc tháng `month` VÀ `Username` thuộc KTV active.
  3. Với mỗi KTV, tính 5 chỉ tiêu (xem mục 13 — Trang KPI).
  4. Trả `{ ok: true, month, results: [{ username, full_name, frequency, quality, diversity, completeness, stability, total, grade }, ...] }`.
- Performance: scan toàn bộ 15 sheet có thể chậm nếu data nhiều ngàn dòng. Chấp nhận response 3-5s. Nếu sau này cần tối ưu, thêm sheet cache `KPI_Cache` cập nhật incremental khi mỗi submit.

### Lưu ý sheet `5. TCNoi`
- File gốc có header ở **row 2** (row 1 trống/có giá trị lạ "3125").
- Khi tạo Google Sheets mới, **đặt header ở row 1** (clean lại), để code Apps Script đơn giản (luôn đọc row 1 làm header cho mọi sheet).
- Tài liệu setup phải nhắc user clean.

### Hằng số GPS (cập nhật 2026-05-28)

```javascript
// Chỉ hkn không có GPS (không có gps_lat/gps_lng lẫn link_gmap).
// vo_tu có link_gmap → không thuộc NO_GPS_TYPES.
const NO_GPS_TYPES = ['hkn'];
```

> Dùng trong KPI `pct_gps`: loại `hkn` ra khỏi mẫu số. Các loại `link-only` (thay_den, tc_noi, ...) tính GPS qua cột `link` không rỗng.

### Bảng mapping `type` → tên sheet (HARDCODE trong Apps Script)
```javascript
const SHEET_MAP = {
  tang_cuong_den: "Tang cuong den",
  ngam_hoa: "Ngam Hoa",
  thay_den: "Thay den",
  hkn: "4, HKN",
  tc_noi: "5. TCNoi",
  cap_luon_can: "6, Cap luon can",
  tc_ngam: "7. TCNgam",
  thay_can: "8. Thay Can",
  thay_tru: "9. Thay thế tru",
  choa_den: "10.choa den",
  nap_tru: "11. Nap tru",
  vo_tu: "12, Vo tu",
  tc_den_kc_xa: "13 Tăng cường đèn kc xa",
  decal_so_tru: "14 Decal số trụ",
  nang_mong: "15. Nâng móng"
};
```

---

## 8. Cloudinary

### Setup (user sẽ tự làm theo `SETUP.md`)
1. Tạo tài khoản tại `cloudinary.com` (free).
2. Tạo unsigned upload preset, set folder mặc định `khaosat`.
3. Lấy `cloud_name` và `upload_preset`, điền vào `js/config.js`.
4. Lấy `api_key` và `api_secret` (Dashboard → Account Details) → **lưu trong Apps Script Properties**:
   - `CLOUDINARY_API_KEY`
   - `CLOUDINARY_API_SECRET`
   - **KHÔNG** đưa các giá trị này vào `js/config.js` (frontend public).

### Xoá ảnh khi soft-delete bản ghi
Apps Script gọi Cloudinary Admin API:
```
POST https://api.cloudinary.com/v1_1/{cloud_name}/image/destroy
Body: { public_id, api_key, timestamp, signature }
signature = SHA1("public_id={pid}&timestamp={ts}" + api_secret)
```
- `public_id` parse từ URL Cloudinary đã lưu (vd `https://res.cloudinary.com/X/image/upload/v123/khaosat/tang_cuong_den/abc.jpg` → public_id = `khaosat/tang_cuong_den/abc`).
- Lỗi xoá ảnh (ảnh không tồn tại, network…) → **không chặn soft-delete row**, chỉ log và tiếp tục. Quan trọng hơn là dữ liệu chữ được đánh dấu xoá.

### ⚠️ OAuth scope trong `apps-script/appsscript.json` — đừng khai thừa

Khi manifest khai `oauthScopes` tường minh, script chỉ chạy được với **đúng** bộ đó và **phải được cấp đủ**. Khai thừa 1 scope chưa cấp → **toàn bộ** lệnh Google API trong script bị từ chối, kể cả những scope đã cấp. Triệu chứng dễ nhầm: lỗi báo thiếu quyền Drive trong khi tài khoản đã cấp Drive.

Bộ tối thiểu đang dùng — khớp với quyền đã cấp cho project:

| Scope | Dùng cho |
|---|---|
| `spreadsheets` | mọi thao tác đọc/ghi sheet |
| `drive` | upload/xoá ảnh, backup |
| `script.external_request` | `UrlFetchApp` (Cloudinary destroy, tải ảnh) |
| `userinfo.email` | định danh người chạy |

**Chưa khai** (khai vào là phải cấp quyền lại từ đầu):
- `https://mail.google.com/` — chỉ cần nếu bật email thông báo (`notifyAdmins`). Không khai thì `GmailApp.sendEmail` lỗi, nhưng đã bọc try/catch nên **không chặn submit**. Đây là restricted scope, màn hình xin quyền hiện cảnh báo nặng ("đọc, soạn, xoá vĩnh viễn toàn bộ email") → chỉ thêm khi thật sự cần.
- `script.scriptapp` — chỉ cần cho `setupBackupTrigger()` (backup tự động hàng tuần).

### Lưu ảnh: Drive là chính, Cloudinary là dự phòng (cập nhật 2026-08-15)

Ảnh đi qua `uploadBlobToDrive()` trong `js/api.js`:

1. **Google Drive** (chính) — POST `action=upload_photo` → Apps Script ghi vào thư mục con của `DRIVE_FOLDER_ID`, share ANYONE_WITH_LINK, trả `https://drive.google.com/uc?export=view&id=<ID>`.
2. **Cloudinary** (dự phòng, tự động) — nếu bước 1 ném lỗi (hay gặp: script chưa được cấp scope `drive`, hoặc `DRIVE_FOLDER_ID` chưa set), client upload thẳng lên Cloudinary bằng unsigned preset. **Không cần OAuth**, nên KTV ngoài hiện trường không bị kẹt khi backend trục trặc. Ghi `console.warn` để còn lần ra được.

Hệ thống hiểu cả 2 dạng URL: `handleDelete` trong Code.gs phân nhánh theo `url.includes('drive.google.com')` → `deleteDrivePhoto()` (trash file) hoặc `destroyCloudinaryImage()` (Admin API).

> ⚠️ Xoá ảnh Cloudinary cần `CLOUDINARY_API_KEY` + `CLOUDINARY_API_SECRET` trong Script Properties. Thiếu thì soft-delete vẫn chạy nhưng **ảnh còn nguyên trên Cloudinary** (chỉ log cảnh báo).

**Thư mục riêng theo loại KS**: schema khai `driveFolder`. Dấu `/` ở đầu = đặt ở gốc, ngang hàng `khaosat` (vd `thao_go_bang_ron` dùng `/Bangron`). Không khai thì mặc định `khaosat/<type>`.

**Chống tạo trùng thư mục**: form gửi nhiều ảnh song song, nếu thư mục chưa tồn tại thì các request cùng tạo → Drive sinh nhiều thư mục trùng tên. `getOrCreateFolderPath()` trong Code.gs dùng `LockService` + cache ID 6 tiếng để chặn.

### Code upload trong `js/api.js`
```javascript
async function uploadImage(file, surveyType) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', CONFIG.cloudinaryPreset);
  formData.append('folder', `khaosat/${surveyType}`);
  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CONFIG.cloudinaryName}/image/upload`,
    { method: 'POST', body: formData }
  );
  const json = await res.json();
  return json.secure_url; // https://res.cloudinary.com/.../image.jpg
}
```

### Nén ảnh trước upload (BẮT BUỘC)
Ảnh từ camera điện thoại thường 3-5MB → nén xuống ~500KB bằng canvas:
- Resize max chiều dài 1600px.
- Convert sang JPEG quality 0.8.
- Show preview thumbnail cho KTV xác nhận trước khi nộp.

Code mẫu trong `js/camera.js`:
```javascript
async function compressImage(file, maxDim = 1600, quality = 0.8) {
  const img = await loadImage(file);
  const ratio = Math.min(maxDim / img.width, maxDim / img.height, 1);
  const canvas = document.createElement('canvas');
  canvas.width = img.width * ratio;
  canvas.height = img.height * ratio;
  canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
  return new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', quality));
}
```

---

## 9. Yêu cầu UX cho form (BẮT BUỘC)

1. **Mobile-first**: ưu tiên màn hình 360-414px. Mọi input, button cao tối thiểu 44px (tap target Apple HIG).
2. **Trường bắt buộc** đánh dấu `*` đỏ, validate trước khi gửi.
3. **Auto-save nháp** vào `localStorage` mỗi 5s, key = `draft_<type>`. Khi mở lại form, hỏi "Có muốn khôi phục bản nháp?".
4. **Sau khi gửi thành công**:
   - Hiện toast "Đã lưu, STT #N"
   - Clear form + xóa draft
   - Pre-fill lại "Người khảo sát" cho lần sau (lưu vào localStorage key `last_nguoi_ks`)
   - Cho 2 lựa chọn: "Nhập tiếp loại này" (reload form trống) / "Về trang chủ"
5. **Khi offline**:
   - Phát hiện qua `navigator.onLine` + try/catch fetch.
   - Lưu submission vào queue `localStorage.queue_submissions`.
   - Khi online lại, tự động retry queue (có UI hiển thị "5 bản đang chờ đồng bộ").
6. **GPS**:
   - Khi mở form, tự xin permission và lấy GPS ngay.
   - Hiện trạng thái "Đang lấy GPS..." / "Đã có GPS (sai số Xm)" / "Không có GPS".
   - Nút "Lấy lại GPS" luôn hiển thị.
7. **Ảnh**:
   - Cho phép chụp ảnh mới (`capture="environment"`) HOẶC chọn từ thư viện.
   - Cho phép nhiều ảnh (multiple).
   - Hiện preview lưới 3 cột với nút X để xóa từng ảnh.
   - Upload diễn ra ngay khi chọn (parallel), hiện progress.
   - Chỉ submit form khi tất cả ảnh đã upload xong.
8. **Dropdown Quận/Phường**: do TP.HCM có 102 phường, dùng `<select>` thường là đủ (không cần search). Nhưng `Phường` phải lọc theo `Quận` đã chọn.
9. **TĐK**: 903 mục → BẮT BUỘC dùng `<datalist>`, không dùng `<select>` (lag).
10. **Không có nút "Hủy"** — chỉ có "Lưu" và "Về trang chủ" (có confirm).

---

## 10. Trang chủ `index.html`

Lưới 15 thẻ, mỗi thẻ:
- Icon emoji hoặc SVG đơn giản (vd 💡 cho `tang_cuong_den`, 🔧 cho `hkn`, 🏗️ cho `nang_mong`...)
- Tên loại khảo sát (đặt tên dễ hiểu cho KTV, ví dụ "Tăng cường đèn" thay vì "tang_cuong_den")
- Click → mở `form.html?type=<key>`

Header trang chủ có:
- Logo SAPULICO (placeholder text "SAPULICO" nếu chưa có logo)
- Link "Xem khảo sát hôm nay" → `recent.html`
- Indicator online/offline + số bản chờ sync

---

## 11. Trang `recent.html` (xem nhanh)

- Hiển thị tất cả bản ghi KTV này đã submit hôm nay (đọc từ localStorage `submitted_today`).
- Mỗi mục: loại KS, tuyến đường, thời gian, STT (server trả về), icon ảnh (nếu có).
- Click vào 1 mục → xem chi tiết các trường đã nhập (read-only).
- Mục đích: KTV tự kiểm tra xem mình đã làm gì trong ngày, KHÔNG phải để sửa (sửa thì lên Google Sheets).

---

## 12. Trang đăng nhập `login.html`

### Mục đích
- Entry point của toàn bộ app. Mọi trang khác (`index.html`, `form.html`, `recent.html`, `kpi.html`) **bắt buộc** check session ngay khi load — không có session hợp lệ → redirect về `login.html`.

### UI
- Form đơn giản: 1 input username + 1 input password + 1 nút "Đăng nhập".
- Có checkbox "Nhớ tôi" (mặc định bật) — kiểm soát việc lưu token vào `localStorage` (8 tiếng) hay `sessionStorage` (đến khi đóng tab).
- Hiện lỗi inline: "Sai tên đăng nhập hoặc mật khẩu", "Tài khoản bị khoá", "Sai 5 lần, vui lòng đợi 5 phút".
- Mobile-first như form khảo sát, button cao ≥44px.
- Logo + tên app phía trên form.

### Luồng đăng nhập
1. User nhập username/password → click "Đăng nhập".
2. Frontend gọi `POST {action: "login", username, password}` đến Apps Script.
3. Apps Script verify (hash + so sánh với sheet `taikhoan`).
4. Thành công → trả `{ ok: true, token, full_name, role, expires_at }`.
5. Frontend lưu `{ token, username, full_name, role, expires_at }` vào storage.
6. Redirect theo role:
   - `admin` hoặc `user` → `kpi.html` (mặc định cho quản lý).
   - `user1` → `index.html` (KTV nhập khảo sát).
   - `demo` → `index.html` nhưng mọi form ở chế độ readonly (nút Lưu disabled, hiện banner "Chế độ xem thử").

### Route guard (`js/auth.js`)
- Hàm `requireAuth(requiredPermission?)`: gọi đầu mỗi trang. Truyền tên permission cần (`submit`/`delete`/`kpi`/`manage`), hoặc không truyền để chỉ check đăng nhập.
  - Đọc token từ storage. Nếu không có / hết hạn → `location.replace('login.html')`.
  - Nếu `requiredPermission` được truyền và `PERMISSIONS[role][requiredPermission]` là false → redirect về trang phù hợp với role hiện tại (vd user1 vào `kpi.html` → đẩy về `index.html`; demo vào `manage.html` → đẩy về `index.html`).
- Hàm `getCurrentUser()`: trả `{ username, full_name, role }`.
- Hàm `hasPermission(action)`: shortcut cho `PERMISSIONS[currentRole][action]`. Dùng để show/hide UI (vd ẩn nút Xoá nếu không có quyền).
- Hàm `logout()`: clear storage + redirect login. Có nút "Đăng xuất" ở header mọi trang.

### Áp dụng cho từng trang
| Trang | Yêu cầu | Role được vào |
|---|---|---|
| `login.html` | không cần auth | tất cả (và chưa đăng nhập) |
| `index.html` | đăng nhập | tất cả (4 role) |
| `form.html` | `requireAuth('submit')` cho nút Lưu | demo vào được nhưng disable nút Lưu |
| `recent.html` | đăng nhập | tất cả; user1/demo chỉ thấy bản ghi của mình; admin/user thấy tất cả |
| `manage.html` | `requireAuth('manage')` | admin, user |
| `kpi.html` | `requireAuth('kpi')` | admin, user |

### Bảo mật — biết rõ giới hạn
- Mật khẩu hash SHA-256 + salt server-side là **đủ** cho nội bộ SAPULICO, **không đủ** cho hệ thống công khai. Không có 2FA, không lockout DB-side ngoài rate limit memory.
- Token stateless không thể revoke trước khi hết hạn (trừ khi đổi salt — sẽ vô hiệu hoá TẤT CẢ token đang dùng).
- Apps Script Web App `Anyone` nghĩa là endpoint public — bất kỳ ai có URL đều có thể spam request login. Rate limit ở mục 7 giảm thiểu, không loại bỏ.
- **Khuyến nghị**: chỉ dùng URL Apps Script trong nội bộ, không công khai trên trang public.

---

## 13. Trang KPI `kpi.html` (admin / user)

### Mục đích
Trang dashboard cho **quản lý văn phòng** xem hiệu quả và chấm điểm KPI cho từng KTV theo tháng. Tự động tính từ data thực trong Google Sheets, **không cần nhập tay**.

### Quyền truy cập
- `requireAuth('kpi')` ở đầu trang → chỉ role `admin` hoặc `user` vào được.
- `user1`/`demo` vô tình mở URL này → bị đẩy về `index.html`.
- **Lưu ý KPI**: chỉ tính trên bản ghi có `Deleted At` rỗng (bỏ qua bản đã soft-delete).

### UI
- Dropdown chọn tháng (mặc định = tháng hiện tại). Format `YYYY-MM`. Có thể chọn các tháng đã qua.
- Nút "Tải dữ liệu" → gọi `action=kpi` đến Apps Script.
- Hiện loading spinner (request có thể 3-5s).
- Bảng kết quả, mỗi hàng 1 KTV, cột:

| KTV | Họ tên | Số bản | Tần suất | Chất lượng | Đa dạng | Đầy đủ | Ổn định | **Tổng** | Xếp loại |
|---|---|---|---|---|---|---|---|---|---|

- Sort theo cột "Tổng" giảm dần (KTV xuất sắc lên đầu).
- Mỗi cột con cũng sortable bằng click header.
- Xếp loại có màu: A=xanh, B=xanh nhạt, C=vàng, D=đỏ.
- Có nút "Xuất CSV" → download file CSV để admin báo cáo.
- Click vào 1 KTV → mở modal hiện chi tiết: bản ghi theo từng loại KS, biểu đồ cột số bản theo ngày trong tháng (vẽ bằng SVG thuần, không thư viện).

### 5 chỉ tiêu chấm điểm (NGUỒN CHÂN LÝ)

Tính cho từng KTV trong tháng `M`:

**1. Tần suất** (`frequency`, trọng số 40%)
- Đếm số bản ghi user này submit trong tháng M (tất cả 15 loại cộng lại).
- Công thức: `min(count / target_submissions_per_month, 1) × 100`
- Default target = **50 bản/tháng**.

**2. Chất lượng dữ liệu** (`quality`, trọng số 30%)
- `pct_anh` = % bản có ≥1 URL trong cột `Ảnh (URLs)`.
- `pct_gps` = % bản **có GPS** tính theo loại:
  - **tang_cuong_den, ngam_hoa** (lưu tọa độ): bản có cả `kinh độ` và `vĩ độ` khác rỗng.
  - **12 loại còn lại có `link`** (thay_den, tc_noi, cap_luon_can, tc_ngam, thay_can, thay_tru, choa_den, nap_tru, vo_tu, tc_den_kc_xa, decal_so_tru, nang_mong): bản có cột `link` không rỗng.
  - **`hkn`**: **loại ra khỏi mẫu số** (không có GPS, không có link) → `NO_GPS_TYPES = ['hkn']`.
- Công thức: `pct_gps = số bản có GPS / tổng bản (trừ bản từ hkn)`
- `quality = (pct_anh + pct_gps) / 2`

**3. Đa dạng loại KS** (`diversity`, trọng số 15%)
- Số loại khảo sát khác nhau (trong 15 loại) mà user đã submit ít nhất 1 bản trong tháng.
- Công thức: `min(distinct_types / target_distinct_types, 1) × 100`
- Default target = **5 loại**.

**4. Đầy đủ thông tin** (`completeness`, trọng số 10%)
- Với mỗi bản: tỉ lệ trường `optional` (không bắt buộc) đã điền / tổng trường optional của loại đó.
- Trung bình tỉ lệ này trên tất cả bản trong tháng → × 100.
- Khuyến khích KTV điền cả ghi chú, năm lắp đặt, v.v.

**5. Tính ổn định** (`stability`, trọng số 5%)
- Số ngày khác nhau trong tháng mà user có ít nhất 1 submit (xét theo cột `Submitted At`, timezone Asia/Ho_Chi_Minh).
- Công thức: `min(active_days / target_active_days, 1) × 100`
- Default target = **20 ngày/tháng**.

### Công thức tổng

```
KPI_total = frequency × 0.40
          + quality × 0.30
          + diversity × 0.15
          + completeness × 0.10
          + stability × 0.05
```

Kết quả thang **0-100**, làm tròn 1 chữ số thập phân.

### Xếp loại

| Điểm | Loại | Ý nghĩa |
|---|---|---|
| ≥ 85 | **A** | Xuất sắc |
| 70 – 84.9 | **B** | Tốt |
| 55 – 69.9 | **C** | Đạt |
| < 55 | **D** | Cần cải thiện |

### Lưu ý quan trọng
- **Trọng số và mục tiêu lấy từ sheet `KPI_Targets`** nếu tồn tại, ngược lại dùng default trên. Cho phép admin tinh chỉnh mà không sửa code.
- KTV mới (chưa đủ tháng) sẽ có KPI thấp tự nhiên — admin tự đánh giá bối cảnh, không trừ điểm chỉ vì mới vào.
- Trang KPI **không sửa được dữ liệu** — chỉ xem. Sửa data phải vào Google Sheets trực tiếp.
- Khi có nghi vấn (vd KTV claim "tôi làm nhiều mà điểm thấp"), admin click chi tiết KTV → kiểm tra danh sách bản ghi cụ thể.

---

## 14. Trang quản lý bản ghi `manage.html` (admin / user)

### Mục đích
Cho admin/user tìm và xoá (soft-delete) các bản ghi cũ trực tiếp trong app, không cần mở Google Sheets. Khôi phục được bản đã xoá nhầm.

### Quyền truy cập
- `requireAuth('manage')` → chỉ `admin`, `user`.
- `user1`/`demo` truy cập → redirect `index.html`.

### UI
- **Bộ lọc** ở đầu trang:
  - Loại khảo sát (dropdown 15 loại + "Tất cả")
  - KTV (dropdown lấy từ sheet `taikhoan`)
  - Khoảng thời gian: từ ngày → đến ngày
  - Trạng thái: `Đang hoạt động` / `Đã xoá` / `Tất cả` (mặc định `Đang hoạt động`)
  - Ô tìm kiếm tự do (search trong cột Tuyến đường, Ghi chú)
- Nút "Tìm" → gọi `action=list` với filter, hiện loading.
- **Bảng kết quả** (paginate 50/trang):

| ☐ | STT | Loại | Tuyến đường | KTV | Ngày | Ảnh | Trạng thái | Thao tác |
|---|---|---|---|---|---|---|---|---|

- Cột "Ảnh": click → mở lightbox xem các ảnh đính kèm.
- Cột "Trạng thái": tag xanh `Hoạt động` / tag xám `Đã xoá lúc YYYY-MM-DD bởi X`.
- Cột "Thao tác":
  - Bản đang hoạt động → nút **Xem** (modal readonly) + nút **Xoá** (confirm 2 bước).
  - Bản đã xoá → nút **Khôi phục** (chỉ phục hồi data, không khôi phục ảnh — báo trước).
- Checkbox đầu hàng + nút "Xoá đã chọn" để xoá hàng loạt (kèm confirm).

### Confirm xoá
Modal:
```
Bạn sắp xoá bản ghi STT #N của loại "Tang cuong den".
- Dữ liệu sẽ được đánh dấu xoá (có thể khôi phục).
- Tất cả ảnh đính kèm sẽ bị xoá VĨNH VIỄN khỏi Cloudinary, KHÔNG khôi phục được.

[Huỷ]  [Xoá vĩnh viễn ảnh + soft-delete data]
```

### Audit log nhẹ
- Mỗi lần xoá, ghi log vào sheet `Audit` (cùng file):
  - `timestamp` | `action` (delete/restore) | `username` | `target_sheet` | `target_stt` | `note`
- Sheet `Audit` được tự động tạo nếu chưa có. Admin xem bằng cách mở Google Sheets, không cần UI trong app.

---

## 15. Trang báo cáo tổng hợp `report.html` (admin / user)

### Mục đích
Khác với KPI (chấm điểm KTV), trang này tổng hợp **số liệu khảo sát** theo các chiều cắt (loại KS / thời gian / KTV / trạng thái) để admin báo cáo lên cấp trên và theo dõi tiến độ dự án.

### Quyền truy cập
- `requireAuth('report')` → chỉ `admin`, `user`.
- `user1`/`demo` truy cập → redirect `index.html`.

### UI
- **Bộ lọc** (ngang trên đầu trang):
  - Loại khảo sát: multi-select (15 loại), mặc định "Tất cả".
  - Khoảng thời gian: từ ngày → đến ngày. Có preset nhanh: "Tháng này", "Tháng trước", "Quý này", "Năm nay", "Tuỳ chọn".
  - KTV: multi-select từ sheet `taikhoan`, mặc định "Tất cả".
  - Trạng thái: `Đang hoạt động` (mặc định) / `Đã xoá` / `Tất cả`.
  - Mức tổng hợp (group by): `Ngày` / `Tuần` / `Tháng` / `Quý`. Mặc định = `Tháng`.
- Nút "Tải báo cáo" → gọi `action=report` với filter.
- **Khu vực kết quả** chia 3 vùng:

  **A. Bảng tổng quan** (1 dòng/loại KS):
  | Loại KS | Tổng bản | Có ảnh | Có GPS | Trung bình ảnh/bản | Đã xoá |
  |---|---|---|---|---|---|

  **B. Biểu đồ cột chồng** (stacked bar chart, vẽ bằng SVG vanilla):
  - Trục X = thời gian (theo mức group by).
  - Mỗi cột = tổng số bản, chia màu theo loại KS.
  - Tooltip hover hiện chi tiết.

  **C. Bảng pivot KTV × Loại KS**:
  | KTV \ Loại | Tang cuong den | Ngam Hoa | ... | Tổng |
  |---|---|---|---|---|
  | Nguyễn Văn A | 12 | 8 | ... | 45 |
  | ... |

- Nút "Xuất tổng hợp (CSV)" → tải về 3 file CSV tương ứng 3 vùng A/B/C (zip lại 1 file).
- Click vào số trong bảng → mở popup hiện danh sách bản ghi cụ thể (drill-down).

  **D. Xuất dữ liệu thô theo cấu trúc sheet** (tab riêng hoặc section dưới cùng):
  - Mục đích: tải về file Excel/CSV có cấu trúc cột **y hệt Google Sheets** của từng loại KS — để nộp hồ sơ, báo cáo lên cấp trên, hoặc đối chiếu với file Excel gốc.
  - Bộ lọc riêng cho vùng D: chọn 1 hoặc nhiều loại KS + khoảng thời gian + KTV + trạng thái.
  - **Nút "Xuất Excel (.xlsx)"**: dùng SheetJS, tạo workbook nhiều tab — mỗi loại KS được chọn = 1 tab riêng, tên tab = tên sheet Google Sheets nguyên văn (vd `Tang cuong den`, `Ngam Hoa`...).
  - **Nút "Xuất CSV (từng loại)"**: mỗi loại KS = 1 file `.csv` riêng, đặt tên `<sheet_name>_<from>_<to>.csv`, download từng file một (hoặc zip tất cả).
  - **Yêu cầu cấu trúc file xuất (QUAN TRỌNG)**:
    - **Row 1 = header nguyên văn** đúng thứ tự cột của sheet, lấy từ `HEADERS[type]` + `BONUS_COLS` (giống hệt Google Sheets).
    - Ví dụ cho `Tang cuong den`: `STT | Hẻm | Tuyến đường | Quận | Phường | Tủ điều khiển | Độ rộng đường | ... | Link Google Map | Ảnh (URLs) | Submitted At | User Agent | Username | Deleted At | Deleted By`
    - **Thứ tự cột cố định** theo `HEADERS[type]` trong `Code.gs` — không được tự ý sắp xếp lại.
    - Giá trị `null`/rỗng xuất ra ô trống (không xuất `"null"` hay `"undefined"`).
    - Cột `Ảnh (URLs)`: giữ nguyên dạng chuỗi URL phân tách bằng `|`.
    - Cột ngày giờ (`ngày khảo sát`, `Submitted At`, `Deleted At`): giữ nguyên format `yyyy-MM-dd HH:mm:ss`.

### Logic server-side `action=report`
1. Verify role có quyền `report`.
2. Scan các sheet trong `types` (mặc định 15 sheet), filter rows:
   - `Submitted At` thuộc `[from, to]`.
   - `Username` thuộc `usernames` (nếu chỉ định).
   - `Deleted At` rỗng/không rỗng theo `status`.
3. Aggregate:
   - Đếm theo loại.
   - Đếm theo (loại, thời_gian_bucket) — bucket tính theo `Submitted At` và mức group by.
   - Đếm theo (KTV, loại).
   - Đếm ảnh, GPS theo loại.
4. Trả về 3 mảng tương ứng 3 vùng A/B/C. Format ổn định để frontend render.

### Logic server-side `action=export_raw` (mới — cho vùng D)

Endpoint riêng tách khỏi `action=report` vì trả raw rows (không aggregate):

```
Body: { token, types: ["tang_cuong_den", "ngam_hoa", ...], from?, to?, usernames?: [], status? }
```

1. Verify role có quyền `report`.
2. Với mỗi type trong `types`:
   a. Mở sheet, đọc header row (đúng thứ tự cột trong sheet).
   b. Filter rows theo điều kiện (from/to/usernames/status).
   c. Trả về `{ type, sheetName, headers: [...], rows: [[val, val, ...], ...] }` — rows là array of arrays (không phải object) để giữ đúng thứ tự cột.
3. Trả `{ ok, results: [{ type, sheetName, headers, rows }, ...] }`.
4. **Không dùng `action=list`** cho export vì `list` trả JSON objects, frontend phải tự sắp xếp lại thứ tự cột — dễ sai. `export_raw` trả đúng thứ tự luôn.

Frontend nhận `results` → SheetJS tạo workbook: mỗi `result` = 1 worksheet, `ws_name = sheetName`, data = `[headers, ...rows]`.

### Performance
- Với 15 sheet × vài ngàn rows, scan toàn bộ có thể 3-8s. Chấp nhận với UI loading rõ ràng.
- `export_raw` cho 1 loại KS nhẹ hơn nhiều (chỉ scan 1 sheet) — nên khuyến khích user chọn lọc loại trước khi xuất.
- Nếu sau này dữ liệu vượt 50k rows, cân nhắc thêm sheet `Index` cache rebuild incremental khi mỗi submit. Chưa làm ngay.
- **Tuỳ chọn**: trang `report.html` có thể đọc trực tiếp từ Google Sheets **CSV publish URL** (xem mục 16) thay vì gọi Apps Script — nhanh hơn vì không qua serverless. Nhược điểm: data public, không filter server-side, cần parse 15 CSV. Mặc định KHÔNG dùng cách này; chỉ bật khi Apps Script chậm quá.

---

## 15b. Trang báo cáo băng rôn `bangron.html` (admin / user) — bổ sung 2026-08-15

### Mục đích
Báo cáo **riêng** cho loại KS thứ 16 (`thao_go_bang_ron`), có **kèm hình ảnh hiện trường** — thứ mà `report.html` (chỉ aggregate số) và `bbht.html` (chỉ bảng khối lượng) đều không làm được. Thay cho cách báo qua Zalo hiện nay.

### Quyền truy cập
`requireAuth('report')` → chỉ `admin`, `user`. `user1`/`demo` bị đẩy về `index.html`.

### Bộ lọc
Từ ngày → đến ngày (mặc định đầu tháng → hôm nay), Quận → Phường (cascade), KTV (chỉ admin/user), Loại quảng cáo. Gọi `apiList({ type:'thao_go_bang_ron', from:from+'T00:00:00', to:to+'T23:59:59', status:'active' })` rồi lọc tiếp phía client.

> ⚠️ **Phải kèm `T00:00:00` / `T23:59:59`**: `handleList` trong Code.gs làm `new Date(body.to)` — truyền `'2026-08-15'` trần sẽ thành nửa đêm UTC, mất trọn ngày cuối. (`bbht.js` hiện vẫn còn lỗi này, sửa sau.)

### Hai kiểu trình bày (nút chuyển, không mất nội dung đã gõ)
1. **Báo cáo hình ảnh** (mặc định) — tiêu đề + bảng tổng hợp (có dòng TỔNG CỘNG số tấm) + mỗi lượt tháo gỡ là 1 khối: dòng tiêu đề `N. Tháo băng rôn đường X (đoạn ...), phường Y: Z tấm` (đúng câu chữ nhân viên đang dùng) + lưới ảnh 3 cột.
2. **Văn bản hành chính** — quốc hiệu/tiêu ngữ, số văn bản, I. Thời gian–địa bàn, II. Kết quả (bảng), III. Nhận xét–kiến nghị, khối chữ ký 2 bên, rồi **PHỤ LỤC ẢNH** sang trang mới.

Các ô cần điền tay dùng `contenteditable class="ed"`; nội dung đã gõ được cache theo `id` nên đổi kiểu trình bày không mất.

### Ba đường xuất
| Nút | Cơ chế | Ghi chú |
|---|---|---|
| 🖨️ In / Lưu PDF | `window.print()` + CSS `@media print` (A4, `page-break-inside:avoid` cho mỗi khối ảnh) | **Đường khuyến nghị** — ảnh luôn hiện, chữ nét và chọn được |
| 📄 Xuất PDF | html2canvas → JPEG → jsPDF cắt trang A4 | Phải chạy `inlinePhotos()` trước: tải ảnh qua `action=photo_base64` → gán `data:` URL, có cache + hiện tiến trình. Ảnh lỗi → ô xám, không chặn cả file |
| 📊 Xuất Excel | SheetJS, 1 sheet | Cột theo đúng `HEADERS.thao_go_bang_ron` + `Username`, `Submitted At`, `Ảnh 1..5` tách riêng, cuối cùng là dòng TỔNG CỘNG |

---

## 16. PWA

`manifest.json`:
```json
{
  "name": "Khảo sát chiếu sáng SAPULICO",
  "short_name": "KS Đèn",
  "start_url": "./",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#1e40af",
  "icons": [
    { "src": "assets/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "assets/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

`sw.js`: cache shell (`index.html`, `form.html`, `recent.html`, các file JS/CSS) cho phép mở app offline. Không cache API responses.

---

## 17. File `js/config.js`

```javascript
// js/config.js — Sửa các giá trị này sau khi setup xong Apps Script & Cloudinary
export const CONFIG = {
  // URL Apps Script Web App (SAPULICO production, deployed 2026-05-26)
  appsScriptUrl: 'https://script.google.com/macros/s/AKfycbxX9mgYO6g9A4BRTmJN3QpiZg1VutAeWcNgm4hY8zHPaPykgWYmgFv8M20S7YG8oCp7/exec',

  // CSV publish URL của Google Sheets (read-only, dùng cho report.html nếu cần đọc trực tiếp)
  // CẢNH BÁO: URL này public, ai có URL đều đọc được data.
  sheetsCsvUrl: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRajzWe7TR5VPW5QOzYAOdZJoqRRbQpk4iO4GKOT4rd7GUQj87fTsPAll6cCC6bkcpEyMs5FYg_JMrH/pub?output=csv',

  // Cloudinary
  cloudinaryName: 'your-cloud-name',
  cloudinaryPreset: 'khaosat_unsigned',

  // Tùy chọn
  imageMaxDim: 1600,
  imageQuality: 0.8,
  autosaveInterval: 5000,
  sessionTimeoutHours: 8,
};
```

### ⚠️ Cảnh báo bảo mật về 2 URL trên
- `appsScriptUrl`: bất kỳ ai có URL này đều POST được. Có 3 lớp bảo vệ:
  1. Mọi action ngoài `login` yêu cầu token hợp lệ.
  2. Login có rate limit (5 lần sai/phút → khoá 5 phút).
  3. Role-based permission.
  → Vẫn có thể bị spam request login → nên giữ URL kín, **không công khai trên web/social**.
- `sheetsCsvUrl`: ai có URL đều đọc được **một sheet** (sheet được publish). Vô tình lộ data sản xuất chiếu sáng.
- **Nếu repo GitHub là Public**: 2 URL này lộ ra → cân nhắc **đổi repo sang Private** hoặc tách `config.js` ra khỏi git (gitignore) và để user tự sửa khi deploy. Câu hỏi 5 ở mục 21 cần làm rõ điều này.

---

## 18. Thứ tự thực hiện (CHECKLIST cho Claude Code)

Khi nhận lệnh "bắt đầu code dự án này", thực hiện theo đúng thứ tự:

- [ ] **B1.** Tạo `README.md` (giới thiệu ngắn, hướng dẫn KTV mở app trên điện thoại, hướng dẫn admin xem KPI + quản lý bản ghi + báo cáo).
- [ ] **B2.** Tạo `SETUP.md` chi tiết từng bước: tạo Google Sheets, paste 15 header + sheet `taikhoan` + sheet `KPI_Targets`, đặt conditional format cho cột `Deleted At`, set `AUTH_SALT` + `CLOUDINARY_API_KEY` + `CLOUDINARY_API_SECRET` trong Script Properties, deploy Apps Script, tạo Cloudinary preset, sửa `config.js`, push GitHub Pages. Kèm hướng dẫn tạo user đầu tiên (admin) và hash mật khẩu, ví dụ mỗi role 1 tài khoản (admin/user/user1/demo). Hướng dẫn Publish-to-web để lấy CSV URL (nếu dùng).
- [ ] **B3.** Tạo `apps-script/Code.gs` đầy đủ với 7 endpoint (`login`, `submit`, `list`, `delete`, `restore`, `kpi`, `report`) theo mục 7. Bảng `PERMISSIONS`. Hàm helper `hashPassword(plain)`. Comment tiếng Việt.
- [ ] **B4.** Đọc file Excel gốc (`khao sat tang cuong den.xlsx`) → sinh `js/lookups.js` đầy đủ 102 phường + 903 TĐK. **Nếu không có file Excel trong repo, HỎI user upload trước.**
- [ ] **B5.** Tạo `js/schemas.js` với đầy đủ 15 schema theo đúng mục 5.
- [ ] **B6.** Tạo `js/utils.js`, `js/auth.js` (bao gồm `PERMISSIONS` map, `requireAuth`, `hasPermission`, `isFullAccess`), `js/gps.js`, `js/camera.js`, `js/storage.js`, `js/api.js` (helper modules).
- [ ] **B7.** Tạo `js/form-renderer.js` — engine chính render form từ schema, validate, submit. Trường `nguoi_ks` auto-fill từ `auth.getCurrentUser().full_name`, readonly. Role `demo` → disable nút Lưu, hiện banner.
- [ ] **B8.** Tạo `login.html` — trang đăng nhập theo mục 12.
- [ ] **B9.** Tạo `form.html` — load `?type=` từ URL, gọi renderer. Có `requireAuth()` đầu trang.
- [ ] **B10.** Tạo `index.html` — trang chủ 15 ô. Có `requireAuth()`. Header hiện tên user + role badge + nút Đăng xuất + (nếu có quyền) các link "KPI", "Quản lý", "Báo cáo".
- [ ] **B11.** Tạo `recent.html`. Có `requireAuth()`. user1/demo chỉ thấy của mình; admin/user thấy tất cả.
- [ ] **B12.** Tạo `js/kpi.js` + `kpi.html` — bảng KPI tháng, chi tiết KTV, export CSV. Có `requireAuth('kpi')`.
- [ ] **B13.** Tạo `js/manage.js` + `manage.html` — bộ lọc, bảng bản ghi, xoá/khôi phục. Có `requireAuth('manage')`.
- [ ] **B14.** Tạo `js/report.js` + `report.html` — 4 vùng kết quả:
  - Vùng A: bảng tổng quan (đếm theo loại).
  - Vùng B: biểu đồ cột chồng SVG (theo thời gian).
  - Vùng C: pivot KTV × Loại KS.
  - Vùng D: xuất dữ liệu thô theo cấu trúc sheet — gọi `action=export_raw`, dùng SheetJS tạo Excel nhiều tab (mỗi loại KS = 1 tab, tên tab = tên sheet nguyên văn, cột đúng thứ tự `HEADERS[type]` + `BONUS_COLS`). Có cả nút "Xuất CSV từng loại".
  - Có `requireAuth('report')`.
- [ ] **B15.** Tạo `manifest.json`, `sw.js`, icon placeholder.
- [ ] **B16.** **Test thủ công** trên Chrome desktop + 1 lần Chrome mobile (devtools mobile mode):
  - Đăng nhập sai → hiện lỗi, không lưu token. Sai 5 lần → bị khoá 5 phút.
  - Đăng nhập `user1` (KTV) → vào `index.html`, mở từng form trong 15 loại — render đúng, `Người khảo sát` auto-fill readonly, không lỗi console.
  - Submit 1 form `tang_cuong_den` thật → kiểm tra row xuất hiện đúng cột, `Username` đúng, `Deleted At` rỗng.
  - Đăng nhập `demo` → mọi form thấy được nhưng nút Lưu disabled, banner hiện rõ. Cố submit qua devtools → server reject.
  - Đăng nhập `admin` → tự vào `kpi.html`, chọn tháng hiện tại → bảng KPI đúng, xếp loại đúng. Mở `manage.html` → filter ra bản test → xoá → kiểm tra Google Sheets thấy `Deleted At` có giá trị + ảnh Cloudinary đã biến mất. Khôi phục → `Deleted At` về rỗng nhưng ảnh không quay lại. Mở `report.html` → đặt filter "Tháng này, tất cả loại, tất cả KTV" → bảng+biểu đồ hiện đúng.
  - `user` thử lại các flow của admin → hoạt động giống.
  - `user1` cố mở `kpi.html`/`manage.html`/`report.html` → bị redirect về `index.html`. `demo` cũng vậy.
  - KPI và report bỏ qua bản đã soft-delete (verify bằng cách xoá 1 bản rồi tính lại).
  - Test offline: tắt mạng → submit (với user1) → bật mạng → bản đang chờ phải tự sync.
- [ ] **B17.** Viết section "Known Issues" vào `README.md` nếu phát hiện gì.

---

## 19. Checklist chất lượng (Claude tự review trước khi báo "xong")

- [ ] Không có hardcode URL Apps Script / Cloudinary / salt / API secret trong file ngoài `config.js` và Apps Script Properties.
- [ ] `CLOUDINARY_API_SECRET` không lộ ra bất kỳ file frontend nào.
- [ ] Tất cả 15 form render được không lỗi console.
- [ ] Header trong Google Sheets test giống NGUYÊN VĂN trong mục 4-5 (kể cả 5 cột bổ sung cuối).
- [ ] STT, Ngày khảo sát, Người khảo sát, Username, Submitted At do server gán, không tin client.
- [ ] `nguoi_ks` ở UI là readonly, KTV không thể sửa.
- [ ] GPS bật trên HTTPS, có fallback khi user từ chối permission.
- [ ] Ảnh được nén trước upload (verify bằng cách check size response).
- [ ] localStorage có dọn dẹp (sau khi submit thành công, xóa draft). Token KHÔNG bị xoá nhầm.
- [ ] Đã test trên màn hình 360px width (Chrome devtools).
- [ ] Đã test offline → online sync queue. Queue có gửi kèm token; nếu token hết hạn thì hỏi đăng nhập lại trước khi sync.
- [ ] Đã test login sai 5 lần → bị khoá 5 phút.
- [ ] Đã test 4 role: admin/user/user1/demo. Mỗi role chỉ vào được trang được phép.
- [ ] Demo thấy form nhưng nút Lưu disabled. Submit từ demo bị server reject.
- [ ] Admin xem KPI tháng có data thật, các con số đúng (so với đếm tay vài KTV).
- [ ] Soft-delete hoạt động: bản ghi có `Deleted At` không hiện trong recent/kpi/list mặc định.
- [ ] Khi soft-delete, ảnh Cloudinary bị xoá thật (verify trên Cloudinary dashboard).
- [ ] Restore phục hồi cờ Deleted At nhưng cảnh báo ảnh không khôi phục được.
- [ ] Sheet `Audit` ghi log mỗi lần delete/restore.
- [ ] Report tổng quan đếm đúng — đối chiếu thủ công với Google Sheets COUNTIF.
- [ ] Report bỏ qua bản đã soft-delete khi status filter là "Đang hoạt động".
- [ ] Pivot KTV × Loại không hiện hàng trống cho KTV không submit gì trong khoảng filter.
- [ ] Vùng D `export_raw`: file Excel xuất ra có đúng số sheet, tên tab nguyên văn, thứ tự cột khớp 100% với Google Sheets (so sánh bằng cách mở song song 2 file).
- [ ] CSV xuất ra dùng separator `|` (pipe), không bị vỡ khi có dữ liệu chứa dấu phẩy hoặc tiếng Việt.
- [ ] Giá trị `null`/rỗng không xuất thành chuỗi `"null"` hay `"undefined"` trong file xuất.
- [ ] `SETUP.md` đầy đủ, một người không phải dev cũng theo được.

---

## 20. Quy tắc giao tiếp với user (Lam Mai - SAPULICO)

- User là kỹ sư, làm việc bằng tiếng Việt, ưu tiên giao tiếp tiếng Việt.
- User KHÔNG phải lập trình viên web. Khi giải thích kỹ thuật, dùng từ ngữ thực tế.
- **Khi gặp ambiguity, HỎI thay vì tự quyết** (đặc biệt với: header tiếng Việt có khoảng trắng cuối, có nên thêm trường mới không, đổi tên sheet, đổi UX...).
- Khi báo cáo tiến độ, dùng checklist mục 18 — nói rõ đã làm B mấy, đang ở B mấy.
- **Không** xài emoji nhiều, không tagline marketing. Tone kỹ thuật, ngắn gọn.

---

## 21. Quyết định cấu hình (đã chốt với user)

Mọi câu hỏi đã được trả lời ngày 2026-05-26. **KHÔNG được tự ý đổi các quyết định dưới đây — nếu phát hiện vướng mắc kỹ thuật, HỎI user trước.**

### Thông tin dự án
- **Đơn vị**: SAPULICO (không phải LAVIPCO — đã đổi tên 2026-05-26).
- **Tên file Google Sheets**: `khao-sat-ke-hoach`.
- **Repo GitHub**: `khaosat`. **PUBLIC**. (user chấp nhận rủi ro URL Apps Script lộ ra — xem phần ⚠️ dưới).
- **Domain**: dùng GitHub Pages mặc định (`<user>.github.io/khaosat`), không domain riêng.
- **Logo**: dùng text placeholder "SAPULICO" cho đến khi user cung cấp file ảnh.

### Phân quyền & đăng nhập
- **Đăng nhập**: có. Username/password lưu trong sheet `taikhoan` của cùng file Google Sheets.
- **4 role**: `admin`, `user` (alias của admin), `user1` (KTV mặc định), `demo` (chỉ xem form).
- **Người khảo sát auto-fill**: lấy từ `full_name` của user đã đăng nhập, readonly.
- **Tài khoản KTV ban đầu**: user sẽ tự tạo trong sheet `taikhoan` sau khi setup. Claude tạo 4 user mẫu (1 cho mỗi role) trong `SETUP.md` để user theo template.

### Các trang
- **Trang KPI**: chỉ admin/user. 5 chỉ tiêu, trọng số 40/30/15/10/5, thang 100, xếp loại A/B/C/D.
- **Trang quản lý `manage.html`**: chỉ admin/user. Filter, xoá, khôi phục.
- **Trang báo cáo `report.html`**: chỉ admin/user. Filter theo loại KS / thời gian / KTV / trạng thái + group by ngày/tuần/tháng/quý. 3 vùng kết quả.
- **Soft-delete**: bản ghi xoá có `Deleted At`, ảnh Cloudinary xoá thật, có sheet `Audit` log.

### Schema chi tiết
- **Trường "Bản vẽ"** (xuất hiện ở 3 form: tang_cuong_den, ngam_hoa, thay_den): **type `image_url`** — KTV chụp ảnh bản vẽ thiết kế (giấy A4) ngay tại hiện trường, upload lên Cloudinary folder `khaosat/banve/`, lưu URL vào cột. Không bắt buộc. *(Update 2026-05-28: đã đổi từ `text` → `image_url`, implement trong `js/schemas.js` và tính năng 22.1 xem như đã hoàn thành)*
- **Trường "Năm lắp đặt"**: nhập tự do dạng number, KHÔNG giới hạn range.

### Mục tiêu KPI
- Giữ default của mục 13 (50 bản/tháng, 5 loại, 20 ngày) — user sẽ điều chỉnh sau qua sheet `KPI_Targets`.

### URL production (đã nhận từ user 2026-05-26)
- Apps Script: `https://script.google.com/macros/s/AKfycbxX9mgYO6g9A4BRTmJN3QpiZg1VutAeWcNgm4hY8zHPaPykgWYmgFv8M20S7YG8oCp7/exec`
- Sheets CSV publish: `https://docs.google.com/spreadsheets/d/e/2PACX-1vRajzWe7TR5VPW5QOzYAOdZJoqRRbQpk4iO4GKOT4rd7GUQj87fTsPAll6cCC6bkcpEyMs5FYg_JMrH/pub?output=csv`

### ⚠️ Rủi ro bảo mật đã được user chấp nhận
Repo PUBLIC + URL Apps Script trong `js/config.js` → **URL bị lộ trên GitHub**. Hệ quả thực tế:
1. Ai có URL đều POST request được. Bảo vệ chính là token + role + rate limit + `active=FALSE`. Mật khẩu KTV phải đủ mạnh.
2. Sheets CSV public — sheet được publish có thể đọc bất kỳ.
3. **Khuyến nghị mitigation tối thiểu cho user thực hiện**:
   - Mật khẩu KTV ≥ 10 ký tự, không trùng tên user.
   - `AUTH_SALT` ≥ 32 ký tự random, không tiết lộ.
   - `CLOUDINARY_API_SECRET` chỉ trong Script Properties, **không bao giờ** vào git.
   - Kiểm tra log Apps Script định kỳ (Executions) — phát hiện spam thì rotate URL (re-deploy với version mới).

---

## 22. Roadmap v1.1+ — Tính năng đang thiết kế (chờ user duyệt)

> Phần này là **thiết kế chi tiết** cho 16 tính năng mới. Mỗi tính năng có: Mục đích / File mới hoặc sửa / Schema thay đổi / Endpoint mới / UI flow / Permission. Khi user duyệt thiết kế nào → mới code theo đúng spec. KHÔNG code trước khi user nói rõ.

### Phân pha đề xuất
- **v1.1 (easy wins)**: 22.1 → 22.6 (Bản vẽ ảnh, Filter KTV, KPI cá nhân, Reset pwd, Sửa bản ghi, Excel/PDF)
- **v1.2 (medium)**: 22.7 → 22.11 (Geocoding, Bản đồ, Email, User CRUD, Tài liệu)
- **v2.0 (big)**: 22.12 → 22.16 (QR scan, Voice, Heatmap, Backup, Lịch công tác)

### Bổ sung phân quyền cần thêm vào sheet `phan quyen`

Khi triển khai v1.1+, thêm 4 cột mới vào sheet `phan quyen`: `edit` (sửa bản ghi), `users_manage` (CRUD user), `schedule_write` (tạo lịch), `notify_admin` (nhận email). Default permissions:

| Role | edit | users_manage | schedule_write | notify_admin |
|---|---|---|---|---|
| admin | TRUE | TRUE | TRUE | TRUE |
| user | TRUE | FALSE | TRUE | TRUE |
| user1 | FALSE | FALSE | FALSE | FALSE |
| demo | FALSE | FALSE | FALSE | FALSE |

`my_kpi` (KPI cá nhân) — KHÔNG cần cột mới: tất cả role đăng nhập đều xem được KPI của chính mình (server tự filter).

---

### ~~22.1 — Bản vẽ → upload ảnh (thay vì text)~~ ✅ **ĐÃ HOÀN THÀNH (2026-05-28)**

**Mục đích**: KTV chụp ảnh bản vẽ thiết kế (giấy A4) ngay tại hiện trường thay vì gõ mã.

**Đã thực hiện**:
- `js/schemas.js`: 3 schema `Bản vẽ` (tang_cuong_den, ngam_hoa, thay_den) đã dùng `type: 'image_url'`.
- Cần **hoàn thiện thêm** trong `js/form-renderer.js`: renderer cho `image_url` — nút chụp/chọn ảnh, upload Cloudinary folder `khaosat/banve/`, thumbnail preview.

**UI cần làm** (trong form-renderer):
- Nút "📷 Chụp/Chọn ảnh bản vẽ" → upload Cloudinary folder `khaosat/banve/` → thumbnail preview + URL ẩn.
- Cho phép replace ảnh nếu chụp sai.
- Cho phép để trống (không bắt buộc).

**Lưu Google Sheets**: cell chứa URL Cloudinary (giống cột `Ảnh (URLs)` nhưng đơn lẻ).

---

### 22.2 — Filter KTV trong manage.html

**Mục đích**: dropdown KTV trong trang Quản lý hiện đang rỗng (known issue v1.0).

**File sửa**:
- `apps-script/Code.gs`: thêm `action: "users"` → return `[{username, full_name, role, active}]` (chỉ active=TRUE). Permission: bất kỳ role có quyền `manage` hoặc `report`.
- `js/api.js`: thêm `apiUsers()`.
- `js/manage.js` + `js/report.js`: gọi `apiUsers()` khi init, populate dropdown.

**Schema**: không thay đổi.

**Effort**: nhỏ (~30 phút).

---

### 22.3 — KPI cá nhân cho KTV (`my-kpi.html`)

**Mục đích**: KTV (user1) xem KPI của CHÍNH MÌNH theo tháng, không thấy người khác. Admin vẫn dùng `kpi.html` để xem all.

**File mới**:
- `my-kpi.html` — trang đơn, giống `kpi.html` nhưng chỉ 1 hàng (KTV hiện tại) + biểu đồ ngày + 5 chỉ tiêu.
- `js/my-kpi.js` — gọi `apiKpi(month)` rồi filter `results.find(r => r.username === currentUser.username)`.

**File sửa**:
- `apps-script/Code.gs` `handleKpi`: nếu role không có quyền `kpi` (vd user1) → vẫn cho phép, nhưng filter results chỉ trả 1 entry của chính mình. Hoặc: tạo action mới `my_kpi`.
- `index.html` menu: thêm "🎯 KPI của tôi" → `my-kpi.html` cho mọi role (user1 thấy của mình, admin/user click vào `kpi.html` xem tổng thay vì cá nhân).

**Permission**: không cần thêm — tất cả role đăng nhập đều xem được của mình.

---

### 22.4 — Reset password qua UI

**Mục đích**: Admin reset/đổi password user mà không vào Apps Script editor.

**File sửa**:
- `apps-script/Code.gs`: thêm `action: "reset_password"` → body `{token, username, new_password}`. Permission: `users_manage` (chỉ admin). Hash mới + ghi đè cột `password_hash`. Log vào Audit (action=reset_password, note=`username`). KHÔNG log password.
- (sẽ tạo cùng `users.html` ở 22.10) UI: nút "🔑 Reset PWD" cạnh user → dialog nhập mật khẩu mới 2 lần xác nhận → call API.

**Bảo mật**: password mới ≥8 ký tự, không trùng username. Admin được tự reset password của chính mình. User1/demo không có quyền.

---

### 22.5 — Sửa bản ghi (Edit)

**Mục đích**: Admin/user sửa bản ghi đã submit (sửa typo, bổ sung thông tin) thay vì phải xoá + tạo lại.

**File sửa**:
- `apps-script/Code.gs`: thêm `action: "update"` → body `{token, type, stt, data, photos?}`. Permission `edit`. Tìm row theo STT. **KHÔNG ghi đè** các trường server-managed (STT, Submitted At, Username, Người khảo sát gốc — giữ để KPI tính đúng). Cho phép sửa các field business (Tuyến, Phường, Số đèn...). Nếu `photos` có → ghi đè cột `Ảnh (URLs)`. Log Audit action=update với note `fields_changed: [...]`.
- `js/api.js`: thêm `apiUpdate(type, stt, data, photos)`.
- `js/manage.js`: thêm nút "✏️ Sửa" cạnh "Xoá" → redirect `form.html?type=X&edit=STT`.
- `js/form-renderer.js`: thêm edit mode. Nếu URL có `&edit=STT`:
  - Gọi `apiList({type, stt})` để load row.
  - Pre-fill toàn bộ field (kể cả gps_lat/lng readonly).
  - Đổi nút "Lưu" thành "Cập nhật", submit gọi `apiUpdate` thay vì `apiSubmit`.
  - Disable thay đổi `Người khảo sát`, `STT` (đã readonly sẵn).

**Audit nghiêm ngặt**: ai sửa gì, khi nào — đều log.

---

### 22.6 — Xuất Excel + PDF

**Mục đích**: ngoài CSV đơn giản, export Excel đa sheet (đẹp, có format) + PDF báo cáo (giấy).

**Thư viện CDN**:
- SheetJS: `https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js`
- jsPDF: `https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js`
- jsPDF AutoTable: `https://cdn.jsdelivr.net/npm/jspdf-autotable@3.7.1/dist/jspdf.plugin.autotable.min.js`

**File sửa**:
- `kpi.html` + `report.html`: thêm 2 nút "📊 Excel" + "📄 PDF" cạnh "📥 CSV".
- `js/kpi.js`: hàm `exportXlsx()` tạo workbook 1 sheet (KPI table). Hàm `exportPdf()` tạo PDF A4 portrait với header SAPULICO + tên tháng + bảng KPI + footer trang.
- `js/report.js`: `exportXlsx()` tạo 3 sheet riêng (Vùng A / B / C). `exportPdf()` PDF A4 landscape với bảng + capture SVG chart → image.

**Format**:
- Excel: header bold, freeze row 1, autofilter, định dạng số.
- PDF: logo "SAPULICO" góc trên, ngày export, page number, font Roboto (Google Fonts subset embed).

---

### 22.7 — Reverse geocoding (hẻm/tuyến từ GPS)

**Mục đích**: khi có GPS, tự động đề xuất `Tuyến đường` và `Hẻm`. KTV vẫn được nhập tay/sửa.

**API**: **Nominatim** (OpenStreetMap free, 1 req/s, no key):
```
https://nominatim.openstreetmap.org/reverse?lat=10.7&lon=106.7&format=json&zoom=18&accept-language=vi
```
Response có `address.road` (tuyến), `address.suburb` (khu), `address.neighbourhood` (hẻm/khu phố).

**File sửa**:
- `js/gps.js`: thêm `reverseGeocode(lat, lng)` → trả `{road, suburb, neighbourhood, raw}`. Cache 60s mỗi tọa độ để giảm request.
- `js/form-renderer.js`:
  - Sau khi `refreshGps()` thành công, tự gọi `reverseGeocode`.
  - Nếu field `Tuyến đường` còn rỗng → suggest dạng "Trần Phú (tự điền từ GPS)" với nút "✕ Xoá" để KTV không muốn.
  - Tương tự field `Hẻm` (nếu schema có).
- Respect KTV input: chỉ suggest, không overwrite nếu đã có giá trị.

**Lưu ý**: Nominatim usage policy yêu cầu User-Agent header và max 1 req/s. Frontend tự throttle.

---

### 22.8 — Bản đồ vị trí GPS (`map.html`)

**Mục đích**: admin xem trực quan vị trí các bản KS trên bản đồ TP.HCM.

**Thư viện CDN**:
- Leaflet: `https://unpkg.com/leaflet@1.9.4/dist/leaflet.css` + `leaflet.js`
- Leaflet.markercluster: `https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js`

**File mới**:
- `map.html` — trang full-screen với filter bar trên + bản đồ chiếm 90% màn hình.
- `js/map.js` — init Leaflet (tile OpenStreetMap.HOT), load data qua `apiList`, render markers với cluster, color theo loại KS.

**Permission**: thêm `map` vào `phan quyen`. Default: admin/user TRUE, user1 TRUE (chỉ marker của mình), demo FALSE.

**UI**:
- Filter: loại / KTV (nếu admin) / từ-đến ngày / trạng thái.
- Center mặc định: trung tâm TP.HCM (10.7769, 106.7009).
- Marker icon: emoji + màu theo loại KS.
- Click marker: popup ngắn (Loại + STT + KTV + tuyến) + nút "Mở chi tiết" → modal full.
- Cluster: zoom out tự gộp.
- Toggle layer: "Của tôi" / "Tất cả" (admin).

---

### 22.9 — Notification email khi submission mới

**Mục đích**: admin/user nhận email mỗi khi có KTV submit, để theo dõi tiến độ.

**Phương án**: Apps Script `GmailApp.sendEmail` (free 100 mail/ngày tài khoản consumer, 1500/ngày Workspace).

**File sửa**:
- `apps-script/Code.gs` `handleSubmit`: sau khi appendRow thành công, gọi `notifyAdmins(type, data, stt, user)` async (không block response).
- Sheet mới `notification_targets`: 2 cột `email` + `enabled`. Admin tự thêm/sửa danh sách.
- Hàm `notifyAdmins`:
  - Đọc sheet `notification_targets` (cache 60s).
  - Gửi email từ chính account chạy script.
  - Subject: `[SAPULICO KS] {Tên loại} STT #{N} — {Tuyến đường}`.
  - Body HTML: bảng các field quan trọng + link Google Sheets row + (nếu có) thumbnail ảnh.
- Error handling: nếu gửi fail (quá quota), log Audit nhưng không reject submit.

**Alternative**: Webhook Telegram (URL bot) thay email — set `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID` trong Script Properties. Frontend không cần biết.

---

### 22.10 — Quản lý user CRUD (`users.html`)

**Mục đích**: admin tạo/sửa/khoá user qua UI thay vì chỉnh sheet.

**Permission mới**: `users_manage` — CHỈ admin (không phải user, vì security).

**File mới**:
- `users.html` — bảng user + nút Thêm/Sửa/Reset PWD/Vô hiệu.
- `js/users.js` — logic CRUD.

**Endpoint Code.gs**:
- `action: "users"` (đã có ở 22.2) — list.
- `action: "user_create"` body `{token, username, password, full_name, role, active}`. Validate: username unique, role hợp lệ, password ≥8 ký tự.
- `action: "user_update"` body `{token, username, full_name?, role?, active?}` (KHÔNG cho đổi username; muốn đổi → tạo user mới + vô hiệu cũ).
- `action: "reset_password"` (đã có ở 22.4).
- KHÔNG có `user_delete` cứng — chỉ soft (active=FALSE) để giữ lịch sử KPI.

**UI**:
- Bảng: username | full_name | role | active | created_at | actions.
- Nút "+ Thêm user" → dialog form.
- Nút "✏️ Sửa" / "🔑 Reset PWD" / "🚫 Vô hiệu" / "✅ Kích hoạt" cạnh mỗi row.
- Validate front-end + back-end.

**Audit**: ghi log create/update/reset/disable kèm username thực hiện.

---

### 22.11 — Tài liệu tham khảo (`docs.html`)

**Mục đích**: chỗ tập trung văn bản pháp luật + tiêu chuẩn kỹ thuật + link Đảng/Nhà nước/Chính phủ — KTV tra cứu khi cần.

**Sheet mới `tailieu`** trong file Google Sheets:
| Cột | Kiểu |
|---|---|
| `id` | text (auto UUID) |
| `title` | text |
| `category` | text (chọn từ: "Văn bản pháp luật", "Tiêu chuẩn kỹ thuật", "Đảng - Nhà nước - Chính phủ", "Hướng dẫn nội bộ", "Khác") |
| `url` | text (URL) |
| `description` | text |
| `added_by` | text (username) |
| `added_at` | datetime |

**Endpoint Code.gs**:
- `action: "docs_list"` → đọc sheet, return list.
- `action: "docs_create"` (admin/user): tạo row mới.
- `action: "docs_delete"` (admin/user): xoá row theo id.

**File mới**:
- `docs.html` — grid cards theo category, search box, nút "+ Thêm tài liệu" (admin/user).
- `js/docs.js` — render + CRUD.

**Link mặc định seed** (chạy 1 lần khi tạo sheet):
- Cổng Chính phủ: https://chinhphu.vn
- Đảng Cộng sản VN: https://dangcongsan.vn
- Bộ Công Thương: https://moit.gov.vn
- UBND TPHCM: https://hochiminhcity.gov.vn
- Sở Xây dựng TPHCM: https://soxaydung.hochiminhcity.gov.vn
- Tiêu chuẩn chiếu sáng QCVN 07: (link cụ thể nếu có)

**Permission**: xem = mọi role. Thêm/xoá = admin/user.

---

### 22.12 — QR code TĐK scan

**Mục đích**: in QR dán lên tủ điều khiển ngoài hiện trường. KTV scan → auto-fill field `Tủ điều khiển`.

**Thư viện CDN**: `jsQR` — `https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js`

**File sửa**:
- `js/form-renderer.js`: render type `tdk` thêm nút "📷 Scan QR" → mở dialog camera.getUserMedia → loop scan canvas → detect → fill text → đóng dialog.

**File mới**:
- `tools/qr-generator.html` (admin) — sinh QR cho 903 TĐK in ra (mỗi QR là 1 PNG, content = tên TĐK).
- Dùng thư viện `qrcode-generator` CDN.

**Permission**: scan = mọi role. Sinh QR (tools) = admin/user.

---

### 22.13 — Voice note cho field Ghi chú

**Mục đích**: KTV ghi chú giọng nói thay vì gõ, tay rảnh chụp ảnh.

**API**: Web Speech API (built-in browser, free).

**File sửa**:
- `js/form-renderer.js`: trên textarea field `ghi_chu` thêm nút 🎤. Click → `new SpeechRecognition({lang:'vi-VN'})` → bắt đầu nghe → onresult → append text vào ô.
- Fallback: nếu trình duyệt không support (chủ yếu Safari iOS cũ), ẩn nút.

**UX**:
- Trạng thái: 🎤 idle → 🔴 recording → ⏹️ stop button.
- Hiện interim transcript khi đang nói (italic gray) → confirm khi nói xong.

---

### 22.14 — Heatmap khảo sát

**Mục đích**: admin thấy ngay khu vực nào nhiều/ít KS để phân công.

**2 dạng heatmap**:
- **Table heatmap**: trong `report.html` thêm vùng D — bảng 2D phường × loại, cell tô màu theo count (Tailwind gradient bg-red-100 → bg-red-700).
- **Map heatmap** (nếu đã làm 22.8 Bản đồ): plugin `Leaflet.heat` — điểm GPS dày = vùng nóng (đỏ), thưa = vùng nguội (xanh).

**File sửa**:
- `js/report.js`: render vùng D từ data `areaC` (đã có pivot username × type; cần aggregate thêm theo phường).
- `apps-script/Code.gs` `handleReport`: thêm vùng D output — aggregate theo `Phường`.

**Click cell heatmap** → drill-down list bản ghi.

---

### 22.15 — Backup tự động Sheets → Drive

**Mục đích**: phòng mất dữ liệu (admin lỡ tay xoá sheet, sheet bị hack...).

**Phương án**: Apps Script Time-driven trigger.

**File sửa apps-script/Code.gs**:
- Hàm `setupBackupTrigger()` (admin chạy 1 lần): tạo time trigger chạy mỗi tuần (vd thứ Hai 00:00).
- Hàm `weeklyBackup()` (handler): copy spreadsheet → folder Drive `khaosat-backup` (tạo nếu chưa có) → đặt tên `khaosat-YYYY-MM-DD.xlsx`. Giữ tối đa 12 bản gần nhất (xoá cái cũ hơn).
- Log Audit: action=backup, note=file_id_mới.

**Permission**: không cần — trigger chạy server-side.

**Restore**: thủ công — admin mở Drive folder, copy bản backup về Google Sheets.

---

### 22.16 — Lịch công tác KTV (`schedule.html`)

**Mục đích**: admin phân công KTV → loại KS → khu vực → ngày. KTV xem việc của mình hôm nay/tuần.

**Sheet mới `lichcongtac`**:
| Cột | Kiểu |
|---|---|
| `id` | text (UUID) |
| `ktv_username` | text |
| `ngay` | date (YYYY-MM-DD) |
| `loai_ks` | text (key trong SHEET_MAP) |
| `khu_vuc` | text (vd "Quận 5, Phường An Đông") |
| `ghi_chu` | textarea |
| `status` | text (`pending` / `done` / `skipped`) |
| `created_by` | text |
| `created_at` | datetime |

**Endpoint Code.gs**:
- `action: "schedule_list"` body `{token, from?, to?, ktv_username?}`. Permission: admin/user xem all, user1 xem của mình.
- `action: "schedule_create"` body `{token, items: [...]}`. Permission `schedule_write` (admin/user).
- `action: "schedule_update"` body `{token, id, fields}` — đổi status, ngày, ghi chú.
- `action: "schedule_delete"` body `{token, id}`.

**File mới**:
- `schedule.html` — admin: form thêm + bảng lịch theo tuần/tháng (grid). user1: list of "Hôm nay" + "Tuần này".
- `js/schedule.js`.

**Tích hợp form-renderer**:
- Khi KTV mở `form.html?type=X`, check sheet `lichcongtac` xem có item nào `pending` của KTV này hôm nay không. Hiện badge "📋 Bạn có 5 việc hôm nay, đã xong 2" trên top.
- Sau khi submit form thành công, auto-update item `pending` gần nhất khớp `loai_ks` thành `done` (smart-match).

**Permission**: thêm `schedule_write` (admin/user) và `schedule_view` (mọi role, server tự filter).

---

### Tóm tắt bổ sung file/sheet/endpoint sau khi làm hết v1.1+

**Sheet mới**: `notification_targets`, `tailieu`, `lichcongtac`.

**File frontend mới**: `my-kpi.html` + `js/my-kpi.js`, `map.html` + `js/map.js`, `users.html` + `js/users.js`, `docs.html` + `js/docs.js`, `schedule.html` + `js/schedule.js`, `tools/qr-generator.html`.

**Action Apps Script mới**: `users`, `user_create`, `user_update`, `reset_password`, `update` (edit bản ghi), `docs_list`, `docs_create`, `docs_delete`, `schedule_list`, `schedule_create`, `schedule_update`, `schedule_delete`.

**Thư viện CDN thêm**: SheetJS, jsPDF + autotable, Leaflet + markercluster + heat, jsQR, qrcode-generator.

**Permission cột mới trong `phan quyen`**: `edit`, `users_manage`, `schedule_write`, `notify_admin`, `map`.

---

**Kết thúc CLAUDE.md.** Mọi quyết định cấu hình đã chốt. **KHÔNG tự động bắt đầu code**. Đợi user yêu cầu rõ ràng (vd "bắt đầu code v1.1", "code 22.X"), rồi thực hiện theo checklist mục 18.
