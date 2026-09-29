// Tốc độ máy chủ (29/09/2026): mỗi lần gọi Apps Script chỉ mở file Google Sheets 1 lần.
// Trước đây getSpreadsheet() gọi SpreadsheetApp.openById ở mọi chỗ → "Danh sách tất cả loại"
// mở lại file 17+ lần, mỗi lần tốn vài trăm ms.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { read } from './_harness.mjs';

function loadRaw() {
  const calls = { open: 0 };
  const ctx = {
    console, Logger: { log() {} },
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => (k === 'SPREADSHEET_ID' ? 'SS1' : null) }) },
    SpreadsheetApp: { openById: id => { calls.open++; return { id, getSheetByName: () => null }; } }
  };
  vm.createContext(ctx);
  vm.runInContext(read('apps-script/Code.gs'), ctx, { filename: 'Code.gs' });
  return { ctx, calls };
}

test('getSpreadsheet: chỉ mở file 1 lần trong 1 lần gọi máy chủ', () => {
  const { ctx, calls } = loadRaw();
  const a = ctx.getSpreadsheet();
  const b = ctx.getSpreadsheet();
  ctx.getSpreadsheet();
  assert.equal(calls.open, 1);
  assert.equal(a, b);
  assert.equal(a.id, 'SS1');
});

test('getSpreadsheet: vẫn báo lỗi rõ khi chưa đặt SPREADSHEET_ID', () => {
  const { ctx } = loadRaw();
  ctx.PropertiesService.getScriptProperties = () => ({ getProperty: () => null });
  assert.throws(() => ctx.getSpreadsheet(), /SPREADSHEET_ID/);
});
