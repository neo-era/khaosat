// js/sw-update.js — Đăng ký service worker + TỰ CẬP NHẬT khi phát hành phiên bản mới (user chốt 2026-09-30).
//
// Trước đây mỗi trang chỉ register('sw.js'); bản mới chỉ về máy ở lần mở sau, có máy kẹt bản cũ nhiều ngày
// (user in biên bản vẫn ra bản lỗi đã sửa). Giờ:
//   - Hỏi máy chủ có sw.js mới không: lúc mở trang, mỗi 30 phút, và mỗi lần app được mở lại từ nền.
//   - Bản mới nắm quyền (controllerchange) → trang KHÔNG có việc dở thì tự tải lại ngay;
//     đang nhập form / sửa biên bản / đang gõ → hiện thanh "Có phiên bản mới — Cập nhật" để tự bấm.
//   - Hiện số phiên bản (CACHE_NAME của sw.js) vào mọi phần tử [data-app-version].
// Không import module khác để test Node nạp được trực tiếp.

const CHECK_EVERY_MS = 30 * 60 * 1000;
const busyChecks = [];

/** Trang tự khai "đang có việc dở" (vd form có dữ liệu chưa lưu, ảnh đang tải lên). */
export function registerBusyCheck(fn) {
  busyChecks.push(fn);
}

/** Quyết định khi bản mới nắm quyền điều khiển trang. Tách riêng để test. */
export function decideUpdate({ hadController, busy }) {
  if (!hadController) return 'ignore';   // lần cài đầu tiên: trang đang chạy đã là bản mới nhất
  return busy ? 'banner' : 'reload';
}

let busyCount = 0;

/**
 * Đánh dấu "đang ghi dữ liệu" (gửi hàng chờ, nhập Excel, lưu sổ, xoá hàng loạt, mọi lệnh ghi).
 * Tự tải lại giữa chừng = máy chủ đã ghi nhưng máy chưa biết → gửi lại ra bản TRÙNG.
 * Trả về hàm kết thúc (gọi nhiều lần cũng chỉ trừ 1).
 */
export function beginBusy() {
  busyCount++;
  let done = false;
  return () => { if (!done) { done = true; busyCount--; } };
}

export function isBusy() {
  if (busyCount > 0) return true;
  const a = document.activeElement;
  if (a && (a.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) && a.type !== 'button')) return true;
  // Biên bản đang mở để sửa (ô contenteditable) — tải lại là mất chữ đã gõ
  if (document.querySelector('[contenteditable="true"]')) return true;
  return busyChecks.some(fn => { try { return !!fn(); } catch (e) { return false; } });
}

function showBanner() {
  if (document.getElementById('app-update-bar')) return;
  const bar = document.createElement('div');
  bar.id = 'app-update-bar';
  bar.className = 'no-print';
  bar.setAttribute('role', 'status');
  bar.style.cssText = 'position:fixed;left:8px;right:8px;bottom:8px;z-index:1300;display:flex;align-items:center;gap:8px;' +
    'background:#1e3a8a;color:#fff;padding:8px 8px 8px 14px;border-radius:12px;box-shadow:0 6px 20px rgba(0,0,0,.3);font-size:15px;max-width:520px;margin:0 auto';
  bar.innerHTML = '<span style="flex:1">🔄 Có phiên bản mới. Lưu xong việc đang làm rồi bấm Cập nhật.</span>' +
    '<button type="button" style="min-height:44px;padding:0 14px;border-radius:10px;background:#fff;color:#1e3a8a;font-weight:600;border:0">Cập nhật</button>';
  bar.querySelector('button').onclick = () => location.reload();
  document.body.appendChild(bar);
  // Thanh cố định ở đáy: chừa chỗ để không che nút Lưu cuối form
  document.body.style.paddingBottom = '96px';
}

function showVersion() {
  if (!document.querySelector('[data-app-version]')) return;
  navigator.serviceWorker.addEventListener('message', e => {
    if (e.data && e.data.type === 'VERSION') {
      const v = String(e.data.version || '').replace(/^khaosat-/, '');
      document.querySelectorAll('[data-app-version]').forEach(el => { el.textContent = 'Phiên bản ' + v; });
    }
  });
  // Lần mở đầu trang chưa có controller → hỏi SW đang chạy khi nó sẵn sàng
  navigator.serviceWorker.ready.then(reg => reg.active && reg.active.postMessage({ type: 'GET_VERSION' })).catch(() => {});
}

export function initSwUpdate() {
  if (!('serviceWorker' in navigator)) return;
  // "Đã cài từ trước" = máy đã có SW đang chạy. Không dựa vào controller: trang mở bằng Ctrl+Shift+R
  // không có controller nhưng vẫn là bản cũ, phải được cập nhật.
  let hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.getRegistration()
    .then(r => { if (r && r.active) hadController = true; }).catch(() => {});
  let handled = false;

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (handled) return;
    const action = decideUpdate({ hadController, busy: isBusy() });
    // Lần cài đầu: chỉ ghi nhận "đã có bản chạy" — KHÔNG khoá, để bản phát hành sau vẫn được xử lý
    hadController = true;
    if (action === 'ignore') return;
    handled = true;
    if (action === 'reload') location.reload();
    else showBanner();
  });

  navigator.serviceWorker.register('sw.js').then(reg => {
    const check = () => reg.update().catch(() => {});   // mất mạng: bỏ qua, lần sau hỏi lại
    setInterval(check, CHECK_EVERY_MS);
    // App điện thoại thường chỉ được "mở lại từ nền" chứ không mở mới → hỏi mỗi lần hiện lên
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check(); });
  }).catch(() => {});

  showVersion();
}
