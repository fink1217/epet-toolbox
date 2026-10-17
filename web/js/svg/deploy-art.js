// 「寫入裝置」頁的插圖：兩張主圖、開幕進度、繪本插圖。全部回傳 SVG 字串。
import { stageMark, pixelActor, STAGE_WINDOW } from './stage.js';

const INK = '#1B1A17';
const MUTED = '#8A8377';
const LINE = '#CFC5B1';
const YOLK = '#C49A3C';
const TEAL = '#2F6B55';
const RED = '#B3392B';
const ACCENT = '#A63A2B';
const GOLD = YOLK;
const T = (x, y, _unused, text, { size = 13, fill = INK, anchor = 'middle', display = false, weight = display ? 700 : 400 } = {}) =>
  `<text x="${x}" y="${y}" text-anchor="${anchor}" font-family="${display ? 'Noto Serif TC, ' : ''}Noto Sans TC, sans-serif" font-size="${size}" font-weight="${weight}" fill="${fill}">${text}</text>`;
const svg = (w, h, body) => `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${body}</svg>`;

// 小小的 ESP32 主板（背面朝上）
const board = (x, y, s = 1) => `
  <g transform="translate(${x} ${y}) scale(${s})">
    <rect width="60" height="96" rx="9" fill="#1F2A2E" stroke="${INK}" stroke-width="2"/>
    <rect x="18" y="-6" width="24" height="12" rx="3" fill="#C9CED6" stroke="${INK}" stroke-width="1.6"/>
    <rect x="16" y="46" width="28" height="28" rx="3" fill="#3A464C"/>
    <text x="30" y="64" text-anchor="middle" font-family="Noto Sans TC, sans-serif" font-size="7" fill="#C9CED6">S3</text>
    ${Array.from({ length: 9 }, (_, i) => `<circle cx="7" cy="${18 + i * 8.5}" r="2.2" fill="#E8C66A"/><circle cx="53" cy="${18 + i * 8.5}" r="2.2" fill="#E8C66A"/>`).join('')}
    <rect x="16" y="20" width="28" height="16" rx="2" fill="#9AA3A8"/>
  </g>`;

// 筆電
const laptop = (x, y) => `
  <g transform="translate(${x} ${y})">
    <rect x="10" y="0" width="120" height="78" rx="8" fill="#FFFFFF" stroke="${INK}" stroke-width="2.4"/>
    <rect x="18" y="8" width="104" height="62" rx="4" fill="#F4EAD0"/>
    <path d="M0 84 h140 l-8 10 h-124z" fill="#E4DCCB" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"/>
  </g>`;

// ── 主圖 ──
export function flashHero() {
  return svg(320, 170, `
    ${laptop(14, 30)}
    ${T(84, 74, '', '{ 程式 }', { size: 15, fill: '#6B5017', display: true })}
    <path d="M154 120 C 190 120, 200 70, 236 70" fill="none" stroke="${INK}" stroke-width="5" stroke-linecap="round"/>
    <path d="M154 120 C 190 120, 200 70, 236 70" fill="none" stroke="${YOLK}" stroke-width="2.2" stroke-dasharray="4 7" stroke-linecap="round">
      <animate attributeName="stroke-dashoffset" from="22" to="0" dur="0.8s" repeatCount="indefinite"/>
    </path>
    ${board(240, 30, 1.05)}
  `);
}

export function sdHero() {
  const folder = (x, y, label, color) => `
    <g transform="translate(${x} ${y})">
      <path d="M0 8 h18 l6 -6 h30 v40 h-54z" fill="${color}" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>
      ${T(27, 30, '', label, { size: 10 })}
    </g>`;
  return svg(320, 170, `
    <g transform="translate(26 18)">
      <path d="M0 0 h86 l22 22 v114 h-108z" fill="#2B3A55" stroke="${INK}" stroke-width="2.6" stroke-linejoin="round"/>
      ${Array.from({ length: 6 }, (_, i) => `<rect x="${12 + i * 13}" y="8" width="8" height="22" rx="2" fill="#E8C66A"/>`).join('')}
      ${T(54, 92, '', 'SD', { size: 30, fill: '#fff', display: true })}
    </g>
    <path d="M150 88 h26" stroke="${LINE}" stroke-width="3" stroke-linecap="round"/>
    <path d="M170 82 l8 6 l-8 6" fill="none" stroke="${LINE}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
    ${folder(190, 22, 'pet', '#EAD7A4')}
    ${folder(252, 66, '172x320', '#E3EDE7')}
    ${folder(190, 110, 'sfx', '#E6EDF6')}
    <path d="M218 64 v28 h32" fill="none" stroke="${LINE}" stroke-width="2"/>
    <path d="M206 64 v52" fill="none" stroke="${LINE}" stroke-width="2"/>
  `);
}

