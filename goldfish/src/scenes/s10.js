// s10 — 马戏团·栗树 (56.6–59.8, "为了成为有机物")
// 第十三章：十月十一日，马戏团游行。他第一次停下手里的活，出门去看：骑在大象脖子上的
// 女人，哀伤的单峰驼，队尾的小丑。队伍走过，街上空荡荡一片，空中满是飞蚁，他又一次看见
// 了自己那可悲的孤独的脸。他向栗树走去……像只小鸡一样把头缩在双肩里，额头抵上树干便
// 一动不动了。
//
// One camera move continues s09's last shot (same keys), then the tree:
//   A (workshop) a drum: the parade crosses the bright doorway. The hammer stops
//     in the air, as it did when she first stood in that door; he lifts his
//     head, lays the hammer down and gets up. The fish stays on its nail.
//   C (same set, the camera drifts to the door) he dissolves from the bench to
//     the doorway, a hand on the jamb, and watches the camel and the clown with
//     the drum go by. Then the street is empty: only flying ants. His head sinks.
//   B (the chestnut tree, as in s03/s06) the last step; head pulled into his
//     shoulders, forehead on the trunk. Leaves come down over him and the
//     trunk's outline grows around him: his lines become the tree's. The camera
//     ends with his chest where s11 opens on the fish (a match dissolve).
import { COL, TAU, lerp, clamp, prog, smooth, keys, ease, hash, noise1, path, line, ellipse, ellipsePts, dot, fillPoly, hatch, camera, withLayer } from '../lib.js';
import { figure, pose, mixPose, reach, joints, walk, walkPhase, standY, SIT, LEG } from '../figure.js';
import { hangingFish, goldGlow, hammer, tinCan, crucible } from '../props.js';
import { ROOM, HIM, ANVIL, workshop, bench } from './s04.js';
import { NAIL, FISH_ON_NAIL, nail, fishOnScreen } from './s11.js';

const OLD = { id: 1, mustache: 'droop' };
const S = HIM.s;
const FLOOR = ROOM.floor;
const TOP = FLOOR - 150;
const STOOL_SEAT = 780;
const START = 56.6;
const JUMP = [0.86, 1.22]; // bench -> doorway (same set, figure dissolve)
const CB = [1.86, 2.2]; // doorway -> chestnut tree

// s09's bench at its end (same places): the empty tin can, the crucible with
// the last melt cooling, the sun in the doorway. (s09's empty doll shelf is
// left out: it would cut through his head when he stands at the door.)
const CAN = [672, TOP];
const CRU = [750, TOP - 22];

// ================================================================ parade
// Silhouettes in the doorway light, walking right to left and on behind the
// wall. Each draw function works facing right; the parade is mirrored.
const V = 490; // px/s
const DOOR = { x0: ROOM.x1 + 3, y0: ROOM.doorTop + 4, y1: ROOM.floor + 30 };

function thick(ctx, pts, w0, w1, a) {
  ctx.save();
  ctx.globalAlpha *= a;
  ctx.strokeStyle = COL.ink;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (let i = 0; i < pts.length - 1; i++) {
    ctx.lineWidth = lerp(w0, w1, i / Math.max(1, pts.length - 2));
    ctx.beginPath();
    ctx.moveTo(pts[i][0], pts[i][1]);
    ctx.lineTo(pts[i + 1][0], pts[i + 1][1]);
    ctx.stroke();
  }
  ctx.restore();
}

