// s03 — 每个人都在自己的框里 (21.8–27.0)
// "无一例外 / 这世间的每一个人都是孤独无依"
// 一座房子的剖面，一行框，每人困在自己的框里：父亲被绑在院中的栗树下；乌尔苏拉在扫地；
// 阿玛兰妲缠着黑纱的手在绣花；丽贝卡坐在窗下偷偷吃土。镜头沿着这排框滑过去，停在最后
// 一格：作坊里，年轻的他伏在台上敲一条小金鱼。镜头推进，与 s04 开场的机位完全重合。
import { W, COL, TAU, lerp, smooth, keys, ease, path, line, rect, ellipse, ellipsePts, dot, fillPoly, hatch, camera } from '../lib.js';
import { figure, pose, reach, joints, standY, SIT } from '../figure.js';
import { frameBox } from '../sets.js';
import { goldFish, hammer, chestnutTree } from '../props.js';
import { workshop, bench, ANVIL, HIM, ROOM } from './s04.js';

const TOP = ROOM.top; // 150
const FLOOR = ROOM.floor; // 860
const OX = 2860; // the workshop (s04's room) sits at x + OX in this row
const R1 = [140, 880]; // the yard: the father under the chestnut tree
const R2 = [940, 1580]; // Úrsula sweeping
const R3 = [1640, 2280]; // Amaranta and her black hand
const R4 = [2340, 2980]; // Rebeca at the window, eating earth
const STOOL_SEAT = 780; // s04's stool

// ---------------------------------------------------------------- camera
// s04's opening camera, so the dissolve lands on the very same picture
const S04_CAM = [
  [0, { x: 580, y: 640, z: 2.3 }],
  [1.5, { x: 585, y: 630, z: 2.2 }],
];
function cameraAt(lt) {
  // after 4.8 (26.6) hold s04's opening camera through the dissolve, then follow its drift
  if (lt >= 4.8) {
    const c = keys(Math.max(0, lt - 5.2), S04_CAM, ease.sine);
    return { x: c.x + OX, y: c.y, z: c.z };
  }
  // glide along the row, then push in to the bench
  const gx = smooth(lt, -0.4, 4.8, ease.inOut);
  const x = lerp(930, OX + 580, gx);
  const w = smooth(lt, 2.7, 4.8, ease.inOut);
  const z0 = lerp(0.95, 1.0, smooth(lt, -0.4, 2.7));
  const z = Math.exp(lerp(Math.log(z0), Math.log(2.3), w));
  // keep the floor above the subtitles while they show, then settle on s04's framing
  const yBase = lerp(520, 640, w);
  const yPin = FLOOR - 340 / z;
  const y = lerp(Math.max(yBase, yPin), 640, smooth(lt, 4.25, 4.8));
  return { x, y, z };
}

// ---------------------------------------------------------------- helpers
// long skirt for the women of the house (to the ankles)
function longSkirt(ctx, p, j, seed, a = 1) {
  const s = p.s;
  const [hx, hy] = j.hip;
  const bottom = Math.max(j.footA[1], j.footB[1]) - 14 * s;
  const fx = (j.footA[0] + j.footB[0]) / 2;
  const pts = [[hx - 9 * s, hy - 16 * s], [fx - 30 * s, bottom], [fx + 30 * s, bottom], [hx + 9 * s, hy - 16 * s]];
  path(ctx, pts, { w: 3.6 * s, fill: COL.paper, close: true, seed, wobble: 0.5, alpha: a });
}

// a skirt over the lap when sitting (side view)
function lapSkirt(ctx, p, j, seed, a = 1) {
  const s = p.s;
  const f = p.f;
  const [hx, hy] = j.hip;
  const [kx, ky] = j.kneeA;
  const fy = Math.max(j.footA[1], j.footB[1]) - 12 * s;
  const pts = [[hx - f * 8 * s, hy - 16 * s], [hx - f * 14 * s, hy + 6 * s], [kx + f * 10 * s, ky + 6 * s], [kx + f * 16 * s, fy], [kx - f * 14 * s, fy], [kx - f * 10 * s, ky + 10 * s], [hx + f * 4 * s, hy + 8 * s]];
  path(ctx, pts, { w: 3.4 * s, fill: COL.paper, close: true, seed, wobble: 0.5, alpha: a });
}

