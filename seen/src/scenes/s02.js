// s02 · 9–19 · 后来，灯走了，我就追。/ 人散了，我不知道自己在哪。
// Starts on exactly s01's last frame. He grows in three jump-cuts while the
// pool of light stays child-sized. The light slides off; he runs after it
// (side view); each time he arrives it jumps again, faster. The audience's
// heads follow the light, not him. The light blinks out, the crowd turns its
// back and fades; a dim grey light finds him at a strange crossroads.
import { COL, TAU, clamp, lerp, prog, smooth, keys, ease, hash, camera, path, dot } from '../lib.js';
import { figure, pose, mixPose, standY } from '../figure.js';
import { stage } from '../light.js';
import { onlooker } from '../props.js';
import { STAGE, AUDIENCE, stageLights } from './s01.js';

const FL = STAGE.floor;
const T0 = 9; // global start: the audience's clap clock continues s01's

// ------------------------------------------------------------- the light
// [t0, t1, x0, x1, ease]: the first one slides off, the rest jump
const STOPS = [960, 1700, 2080, 2420, 2740];
const MOVES = [
  [1.5, 2.15, STOPS[0], STOPS[1], ease.inOut],
  [3.6, 3.8, STOPS[1], STOPS[2], ease.out],
  [4.55, 4.72, STOPS[2], STOPS[3], ease.out],
  [5.22, 5.36, STOPS[3], STOPS[4], ease.out],
];
function lightX(lt) {
  let x = 960;
  for (const [a, b, x0, x1, e] of MOVES) if (lt >= a) x = lerp(x0, x1, e(prog(lt, a, b)));
  return x;
}
// the beam leans a little once it starts to travel (a follow-spot)
const lightSX = (lt, lx) => lx - 150 * smooth(lt, 1.5, 2.15);
// two blinks, then out (15.0)
function spotK(lt) {
  if (lt < 6.0) return 1;
  if (lt < 6.05) return 0.2;
  if (lt < 6.12) return 1;
  if (lt < 6.17) return 0.08;
  if (lt < 6.23) return 0.75;
  return 0;
}
// the three growth jump-cuts
const CUTS = [0.4, 0.8, 1.2];
const flash = (lt) => CUTS.reduce((m, c) => Math.max(m, lt >= c ? 1 - prog(lt, c, c + 0.1) : 0), 0);

// ------------------------------------------------------------- his run
// trapezoid speed profile: accelerate over ra, cruise, brake over rd
function trap(k, ra, rd) {
  const v = 1 / (1 - ra / 2 - rd / 2);
  if (k <= 0) return 0;
  if (k >= 1) return 1;
  if (k < ra) return (0.5 * v * k * k) / ra;
  if (k < 1 - rd) return v * (ra / 2 + (k - ra));
  return 1 - (0.5 * v * (1 - k) * (1 - k)) / rd;
}
const RUNS = [
  { t0: 2.2, t1: 3.35, x0: 960, x1: 1700, ra: 0.25, rd: 0.3 },
  { t0: 3.7, t1: 4.35, x0: 1700, x1: 2080, ra: 0.25, rd: 0.3 },
  { t0: 4.62, t1: 5.12, x0: 2080, x1: 2420, ra: 0.22, rd: 0.3 },
  { t0: 5.3, t1: 6.38, x0: 2420, x1: 2622, ra: 0.2, rd: 0.34 },
];
function boyX(lt) {
  let x = 960;
  for (const r of RUNS) if (lt >= r.t0) x = lerp(r.x0, r.x1, trap(prog(lt, r.t0, r.t1), r.ra, r.rd));
  return x;
}
const speed = (lt) => (boyX(lt + 0.02) - boyX(lt - 0.02)) / 0.04;

