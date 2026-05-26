# BỘ PROMPT HOÀN CHỈNH — Dự án Website Khảo sát Chiếu sáng LAVIPCO

> Hướng dẫn sử dụng: Mỗi `### PROMPT N` bên dưới là một message bạn **copy nguyên văn** dán vào Claude Code (hoặc claude.ai có upload file). Chạy lần lượt từ Prompt 0 đến Prompt 10. Đừng nhảy bước.

---

## Chuẩn bị TRƯỚC KHI bắt đầu

1. Tạo **repo GitHub Private** mới, tên gợi ý: `khao-sat-chieu-sang`.
2. Clone repo về máy.
3. Copy 2 file vào root repo:
   - `CLAUDE.md` (đã có ở chat trước)
   - `khao_sat_tang_cuong_den.xlsx` (file Excel gốc của bạn)
4. Mở **Claude Code** (hoặc terminal có Claude Code) trong thư mục repo, hoặc mở **claude.ai** và upload 2 file trên ở message đầu tiên.

---

## PROMPT 0 — Khởi tạo (LUÔN GỬI ĐẦU TIÊN)

```
Đây là dự án xây website khảo sát hiện trường chiếu sáng đô thị cho công ty LAVIPCO.

Tôi đã đính kèm:
1. CLAUDE.md — tài liệu kỹ thuật đầy đủ, là nguồn chân lý của dự án
2. khao_sat_tang_cuong_den.xlsx — file Excel gốc chứa cấu trúc 15 loại khảo sát + 102 phường + 903 TĐK

YÊU CẦU:
- Đọc TOÀN BỘ CLAUDE.md (đặc biệt là mục 14 - checklist 13 bước, và mục 17 - 6 câu hỏi cần xác nhận).
- KHÔNG code ngay. KHÔNG tạo file nào.
- Sau khi đọc xong, trả lời tôi:
  (a) Xác nhận bạn đã hiểu kiến trúc tổng thể (tóm tắt 3-5 dòng).
  (b) Hỏi tôi 6 câu hỏi xác nhận ở mục 17 của CLAUDE.md.
  (c) Nếu thấy điểm nào trong CLAUDE.md mâu thuẫn hoặc không rõ, nêu ra luôn.

Sau khi tôi trả lời 6 câu hỏi, mới bắt đầu code theo checklist mục 14.
```

> **Bạn chờ Claude trả lời 6 câu hỏi**, rồi reply 6 câu trả lời. Gợi ý đáp án tham khảo (bạn tự điều chỉnh):
> 1. Tên Google Sheets: `Khảo sát LAVIPCO 2026`
> 2. Logo: dùng text "LAVIPCO" placeholder, sau có ảnh sẽ thay
> 3. Trường "Bản vẽ": luôn để trống, KTV không nhập
> 4. Năm lắp đặt: cho nhập tự do, validate 1990–2026
> 5. Repo tên `khao-sat-chieu-sang`, private
> 6. Dùng URL mặc định `<user>.github.io/<repo>`, chưa cần domain riêng

---

## PROMPT 1 — Tạo README và SETUP

