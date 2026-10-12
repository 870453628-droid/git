// s02 · 16–40 · 长大，光变小，追更亮的光，迷失，座位空了
//
// The same theatre, later. Out of the dark his light comes up on the child;
// he walks across the stage and with every step he grows (0.6 → 1.0) while
// the follow-spot shrinks and dims until it only holds his feet. In the
// front rows people stand up and quietly leave. Push in: the little light at
// his feet. BANG — far across the stage a huge white light slams on; whip
// pan to it (blazing, empty), whip back, pull out wide: he leaves his small
// light (it goes out behind him) and runs to the big one. He opens his arms
// in it — and it dims. BANG BANG BANG: lights everywhere; he runs from one to
// the next, each dies as he gets there; the camera swings with him, rolling,
// faster, dizzier; he stops, turns round and round. Cut straight down from
// above: a small figure in a sea of dark, lights blinking far off, the
// camera rising and turning. Then the camera comes down into the hall:
// almost empty, the house lights low; the last few people get up and go.
// His light goes out.
import { W, H, TAU, clamp, lerp, prog, smooth, keys, ease, hash, noise1, camera, path, fillPoly, ellipsePts } from '../lib.js';
import { figure, pose, walk } from '../figure.js';
import { TH, F, stageCam, project, stagePlane, hallDark, ROWS, person } from '../theatre.js';
import { spotOnScreen, stageWash } from './s01.js';

const DARK = '#151311';
const FL = TH.floor;
const VP = 330; // where the floor boards meet
const depthS = (y) => (y - VP) / (FL - VP); // scale of things standing at floor depth y
const S_END = 24;

// ------------------------------------------------------------- utilities
function trap(k, ra, rd) {
  const v = 1 / (1 - ra / 2 - rd / 2);
  if (k <= 0) return 0;
  if (k >= 1) return 1;
  if (k < ra) return (0.5 * v * k * k) / ra;
  if (k < 1 - rd) return v * (ra / 2 + (k - ra));
  return 1 - (0.5 * v * (1 - k) * (1 - k)) / rd;
}
// keyframes with a per-segment ease: [[t, value, ease?], ...] (ease of the
// segment that ENDS at that key)
function track(t, kf) {
  if (t <= kf[0][0]) return kf[0][1];
  for (let i = 1; i < kf.length; i++) {
    const [t1, v1, e] = kf[i];
    if (t <= t1) {
      const [t0, v0] = kf[i - 1];
      const k = (e ?? ease.inOut)(prog(t, t0, t1));
      if (typeof v0 === 'number') return lerp(v0, v1, k);
      const o = {};
      for (const key in v0) o[key] = lerp(v0[key], v1[key] ?? v0[key], k);
      return o;
    }
  }
  return kf[kf.length - 1][1];
}
const whipE = (k) => (k < 0.5 ? 8 * k * k * k * k : 1 - Math.pow(-2 * k + 2, 4) / 2);

// A run cycle (side view). u: cycle phase (1 = two strides).
function runLegs(u) {
  const leg = (v) => {
    const th = 0.15 + 0.62 * Math.sin(v * TAU);
    const tuck = Math.pow(Math.max(0, Math.cos((v + 0.03) * TAU)), 1.4);
    return [th, -(0.32 + 1.2 * tuck)];
  };
  const [lA1, lA2] = leg(u);
  const [lB1, lB2] = leg(u + 0.5);
  const a = Math.sin(u * TAU);
  return { lA1, lA2, lB1, lB2, aA1: 0.05 - 0.8 * a, aA2: 1.55, aB1: 0.05 + 0.8 * a, aB2: 1.55 };
}
function footDrop(p, s) {
  const f = (a1, a2) => (Math.cos(a1) * 58 + Math.cos(a1 + a2) * 56) * s;
  return Math.max(f(p.lA1, p.lA2), f(p.lB1, p.lB2));
}

// ------------------------------------------------------------- the bangs
const B_BIG = 4.95;
// [time, light id]
// [time, light id, jolt, flash]
const BANGS = [
  [B_BIG, 'big', 1.2, 0.85],
  [13.0, 'L2', 0.8, 0.6],
  [13.38, 'L3', 0.8, 0.6],
  [13.7, 'L4', 0.8, 0.6],
  [14.72, 'L5', 0.8, 0.6],
  [15.78, 'L6', 0.8, 0.6],
  [16.05, 'L7', 0.8, 0.6],
  [16.98, 'F1', 0.3, 0.35],
  [17.22, 'F2', 0.3, 0.35],
  [17.44, 'F3', 0.3, 0.35],
  [17.62, 'F4', 0.3, 0.35],
];

// ------------------------------------------------------------- him
// 1. the walk: he grows a notch with every step, feet planted (no slide)
const WK = { t0: 0.8, t1: 4.3, x0: 690, phi: 3.5 };
const PHI_C = (k) => -0.25 + 0.5 * k; // contact of stance k
function growAt(phi) {
  let g = 0;
  for (let k = 1; k <= 6; k++) g += ease.inOut(prog(phi, 0.5 * k + 0.02, 0.5 * k + 0.22));
  return 0.6 + (0.4 * g) / 6;
}
const XC = (() => {
  const a = [WK.x0];
  for (let k = 1; k <= 8; k++) a.push(a[k - 1] + 92.96 * growAt(PHI_C(k)));
  return a;
})();
function walkPhi(t) {
  return WK.phi * trap(prog(t, WK.t0, WK.t1), 0.12, 0.16);
}
function walkX(phi) {
  const k = Math.max(0, Math.floor((phi + 0.25) / 0.5));
  const a = (k % 2 ? 1 : -1) * 0.42 * Math.sin(TAU * phi);
  return XC[k] - growAt(phi) * 114 * Math.sin(a);
}
const X_END = walkX(WK.phi);

// 2. the runs: [t0, t1, x0, y0, x1, y1]  (y = floor depth of his feet)
const P_BIG = [560, 636];
const P2 = [1075, 612];
const P5 = [735, 676];
const P_LOST = [905, 650];
const RUNS = [
  [8.0, 10.85, X_END, FL, P_BIG[0], P_BIG[1], 0.34, 0.26],
  [13.78, 14.6, P_BIG[0], P_BIG[1], P2[0], P2[1], 0.25, 0.3],
  [14.88, 15.62, P2[0], P2[1], P5[0], P5[1], 0.25, 0.3],
  [15.98, 16.32, P5[0], P5[1], 860, 664, 0.3, 0.45],
  [16.46, 16.78, 860, 664, P_LOST[0], P_LOST[1], 0.3, 0.45],
];
const trueDist = (x0, y0, x1, y1) => Math.hypot((x1 - x0) / depthS((y0 + y1) / 2), (y1 - y0) * 5.5);

function moveAt(t) {
  if (t < RUNS[0][0]) return { x: t < WK.t0 ? WK.x0 : walkX(walkPhi(t)), y: FL, v: 0, i: -1, u: 0 };
  let st = null;
  for (let i = 0; i < RUNS.length; i++) {
    const [t0, t1, x0, y0, x1, y1, ra, rd] = RUNS[i];
    if (t < t0) break;
    const k = trap(prog(t, t0, t1), ra, rd);
    const D = trueDist(x0, y0, x1, y1);
    const x = lerp(x0, x1, k);
    const y = lerp(y0, y1, k);
    st = { x, y, i, dist: D * k, D, dir: Math.sign(x1 - x0) || 1, moving: t < t1 };
  }
  return st;
}
function speedAt(t) {
  const a = moveAt(t - 0.02);
  const b = moveAt(t + 0.02);
  return trueDist(a.x, a.y, b.x, b.y) / 0.04;
}
export function himXY(t) {
  const m = moveAt(t);
  return [m.x, m.y];
}

