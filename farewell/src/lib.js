// Ink-on-paper drawing primitives for the stick-figure series.
// Every draw call is a pure function of the frame time, so any frame can be
// rendered on its own (the renderer seeks frame by frame).
//
// Conventions
// - Canvas is 1920x1080, origin top-left.
// - Lines "boil" like hand-drawn animation: the wobble pattern changes
//   BOIL_FPS times a second. Pass {still:true} (or call setStill) to freeze it.
// - Each stroke gets a seed from a per-frame counter. If a scene draws a
//   varying number of strokes (particles, rain), pass {seed} explicitly or
//   {wobble:0} so the strokes after it keep stable seeds.

export const W = 1920;
export const H = 1080;
export const BOIL_FPS = 8;

export const COL = {
  paper: '#e8e2d6',
  paperShade: '#ddd5c6',
  ink: '#1f1c19',
  inkSoft: 'rgba(31,28,25,0.5)',
  pencil: 'rgba(31,28,25,0.22)',
  gold: '#d39b33',
  goldSoft: 'rgba(211,155,51,0.35)',
  orange: '#ee8423',
  orangeSoft: 'rgba(238,132,35,0.35)',
  sepia: '#a88d66',
  sky: 'rgba(31,28,25,0.06)',
};

export const FONT = '"WenKai", "WenQuanYi Zen Hei", serif';

// ---------------------------------------------------------------- time math
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, k) => a + (b - a) * k;
export const TAU = Math.PI * 2;

export const ease = {
  linear: (k) => k,
  in: (k) => k * k,
  out: (k) => 1 - (1 - k) * (1 - k),
  inOut: (k) => (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2),
  sine: (k) => 0.5 - 0.5 * Math.cos(Math.PI * k),
  in3: (k) => k * k * k,
  out3: (k) => 1 - Math.pow(1 - k, 3),
  outBack: (k) => {
    const c = 1.5;
    return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2);
  },
};

// 0..1 linear progress of t through [a, b]
export const prog = (t, a, b) => clamp((t - a) / (b - a));
// eased (in-out) progress of t through [a, b]
export const smooth = (t, a, b, e = ease.inOut) => e(prog(t, a, b));
// 0 -> 1 -> 0 envelope: fades in over [a, a+fi], out over [b-fo, b]
export const env = (t, a, b, fi = 0.4, fo = 0.4) =>
  Math.min(smooth(t, a, a + fi), 1 - smooth(t, b - fo, b));

// Piecewise keyframes: keys(t, [[t0, v0], [t1, v1], ...], easeFn)
// Values may be numbers or objects of numbers (interpolated per key).
export function keys(t, kf, e = ease.inOut) {
  if (t <= kf[0][0]) return kf[0][1];
  for (let i = 0; i < kf.length - 1; i++) {
    const [t0, v0] = kf[i];
    const [t1, v1] = kf[i + 1];
    if (t <= t1) {
      const k = e(prog(t, t0, t1));
      if (typeof v0 === 'number') return lerp(v0, v1, k);
      const out = { ...v0 };
      for (const key in v1) {
        if (typeof v0[key] === 'number' && typeof v1[key] === 'number') out[key] = lerp(v0[key], v1[key], k);
        else if (k >= 0.5) out[key] = v1[key];
      }
      return out;
    }
  }
  return kf[kf.length - 1][1];
}

// ------------------------------------------------------------------- noise
export function hash(n) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
  return x - Math.floor(x);
}
export const hash2 = (a, b) => hash(a * 57.31 + b * 113.97);

