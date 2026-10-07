// Stick-figure rig.
//
// A pose is a plain object of numbers (see DEF below); poses can be blended
// with mixPose() or keyframed with keys() from lib.js.
//
// SIDE view (view: 'side', default)
//   x, y      hip position
//   s         scale (1 => about 270px tall standing)
//   f         facing: 1 = facing right, -1 = facing left
//   lean      torso tilt from vertical, + = toward facing direction
//   head      extra head tilt on top of lean, + = nod forward/down
//   look      gaze, -1 (up) .. 1 (down); moves the eye dot
//   Limb angles are measured from straight DOWN, + = toward the facing side.
//   aA1/aA2   arm A (drawn in front): upper arm angle, elbow bend (relative,
//             + = forearm swings further forward/up)
//   aB1/aB2   arm B (drawn behind)
//   lA1/lA2   leg A: thigh angle, knee bend (relative, - = shin swings back)
//   lB1/lB2   leg B
//   tail      ponytail sway in radians (+ = flicks backward/up)
//
// FRONT / BACK view (view: 'front' | 'back')
//   lean      sideways tilt, + = toward screen right
//   head      head roll, + = toward screen right
//   turn      -1..1 head turn toward screen left/right (shows an eye on the
//             rim in back view, shifts the eyes in front view)
//   aA*/lA*   limbs on screen LEFT, angle + = outward (to the left)
//   aB*/lB*   limbs on screen RIGHT, angle + = outward (to the right)
//
// figure(ctx, pose, o)
//   o.ponytail  true for HER (ponytail + gold tie)
//   o.id        seed base so the figure's wobble is stable (use 1 for him,
//               2 for her, others 3+)
//   o.w, o.color, o.alpha, o.dash, o.eye ('dot'|'closed'|'none'), o.legs
//   o.headFill  paper colour fill so the head hides lines behind it
//   o.mustache  true | 'droop' — his turned-up moustache (droops when old)
//   o.bow, o.skirt, o.boots — the girl: a hair bow, a small skirt, white boots
//   o.boots: 'black' — his patent-leather boots (with a little shine)
//   o.tieR      radius of her gold tie (default max(3.6, 6.2*s)); o.noTie
//               skips it. The returned joints include .tie ([x, y] or null).

import { COL, TAU, lerp, path, ellipse, dot, fillPoly, F } from './lib.js';

export const BODY = { r: 21, neck: 8, torso: 88, ua: 46, la: 44, ul: 58, ll: 56, drop: 13 };
export const LEG = BODY.ul + BODY.ll;

export const DEF = {
  x: 960, y: 700, s: 1, f: 1, view: 'side',
  lean: 0, head: 0, look: 0, turn: 0,
  aA1: 0.14, aA2: 0.12, aB1: -0.14, aB2: 0.12,
  lA1: 0.05, lA2: 0, lB1: -0.05, lB2: 0,
  tail: 0,
};

export function pose(o = {}) {
  return { ...DEF, ...o };
}

export function mixPose(a, b, k) {
  const out = { ...a };
  for (const key in b) {
    if (typeof a[key] === 'number' && typeof b[key] === 'number') out[key] = lerp(a[key], b[key], k);
    else if (k >= 0.5 || a[key] === undefined) out[key] = b[key];
  }
  return out;
}

// hip y for a figure standing with straight legs on groundY
export const standY = (groundY, s = 1) => groundY - LEG * s;

// ---------------------------------------------------------------- joints
export function joints(p) {
  return p.view === 'side' || !p.view ? sideJoints(p) : frontJoints(p);
}

