// s06 · 52–64 · 有人鼓掌，有人陪我走一段。/ 我笑了，又慌了—— / 我怎么还是这么在意？
// Medium tracking shot on the dusk road. Across the road someone gives him a
// thumbs-up; he glances. A girl with a ponytail runs up from behind and falls
// into step beside him (on the far lane, in step). A small oval of light
// blooms at his feet and travels with him; the camera eases in. He smiles at
// her — then looks down, sees the light, and the smile drops: his step
// falters, he stops dead, a small jolt back. She takes one more step, stops,
// turns round. Stillness: he stands in the little light looking down at it;
// the camera has stopped too. (62.6–64: no line — hold.)
//
// s06 and s07 are ONE take (s06 fadeOut 0, s07 fadeIn 0): everything lives
// here in take(); s07.js just runs it on. The take opens on s05's last
// framing in s05's own world (same road tiles, same walk, same camera, read
// live from s04.js), so the dissolve from s05 only takes the lamps and the
// crowds away.
import { W, H, COL, TAU, clamp, lerp, smooth, keys, ease, hash, camera, path, ellipse } from '../lib.js';
import { figure, pose, walk, reach, mixPose, LEG, BODY } from '../figure.js';
import { stage } from '../light.js';
import { ROAD } from '../road.js';
import { bird } from '../sets.js';
import * as S04 from './s04.js';

const R = ROAD;
// ------------------------------------------------------------------ cast
const S = 0.85; // him (world scale, as in s05); his feet on the near edge
const G = R.near;
const HS = 0.74; // her: a little smaller, and a lane further back —
const HG = (R.near + R.far) / 2 + 2; // her feet on the centre line
const OFF = 72; // she walks this far ahead of him
const TS = 0.62; // the one with the thumb, on the far verge
const TA = 51.4; // tables start (s06 dissolves in from 51.7)
const TB = 77.7; // tables end (s07 dissolves out until 77.3)
const DT = 1 / 240;
const N = Math.ceil((TB - TA) / DT) + 2;
const C0 = 0.8; // cycles/s = 1.6 steps/s: s05's settled walk

// s05's walk and world at TA (if s04.js exports them)
const LINK = (() => {
  try {
    if (typeof S04.gait === 'function' && typeof S04.roadX === 'function') {
      const g = S04.gait(TA);
      const x = S04.roadX(TA);
      if (Number.isFinite(g.ph) && Number.isFinite(x)) return { ph: g.ph, x, ok: true };
    }
  } catch (e) {
    /* fall back */
  }
  return { ph: 0, x: 0, ok: false };
})();

// ------------------------------------------------------------------ gait
// Cadence keyframes [t, cycles/s] (sine ramps: a ramp's integral is its
// mean) and stride keyframes [t, amt]. The hip is integrated so that the
// stance foot of walk() stays planted; stops are solved so that the walk
// comes to rest in double support (both feet down, legs straight).
const stanceRel = (ph, amt, leg) => LEG * Math.sin(0.42 * amt * Math.sin(ph * TAU) * (leg === 0 ? 1 : -1));
const stanceLeg = (ph) => (Math.cos(ph * TAU) < 0 ? 0 : 1);

// decel start Ts (constant cadence c from (tRef, phRef), then a sine ramp to
// 0 over D) landing in double support, closest to `want`, not before tMin
function solveStop(phRef, tRef, c, D0, want, tMin) {
  let best = null;
  const n0 = Math.floor((phRef - 0.25) * 2) - 2;
  for (let D = D0 * 0.8; D <= D0 * 1.25 + 1e-9; D += D0 * 0.05) {
    for (let n = n0; n < n0 + 400; n++) {
      const Ts = tRef + (0.25 + n / 2 - phRef - (c * D) / 2) / c;
      if (Ts < tMin) continue;
      const err = Math.abs(Ts + D - want) + 0.2 * Math.abs(D - D0);
      if (!best || err < best.err) best = { Ts, D, err, land: 0.25 + n / 2 };
      if (Ts + D > want + 2) break;
    }
  }
  return best;
}

function integrate(cadKF, amtKF, ph0, s, x0, run) {
  const PH = new Float64Array(N);
  const X = new Float64Array(N);
  const AM = new Float64Array(N);
  let ph = ph0;
  let x = x0;
  let am = keys(TA, amtKF, ease.sine);
  for (let i = 0; i < N; i++) {
    PH[i] = ph;
    X[i] = x;
    AM[i] = am;
    const t = TA + i * DT;
    const dph = keys(t + DT / 2, cadKF, ease.sine) * DT;
    const ph1 = ph + dph;
    const am1 = keys(t + DT, amtKF, ease.sine);
    const leg = stanceLeg(ph + dph / 2);
    const dw = -s * (stanceRel(ph1, am1, leg) - stanceRel(ph, am, leg));
    const k = run ? run.k(t + DT / 2) : 0;
    x += k > 0 ? k * s * run.stride * dph + (1 - k) * dw : dw;
    ph = ph1;
    am = am1;
  }
  return { PH, X, AM };
}

