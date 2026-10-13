// s03 — 可怎样才算有缘分？我自己也想不明白。若是真有缘，为何最终走到了不再联系的结局；若当真无缘，
// Alone in his frame the boy scratches his head — a "?" — and sits down on the
// floor. He folds a paper plane, stands, and throws it toward her far frame.
// The camera follows it over the empty gap: it climbs, stalls, and drops onto
// the faint trace of the old path, well short of her frame. She never turns.
// The camera settles on the plane lying there (hands off to s04's desk).
import { COL, TAU, lerp, clamp, prog, smooth, keys, ease, path, ellipsePts, dot, camera } from '../lib.js';
import { figure, pose, mixPose, joints, standY, LEG } from '../figure.js';
import { paperPlane } from '../sets.js';
import { GROUND, S, BOY_X, FRIEND_EXIT, drawWorld, drawGirl, boyAfter, walker, reachSide, tuft, s02Cam } from './s02.js';
import { DESK_PLANE, CAM0 } from './s04.js';

const START = 14.25;

// --- the boy's moves (scene-local time) -----------------------------------
const T = {
  lift: [0.55, 1.0], // head comes up
  scratch: [0.95, 2.25], // hand to head
  q: [1.15, 1.5], // "?" appears
  sit: [2.35, 3.05], // sits down on the floor
  pocket: [3.45, 3.8], // paper out of the pocket
  fold: [3.95, 4.75], // folds the plane
  stand: [4.95, 5.45],
  wind: [5.42, 5.68],
  release: 5.86,
  land: 7.48,
  rest: 7.8,
};

const SIT_X = BOY_X - 82; // hip x when sitting on the floor
const THROW_X = BOY_X + 12;
const LAND_X = 1182;
const PLANE_S = 1.0;

// floor-sitting pose, facing right, knees up
function sitPose(x) {
  return pose({
    x, y: GROUND - 11 * S, s: S, f: 1,
    lean: 0.16, head: 0.1, look: 0.4,
    lA1: 2.3, lA2: -1.75, lB1: 2.2, lB2: -1.58,
  });
}
function crouchPose(x) {
  return pose({ x, y: GROUND - 86 * S, s: S, f: 1, lean: 0.38, head: -0.1, lA1: 1.2, lA2: -1.6, lB1: 1.1, lB2: -1.5, aA1: 0.6, aA2: 0.4, aB1: 0.4, aB2: 0.4 });
}
function standPose(x) {
  return pose({ x, y: standY(GROUND, S), s: S, f: 1, lean: 0.02, aA1: 0.9, aA2: 1.2, aB1: -0.08, aB2: 0.2 });
}

// arms resting on the knees while sitting
function armsOnKnees(p) {
  const j = joints(p);
  // arms wrapped over the knees, hands clasped in front of the shins
  const [a1, a2] = reachSide(j.armRoot, [j.kneeA[0] + 9, j.kneeA[1] + 24], 1, S, 1);
  const [b1, b2] = reachSide(j.armRoot, [j.kneeB[0] + 3, j.kneeB[1] + 27], 1, S, 1);
  return { ...p, aA1: a1, aA2: a2, aB1: b1, aB2: b2 };
}

// both hands together in front of the chest (folding)
function armsFold(p, bob) {
  const j = joints(p);
  const c = [j.armRoot[0] + 44, j.armRoot[1] + 8 - bob];
  const [a1, a2] = reachSide(j.armRoot, [c[0] + 9, c[1] + 2], 1, S, -1);
  const [b1, b2] = reachSide(j.armRoot, [c[0] - 7, c[1] + 4], 1, S, -1);
  return { p: { ...p, aA1: a1, aA2: a2, aB1: b1, aB2: b2 }, c };
}

