// js/lazy-lib.js — Tải thư viện CDN khi CẦN (bấm nút xuất PDF / đọc Excel / quét QR).
// Trước đây các thẻ <script> CDN nằm trong <head> → trang phải chờ tải xong (report.html ~400 KB)
// mới hiện, và 1 CDN chậm là cả trang đứng. Đo 29/09/2026: form mở lần đầu mất 7,4 s vì chờ jsQR.

const URLS = {
  jspdf: 'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js',
  autotable: 'https://cdn.jsdelivr.net/npm/jspdf-autotable@3.7.1/dist/jspdf.plugin.autotable.min.js',
  html2canvas: 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js',
  xlsx: 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js',
  jsqr: 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js'
};

const pending = {};

function loadScript(name) {
  if (!pending[name]) {
    pending[name] = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = URLS[name];
      s.onload = () => resolve();
      s.onerror = () => {
        delete pending[name];   // cho phép bấm lại khi có mạng
        reject(new Error('Không tải được thư viện — kiểm tra kết nối mạng rồi thử lại'));
      };
      document.head.appendChild(s);
    });
  }
  return pending[name];
}

/** jsPDF (+ autoTable nếu cần bảng). Trả về lớp jsPDF. */
export async function loadJsPDF({ autoTable = false } = {}) {
  if (!window.jspdf) await loadScript('jspdf');
  // autotable gắn vào jsPDF đã có sẵn → phải tải SAU jspdf
  if (autoTable && !window.jspdf.jsPDF.API.autoTable) await loadScript('autotable');
  return window.jspdf.jsPDF;
}

export async function loadHtml2canvas() {
  if (!window.html2canvas) await loadScript('html2canvas');
  return window.html2canvas;
}

export async function loadXLSX() {
  if (!window.XLSX) await loadScript('xlsx');
  return window.XLSX;
}

export async function loadJsQR() {
  if (typeof window.jsQR !== 'function') await loadScript('jsqr');
  return window.jsQR;
}