function sideJoints(p) {
  const s = p.s;
  const f = p.f;
  const dn = (a) => [f * Math.sin(a), Math.cos(a)];
  const add = (o, d, l) => [o[0] + d[0] * l * s, o[1] + d[1] * l * s];
  const hip = [p.x, p.y];
  const up = [f * Math.sin(p.lean), -Math.cos(p.lean)];
  const shoulder = add(hip, up, BODY.torso);
  const armRoot = add(hip, up, BODY.torso - BODY.drop);
  const hl = p.lean + p.head;
  const hu = [f * Math.sin(hl), -Math.cos(hl)];
  const neckTop = add(shoulder, hu, BODY.neck);
  const head = add(neckTop, hu, BODY.r);
  const arm = (a1, a2) => {
    const e = add(armRoot, dn(a1), BODY.ua);
    return [e, add(e, dn(a1 + a2), BODY.la)];
  };
  const leg = (a1, a2) => {
    const k = add(hip, dn(a1), BODY.ul);
    return [k, add(k, dn(a1 + a2), BODY.ll)];
  };
  const [elbowA, handA] = arm(p.aA1, p.aA2);
  const [elbowB, handB] = arm(p.aB1, p.aB2);
  const [kneeA, footA] = leg(p.lA1, p.lA2);
  const [kneeB, footB] = leg(p.lB1, p.lB2);
  return { hip, shoulder, armRoot, neckTop, head, r: BODY.r * s, elbowA, handA, elbowB, handB, kneeA, footA, kneeB, footB, headAngle: hl };
}

function frontJoints(p) {
  const s = p.s;
  // side = -1 for screen-left limbs, +1 for screen-right limbs
  const dn = (a, side) => [side * Math.sin(a), Math.cos(a)];
  const add = (o, d, l) => [o[0] + d[0] * l * s, o[1] + d[1] * l * s];
  const hip = [p.x, p.y];
  const up = [Math.sin(p.lean), -Math.cos(p.lean)];
  const shoulder = add(hip, up, BODY.torso);
  const hl = p.lean + p.head;
  const hu = [Math.sin(hl), -Math.cos(hl)];
  const neckTop = add(shoulder, hu, BODY.neck);
  const head = add(neckTop, hu, BODY.r);
  head[0] += (p.turn ?? 0) * 2.5 * s;
  const shW = 9 * s;
  const hipW = 7 * s;
  const armRoot = add(hip, up, BODY.torso - BODY.drop * 0.6);
  const shL = [armRoot[0] - shW * Math.cos(p.lean), armRoot[1] - shW * Math.sin(p.lean)];
  const shR = [armRoot[0] + shW * Math.cos(p.lean), armRoot[1] + shW * Math.sin(p.lean)];
  const hipL = [hip[0] - hipW, hip[1]];
  const hipR = [hip[0] + hipW, hip[1]];
  const limb = (o, l1, l2, a1, a2, side) => {
    const m = add(o, dn(a1, side), l1);
    return [m, add(m, dn(a1 + a2, side), l2)];
  };
  const [elbowA, handA] = limb(shL, BODY.ua, BODY.la, p.aA1, p.aA2, -1);
  const [elbowB, handB] = limb(shR, BODY.ua, BODY.la, p.aB1, p.aB2, 1);
  // fs foreshortens the thighs (legs coming toward/away from the camera)
  const ul = BODY.ul * (p.fs ?? 1);
  const [kneeA, footA] = limb(hipL, ul, BODY.ll, p.lA1, p.lA2, -1);
  const [kneeB, footB] = limb(hipR, ul, BODY.ll, p.lB1, p.lB2, 1);
  return { hip, shoulder, shL, shR, hipL, hipR, neckTop, head, r: BODY.r * s, elbowA, handA, elbowB, handB, kneeA, footA, kneeB, footB, headAngle: hl };
}

