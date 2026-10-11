// s08 · 77–88 · 我还是想被看见。/ 但这一次，我想先把故事讲完。
// Late at night, his room. He is editing this very film.
//  A 77–79.5  (dissolve in) over the shoulder: the back of his head and his
//             shoulders big at the lower left, a dark silhouette against the
//             lit laptop with a thin rim of screen light, his right arm out to
//             the mouse; the room is night (only the screen and its spill on
//             the keys are lit), the moon faint in the window; the laptop
//             screen big at the right — an editor: a preview above, a
//             timeline below (one clip per scene of this film, shaded as dark
//             as the scene is; the last one is still a dashed, empty box).
//             The preview shows the road we just left (01:17). His hand on the
//             mouse drags the playhead back — the preview scrubs through the
//             room and the stage — to 00:00: black, one spotlight, a tiny boy
//             in its pool.
//  B 79.5–84  side view in the room, slow push in on his face (feet on the
//             floor; the window stays whole): the only light on him is a
//             small patch of screen light on his face, thrown by the lid
//             like a little spotlight he lit himself. Calm; a slight smile, a
//             blink, he leans in. His right hand rests on the mouse.
//  C 84–88    over the shoulder again: his hand moves the mouse, the cursor
//             goes to play, click: the playhead moves, the timecode ticks, the
//             tiny boy in the preview looks round, smiles, hands on hips, up
//             on his toes. 86–88 everything sinks to black; the little spot in
//             the preview goes last. No applause.
import { W, H, COL, TAU, clamp, lerp, prog, smooth, keys, ease, camera, path, line, rect, ellipse, fillPoly, text } from '../lib.js';
import { figure, pose, joints, reach, SIT, SIT_LIFT } from '../figure.js';
import { stage } from '../light.js';
import { screenFront } from '../props.js';
import { ROOM, room } from '../room.js';
import { moon } from '../sets.js';
import { SCENES, SUBTITLES, DURATION } from '../timeline.js';

// ------------------------------------------------------------------ beats
// (scene time lt = t - 77)
const A_END = 2.5; // cut to the side view (79.5)
const C_START = 7.0; // cut back over the shoulder (84)
const GRAB = 0.55; // he grabs the playhead...
const DROP = 1.35; // ...and lets it go at 00:00
const CLICK = 7.62; // play
const PLAY = 7.68; // the playhead starts to move
const FADE = [9.0, 10.85]; // everything sinks to black (86–87.85)
const PT0 = 77; // where the playhead stands when we come in

// playhead time (film seconds)
function playhead(lt) {
  if (lt < GRAB) return PT0;
  if (lt < DROP) return lerp(PT0, 0, ease.inOut(prog(lt, GRAB, DROP)));
  if (lt < PLAY) return 0;
  return lt - PLAY;
}

// ------------------------------------------------------------------ the shot over his shoulder (world = screen at z 1)
const SCR = { x: 846, y: 110, w: 900, h: 504 };
const PV = { w: 528, h: 297 };
PV.x = SCR.x + (SCR.w - PV.w) / 2;
PV.y = SCR.y + 46;
const TY = PV.y + PV.h + 27; // transport row
const PLAY_BTN = [SCR.x + SCR.w / 2, TY];
const RY = TY + 30; // ruler
const TL0 = SCR.x + 28;
const TL1 = SCR.x + SCR.w - 28;
const tlx = (t) => lerp(TL0, TL1, t / DURATION);
const VY = RY + 8; // video track
const VH = 40;
const SY = VY + VH + 8; // subtitle track
const SH = 13;
const HANDLE_Y = RY - 9;

// him, seen from behind: the back of his head and his right shoulder, big,
// dark against the lit laptop (a silhouette with a thin warm rim of screen
// light); his right arm goes forward to the mouse
const BK = { hx: 668, hy: 646, r: 68 };
const SIL = '#211e1b';
const TABLE_EDGE = 884;
const TABLE_FAR = 652;
const BASE = { y0: SCR.y + SCR.h + 13, y1: 786, far: [SCR.x - 8, SCR.x + SCR.w + 8], near: [SCR.x - 70, SCR.x + SCR.w + 64] };
const MOUSE_REST = [1036, 846]; // where the mouse sits once the playhead is at 00:00
const WIN = { x: 60, y: 96, w: 270, h: 290 };

// how dark each clip is drawn on the timeline (the film's own darkness arc)
const CLIP_DARK = { s01: 0.85, s02: 0.82, s03: 0.78, s04: 0.7, s05: 0.5, s06: 0.44, s07: 0.36 };

