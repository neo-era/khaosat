// Liên kết app Quản lý HĐ: token phạm vi 'hd', hd_link, hd_push (ghi nguyên tử theo con trỏ), hd_info.
// Tiêu chí: quanly-hopdong-duytu/docs/04_LienKet-KhaoSat.md (B1–B6, T6–T7, V2). Code.gs THẬT (đăng nhập, token v2).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadAuthGs } from './_auth-harness.mjs';

const plain = x => JSON.parse(JSON.stringify(x));
/** Code.gs thật + khoá / sheet giả đủ cho hd_push (tryLock, deleteSheet, getSheets). */
function gsThat() {
  const gs = loadAuthGs();
  gs.lockOk = true;
  gs.LockService = { getScriptLock: () => ({ waitLock() {}, tryLock: () => gs.lockOk !== false, releaseLock() {} }) };
  gs.run(`getSpreadsheet = () => ({
    getSheetByName: n => sheets[n] || null,
    insertSheet: n => {
      const sh = __mkSheet(n, [[]]); const g = sh.getRange; sh.fmt = [];
      sh.getRange = (r, c, nr, nc) => { const x = g(r, c, nr, nc); x.setNumberFormat = f => { sh.fmt.push([c, f]); return x; }; return x; };
      return (sheets[n] = sh);
    },
    deleteSheet: sh => { delete sheets[sh.getName()]; },
    getSheets: () => Object.values(sheets)
  });`);
  return gs;
}
/** Token thường (đăng nhập thật) và token phạm vi hd (qua hd_link). */
const tok = (gs, u) => gs.login(u).token;
const hdTok = (gs, u = 'admin') => gs.post({ action: 'hd_link', token: tok(gs, u) }).token;

const DATA = () => ({
  tomTat: [
    ['G1', 'G101TT', 2026, 'HM210', 'Thay trụ thép 9m', 'trụ', 120, 116, 4, 30],
    ['G1', 'G101TT', 2026, 'HM214', 'Móng trụ 9m', 'cái', 120, 116, 4, null],
    ['G2', 'G201NA', 2026, 'HM210', 'Thay trụ thép 9m', 'trụ', 80, 10, 70, null]
  ],
  phuongGoi: [['Bàn Cờ', 'G1'], ['Xuân Hòa', 'G1'], ['Xuân Hòa', 'G2'], ['Tân Định', 'G2']],
  loaiHM: [['thay_tru', 'HM210'], ['thay_tru', 'HM214'], ['thay_den', 'HM101']],
  lienKet: [['thay_tru', 'TT-261105-AB12', 'G1', 'HM210', 'PL III · Đợt 2', 'Đã vào PL', ''],
            ['thay_tru', 'TT-261101-0001', 'G1', 'HM210', 'PL III · Đợt 1', 'Đã thực hiện', '10/2026']]
});
const push = (gs, token, extra = {}) => gs.post(Object.assign({ action: 'hd_push', token, data: DATA(),
  meta: { source_file_id: 'f1', generated_at: '2026-11-09T02:00:00Z' } }, extra));

test('token phạm vi hd: chữ ký gắn phạm vi, bỏ phạm vi thì sai chữ ký', () => {
  const gs = gsThat();
  const t = hdTok(gs);
  assert.equal(gs.verifyToken(t).scope, 'hd');
  assert.equal(gs.verifyToken(tok(gs, 'admin')).scope, '');
  const parts = Buffer.from(t, 'base64url').toString().split('|');
  assert.equal(parts.length, 8);
  const strip = Buffer.from([...parts.slice(0, 6), parts[7]].join('|')).toString('base64url');
  assert.throws(() => gs.verifyToken(strip), /signature/);
});

test('hd_link: cần quyền quản lý/báo cáo, không nhận token hd, hạn 30 ngày', () => {
  const gs = gsThat();
  const r = gs.post({ action: 'hd_link', token: tok(gs, 'admin') });
  assert.equal(r.ok, true);
  assert.equal(r.can_push, true);
  assert.equal(r.expires_at - gs.clock.now, 30 * 864e5);
  assert.match(gs.post({ action: 'hd_link', token: tok(gs, 'ktv01') }).error, /quyền/);
  assert.match(gs.post({ action: 'hd_link', token: r.token }).error, /phạm vi/);
  gs.clock.now += 31 * 864e5;
  assert.equal(gs.post({ action: 'hd_info', token: r.token, phuong: 'Bàn Cờ' }).ok, false, 'hết 30 ngày thì token hd chết');
});

test('token hd bị từ chối ở mọi action ngoài list / hd_push / hd_info (B1)', () => {
  const gs = gsThat();
  const t = hdTok(gs);
  for (const a of ['delete', 'update', 'users', 'user_create', 'reset_password', 'set_status', 'submit', 'export_raw', 'refresh', 'change_password', 'hd_link']) {
    const r = gs.post({ action: a, token: t });
    assert.equal(r.ok, false, a);
    assert.match(r.error, /phạm vi/, a);
  }
  assert.equal(gs.post({ action: 'list', token: t, type: 'vo_tu' }).ok, true, 'list vẫn dùng được');
});

