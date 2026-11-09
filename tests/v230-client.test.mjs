// v2.3.0 — máy: phân loại lỗi, vòng gửi hàng chờ (ảnh chờ mạng, chủ bản ghi, giãn cách), khoá chạy, chuyển hàng chờ cũ.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { read } from './_harness.mjs';

const mod = rel => import('data:text/javascript;charset=utf-8,' + encodeURIComponent(read(rel)));
const core = await mod('js/sync-core.js');
const oq = await mod('js/offline-queue.js');

const item = (id, extra = {}) => ({ id, client_id: 'cid-' + id + '-xxxxxx', client_at: 1000, username: 'ktv01', full_name: 'Nguyễn Văn A',
  queued_at: Number(id.replace(/\D/g, '')) || 1, payload: { action: 'submit', type: 'hkn', data: { 'Tuyến đường': 'A' }, photos: [] },
  photos: [], status: 'pending', attempts: 0, next_try: 0, ...extra });
const err = (msg, kind, name) => Object.assign(new Error(msg), kind ? { kind } : {}, name ? { name } : {});

test('classifyError: mạng / tạm thời / hết phiên / vĩnh viễn', () => {
  const c = core.classifyError;
  assert.equal(c(err('Failed to fetch', null, 'TypeError')), 'network');
  assert.equal(c(err('Load failed', null, 'TypeError')), 'network');
  assert.equal(c(err('x', null, 'AbortError')), 'network');
  assert.equal(c(err('bất kỳ'), false), 'network');
  assert.equal(c(err('HTTP 503')), 'temporary');
  assert.equal(c(err('HTTP 429')), 'temporary');
  assert.equal(c(err('Lock timeout: another process')), 'temporary');
  assert.equal(c(err('Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại')), 'auth');
  assert.equal(c(err('HTTP 400')), 'permanent');
  assert.equal(c(err('Dữ liệu chưa đúng: Thiếu "Tuyến đường"')), 'permanent');
  assert.equal(c(err('gì đó', 'temporary')), 'temporary', 'kind gắn sẵn được ưu tiên');
});

test('runSync: chỉ gửi bản của người đang đăng nhập, kèm client_id/client_at/from_queue', async () => {
  const store = oq.memoryStore([item('q1'), item('q2', { username: 'ktv02', full_name: 'Trần Thị B' }), item('q3')]);
  const sent = [];
  const r = await core.runSync({ store, me: 'ktv01', post: async p => { sent.push(p); return { ok: true }; }, upload: async () => 'u' });
  assert.equal(r.success, 2); assert.equal(r.others, 1);
  assert.deepEqual(r.othersNames, ['Trần Thị B']);
  assert.ok(sent.every(p => p.from_queue === true && p.client_id && p.client_at === 1000));
  assert.deepEqual((await store.list()).map(x => x.id), ['q2']);
});

test('runSync: ảnh chờ mạng được tải lên trước, URL vào photos / trường Bản vẽ', async () => {
  const store = oq.memoryStore([item('q1', { photos: [{ mime: 'image/jpeg', buf: new ArrayBuffer(3), folder: 'hkn' },
    { mime: 'image/jpeg', buf: new ArrayBuffer(2), folder: 'banve/hkn', field: 'Bản vẽ' }] })]);
  let n = 0; const sent = [];
  const r = await core.runSync({ store, me: 'ktv01', post: async p => { sent.push(p); return { ok: true }; },
    upload: async () => 'https://drive.google.com/uc?export=view&id=F' + (++n) });
  assert.equal(r.success, 1);
  assert.deepEqual(sent[0].photos, ['https://drive.google.com/uc?export=view&id=F1']);
  assert.equal(sent[0].data['Bản vẽ'], 'https://drive.google.com/uc?export=view&id=F2');
});

test('runSync: ảnh đã tải được lưu URL ngay — mất mạng lúc gửi bản ghi thì lần sau không tải lại', async () => {
  const store = oq.memoryStore([item('q1', { photos: [{ mime: 'image/jpeg', buf: new ArrayBuffer(3), folder: 'hkn' }] })]);
  let uploads = 0, posts = 0;
  const up = async () => { uploads++; return 'https://drive.google.com/uc?export=view&id=F1'; };
  await core.runSync({ store, me: 'ktv01', upload: up, post: async () => { posts++; throw err('Failed to fetch', null, 'TypeError'); } });
  await core.runSync({ store, me: 'ktv01', upload: up, post: async () => { posts++; return { ok: true }; } });
  assert.equal(uploads, 1); assert.equal(posts, 2);
  assert.equal((await store.list()).length, 0);
});