function bun(ctx, j, p, back, seed) {
  // a small bun of hair at the back (back = 1) or top (back = 0) of the head
  const [hx, hy] = j.head;
  const r = j.r;
  const a = j.headAngle;
  const f = p.f;
  const bx = hx - f * Math.cos(a) * r * 0.9 * back + Math.sin(a) * f * r * (back ? 0.35 : 1.05);
  const by = hy - Math.sin(a) * r * 0.9 * back * f * f - Math.cos(a) * r * (back ? 0.35 : 1.05);
  ellipse(ctx, bx, by, r * 0.42, r * 0.38, { w: 3, fill: COL.paper, seed, wobble: 0.3 });
}

function leaf(ctx, x, y, ang, s, a, seed) {
  const c = Math.cos(ang);
  const sn = Math.sin(ang);
  const P = (px, py) => [x + (px * c - py * sn) * s, y + (px * sn + py * c) * s];
  path(ctx, [P(-9, 0), P(0, -4.5), P(9, 0), P(0, 4.5), P(-9, 0)], { w: 2, alpha: a, seed, wobble: 0.2, fill: COL.paper });
  path(ctx, [P(-12, 0), P(9, 0)], { w: 1.4, alpha: a * 0.8, seed: seed + 1, wobble: 0 });
}

// a plain chair, side view (seeded strokes); f: the way the sitter faces
function chairS(ctx, x, floor, s, f, seed) {
  const seat = floor - 60 * s;
  const hw = 26 * s;
  line(ctx, x - hw, seat, x + hw, seat, { w: 4.4, seed });
  line(ctx, x - hw * 0.8, seat, x - hw * 0.85, floor, { w: 4, seed: seed + 1 });
  line(ctx, x + hw * 0.8, seat, x + hw * 0.85, floor, { w: 4, seed: seed + 2 });
  const bx = x - f * hw;
  line(ctx, bx, seat, bx - f * 6 * s, seat - 78 * s, { w: 4, seed: seed + 3 });
  return seat;
}

// ---------------------------------------------------------------- the rooms
function roof(ctx) {
  // one long roof over the house (the yard on the left stays open to the sky)
  path(ctx, [[R2[0] - 70, TOP + 2], [R2[0] + 60, TOP - 84], [OX + 1340 - 60, TOP - 84], [OX + 1340 + 80, TOP + 2]], { w: 5, seed: 6400, sketch: true });
  for (let i = 0; i < 46; i++) {
    const x = R2[0] + 90 + i * 72;
    if (x > OX + 1260) break;
    path(ctx, [[x, TOP - 78], [x - 6, TOP - 30]], { w: 2, alpha: 0.35, seed: 6410 + i, wobble: 0.4 });
  }
}

