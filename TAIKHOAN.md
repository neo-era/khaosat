# TÀI KHOẢN & MẬT KHẨU — Sổ tay quản trị

> Tài liệu gộp mọi thứ liên quan đến đăng nhập, tài khoản, mật khẩu, phân quyền.
> Cập nhật 2026-08-16. Xem thêm: `SETUP.md` (cài đặt), `CLAUDE.md` mục 7.1 (kỹ thuật).

---

## 1. Tra nhanh — "Tôi muốn làm X"

| Muốn làm gì | Làm thế nào |
|---|---|
| Thêm KTV mới | `users.html` → **+ Thêm user** |
| KTV quên mật khẩu | `users.html` → nút **🔑 PWD** → đặt mật khẩu tạm → nhắn riêng |
| Đổi mật khẩu của chính mình | Đăng nhập → trang **Đổi mật khẩu** |
| Cho nghỉ việc / khoá tài khoản | `users.html` → **🚫 Vô hiệu** (đừng xoá dòng — mất lịch sử KPI) |
| Đổi vai trò (KTV → quản lý) | `users.html` → **Sửa** → chọn vai trò |
| Đổi mật khẩu cho **tất cả** | Apps Script → chạy `resetAllPasswords()` |
| Đá văng mọi phiên đăng nhập | Apps Script → đổi `AUTH_SALT` trong Thuộc tính tập lệnh |
| Xem ai đang phải đổi mật khẩu | `users.html` → cột Trạng thái, nhãn ⚠ *phải đổi MK* |

---

## 2. Mật khẩu nằm ở đâu

**Không nằm trong Google Sheets.** Đây là điểm quan trọng nhất của tài liệu này.

```
Google Sheets, sheet `taikhoan`  ←  DANH BẠ (mở file là thấy)
   username | full_name | role | active | created_at

Apps Script, Thuộc tính tập lệnh  ←  MẬT KHẨU (chỉ người mở được editor thấy)
   CRED_admin = {"v":1,"salt":"6e27f8…","hash":"bf08f3…","iters":100,
                 "must_change":true,"updated_at":"2026-08-16 09:30:00"}
```

Mật khẩu **chỉ lưu dạng băm một chiều**, không lưu chữ thật. Kể cả anh — người có toàn quyền — mở Thuộc tính tập lệnh ra cũng **không đọc ngược được** mật khẩu của KTV. Đó là chủ đích: anh đặt mật khẩu *tạm*, KTV tự đặt mật khẩu *riêng*.

### Vì sao phải đổi (sự cố 2026-08-16)

Ba lỗi xảy ra cùng lúc:

1. Cột `password_hash` nằm ngay trong sheet `taikhoan` — ai mở được file là thấy hết.
2. Sheet đó **bị publish ra internet** qua URL CSV → tải về được tự do, không cần đăng nhập.
3. `SETUP.md` trong repo **public trên GitHub** ghi thẳng mật khẩu thật của 10 tài khoản.

⇒ Bất kỳ ai cũng đăng nhập được quyền admin.

Đã khắc phục hết. Nhưng **git history vẫn còn mật khẩu cũ, không xoá được** — đó là lý do bắt buộc đổi toàn bộ mật khẩu chứ không chỉ sửa file.

---

## 3. Bốn vai trò

| Vai trò | Ai dùng | Nhập KS | Xoá | Sửa | KPI | Quản lý | Báo cáo | Quản lý user |
|---|---|---|---|---|---|---|---|---|
| `admin` | Quản lý văn phòng | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `user` | Quản lý phụ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ |
| `user1` | **KTV hiện trường** | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| `demo` | Xem thử / đào tạo | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |

Bảng quyền đọc từ sheet **`phan quyen`** lúc chạy, cache 60 giây — anh tick/bỏ tick trong sheet là có hiệu lực trong vòng 1 phút, không cần sửa code.

> Frontend cũng có bảng quyền riêng để ẩn/hiện menu, nhưng **server mới là nơi quyết định**. Người dùng có mở devtools sửa gì cũng không lách được.

---

## 4. Luồng mật khẩu

### Khi tạo user mới hoặc reset

