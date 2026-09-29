// js/bcsc.js — Xuất biên bản "BÁO CÁO SỰ CỐ công tác quản lý, bảo dưỡng hệ thống" (BCSC)
// từ bản ghi loại `bao_cao_su_co`. Bố cục bám mẫu PDF user cung cấp (2026-09-29).
// Số BCSC người lập tự ghi; mục 7 (ý kiến chuyên viên) và 10 (kết quả xử lý) để trống cho ký tay.

import { apiList } from './api.js';
import { escapeHtml, showToast } from './utils.js';
import { inlineImages, restoreImages } from './photos.js';

const TYPE = 'bao_cao_su_co';
const MAU_KEY = 'bcsc_mau';   // localStorage: dòng Công tác + tên người ký lần sửa gần nhất

/** Mặc định lấy đúng theo mẫu PDF; người lập sửa trên biên bản → app nhớ cho lần sau. */
const MAU_MAC_DINH = {
  'ed-cong-tac': 'Duy trì trạm đèn; Gói thầu Cung cấp dịch vụ sự nghiệp công sử dụng kinh phí ngân sách nhà nước công tác duy trì hệ thống chiếu sáng đô thị trên địa bàn các quận 12, Gò Vấp, Tân Bình, Tân Phú (từ ngày 01/4/2023 đến hết ngày 31/3/2026).',
  'ed-cty': 'Công ty Cổ phần Chiếu sáng công cộng TP.HCM',
  'ed-ky-cv': 'Phạm Xuân Sơn',
  'ed-ky-kt': 'Phạm Duy Thông',
  'ed-ky-pkt': 'Nguyễn Huy Khương'
};

const state = { rows: [], current: null };
const $ = id => document.getElementById(id);

export function initBcsc() {
  const now = new Date();
  $('f-to').value = now.toISOString().slice(0, 10);
  $('f-from').value = new Date(now.getTime() - 30 * 86400000).toISOString().slice(0, 10);
  $('btn-load').onclick = load;
  $('f-search').addEventListener('input', renderList);
  $('btn-print').onclick = () => window.print();
  $('btn-word').onclick = exportWord;
  $('btn-close').onclick = () => { $('doc-area').classList.add('hidden'); state.current = null; };

  // Mở thẳng 1 bản từ trang Quản lý: bcsc.html?stt=SC-...
  const stt = new URLSearchParams(location.search).get('stt');
  if (stt) openByStt(stt); else load();
}

async function load() {
  $('loading').classList.remove('hidden');
  try {
    const res = await apiList({ type: TYPE, status: 'active',
      from: $('f-from').value ? $('f-from').value + 'T00:00:00' : undefined,
      to: $('f-to').value ? $('f-to').value + 'T23:59:59' : undefined });
    state.rows = (res.rows || []).sort((a, b) => String(b['Submitted At']).localeCompare(String(a['Submitted At'])));
    renderList();
  } catch (e) {
    showToast('Lỗi tải danh sách: ' + e.message, 'error', 5000);
  } finally {
    $('loading').classList.add('hidden');
  }
}

async function openByStt(stt) {
  try {
    const res = await apiList({ type: TYPE, stt, status: 'all' });
    const r = (res.rows || [])[0];
    if (!r) { showToast('Không tìm thấy bản ghi #' + stt, 'error'); return load(); }
    state.rows = [r];
    renderList();
    openDoc(r);
  } catch (e) {
    showToast('Lỗi: ' + e.message, 'error', 5000);
  }
}

function fold(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
}

/** Ô ngày giờ: "2026-09-29 10:05", ISO có Z, hoặc Date → { date: 'dd/mm/yyyy', time: 'HH:mm', d, m, y }. */
function parseNgay(v) {
  const s = String(v ?? '').trim();
  const p = n => String(n).padStart(2, '0');
  let d = null;
  if (v instanceof Date) d = v;
  else if (/[zZ]$/.test(s)) d = new Date(s);
  if (d && !isNaN(d)) {
    return { date: `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`, time: `${p(d.getHours())}:${p(d.getMinutes())}`,
             d: d.getDate(), m: d.getMonth() + 1, y: d.getFullYear() };
  }
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/);
  if (m) return { date: `${m[3]}/${m[2]}/${m[1]}`, time: m[4] ? `${m[4]}:${m[5]}` : '', d: +m[3], m: +m[2], y: +m[1] };
  return { date: s, time: '', d: '', m: '', y: '' };
}

