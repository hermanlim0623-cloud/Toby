import Lenis from 'lenis';

// Wires Lenis smooth-scroll into GSAP's ticker so ScrollTrigger stays in
// sync. Skipped entirely under prefers-reduced-motion — native scroll only.
export function createSmoothScroll(gsap, prefersReducedMotion) {
  if (prefersReducedMotion) return null;

  const lenis = new Lenis({
    duration: 1.1,
    smoothWheel: true,
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
