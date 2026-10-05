// s12 — 山与天之间，或许曾悬着一根极细的弦。后来弦断了，山塌成谷，天裂成霞。
//       人人都说天地无情，那根弦却从未真正消失，它化成了你抬头望见的那片云，
//       和我低头淋到的那场雨。
//
// A wide, empty landscape is drawn in: a mountain on the right, a small star
// high on the left, and between them one very thin gold string, trembling.
// It snaps; the peak sinks into a valley and the sky cracks open into bands of
// evening glow. Stillness. Then the two broken ends lift and drift; two frames
// are drawn around what is left (hers: a piece of the sky; his: the valley)
// and the two of them are standing in them. One end curls into a gold cloud
// over her — she looks up. The other becomes a rain cloud over him — he lowers
// his head in the rain.
//
// s13 continues from this exact end state and imports the helpers exported
// below. Everything that keeps moving at the cut (cloud bob, ponytail, rain)
// runs on global time so the hard cut between the two scenes is invisible.
import { W, H, COL, TAU, lerp, clamp, prog, smooth, ease, hash, noise1, path, line, ellipsePts, dot, hatch, fillPoly, camera } from '../lib.js';
import { figure, pose, mixPose, standY } from '../figure.js';

// ------------------------------------------------------------------ layout
export const GROUND = 830;
export const FIG_S = 1.08;
export const LAY = {
  ground: GROUND,
  s: FIG_S,
  herF: { x: 260, y: 330, w: 400, h: 500 },
  himF: { x: 1260, y: 330, w: 400, h: 500 },
  herX: 452,
  himX: 1468,
  herCloud: { x: 470, y: 392, w: 196 },
  himCloud: { x: 1462, y: 424, w: 224 },
};
export const S12_DUR = 16.75;

const STAR = [462, 208];
const PEAK_X = 1460;
const N = 56; // points per thread / cloud outline

// local scene times (scene starts at 92.65; word onsets from the voice track)
const T = {
  ridge0: 0.02, // 山 (92.95)
  ridge1: 1.0,
  star: 0.55, // 天 (93.25)
  str0: 1.6, // 或许曾悬着一根极细的弦 (94.2 .. 95.9)
  str1: 2.95,
  snap: 4.5, // 弦断了 (断 97.15)
  fall0: 5.3, // 山塌成谷 (97.95 .. 98.6)
  fall1: 6.05,
  crack: 6.42, // 天裂成霞 (99.1 .. 99.7)
  lift: 9.85, // 那根弦却从未真正消失 (102.45 ..)
  frame0: 10.3,
  frame1: 11.4,
  fade0: 9.95,
  fade1: 11.45,
  fig0: 10.95,
  fig1: 11.9,
  herCoil0: 12.2, // 它化成了你抬头望见的那片云 (104.9 .. 106.85)
  herCoil1: 13.75,
  herLook0: 12.95, // 抬头 (105.75)
  herLook1: 13.5,
  himCoil0: 13.85, // 和我低头淋到的那场雨 (107.5 .. 109.0)
  himCoil1: 14.85,
  rain: 14.85,
  himDown0: 15.15, // 低头 (107.9)
  himDown1: 15.8,
};

// ------------------------------------------------------------------ helpers
const bump = (d, w) => Math.exp(-(d / w) * (d / w));
const dist = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);

// ground profile: a mountain at PEAK_X that collapses (k: 0..1) into a valley
function ridgeY(x, k) {
  const dx = x - PEAK_X;
  const a = Math.abs(dx);
  const q = a / 440;
  let m = 760 - 355 * Math.pow(Math.max(0, 1 - q), 1.35);
  m -= 52 * bump(dx + 250, 105) + 30 * bump(dx - 235, 95);
  let v;
  if (a < 300) v = 796 - 196 * Math.pow(a / 300, 1.1);
  else v = 600 + 160 * smooth(a, 300, 560, ease.sine);
  const far = 14 * noise1(x / 160, 41); // gentle roll of the plain
  const n = 6 * noise1(x / 64, 3) + 2.5 * noise1(x / 21, 5);
  return lerp(m, v, k) + n + far * smooth(a, 380, 640);
}

function collapseK(t) {
  const p = prog(t, T.fall0, T.fall1);
  return p * p * (1.6 - 0.6 * p); // accelerates, then settles
}

function ridgeLine(k) {
  const pts = [];
  for (let x = -40; x <= W + 40; x += 14) pts.push([x, ridgeY(x, k)]);
  return pts;
}

const FAR = (() => {
  const far = [];
  for (let x = -40; x <= W + 40; x += 16) {
    const u = x / 330;
    const n = 0.62 * noise1(u, 21) + 0.28 * noise1(u * 2.3, 24) + 0.1 * noise1(u * 6.1, 30);
    far.push([x, 712 - 78 * (0.25 + 0.75 * Math.pow(clamp(1 - Math.abs(n)), 1.5))]);
  }
  return far;
})();

