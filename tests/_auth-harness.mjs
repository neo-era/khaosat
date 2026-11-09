// tests/_auth-harness.mjs — Nạp Code.gs THẬT (không thay verifyToken/can) với crypto thật của Node,
// để kiểm luồng đăng nhập, token, mật khẩu, Drive. Không gọi mạng, không đụng Google thật.
//
//   const gs = loadAuthGs();           // có sẵn 3 user: admin / ktv01 (user1) / demo
//   gs.post({ action: 'login', ... })  // gọi doPost như client thật, trả object JSON
//   gs.clock.now += 6 * 60 * 1000      // tua đồng hồ (Date.now trong sandbox + TTL cache)
//   gs.drive.addFile(id, { mime, parent }) / gs.drive.trashed / gs.fetched

import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
import { mkSheet } from './_harness.mjs';

const CODE = fs.readFileSync(new URL('../apps-script/Code.gs', import.meta.url), 'utf8');

const toBuf = x => Buffer.isBuffer(x) ? x
  : Array.isArray(x) ? Buffer.from(x.map(b => b & 255))
  : Buffer.from(String(x), 'utf8');
const toSigned = b => [...b].map(v => (v > 127 ? v - 256 : v));

export const PASSWORDS = { admin: 'AdminGoc!2026', ktv01: 'KtvGoc!2026', demo: 'DemoGoc!2026' };

