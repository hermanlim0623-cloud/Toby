// Pointer-reactive depth on the project cards.
//
// The gallery already grades cards by distance from the viewport centre
// (horizontal.js). This adds the second half of the illusion: the card
// under the cursor tilts in perspective and carries a specular highlight
// that tracks the pointer, so it behaves like a physical panel catching
// the light rather than a rectangle that happens to be scaled.
//
// Both systems write to CSS custom properties rather than to `transform`
// directly — the stylesheet composes them into one transform, so neither
// can clobber the other.
const MAX_TILT = 7; // degrees; past this it reads as a gimmick

export function createPointerFx(gsap, signal, prefersReducedMotion) {
  if (prefersReducedMotion) return;
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

  const cards = document.querySelectorAll('.project-card');
  if (!cards.length) return;

  const opts = { signal };

  cards.forEach((card) => {
    // Pointer events fire faster than the display refreshes, so the
    // reads are coalesced into one rAF rather than writing per event.
    let frame = null;
    let pending = null;

    const apply = () => {
      frame = null;
      if (!pending) return;
      const { x, y } = pending;
      const rect = card.getBoundingClientRect();
      if (!rect.width || !rect.height) return;

      const px = (x - rect.left) / rect.width; // 0..1
      const py = (y - rect.top) / rect.height;

      card.style.setProperty('--t-ry', `${((px - 0.5) * 2 * MAX_TILT).toFixed(2)}deg`);
      card.style.setProperty('--t-rx', `${((0.5 - py) * 2 * MAX_TILT).toFixed(2)}deg`);
      card.style.setProperty('--mx', `${(px * 100).toFixed(1)}%`);
      card.style.setProperty('--my', `${(py * 100).toFixed(1)}%`);
    };

    card.addEventListener('pointermove', (event) => {
      pending = { x: event.clientX, y: event.clientY };
      if (frame === null) frame = requestAnimationFrame(apply);
    }, opts);

    card.addEventListener('pointerenter', () => card.classList.add('is-tilting'), opts);

    card.addEventListener('pointerleave', () => {
      card.classList.remove('is-tilting');
      if (frame !== null) { cancelAnimationFrame(frame); frame = null; }
      pending = null;
      // Spring back rather than snapping — the CSS transition on the
      // custom properties would be ignored by most engines, so the
      // release is tweened explicitly.
      gsap.to(card, {
        '--t-rx': '0deg',
        '--t-ry': '0deg',
        duration: 0.6,
        ease: 'elastic.out(1, 0.5)',
      });
    }, opts);

    signal?.addEventListener('abort', () => {
      if (frame !== null) cancelAnimationFrame(frame);
    });
  });
}
