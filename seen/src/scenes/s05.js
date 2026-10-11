// s05 · 43–52 · （脚步）/ 慢慢地，脚步稳了。
// One long side-tracking take, no cuts: he keeps to the left-centre of the
// frame (x ≈ 760) and the road scrolls by. Lit little groups pass on the far
// side (a waving one at ~45.6, a cheering one at ~52, two people idling
// beyond); one lamp swings its beam off its own crowd onto his path
// (46.0–48.1) and he walks straight through the pool while they turn to
// look. His gait eases from short, quick, stiff steps (2.4 steps/s, arms
// still, leaning, head down) to an even walk (1.6 steps/s, full swing,
// upright, head up) — settled by 47.6, before the line at 47.8. The dusk
// lifts a little (dark 0.55 -> 0.48) and the camera pushes in slightly toward
// s06's medium shot.
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
