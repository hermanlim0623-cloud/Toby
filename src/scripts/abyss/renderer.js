// Renderer bootstrap for the procedural dive.
//
// Three's WebGPURenderer is used for both backends on purpose: when WebGPU
// is unavailable it falls back to its own WebGL2 backend, and because the
// whole scene is authored in TSL (not raw GLSL/WGSL) the *same* node graph
// compiles to both. That is what makes one shader source viable here —
// hand-written GLSL would have needed a second WGSL copy to get WebGPU.
import { WebGPURenderer } from 'three/webgpu';

/**
 * Device tiers. The scene reads this to decide raymarch step counts and
 * particle budgets — the old code branched on `innerWidth < 760`, which
 * says nothing about the GPU actually in the machine.
 * @typedef {'low'|'mid'|'high'} Tier
 */

/** @returns {Tier} */
export function detectTier({ lowPower } = {}) {
  if (lowPower) return 'low';
  const mem = navigator.deviceMemory ?? 8;
  const cores = navigator.hardwareConcurrency ?? 4;
  if (mem <= 4 || cores <= 4) return 'low';
  if (mem <= 8 || cores <= 8) return 'mid';
  return 'high';
}

/**
 * Whether the only backend available is a software rasteriser.
 *
 * This matters more than it sounds. A CPU rasteriser will happily accept a
 * fullscreen raymarch and then present it at a fraction of a frame per
 * second — it does not fail, it just produces a page that never repaints,
 * and because rAF is starved along with everything else, the page's own
 * escape hatches (the adaptive sampler here, the preloader's timeout) tick
 * at that same useless rate. Asking first and never starting is the only
 * answer that works.
 *
 * This is a real configuration, not a theoretical one: virtual machines,
 * remote desktops, blocklisted drivers, and headless CI all land here.
 *
 * The question is answered by WebGL2's renderer string even when WebGPU is
 * present, and that is deliberate: a `navigator.gpu` that exists is NOT
 * evidence of real hardware — headless Chromium exposes one backed by the
 * same software adapter — so trusting it skips the check exactly where the
 * check was needed. The GL renderer string is instead read as the honest
 * question underneath: is there a real GPU in this machine at all? If there
 * is not, WebGPU on it is software too.
 */
export function isSoftwareRenderer() {
  const probe = document.createElement('canvas');
  const gl = probe.getContext('webgl2');
  // No WebGL2 at all, but WebGPU present: nothing here can answer the
  // question, so let the frame-time path handle it rather than guessing.
  if (!gl) return !navigator.gpu;
  const ext = gl.getExtension('WEBGL_debug_renderer_info');
  const name = String(
    ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
  );
  // Release the probe context immediately — browsers cap how many a document
  // may hold, and the real renderer still needs one.
  gl.getExtension('WEBGL_lose_context')?.loseContext();
  return /swiftshader|llvmpipe|softpipe|software|basic render/i.test(name);
}

/** Pixel ratio ceiling per tier — the dominant cost in a fullscreen raymarch. */
const DPR_CAP = { low: 1, mid: 1.35, high: 1.75 };

/**
 * Creates the renderer and returns it plus the teardown. Resolves only once
 * `init()` has completed, so callers can treat "resolved" as "the backend is
 * real and usable" rather than having to probe for it later.
 *
 * @param {HTMLCanvasElement} canvas
 * @param {{ tier: Tier }} opts
 */
export async function createRenderer(canvas, { tier }) {
  const renderer = new WebGPURenderer({
    canvas,
    antialias: false, // the volumetric pass has no hard edges to alias
    alpha: false,
    powerPreference: 'high-performance',
    // forceWebGL is left off: let Three pick WebGPU when the browser has it.
  });

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, DPR_CAP[tier]));
  renderer.setSize(window.innerWidth, window.innerHeight, false);

  // init() is what compiles the backend and is the honest "ready" signal —
  // constructing the renderer alone does not guarantee a working context.
  await renderer.init();

  return renderer;
}

/**
 * Adaptive quality: watches real frame time, walks the pixel ratio down when
 * the GPU can't hold the budget and back up when it comfortably can — and
 * gives up entirely when even the floor is hopeless.
 *
 * The normal path is deliberately hysteretic. A single slow frame is noise —
 * GC, a compositor hiccup, another tab — and reacting to it makes the
 * resolution visibly pump, so only a sustained run in one direction moves
 * the ratio, each move followed by a cooldown.
 *
 * That patience is wrong for a machine that is drowning, though. A software
 * rasteriser (a VM, a remote desktop, a blocklisted GPU) renders this scene
 * at a fraction of a frame per second, and waiting out a 45-frame run there
 * means minutes of a frozen page. So catastrophic frames skip the run and
 * the cooldown, and once the floor cannot save it either, `sample` reports
 * `abandon` and the caller falls back to the static gradient — a still
 * image being far better than a page that never repaints.
 */
export function createAdaptiveQuality(renderer, { tier }) {
  const ceiling = Math.min(window.devicePixelRatio || 1, DPR_CAP[tier]);
  const floor = 0.5;
  const BUDGET_MS = 1000 / 55; // aim to hold ~55fps before shedding pixels
  const COMFORT_MS = 1000 / 90; // only climb back when there's real headroom
  const PANIC_MS = 120; // ~8fps: past this, patience is the wrong instinct
  const HOPELESS_MS = 400; // no run required — one such frame is not noise
  const RUN = 45; // frames of agreement required before acting normally
  const PANIC_RUN = 3;
  const COOLDOWN = 90;
  // The first frames after a shader compile are legitimately slow (driver
  // warm-up, first upload) and must not be mistaken for a slow device.
  const WARMUP = 2;

  let current = ceiling;
  let slow = 0;
  let fast = 0;
  let panic = 0;
  let cooldown = 0;
  let seen = 0;

  function apply(next) {
    current = next;
    slow = 0;
    fast = 0;
    panic = 0;
    renderer.setPixelRatio(current);
    renderer.setSize(window.innerWidth, window.innerHeight, false);
  }

  return {
    /**
     * @param {number} dt milliseconds for the frame just rendered
     * @returns {'ok'|'abandon'}
     */
    sample(dt) {
      seen += 1;
      if (seen <= WARMUP) return 'ok';

      // Hopeless frames are judged one at a time, because on a machine this
      // slow *frames are the scarce resource*: requiring three of them to
      // agree can take a minute of wall clock to establish something the
      // first one already proved.
      if (dt > HOPELESS_MS) {
        if (current > floor) {
          // Halve rather than step down: something is badly wrong, and
          // walking down in 0.2 increments just spends more frozen frames
          // arriving at the same place.
          apply(Math.max(floor, current * 0.5));
          return 'ok';
        }
        return 'abandon';
      }

      if (dt > PANIC_MS) {
        panic += 1;
        if (panic >= PANIC_RUN && current > floor) {
          apply(Math.max(floor, current * 0.5));
          cooldown = PANIC_RUN;
        }
        return 'ok';
      }
      panic = 0;

      if (cooldown > 0) { cooldown -= 1; return 'ok'; }

      if (dt > BUDGET_MS) { slow += 1; fast = 0; } else if (dt < COMFORT_MS) { fast += 1; slow = 0; } else { slow = 0; fast = 0; }

      if (slow >= RUN && current > floor) {
        apply(Math.max(floor, current - 0.2));
      } else if (fast >= RUN && current < ceiling) {
        apply(Math.min(ceiling, current + 0.2));
      } else {
        return 'ok';
      }

      cooldown = COOLDOWN;
      return 'ok';
    },
    get pixelRatio() { return current; },
  };
}
