// 小電路板（洞洞板）的畫法：完全由 data/hub.js 產生，改資料插圖就跟著變。
// 座標：欄 A–N（x0–x13）、列 1–9（y0–y8）。背面是左右鏡像（翻過來看）。
import { HUB, HUB_NETS } from '../data/hub.js';
import { WIRES, included } from '../data/boards.js';
import { resistor, diode, to92, ecapTop, ccap, jumperWire } from './parts.js';
import { mirrorX } from './mirror.js';

export const P = 28;     // 孔距（像素）
export const M = 34;     // 邊界（放欄列標籤）
const FONT = "font-family=\"'Noto Sans TC', system-ui, sans-serif\"";
const YOLK = '#FFB020';

export const colName = (x) => String.fromCharCode(65 + x);
export const holeName = ([x, y]) => colName(x) + (y + 1);

// 「管路」＝電氣網路：每條管路的高光顏色（跟外接線同色系，看得出是哪一條）
export const NET_COLOR = {
  '3V3': WIRES['3V3'].color, GND: '#3A3D44', VBAT: WIRES.VBAT.color, IO6: WIRES.IO6.color,
  B: '#8E4EC6', C: '#C2410C', FSR: '#E0A100', IO7: WIRES.IO7.color, AUD: '#12A594',
};

// 零件腳／外部線落點 → 屬於哪條管路（來自 HUB_NETS，檢查程式已驗證過一致）
const MEMBER_NET = new Map(Object.entries(HUB_NETS).flatMap(([net, ms]) => ms.map((m) => [m, net])));

// 錫橋經過的每一個孔
function eachHole(path, fn) {
  for (let i = 1; i < path.length; i++) {
    const [a, b] = [path[i - 1], path[i]];
    const dx = Math.sign(b[0] - a[0]);
    const dy = Math.sign(b[1] - a[1]);
    for (let x = a[0], y = a[1]; ; x += dx, y += dy) {
      fn([x, y]);
      if (x === b[0] && y === b[1]) break;
    }
  }
}

export const HUB_W = M * 2 + HUB.cols * P;
export const HUB_H = M * 2 + HUB.rows * P;

// 外部線從孔往外拉的方向：朝最近的板邊
export function padDirection([x, y]) {
  const d = [
    ['top', y], ['left', x], ['right', HUB.cols - 1 - x], ['bottom', HUB.rows - 1 - y],
  ];
  d.sort((a, b) => a[1] - b[1]);
  return d[0][0];
}
const DIR_VEC = { top: [0, -1], bottom: [0, 1], left: [-1, 0], right: [1, 0] };

function tag(x, y, text, { fill = '#FFFFFF', color = '#1E1F22', stroke = '#1E1F22', size = 11 } = {}) {
  const w = text.length * size * 0.62 + 10;
  const hgt = size + 8;
  return `<g transform="translate(${x} ${y})">
    <rect x="${-w / 2}" y="${-hgt / 2}" width="${w}" height="${hgt}" rx="${hgt / 2}" fill="${fill}" stroke="${stroke}" stroke-width="1.3"/>
    <text x="0" y="${size * 0.36}" text-anchor="middle" font-size="${size}" font-weight="700" fill="${color}" ${FONT}>${text}</text>
  </g>`;
}

// 依步驟順序決定：之前的正常畫、這一步的高亮、之後的不畫
function stepper(order, current) {
  if (!order || !current) return { visible: () => true, isNew: () => false };
  const cur = order.indexOf(current);
  const idx = (s) => order.indexOf(s);
  return {
    visible: (s) => idx(s) !== -1 && idx(s) <= cur,
    isNew: (s) => s === current,
  };
}

