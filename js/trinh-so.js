// js/trinh-so.js — Ô "Trình Sở / Không trình Sở" trong form khảo sát (anh chốt 11/11/2026).
// Tiêu chí + chốt UI (phương án A): repo quanly-hopdong-duytu, docs/05_TrinhSo-KLTrungTam.md (K1, Nhật ký duyệt).
// - Bắt buộc chọn, KHÔNG chọn sẵn. Vỏ tủ luôn "Không trình Sở" (không hiện ô).
// - Dưới ô: dòng "→ bản sẽ vào đâu" (aria-live), đổi theo lựa chọn + gói theo phường.
// - Tăng cường KC xa ghi đèn HPS mà chọn Trình Sở → chặn ngay (role=alert) + nút chuyển sang Không trình Sở.
// - Loại thường thuộc thẩm quyền Trung tâm (sự cố, băng rôn, decal…) chọn Trình Sở → nhắc nhẹ, không chặn.
import { escapeHtml } from './utils.js';

export const GIA_TRI = ['Trình Sở', 'Không trình Sở'];
export const LUON_TT = ['vo_tu'];
/** Phụ lục trình Sở theo loại khảo sát (mục 2 doc 05). Loại khác → khuôn chung theo tên loại. */
export const PHU_LUC = {
  ngam_hoa: 'Hạ ngầm', thay_sua_tu: 'Thay sửa tủ điều khiển', thay_den: 'Thay HPS → LED', thay_tru: 'Thay trụ',
  tang_cuong_den: 'Tăng cường HTCS bằng LED', tc_den_kc_xa: 'Tăng cường HTCS bằng LED', tc_ngam: 'Thay cáp nguồn ngầm'
};
export const NHAC_TT = ['bao_cao_su_co', 'thao_go_bang_ron', 'decal_so_tru', 'nap_tru', 'hkn', 'choa_den'];

