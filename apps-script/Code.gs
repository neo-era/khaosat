/**
 * khaosat — Apps Script backend cho dự án khảo sát chiếu sáng SAPULICO
 *
 * Đặt vào: Google Sheets `khao-sat-ke-hoach` → Extensions → Apps Script
 *
 * Script Properties cần set (Project Settings → Script Properties):
 *   SPREADSHEET_ID         — ID của file Google Sheets (lấy từ URL)
 *   AUTH_SALT              — chuỗi random ≥32 ký tự (dùng cho hash password + HMAC token)
 *   CLOUDINARY_CLOUD_NAME  — tên cloud Cloudinary (vd "lavipco")
 *   CLOUDINARY_API_KEY     — Cloudinary API Key
 *   CLOUDINARY_API_SECRET  — Cloudinary API Secret
 *
 * Hàm public (admin chạy thủ công 1 lần khi setup):
 *   initSheets()        — tạo 15 sheet khảo sát + KPI_Targets + phan quyen (skip nếu đã có)
 *   migrateTaikhoan()   — chuyển sheet taikhoan từ format cũ (tiếng Việt + plaintext) sang mới
 *   validateSheets()    — quét header tất cả sheet, báo lỗi nếu lệch
 *   hashPassword(plain) — sinh hash để paste vào sheet taikhoan khi đổi mật khẩu thủ công
 *
 * Endpoint POST (qua doPost):
 *   action=login    — body {username, password} → {ok, token, username, full_name, role, expires_at}
 *   action=submit   — body {token, type, data, photos, ua} → ghi 1 dòng vào sheet khảo sát tương ứng
 *   action=list     — body {token, type?, username?, from?, to?, includeDeleted?} → danh sách bản ghi
 *   action=delete   — body {token, type, stt} → soft-delete + xoá ảnh Cloudinary
 *   action=restore  — body {token, type, stt} → khôi phục soft-delete (không khôi phục ảnh)
 *   action=kpi      — body {token, month: "YYYY-MM"} → KPI tháng cho từng người khảo sát
 *   action=report   — body {token, types[], from, to, usernames[], status, groupBy} → 3 vùng aggregation
 */

// =====================================================================
// CONSTANTS — đồng bộ với CLAUDE.md mục 4, 5, 7
// =====================================================================

const TZ = 'Asia/Ho_Chi_Minh';
const TOKEN_TTL_MS = 8 * 60 * 60 * 1000;  // 8 tiếng

/** Mapping type-key → tên sheet trong Google Sheets (giữ NGUYÊN VĂN). */
const SHEET_MAP = {
  tang_cuong_den: 'Tang cuong den',
  ngam_hoa:       'Ngam Hoa',
  thay_den:       'Thay den',
  hkn:            '4, HKN',
  tc_noi:         '5. TCNoi',
  cap_luon_can:   '6, Cap luon can',
  tc_ngam:        '7. TCNgam',
  thay_can:       '8. Thay Can',
  thay_tru:       '9. Thay thế tru',
  choa_den:       '10.choa den',
  nap_tru:        '11. Nap tru',
  vo_tu:          '12, Vo tu',
  tc_den_kc_xa:   '13 Tăng cường đèn kc xa',
  decal_so_tru:   '14 Decal số trụ',
  nang_mong:      '15. Nâng móng',
  thao_go_bang_ron: '16. Thao go bang ron'
};

/** Header gốc của 16 loại khảo sát (NGUYÊN VĂN tiếng Việt, đồng bộ schemas.js + CLAUDE.md mục 5). */
const HEADERS = {
  tang_cuong_den: [
    'STT','Hẻm','Tuyến đường','Quận','Phường','Tủ điều khiển',
    'Độ rộng đường','Dãy phân cách','Số làn xe','Đầu tuyến','Cuối tuyến',
    'Số đèn dự kiến','ngày khảo sát','kinh độ','vĩ độ','Người khảo sát',
    'Bản vẽ','Ghi chú','Vị trí','Tên hẻm','Trạng thái thiết kế','Link Google Map'
  ],
  ngam_hoa: [
    'STT','Tuyến đường','Quận','Phường','Tủ điều khiển','Độ rộng đường',
    'Dãy phân cách','Số làn xe','Đầu tuyến','Cuối tuyến','Số đèn dự kiến',
    'Đường nhựa','Vỉa hè các loại','Vỉa hè bê tông','Vỉa hè đá',
    'Số đèn thu hồi','CD cáp thu hồi','ngày khảo sát','kinh độ','vĩ độ',
    'Người khảo sát','Bản vẽ','Ghi chú'
  ],
  thay_den: [
    'STT','Tuyến đường','Quận','Phường','Tủ điều khiển','Đầu tuyến','Cuối tuyến',
    'Số đèn hiện hữu','Công suất đèn hiện hữu','Dây lên đèn','Năm lắp đặt',
    'ngày khảo sát','Người khảo sát','Bản vẽ','Ghi chú','link'
  ],
  hkn: [
    'STT','Tuyến đường','Quận','Phường','Tủ điều khiển','Năm lắp đặt',
    'Số lượng','Loại hộp (6A, 10A)','Người khảo sát','Ngày khảo sát',
    'Số đầu cáp','Ghi chú'
  ],
  tc_noi: [
    'STT','Tuyến đường','Quận','Phường','Tủ điều khiển','Năm lắp đặt',
    'Loại cáp hiện hữu','Số lượng','Người khảo sát','Ngày khảo sát','Ghi chú','link'
  ],
  cap_luon_can: [
    'STT','Vị trí','Tuyến đường','Quận','Phường','Tủ điều khiển','Năm lắp đặt',
    'Loại cáp','Số lượng','Người khảo sát','Ngày khảo sát','Ghi chú','link'
  ],
  tc_ngam: [
    'STT','Tuyến đường','Quận','Phường','Tủ điều khiển','Năm lắp đặt',
    'Số lượng','Loại cáp','Loại mương cáp','Người khảo sát','Ngày khảo sát','Ghi chú','link'
  ],
  thay_can: [
    'STT','Vị trí','Tuyến đường','Quận','Phường','Tủ điều khiển','Năm lắp đặt',
    'Số lượng','Loại kiềng (HTLT, TTLT, B2...)','Loại cần (3,8m ; 3m...)',
    'Người khảo sát','Ngày khảo sát','Ghi chú','link'
  ],
  thay_tru: [
    'STT','Vị trí','Tuyến đường','Quận','Phường','Tủ điều khiển','Số lượng',
    'Loại sự cố (mục, gỉ sét, hư mặt bích,...)',
    'Quy cách trụ (loại trụ: chiều cao VD: STK 9m; be tông 8,4m; trang trí;...)',
    'Quy cách móng','Năm lắp đặt','Người khảo sát','Ngày khảo sát',
    'Ghi chú (kèm thay cần đèn,...)','link'
  ],
  choa_den: [
    'STT','Tuyến đường','Quận','Phường','Tủ điều khiển','Năm lắp đặt',
    'Số lượng','Loại chóa','Người khảo sát','Ngày khảo sát','Ghi chú','link'
  ],
  nap_tru: [
    'STT','Tuyến đường','Quận','Phường','Tủ điều khiển','Số trụ','Số lượng',
    'Quy cách','Người khảo sát','Ngày khảo sát','Ghi chú','link'
  ],
  vo_tu: [
    'STT','Tuyến đường','Quận','Phường','Tủ điều khiển','Năm lắp đặt',
    'Số lượng','Người khảo sát','Ngày khảo sát','Ghi chú','link'
  ],
  tc_den_kc_xa: [
    'STT','Vị trí','Tuyến đường','Quận','Phường','Tủ điều khiển',
    'Chủng loại đèn','Số lượng','Chủng loại cần đèn','Quy cách kiềng cần đèn',
    'Kéo thêm cáp nguồn','Khoảng cách giữa 2 trụ','Người khảo sát','Ngày khảo sát','Ghi chú','link'
  ],
  decal_so_tru: [
    'STT','Vị trí','Tuyến đường','Quận','Phường','Tủ điều khiển',
    'Số lượng','Quy cách','Người khảo sát','Ngày khảo sát','Ghi chú','link'
  ],
  nang_mong: [
    'STT','Vị trí','Tuyến đường','Quận','Phường','Tủ điều khiển','Năm lắp đặt',
    'Độ cao nâng','Số lượng','Quy cách móng',
    'Chiều cao nắp cửa trụ (từ mặt bích đến nắp cửa trụ)',
    'Người khảo sát','Ngày khảo sát','Ghi chú','link'
  ],
  thao_go_bang_ron: [
    'STT','Tuyến đường','Quận','Phường','Vị trí','Loại quảng cáo','Số lượng',
    'Người khảo sát','Ngày khảo sát','kinh độ','vĩ độ','Ghi chú','Link Google Map'
  ]
};

/** 6 cột bonus thêm vào CUỐI mỗi sheet khảo sát. */
const BONUS_COLS = ['Ảnh (URLs)', 'Submitted At', 'User Agent', 'Username', 'Deleted At', 'Deleted By'];

/** Loại form không có GPS nào cả — loại ra khỏi mẫu số khi tính pct_gps. */
const NO_GPS_TYPES = ['hkn'];

/**
 * Phân loại GPS theo mức lưu trữ (xem CLAUDE.md mục 5 — bảng GPS):
 *   GPS_LATLONG_TYPES : lưu cả kinh độ + vĩ độ (cột riêng)
 *   GPS_LINK_TYPES    : chỉ lưu link Google Map (cột 'link')
 *   NO_GPS_TYPES      : không có GPS, bỏ qua khi tính pct_gps
 */
const GPS_LATLONG_TYPES = ['tang_cuong_den', 'ngam_hoa', 'thao_go_bang_ron'];
const GPS_LINK_TYPES    = [
  'thay_den', 'tc_noi', 'cap_luon_can', 'tc_ngam', 'thay_can',
  'thay_tru', 'choa_den', 'nap_tru', 'vo_tu',
  'tc_den_kc_xa', 'decal_so_tru', 'nang_mong'
];

// Sheet taikhoan chỉ còn danh bạ — mật khẩu nằm ở Script Properties (xem CREDENTIAL STORE)
const TAIKHOAN_HEADER = ['username', 'full_name', 'role', 'active', 'created_at'];
const KPI_TARGETS_HEADER = ['param', 'value'];
const PHAN_QUYEN_HEADER = ['vaiTro', 'submit', 'delete', 'kpi', 'manage', 'report', 'moTa'];
const AUDIT_HEADER = ['timestamp', 'action', 'username', 'target_sheet', 'target_stt', 'note'];
const NOTIFICATION_TARGETS_HEADER = ['email', 'enabled', 'only_types'];
const TAILIEU_HEADER = ['id', 'title', 'category', 'url', 'description', 'added_by', 'added_at'];
const DOC_CATEGORIES = ['Văn bản pháp luật', 'Tiêu chuẩn kỹ thuật',
                       'Đảng - Nhà nước - Chính phủ', 'Hướng dẫn nội bộ', 'Khác'];
const SCHEDULE_HEADER = ['id', 'ktv_username', 'ngay', 'loai_ks', 'khu_vuc',
                         'ghi_chu', 'status', 'created_by', 'created_at'];
const SCHEDULE_STATUSES = ['pending', 'done', 'skipped'];

const KPI_DEFAULTS = [
  ['target_submissions_per_month', 50],
  ['target_distinct_types', 5],
  ['target_active_days', 20],
  ['weight_frequency', 0.40],
  ['weight_quality', 0.30],
  ['weight_diversity', 0.15],
  ['weight_completeness', 0.10],
  ['weight_stability', 0.05]
];

const PHAN_QUYEN_DEFAULTS = [
  ['admin', true,  true,  true,  true,  true,  'Quản lý văn phòng — toàn quyền'],
  ['user',  true,  true,  true,  true,  true,  'Quản lý phụ (cùng quyền admin)'],
  ['user1', true,  false, false, false, false, 'người khảo sát hiện trường — chỉ nhập KS'],
  ['demo',  false, false, false, false, false, 'Tài khoản xem thử — readonly']
];

/** Fallback nếu sheet phan quyen lỗi (đồng bộ với PHAN_QUYEN_DEFAULTS). */
const DEFAULT_PERMISSIONS = {
  admin:  { submit: true,  delete: true,  kpi: true,  manage: true,  report: true,  edit: true,  users_manage: true,  schedule_write: true,  notify_admin: true,  map: true  },
  user:   { submit: true,  delete: true,  kpi: true,  manage: true,  report: true,  edit: true,  users_manage: false, schedule_write: true,  notify_admin: true,  map: true  },
  user1:  { submit: true,  delete: false, kpi: false, manage: false, report: false, edit: false, users_manage: false, schedule_write: false, notify_admin: false, map: true  },
  demo:   { submit: false, delete: false, kpi: false, manage: false, report: false, edit: false, users_manage: false, schedule_write: false, notify_admin: false, map: false }
};

/** Danh sách 5 action mới của v1.1+ (cần thêm cột trong sheet phan quyen). */
const NEW_PERMISSIONS_V11 = ['edit', 'users_manage', 'schedule_write', 'notify_admin', 'map'];

// =====================================================================
// UTILITIES
// =====================================================================

function getProp(key) {
  return PropertiesService.getScriptProperties().getProperty(key);
}

function getSpreadsheet() {
  const id = getProp('SPREADSHEET_ID');
  if (!id) throw new Error('Chưa set SPREADSHEET_ID trong Script Properties');
  return SpreadsheetApp.openById(id);
}

function getSalt() {
  const s = getProp('AUTH_SALT');
  if (!s) throw new Error('Chưa set AUTH_SALT trong Script Properties');
  return s;
}

function getCloudinaryCreds() {
  return {
    cloudName: getProp('CLOUDINARY_CLOUD_NAME'),
    apiKey: getProp('CLOUDINARY_API_KEY'),
    apiSecret: getProp('CLOUDINARY_API_SECRET')
  };
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function bytesToHex(bytes) {
  return bytes.map(b => ('0' + (b & 0xFF).toString(16)).slice(-2)).join('');
}

function sha256Hex(str) {
  return bytesToHex(Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256, str, Utilities.Charset.UTF_8));
}

function sha1Hex(str) {
  return bytesToHex(Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_1, str, Utilities.Charset.UTF_8));
}

function hmacSha256Hex(message, key) {
  return bytesToHex(Utilities.computeHmacSha256Signature(
    message, key, Utilities.Charset.UTF_8));
}

function colNumToLetter(n) {
  let s = '';
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function nowVnString() {
  return Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm:ss');
}

function isoNow() {
  return new Date().toISOString();
}

function safe(v) {
  return v === undefined || v === null ? '' : v;
}

// =====================================================================
// AUTH — hash password, generate/verify token
// =====================================================================

/**
 * @deprecated Từ 2026-08-16 mật khẩu KHÔNG còn lưu trong sheet taikhoan.
 * Kho mật khẩu mới nằm ở Script Properties (xem section CREDENTIAL STORE).
 * Tạo/đổi mật khẩu: dùng trang users.html, hoặc chạy setPassword('user','matkhau').
 * Giữ hàm này chỉ để verify được các bản ghi cũ chưa migrate.
 */
function hashPassword(plain) {
  if (!plain) throw new Error('plain password is empty');
  return sha256Hex(String(plain) + getSalt());
}

/** Sinh token stateless 8 tiếng. */
function generateToken(username) {
  const expiresAt = Date.now() + TOKEN_TTL_MS;
  const payload = username + '|' + expiresAt;
  const sig = hmacSha256Hex(payload, getSalt());
  return Utilities.base64EncodeWebSafe(payload + '|' + sig);
}

/**
 * Verify token và trả thông tin user fresh từ sheet taikhoan.
 * Throw nếu token sai/hết hạn/user disabled.
 */
function verifyToken(token) {
  if (!token) throw new Error('missing token');
  let decoded;
  try {
    decoded = Utilities.newBlob(Utilities.base64DecodeWebSafe(token)).getDataAsString();
  } catch (e) {
    throw new Error('invalid token encoding');
  }
  const parts = decoded.split('|');
  if (parts.length !== 3) throw new Error('invalid token format');
  const [username, expiresAtStr, sig] = parts;
  const expiresAt = parseInt(expiresAtStr, 10);
  if (!expiresAt || Date.now() > expiresAt) throw new Error('token expired');
  const expectedSig = hmacSha256Hex(username + '|' + expiresAtStr, getSalt());
  if (sig !== expectedSig) throw new Error('invalid token signature');

  const user = findUser(username);
  if (!user) throw new Error('user not found');
  if (user.active === false) throw new Error('user disabled');
  return { username: user.username, role: user.role, full_name: user.full_name };
}

/** Đọc 1 user từ sheet taikhoan theo username (case-sensitive). */
function findUser(username) {
  const sheet = getSpreadsheet().getSheetByName('taikhoan');
  if (!sheet) throw new Error('Sheet taikhoan không tồn tại');
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return null;
  const header = data[0].map(String);
  const idxUser = header.indexOf('username');
  // password_hash: cột cũ, chỉ còn dùng để verify user chưa migrate sang Script Properties
  const idxHash = header.indexOf('password_hash');
  const idxName = header.indexOf('full_name');
  const idxRole = header.indexOf('role');
  const idxActive = header.indexOf('active');
  if (idxUser < 0) throw new Error('Cột "username" không tồn tại trong sheet taikhoan');
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idxUser]) === String(username)) {
      return {
        username: data[i][idxUser],
        password_hash: idxHash >= 0 ? data[i][idxHash] : '',
        full_name: idxName >= 0 ? data[i][idxName] : '',
        role: idxRole >= 0 ? data[i][idxRole] : '',
        // Nếu cột active không có → ngầm hiểu TRUE
        active: idxActive >= 0 ? data[i][idxActive] === true : true
      };
    }
  }
  return null;
}

