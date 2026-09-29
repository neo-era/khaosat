// Đồng bộ form (js/schemas.js) ↔ máy chủ (Code.gs). Lệch 1 chữ = dữ liệu ghi sai cột trên sheet sản xuất.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadGs, loadSchemas } from './_harness.mjs';

const gs = loadGs();
const { SCHEMAS, XU_LY_STATUSES, XU_LY_SKIP_TYPES } = await loadSchemas();

test('mọi loại trong schemas.js có trong SHEET_MAP/HEADERS/STT_PREFIX của Code.gs và ngược lại', () => {
  assert.deepEqual(Object.keys(SCHEMAS).sort(), Object.keys(gs.SHEET_MAP).sort());
  assert.deepEqual(Object.keys(gs.HEADERS).sort(), Object.keys(gs.SHEET_MAP).sort());
  assert.deepEqual(Object.keys(gs.STT_PREFIX).sort(), Object.keys(gs.SHEET_MAP).sort());
});

test('label form == header sheet, đúng thứ tự, cho từng loại', () => {
  for (const [type, s] of Object.entries(SCHEMAS)) {
    assert.deepEqual(s.fields.map(f => f.label), [...gs.HEADERS[type]], `lệch ở ${type}`);
    assert.equal(s.sheet, gs.SHEET_MAP[type], `tên sheet lệch ở ${type}`);
  }
});

test('mã STT không trùng giữa các loại', () => {
  const codes = Object.values(gs.STT_PREFIX);
  assert.equal(new Set(codes).size, codes.length);
});

test('không header nào trùng tên trong cùng 1 sheet (kể cả cột bonus)', () => {
  for (const [type, h] of Object.entries(gs.HEADERS)) {
    const all = [...h, ...gs.BONUS_COLS];
    assert.equal(new Set(all).size, all.length, `trùng cột ở ${type}`);
  }
});

test('danh sách trạng thái xử lý giống nhau ở 2 phía', () => {
  assert.deepEqual([...gs.XU_LY_STATUSES], XU_LY_STATUSES);
  assert.deepEqual([...gs.XU_LY_SKIP_TYPES], XU_LY_SKIP_TYPES);
});

test('mỗi loại thuộc đúng 1 nhóm GPS, khớp với trường GPS trong schema', () => {
  for (const [type, s] of Object.entries(SCHEMAS)) {
    const groups = [gs.GPS_LATLONG_TYPES, gs.GPS_LINK_TYPES, gs.NO_GPS_TYPES].filter(g => g.includes(type));
    assert.equal(groups.length, 1, `${type} nằm ở ${groups.length} nhóm GPS`);
    const hasLatLng = s.fields.some(f => f.type === 'gps_lat');
    assert.equal(hasLatLng, gs.GPS_LATLONG_TYPES.includes(type), `${type}: có cột vĩ độ nhưng sai nhóm GPS`);
  }
});

test('trường bắt buộc có tồn tại và select có options', () => {
  for (const [type, s] of Object.entries(SCHEMAS)) {
    for (const f of s.fields) {
      if (f.type === 'select' || f.type === 'multiselect') assert.ok(Array.isArray(f.options) && f.options.length, `${type}.${f.key} thiếu options`);
      if (f.default !== undefined && f.type === 'select' && f.default !== 'now') assert.ok(f.options.includes(f.default) || f.allowOther, `${type}.${f.key}: default không có trong options`);
    }
  }
});
