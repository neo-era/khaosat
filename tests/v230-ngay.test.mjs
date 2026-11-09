// v2.3.0 C1 — lọc ngày theo giờ Việt Nam (UTC+7), không theo UTC.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadGs, addSurveySheet, read } from './_harness.mjs';

const vn = (d, hm) => new Date(d + 'T' + hm + ':00+07:00').toISOString();

test('C1 list: from=to=ngày VN trả đủ bản 03:00 và 23:30, không lấy ngày khác', () => {
  const gs = loadGs();
  addSurveySheet(gs, 'hkn', [
    { STT: 'A', 'Submitted At': vn('2026-11-09', '03:00') },
    { STT: 'B', 'Submitted At': vn('2026-11-09', '23:30') },
    { STT: 'C', 'Submitted At': vn('2026-11-08', '23:59') },
    { STT: 'D', 'Submitted At': vn('2026-11-10', '00:01') }
  ]);
  const r = gs.handleList({ token: 't', type: 'hkn', from: '2026-11-09', to: '2026-11-09' });
  assert.deepEqual(r.rows.map(x => String(x.STT)).sort().join(), 'A,B');
  // Dạng đủ giờ (client cũ gửi T00:00:00 / T23:59:59) hiểu là giờ VN
  const r2 = gs.handleList({ token: 't', type: 'hkn', from: '2026-11-09T00:00:00', to: '2026-11-09T23:59:59' });
  assert.deepEqual(r2.rows.map(x => String(x.STT)).sort().join(), 'A,B');
});

test('C1 parseDayBound_: đầu/cuối ngày VN, dạng có múi giờ giữ nguyên, rác → null', () => {
  const gs = loadGs();
  assert.equal(gs.parseDayBound_('2026-11-09', false).toISOString(), '2026-11-08T17:00:00.000Z');
  assert.equal(gs.parseDayBound_('2026-11-09', true).toISOString(), '2026-11-09T16:59:59.999Z');
  assert.equal(gs.parseDayBound_('2026-11-09T08:30', false).toISOString(), '2026-11-09T01:30:00.000Z');
  assert.equal(gs.parseDayBound_('2026-11-09T08:30:00Z', false).toISOString(), '2026-11-09T08:30:00.000Z');
  assert.equal(gs.parseDayBound_('', false), null);
  assert.equal(gs.parseDayBound_('abc', false), null);
});

test('C1 report/export_raw dùng cùng mốc ngày VN', () => {
  const gs = loadGs();
  addSurveySheet(gs, 'hkn', [
    { STT: 'A', 'Submitted At': vn('2026-11-09', '03:00'), Username: 'u' },
    { STT: 'C', 'Submitted At': vn('2026-11-08', '23:59'), Username: 'u' }
  ]);
  const rep = gs.handleReport({ token: 't', types: ['hkn'], from: '2026-11-09', to: '2026-11-09' });
  assert.equal(rep.areaA.find ? rep.areaA.find(a => a.type === 'hkn').total : rep.areaA.hkn.total, 1);
  const ex = gs.handleExportRaw({ token: 't', types: ['hkn'], from: '2026-11-09', to: '2026-11-09' });
  assert.equal(ex.results[0].rows.length, 1);
});

test('C1 client không còn lấy ngày bằng toISOString().slice(0, 10)', () => {
  for (const f of ['js/form-renderer.js', 'js/bbht.js', 'js/manage.js', 'js/report.js', 'js/map.js', 'js/schedule.js', 'js/sobbht.js']) {
    assert.doesNotMatch(read(f), /toISOString\(\)\.slice\(0,\s*10\)/, f);
  }
  assert.match(read('js/utils.js'), /export function localDateStr\(/);
});
