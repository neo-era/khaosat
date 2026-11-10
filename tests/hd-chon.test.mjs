// GĐ2 liên kết HĐ: chọn gói + mã hạng mục HĐ ngay trong form khảo sát (anh yêu cầu 10/11/2026).
// Tiêu chí: quanly-hopdong-duytu/docs/04_LienKet-KhaoSat.md mục 6 (C1–C10 + thay đổi bắt buộc 6.3).
// Code.gs THẬT (đăng nhập, token v2); sheet giả, không gọi mạng.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadAuthGs } from './_auth-harness.mjs';
import { addSurveySheet } from './_harness.mjs';

const plain = x => JSON.parse(JSON.stringify(x));
function gsThat() {
  const gs = loadAuthGs();
  gs.LockService = { getScriptLock: () => ({ waitLock() {}, tryLock: () => gs.lockOk !== false, releaseLock() {} }) };
  gs.run(`getSpreadsheet = () => ({
    getSheetByName: n => sheets[n] || null,
    insertSheet: n => {
      const sh = __mkSheet(n, [[]]); const g = sh.getRange;
      sh.getRange = (r, c, nr, nc) => { const x = g(r, c, nr, nc); x.setNumberFormat = () => x; return x; };
      return (sheets[n] = sh);
    },
    deleteSheet: sh => { delete sheets[sh.getName()]; },
    getSheets: () => Object.values(sheets)
  });`);
  addSurveySheet(gs, 'thay_den');
  return gs;
}
const tok = (gs, u) => gs.login(u).token;
const hdTok = (gs, u = 'admin') => gs.post({ action: 'hd_link', token: tok(gs, u) }).token;

const DATA = (loai3 = true) => ({
  tomTat: [
    ['G1', 'G101TT', 2026, 'HM186', 'Thay thế bộ đèn Led chiếu sáng đường phố', 'bộ', 120, 86, 34, null],
    ['G1', 'G101TT', 2026, 'HM187', 'Lắp đặt bộ đèn đường LED 100W-<110W', 'bộ', 50, 0, 50, null],
    ['G1', 'G101TT', 2026, 'HM207', 'Tháo dỡ bộ đèn', 'bộ', 80, 10, 70, null],
    ['G1', 'G101TT', 2027, 'HM186', 'Thay thế bộ đèn Led chiếu sáng đường phố', 'bộ', 100, 0, 100, null],
    ['G2', 'G201NA', 2026, 'HM186', 'Thay thế bộ đèn Led chiếu sáng đường phố', 'bộ', 40, 40, 0, null],
    ['G2', 'G201NA', 2026, 'HM186_cg', 'Thay thế bộ đèn Led chiếu sáng đường phố', 'Bộ', 40, 0, 40, null],
    ['G2', 'G201NA', 2026, 'HM286', 'Thay thế trụ đèn thép cao ≤9m', '1 Trụ', 10, 0, 10, null]
  ],
  phuongGoi: [['Bàn Cờ', 'G1'], ['Xuân Hòa', 'G1'], ['Xuân Hòa', 'G2'], ['Tân Định', 'G2']],
  loaiHM: loai3
    ? [['thay_den', 'HM186', 'Thay bộ đèn'], ['thay_den', 'HM187', 'Lắp đặt bộ đèn'], ['thay_den', 'HM207', 'Tháo dỡ · di dời đèn'],
       ['thay_den', 'HM186_cg', 'Thay bộ đèn'], ['thay_tru', 'HM286', 'Thay trụ']]
    : [['thay_den', 'HM186'], ['thay_tru', 'HM286']],
  lienKet: [['thay_den', 'TD-DAVAO', 'G1', 'HM186', 'PL II · Đợt 1', 'Đã vào PL', '']]
});
const push = (gs, data = DATA()) => gs.post({ action: 'hd_push', token: hdTok(gs), data, meta: { generated_at: '2026-11-10T02:00:00Z' } });
const TD = (extra = {}) => ({ 'Tuyến đường': 'Châu Văn Liêm', 'Phường': 'Chợ Lớn', 'Tủ điều khiển': 'CVL-3', 'Số đèn hiện hữu': '4',
  'Độ rộng đường': '12', 'Kiểu bố trí trụ': '1 bên', 'Khoảng cách trụ': '30', 'Chiều cao trụ': '9', ...extra });
