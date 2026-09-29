// js/report.js — Trang báo cáo: vùng A-D aggregate + Vùng E xuất dữ liệu thô.

import { apiReport, apiUsers, apiList, apiExportRaw, apiUpdate, apiBulkImport } from './api.js';
import { SCHEMAS, SCHEMA_KEYS, XU_LY_STATUSES } from './schemas.js';
import { showToast, escapeHtml, formatVnDateOnly } from './utils.js';
import { newWorkbook, addReportSheet, addRawSheet, downloadWorkbook, periodLine } from './excel-export.js';

const state = {
  data: null  // { areaA, areaB, areaC }
};

const TYPE_COLORS = [
  '#1d4ed8', '#dc2626', '#16a34a', '#ea580c', '#9333ea',
  '#0891b2', '#ca8a04', '#65a30d', '#be185d', '#0d9488',
  '#7c3aed', '#b45309', '#059669', '#c026d3', '#4f46e5',
  '#be123c'
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
    // Im lặng, để dropdown rỗng = "tất cả người khảo sát"
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
    state.period = { from, to };
    renderAreaA(res.areaA || []);
    renderAreaB(res.areaB || [], types);
    renderAreaC(res.areaC || [], types);
    renderAreaD(res.areaD || [], types);
    renderAreaS(res.areaS || []);
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
// AREA C — Pivot Người khảo sát × Loại
// =====================================================================
function renderAreaC(rows, types) {
  const div = document.getElementById('areaC');
  if (rows.length === 0) {
    div.innerHTML = '<p class="text-sm text-gray-500 p-4">Không có dữ liệu</p>';
    return;
  }
  const usedTypes = types.length > 0 && types.length < SCHEMA_KEYS.length ? types : SCHEMA_KEYS;

  let html = '<table class="w-full text-sm min-w-[800px]"><thead class="bg-gray-100 border-b"><tr>';
  html += '<th class="px-2 py-2 text-left text-xs font-semibold sticky left-0 bg-gray-100">Người khảo sát</th>';
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
const XU_LY_COLS = [...XU_LY_STATUSES, 'Chưa cập nhật'];

/** Bảng tiến độ xử lý: mỗi loại 1 dòng, cột = trạng thái, cuối = % đã nghiệm thu. */
function xuLyRows(areaS) {
  return areaS.map(r => {
    const vals = XU_LY_COLS.map(s => r[s] || 0);
    const total = vals.reduce((a, b) => a + b, 0);
    const nt = r['Nghiệm thu'] || 0;
    return { name: SCHEMAS[r.type] ? SCHEMAS[r.type].name : r.type, vals, total, pct: total ? Math.round(nt * 1000 / total) / 10 : 0 };
  }).filter(r => r.total > 0);
}

function renderAreaS(areaS) {
  const el = document.getElementById('areaS');
  if (!el) return;
  const rows = xuLyRows(areaS);
  if (!rows.length) { el.innerHTML = '<p class="p-3 text-sm text-gray-500">Không có dữ liệu (hoặc máy chủ chưa cập nhật bản có trạng thái xử lý).</p>'; return; }
  el.innerHTML = '<table class="w-full text-xs"><thead class="bg-gray-100"><tr><th class="px-2 py-2 text-left">Loại</th>' +
    XU_LY_COLS.map(s => `<th class="px-2 py-2 text-right whitespace-nowrap">${escapeHtml(s)}</th>`).join('') +
    '<th class="px-2 py-2 text-right">Tổng</th><th class="px-2 py-2 text-right">% nghiệm thu</th></tr></thead><tbody>' +
    rows.map(r => `<tr class="border-t"><td class="px-2 py-1">${escapeHtml(r.name)}</td>` +
      r.vals.map(v => `<td class="px-2 py-1 text-right">${v || ''}</td>`).join('') +
      `<td class="px-2 py-1 text-right font-semibold">${r.total}</td><td class="px-2 py-1 text-right">${r.pct}%</td></tr>`).join('') +
    '</tbody></table>';
}

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
  sections.push('\n## Vùng C — Pivot Người khảo sát × Loại');
  sections.push(['Người khảo sát', 'Họ tên', ...allTypes.map(t => SCHEMAS[t].name), 'Tổng'].map(csvEscape).join(','));
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

/** Export Excel — mỗi vùng A/B/C/D một sheet, có định dạng. */
async function exportXlsx() {
  if (!state.data) return;
  const btn = document.getElementById('btn-export-xlsx');
  btn.disabled = true;
  try {
    const wb = await newWorkbook();
    const types = state.data.areaA.map(r => r.type);   // đúng các loại đã lọc
    const name = t => (SCHEMAS[t] ? SCHEMAS[t].name : t);
    const sub = periodLine(state.period?.from, state.period?.to);
    const sum = (rows, i) => rows.reduce((s, r) => s + (Number(r[i]) || 0), 0);

    // A — Tổng quan
    const rowsA = state.data.areaA.map(r => [name(r.type), r.total, r.has_photo, r.has_gps, r.avg_photos_per_record, r.deleted]);
    const totA = ['TỔNG CỘNG', sum(rowsA, 1), sum(rowsA, 2), sum(rowsA, 3), '', sum(rowsA, 5)];
    addReportSheet(wb, 'A-Tổng quan', {
      title: 'BÁO CÁO TỔNG HỢP KHẢO SÁT THEO LOẠI', subtitle: sub,
      headers: ['Loại khảo sát', 'Tổng bản', 'Có ảnh', 'Có GPS', 'TB ảnh/bản', 'Đã xoá'],
      rows: rowsA, total: totA, landscape: false
    });

    // B — Theo thời gian
    const rowsB = state.data.areaB.map(r => {
      const vals = types.map(t => r[t] || 0);
      return [r.bucket, ...vals, vals.reduce((a, b) => a + b, 0)];
    });
    addReportSheet(wb, 'B-Theo thời gian', {
      title: 'PHÂN BỐ SỐ BẢN KHẢO SÁT THEO THỜI GIAN', subtitle: sub,
      headers: ['Thời gian', ...types.map(name), 'Tổng'],
      rows: rowsB, total: ['TỔNG CỘNG', ...types.map((_, i) => sum(rowsB, i + 1)), sum(rowsB, types.length + 1)]
    });

    // C — Người khảo sát × Loại
    const rowsC = state.data.areaC.map(r => [r.full_name || r.username, r.username, ...types.map(t => r[t] || 0), r.total]);
    addReportSheet(wb, 'C-Người khảo sát', {
      title: 'SỐ BẢN KHẢO SÁT THEO NGƯỜI KHẢO SÁT', subtitle: sub,
      headers: ['Người khảo sát', 'Tài khoản', ...types.map(name), 'Tổng'],
      rows: rowsC, total: ['TỔNG CỘNG', '', ...types.map((_, i) => sum(rowsC, i + 2)), sum(rowsC, types.length + 2)]
    });

    // D — Phường × Loại, tô đậm nhạt theo số lượng (giống heatmap trên web)
    if (state.data.areaD && state.data.areaD.length) {
      const rowsD = state.data.areaD.map(r => [r.phuong, ...types.map(t => r[t] || 0), r.total]);
      const max = Math.max(1, ...rowsD.flatMap(r => r.slice(1, -1)));
      const heat = ['FFFEF2F2', 'FFFECACA', 'FFFCA5A5', 'FFF87171', 'FFEF4444'];
      addReportSheet(wb, 'D-Phường', {
        title: 'SỐ BẢN KHẢO SÁT THEO PHƯỜNG/XÃ', subtitle: sub,
        headers: ['Phường/Xã', ...types.map(name), 'Tổng'],
        rows: rowsD, total: ['TỔNG CỘNG', ...types.map((_, i) => sum(rowsD, i + 1)), sum(rowsD, types.length + 1)],
        cellFill: (v, r, c) => (c > 0 && c <= types.length && v > 0) ? heat[Math.min(4, Math.floor((v / max) * 5))] : null
      });
    }

    // E — Tiến độ xử lý
    const rowsS = xuLyRows(state.data.areaS || []).map(r => [r.name, ...r.vals, r.total, r.pct]);
    if (rowsS.length) {
      const tot = XU_LY_COLS.map((_, i) => sum(rowsS, i + 1));
      const all = sum(rowsS, XU_LY_COLS.length + 1);
      const nt = tot[XU_LY_COLS.indexOf('Nghiệm thu')];
      addReportSheet(wb, 'E-Tiến độ xử lý', {
        title: 'TIẾN ĐỘ XỬ LÝ CÁC ĐIỂM KHẢO SÁT', subtitle: sub,
        headers: ['Loại khảo sát', ...XU_LY_COLS, 'Tổng', '% nghiệm thu'],
        rows: rowsS, total: ['TỔNG CỘNG', ...tot, all, all ? Math.round(nt * 1000 / all) / 10 : 0]
      });
    }

    await downloadWorkbook(wb, 'bao-cao-tong-hop-' + new Date().toISOString().slice(0, 10) + '.xlsx');
  } catch (e) {
    showToast('Lỗi xuất Excel: ' + e.message, 'error');
  } finally {
    btn.disabled = false;
  }
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
  drawPdfHeader(doc, 'Vung C — Pivot Người khảo sát x Loai', dateStr);
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
  const bd = document.getElementById('btn-dialux-xlsx');
  if (bd) bd.onclick = exportDialuxXlsx;
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
  let results;
  try { results = await fetchExportRaw(); } catch { return; }
  const btn = document.getElementById('btn-raw-xlsx');
  btn.disabled = true;
  try {
    const wb = await newWorkbook();
    let sheetCount = 0;
    for (const { sheetName, headers, rows } of results) {
      if (!rows.length) continue;
      // Tên tab = tên sheet Google Sheets nguyên văn; dòng 1 = tiêu đề cột (để Nhập Excel đọc lại)
      addRawSheet(wb, sheetName, headers, rows);
      sheetCount++;
    }
    if (sheetCount === 0) { alert('Không có dữ liệu để xuất theo bộ lọc đã chọn'); return; }
    const { from, to } = getRawParams();
    await downloadWorkbook(wb, 'khaosat-' + (from || 'all') + '_' + (to || 'all') + '.xlsx');
  } catch (e) {
    showToast('Lỗi xuất Excel: ' + e.message, 'error');
  } finally {
    btn.disabled = false;
  }
}

// =====================================================================
// XUẤT THÔNG SỐ DIALUX — 1 dòng / tuyến (gộp 3 loại khảo sát tuyến)
// =====================================================================

const DIALUX_TYPES = ['thay_den', 'tang_cuong_den', 'ngam_hoa'];
// [tiêu đề cột xuất, tên cột trong sheet, cốt lõi?] — thứ tự = thứ tự nhập vào DIALux
const DIALUX_FIELDS = [
  ['Độ rộng đường (m)', 'Độ rộng đường', true],
  ['Số làn xe', 'Số làn xe', false],
  ['Dãy phân cách', 'Dãy phân cách', false],
  ['Bề rộng dải phân cách (m)', 'Bề rộng dải phân cách', false],
  ['Vỉa hè trái (m)', 'Bề rộng vỉa hè trái', false],
  ['Vỉa hè phải (m)', 'Bề rộng vỉa hè phải', false],
  ['Loại mặt đường', 'Loại mặt đường', false],
  ['Kiểu bố trí trụ', 'Kiểu bố trí trụ', true],
  ['Khoảng cách trụ (m)', 'Khoảng cách trụ', true],
  ['Chiều cao trụ (m)', 'Chiều cao trụ', true],
  ['Vươn cần (m)', 'Chiều dài vươn cần', false],
  ['Góc nghiêng cần (°)', 'Góc nghiêng cần', false],
  ['Cách mép đường (m)', 'Khoảng cách trụ tới mép đường', false],
  ['Số đèn / trụ', 'Số đèn trên 1 trụ', false],
  ['Loại đèn hiện hữu', 'Loại đèn hiện hữu', false],
  ['Công suất đèn hiện hữu', 'Công suất đèn hiện hữu', false]
];

function foldKey(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .toLowerCase().replace(/^\s*duong\s+/, '').replace(/\s+/g, ' ').trim();
}

async function exportDialuxXlsx() {
  const btn = document.getElementById('btn-dialux-xlsx');
  const { from, to } = getRawParams();
  btn.disabled = true;
  const orig = btn.textContent;
  btn.textContent = '⏳ Đang tải dữ liệu...';
  try {
    const res = await apiExportRaw({ types: DIALUX_TYPES, from, to, status: 'active' });
    const groups = new Map();
    for (const { type, headers, rows } of res.results || []) {
      const idx = h => headers.indexOf(h);
      const iSub = idx('Submitted At'), iTd = idx('Tuyến đường'), iPh = idx('Phường');
      for (const r of rows) {
        const tuyen = String(r[iTd] || '').trim();
        if (!tuyen) continue;
        const key = foldKey(r[iPh]) + '|' + foldKey(tuyen);
        const t = new Date(r[iSub]).getTime() || 0;
        let g = groups.get(key);
        if (!g) groups.set(key, g = { phuong: r[iPh] || '', tuyen, types: new Set(), count: 0, latest: null, vals: {} });
        g.count++;
        g.types.add(SCHEMAS[type].name);
        if (!g.latest || t > g.latest.t) g.latest = { t, stt: r[idx('STT')] };
        // Mỗi thông số: giữ giá trị của lần khảo sát MỚI NHẤT có điền
        for (const [, col] of DIALUX_FIELDS) {
          const i = idx(col);
          const v = i >= 0 ? r[i] : '';
          if (v === '' || v === null || v === undefined) continue;
          if (!g.vals[col] || t > g.vals[col].t) g.vals[col] = { v, t };
        }
      }
    }
    if (!groups.size) { showToast('Không có bản khảo sát tuyến nào trong khoảng thời gian này', 'warning'); return; }

    const list = [...groups.values()].sort((a, b) =>
      String(a.phuong).localeCompare(String(b.phuong), 'vi') || a.tuyen.localeCompare(b.tuyen, 'vi'));
    const rows = list.map((g, i) => {
      const missing = DIALUX_FIELDS.filter(([, col, core]) => core && !g.vals[col]).map(([h]) => h.replace(/ \(.*\)$/, ''));
      const d = g.latest && g.latest.t ? new Date(g.latest.t) : null;
      return [
        i + 1, g.phuong, g.tuyen, g.count, [...g.types].join(', '), g.latest ? String(g.latest.stt) : '',
        d ? d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '',
        ...DIALUX_FIELDS.map(([, col]) => (g.vals[col] ? g.vals[col].v : '')),
        missing.length ? missing.join(', ') : 'Đủ'
      ];
    });
    const headers = ['TT', 'Phường/Xã', 'Tuyến đường', 'Số lần KS', 'Loại KS', 'Mã bản ghi mới nhất', 'Ngày KS mới nhất',
      ...DIALUX_FIELDS.map(([h]) => h), 'Thiếu thông số'];
    const iMiss = headers.length - 1;
    const du = rows.filter(r => r[iMiss] === 'Đủ').length;

    const wb = await newWorkbook();
    addReportSheet(wb, 'Thông số DIALux', {
      title: 'THÔNG SỐ TUYẾN ĐƯỜNG PHỤC VỤ TÍNH TOÁN DIALUX',
      subtitle: periodLine(from, to) + ` · ${rows.length} tuyến, ${du} tuyến đủ thông số cốt lõi`,
      headers, rows, freezeCols: 3,
      cellFill: (v, r, c) => (c === iMiss ? (v === 'Đủ' ? 'FFBBF7D0' : 'FFFEF08A') : null)
    });
    await downloadWorkbook(wb, 'thong-so-dialux-' + (from || 'all') + '_' + (to || 'all') + '.xlsx');
  } catch (e) {
    showToast('Lỗi xuất DIALux: ' + e.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = orig;
  }
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

// =====================================================================
// VÙNG F — Nhập dữ liệu từ file Excel
// =====================================================================

const IMPORT_SHEET_MAP = {
  tang_cuong_den: 'Tang cuong den', ngam_hoa: 'Ngam Hoa', thay_den: 'Thay den',
  hkn: '4, HKN', tc_noi: '5. TCNoi', cap_luon_can: '6, Cap luon can',
  tc_ngam: '7. TCNgam', thay_can: '8. Thay Can', thay_tru: '9. Thay thế tru',
  choa_den: '10.choa den', nap_tru: '11. Nap tru', vo_tu: '12, Vo tu',
  tc_den_kc_xa: '13 Tăng cường đèn kc xa', decal_so_tru: '14 Decal số trụ', nang_mong: '15. Nâng móng',
  thao_go_bang_ron: '16. Thao go bang ron', bao_cao_su_co: '17. Bao cao su co'
};

// Các cột server-managed: không gửi khi update
const IMPORT_SKIP = ['STT', 'Submitted At', 'Username', 'Người khảo sát',
  'ngày khảo sát', 'Ngày khảo sát', 'Deleted At', 'Deleted By', 'User Agent'];

let importState = { type: '', inserts: [], updates: [] };

export function initImport() {
  const typeSel = document.getElementById('import-type');
  if (!typeSel) return;
  for (const k of SCHEMA_KEYS) {
    const opt = document.createElement('option');
    opt.value = k;
    opt.textContent = SCHEMAS[k].icon + ' ' + SCHEMAS[k].name;
    typeSel.appendChild(opt);
  }
  document.getElementById('btn-import-preview').onclick = previewImport;
  document.getElementById('btn-import-run').onclick = runImport;
}

function serializeCell(v) {
  if (v instanceof Date) {
    const p = n => String(n).padStart(2, '0');
    return `${v.getFullYear()}-${p(v.getMonth() + 1)}-${p(v.getDate())} ${p(v.getHours())}:${p(v.getMinutes())}:${p(v.getSeconds())}`;
  }
  return (v === undefined || v === null) ? '' : String(v);
}

async function previewImport() {
  const XLSX = window.XLSX;
  if (!XLSX) { showToast('SheetJS chưa tải', 'error'); return; }

  const fileEl = document.getElementById('import-file');
  const file = fileEl.files[0];
  if (!file) { showToast('Chọn file Excel trước', 'warning'); return; }

  const type = document.getElementById('import-type').value;
  const expectedSheet = IMPORT_SHEET_MAP[type];

  let wb;
  try {
    const data = await file.arrayBuffer();
    wb = XLSX.read(data, { type: 'array', cellDates: true });
  } catch (e) {
    showToast('Không đọc được file: ' + e.message, 'error');
    return;
  }

  const sheetName = wb.SheetNames.find(n => n === expectedSheet) || wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', blankrows: false });
  if (aoa.length < 2) {
    showToast('File không có dữ liệu (cần ít nhất 1 dòng header + 1 dòng dữ liệu)', 'warning');
    return;
  }

  const headers = aoa[0].map(String);
  const objRows = aoa.slice(1)
    .map(row => {
      const obj = {};
      headers.forEach((h, i) => { obj[h] = serializeCell(row[i]); });
      return obj;
    })
    .filter(obj => Object.values(obj).some(v => v !== ''));

  const inserts = [], updates = [];
  // STT có thể là số (bản ghi cũ) hoặc mã chữ-số (TD-260926-A3F9) — có STT là cập nhật
  for (const row of objRows) {
    const stt = String(row['STT'] ?? '').trim();
    if (stt !== '') {
      updates.push({ stt, row });
    } else {
      inserts.push({ row });
    }
  }

  importState = { type, inserts, updates };

  const schema = SCHEMAS[type];
  document.getElementById('import-summary').innerHTML =
    `Loại: <strong>${escapeHtml(schema.icon + ' ' + schema.name)}</strong> · ` +
    `Tab: <strong>${escapeHtml(sheetName)}</strong> · ` +
    `Tổng: <strong>${objRows.length}</strong> dòng · ` +
    `<span class="text-green-700">➕ ${inserts.length} thêm mới</span> · ` +
    `<span class="text-orange-600">✏️ ${updates.length} cập nhật</span>`;

  const previewCols = headers.slice(0, 7);
  let html = '<thead class="bg-gray-100"><tr>' +
    '<th class="px-2 py-1 text-left text-xs text-gray-600 font-medium whitespace-nowrap">Trạng thái</th>';
  previewCols.forEach(h => {
    html += `<th class="px-2 py-1 text-left text-xs text-gray-600 font-medium whitespace-nowrap">${escapeHtml(h)}</th>`;
  });
  html += '</tr></thead><tbody>';

  objRows.slice(0, 20).forEach(row => {
    const isUpdate = String(row['STT'] ?? '').trim() !== '';
    const badge = isUpdate
      ? `<span class="bg-orange-100 text-orange-700 px-1 rounded text-xs whitespace-nowrap">✏️ #${escapeHtml(String(row['STT']))}</span>`
      : `<span class="bg-green-100 text-green-700 px-1 rounded text-xs">➕ Mới</span>`;
    html += '<tr class="border-t border-gray-100">';
    html += `<td class="px-2 py-1">${badge}</td>`;
    previewCols.forEach(h => {
      const v = String(row[h] || '');
      html += `<td class="px-2 py-1 text-xs text-gray-700 max-w-[110px] truncate" title="${escapeHtml(v)}">${escapeHtml(v.substring(0, 40))}</td>`;
    });
    html += '</tr>';
  });
  if (objRows.length > 20) {
    html += `<tr><td colspan="${previewCols.length + 1}" class="px-2 py-1 text-xs text-gray-400 text-center italic">... và ${objRows.length - 20} dòng nữa</td></tr>`;
  }
  html += '</tbody>';

  document.getElementById('import-table').innerHTML = html;
  document.getElementById('import-preview').classList.remove('hidden');
  document.getElementById('btn-import-run').classList.remove('hidden');
}

async function runImport() {
  const { type, inserts, updates } = importState;
  if (!type || (!inserts.length && !updates.length)) {
    showToast('Không có dữ liệu để import', 'warning');
    return;
  }
  if (!confirm(`Xác nhận import?\n• ${inserts.length} dòng thêm mới\n• ${updates.length} dòng cập nhật\n\nThao tác không thể hoàn tác!`)) return;

  const btn = document.getElementById('btn-import-run');
  const progress = document.getElementById('import-progress');
  btn.disabled = true;
  progress.classList.remove('hidden');

  let successInsert = 0, successUpdate = 0, failedUpdate = 0;

  try {
    if (inserts.length > 0) {
      progress.textContent = `Đang thêm ${inserts.length} bản ghi mới...`;
      const res = await apiBulkImport(type, inserts.map(i => i.row));
      successInsert = res.inserted || inserts.length;
    }

    for (let i = 0; i < updates.length; i++) {
      const { stt, row } = updates[i];
      progress.textContent = `Đang cập nhật ${i + 1}/${updates.length} (STT #${stt})...`;
      try {
        const cleanRow = Object.assign({}, row);
        IMPORT_SKIP.forEach(k => delete cleanRow[k]);
        await apiUpdate(type, stt, cleanRow, undefined);
        successUpdate++;
      } catch (e) {
        failedUpdate++;
        console.error('Update STT', stt, 'lỗi:', e.message);
      }
    }

    const failNote = failedUpdate > 0 ? `, ${failedUpdate} cập nhật thất bại` : '';
    progress.textContent = `Hoàn tất: +${successInsert} mới, ✏️ ${successUpdate} cập nhật${failNote}`;
    showToast(
      `Import xong: +${successInsert} mới, ${successUpdate} cập nhật` + (failedUpdate > 0 ? `, ${failedUpdate} lỗi` : ''),
      failedUpdate > 0 ? 'warning' : 'success', 4000
    );
  } catch (e) {
    progress.textContent = 'Lỗi: ' + e.message;
    showToast('Import thất bại: ' + e.message, 'error');
  } finally {
    btn.disabled = false;
  }
}
