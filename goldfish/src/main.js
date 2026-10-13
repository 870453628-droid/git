// Frame runner: paper, scenes with cross-dissolves, subtitles.
import { W, H, COL, F, paper, beginFrame, withLayer, smooth, prog, clamp, ease, FONT } from './lib.js';
import { SCENES, CAPTIONS, SUBTITLES, DURATION, loadScenes } from './timeline.js';

const FADE = 0.6;
export const STRICT = { on: false };
const EN_FONT = '"Garamond", "EB Garamond", Georgia, serif';

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

// Text with a paper-coloured outline so it reads over line work.
function outlined(ctx, str, x, y, font, size, alpha, spacing) {
  ctx.save();
  ctx.font = `${size}px ${font}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${spacing}px`;
  ctx.lineJoin = 'round';
  ctx.globalAlpha = alpha * 0.9;
  ctx.strokeStyle = COL.paper;
  ctx.lineWidth = size * 0.2;
  ctx.strokeText(str, x, y);
  ctx.globalAlpha = alpha;
  ctx.fillStyle = COL.ink;
  ctx.fillText(str, x, y);
  ctx.restore();
}

function drawSubtitle(ctx, t) {
  const i = SUBTITLES.findIndex((s) => t >= s.t0 && t < s.t1);
  if (i < 0) return;
  const s = SUBTITLES[i];
  const prev = SUBTITLES[i - 1];
  const next = SUBTITLES[i + 1];
  // fade only at gaps; back-to-back lines switch cleanly
  const fin = prev && s.t0 - prev.t1 < 0.05 ? 1 : prog(t, s.t0, s.t0 + 0.25);
  const fout = next && next.t0 - s.t1 < 0.05 ? 1 : 1 - prog(t, s.t1 - 0.3, s.t1);
  const a = Math.min(fin, fout);
  if (a <= 0) return;
  // soft halo
  ctx.save();
  ctx.globalAlpha = a * 0.55;
  ctx.translate(W / 2, H - 88);
  ctx.scale(1, 0.16);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 620);
  g.addColorStop(0, 'rgba(232,226,214,1)');
  g.addColorStop(0.7, 'rgba(232,226,214,0.6)');
  g.addColorStop(1, 'rgba(232,226,214,0)');
  ctx.fillStyle = g;
  ctx.fillRect(-620, -620, 1240, 1240);
  ctx.restore();
  outlined(ctx, s.zh, W / 2, H - 108, FONT, 46, a * 0.95, 4);
  if (s.en) outlined(ctx, s.en, W / 2, H - 58, EN_FONT, 30, a * 0.8, 0.5);
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
  drawSubtitle(ctx, t);
}

export { DURATION, SCENES, CAPTIONS, loadScenes };
