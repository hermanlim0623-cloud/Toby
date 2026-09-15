import { test, expect } from '@playwright/test';
import { planSeek, clampToBuffered, SEEK_TIMEOUT } from '../src/scripts/seekPolicy.js';

/** Stand-in for a TimeRanges object. */
const ranges = (...pairs: [number, number][]) => ({
  length: pairs.length,
  start: (i: number) => pairs[i][0],
  end: (i: number) => pairs[i][1],
});

const base = {
  readyState: 4,
  currentTime: 0,
  target: 5,
  buffered: ranges([0, 10]),
  seekingSince: 0,
  now: 1000,
};

test.describe('clampToBuffered', () => {
  test('passes a target that is already loaded straight through', () => {
    expect(clampToBuffered(ranges([0, 10]), 4)).toBe(4);
  });

  test('pulls a target past the loaded region back to the loaded edge', () => {
    // The whole point: never ask for a frame the browser does not have.
    expect(clampToBuffered(ranges([0, 3]), 8)).toBeCloseTo(2.95);
  });

  test('returns null when nothing is buffered yet', () => {
    expect(clampToBuffered(ranges(), 4)).toBeNull();
  });

  test('handles a gap between ranges by using the earlier one', () => {
    expect(clampToBuffered(ranges([0, 2], [6, 9]), 4)).toBeCloseTo(1.95);
  });

  test('a target before everything buffered snaps to the first range', () => {
    expect(clampToBuffered(ranges([5, 9]), 1)).toBe(5);
  });
});

test.describe('planSeek', () => {
  test('seeks to the target under normal conditions', () => {
    expect(planSeek(base)).toBe(5);
  });

  test('does nothing before metadata is known', () => {
    // A currentTime assignment at readyState 0 is a request the browser
    // may silently discard — and a discarded seek never fires `seeked`.
    expect(planSeek({ ...base, readyState: 0 })).toBeNull();
  });

  test('does nothing while a recent seek is still in flight', () => {
    expect(planSeek({ ...base, seekingSince: 900, now: 1000 })).toBeNull();
  });

  test('ignores a sub-frame difference rather than seeking every tick', () => {
    expect(planSeek({ ...base, currentTime: 5.001, target: 5 })).toBeNull();
  });

  // The regression this whole module exists for.
  test('recovers when a seek is never acknowledged', () => {
    const issuedAt = 1000;
    const stillWaiting = planSeek({ ...base, seekingSince: issuedAt, now: issuedAt + SEEK_TIMEOUT - 1 });
    expect(stillWaiting).toBeNull();

    // `seeked` never arrived. Past the deadline the controller must be
    // free to try again — a boolean latch here froze the dive until the
    // visitor reloaded, which is what made the page look broken on a
    // first visit and fine on the second.
    const afterDeadline = planSeek({ ...base, seekingSince: issuedAt, now: issuedAt + SEEK_TIMEOUT + 1 });
    expect(afterDeadline).toBe(5);
  });

  test('trails the download instead of stalling when the target is unbuffered', () => {
    // First visit: scrolled to 8s, only 3s has arrived.
    const seek = planSeek({ ...base, target: 8, buffered: ranges([0, 3]) });
    expect(seek).toBeCloseTo(2.95);
  });

  test('does nothing when no data has arrived at all', () => {
    expect(planSeek({ ...base, buffered: ranges() })).toBeNull();
  });
});
