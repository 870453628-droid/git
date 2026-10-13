// s08 — 那天究竟是沉默还是说了些什么，如今竟一点也记不真切了，只记得风很轻，
//       太阳很暖。我甚至无法纪念那一天，身处其中的时候，只觉得一切都平凡得
//       如同寻常日子。
// Back on the ledge, but the memory won't hold still: were they talking or
// silent? The two versions flicker over each other, lines wavering. Then the
// memory dissolves until only the wind and the warm sun are left. The sun
// turns out to be one tiny sun in one frame of a huge calendar of identical
// days; he stands in front of it and can't tell which day it was. We go into
// one: just an ordinary day. Back out: it's lost among countless others.
import { W, H, COL, F, lerp, clamp, smooth, keys, ease, hash2, path, ellipsePts, dot, hatch, camera, setStill } from '../lib.js';
import { figure, pose, standY, SIT_FRONT, LOOK_UP, walk, walkPhase } from '../figure.js';
import { sun, cloud, bird, windLine, ridgePts, ridge, frameBox, LEDGE } from '../sets.js';
import { day, her, DAY } from './s06.js';

// ------------------------------------------------------------------ timing
// scene-local seconds (scene starts at 51.75)
const T = {
  memA: 2.4, memB: 4.9, // 54.25 记不真切: the memory dissolves
  camA: 4.9, camB: 7.3, // 56.65 风很轻，太阳很暖: drift to the sun
  match: 7.3, // the sun becomes one cell's sun
  outA: 7.35, outB: 8.4, // pull back to the calendar
  inA: 9.6, inB: 10.75, // 61.35 身处其中: into one day
  backA: 11.3, backB: 13.95, // 63.05 寻常日子: back out, lost among the others
};

// ------------------------------------------------------------- the ledge
const CAM0 = { x: 960, y: 560, z: 1.06 }; // where s05 left the camera
const SUN = LEDGE.sun;
const SUN_R = 44;
const CAM1 = { x: SUN[0], y: SUN[1], z: 1.25 }; // the sun in the middle

function ledgeCam(lt) {
  const k = smooth(lt, T.camA, T.camB, ease.inOut);
  const z0 = lerp(CAM0.z, 1.09, smooth(lt, 0, T.camA, ease.sine));
  return { x: lerp(CAM0.x, CAM1.x, k), y: lerp(CAM0.y, CAM1.y, k), z: Math.exp(lerp(Math.log(z0), Math.log(CAM1.z), k)) };
}

// talking (1) or silent (0)? The memory can't settle.
// 沉默 (~52.7) leans silent, 说了些什么 (~53.4) leans talking, then it slips.
const TALK = [[0, 0], [0.3, 0], [0.5, 0.7], [0.72, 0.7], [0.92, 0], [1.45, 0], [1.68, 1], [2.15, 1], [2.35, 0.25], [2.55, 0.55], [2.95, 0]];

