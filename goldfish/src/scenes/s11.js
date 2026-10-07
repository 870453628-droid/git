// s11 — 回忆 (59.8–63.6, "成为回忆")
// 空作坊，黄昏。墙钉上那条小金鱼自己亮起来，从细链上滑脱，游了出来。它游过的地方，一个
// 个小框亮起：冰块、门口的小女孩、滚向门口的戒指、早上的咖啡、她唱歌。
//
// s11 and s12 are one continuous shot: memory(ctx, t) draws it from the global
// time t, and s12 calls it too (s11 ends with a hard cut onto the same frame).
// The forgetting (frames fade one by one, the workshop's lines come apart, the
// fish's ink comes apart, the gold dims) is timed here as well, so the two
// scenes cannot drift apart.
import { W, H, COL, TAU, lerp, clamp, prog, smooth, keys, ease, hash, path, line, rect, ellipse, ellipsePts, dot, fillPoly, camera } from '../lib.js';
import { figure, pose, reach, standY } from '../figure.js';
import { goldGlow, sparkle, chain, ring, coffeeCup, iceBlock, notes, GOLD, GOLD_DEEP } from '../props.js';
import { ROOM, BENCH, ANVIL } from './s04.js';

// ------------------------------------------------------------ shared bits
// The nail above the bench where the first fish hangs in old age (s09–s11).
export const NAIL = [790, 516];
export const FISH_ON_NAIL = { len: 38, s: 0.6 };
export function nail(ctx, o = {}) {
  dot(ctx, NAIL[0], NAIL[1], 4.4, COL.ink, o.alpha ?? 1);
  line(ctx, NAIL[0] - 2, NAIL[1] + 2, NAIL[0] + 6, NAIL[1] - 5, { w: 2.6, seed: 5200, wobble: 0, alpha: o.alpha });
}

// ------------------------------------------------------------ timing (global s)
const T_GLINT = 60.12; // the fish lights up on its nail
const T_WRIGGLE = 60.55;
const T_SLIP = 60.88; // it slips off the chain
const T_GO = 60.98; // and swims
const T_REST = 63.45; // comes to rest in the middle of its memories
const T_FORGET = 63.85; // frames fade, one after another
const FORGET_GAP = 0.3;
const FORGET_DUR = 0.66;
const FORGET_ORDER = ['ice', 'ring', 'coffee', 'song', 'door']; // the doorway, where it began, goes last
const T_APART = [64.6, 66.15]; // the workshop's lines come apart
const T_INK = [66.2, 67.0]; // the fish's own ink comes apart: only the gold is left
const T_DIM = [66.55, 68.0]; // the gold dims as the music dies (66.9–68.4)
const T_GONE = [67.35, 68.25]; // and is gone; bare paper to the end
const FISH_S = 1.15; // the fish's size once it is alive

// ------------------------------------------------------------ the memories
// Each frame opens when the fish passes closest to it, a beat after. The
// vignettes are drawn at their design size (dw x dh) and scaled by k.
export const MEM = [
  { id: 'ice', c: [1188, 586], dw: 236, dh: 164, k: 1.12 },
  { id: 'door', c: [1192, 298], dw: 176, dh: 196, k: 1.15 },
  { id: 'ring', c: [895, 230], dw: 240, dh: 150, k: 1.12 },
  { id: 'coffee', c: [600, 278], dw: 206, dh: 160, k: 1.15 },
  { id: 'song', c: [590, 556], dw: 222, dh: 170, k: 1.12 },
];
const REST_AT = [895, 452];