function yard(ctx, t) {
  frameBox(ctx, R1[0], TOP, R1[1] - R1[0], FLOOR - TOP, { seed: 6500 });
  const tx = 470;
  const ts = 0.95;
  chestnutTree(ctx, tx, FLOOR, ts);
  // (the prop's crown sits a little above its trunk: carry the trunk up into it)
  const tw = 26 * ts;
  path(ctx, [[tx - tw * 0.9, FLOOR - 230 * ts], [tx - tw * 0.75, FLOOR - 290 * ts], [tx - 70, FLOOR - 318 * ts]], { w: 4.5, seed: 6510 });
  path(ctx, [[tx + tw * 0.95, FLOOR - 230 * ts], [tx + tw * 0.8, FLOOR - 286 * ts], [tx + 64, FLOOR - 316 * ts]], { w: 4.5, seed: 6511 });
  path(ctx, [[tx - 2, FLOOR - 262 * ts], [tx + 6, FLOOR - 316 * ts]], { w: 3.5, seed: 6512 });
  // José Arcadio Buendía, a giant grown old, tied to the trunk on a low stool
  const s = 1.3;
  const seat = FLOOR - 66;
  line(ctx, tx + 10, seat, tx + 78, seat, { w: 4.4, seed: 6513 });
  line(ctx, tx + 16, seat, tx + 13, FLOOR, { w: 3.6, seed: 6514 });
  line(ctx, tx + 72, seat, tx + 75, FLOOR, { w: 3.6, seed: 6515 });
  const nod = 0.32 + 0.05 * Math.sin(t * 0.9);
  const p = pose({ x: tx + 44, y: seat - 3, s, f: 1, ...SIT, lean: -0.1 + 0.01 * Math.sin(t * 1.3), head: nod, look: 0.9, aA1: 0.3, aA2: 0.5, aB1: 0.2, aB2: 0.5 });
  const j = figure(ctx, p, { id: 3, eye: 'closed' });
  // beard
  const [hx, hy] = j.head;
  for (let i = 0; i < 4; i++) path(ctx, [[hx + 6 + i * 5, hy + j.r * 0.8], [hx + 4 + i * 6, hy + j.r * 1.55 - i * 2]], { w: 2.2, seed: 6520 + i, wobble: 0.4 });
  // the rope: three loops round him and the trunk, a knot, a loose end
  const chest = j.shoulder;
  for (let i = 0; i < 3; i++) {
    const yy = lerp(chest[1] + 20, j.hip[1] - 26, i / 2);
    const xr = lerp(chest[0], j.hip[0], i / 2) + 8;
    const cx = (tx - 28 + xr) / 2;
    const rx = (xr - (tx - 28)) / 2;
    path(ctx, ellipsePts(cx, yy, rx, 7, 0, Math.PI, 10), { w: 2.8, seed: 6530 + i, wobble: 0.4 });
    path(ctx, ellipsePts(cx, yy, rx, 7, Math.PI, TAU, 10), { w: 2, alpha: 0.5, seed: 6540 + i, wobble: 0.4 });
  }
  dot(ctx, tx - 26, chest[1] + 48, 5, COL.ink);
  path(ctx, [[tx - 26, chest[1] + 48], [tx - 42, chest[1] + 70], [tx - 38, chest[1] + 96]], { w: 2.4, seed: 6550, wobble: 0.5 });
  // a few leaves coming down
  for (let i = 0; i < 3; i++) {
    const k = ((t * 0.16 + i / 3) % 1 + 1) % 1;
    const lx = 330 + i * 140 + Math.sin(k * 7 + i) * 26;
    const ly = lerp(480, FLOOR - 6, k);
    leaf(ctx, lx, ly, Math.sin(k * 9 + i) * 0.9, 1.1, Math.sin(Math.PI * k) * 0.8, 6560 + i * 3);
  }
}

function ursula(ctx, t) {
  frameBox(ctx, R2[0], TOP, R2[1] - R2[0], FLOOR - TOP, { seed: 6600 });
  // a small window and a chair: an ordinary room, swept every day
  rect(ctx, R2[0] + 70, 330, 110, 140, { w: 3, seed: 6601, alpha: 0.6 });
  line(ctx, R2[0] + 125, 330, R2[0] + 125, 470, { w: 2, seed: 6602, alpha: 0.5 });
  // Úrsula, small and old, sweeping
  const s = 1.02;
  const sweep = Math.sin(t * 3.0);
  const bx = 1340 + 46 * sweep; // broom head on the floor
  const p = pose({ x: 1210 + 4 * sweep, y: standY(FLOOR, s) + 2, s, f: 1, lean: 0.24, head: 0.12, look: 0.7, lA1: 0.12, lB1: -0.1 });
  // the broom: from the floor up and back past her hands
  const top = [bx - 150, FLOOR - 270];
  const along = (u) => [lerp(bx, top[0], u), lerp(FLOOR - 12, top[1], u)];
  const hA = along(0.42);
  const hB = along(0.7);
  let r = reach(p, 'A', hA[0], hA[1]);
  p.aA1 = r.a1;
  p.aA2 = r.a2;
  r = reach(p, 'B', hB[0], hB[1]);
  p.aB1 = r.a1;
  p.aB2 = r.a2;
  path(ctx, [[bx, FLOOR - 12], top], { w: 3.4, seed: 6610, wobble: 0.3 });
  for (let i = 0; i < 6; i++) path(ctx, [[bx - 2, FLOOR - 16], [bx - 22 + i * 9 - sweep * 6, FLOOR - 1]], { w: 2, seed: 6620 + i, wobble: 0.2 });
  const j = figure(ctx, p, { id: 4 });
  longSkirt(ctx, p, j, 6630);
  bun(ctx, j, p, 1, 6631);
  // dust puffs at the end of each stroke
  for (let i = 0; i < 4; i++) {
    const ph = (t * 3.0) / TAU;
    const k = ((ph - Math.floor(ph)) * 2) % 1;
    const a = Math.sin(Math.PI * k) * 0.45;
    const side = Math.cos(t * 3.0) > 0 ? 1 : -1;
    dot(ctx, bx + side * (30 + k * 30 + i * 9), FLOOR - 8 - k * (10 + i * 7), 2 + (i % 2), COL.ink, a);
  }
}