// sky bands: each starts as a jagged crack that opens into a streak of glow
const BANDS = [
  { x0: 474, x1: 1640, y0: 226, y1: 262, th: 28, d: 0.0, seed: 1 }, // from the star
  { x0: 640, x1: 1850, y0: 160, y1: 150, th: 18, d: 0.16, seed: 2 },
  { x0: 90, x1: 1140, y0: 418, y1: 400, th: 24, d: 0.26, seed: 3 },
  { x0: 1150, x1: 1880, y0: 352, y1: 372, th: 16, d: 0.34, seed: 4 },
  { x0: 300, x1: 840, y0: 492, y1: 484, th: 14, d: 0.42, seed: 5 },
];

function bandGeom(b, kOpen) {
  const n = Math.ceil((b.x1 - b.x0) / 34);
  const up = [];
  const lo = [];
  const mid = [];
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    const x = lerp(b.x0, b.x1, u);
    const tp = Math.pow(Math.sin(Math.PI * u), 0.6);
    const yc = lerp(b.y0, b.y1, u) + 5 * Math.sin(u * 5 + b.seed);
    const jag = (i % 2 ? 1 : -1) * (4 + 9 * hash(b.seed * 31 + i)) * tp * (1 - 0.85 * kOpen);
    const half = (b.th / 2) * kOpen * Math.pow(tp, 0.8);
    up.push([x, yc + jag - half]);
    lo.push([x, yc + jag + half]);
    mid.push([x, yc + jag]);
  }
  return { up, lo, mid };
}

function drawBands(ctx, t, a, rem = 0) {
  if (a <= 0.004) return;
  const ink = a * (1 - 0.75 * rem);
  for (const b of BANDS) {
    const c0 = T.crack + b.d;
    if (t < c0) continue;
    const kDraw = ease.out(prog(t, c0, c0 + 0.32));
    const kOpen = smooth(t, c0 + 0.3, c0 + 1.1);
    const g = bandGeom(b, kOpen);
    const sd = 3000 + b.seed * 10;
    if (kOpen < 0.02) {
      path(ctx, g.mid, { w: 2.2, alpha: 0.85 * a, draw: kDraw, seed: sd, wobble: 0.5 });
      continue;
    }
    // a warm wash + a few streaks inside the band
    const poly = [...g.up, ...g.lo.slice().reverse()];
    fillPoly(ctx, poly, COL.goldSoft, 0.42 * kOpen * lerp(a, 1, rem * 0.6));
    const streak = (f, u0, u1, s) => {
      const pts = g.up.map((p, i) => [p[0], lerp(p[1], g.lo[i][1], f)]);
      const tr = pts.slice(Math.floor(u0 * pts.length), Math.ceil(u1 * pts.length));
      if (tr.length > 1) path(ctx, tr, { w: 1.4, alpha: 0.4 * kOpen * ink, seed: sd + s, wobble: 0.6 });
    };
    streak(0.38, 0.12, 0.7, 3);
    streak(0.66, 0.3, 0.92, 4);
    path(ctx, g.up, { w: 2.2, alpha: 0.8 * ink, seed: sd + 1, wobble: 0.6 });
    path(ctx, g.lo, { w: 1.8, alpha: 0.65 * ink, seed: sd + 2, wobble: 0.6 });
  }
}

function starPts(x, y, r) {
  const pts = [];
  for (let i = 0; i < 8; i++) {
    const ang = -Math.PI / 2 + (i * Math.PI) / 4;
    const rr = i % 2 ? r * 0.3 : i % 4 === 0 ? r * 1.25 : r;
    pts.push([x + Math.cos(ang) * rr, y + Math.sin(ang) * rr]);
  }
  return pts;
}

