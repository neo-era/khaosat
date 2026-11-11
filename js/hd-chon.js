// js/hd-chon.js — Chọn gói + mã hạng mục HĐ ngay trong form khảo sát (GĐ2 liên kết HĐ, anh yêu cầu 10/11/2026).
// Thiết kế + tiêu chí: repo quanly-hopdong-duytu, docs/04_LienKet-KhaoSat.md mục 6 (chốt UI: phương án C —
// ô "Hạng mục HĐ" trong form + bảng chọn nhóm dạng chip + ô tìm trên toàn bộ danh mục).
// - Mặc định "Để app HĐ tự chọn" (không gửi gì). Chọn tối đa 3 mã, mỗi mã có hệ số KL.
// - Gợi ý theo lần chọn trước chỉ là chip, phải chạm mới thành lựa chọn (không tự chọn sẵn).
// - Lựa chọn lưu cùng bản ghi khi bấm Lưu form (submit/update kèm `hd`); hàng chờ offline giữ trong payload.
// - Máy chủ cũ (hd_info không có cờ `chon`) / chưa có dữ liệu HĐ → ẩn hẳn ô.
import { apiHdInfo } from './api.js';
import { escapeHtml } from './utils.js';
import { PHUONG_XA } from './dia-ban.js';

export const MAX_MA = 3;
const HOC_KEY = 'hd_hoc_v1:';
const HOC_MAX = 200;

