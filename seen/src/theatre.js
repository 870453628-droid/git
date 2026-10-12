// The theatre (s01, s02, s07): a stage behind a proscenium, and a raked
// auditorium in front of it, seen with a real perspective camera so the
// camera can pull back through the rows.
//
// Coordinates
// - The STAGE PLANE is the proscenium's plane (z = 0). Stage things are drawn
//   in stage-plane coordinates: the boy stands at (TH.cx, TH.floor).
// - The auditorium is in front of it, toward the camera (z < 0). A camera
//   {x, y, C} sits at depth C in front of the stage plane, looking at it;
//   F is the focal length. A point (X, Y, Z) lands on screen at
//   W/2 + F (X - x) / (Z + C), H/2 + F (Y - y) / (Z + C).
// - stageCam(cam) gives the lib.camera() object {x, y, z: F / C} for drawing
//   in the stage plane; project(cam, X, Y, Z) gives [sx, sy, scale].
//
// The audience are ordinary people seen from behind: dark silhouettes (head,
// neck, shoulders, the top of the seat) with a thin rim of stage light on the
// head and shoulders. They watch; nobody claps.
import { W, H, COL, TAU, clamp, lerp, hash, noise1, path, fillPoly, ellipsePts } from './lib.js';

export const F = 1000;

export const TH = {
  cx: 960,
  floor: 700, // front edge of the stage floor (the boy's feet)
  back: 588, // where the stage floor meets the back curtain
  pr: { x0: 300, x1: 1620, top: 96 }, // proscenium opening
  apron: 44, // height of the stage front below the floor edge
  boyS: 0.6,
};

// ---------------------------------------------------------------- camera
export const stageCam = (cam) => ({ x: cam.x, y: cam.y, z: F / cam.C });

export function project(cam, X, Y, Z) {
  const d = Z + cam.C;
  const s = F / d;
  return [W / 2 + s * (X - cam.x), H / 2 + s * (Y - cam.y), s, d];
}

