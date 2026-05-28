// js/map.js — Bản đồ vị trí GPS các bản KS qua Leaflet + OpenStreetMap.

import { apiList, apiUsers } from './api.js';
import { SCHEMAS, SCHEMA_KEYS } from './schemas.js';
import { hasPermission } from './auth.js';
import { showToast, escapeHtml, formatVnDateOnly } from './utils.js';

// Trung tâm TP.HCM
const CENTER = [10.7769, 106.7009];
const DEFAULT_ZOOM = 11;

const state = {
  user: null,
  map: null,
  cluster: null
};

export async function initMap(user) {
  state.user = user;
  buildTypeFilter();
  // Date default = 30 ngày gần đây
  const now = new Date();
  const past = new Date(now.getTime() - 30 * 86400000);
  document.getElementById('filter-from').value = past.toISOString().slice(0, 10);
  document.getElementById('filter-to').value = now.toISOString().slice(0, 10);

  // Init Leaflet map
  state.map = L.map('map', { zoomControl: true }).setView(CENTER, DEFAULT_ZOOM);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors',
    maxZoom: 19
  }).addTo(state.map);
  state.cluster = L.markerClusterGroup({
    chunkedLoading: true,
    spiderfyOnMaxZoom: true,
    showCoverageOnHover: false
  });
  state.map.addLayer(state.cluster);

  // Populate KTV filter nếu admin/user (user1 chỉ thấy của mình → ẩn dropdown)
  if (hasPermission('manage') || hasPermission('report')) {
    try {
      const u = await apiUsers();
      const sel = document.getElementById('filter-user');
      for (const x of (u.users || [])) {
        if (x.role === 'demo') continue;
        const o = document.createElement('option');
        o.value = x.username;
        o.textContent = x.full_name + ' (@' + x.username + ')';
        sel.appendChild(o);
      }
    } catch (e) { /* fallback empty */ }
  } else {
    // user1 → ẩn dropdown KTV (server tự filter own)
    const sel = document.getElementById('filter-user');
    if (sel) sel.style.display = 'none';
  }

  document.getElementById('btn-load').onclick = loadMarkers;
  await loadMarkers();
}

function buildTypeFilter() {
  const sel = document.getElementById('filter-type');
  for (const k of SCHEMA_KEYS) {
    const o = document.createElement('option');
    o.value = k;
    o.textContent = SCHEMAS[k].icon + ' ' + SCHEMAS[k].name;
    sel.appendChild(o);
  }
}

async function loadMarkers() {
  const type = document.getElementById('filter-type').value;
  const username = document.getElementById('filter-user').value;
  const from = document.getElementById('filter-from').value;
  const to = document.getElementById('filter-to').value;
  const status = document.getElementById('filter-status').value;

  document.getElementById('loading').classList.remove('hidden');
  state.cluster.clearLayers();

  try {
    const res = await apiList({
      type: type || undefined,
      username: username || undefined,
      from: from || undefined,
      to: to ? to + 'T23:59:59' : undefined,
      status
    });
    const rows = res.rows || [];

    let count = 0;
    const bounds = [];

    for (const r of rows) {
      const lat = parseFloat(r['vĩ độ']);
      const lng = parseFloat(r['kinh độ']);
      if (!isFinite(lat) || !isFinite(lng)) continue;
      if (lat === 0 && lng === 0) continue;

      const t = r._type;
      const sc = SCHEMAS[t];
      const isDeleted = !!r['Deleted At'];
      const icon = L.divIcon({
        className: 'ks-marker' + (isDeleted ? ' deleted' : ''),
        html: sc ? sc.icon : '📋',
        iconSize: [36, 36],
        iconAnchor: [18, 18]
      });
      const marker = L.marker([lat, lng], { icon });
      marker.bindPopup(buildPopup(r));
      marker.on('popupopen', (e) => {
        // Nút "Mở chi tiết" trong popup
        const btn = e.popup.getElement().querySelector('.btn-detail');
        if (btn) btn.onclick = () => openDetail(r);
      });
      state.cluster.addLayer(marker);
      bounds.push([lat, lng]);
      count++;
    }

    document.getElementById('marker-count').textContent = count + ' bản ghi';

    // Auto-fit nếu có marker
    if (bounds.length > 0) {
      state.map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
    }
    if (count === 0) {
      showToast('Không có bản ghi nào với filter này (hoặc không có GPS)', 'info');
    }
  } catch (e) {
    showToast('Lỗi tải bản đồ: ' + e.message, 'error', 4000);
  } finally {
    document.getElementById('loading').classList.add('hidden');
  }
}