const CUR_REST = [tlx(0) + 64, VY + 20];
// the cursor on the screen (world coords) and whether the button is down
function cursorAt(lt) {
  const H0 = [tlx(PT0) + 40, VY + 24]; // where it waits as we come in
  const REST = CUR_REST; // after the drop, over the first clip
  if (lt < C_START) {
    if (lt < GRAB) {
      const k = smooth(lt, 0.05, GRAB - 0.04);
      return { p: [lerp(H0[0], tlx(PT0), k), lerp(H0[1], HANDLE_Y + 3, k)], down: false };
    }
    if (lt < DROP) return { p: [tlx(playhead(lt)), HANDLE_Y + 3], down: true };
    const k = smooth(lt, DROP + 0.12, DROP + 0.75);
    return { p: [lerp(tlx(0), REST[0], k), lerp(HANDLE_Y + 3, REST[1], k)], down: false };
  }
  // C: to the play button, click, then off it a little
  const k1 = smooth(lt, C_START + 0.12, CLICK - 0.04);
  const k2 = smooth(lt, CLICK + 0.45, CLICK + 1.3);
  const B = [PLAY_BTN[0] + 3, PLAY_BTN[1] + 4];
  const OFF = [PLAY_BTN[0] + 92, TY + 30];
  let p = [lerp(REST[0], B[0], k1), lerp(REST[1], B[1], k1) - Math.sin(k1 * Math.PI) * 30];
  p = [lerp(p[0], OFF[0], k2), lerp(p[1], OFF[1], k2)];
  return { p, down: lt >= CLICK && lt < CLICK + 0.11 };
}

// the mouse on the table follows the cursor (a small gain)
function mouseAt(lt) {
  const c = cursorAt(lt).p;
  // (a bigger gain in C, so the hand's move reads; it's a cut, nothing jumps)
  const g = lt < C_START ? 0.05 : 0.08;
  return [MOUSE_REST[0] + (c[0] - CUR_REST[0]) * g, MOUSE_REST[1] + (c[1] - CUR_REST[1]) * g * 0.8];
}

// ------------------------------------------------------------------ mm:ss
const two = (n) => (n < 10 ? '0' : '') + n;
const fmt = (t) => `${two(Math.floor(t / 60))}:${two(Math.floor(t) % 60)}`;

// ------------------------------------------------------------------ tiny frames of this film, for the preview
// the opening: black, one spotlight, the boy in its pool (s01, in small)
function miniStage(c, x, y, w, h, pt) {
  fillPoly(c, [[x, y], [x + w, y], [x + w, y + h], [x, y + h]], '#2c2a27');
  const cx = x + w / 2;
  const fl = y + h * 0.73;
  // spill
  const g = c.createRadialGradient(cx, fl - 30, 0, cx, fl - 30, w * 0.55);
  g.addColorStop(0, 'rgba(232,226,214,0.16)');
  g.addColorStop(1, 'rgba(232,226,214,0)');
  c.fillStyle = g;
  c.fillRect(x, y, w, h);
  path(c, [[x - 4, fl], [x + w + 4, fl]], { w: 1.6, color: '#57524b', seed: 8400, wobble: 0.3 });
  // the beam and its pool
  const rx = 27;
  const bg = c.createLinearGradient(0, y, 0, fl);
  bg.addColorStop(0, 'rgba(240,235,224,0.42)');
  bg.addColorStop(1, 'rgba(240,235,224,0.92)');
  c.fillStyle = bg;
  c.beginPath();
  c.moveTo(cx - 5, y);
  c.lineTo(cx + 5, y);
  c.lineTo(cx + rx, fl);
  c.lineTo(cx - rx, fl);
  c.closePath();
  c.fill();
  c.save();
  c.fillStyle = 'rgba(240,235,224,0.9)';
  c.beginPath();
  c.ellipse(cx, fl, rx, 6.5, 0, 0, TAU);
  c.fill();
  c.restore();
  // the boy, as in s01 (a little quicker, so it reads this small): hands
  // behind his back; he looks round, smiles, puts his hands on his hips and
  // rises on his toes
  const s = 0.3;
  const shy = { aA1: 0.22, aA2: -1.5, aB1: 0.22, aB2: -1.5 };
  const akimbo = { aA1: 0.8, aA2: -2.1, aB1: 0.8, aB2: -2.1 };
  const arms = keys(pt, [[0, shy], [1.5, shy], [2.0, akimbo]]);
  const turn = keys(pt, [[0, 0], [0.3, 0], [0.7, -0.8], [1.0, -0.8], [1.4, 0.6], [1.7, 0]]);
  const look = keys(pt, [[0, 0], [1.6, 0], [2.0, -0.6]]);
  const mouth = keys(pt, [[0, 0.2], [1.0, 0.2], [1.4, 1]]);
  const rise = keys(pt, [[0, 0], [2.0, 0], [2.3, 2.5]]) + (pt > 2.3 ? Math.abs(Math.sin((pt - 2.3) * Math.PI * 1.25)) * 2.2 : 0);
  figure(c, pose({ x: cx, y: fl - 114 * s - rise, s, view: 'front', ...arms, lA1: 0.06, lB1: 0.06, turn, look }), { id: 1, cowlick: true, mouth, w: 1.8 });
}

