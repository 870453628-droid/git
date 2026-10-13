// Props for 小金鱼. All ink on paper; the only colour is the fish's gold
// (and the wedding ring, which belongs to the same story).

import { COL, TAU, lerp, clamp, path, line, rect, circle, ellipse, ellipsePts, dot, hatch, fillPoly, text } from './lib.js';
import { frameBox } from './sets.js';

export const GOLD = COL.gold;
export const GOLD_DEEP = '#a8741f';

// ------------------------------------------------------------- the fish
// A small gold fish. (x, y) is its centre, ang its heading (0 = facing
// right), s its scale (1 => about 64 px long).
// o: {alpha, glint (0..1 sparkle), dull (0..1 drains the gold to ink),
//     seed, w}
export function goldFish(ctx, x, y, s = 1, ang = 0, o = {}) {
  const a = o.alpha ?? 1;
  if (a <= 0.001) return;
  const c = Math.cos(ang);
  const sn = Math.sin(ang);
  const P = (px, py) => [x + (px * c - py * sn) * s, y + (px * sn + py * c) * s];
  const seed = o.seed ?? 3000;
  const w = o.w ?? Math.max(1.4, 2.4 * s);
  const dull = clamp(o.dull ?? 0);
  ctx.save();
  ctx.globalAlpha *= a;
  // body: a lens from the mouth (right) to the tail root (left)
  const body = [];
  for (let i = 0; i <= 14; i++) {
    const u = i / 14;
    const bx = lerp(30, -16, u);
    const by = -Math.sin(u * Math.PI) * 13 * (1 - 0.25 * u);
    body.push(P(bx, by));
  }
  for (let i = 0; i <= 14; i++) {
    const u = i / 14;
    const bx = lerp(-16, 30, u);
    const by = Math.sin((1 - u) * Math.PI) * 12 * (1 - 0.25 * (1 - u));
    body.push(P(bx, by));
  }
  const tail = [P(-14, 0), P(-32, -14), P(-27, 0), P(-32, 14), P(-14, 0)];
  const fill = dull > 0 ? mixHex(GOLD, '#8f8a80', dull) : GOLD;
  fillPoly(ctx, tail, fill, 1);
  fillPoly(ctx, body, fill, 1);
  // a warm shadow along the belly
  fillPoly(ctx, body.slice(15), dull > 0 ? mixHex(GOLD_DEEP, '#6f6a62', dull) : GOLD_DEEP, 0.35);
  path(ctx, tail, { w, seed, wobble: 0.35, still: o.still });
  path(ctx, body, { w, close: true, seed: seed + 1, wobble: 0.35, still: o.still });
  // gill and two scale arcs
  path(ctx, [P(16, -9), P(13, 0), P(16, 9)], { w: w * 0.7, seed: seed + 2, wobble: 0.2, still: o.still });
  path(ctx, [P(4, -6), P(1, 0), P(4, 6)], { w: w * 0.55, seed: seed + 3, wobble: 0.2, still: o.still, alpha: 0.7 });
  path(ctx, [P(-6, -6), P(-9, 0), P(-6, 6)], { w: w * 0.55, seed: seed + 4, wobble: 0.2, still: o.still, alpha: 0.7 });
  // dorsal fin
  path(ctx, [P(8, -12), P(0, -19), P(-6, -11)], { w: w * 0.7, seed: seed + 5, wobble: 0.2, still: o.still });
  // eye
  const e = P(22, -3);
  dot(ctx, e[0], e[1], Math.max(1.3, 2.4 * s), COL.ink);
  ctx.restore();
  if (o.glint) sparkle(ctx, ...P(10, -10), 14 * s * o.glint, a * o.glint);
}