// side：'front' 正面（零件面）／'back' 背面（焊接面，鏡像）
// features：這個版本的配置特徵（boards.js 的 featuresOf），用來過濾只有某些配置才有的零件與落點
// stubs：外部線要不要畫一小段往外的線（組合圖會自己畫完整的線，就關掉）
export function hubLayer({ side = 'front', order, current, features = new Set(['touch', 'bare']), stubs = true, annotate = true, marker = true } = {}) {
  const back = side === 'back';
  const st = stepper(order, current);
  const pos = ([x, y]) => [M + (back ? HUB.cols - 1 - x : x) * P + P / 2, M + y * P + P / 2];
  const has = (item) => included(item, features);
  const vis = (item) => has(item) && st.visible(item.step);
  const pathD = (path) => path.map((p, i) => `${i ? 'L' : 'M'} ${pos(p)[0]} ${pos(p)[1]}`).join(' ');
  const out = [];

  // 這個畫面看得到的東西裡，每個孔屬於哪條管路
  const key = ([x, y]) => `${x},${y}`;
  const netAt = new Map();
  for (const t of HUB.traces) if (vis(t)) eachHole(t.path, (h) => netAt.set(key(h), t.net));
  for (const j of HUB.jumpers) if (vis(j)) { netAt.set(key(j.a), j.net); netAt.set(key(j.b), j.net); }
  for (const p of HUB.parts) if (vis(p)) for (const [pin, h] of Object.entries(p.pins)) {
    const n = MEMBER_NET.get(`${p.id}.${pin}`);
    if (n) netAt.set(key(h), n);
  }
  for (const p of HUB.pads) if (vis(p) && MEMBER_NET.has(p.id)) netAt.set(key(p.hole), MEMBER_NET.get(p.id));
  const netAttr = (h) => (netAt.has(key(h)) ? ` data-net="${netAt.get(key(h))}"` : '');

  // 板子本體
  const bx = M - 12;
  const by = M - 12;
  const bw = HUB.cols * P + 24;
  const bh = HUB.rows * P + 24;
  out.push(`<rect x="${bx}" y="${by}" width="${bw}" height="${bh}" rx="7" fill="${back ? '#DDBE82' : '#E8CD97'}" stroke="#B8955A" stroke-width="1.6"/>`);

  // 欄列標籤
  for (let x = 0; x < HUB.cols; x++) {
    const [px] = pos([x, 0]);
    out.push(`<text x="${px}" y="${M - 18}" text-anchor="middle" font-size="12" font-weight="700" fill="#8A6A35" ${FONT}>${colName(x)}</text>`);
    out.push(`<text x="${px}" y="${M + HUB.rows * P + 26}" text-anchor="middle" font-size="12" font-weight="700" fill="#8A6A35" ${FONT}>${colName(x)}</text>`);
  }
  for (let y = 0; y < HUB.rows; y++) {
    const [, py] = pos([0, y]);
    out.push(`<text x="${M - 20}" y="${py + 4}" text-anchor="middle" font-size="12" font-weight="700" fill="#8A6A35" ${FONT}>${y + 1}</text>`);
    out.push(`<text x="${M + HUB.cols * P + 20}" y="${py + 4}" text-anchor="middle" font-size="12" font-weight="700" fill="#8A6A35" ${FONT}>${y + 1}</text>`);
  }

  // 孔：正面只看到洞，背面有銅環
  for (let y = 0; y < HUB.rows; y++) {
    for (let x = 0; x < HUB.cols; x++) {
      const [px, py] = pos([x, y]);
      // data-hole：滑鼠移上去顯示孔位，文字裡點到孔位時也靠它找到這個孔
      out.push(`<g class="hub-hole" data-hole="${holeName([x, y])}"${netAttr([x, y])}>${back
        ? `<circle cx="${px}" cy="${py}" r="8.6" fill="#D58E4E" stroke="#A9662C" stroke-width="1"/><circle cx="${px}" cy="${py}" r="3" fill="#4A3618"/>`
        : `<circle cx="${px}" cy="${py}" r="6.4" fill="#D9B676"/><circle cx="${px}" cy="${py}" r="3.1" fill="#5A4320"/>`}</g>`);
    }
  }

  // A1 記號（麥克筆點）
  if (marker && st.visible('hub-cut')) {
    const [px, py] = pos([0, 0]);
    const dx = back ? 12 : -12;
    out.push(`<circle cx="${px + dx}" cy="${py - 12}" r="4.6" fill="#1E1F22"/>`);
  }

  const hi = [];      // 高亮底層（畫在零件下面）
  const top = [];     // 標籤（畫在最上面）
  const placer = makePlacer(occupiedPoints(st, has, pos, back), { x0: bx, y0: by - 4, x1: bx + bw, y1: by + bh + 4 });

  if (back) {
    // 透視：正面的零件半透明疊在背面（左右鏡像、字保持可讀），看得出哪個焊點是哪顆零件的腳
    const posF = ([x, y]) => [M + x * P + P / 2, M + y * P + P / 2];
    const ghost = HUB.parts.filter(vis).map((p) => {
      const pts = Object.values(p.pins).map(posF);
      return `<g class="hub-part" data-part="${p.id}">${hitBox(pts, p.kind === 'ecap' ? 28 : 13)}${drawPart(p, posF)}</g>`;
    });
    if (ghost.length) out.push(`<g class="ghost">${mirrorX(ghost.join(''), HUB_W)}</g>`);
    // 錫橋
    for (const t of HUB.traces) {
      if (!vis(t)) continue;
      const d = pathD(t.path);
      if (st.isNew(t.step)) hi.push(`<path d="${d}" fill="none" stroke="${YOLK}" stroke-opacity=".45" stroke-width="22" stroke-linecap="round" stroke-linejoin="round"/>`);
      out.push(`<g class="hub-trace" data-net="${t.net}"><path d="${d}" fill="none" stroke="#8E959D" stroke-width="11" stroke-linecap="round" stroke-linejoin="round"/>`
        + `<path d="${d}" fill="none" stroke="#D4D8DD" stroke-width="7.5" stroke-linecap="round" stroke-linejoin="round"/></g>`);
    }
    // 焊點：零件腳、跳線兩端、外部線
    // 第三個欄位是滑鼠提示用的屬性：零件腳指回零件、外部線落點指回落點
    const joints = [];
    for (const p of HUB.parts) if (has(p) && st.visible(p.step)) for (const h of Object.values(p.pins)) joints.push([h, p.step, `class="hub-part" data-part="${p.id}"`]);
    for (const j of HUB.jumpers) if (has(j) && st.visible(j.step)) joints.push([j.a, j.step, ''], [j.b, j.step, '']);
    for (const p of HUB.pads) if (has(p) && st.visible(p.step)) joints.push([p.hole, p.step, `class="hub-pad" data-pad="${p.id}"`]);
    for (const [h, s, attr] of joints) {
      const [px, py] = pos(h);
      if (st.isNew(s)) hi.push(`<circle cx="${px}" cy="${py}" r="14" fill="${YOLK}" fill-opacity=".5"/>`);
      out.push(`<g ${attr}${netAttr(h)}><circle cx="${px}" cy="${py}" r="7" fill="#E3E6EA" stroke="#8E959D" stroke-width="1.6"/><circle cx="${px - 2}" cy="${py - 2}" r="2" fill="#fff" opacity=".8"/></g>`);
    }
    // 走背面的絕緣跳線：畫在焊點上面（兩端焊在銅環上）
    for (const j of HUB.jumpers) {
      if (j.side !== 'back' || !has(j) || !st.visible(j.step)) continue;
      if (st.isNew(j.step)) hi.push(highlightBox([pos(j.a), pos(j.b)], 12));
      out.push(jumperWire(pos(j.a), pos(j.b), WIRES.GND.color));
    }
    // 新焊點的孔位標籤
    if (annotate) {
      const names = new Set();
      for (const j of HUB.jumpers) if (j.side === 'back' && has(j) && st.isNew(j.step)) [j.a, j.b].forEach((p) => names.add(holeName(p)));
      for (const t of HUB.traces) if (has(t) && st.isNew(t.step)) t.path.forEach((p) => names.add(holeName(p)));
      for (const p of HUB.parts) if (has(p) && st.isNew(p.step)) Object.values(p.pins).forEach((h) => names.add(holeName(h)));
      for (const p of HUB.pads) if (has(p) && st.isNew(p.step)) names.add(holeName(p.hole));
      for (const n of names) {
        const x = n.charCodeAt(0) - 65;
        const y = Number(n.slice(1)) - 1;
        const [px, py] = pos([x, y]);
        top.push(placer.place(px, py, n, [[0, -17], [0, 17]]));
      }
    }
  } else {
    // 正面的「透視」提示：這一步要在背面拉的錫橋，用虛線畫出來，不翻面也知道錫要往哪裡拉
    for (const t of HUB.traces) if (has(t) && st.isNew(t.step)) out.push(`<path class="xray-new" d="${pathD(t.path)}"/>`);
    for (const j of HUB.jumpers) if (j.side === 'back' && has(j) && st.isNew(j.step)) out.push(`<path class="xray-new" d="${pathD([j.a, j.b])}"/>`);
    // 正面：走正面的跳線（走背面的只在背面畫）
    for (const j of HUB.jumpers) {
      if (j.side === 'back' || !has(j) || !st.visible(j.step)) continue;
      if (st.isNew(j.step)) hi.push(highlightBox([pos(j.a), pos(j.b)], 12));
      out.push(jumperWire(pos(j.a), pos(j.b), WIRES.GND.color));
    }
    // 零件
    for (const p of HUB.parts) {
      if (!has(p) || !st.visible(p.step)) continue;
      const pts = Object.values(p.pins).map(pos);
      if (st.isNew(p.step)) hi.push(highlightBox(pts, p.kind === 'ecap' ? 30 : 18));
      // 透明的感應區：滑鼠移到零件附近就能跳出說明，不用剛好指在細細的腳上
      out.push(`<g class="hub-part" data-part="${p.id}">${hitBox(pts, p.kind === 'ecap' ? 28 : 13)}${drawPart(p, pos)}</g>`);
      if (annotate && st.isNew(p.step)) top.push(...partTags(p, pos, placer));
    }
  }

  // 外部線落點（正反面都畫，正面才畫往外的線頭）
  for (const pad of HUB.pads) {
    if (!has(pad) || !st.visible(pad.step)) continue;
    const [px, py] = pos(pad.hole);
    const color = WIRES[pad.wire]?.color || '#888';
    if (st.isNew(pad.step)) hi.push(`<circle cx="${px}" cy="${py}" r="16" fill="${YOLK}" fill-opacity=".5"/>`);
    if (!back) {
      const g = [];
      // stubs：true 全畫、false 全不畫、'old' 只畫之前步驟的（這一步的線由組合圖畫完整的）
      if (stubs === true || (stubs === 'old' && !st.isNew(pad.step))) {
        let [dx, dy] = DIR_VEC[padDirection(pad.hole)];
        const ex = px + dx * 30;
        const ey = py + dy * 30;
        g.push(`<path d="M ${px} ${py} L ${ex} ${ey}" stroke="#000" stroke-opacity=".3" stroke-width="8" stroke-linecap="round"/>`);
        g.push(`<path d="M ${px} ${py} L ${ex} ${ey}" stroke="${color}" stroke-width="5.5" stroke-linecap="round"/>`);
      }
      g.push(`<circle cx="${px}" cy="${py}" r="5" fill="${color}" stroke="#1E1F22" stroke-width="1.2"/>`);
      out.push(`<g class="hub-pad" data-pad="${pad.id}"${netAttr(pad.hole)}>${g.join('')}</g>`);
      if (annotate && st.isNew(pad.step)) {
        // 找一個不壓到零件、線頭、其他標籤的位置
        top.push(placer.place(px, py, holeName(pad.hole)));
      }
    }
  }

  // 管路高光圖層：平常看不到，滑鼠指到某條管路時，同一條管路的錫橋、跳線、接點一起亮起來。
  // 錫橋在背面：背面圖畫實線，正面圖畫虛線（透視）。
  const glow = [];
  for (const t of HUB.traces) {
    if (vis(t)) glow.push(`<path class="net-path${back ? '' : ' xray'}" data-net="${t.net}" d="${pathD(t.path)}" stroke="${NET_COLOR[t.net]}"/>`);
  }
  for (const j of HUB.jumpers) {
    if (vis(j)) glow.push(`<path class="net-path${(j.side === 'back') === back ? '' : ' xray'}" data-net="${j.net}" d="${pathD([j.a, j.b])}" stroke="${NET_COLOR[j.net]}"/>`);
  }
  const dots = [
    ...HUB.parts.filter(vis).flatMap((p) => Object.values(p.pins)),
    ...HUB.pads.filter(vis).map((p) => p.hole),
    ...HUB.jumpers.filter(vis).flatMap((j) => [j.a, j.b]),
  ];
  for (const h of dots) {
    const net = netAt.get(key(h));
    if (!net) continue;
    const [px, py] = pos(h);
    glow.push(`<circle class="net-dot" data-net="${net}" cx="${px}" cy="${py}" r="10" stroke="${NET_COLOR[net]}"/>`);
  }

  // 標籤分開回傳：組合圖要等電線畫完再疊上去，標籤才不會被線蓋住
  const svg = `<g class="hub ${side}">${out.slice(0, 1).join('')}${hi.join('')}${out.slice(1).join('')}<g class="net-layer">${glow.join('')}</g></g>`;
  const labels = `<g class="hub-labels">${top.join('')}</g>`;
  const newTraces = HUB.traces.some((t) => has(t) && st.isNew(t.step)) || HUB.jumpers.some((j) => j.side === 'back' && has(j) && st.isNew(j.step));
  return { svg, labels, w: HUB_W, h: HUB_H, pos, newTraces, box: { x0: bx, y0: by, x1: bx + bw, y1: by + bh } };
}

