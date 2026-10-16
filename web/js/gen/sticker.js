// 圖示／道具面板：放圖 → 去背 → 裁邊、置中放進 512×512 → 存檔。兩者只差詞彙表和資料夾。
import { h, why, callout, toast } from '../core.js';
import { ICONS, ITEMS, MASTER } from '../data/vocab.js';
import { DIRS } from '../lib/master.js';
import { makeCanvas, ctx2d, resize, toBlob } from '../lib/img.js';
import { loadSource, processImage } from './process.js';
import { dropzone, slider, toggle, vocabSelect, busyLayer, stepCard, saveFiles, removeVariants } from './ui.js';
import { refresh, requireFolder, has } from './folder.js';
import { promptCard } from './prompts.js';
import { artSolidBg, artMargin, artBigMaster } from '../svg/gen-art.js';

const KINDS = {
  icon: { vocab: ICONS, dir: DIRS.icon, zh: '圖示', size: MASTER.icon.w, hint: '選單上的小圖。線條粗、形狀簡單，縮小才看得清楚。' },
  item: { vocab: ITEMS, dir: DIRS.item, zh: '道具', size: MASTER.item.w, hint: '畫在寵物旁邊的東西：食物、玩具、便便。' },
};
const MARGIN = 0.06;
const defaultOpts = () => ({ tolerance: 30, global: false, wand: [], single: true });

// 去背結果 → 置中放進 size×size，四邊各留 6%
export function fitSquare(frame, size) {
  const room = size * (1 - MARGIN * 2);
  const k = Math.min(room / frame.w, room / frame.h);
  const w = Math.max(1, Math.round(frame.w * k)), h = Math.max(1, Math.round(frame.h * k));
  const sx = w / frame.w, sy = h / frame.h;
  const cx = (frame.core.x + frame.core.w / 2) * sx, cy = (frame.core.y + frame.core.h / 2) * sy;
  const out = makeCanvas(size, size);
  ctx2d(out).drawImage(resize(frame.canvas, w, h), Math.round(size / 2 - cx), Math.round(size / 2 - cy));
  return out;
}

