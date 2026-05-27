// js/config.js — Cấu hình app. Sửa giá trị Cloudinary sau khi setup xong.
// CẢNH BÁO: repo PUBLIC → URL Apps Script + Sheets CSV ở đây sẽ lộ trên GitHub. Xem CLAUDE.md mục 17.

export const CONFIG = {
  // URL Apps Script Web App (deploy 2026-05-26)
  appsScriptUrl: 'https://script.google.com/macros/s/AKfycbxX9mgYO6g9A4BRTmJN3QpiZg1VutAeWcNgm4hY8zHPaPykgWYmgFv8M20S7YG8oCp7/exec',

  // Google Sheets CSV publish URL (read-only)
  sheetsCsvUrl: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRajzWe7TR5VPW5QOzYAOdZJoqRRbQpk4iO4GKOT4rd7GUQj87fTsPAll6cCC6bkcpEyMs5FYg_JMrH/pub?output=csv',

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
