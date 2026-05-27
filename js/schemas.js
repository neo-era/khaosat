// js/schemas.js — Schema 15 loại khảo sát.
// Đồng bộ NGUYÊN VĂN với CLAUDE.md mục 5 và HEADERS trong apps-script/Code.gs.
// label = tên cột Google Sheets (PHẢI giữ y nguyên kể cả khoảng trắng, dấu, viết hoa lẻ tẻ).
// type:  text | number | decimal | textarea | date_auto | stt_auto |
//        gps_lat | gps_lng | select | quan | phuong | tdk | link_gmap
// Trường `nguoi_ks` ở mọi form sẽ được form-renderer auto-fill từ user.full_name (readonly).

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
      { label: 'Độ rộng đường',          key: 'do_rong_duong',type: 'decimal',  required: false, hint: 'mét' },
      { label: 'Dãy phân cách',          key: 'day_phan_cach',type: 'select',   required: false, options: ['Có', 'Không'] },
      { label: 'Số làn xe',              key: 'so_lan_xe',    type: 'number',   required: false },
      { label: 'Đầu tuyến',              key: 'dau_tuyen',    type: 'text',     required: false },
      { label: 'Cuối tuyến',             key: 'cuoi_tuyen',   type: 'text',     required: false },
      { label: 'Số đèn dự kiến',         key: 'so_den',       type: 'number',   required: true },
      { label: 'ngày khảo sát',          key: 'ngay_ks',      type: 'date_auto' },
      { label: 'kinh độ',                key: 'lng',          type: 'gps_lng' },
      { label: 'vĩ độ',                  key: 'lat',          type: 'gps_lat' },
      { label: 'Người khảo sát',         key: 'nguoi_ks',     type: 'text',     required: true },
      { label: 'Bản vẽ',                 key: 'ban_ve',       type: 'text',     required: false, hint: 'Vd: BV-2026-001' },
      { label: 'Ghi chú',                key: 'ghi_chu',      type: 'textarea', required: false },
      { label: 'Vị trí',                 key: 'vi_tri',       type: 'text',     required: false },
      { label: 'Tên hẻm',                key: 'ten_hem',      type: 'text',     required: false },
      { label: 'Trạng thái thiết kế',    key: 'trang_thai',   type: 'select',   required: false, options: ['', 'Đã thiết kế', 'Chưa thiết kế'] },
      { label: 'Link Google Map',        key: 'link_gmap',    type: 'link_gmap' }
    ]
  },

  // ===== 5.2 Ngầm hóa (23 cột) =====
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
      { label: 'Độ rộng đường',          key: 'do_rong_duong',type: 'decimal',  required: false, hint: 'mét' },
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
      { label: 'Bản vẽ',                 key: 'ban_ve',       type: 'text',     required: false, hint: 'Vd: BV-2026-001' },
      { label: 'Ghi chú',                key: 'ghi_chu',      type: 'textarea', required: false }
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
      { label: 'Công suất đèn hiện hữu', key: 'cong_suat',    type: 'text',     required: false, hint: 'Vd: 150/100W và 150W' },
      { label: 'Dây lên đèn',            key: 'day_len_den',  type: 'text',     required: false },
      { label: 'Năm lắp đặt',            key: 'nam_ld',       type: 'number',   required: false },
      { label: 'ngày khảo sát',          key: 'ngay_ks',      type: 'date_auto' },
      { label: 'Người khảo sát',         key: 'nguoi_ks',     type: 'text',     required: true },
      { label: 'Bản vẽ',                 key: 'ban_ve',       type: 'text',     required: false, hint: 'Vd: BV-2026-001' },
      { label: 'Ghi chú',                key: 'ghi_chu',      type: 'textarea', required: false },
      { label: 'link',                   key: 'link_gmap',    type: 'link_gmap' }
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
      { label: 'Loại cáp hiện hữu',      key: 'loai_cap',     type: 'text',     required: false, hint: 'Vd: 5x10' },
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
      { label: 'Số lượng',               key: 'so_luong',     type: 'text',     required: true,  hint: 'Vd: 14 đèn (2TN 3m)' },
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
      { label: 'Số lượng',               key: 'so_luong',     type: 'text',     required: true,  hint: 'Vd: 30m' },
      { label: 'Loại cáp',               key: 'loai_cap',     type: 'text',     required: false },
      { label: 'Loại mương cáp',         key: 'loai_muong',   type: 'text',     required: false },
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
      { label: 'Loại kiềng (HTLT, TTLT, B2...)', key: 'loai_kieng',   type: 'select',   required: true,  options: ['HTLT', 'TTLT', 'TTLT Đôi dọc', 'B2', 'Khác'] },
      { label: 'Loại cần (3,8m ; 3m...)',        key: 'loai_can',     type: 'text',     required: false },
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
      { label: 'Loại sự cố (mục, gỉ sét, hư mặt bích,...)',                                                        key: 'loai_su_co',    type: 'textarea', required: true },
      { label: 'Quy cách trụ (loại trụ: chiều cao VD: STK 9m; be tông 8,4m; trang trí;...)',                       key: 'quy_cach_tru',  type: 'text',     required: true },
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
      { label: 'Loại chóa',              key: 'loai_choa',    type: 'text',     required: true,  hint: 'Vd: Onyx, Trang trí Bông huệ' },
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
      { label: 'Số trụ',                 key: 'so_tru',       type: 'text',     required: true,  hint: 'Vd: Trụ số 6 và Trụ số 13' },
      { label: 'Số lượng',               key: 'so_luong',     type: 'number',   required: true },
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
      { label: 'Kéo thêm cáp nguồn',     key: 'keo_them_cap',   type: 'select',   required: false, options: ['', 'Có', 'Không'] },
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
      { label: 'Độ cao nâng',                                                    key: 'do_cao_nang',   type: 'text',     required: true,  hint: 'Vd: 200 (mm)' },
      { label: 'Số lượng',                                                       key: 'so_luong',      type: 'number',   required: true },
      { label: 'Quy cách móng',                                                  key: 'quy_cach_mong', type: 'text',     required: false, hint: 'Vd: M16 × 400' },
      { label: 'Chiều cao nắp cửa trụ (từ mặt bích đến nắp cửa trụ)',            key: 'chieu_cao_nap', type: 'text',     required: false, hint: 'Vd: 1250' },
      { label: 'Người khảo sát',                                                 key: 'nguoi_ks',      type: 'text',     required: true },
      { label: 'Ngày khảo sát',                                                  key: 'ngay_ks',       type: 'date_auto' },
      { label: 'Ghi chú',                                                        key: 'ghi_chu',       type: 'textarea', required: false },
      { label: 'link',                                                           key: 'link_gmap',     type: 'link_gmap' }
    ]
  }
};

/** Trả mảng các key (= 15 loại). Dùng cho trang chủ render grid. */
export const SCHEMA_KEYS = Object.keys(SCHEMAS);

/** Lookup nhanh tên hiển thị + icon theo key. */
export function getSchemaInfo(key) {
  const s = SCHEMAS[key];
  return s ? { name: s.name, sheet: s.sheet, icon: s.icon } : null;
}
