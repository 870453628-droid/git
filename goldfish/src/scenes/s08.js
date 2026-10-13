// s08 — 战争·越画越小的圈 (44.7–51.8)
// "永恒开启 / 但人非生而永恒"
// 第九章：他下令任何人，包括乌尔苏拉在内，都不得靠近他身旁三米以内；他走到哪里都待在副官们
// 用粉笔画出、只有他一人能进入的圆圈中心。后来医生用蘸了碘酒的棉团在他胸前画了个圈。
// 本片：他从她的遗照前拿起小金鱼，举到照片前，再放进胸前的口袋（鱼头露在袋口）。他走出
// 房子的框，跨过门槛的那一步，脚上成了那双黑漆皮靴。地上画出一个粉笔圈，所有人停在圈外
// （乌尔苏拉的脚尖踩在线上，两个副官也在线上立定）。圈一次比一次小，乌尔苏拉每次都跟到
// 新的线上；最后的小圈升起来，成了他胸口的一个小圈，正好圈住口袋里的那点金光，像心跳一样
// 亮了两下（碘酒圈：书里他朝那里开了一枪而活了下来，这里不画）。圈每缩一次他就老一些：
// 背弯下去，胡子垂下来，手背到了身后；其他人一个个淡去。
// Shots: workshop (0–1.96, he takes the fish) → yard (1.7–, one camera: his boots
// at the door, the wide circle, then in ring by ring to his chest).
// Music: bars at 45.16, 46.25, 47.34, 48.43, 49.52, 50.61, 51.70 (accents 45.40, 48.18, 51.72).
import { W, H, COL, TAU, lerp, clamp, prog, smooth, keys, ease, path, line, ellipse, ellipsePts, dot, fillPoly, camera, withLayer } from '../lib.js';
import { figure, pose, mixPose, reach, joints, walk, walkPhase, standY } from '../figure.js';
import { goldFish, goldGlow, sparkle, chain, doll, mourningPhoto, lamp, hammer } from '../props.js';
import { ROOM, HIM, workshop, bench, ANVIL } from './s04.js';

const FLOOR = ROOM.floor; // 860
const TOP = FLOOR - 150; // bench top
const S = HIM.s; // 1.25
const HIP_Y = standY(FLOOR, S);

// s07's set, so the dissolve lands on the same room
const PHOTO = { x: 688, y: 468, w: 112, h: 138 };
const FISH_AT = [742, FLOOR - 157];
const VOTIVE = [812, FLOOR - 150];
const SHELF = { x0: 1140, x1: 1310, y: 560 };

// ------------------------------------------------------------------ timing (scene-local)
const CUT = [1.7, 1.96]; // dissolve from the workshop to the yard
const X_C = 1640; // the centre of the circle
// he walks out of the house at a steady pace and slows to a stop in the middle
const WALK = { t0: 1.5, t1: 3.06, x0: 1150, a: 0.66 };
const ARRIVE = WALK.t1;
const JAMB = ROOM.x1 + 22; // the door line: stepping over it he is in the black boots
// the circles: when each one is drawn, and its radius on the ground
const RINGS = [
  { t: 2.62, d: 0.46, r: 285 }, // 47.32
  { t: 4.28, d: 0.24, r: 178 }, // 48.98
  { t: 4.82, d: 0.2, r: 104 }, // 49.52
  { t: 5.37, d: 0.17, r: 54 }, // 50.07
];
const RISE = [5.72, 6.1]; // the last ring climbs to his chest (lands 50.8)
const RY = 0.19; // ground ellipse squash
const BEATS = [6.46, 6.74]; // the glint beats like a heart (51.16, 51.44)

// the heartbeat at the end: two quick pulses
function beat(lt) {
  let g = 0;
  for (const b of BEATS) g = Math.max(g, Math.exp(-Math.pow((lt - b) / 0.07, 2)));
  return g;
}

function himX(lt) {
  const { t0, t1, x0, a } = WALK;
  const T = t1 - t0;
  const v = (X_C - x0) / (T * (a + (1 - a) / 2));
  const u = clamp(lt - t0, 0, T);
  if (u <= a * T) return x0 + v * u;
  const r = u - a * T;
  const Td = (1 - a) * T;
  return x0 + v * a * T + v * (r - (r * r) / (2 * Td));
}

// ------------------------------------------------------------------ helpers
// the fish lying on the bench, facing left (as s07 leaves it)
function fishLeft(ctx, x, y, s, o) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(-1, 1);
  goldFish(ctx, 0, 0, s, 0, o);
  ctx.restore();
}

