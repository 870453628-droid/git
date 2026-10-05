// s10 — 我忽然想起：“当时轻别意中人，山长水远知何处。”
//
// The same carriage, same instant (hard cut from s09), the window now sits
// left of centre so the poem can hang on the bare wall to the right.
// He turns back from the empty edge. Faintly, in the glass, she is standing on
// a far ridge, waving goodbye the way she did that day (s01) — only her tie
// has colour. The train gathers speed (山长水远); the mountains carry her
// toward the edge. He lifts his hand to the glass, too late: she slides out
// of the window and his hand stays there on the glass.
import { COL, clamp, lerp, smooth, ease, dot } from '../lib.js';
import { figure, pose, mixPose, WAVE } from '../figure.js';
import { trainShot, trainD, BOY, MID, VN, WIN, CAM_S10 } from './s09.js';

// her summit on the mid ridge (see s09's MID layer): mid-glass at 83.7,
// carried out of the window's left edge at ~86.7
const HER_XW = 4630;
const HER_S = 0.92;
const herX = (t) => HER_XW - MID.k * VN * trainD(t);
const HER_Y = MID.h(HER_XW) + 1;

const T = {
  back0: 82.6, back1: 83.4, // 我忽然想起: he turns back from the edge
  her0: 83.55, her1: 84.25, // she appears (当时轻别 83.8)
  wave0: 84.0, wave1: 85.25,
  reach0: 85.6, reach1: 86.15, // 山长水远: he reaches for the glass
  gone: 86.75,
};

export default {
  fadeIn: 0,
  draw(ctx, lt, info) {
    const t = info.t;
    trainShot(ctx, t, {
      cam: { ...CAM_S10, z: lerp(1, 1.025, smooth(t, 82.4, 87.4, ease.sine)) },
      inGlass: (l) => drawHer(l, t),
      boy: (p) => boyOver(p, t),
    });
  },
};

function drawHer(ctx, t) {
  const a = smooth(t, T.her0, T.her1);
  if (a <= 0.01) return;
  const x = herX(t);
  if (x < WIN.x - 120) return;
  const s = HER_S;
  const g = HER_Y - 114 * s;
  const wave = smooth(t, T.wave0, T.wave0 + 0.3) * (1 - smooth(t, T.wave1, T.wave1 + 0.35));
  const base = pose({ x, y: g, s, f: -1, head: 0.04, tail: 0.12 * Math.sin(t * 2.2) });
  const p = mixPose(base, { ...base, ...WAVE(t, 7.5), tail: 0.1 + 0.12 * Math.sin(t * 6) }, wave);
  // a soft clearing in the haze so she reads against the ridges
  ctx.save();
  const gr = ctx.createRadialGradient(x, g - 60, 10, x, g - 60, 190);
  gr.addColorStop(0, `rgba(240,235,224,${0.75 * a})`);
  gr.addColorStop(1, 'rgba(240,235,224,0)');
  ctx.fillStyle = gr;
  ctx.fillRect(x - 200, g - 260, 400, 400);
  ctx.restore();
  // a memory: faint, the line broken into dashes (drawn on a small scratch
  // canvas so overlapping strokes don't double up, then laid on the glass)
  memoryLayer(ctx, x, g - 40 * s, 200, 360 * s + 40, (l) => {
    figure(l, p, { id: 2, ponytail: true, noTie: true, w: 4.2, dash: [16, 6] });
  }, 0.5 * a);
  // her tie: the only colour
  const tie = tieAt(p);
  dot(ctx, tie[0], tie[1], 7, COL.gold, 0.95 * a);
}

// draw fn() into a scratch canvas covering a world box around (cx, cy), then
// composite it with one alpha. The scratch is cleared every call (no state).
let scratch = null;
function memoryLayer(ctx, cx, cy, hw, hh, fn, alpha) {
  const m = ctx.getTransform();
  const z = Math.hypot(m.a, m.b);
  const sw = Math.ceil(hw * 2 * z) + 4;
  const sh = Math.ceil(hh * z) + 4;
  if (!scratch) scratch = document.createElement('canvas');
  if (scratch.width < sw || scratch.height < sh) {
    scratch.width = Math.max(scratch.width, sw);
    scratch.height = Math.max(scratch.height, sh);
  }
  const l = scratch.getContext('2d');
  const sx = Math.floor(m.a * (cx - hw) + m.c * (cy - hh / 2) + m.e);
  const sy = Math.floor(m.b * (cx - hw) + m.d * (cy - hh / 2) + m.f);
  l.setTransform(1, 0, 0, 1, 0, 0);
  l.globalAlpha = 1;
  l.globalCompositeOperation = 'source-over';
  l.clearRect(0, 0, scratch.width, scratch.height);
  l.setTransform(m.a, m.b, m.c, m.d, m.e - sx, m.f - sy);
  fn(l);
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha *= alpha;
  ctx.drawImage(scratch, 0, 0, sw, sh, sx, sy, sw, sh);
  ctx.restore();
}

// where figure.js puts her tie (side view), so we can draw it on its own
function tieAt(p) {
  const s = p.s;
  const f = p.f;
  const up = [f * Math.sin(p.lean), -Math.cos(p.lean)];
  const sh = [p.x + up[0] * 88 * s, p.y + up[1] * 88 * s];
  const hl = p.lean + p.head;
  const hu = [f * Math.sin(hl), -Math.cos(hl)];
  const hx = sh[0] + hu[0] * (8 + 21) * s;
  const hy = sh[1] + hu[1] * (8 + 21) * s;
  const r = 21 * s;
  const bx = -f * Math.cos(hl);
  const by = -Math.sin(hl);
  const ux = Math.sin(hl) * f;
  const uy = -Math.cos(hl);
  const ax = hx + (bx * 0.8 + ux * 0.45) * r;
  const ay = hy + (by * 0.8 + uy * 0.45) * r;
  return [ax + bx * r * 0.18, ay + by * r * 0.18];
}

function boyOver(p, t) {
  // head: back from the empty edge, then to her, then after her
  const track = clamp((herX(t) - BOY.x) / 380, -1, 1);
  const toHer = smooth(t, 83.75, 84.3);
  const ahead = lerp(-1, 0, smooth(t, T.back0, T.back1));
  let turn = lerp(ahead, track, toHer);
  if (t > T.gone) turn = Math.min(turn, -1);
  // the reach: the window-side hand comes up from behind the seat, then the
  // arm stretches to the glass and slides after her
  const up = smooth(t, T.reach0, T.reach0 + 0.28);
  const r = smooth(t, T.reach0 + 0.2, T.reach1);
  const slide = smooth(t, T.reach1, T.gone + 0.1);
  // (angles: the forearm turns up through the inside, behind the seat back,
  //  so it is written past -2π rather than swinging out sideways)
  let aA1 = lerp(p.aA1, 0.9, up);
  let aA2 = lerp(p.aA2, -4.68, up);
  aA1 = lerp(aA1, lerp(2.0, 2.16, slide), r);
  aA2 = lerp(aA2, lerp(-6.03, -6.2, slide), r);
  const lean = p.lean - 0.06 * r - 0.03 * slide;
  const head = 0.1 * turn - 0.05 * r - 0.06 * smooth(t, 86.9, 87.6);
  return { turn, aA1, aA2, lean, head };
}
