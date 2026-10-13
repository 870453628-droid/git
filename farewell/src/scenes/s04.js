// s04 — 那整整三年无话不说的朝夕相处，又算什么。
// Match-dissolve from the fallen plane to a paper plane lying on her desk:
// back then, it always reached her. She picks it up and turns to him. Then
// three years go by in a time-lapse: the two deskmates — inside ONE frame —
// write, chat, laugh, doze, poke, pass notes, share a book, while sun and moon
// whip across the window, the seasons turn three times and the clock spins.
// It slows to a quiet afternoon (she gazes off, he glances at her) and
// dissolves into the platform of s05.
import { COL, TAU, lerp, clamp, prog, smooth, keys, ease, hash, path, line, rect, circle, ellipse, ellipsePts, dot, hatch, camera } from '../lib.js';
import { figure, pose, joints, BODY } from '../figure.js';
import { frameBox, sun, moon, paperPlane } from '../sets.js';

const FS = 1.6; // figure scale
const HIP = 742;
const BX = 830; // him
const GX = 1090; // her
const DB = 690; // desk back edge
const DF = 728; // desk front edge
const DL = 640;
const DM = 960;
const DR = 1280;
const WIN = { x: 700, y: 150, w: 520, h: 290 };
const ROOM = { x: 360, y: 92, w: 1200, h: 848 };
// the paper plane on her desk; s03's last frame puts its fallen plane here
export const DESK_PLANE = { x: 1040, y: 708, s: 2.3 / 1.12, ang: 0.13 };
export const CAM0 = { x: 960, y: 520, z: 1.12 };

// --------------------------------------------------------------- time-lapse
// day-cycle rate (days per second): still, then racing, then slowing to rest
function rate(lt) {
  return 2.7 * smooth(lt, 0.6, 1.0, ease.inOut) * (1 - smooth(lt, 2.55, 3.45, ease.out3));
}
const DT = 1 / 240;
function rawDays(lt) {
  // pure numerical integral of rate() from 0 to lt
  let d = 0;
  const end = clamp(lt, 0, 3.6);
  for (let x = 0; x < end; x += DT) d += rate(x + DT * 0.5) * Math.min(DT, end - x);
  return d;
}
// scale so it opens on a morning and comes to rest at the same hour, n days on
const RAW = rawDays(3.6);
const N_DAYS = Math.max(1, Math.round(RAW));
const SCALE = N_DAYS / RAW;
const daysAt = (lt) => rawDays(lt) * SCALE;
const TOTAL_DAYS = N_DAYS;
const DAY0 = 0.2;

// --------------------------------------------------------------- vignettes
// Each returns settings for him (b) and her (g). Hands: L/R targets for the
// screen-left / screen-right hand. chinL/chinR: elbow on the desk, hand at
// the chin. k = 0..1 within the vignette.
const deskY = (u) => lerp(DB, DF, u);
const CHEEK_Y = HIP - 166;

