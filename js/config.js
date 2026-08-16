// js/config.js — Cấu hình app. Sửa giá trị Cloudinary sau khi setup xong.
// CẢNH BÁO: repo PUBLIC → URL Apps Script ở đây sẽ lộ trên GitHub. Xem CLAUDE.md mục 17.
//
// 2026-08-16: đã BỎ `sheetsCsvUrl`. URL publish-to-web đó phát tán chính sheet
// `taikhoan` (username + password_hash) ra internet mà không code nào dùng tới.
// Đừng thêm lại — cần đọc dữ liệu thì gọi Apps Script (có token + phân quyền).

export const CONFIG = {
  // URL Apps Script Web App (deploy 2026-05-26)
  appsScriptUrl: 'https://script.google.com/macros/s/AKfycbxX9mgYO6g9A4BRTmJN3QpiZg1VutAeWcNgm4hY8zHPaPykgWYmgFv8M20S7YG8oCp7/exec',

  // Cloudinary — cloud name lấy từ Dashboard, preset là tên unsigned preset đã tạo
  cloudinaryName: 'dmlsqbe8c',
  cloudinaryPreset: 'khaosat_unsigned',

  // Tham số ảnh
  imageMaxDim: 1600,
  imageQuality: 0.8,
  imageMaxRawMB: 20,

  // UX
  autosaveIntervalMs: 5000,
  sessionTimeoutHours: 8,
  toastDefaultMs: 3000,

  // Tên app hiển thị
  appName: 'Khảo sát chiếu sáng SAPULICO',
  appShort: 'KS Đèn'
};
