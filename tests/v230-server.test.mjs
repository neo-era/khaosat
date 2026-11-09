// v2.3.0 — máy chủ: chống gửi trùng (client_id), giờ khảo sát offline (client_at), kiểm dữ liệu
// (FIELD_RULES), toạ độ, lưu vết sửa/xoá/khôi phục, sheet thiếu cột, chống chèn công thức.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadGs, addSurveySheet, rowObj, loadSchemas, mkSheet } from './_harness.mjs';
import { loadAuthGs } from './_auth-harness.mjs';
import { expectedFieldRules } from './_field-rules.mjs';

const HOUR = 3600e3;
const vnStr = ms => new Date(ms + 7 * HOUR).toISOString().slice(0, 19).replace('T', ' ');
const okHkn = (extra = {}) => ({ 'Tuyến đường': 'Trần Phú', 'Phường': 'Chợ Quán', 'Tủ điều khiển': 'TP-1',
  'Số lượng': '2', 'Loại hộp (6A, 10A)': '6A', ...extra });
const NO_AUTH_WORDS = /token|invalid|forbidden|expired/i;

// ---------- FIELD_RULES đồng bộ schemas.js ----------
test('FIELD_RULES trong Code.gs khớp quy tắc sinh từ js/schemas.js', async () => {
  const gs = loadGs();
  const { SCHEMAS } = await loadSchemas();
  const actual = JSON.parse(JSON.stringify(gs.getFieldRules_()));
  assert.deepEqual(actual, expectedFieldRules(SCHEMAS));
});

// ---------- C2: client_id ----------
test('C2 gửi lại cùng client_id → 1 dòng, cùng STT, duplicate:true', () => {
  const gs = loadGs();
  const sh = addSurveySheet(gs, 'hkn');
  const a = gs.handleSubmit({ token: 't', type: 'hkn', data: okHkn(), client_id: 'cid-0001-aaaa' });
  const b = gs.handleSubmit({ token: 't', type: 'hkn', data: okHkn(), client_id: 'cid-0001-aaaa' });
  assert.equal(a.ok, true, a.error); assert.equal(b.ok, true);
  assert.equal(b.duplicate, true);
  assert.equal(String(b.stt), String(a.stt));
  assert.equal(sh._d.length, 2, 'chỉ 1 dòng dữ liệu');
  const c = gs.handleSubmit({ token: 't', type: 'hkn', data: okHkn(), client_id: 'cid-0002-bbbb' });
  assert.equal(c.ok, true); assert.notEqual(String(c.stt), String(a.stt));
  assert.equal(sh._d.length, 3);
  assert.equal(gs.sheets.client_ids._d.length, 3, 'header + 2 client_id');
  // client_id rác bị bỏ qua (coi như không có), không làm hỏng việc ghi
  assert.equal(gs.handleSubmit({ token: 't', type: 'hkn', data: okHkn(), client_id: '<script>' }).ok, true);
});

// ---------- C3: client_at ----------
test('C3 bản từ hàng chờ dùng giờ máy lúc bấm Lưu (≤ 72 giờ) cho Ngày khảo sát và mã STT', () => {
  const gs = loadGs();
  const sh = addSurveySheet(gs, 'hkn');
  const at = Date.now() - 10 * HOUR;
  const r = gs.handleSubmit({ token: 't', type: 'hkn', data: okHkn(), client_id: 'cid-q-000001', from_queue: true, client_at: at });
  assert.equal(r.ok, true, r.error);
  const row = rowObj(sh, 2);
  assert.equal(row['Ngày khảo sát'], vnStr(at));
  assert.match(String(row['STT']), new RegExp('-' + vnStr(at).slice(2, 10).replace(/-/g, '') + '-'));
  assert.ok(Date.now() - new Date(row['Submitted At']).getTime() < 60e3, 'Submitted At vẫn là giờ máy chủ');
  assert.ok(gs.audit.some(a => a[0] === 'client_time'), 'lệch > 10 phút ghi Audit');
});

test('C3 giờ máy ngoài khoảng / không từ hàng chờ → giờ máy chủ', () => {
  for (const [label, extra] of [
    ['quá 72 giờ', { from_queue: true, client_at: Date.now() - 73 * HOUR }],
    ['tương lai', { from_queue: true, client_at: Date.now() + 2 * HOUR }],
    ['không phải hàng chờ', { client_at: Date.now() - 5 * HOUR }],
    ['rác', { from_queue: true, client_at: 'abc' }]
  ]) {
    const gs = loadGs();
    const sh = addSurveySheet(gs, 'hkn');
    const r = gs.handleSubmit({ token: 't', type: 'hkn', data: okHkn(), client_id: 'cid-x-' + label.length + 'aaaaa', ...extra });
    assert.equal(r.ok, true, label);
    const ngay = new Date(rowObj(sh, 2)['Ngày khảo sát'].replace(' ', 'T') + '+07:00').getTime();
    assert.ok(Math.abs(Date.now() - ngay) < 60e3, label);
  }
});