// her portrait inside the mourning frame (s07's)
function portrait(ctx, x, y, w, h) {
  ctx.save();
  ctx.fillStyle = 'rgba(120,100,70,0.08)';
  ctx.fillRect(x, y, w, h);
  ctx.restore();
  const s = 0.36;
  figure(ctx, pose({ view: 'front', x: x + w / 2, y: y + h - 8 - 114 * s, s, aA1: 0.18, aB1: 0.18, aA2: 0.1, aB2: 0.1 }), { id: 9, bow: true, skirt: true, boots: true, w: 1.8, still: true });
}

// his moustache with a continuous droop (figure.js only has up or down)
function mustache(ctx, p, j, droop) {
  const [hx, hy] = j.head;
  const r = j.r;
  const w = Math.max(2, 4.6 * Math.pow(p.s, 0.85));
  const a = j.headAngle;
  const fx = p.f * Math.cos(a);
  const fy = Math.sin(a);
  const ux = p.f * Math.sin(a);
  const uy = -Math.cos(a);
  const bx = hx + fx * r * 0.82 - ux * r * 0.3;
  const by = hy + fy * r * 0.82 - uy * r * 0.3;
  const k = 1.35;
  const P = (aa, bb) => [bx + (fx * aa * r + ux * bb * r) * k, by + (fy * aa * r + uy * bb * r) * k];
  const lobe = (Q, dir, kk) => {
    const L = [
      [0, 0],
      [0.22, -0.1],
      [0.42, -0.07 - 0.1 * droop],
      [0.58, 0.06 - 0.26 * droop],
      [0.62, 0.2 - 0.36 * droop],
      [0.53, 0.07 - 0.3 * droop],
      [0.37, 0.05 - 0.12 * droop],
      [0.17, 0.07],
    ];
    const pts = L.map(([aa, bb]) => Q(dir * aa, bb));
    fillPoly(ctx, pts, COL.ink, 1);
    path(ctx, pts, { w: Math.max(1, w * 0.35), close: true, seed: 1 * 41 + 20 + kk, wobble: 0.15 });
  };
  lobe(P, 1, 0);
  lobe((aa, bb) => P(aa * 0.55, bb * 0.8), -1, 1);
}

// the black patent-leather boots: each one inks in as that foot crosses the door line
function boots(ctx, p, j) {
  const s = p.s;
  for (const [i, ft] of [[0, j.footA], [1, j.footB]]) {
    const k = clamp((ft[0] - JAMB + 4) / 26);
    if (k <= 0.01) continue;
    const cx = ft[0] + p.f * 4 * s;
    const cy = ft[1] - 3 * s;
    const g = 0.75 + 0.25 * ease.outBack(k);
    ellipse(ctx, cx, cy, 8.5 * s * g, 5.5 * s * g, { w: Math.max(1.4, 2.8 * 0.6 * s), fill: COL.ink, alpha: clamp(k * 1.6), seed: 1 * 41 + 27 + i, wobble: 0.2 });
    dot(ctx, cx + p.f * 3 * s, cy - 2 * s, Math.max(1, 1.3 * s), '#f4ecd8', 0.9 * k);
    // a wink of shine as the leather appears
    const w = Math.sin(Math.PI * clamp((k - 0.55) / 0.45));
    if (w > 0.02) sparkle(ctx, cx + p.f * 4 * s, cy - 4 * s, 14 * w, 0.9 * w);
  }
}

// a point on his chest, and the unit vectors along (up) / across (forward) the torso
function chest(p, j, u = 0.66, out = 0) {
  const ux = j.shoulder[0] - j.hip[0];
  const uy = j.shoulder[1] - j.hip[1];
  const l = Math.hypot(ux, uy) || 1;
  const up = [ux / l, uy / l];
  // forward (toward the face) = up turned a quarter toward the facing side
  const fw = [-up[1] * p.f, up[0] * p.f];
  if (Math.sign(fw[0]) !== Math.sign(p.f)) {
    fw[0] = -fw[0];
    fw[1] = -fw[1];
  }
  return { x: j.hip[0] + ux * u + fw[0] * out * p.s, y: j.hip[1] + uy * u + fw[1] * out * p.s, up, fw };
}

// pocket-local point: f forward from the torso line, u up from the pocket's chest point
function pocketFrame(p, j) {
  const c = chest(p, j, 0.62, 0);
  const s = p.s;
  return { ...c, P: (f, u) => [c.x + c.fw[0] * f * s + c.up[0] * u * s, c.y + c.fw[1] * f * s + c.up[1] * u * s] };
}
const PK_FISH = { f: 9.5, u: 0.5, s: 0.42 }; // the fish sits mouth-up, its head peeking over the rim
const PK_CHAIN = 4;