test('đổi mật khẩu → token hd cũ hết hiệu lực', () => {
  const gs = gsThat();
  const t = hdTok(gs);
  gs.run(`setPassword('admin', 'MatKhauMoi!2026', false)`);
  assert.equal(gs.post({ action: 'hd_info', token: t, phuong: 'Bàn Cờ' }).ok, false);
});

test('hd_push: ghi 4 sheet, con trỏ HD_VERSION, cột chữ giữ nguyên văn công thức (B3)', () => {
  const gs = gsThat();
  const t = hdTok(gs);
  const d = DATA(); d.tomTat[0][4] = '=HYPERLINK("http://x")';
  const r = gs.post({ action: 'hd_push', token: t, data: d, meta: { source_file_id: 'f1', generated_at: '2026-11-09T02:00:00Z' } });
  assert.equal(r.ok, true, r.error);
  const ver = JSON.parse(gs.props.HD_VERSION);
  assert.equal(ver.v, 1);
  const sh = gs.sheets['HD_TomTat_v1'];
  assert.ok(sh);
  assert.equal(sh._d[1][4], "'=HYPERLINK(\"http://x\")");
  assert.equal(sh._d.length, 4);
  assert.deepEqual(plain(sh.fmt.map(f => f[0])), [1, 2, 4, 5, 6], 'cột chữ của HD_TomTat định dạng @ trước khi ghi');
  assert.equal(gs.sheets['HD_LienKet_v1'].fmt.length, 7, 'mọi cột HD_LienKet (kể cả "Tháng" 10/2026) là chữ');
  assert.ok(gs.sheets['HD_PhuongGoi_v1'] && gs.sheets['HD_LoaiHM_v1'] && gs.sheets['HD_LienKet_v1']);
  // lần 2: bản mới v2, xoá v1
  const r2 = push(gs, t, { meta: { source_file_id: 'f1', generated_at: '2026-11-09T03:00:00Z' } });
  assert.equal(r2.ok, true);
  assert.equal(JSON.parse(gs.props.HD_VERSION).v, 2);
  assert.ok(!gs.sheets['HD_TomTat_v1'] && gs.sheets['HD_TomTat_v2']);
});

test('hd_push: quyền, kiểu dữ liệu, kích thước, khoá bận, bản cũ hơn (B2)', () => {
  const gs = gsThat();
  assert.match(gs.post({ action: 'hd_push', token: tok(gs, 'ktv01'), data: DATA(), meta: { generated_at: '2026-11-09T02:00:00Z' } }).error, /quyền/);
  const t = hdTok(gs);
  const bad = DATA(); bad.tomTat[0] = ['G1'];
  assert.match(gs.post({ action: 'hd_push', token: t, data: bad, meta: { generated_at: '2026-11-09T02:00:00Z' } }).error, /cột/);
  const obj = DATA(); obj.tomTat[0][3] = { x: 1 };
  assert.match(gs.post({ action: 'hd_push', token: t, data: obj, meta: { generated_at: '2026-11-09T02:00:00Z' } }).error, /kiểu/);
  const big = DATA(); big.lienKet = Array.from({ length: 5001 }, () => ['thay_tru', 'x', 'G1', 'HM', 'p', 's', '']);
  assert.match(gs.post({ action: 'hd_push', token: t, data: big, meta: { generated_at: '2026-11-09T02:00:00Z' } }).error, /5\.000|5000/);
  const huge = DATA(); huge.tomTat = Array.from({ length: 4000 }, () => ['G1', 'G', 2026, 'HM', 'x'.repeat(300), 'm', 1, 1, 1, 1]);
  assert.match(gs.post({ action: 'hd_push', token: t, data: huge, meta: { generated_at: '2026-11-09T02:00:00Z' } }).error, /lớn/);
  gs.lockOk = false;
  assert.match(push(gs, t).error, /bận/);
  gs.lockOk = true;
  assert.equal(push(gs, t).ok, true);
  const cu = push(gs, t, { meta: { source_file_id: 'f2', generated_at: '2026-11-08T00:00:00Z' } });
  assert.equal(cu.ok, false);
  assert.match(cu.error, /cũ hơn/);
  assert.equal(push(gs, t, { meta: { source_file_id: 'f2', generated_at: '2026-11-08T00:00:00Z' }, force: true }).ok, true);
});

