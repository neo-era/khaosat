// js/schemas.js — Schema 15 loại khảo sát.
// Đồng bộ NGUYÊN VĂN với CLAUDE.md mục 5 và HEADERS trong apps-script/Code.gs.
// label = tên cột Google Sheets (PHẢI giữ y nguyên kể cả khoảng trắng, dấu, viết hoa lẻ tẻ).
// type:  text | number | decimal | textarea | date_auto | stt_auto |
//        gps_lat | gps_lng | select | multiselect | quan | phuong | tdk | link_gmap
// select + allowOther: true → thêm mục "Khác (nhập tay)"; giá trị ngoài danh sách vẫn lưu nguyên văn.
// multiselect → ô tick nhiều lựa chọn (+ Khác), lưu thành chuỗi "A, B, C".
// countFrom: '<key>' → ô số tự đếm các con số trong trường <key> (người dùng vẫn sửa được).
// Trường `nguoi_ks` ở mọi form sẽ được form-renderer auto-fill từ user.full_name (readonly).

/**
 * Thông số để dựng mô hình đường trong DIALux (thêm 2026-09-27) cho Thay đèn, Tăng cường đèn,
 * Ngầm hóa. Label = tên cột mới trong sheet — PHẢI khớp DIALUX_COLS trong Code.gs.
 * `withRoadBase`: thêm Độ rộng đường/Số làn xe/Dãy phân cách (Thay đèn chưa có 3 cột này).
 * Trả object mới mỗi lần gọi vì trường đầu mang `section` (tiêu đề khối trên form).
 */
function dialuxFields(withRoadBase) {
  const base = withRoadBase ? [
    { label: 'Độ rộng đường',          key: 'do_rong_duong', type: 'decimal',  required: true,  hint: 'mét, mép bó vỉa tới mép bó vỉa' },
    { label: 'Số làn xe',              key: 'so_lan_xe',     type: 'number',   required: false },
    { label: 'Dãy phân cách',          key: 'day_phan_cach', type: 'select',   required: false, options: ['Có', 'Không'] }
  ] : [];
  const fields = base.concat([
    { label: 'Bề rộng dải phân cách',  key: 'rong_dpc',      type: 'decimal',  required: false, hint: 'mét, bỏ trống nếu không có' },
    { label: 'Bề rộng vỉa hè trái',    key: 'rong_vh_trai',  type: 'decimal',  required: false, hint: 'mét' },
    { label: 'Bề rộng vỉa hè phải',    key: 'rong_vh_phai',  type: 'decimal',  required: false, hint: 'mét' },
    { label: 'Loại mặt đường',         key: 'loai_mat_duong',type: 'select',   required: false, allowOther: true,
      options: ['Nhựa', 'Bê tông'] },
    { label: 'Kiểu bố trí trụ',        key: 'kieu_bo_tri',   type: 'select',   required: true,
      options: ['1 bên', '2 bên đối xứng', '2 bên so le', 'Giữa dải phân cách'] },
    { label: 'Khoảng cách trụ',        key: 'kc_tru',        type: 'decimal',  required: true,  hint: 'mét, giữa 2 trụ liên tiếp cùng bên' },
    { label: 'Chiều cao trụ',          key: 'cao_tru',       type: 'decimal',  required: true,  hint: 'mét, chiều cao lắp đèn' },
    { label: 'Chiều dài vươn cần',     key: 'vuon_can',      type: 'decimal',  required: false, hint: 'mét' },
    { label: 'Góc nghiêng cần',        key: 'goc_can',       type: 'number',   required: false, hint: 'độ' },
    { label: 'Khoảng cách trụ tới mép đường', key: 'kc_tru_mep', type: 'decimal', required: false, hint: 'mét' },
    { label: 'Số đèn trên 1 trụ',      key: 'den_moi_tru',   type: 'number',   required: false },
    { label: 'Loại đèn hiện hữu',      key: 'loai_den_hh',   type: 'select',   required: false, allowOther: true,
      options: ['Sodium', 'LED', 'Metal halide'] }
  ]);
  fields[0].section = '📐 Thông số DIALux';
  return fields;
}

/** Danh mục cỡ cáp dùng chung cho Thay cáp nổi / Thay cáp ngầm. */
const LOAI_CAP = ['4x10', '4x10 + sợi thép', '4x11', '2x11', '5x10', 'Cu/XLPE/PVC/DSTA 4x10'];

