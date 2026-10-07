// s09 — 前些日子去浙江，车窗外群山绵延。山色极美，风晴雨霁，平林烟霭，云遏千里。
//       天如长海柔波，山如凝固海浪。可我与那些山只是萍水相逢，看一眼，便再无下次。
//
// Inside a train carriage, from behind: he sits in a high-backed seat by the
// window (the frame); the seat beside him, where she would have sat, is empty.
// Ranges of mountains scroll past in parallax, poles and wires flick by.
// A gust, sun, a brief rain across the glass, the sun again; mist over the
// level woods; long clouds stretch across the sky. The sky turns into slow
// sea swells and the ridges curl into frozen wave crests. Then one peak (a
// tiny pavilion on its top) slides past; his head follows it all the way out
// of the window, and he keeps looking at the empty edge.
//
// The whole carriage shot is trainShot(ctx, t) on GLOBAL time and is shared
// with s10, so the cut between the two scenes is seamless (hard cut, fade 0).
import { COL, TAU, F, clamp, lerp, smooth, env, keys, ease, hash, noise1, path, line, rect, ellipsePts, dot, fillPoly, camera } from '../lib.js';
import { figure, pose, SIT_BACK } from '../figure.js';
import { frameBox, cloud, bird, windLine, rain } from '../sets.js';

// ------------------------------------------------------------ the set
export const WIN = { x: 300, y: 80, w: 1320, h: 560 }; // the glass
export const SILL = WIN.y + WIN.h;
const WX0 = WIN.x - 12;
const WX1 = WIN.x + WIN.w + 12;
export const BOY = { x: 700, hip: 778, s: 2.1 };
export const SEAT = { top: 646, w: 330, gap: 26 };
export const SEATS = [BOY.x, BOY.x + SEAT.w + SEAT.gap]; // his, and the empty one
export const VN = 368; // near-layer speed, px/s, at normal train speed

// train speed multiplier: steady, then (s10, 山长水远) it pulls away faster
const SPEED_T0 = 85.35;
const SPEED_T1 = 86.3;
const SPEED_MAX = 2.6;
const speedMul = (t) => keys(t, [[SPEED_T0, 1], [SPEED_T1, SPEED_MAX]], ease.inOut);
// distance travelled since t = 60, in "seconds at normal speed"
export function trainD(t) {
  if (t <= SPEED_T0) return t - 60;
  let d = SPEED_T0 - 60;
  const dt = 1 / 60;
  let x = SPEED_T0;
  while (x + dt <= t) {
    d += speedMul(x + dt / 2) * dt;
    x += dt;
  }
  return d + speedMul((x + t) / 2) * (t - x);
}

// ------------------------------------------------------------ the land
function nz(xw, seed, freq) {
  const u = xw * freq;
  return 0.62 * noise1(u, seed) + 0.28 * noise1(u * 2.3, seed + 3) + 0.1 * noise1(u * 6.1, seed + 9);
}
const ridgeFn = (seed, base, amp, freq, sharp) => (xw) => base - amp * (0.2 + 0.8 * Math.pow(clamp(1 - Math.abs(nz(xw, seed, freq))), sharp));

// the one peak that passes by: its summit leaves the window's left edge on 看一眼
const PEAK_OUT = 80.45;
const PEAK_X = WIN.x + VN * trainD(PEAK_OUT);
const NEAR_BASE = 640;
const hills = ridgeFn(61, NEAR_BASE - 4, 46, 1 / 190, 1.3);
// a karst peak with a shoulder, a notch and a ledge (offset from summit, height 0..1)
const PEAK_SHAPE = [
  [-360, 0], [-290, 0.08], [-235, 0.24], [-196, 0.42], [-172, 0.52], [-150, 0.49], [-128, 0.5],
  [-96, 0.66], [-64, 0.84], [-36, 0.95], [-12, 1.0], [14, 1.0], [34, 0.96], [56, 0.84],
  [76, 0.66], [92, 0.6], [116, 0.56], [140, 0.44], [176, 0.24], [228, 0.08], [300, 0],
];
const PEAK_HT = 440;
function peakH(xw) {
  const d = xw - PEAK_X;
  if (d <= PEAK_SHAPE[0][0] || d >= PEAK_SHAPE[PEAK_SHAPE.length - 1][0]) return 9999;
  let i = 0;
  while (PEAK_SHAPE[i + 1][0] < d) i++;
  const [d0, h0] = PEAK_SHAPE[i];
  const [d1, h1] = PEAK_SHAPE[i + 1];
  const k = (d - d0) / (d1 - d0);
  const h = lerp(h0, h1, k * k * (3 - 2 * k));
  return NEAR_BASE - PEAK_HT * h + 5 * noise1(xw / 21, 66) * h;
}
const nearH = (xw) => Math.min(hills(xw), peakH(xw));
const inPeak = (xw) => Math.abs(xw - PEAK_X - 0) < 380;

