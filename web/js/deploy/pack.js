// 打包器：素材資料夾（readMaster 的結果）→ SD 卡上的 pet/ 目錄。規格：docs/SD卡格式-v1.md
//
// 分成兩段，彼此不知道對方：
//   buildPack：只算出「要寫哪些檔、內容是什麼」（Map<路徑, 位元組>），不碰檔案系統。
//   writePack / zipPack：把那份清單寫進 SD 卡，或包成 ZIP。
import { layoutFor, OUTPUT, MASTER, FORMAT_VERSION } from '../data/vocab.js';
import { makeCanvas, ctx2d, resize, cover, alphaBBox, crop, toBlob } from '../lib/img.js';
import { decodeToMono } from '../lib/audio.js';
import { encodeWav } from '../lib/wav.js';
import { removeEntry, writeFile } from '../lib/fs.js';
import { encodeQOI } from './qoi.js';
import { collectChars, renderFont } from './font.js';

export const GENERATOR = 'PENG! 0.1';
export const sizeDir = (s) => `${s.w}x${s.h}`;
const pad3 = (i) => String(i).padStart(3, '0');

const blobBytes = async (blob) => new Uint8Array(await blob.arrayBuffer());

function qoiOf(canvas) {
  const { width: w, height: h } = canvas;
  return encodeQOI(ctx2d(canvas).getImageData(0, 0, w, h).data, w, h);
}

// 裁掉透明邊；整張透明就給 1×1 透明點
function trimmed(canvas) {
  const box = alphaBBox(canvas, 0);
  if (!box) return { canvas: makeCanvas(1, 1), box: { x: 0, y: 0, w: 1, h: 1 }, empty: true };
  return { canvas: crop(canvas, box), box, empty: false };
}

// 背景：填滿裁切成剛好 w×h，再鋪到白底上（JPEG 沒有透明）
async function backgroundJPEG(bmp, s) {
  const out = makeCanvas(s.w, s.h);
  const g = ctx2d(out);
  g.fillStyle = '#fff';
  g.fillRect(0, 0, s.w, s.h);
  g.drawImage(cover(bmp, s.w, s.h), 0, 0);
  return blobBytes(await toBlob(out, 'image/jpeg', OUTPUT.jpegQuality));
}

// 動畫幀：母檔畫布寬度對應 petBox，腳底 = 畫布 (寬/2, 高×984/1024)
function animFrame(bmp, petBox) {
  const scale = petBox / bmp.width;
  const W = Math.max(1, Math.round(bmp.width * scale));
  const H = Math.max(1, Math.round(bmp.height * scale));
  const resized = resize(bmp, W, H);
  const footX = Math.round(W / 2);
  const footY = Math.round((MASTER.character.baseline / MASTER.character.h) * H);
  const t = trimmed(resized);
  return {
    bytes: qoiOf(t.canvas),
    dx: t.empty ? 0 : t.box.x - footX,
    dy: t.empty ? 0 : t.box.y - footY,
    w: t.box.w,
    h: t.box.h,
  };
}

// 圖示、道具：等比例縮進 box×box 的正方形，再裁透明邊
function fitted(bmp, box) {
  const scale = box / Math.max(bmp.width, bmp.height);
  return qoiOf(trimmed(resize(bmp, bmp.width * scale, bmp.height * scale)).canvas);
}

// 母檔尺寸不對時提醒（還是照比例處理，不中斷）
function sizeWarning(bmp, expect, path) {
  if (bmp.width === expect.w && bmp.height === expect.h) return null;
  return `「${path}」是 ${bmp.width}×${bmp.height}，母檔應該是 ${expect.w}×${expect.h}（建議先用素材生成器整理）`;
}

