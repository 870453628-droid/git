// s05 · 43–52 · （脚步）/ 慢慢地，脚步稳了。
// One long side-tracking take, no cuts: he keeps to the left-centre of the
// frame and the road scrolls by. Lit little crowds pass on the far side
// every ~2.6 s; one lamp swings its beam onto his path (45.2–47.9) and he
// walks straight through it. His gait eases from short, quick, stiff steps
// (2.4 steps/s, arms still, leaning, head down) to an even walk (1.6 steps/s,
// full swing, upright, head up) — settled well before 47.8.
//
// This is the same take s04's road part began: the walk, the camera and the
// far side all live in s04.js (gait(), walker(), roadShot(), GROUPS), so the
// switch at 43.0 is invisible (s04 fadeOut 0, s05 fadeIn 0).
import { roadShot } from './s04.js';

export default {
  fadeIn: 0,
  draw(ctx, lt, info) {
    roadShot(ctx, info.start + Math.max(0, lt));
  },
};
