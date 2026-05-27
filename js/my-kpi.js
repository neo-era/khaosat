// js/my-kpi.js — KPI cá nhân: gọi apiKpi, render KPI của chính user (server đã tự filter).

import { apiKpi, apiList } from './api.js';
import { SCHEMAS } from './schemas.js';
import { showToast, escapeHtml } from './utils.js';

const state = {
  month: null,
  user: null
};

export async function initMyKpi(user) {
  state.user = user;
  const now = new Date();
  state.month = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
  buildMonthOptions();
  document.getElementById('month-select').value = state.month;
  document.getElementById('btn-load').onclick = loadMyKpi;
  await loadMyKpi();
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

async function loadMyKpi() {
  state.month = document.getElementById('month-select').value;
  const loading = document.getElementById('loading');
  loading.classList.remove('hidden');
  document.getElementById('summary-wrap').classList.add('hidden');
  document.getElementById('empty-state').classList.add('hidden');

  try {
    const res = await apiKpi(state.month);
    const me = (res.results || []).find(r => r.username === state.user.username);
    if (!me || me.count === 0) {
      document.getElementById('empty-state').classList.remove('hidden');
    } else {
      renderSummary(me, res.targets || {});
      // Lấy chi tiết để vẽ chart + phân loại
      await renderDetails(state.month);
    }
  } catch (e) {
    showToast('Lỗi tải KPI: ' + e.message, 'error', 4000);
  } finally {
    loading.classList.add('hidden');
  }
}

function renderSummary(me, targets) {
  document.getElementById('summary-wrap').classList.remove('hidden');

  const gradeColors = { A: 'green-600', B: 'blue-500', C: 'yellow-500', D: 'red-600' };
  const gradeText = { A: 'Xuất sắc', B: 'Tốt', C: 'Đạt', D: 'Cần cải thiện' };
  const color = gradeColors[me.grade] || 'gray-500';

  document.getElementById('overall-card').innerHTML = `
    <div class="text-xs text-gray-500 mb-1">Tháng ${escapeHtml(state.month)}</div>
    <div class="text-5xl font-bold text-${color} mb-1">${me.total}</div>
    <div class="inline-block px-3 py-1 rounded-full text-white font-bold text-sm bg-${color}">
      ${me.grade} — ${gradeText[me.grade] || ''}
    </div>
    <div class="text-sm text-gray-600 mt-2">${me.count} bản ghi trong tháng</div>
  `;

  document.getElementById('m-frequency').textContent = me.frequency;
  document.getElementById('m-frequency-detail').textContent = `${me.count} / ${targets.target_submissions_per_month || 50} bản`;

  document.getElementById('m-quality').textContent = me.quality;
  document.getElementById('m-quality-detail').textContent = '% có ảnh + GPS';

  document.getElementById('m-diversity').textContent = me.diversity;
  document.getElementById('m-diversity-detail').textContent = `mục tiêu ${targets.target_distinct_types || 5} loại`;

  document.getElementById('m-completeness').textContent = me.completeness;

  document.getElementById('m-stability').textContent = me.stability;
  document.getElementById('m-stability-detail').textContent = `mục tiêu ${targets.target_active_days || 20} ngày`;
}

async function renderDetails(month) {
  try {
    const from = month + '-01';
    const lastDay = new Date(parseInt(month.slice(0, 4)), parseInt(month.slice(5, 7)), 0).getDate();
    const to = month + '-' + String(lastDay).padStart(2, '0') + 'T23:59:59';
    const res = await apiList({ username: state.user.username, from, to, status: 'active' });
    const rows = res.rows || [];
    renderChart(rows, lastDay);
    renderTypesList(rows);
  } catch (e) {
    document.getElementById('chart-container').innerHTML = '<p class="text-xs text-red-600">Không tải được chi tiết: ' + escapeHtml(e.message) + '</p>';
  }
}

function renderChart(rows, daysInMonth) {
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
  let xticks = '';
  for (let i = 0; i < daysInMonth; i += 5) {
    const x = padL + i * (innerW / daysInMonth) + barW / 2;
    xticks += `<text x="${x}" y="${h - 6}" text-anchor="middle" font-size="10" fill="#6b7280">${i + 1}</text>`;
  }
  const yTicks = `<text x="${padL - 5}" y="${padT + 10}" text-anchor="end" font-size="10" fill="#6b7280">${max}</text>
                  <text x="${padL - 5}" y="${padT + innerH}" text-anchor="end" font-size="10" fill="#6b7280">0</text>`;

  document.getElementById('chart-container').innerHTML = `
    <svg viewBox="0 0 ${w} ${h}" class="w-full bg-white border rounded">
      ${yTicks}
      ${bars}
      ${xticks}
    </svg>
  `;
}

function renderTypesList(rows) {
  const div = document.getElementById('types-list');
  if (rows.length === 0) {
    div.innerHTML = '<p class="text-xs text-gray-500">Chưa có bản ghi.</p>';
    return;
  }
  const byType = {};
  for (const r of rows) {
    const t = r._type;
    if (!byType[t]) byType[t] = 0;
    byType[t]++;
  }
  let html = '<div class="grid grid-cols-2 gap-1 text-xs">';
  for (const [t, c] of Object.entries(byType).sort((a, b) => b[1] - a[1])) {
    const s = SCHEMAS[t];
    html += `<div class="bg-gray-50 p-2 rounded flex items-center gap-2"><span>${s ? s.icon : '📋'}</span><span class="flex-1 truncate">${escapeHtml(s ? s.name : t)}</span><span class="font-mono font-semibold">${c}</span></div>`;
  }
  html += '</div>';
  div.innerHTML = html;
}
