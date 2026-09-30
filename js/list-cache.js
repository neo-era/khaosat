// js/list-cache.js — Lưu danh sách lần tải trước trên máy để HIỆN NGAY khi mở trang (user chốt 2026-09-30).
// Máy chủ Apps Script "ngủ" thì lệnh đầu mất ~20 s: trang trắng + "Đang tải…" rất lâu. Hiện bản đã lưu
// trước, máy chủ trả về thì thay. Không import gì để test Node nạp trực tiếp.

const PREFIX = 'list_cache:';

const MAX_ROWS = 500;   // chặn phình: localStorage đầy thì bản nháp form / hàng chờ offline không lưu được

export function saveListCache(key, rows) {
  try {
    // Đăng nhập kiểu "không ghi nhớ" (máy mượn, token ở sessionStorage) → không để dữ liệu lại trên máy
    if (!localStorage.getItem('auth')) return;
    localStorage.setItem(PREFIX + key, JSON.stringify({ at: Date.now(), rows: (rows || []).slice(0, MAX_ROWS) }));
  } catch (e) { /* hết chỗ / chế độ riêng tư: bỏ qua, lần sau tải từ máy chủ như thường */ }
}

/** @returns {{at:number, rows:Array}|null} */
export function readListCache(key) {
  try {
    const c = JSON.parse(localStorage.getItem(PREFIX + key));
    return c && Array.isArray(c.rows) ? c : null;
  } catch (e) {
    return null;
  }
}

/** Đăng xuất → xoá hết danh sách đã lưu (máy dùng chung không để lộ dữ liệu người trước). */
export function clearListCaches() {
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && k.indexOf(PREFIX) === 0) localStorage.removeItem(k);
    }
  } catch (e) { /* bỏ qua */ }
}

/** Ngày yyyy-MM-dd theo giờ Việt Nam (UTC+7) — máy chủ lọc Submitted At theo cùng mốc. */
function vnDate(v) {
  const t = new Date(v).getTime();
  return isNaN(t) ? '' : new Date(t + 7 * 3600000).toISOString().slice(0, 10);
}

/**
 * Gộp bản lưu cũ với kết quả mới của khoảng [from, to]: phần trong khoảng lấy hết từ kết quả mới
 * (bản đã xoá/sửa trên máy chủ không còn sót), phần ngoài khoảng giữ lại. Dòng ngày hỏng (vd "(imported)")
 * máy chủ luôn trả kèm → không giữ từ bản cũ, tránh nhân đôi. Mới nhất trước, tối đa MAX_ROWS dòng.
 */
export function mergeCache(oldRows, freshRows, from, to) {
  const keep = (oldRows || []).filter(r => {
    const d = vnDate(r['Submitted At']);
    return d && ((from && d < from) || (to && d > to));
  });
  return keep.concat(freshRows || [])
    .sort((a, b) => String(b['Submitted At']).localeCompare(String(a['Submitted At'])))
    .slice(0, MAX_ROWS);
}

/** Lọc bản đã lưu theo khoảng ngày đang chọn trên trang (from/to dạng yyyy-MM-dd, rỗng = không giới hạn). */
export function filterByRange(rows, from, to) {
  return (rows || []).filter(r => {
    const d = vnDate(r['Submitted At']);
    if (!d) return !from && !to;
    return (!from || d >= from) && (!to || d <= to);
  });
}
