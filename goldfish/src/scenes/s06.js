// s06 — 婚礼
// Placeholder: replace draw() with the real scene.
import { W, H, text, rect } from '../lib.js';

export default {
  draw(ctx, lt, info) {
    rect(ctx, 160, 140, W - 320, H - 300, { w: 3, alpha: 0.25 });
    text(ctx, 's06', W / 2, H / 2 - 30, { size: 40, alpha: 0.5 });
    text(ctx, `${lt.toFixed(2)} / ${info.dur.toFixed(2)}`, W / 2, H / 2 + 30, { size: 28, alpha: 0.4 });
  },
};
