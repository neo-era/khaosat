// Trình Sở / Không trình Sở (anh chốt 11/11/2026) — máy chủ. Tiêu chí: repo quanly-hopdong-duytu,
// docs/05_TrinhSo-KLTrungTam.md mục K1–K3b, mục 4 (ca kiểm thử bắt buộc).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadGs, addSurveySheet, rowObj, plain, mkSheet, loadSchemas, read } from './_harness.mjs';

const okHkn = (extra = {}) => ({ 'Tuyến đường': 'Trần Phú', 'Phường': 'Chợ Quán', 'Tủ điều khiển': 'TP-1',
  'Số lượng': '2', 'Loại hộp (6A, 10A)': '6A', ...extra });
const okKcXa = (extra = {}) => ({ 'Tuyến đường': 'Lê Lợi', 'Phường': 'Bến Thành', 'Tủ điều khiển': 'LL-1',
  'Chủng loại đèn': 'LED 100W', 'Số lượng': '3', ...extra });
const coSaoLuu = gs => { gs.props.BACKUP_AT = String(Date.now() - 86400e3); };
const sub = (gs, type, data, extra = {}) => plain(gs.handleSubmit({ token: 't', type, data, client_id: 'cid-' + Math.random().toString(36).slice(2, 12), ...extra }));

test('cột Trình Sở nằm SAU BONUS_COLS, không trong HEADERS (form/KPI không lệch)', () => {
  const gs = loadGs();
  assert.deepEqual(plain(gs.TAIL_COLS), ['Trình Sở']);
  Object.keys(gs.HEADERS).forEach(t => assert.ok(!gs.HEADERS[t].includes('Trình Sở'), t));
  assert.ok(!plain(gs.getOptionalFields('ngam_hoa')).includes('Chiều dài cáp ngầm (md)'), 'cột mới Ngầm hóa không tính KPI');
  assert.ok(!plain(gs.getOptionalFields('ngam_hoa')).includes('Số trụ'));
});

test('có sao lưu ≤ 7 ngày: sheet thiếu cột → tự thêm "Trình Sở" ở CUỐI, dữ liệu cũ không dịch', () => {
  const gs = loadGs(); coSaoLuu(gs);
  const sh = addSurveySheet(gs, 'hkn', [{ STT: 'HKN-OLD', 'Tuyến đường': 'Cũ' }]);
  const r = sub(gs, 'hkn', okHkn({ 'Trình Sở': 'Trình Sở' }));
  assert.equal(r.ok, true, r.error);
  assert.deepEqual(plain(sh._d[0]), plain([...gs.HEADERS.hkn, ...gs.BONUS_COLS, 'Trình Sở']));
  assert.equal(rowObj(sh, 2)['Tuyến đường'], 'Cũ');
  assert.equal(rowObj(sh, 2)['Trình Sở'] ?? '', '');
  assert.equal(rowObj(sh, 3)['Trình Sở'], 'Trình Sở');
  assert.equal(rowObj(sh, 3)['Tuyến đường'], 'Trần Phú');
});

test('chưa có sao lưu: KHÔNG chèn cột, lưu tạm sheet chờ + cảnh báo; capNhatCotSheet thêm cột và điền bù', () => {
  const gs = loadGs();
  const sh = addSurveySheet(gs, 'hkn');
  const r = sub(gs, 'hkn', okHkn({ 'Trình Sở': 'Không trình Sở' }));
  assert.equal(r.ok, true);
  assert.ok(!sh._d[0].includes('Trình Sở'));
  assert.ok(r.warnings.some(w => /chưa có cột "Trình Sở"/.test(w)));
  const cho = gs.sheets.TrinhSo_ChoCot._d;
  assert.deepEqual(plain(cho[1].slice(0, 3)), ['hkn', r.stt, 'Không trình Sở']);
  const kq = plain(gs.capNhatCotSheet());
  assert.equal(kq.trinh_so_dien_bu, 1);
  assert.equal(sh._d[0].at(-1), 'Trình Sở');
  assert.equal(rowObj(sh, 2)['Trình Sở'], 'Không trình Sở');
  assert.equal(gs.sheets.TrinhSo_ChoCot._d.length, 1, 'đã điền xong thì xoá dòng chờ');
});