// The landscape. aSky: star + bands, aLand: ridges. rem: 0..1 settles it into
// a quiet remnant (no far range, bands mostly wash).
function drawLandscape(ctx, t, aSky, aLand, rem = 0) {
  const k = collapseK(t);
  if (aLand > 0.004) {
    // the ridge is inked from left to right as the scene opens
    const kR = smooth(t, T.ridge0, T.ridge1, ease.sine);
    const aFar = smooth(t, 0.35, 1.2);
    const aF = aFar * (1 - rem);
    if (aF > 0.01) path(ctx, FAR, { w: 2.2, alpha: 0.42 * aLand * aF, seed: 2001, wobble: 1 });
    const full = ridgeLine(k);
    // the land's paper tone fades in under the whole ridge (no edge at the pen)
    fillPoly(ctx, [...full, [W + 40, H + 40], [-40, H + 40]], COL.paper, aLand * smooth(t, 0.1, 1.5));
    const rl = kR < 1 ? full.filter((p) => p[0] <= lerp(-40, W + 40, kR) + 14) : full;
    if (rl.length > 1) {
      // shade the right flank (light from the left)
      const aH = smooth(t, 0.8, 1.4) * aLand;
      if (aH > 0.01) {
        // a band of shading that follows the slope down from the peak
        const flank = rl.filter((p) => p[0] >= PEAK_X - 4 && p[0] <= PEAK_X + 470);
        const depth = (x) => lerp(lerp(170, 60, k), 40, clamp((x - PEAK_X) / 470));
        const under = flank.map(([x, y]) => [x - 0.3 * (1 - k) * depth(x), y + depth(x)]).reverse();
        if (flank.length > 2) hatch(ctx, [...flank, ...under], { alpha: 0.17 * aH, gap: 15, angle: -1.05, seed: 2100 });
      }
      path(ctx, rl, { w: 3.4, alpha: aLand, seed: 2002, wobble: 1 });
      // a second, lighter contour inside the mountain gives it body
      const inner = rl.filter((p) => Math.abs(p[0] - PEAK_X) < 300).map(([x, y]) => [x, y + 26 + 0.08 * Math.abs(x - PEAK_X)]);
      if (inner.length > 1) path(ctx, inner, { w: 1.6, alpha: 0.35 * aH * (1 - k), seed: 2003 });
    }
  }
  if (aSky > 0.004) {
    // the star the string hangs from
    const sk = ease.outBack(prog(t, T.star, T.star + 0.45));
    if (sk > 0.01) {
      const tw = 1 + 0.06 * Math.sin(t * 3.1);
      path(ctx, starPts(STAR[0], STAR[1], 13 * sk * tw), { w: 2.4, close: true, alpha: aSky * (1 - 0.45 * smooth(t, T.crack, T.crack + 1.2)), seed: 2010, wobble: 0.3, fill: COL.paper });
    }
    drawBands(ctx, t, aSky, rem);
  }
}

// collapse effects: speed lines while sinking, dust puffs on impact
function drawCollapseFx(ctx, t) {
  const a1 = Math.min(smooth(t, T.fall0, T.fall0 + 0.15), 1 - smooth(t, T.fall1 - 0.15, T.fall1 + 0.1));
  if (a1 > 0.01) {
    const k = collapseK(t);
    for (let i = 0; i < 7; i++) {
      const x = PEAK_X - 210 + i * 70 + 12 * hash(i + 4);
      const y = ridgeY(x, k) - 30 - 50 * hash(i + 9);
      line(ctx, x, y - 60 - 30 * hash(i), x, y, { w: 2, alpha: 0.5 * a1, seed: 2200 + i, wobble: 0.4 });
    }
  }
  const a2 = 1 - smooth(t, T.fall1, T.fall1 + 0.9);
  if (t > T.fall1 - 0.05 && a2 > 0.01) {
    const tau = t - (T.fall1 - 0.05);
    for (let i = 0; i < 6; i++) {
      const side = i % 2 ? 1 : -1;
      const x = PEAK_X + side * (60 + 70 * Math.floor(i / 2)) + side * tau * 50;
      const y = ridgeY(x, 1) - 8 - tau * 40 - 10 * hash(i + 20);
      const r = 8 + 9 * hash(i + 30) + tau * 10;
      path(ctx, ellipsePts(x, y, r, r * 0.7, Math.PI * 0.95, Math.PI * 2.2, 10), { w: 1.8, alpha: 0.5 * a2, seed: 2300 + i, wobble: 0.5 });
    }
  }
}

// ------------------------------------------------------------------ string
function peakPt(t) {
  return [PEAK_X, ridgeY(PEAK_X, collapseK(t)) - 1];
}
const P0 = [PEAK_X, ridgeY(PEAK_X, 0) - 1];
const BREAK_U = 0.5;
const BREAK = [lerp(STAR[0], P0[0], BREAK_U), lerp(STAR[1] + 16, P0[1], BREAK_U)];
const ANCHOR = [STAR[0], STAR[1] + 16]; // bottom point of the star

function rot(c, phi, ax, pr) {
  const cs = Math.cos(phi);
  const sn = Math.sin(phi);
  return [c[0] + ax * cs - pr * sn, c[1] + ax * sn + pr * cs];
}

// whole string, peak -> star, with a standing-wave tremble
function tautPts(t, amp) {
  const pts = [];
  const dx = ANCHOR[0] - P0[0];
  const dy = ANCHOR[1] - P0[1];
  const L = Math.hypot(dx, dy);
  const nx = -dy / L;
  const ny = dx / L;
  const ph = Math.sin(t * TAU * 6.5);
  const ph2 = Math.sin(t * TAU * 9.7 + 1);
  for (let i = 0; i < N; i++) {
    const u = i / (N - 1);
    const d = amp * (Math.sin(Math.PI * u) * ph + 0.25 * Math.sin(TAU * u) * ph2);
    pts.push([P0[0] + dx * u + nx * d, P0[1] + dy * u + ny * d]);
  }
  return pts;
}

