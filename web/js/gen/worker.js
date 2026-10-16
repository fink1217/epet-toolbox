// 背景執行緒：去背＋切幀都在這裡算，主畫面才不會卡住。
import { removeBackground } from './bgremove.js';
import { splitImage } from './split.js';

self.onmessage = (e) => {
  const { id, w, h, data, opts } = e.data;
  try {
    const t0 = performance.now();
    const res = removeBackground(new Uint8ClampedArray(data), w, h, opts);
    const frames = splitImage(res.data, w, h, { single: !!opts.single });
    const transfer = [res.data.buffer, ...frames.map((f) => f.rgba.buffer)];
    self.postMessage({
      id, ok: true, w, h,
      data: res.data.buffer,
      bg: res.bg,
      transparentBg: res.transparentBg,
      frames: frames.map((f) => ({ rgba: f.rgba.buffer, w: f.w, h: f.h, core: f.core, src: f.src })),
      ms: Math.round(performance.now() - t0),
    }, transfer);
  } catch (err) {
    self.postMessage({ id, ok: false, error: String(err && err.message || err) });
  }
};
