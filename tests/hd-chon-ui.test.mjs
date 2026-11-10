// Ô "Hạng mục HĐ" trong form (js/hd-chon.js): lõi thuần + nối dây form/api/hàng chờ (GĐ2, 10/11/2026).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { read } from './_harness.mjs';

const plain = (x) => JSON.parse(JSON.stringify(x));
const DS_PHUONG = [{ ten: 'Tân Định', quan_cu: 'Quận 1' }, { ten: 'Sài Gòn', quan_cu: 'Quận 1' }, { ten: 'Bình Tây', quan_cu: 'Quận 6' }];
const src0 = read('js/hd-chon.js').replace(/^import .*$/gm, '');
const M = await import('data:text/javascript;charset=utf-8,' + encodeURIComponent(
  'const apiHdInfo = async () => ({}); const escapeHtml = s => String(s); const PHUONG_XA = [];\n' + src0));
const barSrc = read('js/hd-bar.js').replace(/^import .*$/gm, '');
const B = await import('data:text/javascript;charset=utf-8,' + encodeURIComponent(
  'const apiHdInfo = async () => ({}); const escapeHtml = s => String(s);\n' + barSrc));

const HM = [
  { ma: 'HM186', ten: 'Thay thế bộ đèn LED 100W', nhom: 'Thay bộ đèn', dvt: 'bộ', hd: 50, conLai: 10 },
  { ma: 'HM190', ten: 'Lắp đặt bộ đèn pha', nhom: 'Lắp đặt bộ đèn', dvt: 'bộ', hd: 5, conLai: 0 },
  { ma: 'HM1186', ten: 'Thay chấn lưu', nhom: 'Bóng · chấn lưu · kích', dvt: 'cái', hd: 9, conLai: 9 },
  { ma: 'HM200', ten: 'Thay thế bộ đèn cao áp', nhom: 'Thay bộ đèn', dvt: 'bộ', hd: 3, conLai: 3 }
];

function memStore(init = {}) {
  const m = new Map(Object.entries(init));
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), m };
}

test('tìm: bỏ dấu, theo mã / số / tên; rỗng → giữ nguyên', () => {
  assert.deepEqual(M.timHm(HM, 'chan luu').map((h) => h.ma), ['HM1186']);
  assert.deepEqual(M.timHm(HM, '186').map((h) => h.ma), ['HM186', 'HM1186']);
  assert.deepEqual(M.timHm(HM, 'hm18').map((h) => h.ma), ['HM186']);   // HM18… theo đầu số, không khớp HM1186
  assert.deepEqual(M.timHm(HM, 'BỘ ĐÈN').map((h) => h.ma), ['HM186', 'HM190', 'HM200']);
  assert.equal(M.timHm(HM, '  ').length, 4);
});

test('gom nhóm giữ thứ tự xuất hiện; không nhóm → "Khác"', () => {
  const g = M.nhomHm([...HM, { ma: 'HM9', ten: 'x' }]);
  assert.deepEqual(g.map((x) => x.nhom), ['Thay bộ đèn', 'Lắp đặt bộ đèn', 'Bóng · chấn lưu · kích', 'Khác']);
  assert.deepEqual(g[0].hm.map((h) => h.ma), ['HM186', 'HM200']);
});

test('xếp gói: cùng quận cũ lên trước (đánh dấu cungQuan), còn lại theo tên', () => {
  const goiAll = [{ goi: 'G1', maGoiThau: 'A' }, { goi: 'G2', maGoiThau: 'B' }, { goi: 'G3', maGoiThau: '' }];
  const pg = [['Bình Tây', 'G1'], ['Sài Gòn', 'G3']];
  const r = M.xepGoi(goiAll, pg, 'phường Tân Định', DS_PHUONG);
  assert.deepEqual(r.map((x) => [x.goi, x.cungQuan]), [['G3', true], ['G1', false], ['G2', false]]);
  assert.equal(M.quanCuaPhuong('P. Tân Định', DS_PHUONG), 'Quận 1');
  assert.equal(M.quanCuaPhuong('Lạ', DS_PHUONG), '');
});

