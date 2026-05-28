// js/report.js — Trang báo cáo: vùng A-D aggregate + Vùng E xuất dữ liệu thô.

import { apiReport, apiUsers, apiList, apiExportRaw } from './api.js';
import { SCHEMAS, SCHEMA_KEYS } from './schemas.js';
import { showToast, escapeHtml, formatVnDateOnly } from './utils.js';

const state = {
  data: null  // { areaA, areaB, areaC }
};

const TYPE_COLORS = [
  '#1d4ed8', '#dc2626', '#16a34a', '#ea580c', '#9333ea',
  '#0891b2', '#ca8a04', '#65a30d', '#be185d', '#0d9488',
  '#7c3aed', '#b45309', '#059669', '#c026d3', '#4f46e5'
];

export async function initReport() {
  buildTypeFilter();
  await buildUserFilter();
  bindEvents();
  applyPreset('this-month');
  await loadReport();
}

function buildTypeFilter() {
  const sel = document.getElementById('filter-types');
  for (const k of SCHEMA_KEYS) {
    const opt = document.createElement('option');
    opt.value = k;
    opt.textContent = SCHEMAS[k].icon + ' ' + SCHEMAS[k].name;
    opt.selected = true;
    sel.appendChild(opt);
  }
}

async function buildUserFilter() {
  const sel = document.getElementById('filter-usernames');
  if (!sel) return;
  try {
    const res = await apiUsers();
    const users = (res.users || []).filter(u => u.role !== 'demo');
    for (const u of users) {
      const opt = document.createElement('option');
      opt.value = u.username;
      opt.textContent = u.full_name + ' (@' + u.username + ')';
      sel.appendChild(opt);
    }
  } catch (e) {
    // Im lặng, để dropdown rỗng = "tất cả KTV"
  }
}

function bindEvents() {
  document.getElementById('btn-load').onclick = loadReport;
  document.getElementById('btn-export').onclick = exportCsv;
  const bx = document.getElementById('btn-export-xlsx');
  const bp = document.getElementById('btn-export-pdf');
  if (bx) bx.onclick = exportXlsx;
  if (bp) bp.onclick = exportPdf;
  document.querySelectorAll('[data-preset]').forEach(b => {
    b.onclick = () => { applyPreset(b.dataset.preset); loadReport(); };
  });
}

function applyPreset(p) {
  const today = new Date();
  let from, to = today;
  if (p === 'this-month') {
    from = new Date(today.getFullYear(), today.getMonth(), 1);
  } else if (p === 'last-month') {
    from = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    to = new Date(today.getFullYear(), today.getMonth(), 0);
  } else if (p === 'this-quarter') {
    const q = Math.floor(today.getMonth() / 3);
    from = new Date(today.getFullYear(), q * 3, 1);
  } else if (p === 'this-year') {
    from = new Date(today.getFullYear(), 0, 1);
  } else return;
  document.getElementById('filter-from').value = from.toISOString().slice(0, 10);
  document.getElementById('filter-to').value = to.toISOString().slice(0, 10);
}

async function loadReport() {
  const sel = document.getElementById('filter-types');
  const types = Array.from(sel.selectedOptions).map(o => o.value);
  const selU = document.getElementById('filter-usernames');
  const usernames = selU ? Array.from(selU.selectedOptions).map(o => o.value) : [];
  const from = document.getElementById('filter-from').value;
  const to = document.getElementById('filter-to').value;
  const status = document.getElementById('filter-status').value;
  const groupBy = document.getElementById('filter-group').value;

  const loading = document.getElementById('loading');
  loading.classList.remove('hidden');
  ['areaA', 'areaB', 'areaC'].forEach(id => document.getElementById(id).innerHTML = '');

  try {
    const res = await apiReport({
      types: types.length === SCHEMA_KEYS.length ? undefined : types,
      usernames: usernames.length > 0 ? usernames : undefined,
      from: from || undefined,
      to: to ? to + 'T23:59:59' : undefined,
      status,
      groupBy
    });
    state.data = res;
    renderAreaA(res.areaA || []);
    renderAreaB(res.areaB || [], types);
    renderAreaC(res.areaC || [], types);
    renderAreaD(res.areaD || [], types);
    document.getElementById('btn-export').disabled = false;
    const bx = document.getElementById('btn-export-xlsx');
    const bp = document.getElementById('btn-export-pdf');
    if (bx) bx.disabled = false;
    if (bp) bp.disabled = false;
  } catch (e) {
    showToast('Lỗi tải báo cáo: ' + e.message, 'error', 4000);
  } finally {
    loading.classList.add('hidden');
  }
}

