// Custom cursor: a small dot that tracks precisely, plus a ring that eases
// behind it and reacts to what's underneath — growing over interactive
// targets and carrying a short label where one is useful. Only runs on
// fine-pointer devices; touch keeps the native behaviour untouched.
export function createCursor(gsap, signal) {
  const isFinePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  if (!isFinePointer) {
    document.documentElement.classList.add('no-hover');
    return;
  }

  const dot = document.createElement('div');
  dot.className = 'cursor-dot';
  const ring = document.createElement('div');
  ring.className = 'cursor-ring';
  const label = document.createElement('span');
  label.className = 'cursor-label';
  ring.appendChild(label);
  document.body.append(dot, ring);

  const setDot = gsap.quickTo(dot, 'x', { duration: 0.05, ease: 'none' });
  const setDotY = gsap.quickTo(dot, 'y', { duration: 0.05, ease: 'none' });
  const setRing = gsap.quickTo(ring, 'x', { duration: 0.4, ease: 'power3.out' });
  const setRingY = gsap.quickTo(ring, 'y', { duration: 0.4, ease: 'power3.out' });

  const opts = { signal };

  window.addEventListener('mousemove', (e) => {
    setDot(e.clientX);
    setDotY(e.clientY);
    setRing(e.clientX);
    setRingY(e.clientY);
  }, opts);

  // The pointer leaving the window should take the cursor with it, rather
  // than leaving a stray ring parked at the last known position.
  document.addEventListener('mouseleave', () => document.body.classList.add('cursor-hidden'), opts);
  document.addEventListener('mouseenter', () => document.body.classList.remove('cursor-hidden'), opts);

  // data-cursor supplies the label; everything else just gets the ring.
  const targets = [
    ...document.querySelectorAll('a, button, .magnetic, .project-card, [data-cursor]'),
  ];
  targets.forEach((el) => {
    const text = el.dataset.cursor || '';
    el.addEventListener('mouseenter', () => {
      ring.classList.add('is-active');
      if (text) {
        label.textContent = text;
        ring.classList.add('has-label');
      }
    }, opts);
    el.addEventListener('mouseleave', () => {
      ring.classList.remove('is-active', 'has-label');
      label.textContent = '';
    }, opts);
  });

  // The dot and ring are injected into <body>, which the view-transition
  // router replaces wholesale — take them with us so a navigation can't
  // leave a second pair behind.
  signal?.addEventListener('abort', () => {
    dot.remove();
    ring.remove();
  });
}
