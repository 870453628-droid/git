// s04 · 31–43 · 那就不看了，一个人走。/ 我以为，长大就是不再在乎。
// His room, his head down at the laptop. He sits up and reaches for the lid —
// POV insert: his hand folds the glowing screen shut, the light shrinks to a
// line and dies. Black. The door opens: a slab of light. He stands and walks
// toward it, and the room dissolves around him into a road at dusk (he keeps
// the same stride across the dissolve). He walks right, fast and stiff, head
// down. Across the road a lamp, someone in its pool, a little crowd cheering.
// His face turns halfway toward them, holds, snaps back. He walks on.
//
// The road shot runs on without a cut into s05 (s04 fadeOut 0, s05 fadeIn 0):
// roadShot() below draws both scenes from one continuous walk.
import { W, H, COL, TAU, clamp, lerp, prog, smooth, keys, ease, hash, camera, path, rect, fillPoly, dot, ellipse, withLayer, paper, text } from '../lib.js';
import { figure, pose, walk, reach, SIT, SIT_LIFT, LEG } from '../figure.js';
import { stage } from '../light.js';
import { onlooker, standLamp, counter } from '../props.js';
import { room, ROOM, PILE } from '../room.js';
import { road, ROAD } from '../road.js';
import { S03_END } from './s03.js';

const T0 = 31; // scene start (global)

// ------------------------------------------------------------------ gait
// One continuous walk from the moment he leaves the stool (WALK0) to the end
// of s05. Phase is integrated from the cadence; the hip is integrated so the
// stance foot of walk() stays exactly planted (no sliding at any amt).
export const WALK0 = 34.35;
const WALK1 = 63; // (the table runs on so the far side can be laid out ahead)
const DT = 1 / 300;

// steps per second
function cadence(t) {
  return keys(t, [[WALK0, 2.6], [37.25, 2.6], [37.65, 2.05], [38.45, 2.05], [38.85, 2.7], [41.0, 2.7], [43.0, 2.4], [44.0, 2.4], [47.6, 1.6]]);
}
// stride amount for walk() (0 = standing)
function amtAt(t) {
  return keys(t, [[WALK0, 0], [WALK0 + 0.5, 0.58], [37.25, 0.58], [37.65, 0.48], [38.45, 0.48], [38.85, 0.6], [43.0, 0.58], [44.0, 0.58], [47.6, 1]]);
}
// stiff (0) .. settled (1): arm swing, lean, head
export function relaxAt(t) {
  return smooth(t, 44.0, 47.6);
}

const GN = Math.ceil((WALK1 - WALK0) / DT) + 2;
const G_PH = new Float64Array(GN);
const G_U = new Float64Array(GN); // hip distance (s = 1 units)
const G_M = new Float64Array(GN); // mean distance (for the camera)
(() => {
  let ph = 0;
  let u = 0;
  let m = 0;
  for (let i = 0; i < GN; i++) {
    G_PH[i] = ph;
    G_U[i] = u;
    G_M[i] = m;
    const t = WALK0 + (i + 0.5) * DT;
    const sw = 0.42 * amtAt(t);
    const dph = (cadence(t) / 2) * DT;
    const pm = ph + dph / 2;
    const d = pm - Math.round(2 * pm) / 2;
    u += TAU * LEG * sw * Math.cos(TAU * d) * Math.cos(sw * Math.sin(TAU * d)) * dph;
    m += 4 * LEG * Math.sin(sw) * dph;
    ph += dph;
  }
})();

// {ph, u, m, amt} at global time t (u, m in s = 1 px; 0 before WALK0)
export function gait(t) {
  const x = clamp((t - WALK0) / DT, 0, GN - 1.001);
  const i = Math.floor(x);
  const f = x - i;
  return {
    ph: lerp(G_PH[i], G_PH[i + 1], f),
    u: lerp(G_U[i], G_U[i + 1], f),
    m: lerp(G_M[i], G_M[i + 1], f),
    amt: t < WALK0 ? 0 : amtAt(t),
  };
}

