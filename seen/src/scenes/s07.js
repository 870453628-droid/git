// s07 · 108–124 · 升华
// His room by day. He stops working, stands up and heads for the door —
// CUT: the door opens in the back wall of the theatre of the opening. The
// stage is dark, every seat is empty, only a ghost light burns. He comes out
// from behind, walks down the light of his own doorway to the worn circle
// where he stood as a child, faces the empty hall, looks up to where the
// light used to come from, and smiles. The camera pushes in from the back
// row (s01's pull-back, reversed). Then the back wall flies out: open land
// and a wide sky — the dark lifts from the whole frame. He turns and walks
// into it. Behind him the old spotlight BANGs on over the empty floor; he
// stops half a step, looks back, smiles — and walks on. The camera lets him
// go; fade to black.
import { W, H, clamp, lerp, prog, smooth, keys, ease, noise1, path, ellipse, ellipsePts, fillPoly, camera } from '../lib.js';
import { figure, pose, reach, joints, walk, standY, SIT, SIT_LIFT, LEG, BODY } from '../figure.js';
import { stage } from '../light.js';
import { TH, F as FOC, stageCam, project, stagePlane, auditorium, dust, hallDark, haze, ROWS } from '../theatre.js';
import { SPOT, spotOnScreen, stageWash } from './s01.js';
import { ROOM, ROOM_SPOT, room } from '../room.js';
import { cloud, bird, moon, ridgePts } from '../sets.js';

const T_CUT = 1.9; // his room → the theatre
const T_BANG = 12.5; // 120.5: the spotlight, behind him
// s01's spotlight, hung off to the side this time so its beam cuts across
// the frame onto the empty mark and never touches him
const SPOT7 = { ...SPOT, sx: TH.cx - 640, sy: -460 };
const HIM = { id: 1, cowlick: true };

// ---------------------------------------------------------------- his room
// s06 leaves him at night at the table, ROOM_SPOT on him at 0.72, the camera
// easing in to {996, 516, 1.2} at 108.6 (its take). The room here repeats
// that frame so the dissolve is seamless, then he gets up.
const RS = ROOM.s;
const R_TOP = ROOM.floor - 150 * RS;
const R_SEAT = ROOM.floor - 92 * RS;
const R_KX = ROOM.hingeX - 88 * RS;
const WN = ROOM.win;

function roomCam(t) {
  // s06's last camera move (film time 106.4 → 108.6, sine), then it leans
  // after him toward the door
  const T = 108 + t;
  const k0 = ease.sine(prog(T, 106.4, 108.6));
  const c0 = { x: lerp(1004, 996, k0), y: lerp(505, 516, k0), z: lerp(1.12, 1.2, k0) };
  const k = smooth(t, 0.9, T_CUT + 0.35, ease.in);
  return { x: lerp(c0.x, 1190, k), y: lerp(c0.y, 540, k), z: lerp(c0.z, 1.3, k) };
}

function himRoom(ctx, t) {
  const T = 108 + t;
  const s = RS;
  const floor = ROOM.floor;
  const sx = ROOM.stoolX + 4;
  const sy = R_SEAT - SIT_LIFT * s;
  // the hands stop; he sits up and lifts his eyes from the screen to the door
  const settle = smooth(t, 0.25, 0.75);
  const mouth = lerp(0.35, 0.45, smooth(t, 0.6, 1.4));
  const sit = pose({ ...SIT, x: sx, y: sy, s, f: 1, lean: lerp(0.13, 0.02, settle), head: lerp(0.1, -0.1, settle), look: lerp(0.45, -0.25, settle) });
  const ty = 1 - smooth(t, -0.05, 0.25);
  const wander = noise1(T * 0.9, 7) * 7;
  const A = [R_KX + 6 + wander + noise1(T * 2.1, 3) * 3 * ty, R_TOP - 8 * s + (Math.sin(T * 19) * 2.6 + Math.sin(T * 7.3) * 1.1) * ty - 4 * settle];
  const B = [R_KX + 22 + wander + noise1(T * 1.7, 5) * 3 * ty, R_TOP - 8 * s + Math.sin(T * 23 + 1) * 2.6 * ty - 4 * settle];
  const ra = reach(sit, 'A', A[0], A[1]);
  const rb = reach(sit, 'B', B[0], B[1]);
  sit.aA1 = ra.a1;
  sit.aA2 = ra.a2;
  sit.aB1 = rb.a1;
  sit.aB2 = rb.a2;
  const eye = T > 107.7 && T < 107.8 ? 'closed' : 'dot';
  const T0 = 0.75;
  const T1 = 1.42;
  if (t < T0) return figure(ctx, sit, { ...HIM, mouth, eye });

  const sj = joints(sit);
  const xStand = sx + 40;
  if (t < T1) {
    // up off the stool: lean in, feet to the floor, rise
    const k = prog(t, T0, T1);
    const p = pose({
      ...sit,
      x: keys(k, [[0, sx], [0.5, sx + 24], [1, xStand]]),
      y: keys(k, [[0, sy], [0.45, sy + 5], [1, standY(floor, s)]]),
      lean: keys(k, [[0, 0.02], [0.45, 0.42], [1, 0.05]]),
      head: lerp(-0.1, -0.04, k),
      look: lerp(-0.25, -0.15, k),
    });
    const kf = smooth(k, 0, 0.4);
    const fA = [lerp(sj.footA[0], xStand + 10, kf), lerp(sj.footA[1], floor, kf)];
    const fB = [lerp(sj.footB[0], xStand - 8, kf), lerp(sj.footB[1], floor, kf)];
    const la = reach(p, 'A', fA[0], fA[1], 'leg');
    const lb = reach(p, 'B', fB[0], fB[1], 'leg');
    p.lA1 = la.a1;
    p.lA2 = la.a2;
    p.lB1 = lb.a1;
    p.lB2 = lb.a2;
    const ka = smooth(k, 0.05, 0.6);
    p.aA1 = lerp(ra.a1, 0.12, ka);
    p.aA2 = lerp(ra.a2, 0.15, ka);
    p.aB1 = lerp(rb.a1, -0.1, ka);
    p.aB2 = lerp(rb.a2, 0.18, ka);
    return figure(ctx, p, { ...HIM, mouth });
  }
  // he walks for the door
  const u = t - T1;
  const r = 0.3;
  const v = 180 * s * 1.05;
  const dist = u < r ? (v * u * u) / (2 * r) : v * (u - r / 2);
  const amt = ease.out(clamp(u / r));
  const w = walk(dist / (180 * s), floor, s, amt);
  const p = pose({ ...w, x: xStand + dist, s, f: 1, head: -0.04, look: -0.15 });
  return figure(ctx, p, { ...HIM, mouth });
}

