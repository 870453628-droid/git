// s05 — 无所不在 (33.0–36.0, music only)
// 第四章：他在羊皮纸上、浴室墙上、自己手臂上写诗，写出来的全是她。咖啡的热气里有她，
// 门口的光里有她，墙上也有她。台上的小金鱼静静看着。
// Music beats here fall at ~33.17, 34.26 (strong), 35.35; half beats 33.72, 34.80, 35.90.
import { COL, TAU, lerp, clamp, smooth, keys, ease, path, line, ellipsePts, dot, camera } from '../lib.js';
import { figure, pose, reach, joints, walk, walkPhase, standY } from '../figure.js';
import { goldFish, coffeeCup, goldGlow } from '../props.js';
import { ROOM, HIM, workshop, bench } from './s04.js';

// ------------------------------------------------------------ her outline
// Her little outline, front view, as the pen would draw it: head, bow, body,
// arms, skirt, legs, boots. Unit coordinates: feet at (0, 0), top of the bow
// at about y = -97 (so h = 100 is her full height).
const GIRL = [
  ellipsePts(0, -78, 10.5, 11, -2.0, -2.0 + TAU + 0.3, 20),
  [[6, -88], [0, -96], [-1, -88.5], [6, -88], [13, -95.5], [14.5, -87], [6, -88]],
  [[0, -67], [0, -44]],
  [[-14, -47], [0, -62], [14, -47]],
  [[-5, -46], [-18, -20], [18, -20], [5, -46]],
  [[-6, -20], [-6.5, -6]],
  [[6, -20], [6.5, -6]],
  ellipsePts(-7.5, -3, 5, 3.4, Math.PI, Math.PI + TAU + 0.2, 10),
  ellipsePts(7.5, -3, 5, 3.4, 0, TAU + 0.2, 10),
];
const segLen = (pts) => {
  let l = 0;
  for (let i = 1; i < pts.length; i++) l += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return l;
};
const GIRL_LEN = GIRL.map(segLen);
const GIRL_TOTAL = GIRL_LEN.reduce((a, b) => a + b, 0);

function resampleUnit(pts, step) {
  const out = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1];
    const [x1, y1] = pts[i];
    const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / step));
    for (let j = 1; j <= n; j++) out.push([lerp(x0, x1, j / n), lerp(y0, y1, j / n)]);
  }
  return out;
}
const GIRL_FINE = GIRL.map((s) => resampleUnit(s, 4));

// Draw her outline with feet at (x, y), height h. k: 0..1 how much is drawn.
// o: {w, alpha, seed, wave (steam sway, px), t, up (draw from the boots up),
//     rot}. Returns the pen tip (the point being drawn) or null.
export function girl(ctx, x, y, h, k, o = {}) {
  if (k <= 0) return null;
  const u = h / 100;
  const order = o.up ? GIRL.map((_, i) => GIRL.length - 1 - i) : GIRL.map((_, i) => i);
  const wave = o.wave ?? 0;
  const t = o.t ?? 0;
  const rot = o.rot ?? 0;
  const c = Math.cos(rot);
  const sn = Math.sin(rot);
  const P = ([px, py]) => {
    let wx = px;
    if (wave) wx += Math.sin(py * 0.09 + t * 4.2) * wave * (0.4 + 0.6 * clamp(-py / 100));
    return [x + (wx * c - py * sn) * u, y + (wx * sn + py * c) * u];
  };
  let left = k * GIRL_TOTAL;
  let tip = null;
  const seed = o.seed ?? 5000;
  for (const i of order) {
    if (left <= 0) break;
    const kk = clamp(left / GIRL_LEN[i]);
    left -= GIRL_LEN[i];
    const pts = (wave ? GIRL_FINE[i] : GIRL[i]).map(P);
    if (!o.dry) path(ctx, pts, { w: o.w ?? 2.4, alpha: o.alpha, seed: seed + i, wobble: o.wobble ?? 0.7, draw: kk, dash: o.dash });
    if (kk < 1) {
      const tp = (wave ? GIRL_FINE[i] : GIRL[i]);
      // pen tip: the point kk of the way along this stroke
      let need = kk * GIRL_LEN[i];
      for (let j = 1; j < tp.length; j++) {
        const d = Math.hypot(tp[j][0] - tp[j - 1][0], tp[j][1] - tp[j - 1][1]);
        if (need <= d || j === tp.length - 1) {
          const f = d ? clamp(need / d) : 0;
          tip = P([lerp(tp[j - 1][0], tp[j][0], f), lerp(tp[j - 1][1], tp[j][1], f)]);
          break;
        }
        need -= d;
      }
    }
  }
  return tip;
}

