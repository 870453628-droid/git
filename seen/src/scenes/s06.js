// s06 · 52–64 · 有人鼓掌，有人陪我走一段。/ 我笑了，又慌了—— / 我怎么还是这么在意？
// Medium tracking shot on the dusk road. A girl with a ponytail comes the
// other way down the middle of the road, sees him, stops and claps for him;
// as he comes up she turns round and falls into step a little ahead of him
// (on the centre line, in step) — nobody ever passes anybody. A small oval of
// light blooms at his feet and travels with him; the camera eases in. He
// smiles at her — then looks down, sees the light, and the smile drops: his
// step falters, he stops dead, a small jolt back. She takes one more step,
// stops, turns round. Stillness: he stands in the little light looking down
// at it; the camera has stopped too. (62.6–64: no line — hold.)
//
// s06 and s07 are ONE take (s06 fadeOut 0, s07 fadeIn 0): everything lives
// here in take(); s07.js just runs it on. The take opens on s05's last
// framing in s05's own world (same road tiles, same walk, same camera, read
// live from s04.js), so the dissolve from s05 only takes the lamps and the
// crowds away.
import { W, H, COL, TAU, clamp, lerp, smooth, keys, ease, hash, camera, path } from '../lib.js';
import { figure, pose, walk, reach, LEG, BODY } from '../figure.js';
import { stage } from '../light.js';
import { ROAD } from '../road.js';
import { bird } from '../sets.js';
import { standLamp } from '../props.js';
import * as S04 from './s04.js';

const R = ROAD;
// ------------------------------------------------------------------ cast
const S = 0.85; // him (world scale, as in s05); his feet on the near edge
const G = R.near;
const HS = 0.74; // her: a little smaller, and a lane further back —
const HG = (R.near + R.far) / 2 + 2; // her feet on the centre line
const OFF = 122; // she walks this far ahead of him (a clear head and a half)
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

