# CLAUDE.md — Dự án Website Khảo sát Hiện trường Chiếu sáng Đô thị

> Tài liệu này là **nguồn chân lý duy nhất** cho Claude Code (hoặc AI khác) khi thực hiện dự án. Đọc kỹ toàn bộ file trước khi bắt đầu code.

---

## 1. Tổng quan dự án

### Mục tiêu
Xây website cho phép **kỹ thuật viên (KTV) khảo sát hiện trường** hệ thống chiếu sáng công cộng tại TP.HCM, nhập dữ liệu qua điện thoại (có chụp ảnh, lấy GPS), dữ liệu tự động đẩy vào Google Sheets. Thay thế cách làm hiện tại (KTV ghi giấy → nhập Excel văn phòng).

### Người dùng
- **KTV hiện trường**: dùng điện thoại Android/iOS, thao tác trên trình duyệt (Chrome/Safari). Không cần đăng nhập.
- **Quản lý văn phòng**: xem dữ liệu trực tiếp trên Google Sheets.

### Phạm vi
- **15 loại khảo sát** (mỗi loại là 1 form độc lập, ghi vào 1 sheet riêng trong Google Sheets).
- Mỗi bản ghi có thể đính kèm **nhiều ảnh hiện trường**.
- Có **lấy GPS tự động** (cho các form khảo sát tuyến).
- **Không đăng nhập** — KTV tự nhập tên mình ở trường "Người khảo sát".

### Các nguyên tắc quan trọng (đọc kỹ)
1. **Header Google Sheets phải giữ NGUYÊN VĂN tiếng Việt** giống file Excel gốc (kể cả dấu chấm, dấu phẩy, viết hoa/thường lẻ tẻ). Đây là dữ liệu sản xuất, đổi sẽ vỡ workflow downstream của LAVIPCO.
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
├── index.html                 ← trang chủ: chọn 1 trong 15 loại khảo sát
├── form.html                  ← trang form chung, render động theo ?type=...
├── recent.html                ← trang xem các bản ghi gần đây trong ngày
├── manifest.json              ← PWA manifest
├── sw.js                      ← Service Worker (cache shell + offline)
├── assets/
│   ├── icon-192.png           ← icon PWA (tạo placeholder)
│   └── icon-512.png
├── js/
│   ├── config.js              ← các URL/key cấu hình (KHÔNG commit secret thật, dùng placeholder)
│   ├── schemas.js             ← 15 schema form (đối tượng JS, export default)
│   ├── lookups.js             ← dữ liệu Phường/Xã (102 mục) và TĐK (903 mục) cho dropdown/autocomplete
│   ├── form-renderer.js       ← engine render form từ schema
│   ├── api.js                 ← gọi Apps Script + upload Cloudinary
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

## 4. Danh sách 15 loại khảo sát (CHỐT)

15 sheet này lấy từ file `khao_sat_tang_cuong_den.xlsx` mà user đã cung cấp. **Tên sheet trong Google Sheets phải đặt CHÍNH XÁC như cột "Sheet name"** — không sửa, không bỏ khoảng trắng, không thay dấu.

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

**Cột bổ sung cho TẤT CẢ 15 sheet** (thêm vào cuối, sau cột cuối cùng của header gốc):
- `Ảnh (URLs)` — chuỗi các URL Cloudinary, phân tách bằng `|`
- `Submitted At` — timestamp ISO khi Apps Script nhận request (server-side, không phải client time)
- `User Agent` — để debug khi cần

---

## 5. Schema chi tiết từng form (NGUỒN CHÂN LÝ)

> Đây là schema bạn phải dùng để dựng `js/schemas.js`. KHÔNG được tự nghĩ ra trường mới hoặc bỏ trường. Nếu thấy có trường nào nghi vấn (vd `STT` — có nên cho KTV nhập không?), HỎI user trước.

