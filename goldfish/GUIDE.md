# 小金鱼 · scene authoring guide

The film is a canvas animation rendered frame by frame (1920×1080, 30 fps), set
to the user's music clip (68.4 s). Each scene is one file `src/scenes/sNN.js`
default-exporting `{ draw(ctx, lt, info), fadeIn?, fadeOut? }`.

- `lt` = seconds since the scene's start (slightly negative / past `info.dur`
  during the 0.6 s cross-dissolves — clamp where needed). `info = {t, dur, start, end}`.
- Scene times: `src/timeline.js`. Storyboard (READ IT): `分镜.md`.
- Subtitles (`lines.json`) are drawn globally at the bottom (Chinese at y≈972,
  English at y≈1022). While a line is showing keep the bottom ~180 px free
  of important drawing. Lines: 0.8–5.9, 6.4–10.7, 10.9–13.9, 16.7–18.1,
  21.8–22.7, 22.7–26.6, 44.7–46.8, 46.9–51.0, 51.8–54.7, 56.7–58.7,
  59.8–62.7, 63.7–66.8. 27.0–44.7 has no words: that is the love story.

## The story in one line
Everyone says the colonel never loved anyone. The little gold fish knows
otherwise: it was in his hands when she first appeared in the workshop door,
and it outlives them both.

## Continuity of THE fish (one object, the whole film)
- s01 at the wall: in his fist, the chain hanging out between his fingers.
- s04 (done): he lifts it on its chain — "进来"; she runs off.
- s05: it lies on the bench while he writes her everywhere.
- s06 wedding: he hangs it on her neck (a gold glint on her chest).
- s07: she wears it bringing the coffee; after her death it lies on the bench under her photo.
- s08 war: in his chest pocket (a gold glint); it is what remains when the circle shrinks to his chest.
- s09 old age: hangs on a nail above the bench — never melted, while he makes and melts the others.
- s10: he walks out to the circus and the chestnut tree; the fish stays on its nail.
- s11: the fish on the nail lights up and swims out; memories open around it.
- s12: everything fades; the fish's gold is the last thing on the paper.

## Rules
1. Deterministic: no `Math.random()`/`Date`; use `rng`, `hash`, `noise1` from `lib.js`.
2. Under ~40 ms a frame (`render.mjs check` prints the average).
3. Style: warm grey paper, black ink lines, the frame ("框") motif. The ONLY
   colour is gold: the fish (`props.goldFish`, `GOLD`) and the wedding ring.
   Ice may glow white. Nothing else coloured.
4. Characters (`figure()` in `src/figure.js`):
   - him: `{ id: 1, mustache: true }` (young). At the wall and the wedding add
     `boots: 'black'` (the same patent-leather boots). Old (s09–s10):
     `{ id: 1, mustache: 'droop' }` with a stoop (`lean` ≈ 0.2–0.3, `head` ≈ 0.15), slower moves.
     Scale ≈ 1.25 in medium shots.
   - her (蕾梅黛丝): `{ id: 2, bow: true, skirt: true, boots: true }`, scale
     ≈ 0.78 (a nine-year-old) — ≈ 0.85 at the wedding.
   - anyone else: id ≥ 3; father under the chestnut tree, Úrsula, Amaranta
     (one hand drawn as a solid black blob), Rebeca, Melquíades (big black hat).
5. Shared files are READ-ONLY while scenes are written in parallel: lib.js,
   figure.js, sets.js, props.js, main.js, timeline.js, index.html, render.mjs,
   and s04.js. Put helpers in your own scene files; report anything shared
   that is broken or missing.
6. Strokes take seeds from a per-frame counter — pass `{seed}` (or `{wobble:0}`)
   on varying numbers of strokes so later strokes don't flicker.

## API
`lib.js`: W, H, COL, clamp, lerp, prog, smooth, env, keys, ease, hash, rng,
noise1, path, line, rect, circle, ellipse, ellipsePts, fillPoly, dot, hatch,
trimPts, text, vtext, camera, withLayer (layer starts at identity transform —
copy the camera with `l.setTransform(ctx.getTransform())` if needed), setStill.

`figure.js`: figure, pose, mixPose, joints, walk, walkPhase, standY, `reach(p,
'A'|'B', x, y, 'arm'|'leg')` → {a1, a2} (side-view IK: put a hand exactly on a
prop), presets SIT, SIT_BACK, SIT_FRONT, WAVE, SIGH, HEAD_DOWN, LOOK_UP, THINK,
REACH, HANDS_POCKET. Read the header comment for angle conventions.

`props.js`: goldFish(ctx,x,y,s,ang,{glint,dull,alpha}), sparkle, goldGlow,
chain, hangingFish(ctx, handX, handY, len, swing, s) (returns fish centre),
ring, workbench, lamp, hammer, tinCan(…, n), crucible(…, melt), coffeeCup,
doll, mourningPhoto, chestnutTree, rifles, iceBlock, notes.

`sets.js`: frameBox, sun, moon, cloud, bird, windLine, rain, tree, tinyPerson…

`scenes/s04.js` exports the workshop set so the workshop looks the same in every
scene: `ROOM, BENCH, HIM, HER, ANVIL(), workshop(ctx, t, {alpha, doorLight,
lampGlow, melquiades})` (room frame, door with light, shelf, tools, Melquíades)
and `bench(ctx)` (workbench + lamp; draw before the figures).

## Checking your work
```bash
node goldfish/render.mjs sheet --from 33 --to 36 --step 0.25 --cols 4 --scale 0.3 --out /path/sheet.png
node goldfish/render.mjs stills --times 34.2,35.5 --scale 1 --outdir /path/
node goldfish/render.mjs check --step 0.25
```
Look at the PNGs with the Read tool and judge them like a viewer.
