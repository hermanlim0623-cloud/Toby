// Rolling numbers.
//
// A real odometer, not a counter: each digit is a column of 0–9 inside a
// one-line mask, and rolling a number means sliding each column to its own
// digit. That is what makes 09 → 10 work: the columns are independent, so
// the tens carries at its own moment instead of the whole number being
// re-rendered as a string.
//
// Building the columns replaces the element's text, so the final value is
// written into the HTML by the page and read back from there. Without
// JavaScript the correct number is already on the screen; this only takes
// over the way it arrives.

const ROWS = 10;

/**
 * Turns `el` into digit columns and returns a handle that can reset and
 * replay it any number of times.
 *
 * Non-digits (a plus, a slash, a space) are passed through as static
 * cells, so "09+" and "2026" both work without the caller separating the
 * number from its unit.
 */
export function buildOdometer(el) {
  // `||`, not `??`: a bare `data-odometer` attribute reads as an empty
  // string rather than undefined, and `?? ` would accept that empty string
  // and build nothing at all.
  const value = (el.dataset.odometer || el.textContent || '').trim();
  if (!value) return null;

  el.textContent = '';
  el.classList.add('odo');

  // The value stays in the document as real text rather than as an
  // aria-label: a label on a plain span with no role is invalid and is
  // dropped by assistive tech, so the number would simply have gone missing.
  // The columns beside it are decorative machinery and are hidden.
  const readable = document.createElement('span');
  readable.className = 'sr-only';
  readable.textContent = value;
  el.appendChild(readable);

  const strips = [];
  for (const ch of value) {
    if (!/[0-9]/.test(ch)) {
      const fixed = document.createElement('span');
      fixed.className = 'odo-fixed';
      fixed.setAttribute('aria-hidden', 'true');
      fixed.textContent = ch;
      el.appendChild(fixed);
      continue;
    }

    const column = document.createElement('span');
    column.className = 'odo-d';
    column.setAttribute('aria-hidden', 'true');

    const strip = document.createElement('span');
    strip.className = 'odo-s';
    for (let i = 0; i < ROWS; i += 1) {
      const cell = document.createElement('span');
      cell.textContent = String(i);
      strip.appendChild(cell);
    }

    column.appendChild(strip);
    el.appendChild(column);
    strips.push({ strip, digit: Number(ch) });
  }

  return strips.length ? strips : null;
}

/**
 * Binds the odometers inside `root` to a GSAP timeline that can be replayed
 * from the start on every section entry.
 *
 * Each column travels from 0 to its digit, passing through every digit
 * between: the roll is the point, so the easing is gentle and the columns
 * to the right take longer, the way a real odometer's units wheel spins
 * furthest while the tens barely moves.
 */
export function createOdometerTimeline(gsap, root, reduced) {
  const built = [];
  root.querySelectorAll('[data-odometer]').forEach((el) => {
    const strips = buildOdometer(el);
    if (strips) built.push(...strips);
  });
  if (!built.length) return null;

  const settle = (s) => gsap.set(s.strip, { yPercent: -s.digit * ROWS });
  if (reduced) {
    built.forEach(settle);
    return { play: () => {}, reset: () => built.forEach(settle) };
  }

  const tl = gsap.timeline({ paused: true });
  built.forEach((s, i) => {
    tl.fromTo(s.strip,
      { yPercent: 0 },
      {
        yPercent: -s.digit * ROWS,
        // Longer for a bigger climb, so every column lands with the same
        // sense of weight rather than the 9s racing the 1s.
        duration: 0.5 + (s.digit / 9) * 0.55,
        ease: 'power2.out',
      },
      // Staggered across the group, so a section of numbers reads as one
      // mechanism settling instead of a row of things firing at once.
      i * 0.045);
  });

  return {
    play: () => { tl.restart(true); },
    reset: () => { tl.pause(0); },
  };
}
