// s01 — 墙前：拳头里的小金鱼 (0–17.6)
// 第七章：黎明，墓地的墙。他背朝墙站着，脚上是婚礼那天的漆皮靴，六支枪瞄准了他。
// 他以为死亡会以明确的、毫不含糊的预感宣告其到来——直到最后一刻，预感也没有来。
// "当行刑队瞄准他的时候……迫使他闭上眼睛。那一瞬间晨曦的银白色光芒隐没。"
// 本片的处理：他的拳头里攥着那条小金鱼的细链。
//
// Shots (scene seconds = film seconds):
//   A 0.0–8.0   a lone gold glint on the paper; pull back while the world
//               draws itself in: dawn, the long wall (a frame), his long
//               shadow on it, a bird; six rifle barrels slide in, trembling;
//               the bird flies off; slow push in to a medium shot; he lifts
//               his fist and looks at it; the fish glints
//   B 8.0–10.8  close: his fist, the fine chain, the fish turning on it and
//               catching the light; the fist tightens
//   C 10.8–13.8 his face: he closes his eyes; the dawn light goes out
//   D 13.8–17.6 medium close, eyes shut: the fish swings like a pendulum while
//               the rifles wait and a bird crosses the sky; the sign never
//               comes; the swing dies away and the camera pushes into the
//               gold, which opens the picture up into s02
import { W, H, COL, TAU, clamp, lerp, prog, smooth, ease, hash, noise1, rng, path, line, ellipse, ellipsePts, dot, fillPoly, camera, paper } from '../lib.js';
import { figure, pose, reach, standY } from '../figure.js';
import { goldFish, goldGlow } from '../props.js';
import { frameBox, bird } from '../sets.js';

const G = 820; // the ground in the wall shot
const ME = { x: 640, s: 1.2 };
const WALL = { x0: 110, x1: 1810, top: 372 };
const XF = 0.5; // dissolve between shots

// ------------------------------------------------------------ helpers
// a fine chain whose links scale with the shot
function fineChain(ctx, x1, y1, x2, y2, k = 1, alpha = 1) {
  const len = Math.hypot(x2 - x1, y2 - y1);
  const n = Math.max(3, Math.round(len / (6.2 * k)));
  const ang = Math.atan2(y2 - y1, x2 - x1);
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.strokeStyle = COL.ink;
  ctx.lineWidth = Math.max(1, 1.25 * k);
  for (let i = 0; i < n; i++) {
    const u = (i + 0.5) / n;
    ctx.beginPath();
    if (i % 2) ctx.ellipse(lerp(x1, x2, u), lerp(y1, y2, u), 2.5 * k, 1.5 * k, ang, 0, TAU);
    else ctx.ellipse(lerp(x1, x2, u), lerp(y1, y2, u), 2.3 * k, 0.8 * k, ang, 0, TAU);
    ctx.stroke();
  }
  ctx.restore();
}

// the fish hanging mouth-up on its chain from (hx, hy); returns its centre
function hangFish(ctx, hx, hy, len, swing, s, o = {}) {
  const ex = hx + Math.sin(swing) * len;
  const ey = hy + Math.cos(swing) * len;
  fineChain(ctx, hx, hy, ex, ey, o.k ?? 1, o.chainAlpha ?? 1);
  const ang = Math.atan2(hy - ey, hx - ex);
  const cx = ex - Math.cos(ang) * 30 * s;
  const cy = ey - Math.sin(ang) * 30 * s;
  if (o.turn === undefined || Math.abs(o.turn - 1) < 1e-3) goldFish(ctx, cx, cy, s, ang, o);
  else {
    // turning on its chain: squeeze it across its long axis
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(ang);
    ctx.scale(1, Math.sign(o.turn || 1) * Math.max(0.08, Math.abs(o.turn)));
    goldFish(ctx, 0, 0, s, 0, o);
    ctx.restore();
  }
  return [cx, cy];
}