// box-filtered hip x (over ~one step) for the camera and the light
function smoothed(X, win) {
  const pre = new Float64Array(N + 1);
  for (let i = 0; i < N; i++) pre[i + 1] = pre[i] + X[i];
  const out = new Float64Array(N);
  const h = Math.round(win / DT / 2);
  for (let i = 0; i < N; i++) {
    const a = Math.max(0, i - h);
    const b = Math.min(N - 1, i + h);
    out[i] = (pre[b + 1] - pre[a]) / (b - a + 1);
  }
  return out;
}
const look = (arr, t) => {
  const u = clamp((t - TA) / DT, 0, N - 1.0001);
  const i = Math.floor(u);
  return arr[i] + (arr[i + 1] - arr[i]) * (u - i);
};

// --- him
function himProgram(want2) {
  const ph0 = LINK.ph;
  // the falter lands exactly at STOP1; the pace while she walks with him
  // (c1, about s05's) is chosen so that it can
  const STOP1 = 59.4;
  const D1 = 0.55;
  const Ts1 = STOP1 - D1;
  const A = ph0 + C0 * (54.6 - TA) + C0 * 0.6;
  const B = 0.6 + (Ts1 - 55.8) + D1 / 2;
  let c1 = C0;
  let bestE = 1e9;
  for (let n = -400; n < 400; n++) {
    const c = (0.25 + n / 2 - A) / B;
    if (Math.abs(c - 0.78) < bestE) {
      bestE = Math.abs(c - 0.78);
      c1 = c;
    }
  }
  const land1 = A + B * c1;
  // s07: he steps off, they walk on (a lighter step), the fork, on alone
  const Tr1 = 65.45;
  const R1 = 0.9;
  const C2 = 1.05;
  const D2 = 0.6;
  const st2 = solveStop(land1 + (C2 * R1) / 2, Tr1 + R1, C2, D2, want2, Tr1 + R1);
  const Ts2 = st2.Ts;
  const Tr2 = 71.15;
  const R2 = 1.1;
  const C3 = 0.75;
  const cad = [[TA, C0], [54.6, C0], [55.8, c1], [Ts1, c1], [STOP1, 0], [Tr1, 0], [Tr1 + R1, C2], [Ts2, C2], [Ts2 + st2.D, 0], [Tr2, 0], [Tr2 + R2, C3]];
  const amt = [[TA, 1], [Ts1, 1], [Ts1 + 0.35, 0.75], [Tr1 + 0.12, 0.75], [Tr1 + 0.8, 1], [Ts2, 1], [Ts2 + 0.4, 0.78], [Tr2 + 0.12, 0.78], [Tr2 + 0.9, 1]];
  return { ph0, c1, C2, STOP1, Ts1, Tr1, Ts2, STOP2: Ts2 + st2.D, Tr2, cad, amt };
}
// (his stop at the fork is re-solved below, once hers is known)
let HIM = himProgram(69.0);
let HT = integrate(HIM.cad, HIM.amt, HIM.ph0, S, LINK.x);

// --- her
// matched stride: her speed equals his at the same cadence (so in step, the
// gap between them holds)
const AMT_H = Math.asin((S * Math.sin(0.42)) / HS) / 0.42;
const CR = 1.65; // running cadence
const RUN_SW = 0.42 * 1.3;
const RUN = { stride: 4 * LEG * Math.sin(RUN_SW) * 1.18, k: (t) => 1 - smooth(t, 55.25, 56.3, ease.sine) };
const kRun = RUN.k;

function herProgram(Trh) {
  const c1 = HIM.c1;
  // in step with him at 56.4 (phase difference an integer)
  const phHis = HIM.ph0 + C0 * (54.6 - TA) + ((C0 + c1) / 2) * 1.2 + c1 * (56.4 - 55.8);
  const ph0 = phHis - CR * (55.5 - TA) - ((CR + c1) / 2) * 0.9;
  // she stops a step after him
  const Dh = 0.5;
  const st1 = { ...solveStop(phHis, 56.4, c1, Dh, 59.85, 59.05) };
  const Rh = 0.9;
  const C2 = HIM.C2;
  const D2 = 0.55;
  const st2 = solveStop(st1.land + (C2 * Rh) / 2, Trh + Rh, C2, D2, 69.2, Trh + Rh);
  const Tb = 71.05; // off up her road
  const CB = 0.75;
  const cad = [[TA, CR], [55.5, CR], [56.4, c1], [st1.Ts, c1], [st1.Ts + st1.D, 0], [Trh, 0], [Trh + Rh, C2], [st2.Ts, C2], [st2.Ts + st2.D, 0], [Tb, 0], [Tb + 0.8, CB]];
  const a0 = 0.72 * AMT_H;
  const amt = [[TA, AMT_H], [st1.Ts, AMT_H], [st1.Ts + 0.3, a0], [Trh + 0.12, a0], [Trh + 0.8, AMT_H], [st2.Ts, AMT_H], [st2.Ts + 0.35, a0]];
  return { ph0, STOP1: st1.Ts + st1.D, Tr: Trh, Ts2: st2.Ts, STOP2: st2.Ts + st2.D, Tb, cad, amt };
}
function herTable(P) {
  const T = integrate(P.cad, P.amt, P.ph0, HS, 0, RUN);
  // place her so that at 56.4 she is OFF ahead of him
  const i = Math.round((56.4 - TA) / DT);
  const shift = HT.X[i] + OFF - T.X[i];
  for (let k = 0; k < N; k++) T.X[k] += shift;
  return T;
}
// she sets off a moment after him; at the fork he stops as she does, a
// couple of paces behind her
const HER = herProgram(65.74);
const HRT = herTable(HER);
export const HERS = HER;
HIM = himProgram(HER.STOP2 - 0.12);
HT = integrate(HIM.cad, HIM.amt, HIM.ph0, S, LINK.x);
export { HIM };
const HXS = smoothed(HT.X, 0.62);
export const hisX = (t) => look(HT.X, t);
export const hisXs = (t) => look(HXS, t);
const herX = (t) => look(HRT.X, t);

