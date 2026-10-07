// s06 — 我以为日子可以一直重复，还有明天，但我错了。
// Days roll past like a film strip: every frame the same — the two of them at
// their shared desk, the sun in the window. Blank (pencil) days come in from
// the right and fill with the two of them as they reach the middle. Then the
// strip slows and stops on a day that fills with him only. The camera moves
// in; he turns to the empty chair beside him.
//
// This file also exports the small helpers shared by s06–s08 (group B):
// `day()` (the ordinary-day picture), `her()` (her figure with a readable
// gold tie) and `tiePos()`.
import { W, COL, F, lerp, smooth, ease, path, rect, dot } from '../lib.js';
import { figure, pose } from '../figure.js';
import { sun, frameBox } from '../sets.js';

// ------------------------------------------------------------------ shared

// Where figure() puts her hair tie (mirrors drawTail in figure.js).
export function tiePos(p, j) {
  const [hx, hy] = j.head;
  const r = j.r;
  if (p.view === 'back') return [hx + (p.turn ?? 0) * -r * 0.15, hy - r * 0.2];
  const f = p.view === 'front' ? ((p.turn ?? 0) >= 0 ? -1 : 1) : p.f;
  const a = j.headAngle;
  const back = -f;
  const ux = Math.sin(a) * f;
  const uy = -Math.cos(a);
  const bx = back * Math.cos(a);
  const by = -Math.sin(a);
  const ax = hx + (bx * 0.8 + ux * 0.45) * r;
  const ay = hy + (by * 0.8 + uy * 0.45) * r;
  return [ax + bx * r * 0.18, ay + by * r * 0.18];
}

// Her, with a tie dot big enough to read at small scales. Returns joints.
export function her(ctx, p, o = {}) {
  const j = figure(ctx, p, { id: 2, ponytail: true, ...o, noTie: true });
  if (!o.noTie) {
    const tp = tiePos(p, j);
    dot(ctx, tp[0], tp[1], Math.max(o.tieMin ?? 4, 6 * p.s), o.tieColor ?? COL.gold, o.alpha ?? 1);
  }
  return j;
}

// The ordinary day: the two at their shared desk, the sun in the window.
// Drawn in picture units (DAY.w x DAY.h, centred on 0,0), placed on screen at
// V = {x, y, k}. Line widths grow slower than k so it stays drawn, not zoomed.
// o: {
//   alpha     overall
//   set       ink of the room (window, desk, chairs); 0.3 = pencil
//   sun       sun alpha (defaults to set)
//   frame     frame alpha (default 1; 0 = none)
//   boy, girl presence 0..1 (an empty seat shows its chair)
//   boyPose, girlPose  pose overrides (picture units for x/y offsets: dx, dy)
//   seed      stroke-seed base (keeps the wobble stable)
//   t         time for idle motion
//   still     freeze the boil
//   headFill  paper colour for heads/desk (photos)
//   chairs    false: never draw the empty-seat chairs
//   girlOpts  extra options for her figure (e.g. {noTie: true})
// }
export const DAY = { w: 420, h: 260, deskY: 40, apron: 44, hipY: 72, boyX: -72, girlX: 72, sun: [150, -86], sunR: 12.5, s: 0.85 };
// where s06 ends and s07 begins: the day frame, large, a little above centre
export const DAY_CLOSE = { x: 960, y: 420, k: 2.2 };

