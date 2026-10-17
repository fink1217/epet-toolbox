// 零件畫法：小電路板上的零件（俯視圖）、外接模組、零件清點用的小圖示。全部回傳 SVG 字串。
import { stageMark } from './stage.js';

export const BAND = {
  black: '#1B1B1B', brown: '#7B4A1E', red: '#D3322C', orange: '#F07F1A', yellow: '#F2C21B', green: '#2E9E44',
  blue: '#2F6FDB', violet: '#8E4EC6', gray: '#8A8F98', white: '#FFFFFF', gold: '#C9A227', silver: '#BFC3C8',
};
export const BAND_ZH = {
  black: '黑', brown: '棕', red: '紅', orange: '橙', yellow: '黃', green: '綠',
  blue: '藍', violet: '紫', gray: '灰', white: '白', gold: '金', silver: '銀',
};

const LEAD = '#A7ADB4';
const FONT = "font-family=\"'Noto Sans TC', system-ui, sans-serif\"";

// 兩點之間的局部座標：中心、長度、角度
function frame(a, b) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  return { cx: (a[0] + b[0]) / 2, cy: (a[1] + b[1]) / 2, L: Math.hypot(dx, dy), ang: (Math.atan2(dy, dx) * 180) / Math.PI };
}

// ── 小電路板上的零件（俯視）──

export function resistor(a, b, bands, { body = 52, dia = 15 } = {}) {
  const { cx, cy, L, ang } = frame(a, b);
  const x0 = -body / 2;
  const pos = [10.5, 17, 23.5, body - 11];
  const ring = bands.map((c, i) =>
    `<rect x="${x0 + pos[i] - 2.2}" y="${-dia / 2}" width="4.4" height="${dia}" fill="${BAND[c]}"/>`).join('');
  return `<g transform="translate(${cx} ${cy}) rotate(${ang})">
    <line x1="${-L / 2}" y1="0" x2="${L / 2}" y2="0" stroke="${LEAD}" stroke-width="2.6" stroke-linecap="round"/>
    <rect x="${x0}" y="${-dia / 2}" width="${body}" height="${dia}" rx="${dia / 2}" fill="#E8D1A2" stroke="#8C6B3F" stroke-width="1.3"/>
    ${ring}
    <rect x="${x0 + 5}" y="${-dia / 2 + 2.4}" width="${body - 10}" height="2.6" rx="1.3" fill="#fff" opacity=".4"/>
  </g>`;
}

// 1N4148：玻璃管、黑色色帶在 k（負極）那端
export function diode(k, a, { body = 34, dia = 12 } = {}) {
  const { cx, cy, L, ang } = frame(k, a);
  return `<g transform="translate(${cx} ${cy}) rotate(${ang})">
    <line x1="${-L / 2}" y1="0" x2="${L / 2}" y2="0" stroke="${LEAD}" stroke-width="2.4" stroke-linecap="round"/>
    <rect x="${-body / 2}" y="${-dia / 2}" width="${body}" height="${dia}" rx="${dia / 2}" fill="#E8742F" stroke="#9A3B12" stroke-width="1.2"/>
    <rect x="${-body / 2 + 4}" y="${-dia / 2}" width="6" height="${dia}" fill="#1B1B1B"/>
    <rect x="${-body / 2 + 12}" y="${-dia / 2 + 2.2}" width="${body - 16}" height="2.4" rx="1.2" fill="#fff" opacity=".45"/>
  </g>`;
}

// TO-92 電晶體俯視：半圓形。left／mid／right 是三支腳實際由左到右的位置，flat 是平面朝向（south＝朝下方）
export function to92(left, mid, right, flat, { label = '2SC1815', P = 28 } = {}) {
  const [e, b, c] = [left, mid, right];
  const { ang } = frame(e, c);
  const rad = (ang * Math.PI) / 180;
  const normal = [-Math.sin(rad), Math.cos(rad)];
  const F = { south: [0, 1], north: [0, -1], east: [1, 0], west: [-1, 0] }[flat];
  const s = normal[0] * F[0] + normal[1] * F[1] > 0 ? 1 : -1;
  const w = P * 2.15;
  const fy = P * 0.34;
  const bulge = P * 1.3;
  return `<g transform="translate(${b[0]} ${b[1]}) rotate(${ang})">
    <g transform="scale(1 ${s})">
      <path d="M ${-w / 2} ${fy} L ${w / 2} ${fy} C ${w / 2} ${fy - bulge}, ${-w / 2} ${fy - bulge}, ${-w / 2} ${fy} Z"
        fill="#2A2C30" stroke="#0E0F11" stroke-width="1.2"/>
      <path d="M ${-w / 2 + 2} ${fy - 1.6} L ${w / 2 - 2} ${fy - 1.6}" stroke="#9AA0A8" stroke-width="2.4" stroke-linecap="round"/>
    </g>
    <text x="0" y="${-s * P * 0.2 + 3}" text-anchor="middle" font-size="8.5" fill="#E9E9E9" ${FONT}>${label}</text>
  </g>`;
}

