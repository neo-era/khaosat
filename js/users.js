// js/users.js — CRUD user (admin only). Dialog form + table với toggle active.

import { apiUsers, apiUserCreate, apiUserUpdate, apiResetPassword } from './api.js';
import { showToast, escapeHtml } from './utils.js';

const state = {
  me: null,
  users: [],
  editingUsername: null  // null = create mode; string = edit mode
};

export async function initUsers(currentUser) {
  state.me = currentUser;
  document.getElementById('btn-add').onclick = openCreateDialog;
  document.getElementById('user-form').addEventListener('submit', handleFormSubmit);
  await loadUsers();
}

async function loadUsers() {
  document.getElementById('loading').classList.remove('hidden');
  try {
    const res = await apiUsers({ includeInactive: true });
    state.users = res.users || [];
    renderTable();
  } catch (e) {
    showToast('Lỗi tải user: ' + e.message, 'error', 4000);
  } finally {
    document.getElementById('loading').classList.add('hidden');
  }
}

function renderTable() {
  const tbody = document.getElementById('user-tbody');
  tbody.innerHTML = '';
  document.getElementById('user-count').textContent = state.users.length;

  const roleColor = {
    admin: 'bg-purple-100 text-purple-800',
    user:  'bg-purple-100 text-purple-800',
    user1: 'bg-green-100 text-green-800',
    demo:  'bg-yellow-100 text-yellow-800'
  };

  for (const u of state.users) {
    const tr = document.createElement('tr');
    tr.className = 'border-b hover:bg-blue-50';
    if (!u.active) tr.className += ' bg-gray-50 text-gray-500';
    const isMe = u.username === state.me.username;
    tr.innerHTML = `
      <td class="px-2 py-2 text-sm font-mono">${escapeHtml(u.username)}${isMe ? ' <span class="text-xs text-blue-600">(bạn)</span>' : ''}</td>
      <td class="px-2 py-2 text-sm">${escapeHtml(u.full_name)}</td>
      <td class="px-2 py-2 text-center"><span class="inline-block px-2 py-0.5 rounded-full text-xs font-medium ${roleColor[u.role] || 'bg-gray-100 text-gray-700'}">${escapeHtml(u.role)}</span></td>
      <td class="px-2 py-2 text-center">
        ${u.active
          ? '<span class="text-green-700 text-xs">✅ Hoạt động</span>'
          : '<span class="text-red-700 text-xs">🚫 Vô hiệu</span>'}
      </td>
      <td class="px-2 py-2 text-xs text-gray-500">${escapeHtml(u.created_at || '')}</td>
      <td class="px-2 py-2 text-right whitespace-nowrap">
        <button class="text-xs px-2 py-1 bg-blue-50 text-blue-700 rounded mr-1 btn-edit">Sửa</button>
        <button class="text-xs px-2 py-1 bg-yellow-50 text-yellow-700 rounded mr-1 btn-pwd">🔑 PWD</button>
        ${u.active
          ? `<button class="text-xs px-2 py-1 bg-red-50 text-red-700 rounded btn-disable" ${isMe ? 'disabled title="Không thể vô hiệu chính mình"' : ''}>Vô hiệu</button>`
          : `<button class="text-xs px-2 py-1 bg-green-50 text-green-700 rounded btn-enable">Kích hoạt</button>`
        }
      </td>
    `;
    tr.querySelector('.btn-edit').onclick = () => openEditDialog(u);
    tr.querySelector('.btn-pwd').onclick = () => resetPwd(u);
    const dis = tr.querySelector('.btn-disable');
    if (dis && !dis.disabled) dis.onclick = () => toggleActive(u, false);
    const en = tr.querySelector('.btn-enable');
    if (en) en.onclick = () => toggleActive(u, true);
    tbody.appendChild(tr);
  }
}