const V = [
  // 0: the plane on her desk; she picks it up and holds it up to him
  {
    t0: -1, t1: 0.84,
    f(k, lt) {
      const pick = smooth(lt, 0.16, 0.38);
      const lift = smooth(lt, 0.36, 0.64);
      const P = DESK_PLANE;
      const ph = [lerp(P.x, GX - 146, lift), lerp(P.y, 614, lift)];
      const ang = lerp(P.ang, -0.32, lift);
      const grip = [ph[0] + 18, ph[1] + 10];
      const turnG = smooth(lt, 0.42, 0.64);
      const turnB = smooth(lt, 0.48, 0.7);
      return {
        b: { turn: lerp(0.05, 0.7, turnB), look: lerp(0.8, 0.05, turnB), head: 0.06 * turnB, dy: lerp(5, 0, turnB), L: [BX - 30, deskY(0.45)], R: [BX + 32, deskY(0.55)], pen: 'L' },
        g: {
          turn: lerp(0.1, -0.8, turnG), look: lerp(0.8, 0, turnG), head: -0.12 * turnG,
          L: pick > 0 ? [lerp(GX - 34, grip[0], pick), lerp(deskY(0.5), grip[1], pick)] : [GX - 34, deskY(0.5)],
          R: [GX + 34, deskY(0.55)],
        },
        props: (ctx) => {
          notebook(ctx, BX - 6, 0);
          notebook(ctx, GX + 34, 1);
        },
        over: (ctx) => paperPlane(ctx, ph[0], ph[1], ang, P.s, { seed: 5100 }),
      };
    },
  },
  // 1: both writing
  {
    t0: 0.84, t1: 1.16,
    f(k, lt) {
      const w = (ph) => [Math.sin(lt * 40 + ph) * 5, Math.cos(lt * 31 + ph) * 2];
      const a = w(0);
      const c = w(2);
      return {
        b: { look: 1, head: 0.06, dy: 6, L: [BX - 30 + a[0], deskY(0.45) + a[1]], R: [BX + 34, deskY(0.55)], pen: 'L' },
        g: { look: 1, head: -0.05, dy: 6, L: [GX - 36, deskY(0.55)], R: [GX + 28 + c[0], deskY(0.45) + c[1]], pen: 'R' },
        props: (ctx) => {
          notebook(ctx, BX - 22, 2);
          notebook(ctx, GX + 22, 3);
        },
      };
    },
  },
  // 2: she chatters away, he listens, chin in hand
  {
    t0: 1.16, t1: 1.46,
    f(k, lt) {
      const gest = Math.sin(lt * 26) * 7;
      return {
        b: { turn: 0.8, look: 0.05, head: 0.14, L: [BX - 30, deskY(0.5)], chinR: [BX + 36, CHEEK_Y] },
        g: { turn: -0.8, head: -0.12, lean: -0.03, L: [GX - 52, 618 + gest], elbowL: 'down', R: [GX + 30, deskY(0.55)] },
        props: (ctx) => {
          notebook(ctx, BX - 20, 4);
          notebook(ctx, GX + 26, 5);
        },
        over: (ctx) => speech(ctx, DM - 2, 488, lt, 0),
      };
    },
  },
  // 3: both laughing
  {
    t0: 1.46, t1: 1.74,
    f(k, lt) {
      const sb = Math.abs(Math.sin(lt * 34)) * 4;
      const sg = Math.abs(Math.sin(lt * 34 + 1)) * 4;
      return {
        b: { eye: 'closed', look: -0.4, head: -0.14, lean: -0.04, dy: -sb, L: [BX - 40, deskY(0.4)], R: [BX + 38, deskY(0.4)] },
        g: { eye: 'closed', look: -0.4, head: -0.2, lean: -0.07, dy: -sg, L: [GX - 44, deskY(0.4)], R: [GX + 40, deskY(0.45)] },
        props: (ctx) => {
          notebook(ctx, BX - 4, 6);
          notebook(ctx, GX + 30, 7);
        },
        over: (ctx) => {
          joy(ctx, BX - 6, 556, lt, 0);
          joy(ctx, GX - 14, 556, lt, 1);
        },
      };
    },
  },
  // 4: she dozes on the desk, he writes and glances at her
  {
    t0: 1.74, t1: 2.0,
    f(k, lt) {
      return {
        b: { turn: 0.7, look: 0.35, head: 0.05, L: [BX - 30 + Math.sin(lt * 40) * 4, deskY(0.45)], R: [BX + 34, deskY(0.55)], pen: 'L' },
        g: { sleep: true },
        props: (ctx) => notebook(ctx, BX - 22, 8),
        over: (ctx) => zzz(ctx, GX + 70, 600, lt),
      };
    },
  },
  // 5: he pokes her with his pen, she flinches
  {
    t0: 2.0, t1: 2.26,
    f(k, lt) {
      const jab = Math.sin(lt * 40) * 4;
      return {
        b: { turn: 0.85, head: 0.12, lean: 0.2, dy: 4, L: [BX - 24, deskY(0.5)], R: [GX - 54 + jab, 652], pen: 'R', penAng: -0.25 },
        g: { turn: -0.85, head: 0.2, lean: 0.12, look: -0.1, L: [GX - 30, deskY(0.55)], R: [GX + 40, deskY(0.5)] },
        props: (ctx) => {
          notebook(ctx, BX - 30, 9);
          notebook(ctx, GX + 30, 10);
        },
        over: (ctx) => {
          // a little "!" of surprise
          line(ctx, GX + 62, 478, GX + 68, 504, { w: 3.6, seed: 6150, wobble: 0 });
          dot(ctx, GX + 70, 517, 3.6);
        },
      };
    },
  },
  // 6: a folded note slid across to her
  {
    t0: 2.26, t1: 2.54,
    f(k, lt) {
      const nx = lerp(DM - 46, DM + 30, smooth(k, 0.05, 0.6));
      return {
        b: { turn: 0.5, look: 0.7, L: [BX - 30, deskY(0.5)], R: [nx - 14, deskY(0.5)] },
        g: { turn: -0.5, look: 0.8, L: [lerp(GX - 40, DM + 62, smooth(k, 0.3, 0.8)), deskY(0.55)], R: [GX + 34, deskY(0.5)] },
        props: (ctx) => {
          notebook(ctx, BX - 30, 11);
          notebook(ctx, GX + 30, 12);
          note(ctx, nx, deskY(0.45));
        },
      };
    },
  },
  // 7: one book between them, heads together
  {
    t0: 2.54, t1: 2.86,
    f(k, lt) {
      return {
        b: { lean: 0.15, turn: 0.4, look: 0.9, head: 0.1, L: [BX + 14, deskY(0.55)], R: [DM - 40, deskY(0.4)] },
        g: { lean: -0.15, turn: -0.4, look: 0.9, head: -0.1, L: [DM + 40, deskY(0.4)], R: [GX - 14, deskY(0.55)] },
        props: (ctx) => openBook(ctx, DM, deskY(0.42)),
      };
    },
  },
  // 8: a quiet afternoon — she gazes off, chin in hand; he glances at her
  {
    t0: 2.86, t1: 9,
    f(k, lt) {
      const g = smooth(lt, 3.0, 3.45);
      return {
        b: { turn: lerp(0.05, 0.62, g), look: lerp(0.3, 0.05, g), head: 0.05 * g, L: [BX - 30, deskY(0.5)], R: [BX + 32, deskY(0.5)] },
        g: { turn: 0.1, look: -0.7, head: 0.16, L: [GX - 40, deskY(0.55)], chinR: [GX + 38, CHEEK_Y + 2] },
        props: (ctx) => {
          notebook(ctx, BX - 4, 13);
          notebook(ctx, GX - 24, 14);
        },
      };
    },
  },
];

