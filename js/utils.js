// js/utils.js — Helper chung: toast, format ngày, escape HTML, debounce, uuid, groupBy.

import { CONFIG } from './config.js';

/** Toast nổi góc dưới, auto-dismiss. */
export function showToast(message, type = 'success', duration = CONFIG.toastDefaultMs) {
  const colors = {
    success: 'bg-green-600',
    error:   'bg-red-600',
    warning: 'bg-yellow-600',
    info:    'bg-blue-600'
  };
  const div = document.createElement('div');
  div.className = `fixed bottom-4 left-1/2 -translate-x-1/2 px-4 py-3 rounded-lg shadow-lg text-white text-sm font-medium z-[1200] ${colors[type] || colors.info}`;
  div.style.maxWidth = '90vw';
  div.textContent = message;
  document.body.appendChild(div);
  setTimeout(() => {
    div.style.transition = 'opacity 0.3s';
    div.style.opacity = '0';
    setTimeout(() => div.remove(), 300);
  }, duration);
}

/**
 * URL an toàn để đặt vào href/src/window.open: chỉ nhận https://…, còn lại trả ''.
 * Chặn javascript:, data:, http:// … do dữ liệu bản ghi có thể bị sửa (v2.2.1).
 */
export function safeHref(url) {
  const u = String(url == null ? '' : url).trim();
  return /^https:\/\/[^\s"'<>]+$/i.test(u) ? u : '';
}

/**
 * Ngày 'yyyy-MM-dd' theo GIỜ MÁY (v2.3.0). Không dùng toISOString().slice(0,10): đó là ngày UTC,
 * từ 0h đến 7h sáng giờ VN sẽ ra ngày hôm trước.
 */
export function localDateStr(d = new Date()) {
  const x = d instanceof Date ? d : new Date(d);
  const p = n => String(n).padStart(2, '0');
  return x.getFullYear() + '-' + p(x.getMonth() + 1) + '-' + p(x.getDate());
}

/**
 * Ngày 'yyyy-MM-dd' (giờ VN) của 1 giá trị ngày từ Sheets: chuỗi 'yyyy-MM-dd HH:mm:ss' (giờ VN, lấy
 * nguyên), ISO có Z / Date (đổi sang giờ VN). Không đọc được → ''. (v2.3.0)
 */
export function vnDateKey(v) {
  if (v === null || v === undefined || v === '') return '';
  const s = String(v);
  if (/^\d{4}-\d{2}-\d{2}(?:[ ]\d{2}:\d{2}(?::\d{2})?)?$/.test(s)) return s.slice(0, 10);
  const t = new Date(v).getTime();
  return isNaN(t) ? '' : new Date(t + 7 * 3600e3).toISOString().slice(0, 10);
}

/** Escape HTML cho innerHTML an toàn. */
export function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** "26/05/2026 14:30:25" */
export function formatVnDate(d) {
  if (!d) return '';
  const x = (d instanceof Date) ? d : new Date(d);
  if (isNaN(x)) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(x.getDate())}/${pad(x.getMonth() + 1)}/${x.getFullYear()} ${pad(x.getHours())}:${pad(x.getMinutes())}:${pad(x.getSeconds())}`;
}

/** "26/05/2026" */
export function formatVnDateOnly(d) {
  if (!d) return '';
  const x = (d instanceof Date) ? d : new Date(d);
  if (isNaN(x)) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(x.getDate())}/${pad(x.getMonth() + 1)}/${x.getFullYear()}`;
}

/** "2026-05" */
export function monthKey(d) {
  const x = (d instanceof Date) ? d : new Date(d);
  if (isNaN(x)) return '';
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}`;
}

/** "2026-05-27" */
export function dateKey(d) {
  const x = (d instanceof Date) ? d : new Date(d);
  if (isNaN(x)) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`;
}

/** Debounce: gọi fn sau wait ms kể từ lần invoke cuối. */
export function debounce(fn, wait = 300) {
  let timer = null;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), wait);
  };
}

/** UUID rút gọn 8 ký tự hex. */
export function uuid() {
  return Math.random().toString(36).slice(2, 6) + Math.random().toString(36).slice(2, 6);
}

/** groupBy(array, item => key) → { key: [items] } */
export function groupBy(arr, keyFn) {
  const out = {};
  for (const item of arr) {
    const k = keyFn(item);
    if (!out[k]) out[k] = [];
    out[k].push(item);
  }
  return out;
}

/** Sort tiếng Việt có dấu. */
export function vnSort(arr) {
  return [...arr].sort((a, b) => String(a).localeCompare(String(b), 'vi'));
}
