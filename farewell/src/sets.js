// Shared props and set pieces. All take (ctx, ...) and draw in ink.

import { COL, TAU, W, H, lerp, clamp, smooth, prog, hash, noise1, path, line, rect, circle, ellipse, ellipsePts, dot, hatch, fillPoly } from './lib.js';
import { figure, pose, SIT_BACK, SIT_FRONT } from './figure.js';

// The series motif: a hand-drawn frame ("框"). Everyone lives in one.
// o: {w (default 5), seed, fill, alpha, over}
export function frameBox(ctx, x, y, w, h, o = {}) {
  rect(ctx, x, y, w, h, { w: o.w ?? 5, over: o.over ?? 9, sketch: o.sketch ?? true, ...o });
}

export function sun(ctx, x, y, r, o = {}) {
  const rays = o.rays ?? 12;
  const spin = o.spin ?? 0;
  if (o.glow) {
    const g = ctx.createRadialGradient(x, y, r * 0.6, x, y, r * 3.2);
    g.addColorStop(0, `rgba(211,155,51,${0.22 * o.glow})`);
    g.addColorStop(1, 'rgba(211,155,51,0)');
    ctx.save();
    ctx.fillStyle = g;
    ctx.fillRect(x - r * 3.2, y - r * 3.2, r * 6.4, r * 6.4);
    ctx.restore();
  }
  circle(ctx, x, y, r, { w: o.w ?? 3.6, alpha: o.alpha, color: o.color, fill: o.fill });
  for (let i = 0; i < rays; i++) {
    const a = spin + (i / rays) * TAU;
    const r0 = r * 1.32;
    const r1 = r * (i % 2 ? 1.62 : 1.78);
    line(ctx, x + Math.cos(a) * r0, y + Math.sin(a) * r0, x + Math.cos(a) * r1, y + Math.sin(a) * r1, { w: (o.w ?? 3.6) * 0.8, alpha: o.alpha, color: o.color });
  }
}

export function moon(ctx, x, y, r, o = {}) {
  const pts = [...ellipsePts(x, y, r, r, -1.9, 1.9), ...ellipsePts(x + r * 0.45, y, r * 0.82, r * 0.82, 1.62, -1.62)];
  path(ctx, pts, { w: o.w ?? 3.4, alpha: o.alpha, close: true, fill: o.fill });
}

// Bumpy cloud outline. o: {w, alpha, fill (default paper), color, seed}
export function cloud(ctx, x, y, s = 1, o = {}) {
  const bumps = o.bumps ?? 5;
  const pts = [];
  const wdt = 150 * s;
  const ht = 46 * s;
  // top bumps
  for (let i = 0; i < bumps; i++) {
    const cx = x - wdt / 2 + ((i + 0.5) / bumps) * wdt;
    const rr = (wdt / bumps) * (0.62 + 0.25 * Math.sin(i * 2.1 + (o.seed ?? 0)));
    const cy = y - ht * 0.25 - rr * 0.35 * Math.sin(((i + 0.5) / bumps) * Math.PI);
    pts.push(...ellipsePts(cx, cy, rr, rr, Math.PI, TAU, 8));
  }
  pts.push([x + wdt / 2 + 6 * s, y + ht * 0.25]);
  pts.push([x - wdt / 2 - 6 * s, y + ht * 0.25]);
  path(ctx, pts, { w: o.w ?? 3.2, alpha: o.alpha, color: o.color, close: true, fill: o.fill ?? COL.paper, seed: o.seedStroke });
}

// Little "v" bird. flap: 0..1
export function bird(ctx, x, y, s = 1, flap = 0, o = {}) {
  const k = Math.sin(flap * TAU) * 0.6;
  const wv = 16 * s;
  path(ctx, [[x - wv, y - wv * (0.35 + k)], [x - wv * 0.45, y - wv * 0.1], [x, y]], { w: o.w ?? 2.6, alpha: o.alpha, wobble: 0.4, seed: o.seed });
  path(ctx, [[x, y], [x + wv * 0.45, y - wv * 0.1], [x + wv, y - wv * (0.35 + k)]], { w: o.w ?? 2.6, alpha: o.alpha, wobble: 0.4, seed: o.seed === undefined ? undefined : o.seed + 1 });
}