function amaranta(ctx, t) {
  frameBox(ctx, R3[0], TOP, R3[1] - R3[0], FLOOR - TOP, { seed: 6700 });
  // a little shelf with nothing on it
  line(ctx, R3[0] + 60, 400, R3[0] + 220, 400, { w: 3, seed: 6701, alpha: 0.6 });
  // Amaranta sits very straight, turned to the wall, embroidering;
  // one hand wrapped in black gauze
  const s = 1.12;
  const cx = 2010;
  const seat = chairS(ctx, cx, FLOOR, s * 1.1, -1, 6720);
  const p = pose({ x: cx, y: seat - 3 * s, s, f: -1, ...SIT, lean: 0.02, head: 0.22, look: 0.9 });
  const hoop = [cx - 72, seat - 70];
  const pull = Math.max(0, Math.sin(t * 2.6));
  const needle = [hoop[0] + 6 - 10 * pull, hoop[1] - 6 - 82 * pull];
  let r = reach(p, 'B', hoop[0] + 14, hoop[1] + 10);
  p.aB1 = r.a1;
  p.aB2 = r.a2;
  r = reach(p, 'A', needle[0], needle[1]);
  p.aA1 = r.a1;
  p.aA2 = r.a2;
  const j = figure(ctx, p, { id: 5 });
  lapSkirt(ctx, p, j, 6710);
  bun(ctx, j, p, 0, 6711);
  // the embroidery hoop and the thread
  ellipse(ctx, hoop[0], hoop[1], 30, 9, { w: 3, seed: 6712, fill: COL.paper });
  path(ctx, [[hoop[0] + 2, hoop[1] - 2], [j.handA[0], j.handA[1]]], { w: 1.2, seed: 6713, wobble: 0.2, alpha: 0.7 });
  // the hand wrapped in black gauze, to the wrist
  const wrist = [lerp(j.elbowA[0], j.handA[0], 0.62), lerp(j.elbowA[1], j.handA[1], 0.62)];
  path(ctx, [wrist, j.handA], { w: 10 * s, seed: 6714, wobble: 0.2, cap: 'round' });
  ellipse(ctx, j.handA[0], j.handA[1], 7.5 * s, 6.5 * s, { w: 0, fill: COL.ink });
}

function rebeca(ctx, t) {
  frameBox(ctx, R4[0], TOP, R4[1] - R4[0], FLOOR - TOP, { seed: 6800 });
  // a low window: night outside, a thin moon
  const wx = 2600;
  const wy = 470;
  const ww = 170;
  const wh = 170;
  hatch(ctx, [wx, wy, ww, wh], { alpha: 0.28, gap: 9, seed: 6810 });
  rect(ctx, wx, wy, ww, wh, { w: 4, seed: 6801 });
  line(ctx, wx + ww / 2, wy, wx + ww / 2, wy + wh, { w: 3, seed: 6802 });
  line(ctx, wx, wy + wh / 2, wx + ww, wy + wh / 2, { w: 3, seed: 6803 });
  const mx = wx + 122;
  const my = wy + 42;
  fillPoly(ctx, [...ellipsePts(mx, my, 16, 16, -1.9, 1.9, 12), ...ellipsePts(mx + 7, my, 13, 13, 1.75, -1.75, 12)], '#f4efe2', 1);
  line(ctx, wx - 10, wy + wh + 4, wx + ww + 10, wy + wh + 4, { w: 4, seed: 6804 });
  // a flowerpot of earth on the floor
  const pot = [2648, FLOOR];
  path(ctx, [[pot[0] - 22, pot[1] - 40], [pot[0] - 16, pot[1]], [pot[0] + 16, pot[1]], [pot[0] + 22, pot[1] - 40]], { w: 3, fill: COL.paper, close: true, seed: 6820 });
  ellipse(ctx, pot[0], pot[1] - 40, 22, 5, { w: 0, fill: COL.ink, alpha: 0.85 });
  // Rebeca on the floor under the window, knees up, looking out;
  // her hand goes from the earth to her mouth, furtively
  const s = 1.1;
  const p = pose({ x: 2510, y: FLOOR - 4, s, f: 1, lean: 0.08, head: -0.22, look: -0.6 });
  const rl = reach(p, 'A', 2582, FLOOR - 2, 'leg');
  p.lA1 = rl.a1;
  p.lA2 = rl.a2;
  const rl2 = reach(p, 'B', 2574, FLOOR - 2, 'leg');
  p.lB1 = rl2.a1;
  p.lB2 = rl2.a2;
  // hand cycle: pot -> mouth -> hold -> pot
  const cyc = ((t * 0.55) % 1 + 1) % 1;
  const toMouth = smooth(cyc, 0.12, 0.42) * (1 - smooth(cyc, 0.72, 0.95));
  const jj = joints(p);
  const mouth = [jj.head[0] + jj.r * 0.95, jj.head[1] + jj.r * 0.45];
  const handT = [lerp(pot[0] - 4, mouth[0], toMouth), lerp(pot[1] - 44, mouth[1], toMouth) - Math.sin(Math.PI * toMouth) * 30];
  let r = reach(p, 'A', handT[0], handT[1]);
  p.aA1 = r.a1;
  p.aA2 = r.a2;
  r = reach(p, 'B', jj.kneeA[0] - 4, jj.kneeA[1] + 6);
  p.aB1 = r.a1;
  p.aB2 = r.a2;
  p.head = lerp(-0.22, 0.12, toMouth);
  p.look = lerp(-0.6, 0.3, toMouth);
  const j = figure(ctx, p, { id: 6 });
  // long hair down her back
  const [hx, hy] = j.head;
  for (let i = 0; i < 3; i++) path(ctx, [[hx - j.r * 0.8, hy - j.r * 0.4 + i * 5], [hx - j.r * 1.15 - i * 3, hy + j.r * 1.2], [hx - j.r * 1.0 - i * 4, hy + j.r * 2.6]], { w: 2.4, seed: 6830 + i, wobble: 0.5 });
  // a crumb of earth in her fingers
  if (toMouth > 0.05 && toMouth < 0.98) dot(ctx, j.handA[0] + 3, j.handA[1] - 3, 4.2, COL.ink, 0.9);
}