// His walking pose at global t. x0: world x where he started; o: extra
// lean/head/look/turn on top of the gait's own.
export function walker(t, x0, ground, s, o = {}) {
  const g = gait(t);
  const r = relaxAt(t);
  const w = walk(g.ph, ground, s, g.amt);
  const a = Math.sin(g.ph * TAU);
  const k = clamp(g.amt / 0.58);
  const swing = lerp(0.06, 0.4, r) * k;
  const base = lerp(-0.05, 0.02, r);
  const bend = lerp(0.14, 0.34, r);
  return pose({
    ...w,
    x: x0 + s * g.u,
    s,
    f: 1,
    lean: lerp(0.14, 0.035, r) + (o.lean ?? 0),
    head: lerp(0.27, -0.02, r) + (o.head ?? 0),
    look: lerp(0.6, 0, r) + (o.look ?? 0),
    turn: o.turn ?? 0,
    aA1: base - swing * a,
    aA2: bend,
    aB1: base + swing * a,
    aB2: bend,
  });
}

// ------------------------------------------------------------------ room
const RS = ROOM.s;
const SEAT_Y = ROOM.floor - 92 * RS; // stool seat
const HIP_SIT = [ROOM.stoolX + 4, SEAT_Y - SIT_LIFT * RS];
const STAND_X = 960; // where he stands up, and starts walking
// road framing at the moment of the dissolve; the room camera matches his
// on-screen size and position so he walks on unbroken
const ROAD_Z0 = 1.15;
const ROOM_Z = (0.85 * ROAD_Z0) / RS;
const SCREEN_X = 760; // his place on screen while tracking
const DISS0 = 35.65; // room -> road dissolve (global)
const DISS1 = 36.25;
// his first steps bring him a little nearer the camera, so he passes in
// front of the table, not through it
const WALK_Y = ROOM.floor + 26;

// How s03 leaves him (s03 exports it: its END pose, final camera, the
// stalled number and where it floats): head down on his arms, eyes shut.
// s04 opens on exactly that frame.
const TOP = ROOM.floor - 150 * RS;
const CTR = S03_END.ctr ?? [1188, 436]; // s03's floating counter
const seated = (lean, head, look) => pose({ ...SIT, x: HIP_SIT[0], y: HIP_SIT[1], s: RS, f: 1, lean, head, look });

// he lifts his head, looks at the number, reaches for the lid (the cut to
// the POV insert comes as his hand goes out)
function sitPose(lt, lp) {
  const E = S03_END;
  const up = smooth(lt, 0.05, 0.62);
  const glance = smooth(lt, 0.42, 0.62) * (1 - smooth(lt, 0.66, 0.8));
  const p = seated(lerp(E.lean, 0.12, up), lerp(E.head, 0.0, up) - 0.12 * glance, lerp(E.look, 0.1, up) - 0.65 * glance);
  // arms flat on the table -> hands back at the table edge
  const rA = reach(p, 'A', 1012, TOP - 6);
  const rB = reach(p, 'B', 1000, TOP - 4);
  p.aA1 = lerp(E.aA1, rA.a1, up);
  p.aA2 = lerp(E.aA2, rA.a2, up);
  p.aB1 = lerp(E.aB1, rB.a1, up);
  p.aB2 = lerp(E.aB2, rB.a2, up);
  // reach for the lid
  const rk = smooth(lt, 0.55, 0.95);
  if (rk > 0) {
    const r = reach(p, 'A', lp.lidEnd[0], lp.lidEnd[1]);
    p.aA1 = lerp(p.aA1, r.a1, rk);
    p.aA2 = lerp(p.aA2, r.a2, rk);
  }
  return p;
}

