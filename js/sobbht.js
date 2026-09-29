// js/sobbht.js — Sổ biên bản hiện trường (sheet `sobbht`). Quyền: report (admin/user).
// Số BBHT do người lập tự ghi; app không cấp số (user chốt 2026-09-27).

import { apiSobbhtList, apiSobbhtSave, apiSobbhtDelete } from './api.js';
import { PHUONG_XA } from './dia-ban.js';
import { showToast, escapeHtml } from './utils.js';
import { newWorkbook, addReportSheet, downloadWorkbook, periodLine } from './excel-export.js';
import { loadXLSX } from './lazy-lib.js';

const FIELDS = ['Số BBHT', 'Ngày', 'Thời gian', 'Phường', 'Quận', 'Người làm', 'Giám sát', 'Ghi chú', 'Số điểm KS', 'Mã bản ghi'];
/** Trang "Biên bản hiện trường" gửi dữ liệu điền sẵn qua đây khi bấm "Lưu vào sổ". */
export const PREFILL_KEY = 'sobbht_prefill';

const state = { items: [], importItems: [] };

const $ = id => document.getElementById(id);

export function initSobbht() {
  $('btn-load').onclick = load;
  $('f-search').addEventListener('input', render);
  $('btn-add').onclick = () => openForm({ 'Ngày': new Date().toISOString().slice(0, 10) });
  $('btn-cancel').onclick = closeForm;
  $('form').onsubmit = saveForm;
  $('btn-xlsx').onclick = exportXlsx;
  $('f-import').onchange = previewImport;
  $('btn-import-run').onclick = runImport;
  $('btn-import-cancel').onclick = () => { $('import-box').classList.add('hidden'); $('f-import').value = ''; };
  $('form').elements['Phường'].addEventListener('blur', autoQuan);

  load();
  // Dùng 1 lần, chỉ nhận nếu vừa bấm "Lưu vào sổ" trong 10 phút gần đây
  try {
    const pre = JSON.parse(localStorage.getItem(PREFILL_KEY) || 'null');
    localStorage.removeItem(PREFILL_KEY);
    if (pre && pre.data && Date.now() - pre.at < 10 * 60000) openForm(pre.data);
  } catch (e) { /* storage bị chặn → bỏ qua */ }
}

async function load() {
  $('loading').classList.remove('hidden');
  try {
    const res = await apiSobbhtList($('f-from').value || '', $('f-to').value || '');
    state.items = res.items || [];
    render();
  } catch (e) {
    showToast('Lỗi tải sổ: ' + e.message, 'error', 5000);
  } finally {
    $('loading').classList.add('hidden');
  }
}

function fold(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
}

function visibleItems() {
  const q = fold($('f-search').value.trim());
  if (!q) return state.items;
  return state.items.filter(it => fold(['Số BBHT', 'Phường', 'Quận', 'Người làm', 'Giám sát', 'Ghi chú', 'Mã bản ghi']
    .map(k => it[k]).join(' ')).includes(q));
}

function vnDate(iso) {
  const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : String(iso || '');
}

function render() {
  const list = visibleItems();
  $('count').textContent = `${list.length} biên bản`;
  const tb = $('tbody');
  tb.innerHTML = '';
  for (const it of list) {
    const tr = document.createElement('tr');
    tr.className = 'border-b hover:bg-blue-50';
    tr.innerHTML = [
      `<td class="px-2 py-2 font-mono text-xs whitespace-nowrap">${escapeHtml(it['Số BBHT'] || '—')}</td>`,
      `<td class="px-2 py-2 text-xs whitespace-nowrap">${escapeHtml(vnDate(it['Ngày']))}</td>`,
      `<td class="px-2 py-2 text-xs">${escapeHtml(it['Thời gian'] || '')}</td>`,
      `<td class="px-2 py-2 text-xs">${escapeHtml(it['Phường'] || '')}</td>`,
      `<td class="px-2 py-2 text-xs">${escapeHtml(it['Quận'] || '')}</td>`,
      `<td class="px-2 py-2 text-xs">${escapeHtml(it['Người làm'] || '')}</td>`,
      `<td class="px-2 py-2 text-xs">${escapeHtml(it['Giám sát'] || '')}</td>`,
      `<td class="px-2 py-2 text-xs text-right">${escapeHtml(String(it['Số điểm KS'] ?? ''))}</td>`,
      `<td class="px-2 py-2 text-xs max-w-[200px] truncate" title="${escapeHtml(it['Ghi chú'] || '')}">${escapeHtml(it['Ghi chú'] || '')}</td>`,
      `<td class="px-2 py-2 text-right whitespace-nowrap">
         <button class="btn-edit text-xs px-2 py-1 bg-yellow-50 text-yellow-700 rounded mr-1">Sửa</button>
         <button class="btn-del text-xs px-2 py-1 bg-red-50 text-red-700 rounded">Xoá</button></td>`
    ].join('');
    tr.querySelector('.btn-edit').onclick = () => openForm(it);
    tr.querySelector('.btn-del').onclick = () => doDelete(it);
    tb.appendChild(tr);
  }
}