function roomShot(ctx, t) {
  const cam = roomCam(t);
  const sp = 0.72;
  camera(ctx, cam, () => {
    // the night window, as s05/s06 leave it
    ctx.save();
    ctx.beginPath();
    ctx.rect(WN.x, WN.y, WN.w, WN.h);
    ctx.clip();
    moon(ctx, WN.x + WN.w * 0.72, WN.y + WN.h * 0.28, 22, { w: 3 });
    ctx.restore();
    const r = room(ctx, t, { open: 1, balls: 0, glow: 1 });
    himRoom(ctx, t);
    const lights = [
      { type: 'poly', pts: [[WN.x, WN.y], [WN.x + WN.w, WN.y], [WN.x + WN.w, WN.y + WN.h], [WN.x, WN.y + WN.h]], k: 0.2 },
      { type: 'glow', x: WN.x + WN.w / 2 + 160, y: 520, r: 1050, k: 0.1 },
      { ...r.screenLight, x: r.screenLight.x - 12, y: r.screenLight.y - 6, r: 120, k: r.screenLight.k * 0.2 },
      { type: 'spot', ...ROOM_SPOT, k: sp },
    ];
    stage(ctx, lights, { dark: 0.76, beams: 1 });
  });
  // dust in the spotlight (as s06)
  const T = 108 + t;
  const a = [W / 2 + (ROOM_SPOT.sx - cam.x) * cam.z, H / 2 + (ROOM_SPOT.sy - cam.y) * cam.z];
  const b = [W / 2 + (ROOM_SPOT.fx - cam.x) * cam.z, H / 2 + (ROOM_SPOT.fy - cam.y) * cam.z];
  dust(ctx, { sx: a[0], sy: a[1], fx: b[0], fy: b[1], rx: ROOM_SPOT.rx * cam.z, ds: 1.1 * cam.z }, T, 0.85 * sp, 60);
}

// ------------------------------------------------------------- the theatre
// Depth on the stage: D = 0 at the front edge (where he stood as a child),
// D_B at the back curtain; beyond it the land runs to its horizon LH.
// s = 700 / (700 + D) everywhere (one perspective); the stage floor is raked
// toward the hall, so it climbs the frame faster than the land does.
const VPY = 330; // the floor boards' vanishing point (theatre.js)
const D0 = 700;
const D_B = D0 * (1 / 0.7 - 1);
const LH = 400;
const BACK_Y = VPY + (TH.floor - VPY) * 0.7;
const sAt = (D) => D0 / (D0 + D);
const yAt = (D) => (D <= D_B ? VPY + (TH.floor - VPY) * sAt(D) : LH + (BACK_Y - LH) * (sAt(D) / 0.7));
const xAt = (X, D) => TH.cx + (X - TH.cx) * sAt(D);

const DOOR = { X: 1310, w: 150, h: 340 }; // his door, in the back curtain (world units)
const GHOST = { X: 790, D: 70, h: 200 }; // the ghost light on its stand

// the camera: from the back of the hall in (s01's pull-back, reversed) —
// already moving at the cut, as the room's camera was — then a long still
// hold; at the end it draws back and lets him go
const FAR = { x: TH.cx, y: 372, C: 3000 };
const NEAR = { x: TH.cx, y: 548, C: 840 };
function theatreCam(t) {
  const u = prog(t, T_CUT, 9.4);
  const k = 1 - Math.pow(1 - u, 2.2);
  let C = FAR.C * Math.pow(NEAR.C / FAR.C, k);
  const ky = clamp((C - NEAR.C) / (FAR.C - NEAR.C));
  let y = lerp(NEAR.y, FAR.y, Math.pow(ky, 0.6));
  C *= 1 - 0.04 * smooth(t, 9.4, 13.6, ease.sine);
  const kb = smooth(t, 13.6, 16.4, ease.sine);
  C = lerp(C, 1350, kb);
  y = lerp(y, 470, kb);
  return { x: TH.cx, y, C };
}

