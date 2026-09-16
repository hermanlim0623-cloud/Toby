// The hero's cursor-driven slash.
//
// One element, one rAF loop, one transform per frame. The band tracks the
// pointer horizontally with the same exponential filter the cursor uses, so
// the two move as one thing rather than at two different speeds.
//
// It is a cursor interaction, not a background: the band is invisible until
// the pointer moves and fades out again once it stops, so the hero at rest is
// exactly the hero that was there before.

/** Follow constant. Slower than the cursor ring on purpose: the band is
 *  large, and matching the pointer exactly reads as a cheap parallax. */
const TAU = 0.14;
/** How long the pointer has to be still before the band fades out. */
const IDLE = 900;

export function createHeroSlash(signal, reduced) {
  const root = document.querySelector('[data-hero-slash]');
  if (!root) return;

  const band = root.querySelector('[data-hero-slash-band]');
  const hero = root.closest('.hero');
  if (!band || !hero) return;

  // Desktop only, as specified. There is no pointer to follow on a
  // touchscreen, and reduced motion asked for less movement, not more.
  if (reduced || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    root.remove();
    return;
  }

  let target = null;
  let current = null;
  let raf = 0;
  let idleTimer = 0;

  function frame(now) {
    raf = requestAnimationFrame(frame);
    if (target === null) return;

    const dt = Math.min((now - (frame.last || now)) / 1000, 0.1);
    frame.last = now;

    // First move places the band rather than sliding it in from wherever it
    // happened to be left, which would read as a swipe across the hero.
    if (current === null) current = target;
    else current += (target - current) * (1 - Math.exp(-dt / TAU));

    band.style.transform = `translate3d(${current.toFixed(1)}px, -50%, 0) rotate(var(--slash-angle))`;
  }

  function onMove(e) {
    // Relative to the hero, so the band stays put when the page scrolls
    // rather than chasing a viewport coordinate the hero has left behind.
    const rect = hero.getBoundingClientRect();
    target = e.clientX - rect.left;

    root.classList.add('is-live');
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => root.classList.remove('is-live'), IDLE);
  }

  window.addEventListener('pointermove', onMove, { passive: true, signal });
  // Leaving the window is the same as going idle, and waiting out the timer
  // would leave the band hanging there after the pointer is gone.
  document.addEventListener('pointerleave', () => {
    clearTimeout(idleTimer);
    root.classList.remove('is-live');
  }, { signal });

  raf = requestAnimationFrame(frame);

  return () => {
    cancelAnimationFrame(raf);
    clearTimeout(idleTimer);
  };
}