test('chonSach: ≤3 mã, bỏ trùng/mã sai/hệ số sai, gói bắt buộc', () => {
  const c = M.chonSach({ nam: 2026, goi: 'G2', ds: [{ ma: 'HM1' }, { ma: 'HM1' }, { ma: 'x' }, { ma: 'HM2', heSo: 0 }, { ma: 'HM3', heSo: 2.5 }, { ma: 'HM4' }, { ma: 'HM5' }] });
  assert.deepEqual(plain(c), { nam: 2026, goi: 'G2', ds: [{ ma: 'HM1', heSo: 1 }, { ma: 'HM3', heSo: 2.5 }, { ma: 'HM4', heSo: 1 }] });
  assert.equal(M.chonSach({ goi: 'nhieu', ds: [{ ma: 'HM1' }] }), null);
  assert.equal(M.chonSach({ goi: 'G1', ds: [] }), null);
  assert.equal(M.chonSach(null), null);
});

test('bộ nhớ học: nhớ sau khi lưu, gợi ý lọc theo danh mục hiện tại, không tự chọn', () => {
  const st = memStore({ auth: '1' });
  let hoc = M.hocDoc('u1', st);
  M.hocNho(hoc, { type: 'thay_den', phuong: 'Phường Tân Định', goiTay: true,
    hd: { nam: 2026, goi: 'G3', ds: [{ ma: 'HM186', heSo: 1 }, { ma: 'HM999', heSo: 2 }] } }, 5);
  M.hocGhi('u1', hoc, st);
  hoc = M.hocDoc('u1', st);
  const gy = M.hocGoiY(hoc, { type: 'thay_den', phuong: 'tân định', goi: 'G3', nam: 2026, hm: HM });
  assert.equal(gy.goi, 'G3');
  assert.deepEqual(plain(gy.ds), [{ ma: 'HM186', heSo: 1 }]);   // HM999 không còn trong danh mục → bỏ
  assert.deepEqual(plain(M.hocGoiY(hoc, { type: 'thay_den', phuong: 'x', goi: 'G1', nam: 2026, hm: HM })), {});
  M.hocXoa('u1', st);
  assert.deepEqual(plain(M.hocDoc('u1', st)), { v: 1, m: {} });
});

test('bộ nhớ học: JSON hỏng / không có localStorage → rỗng, không ném; không ghi khi đăng nhập không ghi nhớ', () => {
  assert.deepEqual(plain(M.hocDoc('u', memStore({ 'hd_hoc_v1:u': '{hỏng' }))), { v: 1, m: {} });
  assert.deepEqual(plain(M.hocDoc('u', { getItem() { throw new Error('x'); } })), { v: 1, m: {} });
  const st = memStore();
  M.hocGhi('u', { v: 1, m: { a: { at: 1 } } }, st);
  assert.equal(st.getItem('hd_hoc_v1:u'), null);
});

test('bộ nhớ học giới hạn 200 mục (bỏ cũ nhất)', () => {
  const st = memStore({ auth: '1' });
  const hoc = { v: 1, m: {} };
  for (let i = 0; i < 205; i++) hoc.m['k' + i] = { at: i };
  M.hocGhi('u', hoc, st);
  const o = JSON.parse(st.getItem('hd_hoc_v1:u'));
  assert.equal(Object.keys(o.m).length, 200);
  assert.ok(!o.m.k0 && o.m.k204);
});

test('thanh HĐ hiện mã người KS đã chọn; bỏ chọn → trở lại như cũ', () => {
  const m = { state: 'none', text: 'Tân Định chưa có trong HĐ', sub: '' };
  const r = B.apChon(m, { goi: 'G3', ds: [{ ma: 'HM186', hd: 50, conLai: 10 }, { ma: 'HM200' }] });
  assert.equal(r.text, 'Gói 3 · KS chọn');
  assert.match(r.sub, /^HM186 · HĐ 50 · còn 10 \(\+1\)$/);
  assert.equal(B.apChon(m, { goi: null, ds: [] }), m);
  assert.equal(B.apChon({ hidden: true }, { goi: 'G1', ds: [{ ma: 'HM1' }] }).hidden, true);
});

