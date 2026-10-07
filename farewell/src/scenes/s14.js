// s14 — 青春总会退场，日光依旧慷慨地照向大地，生活仍在继续。
//
// A stage: a proscenium frame with drapes, and on it two flats on little
// wheels — the school, and the high platform with the two of them sitting on
// its edge. 青春总会退场: the flats roll off into the wings, one after the
// other. 日光依旧: the stage itself is struck (the valance flies, the drapes
// part and slide away) and a big sun rises over an open, empty earth; its
// long rays fan out across the ground (慷慨地照向大地). He walks in from the
// wings where his youth went — grown up, a bag in his hand — into the light.
// 生活仍在继续: people pass, a bicycle overtakes him, birds cross. He keeps
// walking.
import { W, H, COL, TAU, lerp, clamp, prog, smooth, ease, hash, path, line, rect, circle, ellipsePts, fillPoly, hatch, camera } from '../lib.js';
import { figure, pose, joints, walk, walkPhase, SIT_BACK } from '../figure.js';
import { frameBox, bird, cloud } from '../sets.js';

const GROUND = 850;
const PR = { x: 200, y: 112, w: 1520, h: GROUND - 112 }; // proscenium
const DRAPE = 92; // drape width at the top
const WINGL = PR.x + 34; // flats vanish behind the left drape here

// local times (voice: 青春总会退场 117.8–118.75, 日光依旧慷慨地照向大地
// 118.9–121.2, 生活仍在继续 121.65–122.9)
const T = {
  school0: 0.05,
  school1: 1.2,
  plat0: 0.3,
  plat1: 1.65,
  strike0: 1.45,
  strike1: 2.6,
  sun0: 1.4,
  sun1: 3.3,
  rays0: 2.35,
  heIn: 2.05,
};

const SUN = { x: 1500, y: 290, r: 82 };
const HE_S = 1.18;
const HE_V = 250; // px/s
const HE_X0 = -90;

export default {
  draw(ctx, lt, info) {
    const t = Math.max(0, lt);
    const tg = info.t;
    // the camera breathes out a little once the stage is gone
    const z = lerp(1, 0.93, smooth(t, 1.9, 4.6, ease.sine));
    const cy = lerp(540, 560, smooth(t, 1.9, 4.6, ease.sine));
    camera(ctx, { x: 960, y: cy, z }, () => {
      drawSky(ctx, t, tg);
      drawSun(ctx, t, tg);
      drawRays(ctx, t, tg);

      // the ground runs right across, under the stage and beyond
      path(ctx, [[-260, GROUND + 1], [700, GROUND - 1], [1400, GROUND + 1], [2180, GROUND]], { w: 3.2, seed: 10 });

      drawStage(ctx, t, tg);
      drawPeople(ctx, t, tg);
    });
  },
};