// the pocket on his chest; with the fish inside, its head peeking over the rim
function pocket(ctx, p, j, o = {}) {
  const a = o.alpha ?? 1;
  if (a <= 0.01) return null;
  const { P, up } = pocketFrame(p, j);
  ctx.save();
  ctx.globalAlpha *= a;
  if (o.fish) {
    const fc = P(PK_FISH.f, PK_FISH.u);
    goldFish(ctx, fc[0], fc[1], PK_FISH.s, Math.atan2(up[1], up[0]), { seed: 7300 });
    // the chain from its mouth loops over the front of the pocket
    const m = P(PK_FISH.f + 0.5, PK_FISH.u + 10);
    const e = P(17.5, -5);
    chain(ctx, m[0], m[1], e[0], e[1], { step: 4, w: 1.1, sag: 2 });
  }
  const pk = [P(1, 3), P(1.2, -13), P(3.5, -16), P(15.5, -16), P(18, -13), P(18, 3)];
  fillPoly(ctx, pk, COL.paper, 1);
  path(ctx, pk, { w: Math.max(1.6, 2.3 * p.s), seed: 8091, wobble: 0.2 });
  ctx.restore();
  return P(PK_FISH.f, 6);
}

// ---------------------------------------------------------- the chalk rings
function ringPts(cx, cy, rx, ry, a0, a1) {
  const n = Math.max(8, Math.ceil((Math.abs(a1 - a0) * Math.max(rx, ry)) / 12));
  const out = [];
  for (let i = 0; i <= n; i++) {
    const a = lerp(a0, a1, i / n);
    out.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
  }
  return out;
}

// a chalk stroke: a soft pale band with a broken ink edge
function chalk(ctx, pts, a, seed, w = 1) {
  if (!pts || pts.length < 2 || a <= 0.01) return;
  path(ctx, pts, { w: 11 * w, color: '#faf6ec', alpha: 0.95 * a, seed, wobble: 1.0 });
  path(ctx, pts, { w: 3.4 * w, color: COL.ink, alpha: 0.85 * a, seed: seed + 1, wobble: 1.3 });
  path(ctx, pts, { w: 1.4 * w, color: COL.ink, alpha: 0.4 * a, seed: seed + 2, wobble: 2.6, dash: [12, 8] });
}

// draw one ring: 'back' half (behind the figures) or 'front' half; draw 0..1
// starts at the front (nearest us) and runs round anticlockwise
function ring(ctx, cx, cy, rx, ry, k, part, a, seed, w) {
  if (k <= 0) return;
  const a0 = Math.PI / 2;
  const a1 = a0 + TAU * k;
  const seg = (lo, hi) => {
    const s0 = Math.max(a0, lo);
    const s1 = Math.min(a1, hi);
    if (s1 > s0 + 0.01) chalk(ctx, ringPts(cx, cy, rx, ry, s0, s1), a, seed + Math.round(lo * 10), w);
  };
  if (part === 'back') seg(Math.PI, TAU);
  else {
    seg(Math.PI / 2, Math.PI);
    seg(TAU, TAU + Math.PI / 2);
  }
}

// ---------------------------------------------------------- the others
function longSkirt(ctx, p, j, seed, a = 1) {
  const s = p.s;
  const [hx, hy] = j.hip;
  const bottom = Math.max(j.footA[1], j.footB[1]) - 14 * s;
  const fx = (j.footA[0] + j.footB[0]) / 2;
  const pts = [[hx - 9 * s, hy - 16 * s], [fx - 30 * s, bottom], [fx + 30 * s, bottom], [hx + 9 * s, hy - 16 * s]];
  path(ctx, pts, { w: 3.6 * s, fill: COL.paper, close: true, seed, wobble: 0.5, alpha: a });
}

function bun(ctx, j, p, back, seed, a = 1) {
  const [hx, hy] = j.head;
  const r = j.r;
  const an = j.headAngle;
  const f = p.f;
  const bx = hx - f * Math.cos(an) * r * 0.9 * back + Math.sin(an) * f * r * (back ? 0.35 : 1.05);
  const by = hy - Math.sin(an) * r * 0.9 * back - Math.cos(an) * r * (back ? 0.35 : 1.05);
  ellipse(ctx, bx, by, r * 0.42, r * 0.38, { w: 3, fill: COL.paper, seed, wobble: 0.3, alpha: a });
}

