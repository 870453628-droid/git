// s05 · 76–92 · 向内 — turning inward (implicit: he never glows)
//  A 76.0–80.9  the soft grey nowhere s04 leaves him in, exactly as it left
//               him: eyes closed, a hand on his chest. 不再等别人: he opens his
//               eyes, the camera leans in a little; the hand comes down; he
//               turns his back on where the lights went and walks the other
//               way, head up, an even step. As he walks a pencil floor line
//               runs out under him and the grey quietly lifts — the world
//               gets lighter round him (nothing shines from him). The camera
//               lets him go: it pulls back and drifts with him.
//  B 80.3–92    (dissolve, the camera still travelling left) his room by day:
//               sunlight slants in through the window, dust in it. The pan
//               comes to rest on him at the table, absorbed, his hands going;
//               我开始做自己想做的事: little ink pictures pop up over his head
//               one after another (a stage, a bird, a road, a star) — the
//               camera eases in, he smiles, sits back, admires, goes on.
//               86.3: outside the window a far brighter light — the glass
//               blazes, a cheering crowd streams past as black shapes, a big
//               beam swings in across the floor and stops just short of his
//               feet; the star bubble bursts; whip to the window. He looks
//               back over his shoulder, hands still. The light goes on its
//               way; he looks at the empty window, turns back, thinks — lowers
//               his head and goes on (a kite pops up). Then the day goes:
//               the sunbeam lengthens and fades, night, the moon; the camera
//               rises and pulls back into the wide shot where s06's light
//               will land (s06 continues this take: hard cut, same frame).
//
// The room take (B) is shared with s06: roomFrame(ctx, t, TAKE) draws one
// frame from keyframe tracks; s06 appends its own keys to TAKE5.
import { W, H, COL, TAU, clamp, lerp, prog, smooth, ease, hash, noise1, camera, path, line, rect, ellipse, ellipsePts, fillPoly, dot, paper, withLayer } from '../lib.js';
import { figure, pose, joints, walk, reach, SIT, SIT_LIFT, LEG } from '../figure.js';
import { stage } from '../light.js';
import { dust } from '../theatre.js';
import { ROOM, room, ROOM_SPOT } from '../room.js';
import { cloud, moon } from '../sets.js';
import { S04_END, chestArm } from './s04.js';

const T0 = 76;
const R = ROOM;
const S = R.s;
export const TOP = R.floor - 150 * S; // table top
export const SEAT = R.floor - 92 * S;
export const HIP = [R.stoolX + 4, SEAT - SIT_LIFT * S];
export const KX = R.hingeX - 88 * S; // where his hands sit on the keys
const DARK = '#151311';

// ================================================================ tracks
// kv(t, [[t0, v0], [t1, v1, ease?], ...]): piecewise keys; a key's ease
// shapes the segment that ENDS at it (default inOut). Numbers or objects.
export function kv(t, kf) {
  if (t <= kf[0][0]) return kf[0][1];
  for (let i = 1; i < kf.length; i++) {
    const [t1, v1, e] = kf[i];
    if (t <= t1) {
      const [t0, v0] = kf[i - 1];
      const k = (e ?? ease.inOut)(t1 > t0 ? clamp((t - t0) / (t1 - t0)) : 1);
      if (typeof v0 === 'number') return lerp(v0, v1, k);
      const out = { ...v0 };
      for (const key in v1) out[key] = typeof v0[key] === 'number' ? lerp(v0[key], v1[key], k) : v1[key];
      return out;
    }
  }
  return kf[kf.length - 1][1];
}
export const whipE = (k) => (k < 0.5 ? 8 * k * k * k * k : 1 - Math.pow(-2 * k + 2, 4) / 2);
export const STEP = (k) => (k < 1 ? 0 : 1);

// ================================================================== gait
// (as s04's) a walk whose stance foot stays planted while cadence and
// stride change. cadence: steps/s; amt: stride 0..1.
const stanceRel = (ph, sw, legB) => LEG * Math.sin((legB ? -sw : sw) * Math.sin(ph * TAU));
function makeGait(t0, t1, cadence, amtAt) {
  const DT = 1 / 300;
  const n = Math.ceil((t1 - t0) / DT) + 2;
  const PH = new Float64Array(n);
  const U = new Float64Array(n);
  let ph = 0;
  let u = 0;
  for (let i = 0; i < n; i++) {
    PH[i] = ph;
    U[i] = u;
    const t = t0 + (i + 0.5) * DT;
    const dph = (cadence(t) / 2) * DT;
    const legB = Math.cos(TAU * (ph + dph / 2)) > 0;
    const sw0 = 0.42 * amtAt(t0 + i * DT);
    const sw1 = 0.42 * amtAt(t0 + (i + 1) * DT);
    u -= stanceRel(ph + dph, sw1, legB) - stanceRel(ph, sw0, legB);
    ph += dph;
  }
  return (t) => {
    const x = clamp((t - t0) / DT, 0, n - 1.001);
    const i = Math.floor(x);
    const f = x - i;
    return { ph: lerp(PH[i], PH[i + 1], f), u: lerp(U[i], U[i + 1], f), amt: t < t0 ? 0 : amtAt(t) };
  };
}

// ============================================================ A: the grey
const TURN = [77.22, 77.44, 77.64]; // head round, front view, facing left
const WALK0 = 77.9;
const XF = [80.3, 80.9]; // dissolve into the room
const gA = makeGait(WALK0, 81.2, (t) => kv(t, [[WALK0, 1.1], [WALK0 + 0.9, 1.7]]), (t) => kv(t, [[WALK0, 0], [WALK0 + 0.8, 0.7]]));
let P0 = null;
const startPose = () => P0 ?? (P0 = S04_END.pose());
const xA = (t) => S04_END.x - 4 - gA(t).u * S04_END.s;

