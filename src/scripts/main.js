// Application entry.
//
// The view-transition router means a "page load" happens many times per
// visit, so initialisation is split in two: the smooth-scroll instance and
// the GSAP ticker are built once and kept, and everything bound to DOM the
// router replaces is rebuilt per page behind an AbortSignal — so a
// navigation cancels its listeners instead of stacking a second copy.
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

import { createSmoothScroll } from './smoothScroll.js';
import { createReveals, createFigureReveals } from './reveal.js';
import { createClock } from './clock.js';
import { createSpy } from './spy.js';
import { createMenu } from './menu.js';
import { createCursor } from './cursor.js';
import { createWorkHover } from './workHover.js';
import { createHeroInk } from './heroInk.js';
import { createLoader } from './loader.js';
import { createTransitions } from './transition.js';
import { createProgress } from './progress.js';

gsap.registerPlugin(ScrollTrigger);

const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
document.documentElement.classList.add('js-ready');

let persistent = false;
let page = null;

function initPersistent() {
  if (persistent) return;
  persistent = true;
  createSmoothScroll(gsap, ScrollTrigger, reduced);
  createTransitions(reduced);
}

function teardown() {
  page?.controller.abort();
  page?.disposables.forEach((d) => d?.());
  ScrollTrigger.getAll().forEach((t) => t.kill());
  page = null;
}

function initPage() {
  teardown();
  const controller = new AbortController();
  const { signal } = controller;
  const disposables = [];
  page = { controller, disposables };

  createClock(signal);
  createMenu(signal);
  createSpy(ScrollTrigger);
  disposables.push(createCursor(gsap, signal, reduced));
  createReveals(gsap, ScrollTrigger, reduced);
  createFigureReveals(gsap, ScrollTrigger, reduced);
  createProgress(gsap, ScrollTrigger, reduced);
  createWorkHover(gsap, signal, reduced);
  disposables.push(createHeroInk(document.querySelector('[data-hero-ink]'), {
    prefersReducedMotion: reduced,
    signal,
  }));

  // The entrance waits for the curtain: playing the hero behind a cover
  // nobody can see through spends the animation on an empty room.
  createLoader(gsap, reduced).then(() => {
    playEntrance();
    ScrollTrigger.refresh();
  });
}

/**
 * Page entry, in the order the brief sets: the frame, then the position,
 * then the mark, then what it says, then the way down. Each step is a beat
 * behind the last rather than everything arriving together.
 */
function playEntrance() {
  const mark = document.querySelector('[data-hero-mark]');
  if (!mark) return;

  if (reduced) {
    document.querySelectorAll('[data-hero-say], [data-hero-foot], .hdr')
      .forEach((el) => { el.style.opacity = '1'; });
    return;
  }

  gsap.timeline({ defaults: { ease: 'power3.out' } })
    .from('.hdr', { opacity: 0, duration: 0.6 })
    .from('.hero-slash', { opacity: 0, x: -12, duration: 0.5 }, 0.08)
    .from(mark.querySelectorAll('.hero-char'), {
      yPercent: 110,
      duration: 1,
      // 40ms between characters, exactly as the brief has it: enough to
      // read as sequential, not enough to read as slow.
      stagger: 0.04,
    }, 0.16)
    .from('[data-hero-say] p', { opacity: 0, y: 12, duration: 0.6, stagger: 0.06 }, 0.4)
    .from('[data-hero-foot] > *', { opacity: 0, y: 12, duration: 0.6, stagger: 0.06 }, 0.52);
}

initPersistent();
document.addEventListener('astro:page-load', initPage);
document.addEventListener('astro:before-swap', teardown);
window.addEventListener('load', () => ScrollTrigger.refresh());
