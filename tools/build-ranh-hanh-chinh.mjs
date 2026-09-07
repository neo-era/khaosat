// tools/build-ranh-hanh-chinh.mjs
// Sinh data/ranh-hanh-chinh-2025.geojson — ranh giới cấp xã TP.HCM (168 đơn vị sau
// sáp nhập 2025) + khu Cần Giuộc (nay thuộc tỉnh Tây Ninh) để phủ hết địa bàn khảo sát.
//
// Nguồn: https://github.com/ThangLeQuoc/vietnamese-provinces-database (MIT)
//   json/geojson/79_ho_chi_minh/wards/*.geojson  — mỗi file 1 Feature, MultiPolygon
//
// Chạy 1 lần khi cần cập nhật dữ liệu:  node tools/build-ranh-hanh-chinh.mjs
// KHÔNG sửa tay file .geojson sinh ra — sửa script này rồi chạy lại.
//
// Không cần npm install: chỉ dùng fetch + fs của Node (>=18).

import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = 'ThangLeQuoc/vietnamese-provinces-database';
const BRANCH = 'master';
const API = `https://api.github.com/repos/${REPO}/contents/json/geojson`;

// Khu Cần Giuộc + lân cận: sau sáp nhập nằm trong tỉnh Tây Ninh mới (mã 80),
// nhưng js/lookups.js có các xã này trong danh mục khảo sát nên vẫn vẽ ranh.
const EXTRA_TAY_NINH = [
  '27991_ben_luc.geojson',
  '28108_can_duoc.geojson',
  '28114_rach_kien.geojson',
  '28159_can_giuoc.geojson',
  '28165_phuoc_ly.geojson',
  '28177_my_loc.geojson',
  '28201_phuoc_vinh_tay.geojson',
  '28207_tan_tap.geojson'
];

// Douglas–Peucker: 0.00015 độ ≈ 16m. Tăng lên nếu file vượt ~1MB.
const TOLERANCE = 0.00015;
const PRECISION = 5;          // 5 chữ số thập phân ≈ 1.1m
const CONCURRENCY = 8;

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, '..', 'data', 'ranh-hanh-chinh-2025.geojson');

// ---------- Tải ----------

async function getJson(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'khaosat-build-script', 'Accept': 'application/vnd.github+json' }
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${url}`);
  return res.json();
}

async function listWards(provinceDir) {
  const items = await getJson(`${API}/${provinceDir}/wards?per_page=1000`);
  return items.filter(x => x.type === 'file' && x.name.endsWith('.geojson'));
}

// Chạy tối đa CONCURRENCY request cùng lúc, giữ nguyên thứ tự kết quả.
async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      out[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return out;
}

function rawUrl(provinceDir, fileName) {
  return `https://raw.githubusercontent.com/${REPO}/${BRANCH}/json/geojson/${provinceDir}/wards/${fileName}`;
}

// ---------- Đơn giản hoá ----------

// Khoảng cách bình phương từ p tới đoạn thẳng ab (toạ độ [lng, lat], đơn vị độ).
function sqSegDist(p, a, b) {
  let x = a[0], y = a[1];
  let dx = b[0] - x, dy = b[1] - y;
  if (dx !== 0 || dy !== 0) {
    const t = ((p[0] - x) * dx + (p[1] - y) * dy) / (dx * dx + dy * dy);
    if (t > 1) { x = b[0]; y = b[1]; }
    else if (t > 0) { x += dx * t; y += dy * t; }
  }
  dx = p[0] - x;
  dy = p[1] - y;
  return dx * dx + dy * dy;
}

// Douglas–Peucker khử đệ quy (ring có thể vài chục nghìn điểm → tránh tràn stack).
function simplifyRing(points, tolerance) {
  if (points.length <= 4) return points;
  const sqTol = tolerance * tolerance;
  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;

  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [first, last] = stack.pop();
    let maxSq = 0, index = -1;
    for (let i = first + 1; i < last; i++) {
      const sq = sqSegDist(points[i], points[first], points[last]);
      if (sq > maxSq) { maxSq = sq; index = i; }
    }
    if (maxSq > sqTol && index > 0) {
      keep[index] = 1;
      stack.push([first, index], [index, last]);
    }
  }

  const out = [];
  for (let i = 0; i < points.length; i++) if (keep[i]) out.push(points[i]);
  return out;
}

