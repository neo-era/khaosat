// js/schedule.js — Lịch công tác. Admin/user CRUD; user1 chỉ xem + đánh dấu done của mình.

import { apiScheduleList, apiScheduleCreate, apiScheduleUpdate, apiScheduleDelete, apiUsers } from './api.js';
import { SCHEMAS, SCHEMA_KEYS } from './schemas.js';
import { hasPermission } from './auth.js';
import { showToast, escapeHtml, formatVnDateOnly } from './utils.js';

const state = {
  me: null,
  items: [],
  scope: 'self'
};

export async function initSchedule(currentUser) {
  state.me = currentUser;
  const canWrite = hasPermission('schedule_write');

  buildLoaiKsFilter();
  // Default range = từ hôm nay đến 7 ngày
  applyPreset('week');

  // Populate Người khảo sát filter cho admin/user
  if (canWrite) {
    try {
      const u = await apiUsers();
      const sel = document.getElementById('filter-ktv');
      const selAdd = document.getElementById('f-ktv');
      for (const x of (u.users || [])) {
        if (x.role === 'demo') continue;
        const o = document.createElement('option');
        o.value = x.username;
        o.textContent = x.full_name + ' (@' + x.username + ')';
        sel.appendChild(o);
        const o2 = o.cloneNode(true);
        selAdd.appendChild(o2);
      }
    } catch (e) { /* fallback empty */ }
  } else {
    // user1 → ẩn dropdown Người khảo sát (server tự filter own)
    document.getElementById('filter-ktv').style.display = 'none';
  }

  document.querySelectorAll('[data-preset]').forEach(b => {
    b.onclick = () => { applyPreset(b.dataset.preset); loadSchedule(); };
  });
  document.getElementById('btn-load').onclick = loadSchedule;
  const btnAdd = document.getElementById('btn-add');
  if (btnAdd) btnAdd.onclick = openAddDialog;
  document.getElementById('add-form').addEventListener('submit', handleCreate);

  await loadSchedule();
}

function buildLoaiKsFilter() {
  const sel = document.getElementById('f-loaiks');
  for (const k of SCHEMA_KEYS) {
    const o = document.createElement('option');
    o.value = k;
    o.textContent = SCHEMAS[k].icon + ' ' + SCHEMAS[k].name;
    sel.appendChild(o);
  }
}

function applyPreset(p) {
  const today = new Date();
  let from = today, to = today;
  if (p === 'today') {
    // same day
  } else if (p === 'week') {
    to = new Date(today.getTime() + 6 * 86400000);
  } else if (p === 'next-week') {
    from = new Date(today.getTime() + 7 * 86400000);
    to = new Date(today.getTime() + 13 * 86400000);
  } else if (p === 'month') {
    to = new Date(today.getTime() + 29 * 86400000);
  }
  document.getElementById('filter-from').value = from.toISOString().slice(0, 10);
  document.getElementById('filter-to').value = to.toISOString().slice(0, 10);
}

async function loadSchedule() {
  document.getElementById('loading').classList.remove('hidden');
  document.getElementById('result-tbody').innerHTML = '';
  document.getElementById('empty-state').classList.add('hidden');
  try {
    const res = await apiScheduleList({
      from: document.getElementById('filter-from').value || undefined,
      to: document.getElementById('filter-to').value || undefined,
      ktv_username: document.getElementById('filter-ktv').value || undefined,
      status: document.getElementById('filter-status').value || undefined
    });
    state.items = res.items || [];
    state.scope = res.scope;
    renderTable();
  } catch (e) {
    showToast('Lỗi tải lịch: ' + e.message, 'error', 4000);
  } finally {
    document.getElementById('loading').classList.add('hidden');
  }
}

