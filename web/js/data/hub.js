// 小電路板（配電中心＋馬達驅動＋感壓分壓＋音訊濾波）的焊接配置。
// 這份資料是唯一來源：網頁插圖由它畫出來，tools/check-hub.mjs 用它驗證每條線的電路是否正確。
//
// 座標：[x, y]，x 往右 0..13、y 往下 0..8，都是「正面（零件面）往下看」的孔位。
// 單面洞洞板：每個孔各自獨立，靠背面的錫橋（traces）連起來。
//
// step 欄位對應接線步驟的 id：用來決定「這一步新出現哪些東西」。
// only 欄位：只有某種配置才有的東西（'encoder' 旋鈕、'bare' 裸馬達自己焊驅動、'module' 震動馬達模組）。
// 判斷規則統一用 boards.js 的 included()。

export const HUB = {
  cols: 14,
  rows: 9,

  // 零件：每支腳插在哪個孔
  parts: [
    { id: 'R2', kind: 'resistor', name: '下拉電阻', role: '開機那一瞬間把馬達訊號拉到 0V，馬達才不會亂震。',
      value: '10kΩ', bands: ['brown', 'black', 'orange', 'gold'],
      pins: { a: [2, 3], b: [6, 3] }, step: 'hub-resistors' },
    { id: 'R1', kind: 'resistor', name: '限流電阻', role: '限制 IO6 送出去的電流，保護主板的腳。',
      value: '1kΩ', bands: ['brown', 'black', 'red', 'gold'],
      pins: { a: [2, 4], b: [6, 4] }, step: 'hub-resistors' },
    // pinout：平面朝自己、腳朝下時，由左到右的腳位。2SC1815 是 ECB。
    // pins 依實際由左到右的順序寫；flat 是平面朝向（south＝朝第 9 列）。
    // alt：換料版。S8050 插同樣三個孔，但中間那支是 B，所以 B、C 兩條錫橋也帶 alt 改道；電阻、二極體都不用換。
    { id: 'Q1', kind: 'to92', name: '電晶體（馬達開關）', role: 'IO6 只要給幾 mA 的小電流，就能開關馬達 80–120mA 的大電流。',
      value: '2SC1815', pinout: 'ECB', flat: 'south',
      pins: { e: [5, 5], c: [6, 5], b: [7, 5] }, step: 'hub-transistor', only: 'bare',
      alt: { value: 'S8050', pinout: 'EBC', pins: { e: [5, 5], b: [6, 5], c: [7, 5] } } },
    { id: 'D1', kind: 'diode', name: '二極體（洩壓閥）', role: '馬達斷電時會反衝出高電壓，從這裡繞回馬達自己消化，保護電晶體。',
      value: '1N4148',
      pins: { k: [8, 0], a: [8, 4] }, step: 'hub-diode', only: 'bare' },
    { id: 'C1', kind: 'ecap', name: '穩壓電容（小水塔）', role: '馬達啟動那一瞬間先頂住 3V3，主板才不會掉電重開機。',
      value: '100µF',
      pins: { p: [11, 0], n: [11, 1] }, step: 'hub-cap' },
    { id: 'R3', kind: 'resistor', name: '感壓分壓電阻', role: '跟感壓片串在一起，把「壓多大力」變成 IO2 量得到的電壓。',
      value: '10kΩ', bands: ['brown', 'black', 'orange', 'gold'],
      pins: { a: [11, 4], b: [11, 8] }, step: 'hub-fsr' },
    { id: 'R4', kind: 'resistor', name: '聲音濾波電阻', role: '跟 C2 一起，把 IO7 每秒上百萬次的開關磨平成聲音。',
      value: '220Ω', bands: ['red', 'red', 'brown', 'gold'],
      pins: { a: [13, 2], b: [13, 6] }, step: 'hub-audio' },
    { id: 'C2', kind: 'ccap', name: '聲音濾波電容', role: '跟 R4 一起，把 IO7 每秒上百萬次的開關磨平成聲音。',
      value: '100nF（104）', code: '104',
      pins: { a: [12, 7], b: [12, 8] }, step: 'hub-audio' },
  ],

  // 背面錫橋：path 是一串轉折點，相鄰兩點必須同一行或同一列
  traces: [
    { net: '3V3', path: [[0, 0], [11, 0]], step: 'hub-rails' },
    { net: 'GND', path: [[0, 1], [11, 1]], step: 'hub-rails' },
    { net: 'GND', path: [[0, 8], [12, 8]], step: 'hub-rails' },
    { net: 'VBAT', path: [[1, 6], [3, 6]], step: 'hub-rails' },
    { net: 'GND', path: [[2, 3], [2, 1]], step: 'hub-resistors' },
    { net: 'IO6', path: [[1, 4], [2, 4]], step: 'hub-resistors' },
    { net: 'B', path: [[6, 3], [6, 4]], step: 'hub-resistors' },
    // 從 G5 接出去：裸馬達版繞到電晶體 B 腳（H6）；模組版接模組 IN 的落點（G6）。哪一步焊取決於配置。
    { net: 'B', path: [[6, 4], [7, 4], [7, 5]], step: 'hub-transistor', only: 'bare', alt: { path: [[6, 4], [6, 5]] } },
    { net: 'B', path: [[6, 4], [6, 5]], step: 'hub-resistors', only: 'module' },
    { net: 'GND', path: [[5, 5], [5, 8]], step: 'hub-transistor', only: 'bare' },
    // 集極 C 在中間（G6），往下繞第 7 列到馬達落點 J6，再分一支上去接二極體 I5
    { net: 'C', path: [[6, 5], [6, 6], [9, 6], [9, 5]], step: 'hub-diode', only: 'bare', alt: { path: [[7, 5], [7, 6], [9, 6], [9, 5]] } },
    { net: 'C', path: [[8, 6], [8, 4]], step: 'hub-diode', only: 'bare' },
    { net: 'FSR', path: [[10, 3], [11, 3], [11, 4]], step: 'hub-fsr' },
    { net: 'IO7', path: [[13, 1], [13, 2]], step: 'hub-audio' },
    { net: 'AUD', path: [[13, 6], [13, 7], [12, 7]], step: 'hub-audio' },
  ],

  // 絕緣跳線：把上下兩條 GND 軌接起來。side：'back' 走在背面（跟電源軌同一步，不用翻面）
  jumpers: [
    { net: 'GND', a: [0, 1], b: [0, 8], step: 'hub-rails', side: 'back' },
  ],

  // 外部線的落點：線從正面插進這個孔再焊
  pads: [
    { id: 'board-3v3', hole: [1, 0], label: '主板 3V3', wire: '3V3', step: 'wire-board' },
    { id: 'board-gnd', hole: [1, 1], label: '主板 GND', wire: 'GND', step: 'wire-board' },
    { id: 'board-vbat', hole: [1, 6], label: '主板 VBAT', wire: 'VBAT', step: 'wire-board' },
    { id: 'board-io6', hole: [1, 4], label: '主板 IO6', wire: 'IO6', step: 'wire-board' },
    { id: 'board-io2', hole: [10, 3], label: '主板 IO2', wire: 'IO2', step: 'wire-board' },
    { id: 'motor-1', hole: [9, 0], label: '馬達線', wire: 'MOTOR', step: 'wire-motor', only: 'bare' },
    { id: 'motor-2', hole: [9, 5], label: '馬達線', wire: 'MOTOR', step: 'wire-motor', only: 'bare' },
    { id: 'mod-vcc', hole: [9, 0], label: '模組 VCC', wire: '3V3', step: 'wire-motor', only: 'module' },
    { id: 'mod-gnd', hole: [9, 8], label: '模組 GND', wire: 'GND', step: 'wire-motor', only: 'module' },
    { id: 'mod-in', hole: [6, 5], label: '模組 IN', wire: 'IO6', step: 'wire-motor', only: 'module' },
    { id: 'fsr-1', hole: [10, 0], label: '感壓片', wire: 'FSRW', step: 'wire-fsr' },
    { id: 'fsr-2', hole: [11, 3], label: '感壓片', wire: 'FSRW', step: 'wire-fsr' },
    { id: 'board-io7', hole: [13, 1], label: '主板 IO7', wire: 'IO7', step: 'wire-board' },
    { id: 'amp-v', hole: [3, 6], label: '功放 V', wire: 'VBAT', step: 'wire-amp' },
    { id: 'amp-g', hole: [3, 8], label: '功放 G', wire: 'GND', step: 'wire-amp' },
    { id: 'amp-s', hole: [13, 7], label: '功放 S', wire: 'AUD', step: 'wire-amp' },
    { id: 'imu-vcc', hole: [6, 0], label: 'GY-291 VCC', wire: '3V3', step: 'wire-imu' },
    { id: 'imu-gnd', hole: [6, 1], label: 'GY-291 GND', wire: 'GND', step: 'wire-imu' },
    { id: 'imu-sdo', hole: [7, 1], label: 'GY-291 SDO', wire: 'GND', step: 'wire-imu' },
    { id: 'ec11-vcc', hole: [4, 0], label: '旋鈕 +', wire: '3V3', step: 'wire-ec11', only: 'encoder' },
    { id: 'ec11-gnd', hole: [4, 1], label: '旋鈕 GND', wire: 'GND', step: 'wire-ec11', only: 'encoder' },
    { id: 'batt-p', hole: [2, 6], label: '電池 +', wire: 'VBAT', step: 'wire-battery' },
    { id: 'batt-n', hole: [2, 8], label: '電池 −', wire: 'GND', step: 'wire-battery' },
  ],
};