const LAYERS = [
  { k: 0.07, seed: 31, h: ridgeFn(31, 410, 200, 1 / 400, 2.3), w: 2.2, line: 0.3, wash: 0.03, shade: 0.11, step: 12, prom: 30 },
  { k: 0.18, seed: 37, h: ridgeFn(37, 478, 170, 1 / 320, 2.5), w: 2.6, line: 0.5, wash: 0.045, shade: 0.17, step: 12, prom: 28 },
  { k: 0.42, seed: 43, h: ridgeFn(43, 548, 150, 1 / 270, 2.7), w: 3.0, line: 0.78, wash: 0.06, shade: 0.25, step: 12, prom: 24 },
];
const NEAR = { k: 1, seed: 61, h: nearH, w: 3.6, line: 1, wash: 0.09, shade: 0.3, step: 10, prom: 40 };
export const MID = LAYERS[2];

// poles: one every 1650 world px on the pole layer, only in some stretches
const POLE_K = 2.4;
const POLE_GAP = 1650;
const poleOn = (j) => {
  const tc = 60 + (j * POLE_GAP - 960) / (POLE_K * VN);
  return (tc > 65.4 && tc < 70.2) || tc > 86.9;
};

// ------------------------------------------------------------ shared shot
export const CAM_S10 = { x: 1180, y: 512, z: 1.0 };
export function camAt(t) {
  return keys(t, [
    [66.0, { x: 960, y: 330, z: 1.5 }],
    [69.4, { x: 960, y: 500, z: 1.0 }],
    [73.9, { x: 960, y: 478, z: 1.04 }],
    [75.7, { x: 960, y: 392, z: 1.27 }], // into the sea of mountains
    [77.25, { x: 960, y: 392, z: 1.27 }],
    [78.7, { x: 935, y: 500, z: 1.04 }],
    [80.7, { x: 935, y: 500, z: 1.04 }],
    [82.4, CAM_S10],
  ], ease.inOut);
}

const bobAt = (t) => {
  const c = t % 0.93;
  return 1.2 * Math.sin(t * TAU * 1.07) + 1.5 * Math.exp(-c / 0.07) * Math.sin(c * 60);
};

// o: { boy(p, t) -> pose overrides, inGlass(ctx, t, D) for s10's memory,
//      overSeat(ctx, t, bob) for things drawn in front of the seats }
export function trainShot(ctx, t, o = {}) {
  const D = trainD(t);
  const bob = bobAt(t);
  camera(ctx, o.cam ?? camAt(t), () => {
    ctx.save();
    ctx.beginPath();
    ctx.rect(WIN.x, WIN.y + bob, WIN.w, WIN.h);
    ctx.clip();
    outside(ctx, t, D);
    if (o.inGlass) o.inGlass(ctx, t, D);
    glassFx(ctx, t);
    ctx.restore();

    ctx.save();
    ctx.translate(0, bob);
    interior(ctx, t, o);
    ctx.restore();
  });
}

// ------------------------------------------------------------ outside
// 天如长海柔波 (sky swells), 山如凝固海浪 (ridges curl into frozen crests)
const skyWave = (t) => smooth(t, 74.5, 75.6) * (1 - smooth(t, 77.4, 78.6));
const crestK = (t) => smooth(t, 76.05, 77.0) * (1 - smooth(t, 77.45, 78.3));

function outside(ctx, t, D) {
  sky(ctx, t, D);
  const ck = crestK(t);
  for (const L of LAYERS) ridgeLayer(ctx, L, L.k * VN * D, ck);
  mist(ctx, t, D);
  nearLayer(ctx, t, D, ck);
  poles(ctx, D);
}

