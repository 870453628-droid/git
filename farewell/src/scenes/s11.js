// s11 — 辗转四季，有些人一旦在人海走散，真的就再也见不到了。
//
// He walks. Behind him a tree runs through the seasons in a breath: full
// leaves, leaves falling, bare branches in snow, blossoms. Then people pour in
// from both sides — a sea of identical figures crossing both ways. He stops,
// looks around ... and between the bodies, a ponytail with a gold tie, walking
// away. He pushes toward her, arm out; the crowd closes in front of her, and
// when it opens again she is gone. He searches. The crowd thins away to
// nothing and he is left standing alone in the empty space.
import { W, COL, TAU, clamp, lerp, smooth, keys, ease, hash, rng, path, line, ellipsePts, dot, fillPoly, hatch, camera } from '../lib.js';
import { figure, pose, walk, walkPhase, standY, REACH } from '../figure.js';

const G = 830; // ground (s12 keeps the same ground line)
const S = 1.05;

// ------------------------------------------------------------ timing (global)
const T = {
  autumn: 87.72, winter: 88.1, spring: 88.46, treeOut0: 88.72, treeOut1: 89.1,
  stop: 88.95, // he stops in the crowd
  look0: 88.95, look1: 89.2, // looks around
  see: 89.2, // 有些人: there she is
  push0: 89.38, push1: 90.15, // pushes toward her
  lost0: 90.02, lost1: 90.32, // 走散: the crowd closes over her
  search0: 90.45, search1: 91.25,
  thin0: 90.8, thin1: 92.0, // 真的就再也见不到了: the crowd thins away
};

// ------------------------------------------------------------ him
const BX0 = 1720; // strolls in from the right (left of the fading poem's columns)
const BX_STOP = 1390;
const BX_PUSH = 1130;
function boyX(t) {
  return keys(t, [[87.0, BX0], [T.stop, BX_STOP], [T.push0, BX_STOP], [T.push1, BX_PUSH]], ease.linear);
}
function boyPose(t) {
  const x = boyX(t);
  // walking phase from distance travelled
  const walking = t < T.stop + 0.05 ? 1 - smooth(t, T.stop - 0.25, T.stop + 0.05) : 0;
  const pushing = smooth(t, T.push0, T.push0 + 0.12) * (1 - smooth(t, T.push1 - 0.15, T.push1 + 0.05));
  const amt = Math.max(walking, pushing * 1.15);
  const dist = Math.abs(x - BX0);
  const w = walk(walkPhase(dist, S), G, S, Math.min(1, amt));
  let p = pose({ x, s: S, f: -1, ...w });
  if (amt < 0.02) p = pose({ x, s: S, f: -1, y: standY(G, S) });

  // looking around when the crowd closes in (front view, head turning)
  const look = smooth(t, T.look0, T.look0 + 0.08) * (1 - smooth(t, T.see - 0.06, T.see + 0.02));
  if (look > 0.5) {
    p = pose({ x, s: S, y: standY(G, S), view: 'front', turn: lerp(0.7, -0.8, smooth(t, T.look0, T.see)), aA1: 0.12, aB1: 0.12, lA1: 0.04, lB1: 0.04 });
  }
  // there she is: he leans toward her, then pushes with his arm out
  const lean = smooth(t, T.see, T.see + 0.18);
  const reach = smooth(t, T.push0 - 0.05, T.push0 + 0.3);
  const sag = smooth(t, T.lost1, T.search0 + 0.05); // she's gone: the arm gives
  if (t >= T.see && t < T.search0) {
    p.lean += 0.12 * lean * (1 - sag) + 0.08 * pushing;
    p.head = -0.12 * lean + 0.12 * sag;
    p.look = -0.2 + 0.5 * sag;
    p.aA1 = lerp(p.aA1, lerp(REACH.aA1 + 0.15, 1.0, sag), reach);
    p.aA2 = lerp(p.aA2, lerp(REACH.aA2 + 0.12, 0.3, sag), reach);
  }
  // gone: he searches, turning this way and that
  if (t >= T.search0 && t < T.search1) {
    const k = (t - T.search0) / (T.search1 - T.search0);
    const turn = Math.sin(k * Math.PI * 2.2) * 0.85;
    p = pose({ x, s: S, y: standY(G, S), view: 'front', turn, head: 0.04 * turn, aA1: lerp(1.0, 0.12, smooth(t, T.search0, T.search0 + 0.4)), aA2: lerp(0.3, 0.1, smooth(t, T.search0, T.search0 + 0.4)), aB1: 0.12, lA1: 0.05, lB1: 0.05 });
  }
  // alone: back to where she was, the head goes down a little
  if (t >= T.search1) {
    const d = smooth(t, T.search1 + 0.2, 92.3);
    p = pose({ x, s: S, y: standY(G, S), f: -1, lean: 0.04 * d, head: 0.3 * d, look: 0.5 * d, aA1: 0.06, aB1: -0.06 });
  }
  return p;
}

