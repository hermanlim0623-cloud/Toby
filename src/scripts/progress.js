// A 1px progress rule under the header.
//
// Scrubbed off the document's own scroll rather than animated on a timer,
// so it is a readout of where the visitor is, not a decoration that happens
// to move.
export function createProgress(gsap, ScrollTrigger, reduced) {
  const bar = document.querySelector('[data-progress]');
  if (!bar) return;

  if (reduced) { bar.style.transform = 'scaleX(1)'; return; }

  gsap.fromTo(bar,
    { scaleX: 0 },
    {
      scaleX: 1,
      ease: 'none',
      scrollTrigger: { start: 0, end: 'max', scrub: 0.3 },
    });
}