// =====================================================================
// AREA A — Bảng tổng quan theo loại
// =====================================================================
function renderAreaA(rows) {
  const div = document.getElementById('areaA');
  if (rows.length === 0) {
    div.innerHTML = '<p class="text-sm text-gray-500 p-4">Không có dữ liệu</p>';
    return;
  }
  const total = rows.reduce((s, r) => s + r.total, 0);
  let html = `
    <table class="w-full text-sm min-w-[600px]">
      <thead class="bg-gray-100 border-b">
        <tr>
          <th class="px-2 py-2 text-left text-xs font-semibold">Loại khảo sát</th>
          <th class="px-2 py-2 text-right text-xs font-semibold">Tổng bản</th>
          <th class="px-2 py-2 text-right text-xs font-semibold">Có ảnh</th>
          <th class="px-2 py-2 text-right text-xs font-semibold">Có GPS</th>
          <th class="px-2 py-2 text-right text-xs font-semibold">TB ảnh/bản</th>
          <th class="px-2 py-2 text-right text-xs font-semibold">Đã xoá</th>
        </tr>
      </thead>
      <tbody>
  `;
  for (const r of rows) {
    const schema = SCHEMAS[r.type];
    const pctPhoto = r.total > 0 ? Math.round(r.has_photo / r.total * 100) : 0;
    const pctGps = r.total > 0 ? Math.round(r.has_gps / r.total * 100) : 0;
    html += `
      <tr class="border-b hover:bg-blue-50">
        <td class="px-2 py-2"><span class="mr-2">${schema ? schema.icon : '📋'}</span>${escapeHtml(schema ? schema.name : r.type)}</td>
        <td class="px-2 py-2 text-right font-mono font-semibold">${r.total}</td>
        <td class="px-2 py-2 text-right font-mono text-xs">${r.has_photo} (${pctPhoto}%)</td>
        <td class="px-2 py-2 text-right font-mono text-xs">${r.has_gps} (${pctGps}%)</td>
        <td class="px-2 py-2 text-right font-mono">${r.avg_photos_per_record}</td>
        <td class="px-2 py-2 text-right font-mono text-red-600">${r.deleted}</td>
      </tr>
    `;
  }
  html += `
      <tr class="bg-gray-50 font-bold border-t-2">
        <td class="px-2 py-2">TỔNG</td>
        <td class="px-2 py-2 text-right font-mono">${total}</td>
        <td colspan="4"></td>
      </tr>
    </tbody></table>`;
  div.innerHTML = html;
}