test('nối dây: form gửi hd (tạo / sửa / hàng chờ / nháp), api có tham số, sw có file, đăng xuất xoá bộ nhớ học', () => {
  const f = read('js/form-renderer.js');
  assert.match(f, /initHdChon\(/);
  assert.match(f, /if \(hdGui\) extra\.hd = hdGui;/);
  assert.match(f, /apiUpdate\(state\.schemaKey, state\.editStt, data, photoUrls, hdGui, hdXacNhan\)/);
  assert.match(f, /getForUpdate\(\)/);
  assert.match(f, /hd \? \{ hd \} : \{\}/);
  assert.match(f, /__hd: state\.hdChon \? state\.hdChon\.get\(\) : undefined/);
  assert.match(f, /status: 'all', hd: true/);
  assert.match(f, /it\.payload\.hd && state\.hdChon/);
  const a = read('js/api.js');
  assert.match(a, /phuong, type, nam, pairs, goi, tatCa \}\);/);
  assert.match(a, /export async function apiHdChon/);
  assert.match(read('sw.js'), /'\.\/js\/hd-chon\.js'/);
  assert.match(read('js/auth.js'), /hd_hoc_v1:/);
});

test('an toàn giao diện: chuỗi máy chủ qua escapeHtml; ô tìm 16px; vùng chạm ≥ 48px; không tự chọn gợi ý', () => {
  const s = read('js/hd-chon.js');
  assert.match(s, /\.hdc-search\{[^}]*font-size:16px/);
  assert.match(s, /\.hdc-row\{[^}]*min-height:56px/);
  assert.match(s, /\.hdc-btn\{[^}]*min-height:52px/);
  assert.match(s, /\.hdc-chip\{[^}]*min-height:48px/);
  assert.doesNotMatch(s, /\$\{h\.ten\}|\$\{h\.ma\}|\$\{d\.ma\}/);   // không chèn thô
  assert.match(s, /data-hoc="1"/);   // gợi ý chỉ là chip phải chạm
  assert.match(s, /prefers-color-scheme:dark/);
  assert.match(s, /orientation:landscape/);
});

// ---- Hành vi thật của initHdChon trên DOM giả (review 10/11: lựa chọn không được mất âm thầm) ----
function domGia() {
  const el = () => {
    const o = { className: '', innerHTML: '', dataset: {}, style: { setProperty() {} }, attrs: {},
      classList: { s: new Set(), add(c) { o.classList.s.add(c); }, remove(c) { o.classList.s.delete(c); },
        toggle(c, v) { v ? o.classList.s.add(c) : o.classList.s.delete(c); }, contains(c) { return o.classList.s.has(c); } },
      setAttribute(k, v) { o.attrs[k] = v; }, querySelector() { return o._q || (o._q = el()); }, addEventListener() {},
      after() {}, appendChild() {}, closest() { return null; }, focus() {}, get offsetWidth() { return 0; } };
    return o;
  };
  const ls = {};
  globalThis.document = { createElement: el, getElementById: () => null, head: el(), body: el(),
    addEventListener: (t, f) => { (ls[t] = ls[t] || []).push(f); }, dispatchEvent: (e) => { (ls[e.type] || []).forEach((f) => f(e)); } };
  globalThis.CustomEvent = class { constructor(t, o) { this.type = t; this.detail = o && o.detail; } };
  globalThis.window = { addEventListener() {}, visualViewport: null };
  globalThis.history = { pushState() {}, back() {}, state: null };
  const form = el(); form.querySelector = () => null;
  return form;
}
const ngu = (ms) => new Promise((r) => setTimeout(r, ms));
async function nap(PG) {
  const H = await import('data:text/javascript;charset=utf-8,' + encodeURIComponent(
    'const apiHdInfo = (a) => globalThis.__api(a); const escapeHtml = s => String(s); const PHUONG_XA = [];\n' + src0 + '\n//' + Math.random()));
  globalThis.__api = async ({ phuong, goi }) => {
    const gl = PG.v[phuong] || [];
    const g = gl.length === 1 ? gl[0] : gl.length > 1 ? 'nhieu' : null;
    const goiDung = g && g !== 'nhieu' ? g : (goi && (!g || gl.includes(goi)) ? goi : null);
    return { ok: true, has: true, chon: true, goi: { goi: g, goiList: gl }, goiDung, goiAll: [{ goi: 'G1' }, { goi: 'G2' }], phuongGoi: [], namList: [2026],
      hm: goiDung ? [{ ma: 'HM186', ten: 'x', nhom: 'n', conLai: 1 }] : [] };
  };
  return H;
}
const doiPhuong = async () => { document.dispatchEvent(new CustomEvent('phuong-change')); await ngu(700); };