function openForm(it) {
  const f = $('form');
  f.elements['id'].value = it.id || '';
  for (const k of FIELDS) if (f.elements[k]) f.elements[k].value = it[k] ?? '';
  $('form-title').textContent = it.id ? `Sửa biên bản ${it['Số BBHT'] || ''}` : 'Thêm biên bản vào sổ';
  $('modal').classList.remove('hidden');
  if (!it['Quận']) autoQuan();
}

function closeForm() { $('modal').classList.add('hidden'); }

/** Quận cũ tự điền theo (các) phường đã gõ — chỉ khi ô Quận đang trống. */
function autoQuan() {
  const f = $('form');
  if (f.elements['Quận'].value.trim()) return;
  const names = f.elements['Phường'].value.split(/[,;]/).map(s => fold(s.replace(/^\s*(phường|xã)\s+/i, '').trim())).filter(Boolean);
  const quans = [...new Set(names.map(n => (PHUONG_XA.find(p => fold(p.ten) === n) || {}).quan_cu).filter(Boolean))];
  if (quans.length) f.elements['Quận'].value = quans.join(', ');
}

async function saveForm(e) {
  e.preventDefault();
  const f = $('form');
  const item = { id: f.elements['id'].value || undefined };
  for (const k of FIELDS) item[k] = f.elements[k].value.trim();
  if (!item['Ngày']) { showToast('Thiếu ngày', 'error'); return; }
  const btn = f.querySelector('button[type=submit]');
  btn.disabled = true;
  try {
    await apiSobbhtSave([item]);
    showToast(item.id ? 'Đã sửa biên bản' : 'Đã thêm vào sổ', 'success');
    closeForm();
    await load();
  } catch (err) {
    showToast('Lỗi lưu: ' + err.message, 'error', 5000);
  } finally {
    btn.disabled = false;
  }
}

async function doDelete(it) {
  if (!confirm(`Xoá biên bản ${it['Số BBHT'] || ''} ngày ${vnDate(it['Ngày'])} khỏi sổ?\n(Nội dung dòng được ghi lại trong sheet Audit)`)) return;
  try {
    await apiSobbhtDelete(it.id);
    showToast('Đã xoá', 'success');
    await load();
  } catch (e) {
    showToast('Lỗi xoá: ' + e.message, 'error', 5000);
  }
}

async function exportXlsx() {
  const list = visibleItems();
  if (!list.length) { showToast('Sổ trống — không có gì để xuất', 'warning'); return; }
  const btn = $('btn-xlsx');
  btn.disabled = true;
  try {
    const wb = await newWorkbook();
    const cols = ['Số BBHT', 'Ngày', 'Thời gian', 'Phường', 'Quận', 'Người làm', 'Giám sát', 'Số điểm KS', 'Ghi chú'];
    const rows = [...list].reverse().map((it, i) => [i + 1, ...cols.map(k =>
      k === 'Ngày' ? vnDate(it[k]) : k === 'Số điểm KS' && it[k] !== '' && !isNaN(Number(it[k])) ? Number(it[k]) : (it[k] ?? ''))]);
    const total = ['TỔNG CỘNG', `${rows.length} biên bản`, '', '', '', '', '', '',
      rows.reduce((s, r) => s + (typeof r[8] === 'number' ? r[8] : 0), 0), ''];
    addReportSheet(wb, 'Sổ BBHT', {
      title: 'SỔ THEO DÕI BIÊN BẢN HIỆN TRƯỜNG',
      subtitle: periodLine($('f-from').value, $('f-to').value),
      headers: ['TT', ...cols], rows, total, freezeCols: 2
    });
    await downloadWorkbook(wb, `so-bbht-${$('f-from').value || 'all'}_${$('f-to').value || 'all'}.xlsx`);
  } catch (e) {
    showToast('Lỗi xuất Excel: ' + e.message, 'error');
  } finally {
    btn.disabled = false;
  }
}

