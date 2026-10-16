// 背景面板：放圖 → 拖曳選要保留的 9:16 範圍（疊上各螢幕安全框）→ 存成 1080×1920。
import { h, why, callout, toast } from '../core.js';
import { BACKGROUNDS, MASTER, SCREENS } from '../data/vocab.js';
import { DIRS } from '../lib/master.js';
import { loadBitmap, toCanvas, coverRect, cover, toBlob } from '../lib/img.js';
import { dropzone, vocabSelect, stepCard, saveFiles, busyLayer, removeVariants } from './ui.js';
import { refresh, requireFolder, has } from './folder.js';
import { promptCard } from './prompts.js';
import { artSafeArea, artBigMaster } from '../svg/gen-art.js';

const BW = MASTER.background.w;   // 1080
const BH = MASTER.background.h;   // 1920
const VIEW = 640;                 // 預覽畫布長邊
const COLORS = ['#FFB020', '#11807A', '#8E4EC6', '#D93F3F'];

export function backgroundPanel() {
  const state = { src: null, name: '', fx: 0.5, fy: 0.5, id: 'day' };

  const drop = dropzone({
    title: '把背景圖拖進來',
    hint: '直式 9:16 最好；橫的或方的也可以，下一步再選要保留哪一段。',
    onFiles: ([f]) => load(f),
  });

  const view = h('canvas', { class: 'bg-view' });
  const viewWrap = h('div', { class: 'bg-view-wrap' }, view);
  const busy = busyLayer(viewWrap);
  const previews = h('div', { class: 'screen-previews' });
  const idSel = vocabSelect(BACKGROUNDS, { value: state.id, onchange: (id) => { state.id = id; renderSave(); } });
  const overwrite = h('div', { class: 'small' });
  const saveBtn = h('button', { class: 'btn btn-primary btn-lg', onclick: save }, '存進素材資料夾');
  const saveMsg = h('span', { class: 'small muted' });

  const step2 = stepCard(2, '拖曳，選要保留的範圍',
    h('div', { class: 'gen-two' },
      h('div', {}, viewWrap),
      h('div', { class: 'stack' },
        callout('info', '亮框是存下來的範圍（9:16）。裡面的虛線框是各種螢幕<b>實際看得到</b>的地方，重要的東西放在最小的框裡。'),
        h('div', { class: 'small muted' }, '各螢幕看起來會像這樣：'),
        previews)));
  const step3 = stepCard(3, '存成哪個背景',
    h('div', { class: 'stack' },
      h('div', { class: 'row' }, idSel),
      overwrite,
      h('div', { class: 'row' }, saveBtn, saveMsg)));

  const el = h('div', { class: 'gen-panel stack' },
    promptCard('background', () => state.id),
    stepCard(1, '放背景圖', drop),
    step2, step3,
    why([
      { art: artSafeArea(), title: '為什麼重要的東西要放中間？', text: '<p>螢幕的長寬比例不一樣：1.47 吋很細長，以後的大螢幕可能比較方。</p><p>打包時會從正中間裁切，所以邊緣的東西可能看不到，正中間的大家都看得到。</p>' },
      { art: artBigMaster(), title: '為什麼存成 1080×1920 這麼大？', text: '<p>大圖縮小很清楚，小圖放大會糊。</p><p>現在的螢幕只有 172×320，但以後換大螢幕時，同一張母檔重新打包就好，不用重畫。</p>' },
    ], '這一頁在做什麼？'));

  async function load(file) {
    busy.show('讀取中…');
    try {
      state.src = toCanvas(await loadBitmap(file));
      state.name = file.name || '貼上的圖片';
      state.fx = 0.5;
      state.fy = 0.5;
      showLater();
      render();
    } catch {
      toast('這張圖打不開', 'warn');
    } finally {
      busy.hide();
    }
  }

  // 目前保留的範圍（原圖座標）
  const crop = () => {
    const r = coverRect(state.src.width, state.src.height, BW, BH, state.fx, state.fy);
    return { x: r.sx, y: r.sy, w: r.sw, h: r.sh };
  };

  // 某種螢幕在原圖上看得到的範圍（打包器從 1080×1920 正中間裁）
  function screenRect(c, s) {
    const r = coverRect(BW, BH, s.w, s.h, 0.5, 0.5);
    const kx = c.w / BW, ky = c.h / BH;
    return { x: c.x + r.sx * kx, y: c.y + r.sy * ky, w: r.sw * kx, h: r.sh * ky };
  }

  function render() {
    const src = state.src;
    if (!src) return;
    const k = VIEW / Math.max(src.width, src.height);
    view.width = Math.round(src.width * k);
    view.height = Math.round(src.height * k);
    const g = view.getContext('2d');
    g.drawImage(src, 0, 0, view.width, view.height);
    const c = crop();
    // 範圍外變暗
    g.fillStyle = 'rgba(30,31,34,.55)';
    g.beginPath();
    g.rect(0, 0, view.width, view.height);
    g.rect(c.x * k, c.y * k, c.w * k, c.h * k);
    g.fill('evenodd');
    g.lineWidth = 3;
    g.strokeStyle = '#fff';
    g.strokeRect(c.x * k, c.y * k, c.w * k, c.h * k);
    // 各螢幕看得到的範圍（顏色對照右邊的小預覽）
    g.lineWidth = 2;
    g.setLineDash([7, 5]);
    SCREENS.forEach((s, i) => {
      const r = screenRect(c, s);
      g.strokeStyle = COLORS[i % COLORS.length];
      g.strokeRect(r.x * k + 1, r.y * k + 1, r.w * k - 2, r.h * k - 2);
    });
    g.setLineDash([]);
    renderPreviews(c);
    renderSave();
  }

  function renderPreviews(c) {
    previews.replaceChildren(...SCREENS.map((s, i) => {
      const H = 120, W = Math.round((H * s.w) / s.h);
      const cv = h('canvas', { width: W * 2, height: H * 2, style: `width:${W}px;height:${H}px` });
      const r = screenRect(c, s);
      const g = cv.getContext('2d');
      g.imageSmoothingQuality = 'high';
      g.drawImage(state.src, r.x, r.y, r.w, r.h, 0, 0, cv.width, cv.height);
      return h('figure', { class: 'screen-prev' }, cv,
        h('figcaption', {}, h('span', { class: 'dot', style: `background:${COLORS[i % COLORS.length]}` }), `${s.w}×${s.h}`));
    }));
  }

  // 拖曳移動保留範圍
  let drag = null;
  view.addEventListener('pointerdown', (e) => {
    if (!state.src) return;
    view.setPointerCapture(e.pointerId);
    drag = { x: e.clientX, y: e.clientY, c: crop() };
  });
  view.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const r = view.getBoundingClientRect();
    const k = state.src.width / r.width;      // 螢幕像素 → 原圖像素
    const nx = drag.c.x + (e.clientX - drag.x) * k;
    const ny = drag.c.y + (e.clientY - drag.y) * k;
    const freeX = state.src.width - drag.c.w, freeY = state.src.height - drag.c.h;
    state.fx = freeX > 0.5 ? Math.min(1, Math.max(0, nx / freeX)) : 0.5;
    state.fy = freeY > 0.5 ? Math.min(1, Math.max(0, ny / freeY)) : 0.5;
    render();
  });
  const end = () => { drag = null; };
  view.addEventListener('pointerup', end);
  view.addEventListener('pointercancel', end);

  function renderSave() {
    const b = BACKGROUNDS.find((x) => x.id === state.id);
    overwrite.replaceChildren(has('background', b.id) ? h('span', { class: 'warn-text' }, `素材資料夾裡已經有「${b.zh}」，存檔會覆蓋。`) : '');
    saveBtn.textContent = `存成「${b.zh}」`;
  }

  async function save() {
    if (!state.src) return;
    const b = BACKGROUNDS.find((x) => x.id === state.id);
    saveBtn.disabled = true;
    try {
      const root = await requireFolder();
      if (root && has('background', b.id) && !confirm(`「${b.zh}」已經有了，要覆蓋嗎？`)) return;
      saveMsg.textContent = '輸出 1080×1920…';
      const blob = await toBlob(cover(state.src, BW, BH, state.fx, state.fy));
      await removeVariants(root, DIRS.background, b.zh, 'png');
      await saveFiles([{ path: `${DIRS.background}/${b.zh}.png`, blob }]);
      if (root) { await refresh(); toast(`已存成背景「${b.zh}」`, 'ok'); }
      saveMsg.textContent = `✓ 存好了：${b.zh}.png（1080×1920）`;
    } catch (e) {
      if (e.name !== 'AbortError') toast(`存檔失敗：${e.message}`, 'warn');
      saveMsg.textContent = '';
    } finally {
      saveBtn.disabled = false;
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
    select(id) { if (BACKGROUNDS.some((b) => b.id === id)) { state.id = id; idSel.value = id; renderSave(); } drop.claimPaste(); },
    onFolderChange: renderSave,
    claimPaste: () => drop.claimPaste(),
  };
}
