// Props for 我还是想被看见. Ink on paper; light is handled by light.js.
import { COL, TAU, clamp, lerp, hash, path, line, rect, circle, ellipse, fillPoly, dot, text, FONT } from './lib.js';
import { figure, pose, BODY, LEG } from './figure.js';

// ------------------------------------------------------------ desk + laptop
// Plain table, side view. x: centre, floor: floor y. Returns the top y.
export function table(ctx, x, floor, s = 1, o = {}) {
  const top = floor - 150 * s;
  const hw = (o.hw ?? 120) * s;
  const w = o.w ?? 4.2;
  path(ctx, [[x - hw, top], [x + hw, top]], { w: w * 1.2, alpha: o.alpha, seed: o.seed ?? 5100 });
  line(ctx, x - hw + 12 * s, top, x - hw + 14 * s, floor, { w, alpha: o.alpha, seed: (o.seed ?? 5100) + 1 });
  line(ctx, x + hw - 12 * s, top, x + hw - 14 * s, floor, { w, alpha: o.alpha, seed: (o.seed ?? 5100) + 2 });
  return top;
}

// Stool, side view. Returns the seat y (hip y = seat - 3*s for SIT).
export function stool(ctx, x, floor, s = 1, o = {}) {
  const seat = floor - 92 * s;
  const hw = 30 * s;
  const w = o.w ?? 4;
  line(ctx, x - hw, seat, x + hw, seat, { w: w * 1.15, alpha: o.alpha, seed: (o.seed ?? 5110) });
  line(ctx, x - hw * 0.7, seat, x - hw, floor, { w, alpha: o.alpha, seed: (o.seed ?? 5110) + 1 });
  line(ctx, x + hw * 0.7, seat, x + hw, floor, { w, alpha: o.alpha, seed: (o.seed ?? 5110) + 2 });
  return seat;
}

// Laptop on a table, side view.
//   hx: x of the hinge (the end away from the user); top: table-top y
//   f: the way the USER faces (the user sits at hx - f*...; the screen faces -f)
//   open: 0 = shut, 1 = open
// Returns { hinge, lidEnd, screen: [x, y] (centre of the lit face, nudged
// toward the user), base: [x0, x1] }.
export function laptop(ctx, hx, top, s = 1, f = 1, open = 1, o = {}) {
  const L = 96 * s;
  const th = 6 * s;
  const seed = o.seed ?? 5200;
  const w = o.w ?? 3.6;
  const bx = hx - f * L;
  // base (keyboard)
  path(ctx, [[bx, top - 1], [hx, top - 1], [hx, top - th], [bx + f * 4 * s, top - th]], { w, close: true, fill: COL.paper, alpha: o.alpha, seed, wobble: 0.4 });
  // lid: closed lies on the base pointing at the user; open stands up, tilted back
  const a = clamp(open) * 1.86;
  const ex = hx - f * Math.cos(a) * L;
  const ey = top - th - Math.sin(a) * L;
  const hinge = [hx, top - th];
  path(ctx, [hinge, [ex, ey]], { w: w * 1.5, alpha: o.alpha, seed: seed + 1, wobble: 0.4 });
  // the screen face: a thin pale strip on the user's side of the lid when open
  const mid = [(hinge[0] + ex) / 2, (hinge[1] + ey) / 2];
  const screen = [mid[0] - f * 10 * s * Math.sin(a), mid[1] + 2 * s];
  if (open > 0.15 && o.glow !== false) {
    const k = (o.glow ?? 1) * clamp((open - 0.15) / 0.4);
    const p1 = [lerp(hinge[0], ex, 0.1) - f * 3 * s, lerp(hinge[1], ey, 0.1)];
    const p2 = [lerp(hinge[0], ex, 0.92) - f * 3 * s, lerp(hinge[1], ey, 0.92)];
    path(ctx, [p1, p2], { w: 4 * s, color: '#fbf8f0', alpha: 0.9 * k * (o.alpha ?? 1), seed: seed + 2, wobble: 0 });
  }
  return { hinge, lidEnd: [ex, ey], screen, base: [bx, hx] };
}

// A monitor seen from the front: a frame with a lit face; content(ctx, x, y, w, h)
// draws whatever is on it (clipped). For close-ups and the editing timeline.
export function screenFront(ctx, x, y, w, h, o = {}) {
  const seed = o.seed ?? 5300;
  fillPoly(ctx, [[x, y], [x + w, y], [x + w, y + h], [x, y + h]], o.face ?? '#f6f2ea', o.alpha ?? 1);
  if (o.content) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    o.content(ctx, x, y, w, h);
    ctx.restore();
  }
  rect(ctx, x - 10, y - 10, w + 20, h + 20, { w: o.w ?? 5, alpha: o.alpha, seed });
  if (o.stand !== false) {
    path(ctx, [[x + w / 2, y + h + 10], [x + w / 2, y + h + 60]], { w: (o.w ?? 5) * 1.2, alpha: o.alpha, seed: seed + 1 });
    path(ctx, [[x + w / 2 - 70, y + h + 62], [x + w / 2 + 70, y + h + 62]], { w: o.w ?? 5, alpha: o.alpha, seed: seed + 2 });
  }
}