// ------------------------------------------------------------------ stage
function drawStage(ctx, t, tg) {
  // the whole proscenium (frame, drapes, valance) flies up out of sight
  const lift = -1150 * smooth(t, T.strike0, T.strike1, ease.in);
  if (lift < -1140) return;

  // the flats, clipped to the inside of the stage (they exit into the wings)
  ctx.save();
  ctx.beginPath();
  ctx.rect(WINGL, PR.y - 40, PR.w + 200, GROUND - PR.y + 60);
  ctx.clip();
  const ds = -720 * smooth(t, T.school0, T.school1, ease.in);
  const dp = -1290 * smooth(t, T.plat0, T.plat1, ease.in);
  schoolFlat(ctx, ds, t);
  platformFlat(ctx, dp, t, tg);
  ctx.restore();

  ctx.save();
  ctx.translate(0, lift);
  // drapes (paper-filled so the flats go behind them)
  const fold = (x0, dir, sd) => {
    const top = PR.y + 6;
    const pts = [
      [x0, top], [x0 + dir * DRAPE, top],
      [x0 + dir * (DRAPE * 0.62), top + 260], [x0 + dir * (DRAPE * 0.42), top + 520], [x0 + dir * (DRAPE * 0.5), GROUND],
      [x0, GROUND],
    ];
    fillPoly(ctx, pts, COL.paper, 1);
    path(ctx, [pts[1], pts[2], pts[3], pts[4]], { w: 3.2, seed: sd });
    path(ctx, [pts[4], pts[5]], { w: 2.4, seed: sd + 5 });
    // two soft folds
    for (let i = 0; i < 2; i++) {
      const k = 0.3 + i * 0.32;
      path(ctx, [[x0 + dir * DRAPE * k, top + 10], [x0 + dir * DRAPE * k * 0.75, top + 300], [x0 + dir * DRAPE * k * 0.6, top + 560], [x0 + dir * DRAPE * k * 0.7, GROUND - 6]], { w: 1.8, alpha: 0.55, seed: sd + 1 + i });
    }
  };
  fold(PR.x, 1, 40);
  fold(PR.x + PR.w, -1, 45);
  line(ctx, PR.x, PR.y - 30, PR.x, GROUND + 4, { w: 5, seed: 44 });
  line(ctx, PR.x + PR.w, PR.y - 30, PR.x + PR.w, GROUND + 4, { w: 5, seed: 49 });

  // valance: scalloped pelmet under the top edge
  const n = 12;
  const sc = [];
  const x0 = PR.x - 6;
  const x1 = PR.x + PR.w + 6;
  for (let i = 0; i < n; i++) {
    const a = lerp(x0, x1, i / n);
    const b = lerp(x0, x1, (i + 1) / n);
    sc.push(...ellipsePts((a + b) / 2, PR.y + 38, (b - a) / 2, 26, Math.PI, 0, 10).reverse());
  }
  fillPoly(ctx, [[x0, PR.y], [x1, PR.y], ...sc.slice().reverse()], COL.paper, 1);
  path(ctx, sc, { w: 2.8, seed: 50 });
  path(ctx, [[x0 - 30, PR.y], [x1 + 30, PR.y]], { w: 5, seed: 51 });
  path(ctx, [[x0 - 24, PR.y + 7], [x1 + 24, PR.y + 7]], { w: 2, alpha: 0.5, seed: 52 });
  // the lines it hangs from
  for (const x of [PR.x + 160, PR.x + PR.w - 160]) line(ctx, x, PR.y - 900, x, PR.y, { w: 1.6, alpha: 0.5, seed: 53 + (x > 960 ? 1 : 0) });
  ctx.restore();
}

// little wheels under a flat. x positions, axle y, roll angle
function wheels(ctx, xs, dx, sd) {
  const r = 11;
  const y = GROUND - r;
  const ang = dx / r;
  xs.forEach((x, i) => {
    circle(ctx, x + dx, y, r, { w: 2.4, fill: COL.paper, seed: sd + i * 3 });
    const c = Math.cos(ang);
    const s = Math.sin(ang);
    line(ctx, x + dx - c * r * 0.75, y - s * r * 0.75, x + dx + c * r * 0.75, y + s * r * 0.75, { w: 1.6, seed: sd + i * 3 + 1, wobble: 0 });
  });
}