// --------------------------------------------------------------- scene
export default {
  fadeIn: 1.0,
  fadeOut: 0.9,
  draw(ctx, lt) {
    const days = DAY0 + daysAt(lt);
    const prog01 = clamp(daysAt(lt) / TOTAL_DAYS);
    const cam = { ...CAM0, z: CAM0.z + 0.04 * smooth(lt, 0.5, 4.2, ease.sine) };
    camera(ctx, cam, () => {
      room(ctx, lt, days, prog01);
      const v = V.find((q) => lt >= q.t0 && lt < q.t1) ?? V[V.length - 1];
      const st = v.f(prog(lt, v.t0, v.t1), lt);
      desks(ctx);
      if (st.props) st.props(ctx);
      person(ctx, BX, st.b, { id: 1 });
      person(ctx, GX, st.g, { id: 2, ponytail: true });
      if (st.over) st.over(ctx);
    });
  },
};

// --------------------------------------------------------------- people
// Front view, sitting behind the desk. Upper body via figure(); the part
// below the desk's back edge is clipped; forearms are drawn over the desk.
function person(ctx, x, o, fo) {
  if (o.sleep) return sleeper(ctx, x, fo);
  const p = pose({
    view: 'front', x, y: HIP + (o.dy ?? 0), s: FS,
    lean: o.lean ?? 0, head: o.head ?? 0, turn: o.turn ?? 0, look: o.look ?? 0,
  });
  const j0 = joints(p);
  const arm = (sh, tgt, side, pref, chin) => {
    // cheek in hand: elbow on the desk out to the side, forearm up to the cheek
    if (chin) return { a1: 0.55, hand: chin };
    return ik(sh, tgt, side, pref);
  };
  const L = arm(j0.shL, o.L, -1, o.elbowL, o.chinL);
  const R = arm(j0.shR, o.R, 1, o.elbowR, o.chinR);
  p.aA1 = L.a1;
  p.aB1 = R.a1;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x - 400, 0, 800, DB + 1);
  ctx.clip();
  const j = figure(ctx, p, { ...fo, arms: 'upper', legs: false, eye: o.eye });
  ctx.restore();
  const w = Math.max(2, 4.6 * Math.pow(FS, 0.85));
  const seed = fo.id * 41 + 20;
  path(ctx, [j.elbowA, L.hand], { w, seed, wobble: 1.1 });
  path(ctx, [j.elbowB, R.hand], { w, seed: seed + 1, wobble: 1.1 });
  if (o.pen) {
    const h = o.pen === 'L' ? L.hand : R.hand;
    const a = o.penAng ?? (o.pen === 'L' ? -2.3 : -0.85);
    line(ctx, h[0] - Math.cos(a) * 6, h[1] - Math.sin(a) * 6, h[0] + Math.cos(a) * 32, h[1] + Math.sin(a) * 32, { w: 3, seed: seed + 3, wobble: 0.3 });
  }
}

