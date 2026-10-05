// Scene timing follows the narration (see ../lines.json).
// Each scene module (scenes/<id>.js) default-exports
// { draw(ctx, lt, info), fadeIn?, fadeOut? }.
//   lt   = seconds since the scene's start (can be slightly negative or past
//          dur during the cross-dissolve, so clamp if needed)
//   info = { t, dur, start, end }
// fadeIn / fadeOut: dissolve length in seconds centred on the boundary
// (default 0.6; 0 = hard cut).

export const DURATION = 136.5; // audio ends at 135.45 (fade-out from 133.7)

export const SCENES = [
  { id: 's01', start: 0.0, end: 6.3 },
  { id: 's02', start: 6.3, end: 14.25 },
  { id: 's03', start: 14.25, end: 23.65 },
  { id: 's04', start: 23.65, end: 27.4 },
  { id: 's05', start: 27.4, end: 40.9 },
  { id: 's06', start: 40.9, end: 45.5 },
  { id: 's07', start: 45.5, end: 51.75 },
  { id: 's08', start: 51.75, end: 66.0 },
  { id: 's09', start: 66.0, end: 82.4 },
  { id: 's10', start: 82.4, end: 87.4 },
  { id: 's11', start: 87.4, end: 92.65 },
  { id: 's12', start: 92.65, end: 109.4 },
  { id: 's13', start: 109.4, end: 117.55 },
  { id: 's14', start: 117.55, end: 123.1 },
  { id: 's15', start: 123.1, end: DURATION },
];

// Scene modules load independently, so one broken file only blanks its own
// scene (it draws the error instead) while the rest of the film still renders.
export async function loadScenes() {
  const failed = [];
  await Promise.all(
    SCENES.map(async (s) => {
      try {
        s.mod = (await import(`./scenes/${s.id}.js`)).default;
      } catch (e) {
        failed.push(`${s.id}: ${e.message}`);
        s.mod = { error: e, draw: () => { throw e; } };
      }
    }),
  );
  return failed;
}

// The only words on screen. Everything else is told by the figures.
// pos: 'bottom' (default) | 'vertical' (classical poem, right side) | {x, y}
export const CAPTIONS = [
  { t0: 0.35, t1: 3.7, text: '看缘分吧' },
  { t0: 43.2, t1: 45.6, text: '还有明天，但我错了' },
  { t0: 56.7, t1: 59.4, text: '只记得风很轻，太阳很暖' },
  { t0: 82.5, t1: 87.6, lines: ['当时轻别意中人，', '山长水远知何处。'], pos: 'vertical' },
  { t0: 130.5, t1: 134.6, text: '恍如隔世' },
];