// =====================================================================
// NHẬP SỔ EXCEL CŨ (sheet "16. BBHT Ký App")
// =====================================================================

const QUAN_TAT = { PN: 'Quận Phú Nhuận', BT: 'Quận Bình Thạnh', TB: 'Quận Tân Bình', GV: 'Quận Gò Vấp', TP: 'Quận Tân Phú' };

function quanDayDu(q) {
  const s = String(q ?? '').trim();
  if (!s) return '';
  return s.split(/\s*-\s*/).map(x => /^\d+$/.test(x) ? 'Quận ' + x : (QUAN_TAT[x.toUpperCase()] || x)).join(', ');
}

/** Ngày dạng ô số Excel (serial) → [năm, tháng, ngày] theo UTC để không lệch múi giờ. */
function serialParts(n) {
  const d = new Date(Math.round((n - 25569) * 86400000));
  return [d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()];
}

/**
 * Chuẩn hoá ngày sổ cũ. Ô Excel kiểu ngày trong sổ này bị Excel đọc NGƯỢC tháng/ngày
 * (gõ "10/07/2025" → lưu thành 07/10/2025). Đối chiếu tháng trong Số BBHT ("01/07/Q5" = tháng 7)
 * để chọn cách đọc đúng; không có số thì mặc định đảo lại. Ô chữ "16/7/2025" đọc bình thường.
 */
function ngayChuan(v, soBbht) {
  const pad = x => String(x).padStart(2, '0');
  const mBb = String(soBbht || '').match(/^\s*\d+\s*\/\s*(\d{1,2})/);
  const thangBb = mBb ? Number(mBb[1]) : null;
  if (typeof v === 'number') {
    const [y, m, d] = serialParts(v);
    const swapOk = d <= 12;
    let yy = y, mm = m, dd = d, fixed = false;
    if (thangBb ? (m !== thangBb && d === thangBb && swapOk) : swapOk) { mm = d; dd = m; fixed = true; }
    return { iso: `${yy}-${pad(mm)}-${pad(dd)}`, fixed };
  }
  const s = String(v ?? '').trim();
  let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return { iso: `${m[3]}-${pad(m[2])}-${pad(m[1])}`, fixed: false };
  m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return { iso: `${m[1]}-${pad(m[2])}-${pad(m[3])}`, fixed: false };
  return { iso: '', fixed: false };
}