// two-bone IK, front view. side -1 = screen-left arm. pref 'down' puts the
// elbow below, default spreads it outward. The drawn forearm may stretch a
// little (it is drawn by hand) so a reach across the desks can land.
function ik(sh, tgt, side, pref) {
  const ua = BODY.ua * FS;
  const la = BODY.la * FS;
  const dx = tgt[0] - sh[0];
  const dy = tgt[1] - sh[1];
  const l = Math.hypot(dx, dy);
  const maxR = ua + la * 1.45;
  const hand = l > maxR ? [sh[0] + (dx / l) * maxR, sh[1] + (dy / l) * maxR] : tgt;
  const d = Math.min(l, ua + la - 0.5);
  const th = Math.atan2(dy, dx);
  const al = Math.acos(clamp((ua * ua + d * d - la * la) / (2 * ua * d), -1, 1));
  const c1 = [sh[0] + Math.cos(th + al) * ua, sh[1] + Math.sin(th + al) * ua];
  const c2 = [sh[0] + Math.cos(th - al) * ua, sh[1] + Math.sin(th - al) * ua];
  const score = (e) => (pref === 'down' ? e[1] : side * (e[0] - sh[0]) + 0.2 * e[1]);
  const el = score(c1) > score(c2) ? c1 : c2;
  // back to the rig's angle (from straight down, + = outward)
  const a1 = Math.atan2(side * (el[0] - sh[0]), el[1] - sh[1]);
  return { a1, hand };
}