// A run cycle (side view). u: cycle phase (1 = two strides). Leg angles are
// absolute (from straight down); the recovery leg tucks, the reaching leg
// extends; arms pump bent at the elbow, opposite to the legs.
function runLegs(u) {
  const leg = (v) => {
    const th = 0.15 + 0.62 * Math.sin(v * TAU);
    const tuck = Math.pow(Math.max(0, Math.cos((v + 0.03) * TAU)), 1.4);
    return [th, -(0.32 + 1.6 * tuck)];
  };
  const [lA1, lA2] = leg(u);
  const [lB1, lB2] = leg(u + 0.5);
  const a = Math.sin(u * TAU);
  return { lA1, lA2, lB1, lB2, aA1: 0.05 - 0.8 * a, aA2: 1.55, aB1: 0.05 + 0.8 * a, aB2: 1.55 };
}
// lowest foot of a pose (hip at 0), for putting the feet on the floor
function footDrop(p, s) {
  const f = (a1, a2) => (Math.cos(a1) * 58 + Math.cos(a1 + a2) * 56) * s;
  return Math.max(f(p.lA1, p.lA2), f(p.lB1, p.lB2));
}

// ------------------------------------------------------------- the crowd
// s01's audience plus more people further along the stage (out of shot at
// first): a back row only, with gaps where the light will stop.
const EXTRA = (() => {
  const out = [];
  let i = 0;
  for (let x = 1600; x < 3600; x += 116) {
    const xx = x + (hash(i * 7.1) - 0.5) * 30;
    const hit = STOPS.some((sx) => xx - sx > -140 && xx - sx < 80);
    if (!hit) out.push({ x: xx, g: 728 + (hash(i * 2.9) - 0.5) * 8, s: 0.8 * (0.94 + 0.12 * hash(i * 3.3)), i: 100 + i });
    i++;
  }
  return out;
})();
const PEOPLE = [...AUDIENCE.map((p) => ({ ...p, orig: true })), ...EXTRA];

// the clapping slows (a time warp on the clap clock) and stops
function clapClock(lt) {
  // rate 1 -> 0.45 between 0.3 and 1.8
  const rate = (u) => 1 - 0.55 * smooth(u, 0.3, 1.8);
  const n = Math.min(60, Math.ceil(Math.max(0, lt) / 0.05));
  let acc = 0;
  for (let k = 0; k < n; k++) acc += rate((k + 0.5) * (lt / n)) * (lt / n);
  return T0 + acc;
}
// when each original clapper lowers their hands
const handsDown = (p) => 0.55 + ((p.i * 7) % 10) * 0.17;

function drawPerson(ctx, p, lt, lx, clapT, dim = 1) {
  // heads follow the light
  const dx = lx - p.x;
  const want = clamp(dx / 240, -1, 1) * 0.85;
  let turn = want;
  let head = clamp(dx / 300, -1, 1) * 0.12;
  let k = 0;
  if (p.orig) {
    const s01turn = -p.side * 0.7;
    const m = smooth(lt, 0.2, 0.7);
    turn = lerp(s01turn, want, m);
    head *= m;
    k = 1 - smooth(lt, handsDown(p), handsDown(p) + 0.35);
  }
  // after the light dies: they turn their backs and drift off
  const tt = 6.25 + hash(p.i * 1.91) * 0.35;
  let x = p.x;
  let a = 1;
  let back = false;
  if (lt > tt) {
    back = true;
    const dir = hash(p.i * 4.7) < 0.5 ? -1 : 1;
    x += dir * 70 * smooth(lt, tt, tt + 0.6);
    a = 1 - smooth(lt, tt + 0.1, tt + 0.55);
    turn = 0;
    head = 0;
    k = 0;
  }
  if (a <= 0.01) return;
  onlooker(ctx, x, p.g, p.s, clapT, {
    mode: 'clap', k, ph: p.orig ? (p.i * 0.37) % 1 : hash(p.i), turn, head,
    id: p.orig ? 60 + p.i : p.i, alpha: a * dim, back,
  });
}

