// js/bbht.js — Biên bản hiện trường: load dữ liệu + render + xuất Word/PDF
import { apiList } from './api.js';
import { QUAN_LIST, PHUONG_XA } from './lookups.js';
import { inlineImages, restoreImages } from './photos.js';
import { escapeHtml } from './utils.js';

const BBHT_MAP = {
  tang_cuong_den: { label: 'Tăng cường đèn',        dvt: 'Cái', field: 'Số đèn dự kiến'  },
  ngam_hoa:       { label: 'Ngầm hóa',               dvt: 'Cái', field: 'Số đèn dự kiến'  },
  thay_den:       { label: 'Thay đèn',               dvt: 'Cái', field: 'Số đèn hiện hữu' },
  hkn:            { label: 'Hộp kín nước (HKN)',     dvt: 'Cái', field: 'Số lượng'         },
  tc_noi:         { label: 'Thay cáp nổi',           dvt: 'Mét', field: 'Số lượng'         },
  cap_luon_can:   { label: 'Cáp luồn cần đèn',       dvt: 'Bộ',  field: 'Số lượng'         },
  tc_ngam:        { label: 'Thay cáp ngầm',          dvt: 'Mét', field: 'Số lượng'         },
  thay_can:       { label: 'Thay cần đèn',           dvt: 'Cái', field: 'Số lượng'         },
  thay_tru:       { label: 'Thay thế trụ',           dvt: 'Cái', field: 'Số lượng'         },
  choa_den:       { label: 'Thay chóa đèn',          dvt: 'Cái', field: 'Số lượng'         },
  nap_tru:        { label: 'Nắp trụ',                dvt: 'Cái', field: 'Số lượng'         },
  vo_tu:          { label: 'Vỏ tủ điều khiển',       dvt: 'Bộ',  field: 'Số lượng'         },
  tc_den_kc_xa:   { label: 'Tăng cường đèn kc xa',  dvt: 'Cái', field: 'Số lượng'         },
  decal_so_tru:   { label: 'Decal số trụ',           dvt: 'Cái', field: 'Số lượng'         },
  nang_mong:      { label: 'Nâng móng trụ',          dvt: 'Cái', field: 'Số lượng'         },
  thao_go_bang_ron: { label: 'Tháo gỡ băng rôn',     dvt: 'Tấm', field: 'Số lượng'         },
};

const ALL_TYPES = Object.keys(BBHT_MAP);
let state = { rows: [], from: '', to: '', quan: '', phuong: '' };

function todayStr() { return new Date().toISOString().slice(0, 10); }

function parseDate(dateStr) {
  if (!dateStr) return { d: '___', m: '___', y: '2026' };
  const [y, m, d] = dateStr.split('-');
  return { d: parseInt(d, 10), m: parseInt(m, 10), y };
}

function setEdIfPlaceholder(id, val) {
  const el = document.getElementById(id);
  if (!el) return;
  const t = el.textContent.trim();
  if (t === '' || t === '___' || t === '2026') el.textContent = val;
}

export function initBbht(user) {
  const t = todayStr();
  document.getElementById('filter-from').value = t;
  document.getElementById('filter-to').value = t;

  // Quận
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

  // Người khảo sát dropdown — chỉ admin/user
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
    const w = document.getElementById('ktv-wrap');
    if (w) w.classList.add('hidden');
  }

  // Loại KS checkboxes
  const div = document.getElementById('types-checkboxes');
  ALL_TYPES.forEach(type => {
    const lbl = document.createElement('label');
    lbl.className = 'flex items-center gap-1 text-xs cursor-pointer bg-gray-50 px-2 py-1 rounded border hover:bg-blue-50 select-none';
    const cb = document.createElement('input');
    cb.type = 'checkbox'; cb.value = type; cb.checked = true;
    cb.className = 'w-4 h-4 accent-blue-700';
    lbl.appendChild(cb);
    lbl.appendChild(document.createTextNode(' ' + BBHT_MAP[type].label));
    div.appendChild(lbl);
  });
  document.getElementById('btn-all-types').onclick = () =>
    div.querySelectorAll('input').forEach(c => c.checked = true);
  document.getElementById('btn-no-types').onclick = () =>
    div.querySelectorAll('input').forEach(c => c.checked = false);

  document.getElementById('btn-load').onclick = loadData;
  document.getElementById('btn-export-pdf').onclick = exportPdf;
  document.getElementById('btn-export-word').onclick = exportWord;

  // Tick/bỏ tick phụ lục ảnh → vẽ lại ngay để xem trước đúng cái sắp xuất ra
  document.getElementById('chk-photos').onchange = () => {
    if (state.rows && state.rows.length) renderPhotoAppendix(state.rows, state.selTypes);
  };

  // Sync tên đại diện → chữ ký cuối trang (init + live)
  const syncSign = (srcId, dstId) => {
    const src = document.getElementById(srcId);
    const dst = document.getElementById(dstId);
    if (!src || !dst) return;
    dst.textContent = src.textContent; // khởi tạo ban đầu
    src.addEventListener('input', () => { dst.textContent = src.textContent; });
  };
  syncSign('ed-dd1-ten', 'ed-sign-1');
  syncSign('ed-dd2-ten', 'ed-sign-2');
}