// her, asleep on her folded arms, cheek down, face turned toward him
function sleeper(ctx, x, fo) {
  const hx = x - 16;
  const hy = DB - 26;
  // shoulders: her back rounded behind the head
  path(ctx, [[x - 92, DB + 14], [x - 70, DB - 22], [x - 10, DB - 46], [x + 50, DB - 30], [x + 84, DB + 12]], { w: 5.6, seed: fo.id * 41 + 24, wobble: 0.8 });
  // head via the rig, everything below it hidden behind the arms
  const p = pose({ view: 'front', x: hx + 61, y: hy + 172, s: FS, lean: -0.22, head: -0.5, turn: -0.6, look: 0.5 });
  ctx.save();
  ctx.beginPath();
  ctx.rect(x - 400, 0, 800, DB + 6);
  ctx.clip();
  figure(ctx, p, { ...fo, arms: 'upper', legs: false, eye: 'closed' });
  ctx.restore();
  // folded forearms on the desk, one over the other, under her cheek
  const w = Math.max(2, 4.6 * Math.pow(FS, 0.85));
  path(ctx, [[x - 92, DB + 16], [x - 30, DB + 6], [x + 46, DB + 8]], { w, seed: fo.id * 41 + 25, wobble: 0.8 });
  path(ctx, [[x + 86, DB + 16], [x + 20, DB + 20], [x - 46, DB + 16]], { w, seed: fo.id * 41 + 26, wobble: 0.8 });
}

// --------------------------------------------------------------- room
function room(ctx, lt, days, p01) {
  frameBox(ctx, ROOM.x, ROOM.y, ROOM.w, ROOM.h, { seed: 6000, w: 5 });
  windowView(ctx, lt, days, p01);
  clock(ctx, 530, 250, 50, days);
  calendar(ctx, 1336, 200, p01);
  // floor line behind the desks
  path(ctx, [[ROOM.x, 872], [ROOM.x + ROOM.w, 874]], { w: 2.2, alpha: 0.4, seed: 6001 });
}

function windowView(ctx, lt, days, p01) {
  const { x, y, w, h } = WIN;
  const ph = ((days % 1) + 1) % 1; // 0..0.5 day, 0.5..1 night
  const night = smooth(ph, 0.47, 0.55) * (1 - smooth(ph, 0.95, 1.0));
  // season: 0 autumn, 1 winter, 2 spring, 3 summer (starts in September)
  const yr = 2.78 * p01;
  const sIdx = Math.floor((yr % 1) * 4 + 1e-6) % 4;

  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  // night sky
  if (night > 0.01) {
    ctx.save();
    ctx.globalAlpha *= 0.09 * night;
    ctx.fillStyle = COL.ink;
    ctx.fillRect(x, y, w, h);
    ctx.restore();
    hatch(ctx, [x, y, w, h], { alpha: 0.18 * night, gap: 13, seed: 6010 });
    for (let i = 0; i < 9; i++) dot(ctx, x + 30 + hash(i * 3.3) * (w - 60), y + 20 + hash(i * 5.1 + 2) * (h * 0.55), 2.2, COL.ink, 0.7 * night);
  }
  // sun by day, moon by night, arcing across
  const arc = (u) => [x - 50 + (w + 100) * u, y + h + 30 - Math.sin(Math.PI * u) * (h * 0.85)];
  if (ph < 0.5) {
    const [sx, sy] = arc(ph / 0.5);
    sun(ctx, sx, sy, 26, { spin: days * 2, w: 3, seed: 6020 });
  } else {
    const [mx, my] = arc((ph - 0.5) / 0.5);
    moon(ctx, mx, my, 22, { w: 3 });
  }
  // distant roofline
  path(ctx, [[x, y + h - 40], [x + 120, y + h - 40], [x + 120, y + h - 70], [x + 230, y + h - 70], [x + 230, y + h - 48], [x + 340, y + h - 48]], { w: 2.2, alpha: 0.55, seed: 6030 });
  // the tree outside, changing with the seasons
  treeOutside(ctx, x + w - 56, y + h, sIdx, lt);
  ctx.restore();

  // window frame & bars over everything
  rect(ctx, x, y, w, h, { w: 4.5, seed: 6040, over: 6 });
  line(ctx, x + w / 2, y, x + w / 2, y + h, { w: 3.2, seed: 6041 });
  line(ctx, x, y + h * 0.42, x + w, y + h * 0.42, { w: 3.2, seed: 6042 });
  path(ctx, [[x - 14, y + h + 8], [x + w + 14, y + h + 8]], { w: 3, seed: 6043 });
}