// four-point star sparkle in gold-white
export function sparkle(ctx, x, y, r, a = 1) {
  if (r <= 0.5 || a <= 0.01) return;
  ctx.save();
  ctx.globalAlpha *= a;
  ctx.fillStyle = '#fff6d8';
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.quadraticCurveTo(x, y, x + r * 0.35, y);
  ctx.quadraticCurveTo(x, y, x, y + r);
  ctx.quadraticCurveTo(x, y, x - r * 0.35, y);
  ctx.quadraticCurveTo(x, y, x, y - r);
  ctx.moveTo(x - r * 0.7, y);
  ctx.quadraticCurveTo(x, y, x, y - r * 0.25);
  ctx.quadraticCurveTo(x, y, x + r * 0.7, y);
  ctx.quadraticCurveTo(x, y, x, y + r * 0.25);
  ctx.quadraticCurveTo(x, y, x - r * 0.7, y);
  ctx.fill();
  const g = ctx.createRadialGradient(x, y, 0, x, y, r * 1.6);
  g.addColorStop(0, 'rgba(255,220,140,0.45)');
  g.addColorStop(1, 'rgba(255,220,140,0)');
  ctx.fillStyle = g;
  ctx.fillRect(x - r * 1.6, y - r * 1.6, r * 3.2, r * 3.2);
  ctx.restore();
}

// soft gold glow (for the fish lighting up a dark-ish moment)
export function goldGlow(ctx, x, y, r, a = 1) {
  if (a <= 0.01) return;
  ctx.save();
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `rgba(222,170,70,${0.32 * a})`);
  g.addColorStop(1, 'rgba(222,170,70,0)');
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  ctx.restore();
}

// A fine chain: small beads along a sagging curve.
export function chain(ctx, x1, y1, x2, y2, o = {}) {
  const n = Math.max(4, Math.round(Math.hypot(x2 - x1, y2 - y1) / (o.step ?? 7)));
  const sag = o.sag ?? 0;
  ctx.save();
  ctx.globalAlpha *= o.alpha ?? 1;
  ctx.strokeStyle = o.color ?? COL.ink;
  ctx.lineWidth = o.w ?? 1.3;
  for (let i = 0; i < n; i++) {
    const u = (i + 0.5) / n;
    const x = lerp(x1, x2, u);
    const y = lerp(y1, y2, u) + Math.sin(u * Math.PI) * sag;
    ctx.beginPath();
    ctx.ellipse(x, y, 2.4, 1.6, Math.atan2(y2 - y1, x2 - x1) + (i % 2 ? 0 : Math.PI / 2), 0, TAU);
    ctx.stroke();
  }
  ctx.restore();
}

// The fish hanging from a hand by its chain (through its mouth), swinging.
// (hx, hy): the hand. len: chain length. swing: radians from vertical.
// Returns the fish centre.
export function hangingFish(ctx, hx, hy, len, swing, s = 1, o = {}) {
  const ex = hx + Math.sin(swing) * len;
  const ey = hy + Math.cos(swing) * len;
  chain(ctx, hx, hy, ex, ey, { alpha: o.alpha, w: o.chainW });
  // hangs mouth-up: the fish points back up along the chain
  const ang = Math.atan2(hy - ey, hx - ex);
  const cx = ex - Math.cos(ang) * 30 * s;
  const cy = ey - Math.sin(ang) * 30 * s;
  goldFish(ctx, cx, cy, s, ang, o);
  return [cx, cy];
}

// The wedding ring: a little gold ellipse (edge-on when rolling).
export function ring(ctx, x, y, r = 9, roll = 0, o = {}) {
  ctx.save();
  ctx.globalAlpha *= o.alpha ?? 1;
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = Math.max(2.5, r * 0.38);
  ctx.beginPath();
  ctx.ellipse(x, y, r * Math.max(0.25, Math.abs(Math.cos(roll))), r, 0, 0, TAU);
  ctx.stroke();
  ctx.strokeStyle = COL.ink;
  ctx.lineWidth = 1;
  ctx.globalAlpha *= 0.6;
  ctx.beginPath();
  ctx.ellipse(x, y, r * Math.max(0.25, Math.abs(Math.cos(roll))) + 2, r + 2, 0, 0, TAU);
  ctx.stroke();
  ctx.restore();
}

function mixHex(a, b, k) {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return `rgb(${pa.map((v, i) => Math.round(lerp(v, pb[i], k))).join(',')})`;
}

