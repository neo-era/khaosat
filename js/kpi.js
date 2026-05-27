// js/kpi.js — Logic trang KPI: gọi apiKpi, render bảng, export CSV, drill-down chart.

import { apiKpi, apiList } from './api.js';
import { SCHEMAS } from './schemas.js';
import { showToast, escapeHtml, formatVnDate } from './utils.js';

const state = {
  month: null,        // "YYYY-MM"
  results: [],
  targets: null,
  sortKey: 'total',
  sortDesc: true
};

/** Khởi tạo trang. */
export async function initKpi() {
  // Default = tháng hiện tại
  const now = new Date();
  state.month = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
  buildMonthOptions();
  document.getElementById('month-select').value = state.month;

  document.getElementById('btn-load').onclick = loadKpi;
  document.getElementById('btn-export').onclick = exportCsv;

  // Tự load tháng hiện tại
  await loadKpi();
}

function buildMonthOptions() {
  const sel = document.getElementById('month-select');
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
    const label = ('0' + (d.getMonth() + 1)).slice(-2) + '/' + d.getFullYear();
    const opt = document.createElement('option');
    opt.value = key;
    opt.textContent = 'Tháng ' + label;
    sel.appendChild(opt);
  }
}

async function loadKpi() {
  const month = document.getElementById('month-select').value;
  state.month = month;
  const tbody = document.getElementById('kpi-tbody');
  const loading = document.getElementById('loading');
  loading.classList.remove('hidden');
  tbody.innerHTML = '';
  try {
    const res = await apiKpi(month);
    state.results = res.results || [];
    state.targets = res.targets || {};
    renderTable();
    document.getElementById('btn-export').disabled = state.results.length === 0;
  } catch (e) {
    showToast('Lỗi tải KPI: ' + e.message, 'error', 4000);
  } finally {
    loading.classList.add('hidden');
  }
}

function renderTable() {
  const tbody = document.getElementById('kpi-tbody');
  tbody.innerHTML = '';
  const summary = document.getElementById('summary');
  if (state.results.length === 0) {
    summary.textContent = 'Tháng ' + state.month + ': không có bản ghi nào.';
    return;
  }
  summary.textContent = `Tháng ${state.month}: ${state.results.length} KTV — Tổng ${state.results.reduce((s, r) => s + r.count, 0)} bản ghi`;

  // Sort
  const sorted = [...state.results].sort((a, b) => {
    const va = a[state.sortKey], vb = b[state.sortKey];
    if (typeof va === 'string') {
      return state.sortDesc ? String(vb).localeCompare(String(va), 'vi') : String(va).localeCompare(String(vb), 'vi');
    }
    return state.sortDesc ? (vb - va) : (va - vb);
  });

  for (const r of sorted) {
    const tr = document.createElement('tr');
    tr.className = 'border-b hover:bg-blue-50 cursor-pointer';
    tr.innerHTML = `
      <td class="px-2 py-2 text-sm">${escapeHtml(r.username)}</td>
      <td class="px-2 py-2 text-sm font-medium">${escapeHtml(r.full_name)}</td>
      <td class="px-2 py-2 text-center font-mono">${r.count}</td>
      <td class="px-2 py-2 text-right text-xs font-mono">${r.frequency}</td>
      <td class="px-2 py-2 text-right text-xs font-mono">${r.quality}</td>
      <td class="px-2 py-2 text-right text-xs font-mono">${r.diversity}</td>
      <td class="px-2 py-2 text-right text-xs font-mono">${r.completeness}</td>
      <td class="px-2 py-2 text-right text-xs font-mono">${r.stability}</td>
      <td class="px-2 py-2 text-right font-bold font-mono">${r.total}</td>
      <td class="px-2 py-2 text-center"><span class="inline-block px-2 py-0.5 rounded-full text-xs font-bold ${gradeColor(r.grade)}">${r.grade}</span></td>
    `;
    tr.onclick = () => openDetail(r);
    tbody.appendChild(tr);
  }
}

function gradeColor(g) {
  if (g === 'A') return 'bg-green-600 text-white';
  if (g === 'B') return 'bg-blue-500 text-white';
  if (g === 'C') return 'bg-yellow-500 text-white';
  return 'bg-red-600 text-white';
}

/** Sort khi click header. */
export function sortBy(key) {
  if (state.sortKey === key) state.sortDesc = !state.sortDesc;
  else { state.sortKey = key; state.sortDesc = true; }
  renderTable();
}