```
Tốt. Giờ thực hiện Bước 1 và Bước 2 của checklist mục 14 trong CLAUDE.md:

B1. Tạo README.md ở root — ngắn gọn, dành cho KTV và quản lý:
- Mô tả dự án 3-4 dòng
- Cách KTV mở app trên điện thoại (link, hướng dẫn "Add to Home Screen" Android/iOS)
- Cách quản lý xem dữ liệu (link Google Sheets)
- Liên hệ hỗ trợ
- Section "Known Issues" để trống, sẽ điền sau

B2. Tạo SETUP.md ở root — chi tiết cho người setup (có thể không biết code):
- Bước A: Tạo Google Sheets mới, đổi tên 15 sheet đúng như mục 4 CLAUDE.md, paste header (có thể dùng script copy từ file Excel gốc — hướng dẫn cụ thể)
- Bước B: Tạo Google Apps Script project, paste Code.gs (sẽ tạo ở bước sau), set Script Properties SPREADSHEET_ID, deploy as Web App "Anyone"
- Bước C: Đăng ký Cloudinary free, tạo unsigned upload preset tên "khaosat_unsigned", folder mặc định "khaosat"
- Bước D: Sửa js/config.js dán URL Apps Script và thông tin Cloudinary vào
- Bước E: Push lên GitHub, bật GitHub Pages branch main, đợi 2 phút
- Bước F: Test thử submit 1 form, kiểm tra dòng xuất hiện đúng trong Sheet và ảnh upload Cloudinary

Mỗi bước có ảnh chụp màn hình KHÔNG cần (chưa có), nhưng phải mô tả từng cú click một cách rõ ràng. Tone tiếng Việt, ngắn gọn.

Sau khi tạo xong 2 file, dừng lại, báo cáo "Đã hoàn tất B1, B2" và chờ tôi xác nhận trước khi sang B3.
```

---

## PROMPT 2 — Tạo Google Apps Script

```
B3. Tạo file apps-script/Code.gs theo yêu cầu mục 7 của CLAUDE.md.

Yêu cầu CỤ THỂ:
- Hàm doPost(e) nhận body, parse JSON (e.postData.contents).
- Validate type có trong SHEET_MAP (mục 7 CLAUDE.md).
- Mở spreadsheet bằng SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID')).
- Lấy sheet theo tên trong SHEET_MAP, error rõ ràng nếu không tồn tại.
- Đọc header row 1 của sheet đó (lastColumn).
- Với mỗi cột header, tìm giá trị tương ứng trong data:
  * Nếu header = "STT" → server tự gán = sheet.getLastRow() (số dòng hiện tại = STT mới, vì header chiếm row 1).
  * Nếu header chứa "ngày khảo sát" hoặc "Ngày khảo sát" → server tự gán Utilities.formatDate(new Date(), "Asia/Ho_Chi_Minh", "yyyy-MM-dd HH:mm:ss").
  * Còn lại: map từ data theo thứ tự label (data là object {label_tieng_viet: value}).
- Append row bằng sheet.appendRow(rowArray).
- Trả về ContentService JSON {ok: true, stt, sheet, timestamp}.
- Try/catch toàn bộ → trả {ok: false, error: e.toString(), stack: e.stack}.
- Log mọi request bằng console.log để debug trên Apps Script Executions.

Lưu ý CORS:
- Frontend sẽ gửi POST với Content-Type: text/plain để tránh preflight.
- Body là JSON string trong text/plain.
- Apps Script doPost vẫn parse được qua e.postData.contents.

Comment tiếng Việt trong code để Lam (user) hiểu khi cần debug sau này.

KHÔNG tạo file nào khác. Chỉ Code.gs. Sau khi xong, báo cáo và chờ xác nhận.
```

---

## PROMPT 3 — Sinh lookups.js từ Excel

```
B4. Đọc file khao_sat_tang_cuong_den.xlsx, sinh js/lookups.js.

Yêu cầu:
- Mở sheet "Phường-Xã 2025" → đọc từ row 5 đến hết (header ở row 3, row 4 trống).
  * Cột B (index 1): tên phường mới
  * Cột D (index 3): quận/huyện cũ (TP Thủ Đức, Quận 1, Quận 3, ...)
  * Loại bỏ row có cột B trống hoặc là ký tự whitespace (\xa0).
  * Trim whitespace.
  * Phải đủ 102 mục.

- Mở sheet "TĐK" → đọc từ row 3 đến hết (header ở row 1, row 2 là filler "1 1 1 1").
  * Cột C (index 2): TĐK 2026
  * Loại bỏ trống và duplicate.
  * Trim whitespace.
  * Phải khoảng 900+ mục.

- Output js/lookups.js dùng ES6 export:

  export const PHUONG_XA = [
    { ten: "...", quan_cu: "..." },
    ...
  ];
  export const QUAN_LIST = [...].sort();  // unique từ PHUONG_XA
  export const TDK_LIST = [...].sort();   // unique

- Đầu file ghi comment: "// Tự sinh từ khao_sat_tang_cuong_den.xlsx — KHÔNG sửa tay, regen khi nguồn cập nhật"
- Cuối file ghi 2 dòng log: "// 102 phường/xã, X quận cũ" và "// Y tủ điều khiển"

Sau khi sinh xong, in ra console số lượng để tôi verify. Báo cáo và chờ xác nhận.
```

