// 用無頭 Chrome 模擬「滑鼠移到某個元素上」再截圖，檢查滑鼠提示與高亮。
// 用法：node tools/hover-shot.mjs <網址> <輸出資料夾> <CSS 選擇器>...
// 每個選擇器各截一張：<輸出資料夾>/hover-1.png、hover-2.png…；同時印出 console 錯誤。
// 選擇器前面加「click:」代表點它一下（例如 click:.figure-tools .side-btn:last-child 打開放大檢視）。
// 環境變數 SHOT_W、SHOT_H 可以改視窗大小。
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const [url, outDir, ...selectors] = process.argv.slice(2);
const W = Number(process.env.SHOT_W || 1280);
const H = Number(process.env.SHOT_H || 1000);
const prof = mkdtempSync(join(tmpdir(), 'hover-'));
const port = 9800 + Math.floor(Math.random() * 150);
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', [
  '--headless=new', '--disable-gpu', '--hide-scrollbars', `--user-data-dir=${prof}`,
  `--remote-debugging-port=${port}`, `--window-size=${W},${H}`, 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let target;
for (let i = 0; i < 60 && !target; i++) {
  await sleep(200);
  try { target = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find((t) => t.type === 'page'); } catch { /* 還沒好 */ }
}
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r));
let id = 0;
const pending = new Map();
const errors = [];
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
  if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push(m.params.args.map((a) => a.value ?? a.description).join(' '));
});
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const evaluate = async (expr) => (await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })).result?.result?.value;

await send('Runtime.enable');
await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url });
// 等到圖畫出來（最多 15 秒），再多等一下讓字型與版面穩定
for (let i = 0; i < 75; i++) {
  if (await evaluate("!!document.querySelector('[data-hole]')")) break;
  await sleep(200);
}
await sleep(800);

let n = 0;
for (const raw of selectors) {
  n++;
  const click = raw.startsWith('click:');
  const sel = click ? raw.slice(6) : raw;
  if (click) {
    const ok = await evaluate(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); if (!el) return false; el.click(); return true; })()`);
    console.log(`${n}. 點 ${sel} → ${ok ? '成功' : '找不到'}`);
    await sleep(800);
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(join(outDir, `hover-${n}.png`), Buffer.from(shot.result.data, 'base64'));
    continue;
  }
  // 先把元素捲進畫面，再取中心點
  const box = await evaluate(`(() => {
    const el = document.querySelector(${JSON.stringify(sel)});
    if (!el) return null;
    el.scrollIntoView({ block: 'center' });
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  })()`);
  if (!box) { console.log(`✗ 找不到 ${sel}`); continue; }
  await sleep(300);
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: box.x - 3, y: box.y - 3 });
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: box.x, y: box.y });
  await sleep(500);
  const state = await evaluate(`(() => {
    const t = document.querySelector('.hover-tip');
    return { tip: t && !t.hidden ? t.innerText.replace(/\\s+/g, ' ') : null,
             lit: document.querySelectorAll('.hl').length, rings: document.querySelectorAll('.hl-ring').length };
  })()`);
  console.log(`${n}. ${sel} → 提示：${state.tip ?? '（沒有）'}｜亮起 ${state.lit} 個、圈 ${state.rings} 個`);
  const shot = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(join(outDir, `hover-${n}.png`), Buffer.from(shot.result.data, 'base64'));
}
if (errors.length) console.log('console 錯誤：\n  ' + errors.join('\n  '));
ws.close();
chrome.kill();
await sleep(300);
try { rmSync(prof, { recursive: true, force: true }); } catch { /* Chrome 可能還鎖著檔案 */ }