async function loadData() {
  const from    = document.getElementById('filter-from').value;
  const to      = document.getElementById('filter-to').value;
  const quan    = document.getElementById('filter-quan').value;
  const phuong  = document.getElementById('filter-phuong').value;
  const ktv     = document.getElementById('filter-ktv')?.value || '';
  const selTypes = [...document.querySelectorAll('#types-checkboxes input:checked')].map(c => c.value);

  if (!from || !to) { alert('Vui lòng chọn khoảng ngày'); return; }
  if (!selTypes.length) { alert('Vui lòng chọn ít nhất 1 loại khảo sát'); return; }

  document.getElementById('loading').classList.remove('hidden');
  document.getElementById('preview-wrap').classList.add('hidden');
  document.getElementById('btn-export-pdf').classList.add('hidden');
  document.getElementById('btn-export-word').classList.add('hidden');

  try {
    const results = await Promise.allSettled(
      selTypes.map(type => apiList({ type, from, to, status: 'active' }))
    );

    let allRows = [];
    results.forEach((res, i) => {
      if (res.status !== 'fulfilled') return;
      const data = res.value;
      const rows = Array.isArray(data) ? data
                 : Array.isArray(data?.rows) ? data.rows
                 : [];
      const type = selTypes[i];
      rows.forEach(row => {
        if (phuong && row['Phường'] !== phuong) return;
        if (!phuong && quan && row['Quận'] !== quan) return;
        if (ktv && row['Username'] !== ktv) return;
        // Ảnh lưu chung 1 ô, phân tách bằng |
        const photos = String(row['Ảnh (URLs)'] || '').split('|').filter(Boolean);
        allRows.push({ ...row, _type: type, _photos: photos });
      });
    });

    state = { rows: allRows, from, to, quan, phuong, selTypes };

    autofillDates(from, to, phuong, quan);
    renderTable(allRows, selTypes);
    renderPhotoAppendix(allRows, selTypes);
    document.getElementById('preview-wrap').classList.remove('hidden');
    document.getElementById('btn-export-pdf').classList.remove('hidden');
    document.getElementById('btn-export-word').classList.remove('hidden');
    const soAnh = allRows.reduce((s, r) => s + r._photos.length, 0);
    document.getElementById('data-summary').textContent =
      `${allRows.length} bản ghi · ${soAnh} ảnh — ${from} → ${to}` +
      `${phuong ? ' · ' + phuong : quan ? ' · ' + quan : ''}`;
  } catch (err) {
    alert('Lỗi tải dữ liệu: ' + (err.message || err));
  } finally {
    document.getElementById('loading').classList.add('hidden');
  }
}