// 透明感應區（滑鼠提示用）：fill 用 transparent 才收得到滑鼠事件
function hitBox(pts, pad) {
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const x0 = Math.min(...xs) - pad;
  const y0 = Math.min(...ys) - pad;
  return `<rect x="${x0}" y="${y0}" width="${Math.max(...xs) + pad - x0}" height="${Math.max(...ys) + pad - y0}" rx="${pad}" fill="transparent"/>`;
}

// 圍住一組孔的高亮框
function highlightBox(pts, pad) {
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const x0 = Math.min(...xs) - pad;
  const y0 = Math.min(...ys) - pad;
  const w = Math.max(...xs) + pad - x0;
  const h = Math.max(...ys) + pad - y0;
  return `<rect x="${x0}" y="${y0}" width="${w}" height="${h}" rx="${Math.min(w, h) / 2}" fill="${YOLK}" fill-opacity=".28" stroke="${YOLK}" stroke-width="2.4"/>`;
}

function drawPart(p, pos) {
  const pin = (k) => pos(p.pins[k]);
  switch (p.kind) {
    case 'resistor': return resistor(pin('a'), pin('b'), p.bands);
    case 'diode': return diode(pin('k'), pin('a'));
    case 'to92': {
      // 依 pinout 的實際左右順序畫：本體中心在中間那支腳
      const [l, m, r] = p.pinout.toLowerCase().split('').map(pin);
      return to92(l, m, r, p.flat, { label: p.value, P });
    }
    case 'ecap': return ecapTop(pin('p'), pin('n'), { r: P * 0.88 });
    case 'ccap': return ccap(pin('a'), pin('b'), { label: p.code });
    default: return '';
  }
}

