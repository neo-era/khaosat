// js/form-renderer.js — Engine render form từ schema.
// API: renderForm(containerEl, schemaKey)
//
// Trách nhiệm:
// - Render UI từ schema (text/select/quan/phuong/tdk/textarea/decimal/...)
// - Quản lý state: GPS, photos, draft
// - Auto-save draft mỗi 5s, restore khi mở lại
// - Validate + submit: gọi apiSubmit; offline → enqueue; token sai → logout
// - Người khảo sát auto-fill từ user.full_name, readonly
// - Role demo: disable nút Lưu + banner cảnh báo

import { SCHEMAS } from './schemas.js';
import { PHUONG_XA, QUAN_LIST, TDK_LIST } from './lookups.js';
import { CONFIG } from './config.js';
import { requireAuth, logout, getCurrentUser } from './auth.js';
import { apiSubmit, uploadImage } from './api.js';
import { saveDraft, loadDraft, clearDraft, enqueueSubmission, saveSubmittedToday } from './storage.js';
import { compressImage, createThumbnail } from './camera.js';
import { getCurrentPosition } from './gps.js';
import { showToast, escapeHtml, uuid, formatVnDate } from './utils.js';

// State module-scoped (1 form 1 lúc trên page)
const state = {
  schemaKey: null,
  schema: null,
  user: null,
  gps: { status: 'idle' },   // idle | loading | ok | error
  photos: [],                 // [{id, file, status, url, thumbnail, error}]
  autosaveTimer: null,
  container: null
};

// =====================================================================
// PUBLIC API
// =====================================================================

export async function renderForm(containerEl, schemaKey) {
  state.user = requireAuth();  // throw nếu chưa login
  const schema = SCHEMAS[schemaKey];
  if (!schema) {
    showToast('Loại khảo sát không hợp lệ: ' + schemaKey, 'error');
    setTimeout(() => location.replace('index.html'), 1500);
    return;
  }
  state.schemaKey = schemaKey;
  state.schema = schema;
  state.container = containerEl;
  state.gps = { status: 'idle' };
  state.photos = [];

  renderShell();
  bindEvents();
  refreshGps();              // async, không await
  await maybeRestoreDraft();
  startAutosave();
}

// =====================================================================
// RENDER
// =====================================================================

function renderShell() {
  const s = state.schema;
  const isDemo = state.user.role === 'demo';

  state.container.innerHTML = '';

  // Banner demo (nếu cần)
  if (isDemo) {
    const banner = document.createElement('div');
    banner.className = 'bg-yellow-100 border-l-4 border-yellow-500 text-yellow-800 p-3 mb-4 text-sm';
    banner.textContent = '⚠️ Chế độ XEM THỬ — không lưu được dữ liệu. Đăng nhập tài khoản chính thức để submit.';
    state.container.appendChild(banner);
  }

  // Heading
  const heading = document.createElement('div');
  heading.className = 'flex items-center gap-3 mb-4 pb-3 border-b';
  heading.innerHTML = `
    <button id="btn-back" class="text-2xl px-3 py-2 rounded hover:bg-gray-100" title="Về trang chủ">←</button>
    <div class="text-3xl">${escapeHtml(s.icon || '📋')}</div>
    <h1 class="text-lg font-semibold flex-1">${escapeHtml(s.name)}</h1>
  `;
  state.container.appendChild(heading);

  // GPS block (chỉ show nếu schema có gps_lat/gps_lng)
  const hasGps = s.fields.some(f => f.type === 'gps_lat' || f.type === 'gps_lng');
  if (hasGps) {
    state.container.appendChild(renderGpsBlock());
  }

  // Form fields
  const form = document.createElement('form');
  form.id = 'survey-form';
  form.className = 'space-y-4';
  form.noValidate = true;

  for (const field of s.fields) {
    const el = renderField(field);
    if (el) form.appendChild(el);
  }

  state.container.appendChild(form);

  // Image block
  state.container.appendChild(renderImageBlock());

  // Submit area
  const submitArea = document.createElement('div');
  submitArea.className = 'mt-6 pt-4 border-t flex gap-3';
  submitArea.innerHTML = `
    <button type="button" id="btn-home" class="flex-1 bg-gray-200 text-gray-800 py-3 rounded-lg font-medium" style="min-height:44px">Về trang chủ</button>
    <button type="button" id="btn-submit" class="flex-1 bg-blue-700 text-white py-3 rounded-lg font-medium disabled:bg-gray-400" style="min-height:44px" ${isDemo ? 'disabled' : ''}>
      ${isDemo ? '🔒 Không lưu được' : '💾 Lưu'}
    </button>
  `;
  state.container.appendChild(submitArea);

  // Datalist TĐK (1 lần cho toàn form)
  if (s.fields.some(f => f.type === 'tdk') && !document.getElementById('tdk-list')) {
    const dl = document.createElement('datalist');
    dl.id = 'tdk-list';
    for (const t of TDK_LIST) {
      const opt = document.createElement('option');
      opt.value = t;
      dl.appendChild(opt);
    }
    document.body.appendChild(dl);
  }
}