// the room with the number (s03), a flash while scrubbing
function miniRoom(c, x, y, w, h) {
  fillPoly(c, [[x, y], [x + w, y], [x + w, y + h], [x, y + h]], '#3a3733');
  const g = c.createRadialGradient(x + w * 0.56, y + h * 0.5, 0, x + w * 0.56, y + h * 0.5, w * 0.33);
  g.addColorStop(0, 'rgba(232,226,214,0.75)');
  g.addColorStop(1, 'rgba(232,226,214,0)');
  c.fillStyle = g;
  c.fillRect(x, y, w, h);
  const fl = y + h * 0.82;
  const o = { w: 1.8, wobble: 0.3 };
  path(c, [[x, fl], [x + w, fl]], { ...o, seed: 8410 });
  const tt = fl - 62;
  path(c, [[x + w * 0.5, tt], [x + w * 0.72, tt]], { ...o, seed: 8411 });
  path(c, [[x + w * 0.52, tt], [x + w * 0.52, fl]], { ...o, seed: 8412 });
  path(c, [[x + w * 0.7, tt], [x + w * 0.7, fl]], { ...o, seed: 8413 });
  path(c, [[x + w * 0.66, tt - 2], [x + w * 0.68, tt - 40]], { ...o, seed: 8414 });
  const p = pose({ ...SIT, x: x + w * 0.42, y: fl - 40, s: 0.42, f: 1, lean: 0.3, head: 0.1, aA1: 1.3, aA2: 0.3, aB1: 1.2, aB2: 0.4 });
  figure(c, p, { id: 1, cowlick: true, w: 1.7 });
  text(c, '12', x + w * 0.66, y + h * 0.3, { size: 34 });
}

// the end of the road (s07), where we came in
function miniRoad(c, x, y, w, h) {
  fillPoly(c, [[x, y], [x + w, y], [x + w, y + h], [x, y + h]], '#c9c2b5');
  const hz = y + h * 0.53;
  const far = y + h * 0.645;
  const near = y + h * 0.675;
  const o = { w: 1.5, wobble: 0.3 };
  path(c, [[x, hz], [x + w, hz]], { ...o, color: COL.inkSoft, seed: 8420 });
  path(c, [[x, far], [x + w, far]], { ...o, seed: 8421 });
  path(c, [[x, near], [x + w, near]], { ...o, w: 1.8, seed: 8422 });
  for (let i = 0; i < 9; i++) path(c, [[x + w * (0.02 + i * 0.11), (far + near) / 2], [x + w * (0.07 + i * 0.11), (far + near) / 2]], { ...o, w: 1, color: COL.inkSoft, seed: 8425 + i, wobble: 0 });
  // her lane, going off to the horizon from the far side, and the signpost
  const lx = x + w * 0.3;
  path(c, [[lx - w * 0.03, far], [lx + w * 0.004, hz + h * 0.012]], { ...o, w: 1.2, seed: 8423 });
  path(c, [[lx + w * 0.03, far], [lx + w * 0.012, hz + h * 0.012]], { ...o, w: 1.2, seed: 8424 });
  const px = x + w * 0.41;
  path(c, [[px, far], [px, far - h * 0.1]], { ...o, w: 1.2, seed: 8426 });
  path(c, [[px - w * 0.03, far - h * 0.085], [px, far - h * 0.08]], { ...o, w: 1.6, seed: 8427, wobble: 0 });
  path(c, [[px, far - h * 0.06], [px + w * 0.032, far - h * 0.06]], { ...o, w: 1.6, seed: 8428, wobble: 0 });
  const s = 0.15;
  figure(c, pose({ x: x + w * 0.36, y: near - 114 * s, s, f: 1, lA1: 0.3, lB1: -0.3, aA1: -0.3, aB1: 0.3 }), { id: 1, cowlick: true, w: 1.3 });
  for (let i = 0; i < 3; i++) {
    const bx = x + w * (0.47 + i * 0.06);
    const by = y + h * (0.2 + (i % 2) * 0.05);
    path(c, [[bx - 5, by - 2], [bx, by + 2], [bx + 5, by - 2]], { w: 1.3, seed: 8430 + i, wobble: 0 });
  }
}

function preview(c, pt) {
  const { x, y, w, h } = PV;
  c.save();
  c.beginPath();
  c.rect(x, y, w, h);
  c.clip();
  if (pt >= 31) miniRoad(c, x, y, w, h);
  else if (pt >= 19) miniRoom(c, x, y, w, h);
  else miniStage(c, x, y, w, h, pt);
  c.restore();
  rect(c, x, y, w, h, { w: 2.6, seed: 8440, over: 2 });
}