// The planted leg carries him (walkX keeps its foot still). The hip rides
// high enough that the swinging foot never scuffs along the floor (the
// planted foot may rise onto its toes a little instead). Returns the hip y.
function plantedHipY(p, phi, s) {
  const k = Math.max(0, Math.floor((phi + 0.25) / 0.5));
  const st = k % 2 ? 'A' : 'B';
  const sw = st === 'A' ? 'B' : 'A';
  const reach = (l) => Math.cos(p['l' + l + '1']) * 58 + Math.cos(p['l' + l + '1'] + p['l' + l + '2']) * 56;
  // clearance: none at a contact, 3 units in mid-swing
  const dc = Math.abs(phi - (Math.round((phi - 0.25) / 0.5) * 0.5 + 0.25));
  const clr = 3 * clamp(dc / 0.06);
  return FL - Math.max(reach(st), reach(sw) + clr) * s;
}

// his body growth (0.6 child → 1.0)
const growth = (t) => (t < WK.t0 ? 0.6 : t < WK.t1 + 0.5 ? growAt(walkPhi(t)) : 1);

// the spin: his facing angle (0 = toward the hall, + = turning to screen right)
const SPIN = [16.86, 19.2];
function spinAngle(t) {
  // accelerate, then slow to a stop facing the hall
  const k = prog(t, SPIN[0], SPIN[1]);
  return 4 * TAU * trap(k, 0.35, 0.5);
}

// face and body for any time; returns {p, mouth, eye}
export function him(t) {
  const g = growth(t);
  const m = moveAt(t);
  const ds = depthS(m.y);
  const s = g * ds;
  let p;
  let mouth = 0;
  // ---- the walk
  if (t < RUNS[0][0]) {
    const phi = walkPhi(t);
    const wl = walk(phi, FL, s);
    const startK = smooth(t, WK.t0 - 0.05, WK.t0 + 0.2);
    const stand = { lA1: 0.04, lA2: 0, lB1: -0.04, lB2: 0, aA1: 0.12, aA2: 0.12, aB1: -0.1, aB2: 0.12 };
    p = pose({ x: m.x, s, f: 1, ...wl });
    // standing at the start: legs together
    if (startK < 1) {
      for (const key of ['lA1', 'lA2', 'lB1', 'lB2', 'aA1', 'aA2', 'aB1', 'aB2']) p[key] = lerp(stand[key], wl[key], startK);
    }
    // the end of the walk: the trailing foot comes down beside the other
    const endK = smooth(t, WK.t1, WK.t1 + 0.28);
    p.lB2 = lerp(p.lB2, 0, endK);
    p.lean = lerp(0.06 * startK, 0.02, endK);
    p.y = startK >= 1 && endK <= 0 ? plantedHipY(p, phi, s) : FL - footDrop(p, s);
    // looking: up at his light → ahead → down at the little light at his feet
    p.head = keys(t, [[0, -0.4], [1.4, -0.35], [2.4, 0.02], [3.6, 0.05], [4.4, 0.42]]);
    p.look = keys(t, [[0, -1], [1.4, -0.9], [2.4, 0], [3.6, 0.2], [4.4, 1]]);
    mouth = keys(t, [[0, 0.5], [1.6, 0.4], [2.6, 0], [4.2, -0.2]]);
    // BANG: he turns to look back over his shoulder, then faces it
    if (t > B_BIG) {
      const turnK = smooth(t, B_BIG + 0.02, B_BIG + 0.18);
      p.head = lerp(p.head, -0.1, turnK);
      p.look = lerp(p.look, -0.3, turnK);
      p.turn = turnK;
      p.aA1 = lerp(p.aA1, 0.3, turnK);
      p.aB1 = lerp(p.aB1, -0.2, turnK);
      if (t > B_BIG + 0.22) {
        // facing the big light (screen left)
        p.f = -1;
        p.turn = 1 - smooth(t, B_BIG + 0.22, B_BIG + 0.45);
        p.lA1 = 0.05;
        p.lB1 = -0.05;
        p.lA2 = p.lB2 = 0;
        p.aA1 = 0.16;
        p.aA2 = 0.12;
        p.aB1 = -0.08;
        p.y = FL - footDrop(p, s);
        // looking at it, then down at his own small light, then back at it
        p.head = keys(t, [[B_BIG + 0.3, -0.12], [7.15, -0.12], [7.4, 0.48], [7.75, 0.48], [8.0, -0.1]]);
        p.look = keys(t, [[B_BIG + 0.3, -0.3], [7.15, -0.3], [7.4, 1], [7.75, 1], [8.0, -0.2]]);
        p.lean = 0;
      }
      mouth = keys(t, [[B_BIG, -0.2], [B_BIG + 0.3, 0], [7.2, 0], [7.5, -0.3], [7.9, 0.1]]);
    }
    return { p, mouth, eye: 'dot' };
  }
  // ---- running
  if (m.moving) {
    const v = speedAt(t);
    const run = clamp(v / 420);
    const u = 0.25 + m.dist / (330 * Math.max(0.5, g));
    const rl = runLegs(u);
    const stand = { lA1: 0.06, lA2: 0, lB1: -0.06, lB2: 0, aA1: 0.12, aA2: 0.15, aB1: -0.08, aB2: 0.15 };
    const pp = {};
    for (const key in stand) pp[key] = lerp(stand[key], rl[key], Math.sqrt(run));
    p = pose({ x: m.x, s, f: m.dir, ...pp });
    p.lean = 0.03 + 0.28 * Math.sqrt(run);
    p.head = -0.18 * run;
    p.look = -0.35;
    const bob = 6 * s * run * Math.max(0, Math.sin(u * TAU * 2 - 0.6));
    p.y = m.y - footDrop(p, s) - bob;
    mouth = -0.1;
    return { p, mouth, eye: 'dot' };
  }
  // ---- standing between runs
  const base = { x: m.x, s, lA1: 0.07, lA2: 0, lB1: 0.07, lB2: 0, aA1: 0.16, aA2: 0.1, aB1: 0.16, aB2: 0.1 };
  if (m.i === 0) {
    // in the big light: arms open to it, then it dims and they sink
    p = pose({ ...base, view: 'front' });
    const open = smooth(t, 11.05, 11.75) * (1 - smooth(t, 12.0, 12.9, ease.sine));
    p.aA1 = lerp(0.16, 1.85, open);
    p.aB1 = lerp(0.16, 1.85, open);
    p.aA2 = lerp(0.1, 0.22, open);
    p.aB2 = lerp(0.1, 0.22, open);
    p.head = keys(t, [[10.85, 0], [11.1, -0.1], [12.2, -0.1], [12.9, 0.32], [13.0, 0.32], [13.06, -0.05]]);
    p.look = keys(t, [[10.85, -0.3], [11.1, -1], [12.2, -1], [12.9, 0.9], [13.0, 0.9], [13.06, -0.3]]);
    // bangs: his head snaps to each
    p.turn = keys(t, [[13.0, 0], [13.06, 0.9], [13.38, 0.9], [13.44, 1], [13.7, 1], [13.76, -0.8]], ease.out);
    p.lean = 0;
    p.y = m.y - footDrop(p, s);
    mouth = keys(t, [[10.85, 0], [11.4, 0.85], [12.1, 0.85], [12.8, -0.35], [13.0, -0.35], [13.06, 0]]);
    return { p, mouth, eye: 'dot' };
  }
  if (t >= SPIN[0]) {
    // lost: he turns round and round on the spot, then stops, head down
    p = pose({ ...base, ...viewFor(spinAngle(t), t) });
    lostEnd(p, t);
    p.y = m.y - footDrop(p, s);
    return { p, mouth: -0.3, eye: 'dot' };
  }
  // arrived at a light (side view, facing the way he ran); bangs turn him
  const prev = RUNS[m.i];
  let f = Math.sign(prev[4] - prev[2]) || 1;
  const flips = [[14.76, -1], [15.82, 1], [16.08, -1], [16.4, -1]];
  p = pose({ ...base, f, lA1: 0.12, lB1: -0.1, aA1: 0.2, aB1: -0.12, aA2: 0.2, aB2: 0.2 });
  for (const [ft, nf] of flips) if (t >= ft && t < ft + 2 && m.i < RUNS.length && ft > prev[1] - 0.01) p.f = nf;
  p.head = -0.2;
  p.look = -0.8;
  p.lean = -0.03;
  p.y = m.y - footDrop(p, s);
  mouth = 0;
  return { p, mouth, eye: 'dot' };
}