function sky(ctx, t, D) {
  // the sun: out for 山色极美 / 晴, hidden by the shower, back for 霁
  const sa = Math.max(env(t, 69.6, 71.55, 0.6, 0.35), smooth(t, 72.0, 72.6));
  if (sa > 0.01) inkSun(ctx, 1460, 172, 28, t, sa * 0.8, smooth(t, 71.95, 72.5) * (1 - smooth(t, 73.2, 74.4)));

  // small clouds, drifting slowly (gone when the long clouds come)
  const ca = 1 - smooth(t, 72.7, 73.4);
  if (ca > 0.01) {
    const off = 0.025 * VN * D + t * 6;
    for (let i = 0; i < 6; i++) {
      const x = ((((i * 620 + 150 - off) % 3720) + 3720) % 3720) - 200;
      if (x < WX0 - 200 || x > WX1 + 200) continue;
      cloud(ctx, x, 160 + (i % 3) * 48, 0.75 + 0.2 * (i % 2), { alpha: 0.6 * ca, fill: 'rgba(0,0,0,0)', seedStroke: 5100 + i, seed: i });
    }
  }

  // birds while 山色极美
  for (let i = 0; i < 3; i++) {
    const a = env(t, 69.5 + i * 0.25, 71.3, 0.4, 0.5);
    if (a < 0.01) continue;
    const x = 1380 - (t - 69.4) * (85 + i * 12) - i * 70;
    bird(ctx, x, 235 + i * 28 + Math.sin(t * 1.3 + i) * 6, 0.85 - i * 0.12, t * 1.6 + i * 0.37, { alpha: 0.75 * a, seed: 5200 + i * 2 });
  }

  // 云遏千里: long clouds stretch across the sky ... then become sea swells
  const sw = skyWave(t);
  if (t > 72.9 && sw < 0.999) {
    const drift = -(t - 73) * 14;
    const clouds = [
      { y: 168, x0: 520, x1: 1600, d: 0.0, h: 26 },
      { y: 236, x0: 260, x1: 1180, d: 0.2, h: 22 },
      { y: 300, x0: 860, x1: 1700, d: 0.38, h: 18 },
    ];
    clouds.forEach((c, i) => {
      const k = smooth(t, 73.15 + c.d, 74.05 + c.d);
      if (k <= 0) return;
      const a = 0.78 * (t < 76 ? 1 - sw : 0);
      // drawn on from the right: the band grows leftward
      const x0 = lerp(c.x1, c.x0, k) + drift;
      const x1 = c.x1 + drift;
      const n = Math.max(2, Math.round((x1 - x0) / 14));
      const top = [];
      for (let j = 0; j <= n; j++) {
        const x = lerp(x1, x0, j / n);
        const u = (x - drift - c.x0) / (c.x1 - c.x0);
        const taper = Math.pow(Math.sin(Math.PI * clamp(u)), 0.5);
        const bump = Math.abs(Math.sin((x - drift) / 34 + i * 1.7));
        top.push([x, c.y - c.h * taper * (0.35 + 0.65 * Math.sqrt(bump))]);
      }
      const bot = [[x0, c.y + 2], [x1, c.y + 2]];
      fillPoly(ctx, [...top, ...bot], COL.paper, 0.9 * a);
      path(ctx, top, { w: 2.5, alpha: a, seed: 5300 + i, wobble: 0.7 });
      path(ctx, [[x0 + 10, c.y + 2], [x1 - 10, c.y + 3]], { w: 2, alpha: a * 0.8, seed: 5310 + i, wobble: 0.7 });
      path(ctx, [[x0 + 60, c.y + 12], [x1 - 140, c.y + 13]], { w: 1.4, alpha: a * 0.45, seed: 5320 + i, wobble: 0.7 });
    });
  }

  // 天如长海柔波: long soft swells across the whole sky, a few breaking softly
  if (sw > 0.01) {
    for (let i = 0; i < 7; i++) {
      const y0 = 128 + i * 36;
      const k = smooth(t, 74.5 + i * 0.1, 75.4 + i * 0.1);
      if (k <= 0) continue;
      const amp = 7 + 4 * Math.sin(i * 1.7);
      const lam = 230 + 30 * i;
      const pts = [];
      for (let x = WX1; x >= WX0; x -= 16) {
        const ph = (x / lam) * TAU + t * 0.9 + i * 1.3;
        pts.push([x, y0 + amp * Math.sin(ph) + 3 * Math.sin(ph * 0.37 + i)]);
      }
      path(ctx, pts, { w: 2.2 - i * 0.05, alpha: (0.62 - i * 0.04) * sw, draw: k, seed: 5400 + i, wobble: 0.7 });
    }
  }
}

