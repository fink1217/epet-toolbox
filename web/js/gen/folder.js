// 素材資料夾的狀態：選過一次就記住；任何面板存檔後呼叫 refresh()，清單會自動更新。
import { pickFolder, savedFolder, ensurePermission } from '../lib/fs.js';
import { readMaster } from '../lib/master.js';
import { support } from '../core.js';

export const folder = { root: null, saved: null, master: null };
const listeners = new Set();

export function onFolder(fn) {
  listeners.add(fn);
  fn(folder);
}
const emit = () => listeners.forEach((fn) => fn(folder));

// 頁面載入：找上次的資料夾；已授權就直接讀
export async function initFolder() {
  if (!support.fs) { emit(); return; }
  folder.saved = await savedFolder('master');
  if (folder.saved) {
    try {
      if ((await folder.saved.queryPermission({ mode: 'readwrite' })) === 'granted') {
        folder.root = folder.saved;
        await refresh();
        return;
      }
    } catch { /* handle 失效就當沒選過 */ }
  }
  emit();
}

// 選新的資料夾（要在按鈕事件裡呼叫）
export async function connect() {
  const root = await pickFolder('master');
  folder.root = root;
  folder.saved = root;
  await refresh();
}

// 繼續使用上次的資料夾（要在按鈕事件裡呼叫，瀏覽器會問一次權限）
export async function resume() {
  if (!folder.saved) return connect();
  if (await ensurePermission(folder.saved)) {
    folder.root = folder.saved;
    await refresh();
  }
}

export async function refresh() {
  if (folder.root) folder.master = await readMaster(folder.root);
  emit();
}

// 存檔前呼叫：確保有資料夾可以寫；不支援資料夾存取就回 null（改用下載）
export async function requireFolder() {
  if (folder.root) return folder.root;
  if (!support.fs) return null;
  if (folder.saved) await resume();
  else await connect();
  return folder.root;
}

// 素材資料夾裡已經有哪些東西（給清單和存檔前的覆蓋確認用）
export function has(kind, id) {
  const m = folder.master;
  if (!m) return false;
  const list = { anim: m.anims, background: m.backgrounds, icon: m.icons, item: m.items, sound: m.sounds }[kind];
  return !!list && list.some((x) => x.id === id);
}
