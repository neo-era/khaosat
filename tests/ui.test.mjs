// Giao diện trang chủ (29/09/2026): 17 loại khảo sát chia theo nhóm nghiệp vụ.
// Thêm loại mới mà quên xếp nhóm → loại đó biến mất khỏi trang chủ, người khảo sát không mở được form.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadSchemas, read } from './_harness.mjs';

const { SCHEMAS, SURVEY_GROUPS } = await loadSchemas();

test('trang chủ: mỗi loại khảo sát nằm đúng 1 nhóm, không có key lạ', () => {
  assert.ok(Array.isArray(SURVEY_GROUPS) && SURVEY_GROUPS.length > 0, 'thiếu SURVEY_GROUPS trong schemas.js');
  const all = SURVEY_GROUPS.flatMap(g => g.keys);
  assert.deepEqual([...all].sort(), Object.keys(SCHEMAS).sort());
  assert.equal(new Set(all).size, all.length, 'có loại bị xếp 2 nhóm');
  SURVEY_GROUPS.forEach(g => assert.ok(g.title && g.keys.length, 'nhóm thiếu tên hoặc rỗng'));
});

test('menu: mọi trang trong app có mục menu tương ứng trên trang chủ', () => {
  const html = read('index.html');
  for (const page of ['recent.html', 'schedule.html', 'map.html', 'report.html', 'kpi.html', 'bbht.html',
    'sobbht.html', 'bcsc.html', 'bangron.html', 'manage.html', 'users.html', 'my-kpi.html', 'docs.html',
    'huongdansudung.html', 'https://neo-era.github.io/cskvtt/hoancong/']) {
    assert.ok(html.includes(`href="${page}"`), 'menu thiếu ' + page);
  }
});

// 30/09/2026: ảnh biên bản sự cố thiếu data-src → inlineImages() bỏ qua → file Word/PDF mất ảnh.
test('biên bản xuất file: mọi <img> ảnh hiện trường có data-src để nhúng vào file', () => {
  for (const f of ['js/bcsc.js', 'js/bbht.js', 'js/bangron.js']) {
    const imgs = read(f).match(/<img\s[^>]*>/g) || [];
    assert.ok(imgs.length > 0, f + ' không có thẻ img?');
    imgs.forEach(tag => assert.match(tag, /data-src=/, f + ': ' + tag));
  }
});

// 30/09/2026 — Word bỏ qua @page thường (ra khổ Letter, lề 2,54 cm) và bỏ qua div rỗng có height
// (mất chỗ ký). Mở bằng Word 16 thật để đối chiếu mẫu BCSC.
test('biên bản sự cố xuất Word: khổ A4 theo section Word, chỗ ký bằng đoạn trống, ảnh 1 cột như mẫu', () => {
  const src = read('js/bcsc.js');
  assert.match(src, /@page WordSection1\s*\{[^}]*size:\s*21cm 29\.7cm/);
  assert.match(src, /class="WordSection1"/);
  assert.match(src, /\.space/, 'phải đổi .space thành đoạn trống khi xuất Word');
  assert.doesNotMatch(src, /photos\.slice\(i, i \+ 2\)/, 'ảnh vẫn xếp 2 cột, mẫu là 1 cột');
});
