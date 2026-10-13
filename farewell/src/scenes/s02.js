// s02 — 直到后来朋友提起她，惋惜地叹道：“你们俩啊，终究是有缘无分，实在太可惜了。”
// Picks up s01's last frame exactly. A friend (spiky tuft, id 3) walks into
// the boy's frame and points across the empty gap at her distant frame; the
// boy turns to look. The friend sighs (a little curl of breath). "你们俩" —
// he points at the boy, then off toward her, and sketches two little frames
// in the air above them; he nudges them together, they strain toward each
// other but stop just short, then drift apart and fade. "实在太可惜了" — a hand
// on the boy's shoulder, two pats, and he leaves. The boy turns back toward
// her side and his head sinks.
//
// The world helpers (frames, ground, her, the boy's base pose, the friend's
// exit walk) are exported so s03 can continue the same shot seamlessly.
import { W, COL, TAU, lerp, clamp, prog, smooth, keys, ease, path, trimPts, camera, ellipsePts } from '../lib.js';
import { figure, pose, mixPose, walk, walkPhase, standY, joints, HANDS_POCKET, BODY } from '../figure.js';
import { frameBox } from '../sets.js';

export const GROUND = 830;
export const S = 1.18;
export const TOP = 330;
export const BOY_X = 270;
const START = 6.3;

// ------------------------------------------------------------ shared world
// Layout of s01 at global time t (it settles at t = 6.6 and stays put).
export function layout(t) {
  const tt = Math.min(t, 6.6);
  const spread = 90 * smooth(tt, 3.9, 6.6);
  return {
    lf: { x: 150 - spread, w: 400 },
    rf: { x: W - 150 - 400 + spread, w: 400 },
    gap: smooth(tt, 4.3, 6.4),
    spread,
  };
}

// s01's camera, so the first frames match it exactly.
export const s01Cam = (t) => ({ x: W / 2, y: 610, z: lerp(1, 0.86, smooth(Math.min(t, 6.6), 3.6, 6.6)) });

// ground + both frames, same seeds as s01 (so the dissolve is invisible)
export function drawWorld(ctx, t, o = {}) {
  const { lf, rf, gap } = layout(t);
  const ground = [[lf.x - 60, GROUND], [W / 2, GROUND + 2], [rf.x + rf.w + 60, GROUND]];
  const left = trimPts(ground, 0.5 - 0.27 * gap);
  const right = trimPts(ground, 1, 0.5 + 0.27 * gap);
  if (o.ghost) {
    // faint trace of the worn-away ground across the gap
    const g = trimPts(ground, 0.5 + 0.27 * gap, 0.5 - 0.27 * gap);
    if (g) path(ctx, g, { w: 2, alpha: 0.16 * o.ghost, dash: [26, 18], seed: 12 });
  }
  if (left) path(ctx, left, { w: 3, seed: 10 });
  if (right) path(ctx, right, { w: 3, seed: 11 });
  frameBox(ctx, lf.x, TOP, lf.w, GROUND - TOP, { seed: 20 });
  frameBox(ctx, rf.x, TOP, rf.w, GROUND - TOP, { seed: 21 });
}

// her, standing in her frame facing away (s01's final pose)
export function drawGirl(ctx, t) {
  const { rf } = layout(t);
  const home = rf.x + rf.w / 2 - 10;
  const p = pose({ x: home, s: S, y: standY(GROUND, S), f: 1, head: 0 });
  p.tail = 0.05 * Math.sin(t * 2);
  figure(ctx, p, { id: 2, ponytail: true });
}

export function boyBase(t) {
  const { lf } = layout(t);
  return pose({ x: lf.x + lf.w / 2 + 10, s: S, y: standY(GROUND, S), ...HANDS_POCKET, lean: -0.05 });
}

