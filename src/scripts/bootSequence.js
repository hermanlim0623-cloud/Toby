// The opening: a system coming up, not a loading screen.
//
// The difference matters. A loading screen shows a number that stands in for
// work the visitor cannot see; this shows the work itself. Three checks —
// signal, renderer, field — each resolve when the thing they name is actually
// ready, and the sequence is paced around them.
//
// Two clocks run at once, and keeping them separate is the whole design:
//
//   the score     A fixed set of beats — darkness, then the field stirring,
//                 then the checks, then the wordmark, then the role. It runs
//                 on its own timing so the opening always has the same shape
//                 and never feels like it is waiting for something.
//   readiness     What must genuinely exist before the visitor can be handed
//                 the page: the display font, and a real first frame out of
//                 the renderer, which includes shader compilation — the long
//                 pole, and the one thing that cannot be deferred without
//                 revealing a black rectangle.
//
// The score can finish early; the handover cannot happen until readiness has
// also landed. When the machine is slow the sequence holds on the checks,
// which is honest — it is still initialising, and it says which part. When
// the machine is fast the checks resolve almost instantly and the score is
// what the visitor experiences. Either way nobody watches a fake counter.
//
// MAX_WAIT is the backstop: past it the page is handed over regardless, on
// the grounds that a visitor stuck behind a boot screen has already lost more
// than a missing first frame would cost them.
const BEAT = {
  STIR: 400, // the field becomes visible at all
  CHECKS: 900, // the checks appear and start resolving
  MARK: 1900, // TOBY
  ROLE: 2500, // creative technologist
  CLEAR: 3100, // earliest the curtain may lift
};
const MAX_WAIT = 6500;

/** Resolves after `ms`, unless the signal aborts first. */
const wait = (ms, signal) => new Promise((resolve) => {
  const id = setTimeout(resolve, ms);
  signal?.addEventListener('abort', () => { clearTimeout(id); resolve(); }, { once: true });
});

/**
 * @param {object} gsap
 * @param {boolean} prefersReducedMotion
 * @param {{ renderer?: Promise<unknown>, field?: Promise<unknown> }} signals
 *   Real readiness promises. Anything missing is treated as already met, so
 *   a page without an environment still boots cleanly.
 */
export function createBootSequence(gsap, prefersReducedMotion, signals = {}) {
  const root = document.querySelector('[data-boot]');
  if (!root) return Promise.resolve();

  const markEl = root.querySelector('[data-boot-mark]');
  const roleEl = root.querySelector('[data-boot-role]');
  const checksEl = root.querySelector('[data-boot-checks]');

  document.documentElement.classList.add('is-booting');

  function finish() {
    document.documentElement.classList.remove('is-booting');
    root.remove();
  }

  // Reduced motion gets the same information with none of the choreography.
  // Holding someone who has asked for stillness behind a timed sequence is
  // the exact thing the preference is asking us not to do.
  if (prefersReducedMotion) {
    finish();
    return Promise.resolve();
  }

  /** Marks one check resolved, and reports whether all of them now are. */
  function settle(name) {
    const row = checksEl?.querySelector(`[data-boot-check="${name}"]`);
    if (!row) return;
    row.classList.add('is-ready');
    const state = row.querySelector('.boot-state');
    if (state) state.textContent = 'OK';
  }

  const fontReady = document.fonts?.ready ?? Promise.resolve();
  const rendererReady = Promise.resolve(signals.renderer ?? true);
  const fieldReady = Promise.resolve(signals.field ?? true);

  // Each check lights as its own promise lands, independently of the score.
  fontReady.catch(() => {}).then(() => settle('signal'));
  rendererReady.catch(() => {}).then(() => settle('renderer'));
  fieldReady.catch(() => {}).then(() => settle('field'));

  const blocking = Promise.all([
    fontReady.catch(() => {}),
    rendererReady.catch(() => {}),
    fieldReady.catch(() => {}),
  ]);

  // Split the wordmark so each letter can resolve on its own beat.
  if (markEl) {
    const text = markEl.textContent.trim();
    markEl.textContent = '';
    text.split('').forEach((ch) => {
      const span = document.createElement('span');
      span.className = 'boot-letter';
      span.textContent = ch;
      markEl.appendChild(span);
    });
  }

  const score = (async () => {
    await wait(BEAT.STIR);
    root.classList.add('is-stirring');

    await wait(BEAT.CHECKS - BEAT.STIR);
    root.classList.add('is-checking');

    await wait(BEAT.MARK - BEAT.CHECKS);
    gsap.to('.boot-letter', {
      opacity: 1,
      yPercent: 0,
      filter: 'blur(0px)',
      duration: 0.9,
      ease: 'power4.out',
      stagger: 0.06,
    });

    await wait(BEAT.ROLE - BEAT.MARK);
    if (roleEl) {
      gsap.to(roleEl, { opacity: 1, y: 0, duration: 0.8, ease: 'power3.out' });
    }

    await wait(BEAT.CLEAR - BEAT.ROLE);
  })();

  const backstop = wait(MAX_WAIT);

  return Promise.race([
    Promise.all([score, blocking]),
    backstop,
  ]).then(() => new Promise((resolve) => {
    gsap.timeline({ onComplete: () => { finish(); resolve(); } })
      .to('.boot-letter', {
        yPercent: -110,
        opacity: 0,
        duration: 0.6,
        ease: 'power3.inOut',
        stagger: 0.035,
      })
      .to([roleEl, checksEl], {
        opacity: 0, duration: 0.35, ease: 'power2.out',
      }, '-=0.5')
      // The plate lifts as a shutter rather than a crossfade, so the
      // environment underneath is revealed rather than faded into.
      .to(root, {
        clipPath: 'inset(0% 0% 100% 0%)',
        duration: 1.0,
        ease: 'expo.inOut',
      }, '-=0.2');
  }));
}
