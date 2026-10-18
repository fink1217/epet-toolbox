// 接線教學的每一步。孔位、腳位、插圖全部從 data/hub.js、data/boards.js 算出來，不手抄。
import { HUB, STEP_ONLY } from '../data/hub.js';
import { WIRES, BOARD_WIRES, featuresOf, included } from '../data/boards.js';
import { hubLayer, holeName, P, NET_COLOR } from '../svg/hub-view.js';
import { boardLayer, gndKey, pinList } from '../svg/board-view.js';
import { icon, ampModule, imuModule, ec11Module, motorPart, motorModulePart, fsrPart, batteryPart, BAND_ZH } from '../svg/parts.js';
import { svgDoc, place, curvePath, roundedPath, wire, label, text } from './compose.js';
import * as A from '../svg/why-art.js';
import { mirrorX } from '../svg/mirror.js';
import { h, svgEl } from '../core.js';

const b = (s) => `<b>${s}</b>`;
const hn = holeName;
// 可以指的標記：滑鼠移上去，圖上對應的孔或零件會亮起來
const hb = (hole) => `<b class="ref" data-hole="${hn(hole)}">${hn(hole)}</b>`;
const pref = (id, text = id) => `<b class="ref" data-part="${id}">${text}</b>`;

const NET_ZH = {
  '3V3': '3V3 電源軌', GND: 'GND 地線', VBAT: '電池電源 VBAT', IO6: '馬達控制（IO6）', B: '電晶體基極',
  C: '馬達負端', FSR: '感壓訊號（IO2）', IO7: '聲音（IO7）', AUD: '濾波後的聲音',
};
const FLAT_ZH = { south: '下（朝第 9 列）', north: '上（朝第 1 列）', east: '右', west: '左' };
const Q1 = HUB.parts.find((p) => p.id === 'Q1');

// ── 由資料算出來的東西 ──

const padOk = (p, ctx) => included(p, ctx.features);

export function boardWiresOf(step, ctx) {
  return BOARD_WIRES
    .filter((w) => (!step || w.step === step) && included(w, ctx.features))
    .map((w) => ({ ...w, key: w.pin === 'GND' ? gndKey(ctx.board) : w.pin }));
}

// 主板上這次會用到的腳：{ 腳位 key: 線的種類 }
function usedPins(ctx) {
  const used = {};
  for (const w of boardWiresOf(null, ctx)) used[w.key] = w.wire;
  return used;
}

const boardPad = (pin) => HUB.pads.find((p) => p.id === `board-${pin.toLowerCase()}`);

// 腳位在排針上的位置：「右排第 4 支」
function pinWhere(ctx, key) {
  const p = pinList(ctx.board).find((x) => x.key === key);
  return p ? `${p.side === 'left' ? '左' : '右'}排第 ${p.idx + 1} 支` : '';
}

function partLine(p) {
  const pin = (k) => hb(p.pins[k]);
  const who = pref(p.id, `${p.id} ${p.name} ${p.value}`);
  switch (p.kind) {
    case 'resistor':
      return `${who}（${p.bands.slice(0, 3).map((c) => BAND_ZH[c]).join('')}）插 ${pin('a')} 和 ${pin('b')}`;
    case 'to92':
      // 依實際左右順序列出，跟「從左到右是 E、C、B」的提醒一致
      return `${who} 平面朝${FLAT_ZH[p.flat]}：${p.pinout.split('').map((k) => `${k} → ${pin(k.toLowerCase())}`).join('、')}`;
    case 'diode':
      return `${who}：色帶那端 → ${pin('k')}，另一端 → ${pin('a')}`;
    case 'ecap':
      return `${who}：長腳（+）→ ${pin('p')}，短腳（−，白色條紋那邊）→ ${pin('n')}`;
    case 'ccap':
      return `${who} → ${pin('a')}、${pin('b')}（不分方向）`;
    default:
      return p.id;
  }
}

// 網路的中文名：B 網路在模組版接的是模組 IN，不是電晶體
const netName = (net, ctx) => (net === 'B' && ctx.features.has('module') ? '接模組 IN' : NET_ZH[net] || net);

function traceLine(traces, ctx) {
  const byNet = new Map();
  for (const t of traces) {
    if (!byNet.has(t.net)) byNet.set(t.net, []);
    const paths = byNet.get(t.net);
    const last = paths[paths.length - 1];
    // 頭尾相接的錫橋合成一條：G4 → G5、G5 → G6 寫成 G4 → G5 → G6
    if (last && hn(last[last.length - 1]) === hn(t.path[0])) last.push(...t.path.slice(1));
    else paths.push([...t.path]);
  }
  return [...byNet].map(([net, paths]) => `<b class="ref" data-net="${net}">${netName(net, ctx)}</b>：${paths.map(route).join('、')}`).join('；');
}

// 中間點跟前後在同一直線上（只是路過，不用特別講）
const collinear = (a, m, c) => (a[0] === m[0] && m[0] === c[0]) || (a[1] === m[1] && m[1] === c[1]);
// 錫橋路線只講起點、轉角、終點
const route = (path, sep = ' → ') => path.filter((p, i) => i === 0 || i === path.length - 1 || !collinear(path[i - 1], p, path[i + 1])).map(hb).join(sep);

// 換料框：Q1 的 alt（S8050）插同樣三個孔，B、C 兩條錫橋改道。全部從 hub.js 讀，check-hub 驗過換料後的電路。
function altBox() {
  const alt = Q1.alt;
  const [tb, tc] = ['B', 'C'].map((net) => HUB.traces.find((t) => t.net === net && t.alt));
  const same = ['R1', 'R2', 'D1'].map((id) => HUB.parts.find((p) => p.id === id));
  const row = (name, now, then) => `<tr><th>${name}</th><td>${now}</td><td class="diff">${then}</td></tr>`;
  const path = (t) => route(t.path, '→<wbr>');
  return `<b>手上是 ${alt.value} 也可以用</b>：兩顆都是 NPN，但 ${alt.value} 中間那支是 ${alt.pinout[1]}（${Q1.value} 是 ${Q1.pinout[1]}），B、C 兩條錫橋要改道。`
    + `<table class="alt-table"><thead><tr><th></th><th>${Q1.value}</th><th>${alt.value}</th></tr></thead><tbody>`
    + row('左到右', Q1.pinout.split('').join(' '), alt.pinout.split('').join(' '))
    + row('B 錫橋<small>這一步</small>', path(tb), path(tb.alt))
    + row('C 錫橋<small>下一步</small>', path(tc), path(tc.alt))
    + `<tr><th>${same.map((p) => p.id).join('、')}</th><td colspan="2">${same.map((p) => p.value).join('、')}，都不用換</td></tr>`
    + '</tbody></table>'
    + '少數廠牌腳位不同，插之前用電表確認：二極體檔紅棒碰中間那支、黑棒碰兩邊，都讀到約 0.6V，中間就是 B。';
}

// 錫橋經過、之後還要插線的孔
function padHolesIn(traces, ctx) {
  const holes = new Set(traces.flatMap((t) => {
    const out = [];
    for (let i = 1; i < t.path.length; i++) {
      const [a, c] = [t.path[i - 1], t.path[i]];
      const dx = Math.sign(c[0] - a[0]);
      const dy = Math.sign(c[1] - a[1]);
      for (let x = a[0], y = a[1]; ; x += dx, y += dy) {
        out.push(`${x},${y}`);
        if (x === c[0] && y === c[1]) break;
      }
    }
    return out;
  }));
  return HUB.pads.filter((p) => padOk(p, ctx) && holes.has(`${p.hole[0]},${p.hole[1]}`)).map((p) => p.hole);
}

function hubTodos(step, ctx, pre = []) {
  const mine = (x) => x.step === step && included(x, ctx.features);
  const parts = HUB.parts.filter(mine);
  const traces = HUB.traces.filter(mine);
  const jumpers = HUB.jumpers.filter(mine);
  const todo = [...pre, ...parts.map(partLine)];
  if (parts.length) todo.push('翻到背面焊好每支腳，剪掉多餘的腳（剪下來的腳留著，可以當錫橋用的裸線）');
  if (traces.length) todo.push(`背面拉錫橋 —— ${traceLine(traces, ctx)}`);
  for (const j of jumpers) {
    todo.push(j.side === 'back'
      ? `背面用<b>有外皮</b>的單芯線把 ${hb(j.a)} 和 ${hb(j.b)} 接起來（跳線，只有兩端剝皮焊在銅環上）`
      : `正面用單芯線把 ${hb(j.a)} 和 ${hb(j.b)} 接起來（跳線）`);
  }
  return todo;
}

// 換料提醒：這一步的錫橋換料版要改道（完整對照在電晶體那一步的換料框）
function altTip(step) {
  const t = HUB.traces.find((x) => x.step === step && x.alt);
  return t
    ? ['swap', `<b>用 ${Q1.alt.value} 的話</b>：${t.net} 錫橋改從 ${hb(t.alt.path[0])} 出發，走 ${route(t.alt.path)}，不是圖上的 ${route(t.path)}。`]
    : null;
}

function padTip(step, ctx) {
  const holes = padHolesIn(HUB.traces.filter((t) => t.step === step && included(t, ctx.features)), ctx);
  return holes.length
    ? ['tip', `${holes.map(hb).join('、')} 之後還要插線：錫橋焊在銅環邊上，別把孔塞滿。`]
    : null;
}

// 連線表：這一步每條線從哪裡到哪裡
export function connRows(step, ctx) {
  const rows = [];
  for (const w of boardWiresOf(step, ctx)) {
    const pad = boardPad(w.pin);
    rows.push({ color: WIRES[w.wire].color, from: `主板 ${w.pin}`, to: pad ? `小電路板 ${hn(pad.hole)}` : w.to });
  }
  for (const p of HUB.pads) {
    if (p.step !== step || p.id.startsWith('board-') || !padOk(p, ctx)) continue;
    rows.push({ color: WIRES[p.wire].color, from: p.label, to: `小電路板 ${hn(p.hole)}` });
  }
  return rows;
}

// ── 滑鼠提示：圖上的零件、落點、排針、孔 → 一張小卡片（HTML）──

function partTipWhere(p) {
  const at = (k) => hn(p.pins[k]);
  switch (p.kind) {
    case 'to92': return `${p.pinout.split('').map((k) => `${k} ${at(k.toLowerCase())}`).join('・')}（平面朝${FLAT_ZH[p.flat]}）`;
    case 'diode': return `色帶那端 ${at('k')}、另一端 ${at('a')}`;
    case 'ecap': return `長腳（+）${at('p')}、短腳（−）${at('n')}`;
    default: return `插在 ${Object.values(p.pins).map(hn).join(' 和 ')}`;
  }
}

// 這個點屬於哪條管路：說明卡最後一行
function netLine(net, ctx) {
  return `<div class="tip-net"><span class="tip-dot" style="background:${NET_COLOR[net]}"></span>管路：${netName(net, ctx)}（同色亮起來的都連在一起）</div>`;
}