// Úrsula: small, old, quick; she follows him out and stops dead on the line,
// then on every new line, as close as she is allowed
const UR = { s: 1.0 };
const lineX = (r) => X_C - r;
function ursulaAt(lt) {
  // x of her front toe over time
  return keys(lt, [
    [1.95, 1150],
    [3.48, lineX(RINGS[0].r)], // 48.18: toes on the line
    [4.42, lineX(RINGS[0].r)],
    [4.78, lineX(RINGS[1].r)],
    [4.96, lineX(RINGS[1].r)],
    [5.32, lineX(RINGS[2].r)],
  ], ease.inOut);
}

function ursula(ctx, lt, age) {
  const a = 1 - smooth(lt, 6.0, 6.5);
  if (a <= 0.01) return;
  const toe = ursulaAt(lt);
  const v = Math.abs(ursulaAt(lt + 0.02) - toe) / 0.02;
  const moving = v > 12;
  const base = pose({ x: 0, y: standY(FLOOR, UR.s), s: UR.s, f: 1, lean: 0.14, head: 0.05 });
  let p;
  if (moving) {
    const hipX = toe - 18;
    p = pose({ ...base, x: hipX, ...walk(walkPhase(hipX - 1000, UR.s) * 1.4, FLOOR, UR.s, 0.75), lean: 0.2 });
  } else {
    // stopped dead on the line: leaning toward him, hands held out
    const jj = joints({ ...base, lA1: 0.16, lB1: -0.08 });
    const hipX = toe - (jj.footA[0] - jj.hip[0]) - 7;
    p = pose({ ...base, x: hipX, lA1: 0.16, lB1: -0.08, lean: 0.12 + 0.05 * age, head: -0.08 + 0.12 * age });
  }
  const want = smooth(lt, 3.1, 3.5) * (1 - 0.8 * smooth(lt, 5.75, 6.15));
  p.aA1 = lerp(moving ? p.aA1 : 0.15, 1.25 - 0.25 * age, want);
  p.aA2 = lerp(moving ? p.aA2 : 0.2, 0.25, want);
  p.aB1 = lerp(moving ? p.aB1 : -0.1, 0.55, want);
  p.aB2 = lerp(moving ? p.aB2 : 0.2, 0.9, want);
  p.look = -0.2;
  ctx.save();
  ctx.globalAlpha *= a;
  const j = figure(ctx, p, { id: 4 });
  longSkirt(ctx, p, j, 8130);
  bun(ctx, j, p, 1, 8131);
  ctx.restore();
}

// Amaranta stays in the house, her black-wrapped hand at her chest
function amaranta(ctx, lt) {
  const a = 1 - smooth(lt, 4.5, 5.1);
  if (a <= 0.01) return;
  const s = 1.06;
  const p = pose({ x: 1010, y: standY(FLOOR, s), s, f: 1, lean: -0.02, head: 0.1, look: 0.3, aA1: 0.6, aA2: 1.6, aB1: 0.05, aB2: 0.1 });
  ctx.save();
  ctx.globalAlpha *= a;
  const j = figure(ctx, p, { id: 5 });
  longSkirt(ctx, p, j, 8140);
  bun(ctx, j, p, 0, 8141);
  const wrist = [lerp(j.elbowA[0], j.handA[0], 0.62), lerp(j.elbowA[1], j.handA[1], 0.62)];
  path(ctx, [wrist, j.handA], { w: 10 * s, seed: 8142, wobble: 0.2 });
  ellipse(ctx, j.handA[0], j.handA[1], 7.5 * s, 6.5 * s, { w: 0, fill: COL.ink });
  ctx.restore();
}