function renderList() {
  const q = fold($('f-search').value.trim());
  const list = state.rows.filter(r => !q || fold(['Tủ điều khiển', 'Mã tủ', 'Tuyến đường', 'Phường', 'Hiện trạng sự cố', 'Người khảo sát']
    .map(k => r[k]).join(' ')).includes(q));
  $('count').textContent = `${list.length} báo cáo sự cố`;
  const box = $('list');
  box.innerHTML = '';
  if (!list.length) {
    box.innerHTML = '<p class="text-sm text-gray-500 bg-white rounded-lg p-3">Không có báo cáo sự cố nào trong khoảng thời gian này.</p>';
    return;
  }
  for (const r of list) {
    const ng = parseNgay(r['Ngày giờ phát hiện']);
    const card = document.createElement('div');
    card.className = 'bg-white rounded-lg shadow-sm p-3 flex flex-col gap-1';
    card.innerHTML = `
      <div class="flex justify-between gap-2 text-xs text-gray-500">
        <span class="font-mono">#${escapeHtml(String(r['STT']))}</span>
        <span>${escapeHtml(ng.date)} ${escapeHtml(ng.time)}</span>
      </div>
      <div class="font-semibold text-sm">🚨 Tủ ${escapeHtml(r['Tủ điều khiển'] || '')}${r['Mã tủ'] ? ' (' + escapeHtml(r['Mã tủ']) + ')' : ''}</div>
      <div class="text-xs text-gray-600">${escapeHtml([r['Tuyến đường'], r['Phường']].filter(Boolean).join(', '))} · ${escapeHtml(r['Người khảo sát'] || '')}</div>
      <div class="text-sm text-gray-800 line-clamp-2">${escapeHtml(r['Hiện trạng sự cố'] || '')}</div>
      <button class="mt-1 self-start bg-blue-700 text-white px-3 rounded-lg text-sm" style="min-height:44px">📄 Lập biên bản</button>`;
    card.querySelector('button').onclick = () => openDoc(r);
    box.appendChild(card);
  }
}

function readMau() {
  try { return Object.assign({}, MAU_MAC_DINH, JSON.parse(localStorage.getItem(MAU_KEY) || '{}')); }
  catch (e) { return Object.assign({}, MAU_MAC_DINH); }
}

function saveMau() {
  const mau = {};
  Object.keys(MAU_MAC_DINH).forEach(id => { const el = $(id); if (el) mau[id] = el.textContent.trim(); });
  try { localStorage.setItem(MAU_KEY, JSON.stringify(mau)); } catch (e) { /* bỏ qua */ }
}

/** Ô sửa tay: nội dung ban đầu đã escape. */
function ed(id, val, ph, block) {
  return `<span class="ed${block ? ' ed-block' : ''}" id="${id}" contenteditable="true" data-ph="${escapeHtml(ph || '')}">${escapeHtml(val ?? '')}</span>`;
}

