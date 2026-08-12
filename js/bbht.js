// js/bbht.js — Biên bản hiện trường: load dữ liệu + render + xuất PDF
import { apiList } from './api.js';
import { QUAN_LIST, PHUONG_XA } from './lookups.js';

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

  // KTV dropdown — chỉ admin/user
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
        allRows.push({ ...row, _type: type });
      });
    });

    state = { rows: allRows, from, to, quan, phuong, selTypes };

    autofillDates(from, to, phuong, quan);
    renderTable(allRows, selTypes);
    document.getElementById('preview-wrap').classList.remove('hidden');
    document.getElementById('btn-export-pdf').classList.remove('hidden');
    document.getElementById('data-summary').textContent =
      `${allRows.length} bản ghi — ${from} → ${to}${phuong ? ' · ' + phuong : quan ? ' · ' + quan : ''}`;
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

async function exportPdf() {
  const preview = document.getElementById('bbht-preview');
  const btn = document.getElementById('btn-export-pdf');
  btn.disabled = true;
  btn.textContent = '⏳ Đang tạo PDF...';

  try {
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
    btn.disabled = false;
    btn.textContent = '📄 Xuất PDF';
  }
}