// =====================================================================
// AREA B — Stacked bar chart theo bucket thời gian
// =====================================================================
function renderAreaB(rows, types) {
  const div = document.getElementById('areaB');
  if (rows.length === 0) {
    div.innerHTML = '<p class="text-sm text-gray-500 p-4">Không có dữ liệu</p>';
    return;
  }
  // Tính max stack
  const usedTypes = types.length > 0 && types.length < SCHEMA_KEYS.length ? types : SCHEMA_KEYS;
  const totals = rows.map(r => usedTypes.reduce((s, t) => s + (r[t] || 0), 0));
  const max = Math.max(1, ...totals);

  const w = Math.max(600, rows.length * 60);
  const h = 280, padL = 40, padB = 60, padT = 20;
  const innerH = h - padB - padT;
  const innerW = w - padL - 10;
  const barW = innerW / rows.length * 0.7;

  let bars = '';
  rows.forEach((row, i) => {
    const x = padL + i * (innerW / rows.length) + (innerW / rows.length - barW) / 2;
    let y = padT + innerH;
    usedTypes.forEach((t, ti) => {
      const c = row[t] || 0;
      if (c === 0) return;
      const bh = c / max * innerH;
      y -= bh;
      bars += `<rect x="${x}" y="${y}" width="${barW}" height="${bh}" fill="${TYPE_COLORS[ti % TYPE_COLORS.length]}"><title>${escapeHtml(SCHEMAS[t] ? SCHEMAS[t].name : t)}: ${c}</title></rect>`;
    });
    // Total label
    const total = totals[i];
    if (total > 0) {
      bars += `<text x="${x + barW / 2}" y="${y - 4}" text-anchor="middle" font-size="10" fill="#333" font-weight="bold">${total}</text>`;
    }
    // X label (bucket)
    bars += `<text x="${x + barW / 2}" y="${padT + innerH + 14}" text-anchor="middle" font-size="10" fill="#6b7280" transform="rotate(-35 ${x + barW / 2} ${padT + innerH + 14})">${escapeHtml(row.bucket)}</text>`;
  });

  // Y axis ticks
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(f => {
    const v = Math.round(max * f);
    const y = padT + innerH - f * innerH;
    return `<line x1="${padL}" y1="${y}" x2="${w - 5}" y2="${y}" stroke="#e5e7eb" stroke-dasharray="2,2"/>
            <text x="${padL - 5}" y="${y + 3}" text-anchor="end" font-size="10" fill="#6b7280">${v}</text>`;
  }).join('');

  // Legend
  let legend = '<div class="flex flex-wrap gap-2 text-xs mt-2">';
  usedTypes.forEach((t, ti) => {
    if (rows.some(r => (r[t] || 0) > 0)) {
      legend += `<span class="inline-flex items-center gap-1"><span class="inline-block w-3 h-3 rounded" style="background:${TYPE_COLORS[ti % TYPE_COLORS.length]}"></span>${escapeHtml(SCHEMAS[t] ? SCHEMAS[t].name : t)}</span>`;
    }
  });
  legend += '</div>';

  div.innerHTML = `
    <div class="overflow-x-auto">
      <svg viewBox="0 0 ${w} ${h}" class="bg-white" style="min-width:${w}px;max-width:100%;height:${h}px">
        ${yTicks}
        ${bars}
      </svg>
    </div>
    ${legend}
  `;
}

// =====================================================================
// AREA C — Pivot KTV × Loại
// =====================================================================
function renderAreaC(rows, types) {
  const div = document.getElementById('areaC');
  if (rows.length === 0) {
    div.innerHTML = '<p class="text-sm text-gray-500 p-4">Không có dữ liệu</p>';
    return;
  }
  const usedTypes = types.length > 0 && types.length < SCHEMA_KEYS.length ? types : SCHEMA_KEYS;

  let html = '<table class="w-full text-sm min-w-[800px]"><thead class="bg-gray-100 border-b"><tr>';
  html += '<th class="px-2 py-2 text-left text-xs font-semibold sticky left-0 bg-gray-100">KTV</th>';
  for (const t of usedTypes) {
    html += `<th class="px-1 py-2 text-center text-xs font-semibold" title="${escapeHtml(SCHEMAS[t] ? SCHEMAS[t].name : t)}">${SCHEMAS[t] ? SCHEMAS[t].icon : '📋'}</th>`;
  }
  html += '<th class="px-2 py-2 text-right text-xs font-bold">Tổng</th></tr></thead><tbody>';

  for (const r of rows) {
    html += `<tr class="border-b hover:bg-blue-50">
      <td class="px-2 py-2 sticky left-0 bg-white">
        <div class="text-sm font-medium">${escapeHtml(r.full_name || r.username)}</div>
        <div class="text-xs text-gray-500">@${escapeHtml(r.username)}</div>
      </td>`;
    for (const t of usedTypes) {
      const c = r[t] || 0;
      html += `<td class="px-1 py-2 text-center font-mono text-sm">${c > 0 ? c : '<span class="text-gray-300">·</span>'}</td>`;
    }
    html += `<td class="px-2 py-2 text-right font-bold font-mono">${r.total}</td></tr>`;
  }
  html += '</tbody></table>';
  div.innerHTML = html;
}

