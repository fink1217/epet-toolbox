// 素材生成器「為什麼」繪本的插圖。每個函式回傳一段 SVG 字串。
import { pixelActor } from './stage.js';

const INK = '#1B1A17';
const LINE = '#CFC5B1';
const GREEN = '#22D35B';
const TEAL = '#2F6B55';
const RED = '#B3392B';
const YOLK = '#C49A3C';
const ACCENT = '#A63A2B';
const WHITE = '#FFFDF8';
const FONT = 'font-family="Noto Sans TC, sans-serif"';

const svg = (w, h, body) =>
  `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${body}</svg>`;

// 插畫版角色：白色小貓，跟提示詞的預設角色一樣。(cx, 腳底 y, 大小)
const pal = (cx, foot, s = 1, extra = '') => `
  <g transform="translate(${cx} ${foot}) scale(${s})" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round">
    <path d="M-21 -36 L-17 -58 L-5 -46Z M21 -36 L17 -58 L5 -46Z" fill="${WHITE}"/>
    <path d="M-24 -6 C-26 -32 -20 -48 0 -48 C20 -48 26 -32 24 -6 C22 0 -22 0 -24 -6Z" fill="${WHITE}"/>
    <circle cx="-9" cy="-28" r="3.2" fill="${INK}" stroke="none"/><circle cx="9" cy="-28" r="3.2" fill="${INK}" stroke="none"/>
    <path d="M-4 -21 q2 2 4 0 q2 2 4 0" fill="none" stroke-width="1.6" stroke-linecap="round"/>
    <ellipse cx="-15" cy="-19" rx="3.6" ry="2" fill="${ACCENT}" opacity=".35" stroke="none"/><ellipse cx="15" cy="-19" rx="3.6" ry="2" fill="${ACCENT}" opacity=".35" stroke="none"/>
    ${extra}
  </g>`;

const label = (x, y, text, color = INK, size = 13, anchor = 'middle') =>
  `<text x="${x}" y="${y}" text-anchor="${anchor}" ${FONT} font-size="${size}" fill="${color}">${text}</text>`;
const ok = (x, y) => `<circle cx="${x}" cy="${y}" r="13" fill="${TEAL}"/><path d="M${x - 6} ${y} l4 4 l8 -8" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
const no = (x, y) => `<circle cx="${x}" cy="${y}" r="13" fill="${RED}"/><path d="M${x - 5} ${y - 5} l10 10 M${x + 5} ${y - 5} l-10 10" stroke="#fff" stroke-width="3" stroke-linecap="round"/>`;

// 棋盤格（假透明）
function checker(x, y, w, h, s = 10) {
  let out = `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#fff"/>`;
  for (let j = 0; j * s < h; j++)
    for (let i = 0; i * s < w; i++)
      if ((i + j) % 2) out += `<rect x="${x + i * s}" y="${y + j * s}" width="${Math.min(s, w - i * s)}" height="${Math.min(s, h - j * s)}" fill="#E4E4E4"/>`;
  return out;
}

// ── 純色背景 vs 假透明 ──
export function artSolidBg() {
  return svg(320, 180, `
    <rect x="14" y="20" width="130" height="120" rx="10" fill="${GREEN}"/>
    ${pal(79, 122, 1.25)}
    ${ok(132, 32)}
    ${label(79, 162, '純色背景：一眼分得出來')}
    <g>${checker(176, 20, 130, 120)}</g>
    <rect x="176" y="20" width="130" height="120" rx="10" fill="none" stroke="${LINE}"/>
    ${pal(241, 122, 1.25)}
    ${no(294, 32)}
    ${label(241, 162, '「透明」其實是畫的格子')}
  `);
}

// ── 從邊緣倒油漆 ──
export function artPaintBucket() {
  const arrows = [[30, 40, 60, 62], [290, 40, 260, 62], [30, 150, 60, 128], [290, 150, 260, 128]]
    .map(([x1, y1, x2, y2]) => `<path d="M${x1} ${y1} L${x2} ${y2}" stroke="${TEAL}" stroke-width="3" marker-end="url(#ah)"/>`).join('');
  return svg(320, 190, `
    <defs><marker id="ah" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0 L10 5 L0 10z" fill="${TEAL}"/></marker></defs>
    ${checker(20, 20, 280, 150, 12)}
    <rect x="20" y="20" width="280" height="150" rx="10" fill="none" stroke="${LINE}" stroke-width="2"/>
    <circle cx="186" cy="100" r="20" fill="none" stroke="${YOLK}" stroke-width="10"/>
    <circle cx="192" cy="100" r="11" fill="${GREEN}"/>
    ${pal(132, 150, 1.6)}
    ${arrows}
    <path d="M204 100 L224 92" stroke="${RED}" stroke-width="1.5"/>
    <text x="226" y="90" ${FONT} font-size="12" fill="${RED}">圍住的綠色</text>
    <text x="226" y="105" ${FONT} font-size="12" fill="${RED}">塗不到</text>
    ${label(160, 186, '從四邊往內塗，碰到輪廓就停', INK, 13)}
  `);
}