const HD = (ds, extra = {}) => ({ nam: 2026, goi: 'G1', ds, ...extra });
const submit = (gs, t, hd, extra = {}) => gs.post({ action: 'submit', token: t, type: 'thay_den', data: TD(extra.data), hd, ...extra.body });
const chonRows = gs => plain(gs.sheets.HD_ChonHM ? gs.sheets.HD_ChonHM._d.slice(1) : []);

test('hd_push nhận loaiHM 3 cột (có nhóm) và 2 cột (app HĐ cũ)', () => {
  const gs = gsThat();
  assert.equal(push(gs).ok, true);
  assert.equal(push(gs, DATA(false)).ok, true, 'bản 2 cột vẫn nhận');
  const r = plain(gs.post({ action: 'hd_info', token: tok(gs, 'ktv01'), phuong: 'Bàn Cờ', type: 'thay_den', nam: 2026 }));
  assert.equal(r.hm[0].nhom, '', 'bản 2 cột → nhóm rỗng');
});

test('hd_info: cờ chon, danh sách gói/năm, nhóm theo loại, ẩn _cg, chọn gói khi phường chưa có (C2)', () => {
  const gs = gsThat(); push(gs);
  const t = tok(gs, 'ktv01');
  const a = plain(gs.post({ action: 'hd_info', token: t, phuong: 'Chợ Lớn', type: 'thay_den', nam: 2026 }));
  assert.equal(a.chon, true);
  assert.equal(a.goi.goi, null);
  assert.deepEqual(a.goiAll, [{ goi: 'G1', maGoiThau: 'G101TT' }, { goi: 'G2', maGoiThau: 'G201NA' }]);
  assert.deepEqual(a.phuongGoi, [['Bàn Cờ', 'G1'], ['Xuân Hòa', 'G1'], ['Xuân Hòa', 'G2'], ['Tân Định', 'G2']]);
  assert.deepEqual(a.hm, [], 'chưa chọn gói → chưa có mã');
  const b = plain(gs.post({ action: 'hd_info', token: t, phuong: 'Chợ Lớn', type: 'thay_den', nam: 2026, goi: 'G1' }));
  assert.equal(b.goiDung, 'G1');
  assert.deepEqual(b.hm.map(h => [h.ma, h.nhom, h.conLai]), [['HM186', 'Thay bộ đèn', 34], ['HM187', 'Lắp đặt bộ đèn', 50], ['HM207', 'Tháo dỡ · di dời đèn', 70]]);
  assert.deepEqual(b.namList, [2026, 2027]);
  const c = plain(gs.post({ action: 'hd_info', token: t, phuong: 'Chợ Lớn', type: 'thay_den', nam: 2026, goi: 'G2' }));
  assert.deepEqual(c.hm.map(h => h.ma), ['HM186'], 'ẩn HM186_cg');
  const d = plain(gs.post({ action: 'hd_info', token: t, phuong: 'Bàn Cờ', type: 'thay_den', nam: 2026, goi: 'G2' }));
  assert.equal(d.goiDung, 'G1', 'phường đã có 1 gói → không cho đổi gói');
  const e = plain(gs.post({ action: 'hd_info', token: t, phuong: 'Chợ Lớn', type: 'thay_den', nam: 2026, goi: 'G2', tatCa: true }));
  assert.deepEqual(e.hmKhac.map(h => [h.loai, h.ma]), [['thay_tru', 'HM286']], 'nhóm của loại khác');
  const f = plain(gs.post({ action: 'hd_info', token: t, phuong: 'Chợ Lớn', type: 'thay_den', nam: 2026, goi: '=G1' }));
  assert.equal(f.goiDung, null, 'gói sai mẫu bị bỏ qua');
});