// walk along x keyframes [[t, x], ...]; phase follows the distance walked
export function walker(t, xs, s, ground = GROUND) {
  const x = keys(t, xs, ease.linear);
  let dist = 0;
  let amt = 0;
  let f = xs[1][1] >= xs[0][1] ? 1 : -1;
  for (let i = 1; i < xs.length; i++) {
    const [t0, x0] = xs[i - 1];
    const [t1, x1] = xs[i];
    if (x1 === x0) continue;
    const k = prog(t, t0, t1);
    dist += Math.abs(x1 - x0) * k;
    if (t > t0) f = x1 > x0 ? 1 : -1;
    if (t > t0 && t < t1) amt = clamp(Math.min(t - t0, t1 - t) / 0.18);
  }
  return { x, f, s, ...walk(walkPhase(dist, s), ground, s, amt) };
}

// the friend's exit, shared with s03 (global time)
export const FRIEND_EXIT = [[START + 7.1, 158], [START + 8.85, -470]];

// two-bone IK. side view: angles from straight down, + toward facing f.
export function reachSide(root, target, f, s, bend = -1) {
  const ua = BODY.ua * s;
  const la = BODY.la * s;
  const dx = (target[0] - root[0]) * f;
  const dy = target[1] - root[1];
  const d = Math.min(Math.hypot(dx, dy), ua + la - 0.5);
  const th = Math.atan2(dx, dy);
  const al = Math.acos(clamp((ua * ua + d * d - la * la) / (2 * ua * d), -1, 1));
  const a1 = th + bend * al;
  const ex = Math.sin(a1) * ua;
  const ey = Math.cos(a1) * ua;
  const a2 = Math.atan2(dx - ex, dy - ey) - a1;
  return [a1, a2];
}

// little spiky tuft so the friend reads as someone else at a glance
export function tuft(ctx, j, p, o = {}) {
  const side = !p.view || p.view === 'side';
  const hl = j.headAngle;
  const f = side ? p.f : 1;
  const r = j.r;
  for (let i = 0; i < 3; i++) {
    const off = (i - 1) * 0.42 - (side ? 0.25 : 0);
    const a = hl + off * (side ? f : 1);
    const ux = side ? Math.sin(a) * f : Math.sin(a);
    const uy = -Math.cos(a);
    const x0 = j.head[0] + ux * r * 0.95;
    const y0 = j.head[1] + uy * r * 0.95;
    const sl = side ? -f * 0.35 : (i - 1) * 0.3;
    path(ctx, [[x0, y0], [x0 + (ux + sl) * r * 0.42, y0 + uy * r * 0.48]], {
      w: Math.max(2, 3.6 * p.s * 0.85), seed: 3000 + i, wobble: 0.3, alpha: o.alpha,
    });
  }
}


// a one-beat front view, used while a figure turns round
export const frontBeat = (x, y, s, turn = 0, o = {}) =>
  pose({ x, y, s, view: 'front', aA1: 0.1, aA2: 0.15, aB1: 0.1, aB2: 0.15, lA1: 0.1, lB1: 0.1, turn, ...o });

// the boy once the friend has gone: facing her side, head sinking (global t)
export function boyAfter(t) {
  const base = boyBase(t);
  const p = { ...base, f: 1, lean: -0.02, head: -0.1, look: -0.25 };
  const down = smooth(t, START + 7.4, START + 8.7, ease.sine);
  return mixPose(p, { ...p, head: 0.5, lean: 0.1, look: 1, aA2: -0.15 }, down);
}

// ------------------------------------------------------------------ scene
const FRIEND_S = 1.2;
const FX = 110; // where the friend stands

// s02's camera at global time t (s03 continues from it)
export function s02Cam(t) {
  const lt = t - START;
  if (lt < 0.3) return s01Cam(t);
  return keys(lt, [
    [0.3, { x: W / 2, y: 610, z: 0.86 }],
    [1.7, { x: 884, y: 600, z: 1.04 }],
    [3.2, { x: 872, y: 600, z: 1.07 }],
    [4.2, { x: 200, y: 592, z: 1.5 }],
    [6.2, { x: 206, y: 594, z: 1.55 }],
    [7.95, { x: 300, y: 600, z: 1.32 }],
    [8.4, { x: 306, y: 600, z: 1.31 }],
  ], ease.sine);
}

