// s09 — 做了又熔 (51.8–56.6)
// "我们生来就是为了死去"
// 第十三章：他每天做两条小金鱼，凑够二十五条就放到坩埚里熔化重做（那天早上罐里有十七条）。
// 他把蕾梅黛丝的娃娃拿到院里付之一炬。
// 本片：晚年的作坊。墙钉上挂着第一条小金鱼（从没被熔掉）。他一条一条地做，小鱼落进铁皮罐，
// 满二十五条就倒进坩埚熔掉，再从头做；循环越来越快，门外日夜、雨季旱季飞转；有一天院子里
// 冒起一股烟，架上她的娃娃不见了。最后一次熔化之后，一切停住（"死去"）。他抬起头看墙上那条
// 小金鱼，闭了一下眼睛，慢慢坐回凳子上，又敲起来——接 s10（s10 用同一组镜头关键帧和同一个
// 敲击函数接着往下走，见 cam() 和 resumeUp()）。
// Music: bars at 51.70, 52.79, 53.88, 54.97, 56.06.
import { W, H, COL, TAU, lerp, clamp, prog, smooth, keys, ease, hash, noise1, path, line, ellipse, ellipsePts, dot, fillPoly, camera } from '../lib.js';
import { figure, pose, mixPose, reach, joints, standY, SIT } from '../figure.js';
import { goldFish, goldGlow, sparkle, hangingFish, tinCan, crucible, doll, hammer } from '../props.js';
import { ROOM, HIM, workshop, bench, ANVIL } from './s04.js';
import { NAIL, FISH_ON_NAIL, nail } from './s11.js';

const FLOOR = ROOM.floor;
const TOP = FLOOR - 150;
const S = HIM.s;
const OLD = { id: 1, mustache: 'droop' };
const STOOL_SEAT = 780;
const SX = 522; // where he stands at the anvil (s07's spot)
const POUR_X = 596; // one shuffle to the right to reach the crucible
const CAN = [672, TOP]; // tin can on the bench
const CAN_S = 0.92;
const CRU = [750, TOP - 22]; // crucible on a little stand (its bottom)
const CRU_S = 0.9;
const SHELF = { x0: 1140, x1: 1310, y: 560 }; // her dolls (s07)
const DOOR_X = ROOM.x1;

// ------------------------------------------------------------ the loop
// landing times of the fish in the can (scene time). 17 in the can at first.
const START_N = 17;
const CYCLE1 = [0.62, 1.12, 1.3, 1.44, 1.55, 1.63, 1.695, 1.745]; // 18..25
const POUR1 = [1.77, 2.06];
const CYCLE2 = (() => {
  const out = [];
  for (let i = 0; i < 25; i++) out.push(2.08 + 0.22 * Math.pow(i / 24, 0.8));
  return out;
})();
const POUR2 = [2.31, 2.47];
const STILL = 2.47; // 54.27: everything stops
const LOOKUP = [2.66, 3.06];
const SITDOWN = [3.5, 4.12];
const RESUME = 4.24; // 56.04: he lifts the hammer again (s10 picks up the taps)

// how many fish in the can at time T
function canCount(T) {
  if (T < POUR1[0]) return START_N + CYCLE1.filter((x) => T >= x).length;
  if (T < POUR1[1]) return T < POUR1[0] + 0.12 ? 25 : Math.round(25 * (1 - prog(T, POUR1[0] + 0.12, POUR1[0] + 0.24)));
  if (T < POUR2[0]) return CYCLE2.filter((x) => T >= x).length;
  if (T < POUR2[1]) return T < POUR2[0] + 0.05 ? 25 : Math.round(25 * (1 - prog(T, POUR2[0] + 0.05, POUR2[0] + 0.12)));
  return 0;
}

// all landing times (for the fish in flight)
const LANDINGS = [...CYCLE1, ...CYCLE2];