// ── 開幕：燒錄進度 0..1。布幕從中間往兩邊拉開，燒完角色登台 ──
let seq = 0;
const sparkle = (x, y, r) => `<path d="M${x} ${y - r} L${x + r * 0.25} ${y - r * 0.25} L${x + r} ${y} L${x + r * 0.25} ${y + r * 0.25} L${x} ${y + r} L${x - r * 0.25} ${y + r * 0.25} L${x - r} ${y} L${x - r * 0.25} ${y - r * 0.25}Z" fill="${GOLD}"/>`;
export function curtain(progress = 0) {
  const p = Math.max(0, Math.min(1, progress));
  const { x, y, w, h } = STAGE_WINDOW;
  const open = 8 + (w / 2 - 8) * (1 - p);   // 每片布幕的寬度：全開時收成 8px 的一束
  const folds = (x0, width) => Array.from({ length: Math.floor(width / 6) }, (_, i) =>
    `<path d="M${(x0 + 3 + i * 6).toFixed(1)} ${y + 6} V${y + h}" stroke="#7E2418" stroke-width="1.2" opacity=".55"/>`).join('');
  const s = w / 10;   // 上緣垂幔：10 個往下彎的半圓
  const valance = `M${x} ${y} H${x + w} V${y + 5}${` a${s / 2} 3 0 0 1 -${s} 0`.repeat(10)}Z`;
  const id = `curtain-${++seq}`;
  const extra = `
    <defs><clipPath id="${id}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="5"/></clipPath></defs>
    <g clip-path="url(#${id})">
      <rect x="${x}" y="${y}" width="${open}" height="${h}" fill="${ACCENT}"/>${folds(x, open)}
      <rect x="${x + w - open}" y="${y}" width="${open}" height="${h}" fill="${ACCENT}"/>${folds(x + w - open, open)}
      <path d="${valance}" fill="#7E2418"/>
    </g>
    ${p >= 1 ? sparkle(x + 24, y + 22, 5) + sparkle(x + w - 22, y + 18, 6) + sparkle(x + w - 34, y + 34, 3.5) : ''}`;
  return stageMark({ actor: true, extra, color: INK, label: `開幕進度 ${Math.round(p * 100)}%` });
}

// ── 刷韌體的繪本 ──
export function firmwareArt() {
  return svg(320, 180, `
    ${laptop(10, 40)}
    ${T(80, 70, '', '我是戲台', { size: 12, fill: '#6B5017' })}
    ${T(80, 88, '', '的後台', { size: 12, fill: '#6B5017' })}
    <path d="M160 90 h40" stroke="${YOLK}" stroke-width="4" stroke-linecap="round"/>
    <path d="M194 82 l10 8 l-10 8" fill="none" stroke="${YOLK}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
    ${board(222, 40)}
    ${T(160, 168, '', '燒進去以後，拔掉 USB 也記得', { size: 11, fill: MUTED })}
  `);
}

export function mergedBinArt() {
  const blk = (y, h, label, sub, color) => `
    <rect x="20" y="${y}" width="120" height="${h}" rx="6" fill="${color}" stroke="${INK}" stroke-width="2"/>
    ${T(80, y + h / 2 - 2, '', label, { size: 12 })}
    ${T(80, y + h / 2 + 12, '', sub, { size: 9.5, fill: MUTED })}`;
  return svg(320, 180, `
    ${blk(12, 40, '開機程式', 'bootloader', '#F4EAD0')}
    ${blk(58, 40, '分割表', '哪段放什麼', '#E3EDE7')}
    ${blk(104, 64, '戲台程式', 'app', '#E6EDF6')}
    <path d="M152 88 h34" stroke="${LINE}" stroke-width="3" stroke-linecap="round"/>
    <path d="M180 80 l9 8 l-9 8" fill="none" stroke="${LINE}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
    <rect x="200" y="30" width="100" height="116" rx="10" fill="#FFFFFF" stroke="${INK}" stroke-width="2.4"/>
    ${T(250, 82, '', 'firmware', { size: 13, display: true })}
    ${T(250, 100, '', '.bin', { size: 13, display: true })}
    <path d="M200 146 h-6 v-116 h6" fill="none" stroke="${RED}" stroke-width="2"/>
    ${T(250, 166, '', '從位址 0x0 開始一次寫完', { size: 11, fill: RED })}
  `);
}