/** Render 1 field theo type. Trả về element hoặc null nếu auto/skip. */
function renderField(field) {
  const t = field.type;
  // Server-managed → không render UI
  if (t === 'stt_auto' || t === 'date_auto' || t === 'link_gmap') return null;
  // GPS đã render gộp trong renderGpsBlock
  if (t === 'gps_lat' || t === 'gps_lng') return null;

  const wrap = document.createElement('div');
  wrap.className = 'field-wrap';

  const label = document.createElement('label');
  label.className = 'block text-sm font-medium text-gray-700 mb-1';
  label.htmlFor = 'f-' + field.key;
  label.textContent = field.label;
  if (field.required) {
    const star = document.createElement('span');
    star.className = 'text-red-600 ml-1';
    star.textContent = '*';
    label.appendChild(star);
  }
  wrap.appendChild(label);

  let input;
  const baseInputClass = 'w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500';

  // Trường người khảo sát → readonly, auto-fill full_name
  if (field.key === 'nguoi_ks') {
    input = document.createElement('input');
    input.type = 'text';
    input.value = state.user.full_name || '';
    input.readOnly = true;
    input.className = baseInputClass + ' bg-gray-100 cursor-not-allowed';
    input.title = 'Tự lấy từ tài khoản đăng nhập, không thể sửa';
  } else if (t === 'text') {
    input = document.createElement('input');
    input.type = 'text';
    input.className = baseInputClass;
  } else if (t === 'number') {
    input = document.createElement('input');
    input.type = 'number';
    input.inputMode = 'numeric';
    input.className = baseInputClass;
  } else if (t === 'decimal') {
    input = document.createElement('input');
    input.type = 'number';
    input.step = '0.1';
    input.inputMode = 'decimal';
    input.className = baseInputClass;
  } else if (t === 'textarea') {
    input = document.createElement('textarea');
    input.rows = 3;
    input.className = baseInputClass;
  } else if (t === 'select') {
    input = document.createElement('select');
    input.className = baseInputClass;
    const blank = document.createElement('option');
    blank.value = '';
    blank.textContent = '-- chọn --';
    input.appendChild(blank);
    for (const opt of (field.options || [])) {
      const o = document.createElement('option');
      o.value = opt;
      o.textContent = opt === '' ? '(để trống)' : opt;
      input.appendChild(o);
    }
  } else if (t === 'quan') {
    input = document.createElement('select');
    input.className = baseInputClass;
    const blank = document.createElement('option');
    blank.value = '';
    blank.textContent = '-- chọn quận --';
    input.appendChild(blank);
    for (const q of QUAN_LIST) {
      const o = document.createElement('option');
      o.value = q;
      o.textContent = q;
      input.appendChild(o);
    }
  } else if (t === 'phuong') {
    input = document.createElement('select');
    input.className = baseInputClass;
    input.disabled = true;
    const blank = document.createElement('option');
    blank.value = '';
    blank.textContent = '-- chọn quận trước --';
    input.appendChild(blank);
  } else if (t === 'tdk') {
    input = document.createElement('input');
    input.type = 'text';
    input.setAttribute('list', 'tdk-list');
    input.className = baseInputClass;
  } else {
    // Fallback
    input = document.createElement('input');
    input.type = 'text';
    input.className = baseInputClass;
  }

  input.id = 'f-' + field.key;
  input.name = field.key;
  input.dataset.key = field.key;
  input.dataset.label = field.label;
  if (field.required) input.required = true;
  if (field.hint && !input.placeholder) input.placeholder = field.hint;

  wrap.appendChild(input);

  if (field.hint) {
    const small = document.createElement('div');
    small.className = 'text-xs text-gray-500 mt-1';
    small.textContent = field.hint;
    wrap.appendChild(small);
  }

  return wrap;
}

