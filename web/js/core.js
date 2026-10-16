// 全站共用：版本狀態、頁首、「為什麼」繪本、提示訊息、DOM 小工具。
import { VERSIONS, BOARDS } from './data/boards.js';
import { mascot } from './svg/mascot.js';

// ── 網頁字型 ──
// 用 JS 插入樣式表，而不是在 CSS 裡 @import：@import 會讓整頁的程式等 Google 字型下載完，
// 學校網路慢或連不到 Google 時頁面會卡住。現在字型慢慢來，頁面先用系統字型照常運作。
const FONTS_URL = 'https://fonts.googleapis.com/css2?family=Huninn&family=Noto+Sans+TC:wght@400;500;700;900&display=swap';
// 樣式表載完（或失敗、逾時）時完成；需要精確字型的功能（打包點陣字）要先等它
export const fontsReady = new Promise((resolve) => {
  for (const href of ['https://fonts.googleapis.com', 'https://fonts.gstatic.com']) {
    document.head.append(Object.assign(document.createElement('link'), { rel: 'preconnect', href, crossOrigin: '' }));
  }
  const link = Object.assign(document.createElement('link'), { rel: 'stylesheet', href: FONTS_URL });
  link.onload = () => resolve(true);
  link.onerror = () => resolve(false);
  setTimeout(() => resolve(false), 10000);
  document.head.append(link);
});

// ── 安全的 localStorage（私密視窗可能會丟例外）──
export const store = {
  get(key, fallback = null) {
    try {
      const v = localStorage.getItem(key);
      return v === null ? fallback : JSON.parse(v);
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* 存不了就算了，只是方便功能 */ }
  },
};

// ── DOM 小工具 ──
// h('div', { class: 'card', onclick: fn }, '文字', childEl)
export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === false || v == null) continue;
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'html') el.innerHTML = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

// SVG 字串 → 元素
export function svgEl(markup) {
  const t = document.createElement('template');
  t.innerHTML = markup.trim();
  return t.content.firstElementChild;
}

// ── 版本（商品版／自玩版）──
const VERSION_KEY = 'epet.version';

export function getVersionId() {
  const fromUrl = new URLSearchParams(location.search).get('v');
  if (fromUrl && VERSIONS[fromUrl]) return fromUrl;
  return store.get(VERSION_KEY);
}
export function getVersion() {
  const id = getVersionId();
  if (!id) return null;
  const v = VERSIONS[id];
  return { ...v, boardInfo: BOARDS[v.board] };
}
export function setVersionId(id) {
  store.set(VERSION_KEY, id);
  window.dispatchEvent(new CustomEvent('versionchange', { detail: id }));
}
export function onVersionChange(fn) {
  window.addEventListener('versionchange', () => fn(getVersion()));
}

// 版本選擇對話框；回傳 Promise，選好才 resolve
export function openVersionPicker({ required = false } = {}) {
  return new Promise((resolve) => {
    const current = getVersionId();
    const dlg = h('dialog', { class: 'picker' });
    const cards = Object.values(VERSIONS).map((v) =>
      h('button', {
        class: 'version-card', 'aria-pressed': String(v.id === current),
        onclick: () => { setVersionId(v.id); dlg.close(); dlg.remove(); resolve(getVersion()); },
      },
        h('span', { class: 'name' }, v.name),
        h('span', { class: 'muted' }, v.tagline),
        h('span', { class: 'chip' }, BOARDS[v.board].name),
      ));
    dlg.append(h('div', { class: 'picker-body stack' },
      h('div', { class: 'say' }, svgEl(mascot({ mood: 'think' })),
        h('div', { class: 'bubble' }, '你要做哪一台？之後隨時可以從右上角切換。')),
      h('div', { class: 'grid-2' }, cards),
      required ? null : h('div', { class: 'row', style: 'justify-content:flex-end' },
        h('button', { class: 'btn btn-ghost', onclick: () => { dlg.close(); dlg.remove(); resolve(getVersion()); } }, '取消')),
    ));
    if (required) dlg.addEventListener('cancel', (e) => e.preventDefault());
    document.body.append(dlg);
    dlg.showModal();
  });
}