// ------------------------------------------------------------- the workshop
// Workbench seen from the side; returns the bench-top y.
export function workbench(ctx, x, floor, w = 420, o = {}) {
  const top = floor - 150;
  // a solid front hides whoever stands or sits behind the bench
  if (o.solid) fillPoly(ctx, [[x, top], [x + w, top], [x + w, floor], [x, floor]], COL.paper, o.alpha ?? 1);
  rect(ctx, x, top, w, 18, { w: 4, fill: COL.paper, seed: o.seed ?? 3100, alpha: o.alpha });
  line(ctx, x + 16, top + 18, x + 20, floor, { w: 4, seed: 3101, alpha: o.alpha });
  line(ctx, x + w - 16, top + 18, x + w - 20, floor, { w: 4, seed: 3102, alpha: o.alpha });
  line(ctx, x + 20, floor - 46, x + w - 20, floor - 46, { w: 2.5, seed: 3103, alpha: o.alpha });
  // a small anvil block
  const ax = x + w * (o.anvilAt ?? 0.58);
  rect(ctx, ax, top - 26, 46, 26, { w: 3, fill: COL.paper, seed: 3104, alpha: o.alpha, over: 2 });
  path(ctx, [[ax - 6, top - 26], [ax + 52, top - 26]], { w: 4.5, seed: 3105, alpha: o.alpha });
  return top;
}

// Oil lamp with a warm halo. glow 0..1
export function lamp(ctx, x, y, s = 1, glow = 1, o = {}) {
  if (glow > 0) {
    const g = ctx.createRadialGradient(x, y - 30 * s, 0, x, y - 30 * s, 260 * s);
    g.addColorStop(0, `rgba(255,236,190,${0.42 * glow})`);
    g.addColorStop(1, 'rgba(255,236,190,0)');
    ctx.save();
    ctx.fillStyle = g;
    ctx.fillRect(x - 260 * s, y - 290 * s, 520 * s, 520 * s);
    ctx.restore();
  }
  path(ctx, [[x - 18 * s, y], [x + 18 * s, y], [x + 12 * s, y - 16 * s], [x - 12 * s, y - 16 * s]], { w: 3 * s, close: true, fill: COL.paper, seed: 3110, alpha: o.alpha });
  ellipse(ctx, x, y - 34 * s, 13 * s, 20 * s, { w: 2.6 * s, fill: 'rgba(255,250,235,0.6)', seed: 3111, alpha: o.alpha });
  // flame
  path(ctx, [[x, y - 22 * s], [x - 4 * s, y - 30 * s], [x, y - 42 * s], [x + 4 * s, y - 30 * s], [x, y - 22 * s]], { w: 2 * s, seed: 3112, wobble: 0.6, alpha: o.alpha });
}

// Jeweller's hammer held at (x, y) (the grip end), pointing along ang.
export function hammer(ctx, x, y, ang, s = 1, o = {}) {
  const c = Math.cos(ang);
  const sn = Math.sin(ang);
  const P = (px, py) => [x + (px * c - py * sn) * s, y + (px * sn + py * c) * s];
  path(ctx, [P(0, 0), P(46, 0)], { w: 3.4 * s, seed: 3120, alpha: o.alpha, wobble: 0.3 });
  path(ctx, [P(46, -12), P(46, 12), P(56, 12), P(56, -12)], { w: 3 * s, close: true, fill: COL.ink, seed: 3121, alpha: o.alpha, wobble: 0.2 });
}

// Tin can for finished fish; n = how many fish are inside (shows as dots).
export function tinCan(ctx, x, y, s = 1, n = 0, o = {}) {
  rect(ctx, x - 22 * s, y - 50 * s, 44 * s, 50 * s, { w: 3, fill: COL.paper, seed: 3130, over: 1, alpha: o.alpha });
  ellipse(ctx, x, y - 50 * s, 22 * s, 6 * s, { w: 2.4, seed: 3131, alpha: o.alpha });
  for (let i = 0; i < Math.min(n, 25); i++) {
    const px = x - 15 * s + (i % 5) * 7.5 * s;
    const py = y - 46 * s - Math.floor(i / 5) * 3 * s;
    dot(ctx, px, py, 2.6 * s, GOLD, o.alpha ?? 1);
  }
}

