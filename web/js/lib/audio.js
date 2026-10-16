// 音訊處理：任何瀏覽器讀得懂的音檔 → 指定取樣率的單聲道 Float32Array。

// 解碼並轉成單聲道、指定取樣率
export async function decodeToMono(fileOrBuffer, rate) {
  const data = fileOrBuffer instanceof ArrayBuffer ? fileOrBuffer : await fileOrBuffer.arrayBuffer();
  const probe = new OfflineAudioContext(1, 1, rate);
  const decoded = await probe.decodeAudioData(data);
  const length = Math.max(1, Math.ceil(decoded.duration * rate));
  const ctx = new OfflineAudioContext(1, length, rate);   // 單聲道輸出，立體聲會自動混成一聲道
  const src = ctx.createBufferSource();
  src.buffer = decoded;
  src.connect(ctx.destination);
  src.start();
  const out = await ctx.startRendering();
  return out.getChannelData(0).slice();
}

// 去掉頭尾的安靜段落，保留一點點緩衝避免聲音被切得太突然
export function trimSilence(samples, rate, { threshold = 0.01, padMs = 20 } = {}) {
  let a = 0;
  let b = samples.length - 1;
  while (a < b && Math.abs(samples[a]) < threshold) a++;
  while (b > a && Math.abs(samples[b]) < threshold) b--;
  const pad = Math.round((rate * padMs) / 1000);
  return samples.slice(Math.max(0, a - pad), Math.min(samples.length, b + pad + 1));
}

// 把最大音量調到 peak（避免每個音效大小聲差很多）
export function normalize(samples, peak = 0.89) {
  let max = 0;
  for (const s of samples) max = Math.max(max, Math.abs(s));
  if (max < 1e-4) return samples;
  const k = peak / max;
  return samples.map((s) => s * k);
}