function darkPose(lt) {
  // sitting upright in the dark, hands on his knees; looks up at the door;
  // then stands: feet down to the floor, hip forward and up
  const look = smooth(lt, 2.65, 3.0);
  const p = pose({ ...SIT, x: HIP_SIT[0], y: HIP_SIT[1], s: RS, f: 1, lean: 0.1, head: lerp(0.08, -0.06, look), look: lerp(0.3, 0, look) });
  const st = prog(lt, 2.9, 3.35);
  if (st <= 0) return p;
  // the sitting feet (where SIT leaves them)
  const sitFoot = (a1, a2) => [p.x + Math.sin(a1) * 58 * RS + Math.sin(a1 + a2) * 56 * RS, p.y + Math.cos(a1) * 58 * RS + Math.cos(a1 + a2) * 56 * RS];
  const fA0 = sitFoot(SIT.lA1, SIT.lA2);
  const fB0 = sitFoot(SIT.lB1, SIT.lB2);
  const fA1 = [STAND_X + 1, ROOM.floor];
  const fB1 = [STAND_X - 1, ROOM.floor];
  const k1 = ease.inOut(clamp(st / 0.35));
  const k2 = ease.inOut(clamp((st - 0.3) / 0.7));
  p.x = lerp(HIP_SIT[0], STAND_X, k2);
  p.y = lerp(HIP_SIT[1], ROOM.floor - LEG * RS, k2);
  p.lean = 0.1 + 0.32 * Math.sin(Math.PI * clamp(st / 0.8)) * (1 - k2 * 0.4) + 0.04 * k2;
  p.lean = lerp(p.lean, 0.14, k2 * k2);
  p.head = lerp(p.head, 0.27, k2);
  p.look = lerp(p.look, 0.6, k2);
  const fA = [lerp(fA0[0], fA1[0], k1), lerp(fA0[1], fA1[1], k1)];
  const fB = [lerp(fB0[0], fB1[0], k1), lerp(fB0[1], fB1[1], k1)];
  const lA = reach(p, 'A', fA[0], fA[1], 'leg');
  const lB = reach(p, 'B', fB[0], fB[1], 'leg');
  p.lA1 = lA.a1;
  p.lA2 = lA.a2;
  p.lB1 = lB.a1;
  p.lB2 = lB.a2;
  p.aA1 = lerp(SIT.aA1, -0.05, k2);
  p.aA2 = lerp(SIT.aA2, 0.14, k2);
  p.aB1 = lerp(SIT.aB1, -0.05, k2);
  p.aB2 = lerp(SIT.aB2, 0.14, k2);
  return p;
}

function roomShot(ctx, lt) {
  const t = T0 + lt;
  const early = lt < 0.8;
  let cam;
  if (early) {
    const k = smooth(lt, 0, 0.8, ease.sine);
    const c = S03_END.cam;
    cam = { x: lerp(c.x, 1030, k), y: lerp(c.y, 592, k), z: lerp(c.z, 1.36, k) };
  } else {
    // wide; once he walks, pan with him (soft start) so he ends at SCREEN_X
    const g = gait(t);
    const hx = STAND_X + RS * g.m;
    const want = hx + (W / 2 - SCREEN_X) / ROOM_Z;
    const base = 1250;
    const d = want - base;
    const w = 40;
    const cx = base + (d > 8 * w ? d : w * Math.log1p(Math.exp(d / w)));
    cam = { x: cx, y: WALK_Y - (770 - H / 2) / ROOM_Z, z: ROOM_Z };
  }
  const open = early ? 1 : 0;
  const door = smooth(lt, 2.4, 3.05, ease.inOut);
  camera(ctx, cam, () => {
    const r = room(ctx, t, { open, door, balls: PILE.length });
    let p;
    if (early) p = sitPose(lt, r.lp);
    else if (t < WALK0) p = darkPose(lt);
    else p = walker(t, STAND_X, ROOM.floor + (WALK_Y - ROOM.floor) * smooth(t, WALK0, WALK0 + 0.7), RS);
    figure(ctx, p, { id: 1, cowlick: true, eye: early && lt < 0.16 ? 'closed' : 'dot' });
    const lights = [];
    if (early) {
      // the number, still stuck (bobbing in s03's phase)
      counter(ctx, CTR[0], CTR[1] + Math.sin((t - 19) * 2.1) * 3, S03_END.n, { size: 66 });
      const sc = r.lp.screen;
      lights.push(r.screenLight, { type: 'glow', x: sc[0] - 40, y: sc[1] + 20, r: 760, k: 0.36 }, { type: 'glow', x: CTR[0] + 10, y: CTR[1], r: 170, k: 0.55 });
    }
    if (r.doorLight) {
      lights.push({ type: 'poly', pts: r.doorLight, k: 1 });
      // what spills from the doorway into the room
      lights.push({ type: 'glow', x: ROOM.door.x + 80, y: ROOM.floor - 120, r: 1500, k: 0.46 * door });
    }
    // after the lid shuts the room is fully black for a moment
    stage(ctx, lights, { dark: early ? 0.8 : 0.98 - 0.06 * smooth(lt, 2.22, 2.5) });
  });
}

