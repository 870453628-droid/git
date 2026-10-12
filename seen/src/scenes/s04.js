// s04 · 54–76 · 时空隧道 — the time tunnel
// Black (s03 shut the lid). The door cracks: a line of light, then a slab
// that falls across the floor to him. He lifts his head, stands, walks to it;
// the camera follows him into the doorway and on into the white.
// Out of the white: a side tracking shot, him dazed, head down, walking
// right, and time rushing behind him — the sun and the moon whip over, days
// strobe, a tree leafs, drops its leaves, snows, blossoms. Night settles, and
// the lights come on: people, each walking inside a bright light of their
// own that travels with them from above. 身边走过的人，都比我亮: he slows,
// lifts his head, stops. Someone's light passes just behind him; he reaches
// for it — it slides on with its owner. 我也想那样亮，可我做不到: he falls in
// behind someone, hurries, his toe at the rim of their light — it keeps
// ahead; he stops. The stream thickens, quickens; lights sweep over him; he
// stands in the middle, the frame tilting a little as we push in. Then time
// stops: everyone and every light halts mid-stride. 那就不追了: he closes his
// eyes, puts a hand on his chest. The frozen people and their lights go out
// one by one into a soft grey, and he stands there alone (s05 opens on this).
import { W, H, COL, TAU, clamp, lerp, prog, smooth, keys, ease, hash, rng, noise1, camera, path, line, rect, circle, ellipse, ellipsePts, fillPoly, dot, hatch } from '../lib.js';
import { figure, pose, joints, walk, walkPhase, reach, SIT, SIT_LIFT, LEG } from '../figure.js';
import { stage } from '../light.js';
import { dust } from '../theatre.js';
import { ROOM, room } from '../room.js';
import { sun } from '../sets.js';

const T0 = 54;

// ================================================================== gait
// A walk whose stance foot stays planted while the cadence and the stride
// change (starts, stops, a hurry). cadence: steps/s; amt: stride 0..1.
const stanceRel = (ph, sw, legB) => LEG * Math.sin((legB ? -sw : sw) * Math.sin(ph * TAU));
function makeGait(t0, t1, cadence, amtAt) {
  const DT = 1 / 300;
  const n = Math.ceil((t1 - t0) / DT) + 2;
  const PH = new Float64Array(n);
  const U = new Float64Array(n);
  const M = new Float64Array(n);
  let ph = 0;
  let u = 0;
  let m = 0;
  for (let i = 0; i < n; i++) {
    PH[i] = ph;
    U[i] = u;
    M[i] = m;
    const t = t0 + (i + 0.5) * DT;
    const sw = 0.42 * amtAt(t);
    const dph = (cadence(t) / 2) * DT;
    const legB = Math.cos(TAU * (ph + dph / 2)) > 0;
    const sw0 = 0.42 * amtAt(t0 + i * DT);
    const sw1 = 0.42 * amtAt(t0 + (i + 1) * DT);
    u -= stanceRel(ph + dph, sw1, legB) - stanceRel(ph, sw0, legB);
    m += 4 * LEG * Math.sin(sw) * dph;
    ph += dph;
  }
  return (t) => {
    const x = clamp((t - t0) / DT, 0, n - 1.001);
    const i = Math.floor(x);
    const f = x - i;
    return { ph: lerp(PH[i], PH[i + 1], f), u: lerp(U[i], U[i + 1], f), m: lerp(M[i], M[i + 1], f), amt: t < t0 ? 0 : amtAt(t) };
  };
}

// ================================================================== the room
const RS = ROOM.s;
const TOP = ROOM.floor - 150 * RS;
const SEAT_Y = ROOM.floor - 92 * RS;
const HIP_SIT = [ROOM.stoolX + 4, SEAT_Y - SIT_LIFT * RS];
const STAND_X = 1000;
const BALLS = 29; // the heap as s03 leaves it
const DR = ROOM.door;
const DOOR = [54.42, 55.2]; // the door swings open
const LOOKUP = [54.72, 55.1];
const STAND = [55.18, 55.74];
const WALK_R = 55.74;
const CUT_D = 56.42; // cut: the doorway
const WHITE = [56.86, 57.36]; // into the white
const TUN0 = 57.36; // the tunnel

const gR = makeGait(WALK_R, 57.6, (t) => keys(t, [[WALK_R, 1.6], [WALK_R + 0.5, 2.3]]), (t) => keys(t, [[WALK_R, 0], [WALK_R + 0.4, 0.72]]));
const walkGround = (x) => ROOM.floor + 18 - 18 * smooth(x, 1380, 1580);
const roomWalkX = (t) => STAND_X + RS * gR(t).u;
// after the cut he is further on, nearly at the door
const DOOR_X0 = 1452;
const doorWalkX = (t) => DOOR_X0 + RS * (gR(t).u - gR(CUT_D).u);

function walkerPose(g, x, ground, s, o = {}) {
  const w = walk(g.ph, ground, s, g.amt);
  const a = Math.sin(g.ph * TAU);
  const k = clamp(g.amt / 0.6);
  const swing = (o.swing ?? 0.16) * k;
  return pose({
    ...w,
    x, s, f: 1,
    lean: w.lean + (o.lean ?? 0.1),
    head: o.head ?? 0.36,
    look: o.look ?? 0.8,
    turn: o.turn ?? 0,
    aA1: -0.03 - swing * a, aA2: 0.12,
    aB1: -0.03 + swing * a, aB2: 0.12,
  });
}