// ---------- C4: kiểm dữ liệu ----------
test('C4 bản mới (có client_id): thiếu trường bắt buộc / số sai → từ chối, nêu tên trường', () => {
  const gs = loadGs();
  const sh = addSurveySheet(gs, 'hkn');
  let n = 0;
  const sub = data => gs.handleSubmit({ token: 't', type: 'hkn', data, client_id: 'cid-v-' + String(++n).padStart(6, '0') });
  const cases = [
    [okHkn({ 'Tuyến đường': '' }), /Tuyến đường/],
    [okHkn({ 'Số lượng': '0' }), /Số lượng/],
    [okHkn({ 'Số lượng': '2.5' }), /Số lượng/],
    [okHkn({ 'Số lượng': 'hai' }), /Số lượng/],
    [okHkn({ 'Năm lắp đặt': 'năm ngoái' }), /Năm lắp đặt/],
    [okHkn({ 'Năm lắp đặt': '-3' }), /Năm lắp đặt/]
  ];
  for (const [data, re] of cases) {
    const r = sub(data);
    assert.equal(r.ok, false, JSON.stringify(data));
    assert.match(r.error, re);
    assert.doesNotMatch(r.error, NO_AUTH_WORDS, 'không làm client tưởng hết phiên');
  }
  assert.equal(sh._d.length, 1);
  for (const data of [okHkn({ 'Quận': '' }), okHkn({ 'Năm lắp đặt': '1890' }), okHkn({ 'Số lượng': ' 3 ' })]) {
    const r = sub(data); assert.equal(r.ok, true, JSON.stringify(data) + ' ' + r.error);
  }
});

test('C4 số đo mét nhận thập phân và dấu phẩy, trường không bắt buộc nhận 0', () => {
  const gs = loadGs();
  addSurveySheet(gs, 'tc_ngam');
  addSurveySheet(gs, 'ngam_hoa');
  const base = { 'Tuyến đường': 'A', 'Phường': 'B', 'Tủ điều khiển': 'C' };
  const r1 = gs.handleSubmit({ token: 't', type: 'tc_ngam', client_id: 'cid-m-000001', data: { ...base, 'Số lượng': '2,5' } });
  assert.equal(r1.ok, true, r1.error);
  const r0 = gs.handleSubmit({ token: 't', type: 'tc_ngam', client_id: 'cid-m-000002', data: { ...base, 'Số lượng': '0' } });
  assert.equal(r0.ok, false);
  const nh = { ...base, 'Độ rộng đường': '12', 'Số đèn dự kiến': '4', 'Kiểu bố trí trụ': '1 bên', 'Khoảng cách trụ': '30',
    'Chiều cao trụ': '8', 'Số đèn thu hồi': '0', 'Bề rộng dải phân cách': '0', 'Góc nghiêng cần': '0', 'Vỉa hè đá': '0' };
  const r2 = gs.handleSubmit({ token: 't', type: 'ngam_hoa', client_id: 'cid-m-000003', data: nh });
  assert.equal(r2.ok, true, r2.error);
});

test('C4 máy chưa cập nhật (không client_id): lỗi dữ liệu chỉ là cảnh báo, vẫn ghi', () => {
  const gs = loadGs();
  const sh = addSurveySheet(gs, 'hkn');
  const r = gs.handleSubmit({ token: 't', type: 'hkn', data: okHkn({ 'Tuyến đường': '', 'Số lượng': '0' }) });
  assert.equal(r.ok, true);
  assert.ok(r.warnings && r.warnings.length >= 2);
  assert.equal(sh._d.length, 2);
});