export function tipFor(el, ctx) {
  const body = tipBody(el, ctx);
  const net = el.dataset.net;
  if (!body && !net) return null;
  return (body || `<div class="tip-title"><span class="tip-id">錫橋</span>背面的焊錫路線</div>`) + (net ? netLine(net, ctx) : '');
}

function tipBody(el, ctx) {
  const d = el.dataset;
  if (d.mod) return modTip(d.mod, ctx);
  if (d.part) {
    const p = HUB.parts.find((x) => x.id === d.part);
    if (!p) return null;
    const value = p.kind === 'resistor' ? `${p.value}（${p.bands.slice(0, 3).map((c) => BAND_ZH[c]).join('')}）` : p.value;
    return `<div class="tip-title"><span class="tip-id">${p.id}</span>${p.name}</div>
      <div>${value}</div><div class="tip-where">${partTipWhere(p)}</div><div class="tip-role">${p.role}</div>`;
  }
  if (d.pad) {
    const p = HUB.pads.find((x) => x.id === d.pad);
    if (!p) return null;
    const w = WIRES[p.wire];
    return `<div class="tip-title"><span class="tip-id">${hn(p.hole)}</span>外接線落點</div>
      <div>${p.label} 的線焊在這裡</div>${w ? `<div class="tip-role"><span class="tip-dot" style="background:${w.color}"></span>${w.name}</div>` : ''}`;
  }
  if (d.pin) {
    const pin = pinList(ctx.board).find((x) => x.key === d.pin);
    if (!pin) return null;
    const w = boardWiresOf(null, ctx).find((x) => x.key === d.pin);
    const pad = w && boardPad(w.pin);
    const to = w ? (pad ? `小電路板 ${hn(pad.hole)}` : w.to) : null;
    return `<div class="tip-title"><span class="tip-id">${pin.label}</span>主板排針</div>
      <div>${pinWhere(ctx, d.pin)}（背面朝上、USB 朝上）</div>
      <div class="tip-role">${to ? `接到 ${to}` : '這次沒有用到'}</div>`;
  }
  if (d.hole) {
    const x = d.hole.charCodeAt(0) - 65;
    return `<div class="tip-title"><span class="tip-id">${d.hole}</span>洞洞板的孔</div><div>第 ${d.hole.slice(1)} 列、${String.fromCharCode(65 + x)} 欄</div>`;
  }
  return null;
}

// ── 插圖 ──

function hubArt(ctx, current, side = ctx.side) {
  const L = hubLayer({ side, order: ctx.order, current, features: ctx.features });
  const cap = side === 'back'
    ? '背面（焊接面）・翻過來看，左右相反'
    : `正面（零件面）${L.newTraces ? '・橘色虛線＝這一步背面要拉的錫橋' : ''}`;
  return svgDoc(L.w, L.h + 22, L.svg + L.labels + text(L.w / 2, L.h + 12, cap, { size: 13, color: '#8A6A35', weight: 700 }), cap);
}

// 組合圖收尾。正面：主板背面＋小電路板正面＋模組與線。
// 背面＝整組翻過來：小電路板換成背面（錫橋）、主板換成正面（螢幕），
// 模組和線左右鏡像（字保持可讀），線頭自動對到背面的焊點。
// board：{ L, opts, x, y, s }；hub：{ L, current, x, y, annotate }；over 可以是 (back) => svg。
function composite(ctx, { W, Ht, title, board, hub, body = '', over = '' }) {
  const back = ctx.side === 'back';
  const layers = [];
  let labels = '';
  if (board) {
    const L = back ? boardLayer(ctx.board, { ...board.opts, face: 'front' }) : board.L;
    layers.push(place(L, back ? W - board.x - L.w * board.s : board.x, board.y, board.s).svg);
  }
  if (hub) {
    const L = back
      ? hubLayer({ side: 'back', order: ctx.order, current: hub.current, features: ctx.features, annotate: hub.annotate ?? true })
      : hub.L;
    const H = place(L, back ? W - hub.x - L.w : hub.x, hub.y);
    layers.push(H.svg);
    labels = H.labels;
  }
  const top = typeof over === 'function' ? over(back) : over;
  return back
    ? svgDoc(W, Ht, layers.join('') + mirrorX(body, W) + labels + mirrorX(top, W), `${title}（整組翻到背面）`)
    : svgDoc(W, Ht, layers.join('') + body + labels + top, title);
}

// 翻面按鈕的文字：不同步驟翻的意義不一樣
const SIDES_PARTS = ['正面・插零件', '背面・焊錫'];
const SIDES_WIRES = ['正面・接線', '整組翻到背面'];

function hubCutArt() {
  const cols = 20;
  const rows = 13;
  const p = 20;
  const x0 = 30;
  const y0 = 30;
  const r0 = { c: 3, r: 2 };
  const holes = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const inside = c >= r0.c && c < r0.c + 14 && r >= r0.r && r < r0.r + 9;
      holes.push(`<circle cx="${x0 + c * p + p / 2}" cy="${y0 + r * p + p / 2}" r="3" fill="${inside ? '#5A4320' : '#9C8256'}"/>`);
    }
  }
  const rx = x0 + r0.c * p;
  const ry = y0 + r0.r * p;
  return svgDoc(x0 * 2 + cols * p + 60, y0 * 2 + rows * p + 10, `
    <rect x="${x0}" y="${y0}" width="${cols * p}" height="${rows * p}" rx="6" fill="#EADBB8" stroke="#B8955A"/>
    <rect x="${rx}" y="${ry}" width="${14 * p}" height="${9 * p}" rx="4" fill="#E8CD97" stroke="#B8955A"/>
    ${holes.join('')}
    <rect x="${rx}" y="${ry}" width="${14 * p}" height="${9 * p}" fill="none" stroke="#D93F3F" stroke-width="2.6" stroke-dasharray="9 6"/>
    <circle cx="${rx + p / 2 - 8}" cy="${ry + p / 2 - 8}" r="4.5" fill="#1E1F22"/>
    ${label(rx - 4, ry - 16, 'A1', { color: '#D93F3F' })}
    ${label(rx + 7 * p, ry + 9 * p + 22, '14 × 9 孔', { color: '#11807A' })}
    <g transform="translate(${x0 + cols * p + 6} ${ry + 40}) rotate(90)">
      <circle cx="0" cy="0" r="9" fill="none" stroke="#1E1F22" stroke-width="3"/><circle cx="22" cy="0" r="9" fill="none" stroke="#1E1F22" stroke-width="3"/>
      <path d="M 6 -6 L 34 -34 M 16 -6 L -12 -34" stroke="#6B7078" stroke-width="4" stroke-linecap="round"/>
    </g>`, '裁切洞洞板');
}

function boardArt(ctx) {
  const L = boardLayer(ctx.board, { used: ctx.used });
  return svgDoc(L.w, L.h, L.svg, '主板排針');
}

// 主板正面（螢幕那面）：對照用，排針位置左右相反
function boardFrontArt(ctx) {
  const L = boardLayer(ctx.board, { used: ctx.used, face: 'front' });
  return svgDoc(L.w, L.h, L.svg, '主板正面');
}

const BS = 0.75;   // 組合圖裡主板的縮放比例：讓小電路板當主角

// 主板 → 小電路板：右排的腳直接拉過去；左排的腳從板子下方繞
function wireBoardArt(ctx) {
  const list = boardWiresOf('wire-board', ctx);
  const BL = boardLayer(ctx.board, { used: ctx.used, focus: new Set(list.map((w) => w.key)), caption: false });
  const HL = hubLayer({ side: 'front', order: ctx.order, current: 'wire-board', features: ctx.features, stubs: 'old' });
  const hx = BL.w * BS + 96;
  const hy = 20;
  const B = place(BL, 0, 0, BS);
  const H = place(HL, hx, hy);
  const hub = { x0: hx + HL.box.x0, y0: hy + HL.box.y0, x1: hx + HL.box.x1, y1: hy + HL.box.y1 };
  const base = Math.max(BL.box.y1 * BS, hub.y1) + 20;
  const lane = { left: 0, right: 0, bottom: 0, enter: 0 };
  const out = [];
  for (const w of list) {
    const pad = boardPad(w.pin);
    if (!pad) continue;
    const pin = BL.pin(w.key);
    const a = B.at(pin.x, pin.y);
    const z = H.at(...HL.pos(pad.hole));
    const color = WIRES[w.wire].color;
    const x = pad.hole[0];
    const entry = x <= 3 ? 'left' : x >= HUB.cols - 1 ? 'right' : 'bottom';
    let d;
    if (pin.side === 'right' && entry === 'left') {
      d = curvePath(a, [1, 0], z, [-1, 0], Math.min(90, (z[0] - a[0]) / 2));
    } else {
      const pts = [a];
      const sx = pin.side === 'left' ? a[0] - 18 - lane.left++ * 11 : a[0] + 18 + lane.right++ * 11;
      const y = base + lane.bottom++ * 13;
      pts.push([sx, a[1]], [sx, y]);
      if (entry === 'left') {
        const ex = hub.x0 - 16 - lane.enter++ * 11;
        pts.push([ex, y], [ex, z[1]], z);
      } else if (entry === 'right') {
        const ex = hub.x1 + 18;
        pts.push([ex, y], [ex, z[1]], z);
      } else {
        pts.push([z[0], y], z);
      }
      d = roundedPath(pts);
    }
    out.push(wire(d, color, { end: z }));
  }
  const W = hx + HL.w + 36;
  const Ht = base + lane.bottom * 13 + 16;
  return composite(ctx, { W, Ht, title: '主板接到小電路板', board: { L: BL, opts: { used: ctx.used, focus: new Set(list.map((w) => w.key)), caption: false }, x: 0, y: 0, s: BS },
    hub: { L: HL, current: 'wire-board', x: hx, y: hy }, body: out.join('') });
}

// 小電路板上兩欄／兩列之間的縫：線走這裡不會壓到孔
const gapRight = (HL, H, x) => H.at(...HL.pos([x, 0]))[0] + P / 2;
const gapBelow = (HL, H, y) => H.at(...HL.pos([0, y]))[1] + P / 2;

