// s01 · 0–16 · the theatre
// Black. BANG — a spotlight slams down on a small stick-figure child in the
// middle of a stage; he throws up an arm against the glare. Close: he lowers
// it, looks up into the light, smiles. Then one long, slow pull-back: out
// past the drapes and the footlights and over row after row of people — all
// watching him, quietly — until we sit in the last row with them, the boy a
// small bright point far away. 我喜欢被看见: back on stage, arms open, face
// up, he basks. The light closes to a point and goes out; the title.
//
// Exports the stage set-up for s02 and s07 (READ-ONLY for them).
import { W, H, clamp, lerp, smooth, keys, ease, noise1, camera, text, path } from '../lib.js';
import { figure, pose, standY } from '../figure.js';
import { stage } from '../light.js';
import { TH, stageCam, project, stagePlane, auditorium, sconces, rims, dust, hallDark, haze } from '../theatre.js';

const BANG = 1.4;
// the spot hangs high in front of the stage; its pool just fits the child
export const SPOT = { sx: TH.cx, sy: -420, fx: TH.cx, fy: TH.floor, rx: 64, ry: 14 };

// screen-space version of a stage-plane light for camera cam
export function spotOnScreen(cam, L, k) {
  const a = project(cam, L.sx, L.sy, 0);
  const b = project(cam, L.fx, L.fy, 0);
  return { type: 'spot', sx: a[0], sy: a[1], fx: b[0], fy: b[1], rx: L.rx * b[2], ry: L.ry * b[2], k };
}

// the glow that the stage throws back into the hall (screen space)
export function stageWash(cam, k) {
  const p = project(cam, TH.cx, TH.floor - 120, 0);
  return { type: 'glow', x: p[0], y: p[1], r: 1500 * p[2], k: 0.32 * k };
}

// camera keys (C = distance from the stage plane)
const CLOSE = { x: TH.cx, y: 604, C: 300 };
const FAR = { x: TH.cx, y: 322, C: 4300 };
function cameraAt(t) {
  if (t < 10) {
    const k = smooth(t, 4.6, 10.0, (u) => 0.5 - 0.5 * Math.cos(Math.PI * u));
    // log-space dolly so the speed feels even
    const C = CLOSE.C * Math.pow(FAR.C / CLOSE.C, k);
    const ky = clamp((C - CLOSE.C) / (FAR.C - CLOSE.C));
    return { x: TH.cx, y: lerp(CLOSE.y, FAR.y, Math.pow(ky, 0.6)), C };
  }
  // 我喜欢被看见: a medium shot, pushing in slowly
  const C = lerp(600, 470, smooth(t, 10, 13.5, ease.sine));
  return { x: TH.cx, y: lerp(596, 606, smooth(t, 10, 13.5)), C };
}

function boyPose(t) {
  const s = TH.boyS;
  const base = { x: TH.cx, y: standY(TH.floor, s), s, view: 'front', lA1: 0.07, lB1: 0.07, aA1: 0.18, aA2: 0.1, aB1: 0.18, aB2: 0.1 };
  // the glare: his near arm flies up across his eyes, then comes down
  // forearm flat across the brow, in front of the eyes
  const shield = { aA1: 2.45, aA2: -3.95, head: 0.08, look: 0.6 };
  const arms0 = { aA1: 0.18, aA2: 0.1 };
  const sh = keys(t, [[BANG, 0], [BANG + 0.12, 1], [2.5, 1], [3.1, 0]], ease.out);
  // palms opening a little, feeling the light
  const feel = smooth(t, 3.6, 4.4) * (1 - smooth(t, 9.2, 10));
  // 我喜欢被看见: arms open wide, face up
  const open = smooth(t, 10.05, 10.9, ease.out);
  const p = pose({ ...base });
  p.aA1 = lerp(lerp(arms0.aA1, shield.aA1, sh), 0.55, feel);
  p.aA2 = lerp(lerp(arms0.aA2, shield.aA2, sh), -0.35, feel);
  p.aB1 = lerp(0.18 + 0.12 * sh, 0.55, feel);
  p.aB2 = lerp(0.1, -0.35, feel);
  p.aA1 = lerp(p.aA1, 1.95, open);
  p.aB1 = lerp(p.aB1, 1.95, open);
  p.aA2 = lerp(p.aA2, 0.18, open);
  p.aB2 = lerp(p.aB2, 0.18, open);
  // looking: into the glare, up at the light, out at the hall
  p.look = keys(t, [[0, 0], [BANG, 0.6], [2.5, 0.6], [3.0, -1], [5.6, -1], [6.4, 0], [10, 0], [10.6, -1]]);
  p.head = keys(t, [[0, 0], [BANG, 0.1], [2.5, 0.1], [3.1, -0.06], [5.6, -0.06], [6.4, 0], [10, 0], [10.7, -0.12]]) + noise1(t * 0.4, 3) * 0.03;
  p.turn = keys(t, [[6.4, 0], [7.2, -0.6], [8.2, -0.6], [9.0, 0.6], [9.8, 0]]);
  // a slow sway while he basks
  p.lean = open * Math.sin((t - 10) * 1.6) * 0.06;
  return p;
}