// deterministic PRNG: const r = rng(42); r() -> [0,1)
export function rng(seed) {
  let s = (Math.floor(seed * 9301 + 49297) >>> 0) || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// smooth 1D value noise in [-1, 1]
export function noise1(x, seed = 0) {
  const i = Math.floor(x);
  const f = x - i;
  const u = f * f * (3 - 2 * f);
  return lerp(hash2(i, seed), hash2(i + 1, seed), u) * 2 - 1;
}

// ------------------------------------------------------------- frame state
export const F = { t: 0, boil: 0, stroke: 0, still: false };

export function beginFrame(t) {
  F.t = t;
  F.boil = Math.floor(t * BOIL_FPS + 1e-6);
  F.stroke = 0;
  F.still = false;
}

// Freeze (or unfreeze) the line boil for subsequent strokes.
export function setStill(v) {
  F.still = v;
}

// ----------------------------------------------------------------- strokes
function resample(pts, step) {
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[i + 1];
    const len = Math.hypot(x1 - x0, y1 - y0);
    const n = Math.max(1, Math.ceil(len / step));
    for (let j = 0; j < n; j++) {
      const k = j / n;
      out.push([lerp(x0, x1, k), lerp(y0, y1, k)]);
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}

function wobblePts(pts, o) {
  const amp = o.wobble ?? 1.4;
  if (amp <= 0 || pts.length < 2) return pts;
  const seed = o.seed ?? F.stroke++;
  const boil = o.still || F.still ? 0 : F.boil;
  const sd = seed * 13.37 + boil * 101.3;
  const rs = resample(pts, 9);
  const out = [];
  let dist = 0;
  for (let i = 0; i < rs.length; i++) {
    const [x, y] = rs[i];
    const p = rs[Math.max(0, i - 1)];
    const q = rs[Math.min(rs.length - 1, i + 1)];
    let nx = -(q[1] - p[1]);
    let ny = q[0] - p[0];
    const nl = Math.hypot(nx, ny) || 1;
    nx /= nl;
    ny /= nl;
    if (i > 0) dist += Math.hypot(x - rs[i - 1][0], y - rs[i - 1][1]);
    const d = amp * (noise1(dist / 55, sd) + 0.45 * noise1(dist / 17, sd + 7.1));
    out.push([x + nx * d, y + ny * d]);
  }
  return out;
}

function applyStyle(ctx, o) {
  ctx.lineWidth = o.w ?? 4.5;
  ctx.strokeStyle = o.color ?? COL.ink;
  ctx.lineCap = o.cap ?? 'round';
  ctx.lineJoin = 'round';
  ctx.setLineDash(o.dash ?? []);
  if (o.dash) ctx.lineDashOffset = o.dashOffset ?? 0;
}

function tracePts(ctx, pts, close) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  if (pts.length === 2) {
    ctx.lineTo(pts[1][0], pts[1][1]);
  } else {
    for (let i = 1; i < pts.length - 1; i++) {
      const mx = (pts[i][0] + pts[i + 1][0]) / 2;
      const my = (pts[i][1] + pts[i + 1][1]) / 2;
      ctx.quadraticCurveTo(pts[i][0], pts[i][1], mx, my);
    }
    const last = pts[pts.length - 1];
    ctx.lineTo(last[0], last[1]);
  }
  if (close) ctx.closePath();
}

// Partial path: keep the first `k` (0..1) of a polyline's length. Useful for
// "drawing on" a line.
export function trimPts(pts, k, from = 0) {
  if (k >= 1 && from <= 0) return pts;
  let total = 0;
  const seg = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const l = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]);
    seg.push(l);
    total += l;
  }
  const a = clamp(from) * total;
  const b = clamp(k) * total;
  const out = [];
  let acc = 0;
  for (let i = 0; i < seg.length; i++) {
    const s0 = acc;
    const s1 = acc + seg[i];
    const lo = Math.max(a, s0);
    const hi = Math.min(b, s1);
    if (hi > lo) {
      const p = (d) => [
        lerp(pts[i][0], pts[i + 1][0], seg[i] ? (d - s0) / seg[i] : 0),
        lerp(pts[i][1], pts[i + 1][1], seg[i] ? (d - s0) / seg[i] : 0),
      ];
      if (!out.length) out.push(p(lo));
      out.push(p(hi));
    }
    acc = s1;
  }
  return out.length >= 2 ? out : null;
}

