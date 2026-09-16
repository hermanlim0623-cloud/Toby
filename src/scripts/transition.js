// The slash transition.
//
// Navigation is the brand mark doing something. Clicking a project closes
// two blue halves along the diagonal of the "/" until they meet and the
// viewport is solid accent, the document is swapped behind that cover, and
// the halves then open along the same line so the destination is revealed
// *through* the aperture rather than faded in over the old page.
//
// The order matters and it is the whole point. Astro's
// `astro:before-preparation` lets its loader be wrapped, so the fetch and
// swap are made to wait until the cover is complete. Without that the new
// page would appear first and the animation would be decoration over a
// navigation that had already happened.
//
// One mechanism serves every route; nothing here knows which project was
// clicked, only that the page is changing.

/** The diagonal, matching the typographic slash the identity is built on. */
const ANGLE = 20;
// 300 + 40 + 380 = 720ms of mechanism, which leaves room for the fetch and
// the swap inside the brief's 700-1000ms without the visitor waiting.
const CLOSE = 300;
const HOLD = 40;
const OPEN = 380;
const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';

/** IDLE -> CLOSING -> COVERED -> OPENING -> IDLE.
 *
 *  A second navigation started mid-transition joins the run in flight rather
 *  than being ignored. Ignoring it left the cover up forever: the second
 *  navigation's loader went unwrapped, so it swapped and fired page-load
 *  while the first run was still closing, and nothing was left to open it. */
let phase = 'IDLE';
/** The close currently in flight, so a second navigation can await it. */
let closing = null;

export function createTransitions(reduced) {
  // The cover is rendered by the layout with transition:persist rather than
  // created here. The router replaces document.body on every swap, so an
  // element built from script is destroyed by the first navigation and the
  // transition runs exactly once; persisting it keeps one live node whose
  // in-flight animation survives the swap it exists to hide.
  const root = document.querySelector('[data-pt]');
  if (!root) return;

  const rot = root.querySelector('[data-pt-rot]');
  const a = root.querySelector('[data-pt-a]');
  const b = root.querySelector('[data-pt-b]');
  const mark = root.querySelector('[data-pt-mark]');

  const animate = (el, frames, ms, extra = {}) => el.animate(frames, {
    duration: ms, easing: EASE, fill: 'forwards', ...extra,
  }).finished;

  /** Closes, or hands back the close already running. */
  function ensureClosed() {
    if (phase === 'COVERED') return Promise.resolve();
    if (closing) return closing;
    closing = close().finally(() => { closing = null; });
    return closing;
  }

  function close() {
    phase = 'CLOSING';
    root.dataset.on = '';
    return Promise.all([
      animate(a, [{ transform: 'translateY(-100%)' }, { transform: 'translateY(0%)' }], CLOSE),
      animate(b, [{ transform: 'translateY(100%)' }, { transform: 'translateY(0%)' }], CLOSE),
      // The mark grows with the closing halves: the slash is what arrives,
      // and the blue is the slash at full size.
      animate(mark, [
        { opacity: 0, transform: 'translate(-50%, -50%) scale(0.55)' },
        { opacity: 1, transform: 'translate(-50%, -50%) scale(1)' },
      ], CLOSE),
    ]).then(() => { phase = 'COVERED'; });
  }

  function open() {
    if (phase === 'OPENING' || phase === 'IDLE') return Promise.resolve();
    phase = 'OPENING';
    animate(mark, [{ opacity: 1 }, { opacity: 0 }], 140);
    return Promise.all([
      animate(a, [{ transform: 'translateY(0%)' }, { transform: 'translateY(-100%)' }], OPEN),
      animate(b, [{ transform: 'translateY(0%)' }, { transform: 'translateY(100%)' }], OPEN),
    ]).then(() => {
      delete root.dataset.on;
      phase = 'IDLE';
    });
  }

  // Reduced motion gets the navigation without the mechanism: the swap
  // happens, nothing sweeps across the screen.
  if (reduced) {
    root.remove();
    document.addEventListener('astro:after-swap', () => window.scrollTo(0, 0));
    return;
  }

  document.addEventListener('astro:before-preparation', (event) => {
    // Going back runs the halves in from the mirrored sides, so the same
    // mechanism reads as operating backwards rather than repeating itself.
    if (phase === 'IDLE') {
      rot.style.setProperty('--pt-angle', `${event.direction === 'back' ? ANGLE + 180 : ANGLE}deg`);
    }

    const load = event.loader;
    event.loader = async () => {
      // The fetch runs alongside the cover rather than after it, so the
      // animation is the navigation instead of a delay in front of one.
      // Every navigation waits for the cover, including one that arrives
      // while an earlier one is still closing.
      await Promise.all([ensureClosed(), load()]);
      await new Promise((r) => setTimeout(r, HOLD));
    };
  });

  document.addEventListener('astro:after-swap', () => {
    // The new document arrives at the top. Scrolling there while it is still
    // behind the cover is what stops the page jumping as the aperture opens.
    window.scrollTo(0, 0);
  });

  document.addEventListener('astro:page-load', () => {
    // Any state but idle means a cover is up and owes the page an opening.
    if (phase !== 'IDLE') open();
  });
}
