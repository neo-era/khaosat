// js/dia-ban.js — Danh mục phường/xã dùng trong app = TP.HCM cũ (lookups.js, sinh từ Excel)
// + phường/xã trên địa bàn Bình Dương cũ (sáp nhập vào TP.HCM từ 01/07/2025).
// Tách file riêng để lần sinh lại lookups.js từ Excel không làm mất phần Bình Dương.
// Mọi nơi cần danh mục phường/quận import từ file này, không import thẳng lookups.js.

import { PHUONG_XA as PHUONG_XA_HCM, TDK_LIST, TDK_BY_PHUONG } from './lookups.js';

/**
 * 36 đơn vị (24 phường, 12 xã) theo Nghị quyết 1685/NQ-UBTVQH15 ngày 16/6/2025.
 * `quan_cu` = đơn vị cấp huyện cũ của Bình Dương. Nghị quyết KHÔNG ghi thông tin này —
 * suy từ các phường/xã cũ được gộp; 11 đơn vị gộp từ 2 huyện cũ (đánh dấu *) được xếp
 * theo huyện của phường gốc mang tên đơn vị mới. Anh Lam Mai duyệt 2026-09-27.
 * Tủ điều khiển Bình Dương chưa có danh mục → ô TĐK gõ tự do.
 */
export const PHUONG_XA_BINH_DUONG = [
  { ten: 'Thủ Dầu Một',   quan_cu: 'TP Thủ Dầu Một' },
  { ten: 'Phú Lợi',       quan_cu: 'TP Thủ Dầu Một' },
  { ten: 'Chánh Hiệp',    quan_cu: 'TP Thủ Dầu Một' },
  { ten: 'Bình Dương',    quan_cu: 'TP Thủ Dầu Một' },   // * + Phú Chánh (Tân Uyên)
  { ten: 'Phú An',        quan_cu: 'TP Thủ Dầu Một' },   // * + xã Phú An (Bến Cát)
  { ten: 'Dĩ An',         quan_cu: 'TP Dĩ An' },
  { ten: 'Đông Hòa',      quan_cu: 'TP Dĩ An' },
  { ten: 'Tân Đông Hiệp', quan_cu: 'TP Dĩ An' },         // * + một phần Thái Hòa (Tân Uyên)
  { ten: 'An Phú',        quan_cu: 'TP Thuận An' },
  { ten: 'Bình Hòa',      quan_cu: 'TP Thuận An' },
  { ten: 'Lái Thiêu',     quan_cu: 'TP Thuận An' },
  { ten: 'Thuận An',      quan_cu: 'TP Thuận An' },
  { ten: 'Thuận Giao',    quan_cu: 'TP Thuận An' },
  { ten: 'Hòa Lợi',       quan_cu: 'TP Bến Cát' },
  { ten: 'Thới Hòa',      quan_cu: 'TP Bến Cát' },       // giữ nguyên, không sắp xếp
  { ten: 'Chánh Phú Hòa', quan_cu: 'TP Bến Cát' },       // * + Hưng Hòa (Bàu Bàng)
  { ten: 'Tây Nam',       quan_cu: 'TP Bến Cát' },       // * + một phần Thanh Tuyền, An Lập (Dầu Tiếng)
  { ten: 'Long Nguyên',   quan_cu: 'TP Bến Cát' },       // * + xã Long Nguyên (Bàu Bàng)
  { ten: 'Bến Cát',       quan_cu: 'TP Bến Cát' },       // * + Tân Hưng, Lai Hưng (Bàu Bàng)
  { ten: 'Tân Uyên',      quan_cu: 'TP Tân Uyên' },      // * + Tân Lập, một phần Tân Mỹ (Bắc Tân Uyên)
  { ten: 'Tân Hiệp',      quan_cu: 'TP Tân Uyên' },
  { ten: 'Tân Khánh',     quan_cu: 'TP Tân Uyên' },
  { ten: 'Vĩnh Tân',      quan_cu: 'TP Tân Uyên' },      // * + TT Tân Bình (Bắc Tân Uyên)
  { ten: 'Bình Cơ',       quan_cu: 'TP Tân Uyên' },      // * + Bình Mỹ (Bắc Tân Uyên)
  { ten: 'Bắc Tân Uyên',  quan_cu: 'Huyện Bắc Tân Uyên' },
  { ten: 'Thường Tân',    quan_cu: 'Huyện Bắc Tân Uyên' },
  { ten: 'Phú Giáo',      quan_cu: 'Huyện Phú Giáo' },
  { ten: 'Phước Hòa',     quan_cu: 'Huyện Phú Giáo' },
  { ten: 'Phước Thành',   quan_cu: 'Huyện Phú Giáo' },
  { ten: 'An Long',       quan_cu: 'Huyện Phú Giáo' },
  { ten: 'Trừ Văn Thố',   quan_cu: 'Huyện Bàu Bàng' },
  { ten: 'Bàu Bàng',      quan_cu: 'Huyện Bàu Bàng' },
  { ten: 'Long Hòa',      quan_cu: 'Huyện Dầu Tiếng' },
  { ten: 'Thanh An',      quan_cu: 'Huyện Dầu Tiếng' },
  { ten: 'Dầu Tiếng',     quan_cu: 'Huyện Dầu Tiếng' },
  { ten: 'Minh Thạnh',    quan_cu: 'Huyện Dầu Tiếng' }
];

export const PHUONG_XA = PHUONG_XA_HCM.concat(PHUONG_XA_BINH_DUONG);
export const QUAN_LIST = [...new Set(PHUONG_XA.map(p => p.quan_cu))].sort();
export { TDK_LIST, TDK_BY_PHUONG };