// master：readMaster() 的回傳；screens：[{ w, h }]
// 回傳 { files: Map<'172x320/manifest.json', Uint8Array>, report }
export async function buildPack(master, screens, onProgress = () => {}) {
  const files = new Map();
  const warnings = [];
  const L = Object.fromEntries(screens.map((s) => [sizeDir(s), layoutFor(s.w, s.h)]));
  const manifests = Object.fromEntries(screens.map((s) => [sizeDir(s), {
    format: FORMAT_VERSION,
    generator: GENERATOR,
    screen: { w: s.w, h: s.h },
    anchor: L[sizeDir(s)].anchor,
    backgrounds: {},
    anims: {},
    icons: {},
    items: {},
    sounds: {},
    font: { file: 'font.bin', px: L[sizeDir(s)].fontPx },
  }]));

  const fontPxs = [...new Set(screens.map((s) => L[sizeDir(s)].fontPx))];
  const total = master.backgrounds.length + master.anims.reduce((n, a) => n + a.frames.length, 0)
    + master.icons.length + master.items.length + master.sounds.length + fontPxs.length + 1;
  let done = 0;
  const tick = (label) => onProgress(++done / total, label);

  // 同一張母檔只解碼一次，一次產生所有尺寸
  const eachScreen = async (file, fn) => {
    const bmp = await createImageBitmap(file);
    try {
      for (const s of screens) await fn(bmp, s, sizeDir(s), manifests[sizeDir(s)]);
    } finally {
      bmp.close();
    }
  };

  for (const bg of master.backgrounds) {
    await eachScreen(bg.file, async (bmp, s, dir, m) => {
      files.set(`${dir}/bg/${bg.id}.jpg`, await backgroundJPEG(bmp, s));
      m.backgrounds[bg.id] = `bg/${bg.id}.jpg`;
    });
    tick(`背景：${bg.zh}`);
  }

  for (const a of master.anims) {
    for (const m of Object.values(manifests)) m.anims[a.id] = { fps: a.fps, loop: a.loop, frames: [] };
    for (let i = 0; i < a.frames.length; i++) {
      const name = `anim/${a.id}/${pad3(i)}.qoi`;
      let warned = false;
      await eachScreen(a.frames[i], async (bmp, s, dir, m) => {
        if (!warned) { warned = true; const w = sizeWarning(bmp, MASTER.character, `角色/${a.zh}/${a.frames[i].name}`); if (w) warnings.push(w); }
        const f = animFrame(bmp, L[dir].petBox);
        files.set(`${dir}/${name}`, f.bytes);
        m.anims[a.id].frames.push({ file: name, dx: f.dx, dy: f.dy });
      });
      tick(`角色：${a.zh} 第 ${i + 1} 張`);
    }
  }

  for (const [list, key, folder, sizeKey] of [[master.icons, 'icons', 'icon', 'icon'], [master.items, 'items', 'item', 'item']]) {
    for (const it of list) {
      await eachScreen(it.file, async (bmp, s, dir, m) => {
        files.set(`${dir}/${folder}/${it.id}.qoi`, fitted(bmp, L[dir][sizeKey]));
        m[key][it.id] = { file: `${folder}/${it.id}.qoi` };
      });
      tick(`${folder === 'icon' ? '圖示' : '道具'}：${it.zh}`);
    }
  }

  for (const snd of master.sounds) {
    const samples = await decodeToMono(snd.file, OUTPUT.soundRate);
    files.set(`sfx/${snd.id}.wav`, encodeWav(samples, OUTPUT.soundRate));
    for (const m of Object.values(manifests)) m.sounds[snd.id] = `../sfx/${snd.id}.wav`;
    tick(`音效：${snd.zh}`);
  }

  // 文字與字型：字型只收 text.json 用到的字
  const texts = { format: FORMAT_VERSION, ...master.pet.texts };
  files.set('text.json', new TextEncoder().encode(JSON.stringify(texts, null, 2) + '\n'));
  tick('文字');
  const chars = collectChars(texts);
  const fontReport = {};
  for (const px of fontPxs) {
    const f = await renderFont(chars, px);
    for (const s of screens) if (L[sizeDir(s)].fontPx === px) files.set(`${sizeDir(s)}/font.bin`, f.bytes);
    fontReport[px] = { glyphs: f.glyphCount, bytes: f.bytes.length, missing: f.missing.length };
    if (f.missing.length) warnings.push(`字型裡缺 ${f.missing.length} 個字（會用替代字型畫）：${String.fromCodePoint(...f.missing.slice(0, 20))}`);
    tick(`字型 ${px}px`);
  }

  for (const [dir, m] of Object.entries(manifests)) {
    files.set(`${dir}/manifest.json`, new TextEncoder().encode(JSON.stringify(m, null, 2) + '\n'));
  }

  return { files, report: summarize(files, screens, fontReport, warnings) };
}

function summarize(files, screens, fontReport, warnings) {
  const bytesUnder = (prefix) => [...files].filter(([p]) => p.startsWith(prefix)).reduce((n, [, b]) => n + b.length, 0);
  const countUnder = (prefix) => [...files.keys()].filter((p) => p.startsWith(prefix)).length;
  return {
    fileCount: files.size,
    totalBytes: [...files.values()].reduce((n, b) => n + b.length, 0),
    screens: screens.map((s) => ({ dir: sizeDir(s), files: countUnder(`${sizeDir(s)}/`), bytes: bytesUnder(`${sizeDir(s)}/`) })),
    shared: { files: countUnder('sfx/') + 1, bytes: bytesUnder('sfx/') + bytesUnder('text.json') },
    font: fontReport,
    warnings,
  };
}

// 寫進 SD 卡：選到的資料夾若本身叫 pet 就直接寫，不然在裡面建 pet/
// 只刪 pet/ 底下我們管的東西：這次要寫的尺寸資料夾、sfx/
export async function writePack(sdHandle, files, screens, onProgress = () => {}) {
  const petDir = sdHandle.name === 'pet' ? sdHandle : await sdHandle.getDirectoryHandle('pet', { create: true });
  for (const s of screens) await removeEntry(petDir, sizeDir(s));
  await removeEntry(petDir, 'sfx');
  let i = 0;
  for (const [path, data] of files) {
    await writeFile(petDir, path, data);
    onProgress(++i / files.size, path);
  }
  return petDir;
}

// 不支援直接寫資料夾的瀏覽器：包成 ZIP 讓學員自己解壓到 SD 卡
const JSZIP_URL = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
function loadJSZip() {
  if (window.JSZip) return Promise.resolve(window.JSZip);
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = JSZIP_URL;
    s.onload = () => resolve(window.JSZip);
    s.onerror = () => reject(new Error('ZIP 工具載入失敗，請檢查網路'));
    document.head.append(s);
  });
}

export async function zipPack(files) {
  const JSZip = await loadJSZip();
  const zip = new JSZip();
  for (const [path, data] of files) zip.file(`pet/${path}`, data);
  return zip.generateAsync({ type: 'blob', compression: 'STORE' });
}