test('submit kèm lựa chọn: lưu HD_ChonHM, trả hd_saved; list trả _hd khi hỏi (C3)', () => {
  const gs = gsThat(); push(gs);
  const t = tok(gs, 'ktv01');
  const r = submit(gs, t, HD([{ ma: 'HM207', heSo: 1 }, { ma: 'HM187', heSo: 1 }], { goiTay: true }), { body: { client_id: 'cid-hd-0001' } });
  assert.equal(r.ok, true, r.error);
  assert.equal(r.hd_saved, true);
  assert.deepEqual(chonRows(gs).map(x => [x[0], String(x[1]) === String(r.stt), x[2], x[3], x[4], x[5], x[6], x[7], x[8]]),
    [['thay_den', true, 2026, 'G1', 'Có', 'HM207', 1, 'Tháo dỡ bộ đèn', 'ktv01'],
     ['thay_den', true, 2026, 'G1', 'Có', 'HM187', 1, 'Lắp đặt bộ đèn đường LED 100W-<110W', 'ktv01']]);
  const l = plain(gs.post({ action: 'list', token: tok(gs, 'admin'), type: 'thay_den', hd: true }));
  assert.deepEqual(l.rows[0]._hd, { nam: 2026, goi: 'G1', goiTay: true, ds: [{ ma: 'HM207', heSo: 1 }, { ma: 'HM187', heSo: 1 }] });
  assert.equal(plain(gs.post({ action: 'list', token: hdTok(gs), type: 'thay_den' })).rows[0]._hd.goi, 'G1', 'token hd (app HĐ) luôn nhận _hd');
  assert.equal(plain(gs.post({ action: 'list', token: t, type: 'thay_den' })).rows[0]._hd, undefined, 'không hỏi thì không trả');
  const n = submit(gs, t, undefined);
  assert.equal(n.ok, true);
  assert.equal(n.hd_saved, undefined, 'không chọn → không ghi gì');
  assert.equal(chonRows(gs).length, 2);
});

test('mã/gói sai không làm hỏng bản khảo sát: vẫn lưu, bỏ phần mã, trả hd_warning (C4)', () => {
  const gs = gsThat(); push(gs);
  const t = tok(gs, 'ktv01');
  const ca = [
    [HD([{ ma: 'HM286', heSo: 1 }]), /không có trong gói G1/],
    [HD([{ ma: 'HM186', heSo: 1 }], { nam: 2025 }), /năm 2025/],
    [HD([{ ma: '=HYPERLINK("x")', heSo: 1 }]), /Mã/],
    [HD([{ ma: 'HM186_cg', heSo: 1 }]), /Mã/],
    [HD([{ ma: 'HM186', heSo: 0 }]), /hệ số/],
    [HD([{ ma: 'HM186', heSo: 1 }, { ma: 'HM187' }, { ma: 'HM207' }, { ma: 'HM186' }]), /tối đa 3|trùng/],
    [HD([{ ma: 'HM186', heSo: 1 }], { goi: 'G9' }), /không có trong gói G9/],
    [{ goi: 'G1', ds: 'x' }, /Thiếu/]
  ];
  for (const [hd, re] of ca) {
    const r = submit(gs, t, hd);
    assert.equal(r.ok, true, JSON.stringify(hd));
    assert.ok(r.stt);
    assert.match(r.hd_warning || '', re, JSON.stringify(hd));
  }
  assert.equal(chonRows(gs).length, 0);
  const g = submit(gs, t, HD([{ ma: 'HM186', heSo: 1 }], { goi: 'G2' }), { data: { 'Phường': 'Bàn Cờ' } });
  assert.match(g.hd_warning, /Bàn Cờ thuộc gói G1/, 'phường 1 gói → gói phải trùng');
});

