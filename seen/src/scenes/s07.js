// s07 · 64–77 · 我不想再否认了。/ 想被看见，也怕孤单。/ 可就算没人看，路还是要走。
// The same take as s06 (no cut): he lifts his head out of the stillness and
// smiles at her; he doesn't step out of the little light — he walks on, and
// it comes with him. At a fork in the road she stops, turns, waves; he waves
// back; she goes off up the other road. The light at his feet fades as she
// grows small. The camera pulls slowly back: a long road, the light coming
// up over the horizon ahead, and him, small, walking on at an even pace.
//
// Everything lives in s06.js (take()); see there.
import { take } from './s06.js';

export default {
  fadeIn: 0,
  draw(ctx, lt, info) {
    take(ctx, info.start + Math.max(0, lt));
  },
};