// =====================================================================
// CREDENTIAL STORE — mật khẩu lưu trong Script Properties, KHÔNG lưu trong Sheets
// =====================================================================
//
// Vì sao đổi (2026-08-16): trước đây `password_hash` nằm ngay trong sheet
// `taikhoan`, nên ai mở được file Google Sheets là thấy toàn bộ hash; sheet lại
// còn bị publish ra web nên hash lộ công khai. Nay:
//   - Mật khẩu nằm ở Script Properties → chỉ người mở được Apps Script editor thấy.
//   - Sheet `taikhoan` chỉ còn danh bạ: username / full_name / role / active.
//
// Bản ghi: Script Property `CRED_<username thường>` chứa JSON
//   { v:1, salt:<32 hex>, hash:<64 hex>, iters:<số>, must_change:<bool>, updated_at:<string> }
//
// Khác biệt so với cách cũ: salt RIÊNG từng user (cũ: chung 1 AUTH_SALT) và băm
// lặp nhiều vòng thay vì 1 vòng SHA-256, để làm chậm việc dò mật khẩu.

/**
 * Số vòng lặp băm — chọn 100 để đăng nhập nhanh nhất có thể.
 *
 * Chi phí này CHỈ trả 1 lần lúc đăng nhập (và lúc đổi mật khẩu). Mọi thao tác
 * khác — submit form, xem KPI, tải báo cáo — đi qua verifyToken, KHÔNG băm lần nào.
 * Nên có tăng lên cũng không làm app chậm đi trong lúc dùng.
 *
 * 100 vòng = kẻ dò mật khẩu phải tốn gấp 100 lần thời gian so với băm 1 vòng.
 * Muốn chắc hơn thì chạy benchmarkHash() rồi nâng lên 500–1000; bản ghi cũ vẫn
 * dùng được vì mỗi bản ghi tự nhớ số vòng của nó.
 */
const PWD_ITERS = 100;

/** Độ dài tối thiểu của mật khẩu (dùng chung cho mọi nơi đặt/đổi mật khẩu). */
const PWD_MIN_LEN = 8;

/** Pepper cho băm mật khẩu. Tách khỏi AUTH_SALT để đổi được mà không huỷ token. */
function getPwdPepper() {
  return getProp('PWD_PEPPER') || getSalt();
}

/**
 * Sinh và cài đặt PWD_PEPPER — admin chạy tay 1 lần, TRƯỚC resetAllPasswords().
 *
 * Chạy hàm này thay vì tự sinh chuỗi ở nơi khác: chuỗi bí mật không đi qua
 * clipboard, không qua Console trình duyệt, không qua tin nhắn — sinh ra và nằm
 * luôn trong Script Properties.
 *
 * An toàn: từ chối nếu PWD_PEPPER đã tồn tại (ghi đè = làm hỏng mọi mật khẩu).
 */
function taoPwdPepper() {
  const props = PropertiesService.getScriptProperties();

  if (props.getProperty('PWD_PEPPER')) {
    const msg = 'PWD_PEPPER đã có sẵn — KHÔNG ghi đè. Ghi đè sẽ làm mọi mật khẩu ' +
                'ngừng hoạt động. Thật sự muốn đổi thì xoá tay trong Thuộc tính tập lệnh, ' +
                'chạy lại hàm này, rồi BẮT BUỘC chạy resetAllPasswords().';
    Logger.log(msg);
    return { ok: false, error: msg };
  }

  // Đếm mật khẩu đã tạo — nếu đã có thì đặt pepper bây giờ sẽ làm chúng hỏng
  const soMatKhauDaCo = Object.keys(props.getProperties())
    .filter(k => k.indexOf('CRED_') === 0).length;

  // 64 ký tự hex từ 2 UUID — ngẫu nhiên tốt hơn Math.random()
  const pepper = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '');
  props.setProperty('PWD_PEPPER', pepper);

  const result = {
    ok: true,
    da_tao: true,
    do_dai: pepper.length,
    so_mat_khau_da_co: soMatKhauDaCo,
    buoc_tiep_theo: soMatKhauDaCo > 0
      ? '⚠️ Đã có ' + soMatKhauDaCo + ' mật khẩu tạo trước đó — chúng vừa ngừng hoạt động. ' +
        'PHẢI chạy resetAllPasswords() ngay để đặt lại.'
      : 'Xong. Giờ chạy resetAllPasswords() để đặt mật khẩu tạm cho mọi người.'
  };
  // KHÔNG log giá trị pepper — nó nằm trong Thuộc tính tập lệnh là đủ
  Logger.log(JSON.stringify(result, null, 2));
  return result;
}

function credKey(username) {
  return 'CRED_' + String(username).trim().toLowerCase();
}

function readCred(username) {
  const raw = PropertiesService.getScriptProperties().getProperty(credKey(username));
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (e) {
    Logger.log('readCred: bản ghi hỏng cho ' + username + ' — ' + e);
    return null;
  }
}

function writeCred(username, obj) {
  PropertiesService.getScriptProperties().setProperty(credKey(username), JSON.stringify(obj));
}

function deleteCred(username) {
  PropertiesService.getScriptProperties().deleteProperty(credKey(username));
}

/** Salt ngẫu nhiên 32 ký tự hex. */
function randomSalt() {
  return (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '').slice(0, 32);
}

/**
 * Băm mật khẩu: lặp HMAC-SHA256 `iters` vòng, khoá = pepper bí mật.
 * Lặp nhiều vòng khiến kẻ có được file hash vẫn phải tốn rất nhiều thời gian để dò.
 */
function deriveHash(password, saltHex, iters) {
  const keyBytes = Utilities.newBlob(getPwdPepper()).getBytes();
  let cur = Utilities.computeHmacSha256Signature(
    Utilities.newBlob(String(password) + saltHex).getBytes(), keyBytes);
  for (let i = 1; i < iters; i++) {
    cur = Utilities.computeHmacSha256Signature(cur, keyBytes);
  }
  return bytesToHex(cur);
}

/**
 * Đặt mật khẩu cho 1 user (ghi đè nếu đã có).
 * @param {string} username
 * @param {string} plain
 * @param {boolean} [mustChange=true] - bắt user đổi ở lần đăng nhập kế tiếp
 */
function setPassword(username, plain, mustChange) {
  const err = validatePasswordRule(username, plain);
  if (err) throw new Error(err);
  const salt = randomSalt();
  writeCred(username, {
    v: 1,
    salt: salt,
    hash: deriveHash(plain, salt, PWD_ITERS),
    iters: PWD_ITERS,
    must_change: mustChange !== false,
    updated_at: nowVnString()
  });
  return true;
}

/** Quy tắc mật khẩu dùng chung. Trả về chuỗi lỗi, hoặc null nếu hợp lệ. */
function validatePasswordRule(username, plain) {
  const p = String(plain || '');
  if (p.length < PWD_MIN_LEN) return 'Mật khẩu phải từ ' + PWD_MIN_LEN + ' ký tự trở lên';
  if (p.toLowerCase() === String(username || '').toLowerCase()) {
    return 'Mật khẩu không được trùng tên đăng nhập';
  }
  return null;
}

/**
 * Kiểm tra mật khẩu.
 * @returns {{ok: boolean, must_change: boolean, legacy: boolean}}
 *
 * Có đường tương thích ngược: user chưa có bản ghi CRED_ (chưa chạy
 * resetAllPasswords) vẫn đăng nhập được bằng hash cũ trong sheet, và hệ thống
 * tự chuyển họ sang kho mới ngay lúc đó. Nhờ vậy không ai bị khoá ngoài giữa chừng.
 */
function verifyPassword(username, plain, legacyHashFromSheet) {
  const cred = readCred(username);

  if (cred) {
    const calc = deriveHash(plain, cred.salt, cred.iters || PWD_ITERS);
    if (calc !== cred.hash) return { ok: false, must_change: false, legacy: false };
    return { ok: true, must_change: cred.must_change === true, legacy: false };
  }

  // Chưa có bản ghi mới → thử hash cũ trong sheet
  const legacy = String(legacyHashFromSheet || '').trim();
  if (!legacy) return { ok: false, must_change: false, legacy: false };
  if (hashPassword(plain) !== legacy) return { ok: false, must_change: false, legacy: false };

  // Đúng mật khẩu cũ → chuyển sang kho mới, và bắt đổi vì mật khẩu cũ coi như đã lộ
  try {
    const salt = randomSalt();
    writeCred(username, {
      v: 1, salt: salt, hash: deriveHash(plain, salt, PWD_ITERS), iters: PWD_ITERS,
      must_change: true, updated_at: nowVnString()
    });
    Logger.log('Đã chuyển mật khẩu của ' + username + ' sang Script Properties');
  } catch (e) {
    Logger.log('Không ghi được cred cho ' + username + ': ' + e);
  }
  return { ok: true, must_change: true, legacy: true };
}

/**
 * Đo tốc độ băm để chọn PWD_ITERS. Admin chạy tay 1 lần (không bắt buộc).
 *
 * Con số in ra là thời gian NGƯỜI DÙNG PHẢI ĐỢI THÊM khi bấm nút Đăng nhập —
 * mỗi ngày 1-2 lần, không phải mỗi thao tác.
 */
function benchmarkHash() {
  const salt = randomSalt();
  const out = [];
  [50, 100, 200, 500, 1000, 2000].forEach(n => {
    const t0 = Date.now();
    deriveHash('mat-khau-thu-nghiem', salt, n);
    out.push({ iters: n, ms: Date.now() - t0 });
  });
  // Gợi ý: số vòng lớn nhất mà người dùng vẫn thấy "bấm là vào" (dưới 200ms)
  const goi_y = (out.filter(r => r.ms <= 200).pop() || out[0]).iters;
  const result = {
    ok: true,
    PWD_ITERS_dang_dung: PWD_ITERS,
    thoi_gian_dang_nhap_hien_tai_ms: (out.filter(r => r.iters === PWD_ITERS)[0] || {}).ms,
    goi_y_neu_muon_chac_hon: goi_y,
    chi_tiet: out,
    ghi_chu: 'Chi phi nay chi tra 1 lan luc dang nhap, khong anh huong luc dung app.'
  };
  Logger.log(JSON.stringify(result, null, 2));
  return result;
}

/**
 * ĐỔI TOÀN BỘ MẬT KHẨU + xoá cột password_hash khỏi sheet. Admin chạy tay 1 lần.
 *
 * Dùng khi mật khẩu cũ bị coi là đã lộ (trường hợp 2026-08-16: mật khẩu plaintext
 * bị commit vào repo public). Sinh mật khẩu tạm cho từng user, bắt đổi ở lần
 * đăng nhập đầu.
 *
 * Mật khẩu tạm chỉ hiện 1 lần trong Execution log — copy phát cho từng người rồi thôi.
 */
function resetAllPasswords() {
  const sheet = getSpreadsheet().getSheetByName('taikhoan');
  if (!sheet) throw new Error('Sheet taikhoan không tồn tại');
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) throw new Error('Sheet taikhoan chưa có user nào');

  const header = data[0].map(String);
  const idxUser = header.indexOf('username');
  if (idxUser < 0) throw new Error('Sheet thiếu cột username');

  const danh_sach = [];
  for (let i = 1; i < data.length; i++) {
    const u = String(data[i][idxUser] || '').trim();
    if (!u) continue;
    const tmp = randomPassword(12);
    setPassword(u, tmp, true);
    danh_sach.push({ username: u, mat_khau_tam: tmp });
  }

  // Xoá hẳn cột password_hash — dữ liệu nhạy cảm không còn lý do nằm trong sheet
  const idxHash = header.indexOf('password_hash');
  let da_xoa_cot = false;
  if (idxHash >= 0) {
    sheet.deleteColumn(idxHash + 1);
    da_xoa_cot = true;
  }

  appendAuditLog('reset_all_passwords', 'system', 'taikhoan', String(danh_sach.length),
    'users=' + danh_sach.map(x => x.username).join(','));

  Logger.log('===== MẬT KHẨU TẠM — COPY PHÁT CHO TỪNG NGƯỜI RỒI XOÁ LOG =====');
  danh_sach.forEach(x => Logger.log(x.username + '\t' + x.mat_khau_tam));
  Logger.log('===== Tất cả sẽ bị bắt đổi mật khẩu ở lần đăng nhập đầu =====');

  return { ok: true, so_user: danh_sach.length, da_xoa_cot_password_hash: da_xoa_cot,
           danh_sach: danh_sach };
}