// the workshop: exactly s04's opening (same set, same pose, the same taps)
function atWork(ctx, t) {
  ctx.save();
  ctx.translate(OX, 0);
  workshop(ctx, t);
  bench(ctx);
  const anvil = ANVIL();
  const T = t - 27.0;
  // the taps run in time with s04's; the last one before s04 lands at 26.615
  // and the hammer rests on the anvil, as in s04's first frame
  const rest = T > -1 / 2.6 && T <= 0;
  const tapping = T < 1.6;
  const ph = rest ? 0 : ((T * 2.6) % 1 + 1) % 1;
  const up = tapping ? Math.pow(Math.sin(ph * Math.PI), 0.7) : 1;
  const hamHand = [lerp(anvil[0] - 30, anvil[0] - 52, up), lerp(anvil[1] - 30, anvil[1] - 76, up)];
  const p = pose({ x: HIM.sitX, y: STOOL_SEAT - 3, s: HIM.s, f: 1, ...SIT, lean: 0.12, head: 0.12, look: 0.6 });
  let r = reach(p, 'A', hamHand[0], hamHand[1]);
  p.aA1 = r.a1;
  p.aA2 = r.a2;
  r = reach(p, 'B', anvil[0] + 4, anvil[1] - 4);
  p.aB1 = r.a1;
  p.aB2 = r.a2;
  const j = figure(ctx, p, { id: 1, mustache: true, eye: 'dot' });
  hammer(ctx, j.handA[0], j.handA[1], lerp(0.62, -0.25, up), 1);
  goldFish(ctx, anvil[0] + 6, anvil[1] - 7, 0.5, 0.05, { glint: tapping && ph < 0.12 ? 0.8 : 0, seed: 4200 });
  ctx.restore();
}

export default {
  fadeIn: 0.6,
  draw(ctx, lt, info) {
    const t = info.t;
    const cam = cameraAt(lt);
    // only draw what the camera can see
    const half = W / 2 / cam.z;
    const vis = (a, b) => b > cam.x - half - 60 && a < cam.x + half + 60;
    camera(ctx, cam, () => {
      roof(ctx);
      if (vis(R1[0], R1[1])) yard(ctx, t);
      if (vis(R2[0], R2[1])) ursula(ctx, t);
      if (vis(R3[0], R3[1])) amaranta(ctx, t);
      if (vis(R4[0], R4[1])) rebeca(ctx, t);
      if (vis(OX + ROOM.x0, OX + W)) atWork(ctx, t);
    });
  },
};
