// s13 — 云往山去，雨向天回，一来一往之间，盛满了人间所有说不出口、放不下的心事。
//
// Continues s12's last frame exactly (hard cut). Her gold cloud sends a small
// cloudlet over the top toward his valley, inking a dotted path behind it.
// His rain slows, turns, and rises back into his cloud; a few drops run back
// along a lower path and climb into her sky — the loop is closed. Then the
// loop circulates and fills up with the small things that were never said or
// given: paper planes, a notebook, a gift, empty speech bubbles, letters,
// folded notes. On 放不下的心事 it slows and dims; one paper plane — from his
// side — peels off and glides to her frame, and stops just outside its edge.
// She is looking up; he is looking down. Neither sees it.
import { COL, TAU, lerp, clamp, prog, smooth, ease, path, ellipsePts, dot, fillPoly, camera } from '../lib.js';
import { paperPlane } from '../sets.js';
import {
  LAY, GROUND, END_CAM, cloudAt, cloudShape, drawCloudPts, RAIN, rainPos, rainDrops,
  herPose, himPose, drawHer, drawHim, drawFrame, drawRemnantFinal,
} from './s12.js';

const START = 109.4;

// local times (word onsets from the voice track)
const T = {
  top0: 0.25, // 云往山去 (109.7 .. 110.4): path over the top, her -> his
  top1: 1.5,
  rain0: 1.15, // 雨向天回 (110.75 .. 111.55): rain turns and rises
  rain1: 1.6,
  rear0: 1.45,
  rear1: 2.2,
  bot0: 1.6, // lower path back, his -> hers
  bot1: 2.85,
  flow0: 2.3, // 一来一往之间 (112.1 ..)
  flow1: 3.1,
  slow0: 6.2, // 放不下的心事 (115.75 ..)
  slow1: 7.4,
  peel: 6.35,
  stop: 7.55,
};
const FLOW_V = 150; // px/s along the loop once it circulates
const ITEM_S = 1.15; // size of the things riding the loop

// ------------------------------------------------------------------ loop
// An ellipse through the two cloud centres. u in [0, 1): 0 = her cloud,
// 0.25 = top, 0.5 = his cloud, 0.75 = bottom (clockwise on screen).
const C1 = [LAY.herCloud.x, LAY.herCloud.y];
const C2 = [LAY.himCloud.x, LAY.himCloud.y];
const LC = [(C1[0] + C2[0]) / 2, (C1[1] + C2[1]) / 2];
const RX = Math.hypot(C2[0] - C1[0], C2[1] - C1[1]) / 2;
const RY = 150;
const ROT = Math.atan2(C2[1] - C1[1], C2[0] - C1[0]);
const cr = Math.cos(ROT);
const sr = Math.sin(ROT);
const ellP = (th) => {
  const ex = RX * Math.cos(th);
  const ey = RY * Math.sin(th);
  return [LC[0] + ex * cr - ey * sr, LC[1] + ex * sr + ey * cr];
};
// arc-length table so things move at an even speed
const NS = 1024;
const TAB = (() => {
  const th = [];
  const cum = [0];
  let prev = ellP(Math.PI);
  th.push(Math.PI);
  for (let i = 1; i <= NS; i++) {
    const a = Math.PI + (i / NS) * TAU;
    const p = ellP(a);
    cum.push(cum[i - 1] + Math.hypot(p[0] - prev[0], p[1] - prev[1]));
    th.push(a);
    prev = p;
  }
  return { th, cum, L: cum[NS] };
})();
const LOOP_L = TAB.L;
function thetaAt(u) {
  const s = (((u % 1) + 1) % 1) * LOOP_L;
  let lo = 0;
  let hi = NS;
  while (hi - lo > 1) {
    const m = (lo + hi) >> 1;
    if (TAB.cum[m] <= s) lo = m;
    else hi = m;
  }
  const k = (s - TAB.cum[lo]) / (TAB.cum[hi] - TAB.cum[lo] || 1);
  return lerp(TAB.th[lo], TAB.th[hi], k);
}
const loopP = (u) => ellP(thetaAt(u));
// direction of travel (radians) at u
function loopDir(u) {
  const a = loopP(u - 0.002);
  const b = loopP(u + 0.002);
  return Math.atan2(b[1] - a[1], b[0] - a[0]);
}
function arcPts(u0, u1, n = 90) {
  const pts = [];
  for (let i = 0; i <= n; i++) pts.push(loopP(lerp(u0, u1, i / n)));
  return pts;
}
const TOP = arcPts(0, 0.5);
const BOT = arcPts(0.5, 1);

