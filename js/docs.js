// js/docs.js — Tài liệu tham khảo: list + add + delete. Mọi role xem; admin/user thêm/xoá.

import { apiDocsList, apiDocsCreate, apiDocsDelete } from './api.js';
import { isFullAccess } from './auth.js';
import { showToast, escapeHtml, debounce } from './utils.js';

const state = {
  me: null,
  docs: [],
  categories: [],
  search: '',
  filterCategory: ''
};

export async function initDocs(currentUser) {
  state.me = currentUser;
  document.getElementById('btn-add').onclick = openAddDialog;
  document.getElementById('add-form').addEventListener('submit', handleCreate);
  document.getElementById('search').addEventListener('input', debounce(() => {
    state.search = document.getElementById('search').value.trim().toLowerCase();
    renderDocs();
  }, 200));
  document.getElementById('filter-category').addEventListener('change', () => {
    state.filterCategory = document.getElementById('filter-category').value;
    renderDocs();
  });
  await loadDocs();
}

async function loadDocs() {
  document.getElementById('loading').classList.remove('hidden');
  try {
    const res = await apiDocsList();
    state.docs = res.docs || [];
    state.categories = res.categories || [];
    populateCategoryFilters();
    renderDocs();
  } catch (e) {
    showToast('Lỗi tải tài liệu: ' + e.message, 'error', 4000);
  } finally {
    document.getElementById('loading').classList.add('hidden');
  }
}

function populateCategoryFilters() {
  // Filter dropdown
  const sel = document.getElementById('filter-category');
  while (sel.options.length > 1) sel.remove(1);
  for (const c of state.categories) {
    const o = document.createElement('option');
    o.value = c;
    o.textContent = c;
    sel.appendChild(o);
  }
  // Add form category
  const fc = document.getElementById('f-category');
  fc.innerHTML = '';
  for (const c of state.categories) {
    const o = document.createElement('option');
    o.value = c;
    o.textContent = c;
    fc.appendChild(o);
  }
}

function renderDocs() {
  const container = document.getElementById('docs-container');
  container.innerHTML = '';

  // Filter + search
  const s = state.search;
  const cat = state.filterCategory;
  const filtered = state.docs.filter(d => {
    if (cat && d.category !== cat) return false;
    if (s) {
      const hay = (d.title + ' ' + d.description + ' ' + d.url).toLowerCase();
      if (!hay.includes(s)) return false;
    }
    return true;
  });

  if (filtered.length === 0) {
    document.getElementById('empty-state').classList.remove('hidden');
    return;
  }
  document.getElementById('empty-state').classList.add('hidden');

  // Group theo category
  const groups = {};
  for (const d of filtered) {
    const c = d.category || 'Khác';
    if (!groups[c]) groups[c] = [];
    groups[c].push(d);
  }

  const order = (state.categories.length ? state.categories : Object.keys(groups));
  const canEdit = isFullAccess(state.me.role);

  for (const cat of order) {
    const docs = groups[cat];
    if (!docs || docs.length === 0) continue;
    const section = document.createElement('section');
    section.innerHTML = `<h2 class="text-sm font-bold text-gray-700 uppercase tracking-wider mb-2">${escapeHtml(cat)} <span class="text-xs text-gray-400 normal-case">(${docs.length})</span></h2>`;
    const grid = document.createElement('div');
    grid.className = 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3';
    for (const d of docs) {
      grid.appendChild(buildCard(d, canEdit));
    }
    section.appendChild(grid);
    container.appendChild(section);
  }
}

function buildCard(d, canEdit) {
  const card = document.createElement('div');
  card.className = 'bg-white rounded-lg shadow-sm p-3 hover:shadow-md transition relative';
  card.innerHTML = `
    <a href="${escapeHtml(d.url)}" target="_blank" rel="noopener" class="block">
      <div class="font-medium text-blue-700 hover:underline break-words mb-1">${escapeHtml(d.title)}</div>
      <div class="text-xs text-gray-600 break-words mb-2">${escapeHtml(d.description || '')}</div>
      <div class="text-xs text-gray-400 truncate" title="${escapeHtml(d.url)}">${escapeHtml(d.url)}</div>
    </a>
    <div class="text-xs text-gray-400 mt-2 pt-2 border-t">
      ${escapeHtml(d.added_by)} · ${escapeHtml(d.added_at)}
    </div>
    ${canEdit ? '<button class="absolute top-2 right-2 text-red-500 hover:bg-red-50 w-7 h-7 rounded btn-del" title="Xoá">✕</button>' : ''}
  `;
  if (canEdit) {
    card.querySelector('.btn-del').onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      deleteDoc(d);
    };
  }
  return card;
}

function openAddDialog() {
  document.getElementById('f-title').value = '';
  document.getElementById('f-url').value = '';
  document.getElementById('f-category').value = state.categories[0] || '';
  document.getElementById('f-description').value = '';
  hideFormError();
  document.getElementById('add-dialog').classList.remove('hidden');
  setTimeout(() => document.getElementById('f-title').focus(), 100);
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
    const title = document.getElementById('f-title').value.trim();
    const url = document.getElementById('f-url').value.trim();
    const category = document.getElementById('f-category').value;
    const description = document.getElementById('f-description').value.trim();
    await apiDocsCreate({ title, url, category, description });
    showToast('✅ Đã thêm tài liệu', 'success');
    document.getElementById('add-dialog').classList.add('hidden');
    await loadDocs();
  } catch (err) {
    showFormError(err.message || String(err));
  } finally {
    btn.disabled = false;
    btn.textContent = 'Lưu';
  }
}

async function deleteDoc(d) {
  if (!confirm('Xoá tài liệu "' + d.title + '"?')) return;
  try {
    await apiDocsDelete(d.id);
    showToast('Đã xoá', 'success');
    await loadDocs();
  } catch (e) {
    showToast('Lỗi xoá: ' + e.message, 'error');
  }
}
