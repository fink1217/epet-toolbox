// 素材資料夾（學員的母檔）的讀取規則。生成器寫、打包器讀，兩邊都透過這裡，規則只寫一次。
// 規格說明：docs/素材資料夾規則.md
import { ANIMS, BACKGROUNDS, ICONS, ITEMS, SOUNDS, DEFAULT_TEXTS, FORMAT_VERSION, byZh } from '../data/vocab.js';
import { getDir, listDir, readJSON, writeJSON } from './fs.js';

export const DIRS = { character: '角色', background: '背景', icon: '圖示', item: '道具', sound: '音效' };
export const PET_FILE = '寵物.json';

const IMAGE_EXT = /\.(png|jpe?g|webp)$/i;
const SOUND_EXT = /\.(wav|mp3|ogg|m4a|aac|flac)$/i;
const stem = (name) => name.replace(/\.[^.]+$/, '');

// 深層合併：學員只寫想改的部分
function merge(base, over) {
  if (!over || typeof over !== 'object' || Array.isArray(over)) return over ?? base;
  const out = { ...base };
  for (const [k, v] of Object.entries(over)) out[k] = merge(base?.[k], v);
  return out;
}

export async function readPet(root) {
  const raw = (await readJSON(root, PET_FILE)) || {};
  return {
    format: FORMAT_VERSION,
    name: raw.name || DEFAULT_TEXTS.name,
    anims: raw.anims || {},
    texts: merge(DEFAULT_TEXTS, { ...(raw.texts || {}), name: raw.name || DEFAULT_TEXTS.name }),
    raw,
  };
}

export async function writePet(root, patch) {
  const raw = (await readJSON(root, PET_FILE)) || { format: FORMAT_VERSION };
  await writeJSON(root, PET_FILE, merge(raw, patch));
}

async function subdir(root, name) {
  try { return await getDir(root, name); } catch { return null; }
}

// 同名不同副檔名時的優先順序：越前面越優先（無損格式優先）
const PREFER = ['png', 'wav', 'webp', 'flac', 'jpg', 'jpeg', 'mp3', 'm4a', 'aac', 'ogg'];
const rank = (name) => {
  const i = PREFER.indexOf(name.split('.').pop().toLowerCase());
  return i < 0 ? PREFER.length : i;
};

// 一個「名稱 → 檔案」的類別（背景、圖示、道具、音效）。同一個名稱只取一個檔。
async function readFlat(root, dirName, vocab, ext, kind, warnings) {
  const dir = await subdir(root, dirName);
  if (!dir) return [];
  const byId = new Map();
  for (const e of await listDir(dir)) {
    if (e.kind !== 'file' || !ext.test(e.name)) continue;
    const v = byZh(vocab, stem(e.name));
    if (!v) { warnings.push(`「${dirName}/${e.name}」不是認得的${kind}名稱，會被略過`); continue; }
    const prev = byId.get(v.id);
    if (prev) {
      const [keep, drop] = rank(e.name) < rank(prev.name) ? [e, prev] : [prev, e];
      warnings.push(`「${dirName}」裡有兩個「${v.zh}」，使用 ${keep.name}，略過 ${drop.name}`);
      if (keep === prev) continue;
    }
    byId.set(v.id, { ...e, v });
  }
  const out = [];
  for (const e of byId.values()) out.push({ ...e.v, file: await e.handle.getFile(), path: `${dirName}/${e.name}` });
  return out;
}

// 讀整個素材資料夾。回傳的結構就是打包器的輸入。
export async function readMaster(root) {
  const warnings = [];
  const pet = await readPet(root);

  const anims = [];
  const charDir = await subdir(root, DIRS.character);
  if (charDir) {
    for (const e of await listDir(charDir)) {
      if (e.kind !== 'directory') continue;
      const v = byZh(ANIMS, e.name);
      if (!v) { warnings.push(`「角色/${e.name}」不是認得的動作名稱，會被略過`); continue; }
      const frames = [];
      for (const f of await listDir(e.handle)) {
        if (f.kind === 'file' && IMAGE_EXT.test(f.name)) frames.push(await f.handle.getFile());
      }
      if (!frames.length) { warnings.push(`「角色/${e.name}」裡面沒有圖片`); continue; }
      const o = pet.anims[e.name] || {};
      anims.push({ ...v, fps: o.fps || v.fps, loop: o.loop ?? v.loop, frames });
    }
  }

  const master = {
    pet,
    anims,
    backgrounds: await readFlat(root, DIRS.background, BACKGROUNDS, IMAGE_EXT, '背景', warnings),
    icons: await readFlat(root, DIRS.icon, ICONS, IMAGE_EXT, '圖示', warnings),
    items: await readFlat(root, DIRS.item, ITEMS, IMAGE_EXT, '道具', warnings),
    sounds: await readFlat(root, DIRS.sound, SOUNDS, SOUND_EXT, '音效', warnings),
    warnings,
  };

  // 必要項目
  master.missing = [];
  if (!anims.some((a) => a.id === 'idle')) master.missing.push('角色/待機/（至少一張圖）');
  if (!master.backgrounds.some((b) => b.id === 'day')) master.missing.push('背景/白天.png');
  return master;
}