---

## PROMPT 4 — Tạo schemas.js (15 schema)

```
B5. Tạo js/schemas.js với đầy đủ 15 schema theo mục 5 CLAUDE.md.

Yêu cầu CỤ THỂ:

- Export default một object:
  export const SCHEMAS = {
    tang_cuong_den: {
      name: "Tăng cường đèn",          // tên hiển thị cho KTV
      sheet: "Tang cuong den",         // tên sheet Google Sheets (khớp CLAUDE.md mục 4)
      icon: "💡",                      // emoji cho trang chủ
      fields: [
        { label: "STT", key: "stt", type: "stt_auto" },
        { label: "Hẻm", key: "hem", type: "text", required: false },
        ...
      ]
    },
    ngam_hoa: { ... },
    ...
  };

- "label" PHẢI là chuỗi TIẾNG VIỆT NGUYÊN VĂN từ mục 5 CLAUDE.md (kể cả khoảng trắng, dấu, viết hoa/thường lẻ). Đây là khoá để map sang cột Google Sheets.
- Đầy đủ cả 15 loại. Đếm số field phải khớp số cột mục 4 (vd Tang cuong den 22 cột → 22 field).
- "type" dùng các giá trị: text, number, decimal, textarea, date_auto, stt_auto, gps_lat, gps_lng, select, quan, phuong, tdk, link_gmap, skip.
- Với type "select": có thêm "options: [...]" như chỉ định mục 5.
- Tên hiển thị (name) thân thiện với KTV, không dùng key kỹ thuật:
  * tang_cuong_den → "Tăng cường đèn"
  * ngam_hoa → "Ngầm hóa"
  * thay_den → "Thay đèn"
  * hkn → "Hộp kín nước"
  * tc_noi → "Thay cáp nổi"
  * cap_luon_can → "Cáp luồn cần"
  * tc_ngam → "Thay cáp ngầm"
  * thay_can → "Thay cần"
  * thay_tru → "Thay trụ"
  * choa_den → "Chóa đèn"
  * nap_tru → "Nắp trụ"
  * vo_tu → "Vỏ tủ"
  * tc_den_kc_xa → "Tăng cường đèn khoảng cách xa"
  * decal_so_tru → "Decal số trụ"
  * nang_mong → "Nâng móng trụ"
- Icon emoji tùy chọn nhưng nhất quán 1 cảm hứng "công trình điện".

Sau khi xong, in ra console: "Đã tạo schemas.js với N loại khảo sát, tổng M trường". Báo cáo và chờ xác nhận.
```

---

## PROMPT 5 — Helper modules (utils, gps, camera, storage, api)

