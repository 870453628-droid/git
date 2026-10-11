// s03 · 19–31 · 我开始追一个数字。/ 追到最后，忘了自己想做什么。
// His room, dark. The screen's glow has replaced the spotlight; a view
// counter floats over the laptop. It climbs and he sits up, leans in,
// smiles. Then a fast loop (hard cuts, close-ups of the number on the
// screen): it stalls -> he slumps, crumples a sheet, throws it on the pile
// behind him -> types a new thing -> it creeps up a little -> stalls. Four
// times, faster each time, each new thing getting less. The last time it
// doesn't move: a fifth, longer close-up of a blank video with 0 plays, held
// dead still. Back on him: he looks up at the number, sags, slowly lays his
// head down on his arms. The screen's glow follows the number (attention):
// big at 3,617, small at 12, a little pool at 0. Slow pull back: the pile of
// paper is a heap. s04 opens on this pose.
import { W, COL, TAU, lerp, prog, smooth, keys, ease, hash, camera, path, rect, ellipse, circle, fillPoly, text, dot, withLayer, paper, setStill } from '../lib.js';
import { figure, pose, joints, reach, SIT, SIT_LIFT } from '../figure.js';
import { stage } from '../light.js';
import { counter, screenFront, paperBall } from '../props.js';
import { ROOM, room, PILE } from '../room.js';
import s02 from './s02.js';

const R = ROOM;
const S = R.s;
const TOP = R.floor - 150 * S; // table top
const SEAT = R.floor - 92 * S;
const KX = R.hingeX - 88 * S; // keyboard
const KEY_A = [KX + 6, TOP - 8 * S];
const KEY_B = [KX + 22, TOP - 8 * S];
// a stack of blank sheets on the near corner of the table, clear of the
// laptop base (where he types)
const STACK = [971, 1003];
const CTR = [1188, 436]; // the floating counter

// ------------------------------------------------------------- timeline
// rise 1.0–3.75; then four loops of [close-up | side], faster each time
const LOOPS = [
  { cu: 3.6, side: 4.0, end: 5.05, peak: 3617, thumb: 0, pile: 3 },
  { cu: 5.05, side: 5.4, end: 6.25, peak: 214, thumb: 1, pile: 13 },
  { cu: 6.25, side: 6.57, end: 7.25, peak: 57, thumb: 2, pile: 28 },
  { cu: 7.25, side: 7.53, end: 8.2, peak: 12, thumb: 3, pile: PILE.length - 1 },
];
// the last time: a long, still close-up of a blank video that nobody plays
const DEAD = { cu: 8.2, side: 8.9, thumb: -1 };
const FINAL_N = 0;
// how much attention the number brings: scales the screen's glow
// (1 at about 300 plays; 1.14 at 3,617; 0.7 at 12; 0.5 at 0)
const attn = (n) => (0.14 + 0.05 * Math.log10(1 + Math.max(0, n))) / 0.28;
// the moments the first number ticks up (a small flare of light on each)
const TICKS = [1.0, 1.55, 2.15, 2.82];

// the first number: 0 -> 128 -> 1,024 -> ... rolling, in steps
const riseN = (lt) =>
  keys(lt, [[1.0, 0], [1.45, 128], [1.55, 128], [2.05, 1024], [2.15, 1024], [2.75, 2731], [2.82, 2731], [3.75, 3617]], ease.out);

// what the close-up's counter shows: [value, rising]
function cuCount(lt, L, i) {
  if (L === DEAD) return [0, false];
  if (i === 0) return [riseN(lt), lt < 3.75];
  const a = L.cu + 0.03;
  const b = L.cu + (L.side - L.cu) * 0.62;
  return [L.peak * ease.out(prog(lt, a, b)), lt < b];
}