// 震動馬達模組：VCC 對準 3V3 軌直直往下，IN、GND 從上方繞到欄與欄之間的縫再往下
function wireMotorModuleArt(ctx) {
  const HL = hubLayer({ order: ctx.order, current: 'wire-motor', features: ctx.features, stubs: 'old' });
  const MO = motorModulePart();
  const hy = MO.h + 48;
  const H = place(HL, 0, hy);
  const at = (id) => {
    const pad = HUB.pads.find((p) => p.id === id);
    return { pad, xy: H.at(...HL.pos(pad.hole)) };
  };
  const vcc = at('mod-vcc');
  const gnd = at('mod-gnd');
  const inn = at('mod-in');
  const Mo = place(MO, vcc.xy[0] - MO.pins.VCC.x, 0);
  const pin = (n) => Mo.at(MO.pins[n].x, MO.pins[n].y);
  const topY = hy + HL.box.y0 - 12;
  const route = (from, to, lane) => {
    const gx = gapRight(HL, H, to.pad.hole[0]);
    return roundedPath([from, [from[0], topY - lane], [gx, topY - lane], [gx, to.xy[1]], to.xy]);
  };
  const out = [
    wire(roundedPath([pin('VCC'), vcc.xy]), WIRES['3V3'].color, { end: vcc.xy }),
    wire(route(pin('IN'), inn, 0), WIRES.IO6.color, { end: inn.xy }),
    wire(route(pin('GND'), gnd, 10), WIRES.GND.color, { end: gnd.xy }),
  ];
  return composite(ctx, { W: HL.w, Ht: hy + HL.h, title: '震動馬達模組接線', hub: { L: HL, current: 'wire-motor', x: 0, y: hy }, body: Mo.svg + out.join('') });
}

function wireMotorArt(ctx) {
  if (ctx.features.has('module')) return wireMotorModuleArt(ctx);
  const HL = hubLayer({ order: ctx.order, current: 'wire-motor', features: ctx.features, stubs: 'old' });
  const MO = motorPart();
  const hy = MO.h + 40;
  const H = place(HL, 0, hy);
  const j1 = HUB.pads.find((p) => p.id === 'motor-1');
  const j6 = HUB.pads.find((p) => p.id === 'motor-2');
  const J1 = H.at(...HL.pos(j1.hole));
  const J6 = H.at(...HL.pos(j6.hole));
  const Mo = place(MO, J1[0] - MO.pins.w1.x, 0);
  const w1 = Mo.at(MO.pins.w1.x, MO.pins.w1.y);
  const w2 = Mo.at(MO.pins.w2.x, MO.pins.w2.y);
  const topY = hy + HL.box.y0 - 12;
  const gx = gapRight(HL, H, j6.hole[0]);
  const out = [
    wire(roundedPath([w1, J1]), '#D3322C', { end: J1 }),
    wire(roundedPath([w2, [w2[0], topY], [gx, topY], [gx, J6[1]], J6]), '#2F6FDB', { end: J6 }),
  ];
  return composite(ctx, { W: HL.w, Ht: hy + HL.h, title: '馬達接線', hub: { L: HL, current: 'wire-motor', x: 0, y: hy }, body: Mo.svg + out.join('') });
}

function wireFsrArt(ctx) {
  const HL = hubLayer({ order: ctx.order, current: 'wire-fsr', features: ctx.features, stubs: 'old' });
  const FP = fsrPart();
  const FS = 0.72;
  const hy = FP.h * FS + 36;
  const H = place(HL, 0, hy);
  const k1 = HUB.pads.find((p) => p.id === 'fsr-1');
  const l4 = HUB.pads.find((p) => p.id === 'fsr-2');
  const K1 = H.at(...HL.pos(k1.hole));
  const L4 = H.at(...HL.pos(l4.hole));
  const F = place(FP, K1[0] - FP.pins.b.x * FS, 0, FS);
  const a = F.at(FP.pins.a.x, FP.pins.a.y);
  const bb = F.at(FP.pins.b.x, FP.pins.b.y);
  const topY = hy + HL.box.y0 - 12;
  const gx = gapRight(HL, H, k1.hole[0] - 1);       // K 欄左邊那條縫
  const gy = gapBelow(HL, H, l4.hole[1] - 1);       // L4 上面那條縫
  const color = WIRES.FSRW.color;
  const out = [
    wire(roundedPath([bb, K1]), color, { end: K1 }),
    wire(roundedPath([a, [a[0], topY], [gx, topY], [gx, gy], [L4[0], gy], L4]), color, { end: L4 }),
  ];
  return composite(ctx, { W: HL.w, Ht: hy + HL.h, title: '感壓片接線', hub: { L: HL, current: 'wire-fsr', x: 0, y: hy }, body: F.svg + out.join('') });
}

function wireAmpArt(ctx) {
  const HL = hubLayer({ order: ctx.order, current: 'wire-amp', features: ctx.features, stubs: 'old' });
  const AM = ampModule({ pinsTop: true });
  const H = place(HL, 0, 0);
  const pv = HUB.pads.find((p) => p.id === 'amp-v');
  const pg = HUB.pads.find((p) => p.id === 'amp-g');
  const ps = HUB.pads.find((p) => p.id === 'amp-s');
  const V = H.at(...HL.pos(pv.hole));
  const G = H.at(...HL.pos(pg.hole));
  const S = H.at(...HL.pos(ps.hole));
  const ay = HL.h + 56;
  const Am = place(AM, G[0] - AM.pins.G.x, ay);
  const g = Am.at(AM.pins.G.x, AM.pins.G.y);
  const v = Am.at(AM.pins.V.x, AM.pins.V.y);
  const s = Am.at(AM.pins.S.x, AM.pins.S.y);
  const bot = HL.box.y1 + 14;
  const gx = gapRight(HL, H, pv.hole[0]);
  const out = [
    wire(roundedPath([g, G]), WIRES.GND.color, { end: G }),
    wire(roundedPath([v, [v[0], bot], [gx, bot], [gx, V[1]], V]), WIRES.VBAT.color, { end: V }),
    wire(roundedPath([s, [s[0], bot + 14], [S[0], bot + 14], S]), WIRES.AUD.color, { end: S }),
  ];
  return composite(ctx, { W: HL.w, Ht: ay + AM.h + 8, title: '功放接線', hub: { L: HL, current: 'wire-amp', x: 0, y: 0 }, body: Am.svg + out.join('') });
}

function wireImuArt(ctx) {
  const list = boardWiresOf('wire-imu', ctx);
  const BL = boardLayer(ctx.board, { used: ctx.used, focus: new Set(list.map((w) => w.key)), caption: false });
  const HL = hubLayer({ order: ctx.order, current: 'wire-imu', features: ctx.features, stubs: 'old' });
  const IM = imuModule({ bridge: true });
  const hx = BL.w * BS + 110;
  const hy = IM.h + 90;
  const H = place(HL, hx, hy);
  const B = place(BL, 0, hy - 40, BS);
  const pads = Object.fromEntries(['imu-vcc', 'imu-gnd', 'imu-sdo'].map((id) => [id, HUB.pads.find((p) => p.id === id)]));
  const VCC = H.at(...HL.pos(pads['imu-vcc'].hole));
  const GND = H.at(...HL.pos(pads['imu-gnd'].hole));
  const SDO = H.at(...HL.pos(pads['imu-sdo'].hole));
  const gFG = gapRight(HL, H, pads['imu-gnd'].hole[0] - 1);
  const Im = place(IM, gFG - IM.pins.GND.x, 24);
  const pin = (n) => Im.at(IM.pins[n].x, IM.pins[n].y);
  const topY = hy + HL.box.y0 - 12;
  const out = [];
  out.push(wire(roundedPath([pin('GND'), [gFG, GND[1]], GND]), WIRES.GND.color, { end: GND }));
  out.push(wire(roundedPath([pin('VCC'), [pin('VCC')[0], topY], [VCC[0], topY], VCC]), WIRES['3V3'].color, { end: VCC }));
  out.push(wire(roundedPath([pin('SDO'), [pin('SDO')[0], topY - 14], [SDO[0], topY - 14], SDO]), WIRES.GND.color, { end: SDO }));
  // 到主板的三條：先往下一點，再往左走到主板和小電路板中間的通道，最後進主板右排的標籤
  const sig = { SDA: 'IO8', SCL: 'IO9', INT1: 'IO10' };
  const order = ['INT1', 'SDA', 'SCL'];
  order.forEach((n, i) => {
    const w = list.find((x) => x.pin === sig[n]);
    if (!w) return;
    const bp = BL.pin(w.key);
    const z = B.at(bp.x, bp.y);
    const p0 = pin(n);
    const ly = p0[1] + 16 + i * 12;
    const cx = BL.w * BS + 28 + i * 14;
    out.push(wire(roundedPath([p0, [p0[0], ly], [cx, ly], [cx, z[1]], z]), WIRES[w.wire].color, { end: z }));
  });
  const W = hx + HL.w + 10;
  const Ht = Math.max(hy + HL.h, hy - 40 + BL.h * BS) + 6;
  return composite(ctx, { W, Ht, title: '加速度計接線', board: { L: BL, opts: { used: ctx.used, focus: new Set(list.map((w) => w.key)), caption: false }, x: 0, y: hy - 40, s: BS },
    hub: { L: HL, current: 'wire-imu', x: hx, y: hy }, body: Im.svg + out.join('') });
}

function wireEc11Art(ctx) {
  const list = boardWiresOf('wire-ec11', ctx);
  const BL = boardLayer(ctx.board, { used: ctx.used, focus: new Set(list.map((w) => w.key)), caption: false });
  const HL = hubLayer({ order: ctx.order, current: 'wire-ec11', features: ctx.features, stubs: 'old' });
  const EC = ec11Module();
  const bx = 100;
  const B = place(BL, bx, 0, BS);
  const hx = bx + BL.w * BS + 100;
  const hy = 50;
  const H = place(HL, hx, hy);
  const ey = BL.box.y1 * BS + 80;
  const E = place(EC, 10, ey);
  const pin = (n) => E.at(EC.pins[n].x, EC.pins[n].y);
  const out = [];
  // 訊號三條：往上，再往右進主板左排的標籤
  const sig = { CLK: 'IO3', DT: 'IO4', SW: 'IO5' };
  for (const n of ['CLK', 'DT', 'SW']) {
    const w = list.find((x) => x.pin === sig[n]);
    if (!w) continue;
    const bp = BL.pin(w.key);
    const z = B.at(bp.x, bp.y);
    const p0 = pin(n);
    const pts = bp.side === 'left'
      ? [p0, [p0[0], z[1]], z]
      : [p0, [p0[0], ey - 30], [B.at(BL.box.x1, 0)[0] + 20, ey - 30], [B.at(BL.box.x1, 0)[0] + 20, z[1]], z];
    out.push(wire(roundedPath(pts), WIRES[w.wire].color, { end: z }));
  }
  // 電源兩條：往上一點、往右繞到小電路板上方再下去
  const pPlus = HUB.pads.find((p) => p.id === 'ec11-vcc');
  const pGnd = HUB.pads.find((p) => p.id === 'ec11-gnd');
  const VCC = H.at(...HL.pos(pPlus.hole));
  const GND = H.at(...HL.pos(pGnd.hole));
  const gDE = gapRight(HL, H, pGnd.hole[0] - 1);
  const lane1 = ey - 44;
  const lane2 = ey - 30;
  const corr = bx + BL.w * BS + 36;
  const top1 = hy + HL.box.y0 - 30;
  const top2 = hy + HL.box.y0 - 14;
  const plus = pin('+');
  const gnd = pin('GND');
  out.push(wire(roundedPath([plus, [plus[0], lane1], [corr, lane1], [corr, top1], [VCC[0], top1], VCC]), WIRES['3V3'].color, { end: VCC }));
  out.push(wire(roundedPath([gnd, [gnd[0], lane2], [corr + 16, lane2], [corr + 16, top2], [gDE, top2], [gDE, GND[1]], GND]), WIRES.GND.color, { end: GND }));
  const W = hx + HL.w + 10;
  const Ht = ey + EC.h + 10;
  return composite(ctx, { W, Ht, title: '旋鈕接線', board: { L: BL, opts: { used: ctx.used, focus: new Set(list.map((w) => w.key)), caption: false }, x: bx, y: 0, s: BS },
    hub: { L: HL, current: 'wire-ec11', x: hx, y: hy }, body: E.svg + out.join('') });
}