// ------------------------------------------------------------------ places
// the one who gives the thumbs-up: he passes them at 53.45 (and they are
// just out of the tight frame of the stillness)
const THUMB_X = hisX(53.45);
// The fork: the road splits along its centre line where she stops. His half
// runs on (narrower); her half — her lane — peels away up into the distance.
export const FORK = (() => {
  const x = herX(HER.STOP2) + 16; // the tip of the wedge
  const V = [x + 560, R.horizon + 1]; // where her road meets the horizon
  // (near: her road's near edge; far: its far edge, turning off the old far
  // edge a little before the tip. Nearly straight: a road going away.)
  const x0 = x - 60;
  return {
    x,
    V,
    near: [[x, HG - 2], [lerp(x, V[0], 0.5) - 6, lerp(HG - 2, V[1], 0.5) + 6], V],
    far: [[x0, R.far], [lerp(x0, V[0], 0.5) - 4, lerp(R.far, V[1], 0.5) + 5], [V[0] - 3, V[1]]],
    hisFar: HG - 2, // his road's far edge after the split
  };
})();
// his road bends away to the horizon far ahead (seen in the wide shot)
const BEND = (() => {
  const xn = hisX(77.3) + 980;
  return { xn, xf: xn - 110, V: [xn + 980, R.horizon + 1] };
})();

// ------------------------------------------------------------------ camera
// (z, sx = his screen x, fy = screen y of the road's near edge). In the
// stillness the frame is tight and the fork ahead is just out of shot.
const FORK0 = Math.min(FORK.x, FORK.far[0][0]); // where the fork begins
let ZH = 1.8;
const sxFor = (z) => W - (FORK0 - hisX(HIM.STOP1) - 50) * z;
while (sxFor(ZH) > 1160 && ZH < 2.1) ZH += 0.02;
const SXH = clamp(sxFor(ZH), 860, 1160);
export const HOLD = { z: ZH, sx: SXH };
const ZW = 0.55; // the last, wide frame
const CAMK = {
  z: [[52.3, 1.3], [53.7, 1.33], [56.6, 1.36], [58.7, ZH], [64.9, ZH], [67.6, 1.24], [72.0, 1.24], [77.2, ZW]],
  sx: [[52.3, 760], [53.7, 560], [54.8, 560], [57.0, 900], [58.7, SXH], [64.9, SXH], [67.6, 700], [72.0, 720], [77.2, 700]],
  fy: [[52.3, 760], [53.7, 800], [56.6, 800], [58.7, 840], [64.9, 840], [67.6, 795], [72.0, 795], [77.2, 820]],
};
function s05cam(t) {
  if (LINK.ok && typeof S04.roadCam === 'function') {
    try {
      const c = S04.roadCam(t);
      if (Number.isFinite(c.x) && Number.isFinite(c.y) && Number.isFinite(c.z)) return c;
    } catch (e) {
      /* fall back */
    }
  }
  const z = 1.3;
  return { x: hisXs(t) + (W / 2 - 760) / z, y: G - (760 - H / 2) / z, z };
}
export function takeCam(t) {
  if (t <= 52.3) return s05cam(t);
  const z = keys(t, CAMK.z, ease.inOut);
  const sx = keys(t, CAMK.sx, ease.inOut);
  const fy = keys(t, CAMK.fy, ease.inOut);
  if (t >= 53.7) return { x: hisXs(t) + (W / 2 - sx) / z, y: G - (fy - H / 2) / z, z };
  // from s05's last framing (carried on at his pace) into the medium shot
  const c5 = s05cam(52.3);
  const k = smooth(t, 52.3, 53.7, ease.inOut);
  const sx5 = W / 2 - (c5.x - hisXs(52.3)) * c5.z;
  const fy5 = (G - c5.y) * c5.z + H / 2;
  const zk = lerp(c5.z, z, k);
  const sxk = lerp(sx5, sx, k);
  const fyk = lerp(fy5, fy, k);
  return { x: hisXs(t) + (W / 2 - sxk) / zk, y: G - (fyk - H / 2) / zk, z: zk };
}

// Safety net: whatever s05's walk does to the timing, keep the fork out of
// shot until s07 opens the frame up (tighten the walking shot if needed).
for (let iter = 0; iter < 30; iter++) {
  let mx = -1e9;
  for (let t = 52.3; t <= 64.9; t += 0.05) {
    const c = takeCam(t);
    mx = Math.max(mx, c.x + W / 2 / c.z);
  }
  if (mx < FORK0 - 40) break;
  CAMK.z[1][1] += 0.02;
  CAMK.z[2][1] += 0.02;
}

