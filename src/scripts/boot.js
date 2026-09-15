// Application boot + lifecycle.
//
// With the view-transition router in play a "page load" happens many times
// per visit, so initialisation is split in two:
//
//   persistent — Lenis and the GSAP ticker, created once and kept. Tearing
//                smooth scroll down and rebuilding it per navigation is
//                what makes view-transition sites feel like they stutter
//                on arrival.
//   per page   — everything bound to DOM the router replaces. Each one gets
//                an AbortSignal, so a navigation cancels its listeners
//                instead of stacking a second copy on top.
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

import { createSmoothScroll } from './smoothScroll.js';
import { createCursor } from './cursor.js';
import { createNav } from './nav.js';
import { createReveals } from './reveals.js';
import { createMagnetic } from './magnetic.js';
import { createHorizontalGallery } from './horizontal.js';
import { createAxisTurn, createGalleryTurnabout } from './sectionTransitions.js';
import { createIdentityScan } from './identity.js';
import { createConstellation } from './constellation.js';
import { createAutomationPipeline } from './automation.js';
import { createTransmission } from './terminal.js';
import { createShutdown } from './shutdown.js';
import { createTelemetry } from './telemetry.js';
import { createBootSequence } from './bootSequence.js';
import { createScrollFx } from './scrollFx.js';
import { createPalette } from './palette.js';
import {
  createHeadingShimmer,
  createTechAssemble,
  createPipelineIgnition,
  createTimelineSpine,
} from './sectionFx.js';
import { createPointerFx } from './pointerFx.js';
import { createOdometers } from './odometer.js';
import { SKILL_NODES } from './skillData.js';

gsap.registerPlugin(ScrollTrigger);
window.ScrollTrigger = ScrollTrigger;

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const lowPower = window.innerWidth < 760
  || (navigator.deviceMemory && navigator.deviceMemory <= 4)
  || (navigator.connection && navigator.connection.saveData);

document.documentElement.classList.add('js-ready');

// A reload or back-navigation restoring a deep scroll position would hand
// the depth controller a huge initial jump before anything has had a
// chance to load — always start the dive at the surface instead.
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

let persistentReady = false;
function initPersistent() {
  if (persistentReady) return;
  persistentReady = true;
  createSmoothScroll(gsap, prefersReducedMotion);
}

/** Everything created for the current document, torn down before a swap. */
let page = null;

function teardownPage() {
  if (!page) return;
  page.controller.abort();
  page.disposables.forEach((d) => d?.destroy?.());
  ScrollTrigger.getAll().forEach((t) => t.kill());
  page = null;
}