test('giá trị: NFD vẫn nhận (chuẩn NFC); "trinh so", "1", "TRÌNH SỞ" bị từ chối; không gửi → vẫn lưu, để trống', () => {
  const gs = loadGs(); coSaoLuu(gs);
  const sh = addSurveySheet(gs, 'hkn');
  assert.equal(sub(gs, 'hkn', okHkn({ 'Trình Sở': ' Không trình Sở'.normalize('NFD') })).ok, true);
  assert.equal(rowObj(sh, 2)['Trình Sở'], 'Không trình Sở');
  for (const v of ['trinh so', '1', 'TRÌNH SỞ', 'Có']) {
    const r = sub(gs, 'hkn', okHkn({ 'Trình Sở': v }));
    assert.equal(r.ok, false, v);
    assert.match(r.error, /chỉ nhận/);
  }
  // client cũ / hàng chờ: không có trường → vẫn lưu (không kẹt), không đụng cột
  const r = sub(gs, 'hkn', okHkn(), { from_queue: true, client_at: Date.now() - 60e3 });
  assert.equal(r.ok, true);
  assert.equal(rowObj(sh, sh._d.length)['Trình Sở'] ?? '', '');
});

test('Vỏ tủ luôn "Không trình Sở" (máy chủ ép, kèm cảnh báo khi client gửi "Trình Sở")', () => {
  const gs = loadGs(); coSaoLuu(gs);
  const sh = addSurveySheet(gs, 'vo_tu');
  const base = { 'Tuyến đường': 'A', 'Phường': 'Chợ Quán', 'Tủ điều khiển': 'T', 'Số lượng': '1' };
  const a = sub(gs, 'vo_tu', { ...base, 'Trình Sở': 'Trình Sở' });
  assert.equal(a.ok, true);
  assert.ok(a.warnings.some(w => /thẩm quyền Trung tâm/.test(w)));
  const b = sub(gs, 'vo_tu', base);
  assert.equal(b.ok, true);
  assert.equal(rowObj(sh, 2)['Trình Sở'], 'Không trình Sở');
  assert.equal(rowObj(sh, 3)['Trình Sở'], 'Không trình Sở');
});

test('Tăng cường KC xa: đèn HPS + Trình Sở bị chặn (cả khi sửa sang HPS); LED / Không trình Sở thì được', () => {
  const gs = loadGs(); coSaoLuu(gs);
  addSurveySheet(gs, 'tc_den_kc_xa');
  for (const den of ['HPS 150W', 'Cao áp Sodium 250W', 'đèn sơn 150W']) {
    const r = sub(gs, 'tc_den_kc_xa', okKcXa({ 'Chủng loại đèn': den, 'Trình Sở': 'Trình Sở' }));
    assert.equal(r.ok, false, den); assert.match(r.error, /chỉ nhận đèn LED/);
  }
  assert.equal(sub(gs, 'tc_den_kc_xa', okKcXa({ 'Chủng loại đèn': 'HPS 150W', 'Trình Sở': 'Không trình Sở' })).ok, true);
  const ok = sub(gs, 'tc_den_kc_xa', okKcXa({ 'Trình Sở': 'Trình Sở' }));
  assert.equal(ok.ok, true);
  const u = plain(gs.handleUpdate({ token: 't', type: 'tc_den_kc_xa', stt: ok.stt, data: { 'Chủng loại đèn': 'HPS 100W' } }));
  assert.equal(u.ok, false); assert.match(u.error, /chỉ nhận đèn LED/);
});

test('sửa bản khi sheet thiếu cột + chưa có sao lưu: KHÔNG bỏ âm thầm → lưu chờ + cảnh báo', () => {
  const gs = loadGs();
  const sh = addSurveySheet(gs, 'hkn', [{ STT: 'HKN-1', ...okHkn() }]);
  const u = plain(gs.handleUpdate({ token: 't', type: 'hkn', stt: 'HKN-1', data: { 'Trình Sở': 'Trình Sở' } }));
  assert.equal(u.ok, true);
  assert.ok(u.warnings.some(w => /đã lưu tạm/.test(w)));
  assert.deepEqual(plain(gs.sheets.TrinhSo_ChoCot._d[1].slice(0, 3)), ['hkn', 'HKN-1', 'Trình Sở']);
  // có sao lưu → sửa lần sau tự thêm cột và ghi thẳng
  coSaoLuu(gs);
  const u2 = plain(gs.handleUpdate({ token: 't', type: 'hkn', stt: 'HKN-1', data: { 'Trình Sở': 'Không trình Sở' } }));
  assert.equal(u2.ok, true);
  assert.equal(rowObj(sh, 2)['Trình Sở'], 'Không trình Sở');
  assert.ok(u2.changes.includes('Trình Sở'));
});

