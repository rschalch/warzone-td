// Renders the sound-effect bank off the main thread (see dsp.ts) and streams each sound back as it is done.

import { RECIPES } from './dsp';

self.onmessage = () => {
  for (const [name, r] of Object.entries(RECIPES)) {
    const data: Float32Array[] = [];
    for (let v = 0; v < r.variants; v++) data.push(r.render());
    (self as unknown as Worker).postMessage({ name, data }, data.map((d) => d.buffer));
  }
};
