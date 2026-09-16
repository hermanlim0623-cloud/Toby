// Smooth scroll, driven off the GSAP ticker so scroll-linked animation and
// the scroll position are never a frame apart.
//
// Interpolated, not hijacked: no section snapping, no stolen wheel events,
// and anchors still jump the way a browser's own anchors do.
import Lenis from 'lenis';

export function createSmoothScroll(gsap, ScrollTrigger, reduced) {
  if (reduced) return null;

  const lenis = new Lenis({
    duration: 1.05,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    // Touch devices already interpolate their own scroll; doubling it makes
    // a phone feel like it is running behind the finger.
    smoothTouch: false,
    prevent: (node) => node.tagName === 'IFRAME',
  });

  lenis.on('scroll', ScrollTrigger.update);
  const tick = (time) => lenis.raf(time * 1000);
  gsap.ticker.add(tick);
  gsap.ticker.lagSmoothing(0);

  return () => {
    gsap.ticker.remove(tick);
    lenis.destroy();
  };
}
