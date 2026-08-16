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
   | `AUTH_SALT` | Chuỗi random ≥32 ký tự | Ký token đăng nhập. Sinh bằng: mở Console trình duyệt (F12 → Console) gõ `Array.from({length:48}, () => Math.random().toString(36)[2]).join('')` |
   | `PWD_PEPPER` | Chuỗi random ≥32 ký tự **khác** | Băm mật khẩu. Tách riêng khỏi `AUTH_SALT` để đổi được mà không đá văng mọi phiên đăng nhập. Không đặt thì hệ thống tự dùng `AUTH_SALT`. |
   | `DRIVE_FOLDER_ID` | ID thư mục Drive chứa ảnh | Lấy từ URL thư mục: `/drive/folders/`**`<ID>`** |
   | `CLOUDINARY_CLOUD_NAME` | Để trống tạm, điền ở Bước E | |
   | `CLOUDINARY_API_KEY` | Để trống tạm, điền ở Bước E | |
   | `CLOUDINARY_API_SECRET` | Để trống tạm, điền ở Bước E | |

6. Bấm **Lưu thuộc tính kịch bản**.

> 🔒 `AUTH_SALT`, `PWD_PEPPER`, `CLOUDINARY_API_SECRET` **chỉ tồn tại ở đây**, không bao giờ vào git.
> - Đổi `AUTH_SALT` → mọi token đang dùng bị vô hiệu, ai cũng phải đăng nhập lại.
> - Đổi `PWD_PEPPER` → **mọi mật khẩu ngừng hoạt động**, phải chạy `resetAllPasswords()` đặt lại toàn bộ.

> 📌 **Mật khẩu người dùng cũng nằm trong Script Properties**, dưới các khoá `CRED_<username>` — do hệ thống tự ghi, đừng sửa tay. Xem Bước C2.

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

## Bước C2 — Đặt mật khẩu cho toàn bộ user (chạy 1 lần)

> **Mật khẩu KHÔNG lưu trong Google Sheets.** Từ 2026-08-16, mật khẩu nằm trong
> Script Properties dưới khoá `CRED_<username>`, dạng salt riêng từng người + băm lặp nhiều vòng.
> Sheet `taikhoan` chỉ còn danh bạ: `username, full_name, role, active, created_at`.
>
> Lý do đổi: trước đây cột `password_hash` nằm ngay trong sheet, ai mở được file là
> thấy toàn bộ hash — mà sheet lại từng bị publish ra web.

### C2.1 — (Tuỳ chọn) Đo tốc độ băm

Mặc định `PWD_ITERS = 100` — chọn mức này để **đăng nhập nhanh nhất**.

Muốn xem nó tốn bao lâu: Apps Script → chọn hàm **`benchmarkHash`** → ▶ Run → xem Execution log.

> Chi phí băm **chỉ trả 1 lần lúc đăng nhập** (mỗi người 1–2 lần/ngày). Submit form, xem KPI, tải báo cáo đều đi qua token, **không băm lần nào** — nên tăng số vòng cũng không làm app chậm đi trong lúc dùng.

Nếu muốn chắc hơn: nâng `PWD_ITERS` lên 500–1000 ở đầu section CREDENTIAL STORE trong `Code.gs`. Bản ghi cũ vẫn đăng nhập bình thường vì mỗi bản ghi tự nhớ số vòng của nó.

### C2.2 — Đặt mật khẩu tạm cho tất cả

1. Apps Script → chọn hàm **`resetAllPasswords`** → ▶ Run.
2. Hàm này sẽ:
   - Sinh mật khẩu tạm 12 ký tự cho **từng** user trong sheet `taikhoan`.
   - Ghi vào Script Properties, kèm cờ bắt đổi ở lần đăng nhập đầu.
   - **Xoá hẳn cột `password_hash`** khỏi sheet.
3. Mở **Execution log** → copy bảng `username / mật khẩu tạm` → phát **riêng** cho từng người (nhắn cá nhân, không đăng lên nhóm).
4. Mở sheet `taikhoan` xác nhận cột `password_hash` đã biến mất.