// ------------------------------------------------------------- the lights
// stage lights: pool at (x, y) on the floor (y = depth), radius R (front
// scale), source high above at (sx, sy). k(t) gives the strength.
const LIGHTS = {
  big: { x: P_BIG[0], y: P_BIG[1], R: 178, sx: 660, sy: -560, white: 1, k: [[B_BIG, 1], [11.7, 1], [12.9, 0.1], [13.0, 0.1], [13.8, 0]] },
  L2: { x: P2[0], y: P2[1], R: 120, sx: 1180, sy: -520, white: 0.6, k: [[13.0, 1], [14.3, 1], [14.85, 0.08], [15.6, 0]] },
  L3: { x: 1395, y: 662, R: 112, sx: 1500, sy: -500, white: 0.5, k: [[13.38, 1], [15.1, 1], [15.5, 0]] },
  L4: { x: 515, y: 600, R: 104, sx: 420, sy: -500, white: 0.5, k: [[13.7, 1], [14.9, 1], [15.3, 0]] },
  L5: { x: P5[0], y: P5[1], R: 120, sx: 640, sy: -520, white: 0.6, k: [[14.72, 1], [15.45, 1], [15.95, 0.06], [16.6, 0]] },
  L6: { x: 1290, y: 640, R: 112, sx: 1400, sy: -500, white: 0.6, k: [[15.78, 1], [16.2, 1], [16.6, 0]] },
  L7: { x: 600, y: 612, R: 108, sx: 520, sy: -500, white: 0.6, k: [[16.05, 1], [16.62, 1], [17.0, 0]] },
  // while he spins: lights snapping on and off around him
  F1: { x: 1330, y: 628, R: 100, sx: 1420, sy: -500, white: 0.5, k: [[16.98, 1], [17.2, 1], [17.36, 0]] },
  F2: { x: 520, y: 640, R: 100, sx: 430, sy: -500, white: 0.5, k: [[17.22, 1], [17.42, 1], [17.56, 0]] },
  F3: { x: 1180, y: 690, R: 96, sx: 1250, sy: -500, white: 0.5, k: [[17.44, 1], [17.6, 1], [17.72, 0]] },
  F4: { x: 680, y: 598, R: 96, sx: 620, sy: -500, white: 0.5, k: [[17.62, 1], [17.76, 1], [17.86, 0]] },
};
function lightK(L, t) {
  if (t < L.k[0][0]) return 0;
  return keys(t, L.k, ease.sine);
}
const BANG_POS = (id) => (id === 'own' ? [WK.x0, FL] : [LIGHTS[id].x, LIGHTS[id].y]);

// his own follow-spot: it shrinks, and its beam fades until only a little
// pool is left at his feet
function ownLight(t) {
  const [x] = himXY(Math.max(0, t - 0.12));
  const k = smooth(t, 0.15, 0.85, ease.out) * lerp(1, 0.62, smooth(t, 1.2, 4.4)) * (1 - smooth(t, 9.1, 9.9));
  const sh = smooth(t, 1.0, 4.4);
  const R = lerp(70, 30, sh);
  const fx = Math.min(x, X_END);
  return { sx: fx + 70, sy: -420, fx, fy: FL, rx: R, ry: R * 0.22, k, beam: 1 - 0.8 * smooth(t, 2.2, 4.6) };
}

function stageLights(t) {
  const out = [];
  const own = ownLight(t);
  if (own.k > 0.002) {
    out.push({ ...own, id: 'own', white: 0, k: own.k * own.beam });
    if (own.beam < 1) out.push({ type: 'pool', x: own.fx, y: own.fy, rx: own.rx * 1.1, ry: own.ry * 1.3, k: own.k * (1 - own.beam) * 1.1, id: 'ownPool' });
  }
  for (const id in LIGHTS) {
    const L = LIGHTS[id];
    const k = lightK(L, t);
    if (k <= 0.002) continue;
    const ds = depthS(L.y);
    out.push({ id, sx: L.sx, sy: L.sy, fx: L.x, fy: L.y, rx: L.R * ds, ry: L.R * ds * 0.22, k, white: L.white });
  }
  return out;
}

// ------------------------------------------------------------- the camera
const CAM_KF = [
  [0, { x: 735, y: 548, C: 830 }],
  [3.85, { x: 1050, y: 548, C: 790 }, ease.sine],
  [4.85, { x: 1080, y: 520, C: 430 }, ease.inOut],
  [5.12, { x: 1078, y: 520, C: 425 }],
  [5.5, { x: 600, y: 475, C: 640 }, whipE],
  [6.62, { x: 612, y: 480, C: 590 }, ease.sine],
  [6.95, { x: 1110, y: 520, C: 440 }, whipE],
  [7.75, { x: 1118, y: 528, C: 392 }, ease.sine],
  [9.1, { x: 890, y: 545, C: 990 }, ease.inOut],
  [10.55, { x: 750, y: 550, C: 900 }, ease.sine],
  [12.8, { x: 590, y: 560, C: 600 }, ease.inOut],
  [13.0, { x: 590, y: 560, C: 600 }],
  [13.3, { x: 820, y: 545, C: 940 }, whipE],
];
function stageCamAt(t) {
  if (t <= 13.3) return { ...track(t, CAM_KF), r: 0 };
  // the chase: the camera follows him, lagging, rolling more and more
  const base = track(13.3, CAM_KF);
  const lag = (dt) => himXY(Math.max(13.3, t - dt))[0];
  const fx = (lag(0.12) + lag(0.3) + lag(0.45)) / 3;
  const fk = smooth(t, 13.3, 14.0);
  // the spin: the camera closes in and locks onto him
  const lock = smooth(t, 16.55, 17.2);
  let snap = 0;
  for (const [b, id] of BANGS) {
    if (b < 13.3 || t < b || t > b + 1.6 || !LIGHTS[id] || id[0] === 'F') continue;
    const e = (1 - Math.exp(-(t - b) / 0.05)) * Math.exp(-(t - b) / 0.45);
    snap += (LIGHTS[id].x - fx) * 0.32 * e;
  }
  const x = lerp(lerp(base.x, fx, fk) + snap, P_LOST[0], lock);
  const C = lerp(lerp(base.C, 700, smooth(t, 13.6, 16.6)), 520, lock);
  const y = lerp(lerp(base.y, 545, fk), P_LOST[1] - 110, lock);
  return { x, y, C, r: rollAt(t) };
}
// the roll: a swing that grows and quickens, then the spin
function rollAt(t) {
  if (t < 13.3) return 0;
  const u = t - 13.3;
  const A = 0.04 + 0.16 * smooth(t, 13.6, 16.8);
  const ph = TAU * (0.35 * u + 0.09 * u * u);
  return A * Math.sin(ph) + spinRoll(t);
}
// the spin: the world turns faster and faster around him
const SPIN_W = 2.6; // rad/s when we cut to the crane
function spinRoll(t) {
  if (t < SPIN[0]) return 0;
  const T = 17.9 - SPIN[0];
  const u = t - SPIN[0];
  // angular speed ramps 0 → SPIN_W (quadratically), integrated
  return u < T ? (SPIN_W * u * u * u) / (3 * T * T) : (SPIN_W * T) / 3 + SPIN_W * (u - T);
}