// ------------------------------------------------------------- his pose
function armPts(p, which, elbow, hand) {
  const j = joints(p);
  const a1 = Math.atan2(p.f * (elbow[0] - j.armRoot[0]), elbow[1] - j.armRoot[1]);
  const a2 = Math.atan2(p.f * (hand[0] - elbow[0]), hand[1] - elbow[1]) - a1;
  p[`a${which}1`] = a1;
  p[`a${which}2`] = a2;
}
function hand(p, which, pt) {
  const r = reach(p, which, pt[0], pt[1]);
  p[`a${which}1`] = r.a1;
  p[`a${which}2`] = r.a2;
}
function seated(o) {
  // SIT legs, as in room.js's sitter(), so s04/s08 match
  return pose({ ...SIT, x: R.stoolX + 4, y: SEAT - SIT_LIFT * S, s: S, f: 1, lean: o.lean, head: o.head, look: o.look });
}
function typing(p, lt, type) {
  hand(p, 'A', [KEY_A[0], KEY_A[1] + Math.sin(lt * 19) * 3 * type]);
  hand(p, 'B', [KEY_B[0], KEY_B[1] + Math.sin(lt * 23 + 1) * 3 * type]);
}
const P2 = (a) => ({ x: a[0], y: a[1] });
const kp = (o) => [o.x, o.y];

// rise: typing, the number starts; he sits up, looks up at it, leans in, smiles
function riseHim(lt) {
  const lean = keys(lt, [[0, 0.15], [1.0, 0.15], [1.35, 0.02], [2.0, 0.06], [3.1, 0.36]]);
  const head = keys(lt, [[0, 0.06], [1.0, 0.06], [1.35, -0.14], [3.1, -0.2]]);
  const look = keys(lt, [[0, 0.3], [1.0, 0.3], [1.3, -0.6], [3.1, -0.5]]);
  const p = seated({ lean, head, look });
  typing(p, lt, lt < 1.0 ? 0.5 : 0);
  return { p, mouth: keys(lt, [[1.4, 0], [1.9, 0.85], [3.0, 1]]) };
}

// one pass of the loop on the side shot: u = 0..1 through the shot
// He holds the sheet up in front of him (below and ahead of his face), then
// the crumpled ball is swung back past his side at chest height (the whole
// arm in view) and tossed up and back, without looking, onto the pile: the
// ball stays clear of his head all the way (>= 55 px from its centre).
const HOLD_A = [1003, 604];
const HOLD_B = [995, 610];
const THROW = [[0.53, [962, 620]], [0.6, [852, 628]]];
const RELEASE = THROW[1][1];
function loopHim(lt, L) {
  const u = prog(lt, L.side, L.end);
  const D = L.end - L.side;
  const lean = keys(u, [[0, 0.33], [0.2, -0.06], [0.5, -0.03], [0.6, -0.13], [0.68, -0.05], [0.8, 0.35]]);
  const head = keys(u, [[0, -0.12], [0.2, 0.3], [0.32, 0.12], [0.5, 0.12], [0.6, -0.12], [0.8, 0.06]]);
  const look = keys(u, [[0, -0.4], [0.2, 0.7], [0.32, 0.45], [0.5, 0.45], [0.6, 0], [0.8, 0.3]]);
  const mouth = keys(u, [[0, 0], [0.2, -0.7], [0.5, -0.8], [0.66, -0.45], [0.85, -0.2]]);
  const p = seated({ lean, head, look });
  const type = smooth(u, 0.78, 0.86);
  const tA = Math.sin(lt * 19) * 3.5 * type;
  const tB = Math.sin(lt * 23 + 1) * 3.5 * type;
  const sq = Math.sin(prog(u, 0.32, 0.5) * Math.PI * 3) * 4; // squeezing
  const A_KEYS = [
    [0, P2(KEY_A)], [0.2, P2([STACK[0] + 22, TOP - 9])], [0.32, P2(HOLD_A)], [0.5, P2([HOLD_A[0] - 2, HOLD_A[1] + 2])],
    ...THROW.map(([uu, q]) => [uu, P2(q)]), [0.68, P2([944, 600])], [0.8, P2(KEY_A)],
  ];
  // the throw itself is one continuous sweep (no easing at its waypoints)
  const throwing = u > 0.5 && u < THROW[1][0];
  const hA = kp(throwing ? keys(u, A_KEYS.slice(3, 6), ease.linear) : keys(u, A_KEYS));
  const hB = kp(keys(u, [
    [0, P2(KEY_B)], [0.2, P2([STACK[0] + 12, TOP - 6])], [0.32, P2(HOLD_B)], [0.5, P2([HOLD_B[0] + 2, HOLD_B[1]])],
    [0.6, P2([975, 640])], [0.8, P2(KEY_B)],
  ]));
  hand(p, 'A', [hA[0] - (u > 0.32 && u < 0.5 ? sq : 0), hA[1] + tA]);
  hand(p, 'B', [hB[0] + (u > 0.32 && u < 0.5 ? sq : 0), hB[1] + tB]);
  return { p, mouth, u, D };
}