/** Sinh mật khẩu ngẫu nhiên, bỏ các ký tự dễ nhìn nhầm (0 O o l 1 I). */
function randomPassword(len) {
  const chars = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789@#$%';
  let s = '';
  for (let i = 0; i < (len || 12); i++) {
    s += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return s;
}

/** Đặt lại mật khẩu 1 user từ editor (tiện khi ai đó quên mật khẩu). */
function setPasswordThuCong() {
  // ⚠️ Sửa 2 giá trị dưới đây rồi chạy hàm này:
  const USERNAME = 'PASTE_USERNAME';
  const MAT_KHAU = 'PASTE_MAT_KHAU_MOI';
  if (USERNAME === 'PASTE_USERNAME') {
    throw new Error('Sửa USERNAME và MAT_KHAU trong hàm setPasswordThuCong() trước khi chạy.');
  }
  setPassword(USERNAME, MAT_KHAU, true);
  Logger.log('Đã đặt mật khẩu cho ' + USERNAME + '. User sẽ bị bắt đổi ở lần đăng nhập đầu.');
  return { ok: true };
}

// =====================================================================
// PERMISSIONS — đọc runtime từ sheet phan quyen với cache 60s
// =====================================================================

function getPermissions() {
  const cache = CacheService.getScriptCache();
  const cached = cache.get('permissions');
  if (cached) return JSON.parse(cached);
  try {
    const sheet = getSpreadsheet().getSheetByName('phan quyen');
    if (!sheet) throw new Error('sheet missing');
    const data = sheet.getDataRange().getValues();
    if (data.length < 2) throw new Error('sheet empty');
    const header = data[0].map(String);
    const idxRole = header.indexOf('vaiTro');
    if (idxRole < 0) throw new Error('missing vaiTro col');
    // 10 action: 5 cũ + 5 mới v1.1+
    const actions = ['submit', 'delete', 'kpi', 'manage', 'report',
                     'edit', 'users_manage', 'schedule_write', 'notify_admin', 'map'];
    const perms = {};
    for (let i = 1; i < data.length; i++) {
      const role = String(data[i][idxRole] || '').trim();
      if (!role) continue;
      perms[role] = {};
      actions.forEach(a => {
        const idx = header.indexOf(a);
        // Nếu cột không tồn tại → fallback default cho action đó
        if (idx < 0) {
          perms[role][a] = !!(DEFAULT_PERMISSIONS[role] && DEFAULT_PERMISSIONS[role][a]);
        } else {
          perms[role][a] = data[i][idx] === true;
        }
      });
    }
    cache.put('permissions', JSON.stringify(perms), 60);
    return perms;
  } catch (err) {
    Logger.log('getPermissions fallback to default: ' + err);
    return DEFAULT_PERMISSIONS;
  }
}

/** Xoá cache permissions để force reload từ sheet ngay lập tức. */
function clearPermissionsCache() {
  CacheService.getScriptCache().remove('permissions');
  Logger.log('Đã xoá cache permissions. Request kế tiếp sẽ đọc sheet phan quyen mới.');
  return { ok: true };
}

/**
 * Mở rộng sheet `phan quyen` với 5 cột v1.1+: edit, users_manage, schedule_write, notify_admin, map.
 * Chèn TRƯỚC cột moTa (nếu có). Set giá trị mặc định theo DEFAULT_PERMISSIONS.
 * Idempotent: chạy lại an toàn, bỏ qua cột đã có.
 * Admin chạy 1 lần khi triển khai v1.1+.
 */
function extendPhanQuyenSheet() {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName('phan quyen');
  if (!sheet) throw new Error('Sheet `phan quyen` không tồn tại. Chạy initSheets() trước.');

  const data = sheet.getDataRange().getValues();
  if (data.length < 2) throw new Error('Sheet phan quyen rỗng. Chạy initSheets() trước.');

  let header = data[0].map(String);
  const idxMoTa = header.indexOf('moTa');
  const result = { added_cols: [], skipped_cols: [], updated_values: 0 };

  // Thêm các cột còn thiếu (chèn TRƯỚC moTa nếu có)
  for (const action of NEW_PERMISSIONS_V11) {
    if (header.indexOf(action) >= 0) {
      result.skipped_cols.push(action);
      continue;
    }
    // Insert column trước moTa, hoặc cuối nếu không có moTa
    const insertAt = (idxMoTa >= 0 ? header.indexOf('moTa') + 1 : header.length + 1);
    sheet.insertColumnBefore(insertAt);
    sheet.getRange(1, insertAt).setValue(action);
    // Re-read header sau khi insert
    header = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
    result.added_cols.push(action);
  }

  // Set giá trị mặc định cho mỗi role (chỉ ghi nếu cell rỗng — KHÔNG ghi đè giá trị admin đã set)
  const idxRole = header.indexOf('vaiTro');
  const lastRow = sheet.getLastRow();
  for (let r = 2; r <= lastRow; r++) {
    const role = String(sheet.getRange(r, idxRole + 1).getValue() || '').trim();
    if (!role || !DEFAULT_PERMISSIONS[role]) continue;
    for (const action of NEW_PERMISSIONS_V11) {
      const idxA = header.indexOf(action);
      if (idxA < 0) continue;
      const cell = sheet.getRange(r, idxA + 1);
      if (cell.getValue() === '' || cell.getValue() === null) {
        cell.setValue(DEFAULT_PERMISSIONS[role][action] === true);
        result.updated_values++;
      }
    }
  }

  // Apply checkbox validation cho 5 cột mới (try/catch vì có thể fail nếu sheet có column type)
  for (const action of NEW_PERMISSIONS_V11) {
    const idxA = header.indexOf(action);
    if (idxA < 0) continue;
    try {
      const rule = SpreadsheetApp.newDataValidation().requireCheckbox().build();
      sheet.getRange(2, idxA + 1, lastRow - 1, 1).setDataValidation(rule);
    } catch (e) {
      Logger.log('Không set checkbox cho cột ' + action + ': ' + e.message);
    }
  }

  // Xoá cache để verify hiệu lực ngay
  clearPermissionsCache();

  Logger.log(JSON.stringify(result, null, 2));
  return Object.assign({ ok: true }, result);
}

function can(role, action) {
  const p = getPermissions();
  return !!(p[role] && p[role][action]);
}

function isFullAccess(role) {
  return role === 'admin' || role === 'user';
}

// =====================================================================
// SETUP UTILITIES — chạy thủ công khi cài đặt
// =====================================================================

/**
 * Tự tạo 15 sheet khảo sát + KPI_Targets + phan quyen (nếu chưa có).
 * KHÔNG ghi đè sheet đã tồn tại. KHÔNG động đến sheet taikhoan (đã có sẵn).
 */
function initSheets() {
  const ss = getSpreadsheet();
  const created = [];
  const skipped = [];

  // 15 sheet khảo sát
  Object.keys(SHEET_MAP).forEach(type => {
    const sheetName = SHEET_MAP[type];
    let sheet = ss.getSheetByName(sheetName);
    // Nếu sheet đã tồn tại VÀ có header (cell A1 không rỗng) → skip
    if (sheet && sheet.getLastColumn() > 0 && sheet.getRange(1, 1).getValue() !== '') {
      skipped.push(sheetName);
      return;
    }
    // Sheet chưa có HOẶC đã có nhưng rỗng (do lần chạy trước fail giữa chừng) → tạo/set header
    if (!sheet) sheet = ss.insertSheet(sheetName);
    const fullHeader = HEADERS[type].concat(BONUS_COLS);
    // Sheet mới default 26 cột — extend nếu header dài hơn (tang_cuong_den 28, ngam_hoa 29)
    const needCols = fullHeader.length;
    const haveCols = sheet.getMaxColumns();
    if (needCols > haveCols) {
      sheet.insertColumnsAfter(haveCols, needCols - haveCols);
    }
    sheet.getRange(1, 1, 1, needCols).setValues([fullHeader]);
    sheet.setFrozenRows(1);

    // Set width cho vài cột thường gặp (index 1-based)
    const setW = (label, width) => {
      const idx = fullHeader.indexOf(label);
      if (idx >= 0) sheet.setColumnWidth(idx + 1, width);
    };
    setW('STT', 50);
    setW('ngày khảo sát', 140);
    setW('Ngày khảo sát', 140);
    setW('Người khảo sát', 140);
    setW('Ảnh (URLs)', 220);
    setW('Submitted At', 140);

    // Conditional format: Deleted At không rỗng → tô xám + strikethrough toàn row
    const deletedAtCol = fullHeader.indexOf('Deleted At') + 1;
    if (deletedAtCol > 0) {
      const letter = colNumToLetter(deletedAtCol);
      const range = sheet.getRange(2, 1, sheet.getMaxRows() - 1, fullHeader.length);
      const rule = SpreadsheetApp.newConditionalFormatRule()
        .whenFormulaSatisfied('=$' + letter + '2<>""')
        .setBackground('#f0f0f0')
        .setStrikethrough(true)
        .setRanges([range])
        .build();
      const rules = sheet.getConditionalFormatRules();
      rules.push(rule);
      sheet.setConditionalFormatRules(rules);
    }
    created.push(sheetName);
  });

  // Sheet KPI_Targets
  if (!ss.getSheetByName('KPI_Targets')) {
    const sheet = ss.insertSheet('KPI_Targets');
    sheet.getRange(1, 1, 1, KPI_TARGETS_HEADER.length).setValues([KPI_TARGETS_HEADER]);
    sheet.getRange(2, 1, KPI_DEFAULTS.length, 2).setValues(KPI_DEFAULTS);
    sheet.setFrozenRows(1);
    created.push('KPI_Targets');
  } else {
    skipped.push('KPI_Targets');
  }

  // Sheet phan quyen (chỉ tạo data default nếu chưa có data)
  let pqSheet = ss.getSheetByName('phan quyen');
  if (!pqSheet) {
    pqSheet = ss.insertSheet('phan quyen');
    created.push('phan quyen');
  }
  if (pqSheet.getLastRow() < 1) {
    pqSheet.getRange(1, 1, 1, PHAN_QUYEN_HEADER.length).setValues([PHAN_QUYEN_HEADER]);
    pqSheet.getRange(2, 1, PHAN_QUYEN_DEFAULTS.length, PHAN_QUYEN_HEADER.length)
      .setValues(PHAN_QUYEN_DEFAULTS);
    pqSheet.setFrozenRows(1);
    // Checkbox cho cột B-F (submit/delete/kpi/manage/report)
    const cbRule = SpreadsheetApp.newDataValidation().requireCheckbox().build();
    pqSheet.getRange(2, 2, PHAN_QUYEN_DEFAULTS.length, 5).setDataValidation(cbRule);
  }

  // Xoá Sheet1 nếu trống
  const defaultSheet = ss.getSheetByName('Sheet1') || ss.getSheetByName('Trang tính 1');
  if (defaultSheet && defaultSheet.getLastRow() <= 1 && defaultSheet.getLastColumn() <= 1) {
    try { ss.deleteSheet(defaultSheet); } catch (e) { /* may be only sheet */ }
  }

  const result = {
    ok: true,
    created: created,
    skipped: skipped,
    message: 'Đã hoàn tất initSheets. Tạo ' + created.length + ', skip ' + skipped.length + '.'
  };
  Logger.log(JSON.stringify(result, null, 2));
  return result;
}

/**
 * @deprecated LỖI THỜI từ 2026-08-16 — hàm này ghi mật khẩu vào cột `password_hash`,
 * mà cột đó đã bị bỏ (mật khẩu chuyển sang Script Properties).
 * Chạy nó bây giờ sẽ dựng lại cột chứa dữ liệu nhạy cảm trong sheet.
 * Cần đặt lại mật khẩu thì dùng `resetAllPasswords()` hoặc `setPasswordThuCong()`.
 */
function migrateTaikhoan() {
  throw new Error(
    'migrateTaikhoan() đã lỗi thời: mật khẩu không còn lưu trong sheet. ' +
    'Dùng resetAllPasswords() (đổi hết) hoặc setPasswordThuCong() (1 user).');
}

/** Bản cũ, giữ lại để tham khảo lịch sử. Không gọi tới. */
function migrateTaikhoan_DEPRECATED() {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName('taikhoan');
  if (!sheet) throw new Error('Sheet taikhoan không tồn tại');
  const result = {
    ok: true,
    renamed_columns: [],
    added_active: false,
    migrated_users: [],
    skipped: []
  };

  const data = sheet.getDataRange().getValues();
  if (data.length < 1) {
    sheet.getRange(1, 1, 1, TAIKHOAN_HEADER.length).setValues([TAIKHOAN_HEADER]);
    Logger.log('Sheet trống → set header English');
    return result;
  }

  let header = data[0].map(String);
  // Step 1: rename header tiếng Việt → English
  const renameMap = {
    'tenDangNhap': 'username',
    'matKhau': 'password_hash',
    'hoTen': 'full_name',
    'vaiTro': 'role',
    'Ngày cấp': 'created_at'
  };
  for (let i = 0; i < header.length; i++) {
    if (renameMap[header[i]]) {
      result.renamed_columns.push(header[i] + ' → ' + renameMap[header[i]]);
      header[i] = renameMap[header[i]];
    }
  }
  // Step 2: thêm cột active nếu chưa có
  if (header.indexOf('active') < 0) {
    header.push('active');
    result.added_active = true;
  }
  // Ghi header mới
  sheet.getRange(1, 1, 1, header.length).setValues([header]);

  // Step 3: hash plaintext passwords
  const idxUser = header.indexOf('username');
  const idxHash = header.indexOf('password_hash');
  const idxActive = header.indexOf('active');

  for (let r = 1; r < data.length; r++) {
    const username = String(data[r][idxUser] || '').trim();
    if (!username) continue;
    let pwd = String(data[r][idxHash] !== undefined ? data[r][idxHash] : '').trim();
    // Đã hash chưa? SHA-256 hex = 64 ký tự, toàn 0-9a-f
    const isHashed = /^[0-9a-f]{64}$/.test(pwd);
    if (!isHashed && pwd) {
      const newHash = hashPassword(pwd);
      try {
        sheet.getRange(r + 1, idxHash + 1).setValue(newHash);
        result.migrated_users.push(username + ' (plaintext "' + pwd + '" → hash)');
      } catch (e) {
        result.skipped.push(username + ' (lỗi ghi hash: ' + e.message + ')');
      }
    } else if (isHashed) {
      result.skipped.push(username + ' (đã hash)');
    }
    // Set active = TRUE nếu cột vừa thêm (lúc thêm cell sẽ rỗng)
    if (result.added_active) {
      try {
        sheet.getRange(r + 1, idxActive + 1).setValue(true);
      } catch (e) {
        Logger.log('setValue active row ' + (r + 1) + ' failed: ' + e.message);
      }
    }
  }

  // Apply checkbox validation cho cột active (có thể fail nếu sheet có column type — wrap try/catch)
  if (idxActive >= 0 && data.length > 1) {
    try {
      const cbRule = SpreadsheetApp.newDataValidation().requireCheckbox().build();
      sheet.getRange(2, idxActive + 1, data.length - 1, 1).setDataValidation(cbRule);
    } catch (e) {
      Logger.log('setDataValidation active failed (có thể do column type đã set sẵn): ' + e.message);
      result.warnings = result.warnings || [];
      result.warnings.push('Không set được checkbox cho cột active. Anh tự set bằng tay: chọn cột active → Format → Data validation → Checkbox.');
    }
  }
  // Apply dropdown cho cột role (cũng có thể fail)
  const idxRole = header.indexOf('role');
  if (idxRole >= 0 && data.length > 1) {
    try {
      const roleRule = SpreadsheetApp.newDataValidation()
        .requireValueInList(['admin', 'user', 'user1', 'demo'], true)
        .setAllowInvalid(false).build();
      sheet.getRange(2, idxRole + 1, data.length - 1, 1).setDataValidation(roleRule);
    } catch (e) {
      Logger.log('setDataValidation role failed (có thể do column type đã set sẵn): ' + e.message);
      result.warnings = result.warnings || [];
      result.warnings.push('Không set được dropdown cho cột role. Anh tự set bằng tay: chọn cột role → Data → Data validation → Dropdown từ list [admin, user, user1, demo].');
    }
  }
  try { sheet.setFrozenRows(1); } catch (e) { Logger.log('setFrozenRows failed: ' + e.message); }

  Logger.log(JSON.stringify(result, null, 2));
  return result;
}

/**
 * Tạo sheet `tailieu` (idempotent) — admin chạy 1 lần khi triển khai v1.2.5.
 * Seed 5 link mặc định nếu sheet trống.
 */
function initDocsSheet() {
  const ss = getSpreadsheet();
  let sheet = ss.getSheetByName('tailieu');
  const result = { ok: true, created: false, seeded: 0 };
  if (!sheet) {
    sheet = ss.insertSheet('tailieu');
    sheet.getRange(1, 1, 1, TAILIEU_HEADER.length).setValues([TAILIEU_HEADER]);
    sheet.setFrozenRows(1);
    sheet.setColumnWidth(1, 70);    // id
    sheet.setColumnWidth(2, 250);   // title
    sheet.setColumnWidth(3, 160);   // category
    sheet.setColumnWidth(4, 280);   // url
    sheet.setColumnWidth(5, 300);   // description
    result.created = true;
  }

  // Seed nếu chưa có dòng nào
  if (sheet.getLastRow() < 2) {
    const now = nowVnString();
    const seed = [
      ['Cổng Thông tin Chính phủ', 'Đảng - Nhà nước - Chính phủ', 'https://chinhphu.vn', 'Cổng thông tin điện tử Chính phủ nước CHXHCN Việt Nam'],
      ['Báo điện tử Đảng Cộng sản Việt Nam', 'Đảng - Nhà nước - Chính phủ', 'https://dangcongsan.vn', 'Báo điện tử của Đảng Cộng sản Việt Nam'],
      ['Bộ Công Thương', 'Đảng - Nhà nước - Chính phủ', 'https://moit.gov.vn', 'Bộ Công Thương Việt Nam'],
      ['UBND TP.HCM', 'Đảng - Nhà nước - Chính phủ', 'https://hochiminhcity.gov.vn', 'Uỷ ban Nhân dân Thành phố Hồ Chí Minh'],
      ['Sở Xây dựng TP.HCM', 'Đảng - Nhà nước - Chính phủ', 'https://soxaydung.hochiminhcity.gov.vn', 'Sở Xây dựng TPHCM — cơ quan quản lý chiếu sáng đô thị']
    ];
    const rows = seed.map(s => [Utilities.getUuid().slice(0, 8), s[0], s[1], s[2], s[3], 'system', now]);
    sheet.getRange(2, 1, rows.length, TAILIEU_HEADER.length).setValues(rows);
    result.seeded = rows.length;
  }

  Logger.log(JSON.stringify(result, null, 2));
  return result;
}

/**
 * action=docs_list — đọc sheet tailieu. Mọi role có thể xem.
 */
function handleDocsList(body) {
  verifyToken(body.token);  // chỉ cần login
  const sheet = getSpreadsheet().getSheetByName('tailieu');
  if (!sheet) return { ok: true, docs: [], categories: DOC_CATEGORIES };
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return { ok: true, docs: [], categories: DOC_CATEGORIES };
  const header = data[0].map(String);
  const idx = {};
  TAILIEU_HEADER.forEach(h => { idx[h] = header.indexOf(h); });
  const docs = [];
  for (let i = 1; i < data.length; i++) {
    const id = String(data[i][idx.id] || '').trim();
    if (!id) continue;
    docs.push({
      id: id,
      title: String(data[i][idx.title] || ''),
      category: String(data[i][idx.category] || 'Khác'),
      url: String(data[i][idx.url] || ''),
      description: String(data[i][idx.description] || ''),
      added_by: String(data[i][idx.added_by] || ''),
      added_at: String(data[i][idx.added_at] || '')
    });
  }
  return { ok: true, docs: docs, categories: DOC_CATEGORIES };
}

/**
 * action=docs_create — chỉ admin/user (full access).
 * Body: { token, title, url, category, description? }
 */
function handleDocsCreate(body) {
  const auth = verifyToken(body.token);
  if (!isFullAccess(auth.role)) return { ok: false, error: 'forbidden' };

  const title = String(body.title || '').trim();
  const url = String(body.url || '').trim();
  const category = String(body.category || 'Khác').trim();
  const description = String(body.description || '').trim();

  if (!title) return { ok: false, error: 'Thiếu tiêu đề' };
  if (!url || !/^https?:\/\//i.test(url)) return { ok: false, error: 'URL không hợp lệ (phải bắt đầu http:// hoặc https://)' };
  if (DOC_CATEGORIES.indexOf(category) < 0) return { ok: false, error: 'Category không hợp lệ: ' + category };

  // Đảm bảo sheet tồn tại (lazy init)
  let sheet = getSpreadsheet().getSheetByName('tailieu');
  if (!sheet) {
    initDocsSheet();
    sheet = getSpreadsheet().getSheetByName('tailieu');
  }

  const id = Utilities.getUuid().slice(0, 8);
  const row = [id, title, category, url, description, auth.username, nowVnString()];
  sheet.appendRow(row);
  appendAuditLog('docs_create', auth.username, 'tailieu', id, 'title=' + title);
  return { ok: true, id: id };
}

/**
 * action=docs_delete — chỉ admin/user.
 * Body: { token, id }
 */
function handleDocsDelete(body) {
  const auth = verifyToken(body.token);
  if (!isFullAccess(auth.role)) return { ok: false, error: 'forbidden' };

  const id = String(body.id || '').trim();
  if (!id) return { ok: false, error: 'Thiếu id' };

  const sheet = getSpreadsheet().getSheetByName('tailieu');
  if (!sheet) return { ok: false, error: 'Sheet tailieu chưa khởi tạo' };
  const data = sheet.getDataRange().getValues();
  const idxId = data[0].indexOf('id');
  if (idxId < 0) return { ok: false, error: 'Sheet thiếu cột id' };

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idxId]).trim() === id) {
      sheet.deleteRow(i + 1);
      appendAuditLog('docs_delete', auth.username, 'tailieu', id, '');
      return { ok: true };
    }
  }
  return { ok: false, error: 'Không tìm thấy id ' + id };
}

