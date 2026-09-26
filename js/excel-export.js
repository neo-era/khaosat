// js/excel-export.js — Xuất Excel có định dạng (ExcelJS).
// SheetJS bản miễn phí không ghi được định dạng ô (màu, khung, cố định dòng) nên phần XUẤT
// dùng ExcelJS; phần ĐỌC file khi "Nhập Excel" vẫn dùng SheetJS như cũ.
// ExcelJS ~1MB → chỉ tải khi người dùng bấm nút xuất.

const EXCELJS_URL = 'https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js';
let loadingPromise = null;

export function loadExcelJS() {
  if (window.ExcelJS) return Promise.resolve(window.ExcelJS);
  if (!loadingPromise) {
    loadingPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = EXCELJS_URL;
      s.onload = () => resolve(window.ExcelJS);
      s.onerror = () => {
        loadingPromise = null;
        reject(new Error('Không tải được thư viện Excel — kiểm tra kết nối mạng'));
      };
      document.head.appendChild(s);
    });
  }
  return loadingPromise;
}

export async function newWorkbook() {
  const ExcelJS = await loadExcelJS();
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Khảo sát chiếu sáng';
  wb.created = new Date();
  return wb;
}

const COLOR = {
  title: 'FF1E3A8A',
  sub: 'FF6B7280',
  head: 'FF1E40AF',
  headText: 'FFFFFFFF',
  zebra: 'FFF3F6FB',
  total: 'FFE5E7EB',
  border: 'FFBFC7D5'
};
const THIN = { style: 'thin', color: { argb: COLOR.border } };
const BOX = { top: THIN, left: THIN, bottom: THIN, right: THIN };
const FONT = 'Arial';

/** Tên tab hợp lệ: ≤31 ký tự, không chứa []:*?/\ , không trùng trong workbook. */
function safeSheetName(wb, name) {
  let base = String(name || 'Sheet').replace(/[\[\]:*?\/\\]/g, ' ').trim().slice(0, 31) || 'Sheet';
  let n = base, i = 2;
  while (wb.getWorksheet(n)) n = base.slice(0, 28) + ' ' + i++;
  return n;
}

function textWidth(v) {
  if (v === null || v === undefined || v === '') return 0;
  if (v instanceof Date) return 16;
  if (typeof v === 'object' && v.text) v = v.text;
  return Math.max(...String(v).split('\n').map(l => l.length));
}

function numFmtOf(v) {
  return Number.isInteger(v) ? '#,##0' : '#,##0.0';
}

function autoWidths(ws, headers, rows, { min = 8, max = 45 } = {}) {
  headers.forEach((h, c) => {
    let w = textWidth(h) + 2;
    for (let r = 0; r < rows.length && r < 500; r++) w = Math.max(w, textWidth(rows[r][c]) + 2);
    ws.getColumn(c + 1).width = Math.max(min, Math.min(max, w));
  });
}

function styleHeaderRow(row) {
  row.height = 30;
  row.eachCell(cell => {
    cell.font = { name: FONT, bold: true, size: 10, color: { argb: COLOR.headText } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR.head } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = BOX;
  });
}

function styleDataRow(row, n, zebra) {
  for (let c = 1; c <= n; c++) {
    const cell = row.getCell(c);
    const v = cell.value;
    cell.font = { name: FONT, size: 10 };
    cell.border = BOX;
    if (typeof v === 'number') {
      cell.numFmt = numFmtOf(v);
      cell.alignment = { vertical: 'middle', horizontal: 'right' };
    } else {
      cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: false };
    }
    if (v && typeof v === 'object' && v.hyperlink) {
      cell.font = { name: FONT, size: 10, color: { argb: 'FF1D4ED8' }, underline: true };
    }
    if (zebra) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR.zebra } };
  }
}

function setupPrint(ws, headerRow, landscape) {
  ws.pageSetup = {
    paperSize: 9,                        // A4
    orientation: landscape ? 'landscape' : 'portrait',
    fitToPage: true, fitToWidth: 1, fitToHeight: 0,
    margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
    printTitlesRow: `${headerRow}:${headerRow}`
  };
  ws.headerFooter = { oddFooter: '&R&8Trang &P / &N' };
}

