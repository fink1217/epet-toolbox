// 「為什麼」繪本的插圖：每張都是 320×200 的小比喻圖。用水管、門鈴、公車這類日常東西講電路。
import { resistor, diode, BAND, ecapTop, motorPart, motorModulePart, batteryPart } from './parts.js';
import { stageMark, pixelActor } from './stage.js';

const FONT = "font-family=\"'Noto Sans TC', system-ui, sans-serif\"";
const INK = '#1B1A17';
const MUTED = '#8A8377';
const YOLK = '#C49A3C';
const RED = '#B3392B';
const GREEN = '#3A7A45';
const BLUE = '#2F5F9E';
const TEAL = '#2F6B55';
const WATER = '#5FB3F0';

const doc = (inner) => `<svg viewBox="0 0 320 200" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${inner}</svg>`;
const t = (x, y, s, { size = 13, color = INK, anchor = 'middle', weight = 500 } = {}) =>
  `<text x="${x}" y="${y}" text-anchor="${anchor}" font-size="${size}" font-weight="${weight}" fill="${color}" ${FONT}>${s}</text>`;
const arrow = (x1, y1, x2, y2, color = INK, w = 2.4) => {
  const a = Math.atan2(y2 - y1, x2 - x1);
  const hx = (k) => x2 - Math.cos(a + k) * 9;
  const hy = (k) => y2 - Math.sin(a + k) * 9;
  return `<path d="M ${x1} ${y1} L ${x2} ${y2} M ${hx(0.45)} ${hy(0.45)} L ${x2} ${y2} L ${hx(-0.45)} ${hy(-0.45)}" fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
};
const pipe = (d, w = 16, color = WATER) =>
  `<path d="${d}" fill="none" stroke="#9AA6B2" stroke-width="${w + 5}" stroke-linecap="round" stroke-linejoin="round"/><path d="${d}" fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
const wave = (x0, y0, w, amp, periods, color = BLUE, sw = 3) => {
  let d = `M ${x0} ${y0}`;
  for (let i = 1; i <= 80; i++) {
    const x = x0 + (w * i) / 80;
    d += ` L ${x.toFixed(1)} ${(y0 - Math.sin((i / 80) * periods * Math.PI * 2) * amp).toFixed(1)}`;
  }
  return `<path d="${d}" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round"/>`;
};
const square = (x0, y0, w, h, period, color = INK, sw = 2.4, phase = 0) => {
  let d = '';
  let x = x0 - phase;
  let hi = false;
  d = `M ${x0} ${y0}`;
  while (x < x0 + w) {
    const nx = Math.min(x + period / 2, x0 + w);
    const y = hi ? y0 - h : y0;
    d += ` L ${Math.max(x, x0)} ${y} L ${nx} ${y}`;
    hi = !hi;
    if (nx < x0 + w) d += ` L ${nx} ${hi ? y0 - h : y0}`;
    x = nx;
  }
  return `<path d="${d}" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linejoin="round"/>`;
};
const meter = (x, y, s = 1, reading = '') => `<g transform="translate(${x} ${y}) scale(${s})">
  <rect x="0" y="0" width="58" height="92" rx="9" fill="#F2C21B" stroke="#B8901A" stroke-width="1.6"/>
  <rect x="7" y="8" width="44" height="24" rx="3" fill="#C9E7C4"/>
  ${t(29, 25, reading, { size: 12, weight: 700 })}
  <circle cx="29" cy="58" r="14" fill="#2B2B2B"/><path d="M29 58 L 37 49" stroke="#fff" stroke-width="2.6"/>
</g>`;

// ── 準備 ──
export const ironTemp = () => doc(`
  <rect x="20" y="96" width="140" height="22" rx="11" fill="${BLUE}"/>
  <rect x="158" y="100" width="56" height="14" rx="4" fill="#9AA0A8"/>
  <path d="M214 103 L 260 107 L 214 111 Z" fill="#6B7078"/>
  <path d="M244 84 q6 -10 0 -20 M256 86 q6 -10 0 -20" stroke="${RED}" stroke-width="2.6" fill="none" stroke-linecap="round"/>
  <rect x="40" y="140" width="80" height="34" rx="8" fill="#FFFFFF" stroke="${INK}" stroke-width="2"/>
  ${t(80, 163, '340°C', { size: 18, weight: 700, color: RED })}
  ${t(240, 150, '太低：冷焊', { size: 12, color: MUTED })}
  ${t(240, 170, '太高：燒零件', { size: 12, color: MUTED })}
  ${t(240, 190, '330–350°C 剛好', { size: 13, color: GREEN, weight: 700 })}`);

export const batteryShort = () => doc(`
  <g transform="translate(70 20) scale(1.05)">${batteryPart().svg}</g>
  <path d="M 152 160 C 160 182, 170 182, 166 160" stroke="${RED}" stroke-width="3" fill="none"/>
  <path d="M 196 150 l 14 -16 l -4 14 l 14 -6 l -16 22 l 4 -12 z" fill="${YOLK}" stroke="#C77700" stroke-width="1.5"/>
  ${t(250, 120, '一碰就是', { size: 13, color: MUTED, anchor: 'start' })}
  ${t(250, 140, '好幾安培', { size: 16, color: RED, anchor: 'start', weight: 700 })}`);

export const protection = () => doc(`
  <g transform="translate(20 30)">${batteryPart().svg}</g>
  <path d="M230 50 l40 14 v34 c0 26 -20 40 -40 48 c-20 -8 -40 -22 -40 -48 v-34 z" fill="${GREEN}" opacity=".9"/>
  <path d="M214 98 l12 12 l24 -26" stroke="#fff" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  ${t(230, 180, '過充・過放・短路 → 斷電', { size: 12, color: GREEN, weight: 700 })}`);

// ── 焊接 ──
export const joints = () => {
  const base = (x) => `<rect x="${x - 30}" y="140" width="60" height="10" fill="#E2C58F"/><rect x="${x - 14}" y="136" width="28" height="4" fill="#D58E4E"/><rect x="${x - 2}" y="70" width="4" height="96" fill="#A7ADB4"/>`;
  return doc(`
    ${base(60)}<path d="M 44 136 Q 60 120 58 92 L 62 92 Q 60 120 76 136 Z" fill="#DDE1E6" stroke="#8E959D" stroke-width="1.4"/>
    ${t(60, 186, '✓ 小火山', { color: GREEN, weight: 700 })}
    ${base(160)}<circle cx="160" cy="118" r="18" fill="#DDE1E6" stroke="#8E959D" stroke-width="1.4"/>
    ${t(160, 186, '✗ 錫球', { color: RED, weight: 700 })}
    ${base(260)}<path d="M 242 136 Q 248 116 256 112 L 264 112 Q 272 118 278 136 Z" fill="#B5BAC0" stroke="#7E858F" stroke-width="1.4"/>
    ${[0, 1, 2, 3, 4].map((i) => `<circle cx="${248 + i * 6}" cy="${124 + (i % 2) * 5}" r="1.4" fill="#7E858F"/>`).join('')}
    ${t(260, 186, '✗ 冷焊（灰、皺）', { color: RED, weight: 700 })}
    ${t(160, 34, '焊點的側面', { size: 14, color: MUTED })}`);
};

export const tinning = () => doc(`
  <rect x="20" y="58" width="90" height="16" rx="8" fill="${RED}"/>
  ${[0, 1, 2, 3, 4].map((i) => `<path d="M110 66 q 20 ${(i - 2) * 6} 40 ${(i - 2) * 12}" stroke="#C77A3A" stroke-width="2" fill="none"/>`).join('')}
  ${t(90, 110, '散開的銅絲', { size: 12, color: MUTED })}
  ${arrow(160, 66, 190, 66, MUTED)}
  <rect x="190" y="58" width="80" height="16" rx="8" fill="${RED}"/>
  <rect x="268" y="61" width="34" height="10" rx="5" fill="#DDE1E6" stroke="#8E959D"/>
  ${t(250, 110, '上錫後：一根針', { size: 12, color: GREEN, weight: 700 })}
  <rect x="40" y="140" width="240" height="40" rx="10" fill="#F4EAD0"/>
  ${t(160, 165, '剝 3mm → 扭一扭 → 上錫', { size: 13, color: '#6B5017', weight: 700 })}`);

export const fluxPan = () => doc(`
  <ellipse cx="110" cy="120" rx="80" ry="22" fill="#4A4D55"/>
  <rect x="186" y="112" width="90" height="12" rx="6" fill="#2B2B2B"/>
  <ellipse cx="104" cy="116" rx="26" ry="10" fill="#FFFFFF"/><circle cx="104" cy="114" r="8" fill="${YOLK}"/>
  <path d="M60 80 q4 -12 0 -22 M80 76 q4 -12 0 -22" stroke="${MUTED}" stroke-width="2" fill="none" stroke-linecap="round"/>
  ${t(160, 40, '助焊劑 ≈ 熱鍋先放油', { size: 15, weight: 700 })}
  ${t(160, 176, '洗掉氧化層，錫才流得順', { size: 12, color: MUTED })}`);

// ── 主板 ──
export const gpio = () => doc(`
  <rect x="110" y="40" width="100" height="120" rx="14" fill="#202326"/>
  ${t(160, 104, 'ESP32-S3', { size: 12, color: '#9AA0A8' })}
  ${arrow(60, 70, 108, 70, TEAL, 3)}${t(54, 74, '聽', { anchor: 'end', color: TEAL, weight: 700, size: 15 })}
  ${t(40, 94, '讀電壓', { size: 11, color: MUTED })}
  ${arrow(212, 70, 260, 70, YOLK, 3)}${t(266, 74, '說', { anchor: 'start', color: '#C77700', weight: 700, size: 15 })}
  ${t(280, 94, '0V / 3.3V', { size: 11, color: MUTED })}
  ${[0, 1, 2, 3].map((i) => `<rect x="104" y="${60 + i * 26}" width="10" height="10" fill="#F2C94C"/><rect x="206" y="${60 + i * 26}" width="10" height="10" fill="#F2C94C"/>`).join('')}`);

export const flip = () => doc(`
  <rect x="30" y="40" width="80" height="130" rx="14" fill="#1B1A17"/><rect x="38" y="50" width="64" height="108" rx="6" fill="#BFE7FF"/>
  ${t(70, 190, '正面：螢幕', { size: 12, color: MUTED })}
  <path d="M 130 100 q 30 -40 60 0" stroke="${YOLK}" stroke-width="3" fill="none"/>${arrow(185, 92, 192, 102, YOLK, 3)}
  <rect x="210" y="40" width="80" height="130" rx="14" fill="#202326"/>
  <rect x="236" y="34" width="28" height="18" rx="5" fill="#B8BEC6"/>
  <rect x="236" y="96" width="28" height="28" rx="3" fill="#33373C"/>
  ${[0, 1, 2, 3, 4, 5].map((i) => `<rect x="214" y="${68 + i * 16}" width="8" height="8" fill="#F2C94C"/><rect x="278" y="${68 + i * 16}" width="8" height="8" fill="#F2C94C"/>`).join('')}
  ${t(250, 190, '背面：USB 朝上', { size: 12, color: GREEN, weight: 700 })}`);

export const pinChoice = () => doc(`
  <rect x="120" y="30" width="80" height="150" rx="12" fill="#202326"/>
  ${[0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
    const used = i >= 3;
    return `<rect x="114" y="${44 + i * 16}" width="10" height="10" fill="${used ? '#F2C94C' : '#6B5A24'}"/>
    ${t(104, 53 + i * 16, used ? `IO${i - 1}` : ['IO43', 'IO44', 'IO1'][i], { anchor: 'end', size: 11, color: used ? INK : MUTED, weight: used ? 700 : 400 })}`;
  }).join('')}
  <rect x="214" y="90" width="96" height="62" rx="10" fill="#F4EAD0"/>
  ${t(262, 114, '空著的腳', { size: 13, color: '#6B5017', weight: 700 })}
  ${t(262, 136, '不跟螢幕、SD 搶', { size: 11, color: '#6B5017' })}`);

// ── 小電路板 ──
export const powerStrip = () => doc(`
  <rect x="40" y="90" width="240" height="40" rx="10" fill="#FFFFFF" stroke="${INK}" stroke-width="2"/>
  ${[0, 1, 2, 3, 4].map((i) => `<rect x="${70 + i * 44}" y="102" width="20" height="16" rx="3" fill="#E8CD97" stroke="#8A6A35"/>`).join('')}
  <path d="M 40 110 C 10 110, 20 60, 50 50" stroke="${INK}" stroke-width="5" fill="none" stroke-linecap="round"/>
  ${t(76, 46, '主板 3V3 只有一支', { size: 12, color: MUTED, anchor: 'start' })}
  ${['馬達', '感壓', '旋鈕', '加速度', '電容'].map((s, i) => t(80 + i * 44, 160, s, { size: 11 })).join('')}
  ${t(160, 186, '小電路板 = 延長線', { size: 14, color: TEAL, weight: 700 })}`);

export const singleSided = () => doc(`
  <rect x="30" y="60" width="120" height="90" rx="6" fill="#E8CD97" stroke="#B8955A"/>
  ${[0, 1, 2].map((r) => [0, 1, 2, 3].map((c) => `<circle cx="${55 + c * 24}" cy="${82 + r * 24}" r="3" fill="#5A4320"/>`).join('')).join('')}
  ${t(90, 50, '正面：插零件', { size: 12, color: MUTED })}
  <rect x="170" y="60" width="120" height="90" rx="6" fill="#DDBE82" stroke="#B8955A"/>
  ${[0, 1, 2].map((r) => [0, 1, 2, 3].map((c) => `<circle cx="${195 + c * 24}" cy="${82 + r * 24}" r="8" fill="#D58E4E"/><circle cx="${195 + c * 24}" cy="${82 + r * 24}" r="2.6" fill="#4A3618"/>`).join('')).join('')}
  <path d="M 195 106 H 267" stroke="#8E959D" stroke-width="10" stroke-linecap="round"/><path d="M 195 106 H 267" stroke="#D4D8DD" stroke-width="7" stroke-linecap="round"/>
  ${t(230, 50, '背面：銅環＋錫橋', { size: 12, color: MUTED })}
  ${t(160, 180, '每個孔各自獨立，靠錫連起來', { size: 13, weight: 700 })}`);

export const markerA1 = () => doc(`
  <rect x="60" y="40" width="200" height="120" rx="8" fill="#E8CD97" stroke="#B8955A"/>
  ${[0, 1, 2, 3].map((r) => [0, 1, 2, 3, 4, 5, 6].map((c) => `<circle cx="${84 + c * 26}" cy="${62 + r * 26}" r="3" fill="#5A4320"/>`).join('')).join('')}
  <circle cx="72" cy="50" r="6" fill="${INK}"/>
  ${arrow(40, 26, 66, 44, RED, 3)}${t(36, 22, 'A1', { anchor: 'end', size: 15, color: RED, weight: 700 })}
  ${t(160, 186, '先找記號，再數孔', { size: 14, color: TEAL, weight: 700 })}`);

export const powerPipe = () => doc(`
  ${pipe('M 20 60 H 300', 18)}
  ${[0, 1, 2, 3].map((i) => pipe(`M ${70 + i * 66} 64 V 130`, 8)).join('')}
  ${['馬達', '感壓', '加速度', '旋鈕'].map((s, i) => `<rect x="${48 + i * 66}" y="130" width="44" height="28" rx="6" fill="#FFFFFF" stroke="${INK}"/>${t(70 + i * 66, 149, s, { size: 11 })}`).join('')}
  ${t(160, 36, '3V3 電源軌 = 總水管', { size: 15, weight: 700, color: BLUE })}
  ${t(160, 186, '每個零件從總水管接一根小水管', { size: 12, color: MUTED })}`);

export const groundLoop = () => doc(`
  <rect x="60" y="50" width="200" height="100" rx="30" fill="none" stroke="${GREEN}" stroke-width="5" stroke-dasharray="14 8"/>
  ${arrow(150, 50, 172, 50, GREEN, 4)}${arrow(170, 150, 148, 150, GREEN, 4)}
  <rect x="40" y="80" width="44" height="40" rx="8" fill="#FFFFFF" stroke="${INK}" stroke-width="2"/>${t(62, 105, '電源', { size: 11 })}
  <rect x="236" y="80" width="44" height="40" rx="8" fill="#FFFFFF" stroke="${INK}" stroke-width="2"/>${t(258, 105, '零件', { size: 11 })}
  ${t(160, 140, 'GND：回家的路', { size: 13, color: GREEN, weight: 700 })}
  ${t(160, 186, '電流要繞一圈回到起點才會流', { size: 12, color: MUTED })}`);

export const twoGnd = () => doc(`
  <rect x="40" y="40" width="240" height="120" rx="8" fill="#E8CD97" stroke="#B8955A"/>
  <path d="M 60 62 H 260" stroke="${INK}" stroke-width="7" stroke-linecap="round"/>${t(160, 56, 'GND（第 2 列）', { size: 11 })}
  <path d="M 60 140 H 260" stroke="${INK}" stroke-width="7" stroke-linecap="round"/>${t(160, 132, 'GND（第 9 列）', { size: 11 })}
  <path d="M 60 62 Q 40 101 60 140" stroke="#2B2B2B" stroke-width="5" fill="none"/>
  ${t(28, 104, '跳線', { size: 12, color: RED, weight: 700 })}
  ${t(160, 186, '上下各一條，零件就近接地', { size: 12, color: MUTED })}`);

// ── 電阻 ──
export const colorCode = () => doc(`
  <g transform="translate(0 -20)">${resistor([30, 90], [290, 90], ['brown', 'black', 'red', 'gold'], { body: 150, dia: 40 })}</g>
  ${[['1', 'brown', 117], ['0', 'black', 136], ['×100', 'red', 156], ['±5%', 'gold', 205]].map(([s, c, x]) =>
    `<line x1="${x}" y1="92" x2="${x}" y2="122" stroke="${BAND[c]}" stroke-width="2"/>${t(x, 138, s, { size: 13, weight: 700 })}`).join('')}
  ${t(160, 172, '棕黑紅 = 10 × 100 = 1000Ω = 1kΩ', { size: 14, weight: 700, color: TEAL })}
  ${t(160, 192, '5 環的金屬膜電阻：前三環才是數字', { size: 11, color: MUTED })}`);

export const currentLimit = () => doc(`
  ${pipe('M 20 100 H 120', 16)}${pipe('M 120 100 H 200', 5)}${pipe('M 200 100 H 300', 16)}
  <rect x="116" y="84" width="88" height="32" rx="8" fill="none" stroke="${YOLK}" stroke-width="2.5" stroke-dasharray="5 4"/>
  ${t(160, 74, 'R1 1kΩ', { size: 14, weight: 700, color: '#C77700' })}
  ${t(60, 136, 'IO6', { size: 13, weight: 700 })}${t(260, 136, '電晶體', { size: 13, weight: 700 })}
  ${t(160, 176, '水管變細，電流被限制在約 2.6mA', { size: 12, color: MUTED })}`);

export const pulldown = () => doc(`
  <rect x="120" y="40" width="80" height="44" rx="10" fill="#FFFFFF" stroke="${INK}" stroke-width="2"/>${t(160, 67, '基極 B', { size: 13, weight: 700 })}
  <path d="M 160 84 l 0 8 ${[0, 1, 2, 3, 4].map(() => 'l 12 6 l -24 6 l 12 0').join(' ')} l 0 8" stroke="${TEAL}" stroke-width="3" fill="none"/>
  <path d="M 130 160 H 190 M 140 168 H 180 M 150 176 H 170" stroke="${INK}" stroke-width="3"/>
  ${t(222, 128, 'R2 10kΩ', { size: 13, weight: 700, color: TEAL, anchor: 'start' })}
  ${t(222, 148, '像彈簧往下拉', { size: 12, color: MUTED, anchor: 'start' })}
  ${t(70, 120, '開機那一瞬間', { size: 12, color: MUTED })}${t(70, 140, '馬達乖乖不動', { size: 13, weight: 700 })}`);

// ── 電晶體 ──
export const faucet = () => doc(`
  ${pipe('M 20 140 H 300', 22)}
  <rect x="146" y="86" width="28" height="40" rx="4" fill="#9AA6B2"/>
  <rect x="130" y="66" width="60" height="16" rx="8" fill="${RED}"/>
  ${pipe('M 40 40 H 140 V 66', 5, '#F2C21B')}
  ${t(70, 30, 'IO6：幾 mA', { size: 12, weight: 700, color: '#C77700' })}
  ${t(250, 120, '馬達：80–120mA', { size: 12, weight: 700, color: BLUE })}
  ${t(160, 186, '小水龍頭控制大水管', { size: 14, weight: 700, color: TEAL })}`);

// 電晶體腳位：pinout 是平面朝你、腳朝下時由左到右的順序（2SC1815＝ECB、S8050＝EBC）
const ROLE = { E: '接地', B: '控制', C: '馬達' };
export const ebc = ({ pinout = 'ECB', label = '2SC1815' } = {}) => doc(`
  <path d="M 120 120 V 40 a 40 40 0 0 1 80 0 V 120 Z" fill="#2A2C30"/>
  <rect x="120" y="116" width="80" height="4" fill="#9AA0A8"/>
  ${t(160, 86, label, { size: 12, color: '#E9E9E9' })}
  ${pinout.split('').map((n, i) => {
    const x = 132 + i * 28;
    return `<path d="M ${x} 120 V 160" stroke="#A7ADB4" stroke-width="4"/>${t(x, 178, n, { size: 15, weight: 700 })}${t(x, 196, ROLE[n], { size: 10, color: MUTED })}`;
  }).join('')}
  ${t(260, 60, '平面朝你', { size: 13, weight: 700, color: TEAL })}${t(260, 80, '腳朝下', { size: 13, weight: 700, color: TEAL })}
  ${t(260, 104, '左到右 ' + pinout.split('').join(' '), { size: 12, color: MUTED })}`);

export const ebcWrong = () => doc(`
  <path d="M 70 120 V 50 a 34 34 0 0 1 68 0 V 120 Z" fill="#2A2C30"/>${t(104, 150, '✓ 平面朝下', { size: 13, color: GREEN, weight: 700 })}
  <path d="M 190 50 V 120 a 34 34 0 0 0 68 0 V 50 Z" fill="#2A2C30" transform="translate(0 0)"/>${t(224, 150, '✗ 轉反了', { size: 13, color: RED, weight: 700 })}
  ${t(160, 186, '反了：馬達很弱、電晶體發燙', { size: 12, color: MUTED })}`);

// ── 二極體與電容 ──
export const flyback = () => doc(`
  <circle cx="90" cy="100" r="40" fill="#C9CED6" stroke="#7E858F" stroke-width="2"/>${t(90, 105, '馬達線圈', { size: 12 })}
  <path d="M 130 100 C 170 40, 230 40, 250 90" stroke="${RED}" stroke-width="3" fill="none" stroke-dasharray="6 5"/>${arrow(240, 78, 250, 92, RED, 3)}
  <g transform="translate(-20 0)">${diode([230, 130], [300, 130], { body: 40, dia: 16 })}</g>
  ${t(170, 40, '斷電瞬間的反衝', { size: 12, color: RED, weight: 700 })}
  ${t(160, 180, '1N4148 = 洩壓閥，讓它繞回馬達自己消化', { size: 12, color: MUTED })}`);

export const diodeDirection = () => doc(`
  ${diode([60, 70], [260, 70], { body: 130, dia: 34 })}
  ${t(84, 118, '色帶 = K（負極）', { size: 13, weight: 700 })}
  ${t(84, 138, '朝 3V3（第 1 列）', { size: 12, color: TEAL })}
  ${t(160, 182, '反了 → 3V3 直接經電晶體短路', { size: 13, color: RED, weight: 700 })}`);

export const tank = () => doc(`
  ${pipe('M 20 150 H 300', 14)}
  <rect x="130" y="44" width="60" height="70" rx="8" fill="${WATER}" stroke="#9AA6B2" stroke-width="3"/>
  ${pipe('M 160 114 V 146', 8)}
  ${t(160, 34, '100µF = 小水塔', { size: 14, weight: 700, color: BLUE })}
  ${t(250, 120, '馬達突然用水', { size: 11, color: MUTED })}${t(250, 136, '水塔先頂著', { size: 11, color: MUTED })}
  ${t(160, 186, '主板電壓不會掉、不會重開機', { size: 12, color: MUTED })}`);

// ── 感壓 ──
export const seesaw = () => doc(`
  <path d="M 50 130 L 270 90" stroke="${INK}" stroke-width="7" stroke-linecap="round"/>
  <path d="M 160 112 l -18 40 h 36 z" fill="${YOLK}"/>
  <rect x="40" y="96" width="40" height="30" rx="6" fill="#E9C46A" stroke="#B88A1B"/>${t(60, 90, '感壓片', { size: 12, weight: 700 })}
  <rect x="244" y="58" width="40" height="30" rx="6" fill="#E8D1A2" stroke="#8C6B3F"/>${t(264, 52, '10kΩ', { size: 12, weight: 700 })}
  ${arrow(60, 40, 60, 80, RED, 3)}${t(60, 30, '用力壓', { size: 12, color: RED, weight: 700 })}
  ${t(160, 186, '壓越用力，感壓片電阻越小，IO2 電壓越高', { size: 12, color: MUTED })}`);

export const fsrIdle = () => doc(`
  ${t(80, 50, '沒碰', { size: 15, weight: 700 })}${t(80, 76, '感壓片 > 1MΩ', { size: 12, color: MUTED })}
  <rect x="40" y="96" width="80" height="60" rx="8" fill="#FFFFFF" stroke="${INK}"/>${t(80, 132, '≈ 0V', { size: 18, weight: 700, color: BLUE })}
  ${t(240, 50, '用力抱', { size: 15, weight: 700 })}${t(240, 76, '感壓片 ≈ 幾 kΩ', { size: 12, color: MUTED })}
  <rect x="200" y="96" width="80" height="60" rx="8" fill="#FFFFFF" stroke="${INK}"/>${t(240, 132, '≈ 2.5V', { size: 18, weight: 700, color: RED })}
  ${arrow(130, 126, 190, 126, MUTED)}
  ${t(160, 188, 'IO2 讀到的電壓', { size: 12, color: MUTED })}`);

export const sensitivity = () => doc(`
  <g transform="translate(-10 -10)">${resistor([40, 80], [180, 80], ['brown', 'black', 'orange', 'gold'], { body: 80, dia: 22 })}</g>
  ${t(100, 104, '10kΩ：一般', { size: 12, weight: 700 })}
  <g transform="translate(-10 60)">${resistor([40, 80], [180, 80], ['yellow', 'violet', 'orange', 'gold'], { body: 80, dia: 22 })}</g>
  ${t(100, 164, '47kΩ：輕摸也有反應', { size: 12, weight: 700, color: TEAL })}
  ${pixelActor(250, 138, 4.2, INK)}`);

// ── 聲音 ──
export const noDac = () => doc(`
  ${t(90, 40, '想要的聲音', { size: 13, weight: 700 })}${wave(20, 100, 140, 34, 1.5, BLUE)}
  ${t(240, 40, 'ESP32-S3 只會', { size: 13, weight: 700 })}${square(180, 130, 120, 60, 40, INK)}
  ${t(240, 160, '0V 或 3.3V', { size: 12, color: MUTED })}
  ${t(160, 190, '沒有 DAC：不能直接輸出「中間」的電壓', { size: 12, color: MUTED })}`);

export const pdm = () => doc(`
  ${square(20, 120, 280, 50, 8, INK, 1.8)}
  ${wave(20, 95, 280, 24, 1, BLUE, 3)}
  ${t(160, 40, 'PDM：每秒開關上百萬次', { size: 14, weight: 700 })}
  ${t(160, 160, '開得越密，聲音越「高」', { size: 12, color: MUTED })}`);

export const lowpass = () => doc(`
  ${square(20, 90, 100, 40, 10, INK, 1.6)}
  ${arrow(126, 70, 150, 70, MUTED)}
  <rect x="154" y="48" width="44" height="44" rx="8" fill="#EAD7A4" stroke="#C49A3C"/>${t(176, 75, '海綿', { size: 11, weight: 700 })}
  ${arrow(202, 70, 222, 70, MUTED)}
  ${wave(226, 70, 80, 20, 1, BLUE)}
  ${t(160, 130, '220Ω ＋ 100nF = 低通濾波', { size: 14, weight: 700, color: TEAL })}
  ${t(160, 156, '把快速的抖動吸掉，留下約 7kHz 以下的聲音', { size: 11.5, color: MUTED })}`);

// ── 檢查 ──
export const beep = () => doc(`
  ${meter(30, 50, 1.1, '000')}
  <path d="M 120 100 q 20 -10 40 0" stroke="${RED}" stroke-width="3" fill="none"/>
  ${t(220, 80, '3V3 ↔ GND', { size: 15, weight: 700 })}
  ${t(220, 110, '嗶～～ = 短路 ✗', { size: 14, color: RED, weight: 700 })}
  ${t(220, 138, '安靜 = 正常 ✓', { size: 14, color: GREEN, weight: 700 })}`);

export const capBeep = () => doc(`
  <g>${ecapTop([110, 100], [140, 100], { r: 40 })}</g>
  ${t(230, 80, '嗶…（停）', { size: 16, weight: 700, color: GREEN })}
  ${t(230, 106, '電表在幫電容充電', { size: 12, color: MUTED })}
  ${t(230, 140, '一直嗶才是問題', { size: 13, weight: 700, color: RED })}`);

// ── 接線 ──
export const wireLength = () => doc(`
  <rect x="30" y="70" width="60" height="80" rx="10" fill="#202326"/>
  <rect x="230" y="80" width="70" height="60" rx="6" fill="#E8CD97" stroke="#B8955A"/>
  <path d="M 90 100 C 140 60, 180 160, 230 110" stroke="${RED}" stroke-width="5" fill="none"/>
  ${t(160, 48, '實際距離 ＋ 1–2cm', { size: 14, weight: 700, color: TEAL })}
  ${t(160, 186, '太短裝不進外殼；太長會亂成一團', { size: 12, color: MUTED })}`);

export const pinSolder = () => doc(`
  <rect x="140" y="20" width="12" height="130" fill="#F2C94C"/><rect x="128" y="140" width="36" height="20" rx="3" fill="#121315"/>
  <rect x="152" y="60" width="110" height="10" rx="5" fill="${RED}"/>
  <rect x="146" y="58" width="22" height="14" rx="7" fill="#DDE1E6" stroke="#8E959D"/>
  <rect x="170" y="54" width="40" height="22" rx="4" fill="#2B2B2B" opacity=".75"/>
  ${t(190, 100, '熱縮套管', { size: 12, color: MUTED })}
  ${t(80, 60, '線頭上錫', { size: 12, weight: 700 })}${t(80, 80, '貼著針腳', { size: 12, weight: 700 })}${t(80, 100, '碰一下就好', { size: 12, weight: 700 })}`);

export const colorsMeaning = () => doc(`
  ${[['#E5484D', '3V3'], ['#2B2B2B', 'GND'], ['#F76B15', '電池'], ['#FFC53D', '感壓'], ['#3E63DD', '馬達'], ['#30A46C', '聲音']].map(([c, s], i) =>
    `<rect x="${24 + (i % 3) * 96}" y="${40 + Math.floor(i / 3) * 60}" width="44" height="12" rx="6" fill="${c}"/>${t(24 + (i % 3) * 96 + 64, 51 + Math.floor(i / 3) * 60, s, { size: 12, anchor: 'start' })}`).join('')}
  ${t(160, 176, '電不在乎顏色，但人在乎', { size: 14, weight: 700, color: TEAL })}`);

export const motorPolarity = () => doc(`
  <g transform="translate(40 30)">${motorPart().svg}</g>
  <g transform="translate(190 30)">${motorPart().svg.replace('#D3322C', 'TMP').replace('#2F5F9E', '#D3322C').replace('TMP', '#2F5F9E')}</g>
  <path d="M 70 20 a 22 22 0 1 1 -4 0" stroke="${YOLK}" stroke-width="3" fill="none"/>
  <path d="M 230 20 a 22 22 0 1 0 4 0" stroke="${YOLK}" stroke-width="3" fill="none"/>
  ${t(160, 160, '接反只是轉的方向相反', { size: 14, weight: 700, color: TEAL })}
  ${t(160, 184, '震起來一樣', { size: 12, color: MUTED })}`);

export const motorVoltage = () => doc(`
  ${t(90, 50, '3V3', { size: 22, weight: 700, color: GREEN })}${t(90, 76, '✓ 剛好', { size: 13, color: GREEN })}
  ${t(230, 50, '電池 4.2V', { size: 22, weight: 700, color: RED })}${t(230, 76, '✗ 超過上限 4.0V', { size: 13, color: RED })}
  <g transform="translate(115 90) scale(0.9)">${motorPart().svg}</g>`);

// 震動馬達模組：板上就是 Q1、D1、電阻
export const moduleInside = () => doc(`
  <g transform="translate(176 30)">${motorModulePart({ annotate: true }).svg}</g>
  ${t(64, 74, '同一套電路', { size: 15, weight: 700, color: TEAL })}
  ${t(64, 98, '商品版自己焊的', { size: 12, color: MUTED })}
  ${t(64, 118, 'Q1・D1・電阻', { size: 13, weight: 700 })}
  ${t(160, 190, '模組＝先幫你焊好的驅動電路', { size: 12.5, color: MUTED })}`);

// 有模組 vs. 自己焊
export const moduleVsBare = () => doc(`
  <g transform="translate(22 18) scale(0.62)">${motorModulePart().svg}</g>
  ${t(62, 114, '模組', { size: 15, weight: 700 })}
  ${t(62, 138, '✓ 三條線就好', { size: 11.5, color: GREEN })}
  ${t(62, 156, '✓ 不容易接錯', { size: 11.5, color: GREEN })}
  ${t(62, 174, '✗ 比較大、比較貴', { size: 11.5, color: RED })}
  <path d="M160 22 V 180" stroke="#E4DCCB" stroke-width="2" stroke-dasharray="4 5"/>
  <g transform="translate(212 16) scale(0.8)">${motorPart().svg}</g>
  ${t(250, 114, '自己焊', { size: 15, weight: 700 })}
  ${t(250, 138, '✓ 小、便宜', { size: 11.5, color: GREEN })}
  ${t(250, 156, '✓ 想塞哪就塞哪', { size: 11.5, color: GREEN })}
  ${t(250, 174, '✗ 要自己焊對', { size: 11.5, color: RED })}`);

export const fsrInside = () => doc(`
  <rect x="40" y="70" width="240" height="14" rx="4" fill="#E9C46A"/>
  <rect x="40" y="116" width="240" height="14" rx="4" fill="#E9C46A"/>
  ${Array.from({ length: 14 }, (_, i) => `<circle cx="${56 + i * 16}" cy="${100 + (i % 2 ? 4 : -4)}" r="4" fill="#4A4D55"/>`).join('')}
  ${arrow(160, 20, 160, 62, RED, 3)}${t(160, 16, '壓', { size: 13, color: RED, weight: 700 })}
  ${t(160, 166, '導電顆粒擠得越近，電阻越小', { size: 13, weight: 700, color: TEAL })}`);

export const fsrHeat = () => doc(`
  <circle cx="90" cy="90" r="46" fill="#E9C46A" stroke="#B88A1B"/>
  <path d="M 70 60 q 10 10 0 20 q -10 10 0 20" stroke="${RED}" stroke-width="3" fill="none"/>
  <rect x="160" y="70" width="40" height="40" rx="3" fill="#1B1A17"/>${t(180, 132, '排母', { size: 12 })}
  ${t(260, 84, '✗ 直接燙', { size: 13, color: RED, weight: 700 })}${t(260, 108, '✓ 用排母插', { size: 13, color: GREEN, weight: 700 })}
  ${t(160, 182, '壞了也能直接換一片', { size: 12, color: MUTED })}`);

export const ampMagnify = () => doc(`
  ${wave(20, 100, 90, 10, 1.5, BLUE)}
  <path d="M 130 60 L 190 100 L 130 140 Z" fill="#F4EAD0" stroke="${YOLK}" stroke-width="2.5"/>${t(152, 106, '×8.5', { size: 12, weight: 700, color: '#C77700' })}
  ${wave(205, 100, 100, 40, 1.5, RED)}
  ${t(160, 182, 'ESP32 的訊號太小，推不動喇叭', { size: 12, color: MUTED })}`);

export const ampPower = () => doc(`
  <rect x="30" y="40" width="80" height="50" rx="8" fill="#FFFFFF" stroke="${INK}" stroke-width="2"/>${t(70, 70, '3V3', { size: 14, weight: 700 })}
  <rect x="210" y="40" width="80" height="50" rx="8" fill="#FFFFFF" stroke="${INK}" stroke-width="2"/>${t(250, 70, '電池', { size: 14, weight: 700 })}
  ${arrow(70, 92, 70, 130, MUTED)}${t(70, 150, '主板、螢幕', { size: 12 })}
  ${arrow(250, 92, 250, 130, RED, 3)}${t(250, 150, '喇叭（大電流）', { size: 12, weight: 700, color: RED })}
  ${t(160, 186, '喇叭不跟主板搶電，畫面才不會閃', { size: 12, color: MUTED })}`);

export const ampVolume = () => doc(`
  <circle cx="110" cy="100" r="46" fill="#2F5F9E"/><circle cx="110" cy="100" r="30" fill="#F4F4F0"/>
  <path d="M110 76 V 100" stroke="#2F5F9E" stroke-width="5" stroke-linecap="round"/>
  <path d="M 50 150 a 70 70 0 0 1 20 -100" stroke="${YOLK}" stroke-width="3" fill="none"/>${arrow(58, 66, 70, 50, YOLK, 3)}
  ${t(230, 90, '先轉到最小', { size: 15, weight: 700, color: TEAL })}${t(230, 116, '再慢慢調大', { size: 13, color: MUTED })}`);

// ── I2C ──
export const i2cBus = () => doc(`
  <path d="M 20 120 H 300" stroke="${MUTED}" stroke-width="3" stroke-dasharray="10 6"/>
  <rect x="40" y="70" width="110" height="44" rx="12" fill="${YOLK}"/>${t(95, 98, 'I2C 公車', { size: 13, weight: 700 })}
  <circle cx="68" cy="118" r="8" fill="${INK}"/><circle cx="122" cy="118" r="8" fill="${INK}"/>
  ${[['0x53', 'GY-291', 205], ['0x68', '以後加 RTC', 278]].map(([a, s, x]) => `<path d="M ${x} 120 V 60" stroke="${INK}" stroke-width="3"/><rect x="${x - 26}" y="40" width="52" height="24" rx="6" fill="#FFFFFF" stroke="${INK}"/>${t(x, 57, a, { size: 11, weight: 700 })}${t(x, 140, s, { size: 11, color: MUTED })}`).join('')}
  ${t(160, 182, 'SDA 載資料、SCL 打拍子；位址就是站牌', { size: 12, color: MUTED })}`);

export const i2cPins = () => doc(`
  <rect x="40" y="40" width="240" height="70" rx="8" fill="#4B2A7B"/>
  ${['GND', 'VCC', 'CS', 'INT1', 'INT2', 'SDO', 'SDA', 'SCL'].map((n, i) => `<rect x="${58 + i * 28}" y="104" width="6" height="22" fill="#D4A72C"/>${t(61 + i * 28, 96, n, { size: 9, color: '#FFFFFF', weight: 700 })}`).join('')}
  <path d="M 89 126 Q 103 144 117 126" stroke="${RED}" stroke-width="3" fill="none"/>${t(103, 160, 'CS 拉高 = 用 I2C', { size: 12, color: RED, weight: 700 })}
  ${t(229, 160, 'SDO 接地 = 位址 0x53', { size: 12, color: TEAL, weight: 700 })}
  <path d="M 201 126 V 140" stroke="${TEAL}" stroke-width="3"/>`);

export const doorbell = () => doc(`
  <rect x="40" y="60" width="90" height="90" rx="10" fill="#4B2A7B"/>${t(85, 110, 'GY-291', { size: 12, color: '#FFFFFF', weight: 700 })}
  <path d="M 130 105 H 200" stroke="#978365" stroke-width="5"/>${t(165, 96, 'INT1', { size: 12, weight: 700 })}
  <circle cx="230" cy="105" r="26" fill="${YOLK}"/><path d="M 220 112 h 20 l -4 -6 v -10 a 6 6 0 0 0 -12 0 v 10 z" fill="#FFFFFF"/>
  ${t(160, 40, '拿起來、拍一下 → 按門鈴', { size: 13, weight: 700 })}
  ${t(160, 182, '主板可以放心睡覺省電', { size: 12, color: MUTED })}`);

// ── 旋鈕 ──
export const encoderPhases = () => doc(`
  ${t(30, 76, 'A', { size: 14, weight: 700, anchor: 'start' })}${square(50, 80, 250, 34, 60, TEAL)}
  ${t(30, 146, 'B', { size: 14, weight: 700, anchor: 'start' })}${square(50, 150, 250, 34, 60, '#D6409F', 2.4, 15)}
  ${t(160, 30, '兩個錯開的開關', { size: 14, weight: 700 })}
  ${t(160, 190, '誰先通，就知道往哪個方向轉', { size: 12, color: MUTED })}`);

export const encoderPress = () => doc(`
  <circle cx="110" cy="100" r="44" fill="#3A3D42"/><circle cx="110" cy="100" r="26" fill="#55595F"/>
  ${arrow(110, 20, 110, 52, RED, 3)}
  ${t(230, 90, '往下按 = SW', { size: 15, weight: 700, color: TEAL })}${t(230, 116, '接通到 GND', { size: 12, color: MUTED })}`);

export const level3v3 = () => doc(`
  <rect x="40" y="60" width="90" height="80" rx="10" fill="#202326"/>${t(85, 106, 'IO 腳', { size: 13, color: '#FFFFFF' })}
  ${t(220, 80, '3.3V ✓', { size: 18, weight: 700, color: GREEN })}
  ${t(220, 120, '5V ✗ 燒掉', { size: 18, weight: 700, color: RED })}
  <path d="M 128 70 l 12 -10 l -4 12 l 12 -4 l -14 14 l 4 -10 z" fill="${YOLK}"/>`);

// ── 電池 ──
export const polarity = () => doc(`
  ${meter(30, 40, 1.15, '3.71')}
  <rect x="190" y="80" width="70" height="30" rx="4" fill="#F1F1EC" stroke="#9A9A92"/>
  <path d="M 100 130 C 140 160, 180 140, 205 110" stroke="${RED}" stroke-width="3" fill="none"/>
  <path d="M 100 140 C 150 180, 220 170, 245 110" stroke="${INK}" stroke-width="3" fill="none"/>
  ${t(160, 40, '讀到 +3.7V：紅棒那邊是 +', { size: 13, weight: 700, color: TEAL })}
  ${t(225, 140, '讀到 −3.7V：反了', { size: 11, color: RED })}`);

export const vbatCharge = () => doc(`
  <rect x="30" y="60" width="80" height="60" rx="8" fill="#FFFFFF" stroke="${INK}" stroke-width="2"/>${t(70, 95, 'USB', { size: 14, weight: 700 })}
  <rect x="130" y="60" width="70" height="60" rx="8" fill="#202326"/>${t(165, 95, '充電晶片', { size: 11, color: '#FFFFFF' })}
  <rect x="220" y="60" width="80" height="60" rx="8" fill="#DCE1E7" stroke="#9AA3AD" stroke-width="2"/>${t(260, 95, '電池', { size: 14, weight: 700 })}
  ${arrow(112, 90, 128, 90, GREEN, 3)}${arrow(202, 90, 218, 90, GREEN, 3)}
  ${t(160, 160, '插 USB 時自動幫電池充電', { size: 13, weight: 700, color: GREEN })}`);

export const notYet = () => doc(`
  <g transform="translate(75 30)">${batteryPart({ unplugged: true }).svg}</g>
  ${t(160, 186, '先用 USB 測過，再讓電池上場', { size: 13, weight: 700, color: TEAL })}`);

// ── 通電 ──
export const usbFirst = () => doc(`
  <rect x="40" y="70" width="90" height="60" rx="10" fill="#FFFFFF" stroke="${INK}" stroke-width="2"/>${t(85, 106, 'USB', { size: 15, weight: 700 })}
  <path d="M 160 64 l 40 14 v 30 c 0 24 -20 36 -40 42 c -20 -6 -40 -18 -40 -42 v -30 z" fill="${GREEN}" opacity=".9" transform="translate(90 0)"/>
  ${t(160, 170, 'USB 有限流保護，出事比較安全', { size: 12, color: MUTED })}`);

export const touchHot = () => doc(`
  <path d="M 120 140 q 0 -40 14 -40 q 14 0 14 40" fill="#F6C9A8" stroke="${INK}" stroke-width="2"/>
  <rect x="200" y="40" width="20" height="100" rx="10" fill="#FFFFFF" stroke="${INK}" stroke-width="2"/><circle cx="210" cy="148" r="16" fill="${RED}"/><rect x="205" y="70" width="10" height="72" fill="${RED}"/>
  ${t(160, 30, '通電 30 秒後摸一摸', { size: 13, weight: 700 })}
  ${t(160, 186, '燙手 → 馬上拔電', { size: 14, weight: 700, color: RED })}`);

export const chargeLed = () => doc(`
  <rect x="100" y="50" width="120" height="100" rx="14" fill="#202326"/>
  <circle cx="190" cy="76" r="9" fill="${RED}"/><circle cx="190" cy="76" r="16" fill="${RED}" opacity=".25"/>
  ${t(190, 104, 'CHG', { size: 11, color: '#C9CED6' })}
  ${t(160, 182, '插電池再插 USB：充電燈亮', { size: 13, weight: 700, color: TEAL })}`);

export const allDone = () => doc(`
  ${stageMark({ box: { x: 90, y: 64, w: 140 }, color: INK, actor: true })}
  ${[0, 1, 2, 3, 4, 5].map((i) => `<rect x="${40 + i * 48}" y="${24 + (i % 2) * 18}" width="8" height="14" rx="2" fill="${[YOLK, RED, BLUE, GREEN, TEAL, '#D6409F'][i]}" transform="rotate(${i * 20} ${44 + i * 48} ${30 + (i % 2) * 18})"/>`).join('')}`);