// ===================== Lõi thuần (test được) =====================
export const fold = (x) => String(x ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase().replace(/\s+/g, ' ').trim();
const normPhuong = (s) => fold(s).replace(/^(?:(?:phuong|xa)\s+|p\.\s*|p\s+)/, '').trim();

/** Tìm theo mã hoặc tên (bỏ dấu); "186" khớp HM186. Trả danh sách đã lọc, giữ thứ tự. */
export function timHm(list, q) {
  const t = fold(q);
  if (!t) return list.slice();
  const so = t.replace(/^hm/, '');
  return list.filter((h) => fold(h.ma).includes(t) || (/^\d+$/.test(so) && fold(h.ma).replace(/^hm/, '').startsWith(so)) || fold(h.ten).includes(t));
}

/** Gom hm theo nhóm (giữ thứ tự xuất hiện). Nhóm rỗng → "Khác". */
export function nhomHm(list) {
  const out = [];
  for (const h of list) {
    const ten = h.nhom || 'Khác';
    let g = out.find((x) => x.nhom === ten);
    if (!g) { g = { nhom: ten, hm: [] }; out.push(g); }
    g.hm.push(h);
  }
  return out;
}

/** Quận cũ của 1 phường (theo danh mục địa bàn của app). */
export function quanCuaPhuong(phuong, dsPhuong = PHUONG_XA) {
  const k = normPhuong(phuong);
  const p = dsPhuong.find((x) => normPhuong(x.ten) === k);
  return p ? p.quan_cu : '';
}

/**
 * Thứ tự gói để chọn tay: gói có phường cùng quận cũ đứng trước (cungQuan:true), rồi các gói khác.
 * goiAll: [{goi, maGoiThau}]; phuongGoi: [[phường, gói]].
 */
export function xepGoi(goiAll, phuongGoi, phuong, dsPhuong = PHUONG_XA) {
  const q = quanCuaPhuong(phuong, dsPhuong);
  const cung = new Set();
  if (q) for (const [p, g] of phuongGoi || []) if (quanCuaPhuong(p, dsPhuong) === q) cung.add(String(g));
  return (goiAll || []).map((x) => ({ ...x, cungQuan: cung.has(x.goi) }))
    .sort((a, b) => (b.cungQuan - a.cungQuan) || a.goi.localeCompare(b.goi));
}

/** Gói đang chọn còn hợp phường không: phường đúng 1 gói → phải trùng; nhiều gói → phải trong danh sách; chưa có → gói nào cũng được. */
export function goiHopPhuong(goi, goiPhuong) {
  if (!goi) return true;
  const g = goiPhuong && goiPhuong.goi;
  if (!g) return true;
  if (g === 'nhieu') return (goiPhuong.goiList || []).includes(goi);
  return g === goi;
}

/** So lựa chọn khi sửa bản: không tính cờ goiTay (tránh ghi lại + Audit thừa khi người dùng không đổi gì). */
export function cungLuaChon(a, b) {
  const k = (x) => (x ? JSON.stringify([x.nam, x.goi, (x.ds || []).map((d) => [d.ma, Number(d.heSo) || 1])]) : 'null');
  return k(a) === k(b);
}

/** Kiểm lựa chọn phía máy (máy chủ kiểm lại): trả lựa chọn sạch hoặc null. */
export function chonSach(hd) {
  if (!hd || typeof hd !== 'object' || !Array.isArray(hd.ds)) return null;
  const ds = [];
  for (const d of hd.ds) {
    if (ds.length >= MAX_MA) break;
    const ma = String(d?.ma || '');
    if (!/^HM\d{1,4}[A-Za-z0-9]{0,4}$/.test(ma) || ds.some((x) => x.ma === ma)) continue;
    const heSo = d.heSo === undefined || d.heSo === '' || d.heSo === null ? 1 : Number(d.heSo);
    if (!(heSo > 0 && heSo <= 100)) continue;
    ds.push({ ma, heSo });
  }
  if (!ds.length || !/^G\d{1,2}$/.test(String(hd.goi || ''))) return null;
  const nam = Math.floor(Number(hd.nam));
  return { nam: nam >= 2020 && nam <= 2100 ? nam : new Date().getFullYear(), goi: String(hd.goi), ds };
}

/** Bộ nhớ học (theo người dùng, trên máy). Hỏng/không có localStorage → coi như rỗng, không ném lỗi. */
export function hocDoc(username, store = globalThis.localStorage) {
  try {
    const o = JSON.parse(store.getItem(HOC_KEY + username) || 'null');
    return o && typeof o === 'object' && o.v === 1 && o.m && typeof o.m === 'object' ? o : { v: 1, m: {} };
  } catch (e) { return { v: 1, m: {} }; }
}
export function hocGhi(username, hoc, store = globalThis.localStorage) {
  try {
    if (!store.getItem('auth')) return;   // đăng nhập "không ghi nhớ" → không để lại dữ liệu trên máy
    const ks = Object.keys(hoc.m);
    if (ks.length > HOC_MAX) ks.sort((a, b) => (hoc.m[a].at || 0) - (hoc.m[b].at || 0)).slice(0, ks.length - HOC_MAX).forEach((k) => delete hoc.m[k]);
    store.setItem(HOC_KEY + username, JSON.stringify(hoc));
  } catch (e) { /* đầy bộ nhớ thì thôi */ }
}
/** Ghi nhớ sau khi lưu bản thành công: gói theo phường (khi chọn tay), mã theo loại + gói + năm. */
export function hocNho(hoc, { type, phuong, hd, goiTay }, now = Date.now()) {
  if (!hd) return hoc;
  if (goiTay) hoc.m['g|' + normPhuong(phuong)] = { goi: hd.goi, at: now };
  hoc.m['m|' + type + '|' + hd.goi + '|' + hd.nam] = { ds: hd.ds.map((d) => ({ ma: d.ma, heSo: d.heSo })), at: now };
  return hoc;
}
/** Gợi ý: { goi } theo phường, { ds } theo loại + gói + năm — chỉ giữ mã còn trong danh mục hiện tại. */
export function hocGoiY(hoc, { type, phuong, goi, nam, hm }) {
  const out = {};
  const g = hoc.m['g|' + normPhuong(phuong)];
  if (g && /^G\d{1,2}$/.test(g.goi)) out.goi = g.goi;
  const m = goi ? hoc.m['m|' + type + '|' + goi + '|' + nam] : null;
  if (m && Array.isArray(m.ds)) {
    const co = new Set((hm || []).map((h) => h.ma));
    const ds = m.ds.filter((d) => co.has(d.ma)).slice(0, MAX_MA);
    if (ds.length) out.ds = ds;
  }
  return out;
}
export function hocXoa(username, store = globalThis.localStorage) {
  try { store.removeItem(HOC_KEY + username); } catch (e) { /* bỏ qua */ }
}

// ===================== Giao diện =====================
const CSS = `
.hdc{--hc-bg:#fff;--hc-tx:#0f172a;--hc-mut:#334155;--hc-line:#64748b;--hc-soft:#e2e8f0;--hc-chip:#f1f5f9;--hc-acc:#1d4ed8;--hc-accbg:#eef2ff;
  --hc-warn:#7c2d12;--hc-warnbg:#ffedd5;--hc-bad:#991b1b;--hc-badbg:#fee2e2;font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,sans-serif}
@media (prefers-color-scheme:dark){.hdc{--hc-bg:#111a2e;--hc-tx:#e2e8f0;--hc-mut:#cbd5e1;--hc-line:#94a3b8;--hc-soft:#334155;--hc-chip:#1e293b;--hc-acc:#93c5fd;--hc-accbg:#1e3a8a;
  --hc-warn:#fed7aa;--hc-warnbg:#7c2d12;--hc-bad:#fecaca;--hc-badbg:#7f1d1d}}
.hdc-field{display:block;width:100%;text-align:left;min-height:56px;padding:10px 12px;border:2px solid var(--hc-line);border-radius:12px;background:var(--hc-bg);color:var(--hc-tx);font-size:15px;line-height:1.35;cursor:pointer}
.hdc-field:focus-visible{outline:3px solid var(--hc-acc);outline-offset:2px}
.hdc-field.on{border-color:var(--hc-acc);background:var(--hc-accbg)}
.hdc-field.warn{border-color:#b45309}
.hdc-field.flash{animation:hdcFlash 1s ease}
@keyframes hdcFlash{0%,100%{box-shadow:none}30%{box-shadow:0 0 0 4px rgba(29,78,216,.45)}}
.hdc-field .sub{display:block;font-size:14px;color:var(--hc-mut);margin-top:2px}
.hdc-field .go{float:right;font-weight:700;color:var(--hc-acc);margin-left:8px}
.hdc-pill{display:inline-block;font-size:13px;font-weight:700;border-radius:99px;padding:1px 8px;margin-left:4px;vertical-align:1px}
.hdc-pill.learn{background:var(--hc-warnbg);color:var(--hc-warn)}
.hdc-pill.bad{background:var(--hc-badbg);color:var(--hc-bad)}
.hdc-sheet{position:fixed;inset:0;z-index:1060}
.hdc-sheet.hidden,.hdc-toast.hidden,.hdc-wrap.hidden{display:none!important}
.hdc-scrim{position:absolute;inset:0;background:rgba(15,23,42,.5)}
.hdc-panel{position:absolute;left:0;right:0;bottom:0;max-height:88dvh;display:flex;flex-direction:column;background:var(--hc-bg);color:var(--hc-tx);
  border-radius:16px 16px 0 0;font-size:15px;overflow:hidden}
.hdc-panel.full{top:0;max-height:none;height:var(--hdc-vvh,100dvh);border-radius:0}
.hdc-grab{width:44px;height:5px;border-radius:9px;background:var(--hc-line);margin:8px auto 0;flex:none}
.hdc-head{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:4px 16px;flex:none}
.hdc-head b{font-size:17px}
.hdc-x{width:48px;height:48px;border-radius:12px;border:2px solid var(--hc-line);background:var(--hc-chip);color:var(--hc-tx);font-size:18px;flex:none}
.hdc-body{display:flex;flex-direction:column;flex:1;min-height:0}
.hdc-left{padding:0 16px;flex:none}
.hdc-right{display:flex;flex-direction:column;flex:1;min-height:0;min-width:0}
.hdc-list{flex:1;overflow:auto;padding:4px 16px 8px;overscroll-behavior:contain}
.hdc-sec{font-size:14px;color:var(--hc-mut);font-weight:700;margin:10px 0 6px}
.hdc-chips{display:flex;gap:8px;flex-wrap:wrap}
.hdc-scroll{display:flex;gap:8px;overflow-x:auto;padding-bottom:6px;scrollbar-width:thin;
  -webkit-mask-image:linear-gradient(90deg,#000 85%,transparent);mask-image:linear-gradient(90deg,#000 85%,transparent)}
.hdc-chip{min-height:48px;padding:0 14px;border-radius:99px;border:2px solid var(--hc-line);background:var(--hc-chip);color:var(--hc-tx);
  display:inline-flex;align-items:center;gap:6px;font-size:15px;white-space:nowrap;flex:none}
.hdc-chip.on{background:var(--hc-accbg);border-color:var(--hc-acc);color:var(--hc-acc);font-weight:700}
.hdc-chip.learn{border-style:dashed}
.hdc-chip small{font-size:13px;color:var(--hc-mut)}
.hdc-search{width:100%;min-height:48px;border:2px solid var(--hc-line);border-radius:12px;padding:0 12px;background:var(--hc-bg);color:var(--hc-tx);font-size:16px;margin-top:10px}
.hdc-row{display:flex;gap:10px;align-items:center;width:100%;text-align:left;min-height:56px;padding:8px 10px;border:2px solid var(--hc-soft);border-radius:12px;margin:6px 0;
  background:var(--hc-bg);color:var(--hc-tx)}
.hdc-row.on{border-color:var(--hc-acc);background:var(--hc-accbg)}
.hdc-row[aria-disabled=true]{opacity:.55}
.hdc-row .ck{width:24px;height:24px;border-radius:6px;border:2px solid var(--hc-line);flex:none;display:flex;align-items:center;justify-content:center;font-weight:900}
.hdc-row.on .ck{background:var(--hc-acc);border-color:var(--hc-acc);color:var(--hc-bg)}
.hdc-row .t{flex:1;min-width:0}
.hdc-row .t b{display:block;font-size:15px}
.hdc-row .t .d{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;font-size:14px;color:var(--hc-mut)}
.hdc-row .n{text-align:right;font-variant-numeric:tabular-nums;font-size:14px;color:var(--hc-mut);flex:none}
.hdc-row .n b{color:var(--hc-tx)}
.hdc-row mark{background:#fde68a;color:#0f172a;border-radius:3px}
.hdc-empty{padding:16px 4px;color:var(--hc-mut);font-size:15px}
.hdc-skel{height:56px;border-radius:12px;margin:6px 0;background:linear-gradient(90deg,var(--hc-soft),var(--hc-chip),var(--hc-soft));background-size:200% 100%;animation:hdcSk 1.2s infinite}
@keyframes hdcSk{to{background-position:-200% 0}}
.hdc-tray{flex:none;border-top:1px solid var(--hc-soft);padding:8px 16px 0}
.hdc-tray .it{display:flex;align-items:center;gap:8px;min-height:48px}
.hdc-tray .it b{flex:none}
.hdc-sr{position:absolute!important;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
.hdc-tray .it span{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:14px;color:var(--hc-mut)}
.hdc-tray input{width:72px;min-height:44px;border:2px solid var(--hc-line);border-radius:10px;padding:0 8px;font-size:16px;background:var(--hc-bg);color:var(--hc-tx);text-align:center}
.hdc-tray .rm{width:44px;height:44px;border-radius:10px;border:2px solid var(--hc-line);background:var(--hc-chip);color:var(--hc-tx);flex:none}
.hdc-foot{flex:none;display:flex;gap:8px;padding:8px 16px calc(10px + env(safe-area-inset-bottom));border-top:1px solid var(--hc-soft)}
.hdc-btn{flex:1;min-height:52px;border-radius:12px;font-weight:700;font-size:15px;border:2px solid transparent}
.hdc-btn.pri{background:var(--hc-acc);color:var(--hc-bg)}
.hdc-btn.sec{background:var(--hc-chip);color:var(--hc-tx);border-color:var(--hc-line)}
.hdc-btn:disabled{opacity:.5}
.hdc-note{margin:8px 0;padding:10px 12px;border-radius:10px;background:var(--hc-warnbg);color:var(--hc-warn);font-size:14px;font-weight:600}
.hdc-more{display:block;width:100%;min-height:48px;margin:8px 0;border-radius:12px;border:2px dashed var(--hc-line);background:transparent;color:var(--hc-tx);font-weight:600}
.hdc-toast{position:fixed;left:12px;right:12px;bottom:calc(76px + env(safe-area-inset-bottom));z-index:1070;display:flex;align-items:center;gap:10px;
  padding:10px 12px;border-radius:12px;background:#0f172a;color:#fff;font-size:15px;box-shadow:0 8px 24px rgba(0,0,0,.3)}
.hdc-toast button{min-height:44px;padding:0 12px;border-radius:10px;border:2px solid #fff;background:transparent;color:#fff;font-weight:700;flex:none}
@media (orientation:landscape) and (max-height:520px){
  .hdc-panel{left:auto;width:min(860px,96vw);top:0;max-height:none;height:100dvh;border-radius:16px 0 0 16px}
  .hdc-body{flex-direction:row}
  .hdc-left{width:40%;flex:none;box-sizing:border-box;overflow:auto;border-right:1px solid var(--hc-soft);padding-bottom:12px}
  .hdc-left .hdc-scroll{flex-wrap:wrap;-webkit-mask-image:none;mask-image:none}
  .hdc-panel.searching .hdc-left .hdc-gsec{display:none}
}
@media (prefers-reduced-motion:reduce){.hdc-field.flash,.hdc-skel{animation:none}}
`;
function ensureCss() {
  if (document.getElementById('hdc-css')) return;
  const st = document.createElement('style');
  st.id = 'hdc-css';
  st.textContent = CSS;
  document.head.appendChild(st);
}
const fmt = (n) => (n === null || n === undefined || n === '') ? '—' : Number(n).toLocaleString('vi-VN', { maximumFractionDigits: 3 });
const tenGoi = (g) => String(g || '').replace(/^G/, 'Gói ');
/** Tô đậm phần khớp — escape từng đoạn trước khi ghép (không chèn HTML thô). */
function toDam(text, q) {
  const t = String(text ?? '');
  const f = fold(q);
  if (!f) return escapeHtml(t);
  const ft = fold(t);
  // fold giữ nguyên số ký tự với chữ Việt dựng sẵn (NFC) trừ khoảng trắng gộp — chỉ tô khi độ dài khớp
  if (ft.length !== t.length) return escapeHtml(t);
  const i = ft.indexOf(f);
  if (i < 0) return escapeHtml(t);
  return escapeHtml(t.slice(0, i)) + '<mark>' + escapeHtml(t.slice(i, i + f.length)) + '</mark>' + escapeHtml(t.slice(i + f.length));
}

/**
 * Gắn ô "Hạng mục HĐ" vào form. Trả controller:
 *   get()  → undefined (không chọn — giữ hành vi cũ) | { nam, goi, goiTay, ds:[{ma,heSo}] }
 *   getForUpdate() → undefined (không đổi) | null (bỏ chọn) | {…}
 *   set(hd, {orig}) — khôi phục (nháp / hàng chờ / sửa bản)
 *   daGui(res) — sau khi lưu thành công: ghi nhớ + báo nếu máy chủ không lưu
 */
export function initHdChon({ type, typeName = '', user, form, getPhuong, tenLoai = {}, anchorKeys = ['tdk', 'phuong'] }) {
  if (!user || user.role === 'demo' || !form) return null;
  ensureCss();
  const st = {
    info: null, err: '', loading: false, phuong: '', goi: null, goiTay: false, nam: new Date().getFullYear(),
    ds: [], orig: undefined, boChon: false, canChonLai: false, hmKhac: null, q: '', nhom: '', seq: 0
  };

  // ---- Ô trong form, đặt sau Tủ điều khiển (không có thì sau Phường) ----
  const wrap = document.createElement('div');
  wrap.className = 'field-wrap hdc hdc-wrap hidden';
  wrap.innerHTML = `<label class="block text-sm font-medium text-gray-700 mb-1" for="hdc-field">Hạng mục HĐ <span style="font-weight:400">(không bắt buộc)</span></label>
    <button type="button" id="hdc-field" class="hdc-field" aria-haspopup="dialog"></button>`;
  const anchor = anchorKeys.map((k) => form.querySelector('[data-key="' + k + '"]')).find(Boolean);
  const anchorWrap = anchor ? anchor.closest('.field-wrap') : null;
  if (anchorWrap && anchorWrap.parentNode === form) anchorWrap.after(wrap); else form.appendChild(wrap);
  const field = wrap.querySelector('#hdc-field');

  const sheet = document.createElement('div');
  sheet.className = 'hdc hdc-sheet hidden';
  sheet.setAttribute('role', 'dialog');
  sheet.setAttribute('aria-modal', 'true');
  sheet.setAttribute('aria-label', 'Chọn hạng mục hợp đồng');
  document.body.appendChild(sheet);
  const toast = document.createElement('div');
  toast.className = 'hdc hdc-toast hidden';
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');
  document.body.appendChild(toast);

  const hmTatCa = () => (st.info?.hm || []).concat(st.hmKhac || []);
  const timMa = (ma) => hmTatCa().find((h) => h.ma === ma);
  const goiPhuong = () => st.info?.goi?.goi;   // 'G1' | 'nhieu' | null
  const canChonGoi = () => !goiPhuong() || goiPhuong() === 'nhieu';

  // ---- Vẽ ô trong form ----
  let phatCu = '';
  function paintField() {
    const gp = goiPhuong();
    const det = { goi: st.ds.length ? st.goi : null, ds: st.ds.map((d) => ({ ...(timMa(d.ma) || {}), ...d })),
      // cho ô Trình Sở: gói dự kiến theo phường (hoặc gói đã chọn tay) — 'nhieu' / null = cần gán gói
      goiDuKien: st.goi || (gp && gp !== 'nhieu' ? gp : (gp === 'nhieu' ? 'nhieu' : null)), coHd: !!(st.info && st.info.has) };
    const k = JSON.stringify(det);
    if (k !== phatCu) { phatCu = k; document.dispatchEvent(new CustomEvent('hd-chon-change', { detail: det })); }
    const show = !!st.info?.chon && !!st.info?.has;
    wrap.classList.toggle('hidden', !show && !st.loading && !st.err);
    if (st.err && !st.info) {
      field.className = 'hdc-field warn';
      field.innerHTML = '<span class="go">Thử lại</span>Không tải được danh mục HĐ<span class="sub">Vẫn lưu được — app HĐ sẽ tự chọn mã</span>';
      return;
    }
    if (!st.info && st.loading) {
      field.className = 'hdc-field';
      field.innerHTML = 'Đang tải danh mục HĐ…<span class="sub">Có thể lưu ngay — app HĐ sẽ tự chọn mã</span>';
      return;
    }
    if (!st.ds.length) {
      field.className = 'hdc-field' + (st.canChonLai ? ' warn' : '');
      field.innerHTML = `<span class="go">Chọn ›</span>${st.canChonLai ? '<b>Cần chọn lại</b>' : 'Để app HĐ tự chọn'}
        <span class="sub">${st.canChonLai ? 'Phường vừa đổi — gói/mã cũ không còn hợp' : 'Chạm để chọn gói / mã hạng mục HĐ'}</span>`;
      field.setAttribute('aria-label', 'Hạng mục HĐ: ' + (st.canChonLai ? 'cần chọn lại' : 'để app HĐ tự chọn') + '. Chạm để chọn');
      return;
    }
    field.className = 'hdc-field on';
    const dong = st.ds.map((d) => {
      const h = timMa(d.ma);
      return `<b>${escapeHtml(d.ma)}</b>${d.heSo !== 1 ? ' ×' + escapeHtml(String(d.heSo)) : ''} · ${escapeHtml(h ? h.ten : '')}`;
    }).join('<br>');
    const h0 = timMa(st.ds[0].ma);
    field.innerHTML = `<span class="go">Đổi ›</span>${dong}
      <span class="sub">${escapeHtml(tenGoi(st.goi))}${st.goiTay ? ' (chọn tay)' : ''} · năm ${escapeHtml(String(st.nam))}${h0 ? ' · còn ' + escapeHtml(fmt(h0.conLai)) + ' ' + escapeHtml(h0.dvt) : ''}</span>`;
    field.setAttribute('aria-label', 'Hạng mục HĐ đã chọn: ' + st.ds.map((d) => d.ma).join(', ') + '. Chạm để đổi');
  }

  // ---- Tải dữ liệu ----
  async function load({ tatCa = false } = {}) {
    const p = String(getPhuong() || '').trim();
    st.phuong = p;
    if (!p) { st.info = null; st.loading = false; paintField(); return; }
    const my = ++st.seq;
    st.loading = true; st.err = '';
    paintField();
    try {
      const r = await apiHdInfo({ phuong: p, type, nam: st.nam, goi: st.goi || undefined, tatCa: tatCa || undefined });
      if (my !== st.seq) return;
      st.info = r;
      if (r && r.chon) {
        if (!canChonGoi()) { st.goi = goiPhuong(); st.goiTay = false; }
        else if (r.goiDung) st.goi = r.goiDung;
        if (tatCa) st.hmKhac = r.hmKhac || [];
      }
    } catch (e) {
      if (my !== st.seq) return;
      st.err = e.message || String(e);
    }
    st.loading = false;
    paintField();
    if (!sheet.classList.contains('hidden')) paintSheet();
  }

  // ---- Bảng chọn ----
  let truoc = null;   // lựa chọn trước khi mở bảng (Huỷ / Hoàn tác)
  const vv = window.visualViewport;
  const onVV = () => { if (vv) sheet.style.setProperty('--hdc-vvh', vv.height + 'px'); };
  function open() {
    if (st.err && !st.info) { load(); return; }
    if (!st.info?.chon) return;
    truoc = { goi: st.goi, goiTay: st.goiTay, nam: st.nam, ds: st.ds.map((d) => ({ ...d })) };
    st.q = ''; st.nhom = '';
    sheet.classList.remove('hidden');
    try { history.pushState({ hdc: 1 }, ''); } catch (e) { /* bỏ qua */ }
    if (vv) { vv.addEventListener('resize', onVV); onVV(); }
    paintSheet();
    const x = sheet.querySelector('.hdc-x');
    if (x) x.focus();
  }
  function close(fromPop) {
    if (sheet.classList.contains('hidden')) return;
    sheet.classList.add('hidden');
    if (vv) vv.removeEventListener('resize', onVV);
    if (!fromPop) { try { if (history.state && history.state.hdc) history.back(); } catch (e) { /* bỏ qua */ } }
    field.focus();
  }
  window.addEventListener('popstate', () => {   // nút Back = huỷ như ✕
    if (sheet.classList.contains('hidden')) return;
    if (truoc) Object.assign(st, { goi: truoc.goi, goiTay: truoc.goiTay, nam: truoc.nam, ds: truoc.ds });
    close(true); paintField();
  });

  function goiY() {
    const hoc = hocDoc(user.username);
    return hocGoiY(hoc, { type, phuong: st.phuong, goi: st.goi, nam: st.nam, hm: st.info?.hm || [] });
  }

  function paintSheet() {
    const info = st.info || {};
    const panel = sheet.querySelector('.hdc-panel');
    const keepFull = panel && panel.classList.contains('full');
    const gy = goiY();
    const goiList = canChonGoi() ? xepGoi(info.goiAll || [], info.phuongGoi || [], st.phuong)
      .filter((g) => goiPhuong() !== 'nhieu' || (info.goi?.goiList || []).includes(g.goi)) : [];
    const namList = info.namList || [];
    const hm = st.goi ? (info.hm || []) : [];
    const nhom = nhomHm(hm);
    if (!st.nhom || !nhom.some((n) => n.nhom === st.nhom)) st.nhom = nhom[0]?.nhom || '';
    const dangTim = !!fold(st.q);
    const ds = dangTim ? timHm(hmTatCa(), st.q) : (nhom.find((n) => n.nhom === st.nhom)?.hm || []);
    const chon = new Set(st.ds.map((d) => d.ma));

    const goiHtml = canChonGoi() ? `<div class="hdc-gsec"><div class="hdc-sec">Gói ${goiPhuong() === 'nhieu' ? '(phường thuộc nhiều gói — chọn 1)' : '(phường chưa có trong HĐ — chọn tay)'}</div>
      <div class="hdc-chips">${goiList.map((g) => `<button type="button" class="hdc-chip${st.goi === g.goi ? ' on' : ''}${gy.goi === g.goi && st.goi !== g.goi ? ' learn' : ''}" data-goi="${escapeHtml(g.goi)}" data-cung="${g.cungQuan ? 1 : 0}">
        ${escapeHtml(tenGoi(g.goi))}${g.maGoiThau ? ' <small>' + escapeHtml(g.maGoiThau) + '</small>' : ''}${gy.goi === g.goi ? ' 📚' : ''}${g.cungQuan ? '' : ' <small>khác quận</small>'}</button>`).join('') || '<span class="hdc-empty">Chưa có gói nào trong dữ liệu HĐ</span>'}</div></div>` : '';
    const namHtml = namList.length > 1 ? `<div class="hdc-gsec"><div class="hdc-sec">Năm KH</div><div class="hdc-chips">${namList.map((n) =>
      `<button type="button" class="hdc-chip${+n === +st.nam ? ' on' : ''}" data-nam="${escapeHtml(String(n))}">${escapeHtml(String(n))}</button>`).join('')}</div></div>` : '';
    const goiYHtml = gy.ds && gy.ds.some((d) => !chon.has(d.ma))
      ? `<div class="hdc-sec">Gợi ý theo lần trước</div><div class="hdc-chips"><button type="button" class="hdc-chip learn" data-hoc="1">📚 ${gy.ds.map((d) => escapeHtml(d.ma) + (d.heSo !== 1 ? '×' + escapeHtml(String(d.heSo)) : '')).join(' + ')}</button></div>` : '';
    const quenHtml = gy.goi || gy.ds ? '<button type="button" class="hdc-more" data-quen="1">Quên các lựa chọn đã nhớ trên máy này</button>' : '';
    const nhomHtml = st.goi && nhom.length ? `<div class="hdc-gsec"><div class="hdc-sec">Nhóm của ${escapeHtml(typeName || 'loại này')}</div>
      <div class="hdc-scroll" role="tablist">${nhom.map((n) => `<button type="button" role="tab" aria-selected="${!dangTim && n.nhom === st.nhom}" class="hdc-chip${!dangTim && n.nhom === st.nhom ? ' on' : ''}" data-nhom="${escapeHtml(n.nhom)}">${escapeHtml(n.nhom)} <small>${n.hm.length}</small></button>`).join('')}</div></div>` : '';

    let listHtml;
    if (!st.goi) listHtml = '<p class="hdc-empty">Chọn gói trước để xem mã hạng mục.</p>';
    else if (st.loading && !hm.length) listHtml = '<div class="hdc-skel"></div><div class="hdc-skel"></div><div class="hdc-skel"></div>';
    else if (!ds.length) listHtml = dangTim ? `<p class="hdc-empty">Không có mã khớp “${escapeHtml(st.q)}”.</p>` : '<p class="hdc-empty">Gói này chưa có mã của loại khảo sát này.</p>';
    else listHtml = ds.map((h) => {
      const on = chon.has(h.ma);
      const day = !on && st.ds.length >= MAX_MA;
      const het = h.conLai !== null && h.conLai !== undefined && h.conLai <= 0;
      return `<button type="button" class="hdc-row${on ? ' on' : ''}" data-ma="${escapeHtml(h.ma)}" aria-pressed="${on}" ${day ? 'aria-disabled="true"' : ''}>
        <span class="ck" aria-hidden="true">${on ? '✓' : ''}</span>
        <span class="t"><b>${toDam(h.ma, st.q)}${h.loai ? ' <span class="hdc-pill learn">' + escapeHtml(tenLoai[h.loai] || h.loai) + '</span>' : ''}${het ? ' <span class="hdc-pill bad">Hết KL</span>' : ''}</b><span class="d">${toDam(h.ten, st.q)}</span></span>
        <span class="n">HĐ ${escapeHtml(fmt(h.hd))}<br><b>còn ${escapeHtml(fmt(h.conLai))}</b> ${escapeHtml(h.dvt)}</span></button>`;
    }).join('');
    const moreHtml = st.goi && st.hmKhac === null ? '<button type="button" class="hdc-more" data-khac="1">Xem nhóm của loại khảo sát khác</button>' : '';

    const trayHtml = st.ds.length ? `<div class="hdc-tray" aria-label="Mã đã chọn">${st.ds.map((d) => {
      const h = timMa(d.ma);
      return `<div class="it"><b>${escapeHtml(d.ma)}</b><span>${escapeHtml(h ? h.ten : '')}</span>
        <label class="hdc-sr" for="hdc-hs-${escapeHtml(d.ma)}">Hệ số KL ${escapeHtml(d.ma)}</label>
        <input id="hdc-hs-${escapeHtml(d.ma)}" type="number" inputmode="decimal" min="0.001" max="100" step="any" value="${escapeHtml(String(d.heSo))}" data-hs="${escapeHtml(d.ma)}" title="Hệ số KL (mặc định 1)">
        <button type="button" class="rm" data-rm="${escapeHtml(d.ma)}" aria-label="Bỏ ${escapeHtml(d.ma)}">✕</button></div>`;
    }).join('')}</div>` : '';

    sheet.innerHTML = `<div class="hdc-scrim" data-close></div>
      <div class="hdc-panel${keepFull ? ' full' : ''}${dangTim ? ' searching' : ''}">
        <div class="hdc-grab" aria-hidden="true"></div>
        <div class="hdc-head"><b>Hạng mục HĐ${typeName ? ' — ' + escapeHtml(typeName) : ''}</b><button type="button" class="hdc-x" data-close aria-label="Đóng">✕</button></div>
        <div class="hdc-body">
          <div class="hdc-left">${goiHtml}${namHtml}
            <input class="hdc-search" type="search" enterkeyhint="search" placeholder="Tìm mã hoặc tên trong mọi nhóm…" aria-label="Tìm mã hoặc tên hạng mục" value="${escapeHtml(st.q)}">
            ${goiYHtml}${dangTim ? '' : nhomHtml}${quenHtml}
            ${st.canChonLai ? '<p class="hdc-note">Phường vừa đổi — chọn lại gói / mã.</p>' : ''}
          </div>
          <div class="hdc-right"><div class="hdc-list">${listHtml}${moreHtml}</div>${trayHtml}
            <div class="hdc-foot"><button type="button" class="hdc-btn sec" data-bo="1">Bỏ chọn, để app tự chọn</button>
              <button type="button" class="hdc-btn pri" data-xong="1" ${st.goi || !st.ds.length ? '' : 'disabled'}>Xong${st.ds.length ? ' (' + st.ds.length + ')' : ''}</button></div></div>
        </div></div>`;
  }

  function flashToast(msg, undo) {
    toast.innerHTML = '<span style="flex:1">' + escapeHtml(msg) + '</span>' + (undo ? '<button type="button" data-undo="1">Hoàn tác</button>' : '');
    toast.classList.remove('hidden');
    clearTimeout(flashToast.t);
    flashToast.t = setTimeout(() => toast.classList.add('hidden'), 5000);
  }
  toast.addEventListener('click', (e) => {
    if (!e.target.closest('[data-undo]') || !flashToast.undo) return;
    Object.assign(st, flashToast.undo); flashToast.undo = null;
    toast.classList.add('hidden');
    paintField();
  });

  function xong() {
    close();
    st.canChonLai = false;
    paintField();
    field.classList.remove('flash'); void field.offsetWidth; field.classList.add('flash');
    if (navigator.vibrate) try { navigator.vibrate(15); } catch (e) { /* bỏ qua */ }
    flashToast.undo = truoc ? { goi: truoc.goi, goiTay: truoc.goiTay, nam: truoc.nam, ds: truoc.ds } : null;
    flashToast(st.ds.length ? 'Đã chọn ' + st.ds.map((d) => d.ma).join(', ') + ' — sẽ lưu cùng bản ghi' : 'Để app HĐ tự chọn mã', true);
  }

  sheet.addEventListener('click', async (e) => {
    const t = e.target.closest('button,[data-close]');
    if (!t) return;
    if (t.hasAttribute('data-close')) {   // đóng = huỷ thay đổi trong bảng
      if (truoc) Object.assign(st, { goi: truoc.goi, goiTay: truoc.goiTay, nam: truoc.nam, ds: truoc.ds });
      close(); paintField(); return;
    }
    if (t.dataset.goi) {
      const g = t.dataset.goi;
      if (g === st.goi) return;
      if (t.dataset.cung === '0' && !confirm(tenGoi(g) + ' không có phường nào cùng quận cũ với phường này. Vẫn chọn?')) return;
      if (st.ds.length) flashToast('Đổi gói — đã bỏ các mã của ' + tenGoi(st.goi), false);
      st.goi = g; st.goiTay = true; st.ds = []; st.hmKhac = null; st.nhom = '';
      if (st.info) st.info = { ...st.info, hm: [] };
      st.loading = true; paintSheet(); await load(); return;
    }
    if (t.dataset.nam) {
      const n = +t.dataset.nam;
      if (n === st.nam) return;
      st.nam = n; st.ds = []; st.hmKhac = null;
      if (st.info) st.info = { ...st.info, hm: [] };
      st.loading = true; paintSheet(); await load(); return;
    }
    if (t.dataset.nhom) { st.nhom = t.dataset.nhom; paintSheet(); return; }
    if (t.dataset.hoc) {
      if (st.loading) return;
      for (const d of goiY().ds || []) if (st.ds.length < MAX_MA && !st.ds.some((x) => x.ma === d.ma)) st.ds.push({ ma: d.ma, heSo: d.heSo || 1 });
      paintSheet(); return;
    }
    if (t.dataset.khac) { st.hmKhac = []; paintSheet(); await load({ tatCa: true }); return; }
    if (t.dataset.ma) {
      const ma = t.dataset.ma;
      const i = st.ds.findIndex((d) => d.ma === ma);
      if (i >= 0) st.ds.splice(i, 1);
      else if (st.ds.length >= MAX_MA) { flashToast('Chọn tối đa ' + MAX_MA + ' mã / bản ghi', false); return; }
      else {
        if (st.loading) return;   // đang tải danh mục gói mới — không cho chọn mã của danh sách cũ
        const h = timMa(ma);
        if (h && h.conLai !== null && h.conLai !== undefined && h.conLai <= 0 && !confirm(ma + ' đã hết KL HĐ còn lại. Vẫn chọn?')) return;
        if (h && h.loai && !confirm(ma + ' thuộc nhóm của loại khảo sát khác. Vẫn chọn?')) return;
        st.ds.push({ ma, heSo: 1 }); st.boChon = false;
      }
      paintSheet(); return;
    }
    if (t.dataset.rm) { st.ds = st.ds.filter((d) => d.ma !== t.dataset.rm); paintSheet(); return; }
    if (t.dataset.bo) { st.ds = []; st.boChon = true; xong(); return; }
    if (t.dataset.quen) { hocXoa(user.username); flashToast('Đã quên các lựa chọn đã nhớ trên máy này', false); paintSheet(); return; }
    if (t.dataset.xong) xong();
  });
  sheet.addEventListener('input', (e) => {
    if (e.target.classList.contains('hdc-search')) {
      st.q = e.target.value;
      const pos = e.target.selectionStart;
      paintSheet();
      const s2 = sheet.querySelector('.hdc-search');
      if (s2) { s2.focus(); try { s2.setSelectionRange(pos, pos); } catch (x) { /* bỏ qua */ } }
    }
  });
  sheet.addEventListener('change', (e) => {
    const ma = e.target.dataset && e.target.dataset.hs;
    if (!ma) return;
    const v = Number(String(e.target.value).replace(',', '.'));
    const d = st.ds.find((x) => x.ma === ma);
    if (d) d.heSo = v > 0 && v <= 100 ? v : 1;
    if (!(v > 0 && v <= 100)) e.target.value = String(d ? d.heSo : 1);
  });
  sheet.addEventListener('focusin', (e) => {   // gõ tìm → bảng giãn toàn màn, ô tìm không bị bàn phím che
    if (e.target.classList.contains('hdc-search')) { const p = sheet.querySelector('.hdc-panel'); if (p) p.classList.add('full'); }
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !sheet.classList.contains('hidden')) { if (truoc) Object.assign(st, truoc); close(); paintField(); } });
  field.addEventListener('click', open);

  // Đổi phường: gói đã chọn không còn hợp → "Cần chọn lại" (không giữ âm thầm)
  let tmr = 0;
  document.addEventListener('phuong-change', () => {
    clearTimeout(tmr);
    tmr = setTimeout(async () => {
      const cu = { goi: st.goi, ds: st.ds.length };
      st.hmKhac = null;
      await load();   // gửi kèm gói đang chọn; phường đúng 1 gói → load() tự đặt gói đó
      if (!st.info?.chon) return;
      const hop = goiHopPhuong(cu.goi, st.info.goi);
      if (hop) {
        if (cu.goi && canChonGoi()) {   // phường mới chưa có / nhiều gói → gói giữ lại thành "chọn tay"
          st.goiTay = true;
          if (st.goi !== cu.goi) { st.goi = cu.goi; await load(); }
          paintField();
        }
      } else if (cu.ds) {
        // Gói cũ không còn hợp phường mới → bỏ mã, báo "Cần chọn lại" (không giữ âm thầm, không gửi gói rỗng)
        st.ds = []; st.goi = canChonGoi() ? null : goiPhuong(); st.goiTay = false; st.canChonLai = true; paintField();
      }
    }, 500);
  });

  load();

  return {
    get() {
      if (!st.ds.length || !st.goi) return undefined;
      return { nam: st.nam, goi: st.goi, goiTay: !!st.goiTay, ds: st.ds.map((d) => ({ ma: d.ma, heSo: d.heSo })) };
    },
    getForUpdate() {
      const now = this.get();
      if (cungLuaChon(now, st.orig)) return undefined;
      if (now === undefined) return st.boChon ? null : undefined;   // chỉ xoá khi người dùng tự bấm "Bỏ chọn"
      return now;
    },
    set(hd, { orig = false } = {}) {
      const c = chonSach(hd);
      if (orig) st.orig = c ? { nam: c.nam, goi: c.goi, goiTay: !!hd.goiTay, ds: c.ds } : null;
      if (!c) { paintField(); return; }
      st.goi = c.goi; st.nam = c.nam; st.ds = c.ds; st.goiTay = !!hd.goiTay;
      load();
    },
    daGui(res, hdDaGui) {
      if (!hdDaGui) return;
      if (res && res.hd_saved) {
        const hoc = hocNho(hocDoc(user.username), { type, phuong: st.phuong, hd: hdDaGui, goiTay: hdDaGui.goiTay });
        hocGhi(user.username, hoc);
      } else {
        return (res && res.hd_warning) ? 'Hạng mục HĐ chưa lưu: ' + res.hd_warning : 'Máy chủ chưa hỗ trợ lưu hạng mục HĐ — app HĐ sẽ tự chọn mã';
      }
      return '';
    },
    canChonLai: () => st.canChonLai && !st.ds.length,
    boChon() { st.boChon = true; st.canChonLai = false; paintField(); },
    quen() { hocXoa(user.username); },
    reload: () => load()
  };
}
