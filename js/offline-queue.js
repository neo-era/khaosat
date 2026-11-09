// js/offline-queue.js — v2.3.0: hàng chờ offline trong IndexedDB (bản ghi + ảnh chung 1 transaction).
// Thay cho localStorage['queue_submissions'] (đọc–sửa–ghi giữa 2 tab có thể làm mất bản; không chứa
// được ảnh). Bản ghi:
//   { id, client_id, client_at, username, full_name, queued_at,
//     payload: { action:'submit', type, data, photos:[url], ua },
//     photos: [{ mime, buf:ArrayBuffer, folder, field|null, url? }],   ← ảnh chờ mạng
//     status: 'pending'|'need_fix', attempts, next_try, error }
// Đăng xuất / đổi tài khoản KHÔNG xoá hàng chờ (bản của người khác giữ nguyên tới khi họ đăng nhập lại).

const DB_NAME = 'khaosat-offline';
const STORE = 'queue';
const LEGACY_KEY = 'queue_submissions';

let _dbp = null;
function db() {
  if (_dbp) return _dbp;
  _dbp = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => { req.result.createObjectStore(STORE, { keyPath: 'id' }); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return _dbp;
}

function tx(mode, fn) {
  return db().then(d => new Promise((resolve, reject) => {
    const t = d.transaction(STORE, mode);
    const st = t.objectStore(STORE);
    let result;
    Promise.resolve(fn(st, r => { result = r; })).catch(reject);
    t.oncomplete = () => resolve(result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error || new Error('IndexedDB abort'));
  }));
}

const reqP = r => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });

/** Có IndexedDB dùng được không (Safari riêng tư cũ, trình duyệt lạ → false: dùng localStorage cũ). */
export function hasIdb() {
  try { return typeof indexedDB !== 'undefined' && !!indexedDB.open; } catch { return false; }
}

export const idbStore = {
  async add(rec) {
    await tx('readwrite', st => { st.put(rec); });
    if (rec.photos && rec.photos.length) requestPersist();
    return rec.id;
  },
  async list() {
    const all = await tx('readonly', (st, set) => reqP(st.getAll()).then(set));
    return (all || []).sort((a, b) => (a.queued_at || 0) - (b.queued_at || 0));
  },
  async remove(id) { await tx('readwrite', st => { st.delete(id); }); },
  async update(id, patch) {
    await tx('readwrite', st => reqP(st.get(id)).then(cur => { if (cur) st.put(Object.assign(cur, patch)); }));
  }
};

/** Kho trong bộ nhớ — dùng cho test và khi trình duyệt không có IndexedDB. */
export function memoryStore(initial = []) {
  const m = new Map(initial.map(r => [r.id, r]));
  return {
    async add(rec) { m.set(rec.id, rec); return rec.id; },
    async list() { return [...m.values()].sort((a, b) => (a.queued_at || 0) - (b.queued_at || 0)); },
    async remove(id) { m.delete(id); },
    async update(id, patch) { const c = m.get(id); if (c) m.set(id, Object.assign(c, patch)); },
    _map: m
  };
}

/** Kho dùng thật: IndexedDB nếu có. */
export function queueStore() { return hasIdb() ? idbStore : memoryStore(); }

/** Xin trình duyệt giữ dữ liệu (không tự xoá khi thiếu chỗ) — có ảnh chờ thì mới xin. */
export function requestPersist() {
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {}); } catch { /* bỏ qua */ }
}

/**
 * Chuyển hàng chờ cũ (localStorage) sang IndexedDB, 1 lần. Bản cũ chưa có client_id → cấp mới;
 * chưa có username → để trống (runSync coi như bản của người đang đăng nhập — máy cũ chỉ 1 người dùng).
 * @param {object} store
 * @param {Storage} ls
 * @param {Function} newId
 */
export async function migrateLegacy(store, ls, newId) {
  let raw;
  try { raw = ls.getItem(LEGACY_KEY); } catch { return 0; }
  if (!raw) return 0;
  let arr = [];
  try { arr = JSON.parse(raw) || []; } catch { arr = []; }
  let n = 0;
  for (const it of arr) {
    if (!it || !it.payload) continue;
    await store.add({
      id: it.id || newId(), client_id: it.payload.client_id || newId(),
      client_at: it.payload.client_at || it.queued_at || null,
      username: it.username || '', full_name: it.full_name || '',
      queued_at: it.queued_at || Date.now(), payload: it.payload, photos: [],
      status: 'pending', attempts: 0, next_try: 0
    });
    n++;
  }
  try { ls.removeItem(LEGACY_KEY); } catch { /* bỏ qua */ }
  return n;
}
