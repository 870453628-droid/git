# 看缘分吧 · 火柴人第三集

A stick-figure retelling of a voiced essay about two high-school deskmates who
drifted apart. The soundtrack is the original narration and music; the images
are hand-drawn-style canvas animation, rendered frame by frame to MP4.

## 预览 Preview

```bash
npx serve farewell        # then open the printed URL
```

Space plays/pauses (with sound), ←/→ seek one second, the slider scrubs.
`index.html?t=30` opens on a given second.

## 渲染 Render

Needs Node, ffmpeg and Playwright's Chromium.

```bash
node farewell/render.mjs video                      # → farewell/out/farewell.mp4 (1920×1080, 30 fps)
node farewell/render.mjs video --from 27 --to 41    # a section
node farewell/render.mjs sheet --from 0 --to 6 --step 0.5 --out sheet.png
node farewell/render.mjs check                      # render every 0.25 s, report errors
```

## 结构 Layout

- `lines.json` — the narration with timestamps (read from the source video's subtitles).
- `src/timeline.js` — scene times and the only five captions.
- `src/lib.js` — ink-on-paper primitives (boiling lines, frames, camera, layers).
- `src/figure.js` — the stick-figure rig and poses. Her ponytail carries the one gold accent.
- `src/sets.js` — shared props and set pieces (the high platform, the ledge two-shot).
- `src/scenes/sNN.js` — one file per scene. See `GUIDE.md` for how to write one.
- `assets/audio.m4a` — the source audio, trimmed before the platform's end-card sound.
- `assets/wenkai.ttf` — LXGW WenKai (SIL OFL), subset to the characters used.
