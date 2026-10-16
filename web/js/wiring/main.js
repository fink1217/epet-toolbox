// 接線教學頁：一畫面一步，進度依版本分開存。
import { mountShell, requireVersion, onVersionChange, getVersion, h, svgEl, why, callout, store, toast, $, loupe, refreshLoupe } from '../core.js';
import { makeContext, connRows, GROUP_ZH, tipFor } from './steps.js';

mountShell('wiring');

const stage = $('#stage');
const listEl = $('#step-list');
const countEl = $('#step-count');
const barEl = $('#step-bar');

let ctx = null;
let state = null;     // { done: [id], current: id }

const keyOf = (v) => `epet.wiring.${v.id}`;
const save = () => store.set(keyOf(ctx.version), state);

function load(version) {
  ctx = makeContext(version);
  const ids = ctx.order;
  const saved = store.get(keyOf(version), {}) || {};
  const fromUrl = new URLSearchParams(location.search).get('step');
  state = {
    done: (saved.done || []).filter((id) => ids.includes(id)),
    current: [fromUrl, saved.current].find((id) => id && ids.includes(id)) || ids[0],
  };
}

const stepIndex = () => ctx.order.indexOf(state.current);
const currentStep = () => ctx.steps[stepIndex()];

function go(id) {
  state.current = id;
  const s = currentStep();
  ctx.side = s.side || 'front';
  save();
  render();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function artNode(s) {
  const a = s.art(ctx);
  return typeof a === 'string' ? svgEl(a) : a;
}

function zoom(node) {
  const dlg = h('dialog', { class: 'zoom' },
    h('button', { class: 'btn btn-dark zoom-close', onclick: () => { dlg.close(); dlg.remove(); } }, '關閉 ✕'),
    node.cloneNode(true));
  dlg.addEventListener('click', (e) => { if (e.target === dlg) { dlg.close(); dlg.remove(); } });
  document.body.append(dlg);
  dlg.showModal();
}

function figure(s) {
  const fig = h('div', { class: 'figure step-figure' });
  const paint = () => {
    const node = artNode(s);
    fig.replaceChildren(node, tools(node));
  };
  const tools = (node) => {
    const bar = h('div', { class: 'figure-tools' });
    if (s.sides) {
      const tab = (side, label) => h('button', {
        class: 'side-btn', 'aria-pressed': String(ctx.side === side),
        onclick: () => { ctx.side = side; paint(); },
      }, label);
      const [frontLabel, backLabel] = s.sideLabels || ['正面・插零件', '背面・焊錫'];
      bar.append(h('div', { class: 'side-tabs' }, tab('front', frontLabel), tab('back', backLabel)));
    }
    if (node instanceof SVGElement) bar.append(h('button', { class: 'side-btn', onclick: () => zoom(node) }, '⤢ 放大'));
    return bar;
  };
  paint();
  return fig;
}

function connTable(s) {
  const rows = connRows(s.id, ctx);
  if (!rows.length) return null;
  return h('div', { class: 'conn' }, rows.map((r) =>
    h('div', { class: 'conn-row' },
      h('span', { class: 'conn-dot', style: `background:${r.color}` }),
      h('span', { class: 'conn-from' }, r.from),
      h('span', { class: 'conn-arrow' }, '→'),
      h('span', { class: 'conn-to' }, r.to))));
}

// 步驟欄位可以是值，也可以是依配置計算的函式
const val = (v) => (typeof v === 'function' ? v(ctx) : v);

function render() {
  const s = currentStep();
  const i = stepIndex();
  const n = ctx.steps.length;
  const group = ctx.steps.filter((x) => x.group === s.group);
  const gi = group.indexOf(s) + 1;
  const done = state.done.includes(s.id);

  const todo = s.todo(ctx);
  const text = h('div', { class: 'step-text' },
    h('div', { class: 'kicker' }, `${GROUP_ZH[s.group]} ${gi}/${group.length}`),
    h('h2', {}, val(s.title), done ? h('span', { class: 'chip ok done-chip' }, '✓ 完成') : null),
    h('p', { class: 'lead' }, val(s.lead)),
    s.conn ? connTable(s) : null,
    todo.length ? h('ol', { class: 'todo' }, todo.map((t) => h('li', {}, h('span', { html: t })))) : null,
    h('div', { class: 'callouts' }, s.callouts(ctx).map(([k, t]) => callout(k, t))),
    val(s.why)?.length ? why(val(s.why)) : null,
    s.cta ? h('a', { class: 'btn btn-primary btn-lg cta', href: s.cta.href }, s.cta.label, ' →') : null,
    h('div', { class: 'step-nav' },
      h('button', { class: 'btn', disabled: i === 0, onclick: () => go(ctx.order[i - 1]) }, '← 上一步'),
      i < n - 1
        ? h('button', { class: 'btn btn-primary', onclick: () => complete(s.id) }, done ? '下一步 →' : '這步完成了，下一步 →')
        : h('button', { class: 'btn btn-primary', onclick: () => complete(s.id) }, done ? '已完成 ✓' : '全部完成 ✓')),
  );

  stage.replaceChildren(h('div', { class: s.wide ? 'step wide' : 'step' }, figure(s), text));

  // 進度
  countEl.textContent = `第 ${i + 1} / ${n} 步`;
  barEl.style.width = `${Math.round((state.done.length / n) * 100)}%`;
  listEl.replaceChildren(...ctx.steps.map((x, k) => h('button', {
    class: [x.id === s.id ? 'current' : '', state.done.includes(x.id) ? 'done' : ''].join(' ').trim(),
    onclick: () => go(x.id),
    title: val(x.title),
  }, `${k + 1}. ${val(x.title)}`)));

  const url = new URL(location.href);
  url.searchParams.set('step', s.id);
  history.replaceState(null, '', url);
}

function complete(id) {
  if (!state.done.includes(id)) state.done.push(id);
  const i = ctx.order.indexOf(id);
  if (i < ctx.order.length - 1) go(ctx.order[i + 1]);
  else { save(); render(); toast('全部完成！接下來去刷韌體 🎉', 'ok'); }
}

$('#reset').addEventListener('click', () => {
  if (!confirm('把這個版本的進度全部清掉，從第一步重新開始？')) return;
  state = { done: [], current: ctx.order[0] };
  go(state.current);
});

document.addEventListener('keydown', (e) => {
  if (e.target.closest('input, textarea, select, dialog')) return;
  const i = stepIndex();
  if (e.key === 'ArrowRight' && i < ctx.order.length - 1) go(ctx.order[i + 1]);
  if (e.key === 'ArrowLeft' && i > 0) go(ctx.order[i - 1]);
});

// 換版本：網址上的 v 參數會蓋過選擇，所以先拿掉
onVersionChange(() => {
  const url = new URL(location.href);
  if (url.searchParams.has('v')) { url.searchParams.delete('v'); history.replaceState(null, '', url); }
  const keep = state?.current;
  const v = getVersion();
  load(v);
  if (keep && ctx.order.includes(keep)) state.current = keep;
  ctx.side = currentStep().side || 'front';
  render();
});

// ── 滑鼠提示與互相指認 ──
// 圖 → 文字：滑鼠移到圖上的零件、落點、排針、孔，跳出小卡片說明它是什麼。
// 文字 → 圖：滑鼠移到文字裡的 R1、C4 這些代號，圖上對應的零件或孔會亮起來。
// 管路高光：指到某個孔、焊點、錫橋時，同一條管路（電氣上連在一起的）全部亮起來。
const TARGET = '[data-part],[data-pad],[data-pin],[data-hole],[data-net],[data-mod]';
let litNet = null;   // { svg, net }
function lightNet(svg, net) {
  if (litNet && litNet.svg === svg && litNet.net === net) return;
  document.querySelectorAll('.net-layer .on').forEach((n) => n.classList.remove('on'));
  litNet = null;
  if (svg && net) {
    svg.querySelectorAll(`.net-layer [data-net="${net}"]`).forEach((n) => n.classList.add('on'));
    litNet = { svg, net };
  }
  refreshLoupe();   // 放大鏡裡的畫面也要跟著亮
}
function netUnder(el) {
  const n = inFigure(el) ? el.closest('[data-net]') : null;
  return n ? [n.closest('svg'), n.dataset.net] : [null, null];
}
const tip = h('div', { class: 'hover-tip', role: 'tooltip', hidden: true });
document.body.append(tip);
let tipFrom = null;

function inFigure(el) {
  return el && el.closest('.step-figure, dialog.zoom');
}

function showTip(el, x, y) {
  if (el !== tipFrom) {
    const html = tipFor(el, ctx);
    if (!html) return hideTip();
    tip.innerHTML = html;
    tipFrom = el;
  }
  tip.hidden = false;
  const { width, height } = tip.getBoundingClientRect();
  let left;
  let top;
  if (loupe.visible) {
    // 放大鏡開著：卡片放在鏡片旁邊，不要蓋住放大的畫面
    const gap = loupe.radius + 14;
    left = x + gap + width > innerWidth - 8 ? x - gap - width : x + gap;
    top = Math.min(innerHeight - 8 - height, y - height / 2);
  } else {
    // 預設在游標右下方；碰到視窗邊緣就翻到另一邊
    left = x + 16 + width > innerWidth - 8 ? x - 16 - width : x + 16;
    top = y + 18 + height > innerHeight - 8 ? y - 18 - height : y + 18;
  }
  tip.style.left = `${Math.max(8, left)}px`;
  tip.style.top = `${Math.max(8, top)}px`;
}

function hideTip() {
  tip.hidden = true;
  tipFrom = null;
}

document.addEventListener('pointermove', (e) => {
  if (e.pointerType === 'touch') return;
  const el = e.target.closest?.(TARGET);
  if (inFigure(el)) showTip(el, e.clientX, e.clientY);
  else hideTip();
  if (!e.target.closest?.('.ref')) lightNet(...netUnder(el));
});
// 觸控螢幕沒有「移上去」：點一下顯示，點別的地方收起來
document.addEventListener('click', (e) => {
  const el = e.target.closest?.(TARGET);
  if (!inFigure(el)) {
    if (e.pointerType === 'touch' || !e.pointerType) { hideTip(); lightNet(null, null); }
    return;
  }
  const r = el.getBoundingClientRect();
  showTip(el, r.left + r.width / 2, r.top + r.height / 2);
  lightNet(...netUnder(el));
});
window.addEventListener('scroll', hideTip, { passive: true });

// 文字裡的代號 → 圖上亮起來
// 標記畫在目標所在圖層的最上面（同一個座標系，組合圖裡也對得準），零件或線蓋住也看得到
const SVG_NS = 'http://www.w3.org/2000/svg';
function mark(tag, attrs, layer) {
  const n = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  n.classList.add('hl-ring');
  layer.append(n);
}
function lightUp(ref) {
  for (const fig of document.querySelectorAll('.step-figure svg, dialog.zoom svg')) {
    if (ref.dataset.part) {
      for (const n of fig.querySelectorAll(`[data-part="${ref.dataset.part}"]`)) {
        n.classList.add('hl');
        const b = n.getBBox();
        const pad = 7;
        mark('rect', { x: b.x - pad, y: b.y - pad, width: b.width + pad * 2, height: b.height + pad * 2, rx: 12 },
          n.closest('g.hub') || fig);
      }
    } else if (ref.dataset.hole) {
      const hole = fig.querySelector(`[data-hole="${ref.dataset.hole}"] circle`);
      if (hole) mark('circle', { cx: hole.getAttribute('cx'), cy: hole.getAttribute('cy'), r: 15 }, hole.closest('g.hub') || fig);
    } else if (ref.dataset.net) {
      // 文字裡的「GND 地線」→ 整條管路亮起來
      fig.querySelectorAll(`.net-layer [data-net="${ref.dataset.net}"]`).forEach((n) => n.classList.add('on'));
    }
  }
}
function lightsOut() {
  document.querySelectorAll('.hl').forEach((n) => n.classList.remove('hl'));
  document.querySelectorAll('.hl-ring').forEach((n) => n.remove());
  document.querySelectorAll('.net-layer .on').forEach((n) => n.classList.remove('on'));
  litNet = null;
}
document.addEventListener('pointerover', (e) => {
  const ref = e.target.closest?.('.ref');
  if (ref) { lightsOut(); lightUp(ref); }
});
document.addEventListener('pointerout', (e) => {
  if (e.target.closest?.('.ref')) lightsOut();
});

const version = await requireVersion();
load(version);
// 網址可以指定先看哪一面（?side=back），方便老師直接分享某一步的背面
const urlSide = new URLSearchParams(location.search).get('side');
ctx.side = ['front', 'back'].includes(urlSide) && currentStep().sides ? urlSide : currentStep().side || 'front';
render();