test('runSync: trùng (duplicate) coi là thành công; lỗi dữ liệu → "cần sửa", không thử lại; lỗi tạm → giãn cách', async () => {
  const store = oq.memoryStore([item('q1'), item('q2'), item('q3')]);
  const replies = { q1: { ok: true, duplicate: true } };
  const post = async p => {
    const id = p.client_id.split('-')[1];
    if (id === 'q2') throw err('Dữ liệu chưa đúng: Thiếu "Tuyến đường"', 'permanent');
    if (id === 'q3') throw err('HTTP 503', 'temporary');
    return replies[id];
  };
  const r = await core.runSync({ store, me: 'ktv01', post, upload: async () => 'u', now: 1e9 });
  assert.equal(r.success, 1); assert.equal(r.duplicates, 1); assert.equal(r.needFix, 1); assert.equal(r.failed, 1);
  const left = Object.fromEntries((await store.list()).map(x => [x.id, x]));
  assert.equal(left.q2.status, 'need_fix');
  assert.ok(left.q3.next_try > 1e9);
  let posted = 0;
  const r2 = await core.runSync({ store, me: 'ktv01', post: async () => { posted++; return { ok: true }; }, upload: async () => 'u', now: 1e9 + 1 });
  assert.equal(posted, 0, 'bản cần sửa và bản đang giãn cách không gửi lại ngay');
  assert.equal(r2.needFix, 1);
});

test('runSync: hết phiên → dừng, không xoá bản nào', async () => {
  const store = oq.memoryStore([item('q1'), item('q2')]);
  const r = await core.runSync({ store, me: 'ktv01', upload: async () => 'u',
    post: async () => { throw err('Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại', 'auth'); } });
  assert.equal(r.authEnded, true);
  assert.equal((await store.list()).length, 2);
});

test('withLock: gọi chồng (cùng tab / 2 tab qua localStorage) → lần sau trả null, không chạy chồng', async () => {
  let running = 0, maxRunning = 0, runs = 0;
  const fn = async () => { running++; runs++; maxRunning = Math.max(maxRunning, running); await new Promise(r => setTimeout(r, 20)); running--; return 'ok'; };
  const [a, b] = await Promise.all([core.withLock('sync', fn), core.withLock('sync', fn)]);
  assert.equal(maxRunning, 1); assert.equal(runs, 1);
  assert.deepEqual([a, b].sort(), ['ok', null].sort());
  // tab khác đang giữ cờ localStorage còn hạn
  const ls = new Map([['lock:sync', String(Date.now() + 60e3)]]);
  const lsApi = { getItem: k => ls.get(k) ?? null, setItem: (k, v) => ls.set(k, v), removeItem: k => ls.delete(k) };
  assert.equal(await core.withLock('sync', fn, { localStorage: lsApi }), null);
  ls.set('lock:sync', String(Date.now() - 1));   // cờ quá hạn (tab kia bị tắt) → chạy được
  assert.equal(await core.withLock('sync', fn, { localStorage: lsApi }), 'ok');
});

test('migrateLegacy: chuyển hàng chờ localStorage cũ, cấp client_id, xoá khoá cũ', async () => {
  const ls = new Map([['queue_submissions', JSON.stringify([{ id: 'old1', queued_at: 5, payload: { action: 'submit', type: 'hkn', data: {} } }])]]);
  const lsApi = { getItem: k => ls.get(k) ?? null, removeItem: k => ls.delete(k) };
  const store = oq.memoryStore();
  let i = 0;
  assert.equal(await oq.migrateLegacy(store, lsApi, () => 'gen-' + (++i) + '-xxxxxxxx'), 1);
  const [rec] = await store.list();
  assert.equal(rec.client_id, 'legacy-old1', 'suy từ id cũ — chuyển 2 lần vẫn cùng mã');
  assert.equal(rec.owner_unknown, true, 'chưa rõ người tạo → không tự gửi');
  assert.equal(rec.client_at, 5);
  assert.equal(ls.has('queue_submissions'), false);
  assert.equal(await oq.migrateLegacy(store, lsApi, () => 'x'), 0, 'chạy lại không nhân đôi');
});

test('máy: form sinh client_id, gửi kèm; đăng xuất không xoá hàng chờ; trang Quản lý hỏi lý do xoá', () => {
  const fr = read('js/form-renderer.js');
  assert.match(fr, /client_id/);
  assert.match(fr, /status === 'offline'|'offline'/);
  const auth = read('js/auth.js');
  const logoutFn = auth.slice(auth.indexOf('export function logout'), auth.indexOf('}', auth.indexOf('export function logout')) + 1);
  assert.doesNotMatch(logoutFn, /queue|indexedDB|clearQueue/i);
  assert.match(read('js/manage.js'), /reason|lý do/);
  assert.match(read('js/api.js'), /export async function apiDelete\(type, stt, reason\)/);
});

test('biên bản hiện trường escape chữ người dùng nhập', () => {
  const s = read('js/bbht.js');
  for (const v of ['tuyen', 'loc', 'kl', 'ghi']) assert.match(s, new RegExp('\\$\\{escapeHtml\\(' + v + '\\)\\}'), v);
});

test('sw.js cache 2 module mới của hàng chờ', () => {
  const s = read('sw.js');
  assert.match(s, /js\/sync-core\.js/); assert.match(s, /js\/offline-queue\.js/);
});

