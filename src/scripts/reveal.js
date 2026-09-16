// Scroll reveal — the four moves in the brief, and nothing else.
//
//   text     clip-path opens, the line lifts, opacity follows
//   rules    a 1px line draws from zero width to full
//   blocks   a block lifts and fades
//   numbers  a counter runs from zero to its value
//
// Everything is once-only. A reveal that replays on every pass turns an
// editorial page into a toy, and re-reading a paragraph should not
// re-animate it.

/** Splits an element into per-word masks holding per-character spans. */
export function splitText(el) {
  if (el.dataset.split === 'done') return el.querySelectorAll('.char');
  const source = el.textContent.replace(/\s+/g, ' ').trim();
  el.textContent = '';

  source.split(' ').forEach((word, i, all) => {
    const mask = document.createElement('span');
    mask.className = 'word';
    Array.from(word).forEach((ch) => {
      const span = document.createElement('span');
      span.className = 'char';
      span.textContent = ch;
      mask.appendChild(span);
    });
    el.appendChild(mask);
    if (i < all.length - 1) el.appendChild(document.createTextNode(' '));
  });

  el.dataset.split = 'done';
  return el.querySelectorAll('.char');
}

/** Formats a counter's current value the way its target is written. */
function format(value, plain) {
  return plain ? String(value) : String(value).padStart(2, '0');
}

export function createReveals(gsap, ScrollTrigger, reduced) {
  const at = (trigger, extra = {}) => ({ trigger, start: 'top 85%', once: true, ...extra });

  // ---- headlines: split to characters, lifted out of a word-level mask.
  document.querySelectorAll('[data-split]').forEach((el) => {
    const chars = splitText(el);
    if (reduced) return;
    gsap.from(chars, {
      yPercent: 108,
      duration: 0.8,
      ease: 'power3.out',
      stagger: 0.012,
      scrollTrigger: at(el),
    });
  });

  if (reduced) {
    document.querySelectorAll('[data-reveal]').forEach((el) => { el.style.opacity = '1'; });
    document.querySelectorAll('[data-rule]').forEach((el) => { el.style.transform = 'scaleX(1)'; });
    document.querySelectorAll('[data-counter]').forEach((el) => {
      el.textContent = format(Number(el.dataset.counter), el.dataset.counterPlain !== undefined);
    });
    return;
  }

  // ---- blocks: the plainest move on the page, and the most used one.
  gsap.utils.toArray('[data-reveal]').forEach((el) => {
    gsap.from(el, {
      y: 20,
      opacity: 0,
      duration: 0.7,
      ease: 'power2.out',
      scrollTrigger: at(el, { start: 'top 90%' }),
    });
  });

  // ---- rules: drawn, not faded. This is the one motion that states the
  // grid out loud, so it is slower than everything around it.
  gsap.utils.toArray('[data-rule]').forEach((rule) => {
    gsap.fromTo(rule,
      { scaleX: 0 },
      {
        scaleX: 1,
        duration: 1,
        ease: 'expo.out',
        immediateRender: false,
        scrollTrigger: at(rule, { start: 'top 92%' }),
      });
  });

  // ---- counters: monospace and tabular, so the digits do not jitter the
  // layout as they climb.
  gsap.utils.toArray('[data-counter]').forEach((el) => {
    const target = Number(el.dataset.counter);
    const plain = el.dataset.counterPlain !== undefined;
    const state = { v: plain ? Math.max(target - 12, 0) : 0 };
    el.textContent = format(Math.round(state.v), plain);
    gsap.to(state, {
      v: target,
      duration: 1.1,
      ease: 'power2.out',
      scrollTrigger: at(el, { start: 'top 95%' }),
      onUpdate: () => { el.textContent = format(Math.round(state.v), plain); },
    });
  });
}
