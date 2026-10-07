// s05 — 那天我们并肩坐在高台上，望着班级，望着操场。没有人说话，我们像自然一样自然，
//       安静不语。坐在身边的她又在想些什么呢？我心里好奇，但没有问。
// Wide, from behind: the two sit on the platform; the camera looks at the
// school, then the track, then rests. Dissolve to the front two-shot: she
// gazes off, an empty thought above her; he turns to her, lifts his hand ...
// and puts it back down.
import { COL, smooth, keys, ease, path, ellipsePts, dot, camera, withLayer } from '../lib.js';
import { platformScene, ledgeFront, LEDGE } from '../sets.js';

const CUT = 8.7; // centre of the dissolve to the front shot

export default {
  draw(ctx, lt, info) {
    const t = info.t; // global time keeps wind/birds continuous
    const k = smooth(lt, CUT - 0.45, CUT + 0.45, ease.sine);

    if (k < 1) {
      const cam = keys(lt, [
        [0, { x: 960, y: 560, z: 1.0 }],
        [2.3, { x: 940, y: 545, z: 1.04 }],
        [3.4, { x: 780, y: 505, z: 1.1 }], // 望着班级
        [4.6, { x: 1170, y: 560, z: 1.1 }], // 望着操场
        [6.4, { x: 980, y: 560, z: 1.03 }],
        [9.2, { x: 965, y: 600, z: 1.08 }],
      ], ease.sine);
      const girlTilt = keys(lt, [[5.5, 0], [7.0, -0.5]], ease.inOut);
      withLayer(ctx, (l) => camera(l, cam, () => platformScene(l, t, { girlTilt })), { alpha: 1 - k });
    }

    if (k > 0) {
      const boyTurn = keys(lt, [[9.5, 0], [10.2, 1], [12.7, 1], [13.4, 0.1]], ease.inOut);
      const boyHand = keys(lt, [[11.45, 0], [12.05, 0.7], [12.4, 0.72], [12.95, 0]], ease.inOut);
      const girlLook = keys(lt, [[8.8, 0], [9.6, -0.85]], ease.inOut);
      const z = 1 + 0.06 * smooth(lt, CUT, 13.6, ease.sine);
      withLayer(ctx, (l) => camera(l, { x: 960, y: 560, z }, () => {
        ledgeFront(l, t, { boyTurn, boyHand, girlLook });
        // an empty thought above her: he can't read it
        const bub = Math.min(smooth(lt, 9.5, 10.2), 1 - smooth(lt, 12.9, 13.5));
        if (bub > 0.01) thought(l, LEDGE.girlX + 70, LEDGE.y - 330, bub);
      }), { alpha: k });
    }
  },
};

function thought(ctx, cx, cy, a) {
  const pts = [];
  for (let i = 0; i < 7; i++) {
    const a0 = (i / 7) * Math.PI * 2;
    const bx = cx + Math.cos(a0 + 0.2) * 58;
    const by = cy + Math.sin(a0 + 0.2) * 32;
    pts.push(...ellipsePts(bx, by, 21, 18, a0 - 1.2, a0 + 1.2, 6));
  }
  path(ctx, pts, { w: 2.8, alpha: 0.75 * a, dash: [8, 10], close: true, seed: 900 });
  dot(ctx, cx - 52, cy + 62, 5, COL.ink, 0.7 * a);
  dot(ctx, cx - 70, cy + 90, 3.4, COL.ink, 0.6 * a);
}