// the back curtain: a crack of daylight under it, then it flies out
const backOpen = (t) => keys(t, [[8.0, 0], [8.6, 0.03], [10.9, 1]], ease.inOut);
// his door: shut (light under it), swings open, swings shut behind him
const doorOpen = (t) => keys(t, [[2.25, 0], [2.85, 1], [5.4, 1], [6.8, 0]], ease.inOut);

function doorGeom(yOff) {
  const s = 0.7;
  const cx = xAt(DOOR.X, D_B);
  const bot = BACK_Y + yOff;
  return { x0: cx - (DOOR.w * s) / 2, x1: cx + (DOOR.w * s) / 2, top: bot - DOOR.h * s, bot };
}

// the free edge of the door as it swings away into his room (hinge at x1)
function doorEdge(g, op) {
  const a = op * 1.3;
  const fe = g.x1 - (g.x1 - g.x0) * Math.cos(a);
  const dz = Math.sin(a) * (g.bot - g.top) * 0.05;
  return { fe, dz };
}

function drawDoor(ctx, op, yOff) {
  const g = doorGeom(yOff);
  ctx.save();
  ctx.beginPath();
  ctx.rect(TH.pr.x0, TH.pr.top + 60, TH.pr.x1 - TH.pr.x0, TH.back + 2 - TH.pr.top - 60);
  ctx.clip();
  // the opening: his room's daylight, a window in the far wall
  const { fe, dz } = doorEdge(g, op);
  if (op > 0.005) {
    fillPoly(ctx, [[g.x0, g.top], [fe, g.top], [fe, g.bot], [g.x0, g.bot]], '#f3eee3', 1);
    ctx.save();
    ctx.beginPath();
    ctx.rect(g.x0, g.top, fe - g.x0, g.bot - g.top);
    ctx.clip();
    path(ctx, [[g.x0 - 4, g.bot - 34], [g.x1 + 4, g.bot - 34]], { w: 1.6, alpha: 0.55, seed: 17010, wobble: 0.3 });
    const wx = g.x0 + 16;
    const wy = g.top + 46;
    path(ctx, [[wx, wy], [wx + 40, wy], [wx + 40, wy + 44], [wx, wy + 44]], { w: 1.6, alpha: 0.5, close: true, seed: 17011, wobble: 0.3 });
    path(ctx, [[wx + 20, wy], [wx + 20, wy + 44]], { w: 1.2, alpha: 0.45, seed: 17012, wobble: 0.2 });
    path(ctx, [[wx, wy + 22], [wx + 40, wy + 22]], { w: 1.2, alpha: 0.45, seed: 17013, wobble: 0.2 });
    ctx.restore();
  }
  // the panel, swinging away from us (its dark side toward the hall)
  fillPoly(ctx, [[fe, g.top + dz], [g.x1, g.top], [g.x1, g.bot], [fe, g.bot - dz * 0.4]], '#2c2926', 1);
  if (op < 0.05) path(ctx, [[g.x0 + 12, g.top + 128], [g.x0 + 18, g.top + 128]], { w: 3, color: '#5d564d', seed: 17014, wobble: 0 });
  // the frame
  path(ctx, [[g.x0 - 3, g.bot], [g.x0 - 3, g.top - 3], [g.x1 + 3, g.top - 3], [g.x1 + 3, g.bot]], { w: 2.6, color: '#57514a', seed: 17015, wobble: 0.3 });
  ctx.restore();
  return g;
}

function ghostLight(ctx) {
  const s = sAt(GHOST.D);
  const x = xAt(GHOST.X, GHOST.D);
  const y = yAt(GHOST.D);
  const top = y - GHOST.h * s;
  const o = { w: Math.max(1.5, 2.6 * s), color: '#2a2724', wobble: 0.3 };
  path(ctx, [[x - 26 * s, y + 3 * s], [x, y - 34 * s], [x + 24 * s, y + 2 * s]], { ...o, seed: 17300 });
  path(ctx, [[x, y - 34 * s], [x + 6 * s, y + 7 * s]], { ...o, seed: 17301 });
  path(ctx, [[x, y - 34 * s], [x, top]], { ...o, w: 3 * s, seed: 17302 });
  const by = top - 13 * s;
  ellipse(ctx, x, by, 8 * s, 10 * s, { w: 1.5 * s, fill: '#f7f2e6', color: '#3a3632', seed: 17303, wobble: 0.15 });
  for (let i = 0; i < 3; i++) {
    const rx = (13 - i * 5.5) * s;
    path(ctx, ellipsePts(x, by, rx, 15 * s, -Math.PI, 0, 10), { w: 1.2 * s, color: '#3a3632', seed: 17304 + i, wobble: 0.1 });
  }
  path(ctx, [[x - 13 * s, by + 2 * s], [x + 13 * s, by + 2 * s]], { w: 1.2 * s, color: '#3a3632', seed: 17308, wobble: 0.1 });
  return { bulb: [x, by], foot: [x, y], s };
}