// ── 魔術棒 / 全部同色 ──
export function artWand() {
  return svg(320, 180, `
    ${checker(20, 20, 130, 130, 10)}
    <circle cx="96" cy="78" r="20" fill="none" stroke="${YOLK}" stroke-width="9"/>
    <circle cx="101" cy="78" r="11" fill="${GREEN}"/>
    ${pal(70, 140, 1.2)}
    <path d="M120 40 l-12 30" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>
    <path d="M122 32 l3 -6 M128 38 l6 -3 M114 34 l-2 -6" stroke="${YOLK}" stroke-width="3" stroke-linecap="round"/>
    ${label(85, 170, '魔術棒：點一下去一塊')}
    ${checker(170, 20, 130, 130, 10)}
    <circle cx="246" cy="78" r="20" fill="none" stroke="${YOLK}" stroke-width="9"/>
    ${pal(220, 140, 1.2)}
    ${label(235, 170, '全部同色：一次全去掉')}
  `);
}

// ── 切幀 ──
export function artSplit() {
  const box = (x, n) => `<rect x="${x}" y="34" width="78" height="96" rx="6" fill="none" stroke="${TEAL}" stroke-width="2" stroke-dasharray="5 4"/>
    <circle cx="${x + 10}" cy="34" r="10" fill="${TEAL}"/>${label(x + 10, 38.5, n, '#fff', 12)}`;
  return svg(320, 180, `
    ${checker(14, 20, 292, 120, 10)}
    ${pal(54, 124, 1.25)}
    ${pal(150, 124, 1.25, `<path d="M-22 -18 q-10 -6 -12 -16" fill="none" stroke-linecap="round"/><circle cx="-34" cy="-37" r="4.5" fill="${WHITE}"/>`)}
    <path d="M196 60 l3 7 l7 1 l-5 5 l1 7 l-6 -4 l-6 4 l1 -7 l-5 -5 l7 -1z" fill="#EAD7A4" stroke="${YOLK}"/>
    ${pal(258, 124, 1.25)}
    ${box(16, 1)}${box(112, 2)}${box(220, 3)}
    <path d="M190 74 q-10 6 -14 0" stroke="${YOLK}" stroke-width="2" fill="none" marker-end="url(#ah2)"/>
    <defs><marker id="ah2" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0 L10 5 L0 10z" fill="${YOLK}"/></marker></defs>
    ${label(160, 162, '連在一起的算一格；小星星跟著最近的那格')}
  `);
}

// ── 同一條腳底線 ──
export function artBaseline() {
  const frame = (x, dy, s) => `<rect x="${x}" y="30" width="56" height="100" rx="4" fill="#fff" stroke="${LINE}"/>${pal(x + 28, 118 + dy, s * 0.9)}`;
  return svg(320, 180, `
    ${frame(14, -10, 0.9)}${frame(76, 6, 1.05)}
    <path d="M14 144 q30 -14 62 0 q30 14 62 0" stroke="${RED}" stroke-width="2.5" fill="none" stroke-dasharray="4 4"/>
    ${no(146, 30)}
    ${label(76, 170, '各畫各的：播起來一直抖')}
    ${frame(180, 0, 1)}${frame(242, 0, 1)}
    <path d="M176 118 h126" stroke="${TEAL}" stroke-width="2.5" stroke-dasharray="6 4"/>
    ${label(302, 146, '↑ 腳底線', TEAL, 11, 'end')}
    ${ok(304, 30)}
    ${label(240, 170, '同一張畫布、同一條腳底線')}
  `);
}

// ── 母檔要畫大 ──
export function artBigMaster() {
  return svg(320, 180, `
    <rect x="16" y="26" width="96" height="96" rx="8" fill="#fff" stroke="${LINE}"/>
    ${pal(64, 112, 1.5)}
    <path d="M118 74 h20" stroke="${INK}" stroke-width="2.5" marker-end="url(#ah3)"/>
    <defs><marker id="ah3" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0 L10 5 L0 10z" fill="${INK}"/></marker></defs>
    <rect x="146" y="50" width="44" height="44" rx="4" fill="#fff" stroke="${LINE}"/>
    ${pal(168, 89, 0.62)}
    ${ok(186, 44)}
    ${label(100, 150, '大縮小：清楚')}
    <rect x="204" y="40" width="92" height="92" rx="6" fill="#fff" stroke="${LINE}"/>
    ${pixelActor(250, 124, 7, '#4A463F')}
    ${no(296, 40)}
    ${label(250, 150, '小放大：糊成格子')}
  `);
}