// ---------------------------------------------------------------- drawing
export function figure(ctx, p0, o = {}) {
  const p = { ...DEF, ...p0 };
  const j = joints(p);
  const s = p.s;
  const w = o.w ?? Math.max(2, 4.6 * Math.pow(s, 0.85));
  const id = o.id ?? 3;
  const sd = (k) => id * 41 + k;
  const st = { w, color: o.color ?? COL.ink, dash: o.dash, still: o.still, wobble: o.wobble ?? 1.1, boots: o.boots };
  ctx.save();
  if (o.alpha !== undefined) ctx.globalAlpha *= o.alpha;

  const limb = (a, b, c, k) => path(ctx, [a, b, c], { ...st, seed: sd(k) });
  const side = p.view === 'side' || !p.view;
  const legs = o.legs ?? true;

  if (side) {
    if (legs) limb(j.hip, j.kneeB, j.footB, 1);
    if (legs && o.skirt) limb(j.hip, j.kneeA, j.footA, 4);
    if (legs && o.boots) boots(ctx, p, j, st, sd);
    if (o.skirt) skirt(ctx, p, j, st, sd);
    limb(j.armRoot, j.elbowB, j.handB, 2);
    path(ctx, [j.hip, j.shoulder, j.neckTop], { ...st, seed: sd(3) });
    if (legs && !o.skirt) limb(j.hip, j.kneeA, j.footA, 4);
    limb(j.armRoot, j.elbowA, j.handA, 5);
  } else {
    if (legs) {
      limb(j.hipL, j.kneeA, j.footA, 1);
      limb(j.hipR, j.kneeB, j.footB, 4);
      if (!o.skirt) path(ctx, [j.hipL, j.hipR], { ...st, seed: sd(6), wobble: 0.4 });
      if (o.boots) boots(ctx, p, j, st, sd);
    }
    if (o.skirt) skirt(ctx, p, j, st, sd);
    path(ctx, [j.hip, j.shoulder, j.neckTop], { ...st, seed: sd(3) });
    path(ctx, [j.shL, j.shR], { ...st, seed: sd(7), wobble: 0.4 });
    if (o.arms === 'upper') {
      // seen from behind while sitting: forearms go forward, out of sight
      path(ctx, [j.shL, j.elbowA], { ...st, seed: sd(2) });
      path(ctx, [j.shR, j.elbowB], { ...st, seed: sd(5) });
    } else {
      limb(j.shL, j.elbowA, j.handA, 2);
      limb(j.shR, j.elbowB, j.handB, 5);
    }
    if (o.seat) path(ctx, [[j.hip[0] - 15 * s, j.hip[1]], [j.hip[0] + 15 * s, j.hip[1]]], { ...st, seed: sd(13), wobble: 0.4 });
  }

  // ponytail behind the head in side/front view
  const [hx, hy] = j.head;
  const r = j.r;
  let tie = null;
  if (o.ponytail && p.view !== 'back') tie = drawTail(ctx, p, j, st, sd, o, false);

  ellipse(ctx, hx, hy, r, r, { ...st, fill: o.headFill ?? COL.paper, seed: sd(8), wobble: 0.8, start: -2.2 + (o.headStart ?? 0) });

  if (o.ponytail && p.view === 'back') tie = drawTail(ctx, p, j, st, sd, o, true);
  if (tie && !o.noTie) {
    dot(ctx, tie[0], tie[1], o.tieR ?? Math.max(3.6, 6.2 * s), o.tieColor ?? COL.gold);
  }
  j.tie = tie;
  if (o.bow) bow(ctx, p, j, st, sd);
  if (o.mustache) mustache(ctx, p, j, st, sd, o.mustache);

  // eyes
  const eye = o.eye ?? 'dot';
  if (eye !== 'none') {
    const ec = o.color ?? COL.ink;
    if (side) {
      const a = j.headAngle;
      // eye sits forward of the head centre and a little up, both rotated by the head tilt
      const ex = hx + p.f * Math.cos(a) * r * 0.45 + p.f * Math.sin(a) * r * 0.12;
      const ey = hy + Math.sin(a) * r * 0.45 - Math.cos(a) * r * 0.12 + (p.look ?? 0) * r * 0.22;
      if (eye === 'closed') path(ctx, [[ex - 3.2 * s, ey], [ex + 3.2 * s, ey + 0.8 * s]], { ...st, w: Math.max(1.4, 2.2 * s), seed: sd(9), wobble: 0 });
      else dot(ctx, ex, ey, Math.max(1.5, 2.9 * s), ec);
    } else if (p.view === 'front') {
      const tx = (p.turn ?? 0) * r * 0.35;
      for (const sx of [-1, 1]) {
        const ex = hx + tx + sx * r * 0.36;
        const ey = hy - r * 0.08 + (p.look ?? 0) * r * 0.2;
        if (eye === 'closed') path(ctx, [[ex - 3 * s, ey], [ex + 3 * s, ey]], { ...st, w: Math.max(1.4, 2.2 * s), seed: sd(9 + sx), wobble: 0 });
        else dot(ctx, ex, ey, Math.max(1.5, 2.7 * s), ec);
      }
    } else if (p.view === 'back' && Math.abs(p.turn ?? 0) > 0.35) {
      // turned head seen from behind: one eye peeks at the rim
      const k = (Math.abs(p.turn) - 0.35) / 0.65;
      const sx = Math.sign(p.turn);
      dot(ctx, hx + sx * r * 0.86, hy - r * 0.05 + (p.look ?? 0) * r * 0.2, Math.max(1.4, 2.6 * s) * Math.min(1, k * 1.6), ec);
    }
  }
  ctx.restore();
  return j;
}