function treeOutside(ctx, tx, ground, s, lt) {
  // trunk and branches
  const br = [
    [[tx, ground + 10], [tx - 6, ground - 120], [tx - 14, ground - 210]],
    [[tx - 6, ground - 110], [tx - 70, ground - 170], [tx - 120, ground - 190]],
    [[tx - 10, ground - 160], [tx + 50, ground - 220], [tx + 80, ground - 236]],
    [[tx - 12, ground - 190], [tx - 50, ground - 250]],
  ];
  br.forEach((b, i) => path(ctx, b, { w: i ? 3 : 4.5, seed: 6050 + i, wobble: 0.6 }));
  const clumps = [[tx - 118, ground - 196, 34], [tx - 52, ground - 252, 38], [tx + 78, ground - 240, 34], [tx - 14, ground - 216, 40], [tx - 82, ground - 172, 26]];
  if (s === 3) {
    // summer: full
    clumps.forEach(([cx, cy, r], i) => circle(ctx, cx, cy, r, { w: 2.6, fill: COL.paper, seed: 6060 + i }));
  } else if (s === 2) {
    // spring: small new leaves and blossoms
    clumps.forEach(([cx, cy, r], i) => {
      circle(ctx, cx, cy, r * 0.62, { w: 2.2, fill: COL.paper, seed: 6060 + i });
      for (let b = 0; b < 3; b++) circle(ctx, cx + Math.cos(b * 2.1 + i) * r * 0.8, cy + Math.sin(b * 2.1 + i) * r * 0.7, 4, { w: 1.6, seed: 6070 + i * 3 + b, wobble: 0.2 });
    });
  } else if (s === 0) {
    // autumn: thinning, leaves falling
    clumps.forEach(([cx, cy, r], i) => { if (i % 2 === 0) circle(ctx, cx, cy, r * 0.8, { w: 2.4, fill: COL.paper, seed: 6060 + i }); });
    for (let i = 0; i < 6; i++) {
      const u = ((lt * 1.6 + hash(i * 7.1)) % 1);
      const lx = tx - 160 + hash(i * 2.7) * 220 + Math.sin(u * 9 + i) * 14;
      const ly = ground - 230 + u * 240;
      ellipse(ctx, lx, ly, 5, 3, { w: 1.8, seed: 6080 + i, wobble: 0.2 });
    }
  } else {
    // winter: bare, snow on the branches, snow falling
    br.slice(1).forEach((b, i) => path(ctx, b.map(([px, py]) => [px, py - 5]), { w: 2, alpha: 0.5, seed: 6090 + i, wobble: 0.4 }));
  }
  if (s === 1) {
    const { x, y, w, h } = WIN;
    for (let i = 0; i < 26; i++) {
      const u = ((lt * 0.9 + hash(i * 3.7)) % 1);
      const sx = x + hash(i * 1.9) * w + Math.sin(u * 7 + i) * 10;
      const sy = y + u * h;
      dot(ctx, sx, sy, 2.6, COL.ink, 0.55);
    }
  }
}

function clock(ctx, cx, cy, r, days) {
  circle(ctx, cx, cy, r, { w: 3.4, fill: COL.paper, seed: 6100 });
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU;
    line(ctx, cx + Math.cos(a) * r * 0.78, cy + Math.sin(a) * r * 0.78, cx + Math.cos(a) * r * 0.9, cy + Math.sin(a) * r * 0.9, { w: 2, seed: 6101 + i, wobble: 0 });
  }
  const ah = days * TAU * 2 - Math.PI / 2 + 1.2;
  const am = days * TAU * 5 - Math.PI / 2;
  line(ctx, cx, cy, cx + Math.cos(ah) * r * 0.5, cy + Math.sin(ah) * r * 0.5, { w: 3.6, seed: 6120, wobble: 0 });
  line(ctx, cx, cy, cx + Math.cos(am) * r * 0.74, cy + Math.sin(am) * r * 0.74, { w: 2.4, seed: 6121, wobble: 0 });
  dot(ctx, cx, cy, 3.4);
}

