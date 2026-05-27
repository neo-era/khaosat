# BỘ PROMPT HOÀN CHỈNH — Dự án `khaosat` SAPULICO

> File này là **kịch bản dẫn dắt Claude Code** thực hiện toàn bộ dự án theo `CLAUDE.md`. Mỗi `### PROMPT N` là 1 message bạn copy nguyên văn dán vào Claude Code, **chạy lần lượt từ 0 → 14**. Sau mỗi prompt **đợi Claude báo cáo xong + xác nhận** rồi mới sang prompt tiếp theo. Không nhảy bước.

> Bộ prompt này đã được đồng bộ với `CLAUDE.md` ngày 2026-05-26 — phiên bản có đăng nhập 4 role (`admin`/`user`/`user1`/`demo`), 3 trang admin (KPI / Quản lý / Báo cáo), soft-delete + audit log, 7 endpoint Apps Script.

---

## Chuẩn bị TRƯỚC KHI bắt đầu

1. Đã có sẵn repo GitHub Public tên `khaosat` (theo quyết định mục 21 CLAUDE.md).
2. Clone repo về máy. Trong repo phải có:
   - `CLAUDE.md` (đã hoàn thiện)
   - `PROMPTS.md` (file này)
   - `khao sat tang cuong den.xlsx` (file Excel gốc, không đổi tên)
3. **Trên Google Sheets**: đã tạo file trống tên `khao-sat-ke-hoach`. 15 sheet khảo sát + sheet `taikhoan` + `KPI_Targets` **sẽ được Apps Script tự tạo** bằng hàm `initSheets()` ở Bước C của SETUP — không cần làm thủ công. URL Apps Script đã deploy: `…AKfycbxX9mgYO6g…/exec` (xem `CLAUDE.md` mục 17).
4. Mở Claude Code trong thư mục repo. Gõ Prompt 0 dưới đây làm message đầu tiên.

⚠️ **Repo Public** → mọi file commit đều public. Tuyệt đối **không commit** `AUTH_SALT`, `CLOUDINARY_API_SECRET` (giữ trong Apps Script Properties).

---

## PROMPT 0 — Khởi tạo & xác nhận

```
Đây là dự án `khaosat` cho SAPULICO. Toàn bộ thiết kế đã chốt trong CLAUDE.md ở root repo.

YÊU CẦU:
1. Đọc toàn bộ CLAUDE.md, đặc biệt chú ý:
   - Mục 1 — 4 role và bảng phân quyền
   - Mục 4 — 15 sheet + 2 sheet phụ + 5 cột bonus
   - Mục 5 — schema 15 form (Bản vẽ là text, không skip)
   - Mục 7 — 7 endpoint Apps Script + PERMISSIONS map
   - Mục 18 — checklist B1–B17 (đây là roadmap)
   - Mục 21 — các quyết định đã chốt
2. KHÔNG code, KHÔNG tạo file, KHÔNG sửa file nào.
3. Trả lời:
   (a) Tóm tắt kiến trúc tổng thể 3–5 dòng.
   (b) Liệt kê 4 role + quyền tương ứng theo bảng mục 1.
   (c) Liệt kê 7 endpoint Apps Script + endpoint nào cho role nào.
   (d) Nếu phát hiện điểm nào trong CLAUDE.md không rõ hoặc mâu thuẫn, nêu ra ngay. Nếu không có, nói "không có vướng mắc".
4. Sau khi tôi gõ "ok B1" mới được bắt đầu code Bước 1.
```

> Đợi Claude trả lời, kiểm tra xem đã hiểu đúng chưa (đặc biệt là 4 role và 7 endpoint). Nếu Claude hiểu sai bất kỳ chi tiết nào → dừng lại, chỉ ra chỗ sai, yêu cầu đọc lại CLAUDE.md. Khi đã ổn → gửi PROMPT 1.

---

## PROMPT 1 — B1 + B2: README & SETUP

