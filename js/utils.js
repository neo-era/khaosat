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
  div.className = `fixed bottom-4 left-1/2 -translate-x-1/2 px-4 py-3 rounded-lg shadow-lg text-white text-sm font-medium z-50 ${colors[type] || colors.info}`;
  div.style.maxWidth = '90vw';
  div.textContent = message;
  document.body.appendChild(div);
  setTimeout(() => {
    div.style.transition = 'opacity 0.3s';
    div.style.opacity = '0';
    setTimeout(() => div.remove(), 300);
  }, duration);
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