// elephant facing right; (x, g) = ground under the body centre; d = distance walked
function elephant(ctx, x, g, s, d, t, a) {
  const P = (px, py) => [x + px * s, g + py * s];
  const ph = (d / (190 * s)) * TAU;
  const leg = (lx, k, al) => {
    const sw = Math.sin(ph + k) * 0.2;
    const top = P(lx, -96);
    const lift = Math.max(0, Math.cos(ph + k)) * 7 * s;
    thick(ctx, [top, [top[0] + Math.sin(sw) * 90 * s, g - 11 * s - lift]], 28 * s, 26 * s, al);
  };
  leg(-58, Math.PI, a * 0.7);
  leg(52, 0, a * 0.7);
  leg(-70, 0, a);
  leg(40, Math.PI, a);
  fillPoly(ctx, ellipsePts(x - 6 * s, g - 132 * s, 100 * s, 60 * s, 0, TAU, 30), COL.ink, a);
  fillPoly(ctx, ellipsePts(x + 88 * s, g - 150 * s, 42 * s, 46 * s, 0, TAU, 20), COL.ink, a);
  // the trunk swings up and down as it walks
  const lift = 0.5 + 0.5 * Math.sin(t * 2.3 + 0.6);
  const tr = [];
  for (let i = 0; i <= 8; i++) {
    const u = i / 8;
    tr.push([x + (116 + u * lerp(26, 44, lift)) * s, g + (-140 + u * lerp(96, 40, lift)) * s]);
  }
  const tip = tr[8];
  tr.push([tip[0] + 6 * s + 8 * s * lift, tip[1] + 4 * s - 24 * s * lift]);
  thick(ctx, tr, 22 * s, 8 * s, a);
  // ear and tusk as paper lines inside the silhouette
  path(ctx, ellipsePts(x + 68 * s, g - 148 * s, 22 * s, 32 * s, -1.9, 1.7, 12), { w: 2.4 * s, color: COL.paper, alpha: a * 0.8, seed: 5001, wobble: 0.3 });
  path(ctx, [P(112, -126), P(128, -116), P(142, -124)], { w: 4 * s, color: COL.paper, alpha: a * 0.9, seed: 5002, wobble: 0.2 });
  path(ctx, [P(-104, -142), P(-118, -112), P(-115, -94)], { w: 4 * s, alpha: a, seed: 5003, wobble: 0.3 });
  // the circus blanket: paper saddle-cloth with a zigzag hem
  const cl = [P(-46, -188), P(44, -188)];
  for (let i = 0; i <= 8; i++) cl.push(P(lerp(44, -46, i / 8), -130 + (i % 2) * 13));
  fillPoly(ctx, cl, COL.paper, a * 0.95);
  path(ctx, cl, { w: 2.2 * s, close: true, alpha: a, seed: 5004, wobble: 0.3 });
  dot(ctx, x, g - 160 * s, 5 * s, COL.ink, a);
  // the woman on its neck, waving
  const rp = pose({ x: x + 60 * s, y: g - 192 * s, s: 0.56 * s, f: 1, lA1: 1.3, lA2: -0.95, lB1: 1.15, lB2: -0.85, aA1: 2.6 + 0.3 * Math.sin(t * 8), aA2: 0.35, aB1: 0.7, aB2: 0.5, lean: -0.08 });
  const rj = figure(ctx, rp, { id: 51, w: 6.5 * s, alpha: a, headFill: COL.ink, eye: 'none' });
  path(ctx, [[rj.head[0] - 4 * s, rj.head[1] - 10 * s], [rj.head[0] - 10 * s, rj.head[1] - 34 * s], [rj.head[0] - 24 * s, rj.head[1] - 40 * s]], { w: 3.4 * s, alpha: a, seed: 5005, wobble: 0.3 });
}

// dromedary with its head hung low: "哀伤的单峰驼". One silhouette: the back
// rises into the hump and falls to the tail; the neck dips forward and down.
const CAMEL = [
  [-80, -150], [-66, -170], [-42, -196], [-14, -208], [12, -200], [34, -176], [52, -160],
  [74, -150], [96, -136], [114, -116], [128, -104], [146, -98], [150, -88], [138, -82],
  [118, -88], [100, -104], [80, -118], [60, -122], [42, -114], [-48, -114], [-70, -122],
];
function camel(ctx, x, g, s, d, t, a) {
  const ph = (d / (170 * s)) * TAU;
  const nod = Math.sin(t * 2.4) * 5;
  // the head end of the outline dips and lifts a little as it walks
  const pts = CAMEL.map(([px, py]) => [x + px * s, g + (py + clamp((px - 70) / 80) * nod) * s]);
  // long thin legs with knobby knees
  const leg = (lx, k, al, front) => {
    const sw = Math.sin(ph + k) * 0.3;
    const lift = Math.max(0, Math.cos(ph + k));
    const top = [x + lx * s, g - 116 * s];
    const kb = (front ? 1 : -1) * (0.1 + 0.5 * lift);
    const knee = [top[0] + Math.sin(sw - kb * 0.35) * 58 * s, top[1] + Math.cos(sw) * 58 * s];
    const foot = [knee[0] + Math.sin(sw + kb) * 56 * s, Math.min(g - 3 * s, knee[1] + Math.cos(sw + kb) * 56 * s)];
    thick(ctx, [top, knee, foot], 10 * s, 6 * s, al);
    dot(ctx, knee[0], knee[1], 5.5 * s, COL.ink, al);
    path(ctx, [[foot[0] - 2 * s, foot[1]], [foot[0] + 9 * s, foot[1] + 1 * s]], { w: 6 * s, alpha: al, wobble: 0, seed: 5011 });
  };
  leg(-44, Math.PI, a * 0.65, false);
  leg(46, 0, a * 0.65, true);
  leg(-56, 0, a, false);
  leg(34, Math.PI, a, true);
  fillPoly(ctx, pts, COL.ink, a);
  path(ctx, [[x - 80 * s, g - 150 * s], [x - 92 * s, g - 120 * s], [x - 88 * s, g - 104 * s]], { w: 3.5 * s, alpha: a, seed: 5010, wobble: 0.3 });
}

