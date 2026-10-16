// 音效面板：放音檔 → 去頭尾靜音、音量標準化、試聽 → 存成 WAV。
import { h, why, callout, toast } from '../core.js';
import { SOUNDS, MASTER } from '../data/vocab.js';
import { DIRS } from '../lib/master.js';
import { decodeToMono, trimSilence, normalize } from '../lib/audio.js';
import { encodeWav } from '../lib/wav.js';
import { dropzone, toggle, vocabSelect, stepCard, saveFiles, removeVariants } from './ui.js';
import { refresh, requireFolder, has } from './folder.js';
import { artSound } from '../svg/gen-art.js';

const RATE = MASTER.soundRate;
const LONG = 4;   // 秒：超過就提醒

export function soundPanel() {
  const state = { raw: null, samples: null, name: '', trim: true, norm: true, id: SOUNDS[0].id };

  const drop = dropzone({
    accept: 'audio/*',
    title: '把音效檔拖進來',
    hint: 'WAV、MP3、OGG、M4A 都可以。AI 音效網站下載的檔案直接丟。',
    onFiles: ([f]) => load(f),
  });

  const wave = h('canvas', { class: 'wave', width: 1200, height: 220 });
  const meta = h('div', { class: 'small muted' });
  const playBtn = h('button', { class: 'btn btn-dark', onclick: play }, '▶ 試聽');
  const trim = toggle({ label: '剪掉頭尾的安靜', checked: true, onchange: (v) => { state.trim = v; derive(); } });
  const norm = toggle({ label: '音量調到一致', checked: true, onchange: (v) => { state.norm = v; derive(); } });
  const idSel = vocabSelect(SOUNDS, { value: state.id, onchange: (id) => { state.id = id; renderSave(); } });
  const overwrite = h('div', { class: 'small' });
  const saveBtn = h('button', { class: 'btn btn-primary btn-lg', onclick: save }, '存進素材資料夾');
  const saveMsg = h('span', { class: 'small muted' });
  const longWarn = h('div');

  const step2 = stepCard(2, '整理、試聽',
    h('div', { class: 'stack' }, wave, h('div', { class: 'row' }, playBtn, meta), h('div', { class: 'row' }, trim.el, norm.el), longWarn));
  const step3 = stepCard(3, '存成哪個音效',
    h('div', { class: 'stack' }, h('div', { class: 'row' }, idSel), overwrite, h('div', { class: 'row' }, saveBtn, saveMsg)));

  const el = h('div', { class: 'gen-panel stack' },
    stepCard(1, '放音效檔', drop),
    step2, step3,
    why([
      { art: artSound(), title: '為什麼要剪靜音、調音量？', text: '<p>網路上下載的音效，前面常常有一小段安靜，按下去會覺得「慢半拍」。</p><p>每個檔案大小聲也不一樣，統一調到同樣的最大音量，電子雞才不會一下吵一下聽不到。</p>' },
      { art: artSound(), title: '為什麼存成 WAV？', text: '<p>WAV 沒有壓縮，ESP32 不用花力氣解碼，讀出來就能直接播。</p><p>素材資料夾裡存 44.1 kHz 的好音質，打包到 SD 卡時才轉成 22 kHz，省一半空間。</p>' },
    ], '這一頁在做什麼？'));

  async function load(file) {
    meta.textContent = '解碼中…';
    try {
      state.raw = await decodeToMono(file, RATE);
      state.name = file.name;
      showLater();
      derive();
    } catch {
      meta.textContent = '';
      toast('這個音檔讀不出來，換成 WAV 或 MP3 試試', 'warn');
    }
  }

  function derive() {
    if (!state.raw) return;
    let s = state.raw;
    if (state.trim) s = trimSilence(s, RATE);
    if (state.norm) s = normalize(s);
    state.samples = s;
    drawWave();
    const sec = s.length / RATE;
    let peak = 0;
    for (const v of s) peak = Math.max(peak, Math.abs(v));
    meta.textContent = `${state.name} · ${sec.toFixed(2)} 秒 · 最大音量 ${Math.round(peak * 100)}%`;
    longWarn.replaceChildren(sec > LONG ? callout('tip', `這段有 ${sec.toFixed(1)} 秒。音效建議 ${LONG} 秒以內，太長會擋住下一個聲音。`) : '');
    renderSave();
  }

  function drawWave() {
    const g = wave.getContext('2d');
    const { width: W, height: H } = wave;
    g.clearRect(0, 0, W, H);
    g.fillStyle = '#FFFDF8';
    g.fillRect(0, 0, W, H);
    g.strokeStyle = '#ECE5D8';
    g.beginPath(); g.moveTo(0, H / 2); g.lineTo(W, H / 2); g.stroke();
    const s = state.samples;
    if (!s?.length) return;
    g.fillStyle = '#11807A';
    const per = s.length / W;
    for (let x = 0; x < W; x++) {
      let lo = 1, hi = -1;
      const a = Math.floor(x * per), b = Math.min(s.length, Math.floor((x + 1) * per) + 1);
      for (let i = a; i < b; i++) { if (s[i] < lo) lo = s[i]; if (s[i] > hi) hi = s[i]; }
      if (hi < lo) continue;
      g.fillRect(x, H / 2 - hi * (H / 2 - 4), 1, Math.max(1, (hi - lo) * (H / 2 - 4)));
    }
  }

  let ctx = null;
  function play() {
    if (!state.samples) return;
    ctx ||= new AudioContext();
    const buf = ctx.createBuffer(1, state.samples.length, RATE);
    buf.copyToChannel(state.samples, 0);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(ctx.destination);
    src.start();
  }

  function renderSave() {
    const v = SOUNDS.find((x) => x.id === state.id);
    overwrite.replaceChildren(has('sound', v.id) ? h('span', { class: 'warn-text' }, `素材資料夾裡已經有「${v.zh}」，存檔會覆蓋。`) : '');
    saveBtn.textContent = `存成「${v.zh}」`;
    saveBtn.disabled = !state.samples;
  }

  async function save() {
    if (!state.samples) return;
    const v = SOUNDS.find((x) => x.id === state.id);
    saveBtn.disabled = true;
    try {
      const root = await requireFolder();
      if (root && has('sound', v.id) && !confirm(`「${v.zh}」已經有了，要覆蓋嗎？`)) return;
      const blob = new Blob([encodeWav(state.samples, RATE)], { type: 'audio/wav' });
      await removeVariants(root, DIRS.sound, v.zh, 'wav');
      await saveFiles([{ path: `${DIRS.sound}/${v.zh}.wav`, blob }]);
      if (root) { await refresh(); toast(`已存成音效「${v.zh}」`, 'ok'); }
      saveMsg.textContent = `✓ 存好了：${DIRS.sound}/${v.zh}.wav`;
    } catch (e) {
      if (e.name !== 'AbortError') toast(`存檔失敗：${e.message}`, 'warn');
    } finally {
      saveBtn.disabled = !state.samples;
    }
  }

  function showLater() {
    step2.classList.toggle('hidden', !state.raw);
    step3.classList.toggle('hidden', !state.raw);
  }
  showLater();
  renderSave();

  return {
    el,
    select(id) { if (SOUNDS.some((v) => v.id === id)) { state.id = id; idSel.value = id; renderSave(); } drop.claimPaste(); },
    onFolderChange: renderSave,
    claimPaste: () => drop.claimPaste(),
  };
}