export function bootButtonArt() {
  return svg(320, 180, `
    ${board(56, 62, 1.1)}
    <circle cx="74" cy="78" r="17" fill="${YOLK}" opacity=".3"/>
    <rect x="66" y="70" width="16" height="16" rx="3" fill="#C9CED6" stroke="${INK}" stroke-width="2"/>
    <path d="M74 22 v34" stroke="${RED}" stroke-width="3" stroke-linecap="round"/>
    <path d="M66 48 l8 9 l8 -9" fill="none" stroke="${RED}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
    ${T(84, 30, '', 'BOOT 鍵', { size: 12, anchor: 'start', weight: 700 })}
    ${T(220, 62, '', '① 按住 BOOT', { size: 14, anchor: 'start', display: true })}
    ${T(220, 92, '', '② 插上 USB', { size: 14, anchor: 'start', display: true })}
    ${T(220, 122, '', '③ 放開', { size: 14, anchor: 'start', display: true })}
    ${T(220, 152, '', '→ 進入燒錄模式', { size: 12, anchor: 'start', fill: TEAL })}
  `);
}

export function browserArt() {
  return svg(320, 180, `
    <rect x="20" y="16" width="280" height="148" rx="12" fill="#FFFFFF" stroke="${INK}" stroke-width="2.4"/>
    <path d="M20 44 h280" stroke="${LINE}" stroke-width="2"/>
    <circle cx="38" cy="30" r="4" fill="${RED}"/><circle cx="52" cy="30" r="4" fill="${YOLK}"/><circle cx="66" cy="30" r="4" fill="#3A7A45"/>
    <rect x="86" y="23" width="196" height="14" rx="7" fill="#F9F5EC"/>
    ${T(184, 34, '', 'https://…/deploy.html', { size: 9.5, fill: MUTED })}
    <rect x="60" y="62" width="200" height="82" rx="10" fill="#F9F5EC" stroke="${LINE}" stroke-width="2"/>
    ${T(160, 86, '', '網站想要連接序列埠', { size: 12 })}
    <rect x="80" y="96" width="160" height="20" rx="4" fill="#F4EAD0" stroke="${YOLK}"/>
    ${T(160, 110, '', 'USB JTAG/serial (COM5)', { size: 10.5 })}
    <rect x="196" y="122" width="52" height="16" rx="8" fill="${INK}"/>
    ${T(222, 134, '', '連線', { size: 10, fill: '#fff' })}
  `);
}

// ── 打包的繪本 ──
export function sizeFoldersArt() {
  // 依實際解析度等比例畫：320x480 高 110，其餘照比例
  const k = 110 / 480;
  const scr = (x, w, h, label) => `
    <rect x="${x}" y="${150 - h * k}" width="${w * k}" height="${h * k}" rx="5" fill="#1B1A17"/>
    <rect x="${x + 3}" y="${153 - h * k}" width="${w * k - 6}" height="${h * k - 6}" rx="3" fill="#BFE7FF"/>
    ${T(x + (w * k) / 2, 168, '', label, { size: 10.5 })}`;
  return svg(320, 180, `
    ${scr(40, 172, 320, '172x320')}
    ${scr(120, 240, 320, '240x320')}
    ${scr(212, 320, 480, '320x480')}
    ${T(160, 22, '', '每種螢幕一個資料夾，裝置只讀自己那一個', { size: 12, fill: TEAL })}
  `);
}

export function englishNamesArt() {
  return svg(320, 180, `
    <rect x="16" y="30" width="130" height="120" rx="10" fill="#F7E3DE"/>
    ${T(81, 56, '', '中文檔名', { size: 13, display: true })}
    ${T(81, 86, '', '待機/001.png', { size: 12 })}
    ${T(81, 110, '', '→ ???/001.png', { size: 12, fill: RED })}
    ${T(81, 136, '', 'ESP32 可能讀不到', { size: 10.5, fill: RED })}
    <rect x="174" y="30" width="130" height="120" rx="10" fill="#E5F0E3"/>
    ${T(239, 56, '', '英文檔名', { size: 13, display: true })}
    ${T(239, 86, '', 'anim/idle/000.qoi', { size: 11.5 })}
    ${T(239, 110, '', '→ 一定讀得到', { size: 12, fill: '#3A7A45' })}
    ${T(239, 136, '', '中文只留在你的電腦', { size: 10.5, fill: '#3A7A45' })}
  `);
}

