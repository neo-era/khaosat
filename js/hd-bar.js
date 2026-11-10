// js/hd-bar.js — Thông tin hợp đồng duy tu trong form khảo sát (liên kết app Quản lý HĐ, 2026-11-09).
// Thiết kế: repo quanly-hopdong-duytu, docs/04_LienKet-KhaoSat.md (phương án giao diện B).
// - Thanh 1 dòng dính đáy màn hình: Gói · mã gói thầu · mã HM của loại đang nhập · còn lại (màu trung tính,
//   KHÔNG so với số đang nhập — KL HĐ chỉ để tham khảo, không gây áp lực sửa số hiện trường).
// - Chạm thanh → bảng chi tiết (bottom sheet).
// - Máy chủ chưa có hd_info → ẩn êm. Bàn phím mở → ẩn để không che ô đang nhập.
import { apiHdInfo } from './api.js';
import { escapeHtml } from './utils.js';

// Anh chốt 09/11/2026: mọi loại khảo sát đều có hạng mục HĐ duy tu tương ứng → thanh HĐ hiện ở cả 17 form
const SKIP_TYPES = [];
const CACHE_MS = 12 * 3600e3;          // dùng lại kết quả theo phường ≤ 12 giờ (mạng yếu)
const STALE_MS = 30 * 864e5;           // dữ liệu HĐ lập quá 30 ngày → nhãn "đã cũ"
const KEY = 'hd_info:';


// Kiểu dáng (nhúng thẳng, không thêm file CSS). Màu trung tính, chữ ≥ 14px, tương phản cao để đọc ngoài nắng.
const CSS = `
.hd-bar.hidden,.hd-sheet.hidden{display:none!important}
.hd-bar,.hd-sheet,.hd-badge{font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,sans-serif}
.hd-bar{position:fixed;left:0;right:0;bottom:0;z-index:30;display:flex;align-items:center;gap:10px;min-height:56px;
  padding:6px 14px calc(6px + env(safe-area-inset-bottom));background:#f1f5f9;border:0;border-top:1px solid #94a3b8;
  color:#0f172a;font-size:14px;text-align:left;box-shadow:0 -4px 12px rgba(15,23,42,.08);cursor:pointer;width:100%}
.hd-bar:focus-visible{outline:3px solid #1d4ed8;outline-offset:-3px}
.hd-bar .hd-ic{font-size:18px;flex:none}
.hd-bar .hd-tx{flex:1;min-width:0;display:flex;flex-direction:column;line-height:1.3}
.hd-bar .hd-tx b,.hd-bar .hd-sub{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.hd-bar .hd-sub{color:#1e293b;font-variant-numeric:tabular-nums}
.hd-bar .hd-more{flex:none;font-weight:700;color:#1d4ed8;min-height:44px;display:flex;align-items:center}
.hd-bar .hd-old{flex:none;font-size:12px;font-weight:600;color:#7c2d12;background:#ffedd5;border-radius:99px;padding:2px 8px}
.hd-bar[data-state=loading] .hd-tx b{color:#334155;font-weight:500}
.hd-bar[data-state=error] .hd-more{color:#991b1b}
body.has-hd-bar main{padding-bottom:calc(140px + env(safe-area-inset-bottom))}
.hd-sheet{position:fixed;inset:0;z-index:1050}
.hd-sheet .hd-scrim{position:absolute;inset:0;background:rgba(15,23,42,.45)}
.hd-sheet .hd-panel{position:absolute;left:0;right:0;bottom:0;max-height:80dvh;overflow:auto;background:#fff;color:#0f172a;
  border-radius:16px 16px 0 0;padding:6px 16px calc(16px + env(safe-area-inset-bottom));font-size:14px}
.hd-sheet .hd-head{display:flex;align-items:center;justify-content:space-between;font-size:16px;padding:6px 0}
.hd-sheet .hd-x{width:48px;height:48px;border-radius:12px;border:1px solid #cbd5e1;background:#f8fafc;font-size:18px}
.hd-sheet .hd-goi{margin:6px 0 10px}
.hd-sheet table{width:100%;border-collapse:collapse}
.hd-sheet th{font-size:13px;color:#334155;text-align:left;font-weight:600;padding:6px 4px;border-bottom:1px solid #cbd5e1}
.hd-sheet td{padding:8px 4px;border-bottom:1px solid #e2e8f0;vertical-align:top}
.hd-sheet .n{text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}
.hd-sheet .hd-ten{font-size:13px;color:#334155}
.hd-sheet .hd-note{margin-top:12px;padding:10px 12px;background:#f1f5f9;border-radius:10px;font-weight:600}
.hd-sheet .hd-upd{margin-top:8px;font-size:13px;color:#334155}
.hd-badge{display:inline-flex;align-items:center;gap:4px;font-size:12px;line-height:1.2;min-height:24px;padding:3px 8px;border-radius:99px;
  background:#eef2ff;color:#1e1b4b;border:1px solid #a5b4fc;white-space:nowrap}
@media (orientation:landscape) and (max-height:520px){.hd-bar{left:auto;width:50%;border-left:1px solid #94a3b8;border-radius:12px 0 0 0}}
`;
function ensureCss() {
  if (document.getElementById('hd-css')) return;
  const st = document.createElement('style');
  st.id = 'hd-css';
  st.textContent = CSS;
  document.head.appendChild(st);
}

