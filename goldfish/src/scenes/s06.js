// s06 — 婚礼 (36.0–39.6, music only)
// 第五章：他为她戴戒指时失手落地，戒指滚向门口，他伸脚挡住，面红耳赤地回来；她始终抬着
// 戴花边手套的手，无名指兀自不动。（本片：他把那条小金鱼挂到她脖子上。）她把最好的一块
// 蛋糕盛在盘里，端到栗树下被绑着的老人面前，老人冲她笑了笑。
// Music beats: ~36.44, 37.53, 38.62, 39.71 (half beats 36.99, 38.08, 39.17).
import { COL, TAU, W, lerp, clamp, prog, smooth, keys, ease, path, line, ellipse, ellipsePts, dot, fillPoly, camera, hatch, withLayer } from '../lib.js';
import { figure, pose, reach, joints, walk, walkPhase, standY } from '../figure.js';
import { goldFish, goldGlow, sparkle, chain, ring, hangingFish } from '../props.js';

const FLOOR = 860;
const R = { x0: 220, x1: 1380, top: 160, doorTop: 430 };
const HER_S = 0.85;
const HIM_S = 1.25;
const HER_X = 760;
const HIM_X = 905;
const RING_STOP = 1066;

// ------------------------------------------------------------ helpers
// her short veil, hanging from the bow down her back (draw before her)
function veil(ctx, j, f, s, o = {}) {
  const [hx, hy] = j.head;
  const r = j.r;
  const a = j.headAngle;
  // top-back of the head, along the head's tilt
  const ux = f * Math.sin(a);
  const uy = -Math.cos(a);
  const bx = -f * Math.cos(a);
  const by = -f * Math.sin(a) * f;
  const P0 = [hx + (ux * 0.85 + bx * 0.35) * r, hy + (uy * 0.85 + by * 0.35) * r];
  const P1 = [hx + bx * 1.1 * r, hy + by * 1.1 * r];
  const sway = o.sway ?? 0;
  const pts = [
    P0,
    [P1[0] - f * 10 * s, P1[1] + 4 * s],
    [j.shoulder[0] - f * (26 + sway) * s, j.shoulder[1] + 30 * s],
    [j.shoulder[0] - f * (22 + sway) * s, j.shoulder[1] + 56 * s],
    [j.shoulder[0] - f * 7 * s, j.shoulder[1] + 40 * s],
    [j.neckTop[0] - f * 3 * s, j.neckTop[1] + 2 * s],
  ];
  path(ctx, pts, { w: 1.6, close: true, fill: 'rgba(250,247,240,0.55)', seed: o.seed ?? 6000, wobble: 0.6, alpha: o.alpha });
  // two soft folds
  path(ctx, [[P1[0] - f * 4 * s, P1[1] + 8 * s], [j.shoulder[0] - f * (17 + sway * 0.6) * s, j.shoulder[1] + 46 * s]], { w: 1, seed: (o.seed ?? 6000) + 1, alpha: (o.alpha ?? 1) * 0.5 });
}

// her lace glove and the ring finger, held still
function glove(ctx, j, f, s, ang) {
  const [x, y] = j.handA;
  ellipse(ctx, x, y, 5.5 * s, 4.2 * s, { w: 1.6, fill: '#f6f2e9', seed: 6010, wobble: 0.2 });
  const fx = x + Math.sin(ang) * f * 13 * s;
  const fy = y + Math.cos(ang) * 13 * s;
  line(ctx, x + Math.sin(ang) * f * 4 * s, y + Math.cos(ang) * 4 * s, fx, fy, { w: 2.2, seed: 6011, wobble: 0 });
  return [fx, fy];
}

// the fish on its chain around her neck
function necklace(ctx, j, f, s, o = {}) {
  const back = [j.neckTop[0] - f * 4 * s, j.neckTop[1] + 1];
  const front = [j.shoulder[0] + f * 9 * s, j.shoulder[1] + 22 * s];
  chain(ctx, back[0], back[1], front[0], front[1], { sag: 3, step: 5, w: 1.1 });
  const fs = 0.3;
  const cx = front[0];
  const cy = front[1] + 30 * fs * 0.9;
  goldFish(ctx, cx, cy, fs, -Math.PI / 2 + f * 0.12, { seed: 6020, glint: o.glint ?? 0 });
  goldGlow(ctx, cx, cy, 34, 0.5 + (o.glint ?? 0));
  return [cx, cy];
}