const recoil = (tau) => (tau <= 0 ? 0 : ease.outBack(clamp(tau / 0.42)));

// the half that stays with the sky: u = 0 at the star
function upperHang(t) {
  const tau = Math.max(0, t - T.snap);
  const L0 = dist(ANCHOR, BREAK);
  const a0 = Math.atan2(BREAK[1] - ANCHOR[1], BREAK[0] - ANCHOR[0]);
  let len = lerp(L0, 170, recoil(tau));
  len = lerp(len, 225, smooth(tau, 0.5, 1.8));
  const sw = Math.max(0, tau - 0.9);
  let phi = lerp(a0, Math.PI / 2 + 0.04, smooth(tau, 0.08, 1.3, ease.out));
  phi += 0.2 * Math.exp(-1.4 * sw) * Math.sin(2.7 * sw) * smooth(tau, 0.7, 1.0);
  phi += 0.03 * Math.sin(t * 0.9);
  const dec = Math.exp(-3.2 * tau);
  const pts = [];
  for (let i = 0; i < N; i++) {
    const u = i / (N - 1);
    const pr = 30 * u * dec * Math.sin(u * 15 - tau * 24) + 8 * Math.sin(Math.PI * u) * smooth(tau, 0.4, 1.6) * Math.sin(t * 0.7 + 1);
    pts.push(rot(ANCHOR, phi, u * len, pr));
  }
  return pts;
}

// the half that stays with the mountain: u = 0 at the peak
function lowerLie(t) {
  const tau = Math.max(0, t - T.snap);
  const k = collapseK(t);
  const A = peakPt(t);
  const L0 = dist(P0, BREAK);
  const a0 = Math.atan2(BREAK[1] - P0[1], BREAK[0] - P0[0]);
  const len = lerp(L0, 165, recoil(tau));
  const dec = Math.exp(-3.4 * tau);
  const wLie = smooth(tau, 0.22, 1.0);
  const pts = [];
  for (let i = 0; i < N; i++) {
    const u = i / (N - 1);
    const pr = 28 * u * dec * Math.sin(u * 14 - tau * 25);
    const r = rot(A, a0, u * len, pr);
    // draped over the ground, following it down the slope
    const lx = A[0] - u * 230;
    const ly = ridgeY(lx, k) - 3 - 4 * Math.sin(u * Math.PI * 3) * u;
    pts.push([lerp(r[0], lx, wLie), lerp(r[1], ly, wLie)]);
  }
  return pts;
}

// floating ribbon centred at c
function floatPts(t, c, phi, len, amp, seed) {
  const pts = [];
  for (let i = 0; i < N; i++) {
    const u = i / (N - 1);
    const pr = amp * Math.sin(TAU * (1.15 * u - 0.45 * t) + seed) * (0.35 + 0.65 * Math.sin(Math.PI * u));
    pts.push(rot(c, phi, (u - 0.5) * len, pr));
  }
  return pts;
}

const centroid = (pts) => [pts.reduce((s, p) => s + p[0], 0) / pts.length, pts.reduce((s, p) => s + p[1], 0) / pts.length];
const lerpPts = (a, b, k) => a.map((p, i) => [lerp(p[0], b[i][0], k), lerp(p[1], b[i][1], k)]);

export function resample(pts, n) {
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + dist(pts[i - 1], pts[i]));
  const total = cum[cum.length - 1];
  const out = [];
  let j = 0;
  for (let i = 0; i < n; i++) {
    const d = (i / (n - 1)) * total;
    while (j < cum.length - 2 && cum[j + 1] < d) j++;
    const seg = cum[j + 1] - cum[j] || 1;
    const k = (d - cum[j]) / seg;
    out.push([lerp(pts[j][0], pts[j + 1][0], k), lerp(pts[j][1], pts[j + 1][1], k)]);
  }
  return out;
}