const fmt = n => (n === null || n === undefined || n === '') ? '—' : Number(n).toLocaleString('vi-VN', { maximumFractionDigits: 3 });

export function cacheGet(type, phuong, now = Date.now()) {
  try {
    const c = JSON.parse(localStorage.getItem(KEY + type + '|' + phuong) || 'null');
    return c && now - c.at < CACHE_MS ? c.data : null;
  } catch (e) { return null; }
}
function cachePut(type, phuong, data) {
  try {
    if (!localStorage.getItem('auth')) return;   // đăng nhập "không ghi nhớ" → không để dữ liệu lại trên máy
    localStorage.setItem(KEY + type + '|' + phuong, JSON.stringify({ at: Date.now(), data }));
  } catch (e) { /* đầy bộ nhớ thì thôi */ }
}
export function clearHdCache() {
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) { const k = localStorage.key(i); if (k && k.indexOf(KEY) === 0) localStorage.removeItem(k); }
  } catch (e) { /* bỏ qua */ }
}

/** Nội dung thanh theo kết quả hd_info — tách riêng để test. Trả { hidden } hoặc { text, sub, state }. */
export function barModel(res, { now = Date.now(), phuong = '' } = {}) {
  if (!res) return { state: 'loading', text: 'Đang tải thông tin HĐ…' };
  if (res.error) return { state: 'error', text: 'Không tải được thông tin HĐ', action: 'Thử lại' };
  if (res.oldBackend) return { hidden: true };
  if (!res.has) return { state: 'empty', text: 'Chưa có dữ liệu hợp đồng' };
  const g = res.goi || {};
  const stale = res.updated_at && now - new Date(res.updated_at).getTime() > STALE_MS;
  if (!g.goi) return { state: 'empty', text: (phuong ? 'Phường ' + phuong : 'Phường này') + ' chưa có trong HĐ', stale };
  if (g.goi === 'nhieu') return { state: 'data', text: 'Phường thuộc nhiều gói: ' + (g.goiList || []).map(x => x.replace(/^G/, 'Gói ')).join(', '), stale };
  const head = g.goi.replace(/^G/, 'Gói ') + (g.maGoiThau ? ' · ' + g.maGoiThau : '');
  const h = (res.hm || [])[0];
  const sub = h ? h.ma + ' · HĐ ' + fmt(h.hd) + ' · còn ' + fmt(h.conLai) + (res.hm.length > 1 ? ' (+' + (res.hm.length - 1) + ')' : '') : '';
  return { state: 'data', text: head, sub, stale };
}

