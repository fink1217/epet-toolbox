// 寵物設定面板：名字和介面文字。只把「跟預設不一樣」的寫進 寵物.json。
import { h, why, callout, toast } from '../core.js';
import { DEFAULT_TEXTS, FORMAT_VERSION } from '../data/vocab.js';
import { readJSON, writeJSON } from '../lib/fs.js';
import { PET_FILE } from '../lib/master.js';
import { stepCard } from './ui.js';
import { folder, refresh, requireFolder } from './folder.js';
import { artOnlyChanged } from '../svg/gen-art.js';

// 每個欄位的中文說明
const GROUPS = [
  { key: 'menu', title: '選單', labels: { feed: '餵食', play: '玩耍', sleep: '睡覺', status: '狀態', settings: '設定' } },
  { key: 'stat', title: '狀態頁', labels: { hunger: '飽足度', mood: '心情', energy: '體力', age: '年齡', days: '天數單位' } },
  { key: 'ui', title: '按鈕', labels: { yes: '確認', no: '取消', back: '返回', volume: '音量', brightness: '亮度' } },
  { key: 'lines', title: '寵物會說的話（一行一句）', labels: { hello: '打招呼', hungry: '肚子餓', happy: '開心', sleepy: '想睡', sick: '生病' }, list: true },
];

export function settingsPanel() {
  const nameIn = h('input', { type: 'text', maxlength: '8' });
  const inputs = {};
  const groups = GROUPS.map((g) => {
    inputs[g.key] = {};
    const fields = Object.entries(g.labels).map(([k, label]) => {
      const input = g.list ? h('textarea', { rows: '2' }) : h('input', { type: 'text', maxlength: '12' });
      inputs[g.key][k] = input;
      return h('div', { class: 'field' }, h('label', {}, label), input);
    });
    return h('fieldset', { class: 'text-group' }, h('legend', {}, g.title), h('div', { class: g.list ? 'grid-2' : 'grid-3' }, fields));
  });
  const glyphs = h('div', { class: 'small muted' });
  const saveBtn = h('button', { class: 'btn btn-primary btn-lg', onclick: save }, '存進 寵物.json');
  const resetBtn = h('button', { class: 'btn btn-ghost', onclick: () => fill(DEFAULT_TEXTS, DEFAULT_TEXTS.name) }, '全部改回預設');
  const need = h('div');

  const el = h('div', { class: 'gen-panel stack' },
    need,
    stepCard(1, '寵物叫什麼名字', h('div', { class: 'field narrow' }, h('label', {}, '名字（最多 8 個字）'), nameIn)),
    stepCard(2, '畫面上的文字', h('p', { class: 'small muted' }, '不想改的就不用動。'), ...groups, glyphs),
    h('div', { class: 'row' }, saveBtn, resetBtn),
    why([
      { art: artOnlyChanged(), title: '為什麼只存改過的？', text: '<p>寵物.json 只記你改過的字，其他的跟著預設走。</p><p>以後工具更新、預設文字變好了，你沒改過的地方會自動跟著更新。</p>' },
      { art: artOnlyChanged(), title: '用到的字越少越好', text: '<p>打包時，字型只會包含這裡用到的字。整套繁體中文字型要五六百 KB，只收用到的幾百個字，通常只要幾十 KB。</p>' },
    ], '這一頁在做什麼？'));

  const all = () => [nameIn, ...Object.values(inputs).flatMap((o) => Object.values(o))];
  all().forEach((i) => i.addEventListener('input', countGlyphs));

  function fill(texts, name) {
    nameIn.value = name;
    for (const g of GROUPS)
      for (const k of Object.keys(g.labels)) {
        const v = texts[g.key]?.[k] ?? DEFAULT_TEXTS[g.key][k];
        inputs[g.key][k].value = g.list ? (v || []).join('\n') : v;
      }
    countGlyphs();
  }

  // 讀表單 → 只留下跟預設不同的
  function diff() {
    const out = {};
    for (const g of GROUPS)
      for (const k of Object.keys(g.labels)) {
        const raw = inputs[g.key][k].value;
        const v = g.list ? raw.split('\n').map((s) => s.trim()).filter(Boolean) : raw.trim();
        const def = DEFAULT_TEXTS[g.key][k];
        const same = g.list ? JSON.stringify(v) === JSON.stringify(def) : v === def || v === '';
        if (!same) (out[g.key] ||= {})[k] = v;
      }
    return out;
  }

  function countGlyphs() {
    const set = new Set([...all().map((i) => i.value).join('')].filter((c) => c.trim()));
    glyphs.textContent = `目前一共用到 ${set.size} 個不同的字（打包時字型只收這些字，再加上數字和英文字母）。`;
  }

  async function save() {
    const root = await requireFolder();
    if (!root) { toast('這個瀏覽器不能直接存進資料夾', 'warn'); return; }
    saveBtn.disabled = true;
    try {
      const raw = (await readJSON(root, PET_FILE)) || { format: FORMAT_VERSION };
      raw.name = nameIn.value.trim() || DEFAULT_TEXTS.name;
      const d = diff();
      if (Object.keys(d).length) raw.texts = d; else delete raw.texts;
      await writeJSON(root, PET_FILE, raw);
      await refresh();
      toast('已存好寵物設定', 'ok');
    } catch (e) {
      if (e.name !== 'AbortError') toast(`存檔失敗：${e.message}`, 'warn');
    } finally {
      saveBtn.disabled = false;
    }
  }

  function load() {
    const pet = folder.master?.pet;
    need.replaceChildren(folder.root ? '' : callout('info', '先在上面選好素材資料夾，這裡才會讀出你之前存的設定。'));
    fill(pet ? pet.texts : DEFAULT_TEXTS, pet ? pet.name : DEFAULT_TEXTS.name);
  }
  load();

  return { el, select() {}, onFolderChange: load };
}
