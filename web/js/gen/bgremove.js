// 去背：純函式，輸入輸出都是 RGBA 位元組陣列。主執行緒、worker、測試頁共用。
//
// 做法就像從圖片四邊倒油漆：
// 1. 取樣四邊，最常見的顏色就是背景色。
// 2. 從四邊往內擴散，顏色跟背景差不多的就塗掉（變透明），碰到角色的輪廓就停。
// 3. 被塗掉區域旁邊幾圈的像素是「一半背景一半角色」：依色差給半透明，並把混進去的背景色減掉（去色溢）。

// 人眼對綠色最敏感，所以綠色的差距權重最大；結果落在 0–255
const WR = 2, WG = 4, WB = 3;
export function colorDist(r, g, b, c) {
  const dr = r - c[0], dg = g - c[1], db = b - c[2];
  return Math.sqrt((WR * dr * dr + WG * dg * dg + WB * db * db) / 9);
}

// 四邊取樣，找出最常見的顏色。邊緣大多已經透明 → 這張圖本來就去好背了
export function detectBackground(data, w, h) {
  const buckets = new Map();
  let transparent = 0, total = 0;
  const add = (x, y) => {
    const i = (y * w + x) * 4;
    total++;
    if (data[i + 3] < 16) { transparent++; return; }
    const k = ((data[i] >> 3) << 10) | ((data[i + 1] >> 3) << 5) | (data[i + 2] >> 3);
    let b = buckets.get(k);
    if (!b) buckets.set(k, (b = { n: 0, r: 0, g: 0, b: 0 }));
    b.n++; b.r += data[i]; b.g += data[i + 1]; b.b += data[i + 2];
  };
  for (let x = 0; x < w; x++) { add(x, 0); add(x, h - 1); }
  for (let y = 1; y < h - 1; y++) { add(0, y); add(w - 1, y); }
  if (transparent * 2 > total) return { transparent: true, color: null, share: transparent / total };
  let best = null;
  for (const b of buckets.values()) if (!best || b.n > best.n) best = b;
  return { transparent: false, color: [best.r / best.n, best.g / best.n, best.b / best.n], share: best.n / total };
}

// 容許度（0–100）→ 「一定是背景」與「可能是邊緣」兩個門檻
export function thresholds(tolerance) {
  const hard = tolerance * 1.5;
  return { hard, soft: hard + Math.max(16, hard * 0.9) };
}

/**
 * 去背。
 * @param {Uint8ClampedArray} src 原圖 RGBA（不會被修改）
 * @param {object} opts tolerance 容許度 0–100；global 整張同色都去掉；wand 魔術棒點過的位置 [{x,y}]
 * @returns {{ data: Uint8ClampedArray, bg: number[]|null, transparentBg: boolean, removed: number }}
 */
export function removeBackground(src, w, h, { tolerance = 30, global = false, wand = [] } = {}) {
  const n = w * h;
  const out = new Uint8ClampedArray(src);
  const bg = detectBackground(src, w, h);
  const { hard, soft } = thresholds(tolerance);
  const removed = new Uint8Array(n);      // 0 = 保留；k = 被第 k 個參考色塗掉
  const refs = [null];
  const queue = new Int32Array(n);

  const near = (p, ref) => src[p * 4 + 3] < 16 || colorDist(src[p * 4], src[p * 4 + 1], src[p * 4 + 2], ref) <= hard;

  // 從種子往外塗（上下左右四個方向），色差在 hard 以內才塗
  function fill(seeds, ref, k) {
    let head = 0, tail = 0;
    const push = (p) => {
      if (!removed[p] && near(p, ref)) { removed[p] = k; queue[tail++] = p; }
    };
    for (const p of seeds) push(p);
    while (head < tail) {
      const p = queue[head++];
      const x = p % w;
      if (x > 0) push(p - 1);
      if (x < w - 1) push(p + 1);
      if (p >= w) push(p - w);
      if (p < n - w) push(p + w);
    }
  }

  if (!bg.transparent) {
    refs.push(bg.color);
    if (global) {
      for (let p = 0; p < n; p++) if (near(p, bg.color)) removed[p] = 1;
    } else {
      const seeds = [];
      for (let x = 0; x < w; x++) seeds.push(x, (h - 1) * w + x);
      for (let y = 1; y < h - 1; y++) seeds.push(y * w, y * w + w - 1);
      fill(seeds, bg.color, 1);
    }
  }

  // 魔術棒：以點到的那一點顏色為準，塗掉跟它連在一起、顏色相近的區塊
  for (const pt of wand) {
    if (refs.length >= 255) break;
    const x = Math.round(pt.x), y = Math.round(pt.y);
    if (x < 0 || y < 0 || x >= w || y >= h) continue;
    const p = y * w + x;
    const ref = [src[p * 4], src[p * 4 + 1], src[p * 4 + 2]];
    refs.push(ref);
    fill([p], ref, refs.length - 1);
  }

  // 邊帶：塗掉區域外圍 r 圈，記住旁邊是被哪個參考色塗掉的
  const r = Math.max(2, Math.round(Math.min(w, h) / 600));
  const band = new Uint8Array(n);
  let frontier = [];
  for (let p = 0; p < n; p++) {
    if (!removed[p]) continue;
    const x = p % w, y = (p - x) / w;
    for (let dy = -1; dy <= 1; dy++) {
      const yy = y + dy;
      if (yy < 0 || yy >= h) continue;
      for (let dx = -1; dx <= 1; dx++) {
        const xx = x + dx;
        if (xx < 0 || xx >= w) continue;
        const q = yy * w + xx;
        if (!removed[q] && !band[q]) { band[q] = removed[p]; frontier.push(q); }
      }
    }
  }
  const bandPixels = frontier.slice();
  for (let layer = 1; layer < r; layer++) {
    const next = [];
    for (const p of frontier) {
      const x = p % w, y = (p - x) / w;
      for (let dy = -1; dy <= 1; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= h) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx;
          if (xx < 0 || xx >= w) continue;
          const q = yy * w + xx;
          if (!removed[q] && !band[q]) { band[q] = band[p]; next.push(q); }
        }
      }
    }
    for (const q of next) bandPixels.push(q);
    frontier = next;
  }

  // 塗掉的：全透明
  let count = 0;
  for (let p = 0; p < n; p++) {
    if (!removed[p]) continue;
    const i = p * 4;
    out[i] = out[i + 1] = out[i + 2] = out[i + 3] = 0;
    count++;
  }

  // 邊帶：依色差給半透明，並減掉混進來的背景色
  for (const p of bandPixels) {
    const ref = refs[band[p]];
    if (!ref) continue;
    const i = p * 4;
    const d = colorDist(src[i], src[i + 1], src[i + 2], ref);
    if (d >= soft) continue;
    const a = d <= hard ? 0 : (d - hard) / (soft - hard);
    if (a <= 0) { out[i] = out[i + 1] = out[i + 2] = out[i + 3] = 0; continue; }
    for (let c = 0; c < 3; c++) out[i + c] = (src[i + c] - (1 - a) * ref[c]) / a;
    out[i + 3] = a * src[i + 3];
  }

  return { data: out, bg: bg.color, transparentBg: bg.transparent, removed: count };
}