function himA(t) {
  const P = startPose();
  const s = P.s;
  const eye = t < 76.64 || (t > 78.55 && t < 78.66) ? 'closed' : 'dot';
  const mouth = kv(t, [[77.0, 0], [77.6, 0.12]]);
  if (t < TURN[1]) {
    const p = { ...P };
    p.head = kv(t, [[76.75, P.head], [77.35, 0.03]]);
    p.look = kv(t, [[76.68, P.look], [77.3, 0.0]]);
    // a breath as the eyes open
    p.lean = kv(t, [[76.6, P.lean], [76.95, 0.0], [77.3, 0.02]]);
    p.turn = kv(t, [[TURN[0], 0], [TURN[1], 1]]);
    return { p, eye, mouth, chest: 1 - smooth(t, 76.86, 77.34) };
  }
  if (t < TURN[2]) {
    // half way round: facing us for a moment, a small step
    const k = prog(t, TURN[1], TURN[2]);
    const st = Math.sin(Math.PI * k);
    const p = pose({
      view: 'front', x: P.x - 2 - 2 * k, y: P.y - 2 * st, s, head: 0, look: 0, turn: lerp(-0.25, -0.95, k),
      lA1: 0.06, lA2: 0, lB1: 0.06 + 0.1 * st, lB2: -0.25 * st, aA1: 0.1, aA2: 0.08, aB1: 0.1, aB2: 0.08,
    });
    return { p, eye, mouth, chest: 0 };
  }
  // facing left; then walking, head up
  const g = gA(t);
  const w = walk(g.ph, P.y + LEG * s, s, g.amt);
  const a = Math.sin(g.ph * TAU);
  const sw = 0.2 * clamp(g.amt / 0.6);
  const p = pose({
    ...w, x: xA(t), s, f: -1,
    lean: w.lean * 0.6 + 0.02, head: kv(t, [[TURN[2], 0.0], [79.5, 0.04]]), look: 0.05,
    turn: kv(t, [[TURN[2], 0.55], [77.95, 0]]),
    aA1: -0.02 - sw * a, aA2: 0.14, aB1: -0.02 + sw * a, aB2: 0.14,
  });
  return { p, eye, mouth, chest: 0 };
}

function camA(t) {
  // lean in while his eyes open; then let him go: pull back, drift with him
  const push = smooth(t, 76.3, 77.45, ease.sine);
  const pull = smooth(t, 77.4, 80.9, ease.inOut);
  const z0 = 1 + 0.42 * push;
  const x0 = lerp(960, 850, push);
  const y0 = lerp(540, 598, push);
  return { x: lerp(x0, xA(t) - 190, pull), y: lerp(y0, 430, pull), z: lerp(z0, 0.68, pull) };
}

function shotA(ctx, t) {
  const cam = camA(t);
  const h = himA(t);
  const lift = smooth(t, 77.5, 80.9, ease.inOut);
  camera(ctx, cam, () => {
    // the floor runs out under him, ahead and behind
    const fy = S04_END.feet + 1;
    const x0 = S04_END.x;
    const dl = smooth(t, 77.75, 80.6, ease.out);
    const dr = smooth(t, 77.85, 79.6, ease.out);
    const fa = 0.42 * smooth(t, 77.75, 78.4);
    if (dl > 0) path(ctx, [[x0, fy], [x0 - 2600, fy + 2]], { w: 2.6, alpha: fa, draw: dl, seed: 9101, wobble: 0.9 });
    if (dr > 0) path(ctx, [[x0 + 6, fy], [x0 + 1500, fy - 1]], { w: 2.6, alpha: fa, draw: dr, seed: 9102, wobble: 0.9 });
    figure(ctx, h.p, { id: 1, cowlick: true, eye: h.eye, mouth: h.mouth });
    if (h.chest > 0) chestArm(ctx, h.p, h.chest);
    // the grey lifts: a wide soft lightening, more of it ahead of him
    const lights = [];
    // like the cyclorama at dawn: the light comes up from the horizon ahead
    if (lift > 0.001) {
      lights.push({ type: 'glow', x: x0 - 900, y: fy + 40, r: lerp(900, 2300, lift), k: 0.55 * lift });
      lights.push({ type: 'glow', x: x0 - 300, y: fy - 260, r: lerp(800, 1900, lift), k: 0.22 * lift });
    }
    stage(ctx, lights, { dark: lerp(S04_END.dark, 0.4, lift), beams: 0 });
  });
}

// ============================================================ B: his room
// Every value of the take, keyed on film time. s06 extends these arrays.
const E = ease;
export const TAKE5 = {
  cam: [
    [XF[0], { x: 1440, y: 545, z: 1.3 }],
    [81.95, { x: 1002, y: 540, z: 1.36 }, E.out],
    [86.3, { x: 1012, y: 522, z: 1.55 }, E.sine],
    [86.72, { x: 772, y: 540, z: 1.2 }, whipE],
    [88.95, { x: 755, y: 542, z: 1.17 }, E.sine],
    [91.3, { x: 935, y: 532, z: 1.33 }, E.inOut],
    [92.6, { x: 990, y: 482, z: 1.1 }, E.inOut],
  ],
  // the take is one whip; motion smear while it runs
  whips: [[86.3, 86.74]],
  day: [[XF[0], 1], [90.95, 1], [92.45, 0, E.inOut]],
  sunM: [[XF[0], 0.55], [90.95, 0.55], [92.3, 0.95, E.in]],
  // the bright light passing outside the window
  flare: [[86.1, 0], [86.36, 1, E.in], [88.25, 1], [89.05, 0, E.out]],
  flareM: [[86.2, 0.92], [88.95, -0.8, E.sine]],
  // the sun's own beam gives way while the bright one goes by
  sunOff: [[86.1, 0], [86.36, 1, E.in], [88.95, 1], [89.6, 0]],
  spot: [[0, { k: 0, rx: ROOM_SPOT.rx, ry: ROOM_SPOT.ry }]],
  flashes: [],
  // him
  type: [[XF[0], 1], [86.36, 1], [86.42, 0, E.linear], [90.4, 0], [90.6, 1]],
  lift: [[86.36, 0], [86.52, 0.45, E.out], [88.9, 0.4], [89.45, 0]],
  lap: [[0, 0]],
  // a hand to his chin: he thinks it over
  chin: [[89.3, 0], [89.75, 1], [90.1, 1], [90.5, 0]],
  lean: [[XF[0], 0.13], [82.85, 0.13], [83.3, 0.04], [84.0, 0.04], [84.45, 0.14], [86.38, 0.14], [86.55, 0.08, E.out], [89.1, 0.07], [89.6, 0.1], [90.1, 0.1], [90.5, 0.14]],
  nod: [[XF[0], 0.07], [82.85, 0.07], [83.3, -0.1], [84.0, -0.1], [84.45, 0.08], [86.38, 0.08], [86.9, -0.2], [88.5, -0.1], [89.0, -0.06], [89.4, 0.0], [90.1, 0.04], [90.5, 0.14]],
  look: [[XF[0], 0.45], [82.85, 0.45], [83.3, 0.12], [84.0, 0.12], [84.45, 0.45], [86.38, 0.45], [86.6, -0.2], [86.9, -0.35], [88.9, -0.2], [89.35, 0.0], [89.7, -0.15], [90.1, 0.0], [90.5, 0.5]],
  back: [[86.42, 0], [86.86, 1.72], [88.5, 1.42], [88.95, 1.5], [89.35, 0]],
  mouth: [[XF[0], 0.15], [81.4, 0.45], [82.9, 0.75], [84.0, 0.6], [86.38, 0.6], [86.55, 0.08], [87.6, 0.18], [88.6, 0.0], [89.6, -0.08], [90.2, 0.0], [91.0, 0.35]],
  shut: [[84.15, 84.27], [85.85, 85.95], [89.5, 89.72], [91.6, 91.72]],
  pics: [
    { kind: 'stage', t: 81.15, x: 860, y: 408 },
    { kind: 'bird', t: 82.35, x: 1072, y: 362 },
    { kind: 'road', t: 83.55, x: 888, y: 300 },
    { kind: 'star', t: 84.75, x: 1078, y: 440, end: 86.42 },
    { kind: 'kite', t: 90.7, x: 875, y: 398, dur: 1.55 },
    { kind: 'boat', t: 91.15, x: 1070, y: 368, dur: 1.15 },
  ],
};