function renderGpsBlock() {
  const div = document.createElement('div');
  div.id = 'gps-block';
  div.className = 'bg-gray-50 border border-gray-200 rounded-lg p-3 mb-4';
  div.innerHTML = `
    <div class="flex items-center justify-between gap-3">
      <div class="flex-1 min-w-0">
        <div class="text-xs text-gray-500 mb-1">📍 GPS</div>
        <div id="gps-info" class="text-sm font-mono text-gray-700">Đang lấy GPS...</div>
      </div>
      <button id="btn-gps-refresh" type="button" class="px-3 py-2 text-sm bg-white border border-gray-300 rounded hover:bg-gray-100" style="min-height:44px">🔄 Lấy lại</button>
    </div>
  `;
  return div;
}

function renderImageBlock() {
  const div = document.createElement('div');
  div.id = 'image-block';
  div.className = 'mt-4 pt-4 border-t';
  div.innerHTML = `
    <label class="block text-sm font-medium text-gray-700 mb-2">📷 Ảnh hiện trường</label>
    <label class="block w-full bg-blue-50 border-2 border-dashed border-blue-300 rounded-lg p-4 text-center cursor-pointer hover:bg-blue-100 mb-3" style="min-height:44px">
      <input id="photo-input" type="file" accept="image/*" multiple capture="environment" class="hidden">
      <span class="text-blue-700 font-medium">+ Chụp ảnh / Chọn từ thư viện</span>
    </label>
    <div id="photo-grid" class="grid grid-cols-3 gap-2"></div>
  `;
  return div;
}

// =====================================================================
// EVENTS
// =====================================================================

function bindEvents() {
  document.getElementById('btn-back').onclick = goHome;
  document.getElementById('btn-home').onclick = goHome;
  document.getElementById('btn-submit').onclick = handleSubmit;
  document.getElementById('photo-input').onchange = handleFileSelect;
  const gpsBtn = document.getElementById('btn-gps-refresh');
  if (gpsBtn) gpsBtn.onclick = refreshGps;

  // Quận → cập nhật phường
  const quanEl = state.container.querySelector('[data-key="quan"]');
  if (quanEl) {
    quanEl.addEventListener('change', () => updatePhuongOptions(quanEl.value));
  }

  // Phường → handle "Khác (nhập tay)"
  // (event handler được attach trong updatePhuongOptions để bám select mới sau khi rebuild)
}

function goHome() {
  // Confirm nếu có nội dung
  const form = document.getElementById('survey-form');
  if (form) {
    const hasAny = Array.from(form.elements).some(el => el.value && !el.readOnly && el.type !== 'hidden');
    if (hasAny && !confirm('Bỏ form chưa lưu?')) return;
  }
  stopAutosave();
  location.replace('index.html');
}