/**
 * Sheet báo cáo tổng hợp: tên báo cáo + dòng thời gian, bảng có khung/sọc,
 * cố định dòng tiêu đề, bộ lọc, dòng TỔNG CỘNG, sẵn in A4.
 *
 * @param opts.title      Tên báo cáo (in đậm, gộp ô)
 * @param opts.subtitle   Dòng thời gian / ghi chú
 * @param opts.headers    Tiêu đề cột
 * @param opts.rows       Mảng dòng dữ liệu
 * @param opts.total      Dòng tổng (mảng cùng độ dài headers) hoặc null
 * @param opts.freezeCols Số cột cố định bên trái (mặc định 1)
 * @param opts.cellFill   (value, rowIdx, colIdx) → màu ARGB hoặc null (tô màu có điều kiện)
 * @param opts.landscape  Mặc định true
 */
export function addReportSheet(wb, name, opts) {
  const { title, subtitle, headers, rows, total = null, freezeCols = 1, cellFill = null, landscape = true } = opts;
  const ws = wb.addWorksheet(safeSheetName(wb, name));
  const n = headers.length;

  ws.mergeCells(1, 1, 1, n);
  const t = ws.getCell(1, 1);
  t.value = title;
  t.font = { name: FONT, bold: true, size: 14, color: { argb: COLOR.title } };
  t.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(1).height = 24;

  ws.mergeCells(2, 1, 2, n);
  const s = ws.getCell(2, 1);
  s.value = subtitle || '';
  s.font = { name: FONT, italic: true, size: 10, color: { argb: COLOR.sub } };
  s.alignment = { horizontal: 'center' };

  const HR = 4;
  const hr = ws.getRow(HR);
  hr.values = headers;
  styleHeaderRow(hr);

  rows.forEach((r, i) => {
    const row = ws.getRow(HR + 1 + i);
    row.values = r;
    styleDataRow(row, n, i % 2 === 1);
    if (cellFill) {
      r.forEach((v, c) => {
        const argb = cellFill(v, i, c);
        if (argb) row.getCell(c + 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb } };
      });
    }
  });

  if (total) {
    const row = ws.getRow(HR + 1 + rows.length);
    row.values = total;
    for (let c = 1; c <= n; c++) {
      const cell = row.getCell(c);
      cell.font = { name: FONT, bold: true, size: 10 };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR.total } };
      cell.border = { ...BOX, top: { style: 'medium', color: { argb: 'FF6B7280' } } };
      if (typeof cell.value === 'number') {
        cell.numFmt = numFmtOf(cell.value);
        cell.alignment = { horizontal: 'right' };
      }
    }
  }

  autoWidths(ws, headers, total ? rows.concat([total]) : rows);
  ws.views = [{ state: 'frozen', xSplit: freezeCols, ySplit: HR }];
  if (rows.length) ws.autoFilter = { from: { row: HR, column: 1 }, to: { row: HR + rows.length, column: n } };
  setupPrint(ws, HR, landscape);
  return ws;
}

/**
 * Sheet dữ liệu thô: DÒNG 1 = tiêu đề cột nguyên văn (để "Nhập Excel" đọc lại được),
 * chỉ thêm định dạng — không chèn dòng tiêu đề báo cáo phía trên.
 */
export function addRawSheet(wb, name, headers, rows) {
  const ws = wb.addWorksheet(safeSheetName(wb, name));
  const n = headers.length;
  const hr = ws.getRow(1);
  hr.values = headers;
  styleHeaderRow(hr);
  rows.forEach((r, i) => {
    const row = ws.getRow(2 + i);
    row.values = r.map(v => (v === null || v === undefined ? '' : v));
    styleDataRow(row, n, i % 2 === 1);
  });
  autoWidths(ws, headers, rows, { min: 8, max: 40 });
  ws.views = [{ state: 'frozen', xSplit: 1, ySplit: 1 }];
  if (rows.length) ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1 + rows.length, column: n } };
  setupPrint(ws, 1, true);
  return ws;
}

export async function downloadWorkbook(wb, filename) {
  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

/** "2026-09-01" → "01/09/2026"; rỗng → '' */
export function vnDate(iso) {
  const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
}

/** Dòng thời gian chuẩn cho mọi báo cáo. */
export function periodLine(from, to) {
  const p = from || to
    ? `Thời gian: ${from ? 'từ ' + vnDate(from) : ''}${to ? ' đến ' + vnDate(to) : ''}`.replace('Thời gian:  đến', 'Thời gian: đến')
    : 'Thời gian: toàn bộ';
  const now = new Date();
  const pad = x => String(x).padStart(2, '0');
  return `${p} · Xuất ngày ${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
}
