// s02 · 9–19 · 后来，灯走了，我就追。/ 人散了，我不知道自己在哪。
// Starts on exactly s01's last frame. He grows in three jump-cuts while the
// light stays child-sized: from the first cut it only lights a column as high
// as the child was, so his head and chest grow out of it into the dark. He
// crouches to get back in, gives up. The light slides off; he runs after it
// (side view); each time he arrives it jumps again, faster. The audience's
// heads follow the light, not him. The light blinks out; the house lights
// come up dim and the crowd turns its back and walks off, one by one, leaving
// him alone. Black. A dim grey light finds him at a strange crossroads.
import { COL, TAU, clamp, lerp, prog, smooth, keys, ease, hash, camera, path, dot } from '../lib.js';
import { figure, pose, mixPose, standY, walk, walkPhase } from '../figure.js';
import { stage } from '../light.js';
import { STAGE, AUDIENCE, stageLights, person, gaze, AKIMBO } from './s01.js';

const FL = STAGE.floor;
const T0 = 9; // global start: the audience's clap clock continues s01's

// ------------------------------------------------------------- the light
// [t0, t1, x0, x1, ease]: the first one slides off (a follow-spot sweep,
// dimmed while it travels), the rest are hard one-frame jumps, so the beam
// never paints anybody else on its way
const STOPS = [960, 1780, 2130, 2460, 2770];
const STEP = (k) => (k > 0 ? 1 : 0);
const SLIDE = [1.6, 2.2];
const MOVES = [
  [SLIDE[0], SLIDE[1], STOPS[0], STOPS[1], ease.inOut],
  [3.6, 3.601, STOPS[1], STOPS[2], STEP],
  [4.55, 4.551, STOPS[2], STOPS[3], STEP],
  [5.22, 5.221, STOPS[3], STOPS[4], STEP],
];
function lightX(lt) {
  let x = 960;
  for (const [a, b, x0, x1, e] of MOVES) if (lt >= a) x = lerp(x0, x1, e(prog(lt, a, b)));
  return x;
}
// the beam leans a little once it starts to travel (a follow-spot)
const lightSX = (lt, lx) => lx - 150 * smooth(lt, SLIDE[0], SLIDE[1]);
// while it slides it dims (a sweeping follow-spot), full again on arrival
const sweepK = (lt) => 1 - 0.55 * smooth(lt, SLIDE[0], SLIDE[0] + 0.15) * (1 - smooth(lt, SLIDE[1] - 0.22, SLIDE[1]));
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
const CUTS = [0.35, 0.7, 1.05];
const flash = (lt) => CUTS.reduce((m, c) => Math.max(m, lt >= c ? 1 - prog(lt, c, c + 0.1) : 0), 0);

