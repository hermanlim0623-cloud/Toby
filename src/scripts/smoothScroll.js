import Lenis from 'lenis';

// Wires Lenis smooth-scroll into GSAP's ticker so ScrollTrigger stays in
// sync. Skipped entirely under prefers-reduced-motion — native scroll only.
export function createSmoothScroll(gsap, prefersReducedMotion) {
  if (prefersReducedMotion) return null;

  // lerp-based rather than duration-based: Lenis then converges on the
  // target every frame instead of running a fixed-length tween per wheel
  // event, which reads as one continuous glide when someone scrolls in
  // quick bursts — the way a trackpad or a mouse wheel actually behaves.
  const lenis = new Lenis({
    lerp: 0.085,
    smoothWheel: true,
    wheelMultiplier: 0.9,
    syncTouch: true,
    syncTouchLerp: 0.075,
  });

  lenis.on('scroll', () => {
    if (window.ScrollTrigger) window.ScrollTrigger.update();
  });

  gsap.ticker.add((time) => {
    lenis.raf(time * 1000);
  });
  gsap.ticker.lagSmoothing(0);

  return lenis;
}
