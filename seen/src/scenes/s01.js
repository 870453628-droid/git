// s01 · 0–9 · 小时候，所有人都看着我。/ 我以为，那就是特别。
// A dark stage. One spotlight snaps on; its pool exactly fits a small boy.
// Around him in the dark, grown-ups clap. He smiles, puffs his chest, rises
// on his toes.
//
// The stage set is exported (READ-ONLY for other scenes): s02 starts on
// exactly the frame this scene ends on.
import { W, TAU, lerp, prog, smooth, keys, ease, camera, path } from '../lib.js';
import { figure, pose, standY, LEG } from '../figure.js';
import { stage } from '../light.js';

export const STAGE = {
  floor: 770,
  cx: 960,
  boyS: 0.6,
  pool: { rx: 64, ry: 15 },
  src: [960, -80],
  dark: 0.85,
  // where s01's camera ends (s02 starts here)
  cam: { x: 960, y: 650, z: 1.62 },
};

// The onlookers: two rows on each side of the stage, all facing the middle.
export const AUDIENCE = (() => {
  const out = [];
  const rows = [
    { g: 728, s: 0.8, xs: [520, 645, 775, 1145, 1275, 1400] },
    { g: 800, s: 0.95, xs: [380, 575, 1345, 1540] },
  ];
  let i = 0;
  for (const r of rows) {
    for (const x of r.xs) {
      out.push({ x, g: r.g, s: r.s * (0.95 + 0.1 * ((i * 37) % 7) / 7), side: x < 960 ? -1 : 1, i, start: 1.4 + ((i * 5) % 12) * 0.1 });
      i++;
    }
  }
  return out;
})();

// One front-view onlooker on this stage (s02 uses it too). Like
// props.onlooker(), but the clap brings the hands together at the midline
// (they don't cross), and the body can lean toward what they watch.
//   o: k (0..1 clapping), ph, turn, head, lean, id, alpha, back
export function person(ctx, x, ground, s, t, o = {}) {
  const k = o.k ?? 0;
  const p = pose({ x, y: ground - LEG * s, s, view: o.back ? 'back' : 'front' });
  p.lA1 = 0.08;
  p.lB1 = 0.08;
  // c = 1 at the moment the hands meet
  const c = Math.pow(0.5 + 0.5 * Math.sin((t * 2.6 + (o.ph ?? 0)) * TAU), 1.6);
  for (const A of ['A', 'B']) {
    p[`a${A}1`] = lerp(0.16, 0.4, k);
    p[`a${A}2`] = lerp(0.05, -3.17 + 0.25 * c, k);
  }
  p.y -= 1.5 * s * c * k;
  p.head = (o.head ?? 0) + 0.012 * Math.sin((t * 0.7 + (o.ph ?? 0)) * TAU);
  p.lean = o.lean ?? 0;
  p.turn = o.turn ?? 0;
  return figure(ctx, p, { id: o.id ?? 60, alpha: o.alpha, w: o.w });
}

// how hard the audience looks at him: face, head and body turned to the middle
export const gaze = (p) => ({ turn: -p.side * 1.0, head: -p.side * 0.1, lean: -p.side * 0.04 });

// Draw the audience. o.clap(person) -> 0..1 clapping amount, o.alpha(person).
export function audience(ctx, t, o = {}) {
  for (const p of AUDIENCE) {
    const a = o.alpha ? o.alpha(p) : 1;
    if (a <= 0.01) continue;
    person(ctx, p.x, p.g, p.s, t, { k: o.clap ? o.clap(p) : 1, ph: (p.i * 0.37) % 1, ...gaze(p), id: 60 + p.i, alpha: a });
  }
}

// Light on the stage: the spot plus a wide, faint spill so the audience
// reads as shapes in the dark. k: 0..1 spot intensity.
export function stageLights(k, o = {}) {
  const fx = o.fx ?? STAGE.cx;
  const rx = o.rx ?? STAGE.pool.rx;
  return [
    { type: 'spot', sx: o.sx ?? STAGE.src[0], sy: STAGE.src[1], fx, fy: STAGE.floor, rx, ry: STAGE.pool.ry * (rx / STAGE.pool.rx), k },
    { type: 'glow', x: fx, y: STAGE.floor - 120, r: 700, k: 0.3 * k * (o.spill ?? 1) },
  ];
}

// His arms: hands on hips (elbows wide, hands at the waist on the body line)
export const AKIMBO = { aA1: 0.72, aA2: -1.62, aB1: 0.72, aB2: -1.62 };