test('đổi phường sang phường chưa có gói / thành nhiều gói: giữ lựa chọn, sửa bản không bị xoá', async () => {
  const form = domGia(); const PG = { v: { A: ['G1'], B: [] } }; let phuong = 'A';
  const H = await nap(PG);
  const c = H.initHdChon({ type: 'thay_den', user: { username: 'u', role: 'user' }, form, getPhuong: () => phuong });
  await ngu(20);
  c.set({ nam: 2026, goi: 'G1', ds: [{ ma: 'HM186' }] }, { orig: true }); await ngu(20);
  assert.equal(c.getForUpdate(), undefined);
  phuong = 'B'; await doiPhuong();
  assert.equal(c.get().goi, 'G1');
  assert.equal(c.getForUpdate(), undefined);
  PG.v.A = ['G1', 'G2']; phuong = 'A'; await doiPhuong();
  assert.deepEqual(plain(c.get().ds), [{ ma: 'HM186', heSo: 1 }]);
  assert.equal(c.getForUpdate(), undefined);   // cờ goiTay đổi không tính là thay đổi
});

test('đổi sang phường thuộc gói khác: bỏ mã + "Cần chọn lại", không gửi gói rỗng, không xoá lựa chọn cũ trên máy chủ', async () => {
  const form = domGia(); const PG = { v: { A: ['G1'], C: ['G2'] } }; let phuong = 'A';
  const H = await nap(PG);
  const c = H.initHdChon({ type: 'thay_den', user: { username: 'u', role: 'user' }, form, getPhuong: () => phuong });
  await ngu(20);
  c.set({ nam: 2026, goi: 'G1', ds: [{ ma: 'HM186' }] }, { orig: true }); await ngu(20);
  phuong = 'C'; await doiPhuong();
  assert.equal(c.get(), undefined);
  assert.equal(c.getForUpdate(), undefined);
});

test('so lựa chọn bỏ qua cờ goiTay; gói hợp phường theo 3 trường hợp', () => {
  assert.ok(M.cungLuaChon({ nam: 2026, goi: 'G1', goiTay: true, ds: [{ ma: 'HM1', heSo: 1 }] }, { nam: 2026, goi: 'G1', goiTay: false, ds: [{ ma: 'HM1' }] }));
  assert.ok(!M.cungLuaChon({ nam: 2026, goi: 'G1', ds: [{ ma: 'HM1', heSo: 2 }] }, { nam: 2026, goi: 'G1', ds: [{ ma: 'HM1' }] }));
  assert.ok(M.cungLuaChon(undefined, null));
  assert.ok(M.goiHopPhuong('G1', { goi: 'G1' }) && !M.goiHopPhuong('G1', { goi: 'G2' }));
  assert.ok(M.goiHopPhuong('G2', { goi: 'nhieu', goiList: ['G1', 'G2'] }) && !M.goiHopPhuong('G3', { goi: 'nhieu', goiList: ['G1', 'G2'] }));
  assert.ok(M.goiHopPhuong('G3', { goi: null, goiList: [] }));
});

test('đổi gói/năm: xoá danh sách cũ + khung chờ, chặn chạm mã khi đang tải; Back = huỷ; có nút Quên', () => {
  const s = read('js/hd-chon.js');
  assert.equal((s.match(/st\.info = \{ \.\.\.st\.info, hm: \[\] \};\r?\n\s*st\.loading = true; paintSheet\(\);/g) || []).length, 2);
  assert.match(s, /if \(st\.loading\) return;   \/\/ đang tải danh mục gói mới/);
  assert.match(s, /nút Back = huỷ như ✕/);
  assert.match(s, /data-quen="1"/);
  assert.match(s, /st\.boChon \? null : undefined/);
  assert.match(read('js/sync-core.js'), /payload\.hd && !\(res && res\.hd_saved\)/);
  assert.match(read('index.html'), /res\.hdWarn > 0/);
});