// ------------------------------------------------------------ him at the table
// st: {lean, nod (+ = head down), look, back (0 = at his work .. 1 facing us
// .. 2 looking back over his shoulder), type, lift, lap, chin}
export function seated(t, st) {
  const p = pose({ ...SIT, x: HIP[0], y: HIP[1], s: S, f: 1, lean: st.lean, head: st.nod, look: st.look });
  const ty = st.type ?? 0;
  // fingers on the keys: little taps, the hands wander along the board
  const wander = noise1(t * 0.9, 7) * lerp(9, 7, st.soft ?? 0);
  // each hand lifts and strikes, out of step with the other; st.soft (0..1)
  // eases to room.js sitter()'s lighter patter (as s07 picks him up)
  const sk = st.soft ?? 0;
  let A = [KX + 6 + wander + noise1(t * 2.1, 3) * lerp(4, 3, sk) * ty, TOP - lerp(6, 8, sk) * S + lerp(-Math.abs(Math.sin(t * 9.4)) * 7, Math.sin(t * 19) * 2.6 + Math.sin(t * 7.3) * 1.1, sk) * ty];
  let B = [KX + 22 + wander + noise1(t * 1.7, 5) * lerp(4, 3, sk) * ty, TOP - lerp(6, 8, sk) * S + lerp(-Math.abs(Math.sin(t * 10.9 + 1.2)) * 7, Math.sin(t * 23 + 1) * 2.6, sk) * ty];
  const lift = st.lift ?? 0;
  if (lift > 0) {
    A = [A[0] - 10 * lift, A[1] - 30 * lift];
    B = [B[0] - 6 * lift, B[1] - 26 * lift];
  }
  // hands back into the lap: up and round the table's edge, then down
  const lap = st.lap ?? 0;
  if (lap > 0) {
    const bez = (P, C, Q, k) => [(1 - k) * (1 - k) * P[0] + 2 * k * (1 - k) * C[0] + k * k * Q[0], (1 - k) * (1 - k) * P[1] + 2 * k * (1 - k) * C[1] + k * k * Q[1]];
    A = bez(A, [925, 598], [986, 690], lap);
    B = bez(B, [930, 602], [994, 692], lap);
  }
  const chin = st.chin ?? 0;
  if (chin > 0) {
    const j = joints(p);
    const a = j.headAngle;
    const C = [j.head[0] + (Math.cos(a) * 0.55 + Math.sin(a) * -1.0) * j.r, j.head[1] + (Math.sin(a) * 0.55 + Math.cos(a) * 1.0) * j.r];
    const k = ease.inOut(chin);
    A = [lerp(A[0], C[0], k) - Math.sin(Math.PI * k) * 18, lerp(A[1], C[1], k) - Math.sin(Math.PI * k) * 10];
  }
  const rA = reach(p, 'A', A[0], A[1]);
  const rB = reach(p, 'B', B[0], B[1]);
  p.aA1 = rA.a1;
  p.aA2 = rA.a2;
  p.aB1 = rB.a1;
  p.aB2 = rB.a2;
  return p;
}

// Draw him; back > 1 turns his head round past the camera to look back over
// his shoulder (the head is drawn again facing the other way, clipped).
export function drawHim(ctx, p, o = {}) {
  const back = o.back ?? 0;
  if (back <= 1) {
    return figure(ctx, { ...p, turn: Math.max(p.turn ?? 0, back) }, { id: 1, cowlick: true, eye: o.eye, mouth: o.mouth });
  }
  // keep the head where it is: the mirrored figure's head must coincide
  const j = figure(ctx, { ...p, turn: 1 }, { id: 1, eye: 'none' });
  const q = { ...p, f: -p.f, lean: -p.lean, head: -p.head, turn: clamp(2 - back), aA1: 0, aA2: 0, aB1: 0, aB2: 0, lA1: 0, lA2: 0, lB1: 0, lB2: 0 };
  ctx.save();
  ctx.beginPath();
  ctx.arc(j.head[0], j.head[1], j.r * 1.75, 0, TAU);
  ctx.clip();
  figure(ctx, q, { id: 1, cowlick: true, eye: o.eye, mouth: o.mouth });
  ctx.restore();
  return j;
}