> Mỗi người đăng nhập lần đầu bằng mật khẩu tạm sẽ **bị buộc đổi sang mật khẩu riêng** trước khi vào được app. Admin không biết mật khẩu thật của ai.

### C2.3 — Quên mật khẩu 1 người

- **Cách 1 (khuyến nghị)**: admin vào **users.html** → nút **🔑 PWD** → đặt mật khẩu tạm.
- **Cách 2**: Apps Script → sửa `USERNAME` / `MAT_KHAU` trong hàm `setPasswordThuCong()` → Run.

---

## Bước D — Thêm user mới

Làm trên giao diện, **không** sửa sheet bằng tay:

1. Đăng nhập bằng tài khoản `admin` → menu → **👥 Quản lý user**.
2. Bấm **+ Thêm user** → điền username, mật khẩu tạm (≥8 ký tự), họ tên, vai trò.
3. Đưa mật khẩu tạm cho người đó — họ sẽ bị bắt đổi ngay lần đăng nhập đầu.

> Vô hiệu hoá user: nút **🚫 Vô hiệu** (giữ nguyên dòng để không mất lịch sử KPI).
> Thêm dòng thẳng vào sheet `taikhoan` vẫn được, nhưng user đó **chưa có mật khẩu** — cột Trạng thái trong users.html sẽ hiện ⛔ *chưa có MK*, phải bấm 🔑 PWD đặt cho họ.

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

URL Apps Script đã có sẵn — chỉ verify giống với deploy thực tế.

Save file.

---

## Bước H — ⛔ KHÔNG publish Google Sheets ra web

Bước này trước đây hướng dẫn bật **Tệp → Chia sẻ → Xuất bản lên web** để lấy URL CSV. **Đã bỏ hẳn.**

Ngày 2026-08-16 phát hiện URL đó đang phát tán **chính sheet `taikhoan`** (username + password_hash + họ tên + vai trò) ra internet, ai có URL đều tải về được mà không cần đăng nhập. Trong khi **không dòng code nào trong app đọc URL này** — nó chỉ là một phương án dự phòng chưa bao giờ dùng tới.

**Nếu file của anh đang bật publish, tắt ngay:**

1. Google Sheets → **Tệp** → **Chia sẻ** → **Xuất bản lên web**
2. Bấm **Nội dung đã xuất bản và cài đặt** → **Dừng xuất bản**
3. Kiểm lại: mở URL cũ, phải ra lỗi thay vì bảng dữ liệu

> Cần đọc dữ liệu ở đâu thì gọi Apps Script — có kiểm token và phân quyền. Đừng publish sheet.

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

### ⚠️ Sự cố 2026-08-16 — đã xử lý, ghi lại để không lặp

Ba lỗi cùng lúc khiến hệ thống bị lộ thật:

1. File này (**public trên GitHub**) từng ghi thẳng mật khẩu plaintext của 10 tài khoản.
2. Sheet `taikhoan` bị **publish ra web** → username + password_hash tải về được tự do.
3. Mật khẩu lưu ngay trong sheet dữ liệu, băm 1 vòng SHA-256, salt dùng chung.

Đã khắc phục: mật khẩu chuyển sang Script Properties (salt riêng + băm lặp), đổi toàn bộ mật khẩu, ngưng publish sheet, xoá `sheetsCsvUrl`.

> Git history vẫn còn mật khẩu cũ — **không xoá được**. Đó là lý do bắt buộc đổi hết mật khẩu chứ không chỉ sửa file.

### Lớp bảo vệ
1. **Mọi action ngoài `login`** yêu cầu token hợp lệ. Không token → reject ngay.
2. **Login rate limit**: 5 lần sai/phút → khoá username 5 phút (qua Apps Script CacheService).
3. **`active=FALSE`** trong sheet `taikhoan` → user bị từ chối login.
4. **Permission server-side**: demo không thể submit dù có gọi đúng API.
5. **Mật khẩu không nằm trong Sheets** — mở được file cũng không thấy gì; băm lặp nhiều vòng, salt riêng từng người.
6. **Mật khẩu tạm phải đổi ngay lần đăng nhập đầu** — admin không biết mật khẩu thật của KTV.

