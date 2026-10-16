// 打包器的純函式測試（node）：QOI、font.bin、MD5。
// 用法：
//   node tools/test-pack.mjs                       基本測試
//   node tools/test-pack.mjs --qoi <官方測試圖資料夾>  加測官方 QOI 圖：解碼→重新編碼要逐位元組相同
//   node tools/test-pack.mjs --e2e <結果.json>       驗證瀏覽器端到端測試（tools/test-pack.html）的輸出
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { encodeQOI, decodeQOI } from '../web/js/deploy/qoi.js';
import { buildFontBin, parseFontBin, glyphPixel } from '../web/js/deploy/fontbin.js';
import { md5 } from '../web/js/deploy/md5.js';

let pass = 0;
let fail = 0;
function check(name, ok, detail = '') {
  if (ok) pass++;
  else { fail++; console.error(`  ✗ ${name}${detail ? '：' + detail : ''}`); }
}
const hex = (b) => [...b].map((x) => x.toString(16).padStart(2, '0')).join(' ');
const same = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);

// 可重現的亂數
let seed = 12345;
const rand = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 2 ** 32);

// ── MD5 對照 node 內建 ──
for (const n of [0, 1, 3, 55, 56, 57, 63, 64, 65, 127, 128, 1000, 100003]) {
  const buf = Uint8Array.from({ length: n }, () => (rand() * 256) | 0);
  const want = createHash('md5').update(buf).digest('hex');
  check(`MD5 長度 ${n}`, md5(buf) === want, `${md5(buf)} ≠ ${want}`);
}

// ── QOI 已知小例子：1×1 紅點 ──
{
  const got = encodeQOI(Uint8Array.of(255, 0, 0, 255), 1, 1);
  const want = '71 6f 69 66 00 00 00 01 00 00 00 01 04 00 5a 00 00 00 00 00 00 00 01';
  check('QOI 1×1 紅點位元組', hex(got) === want, `\n    得到 ${hex(got)}\n    應為 ${want}`);
}

// ── QOI round-trip：各種刁鑽的圖 ──
function img(w, h, fn) {
  const d = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) d.set(fn(x, y), (y * w + x) * 4);
  return d;
}
const cases = {
  '全透明 7×5': [7, 5, img(7, 5, () => [0, 0, 0, 0])],
  '1×1 半透明': [1, 1, img(1, 1, () => [10, 200, 30, 128])],
  '漸層 64×33': [64, 33, img(64, 33, (x, y) => [x * 4, y * 7, (x + y) * 2, 255])],
  '透明漸層 40×40': [40, 40, img(40, 40, (x, y) => [200, 100, 50, (x * 6 + y) & 255])],
  '隨機雜訊 100×100': [100, 100, img(100, 100, () => [rand() * 256, rand() * 256, rand() * 256, rand() * 256].map((v) => v | 0))],
  '長連續同色 200×3（超過 62 的 run）': [200, 3, img(200, 3, (x, y) => (y === 1 ? [9, 9, 9, 255] : [0, 0, 0, 255]))],
  '寬高不同 300×2': [300, 2, img(300, 2, (x) => [x & 255, (x * 3) & 255, 7, x % 5 ? 255 : 0])],
  '小幅變化（DIFF/LUMA）': [50, 4, img(50, 4, (x, y) => [(100 + x * (y + 1)) & 255, (100 + x) & 255, (100 - x) & 255, 255])],
  '調色盤重複（INDEX）': [60, 6, img(60, 6, (x) => [[255, 0, 0, 255], [0, 255, 0, 255], [0, 0, 255, 128]][x % 3])],
};
for (const [name, [w, h, d]] of Object.entries(cases)) {
  const enc = encodeQOI(d, w, h);
  const dec = decodeQOI(enc);
  check(`QOI round-trip ${name}`, dec.width === w && dec.height === h && same(dec.data, d));
}

