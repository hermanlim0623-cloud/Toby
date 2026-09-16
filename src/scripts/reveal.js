// Scroll reveal: the four moves in the brief, and nothing else.
//
//   text     clip-path opens, the line lifts, opacity follows
//   rules    a 1px line draws from zero width to full
//   blocks   a block lifts and fades
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
}

/**
 * Editorial images arrive by un-cropping and settling out of a slight
 * over-scale, rather than fading. The clip and the scale run against each
 * other, so the frame opens while the picture eases back to its true size,
 * which is what makes it read as a printed image being revealed rather than
 * as an element appearing.
 */
export function createFigureReveals(gsap, ScrollTrigger, reduced) {
  const figures = gsap.utils.toArray('[data-figure]');
  if (!figures.length || reduced) return;

  figures.forEach((fig) => {
    const inner = fig.firstElementChild;
    gsap.timeline({ scrollTrigger: { trigger: fig, start: 'top 88%', once: true } })
      .fromTo(fig,
        { clipPath: 'inset(0 0 100% 0)' },
        { clipPath: 'inset(0 0 0% 0)', duration: 1, ease: 'expo.out' })
      .fromTo(inner,
        { scale: 1.05 },
        { scale: 1, duration: 1.2, ease: 'expo.out' }, 0);
  });
}
