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

  const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=18&accept-language=vi`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Nominatim HTTP ' + res.status);
  const json = await res.json();
  const addr = json.address || {};
  const data = {
    road: addr.road || addr.pedestrian || addr.path || addr.cycleway || '',
    suburb: addr.suburb || addr.quarter || addr.neighbourhood || '',
    neighbourhood: addr.neighbourhood || addr.hamlet || '',
    city_district: addr.city_district || addr.district || '',
    city: addr.city || addr.town || addr.village || '',
    display_name: json.display_name || '',
    raw: json
  };
  _geocodeCache.set(key, { data, at: Date.now() });
  return data;
}