// 直立式電解電容俯視：深藍外殼、淺色條紋在負極那邊
export function ecapTop(p, n, { r = 25 } = {}) {
  const cx = (p[0] + n[0]) / 2;
  const cy = (p[1] + n[1]) / 2;
  const ang = Math.atan2(n[1] - p[1], n[0] - p[0]);
  const pt = (a, rr) => [cx + Math.cos(a) * rr, cy + Math.sin(a) * rr];
  const a0 = ang - 0.8;
  const a1 = ang + 0.8;
  const [x0, y0] = pt(a0, r);
  const [x1, y1] = pt(a1, r);
  const ri = r * 0.66;
  const [x2, y2] = pt(a1, ri);
  const [x3, y3] = pt(a0, ri);
  const [mx, my] = pt(ang, r * 0.83);
  const [px, py] = pt(ang + Math.PI, r * 0.83);
  return `<g>
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="#21409A" stroke="#14275E" stroke-width="1.5"/>
    <path d="M ${x0} ${y0} A ${r} ${r} 0 0 1 ${x1} ${y1} L ${x2} ${y2} A ${ri} ${ri} 0 0 0 ${x3} ${y3} Z" fill="#D7DEE8"/>
    <text x="${mx}" y="${my + 4}" text-anchor="middle" font-size="12" font-weight="700" fill="#21409A" ${FONT}>−</text>
    <text x="${px}" y="${py + 4}" text-anchor="middle" font-size="11" font-weight="700" fill="#FFFFFF" ${FONT}>+</text>
    <circle cx="${cx}" cy="${cy}" r="${r * 0.42}" fill="none" stroke="#8FA0BD" stroke-width="1.2"/>
    <path d="M ${cx - r * 0.3} ${cy} h ${r * 0.6} M ${cx} ${cy - r * 0.3} v ${r * 0.6}" stroke="#8FA0BD" stroke-width="1.2"/>
  </g>`;
}

// 陶瓷電容：橘色圓片，印容量代碼（104 = 100nF）
export function ccap(a, b, { label = '104' } = {}) {
  const { cx, cy, L, ang } = frame(a, b);
  return `<g transform="translate(${cx} ${cy}) rotate(${ang})">
    <line x1="${-L / 2}" y1="0" x2="${L / 2}" y2="0" stroke="${LEAD}" stroke-width="2.2" stroke-linecap="round"/>
    <g transform="rotate(${-ang})">
      <ellipse cx="0" cy="0" rx="13" ry="11" fill="#D9822B" stroke="#8E4B10" stroke-width="1.2"/>
      <text x="0" y="3" text-anchor="middle" font-size="8" font-weight="700" fill="#4A2504" ${FONT}>${label}</text>
    </g>
  </g>`;
}

// 正面的絕緣跳線：微微拱起的一條線
export function jumperWire(a, b, color = '#2B2B2B') {
  const { cx, cy, L } = frame(a, b);
  const nx = -(b[1] - a[1]) / L;
  const ny = (b[0] - a[0]) / L;
  const bend = 16;
  const qx = cx + nx * bend;
  const qy = cy + ny * bend;
  return `<g>
    <path d="M ${a[0]} ${a[1]} Q ${qx} ${qy} ${b[0]} ${b[1]}" fill="none" stroke="#000" stroke-opacity=".25" stroke-width="7.5" stroke-linecap="round"/>
    <path d="M ${a[0]} ${a[1]} Q ${qx} ${qy} ${b[0]} ${b[1]}" fill="none" stroke="${color}" stroke-width="5.5" stroke-linecap="round"/>
    <circle cx="${a[0]}" cy="${a[1]}" r="3" fill="#C7CCD1"/><circle cx="${b[0]}" cy="${b[1]}" r="3" fill="#C7CCD1"/>
  </g>`;
}

// ── 外接模組：回傳 { svg, w, h, pins: { 名稱: { x, y, dir:[dx,dy] } } }，svg 以 (0,0) 為左上角 ──

function pinRow(names, x0, gap, y, dir) {
  const pins = {};
  names.forEach((n, i) => { pins[n] = { x: x0 + i * gap, y, dir }; });
  return pins;
}

