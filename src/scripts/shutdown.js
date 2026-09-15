// SECTION 12 — FINAL: cinematic "system shutdown" — the camera pulls back
// (a scale-down of the whole miniature world map), status lines print,
// then the closing wordmark holds before the page ends in black.
export function createShutdown(gsap, ScrollTrigger, prefersReducedMotion) {
  const root = document.querySelector('[data-shutdown]');
  if (!root) return;

  const world = root.querySelector('[data-shutdown-world]');
  const lines = root.querySelectorAll('[data-shutdown-line]');
  const closing = root.querySelector('[data-shutdown-closing]');

  if (prefersReducedMotion) {
    lines.forEach((l) => (l.style.opacity = 1));
    if (closing) closing.style.opacity = 1;
    return;
  }

  const tl = gsap.timeline({
    scrollTrigger: {
      trigger: root,
      start: 'top 70%',
      end: 'bottom bottom',
      scrub: 0.6,
      // Feeds the water shader's uSurfaceRush uniform (see cinema.js /
      // waterShader.js) — the same "camera pulling back" this timeline
      // renders in HTML also brightens and lifts the footage itself, so
      // the dive visibly breaches rather than just fading to a wordmark.
      onUpdate: (self) => {
        window.dispatchEvent(new CustomEvent('cinema:surface-rush', { detail: { value: self.progress } }));
      },
    },
  });

  if (world) {
    tl.fromTo(world,
      { scale: 1, opacity: 0.9, rotateX: 0, transformPerspective: 900 },
      { scale: 0.5, opacity: 0.24, rotateX: 10, ease: 'none' }, 0);
  }
  tl.fromTo(lines, { opacity: 0, y: 12 }, { opacity: 1, y: 0, stagger: 0.15, ease: 'none' }, 0.1);
  tl.fromTo(closing, { opacity: 0, letterSpacing: '0.02em' }, { opacity: 1, letterSpacing: '0.04em', ease: 'none' }, 0.55);
}