// cold breath at dawn: a small curl of vapour drifting from the mouth. k: 0..1 life
function breath(ctx, x, y, k, s, seed) {
  if (k <= 0 || k >= 1) return;
  const a = Math.sin(k * Math.PI) * 0.5;
  for (let j = 0; j < 2; j++) {
    const pts = [];
    for (let i = 0; i <= 10; i++) {
      const u = i / 10;
      pts.push([x + (u * 22 + k * 16 + j * 4) * s, y - (k * 12 + j * 6) * s + Math.sin(u * 6 + k * 5 + j) * (1.5 + 2.5 * k) * s]);
    }
    path(ctx, pts, { w: Math.max(1.2, 1.5 * s), alpha: a * (1 - j * 0.35), seed: seed + j, wobble: 0.3 });
  }
}

// precomputed brick marks on the wall face (world units of the wall shot)
const BRICKS = (() => {
  const r = rng(11);
  const out = [];
  for (let y = WALL.top + 40; y < G - 20; y += 44) {
    let x = WALL.x0 + 30 + r() * 80;
    while (x < WALL.x1 - 120) {
      const len = 70 + r() * 50;
      if (r() < 0.32) out.push([x, y, len]);
      x += len + 30 + r() * 140;
    }
  }
  return out;
})();

function bricks(ctx, alpha, seed0 = 5600) {
  BRICKS.forEach(([x, y, len], i) => {
    path(ctx, [[x, y], [x + len, y + 1]], { w: 2, alpha: alpha * (0.6 + 0.4 * hash(i)), seed: seed0 + i, wobble: 0.8 });
    if (i % 2) path(ctx, [[x + len * 0.5, y], [x + len * 0.5 + 1, y + 44]], { w: 1.6, alpha: alpha * 0.5, seed: seed0 + 200 + i, wobble: 0.6 });
  });
}

// soft (out of focus) layer: draw at quarter size and scale up.
// o.world: draw with ctx's current transform (e.g. inside camera()).
let softCanvas = null;
function soft(ctx, fn, alpha = 1, o = {}) {
  const q = 0.25;
  if (alpha <= 0.002) return;
  if (!softCanvas) {
    softCanvas = document.createElement('canvas');
    softCanvas.width = W * q;
    softCanvas.height = H * q;
  }
  const c = softCanvas.getContext('2d');
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.globalAlpha = 1;
  c.clearRect(0, 0, softCanvas.width, softCanvas.height);
  if (o.world) {
    const m = ctx.getTransform();
    c.setTransform(q * m.a, q * m.b, q * m.c, q * m.d, q * m.e, q * m.f);
  } else c.setTransform(q, 0, 0, q, 0, 0);
  fn(c);
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha *= alpha;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'low';
  ctx.drawImage(softCanvas, 0, 0, W, H);
  ctx.restore();
}

// six rifle barrels from the right edge, muzzles at mx (+ stagger), aiming left
function barrels(ctx, t, mxs, y0, dy, o = {}) {
  const w = o.w ?? 5;
  for (let i = 0; i < mxs.length; i++) {
    const mx = mxs[i];
    if (mx > (o.edge ?? W) + 40) continue;
    const tremble = (o.tremble ?? 0) * noise1(t * 3.1, 40 + i);
    const y = y0 + i * dy + tremble;
    const a = o.ang ? o.ang[i] : 0;
    const L = o.len ?? 1400;
    const ex = mx + Math.cos(a) * L;
    const ey = y + Math.sin(a) * L;
    path(ctx, [[mx, y], [ex, ey]], { w, seed: 5300 + i, wobble: 0.4, alpha: o.alpha });
    // muzzle ring and front sight
    path(ctx, [[mx, y - w * 0.9], [mx, y + w * 0.9]], { w: w * 0.6, seed: 5310 + i, wobble: 0, alpha: o.alpha });
    path(ctx, [[mx + w * 6, y - w * 0.5], [mx + w * 6.6, y - w * 1.6]], { w: w * 0.55, seed: 5320 + i, wobble: 0, alpha: o.alpha });
  }
}