function updatePhuongOptions(quanVal) {
  const phuongEl = state.container.querySelector('[data-key="phuong"]');
  if (!phuongEl) return;
  phuongEl.innerHTML = '';
  phuongEl.disabled = !quanVal;
  const blank = document.createElement('option');
  blank.value = '';
  blank.textContent = quanVal ? '-- chọn phường --' : '-- chọn quận trước --';
  phuongEl.appendChild(blank);
  if (quanVal) {
    const matches = PHUONG_XA.filter(p => p.quan_cu === quanVal);
    for (const p of matches) {
      const o = document.createElement('option');
      o.value = p.ten;
      o.textContent = p.ten;
      phuongEl.appendChild(o);
    }
    const customOpt = document.createElement('option');
    customOpt.value = '__custom';
    customOpt.textContent = 'Khác (nhập tay)...';
    phuongEl.appendChild(customOpt);
  }

  // Handler cho custom
  phuongEl.onchange = () => {
    if (phuongEl.value !== '__custom') return;
    const custom = (prompt('Nhập tên phường/xã không có trong danh sách:') || '').trim();
    if (custom) {
      const opt = document.createElement('option');
      opt.value = custom;
      opt.textContent = custom + ' (tự nhập)';
      phuongEl.insertBefore(opt, phuongEl.lastChild);
      phuongEl.value = custom;
    } else {
      phuongEl.value = '';
    }
  };
}

// =====================================================================
// GPS
// =====================================================================

async function refreshGps() {
  state.gps = { status: 'loading' };
  updateGpsUI();
  try {
    const pos = await getCurrentPosition({ timeout: 15000 });
    state.gps = { status: 'ok', ...pos };
  } catch (e) {
    state.gps = { status: 'error', error: e.message || 'Không lấy được GPS' };
  }
  updateGpsUI();
}

function updateGpsUI() {
  const info = document.getElementById('gps-info');
  if (!info) return;
  if (state.gps.status === 'loading') {
    info.textContent = 'Đang lấy GPS...';
    info.className = 'text-sm font-mono text-yellow-700';
  } else if (state.gps.status === 'ok') {
    info.textContent = `${state.gps.lat}, ${state.gps.lng} (±${state.gps.accuracy}m)`;
    info.className = 'text-sm font-mono text-green-700';
  } else if (state.gps.status === 'error') {
    info.textContent = '❌ ' + state.gps.error;
    info.className = 'text-sm font-mono text-red-600';
  }
}

// =====================================================================
// PHOTOS
// =====================================================================

function handleFileSelect(e) {
  const files = Array.from(e.target.files || []);
  for (const file of files) {
    const item = { id: uuid(), file, status: 'pending', url: null, thumbnail: null, error: null };
    state.photos.push(item);
    uploadOne(item);
  }
  e.target.value = '';  // cho phép chọn lại cùng file
  renderPhotoGrid();
}

async function uploadOne(item) {
  try {
    item.thumbnail = await createThumbnail(item.file);
    renderPhotoGrid();
    item.status = 'uploading';
    renderPhotoGrid();
    item.url = await uploadImage(item.file, state.schemaKey);
    item.status = 'done';
  } catch (e) {
    item.status = 'error';
    item.error = e.message || 'Upload fail';
  }
  renderPhotoGrid();
}

function removePhoto(id) {
  state.photos = state.photos.filter(p => p.id !== id);
  renderPhotoGrid();
}

function renderPhotoGrid() {
  const grid = document.getElementById('photo-grid');
  if (!grid) return;
  grid.innerHTML = '';
  for (const p of state.photos) {
    const cell = document.createElement('div');
    cell.className = 'relative aspect-square rounded-lg overflow-hidden bg-gray-100 border';
    const img = document.createElement('img');
    img.src = p.thumbnail || '';
    img.className = 'w-full h-full object-cover';
    cell.appendChild(img);

    // Status overlay
    if (p.status !== 'done') {
      const overlay = document.createElement('div');
      overlay.className = 'absolute inset-0 flex items-center justify-center bg-black/40 text-white text-xs text-center px-1';
      if (p.status === 'uploading' || p.status === 'pending') {
        overlay.textContent = '⏳ Đang tải...';
      } else if (p.status === 'error') {
        overlay.textContent = '❌ ' + (p.error || 'Lỗi');
        overlay.classList.add('bg-red-700/70');
      }
      cell.appendChild(overlay);
    }

    // Nút xoá
    const x = document.createElement('button');
    x.type = 'button';
    x.className = 'absolute top-1 right-1 w-7 h-7 bg-red-600 text-white rounded-full text-sm font-bold shadow';
    x.textContent = '✕';
    x.onclick = () => removePhoto(p.id);
    cell.appendChild(x);

    grid.appendChild(cell);
  }
}

