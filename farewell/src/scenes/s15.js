// s15 — 盛夏的午后，往盛满冰块的杯中倒入整罐橙子味汽水，坐在清凉的房间里一饮而尽，
//       寒意与甜味漫过喉咙，恍如隔世。
//
// His room is a frame. Outside the window the summer sun blazes and the air
// shimmers; inside an electric fan turns. A tall glass full of ice on the
// table. He picks up a can, cracks it open (a little fizz) and pours: the
// soda is orange — the only orange in the film — and the level climbs through
// the ice. He drinks it in one go, head tipped back, and sets the empty glass
// down. Eyes closed; the cold goes down. He looks up at the window: the
// blazing afternoon outside dissolves into the ledge, the two of them sitting
// side by side in the wind. 恍如隔世. The camera pulls back: his room is one
// frame in a building of frames, each with someone in it, living their own
// afternoon. Far up, in one of them, a girl with a gold hair tie sits by her
// window. The line work fades to bare paper.
import { W, H, COL, TAU, F, lerp, clamp, prog, smooth, keys, ease, hash, path, line, rect, circle, ellipsePts, dot, fillPoly, camera } from '../lib.js';
import { figure, pose, joints, SIT, SIT_BACK, SIT_FRONT, BODY, standY } from '../figure.js';
import { frameBox, windLine, cloud, ridgePts, LEDGE, desk, chair } from '../sets.js';

// ------------------------------------------------------------------ layout
const ROOM = { x: 150, y: 90, w: 1620, h: 850 };
const FLOOR = ROOM.y + ROOM.h; // 940
const WIN = { x: 430, y: 200, w: 500, h: 390 };
const FAN = { x: 285, hy: 668 };
const TABLE = { x0: 975, x1: 1312, top: 790, legs: [1000, 1268] };
const S = 1.55;
const CHAIR_X = 1408;
const SEAT = FLOOR - 60 * S;
const HIP = [1396, SEAT - 3 * S];
const G0 = [1205, TABLE.top]; // glass base
const C0 = [1268, TABLE.top - 27]; // can centre
const REST_A = [1302, TABLE.top - 3];
const REST_B = [1320, TABLE.top - 4];

// the building of frames (cells share the room's layout, offset by a pitch)
const PX = 1860;
const PY = 1060;
const GROUND = FLOOR + 6;
const ROOF = ROOM.y - 2 * PY - 70;

// local times (voice: 盛夏的午后 123.4–124.25 · 往盛满冰块的杯中 124.85–126.0 ·
// 倒入整罐橙子味汽水 126.1–127.05 · 坐在清凉的房间里 128.15–129.4 · 一饮而尽
// 129.4–130.0 · 寒意与甜味漫过喉咙 130.65–132.05 · 恍如隔世 132.5–133.1)
const T = {
  reach: 1.7, // hand to the can
  lift: 2.1,
  tab: 2.55, // crack
  move: 2.85,
  pour0: 3.05,
  pour1: 4.45,
  down0: 4.6,
  down1: 5.05,
  grab: 5.45,
  raise: 5.85,
  drink0: 6.25,
  drink1: 6.95,
  lower1: 7.45,
  eyes0: 7.55,
  eyes1: 8.95,
  mem0: 8.1,
  mem1: 9.2,
  back0: 10.0,
  back1: 11.9,
  fade0: 12.6,
  fade1: 13.38,
};

// camera before the pull-back
const CAM = [
  [0, { x: 960, y: 528, z: 1.0 }],
  [1.6, { x: 1010, y: 548, z: 1.08 }],
  [2.95, { x: 1262, y: 712, z: 2.15 }],
  [4.6, { x: 1256, y: 708, z: 2.2 }],
  [5.55, { x: 1040, y: 570, z: 1.12 }],
  [6.2, { x: 1060, y: 575, z: 1.15 }],
  [7.0, { x: 1150, y: 610, z: 1.3 }],
  [7.35, { x: 1140, y: 604, z: 1.29 }],
  [8.5, { x: 840, y: 500, z: 1.35 }],
  [10.0, { x: 836, y: 496, z: 1.38 }],
];
// the pull-back keeps the ground under his room moving in a straight line on
// screen (it ends below the caption line and never crosses it)
const ANCHOR = [ROOM.x + ROOM.w / 2, GROUND];
const ZF = 0.235;
const GROUND_SCREEN = 1000; // the ground ends below the caption line, so it never crosses it
const FINAL_ANCHOR_SCREEN = [960, 540 + (ANCHOR[1] - (GROUND - (GROUND_SCREEN - 540) / ZF)) * ZF];

function cameraAt(lt) {
  const c = keys(lt, CAM, ease.inOut);
  if (lt <= T.back0) return c;
  const k = smooth(lt, T.back0, T.back1, ease.inOut);
  const z0 = CAM[CAM.length - 1][1].z;
  const z = Math.exp(lerp(Math.log(z0), Math.log(ZF), k));
  const s0 = [960 + (ANCHOR[0] - c.x) * c.z, 540 + (ANCHOR[1] - c.y) * c.z];
  const sx = lerp(s0[0], FINAL_ANCHOR_SCREEN[0], k);
  const sy = lerp(s0[1], FINAL_ANCHOR_SCREEN[1], k);
  return { x: ANCHOR[0] - (sx - 960) / z, y: ANCHOR[1] - (sy - 540) / z, z };
}

// ------------------------------------------------------------------ scene
export default {
  draw(ctx, lt, info) {
    const t = Math.max(0, lt);
    const tg = info.t;
    const cam = cameraAt(t);
    // keep lines readable as the camera pulls far back
    const K = cam.z > 1 ? Math.pow(cam.z, -0.5) : Math.max(1, 0.5 / cam.z);
    const fade = 1 - smooth(t, T.fade0, T.fade1, ease.inOut);
    if (fade <= 0.001) return;
    const body = (c) => camera(c, cam, () => {
      if (cam.z < 0.9) drawWorld(c, t, tg, cam, K);
      drawRoom(c, t, tg, K);
    });
    if (fade < 1) ownLayer(ctx, 0, body, fade);
    else body(ctx);
  },
};

// ------------------------------------------------------------------ helpers
// Private offscreen layers (not lib's shared pool, so no clip or state left
// behind by anyone else can leak in, and none of ours leaks out).
const MINE = [];
function ownLayer(ctx, i, fn, alpha, rect) {
  if (!MINE[i]) {
    MINE[i] = document.createElement('canvas');
    MINE[i].width = W;
    MINE[i].height = H;
  }
  const c = MINE[i];
  const l = c.getContext('2d');
  l.save();
  l.setTransform(1, 0, 0, 1, 0, 0);
  l.globalAlpha = 1;
  l.globalCompositeOperation = 'source-over';
  l.filter = 'none';
  let [x, y, w, h] = rect ?? [0, 0, W, H];
  x = Math.max(0, Math.floor(x) - 2);
  y = Math.max(0, Math.floor(y) - 2);
  w = Math.min(W - x, Math.ceil(w) + 4);
  h = Math.min(H - y, Math.ceil(h) + 4);
  l.clearRect(x, y, w, h);
  try {
    fn(l);
  } finally {
    l.restore();
  }
  if (w <= 0 || h <= 0) return;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha *= alpha;
  ctx.drawImage(c, x, y, w, h, x, y, w, h);
  ctx.restore();
}
const st = (K, o = {}) => ({ ...o, w: (o.w ?? 4) * K, wobble: (o.wobble ?? 1.3) * K });
// wobble multiplier for the far-away cells (set around each cell, else 1)
let WOBK = 1;
const figW = (s) => Math.max(2, 4.6 * Math.pow(s, 0.85));
function fig(ctx, p, o, K) {
  return figure(ctx, p, { ...o, w: figW(p.s) * K, wobble: 1.1 * K * WOBK });
}
const rot = (c, a, lx, ly) => [c[0] + lx * Math.cos(a) - ly * Math.sin(a), c[1] + lx * Math.sin(a) + ly * Math.cos(a)];

// two-bone IK for a side-view arm: angles (from straight down, + toward the
// facing side) that put the hand on target, elbow below.
function armTo(root, target, f, s) {
  const ua = BODY.ua * s;
  const la = BODY.la * s;
  const dx = (target[0] - root[0]) * f;
  const dy = target[1] - root[1];
  const D = clamp(Math.hypot(dx, dy), Math.abs(ua - la) + 1, (ua + la) * 0.999);
  const phi = Math.atan2(dx, dy);
  const a = Math.acos(clamp((ua * ua + D * D - la * la) / (2 * ua * D), -1, 1));
  const b = Math.acos(clamp((ua * ua + la * la - D * D) / (2 * ua * la), -1, 1));
  return [phi - a, Math.PI - b];
}