// his eye in a close shot: k = 0 open (a dot) .. 1 closed (a curved lid)
function bigEye(ctx, j, s, k, seed, alpha = 1) {
  const [hx, hy] = j.head;
  const r = j.r;
  const a = j.headAngle;
  const ex = hx + Math.cos(a) * r * 0.45 + Math.sin(a) * r * 0.12;
  const ey = hy + Math.sin(a) * r * 0.45 - Math.cos(a) * r * 0.12;
  const er = 2.9 * s;
  if (k < 0.98) ellipse(ctx, ex, ey + er * 0.35 * k, er, Math.max(0.5, er * (1 - k)), { w: 0, fill: COL.ink, alpha });
  if (k > 0.5) {
    const c = Math.cos(a);
    const sn = Math.sin(a);
    const P = (px, py) => [ex + px * c - py * sn, ey + px * sn + py * c];
    path(ctx, [P(-er * 1.3, er * 0.15), P(0, er * 0.6), P(er * 1.3, er * 0.2)], { w: Math.max(2.5, 1.2 * s), alpha: alpha * smooth(k, 0.5, 0.9), seed, wobble: 0.3 });
  }
}

// a small perched bird, ink silhouette; f = facing; tilt = head
function perchedBird(ctx, x, y, s, f, tilt, o = {}) {
  const a = o.alpha ?? 1;
  ellipse(ctx, x, y - 9 * s, 12 * s, 7.5 * s, { w: 0, fill: COL.ink, alpha: a });
  const hx = x + f * 10 * s;
  const hy = y - 17 * s + tilt * 3 * s;
  dot(ctx, hx, hy, 5.2 * s, COL.ink, a);
  fillPoly(ctx, [[hx + f * 4 * s, hy - 2 * s], [hx + f * 11 * s, hy + 0.5 * s], [hx + f * 4 * s, hy + 2.5 * s]], COL.ink, a);
  fillPoly(ctx, [[x - f * 8 * s, y - 11 * s], [x - f * 22 * s, y - 15 * s], [x - f * 21 * s, y - 8 * s]], COL.ink, a);
  path(ctx, [[x - 2 * s, y - 3 * s], [x - 3 * s, y + 1]], { w: 1.4, seed: 5450, wobble: 0, alpha: a });
  path(ctx, [[x + 3 * s, y - 3 * s], [x + 3 * s, y + 1]], { w: 1.4, seed: 5451, wobble: 0, alpha: a });
}

// His fist from the side, thumb toward us, the forearm coming in from the
// left (he holds it up in front of his chest). (x, y): centre of the hand;
// k: scale (1 => ~120 px wide). Returns where the chain comes out.
function fist(ctx, x, y, k, o = {}) {
  const sq = o.squeeze ?? 0;
  const P = (px, py) => [x + px * k * (1 - 0.03 * sq), y + py * k * (1 - 0.04 * sq)];
  const w = o.w ?? 5.5;
  const sd = o.seed ?? 5000;
  const a = o.alpha ?? 1;
  // forearm: a thick stick-figure limb (his dark sleeve) coming in from the left
  const ax = o.armFrom ?? [-900, 60];
  path(ctx, [P(ax[0], ax[1]), P(-300, 18), P(-52, 2)], { w: o.armW ?? 26 * k, seed: sd + 9, wobble: 0.8, alpha: a });
  const lobe = (cx, cy, rx, ry) => ellipsePts(cx, cy, rx, ry, -Math.PI / 2, Math.PI / 2, 7).map(([px, py]) => P(px, py));
  const pts = [
    P(-58, -30), P(-34, -44), P(-2, -50), P(30, -48),
    ...lobe(48, -34, 12, 13), // index
    ...lobe(52, -10, 12, 11), // middle
    ...lobe(49, 12, 11, 11), // ring
    ...lobe(42, 32, 10, 10), // little finger
    P(18, 48), P(-14, 50), P(-40, 44), P(-58, 30),
  ];
  path(ctx, pts, { w, fill: COL.paper, close: true, seed: sd, wobble: 0.5, alpha: a });
  // the curled fingers
  path(ctx, [P(48, -21), P(24, -22)], { w: w * 0.7, seed: sd + 1, wobble: 0.3, alpha: a });
  path(ctx, [P(52, 1), P(28, 0)], { w: w * 0.7, seed: sd + 2, wobble: 0.3, alpha: a });
  path(ctx, [P(46, 23), P(22, 22)], { w: w * 0.7, seed: sd + 3, wobble: 0.3, alpha: a });
  // the thumb lying across them, with its nail
  path(ctx, [P(-44, 22), P(-20, 0), P(10, -16), P(34, -22), P(42, -14), P(36, -4), P(10, 2), P(-14, 18), P(-30, 34)], { w: w * 0.9, seed: sd + 5, wobble: 0.4, alpha: a, fill: COL.paper });
  path(ctx, [P(30, -19), P(36, -14), P(32, -8)], { w: w * 0.5, seed: sd + 6, wobble: 0.2, alpha: a * 0.8 });
  // a knuckle line on the back of the hand
  path(ctx, [P(-30, -36), P(-4, -40), P(22, -38)], { w: w * 0.45, seed: sd + 4, wobble: 0.4, alpha: a * 0.45 });
  return P(34, 44);
}