// --------------------------------------------------------------- POV insert
// Looking down at the laptop from his seat; the lid folds shut. A tiny 3D
// projection: X across, Y up from the desk, Z away from the eye. Lid length 1.
const PV = { f: 1618, cx: 960, cy: 382, e: 0.6, zh: 3.0, hw: 0.81, th: 0.03 };
const pj = (X, Y, Z) => [PV.cx + (PV.f * X) / Z, PV.cy - (PV.f * (Y - PV.e)) / Z];
const OPEN_A = (106 * Math.PI) / 180;
// a point on the lid: x across, v along it from the hinge (0) to the top edge (1)
const lidPt = (x, v, a) => pj(x, PV.th + v * Math.sin(a), PV.zh - v * Math.cos(a));

function povShot(ctx, lt) {
  const close = smooth(lt, 1.12, 2.08, ease.sine);
  const a = OPEN_A * (1 - close);
  // which side of the lid faces the eye
  const faceSide = -PV.zh * Math.sin(a) + (PV.e - PV.th) * Math.cos(a);
  const vis = clamp(-faceSide / 1.6);
  // the desk: back edge line, and the laptop's deck with a few key rows
  path(ctx, [[-40, 560], [W + 40, 564]], { w: 3, color: COL.inkSoft, seed: 7300, wobble: 0.6 });
  const d0 = pj(-PV.hw, PV.th, PV.zh);
  const d1 = pj(PV.hw, PV.th, PV.zh);
  const d2 = pj(PV.hw, PV.th, PV.zh - 1);
  const d3 = pj(-PV.hw, PV.th, PV.zh - 1);
  const d2b = pj(PV.hw, 0, PV.zh - 1);
  const d3b = pj(-PV.hw, 0, PV.zh - 1);
  path(ctx, [d0, d1, d2, d3], { w: 4, close: true, fill: COL.paper, seed: 7301, wobble: 0.5 });
  path(ctx, [d3, d3b, d2b, d2], { w: 3.4, seed: 7302, wobble: 0.4 });
  for (let row = 0; row < 4; row++) {
    const z = PV.zh - 0.12 - row * 0.105;
    const n = 12 - (row === 3 ? 4 : 0);
    for (let i = 0; i < n; i++) {
      const x0 = -0.6 + (i / 12) * 1.2 + (row === 3 ? 0.2 : 0);
      const q0 = pj(x0, PV.th, z);
      const q1 = pj(x0 + (row === 3 && i === 3 ? 0.3 : 0.075), PV.th, z);
      path(ctx, [q0, q1], { w: 2.2, color: COL.inkSoft, seed: 7310 + row * 20 + i, wobble: 0.3 });
    }
  }
  const tp = [pj(-0.2, PV.th, PV.zh - 0.6), pj(0.2, PV.th, PV.zh - 0.6), pj(0.2, PV.th, PV.zh - 0.88), pj(-0.2, PV.th, PV.zh - 0.88)];
  path(ctx, tp, { w: 2.4, color: COL.inkSoft, close: true, seed: 7360, wobble: 0.3 });

  // the lid
  const L0 = lidPt(-PV.hw, 0, a);
  const L1 = lidPt(PV.hw, 0, a);
  const L2 = lidPt(PV.hw, 1, a);
  const L3 = lidPt(-PV.hw, 1, a);
  const lights = [];
  if (faceSide < 0) {
    // the bezel, then the lit face with the stalled number on it
    path(ctx, [L0, L1, L2, L3], { w: 4.4, close: true, fill: '#2b2825', seed: 7370, wobble: 0.3 });
    const F0 = lidPt(-PV.hw + 0.05, 0.07, a);
    const F1 = lidPt(PV.hw - 0.05, 0.07, a);
    const F2 = lidPt(PV.hw - 0.05, 0.94, a);
    const F3 = lidPt(-PV.hw + 0.05, 0.94, a);
    fillPoly(ctx, [F0, F1, F2, F3], '#f6f2ea');
    // s03's screen, mapped onto the tilting face in thin rows (each row of the
    // lid sits at one depth, so a row is an exact affine map)
    const tex = screenTexture();
    const base = ctx.getTransform();
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(...F0);
    ctx.lineTo(...F1);
    ctx.lineTo(...F2);
    ctx.lineTo(...F3);
    ctx.closePath();
    ctx.clip();
    const N = 64;
    const vt = 0.94;
    const vb = 0.07;
    const xl = -PV.hw + 0.05;
    const xr = PV.hw - 0.05;
    const V = (y) => vt - ((vt - vb) * y) / CH;
    for (let i = 0; i < N; i++) {
      const y0 = (CH * i) / N;
      const y1 = (CH * (i + 1)) / N;
      const ym = (y0 + y1) / 2;
      // across: the strip's middle row; down: along the centre line
      const A = lidPt(xl, V(ym), a);
      const B = lidPt(xr, V(ym), a);
      const c0 = lidPt(0, V(y0), a);
      const c1 = lidPt(0, V(y1), a);
      const ux = (B[0] - A[0]) / CW;
      const uy = (B[1] - A[1]) / CW;
      const wx = (c1[0] - c0[0]) / (y1 - y0);
      const wy = (c1[1] - c0[1]) / (y1 - y0);
      ctx.setTransform(base);
      ctx.transform(ux, uy, wx, wy, A[0] - wx * ym, A[1] - wy * ym);
      ctx.drawImage(tex, 0, y0, CW, y1 - y0 + 0.6, 0, y0, CW, y1 - y0 + 0.6);
    }
    ctx.restore();
    lights.push({ type: 'poly', pts: [F0, F1, F2, F3], k: 1 });
    const c = [(F0[0] + F2[0]) / 2, (F0[1] + F2[1]) / 2];
    lights.push({ type: 'glow', x: c[0], y: c[1] + 60, r: 1150, k: 0.75 * Math.sqrt(vis) });
  } else {
    // past edge-on: the back of the lid, lying over the keys
    path(ctx, [L0, L1, L2, L3], { w: 4.4, close: true, fill: COL.paper, seed: 7371, wobble: 0.3 });
  }

  // his hand: in from the right, fingers hooked over the top edge, folds it down
  const grip = lidPt(0.32, 1, a);
  const inK = smooth(lt, 0.66, 1.1, ease.out);
  const hx = lerp(2060, grip[0], inK);
  const hy = lerp(420, grip[1], inK);
  povHand(ctx, hx, hy);

  stage(ctx, lights, { dark: 0.92 + 0.06 * smooth(lt, 1.95, 2.2) });
}

