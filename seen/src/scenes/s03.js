// s03 · 40–54 · 屏幕 — the screen
// Out of the empty dark theatre: his room at night, nearly black, a dim
// screen, him hunched at it. Insert: the cursor goes to 发布 and clicks —
// cut: the screen's light BANGS on (the film's spotlight motif, turned
// sideways): a beam from the screen across his face, the frame jolts, the
// number floats up in the dark and climbs. He flinches, looks up at it,
// smiles, leans in. Then post after post in quick cuts — the screen, his face
// over the lid lit from below, his profile, paper balls flung back onto a
// growing heap — the light flaring at every 发布 and every peak lower than
// the last. 可这束光，也暗了: one long push in on him while the beam shrinks
// and the number creeps, stops. He stares. POV: his hand folds the lid shut,
// the light narrows to a line and dies. Black (s04 opens in the black).
import { W, H, COL, TAU, clamp, lerp, prog, smooth, keys, ease, hash, noise1, camera, path, line, rect, circle, ellipse, fillPoly, dot, text, FONT } from '../lib.js';
import { figure, pose, joints, reach, SIT, SIT_LIFT } from '../figure.js';
import { stage } from '../light.js';
import { screenFront, paperBall, formatCount } from '../props.js';
import { ROOM, room, PILE } from '../room.js';

const T0 = 40;
const R = ROOM;
const S = R.s;
const TOP = R.floor - 150 * S; // table top
const SEAT = R.floor - 92 * S;
const KX = R.hingeX - 88 * S; // keyboard
const TABLE_L = R.tableX - 120 * S; // left end of the table top
const CTR = [1196, 404]; // where the number floats (room coordinates)

// ------------------------------------------------------------- the posts
// click: 发布 is clicked (in the insert); flare: the light jumps; the number
// climbs to peak by rise. Every peak lower than the last.
const POSTS = [
  { click: 41.3, flare: 41.45, thumb: 0, peak: 2846, rise: 43.9 },
  { click: 44.86, flare: 44.95, thumb: 1, peak: 1204, rise: 45.95 },
  { click: 46.04, flare: 46.12, thumb: 2, peak: 388, rise: 46.9 },
  { click: 46.98, flare: 47.05, thumb: 3, peak: 96, rise: 47.6 },
  { click: 47.62, flare: 47.7, thumb: 4, peak: 23, rise: 49.9 },
];
const BANG = POSTS[0].flare;

function postAt(t) {
  let p = null;
  for (const q of POSTS) if (t >= q.flare) p = q;
  return p;
}
// the number on show, and whether it is still climbing
function countAt(t) {
  const p = postAt(t);
  if (!p) return { n: 0, up: false };
  const u = prog(t, p.flare + 0.05, p.rise);
  // the first one rolls up in surges; the last one creeps and stops dead
  const k = p === POSTS[0] ? keys(u, [[0, 0], [0.18, 0.05], [0.3, 0.06], [0.5, 0.3], [0.58, 0.32], [0.8, 0.78], [1, 1]], ease.out) : p === POSTS[4] ? ease.out3(u) : ease.out(u);
  return { n: Math.round(p.peak * k), up: u < 1 };
}
// how much light the attention gives (0.3 for nothing, ~0.9 for thousands)
const att = (n) => 0.3 + 0.17 * Math.log10(1 + Math.max(0, n));

// The light of the screen at global t: dim before the first 发布; a jump at
// every 发布; it follows the number; 48.3–51.6 it dwindles.
function lightAt(t) {
  const p = postAt(t);
  if (!p) return 0.2;
  let L = att(countAt(t).n);
  L += 0.55 * Math.exp(-(t - p.flare) / 0.28) * att(p.peak);
  L *= lerp(1, 0.24, smooth(t, 48.3, 51.7, ease.inOut));
  return L;
}

// ------------------------------------------------------------- shots
// [start, kind, arg]
const SHOTS = [
  [40.0, 'wide'],
  [40.86, 'ins', 0],
  [BANG, 'bang'],
  [44.0, 'front'],
  [44.56, 'ins', 1],
  [45.02, 'side', 0],
  [45.5, 'profile'],
  [45.84, 'ins', 2],
  [46.14, 'front'],
  [46.48, 'side', 1],
  [46.8, 'ins', 3],
  [47.06, 'profile'],
  [47.3, 'side', 2],
  [47.5, 'ins', 4],
  [47.72, 'front'],
  [48.0, 'stare'],
  [52.0, 'pov'],
  [53.36, 'black'],
];

// the heap of paper behind him: [time, count] (between cuts it grows a lot)
const PILE_N = [[40, 3], [44.9, 8], [46.4, 15], [47.2, 23], [47.9, 29]];
// a throw in each side shot: [shot index, throw start, pile index it lands on]
const THROWS = [
  { t0: 44.92, dur: 0.62, i: 8 },
  { t0: 46.38, dur: 0.5, i: 15 },
  { t0: 47.18, dur: 0.42, i: 23 },
];
function pileAt(t) {
  let n = 0;
  for (const [tt, c] of PILE_N) if (t >= tt) n = c;
  for (const th of THROWS) if (t >= th.t0 + th.dur * 0.88 && n < th.i + 1) n = th.i + 1;
  return n;
}