function ledgeMemory(ctx, t, lt) {
  const L = LEDGE;
  const mem = smooth(lt, T.memA, T.memB, ease.inOut);
  const fadeA = (a, b) => 1 - smooth(mem, a, b);
  const memDash = mem > 0.02 ? [lerp(60, 7, clamp(mem * 1.4)), lerp(0, 12, clamp(mem * 1.4))] : undefined;
  const aBg = fadeA(0, 0.45);
  const aLedge = fadeA(0.25, 0.7);
  const aFig = fadeA(0.5, 0.95);

  // the sun stays, and warms
  if (lt < T.match) {
    const glow = 0.35 + 0.9 * mem + 0.5 * smooth(lt, T.camA, T.camB - 0.5);
    F.stroke = 900;
    sun(ctx, SUN[0], SUN[1], SUN_R, { spin: t * 0.05, glow });
  }
  F.stroke = 1000;
  if (aBg > 0.01) {
    const far = ridgePts(4, -40, W + 40, 520, 90, { freq: 1 / 380, sharp: 1.6 });
    ridge(ctx, far, { w: 2.4, alpha: 0.55 * aBg, fillAlpha: aBg, seed: 610 });
    const near = ridgePts(9, -40, W + 40, 585, 60, { freq: 1 / 300, sharp: 1.4 });
    ridge(ctx, near, { w: 2.8, alpha: 0.75 * aBg, fillAlpha: aBg, seed: 611 });
    stamp(ctx, statics().near, aBg);
    cloud(ctx, 520 + Math.sin(t * 0.1) * 20, 210, 0.9, { alpha: 0.8 * aBg, seedStroke: 612 });
    cloud(ctx, 1180 + Math.sin(t * 0.08 + 1) * 24, 140, 0.6, { alpha: 0.7 * aBg, seedStroke: 613, seed: 2 });
    for (let i = 0; i < 2; i++) {
      const bx = ((t * 30 + i * 400) % 2300) - 200;
      bird(ctx, bx, 300 + i * 40 + Math.sin(t * 0.8 + i) * 10, 0.8, t * 1.3 + i * 0.4, { alpha: 0.8 * aBg, seed: 620 + i * 2 });
    }
  }
  if (aLedge > 0.01) {
    ctx.save();
    ctx.globalAlpha *= aLedge;
    ctx.fillStyle = COL.paper;
    ctx.fillRect(L.x0, L.y, L.x1 - L.x0, H + 20 - L.y);
    ctx.restore();
    stamp(ctx, statics().ledge, aLedge);
    frameBox(ctx, L.x0, L.y, L.x1 - L.x0, H - L.y + 80, { alpha: aLedge, dash: memDash, seed: 650, w: 6 });
  }

  if (aFig > 0.01) {
    const talk = keys(lt, TALK, ease.inOut);
    const waver = smooth(lt, 0.2, 1.0) * (1 - smooth(lt, 3.6, 4.6));
    const wob = 1.1 + 1.7 * waver;
    const s = L.s;
    const hipY = L.y - 3;
    const sw = Math.sin(t * 2.1);
    const legs = { lB2: -0.08 + 0.03 * Math.sin(t * 1.7) };
    // two versions of the same afternoon, one over the other
    for (const [v, a] of [[0, 1 - talk], [1, talk]]) {
      if (a * aFig < 0.02) continue;
      const jx = v ? 3 * Math.sin(lt * 3.1) * waver : 0; // the uncertain one drifts
      const boy = pose({
        view: 'front', x: L.boyX + jx, y: hipY, s, ...SIT_FRONT, ...legs,
        turn: v ? 0.9 : 0.09, head: v ? 0.16 : 0.012, lean: v ? 0.06 : 0.003,
      });
      const girl = pose({
        view: 'front', x: L.girlX - jx, y: hipY, s, ...SIT_FRONT,
        look: v ? 0 : -0.85, head: v ? -0.16 : -0.05 + 0.04 * Math.sin(t * 0.6), turn: v ? -0.85 : -0.1, lean: v ? -0.06 : 0,
        lA2: -0.08 + 0.07 * sw, lB2: -0.08 - 0.07 * sw,
        tail: 0.2 * Math.sin(t * 1.25),
      });
      figure(ctx, boy, { id: 1, alpha: aFig * a, dash: memDash, wobble: wob });
      her(ctx, girl, { alpha: aFig * a, dash: memDash, wobble: wob });
    }
    // words between them, or nothing
    const words = talk * aFig;
    if (words > 0.02) {
      bubble(ctx, 895, 318, 52, 30, [858, 410], words * env01(lt, 0.35, 2.6), 8100, lt);
      bubble(ctx, 1035, 290, 50, 28, [1086, 400], words * env01(lt, 1.72, 2.6), 8200, lt);
    }
    // ... and in the end only a question
    const q = smooth(lt, 2.3, 2.6) * (1 - smooth(lt, 3.5, 4.0)) * aFig;
    if (q > 0.01) question(ctx, 962, 330, 1.1, q);
  }
}

const env01 = (t, a, b) => smooth(t, a, a + 0.12) * (1 - smooth(t, b - 0.15, b));

function bubble(ctx, cx, cy, rx, ry, tip, a, sd, lt) {
  if (a <= 0.01) return;
  const pts = ellipsePts(cx, cy, rx, ry, 0, Math.PI * 2, 26);
  const ang = Math.atan2(tip[1] - cy, tip[0] - cx);
  const e1 = [cx + Math.cos(ang - 0.25) * rx * 0.95, cy + Math.sin(ang - 0.25) * ry * 0.95];
  const e2 = [cx + Math.cos(ang + 0.25) * rx * 0.95, cy + Math.sin(ang + 0.25) * ry * 0.95];
  const tp = [lerp(cx, tip[0], 0.75), lerp(cy, tip[1], 0.75)];
  path(ctx, pts, { w: 2.6, alpha: a, fill: COL.paper, close: true, seed: sd });
  path(ctx, [e1, tp, e2], { w: 2.6, alpha: a, fill: COL.paper, seed: sd + 1 });
  for (let n = 0; n < 2; n++) {
    const yy = cy + (n - 0.5) * 14;
    const sq = [];
    for (let m = 0; m <= 12; m++) {
      const u = m / 12;
      sq.push([cx - rx * 0.6 + u * rx * (n ? 0.85 : 1.2), yy + Math.sin(u * 12 + n * 2 + sd + lt * 3) * 3.5]);
    }
    path(ctx, sq, { w: 2, alpha: a * 0.85, seed: sd + 5 + n });
  }
}