function schoolFlat(ctx, dx, t) {
  const bx = 300 + dx;
  const by = 455;
  const bw = 560;
  const base = GROUND - 22;
  if (bx + bw < WINGL - 20) return;
  // a little sway once it moves
  const mv = smooth(t, T.school0, T.school0 + 0.4) * (1 - smooth(t, T.school1 - 0.2, T.school1));
  ctx.save();
  ctx.translate(bx + bw / 2, base);
  ctx.rotate(-0.012 * mv * Math.sin(t * 9));
  ctx.translate(-(bx + bw / 2), -base);
  // cut-out body + roof
  fillPoly(ctx, [[bx, base], [bx, by], [bx + bw / 2, by - 66], [bx + bw, by], [bx + bw, base]], COL.paper, 1);
  rect(ctx, bx, by, bw, base - by, { w: 3.6, seed: 100 });
  path(ctx, [[bx - 16, by], [bx + bw / 2, by - 66], [bx + bw + 16, by]], { w: 3.4, seed: 101 });
  circle(ctx, bx + bw / 2, by - 24, 15, { w: 2.4, seed: 102 });
  line(ctx, bx + bw / 2, by - 24, bx + bw / 2, by - 34, { w: 2, seed: 103, wobble: 0 });
  line(ctx, bx + bw / 2, by - 24, bx + bw / 2 + 7, by - 20, { w: 2, seed: 104, wobble: 0 });
  for (let fl = 0; fl < 4; fl++) {
    for (let c = 0; c < 6; c++) {
      const wx = bx + 30 + c * 88;
      const wy = by + 26 + fl * 80;
      rect(ctx, wx, wy, 58, 40, { w: 2.2, alpha: 0.9, over: 2, seed: 110 + fl * 6 + c });
    }
  }
  // their classroom
  rect(ctx, bx + 30 + 4 * 88 + 6, by + 26 + 80 + 6, 46, 28, { w: 0, fill: COL.goldSoft });
  // door
  rect(ctx, bx + bw / 2 - 32, base - 74, 64, 74, { w: 2.6, over: 2, seed: 140 });
  // base plank
  path(ctx, [[bx - 8, base], [bx + bw + 8, base]], { w: 4, seed: 141 });
  ctx.restore();
  wheels(ctx, [300 + 60, 300 + bw - 60], dx, 150);
  // a few speed marks behind it while it rolls
  if (mv > 0.05) speedMarks(ctx, bx + bw + 20, by + 120, mv, 160);
}

function platformFlat(ctx, dx, t, tg) {
  const x0 = 1010 + dx;
  const x1 = 1450 + dx;
  const top = 612;
  const base = GROUND - 22;
  if (x1 < WINGL - 20) return;
  const mv = smooth(t, T.plat0, T.plat0 + 0.45) * (1 - smooth(t, T.plat1 - 0.25, T.plat1));
  fillPoly(ctx, [[x0, top], [x1, top], [x1, base], [x0, base]], COL.paper, 1);
  hatch(ctx, [x0 + 8, top + 22, x1 - x0 - 16, base - top - 26], { alpha: 0.14, gap: 18, seed: 200 });
  frameBox(ctx, x0, top, x1 - x0, base - top, { seed: 201, w: 5 });
  line(ctx, x0 + 12, top + 18, x1 - 12, top + 18, { w: 2, alpha: 0.6, seed: 202 });
  path(ctx, [[x0 - 10, base], [x1 + 10, base]], { w: 4, seed: 203 });
  wheels(ctx, [1010 + 60, 1450 - 60], dx, 210);

  // the two of them, from behind, sitting on its edge
  const s = 0.98;
  const hipY = top - 2;
  // they sway back as it starts to roll
  const jolt = smooth(t, T.plat0, T.plat0 + 0.3) * (1 - smooth(t, T.plat0 + 0.3, T.plat0 + 0.9));
  const boy = pose({ view: 'back', x: x0 + 150, y: hipY, s, ...SIT_BACK, lean: 0.07 * jolt });
  const girl = pose({
    view: 'back', x: x0 + 290, y: hipY, s, ...SIT_BACK, lean: 0.06 * jolt, head: -0.06,
    tail: 0.16 * Math.sin(tg * 1.25) + 0.3 * mv,
  });
  figure(ctx, boy, { id: 1, legs: false, seat: true });
  figure(ctx, girl, { id: 2, ponytail: true, legs: false, seat: true });
  if (mv > 0.05) speedMarks(ctx, x1 + 24, top - 40, mv, 220);
}

function speedMarks(ctx, x, y, a, sd) {
  for (let i = 0; i < 3; i++) {
    const yy = y + i * 46 + (i % 2) * 12;
    const l = 60 + 30 * (i % 2);
    line(ctx, x + 10 * i, yy, x + 10 * i + l, yy, { w: 2.2, alpha: 0.55 * a, seed: sd + i });
  }
}