export function stickerPanel(kind) {
  const K = KINDS[kind];
  const state = { src: null, result: null, opts: defaultOpts(), ver: 0, id: K.vocab[0].id, wand: false, fitted: null };

  const drop = dropzone({ title: `把${K.zh}的圖拖進來`, hint: '一張圖放一個東西。也可以 Ctrl+V 貼上。', onFiles: ([f]) => load(f) });

  const stageCanvas = h('canvas', { class: 'stage-canvas' });
  const stageInner = h('div', { class: 'stage-inner checker' }, stageCanvas);
  const stage = h('div', { class: 'stage' }, stageInner);
  const busy = busyLayer(stage);
  const tol = slider({ label: '容許度', min: 0, max: 100, value: 30, oninput: (v) => setOpt({ tolerance: v }, 250) });
  const glob = toggle({ label: '全部同色都去掉', onchange: (v) => setOpt({ global: v }) });
  const wandBtn = h('button', { class: 'btn', 'aria-pressed': 'false', onclick: () => setWand(!state.wand) }, '🪄 魔術棒');
  const undoBtn = h('button', { class: 'btn', onclick: () => { if (state.opts.wand.length) setOpt({ wand: state.opts.wand.slice(0, -1) }); } }, '↶ 還原一步');

  const out = h('canvas', { width: K.size, height: K.size, class: 'sticker-out' });
  const outWrap = h('div', { class: 'sticker-wrap checker' }, out);
  const idSel = vocabSelect(K.vocab, { value: state.id, onchange: (id) => { state.id = id; renderSave(); } });
  const overwrite = h('div', { class: 'small' });
  const saveBtn = h('button', { class: 'btn btn-primary btn-lg', onclick: save }, '存進素材資料夾');
  const saveMsg = h('span', { class: 'small muted' });

  const step2 = stepCard(2, '去背',
    h('div', { class: 'gen-two' },
      h('div', {}, stage),
      h('div', { class: 'stack' }, tol.el, glob.el, h('div', { class: 'row' }, wandBtn, undoBtn),
        callout('info', '有沒去乾淨的地方？開魔術棒點它一下。'))));
  const step3 = stepCard(3, `存成哪個${K.zh}`,
    h('div', { class: 'gen-two' },
      h('div', {}, outWrap, h('div', { class: 'small muted center' }, `${K.size}×${K.size}，四邊留一點空`)),
      h('div', { class: 'stack' }, h('div', { class: 'row' }, idSel), overwrite, h('div', { class: 'row' }, saveBtn, saveMsg))));

  const el = h('div', { class: 'gen-panel stack' },
    promptCard(kind, () => state.id),
    stepCard(1, `放${K.zh}圖`, h('p', { class: 'small muted' }, K.hint), drop),
    step2, step3,
    why([
      { art: artSolidBg(), title: '為什麼一樣要純色背景？', text: '<p>去背的原理跟角色一樣：從四邊把背景色塗掉。背景越單純，邊緣越乾淨。</p>' },
      { art: artMargin(), title: '為什麼四邊要留空？', text: '<p>圖示縮到 30 幾個像素時，貼邊的線條很容易被裁掉或糊在一起。</p><p>留 6% 的邊，縮小後看起來也比較不擠。</p>' },
      { art: artBigMaster(), title: `為什麼存成 ${K.size}×${K.size}？`, text: '<p>母檔畫大一點，換不同螢幕時都是從大圖縮小，永遠清楚。</p>' },
    ], '這一頁在做什麼？'));

  async function load(file) {
    try {
      const src = await loadSource(file);
      state.src = src;
      state.opts = defaultOpts();
      tol.value = 30; glob.checked = false; setWand(false);
      showLater();
      run();
    } catch {
      toast('這張圖打不開', 'warn');
    }
  }

  async function run() {
    const ver = ++state.ver;
    busy.show();
    try {
      const r = await processImage(state.src.data, state.opts);
      if (ver !== state.ver) return;
      state.result = r;
      state.fitted = r.frames.length ? fitSquare(r.frames[0], K.size) : null;
    } catch (e) {
      toast(`處理失敗：${e.message}`, 'warn');
    }
    busy.hide();
    render();
  }

  let timer = 0;
  function setOpt(patch, delay = 0) {
    if (!state.src) return;
    Object.assign(state.opts, patch);
    clearTimeout(timer);
    timer = setTimeout(run, delay);
  }
  function setWand(on) {
    state.wand = on;
    wandBtn.setAttribute('aria-pressed', String(on));
    stageInner.classList.toggle('wand', on);
  }
  stageCanvas.addEventListener('click', (e) => {
    if (!state.wand || !state.result) return;
    const r = stageCanvas.getBoundingClientRect();
    setOpt({ wand: [...state.opts.wand, {
      x: ((e.clientX - r.left) * stageCanvas.width) / r.width,
      y: ((e.clientY - r.top) * stageCanvas.height) / r.height,
    }] });
  });

  function render() {
    const img = state.result?.image || state.src?.canvas;
    if (img) {
      stageCanvas.width = img.width;
      stageCanvas.height = img.height;
      stageCanvas.getContext('2d').drawImage(img, 0, 0);
    }
    const g = out.getContext('2d');
    g.clearRect(0, 0, K.size, K.size);
    if (state.fitted) g.drawImage(state.fitted, 0, 0);
    renderSave();
  }

  function renderSave() {
    const v = K.vocab.find((x) => x.id === state.id);
    overwrite.replaceChildren(has(kind, v.id) ? h('span', { class: 'warn-text' }, `素材資料夾裡已經有「${v.zh}」，存檔會覆蓋。`) : '');
    saveBtn.textContent = `存成「${v.zh}」`;
    saveBtn.disabled = !state.fitted;
  }

  async function save() {
    if (!state.fitted) return;
    const v = K.vocab.find((x) => x.id === state.id);
    saveBtn.disabled = true;
    try {
      const root = await requireFolder();
      if (root && has(kind, v.id) && !confirm(`「${v.zh}」已經有了，要覆蓋嗎？`)) return;
      const blob = await toBlob(state.fitted);
      await removeVariants(root, K.dir, v.zh, 'png');
      await saveFiles([{ path: `${K.dir}/${v.zh}.png`, blob }]);
      if (root) { await refresh(); toast(`已存成${K.zh}「${v.zh}」`, 'ok'); }
      saveMsg.textContent = `✓ 存好了：${K.dir}/${v.zh}.png`;
    } catch (e) {
      if (e.name !== 'AbortError') toast(`存檔失敗：${e.message}`, 'warn');
    } finally {
      saveBtn.disabled = !state.fitted;
    }
  }

  function showLater() {
    step2.classList.toggle('hidden', !state.src);
    step3.classList.toggle('hidden', !state.src);
  }
  showLater();
  renderSave();

  return {
    el,
    select(id) { if (K.vocab.some((v) => v.id === id)) { state.id = id; idSel.value = id; renderSave(); } drop.claimPaste(); },
    onFolderChange: renderSave,
    claimPaste: () => drop.claimPaste(),
  };
}