// His forearm and hand seen from his own eyes: a tapered sleeve of an arm
// coming in from the lower right, a mitten hand whose knuckles hook over the
// edge at (x, y).
function povHand(ctx, x0, y0) {
  // drawn 1.25x about the grip point
  ctx.save();
  ctx.translate(x0, y0);
  ctx.scale(1.25, 1.25);
  const x = 0;
  const y = 0;
  const X = (px) => (px - x0) / 1.25; // canvas -> local
  const Y = (py) => (py - y0) / 1.25;
  // wrist -> elbow -> shoulder (off frame), widening toward the eye
  const bone = [[x + 30, y + 40], [X(x0 + 380), Y(y0 + 420 + (y0 - 160) * 0.25)], [X(2300), Y(1300)]];
  const wid = [19, 44, 130];
  const left = [];
  const right = [];
  for (let i = 0; i < bone.length; i++) {
    const p0 = bone[Math.max(0, i - 1)];
    const p1 = bone[Math.min(bone.length - 1, i + 1)];
    const dx = p1[0] - p0[0];
    const dy = p1[1] - p0[1];
    const l = Math.hypot(dx, dy) || 1;
    const nx = -dy / l;
    const ny = dx / l;
    left.push([bone[i][0] + nx * wid[i], bone[i][1] + ny * wid[i]]);
    right.push([bone[i][0] - nx * wid[i], bone[i][1] - ny * wid[i]]);
  }
  fillPoly(ctx, [...left, ...right.slice().reverse()], COL.paper);
  path(ctx, left, { w: 5, seed: 7380, wobble: 0.8 });
  path(ctx, right, { w: 5, seed: 7384, wobble: 0.8 });
  // a crease at the elbow
  const e = bone[1];
  path(ctx, [[e[0] - 12, e[1] + 4], [e[0] + 6, e[1] + 14]], { w: 3, seed: 7390, wobble: 0.3, alpha: 0.7 });
  // knuckles over the edge
  for (let i = 0; i < 4; i++) {
    const fx = x - 20 + i * 14;
    path(ctx, [[fx - 7, y + 12], [fx - 6, y - 5], [fx, y - 11], [fx + 6, y - 5], [fx + 7, y + 12]], { w: 4.2, fill: COL.paper, seed: 7385 + i, wobble: 0.25 });
  }
  // the back of the hand
  ellipse(ctx, x + 6, y + 24, 34, 25, { w: 5, fill: COL.paper, seed: 7381, wobble: 0.5 });
  // the thumb, tucked along the front
  path(ctx, [[x - 18, y + 34], [x - 28, y + 24], [x - 26, y + 12]], { w: 4.2, seed: 7389, wobble: 0.25 });
  ctx.restore();
}