// 需要版本才能顯示的頁面：沒選過就先問
export async function requireVersion() {
  return getVersion() || openVersionPicker({ required: true });
}

// ── 頁首與頁尾 ──
const NAV = [
  { href: 'index.html', label: '首頁', id: 'home' },
  { href: 'wiring.html', label: '① 接線教學', id: 'wiring' },
  { href: 'assets.html', label: '② 素材生成器', id: 'assets' },
  { href: 'deploy.html', label: '③ 寫入裝置', id: 'deploy' },
];

export function mountShell(active) {
  const top = h('header', { class: 'topbar' },
    h('div', { class: 'wrap' },
      h('a', { class: 'brand', href: 'index.html' }, svgEl(mascot({ mood: 'happy' })), '電子雞工具箱'),
      h('nav', { class: 'nav' }, NAV.map((n) =>
        h('a', { href: n.href, 'aria-current': n.id === active ? 'page' : false }, n.label))),
      loupeToggle(),
      versionChip(),
    ));
  document.body.prepend(top);
  document.body.append(
    h('footer', { class: 'site' }, h('div', { class: 'wrap' },
      '電子雞工具箱 · 請用電腦版 Chrome 或 Edge 開啟（燒錄與寫入 SD 卡需要）')),
    h('div', { class: 'toast-host', id: 'toast-host' }),
  );
  initLoupe();
}

// ── 放大鏡：滑鼠移到插圖上，游標周圍放大顯示 ──
// 做法：把整張 SVG 複製一份放進圓形鏡片裡，放大後平移，讓游標所在的點剛好在鏡片中央。
// 鏡片不吃滑鼠事件，底下原本的圖照樣收得到滑鼠（零件說明卡照常運作）。
const LOUPE_KEY = 'epet.loupe';
const LOUPE_TARGETS = '.figure svg, .book .art svg';
export const loupe = {
  enabled: store.get(LOUPE_KEY, true),
  visible: false,
  size: 280,          // 鏡片直徑（px）
  zoom: 2.5,          // 放大倍率
  get radius() { return this.size / 2; },
};
let lens = null;
let lensSvg = null;
let lensSrc = null;

function loupeToggle() {
  const btn = h('button', {
    class: 'loupe-toggle', title: '放大鏡：滑鼠移到圖上會放大',
    onclick: () => {
      loupe.enabled = !loupe.enabled;
      store.set(LOUPE_KEY, loupe.enabled);
      paint();
      if (!loupe.enabled) hideLens();
    },
  });
  const paint = () => {
    btn.setAttribute('aria-pressed', String(loupe.enabled));
    btn.textContent = loupe.enabled ? '🔍 放大鏡 開' : '🔍 放大鏡 關';
  };
  paint();
  return btn;
}

function hideLens() {
  if (lens) lens.hidden = true;
  loupe.visible = false;
}

// 圖上有東西變了（例如管路亮起來）：下次移動滑鼠時重新複製，放大鏡裡才看得到
export function refreshLoupe() {
  lensSrc = null;
}

// 找到滑鼠底下「最外層」的那張插圖 SVG
function figureSvgAt(target) {
  let svg = target.closest?.('svg');
  while (svg?.parentElement?.closest('svg')) svg = svg.parentElement.closest('svg');
  return svg && svg.matches(LOUPE_TARGETS) ? svg : null;
}

function showLens(svg, x, y) {
  if (!lens) {
    lens = h('div', { class: 'loupe', 'aria-hidden': 'true' });
    document.body.append(lens);
  }
  const r = svg.getBoundingClientRect();
  // 換了一張圖（或同一張圖重畫過）才重新複製
  if (svg !== lensSrc || !lensSvg || lensSvg.dataset.w !== String(r.width)) {
    lensSrc = svg;
    lensSvg = svg.cloneNode(true);
    lensSvg.removeAttribute('class');
    lensSvg.dataset.w = String(r.width);
    Object.assign(lensSvg.style, { width: `${r.width}px`, height: `${r.height}px` });
    lens.replaceChildren(lensSvg);
  }
  const R = loupe.radius;
  const z = loupe.zoom;
  lensSvg.style.transform = `translate(${R - (x - r.left) * z}px, ${R - (y - r.top) * z}px) scale(${z})`;
  lens.style.left = `${x - R}px`;
  lens.style.top = `${y - R}px`;
  lens.hidden = false;
  loupe.visible = true;
}

