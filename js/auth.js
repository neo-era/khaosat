// js/auth.js — Phân quyền + session.
// PERMISSIONS đồng bộ với DEFAULT_PERMISSIONS trong apps-script/Code.gs.
// Server vẫn là source of truth — frontend dùng map này chỉ để hide/show UI.

import { apiLogin, apiRefresh } from './api.js';
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
    role: t.role,
    must_change: t.must_change === true
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

// Token còn dưới ngưỡng này thì tự gia hạn khi mở trang (gia hạn trượt).
// Server cấp token 1 năm cho phiên "ghi nhớ", nên người dùng đều đặn không bao
// giờ bị đăng xuất; máy bỏ không quá 1 năm thì hết hạn thật.
const REFRESH_BEFORE_MS = 180 * 24 * 60 * 60 * 1000;  // 180 ngày

/**
 * Login → lưu token vào storage tuỳ remember.
 * @param {boolean} [remember=true] - true: localStorage (giữ phiên sau khi đóng
 *   trình duyệt, token 1 năm). false: sessionStorage, token 8 tiếng.
 * @returns {Promise<{username, full_name, role}>}
 * @throws Error với message hiển thị được cho user.
 */
export async function login(username, password, remember = true) {
  const res = await apiLogin(username, password, remember);
  saveToken({
    token: res.token,
    username: res.username,
    full_name: res.full_name,
    role: res.role,
    must_change: res.must_change === true,
    remember: res.remember === true,
    expires_at: res.expires_at
  }, res.remember === true);
  return {
    username: res.username,
    full_name: res.full_name,
    role: res.role,
    must_change: res.must_change === true
  };
}

/** Trang bắt buộc đổi mật khẩu — dùng chung để tránh gõ sai tên file. */
export const CHANGE_PWD_PAGE = 'doi-mat-khau.html';

/** Bỏ cờ must_change sau khi user đã đổi mật khẩu xong. */
export function clearMustChange() {
  const t = getToken();
  if (!t) return;
  saveToken(Object.assign({}, t, { must_change: false }));
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
  // Mật khẩu tạm do admin đặt → chặn mọi trang cho tới khi user tự đổi
  if (u.must_change && !location.pathname.endsWith(CHANGE_PWD_PAGE)) {
    location.replace(CHANGE_PWD_PAGE);
    throw new Error('redirecting to change password');
  }
  if (requiredAction && !can(u.role, requiredAction)) {
    location.replace('index.html');
    throw new Error('redirecting due to missing permission');
  }
  maybeRefreshToken();   // fire-and-forget, không chặn render trang
  return u;
}

/**
 * Gia hạn token nếu sắp hết hạn. Gọi ngầm ở mỗi trang qua requireAuth().
 * Thất bại thì im lặng: có thể chỉ là mất mạng tạm thời — không đá user ra
 * ngoài. Token thực sự hỏng/hết hạn sẽ bị getToken() hoặc request kế tiếp bắt.
 */
async function maybeRefreshToken() {
  const t = getToken();
  if (!t || !t.expires_at) return;
  if (t.expires_at - Date.now() > REFRESH_BEFORE_MS) return;
  try {
    const res = await apiRefresh(t.remember === true);
    saveToken(Object.assign({}, t, {
      token: res.token,
      expires_at: res.expires_at,
      full_name: res.full_name,
      role: res.role
    }), res.remember === true);
  } catch (e) { /* bỏ qua — xem doc ở trên */ }
}

/** Trang mặc định sau khi login theo role. */
export function defaultHomeFor(role) {
  return 'index.html';
}
