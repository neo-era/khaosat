# SETUP — Triển khai từ A đến Z

Hướng dẫn này dành cho **người setup** (làm 1 lần khi bắt đầu dự án). Không cần biết code. Mỗi bước viết theo từng cú click cụ thể.

> ⚠️ Đọc kỹ phần **Bảo mật** ở cuối trước khi push lên GitHub.

Tổng thời gian ước tính: **30–45 phút** (Cloudinary cần tài khoản mới sẽ tốn thêm 5 phút).

---

## Bước A — File Google Sheets

File **`khao-sat-ke-hoach`** đã có sẵn (anh đã tạo và cung cấp URL). Trong đó **đã có**:
- Sheet `taikhoan` với 10 user (header tiếng Việt cũ: `tenDangNhap, matKhau, hoTen, vaiTro, Ngày cấp` — mật khẩu plaintext).
- Sheet `phan quyen` (chưa có data — sẽ được `initSheets()` đổ default ở Bước C).
- 15 sheet khảo sát: **chưa có** — sẽ được tự sinh ở Bước C.

Lấy **Spreadsheet ID** từ URL hiện có:
```
https://docs.google.com/spreadsheets/d/AAAAAAA_BBBBBBB_CCC/edit
                                       └──── ID ────┘
```
Copy đoạn giữa `/d/` và `/edit` — để sang Bước B.

---

## Bước B — Tạo Apps Script & cấu hình bí mật

1. Trong Google Sheets vừa tạo: menu **Tiện ích mở rộng** → **Apps Script**.
2. Tab mới mở ra với tên "Untitled project" → đổi tên thành **`khaosat`** (góc trên trái).
3. Xoá toàn bộ code mặc định trong `Code.gs`. Mở file `apps-script/Code.gs` trong repo này, **copy toàn bộ nội dung**, paste vào `Code.gs` trên Apps Script.
4. Bấm 💾 **Lưu** (Ctrl+S).
5. Vào **Cài đặt dự án** (icon bánh răng bên trái) → cuộn xuống **Script Properties** → **Thêm thuộc tính tập lệnh**. Tạo 4 key:

   | Key | Value | Ghi chú |
   |---|---|---|
   | `SPREADSHEET_ID` | ID copy ở Bước A | |
   | `AUTH_SALT` | Chuỗi random ≥32 ký tự | Sinh bằng cách: mở Console trình duyệt (F12 → Console) gõ `Array.from({length:48}, () => Math.random().toString(36)[2]).join('')` → copy kết quả |
   | `CLOUDINARY_CLOUD_NAME` | Để trống tạm, điền ở Bước E | |
   | `CLOUDINARY_API_KEY` | Để trống tạm, điền ở Bước E | |
   | `CLOUDINARY_API_SECRET` | Để trống tạm, điền ở Bước E | |

6. Bấm **Lưu thuộc tính kịch bản**.

> 🔒 `AUTH_SALT` và `CLOUDINARY_API_SECRET` **chỉ tồn tại ở đây**, không bao giờ vào git. Nếu rò rỉ, sinh lại salt mới sẽ vô hiệu hoá toàn bộ token đang dùng → user phải đăng nhập lại.

---

## Bước C — Tạo 15 sheet KS + KPI_Targets + phan quyen default bằng `initSheets()`

1. Quay lại tab Apps Script, đảm bảo đang xem `Code.gs`.
2. Trên thanh công cụ, có dropdown chọn hàm. **Đổi sang `initSheets`**.
3. Bấm **▶ Chạy** (Run).
4. Lần đầu chạy, Apps Script sẽ hỏi **cấp quyền**:
   - Bấm "Xem lại quyền".
   - Chọn Google account của bạn.
   - "Google chưa xác minh ứng dụng này" → bấm **Nâng cao** → **Chuyển đến khaosat (không an toàn)**.
   - Bấm **Cho phép**.