// ------------------------------------------------------------ the fish's route
// From the nail: right past the ice, up past the doorway, left under the ring,
// past the coffee, down past her singing, and up into the middle.
const ROUTE = [
  [790, 577], [826, 566], [930, 560], [1040, 528], [1078, 448], [1066, 368], [1010, 330],
  [905, 344], [800, 336], [718, 360], [690, 440], [712, 530], [778, 548], [846, 506], [882, 466], REST_AT,
];
const TABLE = (() => {
  const pts = [];
  const P = ROUTE;
  for (let i = 0; i < P.length - 1; i++) {
    const p0 = P[Math.max(0, i - 1)];
    const p1 = P[i];
    const p2 = P[i + 1];
    const p3 = P[Math.min(P.length - 1, i + 2)];
    for (let k = 0; k < 30; k++) {
      const u = k / 30;
      const u2 = u * u;
      const u3 = u2 * u;
      const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * u + (2 * a - 5 * b + 4 * c - d) * u2 + (-a + 3 * b - 3 * c + d) * u3);
      pts.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  pts.push(P[P.length - 1]);
  const acc = [0];
  for (let i = 1; i < pts.length; i++) acc.push(acc[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  return { pts, acc, len: acc[acc.length - 1] };
})();

function at(d) {
  const { pts, acc, len } = TABLE;
  d = clamp(d, 0, len);
  let lo = 0;
  let hi = acc.length - 1;
  while (hi - lo > 1) {
    const m = (lo + hi) >> 1;
    if (acc[m] < d) lo = m;
    else hi = m;
  }
  const k = acc[hi] > acc[lo] ? (d - acc[lo]) / (acc[hi] - acc[lo]) : 0;
  return [lerp(pts[lo][0], pts[hi][0], k), lerp(pts[lo][1], pts[hi][1], k)];
}

// distance along the route: a gentle start, a steady glide, a long slow stop
const ACC = 0.45;
const DEC = 1.0;
function dist(t) {
  const T = T_REST - T_GO;
  const L = TABLE.len;
  const v = L / (T - ACC / 2 - DEC / 2);
  const u = clamp(t - T_GO, 0, T);
  if (u < ACC) return (0.5 * v * u * u) / ACC;
  if (u < T - DEC) return 0.5 * v * ACC + v * (u - ACC);
  const r = T - u;
  return L - (0.5 * v * r * r) / DEC;
}
function timeAt(d) {
  let lo = T_GO;
  let hi = T_REST;
  for (let i = 0; i < 40; i++) {
    const m = (lo + hi) / 2;
    if (dist(m) < d) lo = m;
    else hi = m;
  }
  return lo;
}

MEM.forEach((m, i) => {
  m.w = m.dw * m.k;
  m.h = m.dh * m.k;
  let best = 1e9;
  let bd = 0;
  for (let k = 0; k < TABLE.pts.length; k++) {
    const q = TABLE.pts[k];
    const dd = Math.hypot(q[0] - m.c[0], q[1] - m.c[1]);
    if (dd < best) {
      best = dd;
      bd = TABLE.acc[k];
    }
  }
  m.open = timeAt(bd) - 0.14;
  m.forget = T_FORGET + FORGET_ORDER.indexOf(m.id) * FORGET_GAP;
  m.seed = 5600 + i * 40;
});

// a frame's border drawn on side by side (k: 0..1)
function border(ctx, x, y, w, h, k, o) {
  const sides = [
    [[x - 7, y], [x + w + 3, y]],
    [[x + w, y - 3], [x + w, y + h + 7]],
    [[x + w + 7, y + h], [x - 3, y + h]],
    [[x, y + h + 3], [x, y - 7]],
  ];
  sides.forEach((pts, i) => {
    const kk = clamp(k * 4 - i);
    if (kk <= 0) return;
    path(ctx, pts, { ...o, draw: kk, seed: o.seed + i, sketch: true });
  });
}

function memFrame(ctx, m, t) {
  const open = smooth(t, m.open, m.open + 0.55, ease.out);
  if (open <= 0) return;
  const fk = prog(t, m.forget, m.forget + FORGET_DUR);
  const gone = smooth(fk, 0.25, 1);
  if (gone >= 1) return;
  const [cx, cy0] = m.c;
  const cy = cy0 - 18 * ease.in(fk); // drifts up a little as it goes
  const sc = lerp(0.9, 1, open) * lerp(1, 0.95, fk);
  const w = m.w * sc;
  const h = m.h * sc;
  const x = cx - w / 2;
  const y = cy - h / 2;
  const a = (1 - gone) * smooth(open, 0, 0.35);
  // the fish's light lingers on it a moment
  const flash = Math.exp(-Math.pow((t - m.open - 0.25) / 0.45, 2));
  goldGlow(ctx, cx, cy, Math.max(w, h) * 0.95, (0.55 * flash + 0.14) * (1 - fk));
  ctx.save();
  ctx.globalAlpha *= a;
  fillPoly(ctx, [[x, y], [x + w, y], [x + w, y + h], [x, y + h]], '#f1ebdf', 0.94);
  // contents, clipped to the frame
  const ca = smooth(open, 0.3, 0.85) * (1 - smooth(fk, 0, 0.6));
  if (ca > 0.01) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(x + 3, y + 3, w - 6, h - 6);
    ctx.clip();
    ctx.globalAlpha *= ca;
    ctx.translate(cx, cy);
    ctx.scale(sc * m.k, sc * m.k);
    ctx.translate(-cx, -cy);
    VIGNETTE[m.id](ctx, cx - m.dw / 2, cy - m.dh / 2, m.dw, m.dh, t - m.open, m.seed);
    ctx.restore();
  }
  const dash = fk > 0 ? [lerp(80, 6, clamp(fk * 1.5)), lerp(0, 14, clamp(fk * 1.5))] : undefined;
  border(ctx, x, y, w, h, open * 1.15, { w: 4, seed: m.seed, dash });
  ctx.restore();
}

// ------------------------------------------------------------ vignettes
// (x, y, w, h): the frame at design size; u: seconds since it opened
const VIGNETTE = {
  // 冰块: the afternoon his father took him to see ice
  ice(ctx, x, y, w, h, u, sd) {
    const g = y + h - 22;
    line(ctx, x - 10, g, x + w + 10, g, { w: 3, seed: sd + 10 });
    const ix = x + w * 0.66;
    iceBlock(ctx, ix, g - 34, 0.6);
    // father, tall, behind; the boy in front reaching out to touch it
    const fp = pose({ x: x + w * 0.2, y: standY(g, 0.53), s: 0.53, f: 1, lean: 0.08, head: 0.18, look: 0.6, aA1: 0.35, aA2: 0.5 });
    figure(ctx, fp, { id: 3, w: 3.4 });
    const touch = smooth(u, 0.2, 0.6) - 0.35 * smooth(u, 0.85, 1.0);
    const bp = pose({ x: x + w * 0.4, y: standY(g, 0.36), s: 0.36, f: 1, head: 0.1, look: 0.3 });
    const r = reach(bp, 'A', lerp(x + w * 0.46, ix - 34, touch), lerp(g - 48, g - 40, touch));
    Object.assign(bp, { aA1: r.a1, aA2: r.a2 });
    figure(ctx, bp, { id: 1, w: 3.2 });
    // the cold twinkle
    const tw = 0.5 + 0.5 * Math.sin(u * 6);
    sparkleInk(ctx, ix + 22, g - 70, 7 + 3 * tw, 0.8);
  },
  // 门口的小女孩: she stands in the bright doorway (s04) and tilts her head
  door(ctx, x, y, w, h, u, sd) {
    const g = y + h - 20;
    const dx0 = x + w * 0.3;
    const dx1 = x + w * 0.78;
    const dt = y + 26;
    fillPoly(ctx, [[dx0, dt], [dx1, dt], [dx1, g], [dx0, g]], 'rgba(255,251,240,0.95)', 1);
    path(ctx, [[dx0, g], [dx0, dt], [dx1, dt], [dx1, g]], { w: 3, seed: sd + 10 });
    line(ctx, x - 10, g, x + w + 10, g, { w: 3, seed: sd + 11 });
    const tilt = smooth(u, 0.4, 0.9);
    const p = pose({ x: (dx0 + dx1) / 2 + 2, y: standY(g, 0.54), s: 0.54, f: -1, head: -0.2 * tilt, look: -0.3 * tilt, aA1: 0.12, aB1: -0.1 });
    figure(ctx, p, { id: 2, bow: true, skirt: true, boots: true, w: 3 });
  },
  // 滚向门口的戒指: the ring rolls to the door; his patent boot stops it (s06)
  ring(ctx, x, y, w, h, u, sd) {
    const g = y + h - 26;
    line(ctx, x - 10, g, x + w + 10, g, { w: 3, seed: sd + 10 });
    const jx = x + w - 30;
    fillPoly(ctx, [[jx, y - 10], [x + w + 10, y - 10], [x + w + 10, g], [jx, g]], 'rgba(255,251,240,0.95)', 1);
    line(ctx, jx, y - 10, jx, g, { w: 3.2, seed: sd + 11 });
    const k = smooth(u, 0.0, 0.85, ease.out);
    const rr = 15;
    const stopX = jx - 62;
    const rx = lerp(x + 26, stopX, k);
    // a few motion ticks behind the rolling ring
    const mv = 1 - smooth(u, 0.6, 0.85);
    for (let i = 0; i < 3; i++) line(ctx, rx - rr - 10 - i * 11, g - rr - 8 + i * 8, rx - rr - 22 - i * 11, g - rr - 8 + i * 8, { w: 2, alpha: 0.55 * mv, seed: sd + 20 + i, wobble: 0 });
    ring(ctx, rx, g - rr - 2, rr, (rx - x) / rr * 0.6);
    // his leg comes down in front of it: a black patent boot with a shine
    const b = smooth(u, 0.4, 0.75, ease.out);
    const bx = stopX + rr + 16;
    const by = lerp(y + 10, g - 9, b);
    path(ctx, [[bx + 12, y - 12], [bx + 6, by - 30], [bx + 2, by - 6]], { w: 4.2, seed: sd + 12 });
    ellipse(ctx, bx - 4, by, 18, 9.5, { w: 2.4, fill: COL.ink, seed: sd + 13, wobble: 0.2 });
    dot(ctx, bx - 10, by - 3, 2.2, '#f4ecd8', 0.9);
  },
  // 早上的咖啡: the cup she set on his bench every morning
  coffee(ctx, x, y, w, h, u, sd) {
    const top = y + h - 44;
    path(ctx, [[x - 10, top], [x + w + 10, top + 2]], { w: 3.4, seed: sd + 10 });
    line(ctx, x - 10, top + 14, x + w + 10, top + 15, { w: 2, seed: sd + 11, alpha: 0.6 });
    coffeeCup(ctx, x + w * 0.44, top - 1, 1.55, u + 2);
    // morning light slanting in
    for (let i = 0; i < 3; i++) line(ctx, x + w - 24 - i * 20, y + 10, x + w - 64 - i * 20, y + 54, { w: 1.6, alpha: 0.4, seed: sd + 14 + i, wobble: 0 });
    // her small hand, just set the cup down, slowly drawing back
    const k = smooth(u, 0.35, 1.6);
    const hx = lerp(x + w * 0.62, x + w * 0.8, k);
    const hy = top - 8 - 10 * k;
    path(ctx, [[x + w + 14, top - 70 + 8 * k], [hx + 34, hy - 26], [hx + 4, hy]], { w: 3.4, seed: sd + 17 });
    dot(ctx, hx + 3, hy, 4, COL.ink);
  },
  // 她唱歌: her profile, eyes shut, notes rising
  song(ctx, x, y, w, h, u, sd) {
    const sw = 0.06 * Math.sin(u * 4.2);
    const p = pose({ x: x + w * 0.56, y: y + h + 88, s: 1.25, f: -1, lean: -0.06 + sw * 0.3, head: -0.18 + sw, look: -0.2, aA1: 0.05, aB1: -0.05 });
    const j = figure(ctx, p, { id: 2, bow: true, eye: 'closed', w: 3.8 });
    // an open mouth, singing
    const [hx, hy] = j.head;
    ellipse(ctx, hx - j.r * 0.78, hy + j.r * 0.42, 3.2, 3.8 + 1.2 * Math.sin(u * 8), { w: 1.8, seed: sd + 10, wobble: 0 });
    notes(ctx, hx - 86, hy - 4, (u * 0.55) % 1);
    notes(ctx, hx - 52, hy + 14, (u * 0.55 + 0.5) % 1);
  },
};

// ink four-point twinkle (the cold of the ice; no colour)
function sparkleInk(ctx, x, y, r, a) {
  line(ctx, x - r, y, x + r, y, { w: 1.6, alpha: a, wobble: 0, seed: 5590 });
  line(ctx, x, y - r, x, y + r, { w: 1.6, alpha: a, wobble: 0, seed: 5591 });
}

// ------------------------------------------------------------ the room at dusk
// The workshop of s04/s09 (same strokes and seeds), empty. apart(i) 0..1
// breaks line group i into drifting dashes and fades it.
const GROUPS = 9;
const CAN = [672, ROOM.floor - 150];
const CRU = [750, ROOM.floor - 172];
function room(ctx, t, apart) {
  const R = ROOM;
  const grp = (i, fn) => {
    const k = apart(i);
    if (k >= 1) return;
    const a = 1 - smooth(k, 0.35, 1);
    const dash = k > 0.01 ? [lerp(90, 5, clamp(k * 1.4)), lerp(0, 16, clamp(k * 1.4))] : undefined;
    const ang = hash(i * 7.7 + 3) * TAU;
    const dd = 26 * ease.in(k);
    ctx.save();
    ctx.translate(Math.cos(ang) * dd, Math.sin(ang) * dd - 10 * k);
    fn({ alpha: a, dash });
    ctx.restore();
  };
  // the doorway's last light
  grp(0, (o) => {
    ctx.save();
    ctx.globalAlpha *= 0.42 * o.alpha;
    const gr = ctx.createLinearGradient(R.x1, 0, R.x1 - 460, 0);
    gr.addColorStop(0, 'rgba(255,246,222,0.7)');
    gr.addColorStop(1, 'rgba(255,246,222,0)');
    ctx.fillStyle = gr;
    ctx.beginPath();
    ctx.moveTo(R.x1, R.doorTop);
    ctx.lineTo(R.x1, R.floor);
    ctx.lineTo(R.x1 - 460, R.floor);
    ctx.lineTo(R.x1 - 70, R.doorTop + 130);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255,250,236,0.75)';
    ctx.fillRect(R.x1, R.doorTop, W + 800 - R.x1, R.floor - R.doorTop);
    ctx.restore();
  });
  grp(1, (o) => {
    path(ctx, [[R.x1, R.doorTop], [R.x1, R.top], [R.x0, R.top], [R.x0, R.floor], [R.x1 + 260, R.floor]], { w: 5.5, seed: 4000, sketch: true, ...o });
  });
  grp(2, (o) => {
    line(ctx, R.x1 - 8, R.doorTop, R.x1 + 26, R.doorTop, { w: 5, seed: 4001, ...o });
    line(ctx, R.x1 + 22, R.doorTop - 4, R.x1 + 22, R.floor, { w: 3, seed: 4002, ...o, alpha: o.alpha * 0.55 });
  });
  // his tin can (empty) and the cold crucible on its stand (s09)
  grp(3, (o) => {
    const [cx, cy] = CAN;
    const s = 0.92;
    fillPoly(ctx, [[cx - 22 * s, cy - 50 * s], [cx + 22 * s, cy - 50 * s], [cx + 22 * s, cy], [cx - 22 * s, cy]], COL.paper, o.alpha);
    rect(ctx, cx - 22 * s, cy - 50 * s, 44 * s, 50 * s, { w: 3, seed: 3130, over: 1, ...o });
    ellipse(ctx, cx, cy - 50 * s, 22 * s, 6 * s, { w: 2.4, seed: 3131, ...o });
    const [x, y] = CRU;
    const top = ROOM.floor - 150;
    line(ctx, x - 20, y + 2, x - 26, top, { w: 3, seed: 9010, wobble: 0.3, ...o });
    line(ctx, x + 20, y + 2, x + 26, top, { w: 3, seed: 9011, wobble: 0.3, ...o });
    line(ctx, x - 24, y + 2, x + 24, y + 2, { w: 3, seed: 9012, wobble: 0.3, ...o });
    const k = 0.9;
    path(ctx, [[x - 28 * k, y - 40 * k], [x - 20 * k, y], [x + 20 * k, y], [x + 28 * k, y - 40 * k]], { w: 3.4, fill: COL.paper, seed: 3140, ...o });
  });
  grp(4, (o) => {
    for (let i = 0; i < 3; i++) {
      const x = 560 + i * 60;
      line(ctx, x, 380, x, 382, { w: 6, seed: 4030 + i, wobble: 0, ...o });
      path(ctx, [[x - 6, 384], [x - 9, 450], [x - 4, 460]], { w: 2.4, seed: 4040 + i, ...o, alpha: o.alpha * 0.8 });
      path(ctx, [[x + 6, 384], [x + 9, 450], [x + 4, 460]], { w: 2.4, seed: 4050 + i, ...o, alpha: o.alpha * 0.8 });
    }
  });
  grp(5, (o) => {
    const sx = 482;
    const seat = 780;
    line(ctx, sx - 30, seat, sx + 30, seat, { w: 4.5, seed: 4070, ...o });
    line(ctx, sx - 24, seat, sx - 28, R.floor, { w: 3.5, seed: 4071, ...o });
    line(ctx, sx + 24, seat, sx + 28, R.floor, { w: 3.5, seed: 4072, ...o });
  });
  // the bench (props.workbench, same seeds)
  grp(6, (o) => {
    const x = BENCH.x;
    const w = BENCH.w;
    const floor = R.floor;
    const top = floor - 150;
    fillPoly(ctx, [[x, top], [x + w, top], [x + w, top + 18], [x, top + 18]], COL.paper, o.alpha);
    rect(ctx, x, top, w, 18, { w: 4, seed: 3100, ...o });
    line(ctx, x + 16, top + 18, x + 20, floor, { w: 4, seed: 3101, ...o });
    line(ctx, x + w - 16, top + 18, x + w - 20, floor, { w: 4, seed: 3102, ...o });
    line(ctx, x + 20, floor - 46, x + w - 20, floor - 46, { w: 2.5, seed: 3103, ...o });
    const ax = x + w * BENCH.anvilAt;
    fillPoly(ctx, [[ax, top - 26], [ax + 46, top - 26], [ax + 46, top], [ax, top]], COL.paper, o.alpha);
    rect(ctx, ax, top - 26, 46, 26, { w: 3, seed: 3104, over: 2, ...o });
    path(ctx, [[ax - 6, top - 26], [ax + 52, top - 26]], { w: 4.5, seed: 3105, ...o });
  });
  // the lamp, gone out: base, an open glass chimney, a bare wick
  grp(7, (o) => {
    const x = BENCH.x + BENCH.w - 70;
    const y = R.floor - 150;
    const s = 1.1;
    path(ctx, [[x - 18 * s, y], [x + 18 * s, y], [x + 12 * s, y - 16 * s], [x - 12 * s, y - 16 * s]], { w: 3 * s, close: true, fill: COL.paper, seed: 3110, ...o });
    const side = (d) => [[x + d * 7 * s, y - 16 * s], [x + d * 13 * s, y - 28 * s], [x + d * 11 * s, y - 42 * s], [x + d * 6 * s, y - 52 * s]];
    path(ctx, side(-1), { w: 2.4 * s, seed: 3111, ...o });
    path(ctx, side(1), { w: 2.4 * s, seed: 3113, ...o });
    path(ctx, ellipsePts(x, y - 52 * s, 6 * s, 2 * s, 0, TAU, 10), { w: 1.8 * s, seed: 3114, ...o });
    path(ctx, [[x, y - 17 * s], [x + 1, y - 24 * s]], { w: 2 * s, seed: 3112, ...o });
  });
  // the hammer, laid down where he left it (s10)
  grp(8, (o) => {
    const anvil = ANVIL();
    const hx = anvil[0] + 66;
    const hy = R.floor - 150 - 6;
    path(ctx, [[hx, hy], [hx + 46, hy + 1]], { w: 3.4, seed: 3120, wobble: 0.3, ...o });
    path(ctx, [[hx + 46, hy - 12], [hx + 46, hy + 12], [hx + 56, hy + 12], [hx + 56, hy - 12]], { w: 3, close: true, fill: COL.ink, seed: 3121, wobble: 0.2, ...o });
  });
}
const APART_ORDER = [8, 3, 4, 5, 7, 6, 2, 0, 1]; // small things first, the room's frame last
function apartK(t, i) {
  const n = APART_ORDER.indexOf(i);
  const span = T_APART[1] - T_APART[0] - 0.75;
  const t0 = T_APART[0] + (n / (GROUPS - 1)) * span;
  return smooth(t, t0, t0 + 0.75);
}

// ------------------------------------------------------------ the fish
// props.goldFish's drawing (same shape, strokes and seeds), with the ink and
// the gold separable: o.ink 0..1 fades the outline (o.dash breaks it up),
// o.gold 0..1 the fill; o.dull drains the gold toward a warm grey.
function mixHex(a, b, k) {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return `rgb(${pa.map((v, i) => Math.round(lerp(v, pb[i], k))).join(',')})`;
}
function fish(ctx, s, o = {}) {
  const P = (px, py) => [px * s, py * s];
  const seed = 4200;
  const w = Math.max(1.4, 2.4 * s);
  const dull = clamp(o.dull ?? 0);
  const gold = o.gold ?? 1;
  const ink = o.ink ?? 1;
  const body = [];
  for (let i = 0; i <= 14; i++) {
    const u = i / 14;
    body.push(P(lerp(30, -16, u), -Math.sin(u * Math.PI) * 13 * (1 - 0.25 * u)));
  }
  for (let i = 0; i <= 14; i++) {
    const u = i / 14;
    body.push(P(lerp(-16, 30, u), Math.sin((1 - u) * Math.PI) * 12 * (1 - 0.25 * (1 - u))));
  }
  const tail = [P(-14, 0), P(-32, -14), P(-27, 0), P(-32, 14), P(-14, 0)];
  if (gold > 0.001) {
    const fill = dull > 0 ? mixHex(GOLD, '#a49b8a', dull) : GOLD;
    fillPoly(ctx, tail, fill, gold);
    fillPoly(ctx, body, fill, gold);
    fillPoly(ctx, body.slice(15), dull > 0 ? mixHex(GOLD_DEEP, '#8c8476', dull) : GOLD_DEEP, 0.35 * gold);
  }
  if (ink > 0.001) {
    const st = { w, wobble: 0.35, alpha: ink, dash: o.dash };
    path(ctx, tail, { ...st, seed });
    path(ctx, body, { ...st, close: true, seed: seed + 1 });
    path(ctx, [P(16, -9), P(13, 0), P(16, 9)], { ...st, w: w * 0.7, seed: seed + 2, wobble: 0.2 });
    path(ctx, [P(4, -6), P(1, 0), P(4, 6)], { ...st, w: w * 0.55, seed: seed + 3, wobble: 0.2, alpha: ink * 0.7 });
    path(ctx, [P(-6, -6), P(-9, 0), P(-6, 6)], { ...st, w: w * 0.55, seed: seed + 4, wobble: 0.2, alpha: ink * 0.7 });
    path(ctx, [P(8, -12), P(0, -19), P(-6, -11)], { ...st, w: w * 0.7, seed: seed + 5, wobble: 0.2 });
    const e = P(22, -3);
    dot(ctx, e[0], e[1], Math.max(1.3, 2.4 * s), COL.ink, ink);
  }
  if (o.glint) {
    const g = P(10, -10);
    sparkle(ctx, g[0], g[1], 14 * s * o.glint, o.glint * Math.max(gold, ink));
  }
}

function fishPose(t) {
  const s0 = FISH_ON_NAIL.s;
  const hang = [NAIL[0], NAIL[1] + 3 + FISH_ON_NAIL.len + 30 * s0];
  // grows a little as it comes alive
  const s = lerp(s0, FISH_S, smooth(t, T_SLIP, T_GO + 1.3));
  if (t < T_GO) {
    const wr = smooth(t, T_WRIGGLE, T_WRIGGLE + 0.1) * (1 - smooth(t, T_SLIP + 0.05, T_GO + 0.05));
    const drop = smooth(t, T_SLIP, T_GO, ease.in) * 12;
    return { x: hang[0] + Math.sin(t * 40) * 2.5 * wr, y: hang[1] + drop, flip: 1, pitch: -Math.PI / 2 + 0.28 * Math.sin(t * 31) * wr, s, onChain: t < T_SLIP };
  }
  const d = dist(t);
  const [x, y] = at(d);
  const a0 = at(d - 8);
  const a1 = at(d + 8);
  const vx = a1[0] - a0[0];
  const vy = a1[1] - a0[1];
  const vl = Math.hypot(vx, vy);
  const moving = clamp(vl / 6);
  // facing: right while vx > 0, squeezed edge-on through a turn
  const dirx = vl > 1e-3 ? vx / vl : 1;
  const flip = clamp(Math.tanh(dirx * 3.2) * 1.08, -1, 1);
  let pitch = clamp(Math.atan2(vy, Math.abs(vx) + 1e-6), -1.25, 1.25) * moving;
  // turn smoothly from hanging mouth-up to the swim
  const turn = smooth(t, T_GO, T_GO + 0.4);
  pitch = lerp(-Math.PI / 2, pitch, turn) + 0.07 * Math.sin(t * 8.5) * moving;
  // at rest: level, facing the doorway, a slow hover that stills as it fades
  const rest = smooth(t, T_REST - 0.7, T_REST + 0.3);
  const still = smooth(t, T_INK[0], T_GONE[1]);
  const hx = (6 * Math.sin((t - T_REST) * 1.1) + 2.5 * Math.sin((t - T_REST) * 2.3)) * rest * (1 - still);
  const hy = (5 * Math.sin((t - T_REST) * 1.6 + 0.5)) * rest * (1 - 0.7 * still) + 6 * still;
  pitch = lerp(pitch, 0.05 * Math.sin(t * 1.9) * (1 - still) + 0.06 * still, rest);
  const fl = lerp(flip, 1, rest);
  return { x: x + hx, y: y + hy, flip: fl, pitch, s, onChain: false, d };
}

function drawFish(ctx, fp, o) {
  ctx.save();
  ctx.translate(fp.x, fp.y);
  const f = Math.abs(fp.flip) < 0.06 ? 0.06 * Math.sign(fp.flip || 1) : fp.flip;
  ctx.scale(f, 1);
  ctx.rotate(fp.pitch);
  fish(ctx, fp.s, o);
  ctx.restore();
}

// ------------------------------------------------------------ the shot
function cam(t) {
  return keys(t, [
    [59.2, { x: 800, y: 572, z: 2.15 }],
    [60.55, { x: 805, y: 566, z: 2.25 }],
    [62.35, { x: 898, y: 446, z: 1.3 }],
    [63.7, { x: 898, y: 448, z: 1.26 }],
    [65.6, { x: 896, y: 452, z: 1.36 }],
    [68.4, { x: REST_AT[0], y: REST_AT[1] + 4, z: 2.7 }],
  ], ease.inOut);
}

export function memory(ctx, t) {
  const fp = fishPose(t);
  // fish light: lights up on the nail, glows while it swims, drains at the end
  const light = smooth(t, T_GLINT, T_GLINT + 0.6);
  const ink = 1 - smooth(t, T_INK[0], T_INK[1]);
  const dim = smooth(t, T_DIM[0], T_DIM[1], ease.sine);
  const gone = smooth(t, T_GONE[0], T_GONE[1], ease.sine);
  // dusk: the room is dimmer than the frames, and lifts as the room comes apart
  const dusk = 1 - smooth(t, T_APART[0] + 0.4, T_APART[1]);
  if (dusk > 0.01) {
    ctx.save();
    ctx.fillStyle = `rgba(48,38,28,${0.1 * dusk})`;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
  camera(ctx, cam(t), () => {
    room(ctx, t, (i) => apartK(t, i));
    // nail and chain (the chain stays behind, swinging, when the fish slips off)
    const na = 1 - smooth(apartK(t, 8), 0.2, 1);
    if (na > 0) {
      nail(ctx, { alpha: na });
      const sl = t - T_SLIP;
      const sw = sl > 0 ? Math.sin(sl * 7) * 0.32 * Math.exp(-sl * 1.6) : 0;
      const L = FISH_ON_NAIL.len - (sl > 0 ? 6 * smooth(t, T_SLIP, T_SLIP + 0.15) : 0);
      const ex = NAIL[0] + Math.sin(sw) * L;
      const ey = NAIL[1] + 3 + Math.cos(sw) * L;
      if (fp.onChain) chain(ctx, NAIL[0], NAIL[1] + 3, fp.x, fp.y - 30 * fp.s, { alpha: na });
      else chain(ctx, NAIL[0], NAIL[1] + 3, ex, ey, { alpha: na });
    }
    // the memories
    for (const m of MEM) memFrame(ctx, m, t);
    // a faint gold wake behind the swimming fish
    if (t > T_GO && t < T_REST + 0.6) {
      for (let i = 1; i <= 10; i++) {
        const tt = t - i * 0.06;
        if (tt < T_GO) break;
        const [wx, wy] = at(dist(tt));
        const a = (1 - i / 11) * 0.6 * (1 - smooth(t, T_REST - 0.5, T_REST + 0.5));
        dot(ctx, wx + Math.sin(i * 2.3) * 4, wy + Math.cos(i * 1.7) * 4, 3.6 - i * 0.25, GOLD, a);
      }
    }
    const fa = 1 - gone;
    if (fa > 0.001) {
      const glowA = (0.35 + 0.55 * light) * (1 - 0.75 * dim);
      const glowR = lerp(70, 220, light) * lerp(1, 0.45, dim);
      goldGlow(ctx, fp.x, fp.y, glowR, glowA * fa);
      const tw = Math.max(0, Math.sin((t - T_GLINT) * 2.6));
      const glint = (t < T_GLINT ? 0.15 : 0.35 + 0.65 * tw) * (1 - smooth(t, T_INK[0] - 0.3, T_INK[0] + 0.3));
      // the ink breaks into dashes and lifts off; the gold stays
      const dk = 1 - ink;
      const dash = dk > 0.01 ? [lerp(60, 3, clamp(dk * 1.3)), lerp(0, 9, clamp(dk * 1.3))] : undefined;
      drawFish(ctx, fp, { ink, dash, gold: fa, dull: dim * 0.7, glint });
      // the moment it lights up: a bright sparkle
      const flash = Math.exp(-Math.pow((t - T_GLINT - 0.12) / 0.16, 2));
      if (flash > 0.02) sparkle(ctx, fp.x - 6, fp.y - 12, 26 * flash, flash);
      // a last sparkle once everything else has gone
      const last = Math.exp(-Math.pow((t - 66.35) / 0.2, 2));
      if (last > 0.02) sparkle(ctx, fp.x + 8 * fp.s, fp.y - 10 * fp.s, 22 * last, last * 0.9);
    }
  });
}

// where the fish hangs on screen as s11 fades in (s10 ends with his chest there)
export function fishOnScreen() {
  const c = cam(59.8);
  const fx = NAIL[0];
  const fy = NAIL[1] + 3 + FISH_ON_NAIL.len + 30 * FISH_ON_NAIL.s;
  return [960 + (fx - c.x) * c.z, 540 + (fy - c.y) * c.z];
}

export default {
  fadeIn: 0.9,
  fadeOut: 0, // s12 continues the same shot
  draw(ctx, lt, info) {
    memory(ctx, info.t);
  },
};
