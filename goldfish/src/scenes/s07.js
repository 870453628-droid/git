// s07 — 咖啡与空门 (39.6–44.7, music only)
// 第五章：她每天上午给作坊送一杯不加糖的咖啡，从清晨便开始唱歌；她用童年的娃娃装饰新房。
// 她猝然死去；人们为她摆了一张斜系黑带的照片，前面点着长明灯。
// 本片：同一个早上重复两遍；第三个早上门框空着，没有咖啡。小金鱼回到工作台上，躺在照片前。
// 他站起来，狠狠敲下一锤，然后是寂静。
// Music beats: 39.71, 40.80, 41.89, 42.98, 44.07 (half beats 40.26, 41.35, 42.44, 43.53).
import { W, H, COL, lerp, clamp, prog, smooth, keys, ease, path, line, ellipse, dot, camera, hash } from '../lib.js';
import { figure, pose, mixPose, reach, walk, walkPhase, standY, SIT } from '../figure.js';
import { goldFish, goldGlow, chain, coffeeCup, doll, mourningPhoto, lamp, hammer, notes } from '../props.js';
import { ROOM, HIM, HER, workshop, bench, ANVIL } from './s04.js';

const MORNING = [0.11, 1.2, 2.29]; // scene-local starts, one bar (1.09 s) each
const STRIKE = 3.93; // 43.53
const STOOL = { x: 482, seat: 780 };
const SIT_X = 492;
const STAND_X = 522;
const DOOR_X = ROOM.x1 + 100;
const STOP_X = 1196;
const PHOTO = { x: 688, y: 468, w: 112, h: 138 };
const CUP_AT = [668, ROOM.floor - 150];
const FISH_AT = [742, ROOM.floor - 157];
const VOTIVE = [812, ROOM.floor - 150];
const SHELF = { x0: 1140, x1: 1310, y: 560 };

// the fish on its chain around her neck (as in s06)
function necklace(ctx, j, f, s, glint) {
  const back = [j.neckTop[0] - f * 4 * s, j.neckTop[1] + 1];
  const front = [j.shoulder[0] + f * 9 * s, j.shoulder[1] + 22 * s];
  chain(ctx, back[0], back[1], front[0], front[1], { sag: 3, step: 5, w: 1.1 });
  const fs = 0.3;
  const cx = front[0];
  const cy = front[1] + 27 * fs;
  goldFish(ctx, cx, cy, fs, -Math.PI / 2 + f * 0.12, { seed: 7020, glint });
  goldGlow(ctx, cx, cy, 36, 0.5 + glint);
}

function fishLeft(ctx, x, y, s, o) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(-1, 1);
  goldFish(ctx, 0, 0, s, 0, o);
  ctx.restore();
}

// his smile: the eye closes into a little arc
function smileEye(ctx, j, p, k) {
  const [hx, hy] = j.head;
  const r = j.r;
  const a = j.headAngle;
  const ex = hx + p.f * Math.cos(a) * r * 0.45 + p.f * Math.sin(a) * r * 0.12;
  const ey = hy + Math.sin(a) * r * 0.45 - Math.cos(a) * r * 0.12;
  path(ctx, [[ex - 5, ey + 2], [ex, ey - 3 * k], [ex + 5, ey + 2]], { w: 2.6, seed: 7030, wobble: 0 });
}

// her portrait inside the mourning frame: the little girl, full length
function portrait(ctx, x, y, w, h) {
  ctx.save();
  ctx.fillStyle = 'rgba(120,100,70,0.08)';
  ctx.fillRect(x, y, w, h);
  ctx.restore();
  const s = 0.36;
  figure(ctx, pose({ view: 'front', x: x + w / 2, y: y + h - 8 - 114 * s, s, aA1: 0.18, aB1: 0.18, aA2: 0.1, aB2: 0.1 }), { id: 9, bow: true, skirt: true, boots: true, w: 1.8, still: true });
}

