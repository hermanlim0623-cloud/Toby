import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

import { createSmoothScroll } from './smoothScroll.js';
import { createCursor } from './cursor.js';
import { createNav } from './nav.js';
import { createReveals } from './reveals.js';
import { createMagnetic } from './magnetic.js';
import { createHorizontalGallery } from './horizontal.js';
import { createIdentityScan } from './identity.js';
import { createConstellation } from './constellation.js';
import { createAutomationPipeline } from './automation.js';
import { createTransmission } from './terminal.js';
import { createShutdown } from './shutdown.js';
import { createOceanAtmosphere } from './ocean.js';
import { createCinema } from './cinema.js';
import { SKILL_NODES } from './skillData.js';

gsap.registerPlugin(ScrollTrigger);
window.ScrollTrigger = ScrollTrigger;

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const lowPower = window.innerWidth < 760
  || (navigator.deviceMemory && navigator.deviceMemory <= 4)
  || (navigator.connection && navigator.connection.saveData);

document.documentElement.classList.add('js-ready');

createCinema({ prefersReducedMotion, lowPower });

createSmoothScroll(gsap, prefersReducedMotion);
createNav();
createCursor(gsap);
createMagnetic(gsap);
createReveals(gsap, ScrollTrigger, prefersReducedMotion);
createHorizontalGallery(gsap, ScrollTrigger);
createIdentityScan(gsap, ScrollTrigger, prefersReducedMotion);
createAutomationPipeline(gsap, ScrollTrigger, prefersReducedMotion);
createTransmission(gsap, ScrollTrigger, prefersReducedMotion);
createShutdown(gsap, ScrollTrigger, prefersReducedMotion);
createOceanAtmosphere(prefersReducedMotion);

const skillCanvas = document.querySelector('#skill-canvas');
if (skillCanvas) createConstellation(skillCanvas, SKILL_NODES, { prefersReducedMotion });

// Three.js is heavy (~150kb+ gzipped) — only fetch it when the hero scene
// will actually run (skipped already inside scene3d for small/low-power
// screens and reduced motion, but this keeps the chunk out of the main
// bundle entirely for those visitors).
const heroCanvas = document.querySelector('#hero-canvas');
if (heroCanvas && !prefersReducedMotion && window.innerWidth >= 560) {
  import('./scene3d.js').then(({ createHeroScene }) => {
    createHeroScene(heroCanvas, { prefersReducedMotion, gsap });
  });
}

// Hero entrance: a controlled reveal, not everything at once. The eyebrow
// leads, the headline unmasks line by line, the object fades in alongside
// (handled in scene3d), and the subtext/indicator settle in last.
if (!prefersReducedMotion) {
  gsap.timeline({ delay: 0.2 })
    .from('.hero .eyebrow', { y: 16, opacity: 0, duration: 0.8, ease: 'power3.out' })
    .from('.hero h1 .split-line > span', {
      yPercent: 115, opacity: 0, duration: 1.1, ease: 'power4.out', stagger: 0.09,
    }, '-=0.35')
    .from('.hero-sub', { y: 20, opacity: 0, duration: 0.9, ease: 'power3.out' }, '-=0.5')
    .from('.scroll-indicator', { opacity: 0, duration: 0.8, ease: 'power2.out' }, '-=0.4');
} else {
  document.querySelectorAll('.hero .eyebrow, .hero h1, .hero-sub, .scroll-indicator')
    .forEach((el) => { el.style.opacity = 1; });
}

window.addEventListener('load', () => ScrollTrigger.refresh());