```
B6. Tạo 5 helper module trong js/. Mỗi file ES6 module, export rõ ràng. Code Vanilla JS, không dùng thư viện ngoài.

js/utils.js:
- showToast(message, type='success', duration=3000) — toast nổi góc dưới
- escapeHtml(str)
- formatVnDate(dateObj) → "26/05/2026 14:30"
- debounce(fn, wait)
- uuid() — random 8 ký tự

js/gps.js:
- getCurrentPosition({timeout=10000, highAccuracy=true}) → Promise resolves {lat, lng, accuracy} hoặc rejects.
- Có fallback: nếu permission denied, reject với error.code rõ ràng.
- Format số: 6 chữ số sau dấu chấm.

js/camera.js:
- compressImage(file, maxDim=1600, quality=0.8) → Promise<Blob>
- createThumbnail(file, dim=120) → Promise<DataURL>  (để hiện preview nhanh trước khi upload)
- Validate file: chỉ image/*, max 20MB raw.

js/storage.js (wrapper localStorage):
- saveDraft(type, formData) → key "draft_{type}"
- loadDraft(type) → object hoặc null
- clearDraft(type)
- enqueueSubmission(payload) → push vào queue_submissions array
- getQueue() → array
- removeFromQueue(uuid) — xóa item đã sync thành công
- saveLastNguoiKs(name) / getLastNguoiKs()
- saveSubmittedToday(record) — lưu vào submitted_today (auto reset mỗi ngày dựa trên date)
- getSubmittedToday() → array

js/api.js:
- submitSurvey(type, data) → POST đến CONFIG.appsScriptUrl với Content-Type: text/plain, body JSON.stringify({type, data}). Trả về parsed response. Throw nếu ok: false.
- uploadImage(file, surveyType) → POST đến Cloudinary, trả về secure_url. Đã nén ảnh trước khi gọi.
- syncQueue() — đọc queue, retry từng item, xóa item thành công, giữ item failed. Trả về {success: N, failed: M}.

Tất cả file phải có comment đầu file giải thích vai trò bằng tiếng Việt.

Sau khi xong, báo cáo từng file đã tạo và chờ xác nhận.
```

---

## PROMPT 6 — Form renderer (engine chính)

```
B7. Tạo js/form-renderer.js — engine render form từ schema.

Yêu cầu CỤ THỂ:

export async function renderForm(containerEl, schemaKey) {
  const schema = SCHEMAS[schemaKey];
  // 1. Render heading: tên loại khảo sát + nút "← Về trang chủ"
  // 2. Render form: với mỗi field trong schema.fields, render input phù hợp với type.
  //    - skip / date_auto / stt_auto / link_gmap: KHÔNG render UI.
  //    - gps_lat & gps_lng: render chung 1 block "GPS hiện tại: lat, lng (sai số Xm)" + nút "Lấy lại GPS". Tự động gọi GPS khi mở form.
  //    - quan: <select> từ QUAN_LIST. onChange → cập nhật danh sách phường.
  //    - phuong: <select> filter theo quận đã chọn. Cho phép thêm option "Khác (nhập tay)" → khi chọn sẽ hiện thêm input text.
  //    - tdk: <input list="tdk-list"> + <datalist id="tdk-list"> với TDK_LIST.
  //    - select: <select> với options.
  //    - text/textarea/number/decimal: render input bình thường, có placeholder dựa trên ghi chú trong schema nếu có.
  //    - required: thêm dấu * đỏ vào label, HTML5 required attribute.
  // 3. Block ảnh: input file accept="image/*" multiple capture="environment". Grid preview 3 cột, mỗi ảnh có nút X xóa. Upload song song khi vừa chọn, hiện progress.
  // 4. Block GPS như mô tả trên.
  // 5. Pre-fill "Người khảo sát" từ getLastNguoiKs() nếu có.
  // 6. Auto-save: setInterval mỗi 5s → saveDraft(schemaKey, collectFormData()).
  // 7. Khi mở form, nếu có draft cũ → confirm("Có bản nháp chưa gửi. Khôi phục?") → load.
  // 8. Submit handler:
       a. Validate required fields. Nếu thiếu, focus field đầu tiên + toast.
       b. Disable nút Submit, hiện spinner.
       c. Collect data: {label: value, ...} dùng đúng schema.label làm key.
       d. Nếu type không skip "Link Google Map" và đã có GPS, gán link_gmap = "https://www.google.com/maps?q={lat},{lng}".
       e. Đính kèm "Ảnh (URLs)" = urls.join("|") (cột bonus).
       f. Try: await submitSurvey(schemaKey, data).
          Success: clearDraft, saveLastNguoiKs, saveSubmittedToday, showToast("Đã lưu STT #" + stt). Hỏi: "Nhập tiếp loại này" / "Về trang chủ".
          Failure (offline hoặc lỗi mạng): enqueueSubmission, showToast("Đã lưu offline, sẽ tự đồng bộ", 'warning'), vẫn clearDraft + về trang chủ.

Implementation note:
- Tách thành nhiều hàm nhỏ: renderField, renderImageBlock, renderGpsBlock, collectFormData, validateForm, handleSubmit.
- Code rõ ràng, comment tiếng Việt các phần phức tạp.
- KHÔNG dùng innerHTML với data từ user (XSS) — dùng textContent hoặc escapeHtml.

Sau khi xong, báo cáo và chờ xác nhận.
```