test('C4 toạ độ ngoài TP.HCM / (0,0) / đảo → vẫn lưu, bỏ trống toạ độ + link, có cảnh báo', () => {
  for (const [lat, lng] of [[0, 0], [106.7, 10.77], [21.0, 105.8]]) {
    const gs = loadGs();
    const sh = addSurveySheet(gs, 'thao_go_bang_ron');
    const r = gs.handleSubmit({ token: 't', type: 'thao_go_bang_ron', client_id: 'cid-g-' + String(lat).replace('.', '') + 'xxxxx',
      data: { 'Tuyến đường': 'A', 'Phường': 'B', 'Loại quảng cáo': 'Băng rôn', 'Số lượng': '3',
        'vĩ độ': String(lat), 'kinh độ': String(lng), 'Link Google Map': `https://www.google.com/maps?q=${lat},${lng}` } });
    assert.equal(r.ok, true, r.error);
    const row = rowObj(sh, 2);
    assert.equal(row['vĩ độ'], ''); assert.equal(row['kinh độ'], ''); assert.equal(row['Link Google Map'], '');
    assert.ok(r.warnings.some(w => /toạ độ|tọa độ/i.test(w)));
  }
  const gs = loadGs();
  const sh = addSurveySheet(gs, 'thao_go_bang_ron');
  gs.handleSubmit({ token: 't', type: 'thao_go_bang_ron', client_id: 'cid-g-okokokok',
    data: { 'Tuyến đường': 'A', 'Phường': 'B', 'Loại quảng cáo': 'Băng rôn', 'Số lượng': '3', 'vĩ độ': '10.7769', 'kinh độ': '106.7009' } });
  assert.equal(String(rowObj(sh, 2)['vĩ độ']), '10.7769');
});

test('C4 báo cáo sự cố: ngày giờ phát hiện ở tương lai (> 5 phút) bị từ chối', () => {
  const gs = loadGs();
  addSurveySheet(gs, 'bao_cao_su_co');
  const base = { 'Đơn vị báo cáo': 'CSKVTT', 'Tủ điều khiển': 'A', 'Tuyến đường': 'B', 'Phường': 'C',
    'Hiện trạng sự cố': 'Đổ trụ', 'Đề xuất khắc phục': 'Thay trụ' };
  const fut = vnStr(Date.now() + 2 * HOUR).slice(0, 16);
  const past = vnStr(Date.now() - 2 * HOUR).slice(0, 16);
  assert.equal(gs.handleSubmit({ token: 't', type: 'bao_cao_su_co', client_id: 'cid-s-000001', data: { ...base, 'Ngày giờ phát hiện': fut } }).ok, false);
  assert.equal(gs.handleSubmit({ token: 't', type: 'bao_cao_su_co', client_id: 'cid-s-000002', data: { ...base, 'Ngày giờ phát hiện': past } }).ok, true);
});

// ---------- T8: sửa / xoá / khôi phục ----------
test('T8 sửa: chỉ kiểm trường đổi; xoá trống trường bắt buộc bị từ chối; Audit ghi cũ → mới', () => {
  const gs = loadGs();
  addSurveySheet(gs, 'tc_ngam', [{ STT: 'TCG-1', 'Tuyến đường': 'Cũ', 'Phường': 'P', 'Tủ điều khiển': 'T', 'Số lượng': '39m' }]);
  const ok = gs.handleUpdate({ token: 't', type: 'tc_ngam', stt: 'TCG-1', data: { 'Tuyến đường': 'Mới', 'Số lượng': '39m' } });
  assert.equal(ok.ok, true, ok.error);
  const au = gs.audit.find(a => a[0] === 'update');
  assert.match(au[4], /Tuyến đường: Cũ → Mới/);
  assert.equal(gs.handleUpdate({ token: 't', type: 'tc_ngam', stt: 'TCG-1', data: { 'Tuyến đường': '' } }).ok, false);
  assert.equal(gs.handleUpdate({ token: 't', type: 'tc_ngam', stt: 'TCG-1', data: { 'Số lượng': 'ba mươi' } }).ok, false);
});

test('T8 xoá: bắt buộc lý do ≥ 5 ký tự, ghi Audit; không xoá bản Nghiệm thu', () => {
  const gs = loadAuthGs();
  addSurveySheet(gs, 'thay_den', [
    { STT: 'TD-1', 'Trạng thái xử lý': 'Chờ thiết kế' },
    { STT: 'TD-2', 'Trạng thái xử lý': 'Nghiệm thu' }
  ]);
  addSurveySheet(gs, 'thao_go_bang_ron', [{ STT: 'BR-1' }]);
  const tok = gs.login('admin').token;
  assert.equal(gs.post({ action: 'delete', token: tok, type: 'thay_den', stt: 'TD-1' }).ok, false);
  assert.equal(gs.post({ action: 'delete', token: tok, type: 'thay_den', stt: 'TD-1', reason: 'nhầm' }).ok, false);
  const r = gs.post({ action: 'delete', token: tok, type: 'thay_den', stt: 'TD-1', reason: 'Nhập trùng tuyến' });
  assert.equal(r.ok, true, r.error);
  assert.ok(gs.audit.some(a => a[0] === 'delete' && /Nhập trùng tuyến/.test(a[4])));
  const nt = gs.post({ action: 'delete', token: tok, type: 'thay_den', stt: 'TD-2', reason: 'Không cần nữa' });
  assert.equal(nt.ok, false); assert.match(nt.error, /Nghiệm thu/);
  assert.equal(gs.post({ action: 'delete', token: tok, type: 'thao_go_bang_ron', stt: 'BR-1', reason: 'Nhập trùng' }).ok, true);
});