function question(ctx, x, y, s, a) {
  const pts = [];
  for (let i = 0; i <= 14; i++) {
    const u = i / 14;
    const ang = lerp(-2.6, 0.9, u);
    pts.push([x + Math.cos(ang) * 17 * s, y - 14 * s + Math.sin(ang) * 15 * s]);
  }
  pts.push([x + 3 * s, y + 8 * s], [x + 1 * s, y + 18 * s]);
  path(ctx, pts, { w: 3.4, alpha: a, seed: 8400 });
  dot(ctx, x + 1 * s, y + 31 * s, 3.4 * s, COL.ink, a);
}

// The pencil hatching under the hills and on the ledge doesn't change, so it
// is drawn once (still, fixed seeds) and stamped.
let STATIC = null;
function statics() {
  if (STATIC) return STATIC;
  const mk = (fn) => {
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const g = c.getContext('2d');
    const saved = F.stroke;
    const still = F.still;
    setStill(true);
    fn(g);
    setStill(still);
    F.stroke = saved;
    return c;
  };
  const L = LEDGE;
  STATIC = {
    near: mk((g) => {
      const pts = ridgePts(9, -40, W + 40, 585, 60, { freq: 1 / 300, sharp: 1.4 });
      const poly = [...pts, [pts[pts.length - 1][0], H + 20], [pts[0][0], H + 20]];
      hatch(g, poly, { alpha: 0.1, gap: 16, angle: -1.0, seed: 700 });
    }),
    ledge: mk((g) => hatch(g, [L.x0 + 10, L.y + 30, L.x1 - L.x0 - 20, H - L.y], { alpha: 0.13, gap: 20, seed: 640 })),
  };
  return STATIC;
}
function stamp(ctx, c, a) {
  if (a <= 0.01) return;
  ctx.save();
  ctx.globalAlpha *= a;
  ctx.drawImage(c, 0, 0);
  ctx.restore();
}

// ---------------------------------------------------------- the calendar
// World units: ground at y = 0, the wall of days above it. One cell is the
// ordinary-day picture at 1/3 scale.
const C = 1 / 3;
const CW = DAY.w * C; // 140
const CH = DAY.h * C; // 86.7
const PX = 170;
const PY = 114;
const GB = 350; // ground to the centre of the bottom row
const CSUN = 11; // a cell's sun radius (sun in the middle of the frame)
const ZM = (SUN_R * CAM1.z) / CSUN; // zoom at the match cut
const MATCH = [0, 3]; // the cell whose sun was the ledge's sun
const TARGET = [2, 1]; // the day we go into
const BOY_X0 = -150;
const BOY_S = 0.95;
const cellXY = (i, j) => [i * PX, -GB - j * PY];

// calendar camera: world anchor A shown at screen S with zoom z
const C1 = { S: [910, 1000], A: [0, 0], z: 1 }; // the boy and the wall
function calCam(lt) {
  const m = cellXY(...MATCH);
  const tg = cellXY(...TARGET);
  const onScreen = (cam, p) => [cam.S[0] + (p[0] - cam.A[0]) * cam.z, cam.S[1] + (p[1] - cam.A[1]) * cam.z];
  const logz = (a, b, k) => Math.exp(lerp(Math.log(a), Math.log(b), k));
  if (lt < T.inA) {
    // pull back from the matched sun to the wide view
    const k = smooth(lt, T.outA, T.outB, ease.inOut);
    const s1 = onScreen(C1, m);
    return { A: m, S: [lerp(W / 2, s1[0], k), lerp(H / 2, s1[1], k)], z: logz(ZM, 1, k) };
  }
  if (lt < T.backA) {
    const k = smooth(lt, T.inA, T.inB, ease.inOut);
    const s0 = onScreen(C1, tg);
    return { A: tg, S: [lerp(s0[0], 960, k), lerp(s0[1], 455, k)], z: logz(1, 6, k) };
  }
  const k = smooth(lt, T.backA, T.backB, ease.inOut);
  const zEnd = 0.32;
  const sEnd = [1160, 985 + tg[1] * zEnd];
  return { A: tg, S: [lerp(960, sEnd[0], ease.out(k)), lerp(455, sEnd[1], k)], z: logz(6, zEnd, k) };
}

