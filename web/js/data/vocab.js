// 素材的「詞彙表」：素材資料夾用中文名字，SD 卡用英文 id，韌體只認 id。
// 生成器、打包器、韌體三方都照這張表；改名字只改這裡，id 一旦發佈就不能改（學員的 SD 卡依賴它）。

export const FORMAT_VERSION = 1;

// 角色動作：資料夾「角色/<中文名>/001.png …」
// 缺少的動作，韌體一律改用「待機」，所以只有待機是必要的。
export const ANIMS = [
  { id: 'idle', zh: '待機', required: true, fps: 6, loop: true, hint: '平常站著、呼吸、眨眼' },
  { id: 'happy', zh: '開心', fps: 8, loop: false, hint: '跳一下、轉圈、愛心眼' },
  { id: 'sad', zh: '難過', fps: 6, loop: true, hint: '垂頭、掉眼淚' },
  { id: 'hungry', zh: '肚子餓', fps: 6, loop: true, hint: '摸肚子、看著你' },
  { id: 'eat', zh: '吃東西', fps: 8, loop: false, hint: '張嘴、咀嚼' },
  { id: 'sleep', zh: '睡覺', fps: 4, loop: true, hint: '閉眼、Zzz' },
  { id: 'play', zh: '玩耍', fps: 10, loop: false, hint: '玩球、跳舞' },
  { id: 'pet', zh: '被摸', fps: 8, loop: false, hint: '輕輕摸一下的反應（感壓片輕壓）' },
  { id: 'hug', zh: '被抱', fps: 8, loop: false, hint: '用力抱的反應（感壓片重壓）' },
  { id: 'sick', zh: '生病', fps: 4, loop: true, hint: '發燒、冒冷汗' },
  { id: 'shake', zh: '被搖', fps: 12, loop: false, hint: '頭暈眼花（GY-291 偵測到搖晃）' },
];

// 背景：資料夾「背景/<中文名>.png」
export const BACKGROUNDS = [
  { id: 'day', zh: '白天', required: true },
  { id: 'night', zh: '晚上' },
];

// 選單圖示：資料夾「圖示/<中文名>.png」。缺少時韌體顯示文字。
export const ICONS = [
  { id: 'feed', zh: '餵食' },
  { id: 'play', zh: '玩耍' },
  { id: 'sleep', zh: '睡覺' },
  { id: 'status', zh: '狀態' },
  { id: 'settings', zh: '設定' },
];

// 道具：資料夾「道具/<中文名>.png」，畫在寵物旁邊
export const ITEMS = [
  { id: 'food', zh: '食物' },
  { id: 'snack', zh: '點心' },
  { id: 'toy', zh: '玩具' },
  { id: 'poop', zh: '便便' },
];

// 音效：資料夾「音效/<中文名>.wav 或 .mp3」。缺少時就是安靜。
export const SOUNDS = [
  { id: 'boot', zh: '開機' },
  { id: 'click', zh: '按鍵' },
  { id: 'happy', zh: '開心' },
  { id: 'eat', zh: '吃東西' },
  { id: 'pet', zh: '被摸' },
  { id: 'hungry', zh: '肚子餓' },
  { id: 'sleep', zh: '睡覺' },
  { id: 'sad', zh: '難過' },
];

// 介面文字的預設值。學員可以在「寵物.json」的 texts 裡覆寫。
export const DEFAULT_TEXTS = {
  name: '小黃',
  menu: { feed: '餵食', play: '玩耍', sleep: '睡覺', status: '狀態', settings: '設定' },
  stat: { hunger: '飽足', mood: '心情', energy: '體力', age: '年齡', days: '天' },
  lines: {
    hello: ['早安！', '你回來了！'],
    hungry: ['肚子好餓…', '想吃東西'],
    happy: ['好開心！', '再來一次！'],
    sleepy: ['好睏…', '晚安'],
    sick: ['不太舒服…'],
  },
  ui: { yes: '好', no: '不要', back: '返回', volume: '音量', brightness: '亮度' },
};

// 母檔規格（學員畫的、生成器存的）
export const MASTER = {
  character: { w: 1024, h: 1024, baseline: 984 },   // 腳底踩在 y=984，水平置中
  background: { w: 1080, h: 1920 },
  icon: { w: 512, h: 512 },
  item: { w: 512, h: 512 },
  soundRate: 44100,
};

// 打包到 SD 卡的輸出規格
export const OUTPUT = {
  soundRate: 22050,          // WAV 16-bit 單聲道
  jpegQuality: 0.88,
};

// 每種螢幕的版面：全部用比例算，換螢幕不用改程式
export function layoutFor(w, h) {
  const short = Math.min(w, h);
  return {
    petBox: Math.round(Math.min(w * 0.85, h * 0.55)),   // 1024 母檔畫布縮成這個邊長
    anchor: { x: Math.round(w / 2), y: Math.round(h * 0.88) },  // 腳底在螢幕上的位置
    icon: Math.round(short * 0.22),
    item: Math.round(short * 0.35),
    fontPx: Math.max(14, Math.min(28, Math.round(short / 11))),
  };
}

// 常見螢幕尺寸（打包器可勾選多種）
export const SCREENS = [
  { w: 172, h: 320, name: '1.47 吋（現在這兩台）' },
  { w: 240, h: 320, name: '2.0–2.8 吋' },
  { w: 320, h: 480, name: '3.5 吋' },
  { w: 240, h: 280, name: '1.69 吋' },
];

// 中文名 → 詞彙項目
export function byZh(list, zh) {
  return list.find((v) => v.zh === zh);
}