// the clown at the tail of the parade, banging a big drum
function clown(ctx, x, g, s, d, t, a) {
  const p = pose({ x, s, f: 1, ...walk(walkPhase(d, s) * 0.9, g, s, 0.95) });
  p.y -= Math.abs(Math.sin(walkPhase(d, s) * 0.9 * TAU)) * 8 * s; // a bounce in his step
  const beat = Math.pow(Math.max(0, Math.sin(t * TAU * 2.0 + 1)), 4);
  const dc = [x + 34 * s, p.y - 34 * s];
  const r1 = reach(p, 'A', dc[0] + 16 * s, dc[1] - 50 * s + beat * 30 * s);
  const r2 = reach(p, 'B', dc[0] - 6 * s, dc[1] - 20 * s);
  Object.assign(p, { aA1: r1.a1, aA2: r1.a2, aB1: r2.a1, aB2: r2.a2, lean: -0.06 });
  const j = figure(ctx, p, { id: 52, w: 6.5 * s, alpha: a, headFill: COL.ink, eye: 'none' });
  const [hx, hy] = j.head;
  // cone hat with a pom-pom, and a ruff
  fillPoly(ctx, [[hx - 15 * s, hy - 14 * s], [hx + 13 * s, hy - 18 * s], [hx - 8 * s, hy - 62 * s]], COL.ink, a);
  dot(ctx, hx - 9 * s, hy - 64 * s, 7 * s, COL.ink, a);
  const rf = [];
  for (let i = 0; i <= 10; i++) rf.push([hx - 22 * s + i * 4.4 * s, j.neckTop[1] + 3 * s + (i % 2 ? 8 : -1) * s]);
  path(ctx, rf, { w: 4.5 * s, alpha: a, seed: 5020, wobble: 0.3 });
  // the drum: a dark barrel with a paper rim
  fillPoly(ctx, ellipsePts(dc[0], dc[1], 17 * s, 33 * s, 0, TAU, 18), COL.ink, a);
  path(ctx, ellipsePts(dc[0] + 9 * s, dc[1], 9 * s, 29 * s, -1.45, 1.45, 10), { w: 2.2 * s, color: COL.paper, alpha: a, seed: 5030, wobble: 0.2 });
  path(ctx, [j.handA, [j.handA[0] + 26 * s, j.handA[1] + 8 * s]], { w: 4.5 * s, alpha: a, seed: 5031, wobble: 0 });
  return { dc, beat };
}

// boom marks off the drum (drawn outside the doorway clip)
function boom(ctx, x, y, k, a) {
  if (k <= 0.05 || a <= 0.01) return;
  for (let i = 0; i < 3; i++) {
    const ang = Math.PI + 0.6 - i * 0.6;
    const r0 = 44 + 10 * k;
    const r1 = r0 + 20 * k;
    line(ctx, x + Math.cos(ang) * r0, y + Math.sin(ang) * r0, x + Math.cos(ang) * r1, y + Math.sin(ang) * r1, { w: 3, alpha: a * k, seed: 5040 + i, wobble: 0 });
  }
}

// flying ants: specks drifting in the light after the parade has passed
function ants(ctx, t, x0, y0, w, h, a, seed = 5100, n = 24) {
  if (a <= 0.01) return;
  for (let i = 0; i < n; i++) {
    const hs = (k) => hash(seed + i * 13.1 + k);
    const px = x0 + ((hs(1) * w + t * (16 + 26 * hs(2))) % w);
    const py = y0 + hs(3) * h + 16 * noise1(t * 1.2 + i * 3.3, seed);
    const tw = Math.sin(t * 11 + i * 2.1);
    dot(ctx, px, py, 2, COL.ink, a * 0.6);
    line(ctx, px - 4, py - 3 * tw, px, py, { w: 1.1, alpha: a * 0.4, wobble: 0, seed: seed + i });
    line(ctx, px + 4, py - 3 * tw, px, py, { w: 1.1, alpha: a * 0.4, wobble: 0, seed: seed + 40 + i });
  }
}

