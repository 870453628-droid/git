// s04 — 初见 (27.0–33.0, music only)
// 第四章：他在作坊里组装一条黄金小鱼，感到她回应了自己的呼唤。小女孩穿着粉红薄纱裙和
// 白色小靴子站在门前。他举起口中穿着细链的小金鱼："进来。"她走近问起小金鱼，他喘不过
// 气来；他说要把小金鱼送给她，她吓得逃出了作坊。
import { W, H, COL, lerp, clamp, prog, smooth, keys, ease, path, line, rect, ellipsePts, dot, fillPoly, camera, text } from '../lib.js';
import { figure, pose, mixPose, reach, joints, walk, walkPhase, standY, SIT } from '../figure.js';
import { frameBox } from '../sets.js';
import { goldFish, hangingFish, workbench, lamp, hammer, sparkle, goldGlow } from '../props.js';

export const ROOM = { x0: 200, x1: 1340, top: 150, floor: 860, doorTop: 440 };
export const BENCH = { x: 560, w: 380, anvilAt: 0.1 };
export const HIM = { s: 1.25, sitX: 492, standX: 700 };
export const HER = { s: 0.78 };
const STOOL = { x: 482, seat: 780 };

// The workshop set (room frame, door, bench, lamp, Melquíades in his corner).
// Exported so neighbouring scenes can reuse the same room.
export function workshop(ctx, t, o = {}) {
  const R = ROOM;
  const a = o.alpha ?? 1;
  // light through the door, lying across the floor
  const doorLight = o.doorLight ?? 1;
  if (doorLight > 0) {
    ctx.save();
    ctx.globalAlpha *= doorLight * a;
    const g = ctx.createLinearGradient(R.x1, 0, R.x1 - 520, 0);
    g.addColorStop(0, 'rgba(255,248,228,0.75)');
    g.addColorStop(1, 'rgba(255,248,228,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(R.x1, R.doorTop);
    ctx.lineTo(R.x1, R.floor);
    ctx.lineTo(R.x1 - 520, R.floor);
    ctx.lineTo(R.x1 - 80, R.doorTop + 120);
    ctx.closePath();
    ctx.fill();
    // the bright doorway itself, and the yard beyond
    ctx.fillStyle = 'rgba(255,250,236,0.8)';
    ctx.fillRect(R.x1, R.doorTop, W - R.x1, R.floor - R.doorTop);
    ctx.restore();
  }
  // the room is a frame, with the door cut into its right wall
  path(ctx, [[R.x1, R.doorTop], [R.x1, R.top], [R.x0, R.top], [R.x0, R.floor], [R.x1 + 260, R.floor]], { w: 5.5, seed: 4000, alpha: a, sketch: true });
  line(ctx, R.x1 - 8, R.doorTop, R.x1 + 26, R.doorTop, { w: 5, seed: 4001, alpha: a });
  line(ctx, R.x1 + 22, R.doorTop - 4, R.x1 + 22, R.floor, { w: 3, seed: 4002, alpha: a * 0.55 });
  // a shelf with a few finished fish (empty in old age: only THE fish is left)
  line(ctx, 900, 360, 1160, 360, { w: 3.5, seed: 4003, alpha: a });
  if (o.shelfFish !== false) for (let i = 0; i < 4; i++) goldFish(ctx, 940 + i * 60, 344, 0.42, 0, { alpha: a * 0.85, seed: 4010 + i * 7, still: true });
  // pliers and tongs hanging on the wall
  for (let i = 0; i < 3; i++) {
    const x = 560 + i * 60;
    line(ctx, x, 380, x, 382, { w: 6, seed: 4030 + i, alpha: a, wobble: 0 });
    path(ctx, [[x - 6, 384], [x - 9, 450], [x - 4, 460]], { w: 2.4, seed: 4040 + i, alpha: a * 0.8 });
    path(ctx, [[x + 6, 384], [x + 9, 450], [x + 4, 460]], { w: 2.4, seed: 4050 + i, alpha: a * 0.8 });
  }
  // Melquíades writing in his corner (the book: Aureliano hated him then)
  if (o.melquiades !== false) {
    const ma = a * 0.55;
    // his desk against the left wall; he sits to its right, facing it
    line(ctx, 225, 700, 330, 700, { w: 3.5, seed: 4060, alpha: ma });
    line(ctx, 236, 700, 238, R.floor, { w: 3, seed: 4061, alpha: ma });
    line(ctx, 320, 700, 318, R.floor, { w: 3, seed: 4062, alpha: ma });
    line(ctx, 372, 790, 432, 790, { w: 3.5, seed: 4065, alpha: ma });
    line(ctx, 378, 790, 376, R.floor, { w: 3, seed: 4066, alpha: ma });
    line(ctx, 426, 790, 428, R.floor, { w: 3, seed: 4067, alpha: ma });
    let mp = pose({ x: 402, y: 787, s: 1.05, f: -1, ...SIT, lean: 0.3, head: 0.25, look: 0.8 });
    const wr = Math.sin(t * 7) * 6;
    const r1 = reach(mp, 'A', 300 + wr, 692);
    const r2 = reach(mp, 'B', 320, 694);
    mp = { ...mp, aA1: r1.a1, aA2: r1.a2, aB1: r2.a1, aB2: r2.a2 };
    const mj = figure(ctx, mp, { id: 7, alpha: ma });
    // his big black hat
    const [hx, hy] = mj.head;
    fillPoly(ctx, [[hx - 24, hy - 14], [hx + 24, hy - 14], [hx + 17, hy - 48], [hx - 17, hy - 48]], COL.ink, ma);
    line(ctx, hx - 34, hy - 14, hx + 34, hy - 14, { w: 4, seed: 4063, alpha: ma });
    // squiggles of his unreadable writing on the desk
    path(ctx, [[248, 696], [262, 690], [272, 697], [288, 689], [300, 696]], { w: 1.4, seed: 4064, alpha: ma, wobble: 0.6 });
  }
  // stool and bench
  line(ctx, STOOL.x - 30, STOOL.seat, STOOL.x + 30, STOOL.seat, { w: 4.5, seed: 4070, alpha: a });
  line(ctx, STOOL.x - 24, STOOL.seat, STOOL.x - 28, R.floor, { w: 3.5, seed: 4071, alpha: a });
  line(ctx, STOOL.x + 24, STOOL.seat, STOOL.x + 28, R.floor, { w: 3.5, seed: 4072, alpha: a });
  return R.floor - 150;
}

// The bench stands behind him in depth: draw it before the figure.
export function bench(ctx, o = {}) {
  const a = o.alpha ?? 1;
  const top = workbench(ctx, BENCH.x, ROOM.floor, BENCH.w, { alpha: a, anvilAt: BENCH.anvilAt });
  lamp(ctx, BENCH.x + BENCH.w - 70, top, 1.1, (o.lampGlow ?? 1) * a, { alpha: a });
  return top;
}
export const ANVIL = () => [BENCH.x + BENCH.w * BENCH.anvilAt + 23, ROOM.floor - 150 - 26];

export default {
  fadeIn: 0.8,
  draw(ctx, lt, info) {
    const t = info.t;
    const T = Math.max(0, lt);
    const cam = keys(T, [
      [0, { x: 580, y: 640, z: 2.3 }], // close on the hammer and the fish
      [1.5, { x: 585, y: 630, z: 2.2 }],
      [2.3, { x: 930, y: 610, z: 1.45 }], // he looks up: the doorway
      [4.3, { x: 920, y: 615, z: 1.5 }],
      [4.9, { x: 850, y: 640, z: 1.95 }], // close on the two of them
      [5.4, { x: 880, y: 640, z: 1.9 }],
      [6.2, { x: 960, y: 620, z: 1.6 }],
    ], ease.sine);

    camera(ctx, cam, () => {
      workshop(ctx, t);
      const top = bench(ctx);
      const anvil = ANVIL();
      let benchDrawn = false;

      // ---------------------------------------------------- him
      const standK = smooth(T, 2.35, 2.85);
      const sitP = pose({ x: HIM.sitX, y: STOOL.seat - 3, s: HIM.s, f: 1, ...SIT, lean: 0.12, head: 0.12, look: 0.6 });
      const standP = pose({ x: HIM.standX, y: standY(ROOM.floor, HIM.s), s: HIM.s, f: 1, lean: 0.05 });
      let p = mixPose(sitP, standP, standK);
      const step = smooth(T, 2.75, 3.3);
      p.x = lerp(HIM.sitX + 28 * standK, HIM.standX, step);
      if (step > 0 && step < 1) Object.assign(p, walk(walkPhase(p.x - HIM.sitX, HIM.s), ROOM.floor, HIM.s, 0.7), { x: p.x });

      // hammering: four taps, then the hammer stops in the air
      const tapping = T < 1.6;
      const ph = (T * 2.6) % 1;
      const up = tapping ? Math.pow(Math.sin(ph * Math.PI), 0.7) : 1;
      const hamHand = [lerp(anvil[0] - 30, anvil[0] - 52, up), lerp(anvil[1] - 30, anvil[1] - 76, up)];
      // he lifts his head at 1.6 — he feels her answer
      const lift = smooth(T, 1.55, 2.0);
      p.head = lerp(0.12, -0.08, lift) * (1 - standK) + p.head * standK;
      p.look = lerp(0.6, -0.1, lift);

      // arm A: hammer while sitting; then the raised fish
      let fishHand;
      const raise = smooth(T, 2.8, 3.3);
      const offer = smooth(T, 4.85, 5.25);
      const sag = smooth(T, 5.7, 6.4) * 0.3;
      if (standK < 0.5) {
        const r = reach(p, 'A', hamHand[0], hamHand[1]);
        p.aA1 = r.a1;
        p.aA2 = r.a2;
      }
      const raised = [lerp(lerp(720, 790, raise), 870, offer), lerp(lerp(650, 548, raise), 588, offer) + sag * 110];
      if (standK >= 0.5) {
        const r = reach(p, 'A', raised[0], raised[1]);
        p.aA1 = r.a1;
        p.aA2 = r.a2;
      }
      // arm B: holds the fish on the anvil; then beckons "进来"
      if (standK < 0.5) {
        const r = reach(p, 'B', anvil[0] + 4, anvil[1] - 4);
        p.aB1 = r.a1;
        p.aB2 = r.a2;
      } else {
        const beck = smooth(T, 3.1, 3.3) * (1 - smooth(T, 3.9, 4.2));
        p.aB1 = lerp(0.2, 0.9, beck);
        p.aB2 = lerp(0.3, 1.2 + 0.5 * Math.sin(T * 14), beck);
      }
      // breathless: shoulders up, eyes shut for a moment
      const breath = smooth(T, 4.2, 4.4) * (1 - smooth(T, 4.75, 4.95));
      p.lean += -0.04 * breath + 0.12 * offer;
      const j = figure(ctx, p, { id: 1, mustache: true, eye: breath > 0.5 ? 'closed' : 'dot' });
      if (breath > 0.05) {
        // a small tangle of breath at his mouth
        const [hx, hy] = j.head;
        const sx = hx + 34;
        const sy = hy + 4;
        path(ctx, [[sx, sy], [sx + 10, sy - 8], [sx + 16, sy + 4], [sx + 8, sy + 10], [sx + 18, sy + 14], [sx + 26, sy + 2]], { w: 2, alpha: breath, seed: 4100, wobble: 0.8 });
      }

      // the hammer and the fish
      if (standK < 0.5) {
        hammer(ctx, j.handA[0], j.handA[1], lerp(0.62, -0.25, up), 1);
        const hit = tapping && ph < 0.12;
        goldFish(ctx, anvil[0] + 6, anvil[1] - 7, 0.5, 0.05, { glint: hit ? 0.8 : 0, seed: 4200 });
      } else {
        // hammer lies on the bench
        hammer(ctx, anvil[0] + 70, top - 4, 0.02, 1);
        const swing = Math.sin(T * 3.4) * 0.35 * (1 - smooth(T, 5.0, 5.3)) + Math.sin(T * 5) * 0.12 * smooth(T, 5.3, 5.6) * (1 - smooth(T, 6.0, 6.6));
        const fc = hangingFish(ctx, j.handA[0], j.handA[1], 52, swing, 0.62, { seed: 4200, glint: 0.4 + 0.6 * Math.max(0, Math.sin(T * 3)) });
        goldGlow(ctx, fc[0], fc[1], 90, 0.7);
      }

      // ---------------------------------------------------- her
      // appears at the door 1.9, walks in, looks at the fish, startles, runs out
      const appear = smooth(T, 1.85, 2.4);
      if (appear > 0) {
        const doorX = ROOM.x1 + 80;
        const stopX = 965;
        const g = ROOM.floor;
        let hp;
        let alpha = appear;
        if (T < 3.55) {
          hp = pose({ x: doorX, y: standY(g, HER.s), s: HER.s, f: -1, aA1: 0.12, aB1: -0.1, head: 0.05 });
        } else if (T < 4.5) {
          const k = prog(T, 3.55, 4.5);
          const x = lerp(doorX, stopX, ease.inOut(k));
          hp = pose({ x, s: HER.s, f: -1, ...walk(walkPhase(Math.abs(x - doorX), HER.s), g, HER.s, k < 0.95 ? 1 : 0) });
        } else if (T < 5.28) {
          // she looks up at the fish and asks about it, head tilted
          const ask = smooth(T, 4.5, 4.75);
          hp = pose({ x: stopX, y: standY(g, HER.s), s: HER.s, f: -1, head: -0.25 * ask, look: -0.6 * ask, aA1: lerp(0.1, 1.9, ask * (1 - smooth(T, 4.95, 5.15))), aA2: 0.3 });
        } else if (T < 5.45) {
          // startled: a little jump back
          const k = prog(T, 5.28, 5.45);
          hp = pose({ x: stopX + 20 * k, y: standY(g, HER.s) - 14 * Math.sin(k * Math.PI), s: HER.s, f: -1, aA1: 2.4, aA2: 0.4, aB1: 2.2, aB2: 0.5, lean: -0.15 });
        } else {
          // runs out of the door
          const k = prog(T, 5.45, 6.1);
          const x = lerp(stopX + 20, ROOM.x1 + 300, ease.in(k));
          hp = pose({ x, s: HER.s, f: 1, ...walk(walkPhase(Math.abs(x - stopX), HER.s) * 1.3, g, HER.s, 1.25), lean: 0.2 });
          alpha = 1 - smooth(T, 5.85, 6.1);
        }
        hp.tail = 0;
        figure(ctx, hp, { id: 2, bow: true, skirt: true, boots: true, alpha });
      }
    });
  },
};