// the crane (17.9–20.3): high above him, looking down at the stage floor,
// circling (still turning from the spin) and rising
const TOP = [17.9, 20.3];
function topCamAt(t) {
  const k = prog(t, TOP[0], TOP[1]);
  const z = 1.25 * Math.pow(0.34 / 1.25, ease.out3(k));
  // keep turning from where the spin left off, slowing down
  const w0 = SPIN_W;
  const T = TOP[1] - TOP[0];
  const u = t - TOP[0];
  const r = spinRoll(TOP[0]) + w0 * 0.6 * (1 - Math.exp(-u / 0.6));
  const w = w0 * Math.exp(-u / 0.6);
  // the floor's foreshortening: steeper as the camera climbs
  const e = lerp(0.5, 0.72, ease.out(k));
  return { z, r, e, w, T };
}

// the hall (20.3–24): the camera comes down among the seats
const HALL = 20.3;
function hallCamAt(t) {
  const k = smooth(t, HALL, 23.0, ease.out);
  // ending at the eye height of someone sitting in the last of these rows
  return { x: TH.cx + 230, y: lerp(170, 598, k), C: lerp(1640, 1800, k), r: 0 };
}

// ------------------------------------------------------------- the audience
// every seat has a leaving time; when it comes, the person stands up and
// edges along the row toward the nearer end, into the dark
function leaveTime(seat, row) {
  const h = hash(seat.id * 1.37 + 5.1);
  const h2 = hash(seat.id * 3.11 + 0.7);
  // a few already gone
  if (h2 < 0.16) return -10;
  if (row.k <= 3) return lerp(0.6, 16.6, h);
  return lerp(3, 16.6, h);
}
// the last few, in the final shot: [row, seat index, time, dir (0: the aisle)]
const LAST = [
  [3, 2, 20.35, -1],
  [5, 17, 20.55, 1],
  [7, 10, 20.75, 0], // into the centre aisle and up it, past us
  [1, 15, 21.0, 1],
  [8, 15, 21.2, 1],
  [4, 3, 21.45, -1],
];
const LAST_MAP = new Map(LAST.map(([rk, si, tt, dir]) => [ROWS[rk].seats[si].id, { t: tt, dir, fade: [1.2, 1.9] }]));

function seatLeave(seat, row) {
  const l = LAST_MAP.get(seat.id);
  if (l) return l;
  return { t: leaveTime(seat, row), dir: seat.X < TH.cx ? -1 : 1 };
}

const RISE = 0.5;
const SIDLE = 190; // units a second along the row
const UP = 300; // units a second up the aisle

// standing / leaving person seen from behind; u: time since they got up
function leaver(ctx, x, yHead, s, h, u, o) {
  const rise = ease.inOut(clamp(u / RISE));
  const walkK = smooth(u, RISE - 0.1, RISE + 0.3);
  const bob = walkK * Math.abs(Math.sin(u * 6.5)) * 4;
  const y = yHead - 92 * rise * s - bob * s;
  const tilt = (o.dir ?? 0) * 0.08 * walkK + 0.04 * rise;
  const a = o.alpha ?? 1;
  // body below the shoulders (the rows in front hide the legs)
  const sw = (40 + h * 10) * s;
  const sy = y + 34 * s;
  fillPoly(ctx, [[x - sw, sy + 60 * s], [x + sw, sy + 60 * s], [x + sw * 0.82, sy + 200 * s], [x - sw * 0.82, sy + 200 * s]], DARK, a);
  person(ctx, x, y, s, { h, tilt, alpha: a, rimList: o.rimList, rim: o.rim });
}


// Batched drawing: every seat back of a row in one path, every seated person
// in another (the same shapes as theatre.js person(), much cheaper).
function addPoly(P, pts) {
  // keep every subpath wound the same way so overlaps don't cut holes
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[(i + 1) % pts.length];
    a += x0 * y1 - x1 * y0;
  }
  const n = pts.length;
  const at = (i) => pts[a < 0 ? n - 1 - i : i];
  P.moveTo(at(0)[0], at(0)[1]);
  for (let i = 1; i < n; i++) P.lineTo(at(i)[0], at(i)[1]);
  P.closePath();
}
function addSeat(P, x, y, s) {
  const w = 34 * s;
  const top = y + 38 * s;
  addPoly(P, [[x - w, top + 6 * s], [x - w + 6 * s, top], [x + w - 6 * s, top], [x + w, top + 6 * s], [x + w, top + 60 * s], [x - w, top + 60 * s]]);
}
function addPerson(P, x, y, s, h, tilt, rimList, rim) {
  const r = (19 + h * 4) * s;
  const hx = x + Math.sin(tilt) * 26 * s;
  const hy = y;
  const sw = (40 + h * 10) * s;
  const sy = y + 34 * s;
  addPoly(P, [
    [x - sw, sy + 70 * s], [x - sw, sy + 14 * s], [x - sw + 8 * s, sy + 2 * s], [x - 12 * s, sy - 6 * s],
    [x + 12 * s, sy - 6 * s], [x + sw - 8 * s, sy + 2 * s], [x + sw, sy + 14 * s], [x + sw, sy + 70 * s],
  ]);
  addPoly(P, [[hx - 8 * s, hy + r * 0.6], [hx + 8 * s, hy + r * 0.6], [x + 10 * s, sy], [x - 10 * s, sy]]);
  addPoly(P, ellipsePts(hx, hy, r * 0.95, r, 0, TAU, 20).slice(0, 20));
  const kind = Math.floor(h * 5);
  if (kind === 1) addPoly(P, ellipsePts(hx + Math.sin(tilt) * r * 0.4, hy - r * 0.95, r * 0.42, r * 0.36, 0, TAU, 12).slice(0, 12));
  else if (kind === 2) addPoly(P, [[hx - r * 0.95, hy], [hx + r * 0.95, hy], [hx + r * 1.02, hy + r * 1.5], [hx - r * 1.02, hy + r * 1.5]]);
  else if (kind === 3) addPoly(P, [[hx - r * 1.0, hy - r * 0.15], [hx + r * 1.0, hy - r * 0.15], [hx + r * 0.9, hy - r * 0.35], [hx - r * 0.9, hy - r * 0.35]]);
  if (s > 0.18) {
    const fine = clamp(1.25 - 0.33 * s, 0.22, 1);
    rimList.push({ pts: ellipsePts(hx, hy, r * 0.95, r, Math.PI * 1.15, Math.PI * 1.85, 10), w: Math.min(2.6, Math.max(1, 2.2 * s)), a: fine * rim });
    if (s < 1.3) {
      rimList.push({ pts: [[x - sw + 6 * s, sy + 4 * s], [x - 14 * s, sy - 4 * s]], w: Math.max(1, 1.4 * s), a: 0.3 * rim });
      rimList.push({ pts: [[x + 14 * s, sy - 4 * s], [x + sw - 6 * s, sy + 4 * s]], w: Math.max(1, 1.4 * s), a: 0.3 * rim });
    }
  }
}

// people walking up the centre aisle toward the camera: [{Z, h, u, id}]
function aisleWalkers(t) {
  const out = [];
  for (const [rk, si, tt, dir] of LAST) {
    if (dir !== 0) continue;
    const row = ROWS[rk];
    const seat = row.seats[si];
    const u = t - tt;
    const along = Math.abs(TH.cx - seat.X);
    const tA = RISE + along / SIDLE; // reaches the aisle
    if (u < tA) continue;
    out.push({ Z: row.Z - (u - tA) * UP, h: seat.h, u, id: seat.id });
  }
  return out;
}