function autofillDates(from, to, phuong, quan) {
  const f = parseDate(from);
  const t = parseDate(to);
  const n = parseDate(todayStr());

  // Ngày ký văn bản (header)
  setEdIfPlaceholder('ed-ngay-ky',   n.d);
  setEdIfPlaceholder('ed-thang-ky',  n.m);
  setEdIfPlaceholder('ed-nam-ky',    n.y);
  // Năm ngân sách
  setEdIfPlaceholder('ed-nam-ns',    n.y);
  // Thời gian kiểm tra bắt đầu
  setEdIfPlaceholder('ed-ngay-ks',   f.d);
  setEdIfPlaceholder('ed-thang-ks',  f.m);
  setEdIfPlaceholder('ed-nam-ks',    f.y);
  // Thời gian kết thúc
  setEdIfPlaceholder('ed-ngay-ks2',  t.d);
  setEdIfPlaceholder('ed-thang-ks2', t.m);
  setEdIfPlaceholder('ed-nam-ks2',   t.y);

  // Gói thầu: cập nhật địa bàn từ filter nếu có
  const goi = document.getElementById('ed-goi-thau');
  if (goi) {
    const loc = phuong ? `Phường ${phuong}` : quan ? quan : '';
    if (loc) {
      const cur = goi.textContent.trim();
      if (!cur || cur === goi.getAttribute('data-ph')) {
        goi.textContent = loc + ', TP.HCM';
      }
    }
  }

  // Địa điểm
  const ddEl = document.getElementById('ed-dia-diem');
  if (ddEl) {
    const cur = ddEl.textContent.trim();
    if (!cur || cur === ddEl.getAttribute('data-ph')) {
      const loc = phuong ? `Phường ${phuong}` : quan ? quan : 'Các tuyến đường trên địa bàn TP.HCM';
      ddEl.textContent = loc;
    }
  }
}

function renderTable(allRows, selTypes) {
  // Group theo loại (giữ thứ tự ALL_TYPES)
  const grouped = {};
  allRows.forEach(row => {
    if (!grouped[row._type]) grouped[row._type] = [];
    grouped[row._type].push(row);
  });

  const tbody = document.getElementById('bbht-table-body');
  let html = '';
  let stt = 1;
  let hasData = false;

  for (const type of ALL_TYPES) {
    if (!selTypes.includes(type)) continue;
    const recs = grouped[type];
    if (!recs || !recs.length) continue;
    hasData = true;
    const meta = BBHT_MAP[type];

    // Header nhóm loại KS
    html += `<tr style="background:#dce7f5;">
      <td colspan="7" style="padding:4px 8px;font-weight:bold;border:1px solid #777;font-size:10pt;">
        ${meta.label}
      </td>
    </tr>`;

    recs.forEach(row => {
      const kl   = row[meta.field] ?? '';
      const tuyen = row['Tuyến đường'] || '';
      const ph    = row['Phường'] || '';
      const qn    = row['Quận']   || '';
      const loc   = [ph, qn].filter(Boolean).join(', ');
      const ghi   = row['Ghi chú'] || '';

      html += `<tr>
        <td style="text-align:center;padding:3px 5px;border:1px solid #bbb;">${stt++}</td>
        <td style="padding:3px 5px;border:1px solid #bbb;">${meta.label}</td>
        <td style="padding:3px 5px;border:1px solid #bbb;">${tuyen}</td>
        <td style="padding:3px 5px;border:1px solid #bbb;">${loc}</td>
        <td style="text-align:center;padding:3px 5px;border:1px solid #bbb;">${meta.dvt}</td>
        <td style="text-align:center;padding:3px 5px;border:1px solid #bbb;font-weight:bold;">${kl}</td>
        <td style="padding:3px 5px;border:1px solid #bbb;">${ghi}</td>
      </tr>`;
    });
  }

  if (!hasData) {
    html = `<tr><td colspan="7" style="text-align:center;color:#888;padding:16px;border:1px solid #bbb;">
      Không có dữ liệu khảo sát trong khoảng thời gian và điều kiện đã chọn.
    </td></tr>`;
  }

  tbody.innerHTML = html;
  document.getElementById('preview-date-range').textContent = `${state.from} → ${state.to}`;
  document.getElementById('preview-total').textContent = `${allRows.length} bản ghi`;
}

/**
 * Dựng phụ lục ảnh ở cuối biên bản.
 *
 * Dùng <table> 3 cột thay vì CSS grid: Word KHÔNG hiểu CSS grid/flex, để grid
 * thì mở file .doc ra ảnh xếp dọc 1 cột, xấu và tốn giấy.
 * Mỗi <img> giữ URL gốc ở data-src để lúc xuất file đổi sang data: URL.
 */