// --------------------------------------------------------------- the number
// The number he chases: a view counter. n: the value; o.delta: + rising
// (an up-arrow beside it), - falling, 0 stalled. o.size, o.alpha, o.color.
export function formatCount(n) {
  n = Math.max(0, Math.round(n));
  if (n >= 10000) return `${(n / 10000).toFixed(1)}万`;
  return n.toLocaleString('en-US');
}

export function counter(ctx, x, y, n, o = {}) {
  const size = o.size ?? 64;
  const str = typeof n === 'string' ? n : formatCount(n);
  text(ctx, str, x, y, { size, alpha: o.alpha, color: o.color ?? COL.ink, spacing: 2 });
  const d = o.delta ?? 0;
  if (d) {
    ctx.save();
    ctx.font = `${size}px ${FONT}`;
    const tw = ctx.measureText(str).width;
    ctx.restore();
    text(ctx, d > 0 ? '▲' : '▼', x + tw / 2 + size * 0.45, y, { size: size * 0.5, alpha: (o.alpha ?? 1) * Math.min(1, Math.abs(d)), color: o.color ?? COL.ink });
  }
}

// ------------------------------------------------------------- paper balls
// A crumpled sheet: a lumpy circle with a few creases. seed picks its shape.
export function paperBall(ctx, x, y, r, seed = 0, o = {}) {
  const n = 9;
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + hash(seed * 3.1 + i) * 0.4;
    const rr = r * (0.82 + 0.3 * hash(seed * 7.7 + i * 1.3));
    pts.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr]);
  }
  path(ctx, pts, { w: o.w ?? Math.max(1.6, r * 0.13), close: true, fill: COL.paper, alpha: o.alpha, seed: 5400 + seed * 7, wobble: 0.3 });
  for (let k = 0; k < 2; k++) {
    const a = hash(seed * 5.3 + k) * TAU;
    const c = [x + Math.cos(a) * r * 0.15, y + Math.sin(a) * r * 0.15];
    path(ctx, [[c[0] - Math.cos(a + 1) * r * 0.5, c[1] - Math.sin(a + 1) * r * 0.5], c, [c[0] + Math.cos(a - 0.6) * r * 0.45, c[1] + Math.sin(a - 0.6) * r * 0.45]], {
      w: Math.max(1, r * 0.07), alpha: (o.alpha ?? 1) * 0.7, seed: 5401 + seed * 7 + k, wobble: 0.2,
    });
  }
}

// ------------------------------------------------------------------ crowds
// One front-view onlooker. ground: floor y. t: seconds (drives clapping).
//   o.mode: 'clap' | 'cheer' | 'idle' | 'thumb' | 'turn' (walking away)
//   o.k: 0..1 how much of the mode (blend from idle); o.ph: phase offset
//   o.id, o.alpha, o.w
export function onlooker(ctx, x, ground, s, t, o = {}) {
  const ph = o.ph ?? 0;
  const k = o.k ?? 1;
  const m = o.mode ?? 'clap';
  const p = pose({ x, y: ground - LEG * s, s, view: o.back ? 'back' : 'front' });
  p.aA1 = 0.16;
  p.aB1 = 0.16;
  p.aA2 = 0.05;
  p.aB2 = 0.05;
  p.lA1 = 0.08;
  p.lB1 = 0.08;
  if (m === 'clap') {
    const c = 0.5 + 0.5 * Math.sin((t * 2.6 + ph) * TAU);
    // elbows low, forearms up and in: hands meet in front of the chest
    p.aA1 = lerp(0.16, 0.38, k);
    p.aB1 = lerp(0.16, 0.38, k);
    p.aA2 = lerp(0.05, -3.05 + 0.42 * c, k);
    p.aB2 = lerp(0.05, -3.05 + 0.42 * c, k);
    p.y -= 2 * s * c * k;
  } else if (m === 'cheer') {
    const b = Math.sin((t * 2.2 + ph) * TAU);
    p.aA1 = lerp(0.16, 2.55 + 0.12 * b, k);
    p.aB1 = lerp(0.16, 2.55 - 0.12 * b, k);
    p.aA2 = lerp(0.05, 0.25, k);
    p.aB2 = lerp(0.05, 0.25, k);
    p.y -= 6 * s * Math.max(0, b) * k;
  } else if (m === 'thumb') {
    // one arm raised out to the side, fist up
    p.aB1 = lerp(0.16, 0.8, k);
    p.aB2 = lerp(0.05, 1.5, k);
  }
  p.head = (o.head ?? 0) + 0.04 * Math.sin((t * 0.7 + ph) * TAU) * (m === 'idle' ? 1 : 0.3);
  p.turn = o.turn ?? 0;
  const j = figure(ctx, p, { id: o.id ?? 60, alpha: o.alpha, w: o.w, eye: o.eye ?? 'dot', mouth: o.mouth });
  if (m === 'thumb' && k > 0.5) thumbUp(ctx, j.handB[0], j.handB[1], s, { alpha: o.alpha });
  return j;
}

