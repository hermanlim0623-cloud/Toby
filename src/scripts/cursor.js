// The cursor.
//
// A dot that trails the pointer, and a word when the thing under it says
// what it does — `data-cursor="VIEW"`, `"OPEN"`, and so on. Pointer-coarse
// devices never mount it: a follower on a touchscreen is a bug.
export function createCursor(gsap, signal, reduced) {
  if (reduced || !window.matchMedia('(pointer: fine)').matches) return;

  const root = document.createElement('div');
  root.className = 'cursor';
  root.setAttribute('aria-hidden', 'true');
  root.innerHTML = '<span class="cursor-dot"></span><span class="cursor-word t-tiny"></span>';
  document.body.appendChild(root);
  // Only once the follower actually exists does the real pointer get hidden;
  // hiding it from CSS alone would leave a page with no cursor at all if this
  // module never ran.
  document.documentElement.classList.add('has-cursor');

  const word = root.querySelector('.cursor-word');
  const x = gsap.quickTo(root, 'x', { duration: 0.14, ease: 'power3.out' });
  const y = gsap.quickTo(root, 'y', { duration: 0.14, ease: 'power3.out' });

  window.addEventListener('pointermove', (e) => {
    x(e.clientX);
    y(e.clientY);
    // Read the label off the deepest element that declares one, so a link
    // inside a labelled row can still say something different.
    const hit = e.target instanceof Element ? e.target.closest('[data-cursor]') : null;
    const label = hit?.dataset.cursor ?? '';
    if (word.textContent !== label) word.textContent = label;
    root.classList.toggle('is-labelled', Boolean(label));
  }, { passive: true, signal });

  document.addEventListener('pointerleave', () => root.classList.add('is-gone'), { signal });
  document.addEventListener('pointerenter', () => root.classList.remove('is-gone'), { signal });

  return () => {
    root.remove();
    document.documentElement.classList.remove('has-cursor');
  };
}