// open land and a wide sky, in daylight (stage-plane coordinates)
function beyond(ctx, t) {
  const x0 = 250;
  const x1 = 1670;
  const top = 30;
  const bot = BACK_Y + 4;
  const g = ctx.createLinearGradient(0, top, 0, LH);
  g.addColorStop(0, '#e6e0d4');
  g.addColorStop(1, '#f7f3eb');
  ctx.fillStyle = g;
  ctx.fillRect(x0, top, x1 - x0, LH - top);
  const cl = { w: 2, alpha: 0.42, fill: '#f1ece2' };
  cloud(ctx, 610 + t * 5, 210, 1.0, { ...cl, seedStroke: 17100 });
  cloud(ctx, 1330 + t * 3.5, 170, 0.75, { ...cl, seedStroke: 17101, seed: 2 });
  cloud(ctx, 980 + t * 2, 300, 0.45, { ...cl, alpha: 0.3, seedStroke: 17102, seed: 4 });
  for (let i = 0; i < 3; i++) {
    const bx = 1180 + i * 34 + t * 9 + Math.sin(i * 2.1) * 12;
    bird(ctx, bx, 250 + i * 13 + Math.sin(t * 0.9 + i) * 4, 0.42 - i * 0.05, t * 1.2 + i * 0.37, { alpha: 0.6, w: 1.6, seed: 17110 + i * 2 });
  }
  // far hills, the horizon
  const ridge = ridgePts(23, x0, x1, LH, 20, { freq: 1 / 230, sharp: 1.5, step: 20 });
  fillPoly(ctx, [...ridge, [x1, LH + 1], [x0, LH + 1]], '#ece7dd', 1);
  path(ctx, ridge, { w: 1.6, alpha: 0.42, seed: 17120, wobble: 0.5 });
  // the land
  const lg = ctx.createLinearGradient(0, LH, 0, bot);
  lg.addColorStop(0, '#ebe5da');
  lg.addColorStop(1, '#ddd6c8');
  ctx.fillStyle = lg;
  ctx.fillRect(x0, LH, x1 - x0, bot - LH);
  path(ctx, [[x0, LH], [x1, LH]], { w: 1.8, alpha: 0.55, seed: 17121, wobble: 0.4 });
  // furrows, closer together toward the horizon
  for (let i = 0; i < 9; i++) {
    const D = D_B + 60 * Math.pow(1.55, i);
    const y = yAt(D);
    const half = 620 * sAt(D);
    const off = (i % 2 ? 1 : -1) * 120 * sAt(D);
    path(ctx, [[TH.cx - half * 1.6 + off, y], [TH.cx - half * 0.45 + off, y]], { w: 1.2, alpha: 0.28, seed: 17130 + i, wobble: 0.4 });
    path(ctx, [[TH.cx + half * 0.5 - off, y + 1], [TH.cx + half * 1.7 - off, y + 1]], { w: 1.2, alpha: 0.28, seed: 17140 + i, wobble: 0.4 });
  }
  // the path he will take, running to the horizon
  const pw = 85;
  path(ctx, [[xAt(TH.cx - pw, D_B), BACK_Y + 2], [TH.cx - 1.5, LH + 1]], { w: 2, alpha: 0.6, seed: 17150, wobble: 0.5 });
  path(ctx, [[xAt(TH.cx + pw, D_B), BACK_Y + 2], [TH.cx + 1.5, LH + 1]], { w: 2, alpha: 0.6, seed: 17151, wobble: 0.5 });
  // grass at the edges of the path
  for (let i = 0; i < 10; i++) {
    const D = D_B + 30 + i * 70 + (i % 3) * 13;
    const sd = sAt(D);
    const side = i % 2 ? 1 : -1;
    const x = xAt(TH.cx + side * (pw + 40 + (i % 4) * 60), D);
    const y = yAt(D);
    const h = 14 * sd;
    path(ctx, [[x - 6 * sd, y - h * 0.7], [x - 2 * sd, y], [x + 1 * sd, y - h], [x + 4 * sd, y], [x + 9 * sd, y - h * 0.6]], { w: 1.3, alpha: 0.4, seed: 17160 + i, wobble: 0.2 });
  }
}

// ----------------------------------------------------------- him, on stage
const STRIDE = 180; // world units per walk cycle (two steps)

// feet planted along a walk (distance d along the path), so they never slide
function feetAlong(d, amt) {
  const ph = d / STRIDE;
  const m = Math.floor(ph);
  const fr = ph - m;
  let dA;
  let lA = 0;
  if (fr < 0.5) dA = STRIDE * m + STRIDE / 4;
  else {
    const u = (fr - 0.5) / 0.5;
    dA = STRIDE * m + STRIDE / 4 + STRIDE * ease.sine(u);
    lA = Math.sin(Math.PI * u);
  }
  let dB;
  let lB = 0;
  if (fr >= 0.5) dB = STRIDE * m + (3 * STRIDE) / 4;
  else {
    const u = fr / 0.5;
    dB = STRIDE * (m - 1) + (3 * STRIDE) / 4 + STRIDE * ease.sine(u);
    lB = Math.sin(Math.PI * u);
  }
  return [
    { d: d + (dA - d) * amt, lift: lA * amt },
    { d: d + (dB - d) * amt, lift: lB * amt },
  ];
}

