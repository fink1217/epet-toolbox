// 記憶體裡的「假資料夾」：長得跟 File System Access 的資料夾 handle 一樣。
// 兩個用途：
//   1. 不支援直接讀寫資料夾的瀏覽器：用 <input webkitdirectory> 選資料夾，包成這個，打包流程完全不用改。
//   2. 自動測試：用程式產生的假素材跑完整流程，不需要真的資料夾。

export class MemFile {
  constructor(name, file = new File([], name)) {
    this.kind = 'file';
    this.name = name;
    this.file = file;
  }
  async getFile() { return this.file; }
  async createWritable() {
    const chunks = [];
    return {
      write: async (data) => { chunks.push(data); },
      close: async () => { this.file = new File(chunks, this.name); },
    };
  }
}

export class MemDir {
  constructor(name = '') {
    this.kind = 'directory';
    this.name = name;
    this.children = new Map();
  }
  async getDirectoryHandle(name, { create = false } = {}) {
    const c = this.children.get(name);
    if (c?.kind === 'directory') return c;
    if (c || !create) throw new DOMException(`找不到資料夾 ${name}`, c ? 'TypeMismatchError' : 'NotFoundError');
    const d = new MemDir(name);
    this.children.set(name, d);
    return d;
  }
  async getFileHandle(name, { create = false } = {}) {
    const c = this.children.get(name);
    if (c?.kind === 'file') return c;
    if (c || !create) throw new DOMException(`找不到檔案 ${name}`, c ? 'TypeMismatchError' : 'NotFoundError');
    const f = new MemFile(name);
    this.children.set(name, f);
    return f;
  }
  async removeEntry(name) {
    if (!this.children.delete(name)) throw new DOMException(`找不到 ${name}`, 'NotFoundError');
  }
  async *entries() { yield* this.children.entries(); }
  async queryPermission() { return 'granted'; }
  async requestPermission() { return 'granted'; }
}

// 依路徑放檔案：put(root, '角色/待機/001.png', file)
export async function put(root, path, file) {
  const parts = path.split('/').filter(Boolean);
  const name = parts.pop();
  let dir = root;
  for (const p of parts) dir = await dir.getDirectoryHandle(p, { create: true });
  dir.children.set(name, new MemFile(name, file));
}

// <input webkitdirectory> 的 FileList → MemDir（去掉最外層資料夾名稱）
export async function fromFileList(fileList) {
  const files = [...fileList];
  const top = files[0]?.webkitRelativePath.split('/')[0] || '素材';
  const root = new MemDir(top);
  for (const f of files) {
    const rel = f.webkitRelativePath.split('/').slice(1).join('/');
    if (rel) await put(root, rel, f);
  }
  return root;
}

// 走訪整棵樹：[[路徑, File]]
export async function walk(dir, prefix = '') {
  const out = [];
  for await (const [name, h] of dir.entries()) {
    const p = prefix ? `${prefix}/${name}` : name;
    if (h.kind === 'directory') out.push(...(await walk(h, p)));
    else out.push([p, await h.getFile()]);
  }
  return out;
}
