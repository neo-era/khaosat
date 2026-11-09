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
  },
  async get(id) { return tx('readonly', (st, set) => reqP(st.get(id)).then(set)); }
};

/** Kho trong bộ nhớ — dùng cho test và khi trình duyệt không có IndexedDB. */
export function memoryStore(initial = []) {
  const m = new Map(initial.map(r => [r.id, r]));
  return {
    async add(rec) { m.set(rec.id, rec); return rec.id; },
    async list() { return [...m.values()].sort((a, b) => (a.queued_at || 0) - (b.queued_at || 0)); },
    async remove(id) { m.delete(id); },
    async update(id, patch) { const c = m.get(id); if (c) m.set(id, Object.assign(c, patch)); },
    async get(id) { return m.get(id); },
    _map: m
  };
}

/**
 * Kho dự phòng khi trình duyệt không có IndexedDB: localStorage (bền qua lần mở app), KHÔNG chứa
 * được ảnh — thêm bản có ảnh chờ mạng sẽ báo lỗi để form giữ nguyên (không "lưu offline" giả).
 */
export function lsStore(ls, key = 'queue_v2') {
  const read = () => { try { return JSON.parse(ls.getItem(key) || '[]'); } catch { return []; } };
  const write = a => ls.setItem(key, JSON.stringify(a));
  return {
    async add(rec) {
      if (rec.photos && rec.photos.some(p => p.buf)) throw new Error('Máy không lưu được ảnh khi mất mạng');
      write(read().filter(x => x.id !== rec.id).concat([rec])); return rec.id;
    },
    async list() { return read().sort((a, b) => (a.queued_at || 0) - (b.queued_at || 0)); },
    async remove(id) { write(read().filter(x => x.id !== id)); },
    async update(id, patch) { write(read().map(x => x.id === id ? Object.assign(x, patch) : x)); },
    async get(id) { return read().find(x => x.id === id); }
  };
}

/** Kho dùng thật: IndexedDB nếu có, không thì localStorage. */
let _fallback = null;
export function queueStore() {
  if (hasIdb()) return idbStore;
  if (!_fallback) _fallback = lsStore(localStorage);
  return _fallback;
}

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
    const id = it.id || newId();
    await store.add({
      // client_id suy từ id cũ → chuyển 2 lần (2 tab) vẫn ra cùng mã, máy chủ chống trùng được
      id, client_id: it.payload.client_id || ('legacy-' + String(id).replace(/[^A-Za-z0-9_-]/g, '')).slice(0, 64),
      client_at: it.payload.client_at || it.queued_at || null,
      // Hàng chờ cũ không ghi người tạo → "chưa rõ": KHÔNG tự gửi dưới tên người đang đăng nhập
      username: it.username || '', full_name: it.full_name || '', owner_unknown: !it.username,
      queued_at: it.queued_at || Date.now(), payload: it.payload, photos: [],
      status: 'pending', attempts: 0, next_try: 0
    });
    n++;
  }
  try { ls.removeItem(LEGACY_KEY); } catch { /* bỏ qua */ }
  return n;
}
