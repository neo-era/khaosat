// js/manage.js — Logic trang quản lý bản ghi: filter, xoá/khôi phục, lightbox.

import { apiList, apiDelete, apiRestore, apiSetStatus } from './api.js';
import { SCHEMAS, SCHEMA_KEYS, XU_LY_STATUSES, XU_LY_SKIP_TYPES } from './schemas.js';
import { hasPermission } from './auth.js';
import { showToast, escapeHtml, formatVnDate, formatVnDateOnly } from './utils.js';

const state = {
  rows: [],
  page: 0,
  pageSize: 50,
  search: ''
};

export async function initManage(taikhoanUsers = []) {
  // Populate filters
  const typeSel = document.getElementById('filter-type');
  for (const k of SCHEMA_KEYS) {
    const opt = document.createElement('option');
    opt.value = k;
    opt.textContent = SCHEMAS[k].icon + ' ' + SCHEMAS[k].name;
    typeSel.appendChild(opt);
  }

  const xlSel = document.getElementById('filter-xuly');
  for (const st of [...XU_LY_STATUSES, 'Chưa cập nhật']) {
    const opt = document.createElement('option');
    opt.value = st;
    opt.textContent = st;
    xlSel.appendChild(opt);
  }
  xlSel.addEventListener('change', () => { state.page = 0; renderTable(); });

  const userSel = document.getElementById('filter-user');
  for (const u of taikhoanUsers) {
    const opt = document.createElement('option');
    opt.value = u.username;
    opt.textContent = u.full_name + ' (@' + u.username + ')';
    userSel.appendChild(opt);
  }

  // Default date range = last 30 days
  const now = new Date();
  const past = new Date(now.getTime() - 30 * 86400000);
  document.getElementById('filter-from').value = past.toISOString().slice(0, 10);
  document.getElementById('filter-to').value = now.toISOString().slice(0, 10);

  document.getElementById('btn-search').onclick = doSearch;
  document.getElementById('filter-search').addEventListener('keydown', e => {
    if (e.key === 'Enter') doSearch();
  });

  // Auto-search lần đầu
  await doSearch();
}

async function doSearch() {
  const type = document.getElementById('filter-type').value;
  const username = document.getElementById('filter-user').value;
  const from = document.getElementById('filter-from').value;
  const to = document.getElementById('filter-to').value;
  const status = document.getElementById('filter-status').value;
  state.search = document.getElementById('filter-search').value.trim().toLowerCase();
  state.page = 0;

  const loading = document.getElementById('loading');
  loading.classList.remove('hidden');
  document.getElementById('result-tbody').innerHTML = '';

  try {
    const res = await apiList({
      type: type || undefined,
      username: username || undefined,
      from: from || undefined,
      to: to ? to + 'T23:59:59' : undefined,
      status
    });
    state.rows = res.rows || [];
    renderTable();
  } catch (e) {
    showToast('Lỗi tải danh sách: ' + e.message, 'error', 4000);
  } finally {
    loading.classList.add('hidden');
  }
}