// =====================================================================
// DRAFT (auto-save + restore)
// =====================================================================

async function maybeRestoreDraft() {
  const draft = loadDraft(state.schemaKey);
  if (!draft || !draft.data) return;
  const ageMin = Math.round((Date.now() - draft.at) / 60000);
  if (!confirm(`Có bản nháp chưa gửi (${ageMin} phút trước, lúc ${formatVnDate(draft.at)}). Khôi phục?`)) {
    clearDraft(state.schemaKey);
    return;
  }
  // Apply theo label
  for (const f of state.schema.fields) {
    const val = draft.data[f.label];
    if (val === undefined || val === null || val === '') continue;
    if (f.key === 'nguoi_ks') continue;  // readonly
    const el = state.container.querySelector(`[data-key="${f.key}"]`);
    if (!el) continue;
    el.value = val;
  }
  // Phường dropdown phụ thuộc Quận → trigger lại
  const quanEl = state.container.querySelector('[data-key="quan"]');
  if (quanEl && quanEl.value) {
    updatePhuongOptions(quanEl.value);
    const phuongVal = draft.data['Phường'];
    if (phuongVal) {
      const phuongEl = state.container.querySelector('[data-key="phuong"]');
      if (phuongEl) {
        // Nếu phường custom (không trong list), thêm option
        if (![...phuongEl.options].some(o => o.value === phuongVal)) {
          const opt = document.createElement('option');
          opt.value = phuongVal;
          opt.textContent = phuongVal + ' (tự nhập)';
          phuongEl.insertBefore(opt, phuongEl.lastChild);
        }
        phuongEl.value = phuongVal;
      }
    }
  }
  showToast('Đã khôi phục bản nháp', 'info', 2000);
}

function startAutosave() {
  state.autosaveTimer = setInterval(() => {
    const data = collectFormData();
    const hasAny = Object.values(data).some(v => v && String(v).trim() && String(v).trim() !== state.user.full_name);
    if (hasAny) saveDraft(state.schemaKey, data);
  }, CONFIG.autosaveIntervalMs);
}

function stopAutosave() {
  if (state.autosaveTimer) {
    clearInterval(state.autosaveTimer);
    state.autosaveTimer = null;
  }
}

// =====================================================================
// SUBMIT
// =====================================================================

function collectFormData() {
  const data = {};
  for (const f of state.schema.fields) {
    const t = f.type;
    // Auto fields: server gán, không cần gửi
    if (t === 'stt_auto' || t === 'date_auto') continue;
    if (t === 'link_gmap') {
      data[f.label] = (state.gps.status === 'ok')
        ? `https://www.google.com/maps?q=${state.gps.lat},${state.gps.lng}`
        : '';
      continue;
    }
    if (t === 'gps_lat') {
      data[f.label] = state.gps.status === 'ok' ? state.gps.lat : '';
      continue;
    }
    if (t === 'gps_lng') {
      data[f.label] = state.gps.status === 'ok' ? state.gps.lng : '';
      continue;
    }
    const el = state.container.querySelector(`[data-key="${f.key}"]`);
    data[f.label] = el ? el.value : '';
  }
  return data;
}

