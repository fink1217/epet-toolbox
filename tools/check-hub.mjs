// 驗證小電路板配置：每個網路該連的都連上、不該連的沒有短路、零件擺得進去。
// 每一種配置（觸控／旋鈕 × 裸馬達／馬達模組）都各驗一次；有換料版（alt）的配置，換料後再驗一次。
// 用法：node tools/check-hub.mjs
import { HUB, HUB_NETS, LEAD_SPAN, STEP_ONLY, withAlt } from '../web/js/data/hub.js';
import { VERSIONS, featuresOf, included } from '../web/js/data/boards.js';

const key = ([x, y]) => x + ',' + y;
const inGrid = ([x, y]) => x >= 0 && x < HUB.cols && y >= 0 && y < HUB.rows;
const dist = (u, v) => Math.abs(u[0] - v[0]) + Math.abs(u[1] - v[1]);

function check(features, hub) {
  const errors = [];
  const has = (item) => included(item, features);
  const parts = hub.parts.filter(has);
  const pads = hub.pads.filter(has);
  const traces = hub.traces.filter(has);
  const jumpers = hub.jumpers.filter(has);

  // 並查集：孔與孔之間的電氣連通
  const parent = new Map();
  const find = (k) => {
    if (!parent.has(k)) parent.set(k, k);
    while (parent.get(k) !== k) k = parent.get(k);
    return k;
  };
  const union = (a, b) => parent.set(find(a), find(b));

  // 每個孔只能插一樣東西（零件腳或外部線）
  const occupant = new Map();
  const place = (hole, who) => {
    if (!inGrid(hole)) errors.push(who + ' 在板子外面：' + key(hole));
    const k = key(hole);
    if (occupant.has(k)) errors.push('孔 ' + k + ' 同時插了 ' + occupant.get(k) + ' 和 ' + who);
    occupant.set(k, who);
    find(k);
  };

  const bodies = [];
  for (const p of parts) {
    for (const [pin, hole] of Object.entries(p.pins)) place(hole, p.id + '.' + pin);
    const holes = Object.values(p.pins);
    if (p.kind === 'to92') {
      // 依 pinout（實際由左到右的腳位順序）檢查：三支腳要相鄰排成一直線
      const keys = (p.pinout || '').toLowerCase().split('');
      if (keys.length !== 3 || keys.some((k) => !p.pins[k])) { errors.push(p.id + ' 的 pinout 跟 pins 對不上'); continue; }
      const [a, b, c] = keys.map((k) => p.pins[k]);
      if (dist(a, b) !== 1 || dist(b, c) !== 1 || (a[0] !== c[0] && a[1] !== c[1]))
        errors.push(p.id + ' 三支腳沒有照 ' + p.pinout + ' 的順序排成相鄰的一直線');
      continue;
    }
    const [a, b] = holes;
    const span = dist(a, b);
    if (a[0] !== b[0] && a[1] !== b[1]) errors.push(p.id + ' 斜放了');
    if (span !== LEAD_SPAN[p.kind]) errors.push(p.id + ' 腳距 ' + span + ' 孔，應該是 ' + LEAD_SPAN[p.kind]);
    // 臥式零件的本體蓋住中間的孔
    const dx = Math.sign(b[0] - a[0]), dy = Math.sign(b[1] - a[1]);
    for (let i = 1; i < span; i++) bodies.push([p.id, key([a[0] + dx * i, a[1] + dy * i])]);
  }
  for (const pad of pads) place(pad.hole, pad.id);
  for (const [id, k] of bodies)
    if (occupant.has(k)) errors.push(id + ' 的本體壓在孔 ' + k + ' 上，但那裡插了 ' + occupant.get(k));

  // 錫橋：逐孔連起來
  for (const t of traces) {
    for (let i = 1; i < t.path.length; i++) {
      const a = t.path[i - 1], b = t.path[i];
      if (a[0] !== b[0] && a[1] !== b[1]) { errors.push('錫橋 ' + t.net + ' 有斜線段'); continue; }
      if (!inGrid(a) || !inGrid(b)) errors.push('錫橋 ' + t.net + ' 超出板子');
      const dx = Math.sign(b[0] - a[0]), dy = Math.sign(b[1] - a[1]);
      let x = a[0], y = a[1];
      while (x !== b[0] || y !== b[1]) { union(key([x, y]), key([x + dx, y + dy])); x += dx; y += dy; }
    }
  }
  for (const j of jumpers) union(key(j.a), key(j.b));

  // 每個端點所在的孔（只算這個配置裡有的）
  const where = new Map();
  for (const p of parts) for (const [pin, hole] of Object.entries(p.pins)) where.set(p.id + '.' + pin, key(hole));
  for (const pad of pads) where.set(pad.id, key(pad.hole));

  // 所有配置加起來出現過的名字：用來分辨「這個配置沒有」和「打錯字」
  const known = new Set([
    ...HUB.parts.flatMap((p) => Object.keys(p.pins).map((pin) => p.id + '.' + pin)),
    ...HUB.pads.map((p) => p.id),
  ]);

  // 網路內要連通；不同網路之間不能連通
  const roots = {};
  for (const [net, all] of Object.entries(HUB_NETS)) {
    for (const m of all) if (!known.has(m)) errors.push('網路 ' + net + ' 的成員 ' + m + ' 不存在（打錯字？）');
    const members = all.filter((m) => where.has(m));
    if (!members.length) continue;           // 這個配置沒有這個網路（例如模組版沒有 C）
    const rs = new Set(members.map((m) => find(where.get(m))));
    if (rs.size > 1) errors.push('網路 ' + net + ' 斷開了：' + members.map((m) => m + '@' + where.get(m)).join('、'));
    roots[net] = [...rs][0];
  }
  const nets = Object.keys(roots);
  for (let i = 0; i < nets.length; i++)
    for (let j = i + 1; j < nets.length; j++)
      if (roots[nets[i]] === roots[nets[j]]) errors.push('短路！' + nets[i] + ' 和 ' + nets[j] + ' 連在一起');

  const listed = new Set(Object.values(HUB_NETS).flat());
  for (const m of where.keys()) if (!listed.has(m)) errors.push(m + ' 沒有出現在任何網路裡');

  for (const t of traces)
    if (roots[t.net] !== find(key(t.path[0]))) errors.push('錫橋標成 ' + t.net + '，實際卻不在 ' + t.net + ' 網路上');

  return { errors, parts: parts.length, pads: pads.length, nets: nets.length };
}