// body-centre x of each member of the parade at scene time T
const PX = { ele: 1640, camel: 1915, clown: 2090 };
function parade(ctx, T, t) {
  const d = V * T;
  const g = FLOOR;
  const mirror = (x, fn) => {
    ctx.save();
    ctx.translate(x, 0);
    ctx.scale(-1, 1);
    ctx.translate(-x, 0);
    const r = fn();
    ctx.restore();
    return r;
  };
  ctx.save();
  ctx.beginPath();
  ctx.rect(DOOR.x0, DOOR.y0, 1200, DOOR.y1 - DOOR.y0);
  ctx.clip();
  const ex = PX.ele - d;
  const cx = PX.camel - d;
  const kx = PX.clown - d;
  if (ex > DOOR.x0 - 180) mirror(ex, () => elephant(ctx, ex, g - 6, 0.94, d + 400, t, 0.92));
  if (cx > DOOR.x0 - 160) mirror(cx, () => camel(ctx, cx, g - 4, 0.98, d + 400, t, 0.92));
  let dr = null;
  if (kx > DOOR.x0 - 80) dr = mirror(kx, () => clown(ctx, kx, g + 2, 1.0, d + 400, t, 0.95));
  ctx.restore();
  if (dr) boom(ctx, 2 * kx - dr.dc[0], dr.dc[1], dr.beat, clamp((kx - DOOR.x0 - 30) / 60));
}

// ================================================================ shots A + C
// One camera: s09's last move (same keys), then a slow drift to the door.
function camAC(t) {
  return keys(t, [
    [55.8, { x: 690, y: 595, z: 1.7 }],
    [56.8, { x: 940, y: 585, z: 1.16 }],
    [57.0, { x: 944, y: 585, z: 1.16 }],
    [58.45, { x: 1218, y: 590, z: 1.46 }],
  ], ease.sine);
}

// s09's tapping, continued (it resumed at 56.04)
const tapUp = (t) => Math.pow(Math.abs(Math.sin((((t - 56.04) * 2.1) % 1) * Math.PI + 0.25)), 0.7);

// him at the bench: the hammer stops, he looks up, lays it down, stands
function benchHim(ctx, T, t, top, alpha) {
  const anvil = ANVIL();
  const STOP = 0.14;
  const up = T < STOP ? tapUp(t) : lerp(tapUp(START + STOP), 1, smooth(T, STOP, STOP + 0.18, ease.out));
  const rise = smooth(T, 0.62, 1.0);
  const sitP = pose({ x: HIM.sitX, y: STOOL_SEAT - 3, s: S, f: 1, ...SIT, lean: 0.3, head: 0.18, look: 0.5 });
  const standX = HIM.sitX + 44;
  const standP = pose({ x: standX, y: standY(FLOOR, S) + 4, s: S, f: 1, lean: 0.24, head: -0.02, look: -0.25 });
  const p = mixPose(sitP, standP, rise);
  p.x = lerp(HIM.sitX, standX, rise);
  // the head lifts toward the door (as on the day she stood in it)
  const look = smooth(T, 0.16, 0.46);
  p.head = lerp(p.head, -0.1, look * (1 - rise));
  p.look = lerp(p.look, -0.35, look);
  p.lean = lerp(p.lean, 0.25, look * (1 - rise));
  // arm A: the hammer stops high, then is laid on the bench; arm B leaves the anvil
  const hamHand = [lerp(anvil[0] - 30, anvil[0] - 50, clamp(up)), lerp(anvil[1] - 30, anvil[1] - 62, clamp(up))];
  const lay = smooth(T, 0.5, 0.7);
  const layAt = [anvil[0] + 66, top - 6];
  const rA = reach(p, 'A', lerp(hamHand[0], layAt[0] - 4, lay), lerp(hamHand[1], layAt[1] - 2, lay));
  const rB = reach(p, 'B', anvil[0] + 4, anvil[1] - 4);
  const free = smooth(T, 0.66, 0.95);
  p.aA1 = lerp(rA.a1, 0.1, free);
  p.aA2 = lerp(rA.a2, 0.25, free);
  p.aB1 = lerp(rB.a1, -0.06, smooth(T, 0.52, 0.85));
  p.aB2 = lerp(rB.a2, 0.25, smooth(T, 0.52, 0.85));
  const j = figure(ctx, p, { ...OLD, alpha });
  if (lay < 0.98) hammer(ctx, j.handA[0], j.handA[1], lerp(lerp(0.62, -0.1, clamp(up)), 0.02, lay), 1);
  return lay;
}