// the last time: it doesn't move. He waits, sags, lays his head on his
// arms. Ends exactly on s04's opening pose (lean 0.36, head 0.95, look 1,
// arms flat on the table).
const END = { lean: 0.36, head: 0.95, look: 1, aA1: 1.25, aA2: 0.32, aB1: 1.18, aB2: 0.4 };
function finalHim(lt) {
  // (the close-up covers 8.2–8.9; we come back on him staring up at the 0)
  const lean = keys(lt, [[8.9, 0.34], [9.15, 0.34], [9.6, 0.2], [9.8, 0.2], [11.2, END.lean]], ease.inOut);
  const head = keys(lt, [[8.9, -0.12], [9.15, -0.12], [9.6, 0.16], [9.8, 0.18], [11.2, END.head]], ease.inOut);
  const look = keys(lt, [[8.9, -0.5], [9.15, -0.5], [9.6, 0.45], [11.2, END.look]]);
  const p = seated({ lean, head, look });
  // hands: stopped on the keys, slide back to the table edge, then the arms
  // go down flat on the table and the head goes down onto them
  const type = 0;
  const slide = smooth(lt, 9.1, 9.6);
  const tA = Math.sin(lt * 19) * 3.5 * type;
  const tB = Math.sin(lt * 23 + 1) * 3.5 * type;
  hand(p, 'A', [lerp(KEY_A[0], 1012, slide), lerp(KEY_A[1], TOP - 6, slide) + tA]);
  hand(p, 'B', [lerp(KEY_B[0], 1000, slide), lerp(KEY_B[1], TOP - 4, slide) + tB]);
  const k = smooth(lt, 9.75, 11.15, ease.inOut);
  for (const key of ['aA1', 'aA2', 'aB1', 'aB2']) p[key] = lerp(p[key], END[key], k);
  const mouth = head > 0.6 ? undefined : keys(lt, [[8.9, -0.3], [9.15, -0.3], [9.6, -0.75]]);
  return { p, mouth, eye: lt > 10.4 ? 'closed' : 'dot' };
}

// ------------------------------------------------------------- props
// the stack of blank paper on the table; it runs out with the last throw
function paperStack(ctx, n) {
  if (n <= 0) return;
  const h = 2 + n * 2.6;
  fillPoly(ctx, [[STACK[0] - 1, TOP - h], [STACK[1] + 1, TOP - h], [STACK[1] + 1, TOP - 1], [STACK[0] - 1, TOP - 1]], COL.paper);
  // loose sheets, each a little askew; the top one curls up at its corner
  for (let i = 0; i < n; i++) {
    const y = TOP - 2 - i * 2.6;
    const dx = (hash(i * 3.7) - 0.5) * 5;
    path(ctx, [[STACK[0] + dx, y + 0.6], [STACK[1] + dx * 0.6, y - 0.6]], { w: 1.6, seed: 9600 + i, wobble: 0.15 });
  }
  const y = TOP - 2 - (n - 1) * 2.6;
  path(ctx, [[STACK[1] - 9, y], [STACK[1] - 2, y - 4], [STACK[1] + 2, y - 2]], { w: 1.5, seed: 9608, wobble: 0.1 });
}

