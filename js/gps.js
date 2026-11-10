// js/gps.js — Wrapper navigator.geolocation. Trả Promise<{lat, lng, accuracy}>.

/**
 * Lấy vị trí hiện tại.
 * @param {Object} opts - { timeout, highAccuracy, maximumAge }
 * @returns {Promise<{lat:number, lng:number, accuracy:number}>}
 */
export function getCurrentPosition(opts = {}) {
  const {
    timeout = 10000,
    highAccuracy = true,
    maximumAge = 0
  } = opts;

  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject({ code: 'NOT_SUPPORTED', message: 'Trình duyệt không hỗ trợ GPS' });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          lat: round6(pos.coords.latitude),
          lng: round6(pos.coords.longitude),
          accuracy: Math.round(pos.coords.accuracy)
        });
      },
      (err) => {
        const codeMap = {
          1: 'PERMISSION_DENIED',
          2: 'POSITION_UNAVAILABLE',
          3: 'TIMEOUT'
        };
        reject({
          code: codeMap[err.code] || 'UNKNOWN',
          message: err.message || 'Không lấy được GPS'
        });
      },
      { enableHighAccuracy: highAccuracy, timeout, maximumAge }
    );
  });
}

function round6(n) {
  return Math.round(n * 1e6) / 1e6;
}

// =====================================================================
// REVERSE GEOCODING — Nominatim free, có cache 60s + throttle ≥1s
// =====================================================================

const _geocodeCache = new Map();      // key: "lat4,lng4" → { data, at }
const REVERSE_TTL_MS = 60 * 1000;
const REVERSE_THROTTLE_MS = 1100;     // Nominatim policy: max 1 req/s
let _lastReverseAt = 0;

/**
 * Reverse geocode tọa độ → thông tin địa chỉ tiếng Việt qua Nominatim (OpenStreetMap).
 * @returns {Promise<{road, suburb, neighbourhood, city_district, city, raw}>}
 */
export async function reverseGeocode(lat, lng) {
  const key = Number(lat).toFixed(4) + ',' + Number(lng).toFixed(4);

  // Cache check
  const cached = _geocodeCache.get(key);
  if (cached && (Date.now() - cached.at) < REVERSE_TTL_MS) {
    return cached.data;
  }

  // Throttle: đảm bảo ≥1.1s giữa các request
  const elapsed = Date.now() - _lastReverseAt;
  if (elapsed < REVERSE_THROTTLE_MS) {
    await new Promise(r => setTimeout(r, REVERSE_THROTTLE_MS - elapsed));
  }
  _lastReverseAt = Date.now();

  // Mạng ở VN (5G/cáp) hiện không vào được openstreetmap.org (đo 10/11/2026: "Load failed").
  // → hỏi Photon (komoot, cùng dữ liệu OSM, có CORS) trước; lỗi thì thử Nominatim; cả hai lỗi → báo rõ để nhập tay.
  let data;
  try {
    data = await photonReverse(lat, lng);
  } catch (e1) {
    try {
      data = await nominatimReverse(lat, lng);
    } catch (e2) {
      throw new Error('Không kết nối được máy chủ bản đồ (mạng chặn hoặc chậm) — nhập tay tuyến đường');
    }
  }
  _geocodeCache.set(key, { data, at: Date.now() });
  return data;
}

/** fetch có hạn thời gian (AbortController — có dự phòng cho iOS cũ không có AbortSignal.timeout). */
async function fetchJson(url, ms = 8000) {
  const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const t = ctl ? setTimeout(() => ctl.abort(), ms) : 0;
  try {
    const res = await fetch(url, ctl ? { signal: ctl.signal } : undefined);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return await res.json();
  } finally { if (t) clearTimeout(t); }
}

