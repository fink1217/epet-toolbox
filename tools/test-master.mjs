// 驗證素材資料夾讀取規則（node 直接跑：node tools/test-master.mjs）
import { MemDir } from '../web/js/deploy/memfs.js';
import { writeFile } from '../web/js/lib/fs.js';
import { readMaster } from '../web/js/lib/master.js';

const root = new MemDir('我的電子雞');
const put = (p) => writeFile(root, p, new Uint8Array([1, 2, 3]));
await put('角色/待機/001.png');
await put('角色/待機/010.png');
await put('角色/待機/002.png');
await put('角色/跳舞/001.png');
await put('背景/白天.jpg');
await put('背景/白天.png');
await put('背景/晚上.webp');
await put('音效/吃東西.mp3');
await put('音效/吃東西.wav');
await put('圖示/餵食.png');
await put('圖示/不存在.png');

const m = await readMaster(root);
const fails = [];
const check = (cond, msg) => { if (!cond) fails.push(msg); };
const idle = m.anims.find((a) => a.id === 'idle');
check(idle && idle.frames.map((f) => f.name).join() === '001.png,002.png,010.png', '待機幀要依自然排序：' + idle?.frames.map((f) => f.name));
check(m.backgrounds.length === 2, '背景應該去重成 2 個，實際 ' + m.backgrounds.length);
check(m.backgrounds.find((b) => b.id === 'day')?.path === '背景/白天.png', '白天應該選 png');
check(m.sounds.length === 1 && m.sounds[0].path === '音效/吃東西.wav', '吃東西應該選 wav');
check(m.icons.length === 1, '不認得的圖示要略過');
check(m.missing.length === 0, '必要項目都有，missing 應為空：' + m.missing);
check(m.warnings.some((w) => w.includes('跳舞')), '要提醒不認得的動作');
check(m.warnings.some((w) => w.includes('略過 白天.jpg')), '要提醒重複的背景');
check(m.warnings.some((w) => w.includes('略過 吃東西.mp3')), '要提醒重複的音效');

if (fails.length) { console.error('✗ ' + fails.join('\n✗ ')); process.exit(1); }
console.log('✓ 素材資料夾讀取規則：' + 9 + ' 項檢查通過');
console.log('  warnings:', m.warnings);