// his state at time t from a take's tracks
export function himAt(t, T) {
  const back = kv(t, T.back);
  // the nod goes through zero while the face swings past the camera
  const nodK = clamp(Math.abs(back - 1) * 3);
  const nod = kv(t, T.nod) * (back > 1 ? -1 : 1) * (back > 0.66 && back < 1.34 ? nodK : 1);
  const st = {
    lean: kv(t, T.lean) + (T.sway ? T.sway(t) : 0),
    nod,
    look: kv(t, T.look),
    back,
    type: kv(t, T.type),
    lift: kv(t, T.lift),
    lap: kv(t, T.lap),
    chin: kv(t, T.chin),
    soft: T.soft ? kv(t, T.soft) : 0,
  };
  const p = seated(t, st);
  const eye = T.shut.some(([a, b]) => t >= a && t < b) ? 'closed' : 'dot';
  return { p, back, eye, mouth: kv(t, T.mouth) };
}

// ------------------------------------------------------------ thought pictures
// Little ink sketches in paper frames that pop up over his head: strokes in
// a frame of ±72 × ±52, drawn on in order.
const circ = (x, y, r, a0 = 0, a1 = TAU, n = 16) => ellipsePts(x, y, r, r, a0, a1, n);
const STAR = (() => {
  const pts = [];
  for (let i = 0; i <= 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const r = i % 2 ? 14 : 34;
    pts.push([Math.cos(a) * r, 4 + Math.sin(a) * r]);
  }
  return pts;
})();
export const SKETCH = {
  stage: [
    [[-56, 42], [-56, -38], [56, -38], [56, 42]],
    [[-56, -38], [-42, -12], [-38, 12], [-46, 34]],
    [[56, -38], [42, -12], [38, 12], [46, 34]],
    [[-50, 34], [50, 34]],
    [[-3, -38], [-15, 32]],
    [[3, -38], [15, 32]],
    circ(0, 7, 4.5),
    [[0, 11.5], [0, 22]],
    [[-5, 32], [0, 22], [5, 32]],
    [[-6, 13], [0, 16], [6, 13]],
  ],
  bird: [
    [[-48, 2], [-32, -14], [-16, -12], [-2, 4]],
    [[-2, 4], [12, -14], [30, -18], [48, -6]],
    [[-8, 4], [2, 8], [12, 5]],
    [[16, 26], [22, 20], [27, 25]],
    [[27, 25], [32, 20], [38, 25]],
    [[-62, 16], [-44, 16]],
    [[-58, 24], [-48, 24]],
  ],
  road: [
    [[-64, -6], [64, -6]],
    circ(0, -6, 13, Math.PI, TAU, 12),
    [[-52, 46], [-4, -6]],
    [[52, 46], [4, -6]],
    [[0, 42], [0, 33]],
    [[0, 22], [0, 16]],
    [[0, 8], [0, 4]],
    [[-64, -6], [-46, -16], [-30, -6]],
  ],
  star: [STAR, [[46, -32], [54, -40]], [[50, -24], [60, -24]], [[-46, 28], [-55, 34]]],
  kite: [
    [[0, -42], [24, -8], [0, 28], [-24, -8], [0, -42]],
    [[0, -42], [0, 28]],
    [[-24, -8], [24, -8]],
    [[0, 28], [-7, 36], [4, 42], [-5, 50]],
    [[2, 28], [40, 52]],
  ],
  boat: [
    [[-42, 12], [42, 12], [28, 28], [-28, 28], [-42, 12]],
    [[0, 12], [0, -40]],
    [[2, -38], [32, 6], [2, 6]],
    [[-60, 38], [-44, 32], [-28, 38], [-12, 32], [4, 38], [20, 32], [36, 38], [52, 32], [62, 36]],
  ],
  tree: [
    [[-56, 40], [56, 40]],
    [[-2, 40], [0, 4]],
    [[0, 18], [-12, 8]],
    circ(0, -16, 26, -2.2, -2.2 + TAU + 0.2, 20),
    [[30, -40], [36, -46]],
    [[38, -32], [46, -34]],
  ],
  house: [
    [[-60, 40], [60, 40]],
    [[-34, 40], [-34, -2], [34, -2], [34, 40]],
    [[-42, 2], [0, -36], [42, 2]],
    [[-8, 40], [-8, 16], [8, 16], [8, 40]],
    [[18, 6], [28, 6], [28, 16], [18, 16], [18, 6]],
    [[22, -18], [22, -32], [30, -32], [30, -12]],
  ],
  walker: [
    [[-62, 36], [62, 36]],
    circ(38, -14, 13),
    circ(-18, -10, 6.5),
    [[-18, -3.5], [-17, 16]],
    [[-26, 36], [-17, 16], [-8, 36]],
    [[-27, 10], [-18, 1], [-9, 10]],
    [[-46, 30], [-38, 30]],
  ],
};

// one picture: {kind, t, x, y, dur?, end?}; (hx, hy): top of his head
export function thought(ctx, t, pic, hx, hy, i) {
  const dur = pic.dur ?? 1.9;
  const t0 = pic.t;
  const tEnd = pic.end ?? t0 + dur;
  if (t < t0 || t > tEnd + 0.3) return null;
  const out = smooth(t, tEnd, tEnd + 0.28, ease.in);
  const burst = pic.end !== undefined && pic.end < t0 + dur;
  const a = 1 - out;
  const sd = 9200 + i * 40;
  // the trail of little bubbles from his head
  const tx = pic.x;
  const ty = pic.y + 50;
  for (let k = 0; k < 3; k++) {
    const u = 0.22 + k * 0.24;
    const pk = smooth(t, t0 + k * 0.05, t0 + k * 0.05 + 0.12, ease.outBack);
    if (pk <= 0) continue;
    const bx = lerp(hx, tx, u);
    const by = lerp(hy, ty, u) - Math.sin(Math.PI * u) * 10;
    const r = (3.4 + k * 2.2) * pk;
    ellipse(ctx, bx, by, r, r, { w: 2, fill: COL.paper, alpha: a, seed: sd + k, wobble: 0.2 });
  }
  const pop = smooth(t, t0 + 0.14, t0 + 0.4, ease.outBack);
  if (pop <= 0) return null;
  const sc = pop * (burst ? 1 + 0.25 * out : 1 - 0.18 * out);
  const cy = pic.y - 12 * out * (burst ? 0 : 1);
  const rot = (hash(i * 3.7) - 0.5) * 0.08;
  ctx.save();
  ctx.translate(pic.x, cy);
  ctx.scale(sc, sc);
  ctx.rotate(rot);
  rect(ctx, -76, -56, 152, 112, { w: 2.8, fill: COL.paper, alpha: a, seed: sd + 5, over: 4 });
  const strokes = SKETCH[pic.kind];
  const d = prog(t, t0 + 0.32, t0 + Math.min(1.15, dur - 0.5));
  // draw on stroke by stroke, by length
  const lens = strokes.map((s) => s.reduce((acc, q, n) => (n ? acc + Math.hypot(q[0] - s[n - 1][0], q[1] - s[n - 1][1]) : 0), 0));
  const total = lens.reduce((x, y) => x + y, 0);
  let acc = 0;
  strokes.forEach((s, n) => {
    const k = clamp((d * total - acc) / lens[n]);
    acc += lens[n];
    path(ctx, s, { w: 2.6, alpha: a, draw: k, seed: sd + 10 + n, wobble: 0.7 });
  });
  ctx.restore();
  // the card (for a soft light on it)
  const cs = Math.cos(rot) * sc;
  const sn = Math.sin(rot) * sc;
  const P = (u, v) => [pic.x + u * cs - v * sn, cy + u * sn + v * cs];
  return { pts: [P(-76, -56), P(76, -56), P(76, 56), P(-76, 56)], k: a * clamp(pop) };
}