function drawTail(ctx, p, j, st, sd, o, back) {
  const [hx, hy] = j.head;
  const r = j.r;
  const s = p.s;
  const sway = p.tail ?? 0;
  let pts;
  let tie;
  if (back) {
    const ax = hx + (p.turn ?? 0) * -r * 0.15;
    const ay = hy - r * 0.2;
    tie = [ax, ay];
    pts = [
      [ax, ay],
      [ax + Math.sin(sway) * r * 0.45 + r * 0.1, ay + r * 0.7],
      [ax + Math.sin(sway) * r * 0.95 - r * 0.04, ay + r * 1.45],
      [ax + Math.sin(sway) * r * 1.35 + r * 0.06, ay + r * 2.05],
    ];
  } else {
    // anchor on the back-upper rim of the head
    const f = p.view === 'front' ? (p.turn >= 0 ? -1 : 1) : p.f;
    const a = j.headAngle;
    const back = -f;
    const ux = Math.sin(a) * f;
    const uy = -Math.cos(a);
    // direction pointing backward (perpendicular to up)
    const bx = back * Math.cos(a);
    const by = -Math.sin(a);
    const ax = hx + (bx * 0.8 + ux * 0.45) * r;
    const ay = hy + (by * 0.8 + uy * 0.45) * r;
    tie = [ax + bx * r * 0.18, ay + by * r * 0.18];
    const sw = Math.sin(sway);
    pts = [
      [tie[0], tie[1]],
      [tie[0] + back * r * (0.62 + 0.35 * sw), tie[1] + r * (0.42 - 0.45 * sw)],
      [tie[0] + back * r * (0.78 + 0.85 * sw), tie[1] + r * (1.25 - 0.85 * sw)],
      [tie[0] + back * r * (0.62 + 1.25 * sw), tie[1] + r * (1.95 - 1.2 * sw)],
    ];
  }
  path(ctx, pts, { ...st, w: st.w * 1.1, seed: sd(11) });
  // a second, thinner strand gives the tail a little body
  const q = pts.map(([x, y], i) => [x + (i ? 3.5 * s * (i % 2 ? 1 : -0.6) : 0), y + (i ? 2 * s : 0)]);
  path(ctx, q, { ...st, w: st.w * 0.5, seed: sd(12) });
  return tie;
}

// ---------------------------------------------------------------- poses
// Each helper returns a partial pose; spread it into pose({...}).

// Walk cycle. phase counts cycles (1 = two steps). ground: y of the floor.
// Returns hip y as well, so the feet stay on the ground.
export function walk(phase, ground, s = 1, amt = 1) {
  const a = Math.sin(phase * TAU);
  const c = Math.cos(phase * TAU);
  const sw = 0.42 * amt;
  const lA1 = sw * a;
  const lB1 = -sw * a;
  const lA2 = -0.95 * amt * Math.max(0, c) * Math.max(0, c);
  const lB2 = -0.95 * amt * Math.max(0, -c) * Math.max(0, -c);
  const reach = Math.max(Math.cos(lA1) * BODY.ul + Math.cos(lA1 + lA2) * BODY.ll, Math.cos(lB1) * BODY.ul + Math.cos(lB1 + lB2) * BODY.ll);
  return {
    y: ground - reach * s,
    lA1, lA2, lB1, lB2,
    aA1: -0.38 * amt * a, aA2: 0.3,
    aB1: 0.38 * amt * a, aB2: 0.3,
    lean: 0.06 * amt,
  };
}

// distance-based walk phase helper: how many cycles for a distance in px
export const walkPhase = (dist, s = 1) => dist / (180 * s);