// ------------------------------------------------------------------ the editor on the screen
function editor(c, lt) {
  const pt = playhead(lt);
  const { x, y, w } = SCR;
  const soft = { color: COL.inkSoft, wobble: 0.3 };
  // window bar
  path(c, [[x, y + 30], [x + w, y + 30]], { ...soft, w: 2, seed: 8450 });
  for (let i = 0; i < 3; i++) ellipse(c, x + 22 + i * 20, y + 15, 5.5, 5.5, { w: 1.8, seed: 8451 + i, wobble: 0.2 });
  // side panel: a bin of clips (little boxes)
  for (let i = 0; i < 4; i++) {
    const bx = x + 26;
    const by = PV.y + 6 + i * 52;
    rect(c, bx, by, 64, 36, { w: 1.6, color: COL.inkSoft, seed: 8460 + i, over: 1.5, fill: `rgba(31,28,25,${[0.6, 0.55, 0.25, 0.18][i]})` });
    path(c, [[bx + 76, by + 12], [bx + 128, by + 12]], { ...soft, w: 2, seed: 8470 + i });
    path(c, [[bx + 76, by + 24], [bx + 108, by + 24]], { ...soft, w: 2, seed: 8474 + i });
  }

  preview(c, pt);

  // transport: timecode, play / pause
  text(c, fmt(pt), PV.x, TY, { size: 27, align: 'left', spacing: 1 });
  text(c, '/ ' + fmt(DURATION), PV.x + 86, TY, { size: 21, align: 'left', alpha: 0.5 });
  const playing = lt >= PLAY;
  const press = lt >= CLICK && lt < CLICK + 0.11 ? 0.85 : 1;
  const [bx, by] = PLAY_BTN;
  if (!playing) {
    const r = 11 * press;
    const tri = [[bx - r * 0.75, by - r], [bx + r, by], [bx - r * 0.75, by + r]];
    fillPoly(c, tri, COL.ink);
  } else {
    fillPoly(c, [[bx - 9, by - 10], [bx - 3.5, by - 10], [bx - 3.5, by + 10], [bx - 9, by + 10]], COL.ink);
    fillPoly(c, [[bx + 3.5, by - 10], [bx + 9, by - 10], [bx + 9, by + 10], [bx + 3.5, by + 10]], COL.ink);
  }
  for (const sx of [-1, 1]) {
    const ax = bx + sx * 52;
    fillPoly(c, [[ax - sx * 8, by - 8], [ax + sx * 2, by], [ax - sx * 8, by + 8]], COL.inkSoft);
    fillPoly(c, [[ax + sx * 2, by - 8], [ax + sx * 12, by], [ax + sx * 2, by + 8]], COL.inkSoft);
  }

  // ruler
  path(c, [[TL0, RY], [TL1, RY]], { ...soft, w: 1.8, seed: 8480 });
  for (let s = 0, i = 0; s <= DURATION; s += 5, i++) {
    const tx = tlx(s);
    path(c, [[tx, RY], [tx, RY - (s % 10 === 0 ? 8 : 4)]], { ...soft, w: 1.4, seed: 8481 + i, wobble: 0 });
  }
  // the video track: one clip per scene, shaded as dark as the scene is;
  // the last one (this one) is still an empty dashed box
  SCENES.forEach((s, i) => {
    const x0 = tlx(s.start) + 1.5;
    const x1 = tlx(s.end) - 1.5;
    const d = CLIP_DARK[s.id];
    if (d === undefined) {
      rect(c, x0, VY, x1 - x0, VH, { w: 1.6, dash: [6, 5], seed: 8500 + i, over: 0, wobble: 0.2 });
    } else {
      rect(c, x0, VY, x1 - x0, VH, { w: 1.8, seed: 8500 + i, over: 1, wobble: 0.3, fill: `rgba(31,28,25,${(d * 0.8).toFixed(3)})` });
    }
  });
  // the subtitle track
  SUBTITLES.forEach((s, i) => {
    fillPoly(c, [[tlx(s.t0), SY], [tlx(s.t1), SY], [tlx(s.t1), SY + SH], [tlx(s.t0), SY + SH]], COL.ink, 0.42);
  });
  // playhead
  const px = tlx(pt);
  const down = lt >= GRAB && lt < DROP;
  path(c, [[px, HANDLE_Y + 6], [px, SY + SH + 8]], { w: 2.6, seed: 8520, wobble: 0 });
  const hw = down ? 9 : 8;
  fillPoly(c, [[px - hw, HANDLE_Y - 8], [px + hw, HANDLE_Y - 8], [px + hw, HANDLE_Y + 2], [px, HANDLE_Y + 10], [px - hw, HANDLE_Y + 2]], COL.ink);

  // the cursor
  const cu = cursorAt(lt).p;
  cursor(c, cu[0], cu[1]);
}

function cursor(c, x, y) {
  const P = [[0, 0], [0, 27], [7, 21], [12, 32], [17, 30], [12, 19.5], [21, 19.5]].map(([a, b]) => [x + a, y + b]);
  path(c, P, { w: 2.4, close: true, fill: '#fbf8f1', seed: 8530, wobble: 0 });
}

