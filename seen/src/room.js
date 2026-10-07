// His room (s03 chasing the number, s04 shutting the laptop, s08 late at
// night making this film). Side view: he sits on a stool facing RIGHT, the
// laptop on the table in front of him, the door at the right, a window at
// the left. Same layout in every scene so the room reads as one place.
import { COL, clamp, hash, path, line, rect } from './lib.js';
import { figure, pose, reach, SIT, SIT_LIFT } from './figure.js';
import { table, stool, laptop, paperBall } from './props.js';
import { moon } from './sets.js';

export const ROOM = {
  floor: 800,
  s: 1.1, // his scale in the room
  tableX: 1100, // table centre
  hingeX: 1132, // laptop hinge
  stoolX: 935,
  door: { x: 1560, w: 190, h: 430 },
  win: { x: 330, y: 300, w: 230, h: 240 },
  pileX: 760, // the paper-ball pile, on the floor behind the stool
};

// Draw the room. o:
//   open   0..1 laptop lid (default 1)
//   door   0..1 how far the door is open (default 0)
//   moon   true: a moon in the window (s08)
//   balls  0..PILE.length paper balls in the pile (may be fractional: the
//          last one fades in)
//   alpha
// Returns { top, seat, lp (laptop info), doorLight (poly pts for stage(), or
// null), screenLight (a 'glow' light for stage() at the laptop screen) }.
export function room(ctx, t, o = {}) {
  const R = ROOM;
  const a = o.alpha;
  // floor and skirting
  path(ctx, [[-400, R.floor], [2400, R.floor]], { w: 3.6, alpha: a, seed: 8000, wobble: 0.6 });
  // window
  const wn = R.win;
  rect(ctx, wn.x, wn.y, wn.w, wn.h, { w: 4, alpha: a, seed: 8001 });
  line(ctx, wn.x + wn.w / 2, wn.y, wn.x + wn.w / 2, wn.y + wn.h, { w: 3, alpha: a, seed: 8002 });
  line(ctx, wn.x, wn.y + wn.h / 2, wn.x + wn.w, wn.y + wn.h / 2, { w: 3, alpha: a, seed: 8003 });
  path(ctx, [[wn.x - 14, wn.y + wn.h + 4], [wn.x + wn.w + 14, wn.y + wn.h + 4]], { w: 4, alpha: a, seed: 8004 });
  if (o.moon) moon(ctx, wn.x + wn.w * 0.72, wn.y + wn.h * 0.28, 22, { alpha: a });
  // door: frame + the panel swinging open toward the viewer (it gets narrower)
  const d = R.door;
  const dTop = R.floor - d.h;
  path(ctx, [[d.x, R.floor], [d.x, dTop], [d.x + d.w, dTop], [d.x + d.w, R.floor]], { w: 4, alpha: a, seed: 8005 });
  const op = clamp(o.door ?? 0);
  let doorLight = null;
  if (op > 0.01) {
    const pw = d.w * (1 - op * 0.82);
    path(ctx, [[d.x + d.w, R.floor], [d.x + d.w + 6 * op, dTop - 10 * op], [d.x + d.w - pw, dTop + 4], [d.x + d.w - pw, R.floor + 8 * op]], { w: 3.6, alpha: a, close: true, fill: COL.paper, seed: 8006, wobble: 0.4 });
    // the light from outside: the open part of the doorway plus a wedge on the floor
    const ox = d.x + d.w - pw;
    doorLight = [[d.x, dTop], [ox, dTop], [ox, R.floor], [ox - 40 - 380 * op, R.floor + 260], [d.x - 260 * op, R.floor + 260], [d.x, R.floor]];
  } else {
    dot2(ctx, d.x + 22, R.floor - d.h * 0.48, a);
  }
  // furniture
  const top = table(ctx, R.tableX, R.floor, R.s, { seed: 8010, alpha: a });
  const seat = stool(ctx, R.stoolX, R.floor, R.s, { seed: 8020, alpha: a });
  const lp = laptop(ctx, R.hingeX, top, R.s, 1, o.open ?? 1, { seed: 8030, alpha: a, glow: o.glow });
  // paper pile
  const n = o.balls ?? 0;
  for (let i = 0; i < Math.min(PILE.length, Math.ceil(n)); i++) {
    const b = PILE[i];
    const k = clamp(n - i);
    paperBall(ctx, R.pileX + b[0], R.floor - b[1] - 1, b[2], i, { alpha: (a ?? 1) * k });
  }
  const sc = lp.screen;
  return {
    top, seat, lp, doorLight,
    screenLight: { type: 'glow', x: sc[0] - 30, y: sc[1] - 10, r: 300, k: clamp((o.open ?? 1) * 1.6 - 0.4) * (o.glow ?? 1) },
  };
}

function dot2(ctx, x, y, a) {
  path(ctx, [[x, y], [x + 10, y]], { w: 5, alpha: a, seed: 8007, wobble: 0 });
}

// A mound of paper balls: [dx, height above floor of the centre, r].
// Filled bottom row first, so any count looks like a heap.
export const PILE = (() => {
  const out = [];
  const rows = [9, 7, 6, 4, 3, 2, 1];
  let y = 0;
  rows.forEach((n, ri) => {
    const r = 17 - ri * 0.6;
    y += ri === 0 ? r : r * 1.55;
    const w = (n - 1) * r * 1.8;
    for (let i = 0; i < n; i++) {
      const dx = -w / 2 + i * r * 1.8 + (hash(ri * 13 + i) - 0.5) * 8;
      out.push([dx, y + (hash(ri * 7 + i * 3) - 0.5) * 5, r * (0.88 + 0.24 * hash(ri * 5 + i))]);
    }
  });
  // bottom row from the middle outward so a small pile is centred
  const first = out.slice(0, 9).sort((p, q) => Math.abs(p[0]) - Math.abs(q[0]));
  return [...first, ...out.slice(9)];
})();

// HIM sitting on the stool at the laptop, side view, hands on the keyboard.
// o: lean (default 0.12), head, look, mouth, and any pose overrides in o.p.
// Hands are placed with reach(); o.hands: false leaves the arms to o.p.
export function sitter(ctx, t, seat, top, o = {}) {
  const R = ROOM;
  const s = R.s;
  const p = pose({ ...SIT, x: R.stoolX + 4, y: seat - SIT_LIFT * s, s, f: 1, lean: o.lean ?? 0.12, head: o.head ?? 0, look: o.look ?? 0, ...(o.p ?? {}) });
  if (o.hands !== false) {
    const type = o.type ?? 0; // 0..1 typing speed
    const tA = Math.sin(t * 19) * 3 * type;
    const tB = Math.sin(t * 23 + 1) * 3 * type;
    const kx = R.hingeX - 88 * s;
    const rA = reach(p, 'A', kx + 6 + (o.handDX ?? 0), top - 8 * s + tA);
    const rB = reach(p, 'B', kx + 22 + (o.handDX ?? 0), top - 8 * s + tB);
    p.aA1 = rA.a1;
    p.aA2 = rA.a2;
    p.aB1 = rB.a1;
    p.aB2 = rB.a2;
  }
  return figure(ctx, p, { id: 1, cowlick: true, mouth: o.mouth, alpha: o.alpha });
}