```
Thực hiện B1 và B2 trong checklist mục 18 của CLAUDE.md.

B1. Tạo README.md ở root:
- Giới thiệu dự án 3-4 dòng (SAPULICO khảo sát chiếu sáng đô thị).
- Cách KTV mở app trên điện thoại + hướng dẫn "Add to Home Screen" (Chrome Android, Safari iOS).
- Cách admin xem KPI / Quản lý / Báo cáo (link đến các trang `kpi.html`, `manage.html`, `report.html`).
- 4 role và quyền (bảng ngắn lấy từ mục 1 CLAUDE.md).
- Section "Known Issues" để trống.
- Mục liên hệ hỗ trợ (tạm để placeholder email admin@sapulico.local).

B2. Tạo SETUP.md ở root — viết cho người không phải dev, từng cú click:
- **Bước A**: Tạo file Google Sheets **trống** tên `khao-sat-ke-hoach`. KHÔNG cần tạo 15 sheet thủ công — sẽ tự sinh ở bước D.
- **Bước B**: Vào Extensions → Apps Script → đặt tên project "khaosat", paste `apps-script/Code.gs`. Vào Project Settings → Script Properties, set 4 key:
  * `SPREADSHEET_ID` = ID lấy từ URL Google Sheets (đoạn giữa `/d/` và `/edit`).
  * `AUTH_SALT` = chuỗi random ≥32 ký tự (gợi ý: chạy `Math.random().toString(36).repeat(3)` trong console rồi copy).
  * `CLOUDINARY_API_KEY` = lấy ở bước E.
  * `CLOUDINARY_API_SECRET` = lấy ở bước E.
- **Bước C**: Trong Apps Script, mở Code.gs, chọn hàm `initSheets` từ dropdown trên cùng, bấm **Run**. Cấp quyền lần đầu (Authorize). Đợi ~10s. Kết quả: tự động tạo đủ 15 sheet khảo sát + sheet `taikhoan` + sheet `KPI_Targets`, header tiếng Việt + conditional format + freeze row 1 + cột bonus đã sẵn. Verify bằng cách mở Google Sheets thấy đủ sheet.
- **Bước D**: Tạo 4 user mẫu trong sheet `taikhoan`. Cách sinh password hash:
  1. Trong Apps Script, mở Code.gs, ở hàm bất kỳ paste tạm: `Logger.log(hashPassword('matkhau-cua-ban'))`, Run, xem hash trong Executions log, copy.
  2. Hoặc dùng cách an toàn hơn: ở Apps Script Editor chọn hàm `hashPassword`, mở "Execution log", chạy với `e.parameter` chứa password — phức tạp, dùng cách 1 là đủ.
  3. 4 user mẫu (đặt mật khẩu mạnh, không dùng các ví dụ dưới):
     - `admin01` | hash của `Adm!n@2026sup3rl0ng` | "Nguyễn Quản Lý" | role=admin | active=TRUE
     - `user01` | hash | "Trần Phó Quản Lý" | role=user | active=TRUE
     - `ktv01` | hash | "Lê Kỹ Thuật Viên" | role=user1 | active=TRUE
     - `demo` | hash | "Tài Khoản Demo" | role=demo | active=TRUE
- **Bước E**: Đăng ký Cloudinary free → Dashboard Settings → Upload presets → "Add upload preset" tên `khaosat_unsigned`, Signing Mode = Unsigned, Folder = `khaosat`. Lưu. Vẫn ở Dashboard, lấy `Cloud Name`, `API Key`, `API Secret` — paste 2 key sau vào Apps Script Properties (bước B).
- **Bước F**: Apps Script → Deploy → New deployment → Type: Web app → Description "khaosat v1" → Execute as: Me → Who has access: **Anyone** → Deploy. Copy URL (kết thúc bằng `/exec`). So sánh với URL trong `js/config.js` — nếu khác (deployed lại) thì cập nhật `config.js`.
- **Bước G**: Cập nhật `js/config.js` điền `cloudinaryName` + `cloudinaryPreset` (URL Apps Script và sheetsCsvUrl đã có sẵn).
- **Bước H**: Trong Google Sheets, Tệp → Chia sẻ → Xuất bản lên web → chọn sheet `Tang cuong den` (hoặc tất cả) → format CSV. Copy URL, so sánh với `sheetsCsvUrl` trong config.js, nếu khác thì cập nhật.
- **Bước I**: git add, commit, push. Vào repo Settings → Pages → Source = branch `main`, folder `/`. Đợi 2 phút, GitHub thông báo URL.
- **Bước J**: Mở `https://<user>.github.io/khaosat/login.html` trên điện thoại. Đăng nhập với 1 user mẫu. Submit thử 1 form, verify thấy dòng mới trong Google Sheets.

⚠️ Lưu ý bảo mật: **KHÔNG** push các giá trị Script Properties (`AUTH_SALT`, `CLOUDINARY_API_SECRET`) lên git. Chúng chỉ sống trong Apps Script Properties, không nằm trong file nào của repo.

Mọi bước viết tiếng Việt, ngắn gọn, click-by-click. Dùng heading rõ ràng.

Sau khi xong, in cây thư mục hiện tại + báo "Đã hoàn tất B1, B2". Chờ tôi nói "ok B3".
```

---

## PROMPT 2 — B3: Apps Script Code.gs

```
Thực hiện B3. Tạo `apps-script/Code.gs` theo mục 7 CLAUDE.md.

YÊU CẦU CỤ THỂ:

1. Đầu file:
   - Const SHEET_MAP (15 entries từ mục 7).
   - Const PERMISSIONS (4 role × 5 action) từ mục 7.
   - Hàm helper `can(role, action)`, `isFullAccess(role)`.
   - Hàm `getSpreadsheet()` đọc SPREADSHEET_ID từ Script Properties.
   - Hàm `getSalt()`, `getCloudinaryCreds()`.

2. Hàm `hashPassword(plain)` — public, để admin chạy thủ công sinh hash khi tạo user. Input plain text → output SHA-256(plain + salt) dạng hex.

3. **Const `HEADERS`** ở đầu file — chứa header nguyên văn của 15 loại KS, key trùng `SHEET_MAP`, mảng label tiếng Việt theo đúng thứ tự mục 5 CLAUDE.md. Tham chiếu giải thích đồng bộ với schemas.js.

4. **Hàm `initSheets()`** — public, gọi thủ công 1 lần khi setup. Yêu cầu chi tiết:
   - Mở spreadsheet hiện tại từ SPREADSHEET_ID.
   - Với mỗi entry SHEET_MAP:
     * Nếu sheet đã tồn tại → SKIP (log "skipped: <name>").
     * Nếu chưa → tạo mới, set header row 1 = `[...HEADERS[key], 'Ảnh (URLs)', 'Submitted At', 'User Agent', 'Username', 'Deleted At', 'Deleted By']`.
     * Freeze row 1.
     * Conditional format: `Deleted At` cell không rỗng → tô background #f0f0f0 + strikethrough toàn row (apply A:Z).
     * Set column width cho STT (40px), Ngày khảo sát (140px), Người khảo sát (120px), Ảnh URLs (200px). Các cột khác auto.
   - Tạo sheet `taikhoan` nếu chưa có:
     * Header: `username, password_hash, full_name, role, active, created_at`.
     * Freeze row 1. Width tự chọn.
     * Data validation cột `role` (cột D): danh sách `admin/user/user1/demo`.
     * Data validation cột `active` (cột E): checkbox.
   - Tạo sheet `KPI_Targets` nếu chưa có:
     * Header: `param, value`.
     * 8 row default:
       - target_submissions_per_month | 50
       - target_distinct_types | 5
       - target_active_days | 20
       - weight_frequency | 0.40
       - weight_quality | 0.30
       - weight_diversity | 0.15
       - weight_completeness | 0.10
       - weight_stability | 0.05
   - Xoá sheet "Sheet1" mặc định nếu vẫn còn và trống.
   - Return JSON `{ok:true, created:[...], skipped:[...], message:"..."}` để admin xem qua Logger.
   - Log từng bước qua `Logger.log(...)`.
   - Try/catch toàn bộ, error → log + return `{ok:false, error}`.

