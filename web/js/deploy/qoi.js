// QOI 圖片格式（https://qoiformat.org）：無損、支援透明、解碼極快，適合 ESP32。
// 純函式，不碰 DOM：瀏覽器與 node 測試都能用。編碼結果與官方參考實作逐位元組相同。

const OP_INDEX = 0x00;
const OP_DIFF = 0x40;
const OP_LUMA = 0x80;
const OP_RUN = 0xc0;
const OP_RGB = 0xfe;
const OP_RGBA = 0xff;
const MASK_2 = 0xc0;
const END = [0, 0, 0, 0, 0, 0, 0, 1];

const hash = (r, g, b, a) => (r * 3 + g * 5 + b * 7 + a * 11) % 64;
const wrap = (v) => ((v + 128) & 255) - 128;   // 跟 C 的 signed char 一樣繞回

// rgba：長度 w*h*4 的 RGBA（未預乘）位元組
export function encodeQOI(rgba, w, h, colorspace = 0) {
  if (rgba.length !== w * h * 4) throw new Error(`QOI：像素數量不符（${rgba.length} ≠ ${w}×${h}×4）`);
  const out = new Uint8Array(14 + w * h * 5 + END.length);   // 最壞情況
  const dv = new DataView(out.buffer);
  out.set([0x71, 0x6f, 0x69, 0x66], 0);   // "qoif"
  dv.setUint32(4, w);
  dv.setUint32(8, h);
  out[12] = 4;
  out[13] = colorspace;
  let p = 14;

  const index = new Uint8Array(64 * 4);
  let pr = 0, pg = 0, pb = 0, pa = 255;
  let run = 0;
  const last = rgba.length - 4;

  for (let i = 0; i <= last; i += 4) {
    const r = rgba[i], g = rgba[i + 1], b = rgba[i + 2], a = rgba[i + 3];
    if (r === pr && g === pg && b === pb && a === pa) {
      // 解碼器處理 RUN 時也會把像素放進索引表；編碼器跟著做，兩邊的索引表才會一致
      // （差別只在開頭就連續出現初始顏色 (0,0,0,255) 的情況，官方 edgecase.qoi 就是測這個）
      const k = hash(r, g, b, a) * 4;
      index[k] = r; index[k + 1] = g; index[k + 2] = b; index[k + 3] = a;
      run++;
      if (run === 62 || i === last) { out[p++] = OP_RUN | (run - 1); run = 0; }
      continue;
    }
    if (run > 0) { out[p++] = OP_RUN | (run - 1); run = 0; }

    const k = hash(r, g, b, a) * 4;
    if (index[k] === r && index[k + 1] === g && index[k + 2] === b && index[k + 3] === a) {
      out[p++] = OP_INDEX | (k >> 2);
    } else {
      index[k] = r; index[k + 1] = g; index[k + 2] = b; index[k + 3] = a;
      if (a === pa) {
        const vr = wrap(r - pr), vg = wrap(g - pg), vb = wrap(b - pb);
        const vgr = vr - vg, vgb = vb - vg;
        if (vr > -3 && vr < 2 && vg > -3 && vg < 2 && vb > -3 && vb < 2) {
          out[p++] = OP_DIFF | ((vr + 2) << 4) | ((vg + 2) << 2) | (vb + 2);
        } else if (vgr > -9 && vgr < 8 && vg > -33 && vg < 32 && vgb > -9 && vgb < 8) {
          out[p++] = OP_LUMA | (vg + 32);
          out[p++] = ((vgr + 8) << 4) | (vgb + 8);
        } else {
          out[p++] = OP_RGB; out[p++] = r; out[p++] = g; out[p++] = b;
        }
      } else {
        out[p++] = OP_RGBA; out[p++] = r; out[p++] = g; out[p++] = b; out[p++] = a;
      }
    }
    pr = r; pg = g; pb = b; pa = a;
  }
  out.set(END, p);
  return out.slice(0, p + END.length);
}

// 解碼（測試用，也讓頁面能預覽 QOI）→ { width, height, channels, colorspace, data: RGBA }
export function decodeQOI(bytes) {
  if (bytes[0] !== 0x71 || bytes[1] !== 0x6f || bytes[2] !== 0x69 || bytes[3] !== 0x66) throw new Error('不是 QOI 檔');
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const width = dv.getUint32(4);
  const height = dv.getUint32(8);
  const channels = bytes[12];
  const colorspace = bytes[13];
  const data = new Uint8Array(width * height * 4);
  const index = new Uint8Array(64 * 4);
  let r = 0, g = 0, b = 0, a = 255;
  let p = 14;
  let run = 0;
  const chunksEnd = bytes.length - END.length;

  for (let o = 0; o < data.length; o += 4) {
    if (run > 0) {
      run--;
    } else if (p < chunksEnd) {
      const b1 = bytes[p++];
      if (b1 === OP_RGB) {
        r = bytes[p++]; g = bytes[p++]; b = bytes[p++];
      } else if (b1 === OP_RGBA) {
        r = bytes[p++]; g = bytes[p++]; b = bytes[p++]; a = bytes[p++];
      } else if ((b1 & MASK_2) === OP_INDEX) {
        const k = b1 * 4;
        r = index[k]; g = index[k + 1]; b = index[k + 2]; a = index[k + 3];
      } else if ((b1 & MASK_2) === OP_DIFF) {
        r = (r + ((b1 >> 4) & 3) - 2) & 255;
        g = (g + ((b1 >> 2) & 3) - 2) & 255;
        b = (b + (b1 & 3) - 2) & 255;
      } else if ((b1 & MASK_2) === OP_LUMA) {
        const b2 = bytes[p++];
        const vg = (b1 & 0x3f) - 32;
        r = (r + vg - 8 + ((b2 >> 4) & 0x0f)) & 255;
        g = (g + vg) & 255;
        b = (b + vg - 8 + (b2 & 0x0f)) & 255;
      } else if ((b1 & MASK_2) === OP_RUN) {
        run = b1 & 0x3f;
      }
      const k = hash(r, g, b, a) * 4;
      index[k] = r; index[k + 1] = g; index[k + 2] = b; index[k + 3] = a;
    }
    data[o] = r; data[o + 1] = g; data[o + 2] = b; data[o + 3] = a;
  }
  return { width, height, channels, colorspace, data };
}