// ------------------------------------------------------------ her
const HER = { x0: 960, v: 115, t0: 88.8, g: G - 22, s: 0.96 };
const herX = (t) => HER.x0 - HER.v * (t - HER.t0);
const herAlpha = (t) => smooth(t, 88.85, 89.05) * (1 - smooth(t, T.lost0 + 0.08, T.lost1));

// ------------------------------------------------------------ the crowd
// lanes, back to front: 2 is his lane; she walks in lane 1
const LANES = [
  { g: G - 74, s: 0.8, a: 0.62 },
  { g: G - 40, s: 0.9, a: 0.82 },
  { g: G, s: S, a: 1 },
  { g: G + 46, s: 1.18, a: 1 },
  { g: G + 96, s: 1.32, a: 1 },
];
const CROWD = buildCrowd();

function buildCrowd() {
  const r = rng(1107);
  const out = [];
  let id = 30;
  const want = [9, 9, 8, 8, 6];
  const have = [0, 0, 0, 0, 0];
  for (let n = 0; n < 3000 && out.length < 40; n++) {
    const lane = Math.floor(r() * 5);
    if (have[lane] >= want[lane]) continue;
    const dir = r() < 0.5 ? -1 : 1;
    const v = 140 + r() * 120;
    const xMid = -150 + r() * 2300; // position at t = 89.6
    const c = { lane, dir, v, xMid, id: id++, ph: r() };
    // the sea parts for a moment between him and her (有些人); after that she
    // stays in view until the ones who close over her come; keep him readable
    if (lane >= 2 && nearSpan(c, 89.0, 89.5)) continue;
    if (lane >= 2 && near(c, herX, 88.9, T.lost0, 75)) continue;
    if (lane <= 1 && near(c, herX, 88.9, T.lost1, 48)) continue;
    if (lane === 2 && near(c, boyX, 88.9, 92.2, 60)) continue;
    if (lane >= 3 && near(c, boyX, 90.35, 91.4, 60)) continue;
    // no one stands in for her: nobody in her lane walks the same way close by
    if (lane === 1 && c.dir < 0 && near(c, herX, 88.9, 90.3, 140)) continue;
    have[lane]++;
    out.push(c);
  }
  // the ones who close over her (走散): they cross her quickly, right on the word
  const tc = (T.lost0 + T.lost1) / 2 + 0.02;
  [[2, 1, 190, 0], [3, 1, 165, 34], [4, 1, 150, -56]].forEach(([lane, dir, v, dx], i) => {
    const xAt = herX(tc) + dx;
    out.push({ lane, dir, v, xMid: xAt + dir * v * (89.6 - tc), id: 80 + i, ph: 0.3 * i, closer: true });
  });
  out.forEach((c) => {
    const x = crowdX(c, 89.6);
    const toBoy = Math.abs(x - BX_PUSH);
    // pours in from both sides; thins out far-first, the ones around him last
    c.ta = 88.45 + 0.55 * clamp(1 - Math.min(x + 100, W + 100 - x) / 1000) + 0.12 * hash(c.id);
    c.tv = T.thin0 + 0.7 * clamp(1 - toBoy / 1100) + 0.4 * hash(c.id * 1.7);
    if (c.closer) c.ta = Math.min(c.ta, 89.3);
  });
  return out.sort((a, b) => a.lane - b.lane);
}

function crowdX(c, t) {
  return c.xMid + c.dir * c.v * (t - 89.6);
}
// is the figure in the corridor between her and him?
function nearSpan(c, t0, t1) {
  for (let t = t0; t <= t1; t += 0.05) {
    const x = crowdX(c, t);
    if (x > herX(t) - 60 && x < boyX(t) + 30) return true;
  }
  return false;
}
function near(c, fx, t0, t1, d) {
  for (let t = t0; t <= t1; t += 0.05) if (Math.abs(crowdX(c, t) - fx(t)) < d) return true;
  return false;
}

