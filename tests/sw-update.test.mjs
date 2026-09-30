// Tự cập nhật phiên bản mới (30/09/2026, user chốt: tự tải lại khi an toàn, đang nhập dở thì hiện thanh
// "Có bản mới — Cập nhật"; chân trang hiện số phiên bản).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { read } from './_harness.mjs';

const { decideUpdate } = await import('data:text/javascript;charset=utf-8,' + encodeURIComponent(read('js/sw-update.js')));

test('decideUpdate: lần cài đầu bỏ qua; đang nhập dở → thanh thông báo; còn lại tự tải lại', () => {
  assert.equal(decideUpdate({ hadController: false, busy: false }), 'ignore');
  assert.equal(decideUpdate({ hadController: false, busy: true }), 'ignore');
  assert.equal(decideUpdate({ hadController: true, busy: true }), 'banner');
  assert.equal(decideUpdate({ hadController: true, busy: false }), 'reload');
});

test('sw.js trả số phiên bản (CACHE_NAME) khi trang hỏi GET_VERSION', () => {
  const listeners = {};
  const ctx = { self: { addEventListener: (t, f) => { listeners[t] = f; }, skipWaiting() {}, clients: { claim() {} } }, caches: {}, fetch() {}, console };
  vm.createContext(ctx);
  vm.runInContext(read('sw.js'), ctx);
  let reply = null;
  listeners.message({ data: { type: 'GET_VERSION' }, source: { postMessage: m => { reply = m; } } });
  assert.equal(reply.type, 'VERSION');
  assert.match(reply.version, /^khaosat-v\d+$/);
  assert.equal(reply.version, read('sw.js').match(/CACHE_NAME = '([^']+)'/)[1]);
});

test('mọi trang đăng ký service worker qua initSwUpdate (không tự register rời rạc)', () => {
  const pages = fs.readdirSync(new URL('../', import.meta.url)).filter(f => f.endsWith('.html'));
  for (const p of pages) {
    const html = read(p);
    assert.doesNotMatch(html, /serviceWorker\.register\(/, p + ' còn tự register — phải dùng initSwUpdate()');
  }
  for (const p of ['index.html', 'form.html', 'bcsc.html', 'report.html', 'manage.html', 'login.html']) {
    assert.match(read(p), /initSwUpdate\(/, p + ' chưa gọi initSwUpdate');
  }
  assert.match(read('sw.js'), /'\.\/js\/sw-update\.js'/, 'sw.js chưa cache js/sw-update.js');
});

// Lỗi bắt được khi diễn tập 30/09: lần cài đầu (controllerchange 'ignore') khoá luôn các lần cập nhật sau.
test('initSwUpdate: sau lần cài đầu, bản phát hành kế tiếp vẫn tự tải lại', async () => {
  const listeners = {};
  let reloads = 0;
  const sw = {
    controller: null,
    addEventListener: (t, f) => { (listeners[t] = listeners[t] || []).push(f); },
    register: () => Promise.resolve({ update: () => Promise.resolve() }),
    getRegistration: () => Promise.resolve(null),
    ready: new Promise(() => {})
  };
  const origNav = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  Object.defineProperty(globalThis, 'navigator', { value: { serviceWorker: sw }, configurable: true, writable: true });
  globalThis.document = { activeElement: null, querySelector: () => null, addEventListener() {}, querySelectorAll: () => [] };
  globalThis.location = { reload: () => { reloads++; } };
  const origSI = globalThis.setInterval;
  globalThis.setInterval = () => 0;   // hẹn giờ 30 phút thật sẽ giữ tiến trình test không thoát
  const m = await import('data:text/javascript;charset=utf-8,' + encodeURIComponent(read('js/sw-update.js') + '\n//' + Math.random()));
  m.initSwUpdate();
  await new Promise(r => setTimeout(r, 0));
  listeners.controllerchange.forEach(f => f());   // lần cài đầu
  assert.equal(reloads, 0);
  listeners.controllerchange.forEach(f => f());   // bản phát hành sau
  assert.equal(reloads, 1);
  if (origNav) Object.defineProperty(globalThis, 'navigator', origNav); else delete globalThis.navigator;
  delete globalThis.document; delete globalThis.location;
  globalThis.setInterval = origSI;
});

// Rà soát 30/09: tự tải lại giữa lúc đồng bộ hàng chờ / nhập hàng loạt → ghi trùng, bỏ dở.
test('beginBusy: đang có việc ghi thì không tự tải lại mà hiện thanh; xong việc thì hết bận', async () => {
  const m = await import('data:text/javascript;charset=utf-8,' + encodeURIComponent(read('js/sw-update.js') + '\n//' + Math.random()));
  assert.equal(typeof m.beginBusy, 'function');
  globalThis.document = { activeElement: null, querySelector: () => null };
  assert.equal(m.isBusy(), false);
  const done = m.beginBusy();
  const done2 = m.beginBusy();
  assert.equal(m.isBusy(), true);
  done(); done();                 // gọi 2 lần không được trừ lố
  assert.equal(m.isBusy(), true);
  done2();
  assert.equal(m.isBusy(), false);
  delete globalThis.document;
});

test('các luồng ghi dữ liệu khai bận: lệnh ghi trong api.js, đồng bộ hàng chờ, nhập Excel, lưu sổ, xoá hàng loạt', () => {
  assert.match(read('js/api.js'), /beginBusy\(/);
  assert.match(read('js/report.js'), /beginBusy\(/);
  assert.match(read('js/sobbht.js'), /beginBusy\(/);
});

test('sw.js: cài bản mới chỉ khi tải ĐỦ file (Promise.all) và mọi file trong danh sách có thật', () => {
  const sw = read('sw.js');
  assert.doesNotMatch(sw, /allSettled/);
  const list = [...sw.matchAll(/'\.\/([^']*)'/g)].map(m => m[1]).filter(Boolean);
  for (const p of list) assert.ok(fs.existsSync(new URL('../' + p, import.meta.url)), 'sw.js cache file không tồn tại: ' + p);
});

test('mọi trang HTML ở gốc repo gọi initSwUpdate', () => {
  const pages = fs.readdirSync(new URL('../', import.meta.url)).filter(f => f.endsWith('.html'));
  for (const p of pages) assert.match(read(p), /initSwUpdate\(/, p);
});

// 30/09: máy chủ Apps Script "ngủ" → lệnh đầu tiên mất ~20 s. User chốt: vừa mở app là đánh thức máy chủ.
test('wakeServer: GET nhẹ (doGet) lúc mở app, không quá 1 lần / 3 phút; trang đăng nhập + trang chủ gọi', () => {
  const api = read('js/api.js');
  assert.match(api, /export function wakeServer\(/);
  assert.match(api, /method:\s*'GET'/);
  assert.match(api, /3 \* 60 \* 1000/);
  for (const p of ['login.html', 'index.html']) assert.match(read(p), /wakeServer\(\)/, p);
});