// trapezoid speed profile: distance 0..1 for progress u, ramps of length a
function trapez(u, a) {
  const vm = 1 / (1 - a);
  if (u <= 0) return 0;
  if (u >= 1) return 1;
  if (u < a) return (0.5 * vm * u * u) / a;
  if (u > 1 - a) return 1 - (0.5 * vm * (1 - u) * (1 - u)) / a;
  return 0.5 * vm * a + vm * (u - a);
}
const trapAmt = (u, a) => (u <= 0 || u >= 1 ? 0 : Math.min(1, u / a, (1 - u) / a));

// his walk away into the land: speed follows amt; integrate (deterministic)
const T_AWAY = 10.0;
function awayAmt(t) {
  if (t < T_AWAY) return 0;
  const up = smooth(t, T_AWAY, T_AWAY + 0.4, ease.sine);
  const halt = 1 - smooth(t, T_BANG + 0.03, T_BANG + 0.33, ease.out);
  const again = smooth(t, 13.85, 14.25, ease.sine);
  return up * Math.max(halt, again);
}
function awayDist(t) {
  if (t <= T_AWAY) return 0;
  const dt = 1 / 120;
  let d = 0;
  for (let u = T_AWAY; u < t; u += dt) d += STRIDE * 1.02 * awayAmt(Math.min(t, u + dt / 2)) * Math.min(dt, t - u);
  return d;
}

// all of his acting on the stage: returns a state to draw
const P_DOOR = { X: DOOR.X - 22, D: D_B };
const P_MARK = { X: TH.cx, D: 0 };
const T_DOWN = [3.35, 6.05];
function himState(t) {
  const st = { view: 'front', X: P_DOOR.X, D: P_DOOR.D, d: 0, amt: 0, dir: null, head: 0, look: 0, turn: 0, mouth: 0, arms: null, clip: false };
  if (t < T_DOWN[0]) {
    // in the doorway, a silhouette against his room's light; lets go of the door
    const let_ = smooth(t, 2.55, 3.05);
    st.arms = { aA1: 0.14, aA2: 0.1, aB1: lerp(1.15, 0.16, let_), aB2: lerp(-0.25, 0.1, let_) };
    st.turn = keys(t, [[2.6, 0.35], [3.0, -0.15], [3.35, -0.25]]);
    st.look = 0.1;
    st.clip = true;
    return st;
  }
  if (t < T_DOWN[1]) {
    // down the light of his doorway to the old mark
    const L = Math.hypot(P_MARK.X - P_DOOR.X, (P_MARK.D - P_DOOR.D) * 0.85);
    const u = prog(t, T_DOWN[0], T_DOWN[1]);
    const k = trapez(u, 0.2);
    st.X = lerp(P_DOOR.X, P_MARK.X, k);
    st.D = lerp(P_DOOR.D, P_MARK.D, k);
    st.d = k * L;
    st.amt = trapAmt(u, 0.2);
    st.dir = [P_MARK.X - P_DOOR.X, P_MARK.D - P_DOOR.D];
    st.turn = keys(t, [[3.35, -0.25], [4.2, -0.4], [5.0, 0.2], [5.8, 0]]);
    st.look = keys(t, [[3.35, 0.15], [4.6, 0.35], [5.6, 0.1]]);
    st.clip = st.D > D_B - 6;
    return st;
  }
  st.X = P_MARK.X;
  st.D = P_MARK.D;
  if (t < 8.55) {
    // on the mark, facing the empty hall: looks over the seats, up to where the light was, smiles
    st.turn = keys(t, [[6.05, 0], [6.6, -0.45], [7.0, -0.45], [7.5, 0.35], [7.75, 0.35], [8.1, 0]]);
    st.head = keys(t, [[6.05, 0], [7.85, 0], [8.2, -0.12]]) + noise1(t * 0.5, 7) * 0.02;
    st.look = keys(t, [[6.05, 0.1], [6.5, 0], [7.85, 0], [8.2, -0.7]]);
    st.mouth = keys(t, [[6.05, 0], [7.0, 0.1], [7.6, 0.9]]);
    return st;
  }
  if (t < 9.0) {
    // the light behind him: he turns his head
    st.turn = keys(t, [[8.55, 0], [8.95, 0.95]]);
    st.head = lerp(-0.12, 0.08, smooth(t, 8.55, 8.95));
    st.look = lerp(-0.7, 0.2, smooth(t, 8.55, 8.95));
    st.mouth = 0.9;
    return st;
  }
  if (t < 9.3) {
    // turning round: profile
    st.view = 'side';
    st.f = 1;
    st.turn = lerp(0.6, 0.0, smooth(t, 9.0, 9.3));
    st.head = 0.02;
    st.look = 0;
    st.mouth = 0.8;
    return st;
  }
  st.view = 'back';
  const d = awayDist(t);
  st.D = d;
  st.d = d;
  st.amt = awayAmt(t);
  st.dir = [0, 1];
  st.head = keys(t, [[9.3, 0], [9.7, -0.12], [10.2, -0.04]]);
  st.turn = keys(t, [[9.3, 0.5], [9.6, 0]]);
  if (t > 12.7 && t < 13.8) {
    // the look back over his shoulder
    if (t < 12.95) st.turn = smooth(t, 12.7, 12.95);
    else if (t < 13.55) {
      st.view = 'side';
      st.f = 1;
      st.turn = keys(t, [[12.95, 0.4], [13.15, 0.75]]);
      st.head = -0.04;
      st.look = 0.05;
      st.mouth = keys(t, [[12.95, 0.2], [13.25, 0.9]]);
    } else st.turn = 1 - smooth(t, 13.55, 13.8);
  }
  return st;
}

