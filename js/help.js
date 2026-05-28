// js/help.js — Floating help button + slide-in drawer dẫn đến huongdansudung.html.
// Dùng chung cho tất cả trang. Gọi: initHelp('ktv' | 'admin' | 'chung' | 'auto')

import { getCurrentUser } from './auth.js';

/**
 * Thêm nút trợ giúp nổi vào trang.
 * @param {'ktv'|'admin'|'chung'|'auto'} tab  Tab mặc định khi mở.
 *   'auto' = tự chọn dựa vào role user hiện tại.
 */
export function initHelp(tab = 'auto') {
  // Không hiện trên chính trang hướng dẫn
  if (location.pathname.endsWith('huongdansudung.html')) return;

  const resolvedTab = tab === 'auto' ? detectTab() : tab;

  injectStyles();
  const fab     = createFab();
  const overlay = createOverlay(resolvedTab);

  document.body.appendChild(fab);
  document.body.appendChild(overlay);

  fab.addEventListener('click', () => openDrawer(overlay));
  overlay.querySelector('.help-close').addEventListener('click', () => closeDrawer(overlay));
  overlay.addEventListener('click', e => {
    if (e.target === overlay) closeDrawer(overlay);
  });

  // Keyboard: Escape đóng drawer
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && overlay.classList.contains('help-open')) closeDrawer(overlay);
  });
}

// ── Nội bộ ────────────────────────────────────────────────────

function detectTab() {
  try {
    const user = getCurrentUser();
    if (!user) return 'ktv';
    return (user.role === 'admin' || user.role === 'user') ? 'admin' : 'ktv';
  } catch { return 'ktv'; }
}

function createFab() {
  const btn = document.createElement('button');
  btn.id = 'help-fab';
  btn.setAttribute('aria-label', 'Hướng dẫn sử dụng');
  btn.setAttribute('title', 'Hướng dẫn sử dụng');
  btn.innerHTML = '<span aria-hidden="true">📖</span>';
  return btn;
}

function createOverlay(tab) {
  const div = document.createElement('div');
  div.id = 'help-overlay';
  div.setAttribute('role', 'dialog');
  div.setAttribute('aria-label', 'Hướng dẫn sử dụng');

  // Resolve đường dẫn tương đối từ bất kỳ trang nào
  const base = resolveBase();

  div.innerHTML = `
    <div id="help-drawer" role="document">
      <div class="help-header">
        <span class="help-title">📖 Hướng dẫn sử dụng</span>
        <div class="help-header-actions">
          <a class="help-open-new" href="${base}huongdansudung.html#${tab}"
             target="_blank" rel="noopener" title="Mở trang mới">↗</a>
          <button class="help-close" aria-label="Đóng">✕</button>
        </div>
      </div>
      <iframe
        id="help-iframe"
        src="${base}huongdansudung.html#${tab}"
        title="Hướng dẫn sử dụng SAPULICO"
        loading="lazy">
      </iframe>
    </div>`;
  return div;
}

function resolveBase() {
  // Nếu file nằm trong thư mục con (vd tools/), thêm ../
  const parts = location.pathname.split('/');
  const depth = parts.filter(Boolean).length;
  // GitHub Pages: /khaosat/tools/foo.html → depth = 3
  // GitHub Pages: /khaosat/index.html    → depth = 2
  const extra = depth > 2 ? '../' : '';
  return extra;
}

function openDrawer(overlay) {
  overlay.classList.add('help-open');
  document.body.style.overflow = 'hidden';
}

function closeDrawer(overlay) {
  overlay.classList.remove('help-open');
  document.body.style.overflow = '';
}

function injectStyles() {
  if (document.getElementById('help-styles')) return;
  const style = document.createElement('style');
  style.id = 'help-styles';
  style.textContent = `
    /* ── FAB ── */
    #help-fab {
      position: fixed;
      bottom: 80px;
      right: 16px;
      z-index: 900;
      width: 48px;
      height: 48px;
      border-radius: 50%;
      background: #1d4ed8;
      color: #fff;
      border: none;
      cursor: pointer;
      font-size: 22px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 12px rgba(0,0,0,.25);
      transition: background .15s, transform .15s;
      -webkit-tap-highlight-color: transparent;
    }
    #help-fab:hover { background: #1e40af; transform: scale(1.08); }
    #help-fab:active { transform: scale(.94); }

    /* ── Overlay backdrop ── */
    #help-overlay {
      display: none;
      position: fixed;
      inset: 0;
      z-index: 950;
      background: rgba(0,0,0,.45);
    }
    #help-overlay.help-open { display: block; }

    /* ── Drawer ── */
    #help-drawer {
      position: absolute;
      top: 0;
      right: 0;
      bottom: 0;
      width: 100%;
      max-width: 480px;
      background: #fff;
      display: flex;
      flex-direction: column;
      box-shadow: -4px 0 24px rgba(0,0,0,.18);
      transform: translateX(100%);
      transition: transform .25s cubic-bezier(.4,0,.2,1);
    }
    #help-overlay.help-open #help-drawer { transform: translateX(0); }

    /* ── Header trong drawer ── */
    .help-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 12px;
      height: 48px;
      border-bottom: 1px solid #e5e7eb;
      flex-shrink: 0;
    }
    .help-title {
      font-size: 15px;
      font-weight: 600;
      color: #1e3a8a;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .help-header-actions { display: flex; align-items: center; gap: 4px; }
    .help-open-new {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 36px;
      height: 36px;
      border-radius: 6px;
      color: #6b7280;
      text-decoration: none;
      font-size: 16px;
    }
    .help-open-new:hover { background: #f3f4f6; color: #1d4ed8; }
    .help-close {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 36px;
      height: 36px;
      border-radius: 6px;
      background: none;
      border: none;
      cursor: pointer;
      font-size: 18px;
      color: #6b7280;
    }
    .help-close:hover { background: #f3f4f6; color: #111; }

    /* ── Iframe ── */
    #help-iframe {
      flex: 1;
      width: 100%;
      border: none;
    }

    /* ── Mobile: full-width drawer ── */
    @media (max-width: 520px) {
      #help-drawer { max-width: 100%; }
      #help-fab { bottom: 72px; right: 12px; width: 44px; height: 44px; font-size: 20px; }
    }
  `;
  document.head.appendChild(style);
}