async function openDetail(r) {
  const modal = document.getElementById('detail-modal');
  document.getElementById('detail-title').textContent = `${r.full_name} (@${r.username}) — Tháng ${state.month}`;
  const body = document.getElementById('detail-body');
  body.innerHTML = '<div class="text-center text-gray-500 py-4">Đang tải chi tiết...</div>';
  modal.classList.remove('hidden');

  // Tóm tắt + chart
  const summary = `
    <div class="grid grid-cols-2 gap-2 mb-4">
      <div class="bg-gray-50 p-3 rounded"><div class="text-xs text-gray-500">Số bản</div><div class="text-xl font-bold">${r.count}</div></div>
      <div class="bg-gray-50 p-3 rounded"><div class="text-xs text-gray-500">Tổng KPI</div><div class="text-xl font-bold">${r.total} <span class="text-sm">(${r.grade})</span></div></div>
      <div class="bg-gray-50 p-3 rounded"><div class="text-xs text-gray-500">Tần suất (40%)</div><div class="text-base font-mono">${r.frequency}</div></div>
      <div class="bg-gray-50 p-3 rounded"><div class="text-xs text-gray-500">Chất lượng (30%)</div><div class="text-base font-mono">${r.quality}</div></div>
      <div class="bg-gray-50 p-3 rounded"><div class="text-xs text-gray-500">Đa dạng (15%)</div><div class="text-base font-mono">${r.diversity}</div></div>
      <div class="bg-gray-50 p-3 rounded"><div class="text-xs text-gray-500">Đầy đủ (10%)</div><div class="text-base font-mono">${r.completeness}</div></div>
      <div class="bg-gray-50 p-3 rounded col-span-2"><div class="text-xs text-gray-500">Ổn định (5%)</div><div class="text-base font-mono">${r.stability}</div></div>
    </div>
    <div id="chart-container" class="mt-4"></div>
    <div id="detail-records" class="mt-4"></div>
  `;
  body.innerHTML = summary;

  // Gọi apiList lấy records của KTV này trong tháng để vẽ chart theo ngày
  try {
    const from = state.month + '-01';
    const lastDay = new Date(parseInt(state.month.slice(0, 4)), parseInt(state.month.slice(5, 7)), 0).getDate();
    const to = state.month + '-' + String(lastDay).padStart(2, '0') + 'T23:59:59';
    const listRes = await apiList({ username: r.username, from, to, status: 'active' });
    const rows = listRes.rows || [];
    renderDailyChart(rows, lastDay);
    renderRecordsList(rows);
  } catch (e) {
    document.getElementById('chart-container').innerHTML = '<p class="text-xs text-red-600">Không tải được chi tiết: ' + escapeHtml(e.message) + '</p>';
  }
}

/** Vẽ biểu đồ cột số bản theo ngày trong tháng (SVG vanilla). */
function renderDailyChart(rows, daysInMonth) {
  const counts = new Array(daysInMonth).fill(0);
  for (const r of rows) {
    const sa = r['Submitted At'];
    if (!sa) continue;
    const d = new Date(sa);
    const day = d.getDate();
    if (day >= 1 && day <= daysInMonth) counts[day - 1]++;
  }
  const max = Math.max(1, ...counts);
  const w = 600, h = 140, padL = 30, padB = 24, padT = 10;
  const innerW = w - padL;
  const innerH = h - padB - padT;
  const barW = innerW / daysInMonth - 1;

  let bars = '';
  for (let i = 0; i < daysInMonth; i++) {
    const x = padL + i * (innerW / daysInMonth);
    const bh = (counts[i] / max) * innerH;
    const y = padT + innerH - bh;
    bars += `<rect x="${x}" y="${y}" width="${barW}" height="${bh}" fill="#1d4ed8" rx="1"><title>Ngày ${i + 1}: ${counts[i]} bản</title></rect>`;
    if (counts[i] > 0) {
      bars += `<text x="${x + barW / 2}" y="${y - 2}" text-anchor="middle" font-size="9" fill="#1d4ed8">${counts[i]}</text>`;
    }
  }
  // Trục X
  let xticks = '';
  for (let i = 0; i < daysInMonth; i += 5) {
    const x = padL + i * (innerW / daysInMonth) + barW / 2;
    xticks += `<text x="${x}" y="${h - 6}" text-anchor="middle" font-size="10" fill="#6b7280">${i + 1}</text>`;
  }
  // Trục Y (max)
  const yTicks = `<text x="${padL - 5}" y="${padT + 10}" text-anchor="end" font-size="10" fill="#6b7280">${max}</text>
                  <text x="${padL - 5}" y="${padT + innerH}" text-anchor="end" font-size="10" fill="#6b7280">0</text>`;

  const svg = `
    <div class="text-xs text-gray-600 mb-1">Phân bố theo ngày trong tháng</div>
    <svg viewBox="0 0 ${w} ${h}" class="w-full bg-white border rounded">
      ${yTicks}
      ${bars}
      ${xticks}
    </svg>
  `;
  document.getElementById('chart-container').innerHTML = svg;
}

function renderRecordsList(rows) {
  const div = document.getElementById('detail-records');
  if (rows.length === 0) {
    div.innerHTML = '<p class="text-xs text-gray-500 mt-3">Không có bản ghi.</p>';
    return;
  }
  // Group theo loại
  const byType = {};
  for (const r of rows) {
    const t = r._type;
    if (!byType[t]) byType[t] = 0;
    byType[t]++;
  }
  let html = '<div class="text-xs text-gray-600 mb-2 mt-3">Phân bố theo loại:</div><div class="grid grid-cols-2 gap-1 text-xs">';
  for (const [t, c] of Object.entries(byType).sort((a, b) => b[1] - a[1])) {
    const s = SCHEMAS[t];
    html += `<div class="bg-gray-50 p-2 rounded flex items-center gap-2"><span>${s ? s.icon : '📋'}</span><span class="flex-1 truncate">${escapeHtml(s ? s.name : t)}</span><span class="font-mono">${c}</span></div>`;
  }
  html += '</div>';
  div.innerHTML = html;
}

/** Export CSV bảng KPI hiện tại. */
function exportCsv() {
  if (state.results.length === 0) return;
  const header = ['username', 'full_name', 'count', 'frequency', 'quality', 'diversity', 'completeness', 'stability', 'total', 'grade'];
  const rows = state.results.map(r => header.map(k => csvEscape(r[k])));
  const csv = [header.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `kpi-${state.month}.csv`;
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