// a few short ink strokes on his cheek: the blush
function blush(ctx, j, f, k) {
  if (k <= 0.01) return;
  const [hx, hy] = j.head;
  const r = j.r;
  for (let i = 0; i < 3; i++) {
    const x = hx + f * (-0.12 + i * 0.17) * r;
    const y = hy + 0.42 * r;
    line(ctx, x - 2.5, y + 3.5, x + 2.5, y - 3.5, { w: 1.7, alpha: 0.8 * k, seed: 6030 + i, wobble: 0 });
  }
}

// the wedding room: frame, door, garland, a little altar
function room(ctx) {
  const g = ctx.createLinearGradient(R.x1, 0, R.x1 - 460, 0);
  g.addColorStop(0, 'rgba(255,248,228,0.7)');
  g.addColorStop(1, 'rgba(255,248,228,0)');
  ctx.save();
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(R.x1, R.doorTop);
  ctx.lineTo(R.x1, FLOOR);
  ctx.lineTo(R.x1 - 460, FLOOR);
  ctx.lineTo(R.x1 - 70, R.doorTop + 110);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(255,250,236,0.8)';
  ctx.fillRect(R.x1, R.doorTop, W - R.x1 + 400, FLOOR - R.doorTop);
  ctx.restore();
  path(ctx, [[R.x1, R.doorTop], [R.x1, R.top], [R.x0, R.top], [R.x0, FLOOR], [R.x1 + 300, FLOOR]], { w: 5.5, seed: 6100, sketch: true });
  line(ctx, R.x1 - 8, R.doorTop, R.x1 + 26, R.doorTop, { w: 5, seed: 6101 });
  line(ctx, R.x1 + 22, R.doorTop - 4, R.x1 + 22, FLOOR, { w: 3, seed: 6102, alpha: 0.55 });
  // a festoon of paper flowers strung across the wall
  for (let k = 0; k < 4; k++) {
    const x0 = 430 + k * 240;
    const pts = ellipsePts(x0 + 120, 474, 120, 40, Math.PI, 0, 14).map(([x, y]) => [x, 2 * 474 - y]);
    path(ctx, pts, { w: 2, seed: 6110 + k, alpha: 0.8 });
    for (let i = 1; i < 4; i++) {
      const [fx, fy] = pts[Math.round((i / 4) * (pts.length - 1))];
      flower(ctx, fx, fy + 4, 9, 6120 + k * 5 + i);
    }
    // a ribbon hanging where the swags meet
    path(ctx, [[x0, 474], [x0 - 4, 494], [x0 + 3, 514]], { w: 1.6, seed: 6130 + k, alpha: 0.7 });
  }
  // the altar to the left of the bride: a table, a cloth, two candles, a cross
  const ax = 515;
  const at = 730;
  line(ctx, ax, at, ax + 170, at, { w: 4, seed: 6140 });
  line(ctx, ax + 12, at, ax + 14, FLOOR, { w: 3.5, seed: 6141 });
  line(ctx, ax + 158, at, ax + 156, FLOOR, { w: 3.5, seed: 6142 });
  path(ctx, [[ax - 6, at], [ax - 2, at + 46], [ax + 30, at + 40], [ax + 60, at + 48], [ax + 90, at + 40], [ax + 120, at + 48], [ax + 150, at + 40], [ax + 176, at + 46], [ax + 176, at]], { w: 2, fill: COL.paper, seed: 6143 });
  line(ctx, ax + 85, 548, ax + 85, 630, { w: 3.5, seed: 6145 });
  line(ctx, ax + 62, 570, ax + 108, 570, { w: 3.5, seed: 6146 });
  for (const cx of [ax + 40, ax + 130]) {
    line(ctx, cx, at, cx, at - 50, { w: 6, seed: 6144 + cx, wobble: 0.3 });
    path(ctx, [[cx, at - 54], [cx - 4, at - 62], [cx, at - 74], [cx + 4, at - 62], [cx, at - 54]], { w: 1.6, seed: 6150 + cx, wobble: 0.5 });
  }
}