// polygon ∩ {y >= y0}
function clipBelow(poly, y0) {
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const ia = a[1] >= y0;
    const ib = b[1] >= y0;
    if (ia) out.push(a);
    if (ia !== ib) {
      const k = (y0 - a[1]) / (b[1] - a[1]);
      out.push([lerp(a[0], b[0], k), y0]);
    }
  }
  return out;
}
function area(poly) {
  let s = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    s += a[0] * b[1] - b[0] * a[1];
  }
  return Math.abs(s) / 2;
}

// ------------------------------------------------------------------ him
// Everything he does, as a function of time: his pose and where the can and
// the glass are.
function action(t, tg) {
  const out = { lean: 0.06, head: 0.18, look: 0.45, eye: 'dot', can: { c: C0, a: 0 }, glass: { g: G0, a: 0 }, fill: 0, tab: 0, pour: 0 };
  // ---- the can
  const grip = (c, a) => rot(c, a, 13, 3);
  const top = (c, a) => rot(c, a, 5, -29);
  const mouth = (c, a) => rot(c, a, -9, -27);
  const held = [1286, 742];
  const pourMouth = [1218, 700];
  let handA = REST_A;
  let handB = REST_B;

  // lean toward the work
  out.lean = keysLean(t);
  out.head = keysHead(t);
  out.look = keys(t, [[1.6, 0.45], [3.25, 0.8], [4.6, 0.8], [5.2, 0.3], [6.2, 0], [6.85, -1], [7.45, 0.3], [8.95, 0.2], [9.5, -0.5]]);
  if (t > T.eyes0 && t < T.eyes1) out.eye = 'closed';

  // can: reach, lift, crack, pour, set down
  if (t < T.reach) {
    // resting
  } else if (t < T.lift) {
    const k = smooth(t, T.reach, T.lift);
    handA = lerpP(REST_A, grip(C0, 0), k);
  } else if (t < T.move) {
    const k = smooth(t, T.lift, T.lift + 0.32);
    const c = lerpP(C0, held, k);
    out.can = { c, a: 0.12 * k };
    handA = grip(c, out.can.a);
    // the other hand comes to the tab, flicks it open, goes back
    const kb = smooth(t, T.lift + 0.15, T.tab - 0.05) * (1 - smooth(t, T.tab + 0.12, T.move));
    handB = lerpP(REST_B, top(c, out.can.a), kb);
  } else if (t < T.down0) {
    // over the glass, tilt, pour
    const k = smooth(t, T.move, T.pour0 + 0.15);
    const a = keys(t, [[T.move, 0.12], [T.pour0 + 0.15, -1.55], [T.pour1, -2.25], [T.down0, -1.7]], ease.inOut);
    const m = lerpP(mouth(held, 0.12), pourMouth, k);
    // place the can so its mouth is at m
    const mo = rot([0, 0], a, -9, -27);
    const c = [m[0] - mo[0], m[1] - mo[1]];
    out.can = { c, a };
    handA = grip(c, a);
  } else {
    const k = smooth(t, T.down0, T.down1);
    const a0 = -1.7;
    const mo = rot([0, 0], a0, -9, -27);
    const c0 = [pourMouth[0] - mo[0], pourMouth[1] - mo[1]];
    const arc = Math.sin(Math.PI * k) * -24;
    const c = [lerp(c0[0], C0[0], k), lerp(c0[1], C0[1], k) + arc];
    const a = lerp(a0, 0, ease.out(k));
    out.can = { c, a };
    const kr = smooth(t, T.down1 + 0.05, T.grab);
    handA = lerpP(grip(c, a), REST_A, kr);
  }
  out.tab = smooth(t, T.tab - 0.06, T.tab + 0.06);
  out.pour = smooth(t, T.pour0, T.pour0 + 0.12) * (1 - smooth(t, T.pour1 - 0.05, T.pour1 + 0.15));
  out.fill = 0.9 * ease.out(prog(t, T.pour0 + 0.1, T.pour1 + 0.05));
  out.fizz = env(t, T.tab, T.tab + 0.5, 0.05, 0.3);

  // glass: grab, raise, drink, lower
  if (t >= T.grab) {
    const ggrip = (g, a) => rot(g, a, 21, -32);
    if (t < T.raise) {
      const k = smooth(t, T.grab, T.raise);
      handA = lerpP(REST_A, ggrip(G0, 0), k);
    } else {
      // where the rim meets his mouth (depends on his head at that moment)
      const mouthAt = (tt) => mouthPoint(basePose({ lean: keysLean(tt), head: keysHead(tt) }));
      let g;
      let a;
      if (t < T.drink1) {
        a = keys(t, [[T.raise, 0], [T.drink0, 0.55], [T.drink1, 2.05]], ease.inOut);
        const M = mouthAt(t);
        const rim = rot([0, 0], a, 0, -GL.h);
        const gm = [M[0] - rim[0] - 4, M[1] - rim[1] + 2];
        const k = smooth(t, T.raise, T.drink0);
        g = lerpP(G0, gm, k);
        // the glass climbs in an arc, not a straight line
        g[1] -= Math.sin(Math.PI * k) * 20;
        out.fill = 0.9 * (1 - smooth(t, T.drink0 + 0.08, T.drink1 - 0.05, ease.inOut));
      } else {
        const k = smooth(t, T.drink1, T.lower1);
        const a0 = 2.05;
        const M = mouthAt(T.drink1);
        const rim = rot([0, 0], a0, 0, -GL.h);
        const g0 = [M[0] - rim[0] - 4, M[1] - rim[1] + 2];
        a = lerp(a0, 0, ease.inOut(clamp(k * 1.15)));
        g = lerpP(g0, G0, k);
        g[1] -= Math.sin(Math.PI * k) * 30;
        out.fill = 0;
      }
      out.glass = { g, a };
      handA = ggrip(g, a);
    }
  }
  out.handA = handA;
  out.handB = handB;
  return out;
}
const lerpP = (a, b, k) => [lerp(a[0], b[0], k), lerp(a[1], b[1], k)];
const env = (t, a, b, fi, fo) => Math.min(smooth(t, a, a + fi), 1 - smooth(t, b - fo, b));
// head/lean keys duplicated as functions so the mouth can be found at any time
const keysLean = (t) => keys(t, [[1.6, 0.06], [2.1, 0.12], [2.9, 0.12], [3.25, 0.2], [4.6, 0.2], [5.1, 0.1], [5.45, 0.1], [5.8, 0.2], [6.2, 0.0], [6.85, -0.24], [7.45, 0.08], [8.0, 0.0]]);
const keysHead = (t) => keys(t, [[1.6, 0.18], [2.1, 0.22], [2.9, 0.2], [3.25, 0.3], [4.6, 0.3], [5.1, 0.12], [5.8, 0.16], [6.2, -0.05], [6.85, -0.72], [7.45, 0.05], [7.9, -0.14], [8.95, -0.14], [9.5, -0.22]]);

function basePose(o) {
  return pose({ ...SIT, x: HIP[0], y: HIP[1], s: S, f: -1, ...o });
}
function mouthPoint(p) {
  const j = joints(p);
  const a = j.headAngle;
  const f = p.f;
  const fwd = [f * Math.cos(a), Math.sin(a)];
  const up = [f * Math.sin(a), -Math.cos(a)];
  return [j.head[0] + fwd[0] * j.r * 0.86 - up[0] * j.r * 0.42, j.head[1] + fwd[1] * j.r * 0.86 - up[1] * j.r * 0.42];
}

function drawHim(ctx, t, tg, K, act) {
  const breathe = 0.012 * Math.sin(tg * 1.6);
  const p = basePose({ lean: act.lean + breathe, head: act.head, look: act.look });
  const j = joints(p);
  const [a1, a2] = armTo(j.armRoot, act.handA, -1, S);
  const [b1, b2] = armTo(j.armRoot, act.handB, -1, S);
  p.aA1 = a1;
  p.aA2 = a2;
  p.aB1 = b1;
  p.aB2 = b2;
  fig(ctx, p, { id: 1, eye: act.eye }, K);
  return p;
}