// ------------------------------------------------------------------ clouds
// Clean cumulus outline: the outer envelope of a row of circles over a flat
// base, as N points starting at the bottom-left corner, going over the top and
// back along the base (mirror: start bottom-right, go over the top leftward).
export function cloudShape(cx, cy, wd, o = {}) {
  const bumps = o.bumps ?? 4;
  const sd = o.seed ?? 0;
  const base = cy + wd * 0.13;
  const circ = [];
  for (let i = 0; i < bumps; i++) {
    const u = (i + 0.5) / bumps;
    const sinu = Math.sin(Math.PI * u);
    const rr = (wd / bumps) * (0.6 + 0.32 * sinu + 0.1 * Math.sin(i * 2.3 + sd));
    const bx = cx - wd / 2 + u * wd + 4 * Math.sin(i * 1.7 + sd);
    const by = base - rr * (0.45 + 0.55 * sinu) + 4;
    circ.push([bx, by, rr]);
  }
  const oc = [cx, base - wd * 0.1];
  const reach = (phi) => {
    const dx = Math.cos(phi);
    const dy = Math.sin(phi);
    let best = 0;
    for (const [bx, by, rr] of circ) {
      const mx = oc[0] - bx;
      const my = oc[1] - by;
      const b = mx * dx + my * dy;
      const c = mx * mx + my * my - rr * rr;
      const disc = b * b - c;
      if (disc >= 0) best = Math.max(best, -b + Math.sqrt(disc));
    }
    // never below the base
    if (dy > 0) best = Math.min(best, (base - oc[1]) / dy);
    return [oc[0] + dx * best, oc[1] + dy * best];
  };
  const top = [];
  const M = 64;
  for (let i = 0; i <= M; i++) top.push(reach(lerp(Math.PI - 0.5, TAU + 0.5, i / M)));
  const l = top[0];
  const r = top[top.length - 1];
  const pts = [[l[0], base], ...top, [r[0], base]];
  for (let i = 1; i <= 10; i++) pts.push([lerp(r[0], l[0], i / 10), base + 2.5 * Math.sin((i / 10) * Math.PI)]);
  let out = resample(pts, N);
  if (o.mirror) out = out.map(([x, y]) => [2 * cx - x, y]);
  return out;
}

// her cloud / his rain cloud, by name, at global time tg; grow scales it
export function cloudAt(which, tg, o = {}) {
  const c = which === 'her' ? LAY.herCloud : LAY.himCloud;
  const bob = which === 'her' ? 3 * Math.sin(tg * 0.8) : 2.5 * Math.sin(tg * 0.6 + 2);
  const x = o.x ?? c.x;
  const y = (o.y ?? c.y) + bob;
  return cloudShape(x, y, c.w * (o.grow ?? 1), { seed: which === 'her' ? 1 : 4, mirror: which === 'him', bumps: which === 'her' ? 4 : 5 });
}

// draw a finished (or forming, k<1) cloud outline
export function drawCloudPts(ctx, pts, which, k, a = 1, o = {}) {
  const fillK = smooth(k, 0.55, 1);
  if (fillK > 0.01) {
    fillPoly(ctx, pts, COL.paper, fillK * a);
    if (which === 'her') fillPoly(ctx, pts, COL.goldSoft, 0.4 * fillK * a);
    else hatch(ctx, pts, { alpha: 0.24 * fillK * a, gap: 10, angle: -1.0, seed: 2600 });
  }
  path(ctx, pts, { w: o.w ?? lerp(2.4, 3.4, k), color: COL.gold, alpha: a, seed: which === 'her' ? 2500 : 2510, wobble: lerp(0.6, 1.0, k) });
}

// ------------------------------------------------------------------ rain
// Integrated fall distance at global time tg. s13 reverses the rain, so the
// drop speed can change sign: v(t) = V * (1 - 2*smooth(t, r0, r1)).
export const RAIN = { V: 760 };
export function rainPos(tg, r0 = Infinity, r1 = Infinity) {
  const V = RAIN.V;
  if (tg <= r0) return V * tg;
  // integral of the inOut ramp over [r0, min(tg, r1)]
  const te = Math.min(tg, r1);
  const n = 24;
  let acc = 0;
  for (let i = 0; i < n; i++) {
    const tm = r0 + ((i + 0.5) / n) * (te - r0);
    acc += smooth(tm, r0, r1);
  }
  acc *= (te - r0) / n;
  if (tg > r1) acc += tg - r1;
  return V * (tg - 2 * acc);
}