// wall calendar: pages flip by month, the top page peeling up as it goes
function calendar(ctx, x, y, p01) {
  const w = 112;
  const h = 132;
  const m = 2.78 * 12 * p01;
  const page = Math.floor(m);
  const f = m - page;
  dot(ctx, x + w / 2, y - 16, 3.4);
  path(ctx, [[x + 14, y], [x + w / 2, y - 16], [x + w - 14, y]], { w: 1.8, seed: 6130, wobble: 0.3 });
  rect(ctx, x, y, w, h, { w: 3, fill: COL.paper, seed: 6131, over: 3 });
  // binding & a grid of days (no numbers)
  line(ctx, x, y + 26, x + w, y + 26, { w: 2.4, seed: 6132 });
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 5; c++) {
      const on = hash(page * 13.1 + r * 5 + c) > 0.25;
      if (on) dot(ctx, x + 18 + c * 19, y + 46 + r * 21, 2.2, COL.ink, 0.55);
    }
  }
  // one day of each page circled: the same small habit, every month
  circle(ctx, x + 18 + (page % 5) * 19, y + 46 + (Math.floor(page / 5) % 4) * 21, 8, { w: 1.6, seed: 6133, wobble: 0.3, alpha: 0.6 });
  // a page in the middle of flipping up
  if (f > 0.7) {
    const k = (f - 0.7) / 0.3;
    const ph = h * (1 - k);
    rect(ctx, x, y + 26, w, Math.max(2, ph - 26), { w: 2.4, fill: COL.paper, seed: 6134, over: 2 });
  }
}

// --------------------------------------------------------------- desks & props
function desks(ctx) {
  // top surface (a little perspective), front apron, legs
  const top = [[DL, DB], [DR, DB], [DR + 14, DF], [DL - 14, DF]];
  path(ctx, top, { w: 0, fill: COL.paper, close: true, seed: 6200 });
  ctx.save();
  ctx.fillStyle = COL.paper;
  ctx.fillRect(DL - 14, DF, DR - DL + 28, 70);
  ctx.restore();
  path(ctx, [[DL, DB], [DR, DB]], { w: 4.2, seed: 6201 });
  path(ctx, [[DL - 14, DF], [DR + 14, DF]], { w: 4.6, seed: 6202 });
  path(ctx, [[DL, DB], [DL - 14, DF]], { w: 3.6, seed: 6203 });
  path(ctx, [[DR, DB], [DR + 14, DF]], { w: 3.6, seed: 6204 });
  // the seam between the two desks
  path(ctx, [[DM, DB], [DM, DF + 70]], { w: 2.6, seed: 6205 });
  // apron
  path(ctx, [[DL - 10, DF + 70], [DR + 10, DF + 70]], { w: 3.4, seed: 6206 });
  path(ctx, [[DL - 14, DF], [DL - 12, DF + 70]], { w: 3.4, seed: 6207 });
  path(ctx, [[DR + 14, DF], [DR + 12, DF + 70]], { w: 3.4, seed: 6208 });
  // legs
  const legs = [DL - 4, DM - 18, DM + 18, DR + 4];
  legs.forEach((lx, i) => path(ctx, [[lx, DF + 70], [lx + (i % 2 ? 2 : -2), ROOM.y + ROOM.h]], { w: 3.6, seed: 6210 + i }));
}

function notebook(ctx, cx, seed) {
  const y0 = DB + 7;
  const y1 = DF - 6;
  const w0 = 58;
  const w1 = 62;
  path(ctx, [[cx - w0, y0], [cx + w0, y0], [cx + w1, y1], [cx - w1, y1]], { w: 2.4, fill: COL.paper, close: true, seed: 6300 + seed * 3, wobble: 0.5 });
  path(ctx, [[cx, y0], [cx, y1]], { w: 1.6, seed: 6301 + seed * 3, wobble: 0.3, alpha: 0.7 });
  for (let i = 0; i < 2; i++) {
    const yy = lerp(y0, y1, 0.35 + i * 0.3);
    path(ctx, [[cx - w0 + 10, yy], [cx - 8, yy]], { w: 1.2, alpha: 0.45, seed: 6302 + seed * 3 + i * 50, wobble: 0.4 });
  }
}