const toScreen = (cam, x, y) => [cam.S[0] + (x - cam.A[0]) * cam.z, cam.S[1] + (y - cam.A[1]) * cam.z];
const frameW = (z) => 3.8 * Math.pow(z * C, 0.6);
const sunW = (z) => (3.6 * CAM1.z) / Math.pow(ZM, 0.6) * Math.pow(z, 0.6);

// one cell: frame + its sun (at the centre). Drawn at screen (x, y), zoom z.
function cell(ctx, x, y, z, o = {}) {
  if ((o.frame ?? 1) > 0.01) frameBox(ctx, x - (CW / 2) * z, y - (CH / 2) * z, CW * z, CH * z, { w: frameW(z), over: 7 * Math.sqrt(z * C), alpha: o.frame ?? 1, seed: o.seed });
  if ((o.sun ?? 1) > 0.01) sun(ctx, x, y, CSUN * z, { w: sunW(z), spin: o.spin ?? 0, alpha: o.sun ?? 1 });
}

// Sprites: a few hand-drawn variants of a cell, redrawn every frame at the
// current zoom and stamped across the wall.
const NV = 4;
let spr = null;
function sprites(z, spin) {
  if (!spr) {
    spr = document.createElement('canvas');
    spr.width = 2048;
    spr.height = 1400;
  }
  const g = spr.getContext('2d');
  const pad = Math.ceil(10 + 9 * Math.sqrt(z));
  const hw = Math.ceil((CW / 2) * z) + pad;
  const hh = Math.ceil((CSUN * 1.8 > CH / 2 ? CSUN * 1.8 : CH / 2) * z) + pad;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, Math.min(spr.width, 4 * hw + 4), Math.min(spr.height, 4 * hh + 4));
  const out = [];
  for (let v = 0; v < NV; v++) {
    const cx = hw + (v % 2) * 2 * hw;
    const cy = hh + Math.floor(v / 2) * 2 * hh;
    F.stroke = 50000 + v * 100;
    cell(g, cx, cy, z, { seed: 5000 + v * 3, spin });
    out.push([cx - hw, cy - hh]);
  }
  return { hw, hh, src: out };
}