function crowdPose(c, t) {
  const L = LANES[c.lane];
  const x = crowdX(c, t);
  const w = walk(walkPhase(Math.abs(x - c.xMid), L.s) + c.ph, L.g, L.s, 0.9);
  return pose({ x, s: L.s, f: c.dir, ...w });
}

// paper halo: erase what is behind a figure so overlaps stay legible
function halo(ctx, p, o, k = 1) {
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  figure(ctx, p, { ...o, w: (o.w ?? Math.max(2, 4.6 * Math.pow(p.s, 0.85))) * 3.4, color: '#000', headFill: '#000', eye: 'none', alpha: k, noTie: true });
  ctx.restore();
}

function memDash(k) {
  // 1 = solid, 0 = broken into sparse dashes
  if (k > 0.98) return undefined;
  return [lerp(5, 60, k), lerp(14, 0.01, k)];
}

// ------------------------------------------------------------ the tree
const TREE_X = 700;
const TS = 1.55; // tree scale
const TP = (u, v) => [TREE_X + u * TS, G - v * TS];
const TRUNK = [TP(0, 0), TP(-5, 70), TP(3, 140), TP(-1, 176)];
const BRANCHES = [
  [TP(-1, 140), TP(-52, 196), TP(-104, 222)],
  [TP(2, 154), TP(56, 206), TP(108, 220)],
  [TP(-1, 176), TP(6, 238), TP(-6, 290)],
  [TP(-52, 196), TP(-66, 252)],
  [TP(56, 206), TP(72, 262)],
  [TP(4, 230), TP(-40, 272)],
  [TP(-80, 210), TP(-120, 250)],
  [TP(84, 214), TP(124, 250)],
];
const CANOPY = { x: TREE_X, y: G - 236 * TS, rx: 150 * TS, ry: 96 * TS };

function canopyPts() {
  const pts = [];
  const n = 13;
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * TAU - Math.PI / 2;
    const a1 = ((i + 1) / n) * TAU - Math.PI / 2;
    const am = (a0 + a1) / 2;
    const bx = CANOPY.x + Math.cos(am) * CANOPY.rx * 0.9;
    const by = CANOPY.y + Math.sin(am) * CANOPY.ry * 0.9;
    const rr = (34 + 8 * Math.sin(i * 2.3)) * TS;
    pts.push(...ellipsePts(bx, by, rr, rr * 0.86, am - 1.25, am + 1.25, 7));
  }
  return pts;
}
const CANOPY_PTS = canopyPts();