// ------------------------------------------------------------ shot A: the wall
const HIP_Y = standY(G, ME.s);
const MUZZLES = [1080, 1094, 1108, 1080, 1094, 1108];
const FIST_A = [ME.x + 32, HIP_Y + 40]; // where the fish hangs at the start
function shotWall(ctx, lt) {
  const T = Math.max(0, lt);
  // open tight on the gold in his fist and pull back to the wide shot while the
  // world draws itself in; then a slow, decisive push to a medium shot
  let cam;
  if (T < 3.2) {
    const k = smooth(T, 0, 3.2, ease.inOut);
    cam = { x: lerp(FIST_A[0], 960, k), y: lerp(FIST_A[1], 540, k), z: Math.exp(lerp(Math.log(3.5), 0, k)) };
  } else {
    const u = prog(T, 3.2, 8.3);
    const f = 0.1 * u + 0.9 * Math.pow(u, 2.2);
    cam = { x: lerp(960, 800, f), y: lerp(540, 566, f), z: Math.exp(lerp(0, Math.log(2.35), f)) };
  }
  const dawn = 0.3 + 0.7 * smooth(T, 0, 7.5);
  const on = smooth(T, 0.5, 2.0, ease.out);

  // him: stands; lifts his fist in front of his chest at 5.0 and looks at it
  const lift = smooth(T, 5.0, 6.2);
  const breathe = Math.sin(T * 2.4);
  const p = pose({ x: ME.x, y: HIP_Y, s: ME.s, f: 1, lean: -0.015 + 0.008 * breathe + 0.03 * lift, head: lerp(-0.05, 0.4, smooth(T, 4.9, 5.9)), look: smooth(T, 4.9, 5.9), aB1: -0.12, aB2: 0.16 });
  const hand = [lerp(ME.x + 32, ME.x + 64, lift), lerp(HIP_Y + 8 - 1.2 * breathe, 616, lift)];
  const r = reach(p, 'A', hand[0], hand[1]);
  p.aA1 = r.a1;
  p.aA2 = r.a2;
  const himA = smooth(T, 0.7, 1.7);
  const mxs = [];
  for (let i = 0; i < 6; i++) mxs.push(lerp(2150, MUZZLES[i], smooth(T, 2.0 + i * 0.15, 3.0 + i * 0.15, ease.out)));

  camera(ctx, cam, () => {
    // dawn: silver-white light rising behind the wall (east, screen right)
    ctx.save();
    const g = ctx.createLinearGradient(0, WALL.top, 0, WALL.top - 380);
    g.addColorStop(0, `rgba(255,252,242,${0.75 * dawn})`);
    g.addColorStop(1, 'rgba(255,252,242,0)');
    ctx.fillStyle = g;
    ctx.fillRect(-400, WALL.top - 380, W + 800, 380);
    const g2 = ctx.createRadialGradient(1640, WALL.top, 0, 1640, WALL.top, 820);
    g2.addColorStop(0, `rgba(255,253,246,${0.85 * dawn})`);
    g2.addColorStop(1, 'rgba(255,253,246,0)');
    ctx.fillStyle = g2;
    ctx.fillRect(820, WALL.top - 820, 1640, 1640);
    ctx.restore();
    // long thin clouds drifting
    const cd = smooth(T, 0.4, 1.6);
    path(ctx, [[1180 + T * 4, 190], [1420 + T * 4, 186]], { w: 2.2, alpha: 0.35 * cd, seed: 5500 });
    path(ctx, [[1290 + T * 4, 214], [1610 + T * 4, 210]], { w: 2.2, alpha: 0.28 * cd, seed: 5501 });
    path(ctx, [[260 + T * 3, 238], [420 + T * 3, 236]], { w: 2, alpha: 0.22 * cd, seed: 5502 });
    // the cemetery beyond the wall: a few crosses
    const beyond = smooth(T, 0.6, 1.8) * 0.45;
    for (const [cx, ch, i] of [[300, 62, 0], [372, 44, 1], [1380, 56, 2], [1462, 40, 3]]) {
      line(ctx, cx, WALL.top, cx, WALL.top - ch, { w: 3, alpha: beyond, seed: 5520 + i });
      line(ctx, cx - 13, WALL.top - ch + 16, cx + 13, WALL.top - ch + 16, { w: 3, alpha: beyond, seed: 5530 + i });
    }
    // the long wall: a frame
    frameBox(ctx, WALL.x0, WALL.top, WALL.x1 - WALL.x0, G - WALL.top, { w: 5.5, draw: on, seed: 5540 });
    bricks(ctx, 0.17 * smooth(T, 0.8, 2.2));
    // the low sun (east, screen right) throws his long shadow, and the rifles', on the wall
    soft(ctx, (c) => {
      c.save();
      c.translate(p.x, G);
      c.transform(1.05, 0, 0.5, 1.1, 0, 0);
      c.translate(-p.x, -G);
      figure(c, p, { id: 1, mustache: true, w: 12, eye: 'none', headFill: COL.ink, alpha: 0.14 * dawn * himA });
      c.restore();
      barrels(c, T, mxs.map((m) => m - 150), 512, 20, { w: 8, alpha: 0.08 * dawn });
    }, 1, { world: true });
    // the ground
    // the ground draws itself outward from under his feet
    const gd = smooth(T, 0.35, 1.9, ease.out);
    line(ctx, ME.x, G, -300, G, { w: 4.5, seed: 5550, draw: gd });
    line(ctx, ME.x, G, W + 300, G, { w: 4.5, seed: 5551, draw: gd });
    for (let i = 0; i < 9; i++) {
      const gx = -120 + i * 260 + hash(i + 3) * 90;
      const gy = G + 34 + hash(i) * 40;
      line(ctx, gx, gy, gx + 30 + hash(i + 1) * 30, gy, { w: 2, alpha: 0.25 * on, seed: 5560 + i });
    }

    // the bird on the wall: turns its head toward the rifles, flies off when they are aimed
    const flyK = prog(T, 3.6, 5.6);
    if (flyK <= 0) {
      const turned = T > 2.45 ? 1 : -1;
      const hop = T > 2.45 && T < 2.6 ? -4 : 0;
      perchedBird(ctx, 1150, WALL.top - 3 + hop, 1.05, turned, Math.sin(T * 2.2) > 0.6 ? 1 : 0, { alpha: smooth(T, 0.9, 1.6) });
    } else if (flyK < 1) {
      const fk = ease.in(flyK);
      bird(ctx, 1150 + fk * 760, WALL.top - 14 - fk * 330 - Math.sin(flyK * 3) * 30, 1.1, T * 3.2, { seed: 5460, w: 3 });
    }

    // rifles: six barrels slide in from the right and settle on him, trembling a little
    barrels(ctx, T, mxs, 548, 20, { tremble: 1.3 * smooth(T, 3.6, 4.6), edge: 2100 });

    const j = figure(ctx, p, { id: 1, mustache: true, boots: 'black', alpha: himA });
    // breath at dawn
    for (const [b0, i] of [[0.9, 0], [3.2, 1], [5.6, 2], [7.5, 3]]) {
      const [hx, hy] = j.head;
      const dn = smooth(T, 4.9, 5.9);
      breath(ctx, hx + j.r * (1.15 - 0.3 * dn), hy + j.r * (0.35 + 0.45 * dn), prog(T, b0, b0 + 1.5), ME.s * 0.9, 5470 + i * 3);
    }
    // the fish in his fist: swings when he lifts it; a glint when he looks at it
    const glint = Math.max(Math.sin(Math.PI * prog(T, 0.15, 1.15)), 0.45 * Math.sin(Math.PI * prog(T, 2.2, 2.9)), Math.sin(Math.PI * prog(T, 6.2, 7.2)));
    const after = Math.max(0, T - 6.2);
    const swing = 0.05 * Math.sin(T * 1.7 + 0.4) - 0.3 * Math.sin(Math.PI * prog(T, 5.0, 6.2)) + (T > 6.2 ? 0.16 * Math.exp(-after * 1.3) * Math.sin(after * 4.6) : 0);
    const fishA = smooth(T, -0.2, 0.25);
    goldGlow(ctx, j.handA[0] + Math.sin(swing) * 30, j.handA[1] + 44, 40 + 40 * glint, fishA * (0.4 + 0.6 * glint));
    hangFish(ctx, j.handA[0], j.handA[1] + 2, 30, swing, 0.42, { k: 0.55, seed: 5200, glint, alpha: fishA, chainAlpha: himA });
  });
}