export const SCHEMAS = {
  // ===== 5.1 Tăng cường đèn (22 cột) =====
  tang_cuong_den: {
    name: 'Tăng cường đèn',
    sheet: 'Tang cuong den',
    icon: '💡',
    fields: [
      { label: 'STT',                    key: 'stt',          type: 'stt_auto' },
      { label: 'Hẻm',                    key: 'hem',          type: 'text',     required: false },
      { label: 'Tuyến đường',            key: 'tuyen_duong',  type: 'text',     required: true },
      { label: 'Quận',                   key: 'quan',         type: 'quan',     required: true },
      { label: 'Phường',                 key: 'phuong',       type: 'phuong',   required: true },
      { label: 'Tủ điều khiển',          key: 'tdk',          type: 'tdk',      required: true },
      { label: 'Độ rộng đường',          key: 'do_rong_duong',type: 'decimal',  required: true,  hint: 'mét' },
      { label: 'Dãy phân cách',          key: 'day_phan_cach',type: 'select',   required: false, options: ['Có', 'Không'] },
      { label: 'Số làn xe',              key: 'so_lan_xe',    type: 'number',   required: false },
      { label: 'Đầu tuyến',              key: 'dau_tuyen',    type: 'text',     required: false },
      { label: 'Cuối tuyến',             key: 'cuoi_tuyen',   type: 'text',     required: false },
      { label: 'Số đèn dự kiến',         key: 'so_den',       type: 'number',   required: true },
      { label: 'ngày khảo sát',          key: 'ngay_ks',      type: 'date_auto' },
      { label: 'kinh độ',                key: 'lng',          type: 'gps_lng' },
      { label: 'vĩ độ',                  key: 'lat',          type: 'gps_lat' },
      { label: 'Người khảo sát',         key: 'nguoi_ks',     type: 'text',     required: true },
      { label: 'Bản vẽ',                 key: 'ban_ve',       type: 'image_url',required: false, hint: 'Chụp ảnh bản vẽ thiết kế nếu có' },
      { label: 'Ghi chú',                key: 'ghi_chu',      type: 'textarea', required: false },
      { label: 'Vị trí',                 key: 'vi_tri',       type: 'text',     required: false },
      { label: 'Tên hẻm',                key: 'ten_hem',      type: 'text',     required: false },
      { label: 'Trạng thái thiết kế',    key: 'trang_thai',   type: 'select',   required: false, options: ['Đã thiết kế', 'Chưa thiết kế'] },
      { label: 'Link Google Map',        key: 'link_gmap',    type: 'link_gmap' },
      ...dialuxFields(false)
    ]
  },

  // ===== 5.2 Ngầm hóa (24 cột — cột Link Google Map thêm 2026-09-27) =====
  ngam_hoa: {
    name: 'Ngầm hóa',
    sheet: 'Ngam Hoa',
    icon: '🔌',
    fields: [
      { label: 'STT',                    key: 'stt',          type: 'stt_auto' },
      { label: 'Tuyến đường',            key: 'tuyen_duong',  type: 'text',     required: true },
      { label: 'Quận',                   key: 'quan',         type: 'quan',     required: true },
      { label: 'Phường',                 key: 'phuong',       type: 'phuong',   required: true },
      { label: 'Tủ điều khiển',          key: 'tdk',          type: 'tdk',      required: true },
      { label: 'Độ rộng đường',          key: 'do_rong_duong',type: 'decimal',  required: true,  hint: 'mét' },
      { label: 'Dãy phân cách',          key: 'day_phan_cach',type: 'select',   required: false, options: ['Có', 'Không'] },
      { label: 'Số làn xe',              key: 'so_lan_xe',    type: 'number',   required: false },
      { label: 'Đầu tuyến',              key: 'dau_tuyen',    type: 'text',     required: false },
      { label: 'Cuối tuyến',             key: 'cuoi_tuyen',   type: 'text',     required: false },
      { label: 'Số đèn dự kiến',         key: 'so_den',       type: 'number',   required: true },
      { label: 'Đường nhựa',             key: 'duong_nhua',   type: 'decimal',  required: false, hint: 'mét' },
      { label: 'Vỉa hè các loại',        key: 'vh_cac_loai',  type: 'decimal',  required: false, hint: 'mét' },
      { label: 'Vỉa hè bê tông',         key: 'vh_be_tong',   type: 'decimal',  required: false, hint: 'mét' },
      { label: 'Vỉa hè đá',              key: 'vh_da',        type: 'decimal',  required: false, hint: 'mét' },
      { label: 'Số đèn thu hồi',         key: 'so_den_th',    type: 'number',   required: false },
      { label: 'CD cáp thu hồi',         key: 'cd_cap_th',    type: 'decimal',  required: false, hint: 'chiều dài, mét' },
      { label: 'ngày khảo sát',          key: 'ngay_ks',      type: 'date_auto' },
      { label: 'kinh độ',                key: 'lng',          type: 'gps_lng' },
      { label: 'vĩ độ',                  key: 'lat',          type: 'gps_lat' },
      { label: 'Người khảo sát',         key: 'nguoi_ks',     type: 'text',     required: true },
      { label: 'Bản vẽ',                 key: 'ban_ve',       type: 'image_url',required: false, hint: 'Chụp ảnh bản vẽ thiết kế nếu có' },
      { label: 'Ghi chú',                key: 'ghi_chu',      type: 'textarea', required: false },
      { label: 'Link Google Map',        key: 'link_gmap',    type: 'link_gmap' },
      ...dialuxFields(false)
    ]
  },

  // ===== 5.3 Thay đèn (16 cột) =====
  thay_den: {
    name: 'Thay đèn',
    sheet: 'Thay den',
    icon: '🔦',
    fields: [
      { label: 'STT',                    key: 'stt',          type: 'stt_auto' },
      { label: 'Tuyến đường',            key: 'tuyen_duong',  type: 'text',     required: true },
      { label: 'Quận',                   key: 'quan',         type: 'quan',     required: true },
      { label: 'Phường',                 key: 'phuong',       type: 'phuong',   required: true },
      { label: 'Tủ điều khiển',          key: 'tdk',          type: 'tdk',      required: true },
      { label: 'Đầu tuyến',              key: 'dau_tuyen',    type: 'text',     required: false },
      { label: 'Cuối tuyến',             key: 'cuoi_tuyen',   type: 'text',     required: false },
      { label: 'Số đèn hiện hữu',        key: 'so_den_hh',    type: 'number',   required: true },
      { label: 'Công suất đèn hiện hữu', key: 'cong_suat',    type: 'select',   required: false, allowOther: true,
        options: ['250W', '250/150W', '150W', '150/100W', '100W', '100/70W', '70W'] },
      { label: 'Dây lên đèn',            key: 'day_len_den',  type: 'text',     required: false },
      { label: 'Năm lắp đặt',            key: 'nam_ld',       type: 'number',   required: false },
      { label: 'ngày khảo sát',          key: 'ngay_ks',      type: 'date_auto' },
      { label: 'Người khảo sát',         key: 'nguoi_ks',     type: 'text',     required: true },
      { label: 'Bản vẽ',                 key: 'ban_ve',       type: 'image_url',required: false, hint: 'Chụp ảnh bản vẽ thiết kế nếu có' },
      { label: 'Ghi chú',                key: 'ghi_chu',      type: 'textarea', required: false },
      { label: 'link',                   key: 'link_gmap',    type: 'link_gmap' },
      ...dialuxFields(true)
    ]
  },

  // ===== 5.4 Hộp kín nước (12 cột) =====
  hkn: {
    name: 'Hộp kín nước',
    sheet: '4, HKN',
    icon: '📦',
    fields: [
      { label: 'STT',                    key: 'stt',          type: 'stt_auto' },
      { label: 'Tuyến đường',            key: 'tuyen_duong',  type: 'text',     required: true },
      { label: 'Quận',                   key: 'quan',         type: 'quan',     required: true },
      { label: 'Phường',                 key: 'phuong',       type: 'phuong',   required: true },
      { label: 'Tủ điều khiển',          key: 'tdk',          type: 'tdk',      required: true },
      { label: 'Năm lắp đặt',            key: 'nam_ld',       type: 'number',   required: false },
      { label: 'Số lượng',               key: 'so_luong',     type: 'number',   required: true },
      { label: 'Loại hộp (6A, 10A)',     key: 'loai_hop',     type: 'select',   required: true,  options: ['6A', '10A'] },
      { label: 'Người khảo sát',         key: 'nguoi_ks',     type: 'text',     required: true },
      { label: 'Ngày khảo sát',          key: 'ngay_ks',      type: 'date_auto' },
      { label: 'Số đầu cáp',             key: 'so_dau_cap',   type: 'text',     required: false, hint: 'Vd: 2 đầu cáp' },
      { label: 'Ghi chú',                key: 'ghi_chu',      type: 'textarea', required: false }
    ]
  },

  // ===== 5.5 Thay cáp nổi (12 cột) =====
  tc_noi: {
    name: 'Thay cáp nổi',
    sheet: '5. TCNoi',
    icon: '🪢',
    fields: [
      { label: 'STT',                    key: 'stt',          type: 'stt_auto' },
      { label: 'Tuyến đường',            key: 'tuyen_duong',  type: 'text',     required: true },
      { label: 'Quận',                   key: 'quan',         type: 'quan',     required: true },
      { label: 'Phường',                 key: 'phuong',       type: 'phuong',   required: true },
      { label: 'Tủ điều khiển',          key: 'tdk',          type: 'tdk',      required: true },
      { label: 'Năm lắp đặt',            key: 'nam_ld',       type: 'number',   required: false },
      { label: 'Loại cáp hiện hữu',      key: 'loai_cap',     type: 'select',   required: false, allowOther: true, options: LOAI_CAP },
      { label: 'Số lượng',               key: 'so_luong',     type: 'number',   required: true,  hint: 'mét' },
      { label: 'Người khảo sát',         key: 'nguoi_ks',     type: 'text',     required: true },
      { label: 'Ngày khảo sát',          key: 'ngay_ks',      type: 'date_auto' },
      { label: 'Ghi chú',                key: 'ghi_chu',      type: 'textarea', required: false },
      { label: 'link',                   key: 'link_gmap',    type: 'link_gmap' }
    ]
  },

  // ===== 5.6 Cáp luồn cần (13 cột) =====
  cap_luon_can: {
    name: 'Cáp luồn cần',
    sheet: '6, Cap luon can',
    icon: '🧵',
    fields: [
      { label: 'STT',                    key: 'stt',          type: 'stt_auto' },
      { label: 'Vị trí',                 key: 'vi_tri',       type: 'text',     required: false },
      { label: 'Tuyến đường',            key: 'tuyen_duong',  type: 'text',     required: true },
      { label: 'Quận',                   key: 'quan',         type: 'quan',     required: true },
      { label: 'Phường',                 key: 'phuong',       type: 'phuong',   required: true },
      { label: 'Tủ điều khiển',          key: 'tdk',          type: 'tdk',      required: true },
      { label: 'Năm lắp đặt',            key: 'nam_ld',       type: 'number',   required: false },
      { label: 'Loại cáp',               key: 'loai_cap',     type: 'text',     required: false },
      { label: 'Số lượng',               key: 'so_luong',     type: 'number',   required: true,  hint: 'mét, vd: 6' },
      { label: 'Người khảo sát',         key: 'nguoi_ks',     type: 'text',     required: true },
      { label: 'Ngày khảo sát',          key: 'ngay_ks',      type: 'date_auto' },
      { label: 'Ghi chú',                key: 'ghi_chu',      type: 'textarea', required: false },
      { label: 'link',                   key: 'link_gmap',    type: 'link_gmap' }
    ]
  },

  // ===== 5.7 Thay cáp ngầm (13 cột) =====
  tc_ngam: {
    name: 'Thay cáp ngầm',
    sheet: '7. TCNgam',
    icon: '⛓️',
    fields: [
      { label: 'STT',                    key: 'stt',          type: 'stt_auto' },
      { label: 'Tuyến đường',            key: 'tuyen_duong',  type: 'text',     required: true },
      { label: 'Quận',                   key: 'quan',         type: 'quan',     required: true },
      { label: 'Phường',                 key: 'phuong',       type: 'phuong',   required: true },
      { label: 'Tủ điều khiển',          key: 'tdk',          type: 'tdk',      required: true },
      { label: 'Năm lắp đặt',            key: 'nam_ld',       type: 'number',   required: false },
      { label: 'Số lượng',               key: 'so_luong',     type: 'number',   required: true,  hint: 'mét, vd: 30' },
      { label: 'Loại cáp',               key: 'loai_cap',     type: 'select',   required: false, allowOther: true, options: LOAI_CAP },
      { label: 'Loại mương cáp',         key: 'loai_muong',   type: 'select',   required: false, allowOther: true,
        options: ['Gạch terrazzo 400x400', 'Đá chẻ', 'Đá hoa cương', 'Nhựa đường', 'Bê tông', 'Tấm đan bê tông', 'Cỏ'] },
      { label: 'Người khảo sát',         key: 'nguoi_ks',     type: 'text',     required: true },
      { label: 'Ngày khảo sát',          key: 'ngay_ks',      type: 'date_auto' },
      { label: 'Ghi chú',                key: 'ghi_chu',      type: 'textarea', required: false },
      { label: 'link',                   key: 'link_gmap',    type: 'link_gmap' }
    ]
  },

  // ===== 5.8 Thay cần đèn (14 cột) =====
  thay_can: {
    name: 'Thay cần đèn',
    sheet: '8. Thay Can',
    icon: '🦯',
    fields: [
      { label: 'STT',                            key: 'stt',          type: 'stt_auto' },
      { label: 'Vị trí',                         key: 'vi_tri',       type: 'text',     required: false },
      { label: 'Tuyến đường',                    key: 'tuyen_duong',  type: 'text',     required: true },
      { label: 'Quận',                           key: 'quan',         type: 'quan',     required: true },
      { label: 'Phường',                         key: 'phuong',       type: 'phuong',   required: true },
      { label: 'Tủ điều khiển',                  key: 'tdk',          type: 'tdk',      required: true },
      { label: 'Năm lắp đặt',                    key: 'nam_ld',       type: 'number',   required: false },
      { label: 'Số lượng',                       key: 'so_luong',     type: 'number',   required: true },
      { label: 'Loại kiềng (HTLT, TTLT, B2...)', key: 'loai_kieng',   type: 'select',   required: true,  allowOther: true,
        options: ['HTLT', 'HTLTL', 'TTLT', 'TTLT Đôi dọc', 'TTLTN', 'TTLTL', 'B2', 'B4', 'B6'] },
      { label: 'Loại cần (3,8m ; 3m...)',        key: 'loai_can',     type: 'select',   required: false, allowOther: true,
        options: ['2m', '2,5m', '3m', '3,8m', 'Cổ cò'] },
      { label: 'Người khảo sát',                 key: 'nguoi_ks',     type: 'text',     required: true },
      { label: 'Ngày khảo sát',                  key: 'ngay_ks',      type: 'date_auto' },
      { label: 'Ghi chú',                        key: 'ghi_chu',      type: 'textarea', required: false },
      { label: 'link',                           key: 'link_gmap',    type: 'link_gmap' }
    ]
  },

  // ===== 5.9 Thay trụ (15 cột) =====
  thay_tru: {
    name: 'Thay trụ',
    sheet: '9. Thay thế tru',
    icon: '🏗️',
    fields: [
      { label: 'STT',                                                                                              key: 'stt',           type: 'stt_auto' },
      { label: 'Vị trí',                                                                                           key: 'vi_tri',        type: 'text',     required: false },
      { label: 'Tuyến đường',                                                                                      key: 'tuyen_duong',   type: 'text',     required: true },
      { label: 'Quận',                                                                                             key: 'quan',          type: 'quan',     required: true },
      { label: 'Phường',                                                                                           key: 'phuong',        type: 'phuong',   required: true },
      { label: 'Tủ điều khiển',                                                                                    key: 'tdk',           type: 'tdk',      required: true },
      { label: 'Số lượng',                                                                                         key: 'so_luong',      type: 'number',   required: true },
      { label: 'Loại sự cố (mục, gỉ sét, hư mặt bích,...)',                                                        key: 'loai_su_co',    type: 'multiselect', required: true,
        options: ['Mục', 'Gỉ sét', 'Hư mặt bích', 'Móp méo/cong', 'Xe đụng', 'Lão hoá'] },
      { label: 'Quy cách trụ (loại trụ: chiều cao VD: STK 9m; be tông 8,4m; trang trí;...)',                       key: 'quy_cach_tru',  type: 'select',   required: true,  allowOther: true,
        options: ['STK 5m', 'STK 8m', 'STK 9m', 'Côn tròn 8m', 'Côn tròn 9m', 'Bát giác 7m', 'Trang trí 4m'] },
      { label: 'Quy cách móng',                                                                                    key: 'quy_cach_mong', type: 'text',     required: false, hint: 'Vd: M22 260×260' },
      { label: 'Năm lắp đặt',                                                                                      key: 'nam_ld',        type: 'number',   required: false },
      { label: 'Người khảo sát',                                                                                   key: 'nguoi_ks',      type: 'text',     required: true },
      { label: 'Ngày khảo sát',                                                                                    key: 'ngay_ks',       type: 'date_auto' },
      { label: 'Ghi chú (kèm thay cần đèn,...)',                                                                   key: 'ghi_chu',       type: 'textarea', required: false },
      { label: 'link',                                                                                             key: 'link_gmap',     type: 'link_gmap' }
    ]
  },

  // ===== 5.10 Chóa đèn (12 cột) =====
  choa_den: {
    name: 'Chóa đèn',
    sheet: '10.choa den',
    icon: '🪔',
    fields: [
      { label: 'STT',                    key: 'stt',          type: 'stt_auto' },
      { label: 'Tuyến đường',            key: 'tuyen_duong',  type: 'text',     required: true },
      { label: 'Quận',                   key: 'quan',         type: 'quan',     required: true },
      { label: 'Phường',                 key: 'phuong',       type: 'phuong',   required: true },
      { label: 'Tủ điều khiển',          key: 'tdk',          type: 'tdk',      required: true },
      { label: 'Năm lắp đặt',            key: 'nam_ld',       type: 'number',   required: false },
      { label: 'Số lượng',               key: 'so_luong',     type: 'number',   required: true },
      { label: 'Loại chóa',              key: 'loai_choa',    type: 'select',   required: true,  allowOther: true,
        options: ['Onyx', 'A2', 'Cầu D400', 'GE', 'M3', 'Trang trí bông huệ', 'Đèn LED'] },
      { label: 'Người khảo sát',         key: 'nguoi_ks',     type: 'text',     required: true },
      { label: 'Ngày khảo sát',          key: 'ngay_ks',      type: 'date_auto' },
      { label: 'Ghi chú',                key: 'ghi_chu',      type: 'textarea', required: false },
      { label: 'link',                   key: 'link_gmap',    type: 'link_gmap' }
    ]
  },

  // ===== 5.11 Nắp trụ (12 cột) =====
  nap_tru: {
    name: 'Nắp trụ',
    sheet: '11. Nap tru',
    icon: '🛡️',
    fields: [
      { label: 'STT',                    key: 'stt',          type: 'stt_auto' },
      { label: 'Tuyến đường',            key: 'tuyen_duong',  type: 'text',     required: true },
      { label: 'Quận',                   key: 'quan',         type: 'quan',     required: true },
      { label: 'Phường',                 key: 'phuong',       type: 'phuong',   required: true },
      { label: 'Tủ điều khiển',          key: 'tdk',          type: 'tdk',      required: true },
      { label: 'Số trụ',                 key: 'so_tru',       type: 'text',     required: true,  hint: 'Vd: TS 6, 13' },
      { label: 'Số lượng',               key: 'so_luong',     type: 'number',   required: true,  countFrom: 'so_tru', hint: 'Tự đếm từ ô Số trụ — sửa được' },
      { label: 'Quy cách',               key: 'quy_cach',     type: 'text',     required: false, hint: 'Vd: 35×25' },
      { label: 'Người khảo sát',         key: 'nguoi_ks',     type: 'text',     required: true },
      { label: 'Ngày khảo sát',          key: 'ngay_ks',      type: 'date_auto' },
      { label: 'Ghi chú',                key: 'ghi_chu',      type: 'textarea', required: false },
      { label: 'link',                   key: 'link_gmap',    type: 'link_gmap' }
    ]
  },

  // ===== 5.12 Vỏ tủ điều khiển (11 cột) =====
  vo_tu: {
    name: 'Vỏ tủ điều khiển',
    sheet: '12, Vo tu',
    icon: '🗄️',
    fields: [
      { label: 'STT',                    key: 'stt',          type: 'stt_auto' },
      { label: 'Tuyến đường',            key: 'tuyen_duong',  type: 'text',     required: true },
      { label: 'Quận',                   key: 'quan',         type: 'quan',     required: true },
      { label: 'Phường',                 key: 'phuong',       type: 'phuong',   required: true },
      { label: 'Tủ điều khiển',          key: 'tdk',          type: 'tdk',      required: true },
      { label: 'Năm lắp đặt',            key: 'nam_ld',       type: 'number',   required: false },
      { label: 'Số lượng',               key: 'so_luong',     type: 'number',   required: true },
      { label: 'Người khảo sát',         key: 'nguoi_ks',     type: 'text',     required: true },
      { label: 'Ngày khảo sát',          key: 'ngay_ks',      type: 'date_auto' },
      { label: 'Ghi chú',                key: 'ghi_chu',      type: 'textarea', required: false },
      { label: 'link',                   key: 'link_gmap',    type: 'link_gmap' }
    ]
  },

  // ===== 5.13 Tăng cường đèn khoảng cách xa (16 cột) =====
  tc_den_kc_xa: {
    name: 'Tăng cường đèn khoảng cách xa',
    sheet: '13 Tăng cường đèn kc xa',
    icon: '🛣️',
    fields: [
      { label: 'STT',                    key: 'stt',            type: 'stt_auto' },
      { label: 'Vị trí',                 key: 'vi_tri',         type: 'text',     required: false },
      { label: 'Tuyến đường',            key: 'tuyen_duong',    type: 'text',     required: true },
      { label: 'Quận',                   key: 'quan',           type: 'quan',     required: true },
      { label: 'Phường',                 key: 'phuong',         type: 'phuong',   required: true },
      { label: 'Tủ điều khiển',          key: 'tdk',            type: 'tdk',      required: true },
      { label: 'Chủng loại đèn',         key: 'chung_loai_den', type: 'text',     required: true },
      { label: 'Số lượng',               key: 'so_luong',       type: 'number',   required: true },
      { label: 'Chủng loại cần đèn',     key: 'chung_loai_can', type: 'text',     required: false },
      { label: 'Quy cách kiềng cần đèn', key: 'quy_cach_kieng', type: 'text',     required: false },
      { label: 'Kéo thêm cáp nguồn',     key: 'keo_them_cap',   type: 'select',   required: false, options: ['Có', 'Không'] },
      { label: 'Khoảng cách giữa 2 trụ', key: 'kc_2_tru',       type: 'decimal',  required: false, hint: 'mét' },
      { label: 'Người khảo sát',         key: 'nguoi_ks',       type: 'text',     required: true },
      { label: 'Ngày khảo sát',          key: 'ngay_ks',        type: 'date_auto' },
      { label: 'Ghi chú',                key: 'ghi_chu',        type: 'textarea', required: false },
      { label: 'link',                   key: 'link_gmap',      type: 'link_gmap' }
    ]
  },

  // ===== 5.14 Decal số trụ (12 cột) =====
  decal_so_tru: {
    name: 'Decal số trụ',
    sheet: '14 Decal số trụ',
    icon: '🔢',
    fields: [
      { label: 'STT',                    key: 'stt',          type: 'stt_auto' },
      { label: 'Vị trí',                 key: 'vi_tri',       type: 'text',     required: false, hint: 'Vd: 1 đến 35' },
      { label: 'Tuyến đường',            key: 'tuyen_duong',  type: 'text',     required: true },
      { label: 'Quận',                   key: 'quan',         type: 'quan',     required: true },
      { label: 'Phường',                 key: 'phuong',       type: 'phuong',   required: true },
      { label: 'Tủ điều khiển',          key: 'tdk',          type: 'tdk',      required: true },
      { label: 'Số lượng',               key: 'so_luong',     type: 'number',   required: true },
      { label: 'Quy cách',               key: 'quy_cach',     type: 'text',     required: false },
      { label: 'Người khảo sát',         key: 'nguoi_ks',     type: 'text',     required: true },
      { label: 'Ngày khảo sát',          key: 'ngay_ks',      type: 'date_auto' },
      { label: 'Ghi chú',                key: 'ghi_chu',      type: 'textarea', required: false },
      { label: 'link',                   key: 'link_gmap',    type: 'link_gmap' }
    ]
  },

  // ===== 5.15 Nâng móng trụ (15 cột) =====
  nang_mong: {
    name: 'Nâng móng trụ',
    sheet: '15. Nâng móng',
    icon: '⛏️',
    fields: [
      { label: 'STT',                                                            key: 'stt',           type: 'stt_auto' },
      { label: 'Vị trí',                                                         key: 'vi_tri',        type: 'text',     required: false },
      { label: 'Tuyến đường',                                                    key: 'tuyen_duong',   type: 'text',     required: true },
      { label: 'Quận',                                                           key: 'quan',          type: 'quan',     required: true },
      { label: 'Phường',                                                         key: 'phuong',        type: 'phuong',   required: true },
      { label: 'Tủ điều khiển',                                                  key: 'tdk',           type: 'tdk',      required: true },
      { label: 'Năm lắp đặt',                                                    key: 'nam_ld',        type: 'number',   required: false },
      { label: 'Độ cao nâng',                                                    key: 'do_cao_nang',   type: 'number',   required: true,  hint: 'mm, vd: 200' },
      { label: 'Số lượng',                                                       key: 'so_luong',      type: 'number',   required: true },
      { label: 'Quy cách móng',                                                  key: 'quy_cach_mong', type: 'text',     required: false, hint: 'Vd: M16 × 400' },
      { label: 'Chiều cao nắp cửa trụ (từ mặt bích đến nắp cửa trụ)',            key: 'chieu_cao_nap', type: 'number',   required: false, hint: 'mm, vd: 1250' },
      { label: 'Người khảo sát',                                                 key: 'nguoi_ks',      type: 'text',     required: true },
      { label: 'Ngày khảo sát',                                                  key: 'ngay_ks',       type: 'date_auto' },
      { label: 'Ghi chú',                                                        key: 'ghi_chu',       type: 'textarea', required: false },
      { label: 'link',                                                           key: 'link_gmap',     type: 'link_gmap' }
    ]
  },

  // ===== 5.16 Tháo gỡ băng rôn (13 cột) =====
  thao_go_bang_ron: {
    name: 'Tháo gỡ băng rôn',
    sheet: '16. Thao go bang ron',
    icon: '🚩',
    maxPhotos: 5,
    driveFolder: '/Bangron',   // thư mục Drive riêng, ngang hàng với 'khaosat'
    fields: [
      { label: 'STT',                    key: 'stt',          type: 'stt_auto' },
      { label: 'Tuyến đường',            key: 'tuyen_duong',  type: 'text',     required: true },
      { label: 'Quận',                   key: 'quan',         type: 'quan',     required: true },
      { label: 'Phường',                 key: 'phuong',       type: 'phuong',   required: true },
      { label: 'Vị trí',                 key: 'vi_tri',       type: 'text',     required: false, hint: 'Đoạn đường, vd: từ số 63 đến số 120' },
      { label: 'Loại quảng cáo',         key: 'loai_qc',      type: 'select',   required: true,
        options: ['Băng rôn', 'Cờ phướn', 'Poster/áp phích', 'Hỗn hợp'] },
      { label: 'Số lượng',               key: 'so_luong',     type: 'number',   required: true,  hint: 'tấm' },
      { label: 'Người khảo sát',         key: 'nguoi_ks',     type: 'text',     required: true },
      { label: 'Ngày khảo sát',          key: 'ngay_ks',      type: 'date_auto' },
      { label: 'kinh độ',                key: 'lng',          type: 'gps_lng' },
      { label: 'vĩ độ',                  key: 'lat',          type: 'gps_lat' },
      { label: 'Ghi chú',                key: 'ghi_chu',      type: 'textarea', required: false },
      { label: 'Link Google Map',        key: 'link_gmap',    type: 'link_gmap' }
    ]
  }
};