// =====================================================================
// LỊCH CÔNG TÁC — sheet `lichcongtac` + 4 endpoint (v2.0.5)
// =====================================================================

/** Tạo sheet `lichcongtac` (idempotent). */
function initScheduleSheet() {
  const ss = getSpreadsheet();
  let sheet = ss.getSheetByName('lichcongtac');
  if (sheet) {
    Logger.log('Sheet lichcongtac đã có — skip');
    return { ok: true, created: false };
  }
  sheet = ss.insertSheet('lichcongtac');
  sheet.getRange(1, 1, 1, SCHEDULE_HEADER.length).setValues([SCHEDULE_HEADER]);
  sheet.setFrozenRows(1);
  sheet.setColumnWidth(1, 80);
  sheet.setColumnWidth(2, 120);
  sheet.setColumnWidth(3, 100);
  sheet.setColumnWidth(4, 140);
  sheet.setColumnWidth(5, 200);
  sheet.setColumnWidth(6, 250);
  // Data validation status
  try {
    const rule = SpreadsheetApp.newDataValidation()
      .requireValueInList(SCHEDULE_STATUSES, true).setAllowInvalid(false).build();
    sheet.getRange(2, 7, 1000, 1).setDataValidation(rule);
  } catch (e) { /* ignore */ }
  Logger.log('Đã tạo sheet lichcongtac.');
  return { ok: true, created: true };
}

/** Helper: đọc sheet thành array of objects. */
function _readScheduleRows() {
  const sheet = getSpreadsheet().getSheetByName('lichcongtac');
  if (!sheet) return { sheet: null, rows: [], header: null };
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return { sheet, rows: [], header: data[0] ? data[0].map(String) : SCHEDULE_HEADER };
  const header = data[0].map(String);
  const rows = [];
  for (let i = 1; i < data.length; i++) {
    const obj = { _rowIndex: i + 1 };
    header.forEach((h, j) => {
      let v = data[i][j];
      if (h === 'ngay' && v instanceof Date) v = Utilities.formatDate(v, TZ, 'yyyy-MM-dd');
      else if (h === 'created_at' && v instanceof Date) v = Utilities.formatDate(v, TZ, 'yyyy-MM-dd HH:mm:ss');
      obj[h] = v;
    });
    rows.push(obj);
  }
  return { sheet, rows, header };
}

/**
 * action=schedule_list — body { token, from?, to?, ktv_username?, status?, loai_ks? }
 * Bất kỳ role nào đăng nhập đều gọi được, nhưng user1 server-filter chỉ thấy của mình.
 */
function handleScheduleList(body) {
  const auth = verifyToken(body.token);
  if (auth.role === 'demo') return { ok: false, error: 'Tài khoản demo không xem lịch' };

  const { rows } = _readScheduleRows();

  // Filter
  const ktvFilter = body.ktv_username ? String(body.ktv_username).trim() : null;
  const restrictToSelf = !can(auth.role, 'schedule_write');
  const targetKtv = restrictToSelf ? auth.username : ktvFilter;

  const fromD = body.from ? String(body.from) : null;
  const toD = body.to ? String(body.to) : null;
  const status = body.status ? String(body.status).trim() : null;
  const loaiKs = body.loai_ks ? String(body.loai_ks).trim() : null;

  const filtered = rows.filter(r => {
    if (targetKtv && String(r.ktv_username || '').trim() !== targetKtv) return false;
    const ngay = String(r.ngay || '');
    if (fromD && ngay < fromD) return false;
    if (toD && ngay > toD) return false;
    if (status && String(r.status || '') !== status) return false;
    if (loaiKs && String(r.loai_ks || '') !== loaiKs) return false;
    return true;
  }).map(r => {
    const c = Object.assign({}, r);
    delete c._rowIndex;
    return c;
  });

  return { ok: true, items: filtered, scope: restrictToSelf ? 'self' : 'all' };
}

/**
 * action=schedule_create — body { token, items: [{ktv_username, ngay, loai_ks, khu_vuc, ghi_chu}] }
 * Permission: schedule_write.
 */
function handleScheduleCreate(body) {
  const auth = verifyToken(body.token);
  if (!can(auth.role, 'schedule_write')) return { ok: false, error: 'forbidden' };

  const items = Array.isArray(body.items) ? body.items : [];
  if (items.length === 0) return { ok: false, error: 'Thiếu danh sách items' };

  let sheet = getSpreadsheet().getSheetByName('lichcongtac');
  if (!sheet) { initScheduleSheet(); sheet = getSpreadsheet().getSheetByName('lichcongtac'); }

  const now = nowVnString();
  const created = [];
  for (const it of items) {
    const ktv = String(it.ktv_username || '').trim();
    const ngay = String(it.ngay || '').trim();
    const loai_ks = String(it.loai_ks || '').trim();
    if (!ktv) return { ok: false, error: 'Thiếu ktv_username' };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(ngay)) return { ok: false, error: 'ngay phải dạng YYYY-MM-DD' };
    if (loai_ks && !SHEET_MAP[loai_ks]) return { ok: false, error: 'loai_ks không hợp lệ: ' + loai_ks };

    const id = Utilities.getUuid().slice(0, 8);
    const row = [
      id, ktv, ngay, loai_ks, String(it.khu_vuc || ''),
      String(it.ghi_chu || ''), 'pending', auth.username, now
    ];
    sheet.appendRow(row);
    created.push(id);
  }

  appendAuditLog('schedule_create', auth.username, 'lichcongtac',
    String(created.length), 'ids=' + created.join(','));

  return { ok: true, created_ids: created, count: created.length };
}

/**
 * action=schedule_update — body { token, id, fields: {status?, ngay?, ...} }
 * Permission: schedule_write (admin/user) HOẶC chính user1 update status item của mình.
 */
function handleScheduleUpdate(body) {
  const auth = verifyToken(body.token);
  const id = String(body.id || '').trim();
  const fields = body.fields || {};
  if (!id) return { ok: false, error: 'Thiếu id' };

  const { sheet, rows, header } = _readScheduleRows();
  if (!sheet) return { ok: false, error: 'Sheet lichcongtac chưa khởi tạo' };

  const item = rows.find(r => String(r.id) === id);
  if (!item) return { ok: false, error: 'Không tìm thấy id ' + id };

  // Quyền: admin/user (schedule_write) → sửa mọi field. user1 → chỉ status của item mình.
  const fullWrite = can(auth.role, 'schedule_write');
  if (!fullWrite) {
    if (String(item.ktv_username) !== auth.username) {
      return { ok: false, error: 'Bạn chỉ có thể sửa lịch của chính mình' };
    }
    const keys = Object.keys(fields);
    if (keys.length !== 1 || keys[0] !== 'status') {
      return { ok: false, error: 'Chỉ được sửa field status' };
    }
  }

  const changes = [];
  const ALLOWED = ['ktv_username', 'ngay', 'loai_ks', 'khu_vuc', 'ghi_chu', 'status'];
  for (const k of Object.keys(fields)) {
    if (ALLOWED.indexOf(k) < 0) continue;
    if (k === 'status' && SCHEDULE_STATUSES.indexOf(String(fields[k])) < 0) {
      return { ok: false, error: 'status không hợp lệ: ' + fields[k] };
    }
    if (k === 'loai_ks' && fields[k] && !SHEET_MAP[fields[k]]) {
      return { ok: false, error: 'loai_ks không hợp lệ: ' + fields[k] };
    }
    if (k === 'ngay' && fields[k] && !/^\d{4}-\d{2}-\d{2}$/.test(String(fields[k]))) {
      return { ok: false, error: 'ngay phải dạng YYYY-MM-DD' };
    }
    const col = header.indexOf(k);
    if (col < 0) continue;
    sheet.getRange(item._rowIndex, col + 1).setValue(fields[k]);
    changes.push(k + '=' + fields[k]);
  }
  if (changes.length === 0) return { ok: true, message: 'Không có thay đổi' };

  appendAuditLog('schedule_update', auth.username, 'lichcongtac', id, changes.join(', '));
  return { ok: true, id: id, changes: changes };
}

/**
 * action=schedule_delete — body { token, id }
 * Permission: schedule_write.
 */
function handleScheduleDelete(body) {
  const auth = verifyToken(body.token);
  if (!can(auth.role, 'schedule_write')) return { ok: false, error: 'forbidden' };

  const id = String(body.id || '').trim();
  if (!id) return { ok: false, error: 'Thiếu id' };

  const { sheet, rows } = _readScheduleRows();
  if (!sheet) return { ok: false, error: 'Sheet lichcongtac chưa khởi tạo' };

  const item = rows.find(r => String(r.id) === id);
  if (!item) return { ok: false, error: 'Không tìm thấy id ' + id };

  sheet.deleteRow(item._rowIndex);
  appendAuditLog('schedule_delete', auth.username, 'lichcongtac', id, '');
  return { ok: true };
}

/**
 * Tạo sheet `notification_targets` (idempotent) — admin chạy 1 lần khi triển khai v1.2.3.
 * Sau khi tạo, admin tự thêm email vào sheet.
 */
function extendNotificationTargetsSheet() {
  const ss = getSpreadsheet();
  let sheet = ss.getSheetByName('notification_targets');
  if (sheet) {
    Logger.log('Sheet notification_targets đã tồn tại — skip');
    return { ok: true, created: false };
  }
  sheet = ss.insertSheet('notification_targets');
  sheet.getRange(1, 1, 1, NOTIFICATION_TARGETS_HEADER.length).setValues([NOTIFICATION_TARGETS_HEADER]);
  // Seed 1 email mẫu (admin tự sửa)
  sheet.getRange(2, 1, 1, 3).setValues([['admin@sapulico.local', true, '']]);
  sheet.setFrozenRows(1);
  // Checkbox cho cột enabled
  try {
    const cb = SpreadsheetApp.newDataValidation().requireCheckbox().build();
    sheet.getRange(2, 2, 50, 1).setDataValidation(cb);
  } catch (e) { /* ignore */ }
  sheet.setColumnWidth(1, 250);
  sheet.setColumnWidth(3, 250);
  Logger.log('Đã tạo sheet notification_targets. Sửa danh sách email + bật/tắt enabled trong sheet.');
  // Xoá cache
  CacheService.getScriptCache().remove('notify_targets');
  return { ok: true, created: true };
}

// =====================================================================
// IMPORT LEGACY DATA — chuyển data từ file xlsx cũ vào sheet target
// =====================================================================

/** Header row của sheet TCNoi trong file Excel gốc nằm ở row 2 (CLAUDE.md mục 7). */
const SOURCE_HEADER_ROW = { tc_noi: 2 };

/**
 * Chuyển data từ file Excel `khao sat tang cuong den.xlsx` sang sheet hiện tại.
 *
 * Cách dùng:
 * 1. Upload file xlsx lên Google Drive.
 * 2. Right-click → Mở bằng Google Sheets (Drive tự convert).
 * 3. Copy ID của file Google Sheets vừa tạo (URL: /d/<ID>/edit).
 * 4. Trong Apps Script editor: chạy `importLegacyData('<ID>')` qua execution log,
 *    HOẶC sửa hàm `runImportLegacy()` bên dưới rồi chạy nó.
 *
 * Hành vi:
 * - Với mỗi sheet trong SHEET_MAP, đọc data tương ứng từ source.
 * - Map cột theo TÊN HEADER (case-sensitive, NGUYÊN VĂN). Cột nào không có trong source → để rỗng.
 * - Server tự gán: STT (sequential), Submitted At = '(imported)', Username = 'imported',
 *   User Agent = 'xlsx-import', Deleted At/By = rỗng.
 * - Người khảo sát giữ nguyên từ source nếu có.
 * - **SKIP** sheet target đã có data (chỉ header) trừ khi `force=true`.
 *
 * @param {string} sourceId — ID Google Sheets nguồn (đã convert từ xlsx)
 * @param {boolean} [force=false] — nếu true: xoá data target trước khi import
 */
