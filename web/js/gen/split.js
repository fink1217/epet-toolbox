// 切幀：去背後把一張圖裡的好幾個角色切開。純函式，worker 與測試頁共用。
//
// 1. 把不透明像素依「連在一起」分成區塊（連通區塊標記）。
// 2. 大區塊 = 一幀；小碎片（星星、汗滴）併到最近的大區塊；極小的雜點直接丟掉。
// 3. 依閱讀順序排：先上後下、同一列先左後右。

const SOLID = 96;   // 夠不透明才算「本體」，避免半透明光暈把兩個角色黏在一起

export function labelComponents(data, w, h, thr = SOLID) {
  const n = w * h;
  const labels = new Int32Array(n);
  const comps = [];
  const stack = new Int32Array(n);
  for (let p = 0; p < n; p++) {
    if (labels[p] || data[p * 4 + 3] <= thr) continue;
    const id = comps.length + 1;
    let sp = 0;
    stack[sp++] = p;
    labels[p] = id;
    let x0 = w, y0 = h, x1 = -1, y1 = -1, area = 0;
    while (sp) {
      const q = stack[--sp];
      const x = q % w, y = (q - x) / w;
      area++;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
      for (let dy = -1; dy <= 1; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= h) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx;
          if (xx < 0 || xx >= w) continue;
          const r = yy * w + xx;
          if (!labels[r] && data[r * 4 + 3] > thr) { labels[r] = id; stack[sp++] = r; }
        }
      }
    }
    comps.push({ id, area, x0, y0, x1, y1 });
  }
  return { labels, comps };
}

// 依閱讀順序排：中心點落在同一個高度範圍的算同一列
function readingOrder(frames) {
  const sorted = [...frames].sort((a, b) => a.y0 + a.y1 - (b.y0 + b.y1));
  const rows = [];
  for (const f of sorted) {
    const cy = (f.y0 + f.y1) / 2;
    const row = rows.find((r) => cy >= r.y0 && cy <= r.y1);
    if (row) {
      row.items.push(f);
      row.y0 = Math.min(row.y0, f.y0);
      row.y1 = Math.max(row.y1, f.y1);
    } else {
      rows.push({ y0: f.y0, y1: f.y1, items: [f] });
    }
  }
  rows.sort((a, b) => a.y0 - b.y0);
  return rows.flatMap((r) => r.items.sort((a, b) => a.x0 - b.x0));
}

const gap2 = (a, b) => {
  const dx = Math.max(0, a.x0 - b.x1, b.x0 - a.x1);
  const dy = Math.max(0, a.y0 - b.y1, b.y0 - a.y1);
  return dx * dx + dy * dy;
};

/**
 * 把區塊分成幀。
 * @param comps labelComponents 的結果
 * @param opts minRatio 面積達最大區塊的這個比例才算一幀；speckRatio 小於這個比例的雜點丟掉；single 整張當一幀
 * @returns [{ ids, x0, y0, x1, y1 }] 依閱讀順序
 */
export function groupFrames(comps, { minRatio = 0.06, speckRatio = 0.002, single = false } = {}) {
  if (!comps.length) return [];
  let maxArea = 0;
  for (const c of comps) if (c.area > maxArea) maxArea = c.area;
  const keep = comps.filter((c) => c.area >= Math.max(6, maxArea * speckRatio));
  const big = keep.filter((c) => c.area >= maxArea * minRatio);
  const small = keep.filter((c) => c.area < maxArea * minRatio);

  const box = (cs) => ({
    ids: cs.map((c) => c.id),
    x0: Math.min(...cs.map((c) => c.x0)), y0: Math.min(...cs.map((c) => c.y0)),
    x1: Math.max(...cs.map((c) => c.x1)), y1: Math.max(...cs.map((c) => c.y1)),
  });
  if (single) return [box(keep)];

  // 小碎片併到「離它最近的大區塊本體」
  const members = big.map((c) => [c]);
  for (const s of small) {
    let best = 0, bd = Infinity;
    big.forEach((c, k) => {
      const d = gap2(c, s);
      if (d < bd) { bd = d; best = k; }
    });
    members[best].push(s);
  }
  return readingOrder(members.map(box));
}

/**
 * 取出一幀的像素：外框外加 pad 圈半透明光暈；屬於別幀或被丟掉的雜點不取。
 * core 是本體外框（相對於取出來的圖），對齊腳底時用它，不受光暈影響。
 */
export function extractFrame(data, w, h, labels, frame, pad = 3) {
  let maxLabel = 0;
  for (const id of frame.ids) if (id > maxLabel) maxLabel = id;
  const own = new Uint8Array(maxLabel + 1);
  for (const id of frame.ids) own[id] = 1;
  const isOwn = (lab) => lab <= maxLabel && own[lab] === 1;

  const x0 = Math.max(0, frame.x0 - pad), y0 = Math.max(0, frame.y0 - pad);
  const x1 = Math.min(w - 1, frame.x1 + pad), y1 = Math.min(h - 1, frame.y1 + pad);
  const fw = x1 - x0 + 1, fh = y1 - y0 + 1;
  const out = new Uint8ClampedArray(fw * fh * 4);

  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const p = y * w + x;
      const i = p * 4;
      if (data[i + 3] === 0) continue;
      const lab = labels[p];
      if (lab) {
        if (!isOwn(lab)) continue;
      } else {
        // 半透明光暈：旁邊緊貼著別人的本體就不要
        let foreign = false;
        for (let dy = -1; dy <= 1 && !foreign; dy++) {
          const yy = y + dy;
          if (yy < 0 || yy >= h) continue;
          for (let dx = -1; dx <= 1; dx++) {
            const xx = x + dx;
            if (xx < 0 || xx >= w) continue;
            const l = labels[yy * w + xx];
            if (l && !isOwn(l)) { foreign = true; break; }
          }
        }
        if (foreign) continue;
      }
      const o = ((y - y0) * fw + (x - x0)) * 4;
      out[o] = data[i];
      out[o + 1] = data[i + 1];
      out[o + 2] = data[i + 2];
      out[o + 3] = data[i + 3];
    }
  }
  return {
    rgba: out,
    w: fw,
    h: fh,
    core: { x: frame.x0 - x0, y: frame.y0 - y0, w: frame.x1 - frame.x0 + 1, h: frame.y1 - frame.y0 + 1 },
    src: { x0: frame.x0, y0: frame.y0, x1: frame.x1, y1: frame.y1 },
  };
}

// 一次做完：標記 → 分幀 → 取像素
export function splitImage(data, w, h, opts = {}) {
  const { labels, comps } = labelComponents(data, w, h);
  return groupFrames(comps, opts).map((f) => extractFrame(data, w, h, labels, f));
}