// continuous "fish made" count: drives the days (two fish a day)
function made(T) {
  let n = 0;
  for (const x of LANDINGS) n += smooth(T, x - 0.12, x, ease.linear);
  return n;
}

// hammer phase: slow taps, then faster and faster, then nothing
function tapPhase(T) {
  const t0 = 0.75;
  const k = 2.6;
  if (T <= t0) return 2.1 * T;
  return 2.1 * t0 + (2.1 / k) * (Math.exp(k * (Math.min(T, STILL) - t0)) - 1);
}
// the taps after he sits down again; s10 goes on with the same function (its tapUp)
const resumeUp = (t) => Math.pow(Math.abs(Math.sin((((t - 56.04) * 2.1) % 1) * Math.PI + 0.25)), 0.7);
const tapRate = (T) => (T <= 0.75 ? 2.1 : 2.1 * Math.exp(2.6 * (Math.min(T, STILL) - 0.75)));

// ------------------------------------------------------------ pieces
// ------------------------------------------------------------ pieces
// the crucible's little iron stand
function stand(ctx) {
  const [x, y] = CRU;
  line(ctx, x - 20, y + 2, x - 26, TOP, { w: 3, seed: 9010, wobble: 0.3 });
  line(ctx, x + 20, y + 2, x + 26, TOP, { w: 3, seed: 9011, wobble: 0.3 });
  line(ctx, x - 24, y + 2, x + 24, y + 2, { w: 3, seed: 9012, wobble: 0.3 });
}

// the tin can, tipped by ang around (x, y) = its base centre
function can(ctx, x, y, ang, n) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  tinCan(ctx, 0, 0, CAN_S, n);
  ctx.restore();
}