// What is on the screen when he shuts it: s03's last close-up — the video
// (someone dancing), the player bar, 播放 12, stalled. Drawn in s03's
// 1120x640 screen box.
const CW = 1120;
const CH = 640;
let tex = null;
function screenTexture() {
  if (!tex) {
    tex = document.createElement('canvas');
    tex.width = CW;
    tex.height = CH;
  }
  const c = tex.getContext('2d');
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.clearRect(0, 0, CW, CH);
  screenContent(c);
  return tex;
}
function screenContent(ctx) {
  const tx = 60;
  const ty = 40;
  const tw = CW - 120;
  const th = 360;
  rect(ctx, tx, ty, tw, th, { w: 4, seed: 9920 });
  const cx = tx + tw / 2;
  const fl = ty + th - 46;
  path(ctx, [[tx + 60, fl], [tx + tw - 60, fl]], { w: 4, wobble: 0.6, seed: 9850 });
  figure(ctx, pose({ x: cx, y: fl - 114 * 0.95 + 4, s: 0.95, view: 'front', aA1: 2.5, aA2: 0.5, aB1: 1.2, aB2: 1.2, lA1: 0.35, lA2: -0.2, lB1: 0.05, lean: 0.12, head: 0.15 }), { id: 10, mouth: 1, w: 4 });
  for (const sx of [-1, 1]) path(ctx, [[cx + sx * 130, fl - 200], [cx + sx * 150, fl - 160]], { w: 3, seed: 9851 + (sx > 0 ? 1 : 0), wobble: 0.2 });
  const by = ty + th + 26;
  path(ctx, [[tx, by], [tx + tw, by]], { w: 3, color: COL.inkSoft, seed: 9925, wobble: 0.2 });
  const bp = tx + tw * 0.78;
  path(ctx, [[tx, by], [bp, by]], { w: 5, seed: 9926, wobble: 0.2 });
  dot(ctx, bp, by, 8);
  text(ctx, '播放', tx + 86, CH - 98, { size: 64 });
  counter(ctx, CW / 2 + 70, CH - 102, S03_END.n, { size: 156 });
}

// ------------------------------------------------------------------ road
// The road at dusk, one take from s04 (35.65) to the end of s05 (52.3).
export const ROAD_S = 0.85;
// where he is (world x of his hip) at global t
export const roadX = (t) => ROAD_S * gait(t).u;

// Lamps with little crowds on the far side of the road. Each group: its
// centre x (world), lamp offset/height, pool size, people [dx, scale, mode],
// an optional one in the light (star), and for one lamp a sweep onto his path.
export const GROUPS = [];
// G(tPass, group): place a group so its centre passes him at global tPass
const G = (tPass, o) => GROUPS.push({ x: roadX(tPass), ...o });

