// js/storage.js — Wrapper localStorage + sessionStorage.
// Quản lý: draft form, queue offline submissions, today's records, auth token.

import { dateKey, uuid } from './utils.js';

// ===== Draft form =====

const DRAFT_PREFIX = 'draft_';

export function saveDraft(type, formData) {
  try {
    localStorage.setItem(DRAFT_PREFIX + type, JSON.stringify({ at: Date.now(), data: formData }));
  } catch (e) { /* storage full */ }
}

export function loadDraft(type) {
  try {
    const s = localStorage.getItem(DRAFT_PREFIX + type);
    if (!s) return null;
    return JSON.parse(s);
  } catch { return null; }
}

export function clearDraft(type) {
  localStorage.removeItem(DRAFT_PREFIX + type);
}

// ===== Queue offline submissions =====

const QUEUE_KEY = 'queue_submissions';

export function enqueueSubmission(payload) {
  const id = uuid();
  const queue = getQueue();
  queue.push({ id, payload, queued_at: Date.now() });
  try { localStorage.setItem(QUEUE_KEY, JSON.stringify(queue)); } catch {}
  return id;
}

export function getQueue() {
  try {
    const s = localStorage.getItem(QUEUE_KEY);
    return s ? JSON.parse(s) : [];
  } catch { return []; }
}

export function removeFromQueue(id) {
  const queue = getQueue().filter(item => item.id !== id);
  try { localStorage.setItem(QUEUE_KEY, JSON.stringify(queue)); } catch {}
}

export function clearQueue() {
  localStorage.removeItem(QUEUE_KEY);
}

// ===== Submitted records hôm nay =====

const TODAY_KEY = 'submitted_today';

export function saveSubmittedToday(record) {
  const today = dateKey(new Date());
  const list = getSubmittedToday();
  list.push({ ...record, _date: today, _at: Date.now() });
  try { localStorage.setItem(TODAY_KEY, JSON.stringify({ date: today, items: list })); } catch {}
}

export function getSubmittedToday() {
  try {
    const s = localStorage.getItem(TODAY_KEY);
    if (!s) return [];
    const obj = JSON.parse(s);
    // Auto-reset nếu sang ngày mới
    if (obj.date !== dateKey(new Date())) {
      localStorage.removeItem(TODAY_KEY);
      return [];
    }
    return obj.items || [];
  } catch { return []; }
}

// ===== Auth token =====
// Schema: { token, username, full_name, role, must_change, remember, expires_at }
//
// Nơi lưu tuỳ ô "Ghi nhớ đăng nhập" ở login.html:
//   remember = true  → localStorage  (còn sau khi đóng trình duyệt)
//   remember = false → sessionStorage (mất khi đóng tab — dùng khi mượn máy)
// Chỉ giữ token ở ĐÚNG MỘT nơi để không bị lệch phiên giữa 2 kho.

const TOKEN_KEY = 'auth';

/**
 * @param {object} obj
 * @param {boolean} [remember] - bỏ trống = giữ nguyên nơi đang lưu
 *   (dùng khi chỉ cập nhật token/cờ, không phải đăng nhập mới).
 */
export function saveToken(obj, remember) {
  try {
    const persist = remember === undefined
      ? localStorage.getItem(TOKEN_KEY) !== null
      : !!remember;
    const s = JSON.stringify(obj);
    if (persist) {
      localStorage.setItem(TOKEN_KEY, s);
      sessionStorage.removeItem(TOKEN_KEY);
    } else {
      sessionStorage.setItem(TOKEN_KEY, s);
      localStorage.removeItem(TOKEN_KEY);
    }
  } catch {}
}

export function getToken() {
  try {
    const s = sessionStorage.getItem(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY);
    if (!s) return null;
    const obj = JSON.parse(s);
    if (!obj || !obj.token) return null;
    if (obj.expires_at && Date.now() > obj.expires_at) {
      clearToken();
      return null;
    }
    return obj;
  } catch { return null; }
}

export function clearToken() {
  sessionStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(TOKEN_KEY);
}