---

## PROMPT 7 — HTML pages

```
B8 + B9 + B10. Tạo 3 file HTML chính.

index.html (trang chủ):
- <head>: meta viewport mobile, manifest.json link, Tailwind CDN, title "Khảo sát chiếu sáng LAVIPCO".
- <body>: 
  * Header sticky: text "LAVIPCO" (text-lg font-bold) + bên phải indicator online/offline (chấm xanh/đỏ) + số bản chờ sync.
  * Section chính: lưới 15 thẻ. Mobile 2 cột, tablet+ 3-4 cột. Mỗi thẻ: emoji to ở trên, tên loại ở dưới. Tap → window.location = "form.html?type=" + key.
  * Footer: link "Xem khảo sát hôm nay" → recent.html. Version tag.
- Script ở cuối: import SCHEMAS từ schemas.js, render grid động.
- Đăng ký service worker sw.js.
- Khi load, gọi syncQueue() nếu online — không await, chạy nền.

form.html:
- Cùng header với index nhưng có thêm nút "←" về trang chủ.
- Body: 1 div #form-container.
- Script: parse URL ?type=, gọi renderForm(container, type).
- Nếu type không hợp lệ → redirect về index.html.

recent.html:
- Cùng header.
- Body: list các record từ getSubmittedToday(). Mỗi card: icon loại, tuyến đường, thời gian, STT, [N ảnh].
- Tap card → expand chi tiết readonly các trường (không cho sửa).
- Nếu trống: "Hôm nay chưa có bản khảo sát nào".

UX bắt buộc:
- Tất cả button cao ≥ 44px.
- Màu chủ đạo: blue-700 (#1d4ed8) cho primary, gray-100 background.
- Font: system-ui mặc định của Tailwind.
- Mọi text Việt, không có chuỗi tiếng Anh lộ ra.

Sau khi xong 3 file HTML, báo cáo và chờ xác nhận.
```

---

## PROMPT 8 — PWA: manifest + service worker + icons

```
B11. Tạo manifest.json, sw.js, và 2 file icon placeholder.

manifest.json: y như mục 12 CLAUDE.md, đầy đủ name/short_name/start_url="./"/display=standalone/theme_color=#1d4ed8.

sw.js (service worker đơn giản):
- Cache name: "khaosat-v1"
- Trên install: cache các file shell: '/', '/index.html', '/form.html', '/recent.html', '/manifest.json', tất cả file js/, css/style.css.
- Trên fetch:
  * Request đến apps script URL hoặc cloudinary: KHÔNG cache, network only.
  * Request đến tailwind CDN: cache-first.
  * Còn lại: stale-while-revalidate.
- Trên activate: xóa cache cũ tên khác.

Icons: tạo 2 file PNG 192x192 và 512x512 đặt ở assets/. Nội dung ảnh: nền màu blue-700, chữ "KS" trắng to ở giữa. Generate bằng Python + Pillow nếu cần.

css/style.css: tạm thời rỗng (chỉ comment giải thích) — Tailwind đã đủ.

Sau khi xong, báo cáo và chờ xác nhận.
```

---

## PROMPT 9 — Test toàn bộ

