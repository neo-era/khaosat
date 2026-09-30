// Tên file biên bản sự cố giống file mẫu của user: "BCSC Nguyễn Hữu Dật 1 10-12-2025.pdf" (chốt 30/09/2026).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { read } from './_harness.mjs';

const { bcscFileName } = await import('data:text/javascript;charset=utf-8,' + encodeURIComponent(read('js/file-name.js')));

test('bcscFileName: BCSC + tên tủ + ngày dd-MM-yyyy, bỏ ký tự Windows cấm', () => {
  assert.equal(bcscFileName('Nguyễn Hữu Dật 1', '10/12/2025'), 'BCSC Nguyễn Hữu Dật 1 10-12-2025');
  assert.equal(bcscFileName('Lê Lợi 2/3 "A"', '01/02/2026'), 'BCSC Lê Lợi 2-3 A 01-02-2026');
  assert.equal(bcscFileName('', ''), 'BCSC su co');
  assert.equal(bcscFileName('  Tủ   X  ', ''), 'BCSC Tủ X');
});

test('bcsc.js dùng bcscFileName cho cả Xuất Word và In/Lưu PDF (tiêu đề trang = tên file PDF)', () => {
  const src = read('js/bcsc.js');
  assert.match(src, /a\.download = bcscFileName\(/);
  assert.match(src, /document\.title = /);
});
