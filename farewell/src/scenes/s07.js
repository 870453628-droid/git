// s07 — 借过的作业、送出的礼物、说过的话语，早就是此生的最后一次。
// Three moments, each in a frame: she passes him her homework; he gives her a
// small gift; they talk. Each freezes, turns into an old photograph and drops
// onto the table. Then the three lie together and quietly bleach — the last
// one the faintest.
import { COL, F, lerp, prog, smooth, ease, hash, path, ellipsePts, dot, setStill, camera } from '../lib.js';
import { figure, pose } from '../figure.js';
import { frameBox, tree } from '../sets.js';
import { day, her, tiePos, DAY, DAY_CLOSE } from './s06.js';

const LIVE = DAY_CLOSE; // same place and size as the last frame of s06
const PW = DAY.w * LIVE.k; // image size in px
const PH = DAY.h * LIVE.k;
const MARGIN = 26;
const CW = Math.ceil(PW + MARGIN * 2);
const CH = Math.ceil(PH + MARGIN * 2);
const CARD = '#f2ede2'; // photo paper

// When each moment freezes (scene-local seconds) and where its photo comes to rest.
const SHOTS = [
  { tf: 1.0, rest: { x: 645, y: 842, s: 0.34, r: -0.075 } },
  { tf: 2.45, rest: { x: 962, y: 860, s: 0.34, r: 0.05 } },
  { tf: 4.1, rest: { x: 1278, y: 838, s: 0.34, r: -0.035 } },
];
const APPEAR = [-1, 1.3, 2.75]; // when each live frame fades in
const FADE_IN = 0.22;

export default {
  draw(ctx, lt, info) {
    const t = info.t;
    // final beat: the camera settles on the three photos
    const push = smooth(lt, 4.55, 6.3, ease.inOut);
    const cam = { x: 960, y: lerp(540, 838, push), z: lerp(1, 1.42, push) };
    camera(ctx, cam, () => {
      // photos already on the table (older first), then the live frame, then the falling one
      const falling = [];
      for (let i = 0; i < 3; i++) {
        const sh = SHOTS[i];
        if (lt < sh.tf) continue;
        const k = prog(lt, sh.tf + 0.18, sh.tf + 0.78);
        if (k >= 1) drawPhoto(ctx, i, photoState(i, lt));
        else falling.push(i);
      }
      // the live moment
      for (let i = 0; i < 3; i++) {
        const sh = SHOTS[i];
        if (lt >= sh.tf) continue;
        const a = i === 0 ? 1 : smooth(lt, APPEAR[i], APPEAR[i] + FADE_IN);
        if (a <= 0.001) continue;
        const V = { x: LIVE.x, y: LIVE.y, k: LIVE.k };
        ctx.save();
        ctx.globalAlpha *= a;
        drawShot(ctx, i, V, lt, { t });
        ctx.restore();
      }
      for (const i of falling) drawPhoto(ctx, i, photoState(i, lt));
    });
  },
};

// ------------------------------------------------------------ photographs

function photoState(i, lt) {
  const sh = SHOTS[i];
  const R = sh.rest;
  const k = prog(lt, sh.tf + 0.18, sh.tf + 0.78);
  const e = ease.inOut(k);
  const lift = Math.sin(Math.PI * k) * (1 - k);
  // bleaching at the end: the last one the faintest
  const bl = smooth(lt, 4.85 + i * 0.12, 6.15, ease.inOut);
  const fade = [0.34, 0.55, 0.86][i] * bl;
  return {
    x: lerp(LIVE.x, R.x, e),
    y: lerp(LIVE.y, R.y, ease.in(k) * 0.55 + e * 0.45) - 40 * lift,
    s: lerp(1, R.s, ease.out3(k)),
    r: lerp(0, R.r, ease.out(k)) + 0.025 * Math.sin(k * Math.PI * 1.5) * (1 - k),
    border: smooth(lt, sh.tf, sh.tf + 0.28, ease.out),
    sepia: smooth(lt, sh.tf + 0.04, sh.tf + 0.45),
    flash: 1 - smooth(lt, sh.tf, sh.tf + 0.2),
    land: k,
    fade,
  };
}