// ------------------------------------------------------------ the window
const WN = R.win;
const WX0 = WN.x;
const WX1 = WN.x + WN.w;
const WY0 = WN.y;
const WY1 = WN.y + WN.h;
// the light through the window, slope m (dx per dy of the rays): the lit
// slab from the glass down to the floor
export function beamPoly(m) {
  const F = R.floor;
  const fx = (x, y) => x + (F - y) * m;
  if (m >= 0) return [[WX0, WY0], [WX1, WY0], [fx(WX1, WY0), F], [fx(WX0, WY1), F], [WX0, WY1]];
  return [[WX0, WY0], [WX1, WY0], [WX1, WY1], [fx(WX1, WY1), F], [fx(WX0, WY0), F]];
}
function beamFoot(m) {
  const F = R.floor;
  const a = m >= 0 ? WX0 + (F - WY1) * m : WX0 + (F - WY0) * m;
  const b = m >= 0 ? WX1 + (F - WY0) * m : WX1 + (F - WY1) * m;
  return [a, b];
}
// the beam in bands, brighter near the glass and the floor
function beamLights(m, k, kFloor) {
  const out = [];
  if (k <= 0.001 && kFloor <= 0.001) return out;
  const poly = beamPoly(m);
  out.push({ type: 'poly', pts: poly, k });
  const [a, b] = beamFoot(m);
  out.push({ type: 'pool', x: (a + b) / 2, y: R.floor + 10, rx: (b - a) / 2 + 30, ry: 26, k: kFloor });
  return out;
}

// what is outside: by day a cloud going by; at night the moon
function windowView(ctx, t, D, moonK) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(WX0, WY0, WN.w, WN.h);
  ctx.clip();
  if (D > 0.02) {
    const cx = WX0 + 40 + (t - 80) * 9;
    cloud(ctx, cx, WY0 + 84, 0.62, { w: 2.4, alpha: 0.7 * D, seedStroke: 9301 });
  }
  if (moonK > 0.02) moon(ctx, WX0 + WN.w * 0.72, WY0 + WN.h * 0.28, 22, { alpha: moonK, w: 3 });
  ctx.restore();
}

// the crowd that passes with the bright light: black shapes against the
// glass, people walking, arms up
const CROWD = (() => {
  const out = [];
  // the near file of people, and a fainter, smaller one behind it
  let tt = 86.1;
  for (let i = 0; i < 8; i++) {
    out.push({ t: tt, s: 0.9 + 0.22 * hash(i * 5.1), y: 452 + (hash(i * 2.3) - 0.5) * 22, arms: Math.floor(hash(i * 7.7) * 3), h: hash(i * 3.9), ph: hash(i * 1.3), far: false });
    tt += 0.29 + 0.16 * hash(i * 9.1);
  }
  tt = 86.25;
  for (let i = 0; i < 7; i++) {
    out.push({ t: tt, s: 0.62 + 0.1 * hash(i * 4.3), y: 470 + (hash(i * 6.1) - 0.5) * 14, arms: Math.floor(hash(i * 2.9) * 3), h: hash(i * 8.3), ph: hash(i * 3.3), far: true });
    tt += 0.3 + 0.2 * hash(i * 7.3);
  }
  // far people first
  return out.sort((a, b) => (a.far === b.far ? 0 : a.far ? -1 : 1));
})();
// One person walking past outside, seen from the hips up: an ordinary
// silhouette (no face), arms up.
function cheerer(ctx, x, y, s, t, c) {
  const bob = Math.abs(Math.sin((t * 1.8 + c.ph) * Math.PI)) * 3 * s;
  const hy = y - bob;
  const r = (13 + c.h * 2.5) * s;
  const col = c.far ? '#3a3631' : DARK;
  const sh = hy + r + 14 * s; // shoulder line
  const sw = (21 + c.h * 4) * s;
  // shoulders round off into the arms, the body goes down past the sill
  const body = [
    [x - sw + 2 * s, sh + 150 * s], [x - sw, sh + 30 * s], [x - sw + 2 * s, sh + 10 * s], [x - sw + 8 * s, sh + 2 * s], [x - 7 * s, sh - 3 * s],
    [x + 7 * s, sh - 3 * s], [x + sw - 8 * s, sh + 2 * s], [x + sw - 2 * s, sh + 10 * s], [x + sw, sh + 30 * s], [x + sw - 2 * s, sh + 150 * s],
  ];
  fillPoly(ctx, body, col, 1);
  fillPoly(ctx, [[x - 6 * s, hy + r * 0.6], [x + 6 * s, hy + r * 0.6], [x + 7 * s, sh + 2 * s], [x - 7 * s, sh + 2 * s]], col, 1);
  fillPoly(ctx, ellipsePts(x, hy, r * 0.92, r, 0, TAU, 18), col, 1);
  const kind = Math.floor(c.h * 4);
  if (kind === 1) fillPoly(ctx, ellipsePts(x - 2 * s, hy - r * 0.92, r * 0.42, r * 0.34, 0, TAU, 10), col, 1);
  else if (kind === 2) fillPoly(ctx, [[x - r * 0.92, hy - r * 0.1], [x + r * 0.92, hy - r * 0.1], [x + r * 1.0, hy + r * 1.35], [x - r * 1.0, hy + r * 1.35]], col, 1);
  else if (kind === 3) fillPoly(ctx, [[x - r * 1.05, hy - r * 0.35], [x + r * 1.3, hy - r * 0.35], [x + r * 1.2, hy - r * 0.55], [x - r * 0.9, hy - r * 0.6]], col, 1);
  // arms up, waving (or one up, one down)
  ctx.save();
  ctx.strokeStyle = col;
  ctx.fillStyle = col;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const arm = (side, up, ph) => {
    const ax = x + side * (sw - 5 * s);
    const ay = sh + 6 * s;
    const wv = Math.sin((t * 2.6 + ph) * TAU);
    const a1 = up ? side * (0.5 + 0.12 * wv) : side * 0.1;
    const ex = ax + Math.sin(a1) * 30 * s;
    const ey = up ? ay - Math.cos(a1) * 30 * s : ay + 30 * s;
    const a2 = up ? a1 - side * (0.35 - 0.3 * wv) : a1 - side * 0.3;
    const hx2 = ex + Math.sin(a2) * 28 * s;
    const hy2 = up ? ey - Math.cos(a2) * 28 * s : ey + 26 * s;
    ctx.lineWidth = 8 * s;
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(ex, ey);
    ctx.stroke();
    ctx.lineWidth = 6.5 * s;
    ctx.beginPath();
    ctx.moveTo(ex, ey);
    ctx.lineTo(hx2, hy2);
    ctx.stroke();
    if (up) {
      ctx.beginPath();
      ctx.arc(hx2, hy2, 4.6 * s, 0, TAU);
      ctx.fill();
    }
  };
  arm(1, true, c.ph);
  arm(-1, c.arms !== 1, c.ph + 0.37);
  ctx.restore();
}