function renderTable() {
  const tbody = document.getElementById('result-tbody');
  tbody.innerHTML = '';
  document.getElementById('count').textContent = state.items.length + ' lịch';

  if (state.items.length === 0) {
    document.getElementById('empty-state').classList.remove('hidden');
    return;
  }

  // Sort theo ngày ascending
  const sorted = [...state.items].sort((a, b) => String(a.ngay).localeCompare(String(b.ngay)));
  const canWrite = hasPermission('schedule_write');
  const today = new Date().toISOString().slice(0, 10);

  const statusBadge = {
    pending: '<span class="px-2 py-0.5 rounded-full text-xs bg-yellow-100 text-yellow-800">⏳ Chờ làm</span>',
    done: '<span class="px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-800">✅ Đã xong</span>',
    skipped: '<span class="px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-600">⏭️ Bỏ qua</span>'
  };

  for (const it of sorted) {
    const tr = document.createElement('tr');
    tr.className = 'border-b hover:bg-blue-50';
    if (it.status === 'done') tr.className += ' opacity-70';
    if (String(it.ngay) === today) tr.className += ' bg-blue-50';

    const schema = SCHEMAS[it.loai_ks];
    const isOwnItem = String(it.ktv_username) === state.me.username;
    const canEditStatus = canWrite || isOwnItem;

    tr.innerHTML = `
      <td class="px-2 py-2 text-center text-sm font-mono">${escapeHtml(String(it.ngay))}</td>
      <td class="px-2 py-2 text-sm">${escapeHtml(it.ktv_username)}</td>
      <td class="px-2 py-2 text-sm">${schema ? schema.icon + ' ' + escapeHtml(schema.name) : '<span class="text-gray-400">—</span>'}</td>
      <td class="px-2 py-2 text-sm">${escapeHtml(it.khu_vuc || '')}</td>
      <td class="px-2 py-2 text-xs text-gray-600 max-w-[200px] truncate" title="${escapeHtml(it.ghi_chu || '')}">${escapeHtml(it.ghi_chu || '')}</td>
      <td class="px-2 py-2 text-center">${statusBadge[it.status] || it.status}</td>
      <td class="px-2 py-2 text-right whitespace-nowrap">
        ${canEditStatus && it.status === 'pending'
          ? '<button class="text-xs px-2 py-1 bg-green-50 text-green-700 rounded mr-1 btn-done">✅ Hoàn thành</button>' : ''}
        ${canEditStatus && it.status === 'pending'
          ? '<button class="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded mr-1 btn-skip">⏭️ Bỏ qua</button>' : ''}
        ${canEditStatus && it.status !== 'pending'
          ? '<button class="text-xs px-2 py-1 bg-yellow-50 text-yellow-700 rounded mr-1 btn-reopen">↺ Mở lại</button>' : ''}
        ${canWrite
          ? '<button class="text-xs px-2 py-1 bg-red-50 text-red-700 rounded btn-del">Xoá</button>' : ''}
      </td>
    `;
    const ok = tr.querySelector('.btn-done');
    if (ok) ok.onclick = () => updateStatus(it, 'done');
    const sk = tr.querySelector('.btn-skip');
    if (sk) sk.onclick = () => updateStatus(it, 'skipped');
    const re = tr.querySelector('.btn-reopen');
    if (re) re.onclick = () => updateStatus(it, 'pending');
    const dl = tr.querySelector('.btn-del');
    if (dl) dl.onclick = () => doDelete(it);
    tbody.appendChild(tr);
  }
}

async function updateStatus(item, status) {
  try {
    await apiScheduleUpdate(item.id, { status });
    showToast('✅ Đã cập nhật: ' + status, 'success', 2000);
    await loadSchedule();
  } catch (e) {
    showToast('Lỗi: ' + e.message, 'error', 4000);
  }
}

async function doDelete(item) {
  if (!confirm('Xoá lịch của ' + item.ktv_username + ' ngày ' + item.ngay + '?')) return;
  try {
    await apiScheduleDelete(item.id);
    showToast('Đã xoá', 'success');
    await loadSchedule();
  } catch (e) {
    showToast('Lỗi: ' + e.message, 'error', 4000);
  }
}

function openAddDialog() {
  document.getElementById('f-ngay').value = new Date().toISOString().slice(0, 10);
  document.getElementById('f-loaiks').value = '';
  document.getElementById('f-khuvuc').value = '';
  document.getElementById('f-ghichu').value = '';
  hideFormError();
  document.getElementById('add-dialog').classList.remove('hidden');
}

function showFormError(msg) {
  const el = document.getElementById('form-error');
  el.textContent = msg;
  el.classList.remove('hidden');
}
function hideFormError() {
  document.getElementById('form-error').classList.add('hidden');
}

async function handleCreate(e) {
  e.preventDefault();
  hideFormError();
  const btn = document.getElementById('btn-save');
  btn.disabled = true;
  btn.textContent = '⏳ Đang lưu...';
  try {
    const item = {
      ktv_username: document.getElementById('f-ktv').value,
      ngay: document.getElementById('f-ngay').value,
      loai_ks: document.getElementById('f-loaiks').value || '',
      khu_vuc: document.getElementById('f-khuvuc').value.trim(),
      ghi_chu: document.getElementById('f-ghichu').value.trim()
    };
    if (!item.ktv_username) throw new Error('Chọn Người khảo sát');
    if (!item.ngay) throw new Error('Chọn ngày');
    await apiScheduleCreate([item]);
    showToast('✅ Đã thêm lịch', 'success');
    document.getElementById('add-dialog').classList.add('hidden');
    await loadSchedule();
  } catch (err) {
    showFormError(err.message || String(err));
  } finally {
    btn.disabled = false;
    btn.textContent = 'Lưu';
  }
}