5. Đợi ~10–20 giây. Mở **View → Logs** xem kết quả.
6. **Kiểm tra** trong Google Sheets (refresh F5) — phải thấy đủ:
   - 15 sheet khảo sát: `Tang cuong den`, `Ngam Hoa`, `Thay den`, `4, HKN`, `5. TCNoi`, `6, Cap luon can`, `7. TCNgam`, `8. Thay Can`, `9. Thay thế tru`, `10.choa den`, `11. Nap tru`, `12, Vo tu`, `13 Tăng cường đèn kc xa`, `14 Decal số trụ`, `15. Nâng móng` — với header tiếng Việt + 6 cột bonus (Ảnh URLs, Submitted At, User Agent, Username, Deleted At, Deleted By).
   - Sheet `KPI_Targets` mới với 8 row default.
   - Sheet `phan quyen` mới với 4 row default (admin/user/user1/demo) + checkbox cho 5 cột quyền.
   - Sheet `taikhoan` đã có sẵn — **KHÔNG bị động đến** (sẽ migrate ở Bước C2 dưới).

> Có thể chạy `initSheets` lại nhiều lần an toàn — script tự skip sheet đã tồn tại.

## Bước C2 — Migrate sheet `taikhoan` (chạy 1 lần)

Sheet `taikhoan` đang ở format cũ (header tiếng Việt + password plaintext). Cần đổi sang format mới (header English + password hash + thêm cột active).

1. Trong Apps Script Code.gs, dropdown hàm → chọn **`migrateTaikhoan`** → ▶ Run.
2. Mở **View → Logs**, xem kết quả:
   - Phải thấy "Renamed columns: tenDangNhap → username, …".
   - "Added active column: TRUE".
   - "Migrated passwords: admin, demo, user1, ndan, ndthang, mnhuy, lnhien, lvhung, ltqthuc, thluu" (10 user).
3. Mở Google Sheets sheet `taikhoan` — verify:
   - Header: `username, password_hash, full_name, role, active, created_at`.
   - Mật khẩu cột `password_hash` giờ là chuỗi hex 64 ký tự (vd `7d4f8a2b...`).
   - Cột `active` mới, tất cả TRUE.
4. **Mật khẩu plaintext gốc vẫn dùng được**:
   - `admin` login bằng `admin123` (hash đã match).
   - `demo` login bằng `demo123`.
   - `user1`/`ndan`/`ndthang`/`lnhien`/... login bằng `123`.
   - `mnhuy` login bằng `huy123`, `lvhung` login bằng `hung123`, v.v.
5. **Khuyến nghị MẠNH**: ngay sau migration, đổi mật khẩu cho các user dùng `123` (yếu) sang chuỗi mạnh hơn. Cách:
   ```javascript
   // Trong Apps Script, chạy:
   Logger.log(hashPassword('MatKhauMoi@2026'));  // copy hash trả về
   // Paste vào cột password_hash của user X
   ```

> Migration **idempotent**: chạy lại không gây hại (đã migrate thì skip).

---

## Bước D — Thêm user mới (nếu cần)

10 user đã có sẵn sau migration ở Bước C2. Nếu muốn thêm KTV mới:

1. Trong Apps Script, chạy:
   ```javascript
   Logger.log(hashPassword('MatKhauMoi@2026'));
   ```
   Copy hash trong Logs.
2. Mở sheet `taikhoan`, thêm dòng mới:
   - `username` = vd `ndtam`
   - `password_hash` = paste hash
   - `full_name` = `Nguyễn Đại Tâm`
   - `role` = chọn `admin`/`user`/`user1`/`demo` từ dropdown
   - `active` = TRUE (tick checkbox)
   - `created_at` = `=NOW()`

> Vô hiệu hoá user: bỏ tick `active` (= FALSE). Không xoá row để giữ lịch sử KPI.
> Đổi mật khẩu: chạy lại `hashPassword('mật-khẩu-mới')`, paste đè vào cột `password_hash`.

---

## Bước E — Cloudinary

1. Vào https://cloudinary.com → **Sign up free**. Đăng ký với Google hoặc email.
2. Vào **Dashboard** → ghi nhớ 3 giá trị:
   - **Cloud name** (góc trên cùng)
   - **API Key**
   - **API Secret** (bấm "Reveal" để xem)