```
B12. Test toàn bộ ứng dụng. Bạn KHÔNG cần deploy thật, chỉ verify code chạy được trên môi trường mô phỏng:

1. Mở Python http.server tại root repo (port 8080).
2. Dùng curl/wget kiểm tra index.html, form.html, recent.html, manifest.json, sw.js, các file js/ load 200 OK.
3. Parse từng file JS bằng node (nếu có) hoặc kiểm tra cú pháp ES6 — không có lỗi syntax.
4. Mở từng schema trong SCHEMAS, đảm bảo:
   - schema.sheet khớp danh sách mục 4 CLAUDE.md (in ra bảng so sánh)
   - schema.fields có ít nhất các field bắt buộc: stt, ngay_ks (date_auto), nguoi_ks
   - Tất cả label tiếng Việt không có ký tự lạ
5. Validate Code.gs: SHEET_MAP có đủ 15 entries, key khớp với SCHEMAS.

In ra báo cáo:
- ✅ / ❌ cho từng mục test
- Liệt kê file đã tạo (tree)
- Tổng số dòng code (wc -l)
- Bất kỳ vấn đề nào phát hiện

Sau đó cập nhật README.md mục "Known Issues" nếu có gì cần lưu ý.

Báo cáo và chờ xác nhận.
```

---

## PROMPT 10 — Final review + tổng kết

```
B13. Tổng kết dự án.

Thực hiện:
1. Đi qua checklist mục 15 CLAUDE.md (Checklist chất lượng), tick từng mục:
   - [ ] Không có hardcode URL Apps Script / Cloudinary trong file ngoài config.js
   - [ ] Tất cả 15 form render được không lỗi console
   - [ ] Header trong Google Sheets test giống nguyên văn mục 4-5
   - [ ] STT và Ngày khảo sát do server gán
   - [ ] GPS có fallback khi user từ chối
   - [ ] Ảnh được nén trước upload
   - [ ] localStorage có dọn dẹp sau submit thành công
   - [ ] Test trên màn hình 360px width
   - [ ] Test offline → online sync
   - [ ] SETUP.md đầy đủ

2. Cập nhật README.md với:
   - Link demo (sẽ là https://<user>.github.io/khao-sat-chieu-sang sau deploy)
   - Bảng 15 loại khảo sát
   - Section "Cách dùng cho KTV" 5 bước
   - Section "Known Issues" nếu có

3. Tạo file CHANGELOG.md với phiên bản 1.0.0 ngày hôm nay, liệt kê features.

4. In ra cây thư mục cuối cùng (tree).

5. In ra "NEXT STEPS" cho user — chính xác cần làm gì để go-live:
   - Bước 1: Tạo Google Sheets theo SETUP.md mục A
   - Bước 2: Apps Script theo SETUP.md mục B  
   - Bước 3: Cloudinary theo mục C
   - Bước 4: Điền config.js
   - Bước 5: git add, commit, push
   - Bước 6: Settings → Pages → Source branch main
   - Bước 7: Mở URL, test trên điện thoại

Báo cáo "🎉 Hoàn tất dự án" và liệt kê tất cả file đã tạo + ngắn gọn mô tả mỗi file.
```

---

## PROMPT BỔ SUNG — Khi cần sửa/thêm

### Prompt khi muốn thêm 1 loại khảo sát mới

```
Tôi muốn thêm 1 loại khảo sát mới: "Sửa chữa móng trụ" (key: sua_mong).
Trường: [liệt kê các trường y như format mục 5 CLAUDE.md].
Sheet name trong Google Sheets: "17. Sua mong".

Yêu cầu:
1. Cập nhật CLAUDE.md mục 4 (thêm vào bảng) và mục 5 (thêm schema 5.16)
2. Cập nhật apps-script/Code.gs SHEET_MAP
3. Cập nhật js/schemas.js
4. Tạo sheet mới trong Google Sheets (hướng dẫn tôi làm thủ công)
5. Không thay đổi file khác.

Sau khi xong báo cáo.
```

### Prompt khi muốn đổi UX/UI