test('gửi lại trùng client_id: không đè lựa chọn đã có (thứ tự ghi)', () => {
  const gs = gsThat(); push(gs);
  const t = tok(gs, 'ktv01');
  const a = submit(gs, t, HD([{ ma: 'HM186', heSo: 1 }]), { body: { client_id: 'cid-dup-0001' } });
  const b = submit(gs, t, HD([{ ma: 'HM187', heSo: 1 }]), { body: { client_id: 'cid-dup-0001' } });
  assert.equal(b.duplicate, true);
  assert.equal(String(b.stt), String(a.stt));
  assert.deepEqual(chonRows(gs).map(x => x[5]), ['HM186']);
});

test('update: không gửi hd → giữ; hd:null → bỏ chọn; hd mới → thay (C3)', () => {
  const gs = gsThat(); push(gs);
  const r = submit(gs, tok(gs, 'ktv01'), HD([{ ma: 'HM186', heSo: 1 }]));
  const ta = tok(gs, 'admin');
  assert.equal(gs.post({ action: 'update', token: ta, type: 'thay_den', stt: r.stt, data: { 'Ghi chú': 'sửa' } }).ok, true);
  assert.deepEqual(chonRows(gs).map(x => x[5]), ['HM186'], 'không gửi hd → giữ');
  const u = gs.post({ action: 'update', token: ta, type: 'thay_den', stt: r.stt, data: {}, hd: HD([{ ma: 'HM207', heSo: 1 }, { ma: 'HM187', heSo: 2 }]) });
  assert.equal(u.hd_saved, true);
  assert.deepEqual(chonRows(gs).map(x => [x[5], x[6]]), [['HM207', 1], ['HM187', 2]]);
  gs.post({ action: 'update', token: ta, type: 'thay_den', stt: r.stt, data: {}, hd: null });
  assert.equal(chonRows(gs).length, 0, 'hd:null → bỏ chọn');
});

test('hd_chon: chủ bản / quyền edit / demo / bản đã vào PL / bản đã xoá / token hd (C4)', () => {
  const gs = gsThat(); push(gs);
  const tk = tok(gs, 'ktv01'), ta = tok(gs, 'admin');
  const r = submit(gs, tk, undefined);
  const call = (t, extra) => gs.post({ action: 'hd_chon', token: t, type: 'thay_den', stt: r.stt, ...extra });
  assert.equal(call(tk, { hd: HD([{ ma: 'HM186', heSo: 1 }]) }).ok, true, 'chủ bản được chọn');
  assert.match(call(tok(gs, 'demo'), { hd: HD([{ ma: 'HM186' }]) }).error, /quyền/);
  assert.match(call(hdTok(gs), { hd: HD([{ ma: 'HM186' }]) }).error, /phạm vi/, 'token hd không dùng được');
  assert.equal(call(ta, { hd: null }).ok, true, 'quản lý bỏ chọn');
  assert.equal(chonRows(gs).length, 0);
  assert.match(call(tk, { hd: HD([{ ma: 'HM999' }]) }).error, /không có trong gói/);
  // Bản đã vào PL (app HĐ đẩy sang)
  const sh = gs.sheets[gs.SHEET_MAP.thay_den];
  sh._d[1][0] = 'TD-DAVAO';
  const c2 = (t, extra) => gs.post({ action: 'hd_chon', token: t, type: 'thay_den', stt: 'TD-DAVAO', ...extra });
  assert.match(c2(tk, { hd: HD([{ ma: 'HM186' }]) }).error, /phụ lục/, 'chủ bản không đổi được bản đã vào PL');
  const x = c2(ta, { hd: HD([{ ma: 'HM186' }]) });
  assert.equal(x.ok, false); assert.equal(x.canXacNhan, true, 'quản lý phải xác nhận');
  assert.equal(c2(ta, { hd: HD([{ ma: 'HM186' }]), xacNhan: true }).ok, true);
  // Bản đã xoá
  sh._d[1][sh._d[0].indexOf('Deleted At')] = '2026-11-10 09:00:00';
  assert.match(c2(ta, { hd: null, xacNhan: true }).error, /đã xoá/);
  assert.ok(gs.audit.some(a => a[0] === 'hd_chon'), 'ghi Audit');
});

