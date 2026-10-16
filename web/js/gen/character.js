// 角色動作面板：放圖 → 去背切格 → 對齊預覽 → 存成某個動作。
import { h, why, callout, toast } from '../core.js';
import { ANIMS } from '../data/vocab.js';
import { removeEntry } from '../lib/fs.js';
import { writePet, DIRS } from '../lib/master.js';
import { toBlob } from '../lib/img.js';
import { loadSource, processImage } from './process.js';
import { sharedScale, drawPreview, renderMaster, CANVAS, BASELINE } from './normalize.js';
import { dropzone, slider, toggle, vocabSelect, busyLayer, stepCard, saveFiles, pad3 } from './ui.js';
import { folder, refresh, requireFolder, has } from './folder.js';
import { promptCard } from './prompts.js';
import { artSolidBg, artPaintBucket, artWand, artSplit, artBaseline } from '../svg/gen-art.js';

const PREVIEW = 512;                 // 預覽畫布邊長
const K = PREVIEW / CANVAS;          // 預覽 / 母檔
const NUDGE = 4;                     // 方向鍵一次移動幾個母檔像素（按住 Shift ×4）

const defaultOpts = () => ({ tolerance: 30, global: false, wand: [], single: false });

export function characterPanel() {
  const state = {
    sources: [],          // { id, name, data, canvas, scaled, opts, result, ver }
    active: null,
    excluded: new Set(),  // 不要的格：key = 來源id:格序
    offsets: new Map(),   // 每格微調偏移（母檔像素）
    size: 1,
    fps: ANIMS[0].fps,
    onion: true,
    playing: true,
    sel: 0,
    animId: 'idle',
    wand: false,
  };
  let seq = 0;
  const anim = () => ANIMS.find((a) => a.id === state.animId);
  const active = () => state.sources.find((s) => s.id === state.active);
  const off = (key) => state.offsets.get(key) || { dx: 0, dy: 0 };

  // 目前要用的所有格（依來源順序，再依閱讀順序）
  function frames() {
    const out = [];
    for (const s of state.sources) {
      (s.result?.frames || []).forEach((f, i) => {
        const key = `${s.id}:${i}`;
        if (!state.excluded.has(key)) out.push({ key, f });
      });
    }
    return out;
  }

  // ── 步驟 1：放圖 ──
  const strip = h('div', { class: 'src-strip' });
  const drop = dropzone({
    multiple: true,
    title: '把 AI 畫的圖拖進來',
    hint: '也可以點一下選檔，或直接 Ctrl+V 貼上。可以一次放很多張，全部算同一個動作。',
    onFiles: addFiles,
  });

  // ── 步驟 2：去背與切格 ──
  const stageCanvas = h('canvas', { class: 'stage-canvas' });
  const boxes = h('div', { class: 'stage-boxes' });
  const stageInner = h('div', { class: 'stage-inner checker' }, stageCanvas, boxes);
  const stage = h('div', { class: 'stage' }, stageInner);
  const busy = busyLayer(stage);
  const info = h('div', { class: 'small muted stage-info' });

  const tol = slider({
    label: '容許度', min: 0, max: 100, value: 30,
    oninput: (v) => setOpt({ tolerance: v }, 250),
  });
  const glob = toggle({ label: '全部同色都去掉（處理被圍住的空隙）', onchange: (v) => setOpt({ global: v }) });
  const single = toggle({ label: '這張就是一格，不要切', onchange: (v) => setOpt({ single: v }) });
  const wandBtn = h('button', { class: 'btn', 'aria-pressed': 'false', onclick: () => setWand(!state.wand) }, '🪄 魔術棒');
  const undoBtn = h('button', { class: 'btn', onclick: undoWand }, '↶ 還原一步');
  const resetBtn = h('button', { class: 'btn btn-ghost', onclick: resetOpts }, '全部重設');

  // ── 步驟 3：對齊與預覽 ──
  const animCanvas = h('canvas', { width: PREVIEW, height: PREVIEW, class: 'anim-canvas', tabindex: '0', 'aria-label': '動畫預覽，可用方向鍵微調目前這格' });
  const animStage = h('div', { class: 'anim-stage checker' }, animCanvas);
  const frameStrip = h('div', { class: 'frame-strip' });
  const playBtn = h('button', { class: 'btn', onclick: () => setPlaying(!state.playing) });
  const fps = slider({ label: '每秒幾格', min: 1, max: 24, value: state.fps, format: (v) => `${v} 格`, oninput: (v) => { state.fps = v; } });
  const size = slider({
    label: '大小', min: 50, max: 150, value: 100, format: (v) => `${v}%`,
    oninput: (v) => { state.size = v / 100; draw(); },
  });
  const onion = toggle({ label: '洋蔥皮（暫停時疊上前一格）', checked: true, onchange: (v) => { state.onion = v; draw(); } });
  const selLabel = h('span', { class: 'small muted' });
  const pad = h('div', { class: 'nudge' },
    h('span'), h('button', { class: 'btn', onclick: () => nudge(0, -1), 'aria-label': '往上' }, '↑'), h('span'),
    h('button', { class: 'btn', onclick: () => nudge(-1, 0), 'aria-label': '往左' }, '←'),
    h('button', { class: 'btn small', onclick: resetNudge, title: '這格回到原位' }, '歸位'),
    h('button', { class: 'btn', onclick: () => nudge(1, 0), 'aria-label': '往右' }, '→'),
    h('span'), h('button', { class: 'btn', onclick: () => nudge(0, 1), 'aria-label': '往下' }, '↓'), h('span'));

  // ── 步驟 4：存檔 ──
  const animSel = vocabSelect(ANIMS, { value: state.animId, onchange: (id) => pickAnim(id) });
  const animHint = h('div', { class: 'small muted' });
  const overwrite = h('div', { class: 'small' });
  const saveBtn = h('button', { class: 'btn btn-primary btn-lg', onclick: save }, '存進素材資料夾');
  const saveMsg = h('span', { class: 'small muted' });

  const step2 = stepCard(2, '去背、切成一格一格',
    h('div', { class: 'gen-two' },
      h('div', {}, stage, info),
      h('div', { class: 'stack' },
        tol.el,
        glob.el,
        single.el,
        h('div', { class: 'row' }, wandBtn, undoBtn, resetBtn),
        callout('info', '點框框可以<b>不要</b>那一格；開魔術棒時，點哪裡就去掉哪一塊。'))));
  const step3 = stepCard(3, '對齊、看動畫',
    h('div', { class: 'gen-two' },
      h('div', {}, animStage, frameStrip),
      h('div', { class: 'stack' },
        h('div', { class: 'row' }, playBtn, selLabel),
        fps.el, size.el, onion.el,
        h('div', { class: 'small' }, '有一格歪了？暫停、點下面那一格，再用方向鍵推一推：'),
        pad)));
  const step4 = stepCard(4, '存成哪個動作',
    h('div', { class: 'stack' },
      h('div', { class: 'row' }, animSel, animHint),
      overwrite,
      h('div', { class: 'row' }, saveBtn, saveMsg)));
  const later = [step2, step3, step4];

  const el = h('div', { class: 'gen-panel stack' },
    promptCard('character', () => state.animId),
    stepCard(1, '放圖片', drop, strip),
    ...later,
    why([
      { art: artSolidBg(), title: '為什麼要純色背景？', text: '<p>工具靠「顏色」分辨哪裡是背景。背景只有一種顏色、而且角色身上沒有，就能分得乾乾淨淨。</p><p>叫 AI 畫「透明背景」反而危險：很多 AI 會把灰白格子直接畫進圖裡。</p>' },
      { art: artPaintBucket(), title: '去背：從四邊倒油漆', text: '<p>從圖片四邊開始，把跟背景顏色差不多的地方塗成透明，碰到角色輪廓就停。</p><p>輪廓邊緣那一圈「一半背景一半角色」的像素，會變成半透明，並把混進去的綠色減掉，才不會有綠邊。</p>' },
      { art: artWand(), title: '被圍住的空隙怎麼辦？', text: '<p>手臂圍出來的小洞，油漆從外面流不進去。</p><p>開「魔術棒」點它一下，或勾「全部同色都去掉」。後者會連角色身上同色的地方一起去掉，角色有綠色時要小心。</p>' },
      { art: artSplit(), title: '一張圖怎麼切成好幾格？', text: '<p>去背後，連在一起的不透明區塊算一格；旁邊的小星星、汗滴會跟著離它最近的那一格。</p><p>順序跟看書一樣：先上後下、先左後右。</p>' },
      { art: artBaseline(), title: '為什麼每格要同一張畫布、同一條腳底線？', text: '<p>AI 每次畫的大小、位置都不一樣。直接播放，角色會忽大忽小、上下亂跳。</p><p>所以每格都用同一個縮放比例、腳底踩在同一條線（y = 984）、左右置中，存成 1024×1024。</p>' },
    ], '這一頁在做什麼？'),
  );

  // ── 動作 ──
  async function addFiles(files) {
    const added = [];
    for (const file of files) {
      try {
        const src = await loadSource(file);
        const s = { id: ++seq, ...src, opts: defaultOpts(), result: null, ver: 0 };
        state.sources.push(s);
        added.push(s);
      } catch {
        toast(`「${file.name}」打不開`, 'warn');
      }
    }
    if (!added.length) return;
    state.active = added[0].id;
    renderSources();
    showLater();
    for (const s of added) await run(s);
  }

  async function run(s) {
    const ver = ++s.ver;
    if (s.id === state.active) { busy.show(s.data.width * s.data.height > 4e6 ? '大圖處理中，請稍等…' : '處理中…'); renderStage(); }
    try {
      const result = await processImage(s.data, s.opts);
      if (ver !== s.ver) return;      // 處理期間設定又改了，丟掉舊結果
      s.result = result;
    } catch (e) {
      toast(`處理失敗：${e.message}`, 'warn');
    }
    if (s.id === state.active) busy.hide();
    renderSources();
    renderStage();
    renderFrames();
  }

  let timer = 0;
  function setOpt(patch, delay = 0) {
    const s = active();
    if (!s) return;
    Object.assign(s.opts, patch);
    clearTimeout(timer);
    timer = setTimeout(() => run(s), delay);
  }

  function setWand(on) {
    state.wand = on;
    wandBtn.setAttribute('aria-pressed', String(on));
    stageInner.classList.toggle('wand', on);
  }
  function undoWand() {
    const s = active();
    if (!s || !s.opts.wand.length) { toast('沒有可以還原的魔術棒'); return; }
    s.opts.wand = s.opts.wand.slice(0, -1);
    run(s);
  }
  function resetOpts() {
    const s = active();
    if (!s) return;
    s.opts = defaultOpts();
    tol.value = 30; glob.checked = false; single.checked = false;
    setWand(false);
    run(s);
  }

  function selectSource(id) {
    state.active = id;
    const s = active();
    tol.value = s.opts.tolerance; glob.checked = s.opts.global; single.checked = s.opts.single;
    renderSources();
    renderStage();
  }
  function removeSource(id) {
    state.sources = state.sources.filter((s) => s.id !== id);
    for (const k of [...state.excluded]) if (k.startsWith(`${id}:`)) state.excluded.delete(k);
    if (state.active === id) state.active = state.sources[0]?.id ?? null;
    if (state.active) selectSource(state.active); else renderSources();
    showLater();
    renderStage();
    renderFrames();
  }

  // 點去背預覽：魔術棒模式就加一個點，否則切換那一格要不要
  stageCanvas.addEventListener('click', (e) => {
    const s = active();
    if (!s?.result) return;
    const r = stageCanvas.getBoundingClientRect();
    const x = ((e.clientX - r.left) * stageCanvas.width) / r.width;
    const y = ((e.clientY - r.top) * stageCanvas.height) / r.height;
    if (state.wand) { setOpt({ wand: [...s.opts.wand, { x, y }] }); return; }
    const i = s.result.frames.findIndex((f) => x >= f.src.x0 && x <= f.src.x1 && y >= f.src.y0 && y <= f.src.y1);
    if (i >= 0) toggleFrame(`${s.id}:${i}`);
  });

  function toggleFrame(key) {
    if (state.excluded.has(key)) state.excluded.delete(key); else state.excluded.add(key);
    renderStage();
    renderFrames();
  }

  function setPlaying(on) {
    state.playing = on;
    playBtn.textContent = on ? '⏸ 暫停' : '▶ 播放';
    draw();
  }

  function nudge(dx, dy, big = false) {
    const list = frames();
    if (!list.length) return;
    setPlaying(false);
    const key = list[Math.min(state.sel, list.length - 1)].key;
    const o = off(key);
    const step = NUDGE * (big ? 4 : 1);
    state.offsets.set(key, { dx: o.dx + dx * step, dy: o.dy + dy * step });
    draw();
  }
  function resetNudge() {
    const list = frames();
    if (!list.length) return;
    state.offsets.delete(list[Math.min(state.sel, list.length - 1)].key);
    draw();
  }
  animCanvas.addEventListener('keydown', (e) => {
    const map = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    if (!map[e.key]) return;
    e.preventDefault();
    nudge(...map[e.key], e.shiftKey);
  });
  animCanvas.addEventListener('click', () => setPlaying(!state.playing));

  function pickAnim(id) {
    state.animId = id;
    animSel.value = id;
    const a = anim();
    state.fps = folder.master?.pet.anims[a.zh]?.fps || a.fps;
    fps.value = state.fps;
    renderSave();
  }

  async function save() {
    const list = frames();
    if (!list.length) { toast('還沒有可以存的格', 'warn'); return; }
    const a = anim();
    saveBtn.disabled = true;
    try {
      // 先拿資料夾：瀏覽器只在「剛點完按鈕」的幾秒內肯開選資料夾視窗
      const root = await requireFolder();
      if (root && has('anim', a.id) && !confirm(`「${a.zh}」已經有圖了，要覆蓋嗎？舊的圖會全部刪掉。`)) return;
      const scale = sharedScale(list.map((x) => x.f), state.size);
      const files = [];
      for (let i = 0; i < list.length; i++) {
        saveMsg.textContent = `準備第 ${i + 1} / ${list.length} 格…`;
        const c = renderMaster(list[i].f.canvas, list[i].f, scale, off(list[i].key));
        files.push({ path: `${DIRS.character}/${a.zh}/${pad3(i + 1)}.png`, blob: await toBlob(c) });
      }
      if (root) await removeEntry(root, `${DIRS.character}/${a.zh}`);
      await saveFiles(files, { onProgress: (i, n) => { saveMsg.textContent = `寫入 ${i} / ${n}…`; } });
      if (root) {
        await writePet(root, { anims: { [a.zh]: { fps: state.fps } } });
        await refresh();
        toast(`已存成「${a.zh}」，共 ${files.length} 格`, 'ok');
      }
      saveMsg.textContent = `✓ 存好了：${a.zh}（${files.length} 格，每秒 ${state.fps} 格）`;
    } catch (e) {
      if (e.name !== 'AbortError') toast(`存檔失敗：${e.message}`, 'warn');
      saveMsg.textContent = '';
    } finally {
      saveBtn.disabled = false;
    }
  }

  // ── 畫面 ──
  function showLater() {
    for (const s of later) s.classList.toggle('hidden', !state.sources.length);
  }

  function renderSources() {
    strip.replaceChildren(...state.sources.map((s) => {
      const thumb = h('canvas', { width: 96, height: 72 });
      const g = thumb.getContext('2d');
      const img = s.result?.image || s.canvas;
      const k = Math.min(96 / img.width, 72 / img.height);
      g.drawImage(img, (96 - img.width * k) / 2, (72 - img.height * k) / 2, img.width * k, img.height * k);
      const n = s.result ? `${s.result.frames.length} 格` : '處理中…';
      return h('div', { class: `src-item${s.id === state.active ? ' on' : ''}` },
        h('button', { class: 'src-pick checker', onclick: () => selectSource(s.id), title: s.name }, thumb),
        h('span', { class: 'small muted' }, n),
        h('button', { class: 'src-x', onclick: () => removeSource(s.id), 'aria-label': '移除這張' }, '×'));
    }));
  }

  function renderStage() {
    const s = active();
    if (!s) { boxes.replaceChildren(); info.textContent = ''; return; }
    const img = s.result?.image || s.canvas;
    stageCanvas.width = img.width;
    stageCanvas.height = img.height;
    stageCanvas.getContext('2d').drawImage(img, 0, 0);
    if (!s.result) { boxes.replaceChildren(); info.textContent = '處理中…'; return; }
    let n = 0;
    for (const t of state.sources) { if (t.id === s.id) break; n += t.result?.frames.length || 0; }
    boxes.replaceChildren(...s.result.frames.map((f, i) => {
      const key = `${s.id}:${i}`;
      const pct = (v, total) => `${(v / total) * 100}%`;
      return h('div', {
        class: `fbox${state.excluded.has(key) ? ' off' : ''}`,
        style: `left:${pct(f.src.x0, img.width)};top:${pct(f.src.y0, img.height)};width:${pct(f.src.x1 - f.src.x0 + 1, img.width)};height:${pct(f.src.y1 - f.src.y0 + 1, img.height)}`,
      }, h('span', {}, n + i + 1));
    }));
    const bg = s.result.bg;
    const hex = bg ? '#' + bg.map((c) => Math.round(c).toString(16).padStart(2, '0')).join('').toUpperCase() : '';
    info.replaceChildren(
      s.result.transparentBg
        ? h('span', {}, '這張本來就是透明背景，直接切格')
        : h('span', {}, '背景色 ', h('span', { class: 'swatch', style: `background:${hex}` }), ` ${hex}`),
      ` · 找到 ${s.result.frames.length} 格 · ${s.result.ms} ms`,
      s.scaled ? ' · 原圖太大，已先縮到 3000 px' : '',
      s.result.frames.length ? '' : h('b', { class: 'warn-text' }, ' · 沒找到角色，試著把容許度調低'),
    );
  }

  function renderFrames() {
    const list = frames();
    if (state.sel >= list.length) state.sel = Math.max(0, list.length - 1);
    frameStrip.replaceChildren(...list.map((x, i) => {
      const c = h('canvas', { width: 64, height: 64 });
      const g = c.getContext('2d');
      const k = Math.min(56 / x.f.w, 56 / x.f.h);
      g.drawImage(x.f.canvas, (64 - x.f.w * k) / 2, (64 - x.f.h * k) / 2, x.f.w * k, x.f.h * k);
      return h('button', {
        class: `frame-item checker${i === state.sel ? ' on' : ''}`,
        onclick: () => { state.sel = i; setPlaying(false); renderFrames(); animCanvas.focus(); },
        title: `第 ${i + 1} 格`,
      }, c, h('span', {}, i + 1));
    }));
    renderSave();
    draw();
  }

  function renderSave() {
    const a = anim();
    animHint.textContent = a.hint;
    overwrite.replaceChildren(has('anim', a.id) ? h('span', { class: 'warn-text' }, `素材資料夾裡已經有「${a.zh}」，存檔會覆蓋。`) : '');
    const n = frames().length;
    saveBtn.textContent = n ? `存成「${a.zh}」（${n} 格）` : '存進素材資料夾';
  }

  // ── 動畫預覽 ──
  let tick = 0;
  let last = 0;
  function draw() {
    const g = animCanvas.getContext('2d');
    g.clearRect(0, 0, PREVIEW, PREVIEW);
    g.save();
    g.setLineDash([6, 6]);
    g.lineWidth = 1.5;
    g.strokeStyle = 'rgba(17,128,122,.55)';
    g.beginPath(); g.moveTo(0, BASELINE * K); g.lineTo(PREVIEW, BASELINE * K); g.stroke();
    g.strokeStyle = 'rgba(17,128,122,.2)';
    g.beginPath(); g.moveTo(PREVIEW / 2, 0); g.lineTo(PREVIEW / 2, PREVIEW); g.stroke();
    g.restore();
    const list = frames();
    playBtn.textContent = state.playing ? '⏸ 暫停' : '▶ 播放';
    if (!list.length) { selLabel.textContent = ''; return; }
    const scale = sharedScale(list.map((x) => x.f), state.size);
    const i = state.playing ? tick % list.length : Math.min(state.sel, list.length - 1);
    if (!state.playing && state.onion && list.length > 1) {
      const p = list[(i - 1 + list.length) % list.length];
      drawPreview(g, p.f.canvas, p.f, scale, off(p.key), K, 0.3);
    }
    const cur = list[i];
    drawPreview(g, cur.f.canvas, cur.f, scale, off(cur.key), K);
    selLabel.textContent = state.playing ? `第 ${i + 1} / ${list.length} 格` : `目前：第 ${i + 1} 格`;
  }
  function loop(t) {
    if (state.playing && animCanvas.offsetParent !== null && frames().length && t - last >= 1000 / state.fps) {
      last = t;
      tick++;
      draw();
    }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  pickAnim(state.animId);
  setPlaying(true);
  showLater();

  return {
    el,
    // 從素材清單點進來：選好動作、捲到這個面板
    select(id) {
      if (ANIMS.some((a) => a.id === id)) pickAnim(id);
      drop.claimPaste();
    },
    onFolderChange() { pickAnim(state.animId); },
    claimPaste: () => drop.claimPaste(),
  };
}