```
Anh đặt mật khẩu TẠM
      ↓
KTV đăng nhập bằng mật khẩu tạm
      ↓
App CHẶN mọi trang, đẩy sang "Đổi mật khẩu"    ← không vào được index.html
      ↓
KTV đặt mật khẩu RIÊNG (≥8 ký tự, khác tên đăng nhập)
      ↓
Vào app bình thường. Anh không biết mật khẩu này.
```

Cờ `must_change` làm việc chặn đó. `users.html` hiện nhãn ⚠ *phải đổi MK* cho những người chưa đổi.

### Quy tắc mật khẩu (server kiểm, không tin client)

- Tối thiểu **8 ký tự**
- Không trùng tên đăng nhập
- Mật khẩu mới phải khác mật khẩu hiện tại
- **Khuyến nghị thực tế**: ≥10 ký tự, có chữ hoa + số. Mỗi người một mật khẩu riêng — đừng dùng chung một tài khoản `user1` cho cả tổ, vì như vậy mất dấu vết ai làm gì và KPI cũng sai.

---

## 5. Đăng nhập

| | |
|---|---|
| Phiên kéo dài | **8 tiếng** |
| Lưu ở đâu | `sessionStorage` — **mất khi đóng tab**, đóng rồi mở lại phải đăng nhập lại |
| Sai mật khẩu 5 lần | Khoá tài khoản đó **5 phút** |
| Tài khoản `active = FALSE` | Từ chối đăng nhập ngay |

Token là chuỗi ký tự có chữ ký, máy chủ **không lưu** danh sách token. Hệ quả cần biết:

- **Đổi mật khẩu KHÔNG đá văng phiên đang mở.** Token cũ vẫn sống tới khi hết 8 tiếng.
- Muốn đá văng ngay lập tức mọi người: đổi `AUTH_SALT`.
- Khoá tài khoản (`active=FALSE`) thì chặn được ngay, vì mỗi lần gọi API server đều đọc lại trạng thái từ sheet.

---

## 6. Hai chuỗi bí mật — đừng nhầm

Cả hai nằm trong **Apps Script → Cài đặt dự án → Thuộc tính tập lệnh**. Không bao giờ đưa vào git, không gửi qua tin nhắn.

| Chuỗi | Dùng để | Đổi nó thì sao |
|---|---|---|
| `AUTH_SALT` | Ký token đăng nhập | Mọi người **đăng nhập lại**. Mật khẩu vẫn nguyên. |
| `PWD_PEPPER` | Băm mật khẩu | **Mọi mật khẩu ngừng hoạt động** → phải chạy `resetAllPasswords()` |

Tách riêng để làm việc nào ra việc đó: muốn đá văng phiên (việc nhẹ) thì không phải đặt lại mật khẩu cho cả tổ (việc nặng).

`PWD_PEPPER` chưa đặt thì hệ thống tự dùng `AUTH_SALT` — app vẫn chạy, chỉ mất cái tiện lợi ở bảng trên.

### Tạo `PWD_PEPPER`

Apps Script → chọn hàm **`taoPwdPepper`** → ▶ Run. Xong.

Không phải gõ, không phải copy chuỗi đi đâu — nó sinh ra và nằm luôn trong Thuộc tính tập lệnh.

> **Đừng tự sinh chuỗi rồi dán vào.** Chrome nay chặn dán code vào Console (bắt gõ `allow pasting`) — cảnh báo đó là đúng, đừng vượt qua. Và chuỗi bí mật đi qua clipboard hay tin nhắn thì coi như đã lộ.

Hàm **từ chối ghi đè** nếu đã có, vì ghi đè làm hỏng mọi mật khẩu.

---

## 7. Các hàm chạy tay trong Apps Script

Chọn tên hàm ở dropdown trên thanh công cụ → bấm ▶ Run → xem **Execution log**.

| Hàm | Việc | Khi nào chạy |
|---|---|---|
| `taoPwdPepper()` | Sinh chuỗi bí mật băm mật khẩu | 1 lần, **trước** `resetAllPasswords()` |
| `resetAllPasswords()` | Đặt mật khẩu tạm cho **toàn bộ** user + xoá cột `password_hash` khỏi sheet | Khi nghi mật khẩu bị lộ diện rộng |
| `setPasswordThuCong()` | Đặt mật khẩu cho **1 user** (sửa 2 biến trong hàm rồi chạy) | Khi `users.html` không vào được |
| `benchmarkHash()` | Đo tốc độ băm | Tuỳ chọn, khi muốn chỉnh `PWD_ITERS` |
| `validateSheets()` | Kiểm header 16 sheet khảo sát | Khi nghi sheet bị sửa nhầm |
| ~~`migrateTaikhoan()`~~ | **Đã lỗi thời** — chạy sẽ báo lỗi có hướng dẫn | Không dùng nữa |