function roundCoord(p) {
  return [
    Number(p[0].toFixed(PRECISION)),
    Number(p[1].toFixed(PRECISION))
  ];
}

// Ring hợp lệ: >=4 điểm và điểm đầu trùng điểm cuối.
function processRing(ring) {
  let out = simplifyRing(ring, TOLERANCE).map(roundCoord);
  // Khử điểm trùng liên tiếp sinh ra sau khi làm tròn
  out = out.filter((p, i) => i === 0 || p[0] !== out[i - 1][0] || p[1] !== out[i - 1][1]);
  if (out.length < 4) return null;
  const a = out[0], z = out[out.length - 1];
  if (a[0] !== z[0] || a[1] !== z[1]) out.push([a[0], a[1]]);
  return out.length >= 4 ? out : null;
}

// Trả về mảng polygon (mỗi polygon = mảng ring) cho cả Polygon lẫn MultiPolygon.
function toPolygons(geometry) {
  if (geometry.type === 'Polygon') return [geometry.coordinates];
  if (geometry.type === 'MultiPolygon') return geometry.coordinates;
  throw new Error('Geometry lạ: ' + geometry.type);
}

// Diện tích shoelace (đơn vị độ², chỉ để so sánh ring nào lớn nhất).
function ringArea(ring) {
  let s = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    s += (ring[j][0] * ring[i][1]) - (ring[i][0] * ring[j][1]);
  }
  return Math.abs(s / 2);
}

// Trọng tâm đa giác (centroid) của ring — dùng làm điểm đặt nhãn tên phường.
function ringCentroid(ring) {
  let x = 0, y = 0, a = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const f = (ring[j][0] * ring[i][1]) - (ring[i][0] * ring[j][1]);
    a += f;
    x += (ring[j][0] + ring[i][0]) * f;
    y += (ring[j][1] + ring[i][1]) * f;
  }
  a *= 0.5;
  if (a === 0) return ring[0];
  return [x / (6 * a), y / (6 * a)];
}

// Điểm có nằm trong polygon (mảng ring, ring[0] = viền ngoài, còn lại là lỗ)?
function pointInPolygon(pt, rings) {
  const inRing = (ring) => {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
      if (((yi > pt[1]) !== (yj > pt[1])) &&
          (pt[0] < (xj - xi) * (pt[1] - yi) / (yj - yi) + xi)) inside = !inside;
    }
    return inside;
  };
  if (!inRing(rings[0])) return false;
  for (let i = 1; i < rings.length; i++) if (inRing(rings[i])) return false;
  return true;
}

// Phường hình cong (chữ C, hình chuối) thì trọng tâm rơi ra ngoài → nhãn đè sang
// phường khác. Fallback: quét ngang vài mức vĩ độ, lấy giữa đoạn nằm trong dài nhất.
function interiorPoint(rings) {
  const ring = rings[0];
  let minY = Infinity, maxY = -Infinity, minX = Infinity, maxX = -Infinity;
  for (const p of ring) {
    if (p[1] < minY) minY = p[1];
    if (p[1] > maxY) maxY = p[1];
    if (p[0] < minX) minX = p[0];
    if (p[0] > maxX) maxX = p[0];
  }
  let best = null, bestWidth = -1;
  const STEPS = 33;
  for (let k = 1; k < STEPS; k++) {
    const y = minY + (maxY - minY) * (k / STEPS);
    // Lấy mọi giao điểm của đường ngang y với các ring (cả viền ngoài lẫn lỗ)
    const xs = [];
    for (const r of rings) {
      for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
        const yi = r[i][1], yj = r[j][1];
        if ((yi > y) !== (yj > y)) {
          xs.push(r[j][0] + (y - yj) * (r[i][0] - r[j][0]) / (yi - yj));
        }
      }
    }
    xs.sort((a, b) => a - b);
    for (let i = 0; i + 1 < xs.length; i += 2) {
      const w = xs[i + 1] - xs[i];
      const mid = [(xs[i] + xs[i + 1]) / 2, y];
      if (w > bestWidth && pointInPolygon(mid, rings)) { bestWidth = w; best = mid; }
    }
  }
  return best;
}

function countPoints(polygons) {
  let n = 0;
  for (const poly of polygons) for (const ring of poly) n += ring.length;
  return n;
}