// The fish lying on its side, facing left (toward him).
function fishLeft(ctx, x, y, s, o) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(-1, 1);
  goldFish(ctx, 0, 0, s, 0, o);
  ctx.restore();
}

// A quill held with its nib at (x, y); the feather leans back along ang.
function quill(ctx, x, y, ang = -2.2, s = 1, o = {}) {
  const c = Math.cos(ang);
  const sn = Math.sin(ang);
  const P = (a, b) => [x + (a * c - b * sn) * s, y + (a * sn + b * c) * s];
  path(ctx, [P(0, 0), P(52, 0)], { w: 2.2 * s, seed: 5100, wobble: 0.3, alpha: o.alpha });
  path(ctx, [P(16, 0), P(26, -6), P(42, -8), P(56, -3), P(52, 0)], { w: 1.8 * s, seed: 5101, wobble: 0.3, fill: COL.paper, alpha: o.alpha });
  path(ctx, [P(20, 0), P(30, 5), P(44, 6), P(52, 0)], { w: 1.8 * s, seed: 5102, wobble: 0.3, fill: COL.paper, alpha: o.alpha });
  for (let i = 0; i < 4; i++) path(ctx, [P(24 + i * 7, 0), P(28 + i * 7, -5)], { w: 1, seed: 5103 + i, wobble: 0, alpha: (o.alpha ?? 1) * 0.6 });
}

// --------------------------------------------------------------- the set
const SHEET = { x: 690, y: 602, w: 82, h: 92 };
const CUP = { x: 812, y: 710 };
const FISH = { x: 718, y: 702, s: 0.5 };
const STAND_X = 640;
// s04's camera near its end (copied: s04 is read-only and does not export it)
const S04_CAM = [
  [5.4, { x: 880, y: 640, z: 1.9 }],
  [6.2, { x: 960, y: 620, z: 1.6 }],
];
const BACK_X = 562;
// her outlines that appear on the wall (feet x, feet y, height, appear time, tilt)
const WALL = [
  [905, 548, 72, 1.22, 0.04],
  [1040, 592, 92, 1.28, -0.05],
  [1205, 560, 58, 1.36, 0.06],
  [470, 420, 60, 1.44, -0.04],
  [795, 404, 48, 1.5, 0.05],
  [315, 560, 66, 1.56, 0.03],
  [1262, 424, 44, 1.62, -0.06],
];

