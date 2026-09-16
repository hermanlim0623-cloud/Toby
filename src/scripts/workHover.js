// The work list's hover preview.
//
// One preview element is shared by every row rather than one per row: the
// panel is a single object that moves, and swapping its contents is what
// makes leaving one row and entering the next read as the same object
// re-titling itself instead of two panels cross-fading.
//
// Position is spring-smoothed and rotation is taken from the pointer's own
// velocity, so the panel banks into the direction of travel and settles —
// the detail that separates this from a div pinned to the cursor.

const MAX_TILT = 5;

export function createWorkHover(gsap, signal, reduced) {
  const list = document.querySelector('[data-work-list]');
  const panel = document.querySelector('[data-work-preview]');
  if (!list || !panel) return;

  const rows = list.querySelectorAll('[data-work-row]');
  if (!rows.length) return;

  // Touch and reduced-motion get the list on its own. The preview is an
  // enhancement for a pointer that can hover, and nothing in the section
  // depends on having seen it.
  if (reduced || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    panel.remove();
    return;
  }

  const frames = panel.querySelectorAll('[data-work-frame]');
  const x = gsap.quickTo(panel, 'x', { duration: 0.5, ease: 'power3.out' });
  const y = gsap.quickTo(panel, 'y', { duration: 0.5, ease: 'power3.out' });
  const rot = gsap.quickTo(panel, 'rotation', { duration: 0.7, ease: 'power3.out' });

  let active = -1;
  let lastX = null;

  function show(index) {
    if (index === active) return;
    active = index;
    frames.forEach((f, i) => f.classList.toggle('is-on', i === index));
    gsap.to(panel, {
      autoAlpha: index < 0 ? 0 : 1,
      scale: index < 0 ? 0.97 : 1,
      duration: index < 0 ? 0.3 : 0.55,
      ease: 'power3.out',
    });
  }

  rows.forEach((row, i) => {
    row.addEventListener('pointerenter', () => show(i), { signal });
    // Focus is not hover, and a keyboard visitor gets the same preview a
    // mouse visitor does rather than a silently different section.
    row.addEventListener('focus', () => show(i), { signal });
  });

  list.addEventListener('pointerleave', () => show(-1), { signal });
  list.addEventListener('focusout', (e) => {
    if (!list.contains(e.relatedTarget)) show(-1);
  }, { signal });

  window.addEventListener('pointermove', (e) => {
    if (active < 0) return;
    x(e.clientX);
    y(e.clientY);
    // Tilt follows horizontal velocity, clamped, and decays to flat the
    // moment the pointer stops — a constant angle would read as a mistake.
    const vx = lastX === null ? 0 : e.clientX - lastX;
    lastX = e.clientX;
    rot(gsap.utils.clamp(-MAX_TILT, MAX_TILT, vx * 0.28));
  }, { passive: true, signal });
}
