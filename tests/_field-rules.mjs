// Sinh FIELD_RULES mong đợi từ js/schemas.js — dùng trong test đồng bộ với Code.gs (v2.3.0).
//   req: trường bắt buộc người khảo sát nhập (bỏ trường tự động, Quận, Người khảo sát, ảnh)
//   pos: trường SỐ bắt buộc đo đạc (decimal, hoặc hint mét/mm)  → > 0, cho thập phân
//   cnt: trường SỐ bắt buộc đếm cái                              → số nguyên ≥ 1
//   num: trường số không bắt buộc                                → có giá trị thì phải là số ≥ 0
//   dt:  trường ngày giờ (datetime)
const AUTO = ['stt_auto', 'date_auto', 'link_gmap', 'gps_lat', 'gps_lng', 'quan', 'image_url', 'skip'];
export function expectedFieldRules(SCHEMAS) {
  const out = {};
  for (const [type, s] of Object.entries(SCHEMAS)) {
    const r = { req: [], pos: [], cnt: [], num: [], dt: [] };
    for (const f of s.fields) {
      if (AUTO.includes(f.type) || f.key === 'nguoi_ks') continue;
      const isNum = f.type === 'number' || f.type === 'decimal';
      if (f.required) r.req.push(f.label);
      if (f.type === 'datetime') r.dt.push(f.label);
      if (!isNum) continue;
      const measure = f.type === 'decimal' || /^\s*(mét|mm)\b/i.test(f.hint || '');
      if (f.required) (measure ? r.pos : r.cnt).push(f.label);
      else r.num.push(f.label);
    }
    out[type] = r;
  }
  return out;
}
