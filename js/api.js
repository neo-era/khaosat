// js/api.js — Wrapper 7 endpoint Apps Script + Cloudinary upload + offline queue sync.

import { CONFIG } from './config.js';
import { compressImage } from './camera.js';
import { getToken, getQueue, removeFromQueue } from './storage.js';

/**
 * POST text/plain (tránh CORS preflight). Trả parsed JSON.
 * @throws Error nếu response.ok=false hoặc network fail.
 */
async function postJson(body) {
  const res = await fetch(CONFIG.appsScriptUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || 'Server error');
  return json;
}

/** Lấy token từ storage, throw nếu chưa login. */
function requireToken() {
  const auth = getToken();
  if (!auth || !auth.token) throw new Error('Chưa đăng nhập');
  return auth.token;
}

// ===== Auth =====

export async function apiLogin(username, password) {
  return postJson({ action: 'login', username, password });
}

// ===== CRUD bản ghi =====

export async function apiSubmit(type, data, photos = []) {
  return postJson({
    action: 'submit',
    token: requireToken(),
    type, data, photos,
    ua: navigator.userAgent
  });
}

export async function apiList({ type, username, stt, from, to, includeDeleted, status } = {}) {
  return postJson({
    action: 'list',
    token: requireToken(),
    type, username, stt, from, to, includeDeleted, status
  });
}

/** Sửa bản ghi (admin/user role có quyền edit). photos=undefined → giữ nguyên; photos=[urls] → ghi đè. */
export async function apiUpdate(type, stt, data, photos) {
  return postJson({
    action: 'update',
    token: requireToken(),
    type, stt, data, photos
  });
}

export async function apiDelete(type, stt) {
  return postJson({ action: 'delete', token: requireToken(), type, stt });
}

export async function apiRestore(type, stt) {
  return postJson({ action: 'restore', token: requireToken(), type, stt });
}

// ===== Báo cáo / KPI =====

export async function apiKpi(month) {
  return postJson({ action: 'kpi', token: requireToken(), month });
}

export async function apiReport({ types, from, to, usernames, status, groupBy } = {}) {
  return postJson({
    action: 'report',
    token: requireToken(),
    types, from, to, usernames, status, groupBy
  });
}

/** Xuất raw rows theo đúng cấu trúc cột của từng sheet — cho Vùng D báo cáo. */
export async function apiExportRaw({ types, from, to, usernames, status } = {}) {
  return postJson({
    action: 'export_raw',
    token: requireToken(),
    types, from, to, usernames, status
  });
}

/** Trả danh sách user. Mặc định chỉ active=TRUE. Truyền {includeInactive: true} để xem cả disabled (cho users.html). */
export async function apiUsers({ includeInactive } = {}) {
  return postJson({
    action: 'users',
    token: requireToken(),
    include_inactive: includeInactive === true
  });
}

/** Tạo user mới (chỉ users_manage). */
export async function apiUserCreate({ username, password, full_name, role, active }) {
  return postJson({
    action: 'user_create',
    token: requireToken(),
    username, password, full_name, role, active
  });
}

/** Sửa user (full_name/role/active). Username KHÔNG đổi. */
export async function apiUserUpdate({ username, full_name, role, active }) {
  return postJson({
    action: 'user_update',
    token: requireToken(),
    username, full_name, role, active
  });
}

// ===== Tài liệu tham khảo =====

export async function apiDocsList() {
  return postJson({ action: 'docs_list', token: requireToken() });
}

export async function apiDocsCreate({ title, url, category, description }) {
  return postJson({
    action: 'docs_create',
    token: requireToken(),
    title, url, category, description
  });
}

export async function apiDocsDelete(id) {
  return postJson({ action: 'docs_delete', token: requireToken(), id });
}

// ===== Lịch công tác =====

export async function apiScheduleList({ from, to, ktv_username, status, loai_ks } = {}) {
  return postJson({
    action: 'schedule_list',
    token: requireToken(),
    from, to, ktv_username, status, loai_ks
  });
}

export async function apiScheduleCreate(items) {
  return postJson({
    action: 'schedule_create',
    token: requireToken(),
    items
  });
}

export async function apiScheduleUpdate(id, fields) {
  return postJson({
    action: 'schedule_update',
    token: requireToken(),
    id, fields
  });
}

export async function apiScheduleDelete(id) {
  return postJson({ action: 'schedule_delete', token: requireToken(), id });
}

/** Reset password user (chỉ admin/role có users_manage). */
export async function apiResetPassword(username, new_password) {
  return postJson({
    action: 'reset_password',
    token: requireToken(),
    username,
    new_password
  });
}

// ===== Cloudinary upload =====

/**
 * Upload 1 ảnh (đã nén) lên Cloudinary unsigned preset.
 * @param {File} file
 * @param {string} surveyType - subfolder
 * @returns {Promise<string>} secure_url
 */
export async function uploadImage(file, surveyType) {
  const blob = await compressImage(file);
  const formData = new FormData();
  formData.append('file', blob, file.name.replace(/\.\w+$/, '.jpg'));
  formData.append('upload_preset', CONFIG.cloudinaryPreset);
  formData.append('folder', `khaosat/${surveyType}`);
  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CONFIG.cloudinaryName}/image/upload`,
    { method: 'POST', body: formData }
  );
  if (!res.ok) {
    const txt = await res.text();
    throw new Error('Cloudinary upload fail: ' + txt);
  }
  const json = await res.json();
  if (!json.secure_url) throw new Error('Cloudinary không trả secure_url');
  return json.secure_url;
}

// ===== Offline queue sync =====

/**
 * Retry tất cả submission trong queue. Item thành công sẽ bị xoá.
 * @returns {Promise<{success: number, failed: number}>}
 */
export async function syncQueue() {
  if (!navigator.onLine) return { success: 0, failed: 0, skipped: true };
  const queue = getQueue();
  let success = 0, failed = 0;
  for (const item of queue) {
    try {
      // Cập nhật token mới nếu cũ đã hết hạn
      const auth = getToken();
      if (!auth) { failed++; continue; }
      const payload = { ...item.payload, token: auth.token };
      await postJson(payload);
      removeFromQueue(item.id);
      success++;
    } catch (e) {
      failed++;
    }
  }
  return { success, failed };
}
