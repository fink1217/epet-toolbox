// 燒錄：用 Espressif 官方的 esptool-js（瀏覽器版 esptool）透過 Web Serial 把韌體寫進 ESP32-S3。
// esptool-js 0.7.0 的 bundle.js 是 ES module，相依套件都已內嵌，直接從 CDN 載入。
import { md5 } from './md5.js';

const ESPTOOL_URL = 'https://cdn.jsdelivr.net/npm/esptool-js@0.7.0/bundle.js';
const ESPRESSIF_VID = 0x303a;
let esptoolModule = null;
export const loadEsptool = () => (esptoolModule ||= import(ESPTOOL_URL));

// 韌體清單：web/firmware/manifest.json；還沒發佈的版本是 null
export async function fetchBuild(firmwareId) {
  try {
    const res = await fetch('firmware/manifest.json', { cache: 'no-cache' });
    if (!res.ok) return null;
    const m = await res.json();
    return m.builds?.[firmwareId] || null;
  } catch {
    return null;
  }
}

export async function fetchFirmware(build) {
  const res = await fetch(`firmware/${build.file}`, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`下載韌體失敗（${res.status}）`);
  return new Uint8Array(await res.arrayBuffer());
}

export class Flasher {
  constructor(log = () => {}) {
    this.log = log;
    this.transport = null;
    this.loader = null;
  }

  // 跳出瀏覽器的裝置清單 → 連線 → 認晶片
  async connect() {
    const { ESPLoader, Transport } = await loadEsptool();
    const port = await navigator.serial.requestPort({ filters: [{ usbVendorId: ESPRESSIF_VID }] });
    // ESP32-S3 內建 USB：鮑率沒有意義，設成跟 ROM 一樣，省掉中途重開序列埠
    const native = port.getInfo().usbVendorId === ESPRESSIF_VID;
    this.transport = new Transport(port, false);
    const term = { clean() {}, writeLine: (s) => this.log(s), write: (s) => this.log(s) };
    this.loader = new ESPLoader({
      transport: this.transport,
      baudrate: native ? 115200 : 921600,
      romBaudrate: 115200,
      terminal: term,
    });
    const description = await this.loader.main();
    let flashSize;
    try { flashSize = await this.loader.detectFlashSize(); } catch { flashSize = undefined; }
    const name = this.loader.chip.CHIP_NAME;
    return { name, description, flashSize, isS3: name === 'ESP32-S3' };
  }

  // 寫入合併好的單一 bin，寫完用 MD5 比對，再硬重置讓新程式開始跑
  async flash(data, address = 0, onProgress = () => {}) {
    await this.loader.writeFlash({
      fileArray: [{ data, address }],
      flashMode: 'keep',
      flashFreq: 'keep',
      flashSize: 'keep',
      eraseAll: false,
      compress: true,
      reportProgress: (_i, written, total) => onProgress(total ? written / total : 0),
      calculateMD5Hash: md5,
    });
    await this.loader.after('hard_reset');
  }

  async disconnect() {
    try { await this.transport?.disconnect(); } catch { /* 已經斷了 */ }
    this.transport = null;
    this.loader = null;
  }
}

// 錯誤翻成人話：{ title, tips[] }
export function explainError(e) {
  const msg = String(e?.message || e);
  if (e?.name === 'NotFoundError' || /No port selected/i.test(msg)) {
    return {
      title: '沒有選到裝置',
      tips: ['清單是空的？換一條「能傳資料」的 USB 線（有些線只能充電）', '按住主板的 BOOT 鍵再插上 USB，放開後再按一次「連接」'],
    };
  }
  if (e?.name === 'NetworkError' || e?.name === 'InvalidStateError' || /open|busy|in use/i.test(msg)) {
    return {
      title: '裝置被其他程式佔用了',
      tips: ['關掉 Arduino IDE 的序列埠監視器，或其他開著這個 COM 埠的程式', '拔掉 USB 再插回去，重新按「連接」'],
    };
  }
  if (e?.name === 'SecurityError') {
    return { title: '瀏覽器不允許連接 USB', tips: ['請用電腦版 Chrome 或 Edge 開這個網頁（網址要是 https）'] };
  }
  if (/timeout|Failed to connect|sync/i.test(msg) || e?.name === 'TimeoutError') {
    return {
      title: '連上了，但戲台沒有回應',
      tips: ['按住 BOOT 鍵 → 按一下 RST 鍵 → 放開 BOOT，讓它進入燒錄模式後再試', '還是不行就拔掉 USB，按住 BOOT 再插上'],
    };
  }
  return { title: '發生錯誤', tips: [msg] };
}