function openDoc(r) {
  state.current = r;
  const mau = readMau();
  const ng = parseNgay(r['Ngày giờ phát hiện']);
  const donVi = `${r['Đơn vị báo cáo'] || 'Chiếu sáng khu vực Trung tâm'} - ${mau['ed-cty']}`;
  const diaDiem = `Tủ ${r['Tủ điều khiển'] || ''}${r['Mã tủ'] ? ' (mã tủ ' + r['Mã tủ'] + ')' : ''}` +
    (r['Tuyến đường'] ? ', ' + r['Tuyến đường'] : '') + (r['Phường'] ? ', phường ' + r['Phường'] : '') +
    (r['Quận'] ? ', ' + r['Quận'] : '');
  const nguyenNhan = [r['Nguyên nhân sơ bộ'], r['Năm lắp đặt'] ? 'Năm lắp đặt ' + r['Năm lắp đặt'] : ''].filter(Boolean).join('. ');
  const photos = String(r['Ảnh (URLs)'] || '').split('|').filter(Boolean);
  const photoRows = [];
  for (let i = 0; i < photos.length; i += 2) photoRows.push(photos.slice(i, i + 2));

  $('bcsc-preview').innerHTML = `
    <table class="bc-head"><tr>
      <td style="width:45%"><b>CÔNG TY CỔ PHẦN<br>CHIẾU SÁNG CÔNG CỘNG TP. HCM</b><br>
        <span style="display:inline-block;width:45%;border-top:1px solid #000;margin:2px 0 6px"></span><br>
        Số: ${ed('ed-so', r['Số BCSC'] || '', '............/BCSC-CSKVTT')}</td>
      <td style="width:55%"><b>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</b><br><b>Độc lập - Tự do - Hạnh phúc</b><br>
        <span style="display:inline-block;width:40%;border-top:1px solid #000;margin-top:2px"></span></td>
    </tr></table>
    <p style="text-align:right;font-style:italic;margin:10px 0 6px">Tp. Hồ Chí Minh, ngày ${ed('ed-ngay', String(ng.d), '__')} tháng ${ed('ed-thang', String(ng.m), '__')} năm ${ed('ed-nam', String(ng.y || new Date().getFullYear()), '____')}</p>
    <p style="text-align:center;font-weight:bold;font-size:14pt;margin:0">BÁO CÁO SỰ CỐ</p>
    <p style="text-align:center;font-weight:bold;font-size:14pt;margin:0 0 4px">CÔNG TÁC QUẢN LÝ, BẢO DƯỠNG HỆ THỐNG</p>
    <p style="text-align:center">Công tác: ${ed('ed-cong-tac', mau['ed-cong-tac'], 'Công tác / gói thầu')}</p>
    <p><b>1- Đơn vị báo cáo:</b> ${ed('ed-don-vi', donVi)}</p>
    <p><b>Người kiểm tra, phát hiện:</b> ${ed('ed-nguoi', r['Người khảo sát'] || '')}</p>
    <p><b>2- Tên, địa điểm hệ thống bị sự cố:</b> ${ed('ed-dia-diem', diaDiem)}</p>
    <p><b>3- Ngày giờ:</b> ${ed('ed-ngay-gio', [ng.date, ng.time].filter(Boolean).join(' '))}</p>
    <p><b>4- Ghi nhận hiện trạng sự cố:</b></p>
    <p>${ed('ed-hien-trang', r['Hiện trạng sự cố'] || '', 'Hiện trạng sự cố', true)}</p>
    <p><b>5- Sơ bộ xác định nguyên nhân của sự cố:</b> ${ed('ed-nguyen-nhan', nguyenNhan, 'Nguyên nhân')}</p>
    <p><b>6- Đề xuất biện pháp khắc phục (quy mô, khối lượng dự kiến thực hiện):</b> ${ed('ed-de-xuat', r['Đề xuất khắc phục'] || '', 'Biện pháp khắc phục')}</p>
    <p><b>7- Ý kiến của Chuyên viên quản lý địa bàn:</b></p>
    <p>- Cho phép triển khai công việc: Có ☐ &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; Không ☐</p>
    <p>- Ý kiến khác: ${ed('ed-y-kien', '', '')}</p>
    <p style="letter-spacing:1px;overflow:hidden;white-space:nowrap">${'.'.repeat(160)}</p>
    <table class="bc-sign"><tr>
      <td>CHUYÊN VIÊN QUẢN LÝ ĐỊA BÀN<div class="space"></div>${ed('ed-ky-cv', mau['ed-ky-cv'], 'Họ tên')}</td>
      <td>PHỤ TRÁCH KỸ THUẬT THI CÔNG<div class="space"></div>${ed('ed-ky-kt', mau['ed-ky-kt'], 'Họ tên')}<br>PHÒNG KỸ THUẬT<div class="space"></div>${ed('ed-ky-pkt', mau['ed-ky-pkt'], 'Họ tên')}</td>
    </tr></table>

    <div class="page-break"></div>
    <p style="margin-top:6px"><b>10- Ghi nhận kết quả xử lý:</b></p>
    <p>- Chất lượng: ${'.'.repeat(110)}</p>
    <p>- Thời gian thực hiện: ${'.'.repeat(98)}</p>
    <p style="text-align:right;font-weight:bold;margin:8px 40px 0 0">GIÁM ĐỐC ĐƠN VỊ</p>
    <div style="height:90px"></div>
    <p><b>11 - Hình ảnh, file đính kèm:</b></p>
    ${photos.length
      ? `<table class="bc-photos">${photoRows.map(row => `<tr>${row.map(u => `<td><img src="${escapeHtml(u)}" alt="Ảnh hiện trường sự cố"></td>`).join('')}${row.length < 2 ? '<td></td>' : ''}</tr>`).join('')}</table>`
      : '<p style="font-style:italic;color:#666">(Không có ảnh đính kèm)</p>'}`;

  Object.keys(MAU_MAC_DINH).forEach(id => { const el = $(id); if (el) el.addEventListener('blur', saveMau); });
  // Đổi tên công ty trong mục 1 cũng được nhớ (phần sau dấu "- ")
  $('ed-don-vi').addEventListener('blur', () => {
    const t = $('ed-don-vi').textContent;
    const i = t.indexOf('- ');
    if (i >= 0) {
      const mau2 = readMau();
      mau2['ed-cty'] = t.slice(i + 2).trim();
      try { localStorage.setItem(MAU_KEY, JSON.stringify(mau2)); } catch (e) { /* bỏ qua */ }
    }
  });
  $('doc-area').classList.remove('hidden');
  $('doc-area').scrollIntoView({ behavior: 'smooth' });
}

