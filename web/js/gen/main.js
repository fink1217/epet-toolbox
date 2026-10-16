// ② 素材生成器：頁面組裝。上面是素材資料夾與清單，下面一次只顯示一種素材的工作區。
import { mountShell, h, store, support, warnIfUnsupported, callout, toast, svgEl } from '../core.js';
import { ANIMS, BACKGROUNDS, ICONS, ITEMS, SOUNDS } from '../data/vocab.js';
import { mascot } from '../svg/mascot.js';
import { folder, onFolder, initFolder, connect, resume, refresh } from './folder.js';
import { characterPanel } from './character.js';
import { backgroundPanel } from './background.js';
import { stickerPanel } from './sticker.js';
import { soundPanel } from './sound.js';
import { settingsPanel } from './settings.js';

mountShell('assets');
warnIfUnsupported(['fs']);

const TABS = [
  { id: 'character', label: '角色動作', make: characterPanel },
  { id: 'background', label: '背景', make: backgroundPanel },
  { id: 'icon', label: '圖示', make: () => stickerPanel('icon') },
  { id: 'item', label: '道具', make: () => stickerPanel('item') },
  { id: 'sound', label: '音效', make: soundPanel },
  { id: 'settings', label: '名字與文字', make: settingsPanel },
];

// 清單：每一類素材要做哪些
const CATS = [
  { tab: 'character', kind: 'anims', title: '角色動作', list: ANIMS },
  { tab: 'background', kind: 'backgrounds', title: '背景', list: BACKGROUNDS },
  { tab: 'icon', kind: 'icons', title: '圖示', list: ICONS },
  { tab: 'item', kind: 'items', title: '道具', list: ITEMS },
  { tab: 'sound', kind: 'sounds', title: '音效', list: SOUNDS },
];

const main = document.querySelector('main');

// ── 頁首 ──
main.append(h('div', { class: 'page-head gen-head' },
  h('div', {},
    h('h1', {}, '② 素材生成器'),
    h('p', {}, '把 AI 畫的圖、下載的音效丟進來，自動去背、切格、對齊、轉檔，整理進你的素材資料夾。')),
  h('div', { class: 'say' }, svgEl(mascot({ mood: 'cheer' })),
    h('div', { class: 'bubble' }, '必要的只有兩樣：', h('b', {}, '待機動作'), '和', h('b', {}, '白天背景'), '。'))));

// ── 素材資料夾卡片 ──
const folderCard = h('section', { class: 'card folder-card' });
main.append(folderCard);

function renderFolder() {
  const parts = [];
  if (!support.fs) {
    parts.push(callout('warn', '這個瀏覽器不能直接存進資料夾，存檔會改成<b>下載</b>，請自己把檔案放進素材資料夾。'));
  } else if (folder.root) {
    parts.push(h('div', { class: 'row' },
      h('span', { class: 'folder-name' }, '📁 ', folder.root.name),
      h('span', { class: 'grow' }),
      h('button', { class: 'btn btn-ghost', onclick: () => run(refresh) }, '↻ 重新讀取'),
      h('button', { class: 'btn', onclick: () => run(connect) }, '換一個資料夾')));
  } else if (folder.saved) {
    parts.push(h('div', { class: 'row' },
      h('span', {}, '上次用的是 ', h('b', {}, `📁 ${folder.saved.name}`)),
      h('span', { class: 'grow' }),
      h('button', { class: 'btn btn-primary', onclick: () => run(resume) }, '繼續使用'),
      h('button', { class: 'btn', onclick: () => run(connect) }, '換一個')));
  } else {
    parts.push(h('div', { class: 'row' },
      h('div', { class: 'grow' },
        h('div', { class: 'folder-name' }, '先選一個素材資料夾'),
        h('div', { class: 'small muted' }, '建議在「文件」裡新增一個空資料夾，例如「我的電子雞」。之後所有素材都存在這裡。')),
      h('button', { class: 'btn btn-primary btn-lg', onclick: () => run(connect) }, '選擇／建立資料夾')));
  }
  parts.push(checklist());
  folderCard.replaceChildren(...parts);
}

function checklist() {
  const m = folder.master;
  let done = 0, total = 0;
  const rows = CATS.map((c) => {
    const have = new Set((m?.[c.kind] || []).map((x) => x.id));
    const chips = c.list.map((v) => {
      total++;
      const ok = have.has(v.id);
      if (ok) done++;
      const cls = ok ? 'ok' : v.required ? 'warn' : '';
      return h('button', { class: `chip ck-chip ${cls}`, onclick: () => goto(c.tab, v.id), title: v.hint || '' },
        ok ? `✓ ${v.zh}` : v.required ? `${v.zh}（必要）` : v.zh);
    });
    return h('div', { class: 'ck-row' }, h('span', { class: 'ck-title' }, c.title), h('div', { class: 'ck-chips' }, chips));
  });
  const head = m
    ? h('div', { class: 'ck-head' },
        h('b', {}, `已完成 ${done} / ${total}`),
        m.missing.length ? h('span', { class: 'chip warn' }, `還缺必要的：${m.missing.join('、')}`) : h('span', { class: 'chip ok' }, '必要的都有了，可以去打包'))
    : h('div', { class: 'ck-head small muted' }, '素材清單（選好資料夾後會顯示哪些做好了）');
  const warn = m?.warnings.length
    ? h('details', { class: 'ck-warn small' }, h('summary', {}, `有 ${m.warnings.length} 個檔案名稱認不得`), h('ul', {}, m.warnings.map((w) => h('li', {}, w))))
    : '';
  return h('div', { class: 'checklist' }, head, ...rows, warn);
}

async function run(fn) {
  try { await fn(); } catch (e) { if (e.name !== 'AbortError') toast(`沒辦法開啟資料夾：${e.message}`, 'warn'); }
}

// ── 分頁 ──
const tabBar = h('div', { class: 'tabs gen-tabs', role: 'tablist' });
const panelHost = h('div', { class: 'gen-panels' });
main.append(h('div', { class: 'gen-tabbar' }, tabBar), panelHost);

const panels = {};
for (const t of TABS) {
  const p = t.make();
  p.el.classList.add('hidden');
  panelHost.append(p.el);
  panels[t.id] = p;
}
function show(id) {
  if (!panels[id]) id = 'character';
  store.set('epet.gen.tab', id);
  tabBar.replaceChildren(...TABS.map((t) =>
    h('button', { role: 'tab', 'aria-selected': String(t.id === id), onclick: () => show(t.id) }, t.label)));
  for (const t of TABS) panels[t.id].el.classList.toggle('hidden', t.id !== id);
  panels[id].claimPaste?.();
}
function goto(tab, id) {
  show(tab);
  panels[tab].select?.(id);
  tabBar.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

show(new URLSearchParams(location.search).get('tab') || store.get('epet.gen.tab', 'character'));

onFolder(() => {
  renderFolder();
  for (const p of Object.values(panels)) p.onFolderChange?.();
});
initFolder();