// 換料版的整塊板子
const ALT_HUB = { ...HUB, parts: HUB.parts.map(withAlt), traces: HUB.traces.map(withAlt) };
const altNames = HUB.parts.filter((p) => p.alt).map((p) => p.id + ' 換 ' + p.alt.value).join('、');
const usesAlt = (features) => [...HUB.parts, ...HUB.traces].some((x) => x.alt && included(x, features));

// 所有配置：兩種操作 × 兩種馬達（不只檢查現在兩個版本用到的組合）
const inputs = [...new Set(Object.values(VERSIONS).map((v) => v.input))];
const motors = [...new Set(Object.values(VERSIONS).map((v) => v.motor))];
let failed = 0;
for (const input of inputs) {
  for (const motor of motors) {
    const features = featuresOf({ input, motor });
    const runs = [[input + '＋' + motor, HUB]];
    if (usesAlt(features)) runs.push([input + '＋' + motor + '（' + altNames + '）', ALT_HUB]);
    for (const [name, hub] of runs) {
      const r = check(features, hub);
      if (r.errors.length) {
        failed++;
        console.error('✗ ' + name + '：' + r.errors.length + ' 個問題');
        for (const e of r.errors) console.error('  - ' + e);
      } else {
        console.log('✓ ' + name + '：' + r.parts + ' 個零件、' + r.pads + ' 個外部線落點、' + r.nets + ' 個網路，沒有斷路也沒有短路');
      }
    }
  }
}
// 條件步驟上的東西必須帶相同的 only：不然在沒有那一步的配置裡，學員永遠不會被告知要焊它
const all = [
  ...HUB.parts.map((x) => [x.id, x]),
  ...HUB.traces.map((x) => ['錫橋 ' + x.net + ' ' + JSON.stringify(x.path), x]),
  ...HUB.jumpers.map((x) => ['跳線 ' + JSON.stringify([x.a, x.b]), x]),
  ...HUB.pads.map((x) => [x.id, x]),
];
for (const [name, x] of all) {
  const need = STEP_ONLY[x.step];
  if (need && x.only !== need) {
    failed++;
    console.error('✗ ' + name + ' 掛在「' + x.step + '」（只有 ' + need + ' 才有這一步），自己卻是 only=' + (x.only || '全部') + '：其他配置會漏教');
  }
}
if (failed) process.exit(1);