// =====================================================================
// AREA D — Heatmap Phường × Loại
// =====================================================================
function renderAreaD(rows, types) {
  const div = document.getElementById('areaD');
  if (rows.length === 0) {
    div.innerHTML = '<p class="text-sm text-gray-500 p-4">Không có dữ liệu</p>';
    return;
  }
  const usedTypes = types.length > 0 && types.length < SCHEMA_KEYS.length ? types : SCHEMA_KEYS;

  // Tìm max cell để tính scale màu
  let max = 1;
  for (const r of rows) {
    for (const t of usedTypes) {
      if ((r[t] || 0) > max) max = r[t];
    }
  }

  let html = '<table class="w-full text-sm min-w-[700px]"><thead class="bg-gray-100 border-b"><tr>';
  html += '<th class="px-2 py-2 text-left text-xs font-semibold sticky left-0 bg-gray-100">Phường</th>';
  for (const t of usedTypes) {
    html += `<th class="px-1 py-2 text-center text-xs font-semibold" title="${escapeHtml(SCHEMAS[t] ? SCHEMAS[t].name : t)}">${SCHEMAS[t] ? SCHEMAS[t].icon : '📋'}</th>`;
  }
  html += '<th class="px-2 py-2 text-right text-xs font-bold">Tổng</th></tr></thead><tbody>';

  for (const r of rows) {
    html += `<tr class="border-b">
      <td class="px-2 py-2 text-sm font-medium sticky left-0 bg-white">${escapeHtml(r.phuong)}</td>`;
    for (const t of usedTypes) {
      const c = r[t] || 0;
      const cls = heatClass(c, max);
      html += `<td class="text-center font-mono text-sm cursor-pointer hover:opacity-80 ${cls.bg} ${cls.text}"
        data-phuong="${escapeHtml(r.phuong)}" data-type="${escapeHtml(t)}" data-count="${c}">${c > 0 ? c : '·'}</td>`;
    }
    html += `<td class="px-2 py-2 text-right font-bold font-mono">${r.total}</td></tr>`;
  }
  html += '</tbody></table>';
  div.innerHTML = html;

  // Bind click drill-down
  div.querySelectorAll('td[data-phuong]').forEach(cell => {
    cell.onclick = () => {
      const count = parseInt(cell.dataset.count, 10);
      if (!count) return;
      openDrillDown(cell.dataset.phuong, cell.dataset.type);
    };
  });
}

function heatClass(count, max) {
  if (count === 0) return { bg: 'bg-gray-50', text: 'text-gray-300' };
  const pct = count / max;
  if (pct >= 0.9) return { bg: 'bg-red-700', text: 'text-white' };
  if (pct >= 0.75) return { bg: 'bg-red-600', text: 'text-white' };
  if (pct >= 0.6) return { bg: 'bg-red-500', text: 'text-white' };
  if (pct >= 0.45) return { bg: 'bg-red-400', text: 'text-white' };
  if (pct >= 0.3) return { bg: 'bg-red-300', text: 'text-gray-900' };
  if (pct >= 0.15) return { bg: 'bg-red-200', text: 'text-gray-900' };
  return { bg: 'bg-red-100', text: 'text-gray-900' };
}