test('T8 khôi phục: lấy ảnh Drive của app ra khỏi thùng rác', () => {
  const gs = loadAuthGs();
  gs.drive.addFile('ANH1', { parent: 'ROOT' });
  gs.drive.addFile('NGOAI', { parent: 'OUTSIDE' });
  addSurveySheet(gs, 'thay_den', [{ STT: 'TD-1', 'Deleted At': 'x', 'Ảnh (URLs)':
    'https://drive.google.com/uc?export=view&id=ANH1|https://drive.google.com/uc?export=view&id=NGOAI|https://res.cloudinary.com/dmlsqbe8c/image/upload/khaosat/a.jpg' }]);
  const tok = gs.login('admin').token;
  const r = gs.post({ action: 'restore', token: tok, type: 'thay_den', stt: 'TD-1' });
  assert.equal(r.ok, true, r.error);
  assert.deepEqual([...gs.drive.untrashed], ['ANH1']);
  assert.equal(r.photos_restored, 1);
  assert.equal(r.photos_lost, 2);
});

// ---------- Sheet thiếu cột ----------
test('Sheet thiếu cột: vẫn ghi, cảnh báo, Audit ghi cột + giá trị bị rơi mỗi lần', () => {
  const gs = loadGs();
  const header = gs.HEADERS.hkn.concat(gs.BONUS_COLS).filter(h => h !== 'Ghi chú');
  gs.sheets[gs.SHEET_MAP.hkn] = mkSheet(gs.SHEET_MAP.hkn, [header]);
  const r = gs.handleSubmit({ token: 't', type: 'hkn', client_id: 'cid-h-000001', data: okHkn({ 'Ghi chú': 'hộp bị nứt' }) });
  assert.equal(r.ok, true);
  assert.ok(r.warnings.some(w => /Ghi chú/.test(w)));
  const a = gs.audit.filter(x => x[0] === 'header_mismatch');
  assert.equal(a.length, 1);
  assert.match(a[0][4], /Ghi chú=hộp bị nứt/);
});

// ---------- Chống chèn công thức ở các đường ghi khác ----------
test('sanitizeCell áp cho tài liệu, lịch công tác, họ tên, nhập Excel', () => {
  const gs = loadGs();
  gs.sheets.tailieu = mkSheet('tailieu', [['id', 'title', 'category', 'url', 'description', 'added_by', 'added_at']]);
  gs.handleDocsCreate({ token: 't', title: '=HYPERLINK("x")', category: 'Khác', url: 'https://a.b', description: '@x' });
  assert.match(String(gs.sheets.tailieu._d[1][1]), /^'=/);
  assert.match(String(gs.sheets.tailieu._d[1][4]), /^'@/);

  gs.sheets.lichcongtac = mkSheet('lichcongtac', [['id', 'ktv_username', 'ngay', 'loai_ks', 'khu_vuc', 'ghi_chu', 'status', 'created_by', 'created_at']]);
  gs.handleScheduleCreate({ token: 't', items: [{ ktv_username: 'a', ngay: '2026-11-10', khu_vuc: '+Q1', ghi_chu: '=1' }] });
  assert.match(String(gs.sheets.lichcongtac._d[1][4]), /^'\+/);
  assert.match(String(gs.sheets.lichcongtac._d[1][5]), /^'=/);

  const sh = addSurveySheet(gs, 'hkn');
  gs.handleBulkImport({ token: 't', type: 'hkn', rows: [{ 'Tuyến đường': '=IMPORTXML("x")', 'Số lượng': 'ba' }] });
  assert.match(String(rowObj(sh, 2)['Tuyến đường']), /^'=/);
  assert.equal(rowObj(sh, 2)['Số lượng'], 'ba', 'nhập dữ liệu cũ không áp FIELD_RULES');
});