test('NV vnDateKey: chuỗi giờ VN lấy nguyên ngày, ISO Z đổi sang giờ VN', async () => {
  const src = read('js/utils.js');
  const a = src.indexOf('export function vnDateKey(');
  let d = 0, i = src.indexOf('{', a);
  for (; i < src.length; i++) { if (src[i] === '{') d++; else if (src[i] === '}' && --d === 0) break; }
  const f = new Function('return (' + src.slice(a + 7, i + 1) + ')')();
  assert.equal(f('2026-11-07 23:30:00'), '2026-11-07');
  assert.equal(f('2026-11-07T17:30:00.000Z'), '2026-11-08');
  assert.equal(f(''), '');
  assert.equal(f('rác'), '');
});

test('NV biên bản hiện trường chọn bản theo Ngày khảo sát (hỏi rộng thêm 3 ngày)', () => {
  const s = read('js/bbht.js');
  assert.match(s, /to: addDaysStr\(to, 3\)/);
  assert.match(s, /vnDateKey\(row\['Ngày khảo sát'\]/);
  assert.match(s, /ngay < from \|\| ngay > to/);
});

test('QA bản "cần sửa" mở lại form đọc thẳng hàng chờ (ảnh chưa tải, toạ độ gốc), không đụng bản nháp', () => {
  const idx = read('index.html');
  assert.match(idx, /&queue=' \+ encodeURIComponent\(it\.id\)/);
  assert.doesNotMatch(idx, /saveDraft\(/);
  // chỉ bản hỏng (không mở lại được) mới bị bỏ, và phải hỏi trước
  assert.equal(idx.split('queueStore().remove(it.id)').length - 1, 1);
  assert.match(idx, /for \(const it of broken\) await queueStore\(\)\.remove\(it\.id\)/);
  const fr = read('js/form-renderer.js');
  assert.match(fr, /async function loadFromQueue\(id\)/);
  assert.match(fr, /status: 'offline', blob/);
  assert.match(fr, /state\.gps = \{ status: hasLoc \? 'kept' : 'idle' \}/);
  assert.match(fr, /from_queue: true, client_at: state\.origClientAt/);
  assert.match(fr, /queueStore\(\)\.remove\(state\.fromQueueId\)/);
});

test('QA hàng chờ cũ chưa rõ người tạo: không tự gửi; người dùng nhận thì gửi', async () => {
  const store = oq.memoryStore([item('q1', { username: '', owner_unknown: true })]);
  let posted = 0;
  const r = await core.runSync({ store, me: 'ktv09', post: async () => { posted++; return { ok: true }; }, upload: async () => 'u' });
  assert.equal(posted, 0); assert.equal(r.unknownOwner, 1);
  await store.update('q1', { owner_unknown: false, username: 'ktv09' });
  await core.runSync({ store, me: 'ktv09', post: async () => { posted++; return { ok: true }; }, upload: async () => 'u' });
  assert.equal(posted, 1);
});

test('QA bản lỗi lặp lại quá nhiều lần → "cần sửa", không chặn các bản sau', async () => {
  const store = oq.memoryStore([item('q1', { payload: null, attempts: core.MAX_ATTEMPTS - 1 }), item('q2')]);
  let posted = 0;
  const r = await core.runSync({ store, me: 'ktv01', post: async () => { posted++; return { ok: true }; }, upload: async () => 'u' });
  assert.equal(r.needFix, 1); assert.equal(posted, 1);
  assert.equal((await store.get('q1')).status, 'need_fix');
});

test('QA máy không có IndexedDB: kho localStorage bền qua lần mở, từ chối bản có ảnh chờ mạng', async () => {
  const m = new Map();
  const ls = { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) };
  const a = oq.lsStore(ls);
  await a.add(item('q1'));
  assert.equal((await oq.lsStore(ls).list()).length, 1, 'mở lại vẫn còn');
  await assert.rejects(a.add(item('q2', { photos: [{ buf: new ArrayBuffer(1) }] })));
});

test('QA mất mạng thật nhiều lần KHÔNG biến bản hợp lệ thành "cần sửa"', async () => {
  const store = oq.memoryStore([item('q1')]);
  const netErr = () => { throw Object.assign(new Error('Failed to fetch'), { kind: 'network', name: 'TypeError' }); };
  for (let i = 0; i < core.MAX_ATTEMPTS + 3; i++) await core.runSync({ store, me: 'ktv01', post: async () => netErr(), upload: async () => 'u' });
  for (let i = 0; i < 3; i++) await core.runSync({ store, me: 'ktv01', online: false, post: async () => { throw new Error('x'); }, upload: async () => 'u' });
  assert.equal((await store.get('q1')).status, 'pending');
  const r = await core.runSync({ store, me: 'ktv01', post: async () => ({ ok: true }), upload: async () => 'u' });
  assert.equal(r.success, 1);
});