// ------------------------------------------------------------------ road
// road.js's road (same tiles, same seeds), the fork, and the bend far ahead.
function seg(ctx, y, xa, xb, cuts, o) {
  let pieces = [[xa, xb]];
  for (const [c0, c1] of cuts) {
    const next = [];
    for (const [a, b] of pieces) {
      if (c1 <= a || c0 >= b) next.push([a, b]);
      else {
        if (c0 > a) next.push([a, c0]);
        if (c1 < b) next.push([c1, b]);
      }
    }
    pieces = next;
  }
  pieces.forEach(([a, b], k) => {
    if (b - a > 2) path(ctx, [[a, y], [b, y]], { ...o, seed: o.seed + k * 977 });
  });
}

const bez = (p0, p1, p2, u) => [
  (1 - u) * (1 - u) * p0[0] + 2 * u * (1 - u) * p1[0] + u * u * p2[0],
  (1 - u) * (1 - u) * p0[1] + 2 * u * (1 - u) * p1[1] + u * u * p2[1],
];
const bezPts = (c, n, u0 = 0, u1 = 1) => Array.from({ length: n + 1 }, (_, i) => bez(c[0], c[1], c[2], lerp(u0, u1, i / n)));

function tuft(ctx, x, y, a, seed, sc = 1, lw = 1) {
  path(ctx, [[x - 8 * sc, y - 12 * sc], [x - 2 * sc, y], [x + 2 * sc, y - 16 * sc], [x + 5 * sc, y], [x + 12 * sc, y - 10 * sc]], { w: 2 * lw, color: COL.inkSoft, alpha: a, seed, wobble: 0.3 });
}

// lw: line weight factor (strokes get a little heavier as the camera pulls
// back, so the wide frame doesn't turn to hairlines)
function takeRoad(ctx, x0, x1, wide, lw) {
  const F = FORK;
  const t0 = Math.floor(x0 / 400);
  const t1 = Math.ceil(x1 / 400);
  const ym = (R.near + R.far) / 2 + 4;
  for (let i = t0; i < t1; i++) {
    const xa = i * 400;
    const xb = xa + 400;
    const sd = (i & 255) * 3;
    seg(ctx, R.near, xa - 2, xb + 2, [[BEND.xn, 1e9]], { w: 3.6 * lw, seed: 8200 + sd, wobble: 0.6 });
    seg(ctx, R.far, xa - 2, xb + 2, [[F.far[0][0], 1e9]], { w: 2.6 * lw, seed: 8201 + sd, wobble: 0.6 });
    // his half of the road after the split
    seg(ctx, F.hisFar, xa - 2, xb + 2, [[-1e9, F.x], [BEND.xf, 1e9]], { w: 2.6 * lw, seed: 8203 + sd, wobble: 0.6 });
    path(ctx, [[xa - 2, R.horizon], [xb + 2, R.horizon]], { w: 1.8 * lw, color: COL.inkSoft, seed: 8202 + sd, wobble: 0.5 });
    // centre dashes (up to the fork)
    for (let k = 0; k < 2; k++) {
      const dx = xa + 60 + k * 200;
      if (dx + 90 > F.x - 30) continue;
      path(ctx, [[dx, ym], [dx + 90, ym]], { w: 2.4 * lw, color: COL.inkSoft, seed: 8900 + (i & 255) * 2 + k, wobble: 0.3 });
    }
    // the near verge
    const gx = xa + 80 + hash(i * 3.1) * 240;
    tuft(ctx, gx, R.near + 26 + hash(i * 1.7) * 30, undefined, 9500 + (i & 255), 1, lw);
    if (wide > 0.01) {
      // the field below the road (comes up as the camera pulls back)
      for (let k = 0; k < 3; k++) {
        const fx = xa + hash(i * 7.3 + k * 1.9) * 400;
        const fyy = R.near + 130 + hash(i * 2.9 + k * 5.1) * 620;
        tuft(ctx, fx, fyy, 0.8 * wide, 9600 + (i & 255) * 3 + k, 1.3, lw);
      }
    }
    // far telegraph poles every other tile
    if ((i & 1) === 0) {
      const px = xa + 120 + hash(i * 5.3) * 160;
      if (Math.abs(px - F.V[0]) > 80 && Math.abs(px - BEND.V[0]) > 80) {
        path(ctx, [[px, R.horizon + 2], [px, R.horizon - 70]], { w: 2 * lw, color: COL.inkSoft, seed: 9800 + (i & 255), wobble: 0.3 });
        path(ctx, [[px - 12, R.horizon - 62], [px + 12, R.horizon - 62]], { w: 1.6 * lw, color: COL.inkSoft, seed: 9801 + (i & 255), wobble: 0.3 });
      }
    }
  }
  // her road: peels off the far half and runs up to the horizon
  if (x1 > F.x - 60 && x0 < F.V[0] + 60) {
    path(ctx, bezPts(F.near, 24, 0, 0.985), { w: 2.6 * lw, seed: 8300, wobble: 0.6 });
    path(ctx, bezPts(F.far, 24, 0, 0.985), { w: 2.6 * lw, seed: 8301, wobble: 0.6 });
    // a few centre dashes, shrinking into the distance
    for (let k = 0; k < 6; k++) {
      const u0 = 1 - 1 / (1 + 0.5 * (k + 0.45));
      const u1 = 1 - 1 / (1 + 0.5 * (k + 0.8));
      path(ctx, [roadMid(u0), roadMid((u0 + u1) / 2), roadMid(u1)], { w: Math.max(1, 2.4 * (1 - u0)) * lw, color: COL.inkSoft, seed: 8310 + k, wobble: 0.2 });
    }
  }
  // his road bends away to the horizon, far ahead
  if (x1 > BEND.xf - 60) {
    const B = BEND;
    path(ctx, bezPts([[B.xn, R.near], [B.xn + 470, R.near + 2], B.V], 26, 0, 0.99), { w: 3.4 * lw, seed: 8320, wobble: 0.6 });
    path(ctx, bezPts([[B.xf, F.hisFar], [B.xf + 420, F.hisFar + 1], [B.V[0] - 4, B.V[1]]], 26, 0, 0.99), { w: 2.4 * lw, seed: 8321, wobble: 0.6 });
  }
}
// the centre line of her road (u: 0 at the fork .. 1 at the horizon)
function roadMid(u) {
  const F = FORK;
  const a = bez(F.near[0], F.near[1], F.near[2], u);
  const b = bez(F.far[0], F.far[1], F.far[2], u);
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
}