// ------------------------------------------------------------------ props
function drawCan(ctx, c, a, tabK, K, sd) {
  const P = (x, y) => rot(c, a, x, y);
  const hw = 15;
  const hh = 27;
  const o = st(K, { w: 2.6, wobble: 0.6 });
  // paper fill so it hides what is behind
  fillPoly(ctx, [P(-hw, -hh + 2), P(hw, -hh + 2), P(hw, hh - 2), P(-hw, hh - 2)], COL.paper, 1);
  path(ctx, [P(-hw, -hh + 2), P(-hw, hh - 2), ...ellipsePts(0, hh - 2, hw, 3.5, Math.PI, 0, 10).reverse().map(([x, y]) => P(x, y)), P(hw, -hh + 2)], { ...o, seed: sd });
  path(ctx, ellipsePts(0, -hh + 2, hw, 3.5, 0, TAU, 16).map(([x, y]) => P(x, y)), { ...o, w: 2 * K, seed: sd + 1 });
  // label band and a little ink orange (the flavour)
  path(ctx, [P(-hw, -hh + 11), P(hw, -hh + 11)], { ...o, w: 1.4 * K, alpha: 0.7, seed: sd + 2 });
  path(ctx, [P(-hw, hh - 11), P(hw, hh - 11)], { ...o, w: 1.4 * K, alpha: 0.7, seed: sd + 3 });
  path(ctx, ellipsePts(0, 1, 7, 7, 0, TAU, 12).map(([x, y]) => P(x, y)), { ...o, w: 1.5 * K, seed: sd + 4 });
  for (let i = 0; i < 3; i++) {
    const aa = (i / 3) * Math.PI + 0.3;
    path(ctx, [P(Math.cos(aa) * 5.5, 1 + Math.sin(aa) * 5.5), P(-Math.cos(aa) * 5.5, 1 - Math.sin(aa) * 5.5)], { w: 1 * K, alpha: 0.7, wobble: 0, seed: sd + 5 + i });
  }
  path(ctx, [P(0, -6), P(3, -9), P(7, -9)], { ...o, w: 1.3 * K, seed: sd + 8 });
  // opening + tab
  if (tabK > 0.5) {
    const m = P(-7, -hh + 2);
    dot(ctx, m[0], m[1], 2.6, COL.ink, 0.85);
  }
  const ta = lerp(0, -1.2, tabK);
  const tb = P(3, -hh + 2);
  const tip = rot(tb, a + ta, 10, 0);
  path(ctx, [tb, tip], { ...o, w: 2.4 * K, seed: sd + 9 });
}

const GL = { bw: 18, tw: 22, h: 72 };
const GLI = [[-15, -5], [15, -5], [19.5, -70], [-19.5, -70]];
const ICE = [
  [-7, -14, 0.25, 17], [8, -16, -0.3, 16], [-5, -34, 0.5, 17],
  [9, -40, 0.15, 16], [-7, -56, -0.2, 16], [8, -60, 0.45, 15],
];
function drawGlass(ctx, g, a, fill, t, tg, K, o = {}) {
  const P = (x, y) => rot(g, a, x, y);
  const inner = GLI.map(([x, y]) => P(x, y));
  // liquid: keep the surface level whatever the tilt, holding the volume
  let surf = null;
  if (fill > 0.004) {
    const full = area(inner);
    const ys = inner.map((q) => q[1]);
    let lo = Math.min(...ys);
    let hi = Math.max(...ys);
    for (let i = 0; i < 26; i++) {
      const mid = (lo + hi) / 2;
      if (area(clipBelow(inner, mid)) > fill * full) lo = mid;
      else hi = mid;
    }
    surf = (lo + hi) / 2;
    const liq = clipBelow(inner, surf);
    if (liq.length >= 3) {
      fillPoly(ctx, liq, COL.orange, 0.92);
      // the surface line
      const xs = liq.filter((q) => Math.abs(q[1] - surf) < 0.5).map((q) => q[0]);
      if (xs.length >= 2) {
        const x0 = Math.min(...xs);
        const x1 = Math.max(...xs);
        path(ctx, [[x0, surf], [x1, surf]], { w: 2.4 * K, color: COL.orange, wobble: 0.8 * K, seed: 7001 });
      }
      // bubbles rising
      if (a < 0.35) {
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(liq[0][0], liq[0][1]);
        for (const q of liq.slice(1)) ctx.lineTo(q[0], q[1]);
        ctx.closePath();
        ctx.clip();
        const depth = g[1] - 5 - surf;
        for (let i = 0; i < 12; i++) {
          const sp = 30 + 40 * hash(i * 3.3);
          const y = g[1] - 7 - ((tg * sp + hash(i * 7.1) * 200) % Math.max(8, depth));
          const x = g[0] + lerp(-13, 13, hash(i * 1.7 + 0.3)) + 1.5 * Math.sin(tg * 5 + i);
          ctx.beginPath();
          ctx.arc(x, y, (1.2 + 1.1 * hash(i + 9)) * Math.min(K, 2), 0, TAU);
          ctx.strokeStyle = 'rgba(255,248,236,0.9)';
          ctx.lineWidth = 1.3 * K;
          ctx.stroke();
        }
        ctx.restore();
      }
    }
  }
  if (o.stream) o.stream(surf ?? g[1] - 8);
  // ice
  ICE.forEach(([x, y, r, s], i) => {
    const c = P(x, y);
    const pts = [];
    const n = 4;
    for (let k = 0; k < n; k++) {
      const aa = a + r + (k / n) * TAU + Math.PI / 4;
      const rr = s * 0.62;
      pts.push([c[0] + Math.cos(aa) * rr, c[1] + Math.sin(aa) * rr]);
    }
    path(ctx, pts, { close: true, fill: 'rgba(255,251,242,0.42)', w: 1.7 * K, alpha: 0.8, wobble: 0.4 * K, seed: 7010 + i });
    const h0 = rot(c, a + r, -s * 0.22, -s * 0.12);
    const h1 = rot(c, a + r, s * 0.05, -s * 0.24);
    path(ctx, [h0, h1], { w: 1.2 * K, alpha: 0.45, wobble: 0, seed: 7020 + i });
  });
  // glass
  const go = { w: 2.8 * K, wobble: 0.5 * K };
  path(ctx, [P(-GL.tw, -GL.h), P(-GL.bw, 0), P(GL.bw, 0), P(GL.tw, -GL.h)], { ...go, seed: 7030 });
  path(ctx, [P(-GL.bw + 2, -4), P(GL.bw - 2, -4)], { ...go, w: 1.6 * K, alpha: 0.6, seed: 7031 });
  path(ctx, ellipsePts(0, -GL.h, GL.tw, 4, 0, TAU, 20).map(([x, y]) => P(x, y)), { ...go, w: 1.8 * K, seed: 7032 });
  // a highlight and condensation
  path(ctx, [P(-GL.bw + 5, -11), P(-GL.tw + 6, -GL.h + 10)], { w: 1.8 * K, color: 'rgba(255,252,246,0.85)', wobble: 0, seed: 7033 });
  const cold = o.cold ?? 0;
  if (cold > 0) {
    for (let i = 0; i < 14; i++) {
      const lx = lerp(-16, 18, hash(i * 2.9 + 1));
      const ly = -lerp(8, 66, hash(i * 5.3 + 2));
      const q = P(lx, ly);
      dot(ctx, q[0], q[1], (1 + 0.9 * hash(i)) * Math.min(K, 2), COL.ink, 0.3 * cold);
    }
    // one drop runs down
    const k = ((tg * 0.22) % 1);
    const q = P(14, -lerp(56, 6, k));
    dot(ctx, q[0], q[1], 1.9 * Math.min(K, 2), COL.ink, 0.4 * cold * Math.sin(Math.PI * k));
  }
}

// a wall clock: early afternoon
const CLOCK = [1590, 300, 46];
function drawClock(ctx, tg, K) {
  const [x, y, r] = CLOCK;
  circle(ctx, x, y, r, { w: 3.4 * K, wobble: 0.8 * K, fill: COL.paper, seed: 950 });
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU;
    const r0 = r * (i % 3 ? 0.84 : 0.76);
    line(ctx, x + Math.cos(a) * r0, y + Math.sin(a) * r0, x + Math.cos(a) * r * 0.92, y + Math.sin(a) * r * 0.92, { w: (i % 3 ? 1.4 : 2.4) * K, wobble: 0, seed: 951 + i });
  }
  const mm = 38 + (tg - 123) * 0.4; // minutes past two
  const am = (mm / 60) * TAU - Math.PI / 2;
  const ah = ((2 + mm / 60) / 12) * TAU - Math.PI / 2;
  line(ctx, x, y, x + Math.cos(ah) * r * 0.5, y + Math.sin(ah) * r * 0.5, { w: 3.4 * K, wobble: 0, seed: 965 });
  line(ctx, x, y, x + Math.cos(am) * r * 0.78, y + Math.sin(am) * r * 0.78, { w: 2.4 * K, wobble: 0, seed: 966 });
  dot(ctx, x, y, 3.5 * Math.min(K, 2), COL.ink);
}