// what is in the doorway: day or night, sun, moon, rain, wind and leaves
function doorway(ctx, T, night, season, blur, dayPh) {
  const x0 = DOOR_X + 4;
  const y0 = ROOM.doorTop + 4;
  const w = 560;
  const h = FLOOR - y0;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x0, y0, w, h);
  ctx.clip();
  // night darkens the doorway
  if (night > 0.01) {
    ctx.fillStyle = `rgba(40,32,24,${0.34 * night})`;
    ctx.fillRect(x0, y0, w, h);
    for (let i = 0; i < 5; i++) dot(ctx, x0 + 30 + hash(i * 5.3 + 2) * 170, y0 + 30 + hash(i * 2.9 + 7) * 140, 1.8, '#f4efe2', smooth(night, 0.5, 0.9));
  }
  // sun by day, moon by night, crossing the doorway (a smear when the days run together)
  // (once the days stop it rests where s10 has it: x0 + 150, y0 + 110)
  const arc = lerp((((dayPh * 2 + 0.5) % 1) + 1) % 1, 0.75, smooth(T, STILL - 0.12, STILL));
  const sx = x0 + 30 + arc * 160;
  const sy = y0 + 150 - Math.sin(arc * Math.PI) * 55;
  if (blur < 0.6) {
    const a = 1 - blur / 0.6;
    if (night < 0.5) {
      ellipse(ctx, sx, sy, 24, 24, { w: 3, alpha: a * (1 - night * 2) * 0.8, seed: 9020 });
    } else {
      const m = (night - 0.5) * 2 * a;
      fillPoly(ctx, [...ellipsePts(sx, sy, 20, 20, -1.9, 1.9, 12), ...ellipsePts(sx + 8, sy, 16, 16, 1.75, -1.75, 12)], '#f4efe2', m);
    }
  } else {
    // the sun and moon a single smeared arc
    // (days too fast to see: the sun's path is a dotted trail across the doorway)
    path(ctx, ellipsePts(x0 + 110, y0 + 150, 80, 55, Math.PI * 1.02, Math.PI * 1.98, 18), { w: 4, alpha: 0.32 * (blur - 0.6) / 0.4, seed: 9021, wobble: 0, dash: [1, 13] });
  }
  // rain: slanted lines over the yard
  if (season.rain > 0.01) {
    ctx.strokeStyle = COL.ink;
    ctx.lineWidth = 1.8;
    ctx.globalAlpha = 0.35 * season.rain;
    ctx.beginPath();
    for (let i = 0; i < 26; i++) {
      const px = x0 + hash(i * 3.1 + 1) * w;
      const py = y0 + ((hash(i * 7.7) * h + T * 900) % h);
      ctx.moveTo(px, py);
      ctx.lineTo(px - 6, py + 22);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  // dry season: leaves blowing past
  if (season.leaves > 0.01) {
    for (let i = 0; i < 5; i++) {
      const k = ((T * 0.9 + i * 0.21) % 1 + 1) % 1;
      const lx = x0 + 20 + k * 420;
      const ly = y0 + 120 + i * 50 + Math.sin(k * 9 + i) * 26;
      const a = Math.sin(Math.PI * k) * season.leaves;
      leaf(ctx, lx, ly, k * 7 + i, 1, a, 9030 + i * 2);
    }
  }
  ctx.restore();
}

function leaf(ctx, x, y, ang, s, a, seed) {
  if (a <= 0.01) return;
  const c = Math.cos(ang);
  const sn = Math.sin(ang);
  const P = (px, py) => [x + (px * c - py * sn) * s, y + (px * sn + py * c) * s];
  path(ctx, [P(-9, 0), P(0, -4.5), P(9, 0), P(0, 4.5), P(-9, 0)], { w: 2, alpha: a, seed, wobble: 0.2, fill: COL.paper });
}

// one puff of smoke: a soft bumpy blob
function puff(ctx, x, y, r, a, seed) {
  if (a <= 0.01) return;
  const pts = [];
  const n = 7;
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * TAU;
    const a1 = ((i + 1) / n) * TAU;
    const rr = r * (0.42 + 0.12 * hash(seed + i));
    const cx = x + Math.cos((a0 + a1) / 2) * r * 0.62;
    const cy = y + Math.sin((a0 + a1) / 2) * r * 0.5;
    pts.push(...ellipsePts(cx, cy, rr, rr, (a0 + a1) / 2 - 1.3, (a0 + a1) / 2 + 1.3, 6));
  }
  ctx.save();
  const g = ctx.createRadialGradient(x, y, 0, x, y, r * 1.1);
  g.addColorStop(0, `rgba(110,100,88,${0.3 * a})`);
  g.addColorStop(1, 'rgba(110,100,88,0)');
  ctx.fillStyle = g;
  ctx.fillRect(x - r * 1.2, y - r * 1.2, r * 2.4, r * 2.4);
  ctx.restore();
  path(ctx, pts, { w: 2, alpha: 0.32 * a, close: true, seed, wobble: 0.8 });
}

