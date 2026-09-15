// The opening beat: a black plate that counts depth up from zero while TOBY
// resolves out of it, then lifts away.
//
// Two-tier readiness. The counter used to wait for every signal to land,
// which meant the visitor sat on a loading plate while things they could
// not yet see finished arriving. Instead the work is split:
//
//   blocking     — what must genuinely exist before the page can be looked
//                  at: the fonts the headings are set in, and a real first
//                  frame out of the abyss renderer (which includes shader
//                  compilation — the long pole, and the one thing that
//                  cannot be deferred without showing a black screen).
//   non-blocking — marine snow, and anything else that enriches a picture
//                  that is already complete. These are started here but
//                  never gate the curtain; they fade in underneath a
//                  visitor who is already scrolling.
//
// In practice the curtain lifts at roughly four-fifths of the total work,
// which is the point of the split. What makes it safe is that the boundary
// is drawn around *what has to be on screen*, not around a percentage —
// gating on a raw 80% would happily lift the curtain mid shader-compile and
// reveal a black rectangle, which is worse than the wait it saved.
const MIN_DURATION = 1400; // never flash by too fast to read
const MAX_WAIT = 6000; // never hold the page hostage to a slow GPU

/**
 * @param {object} gsap
 * @param {boolean} prefersReducedMotion
 * @param {Promise<unknown>[]} blocking extra signals to wait on, beyond fonts
 */
export function createPreloader(gsap, prefersReducedMotion, blocking = []) {
  const root = document.querySelector('[data-preloader]');
  if (!root) return Promise.resolve();

  const counterEl = root.querySelector('[data-preloader-count]');
  const barEl = root.querySelector('[data-preloader-bar]');
  const markEl = root.querySelector('[data-preloader-mark]');

  document.documentElement.classList.add('is-loading');

  function finish() {
    document.documentElement.classList.remove('is-loading');
    root.remove();
  }

  if (prefersReducedMotion) {
    finish();
    return Promise.resolve();
  }

  // Split the wordmark so each letter can resolve on its own beat.
  if (markEl) {
    const text = markEl.textContent.trim();
    markEl.textContent = '';
    text.split('').forEach((ch) => {
      const span = document.createElement('span');
      span.className = 'preloader-letter';
      span.textContent = ch;
      markEl.appendChild(span);
    });
  }

  const started = performance.now();
  const readiness = { value: 0 }; // 0..1 across the blocking set only
  const shown = { value: 0 }; // 0..1, what the counter has caught up to

  const signals = [];
  // Heading font: a swap after the curtain lifts would reflow the hero in
  // front of the visitor, which is exactly what the plate exists to hide.
  if (document.fonts?.ready) signals.push(document.fonts.ready);
  signals.push(...blocking);
  // `load` is intentionally NOT here. With the footage gone there is no
  // large media left to wait on, and holding for every deferred subresource
  // would put the page back behind the same wall the split removes.

  const total = Math.max(signals.length, 1);
  let done = 0;
  signals.forEach((p) => {
    Promise.resolve(p)
      .catch(() => {})
      .then(() => { done += 1; readiness.value = done / total; });
  });
  if (!signals.length) readiness.value = 1;

  const entrance = gsap.timeline();
  entrance.from('.preloader-letter', {
    yPercent: 110,
    opacity: 0,
    duration: 0.9,
    ease: 'power4.out',
    stagger: 0.07,
  });

  return new Promise((resolve) => {
    let raf;
    function tick() {
      const elapsed = performance.now() - started;
      // The counter chases real readiness, but is also floored by elapsed
      // time so it always visibly moves even when everything is instant.
      const timeFloor = Math.min(elapsed / MIN_DURATION, 1);
      const target = Math.min(readiness.value, timeFloor);
      shown.value += (target - shown.value) * 0.08;

      const pct = Math.round(shown.value * 100);
      if (counterEl) counterEl.textContent = String(pct).padStart(3, '0');
      if (barEl) barEl.style.transform = `scaleX(${shown.value})`;

      const ready = readiness.value >= 1 && elapsed >= MIN_DURATION && pct >= 99;
      if (ready || elapsed > MAX_WAIT) {
        cancelAnimationFrame(raf);
        if (counterEl) counterEl.textContent = '100';
        if (barEl) barEl.style.transform = 'scaleX(1)';

        gsap.timeline({
          onComplete: () => { finish(); resolve(); },
        })
          .to('.preloader-letter', {
            yPercent: -110,
            opacity: 0,
            duration: 0.7,
            ease: 'power3.inOut',
            stagger: 0.04,
          })
          .to('.preloader-meta', { opacity: 0, duration: 0.4, ease: 'power2.out' }, '-=0.6')
          // The plate lifts as a curtain rather than a crossfade, so the
          // dive underneath is revealed rather than faded into.
          .to(root, {
            clipPath: 'inset(0% 0% 100% 0%)',
            duration: 1.1,
            ease: 'expo.inOut',
          }, '-=0.25');
        return;
      }
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
  });
}
