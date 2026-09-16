// The opening.
//
// It is capped, hard, at 1.2s. A loading screen that outlasts the load is a
// delay dressed as craft, so this one resolves on whichever comes first:
// the fonts being ready, or the cap expiring. The document underneath is
// fully parsed and readable the entire time — the overlay never gates
// content, it only covers it.
const CAP = 1200;

export function createLoader(gsap, reduced) {
  const el = document.querySelector('[data-loader]');
  if (!el) return Promise.resolve();

  // A returning visitor within the session has already seen the opening;
  // playing it again on every navigation is a toll, not an experience.
  let seen = false;
  try { seen = sessionStorage.getItem('toby:opened') === '1'; } catch { /* private window */ }
  try { sessionStorage.setItem('toby:opened', '1'); } catch { /* ignore */ }

  if (reduced || seen) {
    el.remove();
    document.documentElement.classList.remove('is-loading');
    return Promise.resolve();
  }

  const bar = el.querySelector('[data-loader-bar]');
  const pct = el.querySelector('[data-loader-pct]');
  const steps = el.querySelectorAll('[data-loader-step]');

  const ready = Promise.race([
    document.fonts?.ready ?? Promise.resolve(),
    new Promise((r) => setTimeout(r, CAP)),
  ]);

  const state = { v: 0 };
  const run = gsap.to(state, {
    v: 100,
    duration: CAP / 1000,
    ease: 'power1.inOut',
    onUpdate() {
      const v = Math.round(state.v);
      if (pct) pct.textContent = `${String(v).padStart(3, '0')}%`;
      if (bar) bar.style.transform = `scaleX(${v / 100})`;
      // The steps are the progress, not decoration: each lights as the run
      // passes its share of the bar.
      steps.forEach((s, i) => s.classList.toggle('is-on', v >= ((i + 1) / steps.length) * 100 - 1));
    },
  });

  return Promise.all([ready, run]).then(() => new Promise((resolve) => {
    gsap.timeline({
      onComplete: () => {
        el.remove();
        document.documentElement.classList.remove('is-loading');
        resolve();
      },
    })
      .to(el.querySelector('[data-loader-inner]'), { opacity: 0, duration: 0.25, ease: 'power2.in' })
      // The curtain leaves upward, so the page is uncovered from the bottom
      // and the hero is the last thing revealed rather than the first.
      .to(el, { yPercent: -100, duration: 0.7, ease: 'expo.inOut' }, '-=0.05');
  }));
}
