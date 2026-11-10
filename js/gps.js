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

/** Photon (photon.komoot.io): GeoJSON, properties {street, name, osm_key, locality, district, city}. */
export async function photonReverse(lat, lng) {
  const json = await fetchJson(`https://photon.komoot.io/reverse?lat=${lat}&lon=${lng}&lang=default&limit=1`);
  const p = (json.features && json.features[0] && json.features[0].properties) || null;
  if (!p) throw new Error('Photon: không có kết quả');
  const road = p.street || (p.osm_key === 'highway' ? p.name : '') || '';
  return {
    road,
    suburb: '',                          // Photon không có "suburb" tương đương — không đoán Hẻm
    neighbourhood: p.locality || '',
    city_district: p.district || '',
    city: p.city || '',
    display_name: [p.housenumber, road, p.locality, p.district, p.city].filter(Boolean).join(', '),
    raw: json
  };
}

async function nominatimReverse(lat, lng) {
  const json = await fetchJson(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=18&accept-language=vi`);
  const addr = json.address || {};
  return {
    road: addr.road || addr.pedestrian || addr.path || addr.cycleway || '',
    suburb: addr.suburb || addr.quarter || addr.neighbourhood || '',
    neighbourhood: addr.neighbourhood || addr.hamlet || '',
    city_district: addr.city_district || addr.district || '',
    city: addr.city || addr.town || addr.village || '',
    display_name: json.display_name || '',
    raw: json
  };
}
