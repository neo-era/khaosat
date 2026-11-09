// tests/frontend-security.test.mjs — v2.2.1: link do dữ liệu bản ghi cung cấp phải là https,
// và lỗi "phiên hết hạn" từ máy chủ phải đưa người dùng về trang đăng nhập.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { read } from './_harness.mjs';

/** Lấy 1 hàm export từ file ES module (không chạy phần import của file). */
function pickFn(rel, name) {
  const src = read(rel);
  const start = src.indexOf('export function ' + name + '(');
  assert.ok(start >= 0, name + ' có trong ' + rel);
  let depth = 0, i = src.indexOf('{', start);
  for (; i < src.length; i++) { if (src[i] === '{') depth++; else if (src[i] === '}' && --depth === 0) break; }
  return new Function('return (' + src.slice(start + 7, i + 1) + ')')();
}

test('safeHref chỉ nhận https://', () => {
  const safeHref = pickFn('js/utils.js', 'safeHref');
  for (const bad of ['javascript:alert(1)', ' JavaScript:alert(1)', 'data:text/html,<b>', 'http://drive.google.com/x',
                     'https://a.b/x" onerror="x', '//evil.com', '', null, undefined]) {
    assert.equal(safeHref(bad), '', String(bad));
  }
  assert.equal(safeHref('https://drive.google.com/uc?export=view&id=AbC'), 'https://drive.google.com/uc?export=view&id=AbC');
});

test('các chỗ hiện link ảnh đều qua safeHref', () => {
  assert.match(read('js/map.js'), /split\('\|'\)\.map\(safeHref\)/);
  assert.match(read('js/map.js'), /href="\$\{escapeHtml\(safeHref\(value\)\)\}"/);
  assert.match(read('js/bangron.js'), /href="\$\{escapeHtml\(safeHref\(u\)\)\}"/);
  assert.doesNotMatch(read('js/manage.js'), /window\.open\(u,/);
});

test('isSessionEndedError nhận đúng các lỗi phiên', () => {
  const f = pickFn('js/api.js', 'isSessionEndedError');
  for (const m of ['Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại', 'Mật khẩu đã thay đổi, vui lòng đăng nhập lại',
                   'invalid token signature', 'missing token', 'user disabled']) assert.equal(f(m), true, m);
  for (const m of ['Sai tên đăng nhập hoặc mật khẩu', 'Đường dẫn ảnh không hợp lệ', 'forbidden', undefined]) assert.equal(f(m), false, String(m));
});

test('trang đăng nhập không còn form tự đặt lại mật khẩu', () => {
  const html = read('login.html');
  assert.doesNotMatch(html, /reset_own_password|reset-form|r-fullname/);
  assert.match(html, /Liên hệ quản trị viên/);
});