function flower(ctx, x, y, r, seed) {
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * TAU - Math.PI / 2;
    ellipse(ctx, x + Math.cos(a) * r * 0.6, y + Math.sin(a) * r * 0.6, r * 0.42, r * 0.42, { w: 1.3, fill: COL.paper, seed: seed * 7 + i, wobble: 0.2, alpha: 0.85 });
  }
  dot(ctx, x, y, r * 0.22);
}

// ----------------------------------------------------------- the wedding
function wedding(ctx, lt, t) {
  const T = lt;
  room(ctx);

  // ring timeline
  const DROP = 0.44;
  const LAND = 0.6;
  const STOP = 0.98;
  const PICK = 1.18;
  const ON = 1.53;

  // ---------------------------------------------------- him: where is he?
  const hipY = standY(FLOOR, HIM_S);
  let p;
  let ringPos = null; // free ring on the floor / in the air
  let ringRoll = 0;
  let handRing = false; // ring held in his hand A
  const turnOut = T >= 0.62 && T < 1.3;
  const out = smooth(T, 0.62, 0.98, (k) => ease.out(k) * 0.4 + k * 0.6); // after it, toward the door
  const backK = smooth(T, 1.3, 1.5);
  if (T < 0.62) {
    p = pose({ x: HIM_X, y: hipY, s: HIM_S, f: -1, lean: 0.14, head: 0.12, look: 0.3 });
    const startle = smooth(T, 0.46, 0.56);
    p.head += 0.35 * startle;
    p.look = lerp(0.3, 1, startle);
    p.lean += 0.05 * startle;
  } else if (T < 1.3) {
    const x = lerp(HIM_X, RING_STOP - 38, out);
    p = pose({ x, y: hipY, s: HIM_S, f: 1, lean: 0.1, head: 0.4, look: 1 });
    if (out < 1) Object.assign(p, walk(walkPhase(x - HIM_X, HIM_S), FLOOR, HIM_S, 0.9), { x, head: 0.4, look: 1 });
    // the last stride lands: front foot on the ring, back foot planted
    const plant = smooth(T, 0.86, 0.98);
    const crouch = smooth(T, 1.02, 1.16) * (1 - smooth(T, 1.2, 1.3));
    const y = lerp(p.y, hipY, plant) + 58 * crouch;
    const q = { ...p, y, lean: lerp(p.lean, 0.85, crouch) };
    const la = reach(q, 'A', RING_STOP + 2, FLOOR - 2, 'leg');
    const lb = reach(q, 'B', RING_STOP - 38 - 34, FLOOR - 2, 'leg');
    Object.assign(p, {
      y,
      lean: q.lean,
      head: lerp(p.head, 0.2, crouch),
      lA1: lerp(p.lA1, la.a1, plant), lA2: lerp(p.lA2, la.a2, plant),
      lB1: lerp(p.lB1, lb.a1, plant), lB2: lerp(p.lB2, lb.a2, plant),
    });
  } else {
    const x = lerp(RING_STOP - 38, HIM_X, backK);
    p = pose({ x, y: hipY, s: HIM_S, f: -1, lean: 0.14, head: 0.1, look: 0.2 });
    if (backK > 0 && backK < 1) Object.assign(p, walk(walkPhase(RING_STOP - 38 - x, HIM_S), FLOOR, HIM_S, 0.8), { x, head: 0.12 });
  }

  // ---------------------------------------------------- her
  const herY = standY(FLOOR, HER_S);
  const raise = smooth(T, -0.35, 0.05);
  const lower = smooth(T, 1.7, 1.95);
  const lookFish = smooth(T, 2.08, 2.22) * (1 - smooth(T, 2.36, 2.5));
  const hp = pose({ x: HER_X, y: herY, s: HER_S, f: 1, aB1: -0.08, aB2: 0.15, head: 0.02 + 0.38 * lookFish, look: 0.2 + 0.8 * lookFish });
  hp.aA1 = lerp(lerp(0.15, 1.45, raise), 0.45, lower);
  hp.aA2 = lerp(lerp(0.2, 0.72, raise), 1.55, lower);
  const hj = joints(hp);
  const fingerAng = hp.aA1 + hp.aA2 + 0.15;
  const finger = [hj.handA[0] + Math.sin(fingerAng) * 13 * HER_S, hj.handA[1] + Math.cos(fingerAng) * 13 * HER_S];

  // ---------------------------------------------------- the ring
  const tremble = Math.sin(t * 47) * 1.4 * (1 - smooth(T, 0.4, 0.45));
  const atFinger = [finger[0] + 7, finger[1] + tremble];
  if (T < DROP) {
    handRing = true;
  } else if (T < LAND) {
    const k = prog(T, DROP, LAND);
    ringPos = [atFinger[0] + 18 * k, lerp(atFinger[1], FLOOR - 9, k * k)];
    ringRoll = k * 3;
  } else if (T < STOP) {
    const k = prog(T, LAND, STOP);
    const bounce = Math.max(0, Math.sin(Math.min(1, k * 3.2) * Math.PI)) * 16 * (1 - k);
    const x = lerp(atFinger[0] + 18, RING_STOP, ease.out(k));
    ringPos = [x, FLOOR - 9 - bounce];
    ringRoll = 3 + k * 9;
  } else if (T < PICK - 0.08) {
    ringPos = [RING_STOP, FLOOR - 9];
    ringRoll = 0.15;
  } else if (T < PICK) {
    // picked up: drawn below, travelling from the floor into his hand
  } else {
    handRing = T < ON + 0.02;
  }

  // ---------------------------------------------------- his arms
  if (T < 0.62) {
    // arm A brings the ring to her finger; after the drop it hangs, startled
    const reachK = smooth(T, -0.3, 0.3);
    const tgt = [lerp(HIM_X - 40, atFinger[0] + 4, reachK), lerp(hipY - 50, atFinger[1] + 3, reachK)];
    const r = reach(p, 'A', tgt[0], tgt[1]);
    p.aA1 = r.a1;
    p.aA2 = r.a2;
    p.aB1 = 0.1;
    p.aB2 = 0.25;
  } else if (T < 1.3) {
    if (T > 1.02) {
      const r = reach(p, 'A', RING_STOP + 4, FLOOR - 12);
      p.aA1 = r.a1;
      p.aA2 = r.a2;
    }
  } else {
    // back to her: the ring goes on (1.53); then the fish
    const toFinger = smooth(T, 1.38, ON);
    const away = smooth(T, ON + 0.08, ON + 0.25);
    const fishUp = smooth(T, 1.72, 1.9);
    const fishDown = smooth(T, 1.9, 2.08);
    const release = smooth(T, 2.1, 2.3);
    const neckFront = [hj.shoulder[0] + 9 * HER_S, hj.shoulder[1] + 22 * HER_S];
    const aboveHead = [hj.head[0] + 18, hj.head[1] - 46];
    let tA = [lerp(p.x - 30, atFinger[0] + 4, toFinger), lerp(p.y - 40, atFinger[1] + 3, toFinger)];
    tA = [lerp(tA[0], p.x - 40, away), lerp(tA[1], p.y - 30, away)];
    // both hands hold the chain: up over her head, then down to her neck
    const holdPt = [lerp(lerp(p.x - 50, aboveHead[0], fishUp), neckFront[0] + 6, fishDown), lerp(lerp(p.y - 70, aboveHead[1], fishUp), neckFront[1] - 30, fishDown)];
    const chainK = smooth(T, 1.62, 1.75) * (1 - release);
    if (chainK > 0) {
      tA = [lerp(tA[0], holdPt[0] + 4, chainK), lerp(tA[1], holdPt[1], chainK)];
    }
    const restA = [p.x - 34, p.y + 6];
    if (release > 0) tA = [lerp(holdPt[0] + 4, restA[0], release), lerp(holdPt[1], restA[1], release)];
    const r = reach(p, 'A', tA[0], tA[1]);
    p.aA1 = r.a1;
    p.aA2 = r.a2;
    // arm B: from the pocket with the fish (1.58), joins arm A
    const pocket = [p.x - 10, p.y - 78];
    const pull = smooth(T, 1.56, 1.68);
    let tB = [lerp(p.x - 20, pocket[0], smooth(T, 1.45, 1.56)), lerp(p.y + 10, pocket[1], smooth(T, 1.45, 1.56))];
    tB = [lerp(tB[0], holdPt[0] + 12, chainK > 0 ? Math.min(1, pull * 1.0) : 0), lerp(tB[1], holdPt[1] - 4, chainK > 0 ? Math.min(1, pull) : 0)];
    if (release > 0) tB = [lerp(holdPt[0] + 12, p.x - 18, release), lerp(holdPt[1] - 4, p.y + 8, release)];
    const rb = reach(p, 'B', tB[0], tB[1]);
    p.aB1 = rb.a1;
    p.aB2 = rb.a2;
    p.head = 0.12 + 0.12 * fishDown * (1 - release);
    p.look = 0.3 + 0.4 * fishDown;
    p.lean = 0.14 + 0.08 * fishDown * (1 - release);
  }

  // ---------------------------------------------------- draw
  // her veil, her, her glove
  veil(ctx, hj, 1, HER_S, { sway: 2 * Math.sin(t * 2) });
  figure(ctx, hp, { id: 2, bow: true, skirt: true, boots: true });
  if (lower < 0.5) glove(ctx, hj, 1, HER_S, fingerAng - 0.15);
  else ellipse(ctx, hj.handA[0], hj.handA[1], 5.5 * HER_S, 4.2 * HER_S, { w: 1.6, fill: '#f6f2e9', seed: 6010, wobble: 0.2 });
  const onFinger = T >= ON;
  const glintRing = smooth(T, ON - 0.04, ON + 0.04) * (1 - smooth(T, ON + 0.1, ON + 0.4));
  if (onFinger && lower < 0.5) {
    ring(ctx, lerp(hj.handA[0], finger[0], 0.55), lerp(hj.handA[1], finger[1], 0.55), 4.2, 1.2);
    if (glintRing > 0) sparkle(ctx, finger[0] - 2, finger[1] - 4, 16 * glintRing, glintRing);
  }
  // the fish on her chest
  const onNeck = T >= 2.08;
  if (onNeck) {
    const g = smooth(T, 2.06, 2.12) * (1 - smooth(T, 2.18, 2.5)) + 0.6 * smooth(T, 2.95, 3.1) * (1 - smooth(T, 3.15, 3.4));
    necklace(ctx, hj, 1, HER_S, { glint: g });
  }

  // him
  const blushK = smooth(T, 1.08, 1.25) * (1 - smooth(T, 2.2, 2.5));
  const j = figure(ctx, p, { id: 1, mustache: true, boots: 'black' });
  bowTie(ctx, j, p.f);
  blush(ctx, j, p.f, blushK);
  if (handRing) {
    const hx = j.handA[0] + p.f * 3;
    ring(ctx, hx, j.handA[1] - 2, 5, 1.1);
  } else if (T >= PICK - 0.08 && T < PICK) {
    const k = ease.inOut(prog(T, PICK - 0.08, PICK));
    ring(ctx, lerp(RING_STOP, j.handA[0] + p.f * 3, k), lerp(FLOOR - 9, j.handA[1] - 2, k), lerp(9, 5, k), lerp(0.15, 1.1, k));
  }
  // the fish dangling from his hands
  if (T >= 1.58 && T < 2.08) {
    const hand = j.handB;
    const swing = Math.sin(T * 9) * 0.25 * (1 - smooth(T, 1.9, 2.05));
    const fc = hangingFish(ctx, hand[0], hand[1], 22, swing, 0.3, { seed: 6020 });
    goldGlow(ctx, fc[0], fc[1], 40, 0.6);
  }
  // the free ring
  if (ringPos) {
    ring(ctx, ringPos[0], ringPos[1], 9, ringRoll);
    if (T > LAND - 0.02 && T < STOP) {
      // a little "tink" where it lands
      const k = prog(T, LAND - 0.02, LAND + 0.2);
      if (k < 1) {
        for (let i = 0; i < 3; i++) {
          const a = -Math.PI / 2 + (i - 1) * 0.7;
          const x0 = atFinger[0] + 18;
          line(ctx, x0 + Math.cos(a) * (14 + 10 * k), FLOOR - 10 + Math.sin(a) * (14 + 10 * k), x0 + Math.cos(a) * (22 + 12 * k), FLOOR - 10 + Math.sin(a) * (22 + 12 * k), { w: 1.8, alpha: 1 - k, seed: 6200 + i, wobble: 0 });
        }
      }
    }
  }
  // the stamp: a few strokes around his foot
  if (T > STOP - 0.02 && T < STOP + 0.25) {
    const k = prog(T, STOP - 0.02, STOP + 0.25);
    for (let i = 0; i < 3; i++) {
      const a = -Math.PI / 2 + (i - 1) * 0.8;
      const x0 = RING_STOP + 6;
      line(ctx, x0 + Math.cos(a) * (22 + 10 * k), FLOOR - 12 + Math.sin(a) * (22 + 10 * k), x0 + Math.cos(a) * (32 + 12 * k), FLOOR - 12 + Math.sin(a) * (32 + 12 * k), { w: 2, alpha: 1 - k, seed: 6210 + i, wobble: 0 });
    }
  }
}