export default {
  draw(ctx, lt, info) {
    const t = info.t;
    const u = Math.max(0, lt);
    const cam = s02Cam(t);

    camera(ctx, cam, () => {
      drawWorld(ctx, t);
      drawGirl(ctx, t);
      drawBoy(ctx, u, t);
      drawFriend(ctx, u, t);
    });
  },
};

// pats on the shoulder: 0..1 dips
const patK = (u) => {
  const k = prog(u, 6.42, 6.86);
  return k > 0 && k < 1 ? Math.max(0, Math.sin(k * TAU * 2)) : 0;
};

// ------------------------------------------------------------------ the boy
function drawBoy(ctx, u, t) {
  const base = boyBase(t);
  let p;
  if (u < 1.42) {
    // facing left, the way s01 left him; lifts his head as the friend comes
    const lift = smooth(u, 0.7, 1.2);
    p = { ...base, f: -1, head: -0.1 * lift, look: -0.1 * lift };
  } else if (u < 1.56) {
    p = frontBeat(base.x, base.y, S, 0.6);
  } else if (u < 3.0) {
    // looks across the gap, where the friend points
    p = { ...base, f: 1, lean: -0.02, head: -0.1, look: -0.25 };
  } else if (u < 3.14) {
    p = frontBeat(base.x, base.y, S, -0.6);
  } else if (u < 7.2) {
    // back to the friend, listening
    p = { ...base, f: -1, lean: -0.02, head: 0, look: 0 };
    // looks up at the little frames the friend sketches in the air
    const watch = smooth(u, 4.35, 4.7) * (1 - smooth(u, 5.6, 6.1));
    p.look = -0.6 * watch;
    p.head = -0.2 * watch;
    const slump = smooth(u, 5.4, 6.0);
    p.y += 3 * slump;
    p.head += 0.12 * slump;
    p.y += 3 * patK(u);
  } else if (u < 7.34) {
    p = frontBeat(base.x, base.y + 3, S, 0.6, { look: 0.6 });
  } else {
    p = boyAfter(t);
    p.y += 3 * (1 - smooth(u, 7.34, 7.8));
  }
  figure(ctx, p, { id: 1 });
}

// --------------------------------------------------------------- the friend
function drawFriend(ctx, u, t) {
  const s = FRIEND_S;
  const sy = standY(GROUND, s);
  const lt = u;
  if (lt < 0.05) return;

  let p;
  let extra = null; // drawn after the figure

  if (lt < 1.05) {
    // walks in from the left
    p = pose(walker(lt, [[0.05, -230], [1.05, FX]], s));
  } else if (lt < 6.1) {
    p = pose({ x: FX, y: sy, s, f: 1 });
    // points across the gap at her frame
    const point = smooth(lt, 1.1, 1.38) * (1 - smooth(lt, 1.95, 2.25));
    p = mixPose(p, { ...p, aA1: 2.5, aA2: 0.05, lean: -0.05, head: -0.22, look: -0.6 }, point);
    // the sigh
    const sigh = smooth(lt, 2.15, 2.7) * (1 - smooth(lt, 3.25, 3.6));
    p = mixPose(p, { ...p, lean: 0.2, head: 0.42, look: 0.8, aA1: 0.02, aA2: 0.04, aB1: -0.02, aB2: 0.04 }, sigh);
    p.y += 6 * sigh;
    if (lt < 3.6) extra = () => sighPuff(ctx, joints(p), p, prog(lt, 2.3, 3.45));
    // "你们俩啊" … the little frames
    if (lt > 3.3) {
      const r = twoFrames(ctx, lt, p, s);
      p = r.p;
      extra = r.extra;
    }
  } else if (lt < 6.97) {
    // a step to the boy and a hand on his shoulder
    const w = walker(lt, [[6.1, FX], [6.32, 158]], s);
    p = pose({ ...w, f: 1 });
    const still = smooth(lt, 6.3, 6.45);
    p.aB1 = lerp(p.aB1, -0.1, still);
    p.aB2 = lerp(p.aB2, 0.15, still);
    const reach = smooth(lt, 6.22, 6.42) * (1 - smooth(lt, 6.84, 6.97));
    p.lean = lerp(p.lean, 0.07, reach);
    p.head = 0.25 * smooth(lt, 6.3, 6.6);
    p.look = 0.5 * smooth(lt, 6.3, 6.6);
    const pr = joints(p);
    const boyHip = standY(GROUND, S);
    const bt = [BOY_X - 8, boyHip - 74 * S + 3 * patK(lt)];
    const [a1, a2] = reachSide(pr.armRoot, bt, 1, s, -1);
    p.aA1 = lerp(p.aA1, a1, reach);
    p.aA2 = lerp(p.aA2, a2, reach);
  } else if (lt < 7.1) {
    p = frontBeat(158, sy, s, -0.6, { look: 0.4 });
  } else {
    p = pose(walker(t, FRIEND_EXIT, s));
    p.head = 0.12;
    p.look = 0.3;
  }
  figure(ctx, p, { id: 3 });
  tuft(ctx, joints(p), p);
  if (extra) extra();
}