// distance travelled by the circulation (integral of the flow speed)
const flowV = (lt) => FLOW_V * smooth(lt, T.flow0, T.flow1) * (1 - smooth(lt, T.slow0, T.slow1));
const FLOW_DT = 0.01;
const FLOW_TAB = (() => {
  const out = [0];
  for (let i = 1; i <= 1000; i++) out.push(out[i - 1] + flowV((i - 0.5) * FLOW_DT) * FLOW_DT);
  return out;
})();
function flowDist(lt) {
  const x = clamp(lt, 0, 9.99) / FLOW_DT;
  const i = Math.floor(x);
  return lerp(FLOW_TAB[i], FLOW_TAB[i + 1], x - i);
}

// ------------------------------------------------------------------ things
// K slots evenly spread round the loop; each pops in at its own moment.
const TYPES = ['plane', 'bubble', 'gift', 'note', 'book', 'plane', 'letter', 'bubble', 'plane', 'book', 'gift', 'note', 'bubble', 'letter'];
const K = TYPES.length;
const POP_ORDER = [0, 7, 3, 10, 5, 12, 1, 8, 4, 11, 2, 9, 6, 13];
const POP_T = [2.95, 3.3, 3.62, 3.9, 4.08, 4.22, 4.36, 4.5, 4.63, 4.77, 4.92, 5.08, 5.28, 5.5];
const POP = new Array(K);
POP_ORDER.forEach((slot, i) => { POP[slot] = POP_T[i]; });

// Slot 0 is his plane, the one that leaves the loop. It must be on the lower
// path, heading to her frame, when it peels off.
const PEEL_U = 0.795;
const U0 = PEEL_U - flowDist(T.peel) / LOOP_L;
const slotU = (i, lt) => U0 + i / K + flowDist(lt) / LOOP_L;

// where the plane stops: nose just outside her frame's right edge
const HF = LAY.herF;
const PLANE_S = 0.85;
const STOP_ANG = Math.PI - 0.16;
const STOP = [HF.x + HF.w + 6 + 30 * PLANE_S * 1.38 * Math.cos(Math.PI - STOP_ANG) + 1, 600];

const thingBob = (i, tg) => 4 * Math.sin(tg * 1.1 + i * 2.3);

function heroPlane(lt) {
  const tg = lt + START;
  if (lt <= T.peel) {
    const u = slotU(0, lt);
    const p = loopP(u);
    return { p: [p[0], p[1] + thingBob(0, tg)], ang: loopDir(u) };
  }
  const k = ease.out(prog(lt, T.peel, T.stop));
  const u = slotU(0, T.peel);
  const P0 = loopP(u);
  P0[1] += thingBob(0, START + T.peel);
  const d0 = loopDir(u);
  // cubic: leaves along the loop, sinks, and eases into the frame edge
  const P1 = [P0[0] + Math.cos(d0) * 80, P0[1] + Math.sin(d0) * 80];
  const P3 = [STOP[0], STOP[1]];
  const P2 = [P3[0] + 85, P3[1] - 14];
  const b = (a0, a1, a2, a3, s) => {
    const m = 1 - s;
    return m * m * m * a0 + 3 * m * m * s * a1 + 3 * m * s * s * a2 + s * s * s * a3;
  };
  const p = [b(P0[0], P1[0], P2[0], P3[0], k), b(P0[1], P1[1], P2[1], P3[1], k)];
  const k2 = Math.min(1, k + 0.02);
  const q = [b(P0[0], P1[0], P2[0], P3[0], k2), b(P0[1], P1[1], P2[1], P3[1], k2)];
  let ang = k < 0.98 ? Math.atan2(q[1] - p[1], q[0] - p[0]) : STOP_ANG;
  ang = lerp(ang, STOP_ANG, smooth(k, 0.75, 1));
  // once stopped it only breathes a little in the air
  const still = smooth(lt, T.stop - 0.1, T.stop + 0.4);
  p[1] += 1.6 * Math.sin(tg * 1.9) * still;
  return { p, ang: ang + 0.025 * Math.sin(tg * 1.3) * still };
}