// Crucible over a small flame; melt 0..1 fills it with molten gold.
export function crucible(ctx, x, y, s = 1, melt = 0, o = {}) {
  path(ctx, [[x - 28 * s, y - 40 * s], [x - 20 * s, y], [x + 20 * s, y], [x + 28 * s, y - 40 * s]], { w: 3.4, fill: COL.paper, seed: 3140, alpha: o.alpha });
  if (melt > 0) ellipse(ctx, x, y - 36 * s * (0.4 + 0.6 * melt), 22 * s, 5 * s, { w: 0, fill: GOLD, alpha: (o.alpha ?? 1) * clamp(melt * 2) });
  for (let i = 0; i < 3; i++) {
    const fx = x - 14 * s + i * 14 * s;
    path(ctx, [[fx - 5 * s, y + 18 * s], [fx, y + 4 * s], [fx + 5 * s, y + 18 * s]], { w: 2.2, seed: 3141 + i, alpha: o.alpha });
  }
}

// Cup of coffee with rising steam (t = time for the steam).
export function coffeeCup(ctx, x, y, s = 1, t = 0, o = {}) {
  path(ctx, [[x - 14 * s, y - 24 * s], [x - 11 * s, y], [x + 11 * s, y], [x + 14 * s, y - 24 * s]], { w: 2.6 * s, fill: COL.paper, seed: 3150, alpha: o.alpha });
  path(ctx, ellipsePts(x + 17 * s, y - 13 * s, 6 * s, 7 * s, -1.4, 1.4, 8), { w: 2.2 * s, seed: 3151, alpha: o.alpha });
  if (o.steam !== false) {
    for (let i = 0; i < 2; i++) {
      const pts = [];
      for (let k = 0; k <= 8; k++) {
        const u = k / 8;
        pts.push([x - 4 * s + i * 8 * s + Math.sin(u * 5 + t * 3 + i) * 4 * s, y - 30 * s - u * 34 * s]);
      }
      path(ctx, pts, { w: 1.6 * s, seed: 3152 + i, wobble: 0.3, alpha: (o.alpha ?? 1) * 0.55 });
    }
  }
}

// Her doll: a tiny round-headed figure in a dress, sitting.
export function doll(ctx, x, y, s = 1, o = {}) {
  path(ctx, [[x - 9 * s, y], [x, y - 22 * s], [x + 9 * s, y]], { w: 2 * s, fill: COL.paper, close: true, seed: o.seed ?? 3160, alpha: o.alpha });
  circle(ctx, x, y - 28 * s, 6.5 * s, { w: 2 * s, fill: COL.paper, seed: (o.seed ?? 3160) + 1, alpha: o.alpha });
  dot(ctx, x - 2 * s, y - 29 * s, 1, COL.ink, o.alpha ?? 1);
  dot(ctx, x + 2 * s, y - 29 * s, 1, COL.ink, o.alpha ?? 1);
}

// Framed photograph with a black ribbon across the corner and a small lamp.
export function mourningPhoto(ctx, x, y, w = 120, h = 150, o = {}) {
  rect(ctx, x, y, w, h, { w: 4, fill: COL.paper, seed: 3170, alpha: o.alpha });
  rect(ctx, x + 12, y + 12, w - 24, h - 24, { w: 2, seed: 3171, alpha: o.alpha, over: 1 });
  // the black ribbon, diagonally across the top-right corner
  fillPoly(ctx, [[x + w - 46, y], [x + w - 26, y], [x + w, y + 26], [x + w, y + 46]], COL.ink, (o.alpha ?? 1) * 0.92);
  if (o.inner) o.inner(ctx, x + 12, y + 12, w - 24, h - 24);
}