async function previewImport(e) {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const XLSX = await loadXLSX();
    const wb = XLSX.read(new Uint8Array(await file.arrayBuffer()), { type: 'array' });
    const name = wb.SheetNames.find(n => /BBHT/i.test(n));
    if (!name) { showToast('Không thấy sheet sổ BBHT (tên có chữ "BBHT") trong file', 'error', 5000); return; }
    const aoa = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: '', raw: true });
    // Bảng phụ bên phải (cột I..L): Quận → Giám sát
    const gs = {};
    aoa.slice(1).forEach(r => { if (r[8] !== '' && r[11]) gs[String(r[8]).trim().toUpperCase()] = String(r[11]).trim(); });
    const existing = new Set(state.items.map(it => fold(it['Số BBHT']) + '|' + it['Ngày']));

    const items = [];
    let fixedCount = 0, dupCount = 0, noDate = 0;
    aoa.slice(1).forEach(r => {
      const vals = r.slice(0, 8);
      if (!vals.some(v => v !== '' && v !== null)) return;
      const so = String(r[1] ?? '').trim();
      const nd = ngayChuan(r[2], so);
      const quanRaw = String(r[5] ?? '').trim();
      const it = {
        'Số BBHT': so, 'Ngày': nd.iso, 'Thời gian': String(r[3] ?? '').trim(), 'Phường': String(r[4] ?? '').trim(),
        'Quận': quanDayDu(quanRaw), 'Người làm': String(r[6] ?? '').trim(),
        'Giám sát': gs[quanRaw.split('-')[0].trim().toUpperCase()] || '', 'Ghi chú': String(r[7] ?? '').trim(),
        nguon: 'excel-cu', _fixed: nd.fixed,
        _dup: existing.has(fold(so) + '|' + nd.iso)
      };
      if (nd.fixed) fixedCount++;
      if (it._dup) dupCount++;
      if (!nd.iso) noDate++;
      items.push(it);
    });
    state.importItems = items.filter(it => !it._dup && it['Ngày']);

    $('import-summary').innerHTML =
      `Sheet <strong>${escapeHtml(name)}</strong>: ${items.length} dòng · ` +
      `<span class="text-orange-700">${fixedCount} dòng đã sửa ngày bị Excel đảo tháng/ngày (tô vàng)</span> · ` +
      `${dupCount} dòng đã có trong sổ (bỏ qua) · ${noDate} dòng không đọc được ngày (bỏ qua) → ` +
      `<strong>sẽ nhập ${state.importItems.length} dòng</strong>. Kiểm tra rồi bấm "Nhập vào sổ".`;
    $('import-table').innerHTML = '<thead class="bg-gray-100 sticky top-0"><tr>' +
      ['Số BBHT', 'Ngày', 'Thời gian', 'Phường', 'Quận', 'Người làm', 'Giám sát', 'Ghi chú', ''].map(h => `<th class="px-2 py-1 text-left">${h}</th>`).join('') +
      '</tr></thead><tbody>' + items.map(it => `<tr class="border-t ${it._dup || !it['Ngày'] ? 'text-gray-400 line-through' : ''}">` +
        `<td class="px-2 py-1">${escapeHtml(it['Số BBHT'])}</td>` +
        `<td class="px-2 py-1 ${it._fixed ? 'bg-yellow-200 font-semibold' : ''}">${escapeHtml(vnDate(it['Ngày']) || '?')}</td>` +
        ['Thời gian', 'Phường', 'Quận', 'Người làm', 'Giám sát', 'Ghi chú'].map(k => `<td class="px-2 py-1">${escapeHtml(it[k])}</td>`).join('') +
        `<td class="px-2 py-1">${it._dup ? 'đã có' : !it['Ngày'] ? 'thiếu ngày' : ''}</td></tr>`).join('') + '</tbody>';
    $('import-box').classList.remove('hidden');
    $('import-box').scrollIntoView({ behavior: 'smooth' });
  } catch (err) {
    showToast('Không đọc được file: ' + err.message, 'error', 5000);
  }
}

async function runImport() {
  const items = state.importItems.map(({ _fixed, _dup, ...it }) => it);
  if (!items.length) { showToast('Không còn dòng nào để nhập', 'warning'); return; }
  if (!confirm(`Nhập ${items.length} dòng sổ cũ vào sheet "sobbht"?`)) return;
  const btn = $('btn-import-run');
  btn.disabled = true;
  try {
    for (let i = 0; i < items.length; i += 50) {
      btn.textContent = `⏳ Đang nhập ${Math.min(i + 50, items.length)}/${items.length}...`;
      await apiSobbhtSave(items.slice(i, i + 50));
    }
    showToast(`Đã nhập ${items.length} dòng sổ cũ`, 'success', 4000);
    $('import-box').classList.add('hidden');
    $('f-import').value = '';
    await load();
  } catch (e) {
    showToast('Lỗi nhập: ' + e.message + ' — các lô trước đó đã vào sổ, chạy lại sẽ tự bỏ qua dòng đã có', 'error', 8000);
    await load();
  } finally {
    btn.disabled = false;
    btn.textContent = '✅ Nhập vào sổ';
  }
}