function drawHim(ctx, t, op) {
  if (t < 2.4 && op < 0.35) return null;
  const st = himState(t);
  const s = sAt(st.D);
  const gy = yAt(st.D);
  const x = xAt(st.X, st.D);
  if (st.clip) {
    const g = doorGeom(0);
    const { fe } = doorEdge(g, op);
    ctx.save();
    ctx.beginPath();
    ctx.rect(g.x0, g.top - 40, fe - g.x0, g.bot - g.top + 80);
    ctx.clip();
  }
  let j;
  if (st.view === 'side') {
    const p = pose({ x, y: standY(gy, s), s, f: st.f, turn: st.turn, head: st.head, look: st.look, lA1: 0.04, lB1: -0.04, aA1: 0.1, aA2: 0.1, aB1: -0.08, aB2: 0.12 });
    j = figure(ctx, p, { ...HIM, mouth: st.mouth });
  } else {
    // front / back view: the legs are drawn here, feet planted on the floor
    const ph = st.d / STRIDE;
    const sw = Math.sin(ph * Math.PI * 2) * st.amt;
    const bob = Math.pow(Math.sin(ph * Math.PI * 2), 2) * st.amt;
    const hipY = gy - (LEG - 3) * s - 2.5 * s * bob;
    const arms = st.arms ?? { aA1: 0.14 + 0.05 * sw, aA2: 0.1 + 0.12 * Math.max(0, sw), aB1: 0.14 - 0.05 * sw, aB2: 0.1 + 0.12 * Math.max(0, -sw) };
    const p = pose({ view: st.view, x, y: hipY, s, turn: st.turn, head: st.head + 0.02 * sw, look: st.look, lean: 0.012 * sw, ...arms });
    j = figure(ctx, p, { ...HIM, mouth: st.view === 'front' ? st.mouth : undefined, legs: false });
    let feet;
    if (st.dir && st.amt > 0.001) {
      const len = Math.hypot(st.dir[0], st.dir[1]);
      const ux = st.dir[0] / len;
      const uD = st.dir[1] / len;
      const P0 = { X: st.X - ux * st.d, D: st.D - uD * st.d };
      feet = feetAlong(st.d, st.amt).map((f, i) => {
        // seen end-on a step is mostly depth: keep the planted foot nearer
        // under the hip so the leg does not look stretched
        const fd = st.d + (f.d - st.d) * 0.6;
        const X = P0.X + ux * fd + (i ? 8 : -8);
        const D = P0.D + uD * fd;
        return [xAt(X, D) + (i ? 1 : -1) * 0, yAt(D) - f.lift * 16 * sAt(D)];
      });
    } else {
      feet = [[x - 8 * s, gy], [x + 8 * s, gy]];
    }
    legs(ctx, j, s, feet);
  }
  if (st.clip) ctx.restore();
  return { j, s, x, gy };
}

// legs for the front / back views, hip to a planted foot (knee by IK)
function legs(ctx, j, s, feet) {
  const w = Math.max(2, 4.6 * Math.pow(s, 0.85));
  const L1 = BODY.ul * s;
  const L2 = BODY.ll * s;
  [j.hipL, j.hipR].forEach((h, i) => {
    const f = feet[i];
    const dx = f[0] - h[0];
    const dy = f[1] - h[1];
    const d = Math.max(1e-3, Math.hypot(dx, dy));
    const ux = dx / d;
    const uy = dy / d;
    let knee;
    if (d >= L1 + L2 - 0.5) knee = [h[0] + ux * d * 0.51, h[1] + uy * d * 0.51];
    else {
      const a = (L1 * L1 - L2 * L2 + d * d) / (2 * d);
      const hh = Math.sqrt(Math.max(0, L1 * L1 - a * a));
      const out = i ? 1 : -1;
      knee = [h[0] + ux * a + out * hh * 0.3, h[1] + uy * a];
    }
    path(ctx, [h, knee, f], { w, seed: 41 + (i ? 4 : 1), wobble: 1.1 });
  });
  path(ctx, [j.hipL, j.hipR], { w, seed: 41 + 6, wobble: 0.4 });
}

// The empty seats, seen from behind: rounded seat backs in rows, batched
// per row. Returns the rim strokes (the top edges that catch the stage
// light) for after stage().
const SEAT_FILL = '#181614';
function seatRows(ctx, cam) {
  const rimRows = [];
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = SEAT_FILL;
  for (const row of ROWS) {
    const d = row.Z + cam.C;
    if (d < 160) continue;
    const s = FOC / d;
    if (s < 0.05) continue;
    const top = H / 2 + s * (row.head - cam.y) + 34 * s;
    if (top > H + 20) continue;
    const hw = 33 * s;
    const rr = 15 * s;
    const bot = top + 80 * s;
    const xs = [];
    ctx.beginPath();
    for (const seat of row.seats) {
      const x = W / 2 + s * (seat.X - cam.x);
      if (x < -hw - 10 || x > W + hw + 10) continue;
      ctx.moveTo(x - hw, bot);
      ctx.lineTo(x - hw, top + rr);
      ctx.quadraticCurveTo(x - hw, top, x - hw + rr, top);
      ctx.lineTo(x + hw - rr, top);
      ctx.quadraticCurveTo(x + hw, top, x + hw, top + rr);
      ctx.lineTo(x + hw, bot);
      ctx.closePath();
      xs.push(x);
    }
    ctx.fill();
    rimRows.push({ k: row.k, s, top, hw, rr, xs });
  }
  ctx.restore();
  return rimRows;
}