function initPage() {
  teardownPage();
  const controller = new AbortController();
  const { signal } = controller;
  const disposables = [];
  page = { controller, disposables };

  const isDescent = document.body.dataset.variant === 'descent';
  if (isDescent) window.scrollTo(0, 0);

  // The abyss is loaded on demand rather than imported at the top: Three's
  // WebGPU build is by far the largest thing on the site, and only the dive
  // page has anything to do with it — statically importing it would make
  // every case-study page download a renderer it never constructs.
  //
  // It still starts as early as possible, because its first frame is one of
  // the boot sequence's blocking signals: the sooner the chunk is in flight,
  // the sooner the curtain can lift.
  let abyss = null;
  const abyssReady = isDescent
    ? import('./abyss/index.js').then(({ createAbyss }) => {
        // A navigation during the fetch means this page is already gone.
        if (page?.controller.signal.aborted) return false;
        abyss = createAbyss({ prefersReducedMotion, lowPower });
        disposables.push(abyss);
        return abyss.ready;
      }).catch(() => false)
    : null;

  createNav(signal);
  createCursor(gsap, signal);
  createMagnetic(gsap);
  createPalette(signal);
  createReveals(gsap, ScrollTrigger, prefersReducedMotion);
  createHorizontalGallery(gsap, ScrollTrigger, prefersReducedMotion);
  createAxisTurn(gsap, ScrollTrigger, prefersReducedMotion);
  createGalleryTurnabout(gsap, ScrollTrigger, prefersReducedMotion);
  createIdentityScan(gsap, ScrollTrigger, prefersReducedMotion);
  disposables.push(createAutomationPipeline(gsap, ScrollTrigger, prefersReducedMotion));
  createTransmission(gsap, ScrollTrigger, prefersReducedMotion);
  createShutdown(gsap, ScrollTrigger, prefersReducedMotion);
  disposables.push(createTelemetry(prefersReducedMotion));

  const skillCanvas = document.querySelector('#skill-canvas');
  if (skillCanvas) disposables.push(createConstellation(skillCanvas, SKILL_NODES, { prefersReducedMotion }));

  createScrollFx(gsap, ScrollTrigger, prefersReducedMotion);

  // Section motion. These run after the reveals above because the heading
  // shimmer rides the `.char` spans that reveals.js creates.
  createHeadingShimmer(gsap, ScrollTrigger, prefersReducedMotion);
  createTechAssemble(gsap, ScrollTrigger, prefersReducedMotion);
  createPipelineIgnition(gsap, ScrollTrigger, prefersReducedMotion);
  createTimelineSpine(gsap, ScrollTrigger, prefersReducedMotion);
  createOdometers(gsap, ScrollTrigger, prefersReducedMotion);
  createPointerFx(gsap, signal, prefersReducedMotion);

  if (isDescent) {
    createBootSequence(gsap, prefersReducedMotion, {
      // The renderer check resolves when a backend exists and has presented
      // a real first frame; the field check follows it, because the detail
      // it adds is only meaningful once there is something to add it to.
      renderer: abyssReady ?? true,
      field: abyssReady ?? true,
    }).then(() => {
      ScrollTrigger.refresh();
      playHeroEntrance();
      // Non-blocking detail, added once the visitor is already on the page.
      // Building the particle field before this point would only push the
      // curtain later for something nobody is looking at yet.
      abyss?.addDetail();
    });
  } else {
    playPageEntrance();
    ScrollTrigger.refresh();
  }
}

// Hero entrance: a controlled reveal, not everything at once — and held
// back until the boot sequence's shutter has lifted, so the two read
// as one continuous opening instead of the hero animating behind a cover
// that nobody has seen through yet.
function playHeroEntrance() {
  if (prefersReducedMotion) {
    document.querySelectorAll('.hero .eyebrow, .hero h1, .hero-sub, .scroll-indicator')
      .forEach((el) => { el.style.opacity = 1; });
    return;
  }
  const heroHeadline = document.querySelector('.hero h1');
  heroHeadline?.classList.add('is-masking');
  gsap.timeline({ onComplete: () => heroHeadline?.classList.remove('is-masking') })
    .from('.hero .eyebrow', { y: 16, opacity: 0, duration: 0.8, ease: 'power3.out' })
    .from('.hero h1 .char', {
      yPercent: 115, opacity: 0, duration: 1.1, ease: 'power4.out', stagger: 0.022,
    }, '-=0.45')
    .from('.hero-sub', { y: 20, opacity: 0, duration: 0.9, ease: 'power3.out' }, '-=0.6')
    .from('.scroll-indicator', { opacity: 0, duration: 0.8, ease: 'power2.out' }, '-=0.4');
}

/** The case-study pages get a quieter version of the same idea. */
function playPageEntrance() {
  const header = document.querySelector('[data-page-header]');
  if (!header) return;
  if (prefersReducedMotion) {
    header.style.opacity = 1;
    return;
  }
  gsap.from(header.children, {
    y: 22, opacity: 0, duration: 0.9, ease: 'power3.out', stagger: 0.08,
  });
}

initPersistent();

// `astro:page-load` fires on the first load and after every view-transition
// navigation, so one listener covers both cases.
document.addEventListener('astro:page-load', initPage);
document.addEventListener('astro:before-swap', teardownPage);
window.addEventListener('load', () => ScrollTrigger.refresh());
