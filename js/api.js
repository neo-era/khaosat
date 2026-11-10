// js/api.js — Wrapper 7 endpoint Apps Script + Cloudinary upload + offline queue sync.

import { CONFIG } from './config.js';
import { compressImage } from './camera.js';
import { getToken, clearToken } from './storage.js';
import { showToast, uuid } from './utils.js';
import { beginBusy } from './sw-update.js';
import { kindOfServerError, classifyError, runSync, withLock } from './sync-core.js';
import { queueStore, migrateLegacy } from './offline-queue.js';

/**
 * POST text/plain (tránh CORS preflight). Trả parsed JSON.
 * @throws Error nếu response.ok=false hoặc network fail.
 */
// Lệnh chỉ đọc. Mọi lệnh khác là GHI → đang chạy thì không cho app tự tải lại (xem sw-update.js)
const READ_ACTIONS = ['login', 'refresh', 'list', 'kpi', 'report', 'users', 'docs_list', 'schedule_list',
                      'export_raw', 'photo_base64', 'check_dup', 'sobbht_list', 'hd_info'];

async function postJson(body) {
  const done = READ_ACTIONS.includes(body && body.action) ? () => {} : beginBusy();
  try {
    let res;
    try {
      res = await fetch(CONFIG.appsScriptUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(body)
      });
    } catch (e) {
      // v2.3.0: fetch bị từ chối = không tới được máy chủ (mất mạng) — gắn loại để xử lý đúng
      throw Object.assign(new Error(e && e.message || 'Mất mạng'), { kind: 'network', name: e && e.name || 'TypeError' });
    }
    if (!res.ok) {
      const kind = (res.status >= 500 || res.status === 429) ? 'temporary' : 'permanent';
      throw Object.assign(new Error('HTTP ' + res.status), { kind });
    }
    let json;
    try { json = await res.json(); }
    catch (e) { throw Object.assign(new Error('Máy chủ trả dữ liệu lỗi'), { kind: 'temporary' }); }
    if (!json.ok) {
      // v2.2.1: token cũ/đã đổi mật khẩu/hết hạn tuyệt đối → xoá phiên, về trang đăng nhập
      if (body && body.action !== 'login' && isSessionEndedError(json.error)) {
        clearToken();
        if (typeof location !== 'undefined' && !/login\.html$/.test(location.pathname)) {
          location.replace('login.html');
        }
      }
      throw Object.assign(new Error(json.error || 'Server error'), { kind: kindOfServerError(json.error) });
    }
    return json;
  } finally {
    done();
  }
}

/** Lỗi máy chủ nghĩa là phiên đăng nhập không còn dùng được (phải đăng nhập lại). */
export function isSessionEndedError(msg) {
  return /đăng nhập lại|invalid token|missing token|user disabled|user not found/i.test(String(msg || ''));
}

/**
 * Đánh thức máy chủ Apps Script ngay lúc mở app (user chốt 2026-09-30).
 * Lâu không ai dùng, Google cho script "ngủ": lệnh đầu tiên mất ~20 s (đo thật 19,9 s), sau đó 2–5 s.
 * Gọi doGet (chỉ trả {ok:true}, không đọc/ghi Sheets) để máy chủ khởi động trong lúc người dùng còn
 * bấm menu. no-cors: không cần đọc kết quả. Tối đa 1 lần / 3 phút cho khỏi gọi thừa.
 */
export function wakeServer() {
  try {
    const last = Number(localStorage.getItem('server_wake_at') || 0);
    if (Date.now() - last < 3 * 60 * 1000 || !navigator.onLine) return;
    localStorage.setItem('server_wake_at', String(Date.now()));
  } catch (e) { /* không có localStorage vẫn gọi */ }
  fetch(CONFIG.appsScriptUrl, { method: 'GET', mode: 'no-cors', cache: 'no-store' }).catch(() => {});
}