function inkSun(ctx, x, y, r, t, a, glow = 0) {
  if (glow > 0.01) {
    const g = ctx.createRadialGradient(x, y, r * 0.5, x, y, r * 4);
    g.addColorStop(0, `rgba(255,250,235,${0.5 * glow})`);
    g.addColorStop(1, 'rgba(255,250,235,0)');
    ctx.save();
    ctx.fillStyle = g;
    ctx.fillRect(x - r * 4, y - r * 4, r * 8, r * 8);
    ctx.restore();
  }
  path(ctx, ellipsePts(x, y, r, r, -2.2, -2.2 + TAU + 0.18), { w: 3.2, alpha: a, seed: 5000, wobble: 1 });
  for (let i = 0; i < 10; i++) {
    const ang = t * 0.06 + (i / 10) * TAU;
    const r0 = r * 1.35;
    const r1 = r * (i % 2 ? 1.65 : 1.82) * (1 + 0.18 * glow);
    line(ctx, x + Math.cos(ang) * r0, y + Math.sin(ang) * r0, x + Math.cos(ang) * r1, y + Math.sin(ang) * r1, { w: 2.6, alpha: a, seed: 5001 + i });
  }
}

// sample a ridge on a world-anchored grid so peaks don't shimmer as it scrolls
function sampleRidge(h, off, step) {
  const a = Math.floor((WX0 + off) / step) - 1;
  const b = Math.ceil((WX1 + off) / step) + 1;
  const raw = [];
  for (let i = a; i <= b; i++) {
    const xw = i * step;
    raw.push({ x: xw - off, y: h(xw), xw, i });
  }
  return raw;
}

function knock(ctx, poly) {
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  fillPoly(ctx, poly, '#000', 1);
  ctx.restore();
}

// Frozen waves: find the crests, hollow out the face in front of each one
// (left, the way the land runs) and hang a curling lip over it.
function waveMorph(raw, k, minProm, skip) {
  const ys = raw.map((p) => p.y);
  const crests = [];
  if (k <= 0.001) return { ys, crests };
  const n = raw.length;
  let prev = 0;
  for (let i = 3; i < n - 3; i++) {
    const y = raw[i].y;
    let peak = true;
    for (let d = 1; d <= 3 && peak; d++) if (raw[i - d].y < y || raw[i + d].y <= y) peak = false;
    if (!peak) continue;
    if (skip && skip(raw[i].xw)) continue;
    // trough in front (to the left) of the crest
    let m = i;
    for (let j = i - 1; j >= Math.max(prev, i - 40); j--) if (raw[j].y > raw[m].y) m = j;
    let back = y;
    for (let j = i + 1; j < Math.min(n, i + 40); j++) back = Math.max(back, raw[j].y);
    const prom = Math.min(raw[m].y, back) - y;
    if (prom < minProm || m === i) continue;
    const ym = raw[m].y;
    for (let j = m + 1; j < i; j++) {
      const u = (raw[j].x - raw[m].x) / (raw[i].x - raw[m].x);
      const face = ym - (ym - y) * Math.pow(u, 2.6);
      ys[j] = lerp(raw[j].y, face, k);
    }
    crests.push({ x: raw[i].x, y, R: clamp(prom * 0.4, 10, 46), id: raw[i].i });
    prev = i;
  }
  return { ys, crests };
}

function curlAt(ctx, x, y, R, k, o) {
  const cx = x - R * 0.72;
  const cy = y + R * 0.74;
  const th0 = Math.atan2(y - cy, x - cx);
  const r0 = Math.hypot(x - cx, y - cy);
  const pts = [];
  const n = 30;
  for (let j = 0; j <= n; j++) {
    const u = j / n;
    const th = th0 - u * 6.6;
    const r = r0 * (1 - 0.82 * u);
    pts.push([cx + Math.cos(th) * r, cy + Math.sin(th) * r]);
  }
  path(ctx, pts, { w: o.w, alpha: o.alpha * k, draw: k, seed: o.seed, wobble: 0.5 });
  // two little foam claws on the lip
  for (let c = 0; c < 2; c++) {
    const th = th0 - 1.9 - c * 0.55;
    const px = cx + Math.cos(th) * r0 * 0.97;
    const py = cy + Math.sin(th) * r0 * 0.97;
    const ex = px - R * (0.28 + 0.06 * c);
    const ey = py + R * (0.05 + 0.12 * c);
    path(ctx, [[px, py], [lerp(px, ex, 0.6), py - R * 0.08], [ex, ey]], { w: o.w * 0.7, alpha: o.alpha * k * 0.9, draw: clamp(k * 1.4 - 0.4), seed: o.seed + 1 + c, wobble: 0.3 });
  }
}