// the sigh: a little curl of breath drifting down from his mouth
function sighPuff(ctx, j, p, k) {
  if (k <= 0 || k >= 1) return;
  const s = p.s;
  const a = j.headAngle;
  const fx = Math.cos(a) * p.f;
  const fy = Math.sin(a);
  const x0 = j.head[0] + fx * j.r * 1.2;
  const y0 = j.head[1] + fy * j.r * 1.2 + j.r * 0.4;
  const drift = 10 * s * k;
  const pts = [];
  const n = 18;
  for (let i = 0; i <= n; i++) {
    const v = i / n;
    const xx = v * 34 * s;
    const yy = Math.sin(v * Math.PI * 1.5) * 5 * s + v * 16 * s;
    pts.push([x0 + p.f * (xx + drift), y0 + yy + drift * 0.6]);
  }
  // end in a small curl
  const [ex, ey] = pts[n];
  const rr = 7 * s;
  for (let i = 1; i <= 12; i++) {
    const a2 = Math.PI / 2 - (i / 12) * TAU * 0.85;
    pts.push([ex + p.f * (Math.cos(a2) * rr), ey - rr + Math.sin(a2) * rr]);
  }
  const drawK = smooth(k, 0, 0.45);
  const alpha = 0.75 * (1 - smooth(k, 0.55, 1));
  path(ctx, pts, { w: 2.6, alpha, draw: drawK, seed: 3100, wobble: 0.7 });
}

// "你们俩啊，终究是有缘无分": he points at the boy, then off toward her; then
// sketches two little frames in the air above them and nudges them together —
// they strain toward each other but stop just short, then drift apart.
const SQ = { h: 24, y: 428, mid: 190, d0: 54, d1: 35 };

function sqHalf(lt) {
  const h = keys(lt, [[4.9, SQ.d0], [5.36, SQ.d1], [5.66, SQ.d1], [6.25, 60]], ease.inOut);
  // straining toward each other where they stop short
  const strain = Math.sin(prog(lt, 5.36, 5.66) * Math.PI);
  return h - strain * 1.6 * (0.5 + 0.5 * Math.sin((lt - 5.36) * 70));
}