/** Lấy token từ storage, throw nếu chưa login. */
function requireToken() {
  const auth = getToken();
  if (!auth || !auth.token) throw new Error('Chưa đăng nhập');
  return auth.token;
}

// ===== Auth =====

export async function apiLogin(username, password, remember) {
  return postJson({ action: 'login', username, password, remember: remember === true });
}

/** Gia hạn token còn hiệu lực — không cần nhập lại mật khẩu. */
export async function apiRefresh(remember) {
  return postJson({ action: 'refresh', token: requireToken(), remember: remember === true });
}

// ===== CRUD bản ghi =====

/** extra: { client_id } (v2.3.0 — chống ghi trùng khi gửi lại). */
export async function apiSubmit(type, data, photos = [], extra = {}) {
  return postJson(Object.assign({
    action: 'submit',
    token: requireToken(),
    type, data, photos,
    ua: navigator.userAgent
  }, extra));
}

/** Hỏi server bản mới có thể trùng bản đã khảo sát trong 90 ngày không (chỉ cảnh báo). */
export async function apiCheckDup(type, { tuyen, phuong, lat, lng }) {
  return postJson({ action: 'check_dup', token: requireToken(), type, tuyen, phuong, lat, lng });
}

/** Sổ biên bản hiện trường (quyền report). */
export async function apiSobbhtList(from, to) {
  return postJson({ action: 'sobbht_list', token: requireToken(), from, to });
}
export async function apiSobbhtSave(items) {
  return postJson({ action: 'sobbht_save', token: requireToken(), items });
}
export async function apiSobbhtDelete(id) {
  return postJson({ action: 'sobbht_delete', token: requireToken(), id });
}

/** Đổi trạng thái xử lý cho 1 hoặc nhiều bản ghi cùng loại (quyền edit). */
/**
 * Thông tin hợp đồng duy tu (app Quản lý HĐ đẩy sang): gói / KL HĐ còn lại theo phường + trạng thái liên kết bản ghi.
 * Máy chủ chưa triển khai bản có hd_info → trả { ok:true, has:false, oldBackend:true } (không ném lỗi).
 */
export async function apiHdInfo({ phuong, type, nam, pairs, goi, tatCa } = {}) {
  try {
    return await postJson({ action: 'hd_info', token: requireToken(), phuong, type, nam, pairs, goi, tatCa });
  } catch (e) {
    if (/^unknown action/.test(e.message || '')) return { ok: true, has: false, oldBackend: true };
    throw e;
  }
}

export async function apiSetStatus(type, stts, status, note = '') {
  return postJson({ action: 'set_status', token: requireToken(), type, stts, status, note });
}

export async function apiList({ type, username, stt, from, to, includeDeleted, status, hd } = {}) {
  return postJson({
    action: 'list',
    token: requireToken(),
    type, username, stt, from, to, includeDeleted, status, hd
  });
}

/** Sửa bản ghi (admin/user role có quyền edit). photos=undefined → giữ nguyên; photos=[urls] → ghi đè. */
export async function apiUpdate(type, stt, data, photos, hd, xacNhan) {
  return postJson({
    action: 'update',
    token: requireToken(),
    type, stt, data, photos, hd, xacNhan: xacNhan || undefined
  });
}

/** GĐ2 liên kết HĐ: đổi riêng lựa chọn hạng mục HĐ của 1 bản (hd=null → bỏ chọn). */
export async function apiHdChon(type, stt, hd, xacNhan) {
  return postJson({ action: 'hd_chon', token: requireToken(), type, stt, hd, xacNhan });
}

