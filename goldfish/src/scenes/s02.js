// s02 — 标题 (17.6–21.8)
// 空纸。小金鱼从左边游进来，游过的地方留下「百年孤独」四个字；它在右边转身，
// 游回来停在一行小字「小金鱼」旁边。
import { clamp, lerp, prog, smooth, ease, path, ellipse, text } from '../lib.js';
import { goldFish, goldGlow } from '../props.js';

const TITLE = { str: '百年孤独', y: 452, size: 132, step: 186 };
const SUB = { str: '小金鱼', x: 960, y: 618, size: 52, spacing: 14 };
const FISH_S = 1.3;

// ---------------------------------------------------------------- the path
// Catmull-Rom spline through the fish's route, resampled by arc length.
const ROUTE = [
  [-160, 500], [-40, 488], [300, 462], [640, 440], [960, 470], [1290, 452], [1450, 478],
  [1520, 552], [1440, 618], [1290, 630], [1196, 626], [1170, 626],
];
const TABLE = (() => {
  const pts = [];
  const P = ROUTE;
  for (let i = 0; i < P.length - 1; i++) {
    const p0 = P[Math.max(0, i - 1)];
    const p1 = P[i];
    const p2 = P[i + 1];
    const p3 = P[Math.min(P.length - 1, i + 2)];
    for (let k = 0; k < 40; k++) {
      const u = k / 40;
      const u2 = u * u;
      const u3 = u2 * u;
      const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * u + (2 * a - 5 * b + 4 * c - d) * u2 + (-a + 3 * b - 3 * c + d) * u3);
      pts.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  pts.push(P[P.length - 1]);
  const acc = [0];
  for (let i = 1; i < pts.length; i++) acc.push(acc[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  return { pts, acc, len: acc[acc.length - 1] };
})();

function at(d) {
  const { pts, acc, len } = TABLE;
  d = clamp(d, 0, len);
  let lo = 0;
  let hi = acc.length - 1;
  while (hi - lo > 1) {
    const m = (lo + hi) >> 1;
    if (acc[m] < d) lo = m;
    else hi = m;
  }
  const k = acc[hi] > acc[lo] ? (d - acc[lo]) / (acc[hi] - acc[lo]) : 0;
  return [lerp(pts[lo][0], pts[hi][0], k), lerp(pts[lo][1], pts[hi][1], k)];
}

// distance travelled at scene time t: steady through the title, then easing
// into the turn and coming to rest beside 小金鱼
const T0 = 0.0;
const T1 = 1.95; // leaves the title behind
const T2 = 3.35; // at rest
const D1 = (() => {
  // distance at which the fish reaches x = 1450 (end of the straight run)
  const { pts, acc } = TABLE;
  for (let i = 0; i < pts.length; i++) if (pts[i][0] >= 1450) return acc[i];
  return TABLE.len * 0.7;
})();
function dist(t) {
  if (t <= T1) return lerp(0, D1, (t - T0) / (T1 - T0));
  const v1 = D1 / (T1 - T0); // keep the speed continuous, then decelerate to rest
  const L = TABLE.len - D1;
  const T = T2 - T1;
  const k = clamp((t - T1) / T);
  // cubic with start slope v1*T/L and zero end slope
  const m = clamp((v1 * T) / L, 0, 3);
  const h = (m - 2) * k * k * k + (3 - 2 * m) * k * k + m * k;
  return D1 + L * clamp(h, 0, 1);
}

// the fish drawn with a fake 3-D turn: flip squeezes it through edge-on
function swimmer(ctx, x, y, flip, pitch, s, o) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(Math.abs(flip) < 0.06 ? 0.06 * Math.sign(flip || 1) : flip, 1);
  ctx.rotate(pitch);
  goldFish(ctx, 0, 0, s, 0, o);
  ctx.restore();
}

// title characters: x centres and the path distance at which the fish passes each
const CHARS = [...TITLE.str].map((ch, i) => {
  const x = 960 + (i - 1.5) * TITLE.step;
  const { pts, acc } = TABLE;
  let d = 0;
  for (let k = 0; k < pts.length; k++) {
    if (pts[k][0] >= x - 30) {
      d = acc[k];
      break;
    }
  }
  return { ch, x, d };
});

export default {
  fadeIn: 0.8,
  draw(ctx, lt) {
    const t = lt;
    const d = dist(t);
    const [x, y] = at(d);
    const [xa, ya] = at(d - 6);
    const [xb, yb] = at(d + 6);
    const vx = xb - xa;
    const vy = yb - ya;
    const speed = Math.hypot(vx, vy) > 1e-3 ? 1 : 0;
    const moving = 1 - smooth(t, T2 - 0.5, T2);
    // facing: right while vx > 0, edge-on in the turn, left after it
    const dirx = Math.hypot(vx, vy) > 1e-3 ? vx / Math.hypot(vx, vy) : -1;
    const flip = t > T2 - 0.2 ? -1 : clamp(Math.tanh(dirx * 3.2) * 1.08, -1, 1);
    const pitch = clamp(Math.atan2(vy, Math.abs(vx) + 1e-6), -0.55, 0.55) * speed * moving + 0.06 * Math.sin(t * 8.5) * moving + 0.03 * Math.sin(t * 2.1) * (1 - moving);
    const bob = 3 * Math.sin(t * 2.2) * (1 - moving);

    // a faint wake behind the fish
    for (let i = 0; i < 8; i++) {
      const d0 = d - 30 - i * 26;
      const d1 = d0 - 26;
      if (d1 < 0) break;
      const a0 = at(d0);
      const a1 = at(d1);
      const ripple = Math.sin(i * 1.3 + t * 6) * 3;
      path(ctx, [[a0[0], a0[1] + ripple], [a1[0], a1[1] - ripple]], { w: 1.6, alpha: 0.16 * (1 - i / 8) * moving, seed: 6100 + i, wobble: 0.3 });
    }

    // 百年孤独 appears in its wake
    CHARS.forEach((c, i) => {
      const k = smooth(d, c.d, c.d + 260, ease.out);
      if (k <= 0) return;
      const yy = TITLE.y + (1 - k) * 10;
      ctx.save();
      ctx.translate(c.x, yy);
      const sc = 1.05 - 0.05 * k;
      ctx.scale(sc, sc);
      text(ctx, c.ch, 0, 0, { size: TITLE.size, alpha: k });
      ctx.restore();
    });
    // 小金鱼, when the fish comes to rest beside it
    const sub = smooth(t, 2.6, 3.5);
    if (sub > 0) text(ctx, SUB.str, SUB.x, SUB.y + (1 - sub) * 8, { size: SUB.size, spacing: SUB.spacing, alpha: sub * 0.9 });

    // bubbles from its mouth
    for (let b = 0; b < 4; b++) {
      const tb = 0.6 + b * 0.8;
      const k = prog(t, tb, tb + 1.4);
      if (k <= 0 || k >= 1) continue;
      const db = dist(tb);
      const [bx, by] = at(db + 30);
      const r = 3 + 3 * k + (b % 2) * 1.5;
      ellipse(ctx, bx + Math.sin(k * 5 + b) * 6, by - 14 - k * 70, r, r, { w: 1.5, alpha: 0.5 * Math.sin(k * Math.PI), seed: 6130 + b, wobble: 0.2 });
    }

    // the fish
    const glint = 0.25 + 0.75 * Math.max(0, Math.sin(t * 2.4 - 1)) ** 3;
    goldGlow(ctx, x, y + bob, 120, 0.55);
    swimmer(ctx, x, y + bob, flip, pitch, FISH_S, { seed: 6000, glint });
  },
};
