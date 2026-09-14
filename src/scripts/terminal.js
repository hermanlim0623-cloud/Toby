// SECTION 11 — TRANSMISSION: a terminal boot sequence for the contact
// section (establishing connection -> progress bar -> channel ready).
export function createTransmission(gsap, ScrollTrigger, prefersReducedMotion) {
  const root = document.querySelector('[data-transmission]');
  if (!root) return;

  const bar = root.querySelector('[data-transmission-bar]');
  const pct = root.querySelector('[data-transmission-pct]');
  const status = root.querySelector('[data-transmission-status]');
  const reveal = root.querySelectorAll('[data-transmission-reveal]');

  if (prefersReducedMotion) {
    if (bar) bar.style.width = '100%';
    if (pct) pct.textContent = '100%';
    if (status) status.textContent = 'CHANNEL READY';
    reveal.forEach((el) => (el.style.opacity = 1));
    return;
  }

  const obj = { p: 0 };
  const tl = gsap.timeline({
    scrollTrigger: { trigger: root, start: 'top 60%', once: true },
  });

  tl.call(() => { if (status) status.textContent = 'ESTABLISHING CONNECTION…'; })
    .to(obj, {
      p: 100,
      duration: 1.8,
      ease: 'steps(24)',
      onUpdate() {
        const v = Math.round(obj.p);
        if (bar) bar.style.width = v + '%';
        if (pct) pct.textContent = v + '%';
      },
    })
    .call(() => { if (status) status.textContent = 'CHANNEL READY'; })
    .fromTo(reveal, { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.7, stagger: 0.08, ease: 'power3.out' }, '-=0.1');
}