### Khuyến nghị bắt buộc
- **Mật khẩu KTV ≥10 ký tự, có chữ hoa + số + đặc biệt**. Không dùng tên/sinh nhật. Mỗi người một mật khẩu riêng — không dùng chung 1 tài khoản cho cả tổ.
- **`AUTH_SALT` và `PWD_PEPPER` ≥32 ký tự random**, khác nhau. Không tiết lộ.
- **`CLOUDINARY_API_SECRET`** chỉ trong Script Properties. KHÔNG bao giờ vào git.
- **KHÔNG bao giờ ghi mật khẩu thật vào README/SETUP/commit message.**
- **KHÔNG publish Google Sheets ra web** (xem Bước H).
- **Theo dõi Apps Script Executions** định kỳ (1 lần/tuần). Thấy nhiều fail login bất thường → xem xét đổi URL deploy.
- **Cân nhắc chuyển repo sang Private** — đây là cách rẻ nhất để URL Apps Script không nằm công khai.

### Nếu nghi rò rỉ
| Rò rỉ cái gì | Làm gì | Hệ quả |
|---|---|---|
| Mật khẩu 1 người | users.html → 🔑 PWD đặt lại | Chỉ người đó phải đổi |
| Nhiều mật khẩu | Chạy `resetAllPasswords()` | Tất cả nhận mật khẩu tạm, phải đổi khi đăng nhập |
| `AUTH_SALT` | Đổi trong Script Properties | Mọi token vô hiệu, ai cũng đăng nhập lại. **Mật khẩu không ảnh hưởng** |
| `PWD_PEPPER` | Đổi trong Script Properties | **Mọi mật khẩu ngừng hoạt động** → phải chạy `resetAllPasswords()` |
| `CLOUDINARY_API_SECRET` | Cloudinary Dashboard → API Keys → Regenerate | Cập nhật lại Script Properties |

---

## Phụ lục — Câu hỏi thường gặp

**Q: Chạy `initSheets` lại có mất data không?**
A: Không. Script chỉ tạo sheet còn thiếu, skip sheet đã có.

**Q: Muốn thêm 1 KTV mới?**
A: Đăng nhập `admin` → menu → **👥 Quản lý user** → **+ Thêm user**. Không sửa sheet bằng tay nữa.

**Q: KTV quên mật khẩu?**
A: **👥 Quản lý user** → nút **🔑 PWD** → đặt mật khẩu tạm → nhắn riêng cho người đó. Họ đăng nhập xong sẽ bị bắt đổi sang mật khẩu riêng ngay.

**Q: Mật khẩu lưu ở đâu? Mở Google Sheets có xem được không?**
A: Không. Sheet `taikhoan` chỉ còn danh bạ (tên, họ tên, vai trò, trạng thái). Mật khẩu nằm trong Script Properties dưới khoá `CRED_<username>`, và **chỉ lưu dạng băm** — kể cả admin cũng không đọc ngược ra mật khẩu thật được.

**Q: Đổi mật khẩu thì token cũ có bị đá ra không?**
A: **Không.** Token đang dùng vẫn sống tới khi hết hạn 8h. Nếu cần đá văng ngay mọi phiên, đổi `AUTH_SALT`.

**Q: Bản ghi xoá nhầm — khôi phục được không?**
A: Vào `manage.html` → filter "Trạng thái: Đã xoá" → tìm bản ghi → bấm **Khôi phục**. Dữ liệu chữ phục hồi, **ảnh đính kèm thì không** (đã xoá vĩnh viễn Cloudinary lúc soft-delete).

**Q: Apps Script báo "Exceeded maximum execution time"?**
A: Endpoint `kpi` hoặc `report` chạy quá 6 phút (quota free). Khi data > 50k row, cần tối ưu thêm sheet cache. Tạm thời: chia nhỏ filter (chỉ 1 tháng/lần, ít KTV).