// small props, centred on (0, 0), about 40-50 px across
function drawThing(ctx, type, x, y, ang, s, a, sd) {
  if (type === 'plane') {
    paperPlane(ctx, x, y, ang, PLANE_S * s, { seed: sd, alpha: a, w: 2.6 });
    return;
  }
  const c = Math.cos(ang);
  const sn = Math.sin(ang);
  const P = (px, py) => [x + (px * c - py * sn) * s, y + (px * sn + py * c) * s];
  const box = (w, h) => [P(-w / 2, -h / 2), P(w / 2, -h / 2), P(w / 2, h / 2), P(-w / 2, h / 2)];
  const st = { w: 2.4, alpha: a, wobble: 0.6 };
  if (type === 'book') {
    path(ctx, box(32, 40), { ...st, close: true, fill: COL.paper, seed: sd });
    path(ctx, [P(-11, -20), P(-11, 20)], { ...st, w: 1.6, seed: sd + 1 });
    for (let i = 0; i < 3; i++) path(ctx, [P(-5, -10 + i * 9), P(11 - (i === 2 ? 6 : 0), -10 + i * 9)], { ...st, w: 1.3, alpha: a * 0.7, seed: sd + 2 + i });
  } else if (type === 'gift') {
    path(ctx, box(34, 28), { ...st, close: true, fill: COL.paper, seed: sd });
    const rib = { ...st, w: 2.2, color: COL.gold };
    path(ctx, [P(0, -14), P(0, 14)], { ...rib, seed: sd + 1 });
    path(ctx, [P(-17, -2), P(17, -2)], { ...rib, seed: sd + 2 });
    const bow = (dx) => {
      const pts = ellipsePts(0, 0, 6, 4, 0, TAU, 12).map(([px, py]) => P(px + dx, py - 18));
      path(ctx, pts, { ...rib, w: 2, seed: sd + 3 + (dx > 0 ? 1 : 0) });
    };
    bow(-5.5);
    bow(5.5);
  } else if (type === 'letter') {
    path(ctx, box(46, 30), { ...st, close: true, fill: COL.paper, seed: sd });
    path(ctx, [P(-23, -15), P(0, 3), P(23, -15)], { ...st, w: 1.8, seed: sd + 1 });
  } else if (type === 'note') {
    // a folded note with a dog-ear
    path(ctx, [P(-17, -17), P(9, -17), P(17, -9), P(17, 17), P(-17, 17)], { ...st, close: true, fill: COL.paper, seed: sd });
    path(ctx, [P(9, -17), P(9, -9), P(17, -9)], { ...st, w: 1.6, seed: sd + 1 });
    path(ctx, [P(-17, 2), P(17, 2)], { ...st, w: 1.2, alpha: a * 0.6, dash: [5, 5], seed: sd + 2 });
  } else if (type === 'bubble') {
    // an empty speech bubble: ... never said
    const pts = ellipsePts(0, 0, 26, 17, -2.2, -2.2 + TAU, 26).map(([px, py]) => P(px, py));
    path(ctx, pts, { ...st, close: true, fill: COL.paper, seed: sd });
    path(ctx, [P(-10, 14), P(-16, 25), P(-2, 16)], { ...st, w: 2.2, seed: sd + 1 });
    for (let i = -1; i <= 1; i++) {
      const [dx, dy] = P(i * 9, 1);
      dot(ctx, dx, dy, 2.4 * s, COL.ink, a * 0.8);
    }
  }
}

// a little cloud riding the top path (leads the ink)
function cloudlet(ctx, x, y, a) {
  const pts = cloudShape(x, y, 74, { bumps: 3, seed: 7 });
  fillPoly(ctx, pts, COL.paper, a);
  fillPoly(ctx, pts, COL.goldSoft, 0.4 * a);
  path(ctx, pts, { w: 2.6, color: COL.gold, alpha: a, seed: 4900, wobble: 0.6 });
}