export function day(ctx, V, o = {}) {
  const k = V.k;
  const X = (x) => V.x + x * k;
  const Y = (y) => V.y + y * k;
  const lw = (w) => w * Math.pow(k, 0.6);
  const a = o.alpha ?? 1;
  const aSet = (o.set ?? 1) * a;
  const aSun = (o.sun ?? o.set ?? 1) * a;
  const aFrame = (o.frame ?? 1) * a;
  const boyA = (o.boy ?? 1) * a;
  const girlA = (o.girl ?? 1) * a;
  const paperFill = o.headFill ?? COL.paper;
  const st = o.still;
  const sd = o.seed ?? 7000;
  const saved = F.stroke;
  F.stroke = sd;

  if (aFrame > 0.01) frameBox(ctx, X(-210), Y(-130), 420 * k, 260 * k, { w: lw(3.8), over: 7 * Math.sqrt(k), alpha: aFrame, seed: sd + 1, still: st });

  // window with the sun
  if (aSet > 0.01) rect(ctx, X(106), Y(-120), 88 * k, 68 * k, { w: lw(2.4), over: 3 * Math.sqrt(k), alpha: aSet, seed: sd + 2, still: st });
  if (aSun > 0.01) {
    F.stroke = sd + 40;
    sun(ctx, X(DAY.sun[0]), Y(DAY.sun[1]), DAY.sunR * k, { w: lw(2.2), alpha: aSun, spin: o.spin ?? 0 });
  }

  // chairs behind empty seats
  const chair = (sx, e, s0) => {
    if (e < 0.01) return;
    const ca = e * aSet;
    // seen from the front over the desk: two posts and the curved back board
    path(ctx, [[X(sx - 25), Y(-4)], [X(sx), Y(-7)], [X(sx + 25), Y(-4)], [X(sx + 24), Y(7)], [X(sx), Y(5)], [X(sx - 24), Y(7)]], { w: lw(2.6), alpha: ca, close: true, seed: s0, still: st, wobble: 0.8 });
    path(ctx, [[X(sx - 19), Y(-10)], [X(sx - 19), Y(DAY.deskY)]], { w: lw(2.6), alpha: ca, seed: s0 + 1, still: st });
    path(ctx, [[X(sx + 19), Y(-10)], [X(sx + 19), Y(DAY.deskY)]], { w: lw(2.6), alpha: ca, seed: s0 + 2, still: st });
  };
  if (o.chairs !== false) {
    // a chair shows only while its seat is (nearly) empty
    chair(DAY.boyX, 1 - smooth(o.boy ?? 1, 0, 0.45), sd + 10);
    chair(DAY.girlX, 1 - smooth(o.girl ?? 1, 0, 0.45), sd + 14);
  }

  // the two of them, sitting side by side (front view); the desk hides
  // everything below its top, so clip there (works at any alpha)
  ctx.save();
  ctx.beginPath();
  ctx.rect(X(-300), Y(-300), 600 * k, (300 + DAY.deskY + 1) * k);
  ctx.clip();
  const s = DAY.s * k;
  const t = o.t ?? 0;
  let boyJ = null;
  let girlJ = null;
  let boyP = null;
  let girlP = null;
  if (boyA > 0.01) {
    const bp = o.boyPose ?? {};
    const p = pose({ view: 'front', x: X(DAY.boyX + (bp.dx ?? 0)), y: Y(DAY.hipY + (bp.dy ?? 0)), s, aA1: 0.16, aA2: 0.02, aB1: 0.16, aB2: 0.02, ...bp });
    boyP = p;
    boyJ = figure(ctx, p, { id: 1, alpha: boyA, still: st, headFill: paperFill, legs: false });
  }
  if (girlA > 0.01) {
    const gp = o.girlPose ?? {};
    const p = pose({ view: 'front', x: X(DAY.girlX + (gp.dx ?? 0)), y: Y(DAY.hipY + (gp.dy ?? 0)), s, aA1: 0.16, aA2: 0.02, aB1: 0.16, aB2: 0.02, head: -0.06, turn: 0.05, tail: 0.12 * Math.sin(t * 1.3), ...gp });
    girlP = p;
    girlJ = her(ctx, p, { alpha: girlA, still: st, headFill: paperFill, tieMin: o.tieMin, legs: false, ...(o.girlOpts ?? {}) });
  }
  ctx.restore();

  // the shared desk (two desks pushed together), covering their laps
  if (aSet > 0.01 || boyA > 0.01 || girlA > 0.01) {
    ctx.save();
    ctx.globalAlpha *= aSet;
    ctx.fillStyle = paperFill;
    ctx.fillRect(X(-160), Y(DAY.deskY), 320 * k, DAY.apron * k);
    ctx.restore();
    F.stroke = sd + 60;
    path(ctx, [[X(-164), Y(DAY.deskY)], [X(164), Y(DAY.deskY + 1)]], { w: lw(3.4), alpha: aSet, seed: sd + 61, still: st });
    path(ctx, [[X(-160), Y(DAY.deskY + DAY.apron)], [X(160), Y(DAY.deskY + DAY.apron - 1)]], { w: lw(2), alpha: aSet, seed: sd + 62, still: st });
    path(ctx, [[X(0), Y(DAY.deskY + 1)], [X(0), Y(DAY.deskY + DAY.apron - 1)]], { w: lw(1.8), alpha: aSet * 0.8, seed: sd + 63, still: st });
    path(ctx, [[X(-150), Y(DAY.deskY + DAY.apron)], [X(-152), Y(126)]], { w: lw(2.8), alpha: aSet, seed: sd + 64, still: st });
    path(ctx, [[X(150), Y(DAY.deskY + DAY.apron)], [X(152), Y(126)]], { w: lw(2.8), alpha: aSet, seed: sd + 65, still: st });
  }
  F.stroke = saved;
  return { boy: boyJ, girl: girlJ, boyP, girlP, X, Y, lw };
}