```
Tôi muốn thay đổi UI:
- [mô tả thay đổi cụ thể]

Phạm vi ảnh hưởng: chỉ js/form-renderer.js + css/style.css (KHÔNG đụng schema, KHÔNG đụng Apps Script, KHÔNG đụng config).

Sau khi xong test lại như Prompt 9 nhưng chỉ phần UI.
```

### Prompt khi gặp bug

```
Khi tôi submit form "Thay trụ", gặp lỗi: [paste log từ console hoặc Apps Script Executions].

Yêu cầu:
1. Phân tích nguyên nhân
2. Đề xuất fix (chưa code)
3. Sau khi tôi OK mới sửa

KHÔNG đoán mò, KHÔNG sửa rộng. Chỉ fix đúng bug.
```

### Prompt khi muốn thêm tính năng đăng nhập (tương lai)

```
Hiện tại app không có đăng nhập. Tôi muốn thêm Google Login để mỗi KTV phải đăng nhập trước khi submit, và "Người khảo sát" auto lấy từ email Google.

Yêu cầu thiết kế (CHƯA code):
- Cách integrate Google Identity Services
- Ảnh hưởng đến luồng offline (làm sao biết user khi offline)?
- Có cần whitelist email nhân viên LAVIPCO không?
- Tác động đến Apps Script (có cần verify token không)?

Trả lời thiết kế trước, sau khi tôi duyệt mới code.
```

---

## CHIẾN LƯỢC SỬ DỤNG

### Nếu dùng Claude Code (CLI trong terminal)
- Mỗi prompt = 1 message. Đợi Claude làm xong rồi mới gửi prompt tiếp.
- Claude Code tự tạo file, bạn không cần copy paste code.
- Sau Prompt 10, repo đã sẵn sàng — chỉ cần config + push.

### Nếu dùng Claude.ai (web)
- Trong message Prompt 0, upload kèm `CLAUDE.md` + `khao_sat_tang_cuong_den.xlsx`.
- Các prompt sau không cần upload lại (Claude nhớ context trong cùng chat).
- Sau mỗi prompt, Claude trả về code/file → bạn copy paste vào repo local.
- Nếu chat quá dài, có thể bị giới hạn → bắt đầu chat mới và upload lại CLAUDE.md + những file đã tạo.

### Quy tắc vàng
1. **Luôn xác nhận checkpoint** trước khi cho Claude làm tiếp. Đừng để Claude làm 1 mạch B1→B13 — dễ sai và khó debug.
2. **Đọc code trước khi commit** — Claude có thể bịa, đặc biệt với lookups (102 phường / 903 TĐK).
3. **Test ngay sau mỗi bước**:
   - Sau B3 (Apps Script): paste vào script.google.com, thử chạy doPost với mock data.
   - Sau B5 (schemas): in `console.log(SCHEMAS)` trong browser console.
   - Sau B7 (renderer): mở `form.html?type=tang_cuong_den` xem có render đúng không.
4. **Nếu Claude tự ý thêm tính năng không có trong CLAUDE.md** — yêu cầu xoá đi. Giữ scope.
5. **Backup mỗi checkpoint**: commit Git sau mỗi prompt thành công, dễ rollback.

---

## CÁCH XỬ LÝ KHI CLAUDE HIỂU SAI

Nếu Claude bắt đầu code lệch yêu cầu, gửi prompt sửa lỗi NGẮN:

```
DỪNG. Bạn đang làm sai mục [X]. Đọc lại CLAUDE.md mục [Y] và sửa lại.
Cụ thể: [chỉ rõ chỗ sai và phải làm gì].
```

Hoặc nếu Claude bịa dữ liệu:

```
Bạn đang bịa danh sách phường. Mở file khao_sat_tang_cuong_den.xlsx 
sheet "Phường-Xã 2025" và đọc THỰC TẾ từ row 5. 
In ra 10 mục đầu để tôi verify trước khi tiếp tục.
```

---

**Hết.** Lưu file này lại để dùng dài hạn. Khi cần redo project hoặc onboard người khác, chỉ cần đưa `CLAUDE.md` + `PROMPTS.md` này là đủ.
