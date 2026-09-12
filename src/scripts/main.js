import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

import { createSmoothScroll } from './smoothScroll.js';
import { createCursor } from './cursor.js';
import { createNav } from './nav.js';
import { createReveals } from './reveals.js';
import { createMagnetic } from './magnetic.js';
import { createHorizontalGallery } from './horizontal.js';

gsap.registerPlugin(ScrollTrigger);
window.ScrollTrigger = ScrollTrigger;

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

document.documentElement.classList.add('js-ready');

createSmoothScroll(gsap, prefersReducedMotion);
createNav();
createCursor(gsap);
createMagnetic(gsap);
createReveals(gsap, ScrollTrigger, prefersReducedMotion);
createHorizontalGallery(gsap, ScrollTrigger);

// Three.js is heavy (~150kb+ gzipped) — only fetch it when the hero scene
// will actually run (skipped already inside scene3d for small/low-power
// screens and reduced motion, but this keeps the chunk out of the main
// bundle entirely for those visitors).
const heroCanvas = document.querySelector('#hero-canvas');
if (heroCanvas && !prefersReducedMotion && window.innerWidth >= 560) {
  import('./scene3d.js').then(({ createHeroScene }) => {
    createHeroScene(heroCanvas, { prefersReducedMotion });
  });
}

// Hero entrance: eyebrow / heading / subtext / scroll indicator, staggered.
if (!prefersReducedMotion) {
  gsap.from(['.hero .eyebrow', '.hero h1', '.hero-sub', '.scroll-indicator'], {
    y: 24,
    opacity: 0,
    duration: 1,
    ease: 'power3.out',
    stagger: 0.12,
    delay: 0.15,
  });
} else {
  document.querySelectorAll('.hero .eyebrow, .hero h1, .hero-sub, .scroll-indicator')
    .forEach((el) => { el.style.opacity = 1; });
}

window.addEventListener('load', () => ScrollTrigger.refresh());