const cache = [];
function photoCanvas(i) {
  if (cache[i]) return cache[i];
  const c = document.createElement('canvas');
  c.width = CW;
  c.height = CH;
  const l = c.getContext('2d');
  l.fillStyle = COL.paper;
  l.fillRect(MARGIN, MARGIN, PW, PH);
  const gold = [];
  const savedStroke = F.stroke;
  const savedStill = F.still;
  setStill(true);
  drawShot(l, i, { x: CW / 2, y: CH / 2, k: LIVE.k }, SHOTS[i].tf, { photo: true, gold, t: 45.5 + SHOTS[i].tf });
  setStill(savedStill);
  F.stroke = savedStroke;
  cache[i] = { c, gold };
  return cache[i];
}

function drawPhoto(ctx, i, st) {
  const { c, gold } = photoCanvas(i);
  const B = 30 * st.border; // white border
  const cw = PW + 2 * B;
  const ch = PH + 2 * B;
  // shadow: bigger while it is in the air
  const m = ctx.getTransform();
  const zs = Math.hypot(m.a, m.b) * st.s;
  ctx.save();
  ctx.translate(st.x, st.y);
  ctx.rotate(st.r);
  ctx.scale(st.s, st.s);
  if (st.border > 0.01) {
    ctx.save();
    const air = 1 - smooth(st.land, 0.7, 1);
    ctx.shadowColor = `rgba(60,45,25,${0.2 + 0.12 * air})`;
    ctx.shadowBlur = (14 + 30 * air) * zs;
    ctx.shadowOffsetX = (4 + 14 * air) * zs;
    ctx.shadowOffsetY = (6 + 22 * air) * zs;
    ctx.fillStyle = CARD;
    ctx.globalAlpha *= st.border;
    ctx.fillRect(-cw / 2, -ch / 2, cw, ch);
    ctx.restore();
  }
  // the picture: tinted brown like an old print, then bleached toward the card
  ctx.save();
  const sep = st.sepia;
  ctx.globalAlpha *= 1 - st.fade;
  const tone = [lerp(255, 236, sep), lerp(255, 216, sep), lerp(255, 176, sep)].map((v) => Math.round(v));
  ctx.fillStyle = `rgb(${tone[0]},${tone[1]},${tone[2]})`;
  ctx.fillRect(-PW / 2, -PH / 2, PW, PH);
  ctx.globalCompositeOperation = 'multiply';
  ctx.drawImage(c, -CW / 2, -CH / 2);
  ctx.restore();
  // her hair tie stays gold
  for (const g of gold) dot(ctx, g.x - CW / 2, g.y - CH / 2, g.r, COL.gold, Math.max(0.25, 1 - st.fade * 0.9));
  // age: a couple of fine scratches and a worn corner
  if (sep > 0.01) {
    const r = (n) => hash(i * 31 + n);
    ctx.save();
    ctx.globalAlpha *= sep;
    for (let n = 0; n < 2; n++) {
      const x0 = -PW / 2 + PW * (0.15 + 0.7 * r(n));
      const y0 = -PH / 2 + PH * 0.05;
      const x1 = x0 + PW * (r(n + 5) - 0.5) * 0.25;
      const y1 = y0 + PH * (0.45 + 0.45 * r(n + 9));
      path(ctx, [[x0, y0], [lerp(x0, x1, 0.5) + 6, lerp(y0, y1, 0.5)], [x1, y1]], { w: 1.6, color: 'rgba(255,252,244,0.75)', seed: 4100 + i * 10 + n, wobble: 1.5, still: true });
    }
    ctx.restore();
  }
  if (st.border > 0.01) {
    path(ctx, [[-cw / 2, -ch / 2], [cw / 2, -ch / 2], [cw / 2, ch / 2], [-cw / 2, ch / 2]], { w: 2.4, close: true, alpha: 0.35 * st.border, seed: 4200 + i, wobble: 0.8, still: true });
  }
  // the shutter: a brief wash of light as it freezes
  if (st.flash > 0.001) {
    ctx.fillStyle = `rgba(252,249,240,${(0.7 * st.flash).toFixed(3)})`;
    ctx.fillRect(-CW / 2, -CH / 2, CW, CH);
  }
  ctx.restore();
}

// --------------------------------------------------------------- moments