// A drifting curl of wind. k: 0..1 progress across [x0, x1]
export function windLine(ctx, x0, y0, len, k, o = {}) {
  const x = lerp(x0, x0 + (o.travel ?? 900), k);
  const pts = [];
  const n = 18;
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    pts.push([x + u * len, y0 + Math.sin(u * 5 + k * 6) * 7]);
  }
  if (o.curl) {
    const ex = x + len;
    pts.push(...ellipsePts(ex - 6, y0 - 14, 14, 14, Math.PI * 0.5, -Math.PI * 1.1, 10));
  }
  const a = (o.alpha ?? 0.55) * Math.sin(Math.PI * clamp(k));
  path(ctx, pts, { w: o.w ?? 2.4, alpha: a, wobble: 0.6, seed: o.seed, draw: o.draw });
}

// Rain over a rect. density: drops per 100x100. Deterministic per t.
export function rain(ctx, t, x, y, w, h, o = {}) {
  const n = Math.floor(((w * h) / 10000) * (o.density ?? 1.2));
  const speed = o.speed ?? 900;
  const len = o.len ?? 22;
  const slant = o.slant ?? 0.15;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.strokeStyle = o.color ?? COL.ink;
  ctx.globalAlpha *= o.alpha ?? 0.55;
  ctx.lineWidth = o.w ?? 2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const px = x + hash(i * 3.1 + 1) * w;
    const off = hash(i * 7.7 + 2) * (h + len);
    const py = y + ((off + t * speed * (0.85 + 0.3 * hash(i))) % (h + len)) - len;
    ctx.moveTo(px - slant * (py - y), py);
    ctx.lineTo(px - slant * (py - y) - slant * len, py + len);
  }
  ctx.stroke();
  ctx.restore();
}

// Paper plane pointing along angle ang (radians, 0 = right).
export function paperPlane(ctx, x, y, ang, s = 1, o = {}) {
  const c = Math.cos(ang);
  const sn = Math.sin(ang);
  const P = (px, py) => [x + (px * c - py * sn) * s, y + (px * sn + py * c) * s];
  path(ctx, [P(30, 0), P(-26, -16), P(-14, 0), P(30, 0)], { w: o.w ?? 2.8, fill: o.fill ?? COL.paper, alpha: o.alpha, seed: o.seed });
  path(ctx, [P(30, 0), P(-26, 12), P(-14, 0)], { w: o.w ?? 2.8, fill: o.fill ?? COL.paper, alpha: o.alpha, seed: o.seed === undefined ? undefined : o.seed + 1 });
}

// Window frame with cross bars. o.bars: 'cross' | 'v' | 'none'
export function windowFrame(ctx, x, y, w, h, o = {}) {
  rect(ctx, x, y, w, h, { w: o.w ?? 4, fill: o.fill, alpha: o.alpha });
  const bars = o.bars ?? 'cross';
  if (bars === 'cross' || bars === 'v') line(ctx, x + w / 2, y, x + w / 2, y + h, { w: (o.w ?? 4) * 0.7, alpha: o.alpha });
  if (bars === 'cross') line(ctx, x, y + h / 2, x + w, y + h / 2, { w: (o.w ?? 4) * 0.7, alpha: o.alpha });
}

// School desk, side view. x: centre, floor: floor y. Returns the desk-top y.
export function desk(ctx, x, floor, s = 1, o = {}) {
  const top = floor - 112 * s;
  const hw = 72 * s;
  path(ctx, [[x - hw, top], [x + hw, top]], { w: (o.w ?? 4.2) * 1.15, alpha: o.alpha });
  path(ctx, [[x - hw, top + 16 * s], [x + hw, top + 16 * s]], { w: (o.w ?? 4.2) * 0.6, alpha: o.alpha });
  line(ctx, x - hw + 10 * s, top, x - hw + 12 * s, floor, { w: o.w ?? 4.2, alpha: o.alpha });
  line(ctx, x + hw - 10 * s, top, x + hw - 12 * s, floor, { w: o.w ?? 4.2, alpha: o.alpha });
  return top;
}

