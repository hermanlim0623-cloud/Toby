// The grade: what turns a correct 3D scene into a photographed one.
//
// Bloom, and only bloom. The god rays and the marine snow are small, bright
// things in a very dark frame; without bloom they stay small and bright and
// read as pixels, and with it they spill into the water around them, which is
// what light actually does underwater and what makes the shafts feel like
// volume rather than texture.
//
// Two effects were built and then removed, both for reasons worth keeping:
//
//   depth of field       `dof()` renders the entire frame black on the WebGL2
//                        backend, with or without sane parameters, and that
//                        backend is the fallback a large share of visitors
//                        get. An effect that cannot be verified on the path
//                        most likely to run it is not worth a black hero.
//   chromatic aberration Correct, cheap, and actively harmful here. It splits
//                        every marine-snow particle — one to three pixels,
//                        additive — into red and green fringes, so the water
//                        fills with coloured speckle that reads as broken
//                        pixels. The edge softening it buys is invisible next
//                        to that.
//
// The low tier gets no grade at all: on a device already struggling, a sharp
// scene at a good frame rate beats a graded one that stutters.
import { PostProcessing } from 'three/webgpu';
import { pass } from 'three/tsl';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';

/** Which tiers can afford the grade. */
const GRADED = { low: false, mid: true, high: true };

export function createPost({ renderer, scene, camera, tier }) {
  if (!GRADED[tier]) return null;

  const post = new PostProcessing(renderer);
  const scenePass = pass(scene, camera);
  const color = scenePass.getTextureNode();

  // The threshold has to sit above the water, not above zero. Almost the
  // whole frame is a dim blue field, so a threshold low enough to "catch the
  // dark scene" catches all of it and returns a flat, washed sheet of cyan
  // instead of glow. Only the shafts and the snow should cross it.
  post.outputNode = color.add(bloom(color, 0.35, 0.8, 0.55));

  return {
    render() { post.render(); },
    dispose() { post.dispose?.(); },
  };
}