function drawShot(ctx, i, V, lt, o) {
  F.stroke = 20000 + i * 1000;
  if (i === 0) homework(ctx, V, lt, o);
  else if (i === 1) gift(ctx, V, lt, o);
  else talk(ctx, V, lt, o);
}

const tie = (o) => (o.photo ? { noTie: true } : {});
function recordTie(o, p, j) {
  if (!o.photo) return;
  const tp = tiePos(p, j);
  o.gold.push({ x: tp[0], y: tp[1], r: Math.max(4, 6 * p.s) });
}

// (1) 借过的作业 — she passes him her notebook across the two desks
function homework(ctx, V, lt, o) {
  const u = lt;
  const give = smooth(u, -0.05, 0.38, ease.inOut); // her arm out
  const take = smooth(u, 0.2, 0.5, ease.inOut); // his arm out
  const back = smooth(u, 0.52, 0.92, ease.inOut); // he draws it in
  const herBack = smooth(u, 0.55, 0.9, ease.inOut);
  const girlPose = {
    turn: lerp(-0.75 * give, -0.3, herBack),
    head: lerp(-0.1 * give, -0.12, herBack),
    lean: -0.05 * give * (1 - herBack),
    aA1: lerp(lerp(0.3, 1.32, give), 0.3, herBack),
    aA2: lerp(lerp(-0.9, 0.1, give), -0.9, herBack),
    tail: 0.12 * Math.sin((o.t ?? 0) * 1.3),
  };
  const reach = take * (1 - back);
  // he takes it and holds it up in front of him
  const boyPose = {
    turn: lerp(0.7 * Math.max(take, 0.4 * give), 0.12, back),
    head: lerp(0.06 * take, 0.14, back),
    look: 0.45 * back,
    lean: 0.04 * reach,
    aB1: lerp(lerp(0.16, 1.3, take), 0.9, back),
    aB2: lerp(lerp(0.02, 0.1, take), -2.7, back),
  };
  const r = day(ctx, V, {
    t: o.t, seed: 21000, boyPose, girlPose, headFill: COL.paper, girlOpts: tie(o),
  });
  if (r.girl) recordTie(o, r.girlP, r.girl);
  // the notebook: in her hand until he has it
  const hasIt = u >= 0.5;
  const hand = hasIt ? r.boy.handB : r.girl.handA;
  const na = smooth(u, 0.02, 0.16);
  if (hand && na > 0.01) {
    ctx.save();
    ctx.globalAlpha *= na;
    const k = V.k;
    const nw = 22 * k;
    const nh = 28 * k;
    const cx = hand[0] + (hasIt ? 2 : 4) * k;
    const cy = hand[1] - (hasIt ? 9 : 6) * k;
    const tilt = hasIt ? -0.05 : 0.08;
    const P = (x, y) => [cx + x * Math.cos(tilt) - y * Math.sin(tilt), cy + x * Math.sin(tilt) + y * Math.cos(tilt)];
    path(ctx, [P(-nw / 2, -nh / 2), P(nw / 2, -nh / 2), P(nw / 2, nh / 2), P(-nw / 2, nh / 2)], { w: 2.2 * Math.pow(k, 0.6), close: true, fill: COL.paper, seed: 21500 });
    path(ctx, [P(-nw / 2 + 4 * k, -nh / 2), P(-nw / 2 + 4 * k, nh / 2)], { w: 1.4 * Math.pow(k, 0.6), seed: 21501 });
    for (let n = 0; n < 3; n++) {
      const yy = -nh / 2 + (7 + n * 6) * k;
      path(ctx, [P(-nw / 2 + 8 * k, yy), P(nw / 2 - 4 * k - (n === 2 ? 5 * k : 0), yy)], { w: 1.1 * Math.pow(k, 0.6), alpha: 0.7, seed: 21502 + n });
    }
    ctx.restore();
  }
}