function drawTable(ctx, K) {
  const o = st(K, { w: 4.6 });
  path(ctx, [[TABLE.x0 - 10, TABLE.top], [TABLE.x1 + 10, TABLE.top]], { ...o, w: 5 * K, seed: 801 });
  path(ctx, [[TABLE.x0, TABLE.top + 18], [TABLE.x1, TABLE.top + 18]], { ...o, w: 2.4 * K, seed: 802 });
  for (const [i, x] of TABLE.legs.entries()) path(ctx, [[x, TABLE.top], [x + (i ? 2 : -2), FLOOR]], { ...o, seed: 803 + i });
}

function drawFan(ctx, tg, K) {
  const o = st(K, { w: 3 });
  const bx = FAN.x;
  // base and pole
  path(ctx, ellipsePts(bx, FLOOR - 9, 58, 11, Math.PI, TAU, 14), { ...o, seed: 820 });
  path(ctx, [[bx - 58, FLOOR - 9], [bx - 54, FLOOR - 3], [bx + 54, FLOOR - 3], [bx + 58, FLOOR - 9]], { ...o, seed: 821 });
  path(ctx, [[bx, FLOOR - 18], [bx, FAN.hy + 48]], { ...o, w: 3.4 * K, seed: 822 });
  path(ctx, [[bx - 6, FAN.hy + 48], [bx + 6, FAN.hy + 48]], { ...o, seed: 823 });
  // head oscillates a little
  const yaw = 0.95 + 0.22 * Math.sin(tg * 0.55);
  const R = 74;
  const rx = R * Math.cos(yaw);
  const cx = bx + 14 + 10 * Math.sin(yaw);
  const cy = FAN.hy;
  // motor behind the cage
  const mx = cx - rx * 0.8 - 14;
  path(ctx, [[bx, FAN.hy + 48], [mx + 4, cy + 16]], { ...o, seed: 825 });
  path(ctx, ellipsePts(mx, cy, 22, 19, 0, TAU, 16), { ...o, fill: COL.paper, seed: 824 });
  // blades
  const spin = tg * 2.3 * TAU;
  const bl = { w: 2.2 * K, alpha: 0.7, wobble: 0.5 * K };
  for (let i = 0; i < 3; i++) {
    const aa = spin + (i / 3) * TAU;
    const pts = [];
    for (let k = 0; k <= 10; k++) {
      const u = k / 10;
      const ang = aa + lerp(-0.5, 0.5, u);
      const rr = R * 0.82 * Math.sin(Math.PI * u) ** 0.6;
      pts.push([cx + Math.cos(ang) * rr * (rx / R), cy + Math.sin(ang) * rr]);
    }
    fillPoly(ctx, pts, COL.ink, 0.06);
    path(ctx, pts, { ...bl, seed: 830 + i });
  }
  // a blur ring
  path(ctx, ellipsePts(cx, cy, rx * 0.7, R * 0.7, spin, spin + 2.4, 18), { w: 1.6 * K, alpha: 0.3, wobble: 0.4 * K, seed: 836 });
  // cage
  path(ctx, ellipsePts(cx, cy, rx, R, 0, TAU + 0.15, 28), { ...o, w: 3.2 * K, seed: 840 });
  path(ctx, ellipsePts(cx, cy, rx * 0.55, R * 0.55, 0, TAU, 20), { ...o, w: 1.4 * K, alpha: 0.5, seed: 841 });
  for (let i = 0; i < 8; i++) {
    const aa = (i / 8) * TAU;
    path(ctx, [[cx + Math.cos(aa) * rx * 0.12, cy + Math.sin(aa) * R * 0.12], [cx + Math.cos(aa) * rx, cy + Math.sin(aa) * R]], { w: 1.1 * K, alpha: 0.4, wobble: 0.3 * K, seed: 842 + i });
  }
  dot(ctx, cx, cy, 6 * Math.min(K, 2.5), COL.ink, 0.9);
}

// outside the window: summer sun, roofs, the air shimmering
const SUNW = [WIN.x + 0.82 * WIN.w, WIN.y + 0.2 * WIN.h];
function drawOutside(ctx, tg, K) {
  // bright air
  const gr = ctx.createRadialGradient(SUNW[0], SUNW[1], 10, SUNW[0], SUNW[1], WIN.w * 0.9);
  gr.addColorStop(0, 'rgba(255,252,244,0.75)');
  gr.addColorStop(1, 'rgba(255,252,244,0.12)');
  ctx.fillStyle = gr;
  ctx.fillRect(WIN.x, WIN.y, WIN.w, WIN.h);
  const o = st(K, { w: 3 });
  circle(ctx, SUNW[0], SUNW[1], 34, { ...o, w: 3.2 * K, fill: 'rgba(255,252,244,0.9)', seed: 860 });
  for (let i = 0; i < 12; i++) {
    const aa = tg * 0.1 + (i / 12) * TAU;
    const r0 = 46;
    const r1 = i % 2 ? 62 : 72;
    path(ctx, [[SUNW[0] + Math.cos(aa) * r0, SUNW[1] + Math.sin(aa) * r0], [SUNW[0] + Math.cos(aa) * r1, SUNW[1] + Math.sin(aa) * r1]], { ...o, w: 2.6 * K, seed: 861 + i });
  }
  // roofs
  const hz = WIN.y + WIN.h - 52;
  const roofs = [
    [WIN.x - 10, hz], [WIN.x + 40, hz], [WIN.x + 40, hz - 40], [WIN.x + 85, hz - 72], [WIN.x + 130, hz - 40], [WIN.x + 130, hz],
    [WIN.x + 200, hz], [WIN.x + 200, hz - 26], [WIN.x + 300, hz - 26], [WIN.x + 300, hz], [WIN.x + 380, hz],
    [WIN.x + 380, hz - 50], [WIN.x + 420, hz - 82], [WIN.x + 460, hz - 50], [WIN.x + 460, hz], [WIN.x + WIN.w + 10, hz],
  ];
  path(ctx, roofs, { ...o, w: 2.4 * K, alpha: 0.75, seed: 880 });
  // a tree
  path(ctx, [[WIN.x + 248, hz - 26], [WIN.x + 248, hz - 52]], { ...o, w: 2.2 * K, alpha: 0.75, seed: 881 });
  circle(ctx, WIN.x + 248, hz - 74, 22, { ...o, w: 2.2 * K, alpha: 0.75, fill: COL.paper, seed: 882 });
  // heat shimmer
  for (let i = 0; i < 6; i++) {
    const x = WIN.x + 50 + i * 80 + 12 * Math.sin(i * 2.1);
    const pts = [];
    const y0 = hz - 30 - (i % 2) * 40;
    for (let k = 0; k <= 12; k++) {
      const u = k / 12;
      pts.push([x + 6 * Math.sin(u * 9 - tg * 6 + i), y0 - u * 120]);
    }
    const a = 0.22 + 0.12 * Math.sin(tg * 1.7 + i * 1.3);
    path(ctx, pts, { w: 1.8 * K, alpha: a, wobble: 0.4 * K, seed: 890 + i });
  }
}