// ------------------------------------------------------------- him
const AKIMBO = { aA1: 0.8, aA2: -2.1, aB1: 0.8, aB2: -2.1 };
const HANG = { aA1: 0.1, aA2: 0.06, aB1: 0.1, aB2: 0.06 };

function boyFront(lt) {
  // growth jump-cuts: each size is a later moment of his life
  if (lt < CUTS[0]) {
    const rise = 8 * (1 - smooth(lt, 0.08, 0.32));
    return [pose({ x: STAGE.cx, y: standY(FL, 0.6) - rise, s: 0.6, view: 'front', ...AKIMBO, turn: 0, look: -0.45, head: -0.08, lA1: 0.06, lB1: 0.06 }), 1];
  }
  if (lt < CUTS[1]) {
    const u = lt - CUTS[0];
    return [pose({ x: STAGE.cx, y: standY(FL, 0.75), s: 0.75, view: 'front', ...HANG, turn: lerp(-0.5, -0.2, smooth(u, 0, 0.35)), look: -0.2, lA1: 0.07, lB1: 0.07 }), 0.75];
  }
  if (lt < CUTS[2]) {
    const u = lt - CUTS[1];
    return [pose({ x: STAGE.cx, y: standY(FL, 0.9), s: 0.9, view: 'front', aA1: 0.24, aA2: -0.42, aB1: 0.24, aB2: -0.42, turn: lerp(0.45, 0.25, smooth(u, 0, 0.35)), look: 0, head: 0.04, lA1: 0.09, lB1: 0.09 }), 0.3];
  }
  // full grown, the light starts to slide away to the right; he watches it go
  const s = 1.05;
  const follow = smooth(lt, 1.55, 2.0);
  const turn = lerp(lerp(-0.3, 0, smooth(lt, 1.25, 1.5)), 0.9, follow);
  const mouth = keys(lt, [[1.2, 0.2], [1.6, 0.2], [2.0, -0.25]]);
  const lean = 0.05 * follow;
  // his hand lifts after it, a little, as it goes
  const reachK = smooth(lt, 1.75, 2.12, ease.out);
  return [pose({
    x: STAGE.cx, y: standY(FL, s), s, view: 'front', ...HANG,
    aB1: 0.1 + 0.12 * follow + 0.75 * reachK, aB2: 0.06 + 0.25 * reachK,
    turn, look: lerp(-0.3, 0, follow), head: 0.06 * follow, lean: lean + 0.03 * reachK, lA1: 0.1, lB1: 0.1 + 0.05 * reachK,
  }), mouth];
}

function boySide(lt) {
  const s = 1.05;
  const x = boyX(lt);
  const v = speed(lt);
  const run = clamp(Math.abs(v) / 420);
  // each run starts and ends on a stride (legs apart, both nearly straight):
  // the cycle is stretched a little per run so the count comes out right
  let u = 0.25;
  for (const r of RUNS) {
    if (lt < r.t0) break;
    const n = Math.max(0.5, Math.round((r.x1 - r.x0) / (330 * s) - 0.5) + 0.5);
    u = 0.25 + ((x - r.x0) / (r.x1 - r.x0)) * n;
  }
  const rl = runLegs(u);
  // standing between runs: face up into the light (only while it's on him)
  const lx = lightX(lt);
  const inLight = clamp(1 - Math.abs(lx - x) / 50) * (1 - run) * spotK(lt);
  const stand = {
    lA1: 0.08, lA2: -0.02, lB1: -0.06, lB2: 0,
    aA1: 0.1 + 0.12 * inLight, aA2: 0.12 + 0.1 * inLight, aB1: -0.05 - 0.1 * inLight, aB2: 0.12,
  };
  const runP = { ...rl };
  const p = pose({ x, s, f: 1, ...mixPose(stand, runP, run) });
  // braking: he leans back and his arms swing forward as he pulls up
  const acc = (speed(lt + 0.03) - speed(lt - 0.03)) / 0.06;
  const brake = clamp(-acc / 2600) * clamp(Math.abs(v) / 120);
  p.lean = 0.03 + 0.27 * run - 0.22 * brake;
  p.aA1 += 0.5 * brake;
  p.aB1 += 0.35 * brake;
  p.head = -0.2 * run - 0.34 * inLight;
  p.look = -0.3 * run - 0.85 * inLight;
  const bob = 6 * s * run * Math.max(0, Math.sin(u * TAU * 2 - 0.6));
  p.y = FL - footDrop(p, s) - bob;
  // after the light dies: he stands in the dark, head drops a little
  if (lt > 6.4) {
    const d = smooth(lt, 6.45, 6.95);
    p.head = lerp(p.head, 0.22, d);
    p.look = lerp(p.look, 0.5, d);
  }
  const mouth = 0.7 * inLight - 0.15 * run;
  return [p, mouth];
}

