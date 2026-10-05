#!/usr/bin/env node
// Deterministic frame-by-frame renderer for index.html (headless Chromium + ffmpeg).
//
//   node farewell/render.mjs video  [--from 0] [--to END] [--fps 30] [--workers 3] [--out farewell/out/farewell.mp4]
//   node farewell/render.mjs sheet  --from 27.4 --to 40.9 [--step 1] [--cols 4] [--scale 0.25] --out sheet.png
//   node farewell/render.mjs stills --times 1,2.5,30 [--scale 0.5] [--outdir dir]
//   node farewell/render.mjs check  [--step 0.25]      (renders without saving, reports JS errors)
//
// Paths in --out/--outdir are relative to the current directory.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn, execSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const mode = argv[0] ?? 'video';
const arg = (name, def) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : def;
};

async function loadPlaywright() {
  try {
    return await import('playwright');
  } catch {
    const require = createRequire(import.meta.url);
    const globalRoot = execSync('npm root -g').toString().trim();
    return require(path.join(globalRoot, 'playwright'));
  }
}

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.ttf': 'font/ttf', '.woff2': 'font/woff2', '.m4a': 'audio/mp4', '.png': 'image/png', '.jpg': 'image/jpeg' };

function serve() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const url = decodeURIComponent(req.url.split('?')[0]);
      const file = path.join(ROOT, url === '/' ? 'index.html' : url);
      if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        res.writeHead(404);
        res.end('not found');
        return;
      }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' });
      fs.createReadStream(file).pipe(res);
    });
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

async function openPage(browser, port, strict = mode === 'video' || mode === 'check') {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.stack || String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('console', (m) => {
    if (m.type() === 'warning') console.warn(`[page] ${m.text()}`);
  });
  await page.goto(`http://127.0.0.1:${port}/index.html?render=1${strict ? '&strict=1' : ''}`);
  await page.waitForFunction(() => window.ready !== undefined);
  await page.evaluate(() => window.ready);
  if (errors.length) throw new Error(errors.join('\n'));
  return { page, errors };
}

const decode = (dataUrl) => Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64');

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ['ignore', 'inherit', 'inherit'] });
    p.on('exit', (c) => (c === 0 ? resolve() : reject(new Error(`${cmd} exited ${c}`))));
  });
}

async function renderChunk(browser, port, frames, fps, file, label) {
  const { page, errors } = await openPage(browser, port);
  const ff = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'image2pipe', '-c:v', 'mjpeg', '-framerate', String(fps), '-i', '-', '-c:v', 'libx264', '-preset', 'medium', '-crf', arg('crf', '17'), '-pix_fmt', 'yuv420p', '-r', String(fps), file], { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((resolve, reject) => ff.on('exit', (c) => (c === 0 ? resolve() : reject(new Error(`ffmpeg exited ${c}`)))));
  let last = Date.now();
  for (let i = 0; i < frames.length; i++) {
    const url = await page.evaluate((t) => window.frameJPEG(t, 0.95), frames[i]);
    if (errors.length) throw new Error(`[${label}] t=${frames[i].toFixed(3)}\n${errors.join('\n')}`);
    if (!ff.stdin.write(decode(url))) await new Promise((r) => ff.stdin.once('drain', r));
    if (Date.now() - last > 15000) {
      last = Date.now();
      console.log(`[${label}] ${i + 1}/${frames.length} (t=${frames[i].toFixed(2)})`);
    }
  }
  ff.stdin.end();
  await done;
  await page.close();
}