5. **Hàm `validateSheets()`** (tuỳ chọn nhưng nên có) — quét tất cả sheet, so sánh header thực với HEADERS, báo sheet nào lệch.

6. Hàm `doPost(e)`:
   - Parse `e.postData.contents` thành object.
   - Switch theo `action`: login / submit / list / delete / restore / kpi / report.
   - Bao try/catch toàn bộ, error → trả `{ok:false, error, stack}`.
   - Header response: `ContentService.createTextOutput(JSON.stringify(...)).setMimeType(JSON)`.

7. `action: "login"`:
   - Đọc sheet `taikhoan`, tìm username (active=TRUE).
   - Verify hash.
   - Rate limit qua CacheService: key `login_fail_${username}`, max 5 fail/phút, sai quá → khoá 5 phút, trả lỗi rõ.
   - Active=FALSE → "Tài khoản bị khoá".
   - Thành công → sinh token stateless = base64(`username|expiresAt|HMAC_SHA256(username+expiresAt, salt)`), expiresAt = now + 8h.
   - Return `{ok:true, token, username, full_name, role, expires_at}`.

8. Hàm `verifyToken(token)` → trả `{username, role, full_name}` hoặc throw "invalid token". Re-đọc role/full_name từ sheet `taikhoan` để luôn fresh.

9. `action: "submit"`:
   - verifyToken.
   - Reject nếu `!can(role, 'submit')` (role demo).
   - Validate `type` có trong SHEET_MAP.
   - Mở sheet, đọc header row 1.
   - Map data theo header label tiếng Việt. Server overwrite:
     * `STT` = sheet.getLastRow() (giả sử header row 1).
     * `ngày khảo sát` / `Ngày khảo sát` = `Utilities.formatDate(new Date(), "Asia/Ho_Chi_Minh", "yyyy-MM-dd HH:mm:ss")`.
     * `Người khảo sát` = full_name từ token.
     * `Submitted At` = ISO timestamp.
     * `User Agent` = `e.parameter.ua` nếu có.
     * `Username` = username từ token.
     * `Deleted At`, `Deleted By` = rỗng.
   - appendRow.
   - Return `{ok:true, stt, sheet, timestamp}`.

10. `action: "list"`:
    - verifyToken.
    - Filter:
      * Nếu role không có quyền `manage`/`report` → ép `username = currentUser.username`.
      * Param hỗ trợ: type, username, from, to, includeDeleted.
    - Scan sheet(s), filter rows, return rows array.

11. `action: "delete"` (soft-delete):
    - verifyToken, can(role, 'delete') hoặc reject.
    - Tìm row theo (type, stt).
    - Parse cột `Ảnh (URLs)` → từng URL → trích `public_id` → gọi Cloudinary Admin API destroy (signature SHA1). Lỗi xoá ảnh → log, không chặn.
    - Set `Deleted At` = now, `Deleted By` = username.
    - Ghi log vào sheet `Audit` (tự tạo nếu chưa có): timestamp, action=delete, username, target_sheet, target_stt, note.
    - Return ok.

12. `action: "restore"`:
    - verifyToken, can(role, 'delete'). Clear Deleted At + Deleted By. Log vào Audit. Return ok kèm cảnh báo ảnh không khôi phục.

13. `action: "kpi"`:
    - verifyToken, can(role, 'kpi').
    - Input: `month` (YYYY-MM).
    - Đọc sheet `KPI_Targets` lấy targets/weights, fallback default (50/5/20, 0.40/0.30/0.15/0.10/0.05).
    - Đọc 15 sheet KS, filter row có Submitted At thuộc tháng + Deleted At rỗng.
    - Aggregate theo Username: count, có ảnh, có GPS, distinct types, active days, completeness avg.
    - Tính 5 chỉ tiêu theo mục 13 CLAUDE.md, tổng KPI, xếp loại A/B/C/D.
    - Return `{ok, month, results: [...]}` sort theo total desc.

14. `action: "report"`:
    - verifyToken, can(role, 'report').
    - Input: types[], from, to, usernames[], status, groupBy.
    - Filter rows, aggregate 3 vùng:
      * A (bảng tổng quan): theo loại KS.
      * B (timeseries): theo (loại, bucket thời gian theo groupBy).
      * C (pivot): theo (KTV, loại).
    - Return `{ok, areaA, areaB, areaC}`.

15. Comment tiếng Việt mọi hàm phức tạp. Đặt log `console.log` đầu mỗi action để debug trên Apps Script Executions.

LƯU Ý quan trọng: `HEADERS` trong Code.gs PHẢI khớp NGUYÊN VĂN với label trong schemas.js và mục 5 CLAUDE.md. Đây là source of truth thứ hai (bắt buộc do Apps Script không đọc được file js frontend). Nếu sau này sửa schema, phải sửa CẢ HAI.