export default {
  draw(ctx, lt, info) {
    const t = info.t;
    const T = Math.max(0, lt);
    // during the dissolve, follow s04's own camera so the two rooms overlap
    const cam = lt < 0.2 ? keys(6 + lt, S04_CAM, ease.sine) : keys(lt, [
      [0.2, keys(6.2, S04_CAM, ease.sine)], // where s04 leaves the room
      [0.62, { x: 772, y: 628, z: 2.3 }], // close on him writing
      [0.95, { x: 765, y: 630, z: 2.32 }],
      [1.45, { x: 905, y: 600, z: 1.6 }], // she is everywhere
      [1.95, { x: 895, y: 604, z: 1.62 }],
      [2.3, { x: 645, y: 625, z: 2.95 }], // his arm
      [3.4, { x: 655, y: 630, z: 2.8 }],
    ], ease.sine);

    camera(ctx, cam, () => {
      workshop(ctx, t);
      bench(ctx);

      // the sheet pinned to the wall above the bench
      const S = SHEET;
      path(ctx, [[S.x, S.y], [S.x + S.w, S.y + 2], [S.x + S.w - 1, S.y + S.h], [S.x + 1, S.y + S.h - 1]], { w: 2.8, close: true, fill: 'rgba(246,241,230,0.9)', seed: 5200, wobble: 0.5 });
      dot(ctx, S.x + S.w / 2, S.y + 6, 2.6);

      // ---------------------------------------------------- the outlines
      // 1. on the sheet: the pen draws her (33.17 -> 33.72)
      const k1 = smooth(T, 0.17, 0.72, ease.linear);
      const tip = girl(ctx, S.x + S.w / 2, S.y + S.h - 8, 76, k1, { seed: 5300, w: 2.3 });
      // 2. on the wall, everywhere (from the strong beat at 34.26)
      WALL.forEach(([x, y, h, at, rot], i) => {
        const k = smooth(T, at, at + 0.3, ease.out);
        girl(ctx, x, y, h, k, { seed: 5400 + i * 12, w: 2.2, alpha: 0.78, rot });
      });
      // 3. in the doorway light, where she stood
      const kd = smooth(T, 1.45, 1.95, ease.inOut);
      girl(ctx, ROOM.x1 + 80, ROOM.floor - 2, 215, kd, { seed: 5500, w: 2.6, alpha: 0.42, up: true });

      // the cup and its steam, which curls into her
      coffeeCup(ctx, CUP.x, CUP.y, 1.1, t, { steam: false });
      const ks = smooth(T, 1.3, 1.85, ease.inOut);
      for (let i = 0; i < 2; i++) {
        const pts = [];
        const len = lerp(34, 18, ks);
        for (let k = 0; k <= 8; k++) {
          const u = k / 8;
          pts.push([CUP.x - 4 + i * 8 + Math.sin(u * 5 + t * 3 + i) * 4, CUP.y - 30 - u * len]);
        }
        path(ctx, pts, { w: 1.8, seed: 5600 + i, wobble: 0.3, alpha: 0.5 });
      }
      girl(ctx, CUP.x + 2, CUP.y - 44, 86, ks, { seed: 5610, w: 1.8, alpha: 0.6, wave: 3.2, t, up: true });

      // the fish lies on the bench and watches
      const glint = Math.max(smooth(T, 0.66, 0.74) * (1 - smooth(T, 0.74, 1.0)), smooth(T, 2.8, 2.92) * (1 - smooth(T, 2.95, 3.3)));
      fishLeft(ctx, FISH.x, FISH.y, FISH.s, { seed: 5700, glint: glint * 0.9 });
      goldGlow(ctx, FISH.x, FISH.y, 70, 0.35 + 0.5 * glint);

      // ---------------------------------------------------- him
      // phases: write on the sheet; step back and look up at her everywhere;
      // write on his own arm; hug the arm
      const back = smooth(T, 1.05, 1.45);
      const lookUp = smooth(T, 1.0, 1.3) * (1 - smooth(T, 1.85, 2.1));
      const armUp = smooth(T, 1.85, 2.1); // forearm raised to write on
      const hug = smooth(T, 2.52, 2.88);
      const x = lerp(STAND_X, BACK_X, back);
      const p = pose({ x, y: standY(ROOM.floor, HIM.s), s: HIM.s, f: 1, lean: 0.12, lA1: 0.12, lB1: -0.1 });
      if (back > 0 && back < 1) {
        Object.assign(p, walk(-walkPhase(STAND_X - x, HIM.s), ROOM.floor, HIM.s, 0.55));
        p.x = x;
      }
      p.head = lerp(0.32, -0.32, lookUp) + 0.26 * armUp * (1 - hug) + 0.3 * hug;
      p.look = lerp(0.5, -0.8, lookUp) + 0.75 * armUp * (1 - hug) + 0.3 * hug;
      p.lean = 0.12 - 0.08 * lookUp + 0.04 * hug;

      // arm B: steadies the sheet; drops; comes up in front of his face to be
      // written on; then is held under his chin
      const rB = reach({ ...p, x: STAND_X }, 'B', S.x + 4, S.y + 48);
      const B = [
        [rB.a1, rB.a2],
        [0.12, 0.3],
        [1.02, 0.6],
        [0.6, 2.15],
      ];
      const wB = [1 - back, back * (1 - armUp), armUp * (1 - hug), hug];
      p.aB1 = B.reduce((a, b, i) => a + b[0] * wB[i], 0);
      p.aB2 = B.reduce((a, b, i) => a + b[1] * wB[i], 0);
      const jb = joints(p);
      // her outline runs along his forearm, feet at the elbow end
      const fdx = jb.handB[0] - jb.elbowB[0];
      const fdy = jb.handB[1] - jb.elbowB[1];
      const flen = Math.hypot(fdx, fdy);
      const armGirl = { x: jb.elbowB[0] + (fdx / flen) * 4, y: jb.elbowB[1] + (fdy / flen) * 4, h: 52, rot: Math.atan2(fdx, -fdy) };
      const kArm = smooth(T, 2.12, 2.46, ease.linear);
      const armTip = girl(null, armGirl.x, armGirl.y, armGirl.h, kArm, { dry: true, rot: armGirl.rot });

      // the pen hand (arm A)
      const atSheet = tip ?? (k1 >= 1
        ? [lerp(S.x + S.w / 2 + 10, S.x + S.w / 2 + 24, smooth(T, 0.72, 0.95)), lerp(S.y + 66, S.y + 50, smooth(T, 0.72, 0.95))]
        : [lerp(S.x + 10, S.x + 24, smooth(lt, -0.3, 0.17)), lerp(S.y + 6, S.y + 18, smooth(lt, -0.3, 0.17))]);
      // at rest the pen hand hangs by his side; when he hugs the arm it cradles it
      const cradle = [lerp(jb.elbowB[0], jb.handB[0], 0.35) + 4, lerp(jb.elbowB[1], jb.handB[1], 0.35) + 8];
      const atRest = [lerp(p.x + 42, cradle[0], hug), lerp(ROOM.floor - 162, cradle[1], hug)];
      const atArm = armTip ?? (kArm >= 1 ? [armGirl.x + 22, armGirl.y - 40] : [armGirl.x + 12, armGirl.y - 52]);
      const wSheet = 1 - smooth(T, 0.95, 1.25);
      const wArm = smooth(T, 1.92, 2.12) * (1 - smooth(T, 2.46, 2.66));
      const wRest = 1 - wSheet - wArm;
      const pen = [0, 1].map((i) => atSheet[i] * wSheet + atArm[i] * wArm + atRest[i] * wRest);
      const rA = reach(p, 'A', pen[0] - 2, pen[1] - 5);
      p.aA1 = rA.a1;
      p.aA2 = rA.a2;
      const eye = hug > 0.6 ? 'closed' : 'dot';
      const j = figure(ctx, p, { id: 1, mustache: true, eye });
      // the outline on his arm, on the skin
      girl(ctx, armGirl.x, armGirl.y, armGirl.h, kArm, { seed: 5800, w: 2, wobble: 0.3, rot: armGirl.rot });
      // the quill
      // the quill: in his hand; laid on the bench when he hugs his arm
      const laid = smooth(T, 2.5, 2.56);
      if (laid < 1) quill(ctx, j.handA[0] + 2, j.handA[1] + 5, lerp(-1.85, -0.12, wRest), 0.75);
      else quill(ctx, BACK_X + 44, ROOM.floor - 155, -0.12, 0.75);
      // a start of surprise when she pops up everywhere
      const start = smooth(T, 1.2, 1.28) * (1 - smooth(T, 1.5, 1.7));
      if (start > 0.02) {
        const [hx, hy] = j.head;
        for (let i = 0; i < 3; i++) {
          const a = -Math.PI / 2 + (i - 1) * 0.55 + 0.25;
          const r0 = j.r + 10;
          line(ctx, hx + Math.cos(a) * r0, hy + Math.sin(a) * r0, hx + Math.cos(a) * (r0 + 16), hy + Math.sin(a) * (r0 + 16), { w: 2.4, alpha: start, seed: 5950 + i, wobble: 0 });
        }
      }
      // a contented sigh
      const sigh = smooth(T, 2.8, 3.0) * (1 - smooth(T, 3.25, 3.45));
      if (sigh > 0.02) {
        const [hx, hy] = j.head;
        const sx = hx + 32;
        const sy = hy + 12;
        path(ctx, [[sx, sy], [sx + 10, sy - 6], [sx + 20, sy - 2], [sx + 28, sy - 10]], { w: 1.8, alpha: sigh * 0.7, seed: 5900, wobble: 0.6 });
      }
    });
  },
};