function renderTable() {
  const tbody = document.getElementById('result-tbody');
  tbody.innerHTML = '';
  // Filter free-text
  let filtered = state.rows;
  if (state.search) {
    filtered = filtered.filter(r => {
      const tuyen = String(r['Tuyến đường'] || '').toLowerCase();
      const ghichu = String(r['Ghi chú'] || '').toLowerCase();
      const ghichu2 = String(r['Ghi chú (kèm thay cần đèn,...)'] || '').toLowerCase();
      const vitri = String(r['Vị trí'] || '').toLowerCase();
      return tuyen.includes(state.search) || ghichu.includes(state.search) ||
             ghichu2.includes(state.search) || vitri.includes(state.search);
    });
  }

  const xl = document.getElementById('filter-xuly').value;
  if (xl) filtered = filtered.filter(r => !XU_LY_SKIP_TYPES.includes(r._type) && xuLyOf(r) === xl);

  document.getElementById('result-count').textContent = `${filtered.length} kết quả`;

  const start = state.page * state.pageSize;
  const pageRows = filtered.slice(start, start + state.pageSize);

  for (const r of pageRows) {
    const tr = document.createElement('tr');
    tr.className = 'border-b hover:bg-blue-50';
    const isDeleted = !!r['Deleted At'];
    if (isDeleted) tr.className += ' bg-gray-100 text-gray-500';
    const schema = SCHEMAS[r._type];
    const photos = String(r['Ảnh (URLs)'] || '').split('|').filter(u => u);
    tr.innerHTML = `
      <td class="px-2 py-2 text-center font-mono text-xs whitespace-nowrap">${escapeHtml(String(r['STT']))}</td>
      <td class="px-2 py-2 text-sm" title="${escapeHtml(schema ? schema.name : r._type)}">${schema ? schema.icon : '📋'}</td>
      <td class="px-2 py-2 text-sm truncate max-w-[180px]" title="${escapeHtml(r['Tuyến đường'] || r['Vị trí'] || '')}">${escapeHtml(r['Tuyến đường'] || r['Vị trí'] || '—')}</td>
      <td class="px-2 py-2 text-xs">${escapeHtml(r['Username'] || '')}</td>
      <td class="px-2 py-2 text-xs whitespace-nowrap">${escapeHtml(r['Submitted At'] ? formatVnDateOnly(r['Submitted At']) : '')}</td>
      <td class="px-2 py-2 text-center">
        ${photos.length > 0 ? `<button class="text-xs bg-gray-100 px-2 py-1 rounded" data-photos='${escapeHtml(JSON.stringify(photos))}'>📷 ${photos.length}</button>` : '—'}
      </td>
      <td class="px-2 py-2 text-xs text-center td-xuly"></td>
      <td class="px-2 py-2 text-xs text-center">
        ${isDeleted
          ? `<span class="text-red-600">Đã xoá<br>${formatVnDateOnly(r['Deleted At'])}<br>bởi ${escapeHtml(r['Deleted By'] || '')}</span>`
          : `<span class="text-green-700">Hoạt động</span>`}
      </td>
      <td class="px-2 py-2 text-right whitespace-nowrap">
        <button class="text-xs px-2 py-1 bg-blue-50 text-blue-700 rounded mr-1 btn-view">Xem</button>
        ${!isDeleted && hasPermission('edit')
          ? `<button class="text-xs px-2 py-1 bg-yellow-50 text-yellow-700 rounded mr-1 btn-edit">Sửa</button>`
          : ''}
        ${isDeleted
          ? `<button class="text-xs px-2 py-1 bg-green-50 text-green-700 rounded btn-restore">Khôi phục</button>`
          : `<button class="text-xs px-2 py-1 bg-red-50 text-red-700 rounded btn-delete">Xoá</button>`}
      </td>
    `;
    renderXuLyCell(tr.querySelector('.td-xuly'), r, isDeleted);
    // Bind events
    tr.querySelector('.btn-view').onclick = () => openDetail(r);
    const photoBtn = tr.querySelector('[data-photos]');
    if (photoBtn) photoBtn.onclick = () => openLightbox(JSON.parse(photoBtn.dataset.photos));
    const editBtn = tr.querySelector('.btn-edit');
    if (editBtn) editBtn.onclick = () => {
      location.href = 'form.html?type=' + encodeURIComponent(r._type) + '&edit=' + encodeURIComponent(r['STT']);
    };
    const delBtn = tr.querySelector('.btn-delete');
    if (delBtn) delBtn.onclick = () => confirmDelete(r);
    const resBtn = tr.querySelector('.btn-restore');
    if (resBtn) resBtn.onclick = () => doRestore(r);
    tbody.appendChild(tr);
  }

  // Pagination
  const totalPages = Math.ceil(filtered.length / state.pageSize) || 1;
  const pagi = document.getElementById('pagination');
  pagi.innerHTML = '';
  if (totalPages > 1) {
    for (let p = 0; p < totalPages; p++) {
      const btn = document.createElement('button');
      btn.textContent = p + 1;
      btn.className = 'px-3 py-1 rounded ' + (p === state.page ? 'bg-blue-700 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200');
      btn.onclick = () => { state.page = p; renderTable(); };
      pagi.appendChild(btn);
    }
  }
}

const XU_LY_COLOR = {
  'Chờ thiết kế': 'bg-yellow-50 text-yellow-800 border-yellow-300',
  'Đã thiết kế': 'bg-blue-50 text-blue-800 border-blue-300',
  'Đã thi công': 'bg-indigo-50 text-indigo-800 border-indigo-300',
  'Nghiệm thu': 'bg-green-50 text-green-800 border-green-300',
  'Không xử lý': 'bg-gray-100 text-gray-600 border-gray-300',
  'Chưa cập nhật': 'bg-white text-gray-400 border-gray-200'
};

function xuLyOf(r) {
  return String(r['Trạng thái xử lý'] || '').trim() || 'Chưa cập nhật';
}