function renderPhotoAppendix(allRows, selTypes) {
  const box = document.getElementById('bbht-photos');
  if (!box) return;

  const kem = document.getElementById('chk-photos')?.checked;
  const coAnh = allRows.filter(r => r._photos && r._photos.length);
  if (!kem || !coAnh.length) { box.innerHTML = ''; return; }

  let html = '<div style="page-break-before:always;break-before:page;padding-top:12px;">'
    + '<div style="text-align:center;font-size:12pt;font-weight:bold;margin-bottom:8px;">'
    + 'PHỤ LỤC ẢNH HIỆN TRƯỜNG</div>';

  let stt = 1;
  for (const type of ALL_TYPES) {
    if (!selTypes.includes(type)) continue;
    const recs = coAnh.filter(r => r._type === type);
    if (!recs.length) continue;
    const meta = BBHT_MAP[type];

    for (const row of recs) {
      // Sau sáp nhập, nhiều phường trùng tên quận cũ → bỏ trùng, tránh "Phú Nhuận, Phú Nhuận"
      const diaChi = [...new Set([row['Phường'], row['Quận']].filter(Boolean))]
        .map(escapeHtml).join(', ');
      const tuyen = escapeHtml(row['Tuyến đường'] || '');
      html += `<div class="bb-photo-title">${stt++}. ${escapeHtml(meta.label)}`
            + `${tuyen ? ' — ' + tuyen : ''}${diaChi ? ', ' + diaChi : ''}`
            + ` (STT #${escapeHtml(String(row['STT'] || ''))})</div>`;

      html += '<table class="bb-photo-table"><tr>';
      row._photos.forEach((u, i) => {
        if (i > 0 && i % 3 === 0) html += '</tr><tr>';
        html += `<td><img data-src="${escapeHtml(u)}" src="${escapeHtml(u)}" alt="Ảnh ${i + 1}">`
              + `<div class="bb-photo-cap">Ảnh ${i + 1}</div></td>`;
      });
      // Chèn ô trống cho đủ 3 cột, tránh Word kéo giãn ô cuối
      const du = row._photos.length % 3;
      if (du) for (let i = du; i < 3; i++) html += '<td></td>';
      html += '</tr></table>';
    }
  }

  html += '</div>';
  box.innerHTML = html;
}

/**
 * Xuất file Word (.doc).
 *
 * Cách làm: đóng gói chính nội dung đang xem thành HTML kiểu Word rồi tải về.
 * Word mở được HTML và giữ nguyên bảng/canh lề/khổ giấy, lại sửa được — hợp với
 * biên bản cần điền thêm tay, khác PDF chỉ để in.
 *
 * Ảnh phải nhúng dạng data: URL, không để URL Drive — nếu để URL thì mở ở máy
 * khác (hoặc gửi qua email) là ảnh mất, vì người nhận không đăng nhập được.
 */
async function exportWord() {
  const preview = document.getElementById('bbht-preview');
  const btn = document.getElementById('btn-export-word');
  const nhanGoc = btn.textContent;
  btn.disabled = true;

  let restore = [];
  try {
    restore = await inlineImages(preview, (done, total) => {
      btn.textContent = total ? `⏳ Đang nhúng ảnh ${done}/${total}...` : '⏳ Đang tạo...';
    });
    btn.textContent = '⏳ Đang tạo file Word...';

    // Bản sao để cắt gọt, không đụng vào bản đang hiển thị
    const clone = preview.cloneNode(true);
    clone.querySelectorAll('.no-capture').forEach(el => el.remove());
    // Ô sửa tay: bỏ gạch chấm, và bỏ chữ gợi ý của ô còn trống
    clone.querySelectorAll('.ed').forEach(el => {
      el.removeAttribute('contenteditable');
      el.style.borderBottom = 'none';
      el.style.background = 'transparent';
    });
    clone.querySelectorAll('img').forEach(img => img.removeAttribute('data-src'));

    const html = buildWordHtml(clone.innerHTML);
    const blob = new Blob(['﻿', html], { type: 'application/msword' });
    const slug = [state.from, state.to, (state.phuong || state.quan || '')]
      .filter(Boolean).join('_').replace(/[\s,/\\]/g, '_');
    taiVe(blob, `BBHT_${slug}.doc`);
  } catch (err) {
    alert('Lỗi xuất Word: ' + (err.message || err));
  } finally {
    restoreImages(restore);
    btn.disabled = false;
    btn.textContent = nhanGoc;
  }
}