// School chair, side view. f: the way a person sitting on it faces.
// Returns the seat y (put the hip at seat - SIT_LIFT*s).
export function chair(ctx, x, floor, s = 1, f = 1, o = {}) {
  const seat = floor - 60 * s;
  const hw = 26 * s;
  line(ctx, x - hw, seat, x + hw, seat, { w: (o.w ?? 4) * 1.1, alpha: o.alpha });
  line(ctx, x - hw * 0.8, seat, x - hw * 0.85, floor, { w: o.w ?? 4, alpha: o.alpha });
  line(ctx, x + hw * 0.8, seat, x + hw * 0.85, floor, { w: o.w ?? 4, alpha: o.alpha });
  const bx = x - f * hw;
  line(ctx, bx, seat, bx - f * 6 * s, seat - 78 * s, { w: o.w ?? 4, alpha: o.alpha });
  return seat;
}

// Mountain ridge points between x0..x1 around baseY. amp: peak height.
export function ridgePts(seed, x0, x1, baseY, amp, o = {}) {
  const pts = [];
  const step = o.step ?? 16;
  const freq = o.freq ?? 1 / 260;
  for (let x = x0; x <= x1 + 0.1; x += step) {
    const u = x * freq;
    const n = 0.62 * noise1(u, seed) + 0.28 * noise1(u * 2.3, seed + 3) + 0.1 * noise1(u * 6.1, seed + 9);
    // sharpen into peaks
    const peak = 1 - Math.abs(n);
    pts.push([x, baseY - amp * (0.25 + 0.75 * Math.pow(clamp(peak), o.sharp ?? 2.2))]);
  }
  return pts;
}

// Fill under a ridge with paper (so nearer ridges hide farther ones) and ink its line.
// o: {bottom, fill, w, alpha, hatchAlpha}
export function ridge(ctx, pts, o = {}) {
  const bottom = o.bottom ?? H + 20;
  const poly = [...pts, [pts[pts.length - 1][0], bottom], [pts[0][0], bottom]];
  fillPoly(ctx, poly, o.fill ?? COL.paper, o.fillAlpha ?? 1);
  if (o.hatchAlpha) hatch(ctx, poly, { alpha: o.hatchAlpha, gap: o.hatchGap ?? 16, angle: o.hatchAngle ?? -1.0, seed: o.hatchSeed ?? 700 });
  path(ctx, pts, { w: o.w ?? 3.4, alpha: o.alpha, seed: o.seed, wobble: o.wobble ?? 1 });
}

// Lollipop tree
export function tree(ctx, x, ground, s = 1, o = {}) {
  line(ctx, x, ground, x, ground - 46 * s, { w: (o.w ?? 3.2), alpha: o.alpha, seed: o.seed });
  circle(ctx, x, ground - 64 * s, 22 * s, { w: o.w ?? 3.2, alpha: o.alpha, fill: o.fill ?? COL.paper, seed: o.seed === undefined ? undefined : o.seed + 1 });
}

// Tiny distant person (for crowds, playgrounds). k: running/walk phase.
export function tinyPerson(ctx, x, y, s = 0.35, k = 0, o = {}) {
  const p = pose({ x, y: y - 114 * s, s, f: o.f ?? 1 });
  if (o.moving) {
    const a = Math.sin(k * TAU);
    Object.assign(p, { lA1: 0.5 * a, lB1: -0.5 * a, aA1: -0.5 * a, aB1: 0.5 * a, lA2: -0.4, lB2: -0.4 });
  }
  figure(ctx, p, { id: o.id ?? 90, w: o.w ?? Math.max(1.6, 4.6 * s), alpha: o.alpha, eye: 'none', ponytail: o.ponytail });
}

