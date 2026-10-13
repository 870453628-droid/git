// Light and darkness for 我还是想被看见. Light means attention.
//
// Draw the world first (ink on paper), then call stage(ctx, lights) to
// darken everything that is not lit. Light coordinates are in the same
// space as the world you just drew: stage() reads ctx's current transform,
// so call it inside the same camera() block.
//
// lights: array of
//   { type: 'spot', sx, sy, fx, fy, rx, ry, k }
//       a theatre spotlight: source (sx, sy) above, a pool on the floor
//       centred at (fx, fy) with radii rx, ry; k = intensity 0..1
//   { type: 'glow', x, y, r, k }      round soft light (a screen, a lamp)
//   { type: 'poly', pts, k }          any lit polygon (a doorway)
//   { type: 'pool', x, y, rx, ry, k } a flat oval of light on the floor
//                                     with no beam (a small light at the feet)
// o: { dark (0..1, default 0.66), beams (0..1 visible haze, default 1) }

import { W, H } from './lib.js';

let shade = null;

export function stage(ctx, lights, o = {}) {
  if (!shade) {
    shade = document.createElement('canvas');
    shade.width = W;
    shade.height = H;
  }
  const s = shade.getContext('2d');
  const m = ctx.getTransform();
  s.setTransform(1, 0, 0, 1, 0, 0);
  s.globalCompositeOperation = 'source-over';
  s.globalAlpha = 1;
  s.clearRect(0, 0, W, H);
  s.fillStyle = `rgba(14,13,12,${o.dark ?? 0.66})`;
  s.fillRect(0, 0, W, H);
  s.setTransform(m);
  s.globalCompositeOperation = 'destination-out';
  for (const L of lights) {
    const k = L.k ?? 1;
    if (k <= 0.001) continue;
    if (L.type === 'spot') {
      // the beam: strongest near the floor where a person stands
      const g = s.createLinearGradient(0, L.sy, 0, L.fy);
      g.addColorStop(0, `rgba(0,0,0,${0.25 * k})`);
      g.addColorStop(0.55, `rgba(0,0,0,${0.55 * k})`);
      g.addColorStop(1, `rgba(0,0,0,${0.92 * k})`);
      s.fillStyle = g;
      s.beginPath();
      s.moveTo(L.sx - L.rx * 0.12, L.sy);
      s.lineTo(L.sx + L.rx * 0.12, L.sy);
      s.lineTo(L.fx + L.rx * 0.98, L.fy);
      s.lineTo(L.fx - L.rx * 0.98, L.fy);
      s.closePath();
      s.fill();
      pool(s, L.fx, L.fy, L.rx, L.ry, k);
    } else if (L.type === 'glow') {
      const g = s.createRadialGradient(L.x, L.y, 0, L.x, L.y, L.r);
      g.addColorStop(0, `rgba(0,0,0,${k})`);
      g.addColorStop(0.5, `rgba(0,0,0,${0.7 * k})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      s.fillStyle = g;
      s.fillRect(L.x - L.r, L.y - L.r, L.r * 2, L.r * 2);
    } else if (L.type === 'pool') {
      pool(s, L.x, L.y, L.rx, L.ry, k);
    } else if (L.type === 'poly') {
      s.fillStyle = `rgba(0,0,0,${k})`;
      s.beginPath();
      s.moveTo(L.pts[0][0], L.pts[0][1]);
      for (let i = 1; i < L.pts.length; i++) s.lineTo(L.pts[i][0], L.pts[i][1]);
      s.closePath();
      s.fill();
    }
  }
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(shade, 0, 0);
  ctx.restore();

  // visible beams: a faint warm haze added on top
  const beams = o.beams ?? 1;
  if (beams > 0) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const L of lights) {
      const k = (L.k ?? 1) * beams;
      if (L.type !== 'spot' || k <= 0.001) continue;
      const g = ctx.createLinearGradient(0, L.sy, 0, L.fy);
      g.addColorStop(0, `rgba(255,250,235,${0.07 * k})`);
      g.addColorStop(1, `rgba(255,250,235,${0.02 * k})`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(L.sx - L.rx * 0.12, L.sy);
      ctx.lineTo(L.sx + L.rx * 0.12, L.sy);
      ctx.lineTo(L.fx + L.rx * 0.98, L.fy);
      ctx.lineTo(L.fx - L.rx * 0.98, L.fy);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }
}

function pool(s, x, y, rx, ry, k) {
  s.save();
  s.translate(x, y);
  s.scale(1, ry / rx);
  const g = s.createRadialGradient(0, 0, 0, 0, 0, rx);
  g.addColorStop(0, `rgba(0,0,0,${k})`);
  g.addColorStop(0.75, `rgba(0,0,0,${0.9 * k})`);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  s.fillStyle = g;
  s.beginPath();
  s.arc(0, 0, rx, 0, Math.PI * 2);
  s.fill();
  s.restore();
}

// A spotlight's lamp housing hanging at (x, y), aimed at (fx, fy).
export function lampHead(ctx, x, y, fx, fy, path, o = {}) {
  const a = Math.atan2(fy - y, fx - x) - Math.PI / 2;
  const c = Math.cos(a);
  const sn = Math.sin(a);
  const P = (px, py) => [x + px * c - py * sn, y + px * sn + py * c];
  path(ctx, [P(-16, -10), P(16, -10), P(22, 26), P(-22, 26)], { w: 3, close: true, fill: '#2a2826', seed: o.seed ?? 7000, alpha: o.alpha });
  path(ctx, [P(0, -10), P(0, -40)], { w: 3, seed: (o.seed ?? 7000) + 1, alpha: o.alpha });
}
