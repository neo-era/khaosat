---
name: dev-loop
description: Quy trình làm 1 thay đổi trong dự án khaosat (SAPULICO) theo vòng — lập kế hoạch → viết test → code → tự review bằng góc nhìn mới → kiểm chứng → ghi nhớ → cải thiện. Dùng khi user giao việc thêm/sửa tính năng, form, trang, Code.gs ("làm tính năng X", "thêm form", "sửa lỗi", "/dev-loop", "làm theo quy trình").
---

# dev-loop — quy trình phát triển khaosat

Dự án: web app khảo sát chiếu sáng SAPULICO. Frontend tĩnh (GitHub Pages, nhánh `sub1`) + Google Apps Script (`apps-script/Code.gs`) + Google Sheets **đang chạy thật**. `CLAUDE.md` là nguồn chân lý. User (anh Lam Mai) giao tiếp tiếng Việt, không phải lập trình viên web — báo cáo bằng từ ngữ thực tế.

Làm ĐỦ 7 bước, theo thứ tự. Mỗi bước có "cửa ra" — chưa qua thì không sang bước sau.

---

## 1. Lập kế hoạch

1. Đọc: `CLAUDE.md` (mục liên quan), memory của dự án, `git status` + `git log --oneline -5`.
2. Tìm mọi chỗ bị ảnh hưởng — dùng Grep theo key/label, KHÔNG đoán. Lưu ý các danh sách viết tay theo từng loại: `SHEET_MAP`, `HEADERS`, `STT_PREFIX`, `GPS_*_TYPES` (Code.gs) · `SCHEMAS` (schemas.js) · `IMPORT_SHEET_MAP` (report.js) · `BBHT_MAP` (bbht.js) · danh sách cache `sw.js`.
3. **Phải hỏi user trước (AskUserQuestion, có phương án "(Khuyến nghị)")** khi:
   - thêm/đổi/bỏ **cột** hoặc **tên sheet** (dữ liệu sản xuất, header giữ NGUYÊN VĂN);
   - thêm **thư viện CDN** mới;
   - **ghi/sửa/xoá dữ liệu thật** trên Sheets (kể cả gửi bản thử);
   - danh mục nghiệp vụ (danh sách chọn, người ký, mẫu biên bản…) chưa có nguồn;
   - câu trả lời/ảnh của user mơ hồ ("để trống", ảnh không kèm chữ) — **"cái nào không hiểu phải hỏi lại"**.
   Lấy dữ liệu thật (chỉ đọc) để đề xuất cụ thể trước khi hỏi, thay vì hỏi chung chung.
4. Chốt: danh sách file sẽ sửa + tiêu chí "xong" (cái gì phải chạy được, đo bằng gì).

**Cửa ra:** user đã chốt mọi điểm mơ hồ; có tiêu chí xong đo được.

## 2. Viết test TRƯỚC

- Logic máy chủ / đồng bộ schema → thêm test vào `tests/*.test.mjs` (dùng `tests/_harness.mjs`: `loadGs()`, `addSurveySheet()`, `mkSheet()`, `rowObj()`, `plain()`, `loadSchemas()`).
- Chạy `node --test "tests/*.test.mjs"` → test mới phải **ĐỎ** (chứng minh nó bắt được thiếu sót) trước khi code.
- Giao diện → viết sẵn kịch bản kiểm chứng trình duyệt ở bước 5 (thao tác gì, kỳ vọng gì).

**Cửa ra:** có test đỏ cho logic mới (hoặc lý do rõ vì sao chỉ kiểm bằng trình duyệt).

## 3. Code

Quy ước bắt buộc của repo:
- Label trong `js/schemas.js` == `HEADERS[type]` trong Code.gs, đúng thứ tự (test `schema-sync` canh). Cột mới nối **cuối phần cột gốc**; sheet đang chạy dùng `capNhatCotSheet()`; sheet mới dùng `initSheets()`.
- STT là **chuỗi** (mã `<MÃ LOẠI>-yyMMdd-XXXX`): so sánh bằng `String()`, không `Number()`, luôn đi kèm `type`.
- Danh mục phường/quận import từ `js/dia-ban.js`, không từ `lookups.js`. `lookups.js` / `tdk-toado.js` là file TỰ SINH — không sửa tay.
- Xuất Excel qua `js/excel-export.js` (ExcelJS). SheetJS chỉ để đọc file.
- Sửa bất kỳ JS/HTML nào → tăng `CACHE_NAME` trong `sw.js`; file mới → thêm vào danh sách cache.
- Mobile-first: ô bấm ≥ 44px, không tràn ngang ở 375px.
- Comment tiếng Việt, giải thích **vì sao**, không kể lại code làm gì.

