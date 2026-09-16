// Per-section text choreography.
//
// The reveals module gives every heading the same rise-out-of-a-mask. That
// is the right default, but it means seven sections all announce themselves
// in one identical voice, and by the fourth the reader has stopped seeing it.
//
// This module gives each section its own way of arriving. Every variant is
// built from the same two ingredients — a mask and a stagger — so they read
// as one system with seven dialects rather than seven unrelated libraries:
//
//   lines      a block arriving one line at a time, out of its own mask
//   chars      letters lifting off the page, rotated in depth
//   blur       words resolving out of defocus, from the centre outward
//   scramble   text locking on out of random glyphs, left to right
//   wipe       a bar of light passing across and leaving the words behind
//   typewrite  written, with a caret, at machine speed
//   skew       words sliding in off-axis and settling square
//   flicker    a tube light coming on: three false starts, then steady
//
// Every variant is a no-op when its markup is absent, and reduced motion
// gets the finished state with no animation at all.
import { splitText } from './reveals.js';

const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&*/\\<>';

/** Wraps each line of already-split words in its own overflow mask. */
function maskWords(el) {
  const words = el.querySelectorAll('.split-word');
  words.forEach((word) => {
    if (word.parentElement?.classList.contains('textfx-mask')) return;
    const mask = document.createElement('span');
    mask.className = 'textfx-mask';
    word.parentNode.insertBefore(mask, word);
    mask.appendChild(word);
  });
  return el.querySelectorAll('.textfx-mask > .split-word');
}

/** One ScrollTrigger config, so every variant fires at the same threshold. */
const at = (el, start = 'top 86%') => ({ trigger: el, start, once: true });

const VARIANTS = {
  // ---- lines: the quietest one. Used where the text is an argument the
  // reader is meant to follow, not an effect they are meant to notice.
  lines(gsap, el) {
    splitText(el);
    const words = maskWords(el);
    return gsap.from(words, {
      yPercent: 110,
      duration: 1.05,
      ease: 'expo.out',
      stagger: 0.035,
      scrollTrigger: at(el),
    });
  },

  // ---- chars: letters lifting off the surface. Expensive per character,
  // so it belongs on short lines only.
  chars(gsap, el) {
    const chars = splitText(el);
    gsap.set(el, { perspective: 600 });
    return gsap.from(chars, {
      yPercent: 60,
      rotateX: -85,
      opacity: 0,
      transformOrigin: '50% 100%',
      duration: 0.9,
      ease: 'power4.out',
      stagger: 0.016,
      scrollTrigger: at(el),
    });
  },

  // ---- blur: words resolving out of defocus. Staggered from the centre so
  // the line reads as pulling into focus rather than as sweeping past.
  blur(gsap, el) {
    splitText(el);
    const words = el.querySelectorAll('.split-word');
    return gsap.from(words, {
      opacity: 0,
      filter: 'blur(12px)',
      y: 14,
      duration: 1,
      ease: 'power2.out',
      stagger: { each: 0.05, from: 'center' },
      scrollTrigger: at(el),
    });
  },

  // ---- scramble: the machine voice. Each character settles at its own
  // moment, left to right, so the string locks on like a signal.
  scramble(gsap, el, ScrollTrigger) {
    const text = el.textContent;
    const settleAt = Array.from(text, (_, i) => i / Math.max(text.length - 1, 1));
    const state = { p: 0 };
    el.style.minHeight = `${el.getBoundingClientRect().height}px`;

    return gsap.to(state, {
      p: 1,
      duration: Math.min(0.6 + text.length * 0.012, 2.2),
      ease: 'none',
      scrollTrigger: at(el),
      onUpdate() {
        el.textContent = Array.from(text, (ch, i) => {
          if (ch === ' ' || state.p >= settleAt[i] * 0.8 + 0.2) return ch;
          return GLYPHS[(Math.random() * GLYPHS.length) | 0];
        }).join('');
      },
      onComplete() {
        el.textContent = text;
        el.style.minHeight = '';
        ScrollTrigger.refresh();
      },
    });
  },

  // ---- wipe: a bar of light crossing the element and leaving the text
  // behind it. The bar is a pseudo-element driven by one custom property,
  // so nothing is added to the DOM and nothing can reflow.
  wipe(gsap, el) {
    el.classList.add('textfx-wipe');
    return gsap.fromTo(el,
      { '--wipe': 0 },
      {
        '--wipe': 1,
        duration: 1.15,
        ease: 'power2.inOut',
        immediateRender: false,
        scrollTrigger: at(el, 'top 90%'),
        onComplete: () => el.classList.add('is-wiped'),
      });
  },

  // ---- typewrite: written rather than revealed. Reserved for the lines
  // that are literally output from a machine.
  typewrite(gsap, el) {
    const chars = splitText(el);
    el.classList.add('textfx-caret');
    return gsap.from(chars, {
      opacity: 0,
      duration: 0.01,
      ease: 'none',
      stagger: Math.min(1.4 / Math.max(chars.length, 1), 0.03),
      scrollTrigger: at(el),
      onComplete: () => el.classList.remove('textfx-caret'),
    });
  },

  // ---- skew: words arriving off-axis. The settle is what sells it, so the
  // easing is long and the overshoot is deliberately absent.
  skew(gsap, el) {
    splitText(el);
    const words = maskWords(el);
    return gsap.from(words, {
      yPercent: 100,
      skewY: 7,
      opacity: 0,
      duration: 1.1,
      ease: 'expo.out',
      stagger: 0.045,
      scrollTrigger: at(el),
    });
  },

  // ---- flicker: a tube light coming on. Three false starts and then
  // steady, which is the one moment on the page allowed to look broken.
  flicker(gsap, el) {
    const tl = gsap.timeline({ scrollTrigger: at(el, 'top 88%') });
    tl.set(el, { opacity: 0 })
      .to(el, { opacity: 1, duration: 0.06 })
      .to(el, { opacity: 0.08, duration: 0.08 })
      .to(el, { opacity: 0.9, duration: 0.05 })
      .to(el, { opacity: 0.15, duration: 0.1 })
      .to(el, { opacity: 1, duration: 0.5, ease: 'power2.out' });
    return tl;
  },
};

/**
 * Binds every `[data-textfx]` element to the variant it names. An unknown
 * variant name falls back to `lines` rather than leaving the text unbound —
 * a typo in the markup should cost a nuance, not the reveal.
 */
export function createSectionText(gsap, ScrollTrigger, prefersReducedMotion) {
  const targets = document.querySelectorAll('[data-textfx]');
  if (!targets.length) return;

  if (prefersReducedMotion) {
    targets.forEach((el) => { el.style.opacity = '1'; });
    return;
  }

  targets.forEach((el) => {
    if (el.dataset.textfxBound) return;
    el.dataset.textfxBound = '1';
    const variant = VARIANTS[el.dataset.textfx] || VARIANTS.lines;
    variant(gsap, el, ScrollTrigger);
  });
}
