// js/report.js — Trang báo cáo: 3 vùng A bảng tổng quan / B biểu đồ cột chồng / C pivot KTV×Loại.

import { apiReport } from './api.js';
import { SCHEMAS, SCHEMA_KEYS } from './schemas.js';
import { showToast, escapeHtml } from './utils.js';

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

function bindEvents() {
  document.getElementById('btn-load').onclick = loadReport;
  document.getElementById('btn-export').onclick = exportCsv;
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
      from: from || undefined,
      to: to ? to + 'T23:59:59' : undefined,
      status,
      groupBy
    });
    state.data = res;
    renderAreaA(res.areaA || []);
    renderAreaB(res.areaB || [], types);
    renderAreaC(res.areaC || [], types);
    document.getElementById('btn-export').disabled = false;
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