// ------------------------------------------------------------- crossroads
// A clearing on a plain; paths wind out of it in every direction and thin
// away toward the horizon (their width shrinks with depth).
const XR = { hz: 430, j: [960, 722], s: 0.8, rx: 210, ry: 60, him: [890, 740], post: [1102, 730] };
const PATHS = [
  { th: 97, C: [925, 880], F: [880, 1000], h0: 46 }, // the way he came, toward us
  { th: 181, C: [440, 705], F: [-760, 630], h0: 15 },
  { th: 234, C: [620, 560], F: [330, 433], h0: 26 },
  { th: 276, C: [1000, 540], F: [1230, 432], h0: 27 },
  { th: 359, C: [1560, 705], F: [2800, 615], h0: 15 },
];
const ell = (a) => [XR.j[0] + XR.rx * Math.cos(a), XR.j[1] + XR.ry * Math.sin(a)];
const ellAng = (q) => Math.atan2((q[1] - XR.j[1]) / XR.ry, (q[0] - XR.j[0]) / XR.rx);

const XR_GEOM = (() => {
  const halfW = (y, h0) => h0 * Math.max(0.03, (y - XR.hz) / (XR.j[1] - XR.hz));
  const edges = [];
  const mouths = [];
  for (const P of PATHS) {
    const th = (P.th * Math.PI) / 180;
    const M = ell(th);
    const N = 26;
    const pts = [];
    for (let k = 0; k <= N; k++) {
      const t = k / N;
      const a = (1 - t) * (1 - t);
      const b = 2 * (1 - t) * t;
      const c = t * t;
      pts.push([a * M[0] + b * P.C[0] + c * P.F[0], a * M[1] + b * P.C[1] + c * P.F[1]]);
    }
    const L = [];
    const R = [];
    pts.forEach((q, k) => {
      const q0 = pts[Math.max(0, k - 1)];
      const q1 = pts[Math.min(N, k + 1)];
      let tx = q1[0] - q0[0];
      let ty = q1[1] - q0[1];
      const l = Math.hypot(tx, ty) || 1;
      tx /= l;
      ty /= l;
      const h = halfW(q[1], P.h0);
      L.push([q[0] - ty * h, q[1] + tx * h]);
      R.push([q[0] + ty * h, q[1] - tx * h]);
    });
    // the near path stops above the subtitles
    const cut = (arr) => (P.th < 135 && P.th > 45 ? arr.filter((q) => q[1] < 960) : arr);
    edges.push(cut(L), cut(R));
    // mouth angles, unwrapped around th
    const un = (a) => th + Math.atan2(Math.sin(a - th), Math.cos(a - th));
    const m = [un(ellAng(L[0])), un(ellAng(R[0]))].sort((x, y) => x - y);
    mouths.push({ th, lo: m[0], hi: m[1] });
  }
  // the clearing's rim between neighbouring path mouths
  mouths.sort((a, b) => a.th - b.th);
  const rims = [];
  for (let i = 0; i < mouths.length; i++) {
    const a0 = mouths[i].hi;
    let a1 = mouths[(i + 1) % mouths.length].lo;
    while (a1 < a0) a1 += 2 * Math.PI;
    const n = Math.max(4, Math.ceil((a1 - a0) * 10));
    const pts = [];
    for (let k = 0; k <= n; k++) pts.push(ell(lerp(a0, a1, k / n)));
    rims.push(pts);
  }
  return { edges, rims };
})();