function importLegacyData(sourceId, force) {
  if (!sourceId) throw new Error('Truyền sourceId: importLegacyData("abc123...")');
  const source = SpreadsheetApp.openById(sourceId);
  const target = getSpreadsheet();
  const result = { ok: true, by_sheet: {} };

  Object.keys(SHEET_MAP).forEach(type => {
    const sheetName = SHEET_MAP[type];
    const sourceSheet = source.getSheetByName(sheetName);
    const targetSheet = target.getSheetByName(sheetName);
    const rec = { source_rows: 0, imported: 0, skipped: 0 };

    if (!sourceSheet) {
      rec.error = 'source sheet không tồn tại';
      result.by_sheet[sheetName] = rec;
      return;
    }
    if (!targetSheet) {
      rec.error = 'target sheet không tồn tại (chạy initSheets trước)';
      result.by_sheet[sheetName] = rec;
      return;
    }

    // Force clear data target nếu yêu cầu
    if (force === true && targetSheet.getLastRow() > 1) {
      const numRows = targetSheet.getLastRow() - 1;
      const numCols = targetSheet.getLastColumn();
      targetSheet.getRange(2, 1, numRows, numCols).clearContent();
      rec.cleared_old = numRows;
    }

    // Skip nếu target đã có data (idempotent)
    if (!force && targetSheet.getLastRow() > 1) {
      rec.error = 'target đã có data — dùng force=true để ghi đè';
      result.by_sheet[sheetName] = rec;
      return;
    }

    // Đọc source
    const headerRowSrc = SOURCE_HEADER_ROW[type] || 1;
    const srcLastRow = sourceSheet.getLastRow();
    const srcLastCol = sourceSheet.getLastColumn();
    if (srcLastRow <= headerRowSrc || srcLastCol < 1) {
      result.by_sheet[sheetName] = rec;
      return;
    }
    const srcHeader = sourceSheet.getRange(headerRowSrc, 1, 1, srcLastCol).getValues()[0]
      .map(v => String(v).trim());
    const srcRows = sourceSheet.getRange(headerRowSrc + 1, 1, srcLastRow - headerRowSrc, srcLastCol).getValues();
    rec.source_rows = srcRows.length;

    // Header target (đã có 6 cột bonus)
    const tgtHeader = targetSheet.getRange(1, 1, 1, targetSheet.getLastColumn()).getValues()[0]
      .map(String);

    // Map srcLabel → srcColIndex
    const srcIdx = {};
    srcHeader.forEach((h, i) => { if (h) srcIdx[h] = i; });

    // Build rows
    const rowsToWrite = [];
    let sttCounter = 1;  // STT bắt đầu từ 1
    for (const sr of srcRows) {
      // Skip row trống hoàn toàn
      const allEmpty = sr.every(c => c === '' || c === null);
      if (allEmpty) { rec.skipped++; continue; }
      // Skip nếu row chỉ có whitespace ở STT cell + tất cả khác rỗng
      const firstNonEmpty = sr.find(c => c !== '' && c !== null && String(c).trim());
      if (!firstNonEmpty) { rec.skipped++; continue; }

      const newRow = tgtHeader.map(label => {
        // Server-managed mặc định
        if (label === 'STT') return sttCounter;
        if (label === 'Submitted At') return '(imported)';
        if (label === 'User Agent') return 'xlsx-import';
        if (label === 'Username') return 'imported';
        if (label === 'Deleted At' || label === 'Deleted By') return '';

        // Map từ source theo NGUYÊN VĂN label
        if (srcIdx[label] !== undefined) {
          let v = sr[srcIdx[label]];
          // Convert Date → string yyyy-MM-dd HH:mm:ss cho consistency
          if (v instanceof Date) {
            v = Utilities.formatDate(v, TZ, 'yyyy-MM-dd HH:mm:ss');
          }
          return v;
        }
        return '';
      });
      rowsToWrite.push(newRow);
      sttCounter++;
    }

    if (rowsToWrite.length > 0) {
      targetSheet.getRange(2, 1, rowsToWrite.length, tgtHeader.length).setValues(rowsToWrite);
      rec.imported = rowsToWrite.length;
    }
    result.by_sheet[sheetName] = rec;
    Logger.log(sheetName + ': nhập ' + rec.imported + '/' + rec.source_rows +
               ' (skip rỗng: ' + rec.skipped + ')');
  });

  appendAuditLog('import_legacy', 'system', '*', '*',
    'total_imported=' + Object.values(result.by_sheet).reduce((s, r) => s + (r.imported || 0), 0));
  Logger.log('=== TỔNG KẾT ===\n' + JSON.stringify(result, null, 2));
  return result;
}

/**
 * Helper — admin sửa SOURCE_ID rồi chạy hàm này (tránh phải truyền tham số qua console).
 * Sau khi sửa, dropdown chọn `runImportLegacy` → ▶ Run.
 */
function runImportLegacy() {
  // ⚠️ SỬA ID DƯỚI ĐÂY trước khi chạy:
  const SOURCE_ID = 'PASTE_GOOGLE_SHEETS_ID_CỦA_FILE_XLSX_VÀO_ĐÂY';
  const FORCE = false;  // true = xoá data target trước (dùng khi muốn import lại)

  if (SOURCE_ID === 'PASTE_GOOGLE_SHEETS_ID_CỦA_FILE_XLSX_VÀO_ĐÂY') {
    throw new Error('Sửa SOURCE_ID trong hàm runImportLegacy() trước khi chạy.');
  }
  return importLegacyData(SOURCE_ID, FORCE);
}

// =====================================================================
// BACKUP — copy Google Sheets sang Drive folder hàng tuần (v2.0.4)
// =====================================================================

const BACKUP_FOLDER_NAME = 'khaosat-backup';
const BACKUP_KEEP_WEEKS = 12;

/**
 * Cài đặt time-driven trigger: chạy weeklyBackup mỗi thứ Hai 00:00.
 * Admin chạy 1 lần khi triển khai v2.0.4. Idempotent (xoá trigger cũ trước).
 */
function setupBackupTrigger() {
  let removed = 0;
  const triggers = ScriptApp.getProjectTriggers();
  for (const t of triggers) {
    if (t.getHandlerFunction() === 'weeklyBackup') {
      ScriptApp.deleteTrigger(t);
      removed++;
    }
  }
  ScriptApp.newTrigger('weeklyBackup')
    .timeBased()
    .everyWeeks(1)
    .onWeekDay(ScriptApp.WeekDay.MONDAY)
    .atHour(0)
    .create();
  Logger.log('Đã cài trigger weeklyBackup chạy mỗi thứ Hai 00:00. Removed ' + removed + ' trigger cũ.');
  return { ok: true, removed_old: removed, message: 'Trigger sẽ chạy lần đầu vào thứ Hai gần nhất' };
}

/**
 * Handler được trigger gọi mỗi tuần — tạo bản copy Google Sheets vào folder khaosat-backup.
 * Cũng xoá file backup cũ hơn BACKUP_KEEP_WEEKS tuần.
 */
function weeklyBackup() {
  const ssId = getProp('SPREADSHEET_ID');
  if (!ssId) {
    Logger.log('Backup fail: chưa set SPREADSHEET_ID');
    return { ok: false, error: 'missing SPREADSHEET_ID' };
  }

  // Lấy hoặc tạo folder backup
  let folder;
  const folders = DriveApp.getFoldersByName(BACKUP_FOLDER_NAME);
  if (folders.hasNext()) {
    folder = folders.next();
  } else {
    folder = DriveApp.createFolder(BACKUP_FOLDER_NAME);
    Logger.log('Đã tạo folder mới: ' + BACKUP_FOLDER_NAME);
  }

  // Copy spreadsheet
  const sourceFile = DriveApp.getFileById(ssId);
  const today = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd');
  const backupName = 'khaosat-' + today;
  const copy = sourceFile.makeCopy(backupName, folder);

  // Dọn dẹp file cũ hơn BACKUP_KEEP_WEEKS tuần
  const cutoff = Date.now() - BACKUP_KEEP_WEEKS * 7 * 86400000;
  const filesInFolder = folder.getFiles();
  const deletedNames = [];
  while (filesInFolder.hasNext()) {
    const f = filesInFolder.next();
    if (f.getId() === copy.getId()) continue;  // skip just-created
    if (f.getDateCreated().getTime() < cutoff) {
      const fname = f.getName();
      f.setTrashed(true);
      deletedNames.push(fname);
    }
  }

  const summary = 'backup_id=' + copy.getId() + ' deleted_old=' + deletedNames.length;
  appendAuditLog('backup', 'system', 'spreadsheet', backupName, summary);
  Logger.log('✅ Backup OK: ' + backupName + ' (id=' + copy.getId() + '). ' +
             'Deleted ' + deletedNames.length + ' file cũ: ' + deletedNames.join(', '));
  return { ok: true, backup_id: copy.getId(), file_name: backupName, folder_id: folder.getId(), deleted_old: deletedNames.length };
}

/**
 * Chạy backup ngay lập tức (admin test thủ công thay vì đợi trigger).
 */
function runBackupNow() {
  return weeklyBackup();
}

/**
 * Liệt kê các backup hiện có trong folder.
 */
function listBackups() {
  const folders = DriveApp.getFoldersByName(BACKUP_FOLDER_NAME);
  if (!folders.hasNext()) {
    Logger.log('Folder ' + BACKUP_FOLDER_NAME + ' chưa tồn tại — chạy runBackupNow() trước.');
    return { ok: true, backups: [] };
  }
  const folder = folders.next();
  const files = folder.getFiles();
  const out = [];
  while (files.hasNext()) {
    const f = files.next();
    out.push({
      name: f.getName(),
      id: f.getId(),
      created: Utilities.formatDate(f.getDateCreated(), TZ, 'yyyy-MM-dd HH:mm'),
      size_kb: Math.round(f.getSize() / 1024)
    });
  }
  out.sort((a, b) => b.created.localeCompare(a.created));
  Logger.log(JSON.stringify(out, null, 2));
  return { ok: true, folder_url: folder.getUrl(), backups: out };
}

/**
 * Xoá toàn bộ backup trigger (admin chạy nếu muốn dừng backup tự động).
 */
function disableBackupTrigger() {
  let removed = 0;
  const triggers = ScriptApp.getProjectTriggers();
  for (const t of triggers) {
    if (t.getHandlerFunction() === 'weeklyBackup') {
      ScriptApp.deleteTrigger(t);
      removed++;
    }
  }
  Logger.log('Đã xoá ' + removed + ' trigger backup.');
  return { ok: true, removed: removed };
}

/**
 * Quét tất cả sheet khảo sát, so sánh header thực tế với HEADERS.
 * Báo lỗi nếu lệch.
 */
function validateSheets() {
  const ss = getSpreadsheet();
  const issues = [];
  Object.keys(SHEET_MAP).forEach(type => {
    const sheetName = SHEET_MAP[type];
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      issues.push('MISSING sheet: ' + sheetName);
      return;
    }
    const lastCol = sheet.getLastColumn();
    if (lastCol < 1) {
      issues.push(sheetName + ': sheet trống');
      return;
    }
    const actual = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(String);
    const expected = HEADERS[type].concat(BONUS_COLS);
    for (let i = 0; i < expected.length; i++) {
      if (actual[i] !== expected[i]) {
        issues.push(sheetName + ' cột ' + (i + 1) + ': expected "' + expected[i] + '" got "' + (actual[i] || '(rỗng)') + '"');
      }
    }
  });
  const result = { ok: issues.length === 0, issues: issues };
  Logger.log(JSON.stringify(result, null, 2));
  return result;
}

// =====================================================================
// ROUTER — doPost dispatch theo action
// =====================================================================

function doPost(e) {
  let body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return jsonResponse({ ok: false, error: 'invalid JSON body' });
  }
  const action = body.action;
  console.log('doPost action=' + action);
  try {
    switch (action) {
      case 'login':   return jsonResponse(handleLogin(body));
      case 'submit':  return jsonResponse(handleSubmit(body));
      case 'list':    return jsonResponse(handleList(body));
      case 'delete':  return jsonResponse(handleDelete(body));
      case 'restore': return jsonResponse(handleRestore(body));
      case 'kpi':     return jsonResponse(handleKpi(body));
      case 'report':  return jsonResponse(handleReport(body));
      case 'users':   return jsonResponse(handleUsers(body));
      case 'reset_password': return jsonResponse(handleResetPassword(body));
      case 'user_create':  return jsonResponse(handleUserCreate(body));
      case 'user_update':  return jsonResponse(handleUserUpdate(body));
      case 'docs_list':    return jsonResponse(handleDocsList(body));
      case 'docs_create':  return jsonResponse(handleDocsCreate(body));
      case 'docs_delete':  return jsonResponse(handleDocsDelete(body));
      case 'schedule_list':   return jsonResponse(handleScheduleList(body));
      case 'schedule_create': return jsonResponse(handleScheduleCreate(body));
      case 'schedule_update': return jsonResponse(handleScheduleUpdate(body));
      case 'schedule_delete': return jsonResponse(handleScheduleDelete(body));
      case 'update':        return jsonResponse(handleUpdate(body));
      case 'bulk_import':   return jsonResponse(handleBulkImport(body));
      case 'export_raw':    return jsonResponse(handleExportRaw(body));
      case 'upload_photo':  return jsonResponse(handleUploadPhoto(body));
      case 'photo_base64':  return jsonResponse(handlePhotoBase64(body));
      case 'change_password': return jsonResponse(handleChangePassword(body));
      default:              return jsonResponse({ ok: false, error: 'unknown action: ' + action });
    }
  } catch (err) {
    console.error(err);
    return jsonResponse({ ok: false, error: err.message || String(err), stack: err.stack });
  }
}

// Cho phép GET cho health check đơn giản
function doGet(e) {
  return jsonResponse({ ok: true, service: 'khaosat', version: '1.0' });
}

// =====================================================================
// HANDLERS
// =====================================================================

function handleLogin(body) {
  const username = String(body.username || '').trim();
  const password = String(body.password || '');
  if (!username || !password) {
    return { ok: false, error: 'Thiếu username hoặc password' };
  }
  const cache = CacheService.getScriptCache();
  const cacheKey = 'login_fail_' + username;
  const failCount = parseInt(cache.get(cacheKey) || '0', 10);
  if (failCount >= 5) {
    return { ok: false, error: 'Tài khoản tạm khoá do nhập sai 5 lần. Vui lòng đợi 5 phút.' };
  }

  const user = findUser(username);
  const fail = (msg) => {
    cache.put(cacheKey, String(failCount + 1), 300);
    return { ok: false, error: msg };
  };
  if (!user) return fail('Sai tên đăng nhập hoặc mật khẩu');
  if (user.active === false) return { ok: false, error: 'Tài khoản đã bị khoá' };

  const check = verifyPassword(username, password, user.password_hash);
  if (!check.ok) return fail('Sai tên đăng nhập hoặc mật khẩu');

  // Thành công
  cache.remove(cacheKey);
  const token = generateToken(username);
  return {
    ok: true,
    token: token,
    username: user.username,
    full_name: user.full_name,
    role: user.role,
    must_change: check.must_change === true,
    expires_at: Date.now() + TOKEN_TTL_MS
  };
}

/**
 * action=change_password — user tự đổi mật khẩu của CHÍNH MÌNH.
 * Body: { token, current_password, new_password }
 * Mọi role đăng nhập đều gọi được (không cần quyền users_manage).
 */
function handleChangePassword(body) {
  const auth = verifyToken(body.token);
  const current = String(body.current_password || '');
  const next = String(body.new_password || '');

  const ruleErr = validatePasswordRule(auth.username, next);
  if (ruleErr) return { ok: false, error: ruleErr };
  if (current === next) return { ok: false, error: 'Mật khẩu mới phải khác mật khẩu hiện tại' };

  const user = findUser(auth.username);
  if (!user) return { ok: false, error: 'Không tìm thấy tài khoản' };

  const check = verifyPassword(auth.username, current, user.password_hash);
  if (!check.ok) return { ok: false, error: 'Mật khẩu hiện tại không đúng' };

  setPassword(auth.username, next, false);
  appendAuditLog('change_password', auth.username, 'taikhoan', auth.username, 'user tự đổi');
  return { ok: true, message: 'Đã đổi mật khẩu' };
}

function handleSubmit(body) {
  const auth = verifyToken(body.token);
  if (!can(auth.role, 'submit')) {
    return { ok: false, error: 'Role ' + auth.role + ' không có quyền submit' };
  }
  const type = body.type;
  const sheetName = SHEET_MAP[type];
  if (!sheetName) return { ok: false, error: 'Loại không hợp lệ: ' + type };
  const sheet = getSpreadsheet().getSheetByName(sheetName);
  if (!sheet) return { ok: false, error: 'Sheet không tồn tại: ' + sheetName };

  const header = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
  const dataIn = body.data || {};
  const photos = Array.isArray(body.photos) ? body.photos : [];
  const ua = String(body.ua || 'unknown');
  const submittedAt = isoNow();
  const ngayKsString = nowVnString();
  const stt = sheet.getLastRow();  // = số row hiện tại; row mới sẽ là lastRow+1, STT = lastRow (vì header row 1)

  const row = header.map(label => {
    // Server-managed fields: bỏ qua giá trị từ client
    if (label === 'STT') return stt;
    if (label === 'ngày khảo sát' || label === 'Ngày khảo sát') return ngayKsString;
    if (label === 'Người khảo sát') return auth.full_name;
    if (label === 'Ảnh (URLs)') return photos.join('|');
    if (label === 'Submitted At') return submittedAt;
    if (label === 'User Agent') return ua;
    if (label === 'Username') return auth.username;
    if (label === 'Deleted At') return '';
    if (label === 'Deleted By') return '';
    return safe(dataIn[label]);
  });

  sheet.appendRow(row);
  const newRowNum = sheet.getLastRow();

  // Notification email cho admin/user có quyền notify_admin (best-effort, không chặn submit)
  try {
    // Build data object có cả server-assigned fields cho email
    const fullData = Object.assign({}, dataIn, {
      'STT': stt,
      'Người khảo sát': auth.full_name,
      'Ảnh (URLs)': photos.join('|'),
      'Submitted At': submittedAt,
      'Username': auth.username
    });
    notifyAdmins(type, sheetName, fullData, stt, auth, newRowNum, sheet.getSheetId());
  } catch (e) {
    Logger.log('notify fail (silent): ' + e);
  }

  return { ok: true, stt: stt, sheet: sheetName, timestamp: submittedAt };
}