// in the dark: a hand on the shut laptop; the door opens; he lifts his
// head to the light; stands
function sitPose(t, lidEnd) {
  const up = smooth(t, LOOKUP[0], LOOKUP[1]);
  const p = pose({ ...SIT, x: HIP_SIT[0], y: HIP_SIT[1], s: RS, f: 1, lean: lerp(0.2, 0.1, up), head: lerp(0.32, -0.08, up), look: lerp(0.7, -0.1, up) });
  const hA = reach(p, 'A', lidEnd[0] + 30, lidEnd[1] - 2);
  const hB = reach(p, 'B', 1000, TOP - 4);
  p.aA1 = hA.a1;
  p.aA2 = hA.a2;
  p.aB1 = hB.a1;
  p.aB2 = hB.a2;
  const st = prog(t, STAND[0], STAND[1]);
  if (st <= 0) return p;
  const sitFoot = (a1, a2) => [p.x + Math.sin(a1) * 58 * RS + Math.sin(a1 + a2) * 56 * RS, p.y + Math.cos(a1) * 58 * RS + Math.cos(a1 + a2) * 56 * RS];
  const fA0 = sitFoot(SIT.lA1, SIT.lA2);
  const fB0 = sitFoot(SIT.lB1, SIT.lB2);
  const gy = walkGround(STAND_X);
  const k1 = ease.inOut(clamp(st / 0.4));
  const k2 = ease.inOut(clamp((st - 0.25) / 0.75));
  p.x = lerp(HIP_SIT[0], STAND_X, k2);
  p.y = lerp(HIP_SIT[1], gy - LEG * RS, k2);
  p.lean = 0.1 + 0.34 * Math.sin(Math.PI * clamp(st / 0.85)) * (1 - k2 * 0.4);
  p.lean = lerp(p.lean, 0.16, k2 * k2);
  p.head = lerp(p.head, 0.2, k2);
  p.look = lerp(p.look, 0.4, k2);
  const fA = [lerp(fA0[0], STAND_X + 1, k1), lerp(fA0[1], gy, k1)];
  const fB = [lerp(fB0[0], STAND_X - 1, k1), lerp(fB0[1], gy, k1)];
  const lA = reach(p, 'A', fA[0], fA[1], 'leg');
  const lB = reach(p, 'B', fB[0], fB[1], 'leg');
  p.lA1 = lA.a1;
  p.lA2 = lA.a2;
  p.lB1 = lB.a1;
  p.lB2 = lB.a2;
  const ka = smooth(st, 0.1, 0.8);
  p.aA1 = lerp(p.aA1, -0.03, ka);
  p.aA2 = lerp(p.aA2, 0.12, ka);
  p.aB1 = lerp(p.aB1, -0.03, ka);
  p.aB2 = lerp(p.aB2, 0.12, ka);
  return p;
}

// the free edge of the open door panel (he passes behind it)
const doorEdge = (op) => DR.x + DR.w - DR.w * (1 - clamp(op) * 0.82);

function doorLights(r, door) {
  const lights = [];
  if (!r.doorLight) return lights;
  lights.push({ type: 'poly', pts: r.doorLight.slice(0, 3).concat([r.doorLight[5]]), k: 1 });
  // the wedge on the floor, fading with distance in thin bands
  const [, , p2, p3, p4, p5] = r.doorLight;
  const at = (u) => [[lerp(p2[0], p3[0], u), lerp(p2[1], p3[1], u)], [lerp(p5[0], p4[0], u), lerp(p5[1], p4[1], u)]];
  for (let i = 0; i < 16; i++) {
    const [a3, a4] = at(i / 16);
    const [b3, b4] = at((i + 1) / 16);
    lights.push({ type: 'poly', pts: [a3, b3, b4, a4], k: Math.pow(1 - (i + 0.5) / 16, 1.3) });
  }
  lights.push({ type: 'glow', x: DR.x + 60, y: ROOM.floor - 120, r: 1300, k: 0.26 * door });
  return lights;
}

function roomShot(ctx, t) {
  const door = smooth(t, DOOR[0], DOOR[1], ease.inOut);
  const k = smooth(t, 55.5, CUT_D + 0.1, ease.in);
  const cam = { x: lerp(1270, 1330, k), y: lerp(585, 600, k), z: lerp(1.16, 1.24, k) };
  camera(ctx, cam, () => {
    const r = room(ctx, t, { open: 0, door, moon: true, balls: BALLS });
    const p = t < WALK_R ? sitPose(t, r.lp.lidEnd) : walkerPose(gR(t), roomWalkX(t), walkGround(roomWalkX(t)), RS, { lean: 0.06, head: 0.22, look: 0.4 });
    figure(ctx, p, { id: 1, cowlick: true });
    const lights = doorLights(r, door);
    // the moon in the window, just
    const wn = ROOM.win;
    lights.push({ type: 'poly', pts: [[wn.x, wn.y], [wn.x + wn.w, wn.y], [wn.x + wn.w, wn.y + wn.h], [wn.x, wn.y + wn.h]], k: 0.1 * door });
    stage(ctx, lights, { dark: lerp(1, 0.9, smooth(t, DOOR[0], DOOR[0] + 0.3)), beams: 0 });
  });
  // the first crack of the door: a hairline of light
  if (t > DOOR[0] && t < DOOR[0] + 0.25) {
    const f = 1 - prog(t, DOOR[0], DOOR[0] + 0.25);
    const [x, y0] = toScreen(cam, DR.x + 3, ROOM.floor - DR.h);
    const [, y1] = toScreen(cam, DR.x + 3, ROOM.floor);
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = `rgba(255,250,236,${0.5 * f})`;
    ctx.fillRect(x - 2, y0, 4, y1 - y0);
    ctx.restore();
  }
}

