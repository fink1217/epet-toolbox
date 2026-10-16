// 組合圖：把主板、小電路板、模組擺在同一張圖上，再用電線連起來。
const FONT = "font-family=\"'Noto Sans TC', system-ui, sans-serif\"";

export function svgDoc(w, h, inner, label = '') {
  return `<svg viewBox="0 0 ${Math.ceil(w)} ${Math.ceil(h)}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${label}">${inner}</svg>`;
}

// 把一個圖層（{ svg }）放到 (x, y)，回傳 svg 字串與換算座標的函式
export function place(layer, x, y, scale = 1) {
  const tf = `translate(${x} ${y})${scale !== 1 ? ` scale(${scale})` : ''}`;
  return {
    svg: `<g transform="${tf}">${layer.svg}</g>`,
    // 圖層的標籤（如果有）要最後才疊上去
    labels: layer.labels ? `<g transform="${tf}">${layer.labels}</g>` : '',
    at: (px, py) => [x + px * scale, y + py * scale],
  };
}

// 圓角折線
export function roundedPath(points, r = 12) {
  const pts = points.filter((p, i) => i === 0 || p[0] !== points[i - 1][0] || p[1] !== points[i - 1][1]);
  let d = `M ${pts[0][0]} ${pts[0][1]}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i - 1];
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[i + 1];
    const d1 = Math.hypot(x1 - x0, y1 - y0);
    const d2 = Math.hypot(x2 - x1, y2 - y1);
    const rr = Math.min(r, d1 / 2, d2 / 2);
    d += ` L ${x1 - ((x1 - x0) / d1) * rr} ${y1 - ((y1 - y0) / d1) * rr}`;
    d += ` Q ${x1} ${y1} ${x1 + ((x2 - x1) / d2) * rr} ${y1 + ((y2 - y1) / d2) * rr}`;
  }
  const last = pts[pts.length - 1];
  return `${d} L ${last[0]} ${last[1]}`;
}

// 軟電線：從 a 沿 adir 出發，沿 bdir 的反方向進入 b
export function curvePath(a, adir, b, bdir, k = 80) {
  const c1 = [a[0] + adir[0] * k, a[1] + adir[1] * k];
  const c2 = [b[0] + bdir[0] * k, b[1] + bdir[1] * k];
  return `M ${a[0]} ${a[1]} C ${c1[0]} ${c1[1]}, ${c2[0]} ${c2[1]}, ${b[0]} ${b[1]}`;
}

// 一條線：陰影＋白邊＋顏色，終點一顆焊點
export function wire(d, color, { glow = false, end = null } = {}) {
  return `<g class="wire">
    ${glow ? `<path d="${d}" fill="none" stroke="#FFB020" stroke-opacity=".4" stroke-width="18" stroke-linecap="round" stroke-linejoin="round"/>` : ''}
    <path d="${d}" fill="none" stroke="#000" stroke-opacity=".18" stroke-width="9.5" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="${d}" fill="none" stroke="#FFFFFF" stroke-width="7.6" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="${d}" fill="none" stroke="${color}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
    ${end ? `<circle cx="${end[0]}" cy="${end[1]}" r="5.5" fill="${color}" stroke="#FFFFFF" stroke-width="2"/>` : ''}
  </g>`;
}

// 標籤小牌子
export function label(x, y, text, { color = '#1E1F22', fill = '#FFFFFF', size = 11.5, anchor = 'middle' } = {}) {
  const w = [...text].reduce((s, ch) => s + (ch.charCodeAt(0) > 255 ? size : size * 0.6), 0) + 14;
  const h = size + 9;
  const x0 = anchor === 'start' ? x : anchor === 'end' ? x - w : x - w / 2;
  return `<g>
    <rect x="${x0}" y="${y - h / 2}" width="${w}" height="${h}" rx="${h / 2}" fill="${fill}" stroke="${color}" stroke-width="1.6"/>
    <text x="${x0 + w / 2}" y="${y + size * 0.36}" text-anchor="middle" font-size="${size}" font-weight="700" fill="${color}" ${FONT}>${text}</text>
  </g>`;
}

// 一般文字
export function text(x, y, s, { size = 13, color = '#4A4D55', anchor = 'middle', weight = 400 } = {}) {
  return `<text x="${x}" y="${y}" text-anchor="${anchor}" font-size="${size}" font-weight="${weight}" fill="${color}" ${FONT}>${s}</text>`;
}