// Rain between x0..x1 from yTop to yBot. pos: fall distance; front: how far
// below yTop the first drops have got (Infinity = everywhere); rear: drops
// below this y are hidden (the rain column lifting away). splash: alpha of
// the little splashes where drops hit yBot.
export function rainDrops(ctx, pos, x0, x1, yTop, yBot, o = {}) {
  const n = o.n ?? 30;
  const len = 26;
  const span = yBot - yTop + len;
  const front = o.front ?? Infinity;
  const rear = o.rear ?? Infinity;
  const splash = o.splash ?? 0;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x0 - 30, yTop, x1 - x0 + 60, yBot - yTop + 4);
  ctx.clip();
  ctx.lineCap = 'round';
  const ink = new Path2D();
  const gold = new Path2D();
  const spl = new Path2D();
  for (let i = 0; i < n; i++) {
    const px = x0 + hash(i * 3.7 + 11) * (x1 - x0);
    const off = hash(i * 5.3 + 2) * span;
    const sp = 0.88 + 0.24 * hash(i * 1.9 + 7);
    const m = (((off + pos * sp) % span) + span) % span;
    const y = yTop + m - len;
    // a splash just after a drop has run into the ground
    if (splash > 0 && i % 2 === 0 && m < 46 && front > yBot - yTop + 30) {
      const k = m / 46;
      const sx = px - 0.06 * (yBot - yTop) - 1.6;
      spl.moveTo(sx - 3 - 3 * k, yBot - 2);
      spl.lineTo(sx - 6 - 7 * k, yBot - 5 - 8 * k);
      spl.moveTo(sx + 3 + 3 * k, yBot - 2);
      spl.lineTo(sx + 6 + 7 * k, yBot - 5 - 8 * k);
    }
    if (y > yTop + front || y > rear) continue;
    const p = i % 7 === 3 ? gold : ink;
    p.moveTo(px - 0.06 * (y - yTop), y);
    p.lineTo(px - 0.06 * (y - yTop) - 1.6, y + len);
  }
  const a = o.alpha ?? 1;
  ctx.lineWidth = 2;
  ctx.strokeStyle = COL.ink;
  ctx.globalAlpha = a * 0.55;
  ctx.stroke(ink);
  if (splash > 0) {
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = a * 0.38 * splash;
    ctx.stroke(spl);
  }
  ctx.strokeStyle = COL.gold;
  ctx.lineWidth = 2.6;
  ctx.globalAlpha = a * 0.9;
  ctx.stroke(gold);
  ctx.restore();
}

// ------------------------------------------------------------------ figures
// She looks up (k 0..1). He lowers his head (k 0..1). tg: global time.
export function herPose(tg, up) {
  const base = pose({
    x: LAY.herX, y: standY(GROUND, FIG_S), s: FIG_S, f: 1,
    aA1: 0.1, aA2: 0.12, aB1: -0.08, aB2: 0.14, head: 0.12, look: 0.3,
    tail: 0.08 * Math.sin(tg * 1.3),
  });
  const look = { head: -0.62, look: -1, lean: -0.08, aA1: 0.05, aB1: -0.12 };
  return mixPose(base, { ...base, ...look }, up);
}

export function himPose(tg, down) {
  const breathe = 0.012 * Math.sin(tg * 1.1);
  const base = pose({
    x: LAY.himX, y: standY(GROUND, FIG_S), s: FIG_S, f: -1,
    aA1: 0.08, aA2: 0.1, aB1: -0.06, aB2: 0.12, lean: breathe,
  });
  const dn = { head: 0.72, lean: 0.15 + breathe, look: 1, aA1: 0.02, aA2: 0.03, aB1: -0.04, aB2: 0.04 };
  return mixPose(base, { ...base, ...dn }, down);
}

// tie position (same geometry as figure.js' ponytail anchor, side view)
function tiePos(p, j) {
  const [hx, hy] = j.head;
  const r = j.r;
  const f = p.f;
  const a = j.headAngle;
  const back = -f;
  const ux = Math.sin(a) * f;
  const uy = -Math.cos(a);
  const bx = back * Math.cos(a);
  const by = -Math.sin(a);
  const ax = hx + (bx * 0.8 + ux * 0.45) * r;
  const ay = hy + (by * 0.8 + uy * 0.45) * r;
  return [ax + bx * r * 0.18, ay + by * r * 0.18];
}

// her, with a gold tie big enough to read at this size
export function drawHer(ctx, p, a = 1) {
  const j = figure(ctx, p, { id: 2, ponytail: true, alpha: a, noTie: true });
  const tp = tiePos(p, j);
  dot(ctx, tp[0], tp[1], 7 * p.s, COL.gold, a);
  return j;
}
export function drawHim(ctx, p, a = 1) {
  return figure(ctx, p, { id: 1, alpha: a });
}

// The two frames and the ground under them, inked with one pen stroke each:
// ground, then top, right, bottom, left (k: 0..1). At k = 1 this is exactly
// frameBox(ctx, x, y, w, h, {seed}) plus the ground line.
const FRAME_SEED = { her: 2700, him: 2720 };
export function drawFrame(ctx, which, k = 1, a = 1) {
  if (k <= 0) return;
  const f = which === 'her' ? LAY.herF : LAY.himF;
  const sd = FRAME_SEED[which];
  const gk = clamp(k / 0.22);
  const ground = which === 'her' ? [[f.x - 70, GROUND], [f.x + f.w + 70, GROUND + 1]] : [[f.x - 70, GROUND + 1], [f.x + f.w + 70, GROUND]];
  path(ctx, ground, { w: 3, seed: sd + 10, draw: gk, alpha: a });
  const fk = clamp((k - 0.12) / 0.88);
  if (fk <= 0) return;
  const { x, y, w, h } = f;
  const ov = 9;
  const sides = [
    [[x - ov, y], [x + w + ov * 0.4, y]],
    [[x + w, y - ov * 0.4], [x + w, y + h + ov]],
    [[x + w + ov, y + h], [x - ov * 0.4, y + h]],
    [[x, y + h + ov * 0.4], [x, y - ov]],
  ];
  sides.forEach((pts, i) => {
    const kk = clamp(fk * 4 - i);
    if (kk <= 0) return;
    path(ctx, pts, { w: 5, sketch: true, seed: sd * 7 + i, draw: kk, alpha: a });
  });
}