// him in the doorway: a hand on the jamb, watching; then his head sinks
const DOOR_HIM = 1236;
function doorHim(ctx, T, t, alpha) {
  const breathe = Math.sin(t * 2.2) * 0.012;
  const p = pose({ x: DOOR_HIM, y: standY(FLOOR, S) + 4, s: S, f: 1, lean: 0.23 + breathe, head: 0.02, look: -0.15, lA1: 0.06, lB1: -0.08 });
  // follows the clown a little with his eyes, then the street is empty
  const sink = smooth(T, 1.6, 1.95);
  p.head = lerp(p.head, 0.42, sink);
  p.look = lerp(p.look, 0.9, sink);
  p.lean = lerp(p.lean, 0.28, sink);
  const r = reach(p, 'A', ROOM.x1 - 3, 604);
  p.aA1 = r.a1;
  p.aA2 = r.a2;
  p.aB1 = -0.05;
  p.aB2 = 0.18;
  figure(ctx, p, { ...OLD, alpha, eye: sink > 0.6 ? 'closed' : 'dot' });
}

function shotAC(ctx, T, t) {
  camera(ctx, camAC(t), () => {
    workshop(ctx, t, { melquiades: false, shelfFish: false });
    // the sun in the doorway (s09)
    ctx.save();
    ctx.beginPath();
    ctx.rect(DOOR.x0, DOOR.y0, 600, FLOOR - DOOR.y0);
    ctx.clip();
    ellipse(ctx, ROOM.x1 + 154, ROOM.doorTop + 114, 24, 24, { w: 3, alpha: 0.8, seed: 9020 });
    ctx.restore();
    parade(ctx, T, t);
    ants(ctx, t, ROOM.x1 + 30, 480, 560, 330, smooth(T, 1.45, 1.8));
    const top = bench(ctx, { lampGlow: 1 });

    // ---- THE fish on its nail; it stirs and glints as he gets up to go
    const stir = Math.exp(-Math.pow((T - 0.95) / 0.3, 2));
    const swing = 0.02 * Math.sin(t * 1.3) + Math.sin(T * 6) * 0.1 * stir;
    const fc = hangingFish(ctx, NAIL[0], NAIL[1] + 3, FISH_ON_NAIL.len, swing, FISH_ON_NAIL.s, { seed: 4200, glint: 0.25 + 0.75 * stir });
    goldGlow(ctx, fc[0], fc[1], 70, 0.45 + 0.4 * stir);
    nail(ctx);

    // ---- s09's can and crucible (the last melt cooling)
    line(ctx, CRU[0] - 20, CRU[1] + 2, CRU[0] - 26, TOP, { w: 3, seed: 9010, wobble: 0.3 });
    line(ctx, CRU[0] + 20, CRU[1] + 2, CRU[0] + 26, TOP, { w: 3, seed: 9011, wobble: 0.3 });
    line(ctx, CRU[0] - 24, CRU[1] + 2, CRU[0] + 24, CRU[1] + 2, { w: 3, seed: 9012, wobble: 0.3 });
    crucible(ctx, CRU[0], CRU[1], 0.9, 0.75);
    const hot = 0.15 * (1 - smooth(T, 0, 1.2));
    if (hot > 0.01) goldGlow(ctx, CRU[0], CRU[1] - 28, 90, hot);
    tinCan(ctx, CAN[0], CAN[1], 0.92, 0);

    // ---- him: at the bench, then (a dissolve in place) at the door
    const jk = smooth(T, JUMP[0], JUMP[1], ease.sine);
    let lay = 1;
    if (jk < 1) lay = benchHim(ctx, T, t, top, 1 - jk);
    if (lay >= 0.98) hammer(ctx, ANVIL()[0] + 66, top - 6, 0.02, 1);
    if (jk > 0) doorHim(ctx, T, t, jk);
  });
}

// ================================================================ shot B
// The chestnut tree drawn as in s06 (props.chestnutTree's trunk, a round
// scalloped crown), bigger: he stands under it.
export const TREE = { x: 1010, g: 860, s: 1.62 };
const TW = 26 * TREE.s;
const TRUNK_L = [[TREE.x - TW * 1.25, TREE.g], [TREE.x - TW * 0.72, TREE.g - 70 * TREE.s], [TREE.x - TW * 0.7, TREE.g - 150 * TREE.s], [TREE.x - TW * 0.9, TREE.g - 268 * TREE.s]];
// x of the trunk's left edge at height y
function trunkX(y) {
  const L = TRUNK_L;
  for (let i = 0; i < L.length - 1; i++) {
    if (y <= L[i][1] && y >= L[i + 1][1]) return lerp(L[i][0], L[i + 1][0], (L[i][1] - y) / (L[i][1] - L[i + 1][1]));
  }
  return L[L.length - 1][0];
}