function handleList(body) {
  const auth = verifyToken(body.token);
  const type = body.type;
  const usernameFilter = body.username;
  const sttFilter = body.stt !== undefined && body.stt !== null && body.stt !== '' ? String(body.stt) : null;
  const from = body.from ? new Date(body.from) : null;
  const to = body.to ? new Date(body.to) : null;
  const includeDeleted = !!body.includeDeleted;
  const onlyDeleted = body.status === 'deleted';
  const onlyActive = body.status === 'active' || (!includeDeleted && !onlyDeleted);

  // Nếu role không có quyền manage/report → chỉ xem của mình
  const restrictToSelf = !can(auth.role, 'manage') && !can(auth.role, 'report');
  const usernameTarget = restrictToSelf ? auth.username : usernameFilter;

  const types = type ? [type] : Object.keys(SHEET_MAP);
  const results = [];
  types.forEach(t => {
    const rows = readSheetRows(t, true);
    rows.forEach(row => {
      if (sttFilter && String(row['STT']) !== sttFilter) return;
      if (usernameTarget && String(row['Username']) !== String(usernameTarget)) return;
      const submittedAt = row['Submitted At'] ? new Date(row['Submitted At']) : null;
      if (from && (!submittedAt || submittedAt < from)) return;
      if (to && (!submittedAt || submittedAt > to)) return;
      const isDeleted = !!row['Deleted At'];
      if (onlyDeleted && !isDeleted) return;
      if (onlyActive && isDeleted) return;
      results.push(Object.assign({ _type: t, _sheet: SHEET_MAP[t] }, row));
    });
  });
  return { ok: true, rows: results, total: results.length };
}

function handleDelete(body) {
  const auth = verifyToken(body.token);
  if (!can(auth.role, 'delete')) return { ok: false, error: 'forbidden' };
  const type = body.type;
  const stt = body.stt;
  const sheetName = SHEET_MAP[type];
  if (!sheetName) return { ok: false, error: 'Loại không hợp lệ' };
  const sheet = getSpreadsheet().getSheetByName(sheetName);
  if (!sheet) return { ok: false, error: 'Sheet không tồn tại' };

  const found = findRowByStt(sheet, stt);
  if (!found) return { ok: false, error: 'Không tìm thấy STT ' + stt };
  const { rowIndex, header, values } = found;

  // Xoá ảnh (Drive hoặc Cloudinary tuỳ URL)
  const photoUrls = String(values[header.indexOf('Ảnh (URLs)')] || '').split('|').filter(u => u);
  const photoResults = [];
  photoUrls.forEach(url => {
    try {
      const ok = url.includes('drive.google.com') ? deleteDrivePhoto(url) : destroyCloudinaryImage(url);
      photoResults.push({ url: url, ok: ok });
    } catch (e) {
      photoResults.push({ url: url, ok: false, error: String(e) });
    }
  });

  // Set Deleted At, Deleted By
  const idxDeletedAt = header.indexOf('Deleted At');
  const idxDeletedBy = header.indexOf('Deleted By');
  if (idxDeletedAt >= 0) sheet.getRange(rowIndex, idxDeletedAt + 1).setValue(nowVnString());
  if (idxDeletedBy >= 0) sheet.getRange(rowIndex, idxDeletedBy + 1).setValue(auth.username);

  appendAuditLog('delete', auth.username, sheetName, stt,
    'photos=' + photoUrls.length + ' destroyed=' + photoResults.filter(p => p.ok).length);

  return { ok: true, photos: photoResults };
}

/**
 * action=update — sửa bản ghi đã submit.
 * Body: { token, type, stt, data, photos? }
 * Permission: edit.
 * KHÔNG ghi đè: STT, Submitted At, Username, Người khảo sát (giữ Người khảo sát gốc), Deleted At, Deleted By.
 * Ghi đè được: các field business + Ảnh (URLs) nếu photos được truyền (mảng URLs).
 */
function handleUpdate(body) {
  const auth = verifyToken(body.token);
  if (!can(auth.role, 'edit')) return { ok: false, error: 'forbidden' };

  const type = body.type;
  const stt = body.stt;
  const sheetName = SHEET_MAP[type];
  if (!sheetName) return { ok: false, error: 'Loại không hợp lệ' };
  if (!stt && stt !== 0) return { ok: false, error: 'Thiếu STT' };
  const sheet = getSpreadsheet().getSheetByName(sheetName);
  if (!sheet) return { ok: false, error: 'Sheet không tồn tại' };

  const found = findRowByStt(sheet, stt);
  if (!found) return { ok: false, error: 'Không tìm thấy STT ' + stt };
  const { rowIndex, header } = found;

  const dataIn = body.data || {};
  const photos = Array.isArray(body.photos) ? body.photos : null;  // null = không update photos

  // Protected fields (server-managed) — KHÔNG ghi đè dù client gửi
  const PROTECTED = ['STT', 'Submitted At', 'Username', 'Người khảo sát',
                     'ngày khảo sát', 'Ngày khảo sát', 'Deleted At', 'Deleted By'];

  const changes = [];
  header.forEach((label, j) => {
    if (PROTECTED.indexOf(label) >= 0) return;

    let newVal;
    if (label === 'Ảnh (URLs)') {
      if (photos === null) return;  // client không gửi photos → giữ nguyên
      newVal = photos.join('|');
    } else if (label === 'User Agent') {
      // Append edit marker, không ghi đè hoàn toàn
      const existing = sheet.getRange(rowIndex, j + 1).getValue();
      newVal = String(existing || '') + ' [edit:' + auth.username + '@' + nowVnString() + ']';
    } else if (dataIn[label] !== undefined) {
      newVal = dataIn[label];
    } else {
      return;
    }

    const oldVal = sheet.getRange(rowIndex, j + 1).getValue();
    if (String(oldVal) !== String(newVal)) {
      sheet.getRange(rowIndex, j + 1).setValue(newVal);
      changes.push(label);
    }
  });

  appendAuditLog('update', auth.username, sheetName, stt,
    changes.length > 0 ? 'fields: ' + changes.join(', ') : 'no change');

  return { ok: true, stt: stt, changes: changes };
}

function handleRestore(body) {
  const auth = verifyToken(body.token);
  if (!can(auth.role, 'delete')) return { ok: false, error: 'forbidden' };
  const type = body.type;
  const stt = body.stt;
  const sheetName = SHEET_MAP[type];
  if (!sheetName) return { ok: false, error: 'Loại không hợp lệ' };
  const sheet = getSpreadsheet().getSheetByName(sheetName);
  if (!sheet) return { ok: false, error: 'Sheet không tồn tại' };

  const found = findRowByStt(sheet, stt);
  if (!found) return { ok: false, error: 'Không tìm thấy STT ' + stt };
  const { rowIndex, header } = found;
  const idxDeletedAt = header.indexOf('Deleted At');
  const idxDeletedBy = header.indexOf('Deleted By');
  if (idxDeletedAt >= 0) sheet.getRange(rowIndex, idxDeletedAt + 1).setValue('');
  if (idxDeletedBy >= 0) sheet.getRange(rowIndex, idxDeletedBy + 1).setValue('');

  appendAuditLog('restore', auth.username, sheetName, stt, 'photos NOT restored');
  return { ok: true, warning: 'Ảnh đính kèm đã bị xoá vĩnh viễn, không khôi phục được.' };
}

function handleKpi(body) {
  const auth = verifyToken(body.token);
  // KPI cá nhân: nếu không có quyền 'kpi' → chỉ trả KPI của chính user. Demo: không có gì để xem.
  const fullAccess = can(auth.role, 'kpi');
  if (auth.role === 'demo') return { ok: false, error: 'Tài khoản demo không có KPI' };
  const month = String(body.month || '').trim();  // YYYY-MM
  if (!/^\d{4}-\d{2}$/.test(month)) return { ok: false, error: 'month phải dạng YYYY-MM' };

  const targets = getKpiTargets();
  const ss = getSpreadsheet();
  const taikhoan = ss.getSheetByName('taikhoan');
  const tkData = taikhoan.getDataRange().getValues();
  const tkHeader = tkData[0].map(String);
  const idxU = tkHeader.indexOf('username');
  const idxN = tkHeader.indexOf('full_name');
  const idxR = tkHeader.indexOf('role');
  const idxA = tkHeader.indexOf('active');

  // Tập hợp Người khảo sát (admin/user/user1 — không tính demo)
  const ktvs = [];
  for (let i = 1; i < tkData.length; i++) {
    const role = tkData[i][idxR];
    const active = idxA >= 0 ? tkData[i][idxA] === true : true;
    if (!active || role === 'demo') continue;
    ktvs.push({
      username: String(tkData[i][idxU]),
      full_name: String(tkData[i][idxN]),
      role: String(role)
    });
  }

  // Đọc tất cả 15 sheet, group rows theo username
  const userStats = {};
  ktvs.forEach(k => {
    userStats[k.username] = {
      username: k.username, full_name: k.full_name, role: k.role,
      total: 0, has_photo: 0, has_gps: 0, gps_eligible: 0,
      types: new Set(), days: new Set(),
      completeness_sum: 0, completeness_count: 0
    };
  });

  Object.keys(SHEET_MAP).forEach(type => {
    const rows = readSheetRows(type, false);  // bỏ deleted
    const optionalFields = getOptionalFields(type);
    rows.forEach(row => {
      const username = String(row['Username'] || '');
      const stat = userStats[username];
      if (!stat) return;
      const submittedAt = row['Submitted At'] ? new Date(row['Submitted At']) : null;
      if (!submittedAt || !inMonth(submittedAt, month)) return;
      stat.total++;
      if (String(row['Ảnh (URLs)'] || '').trim()) stat.has_photo++;
      // GPS: tính theo mức lưu trữ (xem CLAUDE.md mục 5 bảng GPS)
      if (GPS_LATLONG_TYPES.indexOf(type) >= 0) {
        // Nhóm A: lưu cả lat/lng — kiểm tra 2 cột
        stat.gps_eligible++;
        if (row['kinh độ'] && row['vĩ độ']) stat.has_gps++;
      } else if (GPS_LINK_TYPES.indexOf(type) >= 0) {
        // Nhóm B: chỉ lưu link — kiểm tra cột 'link' hoặc 'Link Google Map'
        stat.gps_eligible++;
        const linkVal = String(row['link'] || row['Link Google Map'] || '').trim();
        if (linkVal && linkVal !== '#VALUE!') stat.has_gps++;
      }
      // NO_GPS_TYPES (hkn): bỏ qua — không tính vào mẫu số
      stat.types.add(type);
      const dayKey = Utilities.formatDate(submittedAt, TZ, 'yyyy-MM-dd');
      stat.days.add(dayKey);
      // Completeness: tỉ lệ optional fields đã điền
      if (optionalFields.length > 0) {
        let filled = 0;
        optionalFields.forEach(f => {
          if (row[f] !== undefined && row[f] !== '' && row[f] !== null) filled++;
        });
        stat.completeness_sum += filled / optionalFields.length;
        stat.completeness_count++;
      }
    });
  });

  // Tính 5 chỉ tiêu cho mỗi người khảo sát
  const results = Object.keys(userStats).map(u => {
    const s = userStats[u];
    const frequency = Math.min(s.total / targets.target_submissions_per_month, 1) * 100;
    const quality = (s.total === 0) ? 0 :
      (((s.has_photo / s.total) * 100) +
       ((s.gps_eligible === 0 ? 0 : (s.has_gps / s.gps_eligible) * 100))) / 2;
    const diversity = Math.min(s.types.size / targets.target_distinct_types, 1) * 100;
    const completeness = s.completeness_count > 0
      ? (s.completeness_sum / s.completeness_count) * 100 : 0;
    const stability = Math.min(s.days.size / targets.target_active_days, 1) * 100;
    const total =
      frequency * targets.weight_frequency +
      quality * targets.weight_quality +
      diversity * targets.weight_diversity +
      completeness * targets.weight_completeness +
      stability * targets.weight_stability;
    let grade;
    if (total >= 85) grade = 'A';
    else if (total >= 70) grade = 'B';
    else if (total >= 55) grade = 'C';
    else grade = 'D';
    return {
      username: s.username, full_name: s.full_name, role: s.role,
      count: s.total,
      frequency: round1(frequency), quality: round1(quality), diversity: round1(diversity),
      completeness: round1(completeness), stability: round1(stability),
      total: round1(total), grade: grade
    };
  });

  results.sort((a, b) => b.total - a.total);
  // Nếu không có quyền 'kpi' → chỉ trả KPI của chính user (filter ở server, defense in depth)
  const filtered = fullAccess ? results : results.filter(r => r.username === auth.username);
  return { ok: true, month: month, results: filtered, targets: targets, scope: fullAccess ? 'all' : 'self' };
}

/**
 * action=reset_password — admin/role có quyền users_manage đổi mật khẩu user.
 * Body: { token, username, new_password }
 * Validate: new_password ≥ 8 ký tự, không trùng username.
 */
function handleResetPassword(body) {
  const auth = verifyToken(body.token);
  if (!can(auth.role, 'users_manage')) return { ok: false, error: 'forbidden' };

  const target = String(body.username || '').trim();
  const newPwd = String(body.new_password || '');

  if (!target) return { ok: false, error: 'Thiếu username cần reset' };
  const ruleErr = validatePasswordRule(target, newPwd);
  if (ruleErr) return { ok: false, error: ruleErr };

  // Xác nhận user tồn tại trong danh bạ trước khi ghi mật khẩu
  if (!findUser(target)) return { ok: false, error: 'Không tìm thấy user: ' + target };

  // Ghi vào Script Properties, KHÔNG ghi vào sheet. must_change=true để user tự
  // đặt mật khẩu riêng — admin không cần biết mật khẩu thật của họ.
  setPassword(target, newPwd, true);

  appendAuditLog('reset_password', auth.username, 'taikhoan', target, 'pwd reset by ' + auth.username);

  return { ok: true, message: 'Đã đặt mật khẩu tạm cho ' + target + '. Người này sẽ phải đổi ở lần đăng nhập kế tiếp.' };
}

const VALID_ROLES = ['admin', 'user', 'user1', 'demo'];

/**
 * action=user_create — tạo user mới.
 * Body: { token, username, password, full_name, role, active }
 * Permission: users_manage.
 */
function handleUserCreate(body) {
  const auth = verifyToken(body.token);
  if (!can(auth.role, 'users_manage')) return { ok: false, error: 'forbidden' };

  const username = String(body.username || '').trim();
  const password = String(body.password || '');
  const full_name = String(body.full_name || '').trim();
  const role = String(body.role || '').trim();
  const active = body.active !== false;

  // Validate
  if (!username) return { ok: false, error: 'Thiếu username' };
  if (!/^[a-zA-Z0-9_.-]+$/.test(username)) return { ok: false, error: 'Username chỉ chứa chữ/số/dấu chấm/gạch dưới/gạch ngang' };
  const pwdErr = validatePasswordRule(username, password);
  if (pwdErr) return { ok: false, error: pwdErr };
  if (!full_name) return { ok: false, error: 'Thiếu họ tên' };
  if (VALID_ROLES.indexOf(role) < 0) return { ok: false, error: 'Role không hợp lệ: ' + role };

  const sheet = getSpreadsheet().getSheetByName('taikhoan');
  if (!sheet) return { ok: false, error: 'Sheet taikhoan không tồn tại' };
  const data = sheet.getDataRange().getValues();
  const header = data[0].map(String);
  const idxU = header.indexOf('username');
  if (idxU < 0) return { ok: false, error: 'Sheet thiếu cột username' };

  // Check unique (case-insensitive)
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idxU]).trim().toLowerCase() === username.toLowerCase()) {
      return { ok: false, error: 'Username "' + username + '" đã tồn tại' };
    }
  }

  // Build row theo header thực tế — sheet chỉ giữ danh bạ, KHÔNG có mật khẩu
  const idxName = header.indexOf('full_name');
  const idxRole = header.indexOf('role');
  const idxA = header.indexOf('active');
  const idxC = header.indexOf('created_at');

  const newRow = new Array(header.length).fill('');
  newRow[idxU] = username;
  if (idxName >= 0) newRow[idxName] = full_name;
  if (idxRole >= 0) newRow[idxRole] = role;
  if (idxA >= 0) newRow[idxA] = active;
  if (idxC >= 0) newRow[idxC] = nowVnString();
  sheet.appendRow(newRow);

  // Mật khẩu vào Script Properties. must_change=true → user tự đặt lại ở lần đầu.
  setPassword(username, password, true);

  appendAuditLog('user_create', auth.username, 'taikhoan', username,
    'role=' + role + ' active=' + active);

  return { ok: true, username: username,
           message: 'Đã tạo user ' + username + '. Người này sẽ phải đổi mật khẩu ở lần đăng nhập đầu.' };
}

/**
 * action=user_update — sửa full_name/role/active. KHÔNG đổi username.
 * Body: { token, username, full_name?, role?, active? }
 * Permission: users_manage.
 */