// ------------------------------------------------------------------ scene
export default {
  fadeIn: 0, // picks up s12's last frame exactly
  draw(ctx, lt, info) {
    const t = Math.max(0, lt);
    const tg = info.t;

    // camera: from s12's framing, ease back a little to give the loop air,
    // then drift toward her frame at the end
    const kb = smooth(t, 0.3, 3.4, ease.sine);
    const kf = smooth(t, 6.0, 8.6, ease.sine);
    const cam = {
      x: lerp(END_CAM.x, 960, kb) - 70 * kf,
      y: lerp(END_CAM.y, 548, kb) + 22 * kf,
      z: lerp(END_CAM.z, 1.02, kb) + 0.06 * kf,
    };

    camera(ctx, cam, () => {
      drawRemnantFinal(ctx);
      drawFrame(ctx, 'her', 1);
      drawFrame(ctx, 'him', 1);

      // ---------------- his rain: slows, turns, rises back into the cloud
      const c = LAY.himCloud;
      const yTop = c.y + 22;
      const rear = lerp(GROUND - 2, yTop - 10, smooth(t, T.rear0, T.rear1, ease.in));
      if (rear > yTop) {
        const r0 = START + T.rain0;
        const r1 = START + T.rain1;
        rainDrops(ctx, rainPos(tg, r0, r1), c.x - c.w / 2 + 18, c.x + c.w / 2 - 18, yTop, GROUND - 2, {
          rear, splash: 1 - smooth(tg, r0 - 0.1, r0 + 0.25),
        });
      }

      // ---------------- the two of them
      // she watches the cloudlet go toward him, then looks up again
      const herUp = 1 - 0.62 * smooth(t, 0.45, 1.4) * (1 - smooth(t, 2.4, 3.3));
      // he lifts his head as the rain goes back up; lowers it at the end
      const himDown = 1 - 0.8 * smooth(t, 1.35, 2.1) * (1 - smooth(t, 6.45, 7.3));
      drawHer(ctx, herPose(tg, herUp));
      drawHim(ctx, himPose(tg, himDown));

      // ---------------- the loop (dotted gold path)
      const dim = 1 - 0.55 * smooth(t, T.slow0 + 0.3, T.slow1 + 0.2);
      const kTop = smooth(t, T.top0, T.top1, ease.inOut);
      const kBot = smooth(t, T.bot0, T.bot1, ease.inOut);
      const fd = flowDist(t);
      const dot0 = { w: 3.8, color: COL.gold, dash: [1.5, 15], cap: 'round', wobble: 0.5, dashOffset: -fd };
      if (kTop > 0) path(ctx, TOP, { ...dot0, alpha: 0.8 * dim, draw: kTop, seed: 4800 });
      if (kBot > 0) path(ctx, BOT, { ...dot0, alpha: 0.8 * dim, draw: kBot, seed: 4801 });

      // leaders: a cloudlet over the top, a few rising drops along the bottom
      if (kTop > 0 && kTop < 1) {
        const p = loopP(0.5 * kTop);
        const a = smooth(kTop, 0.02, 0.12) * (1 - smooth(kTop, 0.88, 0.99));
        cloudlet(ctx, p[0], p[1] + 4, a);
      }
      if (kBot > 0 && kBot < 1) {
        const a = smooth(kBot, 0.02, 0.1) * (1 - smooth(kBot, 0.9, 0.99));
        for (let i = 0; i < 6; i++) {
          const u = 0.5 + 0.5 * kBot - i * 0.011 - 0.004 * (i % 2);
          if (u < 0.5) continue;
          const p = loopP(u);
          const d = loopDir(u);
          const off = (i % 2 ? 9 : -7) * (i ? 1 : 0);
          const nx = -Math.sin(d) * off;
          const ny = Math.cos(d) * off;
          const l = 13;
          const gold = i === 1 || i === 4;
          path(ctx, [[p[0] + nx - Math.cos(d) * l, p[1] + ny - Math.sin(d) * l], [p[0] + nx + Math.cos(d) * l, p[1] + ny + Math.sin(d) * l]], {
            w: gold ? 3.2 : 2.6, color: gold ? COL.gold : COL.ink, alpha: a * (gold ? 0.95 : 0.65), wobble: 0, seed: 4810 + i,
          });
        }
      }

      // ---------------- the things that were never said or given
      for (let i = K - 1; i >= 1; i--) {
        const p0 = POP[i];
        if (t < p0) continue;
        const pop = ease.outBack(prog(t, p0, p0 + 0.38));
        const a = smooth(t, p0, p0 + 0.14) * dim;
        const u = slotU(i, t);
        const [x, y] = loopP(u);
        const dir = loopDir(u);
        const type = TYPES[i];
        let ang;
        if (type === 'plane') ang = dir;
        else {
          // upright-ish, tipping a little with the path and bobbing
          const tip = Math.atan2(Math.sin(dir), Math.abs(Math.cos(dir)) + 1e-6);
          ang = 0.35 * tip * Math.sign(Math.cos(dir)) + 0.12 * Math.sin(tg * 1.4 + i * 1.9);
        }
        drawThing(ctx, type, x, y + thingBob(i, tg), ang, ITEM_S * lerp(0.4, 1, pop), a, 5000 + i * 10);
      }

      // ---------------- the clouds (the things pass behind them)
      const growHim = 1 + 0.07 * smooth(t, 1.25, 1.8);
      const growHer = 1 + 0.05 * smooth(t, 2.6, 3.1);
      drawCloudPts(ctx, cloudAt('her', tg, { grow: growHer }), 'her', 1);
      drawCloudPts(ctx, cloudAt('him', tg, { grow: growHim }), 'him', 1);

      // ---------------- his plane: rides the loop, then leaves it and stops
      // at her frame (drawn last, never dimmed)
      if (t >= POP[0]) {
        if (t > T.peel) {
          // a faint pencil trail of its glide
          const tr = [];
          for (let i = 0; i <= 24; i++) tr.push(heroPlane(lerp(T.peel, Math.min(t, T.stop), i / 24)).p);
          path(ctx, tr, { w: 2, alpha: 0.32 * smooth(t, T.peel, T.peel + 0.3), dash: [6, 9], wobble: 0.4, seed: 4890 });
        }
        const h = heroPlane(t);
        const pop = ease.outBack(prog(t, POP[0], POP[0] + 0.38));
        const grow = lerp(ITEM_S, 1.38, smooth(t, T.peel, T.stop));
        drawThing(ctx, 'plane', h.p[0], h.p[1], h.ang, grow * lerp(0.4, 1, pop), smooth(t, POP[0], POP[0] + 0.14), 5000);
      }
    });
  },
};