**Cửa ra:** test ở bước 2 chuyển XANH; `node --check` qua cho mọi file JS/GS đã sửa (copy sang `.mjs`/`.js` trong scratchpad để check).

## 4. Tự review bằng góc nhìn mới

Không tự chấm bài mình bằng trí nhớ đang có. Gọi **Agent (general-purpose)** với ngữ cảnh sạch:
- Đưa: `git diff`, các nguyên tắc ở mục 1 của CLAUDE.md, yêu cầu gốc của user (nguyên văn).
- Yêu cầu tìm: mất/ghi đè dữ liệu sản xuất, lệch schema ↔ HEADERS, tin dữ liệu client, lỗi múi giờ/ngày, dữ liệu cũ dạng khác (chữ trong ô số, STT số lẫn chữ), cache SW, mobile 375px, trường hợp mất mạng, quyền theo role.
- Mỗi phát hiện phải kèm tình huống cụ thể gây lỗi. Tự kiểm lại từng phát hiện trước khi sửa (reviewer có thể sai).

**Cửa ra:** mọi phát hiện đã được sửa hoặc ghi lý do bỏ qua.

## 5. Kiểm chứng

1. `node --test "tests/*.test.mjs"` — toàn bộ phải xanh.
2. **Thử phá**: với thay đổi quan trọng, cố tình làm hỏng code 1 chỗ → test phải đỏ → `git checkout -- <file>` khôi phục.
3. Trình duyệt (chrome-devtools), **không ghi Sheets thật**:
   - `python -m http.server <cổng MỚI mỗi lần>` (service worker + cache giữ JS cũ rất dai).
   - `navigate_page` kèm `initScript`: chặn `navigator.serviceWorker.register`; nạp sẵn `localStorage.auth`; bọc `window.fetch` trả JSON giả cho action ghi (`submit/update/delete/restore/set_status/sobbht_save/bulk_import`), cho qua action đọc nếu cần dữ liệu thật; giả GPS bằng cách ghi đè `navigator.geolocation.getCurrentPosition`.
   - `emulate` 375x667 mobile → kiểm `document.documentElement.scrollWidth === 375`, chụp màn hình.
   - Đổi mobile ↔ desktop bằng `emulate` sẽ TẢI LẠI trang → mất initScript → phải `navigate_page` lại.
   - File tải xuống: chặn `HTMLAnchorElement.prototype.click` + bắt blob qua `URL.createObjectURL` rồi đọc lại (ExcelJS có sẵn trên trang để mở file .xlsx vừa tạo).
4. Sau `git push`: chờ ~1 phút, `curl` file JS trên `https://neo-era.github.io/khaosat/...` để xác nhận đã lên.
5. Chỉ gửi dữ liệu thử lên Sheets thật khi user đồng ý; đặt tên dễ nhận ("TEST … xoá sau") và hỏi xoá sau đó.

**Cửa ra:** test xanh + đã thấy tận mắt tính năng chạy trên khổ điện thoại; ghi rõ cái gì CHƯA kiểm được.

## 6. Ghi nhớ

1. Cập nhật `CLAUDE.md` đúng mục (schema/endpoint/trang/quy ước) — ngắn, ghi ngày và lý do quyết định.
2. Memory của dự án: thay đổi đã làm, quyết định user đã chốt, **việc user còn phải làm** (dán Code.gs + triển khai lại bản đang chạy, chạy `initSheets()` / `capNhatCotSheet()` …). Không lưu mật khẩu.
3. Commit (message tiếng Việt không dấu, kèm dòng attribution theo system reminder) → `git push origin sub1`. Không commit file có dữ liệu/ảnh thật (repo PUBLIC).
4. Báo user: làm gì, đã kiểm thế nào (con số cụ thể), **anh cần làm gì ở Apps Script**, điểm còn chờ anh quyết.

## 7. Cải thiện

Sau mỗi vòng, tự hỏi: lỗi nào lọt tới bước 4–5 mà lẽ ra test ở bước 2 phải bắt? Bẫy nào tốn thời gian?
- Thêm test cho lỗi đó vào `tests/`.
- Thêm bẫy mới vào mục "Bẫy đã gặp" dưới đây (sửa chính file SKILL.md này).
- Góp ý của user về cách làm → memory dạng feedback.

---

## Bẫy đã gặp (cập nhật mỗi vòng)