// the screen's light falling back toward his face: a soft fan from the lid
function screenFan(lp, p, k) {
  if (k <= 0.01) return [];
  const j = joints(p);
  const a = [lp.hinge[0] - 2, lp.hinge[1] + 2];
  const b = [lp.lidEnd[0] - 2, lp.lidEnd[1] - 6];
  const o = [(a[0] + b[0]) / 2 + 6, (a[1] + b[1]) / 2];
  const fx = j.head[0] - 60;
  // everything on his side of the screen's plane, fading with distance
  const ux = b[0] - a[0];
  const uy = b[1] - a[1];
  const L = Math.hypot(ux, uy);
  const A = [a[0] - (ux / L) * 200, a[1] - (uy / L) * 200];
  const B = [b[0] + (ux / L) * 200, b[1] + (uy / L) * 200];
  const r1 = o[0] - fx + 20;
  const pts = [A, B, [o[0] - r1 - 40, B[1]], [o[0] - r1 - 40, A[1]]];
  return [
    { type: 'fan', x: o[0], y: o[1], r0: 6, r1, pts, k: 0.62 * k },
    { type: 'glow', x: o[0] - 6, y: o[1], r: 46, k: 0.5 * k },
  ];
}

// stage() from light.js, plus one more kind of light (as in s03):
// { type: 'fan', x, y, r0, r1, pts, k } — a radial falloff from (x, y), k at
// r0 fading as (1-f)^1.5 to 0 at r1, clipped to the polygon pts.
let shadeX = null;
export function stageX(ctx, lights, o = {}) {
  const fans = lights.filter((L) => L.type === 'fan');
  if (!fans.length) return stage(ctx, lights, o);
  if (!shadeX) {
    shadeX = document.createElement('canvas');
    shadeX.width = W;
    shadeX.height = H;
  }
  // let stage() draw everything else into its own shade, then cut the fans
  // out of our copy of the darkness: draw the dark ourselves
  const s = shadeX.getContext('2d');
  const m = ctx.getTransform();
  s.setTransform(1, 0, 0, 1, 0, 0);
  s.globalCompositeOperation = 'source-over';
  s.globalAlpha = 1;
  s.clearRect(0, 0, W, H);
  s.fillStyle = `rgba(14,13,12,${o.dark ?? 0.66})`;
  s.fillRect(0, 0, W, H);
  s.setTransform(m);
  s.globalCompositeOperation = 'destination-out';
  for (const L of lights) {
    const k = L.k ?? 1;
    if (k <= 0.001) continue;
    if (L.type === 'fan') {
      s.beginPath();
      L.pts.forEach((q, n) => (n ? s.lineTo(q[0], q[1]) : s.moveTo(q[0], q[1])));
      s.closePath();
      const g = s.createRadialGradient(L.x, L.y, 0, L.x, L.y, L.r1);
      const u0 = L.r0 / L.r1;
      g.addColorStop(0, `rgba(0,0,0,${k})`);
      for (let i = 0; i <= 8; i++) {
        const f = i / 8;
        g.addColorStop(u0 + (1 - u0) * f, `rgba(0,0,0,${k * Math.pow(1 - f, 1.5)})`);
      }
      s.fillStyle = g;
      s.fill();
    } else if (L.type === 'spot') {
      const g = s.createLinearGradient(0, L.sy, 0, L.fy);
      g.addColorStop(0, `rgba(0,0,0,${0.25 * k})`);
      g.addColorStop(0.55, `rgba(0,0,0,${0.55 * k})`);
      g.addColorStop(1, `rgba(0,0,0,${0.92 * k})`);
      s.fillStyle = g;
      s.beginPath();
      s.moveTo(L.sx - L.rx * 0.12, L.sy);
      s.lineTo(L.sx + L.rx * 0.12, L.sy);
      s.lineTo(L.fx + L.rx * 0.98, L.fy);
      s.lineTo(L.fx - L.rx * 0.98, L.fy);
      s.closePath();
      s.fill();
      poolX(s, L.fx, L.fy, L.rx, L.ry, k);
    } else if (L.type === 'glow') {
      const g = s.createRadialGradient(L.x, L.y, 0, L.x, L.y, L.r);
      g.addColorStop(0, `rgba(0,0,0,${k})`);
      g.addColorStop(0.5, `rgba(0,0,0,${0.7 * k})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      s.fillStyle = g;
      s.fillRect(L.x - L.r, L.y - L.r, L.r * 2, L.r * 2);
    } else if (L.type === 'pool') {
      poolX(s, L.x, L.y, L.rx, L.ry, k);
    } else if (L.type === 'poly') {
      s.fillStyle = `rgba(0,0,0,${k})`;
      s.beginPath();
      L.pts.forEach((q, n) => (n ? s.lineTo(q[0], q[1]) : s.moveTo(q[0], q[1])));
      s.closePath();
      s.fill();
    }
  }
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(shadeX, 0, 0);
  ctx.restore();
  // the visible haze of the spot beams (as stage() does)
  const beams = o.beams ?? 1;
  if (beams > 0) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const L of lights) {
      const k = (L.k ?? 1) * beams;
      if (L.type !== 'spot' || k <= 0.001) continue;
      const g = ctx.createLinearGradient(0, L.sy, 0, L.fy);
      g.addColorStop(0, `rgba(255,250,235,${0.07 * k})`);
      g.addColorStop(1, `rgba(255,250,235,${0.02 * k})`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(L.sx - L.rx * 0.12, L.sy);
      ctx.lineTo(L.sx + L.rx * 0.12, L.sy);
      ctx.lineTo(L.fx + L.rx * 0.98, L.fy);
      ctx.lineTo(L.fx - L.rx * 0.98, L.fy);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }
}
function poolX(s, x, y, rx, ry, k) {
  s.save();
  s.translate(x, y);
  s.scale(1, ry / rx);
  const g = s.createRadialGradient(0, 0, 0, 0, 0, rx);
  g.addColorStop(0, `rgba(0,0,0,${k})`);
  g.addColorStop(0.75, `rgba(0,0,0,${0.9 * k})`);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  s.fillStyle = g;
  s.beginPath();
  s.arc(0, 0, rx, 0, Math.PI * 2);
  s.fill();
  s.restore();
}

// ------------------------------------------------------------ one frame
const toScreen = (cam, x, y) => [W / 2 + (x - cam.x) * cam.z, H / 2 + (y - cam.y) * cam.z];

export function roomFrame(ctx, t, T) {
  const cam = kv(t, T.cam);
  const D = kv(t, T.day);
  const moonK = clamp(1 - D / 0.3) * smooth(t, 91.6, 92.3);
  const fl = kv(t, T.flare);
  const fm = kv(t, T.flareM);
  const sp = kv(t, T.spot);
  const h = himAt(t, T);
  // the bang: a jolt of the whole frame
  let jolt = 0;
  for (const f of T.flashes) if (t > f.t && f.jolt) jolt = Math.max(jolt, f.jolt * Math.exp(-(t - f.t) / 0.09));
  ctx.save();
  if (jolt > 0.01) ctx.translate(noise1(t * 60, 1) * 14 * jolt, noise1(t * 60, 2) * 10 * jolt);
  let lp;
  let headTop;
  camera(ctx, cam, () => {
    windowView(ctx, t, D, moonK);
    const r = room(ctx, t, { open: 1, balls: 0, glow: lerp(1, 0.45, D) });
    lp = r.lp;
    const j = drawHim(ctx, h.p, { back: h.back, eye: h.eye, mouth: h.mouth });
    headTop = [j.head[0] + 4, j.head[1] - j.r * 1.5];
    const cards = T.pics.map((pic, i) => thought(ctx, t, pic, headTop[0], headTop[1], i)).filter(Boolean);

    const lights = [];
    // the little pictures read a touch lighter than the room
    for (const c of cards) lights.push({ type: 'poly', pts: c.pts, k: 0.3 * c.k });
    // daylight: the glass, the slanting sunbeam and its patch on the floor,
    // and the room lit by it
    const sunM = kv(t, T.sunM);
    lights.push({ type: 'poly', pts: [[WX0, WY0], [WX1, WY0], [WX1, WY1], [WX0, WY1]], k: clamp(0.1 + 0.85 * D + 0.1 * moonK + fl) });
    const sunW = 1 - kv(t, T.sunOff);
    lights.push(...beamLights(sunM, 0.26 * D * sunW, 0.72 * D * sunW));
    lights.push({ type: 'glow', x: (WX0 + WX1) / 2 + 120, y: 500, r: 1000, k: 0.4 * D + 0.08 * moonK });
    // the bright light going by outside
    if (fl > 0.001) {
      lights.push(...beamLights(fm, 0.5 * fl, 0.95 * fl));
      lights.push({ type: 'glow', x: (WX0 + WX1) / 2 + 100, y: 480, r: 1200, k: 0.2 * fl });
    }
    // the screen lights his face a little (more at night)
    const soft = T.soft ? kv(t, T.soft) : 0;
    lights.push(...screenFan(r.lp, h.p, r.screenLight.k * lerp(0.5, 0.15, D) * (1 - soft)));
    if (soft > 0) lights.push({ ...r.screenLight, x: r.screenLight.x - 12, y: r.screenLight.y - 6, r: 120, k: r.screenLight.k * 0.2 * soft });
    // the spotlight on him (s06)
    if (sp.k > 0.001) {
      lights.push({ type: 'spot', ...ROOM_SPOT, rx: sp.rx, ry: sp.ry, k: sp.k });
    }
    const dark = lerp(0.76, 0.66, D) - 0.1 * fl;
    stageX(ctx, lights, { dark, beams: 1 });

    // warm haze in the beams through the window, added on top
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const haze = (m, a) => {
      if (a <= 0.002) return;
      const poly = beamPoly(m);
      const g = ctx.createLinearGradient(0, WY0, 0, R.floor);
      g.addColorStop(0, `rgba(255,250,236,${a})`);
      g.addColorStop(1, `rgba(255,250,236,${a * 0.35})`);
      ctx.fillStyle = g;
      ctx.beginPath();
      poly.forEach((q, n) => (n ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])));
      ctx.closePath();
      ctx.fill();
    };
    haze(sunM, 0.06 * D * sunW);
    haze(fm, 0.16 * fl);
    if (fl > 0.001) {
      // the glass blazes; the light coming from the left, leaving to the right
      const gx = lerp(WX0 - 160, WX1 + 160, prog(t, 85.95, 89.1));
      const g = ctx.createRadialGradient(gx, 420, 0, gx, 420, 420);
      g.addColorStop(0, `rgba(255,251,240,${0.6 * fl})`);
      g.addColorStop(0.4, `rgba(255,251,240,${0.2 * fl})`);
      g.addColorStop(1, 'rgba(255,251,240,0)');
      ctx.fillStyle = g;
      ctx.fillRect(gx - 420, 0, 840, 840);
    }
    ctx.restore();
    if (fl > 0.001) {
      // the crowd going by, black against the glare; then the window bars
      ctx.save();
      ctx.beginPath();
      ctx.rect(WX0, WY0, WN.w, WN.h);
      ctx.clip();
      for (const c of CROWD) {
        const x = WX0 - 50 + (c.far ? 110 : 150) * (t - c.t);
        if (x < WX0 - 60 || x > WX1 + 60) continue;
        cheerer(ctx, x, c.y, c.s, t, c);
      }
      ctx.restore();
      ctx.save();
      ctx.globalAlpha = clamp(fl * 1.4);
      rect(ctx, WX0, WY0, WN.w, WN.h, { w: 4, seed: 9401 });
      line(ctx, WX0 + WN.w / 2, WY0, WX0 + WN.w / 2, WY1, { w: 3.4, seed: 9402 });
      line(ctx, WX0, WY0 + WN.h / 2, WX1, WY0 + WN.h / 2, { w: 3.4, seed: 9403 });
      ctx.restore();
    }
  });

  // dust in the sunbeam (screen space)
  const sunM = kv(t, T.sunM);
  const dk = D * (1 - kv(t, T.sunOff));
  if (dk > 0.02) beamDust(ctx, cam, t, sunM, 0.8 * dk, 46);
  if (fl > 0.02) beamDust(ctx, cam, t + 17, fm, 0.9 * fl, 40);
  // dust in the spotlight
  if (sp.k > 0.02) {
    const a = toScreen(cam, ROOM_SPOT.sx, ROOM_SPOT.sy);
    const b = toScreen(cam, ROOM_SPOT.fx, ROOM_SPOT.fy);
    dust(ctx, { sx: a[0], sy: a[1], fx: b[0], fy: b[1], rx: sp.rx * cam.z, ds: 1.1 * cam.z }, t, 0.85 * Math.min(1, sp.k), 60);
  }
  ctx.restore();

  // the flash of a bang
  for (const f of T.flashes) {
    if (t <= f.t || t > f.t + 0.6) continue;
    const k = f.a * Math.exp(-(t - f.t) / 0.07);
    const p = toScreen(cam, ROOM_SPOT.fx + 10, R.floor - 150);
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(p[0], p[1], 0, p[0], p[1], 900);
    g.addColorStop(0, `rgba(255,250,236,${k})`);
    g.addColorStop(1, 'rgba(255,250,236,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
  return { cam, lp };
}

// specks drifting in a window beam of slope m (screen space)
function beamDust(ctx, cam, t, m, k, n) {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#fffaf0';
  for (let i = 0; i < n; i++) {
    const a = (hash(i * 3.1) + noise1(t * 0.12 + i, i) * 0.06 + 1) % 1;
    const b = hash(i * 7.3);
    const x0 = lerp(WX0 + 8, WX1 - 8, a);
    const y0 = lerp(WY0 + 8, WY1 - 8, b);
    const lmax = R.floor - y0;
    const u = (hash(i * 5.7) + t * (0.015 + hash(i * 1.9) * 0.02)) % 1;
    const l = u * lmax;
    const [sx, sy] = toScreen(cam, x0 + m * l, y0 + l + noise1(t * 0.3, i + 50) * 6);
    const tw = 0.5 + 0.5 * Math.sin(t * (1 + hash(i) * 2) + i);
    ctx.globalAlpha = k * (0.14 + 0.32 * tw) * Math.sin(Math.PI * u);
    ctx.beginPath();
    ctx.arc(sx, sy, (0.8 + hash(i * 5) * 1.5) * cam.z, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

// ------------------------------------------------------------ motion smear
// While the camera whips, the frame is drawn once into a buffer and laid
// down several times along the camera's motion.
let BUF = null;
export function smeared(ctx, t, T, render) {
  const whip = (T.whips ?? []).some(([a, b]) => t > a && t < b);
  if (!whip) return render(ctx);
  const dt = 1 / 60;
  const a = kv(t - dt, T.cam);
  const b = kv(t + dt, T.cam);
  const sh = 1 / 30;
  // screen motion of a point at the frame centre
  const vx = (-(b.x - a.x) * b.z) / (2 * dt);
  const vy = (-(b.y - a.y) * b.z) / (2 * dt);
  const len = Math.hypot(vx, vy) * sh;
  if (len < 10) return render(ctx);
  if (!BUF) {
    BUF = document.createElement('canvas');
    BUF.width = W;
    BUF.height = H;
  }
  const g = BUF.getContext('2d');
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalAlpha = 1;
  g.globalCompositeOperation = 'source-over';
  paper(g);
  const res = render(g);
  const n = Math.min(14, Math.max(3, Math.ceil(len / 6)));
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  for (let i = 0; i < n; i++) {
    const u = n === 1 ? 0 : i / (n - 1) - 0.5;
    ctx.globalAlpha = 1 / (i + 1);
    ctx.drawImage(BUF, Math.round(vx * sh * u), Math.round(vy * sh * u));
  }
  ctx.restore();
  return res;
}

export const roomTake = (ctx, t, T) => smeared(ctx, t, T, (c) => roomFrame(c, t, T));

// ================================================================== draw
export default {
  fadeOut: 0,
  draw(ctx, lt) {
    const t = T0 + clamp(lt, 0, 16.6);
    if (t < XF[1]) shotA(ctx, t);
    if (t >= XF[0]) {
      const a = smooth(t, XF[0], XF[1], ease.sine);
      if (a >= 1) roomTake(ctx, t, TAKE5);
      else {
        withLayer(ctx, (l) => {
          paper(l);
          roomTake(l, t, TAKE5);
        }, { alpha: a });
      }
    }
  },
};