// ------------------------------------------------------------- outdoors
// The chestnut tree: a thick trunk and a cloudy crown.
export function chestnutTree(ctx, x, ground, s = 1, o = {}) {
  const tw = 26 * s;
  path(ctx, [[x - tw, ground], [x - tw * 0.7, ground - 120 * s], [x - tw * 0.9, ground - 230 * s]], { w: 4.5, seed: 3200, alpha: o.alpha });
  path(ctx, [[x + tw, ground], [x + tw * 0.75, ground - 120 * s], [x + tw * 0.95, ground - 230 * s]], { w: 4.5, seed: 3201, alpha: o.alpha });
  // bark marks
  for (let i = 0; i < 5; i++) {
    const yy = ground - 30 * s - i * 40 * s;
    path(ctx, [[x - tw * 0.4, yy], [x - tw * 0.1, yy - 10 * s]], { w: 1.6, seed: 3202 + i, alpha: (o.alpha ?? 1) * 0.6 });
  }
  const crown = [];
  const cy = ground - 330 * s;
  for (let i = 0; i < 9; i++) {
    const a0 = Math.PI * 0.95 + (i / 9) * Math.PI * 1.1;
    const bx = x + Math.cos(a0 + 0.18) * 190 * s;
    const by = cy + Math.sin(a0 + 0.18) * 120 * s;
    crown.push(...ellipsePts(bx, by, 62 * s, 52 * s, a0 - 1.3, a0 + 1.3, 7));
  }
  path(ctx, crown, { w: 4, fill: o.crownFill ?? COL.paper, close: true, seed: 3210, alpha: o.alpha });
  if (o.hatch !== false) hatch(ctx, crown, { alpha: 0.09 * (o.alpha ?? 1), gap: 16, seed: 3211 });
}

// A row of rifle barrels coming in from the right edge, pointing left.
// (x, y): the muzzle of the top barrel; n barrels spaced dy apart.
export function rifles(ctx, x, y, n = 6, dy = 26, len = 520, o = {}) {
  for (let i = 0; i < n; i++) {
    const yy = y + i * dy;
    path(ctx, [[x, yy], [x + len, yy + 4]], { w: o.w ?? 5, seed: 3300 + i, alpha: o.alpha, wobble: 0.5 });
    path(ctx, [[x + len * 0.55, yy + 2], [x + len * 0.55 + 70, yy + 22]], { w: 4, seed: 3320 + i, alpha: (o.alpha ?? 1) * 0.8, wobble: 0.4 });
  }
}

// Block of ice with a cold glow and a few inner needles.
export function iceBlock(ctx, x, y, s = 1, o = {}) {
  const w = 120 * s;
  const h = 90 * s;
  const g = ctx.createRadialGradient(x, y, 0, x, y, w * 1.4);
  g.addColorStop(0, `rgba(255,255,255,${0.55 * (o.alpha ?? 1)})`);
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.save();
  ctx.fillStyle = g;
  ctx.fillRect(x - w * 1.4, y - w * 1.4, w * 2.8, w * 2.8);
  ctx.restore();
  rect(ctx, x - w / 2, y - h / 2, w, h, { w: 3, fill: 'rgba(250,252,255,0.7)', seed: 3400, alpha: o.alpha });
  path(ctx, [[x - w / 2, y - h / 2], [x - w / 2 + 22 * s, y - h / 2 - 18 * s], [x + w / 2 + 22 * s, y - h / 2 - 18 * s], [x + w / 2, y - h / 2]], { w: 2.6, seed: 3401, alpha: o.alpha });
  path(ctx, [[x + w / 2 + 22 * s, y - h / 2 - 18 * s], [x + w / 2 + 22 * s, y + h / 2 - 18 * s], [x + w / 2, y + h / 2]], { w: 2.6, seed: 3402, alpha: o.alpha });
  for (let i = 0; i < 5; i++) {
    const nx = x - w * 0.3 + i * w * 0.15;
    path(ctx, [[nx, y - h * 0.25 + (i % 2) * 10], [nx + 14 * s, y + h * 0.1]], { w: 1.2, seed: 3403 + i, alpha: (o.alpha ?? 1) * 0.5 });
  }
}

// Little music notes rising (for her singing). k: 0..1 progress.
export function notes(ctx, x, y, k, o = {}) {
  for (let i = 0; i < 3; i++) {
    const u = clamp(k * 1.4 - i * 0.2);
    if (u <= 0 || u >= 1) continue;
    const nx = x + i * 22 + Math.sin(u * 6 + i) * 8;
    const ny = y - u * 90;
    const a = Math.sin(u * Math.PI) * (o.alpha ?? 1);
    ellipse(ctx, nx, ny, 6, 4.5, { w: 0, fill: COL.ink, alpha: a });
    line(ctx, nx + 5, ny, nx + 5, ny - 22, { w: 2, alpha: a, seed: 3500 + i, wobble: 0 });
    line(ctx, nx + 5, ny - 22, nx + 13, ny - 16, { w: 2, alpha: a, seed: 3510 + i, wobble: 0 });
  }
}

export { frameBox };
