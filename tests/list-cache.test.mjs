// Hiện ngay danh sách lần trước (30/09/2026, user chốt cho trang Biên bản sự cố): máy chủ Apps Script
// có lúc mất ~20 s → mở trang thấy ngay bản đã lưu trên máy, máy chủ trả về thì thay bằng bản mới.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { read } from './_harness.mjs';

const store = {};
globalThis.localStorage = {
  getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); },
  removeItem: k => { delete store[k]; }, key: i => Object.keys(store)[i], get length() { return Object.keys(store).length; }
};
store['auth'] = '{}';   // đăng nhập "ghi nhớ" (token ở localStorage) — mới được lưu danh sách
const m = await import('data:text/javascript;charset=utf-8,' + encodeURIComponent(read('js/list-cache.js')));

const rows = [
  { STT: 'SC-1', 'Submitted At': '2026-09-29T03:00:00.000Z' },
  { STT: 'SC-2', 'Submitted At': '2026-08-01T03:00:00.000Z' },
  { STT: 'SC-3', 'Submitted At': '2026-09-30T16:30:00.000Z' }   // 23:30 giờ VN ngày 30/09
];

test('lưu rồi đọc lại danh sách kèm thời điểm lưu', () => {
  m.saveListCache('bcsc', rows);
  const c = m.readListCache('bcsc');
  assert.equal(c.rows.length, 3);
  assert.ok(Date.now() - c.at < 5000);
  assert.equal(m.readListCache('khac'), null);
});

test('lọc theo khoảng ngày đang chọn (theo giờ Việt Nam, như máy chủ)', () => {
  const r = m.filterByRange(rows, '2026-09-01', '2026-09-30').map(x => x.STT);
  assert.deepEqual(r, ['SC-1', 'SC-3']);
  assert.deepEqual(m.filterByRange(rows, '', '').map(x => x.STT), ['SC-1', 'SC-2', 'SC-3']);
});

test('dữ liệu lưu hỏng không làm lỗi trang; đăng xuất xoá hết danh sách đã lưu', () => {
  store['list_cache:bcsc'] = '{hỏng';
  assert.equal(m.readListCache('bcsc'), null);
  m.saveListCache('bcsc', rows);
  m.clearListCaches();
  assert.equal(m.readListCache('bcsc'), null);
  assert.match(read('js/auth.js'), /clearListCaches\(\)/, 'logout phải xoá danh sách đã lưu');
});

// Rà soát 30/09: gộp bản lưu với dữ liệu mới không nhân đôi, không phình mãi; không lưu khi đăng nhập
// kiểu "không ghi nhớ" (máy mượn); hết hạn/đổi người là xoá.
test('mergeCache: thay phần trong khoảng ngày, giữ phần ngoài, bỏ dòng ngày hỏng, giới hạn số dòng', () => {
  const old = [
    { STT: 'A', 'Submitted At': '2026-07-01T03:00:00Z' },          // ngoài khoảng → giữ
    { STT: 'B', 'Submitted At': '2026-09-10T03:00:00Z' },          // trong khoảng → thay bằng dữ liệu mới
    { STT: 'X', 'Submitted At': '(imported)' }                     // ngày hỏng: máy chủ luôn trả lại → không giữ, tránh nhân đôi
  ];
  const fresh = [{ STT: 'B', 'Submitted At': '2026-09-10T03:00:00Z', sua: 1 }, { STT: 'X', 'Submitted At': '(imported)' }];
  const out = m.mergeCache(old, fresh, '2026-09-01', '2026-09-30');
  assert.deepEqual(out.map(r => r.STT).sort(), ['A', 'B', 'X']);
  assert.equal(out.find(r => r.STT === 'B').sua, 1);
  const many = Array.from({ length: 900 }, (_, i) => ({ STT: 'S' + i, 'Submitted At': new Date(Date.UTC(2026, 0, 1) + i * 3600e3).toISOString() }));
  assert.equal(m.mergeCache(many, [], '2027-01-01', '2027-01-02').length, 500);
});

test('không lưu khi đăng nhập kiểu "không ghi nhớ" (token trong sessionStorage)', () => {
  delete store['auth'];
  m.clearListCaches();
  m.saveListCache('bcsc', rows);
  assert.equal(m.readListCache('bcsc'), null);
  store['auth'] = '{}';
  m.saveListCache('bcsc', rows);
  assert.ok(m.readListCache('bcsc'));
});

test('clearToken (hết hạn, đăng xuất) và đăng nhập mới đều xoá danh sách đã lưu', () => {
  assert.match(read('js/storage.js'), /clearListCaches\(\)/);
  assert.match(read('js/auth.js'), /clearListCaches\(\)/);
});
