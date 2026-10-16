// 主板排針圖：「背面朝上（看得到晶片）、USB 朝上」，左右兩排腳位直接取自 data/boards.js。
import { WIRES } from '../data/boards.js';

const FONT = "font-family=\"'Noto Sans TC', system-ui, sans-serif\"";
const PITCH = 26;                 // 2.54mm 排針間距畫成 26px
const MM = PITCH / 2.54;
const CHIP_W = 56;
const CHIP_H = 20;
const GAP = 13;                   // 腳到標籤的距離
const SIDE = GAP + CHIP_W + 8;    // 標籤區寬度

// 第一支腳離板子上緣幾 mm（依官方尺寸圖估計）
const FIRST_PIN_MM = { touch147: 11, lcd147b: 13.4 };

// 每支腳一個唯一的 key：重複的名字（GND）加上 #序號
export function pinList(board) {
  const all = [
    ...board.header.left.map((label, idx) => ({ label, side: 'left', idx })),
    ...board.header.right.map((label, idx) => ({ label, side: 'right', idx })),
  ];
  const count = {};
  for (const p of all) count[p.label] = (count[p.label] || 0) + 1;
  const seen = {};
  for (const p of all) {
    seen[p.label] = (seen[p.label] || 0) + 1;
    p.key = count[p.label] > 1 ? `${p.label}#${seen[p.label]}` : p.label;
  }
  return all;
}

// 用哪一支 GND：跟 3V3 同一排、最靠近 3V3 的那支（電源線可以並排走）
export function gndKey(board) {
  const pins = pinList(board);
  const v = pins.find((p) => p.label === '3V3');
  const g = pins.filter((p) => p.label === 'GND')
    .sort((a, b) => (a.side === v.side ? 0 : 100) + Math.abs(a.idx - v.idx) - ((b.side === v.side ? 0 : 100) + Math.abs(b.idx - v.idx)));
  return g[0].key;
}

function textOn(hex) {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return 0.299 * r + 0.587 * g + 0.114 * b > 165 ? '#1E1F22' : '#FFFFFF';
}

