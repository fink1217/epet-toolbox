// PENG! 品牌圖形：數位戲台標誌與像素角色。全站的 Logo、favicon、插圖裡的螢幕都從這裡畫。
// 標誌依使用者提供的「B 方案・數位戲台」設計稿重畫；拿到正式向量檔時，只要換掉 stageMark() 的內容。
//
// 標誌是「實心剪影＋鏤空線條」：用 mask 把電路走線、焊盤、螢幕挖空，
// 所以顏色跟著 currentColor 走，放在淺底或深底都只要改 CSS 的 color。

let uid = 0;   // 每次呼叫給 mask 一個新 id：同一頁有好幾個標誌時，才不會被藏起來的那一個拖累

// 剪影（mask 裡的白色＝保留）
const SOLID = `
  <circle cx="120" cy="8" r="6.5"/>
  <path d="M28 34 Q32 46 48 45 Q92 40 120 15 Q148 40 192 45 Q208 46 212 34" fill="none" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M120 14 V40" fill="none" stroke-width="4"/>
  <path d="M28 62 Q82 58 120 31 Q158 58 212 62 L204 81 L36 81 Z"/>
  <path d="M5 47 Q8 63 26 62 M235 47 Q232 63 214 62" fill="none" stroke-width="10" stroke-linecap="round"/>
  <rect x="34" y="65" width="172" height="16" rx="8"/>
  <path d="M24 66 V93 M216 66 V93" fill="none" stroke-width="3.2"/>
  <ellipse cx="24" cy="103" rx="6.5" ry="10"/><ellipse cx="216" cy="103" rx="6.5" ry="10"/>
  <rect x="46" y="76" width="148" height="86" rx="15"/>
  <rect x="11" y="156" width="218" height="32" rx="16"/>`;

// 鏤空（mask 裡的黑色＝挖掉）
const CUT = `
  <circle cx="120" cy="48" r="6.4" fill="none" stroke-width="3.2"/>
  <path d="M101 47 q6 -6 11 -1 M139 47 q-6 -6 -11 -1" fill="none" stroke-width="2.6" stroke-linecap="round"/>
  <path d="M112 55 L104 63 H64 M128 55 L136 63 H176" fill="none" stroke-width="2.8" stroke-linejoin="round"/>
  <circle cx="60" cy="63" r="3.6" fill="none" stroke-width="2.6"/><circle cx="180" cy="63" r="3.6" fill="none" stroke-width="2.6"/>
  <path d="M60 73 H100 M140 73 H180" fill="none" stroke-width="2.8" stroke-linecap="round"/>
  <rect x="53" y="83" width="134" height="68" rx="10" fill="none" stroke-width="3.2"/>
  <rect x="61" y="91" width="118" height="52" rx="5"/>
  <path d="M38 172 H80 M160 172 H202" fill="none" stroke-width="3.2"/>
  <circle cx="32" cy="172" r="6" fill="none" stroke-width="3.6"/><circle cx="208" cy="172" r="6" fill="none" stroke-width="3.6"/>
  <g fill="none" stroke-width="3.2">
    <circle cx="104" cy="171" r="5"/><circle cx="120" cy="171" r="5"/><circle cx="136" cy="171" r="5"/>
    <path d="M104 176 V189 M120 176 V189 M136 176 V189"/>
  </g>`;

// 螢幕四角的像素轉角（畫在挖空之後，所以又是保留）
const CORNER = '<rect x="66" y="96" width="10" height="3.4"/><rect x="66" y="96" width="3.4" height="10"/><rect x="72" y="102" width="3.4" height="3.4"/>';

// 螢幕（舞台）內框，給 actor 與插圖對位用
export const STAGE_WINDOW = { x: 61, y: 91, w: 118, h: 52 };

// stageMark({ actor, extra, box, color })：回傳 SVG 字串。
//   actor：舞台上站一個像素角色
//   extra：額外的 SVG（用標誌自己的 240×190 座標），疊在最上面，例如布幕
//   box：{ x, y, w } 嵌進別的插圖時的位置與寬度（高度照比例）
//   color：標誌顏色；不給就跟著 currentColor
export function stageMark({ actor = false, extra = '', box = null, color = '', cls = 'stage-mark', label = 'PENG! 數位戲台' } = {}) {
  const id = `stage-k${++uid}`;
  const w = STAGE_WINDOW;
  const guest = actor ? pixelActor(w.x + w.w / 2, w.y + w.h - 5, 3.6) : '';
  const place = box ? ` x="${box.x}" y="${box.y}" width="${box.w}" height="${(box.w * 190) / 240}"` : '';
  const style = color ? ` style="color:${color}"` : '';
  const a11y = box ? 'aria-hidden="true"' : `role="img" aria-label="${label}"`;
  return `<svg${cls && !box ? ` class="${cls}"` : ''}${place}${style} viewBox="0 0 240 190" xmlns="http://www.w3.org/2000/svg" ${a11y}>
  <defs><mask id="${id}" maskUnits="userSpaceOnUse" x="0" y="0" width="240" height="190">
    <g fill="#fff" stroke="#fff">${SOLID}</g>
    <g fill="#000" stroke="#000">${CUT}</g>
    <g fill="#fff">${CORNER}<g transform="rotate(180 120 117)">${CORNER}</g></g>
  </mask></defs>
  <rect width="240" height="190" fill="currentColor" mask="url(#${id})"/>${guest}${extra}
</svg>`;
}

// 像素角色：12×10 格，「X」是身體，「.」是透明（眼睛也是透明，透出底色）
const ACTOR = [
  '..X......X..',
  '.XXX....XXX.',
  '.XXXXXXXXXX.',
  'XXXXXXXXXXXX',
  'XX.XXXXXX.XX',
  'XX.XXXXXX.XX',
  'XXXXXXXXXXXX',
  '.XXXXXXXXXX.',
  '..XXXXXXXX..',
  '..XX....XX..',
];
export const ACTOR_COLS = ACTOR[0].length;
export const ACTOR_ROWS = ACTOR.length;

// pixelActor(腳底中心 x, 腳底 y, 每格大小, 顏色)：同一列連續的格子併成一個矩形，SVG 才不會太大
export function pixelActor(cx, foot, px = 4, fill = 'currentColor', extra = '') {
  const x0 = cx - (ACTOR_COLS * px) / 2;
  const y0 = foot - ACTOR_ROWS * px;
  const rects = ACTOR.flatMap((row, j) => [...row.matchAll(/X+/g)].map((m) =>
    `<rect x="${(x0 + m.index * px).toFixed(2)}" y="${(y0 + j * px).toFixed(2)}" width="${(m[0].length * px).toFixed(2)}" height="${px.toFixed(2)}"/>`));
  return `<g class="actor" fill="${fill}" shape-rendering="crispEdges"${extra}>${rects.join('')}</g>`;
}
