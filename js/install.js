// js/install.js — PWA install prompt helper (Chrome/Edge/Android + iOS Safari guide)

let _deferredPrompt = null;

function _isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches ||
         (typeof navigator.standalone === 'boolean' && navigator.standalone);
}

export function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !('MSStream' in window);
}

/**
 * Khởi tạo install prompt. Gọi sau khi DOM sẵn sàng.
 *
 * Quy ước data attributes:
 *   data-install-chrome  — nút xuất hiện khi beforeinstallprompt kích hoạt (Chrome/Edge/Android)
 *   data-install-ios     — nút xuất hiện trên iOS Safari (mở modal hướng dẫn)
 *   data-ios-close       — nút / overlay đóng modal iOS
 *
 * ID đặc biệt:
 *   ios-install-modal    — div modal iOS
 */
export function initInstallPrompt() {
  if (_isStandalone()) return; // đã cài — không cần nữa

  const chromeBtns = Array.from(document.querySelectorAll('[data-install-chrome]'));
  const iosBtns    = Array.from(document.querySelectorAll('[data-install-ios]'));
  const iosModal   = document.getElementById('ios-install-modal');

  // Đóng modal iOS
  if (iosModal) {
    iosModal.addEventListener('click', e => {
      if (e.target === iosModal) iosModal.classList.add('hidden');
    });
  }
  document.querySelectorAll('[data-ios-close]').forEach(btn =>
    btn.addEventListener('click', () => iosModal && iosModal.classList.add('hidden'))
  );

  // iOS Safari: beforeinstallprompt không hoạt động → hiện hướng dẫn thủ công
  if (isIOS()) {
    iosBtns.forEach(btn => {
      btn.classList.remove('hidden');
      btn.addEventListener('click', () => iosModal && iosModal.classList.remove('hidden'));
    });
    return;
  }

  // Chrome / Edge / Android Chrome: lắng nghe beforeinstallprompt
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    _deferredPrompt = e;
    chromeBtns.forEach(btn => btn.classList.remove('hidden'));
  });

  chromeBtns.forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!_deferredPrompt) return;
      _deferredPrompt.prompt();
      await _deferredPrompt.userChoice;
      _deferredPrompt = null;
      chromeBtns.forEach(b => b.classList.add('hidden'));
    });
  });

  // Sau khi cài xong → ẩn tất cả nút
  window.addEventListener('appinstalled', () => {
    _deferredPrompt = null;
    chromeBtns.forEach(b => b.classList.add('hidden'));
    iosBtns.forEach(b => b.classList.add('hidden'));
  });
}