// ------------------------------------------------------------- him
function seated(lean, head, look) {
  return pose({ ...SIT, x: R.stoolX + 4, y: SEAT - SIT_LIFT * S, s: S, f: 1, lean, head, look });
}
function hand(p, which, pt) {
  const r = reach(p, which, pt[0], pt[1]);
  p[`a${which}1`] = r.a1;
  p[`a${which}2`] = r.a2;
}
const KEY_A = [KX + 6, TOP - 8 * S];
const KEY_B = [KX + 22, TOP - 8 * S];

// his face and body through the scene
function mood(t) {
  const lean = keys(t, [[40, 0.22], [BANG, 0.22], [BANG + 0.12, -0.06], [42.2, 0.0], [43.4, 0.3], [44, 0.27], [48, 0.3], [49.6, 0.2], [51.3, 0.17], [52, 0.24]]);
  const head = keys(t, [[40, 0.14], [BANG, 0.14], [BANG + 0.12, -0.12], [42.1, -0.06], [42.45, -0.3], [43.0, -0.28], [43.5, 0.03], [48, 0.05], [48.7, -0.16], [52, -0.12]]);
  const look = keys(t, [[40, 0.45], [BANG, 0.45], [BANG + 0.12, 0], [42.1, -0.1], [42.45, -0.9], [43.0, -0.9], [43.5, 0.15], [48, 0.15], [48.7, -0.6], [52, -0.55]]);
  const mouth = keys(t, [[40, -0.1], [BANG, -0.1], [41.8, 0.2], [42.7, 1], [44.2, 1], [45.4, 0.65], [46.4, 0.25], [47.2, -0.05], [48, -0.2], [49.6, -0.5], [52, -0.55]]);
  const blink = (a) => t > a && t < a + 0.12;
  const eye = blink(BANG - 0.01) || blink(49.95) || blink(51.25) ? 'closed' : 'dot';
  // typing: on before the first 发布, still while the number climbs, then
  // frantic through the cuts, stopping when the light goes
  const type = keys(t, [[40, 0.6], [41.1, 0.6], [41.25, 0], [43.5, 0], [43.7, 1], [48.3, 1], [48.7, 0]]);
  return { lean, head, look, mouth, eye, type };
}

// the throw: the near hand comes off the keys, swings down past his hip and
// flicks a ball back behind him, underhand, without him looking (the arm
// stays clear of his head)
function throwHand(t, th, j) {
  const u = prog(t, th.t0, th.t0 + th.dur);
  if (u <= 0 || u >= 1) return null;
  const sh = j.shoulder;
  const P = keys(u, [[0, { x: KEY_A[0], y: KEY_A[1] }], [0.24, { x: sh[0] + 12, y: sh[1] + 78 }], [0.42, { x: sh[0] - 46, y: sh[1] + 52 }], [0.66, { x: sh[0] + 8, y: sh[1] + 70 }], [0.88, { x: KEY_A[0], y: KEY_A[1] }]]);
  return [P.x, P.y];
}
function ballAt(t, th, j) {
  const u = prog(t, th.t0, th.t0 + th.dur);
  if (u <= 0 || u >= 0.9) return null;
  if (u < 0.42) return throwHand(t, th, j);
  const sh = j.shoulder;
  const rel = [sh[0] - 46, sh[1] + 52];
  const b = PILE[th.i];
  const land = [R.pileX + b[0], R.floor - b[1] - 1];
  const f = prog(u, 0.42, 0.9);
  return [lerp(rel[0], land[0], f), lerp(rel[1], land[1], f) - Math.sin(f * Math.PI) * 120];
}

function himPose(t) {
  const m = mood(t);
  const p = seated(m.lean, m.head, m.look);
  const tA = Math.sin(t * 19) * 3.5 * m.type;
  const tB = Math.sin(t * 23 + 1) * 3.5 * m.type;
  // the stare: hands come off the keys to the table edge; then one goes out
  // for the lid
  const slide = smooth(t, 48.6, 49.3);
  hand(p, 'A', [lerp(KEY_A[0], 1012, slide), lerp(KEY_A[1], TOP - 6, slide) + tA]);
  hand(p, 'B', [lerp(KEY_B[0], 1000, slide), lerp(KEY_B[1], TOP - 4, slide) + tB]);
  const j = joints(p);
  for (const th of THROWS) {
    const h = throwHand(t, th, j);
    if (h) hand(p, 'A', h);
  }
  const rk = smooth(t, 51.35, 52.0, ease.inOut);
  if (rk > 0) {
    const lp = lidAt(1);
    const r = reach(p, 'A', lerp(1012, lp.lidEnd[0] - 4, rk), lerp(TOP - 6, lp.lidEnd[1] + 6, rk));
    p.aA1 = r.a1;
    p.aA2 = r.a2;
  }
  return { p, m };
}
// where the laptop's lid is (without drawing it)
// (the same numbers as props.laptop with f = 1)
function lidAt(open) {
  const L = 96 * S;
  const th = 6 * S;
  const a = clamp(open) * 1.86;
  return { hinge: [R.hingeX, TOP - th], lidEnd: [R.hingeX - Math.cos(a) * L, TOP - th - Math.sin(a) * L] };
}