function validateForm() {
  const errors = [];
  for (const f of state.schema.fields) {
    if (!f.required) continue;
    const t = f.type;
    if (['stt_auto', 'date_auto', 'link_gmap', 'gps_lat', 'gps_lng'].includes(t)) continue;
    if (f.key === 'nguoi_ks') continue;  // auto-fill
    const el = state.container.querySelector(`[data-key="${f.key}"]`);
    if (!el || !String(el.value || '').trim()) {
      errors.push({ field: f, el });
    }
  }
  // Photos đang upload chưa xong
  const pending = state.photos.filter(p => p.status === 'pending' || p.status === 'uploading');
  if (pending.length > 0) {
    errors.push({ message: `Đợi ${pending.length} ảnh upload xong rồi mới Lưu` });
  }
  return errors;
}

async function handleSubmit() {
  if (state.user.role === 'demo') {
    showToast('Tài khoản XEM THỬ không submit được', 'warning');
    return;
  }
  const errors = validateForm();
  if (errors.length > 0) {
    const first = errors[0];
    if (first.el) {
      first.el.focus();
      first.el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      showToast('Thiếu trường bắt buộc: ' + first.field.label, 'error');
    } else {
      showToast(first.message, 'warning');
    }
    return;
  }

  const btn = document.getElementById('btn-submit');
  btn.disabled = true;
  const origText = btn.textContent;
  btn.textContent = '⏳ Đang lưu...';

  const data = collectFormData();
  const photoUrls = state.photos.filter(p => p.status === 'done').map(p => p.url);

  try {
    const res = await apiSubmit(state.schemaKey, data, photoUrls);
    // Success
    clearDraft(state.schemaKey);
    stopAutosave();
    saveSubmittedToday({
      type: state.schemaKey,
      sheet: state.schema.sheet,
      name: state.schema.name,
      icon: state.schema.icon,
      stt: res.stt,
      tuyen_duong: data['Tuyến đường'] || '',
      vi_tri: data['Vị trí'] || '',
      photo_count: photoUrls.length,
      timestamp: res.timestamp,
      data: data
    });
    showSuccessDialog(res.stt);
  } catch (e) {
    const msg = String(e.message || e);
    // Token sai/hết hạn → logout
    if (/token|expired|forbidden|invalid|user not found|user disabled/i.test(msg)) {
      showToast('Phiên hết hạn, vui lòng đăng nhập lại', 'error');
      setTimeout(() => logout(), 1500);
      return;
    }
    // Network fail → enqueue
    if (!navigator.onLine || e.name === 'TypeError' || /fetch|network|HTTP/i.test(msg)) {
      enqueueSubmission({
        action: 'submit',
        type: state.schemaKey,
        data: data,
        photos: photoUrls,
        ua: navigator.userAgent
      });
      clearDraft(state.schemaKey);
      stopAutosave();
      showToast('📵 Đã lưu offline, sẽ tự đồng bộ khi có mạng', 'warning', 4000);
      setTimeout(() => location.replace('index.html'), 2000);
      return;
    }
    showToast('Lỗi: ' + msg, 'error', 4000);
    btn.disabled = false;
    btn.textContent = origText;
  }
}

function showSuccessDialog(stt) {
  const dlg = document.createElement('div');
  dlg.className = 'fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4';
  dlg.innerHTML = `
    <div class="bg-white rounded-lg p-6 max-w-sm w-full shadow-xl text-center">
      <div class="text-5xl mb-3">✅</div>
      <h2 class="text-lg font-semibold mb-1">Đã lưu STT #${escapeHtml(String(stt))}</h2>
      <p class="text-gray-600 text-sm mb-5">Bản ghi đã được gửi thành công vào Google Sheets.</p>
      <div class="flex flex-col gap-2">
        <button id="dlg-cont" class="bg-blue-700 text-white py-3 rounded-lg font-medium" style="min-height:44px">Nhập tiếp loại này</button>
        <button id="dlg-home" class="bg-gray-200 text-gray-800 py-3 rounded-lg font-medium" style="min-height:44px">Về trang chủ</button>
      </div>
    </div>
  `;
  document.body.appendChild(dlg);
  document.getElementById('dlg-cont').onclick = () => location.reload();
  document.getElementById('dlg-home').onclick = () => location.replace('index.html');
}