function initLoupe() {
  document.addEventListener('pointermove', (e) => {
    // 只給滑鼠用：觸控螢幕手指會擋住，改用各頁的「放大」按鈕
    const svg = loupe.enabled && e.pointerType === 'mouse' ? figureSvgAt(e.target) : null;
    if (svg) showLens(svg, e.clientX, e.clientY);
    else if (loupe.visible) hideLens();
  });
  document.documentElement.addEventListener('mouseleave', hideLens);
  window.addEventListener('scroll', hideLens, { passive: true });
  // 圖重畫時（例如切換正面／背面）舊的複製品作廢
  document.addEventListener('click', () => { lensSrc = null; }, true);
}

function versionChip() {
  const btn = h('button', { class: 'version-chip', onclick: () => openVersionPicker() });
  const paint = () => {
    const v = getVersion();
    btn.textContent = v ? `${v.name} ▾` : '選擇版本 ▾';
  };
  paint();
  window.addEventListener('versionchange', paint);
  return btn;
}

// ── 提示訊息 ──
export function toast(msg, kind = '') {
  const host = $('#toast-host') || document.body;
  const t = h('div', { class: `toast ${kind}` }, msg);
  host.append(t);
  setTimeout(() => t.remove(), 3200);
}

// ── 「為什麼」繪本 ──
// pages: [{ art: SVG 字串, title: '標題', text: '一兩句話（可含簡單 HTML）' }]
export function book(pages) {
  let i = 0;
  const pageEls = pages.map((p) => h('div', { class: 'book-page' },
    h('div', { class: 'art' }, p.art ? svgEl(p.art) : ''),
    h('div', {}, h('h4', {}, p.title), h('div', { html: p.text }))));
  const dots = h('div', { class: 'book-dots' }, pages.map(() => h('span')));
  const prev = h('button', { 'aria-label': '上一頁', onclick: () => go(i - 1) }, '←');
  const next = h('button', { 'aria-label': '下一頁', onclick: () => go(i + 1) }, '→');
  const el = h('div', { class: 'book' }, h('div', { class: 'book-pages' }, pageEls),
    h('div', { class: 'book-nav' }, prev, dots, next));
  function go(n) {
    i = Math.max(0, Math.min(pages.length - 1, n));
    pageEls.forEach((p, k) => p.classList.toggle('active', k === i));
    [...dots.children].forEach((d, k) => d.classList.toggle('on', k === i));
    prev.disabled = i === 0;
    next.disabled = i === pages.length - 1;
  }
  go(0);
  if (pages.length === 1) el.querySelector('.book-nav').classList.add('hidden');
  return el;
}

// 可收合的「為什麼」：預設收起來
export function why(pages, label = '為什麼要這樣？') {
  const body = h('div', { class: 'why-body' }, book(pages));
  const el = h('div', { class: 'why' },
    h('button', { class: 'why-toggle', onclick: () => el.classList.toggle('open') },
      h('span', { class: 'arrow' }, '▸'), '🤔 ', label),
    body);
  return el;
}

// 一句話的必要提醒
export function callout(kind, text) {
  const ico = { warn: '⚠️', tip: '💡', ok: '✅', info: '👉' }[kind] || '👉';
  return h('div', { class: `callout ${kind}` }, h('span', { class: 'ico' }, ico), h('span', { html: text }));
}

// ── 瀏覽器能力 ──
export const support = {
  serial: 'serial' in navigator,
  fs: 'showDirectoryPicker' in window,
};

// 頁面需要的能力不支援時，在頁首下方掛一條提醒
export function warnIfUnsupported(needs) {
  const missing = needs.filter((n) => !support[n]);
  if (!missing.length) return false;
  const names = { serial: 'USB 燒錄', fs: '直接讀寫資料夾' };
  const bar = h('div', { class: 'browser-warn' }, h('div', { class: 'wrap' },
    `⚠️ 這個瀏覽器不支援「${missing.map((m) => names[m]).join('、')}」。請改用電腦版 Chrome 或 Edge。`));
  $('.topbar').after(bar);
  return true;
}