function crossroads(ctx) {
  path(ctx, [[-1600, XR.hz], [3600, XR.hz]], { w: 2.2, color: COL.inkSoft, seed: 9300, wobble: 0.5 });
  XR_GEOM.edges.forEach((e, i) => {
    // the way he came fades out toward us (keeps the subtitle band calm)
    const near = e[e.length - 1][1] > XR.j[1];
    if (!near) return path(ctx, e, { w: 3.2, seed: 9310 + i, wobble: 0.8 });
    const n = e.length;
    for (let k = 0; k < n - 1; k += 2) {
      const y = e[k][1];
      const a = 1 - prog(y, 790, 950);
      if (a > 0.02) path(ctx, e.slice(k, Math.min(n, k + 3)), { w: 3.2, alpha: a, seed: 9310 + i * 40 + k, wobble: 0.6 });
    }
  });
  XR_GEOM.rims.forEach((e, i) => path(ctx, e, { w: 3, seed: 9330 + i, wobble: 0.6 }));
  // a few pencil tufts on the plain
  const T = [[330, 640], [1610, 610], [1390, 820], [560, 850], [140, 520], [1820, 505], [760, 470], [1240, 470], [-180, 700], [2140, 720]];
  T.forEach(([x, y], i) => {
    const sc = 0.45 + (y - XR.hz) / 520;
    path(ctx, [[x - 9 * sc, y - 10 * sc], [x - 2 * sc, y], [x + 2 * sc, y - 13 * sc], [x + 5 * sc, y], [x + 11 * sc, y - 8 * sc]], { w: 2, color: COL.inkSoft, seed: 9360 + i, wobble: 0.3 });
  });
}

function signpost(ctx, x, base) {
  const top = base - 268;
  path(ctx, [[x, base], [x + 1, top]], { w: 4.6, seed: 9400 });
  // three blank arms, pointing three ways, each a little askew
  const arm = (y, dir, len, rot, sd) => {
    const c = Math.cos(rot);
    const sn = Math.sin(rot);
    const P = (u, v) => [x + u * c - v * sn, y + u * sn + v * c];
    const h = 14;
    const u0 = -dir * 12;
    const u1 = dir * len;
    path(ctx, [P(u0, -h), P(u1, -h), P(u1 + dir * 20, 0), P(u1, h), P(u0, h)], { w: 3.4, close: true, fill: COL.paper, seed: sd, wobble: 0.35 });
    dot(ctx, x, y, 3.2);
  };
  arm(top + 34, -1, 108, 0.04, 9401);
  arm(top + 76, 1, 100, -0.07, 9402);
  arm(top + 118, -1, 86, -0.12, 9403);
  // the cap
  path(ctx, [[x - 7, top - 2], [x + 8, top - 2]], { w: 4, seed: 9404, wobble: 0.2 });
}

function boyCross(lt) {
  const s = XR.s;
  const turn = keys(lt, [[7.85, 0], [8.0, 0], [8.35, -0.95], [8.6, -0.95], [9.0, 0.95], [9.2, 0.95], [9.55, 0.05]]);
  const head = keys(lt, [[7.85, 0], [8.0, 0], [8.35, -0.1], [8.6, -0.1], [9.0, 0.1], [9.2, 0.1], [9.55, 0.06]]);
  const lean = keys(lt, [[8.0, 0], [8.35, -0.025], [8.6, -0.025], [9.0, 0.025], [9.2, 0.025], [9.55, 0]]);
  const look = keys(lt, [[9.2, 0], [9.6, 0.4]]);
  return pose({ x: XR.him[0], y: standY(XR.him[1], s), s, view: 'front', ...HANG, turn, head, lean, look, lA1: 0.07, lB1: 0.07 });
}

