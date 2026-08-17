// js/bangron.js — Báo cáo tháo gỡ băng rôn: lọc dữ liệu → 2 kiểu trình bày → In / PDF / Excel
import { apiList } from './api.js';
import { QUAN_LIST, PHUONG_XA } from './lookups.js';
import { SCHEMAS } from './schemas.js';
import { escapeHtml, showToast } from './utils.js';
import { inlineImages, restoreImages } from './photos.js';

const TYPE = 'thao_go_bang_ron';
const SCHEMA = SCHEMAS[TYPE];
/** Nhãn cột nghiệp vụ theo đúng thứ tự sheet (khớp HEADERS trong Code.gs). */
const COLS = SCHEMA.fields.map(f => f.label);
const MAX_PHOTOS = SCHEMA.maxPhotos || 5;

const state = {
  rows: [], from: '', to: '', quan: '', phuong: '', ktv: '', loai: '',
  mode: 'anh'
};

/** Giữ nội dung các ô contenteditable để không mất khi đổi kiểu trình bày. */
const edCache = {};

// =====================================================================
// HELPERS
// =====================================================================

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function firstOfMonthStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

/** 'yyyy-MM-dd HH:mm:ss' | Date-ISO → 'dd/MM/yyyy'. */
function dmy(v) {
  if (!v) return '';
  const s = String(v);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

function num(v) {
  const n = parseFloat(String(v).replace(',', '.'));
  return isNaN(n) ? 0 : n;
}

/** Thêm tiền tố "phường" nếu tên chưa tự mang loại đơn vị (Xã / Thị trấn / Phường). */
function tenPhuong(v) {
  const s = String(v || '').trim();
  if (!s) return '';
  return /^(phường|xã|thị trấn)\s/i.test(s) ? s : `phường ${s}`;
}

/** Mô tả địa bàn đang lọc, dùng trong tiêu đề báo cáo. */
function diaBanText() {
  if (state.phuong) return tenPhuong(state.phuong);
  if (state.quan) return state.quan;
  return 'toàn địa bàn';
}

// =====================================================================
// INIT
// =====================================================================

export function initBangron(user) {
  document.getElementById('filter-from').value = firstOfMonthStr();
  document.getElementById('filter-to').value = todayStr();

  const selQuan = document.getElementById('filter-quan');
  QUAN_LIST.forEach(q => {
    const o = document.createElement('option');
    o.value = q; o.textContent = q;
    selQuan.appendChild(o);
  });
  selQuan.addEventListener('change', () => {
    const selP = document.getElementById('filter-phuong');
    selP.innerHTML = '<option value="">-- Tất cả phường --</option>';
    if (selQuan.value) {
      PHUONG_XA.filter(p => p.quan_cu === selQuan.value).forEach(p => {
        const o = document.createElement('option');
        o.value = p.ten; o.textContent = p.ten;
        selP.appendChild(o);
      });
    }
  });

  // Người khảo sát dropdown — chỉ admin/user mới lọc theo người khác
  if (user.role === 'admin' || user.role === 'user') {
    import('./api.js').then(mod => {
      if (typeof mod.apiUsers !== 'function') return;
      mod.apiUsers().then(res => {
        const users = res?.users || res?.data || (Array.isArray(res) ? res : []);
        const sel = document.getElementById('filter-ktv');
        users.filter(u => u.active !== false).forEach(u => {
          const o = document.createElement('option');
          o.value = u.username;
          o.textContent = `${u.full_name} (@${u.username})`;
          sel.appendChild(o);
        });
      }).catch(() => {});
    }).catch(() => {});
  } else {
    document.getElementById('ktv-wrap')?.classList.add('hidden');
  }

  document.getElementById('btn-load').onclick = loadData;
  document.getElementById('btn-mode-anh').onclick = () => setMode('anh');
  document.getElementById('btn-mode-vb').onclick  = () => setMode('vb');
  document.getElementById('btn-print').onclick = () => window.print();
  document.getElementById('btn-pdf').onclick   = exportPdf;
  document.getElementById('btn-xlsx').onclick  = exportXlsx;

  // Nhớ nội dung các ô sửa tay để không mất khi đổi kiểu trình bày
  document.getElementById('report-preview').addEventListener('input', e => {
    const el = e.target;
    if (el.classList?.contains('ed') && el.id) edCache[el.id] = el.textContent;
  });

  updateModeButtons();
}

// =====================================================================
// LOAD DATA
// =====================================================================

async function loadData() {
  const from = document.getElementById('filter-from').value;
  const to   = document.getElementById('filter-to').value;
  if (!from || !to) { showToast('Chọn đủ Từ ngày và Đến ngày', 'warning'); return; }
  if (from > to)    { showToast('Từ ngày phải trước Đến ngày', 'warning'); return; }

  state.from   = from;
  state.to     = to;
  state.quan   = document.getElementById('filter-quan').value;
  state.phuong = document.getElementById('filter-phuong').value;
  state.ktv    = document.getElementById('filter-ktv')?.value || '';
  state.loai   = document.getElementById('filter-loai').value;

  const loading = document.getElementById('loading');
  const wrap = document.getElementById('preview-wrap');
  loading.classList.remove('hidden');
  wrap.classList.add('hidden');

  try {
    // Kèm giờ để lấy trọn 2 ngày biên (server so sánh theo Submitted At)
    const res = await apiList({
      type: TYPE,
      from: from + 'T00:00:00',
      to:   to + 'T23:59:59',
      status: 'active'
    });

    const rows = (res.rows || []).filter(r => {
      if (state.phuong && r['Phường'] !== state.phuong) return false;
      if (!state.phuong && state.quan && r['Quận'] !== state.quan) return false;
      if (state.ktv && String(r['Username']) !== state.ktv) return false;
      if (state.loai && r['Loại quảng cáo'] !== state.loai) return false;
      return true;
    });

    rows.sort((a, b) => {
      const ta = String(a['Submitted At'] || '');
      const tb = String(b['Submitted At'] || '');
      if (ta !== tb) return ta < tb ? -1 : 1;
      return String(a['Tuyến đường'] || '').localeCompare(String(b['Tuyến đường'] || ''), 'vi');
    });

    rows.forEach(r => {
      r._photos = String(r['Ảnh (URLs)'] || '').split('|').filter(Boolean);
    });

    state.rows = rows;
    loading.classList.add('hidden');
    wrap.classList.remove('hidden');
    render();

    const tong = rows.reduce((s, r) => s + num(r['Số lượng']), 0);
    document.getElementById('data-summary').textContent =
      `${rows.length} lượt · ${tong} tấm`;

    if (!rows.length) showToast('Không có dữ liệu trong khoảng đã chọn', 'info');
  } catch (err) {
    loading.classList.add('hidden');
    showToast('Lỗi tải dữ liệu: ' + (err.message || err), 'error');
  }
}

// =====================================================================
// RENDER
// =====================================================================

function setMode(mode) {
  state.mode = mode;
  updateModeButtons();
  render();
}

function updateModeButtons() {
  const on  = 'text-sm px-4 rounded-lg font-medium transition border bg-blue-700 text-white border-blue-700';
  const off = 'text-sm px-4 rounded-lg font-medium transition border bg-white text-gray-700 border-gray-300 hover:bg-gray-50';
  document.getElementById('btn-mode-anh').className = state.mode === 'anh' ? on : off;
  document.getElementById('btn-mode-vb').className  = state.mode === 'vb'  ? on : off;
}

function render() {
  const el = document.getElementById('report-preview');
  el.innerHTML = state.mode === 'vb' ? renderModeVanBan() : renderModeAnh();
  restoreEditable();
}

/** Đổ lại nội dung người dùng đã gõ vào các ô contenteditable. */
function restoreEditable() {
  Object.keys(edCache).forEach(id => {
    const el = document.getElementById(id);
    if (el && edCache[id] !== undefined && edCache[id] !== '') el.textContent = edCache[id];
  });
}

/** Bảng tổng hợp dùng chung cho cả 2 kiểu trình bày. */
function buildSummaryTable(rows) {
  if (!rows.length) {
    return `<p style="text-align:center;color:#888;padding:16px;font-style:italic;">
      Không có dữ liệu tháo gỡ băng rôn trong khoảng thời gian và địa bàn đã chọn.</p>`;
  }

  let body = '';
  let stt = 1;
  let tong = 0;

  rows.forEach(r => {
    const sl = num(r['Số lượng']);
    tong += sl;
    const diaChi = [r['Phường'], r['Quận']].filter(Boolean).map(escapeHtml).join(', ');
    body += `<tr>
      <td style="text-align:center;">${stt++}</td>
      <td>${escapeHtml(r['Tuyến đường'] || '')}</td>
      <td>${escapeHtml(r['Vị trí'] || '')}</td>
      <td>${diaChi}</td>
      <td style="text-align:center;">${escapeHtml(r['Loại quảng cáo'] || '')}</td>
      <td style="text-align:center;font-weight:bold;">${sl || ''}</td>
      <td style="text-align:center;white-space:nowrap;">${escapeHtml(dmy(r['Ngày khảo sát'] || r['Submitted At']))}</td>
      <td>${escapeHtml(r['Người khảo sát'] || '')}</td>
      <td>${escapeHtml(r['Ghi chú'] || '')}</td>
    </tr>`;
  });

  return `
  <table class="br-table">
    <thead>
      <tr>
        <th style="width:4%;">STT</th>
        <th style="width:18%;">Tuyến đường</th>
        <th style="width:13%;">Vị trí / đoạn</th>
        <th style="width:15%;">Phường / Quận</th>
        <th style="width:10%;">Loại</th>
        <th style="width:7%;">Số tấm</th>
        <th style="width:9%;">Ngày</th>
        <th style="width:12%;">Người thực hiện</th>
        <th style="width:12%;">Ghi chú</th>
      </tr>
    </thead>
    <tbody>
      ${body}
      <tr class="br-total">
        <td colspan="5" style="text-align:right;">TỔNG CỘNG</td>
        <td style="text-align:center;">${tong}</td>
        <td colspan="3"></td>
      </tr>
    </tbody>
  </table>`;
}

/** Các khối ảnh theo từng lượt tháo gỡ. */
function buildPhotoBlocks(rows) {
  if (!rows.length) return '';
  let html = '';
  let i = 1;

  rows.forEach(r => {
    const loai   = String(r['Loại quảng cáo'] || 'Băng rôn').toLowerCase();
    const tuyen  = r['Tuyến đường'] || '';
    const phuong = r['Phường'] || '';
    const viTri  = r['Vị trí'] ? ` (${r['Vị trí']})` : '';
    const sl     = num(r['Số lượng']);
    const ngay   = dmy(r['Ngày khảo sát'] || r['Submitted At']);

    const title = `${i++}. Tháo ${escapeHtml(loai)} đường ${escapeHtml(tuyen)}${escapeHtml(viTri)}`
                + `, ${escapeHtml(tenPhuong(phuong))}: ${sl} tấm`;

    let photos;
    if (r._photos.length) {
      photos = '<div class="br-photo-grid">'
        + r._photos.map((u, k) => `
          <div>
            <a href="${escapeHtml(u)}" target="_blank" rel="noopener">
              <img data-src="${escapeHtml(u)}" src="${escapeHtml(u)}" alt="Ảnh ${k + 1}">
            </a>
            <div class="br-photo-cap">Ảnh ${k + 1}</div>
          </div>`).join('')
        + '</div>';
    } else {
      photos = '<p class="br-no-photo">(Chưa có ảnh đính kèm)</p>';
    }

    html += `<div class="br-block">
      <div class="br-block-title">${title}</div>
      <div style="font-size:10pt;color:#333;margin-bottom:4px;">
        Ngày thực hiện: ${escapeHtml(ngay)} · Người thực hiện: ${escapeHtml(r['Người khảo sát'] || '')}
        ${r['Ghi chú'] ? ' · Ghi chú: ' + escapeHtml(r['Ghi chú']) : ''}
      </div>
      ${photos}
    </div>`;
  });

  return html;
}

/** Kiểu A — báo cáo hình ảnh (giống cách báo trên Zalo). */
function renderModeAnh() {
  const rows = state.rows;
  const tong = rows.reduce((s, r) => s + num(r['Số lượng']), 0);

  return `
  <div style="text-align:center;margin-bottom:10px;">
    <div style="font-size:14pt;font-weight:bold;text-transform:uppercase;">
      Báo cáo tháo gỡ băng rôn, quảng cáo trái phép
    </div>
    <div style="font-size:11pt;margin-top:4px;">
      Từ ngày ${escapeHtml(dmy(state.from))} đến ngày ${escapeHtml(dmy(state.to))} — ${escapeHtml(diaBanText())}
    </div>
    <div style="font-size:11pt;font-weight:bold;margin-top:4px;">
      Tổng cộng: ${rows.length} lượt tháo gỡ / ${tong} tấm
    </div>
  </div>

  <div style="font-weight:bold;font-size:11pt;margin-top:10px;">I. BẢNG TỔNG HỢP</div>
  ${buildSummaryTable(rows)}

  ${rows.length ? `<div style="font-weight:bold;font-size:11pt;margin-top:14px;">II. HÌNH ẢNH HIỆN TRƯỜNG</div>` : ''}
  ${buildPhotoBlocks(rows)}
  `;
}

/** Kiểu B — văn bản hành chính, ảnh dồn xuống phụ lục. */
function renderModeVanBan() {
  const rows = state.rows;
  const tong = rows.reduce((s, r) => s + num(r['Số lượng']), 0);
  const now = new Date();

  return `
  <table style="width:100%;border:none;margin-bottom:8px;border-collapse:collapse;">
    <tr>
      <td style="width:50%;vertical-align:top;text-align:center;border:none;padding:0 8px 0 0;">
        <div style="font-size:10pt;font-weight:bold;">CÔNG TY CỔ PHẦN</div>
        <div style="font-size:10pt;font-weight:bold;">CHIẾU SÁNG CÔNG CỘNG TP.HCM</div>
        <div style="font-size:9.5pt;">CHIẾU SÁNG KHU VỰC TRUNG TÂM</div>
        <div style="margin-top:8px;font-size:10pt;">
          Số:&nbsp;<span class="ed" id="ed-so-bc" contenteditable="true" data-ph="___/BC-CSKVTT"></span>
        </div>
      </td>
      <td style="width:50%;vertical-align:top;text-align:center;border:none;padding:0 0 0 8px;">
        <div style="font-size:10.5pt;font-weight:bold;">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
        <div style="font-size:11pt;font-weight:bold;">Độc lập - Tự do - Hạnh phúc</div>
        <div style="margin:2px auto 8px;width:180px;border-bottom:1px solid #000;"></div>
        <div style="font-size:10.5pt;font-style:italic;">
          Tp. Hồ Chí Minh, ngày <span class="ed" id="ed-ngay-ky" contenteditable="true">${now.getDate()}</span>
          tháng <span class="ed" id="ed-thang-ky" contenteditable="true">${now.getMonth() + 1}</span>
          năm <span class="ed" id="ed-nam-ky" contenteditable="true">${now.getFullYear()}</span>
        </div>
      </td>
    </tr>
  </table>

  <div style="text-align:center;margin:14px 0 10px;">
    <div style="font-size:14pt;font-weight:bold;">BÁO CÁO</div>
    <div style="font-size:12pt;font-weight:bold;">
      Về việc tháo gỡ băng rôn, quảng cáo trái phép trên trụ đèn chiếu sáng
    </div>
    <div style="margin:6px auto 0;width:120px;border-bottom:1px solid #000;"></div>
  </div>

  <div style="font-weight:bold;margin-top:10px;">I. THỜI GIAN — ĐỊA BÀN THỰC HIỆN</div>
  <div style="margin-left:14px;">
    <div>- Thời gian: từ ngày ${escapeHtml(dmy(state.from))} đến ngày ${escapeHtml(dmy(state.to))}.</div>
    <div>- Địa bàn: ${escapeHtml(diaBanText())}.</div>
    <div>- Đơn vị thực hiện:
      <span class="ed" id="ed-don-vi" contenteditable="true" data-ph="Đội Chiếu sáng Khu vực Trung tâm"></span>.
    </div>
  </div>

  <div style="font-weight:bold;margin-top:10px;">II. KẾT QUẢ THỰC HIỆN</div>
  <div style="margin-left:14px;">
    Đã tháo gỡ <b>${tong}</b> tấm băng rôn, quảng cáo trái phép qua <b>${rows.length}</b> lượt ra quân,
    chi tiết theo bảng sau:
  </div>
  ${buildSummaryTable(rows)}

  <div style="font-weight:bold;margin-top:10px;">III. NHẬN XÉT — KIẾN NGHỊ</div>
  <div style="margin-left:14px;min-height:40px;">
    <span class="ed" id="ed-nhan-xet" contenteditable="true"
      data-ph="Nhập nhận xét, kiến nghị (nếu có)..."></span>
  </div>

  <table style="width:100%;border:none;margin-top:24px;border-collapse:collapse;">
    <tr>
      <td style="width:50%;text-align:center;border:none;vertical-align:top;">
        <div style="font-weight:bold;">NGƯỜI LẬP BÁO CÁO</div>
        <div style="font-style:italic;font-size:10pt;">(Ký, ghi rõ họ tên)</div>
        <div style="height:60px;"></div>
        <div class="ed" id="ed-nguoi-lap" contenteditable="true" data-ph="Họ và tên"></div>
      </td>
      <td style="width:50%;text-align:center;border:none;vertical-align:top;">
        <div style="font-weight:bold;">LÃNH ĐẠO ĐƠN VỊ</div>
        <div style="font-style:italic;font-size:10pt;">(Ký, ghi rõ họ tên)</div>
        <div style="height:60px;"></div>
        <div class="ed" id="ed-lanh-dao" contenteditable="true" data-ph="Họ và tên"></div>
      </td>
    </tr>
  </table>

  ${rows.length ? `
  <div style="page-break-before:always;break-before:page;margin-top:20px;">
    <div style="text-align:center;font-weight:bold;font-size:12pt;margin-bottom:8px;">
      PHỤ LỤC ẢNH HIỆN TRƯỜNG
    </div>
    ${buildPhotoBlocks(rows)}
  </div>` : ''}
  `;
}

// =====================================================================
// XUẤT PDF (html2canvas + jsPDF) — phải nội tuyến ảnh trước khi capture
// =====================================================================

async function exportPdf() {
  const preview = document.getElementById('report-preview');
  const btn = document.getElementById('btn-pdf');
  const origLabel = btn.textContent;
  btn.disabled = true;

  let restore = [];
  try {
    restore = await inlineImages(preview, (done, total) => {
      btn.textContent = `⏳ Đang nhúng ảnh ${done}/${total}...`;
    });
    btn.textContent = '⏳ Đang tạo PDF...';

    const captureStyle = document.createElement('style');
    captureStyle.id = 'br-capture-style';
    captureStyle.textContent = '.ed { border-bottom: none !important; background: transparent !important; }';
    document.head.appendChild(captureStyle);

    const origMaxWidth = preview.style.maxWidth;
    preview.style.maxWidth = '794px';
    preview.style.width = '794px';
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

    const canvas = await html2canvas(preview, {
      scale: 2, useCORS: true, logging: false,
      backgroundColor: '#ffffff', windowWidth: 794
    });

    preview.style.maxWidth = origMaxWidth;
    preview.style.width = '';
    document.getElementById('br-capture-style')?.remove();

    const imgData = canvas.toDataURL('image/jpeg', 0.92);
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
    const pW = doc.internal.pageSize.getWidth();
    const pH = doc.internal.pageSize.getHeight();
    const imgH = (canvas.height * pW) / canvas.width;

    let heightLeft = imgH;
    let yPos = 0;
    doc.addImage(imgData, 'JPEG', 0, yPos, pW, imgH);
    heightLeft -= pH;
    while (heightLeft > 0) {
      yPos -= pH;
      doc.addPage();
      doc.addImage(imgData, 'JPEG', 0, yPos, pW, imgH);
      heightLeft -= pH;
    }

    doc.save(`BaoCao_BangRon_${state.from}_${state.to}.pdf`);
  } catch (err) {
    showToast('Lỗi xuất PDF: ' + (err.message || err), 'error');
  } finally {
    restoreImages(restore);
    btn.disabled = false;
    btn.textContent = origLabel;
  }
}

// =====================================================================
// XUẤT EXCEL (SheetJS)
// =====================================================================

function exportXlsx() {
  const XLSX = window.XLSX;
  if (!XLSX) { showToast('Thư viện SheetJS chưa tải xong', 'error'); return; }
  if (!state.rows.length) { showToast('Không có dữ liệu để xuất', 'warning'); return; }

  const photoCols = Array.from({ length: MAX_PHOTOS }, (_, i) => `Ảnh ${i + 1}`);
  const headers = [...COLS, 'Username', 'Submitted At', ...photoCols];

  const data = state.rows.map(r => {
    const base = COLS.map(c => (r[c] === null || r[c] === undefined) ? '' : r[c]);
    const photos = Array.from({ length: MAX_PHOTOS }, (_, i) => r._photos[i] || '');
    return [...base, r['Username'] || '', r['Submitted At'] || '', ...photos];
  });

  // Dòng tổng cộng — cột 'Số lượng' theo đúng vị trí trong COLS
  const idxSl = COLS.indexOf('Số lượng');
  const tong = state.rows.reduce((s, r) => s + num(r['Số lượng']), 0);
  const totalRow = headers.map(() => '');
  totalRow[0] = 'TỔNG CỘNG';
  if (idxSl >= 0) totalRow[idxSl] = tong;

  const ws = XLSX.utils.aoa_to_sheet([headers, ...data, [], totalRow]);
  ws['!freeze'] = { xSplit: 0, ySplit: 1 };
  ws['!cols'] = headers.map(h => ({ wch: h.startsWith('Ảnh') ? 45 : Math.max(12, Math.min(28, h.length + 4)) }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, SCHEMA.sheet.substring(0, 31));
  XLSX.writeFile(wb, `BaoCao_BangRon_${state.from}_${state.to}.xlsx`);
}