// A row of onlookers between x0 and x1. n people; seed varies size, spacing,
// clapping phase. o: same as onlooker plus o.sMin/o.sMax and o.back.
export function crowd(ctx, x0, x1, ground, n, t, o = {}) {
  const seed = o.seed ?? 1;
  const out = [];
  for (let i = 0; i < n; i++) {
    const u = n === 1 ? 0.5 : i / (n - 1);
    const x = lerp(x0, x1, u) + (hash(seed * 13 + i) - 0.5) * ((x1 - x0) / Math.max(1, n)) * 0.5;
    const s = lerp(o.sMin ?? 0.5, o.sMax ?? 0.62, hash(seed * 31 + i * 2.3));
    const k = o.kFn ? o.kFn(i, u) : o.k ?? 1;
    out.push(onlooker(ctx, x, ground + (hash(seed * 5 + i) - 0.5) * (o.jitterY ?? 10), s, t, {
      ...o, k, ph: hash(seed * 17 + i), id: 60 + seed * 20 + i,
    }));
  }
  return out;
}

// A thumbs-up at a hand position: a small fist and the thumb pointing up.
export function thumbUp(ctx, x, y, s = 1, o = {}) {
  const r = 7 * s;
  ellipse(ctx, x, y, r, r * 0.85, { w: Math.max(1.4, 3 * s), fill: COL.paper, alpha: o.alpha, seed: o.seed ?? 5500, wobble: 0.2 });
  path(ctx, [[x - r * 0.2, y - r * 0.7], [x - r * 0.1, y - r * 2.1]], { w: Math.max(1.6, 3.6 * s), alpha: o.alpha, seed: (o.seed ?? 5500) + 1, wobble: 0.1 });
}

// ---------------------------------------------------------------- lights
// A lamp on a pole by the road (side view), its head aimed at (ax, ay).
// Returns the beam source [x, y] for a stage() spot.
export function standLamp(ctx, x, ground, h, ax, ay, o = {}) {
  const seed = o.seed ?? 5600;
  const top = ground - h;
  path(ctx, [[x, ground], [x, top]], { w: o.w ?? 4, alpha: o.alpha, seed });
  path(ctx, [[x - 26, ground], [x + 26, ground]], { w: o.w ?? 4, alpha: o.alpha, seed: seed + 1 });
  const a = Math.atan2(ay - top, ax - x);
  const hx = x + Math.cos(a) * 20;
  const hy = top + Math.sin(a) * 20;
  // a small can, open end toward the target
  const c = Math.cos(a);
  const sn = Math.sin(a);
  const P = (u, v) => [x + u * c - v * sn, top + u * sn + v * c];
  path(ctx, [P(-10, -12), P(26, -16), P(26, 16), P(-10, 12)], { w: 3, close: true, fill: COL.ink, alpha: o.alpha, seed: seed + 2, wobble: 0.2 });
  return [hx + c * 10, hy + sn * 10];
}

// Ground line across the frame with a few pencil marks.
export function ground(ctx, x0, x1, y, o = {}) {
  path(ctx, [[x0, y], [x1, y]], { w: o.w ?? 3.6, alpha: o.alpha, seed: o.seed ?? 5700, wobble: 0.8 });
  if (o.ticks !== false) {
    const n = Math.floor((x1 - x0) / 140);
    for (let i = 0; i < n; i++) {
      const x = x0 + (i + 0.5) * 140 + (hash(i * 3.7 + (o.seed ?? 0)) - 0.5) * 60;
      path(ctx, [[x, y + 14 + hash(i) * 10], [x + 24 + hash(i * 2) * 20, y + 14 + hash(i) * 10]], { w: 2, color: COL.pencil, alpha: o.alpha, seed: (o.seed ?? 5700) + 10 + i, wobble: 0.3 });
    }
  }
}

export { BODY, LEG };