// The ledge, remembered: the two of them side by side in the wind (a light
// redrawing of sets.ledgeFront, in its 1920x1080 coordinates).
const MEM_FAR = ridgePts(4, -40, W + 40, 520, 90, { freq: 1 / 380, sharp: 1.6, step: 40 });
const MEM_NEAR = ridgePts(9, -40, W + 40, 585, 60, { freq: 1 / 300, sharp: 1.4, step: 40 });
function memoryView(ctx, tg, K) {
  const L = LEDGE;
  const o = { wobble: 1.2 * K };
  sunMark(ctx, L.sun[0], L.sun[1], 44, tg, { w: 3.6 * K, wobble: 1 * K }, 3400);
  path(ctx, MEM_FAR, { ...o, w: 2.6 * K, alpha: 0.5, seed: 3420 });
  path(ctx, MEM_NEAR, { ...o, w: 3 * K, alpha: 0.7, seed: 3421 });
  cloud(ctx, 520 + Math.sin(tg * 0.1) * 20, 210, 0.9, { alpha: 0.8, seedStroke: 3422, w: 3.2 * K });
  cloud(ctx, 1180 + Math.sin(tg * 0.08 + 1) * 24, 140, 0.6, { alpha: 0.7, seedStroke: 3423, seed: 2, w: 3.2 * K });
  for (let i = 0; i < 3; i++) {
    const per = 7;
    const k = ((tg + i * 2.3) % per) / per;
    windLine(ctx, -200 + i * 100, 300 + i * 120, 170 + 30 * i, k, { travel: 2000, curl: i !== 1, seed: 3430 + i, alpha: 0.6, w: 3 * K });
  }
  // the ledge
  fillPoly(ctx, [[L.x0, L.y], [L.x1, L.y], [L.x1, H + 20], [L.x0, H + 20]], COL.paper, 1);
  fillPoly(ctx, [[L.x0, L.y], [L.x1, L.y], [L.x1, H + 20], [L.x0, H + 20]], COL.paperShade, 0.6);
  rect(ctx, L.x0, L.y, L.x1 - L.x0, H - L.y + 80, { w: 6 * K, wobble: 1.4 * K, over: 9, seed: 3440 });
  // the two of them
  const s = L.s;
  const hipY = L.y - 3;
  const boy = pose({ view: 'front', x: L.boyX, y: hipY, s, ...SIT_FRONT, lB2: -0.08 + 0.03 * Math.sin(tg * 1.7) });
  const sw = Math.sin(tg * 2.1);
  const girl = pose({
    view: 'front', x: L.girlX, y: hipY, s, ...SIT_FRONT,
    look: -0.55, head: -0.05 + 0.04 * Math.sin(tg * 0.6), turn: -0.1,
    lA2: -0.08 + 0.07 * sw, lB2: -0.08 - 0.07 * sw,
    tail: 0.2 * Math.sin(tg * 1.25),
  });
  fig(ctx, boy, { id: 1 }, K);
  const j = fig(ctx, girl, { id: 2, ponytail: true, noTie: true }, K);
  // her tie (same spot the rig puts it, a little larger so it reads this small)
  const a = j.headAngle;
  const f = girl.turn >= 0 ? -1 : 1;
  const bx = -f * Math.cos(a);
  const by = -Math.sin(a);
  const ux = Math.sin(a) * f;
  const uy = -Math.cos(a);
  const tx = j.head[0] + (bx * 0.98 + ux * 0.45) * j.r;
  const ty = j.head[1] + (by * 0.98 + uy * 0.45) * j.r;
  dot(ctx, tx, ty, 12, COL.gold);
}

function sunMark(ctx, x, y, r, tg, o, sd) {
  circle(ctx, x, y, r, { ...o, fill: 'rgba(255,252,244,0.9)', seed: sd });
  for (let i = 0; i < 12; i++) {
    const aa = tg * 0.05 + (i / 12) * TAU;
    const r0 = r * 1.32;
    const r1 = r * (i % 2 ? 1.62 : 1.78);
    path(ctx, [[x + Math.cos(aa) * r0, y + Math.sin(aa) * r0], [x + Math.cos(aa) * r1, y + Math.sin(aa) * r1]], { ...o, w: o.w * 0.8, seed: sd + 1 + i });
  }
}

function drawWindow(ctx, t, tg, K) {
  const memK = smooth(t, T.mem0, T.mem1, ease.inOut);
  ctx.save();
  ctx.beginPath();
  ctx.rect(WIN.x, WIN.y, WIN.w, WIN.h);
  ctx.clip();
  if (memK < 1) drawOutside(ctx, tg, K);
  ctx.restore();
  if (memK > 0) {
    const m = ctx.getTransform();
    // only the window's own pixels go through the layer
    const r = [m.a * WIN.x + m.e, m.d * WIN.y + m.f, m.a * WIN.w, m.d * WIN.h];
    ownLayer(ctx, 1, (l) => {
      l.setTransform(m);
      l.beginPath();
      l.rect(WIN.x, WIN.y, WIN.w, WIN.h);
      l.clip();
      l.fillStyle = COL.paper;
      l.fillRect(WIN.x, WIN.y, WIN.w, WIN.h);
      const sc = WIN.h / 1080;
      l.translate(WIN.x + WIN.w / 2, WIN.y);
      l.scale(sc, sc);
      l.translate(-972, 0);
      memoryView(l, tg, K);
    }, memK, r);
  }
  // the frame itself
  const o = st(K, { w: 4.2 });
  rect(ctx, WIN.x, WIN.y, WIN.w, WIN.h, { ...o, seed: 900, over: 6 });
  rect(ctx, WIN.x - 12, WIN.y - 12, WIN.w + 24, WIN.h + 24, { ...o, w: 2.2 * K, alpha: 0.7, seed: 901, over: 3 });
  path(ctx, [[WIN.x - 30, WIN.y + WIN.h + 14], [WIN.x + WIN.w + 30, WIN.y + WIN.h + 14]], { ...o, w: 4.6 * K, seed: 902 });
  path(ctx, [[WIN.x - 26, WIN.y + WIN.h + 26], [WIN.x + WIN.w + 26, WIN.y + WIN.h + 26]], { ...o, w: 2 * K, alpha: 0.7, seed: 903 });
}

// ------------------------------------------------------------------ the room
// A room's frame. Drawn in a 1/3-scale space so its long edges are resampled
// coarsely (the building has many of them); on screen it looks the same.
const FQ = 3;
function roomFrame(ctx, K, seed) {
  ctx.save();
  ctx.translate(ROOM.x, ROOM.y);
  ctx.scale(FQ, FQ);
  frameBox(ctx, 0, 0, ROOM.w / FQ, ROOM.h / FQ, { w: (5.5 * K) / FQ, wobble: (1.6 * K) / FQ, over: 9 / FQ, seed });
  ctx.restore();
}

function drawRoom(ctx, t, tg, K) {
  F.stroke = 1000;
  const act = action(t, tg);
  roomFrame(ctx, K, 700);
  drawWindow(ctx, t, tg, K);
  drawClock(ctx, tg, K);
  F.stroke = 1200;
  drawFan(ctx, tg, K);

  // cool air from the fan (eases off while the camera is close on the glass)
  const windA = 1 - 0.85 * smooth(t, 1.6, 2.2) * (1 - smooth(t, 4.9, 5.5));
  for (let i = 0; i < 3; i++) {
    const per = 2.6;
    const k = ((tg * 1 + i * 0.87) % per) / per;
    windLine(ctx, FAN.x + 70, 640 + i * 32, 120 + 30 * (i % 2), k, { travel: 820, curl: i === 1, seed: 1300 + i, alpha: 0.5 * windA, w: 2.2 * K });
  }

  F.stroke = 1400;
  chair(ctx, CHAIR_X, FLOOR, S, -1, { w: 4 * K });
  drawTable(ctx, K);

  // can on the table or in his hand; glass on the table or at his lips
  const cold = 0.5 + 0.5 * smooth(t, T.pour0, T.pour1 + 0.6);
  const stream = (surf) => {
    if (act.pour <= 0.01) return;
    const m = rot(act.can.c, act.can.a, -9, -27);
    const end = [act.glass.g[0] - 3, surf];
    const w = 6 * act.pour;
    const pts = [m, [m[0] - 6, m[1] + 4], [lerp(m[0], end[0], 0.85), lerp(m[1], end[1], 0.35)], end];
    path(ctx, pts, { w: w * K, color: COL.orange, wobble: 0.7 * K, seed: 7050 });
    // splashes where it lands
    for (let i = 0; i < 4; i++) {
      const ph = (tg * 3.2 + i * 0.27) % 1;
      const sx = end[0] + (i % 2 ? 1 : -1) * (4 + 8 * ph);
      const sy = end[1] - 12 * Math.sin(Math.PI * ph);
      dot(ctx, sx, sy, 1.8 * Math.min(K, 2), COL.orange, act.pour * (1 - ph));
    }
  };
  drawGlass(ctx, act.glass.g, act.glass.a, act.fill, t, tg, K, { stream, cold });
  drawCan(ctx, act.can.c, act.can.a, act.tab, K, 7100);
  // fizz when it cracks open
  if (act.fizz > 0.01) {
    const top = rot(act.can.c, act.can.a, -4, -31);
    for (let i = 0; i < 7; i++) {
      const aa = -Math.PI / 2 + lerp(-1.1, 1.1, i / 6);
      const k = prog(t, T.tab, T.tab + 0.45);
      const r0 = 8 + 18 * k;
      const r1 = r0 + 8;
      path(ctx, [[top[0] + Math.cos(aa) * r0, top[1] + Math.sin(aa) * r0], [top[0] + Math.cos(aa) * r1, top[1] + Math.sin(aa) * r1]], { w: 2 * K, alpha: act.fizz, wobble: 0, seed: 7200 + i });
      if (i % 2 === 0) dot(ctx, top[0] + Math.cos(aa + 0.2) * (r1 + 6), top[1] + Math.sin(aa + 0.2) * (r1 + 6), 1.8, COL.orange, act.fizz);
    }
  }

  const p = drawHim(ctx, t, tg, K, act);

  // the cold going down: a few small marks along his throat
  const ca = env(t, T.eyes0 - 0.1, T.eyes1 - 0.1, 0.3, 0.5);
  if (ca > 0.01) {
    const j = joints(p);
    // tiny cold sparkles drifting down past his throat
    for (let i = 0; i < 3; i++) {
      const k = clamp((t - T.eyes0 - i * 0.28) / 1.1);
      if (k <= 0 || k >= 1) continue;
      const a = Math.sin(Math.PI * k) * ca;
      const y = lerp(j.neckTop[1] - 6, j.shoulder[1] + 46, k);
      const x = lerp(j.neckTop[0], j.shoulder[0], k) - 22 - 9 * (i % 2);
      const r = 6.5;
      for (let q = 0; q < 3; q++) {
        const aa = (q / 3) * Math.PI + 0.3;
        path(ctx, [[x - Math.cos(aa) * r, y - Math.sin(aa) * r], [x + Math.cos(aa) * r, y + Math.sin(aa) * r]], { w: 1.8 * K, alpha: 0.7 * a, wobble: 0, seed: 7300 + i * 3 + q });
      }
    }
  }
  // the glass clinks down
  const clink = env(t, T.lower1 - 0.05, T.lower1 + 0.4, 0.05, 0.25);
  if (clink > 0.01) {
    for (let i = 0; i < 3; i++) {
      const aa = -Math.PI / 2 + (i - 1) * 0.55;
      const c = [G0[0] + (i - 1) * 3, G0[1] - GL.h - 8];
      path(ctx, [[c[0] + Math.cos(aa) * 6, c[1] + Math.sin(aa) * 6], [c[0] + Math.cos(aa) * 16, c[1] + Math.sin(aa) * 16]], { w: 1.8 * K, alpha: 0.7 * clink, wobble: 0, seed: 7310 + i });
    }
  }
}

