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
 *   action=kpi      — body {token, month: "YYYY-MM"} → KPI tháng cho từng KTV
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
  nang_mong:      '15. Nâng móng'
};

/** Header gốc của 15 loại khảo sát (NGUYÊN VĂN tiếng Việt, đồng bộ schemas.js + CLAUDE.md mục 5). */
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
  ]
};

/** 6 cột bonus thêm vào CUỐI mỗi sheet khảo sát. */
const BONUS_COLS = ['Ảnh (URLs)', 'Submitted At', 'User Agent', 'Username', 'Deleted At', 'Deleted By'];

/** Loại form không có GPS (cho KPI tính pct_gps). */
const NO_GPS_TYPES = ['hkn', 'vo_tu'];

const TAIKHOAN_HEADER = ['username', 'password_hash', 'full_name', 'role', 'active', 'created_at'];
const KPI_TARGETS_HEADER = ['param', 'value'];
const PHAN_QUYEN_HEADER = ['vaiTro', 'submit', 'delete', 'kpi', 'manage', 'report', 'moTa'];
const AUDIT_HEADER = ['timestamp', 'action', 'username', 'target_sheet', 'target_stt', 'note'];

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
  ['user1', true,  false, false, false, false, 'KTV hiện trường — chỉ nhập KS'],
  ['demo',  false, false, false, false, false, 'Tài khoản xem thử — readonly']
];

/** Fallback nếu sheet phan quyen lỗi (đồng bộ với PHAN_QUYEN_DEFAULTS). */
const DEFAULT_PERMISSIONS = {
  admin:  { submit: true,  delete: true,  kpi: true,  manage: true,  report: true  },
  user:   { submit: true,  delete: true,  kpi: true,  manage: true,  report: true  },
  user1:  { submit: true,  delete: false, kpi: false, manage: false, report: false },
  demo:   { submit: false, delete: false, kpi: false, manage: false, report: false }
};

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
 * Hash password để paste vào sheet taikhoan.
 * Cách dùng: trong Apps Script Editor, chạy:
 *   Logger.log(hashPassword('MatKhauMoi@2026'));
 * Copy hash trong Logs paste vào cột password_hash.
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
    const actions = ['submit', 'delete', 'kpi', 'manage', 'report'];
    const perms = {};
    for (let i = 1; i < data.length; i++) {
      const role = String(data[i][idxRole] || '').trim();
      if (!role) continue;
      perms[role] = {};
      actions.forEach(a => {
        const idx = header.indexOf(a);
        perms[role][a] = idx >= 0 && data[i][idx] === true;
      });
    }
    cache.put('permissions', JSON.stringify(perms), 60);
    return perms;
  } catch (err) {
    Logger.log('getPermissions fallback to default: ' + err);
    return DEFAULT_PERMISSIONS;
  }
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
 * Migrate sheet taikhoan từ format cũ (tiếng Việt + password plaintext) sang mới.
 * Idempotent: chạy lại an toàn.
 */
function migrateTaikhoan() {
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
      default:        return jsonResponse({ ok: false, error: 'unknown action: ' + action });
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
  const expectedHash = hashPassword(password);
  if (expectedHash !== String(user.password_hash).trim()) {
    return fail('Sai tên đăng nhập hoặc mật khẩu');
  }
  // Thành công
  cache.remove(cacheKey);
  const token = generateToken(username);
  return {
    ok: true,
    token: token,
    username: user.username,
    full_name: user.full_name,
    role: user.role,
    expires_at: Date.now() + TOKEN_TTL_MS
  };
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
  return { ok: true, stt: stt, sheet: sheetName, timestamp: submittedAt };
}

function handleList(body) {
  const auth = verifyToken(body.token);
  const type = body.type;
  const usernameFilter = body.username;
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

  // Xoá ảnh Cloudinary
  const photoUrls = String(values[header.indexOf('Ảnh (URLs)')] || '').split('|').filter(u => u);
  const photoResults = [];
  photoUrls.forEach(url => {
    try {
      const ok = destroyCloudinaryImage(url);
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
  if (!can(auth.role, 'kpi')) return { ok: false, error: 'forbidden' };
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

  // Tập hợp KTV (admin/user/user1 — không tính demo)
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
      if (NO_GPS_TYPES.indexOf(type) < 0) {
        stat.gps_eligible++;
        if (row['kinh độ'] && row['vĩ độ']) stat.has_gps++;
      }
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

  // Tính 5 chỉ tiêu cho mỗi KTV
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
  return { ok: true, month: month, results: results, targets: targets };
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

  types.forEach(t => { areaA[t] = { type: t, total: 0, has_photo: 0, has_gps: 0, photo_count: 0, deleted: 0 }; });

  types.forEach(t => {
    const rows = readSheetRows(t, true);  // include deleted để đếm
    const optionalGpsAllowed = NO_GPS_TYPES.indexOf(t) < 0;
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
      if (optionalGpsAllowed && row['kinh độ'] && row['vĩ độ']) areaA[t].has_gps++;

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

  return {
    ok: true,
    filter: { types, from, to, usernames, status, groupBy },
    areaA: areaAArr,
    areaB: areaBArr,
    areaC: areaCArr
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
