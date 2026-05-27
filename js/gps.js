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