KHÔNG tạo file khác. Sau khi xong, in danh sách hàm + báo cáo. Chờ tôi nói "ok B4".
```

---

## PROMPT 3 — B4: Sinh lookups.js từ Excel

```
Thực hiện B4. Đọc file `khao sat tang cuong den.xlsx` (lưu ý có khoảng trắng trong tên file) → sinh `js/lookups.js`.

DỮ LIỆU LẤY:

1. Sheet "Phường-Xã 2025":
   - Header ở row 3, row 4 trống → đọc từ row 5 đến hết.
   - Cột B (index 1): tên phường mới.
   - Cột D (index 3): quận/huyện cũ.
   - Loại bỏ row trống và whitespace-only.
   - Trim trailing/leading whitespace (chú ý ký tự non-breaking space \xa0).
   - Phải đủ 102 mục — nếu thiếu/thừa, dừng lại báo cáo, không tự sửa.

2. Sheet "TĐK":
   - Header ở row 1, row 2 là filler.
   - Đọc từ row 3 đến hết.
   - Cột C (index 2): TĐK 2026.
   - Loại bỏ trống, duplicate, trim.
   - Phải khoảng 900+ mục.

OUTPUT `js/lookups.js`:

```javascript
// Tự sinh từ "khao sat tang cuong den.xlsx" ngày {YYYY-MM-DD}
// KHÔNG sửa tay file này. Khi nguồn cập nhật, chạy lại script sinh.

export const PHUONG_XA = [
  { ten: "...", quan_cu: "..." },
  // ... 102 mục
];

export const QUAN_LIST = [...new Set(PHUONG_XA.map(p => p.quan_cu))].sort();

export const TDK_LIST = [
  "...",
  // ... ~903 mục
].sort();

// Tổng: 102 phường/xã, N quận cũ, M tủ điều khiển
```

Sau khi tạo, in:
- Số phường/xã thực tế (phải = 102).
- Số quận cũ unique.
- Số TĐK unique.
- 5 mục PHUONG_XA đầu + 5 mục TDK đầu để tôi verify mắt.

Chờ tôi nói "ok B5".
```

---

## PROMPT 4 — B5: schemas.js (15 schema)

```
Thực hiện B5. Tạo `js/schemas.js` với đầy đủ 15 schema theo mục 5 CLAUDE.md.

CẤU TRÚC:

```javascript
export const SCHEMAS = {
  tang_cuong_den: {
    name: "Tăng cường đèn",      // hiển thị cho KTV
    sheet: "Tang cuong den",      // PHẢI khớp mục 4 CLAUDE.md
    icon: "💡",
    fields: [
      { label: "STT", key: "stt", type: "stt_auto" },
      { label: "Hẻm", key: "hem", type: "text", required: false },
      // ... đủ 22 field theo mục 5.1
    ]
  },
  ngam_hoa: { name: "Ngầm hóa", sheet: "Ngam Hoa", icon: "🔌", fields: [...] },
  // ... đủ 15 loại
};
```

RÀNG BUỘC:
- `label` PHẢI NGUYÊN VĂN tiếng Việt từ mục 5 CLAUDE.md (kể cả khoảng trắng, dấu, viết hoa/thường lẻ).
- Đủ field theo từng schema 5.1 → 5.15.
- Số field phải khớp số cột mục 4 (vd tang_cuong_den = 22, ngam_hoa = 23, ...).
- `type` dùng các giá trị: text, number, decimal, textarea, date_auto, stt_auto, gps_lat, gps_lng, select, quan, phuong, tdk, link_gmap.
- KHÔNG dùng `skip` nữa — trường "Bản vẽ" giờ là `text` (theo quyết định 2026-05-26 mục 21).
- `select` có thêm `options: [...]` đúng theo mục 5.
- Field có note đặc biệt (vd placeholder) thêm field `placeholder` hoặc `hint`.

TÊN HIỂN THỊ + ICON cho 15 loại:
- tang_cuong_den → "Tăng cường đèn" 💡
- ngam_hoa → "Ngầm hóa" 🔌
- thay_den → "Thay đèn" 🔦
- hkn → "Hộp kín nước" 📦
- tc_noi → "Thay cáp nổi" 🪢
- cap_luon_can → "Cáp luồn cần" 🧵
- tc_ngam → "Thay cáp ngầm" ⛓️
- thay_can → "Thay cần đèn" 🦯
- thay_tru → "Thay trụ" 🏗️
- choa_den → "Chóa đèn" 🪔
- nap_tru → "Nắp trụ" 🛡️
- vo_tu → "Vỏ tủ điều khiển" 🗄️
- tc_den_kc_xa → "Tăng cường đèn khoảng cách xa" 🛣️
- decal_so_tru → "Decal số trụ" 🔢
- nang_mong → "Nâng móng trụ" ⛏️

Sau khi xong:
- console.log số schema (= 15).
- console.log tổng số field qua tất cả schema.
- Verify từng schema bằng cách so sánh số field với mục 4 CLAUDE.md, in bảng so sánh.

Chờ tôi nói "ok B6".
```

---

## PROMPT 5 — B6: Helper modules

```
Thực hiện B6. Tạo các module helper trong `js/`. Tất cả ES6 module, Vanilla JS, không thư viện ngoài.

js/utils.js:
- showToast(message, type='success'|'error'|'warning'|'info', duration=3000)
- escapeHtml(str)
- formatVnDate(dateObj) → "26/05/2026 14:30:25"
- formatVnDateOnly(dateObj) → "26/05/2026"
- monthKey(dateObj) → "2026-05"
- debounce(fn, wait)
- uuid()
- groupBy(array, keyFn)