function boyPose(lt, t) {
  let p;
  let paper = null; // {kind, x, y, ang}
  if (lt < T.sit[0]) {
    p = { ...boyAfter(t) };
    // head comes up, a puzzled look ahead
    const up = smooth(lt, T.lift[0], T.lift[1]);
    p = mixPose(p, { ...p, head: -0.08, lean: 0, look: -0.2 }, up);
    // scratching his head
    const sc = smooth(lt, T.scratch[0], T.scratch[0] + 0.3) * (1 - smooth(lt, T.scratch[1] - 0.3, T.scratch[1]));
    if (sc > 0) {
      const j = joints(p);
      const wig = Math.sin((lt - T.scratch[0]) * TAU * 3.2) * 4;
      const tgt = [j.head[0] - 0.35 * j.r + wig, j.head[1] - 0.95 * j.r];
      const [a1, a2] = reachSide(j.armRoot, tgt, 1, S, 1);
      p.aA1 = lerp(p.aA1, a1, sc);
      p.aA2 = lerp(p.aA2, a2, sc);
      p.head += 0.12 * sc;
    }
  } else if (lt < T.stand[0]) {
    // sits down: crouch, then onto the floor
    const k1 = smooth(lt, T.sit[0], T.sit[0] + 0.35);
    const k2 = smooth(lt, T.sit[0] + 0.3, T.sit[1]);
    const a = { ...boyAfter(t), head: -0.08, lean: 0, look: -0.2 };
    const cr = crouchPose(lerp(BOY_X, SIT_X, 0.45));
    const si = armsOnKnees(sitPose(SIT_X));
    p = k2 > 0 ? mixPose(cr, si, k2) : mixPose(a, cr, k1);
    if (k2 > 0) p.y = lerp(cr.y, si.y, ease.out(k2));
    // takes a sheet of paper from his pocket and folds a plane
    if (lt > T.pocket[0]) {
      const j = joints(si);
      const pocket = [j.hip[0] + 6, j.hip[1] - 4];
      const bob = foldBob(lt);
      const { p: pf, c } = armsFold(si, bob);
      // hand A: knee -> pocket -> up in front of the chest; hand B joins it
      const kneeH = joints(si).handA;
      const mid = (T.pocket[0] + T.pocket[1]) / 2;
      const handPath = [[T.pocket[0], kneeH], [mid, pocket], [T.fold[0], [c[0] + 9, c[1] + 2]]];
      let hA;
      if (lt < mid) hA = lerpPt(handPath[0][1], handPath[1][1], smooth(lt, T.pocket[0], mid));
      else hA = lerpPt(handPath[1][1], handPath[2][1], smooth(lt, mid, T.fold[0]));
      if (lt >= T.fold[0]) hA = [c[0] + 9, c[1] + 2];
      const [a1, a2] = reachSide(j.armRoot, hA, 1, S, -1);
      const kb = smooth(lt, mid, T.fold[0]);
      p = mixPose(si, pf, kb);
      p.aA1 = a1;
      p.aA2 = a2;
      if (lt > mid) {
        const hj = joints(p);
        const k = smooth(lt, mid, T.fold[0]);
        const at = lerpPt(hj.handA, c, k);
        paper = { kind: lt < T.fold[0] ? 'sheet' : 'fold', x: at[0], y: at[1], k: prog(lt, T.fold[0], T.fold[1]), sc: lerp(0.45, 1, k) };
      }
      // looks down at his hands
      p.head = lerp(p.head, 0.35, smooth(lt, T.pocket[0], T.pocket[1]));
      p.look = lerp(p.look, 1, smooth(lt, T.pocket[0], T.pocket[1]));
      if (lt > T.fold[1]) {
        // a look up across the gap, toward her
        const lk = smooth(lt, T.fold[1], T.fold[1] + 0.25);
        p.head = lerp(p.head, -0.05, lk);
        p.look = lerp(p.look, -0.2, lk);
      }
    }
  } else {
    // stands, winds up, throws
    const si = armsFold(sitPose(SIT_X), 0).p;
    const cr = crouchPose(lerp(SIT_X, THROW_X, 0.55));
    const st = standPose(THROW_X);
    const k1 = smooth(lt, T.stand[0], T.stand[0] + 0.25);
    const k2 = smooth(lt, T.stand[0] + 0.2, T.stand[1]);
    p = k2 > 0 ? mixPose({ ...cr, aA1: si.aA1, aA2: si.aA2, aB1: si.aB1, aB2: si.aB2 }, st, k2) : mixPose(si, { ...cr, aA1: si.aA1, aA2: si.aA2, aB1: si.aB1, aB2: si.aB2 }, k1);
    p.head = -0.05;
    p.look = -0.2;
    // the throw
    const wind = smooth(lt, T.wind[0], T.wind[1]);
    const rel = smooth(lt, T.wind[1] + 0.06, T.release, ease.in);
    const fol = smooth(lt, T.release, T.release + 0.35, ease.out);
    if (wind > 0) {
      // arm swings up and over to cock back behind the head
      p.aA1 = lerp(p.aA1, 4.15, wind);
      p.aA2 = lerp(p.aA2, 0.7, wind);
      p.lean = lerp(p.lean, -0.1, wind);
      p.lB1 = lerp(p.lB1, -0.22, wind);
      p.lA1 = lerp(p.lA1, 0.2, wind);
      p.aB1 = lerp(p.aB1, 0.9, wind);
      p.aB2 = lerp(p.aB2, 0.3, wind);
    }
    if (rel > 0) {
      p.aA1 = lerp(p.aA1, 2.05, rel);
      p.aA2 = lerp(p.aA2, 0.05, rel);
      p.lean = lerp(p.lean, 0.14, rel);
      p.aB1 = lerp(p.aB1, -0.5, rel);
      p.aB2 = lerp(p.aB2, 0.2, rel);
    }
    if (fol > 0) {
      p.aA1 = lerp(p.aA1, 1.75, fol);
      p.lean = lerp(p.lean, 0.1, fol);
    }
    // the arm stays out, then sinks as the plane falls
    const sink = smooth(lt, 6.9, 7.9, ease.sine);
    p.aA1 = lerp(p.aA1, 0.2, sink);
    p.aA2 = lerp(p.aA2, 0.15, sink);
    p.aB1 = lerp(p.aB1, -0.1, sink);
    p.lean = lerp(p.lean, 0.04, sink);
    const watch = smooth(lt, 6.6, 7.6);
    p.look = lerp(p.look, 0.4, watch);
    p.head = lerp(p.head, 0.22, smooth(lt, T.land, T.land + 0.8));
    p.look = lerp(p.look, 0.8, smooth(lt, T.land, T.land + 0.8));
    if (lt < T.release) {
      const hj = joints(p);
      paper = { kind: 'plane', x: hj.handA[0], y: hj.handA[1], ang: lerp(-0.15, -0.3, wind) + 0.2 * rel };
    }
  }
  return { p, paper };
}