// What is left of the landscape: sky in her frame, the valley in his.
// aOut: alpha of everything outside the frames; kIn: 0..1 settles the inside.
const REM_T = 12; // a time after every landscape event (bands open, etc.)
function drawRemnant(ctx, t, aOut, kIn) {
  const f1 = LAY.herF;
  const f2 = LAY.himF;
  const skyIn = lerp(1, 0.4, kIn);
  const landIn = lerp(1, 0.38, kIn);
  if (aOut > 0.004) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(-200, -200, W + 400, H + 400);
    ctx.rect(f1.x, f1.y, f1.w, f1.h);
    ctx.rect(f2.x, f2.y, f2.w, f2.h);
    ctx.clip('evenodd');
    drawLandscape(ctx, t, aOut, aOut);
    ctx.restore();
  }
  ctx.save();
  ctx.beginPath();
  ctx.rect(f1.x, f1.y, f1.w, f1.h);
  ctx.clip();
  drawLandscape(ctx, t, skyIn, aOut, kIn);
  ctx.restore();
  ctx.save();
  ctx.beginPath();
  ctx.rect(f2.x, f2.y, f2.w, f2.h);
  ctx.clip();
  drawLandscape(ctx, t, aOut, landIn, kIn);
  ctx.restore();
}
// the settled remnant (s13)
export function drawRemnantFinal(ctx) {
  drawRemnant(ctx, REM_T, 0, 1);
}

// ------------------------------------------------------------------ scene
// camera: a slow pull back to rest, then (once the two stand in their frames)
// a gentle push in. s13 starts from END_CAM.
export function s12Cam(t) {
  const kc = smooth(t, 0, 9.4, ease.sine);
  const kp = smooth(t, 11.8, S12_DUR, ease.sine);
  return {
    x: lerp(1000, 960, kc),
    y: lerp(470, 540, kc) + 34 * kp,
    z: lerp(1.06, 1, kc) + 0.06 * kp,
  };
}
export const END_CAM = s12Cam(S12_DUR);

export default {
  fadeOut: 0, // s13 picks up this exact frame
  draw(ctx, lt, info) {
    const t = Math.max(0, lt);
    const tg = info.t;

    const cam = s12Cam(t);
    // a short shake when the mountain lands
    if (t > T.fall1 - 0.1 && t < T.fall1 + 0.9) {
      const st = t - (T.fall1 - 0.1);
      cam.x += 5 * Math.exp(-5 * st) * Math.sin(st * 47);
      cam.y += 4 * Math.exp(-5 * st) * Math.sin(st * 39 + 1);
    }

    camera(ctx, cam, () => {
      // ---------------- landscape
      if (t < T.fade0) drawLandscape(ctx, t, 1, 1);
      else {
        const aOut = 1 - smooth(t, T.fade0, T.fade1);
        const kIn = smooth(t, T.fade0, T.fade1 + 0.2);
        drawRemnant(ctx, Math.min(t, REM_T), aOut, kIn);
      }
      drawCollapseFx(ctx, t);

      // ---------------- frames (her frame first, his a beat later)
      drawFrame(ctx, 'her', ease.inOut(prog(t, T.frame0, T.frame1 - 0.15)));
      drawFrame(ctx, 'him', ease.inOut(prog(t, T.frame0 + 0.15, T.frame1)));

      // ---------------- rain on him (behind him)
      if (t > T.rain) {
        const c = LAY.himCloud;
        const front = (t - T.rain) * RAIN.V * 1.1;
        rainDrops(ctx, rainPos(tg), c.x - c.w / 2 + 18, c.x + c.w / 2 - 18, c.y + 22, GROUND - 2, { front, alpha: smooth(t, T.rain, T.rain + 0.3), splash: 1 });
      }

      // ---------------- the two of them
      const aFig = smooth(t, T.fig0, T.fig1);
      if (aFig > 0.01) {
        drawHer(ctx, herPose(tg, smooth(t, T.herLook0, T.herLook1)), aFig);
        drawHim(ctx, himPose(tg, smooth(t, T.himDown0, T.himDown1)), aFig);
      }

      // ---------------- the string
      if (t < T.snap) {
        const kd = smooth(t, T.str0, T.str1, ease.inOut);
        if (kd > 0) {
          const amp = lerp(0.8, 3.2, smooth(t, T.str1, T.str1 + 0.6)) + 4.5 * smooth(t, T.snap - 0.9, T.snap);
          const pts = tautPts(t, amp * smooth(t, T.str1 - 0.3, T.str1 + 0.2));
          // faint ghost lines: the blur of a vibrating string
          const ga = 0.22 * smooth(t, T.str1, T.str1 + 0.6);
          if (ga > 0.01) {
            for (const sgn of [-1, 1]) {
              const env = tautPts(0.25 / 6.5, sgn * amp * 1.15);
              path(ctx, env, { w: 1.1, color: COL.gold, alpha: ga, seed: 2800 + sgn, wobble: 0.2 });
            }
          }
          path(ctx, pts, { w: 2.2, color: COL.gold, draw: kd, seed: 2810, wobble: 0.35 });
          // the moment it reaches the star: a tiny glint
          const gl = Math.min(smooth(t, T.str1 - 0.15, T.str1), 1 - smooth(t, T.str1 + 0.1, T.str1 + 0.5));
          if (gl > 0.01) dot(ctx, ANCHOR[0], ANCHOR[1], 5 * gl, COL.gold, gl);
        }
      } else {
        drawThreads(ctx, t, tg);
        // snap: a few ink ticks fly off the break
        const sa = 1 - smooth(t, T.snap + 0.05, T.snap + 0.45);
        if (sa > 0.01) {
          const k = ease.out(prog(t, T.snap, T.snap + 0.3));
          for (let i = 0; i < 6; i++) {
            const ang = (i / 6) * TAU + 0.4;
            const r0 = 10 + 26 * k;
            const r1 = r0 + 22 * (1 - 0.4 * k);
            line(ctx, BREAK[0] + Math.cos(ang) * r0, BREAK[1] + Math.sin(ang) * r0, BREAK[0] + Math.cos(ang) * r1, BREAK[1] + Math.sin(ang) * r1, { w: 2.4, alpha: sa, seed: 2850 + i, wobble: 0 });
          }
          dot(ctx, BREAK[0], BREAK[1], 6 * (1 - k) + 1, COL.gold, sa);
        }
      }
    });
  },
};

