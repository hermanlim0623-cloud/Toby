// Odometer digits for the pipeline stats.
//
// A number tween shows a blur of changing text; an odometer shows
// mechanism — each column physically rolls and the columns settle
// right-to-left, which makes the figure feel arrived at rather than
// merely displayed.
const DIGITS = '0123456789';
/** Full 0-9 cycles spun before landing, so every column visibly rolls. */
const SPINS = 2;
const STOPS = DIGITS.length * (SPINS + 1);

/**
 * Replaces a counter's text with one rolling column per digit.
 * Each digit is its own block so the strip is a real column of lines —
 * a single text node inside a flex column is one wrapped line, not ten.
 */
function buildColumns(el, value) {
  const text = String(value);
  el.textContent = '';
  el.classList.add('odo');

  // A screen reader should hear "1000", not thirty loose digits. This is a
  // visually-hidden text node rather than an aria-label, because
  // aria-label is prohibited on a plain <span>: with no role, there is
  // nothing for the name to attach to, and assistive tech may drop it.
  const readable = document.createElement('span');
  readable.className = 'sr-only';
  readable.textContent = text;
  el.appendChild(readable);

  return Array.from(text, (digit) => {
    const col = document.createElement('span');
    col.className = 'odo-col';
    col.setAttribute('aria-hidden', 'true');

    const strip = document.createElement('span');
    strip.className = 'odo-strip';
    for (let i = 0; i < SPINS + 1; i++) {
      for (const d of DIGITS) {
        const cell = document.createElement('span');
        cell.className = 'odo-digit';
        cell.textContent = d;
        strip.appendChild(cell);
      }
    }

    col.appendChild(strip);
    el.appendChild(col);
    return { strip, target: Number(digit) };
  });
}

export function createOdometers(gsap, ScrollTrigger, prefersReducedMotion) {
  const counters = document.querySelectorAll('[data-counter]');
  if (!counters.length) return;

  counters.forEach((el) => {
    const value = parseInt(el.dataset.counter || '', 10);
    if (Number.isNaN(value)) return;

    if (prefersReducedMotion) {
      el.textContent = value.toLocaleString();
      return;
    }

    const columns = buildColumns(el, value);

    ScrollTrigger.create({
      trigger: el,
      start: 'top 90%',
      once: true,
      onEnter() {
        columns.forEach(({ strip, target }, i) => {
          // yPercent is a share of the strip's own height, and the strip
          // is STOPS digits tall — so landing on the Nth digit is
          // -(N / STOPS) * 100, not -N * anything.
          const landing = -((DIGITS.length * SPINS + target) / STOPS) * 100;
          gsap.fromTo(strip,
            { yPercent: 0 },
            { yPercent: landing, duration: 1.5 + i * 0.18, ease: 'power4.out' });
        });
      },
    });
  });
}
