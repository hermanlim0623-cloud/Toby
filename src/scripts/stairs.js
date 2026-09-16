// The staircase transition. Prototype, one route.
//
// Five columns across the viewport, each rising to its own step height in
// sequence, so the silhouette builds one step at a time:
//
//                 ┌────
//             ┌───┘
//         ┌───┘
//     ┌───┘
//  ┌──┘
//
// Then the steps close up into a full wall, the document is swapped behind
// it, and the wall comes apart again step by step in reverse order, the new
// page showing through each gap as it opens.
//
// The reading is meant to be TAK TAK TAK rather than a whoosh, so the
// stagger is doing the work and each column's own move is short. Everything
// is translateY on a column that is already the right size: no frame of
// this costs a layout.

const STEPS = 5;
// Budgeted against the brief's 700-1000ms for the whole navigation, which
// has to include the fetch and the swap as well as the animation:
// 360 build + 70 close + 278 unbuild = 708ms of mechanism.
//
// The stagger is what carries the reading, so it is protected and the
// per-step durations are what got shortened. A step that takes longer than
// the gap to the next one turns TAK TAK TAK back into a whoosh.
/** Build: one step at a time, left to right, ascending. */
const IN_STAGGER = 60;
const IN_DUR = 120;
/** The steps closing up into a full wall. */
const CLOSE_DUR = 70;
/** Unbuild: the top step leaves first, so it reads as coming back down. */
const OUT_STAGGER = 42;
const OUT_DUR = 110;
const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';

/** Where column i's top edge sits when the staircase is built, as a
 *  percentage of its own height still below the fold. */
const restingAt = (i) => 100 - ((i + 1) / STEPS) * 100;

export function createStairs(root) {
  const columns = [...root.querySelectorAll('[data-stair]')];
  if (columns.length !== STEPS) return null;

  const play = (el, frames, ms, delay) => el.animate(frames, {
    duration: ms, delay, easing: EASE, fill: 'forwards',
  }).finished;

  return {
    /**
     * Builds the staircase one step at a time, then closes the steps into a
     * full wall. Resolves once the viewport is covered.
     */
    async cover() {
      root.dataset.on = '';
      await Promise.all(columns.map((el, i) => play(
        el,
        [{ transform: 'translateY(100%)' }, { transform: `translateY(${restingAt(i)}%)` }],
        IN_DUR,
        i * IN_STAGGER,
      )));
      // The staircase becomes the transition layer. One move, no stagger:
      // the steps have been read already and repeating the rhythm here
      // would turn a beat into a sequence.
      await Promise.all(columns.map((el, i) => play(
        el,
        [{ transform: `translateY(${restingAt(i)}%)` }, { transform: 'translateY(0%)' }],
        CLOSE_DUR,
        0,
      )));
    },

    /**
     * Takes the wall apart in reverse order, top step first, revealing the
     * page behind each column as it drops.
     */
    async uncover() {
      await Promise.all(columns.map((el, i) => play(
        el,
        [{ transform: 'translateY(0%)' }, { transform: 'translateY(100%)' }],
        OUT_DUR,
        (STEPS - 1 - i) * OUT_STAGGER,
      )));
      delete root.dataset.on;
    },

    /** Straight to hidden, for a run that was interrupted. */
    reset() {
      columns.forEach((el) => {
        el.getAnimations().forEach((a) => a.cancel());
        el.style.transform = 'translateY(100%)';
      });
      delete root.dataset.on;
    },
  };
}
