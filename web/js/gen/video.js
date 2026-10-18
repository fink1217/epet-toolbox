// 影片 → 動畫格：用 <video> 跳到每個時間點、畫到畫布上。瀏覽器播得動的格式都能用（MP4 H.264 最保險）。
import { makeCanvas, ctx2d } from '../lib/img.js';

const SIDE = 960;               // 每格長邊上限：戲台螢幕很小，再大只是吃記憶體
const CELL = 192;               // 總覽圖每格的長邊
const GAP = 6;
export const MAX_FRAMES = 60;   // 一個動作最多幾格

export const isVideo = (f) => f.type.startsWith('video/') || /\.(mp4|m4v|mov|webm)$/i.test(f.name);

// 等某個事件；影片出錯就算失敗。兩個監聽器用完一起拆掉。
function once(el, ok) {
  const ac = new AbortController();
  return new Promise((resolve, reject) => {
    el.addEventListener(ok, resolve, { signal: ac.signal });
    el.addEventListener('error', () => reject(new Error('影片讀不出來')), { signal: ac.signal });
  }).finally(() => ac.abort());
}

// 打開影片檔。瀏覽器不支援的編碼（例如 iPhone 錄的 HEVC）會丟錯。
export async function openVideo(file) {
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';
  video.controls = true;
  video.src = URL.createObjectURL(file);
  try {
    await once(video, 'loadeddata');
    if (!video.videoWidth || !Number.isFinite(video.duration)) throw new Error('影片讀不出來');
  } catch (e) {
    URL.revokeObjectURL(video.src);
    throw e;
  }
  return video;
}

// 這一段會取幾格（還沒套上限）
export const frameCount = (start, end, fps) => Math.max(1, Math.ceil((end - start) * fps - 1e-6));

// 要取的時間點：從 start 開始每 1/fps 秒一格，最多 MAX_FRAMES 格
export const frameTimes = (start, end, fps) =>
  Array.from({ length: Math.min(MAX_FRAMES, frameCount(start, end, fps)) }, (_, i) => start + i / fps);

// 多跳 1ms：Chrome 把時間截到微秒，剛好落在影格邊界時會拿到前一格
async function seek(video, t) {
  const done = once(video, 'seeked');
  video.currentTime = Math.min(t + 0.001, video.duration - 0.001);
  await done;
}

// 依序跳到每個時間點，畫成長邊不超過 side 的 ImageData
export async function grab(video, times, { side = SIDE, onProgress } = {}) {
  video.pause();
  const k = Math.min(1, side / Math.max(video.videoWidth, video.videoHeight));
  const c = makeCanvas(video.videoWidth * k, video.videoHeight * k);
  const g = ctx2d(c);
  const out = [];
  for (const t of times) {
    await seek(video, t);
    g.drawImage(video, 0, 0, c.width, c.height);
    out.push(g.getImageData(0, 0, c.width, c.height));
    onProgress?.(out.length, times.length);
  }
  return out;
}

// 循環動作：找「最像開頭那一格」的時間點當結尾，播完接回開頭才不會跳。至少一秒（最少 4 格）。
export async function findLoopEnd(video, start, fps) {
  const thumbs = await grab(video, frameTimes(start, video.duration, fps), { side: 32 });
  const diff = (a, b) => {
    let s = 0;
    for (let i = 0; i < a.length; i += 4) s += Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]);
    return s;
  };
  let best = 0, bd = Infinity;
  for (let k = Math.max(4, Math.round(fps)); k < thumbs.length; k++) {
    const d = diff(thumbs[0].data, thumbs[k].data);
    if (d < bd) { bd = d; best = k; }
  }
  return best ? start + best / fps : null;
}

// 每格去背後的結果排成一張總覽圖，「去背、切格」那一步照常顯示、點框框挑格。
// 每格都整張當一格（不切）；pos 記住本體在影片裡的外框，對齊時整段影片一起移動，跳起來才會是跳起來。
export function contactSheet(results, w, h) {
  const k = CELL / Math.max(w, h);
  const cw = Math.round(w * k), ch = Math.round(h * k);
  const cols = Math.max(1, Math.min(results.length, Math.round(Math.sqrt((results.length * ch * 4) / (cw * 3)))));
  const rows = Math.ceil(results.length / cols);
  const image = makeCanvas(cols * (cw + GAP) - GAP, rows * (ch + GAP) - GAP);
  const g = ctx2d(image);
  const frames = [];
  results.forEach((r, i) => {
    const x = (i % cols) * (cw + GAP), y = Math.floor(i / cols) * (ch + GAP);
    g.drawImage(r.image, x, y, cw, ch);
    const f = r.frames[0];
    if (f) frames.push({ ...f, pos: f.src, src: { x0: x, y0: y, x1: x + cw - 1, y1: y + ch - 1 } });   // 沒有 f：整格都被當成背景
  });
  return { image, frames };
}
