// 小金鱼 — scene timing follows the music and its narration lines (../lines.json).
// Each scene module (scenes/<id>.js) default-exports
// { draw(ctx, lt, info), fadeIn?, fadeOut? }.
//   lt   = seconds since the scene's start (can be slightly negative or past
//          dur during the cross-dissolve, so clamp if needed)
//   info = { t, dur, start, end }
// fadeIn / fadeOut: dissolve length in seconds centred on the boundary
// (default 0.6; 0 = hard cut).

export const DURATION = 69.0; // audio ends at 68.4 (fade-out from 66.9)

export const SCENES = [
  { id: 's01', start: 0.0, end: 17.6 }, // the wall; the fish in his fist
  { id: 's02', start: 17.6, end: 21.8 }, // title
  { id: 's03', start: 21.8, end: 27.0 }, // everyone alone in their frame
  { id: 's04', start: 27.0, end: 33.0 }, // the workshop: first meeting
  { id: 's05', start: 33.0, end: 36.0 }, // she is everywhere
  { id: 's06', start: 36.0, end: 39.6 }, // the wedding
  { id: 's07', start: 39.6, end: 44.7 }, // coffee every morning; the empty door
  { id: 's08', start: 44.7, end: 51.8 }, // war; the shrinking circle
  { id: 's09', start: 51.8, end: 56.6 }, // old age: make, melt, again
  { id: 's10', start: 56.6, end: 59.8 }, // the circus; the chestnut tree
  { id: 's11', start: 59.8, end: 63.6 }, // memories swim out of the fish
  { id: 's12', start: 63.6, end: DURATION }, // oblivion
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
  try {
    const res = await fetch(new URL('../lines.json', import.meta.url));
    SUBTITLES.push(...(await res.json()));
  } catch (e) {
    failed.push(`subtitles: ${e.message}`);
  }
  return failed;
}

// Narration subtitles from the music video, drawn at the bottom (main.js).
export const SUBTITLES = [];

// Scene captions other than subtitles (titles are drawn by their scenes).
export const CAPTIONS = [];