function bowTie(ctx, j, f) {
  const [x, y] = j.shoulder;
  const cx = x + f * 3;
  const cy = y + 3;
  fillPoly(ctx, [[cx, cy], [cx - 7, cy - 5], [cx - 7, cy + 5]], COL.ink, 1);
  fillPoly(ctx, [[cx, cy], [cx + 7, cy - 5], [cx + 7, cy + 5]], COL.ink, 1);
}

// ------------------------------------------------- cake under the chestnut tree
// The chestnut tree (same trunk as props.chestnutTree, with a rounder crown
// whose scallops read well this close).
function tree(ctx, x, ground, s) {
  const tw = 26 * s;
  path(ctx, [[x - tw, ground], [x - tw * 0.7, ground - 120 * s], [x - tw * 0.9, ground - 260 * s]], { w: 4.5, seed: 6260 });
  path(ctx, [[x + tw, ground], [x + tw * 0.75, ground - 120 * s], [x + tw * 0.95, ground - 260 * s]], { w: 4.5, seed: 6261 });
  for (let i = 0; i < 5; i++) {
    const yy = ground - 30 * s - i * 40 * s;
    path(ctx, [[x - tw * 0.4, yy], [x - tw * 0.1, yy - 10 * s]], { w: 1.6, seed: 6262 + i, alpha: 0.6 });
  }
  const cx = x + 10 * s;
  const cy = ground - 370 * s;
  const crown = [];
  const n = 120;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * TAU;
    const bump = 1 + 0.07 * Math.abs(Math.sin(a * 6.5));
    crown.push([cx + Math.cos(a) * 230 * s * bump, cy + Math.sin(a) * 125 * s * bump]);
  }
  path(ctx, crown, { w: 4, fill: COL.paper, close: true, seed: 6270, wobble: 1 });
  hatch(ctx, crown, { alpha: 0.09, gap: 16, seed: 6271 });
}
const TREE_X = 690;
function cakeShot(ctx, lt, t) {
  const T = lt;
  // ground and the tree
  path(ctx, [[150, FLOOR], [1700, FLOOR + 4]], { w: 4.5, seed: 6300, sketch: true });
  tree(ctx, TREE_X, FLOOR, 1.15);
  // the old man on his stool, tied to the trunk
  const sx = TREE_X + 52;
  const seat = FLOOR - 62;
  line(ctx, sx - 26, seat, sx + 26, seat, { w: 4, seed: 6330 });
  line(ctx, sx - 20, seat, sx - 24, FLOOR, { w: 3.5, seed: 6331 });
  line(ctx, sx + 20, seat, sx + 24, FLOOR, { w: 3.5, seed: 6332 });
  const smile = smooth(T, 2.86, 3.0);
  const nod = Math.sin(clamp((T - 2.92) / 0.5) * Math.PI) * 0.12;
  const fp = pose({ x: sx - 4, y: seat - 3, s: 1.3, f: 1, lA1: 1.5, lA2: -1.5, lB1: 1.4, lB2: -1.35, lean: -0.1, head: 0.05 + nod, look: 0.1, aA1: 0.45, aA2: 0.9, aB1: 0.35, aB2: 0.85 });
  // feet on the ground
  const la = reach(fp, 'A', sx + 58, FLOOR - 3, 'leg');
  const lb = reach(fp, 'B', sx + 44, FLOOR - 3, 'leg');
  Object.assign(fp, { lA1: la.a1, lA2: la.a2, lB1: lb.a1, lB2: lb.a2 });
  // he reaches for the plate with his fingers
  const grab = smooth(T, 3.1, 3.38);
  if (grab > 0) {
    const r = reach(fp, 'A', lerp(sx + 60, 870, grab), lerp(seat - 20, 700, grab));
    fp.aA1 = lerp(0.45, r.a1, grab);
    fp.aA2 = lerp(0.9, r.a2, grab);
  }
  const fj = figure(ctx, fp, { id: 3, eye: smile > 0.5 ? 'none' : 'dot' });
  oldMan(ctx, fj, fp, smile);
  // the ropes: loops around him and the trunk
  for (let i = 0; i < 2; i++) {
    const y = fj.shoulder[1] + 34 + i * 26;
    const cx = (TREE_X + fj.shoulder[0]) / 2 + 6;
    const rx = (fj.shoulder[0] - TREE_X) / 2 + 16;
    path(ctx, ellipsePts(cx, y, rx, 6, 0.2, TAU + 0.4, 18), { w: 2.6, seed: 6340 + i, wobble: 0.4 });
    // the twist of the rope along its front
    for (let k = 0; k < 6; k++) {
      const a = 0.35 + (k / 5) * 2.4;
      const px = cx + Math.cos(a) * rx;
      const py = y + Math.sin(a) * 6;
      line(ctx, px - 2, py - 3, px + 2, py + 3, { w: 1.2, seed: 6350 + i * 8 + k, wobble: 0, alpha: 0.8 });
    }
  }

  // her, bringing the best piece of cake
  const stopX = 925;
  const herY = standY(FLOOR, HER_S);
  const walkK = smooth(T, 2.12, 2.66, ease.out);
  const x = lerp(1180, stopX, walkK);
  const hp = pose({ x, y: herY, s: HER_S, f: -1, aB1: -0.1, aB2: 0.2 });
  if (walkK < 1) Object.assign(hp, walk(walkPhase(1180 - x, HER_S), FLOOR, HER_S, 0.9), { x });
  // the plate held out in front
  const offer = smooth(T, 2.58, 2.82);
  hp.aA1 = lerp(1.15, 1.5, offer);
  hp.aA2 = lerp(0.9, 0.12, offer);
  hp.aB1 = lerp(hp.aB1, 1.25, 1 - offer * 0.3);
  hp.aB2 = lerp(hp.aB2, 0.75, 1 - offer * 0.3);
  hp.head = 0.1;
  const hj = joints(hp);
  veil(ctx, hj, -1, HER_S, { sway: 4 * Math.sin(t * 3) + 6 * (1 - walkK), seed: 6050 });
  figure(ctx, hp, { id: 2, bow: true, skirt: true, boots: true });
  const g = smooth(T, 3.12, 3.2) * (1 - smooth(T, 3.25, 3.55));
  necklace(ctx, hj, -1, HER_S, { glint: g });
  // plate and cake, balanced on her hand
  const [px, py] = hj.handA;
  const took = smooth(T, 3.33, 3.47);
  ellipse(ctx, px - 6, py - 3, 20, 4.5, { w: 2, fill: '#f6f2e9', seed: 6400, wobble: 0.3 });
  if (took < 1) {
    const cpts = [[px - 18, py - 6], [px + 4, py - 6], [px + 4, py - 22], [px - 18, py - 14]];
    path(ctx, cpts, { w: 2, close: true, fill: COL.paper, seed: 6401, wobble: 0.3, alpha: 1 - took });
    line(ctx, px - 18, py - 10, px + 4, py - 14, { w: 1.2, seed: 6402, alpha: 1 - took, wobble: 0 });
    dot(ctx, px - 4, py - 20, 2.4, COL.ink, 1 - took);
  }
  // a fork
  line(ctx, px + 4, py - 5, px + 16, py - 9, { w: 1.4, seed: 6403, wobble: 0 });
}

