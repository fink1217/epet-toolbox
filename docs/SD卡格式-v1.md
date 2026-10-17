# SD 卡格式 v1（草案）

這份格式是**學員素材**和**韌體**之間的約定。打包器照這份格式寫入 SD 卡，韌體照這份格式讀取。

> 規則：v1 一旦有學員開始使用，就**只能新增、不能修改或刪除**。韌體遇到不認得的欄位一律忽略；遇到 `format` 比自己支援的版本還新，就在螢幕上顯示「請更新韌體」。
> 韌體完成之前，v1 還可以調整。

詞彙表（動作、背景、圖示、音效的 id）定義在 `web/js/data/vocab.js`。

## 目錄結構

```
SD 卡根目錄/
└── pet/
    ├── text.json                 介面文字（UTF-8），所有螢幕共用
    ├── sfx/<id>.wav              音效：PCM 16-bit、單聲道、22050 Hz，所有螢幕共用
    └── <寬>x<高>/                每種螢幕一個資料夾，例如 172x320
        ├── manifest.json
        ├── bg/<id>.jpg           背景：剛好 寬×高，baseline JPEG（不能是 progressive）
        ├── anim/<id>/000.qoi     角色動畫幀：QOI，已經裁掉透明邊
        ├── icon/<id>.qoi         選單圖示：QOI
        ├── item/<id>.qoi         道具：QOI
        └── font.bin              點陣字型：只包含 text.json 用到的字
```

- 所有檔名都是英文小寫、數字、底線；不會出現中文（ESP32 的 FAT 檔案系統對中文檔名支援不穩）。
- 韌體只讀「跟自己螢幕尺寸一樣」的資料夾，**不做任何縮放**。找不到就顯示「這張卡沒有 172x320 的素材，請重新打包」。

## manifest.json

```json
{
  "format": 1,
  "generator": "PENG! 0.1",
  "screen": { "w": 172, "h": 320 },
  "anchor": { "x": 86, "y": 282 },
  "backgrounds": { "day": "bg/day.jpg" },
  "anims": {
    "idle": {
      "fps": 6,
      "loop": true,
      "frames": [ { "file": "anim/idle/000.qoi", "dx": -52, "dy": -131 } ]
    }
  },
  "icons": { "feed": { "file": "icon/feed.qoi" } },
  "items": { "food": { "file": "item/food.qoi" } },
  "sounds": { "eat": "../sfx/eat.wav" },
  "font": { "file": "font.bin", "px": 16 }
}
```

- `anchor`：角色腳底中心在螢幕上的位置。
- 每一幀畫在 `(anchor.x + dx, anchor.y + dy)`，這是裁切後圖片的左上角。寬高從 QOI 檔頭讀。
  韌體要讓角色走動時，只要改 anchor，不用重算任何東西。
- 整張透明的幀（例如刻意留白的一格）存成 1×1 的透明 QOI，`dx`、`dy` 都是 0，照常畫就好，不需要特判。
- 缺少的項目一律套用同一條規則，不做個別特判：

| 缺少 | 韌體怎麼做 |
|---|---|
| 某個動作 | 改播 `idle`（`idle` 是必要的） |
| 某個背景 | 改用 `day`（`day` 是必要的） |
| 某個圖示 | 顯示 `text.json` 裡的文字 |
| 某個道具 | 不畫 |
| 某個音效 | 不出聲 |

## QOI

標準 QOI 格式（https://qoiformat.org），RGBA 4 通道。韌體解碼後轉成 RGB565 並依照 alpha 跟背景混色。

## font.bin（小端序）

| 位移 | 長度 | 內容 |
|---|---|---|
| 0 | 4 | 魔術字 `EPF1` |
| 4 | 2 | px：字型大小 |
| 6 | 2 | lineHeight：行高 |
| 8 | 2 | ascent：基線到行頂的距離 |
| 10 | 2 | glyphCount：字數 |
| 12 | 4 | bitmapOffset：點陣資料起點（從檔頭算） |
| 16 | 16 × glyphCount | 字表，依 codepoint 由小到大排序（可二分搜尋） |
| bitmapOffset | … | 點陣資料 |

每個字表項目 16 bytes：

| 位移 | 長度 | 內容 |
|---|---|---|
| 0 | 4 | codepoint（Unicode） |
| 4 | 4 | 點陣資料位移（從 bitmapOffset 算） |
| 8 | 1 | w：點陣寬 |
| 9 | 1 | h：點陣高 |
| 10 | 1 | xoff（有號）：點陣左上角相對畫筆位置 |
| 11 | 1 | yoff（有號）：點陣左上角相對基線（通常是負數） |
| 12 | 1 | advance：畫完這個字，畫筆往右移幾點 |
| 13 | 3 | 保留，填 0 |

點陣：每點 4 bit 灰階（0 = 透明、15 = 全不透明），逐列由上到下，每列從左到右、高 4 位元在前，每列補滿到整數 byte。

## text.json

```json
{
  "format": 1,
  "name": "小黃",
  "menu": { "feed": "餵食", "play": "玩耍", "sleep": "睡覺", "status": "狀態", "settings": "設定" },
  "stat": { "hunger": "飽足", "mood": "心情", "energy": "體力", "age": "年齡", "days": "天" },
  "lines": { "hungry": ["肚子好餓…", "想吃東西"] },
  "ui": { "yes": "好", "no": "不要", "back": "返回", "volume": "音量", "brightness": "亮度" }
}
```

預設值見 `vocab.js` 的 `DEFAULT_TEXTS`；學員改過的部分來自素材資料夾的 `寵物.json`。

## 版面規則

打包器依螢幕尺寸計算版面（`vocab.js` 的 `layoutFor`），韌體不做任何版面計算：

| 項目 | 規則 |
|---|---|
| 角色畫布邊長 | min(寬 × 0.85, 高 × 0.55)，1024 的母檔畫布等比例縮到這個大小 |
| 腳底位置 | (寬 / 2, 高 × 0.88) |
| 圖示邊長 | 短邊 × 0.22 |
| 道具邊長 | 短邊 × 0.35 |
| 字型大小 | 短邊 / 11，限制在 14–28 px |
