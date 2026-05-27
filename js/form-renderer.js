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
import { requireAuth, logout, getCurrentUser, hasPermission } from './auth.js';
import { apiSubmit, apiUpdate, apiList, uploadImage } from './api.js';
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
  imageUrls: {},              // { ban_ve: {status, url, fileName, thumbnail} } cho field type 'image_url'
  autosaveTimer: null,
  container: null,
  editMode: false,            // true khi đang sửa bản ghi (URL ?edit=STT)
  editStt: null,              // STT đang sửa
  editOrigData: null,         // row gốc từ server (giữ Người khảo sát + Submitted At ...)
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
  state.imageUrls = {};

  // Edit mode: ?edit=STT
  const editStt = new URLSearchParams(location.search).get('edit');
  state.editMode = !!editStt;
  state.editStt = editStt;
  state.editOrigData = null;

  if (state.editMode && !hasPermission('edit')) {
    showToast('Bạn không có quyền sửa bản ghi', 'error');
    setTimeout(() => location.replace('manage.html'), 1500);
    return;
  }

  renderShell();
  bindEvents();
  if (state.editMode) {
    await loadEditRow();
    // Edit mode: không cần GPS auto-refresh hay autosave draft
  } else {
    refreshGps();              // async, không await
    await maybeRestoreDraft();
    startAutosave();
  }
}

