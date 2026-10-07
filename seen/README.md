# 我还是想被看见 · 火柴人

黑白火柴人短片，1 分 28 秒，1920×1080，30 fps。**无声**：音乐和旁白由作者自己后配；字幕已经烧进画面，另附 `subtitles.srt`，需要时可以当软字幕用。

- 剧本／分镜：`分镜.md`
- 字幕：`lines.json`（时间轴的唯一来源），`subtitles.srt` 由它生成
- 画面：`src/`（引擎沿用前两部片子）和 `src/scenes/s01–s08.js`（八场戏）

## 预览与渲染
```bash
# 浏览器预览：在仓库根目录起一个静态服务器，打开 seen/index.html
npx http-server . -p 8080   # → http://localhost:8080/seen/

node seen/render.mjs check --step 0.25           # 逐帧检查，报告脚本错误
node seen/render.mjs video --workers 3           # → seen/out/seen.mp4（无音轨）
```

## 后期配音
旁白按 `lines.json` 的时间说就能对上画面：每句字幕的开始时间就是这句话开口的时间。下面几处特意留了空白：
- 22.6–27.2：快速重复的段落，适合放点击声和数字跳动声
- 43–47.8：只有脚步声
- 62.6–64：“我怎么还是这么在意？”之后停 1 秒
- 85.6–88：鼠标声，然后淡出，不加掌声
