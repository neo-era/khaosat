// js/change-password.js — trang đổi mật khẩu (doi-mat-khau.html)
//
// Hai tình huống dùng chung 1 trang:
//   1. Bị BẮT đổi — admin vừa đặt mật khẩu tạm (cờ must_change). requireAuth() ở
//      mọi trang khác sẽ đẩy user về đây, không cho đi đâu khác.
//   2. Tự nguyện đổi — user vào từ menu.
import { requireAuth, getCurrentUser, logout, clearMustChange } from './auth.js';
import { apiChangePassword } from './api.js';

const MIN_LEN = 8;

export function initChangePassword() {
  // requireAuth ở trang này KHÔNG đẩy đi đâu khi must_change (đã trừ trong auth.js),
  // nhưng vẫn chặn người chưa đăng nhập.
  requireAuth();
  const user = getCurrentUser();

  document.getElementById('hello').textContent = `${user.full_name} (${user.username})`;

  const forced = user.must_change === true;
  if (forced) {
    document.getElementById('force-banner').classList.remove('hidden');
    // Đang bị bắt đổi thì không cho lách sang trang khác
    document.getElementById('link-home').classList.add('hidden');
  }

  const form = document.getElementById('pwd-form');
  const cur = document.getElementById('cur');
  const new1 = document.getElementById('new1');
  const new2 = document.getElementById('new2');
  const btn = document.getElementById('submit-btn');
  const errEl = document.getElementById('error-msg');
  const okEl = document.getElementById('ok-msg');

  document.getElementById('show-pwd').onchange = (e) => {
    const t = e.target.checked ? 'text' : 'password';
    cur.type = new1.type = new2.type = t;
  };

  document.getElementById('btn-logout').onclick = () => logout();

  const showErr = (m) => {
    okEl.classList.add('hidden');
    errEl.textContent = m;
    errEl.classList.remove('hidden');
  };
  const showOk = (m) => {
    errEl.classList.add('hidden');
    okEl.textContent = m;
    okEl.classList.remove('hidden');
  };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errEl.classList.add('hidden');

    const c = cur.value;
    const n1 = new1.value;
    const n2 = new2.value;

    // Kiểm tra phía client cho phản hồi nhanh — server vẫn kiểm lại toàn bộ
    if (!c || !n1 || !n2) return showErr('Nhập đủ 3 ô');
    if (n1 !== n2) return showErr('Hai ô mật khẩu mới không khớp');
    if (n1.length < MIN_LEN) return showErr(`Mật khẩu mới phải từ ${MIN_LEN} ký tự trở lên`);
    if (n1.toLowerCase() === user.username.toLowerCase()) {
      return showErr('Mật khẩu không được trùng tên đăng nhập');
    }
    if (n1 === c) return showErr('Mật khẩu mới phải khác mật khẩu hiện tại');

    btn.disabled = true;
    const origText = btn.textContent;
    btn.textContent = '⏳ Đang đổi...';

    try {
      await apiChangePassword(c, n1);
      clearMustChange();
      showOk('Đã đổi mật khẩu. Đang chuyển về trang chủ...');
      form.reset();
      setTimeout(() => location.replace('index.html'), 1200);
    } catch (err) {
      showErr(String(err.message || err));
      btn.disabled = false;
      btn.textContent = origText;
      cur.value = '';
      cur.focus();
    }
  });
}