// ------------------------------------------------------------------ sky
function drawSky(ctx, t, tg) {
  const a = smooth(t, 2.2, 3.2);
  if (a <= 0.01) return;
  cloud(ctx, 520 + (tg - 120) * 9, 210, 0.95, { alpha: 0.75 * a, seedStroke: 300 });
  cloud(ctx, 1040 + (tg - 120) * 6, 150, 0.62, { alpha: 0.6 * a, seedStroke: 301, seed: 2 });
  // birds cross on 生活仍在继续
  for (let i = 0; i < 3; i++) {
    const k = prog(t, 3.6 + i * 0.18, 8.6 + i * 0.18);
    if (k <= 0) continue;
    const bx = lerp(-80, 1900, k) - i * 46;
    const by = 330 - i * 24 + 10 * Math.sin(tg * 1.3 + i);
    bird(ctx, bx, by, 0.8 - i * 0.1, tg * 1.6 + i * 0.3, { alpha: 0.85, seed: 310 + i * 2 });
  }
}

function drawSun(ctx, t, tg) {
  const k = smooth(t, T.sun0, T.sun1, ease.out);
  if (k <= 0) return;
  const y = lerp(GROUND + SUN.r * 2.2, SUN.y, k);
  ctx.save();
  // it rises from behind the earth
  ctx.beginPath();
  ctx.rect(-400, -400, W + 800, GROUND + 400);
  ctx.clip();
  // a bloom of paper-white light
  const g = ctx.createRadialGradient(SUN.x, y, SUN.r * 0.5, SUN.x, y, SUN.r * 6);
  g.addColorStop(0, `rgba(255,252,244,${0.55 * k})`);
  g.addColorStop(1, 'rgba(255,252,244,0)');
  ctx.fillStyle = g;
  ctx.fillRect(SUN.x - SUN.r * 6, y - SUN.r * 6, SUN.r * 12, SUN.r * 12);
  circle(ctx, SUN.x, y, SUN.r, { w: 4.2, fill: 'rgba(252,248,238,0.9)', seed: 400 });
  const spin = tg * 0.08;
  for (let i = 0; i < 14; i++) {
    const a = spin + (i / 14) * TAU;
    const r0 = SUN.r * 1.28;
    const r1 = SUN.r * (i % 2 ? 1.55 : 1.72);
    line(ctx, SUN.x + Math.cos(a) * r0, y + Math.sin(a) * r0, SUN.x + Math.cos(a) * r1, y + Math.sin(a) * r1, { w: 3.2, seed: 401 + i });
  }
  ctx.restore();
}

// long beams of light fanning out over the ground, right to left
function drawRays(ctx, t, tg) {
  if (t < T.rays0) return;
  const n = 7;
  for (let i = 0; i < n; i++) {
    const t0 = T.rays0 + i * 0.16;
    const k = smooth(t, t0, t0 + 1.1, ease.out);
    if (k <= 0) continue;
    const gx = 1700 - i * 330 + 30 * Math.sin(i * 1.7);
    const dx = gx - SUN.x;
    const dy = GROUND - SUN.y;
    const L = Math.hypot(dx, dy);
    const ang = Math.atan2(dy, dx);
    const half = 0.035 + 0.012 * (i % 2);
    const r0 = SUN.r * 1.9;
    const rEnd = (1120 - SUN.y) / Math.sin(ang);
    const r1 = lerp(r0, rEnd, k);
    const breathe = 0.8 + 0.2 * Math.sin(tg * 1.1 + i * 1.3);
    const P = (r, a) => [SUN.x + Math.cos(a) * r, SUN.y + Math.sin(a) * r];
    const poly = [P(r0, ang - half * 0.4), P(r1, ang - half), P(r1, ang + half), P(r0, ang + half * 0.4)];
    const A = P(r0, ang);
    const B = P(rEnd, ang);
    const fH = clamp((L - r0) / (rEnd - r0), 0.05, 0.95);
    const g = ctx.createLinearGradient(A[0], A[1], B[0], B[1]);
    g.addColorStop(0, `rgba(255,252,244,${0.55 * breathe})`);
    g.addColorStop(fH, `rgba(255,252,244,${0.32 * breathe})`);
    g.addColorStop(1, 'rgba(255,252,244,0)');
    ctx.save();
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(poly[0][0], poly[0][1]);
    for (const q of poly.slice(1)) ctx.lineTo(q[0], q[1]);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    // one pencil edge, in the sky only
    const rE = Math.min(r1, L / Math.cos(half));
    path(ctx, [P(r0, ang + half * 0.4), P(rE, ang + half)], { w: 1.6, alpha: 0.26 * breathe, seed: 450 + i });
  }
}

