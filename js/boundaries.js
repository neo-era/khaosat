// js/boundaries.js — Lớp ranh giới hành chính cấp xã (TP.HCM sau sáp nhập 2025)
// vẽ đè lên nền OSM của Leaflet.
//
// Dữ liệu: data/ranh-hanh-chinh-2025.geojson — sinh bởi tools/build-ranh-hanh-chinh.mjs
// từ ThangLeQuoc/vietnamese-provinces-database (MIT). KHÔNG sửa tay file đó.

import { escapeHtml } from './utils.js';

const DATA_URL = './data/ranh-hanh-chinh-2025.geojson';
const ATTRIBUTION = 'Ranh giới: <a href="https://github.com/ThangLeQuoc/vietnamese-provinces-database" target="_blank" rel="noopener">vietnamese-provinces-database</a> (MIT)';

// Dưới mức zoom này thì ẩn nhãn — 176 tên chồng nhau ở zoom thành phố là không đọc được.
const LABEL_MIN_ZOOM = 13;

const LABEL_PANE = 'ranhLabelPane';

const STYLE = {
  color: '#7c3aed',
  weight: 1.2,
  opacity: 0.75,
  fillColor: '#7c3aed',
  // Fill gần như trong suốt: vẫn bắt được chuột/chạm nhưng không che nền bản đồ.
  fillOpacity: 0.04
};

const STYLE_HOVER = {
  weight: 3,
  opacity: 1,
  fillOpacity: 0.12
};

/**
 * Tải GeoJSON và dựng 2 lớp: polygon ranh giới + nhãn tên phường.
 * Không tự add vào map — bên gọi quyết định lúc nào bật.
 *
 * @param {L.Map} map
 * @returns {Promise<{ polygons: L.GeoJSON, labels: L.LayerGroup, count: number, destroy: Function }>}
 */
export async function createBoundaryLayer(map) {
  const res = await fetch(DATA_URL);
  if (!res.ok) throw new Error('Không tải được dữ liệu ranh giới (' + res.status + ')');
  const geojson = await res.json();

  // Pane riêng cho nhãn: nằm trên polygon (overlayPane 400) nhưng dưới marker
  // khảo sát (markerPane 600), và không nhận sự kiện chuột.
  if (!map.getPane(LABEL_PANE)) {
    const pane = map.createPane(LABEL_PANE);
    pane.style.zIndex = 450;
    pane.style.pointerEvents = 'none';
  }

  const polygons = L.geoJSON(geojson, {
    style: () => STYLE,
    attribution: ATTRIBUTION,
    onEachFeature: (feature, layer) => {
      const p = feature.properties || {};
      layer.bindTooltip(p.fullName || p.name || '', { sticky: true, direction: 'top' });
      layer.on('mouseover', () => layer.setStyle(STYLE_HOVER));
      layer.on('mouseout', () => polygons.resetStyle(layer));
      // Mobile không có hover → chạm để xem tên, chạm ra ngoài thì trả style cũ.
      layer.on('click', (e) => {
        layer.setStyle(STYLE_HOVER);
        layer.openTooltip(e.latlng);
      });
    }
  });

  const labels = L.layerGroup();
  let count = 0;
  for (const f of geojson.features) {
    const p = f.properties || {};
    if (!Array.isArray(p.c) || !p.name) continue;
    labels.addLayer(L.marker(p.c, {
      pane: LABEL_PANE,
      interactive: false,
      keyboard: false,
      icon: L.divIcon({
        className: 'ranh-label',
        // Leaflet gán transform inline lên chính div này để định vị, nên phải căn
        // giữa bằng thẻ span bên trong (xem CSS .ranh-label > span trong map.html).
        html: '<span>' + escapeHtml(p.name) + '</span>',
        iconSize: null
      })
    }));
    count++;
  }

  // Nhãn chỉ hiện khi đã zoom đủ gần, và chỉ khi lớp polygon đang bật.
  const syncLabels = () => {
    const shouldShow = map.hasLayer(polygons) && map.getZoom() >= LABEL_MIN_ZOOM;
    if (shouldShow && !map.hasLayer(labels)) map.addLayer(labels);
    else if (!shouldShow && map.hasLayer(labels)) map.removeLayer(labels);
  };

  map.on('zoomend', syncLabels);
  map.on('layeradd layerremove', (e) => {
    if (e.layer === polygons) syncLabels();
  });

  return {
    polygons,
    labels,
    count: geojson.features.length,
    labelCount: count,
    destroy() {
      map.off('zoomend', syncLabels);
      map.removeLayer(labels);
      map.removeLayer(polygons);
    }
  };
}

export { LABEL_MIN_ZOOM };