function tree(ctx) {
  const { x, g, s } = TREE;
  const tw = TW;
  const L = TRUNK_L;
  const R = [[x + tw * 1.3, g], [x + tw * 0.78, g - 70 * s], [x + tw * 0.75, g - 150 * s], [x + tw * 0.95, g - 268 * s]];
  fillPoly(ctx, [...L, ...R.slice().reverse()], COL.paper, 1);
  path(ctx, L, { w: 5, seed: 5300 });
  path(ctx, R, { w: 5, seed: 5301 });
  // roots
  path(ctx, [[x - tw * 1.25, g], [x - tw * 2.1, g + 3], [x - tw * 2.9, g + 1]], { w: 3.4, seed: 5302 });
  path(ctx, [[x + tw * 1.3, g], [x + tw * 2.2, g + 2], [x + tw * 3.0, g + 4]], { w: 3.4, seed: 5303 });
  // bark: long grain lines and short marks
  const bark = [[-0.35, 30, 210], [0.05, 60, 250], [0.4, 20, 170], [-0.05, 190, 262]];
  bark.forEach(([u, y0, y1], i) => {
    const pts = [];
    for (let k = 0; k <= 6; k++) {
      const yy = g - lerp(y0, y1, k / 6) * s;
      pts.push([x + u * tw + Math.sin(k * 1.3 + i) * 3, yy]);
    }
    path(ctx, pts, { w: 2, alpha: 0.5, seed: 5310 + i, wobble: 0.8 });
  });
  for (let i = 0; i < 6; i++) {
    const yy = g - 30 * s - i * 38 * s;
    path(ctx, [[x - tw * 0.5 + (i % 2) * tw * 0.5, yy], [x - tw * 0.2 + (i % 2) * tw * 0.5, yy - 10 * s]], { w: 1.6, seed: 5320 + i, alpha: 0.6 });
  }
  // the crown (as in s06)
  const cx = x + 10 * s;
  const cy = g - 370 * s;
  const crown = [];
  const n = 120;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * TAU;
    const bump = 1 + 0.07 * Math.abs(Math.sin(a * 6.5));
    crown.push([cx + Math.cos(a) * 230 * s * bump, cy + Math.sin(a) * 125 * s * bump]);
  }
  path(ctx, crown, { w: 4.5, fill: COL.paper, close: true, seed: 5330, wobble: 1 });
  hatch(ctx, crown, { alpha: 0.09, gap: 16, seed: 5331 });
  // branches up into the crown
  path(ctx, [[x - tw * 0.9, g - 268 * s], [x - tw * 1.6, g - 300 * s], [x - tw * 3, g - 318 * s]], { w: 4.5, seed: 5332 });
  path(ctx, [[x + tw * 0.95, g - 268 * s], [x + tw * 1.5, g - 296 * s], [x + tw * 2.8, g - 312 * s]], { w: 4.5, seed: 5333 });
  path(ctx, [[x, g - 262 * s], [x + 4, g - 300 * s], [x + 10, g - 322 * s]], { w: 3.6, seed: 5334 });
}

function leaf(ctx, x, y, ang, s, a, seed) {
  const c = Math.cos(ang);
  const sn = Math.sin(ang);
  const P = (px, py) => [x + (px * c - py * sn) * s, y + (px * sn + py * c) * s];
  const pts = [];
  for (let i = 0; i <= 8; i++) {
    const u = i / 8;
    pts.push(P(lerp(-15, 15, u), -Math.sin(u * Math.PI) * 6.5 * (1 - 0.25 * u)));
  }
  for (let i = 1; i <= 8; i++) {
    const u = i / 8;
    pts.push(P(lerp(15, -15, u), Math.sin((1 - u) * Math.PI) * 6.5 * (1 - 0.25 * (1 - u))));
  }
  path(ctx, pts, { w: 2, fill: COL.paper, close: true, alpha: a, seed, wobble: 0.3 });
  path(ctx, [P(-20, 1), P(11, 0)], { w: 1.3, alpha: a * 0.8, seed: seed + 1, wobble: 0 });
}