function handleUserUpdate(body) {
  const auth = verifyToken(body.token);
  if (!can(auth.role, 'users_manage')) return { ok: false, error: 'forbidden' };

  const username = String(body.username || '').trim();
  if (!username) return { ok: false, error: 'Thiếu username' };

  // Cấm tự vô hiệu hoá chính mình (tránh lockout)
  if (username === auth.username && body.active === false) {
    return { ok: false, error: 'Không thể tự vô hiệu hoá tài khoản đang đăng nhập' };
  }

  const sheet = getSpreadsheet().getSheetByName('taikhoan');
  if (!sheet) return { ok: false, error: 'Sheet taikhoan không tồn tại' };
  const data = sheet.getDataRange().getValues();
  const header = data[0].map(String);
  const idxU = header.indexOf('username');

  let rowIdx = -1;
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idxU]).trim() === username) { rowIdx = i + 1; break; }
  }
  if (rowIdx < 0) return { ok: false, error: 'Không tìm thấy user: ' + username };

  const changes = [];

  if (body.full_name !== undefined) {
    const v = String(body.full_name).trim();
    if (!v) return { ok: false, error: 'full_name không được rỗng' };
    const idx = header.indexOf('full_name');
    if (idx >= 0) {
      sheet.getRange(rowIdx, idx + 1).setValue(v);
      changes.push('full_name');
    }
  }
  if (body.role !== undefined) {
    const v = String(body.role).trim();
    if (VALID_ROLES.indexOf(v) < 0) return { ok: false, error: 'Role không hợp lệ: ' + v };
    const idx = header.indexOf('role');
    if (idx >= 0) {
      sheet.getRange(rowIdx, idx + 1).setValue(v);
      changes.push('role=' + v);
    }
  }
  if (body.active !== undefined) {
    const idx = header.indexOf('active');
    if (idx >= 0) {
      sheet.getRange(rowIdx, idx + 1).setValue(body.active === true);
      changes.push('active=' + (body.active === true));
    }
  }

  if (changes.length === 0) return { ok: true, message: 'Không có thay đổi', changes: [] };

  appendAuditLog('user_update', auth.username, 'taikhoan', username, changes.join(', '));

  return { ok: true, username: username, changes: changes };
}

/**
 * action=users — trả danh sách user active để frontend populate dropdown filter.
 * Yêu cầu permission `manage` HOẶC `report`.
 */
function handleUsers(body) {
  const auth = verifyToken(body.token);
  // Cho phép nếu có 1 trong: manage / report / users_manage
  if (!can(auth.role, 'manage') && !can(auth.role, 'report') && !can(auth.role, 'users_manage')) {
    return { ok: false, error: 'forbidden' };
  }
  const includeInactive = body.include_inactive === true;
  const sheet = getSpreadsheet().getSheetByName('taikhoan');
  if (!sheet) return { ok: false, error: 'Sheet taikhoan không tồn tại' };
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return { ok: true, users: [] };
  const header = data[0].map(String);
  const idxU = header.indexOf('username');
  const idxN = header.indexOf('full_name');
  const idxR = header.indexOf('role');
  const idxA = header.indexOf('active');
  const idxC = header.indexOf('created_at');
  const users = [];
  for (let i = 1; i < data.length; i++) {
    const active = idxA >= 0 ? data[i][idxA] === true : true;
    if (!includeInactive && !active) continue;
    const u = String(data[i][idxU] || '').trim();
    if (!u) continue;
    const cred = readCred(u);
    users.push({
      username: u,
      full_name: String(data[i][idxN] || ''),
      role: String(data[i][idxR] || ''),
      active: active,
      created_at: idxC >= 0 ? String(data[i][idxC] || '') : '',
      // Cho users.html hiển thị trạng thái mật khẩu (không bao giờ trả hash)
      must_change: !!(cred && cred.must_change),
      has_password: !!cred
    });
  }
  return { ok: true, users: users };
}

function handleReport(body) {
  const auth = verifyToken(body.token);
  if (!can(auth.role, 'report')) return { ok: false, error: 'forbidden' };
  const types = (body.types && body.types.length) ? body.types : Object.keys(SHEET_MAP);
  const from = body.from ? new Date(body.from) : null;
  const to = body.to ? new Date(body.to) : null;
  const usernames = (body.usernames && body.usernames.length) ? body.usernames : null;
  const status = body.status || 'active';  // active / deleted / all
  const groupBy = body.groupBy || 'month';  // day / week / month / quarter

  const areaA = {};  // type -> {total, has_photo, has_gps, photo_count, deleted}
  const areaB = {};  // bucket -> {type -> count}
  const areaC = {};  // username -> {type -> count, total, full_name}
  const areaD = {};  // phuong -> {type -> count, total} (heatmap)

  types.forEach(t => { areaA[t] = { type: t, total: 0, has_photo: 0, has_gps: 0, photo_count: 0, deleted: 0 }; });

  types.forEach(t => {
    const rows = readSheetRows(t, true);  // include deleted để đếm
    // optionalGpsAllowed đã được thay bằng GPS_LATLONG_TYPES / GPS_LINK_TYPES
    rows.forEach(row => {
      const submittedAt = row['Submitted At'] ? new Date(row['Submitted At']) : null;
      if (!submittedAt) return;
      if (from && submittedAt < from) return;
      if (to && submittedAt > to) return;
      const isDeleted = !!row['Deleted At'];
      if (status === 'active' && isDeleted) return;
      if (status === 'deleted' && !isDeleted) return;
      const username = String(row['Username'] || '');
      if (usernames && usernames.indexOf(username) < 0) return;

      // Area A
      areaA[t].total++;
      if (isDeleted) areaA[t].deleted++;
      const photos = String(row['Ảnh (URLs)'] || '').split('|').filter(u => u);
      if (photos.length > 0) {
        areaA[t].has_photo++;
        areaA[t].photo_count += photos.length;
      }
      // GPS cho báo cáo: tách theo nhóm lưu trữ
      if (GPS_LATLONG_TYPES.indexOf(t) >= 0) {
        if (row['kinh độ'] && row['vĩ độ']) areaA[t].has_gps++;
      } else if (GPS_LINK_TYPES.indexOf(t) >= 0) {
        const lv = String(row['link'] || row['Link Google Map'] || '').trim();
        if (lv && lv !== '#VALUE!') areaA[t].has_gps++;
      }

      // Area B
      const bucket = bucketDate(submittedAt, groupBy);
      if (!areaB[bucket]) areaB[bucket] = {};
      areaB[bucket][t] = (areaB[bucket][t] || 0) + 1;

      // Area C
      if (!areaC[username]) {
        areaC[username] = { username: username, full_name: '', total: 0 };
        types.forEach(tt => { areaC[username][tt] = 0; });
      }
      areaC[username][t]++;
      areaC[username].total++;

      // Area D — heatmap theo Phường × Loại
      const phuong = String(row['Phường'] || '').trim() || '(không có)';
      if (!areaD[phuong]) {
        areaD[phuong] = { phuong: phuong, total: 0 };
        types.forEach(tt => { areaD[phuong][tt] = 0; });
      }
      areaD[phuong][t]++;
      areaD[phuong].total++;
    });
  });

  // Bổ sung full_name cho area C
  try {
    const tk = getSpreadsheet().getSheetByName('taikhoan');
    const data = tk.getDataRange().getValues();
    const header = data[0].map(String);
    const idxU = header.indexOf('username');
    const idxN = header.indexOf('full_name');
    for (let i = 1; i < data.length; i++) {
      const u = String(data[i][idxU]);
      if (areaC[u]) areaC[u].full_name = String(data[i][idxN] || '');
    }
  } catch (e) { /* ignore */ }

  // Format output
  const areaAArr = types.map(t => Object.assign({}, areaA[t], {
    avg_photos_per_record: areaA[t].total > 0 ? round1(areaA[t].photo_count / areaA[t].total) : 0
  }));
  const buckets = Object.keys(areaB).sort();
  const areaBArr = buckets.map(b => {
    const row = { bucket: b };
    types.forEach(t => { row[t] = areaB[b][t] || 0; });
    return row;
  });
  const areaCArr = Object.values(areaC).sort((a, b) => b.total - a.total);
  const areaDArr = Object.values(areaD).sort((a, b) => b.total - a.total);

  return {
    ok: true,
    filter: { types, from, to, usernames, status, groupBy },
    areaA: areaAArr,
    areaB: areaBArr,
    areaC: areaCArr,
    areaD: areaDArr
  };
}

// =====================================================================
// DATA HELPERS
// =====================================================================

/** Đọc tất cả row của 1 sheet KS thành array of {header: value}. */
function readSheetRows(type, includeDeleted) {
  const sheetName = SHEET_MAP[type];
  const sheet = getSpreadsheet().getSheetByName(sheetName);
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  const header = data[0].map(String);
  const out = [];
  for (let i = 1; i < data.length; i++) {
    const row = {};
    header.forEach((h, j) => { row[h] = data[i][j]; });
    if (!includeDeleted && row['Deleted At']) continue;
    out.push(row);
  }
  return out;
}

/** Tìm row theo STT, trả về {rowIndex(1-based), header, values}. */
function findRowByStt(sheet, stt) {
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return null;
  const header = data[0].map(String);
  const idx = header.indexOf('STT');
  if (idx < 0) return null;
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idx]) === String(stt)) {
      return { rowIndex: i + 1, header: header, values: data[i] };
    }
  }
  return null;
}

/** Ghi 1 dòng vào sheet Audit (tự tạo nếu chưa có). */
function appendAuditLog(action, username, sheetName, stt, note) {
  const ss = getSpreadsheet();
  let sheet = ss.getSheetByName('Audit');
  if (!sheet) {
    sheet = ss.insertSheet('Audit');
    sheet.getRange(1, 1, 1, AUDIT_HEADER.length).setValues([AUDIT_HEADER]);
    sheet.setFrozenRows(1);
  }
  sheet.appendRow([nowVnString(), action, username, sheetName, stt, note || '']);
}

/** Trích public_id từ URL Cloudinary. */
function extractCloudinaryPublicId(url) {
  // https://res.cloudinary.com/<cloud>/image/upload/[v123/]khaosat/tang_cuong_den/abc.jpg
  const m = url.match(/\/upload\/(?:v\d+\/)?(.+?)\.\w+(?:\?.*)?$/);
  return m ? m[1] : null;
}

// =====================================================================
// GOOGLE DRIVE UPLOAD
// =====================================================================

/**
 * TEST QUYỀN DRIVE — admin chạy tay trong Apps Script Editor.
 *
 * Vì sao cần: validateSheets() chỉ đọc Google Sheets, KHÔNG chạm Drive, nên nó
 * chạy OK cả khi quyền Drive chưa được cấp. Hàm này gọi thẳng DriveApp để:
 *   1. Ép hiện màn hình "Cần cấp quyền" có dòng về Google Drive.
 *   2. Báo rõ DRIVE_FOLDER_ID trỏ vào thư mục nào, có ghi được không.
 *
 * Chạy xong thấy ok:true nghĩa là quyền Drive đã đủ → sang bước Deploy new version.
 */
function testDriveAccess() {
  const rootId = getProp('DRIVE_FOLDER_ID');
  if (!rootId) {
    const msg = 'CHƯA SET DRIVE_FOLDER_ID trong Script Properties';
    Logger.log(msg);
    return { ok: false, error: msg };
  }

  const result = { ok: false, drive_folder_id: rootId };
  try {
    const root = DriveApp.getFolderById(rootId);
    result.folder_name = root.getName();
    result.folder_url = root.getUrl();

    // Thử tạo + xoá 1 file rỗng để chắc chắn có quyền GHI, không chỉ quyền đọc
    const probe = root.createFile('__test_quyen_ghi.txt', 'test', MimeType.PLAIN_TEXT);
    probe.setTrashed(true);
    result.can_write = true;

    // Liệt kê thư mục con để đối chiếu với cấu trúc mong đợi
    const subs = [];
    const it = root.getFolders();
    while (it.hasNext()) subs.push(it.next().getName());
    result.subfolders = subs;
    result.has_Bangron = subs.indexOf('Bangron') >= 0;

    result.ok = true;
    result.message = 'Quyền Drive OK. Tiếp theo: Deploy → Manage deployments → New version.';
  } catch (err) {
    result.error = String(err);
    result.message = 'Chưa có quyền Drive. Chạy lại hàm này và bấm "Xem lại quyền" → Cho phép.';
  }
  Logger.log(JSON.stringify(result, null, 2));
  return result;
}

/**
 * Nhận base64 ảnh từ frontend → lưu vào Google Drive → trả về URL xem công khai.
 * Script Properties cần: DRIVE_FOLDER_ID = ID thư mục Drive gốc.
 */
function handleUploadPhoto(body) {
  const userInfo = verifyToken(body.token);
  if (!userInfo) return { ok: false, error: 'Token không hợp lệ hoặc hết hạn' };

  const base64 = body.base64;
  const mime   = body.mimeType || 'image/jpeg';
  const fname  = body.fileName  || ('photo_' + Utilities.formatDate(new Date(), 'Asia/Ho_Chi_Minh', 'yyyyMMdd_HHmmss') + '.jpg');
  const folder = (body.folder   || 'khaosat').replace(/^\/+|\/+$/g, '');

  if (!base64) return { ok: false, error: 'Thiếu base64' };

  const rootId = getProp('DRIVE_FOLDER_ID');
  if (!rootId) return { ok: false, error: 'DRIVE_FOLDER_ID chưa cấu hình trong Script Properties' };

  try {
    const parent = getOrCreateFolderPath(rootId, folder);
    const bytes = Utilities.base64Decode(base64);
    const blob  = Utilities.newBlob(bytes, mime, fname);
    const file  = parent.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    const fileId = file.getId();
    Logger.log('Uploaded to Drive: ' + fileId + ' by ' + userInfo.username);
    return { ok: true, url: 'https://drive.google.com/uc?export=view&id=' + fileId, fileId: fileId };
  } catch (err) {
    Logger.log('handleUploadPhoto error: ' + err);
    return { ok: false, error: String(err) };
  }
}

/**
 * Lấy (hoặc tạo) thư mục theo đường dẫn 'a/b/c' tính từ thư mục gốc rootId.
 *
 * Dùng LockService: form gửi nhiều ảnh SONG SONG, nếu không khoá thì 5 request
 * cùng thấy thư mục chưa tồn tại và cùng tạo → Drive sinh 5 thư mục TRÙNG TÊN
 * (Drive cho phép trùng tên), ảnh nằm rải rác mỗi nơi một ít.
 * Kết quả được cache 6 tiếng theo đường dẫn để đỡ quét lại.
 */
function getOrCreateFolderPath(rootId, path) {
  const cache = CacheService.getScriptCache();
  const key = 'drivefolder_' + rootId + '_' + path;
  const cachedId = cache.get(key);
  if (cachedId) {
    try { return DriveApp.getFolderById(cachedId); } catch (e) { cache.remove(key); }
  }

  const lock = LockService.getScriptLock();
  try { lock.waitLock(20000); } catch (e) {
    Logger.log('getOrCreateFolderPath: không lấy được lock, chạy không khoá');
  }
  try {
    let parent = DriveApp.getFolderById(rootId);
    const parts = path.split('/').filter(Boolean);
    for (const part of parts) {
      const iter = parent.getFoldersByName(part);
      parent = iter.hasNext() ? iter.next() : parent.createFolder(part);
    }
    cache.put(key, parent.getId(), 21600);  // 6 tiếng
    return parent;
  } finally {
    try { lock.releaseLock(); } catch (e) { /* chưa lấy được lock */ }
  }
}

/**
 * Đọc 1 ảnh Drive trả về base64 — dùng cho trang báo cáo khi cần nội tuyến ảnh
 * vào file PDF (html2canvas không vẽ được ảnh Drive vì thiếu header CORS).
 * Body: { token, url }  →  { ok, mimeType, base64 }
 */