// Draw an open (or closed with o.close) hand-drawn polyline.
// o: {w, color, alpha, wobble, seed, still, dash, close, fill, sketch, draw}
//   draw: 0..1 draws only the first part of the path (for "drawing on")
//   sketch: also draws a faint second pass offset a little, pencil style
export function path(ctx, pts, o = {}) {
  if (!pts || pts.length < 2) return;
  let base = pts;
  if (o.close) base = [...pts, pts[0]];
  if (o.draw !== undefined && o.draw < 1) {
    if (o.draw <= 0) {
      if (o.seed === undefined && (o.wobble ?? 1) > 0) F.stroke++;
      return;
    }
    base = trimPts(base, o.draw);
    if (!base) return;
  }
  const wp = wobblePts(base, o);
  ctx.save();
  if (o.alpha !== undefined) ctx.globalAlpha *= o.alpha;
  if (o.fill) {
    ctx.fillStyle = o.fill;
    tracePts(ctx, wp, true);
    ctx.fill();
  }
  if (o.w !== 0) {
    applyStyle(ctx, o);
    tracePts(ctx, wp, false);
    ctx.stroke();
    if (o.sketch) {
      const wp2 = wobblePts(base, { ...o, seed: (o.seed ?? F.stroke) + 977, wobble: (o.wobble ?? 1.4) * 1.8 });
      ctx.globalAlpha *= 0.35;
      ctx.lineWidth = (o.w ?? 4.5) * 0.45;
      tracePts(ctx, wp2, false);
      ctx.stroke();
    }
  }
  ctx.restore();
}

export function line(ctx, x1, y1, x2, y2, o = {}) {
  path(ctx, [
    [x1, y1],
    [x2, y2],
  ], o);
}

// Sketchy rectangle: four strokes whose ends overshoot the corners a little.
// o.over: overshoot in px (default 5). o.fill paints the inside first.
export function rect(ctx, x, y, w, h, o = {}) {
  if (o.fill) {
    ctx.save();
    if (o.alpha !== undefined) ctx.globalAlpha *= o.alpha;
    ctx.fillStyle = o.fill;
    ctx.fillRect(x, y, w, h);
    ctx.restore();
  }
  if (o.w === 0) return;
  const ov = o.over ?? 5;
  const so = { ...o, fill: undefined, close: false };
  const base = o.seed;
  const sd = (i) => (base === undefined ? undefined : base * 7 + i);
  path(ctx, [[x - ov, y], [x + w + ov * 0.4, y]], { ...so, seed: sd(0) });
  path(ctx, [[x + w, y - ov * 0.4], [x + w, y + h + ov]], { ...so, seed: sd(1) });
  path(ctx, [[x + w + ov, y + h], [x - ov * 0.4, y + h]], { ...so, seed: sd(2) });
  path(ctx, [[x, y + h + ov * 0.4], [x, y - ov]], { ...so, seed: sd(3) });
}

export function ellipsePts(cx, cy, rx, ry, a0 = 0, a1 = TAU, n) {
  const steps = n ?? Math.max(12, Math.ceil(((Math.max(rx, ry) * Math.abs(a1 - a0)) / 14)));
  const out = [];
  for (let i = 0; i <= steps; i++) {
    const a = lerp(a0, a1, i / steps);
    out.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
  }
  return out;
}

// Slightly imperfect circle; the stroke overlaps its start a touch, as drawn by hand.
export function circle(ctx, cx, cy, r, o = {}) {
  ellipse(ctx, cx, cy, r, r, o);
}

