// Text that resolves out of noise.
//
// Used for the transmission status line, where a plain textContent swap
// wasted the one moment in the section that is meant to read as a machine
// acquiring a signal rather than as text changing.

/**
 * Resolves `text` into `el`, character by character, out of random
 * glyphs. Resolves when the string has settled.
 */
const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&*/\\<>';

export function decodeInto(el, text, { duration = 900 } = {}) {
  if (!el) return Promise.resolve();

  const start = performance.now();
  // Each character resolves at its own moment, left to right, so the
  // string settles like a signal locking on rather than all at once.
  const settleAt = Array.from(text, (_, i) => (i / Math.max(text.length - 1, 1)) * 0.75);

  return new Promise((resolve) => {
    let raf;
    function frame(now) {
      const p = Math.min((now - start) / duration, 1);
      el.textContent = Array.from(text, (ch, i) => {
        if (ch === ' ') return ' ';
        if (p >= settleAt[i] + 0.25) return ch;
        return GLYPHS[(Math.random() * GLYPHS.length) | 0];
      }).join('');

      if (p >= 1) {
        el.textContent = text;
        cancelAnimationFrame(raf);
        resolve();
        return;
      }
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);
  });
}
