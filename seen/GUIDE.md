# 我还是想被看见 · scene authoring guide (second version)

The film is a canvas animation rendered frame by frame (1920×1080, 30 fps,
124 s, silent — the author adds music and narration later). Each scene is one
file `src/scenes/sNN.js` default-exporting `{ draw(ctx, lt, info), fadeIn?, fadeOut? }`.

- `lt` = seconds since the scene's start (slightly negative / past `info.dur`
  during the 0.6 s cross-dissolves — clamp where needed). `info = {t, dur, start, end}`.
- Scene times: `src/timeline.js`. Storyboard (READ IT — it is the brief):
  `分镜.md`. Times there are absolute film times; `lt = t - start`.
- Subtitles (`lines.json`) are drawn globally: light text with a dark
  outline, centred at y ≈ 988. While a line is showing keep the bottom
  ~170 px free of important drawing (dark areas or silhouettes there are fine).
- Dissolves: main.js draws every scene opaque (paper + scene) and fades the
  incoming one over the outgoing one, so dark-to-dark dissolves don't flash.
  A scene with `fadeIn: 0` / `fadeOut: 0` makes a hard cut (use it for match
  cuts on identical frames).

## What the author asked for
A theatre piece, not a cartoon: dramatic staging and camera work that moves
people — slow reveals, whip pans, the camera rising, pushing in, spinning
with him. Few words; the feeling comes from his actions and the light.
The people who watch him are **ordinary people**: dark silhouettes
(theatre.js `person()`), quiet, never clapping, no dot eyes, no cartoon crowds
(do NOT use props.onlooker/crowd — they look silly). People who pass him in
the street (s04) are figures too, but plain and calm (stick figures without
faces are fine there, or silhouettes) — never clowning.

## Look
1. Black and white only: ink on warm grey paper, darkened by `stage()`.
   No colour. Light is less shade, plus a faint warm haze in spotlight beams.
2. Lighting (`src/light.js`): draw the world first, then call
   `stage(ctx, lights, { dark })`. Lights are in the coordinates of the
   current transform (or call it at identity with screen-space lights, as
   s01 does). Types: `spot`, `glow`, `pool`, `poly`.
3. The BANG of a spotlight (s01, s02, s06, s07): the light goes from 0 to full
   in one frame, the frame jolts for ~0.2 s, a quick additive flash
   (see s01: `jolt`, the flash block). Reuse it — it is the film's motif.
4. Light never comes out of HIM. When he turns inward (s05) the dark around
   him lifts a little — the world gets lighter — he does not glow.
5. Rhythm: s01 is slow and grand; s02 fast and dizzy; s03 quick; s04 a
   rushing flow; s05–s06 calm with one sudden light; s07 slow, wide, still.

## Characters (`figure()` in `src/figure.js`)
- HIM: always `{ id: 1, cowlick: true }`. `mouth: -1..1` (+ smile, − frown),
  `eye: 'closed'`. In side view `turn: 0..1` brings his face round toward
  the camera. Child s = 0.6 (s01, `TH.boyS`), teenager ≈ 0.8, adult ≈ 1.0
  (relative to the stage plane; the camera does the rest).
- Watchers / audience: theatre.js `person()` (seated, from behind) or your
  own silhouette in the same style (dark fill `#151311`, no face, a thin
  rim of light where the light hits).

## Rules
1. Deterministic: no `Math.random()`/`Date`; use `rng`, `hash`, `noise1`.
2. Under ~40 ms a frame (`render.mjs check` prints the average). `stage()`
   costs one full-screen composite; call it once per frame per scene. The
   auditorium can be heavy — skip rows/people that are off screen.
3. Shared files are READ-ONLY while scenes are written in parallel: lib.js,
   figure.js, sets.js, props.js, light.js, room.js, road.js, theatre.js,
   main.js, timeline.js, index.html, render.mjs, lines.json and s01.js. Put
   helpers in your own scene file; report anything shared that is broken or
   missing.
4. Strokes take seeds from a per-frame counter — pass `{seed}` (or
   `{wobble:0}`) on varying numbers of strokes so later strokes don't flicker.