// 設計意圖：每個網路應該連到哪些東西（零件腳寫成「零件.腳」，外部線寫 pad id）
// 某個配置沒有的東西（only 不符）檢查時自動略過。
export const HUB_NETS = {
  '3V3': ['board-3v3', 'ec11-vcc', 'imu-vcc', 'D1.k', 'motor-1', 'mod-vcc', 'fsr-1', 'C1.p'],
  GND: ['board-gnd', 'ec11-gnd', 'imu-gnd', 'imu-sdo', 'R2.a', 'C1.n', 'batt-n', 'amp-g', 'Q1.e', 'mod-gnd', 'R3.b', 'C2.b'],
  VBAT: ['board-vbat', 'batt-p', 'amp-v'],
  IO6: ['board-io6', 'R1.a'],
  B: ['R1.b', 'R2.b', 'Q1.b', 'mod-in'],
  C: ['Q1.c', 'D1.a', 'motor-2'],
  FSR: ['board-io2', 'fsr-2', 'R3.a'],
  IO7: ['board-io7', 'R4.a'],
  AUD: ['R4.b', 'C2.a', 'amp-s'],
};

// 換料版：有 alt 的東西換成 alt 的內容（目前只有 Q1 換 S8050）。tools/check-hub.mjs 兩版都驗。
export const withAlt = (x) => (x.alt ? { ...x, ...x.alt } : x);

// 零件腳距（孔數）：用來檢查零件有沒有擺成實際插不進去的樣子
export const LEAD_SPAN = { resistor: 4, diode: 4, ecap: 1, ccap: 1 };

// 只有某些配置才有的接線步驟（接線教學依這張表決定步驟清單）。
// 規則：掛在這些步驟上的零件、錫橋、落點，only 必須跟步驟一樣——不然在沒有這一步的配置裡，它永遠不會被教到。
export const STEP_ONLY = {
  'hub-transistor': 'bare',
  'hub-diode': 'bare',
  'wire-ec11': 'encoder',
};