const fold = (x) => String(x ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase();
/** Đồng bộ laDenHps_ trong Code.gs. */
export function laDenHps(s) {
  const t = fold(s);
  return /\bhps\b|sodium|natri|cao ap|\bson\b/.test(t) && !/\bled\b/.test(t);
}
const tenGoi = (g) => String(g).replace(/^G/, 'Gói ');

/** Dòng "→ …" cho lựa chọn hiện tại. goi: 'G1' | 'nhieu' | null; coHd: đã có dữ liệu HĐ. */
export function dichDen(type, tenLoai, val, goi, coHd = true) {
  if (!val) return 'Chọn để biết bản vào phụ lục nào';
  const g = !coHd ? '' : goi && goi !== 'nhieu' ? ' · ' + tenGoi(goi) + ' (theo phường)' : ' · Cần gán gói';
  if (val === GIA_TRI[1]) return '→ KL Trung tâm (thẩm quyền TT) · ' + tenLoai + ', không vào phụ lục trình Sở' + g;
  return '→ Phụ lục ' + (PHU_LUC[type] || tenLoai) + g;
}
/** Kiểm trước khi lưu: '' = được; chuỗi = lý do chặn. */
export function lyDoChan(type, val, chungLoaiDen) {
  if (LUON_TT.includes(type)) return '';
  if (!GIA_TRI.includes(val)) return 'Chưa chọn Trình Sở / Không trình Sở';
  if (val === GIA_TRI[0] && type === 'tc_den_kc_xa' && laDenHps(chungLoaiDen)) {
    return 'Đèn HPS không trình Sở cho Tăng cường KC xa — chọn Không trình Sở hoặc sửa chủng loại đèn';
  }
  return '';
}

const CSS = `
.ts{--ts-tx:#0f172a;--ts-mut:#334155;--ts-line:#64748b;--ts-bg:#fff;--ts-acc:#1d4ed8;--ts-tt:#047857;--ts-bad:#b91c1c;--ts-badbg:#fef2f2;--ts-info:#78350f;--ts-infobg:#fffbeb}
@media (prefers-color-scheme:dark){.ts{--ts-tx:#e2e8f0;--ts-mut:#cbd5e1;--ts-line:#94a3b8;--ts-bg:#111a2e;--ts-acc:#2563eb;--ts-tt:#047857;--ts-bad:#fca5a5;--ts-badbg:#450a0a;--ts-info:#fde68a;--ts-infobg:#422006}}
.ts{scroll-margin-top:72px;scroll-margin-bottom:120px}
.ts-lbl{display:block;font-size:14px;font-weight:600;margin-bottom:6px;color:var(--ts-tx)}
.ts-lbl .req{color:#dc2626}
.ts-grp{display:flex;gap:8px;max-width:480px;border-radius:14px;padding:2px}
.ts-grp.loi{outline:2px solid var(--ts-bad);outline-offset:3px}
.ts-btn{flex:1;min-height:52px;padding:0 10px;border-radius:12px;border:2px solid var(--ts-line);background:var(--ts-bg);color:var(--ts-tx);
  font-size:15px;font-weight:600;white-space:nowrap;cursor:pointer;transition:background .15s,border-color .15s}
.ts-btn:focus-visible{outline:3px solid var(--ts-acc);outline-offset:2px}
.ts-btn[aria-checked=true]{border-width:3px;color:#fff;font-weight:800}
.ts-btn[data-v="0"][aria-checked=true]{background:var(--ts-acc);border-color:#1e3a8a}
.ts-btn[data-v="1"][aria-checked=true]{background:var(--ts-tt);border-color:#064e3b}
.ts-den{font-size:14px;color:var(--ts-mut);margin-top:6px}
.ts-err{display:none;margin-top:6px;font-size:14px;font-weight:700;color:var(--ts-bad)}
.ts-grp.loi ~ .ts-err{display:block}
.ts-chan{margin-top:8px;padding:10px 12px;border-radius:10px;background:var(--ts-badbg);color:var(--ts-bad);font-size:14px;font-weight:600;border:2px solid var(--ts-bad)}
.ts-chan button{display:block;margin-top:8px;min-height:44px;padding:0 12px;border-radius:10px;border:2px solid currentColor;background:transparent;color:inherit;font-weight:800}
.ts-nhac{margin-top:8px;padding:8px 12px;border-radius:10px;background:var(--ts-infobg);color:var(--ts-info);font-size:14px}
@media (prefers-reduced-motion:reduce){.ts-btn{transition:none}}
`;

/**
 * Gắn ô vào form ngay sau Tủ điều khiển (không có thì sau Phường).
 * Trả { get(), set(v), kiem() → bool (báo lỗi + cuộn tới), reset() } hoặc null nếu không có form.
 */
export function initTrinhSo({ type, tenLoai = '', form, anchorKeys = ['tdk', 'phuong'], readOnly = false }) {
  if (!form) return null;
  if (LUON_TT.includes(type)) return { get: () => GIA_TRI[1], set() {}, kiem: () => true, reset() {}, coDinh: true };
  if (!document.getElementById('ts-css')) {
    const st = document.createElement('style'); st.id = 'ts-css'; st.textContent = CSS; document.head.appendChild(st);
  }
  let val = '', goi = null, coHd = false, cu = false;
  const wrap = document.createElement('div');
  wrap.className = 'field-wrap ts';
  wrap.innerHTML = `<span class="ts-lbl" id="ts-lbl">Trình Sở <span class="req">*</span></span>
    <div class="ts-grp" role="radiogroup" aria-labelledby="ts-lbl" aria-required="true" aria-describedby="ts-den ts-err">
      <button type="button" class="ts-btn" role="radio" data-v="0" aria-checked="false" tabindex="0">Trình Sở</button>
      <button type="button" class="ts-btn" role="radio" data-v="1" aria-checked="false" tabindex="-1">Không trình Sở</button>
    </div>
    <div class="ts-err" id="ts-err">⚠ Chưa chọn Trình Sở / Không trình Sở</div>
    <div class="ts-den" id="ts-den" aria-live="polite"></div>
    <div class="ts-x" role="alert"></div>`;
  const anchor = anchorKeys.map((k) => form.querySelector('[data-key="' + k + '"]')).find(Boolean);
  const aw = anchor ? anchor.closest('.field-wrap') : null;
  if (aw && aw.parentNode) aw.after(wrap); else form.appendChild(wrap);
  const grp = wrap.querySelector('.ts-grp');
  const btns = [...wrap.querySelectorAll('.ts-btn')];
  const den = wrap.querySelector('.ts-den');
  const x = wrap.querySelector('.ts-x');
  const chungLoai = () => (form.querySelector('[data-key="chung_loai_den"]') || {}).value || '';

  function paint() {
    btns.forEach((b, i) => {
      const on = val === GIA_TRI[i];
      b.setAttribute('aria-checked', String(on));
      b.textContent = (on ? '✓ ' : '') + GIA_TRI[i];
      b.tabIndex = on || (!val && i === 0) ? 0 : -1;
      b.disabled = readOnly;
    });
    den.textContent = cu && !val ? 'Bản cũ — chưa phân loại. Chọn 1 trong 2.' : dichDen(type, tenLoai, val, goi, coHd);
    const chan = val === GIA_TRI[0] ? lyDoChan(type, val, chungLoai()) : '';
    if (chan) {
      x.innerHTML = '<div class="ts-chan">⛔ ' + escapeHtml(chan) + '<button type="button" data-tt="1">Chuyển sang Không trình Sở</button></div>';
    } else if (val === GIA_TRI[0] && NHAC_TT.includes(type)) {
      x.innerHTML = '<div class="ts-nhac" role="note">ⓘ Hạng mục này thường thuộc thẩm quyền Trung tâm — kiểm tra lại trước khi trình Sở.</div>';
    } else x.innerHTML = '';
  }
  function chon(v, rung = true) {
    val = v; grp.classList.remove('loi'); grp.removeAttribute('aria-invalid');
    paint();
    if (rung && navigator.vibrate) try { navigator.vibrate(lyDoChan(type, val, chungLoai()) ? [30, 60, 30] : 15); } catch (e) { /* bỏ qua */ }
    form.dispatchEvent(new Event('input', { bubbles: true }));   // tự lưu nháp
  }
  grp.addEventListener('click', (e) => { const b = e.target.closest('.ts-btn'); if (b && !readOnly) chon(GIA_TRI[+b.dataset.v]); });
  grp.addEventListener('keydown', (e) => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key) || readOnly) return;
    e.preventDefault();
    const i = val === GIA_TRI[0] ? 1 : 0;
    chon(GIA_TRI[i]); btns[i].focus();
  });
  x.addEventListener('click', (e) => { if (e.target.closest('[data-tt]')) { chon(GIA_TRI[1]); btns[1].focus(); } });
  form.addEventListener('input', (e) => { if (e.target && e.target.dataset && e.target.dataset.key === 'chung_loai_den') paint(); });
  document.addEventListener('hd-chon-change', (e) => { const d = e.detail || {}; goi = d.goiDuKien ?? d.goi ?? null; coHd = !!d.coHd; paint(); });
  paint();

  return {
    get: () => val,
    set(v, { cuChuaPhanLoai = false } = {}) { const t = String(v ?? '').normalize('NFC').trim(); val = GIA_TRI.includes(t) ? t : ''; cu = cuChuaPhanLoai && !val; paint(); },
    reset() { val = ''; cu = false; grp.classList.remove('loi'); paint(); },
    /** Trước khi lưu: chưa chọn / bị chặn → báo, cuộn tới, trả false. */
    kiem() {
      const ly = lyDoChan(type, val, chungLoai());
      if (!ly) return true;
      if (!val) { grp.classList.add('loi'); grp.setAttribute('aria-invalid', 'true'); }
      paint();
      wrap.scrollIntoView({ behavior: 'smooth', block: 'center' });
      (btns[val === GIA_TRI[0] ? 1 : 0]).focus({ preventScroll: true });
      if (navigator.vibrate) try { navigator.vibrate([30, 60, 30]); } catch (e) { /* bỏ qua */ }
      return false;
    }
  };
}

/** Kênh của 1 bản ghi (đọc từ dòng sheet): 'TS' | 'TT' | '' (chưa phân loại). Vỏ tủ luôn TT. */
export function kenhCua(row, type) {
  if (LUON_TT.includes(type)) return 'TT';
  const v = String((row || {})['Trình Sở'] ?? '').normalize('NFC').trim();
  return v === GIA_TRI[0] ? 'TS' : v === GIA_TRI[1] ? 'TT' : '';
}
/** Nhãn danh sách (màu thống nhất với ô chọn: TS xanh dương, TT xanh lục). */
export function nhanKenh(k) {
  if (k === 'TS') return '<span style="display:inline-block;padding:1px 8px;border-radius:99px;background:#dbeafe;color:#1e3a8a;font-weight:700">Trình Sở</span>';
  if (k === 'TT') return '<span style="display:inline-block;padding:1px 8px;border-radius:99px;background:#d1fae5;color:#064e3b;font-weight:700">KL TT</span>';
  return '<span style="display:inline-block;padding:1px 8px;border-radius:99px;background:#f1f5f9;color:#334155">Chưa phân loại</span>';
}