// ------------------------------------------------------------------ people
// the open ground has depth: three lanes in front of the horizon
// the bicycle comes the other way and passes him (behind) at ~122.4
const BIKE_T0 = 2.3;
const BIKE_V = 600;
const BIKE_X = (t) => 2130 - BIKE_V * (t - BIKE_T0);
const LANE = { far: { y: 878, s: 0.74 }, mid: { y: 915, s: 0.92 }, near: { y: 962, s: HE_S } };

function walker(x0, v, t0, t, lane, f) {
  const s = lane.s;
  const d = Math.max(0, t - t0) * v;
  const x = x0 + f * d;
  return { x, d, ...walk(walkPhase(d, s), lane.y, s, 1), s, f };
}

// a contact mark and a long, faint shadow cast away from the sun
function shadow(ctx, x, gy, s, sd) {
  const dir = clamp((x - SUN.x) / 700, -1, 1);
  const L = 150 * s;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.strokeStyle = COL.ink;
  ctx.globalAlpha *= 0.1;
  ctx.lineWidth = 9 * s;
  ctx.beginPath();
  ctx.moveTo(x, gy + 1);
  ctx.lineTo(x + dir * L, gy + 26 * s);
  ctx.stroke();
  ctx.restore();
  line(ctx, x - 20 * s, gy + 1, x + 18 * s, gy + 1, { w: 2.4 * s, alpha: 0.4, seed: sd, wobble: 0.5 });
}

function drawPeople(ctx, t, tg) {
  // far lane: someone strolls the other way
  if (t > 3.55) {
    const w = walker(2040, 150, 3.55, t, LANE.far, -1);
    shadow(ctx, w.x, LANE.far.y, w.s, 520);
    figure(ctx, pose(w), { id: 3 });
  }

  // mid lane: a bicycle comes the other way and passes behind him
  if (t > BIKE_T0) {
    const x = BIKE_X(t);
    shadow(ctx, x, LANE.mid.y, 1.4 * LANE.mid.s, 530);
    bike(ctx, x, LANE.mid.y, LANE.mid.s, t);
  }

  // near lane: him, grown up, a bag in his hand
  if (t > T.heIn) {
    const w = walker(HE_X0, HE_V, T.heIn, t, LANE.near, 1);
    const ph = walkPhase(w.d, HE_S) * TAU;
    const p = pose({ ...w, aA1: 0.06 + 0.08 * Math.sin(ph), aA2: 0.04, head: 0.04 });
    shadow(ctx, w.x, LANE.near.y, HE_S, 540);
    const j = figure(ctx, p, { id: 1 });
    bag(ctx, j.handA, Math.sin(ph + 0.6) * 0.08);
  }
}

function bag(ctx, hand, sw) {
  const [hx, hy] = hand;
  ctx.save();
  ctx.translate(hx, hy);
  ctx.rotate(sw);
  const w = 62;
  const h = 42;
  path(ctx, ellipsePts(0, 4, 11, 9, Math.PI, TAU, 8), { w: 2.6, seed: 500 });
  fillPoly(ctx, [[-w / 2, 6], [w / 2, 6], [w / 2, 6 + h], [-w / 2, 6 + h]], COL.paper, 1);
  rect(ctx, -w / 2, 6, w, h, { w: 3, over: 2, seed: 501 });
  line(ctx, -w / 2 + 4, 16, w / 2 - 4, 16, { w: 1.6, alpha: 0.6, seed: 505 });
  ctx.restore();
}

