// 兩個版本、兩塊主板、外接腳位的唯一來源。
// 接線教學、刷韌體、打包器都從這裡讀，改腳位只改這一個檔案。

// 版本：學員在首頁選一次，整個網站都跟著變
export const VERSIONS = {
  product: {
    id: 'product',
    name: '商品版',
    tagline: '觸控螢幕，摸螢幕操作',
    board: 'touch147',
    input: 'touch',
    motor: 'bare',        // 裸 1027 馬達＋自己焊 2SC1815 驅動：體積小，像真正的產品
  },
  personal: {
    id: 'personal',
    name: '自玩版',
    tagline: '旋鈕＋按鍵，轉一轉、按一下',
    // 兩版用同一片主板：韌體只要一個，差別只在有沒有焊 EC11。
    // 想改回無觸控的 1.47B（微雪 #31501），把這裡換成 'lcd147b' 即可，其他頁面會自動跟著變。
    board: 'touch147',
    input: 'encoder',
    motor: 'module',      // 震動馬達模組（GND／VCC／IN）：驅動電路已經做在模組上，跟商品版對照
  },
};

// 主板。header 是「背面朝上（看得到晶片和 SD 卡槽）、USB 朝上」時，左右兩排由上往下的腳位。
// 資料來源：Waveshare 官方腳位圖與原理圖（2026-10-15 核對）。
export const BOARDS = {
  touch147: {
    id: 'touch147',
    name: 'ESP32-S3-Touch-LCD-1.47',
    short: '觸控 1.47 吋',
    screen: { w: 172, h: 320 },
    pcb: { w: 24.55, h: 44.5 },            // mm，含螢幕外框
    rowGap: 17.78,                          // 兩排排針中心距（mm）
    touch: true,
    onboardImu: null,
    header: {
      left: ['VBUS', 'GND', 'IO43', 'IO44', 'RST', 'IO1', 'IO2', 'IO3', 'IO4', 'IO5', 'IO6'],
      right: ['VBAT', 'GND', 'GND', '3V3', 'IO41', 'IO42', 'IO11', 'IO10', 'IO9', 'IO8', 'IO7'],
    },
    // 板子自己用掉的腳（排針上的 IO41/42 是觸控 I2C，可共用但不能拿來當一般腳）
    reserved: { IO41: '觸控 I2C SCL', IO42: '觸控 I2C SDA', IO43: '序列埠 TX', IO44: '序列埠 RX' },
    firmware: 'touch147',
  },
  lcd147b: {
    id: 'lcd147b',
    name: 'ESP32-S3-LCD-1.47B',
    short: '1.47B（無觸控）',
    screen: { w: 172, h: 320 },
    pcb: { w: 20.32, h: 36.37 },
    rowGap: 17.78,
    touch: false,
    onboardImu: 'QMI8658（不使用：兩版統一用外接 GY-291，接線與韌體才會一樣）',
    header: {
      left: ['VBUS', 'GND', '3V3', 'IO0', 'IO2', 'IO3', 'IO4', 'IO5', 'IO6'],
      right: ['IO43', 'IO44', 'VBAT', 'GND', 'IO11', 'IO10', 'IO9', 'IO8', 'IO7'],
    },
    reserved: { IO0: 'BOOT 按鍵', IO43: '序列埠 TX', IO44: '序列埠 RX' },
    firmware: 'lcd147b',
  },
};

// 線的顏色與意義。顏色只是幫人分辨，電不在乎顏色；但整套教材統一，接錯比較看得出來。
export const WIRES = {
  '3V3': { color: '#E5484D', name: '3.3V 電源' },
  GND: { color: '#2B2B2B', name: '地線 GND' },
  VBAT: { color: '#F76B15', name: '電池電源' },
  IO2: { color: '#FFC53D', name: '感壓訊號' },
  IO6: { color: '#3E63DD', name: '馬達開關' },
  IO7: { color: '#30A46C', name: '聲音訊號' },
  AUD: { color: '#30A46C', name: '濾波後的聲音' },
  IO3: { color: '#12A594', name: '旋鈕 A' },
  IO4: { color: '#D6409F', name: '旋鈕 B' },
  IO5: { color: '#8E4EC6', name: '旋鈕按鍵' },
  IO8: { color: '#0090FF', name: '加速度計 SDA' },
  IO9: { color: '#E54666', name: '加速度計 SCL' },
  IO10: { color: '#978365', name: '加速度計 INT1' },
  MOTOR: { color: '#C2410C', name: '馬達線' },
  FSRW: { color: '#A1662F', name: '感壓片線' },
};

// 外接零件接到主板的哪一支腳（兩個版本相同；EC11 只有自玩版）
export const PINMAP = {
  fsr: 'IO2',
  encA: 'IO3',
  encB: 'IO4',
  encSW: 'IO5',
  motor: 'IO6',
  audio: 'IO7',
  imuSDA: 'IO8',
  imuSCL: 'IO9',
  imuINT: 'IO10',
};

// 主板排針直接拉出去的線：主板腳 → 去哪裡
export const BOARD_WIRES = [
  { pin: '3V3', to: '小電路板 3V3', wire: '3V3', step: 'wire-board' },
  { pin: 'GND', to: '小電路板 GND', wire: 'GND', step: 'wire-board' },
  { pin: 'VBAT', to: '小電路板 VBAT', wire: 'VBAT', step: 'wire-board' },
  { pin: 'IO2', to: '小電路板 感壓', wire: 'IO2', step: 'wire-board' },
  { pin: 'IO6', to: '小電路板 馬達', wire: 'IO6', step: 'wire-board' },
  { pin: 'IO7', to: '小電路板 聲音', wire: 'IO7', step: 'wire-board' },
  { pin: 'IO8', to: 'GY-291 SDA', wire: 'IO8', step: 'wire-imu' },
  { pin: 'IO9', to: 'GY-291 SCL', wire: 'IO9', step: 'wire-imu' },
  { pin: 'IO10', to: 'GY-291 INT1', wire: 'IO10', step: 'wire-imu' },
  { pin: 'IO3', to: '旋鈕 CLK', wire: 'IO3', step: 'wire-ec11', only: 'encoder' },
  { pin: 'IO4', to: '旋鈕 DT', wire: 'IO4', step: 'wire-ec11', only: 'encoder' },
  { pin: 'IO5', to: '旋鈕 SW', wire: 'IO5', step: 'wire-ec11', only: 'encoder' },
];

// 一個版本的「配置特徵」：資料裡 only 欄位比對的對象
export function featuresOf(version) {
  return new Set([version.input, version.motor]);
}

// 這個東西在這個配置裡存不存在（沒寫 only 就是都有）
export const included = (item, features) => !item.only || features.has(item.only);

export function boardOf(versionId) {
  return BOARDS[VERSIONS[versionId].board];
}
