// s05 — placeholder
import { W, H, text, rect } from '../lib.js';
export default {
  draw(ctx, lt, info) {
    rect(ctx, 160, 140, W - 320, H - 300, { w: 3, alpha: 0.25 });
    text(ctx, 's05  ' + lt.toFixed(2), W / 2, H / 2, { size: 40, alpha: 0.5 });
  },
};