/** Bọc nội dung vào khung HTML mà Word hiểu (khổ A4, lề, font Times). */
function buildWordHtml(inner) {
  return `<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="utf-8">
<title>Biên bản hiện trường</title>
<!--[if gte mso 9]><xml>
  <w:WordDocument>
    <w:View>Print</w:View>
    <w:Zoom>100</w:Zoom>
    <w:DoNotOptimizeForBrowser/>
  </w:WordDocument>
</xml><![endif]-->
<style>
@page { size: 21cm 29.7cm; margin: 1.5cm 1.5cm 1.5cm 2cm; }
body { font-family: 'Times New Roman', Times, serif; font-size: 12pt; line-height: 1.45; color: #000; }
table { border-collapse: collapse; }
#bbht-table { width: 100%; font-size: 10pt; margin-top: 6px; }
#bbht-table th { background: #e8edf4; border: 1px solid #555; padding: 4px 5px; text-align: center; font-weight: bold; }
#bbht-table td { border: 1px solid #999; padding: 3px 5px; vertical-align: top; }
.bb-photo-title { font-size: 10.5pt; font-weight: bold; margin: 10px 0 4px; }
.bb-photo-table { width: 100%; }
.bb-photo-table td { width: 33.33%; padding: 3px; vertical-align: top; text-align: center; border: none; }
.bb-photo-table img { width: 100%; max-width: 175px; border: 1px solid #999; }
.bb-photo-cap { font-size: 8pt; color: #555; }
.ed { border: none; background: transparent; }
</style>
</head>
<body>${inner}</body>
</html>`;
}

/** Tải blob về máy với tên file cho trước. */
function taiVe(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function exportPdf() {
  const preview = document.getElementById('bbht-preview');
  const btn = document.getElementById('btn-export-pdf');
  btn.disabled = true;
  btn.textContent = '⏳ Đang tạo PDF...';

  let restore = [];
  try {
    // Nhúng ảnh trước khi chụp — để URL thì html2canvas vẽ ra ô trắng
    restore = await inlineImages(preview, (done, total) => {
      btn.textContent = `⏳ Đang nhúng ảnh ${done}/${total}...`;
    });
    btn.textContent = '⏳ Đang tạo PDF...';

    // Ẩn các phần tử chỉ dùng trên web, không in
    const noCapture = preview.querySelectorAll('.no-capture');
    noCapture.forEach(el => (el.style.visibility = 'hidden'));

    // Tạm ẩn đường kẻ chấm của contenteditable
    const captureStyle = document.createElement('style');
    captureStyle.id = 'bbht-capture-style';
    captureStyle.textContent = '.ed { border-bottom: none !important; background: transparent !important; }';
    document.head.appendChild(captureStyle);

    // Đặt chiều rộng cố định A4 để capture
    const origMaxWidth = preview.style.maxWidth;
    preview.style.maxWidth = '794px';
    preview.style.width = '794px';

    // Chờ reflow
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

    const canvas = await html2canvas(preview, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      windowWidth: 794,
    });

    // Khôi phục style
    preview.style.maxWidth = origMaxWidth;
    preview.style.width = '';
    document.getElementById('bbht-capture-style')?.remove();
    noCapture.forEach(el => (el.style.visibility = ''));

    // Tạo PDF A4
    const imgData = canvas.toDataURL('image/jpeg', 0.93);
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });

    const pW = doc.internal.pageSize.getWidth();   // 210mm
    const pH = doc.internal.pageSize.getHeight();  // 297mm
    const imgW = pW;
    const imgH = (canvas.height * pW) / canvas.width;

    // Phân trang nếu nội dung dài hơn 1 trang
    let heightLeft = imgH;
    let yPos = 0;
    doc.addImage(imgData, 'JPEG', 0, yPos, imgW, imgH);
    heightLeft -= pH;

    while (heightLeft > 0) {
      yPos -= pH;
      doc.addPage();
      doc.addImage(imgData, 'JPEG', 0, yPos, imgW, imgH);
      heightLeft -= pH;
    }

    // Tên file
    const slug = [state.from, state.to, (state.phuong || state.quan || '')]
      .filter(Boolean).join('_').replace(/[\s,/\\]/g, '_');
    doc.save(`BBHT_${slug}.pdf`);
  } catch (err) {
    alert('Lỗi xuất PDF: ' + (err.message || err));
  } finally {
    restoreImages(restore);
    btn.disabled = false;
    btn.textContent = '📄 Xuất PDF';
  }
}