const foldBob = (lt) => {
  // three small dips of the hands, one per fold
  const k = prog(lt, T.fold[0], T.fold[1]);
  return 4 * Math.abs(Math.sin(k * Math.PI * 3));
};

// --- the plane's flight -----------------------------------------------------
let releasePt = null;
function release() {
  if (!releasePt) {
    // pure: the hand position at the moment of release
    const { p } = boyPose(T.release - 1e-4, START + T.release);
    const j = joints(p);
    releasePt = [j.handA[0], j.handA[1]];
  }
  return releasePt;
}

// catmull-rom through timed points
function spline(pts, t) {
  if (t <= pts[0][0]) return [pts[0][1], pts[0][2]];
  const n = pts.length;
  if (t >= pts[n - 1][0]) return [pts[n - 1][1], pts[n - 1][2]];
  let i = 0;
  while (t > pts[i + 1][0]) i++;
  const p0 = pts[Math.max(0, i - 1)];
  const p1 = pts[i];
  const p2 = pts[i + 1];
  const p3 = pts[Math.min(n - 1, i + 2)];
  const u = (t - p1[0]) / (p2[0] - p1[0]);
  const cr = (a, b, c, d) => {
    const u2 = u * u;
    const u3 = u2 * u;
    return 0.5 * (2 * b + (-a + c) * u + (2 * a - 5 * b + 4 * c - d) * u2 + (-a + 3 * b - 3 * c + d) * u3);
  };
  return [cr(p0[1], p1[1], p2[1], p3[1]), cr(p0[2], p1[2], p2[2], p3[2])];
}

const REST_Y = GROUND - 12.5 * PLANE_S;

function flightPts() {
  const [rx, ry] = release();
  const r = T.release;
  return [
    [r, rx, ry],
    [r + 0.3, rx + 190, ry - 70],
    [r + 0.62, rx + 400, ry - 100],
    [r + 0.88, rx + 560, ry - 88],
    [r + 1.08, rx + 640, ry - 40],
    [r + 1.3, rx + 730, ry + 80],
    [r + 1.5, LAND_X - 50, REST_Y - 26],
    [T.land, LAND_X, REST_Y],
  ];
}