// two of his officers march up from the other side and stop dead on the line
const AIDE_S = 1.12;
function aides(ctx, lt) {
  const a = 1 - smooth(lt, 4.9, 5.5);
  if (a <= 0.01) return;
  const s = AIDE_S;
  const stand = { lA1: 0.03, lB1: -0.03, lA2: 0, lB2: 0 };
  const jj = joints(pose({ x: 0, y: standY(FLOOR, s), s, f: -1, ...stand }));
  const toeOff = Math.min(jj.footA[0], jj.footB[0]) - 6 * s; // front edge of the boot, left of the hip
  [[0, 8150, 8, 3.28], [1, 8160, 10, 3.4]].forEach(([i, seed, id, tStop]) => {
    const stopX = X_C + RINGS[0].r - toeOff + i * 96; // the first one's toes on the line
    const k = prog(lt, tStop - 0.85, tStop);
    const x = lerp(stopX + 300, stopX, ease.out(k) * 0.4 + k * 0.6);
    const moving = k > 0 && k < 1;
    const p = pose({ x, y: standY(FLOOR, s), s, f: -1, lean: -0.02, aA1: 0.1, aA2: 0.2, ...stand });
    if (moving) Object.assign(p, walk(walkPhase(stopX + 300 - x, s), FLOOR, s, 0.85 * (1 - smooth(k, 0.8, 1))), { x, aA1: 0.1, aA2: 0.2 });
    // the halt: a little rock back on the heels
    p.lean += -0.06 * Math.sin(Math.PI * prog(lt, tStop, tStop + 0.25));
    ctx.save();
    ctx.globalAlpha *= a;
    const j = figure(ctx, p, { id });
    // rifle at the shoulder: butt by the hip, barrel up past the head
    const g = j.handA;
    path(ctx, [[g[0] + 4, g[1] + 22], [g[0] - 6, g[1] - 150 * s]], { w: 4.2, seed, wobble: 0.3 });
    // a little kepi
    const [hx, hy] = j.head;
    fillPoly(ctx, [[hx - 18 * s, hy - 14 * s], [hx + 15 * s, hy - 14 * s], [hx + 13 * s, hy - 30 * s], [hx - 15 * s, hy - 28 * s]], COL.ink, 0.92);
    line(ctx, hx - 28 * s, hy - 13 * s, hx - 4 * s, hy - 13 * s, { w: 3.4, seed: seed + 1, wobble: 0.2 });
    ctx.restore();
  });
}

// ---------------------------------------------------------- shot 1: the workshop
// s07's last camera, continued, then a drift toward the photo and the fish
function s07cam(T) {
  return keys(T, [
    [3.93, { x: 665, y: 616, z: 2.08 }],
    [5.6, { x: 650, y: 624, z: 2.22 }],
  ], ease.sine);
}
function cam1(lt) {
  if (lt < 0.5) return s07cam(5.1 + lt);
  return keys(lt, [
    [0.5, { x: 650, y: 624, z: 2.22 }],
    [1.05, { x: 676, y: 594, z: 2.3 }],
    [1.45, { x: 690, y: 604, z: 2.24 }],
    [2.1, { x: 790, y: 650, z: 1.9 }],
  ], ease.sine);
}