// Low bushes: a few on the far verge, a few small ones far off on the
// horizon (bumpy mounds — never round heads on sticks next to stick people)
const BUSHES = [
  [THUMB_X - 900, R.far - 3, 1.0],
  [hisX(59.4) - 390, R.far - 3, 0.8],
  [hisX(59.4) + 380, R.far - 3, 0.7],
  [FORK.x - 1580, R.far - 3, 1.1],
  [FORK.x + 520, FORK.hisFar - 3, 0.9],
  [BEND.xf - 560, FORK.hisFar - 3, 1.0],
  [FORK.V[0] + 260, R.horizon + 2, 0.4],
  [FORK.V[0] - 380, R.horizon + 2, 0.34],
  [BEND.V[0] - 300, R.horizon + 2, 0.38],
  [BEND.V[0] + 420, R.horizon + 2, 0.34],
  [FORK.V[0] + 1050, R.horizon + 2, 0.3],
];
function bushes(ctx, x0, x1, lw) {
  BUSHES.forEach(([x, g, s], i) => {
    if (x < x0 - 120 || x > x1 + 120) return;
    const w = 62 * s;
    const pts = [];
    const n = 3 + (i % 2);
    for (let k = 0; k <= n * 6; k++) {
      const u = k / (n * 6);
      const bump = Math.abs(Math.sin(u * n * Math.PI));
      const h = (18 + 9 * bump) * s * Math.sin(Math.PI * Math.min(1, u * 1.15 + 0.02) ** 0.8);
      pts.push([x - w / 2 + u * w, g - h]);
    }
    const far = s < 0.5;
    path(ctx, pts, { w: (far ? 1.8 : 2.8) * lw, fill: COL.paper, color: far ? COL.inkSoft : COL.ink, seed: 8400 + i * 3, wobble: 0.5 });
  });
}

// ------------------------------------------------------------------ poses
function walkPose(ph, amt, x, ground, s, sw = 0.4) {
  const w = walk(ph, ground, s, amt);
  const a = Math.sin(ph * TAU);
  const k = clamp(amt / 0.58);
  return pose({ ...w, x, s, f: 1, lean: 0.035, head: -0.02, look: 0, aA1: 0.02 - sw * k * a, aA2: 0.34, aB1: 0.02 + sw * k * a, aB2: 0.34 });
}
const HANG = { aA1: 0.2, aA2: 0.2, aB1: -0.15, aB2: 0.22 };
const ARMS = ['aA1', 'aA2', 'aB1', 'aB2'];

// side-view feet of a pose
function feet(p) {
  const leg = (a1, a2) => [
    p.x + p.f * (Math.sin(a1) * BODY.ul + Math.sin(a1 + a2) * BODY.ll) * p.s,
    p.y + (Math.cos(a1) * BODY.ul + Math.cos(a1 + a2) * BODY.ll) * p.s,
  ];
  return [leg(p.lA1, p.lA2), leg(p.lB1, p.lB2)];
}

