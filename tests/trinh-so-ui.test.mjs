// Ô "Trình Sở" trong form (js/trinh-so.js, phương án A — 11/11/2026): lõi thuần + nối dây.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { read } from './_harness.mjs';

const src = read('js/trinh-so.js').replace(/^import .*$/gm, '');
const T = await import('data:text/javascript;charset=utf-8,' + encodeURIComponent('const escapeHtml = s => String(s);\n' + src));

test('chưa chọn → chặn; HPS + Trình Sở ở KC xa → chặn; Vỏ tủ không bao giờ chặn', () => {
  assert.match(T.lyDoChan('thay_den', '', ''), /Chưa chọn/);
  assert.equal(T.lyDoChan('thay_den', 'Trình Sở', ''), '');
  assert.match(T.lyDoChan('tc_den_kc_xa', 'Trình Sở', 'HPS 150W'), /Đèn HPS/);
  assert.equal(T.lyDoChan('tc_den_kc_xa', 'Không trình Sở', 'HPS 150W'), '');
  assert.equal(T.lyDoChan('tc_den_kc_xa', 'Trình Sở', 'LED 100W'), '');
  assert.equal(T.lyDoChan('vo_tu', '', ''), '');
});

test('nhận đèn HPS khớp với máy chủ (laDenHps_ trong Code.gs)', () => {
  for (const s of ['HPS 150W', 'Cao áp Sodium', 'đèn SON 250W', 'natri']) assert.ok(T.laDenHps(s), s);
  for (const s of ['LED 100W', 'Đèn LED thay HPS', '', 'Metal halide']) assert.ok(!T.laDenHps(s), s);
  assert.match(read('apps-script/Code.gs'), /hps\\b\|sodium\|natri\|cao ap\|\\bson\\b/);
});

test('dòng "→ …" theo lựa chọn + gói theo phường; nói thật khi chưa có gói', () => {
  assert.equal(T.dichDen('thay_den', 'Thay đèn', '', 'G1'), 'Chọn để biết bản vào phụ lục nào');
  assert.equal(T.dichDen('thay_den', 'Thay đèn', 'Trình Sở', 'G1'), '→ Phụ lục Thay HPS → LED · Gói 1 (theo phường)');
  assert.match(T.dichDen('thay_den', 'Thay đèn', 'Không trình Sở', 'G2'), /^→ KL Trung tâm .*Gói 2/);
  assert.match(T.dichDen('nap_tru', 'Nắp trụ', 'Trình Sở', 'nhieu'), /Phụ lục Nắp trụ · Cần gán gói$/);
  assert.match(T.dichDen('thay_tru', 'Thay trụ', 'Trình Sở', null), /Cần gán gói$/);
  assert.equal(T.dichDen('thay_tru', 'Thay trụ', 'Trình Sở', null, false), '→ Phụ lục Thay trụ');
});

test('kênh của bản ghi: TS / TT / chưa phân loại; Vỏ tủ luôn TT', () => {
  assert.equal(T.kenhCua({ 'Trình Sở': 'Trình Sở' }, 'thay_den'), 'TS');
  assert.equal(T.kenhCua({ 'Trình Sở': 'Không trình Sở'.normalize('NFD') }, 'thay_den'), 'TT');
  assert.equal(T.kenhCua({}, 'thay_den'), '');
  assert.equal(T.kenhCua({ 'Trình Sở': 'rác' }, 'thay_den'), '');
  assert.equal(T.kenhCua({}, 'vo_tu'), 'TT');
});

test('nối dây form: đặt sau TĐK trước ô HĐ, kiểm trước khi lưu, đi đủ nháp / hàng chờ / sửa bản; nhãn + lọc ở Quản lý; sw', () => {
  const f = read('js/form-renderer.js');
  assert.ok(f.indexOf('initHdChon({') < f.indexOf('initTrinhSo({'), 'tạo ô HĐ trước để ô Trình Sở chèn ngay sau TĐK');
  assert.match(f, /if \(state\.trinhSo && !state\.trinhSo\.kiem\(\)\)/);
  assert.match(f, /data\['Trình Sở'\] = state\.trinhSo\.get\(\)/);
  assert.match(f, /__trinhSo:/);
  assert.match(f, /draft\.data\.__trinhSo && state\.trinhSo/);
  assert.match(f, /state\.trinhSo\.set\(\(it\.payload\.data \|\| \{\}\)\['Trình Sở'\]\)/);
  assert.match(f, /state\.trinhSo\.set\(row\['Trình Sở'\], \{ cuChuaPhanLoai: true \}\)/);
  assert.match(read('js/manage.js'), /nhanKenh\(kenhCua\(r, r\._type\)\)/);
  assert.match(read('manage.html'), /id="filter-kenh"/);
  const sw = read('sw.js');
  assert.match(sw, /'\.\/js\/trinh-so\.js'/);
  assert.match(sw, /khaosat-v39/);
  assert.match(read('js/hd-chon.js'), /goiDuKien:/);
});

test('giao diện: ≥52px, không xuống dòng, ngang ≤480px, không chọn sẵn, aria radiogroup, có báo lỗi + chặn role=alert', () => {
  const s = read('js/trinh-so.js');
  assert.match(s, /\.ts-btn\{[^}]*min-height:52px[^}]*white-space:nowrap/);
  assert.match(s, /\.ts-grp\{[^}]*max-width:480px/);
  assert.match(s, /role="radiogroup"[^>]*aria-required="true"/);
  assert.match(s, /aria-checked="false"[^>]*>Trình Sở</);
  assert.match(s, /role="alert"/);
  assert.match(s, /aria-live="polite"/);
  assert.match(s, /let val = ''/);
});