js/auth.js (CỐT LÕI — đọc mục 12 CLAUDE.md):
- export const PERMISSIONS (giống hệt Apps Script).
- export function can(role, action), isFullAccess(role), hasPermission(action).
- export function getCurrentUser() — đọc từ sessionStorage/localStorage tuỳ "remember".
- export async function login(username, password, remember) — gọi api, lưu token.
- export function logout() — clear storage, redirect login.html.
- export function requireAuth(requiredAction?) — gọi ở đầu mỗi trang HTML; nếu thiếu permission redirect; nếu chưa login redirect login.html. Cũng check expires_at, hết hạn → logout.
- export function getAuthHeader() — trả `{token: ...}` để gửi kèm request.

js/gps.js:
- getCurrentPosition({timeout=10000, highAccuracy=true}) → Promise<{lat, lng, accuracy}>
- Reject với error.code rõ ràng nếu permission denied / timeout.
- Format số 6 chữ số sau dấu chấm.

js/camera.js:
- compressImage(file, maxDim=1600, quality=0.8) → Promise<Blob>
- createThumbnail(file, dim=120) → Promise<DataURL>
- Validate: chỉ image/*, max 20MB raw.

js/storage.js:
- saveDraft(type, formData) / loadDraft(type) / clearDraft(type)
- enqueueSubmission(payload) / getQueue() / removeFromQueue(uuid)
- saveSubmittedToday(record) — tự reset sang ngày mới.
- getSubmittedToday() (lọc theo date hôm nay)
- saveToken(token, username, full_name, role, expires_at, remember) / getToken() / clearToken()

js/api.js — wrapper cho 7 endpoint Apps Script:
- apiLogin(username, password)
- apiSubmit(type, data, photos)
- apiList({type, username, from, to, includeDeleted})
- apiDelete(type, stt)
- apiRestore(type, stt)
- apiKpi(month)
- apiReport({types, from, to, usernames, status, groupBy})
- uploadImage(file, surveyType) — Cloudinary unsigned upload, đã nén trước.
- syncQueue() — đọc queue, retry từng submission, xoá thành công, giữ failed.
- Tất cả request submit/list/delete/restore/kpi/report gửi kèm token qua field `token` trong body. POST text/plain để tránh CORS preflight.

Tất cả file có comment đầu file giải thích vai trò. Sau khi xong, in danh sách file + báo cáo. Chờ tôi nói "ok B7".
```

---

## PROMPT 6 — B7: form-renderer.js

```
Thực hiện B7. Tạo `js/form-renderer.js` — engine render form từ schema.

API:
export async function renderForm(containerEl, schemaKey)

LUỒNG:
1. Đọc `getCurrentUser()`. Nếu chưa login → redirect login.html (gọi requireAuth() đầu hàm).
2. Lấy schema = SCHEMAS[schemaKey]. Nếu không có → toast lỗi + redirect index.html.
3. Render header: tên loại + icon + nút "← Về trang chủ".
4. Render từng field theo type:
   - stt_auto / date_auto / link_gmap: KHÔNG render UI.
   - gps_lat & gps_lng: render gộp 1 block "GPS: lat, lng (sai số Xm)" + nút "Lấy lại GPS". Tự động gọi GPS khi mở form.
   - Người khảo sát (key=nguoi_ks): auto-fill = currentUser.full_name, readonly. Nếu role=demo, hiện banner cảnh báo.
   - quan: <select> từ QUAN_LIST. onChange → cập nhật danh sách phường.
   - phuong: <select> filter theo quận. Thêm option "Khác (nhập tay)" cho phép input text fallback.
   - tdk: <input list="tdk-list"> + <datalist> với TDK_LIST.
   - select: <select> với options.
   - text/textarea/number/decimal: input thường, placeholder nếu schema có hint.
   - required: dấu * đỏ + HTML5 required.
5. Block ảnh:
   - input file accept="image/*" multiple capture="environment".
   - Grid preview 3 cột, mỗi ảnh có nút ✕.
   - Upload song song khi chọn, hiện progress bar.
   - Lưu mảng URL.
6. Pre-fill từ draft cũ (nếu có) — confirm trước khi load.
7. Auto-save mỗi 5s vào draft.
8. Submit handler:
   a. Validate required (skip trường readonly).
   b. Nếu role=demo → toast "Tài khoản xem thử không submit được", return.
   c. Disable nút Lưu + spinner.
   d. Đợi tất cả ảnh upload xong (block submit nếu còn upload).
   e. Collect data: object với key = schema.label (giữ NGUYÊN VĂN, để map cột Sheet).
   f. Auto: `Link Google Map` = "https://www.google.com/maps?q=lat,lng" nếu có GPS.
   g. Gán `Ảnh (URLs)` = urls.join("|").
   h. Try: await apiSubmit(schemaKey, data, photos).
      Success → clearDraft, saveSubmittedToday, toast "Đã lưu STT #N". Hỏi tiếp tục/về.
      Network fail → enqueueSubmission, toast "Đã lưu offline, sẽ tự đồng bộ", về index.
      Server error (forbidden/invalid token) → logout + redirect login.

YÊU CẦU:
- Tách hàm nhỏ: renderField, renderImageBlock, renderGpsBlock, collectFormData, validateForm, handleSubmit.
- KHÔNG dùng innerHTML với dữ liệu user — escapeHtml hoặc textContent.
- Comment tiếng Việt mọi đoạn phức tạp.
- Mobile-first, button ≥44px.

Sau khi xong, báo cáo. Chờ tôi nói "ok B8".
```

---

## PROMPT 7 — B8: login.html

```
Thực hiện B8. Tạo `login.html` theo mục 12 CLAUDE.md.

CẤU TRÚC:
- <head>: viewport mobile, Tailwind CDN, title "Đăng nhập — Khảo sát SAPULICO".
- <body>:
  * Logo + text "SAPULICO" ở trên.
  * Card form ở giữa màn hình:
    - Input username (autofocus, autocapitalize=off).
    - Input password (type=password).
    - Checkbox "Nhớ đăng nhập" (mặc định bật).
    - Nút "Đăng nhập" (full width, blue-700, ≥44px).
    - Vùng hiển thị lỗi inline (red-600, ẩn mặc định).
  * Phía dưới: "Liên hệ quản trị nếu quên mật khẩu" (placeholder).

LOGIC (`<script type="module">` ở cuối):
- Import login, getCurrentUser từ auth.js.
- Nếu đã login (token còn hạn) → redirect theo role:
  * admin/user → kpi.html
  * user1 → index.html
  * demo → index.html
- Submit form:
  1. Disable nút + spinner.
  2. Call login(username, password, remember).
  3. Success → redirect theo role như trên.
  4. Fail → hiện lỗi cụ thể từ server (sai mật khẩu / bị khoá / hết quota).
- Sau 5 lần fail → disable nút 5 phút, đếm ngược trên UI.

KHÔNG đăng ký service worker ở login.html (để dễ debug auth flow).

Sau khi xong, báo cáo. Chờ tôi nói "ok B9".
```

---

## PROMPT 8 — B9 + B10 + B11: form, index, recent

```
Thực hiện B9, B10, B11.

B9. `form.html`:
- <head>: viewport, Tailwind, title động "<Tên loại> — Khảo sát SAPULICO".
- Header sticky: nút "←" về index + tên loại KS + tên user + nút Đăng xuất.
- <body><div id="form-container"></div>
- Script module:
  * requireAuth() đầu trang.
  * Parse URL ?type=. Nếu invalid → redirect index.
  * Gọi renderForm(container, type).
  * Đăng ký sw.js.

B10. `index.html` (trang chủ):
- Header sticky: text "SAPULICO" + tên user + role badge + indicator online/offline + số bản chờ sync + menu dropdown:
  * Trang chủ
  * Khảo sát hôm nay (recent.html)
  * (admin/user) Xem KPI (kpi.html)
  * (admin/user) Quản lý bản ghi (manage.html)
  * (admin/user) Báo cáo tổng hợp (report.html)
  * Đăng xuất
- Grid 15 thẻ. Mobile 2 cột, tablet 3, desktop 4. Mỗi thẻ: icon to + tên + tap → form.html?type=key.
- Nếu role=demo: banner vàng trên đầu "Chế độ xem thử — không lưu được dữ liệu".
- Script: requireAuth(), render menu dựa trên hasPermission(), call syncQueue() async, đăng ký sw.js.

B11. `recent.html`:
- Header giống index.
- Nếu role có quyền `manage` → filter cho phép xem của KTV khác. Mặc định "Của tôi hôm nay".
- List card mỗi record: icon loại, tuyến đường, thời gian, STT, số ảnh (badge).
- Tap card → expand chi tiết readonly các trường (không cho sửa).
- Empty state: "Hôm nay chưa có bản khảo sát nào".

UX:
- Button ≥44px.
- Màu primary: blue-700.
- Tất cả text tiếng Việt.

Sau khi xong 3 file HTML, báo cáo. Chờ tôi nói "ok B12".
```

---

## PROMPT 9 — B12: KPI

```
Thực hiện B12. Tạo `js/kpi.js` + `kpi.html` theo mục 13 CLAUDE.md.

`kpi.html`:
- Header giống index.html, có nút về trang chủ.
- requireAuth('kpi') đầu trang (user1/demo bị đẩy về index).
- Dropdown chọn tháng (mặc định = tháng hiện tại, format YYYY-MM). Có 12 tháng gần nhất.
- Nút "Tải dữ liệu".
- Loading spinner.
- Bảng kết quả với header: KTV / Họ tên / Số bản / Tần suất / Chất lượng / Đa dạng / Đầy đủ / Ổn định / Tổng / Xếp loại.
- Sort mặc định Tổng desc. Click header để đổi sort.
- Xếp loại có màu: A xanh, B xanh nhạt, C vàng, D đỏ.
- Nút "Xuất CSV".
- Click KTV → modal hiện chi tiết + biểu đồ cột số bản theo ngày (SVG vanilla, max 31 cột).

`js/kpi.js`:
- function loadKpi(month) — call apiKpi, render bảng.
- function exportCsv(results) — generate CSV, download.
- function renderDetailModal(ktv, records) — vẽ biểu đồ SVG.

Sau khi xong, báo cáo. Chờ tôi nói "ok B13".
```

---

## PROMPT 10 — B13: Quản lý bản ghi

```
Thực hiện B13. Tạo `js/manage.js` + `manage.html` theo mục 14 CLAUDE.md.

`manage.html`:
- requireAuth('manage') đầu trang.
- Header giống index.
- Vùng filter trên đầu:
  * Loại khảo sát: dropdown 15 loại + "Tất cả".
  * KTV: dropdown từ taikhoan + "Tất cả".
  * Từ ngày → đến ngày.
  * Trạng thái: "Đang hoạt động" (mặc định) / "Đã xoá" / "Tất cả".
  * Ô tìm kiếm tự do.
  * Nút "Tìm".
- Bảng kết quả với checkbox đầu hàng + cột: STT / Loại / Tuyến đường / KTV / Ngày / Ảnh / Trạng thái / Thao tác.
- Pagination 50/trang.
- Nút "Xoá đã chọn" + nút thao tác từng dòng (Xem / Xoá / Khôi phục).
- Modal confirm xoá:
  ```
  Bạn sắp xoá bản ghi STT #N của loại "<tên>".
  - Dữ liệu sẽ được đánh dấu xoá (có thể khôi phục).
  - Tất cả ảnh đính kèm sẽ bị xoá VĨNH VIỄN khỏi Cloudinary, KHÔNG khôi phục được.
  [Huỷ] [Xoá vĩnh viễn ảnh + soft-delete data]
  ```
- Modal xem chi tiết readonly.

`js/manage.js`:
- loadRecords(filters), deleteRecord(type, stt), restoreRecord(type, stt), bulkDelete(items).
- Lightbox hiển thị ảnh.

Sau khi xong, báo cáo. Chờ tôi nói "ok B14".
```

---

## PROMPT 11 — B14: Báo cáo tổng hợp

```
Thực hiện B14. Tạo `js/report.js` + `report.html` theo mục 15 CLAUDE.md.

`report.html`:
- requireAuth('report') đầu trang.
- Header giống index.
- Vùng filter:
  * Loại khảo sát: multi-select 15 loại (default tất cả).
  * Khoảng thời gian: từ → đến + preset "Tháng này"/"Tháng trước"/"Quý này"/"Năm nay"/"Tuỳ chọn".
  * KTV: multi-select.
  * Trạng thái: "Đang hoạt động"/"Đã xoá"/"Tất cả".
  * Group by: Ngày/Tuần/Tháng/Quý.
  * Nút "Tải báo cáo".
- 3 vùng kết quả:
  * **A. Bảng tổng quan**: 1 hàng/loại — Tổng bản / Có ảnh / Có GPS / Trung bình ảnh-bản / Đã xoá.
  * **B. Biểu đồ cột chồng** SVG vanilla: trục X = thời gian, mỗi cột chia màu theo loại, tooltip hover.
  * **C. Pivot table** KTV × Loại: số bản, cell click → drill-down list bản ghi.
- Nút "Xuất CSV" → tải zip 3 file CSV.

`js/report.js`:
- loadReport(filters), renderTableA(), renderChartB(), renderPivotC().
- exportCsv() — JSZip CDN nếu cần, hoặc tải lần lượt 3 file.

Sau khi xong, báo cáo. Chờ tôi nói "ok B15".
```

---

## PROMPT 12 — B15: PWA

```
Thực hiện B15. Tạo PWA assets.

manifest.json: y mục 16 CLAUDE.md. name="Khảo sát chiếu sáng SAPULICO", short_name="KS Đèn", start_url="./", display="standalone", theme_color="#1d4ed8", icons 192/512.

sw.js:
- Cache name "khaosat-v1".
- Install: precache shell — '/', '/index.html', '/login.html', '/form.html', '/recent.html', '/kpi.html', '/manage.html', '/report.html', '/manifest.json', tất cả file js/, css/style.css.
- Fetch strategy:
  * Apps Script URL hoặc Cloudinary: network only.
  * Tailwind CDN: cache-first.
  * Còn lại: stale-while-revalidate.
- Activate: xoá cache name khác.

assets/icon-192.png, assets/icon-512.png: PNG nền blue-700 #1d4ed8, chữ "KS" trắng, sinh bằng Python+Pillow nếu cần.

css/style.css: đầu file comment giải thích, body tạm rỗng (Tailwind đủ).

Sau khi xong, báo cáo. Chờ tôi nói "ok B16".
```

---

## PROMPT 13 — B16: Test toàn bộ

```
Thực hiện B16. Test toàn bộ ứng dụng (mock — chưa cần deploy thật).

Kế hoạch test:
1. Khởi `python -m http.server 8080` ở root repo.
2. Verify 200 OK cho tất cả file HTML/JS/JSON.
3. Parse từng file JS bằng `node --check` (nếu có) hoặc regex syntax — không lỗi.
4. Verify SCHEMAS:
   - Số loại = 15.
   - Mỗi schema.sheet khớp mục 4 CLAUDE.md (in bảng so sánh).
   - Mỗi schema.fields có stt/ngay_ks/nguoi_ks.
   - Tất cả label tiếng Việt không lỗi encoding.
5. Verify Code.gs:
   - SHEET_MAP 15 entries khớp SCHEMAS keys.
   - PERMISSIONS 4 role × 5 action.
   - 7 case trong switch action.
6. Verify auth.js:
   - PERMISSIONS map giống Apps Script.
   - requireAuth có check expiresAt.
7. Verify api.js:
   - Mọi action gửi kèm token (trừ login).
   - Cloudinary upload nén trước.

Mô phỏng các luồng (không cần thật sự gọi Apps Script, chỉ kiểm trên code):
- login → redirect theo role.
- demo cố submit → bị reject.
- user1 cố mở kpi.html → bị redirect.
- delete → soft-delete row + xoá ảnh Cloudinary + log Audit.

Output:
- ✅/❌ cho từng mục test.
- Tree cây thư mục.
- wc -l tổng số dòng code.
- Liệt kê vấn đề phát hiện (nếu có).

Cập nhật README.md "Known Issues" với phát hiện.

Sau khi xong, báo cáo. Chờ tôi nói "ok B17".
```

---

## PROMPT 14 — B17: Final review & tổng kết

```
Thực hiện B17. Tổng kết dự án.

1. Đi qua checklist chất lượng mục 19 CLAUDE.md, tick từng mục. Liệt kê mục nào chưa đạt + lý do.

2. Cập nhật README.md:
   - Link demo: https://<user>.github.io/khaosat
   - Bảng 15 loại KS.
   - Section "Cho KTV": 5 bước dùng app.
   - Section "Cho Admin": KPI / Manage / Report đường dẫn + quyền.
   - Known Issues (từ B16).

3. Tạo CHANGELOG.md v1.0.0 ngày hôm nay:
   - Features: 15 loại form, 4 role auth, KPI, Manage (soft-delete), Report, PWA, offline queue.

4. In cây thư mục cuối cùng.

5. In "NEXT STEPS" để go-live:
   - Hoàn tất SETUP.md bước A→J.
   - git push.
   - GitHub Pages enable.
   - Test login với 4 user mẫu.
   - Test submit thật 1 form mỗi loại.
   - Test xoá + khôi phục.
   - Test KPI tháng hiện tại.
   - Test report.

6. Báo cáo "Hoàn tất dự án v1.0" + liệt kê mọi file đã tạo với mô tả 1 dòng.
```

---

## PROMPT BỔ SUNG — Khi cần sửa/thêm sau này

### A. Thêm 1 loại khảo sát mới

```
Thêm loại khảo sát "<tên>" key=<key>. Sheet name: "<sheet>".
Fields: [paste theo format mục 5 CLAUDE.md].

Yêu cầu:
1. Update CLAUDE.md mục 4 (bảng) + mục 5 (schema mới).
2. Update apps-script/Code.gs SHEET_MAP.
3. Update js/schemas.js.
4. Hướng dẫn tôi thủ công tạo sheet mới trong Google Sheets + 6 cột bonus + conditional format.
5. KHÔNG đụng file khác.
Sau khi xong báo cáo.
```

### B. Thêm/sửa/xoá user

```
[Admin task]
1. Tôi muốn tạo user mới: username=X, full_name=Y, role=Z.
2. Trên Apps Script script.google.com, mở Code.gs, chạy hàm `hashPassword("mật-khẩu-mới")` → copy hash.
3. Paste vào sheet `taikhoan` cột password_hash.
4. Set active=TRUE.

(Hoặc) Tôi muốn vô hiệu hoá user X: set active=FALSE trong sheet `taikhoan`.
```

### C. Đổi mật khẩu user

```
Tôi muốn đổi mật khẩu user X.
Trên Apps Script: chạy `hashPassword("mật-khẩu-mới")` → copy hash → paste vào sheet `taikhoan` row của user X cột password_hash. Token cũ vẫn còn hạn 8h, sau đó user phải đăng nhập lại.
```

### D. Đổi UX/UI

```
Muốn thay đổi UI: [mô tả cụ thể].
Phạm vi: chỉ js/form-renderer.js + css/style.css + file HTML liên quan.
KHÔNG đụng schemas, Apps Script, config.
Sau khi xong test lại tương đương B16 nhưng chỉ phần UI.
```

### E. Bug

```
Khi tôi <hành động>, gặp lỗi: [paste console log hoặc Apps Script Executions].

Yêu cầu:
1. Phân tích nguyên nhân (đọc CLAUDE.md mục liên quan, đọc code thực tế).
2. Đề xuất fix (CHƯA code).
3. Đợi tôi duyệt mới sửa.

KHÔNG đoán mò, KHÔNG sửa ngoài phạm vi bug.
```

### F. Rotate URL Apps Script (khi nghi bị spam)

```
Nghi Apps Script bị spam (xem Apps Script Executions thấy nhiều fail login).

Yêu cầu:
1. Hướng dẫn tôi re-deploy Apps Script với version mới (Manage Deployments → New version).
2. Copy URL mới.
3. Cập nhật js/config.js → push.
4. URL cũ tự vô hiệu trong vài giờ.

KHÔNG cần đổi salt (token cũ vẫn verify được). Chỉ đổi salt khi muốn invalidate hết token đang dùng.
```

---

## CHIẾN LƯỢC SỬ DỤNG

### Quy tắc vàng
1. **Mỗi PROMPT chạy đến cùng**. Không gửi PROMPT tiếp khi PROMPT trước chưa được xác nhận.
2. **Đọc code Claude tạo trước khi commit**. Đặc biệt lookups.js (102 phường, 903 TĐK) và schemas.js (label tiếng Việt).
3. **Test sau mỗi mốc lớn**:
   - Sau B3 (Code.gs): paste vào script.google.com, chạy thử `hashPassword("test")` xem có hash trả về không.
   - Sau B5 (schemas.js): `python -m http.server` rồi `console.log(SCHEMAS)` trong browser.
   - Sau B8 (login.html): test login với user mẫu thật trong sheet `taikhoan`.
   - Sau B11 (recent.html): test luồng login → submit 1 form → recent.html thấy bản ghi.
4. **Commit Git sau mỗi PROMPT thành công** — dễ rollback nếu PROMPT sau sai.
5. **Nếu Claude bịa dữ liệu (đặc biệt lookups)**: gửi prompt "Bạn đang bịa. Đọc thực tế từ file Excel sheet X từ row Y. In 10 mục đầu để tôi verify trước khi tiếp".

### Khi Claude lệch hướng

```
DỪNG. Bạn đang làm sai mục [X] CLAUDE.md.
Đọc lại mục [X], cụ thể: [chỉ rõ chỗ sai và phải làm gì].
KHÔNG sửa rộng — chỉ fix phần lệch.
```

### Nếu chat quá dài, bắt đầu chat mới

1. Upload lại CLAUDE.md + PROMPTS.md.
2. Upload các file đã tạo từ chat cũ.
3. Bắt đầu bằng prompt:
   ```
   Đây là chat tiếp tục dự án `khaosat` SAPULICO. Đính kèm:
   - CLAUDE.md (nguồn chân lý)
   - PROMPTS.md (kịch bản đang theo)
   - <các file đã tạo>
   Tôi đã hoàn thành đến PROMPT N. Giờ tiếp tục PROMPT N+1: [dán nguyên văn].
   ```

---

**Hết.** Lưu file này dài hạn. Để onboard người mới hoặc redo dự án, chỉ cần `CLAUDE.md` + `PROMPTS.md` + file Excel gốc.
