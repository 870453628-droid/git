// s01 — “看缘分吧。” 中国人似乎很喜欢这句话，我起初并未觉得有什么特别。
// A boy and a girl wave goodbye, turn, and walk off into their own frames.
// She looks back once; he doesn't. The ground between the two frames wears away.
import { W, H, COL, lerp, clamp, prog, smooth, keys, ease, path, line, trimPts, camera } from '../lib.js';
import { figure, pose, mixPose, walk, walkPhase, standY, WAVE, HANDS_POCKET } from '../figure.js';
import { frameBox } from '../sets.js';

const GROUND = 830;
const S = 1.18;

export default {
  draw(ctx, lt) {
    const t = Math.max(0, lt);
    // camera eases out a little as the two drift apart
    const z = lerp(1, 0.86, smooth(t, 3.6, 6.6));
    camera(ctx, { x: W / 2, y: 610, z }, () => {
      const spread = 90 * smooth(t, 3.9, 6.6);
      const lf = { x: 150 - spread, w: 400 };
      const rf = { x: W - 150 - 400 + spread, w: 400 };
      const top = 330;

      // ground line: whole at first, then the middle wears away
      const gap = smooth(t, 4.3, 6.4);
      const ground = [[lf.x - 60, GROUND], [W / 2, GROUND + 2], [rf.x + rf.w + 60, GROUND]];
      if (gap < 0.01) path(ctx, ground, { w: 3, seed: 10 });
      else {
        const left = trimPts(ground, 0.5 - 0.27 * gap);
        const right = trimPts(ground, 1, 0.5 + 0.27 * gap);
        if (left) path(ctx, left, { w: 3, seed: 10 });
        if (right) path(ctx, right, { w: 3, seed: 11 });
      }

      // their frames
      frameBox(ctx, lf.x, top, lf.w, GROUND - top, { seed: 20 });
      frameBox(ctx, rf.x, top, rf.w, GROUND - top, { seed: 21 });

      drawBoy(ctx, t, lf, spread);
      drawGirl(ctx, t, rf, spread);
    });
  },
};

function walker(t, xs, f, s = S) {
  // xs: [[t, x], ...] keyframes (linear motion between keys)
  const x = keys(t, xs, ease.linear);
  const dist = Math.abs(x - xs[0][1]);
  const moving = xs.some((k, i) => i > 0 && t > xs[i - 1][0] && t < k[0] && k[1] !== xs[i - 1][1]);
  const amt = moving ? 1 : 0;
  return { x, ...walk(walkPhase(dist, s), GROUND, s, amt), f, s };
}

function drawBoy(ctx, t, lf, spread) {
  const home = lf.x + lf.w / 2 + 10;
  // stands at centre-left facing her, waves, turns, walks into his frame
  const startX = 860;
  let p;
  if (t < 1.75) {
    const wave = smooth(t, 0.55, 0.85) * (1 - smooth(t, 1.35, 1.65));
    p = mixPose(pose({ x: startX, s: S, y: standY(GROUND, S), f: 1 }), pose({ x: startX, s: S, y: standY(GROUND, S), f: 1, ...WAVE(t, 8) }), wave);
  } else {
    const w = walker(t, [[1.95, startX], [3.75, home]], -1);
    p = pose(w);
    // turning around: a beat of front view
    if (t < 1.95) p = pose({ x: startX, s: S, y: standY(GROUND, S), view: 'front', aA1: 0.1, aB1: 0.1 });
  }
  if (t > 3.75) {
    // inside the frame: hands in pockets, a small shrug — nothing special
    const shrug = smooth(t, 4.5, 4.8) * (1 - smooth(t, 5.25, 5.6));
    const settle = smooth(t, 3.75, 4.2);
    p = mixPose(pose({ x: home, s: S, y: standY(GROUND, S), f: -1 }), pose({ x: home, s: S, y: standY(GROUND, S) - 3 * shrug, f: -1, ...HANDS_POCKET, lean: -0.05, head: -0.15 * shrug }), settle);
  }
  figure(ctx, p, { id: 1 });
}

function drawGirl(ctx, t, rf) {
  const home = rf.x + rf.w / 2 - 10;
  const startX = 1060;
  let p;
  if (t < 1.75) {
    const wave = smooth(t, 0.3, 0.6) * (1 - smooth(t, 1.4, 1.7));
    p = mixPose(pose({ x: startX, s: S, y: standY(GROUND, S), f: -1 }), pose({ x: startX, s: S, y: standY(GROUND, S), f: -1, ...WAVE(t + 0.4, 7.5) }), wave);
    p.tail = 0.1 * Math.sin(t * 6) * wave;
  } else if (t < 1.95) {
    p = pose({ x: startX, s: S, y: standY(GROUND, S), view: 'front', aA1: 0.1, aB1: 0.1, turn: 0.6 });
  } else {
    // walks right, stops halfway to look back over her shoulder, then goes on
    const xs = [[1.95, startX], [2.95, startX + 260], [3.75, startX + 260], [4.75, home]];
    const w = walker(t, xs, 1);
    p = pose(w);
    p.tail = 0.25 * Math.sin(t * 9) * (t < 2.95 || t > 3.75 ? 1 : 0.2);
    const look = smooth(t, 3.0, 3.2) * (1 - smooth(t, 3.55, 3.75));
    if (look > 0.5) {
      p.f = -1;
      p.head = 0.1;
      p.aA1 = 0.05;
      p.aB1 = -0.05;
    }
    if (t > 4.75) {
      // she ends facing his way for a moment, then turns away
      const back = t > 5.6 ? 1 : -1;
      p = pose({ x: home, s: S, y: standY(GROUND, S), f: back, head: back < 0 ? 0.08 : 0 });
      p.tail = 0.05 * Math.sin(t * 2);
    }
  }
  figure(ctx, p, { id: 2, ponytail: true });
}