function himPose(t) {
  const M = HIM;
  const p = walkPose(look(HT.PH, t), look(HT.AM, t), hisX(t), G, S);
  // standing still (stop 1: the falter; stop 2: the fork): arms at rest
  const hold1 = smooth(t, M.STOP1 - 0.25, M.STOP1 + 0.5) * (1 - smooth(t, M.Tr1 - 0.1, M.Tr1 + 0.55));
  const hold2 = smooth(t, M.STOP2 - 0.3, M.STOP2 + 0.4) * (1 - smooth(t, M.Tr2 - 0.1, M.Tr2 + 0.55));
  const hold = Math.max(hold1, hold2);
  for (const k of ARMS) p[k] = lerp(p[k], HANG[k], hold);

  const S2 = M.STOP2;
  // the glance at the thumbs-up; the smile at her; looking down at the light;
  // the head coming up; the goodbye
  p.turn = keys(t, [[52.5, 0], [52.8, 0.22], [53.5, 0.22], [53.85, 0], [57.5, 0], [57.8, 0.62], [58.42, 0.62], [58.62, 0], [64.6, 0], [65.0, 0.62], [65.5, 0.62], [65.9, 0.12], [66.6, 0], [S2 + 0.1, 0], [S2 + 0.4, 0.62], [70.8, 0.62], [71.15, 0]]);
  p.head = keys(t, [[52.5, -0.02], [52.8, -0.2], [53.1, -0.2], [53.25, -0.08], [53.37, -0.18], [53.55, -0.16], [53.9, -0.02], [58.45, -0.02], [58.8, 0.4], [59.6, 0.46], [64.0, 0.5], [64.95, -0.06], [65.8, -0.03], [S2 + 0.1, -0.03], [S2 + 0.4, -0.1], [70.8, -0.1], [71.15, -0.03], [72, -0.03], [76.5, -0.07]]);
  p.look = keys(t, [[52.5, 0], [52.8, -0.85], [53.5, -0.85], [53.85, 0], [58.45, 0], [58.75, 1], [64.0, 1], [64.9, -0.1], [65.8, 0], [S2 + 0.1, 0], [S2 + 0.4, -0.35], [70.8, -0.35], [71.15, 0]]);
  const mouth = keys(t, [[52.55, 0], [52.85, 0.18], [53.55, 0.18], [53.85, 0], [57.6, 0], [57.9, 1], [58.85, 1], [59.12, -0.4], [64.35, -0.4], [64.7, 0], [65.1, 0.7], [65.9, 0.55], [68.0, 0.45], [S2 + 0.4, 0.65], [70.8, 0.55], [71.6, 0.3], [73, 0.22]]);

  // the falter: forward over his slowing feet, then a small jolt back
  const jolt = keys(t, [[58.9, 0], [59.3, 0.4], [59.45, -1], [59.62, -0.7], [60.2, 0.25], [64.0, 0.3], [64.95, 0]], ease.inOut);
  p.lean = 0.035 + 0.075 * Math.max(0, jolt) + 0.1 * Math.min(0, jolt) + 0.07 * hold1 * (1 - smooth(t, 64.0, 64.95));
  // a startled twitch of the arms
  const tw = keys(t, [[59.3, 0], [59.45, 1], [59.95, 0]]);
  p.aA1 += 0.22 * tw;
  p.aA2 += 1.05 * tw;
  p.aB1 += 0.3 * tw;
  p.aB2 += 0.95 * tw;
  // waving goodbye at the fork
  const wv = smooth(t, S2 + 0.4, S2 + 0.65) * (1 - smooth(t, 70.65, 70.95));
  if (wv > 0) {
    p.aA1 = lerp(p.aA1, 2.5, wv);
    p.aA2 = lerp(p.aA2, 0.45 + 0.32 * Math.sin((t - S2) * 8.5), wv);
  }
  // the hip shifts back over planted feet (only while he stands)
  const dx = keys(t, [[59.38, 0], [59.47, -9], [59.62, -8], [60.3, -5], [64.0, -5], [64.95, 0]], ease.inOut) * S;
  const dy = keys(t, [[59.38, 0], [59.47, 3], [60.3, 1.5], [64.0, 1.5], [64.95, 0]], ease.inOut) * S;
  // breathing in the stillness
  p.lean += 0.006 * smooth(t, 60.2, 60.8) * (1 - smooth(t, 63.6, 64.2)) * Math.sin((t - 60.2) * 1.7);
  if (Math.abs(dx) + Math.abs(dy) > 0.01) {
    const [fA, fB] = feet(p);
    p.x += dx;
    p.y += dy;
    const ra = reach(p, 'A', fA[0], fA[1], 'leg');
    const rb = reach(p, 'B', fB[0], fB[1], 'leg');
    Object.assign(p, { lA1: ra.a1, lA2: ra.a2, lB1: rb.a1, lB2: rb.a2 });
  }
  return { p, mouth };
}

function runPose(ph, x, ground, s) {
  const a = Math.sin(ph * TAU);
  const c = Math.cos(ph * TAU);
  const lA1 = RUN_SW * a + 0.12;
  const lB1 = -RUN_SW * a + 0.12;
  const lA2 = -0.25 - 1.5 * Math.max(0, c) * Math.max(0, c);
  const lB2 = -0.25 - 1.5 * Math.max(0, -c) * Math.max(0, -c);
  const reachL = Math.max(Math.cos(lA1) * BODY.ul + Math.cos(lA1 + lA2) * BODY.ll, Math.cos(lB1) * BODY.ul + Math.cos(lB1 + lB2) * BODY.ll);
  const lift = 7 * Math.pow(Math.abs(a), 6);
  return pose({
    x, y: ground - (reachL + lift) * s, s, f: 1, lA1, lA2, lB1, lB2,
    aA1: 0.1 - 0.62 * a, aA2: 1.45, aB1: 0.1 + 0.62 * a, aB2: 1.45,
    lean: 0.17, head: -0.06, look: -0.1, tail: 0.55 + 0.18 * Math.sin(ph * TAU * 2),
  });
}

// A turn on the spot in three drawings: the face comes round (side), front,
// side the other way. k: 0..1.
function turnPose(a, b, k, ground) {
  if (k < 0.33) return { ...a, turn: Math.max(a.turn ?? 0, 0.75 * (k / 0.33)) };
  if (k < 0.7) {
    return pose({
      x: (a.x + b.x) / 2, y: ground - LEG * a.s * Math.cos(0.08), s: a.s, view: 'front',
      turn: b.f < 0 ? -0.45 : 0.45, lA1: 0.08, lB1: 0.08, aA1: 0.14, aA2: 0.1, aB1: 0.14, aB2: 0.1,
    });
  }
  return { ...b, turn: Math.max(b.turn ?? 0, 0.6 * (1 - (k - 0.7) / 0.3)) };
}