function calendar(ctx, t, lt) {
  const cam = calCam(lt);
  const z = cam.z;
  const spin = t * 0.05;
  const gridA = smooth(lt, T.match - 0.3, T.match + 0.35);
  // content of the target day (only when we go into it)
  const mSun = smooth(lt, T.inA + 0.15, T.inA + 0.75) * (1 - smooth(lt, T.backA + 0.3, T.backA + 0.85));
  const m = smooth(lt, T.inA + 0.5, T.inB) * (1 - smooth(lt, T.backA, T.backA + 0.45));
  const matchVector = lt < T.outB + 0.2;

  // the wall
  const { hw, hh, src } = sprites(z, spin);
  const x0 = cam.A[0] + (0 - cam.S[0]) / z;
  const x1 = cam.A[0] + (W - cam.S[0]) / z;
  const y0 = cam.A[1] + (0 - cam.S[1]) / z;
  const y1 = cam.A[1] + (H - cam.S[1]) / z;
  const i0 = Math.floor(x0 / PX) - 1;
  const i1 = Math.ceil(x1 / PX) + 1;
  const j0 = Math.max(0, Math.floor((-GB - y1) / PY) - 1);
  const j1 = Math.ceil((-GB - y0) / PY) + 1;
  for (let j = j0; j <= j1; j++) {
    for (let i = i0; i <= i1; i++) {
      if (i === TARGET[0] && j === TARGET[1] && mSun > 0.001) continue;
      if (matchVector && i === MATCH[0] && j === MATCH[1]) continue;
      const [wx, wy] = cellXY(i, j);
      const [sx, sy] = toScreen(cam, wx, wy);
      if (sx < -hw || sx > W + hw || sy < -hh || sy > H + hh) continue;
      const depth = lerp(0.28, 1, smooth(sy, 40, 760));
      // keep clear of the caption until it has gone
      const low = lerp(1, smooth(lt, T.match + 0.2, T.match + 0.6), smooth(sy, 640, 800));
      const a = gridA * depth * low;
      if (a < 0.01) continue;
      const v = Math.floor(hash2(i * 1.7 + 3, j * 2.3 + 1) * NV) % NV;
      ctx.globalAlpha = a;
      ctx.drawImage(spr, src[v][0], src[v][1], 2 * hw, 2 * hh, sx - hw, sy - hh, 2 * hw, 2 * hh);
    }
  }
  ctx.globalAlpha = 1;

  // the matched cell: its sun is the ledge's sun, still glowing
  if (matchVector) {
    const [sx, sy] = toScreen(cam, ...cellXY(...MATCH));
    const glow = lt < T.match ? 0 : 1.75 * (1 - smooth(lt, T.match, T.outB));
    if (glow > 0.01) {
      const r = CSUN * z;
      const gr = ctx.createRadialGradient(sx, sy, r * 0.6, sx, sy, r * 3.2);
      gr.addColorStop(0, `rgba(211,155,51,${0.22 * glow})`);
      gr.addColorStop(1, 'rgba(211,155,51,0)');
      ctx.fillStyle = gr;
      ctx.fillRect(sx - r * 3.2, sy - r * 3.2, r * 6.4, r * 6.4);
    }
    F.stroke = 51000;
    const depth = lerp(0.28, 1, smooth(sy, 40, 760));
    cell(ctx, sx, sy, z, { seed: 5100, spin, frame: gridA * lerp(1, depth, smooth(lt, T.outA, T.outB)), sun: lt < T.match ? 0 : lerp(1, depth, smooth(lt, T.outA, T.outB)) });
  }

  // the target day, when we go into it: the sun slips into the window,
  // the room and the two of them come in
  if (mSun > 0.001) {
    const [sx, sy] = toScreen(cam, ...cellXY(...TARGET));
    F.stroke = 52000;
    frameBox(ctx, sx - (CW / 2) * z, sy - (CH / 2) * z, CW * z, CH * z, { w: frameW(z), over: 7 * Math.sqrt(z * C), seed: 5200 });
    const k = z * C;
    const ms = ease.inOut(mSun);
    const sp = [lerp(0, DAY.sun[0], ms), lerp(0, DAY.sun[1], ms)];
    const sr = lerp(CSUN / C, DAY.sunR, ms);
    F.stroke = 52100;
    sun(ctx, sx + sp[0] * k, sy + sp[1] * k, sr * k, { w: lerp(sunW(z), 2.2 * Math.pow(k, 0.6), ms), spin });
    const lean = smooth(lt, 10.6, 11.0) * (1 - smooth(lt, 11.2, 11.6));
    if (m > 0.001) day(ctx, { x: sx, y: sy, k }, {
      frame: 0, sun: 0, set: m, boy: m, girl: m, chairs: false, t, seed: 53000,
      girlPose: { turn: -0.35 * lean, head: -0.1 - 0.08 * lean },
      boyPose: { head: 0.1, look: 0.6, aB1: 0.55, aB2: -1.1 },
    });
  }

  // the ground, and him in front of the wall of days
  const ga = smooth(lt, T.outA + 0.3, T.outB - 0.2);
  if (ga > 0.01 && z < 3) {
    const gy = toScreen(cam, 0, 0)[1];
    if (gy < H + 40) {
      path(ctx, [[-40, gy + 1], [W / 2, gy], [W + 40, gy + 2]], { w: Math.max(1.4, 3 * Math.pow(z, 0.6)), alpha: ga, seed: 5300 });
      drawBoy(ctx, cam, lt, ga, t);
    }
  }
}

