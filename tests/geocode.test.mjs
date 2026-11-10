// Tra địa chỉ từ GPS (js/gps.js): Photon trước (mạng VN không vào được openstreetmap.org — 10/11/2026), lỗi thì Nominatim.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { read } from './_harness.mjs';

const src = read('js/gps.js');
const load = async () => import('data:text/javascript;charset=utf-8,' + encodeURIComponent(src) + '%0A//' + Math.random());
const PHOTON = { features: [{ properties: { osm_key: 'shop', street: 'Đường Nguyễn Trãi', housenumber: '746', locality: 'Khu phố 9', district: 'Chợ Lớn', city: 'Thành phố Hồ Chí Minh' } }] };
const ok = j => ({ ok: true, json: async () => j });

test('Photon trả được → lấy tuyến đường, không đoán Hẻm', async () => {
  const urls = [];
  globalThis.fetch = async (u) => { urls.push(u); return ok(PHOTON); };
  const g = await load();
  const r = await g.reverseGeocode(10.753462, 106.660057);
  assert.equal(r.road, 'Đường Nguyễn Trãi');
  assert.equal(r.suburb, '');
  assert.equal(r.city_district, 'Chợ Lớn');
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
test('Service worker không chặn yêu cầu tới máy chủ bản đồ', () => {
  const sw = read('sw.js');
  assert.match(sw, /photon\.komoot\.io/);
  assert.doesNotMatch(sw, /nominatim[\s\S]{0,300}event\.respondWith\(fetch\(event\.request\)\)/);
});
