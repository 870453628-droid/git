// s01 · 0–9 · 小时候，所有人都看着我。/ 我以为，那就是特别。
// A dark stage. One spotlight snaps on; its pool exactly fits a small boy.
// Around him in the dark, grown-ups clap. He smiles, puffs his chest, rises
// on his toes.
//
// The stage set is exported (READ-ONLY for other scenes): s02 starts on
// exactly the frame this scene ends on.
import { W, clamp, smooth, keys, ease, camera, path } from '../lib.js';
import { figure, pose, standY } from '../figure.js';
import { stage } from '../light.js';
import { onlooker } from '../props.js';

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

// Draw the audience. o.clap(person) -> 0..1 clapping amount, o.turn(person)
// -> head turn (default: toward the middle), o.alpha(person).
export function audience(ctx, t, o = {}) {
  for (const p of AUDIENCE) {
    const a = o.alpha ? o.alpha(p) : 1;
    if (a <= 0.01) continue;
    onlooker(ctx, p.x, p.g, p.s, t, {
      mode: o.mode ? o.mode(p) : 'clap',
      k: o.clap ? o.clap(p) : 1,
      ph: (p.i * 0.37) % 1,
      turn: o.turn ? o.turn(p) : -p.side * 0.7,
      id: 60 + p.i,
      alpha: a,
    });
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
    const z = keys(lt, [[0, 1.45], [4.5, 1.45], [9, STAGE.cam.z]], ease.sine);
    const cy = keys(lt, [[0, 640], [4.5, 640], [9, STAGE.cam.y]], ease.sine);
    const k = spotK(lt);
    camera(ctx, { x: STAGE.cx, y: cy, z }, () => {
      // floor
      path(ctx, [[-200, STAGE.floor], [W + 200, STAGE.floor]], { w: 3.4, seed: 900, wobble: 0.6 });

      audience(ctx, lt, {
        clap: (p) => smooth(lt, p.start, p.start + 0.35),
        // they look at him; a few lean in when he rises on his toes
        turn: (p) => -p.side * 0.7,
      });

      // the boy
      const s = STAGE.boyS;
      const shy = { aA1: 0.22, aA2: -1.5, aB1: 0.22, aB2: -1.5 };
      const akimbo = { aA1: 0.8, aA2: -2.1, aB1: 0.8, aB2: -2.1 };
      const arms = keys(lt, [[0, shy], [4.8, shy], [5.5, akimbo]]);
      const turn = keys(lt, [[0, 0], [1.6, 0], [2.2, -0.7], [2.9, -0.7], [3.5, 0.7], [4.2, 0.7], [4.8, 0]]);
      const look = keys(lt, [[0, 0], [0.8, -1], [1.5, -1], [1.9, 0], [4.8, 0], [5.4, -0.45]]);
      const mouth = keys(lt, [[0, 0], [3.0, 0], [3.5, 1]]);
      // chest out: a little taller; then tiptoe and two small bounces
      const rise = keys(lt, [[0, 0], [4.8, 0], [5.5, 3], [6.2, 3], [6.6, 8]]);
      const bounce = lt > 6.6 ? Math.abs(Math.sin((lt - 6.6) * Math.PI * 1.25)) * 6 * clamp((8.6 - lt) / 0.6) : 0;
      const head = keys(lt, [[0, 0], [5.5, 0], [6.0, -0.08]]);
      const p = pose({
        x: STAGE.cx, y: standY(STAGE.floor, s) - rise - bounce, s, view: 'front',
        ...arms, turn, look, head,
        lA1: 0.06, lB1: 0.06,
      });
      figure(ctx, p, { id: 1, cowlick: true, mouth });

      // pitch black until the light clicks on
      stage(ctx, stageLights(k), { dark: STAGE.dark + (1 - k) * 0.15 });
    });
  },
};