// the bonfire of her dolls in the yard, seen through the door: k 0..1
const PYRE_X = DOOR_X + 96;
function bonfire(ctx, T, k) {
  if (k <= 0.01 || k >= 1) return;
  const x = PYRE_X;
  const g = FLOOR;
  const flame = Math.sin(Math.PI * clamp(k * 1.25));
  ctx.save();
  ctx.beginPath();
  ctx.rect(DOOR_X + 4, ROOM.doorTop + 4, 600, FLOOR - ROOM.doorTop);
  ctx.clip();
  // the dolls on a little heap, going under
  if (k < 0.7) {
    const a = 1 - smooth(k, 0.3, 0.7);
    [-22, 0, 20].forEach((dx, i) => doll(ctx, x + dx, g - 12 - (i === 1 ? 10 : 0) + 6 * smooth(k, 0.2, 0.7), 1.25, { seed: 7110 + i * 3, alpha: a }));
  }
  // sticks, then ash
  const sa = 1 - smooth(k, 0.75, 1);
  line(ctx, x - 40, g - 2, x + 34, g - 14, { w: 3, seed: 9050, alpha: sa });
  line(ctx, x - 34, g - 14, x + 40, g - 2, { w: 3, seed: 9051, alpha: sa });
  // ink flames
  for (let i = 0; i < 4; i++) {
    const fx = x - 30 + i * 20;
    const fh = (34 + 18 * Math.sin(T * 17 + i * 2)) * flame;
    if (fh < 3) continue;
    path(ctx, [[fx - 8, g - 10], [fx - 4 + 3 * Math.sin(T * 11 + i), g - 10 - fh * 0.6], [fx + 2 * Math.sin(T * 13 + i), g - 10 - fh], [fx + 8, g - 10]], { w: 2.4, seed: 9055 + i, wobble: 0.5 });
  }
  ctx.restore();
  // the smoke: puffs rise out of the yard, grow, lean with the wind and thin out
  for (let i = 0; i < 9; i++) {
    const u = clamp((k - i * 0.075) / 0.5);
    if (u <= 0 || u >= 1) continue;
    const sx = x + Math.sin(u * 4 + i * 1.7) * 12 - u * u * 120;
    const sy = g - 40 - u * 380;
    const r = 18 + u * 52;
    const a = Math.sin(Math.PI * Math.pow(u, 0.7)) * (1 - 0.3 * u);
    puff(ctx, sx, sy, r, a, 9060 + i * 3);
  }
}

// ------------------------------------------------------------ camera
// s10 continues this scene's last camera move with the same keys (its camAC,
// global time): from 55.8 on the two scenes share one camera
function s10cam(t) {
  return keys(t, [
    [55.8, { x: 690, y: 595, z: 1.7 }],
    [56.8, { x: 940, y: 585, z: 1.16 }],
    [57.0, { x: 944, y: 585, z: 1.16 }],
  ], ease.sine);
}
const HANDOFF = 4.0; // 55.8

function cam(T) {
  // opens close on the fish on its nail (where s08 leaves the glint in his
  // pocket); pulls back to the bench and the door; when everything stops it
  // moves in on him and the fish; then s10's move
  if (T >= HANDOFF) return s10cam(51.8 + T);
  return keys(T, [
    [-0.4, { x: 792, y: 585, z: 2.9 }],
    [0.3, { x: 790, y: 586, z: 2.72 }],
    [1.05, { x: 905, y: 624, z: 1.5 }],
    [STILL, { x: 895, y: 622, z: 1.53 }],
    [STILL + 0.55, { x: 668, y: 572, z: 1.95 }],
    [3.3, { x: 664, y: 574, z: 1.96 }],
    [HANDOFF, s10cam(51.8 + HANDOFF)],
  ], ease.sine);
}