function drawTree(ctx, t) {
  const a = 1 - smooth(t, T.treeOut0, T.treeOut1);
  if (a <= 0.01) return;
  // trunk & branches (always there; summer hides them under the leaves)
  path(ctx, TRUNK, { w: 7, alpha: a, seed: 1500 });
  BRANCHES.forEach((b, i) => path(ctx, b, { w: i < 3 ? 4.6 : 3, alpha: a, seed: 1510 + i }));

  // summer: a full crown; autumn: it thins and lets go of its leaves
  const crown = 1 - smooth(t, T.autumn - 0.02, T.winter - 0.02);
  if (crown > 0.01) {
    fillPoly(ctx, CANOPY_PTS, COL.paper, 0.92 * crown * a);
    hatch(ctx, CANOPY_PTS, { alpha: 0.12 * crown * a, gap: 15, seed: 1530 });
    // the branches show through as the leaves go
    BRANCHES.forEach((b, i) => path(ctx, b, { w: i < 3 ? 4.6 : 3, alpha: a * (1 - crown), seed: 1510 + i }));
    path(ctx, CANOPY_PTS, { w: 3.6, alpha: crown * a, close: true, seed: 1540, dash: crown < 0.98 ? [lerp(4, 40, crown), lerp(16, 2, crown)] : undefined });
  }
  // falling leaves
  for (let i = 0; i < 30; i++) {
    const t0 = T.autumn - 0.05 + hash(i * 3.3) * 0.22;
    const k = (t - t0) * 1.7;
    if (k < 0 || k > 1.0) continue;
    const sx = CANOPY.x + (hash(i * 1.7) - 0.5) * CANOPY.rx * 1.7;
    const sy = CANOPY.y + (hash(i * 2.9) - 0.5) * CANOPY.ry * 1.2;
    const x = sx - 190 * k - 34 * Math.sin(k * 7 + i);
    const y = Math.min(G - 5, sy + 420 * k * k + 90 * k);
    const ang = k * 9 + i;
    leaf(ctx, x, y, ang, a * (1 - smooth(k, 0.7, 1.0)), 1600 + i);
  }
  // winter: snow sits on the branches, flakes fall, the ground whitens
  const snow = smooth(t, T.winter, T.winter + 0.12) * (1 - smooth(t, T.spring, T.spring + 0.18));
  if (snow > 0.01) {
    BRANCHES.forEach((b, i) => {
      const cap = b.map(([x, y]) => [x, y - 8]);
      path(ctx, cap, { w: 2.4, alpha: 0.7 * snow * a, seed: 1650 + i, wobble: 0.8 });
    });
    path(ctx, [[TREE_X - 330, G - 6], [TREE_X - 120, G - 13], [TREE_X + 90, G - 11], [TREE_X + 340, G - 6]], { w: 2.4, alpha: 0.65 * snow * a, seed: 1660 });
  }
  // blossoms
  const bloom = smooth(t, T.spring, T.spring + 0.16);
  if (bloom > 0.01) {
    for (let i = 0; i < 30; i++) {
      const b = BRANCHES[i % BRANCHES.length];
      const u = 0.35 + 0.65 * hash(i * 4.1);
      const seg = Math.min(b.length - 2, Math.floor(u * (b.length - 1)));
      const v = u * (b.length - 1) - seg;
      const x = lerp(b[seg][0], b[seg + 1][0], v) + (hash(i * 7.3) - 0.5) * 22;
      const y = lerp(b[seg][1], b[seg + 1][1], v) + (hash(i * 5.9) - 0.5) * 22;
      const pop = clamp((bloom - hash(i * 2.2) * 0.4) / 0.6);
      if (pop <= 0) continue;
      blossom(ctx, x, y, 10 * ease.outBack(pop), a, 1700 + i);
    }
  }
}

function leaf(ctx, x, y, ang, a, seed) {
  if (a <= 0.01) return;
  const c = Math.cos(ang);
  const s = Math.sin(ang);
  const P = (u, v) => [x + u * c - v * s, y + u * s + v * c];
  path(ctx, [P(-12, 0), P(-3, -6.5), P(12, 0), P(-3, 6.5), P(-12, 0)], { w: 2.2, alpha: a, seed, wobble: 0.3, fill: 'rgba(31,28,25,0.18)' });
}

function blossom(ctx, x, y, r, a, seed) {
  if (r <= 0.3) return;
  for (let k = 0; k < 5; k++) {
    const an = (k / 5) * TAU + seed;
    path(ctx, ellipsePts(x + Math.cos(an) * r * 0.62, y + Math.sin(an) * r * 0.62, r * 0.5, r * 0.5, 0, TAU, 8), { w: 1.4, alpha: a * 0.85, seed: seed * 7 + k, wobble: 0.2, fill: COL.paper });
  }
  dot(ctx, x, y, Math.max(1, r * 0.22), COL.ink, a);
}

// snowflakes & petals over the whole picture
function weather(ctx, t) {
  const snow = smooth(t, T.winter - 0.05, T.winter + 0.1) * (1 - smooth(t, T.spring - 0.02, T.spring + 0.3));
  if (snow > 0.01) {
    ctx.save();
    ctx.strokeStyle = COL.ink;
    ctx.lineCap = 'round';
    ctx.lineWidth = 2.2;
    ctx.globalAlpha *= 0.7 * snow;
    ctx.beginPath();
    for (let i = 0; i < 80; i++) {
      const x0 = hash(i * 1.37) * 2400 - 150;
      const y0 = hash(i * 2.71) * 900;
      const fall = (t - T.winter + 0.2) * (140 + 70 * hash(i * 3.1));
      const x = x0 - fall * 0.35 + 8 * Math.sin(t * 3 + i);
      const y = ((y0 + fall) % 880) + 10;
      const r = 4.5 + 3.5 * hash(i * 4.4);
      for (let k = 0; k < 3; k++) {
        const an = (k / 3) * Math.PI + i + t * 2;
        ctx.moveTo(x - Math.cos(an) * r, y - Math.sin(an) * r);
        ctx.lineTo(x + Math.cos(an) * r, y + Math.sin(an) * r);
      }
    }
    ctx.stroke();
    ctx.restore();
  }
  const pet = smooth(t, T.spring + 0.05, T.spring + 0.25) * (1 - smooth(t, T.treeOut0, T.treeOut1));
  if (pet > 0.01) {
    for (let i = 0; i < 16; i++) {
      const k = t - T.spring - 0.05 - hash(i * 1.9) * 0.2;
      if (k < 0) continue;
      const x = CANOPY.x + (hash(i * 6.1) - 0.5) * 340 - 200 * k;
      const y = CANOPY.y + (hash(i * 3.7) - 0.3) * 180 + 140 * k + 12 * Math.sin(k * 8 + i);
      path(ctx, ellipsePts(x, y, 6, 3.4, k * 6 + i, k * 6 + i + TAU, 8), { w: 1.4, alpha: 0.7 * pet, seed: 1800 + i, wobble: 0 });
    }
  }
}