// (2) 送出的礼物 — he holds out a small box; she takes it
function gift(ctx, V, lt, o) {
  const k = V.k;
  const X = (x) => V.x + x * k;
  const Y = (y) => V.y + y * k;
  const lw = (w) => w * Math.pow(k, 0.6);
  const u = lt - APPEAR[1];
  const s = 0.78 * k;
  const ground = 118;
  frameBox(ctx, X(-210), Y(-130), 420 * k, 260 * k, { w: lw(3.8), over: 7 * Math.sqrt(k), seed: 22001 });
  path(ctx, [[X(-200), Y(ground)], [X(200), Y(ground + 1)]], { w: lw(2.4), seed: 22002 });
  tree(ctx, X(160), Y(ground), 1.25 * k, { w: lw(2.4), seed: 22004 });
  tree(ctx, X(-165), Y(ground), 0.95 * k, { w: lw(2.2), seed: 22008 });

  const offer = smooth(u, 0.2, 0.55, ease.inOut);
  const take = smooth(u, 0.42, 0.72, ease.inOut);
  const hold = smooth(u, 0.75, 1.1, ease.inOut);
  const hy = Y(ground) - 114 * s;
  const boy = pose({
    x: X(-60), y: hy, s, f: 1,
    aA1: lerp(0.75, 1.5, offer) - 1.25 * smooth(u, 0.85, 1.1), aA2: lerp(1.3, 0.12, offer),
    aB1: lerp(0.65, -0.1, offer), aB2: lerp(1.45, 0.2, offer),
    head: 0.22 * offer - 0.12 * hold, lean: 0.05 * offer, look: 0.5 * offer - 0.3 * hold,
  });
  const reach = take * (1 - hold);
  const girl = pose({
    x: X(60), y: hy, s, f: -1,
    aA1: lerp(0.1, 1.4, reach) + lerp(0, 0.5, hold), aA2: lerp(0.1, 0.12, reach) + lerp(0, 1.2, hold),
    aB1: lerp(-0.1, 1.2, reach) + lerp(0, 0.45, hold), aB2: lerp(0.15, 0.25, reach) + lerp(0, 1.3, hold),
    head: -0.12 * hold + 0.06 * take, lean: -0.05 * hold, look: -0.2 * hold,
    tail: 0.15 * Math.sin((o.t ?? 0) * 2.2) + 0.35 * hold * Math.sin(u * 7) * (1 - hold * 0.6),
  });
  const bj = figure(ctx, boy, { id: 1, headFill: COL.paper });
  const gj = her(ctx, girl, { headFill: COL.paper, ...tie(o) });
  recordTie(o, girl, gj);
  // the box (with a gold ribbon)
  const hasIt = u >= 0.72;
  let bx, by;
  if (!hasIt) {
    const hA = bj.handA;
    const hB = bj.handB;
    bx = lerp((hA[0] + hB[0]) / 2, hA[0], offer) + 3 * k;
    by = lerp((hA[1] + hB[1]) / 2, hA[1], offer) - 4 * k;
  } else {
    const hA = gj.handA;
    bx = hA[0] + 2 * k;
    by = hA[1] - 2 * k;
  }
  const bw = 17 * k;
  const bh = 14 * k;
  path(ctx, [[bx - bw / 2, by - bh / 2], [bx + bw / 2, by - bh / 2], [bx + bw / 2, by + bh / 2], [bx - bw / 2, by + bh / 2]], { w: lw(2.2), close: true, fill: COL.paper, seed: 22020 });
  const rib = { w: lw(2.2), color: COL.gold, wobble: 0.6 };
  path(ctx, [[bx, by - bh / 2], [bx, by + bh / 2]], { ...rib, seed: 22021 });
  path(ctx, [[bx - bw / 2, by], [bx + bw / 2, by]], { ...rib, seed: 22022 });
  path(ctx, ellipsePts(bx - 3.5 * k, by - bh / 2 - 2.5 * k, 3.5 * k, 2.4 * k, 0, Math.PI * 2, 10), { ...rib, seed: 22023 });
  path(ctx, ellipsePts(bx + 3.5 * k, by - bh / 2 - 2.5 * k, 3.5 * k, 2.4 * k, 0, Math.PI * 2, 10), { ...rib, seed: 22024 });
}