function landLine(L, raw, ys) {
  const boil = F.boil;
  const pts = raw.map((p, i) => [p.x, ys[i] + 0.9 * noise1(p.xw / 29, L.seed * 5 + boil * 1.37)]);
  const sk = raw.map((p, i) => [p.x, ys[i] + 1.6 * noise1(p.xw / 17, L.seed * 7 + boil * 2.11) - 1.2]);
  return { pts, sk };
}

function ridgeLayer(ctx, L, off, ck) {
  const raw = sampleRidge(L.h, off, L.step);
  const { ys, crests } = waveMorph(raw, ck, L.prom);
  const { pts, sk } = landLine(L, raw, ys);
  const poly = [...pts, [WX1 + 20, SILL + 30], [WX0 - 20, SILL + 30]];
  knock(ctx, poly);
  fillPoly(ctx, poly, COL.ink, L.wash);
  shade(ctx, L, raw, ys, 1 - ck);
  path(ctx, pts, { w: L.w, alpha: L.line, wobble: 0 });
  path(ctx, sk, { w: L.w * 0.45, alpha: L.line * 0.35, wobble: 0 });
  if (ck > 0.01) waveDress(ctx, L, pts, crests, ck);
}

function waveDress(ctx, L, pts, crests, ck, keep) {
  // water layers under the line
  for (let j = 1; j <= 3; j++) {
    const off = pts.filter((p, i) => !keep || keep(i)).map(([x, y]) => [x, y + j * 14]);
    path(ctx, off, { w: 1.5, alpha: L.line * (0.46 - j * 0.08) * ck, wobble: 0, draw: ck });
  }
  for (const c of crests) curlAt(ctx, c.x, c.y, c.R, ck, { w: L.w * 0.95, alpha: L.line, seed: L.seed * 50 + (((c.id % 300) + 300) % 300) });
}

// short strokes on the shadow (right-facing) slopes, anchored to the land
// (one batched stroke per layer; each stroke keeps its own fixed bend)
function shade(ctx, L, raw, ys, a) {
  if (a <= 0.02) return;
  ctx.save();
  ctx.strokeStyle = COL.ink;
  ctx.globalAlpha *= L.shade * a;
  ctx.lineWidth = 1.6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (let n = 2; n < raw.length - 2; n += 2) {
    const p = raw[n];
    const slope = (ys[n + 1] - ys[n - 1]) / (2 * L.step);
    if (slope < 0.18) continue;
    const len = Math.min(70, 14 + slope * 40) * (0.6 + 0.4 * hash(p.i * 1.3 + L.seed));
    const y = ys[n];
    const x0 = p.x + 2;
    const x1 = p.x - len * 0.35;
    const bend = (hash(p.i * 2.7 + L.seed) - 0.5) * 3;
    ctx.moveTo(x0, y + 7);
    ctx.quadraticCurveTo((x0 + x1) / 2 + bend, y + 7 + len / 2, x1, y + 7 + len);
  }
  ctx.stroke();
  ctx.restore();
}