export function planeAt(lt) {
  const pts = flightPts();
  if (lt <= T.land) {
    const [x, y] = spline(pts, lt);
    const [x2, y2] = spline(pts, lt + 0.02);
    let ang = Math.atan2(y2 - y, x2 - x);
    // nose pitches up as it stalls, then drops
    const r = T.release;
    ang -= 0.45 * Math.sin(prog(lt, r + 0.6, r + 1.1) * Math.PI);
    ang += 0.07 * Math.sin(lt * 17) * smooth(lt, r + 1.0, r + 1.2);
    // flares just before touching down
    ang = lerp(ang, 0.05, smooth(lt, T.land - 0.12, T.land));
    return { x, y, ang };
  }
  // skids a little and settles, nose down
  const k = prog(lt, T.land, T.rest);
  const x = LAND_X + 22 * ease.out(k);
  const hop = Math.sin(Math.min(1, k * 2.2) * Math.PI) * 5 * (1 - k);
  const ang = lerp(0.05, 0.13, ease.out(k)) - 0.06 * Math.sin(k * Math.PI);
  return { x, y: REST_Y - hop + 2 * ease.out(k), ang };
}

// --- the scene --------------------------------------------------------------
// final camera: the resting plane comes to sit exactly where s04's paper
// plane lies on her desk (same screen spot, same size) for the match-dissolve
export const PLANE_REST = { x: LAND_X + 22, y: REST_Y + 2, ang: 0.13 };
const MZ = DESK_PLANE.s * CAM0.z / PLANE_S;
const MATCH = {
  z: MZ,
  x: PLANE_REST.x - ((DESK_PLANE.x - CAM0.x) * CAM0.z) / MZ,
  y: PLANE_REST.y - ((DESK_PLANE.y - CAM0.y) * CAM0.z) / MZ,
};
export function s03Cam(lt) {
  if (lt < 0.45) return s02Cam(START + lt);
  if (lt > 8.05) {
    // push in on the plane: zoom leads and the pan lags, so she slips out of
    // the right edge early and the plane glides to where s04's plane lies
    const W0 = { x: 962, y: 622, z: 1.0 };
    const u = smooth(lt, 8.05, 9.4, ease.sine);
    const drift = smooth(lt, 9.4, 10.0) * 0.01;
    return {
      x: lerp(W0.x, MATCH.x, u * u) + drift * 100,
      y: lerp(W0.y, MATCH.y, ease.out(u)) + drift * 100,
      z: lerp(W0.z, MATCH.z, ease.out(u)) + drift,
    };
  }
  return keys(lt, [
    [0.45, { x: 306, y: 600, z: 1.31 }],
    [1.6, { x: 286, y: 588, z: 1.48 }],
    [3.1, { x: 272, y: 628, z: 1.6 }],
    // close on his hands while he folds
    [3.95, { x: 252, y: 686, z: 1.95 }],
    [4.8, { x: 256, y: 684, z: 1.98 }],
    [5.5, { x: 330, y: 610, z: 1.46 }],
    [6.25, { x: 560, y: 585, z: 1.22 }],
    [6.95, { x: 820, y: 600, z: 1.07 }],
    [7.7, { x: 958, y: 620, z: 1.0 }],
    [8.05, { x: 962, y: 622, z: 1.0 }],
  ], ease.sine);
}

export default {
  fadeOut: 1.0,
  draw(ctx, lt, info) {
    const t = info.t;
    const u = Math.max(0, lt);
    const cam = s03Cam(lt);
    camera(ctx, cam, () => {
      drawWorld(ctx, t, { ghost: smooth(u, 3.5, 6.5) });
      drawGirl(ctx, t);

      // the friend, still on his way out
      if (t < FRIEND_EXIT[1][0]) {
        const fp = pose(walker(t, FRIEND_EXIT, 1.2));
        fp.head = 0.12;
        fp.look = 0.3;
        figure(ctx, fp, { id: 3 });
        tuft(ctx, joints(fp), fp);
      }

      const { p, paper } = boyPose(u, t);
      figure(ctx, p, { id: 1 });
      if (paper) drawPaper(ctx, paper);
      question(ctx, u, joints(p));

      if (u >= T.release) {
        const pl = planeAt(u);
        paperPlane(ctx, pl.x, pl.y, pl.ang, PLANE_S, { seed: 5100 });
        // a faint trail while it flies
        trail(ctx, u);
      }
    });
  },
};

