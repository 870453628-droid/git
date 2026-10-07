// 我还是想被看见 — scene timing follows the script (../分镜.md) and the
// subtitle lines (../lines.json). No sound: music and narration are added later.
// Each scene module (scenes/<id>.js) default-exports
// { draw(ctx, lt, info), fadeIn?, fadeOut? }  (see GUIDE.md)

export const DURATION = 88.0;

export const SCENES = [
  { id: 's01', start: 0.0, end: 9.0 }, // the child in the spotlight
  { id: 's02', start: 9.0, end: 19.0 }, // he grows; the light moves; he chases
  { id: 's03', start: 19.0, end: 31.0 }, // chasing a number at the computer
  { id: 's04', start: 31.0, end: 43.0 }, // shuts the screen; walks alone, stiffly
  { id: 's05', start: 43.0, end: 52.0 }, // side tracking: his steps settle
  { id: 's06', start: 52.0, end: 64.0 }, // cheers, a companion, a small light — he panics
  { id: 's07', start: 64.0, end: 77.0 }, // he accepts it; goodbye; walks on alone
  { id: 's08', start: 77.0, end: DURATION }, // at the computer, making this video
];

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

export const SUBTITLES = [];
export const CAPTIONS = [];