// the laptop's keyboard half, seen from behind him
function keyboard(ctx) {
  const B = BASE;
  const pts = [[B.far[0], B.y0], [B.far[1], B.y0], [B.near[1], B.y1], [B.near[0], B.y1]];
  path(ctx, pts, { w: 4, close: true, fill: COL.paper, seed: 8540, wobble: 0.5 });
  // rows of keys
  const rows = 4;
  for (let r = 0; r < rows; r++) {
    const v0 = 0.1 + r * 0.15;
    const v1 = v0 + 0.11;
    const yy0 = lerp(B.y0, B.y1, v0);
    const yy1 = lerp(B.y0, B.y1, v1);
    const xl0 = lerp(B.far[0], B.near[0], v0) + 34;
    const xr0 = lerp(B.far[1], B.near[1], v0) - 34;
    const n = 14;
    for (let i = 0; i < n; i++) {
      const u0 = (i + 0.08) / n;
      const u1 = (i + 0.88) / n;
      const xl1 = lerp(B.far[0], B.near[0], v1) + 34;
      const xr1 = lerp(B.far[1], B.near[1], v1) - 34;
      fillPoly(ctx, [[lerp(xl0, xr0, u0), yy0], [lerp(xl0, xr0, u1), yy0], [lerp(xl1, xr1, u1), yy1], [lerp(xl1, xr1, u0), yy1]], COL.ink, 0.18);
    }
  }
  // touchpad
  const tv0 = 0.74;
  const ty0 = lerp(B.y0, B.y1, tv0);
  const cx = (B.near[0] + B.near[1]) / 2;
  rect(ctx, cx - 120, ty0, 240, B.y1 - ty0 - 9, { w: 2, color: COL.inkSoft, seed: 8545, over: 1, wobble: 0.3 });
}

function mousePad(ctx) {
  // a pad lying flat on the table (it doesn't move)
  const [x, y] = MOUSE_REST;
  const pad = [[x - 74, y - 24], [x + 66, y - 24], [x + 80, y + 26], [x - 84, y + 26]];
  path(ctx, pad, { w: 2.4, close: true, fill: COL.paperShade, seed: 8549, wobble: 0.3, color: COL.inkSoft });
}

function mouse(ctx, x, y) {
  // seen from behind and above: a flat oval, the buttons split at the front
  ellipse(ctx, x, y, 20, 14, { w: 3.4, fill: COL.paper, seed: 8550, wobble: 0.15 });
  path(ctx, [[x, y - 14], [x, y - 4]], { w: 2, seed: 8551, wobble: 0 });
}

function overShoulder(ctx, lt) {
  const fk = smooth(lt, FADE[0], FADE[1], ease.sine);
  // a slow push toward the screen through A, held and a touch more in C
  const k = lt < C_START ? smooth(lt, 0.2, A_END + 1.5, ease.sine) : 1;
  const k2 = smooth(lt, C_START, 11, ease.sine);
  const cam = { x: lerp(960, 1004, k) + 4 * k2, y: lerp(540, 532, k) - 3 * k2, z: lerp(1.0, 1.05, k) + 0.015 * k2 };
  camera(ctx, cam, () => {
    // the wall: a window with the moon
    const wn = WIN;
    rect(ctx, wn.x, wn.y, wn.w, wn.h, { w: 4, seed: 8600 });
    line(ctx, wn.x + wn.w / 2, wn.y, wn.x + wn.w / 2, wn.y + wn.h, { w: 3, seed: 8601 });
    line(ctx, wn.x, wn.y + wn.h / 2, wn.x + wn.w, wn.y + wn.h / 2, { w: 3, seed: 8602 });
    path(ctx, [[wn.x - 14, wn.y + wn.h + 4], [wn.x + wn.w + 14, wn.y + wn.h + 4]], { w: 4, seed: 8603 });
    moon(ctx, wn.x + wn.w * 0.73, wn.y + wn.h * 0.27, 24, {});
    // the table: far edge against the wall, near edge in front of him (he
    // hides part of it)
    path(ctx, [[-60, TABLE_FAR], [SCR.x - 12, TABLE_FAR]], { w: 3, seed: 8610, wobble: 0.5 });
    path(ctx, [[SCR.x + SCR.w + 12, TABLE_FAR], [2000, TABLE_FAR]], { w: 3, seed: 8611, wobble: 0.5 });
    path(ctx, [[-60, TABLE_EDGE], [2000, TABLE_EDGE]], { w: 4.4, seed: 8612, wobble: 0.6 });
    const m = mouseAt(lt);
    const hp = himShape(lt, m, cursorAt(lt).down ? 1 : 0);
    // a mug, late at night
    mug(ctx, 1830, 700);

    // the laptop
    keyboard(ctx);
    screenFront(ctx, SCR.x, SCR.y, SCR.w, SCR.h, { stand: false, seed: 8620, w: 5, content: (c) => editor(c, lt) });

    // the mouse and his hand on it
    mousePad(ctx);
    mouse(ctx, m[0], m[1]);
    him(ctx, hp);

    // light: the screen and its spill on the keys; the moon, faint. The rest
    // of the room is night.
    const scrK = 1 - smooth(lt, FADE[0], FADE[1] - 0.45, ease.sine);
    const spotK = 1 - smooth(lt, FADE[0] + 0.8, FADE[1] + 0.05, ease.sine);
    // (exactly the beam miniStage() draws)
    const bx = PV.x + PV.w / 2;
    const bfl = PV.y + PV.h * 0.73;
    const beam = [[bx - 5, PV.y], [bx + 5, PV.y], [bx + 27, bfl], [bx - 27, bfl]];
    const showSpot = playhead(lt) < 19;
    stage(ctx, [
      { type: 'poly', pts: [[SCR.x - 10, SCR.y - 10], [SCR.x + SCR.w + 10, SCR.y - 10], [SCR.x + SCR.w + 10, SCR.y + SCR.h + 10], [SCR.x - 10, SCR.y + SCR.h + 10]], k: 0.93 * scrK },
      { type: 'glow', x: SCR.x + SCR.w * 0.45, y: SCR.y + SCR.h * 0.75, r: 650, k: 0.25 * scrK },
      { type: 'poly', pts: [[BASE.far[0], BASE.y0], [BASE.far[1], BASE.y0], [BASE.near[1], BASE.y1], [BASE.near[0], BASE.y1]], k: 0.5 * scrK },
      { type: 'glow', x: SCR.x + SCR.w * 0.4, y: BASE.y1 + 40, r: 420, k: 0.22 * scrK },
      { type: 'poly', pts: [[WIN.x, WIN.y], [WIN.x + WIN.w, WIN.y], [WIN.x + WIN.w, WIN.y + WIN.h], [WIN.x, WIN.y + WIN.h]], k: 0.15 * scrK },
      { type: 'poly', pts: beam, k: showSpot ? spotK : 0 },
      { type: 'pool', x: bx, y: bfl, rx: 30, ry: 7.5, k: showSpot ? spotK : 0 },
    ], { dark: lerp(0.8, 1, fk), beams: 0 });
    // the screen's light catching the edge of his head and shoulder
    rim(ctx, hp, 0.55 * scrK);
  });
  vignette(ctx, 0.55);
}