function standPose(x, ground, s, f) {
  return pose({ x, y: ground - LEG * s * Math.cos(0.06), s, f, lA1: 0.06, lA2: 0, lB1: -0.06, lB2: 0, ...HANG, lean: 0.02, head: 0.06 });
}

// her up her own road: q = 1 where she leaves, -> 0 at the horizon
const BR_V = 118 / 260; // dq/dt at the start
function herRoad(t) {
  const u = Math.max(0, t - HER.Tb);
  // she eases into a steady walk over the first 0.8 s
  const e = u < 0.8 ? (u * u) / 1.6 : u - 0.4;
  const q = 1 / (1 + BR_V * e);
  const P = roadMid(1 - q);
  // from where she stood, into the middle of her road
  const k = Math.pow(q, 4);
  const P0 = roadMid(0);
  return { x: P[0] + (FORK.x - 16 - P0[0]) * k, y: P[1] + (HG - P0[1]) * k, s: HS * q };
}

function herWalk(t) {
  const ph = look(HRT.PH, t);
  const p = walkPose(ph, look(HRT.AM, t), herX(t), HG, HS, 0.36);
  p.tail = 0.12 + 0.06 * Math.sin(ph * TAU * 2);
  p.lean = 0.04;
  return p;
}

function herPose(t) {
  const Q = HER;
  const T1 = Q.STOP1 + 0.08; // she turns round to face him
  const T2 = Q.Tr - 0.42; // ... and back, to walk on
  const T3 = Q.STOP2 + 0.06; // at the fork: to the front, a wave
  const T4 = Q.Tb - 0.2; // ... and away
  let mouth = keys(t, [[55.9, 0], [56.2, 0.6], [57.0, 0.45], [57.8, 0.45], [58.1, 0.8], [58.9, 0.6], [59.4, 0], [60.3, -0.05], [64.85, -0.05], [65.2, 0.65], [68.0, 0.5], [T3 + 0.3, 0.85], [T4, 0.75], [T4 + 0.4, 0.5]]);
  let p;
  if (t < T1) {
    const wk = herWalk(t);
    const kr = kRun(t);
    p = kr > 0 ? mixPose(wk, runPose(look(HRT.PH, t), herX(t), HG, HS), kr) : wk;
    p.turn = keys(t, [[55.95, 0], [56.2, 0.5], [56.85, 0.5], [57.1, 0], [57.85, 0], [58.1, 0.5], [58.75, 0.5], [59.0, 0]]);
  } else if (t < T2) {
    const st = standPose(herX(t), HG, HS, -1);
    st.head = keys(t, [[T1, 0.06], [T1 + 0.6, 0.14], [64.8, 0.14], [65.2, 0.02]]);
    st.look = keys(t, [[T1, 0], [T1 + 0.6, 0.35], [64.8, 0.35], [65.2, 0]]);
    st.turn = 0.15;
    const k = clamp((t - T1) / 0.36);
    p = k < 1 ? turnPose(herWalk(t), st, k, HG) : st;
  } else if (t < T3) {
    const wk = herWalk(t);
    const r = smooth(t, Q.Tr - 0.1, Q.Tr + 0.55);
    for (const a of ARMS) wk[a] = lerp(HANG[a], wk[a], r);
    const k = clamp((t - T2) / 0.36);
    if (k < 1) {
      const st = standPose(herX(t), HG, HS, -1);
      st.turn = 0.15;
      p = turnPose(st, wk, k, HG);
    } else p = wk;
    // she glances back at him as they set off
    if (k >= 1) p.turn = keys(t, [[T2 + 0.36, 0.3], [Q.Tr + 0.6, 0.3], [Q.Tr + 1.0, 0]]);
  } else if (t < T4) {
    const wk = herWalk(t);
    for (const a of ARMS) wk[a] = HANG[a];
    const fr = pose({ x: herX(t), y: HG - LEG * HS * Math.cos(0.08), s: HS, view: 'front', lA1: 0.08, lB1: 0.08, aA1: 0.14, aA2: 0.1, aB1: 0.14, aB2: 0.1, turn: -0.35, head: -0.05 });
    const wv = smooth(t, T3 + 0.2, T3 + 0.42) * (1 - smooth(t, T4 - 0.3, T4 - 0.08));
    fr.aA1 = lerp(0.14, 2.3, wv);
    fr.aA2 = lerp(0.1, 0.62 + 0.36 * Math.sin((t - T3 - 0.3) * 9), wv);
    const k = clamp((t - T3) / 0.3);
    p = k < 0.7 ? turnPose(wk, fr, k, HG) : fr;
  } else if (t < Q.Tb) {
    // turning away up her road
    const wk = herWalk(t);
    for (const a of ARMS) wk[a] = HANG[a];
    p = { ...wk, turn: 0.45 * (1 - clamp((t - T4) / 0.2)) };
  } else {
    const b = herRoad(t);
    const ph = look(HRT.PH, t);
    p = walkPose(ph, look(HRT.AM, t) + (AMT_H - 0.72 * AMT_H) * smooth(t, Q.Tb, Q.Tb + 0.8), b.x, b.y, b.s, 0.36);
    p.tail = 0.12 + 0.06 * Math.sin(ph * TAU * 2);
    p.lean = 0.04;
    p.turn = keys(t, [[Q.Tb, 0.2], [Q.Tb + 0.3, 0]]);
    mouth = undefined;
  }
  return { p, mouth };
}