// The dark of the hall: fill the whole frame before drawing the stage.
export function hallDark(ctx) {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#1d1b19';
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

// The glow of the stage in the air of the hall, so the heads in front of it
// stand out as silhouettes. Screen space; draw after the stage, before the
// rows. k: 0..1.
export function haze(ctx, cam, k = 1) {
  if (k <= 0.01) return;
  const p = project(cam, TH.cx, TH.floor - 140, 0);
  const r = 1250 * p[2];
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const g = ctx.createRadialGradient(p[0], p[1], 0, p[0], p[1], r);
  g.addColorStop(0, `rgba(226,219,204,${0.42 * k})`);
  g.addColorStop(0.45, `rgba(226,219,204,${0.2 * k})`);
  g.addColorStop(1, 'rgba(226,219,204,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

// ------------------------------------------------------------ the stage
const DARK = '#151311';

// Draw the stage in stage-plane coordinates (call inside camera(stageCam)).
// o: {backOpen 0..1 (the back curtain flies up, showing o.beyond), beyond(ctx),
//     floorMark 0..1 (a worn pale circle where the light always fell),
//     curtains 0..1 (how far the main drapes are open, default 1)}
export function stagePlane(ctx, t, o = {}) {
  const { cx, floor, back, pr, apron } = TH;
  const bx0 = 470;
  const bx1 = 1450;
  const vp = [cx, 330]; // vanishing point for the floor boards
  // back wall / back curtain
  const bo = clamp(o.backOpen ?? 0);
  if (bo > 0 && o.beyond) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(bx0 - 200, pr.top - 40, bx1 - bx0 + 400, back - pr.top + 42);
    ctx.clip();
    o.beyond(ctx, bo);
    ctx.restore();
  }
  const curtainBottom = lerp(back, pr.top - 60, bo);
  if (curtainBottom > pr.top - 50) {
    fillPoly(ctx, [[bx0 - 200, pr.top - 60], [bx1 + 200, pr.top - 60], [bx1 + 200, curtainBottom], [bx0 - 200, curtainBottom]], '#3a3632', 1);
    // vertical folds
    for (let i = 0; i < 26; i++) {
      const x = bx0 - 180 + i * 47 + hash(i * 3.3) * 10;
      path(ctx, [[x, pr.top - 50], [x + (hash(i) - 0.5) * 6, curtainBottom - 4]], { w: 2, color: 'rgba(0,0,0,0.35)', seed: 12000 + i, wobble: 0.4 });
    }
    path(ctx, [[bx0 - 200, curtainBottom], [bx1 + 200, curtainBottom]], { w: 2.4, seed: 12040, wobble: 0.5 });
  }
  // stage floor: a trapezoid with boards running to the vanishing point
  const fl = [[pr.x0 - 40, floor], [pr.x1 + 40, floor], [bx1, back], [bx0, back]];
  fillPoly(ctx, fl, '#d9d1c2', 1);
  for (let i = 0; i <= 22; i++) {
    const u = i / 22;
    const xf = lerp(pr.x0 - 40, pr.x1 + 40, u);
    const k = (back - floor) / (vp[1] - floor);
    const xb = lerp(xf, vp[0], k);
    path(ctx, [[xf, floor], [xb, back]], { w: 1.4, color: COL.pencil, seed: 12100 + i, wobble: 0.3 });
  }
  for (let j = 1; j < 4; j++) {
    const y = lerp(floor, back, Math.pow(j / 4, 1.4));
    const k = (y - floor) / (vp[1] - floor);
    path(ctx, [[lerp(pr.x0 - 40, vp[0], k), y], [lerp(pr.x1 + 40, vp[0], k), y]], { w: 1.2, color: COL.pencil, seed: 12130 + j, wobble: 0.4 });
  }
  path(ctx, [[bx0, back], [bx1, back]], { w: 2.4, seed: 12140, wobble: 0.5 });
  if (o.floorMark) {
    // the worn place where the light fell for years
    for (let i = 0; i < 3; i++) {
      path(ctx, ellipsePts(cx, floor - 6, 70 - i * 6, 13 - i, 0, TAU, 40), { w: 1.3, color: COL.pencil, alpha: o.floorMark, close: true, seed: 12150 + i, wobble: 0.6 });
    }
  }
  // stage front (apron face) and footlights
  fillPoly(ctx, [[pr.x0 - 60, floor], [pr.x1 + 60, floor], [pr.x1 + 60, floor + apron], [pr.x0 - 60, floor + apron]], '#2b2825', 1);
  path(ctx, [[pr.x0 - 60, floor], [pr.x1 + 60, floor]], { w: 3.6, seed: 12160, wobble: 0.5 });
  for (let i = 0; i < 15; i++) {
    const x = lerp(pr.x0 + 30, pr.x1 - 30, i / 14);
    path(ctx, ellipsePts(x, floor + 2, 15, 7, Math.PI, TAU, 10), { w: 2, close: true, fill: '#4a4540', seed: 12170 + i, wobble: 0.2 });
  }
  // wings: the side drapes and the proscenium
  drapes(ctx, t, o.curtains ?? 1);
}

function drapes(ctx, t, open) {
  const { pr, floor } = TH;
  const sway = (k) => noise1(t * 0.35 + k * 7, 40 + k) * 3;
  // proscenium frame (thick, dark)
  const WALL = '#1d1b19';
  fillPoly(ctx, [[pr.x0 - 1700, -1600], [pr.x1 + 1700, -1600], [pr.x1 + 1700, pr.top], [pr.x0 - 1700, pr.top]], WALL, 1);
  fillPoly(ctx, [[pr.x0 - 1700, pr.top - 2], [pr.x0, pr.top - 2], [pr.x0 - 6, floor + 200], [pr.x0 - 1700, floor + 200]], WALL, 1);
  fillPoly(ctx, [[pr.x1, pr.top - 2], [pr.x1 + 1700, pr.top - 2], [pr.x1 + 1700, floor + 200], [pr.x1 + 6, floor + 200]], WALL, 1);

  path(ctx, [[pr.x0, floor], [pr.x0, pr.top], [pr.x1, pr.top], [pr.x1, floor]], { w: 4, color: '#5a544c', seed: 12200, wobble: 0.4 });
  // the main drapes, gathered to each side with a tie-back
  for (const side of [-1, 1]) {
    const edge = side < 0 ? pr.x0 : pr.x1;
    const wTop = lerp(640, 150, open);
    const wTie = lerp(640, 70, open);
    const tieY = lerp(floor, 470, open);
    const inner = (y) => {
      const w = y < tieY ? lerp(wTop, wTie, Math.pow((y - pr.top) / (tieY - pr.top), 0.8)) : lerp(wTie, wTie * 1.9, (y - tieY) / (floor - tieY));
      return edge - side * w + sway(side) * (y - pr.top) / 600;
    };
    const ys = [];
    for (let y = pr.top; y <= floor + 1; y += 30) ys.push(y);
    const outline = [[edge + side * 10, pr.top], ...ys.map((y) => [inner(y), y]), [edge + side * 10, floor]];
    fillPoly(ctx, outline, '#2f2b28', 1);
    // folds
    for (let f = 1; f < 7; f++) {
      const u = f / 7;
      const pts = ys.map((y) => [lerp(edge, inner(y), u) + Math.sin(y * 0.01 + f) * 3, y]);
      path(ctx, pts, { w: 1.8, color: 'rgba(0,0,0,0.45)', seed: 12300 + f + (side > 0 ? 20 : 0), wobble: 0.3 });
    }
    path(ctx, ys.map((y) => [inner(y), y]), { w: 2.6, color: '#57514a', seed: 12350 + (side > 0 ? 1 : 0), wobble: 0.4 });
    // tie-back
    const tx = inner(tieY);
    path(ctx, [[tx - side * 6, tieY - 8], [edge, tieY + 4]], { w: 3, color: '#6a6359', seed: 12360 + (side > 0 ? 1 : 0), wobble: 0.2 });
  }
  // valance with swags
  fillPoly(ctx, [[pr.x0 - 20, pr.top - 4], [pr.x1 + 20, pr.top - 4], [pr.x1 + 20, pr.top + 46], [pr.x0 - 20, pr.top + 46]], '#2f2b28', 1);
  const n = 11;
  for (let i = 0; i < n; i++) {
    const a = lerp(pr.x0 - 20, pr.x1 + 20, i / n);
    const b = lerp(pr.x0 - 20, pr.x1 + 20, (i + 1) / n);
    const pts = ellipsePts((a + b) / 2, pr.top + 46, (b - a) / 2, 26, 0, Math.PI, 12);
    fillPoly(ctx, [[b, pr.top + 40], ...pts, [a, pr.top + 40]], '#2f2b28', 1);
    path(ctx, pts, { w: 2, color: '#57514a', seed: 12400 + i, wobble: 0.3 });
  }
}

// ------------------------------------------------------- the auditorium
// Rows of seats in front of the stage. Row 0 is nearest the stage.
export const ROWS = (() => {
  const rows = [];
  for (let k = 0; k < 26; k++) {
    const Z = -(240 + 150 * k);
    const head = 748 - 13.5 * k; // raked: back rows sit higher
    const half = 760 + 26 * k;
    const gap = 84;
    const n = Math.floor((2 * half) / gap);
    const seats = [];
    for (let i = 0; i <= n; i++) {
      const X = TH.cx - half + i * gap + (k % 2 ? gap / 2 : 0) + (hash(k * 31 + i) - 0.5) * 10;
      if (Math.abs(X - TH.cx) < 46) continue; // the centre aisle
      seats.push({ X, i, id: k * 100 + i, h: hash(k * 17.3 + i * 5.1) });
    }
    rows.push({ k, Z, head, seats });
  }
  return rows;
})();

// Draw the auditorium for camera cam. Call at identity transform (screen
// space), AFTER the stage (rows are in front of it) — but before stage().
// o: {occupied(seat, row) -> 0..1 (1 = someone sits there; fractions fade),
//     lean(seat, row) -> extra head tilt, t, rim (0..1 rim light strength),
//     seatBacks (draw empty seat backs, default true)}
// Returns the list of rim strokes to draw AFTER stage() with rims().
export function auditorium(ctx, cam, t, o = {}) {
  const rimList = [];
  // side walls and sconces, so the hall has depth
  walls(ctx, cam);
  lampFixtures(ctx, cam);
  for (const row of ROWS) {
    const d = row.Z + cam.C;
    if (d < 160) continue;
    const s = F / d;
    if (s < 0.05) continue;
    const yHead = H / 2 + s * (row.head - cam.y);
    if (yHead - 30 * s > H + 40) continue;
    for (const seat of row.seats) {
      const x = W / 2 + s * (seat.X - cam.x);
      if (x < -120 * s || x > W + 120 * s) continue;
      const occ = o.occupied ? o.occupied(seat, row) : 1;
      if (o.seatBacks !== false) seatBack(ctx, x, yHead, s);
      if (occ > 0.01) {
        const tilt = (o.lean ? o.lean(seat, row) : 0) + (seat.h - 0.5) * 0.12 + noise1(t * 0.25 + seat.h * 9, seat.id) * 0.03;
        person(ctx, x, yHead, s, { h: seat.h, tilt, alpha: occ, rimList, rim: o.rim ?? 1 });
      }
    }
  }
  return rimList;
}

function walls(ctx, cam) {
  // the floor line and cornice of each side wall, converging to the stage
  for (const side of [-1, 1]) {
    const X = TH.cx + side * 1480;
    const a = project(cam, X, 770, -200);
    const b = project(cam, X, 770 - 13.5 * 30, -4600);
    const c = project(cam, X, 0, -200);
    const d = project(cam, X, -300, -4600);
    if (a[3] > 0 && b[3] > 0) {
      path(ctx, [[a[0], a[1]], [b[0], b[1]]], { w: 2, color: 'rgba(90,82,72,0.6)', seed: 12500 + (side > 0 ? 1 : 0), wobble: 0.3 });
      path(ctx, [[c[0], c[1]], [d[0], d[1]]], { w: 2, color: 'rgba(90,82,72,0.6)', seed: 12502 + (side > 0 ? 1 : 0), wobble: 0.3 });
    }
  }
}

function lampFixtures(ctx, cam) {
  for (const side of [-1, 1]) {
    for (let i = 0; i < 6; i++) {
      const Z = -500 - i * 700;
      const p = project(cam, TH.cx + side * 1470, 360 - i * 60, Z);
      if (p[3] < 80) continue;
      const s = p[2];
      // a small shade on a bracket
      fillPoly(ctx, [[p[0] - 14 * s, p[1] + 10 * s], [p[0] + 14 * s, p[1] + 10 * s], [p[0] + 8 * s, p[1] - 10 * s], [p[0] - 8 * s, p[1] - 10 * s]], '#8a8070', 1);
      fillPoly(ctx, [[p[0] - 2 * s, p[1] + 10 * s], [p[0] + 2 * s, p[1] + 10 * s], [p[0] + 2 * s, p[1] + 40 * s], [p[0] - 2 * s, p[1] + 40 * s]], '#3a3530', 1);
    }
  }
}

// Sconces along the side walls: small warm lamps. Returns 'glow' lights in
// screen space for stage().
export function sconces(cam, k = 1) {
  const out = [];
  for (const side of [-1, 1]) {
    for (let i = 0; i < 6; i++) {
      const Z = -500 - i * 700;
      const p = project(cam, TH.cx + side * 1470, 360 - i * 60, Z);
      if (p[3] < 80) continue;
      out.push({ type: 'glow', x: p[0], y: p[1], r: 46 * p[2], k: 0.5 * k });
    }
  }
  return out;
}

function seatBack(ctx, x, y, s) {
  // the top of the seat back, just below the shoulders
  const w = 34 * s;
  const top = y + 38 * s;
  fillPoly(ctx, [[x - w, top + 6 * s], [x - w + 6 * s, top], [x + w - 6 * s, top], [x + w, top + 6 * s], [x + w, top + 60 * s], [x - w, top + 60 * s]], '#24211e', 1);
}

// One seated person from behind, head centre at (x, y), scale s.
// o: {h (0..1 picks the hair), tilt, alpha, rimList, rim}
export function person(ctx, x, y, s, o = {}) {
  const h = o.h ?? 0.5;
  const r = (19 + h * 4) * s;
  const tilt = o.tilt ?? 0;
  const a = o.alpha ?? 1;
  const hx = x + Math.sin(tilt) * 26 * s;
  const hy = y;
  // shoulders and back
  const sw = (40 + h * 10) * s;
  const sy = y + 34 * s;
  const body = [
    [x - sw, sy + 70 * s], [x - sw, sy + 14 * s], [x - sw + 8 * s, sy + 2 * s], [x - 12 * s, sy - 6 * s],
    [x + 12 * s, sy - 6 * s], [x + sw - 8 * s, sy + 2 * s], [x + sw, sy + 14 * s], [x + sw, sy + 70 * s],
  ];
  fillPoly(ctx, body, DARK, a);
  // neck
  fillPoly(ctx, [[hx - 8 * s, hy + r * 0.6], [hx + 8 * s, hy + r * 0.6], [x + 10 * s, sy], [x - 10 * s, sy]], DARK, a);
  // head and hair
  const hp = ellipsePts(hx, hy, r * 0.95, r, 0, TAU, 20);
  fillPoly(ctx, hp, DARK, a);
  const kind = Math.floor(h * 5);
  if (kind === 1) {
    // a bun
    fillPoly(ctx, ellipsePts(hx + Math.sin(tilt) * r * 0.4, hy - r * 0.95, r * 0.42, r * 0.36, 0, TAU, 12), DARK, a);
  } else if (kind === 2) {
    // longer hair falling to the shoulders
    fillPoly(ctx, [[hx - r * 0.95, hy], [hx + r * 0.95, hy], [hx + r * 1.02, hy + r * 1.5], [hx - r * 1.02, hy + r * 1.5]], DARK, a);
  } else if (kind === 3) {
    // a cap brim seen from behind
    fillPoly(ctx, [[hx - r * 1.0, hy - r * 0.15], [hx + r * 1.0, hy - r * 0.15], [hx + r * 0.9, hy - r * 0.35], [hx - r * 0.9, hy - r * 0.35]], DARK, a);
  }
  if (o.rimList && s > 0.18) {
    // the stage light catches the top of the head and the shoulders
    // big heads close to the camera get a finer, fainter rim
    const fine = clamp(1.25 - 0.33 * s, 0.22, 1);
    o.rimList.push({ pts: ellipsePts(hx, hy, r * 0.95, r, Math.PI * 1.15, Math.PI * 1.85, 10), w: Math.min(2.6, Math.max(1, 2.2 * s)), a: a * fine * (o.rim ?? 1) });
    if (s < 1.3) {
      o.rimList.push({ pts: [[x - sw + 6 * s, sy + 4 * s], [x - 14 * s, sy - 4 * s]], w: Math.max(1, 1.4 * s), a: a * 0.3 * (o.rim ?? 1) });
      o.rimList.push({ pts: [[x + 14 * s, sy - 4 * s], [x + sw - 6 * s, sy + 4 * s]], w: Math.max(1, 1.4 * s), a: a * 0.3 * (o.rim ?? 1) });
    }
  }
}

// Draw rim light strokes (after stage(), so the dark doesn't eat them).
// k: overall strength (stage light reaching the hall).
export function rims(ctx, list, k = 1) {
  if (k <= 0.01) return;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#efe7d6';
  for (const r of list) {
    ctx.globalAlpha = clamp(r.a * k * 0.55);
    ctx.lineWidth = r.w;
    ctx.beginPath();
    ctx.moveTo(r.pts[0][0], r.pts[0][1]);
    for (let i = 1; i < r.pts.length; i++) ctx.lineTo(r.pts[i][0], r.pts[i][1]);
    ctx.stroke();
  }
  ctx.restore();
}

// Dust floating in a beam: small specks drifting, drawn after stage().
// beam: {sx, sy, fx, fy, rx} in SCREEN space. k: strength.
export function dust(ctx, beam, t, k = 1, n = 60) {
  if (k <= 0.01) return;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#fffaf0';
  for (let i = 0; i < n; i++) {
    const u = (hash(i * 7.1) + t * (0.02 + hash(i * 3.3) * 0.03)) % 1; // height along the beam
    const v = hash(i * 11.7) * 2 - 1 + noise1(t * 0.3 + i, i) * 0.15; // across
    const y = lerp(beam.sy, beam.fy, u);
    const half = lerp(beam.rx * 0.12, beam.rx * 0.98, u);
    const x = lerp(beam.sx, beam.fx, u) + v * half;
    const tw = 0.5 + 0.5 * Math.sin(t * (1 + hash(i) * 2) + i);
    ctx.globalAlpha = k * (0.15 + 0.35 * tw) * Math.sin(Math.PI * u);
    ctx.beginPath();
    ctx.arc(x, y, (0.8 + hash(i * 5) * 1.6) * (beam.ds ?? 1), 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