// ------------------------------------------------------------- camera
function followTarget(lt) {
  return 0.5 * (boyX(lt) + lightX(lt)) + 60;
}
// shot A (growth, the light slides off): from s01's camera, ease back
// and right so the light's new place is in frame
function camA(lt) {
  const m = smooth(lt, 1.45, 2.25);
  return { x: lerp(STAGE.cam.x, 1250, m), y: lerp(STAGE.cam.y, 600, m), z: lerp(STAGE.cam.z, 1.3, m) };
}
// shot B (the chase, from the cut at 2.2): side tracking, a box-filtered
// follow (a pure function of time), starting tight and easing wider
function camB(lt) {
  let x = 0;
  const N = 14;
  for (let i = 0; i < N; i++) x += followTarget(lt - (i / (N - 1)) * 0.5);
  x /= N;
  const w = smooth(lt, 2.2, 3.4);
  return { x: lerp(1180, x, w), y: lerp(585, 575, w), z: lerp(1.55, 1.36, w) };
}

// ------------------------------------------------------------- draw
export default {
  fadeIn: 0,
  fadeOut: 0, // s03 dissolves in from this scene's last frame itself
  draw(ctx, lt) {
    if (lt < 7.0) {
      const shotA = lt < 2.2;
      const cam = shotA ? camA(lt) : camB(lt);
      const lx = lightX(lt);
      const k = spotK(lt);
      const clapT = clapClock(lt);
      const half = 960 / cam.z + 120;
      camera(ctx, cam, () => {
        // the same floor line as s01
        path(ctx, [[-200, FL], [3800, FL]], { w: 3.4, seed: 900, wobble: 0.6 });
        const vis = (p) => Math.abs(p.x - cam.x) < half;
        // back row, him, front row (the front row is out of the chase shot)
        // in the chase shot the crowd sits back in the dark a little
        const dim = shotA ? 1 : 0.8;
        for (const p of PEOPLE) if (p.g < FL && vis(p)) drawPerson(ctx, p, lt, lx, clapT, dim);
        const [p, mouth] = shotA ? boyFront(lt) : boySide(lt);
        figure(ctx, p, { id: 1, cowlick: true, mouth });
        if (shotA) for (const p of PEOPLE) if (p.g >= FL && vis(p)) drawPerson(ctx, p, lt, lx, clapT);

        const dark = lt < 6.4 ? STAGE.dark - 0.12 * flash(lt) : lerp(STAGE.dark, 1, smooth(lt, 6.5, 6.95));
        // a broad, faint wash over the stage once the light starts to travel,
        // so he reads when he is out of it (gone with the light)
        const wash = { type: 'glow', x: cam.x, y: FL - 160, r: 1150, k: 0.24 * smooth(lt, 1.4, 2.0) * k };
        stage(ctx, [...stageLights(k, { fx: lx, sx: lightSX(lt, lx) }), wash], { dark });
      });
    } else {
      // the crossroads: a dim grey light comes up on him; then a slow pull
      // back to a wide shot: many roads, a blank signpost, and him, small
      const pull = smooth(lt, 8.6, 10.3, ease.inOut);
      const z = lerp(1.55, 0.8, pull);
      const cy = lerp(560, 610, pull);
      const cx = lerp(1000, 975, pull);
      camera(ctx, { x: cx, y: cy, z }, () => {
        crossroads(ctx);
        signpost(ctx, XR.post[0], XR.post[1]);
        figure(ctx, boyCross(lt), { id: 1, cowlick: true, mouth: -0.1 });
        const up = smooth(lt, 7.05, 8.0, ease.sine);
        stage(ctx, [{ type: 'glow', x: 980, y: 650, r: 1250, k: 0.3 * up }], { dark: lerp(1, 0.72, up) });
      });
    }
  },
};
