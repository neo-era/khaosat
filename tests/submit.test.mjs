// Gửi form: server tự gán STT / ngày / người khảo sát / username, không tin dữ liệu client.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadGs, addSurveySheet, rowObj } from './_harness.mjs';

test('submit mọi loại: STT đúng mã loại, trường server-managed bị ghi đè', () => {
  const gs = loadGs({ user: { username: 'ktv01', role: 'user1', full_name: 'Nguyễn Văn A' } });
  for (const type of Object.keys(gs.SHEET_MAP)) {
    const sh = addSurveySheet(gs, type);
    const res = gs.handleSubmit({ token: 't', type, data: { 'Người khảo sát': 'Giả mạo', 'Username': 'hacker', 'STT': 999, 'Tuyến đường': 'X' } });
    assert.equal(res.ok, true, type);
    const row = rowObj(sh, 2);
    assert.match(String(row['STT']), new RegExp('^' + gs.STT_PREFIX[type] + '-\\d{6}-[0-9A-F]{4}$'), type);
    assert.equal(row['Người khảo sát'], 'Nguyễn Văn A', type);
    assert.equal(row['Username'], 'ktv01', type);
    assert.equal(row['Deleted At'], '', type);
    const expectStatus = gs.XU_LY_SKIP_TYPES.includes(type) ? '' : gs.XU_LY_STATUSES[0];
    assert.equal(row['Trạng thái xử lý'], expectStatus, type);
  }
});

test('submit bị chặn khi role không có quyền submit', () => {
  const gs = loadGs({ user: { username: 'demo', role: 'demo', full_name: 'Demo' } });
  gs.allow = false;
  addSurveySheet(gs, 'hkn');
  const res = gs.handleSubmit({ token: 't', type: 'hkn', data: {} });
  assert.equal(res.ok, false);
});

test('update không ghi đè STT, người khảo sát, trạng thái xử lý', () => {
  const gs = loadGs();
  const sh = addSurveySheet(gs, 'thay_den', [{ STT: 'TD-1', 'Người khảo sát': 'Gốc', 'Trạng thái xử lý': 'Nghiệm thu', link: 'L1' }]);
  const res = gs.handleUpdate({ token: 't', type: 'thay_den', stt: 'TD-1',
    data: { STT: 'TD-9', 'Người khảo sát': 'Khác', 'Trạng thái xử lý': 'Chờ thiết kế', 'Tuyến đường': 'Mới', link: 'L1' } });
  assert.equal(res.ok, true);
  const row = rowObj(sh, 2);
  assert.equal(row['STT'], 'TD-1');
  assert.equal(row['Người khảo sát'], 'Gốc');
  assert.equal(row['Trạng thái xử lý'], 'Nghiệm thu');
  assert.equal(row['Tuyến đường'], 'Mới');
  assert.equal(row['link'], 'L1');
});