// used：{ 腳位 key: WIRES 的 key }，例如 { '3V3': '3V3', 'GND#3': 'GND', IO2: 'IO2' }
// focus：只想強調其中幾支時傳 Set；其他已用腳位變淡
// face：'back' 背面（排針那面，預設）／'front' 正面（螢幕那面：排針在背面，左右相反、畫成虛線）
export function boardLayer(board, { used = {}, focus = null, caption = true, face = 'back' } = {}) {
  const front = face === 'front';
  const pcbW = board.pcb.w * MM;
  const pcbH = board.pcb.h * MM;
  const x0 = SIDE;
  const y0 = 16;
  const w = pcbW + SIDE * 2;
  const h = pcbH + y0 + (caption ? 34 : 10);
  const cx = x0 + pcbW / 2;
  const half = (board.rowGap * MM) / 2;
  const first = y0 + (FIRST_PIN_MM[board.id] ?? (board.pcb.h - board.header.left.length * 2.54) / 2) * MM;
  // 畫在左邊還是右邊：正面看的時候左右相反
  const pins = pinList(board).map((p) => {
    const left = (p.side === 'left') !== front;
    return { ...p, left, x: left ? cx - half : cx + half, y: first + p.idx * PITCH };
  });
  const rows = Math.max(board.header.left.length, board.header.right.length);
  const out = [];

  // 板子
  out.push(`<rect x="${x0}" y="${y0}" width="${pcbW}" height="${pcbH}" rx="16" fill="#202326" stroke="#0B0C0E" stroke-width="2"/>`);
  // USB-C（上方）
  const usbW = 9 * MM;
  out.push(`<rect x="${cx - usbW / 2}" y="${y0 - 10}" width="${usbW}" height="${7.4 * MM}" rx="7" fill="#B8BEC6" stroke="#7E858F" stroke-width="1.5"/>`);
  out.push(`<rect x="${cx - usbW / 2 + 8}" y="${y0 + 4}" width="${usbW - 16}" height="${7.4 * MM - 26}" rx="5" fill="#5D636B"/>`);
  out.push(`<text x="${cx}" y="${y0 + 7.4 * MM + 4}" text-anchor="middle" font-size="10" fill="#C9CED6" ${FONT}>USB</text>`);
  if (front) {
    // 正面：螢幕幾乎蓋滿整塊板子
    const m = 1.6 * MM;
    const sy = y0 + 9.6 * MM;
    const sh = pcbH - 9.6 * MM - m;
    out.push(`<rect x="${x0 + m}" y="${sy}" width="${pcbW - m * 2}" height="${sh}" rx="10" fill="#1B2A3A"/>`);
    out.push(`<rect x="${x0 + m + 6}" y="${sy + 6}" width="${pcbW - m * 2 - 12}" height="${sh - 12}" rx="7" fill="#BFE7FF"/>`);
    out.push(`<rect x="${x0 + m + 6}" y="${sy + sh * 0.68}" width="${pcbW - m * 2 - 12}" height="${sh * 0.32 - 6}" fill="#A8E6A1"/>`);
    const ccx = cx;
    const ccy = sy + sh * 0.58;
    out.push(`<ellipse cx="${ccx}" cy="${ccy}" rx="22" ry="24" fill="#FFC93C"/><ellipse cx="${ccx}" cy="${ccy + 5}" rx="14" ry="14" fill="#FFE08A"/>`
      + `<circle cx="${ccx - 8}" cy="${ccy - 4}" r="2.8" fill="#1E1F22"/><circle cx="${ccx + 8}" cy="${ccy - 4}" r="2.8" fill="#1E1F22"/>`
      + `<path d="M ${ccx - 4} ${ccy + 1} l 4 5 l 4 -5z" fill="#FF8A00"/>`);
    out.push(`<text x="${cx}" y="${sy + 26}" text-anchor="middle" font-size="12" font-weight="700" fill="#1B2A3A" ${FONT}>螢幕</text>`);
  } else {
    // 背面：TF 卡槽、晶片
    const tfY = y0 + 9.4 * MM;
    out.push(`<rect x="${cx - 5.6 * MM}" y="${tfY}" width="${11.2 * MM}" height="${8 * MM}" rx="3" fill="#C7CCD1" stroke="#8F959C"/>`);
    out.push(`<text x="${cx}" y="${tfY + 4.6 * MM}" text-anchor="middle" font-size="10" fill="#5D636B" ${FONT}>TF 卡槽</text>`);
    const chipY = first + (rows - 1) * PITCH * 0.62;
    out.push(`<rect x="${cx - 3.6 * MM}" y="${chipY - 3.6 * MM}" width="${7.2 * MM}" height="${7.2 * MM}" rx="4" fill="#33373C" stroke="#4A4F56"/>`);
    out.push(`<circle cx="${cx - 2.4 * MM}" cy="${chipY - 2.4 * MM}" r="3" fill="#5D636B"/>`);
    out.push(`<text x="${cx}" y="${chipY + 4}" text-anchor="middle" font-size="9.5" fill="#9AA0A8" ${FONT}>ESP32-S3</text>`);
    // 排針：黑色塑膠座
    for (const side of [true, false]) {
      const col = pins.filter((p) => p.left === side);
      const px = col[0].x;
      out.push(`<rect x="${px - PITCH / 2 + 1}" y="${col[0].y - PITCH / 2 + 1}" width="${PITCH - 2}" height="${col.length * PITCH - 2}" rx="3" fill="#121315"/>`);
    }
  }
  // 針腳：背面是金色方針；正面看不到，畫成虛線圓圈表示「在背面這個位置」
  for (const p of pins) {
    const wire = used[p.key];
    const on = wire && (!focus || focus.has(p.key));
    out.push(`<g class="board-pin" data-pin="${p.key}">${front
      ? `<circle cx="${p.x}" cy="${p.y}" r="5" fill="none" stroke="${on ? '#F2C94C' : '#8A8F98'}" stroke-width="1.8" stroke-dasharray="2.5 2.5"/>`
      : `<rect x="${p.x - 5}" y="${p.y - 5}" width="10" height="10" rx="1.5" fill="${on ? '#F2C94C' : '#B8962E'}" stroke="${on ? '#FFFFFF' : 'none'}" stroke-width="1.6"/>`}</g>`);
  }

  // 標籤
  for (const p of pins) {
    const wire = used[p.key];
    const color = wire ? WIRES[wire].color : null;
    const dim = wire && focus && !focus.has(p.key);
    const sx = p.left ? p.x - GAP - CHIP_W : p.x + GAP;
    const op = dim ? 0.35 : 1;
    out.push(`<g class="board-pin" data-pin="${p.key}">`);
    out.push(`<line x1="${p.left ? sx + CHIP_W : sx}" y1="${p.y}" x2="${p.x + (p.left ? -6 : 6)}" y2="${p.y}" stroke="${color || '#DDD3C2'}" stroke-width="${color ? 3 : 1.4}" opacity="${op}"${front ? ' stroke-dasharray="4 3"' : ''}/>`);
    out.push(color
      ? `<rect x="${sx}" y="${p.y - CHIP_H / 2}" width="${CHIP_W}" height="${CHIP_H}" rx="${CHIP_H / 2}" fill="${color}" stroke="#1E1F22" stroke-width="1.2" opacity="${op}"/>`
      : `<rect x="${sx}" y="${p.y - CHIP_H / 2}" width="${CHIP_W}" height="${CHIP_H}" rx="${CHIP_H / 2}" fill="#FFFFFF" stroke="#DDD3C2" stroke-width="1.2"/>`);
    out.push(`<text x="${sx + CHIP_W / 2}" y="${p.y + 4.2}" text-anchor="middle" font-size="11.5" font-weight="700" fill="${color ? textOn(color) : '#8A8F98'}" opacity="${op}" ${FONT}>${p.label}</text>`);
    out.push('</g>');
  }

  if (caption) {
    out.push(`<text x="${cx}" y="${y0 + pcbH + 24}" text-anchor="middle" font-size="12" fill="#8A8F98" ${FONT}>${front
      ? '正面（螢幕）・排針在背面，左右跟背面圖相反'
      : '背面朝上・USB 朝上'}</text>`);
  }

  const byKey = Object.fromEntries(pins.map((p) => [p.key, p]));
  return {
    svg: `<g class="board">${out.join('')}</g>`,
    w, h,
    box: { x0, y0, x1: x0 + pcbW, y1: y0 + pcbH },
    // 腳位的接線點：標籤的外側端點，線從這裡往外拉
    pin(key) {
      const p = byKey[key];
      if (!p) throw new Error(`主板沒有 ${key} 這支腳`);
      const left = p.left;
      return { x: left ? p.x - GAP - CHIP_W : p.x + GAP + CHIP_W, y: p.y, dir: [left ? -1 : 1, 0], side: p.side, pinX: p.x };
    },
  };
}