### `resetAllPasswords()` làm gì

1. Sinh mật khẩu tạm 12 ký tự cho từng user (bỏ ký tự dễ nhìn nhầm `0 O l 1 I`)
2. Ghi vào Thuộc tính tập lệnh, kèm cờ bắt đổi lần đầu
3. **Xoá hẳn cột `password_hash`** khỏi sheet `taikhoan`
4. In bảng `username / mật khẩu tạm` ra Execution log

> Mật khẩu tạm chỉ hiện **một lần** trong log. Copy, nhắn **riêng** cho từng người (đừng đăng lên nhóm), rồi thôi.

---

## 8. Kỹ thuật — cách mật khẩu được bảo vệ

Phần này để tham khảo, không cần thao tác gì.

| | Cũ (đến 08/2026) | Hiện tại |
|---|---|---|
| Nơi lưu | cột trong Google Sheets | Script Properties |
| Cách băm | SHA-256, **1 vòng** | HMAC-SHA256, lặp **100 vòng** |
| Salt | **chung** 1 cái cho mọi người | **riêng** 32 ký tự mỗi người |

**Salt riêng** khiến hai người đặt trùng mật khẩu vẫn ra kết quả khác nhau — kẻ tấn công không thể dò một lần rồi mở nhiều tài khoản.

**Lặp 100 vòng** khiến mỗi lần thử một mật khẩu tốn gấp 100 lần thời gian.

Chi phí băm **chỉ trả lúc đăng nhập**. Submit form, chụp ảnh, xem KPI, xuất báo cáo đều đi qua token — không băm lần nào, nên không có thao tác nào bị chậm.

Muốn chắc hơn: nâng `PWD_ITERS` (đầu section CREDENTIAL STORE trong `Code.gs`) lên 500–1000. Bản ghi cũ vẫn dùng được vì mỗi bản ghi tự nhớ số vòng của nó.

---

## 9. Xử lý sự cố

| Tình huống | Cách xử lý |
|---|---|
| KTV quên mật khẩu | `users.html` → 🔑 PWD → đặt tạm → nhắn riêng |
| KTV bị khoá do sai 5 lần | Đợi 5 phút, tự mở |
| Nghi 1 mật khẩu bị lộ | 🔑 PWD đặt lại cho riêng người đó |
| Nghi nhiều mật khẩu bị lộ | `resetAllPasswords()` |
| Nghi `AUTH_SALT` bị lộ | Đổi trong Thuộc tính tập lệnh → mọi người đăng nhập lại |
| Nghi `PWD_PEPPER` bị lộ | Xoá, chạy `taoPwdPepper()`, rồi **bắt buộc** `resetAllPasswords()` |
| Nhân viên nghỉ việc | 🚫 Vô hiệu. **Đừng xoá dòng** — mất lịch sử KPI |
| `users.html` báo ⛔ *chưa có MK* | Người này được thêm thẳng vào sheet nhưng chưa có mật khẩu → bấm 🔑 PWD |
| Không vào được `users.html` | Chỉ vai trò `admin` mới vào được (quyền `users_manage`) |

Mọi thao tác tài khoản đều ghi vào sheet **`Audit`**: ai làm, làm gì, lúc nào. Mật khẩu **không bao giờ** được ghi vào log.

---

## 10. Việc cần làm định kỳ

- **Hàng tuần**: liếc qua Apps Script → Executions, xem có nhiều lần đăng nhập thất bại bất thường không.
- **Khi có người nghỉ việc**: vô hiệu hoá tài khoản ngay trong ngày.
- **Không bao giờ**: ghi mật khẩu thật vào file trong repo, vào commit message, hay publish Google Sheets ra web.
- **Cân nhắc**: chuyển repo GitHub sang Private — cách rẻ nhất để URL Apps Script không nằm công khai.
