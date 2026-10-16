// 圖片小工具：載入、找透明邊界、高品質縮放、裁切。生成器和打包器共用。

export async function loadBitmap(src) {
  if (src instanceof ImageBitmap) return src;
  if (typeof src === 'string') src = await (await fetch(src)).blob();
  return createImageBitmap(src);
}

export function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

export function ctx2d(canvas) {
  return canvas.getContext('2d', { willReadFrequently: true });
}

// 任何可畫的東西 → canvas
export function toCanvas(src) {
  const c = makeCanvas(src.width, src.height);
  ctx2d(c).drawImage(src, 0, 0);
  return c;
}

// 不透明像素的外框；整張透明回傳 null
export function alphaBBox(canvas, threshold = 8) {
  const { width: w, height: h } = canvas;
  const d = ctx2d(canvas).getImageData(0, 0, w, h).data;
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (d[(y * w + x) * 4 + 3] > threshold) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

export function crop(canvas, { x, y, w, h }) {
  const c = makeCanvas(w, h);
  ctx2d(c).drawImage(canvas, x, y, w, h, 0, 0, w, h);
  return c;
}

// 高品質縮小：每次最多縮一半，避免一次縮太多產生鋸齒
export function resize(src, w, h) {
  w = Math.max(1, Math.round(w));
  h = Math.max(1, Math.round(h));
  let cur = src;
  while (cur.width / 2 >= w && cur.height / 2 >= h) {
    const half = makeCanvas(cur.width / 2, cur.height / 2);
    const g = ctx2d(half);
    g.imageSmoothingQuality = 'high';
    g.drawImage(cur, 0, 0, half.width, half.height);
    cur = half;
  }
  const out = makeCanvas(w, h);
  const g = ctx2d(out);
  g.imageSmoothingQuality = 'high';
  g.drawImage(cur, 0, 0, w, h);
  return out;
}

// 「填滿」裁切：等比例放大到蓋滿目標，再依 focus（0~1）決定保留哪一段
export function coverRect(srcW, srcH, dstW, dstH, focusX = 0.5, focusY = 0.5) {
  const scale = Math.max(dstW / srcW, dstH / srcH);
  const sw = dstW / scale;
  const sh = dstH / scale;
  return { sx: (srcW - sw) * focusX, sy: (srcH - sh) * focusY, sw, sh };
}

// 用 coverRect 產生剛好 dstW×dstH 的圖
export function cover(src, dstW, dstH, focusX = 0.5, focusY = 0.5) {
  const r = coverRect(src.width, src.height, dstW, dstH, focusX, focusY);
  const cut = makeCanvas(r.sw, r.sh);
  ctx2d(cut).drawImage(src, r.sx, r.sy, r.sw, r.sh, 0, 0, cut.width, cut.height);
  return resize(cut, dstW, dstH);
}

export function toBlob(canvas, type = 'image/png', quality) {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}