function openCreateDialog() {
  state.editingUsername = null;
  document.getElementById('dialog-title').textContent = '+ Thêm user mới';
  document.getElementById('f-username').value = '';
  document.getElementById('f-username').readOnly = false;
  document.getElementById('f-password').value = '';
  document.getElementById('f-fullname').value = '';
  document.getElementById('f-role').value = 'user1';
  document.getElementById('f-active').checked = true;
  document.getElementById('field-password-wrap').style.display = '';
  hideFormError();
  document.getElementById('user-dialog').classList.remove('hidden');
  setTimeout(() => document.getElementById('f-username').focus(), 100);
}

function openEditDialog(u) {
  state.editingUsername = u.username;
  document.getElementById('dialog-title').textContent = 'Sửa user: ' + u.username;
  document.getElementById('f-username').value = u.username;
  document.getElementById('f-username').readOnly = true;
  document.getElementById('f-password').value = '';
  document.getElementById('f-fullname').value = u.full_name;
  document.getElementById('f-role').value = u.role;
  document.getElementById('f-active').checked = u.active;
  // Edit mode: ẩn password field (dùng nút "🔑 PWD" riêng)
  document.getElementById('field-password-wrap').style.display = 'none';
  hideFormError();
  document.getElementById('user-dialog').classList.remove('hidden');
  setTimeout(() => document.getElementById('f-fullname').focus(), 100);
}

function showFormError(msg) {
  const el = document.getElementById('form-error');
  el.textContent = msg;
  el.classList.remove('hidden');
}
function hideFormError() {
  document.getElementById('form-error').classList.add('hidden');
}

async function handleFormSubmit(e) {
  e.preventDefault();
  hideFormError();
  const btn = document.getElementById('btn-save');
  const isEdit = !!state.editingUsername;
  btn.disabled = true;
  btn.textContent = '⏳ Đang lưu...';

  try {
    const full_name = document.getElementById('f-fullname').value.trim();
    const role = document.getElementById('f-role').value;
    const active = document.getElementById('f-active').checked;

    if (isEdit) {
      const res = await apiUserUpdate({
        username: state.editingUsername,
        full_name, role, active
      });
      showToast('✅ Đã cập nhật ' + state.editingUsername + (res.changes && res.changes.length ? ' (' + res.changes.join(', ') + ')' : ''), 'success');
    } else {
      const username = document.getElementById('f-username').value.trim();
      const password = document.getElementById('f-password').value;
      await apiUserCreate({ username, password, full_name, role, active });
      showToast('✅ Đã tạo user ' + username, 'success');
    }
    document.getElementById('user-dialog').classList.add('hidden');
    await loadUsers();
  } catch (err) {
    showFormError(err.message || String(err));
  } finally {
    btn.disabled = false;
    btn.textContent = 'Lưu';
  }
}

async function resetPwd(u) {
  const newPwd = prompt('Mật khẩu MỚI cho ' + u.username + ' (≥ 8 ký tự):');
  if (!newPwd) return;
  if (newPwd.length < 8) { showToast('Mật khẩu phải ≥ 8 ký tự', 'error'); return; }
  const confirmPwd = prompt('Xác nhận lại mật khẩu mới:');
  if (newPwd !== confirmPwd) { showToast('Hai lần nhập không khớp', 'error'); return; }
  try {
    await apiResetPassword(u.username, newPwd);
    showToast('✅ Đã reset password ' + u.username, 'success');
  } catch (e) {
    showToast('Lỗi: ' + e.message, 'error', 4000);
  }
}

async function toggleActive(u, newActive) {
  const action = newActive ? 'kích hoạt' : 'vô hiệu hoá';
  if (!confirm('Bạn có chắc muốn ' + action + ' user ' + u.username + '?')) return;
  try {
    await apiUserUpdate({ username: u.username, active: newActive });
    showToast('✅ Đã ' + action + ' ' + u.username, 'success');
    await loadUsers();
  } catch (e) {
    showToast('Lỗi: ' + e.message, 'error', 4000);
  }
}