// ---------- Xử lý 1 feature ----------

function buildFeature(fc) {
  const src = fc.features[0];
  const p = src.properties || {};
  const polygons = [];

  for (const poly of toPolygons(src.geometry)) {
    const rings = [];
    for (const ring of poly) {
      const r = processRing(ring);
      if (r) rings.push(r);
      else if (rings.length === 0) break; // ring ngoài quá nhỏ → bỏ cả polygon
    }
    if (rings.length) polygons.push(rings);
  }
  if (!polygons.length) return null;

  // Ring ngoài lớn nhất → đặt nhãn ở đó (tránh nhãn rơi ra đảo/cù lao nhỏ)
  let best = polygons[0][0], bestRings = polygons[0], bestArea = -1;
  for (const poly of polygons) {
    const a = ringArea(poly[0]);
    if (a > bestArea) { bestArea = a; best = poly[0]; bestRings = poly; }
  }
  let center = ringCentroid(best);
  if (!pointInPolygon(center, bestRings)) {
    const alt = interiorPoint(bestRings);
    if (alt) center = alt;
  }
  const [cLng, cLat] = center;

  return {
    type: 'Feature',
    properties: {
      code: String(p.code ?? ''),
      name: p.name || '',
      fullName: p.fullName || p.name || '',
      // c = [lat, lng] — đúng thứ tự Leaflet nhận, runtime khỏi tính lại
      c: [Number(cLat.toFixed(PRECISION)), Number(cLng.toFixed(PRECISION))]
    },
    geometry: polygons.length === 1
      ? { type: 'Polygon', coordinates: polygons[0] }
      : { type: 'MultiPolygon', coordinates: polygons }
  };
}

// ---------- Main ----------

async function collect(provinceDir, filter) {
  let files = await listWards(provinceDir);
  if (filter) files = files.filter(f => filter.includes(f.name));
  console.log(`  ${provinceDir}: ${files.length} file`);

  return mapLimit(files, CONCURRENCY, async (f) => {
    const fc = await getJson(f.download_url || rawUrl(provinceDir, f.name));
    return { fc, name: f.name };
  });
}

async function main() {
  console.log(`Nguồn: ${REPO}@${BRANCH} (MIT)`);
  console.log('Đang lấy danh sách...');

  const [hcm, tayNinh] = await Promise.all([
    collect('79_ho_chi_minh', null),
    collect('80_tay_ninh', EXTRA_TAY_NINH)
  ]);

  const features = [];
  let rawPoints = 0, keptPoints = 0, skipped = 0;

  for (const { fc, name } of [...hcm, ...tayNinh]) {
    rawPoints += countPoints(toPolygons(fc.features[0].geometry));
    const feat = buildFeature(fc);
    if (!feat) { console.warn(`  ⚠ bỏ qua (rỗng sau khi rút gọn): ${name}`); skipped++; continue; }
    keptPoints += countPoints(toPolygons(feat.geometry));
    features.push(feat);
  }

  features.sort((a, b) => a.properties.code.localeCompare(b.properties.code));

  const out = {
    type: 'FeatureCollection',
    // Ghi nguồn ngay trong file để sau này không ai phải đoán
    _source: `${REPO}@${BRANCH} json/geojson (MIT) — sinh bởi tools/build-ranh-hanh-chinh.mjs, tolerance=${TOLERANCE}`,
    features
  };

  await mkdir(dirname(OUT), { recursive: true });
  const json = JSON.stringify(out);
  await writeFile(OUT, json, 'utf8');

  const kb = (Buffer.byteLength(json, 'utf8') / 1024).toFixed(0);
  console.log('');
  console.log(`✓ ${features.length} feature${skipped ? ` (bỏ ${skipped})` : ''}, ${kb} KB → data/ranh-hanh-chinh-2025.geojson`);
  console.log(`  điểm: ${rawPoints.toLocaleString()} → ${keptPoints.toLocaleString()} (giữ ${(keptPoints / rawPoints * 100).toFixed(1)}%)`);
  if (kb > 1200) console.log('  ⚠ File hơi lớn — cân nhắc tăng TOLERANCE lên 0.0002 hoặc 0.0003 rồi chạy lại.');
}

main().catch(err => {
  console.error('Lỗi:', err.message);
  process.exit(1);
});