// s04: a child in the pool, grown-ups around cheering and clapping (as it
// once was for him). He glances at ~37.7 and passes them at ~39.75.
G(39.75, {
  seed: 3, lamp: 175, h: 330, rx: 62, glow: [320, 0.42], star: { s: 0.4, kind: 'child' },
  people: [[-118, 0.6, 'clap'], [-76, 0.64, 'cheer'], [-38, 0.57, 'clap'], [42, 0.58, 'cheer'], [80, 0.65, 'clap'], [120, 0.6, 'cheer']],
});
// s05: a lit little group passes him every ~2.5–3.5 s
G(45.0, { seed: 4, lamp: -112, h: 250, rx: 58, star: { s: 0.6, kind: 'wave' }, people: [[-52, 0.6, 'clap'], [50, 0.58, 'clap'], [84, 0.63, 'cheer']] });
// the lamp that swings its beam onto his path (45.2–47.9); he walks through
export const SWEEP = { x: roadX(46.5), t0: 45.2, t1: 45.95, t2: 47.15, t3: 47.95 };
GROUPS.push({ x: SWEEP.x + 175, seed: 5, lamp: -110, h: 290, rx: 64, sweep: SWEEP, people: [[-40, 0.6, 'clap'], [2, 0.64, 'cheer'], [44, 0.58, 'clap'], [84, 0.62, 'cheer']] });
G(50.9, { seed: 6, lamp: 112, h: 275, rx: 62, people: [[-48, 0.6, 'cheer'], [-6, 0.64, 'cheer'], [40, 0.57, 'clap']] });
G(53.3, { seed: 7, lamp: -105, h: 225, rx: 56, star: { s: 0.62, kind: 'tada' }, people: [[-50, 0.59, 'clap'], [52, 0.63, 'clap']] });
G(56.9, { seed: 8, lamp: 110, h: 300, rx: 58, people: [[-26, 0.62, 'idle', 0.6], [24, 0.6, 'idle', -0.6]] });
G(59.4, { seed: 9, lamp: -100, h: 240, rx: 54, star: { s: 0.6, kind: 'wave' }, people: [[56, 0.6, 'clap']] });
G(62.6, { seed: 10, lamp: 108, h: 270, rx: 60, people: [[-36, 0.6, 'cheer'], [34, 0.63, 'clap']] });

// camera for the road at global t: in close for his glance, then slowly back
// out to s05's framing while the cheering falls behind
export function roadCam(t) {
  // (s05 ends with a slow push in, toward s06's medium shot)
  const z = keys(t, [[35, ROAD_Z0], [36.2, ROAD_Z0], [37.7, 1.55], [38.9, 1.55], [42.9, 1], [48.6, 1], [52.3, 1.1]], ease.inOut);
  const y = ROAD.near - (keys(t, [[38.9, 770], [42.9, 760]], ease.inOut) - H / 2) / z;
  return { x: ROAD_S * gait(t).m + (W / 2 - SCREEN_X) / z, y, z };
}

function starPose(st, x, ground, t, ph) {
  const s = st.s;
  const p = pose({ x, y: ground - LEG * s, s, view: 'front', lA1: 0.07, lB1: 0.07 });
  if (st.kind === 'child') {
    // hands on hips, up on his toes now and then (s01)
    p.y -= Math.max(0, Math.sin((t * 1.6 + ph) * TAU)) * 4;
    Object.assign(p, { aA1: 0.8, aA2: -2.1, aB1: 0.8, aB2: -2.1, head: -0.06, look: -0.4 });
  } else if (st.kind === 'wave') {
    Object.assign(p, { aA1: 2.5, aA2: 0.35 + 0.3 * Math.sin((t * 1.4 + ph) * TAU), aB1: 0.18, aB2: 0.1, head: 0.04 * Math.sin(t * 2) });
  } else {
    // ta-da: both arms out and up
    const b = Math.sin((t * 0.9 + ph) * TAU);
    Object.assign(p, { aA1: 2.3 + 0.08 * b, aA2: 0.2, aB1: 2.3 - 0.08 * b, aB2: 0.2, head: -0.05 });
  }
  return p;
}