// keyestudio SC8002B：自帶喇叭與音量旋鈕，三支腳 G / V / S（實際順序以模組上印的字為準）
// pinsTop：排針畫在上緣（模組擺在小電路板下方時，線往上走比較順）
export function ampModule({ pinsTop = false } = {}) {
  const w = 160;
  const h = 104;
  const off = pinsTop ? 10 : 0;          // 排針朝上時，整塊板子往下移，留位置給針腳
  const py = pinsTop ? 0 : h + 10;
  const pins = pinRow(['G', 'V', 'S'], 104, 20, py, [0, pinsTop ? -1 : 1]);
  const hy = pinsTop ? off + 2 : h - 12;  // 黑色排針座
  const pinSvg = Object.entries(pins).map(([n, p]) => `
    <rect x="${p.x - 2.5}" y="${pinsTop ? 0 : h - 4}" width="5" height="14" fill="#D4A72C"/>
    <text x="${p.x}" y="${pinsTop ? off + 30 : h - 20}" text-anchor="middle" font-size="12" font-weight="700" fill="#1E1F22" ${FONT}>${n}</text>`).join('');
  const cy = off + (pinsTop ? 56 : 54);
  const sr = pinsTop ? 32 : 36;            // 喇叭半徑
  return {
    w, h: h + 10, pins,
    svg: `<g>
      <rect x="0" y="${off}" width="${w}" height="${h}" rx="9" fill="#F4F4F0" stroke="#BDBDB5" stroke-width="1.6"/>
      <circle cx="${pinsTop ? w - 12 : 12}" cy="${off + (pinsTop ? h - 12 : 12)}" r="4.5" fill="#fff" stroke="#BDBDB5"/>
      <circle cx="52" cy="${cy}" r="${sr}" fill="#2B2D31"/>
      <circle cx="52" cy="${cy}" r="${sr * 0.75}" fill="none" stroke="#45484F" stroke-width="3"/>
      <circle cx="52" cy="${cy}" r="${sr * 0.47}" fill="none" stroke="#45484F" stroke-width="3"/>
      <circle cx="52" cy="${cy}" r="${sr * 0.22}" fill="#5A5E66"/>
      ${pinsTop ? `<text x="52" y="${off + h - 5}" text-anchor="middle" font-size="8.5" fill="#8A8F98" ${FONT}>喇叭</text>` : ''}
      <rect x="112" y="${off + (pinsTop ? 50 : 14)}" width="30" height="30" rx="4" fill="#2F6FDB"/>
      <circle cx="127" cy="${off + (pinsTop ? 65 : 29)}" r="9" fill="#F4F4F0"/>
      <path d="M121 ${off + (pinsTop ? 65 : 29)} h12 M127 ${off + (pinsTop ? 59 : 23)} v12" stroke="#2F6FDB" stroke-width="2.4"/>
      <text x="127" y="${off + (pinsTop ? 92 : 56)}" text-anchor="middle" font-size="8.5" fill="#4A4D55" ${FONT}>音量</text>
      <rect x="94" y="${hy}" width="60" height="10" rx="2" fill="#1E1F22"/>
      ${pinSvg}
      <text x="${pinsTop ? 10 : 96}" y="${off + (pinsTop ? 16 : 70)}" font-size="9" fill="#8A8F98" ${FONT}>SC8002B</text>
    </g>`,
  };
}

// GY-291（ADXL345）：8 支腳一排
export const GY291_PINS = ['GND', 'VCC', 'CS', 'INT1', 'INT2', 'SDO', 'SDA', 'SCL'];
export function imuModule({ bridge = false } = {}) {
  const w = 168;
  const h = 84;
  const gap = 19;
  const x0 = 18;
  const pins = pinRow(GY291_PINS, x0, gap, h + 10, [0, 1]);
  const pinSvg = GY291_PINS.map((n) => {
    const p = pins[n];
    return `<circle cx="${p.x}" cy="${h - 9}" r="5.5" fill="#D4A72C" stroke="#8C6B12"/>
      <rect x="${p.x - 2}" y="${h - 9}" width="4" height="19" fill="#D4A72C"/>
      <text transform="translate(${p.x + 3.5} ${h - 19}) rotate(-90)" font-size="9.5" font-weight="700" fill="#FFFFFF" ${FONT}>${n}</text>`;
  }).join('');
  const br = bridge
    ? `<path d="M ${pins.VCC.x} ${h - 9} L ${pins.CS.x} ${h - 9}" stroke="#C7CCD1" stroke-width="7" stroke-linecap="round"/>`
    : '';
  return {
    w, h: h + 10, pins,
    svg: `<g>
      <rect x="0" y="0" width="${w}" height="${h}" rx="7" fill="#4B2A7B" stroke="#2E1650" stroke-width="1.6"/>
      <circle cx="11" cy="11" r="4.5" fill="#2E1650"/><circle cx="${w - 11}" cy="11" r="4.5" fill="#2E1650"/>
      <rect x="${w / 2 - 14}" y="8" width="28" height="22" rx="2" fill="#222"/>
      <text x="${w / 2}" y="40" text-anchor="middle" font-size="9" fill="#D9C8F0" ${FONT}>GY-291 · ADXL345</text>
      ${pinSvg}
      ${br}
    </g>`,
  };
}

