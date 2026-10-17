// Bakes a share of the models off the main thread; see bakeAll() in atlas.ts.

import { bakeModel, type BakedFrame } from './bake';

self.onmessage = (e: MessageEvent<string[]>) => {
  const frames: BakedFrame[] = e.data.flatMap(bakeModel).map((f) => ({ ...f, image: (f.image as OffscreenCanvas).transferToImageBitmap() }));
  (self as unknown as Worker).postMessage(frames, frames.map((f) => f.image as ImageBitmap));
};