/** Ô "Xử lý": có quyền sửa → chọn đổi ngay; không → nhãn màu. Băng rôn không áp dụng. */
function renderXuLyCell(td, r, isDeleted) {
  if (XU_LY_SKIP_TYPES.includes(r._type)) { td.textContent = '—'; return; }
  const cur = xuLyOf(r);
  const cls = 'border rounded px-1 text-xs ' + (XU_LY_COLOR[cur] || '');
  const upd = r['Cập nhật trạng thái'] ? String(r['Cập nhật trạng thái']) : '';
  if (isDeleted || !hasPermission('edit')) {
    td.innerHTML = `<span class="${cls} inline-block py-1">${escapeHtml(cur)}</span>` +
      (upd ? `<div class="text-[10px] text-gray-400 mt-1">${escapeHtml(upd)}</div>` : '');
    return;
  }
  const sel = document.createElement('select');
  sel.className = cls;
  sel.style.minHeight = '36px';
  sel.innerHTML = (cur === 'Chưa cập nhật' ? '<option value="">Chưa cập nhật</option>' : '') +
    XU_LY_STATUSES.map(s => `<option ${s === cur ? 'selected' : ''}>${escapeHtml(s)}</option>`).join('');
  sel.title = upd || 'Chưa đổi lần nào';
  sel.onchange = async () => {
    const status = sel.value;
    if (!status) return;
    const note = prompt(`Đổi "${cur}" → "${status}" cho STT #${r['STT']}.\nGhi chú (không bắt buộc, vd số hồ sơ thiết kế):`, '');
    if (note === null) { sel.value = cur === 'Chưa cập nhật' ? '' : cur; return; }
    sel.disabled = true;
    try {
      const res = await apiSetStatus(r._type, [r['STT']], status, note);
      r['Trạng thái xử lý'] = status;
      r['Cập nhật trạng thái'] = res.stamp || '';
      showToast(`Đã chuyển STT #${r['STT']} sang "${status}"`, 'success');
      renderXuLyCell(td, r, isDeleted);
    } catch (e) {
      showToast('Lỗi đổi trạng thái: ' + e.message, 'error', 5000);
      sel.value = cur === 'Chưa cập nhật' ? '' : cur;
      sel.disabled = false;
    }
  };
  td.innerHTML = '';
  td.appendChild(sel);
  if (upd) {
    const d = document.createElement('div');
    d.className = 'text-[10px] text-gray-400 mt-1';
    d.textContent = upd;
    td.appendChild(d);
  }
}

function openDetail(r) {
  const modal = document.getElementById('detail-modal');
  const schema = SCHEMAS[r._type];
  document.getElementById('detail-title').textContent = `${schema ? schema.icon : '📋'} ${schema ? schema.name : r._type} — STT #${r['STT']}`;
  const body = document.getElementById('detail-body');
  body.innerHTML = '';
  const dl = document.createElement('dl');
  dl.className = 'space-y-2';
  for (const [label, value] of Object.entries(r)) {
    if (label.startsWith('_')) continue;
    if (value === '' || value === null || value === undefined) continue;
    const row = document.createElement('div');
    row.className = 'border-b border-gray-100 pb-1';
    row.innerHTML = `
      <dt class="text-xs text-gray-500">${escapeHtml(label)}</dt>
      <dd class="text-sm text-gray-800 break-words">${escapeHtml(String(value))}</dd>
    `;
    dl.appendChild(row);
  }
  body.appendChild(dl);
  modal.classList.remove('hidden');
}

function openLightbox(urls) {
  const lb = document.getElementById('lightbox');
  const grid = document.getElementById('lightbox-grid');
  grid.innerHTML = '';
  for (const u of urls) {
    const img = document.createElement('img');
    img.src = u;
    img.className = 'w-full rounded-lg shadow';
    img.onclick = () => window.open(u, '_blank');
    grid.appendChild(img);
  }
  lb.classList.remove('hidden');
}

async function confirmDelete(r) {
  const schema = SCHEMAS[r._type];
  const photos = String(r['Ảnh (URLs)'] || '').split('|').filter(u => u);
  const msg = `Xoá bản ghi STT #${r['STT']} của loại "${schema ? schema.name : r._type}"?\n\n` +
    `• Dữ liệu sẽ được đánh dấu xoá (có thể khôi phục).\n` +
    `• ${photos.length} ảnh đính kèm sẽ bị XOÁ VĨNH VIỄN khỏi Cloudinary, KHÔNG khôi phục được.`;
  if (!confirm(msg)) return;
  try {
    await apiDelete(r._type, r['STT']);
    showToast('Đã xoá STT #' + r['STT'], 'success');
    await doSearch();
  } catch (e) {
    showToast('Lỗi xoá: ' + e.message, 'error', 4000);
  }
}

async function doRestore(r) {
  if (!confirm(`Khôi phục bản ghi STT #${r['STT']}? Ảnh đính kèm KHÔNG khôi phục được.`)) return;
  try {
    await apiRestore(r._type, r['STT']);
    showToast('Đã khôi phục STT #' + r['STT'] + ' (ảnh vẫn mất)', 'success');
    await doSearch();
  } catch (e) {
    showToast('Lỗi khôi phục: ' + e.message, 'error', 4000);
  }
}