// The light stays child-sized: from the first growth cut the lit volume is a
// column as high as the child (s01) was; above it the beam is a faint haze.
// (A stack of nested polys from the floor up gives a soft top edge.)
const COL_TOP = [FL - 222, FL - 166]; // dark above [0], full below [1]
const columnK = (lt) => (lt < CUTS[0] ? 0 : 1 - smooth(lt, SLIDE[0] + 0.05, SLIDE[0] + 0.45));
function beamAt(L, y) {
  const t = (y - L.sy) / (L.fy - L.sy);
  return [lerp(L.sx - L.rx * 0.12, L.fx - L.rx * 0.98, t), lerp(L.sx + L.rx * 0.12, L.fx + L.rx * 0.98, t)];
}
function shotALights(lt, lx, k) {
  const ks = k * sweepK(lt);
  const [spot, spill] = stageLights(ks, { fx: lx, sx: lightSX(lt, lx) });
  const kc = columnK(lt);
  if (kc <= 0) return [spot, spill];
  spot.k = ks * lerp(1, 0.26, kc);
  const out = [spot, spill];
  const N = 14;
  const kk = 1 - Math.pow(1 - 0.8 * kc * ks, 1 / N);
  for (let i = 0; i < N; i++) {
    const y = lerp(COL_TOP[0], COL_TOP[1], (i + 0.5) / N);
    const [a, b] = beamAt(spot, y);
    out.push({ type: 'poly', pts: [[a, y], [b, y], [spot.fx + spot.rx * 0.98, FL], [spot.fx - spot.rx * 0.98, FL]], k: kk });
  }
  out.push({ type: 'pool', x: spot.fx, y: FL, rx: spot.rx, ry: spot.ry, k: 0.85 * kc * ks });
  return out;
}
// the column's visible haze (stage() only draws haze for spots)
function columnHaze(ctx, lt, lx, k) {
  const kc = columnK(lt) * k * sweepK(lt);
  if (kc <= 0.01) return;
  const L = { sx: lightSX(lt, lx), sy: STAGE.src[1], fx: lx, fy: FL, rx: STAGE.pool.rx };
  const [a0, b0] = beamAt(L, COL_TOP[0]);
  const g = ctx.createLinearGradient(0, COL_TOP[0], 0, FL);
  g.addColorStop(0, 'rgba(255,250,235,0)');
  g.addColorStop((COL_TOP[1] - COL_TOP[0]) / (FL - COL_TOP[0]), `rgba(255,250,235,${0.05 * kc})`);
  g.addColorStop(1, `rgba(255,250,235,${0.02 * kc})`);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(a0, COL_TOP[0]);
  ctx.lineTo(b0, COL_TOP[0]);
  ctx.lineTo(lx + L.rx * 0.98, FL);
  ctx.lineTo(lx - L.rx * 0.98, FL);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

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
  { t0: 2.1, t1: 3.35, x0: 960, x1: 1780, ra: 0.25, rd: 0.3 },
  { t0: 3.7, t1: 4.35, x0: 1780, x1: 2130, ra: 0.25, rd: 0.3 },
  { t0: 4.62, t1: 5.12, x0: 2130, x1: 2460, ra: 0.22, rd: 0.3 },
  { t0: 5.3, t1: 6.38, x0: 2460, x1: 2652, ra: 0.2, rd: 0.34 },
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
    return [th, -(0.32 + 1.2 * tuck)];
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
// first): a back row only, with gaps where the light will stop (wide enough
// for the slanted beam, so it never lights one of them).
const EXTRA = (() => {
  const out = [];
  let i = 0;
  for (let x = 1600; x < 3600; x += 116) {
    const xx = x + (hash(i * 7.1) - 0.5) * 30;
    const hit = STOPS.some((sx) => xx - sx > -165 && xx - sx < 85);
    if (!hit) out.push({ x: xx, g: 728 + (hash(i * 2.9) - 0.5) * 8, s: 0.8 * (0.94 + 0.12 * hash(i * 3.3)), i: 100 + i });
    i++;
  }
  // two more just behind where he ends up (they leave to the left)
  for (const [x, n] of [[2283, 40], [2588, 41]]) out.push({ x, g: 728, s: 0.8 * (0.94 + 0.12 * hash(n * 3.3)), i: 100 + n });
  return out;
})();
const PEOPLE = [...AUDIENCE.map((p) => ({ ...p, orig: true })), ...EXTRA];
// In the chase shot the crowd stands further back, up on a tier: their heads
// sit well above his, and they're dimmer, so his ink always wins.
const TIER = 642;
const TIER_S = 0.92;
const TIER_A = 0.5;
// where he stops the last time; the crowd leaves nearest-first from there
const LAST_X = 2652;
const LEAVE = new Map(PEOPLE.filter((p) => p.g < FL).sort((a, b) => Math.abs(a.x - LAST_X) - Math.abs(b.x - LAST_X)).map((p, n) => [p, n]));

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

function drawPerson(ctx, p, lt, lx, clapT, shotB) {
  const g = shotB ? TIER : p.g;
  const s = shotB ? p.s * TIER_S : p.s;
  const id = p.orig ? 60 + p.i : p.i;
  const a = shotB ? TIER_A : 1;
  // heads (and bodies) follow the light
  const dx = clamp((lx - p.x) / 260, -1, 1);
  let turn = dx * 0.95;
  let head = dx * 0.15;
  let lean = dx * 0.05;
  let k = 0;
  if (p.orig) {
    const g0 = gaze(p);
    const m = smooth(lt, 0.2, 0.7);
    turn = lerp(g0.turn, turn, m);
    head = lerp(g0.head, head, m);
    lean = lerp(g0.lean, lean, m);
    k = 1 - smooth(lt, handsDown(p), handsDown(p) + 0.35);
  }
  // after the light dies (the house lights come up): one by one, nearest
  // first, they turn their backs, then walk off away from him
  const tt = 6.3 + (LEAVE.get(p) ?? 99) * 0.07;
  if (shotB && lt > tt) {
    const tau = lt - tt - 0.16;
    if (tau < 0) {
      person(ctx, p.x, g, s, clapT, { back: true, turn: p.x < LAST_X ? -0.5 : 0.5, id, alpha: a });
      return;
    }
    const dir = p.x < LAST_X ? -1 : 1;
    const v = 300 + 80 * hash(p.i * 3.1);
    const d = tau < 0.25 ? (v * tau * tau) / 0.5 : v * (tau - 0.125);
    const w = walk(walkPhase(d, s) + hash(p.i * 1.7) * 0.5, g, s, 0.9);
    // they walk off into the dark
    const fa = 1 - prog(d, 100, 360);
    if (fa > 0.01) figure(ctx, pose({ x: p.x + dir * d, s, f: dir, ...w, lean: 0.08 }), { id, alpha: a * fa });
    return;
  }
  person(ctx, p.x, g, s, clapT, { k, ph: p.orig ? (p.i * 0.37) % 1 : hash(p.i), turn, head, lean, id, alpha: a });
}

// A paper-coloured halo drawn under him, so line art behind him breaks
// around his body instead of running through it.
function knockout(ctx, p) {
  const w = Math.max(2, 4.6 * Math.pow(p.s, 0.85));
  figure(ctx, p, { id: 1, cowlick: true, color: COL.paper, w: w * 3.2, wobble: 0, eye: 'none' });
}

// ------------------------------------------------------------- him
const HANG = { aA1: 0.1, aA2: 0.06, aB1: 0.1, aB2: 0.06 };

// front-view hip height that puts both feet on the floor
const frontY = (s, a1, a2) => FL - (Math.cos(a1) * 58 + Math.cos(a1 + a2) * 56) * s;

function boyFront(lt) {
  // growth jump-cuts: each size is a later moment of his life
  if (lt < CUTS[0]) {
    return [pose({ x: STAGE.cx, y: standY(FL, 0.6), s: 0.6, view: 'front', ...AKIMBO, turn: 0, look: -0.45, head: -0.08, lA1: 0.06, lB1: 0.06 }), 1];
  }
  if (lt < CUTS[1]) {
    // his head at the top of the light
    const u = lt - CUTS[0];
    return [pose({ x: STAGE.cx, y: standY(FL, 0.75), s: 0.75, view: 'front', ...HANG, turn: lerp(-0.5, -0.2, smooth(u, 0, 0.3)), look: lerp(-0.2, -0.45, smooth(u, 0.1, 0.3)), lA1: 0.07, lB1: 0.07 }), 0.75];
  }
  if (lt < CUTS[2]) {
    // his head is out of it: he looks up at where it stops
    const u = lt - CUTS[1];
    return [pose({ x: STAGE.cx, y: standY(FL, 0.9), s: 0.9, view: 'front', aA1: 0.24, aA2: -0.42, aB1: 0.24, aB2: -0.42, turn: lerp(0.45, 0.1, smooth(u, 0, 0.25)), look: lerp(0, -0.75, smooth(u, 0.06, 0.25)), head: 0.04, lA1: 0.09, lB1: 0.09 }), 0.3];
  }
  // Full grown: only his legs are lit. He crouches, knees out, to get his
  // head back into the light; it barely reaches his face; he gives up and
  // straightens. Then the light slides away to the right; he watches it go.
  const s = 1.05;
  const sq = smooth(lt, 1.12, 1.32) * (1 - smooth(lt, 1.46, 1.66));
  const lA1 = lerp(0.1, 0.85, sq);
  const lA2 = lerp(0, -1.7, sq);
  const follow = smooth(lt, 1.68, 2.05);
  const turn = lerp(lerp(-0.25, 0, smooth(lt, 1.05, 1.2)), 0.9, follow);
  const look = lerp(keys(lt, [[1.05, -0.3], [1.14, -0.85], [1.44, -0.85], [1.62, 0.4]]), 0, follow);
  const mouth = keys(lt, [[1.05, 0.2], [1.15, 0], [1.44, 0.05], [1.62, -0.4], [2.05, -0.3]]);
  const lean = 0.05 * follow;
  // his hand lifts after it, a little, as it goes
  const reachK = smooth(lt, 1.85, 2.2, ease.out);
  const lB1 = lA1 + 0.05 * reachK;
  return [pose({
    x: STAGE.cx, y: Math.max(frontY(s, lA1, lA2), frontY(s, lB1, lA2)), s, view: 'front', ...HANG,
    aA1: 0.1 + 0.3 * sq, aA2: 0.06 + 0.2 * sq,
    aB1: 0.1 + 0.3 * sq + 0.12 * follow + 0.75 * reachK, aB2: 0.06 + 0.2 * sq + 0.25 * reachK,
    turn, look, head: 0.06 * follow + 0.04 * sq, lean: lean + 0.03 * reachK, lA1, lA2, lB1, lB2: lA2,
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
  // lean into the run early (no upright 'sitting in the air' mid-stride)
  p.lean = 0.03 + 0.27 * Math.sqrt(run) - 0.22 * brake;
  p.aA1 += 0.5 * brake;
  p.aB1 += 0.35 * brake;
  p.head = -0.2 * run - 0.34 * inLight;
  p.look = -0.3 * run - 0.85 * inLight;
  const bob = 6 * s * run * Math.max(0, Math.sin(u * TAU * 2 - 0.6));
  p.y = FL - footDrop(p, s) - bob;
  // after the light dies: he looks up at where it was; the people leave —
  // he watches the ones ahead go, then the face comes round to the ones
  // behind him; his head drops
  if (lt > 6.3) {
    p.head = keys(lt, [[6.3, p.head], [6.45, -0.3], [6.62, -0.3], [6.82, 0], [7.3, 0.05], [7.55, 0.26]]);
    p.look = keys(lt, [[6.3, p.look], [6.45, -0.85], [6.62, -0.85], [6.82, 0], [7.3, 0.1], [7.55, 0.6]]);
    p.turn = keys(lt, [[6.84, 0], [7.02, 0.8], [7.3, 0.8], [7.55, 0.3]]);
  }
  const mouth = lt > 6.3 ? keys(lt, [[6.3, 0], [6.85, -0.4]]) : 0.7 * inLight - 0.15 * run;
  return [p, mouth];
}

// ------------------------------------------------------------- crossroads
// A clearing on a plain; paths wind out of it in every direction and thin
// away toward the horizon (their width shrinks with depth).
const XR = { hz: 430, j: [960, 722], s: 0.8, rx: 210, ry: 60, him: [890, 740], post: [1200, 756] };
const PATHS = [
  { th: 97, C: [925, 880], F: [880, 1000], h0: 46 }, // the way he came, toward us
  { th: 181, C: [440, 705], F: [-760, 630], h0: 15 },
  { th: 234, C: [620, 560], F: [330, 433], h0: 26 },
  { th: 280, C: [1020, 540], F: [1060, 432], h0: 27 },
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
    // mouth angles, unwrapped around th
    const un = (a) => th + Math.atan2(Math.sin(a - th), Math.cos(a - th));
    const aL = un(ellAng(L[0]));
    const aR = un(ellAng(R[0]));
    // each edge starts on the rim, so the mouths close
    L.unshift(ell(aL));
    R.unshift(ell(aR));
    // the near path stops below the frame (it fades out by screen y)
    const cut = (arr) => (P.th < 135 && P.th > 45 ? arr.filter((q) => q[1] < 1000) : arr);
    edges.push(cut(L), cut(R));
    const m = [aL, aR].sort((x, y) => x - y);
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

function crossroads(ctx, cam) {
  path(ctx, [[-1600, XR.hz], [3600, XR.hz]], { w: 2.2, color: COL.inkSoft, seed: 9300, wobble: 0.5 });
  // the way he came fades out toward us, by SCREEN y, so it is gone above
  // the subtitle band at every zoom (one stroke, a gradient: no dashes)
  const y0 = cam.y + (800 - 540) / cam.z;
  const y1 = cam.y + (885 - 540) / cam.z;
  const fade = ctx.createLinearGradient(0, y0, 0, y1);
  fade.addColorStop(0, COL.ink);
  fade.addColorStop(1, 'rgba(31,28,25,0)');
  XR_GEOM.edges.forEach((e, i) => {
    const near = e[e.length - 1][1] > XR.j[1];
    if (!near) return path(ctx, e, { w: 3.2, seed: 9310 + i, wobble: 0.8 });
    const pts = e.filter((q) => q[1] < y1 + 20);
    path(ctx, pts, { w: 3.2, color: fade, seed: 9310 + i, wobble: 0.6 });
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

// the crossroads comes up after the crowd has gone (XR_T)
const XR_T = 7.7;
function boyCross(lt) {
  const s = XR.s;
  const turn = keys(lt, [[8.3, 0], [8.42, 0], [8.72, -0.95], [8.92, -0.95], [9.27, 0.95], [9.42, 0.95], [9.72, 0.05]]);
  const head = keys(lt, [[8.3, 0], [8.42, 0], [8.72, -0.1], [8.92, -0.1], [9.27, 0.1], [9.42, 0.1], [9.72, 0.06]]);
  const lean = keys(lt, [[8.42, 0], [8.72, -0.025], [8.92, -0.025], [9.27, 0.025], [9.42, 0.025], [9.72, 0]]);
  const look = keys(lt, [[9.42, 0], [9.8, 0.4]]);
  return pose({ x: XR.him[0], y: standY(XR.him[1], s), s, view: 'front', ...HANG, turn, head, lean, look, lA1: 0.07, lB1: 0.07 });
}

// ------------------------------------------------------------- camera
function followTarget(lt) {
  // once the light is gone, the shot settles on him alone in the middle
  return lerp(0.5 * (boyX(lt) + lightX(lt)) + 60, boyX(lt), smooth(lt, 6.2, 6.9));
}
// shot A (growth, the light slides off): from s01's camera, ease back
// and right so the light's new place is in frame
const CUT_B = 2.2;
function camA(lt) {
  const m = smooth(lt, 1.55, 2.3);
  return { x: lerp(STAGE.cam.x, 1250, m), y: lerp(STAGE.cam.y, 600, m), z: lerp(STAGE.cam.z, 1.3, m) };
}
// shot B (the chase, from the cut at CUT_B): side tracking, a box-filtered
// follow (a pure function of time), starting tight and easing wider
function camB(lt) {
  let x = 0;
  const N = 14;
  for (let i = 0; i < N; i++) x += followTarget(lt - (i / (N - 1)) * 0.5);
  x /= N;
  const w = smooth(lt, CUT_B, 3.4);
  return { x: lerp(1180, x, w), y: lerp(585, 575, w), z: lerp(1.55, 1.36, w) };
}

// ------------------------------------------------------------- draw
export default {
  fadeIn: 0,
  fadeOut: 0, // s03 dissolves in from this scene's last frame itself
  draw(ctx, lt) {
    if (lt < XR_T) {
      const shotA = lt < CUT_B;
      const cam = shotA ? camA(lt) : camB(lt);
      const lx = lightX(lt);
      const k = spotK(lt);
      const clapT = clapClock(lt);
      const half = 960 / cam.z + 120;
      camera(ctx, cam, () => {
        const vis = (p) => Math.abs(p.x - cam.x) < half + (lt > 6.3 ? 500 : 0);
        // back row, him, front row (the front row is out of the chase shot)
        for (const p of PEOPLE) if (p.g < FL && vis(p)) drawPerson(ctx, p, lt, lx, clapT, !shotA);
        const [p, mouth] = shotA ? boyFront(lt) : boySide(lt);
        if (!shotA) knockout(ctx, p);
        // the same floor line as s01
        path(ctx, [[-200, FL], [3800, FL]], { w: 3.4, seed: 900, wobble: 0.6 });
        figure(ctx, p, { id: 1, cowlick: true, mouth });
        if (shotA) for (const p of PEOPLE) if (p.g >= FL && vis(p)) drawPerson(ctx, p, lt, lx, clapT, false);

        // after the spot dies the house lights come up, dim, while the crowd
        // leaves; then black
        const house = smooth(lt, 6.25, 6.5);
        const dark = lt < 6.25 ? STAGE.dark - 0.12 * flash(lt) : lerp(lerp(STAGE.dark, 0.8, house), 1, smooth(lt, XR_T - 0.3, XR_T, ease.sine));
        // a broad, faint wash over the stage once the light starts to travel,
        // so he reads when he is out of it
        const wash = { type: 'glow', x: cam.x, y: FL - 160, r: 1150, k: 0.24 * smooth(lt, 1.6, 2.1) * k + 0.2 * house };
        const lights = shotA ? shotALights(lt, lx, k) : stageLights(k, { fx: lx, sx: lightSX(lt, lx) });
        stage(ctx, [...lights, wash], { dark });
        if (shotA) columnHaze(ctx, lt, lx, k);
      });
    } else {
      // the crossroads: a dim grey light comes up on him; then a slow pull
      // back to a wide shot: many roads, a blank signpost, and him, small
      const pull = smooth(lt, 8.95, 10.4, ease.inOut);
      const z = lerp(1.55, 0.8, pull);
      const cy = lerp(560, 610, pull);
      const cx = lerp(1000, 975, pull);
      const cam = { x: cx, y: cy, z };
      camera(ctx, cam, () => {
        crossroads(ctx, cam);
        signpost(ctx, XR.post[0], XR.post[1]);
        const p = boyCross(lt);
        knockout(ctx, p);
        figure(ctx, p, { id: 1, cowlick: true, mouth: -0.2 });
        const up = smooth(lt, XR_T + 0.05, XR_T + 0.75, ease.sine);
        stage(ctx, [{ type: 'glow', x: 980, y: 650, r: 1250, k: 0.3 * up }], { dark: lerp(1, 0.72, up) });
      });
    }
  },
};