export default {
  fadeIn: 0.4,
  draw(ctx, lt, info) {
    const t = info.t;
    const T = lt;
    const M3 = MORNING[2];
    // which morning, and how far into it
    let mi = 0;
    for (let i = 0; i < 3; i++) if (T >= MORNING[i] - 0.15) mi = i;
    const u = T - MORNING[mi];
    const empty = mi === 2;
    // the nights between mornings; the last one is longer and darker
    const night = clamp(Math.max(
      1 - Math.abs(T - (MORNING[1] - 0.03)) / 0.17,
      (1 - Math.abs(T - (M3 - 0.06)) / 0.26) * 1.5,
    ), 0, 1.5);
    // the third morning: after the empty doorway, her photograph appears
    const dead = smooth(T, M3 + 0.62, M3 + 1.02);
    // beats of the ending
    const STAND = [M3 + 1.08, M3 + 1.3]; // 42.98 ->
    const RAISE = [M3 + 1.29, M3 + 1.5];

    // camera: the same wide morning shot three times; then the bench, the photo
    const shake = T > STRIKE ? Math.exp(-(T - STRIKE) * 14) * 8 : 0;
    const cam = keys(T, [
      [0, { x: 935, y: 640, z: 1.74 }],
      [M3 + 0.75, { x: 945, y: 640, z: 1.76 }],
      [M3 + 1.3, { x: 690, y: 612, z: 2.0 }],
      [STRIKE, { x: 665, y: 616, z: 2.08 }],
      [5.6, { x: 650, y: 624, z: 2.22 }],
    ], ease.sine);
    cam.x += shake * Math.sin(T * 90);
    cam.y += shake * Math.cos(T * 77);

    camera(ctx, cam, () => {
      workshop(ctx, t, { doorLight: (1 - 0.6 * Math.min(1, night)) * (1 - 0.3 * dead), melquiades: false });
      // her dolls on a little shelf by the door
      line(ctx, SHELF.x0, SHELF.y, SHELF.x1, SHELF.y, { w: 3.5, seed: 7100 });
      line(ctx, SHELF.x0 + 14, SHELF.y, SHELF.x0 + 30, SHELF.y + 18, { w: 2.2, seed: 7101 });
      line(ctx, SHELF.x1 - 14, SHELF.y, SHELF.x1 - 30, SHELF.y + 18, { w: 2.2, seed: 7102 });
      [1170, 1225, 1280].forEach((x, i) => doll(ctx, x, SHELF.y - 1, 1.35 + (i === 1 ? 0.15 : 0), { seed: 7110 + i * 3 }));

      bench(ctx, { lampGlow: 1 - dead });
      const anvil = ANVIL();
      const top = ROOM.floor - 150;

      // her photograph, the black ribbon, the little lamp; the fish lies before it
      const jolt = T > STRIKE ? Math.exp(-(T - STRIKE) * 6) * Math.sin((T - STRIKE) * 40) * 0.05 + 0.025 * smooth(T, STRIKE, STRIKE + 0.1) : 0;
      if (dead > 0) {
        ctx.save();
        ctx.globalAlpha *= dead;
        const P = PHOTO;
        ctx.translate(P.x + P.w / 2, P.y - 22);
        ctx.rotate(jolt);
        ctx.translate(-(P.x + P.w / 2), -(P.y - 22));
        line(ctx, P.x + P.w / 2, P.y - 22, P.x + 14, P.y, { w: 1.6, seed: 7200 });
        line(ctx, P.x + P.w / 2, P.y - 22, P.x + P.w - 14, P.y, { w: 1.6, seed: 7201 });
        dot(ctx, P.x + P.w / 2, P.y - 22, 3);
        mourningPhoto(ctx, P.x, P.y, P.w, P.h, { inner: portrait });
        ctx.restore();
        ctx.save();
        ctx.globalAlpha *= dead;
        // the little lamp keeps burning; the blow makes it gutter for a moment
        const gutter = T > STRIKE ? Math.exp(-(T - STRIKE) * 5) * Math.sin((T - STRIKE) * 31) * 0.35 : 0;
        lamp(ctx, VOTIVE[0], VOTIVE[1], 0.52, 0.85 + 0.15 * Math.sin(t * 7) - Math.abs(gutter));
        // the fish hops when the hammer falls
        const hop = T > STRIKE ? Math.max(0, Math.sin(clamp((T - STRIKE) / 0.22) * Math.PI)) * 9 : 0;
        // it glints when he first sees it, and once more in the silence
        const g = 0.5 * smooth(T, M3 + 0.95, M3 + 1.05) * (1 - smooth(T, M3 + 1.1, M3 + 1.4)) + 0.4 * smooth(T, 4.42, 4.52) * (1 - smooth(T, 4.56, 4.9));
        fishLeft(ctx, FISH_AT[0], FISH_AT[1] - hop, 0.48, { seed: 7300, glint: g });
        goldGlow(ctx, FISH_AT[0], FISH_AT[1], 60, 0.45);
        ctx.restore();
      }

      // the coffee she brought sits by his hand for the rest of the day
      if (mi < 2) {
        const cupK = smooth(u, 0.72, 0.86) * (1 - smooth(T, MORNING[mi + 1] - 0.16, MORNING[mi + 1] - 0.06));
        if (cupK > 0) coffeeCup(ctx, CUP_AT[0], CUP_AT[1], 1.05, t, { alpha: cupK });
      }

      // ---------------------------------------------------- him
      const standK = smooth(T, STAND[0], STAND[1]);
      const sitP = pose({ x: SIT_X, y: STOOL.seat - 3, s: HIM.s, f: 1, ...SIT, lean: 0.12, head: 0.12, look: 0.6 });
      const standP = pose({ x: STAND_X, y: standY(ROOM.floor, HIM.s), s: HIM.s, f: 1, lean: 0.06, head: 0.05, look: 0.2 });
      const p = mixPose(sitP, standP, standK);
      p.x = lerp(SIT_X, STAND_X, standK);

      // each morning he looks up at 0.36 and smiles; the third morning there is no one
      const look = smooth(u, 0.34, 0.46) * (empty ? 1 : 1 - smooth(u, 0.86, 1.0));
      const smile = empty ? 0 : smooth(u, 0.48, 0.6) * (1 - smooth(u, 0.86, 0.98));
      const toPhoto = smooth(T, M3 + 0.82, M3 + 1.05);
      if (standK < 0.5) {
        p.head = lerp(0.12, -0.12, look);
        p.look = lerp(0.6, -0.1, look);
        // the third morning: his gaze falls from the door to the photo
        p.head = lerp(p.head, -0.06, toPhoto);
        p.look = lerp(p.look, -0.5, toPhoto);
      }
      // the strike: up, hang, and down once
      const raise = smooth(T, RAISE[0], RAISE[1], ease.out);
      const down = smooth(T, STRIKE - 0.07, STRIKE, ease.in);
      const after = smooth(T, STRIKE + 0.05, STRIKE + 0.5);
      if (standK >= 0.5) {
        p.lean = 0.06 - 0.08 * raise * (1 - down) + 0.34 * down + 0.06 * after;
        p.head = lerp(0.0, -0.2, raise) * (1 - down) + 0.42 * down + 0.14 * after;
        p.look = lerp(-0.4, -0.6, raise * (1 - down)) + 1.0 * down;
      }

      // hammer hand (A): taps; stops when he looks up; then the one blow
      const working = standK < 0.5 && look < 0.5 && toPhoto < 0.5;
      const ph = (T * 2.6) % 1;
      const upK = working ? Math.pow(Math.sin(ph * Math.PI), 0.7) : 1;
      let hamHand;
      let hamAng;
      if (standK < 0.5) {
        hamHand = [lerp(anvil[0] - 30, anvil[0] - 50, upK), lerp(anvil[1] - 30, anvil[1] - 62, upK)];
        hamAng = lerp(0.62, -0.1, upK);
      } else {
        // the hammer swings up in front of him and back over his head, then down
        const rest = [anvil[0] - 46, anvil[1] - 56];
        const high = [p.x - 40, p.y - 222];
        const hit = [anvil[0] - 30, anvil[1] - 30];
        const via = [p.x + 96, p.y - 214];
        const bez = (a, b, c, k) => [0, 1].map((i) => (1 - k) * (1 - k) * a[i] + 2 * (1 - k) * k * b[i] + k * k * c[i]);
        hamHand = bez(rest, via, high, raise);
        hamAng = lerp(-0.1, -2.5, raise);
        if (down > 0) {
          hamHand = bez(high, [p.x + 70, p.y - 200], hit, down);
          hamAng = lerp(-2.5, 0.62, down);
        }
      }
      const rA = reach(p, 'A', hamHand[0], hamHand[1]);
      p.aA1 = rA.a1;
      p.aA2 = rA.a2;
      // hand B steadies the work on the anvil; standing, it grips the bench edge
      const bSit = [anvil[0] + 4, anvil[1] - 4];
      const bStand = [anvil[0] - 44, top + 3];
      const bTgt = [lerp(bSit[0], bStand[0], standK), lerp(bSit[1], bStand[1], standK)];
      const rB = reach(p, 'B', bTgt[0], bTgt[1]);
      p.aB1 = rB.a1;
      p.aB2 = rB.a2;
      const eye = after > 0.6 ? 'closed' : smile > 0.5 ? 'none' : 'dot';
      const j = figure(ctx, p, { id: 1, mustache: true, eye });
      if (eye === 'none') smileEye(ctx, j, p, smile);
      hammer(ctx, j.handA[0], j.handA[1], hamAng, 1);
      // the little fish he is making (not THE fish); none on the third morning
      if (!empty) {
        const hit = working && ph < 0.12;
        goldFish(ctx, anvil[0] + 6, anvil[1] - 7, 0.42, 0.05, { glint: hit ? 0.6 : 0, seed: 7400 });
      }
      // the blow
      if (T > STRIKE - 0.01 && T < STRIKE + 0.6) {
        const k = prog(T, STRIKE - 0.01, STRIKE + 0.6);
        const cx = anvil[0] + 10;
        const cy = anvil[1] - 2;
        for (let i = 0; i < 7; i++) {
          const a = -Math.PI + (i / 6) * Math.PI;
          const r0 = 26 + 70 * ease.out(k);
          const r1 = r0 + 26 * (1 - k);
          line(ctx, cx + Math.cos(a) * r0, cy + Math.sin(a) * r0 * 0.8, cx + Math.cos(a) * r1, cy + Math.sin(a) * r1 * 0.8, { w: 3.2 * (1 - k) + 0.5, alpha: 1 - k, seed: 7500 + i, wobble: 0 });
        }
        ellipse(ctx, cx, cy, 30 + 160 * ease.out(k), 8 + 40 * ease.out(k), { w: 2, alpha: 0.5 * (1 - k), seed: 7510 });
      }

      // ---------------------------------------------------- her (mornings 1 and 2)
      if (!empty && T > -0.4) {
        const herY = standY(ROOM.floor, HER.s);
        const wk = smooth(u, 0.0, 0.5, ease.out);
        const x = lerp(DOOR_X, STOP_X, wk);
        const hp = pose({ x, y: herY, s: HER.s, f: -1, head: -0.05 });
        if (wk > 0 && wk < 1) Object.assign(hp, walk(walkPhase(DOOR_X - x, HER.s), ROOM.floor, HER.s, 0.95), { x });
        // both hands carry the cup in front of her; she lifts it a little toward him
        const offer = smooth(u, 0.48, 0.62);
        hp.aA1 = lerp(1.0, 1.35, offer);
        hp.aA2 = lerp(1.0, 0.55, offer);
        hp.aB1 = lerp(0.85, 1.2, offer);
        hp.aB2 = lerp(1.15, 0.7, offer);
        hp.head = -0.05 - 0.1 * offer;
        hp.tail = 0;
        const fadeIn = smooth(u, -0.06, 0.08);
        const fadeOut = 1 - smooth(u, 0.78, 0.94);
        const a = fadeIn * fadeOut;
        if (a > 0.01) {
          ctx.save();
          ctx.globalAlpha *= a;
          const hj = figure(ctx, hp, { id: 2, bow: true, skirt: true, boots: true });
          const g = smooth(u, 0.5, 0.56) * (1 - smooth(u, 0.6, 0.8));
          necklace(ctx, hj, -1, HER.s, g);
          const cupX = (hj.handA[0] + hj.handB[0]) / 2 - 4;
          const cupY = Math.min(hj.handA[1], hj.handB[1]) + 6;
          coffeeCup(ctx, cupX, cupY, 0.95, t);
          // she sings from the moment she comes in
          notes(ctx, hj.head[0] - 6, hj.head[1] - 34, clamp(u / 0.95));
          ctx.restore();
        }
      }
      // the third morning: the doorway stays empty (a little dust in the light)
      if (empty && u > -0.1 && u < 1.6) {
        for (let i = 0; i < 6; i++) {
          const px = ROOM.x1 + 20 + hash(i * 3.3) * 150;
          const py = ROOM.doorTop + 60 + ((hash(i * 7.1) * 340 + T * 14) % 340);
          dot(ctx, px, py, 1.6, COL.ink, 0.25);
        }
      }
    });
    // the nights between the mornings
    if (night > 0) {
      ctx.save();
      ctx.fillStyle = `rgba(40,32,24,${0.15 * night})`;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }
  },
};
