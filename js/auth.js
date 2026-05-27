// js/auth.js — Phân quyền + session.
// PERMISSIONS đồng bộ với DEFAULT_PERMISSIONS trong apps-script/Code.gs.
// Server vẫn là source of truth — frontend dùng map này chỉ để hide/show UI.

import { apiLogin } from './api.js';
import { saveToken, getToken, clearToken } from './storage.js';

export const PERMISSIONS = {
  admin:  { submit: true,  delete: true,  kpi: true,  manage: true,  report: true,  edit: true,  users_manage: true,  schedule_write: true,  notify_admin: true,  map: true  },
  user:   { submit: true,  delete: true,  kpi: true,  manage: true,  report: true,  edit: true,  users_manage: false, schedule_write: true,  notify_admin: true,  map: true  },
  user1:  { submit: true,  delete: false, kpi: false, manage: false, report: false, edit: false, users_manage: false, schedule_write: false, notify_admin: false, map: true  },
  demo:   { submit: false, delete: false, kpi: false, manage: false, report: false, edit: false, users_manage: false, schedule_write: false, notify_admin: false, map: false }
};

export function can(role, action) {
  return !!(PERMISSIONS[role] && PERMISSIONS[role][action]);
}

export function isFullAccess(role) {
  return role === 'admin' || role === 'user';
}

/** Đọc user hiện tại từ storage, hoặc null. */
export function getCurrentUser() {
  const t = getToken();
  if (!t) return null;
  return {
    username: t.username,
    full_name: t.full_name,
    role: t.role
  };
}

/** Permission của user hiện tại. */
export function hasPermission(action) {
  const u = getCurrentUser();
  if (!u) return false;
  return can(u.role, action);
}

/** Header dùng cho fetch (POST body field). */
export function getAuthHeader() {
  const t = getToken();
  return t ? { token: t.token } : {};
}

/**
 * Login → lưu token vào storage tuỳ remember.
 * @returns {Promise<{username, full_name, role}>}
 * @throws Error với message hiển thị được cho user.
 */
export async function login(username, password, remember = true) {
  const res = await apiLogin(username, password);
  saveToken({
    token: res.token,
    username: res.username,
    full_name: res.full_name,
    role: res.role,
    expires_at: res.expires_at
  }, remember);
  return { username: res.username, full_name: res.full_name, role: res.role };
}

/** Clear token + redirect login. */
export function logout() {
  clearToken();
  location.replace('login.html');
}

/**
 * Route-guard gọi ở đầu mỗi trang.
 * @param {string} [requiredAction] - tên action (submit/delete/kpi/manage/report). Bỏ qua = chỉ check login.
 *
 * Behavior:
 * - Chưa login → redirect login.html
 * - Token hết hạn → clearToken + login.html
 * - Có login nhưng thiếu permission → redirect về trang phù hợp với role:
 *     admin/user → kpi.html
 *     user1 → index.html
 *     demo → index.html
 */
export function requireAuth(requiredAction) {
  const u = getCurrentUser();
  if (!u) {
    location.replace('login.html');
    throw new Error('redirecting to login');  // stop further script
  }
  if (requiredAction && !can(u.role, requiredAction)) {
    const home = isFullAccess(u.role) ? 'kpi.html' : 'index.html';
    location.replace(home);
    throw new Error('redirecting due to missing permission');
  }
  return u;
}

/** Trang mặc định sau khi login theo role. */
export function defaultHomeFor(role) {
  if (isFullAccess(role)) return 'kpi.html';
  return 'index.html';
}