// ------------------------------------------------------------- light
// The screen as a light: a beam fanning out from the lid toward him, fading
// with distance; it skims the table top and does not get under it. L:
// strength (also sets the reach).
function screenBeam(lp, L, lights) {
  const h = lp.hinge;
  const e = lp.lidEnd;
  const c = [(h[0] + e[0]) / 2, (h[1] + e[1]) / 2];
  let dx = e[0] - h[0];
  let dy = e[1] - h[1];
  const l = Math.hypot(dx, dy);
  dx /= l;
  dy /= l;
  const nx = dy; // the face's normal, toward him (left, a little up)
  const ny = -dx;
  const back = 56;
  const ax = c[0] - nx * back;
  const ay = c[1] - ny * back;
  const a0 = Math.atan2(ny, nx);
  const range = 170 + 560 * clamp(L, 0, 1.3);
  const k = clamp(L * 1.08);
  const P = (a, d) => {
    const x = ax + Math.cos(a) * d;
    let y = ay + Math.sin(a) * d;
    if (x > TABLE_L && y > TOP - 4) y = TOP - 4;
    if (y > R.floor + 30) y = R.floor + 30;
    return [x, y];
  };
  // the fan (down .. up), smooth falloff with distance: one radial gradient
  // clipped to it (see stageFan)
  const pts = [];
  const n = 24;
  for (let i = 0; i <= n; i++) pts.push(P(a0 - 0.56 + (0.9 * i) / n, back + range));
  for (let i = 4; i >= 0; i--) pts.push(P(a0 - 0.56 + (0.9 * i) / 4, back));
  lights.push({ type: 'fan', x: ax, y: ay, r0: back, r1: back + range, pts, k });
  lights.push({ type: 'glow', x: c[0] - 10, y: c[1], r: 80 + 90 * L, k: clamp(0.6 * L) });
}

