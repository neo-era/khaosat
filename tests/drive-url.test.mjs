// 30/09/2026: Google chặn nhúng ảnh Drive dạng uc?export=view (<img> lỗi, fetch lỗi CORS).
// lh3.googleusercontent.com/d/<id>=w1600 hiện được + tải được, ~0,4 s/ảnh (đo trên ảnh thật).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { read } from './_harness.mjs';

const { driveViewUrl } = await import('data:text/javascript;charset=utf-8,' + encodeURIComponent(read('js/drive-url.js')));

test('driveViewUrl: link Drive → lh3; link khác giữ nguyên', () => {
  const id = '1Ll56WcFMGLRgTzzvhsRh_B95DxXdPX_';
  assert.equal(driveViewUrl('https://drive.google.com/uc?export=view&id=' + id), `https://lh3.googleusercontent.com/d/${id}=w1600`);
  assert.equal(driveViewUrl('https://drive.google.com/file/d/' + id + '/view'), `https://lh3.googleusercontent.com/d/${id}=w1600`);
  assert.equal(driveViewUrl('https://drive.google.com/thumbnail?id=' + id + '&sz=w400'), `https://lh3.googleusercontent.com/d/${id}=w1600`);
  const cl = 'https://res.cloudinary.com/x/image/upload/v1/khaosat/a.jpg';
  assert.equal(driveViewUrl(cl), cl);
  assert.equal(driveViewUrl(''), '');
  assert.equal(driveViewUrl('data:image/png;base64,AAA'), 'data:image/png;base64,AAA');
});

test('mọi chỗ hiện ảnh khảo sát đi qua driveViewUrl', () => {
  for (const f of ['js/bcsc.js', 'js/bbht.js', 'js/bangron.js', 'js/manage.js', 'js/map.js', 'js/form-renderer.js', 'js/photos.js']) {
    assert.match(read(f), /driveViewUrl\(/, f + ' chưa dùng driveViewUrl');
  }
});