/**
 * Gắn thanh HĐ vào form. getPhuong() trả tên phường đang chọn.
 * Gọi lại khi phường đổi: document phát sự kiện 'phuong-change'.
 */
/** Người KS đã chọn mã (js/hd-chon.js) → thanh hiện gói/mã đã chọn thay cho mã mặc định. */
export function apChon(m, chon) {
  if (!m || m.hidden || m.state === 'loading' || m.state === 'error' || !chon || !chon.goi || !(chon.ds || []).length) return m;
  const h = chon.ds[0];
  return Object.assign({}, m, {
    state: 'data',
    text: String(chon.goi).replace(/^G/, 'Gói ') + ' · KS chọn',
    sub: h.ma + (h.hd !== undefined ? ' · HĐ ' + fmt(h.hd) + ' · còn ' + fmt(h.conLai) : '') + (chon.ds.length > 1 ? ' (+' + (chon.ds.length - 1) + ')' : '')
  });
}

export function initHdBar({ type, user, getPhuong }) {
  if (!user || user.role === 'demo' || SKIP_TYPES.includes(type)) return null;
  ensureCss();
  const bar = document.createElement('button');
  bar.type = 'button';
  bar.id = 'hd-bar';
  bar.setAttribute('aria-haspopup', 'dialog');
  bar.className = 'hd-bar hidden';
  document.body.appendChild(bar);
  const sheet = document.createElement('div');
  sheet.id = 'hd-sheet';
  sheet.className = 'hd-sheet hidden';
  sheet.setAttribute('role', 'dialog');
  sheet.setAttribute('aria-modal', 'true');
  sheet.setAttribute('aria-label', 'Thông tin hợp đồng');
  document.body.appendChild(sheet);
  document.body.classList.add('has-hd-bar');

  let cur = null, curPhuong = '', seq = 0, kbOpen = false, timer = 0, chon = null;

  const paint = () => {
    const m = apChon(curPhuong ? barModel(cur, { phuong: curPhuong }) : { hidden: true }, chon);
    bar.classList.toggle('hidden', !!m.hidden || kbOpen);
    if (m.hidden) return;
    bar.dataset.state = m.state;
    bar.innerHTML = `<span class="hd-ic" aria-hidden="true">📄</span>
      <span class="hd-tx"><b>${escapeHtml(m.text)}</b>${m.sub ? `<span class="hd-sub">${escapeHtml(m.sub)}</span>` : ''}</span>
      ${m.stale ? '<span class="hd-old">dữ liệu HĐ đã cũ</span>' : ''}
      <span class="hd-more">${m.action ? escapeHtml(m.action) : (m.state === 'data' ? 'Chi tiết ▴' : '')}</span>`;
    bar.setAttribute('aria-label', m.text + (m.sub ? ', ' + m.sub : '') + (m.action ? '. ' + m.action : '. Chạm để xem chi tiết'));
  };

  const load = async (force) => {
    const p = String(getPhuong() || '').trim();
    curPhuong = p;
    if (!p) { cur = null; paint(); return; }
    const my = ++seq;
    const cached = !force && cacheGet(type, p);
    cur = cached || null;
    paint();
    if (cached) return;
    try {
      const r = await apiHdInfo({ phuong: p, type });
      if (my !== seq) return;
      cur = r;
      if (r && r.has) cachePut(type, p, r);
    } catch (e) {
      if (my !== seq) return;
      console.warn('hd_info', e);
      cur = { error: e.message || String(e) };
    }
    paint();
  };
  const schedule = () => { clearTimeout(timer); timer = setTimeout(() => load(false), 500); };

  const openSheet = () => {
    if (!cur || cur.error) { load(true); return; }
    if (!cur.has) return;
    const g = cur.goi || {};
    const rows = (cur.hm || []).map(h => `<tr><td><b>${escapeHtml(h.ma)}</b><div class="hd-ten">${escapeHtml(h.ten)}</div></td>
      <td class="n">${fmt(h.hd)}</td><td class="n">${fmt(h.daKH)}</td><td class="n"><b>${fmt(h.conLai)}</b> ${escapeHtml(h.dvt)}</td></tr>`).join('');
    const goiTx = g.goi === 'nhieu' ? 'Phường thuộc nhiều gói: ' + (g.goiList || []).map(escapeHtml).join(', ') + ' — số theo từng gói xem ở app Quản lý HĐ.'
      : g.goi ? `${escapeHtml(g.goi.replace(/^G/, 'Gói '))}${g.maGoiThau ? ' · mã gói thầu <b>' + escapeHtml(g.maGoiThau) + '</b>' : ''} · năm ${escapeHtml(String(cur.nam || ''))}`
      : 'Phường này chưa có trong dữ liệu hợp đồng.';
    sheet.innerHTML = `<div class="hd-scrim" data-close></div>
      <div class="hd-panel">
        <div class="hd-head"><b>Thông tin hợp đồng</b><button type="button" class="hd-x" data-close aria-label="Đóng">✕</button></div>
        <p class="hd-goi">${goiTx}</p>
        ${rows ? `<div class="hd-tbl"><table><thead><tr><th>Hạng mục</th><th class="n">KL HĐ</th><th class="n">Đã vào KH</th><th class="n">Còn lại</th></tr></thead><tbody>${rows}</tbody></table></div>`
               : (g.goi && g.goi !== 'nhieu' ? '<p class="hd-goi">Chưa gán mã hạng mục cho loại khảo sát này.</p>' : '')}
        <p class="hd-note">Nhập đúng số đo hiện trường; KL HĐ chỉ để tham khảo.</p>
        <p class="hd-upd">Cập nhật ${cur.updated_at ? new Date(cur.updated_at).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' }) : '—'}${cur.by ? ' · ' + escapeHtml(cur.by) : ''}</p>
      </div>`;
    sheet.classList.remove('hidden');
    const x = sheet.querySelector('.hd-x');
    if (x) x.focus();
  };
  const closeSheet = () => { sheet.classList.add('hidden'); bar.focus(); };
  bar.addEventListener('click', () => (cur && cur.error ? load(true) : openSheet()));
  sheet.addEventListener('click', e => { if (e.target.closest('[data-close]')) closeSheet(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !sheet.classList.contains('hidden')) closeSheet(); });
  document.addEventListener('phuong-change', schedule);
  document.addEventListener('hd-chon-change', e => { chon = e.detail || null; paint(); });

  // Bàn phím ảo mở (khung nhìn thấp hẳn) → ẩn thanh
  const vv = window.visualViewport;
  if (vv) vv.addEventListener('resize', () => { const k = vv.height < window.innerHeight * 0.75; if (k !== kbOpen) { kbOpen = k; paint(); } });

  load(false);
  return { reload: () => load(true), state: () => cur };
}

/** Trạng thái liên kết của các bản ghi (cho danh sách). Lỗi / máy chủ cũ → Map rỗng. */
export async function hdLienKet(pairs) {
  const out = new Map();
  if (!pairs || !pairs.length) return out;
  try {
    for (let i = 0; i < pairs.length; i += 500) {
      const r = await apiHdInfo({ pairs: pairs.slice(i, i + 500) });
      (r.lienKet || []).forEach(x => out.set(x.type + '#' + x.stt, x));
    }
  } catch (e) { /* không chặn danh sách */ }
  return out;
}

/** Nhãn trạng thái liên kết: chữ + biểu tượng (không chỉ dựa vào màu). */
export function lienKetBadge(lk) {
  ensureCss();
  if (!lk || !lk.trangThai) return '';
  const icon = /thực hiện/i.test(lk.trangThai) ? '✔' : /nháp/i.test(lk.trangThai) ? '✎' : '📄';
  const tx = lk.trangThai + (lk.thang ? ' ' + lk.thang : '') + (lk.phuLuc && !/nháp/i.test(lk.trangThai) ? ' · ' + lk.phuLuc : '');
  return `<span class="hd-badge" title="Liên kết hợp đồng">${icon} ${escapeHtml(tx)}</span>`;
}