// his pose under the tree at scene time T
const ARRIVE = [1.9, 2.5];
const SINK = [2.38, 2.7];
const REST = [2.55, 2.95];
function treePose(T) {
  const g = TREE.g;
  const xEnd = 866;
  const x0 = xEnd - 78;
  const k = prog(T, ARRIVE[0], ARRIVE[1]);
  const x = lerp(x0, xEnd, ease.out(k));
  const p = pose({ x, y: standY(g, S) + 4, s: S, f: 1, lean: 0.26, head: 0.2, look: 0.5 });
  if (k < 1) {
    const w = walk(walkPhase(x - x0, S) * 1.25, g, S, 0.45 * (1 - smooth(k, 0.7, 1)));
    Object.assign(p, w, { x, y: w.y + 4, lean: 0.26, head: 0.2 });
  }
  // like a chick: the head sinks down in front of the shoulders, then he leans
  // in until his forehead rests on the trunk; the arms hang
  const sink = smooth(T, SINK[0], SINK[1]);
  const rest = smooth(T, REST[0], REST[1]);
  p.lean = lerp(p.lean, 0.32, sink) + 0.1 * rest;
  p.head = lerp(p.head, 0.72, sink);
  p.look = lerp(p.look, 1, sink);
  const arms = smooth(T, 2.2, 2.7);
  p.aA1 = lerp(p.aA1, 0.12, arms);
  p.aA2 = lerp(p.aA2, 0.1, arms);
  p.aB1 = lerp(p.aB1, 0.0, arms);
  p.aB2 = lerp(p.aB2, 0.12, arms);
  if (k >= 1) {
    // straight legs, feet set back: the body becomes one leaning line
    const la = -0.06 - 0.05 * rest;
    const lb = -0.15 - 0.05 * rest;
    p.y = g - 4 - LEG * S * Math.cos((la + lb) / 2);
    Object.assign(p, { lA1: la, lA2: 0, lB1: lb, lB2: 0 });
    // lean in until the crown of the head meets the bark
    const j = joints(p);
    const touch = trunkX(j.head[1] - j.r * 0.5) - (j.head[0] + j.r * 0.92);
    p.x += touch * rest;
  }
  return p;
}
// where his chest ends up (for the match dissolve onto the fish in s11)
const REST_J = joints(treePose(9));
const CHEST = [lerp(REST_J.shoulder[0], REST_J.hip[0], 0.3), lerp(REST_J.shoulder[1], REST_J.hip[1], 0.3)];
// s11 opens on the fish hanging from its nail: put his chest where it hangs
const ZB = 1.78;
const FISH_SCR = fishOnScreen();
const CAM_B_END = { x: CHEST[0] - (FISH_SCR[0] - 960) / ZB, y: CHEST[1] - (FISH_SCR[1] - 540) / ZB, z: ZB };

// leaves: loosen from the crown, flutter down; a few come to rest on him
const LEAVES = (() => {
  const out = [];
  for (let i = 0; i < 18; i++) {
    const h = (k) => hash(i * 17.3 + k * 3.7 + 91);
    const onHim = [1, 4, 7, 10, 13][Math.floor(i / 3)] === i ? Math.floor(i / 3) : -1;
    out.push({
      t0: 1.95 + i * 0.075 + h(1) * 0.1 - (onHim >= 0 ? 0.1 : 0),
      dur: onHim >= 0 ? 0.95 + h(2) * 0.25 : 1.25 + h(2) * 0.6,
      x0: 640 + h(3) * 640,
      y0: 455 + h(4) * 50,
      sway: 18 + h(5) * 24,
      ph: h(6) * TAU,
      rot: h(7) * TAU,
      onHim,
      gx: 600 + h(8) * 760,
      size: 0.95 + h(9) * 0.3,
      rest: (h(10) - 0.5) * 0.8,
    });
  }
  return out;
})();