// sitting on a ledge / chair, side view. Shins hang down.
export const SIT = { lA1: 1.5, lA2: -1.45, lB1: 1.38, lB2: -1.3, lean: -0.04, aA1: 0.5, aA2: 0.5, aB1: 0.35, aB2: 0.5 };
// hip height above the seat surface for SIT
export const SIT_LIFT = 3;

// back view sitting on a ledge, hands in the lap: draw with {legs:false, seat:true}
export const SIT_BACK = { aA1: 0.55, aA2: -1.4, aB1: 0.55, aB2: -1.4, lean: 0 };
// front view sitting on a ledge, legs dangling over the edge toward the camera,
// hands resting on the ledge beside the hips
export const SIT_FRONT = { fs: 0.22, lA1: 0.12, lA2: -0.08, lB1: 0.12, lB2: -0.08, aA1: 0.5, aA2: -0.45, aB1: 0.5, aB2: -0.45 };

export const WAVE = (t, speed = 9) => ({ aA1: 2.55, aA2: 0.45 + 0.35 * Math.sin(t * speed) });
export const SIGH = { lean: 0.22, head: 0.38, aA1: 0.04, aA2: 0.05, aB1: -0.04, aB2: 0.05, look: 0.8 };
export const HEAD_DOWN = { head: 0.5, lean: 0.12, look: 1 };
export const LOOK_UP = { head: -0.45, look: -1 };
export const THINK = { aA1: 0.55, aA2: 2.35, head: 0.12 }; // hand to chin
export const REACH = { aA1: 1.4, aA2: 0.08 };
export const HANDS_POCKET = { aA1: 0.1, aA2: -0.25, aB1: -0.12, aB2: 0.35 };

// ------------------------------------------------------------ costume bits
// unit vectors for a side-view head: forward (face) and up, rotated by tilt
function headAxes(p, j) {
  const a = j.headAngle;
  const f = p.view === 'side' || !p.view ? p.f : 1;
  return { fx: f * Math.cos(a), fy: Math.sin(a), ux: f * Math.sin(a), uy: -Math.cos(a), f };
}

function mustache(ctx, p, j, st, sd, kind) {
  const [hx, hy] = j.head;
  const r = j.r;
  const droop = kind === 'droop' ? 1 : 0;
  const ink = st.color ?? COL.ink;
  // One filled lobe in local units of the head radius: a runs outward from
  // under the nose, b runs up. The tip curls up (handlebar), or hangs down
  // when he is old.
  const lobe = (P, dir, k) => {
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
    const pts = L.map(([a, b]) => P(dir * a, b));
    fillPoly(ctx, pts, ink, 1);
    path(ctx, pts, { ...st, w: Math.max(1, st.w * 0.35), close: true, seed: sd(20 + k), wobble: 0.15 });
  };
  if (p.view === 'side' || !p.view) {
    const { fx, fy, ux, uy } = headAxes(p, j);
    // under the nose: forward of centre, a little below it
    const bx = hx + fx * r * 0.82 - ux * r * 0.3;
    const by = hy + fy * r * 0.82 - uy * r * 0.3;
    const k = 1.35;
    const P = (a, b) => [bx + (fx * a * r + ux * b * r) * k, by + (fy * a * r + uy * b * r) * k];
    lobe(P, 1, 0);
    lobe((a, b) => P(a * 0.55, b * 0.8), -1, 1);
  } else if (p.view === 'front') {
    const cx = hx + (p.turn ?? 0) * r * 0.35;
    const cy = hy + r * 0.3;
    const P = (a, b) => [cx + a * r, cy - b * r];
    lobe(P, 1, 0);
    lobe(P, -1, 1);
  }
}

