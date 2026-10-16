// 生成器各面板共用的小元件：拖放區、滑桿、開關、處理中遮罩、存檔（資料夾或下載）。
import { h, toast } from '../core.js';
import { writeFile, removeEntry } from '../lib/fs.js';
import { requireFolder } from './folder.js';

// ── 拖放區：拖進來、點一下選檔、或 Ctrl+V 貼上都可以 ──
let pasteTarget = null;
document.addEventListener('paste', (e) => {
  if (!pasteTarget || !pasteTarget.el.isConnected || pasteTarget.el.offsetParent === null) return;
  const files = [...(e.clipboardData?.files || [])].filter((f) => pasteTarget.match(f));
  if (files.length) { e.preventDefault(); pasteTarget.onFiles(files); }
});

export function dropzone({ accept = 'image/*', multiple = false, title, hint, onFiles }) {
  const match = (f) => (accept === 'image/*' ? f.type.startsWith('image/') : accept === 'audio/*' ? f.type.startsWith('audio/') || /\.(wav|mp3|ogg|m4a|aac|flac)$/i.test(f.name) : true);
  const input = h('input', { type: 'file', accept, multiple, class: 'hidden' });
  const el = h('div', { class: 'drop', tabindex: '0', role: 'button' },
    h('div', { class: 'big' }, title),
    h('div', { class: 'small muted' }, hint),
    input);
  const take = (list) => {
    const files = [...list].filter(match);
    if (!files.length) { toast('這不是我認得的檔案類型', 'warn'); return; }
    onFiles(multiple ? files : files.slice(0, 1));
  };
  el.addEventListener('click', (e) => { if (e.target !== input) input.click(); });
  el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); } });
  input.addEventListener('change', () => { take(input.files); input.value = ''; });
  el.addEventListener('dragover', (e) => { e.preventDefault(); el.classList.add('over'); });
  el.addEventListener('dragleave', () => el.classList.remove('over'));
  el.addEventListener('drop', (e) => { e.preventDefault(); el.classList.remove('over'); take(e.dataTransfer.files); });
  // 誰最後被點到或顯示，貼上就給誰
  const claim = () => { pasteTarget = { el, match, onFiles: (fs) => onFiles(multiple ? fs : fs.slice(0, 1)) }; };
  el.addEventListener('pointerenter', claim);
  el.addEventListener('focus', claim);
  el.claimPaste = claim;
  return el;
}

// ── 滑桿 ──
export function slider({ label, min, max, step = 1, value, format = (v) => v, oninput }) {
  const out = h('span', { class: 'slider-val' }, format(value));
  const input = h('input', { type: 'range', min, max, step, value });
  input.addEventListener('input', () => { out.textContent = format(+input.value); oninput?.(+input.value); });
  const el = h('label', { class: 'slider' }, h('span', { class: 'slider-label' }, label, out), input);
  return {
    el,
    get value() { return +input.value; },
    set value(v) { input.value = v; out.textContent = format(+v); },
    input,
  };
}

// ── 開關 ──
export function toggle({ label, checked = false, onchange }) {
  const input = h('input', { type: 'checkbox' });
  input.checked = checked;
  input.addEventListener('change', () => onchange?.(input.checked));
  const el = h('label', { class: 'switch' }, input, h('span', { class: 'switch-ui' }), h('span', {}, label));
  return {
    el,
    get checked() { return input.checked; },
    set checked(v) { input.checked = v; },
  };
}

// ── 下拉選單：用詞彙表的中文名 ──
export function vocabSelect(list, { value, onchange } = {}) {
  const sel = h('select', {}, list.map((v) => h('option', { value: v.id }, v.zh + (v.required ? '（必要）' : ''))));
  if (value) sel.value = value;
  sel.addEventListener('change', () => onchange?.(sel.value));
  return sel;
}

// ── 處理中遮罩 ──
export function busyLayer(host) {
  const text = h('span', {}, '處理中…');
  const el = h('div', { class: 'busy hidden' }, h('span', { class: 'spinner' }), text);
  host.append(el);
  return {
    show(msg = '處理中…') { text.textContent = msg; el.classList.remove('hidden'); },
    hide() { el.classList.add('hidden'); },
  };
}

// ── 步驟卡 ──
export function stepCard(n, title, ...body) {
  return h('section', { class: 'card gen-step' },
    h('div', { class: 'gen-step-head' }, h('span', { class: 'gen-n' }, n), h('h3', {}, title)),
    ...body);
}

// ── 存檔：有資料夾就寫進去，沒有（瀏覽器不支援）就改成下載 ──
// files: [{ path: '角色/待機/001.png', blob }]
export async function saveFiles(files, { onProgress } = {}) {
  const root = await requireFolder();
  if (!root) {
    for (const f of files) download(f.blob, f.path.replaceAll('/', '_'));
    toast(`已下載 ${files.length} 個檔案，請自己放進素材資料夾的「${files[0].path.split('/')[0]}」`, 'ok');
    return null;
  }
  for (let i = 0; i < files.length; i++) {
    onProgress?.(i, files.length);
    await writeFile(root, files[i].path, files[i].blob);
  }
  onProgress?.(files.length, files.length);
  return root;
}

export function download(blob, name) {
  const a = h('a', { href: URL.createObjectURL(blob), download: name });
  document.body.append(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

// ── 複製按鈕 ──
export function copyButton(getText, label = '複製') {
  const btn = h('button', { class: 'btn btn-dark copy-btn' }, label);
  btn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(getText());
      btn.textContent = '已複製 ✓';
    } catch {
      btn.textContent = '請手動選取複製';
    }
    setTimeout(() => { btn.textContent = label; }, 1600);
  });
  return btn;
}

export const pad3 = (n) => String(n).padStart(3, '0');

// 同名但副檔名不同的舊檔（例如 白天.jpg 之於 白天.png）要先刪掉，不然打包器會看到兩份
const VARIANT_EXT = ['png', 'jpg', 'jpeg', 'webp', 'wav', 'mp3', 'ogg', 'm4a', 'aac', 'flac'];
export async function removeVariants(root, dir, stem, keepExt) {
  if (!root) return;
  for (const ext of VARIANT_EXT) {
    if (ext === keepExt) continue;
    await removeEntry(root, `${dir}/${stem}.${ext}`, { recursive: false });
  }
}