export default {
  fadeIn: 0.6,
  fadeOut: 0.6,
  draw(ctx, lt, info) {
    const t = info.t;
    const T = lt;
    const n = canCount(T);
    const m = made(T);
    // two fish a day: night falls between them
    const dayPh = m / 2 + 0.25;
    const dayRate = T > 0.75 && T < STILL ? tapRate(T) / 6 : 0.3;
    const blur = smooth(dayRate, 1.2, 3.5) * (1 - smooth(T, STILL, STILL + 0.15));
    const nightRaw = 0.5 - 0.5 * Math.cos(dayPh * TAU);
    let night = lerp(nightRaw, 0.35, blur) * (1 - smooth(T, STILL - 0.05, STILL + 0.3));
    if (T < 0.6) night *= smooth(T, 0.2, 0.6);
    // seasons: wet, dry, wet, dry...
    const sp = m / 3.2;
    const season = {
      rain: smooth(Math.sin(sp * Math.PI), 0.2, 0.6) * (1 - blur * 0.6) * smooth(T, 0.7, 0.9) * (1 - smooth(T, STILL, STILL + 0.2)),
      leaves: smooth(-Math.sin(sp * Math.PI), 0.2, 0.6) * (1 - blur * 0.6) * (1 - smooth(T, STILL, STILL + 0.2)),
    };
    const BURN = [0.95, 1.85];
    const burnK = prog(T, BURN[0], BURN[1]);

    camera(ctx, cam(T), () => {
      workshop(ctx, t, { melquiades: false, shelfFish: false, doorLight: 1 - 0.75 * night });
      doorway(ctx, T, night, season, blur, dayPh);
      bonfire(ctx, T, burnK);
      // her dolls on their shelf, until the day of the fire
      line(ctx, SHELF.x0, SHELF.y, SHELF.x1, SHELF.y, { w: 3.5, seed: 7100 });
      line(ctx, SHELF.x0 + 14, SHELF.y, SHELF.x0 + 30, SHELF.y + 18, { w: 2.2, seed: 7101 });
      line(ctx, SHELF.x1 - 14, SHELF.y, SHELF.x1 - 30, SHELF.y + 18, { w: 2.2, seed: 7102 });
      const dollA = 1 - smooth(T, BURN[0] - 0.08, BURN[0] + 0.04);
      if (dollA > 0.01) [1170, 1225, 1280].forEach((x, i) => doll(ctx, x, SHELF.y - 1, 1.35 + (i === 1 ? 0.15 : 0), { seed: 7110 + i * 3, alpha: dollA }));

      bench(ctx, { lampGlow: Math.max(lerp(0.85, 1, night), smooth(T, 3.6, 4.4)) });
      const anvil = ANVIL();

      // ---- THE fish on its nail (never melted)
      const look = smooth(T, LOOKUP[0], LOOKUP[1]);
      const lookOff = smooth(T, SITDOWN[0], SITDOWN[1]);
      const swing = 0.02 * Math.sin(t * 1.3) + 0.05 * Math.sin(T * 2.2) * (1 - smooth(T, 0.4, 1.0));
      const nailGlint = 0.25 + 0.75 * Math.exp(-Math.pow((T - 0.0) / 0.25, 2)) + 0.6 * smooth(T, LOOKUP[0] + 0.2, LOOKUP[1]) * (1 - smooth(T, LOOKUP[1] + 0.2, SITDOWN[0]));
      const fc = hangingFish(ctx, NAIL[0], NAIL[1] + 3, FISH_ON_NAIL.len, swing, FISH_ON_NAIL.s, { seed: 4200, glint: clamp(nailGlint) });
      goldGlow(ctx, fc[0], fc[1], 70, 0.45 + 0.4 * clamp(nailGlint - 0.25));
      nail(ctx);

      // ---- crucible and can
      stand(ctx);
      // melt: rises during each pour, then cools slowly
      const melt1 = smooth(T, POUR1[0] + 0.12, POUR1[0] + 0.26);
      const cool1 = smooth(T, POUR1[1], POUR2[0]);
      const melt2 = smooth(T, POUR2[0] + 0.05, POUR2[0] + 0.13);
      const melt = Math.max(melt1 * (1 - cool1), melt2);
      const hot = melt2 > 0 ? melt2 * (1 - 0.85 * smooth(T, STILL + 0.2, 4.4)) : melt1 * (1 - cool1);
      crucible(ctx, CRU[0], CRU[1], CRU_S, melt * (melt2 > 0 ? lerp(1, 0.75, smooth(T, STILL, 4.4)) : 1));
      if (hot > 0.01) goldGlow(ctx, CRU[0], CRU[1] - 28, 90, hot);

      // ---- him
      const pouring = (T >= POUR1[0] && T < POUR1[1]) || (T >= POUR2[0] && T < POUR2[1]);
      const pr = T < POUR2[0] ? POUR1 : POUR2;
      const pk = prog(T, pr[0], pr[1]);
      // shuffle right to pour, back again
      const shuffle = pouring ? Math.sin(Math.PI * clamp(pk * 1.15)) : 0;
      const sitK = smooth(T, SITDOWN[0], SITDOWN[1]);
      const standP = pose({ x: lerp(SX, POUR_X, shuffle), y: standY(FLOOR, S) + 3, s: S, f: 1, lean: 0.27, head: 0.16, look: 0.75, lA2: -0.05, lB2: -0.05 });
      const sitP = pose({ x: HIM.sitX, y: STOOL_SEAT - 3, s: S, f: 1, ...SIT, lean: 0.3, head: 0.18, look: 0.5 });
      let p = mixPose(standP, sitP, sitK);
      p.x = lerp(standP.x, HIM.sitX, sitK);
      // a little step for the shuffle (legs part and close)
      if (shuffle > 0.02 && sitK === 0) {
        const st = Math.sin(Math.PI * clamp(pk * 2.3)) * 0.25;
        p.lA1 = 0.05 + st;
        p.lB1 = -0.05 - st * 0.6;
      }
      // looking up at the fish on the nail
      // (the old neck lifts the head back; the stoop stays)
      const lk = look * (1 - lookOff);
      p.head = lerp(p.head, -0.62, lk);
      p.look = lerp(p.look, -1, lk);
      p.lean = lerp(p.lean, 0.16, lk);

      // the hammer: taps (accelerating), stops dead, rests; after sitting, one tap again
      const ph = tapPhase(T) % 1;
      const rate = tapRate(T);
      const working = T < STILL && !pouring;
      let upK = working ? Math.pow(Math.sin(ph * Math.PI), 0.7) : 0.15;
      if (T >= STILL) upK = 0.12;
      // after sitting down he taps again, exactly as s10 goes on (its tapUp)
      const tapAgain = smooth(T, RESUME - 0.05, RESUME + 0.22);
      if (sitK > 0.5) upK = lerp(0.1, resumeUp(t), tapAgain);
      const smear = working ? smooth(rate, 6, 14) : 0;
      const hamHand = [lerp(anvil[0] - 30, anvil[0] - 50, upK), lerp(anvil[1] - 30, anvil[1] - 62, upK)];
      const hamAng = lerp(0.62, -0.1, upK);
      // hand B: steadies the work; flicks each finished fish into the can; pours
      let bT = [anvil[0] + 4, anvil[1] - 4];
      let canPos = [CAN[0], CAN[1]];
      let canAng = 0;
      if (pouring) {
        const up = smooth(pk, 0.1, 0.4) * (1 - smooth(pk, 0.78, 1));
        const tilt = smooth(pk, 0.3, 0.5) * (1 - smooth(pk, 0.7, 0.88));
        canPos = [lerp(CAN[0], CRU[0] - 40, up), lerp(CAN[1], CRU[1] - 86, up)];
        canAng = tilt * 1.95;
        bT = [canPos[0] - 6, canPos[1] - 26];
        if (pk < 0.1) bT = [lerp(anvil[0] + 4, CAN[0] - 6, pk / 0.1), lerp(anvil[1] - 4, CAN[1] - 26, pk / 0.1)];
        if (pk > 0.88) bT = [lerp(CAN[0] - 6, anvil[0] + 4, (pk - 0.88) / 0.12), lerp(CAN[1] - 26, anvil[1] - 4, (pk - 0.88) / 0.12)];
      }
      // a flick of the wrist after each fish (cycle 1 only; later it is a blur)
      let flick = 0;
      for (const x of CYCLE1) flick = Math.max(flick, Math.exp(-Math.pow((T - x + 0.14) / 0.05, 2)));
      bT[1] -= 14 * flick;
      bT[0] += 10 * flick;
      if (sitK > 0) {
        const sitB = [anvil[0] + 4, anvil[1] - 4];
        bT = [lerp(bT[0], sitB[0], sitK), lerp(bT[1], sitB[1], sitK)];
      }
      let r = reach(p, 'A', hamHand[0], hamHand[1]);
      p.aA1 = r.a1;
      p.aA2 = r.a2;
      r = reach(p, 'B', bT[0], bT[1]);
      p.aB1 = r.a1;
      p.aB2 = r.a2;
      // while he sits down the hands leave the bench for a moment
      const lift = Math.sin(Math.PI * sitK);
      p.aA1 = lerp(p.aA1, 0.6, lift * 0.25);
      p.aA2 = lerp(p.aA2, 0.9, lift * 0.25);
      p.aB1 = lerp(p.aB1, 0.5, lift * 0.25);
      p.aB2 = lerp(p.aB2, 0.9, lift * 0.25);
      const blink = T > LOOKUP[1] + 0.3 && T < LOOKUP[1] + 0.62;
      const j = figure(ctx, p, { ...OLD, eye: blink ? 'closed' : 'dot' });
      if (smear > 0.02) {
        // the hammer goes too fast to see: a ghost at each end and a blur
        hammer(ctx, anvil[0] - 30, anvil[1] - 30, 0.62, 1, { alpha: 0.45 });
        hammer(ctx, anvil[0] - 50, anvil[1] - 62, -0.1, 1, { alpha: 0.35 * smear });
        path(ctx, ellipsePts(anvil[0] - 12, anvil[1] - 28, 46, 46, -2.3, -0.9, 10), { w: 2, alpha: 0.4 * smear, seed: 9070, wobble: 0.3 });
        path(ctx, ellipsePts(anvil[0] - 12, anvil[1] - 28, 36, 36, -2.2, -1.0, 10), { w: 1.6, alpha: 0.3 * smear, seed: 9071, wobble: 0.3 });
      }
      hammer(ctx, j.handA[0], j.handA[1], hamAng, 1, { alpha: 1 - 0.5 * smear });

      // the fish he is making (not THE fish): on the anvil while he works
      const onAnvil = T < STILL && !pouring;
      if (onAnvil) {
        const hit = working && ph < 0.12 && rate < 6;
        goldFish(ctx, anvil[0] + 6, anvil[1] - 7, 0.42, 0.05, { glint: hit ? 0.6 : 0, seed: 7400 });
      }
      // fish in flight to the can
      for (let i = 0; i < LANDINGS.length; i++) {
        const L = LANDINGS[i];
        const fl = i < CYCLE1.length ? 0.16 : 0.08;
        const k = prog(T, L - fl, L);
        if (k <= 0 || k >= 1) continue;
        const x = lerp(anvil[0] + 6, CAN[0], k);
        const y = lerp(anvil[1] - 7, CAN[1] - 50 * CAN_S, k) - Math.sin(Math.PI * k) * 46;
        goldFish(ctx, x, y, 0.36, k * 5, { seed: 7410 + (i % 5) });
      }
      // the can (with its fish), and gold running out of it during a pour
      can(ctx, canPos[0], canPos[1], canAng, n);
      if (pouring && canAng > 1.0) {
        const mouth = [canPos[0] + Math.cos(canAng - Math.PI / 2) * 50 * CAN_S, canPos[1] + Math.sin(canAng - Math.PI / 2) * 50 * CAN_S];
        for (let i = 0; i < 6; i++) {
          const u = ((T * 6 + i / 6) % 1);
          const dx = lerp(mouth[0], CRU[0] - 4, u);
          const dy = lerp(mouth[1], CRU[1] - 26, u * u);
          dot(ctx, dx, dy, 3, COL.gold, 0.9);
        }
      }
      if (melt2 > 0 && T > STILL) {
        // the last of the gold settles; one small glint
        const g = Math.exp(-Math.pow((T - (STILL + 0.1)) / 0.12, 2));
        if (g > 0.02) sparkle(ctx, CRU[0] + 8, CRU[1] - 34, 14 * g, g);
      }
    });

    // night falls over the whole room a little too
    if (night > 0.01) {
      ctx.save();
      ctx.fillStyle = `rgba(40,32,24,${0.1 * night})`;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }
  },
};