export function formatsArt() {
  const col = (x, title, l1, l2, color) => `
    <rect x="${x}" y="20" width="92" height="140" rx="10" fill="#FFFFFF" stroke="${color}" stroke-width="2.4"/>
    ${T(x + 46, 46, '', title, { size: 15, display: true })}
    ${T(x + 46, 128, '', l1, { size: 10.5 })}
    ${T(x + 46, 146, '', l2, { size: 10.5, fill: MUTED })}`;
  return svg(320, 180, `
    ${col(10, 'JPEG', '最小、解得快', '沒有透明 → 背景', TEAL)}
    <rect x="26" y="58" width="60" height="50" rx="4" fill="#BFE7FF"/><rect x="26" y="90" width="60" height="18" fill="#A8E6A1"/>
    ${col(114, 'QOI', '解得快、有透明', '→ 角色、圖示', YOLK)}
    <rect x="130" y="58" width="60" height="50" rx="4" fill="#EEE"/>${pixelActor(160, 100, 2.8, INK)}
    ${col(218, 'PNG', '有透明但解很慢', '只當母檔', LINE)}
    <rect x="234" y="58" width="60" height="50" rx="4" fill="#EEE"/>
    ${T(264, 90, '', '⏳', { size: 22 })}
  `);
}

export function anchorArt() {
  return svg(320, 180, `
    <rect x="20" y="14" width="150" height="150" rx="8" fill="#F9F5EC" stroke="${LINE}" stroke-width="2"/>
    ${pixelActor(95, 128, 4.6, INK)}
    <rect x="67" y="82" width="56" height="46" fill="none" stroke="${TEAL}" stroke-width="2" stroke-dasharray="5 4"/>
    <path d="M95 128 H69" stroke="${INK}" stroke-width="1.6" marker-end="url(#ah)"/>
    <path d="M52 128 V84" stroke="${INK}" stroke-width="1.6" marker-end="url(#ah)"/>
    <path d="M47 82 h20 M47 128 h20" stroke="${MUTED}" stroke-width="1" stroke-dasharray="2 2"/>
    <defs><marker id="ah" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0 L8 4 L0 8z" fill="${INK}"/></marker></defs>
    <circle cx="95" cy="128" r="5" fill="${RED}"/>
    ${T(82, 144, '', 'dx', { size: 11 })}
    ${T(40, 109, '', 'dy', { size: 11 })}
    ${T(95, 158, '', 'anchor（腳底）', { size: 10.5, fill: RED })}
    ${T(246, 70, '', '角色要走路？', { size: 13, display: true })}
    ${T(246, 94, '', '只改 anchor', { size: 12, fill: TEAL })}
    ${T(246, 114, '', '每一幀的 dx、dy', { size: 11, fill: MUTED })}
    ${T(246, 130, '', '都不用重算', { size: 11, fill: MUTED })}
  `);
}

export function fontSubsetArt(subsetKB = 16) {
  return svg(320, 180, `
    <rect x="16" y="24" width="120" height="136" rx="8" fill="#E6EDF6" stroke="${INK}" stroke-width="2"/>
    ${Array.from({ length: 8 }, (_, i) => `<path d="M30 ${42 + i * 12} h92" stroke="#C5D3E6" stroke-width="5" stroke-linecap="round"/>`).join('')}
    ${T(76, 150, '', '完整繁中字型 571 KB', { size: 10.5 })}
    <path d="M150 92 h28" stroke="${LINE}" stroke-width="3" stroke-linecap="round"/>
    <path d="M172 84 l9 8 l-9 8" fill="none" stroke="${LINE}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
    <rect x="196" y="54" width="108" height="76" rx="8" fill="#F4EAD0" stroke="${YOLK}" stroke-width="2"/>
    ${T(250, 86, '', '餵食 玩耍', { size: 15, display: true })}
    ${T(250, 108, '', '睡覺 狀態…', { size: 15, display: true })}
    ${T(250, 150, '', `只收用到的字 ≈ ${subsetKB} KB`, { size: 10.5, fill: TEAL })}
  `);
}

export function audioArt() {
  const wave = (x, y, w, amp, n, color) => {
    let d = `M${x} ${y}`;
    for (let i = 0; i <= n; i++) d += ` L${x + (i * w) / n} ${y + Math.sin(i * 0.9) * amp * (i % 3 ? 1 : 0.5)}`;
    return `<path d="${d}" fill="none" stroke="${color}" stroke-width="2"/>`;
  };
  return svg(320, 180, `
    ${wave(16, 54, 120, 16, 60, TEAL)}
    ${wave(16, 96, 120, 14, 60, '#2F5F9E')}
    ${T(76, 136, '', '44100 Hz・立體聲', { size: 11 })}
    <path d="M150 76 h28" stroke="${LINE}" stroke-width="3" stroke-linecap="round"/>
    <path d="M172 68 l9 8 l-9 8" fill="none" stroke="${LINE}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
    ${wave(196, 76, 110, 18, 30, YOLK)}
    ${T(251, 136, '', '22050 Hz・單聲道', { size: 11 })}
    ${T(251, 154, '', '檔案只剩 1/4', { size: 11, fill: TEAL })}
  `);
}
