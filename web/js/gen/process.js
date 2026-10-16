// 載入圖片並交給背景執行緒去背、切幀。
import { loadBitmap, makeCanvas, ctx2d, resize } from '../lib/img.js';

const MAX_SIDE = 3000;   // 再大的圖先縮到這個長邊，處理才不會慢到像當機

// 任何圖片來源 → { canvas, data(ImageData), name, scaled }
export async function loadSource(file) {
  const bmp = await loadBitmap(file);
  let canvas = makeCanvas(bmp.width, bmp.height);
  ctx2d(canvas).drawImage(bmp, 0, 0);
  let scaled = false;
  const long = Math.max(bmp.width, bmp.height);
  if (long > MAX_SIDE) {
    const k = MAX_SIDE / long;
    canvas = resize(canvas, bmp.width * k, bmp.height * k);
    scaled = true;
  }
  const data = ctx2d(canvas).getImageData(0, 0, canvas.width, canvas.height);
  return { canvas, data, name: file.name || '貼上的圖片', scaled };
}

let worker = null;
let seq = 0;
const waiting = new Map();

function getWorker() {
  if (worker) return worker;
  worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
  worker.onmessage = (e) => {
    const job = waiting.get(e.data.id);
    if (!job) return;
    waiting.delete(e.data.id);
    if (e.data.ok) job.resolve(e.data);
    else job.reject(new Error(e.data.error));
  };
  worker.onerror = (e) => {
    for (const job of waiting.values()) job.reject(new Error(e.message || '背景處理失敗'));
    waiting.clear();
    worker = null;
  };
  return worker;
}

// 去背＋切幀。回傳 { image: canvas(去背後整張), frames: [{ canvas, w, h, core, src }], bg, ms }
export function processImage(imageData, opts) {
  const id = ++seq;
  const copy = imageData.data.slice().buffer;
  return new Promise((resolve, reject) => {
    waiting.set(id, { resolve, reject });
    getWorker().postMessage({ id, w: imageData.width, h: imageData.height, data: copy, opts }, [copy]);
  }).then((r) => ({
    image: toCanvas(r.data, r.w, r.h),
    frames: r.frames.map((f) => ({ w: f.w, h: f.h, core: f.core, src: f.src, canvas: toCanvas(f.rgba, f.w, f.h) })),
    bg: r.bg,
    transparentBg: r.transparentBg,
    ms: r.ms,
  }));
}

function toCanvas(buffer, w, h) {
  const c = makeCanvas(w, h);
  ctx2d(c).putImageData(new ImageData(new Uint8ClampedArray(buffer), w, h), 0, 0);
  return c;
}
