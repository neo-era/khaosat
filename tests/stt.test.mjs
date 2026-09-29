// STT = mã duy nhất <MÃ LOẠI>-<yyMMdd>-<4 ký tự>; bản trùng không được sửa/xoá nhầm.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadGs, addSurveySheet } from './_harness.mjs';

test('newSttId đúng dạng và không trùng (2.000 mã)', () => {
  const gs = loadGs();
  const sh = addSurveySheet(gs, 'thay_den');
  const used = {};
  for (let i = 0; i < 2000; i++) {
    const id = gs.newSttId('thay_den', sh, new Date('2026-09-26T03:00:00Z'), used);
    assert.match(id, /^TD-260926-[0-9A-F]{4}$/);
  }
  assert.equal(Object.keys(used).length, 2000);
});

test('newSttId dùng ngày giờ Việt Nam (UTC+7) — 20:00 UTC là ngày hôm sau', () => {
  const gs = loadGs();
  const id = gs.newSttId('hkn', addSurveySheet(gs, 'hkn'), new Date('2026-09-26T20:00:00Z'));
  assert.match(id, /^HKN-260927-/);
});

test('findRowByStt: STT trùng thì báo lỗi, không trả dòng đầu', () => {
  const gs = loadGs();
  const sh = addSurveySheet(gs, 'vo_tu', [{ STT: 5, 'Tuyến đường': 'A' }, { STT: 5, 'Tuyến đường': 'B' }, { STT: 'VT-1', 'Tuyến đường': 'C' }]);
  assert.throws(() => gs.findRowByStt(sh, 5), /trùng/);
  assert.equal(gs.findRowByStt(sh, 'VT-1').rowIndex, 4);
  assert.equal(gs.findRowByStt(sh, '5x'), null);
});

test('planSttTrung_: giữ STT cho dòng nhập qua app, dòng nhập Excel nhận mã mới', () => {
  const gs = loadGs();
  addSurveySheet(gs, 'thay_den', [
    { STT: 63, 'Tuyến đường': 'Nguyễn Hữu Cảnh', Username: 'import_Vinh', 'Submitted At': '2026-04-23T05:02:37Z' },
    { STT: 63, 'Tuyến đường': 'Lương Văn Can', Username: 'ltqthuc', 'Submitted At': '2026-05-28T03:42:58Z' }
  ]);
  const plan = gs.planSttTrung_();
  assert.equal(plan.length, 1);
  assert.equal(plan[0].row, 2);          // dòng import bị đổi
  assert.equal(plan[0].keepRow, 3);      // dòng app giữ số
  assert.match(plan[0].newStt, /^TD-2604(22|23)-/);
});