// stage() (light.js) with one more kind of light: 'fan' — a radial falloff
// from (x, y), k at r0 fading as (1-f)^1.5 to 0 at r1, clipped to pts. (The
// fan drawn as flat bands showed steps.)
let shadeC = null;
function stageFan(ctx, lights, o = {}) {
  if (!shadeC) {
    shadeC = document.createElement('canvas');
    shadeC.width = W;
    shadeC.height = H;
  }
  const s = shadeC.getContext('2d');
  const m = ctx.getTransform();
  s.setTransform(1, 0, 0, 1, 0, 0);
  s.globalCompositeOperation = 'source-over';
  s.globalAlpha = 1;
  s.clearRect(0, 0, W, H);
  s.fillStyle = `rgba(14,13,12,${o.dark ?? 0.66})`;
  s.fillRect(0, 0, W, H);
  s.setTransform(m);
  s.globalCompositeOperation = 'destination-out';
  for (const Lt of lights) {
    const k = Lt.k ?? 1;
    if (k <= 0.001) continue;
    if (Lt.type === 'glow') {
      const g = s.createRadialGradient(Lt.x, Lt.y, 0, Lt.x, Lt.y, Lt.r);
      g.addColorStop(0, `rgba(0,0,0,${k})`);
      g.addColorStop(0.5, `rgba(0,0,0,${0.7 * k})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      s.fillStyle = g;
      s.fillRect(Lt.x - Lt.r, Lt.y - Lt.r, Lt.r * 2, Lt.r * 2);
    } else if (Lt.type === 'poly' || Lt.type === 'fan') {
      s.beginPath();
      s.moveTo(Lt.pts[0][0], Lt.pts[0][1]);
      for (let i = 1; i < Lt.pts.length; i++) s.lineTo(Lt.pts[i][0], Lt.pts[i][1]);
      s.closePath();
      if (Lt.type === 'poly') {
        s.fillStyle = `rgba(0,0,0,${k})`;
        s.fill();
      } else {
        const g = s.createRadialGradient(Lt.x, Lt.y, 0, Lt.x, Lt.y, Lt.r1);
        const u0 = Lt.r0 / Lt.r1;
        g.addColorStop(0, `rgba(0,0,0,${k})`);
        for (let i = 0; i <= 8; i++) {
          const f = i / 8;
          g.addColorStop(u0 + (1 - u0) * f, `rgba(0,0,0,${k * Math.pow(1 - f, 1.5)})`);
        }
        s.fillStyle = g;
        s.fill();
      }
    }
  }
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(shadeC, 0, 0);
  ctx.restore();
}
// faint moonlight through the window, so the room is there
function moonLights(lights, k = 1) {
  const wn = R.win;
  lights.push({ type: 'poly', pts: [[wn.x, wn.y], [wn.x + wn.w, wn.y], [wn.x + wn.w, wn.y + wn.h], [wn.x, wn.y + wn.h]], k: 0.13 * k });
  lights.push({ type: 'glow', x: wn.x + wn.w / 2, y: wn.y + wn.h / 2, r: 420, k: 0.12 * k });
}

const toScreen = (cam, x, y) => [W / 2 + (x - cam.x) * cam.z, H / 2 + (y - cam.y) * cam.z];

// the number, glowing in the dark (drawn after stage(), screen space)
function glowNumber(ctx, x, y, n, up, size, a) {
  if (a <= 0.01) return;
  const str = formatCount(n);
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.font = `${size}px ${FONT}`;
  const tw = ctx.measureText(str).width;
  ctx.shadowColor = 'rgba(255,248,230,0.6)';
  ctx.shadowBlur = size * 0.45;
  text(ctx, str, x, y, { size, color: '#f3ecdc', alpha: a, spacing: 2 });
  text(ctx, '播放', x - tw / 2 - size * 0.62, y + size * 0.08, { size: size * 0.38, color: '#f3ecdc', alpha: a * 0.7 });
  if (up) text(ctx, '▲', x + tw / 2 + size * 0.42, y, { size: size * 0.42, color: '#f3ecdc', alpha: a * 0.9 });
  ctx.restore();
}

// ------------------------------------------------------------- the room shots
// cam: {x, y, z}; o: {throw (index into THROWS)}
function roomShot(ctx, t, cam, o = {}) {
  const L = lightAt(t);
  const { p, m } = himPose(t);
  let lp;
  let ball = null;
  camera(ctx, cam, () => {
    const r = room(ctx, t, { moon: true, balls: pileAt(t), open: 1, glow: clamp(0.35 + L) });
    lp = r.lp;
    const j = figure(ctx, p, { id: 1, cowlick: true, mouth: m.mouth, eye: m.eye });
    for (const th of THROWS) {
      const b = ballAt(t, th, j);
      if (b) {
        paperBall(ctx, b[0], b[1], 14, th.i);
        ball = b;
      }
    }
    const lights = [];
    screenBeam(lp, L, lights);
    moonLights(lights);
    // the ball catches the light as it flies
    if (ball) lights.push({ type: 'glow', x: ball[0], y: ball[1], r: 44, k: 0.2 });
    stageFan(ctx, lights, { dark: 0.9 });
  });
  // the lit face of the screen, and the number in the dark
  const s0 = toScreen(cam, lp.hinge[0] - 3 * S, lp.hinge[1] - 4);
  const s1 = toScreen(cam, lp.lidEnd[0] - 3 * S, lp.lidEnd[1] + 4);
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = `rgba(255,250,236,${clamp(0.25 + 0.6 * L)})`;
  ctx.lineWidth = 4 * S * cam.z;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(...s0);
  ctx.lineTo(...s1);
  ctx.stroke();
  ctx.restore();
  const { n, up } = countAt(t);
  if (t >= BANG) {
    const c = toScreen(cam, CTR[0], CTR[1] + Math.sin(t * 2.1) * 3);
    glowNumber(ctx, c[0], c[1], n, up, 46 * cam.z, clamp(0.35 + 0.75 * L) * smooth(t, BANG + 0.15, BANG + 0.45));
  }
  return { L, lp };
}

// cameras
function wideCam(t) {
  const k = smooth(t, 39.6, 41.0, ease.sine);
  const z = lerp(1.0, 1.12, k);
  return { x: lerp(1000, 1030, k), y: R.floor - 300 / z, z };
}
function bangCam(t) {
  const k = smooth(t, BANG, 44.0, ease.out);
  const z = lerp(1.42, 1.78, k);
  return { x: lerp(1040, 1060, k), y: R.floor - 370 / z, z };
}
const SIDE_CAMS = [
  (u) => ({ x: lerp(930, 950, u), y: R.floor - 330 / 1.25, z: lerp(1.25, 1.3, u) }),
  (u) => ({ x: lerp(880, 900, u), y: R.floor - 300 / 1.55, z: 1.55 + 0.05 * u }),
  (u) => ({ x: 980, y: R.floor - 330 / 1.08, z: 1.08 + 0.04 * u }),
];
function profileCam(t, a) {
  const u = prog(t, a, a + 0.35);
  return { x: 1050 - 10 * u, y: 548, z: 3.0 + 0.15 * u };
}
function stareCam(t) {
  const k = smooth(t, 48.0, 52.0, (u) => ease.inOut(u * 0.94));
  const z = lerp(1.06, 2.7, k);
  // from the wide room toward his face and the screen in front of it
  return { x: lerp(1000, 1020, k), y: lerp(R.floor - 300 / 1.06, 538, k), z };
}

// ------------------------------------------------------------- face over the lid
// From the screen's side of the table: his face over the back of the lid,
// lit from below by the screen.
function frontShot(ctx, t, a) {
  const L = lightAt(t);
  const m = mood(t);
  const u = prog(t, a, a + 0.56);
  const cam = { x: 960, y: 540 + 6 * u, z: 1 + 0.06 * u };
  const ty = m.type;
  const LID_TOP = 716;
  camera(ctx, cam, () => {
    // the wall behind him: the window with the moon
    const wx = 1400;
    rect(ctx, wx, 96, 250, 270, { w: 4, seed: 7101 });
    line(ctx, wx + 125, 96, wx + 125, 366, { w: 3, seed: 7102 });
    line(ctx, wx, 231, wx + 250, 231, { w: 3, seed: 7103 });
    path(ctx, crescent(wx + 180, 150, 20), { w: 3, close: true, seed: 7104 });
    path(ctx, [[wx - 16, 372], [wx + 266, 372]], { w: 4, seed: 7105 });
    // him, close, over the lid: shoulders working at the keys
    const s = 4.3;
    const p = pose({
      view: 'front', x: 940, y: 918 + Math.abs(Math.sin(t * 11)) * 3 * ty, s,
      head: 0.03 + Math.sin(t * 5.3) * 0.02 * ty, turn: Math.sin(t * 3.1) * 0.06 * ty,
      look: lerp(0.62, 0.3, smooth(t, 47.6, 48)),
      aA1: 0.2 + Math.sin(t * 19) * 0.03 * ty, aA2: 0, aB1: 0.2 + Math.sin(t * 23 + 1) * 0.03 * ty, aB2: 0,
    });
    figure(ctx, p, { id: 1, cowlick: true, mouth: m.mouth, eye: m.eye, arms: 'upper', legs: false });
    // the back of the lid, near the camera: it fills the bottom of the frame
    const lid = [[420, 1140], [1500, 1140], [1522, LID_TOP], [398, LID_TOP]];
    fillPoly(ctx, lid, '#2a2826');
    path(ctx, lid, { w: 5, close: true, seed: 7111, wobble: 0.4 });
    const lights = [];
    // the screen behind the lid lights him from below
    lights.push({ type: 'glow', x: 960, y: LID_TOP - 10, r: 420 + 300 * L, k: clamp(1.05 * L) });
    lights.push({ type: 'glow', x: 940, y: 420, r: 300, k: clamp(0.65 * L) });
    lights.push({ type: 'glow', x: wx + 125, y: 231, r: 260, k: 0.16 });
    stage(ctx, lights, { dark: 0.9, beams: 0 });
  });
  // the top edge of the lid catches the screen's light
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'lighter';
  const [xa, ya] = toScreen(cam, 404, LID_TOP);
  const [xb] = toScreen(cam, 1516, LID_TOP);
  const g = ctx.createLinearGradient(0, ya - 40, 0, ya + 2);
  g.addColorStop(0, 'rgba(255,250,236,0)');
  g.addColorStop(1, `rgba(255,250,236,${0.32 * clamp(L)})`);
  ctx.fillStyle = g;
  ctx.fillRect(xa, ya - 40, xb - xa, 42);
  ctx.restore();
}
function crescent(x, y, r) {
  // a crescent moon
  const out = [];
  for (let i = 0; i <= 14; i++) {
    const a = -1.9 + (3.8 * i) / 14;
    out.push([x + Math.cos(a) * r, y + Math.sin(a) * r]);
  }
  for (let i = 0; i <= 12; i++) {
    const a = 1.62 - (3.24 * i) / 12;
    out.push([x + r * 0.45 + Math.cos(a) * r * 0.82, y + Math.sin(a) * r * 0.82]);
  }
  return out;
}

// ------------------------------------------------------------- the screen insert
const SCR = { x: 400, y: 120, w: 1120, h: 640 };
const BTN = { x: SCR.x + SCR.w - 300, y: SCR.y + SCR.h - 150, w: 220, h: 96 };

function thumbDoodle(ctx, i, x, y, w, h) {
  const cx = x + w / 2;
  const fl = y + h - 46;
  const o = { w: 4, wobble: 0.6 };
  if (i === 0) {
    // a little one in a spotlight (him, once)
    path(ctx, [[x + 40, fl], [x + w - 40, fl]], { ...o, seed: 9801 });
    path(ctx, [[cx - 14, y + 10], [cx - 70, fl]], { ...o, w: 2.4, seed: 9802 });
    path(ctx, [[cx + 14, y + 10], [cx + 70, fl]], { ...o, w: 2.4, seed: 9803 });
    figure(ctx, pose({ x: cx, y: fl - 114 * 0.55, s: 0.55, view: 'front', aA1: 1.9, aA2: 0.2, aB1: 1.9, aB2: 0.2 }), { id: 9, cowlick: true, mouth: 1, w: 3 });
  } else if (i === 1) {
    // a cat
    const hy = y + h * 0.5;
    ellipse(ctx, cx, hy, 78, 66, { ...o, fill: COL.paper, seed: 9830 });
    path(ctx, [[cx - 66, hy - 34], [cx - 58, hy - 104], [cx - 22, hy - 62]], { ...o, seed: 9831 });
    path(ctx, [[cx + 66, hy - 34], [cx + 58, hy - 104], [cx + 22, hy - 62]], { ...o, seed: 9832 });
    dot(ctx, cx - 28, hy - 8, 6);
    dot(ctx, cx + 28, hy - 8, 6);
    path(ctx, [[cx - 9, hy + 16], [cx, hy + 24], [cx + 9, hy + 16]], { ...o, w: 3, seed: 9833 });
  } else if (i === 2) {
    // mountains and a sun
    path(ctx, [[x + 30, fl], [x + 170, fl - 150], [x + 260, fl - 70], [x + 390, fl - 210], [x + 560, fl - 40], [x + w - 30, fl - 120]], { ...o, seed: 9840 });
    circle(ctx, x + w - 170, y + 90, 40, { ...o, seed: 9841 });
  } else if (i === 3) {
    // someone dancing
    path(ctx, [[x + 60, fl], [x + w - 60, fl]], { ...o, seed: 9850 });
    figure(ctx, pose({ x: cx, y: fl - 114 * 0.95 + 4, s: 0.95, view: 'front', aA1: 2.5, aA2: 0.5, aB1: 1.2, aB2: 1.2, lA1: 0.35, lA2: -0.2, lB1: 0.05, lean: 0.12, head: 0.15 }), { id: 10, mouth: 1, w: 4 });
  } else {
    // hardly anything: a line, a small figure, standing
    path(ctx, [[x + 200, fl], [x + w - 200, fl]], { ...o, w: 3, seed: 9860 });
    figure(ctx, pose({ x: cx, y: fl - 114 * 0.5, s: 0.5, view: 'front', aA1: 0.12, aB1: 0.12 }), { id: 11, w: 3 });
  }
}

function laptopBase(ctx) {
  const y0 = SCR.y + SCR.h + 12;
  const y1 = y0 + 84;
  const x0 = SCR.x - 14;
  const x1 = SCR.x + SCR.w + 14;
  const sp = 70;
  path(ctx, [[x0, y0], [x1, y0], [x1 + sp, y1], [x0 - sp, y1]], { w: 4.4, close: true, fill: COL.paper, seed: 9901, wobble: 0.4 });
  for (let r = 0; r < 3; r++) {
    const k = (r + 1) / 4.2;
    const y = lerp(y0, y1, k * 0.8);
    path(ctx, [[lerp(x0, x0 - sp, k * 0.8) + 50, y], [lerp(x1, x1 + sp, k * 0.8) - 50, y]], { w: 2, color: COL.inkSoft, seed: 9902 + r, wobble: 0.3 });
  }
}

// the cursor: an arrow with its tip at (x, y)
function cursor(ctx, x, y, s = 1) {
  const P = (u, v) => [x + u * s, y + v * s];
  path(ctx, [P(0, 0), P(0, 46), P(11, 35), P(19, 54), P(27, 50), P(19, 32), P(34, 32)], { w: 3.4, close: true, fill: COL.paper, seed: 9940, wobble: 0.2 });
}

function insertShot(ctx, t, a, i) {
  const post = POSTS[i];
  const dur = (SHOTS.find((s) => s[0] > a) ?? [a + 0.5])[0] - a;
  const u = prog(t, a, a + dur);
  const first = i === 0;
  const pressed = t >= post.click && t < post.click + 0.14;
  const done = t >= post.click + 0.14;
  // (the first one is under a subtitle: framed so the base clears it)
  const cam = { x: 960, y: first ? 440 : 452, z: (first ? 0.94 : 1.12) + 0.06 * u };
  // the first time the screen is dim until the click; then it blooms
  const bright = first ? (t < post.click ? 0.62 : 1) : 0.96;
  camera(ctx, cam, () => {
    laptopBase(ctx);
    screenFront(ctx, SCR.x, SCR.y, SCR.w, SCR.h, {
      seed: 9910,
      stand: false,
      content: (c, x, y, w, h) => {
        const tx = x + 60;
        const ty = y + 40;
        const tw = w - 120;
        const th = 360;
        rect(c, tx, ty, tw, th, { w: 4, seed: 9920 });
        c.save();
        c.beginPath();
        c.rect(tx, ty, tw, th);
        c.clip();
        thumbDoodle(c, post.thumb, tx, ty, tw, th);
        c.restore();
        // a title, scribbled
        path(c, [[tx, ty + th + 60], [tx + 360 - post.thumb * 50, ty + th + 60]], { w: 5, seed: 9921, wobble: 1.4 });
        path(c, [[tx, ty + th + 104], [tx + 220, ty + th + 104]], { w: 3, color: COL.inkSoft, seed: 9922, wobble: 1.2 });
        // 发布
        const inv = pressed || done;
        rect(c, BTN.x, BTN.y, BTN.w, BTN.h, { w: 4, fill: inv ? COL.ink : COL.paper, seed: 9930, over: 3 });
        text(c, '发布', BTN.x + BTN.w / 2, BTN.y + BTN.h / 2 + 2, { size: 54, color: inv ? COL.paper : COL.ink });
      },
    });
    // the cursor glides to the button and clicks
    const tc = post.click;
    const k = smooth(t, a - 0.05, tc - 0.06, ease.out);
    const from = [SCR.x + SCR.w * (0.35 + 0.1 * i), SCR.y + SCR.h * 0.75];
    const to = [BTN.x + BTN.w * 0.55, BTN.y + BTN.h * 0.55];
    cursor(ctx, lerp(from[0], to[0], k), lerp(from[1], to[1], k), pressed ? 0.9 : 1);
    stage(ctx, [
      { type: 'poly', pts: [[SCR.x - 10, SCR.y - 10], [SCR.x + SCR.w + 10, SCR.y - 10], [SCR.x + SCR.w + 10, SCR.y + SCR.h + 10], [SCR.x - 10, SCR.y + SCR.h + 10]], k: bright },
      { type: 'glow', x: W / 2, y: SCR.y + SCR.h / 2, r: 1100, k: 0.42 * bright },
    ], { dark: 0.9, beams: 0 });
  });
  // the click: the screen blooms
  if (t >= post.click) {
    const f = Math.exp(-(t - post.click) / (first ? 0.16 : 0.08));
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = `rgba(255,250,236,${(first ? 0.4 : 0.18) * f})`;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
}

// ------------------------------------------------------------- POV: the lid
// Looking down at the laptop from his seat; his hand folds the lid shut. A
// tiny 3D projection: X across, Y up from the desk, Z away from the eye.
const PV = { f: 1618, cx: 960, cy: 382, e: 0.6, zh: 3.0, hw: 0.81, th: 0.03 };
const pj = (X, Y, Z) => [PV.cx + (PV.f * X) / Z, PV.cy - (PV.f * (Y - PV.e)) / Z];
const OPEN_A = (106 * Math.PI) / 180;
const lidPt = (x, v, a) => pj(x, PV.th + v * Math.sin(a), PV.zh - v * Math.cos(a));
const POV0 = 52.0;
// (POV-local u = t - POV0 + 0.8: the hand is already on its way at the cut)
function povShot(ctx, t) {
  const u = t - POV0 + 0.8;
  const close = smooth(u, 1.0, 2.1, ease.sine);
  const a = OPEN_A * (1 - close);
  const faceSide = -PV.zh * Math.sin(a) + (PV.e - PV.th) * Math.cos(a);
  const vis = clamp(-faceSide / 1.6);
  const L = lightAt(t);
  // desk edge, the deck with its keys
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
      path(ctx, [pj(x0, PV.th, z), pj(x0 + (row === 3 && i === 3 ? 0.3 : 0.075), PV.th, z)], { w: 2.2, color: COL.inkSoft, seed: 7310 + row * 20 + i, wobble: 0.3 });
    }
  }
  const L0 = lidPt(-PV.hw, 0, a);
  const L1 = lidPt(PV.hw, 0, a);
  const L2 = lidPt(PV.hw, 1, a);
  const L3 = lidPt(-PV.hw, 1, a);
  const lights = [];
  let gapLine = null;
  if (faceSide < 0) {
    path(ctx, [L0, L1, L2, L3], { w: 4.4, close: true, fill: '#2b2825', seed: 7370, wobble: 0.3 });
    const F0 = lidPt(-PV.hw + 0.05, 0.07, a);
    const F1 = lidPt(PV.hw - 0.05, 0.07, a);
    const F2 = lidPt(PV.hw - 0.05, 0.94, a);
    const F3 = lidPt(-PV.hw + 0.05, 0.94, a);
    fillPoly(ctx, [F0, F1, F2, F3], '#f6f2ea');
    // the screen's page mapped onto the tilting face in thin rows
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
    const N = 48;
    const vt = 0.94;
    const vb = 0.07;
    const xl = -PV.hw + 0.05;
    const xr = PV.hw - 0.05;
    const V = (y) => vt - ((vt - vb) * y) / CH;
    for (let i = 0; i < N; i++) {
      const y0 = (CH * i) / N;
      const y1 = (CH * (i + 1)) / N;
      const ym = (y0 + y1) / 2;
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
    lights.push({ type: 'poly', pts: [F0, F1, F2, F3], k: 0.97 });
    const c = [(F0[0] + F2[0]) / 2, (F0[1] + F2[1]) / 2];
    lights.push({ type: 'glow', x: c[0], y: c[1] + 60, r: 600 + 500 * L, k: (0.35 + 0.5 * L) * Math.sqrt(vis) });
  } else {
    // past edge-on: the back of the lid; the light leaks out of the gap
    path(ctx, [L0, L1, L2, L3], { w: 4.4, close: true, fill: COL.paper, seed: 7371, wobble: 0.3 });
    const gk = clamp(a / 0.19);
    gapLine = { a: lidPt(-PV.hw + 0.04, 1, a), b: lidPt(PV.hw - 0.04, 1, a), k: gk };
    if (gk > 0.01) lights.push({ type: 'glow', x: (gapLine.a[0] + gapLine.b[0]) / 2, y: gapLine.a[1] + 10, r: 140 + 500 * gk, k: 0.5 * gk });
  }
  // his hand: in from the right, fingers over the top edge, folds it down
  const grip = lidPt(0.32, 1, a);
  const inK = smooth(u, 0.62, 1.02, ease.out);
  povHand(ctx, lerp(2060, grip[0], inK), lerp(420, grip[1], inK), [L0, L1, L2, L3], faceSide < 0);
  stage(ctx, lights, { dark: 0.93 + 0.07 * smooth(u, 1.98, 2.12), beams: 0 });
  // the last line of light along the gap
  if (gapLine && gapLine.k > 0.01) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = `rgba(255,250,236,${0.85 * gapLine.k})`;
    ctx.lineWidth = 2 + 5 * gapLine.k;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(gapLine.a[0], gapLine.a[1] + 3);
    ctx.lineTo(gapLine.b[0], gapLine.b[1] + 3);
    ctx.stroke();
    ctx.restore();
  }
}

// His forearm and hand seen from his own eyes (from the first cut).
const HAND_S = 2.8;
function povHand(ctx, gx, gy, lid, facing) {
  const P = ([u, v]) => [gx + v * HAND_S, gy + u * HAND_S];
  const KO = '#e1dacd';
  const W0 = P([34, 26]);
  const A = [2090, 1240];
  const dx = A[0] - W0[0];
  const dy = A[1] - W0[1];
  const l = Math.hypot(dx, dy);
  const nx = -dy / l;
  const ny = dx / l;
  const wedge = (e) => {
    const a = 6.5 + e;
    const b = 16 + e;
    return [[W0[0] + nx * a, W0[1] + ny * a], [A[0] + nx * b, A[1] + ny * b], [A[0] - nx * b, A[1] - ny * b], [W0[0] - nx * a, W0[1] - ny * a]];
  };
  fillPoly(ctx, wedge(5), KO, 0.9);
  const BACK = [[34, 26], [21, 15], [8, 5]];
  const F1 = { front: [[8, 5], [-1, 1], [-8, -4]], tip: [[-8, -4], [-8, -11], [-2, -16], [5, -17]] };
  const F2 = { front: [[13, 15], [3, 12], [-5, 8]], tip: [[-5, 8], [-6, 2], [-1, -3], [5, -4]] };
  const THUMB = [[25, 18], [21, 8], [19, 0]];
  const strokes = [
    { pts: BACK, w: 15, seed: 7381 },
    { pts: F1.front, w: 10, seed: 7382 },
    { pts: F2.front, w: 9, seed: 7383 },
    { pts: THUMB, w: 8, seed: 7384 },
  ];
  const tips = [
    { pts: F1.tip, w: 10, seed: 7385 },
    { pts: F2.tip, w: 9, seed: 7386 },
  ];
  const draw = (list, ko) => {
    for (const st of list) {
      const pts = st.pts.map(P);
      if (ko) path(ctx, pts, { w: st.w + 9, color: KO, alpha: 0.9, seed: st.seed, wobble: 0 });
      else path(ctx, pts, { w: st.w, seed: st.seed, wobble: 0.25 });
    }
  };
  const tipsClipped = (ko) => {
    ctx.save();
    if (facing) {
      ctx.beginPath();
      ctx.rect(-100, -100, W + 200, H + 200);
      ctx.moveTo(...lid[0]);
      for (let i = 1; i < lid.length; i++) ctx.lineTo(...lid[i]);
      ctx.closePath();
      ctx.clip('evenodd');
    }
    draw(tips, ko);
    ctx.restore();
  };
  draw(strokes, true);
  tipsClipped(true);
  path(ctx, wedge(0), { w: 2, close: true, fill: COL.ink, seed: 7380, wobble: 0.3 });
  draw(strokes, false);
  tipsClipped(false);
}

// the page on the screen when he shuts it: the last post, its number stuck
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
  const tx = 60;
  const ty = 40;
  const tw = CW - 120;
  const th = 360;
  rect(c, tx, ty, tw, th, { w: 4, seed: 9920 });
  c.save();
  c.beginPath();
  c.rect(tx, ty, tw, th);
  c.clip();
  thumbDoodle(c, 4, tx, ty, tw, th);
  c.restore();
  const by = ty + th + 26;
  path(c, [[tx, by], [tx + tw, by]], { w: 3, color: COL.inkSoft, seed: 9925, wobble: 0.2 });
  dot(c, tx + 40, by, 8);
  text(c, '播放', tx + 86, CH - 98, { size: 64 });
  text(c, formatCount(POSTS[4].peak), CW / 2 + 70, CH - 102, { size: 156, spacing: 2 });
  return tex;
}

// ------------------------------------------------------------- draw
function black(ctx) {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#0f0e0d';
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

export default {
  draw(ctx, lt) {
    const t = T0 + clamp(lt, -0.6, 14.6);
    let si = 0;
    for (let i = 0; i < SHOTS.length; i++) if (t >= SHOTS[i][0]) si = i;
    const [a, kind, arg] = SHOTS[si];
    // the bang: a jolt of the frame
    const jolt = t > BANG && t < BANG + 0.5 ? Math.exp(-(t - BANG) / 0.08) : 0;
    ctx.save();
    if (jolt > 0.01) ctx.translate(noise1(t * 60, 1) * 12 * jolt, noise1(t * 60, 2) * 8 * jolt);
    if (kind === 'wide') roomShot(ctx, t, wideCam(t));
    else if (kind === 'ins') insertShot(ctx, t, a, arg);
    else if (kind === 'bang') roomShot(ctx, t, bangCam(t));
    else if (kind === 'front') frontShot(ctx, t, a);
    else if (kind === 'side') roomShot(ctx, t, SIDE_CAMS[arg](prog(t, a, a + 0.5)));
    else if (kind === 'profile') roomShot(ctx, t, profileCam(t, a));
    else if (kind === 'stare') roomShot(ctx, t, stareCam(t));
    else if (kind === 'pov') povShot(ctx, t);
    else black(ctx);
    ctx.restore();
    // the flash of the bang, from the screen
    if (t > BANG && t < BANG + 0.6) {
      const f = Math.exp(-(t - BANG) / 0.08);
      const cam = bangCam(t);
      const p = toScreen(cam, R.hingeX + 10, TOP - 60);
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(p[0], p[1], 0, p[0], p[1], 900);
      g.addColorStop(0, `rgba(255,250,236,${0.7 * f})`);
      g.addColorStop(1, 'rgba(255,250,236,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }
  },
};