// EC11 旋鈕模組（KY-040 型）：5 支腳在上緣
export const EC11_PINS = ['CLK', 'DT', 'SW', '+', 'GND'];
export function ec11Module() {
  const w = 120;
  const h = 118;
  const gap = 20;
  const pins = pinRow(EC11_PINS, 20, gap, -10, [0, -1]);
  const pinSvg = EC11_PINS.map((n) => {
    const p = pins[n];
    return `<rect x="${p.x - 2.5}" y="-10" width="5" height="16" fill="#D4A72C"/>
      <text x="${p.x}" y="22" text-anchor="middle" font-size="9.5" font-weight="700" fill="#FFFFFF" ${FONT}>${n}</text>`;
  }).join('');
  return {
    w, h, pins,
    svg: `<g>
      <rect x="0" y="0" width="${w}" height="${h}" rx="8" fill="#1F3B5C" stroke="#11233A" stroke-width="1.6"/>
      <rect x="10" y="0" width="${gap * 4 + 20}" height="9" rx="2" fill="#111"/>
      ${pinSvg}
      <rect x="${w / 2 - 26}" y="${h - 76}" width="52" height="52" rx="6" fill="#B9BEC5" stroke="#6B7078"/>
      <circle cx="${w / 2}" cy="${h - 50}" r="20" fill="#3A3D42" stroke="#1B1C1F" stroke-width="2"/>
      ${Array.from({ length: 16 }, (_, i) => {
        const a = (i / 16) * Math.PI * 2;
        return `<line x1="${w / 2 + Math.cos(a) * 15}" y1="${h - 50 + Math.sin(a) * 15}" x2="${w / 2 + Math.cos(a) * 20}" y2="${h - 50 + Math.sin(a) * 20}" stroke="#55595F" stroke-width="2"/>`;
      }).join('')}
      <path d="M ${w / 2 - 7} ${h - 50} a 7 7 0 1 1 14 0 z" fill="#C7CCD1"/>
      <text x="${w / 2}" y="${h - 10}" text-anchor="middle" font-size="9" fill="#B5C6DA" ${FONT}>EC11</text>
    </g>`,
  };
}

// 1027 硬幣型震動馬達：兩條細線
export function motorPart() {
  const w = 90;
  const h = 92;
  const pins = { w1: { x: 30, y: h, dir: [0, 1] }, w2: { x: 60, y: h, dir: [0, 1] } };
  return {
    w, h, pins,
    svg: `<g>
      <path d="M 38 38 C 34 60, 28 70, 30 ${h}" fill="none" stroke="#D3322C" stroke-width="3"/>
      <path d="M 52 38 C 56 60, 62 70, 60 ${h}" fill="none" stroke="#2F6FDB" stroke-width="3"/>
      <circle cx="45" cy="26" r="22" fill="#C9CED6" stroke="#7E858F" stroke-width="2"/>
      <circle cx="45" cy="26" r="13" fill="#DDE1E6" stroke="#9AA0A8"/>
      <circle cx="45" cy="26" r="3" fill="#7E858F"/>
      <text x="45" y="62" text-anchor="middle" font-size="9" fill="#4A4D55" ${FONT}>1027</text>
    </g>`,
  };
}