// 新零件旁邊標上孔位：讓人講得出「插在 C4 和 G4」
function partTags(p, pos, placer) {
  const tags = [];
  const entries = Object.entries(p.pins);
  if (p.kind === 'to92') {
    const name = { e: 'E', b: 'B', c: 'C' };
    // 標在平面那一側，中間那支往下錯開，三個標籤才不會擠在一起
    const middle = p.pinout[1].toLowerCase();
    for (const [k, h] of entries) {
      const [px, py] = pos(h);
      const ty = py + (k === middle ? 52 : 30);
      tags.push(`<line x1="${px}" y1="${py + 10}" x2="${px}" y2="${ty - 8}" stroke="#1E1F22" stroke-width="1.2"/>`);
      tags.push(placer.fixed(px, ty, `${name[k]} ${holeName(h)}`, { fill: '#1E1F22', color: '#FFFFFF' }));
    }
    return tags;
  }
  const [, a] = entries[0];
  const [, b] = entries[1];
  const vertical = a[0] === b[0];
  for (const [k, h] of entries) {
    const [px, py] = pos(h);
    let label = holeName(h);
    if (p.kind === 'diode' && k === 'k') label += ' 色帶';
    if (p.kind === 'ecap') label += k === 'p' ? ' +長腳' : ' −';
    const off = p.kind === 'ecap' ? 46 : 30;
    tags.push(vertical
      ? placer.place(px, py, label, [[-off - label.length * 2, 0], [off + label.length * 2, 0]])
      : placer.place(px, py, label, [[0, -22], [0, 22]]));
  }
  return tags;
}

