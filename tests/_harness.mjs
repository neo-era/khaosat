// tests/_harness.mjs — Giả lập môi trường Google Apps Script để chạy apps-script/Code.gs trong Node.
// Không cần npm: chạy `node --test tests/` (Node ≥ 20). KHÔNG gọi mạng, KHÔNG đụng Google Sheets thật.

import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';

const ROOT = new URL('../', import.meta.url);
export const read = rel => fs.readFileSync(new URL(rel, ROOT), 'utf8');

/** Nạp js/schemas.js (ES module, không import gì) mà không cần package.json "type": "module". */
export async function loadSchemas() {
  return import('data:text/javascript;charset=utf-8,' + encodeURIComponent(read('js/schemas.js')));
}

/** Utilities.formatDate thật theo múi giờ (yyyy yy MM dd HH mm ss). */
function formatDate(date, tz, pattern) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone: tz || 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
  }).formatToParts(new Date(date)).map(p => [p.type, p.value]));
  const hh = parts.hour === '24' ? '00' : parts.hour;
  return pattern.replace(/yyyy|yy|MM|dd|HH|mm|ss/g, t => ({
    yyyy: parts.year, yy: parts.year.slice(2), MM: parts.month, dd: parts.day, HH: hh, mm: parts.minute, ss: parts.second
  })[t]);
}

/** Sheet giả: đủ các hàm Code.gs đang dùng. `rows[0]` = header. */
export function mkSheet(name, rows = [[]]) {
  const d = rows.map(r => r.slice());
  const width = () => Math.max(0, ...d.map(r => r.length));
  const sheet = {
    _d: d,
    getName: () => name,
    getSheetId: () => 1,
    getLastRow: () => d.length,
    getLastColumn: () => width(),
    getMaxRows: () => 1000,
    getMaxColumns: () => Math.max(26, width()),
    setFrozenRows() {}, setColumnWidth() {},
    getConditionalFormatRules: () => [], setConditionalFormatRules() {},
    appendRow: r => { d.push(r.slice()); return sheet; },
    deleteRow: r => { d.splice(r - 1, 1); },
    insertColumnAfter: c => { d.forEach(r => r.splice(c, 0, '')); },
    insertColumnBefore: c => { d.forEach(r => r.splice(c - 1, 0, '')); },
    insertColumnsAfter: (c, n) => { d.forEach(r => r.splice(c, 0, ...Array(n).fill(''))); },
    getDataRange: () => ({ getValues: () => d.map(r => { const x = r.slice(); while (x.length < width()) x.push(''); return x; }) }),
    getRange(r, c, nr = 1, nc = 1) {
      const rng = {
        getValue: () => (d[r - 1] || [])[c - 1] ?? '',
        getValues: () => Array.from({ length: nr }, (_, i) =>
          Array.from({ length: nc }, (_, j) => (d[r - 1 + i] || [])[c - 1 + j] ?? '')),
        setValue: v => { (d[r - 1] = d[r - 1] || [])[c - 1] = v; return rng; },
        setValues: vals => { vals.forEach((row, i) => row.forEach((v, j) => { (d[r - 1 + i] = d[r - 1 + i] || [])[c - 1 + j] = v; })); return rng; },
        setNumberFormat: () => rng, setDataValidation: () => rng
      };
      return rng;
    }
  };
  return sheet;
}

/**
 * Nạp Code.gs vào sandbox. Trả về ctx: mọi hàm/const top-level của Code.gs + các biến giả:
 *   ctx.sheets    — { tên sheet: sheet giả } (thêm/bớt thoải mái trong test)
 *   ctx.audit     — các lần appendAuditLog
 *   ctx.user      — user mà verifyToken trả về (đổi role để thử phân quyền)
 *   ctx.allow     — can(role, action) trả về gì (mặc định true)
 */
export function loadGs({ user = { username: 'tester', role: 'admin', full_name: 'Người Thử' } } = {}) {
  const ctx = {
    console,
    Logger: { log() {} },
    Utilities: {
      formatDate,
      getUuid: () => crypto.randomUUID(),
      computeDigest: () => [], computeHmacSha256Signature: () => []
    },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    CacheService: { getScriptCache: () => ({ get: () => null, put() {}, remove() {} }) },
    PropertiesService: { getScriptProperties: () => ({ getProperty: () => null, setProperty() {}, getProperties: () => ({}) }) },
    sheets: {}, audit: [], user, allow: true
  };
  vm.createContext(ctx);
  vm.runInContext(read('apps-script/Code.gs'), ctx, { filename: 'Code.gs' });
  // const/let top-level không tự thành thuộc tính của ctx → xuất ra để test đọc được
  vm.runInContext(`
    this.HEADERS = HEADERS; this.SHEET_MAP = SHEET_MAP; this.BONUS_COLS = BONUS_COLS;
    this.STT_PREFIX = STT_PREFIX; this.XU_LY_STATUSES = XU_LY_STATUSES; this.XU_LY_SKIP_TYPES = XU_LY_SKIP_TYPES;
    this.DIALUX_COLS = DIALUX_COLS; this.GPS_LATLONG_TYPES = GPS_LATLONG_TYPES; this.GPS_LINK_TYPES = GPS_LINK_TYPES;
    this.NO_GPS_TYPES = NO_GPS_TYPES;
    getSpreadsheet = () => ({
      getSheetByName: n => sheets[n] || null,
      insertSheet: n => (sheets[n] = __mkSheet(n, [[]]))
    });
    verifyToken = () => user;
    can = () => allow;
    appendAuditLog = (...a) => { audit.push(a); };
    weeklyBackup = () => ({ ok: true, file_name: 'backup-test', backup_id: 'bk1' });
    notifyAdmins = () => {};
  `, Object.assign(ctx, { __mkSheet: mkSheet }));
  return ctx;
}

/** Tạo sẵn 1 sheet khảo sát đúng header (HEADERS + BONUS_COLS) cho `type`. */
export function addSurveySheet(ctx, type, dataRows = []) {
  const header = ctx.HEADERS[type].concat(ctx.BONUS_COLS);
  const rows = dataRows.map(obj => header.map(h => obj[h] ?? ''));
  ctx.sheets[ctx.SHEET_MAP[type]] = mkSheet(ctx.SHEET_MAP[type], [header, ...rows]);
  return ctx.sheets[ctx.SHEET_MAP[type]];
}

/**
 * Mảng/object sinh trong sandbox Code.gs có prototype của "vùng" khác → assert.deepEqual chặt báo lệch
 * dù cùng nội dung. Luôn bọc kết quả từ gs bằng plain() trước khi so sánh sâu.
 */
export const plain = x => JSON.parse(JSON.stringify(x));

/** Đọc 1 dòng sheet giả thành object theo header. */
export function rowObj(sheet, rowIndex1) {
  const h = sheet._d[0];
  return Object.fromEntries(h.map((k, i) => [k, sheet._d[rowIndex1 - 1][i]]));
}