// ── 官方 QOI 測試圖：解碼後重新編碼，要跟官方檔逐位元組相同（通道數那個位元組除外）──
const qoiDir = process.argv.includes('--qoi') ? process.argv[process.argv.indexOf('--qoi') + 1] : null;
if (qoiDir) {
  for (const f of readdirSync(qoiDir).filter((n) => n.endsWith('.qoi'))) {
    const orig = new Uint8Array(readFileSync(join(qoiDir, f)));
    const dec = decodeQOI(orig);
    const re = encodeQOI(dec.data, dec.width, dec.height, orig[13]);
    re[12] = orig[12];   // 我們固定寫 4 通道；官方 RGB 圖的檔頭寫 3，其他位元組應完全相同
    check(`官方圖 ${f}（${dec.width}×${dec.height}，${orig.length} bytes）`, same(re, orig),
      `長度 ${re.length} vs ${orig.length}`);
  }
}

// ── font.bin：自己組、自己解析 ──
{
  const glyphs = [
    { cp: 0x570b, w: 3, h: 2, xoff: 1, yoff: -12, adv: 16, alpha: Uint8Array.of(255, 0, 128, 17, 34, 240) },
    { cp: 0x20, w: 0, h: 0, xoff: 0, yoff: 0, adv: 4, alpha: new Uint8Array(0) },
    { cp: 0x41, w: 2, h: 1, xoff: -1, yoff: -9, adv: 9, alpha: Uint8Array.of(16, 32) },
  ];
  const bin = buildFontBin({ px: 16, lineHeight: 23, ascent: 18, glyphs });
  const f = parseFontBin(bin);
  check('font.bin 檔頭', f.px === 16 && f.lineHeight === 23 && f.ascent === 18 && f.count === 3 && f.bitmapOffset === 16 + 48);
  check('font.bin 依 codepoint 排序', f.glyphs.map((g) => g.cp).join() === [0x20, 0x41, 0x570b].join());
  const g = f.glyphs[2];
  check('font.bin 有號位移', g.xoff === 1 && g.yoff === -12 && f.glyphs[1].xoff === -1);
  check('font.bin 4-bit 點陣', [glyphPixel(g, 0, 0), glyphPixel(g, 1, 0), glyphPixel(g, 2, 0), glyphPixel(g, 0, 1), glyphPixel(g, 1, 1), glyphPixel(g, 2, 1)].join() === '15,0,8,1,2,15');
  check('font.bin 總長度', bin.length === 16 + 48 + 0 + 1 + 4, `實際 ${bin.length}`);
  let threw = false;
  try { buildFontBin({ px: 16, lineHeight: 20, ascent: 16, glyphs: [glyphs[0], glyphs[0]] }); } catch { threw = true; }
  check('font.bin 重複字要報錯', threw);
}

// ── 瀏覽器端到端測試的結果 ──
const e2ePath = process.argv.includes('--e2e') ? process.argv[process.argv.indexOf('--e2e') + 1] : null;
if (e2ePath) {
  const r = JSON.parse(readFileSync(e2ePath, 'utf8'));
  check('瀏覽器端：沒有錯誤', !r.error, r.error);
  for (const c of r.checks || []) check(`瀏覽器端：${c.name}`, c.ok, c.detail);
  for (const [path, b64] of Object.entries(r.fonts || {})) {
    const bin = new Uint8Array(Buffer.from(b64, 'base64'));
    try {
      const f = parseFontBin(bin);
      const cps = new Set(f.glyphs.map((g) => g.cp));
      const need = [...'餵食玩耍睡覺狀態設定小黃早安！'].map((c) => c.codePointAt(0));
      check(`${path} 解析（${f.count} 字、${bin.length} bytes、${f.px}px）`, true);
      check(`${path} 包含介面用字`, need.every((cp) => cps.has(cp)));
      const han = f.glyphs.find((g) => g.cp === 0x9935);   // 餵
      check(`${path}「餵」有點陣`, han && han.w > 0 && han.h > 0 && han.bitmap.some((b) => b), JSON.stringify(han && { w: han.w, h: han.h }));
      check(`${path} 空格只有前進距離`, f.glyphs.find((g) => g.cp === 0x20)?.w === 0);
      if (r.fontPreview) console.log(r.fontPreview);
    } catch (e) {
      check(`${path} 解析`, false, e.message);
    }
  }
}

console.log(`\n${fail ? '✗' : '✓'} 打包器測試：${pass} 通過、${fail} 失敗`);
process.exit(fail ? 1 : 0);
