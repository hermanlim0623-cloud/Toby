// The decision of *whether and where* to seek, split out from the video
// element so it can be tested without one.
//
// This exists because the bug it guards against is invisible in a test
// browser: it only appears on a first visit, over a real network, with a
// partially-buffered file — the exact conditions a headless run does not
// reproduce. Keeping the rule pure means it can be asserted directly.

/** HTMLMediaElement.HAVE_METADATA — below this, `duration` is not known. */
export const HAVE_METADATA = 1;

/** How long a seek may stay unacknowledged before we assume it is lost. */
export const SEEK_TIMEOUT = 500;

/** Tolerance: don't chase differences smaller than one frame at 60fps. */
const EPSILON = 1 / 60;

/**
 * Snap a target time to something the browser can actually reach.
 *
 * While the file is still downloading, seeking past the buffered region is
 * what produces a seek that never completes. Clamping to loaded data makes
 * the dive trail the scroll during load and catch up as bytes arrive,
 * rather than stopping on whatever frame it was showing.
 *
 * @param {{length: number, start: (i: number) => number, end: (i: number) => number}} ranges
 * @param {number} t
 * @returns {number | null} a reachable time, or null if nothing is buffered
 */
export function clampToBuffered(ranges, t) {
  if (!ranges || ranges.length === 0) return null;

  for (let i = 0; i < ranges.length; i++) {
    if (t >= ranges.start(i) && t <= ranges.end(i)) return t;
  }

  // Outside every range: use the furthest loaded point behind the target.
  for (let i = ranges.length - 1; i >= 0; i--) {
    if (ranges.end(i) < t) return Math.max(ranges.start(i), ranges.end(i) - 0.05);
  }

  // The target sits before everything buffered (a fast scroll back up
  // while only a later region is loaded) — the first range is the closest
  // reachable point.
  return ranges.start(0);
}

/**
 * @param {object} state
 * @param {number} state.readyState      video.readyState
 * @param {number} state.currentTime     video.currentTime
 * @param {number} state.target          where the scroll wants the playhead
 * @param {object} state.buffered        video.buffered
 * @param {number} state.seekingSince    timestamp of the in-flight seek, 0 if none
 * @param {number} state.now             performance.now()
 * @returns {number | null} the time to assign, or null to do nothing
 */
export function planSeek({ readyState, currentTime, target, buffered, seekingSince, now }) {
  // Assigning currentTime before the browser knows the duration is a
  // request it may discard — and a discarded seek never fires `seeked`.
  if (readyState < HAVE_METADATA) return null;

  // A seek is "in flight" only until its deadline. Past that we assume the
  // acknowledgement is never coming and allow a fresh attempt; without
  // this, one dropped `seeked` wedges the controller for the life of the
  // page, which is exactly the "it only works after a refresh" symptom.
  if (seekingSince > 0 && now - seekingSince < SEEK_TIMEOUT) return null;

  if (Math.abs(currentTime - target) <= EPSILON) return null;

  const reachable = clampToBuffered(buffered, target);
  if (reachable === null) return null;
  if (Math.abs(currentTime - reachable) <= EPSILON) return null;

  return reachable;
}