### Quy ước chung
- `STT` (số thứ tự): **KTV không nhập**. Apps Script tự đánh = số dòng hiện tại (max row + 1 trừ header). Không gửi từ frontend.
- `ngày khảo sát` / `Ngày khảo sát`: **KTV không nhập tay**. Apps Script tự ghi `new Date()` khi nhận request, theo timezone `Asia/Ho_Chi_Minh`, format `yyyy-MM-dd HH:mm:ss`.
- `kinh độ`, `vĩ độ`: lấy tự động bằng `navigator.geolocation`, KTV có nút "Lấy lại GPS" nếu cần.
- `link` / `Link Google Map`: tự sinh `https://www.google.com/maps?q=<lat>,<lng>` nếu có GPS, để trống nếu không.
- `Bản vẽ`: để trống, KTV không nhập (do file gốc thường để trống — confirm với user nếu cần).
- `Ghi chú`: luôn là `textarea`, không bắt buộc.
- `Người khảo sát`: text input, **bắt buộc**, có gợi ý lưu vào localStorage (lần sau KTV mở form sẽ thấy tên cũ pre-fill).
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
- `skip` — không hiển thị, không gửi (vd: `Bản vẽ` để trống)

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
| 17 | Bản vẽ | ban_ve | skip | — | để trống |
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
| 22 | Bản vẽ | ban_ve | skip | — |
| 23 | Ghi chú | ghi_chu | textarea | No |

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
| 14 | Bản vẽ | ban_ve | skip | — |
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
- 1 hàm `doPost(e)` nhận JSON body `{ type: "tang_cuong_den", data: {...} }`.
- Mở Google Sheets theo ID (set qua Script Properties, không hardcode).
- Tìm sheet theo bảng mapping `type → sheet name` (ở mục 4).
- Đọc header row của sheet đó → tạo row mới với giá trị theo đúng thứ tự cột.
- Server-side gán: `STT` (= maxRow của sheet trừ header rows + 1), `ngày khảo sát` (= `Utilities.formatDate(new Date(), "Asia/Ho_Chi_Minh", "yyyy-MM-dd HH:mm:ss")`).
- Append row.
- Trả về JSON `{ ok: true, stt: <số>, sheet: <tên> }` với `ContentService.createTextOutput().setMimeType(JSON)`.
- Bắt lỗi → `{ ok: false, error: <msg> }` và `Logger.log`.
- **CORS**: Apps Script khi deploy as Web App `Anyone` đã tự cho phép. Frontend gọi bằng `fetch(URL, { method: 'POST', mode: 'no-cors' ... })` ban đầu sẽ KHÔNG đọc được response → giải pháp: dùng `Content-Type: text/plain` để tránh preflight CORS, vẫn POST được. Hoặc dùng `application/x-www-form-urlencoded`. **Test kỹ trên mobile Safari trước khi nói đã xong.**

### Lưu ý sheet `5. TCNoi`
- File gốc có header ở **row 2** (row 1 trống/có giá trị lạ "3125").
- Khi tạo Google Sheets mới, **đặt header ở row 1** (clean lại), để code Apps Script đơn giản (luôn đọc row 1 làm header cho mọi sheet).
- Tài liệu setup phải nhắc user clean.

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
- Logo LAVIPCO (placeholder text "LAVIPCO" nếu chưa có logo)
- Link "Xem khảo sát hôm nay" → `recent.html`
- Indicator online/offline + số bản chờ sync

---

## 11. Trang `recent.html` (xem nhanh)

- Hiển thị tất cả bản ghi KTV này đã submit hôm nay (đọc từ localStorage `submitted_today`).
- Mỗi mục: loại KS, tuyến đường, thời gian, STT (server trả về), icon ảnh (nếu có).
- Click vào 1 mục → xem chi tiết các trường đã nhập (read-only).
- Mục đích: KTV tự kiểm tra xem mình đã làm gì trong ngày, KHÔNG phải để sửa (sửa thì lên Google Sheets).

---

## 12. PWA