// the doorway: he walks into the light, the camera goes with him, into white
function doorShot(ctx, t) {
  const k = smooth(t, CUT_D, WHITE[1], (u) => u * u * (3 - 2 * u));
  const z = lerp(1.7, 3.4, Math.pow(k, 1.5));
  const cam = { x: lerp(1560, 1650, k), y: lerp(600, 610, k), z };
  camera(ctx, cam, () => {
    const r = room(ctx, t, { open: 0, door: 1, moon: true, balls: BALLS });
    const x = doorWalkX(t);
    const p = walkerPose(gR(t), x, walkGround(x), RS, { lean: 0.08, head: 0.18, look: 0.3 });
    ctx.save();
    ctx.beginPath();
    ctx.rect(-4000, -4000, doorEdge(1) - 1 + 4000, 9000);
    ctx.clip();
    figure(ctx, p, { id: 1, cowlick: true, w: 4.6 * RS * 1.5 });
    ctx.restore();
    stage(ctx, doorLights(r, 1), { dark: 0.9, beams: 0 });
  });
  const wk = smooth(t, WHITE[0], WHITE[1], ease.in);
  if (wk > 0) {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = `rgba(250,247,240,${wk})`;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
}

const toScreen = (cam, x, y) => {
  let dx = (x - cam.x) * cam.z;
  let dy = (y - cam.y) * cam.z;
  if (cam.r) {
    const c = Math.cos(cam.r);
    const s = Math.sin(cam.r);
    [dx, dy] = [dx * c - dy * s, dx * s + dy * c];
  }
  return [W / 2 + dx, H / 2 + dy];
};

// ================================================================== the tunnel
const G = 760; // his ground
const HS = 1.0; // his scale
// lanes of passers-by: farther ones higher and smaller; 'f' is the one he
// follows, a step in front of his own line
const LANES = [
  { g: 652, s: 0.64, a: 0.62 },
  { g: 703, s: 0.8, a: 0.8 },
  { g: 774, s: 1.02, a: 1 },
  { g: 834, s: 1.14, a: 1 },
  { g: 952, s: 1.46, a: 1 },
];

// his walk: dazed; slows and stops (60.3); after someone (62.85–65.75)
const gT = makeGait(TUN0 - 0.6, 76.6,
  (t) => keys(t, [[56.7, 1.85], [59.5, 1.85], [60.3, 1.2], [63.0, 1.2], [63.35, 2.3], [63.85, 2.6], [64.6, 2.8], [65.1, 2.4], [65.85, 1.4]], ease.linear),
  (t) => keys(t, [[56.7, 0.6], [59.4, 0.6], [60.3, 0], [63.0, 0], [63.35, 0.74], [63.85, 0.84], [64.6, 0.9], [65.1, 0.7], [65.85, 0]]));
const hisX = (t) => HS * gT(t).u;
const X_STOP = hisX(61);
// his smooth progress (no step-to-step surge), lined up with his hip at the stop
const hisM = (t) => HS * gT(t).m + (X_STOP - HS * gT(61).m);
const X_END = hisX(70);

// flow time: the stream's clock — ordinary until 66, faster and faster,
// then it stops (72.9)
const FLOW = (() => {
  const t0 = 56;
  const DT = 1 / 240;
  const n = Math.ceil((78 - t0) / DT) + 2;
  const tau = new Float64Array(n);
  let s = 0;
  for (let i = 0; i < n; i++) {
    tau[i] = s;
    const t = t0 + (i + 0.5) * DT;
    s += flowSpeed(t) * DT;
  }
  return { t0, DT, n, tau };
})();
function flowSpeed(t) {
  return keys(t, [[56, 1], [66.2, 1], [69.6, 2.1], [71.5, 2.25], [72.9, 0]]);
}
function tau(t) {
  const x = clamp((t - FLOW.t0) / FLOW.DT, 0, FLOW.n - 1.001);
  const i = Math.floor(x);
  return lerp(FLOW.tau[i], FLOW.tau[i + 1], x - i);
}
const FROZEN = 72.9;

// ------------------------------------------------------------ camera
function tunCam(t) {
  const g = gT(t);
  const z = keys(t, [[TUN0, 0.97], [59.4, 0.94], [61.0, 1.32], [62.6, 1.38], [64.4, 1.26], [65.9, 1.08], [66.9, 0.84], [72.3, 1.0], [77, 1.0]]);
  const sx = keys(t, [[TUN0, 900], [62.8, 880], [65.8, 900], [66.9, 930], [72.3, 830], [77, 830]]);
  const follow = lerp(HS * g.m + M_OFF, X_END, smooth(t, 65.6, 67.2));
  const r = 0.032 * Math.sin(Math.PI * smooth(t, 66.9, 72.3, ease.inOut));
  const feet = keys(t, [[59.4, 800], [61.0, 772], [64.4, 772], [65.9, 790], [66.9, 800]]);
  return { x: follow + (W / 2 - sx) / z, y: G - (feet - H / 2) / z, z, r };
}
// (mean progress m runs a little behind the hip; line them up at the stop)
const M_OFF = hisX(61) - HS * gT(61).m;

// world x range visible at time t (with margin)
function viewX(t, margin = 0) {
  const c = tunCam(t);
  const half = (W / 2) / c.z + 120;
  return [c.x - half - margin, c.x + half + margin];
}

// ------------------------------------------------------------ people
// x(t) = xr + dir v (tau(t) - tau(tr)). Before 59.6 people appear in place,
// one by one, as night falls (their light pops on); after that they walk in
// from the edges. He has his own figure; these are plain, faceless.
const FOLLOW = { pass: 62.95, v: 200 };
// their pace after passing him (px/s): brisk, a touch slower around 64.3
// (where he gets closest: his toe at the rim of their light), then away
const folV = (t) => keys(t, [[62.95, 220], [63.35, 275], [64.0, 255], [64.6, 268], [65.4, 272], [66.0, 262]]);
const FOL_X = (() => {
  const DT = 1 / 240;
  const n = Math.ceil((66.2 - FOLLOW.pass) / DT) + 2;
  const xs = new Float64Array(n);
  let x = 0;
  for (let i = 0; i < n; i++) {
    xs[i] = x;
    x += folV(FOLLOW.pass + (i + 0.5) * DT) * DT;
  }
  return { DT, n, xs };
})();
function followX(t) {
  if (t <= FOLLOW.pass) return X_STOP + FOLLOW.v * (t - FOLLOW.pass);
  if (t <= 66.0) {
    const x = clamp((t - FOLLOW.pass) / FOL_X.DT, 0, FOL_X.n - 1.001);
    const i = Math.floor(x);
    return X_STOP + lerp(FOL_X.xs[i], FOL_X.xs[i + 1], x - i);
  }
  return followX(66.0) + 262 * (tau(t) - tau(66));
}
const PEOPLE = buildPeople();
PEOPLE.forEach((c) => {
  c.x0 = px(c, 56);
});

function px(c, t) {
  if (c.xf) return c.xf(t);
  return c.xr + c.dir * c.v * (tau(t) - c.tr);
}

function buildPeople() {
  const r = rng(5406);
  const out = [];
  let id = 300;
  // the one whose light he reaches for: behind him (lane 1), overtaking
  out.push({ lane: 1, dir: 1, v: 128, xr: X_STOP + 40, tr: tau(61.35), ta: 58.52, id: id++, ph: 0.3, sz: 1.04, key: 'reach' });
  // the one he follows: a step in front of his line, overtaking him
  out.push({ lane: 2, dir: 1, v: 230, xf: followX, id: id++, ph: 0.1, sz: 1.0, ta: 59.25, key: 'follow' });
  // in the rush: people in the near lanes who cross right in front of him,
  // closer and closer together, their lights sweeping over him
  [[67.35, 3, 1], [68.25, 3, -1], [68.95, 4, 1], [69.55, 3, -1], [70.1, 3, 1], [70.6, 3, -1], [71.05, 3, 1], [71.45, 3, -1]].forEach(([tc, lane, dir], i) => {
    const v = (150 + 30 * hash(i * 3.3)) * (0.75 + 0.25 * LANES[lane].s);
    const c = { lane, dir, v, xr: X_END + (hash(i * 5.1) - 0.5) * 30, tr: tau(tc), enter: true, id: id++, ph: hash(i * 7.7), sz: 0.95 + 0.1 * hash(i), tail: i % 3 === 1, sweep: true };
    // they walk in from outside the frame
    let ta = tc;
    for (; ta > 60; ta -= 0.05) {
      const [v0, v1] = viewX(ta, 170 * LANES[lane].s);
      const x = px(c, ta);
      if (x < v0 || x > v1) break;
    }
    c.ta = ta;
    out.push(c);
  });
  // the people already there when the night falls
  const want = 8;
  const n0 = out.length;
  for (let n = 0; n < 400 && out.length < n0 + want; n++) {
    const lane = [0, 0, 1, 1, 3][Math.floor(r() * 5)];
    const dir = r() < 0.5 ? -1 : 1;
    const v = (105 + 70 * r()) * (0.75 + 0.25 * LANES[lane].s);
    const ta = 58.45 + r() * 1.0;
    const [v0, v1] = viewX(ta, -80);
    const xa = lerp(v0, v1, r());
    const c = { lane, dir, v, xr: xa, tr: tau(ta), ta, id: id++, ph: r(), sz: 0.94 + 0.12 * r(), tail: r() < 0.25 };
    if (!ok(c, out)) continue;
    out.push(c);
  }
  // then they come in from the edges, faster and thicker
  let t = 59.2;
  while (t < 71.7) {
    const rate = keys(t, [[59, 0.45], [61, 0.5], [65.6, 0.55], [66.6, 1.6], [69.6, 3.3], [71.7, 3.5]], ease.linear);
    t += (0.55 + 0.9 * r()) / rate;
    if (t >= 71.7) break;
    let lane = [0, 0, 1, 1, 1, 3, 3][Math.floor(r() * 7)];
    if (t > 66.7 && t < 71.2 && r() < 0.14) lane = 4;
    const dir = r() < 0.5 ? -1 : 1;
    const v = (115 + 75 * r()) * (0.75 + 0.25 * LANES[lane].s);
    const [v0, v1] = viewX(t, 160 * LANES[lane].s);
    const xe = dir > 0 ? v0 : v1;
    const c = { lane, dir, v, xr: xe, tr: tau(t), ta: t, enter: true, id: id++, ph: r(), sz: 0.94 + 0.12 * r(), tail: r() < 0.25 };
    if (!ok(c, out)) continue;
    out.push(c);
  }
  // the order they go out in, once time has stopped: far from him first
  const vis = out.filter((c) => {
    const x = px(c, FROZEN);
    const [a, b] = viewX(FROZEN, 200);
    return x > a && x < b;
  });
  vis.sort((a, b) => Math.abs(px(b, FROZEN) - X_END) * (0.7 + 0.6 * hash(b.id)) - Math.abs(px(a, FROZEN) - X_END) * (0.7 + 0.6 * hash(a.id)));
  vis.forEach((c, i) => {
    c.out = 73.3 + 1.65 * (i / Math.max(1, vis.length - 1));
  });
  return out;
}

// keep the beats clear: nobody in front of him while he reaches and
// follows, nobody near the light he reaches for, nobody frozen over him;
// nobody walking in lockstep with someone else
function ok(c, list) {
  const L = c.lane;
  if (c.sweep) return true;
  for (let t = Math.max(c.ta, 58.6); t <= 73; t += 0.1) {
    const x = px(c, t);
    const hx = hisX(t);
    if ((L === 3 || L === 4) && t > 60.4 && t < 66.2 && Math.abs(x - hx) < 120) return false;
    if (L === 1 && t > 60.6 && t < 62.8) {
      const rx = px(list[0], t);
      if (Math.abs(x - rx) < 190) return false;
    }
    if ((L === 1 || L === 0) && t > 60.6 && t < 62.6 && Math.abs(x - hx) < 140) return false;
  }
  if (Math.abs(px(c, FROZEN) - X_END) < (L >= 3 ? 170 : 100)) return false;
  // the nearest lane's lights sit low in the frame: gone before the subtitle
  if (L === 4) {
    const [a, b] = viewX(72.5, 140);
    const x = px(c, 72.5);
    if (x > a && x < b) return false;
  }
  for (const o of list) {
    if (o.lane !== L || o.xf) continue;
    let near = 0;
    for (let t = 59; t <= 72.5; t += 0.5) if (Math.abs(px(o, t) - px(c, t)) < 70 && t > Math.max(o.ta, c.ta)) near++;
    if (near > 2) return false;
  }
  return true;
}

// how much a person is there: popping in with their light, going out after
// time stops
function presence(c, t) {
  const inK = c.enter ? 1 : smooth(t, c.ta, c.ta + 0.12);
  const outK = c.out ? 1 - smooth(t, c.out, c.out + 0.45) : t > 74 ? 0 : 1;
  return Math.min(inK, outK);
}

function personPose(c, t) {
  const L = LANES[c.lane];
  const s = L.s * c.sz;
  const x = px(c, t);
  const d = Math.abs(x - c.x0);
  const w = walk(walkPhase(d, s) + c.ph, L.g + (hash(c.id) - 0.5) * 8, s, 0.86);
  return pose({ ...w, x, s, f: c.dir, head: 0.02 + 0.04 * hash(c.id * 3), tail: c.tail ? 0.2 * Math.sin(walkPhase(d, s) * TAU * 2) : 0 });
}

// a paper-coloured knockout under a figure, so overlaps stay legible
function knock(ctx, p, w, k = 1) {
  figure(ctx, p, { id: 99, color: COL.paper, headFill: COL.paper, w: w * 3, eye: 'none', alpha: 0.9 * k, wobble: 0, noTie: true });
}

function drawPerson(ctx, c, t, frozen) {
  const k = presence(c, t);
  if (k <= 0.01) return null;
  const p = personPose(c, t);
  const L = LANES[c.lane];
  const w = Math.max(2, 4.4 * Math.pow(p.s, 0.85));
  // motion smear when the stream races
  const sp = flowSpeed(t);
  if (sp > 1.35 && !frozen) {
    const q = personPose(c, t - 0.06 * sp);
    figure(ctx, q, { id: c.id, w, eye: 'none', alpha: L.a * k * 0.3 * clamp((sp - 1.35) * 1.4), noTie: true, wobble: 0 });
  }
  if (c.lane >= 2) knock(ctx, p, w, k);
  figure(ctx, p, { id: c.id, w, eye: 'none', alpha: L.a * k, ponytail: c.tail, noTie: true, still: frozen });
  return { p, k, c };
}

// a person's own light: a spot from straight above that walks with them
function personLight(d) {
  const { p, k, c } = d;
  const L = LANES[c.lane];
  const s = L.s;
  const g = L.g + 4;
  const lean = (hash(c.id * 7) - 0.5) * 70;
  return [
    { type: 'spot', sx: p.x + lean, sy: -520, fx: p.x, fy: g, rx: 68 * s, ry: 15 * s, k: 0.9 * k },
    { type: 'glow', x: p.x, y: g - 135 * s, r: 112 * s, k: 0.5 * k },
  ];
}

// ------------------------------------------------------------ him
function himPose(t) {
  const g = gT(t);
  const x = hisX(t);
  const head = keys(t, [[56, 0.36], [59.3, 0.36], [60.25, 0.02], [61.25, -0.06], [61.9, -0.14], [62.6, 0.0], [63.4, -0.05], [64.4, -0.12], [65.4, 0.1], [66.2, 0.22], [69.2, 0.16], [71.6, 0.1], [72.5, -0.04], [73.1, 0.1], [76, 0.13]]);
  const look = keys(t, [[56, 0.8], [59.3, 0.8], [60.25, 0.1], [61.25, -0.2], [61.9, -0.35], [62.6, 0.1], [63.4, 0], [64.4, -0.1], [65.4, 0.5], [66.2, 0.55], [71.6, 0.3], [72.5, 0.05], [73.1, 0.3]]);
  const lean = keys(t, [[56, 0.1], [59.3, 0.1], [60.3, 0.0], [61.3, 0.0], [61.85, 0.1], [62.3, 0.07], [62.9, 0.0], [64.2, 0.08], [65.5, 0.0], [66.2, 0.03], [72.4, 0.0], [73.6, 0.03]]);
  // he follows the people passing in front with his face, now and then
  const turn = keys(t, [[60.2, 0], [60.6, 0.3], [61.0, 0.05], [66.4, 0], [67.2, 0.42], [68.0, 0.1], [69.0, 0.5], [69.8, 0.15], [70.6, 0.4], [71.4, 0.05], [72.4, 0]]);
  const p = walkerPose(g, x, G, HS, { lean, head, look, turn, swing: keys(t, [[56, 0.14], [62.95, 0.14], [63.6, 0.36], [65.3, 0.36]]) });
  const j = joints(p);
  // reaching for the light that passes just behind him
  const rch = smooth(t, 61.4, 61.88) * (1 - smooth(t, 62.3, 62.85));
  if (rch > 0) {
    const tgt = [x + 100, j.shoulder[1] - 115];
    const r = reach(p, 'A', tgt[0], tgt[1]);
    p.aA1 = lerp(p.aA1, r.a1, rch);
    p.aA2 = lerp(p.aA2, r.a2, rch);
  }
  // following: a hand goes out toward the rim of their light
  const fr = smooth(t, 63.95, 64.35) * (1 - smooth(t, 64.6, 65.05));
  if (fr > 0) {
    const r = reach(p, 'A', x + 98, j.shoulder[1] + 26);
    p.aA1 = lerp(p.aA1, r.a1, fr);
    p.aA2 = lerp(p.aA2, r.a2, fr);
  }
  // time stops: a hand to his chest
  const ch = smooth(t, 73.0, 73.9, ease.inOut);
  if (ch > 0) {
    const r = reach(p, 'A', j.shoulder[0] + 9 * HS, j.shoulder[1] + 34 * HS);
    p.aA1 = lerp(p.aA1, r.a1, ch);
    p.aA2 = lerp(p.aA2, r.a2, ch);
  }
  const mouth = keys(t, [[56, -0.3], [60.4, -0.2], [61.5, 0.15], [62.6, -0.3], [63.5, 0.1], [64.4, 0.2], [65.4, -0.45], [66.2, -0.4], [72.5, -0.3], [73.6, 0]]);
  const eye = t > 72.85 ? 'closed' : 'dot';
  return { p, mouth, eye };
}

// ------------------------------------------------------------ time lapse
const DAY0 = 0.12; // a morning, out of the white door
function rate(t) {
  return 1.6 * smooth(t, TUN0, TUN0 + 0.25) * (1 - smooth(t, 58.25, 59.05, ease.out));
}
const DAYS = (() => {
  const DT = 1 / 300;
  const n = Math.ceil((60 - TUN0) / DT) + 2;
  const d = new Float64Array(n);
  let s = 0;
  for (let i = 0; i < n; i++) {
    d[i] = s;
    s += rate(TUN0 + (i + 0.5) * DT) * DT;
  }
  const raw = d[n - 1];
  // land on deep night (phase .74)
  const nd = Math.max(1, Math.round(raw - 0.62));
  const scale = (nd + 0.62) / raw;
  return { DT, n, d, scale };
})();
function dayPhase(t) {
  const x = clamp((t - TUN0) / DAYS.DT, 0, DAYS.n - 1.001);
  const i = Math.floor(x);
  return DAY0 + lerp(DAYS.d[i], DAYS.d[i + 1], x - i) * DAYS.scale;
}
// 1 = noon light .. 0 = night
function daylight(t) {
  const f = ((dayPhase(t) % 1) + 1) % 1;
  return clamp(0.5 + 1.7 * Math.sin(TAU * f));
}

// the tree, through the seasons
const TREE_X = 420;
const TREE_G = 650;
const TS = 1.45;
const TP = (u, v) => [TREE_X + u * TS, TREE_G - v * TS];
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
const CANOPY = { x: TREE_X, y: TREE_G - 236 * TS, rx: 150 * TS, ry: 96 * TS };
const CANOPY_PTS = (() => {
  const pts = [];
  const n = 13;
  for (let i = 0; i < n; i++) {
    const am = ((i + 0.5) / n) * TAU - Math.PI / 2;
    const bx = CANOPY.x + Math.cos(am) * CANOPY.rx * 0.9;
    const by = CANOPY.y + Math.sin(am) * CANOPY.ry * 0.9;
    const rr = (34 + 8 * Math.sin(i * 2.3)) * TS;
    pts.push(...ellipsePts(bx, by, rr, rr * 0.86, am - 1.25, am + 1.25, 7));
  }
  return pts;
})();
const SEASON = { leaf0: 57.42, leaf1: 57.82, fall: 57.92, winter: 58.28, spring: 58.66, out0: 59.9, out1: 60.8 };

function drawTree(ctx, t) {
  const a = 1 - smooth(t, SEASON.out0, SEASON.out1);
  if (a <= 0.01) return;
  path(ctx, TRUNK, { w: 7, alpha: a, seed: 1500 });
  BRANCHES.forEach((b, i) => path(ctx, b, { w: i < 3 ? 4.6 : 3, alpha: a, seed: 1510 + i }));
  // leaves grow, then go
  const crown = smooth(t, SEASON.leaf0, SEASON.leaf1) * (1 - smooth(t, SEASON.fall, SEASON.winter - 0.05));
  if (crown > 0.01) {
    const cs = 0.55 + 0.45 * crown;
    const pts = CANOPY_PTS.map(([x, y]) => [CANOPY.x + (x - CANOPY.x) * cs, CANOPY.y + (y - CANOPY.y) * cs + (1 - cs) * 60]);
    fillPoly(ctx, pts, COL.paper, 0.92 * crown * a);
    hatch(ctx, pts, { alpha: 0.12 * crown * a, gap: 15, seed: 1530 });
    path(ctx, pts, { w: 3.6, alpha: crown * a, close: true, seed: 1540, dash: crown < 0.98 ? [lerp(4, 40, crown), lerp(16, 2, crown)] : undefined });
  }
  // falling leaves
  for (let i = 0; i < 26; i++) {
    const t0 = SEASON.fall - 0.05 + hash(i * 3.3) * 0.25;
    const k = (t - t0) * 1.8;
    if (k < 0 || k > 1.0) continue;
    const sx = CANOPY.x + (hash(i * 1.7) - 0.5) * CANOPY.rx * 1.7;
    const sy = CANOPY.y + (hash(i * 2.9) - 0.5) * CANOPY.ry * 1.2;
    const x = sx - 190 * k - 34 * Math.sin(k * 7 + i);
    const y = Math.min(TREE_G - 5, sy + 420 * k * k + 90 * k);
    leaf(ctx, x, y, k * 9 + i, a * (1 - smooth(k, 0.7, 1.0)), 1600 + i);
  }
  // snow on the branches
  const snow = smooth(t, SEASON.winter, SEASON.winter + 0.12) * (1 - smooth(t, SEASON.spring, SEASON.spring + 0.18));
  if (snow > 0.01) {
    BRANCHES.forEach((b, i) => path(ctx, b.map(([x, y]) => [x, y - 8]), { w: 2.4, alpha: 0.7 * snow * a, seed: 1650 + i, wobble: 0.8 }));
    path(ctx, [[TREE_X - 330, TREE_G - 6], [TREE_X - 120, TREE_G - 13], [TREE_X + 90, TREE_G - 11], [TREE_X + 340, TREE_G - 6]], { w: 2.4, alpha: 0.65 * snow * a, seed: 1660 });
  }
  // blossoms
  const bloom = smooth(t, SEASON.spring, SEASON.spring + 0.2);
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
// snowflakes in the winter beat (world space, around the tree and him)
function snowfall(ctx, t, cam) {
  const k = smooth(t, SEASON.winter - 0.05, SEASON.winter + 0.1) * (1 - smooth(t, SEASON.spring - 0.02, SEASON.spring + 0.25));
  if (k <= 0.01) return;
  ctx.save();
  ctx.strokeStyle = COL.ink;
  ctx.lineCap = 'round';
  ctx.lineWidth = 2.2;
  ctx.globalAlpha *= 0.6 * k;
  ctx.beginPath();
  const x0 = cam.x - 1100;
  for (let i = 0; i < 70; i++) {
    const fall = (t - SEASON.winter + 0.2) * (160 + 80 * hash(i * 3.1));
    const x = x0 + hash(i * 1.37) * 2300 - fall * 0.35;
    const y = ((hash(i * 2.71) * 900 + fall) % 880) - 40;
    const r = 4.5 + 3.5 * hash(i * 4.4);
    for (let q = 0; q < 3; q++) {
      const an = (q / 3) * Math.PI + i + t * 2;
      ctx.moveTo(x - Math.cos(an) * r, y - Math.sin(an) * r);
      ctx.lineTo(x + Math.cos(an) * r, y + Math.sin(an) * r);
    }
  }
  ctx.stroke();
  ctx.restore();
}

// the ground: far ridge, horizon, and faint pencil lines across the floor
// (the lights pick them out)
function ground(ctx, t, x0, x1, a) {
  if (a <= 0.01) return;
  const t0 = Math.floor(x0 / 400);
  const t1 = Math.ceil(x1 / 400);
  for (let i = t0; i < t1; i++) {
    const xa = i * 400;
    const xb = xa + 400;
    const sd = 8300 + (i & 255) * 8;
    path(ctx, [[xa - 2, 600], [xb + 2, 600]], { w: 1.8, color: COL.inkSoft, alpha: a, seed: sd, wobble: 0.5 });
    path(ctx, [[xa - 2, G + 2], [xb + 2, G + 2]], { w: 3, alpha: a * 0.8, seed: sd + 1, wobble: 0.6 });
    for (const [y, q] of [[640, 0.5], [690, 0.6], [726, 0.6], [800, 0.7], [870, 0.7]]) {
      const dx = (hash(i * 3.1 + y) - 0.5) * 160;
      path(ctx, [[xa + 60 + dx, y], [xa + 260 + dx, y + 1]], { w: 1.6, color: COL.pencil, alpha: a * q, seed: sd + 2 + (y % 7), wobble: 0.4 });
    }
    // a pole far off, now and then
    if ((i & 1) === 0) {
      const ppx = xa + 120 + hash(i * 5.3) * 160;
      path(ctx, [[ppx, 602], [ppx, 532]], { w: 2, color: COL.inkSoft, alpha: a, seed: sd + 5, wobble: 0.3 });
      path(ctx, [[ppx - 12, 540], [ppx + 12, 540]], { w: 1.6, color: COL.inkSoft, alpha: a, seed: sd + 6, wobble: 0.3 });
    }
  }
}

// the sky (screen space): the sun by day, drawn in ink
function skyInk(ctx, t) {
  if (t > 59.6) return;
  const ph = dayPhase(t);
  const f = ((ph % 1) + 1) % 1;
  if (f < 0.5) {
    const u = f / 0.5;
    const x = lerp(-120, W + 120, u);
    const y = 470 - Math.sin(Math.PI * u) * 360;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    sun(ctx, x, y, 34, { spin: ph * 3, w: 3.4, fill: COL.paper });
    ctx.restore();
  }
}
// ... and the moon and the stars at night, drawn in light after stage()
function skyLight(ctx, t, nightK) {
  if (nightK <= 0.01) return;
  const ph = dayPhase(t);
  const f = ((ph % 1) + 1) % 1;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const fast = rate(t);
  // stars: dots that streak while the days race
  ctx.strokeStyle = '#efe7d6';
  ctx.lineCap = 'round';
  for (let i = 0; i < 46; i++) {
    const x = hash(i * 7.7) * W;
    const y = 30 + hash(i * 3.9) * 380;
    const tw = 0.5 + 0.5 * Math.sin(t * (1.3 + hash(i) * 2) + i * 2.1);
    ctx.globalAlpha = nightK * (0.25 + 0.4 * tw) * (1 - smooth(t, 72.6, 74.5));
    const len = 1.5 + fast * 6 * (0.6 + hash(i * 5.1));
    ctx.lineWidth = 1.2 + hash(i * 2.3) * 1.6;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - len, y + len * 0.12);
    ctx.stroke();
  }
  if (f >= 0.5) {
    const u = (f - 0.5) / 0.5;
    const x = lerp(-120, W + 120, u);
    const y = 470 - Math.sin(Math.PI * u) * 360;
    const r = 26;
    const pts = [...ellipsePts(x, y, r, r, -1.9, 1.9, 18), ...ellipsePts(x + r * 0.45, y, r * 0.82, r * 0.82, 1.62, -1.62, 16)];
    ctx.globalAlpha = nightK * (1 - smooth(t, 72.8, 74.8)) * 0.92;
    ctx.shadowColor = 'rgba(255,248,230,0.6)';
    ctx.shadowBlur = 24;
    fillPoly(ctx, pts, '#f1eadb', 1);
  }
  ctx.restore();
}

// ------------------------------------------------------------ the tunnel shot
function tunnelShot(ctx, t) {
  const cam = tunCam(t);
  const frozen = t >= FROZEN;
  const day = t < 60 ? daylight(t) : 0;
  const [vx0, vx1] = viewX(t, 0);
  skyInk(ctx, t);
  const drawn = [];
  let himJ = null;
  camera(ctx, cam, () => {
    // the world fades to nowhere at the end
    const worldA = 1 - smooth(t, 73.4, 75.6);
    ground(ctx, t, vx0, vx1, worldA);
    drawTree(ctx, t);
    snowfall(ctx, t, cam);
    const order = [0, 1];
    for (const lane of order) for (const c of PEOPLE) if (c.lane === lane) pushDrawn(ctx, c, t, frozen, vx0, vx1, drawn);
    // him, then the one he follows (a step in front), then the near lanes
    const h = himPose(t);
    knock(ctx, h.p, 4.6, 1);
    himJ = figure(ctx, h.p, { id: 1, cowlick: true, mouth: h.mouth, eye: h.eye });
    for (const lane of [2, 3, 4]) for (const c of PEOPLE) if (c.lane === lane) pushDrawn(ctx, c, t, frozen, vx0, vx1, drawn);

    const lights = drawn.flatMap(personLight);
    const dark = keys(t, [[56, 0.81], [73.5, 0.81], [75.6, 0.47]]) * lerp(1, 0.2, day);
    stage(ctx, lights, { dark, beams: 0.55 });
  });
  // the lit people shine a little
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'lighter';
  for (const d of drawn) {
    const [sx, sy] = toScreen(cam, d.p.x, d.p.y - 40 * d.p.s);
    const r = 135 * d.p.s * cam.z;
    const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, r);
    g.addColorStop(0, `rgba(255,250,236,${0.13 * d.k})`);
    g.addColorStop(1, 'rgba(255,250,236,0)');
    ctx.fillStyle = g;
    ctx.fillRect(sx - r, sy - r, 2 * r, 2 * r);
  }
  ctx.restore();
  skyLight(ctx, t, t < 60 ? 1 - daylight(t) : 1);
  // dust in the beams, hanging still once time has stopped
  const td = 60 + tau(t) * 0.6;
  const dk = smooth(t, 71.6, 72.6);
  for (const d of dk > 0.01 ? drawn : []) {
    const L = personLight(d)[0];
    const a = toScreen(cam, L.sx, L.sy);
    const b = toScreen(cam, L.fx, L.fy);
    dust(ctx, { sx: a[0], sy: a[1], fx: b[0], fy: b[1], rx: L.rx * cam.z, ds: 1.2 * d.p.s }, td + d.c.id * 3.7, 0.8 * d.k * dk, 14);
  }
  // the lights pop on as night falls: a small flash with each
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'lighter';
  for (const d of drawn) {
    if (d.c.enter || t < d.c.ta || t > d.c.ta + 0.3) continue;
    const f = Math.exp(-(t - d.c.ta) / 0.07);
    const [sx, sy] = toScreen(cam, d.p.x, LANES[d.c.lane].g - 120 * d.p.s);
    const r = 300 * d.p.s;
    const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, r);
    g.addColorStop(0, `rgba(255,250,236,${0.28 * f})`);
    g.addColorStop(1, 'rgba(255,250,236,0)');
    ctx.fillStyle = g;
    ctx.fillRect(sx - r, sy - r, 2 * r, 2 * r);
  }
  ctx.restore();
  // out of the white door
  const wk = 1 - smooth(t, TUN0, TUN0 + 0.55, ease.out);
  if (wk > 0) {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = `rgba(250,247,240,${wk})`;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
}

