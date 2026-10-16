// 資料夾存取（File System Access API）：選資料夾、記住資料夾、讀寫檔案。
// 選過的資料夾 handle 存在 IndexedDB，下次開網頁不用再選（瀏覽器仍會問一次權限）。

const DB_NAME = 'epet-fs';
const STORE = 'handles';

function idb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function idbDo(mode, fn) {
  const db = await idb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const req = fn(tx.objectStore(STORE));
    tx.oncomplete = () => resolve(req && req.result);
    tx.onerror = () => reject(tx.error);
  });
}

// 叫使用者選資料夾，並記在 key 底下
export async function pickFolder(key, { mode = 'readwrite', startIn = 'documents' } = {}) {
  const handle = await window.showDirectoryPicker({ id: key, mode, startIn });
  try { await idbDo('readwrite', (s) => s.put(handle, key)); } catch { /* 記不住也能用 */ }
  return handle;
}

// 上次選過的資料夾（沒有就回 null）
export async function savedFolder(key) {
  try { return (await idbDo('readonly', (s) => s.get(key))) || null; } catch { return null; }
}

// 確認有讀寫權限；沒有就向使用者要（必須在按鈕點擊事件裡呼叫）
export async function ensurePermission(handle, mode = 'readwrite') {
  const opts = { mode };
  if ((await handle.queryPermission(opts)) === 'granted') return true;
  return (await handle.requestPermission(opts)) === 'granted';
}

// '角色/待機' → 子資料夾 handle
export async function getDir(root, path, { create = false } = {}) {
  let dir = root;
  for (const part of path.split('/').filter(Boolean)) {
    dir = await dir.getDirectoryHandle(part, { create });
  }
  return dir;
}

// 寫檔：data 可以是 Blob、ArrayBuffer、TypedArray 或字串
export async function writeFile(root, path, data) {
  const parts = path.split('/').filter(Boolean);
  const name = parts.pop();
  const dir = await getDir(root, parts.join('/'), { create: true });
  const fh = await dir.getFileHandle(name, { create: true });
  const w = await fh.createWritable();
  await w.write(data);
  await w.close();
}

// 讀檔：回傳 File；不存在回 null
export async function readFile(root, path) {
  const parts = path.split('/').filter(Boolean);
  const name = parts.pop();
  try {
    const dir = await getDir(root, parts.join('/'));
    return await (await dir.getFileHandle(name)).getFile();
  } catch {
    return null;
  }
}

export async function readJSON(root, path) {
  const f = await readFile(root, path);
  if (!f) return null;
  try { return JSON.parse(await f.text()); } catch { return null; }
}

export function writeJSON(root, path, obj) {
  return writeFile(root, path, new Blob([JSON.stringify(obj, null, 2) + '\n'], { type: 'application/json' }));
}

// 依「人類的排序」排：2 排在 10 前面
export const naturalCompare = (a, b) => a.localeCompare(b, 'zh-Hant', { numeric: true });

// 列出資料夾內容：[{ name, kind, handle }]
export async function listDir(dir) {
  const out = [];
  for await (const [name, handle] of dir.entries()) {
    if (name.startsWith('.')) continue;
    out.push({ name, kind: handle.kind, handle });
  }
  return out.sort((a, b) => naturalCompare(a.name, b.name));
}

// 刪除檔案或資料夾；不存在就當作成功
export async function removeEntry(root, path, { recursive = true } = {}) {
  const parts = path.split('/').filter(Boolean);
  const name = parts.pop();
  try {
    const dir = await getDir(root, parts.join('/'));
    await dir.removeEntry(name, { recursive });
  } catch (e) {
    if (e.name !== 'NotFoundError') throw e;
  }
}
