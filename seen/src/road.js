// The road he walks from s04 to s07. Side view: he walks to the RIGHT along
// the near edge; the far side of the road (where lamps and little crowds
// stand) is higher up the frame and smaller. World x grows to the right
// without limit; scroll with camera({x: hisX + offset}).
import { COL, hash, path } from './lib.js';

export const ROAD = {
  near: 760, // the near edge: his feet
  far: 640, // the far edge: roadside lamps and crowds stand here
  horizon: 470,
  farS: 0.62, // scale of people on the far side
};

// Draw the road between world x0..x1 (pass the visible range, with margin).
// o: { alpha, poles (default true), seed }
export function road(ctx, x0, x1, o = {}) {
  const a = o.alpha;
  const R = ROAD;
  // continuous lines are drawn in fixed 400-px tiles so their wobble is
  // stable while the camera scrolls
  const t0 = Math.floor(x0 / 400);
  const t1 = Math.ceil(x1 / 400);
  for (let i = t0; i < t1; i++) {
    const xa = i * 400;
    const xb = xa + 400;
    path(ctx, [[xa - 2, R.near], [xb + 2, R.near]], { w: 3.6, alpha: a, seed: 8200 + (i & 255) * 3, wobble: 0.6 });
    path(ctx, [[xa - 2, R.far], [xb + 2, R.far]], { w: 2.6, alpha: a, seed: 8201 + (i & 255) * 3, wobble: 0.6 });
    path(ctx, [[xa - 2, R.horizon], [xb + 2, R.horizon]], { w: 1.8, color: COL.inkSoft, alpha: a, seed: 8202 + (i & 255) * 3, wobble: 0.5 });
    // centre dashes
    const ym = (R.near + R.far) / 2 + 4;
    for (let k = 0; k < 2; k++) {
      const dx = xa + 60 + k * 200;
      path(ctx, [[dx, ym], [dx + 90, ym]], { w: 2.4, color: COL.inkSoft, alpha: a, seed: 8900 + (i & 255) * 2 + k, wobble: 0.3 });
    }
    // grass tufts on the near verge
    const gx = xa + 80 + hash(i * 3.1) * 240;
    tuft(ctx, gx, R.near + 26 + hash(i * 1.7) * 30, a, 9500 + (i & 255));
    // far telegraph poles every other tile
    if (o.poles !== false && (i & 1) === 0) {
      const px = xa + 120 + hash(i * 5.3) * 160;
      path(ctx, [[px, R.horizon + 2], [px, R.horizon - 70]], { w: 2, color: COL.inkSoft, alpha: a, seed: 9800 + (i & 255), wobble: 0.3 });
      path(ctx, [[px - 12, R.horizon - 62], [px + 12, R.horizon - 62]], { w: 1.6, color: COL.inkSoft, alpha: a, seed: 9801 + (i & 255), wobble: 0.3 });
    }
  }
}

function tuft(ctx, x, y, a, seed) {
  path(ctx, [[x - 8, y - 12], [x - 2, y], [x + 2, y - 16], [x + 5, y], [x + 12, y - 10]], { w: 2, color: COL.inkSoft, alpha: a, seed, wobble: 0.3 });
}
