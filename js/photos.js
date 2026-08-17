// js/photos.js — Nội tuyến ảnh thành data: URL.
//
// Dùng khi cần nhúng ảnh vào file xuất ra (Word, PDF) thay vì để URL:
//   - Word: file .doc phải chứa ảnh bên trong, nếu để URL thì mở máy khác là mất ảnh.
//   - PDF (html2canvas): ảnh lấy qua URL có thể bị chặn CORS → vẽ ra ô trắng.
//
// Hai đường lấy ảnh:
//   1. fetch thẳng từ trình duyệt — nhanh nhất. Cloudinary luôn cho phép;
//      Drive cho phép ở response cuối nhưng chuỗi redirect có thể bị từ chối.
//   2. đi vòng qua Apps Script (action=photo_base64) — chậm hơn nhưng chắc chắn.

import { apiPhotoBase64 } from './api.js';

/** Cache theo URL, dùng chung cả phiên — xuất file nhiều lần không tải lại. */
const cache = new Map();

/** Chuyển 1 URL ảnh thành chuỗi data: URL. */
export async function fetchAsDataUrl(url) {
  if (cache.has(url)) return cache.get(url);

  let dataUrl = null;
  try {
    const res = await fetch(url, { mode: 'cors' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const blob = await res.blob();
    if (!blob.type.startsWith('image/')) throw new Error('không phải ảnh');
    dataUrl = await blobToDataUrl(blob);
  } catch (e) {
    const res = await apiPhotoBase64(url);
    dataUrl = `data:${res.mimeType || 'image/jpeg'};base64,${res.base64}`;
  }

  cache.set(url, dataUrl);
  return dataUrl;
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.onerror = () => reject(new Error('đọc blob lỗi'));
    fr.readAsDataURL(blob);
  });
}

/**
 * Đổi src của mọi <img data-src> trong container thành data: URL.
 *
 * @param {HTMLElement} container
 * @param {(done:number, total:number) => void} [onProgress]
 * @returns {Promise<Array<{el:HTMLImageElement, orig:string}>>} danh sách để khôi phục
 */
export async function inlineImages(container, onProgress) {
  const imgs = Array.from(container.querySelectorAll('img[data-src]'));
  const restore = [];
  let done = 0;

  for (const img of imgs) {
    restore.push({ el: img, orig: img.getAttribute('src') });
    done++;
    if (onProgress) onProgress(done, imgs.length);

    try {
      img.src = await fetchAsDataUrl(img.dataset.src);
    } catch (e) {
      // 1 ảnh lỗi không được chặn cả file — để ô xám
      img.removeAttribute('src');
      img.style.background = '#e5e7eb';
    }
    // Chờ trình duyệt decode xong ảnh mới
    await new Promise(r => {
      if (img.complete || !img.getAttribute('src')) return r();
      img.onload = img.onerror = r;
    });
  }
  return restore;
}

/** Trả src ảnh về URL gốc sau khi xuất file xong. */
export function restoreImages(list) {
  (list || []).forEach(({ el, orig }) => {
    if (orig) el.src = orig;
    el.style.background = '';
  });
}