test('máy chủ dùng bảng tra gọn trong cache: submit không đọc lại sheet HD_* (cache)', () => {
  const gs = gsThat(); push(gs);
  const t = tok(gs, 'ktv01');
  submit(gs, t, HD([{ ma: 'HM186', heSo: 1 }]));          // lần đầu dựng bảng tra
  const saved = gs.sheets.HD_TomTat_v1; delete gs.sheets.HD_TomTat_v1;
  const r = submit(gs, t, HD([{ ma: 'HM187', heSo: 1 }]));
  gs.sheets.HD_TomTat_v1 = saved;
  assert.equal(r.hd_saved, true, r.hd_warning);
});

test('danh sách dài cỡ thật: loaiHM 3 cột ~2.000 dòng vẫn đẩy được, quá 5.000 bị chặn', () => {
  const gs = gsThat();
  const d = DATA();
  d.loaiHM = Array.from({ length: 2000 }, (_, i) => ['thay_den', 'HM' + (100 + i), 'Nhóm ' + (i % 5)]);
  assert.equal(push(gs, d).ok, true);
  d.loaiHM = Array.from({ length: 5001 }, (_, i) => ['thay_den', 'HM' + i, 'x']);
  assert.match(push(gs, d).error, /5\.000/);
});

test('update qua cùng chốt với hd_chon: bản đã vào PL cần xacNhan; bản đã xoá không đổi được (review 10/11)', () => {
  const gs = gsThat(); push(gs);
  const tk = tok(gs, 'ktv01'), ta = tok(gs, 'admin');
  submit(gs, tk, undefined);
  const sh = gs.sheets[gs.SHEET_MAP.thay_den];
  sh._d[1][0] = 'TD-DAVAO';
  const u = plain(gs.post({ action: 'update', token: ta, type: 'thay_den', stt: 'TD-DAVAO', data: {}, hd: HD([{ ma: 'HM186' }]) }));
  assert.equal(u.ok, true);                 // phần dữ liệu khảo sát vẫn cập nhật
  assert.ok(!u.hd_saved);
  assert.match(u.hd_warning, /xác nhận/);
  assert.equal(chonRows(gs).length, 0);
  const u2 = plain(gs.post({ action: 'update', token: ta, type: 'thay_den', stt: 'TD-DAVAO', data: {}, hd: HD([{ ma: 'HM186' }]), xacNhan: true }));
  assert.equal(u2.hd_saved, true);
  sh._d[1][sh._d[0].indexOf('Deleted At')] = '2026-11-10 09:00:00';
  const u3 = plain(gs.post({ action: 'update', token: ta, type: 'thay_den', stt: 'TD-DAVAO', data: {}, hd: HD([{ ma: 'HM207' }]), xacNhan: true }));
  assert.ok(!u3.hd_saved);
  assert.deepEqual(chonRows(gs).map(r => r[5]), ['HM186']);
});

test('kiểm mã HĐ ném lỗi (đọc sheet quá giờ) → bản khảo sát VẪN lưu, chỉ báo hd_warning (review 10/11)', () => {
  const gs = gsThat(); push(gs);
  gs.run('hdIdx_ = () => { throw new Error("Service Spreadsheets timed out"); }');
  const r = plain(submit(gs, tok(gs, 'ktv01'), HD([{ ma: 'HM186' }])));
  assert.equal(r.ok, true);
  assert.ok(r.stt);
  assert.match(r.hd_warning, /timed out/);
  assert.equal(chonRows(gs).length, 0);
});