// ------------------------------------------------------------------ the world
// A building of frames around his room, each with someone in it.
const CELLS = [
  [-2, 0, 'cat'], [-1, 0, 'cook'], [1, 0, 'homework'], [2, 0, 'laundry'],
  [-2, -1, 'guitar'], [-1, -1, 'tea'], [0, -1, 'sleep'], [1, -1, 'water'], [2, -1, 'phone'],
  [-2, -2, 'stretch'], [-1, -2, 'fan'], [0, -2, 'read'], [1, -2, 'her'], [2, -2, 'look'],
];

function drawWorld(ctx, t, tg, cam, K) {
  const vx0 = cam.x - 960 / cam.z;
  const vx1 = cam.x + 960 / cam.z;
  const vy0 = cam.y - 540 / cam.z;
  const vy1 = cam.y + 540 / cam.z;
  // ground and roof run off both edges
  F.stroke = 20000;
  path(ctx, [[vx0 - 200, GROUND], [vx1 + 200, GROUND]], { w: 4 * K, wobble: 1.3 * K, seed: 20001 });
  if (ROOF > vy0 - 200) {
    path(ctx, [[vx0 - 200, ROOF], [vx1 + 200, ROOF]], { w: 5 * K, wobble: 1.3 * K, seed: 20002 });
    path(ctx, [[vx0 - 200, ROOF + 40], [vx1 + 200, ROOF + 40]], { w: 2.4 * K, alpha: 0.6, wobble: 1.3 * K, seed: 20003 });
    // a water tank and an aerial on the roof
    rect(ctx, -1250, ROOF - 260, 380, 260, { w: 4 * K, wobble: 1.3 * K, seed: 20004, fill: COL.paper });
    path(ctx, [[-1270, ROOF - 260], [-1060, ROOF - 360], [-850, ROOF - 260]], { w: 4 * K, wobble: 1.3 * K, seed: 20005 });
    path(ctx, [[2100, ROOF], [2100, ROOF - 420]], { w: 3.4 * K, wobble: 1.3 * K, seed: 20006 });
    path(ctx, [[1980, ROOF - 330], [2220, ROOF - 330]], { w: 3 * K, wobble: 1.3 * K, seed: 20007 });
    path(ctx, [[2010, ROOF - 250], [2190, ROOF - 250]], { w: 3 * K, wobble: 1.3 * K, seed: 20008 });
    // the afternoon sun over it all
    const sx = 4200;
    const sy = ROOF - 720;
    circle(ctx, sx, sy, 150, { w: 4 * K, wobble: 1.3 * K, fill: 'rgba(255,252,244,0.9)', seed: 20010 });
    for (let i = 0; i < 12; i++) {
      const aa = tg * 0.1 + (i / 12) * TAU;
      line(ctx, sx + Math.cos(aa) * 200, sy + Math.sin(aa) * 200, sx + Math.cos(aa) * (i % 2 ? 250 : 280), sy + Math.sin(aa) * (i % 2 ? 250 : 280), { w: 3.6 * K, wobble: 1.3 * K, seed: 20011 + i });
    }
    for (let i = 0; i < 3; i++) {
      const bx = -2600 + ((tg - 133) * 380 + i * 420) % 6000;
      const by = ROOF - 900 - i * 140 + 40 * Math.sin(tg + i);
      birdW(ctx, bx, by, 3.2 - i * 0.4, tg * 1.4 + i * 0.3, K, 20030 + i * 2);
    }
  }
  // far away the hand wobble is under a pixel: draw the people and props
  // straight (much cheaper); the frames keep theirs
  const far = cam.z < 0.4;
  CELLS.forEach(([i, j, kind], n) => {
    const ox = i * PX;
    const oy = j * PY;
    if (ox + ROOM.x + ROOM.w < vx0 - 50 || ox + ROOM.x > vx1 + 50) return;
    if (oy + ROOM.y + ROOM.h < vy0 - 50 || oy + ROOM.y > vy1 + 50) return;
    F.stroke = 21000 + n * 400;
    ctx.save();
    ctx.translate(ox, oy);
    roomFrame(ctx, K, 21000 + n * 400);
    WOBK = far ? 0 : 1;
    try {
      CELL[kind](ctx, tg + n * 0.7, K, 22000 + n * 400);
    } finally {
      WOBK = 1;
    }
    ctx.restore();
  });
}

function birdW(ctx, x, y, s, flap, K, seed) {
  const k = Math.sin(flap * TAU) * 0.6;
  const wv = 16 * s;
  const o = { w: 2.6 * K, wobble: 0.4 * K };
  path(ctx, [[x - wv, y - wv * (0.35 + k)], [x - wv * 0.45, y - wv * 0.1], [x, y]], { ...o, seed });
  path(ctx, [[x, y], [x + wv * 0.45, y - wv * 0.1], [x + wv, y - wv * (0.35 + k)]], { ...o, seed: seed + 1 });
}

const SY = standY(FLOOR, S); // hip y standing
const sitY = (seat, s = S) => seat - 3 * s;
function backWindow(ctx, x, y, w, h, K, sd) {
  const o = { w: 3.4 * K, wobble: 1.2 * K * WOBK };
  rect(ctx, x, y, w, h, { ...o, seed: sd, over: 5 });
  path(ctx, [[x - 22, y + h + 12], [x + w + 22, y + h + 12]], { ...o, seed: sd + 1 });
}
function chairK(ctx, x, s, f, K) {
  return chair(ctx, x, FLOOR, s, f, { w: 4 * K });
}
function tableK(ctx, x0, x1, top, K, sd) {
  const o = { w: 4.6 * K, wobble: 1.2 * K * WOBK };
  path(ctx, [[x0, top], [x1, top]], { ...o, w: 5 * K, seed: sd });
  path(ctx, [[x0 + 24, top], [x0 + 22, FLOOR]], { ...o, seed: sd + 1 });
  path(ctx, [[x1 - 24, top], [x1 - 22, FLOOR]], { ...o, seed: sd + 2 });
}
function reach(p, handA, handB) {
  const j = joints(p);
  if (handA) [p.aA1, p.aA2] = armTo(j.armRoot, handA, p.f, p.s);
  if (handB) [p.aB1, p.aB2] = armTo(j.armRoot, handB, p.f, p.s);
  return p;
}