// The auditorium (screen space, current transform). o: {rim, seatRim, pad}
function hall(ctx, cam, t, o = {}) {
  const rimList = [];
  const pad = o.pad ?? 0;
  hallWalls(ctx, cam);
  const walkers = aisleWalkers(t);
  for (const row of ROWS) {
    const d = row.Z + cam.C;
    if (d < 160) continue;
    const s = F / d;
    if (s < 0.05) continue;
    const yHead = H / 2 + s * (row.head - cam.y);
    if (yHead - 220 * s > H + 40 + pad) continue;
    const standing = [];
    const seatsP = new Path2D();
    const peopleP = new Path2D();
    for (const seat of row.seats) {
      const x = W / 2 + s * (seat.X - cam.x);
      const lv = seatLeave(seat, row);
      const u = t - lv.t;
      const off = x < -150 * s - pad || x > W + 150 * s + pad;
      // off screen: only someone walking along the row might come into view
      if (off && (u < 0 || u > 3.4 || Math.abs(x - W / 2) > W * 1.2 + pad)) continue;
      addSeat(seatsP, x, yHead, s);
      if (o.seatRim) {
        const w = 34 * s;
        const top = yHead + 38 * s;
        rimList.push({ pts: [[x - w, top + 7 * s], [x - w + 6 * s, top], [x + w - 6 * s, top], [x + w, top + 7 * s]], w: Math.max(1, 1.4 * Math.min(s, 2)), a: o.seatRim * 0.55 * clamp(1.5 - 0.22 * s, 0.35, 1) });
      }
      if (u < 0) {
        const tilt = (seat.h - 0.5) * 0.12 + noise1(t * 0.25 + seat.h * 9, seat.id) * 0.03;
        addPerson(peopleP, x, yHead, s, seat.h, tilt, rimList, o.rim ?? 1);
      } else if (u < 3.4) {
        // up, then along the row toward its end (or the centre aisle)
        const dist = Math.max(0, u - RISE + 0.05) * SIDLE;
        let X;
        let alpha = 1;
        if (lv.dir === 0) {
          const dx = TH.cx - seat.X;
          if (Math.abs(dx) <= dist) continue; // in the aisle now
          X = seat.X + Math.sign(dx) * dist;
        } else {
          X = seat.X + lv.dir * dist;
          const fd = lv.fade ?? [2.4, 3.4];
          alpha = 1 - smooth(u, fd[0], fd[1]);
        }
        standing.push([X, seat.h, u, alpha, lv.dir]);
      }
    }
    ctx.fillStyle = '#24211e';
    ctx.fill(seatsP);
    ctx.fillStyle = DARK;
    ctx.fill(peopleP);
    for (const [X, h, u, alpha, dir] of standing) {
      leaver(ctx, W / 2 + s * (X - cam.x), yHead, s, h, u, { alpha, rimList, rim: o.rim ?? 1, dir });
    }
    // anyone walking up the centre aisle between this row and the next one
    for (const w of walkers) {
      if (!(w.Z <= row.Z && w.Z > row.Z - 150)) continue;
      const dw = w.Z + cam.C;
      if (dw < 120) continue;
      const sw = F / dw;
      const kf = (-w.Z - 240) / 150;
      const head = 748 - 13.5 * kf;
      leaver(ctx, W / 2 + sw * (TH.cx - cam.x), H / 2 + sw * (head - cam.y), sw, w.h, w.u, { rimList, rim: o.rim ?? 1, dir: 0 });
    }
  }
  return rimList;
}

function hallWalls(ctx, cam) {
  for (const side of [-1, 1]) {
    const X = TH.cx + side * 1480;
    const a = project(cam, X, 770, -200);
    const b = project(cam, X, 770 - 13.5 * 30, -4600);
    const c = project(cam, X, 0, -200);
    const d = project(cam, X, -300, -4600);
    if (a[3] > 0 && b[3] > 0) {
      path(ctx, [[a[0], a[1]], [b[0], b[1]]], { w: 2, color: 'rgba(90,82,72,0.6)', seed: 12500 + (side > 0 ? 1 : 0), wobble: 0.3 });
      path(ctx, [[c[0], c[1]], [d[0], d[1]]], { w: 2, color: 'rgba(90,82,72,0.6)', seed: 12502 + (side > 0 ? 1 : 0), wobble: 0.3 });
    }
    for (let i = 0; i < 6; i++) {
      const Z = -500 - i * 700;
      const p = project(cam, TH.cx + side * 1470, 360 - i * 60, Z);
      if (p[3] < 80) continue;
      const s = p[2];
      fillPoly(ctx, [[p[0] - 14 * s, p[1] + 10 * s], [p[0] + 14 * s, p[1] + 10 * s], [p[0] + 8 * s, p[1] - 10 * s], [p[0] - 8 * s, p[1] - 10 * s]], '#8a8070', 1);
      fillPoly(ctx, [[p[0] - 2 * s, p[1] + 10 * s], [p[0] + 2 * s, p[1] + 10 * s], [p[0] + 2 * s, p[1] + 40 * s], [p[0] - 2 * s, p[1] + 40 * s]], '#3a3530', 1);
    }
  }
}
function sconceLights(cam, k) {
  const out = [];
  if (k <= 0.01) return out;
  for (const side of [-1, 1]) {
    for (let i = 0; i < 6; i++) {
      const p = project(cam, TH.cx + side * 1470, 360 - i * 60, -500 - i * 700);
      if (p[3] < 80) continue;
      const r = 46 * p[2];
      if (p[0] + r < 0 || p[0] - r > W || p[1] + r < 0 || p[1] - r > H) continue;
      out.push({ type: 'glow', x: p[0], y: p[1], r, k: 0.5 * k });
    }
  }
  return out;
}

// rim light strokes, under the current transform (after stage()); strokes
// of about the same width and strength go out in one path
function rimsHere(ctx, list, k) {
  if (k <= 0.01) return;
  const groups = new Map();
  for (const r of list) {
    const a = clamp(r.a * k * 0.55);
    if (a < 0.01) continue;
    const key = Math.round(a * 20) * 100 + Math.round(r.w * 2);
    let g = groups.get(key);
    if (!g) groups.set(key, (g = { a: Math.round(a * 20) / 20, w: Math.round(r.w * 2) / 2, p: new Path2D() }));
    g.p.moveTo(r.pts[0][0], r.pts[0][1]);
    for (let i = 1; i < r.pts.length; i++) g.p.lineTo(r.pts[i][0], r.pts[i][1]);
  }
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#efe7d6';
  for (const g of groups.values()) {
    ctx.globalAlpha = g.a;
    ctx.lineWidth = g.w;
    ctx.stroke(g.p);
  }
  ctx.restore();
}
// Big soft radial gradients are slow to fill in software. They are drawn
// from small cached sprites scaled up without smoothing: neighbouring
// texels differ by far less than one grey level, so nothing shows.
const SPRITES = {};
function sprite(name, rgb, stops) {
  if (SPRITES[name]) return SPRITES[name];
  const N = 512;
  const c = document.createElement('canvas');
  c.width = N;
  c.height = N;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(N / 2, N / 2, 0, N / 2, N / 2, N / 2);
  for (const [u, a] of stops) gr.addColorStop(u, `rgba(${rgb},${a})`);
  g.fillStyle = gr;
  g.fillRect(0, 0, N, N);
  SPRITES[name] = c;
  return c;
}
const glowSprite = () => sprite('glow', '0,0,0', [[0, 1], [0.5, 0.7], [1, 0]]);
const hazeSprite = () => sprite('haze', '226,219,204', [[0, 0.42], [0.45, 0.2], [1, 0]]);
const flashSprite = () => sprite('flash', '255,250,236', [[0, 1], [1, 0]]);
function drawSprite(ctx, spr, x, y, r, alpha, comp = 'source-over') {
  if (alpha <= 0.002 || r <= 0) return;
  ctx.save();
  ctx.globalAlpha = Math.min(1, alpha);
  ctx.globalCompositeOperation = comp;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(spr, x - r, y - r, 2 * r, 2 * r);
  ctx.restore();
}