// sweep amount 0 (on its own people) .. 1 (on his path)
const sweepK = (sw, t) => (t < sw.t2 ? smooth(t, sw.t0, sw.t1) : 1 - smooth(t, sw.t2, sw.t3));

function drawGroup(ctx, g, t, lights) {
  const far = ROAD.far;
  const lx = g.x + g.lamp;
  // where the lamp points: its own pool, or (sweeping) the near road
  const k = g.sweep ? sweepK(g.sweep, t) : 0;
  const fx = lerp(g.x, g.sweep ? g.sweep.x : g.x, k);
  const fy = lerp(far + 6, ROAD.near + 2, k);
  const rx = lerp(g.rx, 96, k);
  const ry = lerp(g.rx * 0.21, 21, k);
  const src = standLamp(ctx, lx, far - 6, g.h, fx, fy - lerp(40, 70, k), { seed: 5600 + g.seed * 7 });
  g.people.forEach(([dx, sc, mode, tn], i) => {
    // they look at their light; while it is away, they look where it went
    const turn = lerp(tn ?? (dx < 0 ? 0.7 : -0.7), -0.85, k);
    onlooker(ctx, g.x + dx, far - 4 + (i % 2) * 7, sc, t, { mode, k: 1 - k, ph: hash(g.seed * 17 + i), turn, id: 60 + g.seed * 10 + i });
  });
  if (g.star) figure(ctx, starPose(g.star, g.x, far + 8, t, hash(g.seed)), { id: 200 + g.seed, mouth: 1 });
  lights.push({ type: 'spot', sx: src[0], sy: src[1], fx, fy, rx, ry, k: 1 });
  const [gr, gk] = g.glow ?? [250, 0.32];
  lights.push({ type: 'glow', x: g.x + 10, y: far - 70, r: gr, k: lerp(gk, 0.18, k) });
}

// his head: the half-turn at the cheering (s04), then the head comes up as
// his steps settle (s05, via the walker's relax)
function glance(t) {
  return {
    turn: keys(t, [[37.3, 0], [37.7, 0.52], [38.45, 0.52], [38.58, 0]], ease.inOut),
    head: keys(t, [[37.3, 0], [37.7, -0.24], [38.45, -0.24], [38.58, 0.07], [41, 0.07], [43, 0]], ease.inOut),
    look: keys(t, [[37.3, 0], [37.7, -0.8], [38.45, -0.8], [38.58, 0.2], [41, 0.2], [43, 0]], ease.inOut),
  };
}

// The whole road shot at global time t (s04 from 35.5, and all of s05).
export function roadShot(ctx, t) {
  const cam = roadCam(t);
  const half = W / 2 / cam.z + 80;
  camera(ctx, cam, () => {
    road(ctx, cam.x - half, cam.x + half);
    const lights = [];
    for (const g of GROUPS) {
      if (g.x < cam.x - half - 300 || g.x > cam.x + half + 300) continue;
      drawGroup(ctx, g, t, lights);
    }
    figure(ctx, walker(t, 0, ROAD.near, ROAD_S, glance(t)), { id: 1, cowlick: true });
    // dusk: the sky a little lighter far ahead, more so as he walks on
    lights.push({ type: 'glow', x: cam.x + 900 / cam.z, y: ROAD.horizon - 60, r: 1500, k: keys(t, [[38, 0.3], [52, 0.5]]) });
    const dark = keys(t, [[40.5, 0.6], [43.8, 0.55], [51.5, 0.48]]);
    stage(ctx, lights, { dark, beams: 0.8 });
  });
}

export default {
  fadeOut: 0, // the road runs straight on into s05
  draw(ctx, lt) {
    lt = Math.max(0, lt);
    const t = T0 + lt;
    if (lt < 0.8) roomShot(ctx, lt);
    else if (lt < 2.22) povShot(ctx, lt);
    else if (t < DISS0) roomShot(ctx, lt);
    else if (t < DISS1) {
      roomShot(ctx, lt);
      withLayer(ctx, (l) => {
        paper(l);
        roadShot(l, t);
      }, { alpha: smooth(t, DISS0, DISS1, ease.sine) });
    } else roadShot(ctx, t);
  },
};
