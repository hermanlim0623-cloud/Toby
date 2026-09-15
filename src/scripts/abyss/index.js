// Scroll -> depth controller for the procedural dive.
//
// This replaces the old video cinema controller, and the interesting part is
// what is *gone*. Driving a <video> playhead meant an all-intra encode, a
// single-seek-in-flight policy, decoder priming for WebKit, and a 5.6MB
// download that could still judder on a fast scroll. A generated scene has
// no playhead: scroll maps to a float, the float goes to the GPU, and every
// frame is reachable at the same cost. There is nothing left to seek.
import { createRenderer, createAdaptiveQuality, detectTier, isSoftwareRenderer } from './renderer.js';
import { createAbyssScene } from './scene.js';

// Per-frame easing at 60fps, scaled by real delta time below so the feel is
// identical on 60Hz, 90Hz and 120Hz displays. Carried over from the video
// controller — the reasoning was sound, only the thing being eased changed.
const EASE_PER_FRAME = 0.12;

function scrollProgress() {
  const range = document.documentElement.scrollHeight - window.innerHeight;
  if (range <= 0) return 0;
  return Math.min(Math.max(window.scrollY / range, 0), 1);
}

/**
 * @param {{ prefersReducedMotion: boolean, lowPower: boolean }} opts
 * @returns {{ ready: Promise<boolean>, destroy(): void }}
 *   `ready` resolves true once the scene has presented a real first frame,
 *   or false if this device cannot render it. The preloader gates its
 *   curtain on exactly this, which is why it resolves rather than rejects:
 *   a failed backend is a supported outcome, not an error path.
 */
export function createAbyss({ prefersReducedMotion, lowPower } = {}) {
  const stage = document.querySelector('[data-cinema]');
  const canvas = stage?.querySelector('[data-cinema-gl]');
  if (!stage || !canvas) return { ready: Promise.resolve(false), destroy() {} };

  const tier = detectTier({ lowPower });
  let disposed = false;
  let raf = null;
  let renderer = null;
  let sceneBits = null;

  // Pointer parallax targets, eased toward on the ticker.
  let pointerX = 0, pointerY = 0;
  let parX = 0, parY = 0;

  let smoothedDepth = 0;
  let lastFrame = performance.now();
  let surfaceRush = 0;

  // A backgrounded tab throttles rAF to nothing, so the first frame after it
  // comes back carries a gap of seconds. That gap says nothing about the GPU
  // — it is the only way a healthy machine produces a frame time that looks
  // identical to a hopeless one — so the resume frame is withheld from the
  // quality sampler rather than being allowed to shed resolution or, worse,
  // tear the scene down on a device that was never struggling.
  let skipSamples = 0;
  function onVisibility() {
    if (document.visibilityState === 'visible') skipSamples = 2;
  }

  function onSurfaceRush(e) { surfaceRush = e.detail?.value ?? 0; }
  function onPointer(e) {
    pointerX = (e.clientX / window.innerWidth - 0.5) * 0.09;
    pointerY = (e.clientY / window.innerHeight - 0.5) * -0.09;
  }
  function onResize() {
    if (!renderer || !sceneBits) return;
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    sceneBits.uniforms.aspect.value = window.innerWidth / window.innerHeight;
  }

  /** No WebGPU and no WebGL2: the stylesheet's static gradient is the dive. */
  function degrade() {
    stage.classList.add('is-unsupported');
    document.documentElement.classList.add('no-abyss');
  }

  const ready = (async () => {
    // Asked before anything is built. A software rasteriser can render this
    // scene, just not at a rate anyone would call animation — so the honest
    // move is to not start, rather than to start and be torn down a few
    // multi-second frames later with the visitor watching.
    if (isSoftwareRenderer()) {
      degrade();
      return false;
    }
    try {
      renderer = await createRenderer(canvas, { tier });
    } catch {
      degrade();
      return false;
    }
    if (disposed) { renderer.dispose?.(); return false; }

    sceneBits = createAbyssScene({ tier, prefersReducedMotion });
    sceneBits.uniforms.aspect.value = window.innerWidth / window.innerHeight;
    sceneBits.uniforms.depth.value = scrollProgress();

    const quality = createAdaptiveQuality(renderer, { tier });

    // Compile before the first renderAsync so the shader cost lands here,
    // inside the preloader's blocking window, instead of as a multi-hundred
    // millisecond stall on the first frame the visitor is actually watching.
    try {
      await renderer.compileAsync(sceneBits.scene, sceneBits.camera);
      await renderer.renderAsync(sceneBits.scene, sceneBits.camera);
    } catch {
      degrade();
      return false;
    }
    if (disposed) return false;

    stage.classList.add('is-live');

    window.addEventListener('cinema:surface-rush', onSurfaceRush);
    window.addEventListener('resize', onResize, { passive: true });
    document.addEventListener('visibilitychange', onVisibility);
    if (!prefersReducedMotion) window.addEventListener('pointermove', onPointer, { passive: true });

    function tick(now) {
      if (disposed) return;
      // Two different deltas, on purpose. `raw` is how long the previous
      // frame actually took to reach the screen and is the only honest
      // measure of load: GPU work is queued rather than awaited, so timing
      // our own callback would report a few idle milliseconds no matter how
      // badly the device was struggling. `dt` is the same figure clamped,
      // because a tab returning from the background must not teleport the
      // easing by however many seconds it spent hidden.
      const raw = now - lastFrame;
      const dt = Math.min(raw, 100);
      lastFrame = now;

      const target = scrollProgress();
      if (prefersReducedMotion) {
        smoothedDepth = target;
      } else {
        // Frame-rate-independent easing: the same visual response whatever
        // the display refresh rate is.
        const k = 1 - Math.pow(1 - EASE_PER_FRAME, dt / (1000 / 60));
        smoothedDepth += (target - smoothedDepth) * k;
        parX += (pointerX - parX) * k;
        parY += (pointerY - parY) * k;
      }

      const u = sceneBits.uniforms;
      u.depth.value = smoothedDepth;
      u.time.value = now / 1000;
      u.surfaceRush.value = surfaceRush;
      u.parallax.value.set(parX, parY);

      renderer.render(sceneBits.scene, sceneBits.camera);

      if (skipSamples > 0) skipSamples -= 1;
      else if (quality.sample(raw) === 'abandon') {
        // The device cannot present this scene at a watchable rate. Stop
        // rather than keep a frozen canvas up: the stylesheet's gradient is
        // a real image, and a still one beats a stuttering one.
        degrade();
        destroy();
        return;
      }
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);

    return true;
  })();

  function destroy() {
    disposed = true;
    cancelAnimationFrame(raf);
    window.removeEventListener('cinema:surface-rush', onSurfaceRush);
    window.removeEventListener('resize', onResize);
    window.removeEventListener('pointermove', onPointer);
    document.removeEventListener('visibilitychange', onVisibility);
    sceneBits?.dispose();
    renderer?.dispose?.();
  }

  return {
    ready,
    /**
     * The marine snow is deliberately not part of `ready`. The water column
     * on its own is a finished image, so the visitor gets the page as soon
     * as that is up and the particles arrive underneath them — see the
     * two-tier note in preloader.js.
     */
    addDetail() { sceneBits?.addMarineSnow(); },
    destroy,
  };
}