// beard, wild hair and the smile of José Arcadio Buendía
function oldMan(ctx, j, p, smile) {
  const [hx, hy] = j.head;
  const r = j.r;
  const f = p.f;
  // hair
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 - f * (0.4 + i * 0.32);
    const x0 = hx + Math.cos(a) * r;
    const y0 = hy + Math.sin(a) * r;
    path(ctx, [[x0, y0], [x0 + Math.cos(a) * 9 - f * 4, y0 + Math.sin(a) * 9], [x0 + Math.cos(a) * 14 - f * 9, y0 + Math.sin(a) * 12 + 4]], { w: 1.6, seed: 6500 + i, wobble: 0.4 });
  }
  // beard
  const bx = hx + f * r * 0.35;
  const by = hy + r * 0.55;
  const beard = [[hx + f * r * 0.95, hy + r * 0.15], [hx + f * r * 1.05, hy + r * 1.1], [bx + f * 6, by + 34], [bx - f * 6, by + 40], [hx - f * r * 0.1, hy + r * 1.0], [hx - f * r * 0.35, hy + r * 0.75]];
  path(ctx, beard, { w: 2.2, close: true, fill: COL.paper, seed: 6510, wobble: 0.5 });
  for (let i = 0; i < 3; i++) path(ctx, [[bx + f * (i * 6 - 4), by + 6], [bx + f * (i * 6 - 6), by + 28 + i * 3]], { w: 1.2, seed: 6511 + i, alpha: 0.6 });
  // eye: a dot, or a happy closed arc when he smiles
  const a = j.headAngle;
  const ex = hx + f * Math.cos(a) * r * 0.45;
  const ey = hy + Math.sin(a) * r * 0.45 - r * 0.15;
  if (smile > 0.5) path(ctx, [[ex - 4.5, ey + 1.5], [ex, ey - 2.5], [ex + 4.5, ey + 1.5]], { w: 2.2, seed: 6520, wobble: 0 });
  // the smile, in the beard
  if (smile > 0) {
    const mx = hx + f * r * 0.72;
    const my = hy + r * 0.62;
    path(ctx, [[mx - 7, my - 2 * smile], [mx - f * 1, my + 3 * smile], [mx + 7, my - 2 * smile]], { w: 2.2, seed: 6521, alpha: smile, wobble: 0 });
  }
}