// ----------------------------------------------------------- the high platform
// "那天我们并肩坐在高台上，望着班级，望着操场。"
// Seen from behind: the two sit on the top edge of a big frame, looking out
// over the school building (left) and the running track (right).
//
// o: {
//   boyTurn   0..1   his head turns toward her (an eye shows on the rim)
//   girlTilt  -1..1  her head tilt (+ = toward him)
//   mem       0..1   memory dissolve: school, track, platform, then the two
//                    fade into dashes; sun and wind remain
//   noFigures bool
//   figAlpha  0..1   extra alpha for the two
// }
// Layout constants are exported so scenes can place things relative to it.
export const PLATFORM = {
  ledgeY: 842,
  boyX: 880,
  girlX: 1046,
  horizon: 478,
  sun: [1540, 210],
  figS: 1.0,
};

export function platformScene(ctx, t, o = {}) {
  const L = PLATFORM;
  const mem = o.mem ?? 0;
  const fadeA = (a, b) => 1 - smooth(mem, a, b);
  const memDash = mem > 0.02 ? [lerp(60, 7, clamp(mem * 1.4)), lerp(0, 12, clamp(mem * 1.4))] : undefined;
  const aSchool = fadeA(0.0, 0.45);
  const aTrack = fadeA(0.12, 0.55);
  const aPlat = fadeA(0.3, 0.72);
  const aFig = fadeA(0.5, 0.95) * (o.figAlpha ?? 1);

  // sun (stays, warms up as the rest fades)
  sun(ctx, L.sun[0], L.sun[1], 46, { spin: t * 0.05, glow: 0.35 + mem * 0.9 });

  // horizon & far ground
  if (aSchool > 0.01) {
    const hz = L.horizon;
    path(ctx, [[60, hz + 6], [700, hz], [1300, hz + 4], [1860, hz - 2]], { w: 2.6, alpha: 0.8 * aSchool, dash: memDash, seed: 300 });
    // school building
    const bx = 170;
    const by = 300;
    const bw = 700;
    const bh = hz - by;
    rect(ctx, bx, by, bw, bh, { w: 3.6, alpha: aSchool, dash: memDash, seed: 301, fill: COL.paper });
    path(ctx, [[bx - 14, by], [bx + bw / 2, by - 54], [bx + bw + 14, by]], { w: 3.4, alpha: aSchool, dash: memDash, seed: 302 });
    // clock
    circle(ctx, bx + bw / 2, by - 18, 14, { w: 2.4, alpha: aSchool, seed: 303 });
    line(ctx, bx + bw / 2, by - 18, bx + bw / 2, by - 27, { w: 2, alpha: aSchool, seed: 304, wobble: 0 });
    line(ctx, bx + bw / 2, by - 18, bx + bw / 2 + 6, by - 15, { w: 2, alpha: aSchool, seed: 305, wobble: 0 });
    // window grid: 3 floors x 8
    for (let fl = 0; fl < 3; fl++) {
      for (let c = 0; c < 8; c++) {
        const wx = bx + 30 + c * 84;
        const wy = by + 22 + fl * 56;
        rect(ctx, wx, wy, 52, 34, { w: 2.2, alpha: aSchool * 0.9, over: 2, dash: memDash, seed: 320 + fl * 8 + c });
      }
    }
    // their classroom: a faint gold mark in one window
    rect(ctx, bx + 30 + 5 * 84 + 6, by + 22 + 56 + 6, 40, 22, { w: 0, fill: COL.goldSoft, alpha: aSchool });
    // trees along the horizon
    for (let i = 0; i < 6; i++) tree(ctx, 960 + i * 150 + (i % 2) * 30, hz + 2, 0.55 + 0.1 * (i % 3), { alpha: aSchool * 0.85, seed: 360 + i * 2 });
  }

  // running track
  if (aTrack > 0.01) {
    const cx = 1240;
    const cy = 640;
    path(ctx, ellipsePts(cx, cy, 420, 112, -2.2, -2.2 + TAU + 0.15), { w: 3.2, alpha: aTrack, dash: memDash, seed: 380 });
    path(ctx, ellipsePts(cx, cy, 350, 74, -2.0, -2.0 + TAU + 0.15), { w: 2.2, alpha: aTrack * 0.8, dash: memDash, seed: 381 });
    // football goal
    rect(ctx, cx - 300, cy - 30, 30, 34, { w: 2, alpha: aTrack * 0.8, over: 1, seed: 382 });
    line(ctx, cx, cy - 72, cx, cy + 72, { w: 1.8, alpha: aTrack * 0.6, seed: 383 });
    // tiny runners going round the track
    for (let i = 0; i < 4; i++) {
      const a = t * (0.32 + i * 0.05) + i * 1.7;
      const rx = cx + Math.cos(a) * 385;
      const ry = cy + Math.sin(a) * 93;
      tinyPerson(ctx, rx, ry + 4, 0.2, t * 1.6 + i * 0.3, { moving: true, f: Math.sin(a) > 0 ? -1 : 1, alpha: aTrack * 0.85, id: 400 + i, w: 1.6 });
    }
  }

  // wind lines drifting across
  for (let i = 0; i < 4; i++) {
    const per = 6.5;
    const k = ((t + i * 1.7) % per) / per;
    windLine(ctx, -200 + i * 140, 160 + i * 95 + (i % 2) * 40, 150 + 40 * (i % 3), k, { travel: 1900, curl: i % 2 === 0, seed: 420 + i, alpha: 0.45 + mem * 0.25 });
  }

  // birds
  for (let i = 0; i < 3; i++) {
    const bxp = ((t * 26 + i * 120) % 2300) - 200;
    bird(ctx, bxp, 150 + i * 26 + Math.sin(t + i) * 8, 0.75 - i * 0.12, t * 1.4 + i * 0.3, { alpha: aSchool * 0.8, seed: 440 + i * 2 });
  }

  // the platform: a big frame whose top edge is the ledge
  if (aPlat > 0.01) {
    const x0 = 470;
    const x1 = 1460;
    const y = L.ledgeY;
    fillPoly(ctx, [[x0, y], [x1, y], [x1, H + 20], [x0, H + 20]], COL.paper, aPlat);
    hatch(ctx, [x0 + 8, y + 26, x1 - x0 - 16, H - y], { alpha: 0.14 * aPlat, gap: 18, seed: 460 });
    frameBox(ctx, x0, y, x1 - x0, H - y + 60, { alpha: aPlat, dash: memDash, seed: 470, w: 5.5 });
    line(ctx, x0 + 14, y + 22, x1 - 14, y + 22, { w: 2, alpha: aPlat * 0.6, seed: 475 });
  }

  // the two of them, from behind
  if (!o.noFigures && aFig > 0.01) {
    const s = L.figS;
    const hipY = L.ledgeY - 2;
    const boyTurn = o.boyTurn ?? 0;
    const boy = pose({
      view: 'back', x: L.boyX, y: hipY, s, ...SIT_BACK,
      turn: boyTurn, lean: 0.04 * boyTurn, head: 0.1 * boyTurn,
    });
    const girl = pose({
      view: 'back', x: L.girlX, y: hipY, s, ...SIT_BACK,
      head: (o.girlTilt ?? 0) * -0.12, lean: (o.girlTilt ?? 0) * -0.03,
      tail: 0.18 * Math.sin(t * 1.25) + 0.08 * Math.sin(t * 3.1),
    });
    const fo = { legs: false, seat: true, alpha: aFig, dash: memDash };
    figure(ctx, boy, { id: 1, ...fo });
    figure(ctx, girl, { id: 2, ponytail: true, ...fo });
  }
}