export function loadAuthGs() {
  const clock = { now: Date.UTC(2026, 10, 9, 8, 0, 0) };
  class FakeDate extends Date {
    constructor(...a) { super(...(a.length ? a : [clock.now])); }
    static now() { return clock.now; }
  }

  const props = { AUTH_SALT: 's'.repeat(40), PWD_PEPPER: 'p'.repeat(64), SPREADSHEET_ID: 'X', DRIVE_FOLDER_ID: 'ROOT' };
  const cacheStore = new Map();   // key → { v, exp }
  const cache = {
    get: k => { const e = cacheStore.get(k); if (!e || e.exp <= clock.now) { cacheStore.delete(k); return null; } return e.v; },
    put: (k, v, ttlSec = 600) => { cacheStore.set(k, { v: String(v), exp: clock.now + ttlSec * 1000 }); },
    remove: k => { cacheStore.delete(k); }
  };

  // ---- Drive giả: cây thư mục + file ----
  const folders = { ROOT: { name: 'root', parent: null }, OUTSIDE: { name: 'Tài liệu riêng', parent: null } };
  const files = {};
  const drive = {
    files, folders, trashed: [], untrashed: [], read: [], created: [],
    addFolder(id, parent) { folders[id] = { name: id, parent }; },
    addFile(id, { mime = 'image/jpeg', parent = 'ROOT' } = {}) { files[id] = { mime, parent }; }
  };
  const mkIter = arr => { let i = 0; return { hasNext: () => i < arr.length, next: () => arr[i++] }; };
  const folderObj = id => ({
    getId: () => id,
    getName: () => folders[id].name,
    getParents: () => mkIter(folders[id].parent ? [folderObj(folders[id].parent)] : []),
    getFoldersByName: name => mkIter(Object.keys(folders).filter(k => folders[k].parent === id && folders[k].name === name).map(folderObj)),
    createFolder: name => { const nid = id + '/' + name; folders[nid] = { name, parent: id }; return folderObj(nid); },
    createFile: blob => {
      const nid = 'NEW' + (drive.created.length + 1);
      files[nid] = { mime: blob.getContentType(), parent: id };
      drive.created.push({ id: nid, folder: id, mime: blob.getContentType(), name: blob.getName() });
      return { getId: () => nid, setSharing() {} };
    }
  });
  const DriveApp = {
    Access: { ANYONE_WITH_LINK: 1 }, Permission: { VIEW: 1 },
    getFolderById: id => { if (!folders[id]) throw new Error('no folder ' + id); return folderObj(id); },
    getFileById: id => {
      const f = files[id];
      if (!f) throw new Error('no file ' + id);
      return {
        getId: () => id,
        getMimeType: () => f.mime,
        getParents: () => mkIter(f.parent ? [folderObj(f.parent)] : []),
        getBlob: () => { drive.read.push(id); return { getContentType: () => f.mime, getBytes: () => [1, 2, 3] }; },
        setTrashed: v => { (v ? drive.trashed : drive.untrashed).push(id); }
      };
    }
  };

  const fetched = [];
  const ctx = {
    console: { log() {}, error() {}, warn() {} }, JSON, Math, Date: FakeDate,
    Logger: { log() {} },
    Utilities: {
      formatDate: (d, tz, p) => new Date(d).toISOString(),
      getUuid: () => crypto.randomUUID(),
      computeDigest: (alg, s) => toSigned(crypto.createHash(alg === 'SHA_1' ? 'sha1' : 'sha256').update(String(s)).digest()),
      computeHmacSha256Signature: (m, k) => toSigned(crypto.createHmac('sha256', toBuf(k)).update(toBuf(m)).digest()),
      newBlob: (x, mime, name) => ({
        getBytes: () => toSigned(toBuf(x)),
        getDataAsString: () => toBuf(x).toString('utf8'),
        getContentType: () => mime, getName: () => name
      }),
      base64Encode: b => toBuf(b).toString('base64'),
      base64Decode: s => toSigned(Buffer.from(String(s), 'base64')),
      base64EncodeWebSafe: s => toBuf(s).toString('base64url'),
      base64DecodeWebSafe: s => toSigned(Buffer.from(String(s), 'base64url')),
      Charset: { UTF_8: 1 }, DigestAlgorithm: { SHA_256: 'SHA_256', SHA_1: 'SHA_1' }
    },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    CacheService: { getScriptCache: () => cache },
    PropertiesService: { getScriptProperties: () => ({
      getProperty: k => props[k] ?? null, setProperty: (k, v) => { props[k] = String(v); },
      getProperties: () => props, deleteProperty: k => { delete props[k]; }
    }) },
    ContentService: { createTextOutput: t => ({ setMimeType: () => JSON.parse(t) }), MimeType: { JSON: 1 } },
    DriveApp,
    UrlFetchApp: { fetch: (url, opt) => { fetched.push(url); return { getResponseCode: () => 200, getBlob: () => ({ getContentType: () => 'image/jpeg', getBytes: () => [9] }), getContentText: () => '{"result":"ok"}' }; } },
    MailApp: { sendEmail() {} },
    SpreadsheetApp: { flush() {} },
    sheets: {}, audit: []
  };
  vm.createContext(ctx);
  vm.runInContext(CODE, ctx, { filename: 'Code.gs' });

  ctx.sheets.taikhoan = mkSheet('taikhoan', [
    ['username', 'full_name', 'role', 'active', 'created_at'],
    ['admin', 'Quản Trị Viên', 'admin', true, ''],
    ['ktv01', 'Nguyễn Văn A', 'user1', true, ''],
    ['demo', 'Tài Khoản Demo', 'demo', true, '']
  ]);
  vm.runInContext(`
    getSpreadsheet = () => ({
      getSheetByName: n => sheets[n] || null,
      insertSheet: n => (sheets[n] = __mkSheet(n, [[]]))
    });
    appendAuditLog = (...a) => { audit.push(a); };
    notifyAdmins = () => {};
    weeklyBackup = () => ({ ok: true });
    this.HEADERS = HEADERS; this.SHEET_MAP = SHEET_MAP; this.BONUS_COLS = BONUS_COLS;
  `, Object.assign(ctx, { __mkSheet: mkSheet }));
  for (const [u, p] of Object.entries(PASSWORDS)) vm.runInContext(`setPassword(${JSON.stringify(u)}, ${JSON.stringify(p)}, false)`, ctx);

  const post = body => ctx.doPost({ postData: { contents: JSON.stringify(body) } });
  const login = (u, opts = {}) => post({ action: 'login', username: u, password: PASSWORDS[u], ...opts });
  const run = src => vm.runInContext(src, ctx);
  return Object.assign(ctx, { post, login, run, clock, props, drive, fetched, cacheStore });
}