// ---------------------------------------------------------------- scene
export default {
  fadeOut: 0.4,
  draw(ctx, lt, info) {
    const t = info.t;
    const cut = smooth(lt, 2.3, 2.56, ease.sine); // wedding -> chestnut tree
    if (cut < 1) {
      const cam = keys(lt, [
        [0, { x: 865, y: 672, z: 2.3 }],
        [0.5, { x: 880, y: 676, z: 2.3 }],
        [0.95, { x: 965, y: 690, z: 2.2 }], // after the rolling ring
        [1.2, { x: 965, y: 690, z: 2.2 }],
        [1.5, { x: 870, y: 672, z: 2.3 }],
        [1.75, { x: 835, y: 672, z: 2.7 }], // the fish goes on
        [2.5, { x: 825, y: 672, z: 2.85 }],
      ], ease.sine);
      withLayer(ctx, (l) => {
        l.setTransform(ctx.getTransform());
        camera(l, cam, () => wedding(l, lt, t));
      }, { alpha: 1 - cut });
    }
    if (cut > 0) {
      const cam = keys(lt, [
        [2.2, { x: 850, y: 698, z: 2.05 }],
        [3.8, { x: 830, y: 702, z: 2.18 }],
      ], ease.sine);
      withLayer(ctx, (l) => {
        l.setTransform(ctx.getTransform());
        camera(l, cam, () => cakeShot(l, lt, t));
      }, { alpha: cut });
    }
  },
};
