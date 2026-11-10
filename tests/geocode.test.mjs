// Tra địa chỉ từ GPS (js/gps.js): Photon trước (mạng VN không vào được openstreetmap.org — 10/11/2026), lỗi thì Nominatim.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { read } from './_harness.mjs';

const src = read('js/gps.js');
const load = async () => import('data:text/javascript;charset=utf-8,' + encodeURIComponent(src) + '%0A//' + Math.random());
const F = (name, v, lo, la) => ({ properties: { name, osm_key: 'highway', osm_value: v, district: 'Chợ Lớn', city: 'Thành phố Hồ Chí Minh' }, geometry: { coordinates: [lo, la] } });
// Dữ liệu thật Photon tại 10.753462,106.660057 (10/11/2026)
const PHOTON = { features: [F('Hẻm 728 Đường Nguyễn Trãi', 'service', 106.6605589, 10.7534342), F('Hẻm 720 Đường Nguyễn Trãi', 'service', 106.660626, 10.7535169),
  F('Lương Nhữ Học', 'bus_stop', 106.6604011, 10.7529576), F('Lương Nhữ Học', 'tertiary', 106.660007, 10.7527229), F('Lão Tử', 'residential', 106.6593895, 10.7538157),
  F('Nguyễn Trãi', 'secondary', 106.6594443, 10.7530004)] };
const ok = j => ({ ok: true, json: async () => j });

test('Photon trả được → lấy tuyến đường, không đoán Hẻm', async () => {
  const urls = [];
  globalThis.fetch = async (u) => { urls.push(u); return ok(PHOTON); };
  const g = await load();
  const r = await g.reverseGeocode(10.753462, 106.660057);
  assert.equal(r.road, 'Lương Nhữ Học', 'đường chính gần nhất (không lấy hẻm, trạm xe buýt)');
  assert.equal(r.suburb, '');
  assert.equal(r.district, 'Chợ Lớn');
  assert.deepEqual(r.quanh.map(x => [x.ten, x.loai]), [['Hẻm 728 Nguyễn Trãi', 'hem'], ['Hẻm 720 Nguyễn Trãi', 'hem'], ['Lương Nhữ Học', 'duong'], ['Lão Tử', 'duong'], ['Nguyễn Trãi', 'duong']], 'danh sách đường quanh, gần trước, bỏ trùng + trạm xe buýt');
  assert.deepEqual([r.quanh[0].duong, r.quanh[0].hem], ['Nguyễn Trãi', 'Hẻm 728']);
  assert.match(urls[0], /^https:\/\/photon\.komoot\.io\/reverse\?lat=10\.753462&lon=106\.660057/);
});
test('Photon lỗi → Nominatim', async () => {
  globalThis.fetch = async (u) => (/photon/.test(u) ? Promise.reject(new TypeError('Load failed')) : ok({ address: { road: 'Lão Tử', suburb: 'P. 11' } }));
  const g = await load();
  const r = await g.reverseGeocode(10.75, 106.66);
  assert.deepEqual([r.road, r.suburb], ['Lão Tử', 'P. 11']);
});
test('Cả hai lỗi → thông báo dễ hiểu, không lộ chữ FetchEvent', async () => {
  globalThis.fetch = async () => { throw new TypeError('Load failed'); };
  const g = await load();
  await assert.rejects(g.reverseGeocode(10.7, 106.6), /Không kết nối được máy chủ bản đồ/);
});
test('Form: điền Phường khi khớp đúng 1 phường; danh sách đường quanh chạm để chọn', () => {
  const fr = read('js/form-renderer.js');
  assert.match(fr, /function phuongTuDiaChi/);
  assert.match(fr, /m\.length === 1 \? m\[0\] : null/);
  assert.match(fr, /data-quanh/);
  assert.match(fr, /min-height:44px/);
});
test('Service worker không chặn yêu cầu tới máy chủ bản đồ', () => {
  const sw = read('sw.js');
  assert.match(sw, /photon\.komoot\.io/);
  assert.doesNotMatch(sw, /nominatim[\s\S]{0,300}event\.respondWith\(fetch\(event\.request\)\)/);
});