// 目前看得到的東西佔了哪些位置（像素座標）：標籤不要蓋在這些點上
function occupiedPoints(st, has, pos, back) {
  const pts = [];
  const cells = new Set();
  const add = (x, y) => {
    const k = `${x},${y}`;
    if (cells.has(k) || x < 0 || y < 0 || x >= HUB.cols || y >= HUB.rows) return;
    cells.add(k);
    pts.push(pos([x, y]));
  };
  const line = (a, b) => {
    const dx = Math.sign(b[0] - a[0]);
    const dy = Math.sign(b[1] - a[1]);
    for (let x = a[0], y = a[1]; ; x += dx, y += dy) { add(x, y); if (x === b[0] && y === b[1]) break; }
  };
  for (const p of HUB.parts) {
    if (!has(p) || !st.visible(p.step)) continue;
    const pins = Object.values(p.pins);
    if (p.kind === 'resistor' || p.kind === 'diode' || p.kind === 'ccap') line(pins[0], pins[1]);
    else pins.forEach(([x, y]) => add(x, y));
    if (p.kind === 'to92') pins.forEach(([x, y]) => add(x, y - 1));
    if (p.kind === 'ecap') pins.forEach(([x, y]) => { add(x - 1, y); add(x + 1, y); add(x, y); });
  }
  if (back) {
    for (const t of HUB.traces) if (has(t) && st.visible(t.step)) for (let i = 1; i < t.path.length; i++) line(t.path[i - 1], t.path[i]);
    for (const j of HUB.jumpers) if (j.side === 'back' && has(j) && st.visible(j.step)) line(j.a, j.b);
  } else {
    for (const j of HUB.jumpers) if (j.side !== 'back' && has(j) && st.visible(j.step)) line(j.a, j.b);
  }
  for (const p of HUB.pads) {
    if (!has(p) || !st.visible(p.step)) continue;
    const [x, y] = p.hole;
    add(x, y);
    if (!back) {
      const [dx, dy] = DIR_VEC[padDirection(p.hole)];
      add(x + dx, y + dy);
    }
  }
  return pts;
}