3. Trong Dashboard, vào **Settings** (icon ⚙) → tab **Upload** → cuộn xuống **Upload presets** → **Add upload preset**.
4. Điền:
   - **Preset name**: `khaosat_unsigned`
   - **Signing Mode**: **Unsigned**
   - **Folder**: `khaosat`
5. Bấm **Save**.

### Cập nhật Apps Script Properties

Quay lại Apps Script → **Cài đặt dự án** → **Script Properties** → điền nốt 3 key trống ở Bước B:
- `CLOUDINARY_CLOUD_NAME` = Cloud Name (đoạn `<name>` trong URL `https://res.cloudinary.com/<name>/...`)
- `CLOUDINARY_API_KEY` = giá trị API Key
- `CLOUDINARY_API_SECRET` = giá trị API Secret

---

## Bước F — Deploy Apps Script Web App

1. Apps Script → góc trên phải bấm **Deploy** → **New deployment**.
2. Icon bánh răng cạnh "Select type" → chọn **Web app**.
3. Điền:
   - **Description**: `khaosat v1`
   - **Execute as**: **Me** (bạn)
   - **Who has access**: **Anyone** ⚠️ phải là Anyone (không có @sapulico) để KTV truy cập được không cần Google login
4. Bấm **Deploy**. Cấp quyền lần nữa nếu hỏi.
5. Copy **Web app URL** (kết thúc bằng `/exec`).
6. So sánh với `appsScriptUrl` trong `js/config.js`:
   - Nếu giống nhau → OK, skip.
   - Nếu khác (do redeploy version mới) → mở `js/config.js`, sửa lại, save.

> Mỗi lần sửa Code.gs xong và muốn áp dụng thay đổi → **Deploy → Manage deployments → Edit (icon bút) → Version: New version → Deploy**. URL không đổi.

---

## Bước G — Cập nhật `js/config.js`

Mở file `js/config.js` trong repo, điền 2 giá trị Cloudinary từ Bước E:

```javascript
cloudinaryName: 'tên-cloud-name-của-bạn',
cloudinaryPreset: 'khaosat_unsigned',
```

URL Apps Script và `sheetsCsvUrl` đã có sẵn — chỉ verify giống với deploy thực tế.

Save file.

---

## Bước H — Publish-to-web Google Sheets (cho report)

1. Trong Google Sheets, menu **Tệp** → **Chia sẻ** → **Xuất bản lên web**.
2. Tab **Liên kết**:
   - Toàn bộ tài liệu / chọn sheet: tuỳ. Mặc định **Toàn bộ tài liệu**.
   - **Định dạng đã xuất bản**: **Giá trị được phân tách bằng dấu phẩy (.csv)**
3. Bấm **Xuất bản** → **OK** xác nhận.
4. Copy URL hiện ra (kết thúc bằng `pub?output=csv` hoặc tương tự).
5. So sánh với `sheetsCsvUrl` trong `js/config.js` — khác thì cập nhật.

> URL này public — ai có URL đều đọc được. Đã ghi trong CLAUDE.md mục 17.

---

## Bước I — Push lên GitHub & bật Pages

1. Trong terminal (PowerShell ở Windows):
   ```powershell
   git add .
   git commit -m "setup: hoan tat cau hinh ban dau"
   git push
   ```
2. Vào https://github.com/<user>/khaosat → tab **Settings** → mục **Pages**:
   - Source: **Deploy from a branch**
   - Branch: **main** / **/(root)**
   - Save
3. Đợi 2–5 phút. Refresh trang Pages, thấy `Your site is live at https://<user>.github.io/khaosat/`.

---

## Bước J — Test toàn luồng

Trên điện thoại:

1. Mở `https://<user>.github.io/khaosat/login.html`.
2. Đăng nhập với `ktv01` + mật khẩu bạn đã đặt ở Bước D.
3. Trang chủ hiện 15 thẻ.
4. Chọn **Tăng cường đèn** → form mở ra. **Người khảo sát** đã auto-fill "Lê Kỹ Thuật Viên" và readonly.
5. Cho phép GPS. Điền các trường `*` đỏ. Chụp 1 ảnh.
6. Bấm **Lưu**. Thấy toast "Đã lưu STT #1".
7. Mở Google Sheets, sheet `Tang cuong den` — phải thấy dòng mới với data đầy đủ + URL ảnh Cloudinary + cột `Username = ktv01`.
8. Đăng xuất, đăng nhập lại bằng `admin01` → tự vào `kpi.html`. Chọn tháng hiện tại → bảng hiện KPI của `ktv01`.
9. Thử `manage.html` → tìm bản ghi vừa submit → xoá thử → quay lại Google Sheets thấy `Deleted At` đã có giá trị, ảnh trên Cloudinary đã biến mất.
10. Khôi phục lại từ `manage.html` → `Deleted At` trở về rỗng. Ảnh KHÔNG quay lại.

✅ Nếu mọi bước OK → **Setup hoàn tất**.

---

## Bảo mật — đọc kỹ trước khi đi live

Repo này **PUBLIC** trên GitHub theo quyết định của SAPULICO (CLAUDE.md mục 21). Có nghĩa:

| File | Public lộ gì | Mức độ |
|---|---|---|
| `js/config.js` | URL Apps Script + Cloudinary name + preset | Ai cũng POST request được, bị chặn bởi token+role+rate limit |
| `js/config.js` | URL Sheets CSV publish | Ai cũng đọc data sheet được publish |

### Lớp bảo vệ
1. **Mọi action ngoài `login`** yêu cầu token hợp lệ. Không token → reject ngay.
2. **Login rate limit**: 5 lần sai/phút → khoá username 5 phút (qua Apps Script CacheService).
3. **`active=FALSE`** trong sheet `taikhoan` → user bị từ chối login.
4. **Permission server-side**: demo không thể submit dù có gọi đúng API.

### Khuyến nghị bắt buộc
- **Mật khẩu KTV ≥10 ký tự, có chữ hoa + số + đặc biệt**. Không dùng tên/sinh nhật.
- **`AUTH_SALT` ≥32 ký tự random**. Không tiết lộ.
- **`CLOUDINARY_API_SECRET`** chỉ trong Script Properties. KHÔNG bao giờ vào git.
- **Theo dõi Apps Script Executions** định kỳ (1 lần/tuần). Nếu thấy nhiều fail login bất thường → rotate URL (Manage Deployments → New version → URL cũ vẫn dùng được nhưng đổi version sau khi cập nhật config.js).
- **Tránh share URL** Apps Script lên public (social, blog, support ticket public).

### Nếu nghi rò rỉ
1. Vào Apps Script → Project Settings → đổi `AUTH_SALT` sang chuỗi mới → mọi token đang dùng tự vô hiệu, user phải đăng nhập lại.
2. Nếu nghi `CLOUDINARY_API_SECRET` rò rỉ: vào Cloudinary Dashboard → API Keys → Regenerate → cập nhật lại Apps Script Properties.

---

## Phụ lục — Câu hỏi thường gặp

**Q: Chạy `initSheets` lại có mất data không?**
A: Không. Script chỉ tạo sheet còn thiếu, skip sheet đã có.

**Q: Muốn thêm 1 KTV mới?**
A: Mở Apps Script → chạy `hashPassword('mật-khẩu-mới')` → copy hash → thêm dòng mới trong sheet `taikhoan` với role `user1`, active TRUE.

**Q: Quên hash, muốn reset mật khẩu user X?**
A: Chạy `hashPassword('mật-khẩu-mới')` → paste đè vào cột `password_hash` của user X. Token cũ vẫn còn hạn 8h, sau đó user phải đăng nhập lại với mật khẩu mới.

**Q: Bản ghi xoá nhầm — khôi phục được không?**
A: Vào `manage.html` → filter "Trạng thái: Đã xoá" → tìm bản ghi → bấm **Khôi phục**. Dữ liệu chữ phục hồi, **ảnh đính kèm thì không** (đã xoá vĩnh viễn Cloudinary lúc soft-delete).

**Q: Apps Script báo "Exceeded maximum execution time"?**
A: Endpoint `kpi` hoặc `report` chạy quá 6 phút (quota free). Khi data > 50k row, cần tối ưu thêm sheet cache. Tạm thời: chia nhỏ filter (chỉ 1 tháng/lần, ít KTV).