// a sheet between his hands that crumples into a ball (k 0..1)
function crumpling(ctx, x, y, k, seed) {
  if (k >= 0.75) {
    paperBall(ctx, x, y, lerp(19, 15, prog(k, 0.75, 1)), seed);
    return;
  }
  const n = 14;
  const hw = lerp(21, 16, k);
  const hh = lerp(28, 17, k);
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + 0.3;
    // a sheet whose outline rounds and roughens as it crumples
    const c = Math.cos(a);
    const s = Math.sin(a);
    const sq = 1 / Math.max(Math.abs(c), Math.abs(s));
    const rr = lerp(sq, 1, k) * (1 + (hash(seed * 9 + i) - 0.5) * 0.55 * k);
    pts.push([x + (c * hw - s * hh * 0.12) * rr, y + (s * hh + c * hw * 0.12) * rr]);
  }
  path(ctx, pts, { w: 2.2, close: true, fill: COL.paper, seed: 9700 + seed, wobble: 0.2 + k * 1.2 });
  // writing on it, scrunching up
  for (let r = 0; r < 4; r++) {
    const yy = y - hh * 0.55 + r * hh * 0.34;
    const ww = hw * (r === 3 ? 0.9 : 1.4) * (1 - k * 0.5);
    path(ctx, [[x - hw * 0.7, yy], [x - hw * 0.7 + ww, yy + hh * 0.1 * k]], { w: 1.4, alpha: 0.75, seed: 9720 + seed * 5 + r, wobble: 0.4 + k * 2 });
  }
}

// ------------------------------------------------------------- the close-up
const SCR = { x: 400, y: 120, w: 1120, h: 640 };