// 震動馬達模組：黑色小板，馬達＋板上的驅動電晶體與二極體，排針 GND／VCC／IN 朝下
// annotate：標出板上的電晶體、二極體（「模組裡有什麼」用）
export function motorModulePart({ annotate = false } = {}) {
  const w = 130;
  const h = 112;
  const pins = pinRow(['GND', 'VCC', 'IN'], 34, 31, h + 10, [0, 1]);
  const pinSvg = Object.entries(pins).map(([n, p]) => `
    <rect x="${p.x - 2.5}" y="${h - 4}" width="5" height="14" fill="#D4A72C"/>
    <text x="${p.x}" y="${h - 18}" text-anchor="middle" font-size="10.5" font-weight="700" fill="#FFFFFF" ${FONT}>${n}</text>`).join('');
  const note = (x, y, tx, ty, t) => `
    <path d="M ${x} ${y} L ${tx} ${ty}" stroke="#FFB020" stroke-width="1.6"/>
    <circle cx="${x}" cy="${y}" r="9" fill="none" stroke="#FFB020" stroke-width="2"/>
    <text x="${tx + (tx > x ? 4 : -4)}" y="${ty + 4}" text-anchor="${tx > x ? 'start' : 'end'}" font-size="10" font-weight="700" fill="#B26A00" ${FONT}>${t}</text>`;
  return {
    w, h: h + 10, pins,
    svg: `<g>
      <rect x="0" y="0" width="${w}" height="${h}" rx="8" fill="#1E1F22" stroke="#45484F" stroke-width="1.6"/>
      <circle cx="14" cy="14" r="5" fill="#BFC3C9"/><circle cx="14" cy="${h - 36}" r="5" fill="#BFC3C9"/>
      <circle cx="88" cy="40" r="26" fill="#2B2D31" stroke="#9AA0A8" stroke-width="2.4"/>
      <circle cx="88" cy="40" r="17" fill="none" stroke="#45484F" stroke-width="2"/>
      <path d="M 104 18 q 10 -8 18 -4 M 108 22 q 8 -2 12 2" stroke="#D3322C" stroke-width="1.6" fill="none"/>
      <rect x="36" y="16" width="16" height="9" rx="1.5" fill="#3A3D44" stroke="#8A8F98" stroke-width=".8"/>
      <rect x="36" y="34" width="16" height="10" rx="1.5" fill="#3A3D44" stroke="#8A8F98" stroke-width=".8"/>
      <rect x="36" y="52" width="14" height="7" rx="1" fill="#8A8F98"/>
      <rect x="22" y="${h - 12}" width="86" height="10" rx="2" fill="#000"/>
      ${pinSvg}
      ${annotate ? note(44, 21, 4, -14, '二極體') + note(44, 39, 4, 2, '電晶體') + note(43, 55, 4, 18, '電阻') : ''}
    </g>`,
  };
}

// 薄膜壓力感測器：圓形感應區＋尾巴＋2pin 排母＋兩條線
export function fsrPart() {
  const w = 84;
  const h = 196;
  const pins = { a: { x: 36, y: h, dir: [0, 1] }, b: { x: 48, y: h, dir: [0, 1] } };
  return {
    w, h, pins,
    svg: `<g>
      <circle cx="42" cy="36" r="34" fill="#E9C46A" stroke="#B88A1B" stroke-width="1.6" opacity=".95"/>
      ${[26, 18, 10].map((r) => `<circle cx="42" cy="36" r="${r}" fill="none" stroke="#C99A2E" stroke-width="1.4"/>`).join('')}
      <rect x="33" y="68" width="18" height="74" fill="#E9C46A" stroke="#B88A1B" stroke-width="1.4"/>
      <path d="M 38 70 V 142 M 46 70 V 142" stroke="#9AA0A8" stroke-width="1.6"/>
      <rect x="26" y="142" width="32" height="18" rx="2" fill="#1E1F22"/>
      <text x="70" y="154" font-size="8.5" fill="#8A8F98" ${FONT}>排母</text>
      <path d="M 36 160 V ${h}" stroke="#A1662F" stroke-width="3.2"/>
      <path d="M 48 160 V ${h}" stroke="#A1662F" stroke-width="3.2"/>
      <rect x="31" y="166" width="22" height="16" rx="3" fill="#2B2B2B" opacity=".75"/>
      <text x="70" y="178" font-size="8.5" fill="#8A8F98" ${FONT}>熱縮</text>
    </g>`,
  };
}

