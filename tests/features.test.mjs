// Các tính năng máy chủ 27–29/09/2026: cảnh báo trùng, chèn cột, trạng thái xử lý, sổ BBHT.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadGs, addSurveySheet, mkSheet, rowObj, plain } from './_harness.mjs';

const daysAgo = n => new Date(Date.now() - n * 86400000).toISOString();

test('check_dup: trùng tuyến+phường (bỏ dấu) hoặc < 30 m trong 90 ngày', () => {
  const gs = loadGs();
  addSurveySheet(gs, 'thay_den', [
    { STT: 'TD-1', 'Tuyến đường': 'Đường Lương Văn Can', 'Phường': 'Tân Định', 'Submitted At': daysAgo(10) },
    { STT: 'TD-2', 'Tuyến đường': 'Nguyễn Trãi', 'Phường': 'Bến Thành', 'Submitted At': daysAgo(5), link: 'https://www.google.com/maps?q=10.7770,106.7010' },
    { STT: 'TD-3', 'Tuyến đường': 'Lương Văn Can', 'Phường': 'Tân Định', 'Submitted At': daysAgo(120) },
    { STT: 'TD-4', 'Tuyến đường': 'Lương Văn Can', 'Phường': 'Sài Gòn', 'Submitted At': daysAgo(3) }
  ]);
  const r1 = gs.handleCheckDup({ type: 'thay_den', tuyen: 'luong van can', phuong: 'tan dinh' });
  assert.deepEqual(plain(r1.matches).map(m => m.stt), ['TD-1']);
  const r2 = gs.handleCheckDup({ type: 'thay_den', tuyen: 'X', phuong: 'Y', lat: 10.7771, lng: 106.7011 });
  assert.deepEqual(plain(r2.matches).map(m => m.stt + '/' + m.reason), ['TD-2/gps']);
  const r3 = gs.handleCheckDup({ type: 'thay_den', tuyen: 'X', phuong: 'Y', lat: 10.78, lng: 106.71 });
  assert.equal(r3.total, 0);
});

test('capNhatCotSheet: chèn đúng vị trí cột còn thiếu, không lệch dữ liệu cũ, chạy lại không đổi', () => {
  const gs = loadGs();
  const oldHeader = gs.HEADERS.ngam_hoa.slice(0, 23).concat(gs.BONUS_COLS.slice(0, 6));
  const oldRow = oldHeader.map(h => ({ STT: 'NH-1', 'kinh độ': 106.7, 'vĩ độ': 10.77, Username: 'u1' })[h] ?? '');
  const sh = gs.sheets[gs.SHEET_MAP.ngam_hoa] = mkSheet(gs.SHEET_MAP.ngam_hoa, [oldHeader, oldRow]);
  gs.capNhatCotSheet();
  assert.deepEqual(plain(sh._d[0]), plain([...gs.HEADERS.ngam_hoa, ...gs.BONUS_COLS]));
  const row = rowObj(sh, 2);
  assert.equal(row.STT, 'NH-1');
  assert.equal(row.Username, 'u1');
  assert.equal(row['Link Google Map'], 'https://www.google.com/maps?q=10.77,106.7');
  const again = gs.capNhatCotSheet();
  assert.deepEqual(plain(again.added), []);
});

test('set_status: đổi trạng thái + ghi Audit; chặn trạng thái sai và loại không áp dụng', () => {
  const gs = loadGs();
  const sh = addSurveySheet(gs, 'thay_den', [{ STT: 'TD-1' }]);
  const r = gs.handleSetStatus({ type: 'thay_den', stts: ['TD-1'], status: 'Đã thiết kế', note: 'HS-12' });
  assert.equal(r.ok, true);
  assert.equal(rowObj(sh, 2)['Trạng thái xử lý'], 'Đã thiết kế');
  assert.match(rowObj(sh, 2)['Cập nhật trạng thái'], /tester · HS-12$/);
  assert.equal(gs.audit.at(-1)[0], 'set_status');
  assert.equal(gs.handleSetStatus({ type: 'thay_den', stt: 'TD-1', status: 'Xong' }).ok, false);
  assert.equal(gs.handleSetStatus({ type: 'thao_go_bang_ron', stt: 'X', status: 'Nghiệm thu' }).ok, false);
});

test('sổ BBHT: thêm / sửa một phần / lọc ngày / xoá; ngày sai dạng bị từ chối', () => {
  const gs = loadGs();
  const a = gs.handleSobbhtSave({ items: [
    { 'Số BBHT': '01/07/Q5', 'Ngày': '2025-07-10', 'Phường': 'Chợ Quán', nguon: 'excel-cu' },
    { 'Số BBHT': '02/09', 'Ngày': '2026-09-20', 'Phường': 'Tân Định' }] });
  assert.equal(a.created.length, 2);
  assert.equal(gs.handleSobbhtSave({ items: [{ id: a.created[0], 'Giám sát': 'Trương Văn Ly' }] }).ok, true);
  assert.deepEqual(plain(gs.handleSobbhtList({ from: '2026-01-01' }).items).map(i => i['Số BBHT']), ['02/09']);
  assert.equal(gs.handleSobbhtList({}).items.find(i => i.id === a.created[0])['Giám sát'], 'Trương Văn Ly');
  assert.equal(gs.handleSobbhtSave({ items: [{ 'Ngày': '10/07/2025' }] }).ok, false);
  assert.equal(gs.handleSobbhtDelete({ id: a.created[1] }).ok, true);
  assert.equal(gs.handleSobbhtList({}).items.length, 1);
});