5. Text inside the picture may only use characters in the font subset: the
   subtitle characters, 我还是想被看见, `0123456789+-.,:/万▲▼`, 播放点赞关注发布.

## API
`lib.js`: W, H, COL, clamp, lerp, prog, smooth, env, keys, ease, hash, rng,
noise1, path, line, rect, circle, ellipse, ellipsePts, fillPoly, dot, hatch,
trimPts, text, vtext, camera, withLayer, setStill.

`figure.js`: figure (returns joints), pose, mixPose, joints, walk, walkPhase,
standY, `reach(p, 'A'|'B', x, y, 'arm'|'leg')` (side-view IK), presets SIT,
SIT_LIFT, SIT_BACK, SIT_FRONT, WAVE, SIGH, HEAD_DOWN, LOOK_UP, THINK, REACH,
HANDS_POCKET. Read the header comment for angle conventions. Limbs are drawn
before the (paper-filled) head: an arm in front of the face must be drawn
again after figure() (see s01's shielding forearm).

`theatre.js` — the theatre, shared by s01, s02, s07:
- `TH` {cx, floor (stage floor front edge = his feet), back, pr (proscenium),
  apron, boyS}; `F`.
- Camera `{x, y, C}`: C = distance from the stage plane. `stageCam(cam)` →
  lib.camera() object for drawing in the stage plane; `project(cam, X, Y, Z)`
  → [sx, sy, scale, depth] (Z < 0 is the auditorium, toward the camera).
- `hallDark(ctx)` (fill the frame with the hall's dark first),
  `stagePlane(ctx, t, {backOpen, beyond(ctx, k), floorMark, curtains})`,
  `haze(ctx, cam, k)` (stage glow in the air, behind the audience),
  `auditorium(ctx, cam, t, {occupied(seat,row) → 0..1, lean(seat,row), rim,
  seatBacks})` → rim list, `rims(ctx, list, k)` (after stage()),
  `sconces(cam, k)` → lights, `dust(ctx, beam, t, k)` (specks in a beam,
  after stage()), `person(ctx, x, y, s, {h, tilt, alpha})`, `ROWS`.

`scenes/s01.js` exports: `SPOT` (the spotlight in stage-plane coordinates),
`spotOnScreen(cam, L, k)` → a screen-space 'spot' light, `stageWash(cam, k)`.
Read s01 to see how a theatre frame is put together (hallDark → stage plane
under camera(stageCam) → haze → auditorium → stage() at identity → rims →
dust → flash).

`room.js` — his room: `ROOM`, `room(ctx, t, {open, door, moon, balls,
glow})` → {top, seat, lp, doorLight, screenLight}, `PILE`, `sitter(ctx, t,
seat, top, {lean, head, look, mouth, type, handDX, hands:false, p})`.

`props.js`: table, stool, laptop, screenFront, counter, formatCount,
paperBall, standLamp, ground (onlooker/crowd exist but must not be used).

`road.js`: `ROAD`, `road(ctx, x0, x1)`; `sets.js`: moon, cloud, bird, tree…

The first cut of this film (a different story) is in git history at commit
a610d93 — e.g. `git show a610d93:seen/src/scenes/s04.js` has the POV shot
of his hand shutting the laptop lid (povShot/povHand/screenContent) and the
room-to-door walk; `git show a610d93:seen/src/scenes/s03.js` the screen
close-ups and the paper-ball throws; `git show a610d93:seen/src/scenes/s08.js`
the night room. Copy what helps into your own file.

The first film's walk through the seasons and the crowd
(`farewell/src/scenes/s11.js`, `s04.js` time-lapse) is the reference for
s04's time tunnel.

## Checking your work
```bash
node seen/render.mjs sheet --from 16 --to 40 --step 0.4 --cols 8 --scale 0.2 --out /path/sheet.png
node seen/render.mjs stills --times 20.5,28 --scale 0.5 --outdir /path/
node seen/render.mjs check --step 0.25
```
Look at the PNGs with the Read tool and judge them like a viewer: is the
action readable, is he readable in the dark, does the camera move people,
does each subtitle's picture say what the line means without illustrating
it word for word.