test('hd_push lỗi giữa chừng: con trỏ cũ còn nguyên, hd_info vẫn đọc bản cũ (B2)', () => {
  const gs = gsThat();
  const t = hdTok(gs);
  assert.equal(push(gs, t).ok, true);
  gs.run(`this.__f = hdFlush_; hdFlush_ = () => { throw new Error('mất kết nối'); };`);
  const r = push(gs, t, { meta: { source_file_id: 'f1', generated_at: '2026-11-10T00:00:00Z' } });
  assert.equal(r.ok, false);
  assert.equal(r.stack, undefined);
  assert.equal(JSON.parse(gs.props.HD_VERSION).v, 1);
  assert.ok(!gs.sheets['HD_TomTat_v2'], 'bản dở dang phải được dọn');
  gs.run(`hdFlush_ = this.__f;`);
  const info = gs.post({ action: 'hd_info', token: tok(gs, 'ktv01'), phuong: 'Phường Bàn Cờ', type: 'thay_tru' });
  assert.equal(info.ok, true);
  assert.equal(info.goi.goi, 'G1');
});

test('hd_info: gói theo phường (1 gói / nhiều gói / lạ), mã HM của loại, chỉ trường cho phép (T7, B4)', () => {
  const gs = gsThat();
  push(gs, hdTok(gs));
  const t = tok(gs, 'ktv01');
  const a = plain(gs.post({ action: 'hd_info', token: t, phuong: 'P. Bàn Cờ', type: 'thay_tru', nam: 2026 }));
  assert.equal(a.has, true);
  assert.deepEqual(a.goi, { goi: 'G1', goiList: ['G1'], maGoiThau: 'G101TT' });
  assert.deepEqual(a.hm.map(h => [h.ma, h.hd, h.conLai]), [['HM210', 120, 4], ['HM214', 120, 4]]);
  assert.deepEqual(Object.keys(a.hm[0]).sort(), ['conLai', 'daKH', 'dvt', 'hd', 'ma', 'nam', 'nhom', 'ten'].sort(), 'chỉ trường cho phép (GĐ2 thêm nhóm), không tiền/đơn giá');
  assert.ok(a.updated_at);
  const b = plain(gs.post({ action: 'hd_info', token: t, phuong: 'Phường Xuân Hòa', type: 'thay_tru', nam: 2026 }));
  assert.equal(b.goi.goi, 'nhieu');
  assert.deepEqual(b.goi.goiList, ['G1', 'G2']);
  assert.deepEqual(b.hm, [], 'nhiều gói thì không hiện KL của gói nào');
  assert.equal(plain(gs.post({ action: 'hd_info', token: t, phuong: 'P.Bàn Cờ', type: 'thay_tru', nam: 2026 })).goi.goi, 'G1', '"P.Bàn Cờ" (không dấu cách) vẫn khớp');
  assert.equal(plain(gs.post({ action: 'hd_info', token: t, phuong: 'Phan Đình Phùng', type: 'thay_tru', nam: 2026 })).goi.goi, null, 'tên bắt đầu bằng "P" không bị cắt');
  const c = plain(gs.post({ action: 'hd_info', token: t, phuong: 'Phường Lạ', type: 'thay_tru', nam: 2026 }));
  assert.equal(c.goi.goi, null);
  const d = plain(gs.post({ action: 'hd_info', token: t, pairs: [{ type: 'thay_tru', stt: 'TT-261105-AB12' }, { type: 'thay_tru', stt: 'khong-co' }] }));
  assert.deepEqual(d.lienKet, [{ type: 'thay_tru', stt: 'TT-261105-AB12', goi: 'G1', phuLuc: 'PL III · Đợt 2', trangThai: 'Đã vào PL', thang: '' }]);
});

test('hd_info: từ chối demo, quá 500 cặp; chưa có dữ liệu thì has=false', () => {
  const gs = gsThat();
  const t = tok(gs, 'ktv01');
  assert.deepEqual(plain(gs.post({ action: 'hd_info', token: t, phuong: 'Bàn Cờ', type: 'thay_tru' })), { ok: true, has: false });
  push(gs, hdTok(gs));
  assert.match(gs.post({ action: 'hd_info', token: tok(gs, 'demo'), phuong: 'Bàn Cờ' }).error, /quyền/);
  const pairs = Array.from({ length: 501 }, (_, i) => ({ type: 'thay_tru', stt: 'x' + i }));
  assert.match(gs.post({ action: 'hd_info', token: t, pairs }).error, /500/);
});

test('hd_info: con trỏ trỏ tới sheet đã mất → coi như chưa có dữ liệu', () => {
  const gs = gsThat();
  push(gs, hdTok(gs));
  delete gs.sheets['HD_TomTat_v1'];
  assert.deepEqual(plain(gs.post({ action: 'hd_info', token: tok(gs, 'ktv01'), phuong: 'Bàn Cờ', type: 'thay_tru' })), { ok: true, has: false });
});

test('không sửa tiêu đề 17 sheet khảo sát; action lạ vẫn trả "unknown action" (V2)', () => {
  const gs = gsThat();
  assert.match(gs.post({ action: 'khong_co', token: tok(gs, 'admin') }).error, /^unknown action/);
  assert.ok(!Object.values(gs.SHEET_MAP).some(n => /^HD_/.test(n)));
});