export function ellipse(ctx, cx, cy, rx, ry, o = {}) {
  const start = o.start ?? -2.2;
  const pts = ellipsePts(cx, cy, rx, ry, start, start + TAU + (o.overlap ?? 0.18));
  if (o.fill) {
    ctx.save();
    if (o.alpha !== undefined) ctx.globalAlpha *= o.alpha;
    ctx.fillStyle = o.fill;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
  if (o.w === 0) return;
  path(ctx, pts, { ...o, fill: undefined, wobble: o.wobble ?? Math.min(1.4, Math.max(rx, ry) * 0.06) });
}

// Plain (non-wobbly) filled polygon.
export function fillPoly(ctx, pts, color, alpha = 1) {
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export function dot(ctx, x, y, r, color = COL.ink, alpha = 1) {
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
  ctx.restore();
}

// Diagonal pencil hatching inside a clip region.
// region: [x, y, w, h] rect, or an array of points (polygon).
// o: {gap, angle, w, color, alpha}
export function hatch(ctx, region, o = {}) {
  ctx.save();
  ctx.beginPath();
  if (typeof region[0] === 'number') ctx.rect(...region);
  else {
    ctx.moveTo(region[0][0], region[0][1]);
    for (let i = 1; i < region.length; i++) ctx.lineTo(region[i][0], region[i][1]);
    ctx.closePath();
  }
  ctx.clip();
  let x0, y0, x1, y1;
  if (typeof region[0] === 'number') [x0, y0, x1, y1] = [region[0], region[1], region[0] + region[2], region[1] + region[3]];
  else {
    x0 = Math.min(...region.map((p) => p[0]));
    x1 = Math.max(...region.map((p) => p[0]));
    y0 = Math.min(...region.map((p) => p[1]));
    y1 = Math.max(...region.map((p) => p[1]));
  }
  const gap = o.gap ?? 14;
  const ang = o.angle ?? -0.9;
  const dx = Math.cos(ang);
  const dy = Math.sin(ang);
  const diag = Math.hypot(x1 - x0, y1 - y0);
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  const seed0 = o.seed ?? 500;
  let i = 0;
  for (let s = -diag / 2; s <= diag / 2; s += gap, i++) {
    const px = cx - dy * s;
    const py = cy + dx * s;
    line(ctx, px - dx * diag / 2, py - dy * diag / 2, px + dx * diag / 2, py + dy * diag / 2, {
      w: o.w ?? 1.6,
      color: o.color ?? COL.ink,
      alpha: (o.alpha ?? 0.28) * (0.75 + 0.25 * hash(i + seed0)),
      wobble: 1.2,
      seed: seed0 + i,
    });
  }
  ctx.restore();
}

// ----------------------------------------------------------------- text
// o: {size, color, alpha, align, spacing, weight}
export function text(ctx, str, x, y, o = {}) {
  ctx.save();
  if (o.alpha !== undefined) ctx.globalAlpha *= o.alpha;
  ctx.font = `${o.weight ?? 400} ${o.size ?? 56}px ${FONT}`;
  ctx.fillStyle = o.color ?? COL.ink;
  ctx.textAlign = o.align ?? 'center';
  ctx.textBaseline = o.baseline ?? 'middle';
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${o.spacing ?? 0}px`;
  ctx.fillText(str, x, y);
  ctx.restore();
}

// Vertical (top-to-bottom) text, columns run right-to-left. lines: string[]
// o: {size, gap (column gap), color, alpha, reveal (0..1 characters shown)}
export function vtext(ctx, lines, x, y, o = {}) {
  const size = o.size ?? 56;
  const lh = size * (o.lineHeight ?? 1.18);
  const colGap = o.gap ?? size * 1.6;
  const total = lines.reduce((n, l) => n + [...l].length, 0);
  let shown = Math.floor((o.reveal ?? 1) * total + 1e-6);
  ctx.save();
  if (o.alpha !== undefined) ctx.globalAlpha *= o.alpha;
  ctx.font = `${size}px ${FONT}`;
  ctx.fillStyle = o.color ?? COL.ink;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  lines.forEach((l, ci) => {
    [...l].forEach((ch, i) => {
      if (shown-- <= 0) return;
      const isPunct = '，。、；：？！'.includes(ch);
      const cx = x - ci * colGap + (isPunct ? size * 0.32 : 0);
      const cy = y + i * lh - (isPunct ? size * 0.3 : 0);
      ctx.fillText(ch, cx, cy);
    });
  });
  ctx.restore();
}

// ----------------------------------------------------------------- camera
// Draw fn() with a camera looking at (x, y) with zoom z and rotation r.
export function camera(ctx, c, fn) {
  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.scale(c.z ?? 1, c.z ?? 1);
  if (c.r) ctx.rotate(c.r);
  ctx.translate(-(c.x ?? W / 2), -(c.y ?? H / 2));
  fn();
  ctx.restore();
}

// ----------------------------------------------------------------- layers
// Offscreen layers for effects (blur, sepia, masks). Each nesting depth gets
// its own canvas, so layers can nest.
const pool = [];
let depth = 0;
function getLayer(d) {
  if (!pool[d]) {
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    pool[d] = c;
  }
  return pool[d];
}

// Draw fn(lctx) into a fresh transparent layer, then composite it onto ctx.
// The layer starts with an identity transform: inside camera(), copy the
// camera with l.setTransform(ctx.getTransform()) first if you need it.
// A full-screen layer costs a composite (and a blur filter is expensive), so
// prefer a small private canvas for small effects.
// o: {alpha, filter ('blur(4px) sepia(0.6)'), composite, mask(lctx)}
//   mask: optional function drawing into the layer with 'destination-in'
export function withLayer(ctx, fn, o = {}) {
  const c = getLayer(depth);
  const l = c.getContext('2d');
  l.setTransform(1, 0, 0, 1, 0, 0);
  l.globalAlpha = 1;
  l.globalCompositeOperation = 'source-over';
  l.filter = 'none';
  l.clearRect(0, 0, W, H);
  depth++;
  l.save(); // so a clip() inside fn can't leak into later uses of this pooled layer
  try {
    fn(l);
    if (o.mask) {
      l.save();
      l.setTransform(1, 0, 0, 1, 0, 0);
      l.globalCompositeOperation = 'destination-in';
      o.mask(l);
      l.restore();
    }
  } finally {
    l.restore();
    depth--;
  }
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (o.alpha !== undefined) ctx.globalAlpha *= o.alpha;
  if (o.filter) ctx.filter = o.filter;
  if (o.composite) ctx.globalCompositeOperation = o.composite;
  ctx.drawImage(c, 0, 0);
  ctx.restore();
}

// ----------------------------------------------------------------- paper
let paperCanvas = null;
export function paper(ctx) {
  if (!paperCanvas) {
    paperCanvas = document.createElement('canvas');
    paperCanvas.width = W;
    paperCanvas.height = H;
    const p = paperCanvas.getContext('2d');
    p.fillStyle = COL.paper;
    p.fillRect(0, 0, W, H);
    const r = rng(7);
    // soft blotches
    for (let i = 0; i < 40; i++) {
      const x = r() * W;
      const y = r() * H;
      const rad = 120 + r() * 380;
      const g = p.createRadialGradient(x, y, 0, x, y, rad);
      const dark = r() < 0.5;
      g.addColorStop(0, dark ? 'rgba(120,100,70,0.028)' : 'rgba(255,252,245,0.06)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      p.fillStyle = g;
      p.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
    // fibres
    p.lineCap = 'round';
    for (let i = 0; i < 900; i++) {
      const x = r() * W;
      const y = r() * H;
      const a = r() * TAU;
      const l = 3 + r() * 14;
      p.strokeStyle = r() < 0.5 ? 'rgba(90,75,55,0.07)' : 'rgba(255,255,250,0.12)';
      p.lineWidth = 0.6 + r() * 0.8;
      p.beginPath();
      p.moveTo(x, y);
      p.quadraticCurveTo(x + Math.cos(a + 0.6) * l * 0.5, y + Math.sin(a + 0.6) * l * 0.5, x + Math.cos(a) * l, y + Math.sin(a) * l);
      p.stroke();
    }
    // grain
    const img = p.getImageData(0, 0, W, H);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const n = (r() - 0.5) * 10;
      d[i] += n;
      d[i + 1] += n;
      d[i + 2] += n;
    }
    p.putImageData(img, 0, 0);
    // vignette
    const v = p.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, W * 0.72);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, 'rgba(70,55,35,0.22)');
    p.fillStyle = v;
    p.fillRect(0, 0, W, H);
  }
  ctx.drawImage(paperCanvas, 0, 0);
}