/** v2.3.0: máy chủ bắt buộc lý do xoá (≥ 5 ký tự). */
export async function apiDelete(type, stt, reason) {
  return postJson({ action: 'delete', token: requireToken(), type, stt, reason });
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

/** Nhập hàng loạt bản ghi lịch sử từ Excel (chỉ admin/user). */
export async function apiBulkImport(type, rows) {
  return postJson({
    action: 'bulk_import',
    token: requireToken(),
    type,
    rows
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

/** User tự đổi mật khẩu của chính mình. Mọi role đăng nhập đều gọi được. */
export async function apiChangePassword(current_password, new_password) {
  return postJson({
    action: 'change_password',
    token: requireToken(),
    current_password,
    new_password
  });
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

/**
 * Đọc 1 ảnh Drive về dạng base64 (đi vòng qua Apps Script).
 * Dùng khi cần nội tuyến ảnh vào canvas/PDF — ảnh Drive không có header CORS
 * nên html2canvas vẽ ra ô trắng nếu lấy trực tiếp bằng URL.
 * @returns {Promise<{ok:boolean, mimeType:string, base64:string}>}
 */
export async function apiPhotoBase64(url) {
  return postJson({ action: 'photo_base64', token: requireToken(), url });
}

// ===== Google Drive upload (qua Apps Script) =====

/** Chuyển Blob → base64 string (không kèm data: prefix). */
function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/** Chỉ cảnh báo 1 lần mỗi phiên khi phải dùng đường dự phòng Cloudinary. */
let driveFallbackWarned = false;

/**
 * Upload 1 ảnh (nén → Drive, dự phòng Cloudinary).
 * @param {File|Blob} file
 * @param {string} surveyType - thư mục con (vd 'tang_cuong_den' hoặc 'banve/tang_cuong_den')
 * @returns {Promise<string>} URL ảnh công khai
 */
export async function uploadImageToDrive(file, surveyType) {
  const compressed = await compressImage(file);
  return uploadBlobToDrive(compressed, surveyType);
}

/**
 * Upload Blob đã xử lý sẵn (nén + đóng dấu).
 *
 * Ưu tiên Google Drive qua Apps Script. Nếu Drive lỗi (hay gặp nhất: script chưa
 * được cấp quyền Drive, hoặc DRIVE_FOLDER_ID chưa cấu hình) thì tự chuyển sang
 * Cloudinary unsigned upload — chạy thẳng từ trình duyệt, không cần quyền OAuth.
 * Nhờ vậy người khảo sát ngoài hiện trường không bị kẹt khi backend trục trặc.
 *
 * Cả 2 dạng URL đều được phần còn lại của hệ thống hiểu: Code.gs khi xoá bản ghi
 * tự phân biệt `drive.google.com` (trash file) và Cloudinary (destroy API).
 *
 * @param {Blob} blob
 * @param {string} surveyType - thư mục con trong `khaosat/` (vd 'tang_cuong_den').
 *   Bắt đầu bằng '/' để đặt thư mục ở gốc, NGANG HÀNG với `khaosat`
 *   (vd '/Bangron' → thư mục `Bangron` riêng).
 * @returns {Promise<string>} URL ảnh công khai
 */
export async function uploadBlobToDrive(blob, surveyType) {
  const ext = (blob.type === 'image/png') ? 'png' : 'jpg';
  const folder = surveyType.startsWith('/') ? surveyType.slice(1) : `khaosat/${surveyType}`;
  const fileName = `${surveyType.replace(/^\//, '').replace(/\//g, '_')}_${Date.now()}.${ext}`;

  try {
    const base64 = await blobToBase64(blob);
    const res = await postJson({
      action: 'upload_photo',
      token: requireToken(),
      base64,
      mimeType: blob.type || 'image/jpeg',
      fileName,
      folder
    });
    return res.url;
  } catch (err) {
    // Chưa đăng nhập / hết phiên thì Cloudinary cũng vô nghĩa — ném lỗi luôn (tránh ảnh mồ côi)
    if (/chưa đăng nhập/i.test(err.message || '') || isSessionEndedError(err.message)) throw err;
    // Mất mạng → Cloudinary cũng không tới được: báo đúng loại để form giữ ảnh chờ mạng (v2.3.0)
    if (classifyError(err, typeof navigator === 'undefined' || navigator.onLine !== false) === 'network') throw err;

    console.warn('[upload] Drive lỗi → chuyển sang Cloudinary:', err.message);
    // Báo 1 lần/phiên: fallback im lặng dễ khiến Drive hỏng cả tháng không ai biết
    if (!driveFallbackWarned) {
      driveFallbackWarned = true;
      showToast('Drive lỗi — ảnh đang lưu tạm trên Cloudinary', 'warning', 5000);
    }
    return uploadToCloudinary(blob, folder, fileName);
  }
}

/**
 * Upload trực tiếp lên Cloudinary bằng unsigned preset (không cần token/OAuth).
 * @returns {Promise<string>} secure_url
 */
async function uploadToCloudinary(blob, folder, fileName) {
  if (!CONFIG.cloudinaryName || !CONFIG.cloudinaryPreset) {
    throw new Error('Upload thất bại: Drive lỗi và Cloudinary chưa cấu hình');
  }
  const fd = new FormData();
  fd.append('file', blob, fileName);
  fd.append('upload_preset', CONFIG.cloudinaryPreset);
  fd.append('folder', folder);

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CONFIG.cloudinaryName}/image/upload`,
    { method: 'POST', body: fd }
  );
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.secure_url) {
    throw new Error('Cloudinary: ' + (json.error?.message || 'HTTP ' + res.status));
  }
  return json.secure_url;
}

// ===== Offline queue sync =====

/**
 * Retry tất cả submission trong queue. Item thành công sẽ bị xoá.
 * @returns {Promise<{success: number, failed: number}>}
 */
/**
 * v2.3.0 — gửi hàng chờ offline (IndexedDB). Không chạy chồng (Web Locks / cờ localStorage).
 * Chỉ gửi bản của người đang đăng nhập; ảnh chờ mạng tải lên trước; client_id chống ghi trùng.
 * @returns {Promise<{success, failed, needFix, others, othersNames, duplicates, skipped?}>}
 */
export async function syncQueue() {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return { success: 0, failed: 0, skipped: true };
  const auth = getToken();
  if (!auth) return { success: 0, failed: 0, skipped: true };
  const store = queueStore();
  const res = await withLock('khaosat-sync', async () => {
    const done = beginBusy();   // đang gửi → không cho app tự tải lại giữa chừng
    try {
      await migrateLegacy(store, localStorage, uuid);
      return await runSync({
        store, me: auth.username, online: navigator.onLine !== false,
        post: payload => postJson(Object.assign({}, payload, { token: requireToken() })),
        upload: p => uploadBlobToDrive(new Blob([p.buf], { type: p.mime || 'image/jpeg' }), p.folder)
      });
    } finally {
      done();
    }
  }, { locks: navigator.locks, localStorage });
  return res || { success: 0, failed: 0, skipped: true };
}

/** Thêm 1 bản vào hàng chờ offline (kèm ảnh chờ mạng). Ném lỗi nếu máy hết chỗ lưu. */
export async function enqueueOffline(rec) {
  return queueStore().add(rec);
}

/** Đếm hàng chờ cho huy hiệu trang chủ: của tôi / của tài khoản khác / cần sửa. */
export async function queueSummary() {
  const me = (getToken() || {}).username;
  const store = queueStore();
  try { await migrateLegacy(store, localStorage, uuid); } catch (e) { /* bỏ qua */ }
  const items = await store.list();
  const out = { mine: 0, others: 0, needFix: 0, unknown: 0, othersNames: [], items };
  items.forEach(it => {
    if (it.owner_unknown) out.unknown++;
    else if (it.username && it.username !== me) {
      out.others++;
      const nm = it.full_name || it.username;
      if (!out.othersNames.includes(nm)) out.othersNames.push(nm);
    } else if (it.status === 'need_fix') out.needFix++;
    else out.mine++;
  });
  return out;
}
