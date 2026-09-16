// The staircase transition.
//
// Navigation is the work being built. Clicking a project raises five blue
// columns one after another until they stand as a staircase and the viewport
// is solid accent, the document is swapped behind that cover, and the columns
// then drop in reverse so the destination is revealed by the mechanism
// unbuilding itself rather than faded in over the old page.
//
// The order matters and it is the whole point. Astro's
// `astro:before-preparation` lets its loader be wrapped, so the fetch and
// swap are made to wait until the cover is complete. Without that the new
// page would appear first and the animation would be decoration over a
// navigation that had already happened.
//
// One mechanism serves every route; nothing here knows which project was
// clicked, only that the page is changing.

import { createStairs } from './stairs.js';

/** The pause between the cover completing and the swap being revealed,
 *  which keeps the built staircase readable for a beat. */
const HOLD = 40;

/** IDLE -> CLOSING -> COVERED -> OPENING -> IDLE.
 *
 *  A second navigation started mid-transition joins the run in flight rather
 *  than being ignored. Ignoring it left the cover up forever: the second
 *  navigation's loader went unwrapped, so it swapped and fired page-load
 *  while the first run was still closing, and nothing was left to open it. */
let phase = 'IDLE';
/** The cover currently in flight, so a second navigation can await it. */
let closing = null;

export function createTransitions(reduced) {
  // The cover is rendered by the layout with transition:persist rather than
  // created here. The router replaces document.body on every swap, so an
  // element built from script is destroyed by the first navigation and the
  // transition runs exactly once; persisting it keeps one live node whose
  // in-flight animation survives the swap it exists to hide.
  const root = document.querySelector('[data-stairs]');
  if (!root) return;

  const stairs = createStairs(root);

  // Reduced motion gets the navigation without the mechanism: the swap
  // happens, nothing is built across the screen.
  if (reduced) {
    root.remove();
    document.addEventListener('astro:after-swap', () => window.scrollTo(0, 0));
    return;
  }

  /** Covers, or hands back the cover already running. */
  function ensureCovered() {
    if (phase === 'COVERED') return Promise.resolve();
    if (closing) return closing;
    phase = 'CLOSING';
    closing = stairs.cover()
      .then(() => { phase = 'COVERED'; })
      .finally(() => { closing = null; });
    return closing;
  }

  async function uncover() {
    phase = 'OPENING';
    await stairs.uncover();
    phase = 'IDLE';
  }

  document.addEventListener('astro:before-preparation', (event) => {
    const load = event.loader;
    event.loader = async () => {
      // The fetch runs alongside the cover rather than after it, so the
      // animation is the navigation instead of a delay in front of one.
      // Every navigation waits for the cover, including one that arrives
      // while an earlier one is still building.
      await Promise.all([ensureCovered(), load()]);
      await new Promise((r) => setTimeout(r, HOLD));
    };
  });

  document.addEventListener('astro:after-swap', () => {
    // The new document arrives at the top. Scrolling there while it is still
    // behind the cover is what stops the page jumping as the steps drop.
    window.scrollTo(0, 0);
  });

  document.addEventListener('astro:page-load', () => {
    // Any state but idle means a cover is up and owes the page an opening.
    if (phase === 'IDLE') return;
    uncover();
  });
}