// ------------------------------------------------------------------ the thumbs-up
function thumbPerson(ctx, t, hx) {
  const s = TS;
  const x = THUMB_X;
  const g = R.far - 4;
  const p = pose({ x, y: g - LEG * s, s, view: 'front', lA1: 0.07, lB1: 0.07, aA1: 0.16, aA2: 0.05, aB1: 0.16, aB2: 0.05 });
  // the arm comes up toward him, fist at head height, thumb up; a little pump
  const k = smooth(t, 52.2, 52.6, ease.out) * (1 - smooth(t, 54.0, 54.5));
  const pump = Math.sin(clamp((t - 52.6) / 0.5) * Math.PI) * 0.18;
  p.aA1 = lerp(0.16, 1.95 + pump * 0.3, k);
  p.aA2 = lerp(0.05, 0.95 - pump, k);
  // eyes on him as he passes
  const rel = clamp((hx - x) / 260, -1, 1);
  p.turn = rel * 0.75;
  p.head = 0.05 * rel - 0.04 * k;
  const j = figure(ctx, p, { id: 61, mouth: lerp(0.2, 0.8, k) });
  if (k > 0.35) {
    // fist and thumb, drawn a little large so they read across the road
    const [fx, fy] = j.handA;
    const r = 9.5 * s;
    ellipse(ctx, fx, fy, r, r * 0.86, { w: Math.max(1.6, 3.4 * s), fill: COL.paper, seed: 8450, wobble: 0.2 });
    path(ctx, [[fx + r * 0.2, fy - r * 0.75], [fx + r * 0.3, fy - r * 2.3]], { w: Math.max(2, 5 * s), seed: 8451, wobble: 0.1 });
  }
}

// ------------------------------------------------------------------ sky
function sky(ctx, t, x0, x1) {
  // a few birds, high up, drifting the other way (seen as the camera pulls back)
  for (let i = 0; i < 3; i++) {
    const bx = BEND.xn - 700 + i * 240 - (t - 70) * (26 + i * 6);
    const by = R.horizon - 560 - i * 60 + Math.sin(t * 0.8 + i) * 10;
    if (bx < x0 - 60 || bx > x1 + 60) continue;
    bird(ctx, bx, by, 1.15 - i * 0.15, (t * 1.5 + i * 0.37) % 1, { seed: 8500 + i * 2, alpha: 0.85 });
  }
}

// ------------------------------------------------------------------ the take
export function take(ctx, t) {
  const cam = takeCam(t);
  const half = W / 2 / cam.z + 140;
  const x0 = cam.x - half;
  const x1 = cam.x + half;
  camera(ctx, cam, () => {
    sky(ctx, t, x0, x1);
    const lw = Math.pow(Math.min(1, cam.z / 1.24), -0.6);
    takeRoad(ctx, x0, x1, 1 - smooth(cam.z, 0.85, 1.2), lw);
    bushes(ctx, x0, x1, lw);
    if (THUMB_X > x0 - 100 && THUMB_X < x1 + 100) thumbPerson(ctx, t, hisX(t));

    // her (a lane further back: drawn first)
    const her = herPose(t);
    const hp = her.p;
    if (hp.x > x0 - 150 && hp.x < x1 + 150 && hp.s > 0.03) {
      figure(ctx, hp, { id: 2, ponytail: true, noTie: true, mouth: her.mouth, alpha: clamp((hp.s - 0.03) / 0.06), w: Math.max(2, 4.6 * Math.pow(hp.s, 0.85)) * lw });
    }
    // him
    const me = himPose(t);
    figure(ctx, me.p, { id: 1, cowlick: true, mouth: t < 52.55 ? undefined : me.mouth, w: Math.max(2, 4.6 * Math.pow(S, 0.85)) * lw });

    // lights: the small light at his feet; the sky ahead getting lighter
    const lights = [];
    const on = smooth(t, 56.6, 57.15, ease.out);
    const off = 1 - smooth(t, 71.15, 72.65, ease.sine);
    const kp = on * off;
    if (kp > 0.001) {
      const rx = lerp(44, 74, on) * lerp(0.8, 1, off);
      const px = hisXs(t);
      lights.push({ type: 'pool', x: px, y: G + 2, rx, ry: rx * 0.24, k: kp });
      // what it spills up onto him
      lights.push({ type: 'glow', x: px, y: G - 80, r: 200, k: 0.26 * kp });
    }
    lights.push({ type: 'glow', x: cam.x + 900 / cam.z, y: R.horizon - 60, r: 1500 / Math.min(1, cam.z), k: 0.5 });
    // in the wide frame: the sky over the end of his road is lightest
    const wideK = smooth(t, 72, 77);
    if (wideK > 0) lights.push({ type: 'glow', x: BEND.V[0], y: R.horizon - 80, r: 2200, k: 0.3 * wideK });
    const dark = keys(t, [[51.5, 0.48], [54.0, 0.45], [70.0, 0.45], [77.0, 0.32]]);
    stage(ctx, lights, { dark, beams: 0 });
  });
}

export default {
  fadeOut: 0, // the take runs straight on into s07
  draw(ctx, lt, info) {
    take(ctx, info.start + lt);
  },
};