// 平林烟霭: mist bands lie over the woods at the foot of the mid ridge
function mist(ctx, t, D) {
  const k = 0.4 + 0.6 * env(t, 72.05, 75.0, 0.8, 1.2);
  const off = 0.3 * VN * D;
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  for (let b = 0; b < 3; b++) {
    const y0 = 512 + b * 32;
    const top = [];
    const bot = [];
    for (let x = WX0 - 40; x <= WX1 + 40; x += 40) {
      const xw = x + off * (1 + b * 0.15);
      const y = y0 + 10 * noise1(xw / 260, 80 + b);
      top.push([x, y - 30]);
      bot.push([x, y + 30]);
    }
    const g = ctx.createLinearGradient(0, y0 - 40, 0, y0 + 40);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(0.5, `rgba(0,0,0,${0.5 * k})`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    top.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    for (let i = bot.length - 1; i >= 0; i--) ctx.lineTo(bot[i][0], bot[i][1]);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  // a few drawn wisps
  for (let b = 0; b < 4; b++) {
    const y0 = 506 + b * 24;
    const span = 520 + 90 * b;
    const per = 1320 + span + 400;
    const x = WX1 + 200 - (((((0.3 + b * 0.04) * VN * D + b * 900) % per) + per) % per);
    const pts = [];
    for (let j = 0; j <= 16; j++) pts.push([x + (j / 16) * span, y0 + 5 * Math.sin(j * 0.9 + b)]);
    path(ctx, pts, { w: 1.8, alpha: 0.32 * k, seed: 5500 + b, wobble: 0.8 });
  }
}

function nearLayer(ctx, t, D, ck) {
  const off = VN * D;
  const raw = sampleRidge(NEAR.h, off, NEAR.step);
  const { ys, crests } = waveMorph(raw, ck, NEAR.prom, inPeak);
  const { pts, sk } = landLine(NEAR, raw, ys);
  const poly = [...pts, [WX1 + 20, SILL + 30], [WX0 - 20, SILL + 30]];
  knock(ctx, poly);
  fillPoly(ctx, poly, COL.ink, NEAR.wash);
  shade(ctx, NEAR, raw, ys, 1 - ck);

  // the level woods: a row of small firs along the low hills (one batched shape)
  ctx.save();
  ctx.beginPath();
  for (let j = Math.floor((WX0 + off) / 31) - 1; j <= Math.ceil((WX1 + off) / 31) + 1; j++) {
    if (hash(j * 0.71 + 3) < 0.22) continue;
    const xw = j * 31 + hash(j + 0.5) * 16;
    if (peakH(xw) < hills(xw) - 4) continue;
    const x = xw - off;
    const y = hills(xw) + 3;
    const h = 22 + hash(j * 1.9) * 16;
    const wd = 7 + hash(j * 2.7) * 3;
    const lean = (hash(j * 3.3) - 0.5) * 3;
    ctx.moveTo(x - wd, y);
    ctx.lineTo(x - wd * 0.3, y - h * 0.55);
    ctx.lineTo(x - wd * 0.62, y - h * 0.5);
    ctx.lineTo(x + lean, y - h);
    ctx.lineTo(x + wd * 0.62, y - h * 0.5);
    ctx.lineTo(x + wd * 0.3, y - h * 0.55);
    ctx.lineTo(x + wd, y);
  }
  ctx.fillStyle = 'rgba(31,28,25,0.1)';
  ctx.fill();
  ctx.strokeStyle = COL.ink;
  ctx.globalAlpha *= 0.8;
  ctx.lineWidth = 2.2;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.stroke();
  ctx.restore();
  path(ctx, pts, { w: NEAR.w, alpha: NEAR.line, wobble: 0 });
  path(ctx, sk, { w: NEAR.w * 0.45, alpha: 0.35, wobble: 0 });

  // pavilion on the summit
  const sx = PEAK_X - off;
  if (sx > WX0 - 80 && sx < WX1 + 80) pavilion(ctx, sx, peakH(PEAK_X) + 1);
  if (ck > 0.01) waveDress(ctx, NEAR, pts, crests, ck, (i) => !inPeak(raw[i].xw));
}

function pavilion(ctx, x, y) {
  const o = { w: 2.4, wobble: 0.4 };
  line(ctx, x - 11, y, x - 11, y - 19, { ...o, seed: 6901 });
  line(ctx, x + 11, y, x + 11, y - 19, { ...o, seed: 6902 });
  path(ctx, [[x - 27, y - 16], [x - 19, y - 21], [x - 7, y - 27], [x, y - 36], [x + 7, y - 27], [x + 19, y - 21], [x + 27, y - 16]], { ...o, w: 2.8, seed: 6903, fill: 'rgba(31,28,25,0.25)' });
  line(ctx, x, y - 36, x, y - 43, { ...o, seed: 6904 });
}

function poles(ctx, D) {
  const off = POLE_K * VN * D;
  const top = 128;
  const j0 = Math.floor((WX0 - 200 + off) / POLE_GAP);
  const j1 = Math.ceil((WX1 + 200 + off) / POLE_GAP);
  for (let j = j0 - 1; j <= j1; j++) {
    const x = j * POLE_GAP - off;
    const nx = (j + 1) * POLE_GAP - off;
    if (poleOn(j) && poleOn(j + 1)) {
      for (const dx of [-28, 28]) {
        const pts = [];
        for (let u = 0; u <= 1.0001; u += 1 / 24) pts.push([lerp(x + dx, nx + dx, u), top + 12 + 80 * (1 - (2 * u - 1) ** 2)]);
        path(ctx, pts, { w: 1.6, alpha: 0.7, seed: 7000 + (dx > 0 ? 1 : 0), wobble: 0.4 });
      }
    }
    if (!poleOn(j) || x < WX0 - 60 || x > WX1 + 60) continue;
    line(ctx, x, SILL + 40, x + 3, top - 6, { w: 7, seed: 7010, wobble: 0.6 });
    line(ctx, x - 40, top + 12, x + 40, top + 12, { w: 4.5, seed: 7011, wobble: 0.4 });
    line(ctx, x - 26, top + 34, x + 26, top + 34, { w: 3, seed: 7012, wobble: 0.4 });
  }
}

// ------------------------------------------------------------ the glass
function glassFx(ctx, t) {
  // 风: gusts streak across
  for (let i = 0; i < 3; i++) {
    const k = clamp((t - 70.8 - i * 0.16) / 1.05);
    if (k <= 0 || k >= 1) continue;
    windLine(ctx, WX1 - 60 - i * 90, 230 + i * 110, 210, k, { travel: -1300, curl: i !== 1, seed: 7100 + i, alpha: 0.7 });
  }
  // 雨: a brief shower runs across the glass, then 霁
  const ra = env(t, 71.45, 72.3, 0.2, 0.4);
  if (ra > 0.01) {
    fillPoly(ctx, [[WIN.x, WIN.y], [WIN.x + WIN.w, WIN.y], [WIN.x + WIN.w, SILL], [WIN.x, SILL]], COL.ink, 0.07 * ra);
    rain(ctx, t, WIN.x, WIN.y, WIN.w, WIN.h, { density: 0.9, speed: 1600, len: 44, slant: 0.85, alpha: 0.55 * ra, w: 1.9 });
  }
  // drops left on the glass, running off with the wind and drying
  const da = smooth(t, 71.5, 71.8) * (1 - smooth(t, 72.6, 73.6));
  if (da > 0.01) {
    for (let i = 0; i < 30; i++) {
      const x = WIN.x + 30 + hash(i * 4.3 + 1) * (WIN.w - 60);
      const y0 = WIN.y + 30 + hash(i * 2.9 + 7) * (WIN.h - 80);
      const slide = Math.max(0, t - 71.6 - hash(i) * 0.5) * (14 + 34 * hash(i * 9.1));
      const x1 = x - slide * 0.8;
      const y1 = y0 + slide * 0.6;
      dot(ctx, x1, y1, 2.4 + 1.8 * hash(i * 5.5), COL.ink, 0.4 * da);
      if (slide > 3) line(ctx, x, y0, x1, y1, { w: 1.3, alpha: 0.2 * da, wobble: 0 });
    }
  }
  // glare on the glass
  line(ctx, WIN.x + WIN.w - 150, WIN.y + 26, WIN.x + WIN.w - 210, WIN.y + 96, { w: 2.2, alpha: 0.28, seed: 7200 });
  line(ctx, WIN.x + WIN.w - 118, WIN.y + 30, WIN.x + WIN.w - 160, WIN.y + 80, { w: 1.6, alpha: 0.22, seed: 7201 });
}

// ------------------------------------------------------------ inside
function interior(ctx, t, o) {
  // wall below the window
  hatchBand(ctx, WIN.x - 60, SILL + 40, WIN.w + 120, 110, 0.07);
  // window frame: the frame motif, with a rubber seal inside
  frameBox(ctx, WIN.x, WIN.y, WIN.w, WIN.h, { seed: 7300, w: 6 });
  rect(ctx, WIN.x + 14, WIN.y + 14, WIN.w - 28, WIN.h - 28, { w: 1.8, alpha: 0.35, over: 0, seed: 7310 });
  // sill
  line(ctx, WIN.x - 40, SILL + 22, WIN.x + WIN.w + 40, SILL + 22, { w: 3.4, seed: 7320 });
  line(ctx, WIN.x - 30, SILL + 32, WIN.x + WIN.w + 30, SILL + 32, { w: 1.6, alpha: 0.5, seed: 7321 });

  // him
  const p = boyPose(t, o.boy);
  figure(ctx, p, { id: 1, legs: false });
  if (o.behindSeat) o.behindSeat(ctx, t, p);

  // seat backs (the one on the right stays empty)
  SEATS.forEach((cx, i) => seatBack(ctx, cx, SEAT.top + (i ? 2 : 0), SEAT.w, 7330 + i * 20));
  if (o.overSeat) o.overSeat(ctx, t, p);
}

function hatchBand(ctx, x, y, w, h, a) {
  ctx.save();
  ctx.strokeStyle = COL.ink;
  ctx.globalAlpha *= a;
  ctx.lineWidth = 1.4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (let i = 0; i < Math.floor(w / 26); i++) {
    const px = x + i * 26 + 8 + 3 * hash(i * 1.3);
    ctx.moveTo(px, y + 2 * hash(i));
    ctx.quadraticCurveTo(px - 10 + 2 * hash(i * 2.1), y + h / 2, px - 22, y + h - 3 * hash(i * 3.7));
  }
  ctx.stroke();
  ctx.restore();
}

// a high-backed train seat seen from behind, with a cloth over the headrest
export function seatBack(ctx, cx, top, w, seed) {
  const a = cx - w / 2;
  const b = cx + w / 2;
  const r = 52;
  const out = [
    [a + 6, 1130],
    [a, top + r + 60],
    ...ellipsePts(a + r, top + r, r, r, Math.PI, Math.PI * 1.5, 9),
    ...ellipsePts(b - r, top + r, r, r, Math.PI * 1.5, TAU, 9),
    [b, top + r + 60],
    [b - 6, 1130],
  ];
  // only the upper part hides anything (him, the wall); below it is bare paper
  ctx.save();
  ctx.beginPath();
  ctx.rect(a - 20, top - 10, w + 40, SILL + 200 - top);
  ctx.clip();
  knock(ctx, out);
  ctx.restore();
  fillPoly(ctx, out, COL.ink, 0.05);
  // the cloth: paper-white band over the top
  const ct = top + 16;
  const cb = top + 92;
  const cloth = [[a + 22, ct + 14], [a + 34, ct], [b - 34, ct], [b - 22, ct + 14], [b - 24, cb], [cx + w * 0.2, cb + 4], [cx - w * 0.2, cb + 4], [a + 24, cb]];
  fillPoly(ctx, cloth, COL.paper, 0.85);
  path(ctx, [cloth[7], cloth[0], cloth[1], cloth[2], cloth[3], cloth[4]], { w: 1.8, alpha: 0.55, seed, wobble: 0.6 });
  path(ctx, [cloth[4], cloth[5], cloth[6], cloth[7]], { w: 1.8, alpha: 0.55, seed: seed + 1, wobble: 0.9 });
  // a seam down the back
  path(ctx, [[a + 34, cb + 60], [a + 30, 1100]], { w: 1.6, alpha: 0.3, seed: seed + 2 });
  path(ctx, [[b - 34, cb + 60], [b - 30, 1100]], { w: 1.6, alpha: 0.3, seed: seed + 3 });
  path(ctx, out, { w: 4.8, seed: seed + 4, wobble: 0.9 });
}

export const peakScreenX = (t) => PEAK_X - VN * trainD(t);

export function boyPose(t, over) {
  // he notices the peak, follows it with his head, then holds on the empty edge
  const track = clamp((peakScreenX(t) - BOY.x) / 380, -1, 1);
  const follow = smooth(t, 77.55, 78.1);
  const turn = lerp(0, track, follow);
  const crane = smooth(t, 80.0, 80.9) * (1 - smooth(t, 82.6, 83.4)); // leans after it
  const sway = 0.012 * Math.sin(t * 2.1) + 0.006 * Math.sin(t * 5.3);
  const p = pose({
    view: 'back', x: BOY.x, y: BOY.hip, s: BOY.s, ...SIT_BACK,
    turn,
    lean: 0.07 * turn - 0.05 * crane + sway,
    head: 0.14 * turn - 0.1 * crane + sway * 1.5,
  });
  return over ? { ...p, ...over(p, t) } : p;
}

// ------------------------------------------------------------ s09
export default {
  fadeOut: 0,
  draw(ctx, lt, info) {
    trainShot(ctx, info.t);
  },
};
