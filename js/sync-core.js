// js/sync-core.js — v2.3.0: lõi THUẦN (không DOM, không import) cho hàng chờ offline.
// Tách riêng để test bằng Node: phân loại lỗi + vòng gửi hàng chờ.

/**
 * Phân loại lỗi theo LOẠI, không đoán theo chuỗi tuỳ tiện:
 *   'network'   — fetch bị từ chối (TypeError; iOS: "Load failed"), AbortError do app tự hẹn giờ, hoặc máy offline
 *   'temporary' — HTTP 5xx/429, máy chủ bận (Lock timeout, "too many times", quá tải) → thử lại sau
 *   'auth'      — hết phiên / mật khẩu đã đổi → về trang đăng nhập
 *   'permanent' — máy chủ từ chối dữ liệu (kiểm dữ liệu, quyền…) → KHÔNG thử lại, cần sửa
 * postJson (api.js) gắn sẵn err.kind; hàm này chỉ suy luận khi chưa có.
 */
export function classifyError(err, online = true) {
  if (err && err.kind) return err.kind;
  if (!online) return 'network';
  const name = err && err.name;
  if (name === 'TypeError' || name === 'AbortError') return 'network';
  const msg = String((err && err.message) || err || '');
  if (/^HTTP (5\d\d|429)\b/.test(msg)) return 'temporary';
  if (/Lock timeout|too many times|Service invoked too many|quá tải|thử lại sau/i.test(msg)) return 'temporary';
  if (/đăng nhập lại|invalid token|missing token|user disabled|user not found/i.test(msg)) return 'auth';
  return 'permanent';
}

/** Lỗi do máy chủ trả {ok:false} — gắn loại cho postJson. */
export function kindOfServerError(msg) {
  const m = String(msg || '');
  if (/Lock timeout|too many times|Service invoked too many|quá tải/i.test(m)) return 'temporary';
  if (/đăng nhập lại|invalid token|missing token|user disabled|user not found/i.test(m)) return 'auth';
  return 'permanent';
}

/** Giãn cách thử lại bản lỗi tạm thời: 1, 2, 4, 8… phút, tối đa 60 phút. */
export function backoffMs(attempts) {
  return Math.min(60, Math.pow(2, Math.max(0, attempts - 1))) * 60e3;
}

/**
 * Gửi hàng chờ 1 vòng. Thuần: mọi tác dụng phụ đi qua tham số.
 * @param {object} o
 * @param {object} o.store     — { list(), remove(id), update(id, patch) } (async)
 * @param {string} o.me        — username đang đăng nhập; chỉ gửi bản của đúng người này
 * @param {Function} o.post    — async (payload) → json; ném lỗi có .kind
 * @param {Function} o.upload  — async (photo {mime, buf, folder}) → url
 * @param {number}  [o.now]
 * @param {boolean} [o.online]
 * @returns {Promise<{success, failed, needFix, others, othersNames, duplicates}>}
 */
export const MAX_ATTEMPTS = 8;

export async function runSync({ store, me, post, upload, now = Date.now(), online = true }) {
  const out = { success: 0, failed: 0, needFix: 0, others: 0, othersNames: [], duplicates: 0, authEnded: false, unknownOwner: 0 };
  const items = await store.list();
  for (const it of items) {
    if (it.owner_unknown) { out.unknownOwner++; continue; }   // chờ người dùng xác nhận là của mình
    if (it.username && it.username !== me) {
      out.others++;
      const nm = it.full_name || it.username;
      if (!out.othersNames.includes(nm)) out.othersNames.push(nm);
      continue;
    }
    if (it.status === 'need_fix') { out.needFix++; continue; }
    if (it.next_try && it.next_try > now) { out.failed++; continue; }
    try {
      // 1. Ảnh chờ mạng → tải lên trước, ghi lại URL ngay (lần sau không tải lại)
      const photos = Array.isArray(it.photos) ? it.photos : [];
      const urls = Array.isArray(it.payload.photos) ? it.payload.photos.slice() : [];
      for (let i = 0; i < photos.length; i++) {
        const p = photos[i];
        if (p.url) continue;
        p.url = await upload(p);
        await store.update(it.id, { photos: photos.map(x => x.url ? { url: x.url, field: x.field || null } : x) });
      }
      const fieldUrls = {};
      photos.forEach(p => {
        if (!p.url) return;
        if (p.field) fieldUrls[p.field] = p.url; else if (!urls.includes(p.url)) urls.push(p.url);
      });
      // 2. Gửi bản ghi (client_id giữ nguyên → máy chủ chống ghi trùng)
      const payload = Object.assign({}, it.payload, {
        photos: urls,
        data: Object.assign({}, it.payload.data || {}, fieldUrls),
        client_id: it.client_id, client_at: it.client_at, from_queue: true
      });
      const res = await post(payload);
      if (res && res.duplicate) out.duplicates++;
      await store.remove(it.id);
      out.success++;
    } catch (e) {
      const kind = classifyError(e, online);
      if (kind === 'auth') { out.authEnded = true; out.failed++; break; }
      if (kind === 'permanent') {
        await store.update(it.id, { status: 'need_fix', error: String(e.message || e).slice(0, 300) });
        out.needFix++;
        continue;
      }
      // Mất mạng THẬT (fetch bị từ chối, đã gắn kind) hoặc máy offline: không tính là "lần lỗi" —
      // bản hợp lệ phải tự gửi khi có mạng lại, dù mất mạng bao nhiêu lần.
      if (kind === 'network' && ((e && e.kind === 'network') || !online)) {
        await store.update(it.id, { error: String(e.message || e).slice(0, 300) });
        out.failed++;
        break;
      }
      const attempts = (it.attempts || 0) + 1;
      // Lỗi lặp lại quá nhiều lần (bản hỏng, lỗi lập trình bị coi là "mạng") → thành "cần sửa", không chặn cả hàng chờ
      if (attempts >= MAX_ATTEMPTS) {
        await store.update(it.id, { attempts, status: 'need_fix', error: 'Gửi lỗi ' + attempts + ' lần: ' + String(e.message || e).slice(0, 250) });
        out.needFix++;
        continue;
      }
      await store.update(it.id, { attempts, next_try: kind === 'temporary' ? now + backoffMs(attempts) : 0, error: String(e.message || e).slice(0, 300) });
      out.failed++;
      if (kind === 'network') break;   // mất mạng: dừng vòng, đợi có mạng lại
    }
  }
  return out;
}

/**
 * Chạy `fn` dưới khoá tên `name`, không chạy chồng (2 lần gọi cùng lúc / 2 tab).
 * Ưu tiên Web Locks (navigator.locks, nguyên tử giữa các tab); không có thì dùng cờ trong bộ nhớ
 * + cờ localStorage có hạn 2 phút (không nguyên tử — trùng thật sự vẫn được client_id chặn ở máy chủ).
 * Đang có người giữ khoá → trả null ngay, không đợi.
 */
const _held = new Set();
export async function withLock(name, fn, env = {}) {
  if (_held.has(name)) return null;
  _held.add(name);
  try {
    if (env.locks && env.locks.request) {
      return await env.locks.request(name, { ifAvailable: true }, lock => (lock ? fn() : null));
    }
    const ls = env.localStorage;
    const key = 'lock:' + name, now = env.now || Date.now();
    if (ls) {
      const until = Number(ls.getItem(key) || 0);
      if (until > now) return null;
      ls.setItem(key, String(now + 120e3));
    }
    try { return await fn(); } finally { if (ls) ls.removeItem(key); }
  } finally {
    _held.delete(name);
  }
}