function twoFrames(ctx, lt, p0, s) {
  const p = { ...p0 };
  const half = sqHalf(lt);
  const lift = -8 * smooth(lt, 5.6, 6.2);
  const cN = [SQ.mid - half, SQ.y + lift];
  const cF = [SQ.mid + half, SQ.y + lift];

  // arm A: point at the boy, off toward her, at each little frame, then a nudge
  p.lean = 0.03 * smooth(lt, 3.3, 3.6);
  const j = joints(p);
  const aim = (pt) => reachSide(j.armRoot, [lerp(j.armRoot[0], pt[0], 0.99), lerp(j.armRoot[1], pt[1], 0.99)], 1, s, -1);
  const boyChest = [BOY_X - 30, 615];
  const far = [j.armRoot[0] + 60, j.armRoot[1] - 140];
  const ptAt = (c) => {
    const dx = c[0] - j.armRoot[0];
    const dy = c[1] - j.armRoot[1];
    const l = Math.hypot(dx, dy);
    return [j.armRoot[0] + (dx / l) * 200, j.armRoot[1] + (dy / l) * 200];
  };
  const push0 = [j.armRoot[0] + 30, j.armRoot[1] - 40]; // hand drawn back, palm out
  const push1 = [j.armRoot[0] + 80, j.armRoot[1] - 64]; // nudge
  const rest = [j.armRoot[0] + 8, j.armRoot[1] + 100];
  const targets = [
    [3.45, rest],
    [3.7, boyChest],
    [3.88, boyChest],
    [4.12, far],
    [4.3, ptAt([SQ.mid - SQ.d0, SQ.y])],
    [4.5, ptAt([SQ.mid - SQ.d0, SQ.y])],
    [4.66, ptAt([SQ.mid + SQ.d0, SQ.y])],
    [4.82, ptAt([SQ.mid + SQ.d0, SQ.y])],
    [4.98, push0],
    [5.36, push1],
    [5.66, push1],
    [6.05, rest],
  ];
  let tgt = targets[0][1];
  for (let i = 0; i < targets.length - 1; i++) {
    const [t0, a] = targets[i];
    const [t1, b] = targets[i + 1];
    if (lt >= t0) tgt = lerpPt(a, b, smooth(lt, t0, t1));
  }
  const [a1, a2] = aim(tgt);
  const k = smooth(lt, 3.35, 3.55) * (1 - smooth(lt, 6.0, 6.1));
  p.aA1 = lerp(p0.aA1, a1, k);
  p.aA2 = lerp(p0.aA2, a2, k);
  // looks where he points
  const up = smooth(lt, 4.1, 4.3) * (1 - smooth(lt, 5.7, 6.1));
  p.head = -0.25 * up + 0.08 * smooth(lt, 5.7, 6.1);
  p.look = -0.7 * up + 0.4 * smooth(lt, 5.7, 6.1);

  const extra = () => {
    const alpha = 1 - smooth(lt, 5.8, 6.25);
    if (alpha <= 0.01) return;
    const dN = smooth(lt, 4.3, 4.55, ease.out);
    const dF = smooth(lt, 4.62, 4.87, ease.out);
    if (dN > 0) miniFrame(ctx, cN, SQ.h, dN, alpha, 3200);
    if (dF > 0) miniFrame(ctx, cF, SQ.h, dF, alpha, 3220);
  };
  return { p, extra };
}

// a little frame drawn on stroke by stroke, corners overshooting like the big ones
function miniFrame(ctx, [cx, cy], h, k, alpha, seed) {
  const ov = 5;
  const strokes = [
    [[cx - h - ov, cy - h], [cx + h + ov * 0.4, cy - h]],
    [[cx + h, cy - h - ov * 0.4], [cx + h, cy + h + ov]],
    [[cx + h + ov, cy + h], [cx - h - ov * 0.4, cy + h]],
    [[cx - h, cy + h + ov * 0.4], [cx - h, cy - h - ov]],
  ];
  strokes.forEach((st, i) => {
    const d = clamp(k * 4 - i);
    if (d > 0) path(ctx, st, { w: 3.2, draw: d, alpha, seed: seed + i, wobble: 0.5 });
  });
}
const lerpPt = (a, b, k) => [lerp(a[0], b[0], k), lerp(a[1], b[1], k)];