function shot1(ctx, lt, t) {
  const T = lt;
  workshop(ctx, t, { doorLight: 0.7, melquiades: false });
  line(ctx, SHELF.x0, SHELF.y, SHELF.x1, SHELF.y, { w: 3.5, seed: 7100 });
  line(ctx, SHELF.x0 + 14, SHELF.y, SHELF.x0 + 30, SHELF.y + 18, { w: 2.2, seed: 7101 });
  line(ctx, SHELF.x1 - 14, SHELF.y, SHELF.x1 - 30, SHELF.y + 18, { w: 2.2, seed: 7102 });
  [1170, 1225, 1280].forEach((x, i) => doll(ctx, x, SHELF.y - 1, 1.35 + (i === 1 ? 0.15 : 0), { seed: 7110 + i * 3 }));
  bench(ctx, { lampGlow: 0 });
  const anvil = ANVIL();

  // her photograph (still a little askew from the blow), the votive lamp
  const P = PHOTO;
  ctx.save();
  ctx.translate(P.x + P.w / 2, P.y - 22);
  ctx.rotate(0.025);
  ctx.translate(-(P.x + P.w / 2), -(P.y - 22));
  line(ctx, P.x + P.w / 2, P.y - 22, P.x + 14, P.y, { w: 1.6, seed: 7200 });
  line(ctx, P.x + P.w / 2, P.y - 22, P.x + P.w - 14, P.y, { w: 1.6, seed: 7201 });
  dot(ctx, P.x + P.w / 2, P.y - 22, 3);
  mourningPhoto(ctx, P.x, P.y, P.w, P.h, { inner: portrait });
  ctx.restore();
  lamp(ctx, VOTIVE[0], VOTIVE[1], 0.52, 0.85 + 0.15 * Math.sin(t * 7));

  // ---- him: straighten, lay the hammer down, step to the fish
  const up = smooth(T, 0.06, 0.45);
  const step = smooth(T, 0.16, 0.64);
  const x = lerp(522, 646, step);
  const p = pose({ x, y: HIP_Y, s: S, f: 1 });
  if (step > 0 && step < 1) Object.assign(p, walk(walkPhase(x - 522, S), FLOOR, S, 0.55), { x });
  // posture beats
  const lift = smooth(T, 0.72, 1.0); // the fish raised before her photo
  const tuck = smooth(T, 1.3, 1.6); // down into his pocket
  const go = smooth(T, 1.66, 1.95); // he turns to the door
  p.lean = lerp(0.46, 0.12, up) - 0.06 * lift + 0.12 * tuck * (1 - go) - 0.06 * go;
  p.head = lerp(0.56, 0.12, up) + (-0.42) * lift * (1 - tuck) + 0.36 * tuck * (1 - go) - 0.1 * go;
  p.look = lerp(0.6, 0.6, up) - 1.3 * lift * (1 - tuck) + 0.3 * tuck * (1 - go) - 0.5 * go;
  if (go > 0) {
    const wx = lerp(x, x + 70, go);
    Object.assign(p, walk(walkPhase(wx - x, S), FLOOR, S, 0.6 * go), { x: wx });
  }

  // hand A: the hammer down, then the fish up to her photo, then into the pocket
  const hamFrom = [anvil[0] - 30, anvil[1] - 30];
  const hamTo = [654, TOP - 4];
  const grab = [FISH_AT[0] + 4, FISH_AT[1] - 4];
  const high = [712, 528];
  const pf = pocketFrame(p, joints(p));
  const fsPk = PK_FISH.s;
  const handPk = pf.P(PK_FISH.f, PK_FISH.u + (PK_CHAIN + 30 * fsPk) / S);
  let hand;
  if (T < 0.42) {
    const k = smooth(T, 0.06, 0.42);
    hand = [lerp(hamFrom[0], hamTo[0], k), lerp(hamFrom[1], hamTo[1], k) - Math.sin(k * Math.PI) * 18];
  } else if (T < 0.72) {
    const k = smooth(T, 0.42, 0.72);
    hand = [lerp(hamTo[0], grab[0], k), lerp(hamTo[1], grab[1], k) - Math.sin(k * Math.PI) * 26];
  } else if (T < 1.3) {
    hand = [lerp(grab[0], high[0], lift), lerp(grab[1], high[1], lift)];
  } else {
    // an arc down to the pocket; the hand rests there a moment
    hand = [lerp(high[0], handPk[0], tuck) + Math.sin(tuck * Math.PI) * 26, lerp(high[1], handPk[1], tuck)];
  }
  const rA = reach(p, 'A', hand[0], hand[1]);
  p.aA1 = rA.a1;
  p.aA2 = rA.a2;
  // once the fish is in, the hand drops; he walks off toward the door
  if (go > 0) {
    p.aA1 = lerp(p.aA1, 0.1, go);
    p.aA2 = lerp(p.aA2, 0.2, go);
  }
  // hand B rests on the bench edge, then hangs
  const rB = reach(p, 'B', lerp(577, 612, step), TOP + 3);
  const relB = smooth(T, 0.3, 0.6);
  p.aB1 = lerp(rB.a1, -0.08, relB);
  p.aB2 = lerp(rB.a2, 0.15, relB);
  if (go > 0) {
    p.aB1 = lerp(p.aB1, -p.aA1 * 0.6, go);
  }
  const eye = T < 0.22 ? 'closed' : 'dot';
  const j = figure(ctx, p, { id: 1, mustache: true, eye });

  // the hammer: in the hand, then lying on the bench
  if (T < 0.42) hammer(ctx, j.handA[0], j.handA[1], lerp(0.62, 0.02, smooth(T, 0.06, 0.42)), 1);
  else hammer(ctx, hamTo[0], hamTo[1], 0.02, 1);

  // the fish: on the bench, then hanging from his hand, then let down into the pocket
  const inPocket = T >= 1.6;
  if (T < 0.72) {
    fishLeft(ctx, FISH_AT[0], FISH_AT[1], 0.48, { seed: 7300 });
    goldGlow(ctx, FISH_AT[0], FISH_AT[1], 60, 0.45);
  } else if (!inPocket) {
    const len = T < 1.3 ? lerp(10, 40, lift) : lerp(40, PK_CHAIN, tuck);
    const fs = T < 1.3 ? lerp(0.48, 0.52, lift) : lerp(0.52, fsPk, tuck);
    const swing = Math.sin((T - 0.72) * 6.5) * 0.28 * (1 - smooth(T, 0.9, 1.3)) - 0.15 * (1 - lift);
    // the chain hangs straight down (swinging); in the pocket it lies along his chest
    const down = Math.PI / 2 - swing;
    const along = Math.atan2(-pf.up[1], -pf.up[0]);
    const dir = lerp(down, along, tuck);
    const [hx, hy] = j.handA;
    const ex = hx + Math.cos(dir) * len;
    const ey = hy + Math.sin(dir) * len;
    chain(ctx, hx, hy, ex, ey, { step: 6 });
    const cx = ex + Math.cos(dir) * 30 * fs;
    const cy = ey + Math.sin(dir) * 30 * fs;
    const g = smooth(T, 0.95, 1.02) * (1 - smooth(T, 1.08, 1.4));
    goldFish(ctx, cx, cy, fs, dir + Math.PI, { seed: 7300, glint: g });
    goldGlow(ctx, cx, cy, 80, (0.55 + 0.4 * g) * (1 - 0.5 * tuck));
  }
  const lip = pocket(ctx, p, j, { fish: inPocket });
  const g = smooth(T, 1.56, 1.64) * (1 - smooth(T, 1.7, 2.0));
  if (g > 0) {
    sparkle(ctx, lip[0], lip[1] - 4, 24 * g, g);
    goldGlow(ctx, lip[0], lip[1], 70, g);
  }
}

