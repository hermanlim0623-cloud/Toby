// Splits headline text into per-word spans (wrapped for clip masking) and
// batches scroll-triggered reveal animations for the rest of the page.
export function splitHeadline(el) {
  const text = el.textContent.trim();
  el.innerHTML = '';
  text.split(/\s+/).forEach((word, i, arr) => {
    const line = document.createElement('span');
    line.className = 'split-line';
    const inner = document.createElement('span');
    inner.textContent = word + (i < arr.length - 1 ? ' ' : '');
    line.appendChild(inner);
    el.appendChild(line);
  });
}

export function createReveals(gsap, ScrollTrigger, prefersReducedMotion) {
  if (prefersReducedMotion) return;

  document.querySelectorAll('[data-split]').forEach((el) => {
    splitHeadline(el);
    gsap.from(el.querySelectorAll('.split-line > span'), {
      yPercent: 120,
      opacity: 0,
      duration: 0.9,
      ease: 'power4.out',
      stagger: 0.06,
      scrollTrigger: { trigger: el, start: 'top 85%' },
    });
  });

  gsap.utils.toArray('[data-reveal]').forEach((el) => {
    gsap.from(el, {
      y: 32,
      opacity: 0,
      duration: 0.9,
      ease: 'power3.out',
      scrollTrigger: { trigger: el, start: 'top 88%' },
    });
  });

  gsap.utils.toArray('[data-reveal-group]').forEach((group) => {
    gsap.from(group.children, {
      y: 26,
      opacity: 0,
      duration: 0.7,
      ease: 'power3.out',
      stagger: 0.08,
      scrollTrigger: { trigger: group, start: 'top 85%' },
    });
  });
}
