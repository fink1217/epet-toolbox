// 「寫入裝置」頁：A. 刷韌體　B. 打包素材到 SD 卡
// 兩張卡片各自是一個小狀態機：state 決定畫面，畫面只顯示「現在要做的那一件事」。
import { mountShell, h, svgEl, requireVersion, getVersion, onVersionChange, why, callout, support, warnIfUnsupported, toast } from '../core.js';
import { mascot } from '../svg/mascot.js';
import { SCREENS } from '../data/vocab.js';
import { pickFolder, savedFolder, ensurePermission } from '../lib/fs.js';
import { readMaster } from '../lib/master.js';
import { Flasher, fetchBuild, fetchFirmware, explainError, loadEsptool } from './flash.js';
import { buildPack, writePack, zipPack, sizeDir } from './pack.js';
import { fromFileList } from './memfs.js';
import * as art from '../svg/deploy-art.js';

mountShell('deploy');
warnIfUnsupported(['serial', 'fs']);

const fmtBytes = (n) => (n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(2)} MB`);
const say = (mood, text) => h('div', { class: 'say' }, svgEl(mascot({ mood })), h('div', { class: 'bubble', html: text }));
const steps = (labels, current) => h('ol', { class: 'task-steps' }, labels.map((l, i) =>
  h('li', { class: i < current ? 'done' : i === current ? 'now' : '' }, l)));

// ══════════════════════ A. 刷韌體 ══════════════════════
const flash = { state: 'loading', build: null, data: null, local: null, chip: null, progress: 0, error: null, log: [] };
const flasher = new Flasher((line) => { flash.log.push(line); if (flash.log.length > 400) flash.log.shift(); });
const flashBody = document.getElementById('flash-body');

async function loadFirmwareInfo() {
  const v = getVersion();
  flash.build = v ? await fetchBuild(v.boardInfo.firmware) : null;
  flash.data = null;
  flash.state = !support.serial ? 'unsupported' : flash.build || flash.local ? 'ready' : 'nofw';
  renderFlash();
}

function firmwareLine() {
  if (flash.local) return h('div', { class: 'chip info' }, `本機檔：${flash.local.name}（${fmtBytes(flash.local.data.length)}，位址 0x${flash.local.address.toString(16)}）`);
  if (flash.build) return h('div', { class: 'chip ok' }, `韌體 ${flash.build.version}・${flash.build.date}`);
  return null;
}

function localPicker() {
  const addr = h('input', { type: 'text', value: '0x0', size: 8, 'aria-label': '燒錄位址' });
  const file = h('input', {
    type: 'file', accept: '.bin',
    onchange: async () => {
      const f = file.files[0];
      if (!f) return;
      const address = Number.parseInt(addr.value, 16);
      if (!Number.isFinite(address) || address < 0) { toast('位址格式不對，例：0x0', 'warn'); return; }
      flash.local = { name: f.name, data: new Uint8Array(await f.arrayBuffer()), address };
      flash.state = support.serial ? 'ready' : 'unsupported';
      renderFlash();
    },
  });
  return h('details', { class: 'advanced' },
    h('summary', {}, '進階：選擇本機 .bin 檔（老師測試用）'),
    h('div', { class: 'stack' },
      h('p', { class: 'small muted' }, '要是合併好的單一檔案（開機程式＋分割表＋程式），通常燒在 0x0。'),
      h('div', { class: 'row' }, h('label', { class: 'small' }, '位址 ', addr), file),
      flash.local ? h('button', { class: 'btn btn-ghost', onclick: () => { flash.local = null; loadFirmwareInfo(); } }, '改回正式韌體') : null));
}

function renderFlash() {
  const S = flash.state;
  const at = { ready: 0, connecting: 0, connected: 1, flashing: 1, done: 2 }[S] ?? 0;
  const parts = [];

  if (S === 'loading') parts.push(h('p', { class: 'muted' }, '讀取韌體清單…'));

  if (S === 'unsupported') {
    parts.push(callout('warn', '這個瀏覽器不能連接 USB。請用<b>電腦版 Chrome 或 Edge</b> 開這一頁。'));
  }

  if (S === 'nofw') {
    parts.push(say('sleep', '這個版本的韌體<b>還在孵化中</b>。做好之後，這裡會出現「燒錄」按鈕。'));
    parts.push(localPicker());
  }

  if (S === 'ready') {
    parts.push(steps(['連接', '燒錄', '完成'], at), firmwareLine(),
      callout('tip', '用 USB 線把電子雞接上電腦。線要能<b>傳資料</b>，有些線只能充電。'),
      h('button', { class: 'btn btn-primary btn-lg wide', onclick: doConnect }, '連接電子雞'));
    if (flash.local) parts.push(localPicker());
  }

  if (S === 'connecting') {
    parts.push(steps(['連接', '燒錄', '完成'], at), say('think', '正在跟電子雞打招呼…<br><span class="small muted">瀏覽器跳出清單時，選有「USB JTAG」字樣的那一個。</span>'));
  }

  if (S === 'connected') {
    const c = flash.chip;
    parts.push(steps(['連接', '燒錄', '完成'], at),
      h('div', { class: 'row' },
        h('span', { class: `chip ${c.isS3 ? 'ok' : 'warn'}` }, c.isS3 ? `✓ ${c.name}` : `✗ ${c.name}`),
        c.flashSize ? h('span', { class: 'chip' }, `快閃記憶體 ${c.flashSize}`) : null),
      h('p', { class: 'small muted' }, c.description),
      c.isS3 ? null : callout('warn', '這不是 ESP32-S3，不能燒這個韌體。確認接的是電子雞主板。'),
      firmwareLine(),
      h('div', { class: 'row' },
        h('button', { class: 'btn btn-primary btn-lg grow', disabled: !c.isS3, onclick: doFlash }, '開始燒錄'),
        h('button', { class: 'btn btn-ghost', onclick: async () => { await flasher.disconnect(); loadFirmwareInfo(); } }, '斷開')));
  }

  if (S === 'flashing') {
    const pct = Math.round(flash.progress * 100);
    parts.push(steps(['連接', '燒錄', '完成'], at),
      h('div', { class: 'hatch' }, svgEl(art.egg(flash.progress))),
      h('div', { class: 'bar' }, h('i', { style: `width:${pct}%` })),
      h('p', { class: 'center' }, h('b', {}, `孵化中… ${pct}%`), h('br'), h('span', { class: 'small muted' }, '燒錄時不要拔 USB')));
  }

  if (S === 'done') {
    parts.push(steps(['連接', '燒錄', '完成'], 3),
      h('div', { class: 'hatch' }, svgEl(art.egg(1))),
      callout('ok', '燒好了！電子雞正在重新開機。'),
      h('button', { class: 'btn wide', onclick: () => { flash.state = 'ready'; renderFlash(); } }, '再燒一次'));
  }

  if (S === 'error') {
    const e = flash.error;
    parts.push(say('warn', `<b>${e.title}</b>`),
      h('ul', { class: 'tips' }, e.tips.map((t) => h('li', {}, t))),
      h('button', { class: 'btn btn-primary wide', onclick: () => loadFirmwareInfo() }, '再試一次'));
  }

  if (flash.log.length && S !== 'loading') {
    parts.push(h('details', { class: 'advanced' }, h('summary', {}, '詳細紀錄'), h('pre', { class: 'log' }, flash.log.join('\n'))));
  }
  flashBody.replaceChildren(...parts.filter(Boolean));
}

async function doConnect() {
  flash.state = 'connecting';
  flash.log = [];
  renderFlash();
  try {
    if (!flash.local) flash.data = await fetchFirmware(flash.build);
    flash.chip = await flasher.connect();
    flash.state = 'connected';
  } catch (e) {
    await flasher.disconnect();
    flash.error = explainError(e);
    flash.state = 'error';
  }
  renderFlash();
}

async function doFlash() {
  flash.state = 'flashing';
  flash.progress = 0;
  renderFlash();
  let last = 0;
  try {
    const data = flash.local ? flash.local.data : flash.data;
    const address = flash.local ? flash.local.address : flash.build.address || 0;
    await flasher.flash(data, address, (p) => {
      flash.progress = p;
      if (p - last >= 0.01 || p === 1) { last = p; renderFlash(); }
    });
    flash.state = 'done';
  } catch (e) {
    flash.error = explainError(e);
    flash.state = 'error';
  }
  await flasher.disconnect();
  renderFlash();
}

// ══════════════════════ B. 打包素材 ══════════════════════
const pack = { state: 'pick', root: null, master: null, screens: new Set(), result: null, progress: 0, label: '', error: '', zip: false };
const packBody = document.getElementById('pack-body');

function defaultScreens() {
  const v = getVersion();
  const s = v?.boardInfo.screen;
  return new Set(s ? [sizeDir(s)] : []);
}

async function openMaster(root) {
  pack.root = root;
  pack.state = 'reading';
  renderPack();
  try {
    pack.master = await readMaster(root);
    if (!pack.screens.size) pack.screens = defaultScreens();
    pack.state = 'check';
  } catch (e) {
    pack.error = `讀不到素材資料夾：${e.message}`;
    pack.state = 'error';
  }
  renderPack();
}

async function chooseMaster(useSaved) {
  try {
    let root = useSaved ? await savedFolder('master') : null;
    if (root && !(await ensurePermission(root, 'read'))) root = null;
    if (!root) root = await pickFolder('master', { mode: 'read' });
    await openMaster(root);
  } catch (e) {
    if (e.name !== 'AbortError') { pack.error = e.message; pack.state = 'error'; renderPack(); }
  }
}

function pickView() {
  const parts = [steps(['選素材', '檢查', '寫入 SD'], 0)];
  if (support.fs) {
    parts.push(callout('info', '素材資料夾就是你在<b>素材生成器</b>存檔的那個資料夾。'));
    const btns = h('div', { class: 'stack' });
    parts.push(btns);
    savedFolder('master').then((saved) => {
      btns.replaceChildren(...[
        saved ? h('button', { class: 'btn btn-primary btn-lg wide', onclick: () => chooseMaster(true) }, `使用上次的資料夾「${saved.name}」`) : null,
        h('button', { class: `btn ${saved ? '' : 'btn-primary btn-lg'} wide`, onclick: () => chooseMaster(false) }, saved ? '選別的資料夾' : '選擇素材資料夾'),
      ].filter(Boolean));
    });
  } else {
    pack.zip = true;
    const input = h('input', { type: 'file', webkitdirectory: true, multiple: true, class: 'hidden',
      onchange: async () => { if (input.files.length) await openMaster(await fromFileList(input.files)); } });
    parts.push(callout('tip', '這個瀏覽器不能直接寫 SD 卡，打包完會給你一個 ZIP，解壓縮到 SD 卡就好。'),
      input, h('button', { class: 'btn btn-primary btn-lg wide', onclick: () => input.click() }, '選擇素材資料夾'));
  }
  return parts;
}

function checkView() {
  const m = pack.master;
  const row = (ok, label, detail) => h('li', { class: ok ? 'ok' : 'none' }, h('span', { class: 'mark' }, ok ? '✓' : '–'), h('b', {}, label), h('span', { class: 'muted' }, detail));
  const animDetail = m.anims.map((a) => `${a.zh} ${a.frames.length} 張`).join('、');
  const list = h('ul', { class: 'checklist' },
    row(m.anims.length, `角色動作 ${m.anims.length} 個`, animDetail || '還沒有'),
    row(m.backgrounds.length, `背景 ${m.backgrounds.length} 張`, m.backgrounds.map((b) => b.zh).join('、')),
    row(m.icons.length, `圖示 ${m.icons.length} 個`, m.icons.map((b) => b.zh).join('、') || '沒有也可以，會顯示文字'),
    row(m.items.length, `道具 ${m.items.length} 個`, m.items.map((b) => b.zh).join('、')),
    row(m.sounds.length, `音效 ${m.sounds.length} 個`, m.sounds.map((b) => b.zh).join('、') || '沒有也可以，就是安靜'));

  const sizes = h('div', { class: 'sizes' }, SCREENS.map((s) => {
    const key = sizeDir(s);
    const box = h('input', { type: 'checkbox', checked: pack.screens.has(key), onchange: () => {
      box.checked ? pack.screens.add(key) : pack.screens.delete(key);
      go.disabled = blocked();
    } });
    return h('label', { class: 'size' }, box, h('b', {}, key), h('span', { class: 'small muted' }, s.name));
  }));

  const blocked = () => m.missing.length > 0 || pack.screens.size === 0;
  const go = h('button', { class: 'btn btn-primary btn-lg wide', disabled: blocked(), onclick: doPack },
    pack.zip ? '打包成 ZIP 下載' : '選擇 SD 卡並開始打包');

  return [
    steps(['選素材', '檢查', '寫入 SD'], 1),
    h('p', { class: 'small muted' }, `素材資料夾：${pack.root.name || '（已選擇）'}・寵物：${m.pet.name}`),
    list,
    m.missing.length ? callout('warn', `少了必要的東西：<b>${m.missing.join('、')}</b>。先到素材生成器補上。`) : null,
    m.warnings.length ? h('details', { class: 'advanced' }, h('summary', {}, `${m.warnings.length} 個提醒（不影響打包）`),
      h('ul', { class: 'tips' }, m.warnings.map((w) => h('li', {}, w)))) : null,
    h('h4', { class: 'sub' }, '要打包哪些螢幕尺寸？'),
    sizes,
    pack.zip ? null : callout('tip', '下一步會請你選 SD 卡。Chrome 不讓你選整張卡的話，就在 SD 卡裡<b>新增一個叫 pet 的資料夾</b>，選它。'),
    go,
    h('button', { class: 'btn btn-ghost', onclick: () => { pack.state = 'pick'; renderPack(); } }, '換一個素材資料夾'),
  ];
}

const selectedScreens = () => SCREENS.filter((s) => pack.screens.has(sizeDir(s)));

async function doPack() {
  let sd = null;
  if (!pack.zip) {
    // 選資料夾必須在按鈕點擊的當下呼叫，所以放在最前面
    try {
      sd = await pickFolder('sd', { mode: 'readwrite', startIn: 'desktop' });
    } catch (e) {
      if (e.name !== 'AbortError') { pack.error = `選不到 SD 卡：${e.message}`; pack.state = 'error'; renderPack(); }
      return;
    }
  }
  const screens = selectedScreens();
  try {
    pack.master = await readMaster(pack.root);   // 重新讀一次，拿到最新的素材
    pack.state = 'packing';
    pack.progress = 0;
    renderPack();
    const { files, report } = await buildPack(pack.master, screens, (p, label) => {
      pack.progress = p * (pack.zip ? 1 : 0.7);
      pack.label = label;
      renderProgress();
    });
    if (pack.zip) {
      const blob = await zipPack(files);
      const a = h('a', { href: URL.createObjectURL(blob), download: `${pack.master.pet.name || 'pet'}-SD卡.zip` });
      document.body.append(a);
      a.click();
      a.remove();
    } else {
      const petDir = await writePack(sd, files, screens, (p, path) => {
        pack.progress = 0.7 + p * 0.3;
        pack.label = `寫入 ${path}`;
        renderProgress();
      });
      report.where = sd.name === 'pet' ? 'pet' : `${sd.name}/pet`;
      report.petDir = petDir.name;
    }
    pack.result = report;
    pack.state = 'done';
  } catch (e) {
    console.error(e);
    pack.error = e.message || String(e);
    pack.state = 'error';
  }
  renderPack();
}

let progressEls = null;
function packingView() {
  const bar = h('i', { style: 'width:0%' });
  const label = h('p', { class: 'small muted center' }, '');
  const pct = h('b', {}, '0%');
  progressEls = { bar, label, pct };
  return [
    steps(['選素材', '檢查', '寫入 SD'], 2),
    h('div', { class: 'hatch' }, svgEl(art.sdHero())),
    h('div', { class: 'bar' }, bar),
    h('p', { class: 'center' }, pct),
    label,
  ];
}
function renderProgress() {
  if (!progressEls) return;
  const p = Math.round(pack.progress * 100);
  progressEls.bar.style.width = `${p}%`;
  progressEls.pct.textContent = `${p}%`;
  progressEls.label.textContent = pack.label;
}

function doneView() {
  const r = pack.result;
  return [
    steps(['選素材', '檢查', '寫入 SD'], 3),
    say('cheer', pack.zip ? '打包好了！把 ZIP 解壓縮，裡面的 <b>pet</b> 資料夾整個放到 SD 卡最外層。' : `寫好了！放在 <b>${r.where}</b>。`),
    h('div', { class: 'stats' },
      h('div', {}, h('b', {}, r.fileCount), h('span', {}, '個檔案')),
      h('div', {}, h('b', {}, fmtBytes(r.totalBytes)), h('span', {}, '總大小'))),
    h('ul', { class: 'checklist' },
      r.screens.map((s) => h('li', { class: 'ok' }, h('span', { class: 'mark' }, '✓'), h('b', {}, s.dir), h('span', { class: 'muted' }, `${s.files} 個檔、${fmtBytes(s.bytes)}`))),
      h('li', { class: 'ok' }, h('span', { class: 'mark' }, '✓'), h('b', {}, '音效＋文字'), h('span', { class: 'muted' }, `${r.shared.files} 個檔、${fmtBytes(r.shared.bytes)}`))),
    r.warnings.length ? h('details', { class: 'advanced' }, h('summary', {}, `${r.warnings.length} 個提醒`), h('ul', { class: 'tips' }, r.warnings.map((w) => h('li', {}, w)))) : null,
    pack.zip ? null : callout('warn', '拔 SD 卡前，先在電腦上按<b>「安全移除」</b>，不然檔案可能沒寫完。'),
    h('button', { class: 'btn wide', onclick: () => openMaster(pack.root) }, '再打包一次'),
  ];
}

function renderPack() {
  const S = pack.state;
  let parts;
  if (S === 'pick') parts = pickView();
  else if (S === 'reading') parts = [say('think', '正在翻你的素材資料夾…')];
  else if (S === 'check') parts = checkView();
  else if (S === 'packing') parts = packingView();
  else if (S === 'done') parts = doneView();
  else parts = [say('warn', `<b>出了點問題</b><br>${pack.error}`), h('button', { class: 'btn btn-primary wide', onclick: () => { pack.state = 'pick'; renderPack(); } }, '重新開始')];
  if (S !== 'packing') progressEls = null;
  packBody.replaceChildren(...parts.filter(Boolean));
}

// ══════════════════════ 版面：主圖與「為什麼」 ══════════════════════
document.getElementById('flash-art').append(svgEl(art.flashHero()));
document.getElementById('pack-art').append(svgEl(art.sdHero()));

document.getElementById('flash-why').append(why([
  { art: art.firmwareArt(), title: '韌體是什麼？', text: '<p>韌體就是電子雞的大腦：決定它什麼時候肚子餓、怎麼動、怎麼叫。</p><p>它存在主板的快閃記憶體裡，拔掉電源也不會忘記。換新版韌體，就是把舊的大腦整個換掉。</p>' },
  { art: art.mergedBinArt(), title: '為什麼只有一個檔案？', text: '<p>ESP32 開機需要三樣東西：開機程式、分割表（記錄哪一段放什麼）、電子雞程式。</p><p>我們事先把三塊接成一個檔，從位址 <code>0x0</code> 一次寫完，就不會有「漏燒一塊」或「位址打錯」的問題。</p>' },
  { art: art.bootButtonArt(), title: 'BOOT 鍵是做什麼的？', text: '<p>平常一插電，ESP32 會直接執行韌體。按住 BOOT 再插電，它會改成進入「燒錄模式」，乖乖等電腦送新韌體過來。</p><p>大多數時候網頁會自動幫你切換。連不上的時候，才需要手動按。</p>' },
  { art: art.browserArt(), title: '為什麼只能用 Chrome 或 Edge？', text: '<p>網頁要直接跟 USB 裝置說話，需要瀏覽器的 <b>Web Serial</b> 功能。目前只有電腦版 Chrome 和 Edge 有。</p><p>所以不用另外安裝燒錄軟體，打開網頁就能燒。</p>' },
], '為什麼要這樣燒？'));

document.getElementById('pack-why').append(why([
  { art: art.sizeFoldersArt(), title: '為什麼分尺寸資料夾？', text: '<p>ESP32 縮圖又慢又醜，所以每種螢幕的圖，都在電腦上先縮成剛好的大小，各放一個資料夾。</p><p>電子雞開機時只找「跟自己螢幕一樣大」的資料夾。同一張卡可以同時放好幾種尺寸，插到哪台都能用。</p>' },
  { art: art.englishNamesArt(), title: '為什麼檔名變成英文？', text: '<p>ESP32 的記憶卡程式對中文檔名的支援不穩，有時候讀得到、有時候變亂碼。</p><p>所以中文名稱只留在你電腦的素材資料夾；寫到 SD 卡時，打包器照對照表換成英文 id，例如「待機」→ <code>idle</code>。</p>' },
  { art: art.formatsArt(), title: 'JPEG、QOI、PNG 差在哪？', text: '<p><b>背景</b>不需要透明，用檔案最小的 JPEG。</p><p><b>角色和圖示</b>要透明，用 QOI：它解碼比 PNG 快好幾倍，ESP32 才跑得動動畫。PNG 只當電腦上的母檔。</p>' },
  { art: art.anchorArt(), title: 'anchor 和 dx、dy 是什麼？', text: '<p>每一幀圖都裁掉了透明邊，所以大小不一樣。打包器記下「這張圖的左上角，離腳底差多少」，就是 dx、dy。</p><p>電子雞只要知道腳底要踩在哪（anchor），每一幀就能對齊。角色要走路時，只改 anchor 就好。</p>' },
  { art: art.fontSubsetArt(), title: '為什麼字型只收用到的字？', text: '<p>實測完整的繁體中文點陣字型要 <b>571 KB</b>，大部分的字電子雞一輩子都用不到。</p><p>打包器掃過你所有的文字，只畫出用到的字。實測預設文字一共 186 個字，16px 的字型檔只有 <b>16 KB</b>。改了文字，重新打包一次就好。</p>' },
  { art: art.audioArt(), title: '為什麼音效變成 22050 Hz 單聲道？', text: '<p>電子雞只有一顆小喇叭，立體聲沒有意義；22050 Hz 對小喇叭也已經夠清楚。</p><p>檔案只剩原本的四分之一，而且 WAV 不用解碼，ESP32 讀到就能直接播。</p>' },
], '為什麼要這樣打包？'));

// ══════════════════════ 啟動 ══════════════════════
renderPack();
await requireVersion();
pack.screens = defaultScreens();
await loadFirmwareInfo();
onVersionChange(() => {
  pack.screens = defaultScreens();
  if (pack.state === 'check') renderPack();
  if (!['connecting', 'connected', 'flashing'].includes(flash.state)) loadFirmwareInfo();
});
if (support.serial) loadEsptool().catch(() => toast('燒錄工具載入失敗，請檢查網路', 'warn'));