function thumbDoodle(ctx, i, x, y, w, h) {
  const cx = x + w / 2;
  const fl = y + h - 46;
  const o = { w: 4, wobble: 0.6 };
  if (i === 0) {
    // a little one in a spotlight
    path(ctx, [[x + 40, fl], [x + w - 40, fl]], { ...o, seed: 9801 });
    path(ctx, [[cx - 14, y + 10], [cx - 70, fl]], { ...o, w: 2.4, seed: 9802 });
    path(ctx, [[cx + 14, y + 10], [cx + 70, fl]], { ...o, w: 2.4, seed: 9803 });
    figure(ctx, pose({ x: cx, y: fl - 114 * 0.55, s: 0.55, view: 'front', aA1: 0.8, aA2: -2.1, aB1: 0.8, aB2: -2.1 }), { id: 9, cowlick: true, mouth: 1, w: 3 });
    for (const sx of [-1, 1]) for (let k = 0; k < 3; k++) {
      const px = cx + sx * (150 + k * 85);
      ellipse(ctx, px, fl - 120 - k * 4, 16, 16, { w: 3, seed: 9810 + k * 2 + (sx > 0 ? 1 : 0) });
      path(ctx, [[px, fl - 104 - k * 4], [px, fl]], { w: 3, seed: 9820 + k * 2 + (sx > 0 ? 1 : 0) });
    }
  } else if (i === 1) {
    // a cat
    const hy = y + h * 0.48;
    ellipse(ctx, cx, hy, 78, 66, { ...o, fill: COL.paper, seed: 9830 });
    path(ctx, [[cx - 66, hy - 34], [cx - 58, hy - 104], [cx - 22, hy - 62]], { ...o, seed: 9831 });
    path(ctx, [[cx + 66, hy - 34], [cx + 58, hy - 104], [cx + 22, hy - 62]], { ...o, seed: 9832 });
    dot(ctx, cx - 28, hy - 8, 6);
    dot(ctx, cx + 28, hy - 8, 6);
    path(ctx, [[cx - 9, hy + 16], [cx, hy + 24], [cx + 9, hy + 16]], { ...o, w: 3, seed: 9833 });
    for (const sx of [-1, 1]) for (let k = 0; k < 2; k++) path(ctx, [[cx + sx * 40, hy + 16 + k * 10], [cx + sx * 110, hy + 8 + k * 22]], { w: 2.4, seed: 9834 + k * 2 + (sx > 0 ? 1 : 0), wobble: 0.4 });
  } else if (i === 2) {
    // mountains and a sun
    path(ctx, [[x + 30, fl], [x + 170, fl - 150], [x + 260, fl - 70], [x + 390, fl - 210], [x + 560, fl - 40], [x + w - 30, fl - 120]], { ...o, seed: 9840 });
    circle(ctx, x + w - 170, y + 90, 40, { ...o, seed: 9841 });
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * TAU;
      path(ctx, [[x + w - 170 + Math.cos(a) * 54, y + 90 + Math.sin(a) * 54], [x + w - 170 + Math.cos(a) * 72, y + 90 + Math.sin(a) * 72]], { w: 3, seed: 9842 + k, wobble: 0.2 });
    }
  } else {
    // someone dancing
    path(ctx, [[x + 60, fl], [x + w - 60, fl]], { ...o, seed: 9850 });
    figure(ctx, pose({ x: cx, y: fl - 114 * 0.95 + 4, s: 0.95, view: 'front', aA1: 2.5, aA2: 0.5, aB1: 1.2, aB2: 1.2, lA1: 0.35, lA2: -0.2, lB1: 0.05, lean: 0.12, head: 0.15 }), { id: 10, mouth: 1, w: 4 });
    for (const sx of [-1, 1]) path(ctx, [[cx + sx * 130, fl - 200], [cx + sx * 150, fl - 160]], { w: 3, seed: 9851 + (sx > 0 ? 1 : 0), wobble: 0.2 });
  }
}

// the laptop's base under the screen (the same laptop as the side shots):
// the hinge, the keyboard deck coming toward us, a few rows of keys
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
    const a = lerp(x0, x0 - sp, k * 0.8) + 50;
    const b = lerp(x1, x1 + sp, k * 0.8) - 50;
    path(ctx, [[a, y], [b, y]], { w: 2, color: COL.inkSoft, seed: 9902 + r, wobble: 0.3 });
  }
  const tw = 150;
  path(ctx, [[960 - tw, y1 - 4], [960 - tw + 8, y0 + 50], [960 + tw - 8, y0 + 50], [960 + tw, y1 - 4]], { w: 2.4, color: COL.inkSoft, seed: 9905, wobble: 0.3 });
}

function closeUp(ctx, lt, L, i) {
  const [n, rising] = cuCount(lt, L, i);
  const dead = L === DEAD;
  const push = dead ? 0 : prog(lt, L.cu, L.side);
  // the dead one is held perfectly still: even the lines stop boiling
  if (dead) setStill(true);
  camera(ctx, { x: 960, y: 452, z: 1.2 + 0.05 * push }, () => {
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
        if (L.thumb >= 0) {
          c.save();
          c.beginPath();
          c.rect(tx, ty, tw, th);
          c.clip();
          thumbDoodle(c, L.thumb, tx, ty, tw, th);
          c.restore();
        }
        // the player's progress bar (the blank one hasn't played at all)
        const by = ty + th + 26;
        path(c, [[tx, by], [tx + tw, by]], { w: 3, color: COL.inkSoft, seed: 9925, wobble: 0.2 });
        const bp = tx + tw * (dead ? 0 : 0.18 + 0.2 * L.thumb);
        path(c, [[tx, by], [bp, by]], { w: 5, seed: 9926, wobble: 0.2 });
        dot(c, bp, by, 8);
        text(c, '播放', tx + 86, y + h - 98, { size: 64 });
        counter(c, x + w / 2 + 70, y + h - 102, n, { size: 156, delta: rising ? 1 : 0 });
      },
    });
    stage(ctx, [
      { type: 'poly', pts: [[SCR.x - 10, SCR.y - 10], [SCR.x + SCR.w + 10, SCR.y - 10], [SCR.x + SCR.w + 10, SCR.y + SCR.h + 10], [SCR.x - 10, SCR.y + SCR.h + 10]], k: 0.96 },
      { type: 'glow', x: W / 2, y: SCR.y + SCR.h / 2, r: 1100, k: dead ? 0.32 : 0.45 },
    ], { dark: 0.8 });
  });
  if (dead) setStill(false);
}

