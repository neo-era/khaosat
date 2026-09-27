# Sinh js/tdk-toado.js (tọa độ tủ điều khiển) từ TDK_ChieuSang_8Quan_phuongmoi.xlsx.
# Chạy lại khi file Excel cập nhật:  python tools/gen_tdk_toado.py
# Cột dùng: "Tên mới đầy đủ" (= tên trong TDK_LIST của app), "Vĩ độ", "Kinh độ".
import json, datetime, os, openpyxl

SRC = 'TDK_ChieuSang_8Quan_phuongmoi.xlsx'
OUT = os.path.join('js', 'tdk-toado.js')

wb = openpyxl.load_workbook(SRC, read_only=True, data_only=True)
ws = wb.worksheets[0]
rows = list(ws.iter_rows(values_only=True))
head = [str(c).strip() if c is not None else '' for c in rows[0]]
i_name, i_lat, i_lng = head.index('Tên mới đầy đủ'), head.index('Vĩ độ'), head.index('Kinh độ')

items, seen = [], set()
for r in rows[1:]:
    name = str(r[i_name] or '').strip()
    try:
        lat, lng = float(r[i_lat]), float(r[i_lng])
    except (TypeError, ValueError):
        continue
    if not name or not (8 < lat < 12 and 105 < lng < 108) or name in seen:
        continue
    seen.add(name)
    items.append([name, round(lat, 6), round(lng, 6)])

with open(OUT, 'w', encoding='utf-8', newline='\n') as f:
    f.write('// js/tdk-toado.js — TỰ SINH bằng tools/gen_tdk_toado.py từ ' + SRC +
            ' ngày ' + datetime.date.today().isoformat() + '. KHÔNG sửa tay.\n')
    f.write('// [tên tủ (= TDK_LIST), vĩ độ, kinh độ] — ' + str(len(items)) + ' tủ, chỉ 8 quận có trong file nguồn.\n')
    f.write('export const TDK_TOA_DO = ' + json.dumps(items, ensure_ascii=False, separators=(',', ':')) + ';\n')
print('Đã ghi', OUT, len(items), 'tủ')