// the stage glow in the air of the hall (current transform)
function hazeHere(ctx, cam, k) {
  if (k <= 0.01) return;
  const p = project(cam, TH.cx, FL - 140, 0);
  drawSprite(ctx, hazeSprite(), p[0], p[1], 1250 * p[2], k);
}

// light.js stage(), with 'glow' lights drawn from the sprite (same lights,
// same look, much cheaper)
let SHADE = null;
function stageFast(ctx, lights, o = {}) {
  if (!SHADE) {
    SHADE = document.createElement('canvas');
    SHADE.width = W;
    SHADE.height = H;
  }
  const s = SHADE.getContext('2d');
  const m = ctx.getTransform();
  s.setTransform(1, 0, 0, 1, 0, 0);
  s.globalCompositeOperation = 'source-over';
  s.globalAlpha = 1;
  s.clearRect(0, 0, W, H);
  s.fillStyle = `rgba(14,13,12,${o.dark ?? 0.66})`;
  s.fillRect(0, 0, W, H);
  s.setTransform(m);
  s.globalCompositeOperation = 'destination-out';
  for (const L of lights) {
    const k = L.k ?? 1;
    if (k <= 0.001) continue;
    if (L.type === 'spot') {
      const g = s.createLinearGradient(0, L.sy, 0, L.fy);
      g.addColorStop(0, `rgba(0,0,0,${0.25 * k})`);
      g.addColorStop(0.55, `rgba(0,0,0,${0.55 * k})`);
      g.addColorStop(1, `rgba(0,0,0,${0.92 * k})`);
      s.fillStyle = g;
      s.beginPath();
      s.moveTo(L.sx - L.rx * 0.12, L.sy);
      s.lineTo(L.sx + L.rx * 0.12, L.sy);
      s.lineTo(L.fx + L.rx * 0.98, L.fy);
      s.lineTo(L.fx - L.rx * 0.98, L.fy);
      s.closePath();
      s.fill();
      poolOut(s, L.fx, L.fy, L.rx, L.ry, k);
    } else if (L.type === 'glow') {
      drawSprite(s, glowSprite(), L.x, L.y, L.r, k, 'destination-out');
    } else if (L.type === 'pool') {
      poolOut(s, L.x, L.y, L.rx, L.ry, k);
    } else if (L.type === 'poly') {
      s.fillStyle = `rgba(0,0,0,${k})`;
      s.beginPath();
      s.moveTo(L.pts[0][0], L.pts[0][1]);
      for (let i = 1; i < L.pts.length; i++) s.lineTo(L.pts[i][0], L.pts[i][1]);
      s.closePath();
      s.fill();
    }
  }
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(SHADE, 0, 0);
  ctx.restore();
  const beams = o.beams ?? 1;
  if (beams > 0) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const L of lights) {
      const k = (L.k ?? 1) * beams;
      if (L.type !== 'spot' || k <= 0.001) continue;
      const g = ctx.createLinearGradient(0, L.sy, 0, L.fy);
      g.addColorStop(0, `rgba(255,250,235,${0.07 * k})`);
      g.addColorStop(1, `rgba(255,250,235,${0.02 * k})`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(L.sx - L.rx * 0.12, L.sy);
      ctx.lineTo(L.sx + L.rx * 0.12, L.sy);
      ctx.lineTo(L.fx + L.rx * 0.98, L.fy);
      ctx.lineTo(L.fx - L.rx * 0.98, L.fy);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }
}
function poolOut(s, x, y, rx, ry, k) {
  s.save();
  s.translate(x, y);
  s.scale(1, ry / rx);
  const g = s.createRadialGradient(0, 0, 0, 0, 0, rx);
  g.addColorStop(0, `rgba(0,0,0,${k})`);
  g.addColorStop(0.75, `rgba(0,0,0,${0.9 * k})`);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  s.fillStyle = g;
  s.beginPath();
  s.arc(0, 0, rx, 0, TAU);
  s.fill();
  s.restore();
}