// Tiptoe without floating: the hip rises by `rise`, and each leg gets a short
// pointed toe down to the floor, so the tips stay on the floor line.
export function toes(ctx, j, floor, s, rise) {
  if (rise < 0.6) return;
  const w = Math.max(2, 4.6 * Math.pow(s, 0.85));
  for (const [i, f] of [[0, j.footA], [1, j.footB]]) {
    path(ctx, [[f[0], f[1] - 1], [f[0] + (i ? -0.6 : 0.6), floor + 0.5]], { w: w * 0.9, wobble: 0, seed: 950 + i });
  }
}

const INSERT = [2.9, 4.1];

// Spot intensity with the two-blink "click" at switch-on.
function spotK(lt) {
  if (lt < 0.5) return 0;
  if (lt < 0.56) return 1;
  if (lt < 0.64) return 0.15;
  if (lt < 0.72) return 1;
  return 1;
}

export default {
  fadeOut: 0,
  draw(ctx, lt) {
    let z = keys(lt, [[0, 1.45], [4.5, 1.45], [9, STAGE.cam.z]], ease.sine);
    let cy = keys(lt, [[0, 640], [4.5, 640], [9, STAGE.cam.y]], ease.sine);
    // a hard-cut insert: him in the beam, framed by the nearest clappers, as
    // he smiles and looks from one side to the other
    if (lt >= INSERT[0] && lt < INSERT[1]) {
      z = 3.2 + 0.08 * prog(lt, INSERT[0], INSERT[1]);
      cy = 658; // the floor just above the subtitle band
    }
    const k = spotK(lt);
    camera(ctx, { x: STAGE.cx, y: cy, z }, () => {
      // floor
      path(ctx, [[-200, STAGE.floor], [W + 200, STAGE.floor]], { w: 3.4, seed: 900, wobble: 0.6 });

      audience(ctx, lt, { clap: (p) => smooth(lt, p.start, p.start + 0.35) });

      // the boy
      const s = STAGE.boyS;
      // shy: hands behind his back (upper arms only, a little back), a sway;
      // then the hands come round onto his hips
      const shy = { aA1: 0.2, aA2: -0.9, aB1: 0.2, aB2: -0.9 };
      const arms = keys(lt, [[0, shy], [4.8, shy], [5.4, AKIMBO]]);
      const fore = smooth(lt, 4.85, 5.3); // how much forearm shows
      const sway = 0.03 * Math.sin((lt - 0.5) * 2.3) * (1 - smooth(lt, 4.3, 4.8));
      const turn = keys(lt, [[0, 0], [1.6, 0], [2.2, -0.7], [2.9, -0.7], [3.5, 0.7], [4.2, 0.7], [4.8, 0]]);
      const look = keys(lt, [[0, 0], [0.8, -1], [1.5, -1], [1.9, 0], [4.8, 0], [5.4, -0.45]]);
      const mouth = keys(lt, [[0, 0], [3.0, 0], [3.5, 1]]);
      // up on his toes, two small bounces (heels down, up again), heels down
      const rise = keys(lt, [[6.1, 0], [6.5, 7], [6.85, 7], [7.05, 1], [7.25, 7], [7.45, 1], [7.65, 6.5], [8.0, 6.5], [8.5, 0]]);
      const head = keys(lt, [[0, 0], [5.5, 0], [6.0, -0.08]]);
      const p = pose({
        x: STAGE.cx, y: standY(STAGE.floor, s) - rise, s, view: 'front',
        ...arms, turn, look, head, lean: sway,
        lA1: 0.06, lB1: 0.06,
      });
      const j = figure(ctx, p, { id: 1, cowlick: true, mouth, arms: fore < 1 ? 'upper' : undefined });
      if (fore > 0 && fore < 1) {
        // the hands coming round from behind his back
        const w = Math.max(2, 4.6 * Math.pow(s, 0.85));
        path(ctx, [j.elbowA, j.handA], { w, draw: fore, seed: 960, wobble: 0.6 });
        path(ctx, [j.elbowB, j.handB], { w, draw: fore, seed: 961, wobble: 0.6 });
      }
      toes(ctx, j, STAGE.floor, s, rise);

      // pitch black until the light clicks on; the spill (the faces in the
      // dark) comes up as the clapping starts
      stage(ctx, stageLights(k, { spill: smooth(lt, 0.6, 1.9) }), { dark: STAGE.dark + (1 - k) * 0.15 });
    });
  },
};