function bow(ctx, p, j, st, sd) {
  const [hx, hy] = j.head;
  const r = j.r;
  const s = p.s;
  let cx;
  let cy;
  if (p.view === 'side' || !p.view) {
    const { fx, fy, ux, uy } = headAxes(p, j);
    cx = hx - fx * r * 0.62 + ux * r * 0.78;
    cy = hy - fy * r * 0.62 + uy * r * 0.78;
  } else {
    cx = hx + r * 0.78;
    cy = hy - r * 0.62;
  }
  const b = r * 0.62;
  const w = Math.max(1.4, st.w * 0.55);
  // tilt the bow along the head's curve
  const tilt = 0.6;
  const R = (dx, dy) => [cx + dx * Math.cos(tilt) - dy * Math.sin(tilt), cy + dx * Math.sin(tilt) + dy * Math.cos(tilt)];
  for (const sx of [-1, 1]) {
    path(ctx, [R(0, 0), R(sx * b, -b * 0.6), R(sx * b * 1.08, 0), R(sx * b, b * 0.6), R(0, 0)], { ...st, w, fill: COL.paper, seed: sd(24 + (sx > 0 ? 1 : 0)), wobble: 0.25 });
  }
  dot(ctx, cx, cy, Math.max(1.6, b * 0.24), st.color ?? COL.ink);
}

function skirt(ctx, p, j, st, sd) {
  const s = p.s;
  const [hx, hy] = j.hip;
  const top = [hx, hy - 14 * s];
  const len = 46 * s;
  let pts;
  if (p.view === 'side' || !p.view) {
    const f = p.f;
    // the hem follows the legs a little so it swings when she walks
    const swing = ((p.lA1 ?? 0) + (p.lB1 ?? 0)) * 0.5;
    const sx = Math.sin(swing) * len * 0.5 * f;
    pts = [[top[0] - f * 6 * s, top[1]], [hx - f * 20 * s + sx, hy + len], [hx + f * 22 * s + sx, hy + len], [top[0] + f * 6 * s, top[1]]];
  } else {
    pts = [[top[0] - 8 * s, top[1]], [hx - 26 * s, hy + len], [hx + 26 * s, hy + len], [top[0] + 8 * s, top[1]]];
  }
  path(ctx, pts, { ...st, w: st.w * 0.85, fill: COL.paper, close: true, seed: sd(26), wobble: 0.5 });
}

function boots(ctx, p, j, st, sd) {
  const s = p.s;
  const f = p.view === 'side' || !p.view ? p.f : 0;
  for (const [k, ft] of [[0, j.footA], [1, j.footB]]) {
    const cx = ft[0] + f * 4 * s;
    const cy = ft[1] - 3 * s;
    // 'black' = his patent-leather boots (wedding day, and later the wall)
    const black = p.boots === 'black' || st.boots === 'black';
    ellipse(ctx, cx, cy, 8.5 * s, 5.5 * s, { ...st, w: Math.max(1.4, st.w * 0.6), fill: black ? COL.ink : COL.paper, seed: sd(27 + k), wobble: 0.2 });
    if (black) dot(ctx, cx + f * 3 * s, cy - 2 * s, Math.max(1, 1.3 * s), '#f4ecd8', 0.9);
  }
}

// ------------------------------------------------------------ reaching (IK)
// Angles that put a side-view hand (or foot) on (tx, ty).
//   which: 'A' | 'B' (which arm/leg); limb: 'arm' | 'leg'
// Returns {a1, a2} to spread into the pose, e.g.
//   const r = reach(p, 'A', x, y); p.aA1 = r.a1; p.aA2 = r.a2;
// Out-of-reach targets give a straight limb pointing at the target.
export function reach(p0, which, tx, ty, limb = 'arm') {
  const p = { ...DEF, ...p0 };
  const j = sideJoints(p);
  const s = p.s;
  const root = limb === 'arm' ? j.armRoot : j.hip;
  const L1 = (limb === 'arm' ? BODY.ua : BODY.ul) * s;
  const L2 = (limb === 'arm' ? BODY.la : BODY.ll) * s;
  const dx = tx - root[0];
  const dy = ty - root[1];
  const d = Math.min(Math.max(Math.hypot(dx, dy), Math.abs(L1 - L2) + 0.01), L1 + L2 - 0.01);
  const aT = Math.atan2(p.f * dx, dy);
  const alpha = Math.acos((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d));
  const beta = Math.acos((L1 * L1 + L2 * L2 - d * d) / (2 * L1 * L2));
  // elbows bend forward/up, knees bend back
  if (limb === 'arm') return { a1: aT - alpha, a2: Math.PI - beta };
  return { a1: aT + alpha, a2: -(Math.PI - beta) };
}