// ------------------------------------------------------------------- scene

const K = 5; // the day she isn't there
const PITCH = 480; // picture units between frames on the strip

// Four even ticks, then a slow last one that stops on day K.
function stripPos(lt) {
  let pos = 0;
  for (const t0 of [0.1, 0.52, 0.94, 1.36]) pos += smooth(lt, t0, t0 + 0.3, ease.inOut);
  pos += smooth(lt, 1.76, 2.62, ease.sine);
  return pos;
}

export default {
  draw(ctx, lt, info) {
    const t = info.t;
    const pos = stripPos(lt);
    // camera: wide on the strip, then into day K
    const zk = smooth(lt, 2.75, 4.05, ease.inOut);
    const k = Math.exp(lerp(Math.log(1.0), Math.log(DAY_CLOSE.k), zk));
    const cy = lerp(485, DAY_CLOSE.y, zk);
    const others = 1 - smooth(lt, 2.8, 3.6); // the rest of the strip fades away
    const lw = (w) => w * Math.pow(k, 0.6);

    // the strip: two edges and sprocket holes, moving with the frames
    const n0 = Math.floor(pos - 960 / (PITCH * k) - 1);
    const n1 = Math.ceil(pos + 960 / (PITCH * k) + 1);
    const edgeA = (x) => smooth(x, -260, 380) * (1 - smooth(x, 1540, 2180));
    for (let n = n0; n <= n1; n++) {
      const cx = W / 2 + (n - pos) * PITCH * k;
      const ea = edgeA(cx) * others;
      if (ea < 0.01) continue;
      const half = (PITCH * k) / 2;
      for (const side of [-1, 1]) {
        const ey = cy + side * 172 * k;
        path(ctx, [[cx - half, ey], [cx + half, ey + side * 0.5]], { w: lw(2.6), alpha: 0.8 * ea, seed: 3000 + n * 7 + (side > 0 ? 1 : 0) });
        for (let i = 0; i < 10; i++) {
          const hx = cx - half + (i + 0.5) * (PITCH / 10) * k;
          const hy = cy + side * 151 * k;
          const hw = 9 * k;
          const hh = 5.5 * k;
          path(ctx, [[hx - hw, hy - hh], [hx + hw, hy - hh], [hx + hw, hy + hh], [hx - hw, hy + hh]], { w: lw(1.5), alpha: 0.6 * ea * edgeA(hx), close: true, seed: 3500 + n * 23 + i * 2 + (side > 0 ? 1 : 0), wobble: 0.5 });
        }
      }
    }

    // the days
    for (let n = n0; n <= n1; n++) {
      const cx = W / 2 + (n - pos) * PITCH * k;
      const d = n - pos; // > 0: still to come
      const ea = edgeA(cx) * (n === K ? 1 : others);
      if (ea < 0.01) continue;
      const set = lerp(1, 0.3, smooth(d, 0.1, 0.9));
      const fill = 1 - smooth(d, 0.08, 0.62); // the day fills in as it reaches the middle
      const boy = n <= K ? fill : 0;
      const girl = n < K ? fill : 0;
      let boyPose = {};
      if (n === K) {
        // he turns to the empty chair beside him
        const turn = smooth(lt, 3.3, 4.15, ease.inOut);
        const sag = smooth(lt, 4.1, 4.6, ease.inOut);
        boyPose = { turn: 0.95 * turn, head: 0.14 * turn + 0.05 * sag, lean: 0.05 * turn, look: 0.3 * turn + 0.35 * sag };
      }
      day(ctx, { x: cx, y: cy, k }, {
        alpha: ea, set, frame: lerp(0.45, 1, 1 - smooth(d, 0.1, 0.9)), boy, girl, boyPose, t, seed: 10000 + n * 211,
      });
    }
  },
};