// 鋰電池＋保護板＋PH2.0 對插線
// top：接頭朝上（電池擺在小電路板下方時用）；unplugged：插頭拔開、中間畫一個 ✗
export function batteryPart({ top = false, unplugged = false } = {}) {
  const w = 170;
  const h = 132;
  const pins = top
    ? { '+': { x: 78, y: 0, dir: [0, -1] }, '−': { x: 92, y: 0, dir: [0, -1] } }
    : { '+': { x: 78, y: h, dir: [0, 1] }, '−': { x: 92, y: h, dir: [0, 1] } };
  // 先畫「接頭朝下」的樣子，朝上時整組上下翻轉，但文字另外擺正
  const gapY = unplugged ? 10 : 0;
  const body = `
      <rect x="6" y="4" width="158" height="70" rx="9" fill="#DCE1E7" stroke="#9AA3AD" stroke-width="1.6"/>
      <rect x="40" y="74" width="90" height="12" rx="2" fill="#2E7D4F"/>
      <path d="M 78 86 V 104" stroke="#D3322C" stroke-width="3"/>
      <path d="M 92 86 V 104" stroke="#2B2B2B" stroke-width="3"/>
      <rect x="70" y="104" width="30" height="${unplugged ? 8 : 14}" rx="2" fill="#F1F1EC" stroke="#9A9A92"/>
      <rect x="70" y="${110 + gapY}" width="30" height="8" rx="2" fill="#F1F1EC" stroke="#9A9A92"/>
      <path d="M 78 ${118 + gapY} V ${h}" stroke="#D3322C" stroke-width="3"/>
      <path d="M 92 ${118 + gapY} V ${h}" stroke="#2B2B2B" stroke-width="3"/>`;
  const ty = (y) => (top ? h - y : y);
  const words = `
      <text x="85" y="${ty(36) + (top ? 8 : 0)}" text-anchor="middle" font-size="13" font-weight="700" fill="#4A4D55" ${FONT}>3.7V 1000mAh</text>
      <text x="85" y="${ty(54) + (top ? 8 : 0)}" text-anchor="middle" font-size="9.5" fill="#6B7078" ${FONT}>鋰聚合物電池</text>
      <text x="85" y="${ty(83.5) + (top ? 7 : 0)}" text-anchor="middle" font-size="7.5" fill="#E5F5EA" ${FONT}>保護板</text>
      <text x="108" y="${ty(115) + (top ? 7 : 0)}" font-size="8.5" fill="#8A8F98" ${FONT}>PH2.0</text>
      ${unplugged ? `<g transform="translate(60 ${ty(114)})"><circle r="9" fill="#D93F3F"/><path d="M -4 -4 L 4 4 M 4 -4 L -4 4" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/></g>` : ''}`;
  return {
    w, h, pins,
    svg: `<g>${top ? `<g transform="translate(0 ${h}) scale(1 -1)">${body}</g>` : body}${words}</g>`,
  };
}

// ── 零件清點用的小圖示（120×90）──
const wrapIcon = (inner) => `<svg viewBox="0 0 120 90" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${inner}</svg>`;

