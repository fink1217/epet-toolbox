// 兩個版本的成品示意圖（首頁、版本選擇用）。

// 螢幕裡的小雞（簡化版）
const tinyChick = (cx, cy, s = 1) => `
  <g transform="translate(${cx} ${cy}) scale(${s})">
    <ellipse cx="0" cy="4" rx="17" ry="18" fill="#FFC93C"/>
    <ellipse cx="0" cy="8" rx="11" ry="11" fill="#FFE08A"/>
    <circle cx="-6" cy="0" r="2.2" fill="#1E1F22"/><circle cx="6" cy="0" r="2.2" fill="#1E1F22"/>
    <path d="M-3 4 l3 4 l3 -4z" fill="#FF8A00"/>
    <path d="M0 -14 q-3 -4 -1 -6 q1 3 4 1 q-1 4 -3 5z" fill="#FF9F0A"/>
  </g>`;

const screen = (x, y, w, h) => `
  <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" fill="#BFE7FF"/>
  <rect x="${x}" y="${y + h * 0.72}" width="${w}" height="${h * 0.28}" rx="0" fill="#A8E6A1"/>
  <circle cx="${x + w - 12}" cy="${y + 14}" r="6" fill="#FFE08A"/>
  ${tinyChick(x + w / 2, y + h * 0.62, 1)}
  <rect x="${x + 8}" y="${y + 8}" width="34" height="5" rx="2.5" fill="#fff" opacity=".85"/>
  <rect x="${x + 8}" y="${y + 8}" width="22" height="5" rx="2.5" fill="#FF8A8A"/>`;

// 商品版：觸控螢幕＋手指
export function productDevice() {
  return `<svg viewBox="0 0 200 170" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <ellipse cx="100" cy="160" rx="56" ry="6" fill="#1E1F22" opacity=".07"/>
  <rect x="58" y="10" width="84" height="146" rx="26" fill="#FFFFFF" stroke="#1E1F22" stroke-width="3"/>
  <rect x="68" y="22" width="64" height="118" rx="12" fill="#1E1F22"/>
  ${screen(72, 26, 56, 110)}
  <g transform="translate(120 104) rotate(-18)">
    <path d="M0 0 q0 -14 8 -14 q8 0 8 14 v26 q0 14 -16 16 q-14 0 -18 -14 l-6 -18 q-2 -6 4 -7 q5 0 8 6z" fill="#F6C9A8" stroke="#1E1F22" stroke-width="2.4"/>
  </g>
  <circle cx="112" cy="92" r="9" fill="none" stroke="#FFB020" stroke-width="2.5" opacity=".9"/>
  <circle cx="112" cy="92" r="15" fill="none" stroke="#FFB020" stroke-width="2" opacity=".45"/>
</svg>`;
}

// 自玩版：一般螢幕＋側邊旋鈕
export function personalDevice() {
  return `<svg viewBox="0 0 200 170" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <ellipse cx="100" cy="160" rx="56" ry="6" fill="#1E1F22" opacity=".07"/>
  <rect x="50" y="10" width="84" height="146" rx="26" fill="#FFFFFF" stroke="#1E1F22" stroke-width="3"/>
  <rect x="60" y="22" width="64" height="118" rx="12" fill="#1E1F22"/>
  ${screen(64, 26, 56, 110)}
  <rect x="134" y="66" width="14" height="22" rx="3" fill="#DDD3C2" stroke="#1E1F22" stroke-width="2.4"/>
  <circle cx="160" cy="77" r="17" fill="#4A4D55" stroke="#1E1F22" stroke-width="3"/>
  <circle cx="160" cy="77" r="11" fill="#8A8F98"/>
  <path d="M160 66 v7" stroke="#fff" stroke-width="3" stroke-linecap="round"/>
  <path d="M140 46 a26 26 0 0 1 40 0" fill="none" stroke="#FFB020" stroke-width="2.6" stroke-linecap="round"/>
  <path d="M176 40 l5 6 l-8 2" fill="none" stroke="#FFB020" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;
}

// 資料流向：AI 圖 → 生成器 → 素材資料夾 → 打包器 → SD 卡 → 電子雞
export function pipeline() {
  const box = (x, label, sub, color, icon) => `
    <g transform="translate(${x} 18)">
      <rect width="120" height="92" rx="16" fill="#FFFFFF" stroke="${color}" stroke-width="2.5"/>
      <text x="60" y="38" text-anchor="middle" font-size="26">${icon}</text>
      <text x="60" y="64" text-anchor="middle" font-family="Huninn, Noto Sans TC, sans-serif" font-size="15" fill="#1E1F22">${label}</text>
      <text x="60" y="82" text-anchor="middle" font-family="Noto Sans TC, sans-serif" font-size="11" fill="#8A8F98">${sub}</text>
    </g>`;
  const arrow = (x, label) => `
    <g transform="translate(${x} 64)">
      <path d="M4 0 h44" stroke="#DDD3C2" stroke-width="3" stroke-linecap="round"/>
      <path d="M42 -6 l8 6 l-8 6" fill="none" stroke="#DDD3C2" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
      <text x="27" y="-12" text-anchor="middle" font-family="Noto Sans TC, sans-serif" font-size="11" fill="#11807A">${label}</text>
    </g>`;
  return `<svg viewBox="0 0 920 128" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  ${box(0, 'AI 生成的圖', '有背景、大小不一', '#DDD3C2', '🎨')}
  ${arrow(122, '② 生成器')}
  ${box(176, '素材資料夾', '中文名・高解析母檔', '#FFB020', '🗂️')}
  ${arrow(298, '③ 打包')}
  ${box(352, 'SD 卡', '英文名・剛好的尺寸', '#11807A', '💾')}
  ${arrow(474, '插回去')}
  ${box(528, '電子雞', '只負責讀和畫', '#FF8A00', '🐣')}
  <g transform="translate(672 18)">
    <rect width="240" height="92" rx="16" fill="#FFF3D6"/>
    <text x="16" y="34" font-family="Huninn, Noto Sans TC, sans-serif" font-size="15" fill="#6B4300">資料只往右流</text>
    <text x="16" y="58" font-family="Noto Sans TC, sans-serif" font-size="12" fill="#6B4300">每個工具只管一段，</text>
    <text x="16" y="76" font-family="Noto Sans TC, sans-serif" font-size="12" fill="#6B4300">出錯時一眼就知道是哪一段。</text>
  </g>
</svg>`;
}