// ------------------------------------------------------------ shot B: the fist
function shotFist(ctx, lt) {
  const u = lt - 8.0;
  const z = 1 + 0.06 * smooth(lt, 7.7, 11.1, ease.linear);
  soft(ctx, (c) => {
    // the wall face behind his hand, the light from the east
    const g = c.createLinearGradient(W, 0, W * 0.35, 0);
    g.addColorStop(0, 'rgba(255,252,242,0.85)');
    g.addColorStop(1, 'rgba(255,252,242,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, W, H);
    for (let i = 0; i < 6; i++) {
      const y = 110 + i * 150;
      const x = ((i * 397) % 900) + 120;
      path(c, [[x, y], [x + 300, y + 3]], { w: 7, alpha: 0.25, seed: 5700 + i });
      path(c, [[x + 1100 - i * 60, y + 70], [x + 1380 - i * 60, y + 72]], { w: 7, alpha: 0.2, seed: 5710 + i });
    }
  }, 1);
  camera(ctx, { x: 960, y: 480, z }, () => {
    const sq = smooth(lt, 9.55, 9.95) * (1 - smooth(lt, 10.4, 10.9));
    const out = fist(ctx, 800, 300, 1.85, { squeeze: sq, w: 7, seed: 5000, armFrom: [-700, 80], armW: 22 });
    const turn = Math.cos(0.95 * Math.sin(u * 1.15 - 0.5));
    const glint = Math.sin(Math.PI * prog(lt, 8.45, 9.35)) + 0.7 * Math.sin(Math.PI * prog(lt, 10.05, 10.65));
    const swing = 0.07 * Math.sin(u * 1.9 + 0.6) - 0.05 * sq;
    const fc = hangFish(ctx, out[0], out[1], 230, swing, 2.0, { k: 2.1, seed: 5210, glint: clamp(glint), w: 4.2, turn });
    goldGlow(ctx, fc[0], fc[1], 220 + 120 * glint, 0.55 + 0.45 * clamp(glint));
  });
}

// ------------------------------------------------------------ shot C: his face
function shotFace(ctx, lt) {
  const close = smooth(lt, 11.65, 12.45, ease.inOut);
  const dim = smooth(lt, 11.9, 13.0);
  const z = 1 + 0.07 * smooth(lt, 10.4, 14.2, ease.linear);
  // background: the wall face, the dawn light from the right; it goes out when he closes his eyes
  soft(ctx, (c) => {
    const g = c.createLinearGradient(W, 0, W * 0.3, 0);
    g.addColorStop(0, `rgba(255,252,242,${0.85 * (1 - 0.85 * dim)})`);
    g.addColorStop(1, 'rgba(255,252,242,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, W, H);
    for (let i = 0; i < 5; i++) {
      const y = 90 + i * 190;
      path(c, [[60 + i * 70, y], [420 + i * 70, y + 3]], { w: 8, alpha: 0.2, seed: 5800 + i });
      path(c, [[1240 - i * 40, y + 90], [1560 - i * 40, y + 92]], { w: 8, alpha: 0.16, seed: 5810 + i });
    }
  }, 1);
  camera(ctx, { x: 900, y: 520, z }, () => {
    const s = 6.0;
    const nod = lerp(-0.06, 0.07, close);
    const p = pose({ x: 690, y: 1175, s, f: 1, lean: 0.0, head: nod, look: 0, aA1: 0, aA2: 0, aB1: 0, aB2: 0 });
    const j = figure(ctx, p, { id: 1, mustache: true, w: 11, eye: 'none' });
    // the eye: a dot that slowly closes into a curved lid
    bigEye(ctx, j, s, close, 5900);
    const [hx, hy] = j.head;
    const r = j.r;
    // breath: steady, then held when the eyes close; one long breath out at the end
    breath(ctx, hx + r * 1.2, hy + r * 0.5, prog(lt, 10.7, 11.9), s * 0.6, 5910);
    breath(ctx, hx + r * 1.2, hy + r * 0.5, prog(lt, 12.9, 14.4), s * 0.65, 5913);
  });
  // the six barrels, close, pointing at his head
  const mx = [];
  for (let i = 0; i < 6; i++) mx.push(1400 + (i % 3) * 22 + i * 6);
  barrels(ctx, lt, mx, 290, 52, { w: 9, tremble: 2.2 });
  // the light goes out
  ctx.save();
  const v = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, W * 0.75);
  v.addColorStop(0, `rgba(60,48,34,${0.05 * dim})`);
  v.addColorStop(1, `rgba(60,48,34,${0.3 * dim})`);
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

// ------------------------------------------------------------ shot D: the pendulum
// A medium close: his profile, eyes shut; the fish hangs from his raised fist
// and swings like a pendulum; the rifles wait, out of focus.
const DS = 4.5;
const D_HIP = [455, 850];
const D_HAND = [700, 590];
const D_CHAIN = 175;
const D_FISH = 1.9;
const D_REST = [D_HAND[0], D_HAND[1] + D_CHAIN + 30 * D_FISH];
function shotSwing(ctx, lt) {
  const u = lt - 13.8;
  const push = smooth(lt, 15.9, 17.9, ease.in);
  // the swing: wide and slow; it dies away before the push
  const amp = 0.4 * (1 - smooth(lt, 14.9, 16.3, ease.inOut));
  const swing = amp * Math.cos(u * (TAU / 2.4) + 0.5);
  const z = Math.exp(lerp(0, Math.log(8), push));
  const toward = smooth(lt, 15.4, 16.9);
  const drift = 1 + 0.04 * smooth(lt, 13.6, 16, ease.linear);
  const cam = { x: lerp(960, D_REST[0], toward), y: lerp(540, D_REST[1], toward), z: z * drift };
  const bg = 1 - smooth(lt, 15.9, 16.8);
  const light = 0.7 + 0.3 * smooth(lt, 13.8, 15.8); // the light slowly comes back
  // out of focus: the dawn sky over the wall, the rifles, a bird
  soft(ctx, (c) => {
    const g = c.createLinearGradient(W, 0, W * 0.3, 0);
    g.addColorStop(0, `rgba(255,252,242,${0.85 * light})`);
    g.addColorStop(1, 'rgba(255,252,242,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, W, H);
    path(c, [[-50, 150], [W + 50, 158]], { w: 12, alpha: 0.5, seed: 5840 });
    for (let i = 0; i < 6; i++) {
      const y = 260 + i * 150;
      path(c, [[1000 + ((i * 331) % 700), y], [1260 + ((i * 331) % 700), y + 3]], { w: 9, alpha: 0.18, seed: 5850 + i });
    }
    for (const [cx, i] of [[180, 0], [1560, 1]]) {
      path(c, [[cx, 150], [cx, 50]], { w: 10, alpha: 0.4, seed: 5860 + i });
      path(c, [[cx - 26, 82], [cx + 26, 82]], { w: 10, alpha: 0.4, seed: 5862 + i });
    }
    const mx = [];
    for (let i = 0; i < 6; i++) mx.push(1380 + (i % 3) * 30);
    barrels(c, lt, mx, 300, 46, { w: 14, tremble: 2.5, alpha: 0.75 });
    const bk = prog(lt, 13.9, 16.6);
    if (bk > 0 && bk < 1) bird(c, lerp(760, 1900, bk), 110 - Math.sin(bk * Math.PI) * 50, 2.4, lt * 3, { seed: 5830, w: 7 });
  }, bg);
  camera(ctx, cam, () => {
    const breathe = Math.sin(lt * 1.9);
    const p = pose({ x: D_HIP[0], y: D_HIP[1], s: DS, f: 1, lean: 0.05 + 0.006 * breathe, head: 0.3, look: 0.8, aB1: -0.1, aB2: 0.15 });
    const r = reach(p, 'A', D_HAND[0], D_HAND[1] - 1.5 * breathe);
    p.aA1 = r.a1;
    p.aA2 = r.a2;
    const j = figure(ctx, p, { id: 1, mustache: true, w: 9.5, eye: 'none', alpha: bg });
    bigEye(ctx, j, DS, 1, 5905, bg);
    // the gold light opens the picture up; the fish stays on top of it
    const bloom = smooth(lt, 16.4, 17.9);
    if (bloom > 0) {
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      const g = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W * 0.75);
      g.addColorStop(0, `rgba(255,244,215,${0.95 * bloom})`);
      g.addColorStop(0.55, `rgba(250,238,210,${0.75 * bloom})`);
      g.addColorStop(1, `rgba(236,226,206,${0.6 * bloom})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }
    const glint = 0.3 + 0.7 * Math.max(0, Math.sin(lt * 2.6 + 1)) * (1 - push) + 1.2 * smooth(lt, 16.2, 17.4);
    const fw = Math.max(1.4, 2.4 * D_FISH) / Math.pow(z, 0.8);
    const hand = [j.handA[0], j.handA[1] + 2];
    const ex = hand[0] + Math.sin(swing) * D_CHAIN;
    const ey = hand[1] + Math.cos(swing) * D_CHAIN;
    goldGlow(ctx, lerp(ex, D_REST[0], push), lerp(ey + 40, D_REST[1], push), 160 + 220 * push, 0.6 + 0.4 * push);
    hangFish(ctx, hand[0], hand[1], D_CHAIN, swing, D_FISH, { k: 1.6, seed: 5220, glint: Math.min(1.5, glint), w: fw, chainAlpha: 1 - push, turn: lerp(Math.cos(0.6 * Math.sin(u * 1.3)), 1, push) });
  });
}

const SHOTS = [
  { a: -9, fn: shotWall },
  { a: 8.0, fn: shotFist },
  { a: 10.8, fn: shotFace },
  { a: 13.8, fn: shotSwing },
];

export default {
  fadeOut: 0.8,
  draw(ctx, lt) {
    // each shot dissolves in over the one before it (opaque paper underneath)
    let base = true;
    for (let i = 0; i < SHOTS.length; i++) {
      const s = SHOTS[i];
      const next = SHOTS[i + 1];
      if (next && lt >= next.a + XF / 2) continue;
      const k = smooth(lt, s.a - XF / 2, s.a + XF / 2, ease.sine);
      if (k <= 0) continue;
      if (base) {
        s.fn(ctx, lt);
        base = false;
      } else {
        // cover the outgoing shot with paper and draw the new one, both at k
        ctx.save();
        ctx.globalAlpha *= k;
        paper(ctx);
        s.fn(ctx, lt);
        ctx.restore();
      }
    }
  },
};
