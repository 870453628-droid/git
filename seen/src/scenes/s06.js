// s06 · 92–108 · 光落下来 — a light lands on him
// The same take as s05 (hard cut on an identical frame): night has come, the
// camera has risen into a wide, still frame with a lot of dark above him; he
// works in the small light of his screen.
//  92.8  BANG — the spotlight slams down on him from above (s01's jolt and
//        flash): he freezes, hands jerk off the keys; lifts his head into the
//        light; smiles; shuts his eyes and basks, swaying a little, while the
//        camera creeps in.
//  96.6  我很开心，又有点怕: the smile stops. He looks up at the light, back
//        over his shoulder at the window (is anyone there?), up again; his
//        hands go to his lap, he shrinks back — and the camera keeps
//        pushing in until his face fills the frame.
//  99.85 the light goes out on that face. Cut: a still wide shot of the dark
//        room. He straightens, puts his hands back on the keys and from now
//        on they never stop. The light comes back brighter (he looks up,
//        smiles), goes out (head down), comes back brighter still (up, a big
//        smile), sinks slowly (his face falls) and settles at half strength
//        (he glances up, a small calm smile, back to work) — his face follows
//        every change, his hands follow none. Little pictures keep popping up
//        over his head at the same even beat the whole time.
//  108   he works on at the table under ROOM_SPOT at ~0.7, calm (s07 opens
//        on this).
import { ease } from '../lib.js';
import { ROOM_SPOT } from '../room.js';
import { TAKE5, roomTake, whipE } from './s05.js';

const T0 = 92;
const E = ease;
const LIN = E.linear;
const BANG = 92.8;
const OUT = 99.85; // the light goes out on his face
const CUT = 100.15; // the wide shot
const SPOT = (k, rx = ROOM_SPOT.rx, ry = ROOM_SPOT.ry) => ({ k, rx, ry });

export const TAKE6 = {
  ...TAKE5,
  cam: [
    ...TAKE5.cam,
    [93.3, { x: 990, y: 482, z: 1.1 }],
    [96.5, { x: 976, y: 528, z: 1.36 }, E.sine],
    [OUT, { x: 978, y: 590, z: 3.0 }, E.inOut],
    [CUT - 0.001, { x: 978, y: 590, z: 3.0 }],
    [CUT, { x: 1004, y: 505, z: 1.12 }, LIN],
    [106.4, { x: 1004, y: 505, z: 1.12 }],
    [108.6, { x: 996, y: 516, z: 1.2 }, E.sine],
  ],
  whips: [...TAKE5.whips],
  spot: [
    [BANG - 0.001, SPOT(0)],
    [BANG, SPOT(1), LIN],
    [OUT - 0.001, SPOT(1)],
    [OUT, SPOT(0), LIN],
    [101.2 - 0.001, SPOT(0, 172, 30)],
    [101.2, SPOT(1.12, 172, 30), LIN],
    [102.6, SPOT(1.12, 172, 30)],
    [102.72, SPOT(0, 172, 30), E.out],
    [103.6 - 0.001, SPOT(0, 188, 32)],
    [103.6, SPOT(1.32, 188, 32), LIN],
    [104.8, SPOT(1.32, 188, 32)],
    [105.5, SPOT(0.3, 170, 29), E.inOut],
    [106.05, SPOT(0.3, 170, 29)],
    [106.55, SPOT(0.72), E.inOut],
  ],
  flashes: [
    { t: BANG, a: 0.75, jolt: 1 },
    { t: 101.2, a: 0.3 },
    { t: 103.6, a: 0.5, jolt: 0.4 },
  ],
  type: [...TAKE5.type, [BANG - 0.001, 1], [BANG, 0, LIN], [100.6, 0], [100.85, 1]],
  lift: [...TAKE5.lift, [BANG, 0], [92.95, 0.42, E.out], [95.0, 0.42], [95.6, 0.3], [98.95, 0.3], [99.6, 0.1], [100.5, 0.1], [100.8, 0]],
  lap: [[0, 0], [98.95, 0], [99.75, 1], [100.4, 1], [100.8, 0]],
  lean: [...TAKE5.lean, [BANG, 0.14], [92.92, 0.06, E.out], [93.3, 0.05], [93.8, 0.02], [96.6, 0.02], [97.8, 0.04], [99.0, 0.06], [99.75, -0.08], [100.4, -0.08], [100.8, 0.13]],
  nod: [...TAKE5.nod, [BANG, 0.14], [93.15, 0.1], [93.7, -0.34], [96.6, -0.34], [97.8, -0.26], [98.1, -0.1], [98.4, -0.16], [98.8, -0.12], [99.05, -0.3], [99.3, -0.3], [99.75, 0.3], [100.4, 0.3], [100.8, 0.18], [101.35, 0.18], [101.7, -0.22], [102.75, -0.22], [103.15, 0.3], [103.75, 0.3], [104.05, -0.3], [104.9, -0.3], [105.5, 0.25], [106.25, 0.25], [106.55, -0.08], [106.95, -0.08], [107.35, 0.1]],
  look: [...TAKE5.look, [BANG, 0.5], [93.15, 0.3], [93.6, -1], [96.6, -1], [97.8, -0.75], [98.15, -0.3], [98.4, -0.2], [98.8, -0.2], [99.05, -0.8], [99.3, -0.8], [99.75, 0.9], [100.4, 0.9], [100.8, 0.5], [101.35, 0.5], [101.7, -0.8], [102.75, -0.8], [103.15, 0.8], [103.75, 0.8], [104.05, -1], [104.9, -1], [105.5, 0.75], [106.25, 0.75], [106.55, -0.4], [106.95, -0.4], [107.35, 0.45]],
  back: [...TAKE5.back, [98.1, 0], [98.42, 1.62], [98.8, 1.62], [99.06, 0]],
  mouth: [...TAKE5.mouth, [BANG, 0.35], [93.0, 0.0], [93.9, 0.2], [94.4, 1.0], [97.6, 1.0], [98.0, 0.1], [98.4, -0.2], [99.75, -0.4], [100.4, -0.4], [101.0, -0.2], [101.35, -0.2], [101.75, 0.8], [102.75, 0.8], [103.15, -0.35], [103.75, -0.35], [104.1, 1.0], [104.9, 1.0], [105.5, -0.3], [106.25, -0.3], [106.6, 0.25], [107.4, 0.35]],
  shut: [...TAKE5.shut, [92.84, 92.98], [94.95, 95.95], [97.3, 97.4], [100.5, 100.62], [107.7, 107.8]],
  // the last moments settle into the frame s07 picks up (its room shot
  // repeats room.js sitter()'s patter and the screen's round glow)
  soft: [[107.2, 0], [107.7, 1]],
  // basking: a slow sway
  sway: (t) => (t > 94.4 && t < 97.2 ? Math.sin((t - 94.4) * 2.2) * 0.03 * Math.sin(Math.PI * ((t - 94.4) / 2.8)) : 0),
  pics: [
    ...TAKE5.pics,
    { kind: 'tree', t: 101.0, x: 872, y: 404 },
    { kind: 'house', t: 102.4, x: 1070, y: 366 },
    { kind: 'bird', t: 103.8, x: 890, y: 300 },
    { kind: 'boat', t: 105.2, x: 1076, y: 440 },
    { kind: 'walker', t: 106.4, x: 872, y: 400, dur: 1.6 },
  ],
};

export default {
  fadeIn: 0,
  draw(ctx, lt) {
    const t = T0 + Math.max(0, Math.min(lt, 16.6));
    roomTake(ctx, t, TAKE6);
  },
};

export { whipE };