function wireBatteryArt(ctx) {
  const HL = hubLayer({ order: ctx.order, current: 'wire-battery', features: ctx.features, stubs: 'old' });
  const BA = batteryPart({ top: true, unplugged: true });
  const H = place(HL, 0, 0);
  const pp = HUB.pads.find((p) => p.id === 'batt-p');
  const pn = HUB.pads.find((p) => p.id === 'batt-n');
  const PL = H.at(...HL.pos(pp.hole));
  const MI = H.at(...HL.pos(pn.hole));
  const by = HL.h + 40;
  const Ba = place(BA, MI[0] - BA.pins['−'].x, by);
  const plus = Ba.at(BA.pins['+'].x, BA.pins['+'].y);
  const minus = Ba.at(BA.pins['−'].x, BA.pins['−'].y);
  const gx = gapRight(HL, H, pp.hole[0] - 1);
  const out = [
    wire(roundedPath([minus, MI]), WIRES.GND.color, { end: MI }),
    wire(roundedPath([plus, [gx, plus[1] - 10], [gx, PL[1]], PL]), WIRES.VBAT.color, { end: PL }),
    label(Ba.at(BA.w + 10, 96)[0], Ba.at(BA.w + 10, 96)[1], '電池先不要插', { color: '#D93F3F', anchor: 'start' }),
  ];
  return composite(ctx, { W: HL.w, Ht: by + BA.h + 8, title: '電池接頭', hub: { L: HL, current: 'wire-battery', x: 0, y: 0 }, body: Ba.svg + out.join('') });
}

function hubCheckArt(ctx) {
  const HL = hubLayer({ side: 'back', order: ctx.order, current: 'hub-check', features: ctx.features });
  const H = place(HL, 0, 0);
  const a1 = H.at(...HL.pos([0, 0]));
  const a2 = H.at(...HL.pos([0, 1]));
  const mx = HL.w + 40;
  const meter = `<g transform="translate(${mx} 60)">
    <rect x="0" y="0" width="96" height="150" rx="14" fill="#F2C21B" stroke="#B8901A" stroke-width="2"/>
    <rect x="12" y="14" width="72" height="38" rx="5" fill="#C9E7C4"/>
    ${text(48, 40, '🔊', { size: 18 })}
    <circle cx="48" cy="98" r="24" fill="#2B2B2B"/><path d="M48 98 L 60 82" stroke="#fff" stroke-width="3.5"/>
  </g>`;
  const probes = [
    wire(curvePath([mx + 30, 210], [0, 1], a1, [1, -0.3], 120), '#D93F3F', { end: a1 }),
    wire(curvePath([mx + 66, 210], [0, 1], a2, [1, 0.4], 160), '#2B2B2B', { end: a2 }),
  ];
  const tip = label(mx + 48, 250, '不能一直嗶', { color: '#D93F3F' });
  return svgDoc(mx + 120, Math.max(HL.h, 270), H.svg + meter + probes.join('') + H.labels + tip, '短路檢查');
}

function powerCheckArt(ctx) {
  const BL = boardLayer(ctx.board, { used: ctx.used, caption: false });
  const B = place(BL, 40, 70);
  const usb = B.at((BL.box.x0 + BL.box.x1) / 2, BL.box.y0);
  const cable = `<path d="M ${usb[0]} ${usb[1] - 8} C ${usb[0]} ${usb[1] - 40}, ${usb[0] + 60} ${usb[1] - 60}, ${usb[0] + 120} ${usb[1] - 64}"
      stroke="#4A4D55" stroke-width="10" fill="none" stroke-linecap="round"/>
    <rect x="${usb[0] - 16}" y="${usb[1] - 18}" width="32" height="16" rx="4" fill="#6B7078"/>`;
  const BA = batteryPart({ unplugged: true });
  const Ba = place(BA, 40 + BL.w + 20, 200);
  const one = label(usb[0] + 150, usb[1] - 64, '① 只插 USB', { color: '#23944F' });
  const two = label(Ba.at(85, -18)[0], Ba.at(85, -18)[1], '② 電池最後才插', { color: '#D93F3F' });
  return composite(ctx, { W: 40 + BL.w + 20 + BA.w + 30, Ht: 70 + BL.h + 10, title: '第一次通電',
    board: { L: BL, opts: { used: ctx.used, caption: false }, x: 40, y: 70, s: 1 }, body: cable + Ba.svg + one + two });
}

// 外接模組的說明卡：名稱、用途、每支腳接到哪裡（落點與主板腳位都從資料查）
const MOD_INFO = {
  imu: { name: 'GY-291 加速度計（ADXL345）', role: '偵測搖晃、拿起來、拍一下；拿起來時還能叫醒主板。', pads: ['imu-vcc', 'imu-gnd', 'imu-sdo'], step: 'wire-imu' },
  motor: { name: '1027 震動馬達', role: '撒嬌、被摸的時候震一下。不分正負。', pads: ['motor-1', 'motor-2'] },
  module: { name: '震動馬達模組', role: '驅動電路（電晶體、二極體）已經做在模組上，接三條線就好。', pads: ['mod-vcc', 'mod-gnd', 'mod-in'] },
  fsr: { name: '薄膜壓力感測器', role: '摸一下、抱一下：壓得越用力，IO2 的電壓越高。', pads: ['fsr-1', 'fsr-2'] },
  amp: { name: 'SC8002B 功放（自帶喇叭）', role: '把 IO7 濾波後的聲音放大，推動喇叭。第一次通電前音量先轉到最小。', pads: ['amp-v', 'amp-g', 'amp-s'] },
  battery: { name: '3.7V 1000mAh 鋰電池', role: '主板會自動幫它充電；插 USB 時改由 USB 供電。', pads: ['batt-p', 'batt-n'] },
  ec11: { name: 'EC11 旋鈕', role: '轉動切換、按下確認（自玩版）。', pads: ['ec11-vcc', 'ec11-gnd'], step: 'wire-ec11' },
};
const mod = (id, svg) => `<g class="hub-mod" data-mod="${id}">${svg}</g>`;

function modTip(id, ctx) {
  const m = MOD_INFO[id];
  if (!m) return null;
  const short = (label) => label.replace(/^\S+\s/, '');   // 「GY-291 VCC」→「VCC」
  const links = [
    ...m.pads.map((pid) => HUB.pads.find((p) => p.id === pid)).filter(Boolean).map((p) => `${short(p.label)} → ${hn(p.hole)}`),
    ...(m.step ? boardWiresOf(m.step, ctx).map((w) => `${short(w.to)} → 主板 ${w.pin}`) : []),
  ];
  return `<div class="tip-title"><span class="tip-id">模組</span>${m.name}</div>
    <div class="tip-role">${m.role}</div><div class="tip-where">${links.join('、')}</div>`;
}