// Loại đường OSM coi là "đường chính" (điền Tuyến đường) và "hẻm" (chỉ gợi ý)
const DUONG = ['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'unclassified', 'residential', 'living_street', 'pedestrian', 'road'];
const HEM = ['service', 'footway', 'path', 'track', 'alley'];
/** Bỏ chữ "Đường " đầu tên (dữ liệu khảo sát ghi "Nguyễn Trãi", OSM ghi "Đường Nguyễn Trãi"). */
export function boDuong(s) { return String(s || '').trim().replace(/^(đường|duong)\s+/i, '').replace(/\s+(đường|duong)\s+/i, ' '); }
function metTu(lat, lng, la2, lo2) {
  const R = 6371000, r = Math.PI / 180;
  const a = Math.sin((la2 - lat) * r / 2) ** 2 + Math.cos(lat * r) * Math.cos(la2 * r) * Math.sin((lo2 - lng) * r / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(a)));
}

/**
 * Photon (photon.komoot.io): các đường/hẻm trong bán kính ~250 m (osm_tag=highway).
 * Trả { road = đường chính gần nhất, district = phường (tên mới), quanh = [{ten, loai, duong, hem, m}] }.
 * Tọa độ GPS có thể lệch → người khảo sát chọn lại trong "quanh".
 */
export async function photonReverse(lat, lng) {
  const json = await fetchJson(`https://photon.komoot.io/reverse?lat=${lat}&lon=${lng}&lang=default&limit=20&radius=0.25&osm_tag=highway`);
  const fs = (json.features || []).filter(f => f && f.properties && f.properties.name);
  if (!fs.length) throw new Error('Photon: không có đường quanh tọa độ');
  const quanh = [];
  const daCo = new Set();
  for (const f of fs) {
    const p = f.properties;
    const c = (f.geometry && f.geometry.coordinates) || [];
    const ten = boDuong(p.name);
    const laHem = /^hẻm\b|^hem\b|^ngõ|^kiệt/i.test(ten) || HEM.includes(p.osm_value);
    if (!laHem && !DUONG.includes(p.osm_value)) continue;          // bỏ trạm xe buýt, đèn tín hiệu…
    const k = ten.toLowerCase();
    if (daCo.has(k)) continue;
    daCo.add(k);
    const m = c.length === 2 ? metTu(lat, lng, c[1], c[0]) : null;
    const h = ten.match(/^(hẻm|hem|ngõ|kiệt)\s+(\S+)\s+(.+)$/i);
    quanh.push({ ten, loai: laHem ? 'hem' : 'duong', duong: h ? h[3] : (laHem ? '' : ten), hem: h ? 'Hẻm ' + h[2] : (laHem ? ten : ''), m });
  }
  quanh.sort((a, b) => (a.m ?? 1e9) - (b.m ?? 1e9));
  const p0 = fs[0].properties;
  const chinh = quanh.find(q => q.loai === 'duong') || null;
  const road = chinh ? chinh.ten : (quanh[0] ? quanh[0].duong : '');
  return {
    road,
    suburb: '',                          // không đoán Hẻm — người khảo sát chọn trong danh sách
    neighbourhood: p0.locality || '',
    city_district: p0.district || '',
    district: p0.district || '',
    city: p0.city || '',
    quanh: quanh.slice(0, 10),
    display_name: [road, p0.district, p0.city].filter(Boolean).join(', '),
    raw: json
  };
}

async function nominatimReverse(lat, lng) {
  const json = await fetchJson(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=18&accept-language=vi`);
  const addr = json.address || {};
  return {
    road: boDuong(addr.road || addr.pedestrian || addr.path || addr.cycleway || ''),
    district: addr.suburb || addr.quarter || '',
    quanh: [],
    suburb: addr.suburb || addr.quarter || addr.neighbourhood || '',
    neighbourhood: addr.neighbourhood || addr.hamlet || '',
    city_district: addr.city_district || addr.district || '',
    city: addr.city || addr.town || addr.village || '',
    display_name: json.display_name || '',
    raw: json
  };
}