- `node --test tests/` lỗi ở Node 24 → dùng glob: `node --test "tests/*.test.mjs"`.
- Mảng/object trả từ sandbox Code.gs khác "vùng" → `assert.deepEqual` báo lệch dù giống → bọc `plain()`.
- `js/*.js` là ES module nhưng repo không có `package.json` → `node --check` phải copy sang đuôi `.mjs`; import schemas trong test qua `loadSchemas()`.
- Python trên Windows không đọc được đường dẫn `/c/...`; script Python có nhiều dấu nháy → viết ra file bằng Write rồi chạy, đừng nhét vào heredoc.
- Excel đọc ngày dd/mm thành mm/dd (sổ BBHT cũ) → đối chiếu với dữ liệu khác trước khi tin ô ngày.
- Frontend lên web ngay khi push; **Apps Script KHÔNG** — mọi thay đổi Code.gs phải nhắc user dán + "Quản lý triển khai → sửa bản đang chạy → Phiên bản mới" (không "Triển khai mới": đổi URL).
- Form có giá trị mặc định (`default`) → không được tính là "đã nhập" (tự lưu nháp / hỏi "Bỏ form chưa lưu?").
- Ô số nhận dữ liệu cũ dạng chữ ("39m") → sửa bản ghi phải giữ nguyên giá trị cũ nếu không nhập lại.
- Đo tốc độ: `evaluate_script` chạy lâu (gọi Apps Script nhiều lần) bị timeout → chạy ngầm trong trang, ghi vào `window.__perf`, hỏi lại sau. Trang tự chuyển (hết phiên → login/index) làm mất biến → đo trên tab riêng không bị chuyển hướng.
- Sửa file bằng Python trong heredoc: chuỗi JS có `\n` (vd trong `confirm(...)`) bị biến thành xuống dòng thật → vỡ cú pháp. Đoạn có ký tự thoát thì dùng Edit tool; sau khi sửa luôn xem `git diff` + `node --check`.
- Tăng tốc bằng "hỏi trước, dùng lại kết quả": kiểm xem lúc dùng thật khoá hỏi có trùng được với lúc hỏi trước không (vd trường bắt buộc lúc Lưu luôn có → hỏi khi chưa có là phí). Kết quả hỏi phải bị xoá khi hết giờ chờ và sau khi lưu.
- CSS tự viết (`<style>`) cùng độ ưu tiên với class Tailwind CDN thì thắng Tailwind (Tailwind chèn vào `<head>` trước) → `.x{display:flex}` làm mất `hidden`, `.x{color}` đè `text-red-700`. Dùng class riêng (`.x.hidden`, `.x.danger`) và chụp màn hình kiểm màu.
- Nâng z-index 1 lớp (menu) thì rà mọi lớp nổi khác: nút tròn Hướng dẫn (900/950, help.js), toast (utils.js), modal — cái nào phải nằm trên thì nâng theo.
- Ghi âm (Web Speech): chữ tạm (interim) chỉ hiện ở dòng trạng thái, chưa vào ô → dừng/bấm Lưu sớm là mất, ô trống báo "Thiếu trường bắt buộc". Thử bằng lớp `SpeechRecognition` giả trong initScript (chỉ trả isFinal:false).
- **Xuất Word (.doc HTML)**: kiểm bằng Word THẬT — `New-Object -ComObject Word.Application` (máy có Word 16) → mở file → đếm `InlineShapes`, đọc `PageSetup` → `ExportAsFixedFormat(...pdf)` → Read file PDF (Read PDF không truyền `pages` thì mới hiện hình). Trình duyệt hiện đúng KHÔNG có nghĩa Word đúng. Word: bỏ qua `@page` thường (ra khổ Letter, lề 2,54 cm) → dùng `@page WordSection1` + `<div class="WordSection1">`; bỏ qua `height` của div/ô rỗng → chèn đoạn `&nbsp;`; bỏ qua CSS width của `<img>` → ghi `width/height` lên thẻ; không vẽ viền span/div → dùng viền ô bảng; ảnh `data:` thì Word 16 hiện được.
- **Ảnh Google Drive**: link `uc?export=view` không còn nhúng được (img lỗi, fetch lỗi CORS) → hiển thị/tải qua `driveViewUrl()` (lh3, no-referrer). lh3 trả 429 nếu tải dồn dập (thử đi thử lại nhiều lần) → đừng kết luận "hỏng" khi vừa thử liên tục; Apps Script cũng có lúc trả trang HTML/404 tạm thời.
- User báo lỗi đã sửa mà vẫn thấy → trước hết đối chiếu ảnh của user với bản MỚI (in thử bằng `chrome.exe --headless=new --print-to-pdf` từ trang tĩnh chụp lại, rồi Read PDF). Khớp bản cũ = máy user kẹt cache. `sw.js` cài bản mới phải dùng `cache: 'reload'` (GitHub Pages cho giữ HTTP cache 10 phút).
- Đo "lần mở đầu" phải dùng `new_page` với `isolatedContext` MỚI (bộ nhớ đệm trống) + `emulate` Fast 4G/CPU 4x; iframe trong trang cũ chỉ cho số "mở lại" (đã có cache). Máy dev có lúc tra DNS CDN mất ~6 s → đo 2 lần trước khi kết luận.
