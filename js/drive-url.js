// js/drive-url.js — Đổi link ảnh Google Drive sang link HIỂN THỊ được.
//
// Ảnh khảo sát lưu trong Sheets dạng https://drive.google.com/uc?export=view&id=<ID>.
// Từ 2026 Google chặn nhúng kiểu link này: <img> không hiện, fetch() lỗi CORS — biên bản mất ảnh,
// phải nhờ Apps Script lấy hộ (4–23 s/ảnh, có lúc hỏng). Link lh3 dưới đây hiện được, tải được
// trực tiếp (có CORS), ~0,4 s/ảnh — đo trên ảnh thật 30/09/2026.
// CHỈ dùng khi hiển thị / xuất file. Giá trị lưu trong Sheets giữ nguyên link gốc.

const DRIVE_ID = /drive\.google\.com\/(?:uc\?(?:[^#]*&)?id=|thumbnail\?(?:[^#]*&)?id=|file\/d\/|open\?(?:[^#]*&)?id=)([a-zA-Z0-9_-]{10,})/;

export function driveViewUrl(url) {
  const m = String(url || '').match(DRIVE_ID);
  return m ? `https://lh3.googleusercontent.com/d/${m[1]}=w1600` : String(url || '');
}