function shotB(ctx, T, t) {
  const cam = keys(T, [
    [CB[0], { x: 965, y: 570, z: 1.16 }],
    [3.65, CAM_B_END],
  ], ease.inOut);
  camera(ctx, cam, () => {
    const g = TREE.g;
    path(ctx, [[-300, g], [2300, g + 2]], { w: 5, seed: 5350, sketch: true });
    ants(ctx, t, 300, 380, 1300, 330, 0.7 * (1 - smooth(T, 2.0, 2.6)), 5150, 16);
    tree(ctx);

    const p = treePose(T);
    const merge = smooth(T, 2.62, 3.4);
    const j = figure(ctx, p, { ...OLD, eye: p.look > 0.7 ? 'closed' : 'dot', alpha: 1 - 0.3 * merge, w: lerp(5.5, 3.6, merge) });
    // his lines grow into the tree's: the trunk's outline runs on from the
    // bark, over his head and down his back into the ground; bark marks
    // cross his back; roots from his feet
    if (merge > 0) {
      const r = j.r;
      const [hx, hy] = j.head;
      const sh = j.shoulder;
      const hp = j.hip;
      const ft = j.footB;
      const nx = -Math.cos(p.lean);
      const ny = -Math.sin(p.lean);
      const off = 13;
      const back = (u) => [lerp(sh[0], hp[0], u) + nx * off, lerp(sh[1], hp[1], u) + ny * off];
      const y0 = hy - r * 2.2;
      const contour = [
        [trunkX(y0), y0],
        [hx - r * 0.1, hy - r * 1.45],
        [hx - r * 1.15, hy - r * 0.55],
        back(0.05),
        back(0.5),
        back(1),
        [lerp(hp[0], ft[0], 0.5) + nx * off * 0.8, lerp(hp[1], ft[1], 0.5)],
        [ft[0] - 22, g + 1],
        [ft[0] - 58, g + 3],
      ];
      path(ctx, contour, { w: 5, draw: clamp(merge * 1.1), seed: 5360 });
      for (let i = 0; i < 4; i++) {
        const u = 0.12 + i * 0.24;
        const bx = lerp(sh[0], hp[0], u) + nx * 4;
        const by = lerp(sh[1], hp[1], u) + ny * 4;
        path(ctx, [[bx - 8, by + 7], [bx + 3, by - 6]], { w: 1.8, alpha: 0.65 * smooth(merge, 0.2 + i * 0.13, 0.45 + i * 0.13), seed: 5380 + i, wobble: 0 });
      }
      // a long grain line from the bark down through his body
      const grain = [[trunkX(y0 - 40) + 14, y0 - 40], [hx + r * 0.2, hy - r * 0.2], back(0.4), back(0.95), [lerp(hp[0], ft[0], 0.6), lerp(hp[1], ft[1], 0.6)], [ft[0] + 4, g - 4]].map(([x, y], i) => [x + (i ? -nx * 18 : 0), y]);
      path(ctx, grain, { w: 2, alpha: 0.5, draw: clamp(merge * 1.25 - 0.2), seed: 5365, wobble: 0.8 });
      for (const [f, sd, dir] of [[j.footA, 5370, 1], [j.footB, 5372, -1]]) {
        path(ctx, [[f[0], f[1] - 2], [f[0] + dir * 14, g + 2], [f[0] + dir * 34, g + 4], [f[0] + dir * 58, g + 3]], { w: 2.8, alpha: 0.85, draw: clamp(merge * 1.3 - 0.25), seed: sd, wobble: 0.6 });
      }
    }
    // the leaves come down over him
    const r = j.r;
    const spots = [
      [j.head[0] - r * 0.7, j.head[1] - r * 0.95],
      [j.shoulder[0] - 10, j.shoulder[1] - 8],
      [lerp(j.shoulder[0], j.hip[0], 0.5) - 14, lerp(j.shoulder[1], j.hip[1], 0.5) - 10],
      [j.hip[0] - 18, j.hip[1] - 8],
      [j.footB[0] - 6, g - 6],
    ];
    for (let i = 0; i < LEAVES.length; i++) {
      const L = LEAVES[i];
      const u = prog(T, L.t0, L.t0 + L.dur);
      if (u <= 0) continue;
      const [tx2, ty2] = L.onHim >= 0 ? spots[L.onHim] : [L.gx, g - 5];
      const yy = lerp(L.y0, ty2, ease.sine(u));
      const xx = lerp(L.x0, tx2, ease.inOut(u)) + Math.sin(u * 7 + L.ph) * L.sway * (1 - u);
      const ang = lerp(L.rot + Math.sin(u * 6 + L.ph) * 0.9, L.rest + (L.onHim >= 0 ? -p.lean * 0.8 : 0), smooth(u, 0.8, 1));
      leaf(ctx, xx, yy, ang, L.size * 1.15, 1, 5400 + i * 2);
    }
  });
}

export default {
  fadeOut: 0.9,
  draw(ctx, lt, info) {
    const t = info.t;
    const T = lt;
    const k = smooth(T, CB[0], CB[1], ease.sine);
    if (k < 1) {
      if (k <= 0) shotAC(ctx, T, t);
      else withLayer(ctx, (l) => shotAC(l, T, t), { alpha: 1 - k });
    }
    if (k > 0) {
      if (k >= 1) shotB(ctx, T, t);
      else withLayer(ctx, (l) => shotB(l, T, t), { alpha: k });
    }
  },
};