test('đọc tiêu đề TRONG khoá: có người chèn cột đúng lúc chờ khoá → dòng mới vẫn đúng cột', () => {
  const gs = loadGs(); coSaoLuu(gs);
  const sh = addSurveySheet(gs, 'hkn');
  gs.LockService.getScriptLock = () => ({
    waitLock() { if (!sh._d[0].includes('Chen tay')) { sh._d.forEach((r, i) => r.splice(2, 0, i ? '' : 'Chen tay')); } },
    releaseLock() {}, tryLock: () => true
  });
  const r = sub(gs, 'hkn', okHkn({ 'Trình Sở': 'Trình Sở' }));
  assert.equal(r.ok, true, r.error);
  const row = rowObj(sh, 2);
  assert.equal(row['Tuyến đường'], 'Trần Phú');
  assert.equal(row['Chen tay'], '');
  assert.equal(row['Phường'], 'Chợ Quán');
  assert.equal(row['Trình Sở'], 'Trình Sở');
});

test('loại mới "Thay sửa tủ điều khiển": sheet + STT TST + quy tắc + nhóm trang chủ + báo cáo', async () => {
  const gs = loadGs(); coSaoLuu(gs);
  assert.equal(gs.SHEET_MAP.thay_sua_tu, '18. Thay sua tu');
  assert.equal(gs.STT_PREFIX.thay_sua_tu, 'TST');
  assert.ok(!Object.entries(gs.STT_PREFIX).some(([k, v]) => k !== 'thay_sua_tu' && v === 'TST'));
  assert.ok(gs.GPS_LINK_TYPES.includes('thay_sua_tu'));
  assert.match(read('apps-script/Code.gs'), /const fullHeader = HEADERS\[type\]\.concat\(BONUS_COLS, TAIL_COLS\);/, 'initSheets tạo sheet mới có cả cột Trình Sở');
  const sh = gs.sheets['18. Thay sua tu'] = mkSheet('18. Thay sua tu', [[...gs.HEADERS.thay_sua_tu, ...gs.BONUS_COLS, ...gs.TAIL_COLS]]);
  const r = sub(gs, 'thay_sua_tu', { 'Tuyến đường': 'Pasteur', 'Phường': 'Sài Gòn', 'Tủ điều khiển': 'PT-2', 'Số lượng': '1',
    'Hiện trạng tủ': 'Chưa kết nối trung tâm điều khiển', 'Trình Sở': 'Trình Sở' });
  assert.equal(r.ok, true, r.error);
  assert.match(r.stt, /^TST-/);
  assert.equal(rowObj(sh, 2)['Trình Sở'], 'Trình Sở');
  assert.equal(sub(gs, 'thay_sua_tu', { 'Tuyến đường': 'X', 'Phường': 'Sài Gòn', 'Tủ điều khiển': 'Y' }).ok, false, 'thiếu Số lượng');
  // user1 gửi được + xem được danh sách loại mới
  gs.user = { username: 'ktv01', role: 'user1', full_name: 'KTV' };
  assert.equal(sub(gs, 'thay_sua_tu', { 'Tuyến đường': 'Pasteur', 'Phường': 'Sài Gòn', 'Tủ điều khiển': 'PT-2', 'Số lượng': '1', 'Trình Sở': 'Không trình Sở' }).ok, true);
  assert.equal(plain(gs.handleList({ type: 'thay_sua_tu' })).rows.length >= 1, true);
  const { SURVEY_GROUPS } = await loadSchemas();
  assert.ok(SURVEY_GROUPS.find(g => g.title === 'Tủ điều khiển').keys.includes('thay_sua_tu'));
  assert.match(read('js/report.js'), /thay_sua_tu: '18\. Thay sua tu'/);
  assert.match(read('js/bbht.js'), /thay_sua_tu:/);
});

test('Ngầm hóa: 2 cột mới cuối HEADERS (sau DIALux), không bắt buộc, có trong form theo đúng thứ tự', async () => {
  const gs = loadGs();
  assert.deepEqual(plain(gs.HEADERS.ngam_hoa.slice(-2)), ['Chiều dài cáp ngầm (md)', 'Số trụ']);
  assert.equal(gs.HEADERS.ngam_hoa.indexOf('Loại đèn hiện hữu'), gs.HEADERS.ngam_hoa.length - 3);
  const R = plain(gs.getFieldRules_().ngam_hoa);
  assert.ok(!R.req.includes('Chiều dài cáp ngầm (md)') && !R.req.includes('Số trụ'));
  const { SCHEMAS } = await loadSchemas();
  assert.deepEqual(SCHEMAS.ngam_hoa.fields.slice(-2).map(f => f.label), ['Chiều dài cáp ngầm (md)', 'Số trụ']);
});

test('sao lưu tuần ghi mốc BACKUP_AT', () => {
  assert.match(read('apps-script/Code.gs'), /setProperty\('BACKUP_AT', String\(Date\.now\(\)\)\)/);
});