// ------------------------------------------------------------ draw
export default {
  draw(ctx, lt, info) {
    const t = info.t;
    const cam = keys(t, [
      [87.0, { x: 1200, y: 560, z: 1.0 }],
      [88.75, { x: 1130, y: 580, z: 1.0 }],
      [89.5, { x: 1110, y: 680, z: 1.22 }],
      [90.6, { x: 1080, y: 680, z: 1.24 }],
      [91.3, { x: 1070, y: 660, z: 1.16 }],
      [92.5, { x: 1010, y: 580, z: 0.94 }],
    ], ease.inOut);
    camera(ctx, cam, () => {
      const dens = smooth(t, 88.55, 89.2) * (1 - smooth(t, T.thin0 + 0.3, T.thin1));
      // ground: hidden under the crowd, there again when he is alone
      path(ctx, [[-200, G + 2], [700, G], [1500, G + 3], [2300, G]], { w: 3, alpha: 1 - 0.8 * dens, seed: 1400 });

      drawTree(ctx, t);
      weather(ctx, t);

      // farther lanes first; her in lane 1, him in lane 2
      for (let lane = 0; lane < LANES.length; lane++) {
        drawCrowd(ctx, t, CROWD.filter((c) => c.lane === lane));
        if (lane === 1) drawHer(ctx, t);
        if (lane === 2) {
          const bp = boyPose(t);
          halo(ctx, bp, { id: 1 });
          figure(ctx, bp, { id: 1 });
        }
      }
    });
  },
};

function drawCrowd(ctx, t, list) {
  for (const c of list) {
    const k = smooth(t, c.ta, c.ta + 0.35) * (1 - smooth(t, c.tv, c.tv + 0.45));
    if (k <= 0.01) continue;
    const p = crowdPose(c, t);
    if (p.x < -150 || p.x > W + 300) continue;
    const L = LANES[c.lane];
    const o = { id: c.id, dash: memDash(k) };
    if (c.lane > 0) halo(ctx, p, o, Math.min(1, k * 1.4));
    figure(ctx, p, { ...o, alpha: L.a * Math.min(1, 0.25 + k) });
  }
}

function drawHer(ctx, t) {
  const a = herAlpha(t);
  if (a <= 0.01) return;
  const L = HER;
  const x = herX(t);
  const w = walk(walkPhase(Math.abs(x - HER.x0), L.s) + 0.4, L.g, L.s, 0.85);
  const p = pose({ x, s: L.s, f: -1, ...w, tail: 0.22 * Math.sin(t * 8.5) });
  halo(ctx, p, { id: 2 }, a);
  const j = figure(ctx, p, { id: 2, ponytail: true, alpha: a, dash: memDash(clamp(a * 1.3)) });
  // a larger gold tie so it reads among the bodies
  const tie = tieAt(p, j);
  dot(ctx, tie[0], tie[1], 7, COL.gold, a);
}

// the tie position figure.js uses for a side view
function tieAt(p, j) {
  const f = p.f;
  const a = j.headAngle;
  const r = j.r;
  const bx = -f * Math.cos(a);
  const by = -Math.sin(a);
  const ux = Math.sin(a) * f;
  const uy = -Math.cos(a);
  const ax = j.head[0] + (bx * 0.8 + ux * 0.45) * r;
  const ay = j.head[1] + (by * 0.8 + uy * 0.45) * r;
  return [ax + bx * r * 0.18, ay + by * r * 0.18];
}