// the top edges of the seat backs catching the light (after stage())
function seatRims(ctx, rows, k) {
  if (k <= 0.01) return;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.strokeStyle = '#ece4d2';
  ctx.lineCap = 'round';
  for (const r of rows) {
    ctx.globalAlpha = clamp(k * (1 - r.k / 30));
    ctx.lineWidth = Math.max(0.8, Math.min(2.6, 1.5 * r.s));
    ctx.beginPath();
    for (const x of r.xs) {
      ctx.moveTo(x - r.hw + 1, r.top + r.rr * 0.9);
      ctx.quadraticCurveTo(x - r.hw + 1, r.top + 1, x - r.hw + r.rr, r.top + 1);
      ctx.lineTo(x + r.hw - r.rr, r.top + 1);
      ctx.quadraticCurveTo(x + r.hw - 1, r.top + 1, x + r.hw - 1, r.top + r.rr * 0.9);
    }
    ctx.stroke();
  }
  ctx.restore();
}

function theatreShot(ctx, t) {
  const cam = theatreCam(t);
  const z = FOC / cam.C;
  const S = (x, y) => {
    const p = project(cam, x, y, 0);
    return [p[0], p[1]];
  };
  const bo = backOpen(t);
  const day = smooth(bo, 0.0, 0.8);
  const curtainBottom = lerp(TH.back, TH.pr.top - 60, bo);
  const yOff = curtainBottom - TH.back;
  const op = doorOpen(t);
  const lit = t >= T_BANG;
  const jolt = lit ? Math.exp(-(t - T_BANG) / 0.09) : 0;
  const { pr } = TH;

  ctx.save();
  if (jolt > 0.01) ctx.translate(noise1(t * 60, 1) * 14 * jolt, noise1(t * 60, 2) * 10 * jolt);
  hallDark(ctx);
  let gl;
  let door;
  camera(ctx, stageCam(cam), () => {
    stagePlane(ctx, t, { floorMark: 1, backOpen: bo, beyond: (c) => beyond(c, t) });
    if (curtainBottom > pr.top + 30) door = drawDoor(ctx, op, yOff);
    gl = ghostLight(ctx);
  });
  // daylight lifts the whole hall (paint, before the dark) — not the
  // opening itself, which is painted as it is
  if (day > 0.001) {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const o0 = S(pr.x0, pr.top);
    const o1 = S(pr.x1, TH.floor);
    ctx.beginPath();
    ctx.rect(0, 0, W, H);
    ctx.rect(o1[0], o0[1], o0[0] - o1[0], o1[1] - o0[1]);
    ctx.clip('evenodd');
    ctx.globalCompositeOperation = 'lighter';
    const c = S(TH.cx, 520);
    const g = ctx.createRadialGradient(c[0], c[1], 0, c[0], c[1], 1700 * z);
    g.addColorStop(0, `rgba(255,250,238,${0.26 * day})`);
    g.addColorStop(0.55, `rgba(255,250,238,${0.13 * day})`);
    g.addColorStop(1, `rgba(255,250,238,${0.04 * day})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
  haze(ctx, cam, (0.14 + 0.2 * op) * (1 - day) + 0.08 * day);
  camera(ctx, stageCam(cam), () => drawHim(ctx, t, op));
  auditorium(ctx, cam, t, { occupied: () => 0, seatBacks: false });
  const rows = seatRows(ctx, cam);

  // ---- light
  const L = [];
  const gb = S(gl.bulb[0], gl.bulb[1]);
  const gf = S(gl.foot[0], gl.foot[1]);
  L.push({ type: 'glow', x: gb[0], y: gb[1], r: 440 * z * gl.s, k: 0.85 });
  L.push({ type: 'pool', x: gf[0], y: gf[1], rx: 270 * z * gl.s, ry: 46 * z * gl.s, k: 0.55 });
  if (door) {
    const g = door;
    const { fe } = doorEdge(g, op);
    // the strip of light under the door, and its glow on the boards
    L.push({ type: 'poly', pts: [S(g.x0 + 2, g.bot - 2.5), S(g.x1 - 2, g.bot - 2.5), S(g.x1 - 2, g.bot + 1), S(g.x0 + 2, g.bot + 1)], k: 0.95 * (1 - day) });
    const pc = S((g.x0 + g.x1) / 2, g.bot + 4);
    L.push({ type: 'pool', x: pc[0], y: pc[1], rx: 70 * z, ry: 9 * z, k: 0.45 * (1 - day) });
    if (op > 0.01) {
      L.push({ type: 'poly', pts: [S(g.x0, g.top), S(fe, g.top), S(fe, g.bot), S(g.x0, g.bot)], k: 1 });
      // the wedge of light down the boards toward the old mark
      const w0 = [P_DOOR.X - 62, P_DOOR.X + 30];
      for (const [fD, kk] of [[0, 0.32], [110, 0.28], [210, 0.3]]) {
        const sp = (D_B - fD) / D_B;
        const fx0 = lerp(w0[0], TH.cx - 125, sp);
        const fx1 = lerp(w0[1], TH.cx + 150, sp);
        L.push({ type: 'poly', pts: [S(xAt(w0[0], D_B), BACK_Y), S(xAt(w0[1], D_B), BACK_Y), S(xAt(fx1, fD), yAt(fD)), S(xAt(fx0, fD), yAt(fD))], k: kk * clamp(op * 1.4) * (1 - day) });
      }
    }
  }
  if (bo > 0.001) {
    // daylight through the open back: the land and sky (inside the drapes),
    // the boards, brightest at the back
    const top = Math.max(curtainBottom, pr.top + 40);
    if (top < BACK_Y) L.push({ type: 'poly', pts: [S(pr.x0 + 150, top), S(pr.x1 - 150, top), S(pr.x1 - 70, Math.max(top, 470)), S(pr.x1 - 100, BACK_Y + 1), S(pr.x0 + 100, BACK_Y + 1), S(pr.x0 + 70, Math.max(top, 470))], k: 1 });
    const kb = clamp(bo * 10);
    for (const [fD, kk] of [[0, 0.2], [70, 0.2], [150, 0.25], [230, 0.25]]) {
      L.push({ type: 'poly', pts: [S(470, TH.back), S(1450, TH.back), S(xAt(pr.x1 + 40, fD), yAt(fD)), S(xAt(pr.x0 - 40, fD), yAt(fD))], k: kk * kb });
    }
    const c = S(TH.cx, 470);
    L.push({ type: 'glow', x: c[0], y: c[1], r: 1100 * z, k: 0.4 * day });
    const hw = S(TH.cx, 1050);
    L.push({ type: 'glow', x: hw[0], y: hw[1], r: 1500 * z, k: 0.45 * day });
  }
  if (lit) L.push(spotOnScreen(cam, SPOT7, 1));
  stage(ctx, L, { dark: lerp(0.9, 0.5, day), beams: 1 });

  // ---- after the dark
  seatRims(ctx, rows, 0.3 + 0.15 * op * (1 - day) + 0.45 * day);
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'lighter';
  // the bare bulb
  const br = 46 * z * gl.s;
  const bk = 1 - 0.7 * day;
  const bg = ctx.createRadialGradient(gb[0], gb[1], 0, gb[0], gb[1], br);
  bg.addColorStop(0, `rgba(255,250,236,${0.8 * bk})`);
  bg.addColorStop(0.25, `rgba(255,250,236,${0.25 * bk})`);
  bg.addColorStop(1, 'rgba(255,250,236,0)');
  ctx.fillStyle = bg;
  ctx.fillRect(gb[0] - br, gb[1] - br, br * 2, br * 2);
  if (lit) {
    // in daylight a stage light needs help to read: its beam and pool, added
    const b = spotOnScreen(cam, SPOT7, 1);
    const g = ctx.createLinearGradient(b.sx, b.sy, b.fx, b.fy);
    g.addColorStop(0, 'rgba(255,250,236,0.03)');
    g.addColorStop(1, 'rgba(255,250,236,0.12)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(b.sx - b.rx * 0.12, b.sy);
    ctx.lineTo(b.sx + b.rx * 0.12, b.sy);
    ctx.lineTo(b.fx + b.rx * 0.98, b.fy);
    ctx.lineTo(b.fx - b.rx * 0.98, b.fy);
    ctx.closePath();
    ctx.fill();
    ctx.save();
    ctx.translate(b.fx, b.fy);
    ctx.scale(1, b.ry / b.rx);
    const pg = ctx.createRadialGradient(0, 0, 0, 0, 0, b.rx * 1.25);
    pg.addColorStop(0, 'rgba(255,250,236,0.32)');
    pg.addColorStop(0.7, 'rgba(255,250,236,0.2)');
    pg.addColorStop(1, 'rgba(255,250,236,0)');
    ctx.fillStyle = pg;
    ctx.fillRect(-b.rx * 1.3, -b.rx * 1.3, b.rx * 2.6, b.rx * 2.6);
    ctx.restore();
  }
  ctx.restore();
  if (lit) {
    const b = spotOnScreen(cam, SPOT7, 1);
    dust(ctx, { sx: b.sx, sy: b.sy, fx: b.fx, fy: b.fy, rx: b.rx, ds: Math.min(3, Math.max(0.6, 1000 / cam.C)) }, t, 0.9, 70);
  }
  ctx.restore();

  // the flash of the bang
  if (lit && t < T_BANG + 0.6) {
    const f = Math.exp(-(t - T_BANG) / 0.07);
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'lighter';
    const p = project(cam, TH.cx, TH.floor - 80, 0);
    const g = ctx.createRadialGradient(p[0], p[1], 0, p[0], p[1], 900);
    g.addColorStop(0, `rgba(255,250,236,${0.75 * f})`);
    g.addColorStop(1, 'rgba(255,250,236,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
}

export default {
  draw(ctx, lt) {
    if (lt < T_CUT) roomShot(ctx, Math.max(lt, -0.4));
    else theatreShot(ctx, lt);
    // the end: fade to black
    const f = smooth(lt, 14.6, 16, ease.inOut);
    if (f > 0.001) {
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = `rgba(14,13,12,${f})`;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }
  },
};
