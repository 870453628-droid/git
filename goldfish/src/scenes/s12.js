// s12 — 遗忘 (63.6–69.0, "再被人所遗忘"; the end)
// 那些小框一个接一个褪掉，作坊的线也散了，纸上只剩那一点金。金光慢慢暗下去，最后只剩
// 一张暖灰色的纸。
//
// The same shot as s11 continues without a cut: memory() in s11.js times the
// forgetting too —
//   63.85–65.7  the memory frames fade one after another (her in the
//               doorway, where it began, is the last to go)
//   64.6–66.15  the workshop's lines break into dashes and drift away
//   66.35       a last glint; the fish is alone on the paper
//   66.2–67.0   its own ink comes apart: only the gold is left
//   66.55–68.25 the gold dims and is gone, with the music (fade 66.9–68.4)
//   68.25–69.0  bare warm-grey paper
import { memory } from './s11.js';

export default {
  fadeIn: 0, // continues s11's shot exactly
  draw(ctx, lt, info) {
    if (info.t > 68.3) return; // bare warm-grey paper
    memory(ctx, info.t);
  },
};
