// js/file-name.js — Tên file xuất ra. Không import gì để test Node nạp trực tiếp.

/** Bỏ ký tự Windows không cho dùng trong tên file (\ / : * ? " < > |), gộp khoảng trắng. */
export function safeFileName(s) {
  return String(s || '').replace(/[\\/]/g, '-').replace(/[:*?"<>|]/g, '').replace(/\s+/g, ' ').trim();
}

/**
 * Biên bản sự cố: giống tên file mẫu user đang dùng — "BCSC Nguyễn Hữu Dật 1 10-12-2025" (chốt 2026-09-30).
 * @param {string} tu    Tủ điều khiển
 * @param {string} ngay  ngày phát hiện dạng dd/MM/yyyy
 */
export function bcscFileName(tu, ngay) {
  const name = ['BCSC', safeFileName(tu), String(ngay || '').replace(/\//g, '-').trim()].filter(Boolean).join(' ');
  return name === 'BCSC' ? 'BCSC su co' : name;
}
