// Thanh thông tin HĐ trong form khảo sát (js/hd-bar.js): nội dung theo từng trạng thái, không so số đang nhập.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { read } from './_harness.mjs';

globalThis.localStorage ??= { getItem: () => null, setItem() {}, removeItem() {}, key: () => null, length: 0 };
// Nạp hd-bar.js như ES module độc lập (bỏ import trình duyệt) — chạy được cả Node không có package.json "type"
const src0 = read('js/hd-bar.js').replace(/^import .*$/gm, '');
const { barModel } = await import('data:text/javascript;charset=utf-8,' + encodeURIComponent(
  'const apiHdInfo = async () => ({}); const escapeHtml = s => String(s);\n' + src0));

const RES = { ok: true, has: true, updated_at: '2026-11-08T02:00:00Z', nam: 2026,
  goi: { goi: 'G1', goiList: ['G1'], maGoiThau: 'G101TT' },
  hm: [{ ma: 'HM210', ten: 'Thay trụ', dvt: 'trụ', nam: 2026, hd: 120, daKH: 116, conLai: 4 }, { ma: 'HM214', ten: 'Móng', dvt: 'cái', nam: 2026, hd: 120, daKH: 116, conLai: 4 }] };
const NOW = Date.parse('2026-11-09T00:00:00Z');

test('đủ dữ liệu: gói · mã gói thầu, mã HM đầu + số mã còn lại', () => {
  const m = barModel(RES, { now: NOW });
  assert.equal(m.state, 'data');
  assert.equal(m.text, 'Gói 1 · G101TT');
  assert.equal(m.sub, 'HM210 · HĐ 120 · còn 4 (+1)');
  assert.ok(!m.stale);
});
test('các trạng thái: đang tải / lỗi / máy chủ cũ / chưa có / phường lạ / nhiều gói / dữ liệu cũ', () => {
  assert.equal(barModel(null).state, 'loading');
  assert.equal(barModel({ error: 'x' }).action, 'Thử lại');
  assert.equal(barModel({ ok: true, has: false, oldBackend: true }).hidden, true);
  assert.equal(barModel({ ok: true, has: false }).text, 'Chưa có dữ liệu hợp đồng');
  assert.match(barModel({ ...RES, goi: { goi: null, goiList: [] } }, { phuong: 'Tân Định' }).text, /Tân Định chưa có trong HĐ/);
  assert.equal(barModel({ ...RES, goi: { goi: 'nhieu', goiList: ['G1', 'G2'] } }).text, 'Phường thuộc nhiều gói: Gói 1, Gói 2');
  assert.equal(barModel({ ...RES, updated_at: '2026-09-01T00:00:00Z' }, { now: NOW }).stale, true);
});
test('không có chữ so sánh với số đang nhập (KL HĐ chỉ tham khảo)', () => {
  const src = read('js/hd-bar.js');
  assert.doesNotMatch(src, /lớn hơn KL còn lại|vượt/i);
  assert.match(src, /Nhập đúng số đo hiện trường; KL HĐ chỉ để tham khảo\./);
});
test('chuỗi từ máy chủ luôn qua escapeHtml khi chèn HTML (B5); đăng xuất xoá cache HĐ', () => {
  const src = read('js/hd-bar.js');
  assert.match(src, /goiList \|\| \[\]\)\.map\(escapeHtml\)/);
  assert.doesNotMatch(src, /\$\{(h|cur|g|lk)\.[a-zA-Z]+\}/, 'không chèn trường thô vào template');
  assert.match(read('js/auth.js'), /hd_info:/);
});
test('thanh HĐ hiện ở mọi loại khảo sát (kể cả băng rôn, sự cố)', () => {
  assert.match(read('js/hd-bar.js'), /const SKIP_TYPES = \[\];/);
});
test('api: hd_info là lệnh đọc; máy chủ cũ trả unknown action → ẩn êm', () => {
  const api = read('js/api.js');
  assert.match(api, /READ_ACTIONS = \[[^\]]*'hd_info'/s);
  assert.match(api, /unknown action[\s\S]{0,80}oldBackend: true/);
});
test('sw.js có hd-bar.js; form, recent, manage đều dùng hd-bar', () => {
  assert.match(read('sw.js'), /'\.\/js\/hd-bar\.js'/);
  assert.match(read('js/form-renderer.js'), /initHdBar\(/);
  assert.match(read('recent.html'), /lienKetBadge/);
  assert.match(read('js/manage.js'), /lienKetBadge/);
});
