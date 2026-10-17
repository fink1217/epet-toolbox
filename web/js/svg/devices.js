// 兩個版本的成品示意圖（首頁、版本選擇用）與資料流向圖。
import { stageMark, pixelActor } from './stage.js';

const INK = '#1B1A17';
const MUTED = '#8A8377';
const LINE = '#CFC5B1';
const CREAM = '#F3EEE3';
const ACCENT = '#A63A2B';
const SERIF = 'Noto Serif TC, serif';
const SANS = 'Noto Sans TC, sans-serif';

// 螢幕畫面：深色底、上方小戲台標誌、角色站在台口、左上三顆像素愛心
const heart = (x, y, fill) => `<path d="M${x} ${y + 1}h2v-1h2v1h1v-1h2v1h2v3h-1v1h-1v1h-1v1h-1v1h-1v-1h-1v-1h-1v-1h-1v-1h-1z" fill="${fill}" shape-rendering="crispEdges"/>`;
const screen = (x, y, w, h) => `
  <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" fill="${INK}"/>
  ${stageMark({ box: { x: x + 9, y: y + 16, w: w - 18 }, color: CREAM })}
  <path d="M${x + 6} ${y + h - 18} h${w - 12}" stroke="${CREAM}" stroke-width="1.2" opacity=".5"/>
  ${pixelActor(x + w / 2, y + h - 18, 2.6, CREAM)}
  ${heart(x + 6, y + 6, ACCENT)}${heart(x + 18, y + 6, ACCENT)}${heart(x + 30, y + 6, '#5A5550')}`;

const shell = (x) => `
  <ellipse cx="${x + 42}" cy="160" rx="56" ry="6" fill="${INK}" opacity=".07"/>
  <rect x="${x}" y="10" width="84" height="146" rx="24" fill="#FFFDF8" stroke="${INK}" stroke-width="3"/>
  <rect x="${x + 10}" y="22" width="64" height="118" rx="12" fill="${INK}"/>
  ${screen(x + 14, 26, 56, 110)}`;

// 商品版：觸控螢幕＋手指
export function productDevice() {
  return `<svg viewBox="0 0 200 170" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  ${shell(58)}
  <g transform="translate(120 104) rotate(-18)">
    <path d="M0 0 q0 -14 8 -14 q8 0 8 14 v26 q0 14 -16 16 q-14 0 -18 -14 l-6 -18 q-2 -6 4 -7 q5 0 8 6z" fill="#EBC7A6" stroke="${INK}" stroke-width="2.4"/>
  </g>
  <circle cx="112" cy="92" r="9" fill="none" stroke="${ACCENT}" stroke-width="2.5" opacity=".9"/>
  <circle cx="112" cy="92" r="15" fill="none" stroke="${ACCENT}" stroke-width="2" opacity=".45"/>
</svg>`;
}

// 自玩版：一般螢幕＋側邊旋鈕
export function personalDevice() {
  return `<svg viewBox="0 0 200 170" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  ${shell(50)}
  <rect x="134" y="66" width="14" height="22" rx="3" fill="#E4DCCB" stroke="${INK}" stroke-width="2.4"/>
  <circle cx="160" cy="77" r="17" fill="#4A463F" stroke="${INK}" stroke-width="3"/>
  <circle cx="160" cy="77" r="11" fill="#8A8377"/>
  <path d="M160 66 v7" stroke="#fff" stroke-width="3" stroke-linecap="round"/>
  <path d="M140 46 a26 26 0 0 1 40 0" fill="none" stroke="${ACCENT}" stroke-width="2.6" stroke-linecap="round"/>
  <path d="M176 40 l5 6 l-8 2" fill="none" stroke="${ACCENT}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;
}

// 流程圖的小圖示（36×28，墨線）
const ICONS = {
  picture: `<rect x="2" y="2" width="32" height="24" rx="3" fill="none" stroke="${INK}" stroke-width="2"/>
    <path d="M5 23 l9 -10 l6 6 l4 -4 l8 8" fill="none" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/><circle cx="26" cy="9" r="3" fill="${INK}"/>`,
  folder: `<path d="M2 6 h11 l4 -4 h17 v24 h-32z" fill="none" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/><path d="M2 11 h32" stroke="${INK}" stroke-width="2"/>`,
  sd: `<path d="M8 2 h16 l6 6 v18 h-22z" fill="none" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>
    <path d="M13 4 v6 M17 4 v6 M21 4 v6" stroke="${INK}" stroke-width="2"/>`,
};

// 資料流向：AI 圖 → 生成器 → 素材資料夾 → 打包器 → SD 卡 → 戲台
export function pipeline() {
  const box = (x, label, sub, { icon = '', color = LINE, stage = false } = {}) => `
    <g transform="translate(${x} 18)">
      <rect width="120" height="92" rx="12" fill="#FFFDF8" stroke="${color}" stroke-width="${stage ? 2.5 : 1.8}"/>
      ${stage ? stageMark({ box: { x: 38, y: 12, w: 44 }, color: INK }) : `<g transform="translate(42 14)">${icon}</g>`}
      <text x="60" y="64" text-anchor="middle" font-family="${SERIF}" font-weight="700" font-size="15" fill="${INK}">${label}</text>
      <text x="60" y="82" text-anchor="middle" font-family="${SANS}" font-size="11" fill="${MUTED}">${sub}</text>
    </g>`;
  const arrow = (x, label) => `
    <g transform="translate(${x} 64)">
      <path d="M4 0 h44" stroke="${INK}" stroke-width="1.6" stroke-linecap="round"/>
      <circle cx="4" cy="0" r="3" fill="#FFFDF8" stroke="${INK}" stroke-width="1.6"/>
      <path d="M42 -5 l7 5 l-7 5" fill="none" stroke="${INK}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
      <text x="27" y="-12" text-anchor="middle" font-family="${SANS}" font-size="11" fill="${ACCENT}">${label}</text>
    </g>`;
  return `<svg viewBox="0 0 920 128" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  ${box(0, 'AI 生成的圖', '有背景、大小不一', { icon: ICONS.picture })}
  ${arrow(122, '② 生成器')}
  ${box(176, '素材資料夾', '中文名・高解析母檔', { icon: ICONS.folder })}
  ${arrow(298, '③ 打包')}
  ${box(352, 'SD 卡', '英文名・剛好的尺寸', { icon: ICONS.sd })}
  ${arrow(474, '插回去')}
  ${box(528, '戲台', '只負責讀和演', { color: ACCENT, stage: true })}
  <g transform="translate(672 18)">
    <rect width="240" height="92" rx="12" fill="#F4EAD0"/>
    <text x="16" y="34" font-family="${SERIF}" font-weight="700" font-size="15" fill="#6B5017">資料只往右流</text>
    <text x="16" y="58" font-family="${SANS}" font-size="12" fill="#6B5017">每個工具只管一段，</text>
    <text x="16" y="76" font-family="${SANS}" font-size="12" fill="#6B5017">出錯時一眼就知道是哪一段。</text>
  </g>
</svg>`;
}