/** Drill-down: tải bản ghi của 1 ô (phuong + type) và hiện trong modal. */
async function openDrillDown(phuong, type) {
  const schema = SCHEMAS[type];
  const modal = document.getElementById('drill-modal');
  const title = document.getElementById('drill-title');
  const body = document.getElementById('drill-body');
  title.textContent = (schema ? schema.icon : '📋') + ' ' + (schema ? schema.name : type) + ' — ' + phuong;
  body.innerHTML = '<div class="text-center text-gray-500 py-4">⏳ Đang tải...</div>';
  modal.classList.remove('hidden');

  try {
    const filter = state.data ? state.data.filter : {};
    const res = await apiList({
      type: type,
      from: filter.from || undefined,
      to: filter.to || undefined,
      status: filter.status || 'active'
    });
    const rows = (res.rows || []).filter(r => String(r['Phường'] || '').trim() === phuong);

    if (rows.length === 0) {
      body.innerHTML = '<p class="text-gray-500 text-center py-4">Không có bản ghi nào khớp.</p>';
      return;
    }

    let html = `<p class="text-xs text-gray-500 mb-2">${rows.length} bản ghi:</p>`;
    html += '<div class="space-y-1">';
    for (const r of rows.slice(0, 100)) {
      const tuyen = r['Tuyến đường'] || r['Vị trí'] || '—';
      const ktv = r['Người khảo sát'] || r['Username'] || '?';
      const date = r['Submitted At'] ? formatVnDateOnly(r['Submitted At']) : '';
      const isDeleted = !!r['Deleted At'];
      html += `<div class="border-b border-gray-100 py-2 ${isDeleted ? 'opacity-60 line-through' : ''}">
        <div class="text-sm"><strong>STT #${escapeHtml(String(r['STT']))}</strong> · ${escapeHtml(tuyen)}</div>
        <div class="text-xs text-gray-500">${escapeHtml(ktv)} · ${escapeHtml(date)}</div>
      </div>`;
    }
    if (rows.length > 100) {
      html += `<p class="text-xs text-gray-500 mt-2">(Hiển thị 100 đầu / ${rows.length} tổng)</p>`;
    }
    html += '</div>';
    body.innerHTML = html;
  } catch (e) {
    body.innerHTML = '<p class="text-red-600 text-center py-4">Lỗi: ' + escapeHtml(e.message) + '</p>';
  }
}