function drawBoy(ctx, cam, lt, a, t) {
  // he looks for "that day" and can't tell which one it was
  const xs = [[8.55, BOY_X0], [9.0, BOY_X0 + 95]];
  const x = keys(lt, xs, ease.inOut);
  const walking = lt > 8.55 && lt < 9.0;
  const s = BOY_S * cam.z;
  const [sx, gy] = toScreen(cam, x, 0);
  let p;
  if (lt < 8.4) {
    // looking up to the left
    p = pose({ x: sx, y: standY(gy, s), s, f: -1, ...LOOK_UP, head: -0.4, look: -1 });
  } else if (lt < 8.55) {
    p = pose({ x: sx, y: standY(gy, s), s, view: 'front', head: -0.1, look: -0.8, turn: 0.4 });
  } else if (walking) {
    const w = walk(walkPhase((x - BOY_X0) * cam.z, s), gy, s, 1);
    p = pose({ x: sx, s, f: 1, ...w, head: -0.25, look: -0.6 });
  } else {
    // reaches toward one of them ... and lets the hand sink
    const up = smooth(lt, 9.0, 9.3) * (1 - smooth(lt, 9.45, 10.1));
    const back = smooth(lt, T.backA + 1.6, T.backB, ease.inOut); // at the very end: head down
    p = pose({
      x: sx, y: standY(gy, s), s, f: 1, head: lerp(-0.42, -0.3, up) + 0.75 * back, look: lerp(-1, -0.9, up) + 1.6 * back,
      aA1: lerp(0.14, 2.3, up), aA2: lerp(0.12, 0.06, up), lean: -0.03 * up + 0.05 * back,
    });
  }
  figure(ctx, p, { id: 1, alpha: a });
  // a small question above him
  const q = smooth(lt, 8.2, 8.45) * (1 - smooth(lt, 9.0, 9.3));
  if (q > 0.01) {
    const hy = gy - 300 * s;
    question(ctx, sx + 6 * s, hy, 0.75 * s, q * a);
  }
}

// ------------------------------------------------------------------ scene

// Draw fn into an offscreen layer and composite it, blurred by `blur` px.
// The blur runs on a half-size copy (a full-size canvas blur is too slow);
// small amounts cross-fade from the sharp layer.
let memC = null;
let halfC = null;
function softLayer(ctx, fn, blur) {
  if (!memC) {
    memC = document.createElement('canvas');
    memC.width = W;
    memC.height = H;
    halfC = document.createElement('canvas');
    halfC.width = W / 2;
    halfC.height = H / 2;
  }
  const g = memC.getContext('2d');
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalAlpha = 1;
  g.globalCompositeOperation = 'source-over';
  g.filter = 'none';
  g.clearRect(0, 0, W, H);
  fn(g);
  const q = smooth(blur, 0.15, 0.8);
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (q < 1) {
    ctx.globalAlpha = 1 - q;
    ctx.drawImage(memC, 0, 0);
  }
  if (q > 0) {
    const h = halfC.getContext('2d');
    h.setTransform(1, 0, 0, 1, 0, 0);
    h.clearRect(0, 0, W / 2, H / 2);
    h.filter = `blur(${Math.max(0.3, blur / 2).toFixed(2)}px)`;
    h.drawImage(memC, 0, 0, W / 2, H / 2);
    h.filter = 'none';
    ctx.globalAlpha = q;
    ctx.drawImage(halfC, 0, 0, W, H);
  }
  ctx.restore();
}

export default {
  draw(ctx, lt, info) {
    const t = info.t;

    // the memory (ledge, then only the sun)
    if (lt < T.outB) {
      const mem = smooth(lt, T.memA, T.memB, ease.inOut);
      const waver = smooth(lt, 0.2, 1.0) * (1 - smooth(lt, 3.6, 4.6));
      const blur = waver * (1.3 + 0.6 * Math.sin(lt * 4.3)) + 0.8 * Math.sin(Math.PI * clamp((mem - 0.2) / 0.7));
      const cam = ledgeCam(lt);
      softLayer(ctx, (l) => camera(l, cam, () => ledgeMemory(l, t, lt)), blur);
    }

    // the wind (kept in screen space so it stays clear of the caption)
    const wa = 1 - smooth(lt, T.match - 0.3, T.match + 0.4);
    if (wa > 0.01) {
      camera(ctx, CAM0, () => {
        for (let i = 0; i < 3; i++) {
          const per = 7;
          const k = ((t + i * 2.3) % per) / per;
          const mem = smooth(lt, T.memA, T.memB);
          windLine(ctx, -200 + i * 100, 300 + i * 120, 170 + 30 * i, k, { travel: 2000, curl: i !== 1, seed: 630 + i, alpha: (0.45 + mem * 0.25) * wa });
        }
        // once everything else has gone, a little more wind
        const more = smooth(lt, T.memB - 0.6, T.memB + 0.4) * wa;
        if (more > 0.01) {
          for (let i = 0; i < 2; i++) {
            const per = 6.2;
            const k = ((t + 1.1 + i * 3.1) % per) / per;
            windLine(ctx, -260 + i * 160, 210 + i * 250, 150 + 40 * i, k, { travel: 2100, curl: i === 0, seed: 640 + i, alpha: 0.55 * more });
          }
        }
      });
    }

    // the calendar of days
    if (lt >= T.match - 0.35) calendar(ctx, t, lt);
  },
};