// 標籤擺放器：依序試幾個位置，選第一個不壓到東西、不跟別的標籤重疊、不出板子的
function makePlacer(points, bounds) {
  const rects = [];
  const size = 9.5;
  const rectOf = (cx, cy, text) => {
    const w = text.length * size * 0.62 + 10;
    const h = size + 8;
    return { x0: cx - w / 2, x1: cx + w / 2, y0: cy - h / 2, y1: cy + h / 2 };
  };
  const hit = (r, self) =>
    points.some(([x, y]) => !(x === self[0] && y === self[1]) && x > r.x0 - 6 && x < r.x1 + 6 && y > r.y0 - 6 && y < r.y1 + 6)
    || rects.some((q) => r.x0 < q.x1 + 2 && r.x1 > q.x0 - 2 && r.y0 < q.y1 + 2 && r.y1 > q.y0 - 2)
    || r.x0 < bounds.x0 || r.x1 > bounds.x1 || r.y0 < bounds.y0 || r.y1 > bounds.y1;
  const DEFAULT = [[24, 0], [-24, 0], [22, 17], [-22, 17], [22, -17], [-22, -17], [0, -19], [0, 19], [40, 0], [-40, 0]];
  return {
    place(px, py, text, prefs = []) {
      const cands = [...prefs, ...DEFAULT];
      for (const [dx, dy] of cands) {
        const r = rectOf(px + dx, py + dy, text);
        if (!hit(r, [px, py])) { rects.push(r); return tag(px + dx, py + dy, text, { size }); }
      }
      const [dx, dy] = cands[0];
      rects.push(rectOf(px + dx, py + dy, text));
      return tag(px + dx, py + dy, text, { size });
    },
    // 位置固定的標籤（例如電晶體的 E/B/C），只登記佔位
    fixed(cx, cy, text, opt = {}) {
      rects.push(rectOf(cx, cy, text));
      return tag(cx, cy, text, { size, ...opt });
    },
  };
}