function pushDrawn(ctx, c, t, frozen, vx0, vx1, drawn) {
  if (t < c.ta) return;
  const x = px(c, t);
  const m = 260 * LANES[c.lane].s;
  if (x < vx0 - m || x > vx1 + m) return;
  const d = drawPerson(ctx, c, t, frozen);
  if (d) drawn.push(d);
}

// ================================================================== draw
export default {
  draw(ctx, lt) {
    const t = T0 + clamp(lt, -0.6, 22.6);
    if (t < CUT_D) roomShot(ctx, t);
    else if (t < TUN0) doorShot(ctx, t);
    else tunnelShot(ctx, t);
  },
};

// How this scene leaves him (s05 opens on it): alone in a soft grey made by
// stage(ctx, [], { dark: 0.47 }) over plain paper (no ground line, no
// lights), side view facing right, scale 1, feet at y 800, hip at x 830,
// eyes closed, mouth 0, his near hand (arm A) on his chest.
// S04_END.pose() gives the exact screen-space pose for figure(ctx, pose,
// { id: 1, cowlick: true, eye: 'closed', mouth: 0 }).
export const S04_END = {
  x: 830,
  feet: 800,
  s: HS,
  dark: 0.47,
  pose() {
    const h = himPose(76.3);
    const c = tunCam(76.3);
    const p = { ...h.p };
    const dx = W / 2 - c.x * c.z;
    const dy = H / 2 - c.y * c.z;
    p.x = p.x * c.z + dx;
    p.y = p.y * c.z + dy;
    p.s *= c.z;
    return p;
  },
};