/**
 * 5.17 Báo cáo sự cố (thêm 2026-09-29) — theo mẫu "BÁO CÁO SỰ CỐ công tác quản lý, bảo dưỡng
 * hệ thống" (BCSC). Người khảo sát nhập ngoài hiện trường; admin/user xuất biên bản ở bcsc.html.
 * Số BCSC do người lập tự ghi. Mục 7 (ý kiến chuyên viên) và 10 (kết quả xử lý) để trống cho ký tay.
 */
SCHEMAS.bao_cao_su_co = {
  name: 'Báo cáo sự cố',
  sheet: '17. Bao cao su co',
  icon: '🚨',
  maxPhotos: 5,
  fields: [
    { label: 'STT',                  key: 'stt',          type: 'stt_auto' },
    { label: 'Số BCSC',              key: 'so_bcsc',      type: 'text',     required: false, hint: 'Người lập tự ghi, vd 03321225180/BCSC-CSKVB — để trống nếu chưa có' },
    { label: 'Đơn vị báo cáo',       key: 'don_vi',       type: 'select',   required: true,  allowOther: true, options: ['CSKV Bắc'], default: 'CSKV Bắc' },
    { label: 'Tủ điều khiển',        key: 'tdk',          type: 'tdk',      required: true },
    { label: 'Mã tủ',                key: 'ma_tu',        type: 'text',     required: false, hint: 'vd TM118.03' },
    { label: 'Tuyến đường',          key: 'tuyen_duong',  type: 'text',     required: true },
    { label: 'Quận',                 key: 'quan',         type: 'quan',     required: true },
    { label: 'Phường',               key: 'phuong',       type: 'phuong',   required: true },
    { label: 'Ngày giờ phát hiện',   key: 'ngay_gio_pd',  type: 'datetime', required: true,  default: 'now' },
    { label: 'Hiện trạng sự cố',     key: 'hien_trang',   type: 'textarea', required: true,  hint: 'vd: Bộ điều khiển trung tâm không truyền tín hiệu về trung tâm điều khiển' },
    { label: 'Nguyên nhân sơ bộ',    key: 'nguyen_nhan',  type: 'textarea', required: false, hint: 'vd: Hư bộ Logo tại tủ điều khiển (không hiển thị màn hình)' },
    { label: 'Năm lắp đặt',          key: 'nam_ld',       type: 'number',   required: false },
    { label: 'Đề xuất khắc phục',    key: 'de_xuat',      type: 'textarea', required: true,  hint: 'Biện pháp, quy mô, khối lượng dự kiến — vd: Thay bộ điều khiển logo' },
    { label: 'Người khảo sát',       key: 'nguoi_ks',     type: 'text',     required: true },
    { label: 'Ngày khảo sát',        key: 'ngay_ks',      type: 'date_auto' },
    { label: 'kinh độ',              key: 'lng',          type: 'gps_lng' },
    { label: 'vĩ độ',                key: 'lat',          type: 'gps_lat' },
    { label: 'Ghi chú',              key: 'ghi_chu',      type: 'textarea', required: false },
    { label: 'Link Google Map',      key: 'link_gmap',    type: 'link_gmap' }
  ]
};

/** Trạng thái xử lý — ĐỒNG BỘ XU_LY_STATUSES / XU_LY_SKIP_TYPES trong Code.gs. */
export const XU_LY_STATUSES = ['Chờ thiết kế', 'Đã thiết kế', 'Đã thi công', 'Nghiệm thu', 'Không xử lý'];
export const XU_LY_SKIP_TYPES = ['thao_go_bang_ron'];

/** Trả mảng các key (= 16 loại). Dùng cho trang chủ render grid. */
export const SCHEMA_KEYS = Object.keys(SCHEMAS);

/** Lookup nhanh tên hiển thị + icon theo key. */
export function getSchemaInfo(key) {
  const s = SCHEMAS[key];
  return s ? { name: s.name, sheet: s.sheet, icon: s.icon } : null;
}