// ---------------------------------------------------------- shot 2: out of the frame
function cam2(lt) {
  // with him at the door (his boots), then back to see the whole yard and the
  // circle; then in, ring by ring, to his chest. While the subtitle shows, the
  // rings' front edges stay above the bottom 180 px.
  return keys(lt, [
    [1.7, { x: 1272, y: 676, z: 1.9 }],
    [2.2, { x: 1400, y: 682, z: 1.85 }],
    [2.75, { x: 1505, y: 650, z: 1.36 }],
    [3.35, { x: 1588, y: 604, z: 1.02 }],
    [4.25, { x: 1622, y: 604, z: 1.1 }],
    [4.85, { x: 1634, y: 652, z: 1.32 }],
    [5.4, { x: 1646, y: 690, z: 1.6 }],
    [5.95, { x: 1656, y: 698, z: 1.9 }],
    // (the pocket ends where s09's fish hangs on screen: a match dissolve)
    [6.5, { x: 1668, y: 662, z: 2.55 }],
    [7.7, { x: 1672, y: 672, z: 3.15 }],
  ], ease.sine);
}

function age(lt) {
  return keys(lt, [
    [4.26, 0],
    [4.62, 0.3],
    [5.12, 0.58],
    [5.62, 0.82],
    [6.2, 1],
  ], ease.inOut);
}