// ------------------------------------------------------------- the room
// The room's light is the screen's, and it follows the number: f = attn().
// The glow's size and strength both scale with it.
function roomLights(r, f, flare = 0) {
  const sc = r.lp.screen;
  return [
    { ...r.screenLight, r: r.screenLight.r * (0.55 + 0.45 * f) },
    { type: 'glow', x: sc[0] - 40, y: sc[1] + 20, r: 760 * (0.6 + 0.4 * f), k: 0.28 * f + flare },
    { type: 'glow', x: CTR[0] + 10, y: CTR[1], r: 170 * (0.55 + 0.45 * Math.min(1, f)), k: 0.55 * Math.min(1, Math.pow(f, 0.8)) },
  ];
}
function sideShot(ctx, lt, cam, him, o) {
  camera(ctx, cam, () => {
    const r = room(ctx, lt, { balls: o.balls, open: 1 });
    paperStack(ctx, o.stack ?? 0);
    if (o.under) o.under(ctx);
    figure(ctx, him.p, { id: 1, cowlick: true, mouth: him.mouth, eye: him.eye });
    if (o.extra) o.extra(ctx);
    counter(ctx, CTR[0], CTR[1] + Math.sin(lt * 2.1) * 3, o.count, { size: o.size ?? 62, delta: o.rising ? 1 : 0 });
    stage(ctx, roomLights(r, o.f ?? attn(o.count), o.flare ?? 0), { dark: 0.8 });
  });
}

const SIDE_CAM = { x: 955, y: 610, z: 1.9 };
// How this scene leaves him (s04 opens on exactly this; it keeps a copy of
// these numbers — change them together)
const END_CAM = { x: 1010, y: 600, z: 1.25 };
// the glow at the end: the little pool the blank video's 0 leaves him
const F_END = 0.42;
export const S03_END = {
  ...END, cam: END_CAM, n: FINAL_N, ctr: CTR,
  // the room's light on the last frame: stage(ctx, S03_END.lights(room(...)), { dark: 0.8 })
  f: F_END,
  lights: (r) => roomLights(r, F_END),
  // what the screen shows: the blank video (no picture), not played, 播放 0
  screen: { thumb: null, progress: 0, n: FINAL_N },
};

// The way in: a plain linear cross-dissolve from s02's last (still) frame,
// done here so the dark paper doesn't bleed through two half-transparent
// layers (main.js's dissolve brightens dark-to-dark transitions).
const DISS = 0.6;

export default {
  fadeIn: 0,
  fadeOut: 0, // s04 opens on exactly this frame (S03_END): a hard cut
  draw(ctx, lt, info) {
    if (lt < DISS) {
      s02.draw(ctx, 10 + lt, info);
      withLayer(ctx, (l) => {
        paper(l);
        drawScene(l, lt);
      }, { alpha: smooth(lt, 0, DISS, ease.sine) });
      return;
    }
    drawScene(ctx, lt);
  },
};