function buildPopup(r) {
  const sc = SCHEMAS[r._type];
  const tuyen = String(r['Tuyến đường'] || r['Vị trí'] || '—');
  const ktv = String(r['Người khảo sát'] || r['Username'] || '?');
  const date = r['Submitted At'] ? formatVnDateOnly(r['Submitted At']) : '';
  const isDeleted = !!r['Deleted At'];
  return `
    <div style="min-width:200px">
      <div style="font-size:14px; font-weight:600; margin-bottom:4px">
        ${escapeHtml(sc ? sc.icon : '📋')} ${escapeHtml(sc ? sc.name : r._type)}
      </div>
      <div style="font-size:12px; color:#666; margin-bottom:2px">STT #${escapeHtml(String(r['STT']))} ${isDeleted ? '<span style="color:#dc2626">· đã xoá</span>' : ''}</div>
      <div style="font-size:12px; margin-bottom:2px"><strong>Tuyến:</strong> ${escapeHtml(tuyen)}</div>
      <div style="font-size:12px; margin-bottom:2px"><strong>KTV:</strong> ${escapeHtml(ktv)}</div>
      <div style="font-size:11px; color:#888; margin-bottom:6px">${escapeHtml(date)}</div>
      <button class="btn-detail" style="background:#1d4ed8; color:white; padding:6px 12px; border-radius:6px; border:none; cursor:pointer; font-size:12px">Xem chi tiết</button>
    </div>
  `;
}

function openDetail(r) {
  const sc = SCHEMAS[r._type];
  document.getElementById('detail-title').textContent = (sc ? sc.icon : '📋') + ' ' + (sc ? sc.name : r._type) + ' — STT #' + r['STT'];
  const body = document.getElementById('detail-body');
  body.innerHTML = '';
  const dl = document.createElement('dl');
  dl.className = 'space-y-2';
  for (const [label, value] of Object.entries(r)) {
    if (label.startsWith('_')) continue;
    if (value === '' || value === null || value === undefined) continue;
    const row = document.createElement('div');
    row.className = 'border-b border-gray-100 pb-1';
    let valHtml = escapeHtml(String(value));
    // Nếu là URL ảnh Cloudinary → render mini thumbnail
    if (label === 'Ảnh (URLs)' && /https?:/.test(String(value))) {
      valHtml = String(value).split('|').filter(u => u).map(u =>
        `<a href="${escapeHtml(u)}" target="_blank"><img src="${escapeHtml(u)}" style="max-width:100px; max-height:100px; display:inline-block; margin:2px; border-radius:4px"></a>`
      ).join('');
    } else if ((label === 'Bản vẽ' || label === 'link' || label === 'Link Google Map') && /^https?:/.test(String(value))) {
      valHtml = `<a href="${escapeHtml(String(value))}" target="_blank" style="color:#1d4ed8; text-decoration:underline">${escapeHtml(String(value).slice(0, 60))}...</a>`;
    }
    row.innerHTML = `
      <dt class="text-xs text-gray-500">${escapeHtml(label)}</dt>
      <dd class="text-sm text-gray-800 break-words">${valHtml}</dd>
    `;
    dl.appendChild(row);
  }
  body.appendChild(dl);
  document.getElementById('detail-modal').classList.remove('hidden');
}