function handlePhotoBase64(body) {
  const auth = verifyToken(body.token);
  if (!auth) return { ok: false, error: 'Token không hợp lệ hoặc hết hạn' };

  const url = String(body.url || '');
  const m = url.match(/[?&]id=([a-zA-Z0-9_-]+)/) || url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (!m) return { ok: false, error: 'URL không phải Google Drive' };

  const fileId = m[1];

  // Cách 1: đọc trực tiếp qua DriveApp (nhanh, ổn định nhất)
  try {
    const blob = DriveApp.getFileById(fileId).getBlob();
    return {
      ok: true,
      mimeType: blob.getContentType() || 'image/jpeg',
      base64: Utilities.base64Encode(blob.getBytes())
    };
  } catch (err) {
    Logger.log('handlePhotoBase64 DriveApp fail: ' + err);
  }

  // Cách 2 (dự phòng): tải qua HTTP. Ảnh đã share ANYONE_WITH_LINK nên đọc được
  // mà không cần quyền Drive — dùng khi script chưa được cấp lại quyền.
  try {
    const res = UrlFetchApp.fetch(
      'https://drive.google.com/thumbnail?id=' + fileId + '&sz=w1600',
      { muteHttpExceptions: true, followRedirects: true });
    if (res.getResponseCode() === 200) {
      const blob = res.getBlob();
      return {
        ok: true,
        mimeType: blob.getContentType() || 'image/jpeg',
        base64: Utilities.base64Encode(blob.getBytes()),
        via: 'http'
      };
    }
    return { ok: false, error: 'Không tải được ảnh (HTTP ' + res.getResponseCode() + ')' };
  } catch (err2) {
    Logger.log('handlePhotoBase64 HTTP fail: ' + err2);
    return { ok: false, error: String(err2) };
  }
}

/** Xoá file Drive (chuyển vào thùng rác). URL format: .../uc?export=view&id=FILE_ID */
function deleteDrivePhoto(url) {
  try {
    const m = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (!m) return false;
    const file = DriveApp.getFileById(m[1]);
    file.setTrashed(true);
    Logger.log('Drive photo trashed: ' + m[1]);
    return true;
  } catch (e) {
    Logger.log('deleteDrivePhoto error: ' + e);
    return false;
  }
}

/** Gọi Cloudinary destroy API. Return true nếu OK. */
function destroyCloudinaryImage(url) {
  const publicId = extractCloudinaryPublicId(url);
  if (!publicId) return false;
  const { cloudName, apiKey, apiSecret } = getCloudinaryCreds();
  if (!cloudName || !apiKey || !apiSecret) {
    Logger.log('Cloudinary creds missing, skip destroy');
    return false;
  }
  const timestamp = Math.floor(Date.now() / 1000);
  const toSign = 'public_id=' + publicId + '&timestamp=' + timestamp + apiSecret;
  const signature = sha1Hex(toSign);
  const endpoint = 'https://api.cloudinary.com/v1_1/' + cloudName + '/image/destroy';
  const res = UrlFetchApp.fetch(endpoint, {
    method: 'post',
    payload: {
      public_id: publicId,
      api_key: apiKey,
      timestamp: String(timestamp),
      signature: signature
    },
    muteHttpExceptions: true
  });
  const code = res.getResponseCode();
  const json = JSON.parse(res.getContentText());
  Logger.log('Cloudinary destroy ' + publicId + ': ' + code + ' ' + JSON.stringify(json));
  return code === 200 && json.result === 'ok';
}

/** Đọc KPI_Targets, fallback default nếu thiếu. */
function getKpiTargets() {
  const defaults = {
    target_submissions_per_month: 50,
    target_distinct_types: 5,
    target_active_days: 20,
    weight_frequency: 0.40,
    weight_quality: 0.30,
    weight_diversity: 0.15,
    weight_completeness: 0.10,
    weight_stability: 0.05
  };
  try {
    const sheet = getSpreadsheet().getSheetByName('KPI_Targets');
    if (!sheet) return defaults;
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      const k = String(data[i][0]).trim();
      const v = Number(data[i][1]);
      if (k && !isNaN(v) && (k in defaults)) defaults[k] = v;
    }
  } catch (e) {
    Logger.log('getKpiTargets fallback: ' + e);
  }
  return defaults;
}

/** Danh sách field optional của 1 type (bỏ STT, server-managed, gps, link). Dùng cho completeness. */
function getOptionalFields(type) {
  const skip = ['STT', 'ngày khảo sát', 'Ngày khảo sát', 'Người khảo sát',
                'kinh độ', 'vĩ độ', 'Link Google Map', 'link', 'Bản vẽ'];
  return HEADERS[type].filter(h => skip.indexOf(h) < 0);
}

// =====================================================================
// NOTIFICATION — gửi email cho admin khi có submission mới
// =====================================================================

/** Đọc sheet notification_targets với cache 60s. */
function getNotificationTargets() {
  const cache = CacheService.getScriptCache();
  const cached = cache.get('notify_targets');
  if (cached) return JSON.parse(cached);
  let out = [];
  try {
    const sheet = getSpreadsheet().getSheetByName('notification_targets');
    if (!sheet) return [];
    const data = sheet.getDataRange().getValues();
    if (data.length < 2) return [];
    const header = data[0].map(String);
    const idxE = header.indexOf('email');
    const idxOn = header.indexOf('enabled');
    const idxT = header.indexOf('only_types');
    for (let i = 1; i < data.length; i++) {
      const email = String(data[i][idxE] || '').trim();
      if (!email || email.indexOf('@') < 0) continue;
      const enabled = idxOn >= 0 ? data[i][idxOn] === true : true;
      if (!enabled) continue;
      const types = idxT >= 0
        ? String(data[i][idxT] || '').split(',').map(s => s.trim()).filter(s => s)
        : [];
      out.push({ email: email, only_types: types });
    }
  } catch (e) {
    Logger.log('getNotificationTargets fail: ' + e);
  }
  cache.put('notify_targets', JSON.stringify(out), 60);
  return out;
}

/**
 * Gửi email cho danh sách admin khi có submission mới.
 * Best-effort: lỗi không chặn submit (try/catch silent).
 * @param {string} type      type-key
 * @param {string} sheetName
 * @param {object} data      dữ liệu đã ghi
 * @param {number} stt
 * @param {object} user      { username, full_name }
 * @param {number} rowNum    số row vừa append (1-based)
 * @param {number} sheetId   sheet.getSheetId() để tạo link
 */
function notifyAdmins(type, sheetName, data, stt, user, rowNum, sheetId) {
  try {
    const targets = getNotificationTargets();
    if (targets.length === 0) return;

    // Filter only_types nếu có
    const relevant = targets.filter(t =>
      t.only_types.length === 0 || t.only_types.indexOf(type) >= 0
    );
    if (relevant.length === 0) return;

    const tuyen = data['Tuyến đường'] || data['Vị trí'] || '';
    const subject = '[SAPULICO KS] ' + type + ' STT #' + stt +
      (tuyen ? ' — ' + tuyen : '');

    // Build link đến row trong Google Sheets
    const ssId = getProp('SPREADSHEET_ID');
    const rowLink = 'https://docs.google.com/spreadsheets/d/' + ssId +
      '/edit?gid=' + sheetId + '#gid=' + sheetId + '&range=A' + rowNum;

    // HTML body
    const importantFields = ['Tuyến đường', 'Vị trí', 'Quận', 'Phường', 'Tủ điều khiển',
                             'Số đèn dự kiến', 'Số lượng', 'Số đèn hiện hữu', 'Người khảo sát', 'ngày khảo sát', 'Ngày khảo sát'];
    let rowsHtml = '';
    importantFields.forEach(f => {
      const v = data[f];
      if (v === undefined || v === null || v === '') return;
      rowsHtml += '<tr><td style="padding:6px 10px; background:#f3f4f6; font-weight:600; width:160px">' +
        escapeHtmlGs(f) + '</td><td style="padding:6px 10px">' + escapeHtmlGs(String(v)) + '</td></tr>';
    });
    const photoUrls = String(data['Ảnh (URLs)'] || '').split('|').filter(u => u);
    let photoHtml = '';
    if (photoUrls.length > 0) {
      photoHtml = '<p style="margin-top:12px"><strong>Ảnh đính kèm (' + photoUrls.length + '):</strong></p><p>' +
        photoUrls.slice(0, 4).map(u =>
          '<a href="' + u + '"><img src="' + u + '" style="max-width:120px; max-height:120px; margin:4px; border-radius:4px"></a>'
        ).join('') + '</p>';
    }

    const html = `
      <div style="font-family:Arial,sans-serif; max-width:600px">
        <div style="background:#1d4ed8; color:white; padding:12px 16px; border-radius:8px 8px 0 0">
          <h2 style="margin:0; font-size:18px">SAPULICO — Có bản khảo sát mới</h2>
        </div>
        <div style="border:1px solid #e5e7eb; border-top:0; padding:16px; border-radius:0 0 8px 8px">
          <p style="margin:0 0 12px">Loại: <strong>${escapeHtmlGs(sheetName)}</strong> · STT <strong>#${stt}</strong></p>
          <p style="margin:0 0 12px; color:#666; font-size:13px">Người khảo sát: <strong>${escapeHtmlGs(user.full_name)}</strong> (@${escapeHtmlGs(user.username)})</p>
          <table style="border-collapse:collapse; width:100%; font-size:14px; border:1px solid #e5e7eb">${rowsHtml}</table>
          ${photoHtml}
          <p style="margin-top:16px">
            <a href="${rowLink}" style="background:#1d4ed8; color:white; padding:8px 16px; text-decoration:none; border-radius:6px; display:inline-block">📊 Mở trong Google Sheets</a>
          </p>
          <p style="margin-top:12px; font-size:11px; color:#999">
            Bạn nhận email này vì là người nhận được cấu hình trong sheet <code>notification_targets</code>.
            Tắt bằng cách bỏ tick <code>enabled</code> trong sheet đó.
          </p>
        </div>
      </div>
    `;

    relevant.forEach(t => {
      try {
        GmailApp.sendEmail(t.email, subject, '', { htmlBody: html, name: 'SAPULICO KS Bot' });
      } catch (e) {
        Logger.log('Email fail ' + t.email + ': ' + e.message);
      }
    });
  } catch (e) {
    Logger.log('notifyAdmins error: ' + e);
  }
}

/** Escape HTML đơn giản cho Apps Script (không có DOM). */
function escapeHtmlGs(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function inMonth(date, monthKey) {
  return Utilities.formatDate(date, TZ, 'yyyy-MM') === monthKey;
}

function bucketDate(date, groupBy) {
  if (groupBy === 'day')   return Utilities.formatDate(date, TZ, 'yyyy-MM-dd');
  if (groupBy === 'month') return Utilities.formatDate(date, TZ, 'yyyy-MM');
  if (groupBy === 'quarter') {
    const m = parseInt(Utilities.formatDate(date, TZ, 'MM'), 10);
    const q = Math.ceil(m / 3);
    return Utilities.formatDate(date, TZ, 'yyyy') + '-Q' + q;
  }
  if (groupBy === 'week') {
    // ISO week approximation
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNum = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    return d.getUTCFullYear() + '-W' + ('0' + weekNum).slice(-2);
  }
  return Utilities.formatDate(date, TZ, 'yyyy-MM');
}

function round1(n) {
  return Math.round(n * 10) / 10;
}

// =====================================================================
// BULK IMPORT — nhập dữ liệu lịch sử từ Excel (chỉ admin)
// =====================================================================

/**
 * Nhập hàng loạt bản ghi lịch sử vào sheet.
 * Body: { token, type, rows: [{col_name: value, ...}, ...] }
 * Trả về: { ok, type, inserted, skipped, total }
 */
function handleBulkImport(body) {
  const auth = verifyToken(body.token);
  if (!isFullAccess(auth.role)) {
    return { ok: false, error: 'Chỉ admin/user mới được nhập dữ liệu hàng loạt' };
  }

  const type = body.type;
  const sheetName = SHEET_MAP[type];
  if (!sheetName) return { ok: false, error: 'Loại không hợp lệ: ' + type };

  const sheet = getSpreadsheet().getSheetByName(sheetName);
  if (!sheet) return { ok: false, error: 'Sheet không tồn tại: ' + sheetName };

  const rows = Array.isArray(body.rows) ? body.rows : [];
  if (rows.length === 0) return { ok: true, type, inserted: 0, skipped: 0, total: 0 };

  // Lấy header của sheet để xác định thứ tự cột
  const header = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);

  const batchData = [];
  let skipped = 0;
  let sttBase = sheet.getLastRow(); // row tiếp theo = lastRow + 1; STT = lastRow (header = row 1)

  for (let i = 0; i < rows.length; i++) {
    const rec = rows[i];
    // Skip hoàn toàn rỗng
    if (!rec || Object.keys(rec).length === 0) { skipped++; continue; }

    sttBase++;
    const rowArr = header.map(label => {
      // Các cột bổ sung không có trong Excel: để trống (trừ STT)
      if (label === 'STT') return rec['STT'] !== undefined && rec['STT'] !== '' ? rec['STT'] : sttBase;
      if (label === 'Ảnh (URLs)') return '';
      if (label === 'Submitted At') return rec['ngày khảo sát'] || rec['Ngày khảo sát'] || '';
      if (label === 'User Agent') return 'bulk_import';
      if (label === 'Username') return rec['Người khảo sát'] ? 'import_' + String(rec['Người khảo sát']).substring(0, 20).replace(/\s+/g, '_') : 'import';
      if (label === 'Deleted At') return '';
      if (label === 'Deleted By') return '';
      // Tìm giá trị từ record (match tên cột)
      const val = rec[label];
      return val !== undefined ? val : '';
    });
    batchData.push(rowArr);
  }

  if (batchData.length === 0) {
    return { ok: true, type, inserted: 0, skipped, total: rows.length };
  }

  // Ghi batch một lần (nhanh hơn appendRow từng dòng)
  const startRow = sheet.getLastRow() + 1;
  sheet.getRange(startRow, 1, batchData.length, header.length).setValues(batchData);

  // Log audit
  try {
    logAudit('bulk_import', auth.username, sheetName, 0,
      'inserted=' + batchData.length + ' rows (historical data from Excel)');
  } catch(e) { Logger.log('audit log error: ' + e); }

  return {
    ok: true,
    type,
    sheet: sheetName,
    inserted: batchData.length,
    skipped,
    total: rows.length
  };
}

// =====================================================================
// EXPORT RAW — xuất dữ liệu thô theo cấu trúc sheet (cho report Vùng D)
// =====================================================================

/**
 * Xuất raw rows theo đúng thứ tự cột của từng sheet.
 * Trả array of arrays (không phải objects) để frontend dùng SheetJS trực tiếp.
 * Body: { token, types[], from?, to?, usernames?: [], status? }
 */
function handleExportRaw(body) {
  const auth = verifyToken(body.token);
  if (!can(auth.role, 'report')) return { ok: false, error: 'forbidden' };

  const types = Array.isArray(body.types) && body.types.length > 0
    ? body.types
    : Object.keys(SHEET_MAP);

  const from      = body.from ? new Date(body.from) : null;
  const to        = body.to   ? new Date(body.to + 'T23:59:59') : null;
  const usernames = Array.isArray(body.usernames) && body.usernames.length > 0
    ? body.usernames : null;
  const status    = body.status || 'active';  // 'active' | 'deleted' | 'all'

  const results = [];
  const ss = getSpreadsheet();

  for (const type of types) {
    const sheetName = SHEET_MAP[type];
    if (!sheetName) continue;
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) { results.push({ type, sheetName, headers: [], rows: [] }); continue; }

    const allValues = sheet.getDataRange().getValues();
    if (allValues.length < 2) {
      results.push({ type, sheetName, headers: allValues.length ? allValues[0].map(String) : [], rows: [] });
      continue;
    }

    const headers       = allValues[0].map(String);
    const idxSubmitted  = headers.indexOf('Submitted At');
    const idxUsername   = headers.indexOf('Username');
    const idxDeletedAt  = headers.indexOf('Deleted At');

    const filtered = [];
    for (let i = 1; i < allValues.length; i++) {
      const row = allValues[i];
      // Bỏ dòng hoàn toàn rỗng
      if (!row.some(c => c !== '' && c !== null && c !== undefined)) continue;

      // Filter trạng thái
      const isDeleted = idxDeletedAt >= 0 &&
        row[idxDeletedAt] !== '' && row[idxDeletedAt] != null;
      if (status === 'active'  && isDeleted)  continue;
      if (status === 'deleted' && !isDeleted) continue;

      // Filter khoảng ngày theo Submitted At
      if ((from || to) && idxSubmitted >= 0) {
        const d = row[idxSubmitted] instanceof Date
          ? row[idxSubmitted]
          : new Date(row[idxSubmitted]);
        if (isNaN(d.getTime())) continue;
        if (from && d < from) continue;
        if (to   && d > to)   continue;
      }

      // Filter username
      if (usernames && idxUsername >= 0 &&
          !usernames.includes(String(row[idxUsername]))) continue;

      // Serialize: Date → string, null/undefined → ''
      const serialized = row.map(v => {
        if (v instanceof Date) return Utilities.formatDate(v, TZ, 'yyyy-MM-dd HH:mm:ss');
        return v == null ? '' : v;
      });
      filtered.push(serialized);
    }

    results.push({ type, sheetName, headers, rows: filtered });
  }

  return { ok: true, results };
}