function drawScene(ctx, lt) {
  {
    // 1) the number starts to climb
    if (lt < LOOPS[0].cu) {
      const him = riseHim(lt);
      const k = smooth(lt, 0.6, 3.6, ease.inOut);
      const z = lerp(1.55, 1.85, k);
      // keep the floor above the subtitle band
      const cam = { x: lerp(1000, 1050, k), y: R.floor - 345 / z, z };
      const n = riseN(lt);
      // the light swells with each tick of the number
      const flare = 0.08 * TICKS.reduce((m, tk) => Math.max(m, lt >= tk ? 1 - prog(lt, tk, tk + 0.2) : 0), 0);
      sideShot(ctx, lt, cam, him, { balls: 3, stack: 4, count: n, rising: lt > 1.0, size: lerp(58, 70, smooth(lt, 1.0, 3.4)), flare });
      return;
    }
    // 2) the loop
    for (let i = 0; i < LOOPS.length; i++) {
      const L = LOOPS[i];
      if (lt >= L.end) continue;
      if (lt < L.side) {
        closeUp(ctx, lt, L, i);
        return;
      }
      const him = loopHim(lt, L);
      const shown = i === 0 ? 3617 : L.peak;
      // the ball: lifted, crumpled, thrown over his shoulder onto the pile
      const tRel = L.side + 0.6 * him.D;
      const tLand = tRel + Math.min(0.24, 0.36 * him.D);
      const land = PILE[L.pile];
      const LP = [R.pileX + land[0], R.floor - land[1] - 1];
      const landed = lt >= tLand;
      // where the sheet / ball is this frame (null: nowhere)
      const j = joints(him.p);
      const u = him.u;
      let sheet = null;
      let ball = null;
      if (u >= 0.2 && u < 0.6) {
        const mid = [(j.handA[0] + j.handB[0]) / 2, (j.handA[1] + j.handB[1]) / 2];
        const lifted = u < 0.32 ? [lerp(STACK[0] + 16, mid[0], prog(u, 0.2, 0.32)), lerp(TOP - 9, mid[1], prog(u, 0.2, 0.32))] : null;
        if (u < 0.5) sheet = lifted ?? mid;
        else ball = j.handA;
      } else if (lt >= tRel && !landed) {
        const f = prog(lt, tRel, tLand);
        ball = [lerp(RELEASE[0], LP[0], f), lerp(RELEASE[1], LP[1], f) - Math.sin(f * Math.PI) * 120];
      }
      // the ball goes behind his head if it ever touches it (it shouldn't)
      const behind = ball && Math.hypot(ball[0] - j.head[0], ball[1] - j.head[1]) < j.r + 17;
      const drawBall = (c) => paperBall(c, ball[0], ball[1], 15, L.pile);
      sideShot(ctx, lt, SIDE_CAM, him, {
        balls: L.pile + (landed ? 1 : 0),
        stack: 4 - i - (u >= 0.2 ? 1 : 0),
        count: shown,
        size: 66,
        under: (c) => {
          if (ball && behind) drawBall(c);
        },
        extra: (c) => {
          if (sheet) crumpling(c, sheet[0], sheet[1], prog(u, 0.32, 0.5), i);
          if (ball && !behind) drawBall(c);
        },
      });
      return;
    }
    // 3) the last time: a long still close-up — a blank video, 0 plays
    if (lt < DEAD.side) {
      closeUp(ctx, lt, DEAD, LOOPS.length);
      return;
    }
    // back on him, staring at the 0; he sags; slow pull back while the light
    // shrinks to a little pool on him and the screen
    const him = finalHim(lt);
    const k = smooth(lt, 8.9, 11.7, ease.inOut);
    // ends on s04's opening camera
    const cam = { x: lerp(SIDE_CAM.x, END_CAM.x, k), y: lerp(SIDE_CAM.y, END_CAM.y, k), z: lerp(SIDE_CAM.z, END_CAM.z, k) };
    sideShot(ctx, lt, cam, him, { balls: PILE.length, count: FINAL_N, size: 66, f: lerp(attn(FINAL_N), F_END, smooth(lt, 9.2, 11.6)) });
  }
}