async function main() {
  const { chromium } = await loadPlaywright();
  const server = await serve();
  const port = server.address().port;
  const browser = await chromium.launch({ args: ['--disable-gpu', '--force-color-profile=srgb'] });
  try {
    if (mode === 'video') {
      const fps = Number(arg('fps', 30));
      const { page } = await openPage(browser, port);
      const DURATION = await page.evaluate(() => window.DURATION);
      await page.close();
      const from = Number(arg('from', 0));
      const to = Number(arg('to', DURATION));
      const out = path.resolve(arg('out', path.join(ROOT, 'out', 'farewell.mp4')));
      fs.mkdirSync(path.dirname(out), { recursive: true });
      const n = Math.round((to - from) * fps);
      const times = Array.from({ length: n }, (_, i) => from + i / fps);
      const workers = Math.max(1, Number(arg('workers', 3)));
      const per = Math.ceil(n / workers);
      const tmp = fs.mkdtempSync(path.join(path.dirname(out), '.chunks-'));
      const chunks = [];
      const t0 = Date.now();
      console.log(`rendering ${n} frames (${from}s..${to}s @${fps}fps) with ${workers} workers`);
      await Promise.all(
        Array.from({ length: workers }, (_, w) => {
          const part = times.slice(w * per, (w + 1) * per);
          if (!part.length) return null;
          const file = path.join(tmp, `chunk${w}.mp4`);
          chunks[w] = file;
          return renderChunk(browser, port, part, fps, file, `w${w}`);
        }),
      );
      const list = path.join(tmp, 'list.txt');
      fs.writeFileSync(list, chunks.filter(Boolean).map((f) => `file '${f}'`).join('\n'));
      const audio = path.join(ROOT, 'assets', 'audio.m4a');
      const withAudio = mode === 'video' && arg('audio', '1') !== '0';
      await run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', list,
        ...(withAudio ? ['-ss', String(from), '-i', audio, '-map', '0:v', '-map', '1:a', '-c:a', 'copy'] : []),
        '-c:v', 'copy', '-movflags', '+faststart', out]);
      fs.rmSync(tmp, { recursive: true, force: true });
      console.log(`wrote ${out} in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
    } else if (mode === 'sheet') {
      const { page } = await openPage(browser, port);
      const from = Number(arg('from', 0));
      const to = Number(arg('to', from + 4));
      const step = Number(arg('step', 1));
      const times = [];
      for (let t = from; t <= to + 1e-6; t += step) times.push(Number(t.toFixed(3)));
      const url = await page.evaluate(([ts, c, s]) => window.sheet(ts, c, s), [times, Number(arg('cols', 4)), Number(arg('scale', 0.25))]);
      const out = path.resolve(arg('out', `sheet_${from}_${to}.png`));
      fs.mkdirSync(path.dirname(out), { recursive: true });
      fs.writeFileSync(out, decode(url));
      console.log(`wrote ${out} (${times.length} frames)`);
    } else if (mode === 'stills') {
      const { page } = await openPage(browser, port);
      const times = String(arg('times', '0')).split(',').map(Number);
      const scale = Number(arg('scale', 0.5));
      const outdir = path.resolve(arg('outdir', '.'));
      fs.mkdirSync(outdir, { recursive: true });
      for (const t of times) {
        const url = await page.evaluate(([tt, s]) => window.sheet([tt], 1, s), [t, scale]);
        const file = path.join(outdir, `still_${t.toFixed(2)}.png`);
        fs.writeFileSync(file, decode(url));
        console.log(`wrote ${file}`);
      }
    } else if (mode === 'check') {
      const { page, errors } = await openPage(browser, port);
      const step = Number(arg('step', 0.25));
      const res = await page.evaluate((st) => {
        const t0 = performance.now();
        const bad = [];
        let n = 0;
        for (let t = 0; t <= window.DURATION; t += st) {
          try {
            window.renderAt(t);
          } catch (e) {
            bad.push(`t=${t.toFixed(2)}: ${e.message}`);
          }
          n++;
        }
        return { n, ms: (performance.now() - t0) / n, bad: bad.slice(0, 20), nbad: bad.length };
      }, step);
      console.log(`checked ${res.n} frames, ${res.ms.toFixed(1)} ms/frame, ${res.nbad} errors`);
      res.bad.forEach((b) => console.log('  ' + b));
      if (errors.length) console.log(errors.join('\n'));
      if (res.nbad || errors.length) process.exitCode = 1;
    } else {
      throw new Error(`unknown mode ${mode}`);
    }
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