// ── 完整接線總圖：所有元件裝好、全部接起來的樣子 ──
// 小電路板在中間；上方：加速度計、馬達、感壓片；左邊：主板；下方：電池、功放；自玩版左下多一顆旋鈕。
// 每條線的起點、終點都從資料算（主板排針、模組接腳、小電路板落點），換配置圖會自己跟著變。
function assemblyArt(ctx) {
  const F = ctx.features;
  const enc = F.has('encoder');
  const BL = boardLayer(ctx.board, { used: ctx.used, caption: false });
  const HL = hubLayer({ order: ctx.order, current: 'done', features: F, stubs: false, annotate: false });
  const bx = enc ? 110 : 16;                 // 主板左邊留位置給旋鈕的線
  const hx = bx + BL.w * BS + 130;           // 小電路板左上角
  const hy = 250;                            // 上方模組區的高度
  const B = place(BL, bx, hy - 24, BS);
  const H = place(HL, hx, hy);
  const pad = (id) => H.at(...HL.pos(HUB.pads.find((p) => p.id === id).hole));
  const gapR = (x) => gapRight(HL, H, x);
  const gapB = (y) => gapBelow(HL, H, y);
  const hub = { x0: hx + HL.box.x0, y0: hy + HL.box.y0, x1: hx + HL.box.x1, y1: hy + HL.box.y1 };
  const topY = hub.y0 - 12;
  const corr = bx + BL.w * BS + 22;          // 主板和小電路板中間的通道
  const parts = [];
  const out = [];
  const line = (pts, color, end = pts[pts.length - 1]) => out.push(wire(roundedPath(pts), color, { end }));
  const boardPinXY = (pin) => { const bp = BL.pin(boardWiresOf(null, ctx).find((w) => w.pin === pin).key); return B.at(bp.x, bp.y); };

  // 1. 主板 → 小電路板（3V3、GND、VBAT、IO2、IO6、IO7）：跟「主板 → 小電路板」那一步同一套走線
  const base = Math.max(BL.box.y1 * BS + hy - 24, hub.y1) + 64;
  const lane = { left: 0, right: 0, bottom: 0, enter: 0 };
  for (const w of boardWiresOf('wire-board', ctx)) {
    const bp = boardPad(w.pin);
    if (!bp) continue;
    const pin = BL.pin(w.key);
    const a = B.at(pin.x, pin.y);
    const z = H.at(...HL.pos(bp.hole));
    const color = WIRES[w.wire].color;
    const x = bp.hole[0];
    const entry = x <= 3 ? 'left' : x >= HUB.cols - 1 ? 'right' : 'bottom';
    if (pin.side === 'right' && entry === 'left') {
      out.push(wire(curvePath(a, [1, 0], z, [-1, 0], Math.min(90, (z[0] - a[0]) / 2)), color, { end: z }));
      continue;
    }
    const sx = pin.side === 'left' ? a[0] - 18 - lane.left++ * 11 : a[0] + 18 + lane.right++ * 11;
    const y = base + lane.bottom++ * 13;
    const pts = [a, [sx, a[1]], [sx, y]];
    if (entry === 'left') { const ex = hub.x0 - 16 - lane.enter++ * 11; pts.push([ex, y], [ex, z[1]], z); }
    else if (entry === 'right') { const ex = hub.x1 + 18; pts.push([ex, y], [ex, z[1]], z); }
    else pts.push([z[0], y], z);
    line(pts, color, z);
  }
  const lanesEnd = base + lane.bottom * 13;

  // 2. 加速度計 GY-291（左上）：電源三條往下進小電路板，訊號三條往左進主板右排
  // 上方各條線的高度（y）：右邊的腳先轉彎、走高一點的線，平行的線才不會疊在一起
  const IM = imuModule({ bridge: true });
  const Im = place(IM, hx + 10, 20);
  parts.push(mod('imu', Im.svg));
  const ip = (n) => Im.at(IM.pins[n].x, IM.pins[n].y);
  const G1 = pad('imu-vcc');
  const G2 = pad('imu-gnd');
  const H2 = pad('imu-sdo');
  const imuY = ip('GND')[1];
  line([ip('SDO'), [ip('SDO')[0], imuY + 54], [gapR(6), imuY + 54], [gapR(6), H2[1]], H2], WIRES.GND.color);
  line([ip('VCC'), [ip('VCC')[0], imuY + 68], [G1[0], imuY + 68], G1], WIRES['3V3'].color);
  line([ip('GND'), [ip('GND')[0], imuY + 82], [gapR(5), imuY + 82], [gapR(5), G2[1]], G2], WIRES.GND.color);
  ['INT1', 'SDA', 'SCL'].forEach((n, i) => {
    const sig = { SDA: 'IO8', SCL: 'IO9', INT1: 'IO10' }[n];
    const z = boardPinXY(sig);
    const p0 = ip(n);
    const ly = imuY + 14 + i * 12;
    const cx = corr + i * 13;
    line([p0, [p0[0], ly], [cx, ly], [cx, z[1]], z], WIRES[sig].color, z);
  });

  // 3. 震動馬達（上方中間）：裸馬達兩條線，或模組三條線
  if (F.has('module')) {
    const MO = motorModulePart();
    const Mo = place(MO, hx + 220, 30);
    parts.push(mod('module', Mo.svg));
    const mp = (n) => Mo.at(MO.pins[n].x, MO.pins[n].y);
    const my = mp('VCC')[1];
    const VCC = pad('mod-vcc');
    const IN = pad('mod-in');
    const GND = pad('mod-gnd');
    line([mp('VCC'), [mp('VCC')[0], my + 30], [VCC[0], my + 30], VCC], WIRES['3V3'].color);
    line([mp('IN'), [mp('IN')[0], my + 44], [gapR(7), my + 44], [gapR(7), gapB(4)], [IN[0], gapB(4)], IN], WIRES.IO6.color);
    line([mp('GND'), [mp('GND')[0], my + 72], [gapR(8), my + 72], [gapR(8), GND[1]], GND], WIRES.GND.color);
  } else {
    const MO = motorPart();
    const J1 = pad('motor-1');
    const J6 = pad('motor-2');
    const Mo = place(MO, J1[0] - MO.pins.w2.x, 60);
    parts.push(mod('motor', Mo.svg));
    const w1 = Mo.at(MO.pins.w1.x, MO.pins.w1.y);
    const w2 = Mo.at(MO.pins.w2.x, MO.pins.w2.y);
    line([w2, J1], '#D3322C');
    line([w1, [w1[0], w1[1] + 58], [gapR(8), w1[1] + 58], [gapR(8), J6[1]], J6], '#2F6FDB');
  }

  // 4. 薄膜壓力感測器（右上）：一條從上方進 K1，一條從右邊繞到 L4
  const FP = fsrPart();
  const FS = 0.72;
  const Fp = place(FP, hub.x1 + 6, 30, FS);
  parts.push(mod('fsr', Fp.svg));
  const fa = Fp.at(FP.pins.a.x, FP.pins.a.y);
  const fb = Fp.at(FP.pins.b.x, FP.pins.b.y);
  const K1 = pad('fsr-1');
  const L4 = pad('fsr-2');
  line([fa, [fa[0], imuY + 96], [K1[0], imuY + 96], K1], WIRES.FSRW.color);
  line([fb, [fb[0], gapB(1)], [L4[0], gapB(1)], L4], WIRES.FSRW.color);

  // 5. 電池（下方左）：− 直上 C9，+ 走 B/C 之間的縫上到 C7
  const BA = batteryPart({ top: true });
  const C9 = pad('batt-n');
  const C7 = pad('batt-p');
  const by = lanesEnd + 40;
  const Ba = place(BA, C9[0] - BA.pins['−'].x, by);
  parts.push(mod('battery', Ba.svg));
  const bp = Ba.at(BA.pins['+'].x, BA.pins['+'].y);
  const bn = Ba.at(BA.pins['−'].x, BA.pins['−'].y);
  line([bn, C9], WIRES.GND.color);
  line([bp, [gapR(1), bp[1] - 10], [gapR(1), C7[1]], C7], WIRES.VBAT.color);

  // 6. 喇叭功放 SC8002B（下方右）：G、V、S 三條往上
  const AM = ampModule({ pinsTop: true });
  const Am = place(AM, Ba.at(BA.w + 24, 0)[0], by);
  parts.push(mod('amp', Am.svg));
  const ap = (n) => Am.at(AM.pins[n].x, AM.pins[n].y);
  const D9 = pad('amp-g');
  const D7 = pad('amp-v');
  const N8 = pad('amp-s');
  line([ap('G'), [ap('G')[0], hub.y1 + 34], [D9[0], hub.y1 + 34], D9], WIRES.GND.color);
  line([ap('V'), [ap('V')[0], hub.y1 + 22], [gapR(2), hub.y1 + 22], [gapR(2), D7[1]], D7], WIRES.VBAT.color);
  line([ap('S'), [ap('S')[0], hub.y1 + 10], [N8[0], hub.y1 + 10], N8], WIRES.AUD.color);

  // 7. 旋鈕 EC11（自玩版，左下）：訊號往上進主板左排，電源繞到小電路板上方
  let bottom = by + Math.max(BA.h, AM.h);
  if (enc) {
    const EC = ec11Module();
    const ey = Math.max(lanesEnd + 40, B.at(0, BL.box.y1)[1] + 70);
    const E = place(EC, 6, ey);
    parts.push(mod('ec11', E.svg));
    const epn = (n) => E.at(EC.pins[n].x, EC.pins[n].y);
    for (const [n, sig] of [['CLK', 'IO3'], ['DT', 'IO4'], ['SW', 'IO5']]) {
      const z = boardPinXY(sig);
      line([epn(n), [epn(n)[0], z[1]], z], WIRES[sig].color, z);
    }
    // 電源兩條：沿通道往上，從加速度計的線下面、小電路板上緣上面那一小段橫過去（不跟加速度計的線交叉）
    const E1 = pad('ec11-vcc');
    const E2 = pad('ec11-gnd');
    const c2 = corr + 52;
    line([epn('+'), [epn('+')[0], ey - 30], [c2, ey - 30], [c2, topY - 24], [E1[0], topY - 24], E1], WIRES['3V3'].color);
    line([epn('GND'), [epn('GND')[0], ey - 18], [c2 + 14, ey - 18], [c2 + 14, topY - 10], [gapR(3), topY - 10], [gapR(3), E2[1]], E2], WIRES.GND.color);
    bottom = Math.max(bottom, ey + EC.h);
  }

  // 標題牌與說明：翻到背面時文字跟著換
  const W = Math.max(Fp.at(FP.w, 0)[0], Am.at(AM.w, 0)[0]) + 16;
  const over = (back) => label(B.at(BL.w / 2, BL.box.y0)[0], hy - 38,
    back ? `主板（正面・螢幕）${ctx.board.short}` : `主板（背面）${ctx.board.short}`, { color: '#1E1F22' })
    + text(W / 2, bottom + 30, back
      ? '整組翻到背面：小電路板看焊錫面、主板看螢幕面，左右跟正面相反。'
      : '完整接線總圖：主板看背面、小電路板看正面。滑鼠移到任何零件或孔上看說明，指到孔會亮出整條管路。',
    { size: 13, color: '#8A6A35', weight: 700 });
  return composite(ctx, { W, Ht: bottom + 44, title: '完整接線總圖',
    board: { L: BL, opts: { used: ctx.used, caption: false }, x: bx, y: hy - 24, s: BS },
    hub: { L: HL, current: 'done', x: hx, y: hy, annotate: false },
    body: parts.join('') + out.join(''), over });
}

function doneArt(ctx) {
  return assemblyArt(ctx);
}

// 零件清點：卡片格子（HTML，不是 SVG）
function prepArt(ctx) {
  const bare = ctx.features.has('bare');
  const parts = [
    ['board', ctx.board.name, 1, { touch: ctx.board.touch }],
    ['perfboard', '單面洞洞板（裁成 14×9 孔）', 1],
    ['resistor', '1kΩ 電阻（R1）', 1, { bands: ['brown', 'black', 'red', 'gold'] }],
    ['resistor', '220Ω 電阻（R4）', 1, { bands: ['red', 'red', 'brown', 'gold'] }],
    ['resistor', '10kΩ 電阻（R2、R3）', 2, { bands: ['brown', 'black', 'orange', 'gold'] }],
    bare ? ['to92', `${Q1.value} 電晶體（Q1）`, 1, { label: Q1.value }] : null,
    bare ? ['diode', '1N4148 二極體（D1）', 1] : null,
    ['ecap', '100µF 電解電容（C1）', 1],
    ['ccap', '100nF（104）陶瓷電容（C2）', 1],
    bare ? ['motor', '1027 震動馬達', 1] : ['motorModule', '震動馬達模組（GND／VCC／IN）', 1],
    ['fsr', '薄膜壓力感測器', 1],
    ['header2', '2pin 排母（插感壓片）', 1],
    ['amp', 'keyestudio SC8002B 功放（自帶喇叭）', 1],
    ['imu', 'GY-291 加速度計（ADXL345）', 1],
    ctx.features.has('encoder') ? ['ec11', 'EC11 旋鈕模組', 1] : null,
    ['battery', '3.7V 約 1000mAh 鋰電池（有保護板）＋PH2.0 對插線', 1],
    ['wires', '28AWG 多色矽膠線', '數色'],
    ['heatshrink', '熱縮套管', '一包'],
    ['solid', '單芯線（裸線、跳線）', '一段'],
  ].filter(Boolean);
  const tools = [
    ['iron', '溫控烙鐵'], ['solder', '0.6–0.8mm 含松香焊錫'], ['flux', '助焊劑'], ['braid', '吸錫線'],
    ['cutter', '斜口鉗'], ['stripper', '剝線鉗'], ['meter', '三用電表'], ['tweezers', '鑷子'], ['clamp', '固定夾（第三隻手）'],
  ];
  const card = ([k, name, qty, opt]) => h('div', { class: 'part-card' },
    svgEl(icon(k, opt)), h('div', { class: 'part-name' }, name), qty ? h('div', { class: 'part-qty' }, `× ${qty}`) : null);
  return h('div', { class: 'prep' },
    h('h4', {}, '零件'), h('div', { class: 'part-grid' }, parts.map(card)),
    h('h4', {}, '工具'), h('div', { class: 'part-grid' }, tools.map((t) => card([t[0], t[1]]))));
}