function bike(ctx, x, gy, S, t) {
  ctx.save();
  ctx.translate(x, gy);
  ctx.scale(-S, S); // riding left
  const r = 46;
  const wy = -r;
  const xb = -70;
  const xf = 70;
  const ang = -BIKE_X(t) / S / r;
  for (const [cx, sd] of [[xb, 600], [xf, 610]]) {
    circle(ctx, cx, wy, r, { w: 2.8, seed: sd });
    for (let i = 0; i < 3; i++) {
      const a = ang + (i / 3) * Math.PI;
      line(ctx, cx - Math.cos(a) * r * 0.9, wy - Math.sin(a) * r * 0.9, cx + Math.cos(a) * r * 0.9, wy + Math.sin(a) * r * 0.9, { w: 1.2, alpha: 0.5, seed: sd + 1 + i, wobble: 0 });
    }
  }
  // frame
  const seat = [-24, wy - 72];
  const crank = [-4, wy];
  const head = [52, wy - 80];
  path(ctx, [[xb, wy], crank, [xf - 22, wy - 66], [xb + 34, wy - 64], [xb, wy]], { w: 3, seed: 620 });
  path(ctx, [crank, [seat[0] + 2, seat[1] + 4]], { w: 3, seed: 621 });
  path(ctx, [[xf, wy], head, [head[0] - 18, head[1] - 8]], { w: 3, seed: 622 });
  line(ctx, seat[0] - 14, seat[1], seat[0] + 14, seat[1], { w: 4.5, seed: 623 });
  circle(ctx, crank[0], crank[1], 7, { w: 2, seed: 624 });
  // rider (side view, pedalling)
  const s = 0.95;
  const pa = ang * 0.55;
  const hip = [seat[0] + 2, seat[1] - 5];
  const ped = (ph) => [crank[0] + Math.cos(ph) * 19, crank[1] + Math.sin(ph) * 19];
  const ul = 58 * s;
  const ll = 56 * s;
  // two-bone legs: knee forward, foot on the pedal
  const legAng = (foot) => {
    const dx = foot[0] - hip[0];
    const dy = foot[1] - hip[1];
    const D = Math.min(Math.hypot(dx, dy), (ul + ll) * 0.999);
    const phi = Math.atan2(dx, dy);
    const a = Math.acos(clamp((ul * ul + D * D - ll * ll) / (2 * ul * D), -1, 1));
    const b = Math.acos(clamp((ul * ul + ll * ll - D * D) / (2 * ul * ll), -1, 1));
    return [phi + a, -(Math.PI - b)];
  };
  const [lA1, lA2] = legAng(ped(pa));
  const [lB1, lB2] = legAng(ped(pa + Math.PI));
  // arms to the handlebar
  const lean = 0.32;
  const ar = [hip[0] + Math.sin(lean) * (88 - 13) * s, hip[1] - Math.cos(lean) * (88 - 13) * s];
  const bar = [head[0] - 16, head[1] - 6];
  const ua = 46 * s;
  const la = 44 * s;
  const adx = bar[0] - ar[0];
  const ady = bar[1] - ar[1];
  const AD = Math.min(Math.hypot(adx, ady), (ua + la) * 0.999);
  const aphi = Math.atan2(adx, ady);
  const aa = Math.acos(clamp((ua * ua + AD * AD - la * la) / (2 * ua * AD), -1, 1));
  const ab = Math.acos(clamp((ua * ua + la * la - AD * AD) / (2 * ua * la), -1, 1));
  const a1 = aphi - aa;
  const a2 = Math.PI - ab;
  const p = pose({ x: hip[0], y: hip[1], s, f: 1, lean, lA1, lA2, lB1, lB2, aA1: a1, aA2: a2, aB1: a1 - 0.05, aB2: a2, head: -0.22 });
  figure(ctx, p, { id: 4 });
  ctx.restore();
}