function boyFace(t) {
  return {
    mouth: keys(t, [[0, 0], [BANG, -0.2], [2.9, -0.2], [3.5, 1], [10, 1]]),
    eye: t > 10.9 && t < 12.6 ? 'closed' : 'dot',
  };
}

// spot strength, size; the close at the end
function spotState(t) {
  if (t < BANG) return { k: 0, rx: SPOT.rx };
  const shrink = smooth(t, 12.5, 13.5, ease.in);
  const k = t > 13.55 ? 0 : 1;
  return { k, rx: lerp(SPOT.rx, 4, shrink), ry: lerp(SPOT.ry, 1.5, shrink) };
}

export default {
  fadeOut: 0,
  draw(ctx, lt) {
    const t = Math.max(0, lt);
    const cam = cameraAt(t);
    const sp = spotState(t);
    // BANG: a jolt of the whole frame for a few frames
    const jolt = t > BANG ? Math.exp(-(t - BANG) / 0.09) : 0;
    ctx.save();
    if (jolt > 0.01) ctx.translate(noise1(t * 60, 1) * 14 * jolt, noise1(t * 60, 2) * 10 * jolt);

    hallDark(ctx);
    camera(ctx, stageCam(cam), () => {
      stagePlane(ctx, t);
      const s = boyFace(t);
      const p = boyPose(t);
      const j = figure(ctx, p, { id: 1, cowlick: true, mouth: s.mouth, eye: s.eye });
      // the shielding forearm goes in front of his face
      if (p.aA1 > 1.4) path(ctx, [j.elbowA, j.handA], { w: Math.max(2, 4.6 * Math.pow(p.s, 0.85)), seed: 41 + 5, wobble: 1.1 });
    });
    // the hall
    const hall = clamp((cam.C - 500) / 900);
    haze(ctx, cam, spotState(t).k * lerp(0.25, 1, smooth(t, 4.8, 8.5)) * (1 - smooth(t, 12.4, 13.4)));
    const rimList = auditorium(ctx, cam, t, {
      lean: (seat, row) => (seat.h > 0.82 && row.k % 3 === 1 ? 0.18 * smooth(t, 7, 8) : 0),
      rim: 1,
    });
    // lights (screen space)
    const lights = [];
    if (sp.k > 0) {
      lights.push(spotOnScreen(cam, { ...SPOT, rx: sp.rx, ry: sp.ry }, sp.k));
      // the hall's glow comes up as we pull back; close up only the beam lights him
      lights.push(stageWash(cam, sp.k * lerp(0.12, 1, smooth(t, 4.8, 8.5)) * (1 - smooth(t, 12.4, 13.4))));
      lights.push(...sconces(cam, hall * sp.k * 0.8));
    }
    stage(ctx, lights, { dark: t < BANG ? 1 : lerp(0.9, 0.86, hall), beams: 1 });
    // rim light on the audience, and dust in the beam
    rims(ctx, rimList, sp.k * (1 - smooth(t, 12.4, 13.2)));
    if (sp.k > 0) {
      const b = spotOnScreen(cam, { ...SPOT, rx: sp.rx, ry: sp.ry }, 1);
      dust(ctx, { sx: b.sx, sy: b.sy, fx: b.fx, fy: b.fy, rx: b.rx, ds: Math.min(3, F_DS(cam)) }, t, 0.9, 70);
    }
    ctx.restore();

    // the flash of the bang
    if (t > BANG && t < BANG + 0.6) {
      const f = Math.exp(-(t - BANG) / 0.07);
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalCompositeOperation = 'lighter';
      const p = project(cam, TH.cx, TH.floor - 80, 0);
      const g = ctx.createRadialGradient(p[0], p[1], 0, p[0], p[1], 900);
      g.addColorStop(0, `rgba(255,250,236,${0.75 * f})`);
      g.addColorStop(1, 'rgba(255,250,236,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }

    // the title, in the dark
    const ta = Math.min(smooth(t, 13.5, 14.4), 1 - smooth(t, 15.2, 16.0));
    if (ta > 0.001) {
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      const str = '我还是想被看见';
      const chars = [...str];
      const size = 104;
      const gap = 128;
      const x0 = W / 2 - ((chars.length - 1) * gap) / 2;
      chars.forEach((ch, i) => {
        const a = ta * smooth(t, 13.4 + i * 0.09, 13.9 + i * 0.09);
        ctx.shadowColor = 'rgba(255,248,230,0.5)';
        ctx.shadowBlur = 26;
        text(ctx, ch, x0 + i * gap, H / 2 - 20, { size, color: '#efe8da', alpha: a });
      });
      ctx.restore();
    }
  },
};

// dust speck size follows the camera so close up the specks are larger
function F_DS(cam) {
  return Math.max(0.6, 1000 / cam.C);
}