function integrate(cadKF, amtKF, ph0, s, x0) {
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
    x += -s * (stanceRel(ph1, am1, leg) - stanceRel(ph, am, leg));
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
  const Tr2 = 72.95; // he watches her go up her lane, then steps off (可就算没人看，路还是要走)
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
const A0H = 0.72 * AMT_H; // her stance standing still
// She comes the other way (walking left), stops HSTOP facing him, turns to
// the front and claps for him; as he comes up she turns round and sets off
// (Tgo) beside him, a little ahead, in step by Tgo + HGO_R.
const HSTOP = 53.8;
const HGO_R = 0.8;
const HGO_WANT = 55.55;

function herProgram(Trh) {
  const c1 = HIM.c1;
  // his phase at 56.4
  const phHis = HIM.ph0 + C0 * (54.6 - TA) + ((C0 + c1) / 2) * 1.2 + c1 * (56.4 - 55.8);
  // she sets off from double support (phase 1/4 + n/2) and is in step with
  // him (a whole number of cycles apart) once up to speed: pick the start
  // time nearest HGO_WANT for which both hold
  let Tgo = HGO_WANT;
  let bestE = 1e9;
  for (let j = -400; j < 400; j++) {
    const T = 56.4 - HGO_R / 2 - (phHis - 0.25 + j / 2) / c1;
    if (Math.abs(T - HGO_WANT) < bestE) {
      bestE = Math.abs(T - HGO_WANT);
      Tgo = T;
    }
  }
  const ph0 = phHis - c1 * (56.4 - Tgo - HGO_R / 2);
  // she stops a step after him
  const Dh = 0.5;
  const st1 = { ...solveStop(phHis, 56.4, c1, Dh, 59.85, 59.05) };
  const Rh = 0.9;
  const C2 = HIM.C2;
  const D2 = 0.55;
  const st2 = solveStop(st1.land + (C2 * Rh) / 2, Trh + Rh, C2, D2, 69.75, Trh + Rh);
  const Tb = 71.45; // off up her road
  const CB = 0.75;
  const cad = [[TA, 0], [Tgo, 0], [Tgo + HGO_R, c1], [st1.Ts, c1], [st1.Ts + st1.D, 0], [Trh, 0], [Trh + Rh, C2], [st2.Ts, C2], [st2.Ts + st2.D, 0], [Tb, 0], [Tb + 0.8, CB]];
  const a0 = A0H;
  const amt = [[TA, a0], [Tgo, a0], [Tgo + HGO_R, AMT_H], [st1.Ts, AMT_H], [st1.Ts + 0.3, a0], [Trh + 0.12, a0], [Trh + 0.8, AMT_H], [st2.Ts, AMT_H], [st2.Ts + 0.35, a0]];
  return { ph0, Tgo, STOP1: st1.Ts + st1.D, Tr: Trh, Ts2: st2.Ts, STOP2: st2.Ts + st2.D, Tb, cad, amt };
}
// her walk toward him (to the left), landing in double support at HSTOP;
// integrated as a walk to the right and mirrored (see herX)
const HA = (() => {
  const c = 1.0; // a brisk walk

  const st = solveStop(0.25, TA, c, 0.5, HSTOP, TA + 0.5);
  const T = integrate([[TA, c], [st.Ts, c], [st.Ts + st.D, 0]], [[TA, AMT_H], [st.Ts, AMT_H], [st.Ts + 0.3, A0H]], 0.25, HS, 0);
  return { T, stop: st.Ts + st.D, end: T.X[N - 1] };
})();
function herTable(P) {
  const T = integrate(P.cad, P.amt, P.ph0, HS, 0);
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
// (until she stops, her walk toward him is added on, mirrored)
export const herX = (t) => look(HRT.X, t) + HA.end - look(HA.T.X, t);

// ------------------------------------------------------------------ places
const bez = (p0, p1, p2, u) => [
  (1 - u) * (1 - u) * p0[0] + 2 * u * (1 - u) * p1[0] + u * u * p2[0],
  (1 - u) * (1 - u) * p0[1] + 2 * u * (1 - u) * p1[1] + u * u * p2[1],
];
// The fork: a lane leaves the far side of the road through a mouth and runs
// straight away from us toward the horizon, narrowing (its edges fade out
// just short of the horizon, so they never meet in a peak), with centre
// dashes and posts shrinking along it and tufts on the field around it (so
// it lies on the ground), and a blank two-armed signpost at the corner.
// She stops on the centre line in front of the mouth, then walks up the
// middle of her lane, growing small, and is gone into the dusk well before
// he walks past the mouth.
const MOUTH = 100; // half-width of the mouth on the far edge
const LANE_END = R.horizon + 15; // the edges fade out just short of the horizon
const qOf = (y) => (y - R.horizon) / (HG - R.horizon); // depth (1: her lane)
export const FORK = (() => {
  const sx = herX(HER.STOP2);
  const x = sx + 4; // the mouth: straight up from where she stands
  const V = [x + 24, R.horizon + 1];
  return { x, V, qM: qOf(R.far), P0: [sx, HG], L: [x - MOUTH, R.far], R: [x + MOUTH, R.far], post: [x + MOUTH + 230, R.far - 3] };
})();
// the middle of her lane, and its edges, at depth q
const laneMid = (q) => {
  const F = FORK;
  const y = R.horizon + (HG - R.horizon) * q;
  if (q >= F.qM) return [lerp(F.x, F.P0[0], (q - F.qM) / (1 - F.qM)), y];
  return [F.V[0] + ((F.x - F.V[0]) * q) / F.qM, y];
};
const laneEdge = (q, side) => {
  const [x, y] = laneMid(q);
  return [x + (side * MOUTH * q) / FORK.qM, y];
};
// tufts on the field around her lane: [lateral offset at the mouth's scale, depth]
const FIELD = Array.from({ length: 14 }, (_, k) => {
  const side = k % 2 ? 1 : -1;
  const q = FORK.qM * (0.9 - 0.62 * hash(k * 3.7 + 1.3));
  return [side * (MOUTH + 70 + 330 * hash(k * 5.1 + 2.9)), q];
});
// ahead of him at the end: his road runs on out of the frame, toward the
// lightest part of the sky (seen in the wide shot)
const BEND = (() => {
  const xn = hisX(77.3) + 980;
  return { xn, V: [hisX(77.3) + 1500, R.horizon + 1] };
})();
// a polyline A -> C -> B with the corner at C rounded off (radius r)
function elbow(A, C, B, r, n = 8) {
  const d1 = Math.hypot(C[0] - A[0], C[1] - A[1]);
  const d2 = Math.hypot(B[0] - C[0], B[1] - C[1]);
  const P = [C[0] + ((A[0] - C[0]) * r) / d1, C[1] + ((A[1] - C[1]) * r) / d1];
  const Q = [C[0] + ((B[0] - C[0]) * r) / d2, C[1] + ((B[1] - C[1]) * r) / d2];
  return [A, ...Array.from({ length: n + 1 }, (_, i) => bez(P, C, Q, i / n)), B];
}

// ------------------------------------------------------------------ camera
// (z, sx = his screen x, fy = screen y of the road's near edge). In the
// stillness the frame is tight and the fork ahead is just out of shot.
const FORK0 = FORK.L[0]; // where the fork begins
let ZH = 1.8;
const sxFor = (z) => W - (FORK0 - hisX(HIM.STOP1) - 50) * z;
while (sxFor(ZH) > 1160 && ZH < 2.1) ZH += 0.02;
const SXH = clamp(sxFor(ZH), 860, 1160);
export const HOLD = { z: ZH, sx: SXH };
const ZW = 0.55; // the last, wide frame (held a second before s08)
const CAMK = {
  z: [[52.3, 1.3], [53.7, 1.33], [55.8, 1.35], [57.6, 1.47], [58.7, ZH], [64.9, ZH], [67.6, 1.24], [72.0, 1.24], [75.6, ZW]],
  sx: [[52.3, 760], [53.7, 560], [54.8, 560], [57.0, 900], [58.7, SXH], [64.9, SXH], [67.6, 700], [72.0, 720], [75.6, 690]],
  fy: [[52.3, 760], [53.7, 800], [56.6, 800], [58.7, 840], [64.9, 840], [67.6, 795], [72.0, 795], [75.6, 820]],
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
    path(ctx, [[xa - 2, R.near], [xb + 2, R.near]], { w: 3.6 * lw, seed: 8200 + sd, wobble: 0.6 });
    // the far edge, open where her road leaves it
    seg(ctx, R.far, xa - 2, xb + 2, [[F.L[0] - 34, F.R[0] + 34]], { w: 2.6 * lw, seed: 8201 + sd, wobble: 0.6 });
    path(ctx, [[xa - 2, R.horizon], [xb + 2, R.horizon]], { w: 1.8 * lw, color: COL.inkSoft, seed: 8202 + sd, wobble: 0.5 });
    // centre dashes
    for (let k = 0; k < 2; k++) {
      const dx = xa + 60 + k * 200;
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
    // far telegraph poles every other tile (not where a road meets the sky)
    if ((i & 1) === 0) {
      const px = xa + 120 + hash(i * 5.3) * 160;
      if (Math.abs(px - F.V[0]) > 90) {
        path(ctx, [[px, R.horizon + 2], [px, R.horizon - 70]], { w: 2 * lw, color: COL.inkSoft, seed: 9800 + (i & 255), wobble: 0.3 });
        path(ctx, [[px - 12, R.horizon - 62], [px + 12, R.horizon - 62]], { w: 1.6 * lw, color: COL.inkSoft, seed: 9801 + (i & 255), wobble: 0.3 });
      }
    }
  }
  // her lane: out of the mouth (round corners) and away to the horizon
  if (x1 > F.L[0] - 500 && x0 < F.R[0] + 500) {
    const qM = F.qM;
    const qE = qOf(LANE_END);
    const N = 16;
    const edge = (side) => Array.from({ length: N + 1 }, (_, k) => laneEdge(lerp(qM - 0.05, qE, k / N), side));
    // each edge in three pieces, lighter into the distance
    const fade = (pts, seed) => {
      const cut = [0, 9, 13, N];
      for (let k = 0; k < 3; k++) path(ctx, pts.slice(cut[k], cut[k + 1] + 1), { w: 2.6 * lw * [1, 0.8, 0.6][k], alpha: [1, 0.7, 0.35][k], seed: seed + k * 7, wobble: 0.4 });
    };
    path(ctx, elbow([F.L[0] - 30, R.far], F.L, laneEdge(qM - 0.05, -1), 14), { w: 2.6 * lw, seed: 8300, wobble: 0.5 });
    fade(edge(-1), 8303);
    path(ctx, elbow(laneEdge(qM - 0.05, 1), F.R, [F.R[0] + 30, R.far], 14), { w: 2.6 * lw, seed: 8301, wobble: 0.5 });
    fade(edge(1), 8304);
    // centre dashes, shorter and fainter into the distance (even steps on
    // the ground are even steps in 1/q)
    for (let k = 0; k < 7; k++) {
      const d0 = 0.22 + k * 0.5;
      const qa = qM / (1 + d0);
      const qb = qM / (1 + d0 + 0.25);
      if (qb < qE + 0.02) break;
      path(ctx, [laneMid(qa), laneMid(qb)], { w: Math.max(1.2, 3 * Math.pow(qa / qM, 0.6)) * lw, color: COL.inkSoft, alpha: clamp(qa / qM + 0.25), seed: 8310 + k, wobble: 0.1 });
    }
    // marker posts up its right side, shrinking
    [0.56, 0.42, 0.33, 0.27].forEach((q, k) => {
      const [ex, ey] = laneEdge(q, 1);
      const px = ex + 24 * q;
      path(ctx, [[px, ey + 2 * q], [px, ey - 64 * q]], { w: Math.max(1.2, 3.2 * q) * lw, color: COL.inkSoft, alpha: clamp(q * 2.4), seed: 8320 + k, wobble: 0.2 });
    });
    // the field it runs across
    FIELD.forEach(([w, q], k) => {
      const [mx, my] = laneMid(q);
      tuft(ctx, mx + (w * q) / qM, my, clamp(q * 2), 8330 + k, 1.25 * (q / qM), lw);
    });
    signpost(ctx, F.post[0], F.post[1], lw);
  }
}

// a blank signpost with two arms: along the road, and up her lane
function signpost(ctx, x, base, lw) {
  const top = base - 168;
  path(ctx, [[x, base], [x + 1, top]], { w: 3.6 * lw, seed: 8340, wobble: 0.3 });
  const arm = (y, dir, len, rot, sd) => {
    const c = Math.cos(rot);
    const sn = Math.sin(rot);
    const P = (u, v) => [x + u * c - v * sn, y + u * sn + v * c];
    const h = 10;
    const u0 = -dir * 8;
    const u1 = dir * len;
    path(ctx, [P(u0, -h), P(u1, -h), P(u1 + dir * 14, 0), P(u1, h), P(u0, h)], { w: 2.8 * lw, close: true, fill: COL.paper, seed: sd, wobble: 0.3 });
  };
  arm(top + 24, -1, 62, 0.42, 8341); // up her lane
  arm(top + 58, 1, 66, -0.03, 8342); // on along his road
  path(ctx, [[x - 5, top - 2], [x + 6, top - 2]], { w: 3 * lw, seed: 8343, wobble: 0.2 });
}

// Low bushes: a few on the far verge, a few small ones far off on the
// horizon (bumpy mounds — never round heads on sticks next to stick people)
const BUSHES = [
  [hisX(59.4) - 390, R.far - 3, 0.8],
  [FORK.R[0] + 420, R.far - 3, 0.9],
  [BEND.xn - 700, R.far - 3, 1.0],
  [FORK.V[0] + 260, R.horizon + 2, 0.4],
  [FORK.V[0] - 380, R.horizon + 2, 0.34],
  [BEND.V[0] - 420, R.horizon + 2, 0.38],
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
function walkPose(ph, amt, x, ground, s, sw = 0.4, f = 1) {
  const w = walk(ph, ground, s, amt);
  const a = Math.sin(ph * TAU);
  const k = clamp(amt / 0.58);
  return pose({ ...w, x, s, f, lean: 0.035, head: -0.02, look: 0, aA1: 0.02 - sw * k * a, aA2: 0.34, aB1: 0.02 + sw * k * a, aB2: 0.34 });
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
  // the girl clapping up ahead: his head comes up, his face comes round a
  // little; the smile at her; looking down at the light; the head coming up;
  // the goodbye
  p.turn = keys(t, [[53.3, 0], [53.7, 0.22], [55.0, 0.22], [55.5, 0], [57.5, 0], [57.8, 0.62], [58.42, 0.62], [58.62, 0], [64.6, 0], [65.0, 0.62], [65.5, 0.62], [65.9, 0.12], [66.6, 0], [S2 + 0.1, 0], [S2 + 0.4, 0.22], [72.5, 0.22], [72.95, 0.05], [73.3, 0]]);
  p.head = keys(t, [[53.3, -0.02], [53.7, -0.08], [55.0, -0.07], [55.5, -0.02], [58.45, -0.02], [58.8, 0.4], [59.6, 0.46], [64.0, 0.5], [64.95, -0.06], [65.8, -0.03], [S2 + 0.1, -0.03], [S2 + 0.4, -0.08], [71.3, -0.08], [72.1, -0.13], [72.6, -0.12], [73.2, -0.03], [76.5, -0.07]]);
  p.look = keys(t, [[53.3, 0], [53.7, -0.25], [55.0, -0.2], [55.5, 0], [58.45, 0], [58.75, 1], [64.0, 1], [64.9, -0.1], [65.8, 0], [S2 + 0.1, 0], [S2 + 0.4, -0.3], [71.3, -0.3], [72.1, -0.5], [72.6, -0.5], [73.2, 0]]);
  const mouth = keys(t, [[53.6, 0], [54.1, 0.15], [55.2, 0.15], [55.7, 0], [57.6, 0], [57.9, 1], [58.85, 1], [59.12, -0.4], [64.35, -0.4], [64.7, 0], [65.1, 0.7], [65.9, 0.55], [68.0, 0.45], [S2 + 0.4, 0.65], [71.2, 0.55], [72.2, 0.3], [73.2, 0.22], [75, 0.2]]);

  // the falter: forward over his slowing feet, then a small jolt back
  const jolt = keys(t, [[58.9, 0], [59.3, 0.4], [59.45, -1], [59.62, -0.7], [60.2, 0.25], [64.0, 0.3], [64.95, 0]], ease.inOut);
  p.lean = 0.035 + 0.075 * Math.max(0, jolt) + 0.1 * Math.min(0, jolt) + 0.07 * hold1 * (1 - smooth(t, 64.0, 64.95));
  // a startled recoil: elbows pulled back and in, hands up to the chest,
  // the head dropping a little
  const tw = keys(t, [[59.3, 0], [59.42, 1], [59.58, 1], [59.68, 0]]);
  if (tw > 0) {
    p.aA1 = lerp(p.aA1, -0.12, tw);
    p.aA2 = lerp(p.aA2, 2.3, tw);
    p.aB1 = lerp(p.aB1, -0.24, tw);
    p.aB2 = lerp(p.aB2, 2.15, tw);
    p.head += 0.05 * tw;
  }
  // waving goodbye at the fork: side on, to her, the near arm raised in
  // front of him (he keeps it up a moment as she turns away)
  const wv = smooth(t, S2 + 0.45, S2 + 0.7) * (1 - smooth(t, 71.1, 71.4));
  if (wv > 0) {
    p.aA1 = lerp(p.aA1, 1.95, wv);
    p.aA2 = lerp(p.aA2, 0.5 + 0.3 * Math.sin((t - S2) * 8.5), wv);
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

// her up her own lane: q = 1 where she leaves, -> 0 at the horizon. (A
// little quicker than a real walk away would be, so that she is small and
// gone into the dusk well before he walks past the mouth of her lane.)
const BR_V = 1.1;
function herRoad(t) {
  const u = Math.max(0, t - HER.Tb);
  // she eases into a steady walk over the first 0.8 s
  const e = u < 0.8 ? (u * u) / 1.6 : u - 0.4;
  const q = 1 / (1 + BR_V * e);
  const [x, y] = laneMid(q);
  return { x, y, s: HS * q, q };
}

// her seen from behind, walking away: a back-view figure whose legs are
// drawn here (a lifted foot reads shorter)
function backWalk(ph, x, gy, s) {
  const a = Math.sin(ph * TAU);
  const p = pose({ x, y: gy - LEG * s - 1.6 * s * Math.abs(a), s, view: 'back', lean: 0.015 * a, aA1: 0.24 + 0.07 * a, aA2: 0.12, aB1: 0.24 - 0.07 * a, aB2: 0.12, tail: 0.1 * Math.sin(ph * TAU * 2) });
  p.liftA = Math.max(0, a);
  p.liftB = Math.max(0, -a);
  return p;
}
function backLegs(ctx, p, j, o) {
  const s = p.s;
  [[j.hipL, -1, p.liftA, 1], [j.hipR, 1, p.liftB, 4]].forEach(([h, side, lift, k]) => {
    const knee = [h[0] + side * 4 * s, h[1] + BODY.ul * s * (1 - 0.12 * lift)];
    const foot = [knee[0] + side * 3 * s, knee[1] + BODY.ll * s * (1 - 0.5 * lift)];
    path(ctx, [h, knee, foot], { w: o.w, alpha: o.alpha, seed: 2 * 41 + k, wobble: 1.1 });
  });
  path(ctx, [j.hipL, j.hipR], { w: o.w, alpha: o.alpha, seed: 2 * 41 + 6, wobble: 0.4 });
}

function herWalk(t) {
  const ph = look(HRT.PH, t);
  const p = walkPose(ph, look(HRT.AM, t), herX(t), HG, HS, 0.36);
  p.tail = 0.12 + 0.06 * Math.sin(ph * TAU * 2);
  p.lean = 0.04;
  return p;
}

// coming toward him (facing left), arms coming to rest as she stops
function herComing(t) {
  const ph = look(HA.T.PH, t);
  const p = walkPose(ph, look(HA.T.AM, t), herX(t), HG, HS, 0.36, -1);
  p.tail = 0.12 + 0.06 * Math.sin(ph * TAU * 2);
  p.lean = 0.04;
  const rest = smooth(t, HA.stop - 0.35, HA.stop + 0.15);
  for (const a of ARMS) p[a] = lerp(p[a], HANG[a], rest);
  p.lean = lerp(0.04, 0.01, rest);
  // she has seen him: her face comes round a little
  p.turn = 0.3 * smooth(t, HA.stop - 0.6, HA.stop);
  return p;
}

// facing us, clapping for him, her head turned his way (k: 0..1 hands up)
const CLAP0 = HA.stop + 0.4;
function herClap(t, k) {
  const p = pose({ x: herX(t), y: HG - LEG * HS * Math.cos(0.08), s: HS, view: 'front', lA1: 0.08, lB1: 0.08, aA1: 0.16, aA2: 0.08, aB1: 0.16, aB2: 0.08, turn: -0.6, head: -0.06, tail: 0.1 });
  let hit = 0;
  if (k > 0.001) {
    const c = 0.5 + 0.5 * Math.sin(((t - CLAP0) * 3 + 0.25) * TAU); // 0: hands together
    // elbows down and out, forearms up and in: the hands meet just below
    // the chin (angles worked out for the front-view arm)
    const a1 = 0.7 + 0.1 * c;
    const a2 = -2.07 - 0.5 * c - a1;
    p.aA1 = lerp(p.aA1, a1, k);
    p.aA2 = lerp(p.aA2, a2, k);
    p.aB1 = lerp(p.aB1, a1, k);
    p.aB2 = lerp(p.aB2, a2, k);
    hit = k * clamp((0.35 - c) / 0.3);
  }
  p.clap = hit;
  return p;
}

// side (facing f0) -> front -> side (facing f1); a: side pose, b: front
function toFront(a, b, k) {
  return k < 0.45 ? { ...a, turn: Math.max(a.turn ?? 0, 0.75 * (k / 0.45)) } : b;
}
function fromFront(b, a, k) {
  return k < 0.5 ? b : { ...a, turn: Math.max(a.turn ?? 0, 0.6 * (1 - (k - 0.5) / 0.5)) };
}

function herPose(t) {
  const Q = HER;
  const TF = HA.stop + 0.05; // she turns to the front, to clap
  const TS = Q.Tgo - 0.34; // ... and round, to walk with him
  const T1 = Q.STOP1 + 0.08; // she turns round to face him
  const T2 = Q.Tr - 0.42; // ... and back, to walk on
  const T3 = Q.STOP2 + 0.06; // at the fork: she turns to him, a wave
  const T4 = Q.Tb - 0.45; // ... and away
  let mouth = keys(t, [[52.8, 0.2], [HA.stop - 0.5, 0.25], [HA.stop, 0.7], [HA.stop + 0.6, 0.9], [TS, 0.85], [Q.Tgo + 0.6, 0.6], [57.0, 0.45], [57.8, 0.45], [58.1, 0.8], [58.9, 0.6], [59.4, 0], [60.3, -0.05], [64.85, -0.05], [65.2, 0.65], [68.0, 0.5], [T3 + 0.3, 0.85], [T4, 0.75], [T4 + 0.4, 0.5]]);
  let p;
  let alpha = 1;
  if (t < TF) {
    p = herComing(t);
  } else if (t < TS + 0.34) {
    const hands = smooth(t, TF + 0.2, CLAP0) * (1 - smooth(t, TS - 0.3, TS - 0.04));
    const fr = herClap(t, hands);
    if (t < TF + 0.3) p = toFront(herComing(t), fr, (t - TF) / 0.3);
    else if (t < TS) p = fr;
    else {
      const wk = herWalk(t);
      for (const a of ARMS) wk[a] = HANG[a];
      wk.turn = 0.45;
      p = fromFront(fr, wk, (t - TS) / 0.34);
    }
  } else if (t < T1) {
    p = herWalk(t);
    const r = smooth(t, Q.Tgo, Q.Tgo + 0.5);
    for (const a of ARMS) p[a] = lerp(HANG[a], p[a], r);
    p.turn = keys(t, [[Q.Tgo, 0.45], [Q.Tgo + 0.5, 0.3], [56.85, 0.3], [57.1, 0], [57.85, 0], [58.1, 0.5], [58.75, 0.5], [59.0, 0]]);
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
    // she turns round to him and waves: side on, facing him, the near arm
    // raised in front of her (clear of her face and her ponytail)
    const wk = herWalk(t);
    for (const a of ARMS) wk[a] = HANG[a];
    const st = standPose(herX(t), HG, HS, -1);
    st.turn = 0.35;
    st.head = -0.02;
    st.look = 0.15;
    const wv = smooth(t, T3 + 0.3, T3 + 0.55) * (1 - smooth(t, T4 - 0.32, T4 - 0.06));
    st.aA1 = lerp(HANG.aA1, 1.68, wv);
    st.aA2 = lerp(HANG.aA2, 0.92 + 0.3 * Math.sin((t - T3 - 0.3) * 9), wv);
    const k = clamp((t - T3) / 0.36);
    p = k < 1 ? turnPose(wk, st, k, HG) : st;
  } else if (t < Q.Tb) {
    // ... and turns away to her road: side on, then her back to us, her
    // head still turned toward him
    const k = (t - T4) / (Q.Tb - T4);
    if (k < 0.45) {
      p = standPose(herX(t), HG, HS, -1);
      p.turn = 0.35 * (1 - k / 0.45);
    } else {
      p = pose({ x: herX(t), y: HG - LEG * HS * Math.cos(0.09), s: HS, view: 'back', lA1: 0.09, lB1: 0.09, aA1: 0.24, aA2: 0.1, aB1: 0.24, aB2: 0.1, turn: -0.62 });
    }
  } else {
    const b = herRoad(t);
    const ph = look(HRT.PH, t);
    p = backWalk(ph, b.x, b.y, b.s);
    p.turn = keys(t, [[Q.Tb, -0.62], [Q.Tb + 0.5, -0.5], [Q.Tb + 1.1, 0]]);
    p.back = true;
    // she fades into the dusk as she grows small
    alpha = clamp((b.q - 0.27) / 0.13);
    mouth = undefined;
  }
  return { p, mouth, alpha };
}

// ------------------------------------------------------------------ s05's dark lamps
// s05's lamps that have gone out stay standing in the take (drawn as s04.js
// draws an unlit lamp), so they scroll away instead of dissolving in place.
function s05Posts(ctx, t, x0, x1) {
  let groups = null;
  try {
    groups = Array.isArray(S04.GROUPS) ? S04.GROUPS : null;
  } catch (e) {
    groups = null;
  }
  if (!groups) return;
  for (const g of groups) {
    if (!Number.isFinite(g.x) || !Number.isFinite(g.lamp) || !Number.isFinite(g.h)) continue;
    const lx = g.x + g.lamp;
    if (lx < x0 - 80 || lx > x1 + 80) continue;
    if (!(g.off || (g.out && t > g.out[1]))) continue;
    ctx.save();
    ctx.globalAlpha *= 0.72;
    standLamp(ctx, lx, R.far - 6, g.h, g.x, R.far + 6 - 40, { seed: 5600 + (g.seed ?? 0) * 7, w: 4 * 0.85, alpha: 0.5 });
    ctx.restore();
  }
}

// ------------------------------------------------------------------ her clapping
// the claps: short ticks either side of the hands as they meet
function clapTicks(ctx, j, s, hit) {
  const mx = (j.handA[0] + j.handB[0]) / 2;
  const my = (j.handA[1] + j.handB[1]) / 2;
  const r0 = 15 * s;
  const r1 = 31 * s;
  [[-1, -0.7], [1, -0.7], [-1.15, 0.2], [1.15, 0.2]].forEach(([dx, dy], i) => {
    const n = Math.hypot(dx, dy);
    path(ctx, [[mx + (dx / n) * r0, my + (dy / n) * r0], [mx + (dx / n) * r1, my + (dy / n) * r1]], { w: Math.max(1.8, 3.6 * s), alpha: hit, seed: 8452 + i, wobble: 0 });
  });
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

// ------------------------------------------------------------------ the little light
// on as she falls in step; it goes as she walks off up her road
const LOFF = [71.4, 72.9];
function poolK(t) {
  return smooth(t, 56.6, 57.15, ease.out) * (1 - smooth(t, LOFF[0], LOFF[1], ease.sine));
}
const ovalPts = (x, y, rx, ry) => Array.from({ length: 28 }, (_, i) => [x + Math.cos((i / 28) * TAU) * rx, y + Math.sin((i / 28) * TAU) * ry]);

// the road's near edge, washed pale where the little light lies on it
function washEdge(ctx, t) {
  const k = poolK(t);
  if (k < 0.01) return;
  const px = hisXs(t);
  const rx = 80;
  const g = ctx.createLinearGradient(px - rx, 0, px + rx, 0);
  g.addColorStop(0, 'rgba(232,226,214,0)');
  g.addColorStop(0.3, `rgba(232,226,214,${0.72 * k})`);
  g.addColorStop(0.7, `rgba(232,226,214,${0.72 * k})`);
  g.addColorStop(1, 'rgba(232,226,214,0)');
  ctx.save();
  ctx.fillStyle = g;
  ctx.fillRect(px - rx, G - 6, rx * 2, 12);
  ctx.restore();
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
    s05Posts(ctx, t, x0, x1);

    washEdge(ctx, t);
    // her (a lane further back: drawn first)
    const her = herPose(t);
    const hp = her.p;
    if (hp.x > x0 - 150 && hp.x < x1 + 150 && her.alpha > 0.01) {
      const o = { id: 2, ponytail: true, noTie: true, mouth: her.mouth, alpha: her.alpha, w: Math.max(2, 4.6 * Math.pow(hp.s, 0.85)) * lw };
      if (hp.back) {
        backLegs(ctx, hp, figure(ctx, hp, { ...o, legs: false }), o);
      } else {
        const j = figure(ctx, hp, o);
        if (hp.clap > 0.02) clapTicks(ctx, j, hp.s, hp.clap);
      }
    }
    // him
    const me = himPose(t);
    figure(ctx, me.p, { id: 1, cowlick: true, mouth: t < 53.3 ? undefined : me.mouth, w: Math.max(2, 4.6 * Math.pow(S, 0.85)) * lw });

    // lights: the small light at his feet; the sky ahead getting lighter
    const lights = [];
    const kp = poolK(t);
    if (kp > 0.001) {
      const on = smooth(t, 56.6, 57.15, ease.out);
      const rx = lerp(50, 86, on) * lerp(0.8, 1, kp / Math.max(on, 1e-3));
      const px = hisXs(t);
      lights.push({ type: 'pool', x: px, y: G + 2, rx, ry: rx * 0.25, k: kp });
      // a defined rim: light lying on the ground, not a smear
      lights.push({ type: 'poly', pts: ovalPts(px, G + 2, rx * 0.93, rx * 0.25 * 0.93), k: 0.42 * kp });
      // what it spills up onto him
      lights.push({ type: 'glow', x: px, y: G - 80, r: 210, k: 0.4 * kp });
    }
    // while the little light is on, the world around the pair sinks a little
    const vk = smooth(t, 56.6, 57.6, ease.sine) * (1 - smooth(t, LOFF[0], LOFF[1] + 0.3, ease.sine));
    if (vk > 0.001) lights.push({ type: 'glow', x: (hisXs(t) + herX(t)) / 2, y: G - 150, r: 680, k: 0.15 * vk });
    lights.push({ type: 'glow', x: cam.x + 900 / cam.z, y: R.horizon - 60, r: 1500 / Math.min(1, cam.z), k: 0.5 });
    // in the wide frame: the sky ahead of him, where his road goes, is lightest
    const wideK = smooth(t, 72, 76, ease.sine);
    if (wideK > 0) lights.push({ type: 'glow', x: BEND.V[0], y: R.horizon - 80, r: 2200, k: 0.55 * wideK });
    const dark = keys(t, [[51.5, 0.48], [54.0, 0.45], [70.0, 0.45], [76.0, 0.26]]) + 0.08 * vk;
    stage(ctx, lights, { dark, beams: 0 });
  });
}

export default {
  fadeOut: 0, // the take runs straight on into s07
  draw(ctx, lt, info) {
    take(ctx, info.start + lt);
  },
};