// ── 步驟 ──
// group：prep 準備、hub 小電路板、wire 接線、finish 收尾
export const STEPS = [
  {
    id: 'prep', group: 'prep', title: '工具與零件清點',
    lead: '先把東西全部攤開。少一樣現在就知道，不用焊到一半才發現。',
    art: prepArt,
    todo: () => [
      '對照左邊清單，把零件一樣一樣排好',
      '電阻分三堆：1kΩ（棕黑紅）、10kΩ（棕黑橙）、220Ω（紅紅棕）；不確定就用電表量',
      '烙鐵插電預熱，溫度設 330–350°C',
    ],
    callouts: () => [['warn', '鋰電池先收起來，<b>最後一步才接</b>。']],
    why: [
      { art: A.ironTemp(), title: '為什麼要溫控烙鐵？', text: '<p>溫度太低，錫還沒完全熔化就凝固，變成灰灰的「冷焊」，一碰就斷；太高會燒壞零件，也會讓洞洞板的銅環翹起來。</p><p>330–350°C 是大部分焊錫的甜蜜點。</p>' },
      { art: A.batteryShort(), title: '鋰電池為什麼最後才接？', text: '<p>鋰電池能在一瞬間放出好幾安培的電流。焊接時一不小心讓正負極碰在一起，電線會燙到冒煙。</p><p>全部檢查完，最後才讓它上場。</p>' },
      { art: A.protection(), title: '保護板在做什麼？', text: '<p>電池上那塊小電路板，會在過度充電、電量用光、短路時自動斷電。</p><p>沒有保護板的鋰電池，不要用在這個專案。</p>' },
    ],
  },
  {
    id: 'solder-101', group: 'prep', title: '焊接暖身',
    lead: '先在洞洞板剪下來的邊角練 5 個焊點，手感對了再上正式的板子。',
    art: () => A.joints(),
    todo: () => [
      '烙鐵頭同時碰到「孔的銅環」和「零件腳」，數 1、2',
      '焊錫送到銅環上（不是送到烙鐵頭），讓錫自己流進去',
      '先移開焊錫、再移開烙鐵；焊點要像亮亮的小火山',
      '線頭剝 3mm、先上錫再焊；<b>熱縮套管要在焊之前先套上</b>',
    ],
    callouts: () => [['tip', '焊點灰灰皺皺的就是冷焊：補一點助焊劑，重新加熱一次就好。']],
    why: [
      { art: A.joints(), title: '好焊點長什麼樣子？', text: '<p>好焊點像小火山：亮、平滑、包住整個銅環。</p><p>圓圓的錫球代表錫沒吃進銅環；兩個焊點黏在一起叫「橋接」，會短路。</p>' },
      { art: A.tinning(), title: '為什麼線要先上錫？', text: '<p>多股線的細銅絲一碰就散開。先讓錫吃進去，線頭就變成一根硬硬的針，焊的時候一碰就黏。</p>' },
      { art: A.fluxPan(), title: '助焊劑是什麼？', text: '<p>金屬表面有一層看不見的氧化層，錫會「不沾」。助焊劑把它洗掉，像煎蛋前先熱鍋放油，錫才流得順。</p>' },
    ],
  },
  {
    id: 'board', group: 'prep', title: '認識主板', sides: true, side: 'back', sideLabels: ['正面・螢幕', '背面・排針'],
    lead: '主板翻到背面、USB 朝上：之後每張圖都是這個看法。',
    art: (ctx) => (ctx.side === 'front' ? boardFrontArt(ctx) : boardArt(ctx)),
    todo: (ctx) => {
      const ws = boardWiresOf(null, ctx);
      const fmt = (w) => `${b(w.pin)}（${pinWhere(ctx, w.key)}）`;
      const power = ws.filter((w) => ['3V3', 'GND', 'VBAT'].includes(w.pin));
      const groups = new Map();
      for (const w of ws) {
        if (power.includes(w)) continue;
        const g = w.to.split(' ')[0];
        if (!groups.has(g)) groups.set(g, []);
        groups.get(g).push(w);
      }
      return [
        '主板翻到<b>背面</b>（看得到晶片和 SD 卡槽），USB 朝上',
        `電源：${power.map(fmt).join('、')}`,
        ...[...groups].map(([g, list]) => `接${g}：${list.map(fmt).join('、')}`),
      ];
    },
    callouts: () => [['info', '一定要看<b>背面</b>、USB 朝上，左右才會跟圖一樣；翻回正面時左右會對調。']],
    why: [
      { art: A.gpio(), title: 'GPIO 是什麼？', text: '<p>General Purpose Input/Output，通用輸入輸出腳。</p><p>程式可以決定每一支腳要「聽」（讀電壓），還是「說」（輸出 0V 或 3.3V）。</p>' },
      { art: A.flip(), title: '為什麼看背面？', text: '<p>正面是螢幕，看不到腳位的字；官方腳位圖也是畫背面。</p><p>記住「USB 朝上、看得到晶片」，左右就不會搞反。</p>' },
      { art: A.pinChoice(), title: '為什麼挑這幾支腳？', text: '<p>挑的都是排針上空著、沒被螢幕和 SD 卡佔用的腳。</p><p>序列埠（IO43、IO44）和開機鍵留著，燒錄韌體要用。</p>' },
    ],
  },
  {
    id: 'hub-cut', group: 'hub', title: '準備小電路板', sides: true, sideLabels: ['正面・裁切', '背面・記號'],
    lead: '主板的電源腳不夠分，我們自己做一塊「配電中心」。',
    art: (ctx) => (ctx.side === 'back' ? hubArt(ctx, 'hub-cut', 'back') : hubCutArt()),
    todo: () => [
      `從大片洞洞板裁出 ${b(`${HUB.cols} × ${HUB.rows} 孔`)}（用美工刀沿著孔線劃幾次再折斷）`,
      '銅環面朝下放好，左上角那個孔就是 <b>A1</b>',
      '用麥克筆在 A1 旁邊點一個記號，<b>正反面都要點</b>',
    ],
    callouts: () => [['tip', '之後都用「欄字母＋列數字」講孔位：C4 就是第 C 欄、第 4 列。']],
    why: [
      { art: A.powerStrip(), title: '為什麼要小電路板？', text: '<p>主板只有一支 3V3、幾支 GND，但要供電的東西有好幾樣。</p><p>小電路板就像延長線，把一支腳分給大家用；馬達驅動和濾波的零件也住在這裡。</p>' },
      { art: A.singleSided(), title: '單面洞洞板怎麼用？', text: '<p>每個孔都是獨立的小銅環。零件從正面插進去，翻到背面焊，再用錫或裸線把該連的孔連起來。</p>' },
      { art: A.markerA1(), title: '為什麼要點記號？', text: '<p>翻到背面時左右會顛倒，這是最常焊錯的地方。</p><p>A1 的記號就是你的指北針：不管正面背面，先找到它再數孔。</p>' },
    ],
  },
  {
    id: 'hub-rails', group: 'hub', title: '電源軌', sides: true, side: 'back',
    lead: '這一步全部在背面做：鋪好「總水管」——3V3、兩條 GND、一小段電池電源。',
    art: (ctx) => hubArt(ctx, 'hub-rails'),
    todo: (ctx) => hubTodos('hub-rails', ctx, ['板子翻到背面（銅環那面），A1 記號在右上角', '單芯線剝掉外皮、拉直，當作裸線']),
    callouts: () => [
      ['tip', '裸線貼著銅環一路點錫。<b>不要把孔塞滿</b>：之後外接的線要從正面插進這些孔。'],
      ['warn', '跳線一定要用<b>有外皮</b>的線：它會經過 B5、B7 旁邊，裸線一碰就短路。'],
    ],
    why: [
      { art: A.powerPipe(), title: '電源軌＝總水管', text: '<p>3V3 軌就像家裡的總水管，每個要用電的零件都從這裡接一根小水管。</p>' },
      { art: A.groundLoop(), title: 'GND 是回家的路', text: '<p>電流要繞一圈回到起點才會流。所有零件的 GND 都要接在一起，這條路才是通的。</p>' },
      { art: A.twoGnd(), title: '為什麼有兩條 GND？', text: '<p>上下各一條，零件就近接地，線比較短。</p><p>A 欄那條跳線把兩條連起來，變成同一條。</p>' },
    ],
  },
  {
    id: 'hub-cap', group: 'hub', title: '穩壓電容 C1', sides: true,
    lead: '翻回正面：一顆大電容跨在 3V3 軌和 GND 軌上，馬達啟動時幫忙頂住電壓。',
    art: (ctx) => hubArt(ctx, 'hub-cap'),
    todo: (ctx) => hubTodos('hub-cap', ctx, ['板子翻回正面（零件面），A1 記號在左上角']),
    callouts: () => {
      const c = HUB.parts.find((p) => p.kind === 'ecap');
      return [
        ['warn', `<b>長腳（+）插 ${hb(c.pins.p)}</b>（3V3 軌），白色條紋那邊（−）插 ${hb(c.pins.n)}（GND 軌）。電解電容接反會鼓起來，甚至爆開。`],
      ];
    },
    why: [
      { art: A.tank(), title: '100µF＝小水塔', text: '<p>馬達一啟動就突然要大電流。電容先頂著，主板的電壓才不會往下掉、不會重開機。</p>' },
    ],
  },
  {
    id: 'hub-resistors', group: 'hub', title: '兩顆電阻', sides: true,
    lead: (ctx) => (ctx.features.has('module')
      ? 'R1、R2 接在馬達模組的 IN 前面：一顆限流，一顆讓馬達開機時乖乖不動。'
      : 'R1、R2 是電晶體的方向盤：一顆限流，一顆讓它開機時乖乖不動。'),
    art: (ctx) => hubArt(ctx, 'hub-resistors'),
    todo: (ctx) => hubTodos('hub-resistors', ctx),
    callouts: (ctx) => [['tip', '色環看不清楚就用電表量：1kΩ 讀到約 0.98–1.02k、10kΩ 約 9.8–10.2k。220Ω（約 0.22k）是聲音濾波用的，先放旁邊。'], padTip('hub-resistors', ctx)].filter(Boolean),
    why: [
      { art: A.colorCode(), title: '色環怎麼讀？', text: '<p>前兩環是數字、第三環是「後面補幾個 0」、第四環金色是誤差 5%。</p><p>5 環的金屬膜電阻：前三環才是數字。看不懂就用電表量，最準。</p>' },
      { art: A.currentLimit(), title: 'R1 1kΩ：限流', text: '<p>IO6 直接接電晶體，會灌進太多電流。1kΩ 把它限制在約 2.6mA，剛好打開電晶體。</p>' },
      { art: A.pulldown(), title: 'R2 10kΩ：下拉', text: '<p>開機那一瞬間，程式還沒設定 IO6，它是「浮空」的，馬達可能亂震。</p><p>10kΩ 像彈簧一樣把它往 GND 拉，馬達就乖乖不動。</p>' },
    ],
  },
  {
    id: 'hub-transistor', group: 'hub', title: () => `電晶體 ${Q1.value}`, sides: true,
    lead: '讓 IO6 的小訊號，控制馬達的大電流。',
    art: (ctx) => hubArt(ctx, 'hub-transistor'),
    todo: (ctx) => hubTodos('hub-transistor', ctx),
    callouts: () => [
      ['warn', `<b>平面朝${FLAT_ZH[Q1.flat]}</b>：從左到右是 ${Q1.pinout.split('').join('、')}。插反了馬達會很弱，或電晶體發燙。`],
      ['swap', altBox()],
    ],
    why: [
      { art: A.faucet(), title: '小水龍頭控制大水管', text: '<p>IO6 只能給幾 mA，馬達要 80–120mA。</p><p>電晶體的基極（B）流一點點電流，就能打開集極（C）到射極（E）的大電流。</p>' },
      { art: A.ebc({ pinout: Q1.pinout, label: Q1.value }), title: 'E、B、C 是什麼？', text: `<p>射極 E 接地、基極 B 是控制、集極 C 接馬達。</p><p>${Q1.value} 平面朝自己、腳朝下時，左到右是 ${Q1.pinout.split('').join('、')}。每種型號的順序不一定一樣，換料一定要查。</p>` },
      { art: A.ebcWrong(), title: '方向為什麼這麼重要？', text: '<p>E 和 C 對調，電晶體還是「有點」能用，但變成很差的開關：馬達很弱、電晶體發燙。這種錯最難查，插之前多看一眼。</p>' },
    ],
  },
  {
    id: 'hub-diode', group: 'hub', title: '二極體 1N4148', sides: true,
    lead: '馬達斷電時的洩壓閥，保護電晶體。它有方向。',
    art: (ctx) => hubArt(ctx, 'hub-diode'),
    todo: (ctx) => hubTodos('hub-diode', ctx),
    callouts: (ctx) => {
      const d = HUB.parts.find((p) => p.kind === 'diode');
      return [
        ['warn', `${pref('D1')} 的<b>黑色色帶插 ${hb(d.pins.k)}</b>（接 3V3 軌）。插反的話，馬達一啟動 3V3 就短路。`],
        padTip('hub-diode', ctx),
        altTip('hub-diode'),
      ].filter(Boolean);
    },
    why: [
      { art: A.flyback(), title: '二極體＝洩壓閥', text: '<p>馬達裡面是線圈，斷電的瞬間會反衝出很高的電壓。</p><p>1N4148 讓這股電流繞回馬達自己消化，保護電晶體。</p>' },
      { art: A.diodeDirection(), title: '色帶方向', text: '<p>色帶那端是負極（K），要朝 3V3。</p><p>插反的話，電晶體一打開，3V3 就直接短路到 GND。</p>' },
    ],
  },
  {
    id: 'hub-fsr', group: 'hub', title: '感壓分壓電阻', sides: true,
    lead: '一顆 10kΩ，把「壓力」翻譯成 IO2 讀得到的電壓。',
    art: (ctx) => hubArt(ctx, 'hub-fsr'),
    todo: (ctx) => hubTodos('hub-fsr', ctx),
    callouts: (ctx) => [padTip('hub-fsr', ctx), ['tip', '之後覺得輕摸讀不到，可以把 R3 換成 47kΩ，會更靈敏。']].filter(Boolean),
    why: [
      { art: A.seesaw(), title: '分壓＝蹺蹺板', text: '<p>感壓片和 10kΩ 串在 3V3 和 GND 之間，IO2 在中間量電壓。</p><p>壓得越用力，感壓片電阻越小，IO2 的電壓就越高。</p>' },
      { art: A.fsrIdle(), title: '沒碰的時候呢？', text: '<p>感壓片沒被壓時電阻超過 1MΩ，IO2 被 10kΩ 拉到接近 0V。程式就知道「沒人摸」。</p>' },
      { art: A.sensitivity(), title: '想更靈敏？', text: '<p>換大一點的電阻（例如 47kΩ），輕輕摸電壓就會跳起來。代價是用力抱和輕摸的差別變小。</p>' },
    ],
  },
  {
    id: 'hub-audio', group: 'hub', title: '聲音濾波', sides: true,
    lead: 'ESP32-S3 沒有類比輸出，聲音要靠一顆電阻和一顆電容「磨」出來。',
    art: (ctx) => hubArt(ctx, 'hub-audio'),
    todo: (ctx) => hubTodos('hub-audio', ctx),
    callouts: (ctx) => [['info', `${pref('C2')}（104）陶瓷電容<b>不分正負</b>，怎麼插都可以。${pref('R4')} 是 <b>220Ω（紅紅棕）</b>，不是 1kΩ。`], padTip('hub-audio', ctx)].filter(Boolean),
    why: [
      { art: A.noDac(), title: 'ESP32-S3 沒有 DAC', text: '<p>它的腳只能輸出 0V 或 3.3V，沒辦法直接輸出「中間」的電壓，也就做不出聲音的波形。</p>' },
      { art: A.pdm(), title: 'PDM：用快速開關假裝', text: '<p>一支腳每秒開關上百萬次。開的時間越密，平均起來電壓越高——這個平均值就是聲音。</p>' },
      { art: A.lowpass(), title: '220Ω＋100nF：把它磨平', text: '<p>電阻和電容組成低通濾波器，像海綿一樣把很快的抖動吸掉，只留下約 7kHz 以下的聲音，再交給功放放大。</p><p>電阻不能再小：越小，ESP32 那支腳要推的電流越大。</p>' },
    ],
  },
  {
    id: 'hub-check', wide: true, group: 'hub', title: '小電路板自我檢查', sides: true, side: 'back',
    lead: '接任何線之前，先確定沒有短路。這一步能省下之後很多麻煩。',
    art: (ctx) => (ctx.side === 'back' ? hubCheckArt(ctx) : hubArt(ctx, 'hub-check')),
    todo: () => [
      '電表轉到蜂鳴檔（🔊 或二極體符號）',
      '量 <b>A1（3V3）↔ A2（GND）</b>：不能一直嗶',
      '量 <b>B7（VBAT）↔ A9（GND）</b>：不能嗶',
      '翻到背面對照圖，一條一條看錫橋有沒有多連或少連',
    ],
    callouts: () => [['info', '電容會讓電表「短嗶一下」就停，那是在充電，正常；一直嗶才是短路。']],
    why: [
      { art: A.beep(), title: '蜂鳴檔在量什麼？', text: '<p>兩點之間電阻很小，電表就嗶。</p><p>3V3 和 GND 之間如果嗶，代表有地方連在一起了——通電就是短路。</p>' },
      { art: A.capBeep(), title: '為什麼會短嗶一下？', text: '<p>電表在幫 C1 充電，充飽就不嗶了。一直嗶才是真的有問題。</p>' },
    ],
  },
  {
    id: 'wire-board', wide: true, group: 'wire', title: '主板 → 小電路板',
    lead: '六條線：三條電源、三條訊號。',
    art: wireBoardArt, conn: true, sides: true, sideLabels: SIDES_WIRES,
    todo: () => [
      '每條線剪成「實際距離＋1–2cm」，兩頭剝 3mm、上錫',
      '<b>先套熱縮套管</b>，再把線焊在主板的排針上',
      '另一頭從正面插進小電路板的孔，翻面焊好',
    ],
    callouts: () => [['tip', '線焊在排針上：線頭貼著針腳，烙鐵碰一下就好，再把熱縮套管推上去包住。']],
    why: [
      { art: A.wireLength(), title: '線要多長？', text: '<p>比實際距離多 1–2cm，裝進外殼才有餘裕。太長會亂成一團，也比較容易收到雜訊。</p>' },
      { art: A.pinSolder(), title: '怎麼焊在排針上？', text: '<p>線頭先上錫，貼著針腳的根部，烙鐵碰一下讓兩邊的錫融在一起。最後用熱縮套管包住，避免碰到隔壁的腳。</p>' },
      { art: A.colorsMeaning(), title: '顏色的意義', text: '<p>電不在乎顏色，但人在乎。整套教材統一配色：紅 3V3、黑 GND、橘電池，接錯一眼就看得出來。</p>' },
    ],
  },
  {
    id: 'wire-motor', wide: true, group: 'wire',
    title: (ctx) => (ctx.features.has('module') ? '震動馬達模組' : '震動馬達'),
    lead: (ctx) => (ctx.features.has('module')
      ? '三條線：VCC、GND、IN。驅動電路已經做在模組上了。'
      : '兩條線，不分正負。'),
    art: wireMotorArt, conn: true, sides: true, sideLabels: SIDES_WIRES,
    todo: (ctx) => {
      const at = (id) => hb(HUB.pads.find((p) => p.id === id).hole);
      if (ctx.features.has('module')) {
        return [
          `模組 VCC → ${at('mod-vcc')}、GND → ${at('mod-gnd')}、IN → ${at('mod-in')}`,
          '線焊在模組的排針上，再把熱縮套管推上去包好',
        ];
      }
      return [
        `馬達的兩條線分別焊到 ${at('motor-1')}、${at('motor-2')}（哪條接哪邊都可以）`,
        '馬達的線很細：剝 2mm 就夠，剝線鉗不要夾太用力',
      ];
    },
    callouts: (ctx) => (ctx.features.has('module')
      ? [['info', `IN 接在前面焊好的 ${pref('R1')}、${pref('R2')} 後面：限流和開機不亂震，模組照樣用得上。`],
        ['tip', '腳位以模組上印的字為準（GND、VCC、IN），不同賣家順序可能不一樣。']]
      : []),
    why: (ctx) => (ctx.features.has('module') ? [
      { art: A.moduleInside(), title: '模組裡有什麼？', text: '<p>看模組正面：那顆小黑片是電晶體、旁邊是二極體和電阻——就是商品版自己焊的 Q1、D1。</p><p>模組只是把同一套電路先幫你做好。</p>' },
      { art: A.moduleVsBare(), title: '有模組 vs. 自己焊', text: '<p>模組：接三條線就好，不容易出錯；但比較大、比較貴。</p><p>自己焊：小、便宜、可以塞進任何形狀的外殼——真正的產品都是這樣做。</p>' },
      { art: A.motorVoltage(), title: '為什麼 VCC 接 3V3？', text: '<p>模組上的馬達額定 3V 左右。接 3V3 剛好；接電池（充飽 4.2V）會超過上限。</p>' },
    ] : [
      { art: A.motorPolarity(), title: '馬達不分正負', text: '<p>1027 是一般的直流馬達，接反只是轉的方向相反，震起來一樣。</p>' },
      { art: A.motorVoltage(), title: '為什麼接 3V3？', text: '<p>這顆馬達的額定是 3V、上限 4.0V。接 3V3 剛好；接電池（充飽 4.2V）會超過上限。</p>' },
    ]),
  },
  {
    id: 'wire-fsr', wide: true, group: 'wire', title: '薄膜壓力感測器',
    lead: '感壓片怕熱，不直接焊：線焊在排母上，再把感壓片插進去。',
    art: wireFsrArt, conn: true, sides: true, sideLabels: SIDES_WIRES,
    todo: () => {
      const [a, c] = HUB.pads.filter((p) => p.step === 'wire-fsr').map((p) => hb(p.hole));
      return [
        '兩條線先焊在 2pin 排母上，套熱縮套管',
        `另一端焊到 ${a}、${c}（不分正負）`,
        '把感壓片的兩支腳插進排母',
      ];
    },
    callouts: () => [['warn', '<b>不要用烙鐵直接燙感壓片</b>的薄膜或腳，一燙就壞。']],
    why: [
      { art: A.fsrInside(), title: '它怎麼感應壓力？', text: '<p>薄膜裡面有導電顆粒。壓力越大，顆粒擠得越近，電阻就越小。</p>' },
      { art: A.fsrHeat(), title: '為什麼用排母？', text: '<p>感壓片是塑膠薄膜加導電墨水，烙鐵一燙就變形斷路。用排母插，壞了也能直接換一片。</p>' },
    ],
  },
  {
    id: 'wire-amp', wide: true, group: 'wire', title: '喇叭功放 SC8002B',
    lead: '三條線：電源、地線、聲音。',
    art: wireAmpArt, conn: true, sides: true, sideLabels: SIDES_WIRES,
    todo: () => [
      ...HUB.pads.filter((p) => p.step === 'wire-amp').map((p) => `模組 ${b(p.label.replace('功放 ', ''))} → 小電路板 ${hb(p.hole)}`),
      '把模組上的<b>音量旋鈕轉到最小</b>',
    ],
    callouts: () => [
      ['warn', '音量旋鈕<b>先轉到最小</b>，通電後再慢慢調大，避免破音或燒喇叭。'],
      ['info', '腳位以模組上印的字為準（G、V、S），順序可能跟圖不一樣。'],
    ],
    why: [
      { art: A.ampMagnify(), title: '功放在做什麼？', text: '<p>ESP32 出來的訊號太小，推不動喇叭。SC8002B 把它放大約 8.5 倍。</p>' },
      { art: A.ampPower(), title: '為什麼接電池不接 3V3？', text: '<p>喇叭大聲時一下子要很多電流。接在 3V3 會跟主板搶電，畫面閃爍或重開機；接電池就不會。</p>' },
      { art: A.ampVolume(), title: '為什麼先轉最小？', text: '<p>訊號太大會破音，喇叭也可能燒掉。先小聲，確認沒問題再慢慢調大。</p>' },
    ],
  },
  {
    id: 'wire-imu', wide: true, group: 'wire', title: '加速度計 GY-291',
    lead: '六條線：三條到小電路板、三條到主板。另外模組上要做一個小橋。',
    art: wireImuArt, conn: true, sides: true, sideLabels: SIDES_WIRES,
    todo: (ctx) => {
      const hubPads = HUB.pads.filter((p) => p.step === 'wire-imu');
      const sig = boardWiresOf('wire-imu', ctx);
      return [
        `${hubPads.map((p) => `${b(p.label.replace('GY-291 ', ''))} → ${hb(p.hole)}`).join('、')}`,
        '模組上把 <b>CS 和 VCC</b> 用一小段線或錫橋連起來',
        `${sig.map((w) => `${b(w.to.replace('GY-291 ', ''))} → 主板 ${b(w.pin)}`).join('、')}`,
      ];
    },
    callouts: () => [['info', 'CS 不接 VCC，它會以為你要用 SPI，主板就找不到它。']],
    why: [
      { art: A.i2cBus(), title: 'I2C＝兩條線的公車', text: '<p>SDA 載資料、SCL 打拍子。一條公車可以載很多乘客（裝置），靠位址分辨，就像站牌。GY-291 的位址是 0x53。</p>' },
      { art: A.i2cPins(), title: 'CS 和 SDO 為什麼要接？', text: '<p>CS 拉高，告訴它「用 I2C，不是 SPI」；SDO 接地，決定位址是 0x53。</p>' },
      { art: A.doorbell(), title: 'INT1＝門鈴', text: '<p>ADXL345 自己會偵測「拍一下」「拿起來」。偵測到就按門鈴叫醒主板，主板平常可以放心睡覺省電。</p>' },
    ],
  },
  {
    id: 'wire-ec11', wide: true, group: 'wire', title: '旋鈕 EC11',
    lead: '轉一轉、按一下：自玩版的操作都在這裡。',
    art: wireEc11Art, conn: true, sides: true, sideLabels: SIDES_WIRES,
    todo: (ctx) => {
      const hubPads = HUB.pads.filter((p) => p.step === 'wire-ec11' && padOk(p, ctx));
      const sig = boardWiresOf('wire-ec11', ctx);
      return [
        `${hubPads.map((p) => `${b(p.label.replace('旋鈕 ', ''))} → ${hb(p.hole)}`).join('、')}`,
        `${sig.map((w) => `${b(w.to.replace('旋鈕 ', ''))} → 主板 ${b(w.pin)}`).join('、')}`,
      ];
    },
    callouts: () => [['warn', '<b>＋ 一定接 3V3</b>，不要接 5V 或 VBUS，會燒壞主板的腳。']],
    why: [
      { art: A.encoderPhases(), title: '兩個錯開的開關', text: '<p>轉的時候，A、B 兩個開關輪流通斷。誰先通，就知道往哪個方向轉。</p>' },
      { art: A.encoderPress(), title: '按下去呢？', text: '<p>旋鈕往下按就是 SW，接通到 GND。程式看到 SW 變 0V，就知道你按了。</p>' },
      { art: A.level3v3(), title: '為什麼一定要 3V3？', text: '<p>模組上的上拉電阻接到「＋」。＋接 5V，CLK、DT 就會送 5V 進主板，ESP32 的腳最多只能吃 3.3V。</p>' },
    ],
  },
  {
    id: 'wire-battery', wide: true, group: 'wire', title: '電池接頭',
    lead: '只焊接頭，電池先不要插。',
    art: wireBatteryArt, conn: true, sides: true, sideLabels: SIDES_WIRES,
    todo: () => {
      const p = HUB.pads.find((x) => x.id === 'batt-p');
      const n = HUB.pads.find((x) => x.id === 'batt-n');
      return [
        '對插線先插上電池，兩條線頭<b>分開不要互碰</b>；電表轉直流電壓檔量這兩條線',
        '讀到 <b>+3.7V 左右</b>：紅棒碰的那條就是 +（讀到負的就是反過來）。量完<b>立刻拔掉電池</b>',
        `+ 那條 → ${hb(p.hole)}、另一條 → ${hb(n.hole)}（照量的結果，不是照線的顏色）`,
      ];
    },
    callouts: () => [['warn', '<b>紅黑線不一定照規矩</b>：不同廠商的 PH2.0 接頭方向常常相反，一定要量。']],
    why: [
      { art: A.polarity(), title: '怎麼確認正負？', text: '<p>紅棒、黑棒各碰一邊。讀到正的 3.7V，紅棒碰的就是 +；讀到負的，就是反了。</p>' },
      { art: A.vbatCharge(), title: '電池接在 VBAT', text: '<p>主板上有充電晶片，插 USB 時會自動幫電池充電，同時改由 USB 供電。</p>' },
      { art: A.notYet(), title: '為什麼還不插？', text: '<p>先用 USB 測過一切正常，再讓電池上場。出問題時 USB 比較好拔，也比較安全。</p>' },
    ],
  },
  {
    id: 'power-check', wide: true, group: 'finish', title: '第一次通電', sides: true, sideLabels: ['排針那面', '整組翻過來'],
    lead: '先 USB、後電池。',
    art: powerCheckArt,
    todo: () => [
      '再量一次：3V3↔GND、VBAT↔GND 不能一直嗶',
      '<b>只插 USB</b>（電池不要插）：螢幕亮、沒有東西發燙',
      '到「③ 寫入裝置」刷測試韌體，照螢幕上的清單測每個零件',
      '全部 ✅ 之後拔 USB、插上電池，再插 USB 看充電燈',
    ],
    callouts: () => [['warn', '有東西發燙、冒煙或聞到焦味：<b>馬上拔 USB</b>，回到「小電路板自我檢查」。']],
    why: [
      { art: A.usbFirst(), title: '為什麼先 USB？', text: '<p>電腦的 USB 有限流保護，出問題比較安全，拔起來也比較快。</p>' },
      { art: A.touchHot(), title: '摸一摸', text: '<p>通電 30 秒後，摸摸電晶體和主板的穩壓器。溫溫的正常，燙手就馬上拔電。</p>' },
      { art: A.chargeLed(), title: '充電燈', text: '<p>插上電池再插 USB，主板上的充電燈會亮；充飽後會熄滅。</p>' },
    ],
    cta: { href: 'deploy.html', label: '前往 ③ 寫入裝置' },
  },
  {
    id: 'done', wide: true, group: 'finish', title: '硬體完成！', sides: true, sideLabels: ['完成・正面', '完成・背面'],
    lead: '電路全部焊好了。接下來刷韌體、放進你的角色。',
    art: doneArt,
    todo: () => [],
    callouts: () => [
      ['info', '左邊這張是<b>全部接好的樣子</b>：拿來跟你的成品逐條對照。按「⤢ 放大」看細節，滑鼠移到模組或孔上看說明。'],
      ['ok', '記得把用剩的零件收好，感壓片和電池放在不會被壓到的地方。'],
    ],
    why: [
      { art: A.allDone(), title: '你剛剛做了什麼？', text: '<p>一塊配電中心、一個馬達開關、一個壓力感測、一組聲音濾波，再把六個模組接在一起。</p><p>剩下的事交給韌體和素材。</p>' },
    ],
    cta: { href: 'deploy.html', label: '前往 ③ 寫入裝置' },
  },
];

export const GROUP_ZH = { prep: '準備', hub: '小電路板', wire: '接線', finish: '收尾' };

export function makeContext(version) {
  const board = version.boardInfo;
  const features = featuresOf(version);
  // 哪些步驟只屬於某些配置：統一由 data/hub.js 的 STEP_ONLY 決定
  const steps = STEPS.filter((s) => included({ only: STEP_ONLY[s.id] }, features));
  const ctx = { version, board, features, steps, order: steps.map((s) => s.id), side: 'front' };
  ctx.used = usedPins(ctx);
  return ctx;
}