// ── 背景安全框 ──
export function artSafeArea() {
  const W = 90, H = 160, x0 = 30, y0 = 10;
  const frames = [[172, 320, YOLK], [240, 320, TEAL], [320, 480, ACCENT]].map(([w, h, c]) => {
    const s = Math.max(w / 1080, h / 1920);
    const vw = (w / s) * (W / 1080), vh = (h / s) * (H / 1920);
    return `<rect x="${x0 + (W - vw) / 2}" y="${y0 + (H - vh) / 2}" width="${vw}" height="${vh}" fill="none" stroke="${c}" stroke-width="2.4" stroke-dasharray="5 3"/>`;
  }).join('');
  return svg(320, 180, `
    <rect x="${x0}" y="${y0}" width="${W}" height="${H}" rx="6" fill="#BFE7FF"/>
    <rect x="${x0}" y="${y0 + H * 0.72}" width="${W}" height="${H * 0.28}" fill="#A8E6A1"/>
    <circle cx="${x0 + 70}" cy="${y0 + 26}" r="9" fill="#EAD7A4"/>
    ${frames}
    <path d="M${x0 + 45} ${y0 + 70} l5 10 l11 2 l-8 8 l2 11 l-10 -5 l-10 5 l2 -11 l-8 -8 l11 -2z" fill="${YOLK}"/>
    ${label(150, 50, '每種螢幕看到的範圍不一樣，', INK, 13, 'start')}
    ${label(150, 72, '但「正中間」大家都看得到。', INK, 13, 'start')}
    <rect x="150" y="96" width="14" height="4" fill="${YOLK}"/>${label(170, 101, '172×320', INK, 11, 'start')}
    <rect x="150" y="116" width="14" height="4" fill="${TEAL}"/>${label(170, 121, '240×320', INK, 11, 'start')}
    <rect x="150" y="136" width="14" height="4" fill="${ACCENT}"/>${label(170, 141, '320×480', INK, 11, 'start')}
  `);
}

// ── 圖示留邊 ──
export function artMargin() {
  return svg(320, 170, `
    ${checker(30, 20, 110, 110, 11)}
    <rect x="30" y="20" width="110" height="110" fill="none" stroke="${LINE}"/>
    <rect x="37" y="27" width="96" height="96" fill="none" stroke="${TEAL}" stroke-dasharray="4 3"/>
    <circle cx="85" cy="75" r="44" fill="#C96A5B"/><path d="M85 52 v46 M62 75 h46" stroke="#fff" stroke-width="10" stroke-linecap="round"/>
    ${label(85, 152, '四邊留一點空')}
    ${checker(180, 20, 110, 110, 11)}
    <circle cx="235" cy="75" r="62" fill="#C96A5B"/><path d="M235 40 v70 M200 75 h70" stroke="#fff" stroke-width="12" stroke-linecap="round"/>
    <rect x="180" y="20" width="110" height="110" fill="none" stroke="${RED}" stroke-width="2"/>
    ${label(235, 152, '貼邊：縮小後會被切到', RED)}
  `);
}

// ── 音效：去靜音＋標準化 ──
function wave(x, y, w, amp, pad = 0, color = TEAL) {
  let d = `M${x} ${y}`;
  for (let i = 0; i <= w; i += 3) {
    const t = i / w;
    const inSound = t > pad && t < 1 - pad;
    const a = inSound ? amp * Math.sin(((t - pad) / (1 - 2 * pad)) * Math.PI) * (0.6 + 0.4 * Math.sin(i * 1.7)) : 0;
    d += ` L${x + i} ${y - a} L${x + i + 1.5} ${y + a}`;
  }
  return `<path d="${d}" stroke="${color}" stroke-width="1.6" fill="none"/>`;
}
export function artSound() {
  return svg(320, 190, `
    ${label(16, 22, '原本', INK, 12, 'start')}
    ${wave(16, 50, 130, 8, 0.25, '#8A8377')}
    ${wave(16, 90, 130, 22, 0.1, '#8A8377')}
    <path d="M156 70 h22" stroke="${INK}" stroke-width="2.5" marker-end="url(#ah4)"/>
    <defs><marker id="ah4" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0 L10 5 L0 10z" fill="${INK}"/></marker></defs>
    ${label(186, 22, '處理後', INK, 12, 'start')}
    ${wave(186, 50, 120, 20, 0.03)}
    ${wave(186, 90, 120, 20, 0.03)}
    ${label(160, 140, '頭尾的安靜剪掉：按下去馬上出聲', INK, 13)}
    ${label(160, 162, '大小聲調一致：不會一個很吵、一個聽不到', INK, 13)}
  `);
}

// ── 只存改過的文字 ──
export function artOnlyChanged() {
  const row = (y, k, v, mine) => `
    <rect x="20" y="${y}" width="280" height="30" rx="8" fill="${mine ? '#F4EAD0' : '#fff'}" stroke="${mine ? YOLK : LINE}"/>
    ${label(34, y + 20, k, '#8A8377', 12, 'start')}
    ${label(120, y + 20, v, INK, 13, 'start')}
    ${mine ? label(290, y + 20, '你改的', '#6B5017', 11, 'end') : label(290, y + 20, '預設', '#8A8377', 11, 'end')}`;
  return svg(320, 170, `
    ${row(14, '名字', '小毛', true)}
    ${row(52, '餵食', '餵食', false)}
    ${row(90, '肚子餓', '餓扁了啦', true)}
    ${label(160, 150, '寵物.json 只記你改過的；其他跟著預設走', INK, 13)}
  `);
}
