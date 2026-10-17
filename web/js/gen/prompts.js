// AI 提示詞小抄：每個面板放一張，照著複製去 AI 繪圖工具用。
import { h, store, callout } from '../core.js';
import { ANIMS, BACKGROUNDS, ICONS, ITEMS } from '../data/vocab.js';
import { copyButton } from './ui.js';

const DESC_KEY = 'epet.gen.desc';
const LANG_KEY = 'epet.gen.lang';
const DEFAULT_DESC = { zh: '一隻圓滾滾的白色小貓，大眼睛', en: 'a round little white cat with big eyes' };

const BG_COLOR = { zh: '純亮綠色（#00FF00）', en: 'solid bright green (#00FF00)' };

// 每種素材的模板：{ zh, en } 兩種語言；subject 是下拉選單選到的項目
const TEMPLATES = {
  character: {
    pick: ANIMS,
    zh: (d, s) => `請畫「${d}」的「${s.zh}」動畫分鏡（${s.hint}）。共 4 格，由左到右排成一列，每格之間留明顯空白、不要重疊、不要畫格線。同一個角色、同樣大小、同樣畫風，全身入鏡，四格的腳底在同一條水平線上。背景是${BG_COLOR.zh}，不要漸層、不要陰影、不要地板、不要文字。角色身上不要用綠色。高解析插畫風。`,
    en: (d, s) => `A 4-frame animation sheet of ${d}, action: "${s.zh}" (${s.hint}). Four poses in one horizontal row, clear empty space between them, no overlap, no grid lines. Same character, same size, same art style, full body, all feet on the same horizontal line. Background: ${BG_COLOR.en}, no gradient, no shadow, no floor, no text. Do not use green on the character. High-resolution illustration.`,
  },
  background: {
    pick: BACKGROUNDS,
    zh: (d, s) => `請畫電子寵物遊戲的「${s.zh}」場景背景，直式 9:16。重要的東西放在畫面正中間，上下左右邊緣可能會被裁掉。不要畫角色、不要文字。高解析插畫風，跟「${d}」的畫風一致。`,
    en: (d, s) => `A vertical 9:16 background scene for a virtual pet, time of day: "${s.zh}". Keep important things in the center; edges may be cropped. No characters, no text. High-resolution illustration matching the style of ${d}.`,
  },
  icon: {
    pick: ICONS,
    zh: (d, s) => `請畫一個代表「${s.zh}」的選單圖示：簡單、粗線條、在很小的尺寸也看得清楚，置中。背景是${BG_COLOR.zh}，不要陰影、不要文字。畫風跟「${d}」一致。`,
    en: (d, s) => `A simple menu icon meaning "${s.zh}". Bold shapes, readable at tiny sizes, centered. Background: ${BG_COLOR.en}, no shadow, no text. Style matching ${d}.`,
  },
  item: {
    pick: ITEMS,
    zh: (d, s) => `請畫電子寵物遊戲會用到的「${s.zh}」道具，單獨一個、置中。背景是${BG_COLOR.zh}，不要陰影、不要地板、不要文字，道具本身不要用綠色。畫風跟「${d}」一致。`,
    en: (d, s) => `A single "${s.zh}" item for a virtual pet game, centered. Background: ${BG_COLOR.en}, no shadow, no floor, no text, no green on the item. Style matching ${d}.`,
  },
};

// kind：character | background | icon | item；getSubject() 回傳目前選的詞彙 id（跟面板同步）
export function promptCard(kind, getSubject) {
  const t = TEMPLATES[kind];
  let lang = store.get(LANG_KEY, 'zh');
  const desc = h('input', { type: 'text', value: store.get(DESC_KEY, DEFAULT_DESC.zh) });
  const pick = h('select', {}, t.pick.map((v) => h('option', { value: v.id }, v.zh)));
  const text = h('div', { class: 'prompt-text' });
  const langBtn = h('button', { class: 'btn btn-ghost small' });

  const subject = () => t.pick.find((v) => v.id === pick.value) || t.pick[0];
  const paint = () => {
    text.textContent = t[lang](desc.value.trim() || DEFAULT_DESC[lang], subject());
    langBtn.textContent = lang === 'zh' ? 'English' : '中文';
  };
  desc.addEventListener('input', () => { store.set(DESC_KEY, desc.value); paint(); });
  pick.addEventListener('change', paint);
  langBtn.addEventListener('click', () => { lang = lang === 'zh' ? 'en' : 'zh'; store.set(LANG_KEY, lang); paint(); });

  const el = h('details', { class: 'prompt-card' },
    h('summary', {}, '📋 AI 提示詞小抄'),
    h('div', { class: 'stack' },
      h('div', { class: 'field' }, h('label', {}, '你的角色長什麼樣子'), desc),
      h('div', { class: 'row' }, h('span', { class: 'small muted' }, '要畫：'), pick, h('span', { class: 'grow' }), langBtn),
      text,
      h('div', { class: 'row' }, copyButton(() => text.textContent, '複製提示詞')),
      callout('tip', '背景選<b>角色身上沒有的顏色</b>。角色是綠色的話，把提示詞裡的綠色改成洋紅 <code>#FF00FF</code>。'),
      callout('warn', '不要叫 AI 畫「透明背景」：很多 AI 會把灰白棋盤格直接<b>畫進圖裡</b>，反而去不掉。'),
    ));
  el.addEventListener('toggle', () => {
    if (el.open && getSubject) { const id = getSubject(); if (t.pick.some((v) => v.id === id)) pick.value = id; }
    paint();
  });
  paint();
  return el;
}
