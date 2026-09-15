// The opening beat: before the dive is revealed, the screen holds on a
// black plate that counts depth up from zero while TOBY resolves out of
// it, then lifts away. It doubles as honest loading cover — the counter
// tracks real progress (fonts + the dive footage), and the curtain only
// lifts once those are actually ready, so nobody lands on a half-painted
// page or a video that hasn't decoded its first frame yet.
const MIN_DURATION = 1400; // never flash by too fast to read
const MAX_WAIT = 3000; // never hold the page hostage to a slow asset

export function createPreloader(gsap, prefersReducedMotion) {
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
  const readiness = { value: 0 }; // 0..1, what's actually loaded
  const shown = { value: 0 }; // 0..1, what the counter has caught up to

  // Real signals, not a fake timer. Deliberately NOT waiting on the dive
  // video's first frame: that's multiple megabytes, and the poster frame
  // behind the curtain covers the gap until it decodes. Holding the
  // visitor on a loading plate for a whole video download would be the
  // worse trade.
  const signals = [];
  if (document.fonts?.ready) signals.push(document.fonts.ready);
  signals.push(new Promise((resolve) => {
    const poster = new Image();
    poster.onload = resolve;
    poster.onerror = resolve;
    poster.src = '/videos/dive-poster.jpg';
  }));
  signals.push(new Promise((resolve) => {
    if (document.readyState === 'complete') resolve();
    else window.addEventListener('load', resolve, { once: true });
  }));

  const total = signals.length;
  let done = 0;
  signals.forEach((p) => {
    Promise.resolve(p)
      .catch(() => {})
      .then(() => { done += 1; readiness.value = done / total; });
  });

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
      // time so it always visibly moves even when everything loads instantly.
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