// the "?" over his head: pops in, then sinks and fades as he sits down
function question(ctx, lt, j) {
  const a = smooth(lt, T.q[0], T.q[1]) * (1 - smooth(lt, T.sit[0] + 0.1, T.sit[1] + 0.2));
  if (a <= 0.01) return;
  const pop = 1 + 0.18 * Math.sin(prog(lt, T.q[0], T.q[1] + 0.15) * Math.PI);
  const sink = 26 * smooth(lt, T.sit[0], T.sit[1] + 0.2);
  const x = BOY_X + 26;
  const y = standY(GROUND, S) - 186 * S + sink;
  const sc = 21 * pop;
  const pts = ellipsePts(x, y - sc * 0.55, sc * 0.62, sc * 0.6, Math.PI * 1.05, Math.PI * 2.45, 12);
  pts.push([x, y + sc * 0.45]);
  path(ctx, pts, { w: 3.6, alpha: a, draw: smooth(lt, T.q[0], T.q[1] - 0.05), seed: 5200, wobble: 0.5 });
  if (lt > T.q[1] - 0.1) dot(ctx, x, y + sc * 1.05, 3.6, COL.ink, a);
}

// the sheet of paper / plane in his hands
function drawPaper(ctx, pp) {
  const o = { w: 2.2, fill: COL.paper, seed: 5300, wobble: 0.4 };
  if (pp.kind === 'plane') {
    paperPlane(ctx, pp.x + 4, pp.y - 4, pp.ang, PLANE_S * 0.95, { seed: 5100 });
    return;
  }
  const x = pp.x;
  const y = pp.y - 10 * pp.sc;
  const k = pp.kind === 'sheet' ? 0 : pp.k;
  const s = pp.sc;
  const st = Math.min(3, Math.floor(k * 4));
  if (st === 0) {
    // a flat sheet, seen face on
    const w = 15 * s;
    const h = 20 * s;
    path(ctx, [[x - w, y - h], [x + w, y - h], [x + w, y + h], [x - w, y + h]], { ...o, close: true });
  } else if (st === 1) {
    // top corners folded in
    const w = 15 * s;
    const h = 20 * s;
    path(ctx, [[x, y - h - 4 * s], [x + w, y - h + 12 * s], [x + w, y + h], [x - w, y + h], [x - w, y - h + 12 * s]], { ...o, close: true });
    path(ctx, [[x, y - h - 4 * s], [x, y + h]], { ...o, w: 1.4, fill: undefined, seed: 5301 });
  } else if (st === 2) {
    // a narrow dart
    const w = 9 * s;
    const h = 22 * s;
    path(ctx, [[x, y - h], [x + w, y + h], [x - w, y + h]], { ...o, close: true });
    path(ctx, [[x, y - h], [x, y + h]], { ...o, w: 1.4, fill: undefined, seed: 5301 });
  } else {
    paperPlane(ctx, x + 2, y + 6, -0.2, PLANE_S * 0.9, { seed: 5100 });
  }
}

// a dotted trace of the flight, fading behind the plane
function trail(ctx, lt) {
  const r = T.release;
  if (lt > T.land + 0.6) return;
  const fade = 1 - smooth(lt, T.land - 0.1, T.land + 0.6);
  const pts = [];
  const t0 = Math.max(r, lt - 0.55);
  for (let tt = t0; tt <= Math.min(lt, T.land) - 0.06; tt += 0.03) {
    const p = planeAt(tt);
    pts.push([p.x - 20, p.y + 3]);
  }
  if (pts.length >= 2) path(ctx, pts, { w: 1.6, alpha: 0.35 * fade, dash: [6, 10], seed: 5400, wobble: 0.3 });
}

const lerpPt = (a, b, k) => [lerp(a[0], b[0], k), lerp(a[1], b[1], k)];