export function icon(kind, opt = {}) {
  switch (kind) {
    case 'board':
      return wrapIcon(`
        <rect x="34" y="6" width="52" height="78" rx="12" fill="#1E1F22"/>
        <rect x="40" y="12" width="40" height="66" rx="5" fill="#26272B"/>
        ${stageMark({ box: { x: 43, y: 32, w: 34 }, color: '#F3EEE3' })}
        ${opt.touch ? '<path d="M78 64 q0 -9 5 -9 q5 0 5 9 v14 q0 8 -10 9 q-8 0 -10 -8 l-3 -10 q-1 -4 3 -4 q3 0 5 4z" fill="#F6C9A8" stroke="#1E1F22" stroke-width="1.6"/>' : ''}`);
    case 'perfboard':
      return wrapIcon(`
        <rect x="14" y="14" width="92" height="62" rx="4" fill="#E2C58F" stroke="#B8955A" stroke-width="1.5"/>
        ${Array.from({ length: 6 }, (_, r) => Array.from({ length: 10 }, (_, c) =>
          `<circle cx="${21 + c * 8.7}" cy="${21 + r * 9.5}" r="2.2" fill="#6B4E22"/>`).join('')).join('')}`);
    case 'resistor': {
      const bands = opt.bands || ['brown', 'black', 'red', 'gold'];
      return wrapIcon(resistor([10, 45], [110, 45], bands, { body: 54, dia: 18 }));
    }
    case 'to92':
      return wrapIcon(`
        <path d="M44 62 V 84 M60 62 V 84 M76 62 V 84" stroke="${LEAD}" stroke-width="3"/>
        <path d="M40 62 V 30 a 20 20 0 0 1 40 0 V 62 Z" fill="#2A2C30"/>
        <text x="60" y="48" text-anchor="middle" font-size="8.5" fill="#E9E9E9" ${FONT}>${opt.label || '2SC1815'}</text>
        <text x="44" y="12" text-anchor="middle" font-size="9" fill="#8A8F98" ${FONT}>平面朝你</text>`);
    case 'diode':
      return wrapIcon(diode([10, 45], [110, 45], { body: 44, dia: 15 }));
    case 'ecap':
      return wrapIcon(`
        <path d="M52 66 V 88 M68 66 V 80" stroke="${LEAD}" stroke-width="3"/>
        <rect x="40" y="12" width="40" height="56" rx="7" fill="#21409A"/>
        <rect x="64" y="12" width="12" height="56" fill="#D7DEE8"/>
        <text x="70" y="44" text-anchor="middle" font-size="12" font-weight="700" fill="#21409A" ${FONT}>−</text>
        <text x="38" y="86" font-size="11" fill="#4A4D55" ${FONT}>長+</text>`);
    case 'ccap':
      return wrapIcon(`
        <path d="M52 60 V 86 M68 60 V 86" stroke="${LEAD}" stroke-width="3"/>
        <ellipse cx="60" cy="40" rx="22" ry="22" fill="#D9822B" stroke="#8E4B10" stroke-width="1.5"/>
        <text x="60" y="45" text-anchor="middle" font-size="13" font-weight="700" fill="#4A2504" ${FONT}>104</text>`);
    case 'motorModule':
      return wrapIcon(`
        <rect x="22" y="14" width="76" height="62" rx="5" fill="#1E1F22"/>
        <circle cx="72" cy="38" r="16" fill="#2B2D31" stroke="#9AA0A8" stroke-width="2"/>
        <rect x="34" y="26" width="12" height="7" rx="1" fill="#3A3D44" stroke="#8A8F98" stroke-width=".8"/>
        <rect x="34" y="40" width="12" height="7" rx="1" fill="#3A3D44" stroke="#8A8F98" stroke-width=".8"/>
        <path d="M44 76 V 90 M60 76 V 90 M76 76 V 90" stroke="#D4A72C" stroke-width="3"/>
        <rect x="36" y="70" width="48" height="7" rx="1.5" fill="#000"/>`);
    case 'motor':
      return wrapIcon(`
        <path d="M54 46 C 50 62, 40 70, 40 86" fill="none" stroke="#D3322C" stroke-width="2.5"/>
        <path d="M66 46 C 70 62, 80 70, 80 86" fill="none" stroke="#2F6FDB" stroke-width="2.5"/>
        <circle cx="60" cy="30" r="22" fill="#C9CED6" stroke="#7E858F" stroke-width="2"/>
        <circle cx="60" cy="30" r="12" fill="#DDE1E6" stroke="#9AA0A8"/>`);
    case 'fsr':
      return wrapIcon(`
        <circle cx="38" cy="45" r="27" fill="#E9C46A" stroke="#B88A1B" stroke-width="1.5"/>
        <circle cx="38" cy="45" r="18" fill="none" stroke="#C99A2E" stroke-width="1.4"/>
        <rect x="64" y="38" width="44" height="14" fill="#E9C46A" stroke="#B88A1B" stroke-width="1.4"/>`);
    case 'header2':
      return wrapIcon(`
        <rect x="40" y="26" width="40" height="38" rx="3" fill="#1E1F22"/>
        <rect x="47" y="38" width="8" height="8" fill="#555"/><rect x="65" y="38" width="8" height="8" fill="#555"/>`);
    case 'amp': {
      const m = ampModule();
      return wrapIcon(`<g transform="translate(18 6) scale(0.52)">${m.svg}</g>`);
    }
    case 'imu': {
      const m = imuModule();
      return wrapIcon(`<g transform="translate(12 18) scale(0.57)">${m.svg}</g>`);
    }
    case 'ec11': {
      const m = ec11Module();
      return wrapIcon(`<g transform="translate(34 14) scale(0.56)">${m.svg}</g>`);
    }
    case 'battery': {
      const m = batteryPart();
      return wrapIcon(`<g transform="translate(14 2) scale(0.55)">${m.svg}</g>`);
    }
    case 'wires':
      return wrapIcon(['#E5484D', '#2B2B2B', '#F76B15', '#30A46C', '#3E63DD'].map((c, i) =>
        `<path d="M${14 + i * 6} ${70 - i * 3} C 40 ${20 + i * 6}, 80 ${80 - i * 8}, ${106 - i * 4} ${24 + i * 8}" fill="none" stroke="${c}" stroke-width="4" stroke-linecap="round"/>`).join(''));
    case 'heatshrink':
      return wrapIcon(['#E5484D', '#2B2B2B', '#3E63DD', '#30A46C'].map((c, i) =>
        `<rect x="${16 + i * 24}" y="${18 + (i % 2) * 8}" width="14" height="54" rx="4" fill="${c}"/>`).join(''));
    case 'solid':
      return wrapIcon(`
        <circle cx="60" cy="45" r="28" fill="none" stroke="#2B2B2B" stroke-width="5"/>
        <circle cx="60" cy="45" r="20" fill="none" stroke="#2B2B2B" stroke-width="5"/>
        <path d="M88 45 h18" stroke="#C7CCD1" stroke-width="3" stroke-linecap="round"/>`);
    case 'iron':
      return wrapIcon(`
        <rect x="8" y="38" width="54" height="16" rx="8" fill="#3E63DD"/>
        <rect x="60" y="41" width="28" height="10" rx="3" fill="#9AA0A8"/>
        <path d="M88 43 L 112 46 L 88 49 Z" fill="#6B7078"/>
        <path d="M100 30 q4 -6 0 -12 M108 32 q4 -6 0 -12" stroke="#D93F3F" stroke-width="2" fill="none" stroke-linecap="round"/>
        <text x="30" y="76" text-anchor="middle" font-size="10" fill="#4A4D55" ${FONT}>330–350°C</text>`);
    case 'solder':
      return wrapIcon(`
        <circle cx="60" cy="45" r="30" fill="#C7CCD1" stroke="#8F959C" stroke-width="2"/>
        <circle cx="60" cy="45" r="10" fill="#FFFFFF" stroke="#8F959C" stroke-width="2"/>
        <path d="M86 58 C 96 66, 104 70, 112 82" stroke="#C7CCD1" stroke-width="3" fill="none"/>`);
    case 'flux':
      return wrapIcon(`
        <rect x="30" y="34" width="60" height="42" rx="6" fill="#F2C21B" stroke="#B8901A" stroke-width="1.5"/>
        <rect x="34" y="24" width="52" height="12" rx="3" fill="#6B4E22"/>
        <text x="60" y="61" text-anchor="middle" font-size="11" font-weight="700" fill="#6B4300" ${FONT}>FLUX</text>`);
    case 'braid':
      return wrapIcon(`
        <circle cx="60" cy="45" r="28" fill="#2F6FDB"/><circle cx="60" cy="45" r="9" fill="#fff"/>
        <path d="M84 56 L 112 74" stroke="#C77A3A" stroke-width="7" stroke-linecap="round"/>`);
    case 'cutter':
      return wrapIcon(`
        <path d="M60 46 L 30 84 M60 46 L 90 84" stroke="#E5484D" stroke-width="10" stroke-linecap="round"/>
        <path d="M60 46 L 52 10 L 60 4 L 68 10 Z" fill="#6B7078"/>
        <circle cx="60" cy="46" r="5" fill="#2B2B2B"/>`);
    case 'stripper':
      return wrapIcon(`
        <path d="M60 50 L 34 86 M60 50 L 86 86" stroke="#F2C21B" stroke-width="10" stroke-linecap="round"/>
        <path d="M54 50 L 50 6 H 70 L 66 50 Z" fill="#6B7078"/>
        <circle cx="60" cy="18" r="2" fill="#fff"/><circle cx="60" cy="28" r="2.6" fill="#fff"/><circle cx="60" cy="38" r="3.2" fill="#fff"/>`);
    case 'meter':
      return wrapIcon(`
        <rect x="36" y="6" width="48" height="78" rx="8" fill="#F2C21B" stroke="#B8901A" stroke-width="1.5"/>
        <rect x="42" y="14" width="36" height="20" rx="3" fill="#C9E7C4"/>
        <text x="60" y="29" text-anchor="middle" font-size="11" font-weight="700" fill="#1E1F22" ${FONT}>3.70</text>
        <circle cx="60" cy="54" r="11" fill="#2B2B2B"/><path d="M60 54 L 66 47" stroke="#fff" stroke-width="2.5"/>
        <path d="M46 84 C 30 86, 20 78, 14 66 M74 84 C 90 86, 100 78, 106 66" stroke="#D3322C" stroke-width="2.5" fill="none"/>`);
    case 'tweezers':
      return wrapIcon(`<path d="M20 20 L 104 44 M20 26 L 104 50" stroke="#9AA0A8" stroke-width="5" stroke-linecap="round"/>`);
    case 'clamp':
      return wrapIcon(`
        <rect x="20" y="74" width="80" height="10" rx="3" fill="#2B2B2B"/>
        <path d="M60 74 V 44 L 30 24 M60 44 L 92 26" stroke="#6B7078" stroke-width="4" fill="none" stroke-linecap="round"/>
        <path d="M24 20 l 10 -6 l 2 10z M88 22 l 10 -4 l -2 10z" fill="#D3322C"/>`);
    default:
      return wrapIcon('<circle cx="60" cy="45" r="20" fill="#DDD3C2"/>');
  }
}