// =====================================================================
// XUẤT WORD — cùng cách trang Biên bản hiện trường (HTML mà Word mở được)
// =====================================================================

async function exportWord() {
  if (!state.current) return;
  const preview = $('bcsc-preview');
  const btn = $('btn-word');
  const orig = btn.textContent;
  btn.disabled = true;
  let restore = [];
  try {
    restore = await inlineImages(preview, (done, total) => {
      btn.textContent = total ? `⏳ Đang nhúng ảnh ${done}/${total}...` : '⏳ Đang tạo...';
    });
    const clone = preview.cloneNode(true);
    clone.querySelectorAll('.ed').forEach(el => {
      el.removeAttribute('contenteditable');
      el.style.borderBottom = 'none';
    });
    clone.querySelectorAll('.page-break').forEach(el => {
      el.outerHTML = '<br clear="all" style="page-break-before:always">';
    });
    const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"><title>Báo cáo sự cố</title>
<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom></w:WordDocument></xml><![endif]-->
<style>
@page { size: 21cm 29.7cm; margin: 1.5cm 1.5cm 1.5cm 2cm; }
body { font-family: 'Times New Roman', Times, serif; font-size: 13pt; line-height: 1.4; }
p { margin: 0 0 4pt; }
table { border-collapse: collapse; width: 100%; }
.bc-head td, .bc-sign td { vertical-align: top; text-align: center; }
.bc-sign td { font-weight: bold; width: 50%; }
.bc-sign .space { height: 60pt; }
.bc-photos td { width: 50%; padding: 3pt; text-align: center; vertical-align: top; }
.bc-photos img { width: 230pt; border: 1px solid #999; }
</style></head><body>${clone.innerHTML}</body></html>`;
    const blob = new Blob(['﻿', html], { type: 'application/msword' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `BCSC_${String(state.current['Tủ điều khiển'] || 'su-co').replace(/[\s,/\\]+/g, '_')}_${parseNgay(state.current['Ngày giờ phát hiện']).date.replace(/\//g, '-')}.doc`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  } catch (e) {
    showToast('Lỗi xuất Word: ' + (e.message || e), 'error', 5000);
  } finally {
    restoreImages(restore);
    btn.disabled = false;
    btn.textContent = orig;
  }
}
