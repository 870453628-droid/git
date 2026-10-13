# 写场景的说明 / Scene authoring guide

The film is a canvas animation rendered frame by frame. Each scene is one file,
`src/scenes/sNN.js`, default-exporting `{ draw(ctx, lt, info) }`.

- `lt` — seconds since the scene's start. Scenes cross-dissolve over 0.6s
  centred on each boundary, so `draw` is also called for `lt` a little below
  0 and a little past `info.dur`. Clamp (`Math.max(0, lt)`) where needed.
- `info` — `{ t, dur, start, end }` (`t` is global film time).
- Optional `fadeIn` / `fadeOut` (seconds, 0 = hard cut) on the export.
- Scene times and the five on-screen captions live in `src/timeline.js`.
  The narration with timestamps is in `lines.json`.

## Rules

1. **Deterministic.** `draw` must be a pure function of time. No
   `Math.random()`, `Date`, or state carried between calls. Use `rng(seed)`,
   `hash(n)`, `noise1(x, seed)` from `lib.js`.
2. **Fast.** Keep a frame under ~40 ms. Cache static artwork in a module-level
   offscreen canvas if a scene is heavy.
3. **Style.** Warm grey paper, black ink lines, almost no colour.
   - `COL.gold` belongs to *her* (the tie in her ponytail) and to the bond
     between them (the string in s12). Use it sparingly and nowhere else.
   - `COL.orange` appears once: the orange soda in s15.
   - The motif is the frame (`frameBox`): everyone lives inside a frame.
   - Few words. Tell it with posture, timing, distance, empty space.
4. **Characters.** Draw with `figure()` from `figure.js`:
   - him: `{ id: 1 }` — plain stick figure.
   - her: `{ id: 2, ponytail: true }` — ponytail with a gold tie.
   - anyone else: `id` ≥ 3 (each person a different id so their lines don't
     boil in sync).
   - Typical scale `s` 0.9–1.6. Line width scales with `s` automatically.
5. **Shared files are read-only** while scenes are being written in parallel:
   `lib.js`, `figure.js`, `sets.js`, `main.js`, `timeline.js`, `index.html`.
   Put helpers inside your scene file. If a shared helper is broken or
   missing, work around it locally and report it.
6. Seeds: strokes take a seed from a per-frame counter. If your scene draws a
   varying number of strokes (particles, rain, crowds), pass `{seed}` or
   `{wobble: 0}` on those so later strokes don't flicker.

## API at a glance (read the files for details)

`lib.js`: `W, H, COL, FONT, clamp, lerp, prog, smooth, env, keys, ease,
hash, rng, noise1, path, line, rect, circle, ellipse, ellipsePts, fillPoly,
dot, hatch, trimPts, text, vtext, camera, withLayer, setStill`.

- `path(ctx, pts, {w, color, alpha, dash, close, fill, draw, sketch, seed,
  wobble, still})` — hand-drawn polyline. `draw: 0..1` draws it on.
- `keys(t, [[t0, v0], [t1, v1], ...], easeFn)` — keyframes; values can be
  numbers or objects of numbers (poses, cameras).
- `camera(ctx, {x, y, z, r}, () => { ... })` — look at (x, y) with zoom z.
- `withLayer(ctx, (l) => { ... }, {alpha, filter, mask})` — draw into an
  offscreen layer, then composite with e.g. `filter: 'blur(3px) sepia(0.7)'`.

`figure.js`: `figure(ctx, pose, o)`, `pose({...})`, `mixPose(a, b, k)`,
`joints(pose)` (hand/head positions for props), `walk(phase, ground, s)`,
`walkPhase(dist, s)`, `standY(ground, s)`, `BODY`, `LEG`, and pose presets
`SIT, SIT_LIFT, SIT_BACK, SIT_FRONT, WAVE(t), SIGH, HEAD_DOWN, LOOK_UP, THINK,
REACH, HANDS_POCKET`. Side view (`f` = facing ±1) and `view: 'front' |
'back'`. Read the header comment of `figure.js` for the angle conventions.

`sets.js`: `frameBox, sun, moon, cloud, bird, windLine, rain, paperPlane,
windowFrame, desk, chair, ridgePts, ridge, tree, tinyPerson,
platformScene(ctx, t, {boyTurn, girlTilt, mem})` (wide shot from behind),
`ledgeFront(ctx, t, {boyTurn, boyHand, girlLook, mem})` (front two-shot),
`PLATFORM`, `LEDGE`.

`s01.js` and `s05.js` are finished reference scenes.

## Checking your work

```bash
# contact sheet of a time range (thumbnails labelled with t)
node farewell/render.mjs sheet --from 6.3 --to 14.25 --step 0.5 --cols 4 --scale 0.3 --out /path/sheet.png
# full-size stills
node farewell/render.mjs stills --times 7.5,10.2 --scale 1 --outdir /path/
# whole film, strict: reports any exception
node farewell/render.mjs check --step 0.25
```

Look at the PNGs (Read tool) — judge them the way a viewer would.
Preview with sound: serve `farewell/` (e.g. `npx serve farewell`) and open
`index.html`; space plays/pauses, arrows seek.
