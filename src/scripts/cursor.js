// Custom cursor: a small dot plus a trailing ring that eases behind it.
// Only runs on fine-pointer/hover-capable devices; touch devices keep the
// native cursor untouched.
export function createCursor(gsap) {
  const isFinePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  if (!isFinePointer) {
    document.documentElement.classList.add('no-hover');
    return;
  }

  const dot = document.createElement('div');
  dot.className = 'cursor-dot';
  const ring = document.createElement('div');
  ring.className = 'cursor-ring';
  document.body.append(dot, ring);

  const setDot = gsap.quickTo(dot, 'x', { duration: 0.05, ease: 'none' });
  const setDotY = gsap.quickTo(dot, 'y', { duration: 0.05, ease: 'none' });
  const setRing = gsap.quickTo(ring, 'x', { duration: 0.35, ease: 'power3.out' });
  const setRingY = gsap.quickTo(ring, 'y', { duration: 0.35, ease: 'power3.out' });

  window.addEventListener('mousemove', (e) => {
    setDot(e.clientX);
    setDotY(e.clientY);
    setRing(e.clientX);
    setRingY(e.clientY);
  });

  document.querySelectorAll('a, button, .magnetic, .project-card').forEach((el) => {
    el.addEventListener('mouseenter', () => ring.classList.add('is-active'));
    el.addEventListener('mouseleave', () => ring.classList.remove('is-active'));
  });
}
