// 產生點陣字型：只收「用得到的字」，用網頁字型 Noto Sans TC 在 canvas 上一個字一個字畫出來。
// 用網頁字型（不是電腦內建字型），在誰的電腦上打包，畫出來都一模一樣。
import { buildFontBin } from './fontbin.js';
import { fontsReady } from '../core.js';

export const FONT_FAMILY = '"Noto Sans TC"';
const WEIGHT = 500;

// 介面常用的標點符號與符號，就算文字裡還沒用到也先收進來
const EXTRA = '，。、！？：；「」『』（）《》〈〉【】…—～·％＋－×÷＝＜＞♥★☆♪○●△▲▽▼←→↑↓';

// 從文字物件裡（任意深度的物件、陣列、字串）收集所有字
export function collectChars(texts) {
  const set = new Set();
  const walk = (v) => {
    if (typeof v === 'string') for (const ch of v) set.add(ch.codePointAt(0));
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') Object.values(v).forEach(walk);
  };
  walk(texts);
  for (let cp = 0x20; cp <= 0x7e; cp++) set.add(cp);
  for (const ch of EXTRA) set.add(ch.codePointAt(0));
  // 換行、tab 之類的控制字元不畫
  return [...set].filter((cp) => cp >= 0x20 && !(cp >= 0x7f && cp < 0xa0)).sort((a, b) => a - b);
}

// 確保網頁字型「用到的那幾片」都下載完（Google Fonts 會把中文字型切成很多片）
export async function ensureFontLoaded(px, codepoints) {
  await fontsReady;
  // 字型樣式表沒載到（連不到 Google）：document.fonts.check 對不存在的字型會回 true，
  // 所以要自己判斷，把全部字都當成缺字，打包報告才會提醒「用替代字型畫」。
  const registered = [...document.fonts].some((f) => f.family.replace(/["']/g, '') === 'Noto Sans TC');
  if (!registered) return [...codepoints];
  const text = String.fromCodePoint(...codepoints);
  await document.fonts.load(`${WEIGHT} ${px}px ${FONT_FAMILY}`, text);
  await document.fonts.ready;
  return codepoints.filter((cp) => !document.fonts.check(`${WEIGHT} ${px}px ${FONT_FAMILY}`, String.fromCodePoint(cp)));
}

// 畫出每個字 → font.bin 位元組
export async function renderFont(codepoints, px) {
  const missing = await ensureFontLoaded(px, codepoints);
  const size = px * 3;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const g = canvas.getContext('2d', { willReadFrequently: true });
  g.font = `${WEIGHT} ${px}px ${FONT_FAMILY}`;
  g.textBaseline = 'alphabetic';
  g.fillStyle = '#000';

  const ref = g.measureText('國Ag');
  const ascent = Math.round(ref.fontBoundingBoxAscent ?? px * 1.16);
  const descent = Math.round(ref.fontBoundingBoxDescent ?? px * 0.29);
  const ox = px;            // 畫筆起點
  const oy = px * 2;        // 基線

  const glyphs = [];
  for (const cp of codepoints) {
    const ch = String.fromCodePoint(cp);
    g.clearRect(0, 0, size, size);
    g.fillText(ch, ox, oy);
    const adv = Math.min(255, Math.max(0, Math.round(g.measureText(ch).width)));
    const d = g.getImageData(0, 0, size, size).data;
    let x0 = size, y0 = size, x1 = -1, y1 = -1;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if (d[(y * size + x) * 4 + 3] >= 16) {   // 低於 1/16 的淡邊在 4-bit 裡本來就是 0
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
          if (y < y0) y0 = y;
          if (y > y1) y1 = y;
        }
      }
    }
    if (x1 < 0) {   // 空白字（例如空格）：只有前進距離
      glyphs.push({ cp, w: 0, h: 0, xoff: 0, yoff: 0, adv, alpha: new Uint8Array(0) });
      continue;
    }
    const w = x1 - x0 + 1;
    const h = y1 - y0 + 1;
    const alpha = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) alpha[y * w + x] = d[((y0 + y) * size + x0 + x) * 4 + 3];
    }
    glyphs.push({ cp, w, h, xoff: x0 - ox, yoff: y0 - oy, adv, alpha });
  }

  const bytes = buildFontBin({ px, lineHeight: ascent + descent, ascent, glyphs });
  return { bytes, glyphCount: glyphs.length, missing };
}
