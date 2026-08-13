// js/camera.js — Nén ảnh trước upload + tạo thumbnail.

import { CONFIG } from './config.js';

/**
 * Nén ảnh: resize max chiều dài + convert JPEG.
 * @param {File} file
 * @param {number} maxDim
 * @param {number} quality 0..1
 * @returns {Promise<Blob>}
 */
export async function compressImage(file, maxDim = CONFIG.imageMaxDim, quality = CONFIG.imageQuality) {
  validateImageFile(file);
  const img = await loadImage(file);
  const ratio = Math.min(maxDim / img.width, maxDim / img.height, 1);
  const w = Math.round(img.width * ratio);
  const h = Math.round(img.height * ratio);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, w, h);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error('Compress failed')),
      'image/jpeg',
      quality
    );
  });
}

/**
 * Thumbnail nhỏ cho preview (DataURL base64).
 * @param {File} file
 * @param {number} dim - cạnh dài (square crop center).
 * @returns {Promise<string>} dataURL
 */
export async function createThumbnail(file, dim = 120) {
  validateImageFile(file);
  const img = await loadImage(file);
  const size = Math.min(img.width, img.height);
  const sx = (img.width - size) / 2;
  const sy = (img.height - size) / 2;
  const canvas = document.createElement('canvas');
  canvas.width = dim;
  canvas.height = dim;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, sx, sy, size, size, 0, 0, dim, dim);
  return canvas.toDataURL('image/jpeg', 0.7);
}

function validateImageFile(file) {
  if (!file) throw new Error('Không có file');
  if (!file.type || !file.type.startsWith('image/')) {
    throw new Error('File không phải ảnh: ' + file.type);
  }
  const sizeMB = file.size / (1024 * 1024);
  if (sizeMB > CONFIG.imageMaxRawMB) {
    throw new Error('Ảnh quá to (' + sizeMB.toFixed(1) + 'MB, max ' + CONFIG.imageMaxRawMB + 'MB)');
  }
}

/**
 * Ghi dải thông tin (thời gian + GPS + hạng mục) vào đáy ảnh.
 * @param {Blob} blob       — ảnh đã nén (từ compressImage)
 * @param {object} opts
 *   @param {string} opts.time       — "dd/MM/yyyy HH:mm:ss"
 *   @param {string} opts.location   — tọa độ GPS hoặc chuỗi rỗng
 *   @param {string} opts.surveyName — tên hạng mục khảo sát
 * @returns {Promise<Blob>} JPEG mới đã có dải thông tin
 */
export async function stampImage(blob, { time = '', location = '', surveyName = '' } = {}) {
  const lines = [time, location, surveyName].filter(Boolean);
  if (lines.length === 0) return blob;

  const img     = await loadImage(blob);
  const canvas  = document.createElement('canvas');
  canvas.width  = img.width;
  canvas.height = img.height;
  const ctx     = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);

  const fontSize = Math.max(18, Math.round(img.width / 36));
  const pad      = Math.round(fontSize * 0.55);
  const lineH    = fontSize + Math.round(pad * 0.7);
  const stripH   = lines.length * lineH + pad * 2;
  const y0       = img.height - stripH;

  // Dải nền tối
  ctx.fillStyle = 'rgba(0,0,0,0.62)';
  ctx.fillRect(0, y0, img.width, stripH);

  // Chữ trắng
  ctx.font         = `bold ${fontSize}px Arial, sans-serif`;
  ctx.fillStyle    = '#ffffff';
  ctx.shadowColor  = 'rgba(0,0,0,0.9)';
  ctx.shadowBlur   = 3;
  ctx.textBaseline = 'top';

  lines.forEach((line, i) => {
    ctx.fillText(line, pad, y0 + pad + i * lineH);
  });

  return new Promise((resolve, reject) =>
    canvas.toBlob(
      b => b ? resolve(b) : reject(new Error('Stamp failed')),
      'image/jpeg', 0.88
    )
  );
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Load image failed')); };
    img.src = url;
  });
}