// (3) 说过的话语 — closer: the two talking, words flying between them
function talk(ctx, V, lt, o) {
  const k = V.k;
  const X = (x) => V.x + x * k;
  const Y = (y) => V.y + y * k;
  const lw = (w) => w * Math.pow(k, 0.6);
  const u = lt - APPEAR[2];
  const tt = o.t ?? 0;
  frameBox(ctx, X(-210), Y(-130), 420 * k, 260 * k, { w: lw(3.8), over: 7 * Math.sqrt(k), seed: 23001 });
  ctx.save();
  ctx.beginPath();
  ctx.rect(X(-210), Y(-130), 420 * k, 260 * k);
  ctx.clip();
  const s = 1.12 * k;
  const hip = Y(132);
  const laugh = Math.sin(u * 11) * smooth(u, 0.55, 0.75) * (1 - smooth(u, 1.05, 1.3));
  // he listens with his hands in his pockets, and laughs
  const boy = pose({ x: X(-82), y: hip, s, f: 1, aA1: 0.12, aA2: -0.5, aB1: -0.15, aB2: 0.45, head: -0.08 - 0.1 * laugh, lean: -0.02 - 0.04 * laugh, look: -0.1 });
  const gest = smooth(u, 0.15, 0.4) * (1 - smooth(u, 0.5, 0.75)) + smooth(u, 0.85, 1.05);
  const girl = pose({
    x: X(82), y: hip, s, f: -1,
    aA1: 0.35 + 0.75 * gest, aA2: 0.35 + 0.95 * gest + 0.18 * Math.sin(u * 9) * gest, aB1: 0.1, aB2: 0.35,
    head: 0.04 * Math.sin(u * 6), lean: 0.03, look: -0.1,
    tail: 0.15 * Math.sin(tt * 2.4),
  });
  figure(ctx, boy, { id: 1, headFill: COL.paper });
  const gj = her(ctx, girl, { headFill: COL.paper, ...tie(o) });
  recordTie(o, girl, gj);
  ctx.restore();
  // speech: three bubbles, back and forth
  const bubbles = [
    { t0: 0.12, t1: 0.72, x: 44, y: -84, rx: 50, ry: 26, tx: 70, ty: -40, lines: 2, sd: 23100 },
    { t0: 0.42, t1: 9, x: -52, y: -94, rx: 56, ry: 28, tx: -70, ty: -44, lines: 3, sd: 23200 },
    { t0: 0.8, t1: 9, x: 56, y: -80, rx: 46, ry: 25, tx: 72, ty: -40, lines: 2, sd: 23300 },
  ];
  for (const b of bubbles) {
    const a = smooth(u, b.t0, b.t0 + 0.12) * (1 - smooth(u, b.t1, b.t1 + 0.15));
    if (a <= 0.01) continue;
    const pop = ease.outBack(prog(u, b.t0, b.t0 + 0.2));
    const cx = X(b.x);
    const cy = Y(b.y);
    const rx = b.rx * k * (0.6 + 0.4 * pop);
    const ry = b.ry * k * (0.6 + 0.4 * pop);
    const pts = ellipsePts(cx, cy, rx, ry, 0, Math.PI * 2, 28);
    // tail toward the speaker
    const ang = Math.atan2(Y(b.ty) - cy, X(b.tx) - cx);
    const tail = [cx + Math.cos(ang - 0.22) * rx * 0.95, cy + Math.sin(ang - 0.22) * ry * 0.95];
    const tip = [lerp(cx, X(b.tx), 0.92), lerp(cy, Y(b.ty), 0.92)];
    const tail2 = [cx + Math.cos(ang + 0.22) * rx * 0.95, cy + Math.sin(ang + 0.22) * ry * 0.95];
    path(ctx, pts, { w: lw(2.4), alpha: a, fill: COL.paper, close: true, seed: b.sd });
    path(ctx, [tail, tip, tail2], { w: lw(2.4), alpha: a, fill: COL.paper, seed: b.sd + 1 });
    for (let n = 0; n < b.lines; n++) {
      const yy = cy + (n - (b.lines - 1) / 2) * 13 * k;
      const half = rx * (0.62 - 0.12 * Math.abs(n - (b.lines - 1) / 2)) * (n === b.lines - 1 ? 0.75 : 1);
      const sq = [];
      for (let m = 0; m <= 14; m++) {
        const uu = m / 14;
        sq.push([cx - rx * 0.62 + uu * half * 2, yy + Math.sin(uu * 13 + n * 2 + b.sd) * 3.2 * k]);
      }
      path(ctx, sq, { w: lw(1.7), alpha: a * 0.85, seed: b.sd + 10 + n, draw: smooth(u, b.t0 + 0.08 + n * 0.08, b.t0 + 0.3 + n * 0.08) });
    }
  }
}
