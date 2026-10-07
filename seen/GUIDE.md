# 我还是想被看见 · scene authoring guide

The film is a canvas animation rendered frame by frame (1920×1080, 30 fps,
88 s, silent — the author adds music and narration later). Each scene is one
file `src/scenes/sNN.js` default-exporting `{ draw(ctx, lt, info), fadeIn?, fadeOut? }`.

- `lt` = seconds since the scene's start (slightly negative / past `info.dur`
  during the 0.6 s cross-dissolves — clamp where needed). `info = {t, dur, start, end}`.
- Scene times: `src/timeline.js`. Storyboard (READ IT): `分镜.md`. Times in
  分镜.md are absolute film times; `lt = t - start`.
- Subtitles (`lines.json`) are drawn globally: light text with a dark outline,
  centred at y ≈ 988. While a line is showing keep the bottom ~170 px free of
  important drawing (a floor line or a dark area there is fine).

## The story in one line
A boy who grew up in the spotlight chases it, then chases a number, then
pretends he doesn't care; walking alone his steps settle, and he admits he
still wants to be seen — and that this time he wants to finish telling his
story first. The light is attention: whoever is looked at is lit.

## Look
1. Black and white only: ink on warm grey paper, darkened by `stage()`.
   No colour (no gold, no orange). Light is just less shade, plus a faint
   warm beam haze for spotlights.
2. Lighting (`src/light.js`): draw the world first, then call
   `stage(ctx, lights, { dark })` inside the same `camera()` block. Lights:
   `spot` (a theatre beam with a pool on the floor), `glow` (round, soft),
   `pool` (a flat oval on the floor, no beam), `poly` (a lit doorway).
   Darkness arc — the world gets lighter as he stops needing spotlights:
   s01–s02 0.85 · s03 0.8 · s04 0.92 room → 0.6 road · s05 0.55→0.48 ·
   s06 0.45 · s07 0.45→0.32 · s08 0.8, fading to black at the end.
   Things that must read in the dark (him) should be inside a light, or
   the dark must be light enough (≤ 0.7) for the ink to show.
3. Rhythm: s01–s03 fast, cuts allowed (hard cuts inside a scene are fine:
   just switch what you draw at a time). s04 onward: long takes, slow
   camera, nothing sudden except the moment in s06 when he falters.
4. Direction: from s04 to s07 he always walks to the RIGHT (f = 1).

## Characters (`figure()` in `src/figure.js`)
- HIM: always `{ id: 1, cowlick: true }` (the tuft makes him readable at any
  size). Add `mouth: -1..1` for expressions (+ smile, − frown). In side view
  `turn: 0..1` brings his face round toward the camera without turning the
  body (s04 half-turn).
  Child s ≈ 0.6 (s01); grows 0.75 → 0.9 → 1.05 in s02; adult s ≈ 0.85–1.2
  depending on the shot.
- The companion (s06–s07): `{ id: 2, ponytail: true, noTie: true }`, s a
  little smaller than his.
- Onlookers / crowds: `props.onlooker()` / `props.crowd()` (front view,
  modes clap / cheer / thumb / idle), ids ≥ 60. Use `crowd(..., { back: true })`
  for people seen from behind.

## Rules
1. Deterministic: no `Math.random()`/`Date`; use `rng`, `hash`, `noise1` from `lib.js`.
2. Under ~40 ms a frame (`render.mjs check` prints the average). `stage()`
   costs one full-screen composite; call it once per frame per scene.
3. Shared files are READ-ONLY while scenes are written in parallel: lib.js,
   figure.js, sets.js, props.js, light.js, room.js, road.js, main.js,
   timeline.js, index.html, render.mjs, lines.json and s01.js. Put helpers in your own scene file;
   report anything shared that is broken or missing.
4. Strokes take seeds from a per-frame counter — pass `{seed}` (or
   `{wobble:0}`) on varying numbers of strokes so later strokes don't flicker.
5. Text inside the picture (the counter, timecode) may only use characters
   in the font subset: `0123456789+-.,:/万▲▼` and the subtitle characters
   plus 播放点赞关注. Anything else renders in a fallback font.

## API
`lib.js`: W, H, COL, clamp, lerp, prog, smooth, env, keys, ease, hash, rng,
noise1, path, line, rect, circle, ellipse, ellipsePts, fillPoly, dot, hatch,
trimPts, text, vtext, camera, withLayer (the layer starts at identity
transform — copy the camera with `l.setTransform(ctx.getTransform())` if
needed), setStill.

`figure.js`: figure, pose, mixPose, joints, walk, walkPhase, standY,
`reach(p, 'A'|'B', x, y, 'arm'|'leg')` → {a1, a2} (side-view IK: put a hand
exactly on a prop), presets SIT, SIT_LIFT, SIT_BACK (+ `{legs:false, seat:true,
arms:'upper'}`), SIT_FRONT, WAVE, SIGH, HEAD_DOWN, LOOK_UP, THINK, REACH,
HANDS_POCKET. Read the header comment for angle conventions.

`light.js`: `stage(ctx, lights, {dark, beams})`, `lampHead(ctx, x, y, fx, fy, path)`.

`props.js`: `table(ctx, x, floor, s)` → top y; `stool(ctx, x, floor, s)` →
seat y; `laptop(ctx, hingeX, top, s, f, open, {glow})` → {hinge, lidEnd,
screen}; `screenFront(ctx, x, y, w, h, {content(ctx,x,y,w,h), stand})`;
`counter(ctx, x, y, n, {size, delta})`, `formatCount(n)`;
`paperBall(ctx, x, y, r, seed)`; `onlooker(ctx, x, ground, s, t, {mode, k,
ph, turn, head, back, mouth})`; `crowd(ctx, x0, x1, ground, n, t, {seed,
mode, k, kFn(i,u), sMin, sMax, back})`; `thumbUp(ctx, x, y, s)`;
`standLamp(ctx, x, ground, h, aimX, aimY)` → beam source [x, y];
`ground(ctx, x0, x1, y)`.

`room.js` — his room, the same in s03, s04 and s08: `ROOM` (layout
constants), `room(ctx, t, {open, door, moon, balls, glow})` → {top, seat, lp,
doorLight (poly pts or null), screenLight (a ready 'glow' light)}, `PILE`
(paper-ball heap positions; `balls` = how many are drawn), `sitter(ctx, t,
seat, top, {lean, head, look, mouth, type (typing 0..1), handDX, hands:false,
p: pose overrides})` → joints (him on the stool, hands on the keyboard).

`road.js` — the road, the same in s04–s07: `ROAD` {near (his feet), far
(lamps and crowds on the far side), horizon, farS}, `road(ctx, x0, x1)`
draws world x0..x1 (scroll with the camera; pass the visible range).

`scenes/s01.js` exports the stage (s02 continues it): `STAGE`, `AUDIENCE`,
`audience(ctx, t, {clap(p), turn(p), alpha(p), mode(p)})`, `stageLights(k,
{fx, sx, rx, spill})`. s01 ends on camera `STAGE.cam` and has `fadeOut: 0`.

`sets.js` (from the earlier films): frameBox, moon, cloud, bird, windLine,
tree, tinyPerson, ridgePts/ridge…

## Checking your work
```bash
node seen/render.mjs sheet --from 19 --to 31 --step 0.5 --cols 6 --scale 0.25 --out /path/sheet.png
node seen/render.mjs stills --times 20.5,28 --scale 1 --outdir /path/
node seen/render.mjs check --step 0.25
```
Look at the PNGs with the Read tool and judge them like a viewer: is the
action readable, is he readable in the dark, does each subtitle's picture say
what the line says without repeating it.