function openBook(ctx, cx, cy) {
  path(ctx, [[cx - 80, cy - 14], [cx - 4, cy - 10], [cx - 2, cy + 18], [cx - 86, cy + 16]], { w: 2.6, fill: COL.paper, close: true, seed: 6350, wobble: 0.4 });
  path(ctx, [[cx + 4, cy - 10], [cx + 80, cy - 14], [cx + 86, cy + 16], [cx + 2, cy + 18]], { w: 2.6, fill: COL.paper, close: true, seed: 6351, wobble: 0.4 });
  for (let i = 0; i < 2; i++) {
    path(ctx, [[cx - 68, cy - 4 + i * 10], [cx - 16, cy - 2 + i * 10]], { w: 1.2, alpha: 0.5, seed: 6352 + i, wobble: 0.4 });
    path(ctx, [[cx + 16, cy - 2 + i * 10], [cx + 68, cy - 4 + i * 10]], { w: 1.2, alpha: 0.5, seed: 6354 + i, wobble: 0.4 });
  }
}

function note(ctx, x, y) {
  path(ctx, [[x - 19, y - 12], [x + 19, y - 12], [x + 21, y + 13], [x - 21, y + 13]], { w: 2.6, fill: COL.paper, close: true, seed: 6360, wobble: 0.3 });
  path(ctx, [[x - 19, y - 12], [x, y + 2], [x + 19, y - 12]], { w: 1.8, seed: 6361, wobble: 0.2 });
}

// a speech bubble full of scribble (no words); its tail points down-right to her
function speech(ctx, cx, cy, lt, seed) {
  const pts = ellipsePts(cx, cy, 60, 32, -2.2, -2.2 + TAU, 26);
  path(ctx, [[cx + 22, cy + 26], [cx + 58, cy + 62], [cx + 40, cy + 22]], { w: 2.6, fill: COL.paper, seed: 6401 + seed, wobble: 0.3 });
  path(ctx, pts, { w: 2.8, fill: COL.paper, close: true, seed: 6400 + seed, wobble: 0.7 });
  const sq = [];
  for (let i = 0; i <= 24; i++) {
    const u = i / 24;
    sq.push([cx - 38 + u * 76, cy + Math.sin(u * 22 + lt * 30) * 7 + Math.sin(u * 7) * 3]);
  }
  path(ctx, sq, { w: 2.2, seed: 6402 + seed, wobble: 0.6 });
}

// little rays of laughter around a head
function joy(ctx, hx, hy, lt, seed) {
  for (let i = 0; i < 3; i++) {
    for (const side of [-1, 1]) {
      const a = (side < 0 ? Math.PI : 0) + side * (-0.55 + i * 0.5);
      const r0 = 46 + Math.sin(lt * 30 + i) * 3;
      line(ctx, hx + Math.cos(a) * r0, hy + Math.sin(a) * r0, hx + Math.cos(a) * (r0 + 16), hy + Math.sin(a) * (r0 + 16), { w: 2.6, seed: 6420 + seed * 10 + i * 2 + (side > 0 ? 1 : 0), wobble: 0 });
    }
  }
}

function zzz(ctx, x, y, lt) {
  for (let i = 0; i < 2; i++) {
    const s = 9 + i * 4;
    const ox = x + i * 22;
    const oy = y - i * 28 - Math.sin(lt * 6 + i) * 3;
    path(ctx, [[ox - s, oy - s], [ox + s, oy - s], [ox - s, oy + s], [ox + s, oy + s]], { w: 2.6, seed: 6440 + i, wobble: 0.2, alpha: 0.8 });
  }
}