// the two broken halves: hanging / lying, then floating, then becoming clouds
function drawThreads(ctx, t, tg) {
  // ---- her half (from the sky)
  {
    let pts = upperHang(t);
    let km = 0;
    if (t > T.lift) {
      const hang = upperHang(T.lift);
      const c0 = centroid(hang);
      const c = LAY.herCloud;
      const kMove = smooth(t, T.lift, T.herCoil0 + 0.4, ease.inOut);
      const sway = smooth(t, T.lift, T.lift + 1.5) * (1 - smooth(t, T.herCoil0, T.herCoil1));
      const cc = [lerp(c0[0], c.x, kMove) + 26 * Math.sin(t * 0.9) * sway, lerp(c0[1], c.y, kMove) + 12 * Math.sin(t * 1.3 + 1) * sway];
      const phi = lerp(Math.PI / 2 + 0.04, 0, smooth(t, T.lift + 0.2, T.lift + 2.4));
      const fl = floatPts(t, cc, phi, lerp(225, 250, kMove), 13, 0.5);
      // it lets go of the star
      pts = t > T.lift + 1.1 ? fl : lerpPts(hang, fl, smooth(t, T.lift, T.lift + 1.1));
      km = smooth(t, T.herCoil0, T.herCoil1, ease.inOut);
      if (km > 0) pts = lerpPts(pts, cloudAt('her', tg), km);
    }
    if (km > 0.001) drawCloudPts(ctx, pts, 'her', km);
    else path(ctx, pts, { w: 2.4, color: COL.gold, seed: 2500, wobble: 0.6 });
  }
  // ---- his half (from the mountain)
  {
    let pts = lowerLie(t);
    let km = 0;
    if (t > T.lift) {
      const lie = lowerLie(T.lift);
      const c0 = centroid(lie);
      const c = LAY.himCloud;
      const kMove = smooth(t, T.lift + 0.15, T.himCoil0 - 0.6, ease.inOut);
      const sway = smooth(t, T.lift, T.lift + 1.5) * (1 - smooth(t, T.himCoil0, T.himCoil1));
      const cc = [lerp(c0[0], c.x, kMove) - 22 * Math.sin(t * 0.8 + 2) * sway, lerp(c0[1], c.y, kMove) + 12 * Math.sin(t * 1.1) * sway];
      const phi = Math.PI + 0.12 * Math.sin(t * 0.7) * sway;
      const fl = floatPts(t, cc, phi, lerp(230, 260, kMove), 13, 2.1);
      pts = lerpPts(lie, fl, smooth(t, T.lift, T.lift + 1.2));
      km = smooth(t, T.himCoil0, T.himCoil1, ease.inOut);
      if (km > 0) pts = lerpPts(pts, cloudAt('him', tg), km);
    }
    if (km > 0.001) drawCloudPts(ctx, pts, 'him', km);
    else path(ctx, pts, { w: 2.4, color: COL.gold, seed: 2510, wobble: 0.6 });
  }
}
