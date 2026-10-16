// 正規化：把同一個動作的每一幀放進 1024×1024 母檔畫布。
// 規則只有三條：同一個縮放比例、本體外框水平置中、本體底部（腳底）踩在基線上。
import { MASTER } from '../data/vocab.js';
import { makeCanvas, ctx2d, resize } from '../lib/img.js';

const C = MASTER.character;
export const CANVAS = C.w;                 // 1024
export const BASELINE = C.baseline;        // 984
export const MAX_H = BASELINE - 84;        // 最高的那幀 ≈ 900
export const MAX_W = C.w - 64;             // 左右各留 32

// 整個動作共用的縮放比例：最高（或最寬）的那一幀剛好塞滿，再乘上「大小」微調
export function sharedScale(frames, size = 1) {
  let mh = 1, mw = 1;
  for (const f of frames) {
    if (f.core.h > mh) mh = f.core.h;
    if (f.core.w > mw) mw = f.core.w;
  }
  return Math.min(MAX_H / mh, MAX_W / mw) * size;
}

// 這一幀（含光暈的整張小圖）要畫在母檔畫布的哪裡、多大；全部取整數，存出來才不會糊
export function placement(frame, scale, off = { dx: 0, dy: 0 }) {
  const w = Math.max(1, Math.round(frame.w * scale));
  const h = Math.max(1, Math.round(frame.h * scale));
  const sx = w / frame.w, sy = h / frame.h;
  const cx = (frame.core.x + frame.core.w / 2) * sx;
  const bottom = (frame.core.y + frame.core.h) * sy;
  return {
    x: Math.round(CANVAS / 2 - cx + (off.dx || 0)),
    y: Math.round(BASELINE - bottom + (off.dy || 0)),
    w,
    h,
  };
}

// 存檔用：高品質縮放後畫進 1024×1024 透明畫布
export function renderMaster(frameCanvas, frame, scale, off) {
  const p = placement(frame, scale, off);
  const scaled = p.w === frameCanvas.width && p.h === frameCanvas.height ? frameCanvas : resize(frameCanvas, p.w, p.h);
  const out = makeCanvas(CANVAS, CANVAS);
  ctx2d(out).drawImage(scaled, p.x, p.y);
  return out;
}

// 預覽用：直接畫到指定的 2D context（k = 預覽畫布 / 母檔畫布 的比例）
export function drawPreview(g, frameCanvas, frame, scale, off, k, alpha = 1) {
  const p = placement(frame, scale, off);
  g.globalAlpha = alpha;
  g.imageSmoothingQuality = 'high';
  g.drawImage(frameCanvas, p.x * k, p.y * k, p.w * k, p.h * k);
  g.globalAlpha = 1;
}