// dust in a beam (screen space beam, current transform)
function dustHere(ctx, beam, t, k, n = 50, seed = 0) {
  if (k <= 0.01) return;
  ctx.save();
  ctx.fillStyle = '#fffaf0';
  for (let i = 0; i < n; i++) {
    const j = i + seed * 100;
    const u = (hash(j * 7.1) + t * (0.02 + hash(j * 3.3) * 0.03)) % 1;
    const v = hash(j * 11.7) * 2 - 1 + noise1(t * 0.3 + j, j) * 0.15;
    const y = lerp(beam.sy, beam.fy, u);
    const half = lerp(beam.rx * 0.12, beam.rx * 0.98, u);
    const x = lerp(beam.sx, beam.fx, u) + v * half;
    const tw = 0.5 + 0.5 * Math.sin(t * (1 + hash(j) * 2) + j);
    ctx.globalAlpha = k * (0.15 + 0.35 * tw) * Math.sin(Math.PI * u);
    ctx.beginPath();
    ctx.arc(x, y, (0.8 + hash(j * 5) * 1.6) * (beam.ds ?? 1), 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}
// extra whiteness for the bright lights (additive, after stage())
function whiten(ctx, L, k) {
  if (k <= 0.01) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createLinearGradient(0, L.sy, 0, L.fy);
  g.addColorStop(0, `rgba(255,252,242,${0.16 * k})`);
  g.addColorStop(1, `rgba(255,252,242,${0.07 * k})`);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(L.sx - L.rx * 0.12, L.sy);
  ctx.lineTo(L.sx + L.rx * 0.12, L.sy);
  ctx.lineTo(L.fx + L.rx * 0.98, L.fy);
  ctx.lineTo(L.fx - L.rx * 0.98, L.fy);
  ctx.closePath();
  ctx.fill();
  // the pool glares, and a halo round it
  ctx.translate(L.fx, L.fy);
  ctx.scale(1, L.ry / L.rx);
  const p = ctx.createRadialGradient(0, 0, 0, 0, 0, L.rx * 1.6);
  p.addColorStop(0, `rgba(255,252,242,${0.3 * k})`);
  p.addColorStop(0.55, `rgba(255,252,242,${0.18 * k})`);
  p.addColorStop(1, 'rgba(255,252,242,0)');
  ctx.fillStyle = p;
  ctx.beginPath();
  ctx.arc(0, 0, L.rx * 1.6, 0, TAU);
  ctx.fill();
  ctx.restore();
}

// ------------------------------------------------------------- frame: theatre
function drawTheatre(ctx, t, cam, o = {}) {
  hallDark(ctx);
  const h = him(t);
  const sl = o.lights ?? stageLights(t);
  camera(ctx, stageCam(cam), () => {
    stagePlane(ctx, t);
    if (o.him !== false) figure(ctx, h.p, { id: 1, cowlick: true, mouth: h.mouth, eye: h.eye });
  });
  const lights = [];
  let glare = 0;
  for (const L of sl) {
    if (L.type === 'pool') {
      const q = project(cam, L.x, L.y, 0);
      lights.push({ type: 'pool', x: q[0], y: q[1], rx: L.rx * q[2], ry: L.ry * q[2], k: L.k, id: L.id, white: 0 });
      glare += L.k * 0.3;
      continue;
    }
    const sp = spotOnScreen(cam, L, L.k);
    sp.white = L.white;
    sp.id = L.id;
    lights.push(sp);
    glare += L.k * (0.5 + L.white);
  }
  const wash = o.wash ?? clamp(0.25 + 0.35 * glare, 0, 0.9);
  hazeHere(ctx, cam, o.haze ?? clamp(0.15 + 0.3 * glare, 0, 0.8));
  const rimList = hall(ctx, cam, t, { rim: 1, seatRim: o.seatRim ?? 0, pad: o.pad ?? 0 });
  const all = [...lights, stageWash(cam, wash), ...sconceLights(cam, o.sconces ?? 0)];
  if (o.extra) all.push(...o.extra);
  stageFast(ctx, all, { dark: o.dark ?? 0.88, beams: 1 });
  for (const L of lights) if (L.white && L.type === 'spot') whiten(ctx, L, L.k * L.white);
  rimsHere(ctx, rimList, (o.rimK ?? clamp(0.3 + 0.5 * glare, 0, 1)) * (o.rimMul ?? 1));
  for (const L of lights) {
    if (L.k < 0.2 || L.type !== 'spot') continue;
    dustHere(ctx, { sx: L.sx, sy: L.sy, fx: L.fx, fy: L.fy, rx: L.rx, ds: Math.min(3, Math.max(0.6, 1000 / cam.C)) }, t, 0.8 * L.k, L.white ? 60 : 30, L.id.length + (L.id.charCodeAt(1) || 0));
  }
  return lights;
}

// ------------------------------------------------------------- frame: from above
// floor coordinates: X across the stage (as on stage), Y toward the hall
// (the stage front edge is Y = 0, up-stage is negative)
function topXY(x, y) {
  const ds = depthS(y);
  return [TH.cx + (x - TH.cx) / ds, -(1 / ds - 1) * 1440];
}
// lights that blink on and off far away in the dark: [x, y (floor), r, on, off]
const BLINKS = [
  [180, -520, 150, 17.85, 18.75],
  [1700, -150, 130, 18.2, 18.95],
  [380, 420, 140, 18.55, 19.3],
  [1620, -900, 150, 18.9, 19.65],
  [-420, -60, 160, 19.2, 19.95],
  [2300, -480, 150, 19.5, 20.3],
  [880, -1350, 170, 19.75, 20.4],
  [2100, 650, 150, 19.95, 20.4],
];
const blinkK = (t, on, off) => Math.min(smooth(t, on, on + 0.1), 1 - smooth(t, off - 0.35, off));

function drawTop(ctx, t) {
  const cam = topCamAt(t);
  hallDark(ctx);
  const [hx, hy] = topXY(...P_LOST);
  const ox = W / 2;
  const oy = H / 2 + 60;
  const c = Math.cos(cam.r);
  const sn = Math.sin(cam.r);
  // floor (X, Y) → screen
  const toS = (X, Y) => {
    const dx = X - hx;
    const dy = Y - hy;
    return [ox + cam.z * (c * dx - sn * dy), oy + cam.z * cam.e * (sn * dx + c * dy)];
  };
  // the floor: boards, as far as the dark goes (plain lines: cheap), smeared
  // while it turns fast
  ctx.save();
  ctx.translate(ox, oy);
  ctx.scale(cam.z, cam.z * cam.e);
  ctx.fillStyle = '#d9d1c2';
  ctx.fillRect(-4000, -4000, 8000, 8000);
  const nS = Math.max(1, Math.min(5, Math.ceil((cam.w / 30) * 1400 * cam.z / 10)));
  const R = Math.min(3400, Math.hypot(W, H / cam.e) / (2 * cam.z) + 150);
  for (let i = 0; i < nS; i++) {
    ctx.save();
    ctx.rotate(cam.r + (nS > 1 ? (i / (nS - 1) - 0.5) * cam.w / 30 : 0));
    ctx.translate(-hx, -hy);
    floorBoards(ctx, hx, hy, cam.z, nS > 1 ? 1.6 / nS : 1, R);
    ctx.restore();
  }
  ctx.restore();
  // him, upright, seen from above and in front
  const a = spinAngle(t) - cam.r; // his facing relative to the camera
  const p = viewFor(a, t);
  const s = 0.95 * cam.z;
  const q = pose({ ...p, x: ox, s });
  lostEnd(q, t);
  q.y = oy - footDrop(q, s) * 0.92;
  figure(ctx, q, { id: 1, cowlick: true, mouth: -0.3 });
  // the lights: a shaft standing on each pool
  const lights = [];
  const spot = (X, Y, r, k, own) => {
    const [px, py] = toS(X, Y);
    const rx = r * cam.z;
    // a shaft standing in front of him would cross him: it fades, its pool stays
    const clear = own || py < oy ? 1 : clamp((Math.abs(px - ox) - rx * 0.3) / (rx * 1.2 + 40));
    const L = { type: 'spot', sx: px, sy: py - 1500 * cam.z, fx: px, fy: py, rx, ry: rx * cam.e, k: k * clear };
    if (clear < 1) L.pool = { type: 'pool', x: px, y: py, rx, ry: rx * cam.e, k: k * (1 - clear) };
    return L;
  };
  const kHim = 0.7 - 0.2 * smooth(t, 19.4, 20.3);
  lights.push(spot(hx, hy, 105, kHim, true));
  lights.push({ type: 'glow', x: ox, y: oy - 120 * s, r: 260 * s, k: 0.35 });
  lights.push({ type: 'glow', x: ox, y: oy, r: 900 * cam.z, k: 0.2 });
  const shafts = [];
  for (const [bx, by, r, on, off] of BLINKS) {
    const k = blinkK(t, on, off);
    if (k <= 0.01) continue;
    const L = spot(bx, by, r, 0.95 * k);
    lights.push(L);
    if (L.pool) lights.push(L.pool);
    shafts.push(L);
  }
  stageFast(ctx, lights, { dark: 0.93, beams: 1 });
  for (const L of shafts) whiten(ctx, L, L.k * 0.8);
}

// the end of the spin: arms drop, head goes down
function lostEnd(p, t) {
  const k = smooth(t, SPIN[1] - 0.25, SPIN[1] + 0.6);
  if (k <= 0) return;
  p.head = lerp(p.head, 0.38, k);
  p.look = lerp(p.look, 0.9, k);
  p.aA1 = lerp(p.aA1, 0.12, k);
  p.aB1 = lerp(p.aB1, p.view === 'side' ? -0.06 : 0.12, k);
  p.aA2 = lerp(p.aA2, 0.1, k);
  p.aB2 = lerp(p.aB2, 0.1, k);
}

// the stage boards around (hx, hy), plain lines (cheap); a: alpha
function floorBoards(ctx, hx, hy, z, a, R) {
  ctx.strokeStyle = `rgba(31,28,25,${0.32 * a})`;
  ctx.lineWidth = 1.6 / z;
  ctx.beginPath();
  const x0 = Math.floor((hx - R) / 64) * 64;
  for (let x = x0; x < hx + R; x += 64) {
    ctx.moveTo(x, hy - R);
    ctx.lineTo(x, hy + R);
  }
  for (let y = Math.floor((hy - R) / 230) * 230; y < hy + R; y += 230) {
    const odd = Math.abs(Math.round(y / 230)) % 2;
    for (let x = x0; x < hx + R; x += 128) {
      const xx = x + (odd ? 64 : 0);
      ctx.moveTo(xx, y);
      ctx.lineTo(xx + 64, y);
    }
  }
  ctx.stroke();
}

// a pose for him turned by angle a relative to the camera (0 = facing us)
function viewFor(a, t) {
  const c = Math.cos(a);
  const sn = Math.sin(a);
  const arms = 0.32 + 0.22 * Math.sin(t * 7);
  const base = { lA1: 0.07, lA2: 0, lB1: 0.07, lB2: 0, aA1: arms, aA2: 0.25, aB1: arms, aB2: 0.25, look: -0.4, head: -0.06 };
  const stepL = Math.max(0, Math.sin(a * 2)) * 0.22;
  if (Math.abs(c) >= Math.abs(sn)) {
    const view = c > 0 ? 'front' : 'back';
    return { ...base, view, turn: view === 'front' ? sn : -sn, lA1: 0.08 + stepL * 0.6, head: view === 'back' ? 0.05 : -0.06 };
  }
  return { ...base, view: 'side', f: sn > 0 ? 1 : -1, turn: clamp(c), lA1: 0.12 + stepL, lB1: -0.1, aA1: arms, aB1: -arms * 0.8, aA2: 0.3, aB2: 0.3 };
}

// ------------------------------------------------------------- frame
// the jolt of a bang (screen px), the flash of a bang
function joltAt(t) {
  let jx = 0;
  let jy = 0;
  for (const [b, , js] of BANGS) {
    if (t < b || t > b + 0.5) continue;
    const j = Math.exp(-(t - b) / 0.09) * js;
    jx += noise1(t * 60, 1 + b) * 14 * j;
    jy += noise1(t * 60, 2 + b) * 10 * j;
  }
  return [jx, jy];
}

function flashes(ctx, t, cam, top) {
  for (const [b, id, , fs] of BANGS) {
    if (t < b || t > b + 0.6) continue;
    const f = Math.exp(-(t - b) / 0.07) * (fs / 0.6);
    const big = id === 'big';
    const [x, y] = BANG_POS(id);
    const p = top ? [W / 2, H / 2] : project(cam, x, y - 80, 0);
    drawSprite(ctx, flashSprite(), p[0], p[1], big ? 1300 : 900, (big ? 0.85 / 1.42 : 0.6) * f, 'lighter');
    if (big) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = `rgba(255,250,236,${0.22 * f})`;
      ctx.fillRect(-W, -H, W * 3, H * 3);
      ctx.restore();
    }
  }
}

function camStateAt(t) {
  if (t < TOP[0]) return { kind: 'stage', cam: stageCamAt(t) };
  if (t < HALL) return { kind: 'top', cam: topCamAt(t) };
  return { kind: 'hall', cam: hallCamAt(t) };
}

function render(ctx, t) {
  const st = camStateAt(t);
  const [jx, jy] = joltAt(t);
  ctx.save();
  ctx.translate(jx, jy);
  if (st.kind === 'top') {
    drawTop(ctx, t);
  } else {
    const cam = st.cam;
    // the roll turns the whole picture about the centre (zoomed a little so
    // the corners stay covered)
    const r = cam.r ?? 0;
    if (r) {
      const z = 1 + 0.25 * clamp(Math.abs(Math.sin(r)) * 2.5);
      ctx.translate(W / 2, H / 2);
      ctx.rotate(r);
      ctx.scale(z, z);
      ctx.translate(-W / 2, -H / 2);
    }
    if (st.kind === 'stage') {
      // out of the black: the stage comes up with his light
      const up = smooth(t, 0.1, 0.9);
      drawTheatre(ctx, t, cam, { dark: lerp(1, 0.88, up), wash: up < 1 ? 0.45 * up : undefined, haze: up < 1 ? 0.35 * up : undefined, rimMul: up, pad: r ? 500 : 0 });
    } else {
      // the hall: house lights low, his last dim light, the last people go
      const end = smooth(t, 23.3, 23.95);
      const hallLights = [{ id: 'own', sx: P_LOST[0] - 40, sy: -420, fx: P_LOST[0], fy: P_LOST[1], rx: 40, ry: 9, k: 0.85 * (1 - end), white: 0 }];
      const house = [{ type: 'glow', x: W / 2, y: H * 0.78, r: 1250, k: 0.2 * (1 - end) }];
      drawTheatre(ctx, t, cam, { lights: hallLights, wash: 0.3 * (1 - end), haze: 0.55 * (1 - end), sconces: 1.2 * (1 - end), seatRim: 0.8 * (1 - end), rimK: 0.9 * (1 - end), dark: 0.88, extra: house });
    }
    flashes(ctx, t, cam, false);
  }
  ctx.restore();
}

// ------------------------------------------------------------- motion smear
// The whips (and the spin) smear the whole frame: the picture is drawn once
// and laid down several times along the camera's motion.
const WHIPS = [[5.1, 5.52], [6.6, 6.97], [12.98, 13.32], [13.38, 13.5], [13.7, 13.82], [14.72, 14.84], [15.78, 15.9], [16.05, 16.17]];
let BUF = null;
function camVel(t) {
  const dt = 1 / 60;
  const a = camStateAt(t - dt);
  const b = camStateAt(t + dt);
  if (a.kind !== b.kind || a.kind !== 'stage') return null;
  const whip = WHIPS.some(([w0, w1]) => t > w0 && t < w1);
  const s = F / a.cam.C;
  return {
    vx: whip ? (-(b.cam.x - a.cam.x) * s) / (2 * dt) : 0,
    vy: whip ? (-(b.cam.y - a.cam.y) * s) / (2 * dt) : 0,
    w: t > SPIN[0] - 0.5 ? ((b.cam.r ?? 0) - (a.cam.r ?? 0)) / (2 * dt) : 0,
  };
}

// Motion smear by recursive doubling: each pass averages the picture with
// itself shifted (and turned) by half the previous step, so k passes lay
// down 2^k evenly spaced copies with only 2k blits.
let BUF2 = null;
function canvasBuf() {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  return c;
}
function smearPass(dst, src, dx, dy, da, last) {
  const g = dst.getContext ? dst.getContext('2d') : dst;
  g.save();
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalCompositeOperation = 'source-over';
  if (!last) {
    g.globalAlpha = 1;
    g.fillStyle = '#1d1b19';
    g.fillRect(0, 0, W, H);
  }
  g.imageSmoothingEnabled = !!da;
  for (const [sgn, alpha] of [[-1, 1], [1, 0.5]]) {
    g.globalAlpha = alpha;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.translate(W / 2 + Math.round((sgn * dx) / 2), H / 2 + Math.round((sgn * dy) / 2));
    if (da) {
      g.rotate((sgn * da) / 2);
      const zc = 1 + Math.abs(da) * 0.6;
      g.scale(zc, zc);
    }
    g.translate(-W / 2, -H / 2);
    g.drawImage(src, 0, 0);
  }
  g.restore();
}

export default {
  fadeIn: 0,
  draw(ctx, lt) {
    const t = clamp(lt, 0, S_END);
    const v = camVel(t);
    // shutter: one frame at 30 fps
    const sh = 1 / 30;
    const L = v ? Math.hypot(v.vx, v.vy) * sh : 0;
    const A = v ? Math.abs(v.w) * sh * 700 : 0;
    const span = Math.max(L, A);
    if (span < 12) {
      render(ctx, t);
      return;
    }
    if (!BUF) BUF = canvasBuf();
    if (!BUF2) BUF2 = canvasBuf();
    const b = BUF.getContext('2d');
    b.setTransform(1, 0, 0, 1, 0, 0);
    b.globalAlpha = 1;
    b.globalCompositeOperation = 'source-over';
    b.fillStyle = '#1d1b19';
    b.fillRect(0, 0, W, H);
    render(b, t);
    // passes: copies spaced about 4 px apart, at most 32 of them
    const passes = Math.max(2, Math.min(5, Math.ceil(Math.log2(span / 4))));
    let src = BUF;
    let dst = BUF2;
    let dx = v.vx * sh;
    let dy = v.vy * sh;
    let da = v.w * sh;
    for (let i = 0; i < passes; i++) {
      dx /= 2;
      dy /= 2;
      da /= 2;
      const last = i === passes - 1;
      if (last) {
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = '#1d1b19';
        ctx.fillRect(0, 0, W, H);
        ctx.restore();
      }
      smearPass(last ? ctx : dst, src, dx, dy, da, last);
      [src, dst] = [dst, src];
    }
  },
};