// =====================================================================
// EXPORT CSV
// =====================================================================
function exportCsv() {
  if (!state.data) return;
  const sections = [];

  // A
  const usedTypesA = state.data.areaA.map(r => r.type);
  sections.push('# Báo cáo SAPULICO\n');
  sections.push('## Vùng A — Tổng quan theo loại');
  sections.push(['Loại', 'Tổng bản', 'Có ảnh', 'Có GPS', 'TB ảnh/bản', 'Đã xoá'].join(','));
  for (const r of state.data.areaA) {
    const schema = SCHEMAS[r.type];
    sections.push([
      csvEscape(schema ? schema.name : r.type),
      r.total, r.has_photo, r.has_gps, r.avg_photos_per_record, r.deleted
    ].join(','));
  }

  // B
  sections.push('\n## Vùng B — Timeseries');
  const allTypes = Object.keys(SCHEMAS);
  sections.push(['Bucket', ...allTypes.map(t => SCHEMAS[t].name)].map(csvEscape).join(','));
  for (const r of state.data.areaB) {
    sections.push([csvEscape(r.bucket), ...allTypes.map(t => r[t] || 0)].join(','));
  }

  // C
  sections.push('\n## Vùng C — Pivot KTV × Loại');
  sections.push(['KTV', 'Họ tên', ...allTypes.map(t => SCHEMAS[t].name), 'Tổng'].map(csvEscape).join(','));
  for (const r of state.data.areaC) {
    sections.push([
      csvEscape(r.username), csvEscape(r.full_name),
      ...allTypes.map(t => r[t] || 0),
      r.total
    ].join(','));
  }

  // D
  if (state.data.areaD && state.data.areaD.length > 0) {
    sections.push('\n## Vùng D — Heatmap Phường × Loại');
    sections.push(['Phường', ...allTypes.map(t => SCHEMAS[t].name), 'Tổng'].map(csvEscape).join(','));
    for (const r of state.data.areaD) {
      sections.push([
        csvEscape(r.phuong),
        ...allTypes.map(t => r[t] || 0),
        r.total
      ].join(','));
    }
  }

  const csv = sections.join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `bao-cao-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function csvEscape(v) {
  if (v === null || v === undefined) return '';
  const s = String(v);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

/** Export Excel — 3 sheet riêng cho 3 vùng. */
function exportXlsx() {
  if (!state.data) return;
  if (typeof XLSX === 'undefined') { showToast('SheetJS chưa load', 'error'); return; }
  const dateStr = new Date().toISOString().slice(0, 10);
  const allTypes = Object.keys(SCHEMAS);
  const wb = XLSX.utils.book_new();

  // Sheet A: Tổng quan
  const headerA = ['Loại', 'Tổng bản', 'Có ảnh', 'Có GPS', 'TB ảnh/bản', 'Đã xoá'];
  const rowsA = state.data.areaA.map(r => {
    const sc = SCHEMAS[r.type];
    return [sc ? sc.name : r.type, r.total, r.has_photo, r.has_gps, r.avg_photos_per_record, r.deleted];
  });
  const wsA = XLSX.utils.aoa_to_sheet([
    ['Vùng A — Tổng quan theo loại'],
    ['Xuất lúc: ' + new Date().toLocaleString('vi-VN')],
    [],
    headerA,
    ...rowsA
  ]);
  wsA['!cols'] = [{wch:30},{wch:10},{wch:10},{wch:10},{wch:14},{wch:10}];
  XLSX.utils.book_append_sheet(wb, wsA, 'A-Tong quan');

  // Sheet B: Timeseries
  const headerB = ['Bucket', ...allTypes.map(t => SCHEMAS[t].name)];
  const rowsB = state.data.areaB.map(r => [r.bucket, ...allTypes.map(t => r[t] || 0)]);
  const wsB = XLSX.utils.aoa_to_sheet([
    ['Vùng B — Phân bố theo thời gian'],
    [],
    headerB,
    ...rowsB
  ]);
  wsB['!cols'] = [{wch:14}, ...allTypes.map(() => ({wch:14}))];
  XLSX.utils.book_append_sheet(wb, wsB, 'B-Timeseries');

  // Sheet C: Pivot
  const headerC = ['Username', 'Họ tên', ...allTypes.map(t => SCHEMAS[t].name), 'Tổng'];
  const rowsC = state.data.areaC.map(r => [
    r.username, r.full_name,
    ...allTypes.map(t => r[t] || 0),
    r.total
  ]);
  const wsC = XLSX.utils.aoa_to_sheet([
    ['Vùng C — Pivot KTV × Loại'],
    [],
    headerC,
    ...rowsC
  ]);
  wsC['!cols'] = [{wch:12},{wch:24}, ...allTypes.map(() => ({wch:14})), {wch:10}];
  XLSX.utils.book_append_sheet(wb, wsC, 'C-Pivot KTV');

  // Sheet D: Heatmap Phường
  if (state.data.areaD && state.data.areaD.length > 0) {
    const headerD = ['Phường', ...allTypes.map(t => SCHEMAS[t].name), 'Tổng'];
    const rowsD = state.data.areaD.map(r => [r.phuong, ...allTypes.map(t => r[t] || 0), r.total]);
    const wsD = XLSX.utils.aoa_to_sheet([
      ['Vùng D — Heatmap Phường × Loại'],
      [],
      headerD,
      ...rowsD
    ]);
    wsD['!cols'] = [{wch:28}, ...allTypes.map(() => ({wch:14})), {wch:10}];
    XLSX.utils.book_append_sheet(wb, wsD, 'D-Heatmap');
  }

  XLSX.writeFile(wb, 'bao-cao-' + dateStr + '.xlsx');
}

/** Export PDF — A4 landscape, 3 vùng trên 3 trang. */
function exportPdf() {
  if (!state.data) return;
  if (!window.jspdf || !window.jspdf.jsPDF) { showToast('jsPDF chưa load', 'error'); return; }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const allTypes = Object.keys(SCHEMAS);
  const dateStr = new Date().toLocaleString('vi-VN');

  // === Trang 1: Vùng A ===
  drawPdfHeader(doc, 'Vung A — Tong quan theo loai', dateStr);
  doc.autoTable({
    startY: 28,
    head: [['Loai', 'Tong ban', 'Co anh', 'Co GPS', 'TB anh/ban', 'Da xoa']],
    body: state.data.areaA.map(r => {
      const sc = SCHEMAS[r.type];
      return [sc ? sc.name : r.type, r.total, r.has_photo, r.has_gps, r.avg_photos_per_record, r.deleted];
    }),
    styles: { fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: [29, 78, 216] },
    columnStyles: {
      0: { cellWidth: 80 },
      1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' },
      4: { halign: 'right' }, 5: { halign: 'right', textColor: [192, 0, 0] }
    },
    didDrawPage: pdfFooter(doc)
  });

  // === Trang 2: Vùng B Timeseries ===
  doc.addPage();
  drawPdfHeader(doc, 'Vung B — Phan bo theo thoi gian', dateStr);
  doc.autoTable({
    startY: 28,
    head: [['Bucket', ...allTypes.map(t => SCHEMAS[t].name)]],
    body: state.data.areaB.map(r => [r.bucket, ...allTypes.map(t => r[t] || 0)]),
    styles: { fontSize: 7, cellPadding: 1.5 },
    headStyles: { fillColor: [29, 78, 216], fontSize: 7 },
    columnStyles: { 0: { cellWidth: 22, fontStyle: 'bold' } },
    didDrawPage: pdfFooter(doc)
  });

  // === Trang 3: Vùng C Pivot ===
  doc.addPage();
  drawPdfHeader(doc, 'Vung C — Pivot KTV x Loai', dateStr);
  doc.autoTable({
    startY: 28,
    head: [['User', 'Ho ten', ...allTypes.map(t => SCHEMAS[t].name), 'Tong']],
    body: state.data.areaC.map(r => [
      r.username, r.full_name,
      ...allTypes.map(t => r[t] || 0),
      r.total
    ]),
    styles: { fontSize: 7, cellPadding: 1.5 },
    headStyles: { fillColor: [29, 78, 216], fontSize: 7 },
    columnStyles: {
      0: { cellWidth: 16 },
      1: { cellWidth: 32 },
      [2 + allTypes.length]: { fontStyle: 'bold', halign: 'right' }
    },
    didDrawPage: pdfFooter(doc)
  });

  // === Trang 4: Vùng D Heatmap (nếu có) ===
  if (state.data.areaD && state.data.areaD.length > 0) {
    doc.addPage();
    drawPdfHeader(doc, 'Vung D — Heatmap Phuong x Loai', dateStr);
    doc.autoTable({
      startY: 28,
      head: [['Phuong', ...allTypes.map(t => SCHEMAS[t].name), 'Tong']],
      body: state.data.areaD.map(r => [
        r.phuong,
        ...allTypes.map(t => r[t] || 0),
        r.total
      ]),
      styles: { fontSize: 7, cellPadding: 1.5 },
      headStyles: { fillColor: [29, 78, 216], fontSize: 7 },
      columnStyles: {
        0: { cellWidth: 35 },
        [1 + allTypes.length]: { fontStyle: 'bold', halign: 'right' }
      },
      didDrawPage: pdfFooter(doc)
    });
  }

  doc.save('bao-cao-' + new Date().toISOString().slice(0, 10) + '.pdf');
}

function drawPdfHeader(doc, title, dateStr) {
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('SAPULICO — Bao cao khao sat', 14, 14);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(title, 14, 21);
  doc.setFontSize(8);
  doc.setTextColor(120);
  doc.text('Xuat luc: ' + dateStr, doc.internal.pageSize.getWidth() - 14, 14, { align: 'right' });
  doc.setTextColor(0);
}

function pdfFooter(doc) {
  return (data) => {
    const pageCount = doc.internal.getNumberOfPages();
    const pageNum = data.pageNumber;
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text('Trang ' + pageNum + '/' + pageCount + ' — SAPULICO 2026',
      doc.internal.pageSize.getWidth() - 14, doc.internal.pageSize.getHeight() - 8, { align: 'right' });
  };
}

// =====================================================================
// VÙNG E — Xuất dữ liệu thô theo cấu trúc sheet
// =====================================================================

/** Khởi tạo section xuất dữ liệu thô: populate select + bind buttons. */
export function initRawExport() {
  const sel = document.getElementById('raw-types');
  if (!sel) return;
  for (const k of SCHEMA_KEYS) {
    const opt = document.createElement('option');
    opt.value = k;
    opt.textContent = SCHEMAS[k].icon + ' ' + SCHEMAS[k].name;
    sel.appendChild(opt);
  }
  document.getElementById('btn-raw-xlsx').onclick = exportRawXlsx;
  document.getElementById('btn-raw-csv').onclick  = exportRawCsv;
}

function getRawParams() {
  const sel  = document.getElementById('raw-types');
  const vals = [...sel.selectedOptions].map(o => o.value);
  return {
    types:  vals.length ? vals : SCHEMA_KEYS,
    from:   document.getElementById('raw-from').value  || null,
    to:     document.getElementById('raw-to').value    || null,
    status: document.getElementById('raw-status').value
  };
}

async function fetchExportRaw() {
  const msgEl = document.getElementById('raw-status-msg');
  msgEl.textContent = 'Đang tải dữ liệu từ server...';
  msgEl.classList.remove('hidden');
  try {
    const params = getRawParams();
    const res = await apiExportRaw(params);
    msgEl.classList.add('hidden');
    return res.results;   // [{type, sheetName, headers, rows}, ...]
  } catch (e) {
    msgEl.textContent = 'Lỗi: ' + e.message;
    throw e;
  }
}

async function exportRawXlsx() {
  const XLSX = window.XLSX;
  if (!XLSX) { alert('Thư viện SheetJS chưa tải'); return; }
  let results;
  try { results = await fetchExportRaw(); } catch { return; }

  const wb = XLSX.utils.book_new();
  let sheetCount = 0;
  for (const { sheetName, headers, rows } of results) {
    if (!rows.length) continue;
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    // Freeze row 1
    ws['!freeze'] = { xSplit: 0, ySplit: 1 };
    // Tên tab tối đa 31 ký tự (giới hạn Excel)
    XLSX.utils.book_append_sheet(wb, ws, sheetName.substring(0, 31));
    sheetCount++;
  }

  if (sheetCount === 0) { alert('Không có dữ liệu để xuất theo bộ lọc đã chọn'); return; }

  const { from, to } = getRawParams();
  const filename = 'khaosat-' + (from || 'all') + '_' + (to || 'all') + '.xlsx';
  XLSX.writeFile(wb, filename);
}

async function exportRawCsv() {
  let results;
  try { results = await fetchExportRaw(); } catch { return; }

  const { from, to } = getRawParams();
  let downloaded = 0;

  for (const { sheetName, headers, rows } of results) {
    if (!rows.length) continue;
    // BOM UTF-8 để Excel Windows mở đúng tiếng Việt; separator | (pipe)
    const lines = [headers, ...rows].map(row =>
      row.map(v => '"' + String(v).replace(/"/g, '""') + '"').join('|')
    );
    const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = sheetName + '_' + (from || 'all') + '_' + (to || 'all') + '.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
    downloaded++;
    // Tránh trình duyệt block nhiều download liên tiếp
    if (downloaded < results.filter(r => r.rows.length).length) {
      await new Promise(r => setTimeout(r, 400));
    }
  }

  if (downloaded === 0) alert('Không có dữ liệu để xuất theo bộ lọc đã chọn');
}