const CELL = {
  cat(ctx, tg, K, sd) {
    // nobody home: a cat on the sill, tail swinging
    backWindow(ctx, 760, 260, 460, 360, K, sd);
    const o = { w: 3.4 * K, wobble: 0.9 * K * WOBK };
    const cx = 990;
    const cy = 632 - 2;
    path(ctx, ellipsePts(cx, cy - 46, 40, 48, Math.PI * 0.95, Math.PI * 2.05, 16), { ...o, seed: sd + 5 });
    circle(ctx, cx, cy - 116, 28, { ...o, fill: COL.paper, seed: sd + 6 });
    path(ctx, [[cx - 24, cy - 128], [cx - 20, cy - 156], [cx - 6, cy - 141]], { ...o, seed: sd + 7 });
    path(ctx, [[cx + 6, cy - 141], [cx + 20, cy - 156], [cx + 24, cy - 128]], { ...o, seed: sd + 8 });
    const sw = 0.5 * Math.sin(tg * 1.4);
    path(ctx, [[cx + 38, cy - 8], [cx + 80, cy - 4 + 10 * sw], [cx + 100 + 20 * sw, cy - 40], [cx + 92 + 30 * sw, cy - 76]], { ...o, seed: sd + 9 });
  },
  cook(ctx, tg, K, sd) {
    const o = { w: 4 * K, wobble: 1.2 * K * WOBK };
    rect(ctx, 1050, 760, 460, 180, { ...o, seed: sd, fill: COL.paper });
    path(ctx, [[1030, 760], [1530, 760]], { ...o, w: 5 * K, seed: sd + 1 });
    // pan + steam
    const px = 1180;
    path(ctx, [[px - 70, 742], [px - 60, 758], [px + 60, 758], [px + 70, 742]], { ...o, seed: sd + 2 });
    path(ctx, [[px - 70, 745], [px - 160, 730]], { ...o, seed: sd + 3 });
    for (let i = 0; i < 3; i++) {
      const pts = [];
      for (let k = 0; k <= 8; k++) pts.push([px - 30 + i * 30 + 8 * Math.sin(k * 0.9 - tg * 3 + i), 720 - k * 18]);
      path(ctx, pts, { w: 2.2 * K, alpha: 0.45, wobble: 0.4 * K * WOBK, seed: sd + 4 + i });
    }
    const p = pose({ x: 900, y: SY, s: S, f: 1, lean: 0.06, head: 0.25, look: 0.6 });
    reach(p, [px - 150, 728 + 4 * Math.sin(tg * 2)], [px + 10 + 20 * Math.sin(tg * 3), 715]);
    fig(ctx, p, { id: 31 }, K);
  },
  homework(ctx, tg, K, sd) {
    backWindow(ctx, 330, 230, 380, 300, K, sd);
    const top = desk(ctx, 1080, FLOOR, 1.5, { w: 4 * K });
    const seat = chairK(ctx, 900, 1.25, 1, K);
    // lamp
    const o = { w: 3.4 * K, wobble: 1 * K * WOBK };
    path(ctx, [[1170, top], [1150, top - 120], [1110, top - 150]], { ...o, seed: sd + 2 });
    path(ctx, [[1080, top - 168], [1140, top - 130], [1095, top - 120], [1080, top - 168]], { ...o, seed: sd + 3 });
    path(ctx, [[1030, top - 3], [1090, top - 3]], { ...o, w: 3 * K, seed: sd + 4 });
    const s = 1.2;
    const p = pose({ ...SIT, x: 900, y: sitY(seat, s), s, f: 1, lean: 0.3, head: 0.35, look: 1 });
    reach(p, [1050 + 6 * Math.sin(tg * 7), top - 6], [1020, top - 2]);
    fig(ctx, p, { id: 32 }, K);
  },
  laundry(ctx, tg, K, sd) {
    const o = { w: 2.6 * K, wobble: 1 * K * WOBK };
    path(ctx, [[400, 330], [960, 380], [1500, 330]], { ...o, seed: sd });
    for (let i = 0; i < 4; i++) {
      const x = 520 + i * 230;
      const y = 340 + 34 * Math.sin(((x - 400) / 1100) * Math.PI) ** 0.9;
      const sw = 0.04 * Math.sin(tg * 1.3 + i);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(sw);
      path(ctx, [[-40, 0], [-60, 30], [-40, 40], [-36, 120], [36, 120], [40, 40], [60, 30], [40, 0], [-40, 0]], { w: 3 * K, wobble: 1 * K * WOBK, fill: COL.paper, seed: sd + 1 + i });
      ctx.restore();
    }
    const p = pose({ x: 1560, y: SY, s: S, f: -1, lean: -0.05, head: -0.3, look: -0.8 });
    reach(p, [1470, 330 + 6 * Math.sin(tg * 2)], null);
    p.aB1 = 0.15;
    p.aB2 = 0.2;
    fig(ctx, p, { id: 33 }, K);
  },
  guitar(ctx, tg, K, sd) {
    backWindow(ctx, 1120, 240, 380, 300, K, sd);
    const o = { w: 3.4 * K, wobble: 1 * K * WOBK };
    // stool
    path(ctx, [[860, 850], [960, 850]], { ...o, w: 4.4 * K, seed: sd + 2 });
    path(ctx, [[870, 850], [860, FLOOR]], { ...o, seed: sd + 3 });
    path(ctx, [[950, 850], [960, FLOOR]], { ...o, seed: sd + 4 });
    const p = pose({ ...SIT, x: 910, y: 846, s: S, f: 1, lean: 0.05, head: 0.2, look: 0.5 });
    // guitar on his lap
    const gx = 990;
    const gy = 790;
    path(ctx, ellipsePts(gx, gy, 44, 34, 0, TAU, 16), { ...o, fill: COL.paper, seed: sd + 5 });
    path(ctx, ellipsePts(gx + 50, gy - 30, 30, 24, 0, TAU, 14), { ...o, fill: COL.paper, seed: sd + 6 });
    path(ctx, [[gx + 66, gy - 44], [gx + 210, gy - 140]], { ...o, w: 5 * K, seed: sd + 7 });
    circle(ctx, gx + 30, gy - 16, 9, { ...o, w: 2.2 * K, seed: sd + 8 });
    reach(p, [gx + 10, gy - 30 + 14 * Math.sin(tg * 5)], [gx + 150, gy - 112]);
    fig(ctx, p, { id: 34 }, K);
  },
  tea(ctx, tg, K, sd) {
    backWindow(ctx, 760, 220, 400, 300, K, sd);
    tableK(ctx, 820, 1100, 770, K, sd + 2);
    const sa = chairK(ctx, 700, S, 1, K);
    const sb = chairK(ctx, 1220, S, -1, K);
    const o = { w: 3 * K, wobble: 1 * K * WOBK };
    path(ctx, [[880, 770], [884, 740], [910, 740], [914, 770]], { ...o, seed: sd + 5 });
    path(ctx, [[1006, 770], [1010, 740], [1036, 740], [1040, 770]], { ...o, seed: sd + 6 });
    const pa = pose({ ...SIT, x: 700, y: sitY(sa), s: S, f: 1, head: -0.05 });
    reach(pa, [870, 760], [860, 765]);
    const g = Math.max(0, Math.sin(tg * 2.2));
    const pb = pose({ ...SIT, x: 1220, y: sitY(sb), s: S, f: -1, head: -0.08 + 0.06 * Math.sin(tg * 2.2) });
    reach(pb, [1080 - 30 * g, 700 - 40 * g], [1060, 765]);
    fig(ctx, pa, { id: 35 }, K);
    fig(ctx, pb, { id: 36 }, K);
    // a little laugh
    for (let i = 0; i < 2; i++) path(ctx, [[1150 + i * 16, 590 - i * 6], [1162 + i * 16, 576 - i * 6]], { w: 2.4 * K, alpha: 0.6 * g, wobble: 0, seed: sd + 8 + i });
  },
  sleep(ctx, tg, K, sd) {
    backWindow(ctx, 1150, 240, 360, 280, K, sd);
    const o = { w: 4 * K, wobble: 1.2 * K * WOBK };
    // bed
    path(ctx, [[520, 820], [1360, 820]], { ...o, w: 5 * K, seed: sd + 2 });
    path(ctx, [[520, 700], [520, FLOOR]], { ...o, seed: sd + 3 });
    path(ctx, [[1360, 760], [1360, FLOOR]], { ...o, seed: sd + 4 });
    path(ctx, ellipsePts(620, 790, 62, 24, 0, TAU, 16), { ...o, w: 3 * K, fill: COL.paper, seed: sd + 5 });
    circle(ctx, 640, 762, 32, { ...o, fill: COL.paper, seed: sd + 6 });
    path(ctx, [[628, 760], [640, 762]], { w: 2.4 * K, wobble: 0, seed: sd + 7 });
    const b = 6 * Math.sin(tg * 1.2);
    path(ctx, [[660, 800], [700, 760 - b], [900, 752 - b], [1180, 770], [1260, 748], [1330, 800]], { ...o, fill: COL.paper, seed: sd + 8 });
    // zz
    for (let i = 0; i < 2; i++) {
      const k = ((tg * 0.4 + i * 0.5) % 1);
      const x = 700 + 40 * k + i * 10;
      const y = 700 - 120 * k;
      const s = 14 + 8 * k;
      path(ctx, [[x, y], [x + s, y], [x, y + s], [x + s, y + s]], { w: 2.6 * K, alpha: Math.sin(Math.PI * k), wobble: 0, seed: sd + 10 + i });
    }
  },
  water(ctx, tg, K, sd) {
    backWindow(ctx, 900, 240, 420, 320, K, sd);
    const o = { w: 3.4 * K, wobble: 1 * K * WOBK };
    // plant on a stand
    path(ctx, [[1100, 760], [1110, 830], [1170, 830], [1180, 760], [1100, 760]], { ...o, fill: COL.paper, seed: sd + 2 });
    path(ctx, [[1100, 830], [1100, FLOOR]], { ...o, seed: sd + 3 });
    path(ctx, [[1180, 830], [1180, FLOOR]], { ...o, seed: sd + 4 });
    for (let i = 0; i < 4; i++) {
      const a = -Math.PI / 2 + (i - 1.5) * 0.45;
      path(ctx, [[1140, 760], [1140 + Math.cos(a) * 50, 760 + Math.sin(a) * 70], [1140 + Math.cos(a) * 90, 750 + Math.sin(a) * 90]], { ...o, seed: sd + 5 + i });
    }
    const p = pose({ x: 830, y: SY, s: S, f: 1, head: 0.25, look: 0.6 });
    const h = [960, 690];
    reach(p, h, null);
    fig(ctx, p, { id: 37 }, K);
    // can + drops
    path(ctx, [[h[0] - 20, h[1] - 10], [h[0] + 30, h[1] - 10], [h[0] + 30, h[1] + 34], [h[0] - 20, h[1] + 34], [h[0] - 20, h[1] - 10]], { ...o, fill: COL.paper, seed: sd + 9 });
    path(ctx, [[h[0] + 30, h[1] + 10], [h[0] + 90, h[1] - 20]], { ...o, seed: sd + 10 });
    for (let i = 0; i < 5; i++) {
      const k = (tg * 1.6 + i / 5) % 1;
      dot(ctx, h[0] + 96 + 30 * k, h[1] - 14 + 60 * k * k + 30 * k, 3.4 * Math.min(K, 2.5), COL.ink, 0.6);
    }
  },
  phone(ctx, tg, K, sd) {
    backWindow(ctx, 420, 240, 380, 300, K, sd);
    const x = 1150 + 90 * Math.sin(tg * 0.5);
    const p = pose({ x, y: SY, s: S, f: Math.cos(tg * 0.5) > 0 ? 1 : -1, head: 0.05 });
    const j = joints(p);
    reach(p, [j.head[0] + p.f * 4, j.head[1] + 10], null);
    p.aB1 = 0.35 + 0.25 * Math.sin(tg * 2.3);
    p.aB2 = 0.9;
    fig(ctx, p, { id: 38 }, K);
  },
  stretch(ctx, tg, K, sd) {
    backWindow(ctx, 1040, 230, 420, 320, K, sd);
    const sw = Math.sin(tg * 0.9);
    const p = pose({ view: 'front', x: 760, y: SY, s: S, lean: 0.12 * sw, aA1: 2.75, aA2: 0.2, aB1: 2.75, aB2: 0.2, lA1: 0.12, lB1: 0.12, head: 0.1 * sw });
    fig(ctx, p, { id: 39, eye: 'closed' }, K);
  },
  fan(ctx, tg, K, sd) {
    backWindow(ctx, 1060, 230, 400, 300, K, sd);
    const seat = chairK(ctx, 820, S, 1, K);
    const p = pose({ ...SIT, x: 820, y: sitY(seat), s: S, f: 1, lean: -0.08, head: -0.05 });
    const j = joints(p);
    const ph = Math.sin(tg * 7);
    const h = [j.head[0] + 70, j.head[1] + 40 + 14 * ph];
    reach(p, h, [900, 840]);
    fig(ctx, p, { id: 40, eye: 'closed' }, K);
    // a hand fan
    const a = -0.9 + 0.3 * ph;
    const pts = [h, ...ellipsePts(h[0], h[1], 70, 70, a - 0.7, a + 0.7, 10), h];
    path(ctx, pts, { w: 3 * K, wobble: 0.8 * K * WOBK, fill: COL.paper, seed: sd + 3 });
  },
  read(ctx, tg, K, sd) {
    backWindow(ctx, 420, 230, 400, 300, K, sd);
    // armchair
    const o = { w: 4 * K, wobble: 1.2 * K * WOBK };
    const x = 1150;
    path(ctx, [[x - 90, 850], [x + 80, 850], [x + 80, 900], [x - 90, 900], [x - 90, 850]], { ...o, fill: COL.paper, seed: sd + 2 });
    path(ctx, [[x + 80, 900], [x + 100, 660], [x + 130, 650], [x + 120, 900]], { ...o, fill: COL.paper, seed: sd + 3 });
    path(ctx, [[x - 80, 900], [x - 80, FLOOR]], { ...o, seed: sd + 4 });
    path(ctx, [[x + 110, 900], [x + 110, FLOOR]], { ...o, seed: sd + 5 });
    const p = pose({ ...SIT, x: x + 30, y: 846, s: S, f: -1, lean: -0.15, head: 0.3, look: 0.8 });
    const b = [x - 80, 720];
    reach(p, [b[0] + 6, b[1] + 12], [b[0] - 6, b[1] + 14]);
    fig(ctx, p, { id: 41 }, K);
    // open book
    const turn = ((tg * 0.25) % 1) < 0.12;
    path(ctx, [[b[0] - 34, b[1] - 30], [b[0], b[1] - 20], [b[0] + 30, b[1] - 34], [b[0] + 30, b[1] + 16], [b[0], b[1] + 28], [b[0] - 34, b[1] + 18], [b[0] - 34, b[1] - 30]], { w: 3 * K, wobble: 0.8 * K * WOBK, fill: COL.paper, seed: sd + 6 });
    path(ctx, [[b[0], b[1] - 20], [b[0], b[1] + 28]], { w: 2 * K, wobble: 0.5 * K * WOBK, seed: sd + 7 });
    if (turn) path(ctx, [[b[0], b[1] - 20], [b[0] - 10, b[1] - 50], [b[0] - 20, b[1] - 28]], { w: 2 * K, alpha: 0.7, wobble: 0, seed: sd + 8 });
  },
  her(ctx, tg, K, sd) {
    // a girl with a gold hair tie, sitting by her window
    const wx = 760;
    const wy = 250;
    const ww = 460;
    const wh = 360;
    rect(ctx, wx, wy, ww, wh, { w: 3.4 * K, wobble: 1.2 * K * WOBK, seed: sd, over: 5 });
    path(ctx, [[wx - 26, wy + wh + 14], [wx + ww + 26, wy + wh + 14]], { w: 4 * K, wobble: 1.2 * K * WOBK, seed: sd + 1 });
    // a little cloud in her window
    path(ctx, [...ellipsePts(wx + 150, wy + 120, 34, 26, Math.PI, TAU, 8), ...ellipsePts(wx + 196, wy + 108, 30, 30, Math.PI, TAU, 8), ...ellipsePts(wx + 236, wy + 122, 24, 20, Math.PI, TAU, 8), [wx + 262, wy + 124], [wx + 116, wy + 124]], { w: 2.4 * K, alpha: 0.7, wobble: 0.6 * K * WOBK, close: true, seed: sd + 2 });
    const o = { w: 4 * K, wobble: 1.2 * K * WOBK };
    // stool
    path(ctx, [[930, 850], [1050, 850]], { ...o, w: 4.6 * K, seed: sd + 3 });
    path(ctx, [[945, 850], [935, FLOOR]], { ...o, seed: sd + 4 });
    path(ctx, [[1035, 850], [1045, FLOOR]], { ...o, seed: sd + 5 });
    const p = pose({ view: 'back', x: 990, y: 846, s: S, ...SIT_BACK, head: -0.05, tail: 0.14 * Math.sin(tg * 1.1) });
    const j = fig(ctx, p, { id: 2, ponytail: true, legs: false, seat: true, noTie: true }, K);
    // the tie, kept readable however far the camera goes
    const tie = [j.head[0], j.head[1] - j.r * 0.2];
    dot(ctx, tie[0], tie[1], Math.max(5.4 * S, 5.4 * K), COL.gold);
  },
  look(ctx, tg, K, sd) {
    backWindow(ctx, 600, 240, 460, 340, K, sd);
    const p = pose({ view: 'back', x: 830, y: SY, s: S, aA1: 0.3, aA2: -0.6, aB1: 0.3, aB2: -0.6, turn: 0.3 * Math.sin(tg * 0.4) });
    fig(ctx, p, { id: 42 }, K);
  },
};