function shot2(ctx, lt, t) {
  const A = age(lt);
  // the house: the workshop frame, emptied of the morning
  const houseA = 1 - 0.35 * smooth(lt, 4.3, 5.6);
  workshop(ctx, t, { doorLight: 0, melquiades: false, alpha: houseA });
  bench(ctx, { lampGlow: 0, alpha: houseA });
  ctx.save();
  ctx.globalAlpha *= houseA;
  line(ctx, SHELF.x0, SHELF.y, SHELF.x1, SHELF.y, { w: 3.5, seed: 7100 });
  [1170, 1225, 1280].forEach((x, i) => doll(ctx, x, SHELF.y - 1, 1.35 + (i === 1 ? 0.15 : 0), { seed: 7110 + i * 3 }));
  const P = PHOTO;
  mourningPhoto(ctx, P.x, P.y, P.w, P.h, { inner: portrait });
  lamp(ctx, VOTIVE[0], VOTIVE[1], 0.52, 0.6);
  ctx.restore();
  // the open ground outside
  path(ctx, [[ROOM.x1 + 200, FLOOR], [ROOM.x1 + 900, FLOOR + 1], [ROOM.x1 + 1700, FLOOR]], { w: 5, seed: 8200 });

  // rings: back halves first
  const ringState = RINGS.map((R, i) => {
    const k = smooth(lt, R.t, R.t + R.d, ease.inOut);
    const next = RINGS[i + 1];
    // rubbed out to a ghost when the next one is drawn; the last climbs to his chest
    let a = 1;
    if (next) a = lerp(1, 0.16, smooth(lt, next.t, next.t + 0.3));
    return { k, a, r: R.r, i };
  });
  const last = ringState[ringState.length - 1];
  const rise = smooth(lt, RISE[0], RISE[1], ease.inOut);

  // ---- him
  const walking = lt < ARRIVE;
  const x = himX(lt);
  const p = pose({ x, y: HIP_Y, s: S, f: 1 });
  if (walking) Object.assign(p, walk(walkPhase(x - WALK.x0, S), FLOOR, S, 0.9 * (1 - smooth(lt, ARRIVE - 0.3, ARRIVE))), { x });
  else Object.assign(p, { y: HIP_Y + 4 * A, lA1: 0.06, lA2: -0.06 * A, lB1: -0.05, lB2: -0.05 * A });
  // standing in the middle: chin up at first; the years bend him
  const settle = smooth(lt, ARRIVE - 0.1, ARRIVE + 0.3);
  p.lean = lerp(p.lean ?? 0.06, 0.02, settle) + 0.27 * A;
  p.head = -0.06 * settle * (1 - A) + 0.22 * A;
  p.look = lerp(0, 0.75, A);
  if (!walking) {
    // arms at his sides; with the years the hands go behind his back
    const jb = joints(p);
    const back = chest(p, jb, -0.04, -13);
    const rA = reach(p, 'A', back.x, back.y);
    const rB = reach(p, 'B', back.x - 3, back.y + 4);
    const hb = smooth(A, 0.1, 0.65);
    p.aA1 = lerp(lerp(p.aA1, 0.1, settle), rA.a1, hb);
    p.aA2 = lerp(lerp(p.aA2, 0.18, settle), rA.a2, hb);
    p.aB1 = lerp(lerp(p.aB1, -0.1, settle), rB.a1, hb);
    p.aB2 = lerp(lerp(p.aB2, 0.18, settle), rB.a2, hb);
  }
  const j0 = joints(p);

  // back halves of the rings (and of the climbing ring)
  for (const R of ringState) {
    if (R.i === last.i && rise > 0) continue;
    ring(ctx, X_C, FLOOR, R.r, R.r * RY, R.k, 'back', R.a, 8300 + R.i * 40, 1);
  }
  const pk = pocketFrame(p, j0).P(9.5, -5.5);
  const climb = () => {
    const cx = lerp(X_C, pk[0], rise);
    const cy = lerp(FLOOR, pk[1], ease.inOut(rise));
    const rx = lerp(last.r, 23, rise);
    const ry = lerp(last.r * RY, 23, ease.in(rise));
    return { cx, cy, rx, ry };
  };
  if (rise > 0 && rise < 0.85) {
    const c = climb();
    ring(ctx, c.cx, c.cy, c.rx, c.ry, 1, 'back', 1, 8460, lerp(1, 0.55, rise));
  }

  amaranta(ctx, lt);
  ursula(ctx, lt, A);
  aides(ctx, lt);

  const j = figure(ctx, p, { id: 1, mustache: false });
  mustache(ctx, p, j, A);
  boots(ctx, p, j);
  const lip = pocket(ctx, p, j, { fish: true });

  // front halves
  for (const R of ringState) {
    if (R.i === last.i && rise > 0) continue;
    ring(ctx, X_C, FLOOR, R.r, R.r * RY, R.k, 'front', R.a, 8300 + R.i * 40, 1);
  }
  if (rise > 0) {
    const c = climb();
    if (rise < 0.85) ring(ctx, c.cx, c.cy, c.rx, c.ry, 1, 'front', 1, 8460, lerp(1, 0.55, rise));
    else {
      // the small circle on his chest (iodine), around the pocket; it beats
      const bt = beat(lt);
      const pts = ringPts(c.cx, c.cy, c.rx * (1 + 0.1 * bt), c.ry * (1 + 0.1 * bt), -2.1, -2.1 + TAU + 0.25);
      path(ctx, pts, { w: 2.8, seed: 8470, wobble: 0.6 });
    }
  }

  // the gold point in the pocket: a glint now and then; at the end it beats
  if (lip) {
    const bt = beat(lt);
    const g = Math.max(0.32 + 0.22 * Math.sin(lt * 3.1), bt);
    goldGlow(ctx, lip[0], lip[1] - 4, 46 + 40 * g, 0.4 + 0.6 * g);
    if (bt > 0.05) goldGlow(ctx, lip[0], lip[1] - 4, 30 + 20 * bt, bt);
    sparkle(ctx, lip[0] + 3, lip[1] - 6, 18 * g, g);
  }
}

export default {
  fadeIn: 0.6,
  fadeOut: 0.6,
  draw(ctx, lt, info) {
    const t = info.t;
    const k = smooth(lt, CUT[0], CUT[1], ease.sine);
    const drawShot = (l, which) => {
      if (which === 1) camera(l, cam1(lt), () => shot1(l, lt, t));
      else camera(l, cam2(lt), () => shot2(l, lt, t));
    };
    if (k <= 0) drawShot(ctx, 1);
    else if (k >= 1) drawShot(ctx, 2);
    else {
      withLayer(ctx, (l) => drawShot(l, 1), { alpha: 1 - k });
      withLayer(ctx, (l) => drawShot(l, 2), { alpha: k });
    }
  },
};