// the corners of the room fall off into the night
function vignette(ctx, k) {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 1.05);
  g.addColorStop(0, 'rgba(14,13,12,0)');
  g.addColorStop(1, `rgba(14,13,12,${k})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

function mug(ctx, x, y) {
  path(ctx, [[x - 26, y - 34], [x - 24, y + 30], [x + 24, y + 30], [x + 26, y - 34]], { w: 3.4, seed: 8630, wobble: 0.3 });
  ellipse(ctx, x, y - 34, 26, 7, { w: 2.6, seed: 8631, wobble: 0.2 });
  path(ctx, [[x + 25, y - 18], [x + 42, y - 14], [x + 42, y + 8], [x + 24, y + 14]], { w: 3, seed: 8632, wobble: 0.3 });
}

// his silhouette from behind (screen coords): head, cowlick, the neck and
// shoulders running out of frame at the lower left, the right arm forward
// to the mouse, the elbow on the table
function himShape(lt, m, down) {
  // a breath; a small tilt of the head as he watches; his body follows the
  // hand a little
  const br = Math.sin(lt * 1.5) * 1.6;
  const tilt = keys(lt, [[0, 0.02], [DROP, 0.02], [A_END, 0.06], [C_START, 0.04], [C_START + 1.2, 0.0], [11, 0.05]]);
  const follow = (m[0] - MOUSE_REST[0]) * 0.06;
  const ox = follow;
  const oy = -br;
  const H = [BK.hx + ox + tilt * 40, BK.hy + oy];
  const r = BK.r;
  const P = (x, y) => [BK.hx + ox + x, BK.hy + oy + y];
  // body outline, clockwise from the left of the neck
  const body = [
    P(-27, 48), P(-31, 90),
    P(-105, 108), P(-180, 132), P(-228, 172), P(-250, 240), P(-262, 330), P(-270, 520),
    P(118, 520), P(128, 340), P(150, 248),
    P(176, 214), P(198, 176), P(178, 136), P(112, 108), P(34, 90), P(27, 48),
  ];
  // the right arm: shoulder -> elbow (on the table) -> wrist -> hand on the mouse
  const hand = [m[0] - 3, m[1] + 7 + down * 2];
  const elbow = [BK.hx + 270 + follow * 0.7, TABLE_EDGE - 8];
  const shoulder = P(168, 200);
  const wrist = [lerp(elbow[0], hand[0], 0.8), lerp(elbow[1], hand[1], 0.8)];
  return { H, r, tilt, body, shoulder, elbow, wrist, hand };
}

// a closed smooth shape through pts (midpoint quadratics)
function blob(ctx, pts) {
  ctx.beginPath();
  const n = pts.length;
  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const m0 = mid(pts[n - 1], pts[0]);
  ctx.moveTo(m0[0], m0[1]);
  for (let i = 0; i < n; i++) {
    const a = pts[i];
    const b = mid(pts[i], pts[(i + 1) % n]);
    ctx.quadraticCurveTo(a[0], a[1], b[0], b[1]);
  }
  ctx.closePath();
}

function cowlickPts(hp) {
  const [hx, hy] = hp.H;
  const r = hp.r;
  const a = hp.tilt;
  // from behind it curls toward screen left
  const fx = -Math.cos(a);
  const fy = -Math.sin(a);
  const ux = Math.sin(a);
  const uy = -Math.cos(a);
  const Q = (u, v) => [hx + (fx * u + ux * v) * r, hy + (fy * u + uy * v) * r];
  return [Q(-0.06, 0.86), Q(-0.04, 1.2), Q(0.14, 1.42), Q(0.38, 1.4)];
}
// his ears, sticking out a little either side
function earPts(hp, side) {
  const [hx, hy] = hp.H;
  const r = hp.r;
  const a = hp.tilt;
  const cx = hx + side * r * 0.95 * Math.cos(a) - r * 0.1 * Math.sin(a);
  const cy = hy + side * r * 0.95 * Math.sin(a) + r * 0.1 * Math.cos(a);
  return [cx, cy];
}

function him(ctx, hp) {
  ctx.save();
  ctx.fillStyle = SIL;
  ctx.strokeStyle = SIL;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  // the shoulders and back
  blob(ctx, hp.body);
  ctx.fill();
  // the sleeve: upper arm, forearm resting on the table, the hand on the mouse
  ctx.lineWidth = 58;
  ctx.beginPath();
  ctx.moveTo(hp.shoulder[0], hp.shoulder[1]);
  ctx.quadraticCurveTo(hp.elbow[0] - 30, hp.elbow[1] + 4, hp.elbow[0], hp.elbow[1]);
  ctx.stroke();
  ctx.lineWidth = 40;
  ctx.beginPath();
  ctx.moveTo(hp.elbow[0], hp.elbow[1]);
  ctx.lineTo(hp.wrist[0], hp.wrist[1]);
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(hp.hand[0], hp.hand[1], 21, 14, -0.35, 0, TAU);
  ctx.fill();
  ctx.restore();
  // the back of his head: a dark disc with his ears, and his tuft (thick
  // at the root, curling off thin)
  for (const side of [-1, 1]) {
    const [ex, ey] = earPts(hp, side);
    ellipse(ctx, ex, ey, hp.r * 0.15, hp.r * 0.24, { w: 3.5, fill: SIL, seed: 8562 + side, wobble: 0.3 });
  }
  ellipse(ctx, hp.H[0], hp.H[1], hp.r, hp.r, { w: 5, fill: SIL, seed: 8560, wobble: 0.4 });
  const cw = cowlickPts(hp);
  path(ctx, cw.slice(0, 3), { w: 17, seed: 8561, wobble: 0.15 });
  path(ctx, cw.slice(1), { w: 11, seed: 8564, wobble: 0.15 });
}

// the thin warm edge of light the screen puts on him (drawn over the shade)
function rim(ctx, hp, a) {
  if (a <= 0.01) return;
  const o = { w: 3.6, color: COL.paper, alpha: a, wobble: 0.2 };
  const [hx, hy] = hp.H;
  const r = hp.r - 2;
  // the screen side of his head
  const arc = [];
  for (let i = 0; i <= 14; i++) {
    const t = lerp(-1.05, 0.62, i / 14);
    arc.push([hx + Math.cos(t) * r, hy + Math.sin(t) * r]);
  }
  path(ctx, arc, { ...o, seed: 8570 });
  // the tuft, lit on its upper side
  path(ctx, cowlickPts(hp).slice(1).map(([x, y]) => [x + 3, y - 5]), { ...o, w: 3, seed: 8571 });
  // the top of his right shoulder and the top of the sleeve
  const b = hp.body;
  path(ctx, [b[15], b[14], b[13], b[12]].map(([x, y]) => [x - 2, y + 4]), { ...o, seed: 8572 });
  path(ctx, [[hp.elbow[0] + 6, hp.elbow[1] - 19], [hp.wrist[0] + 2, hp.wrist[1] - 18]], { ...o, alpha: a * 0.8, seed: 8573 });
}

// ------------------------------------------------------------------ the side view: a little light on his face
const S = ROOM.s;
const KX = ROOM.hingeX - 88 * S;
const SIDE_FACE = [958, 1235]; // his face's world x, and where it sits on screen
function sideShot(ctx, lt) {
  const u = ease.sine(prog(lt, A_END, C_START));
  // a slow push in on his face, which holds its place right of centre (so
  // the window with the moon stays whole at the left all the way); the floor
  // stays just above the subtitle band
  const z = lerp(1.55, 1.85, u);
  const cam = { x: SIDE_FACE[0] - (SIDE_FACE[1] - 960) / z, y: ROOM.floor - 362 / z, z };
  camera(ctx, cam, () => {
    const r = room(ctx, lt, { moon: true });
    const top = r.top;
    // the mouse on his side of the laptop (nearer the camera, so drawn over
    // the keyboard's edge), his hand on it
    const mx = 1044 + smooth(lt, 6.55, 7.0) * 5;
    path(ctx, [[mx - 14, top - 1], [mx - 11, top - 8], [mx, top - 10.5], [mx + 11, top - 8], [mx + 14, top - 1]], { w: 3, fill: COL.paper, seed: 8700, wobble: 0.2 });
    const lean = keys(lt, [[A_END, 0.08], [4.6, 0.08], [5.6, 0.14], [C_START, 0.15]]);
    const head = keys(lt, [[A_END, 0.02], [3.0, 0.02], [3.8, -0.05], [4.6, -0.04], [5.4, 0.03], [5.9, -0.02]]);
    const p = pose({ ...SIT, x: ROOM.stoolX + 4, y: r.seat - SIT_LIFT * S + Math.sin(lt * 1.5) * 0.8, s: S, f: 1, lean, head, look: 0.05 });
    const hA = reach(p, 'A', mx + 1, top - 12);
    p.aA1 = hA.a1;
    p.aA2 = hA.a2;
    const hB = reach(p, 'B', KX + 38, top - 8);
    p.aB1 = hB.a1;
    p.aB2 = hB.a2;
    // his feet on the floor (not dangling), a little in front of the stool
    for (const [leg, dx] of [['A', 20], ['B', 8]]) {
      const lr = reach(p, leg, p.x + dx * S, ROOM.floor - 2, 'leg');
      p[`l${leg}1`] = lr.a1;
      p[`l${leg}2`] = lr.a2;
    }
    // the table's near leg breaks where his leg passes in front of it
    tableLegGap(ctx, joints(p));
    const mouth = keys(lt, [[A_END, 0.12], [3.0, 0.12], [3.9, 0.4]]);
    const blink = lt > 4.15 && lt < 4.3;
    const j = figure(ctx, p, { id: 1, cowlick: true, mouth, eye: blink ? 'closed' : 'dot' });
    const [hx, hy] = j.head;
    const hr = j.r;
    // the lit face of the lid (as laptop() draws it)
    const { hinge, lidEnd } = r.lp;
    const l1 = [lerp(hinge[0], lidEnd[0], 0.1) - 4, lerp(hinge[1], lidEnd[1], 0.1)];
    const l2 = [lerp(hinge[0], lidEnd[0], 0.95) - 4, lerp(hinge[1], lidEnd[1], 0.95)];
    // where the light lands: his face
    const fc = [hx + hr * 0.45, hy + hr * 0.05];
    const fr = hr * 1.25;
    const wedge = [l2, l1, [fc[0], fc[1] + fr], [fc[0], fc[1] - fr]];
    const warm = smooth(lt, 2.9, 4.0);
    haze(ctx, wedge, 0.04);
    stage(ctx, [
      // the small light on his face: brightest on the side toward the
      // screen, drawn out a little along the beam
      { type: 'glow', x: hx + hr * 0.75, y: fc[1], r: hr * lerp(1.95, 2.15, warm), k: lerp(0.9, 1, warm) },
      { type: 'glow', x: hx + hr * 2.0, y: fc[1] - hr * 0.1, r: hr * 1.35, k: 0.55 },
      // ... thrown from the screen
      { type: 'poly', pts: wedge, k: 0.13 },
      { type: 'poly', pts: [[l1[0] - 6, l1[1] + 4], [l1[0] + 4, l1[1] + 4], [l2[0] + 4, l2[1] - 4], [l2[0] - 6, l2[1] - 4]], k: 0.9 },
      // the night: just enough to make out the room
      { type: 'glow', x: 960, y: 660, r: 820, k: 0.1 },
      { type: 'poly', pts: [[ROOM.win.x, ROOM.win.y], [ROOM.win.x + ROOM.win.w, ROOM.win.y], [ROOM.win.x + ROOM.win.w, ROOM.win.y + ROOM.win.h], [ROOM.win.x, ROOM.win.y + ROOM.win.h]], k: 0.16 },
    ], { dark: 0.8 });
  });
  vignette(ctx, 0.45);
}

// paper over the table's near leg where his thigh or shin crosses it
function tableLegGap(ctx, j) {
  const lx = ROOM.tableX - 120 * S + 13 * S;
  const segs = [[j.hip, j.kneeA], [j.kneeA, j.footA], [j.hip, j.kneeB], [j.kneeB, j.footB]];
  ctx.save();
  ctx.fillStyle = COL.paper;
  for (const [a, b] of segs) {
    if ((a[0] - lx) * (b[0] - lx) > 0) continue;
    const y = lerp(a[1], b[1], (lx - a[0]) / (b[0] - a[0] || 1e-6));
    ctx.fillRect(lx - 7, y - 13, 14, 26);
  }
  ctx.restore();
}

// a faint warm haze in a light's path (like the beams in light.js)
function haze(ctx, pts, a) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  fillPoly(ctx, pts, `rgba(255,250,235,${a})`);
  ctx.restore();
}

export default {
  fadeIn: 0.5,
  draw(ctx, lt, info) {
    if (lt >= A_END && lt < C_START) sideShot(ctx, lt);
    else overShoulder(ctx, lt);
  },
};
