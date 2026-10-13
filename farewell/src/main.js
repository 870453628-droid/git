// Frame runner: paper, scenes with cross-dissolves, captions.
import { W, H, COL, F, paper, beginFrame, withLayer, smooth, prog, clamp, ease, text, vtext } from './lib.js';
import { SCENES, CAPTIONS, DURATION, loadScenes } from './timeline.js';

const FADE = 0.6;
export const STRICT = { on: false };

function sceneAlpha(i, t) {
  const s = SCENES[i];
  const fi = i === 0 ? 0 : s.mod.fadeIn ?? SCENES[i - 1].mod.fadeOut ?? FADE;
  const fo = i === SCENES.length - 1 ? 0 : s.mod.fadeOut ?? SCENES[i + 1].mod.fadeIn ?? FADE;
  let a = 1;
  if (fi > 0) a = Math.min(a, smooth(t, s.start - fi / 2, s.start + fi / 2, ease.sine));
  else if (t < s.start) a = 0;
  if (fo > 0) a = Math.min(a, 1 - smooth(t, s.end - fo / 2, s.end + fo / 2, ease.sine));
  else if (t >= s.end) a = 0;
  return a;
}

function drawCaption(ctx, c, t) {
  const fi = c.fadeIn ?? 0.6;
  const fo = c.fadeOut ?? 0.7;
  if (t < c.t0 || t > c.t1) return;
  const a = Math.min(smooth(t, c.t0, c.t0 + fi), 1 - smooth(t, c.t1 - fo, c.t1));
  if (a <= 0) return;
  if (c.pos === 'vertical') {
    const reveal = prog(t, c.t0, c.t0 + 2.4);
    vtext(ctx, c.lines, c.x ?? 1700, c.y ?? 250, { size: c.size ?? 62, alpha: a * 0.9, reveal, gap: 92 });
    return;
  }
  const x = c.pos?.x ?? W / 2;
  const y = (c.pos?.y ?? H - 112) - 8 * (1 - ease.out(prog(t, c.t0, c.t0 + 1.2)));
  // a soft paper halo so the words stay legible over line work
  ctx.save();
  ctx.globalAlpha = a * 0.8;
  ctx.translate(x, y);
  ctx.scale(1, 0.2);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 380);
  g.addColorStop(0, 'rgba(232,226,214,1)');
  g.addColorStop(0.6, 'rgba(232,226,214,0.7)');
  g.addColorStop(1, 'rgba(232,226,214,0)');
  ctx.fillStyle = g;
  ctx.fillRect(-380, -380, 760, 760);
  ctx.restore();
  text(ctx, c.text, x, y, { size: c.size ?? 54, alpha: a * 0.92, spacing: 10 });
}

export function renderAt(ctx, t) {
  t = clamp(t, 0, DURATION);
  beginFrame(t);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.filter = 'none';
  paper(ctx);
  for (let i = 0; i < SCENES.length; i++) {
    const s = SCENES[i];
    if (t < s.start - 1.5 || t > s.end + 1.5) continue;
    const a = sceneAlpha(i, t);
    if (a <= 0.001) continue;
    const info = { t, dur: s.end - s.start, start: s.start, end: s.end };
    F.stroke = 0;
    F.still = false;
    withLayer(ctx, (l) => {
      try {
        s.mod.draw(l, t - s.start, info);
      } catch (e) {
        // strict mode (final renders) fails loudly; previews show the error in place
        if (STRICT.on) throw e;
        l.setTransform(1, 0, 0, 1, 0, 0);
        l.globalAlpha = 1;
        l.filter = 'none';
        l.fillStyle = '#a3261b';
        l.font = '28px monospace';
        l.fillText(`${s.id} error: ${e.message}`.slice(0, 110), 60, 80 + i * 4);
      }
    }, { alpha: a });
  }
  F.stroke = 0;
  for (const c of CAPTIONS) drawCaption(ctx, c, t);
}

export { DURATION, SCENES, loadScenes };
