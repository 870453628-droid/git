// 我还是想被看见 (second version) — scene timing follows the script (../分镜.md) and the
// subtitle lines (../lines.json). No sound: music and narration are added later.
// Each scene module (scenes/<id>.js) default-exports
// { draw(ctx, lt, info), fadeIn?, fadeOut? }  (see GUIDE.md)

export const DURATION = 124.0;

export const SCENES = [
  { id: 's01', start: 0.0, end: 16.0 }, // the theatre: bang, the boy in the spotlight, the audience; title
  { id: 's02', start: 16.0, end: 40.0 }, // he grows, his light shrinks; brighter lights; he chases, gets lost
  { id: 's03', start: 40.0, end: 54.0 }, // the screen's light; post after post; it fades; he shuts the lid
  { id: 's04', start: 54.0, end: 72.0 }, // the time tunnel: people with brighter lights stream past him
  { id: 's05', start: 72.0, end: 92.0 }, // he stops chasing; his own work; a brighter light passes, he goes on
  { id: 's06', start: 92.0, end: 108.0 }, // a light lands on him; joy, doubt; it comes and goes, he keeps working
  { id: 's07', start: 108.0, end: DURATION }, // back on the empty stage; daylight; the spotlight behind him; he walks on
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