/** Edit mode: tải row gốc từ server theo STT và pre-fill form. */
async function loadEditRow() {
  try {
    const res = await apiList({ type: state.schemaKey, stt: state.editStt, status: 'all' });
    const row = (res.rows || [])[0];
    if (!row) {
      showToast('Không tìm thấy bản ghi STT #' + state.editStt, 'error');
      setTimeout(() => location.replace('manage.html'), 1500);
      return;
    }
    state.editOrigData = row;

    // Banner báo đang sửa
    const banner = document.createElement('div');
    banner.className = 'bg-yellow-100 border-l-4 border-yellow-500 text-yellow-900 p-3 mb-3 rounded text-sm';
    banner.innerHTML = `✏️ <strong>Đang sửa bản ghi STT #${escapeHtml(String(state.editStt))}</strong>
      &middot; KTV gốc: ${escapeHtml(row['Người khảo sát'] || row['Username'] || '?')}
      &middot; Gửi lúc: ${escapeHtml(row['Submitted At'] || '?')}<br>
      <span class="text-xs">Lưu ý: Người khảo sát, STT, Ngày khảo sát, Submitted At được giữ nguyên — chỉ sửa thông tin nghiệp vụ.</span>`;
    state.container.insertBefore(banner, state.container.firstChild);

    // Pre-fill fields
    for (const f of state.schema.fields) {
      const val = row[f.label];
      if (val === undefined || val === null || val === '') continue;
      if (['stt_auto', 'date_auto', 'link_gmap'].includes(f.type)) continue;
      if (f.key === 'nguoi_ks') continue;  // readonly auto-fill

      if (f.type === 'gps_lat') {
        state.gps = { status: 'ok', lat: parseFloat(val) || 0, lng: state.gps.lng || 0, accuracy: 0 };
        updateGpsUI();
        continue;
      }
      if (f.type === 'gps_lng') {
        state.gps = { status: 'ok', lat: state.gps.lat || 0, lng: parseFloat(val) || 0, accuracy: 0 };
        updateGpsUI();
        continue;
      }
      if (f.type === 'image_url') {
        const url = String(val);
        if (url) {
          state.imageUrls[f.key] = { status: 'done', url, fileName: '(ảnh cũ)', thumbnail: url };
          renderImageFieldPreview(f.key);
        }
        continue;
      }
      const el = state.container.querySelector(`[data-key="${f.key}"]`);
      if (!el) continue;
      el.value = val;
    }
    // Phường cascade
    const quanEl = state.container.querySelector('[data-key="quan"]');
    if (quanEl && quanEl.value) {
      updatePhuongOptions(quanEl.value);
      const phuongVal = row['Phường'];
      if (phuongVal) {
        const phuongEl = state.container.querySelector('[data-key="phuong"]');
        if (phuongEl) {
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
    // Pre-fill ảnh hiện trường vào state.photos
    const photoUrls = String(row['Ảnh (URLs)'] || '').split('|').filter(u => u);
    state.photos = photoUrls.map(url => ({
      id: uuid(), file: null, status: 'done', url, thumbnail: url, error: null
    }));
    renderPhotoGrid();
  } catch (e) {
    showToast('Lỗi tải bản ghi: ' + e.message, 'error', 4000);
  }
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
      ${isDemo ? '🔒 Không lưu được' : (state.editMode ? '💾 Cập nhật' : '💾 Lưu')}
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
  } else if (t === 'image_url') {
    // Block đặc biệt: input file ẩn + nút chụp + thumbnail preview
    const wrapImg = document.createElement('div');
    wrapImg.className = 'space-y-2';
    wrapImg.dataset.key = field.key;
    wrapImg.dataset.label = field.label;

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.capture = 'environment';
    fileInput.className = 'hidden';
    fileInput.id = 'img-input-' + field.key;
    wrapImg.appendChild(fileInput);

    const btn = document.createElement('label');
    btn.htmlFor = fileInput.id;
    btn.className = 'block w-full bg-blue-50 border-2 border-dashed border-blue-300 rounded-lg p-3 text-center cursor-pointer hover:bg-blue-100 text-sm';
    btn.style.minHeight = '44px';
    btn.innerHTML = '<span class="text-blue-700 font-medium">📷 Chụp ảnh bản vẽ</span>';
    wrapImg.appendChild(btn);

    const preview = document.createElement('div');
    preview.className = 'hidden';
    preview.id = 'img-preview-' + field.key;
    wrapImg.appendChild(preview);

    fileInput.onchange = (e) => handleImageFieldSelect(e, field.key, field.label);

    // Replace input mặc định bằng block tự custom — thoát khỏi luồng `input.id =...` ở dưới
    if (field.hint) {
      const small = document.createElement('div');
      small.className = 'text-xs text-gray-500 mt-1';
      small.textContent = field.hint;
      wrapImg.appendChild(small);
    }

    wrap.appendChild(wrapImg);
    return wrap;
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

// =====================================================================
// IMAGE_URL FIELD (vd Bản vẽ) — 1 ảnh / field
// =====================================================================

async function handleImageFieldSelect(e, fieldKey, fieldLabel) {
  const file = (e.target.files || [])[0];
  if (!file) return;
  e.target.value = '';  // cho phép chọn lại cùng file
  state.imageUrls[fieldKey] = { status: 'uploading', url: null, fileName: file.name, thumbnail: null };
  renderImageFieldPreview(fieldKey);
  try {
    state.imageUrls[fieldKey].thumbnail = await createThumbnail(file);
    renderImageFieldPreview(fieldKey);
    const url = await uploadImage(file, 'banve/' + state.schemaKey);
    state.imageUrls[fieldKey] = { status: 'done', url, fileName: file.name, thumbnail: state.imageUrls[fieldKey].thumbnail };
  } catch (err) {
    state.imageUrls[fieldKey] = { status: 'error', url: null, fileName: file.name, thumbnail: null, error: err.message || 'Upload fail' };
  }
  renderImageFieldPreview(fieldKey);
}

function removeImageField(fieldKey) {
  delete state.imageUrls[fieldKey];
  renderImageFieldPreview(fieldKey);
}

function renderImageFieldPreview(fieldKey) {
  const preview = document.getElementById('img-preview-' + fieldKey);
  if (!preview) return;
  const item = state.imageUrls[fieldKey];
  if (!item) {
    preview.className = 'hidden';
    preview.innerHTML = '';
    return;
  }
  preview.className = 'relative bg-gray-50 border rounded-lg p-2 flex items-center gap-3';
  preview.innerHTML = '';

  // Thumbnail (hoặc placeholder nếu chưa sinh)
  const thumb = document.createElement('div');
  thumb.className = 'w-20 h-20 rounded bg-gray-200 flex items-center justify-center flex-shrink-0 overflow-hidden';
  if (item.thumbnail) {
    const img = document.createElement('img');
    img.src = item.thumbnail;
    img.className = 'w-full h-full object-cover';
    thumb.appendChild(img);
  } else {
    thumb.textContent = '⏳';
  }
  preview.appendChild(thumb);

  // Info + status
  const info = document.createElement('div');
  info.className = 'flex-1 min-w-0';
  const fileName = document.createElement('div');
  fileName.className = 'text-sm font-medium truncate';
  fileName.textContent = item.fileName;
  info.appendChild(fileName);
  const status = document.createElement('div');
  status.className = 'text-xs';
  if (item.status === 'uploading') { status.textContent = '⏳ Đang tải...'; status.classList.add('text-yellow-700'); }
  else if (item.status === 'done')  { status.textContent = '✅ Đã tải xong'; status.classList.add('text-green-700'); }
  else if (item.status === 'error') { status.textContent = '❌ ' + (item.error || 'Lỗi'); status.classList.add('text-red-700'); }
  info.appendChild(status);
  preview.appendChild(info);

  // Nút thay/xoá
  const actions = document.createElement('div');
  actions.className = 'flex flex-col gap-1 flex-shrink-0';
  const btnReplace = document.createElement('label');
  btnReplace.htmlFor = 'img-input-' + fieldKey;
  btnReplace.className = 'text-xs px-2 py-1 bg-blue-50 text-blue-700 rounded cursor-pointer text-center hover:bg-blue-100';
  btnReplace.textContent = '🔄 Thay';
  actions.appendChild(btnReplace);
  const btnRemove = document.createElement('button');
  btnRemove.type = 'button';
  btnRemove.className = 'text-xs px-2 py-1 bg-red-50 text-red-700 rounded hover:bg-red-100';
  btnRemove.textContent = '✕ Xoá';
  btnRemove.onclick = () => removeImageField(fieldKey);
  actions.appendChild(btnRemove);
  preview.appendChild(actions);
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
    if (f.type === 'image_url') {
      // Restore URL nếu đã có (vd draft auto-save sau khi upload xong)
      state.imageUrls[f.key] = { status: 'done', url: val, fileName: '(ảnh từ draft)', thumbnail: val };
      renderImageFieldPreview(f.key);
      continue;
    }
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
    if (t === 'image_url') {
      const item = state.imageUrls[f.key];
      data[f.label] = (item && item.status === 'done') ? item.url : '';
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
    const t = f.type;
    if (['stt_auto', 'date_auto', 'link_gmap', 'gps_lat', 'gps_lng'].includes(t)) continue;
    if (f.key === 'nguoi_ks') continue;  // auto-fill

    if (t === 'image_url') {
      if (f.required) {
        const item = state.imageUrls[f.key];
        if (!item || item.status !== 'done') errors.push({ field: f });
      }
      continue;
    }

    if (!f.required) continue;
    const el = state.container.querySelector(`[data-key="${f.key}"]`);
    if (!el || !String(el.value || '').trim()) {
      errors.push({ field: f, el });
    }
  }
  // Photos (ảnh hiện trường) đang upload chưa xong
  const pendingPhotos = state.photos.filter(p => p.status === 'pending' || p.status === 'uploading');
  if (pendingPhotos.length > 0) {
    errors.push({ message: `Đợi ${pendingPhotos.length} ảnh hiện trường upload xong rồi mới Lưu` });
  }
  // image_url fields đang upload chưa xong
  const pendingImgs = Object.entries(state.imageUrls).filter(([k, v]) => v.status === 'uploading').map(([k]) => k);
  if (pendingImgs.length > 0) {
    errors.push({ message: `Đợi ảnh "${pendingImgs.join(', ')}" upload xong rồi mới Lưu` });
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
  btn.textContent = state.editMode ? '⏳ Đang cập nhật...' : '⏳ Đang lưu...';

  const data = collectFormData();
  const photoUrls = state.photos.filter(p => p.status === 'done').map(p => p.url);

  try {
    let res;
    if (state.editMode) {
      // EDIT MODE
      res = await apiUpdate(state.schemaKey, state.editStt, data, photoUrls);
      showToast('✅ Đã cập nhật STT #' + state.editStt + ' (' + (res.changes ? res.changes.length : 0) + ' trường thay đổi)', 'success', 3000);
      setTimeout(() => location.replace('manage.html'), 1500);
      return;
    }
    // CREATE MODE
    res = await apiSubmit(state.schemaKey, data, photoUrls);
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
    // Edit mode: không enqueue (không hỗ trợ offline edit), chỉ báo lỗi
    if (state.editMode) {
      showToast('Lỗi cập nhật: ' + msg, 'error', 4000);
      btn.disabled = false;
      btn.textContent = origText;
      return;
    }
    // Submit mode + Network fail → enqueue
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
