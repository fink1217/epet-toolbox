// font.bin：電子雞的點陣字型檔（規格見 docs/SD卡格式-v1.md）。
// 純函式：只負責把字形資料排成位元組、以及反過來解析。畫字在 font.js。

export const FONT_MAGIC = 'EPF1';
const HEADER = 16;
const ENTRY = 16;

// glyph：{ cp, w, h, xoff, yoff, adv, alpha: Uint8Array(w*h)，每點 0..255 }
// 回傳 Uint8Array
export function buildFontBin({ px, lineHeight, ascent, glyphs }) {
  const list = [...glyphs].sort((a, b) => a.cp - b.cp);
  for (let i = 1; i < list.length; i++) {
    if (list[i].cp === list[i - 1].cp) throw new Error(`字型裡有重複的字 U+${list[i].cp.toString(16)}`);
  }
  const packed = list.map((g) => pack4(g.alpha, g.w, g.h));
  const bitmapOffset = HEADER + ENTRY * list.length;
  const total = bitmapOffset + packed.reduce((s, p) => s + p.length, 0);
  const out = new Uint8Array(total);
  const dv = new DataView(out.buffer);

  for (let i = 0; i < 4; i++) out[i] = FONT_MAGIC.charCodeAt(i);
  dv.setUint16(4, px, true);
  dv.setUint16(6, lineHeight, true);
  dv.setUint16(8, ascent, true);
  dv.setUint16(10, list.length, true);
  dv.setUint32(12, bitmapOffset, true);

  let off = 0;
  list.forEach((g, i) => {
    const e = HEADER + ENTRY * i;
    dv.setUint32(e, g.cp, true);
    dv.setUint32(e + 4, off, true);
    dv.setUint8(e + 8, g.w);
    dv.setUint8(e + 9, g.h);
    dv.setInt8(e + 10, g.xoff);
    dv.setInt8(e + 11, g.yoff);
    dv.setUint8(e + 12, g.adv);
    out.set(packed[i], bitmapOffset + off);
    off += packed[i].length;
  });
  return out;
}

// 每點 4 bit、每列補滿整數 byte、高 4 位元在前
function pack4(alpha, w, h) {
  const row = Math.ceil(w / 2);
  const out = new Uint8Array(row * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const v = alpha[y * w + x] >> 4;
      out[y * row + (x >> 1)] |= x & 1 ? v : v << 4;
    }
  }
  return out;
}

// 解析（測試與預覽用）。結構有問題直接丟錯，訊息寫清楚是哪裡壞。
export function parseFontBin(bytes) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const magic = String.fromCharCode(...bytes.slice(0, 4));
  if (magic !== FONT_MAGIC) throw new Error(`魔術字是 ${magic}，應該是 ${FONT_MAGIC}`);
  const px = dv.getUint16(4, true);
  const lineHeight = dv.getUint16(6, true);
  const ascent = dv.getUint16(8, true);
  const count = dv.getUint16(10, true);
  const bitmapOffset = dv.getUint32(12, true);
  if (bitmapOffset !== HEADER + ENTRY * count) throw new Error('bitmapOffset 與字數對不起來');

  const glyphs = [];
  let prev = -1;
  for (let i = 0; i < count; i++) {
    const e = HEADER + ENTRY * i;
    const g = {
      cp: dv.getUint32(e, true),
      off: dv.getUint32(e + 4, true),
      w: dv.getUint8(e + 8),
      h: dv.getUint8(e + 9),
      xoff: dv.getInt8(e + 10),
      yoff: dv.getInt8(e + 11),
      adv: dv.getUint8(e + 12),
    };
    if (g.cp <= prev) throw new Error(`字表沒有依 codepoint 排序（第 ${i} 個）`);
    prev = g.cp;
    const size = Math.ceil(g.w / 2) * g.h;
    if (bitmapOffset + g.off + size > bytes.length) throw new Error(`U+${g.cp.toString(16)} 的點陣超出檔案`);
    g.bitmap = bytes.subarray(bitmapOffset + g.off, bitmapOffset + g.off + size);
    glyphs.push(g);
  }
  return { px, lineHeight, ascent, count, bitmapOffset, glyphs };
}

// 取某個字某一點的 4-bit 值（測試用）
export function glyphPixel(g, x, y) {
  const b = g.bitmap[y * Math.ceil(g.w / 2) + (x >> 1)];
  return x & 1 ? b & 0x0f : b >> 4;
}