`manifest.json`:
```json
{
  "name": "Khảo sát chiếu sáng LAVIPCO",
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

## 13. File `js/config.js`

```javascript
// js/config.js — Sửa các giá trị này sau khi setup xong Apps Script & Cloudinary
export const CONFIG = {
  // URL Apps Script Web App (sau khi deploy)
  appsScriptUrl: 'https://script.google.com/macros/s/XXXXXXXXXX/exec',
  
  // Cloudinary
  cloudinaryName: 'your-cloud-name',
  cloudinaryPreset: 'khaosat_unsigned',
  
  // Tùy chọn
  imageMaxDim: 1600,
  imageQuality: 0.8,
  autosaveInterval: 5000,
};
```

**KHÔNG commit URL/key thật lên repo public**. Tài liệu phải nhắc user fork private repo, hoặc dùng GitHub Actions secrets nếu muốn public.

---

## 14. Thứ tự thực hiện (CHECKLIST cho Claude Code)

Khi nhận lệnh "bắt đầu code dự án này", thực hiện theo đúng thứ tự:

- [ ] **B1.** Tạo `README.md` (giới thiệu ngắn, hướng dẫn KTV mở app trên điện thoại).
- [ ] **B2.** Tạo `SETUP.md` chi tiết từng bước: tạo Google Sheets, paste 15 header, deploy Apps Script, tạo Cloudinary preset, sửa `config.js`, push GitHub Pages.
- [ ] **B3.** Tạo `apps-script/Code.gs` đầy đủ với mapping ở mục 7. Comment tiếng Việt.
- [ ] **B4.** Đọc file Excel gốc (`khao_sat_tang_cuong_den.xlsx`) → sinh `js/lookups.js` đầy đủ 102 phường + 903 TĐK. **Nếu không có file Excel trong repo, HỎI user upload trước.**
- [ ] **B5.** Tạo `js/schemas.js` với đầy đủ 15 schema theo đúng mục 5.
- [ ] **B6.** Tạo `js/utils.js`, `js/gps.js`, `js/camera.js`, `js/storage.js`, `js/api.js` (helper modules).
- [ ] **B7.** Tạo `js/form-renderer.js` — engine chính render form từ schema, validate, submit.
- [ ] **B8.** Tạo `form.html` — load `?type=` từ URL, gọi renderer.
- [ ] **B9.** Tạo `index.html` — trang chủ 15 ô.
- [ ] **B10.** Tạo `recent.html`.
- [ ] **B11.** Tạo `manifest.json`, `sw.js`, icon placeholder.
- [ ] **B12.** **Test thủ công** trên Chrome desktop + 1 lần Chrome mobile (devtools mobile mode):
  - Mở từng form trong 15 loại — đảm bảo render đúng, không lỗi console.
  - Submit 1 form `tang_cuong_den` thật (dùng Apps Script URL test) → kiểm tra row xuất hiện đúng cột trong Sheet.
  - Test offline: tắt mạng → submit → bật mạng → bản đang chờ phải tự sync.
- [ ] **B13.** Viết section "Known Issues" vào `README.md` nếu phát hiện gì.

---

## 15. Checklist chất lượng (Claude tự review trước khi báo "xong")

- [ ] Không có hardcode URL Apps Script / Cloudinary trong file ngoài `config.js`.
- [ ] Tất cả 15 form render được không lỗi console.
- [ ] Header trong Google Sheets test giống NGUYÊN VĂN trong mục 4-5.
- [ ] STT và Ngày khảo sát do server gán, không gửi từ client.
- [ ] GPS bật trên HTTPS, có fallback khi user từ chối permission.
- [ ] Ảnh được nén trước upload (verify bằng cách check size response).
- [ ] localStorage có dọn dẹp (sau khi submit thành công, xóa draft).
- [ ] Đã test trên màn hình 360px width (Chrome devtools).
- [ ] Đã test offline → online sync queue.
- [ ] `SETUP.md` đầy đủ, một người không phải dev cũng theo được.

---

## 16. Quy tắc giao tiếp với user (Lam Mai - LAVIPCO)

- User là kỹ sư, làm việc bằng tiếng Việt, ưu tiên giao tiếp tiếng Việt.
- User KHÔNG phải lập trình viên web. Khi giải thích kỹ thuật, dùng từ ngữ thực tế.
- **Khi gặp ambiguity, HỎI thay vì tự quyết** (đặc biệt với: header tiếng Việt có khoảng trắng cuối, có nên thêm trường mới không, đổi tên sheet, đổi UX...).
- Khi báo cáo tiến độ, dùng checklist mục 14 — nói rõ đã làm B mấy, đang ở B mấy.
- **Không** xài emoji nhiều, không tagline marketing. Tone kỹ thuật, ngắn gọn.

---

## 17. Câu hỏi cần xác nhận với user trước khi bắt đầu

Trước khi viết code, hỏi user các điểm sau (nếu chưa rõ):

1. **Tên file Google Sheets** muốn đặt là gì? (vd "Khảo sát LAVIPCO 2026")
2. **Logo LAVIPCO**: có cung cấp file ảnh không, hay dùng text placeholder?
3. **Trường "Bản vẽ"** trong các form khảo sát tuyến — có muốn KTV nhập không, hay luôn để trống như hiện tại?
4. **Năm hiện hành cho `Năm lắp đặt`**: cho phép nhập tự do hay giới hạn 1990–2026?
5. **Repo GitHub** muốn đặt tên gì? Public hay Private?
6. **Domain custom**: chỉ dùng `<user>.github.io/<repo>` hay có domain riêng?

---

**Kết thúc CLAUDE.md.** Khi Claude Code đọc xong file này, nhắn lại user: "Tôi đã đọc CLAUDE.md. Trước khi bắt đầu, tôi cần xác nhận 6 điểm ở mục 17." rồi chờ trả lời, KHÔNG tự code ngay.