// ------------------------------------------------- the ledge, front two-shot
// The same afternoon from the front: the two sit on the top edge of the big
// frame, legs dangling over it, sky and far hills behind them.
//
// o: {
//   boyTurn   0..1  his head turns toward her (eyes shift right)
//   boyHand   0..1  his hand lifts toward her shoulder
//   girlLook  -1..1 her gaze, -1 = up into the distance
//   mem       0..1  memory dissolve (background, ledge, then the two)
//   bg        bool  draw sky/hills (default true)
// }
export const LEDGE = { y: 650, x0: 300, x1: 1620, boyX: 820, girlX: 1100, s: 1.55, sun: [1580, 200] };

export function ledgeFront(ctx, t, o = {}) {
  const L = LEDGE;
  const mem = o.mem ?? 0;
  const fadeA = (a, b) => 1 - smooth(mem, a, b);
  const memDash = mem > 0.02 ? [lerp(60, 7, clamp(mem * 1.4)), lerp(0, 12, clamp(mem * 1.4))] : undefined;
  const aBg = fadeA(0, 0.45);
  const aLedge = fadeA(0.25, 0.7);
  const aFig = fadeA(0.5, 0.95) * (o.figAlpha ?? 1);

  if (o.bg ?? true) {
    sun(ctx, L.sun[0], L.sun[1], 44, { spin: t * 0.05, glow: 0.35 + mem * 0.9 });
    if (aBg > 0.01) {
      const far = ridgePts(4, -40, W + 40, 520, 90, { freq: 1 / 380, sharp: 1.6 });
      ridge(ctx, far, { w: 2.4, alpha: 0.55 * aBg, fillAlpha: aBg, seed: 610 });
      const near = ridgePts(9, -40, W + 40, 585, 60, { freq: 1 / 300, sharp: 1.4 });
      ridge(ctx, near, { w: 2.8, alpha: 0.75 * aBg, fillAlpha: aBg, seed: 611, hatchAlpha: 0.1 * aBg });
      cloud(ctx, 520 + Math.sin(t * 0.1) * 20, 210, 0.9, { alpha: 0.8 * aBg, seedStroke: 612 });
      cloud(ctx, 1180 + Math.sin(t * 0.08 + 1) * 24, 140, 0.6, { alpha: 0.7 * aBg, seedStroke: 613, seed: 2 });
      for (let i = 0; i < 2; i++) {
        const bx = ((t * 30 + i * 400) % 2300) - 200;
        bird(ctx, bx, 300 + i * 40 + Math.sin(t * 0.8 + i) * 10, 0.8, t * 1.3 + i * 0.4, { alpha: 0.8 * aBg, seed: 620 + i * 2 });
      }
    }
    for (let i = 0; i < 3; i++) {
      const per = 7;
      const k = ((t + i * 2.3) % per) / per;
      windLine(ctx, -200 + i * 100, 300 + i * 120, 170 + 30 * i, k, { travel: 2000, curl: i !== 1, seed: 630 + i, alpha: 0.45 + mem * 0.25 });
    }
  }

  if (aLedge > 0.01) {
    fillPoly(ctx, [[L.x0, L.y], [L.x1, L.y], [L.x1, H + 20], [L.x0, H + 20]], COL.paper, aLedge);
    hatch(ctx, [L.x0 + 10, L.y + 30, L.x1 - L.x0 - 20, H - L.y], { alpha: 0.13 * aLedge, gap: 20, seed: 640 });
    frameBox(ctx, L.x0, L.y, L.x1 - L.x0, H - L.y + 80, { alpha: aLedge, dash: memDash, seed: 650, w: 6 });
  }

  if (aFig > 0.01) {
    const s = L.s;
    const hipY = L.y - 3;
    const turn = o.boyTurn ?? 0;
    const hand = o.boyHand ?? 0;
    const boy = pose({
      view: 'front', x: L.boyX, y: hipY, s, ...SIT_FRONT,
      turn: turn * 0.9, head: 0.12 * turn, lean: 0.03 * turn + 0.02 * hand,
      aB1: lerp(SIT_FRONT.aB1, 1.42, hand), aB2: lerp(SIT_FRONT.aB2, 0.38, hand),
      lB2: -0.08 + 0.03 * Math.sin(t * 1.7),
    });
    const sw = Math.sin(t * 2.1);
    const girl = pose({
      view: 'front', x: L.girlX, y: hipY, s, ...SIT_FRONT,
      look: o.girlLook ?? 0, head: -0.05 + 0.04 * Math.sin(t * 0.6), turn: -0.1,
      lA2: -0.08 + 0.07 * sw, lB2: -0.08 - 0.07 * sw,
      tail: 0.2 * Math.sin(t * 1.25),
    });
    figure(ctx, boy, { id: 1, alpha: aFig, dash: memDash });
    figure(ctx, girl, { id: 2, ponytail: true, alpha: aFig, dash: memDash });
  }
}
