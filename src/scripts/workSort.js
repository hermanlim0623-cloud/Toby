// The work list sorts itself.
//
// The projects are a report, and a report is what comes out of unordered
// records. So the rows arrive out of order and the section resolves them,
// running a real selection sort rather than miming one: the pass below is
// the same one the animation shows, and the swaps it emits are the swaps
// on screen.
//
// The DOM is never wrong. Rows sit in their true order from the first
// frame and only their transforms lie about where they are, so the reading
// order, the tab order and the link targets are correct even mid-sort, and
// nothing here costs a layout.

/** Where each row starts, by slot. A fixed derangement rather than a random
 *  shuffle: no row may begin in its finished position, or the sort has
 *  nothing to say about it, and a constant keeps every visit and every test
 *  run identical. */
const ARRIVAL = [3, 6, 1, 5, 0, 4, 2];

const IN_STAGGER = 0.025;
const IN_DUR = 0.15;
// Wide enough that at most two exchanges overlap. Tighter than this and ten
// rows are in flight at once, which reads as the list collapsing rather than
// as records changing places.
const SWAP_STAGGER = 0.105;
const SWAP_DUR = 0.22;
const FLASH = 0.16;
/** How far the descending row of a pair recedes as the two cross. */
const PASS = 0.45;

/** Runs the sort on a copy, returning the exchanges it took.
 *  @param {number[]} start slot -> the row index sitting in it
 *  @returns {[number, number][]} pairs of slots exchanged, in order */
function solve(start) {
  const cur = start.slice();
  const swaps = [];
  for (let s = 0; s < cur.length; s += 1) {
    const t = cur.indexOf(s);
    if (t === s) continue;
    [cur[s], cur[t]] = [cur[t], cur[s]];
    swaps.push([s, t]);
  }
  return swaps;
}

export function createWorkSort(gsap, ScrollTrigger, reduced) {
  const list = document.querySelector('[data-work-list]');
  if (!list) return undefined;

  const rows = [...list.querySelectorAll('.work-row')];
  const status = document.querySelector('[data-work-status]');
  const setStatus = (word) => { if (status) status.dataset.state = word; };

  // More rows than the arrival order accounts for would leave the extras
  // unplaced, which is worse than not running at all.
  if (rows.length !== ARRIVAL.length || reduced) {
    setStatus('done');
    return undefined;
  }

  let tl = null;

  /** Puts the rows in their arrival order, ready but not yet running.
   *  Done at mount as well as at replay: left to the trigger, the first
   *  scroll would show the finished list, throw it back into disorder and
   *  only then sort it, which reads as a glitch rather than as a process. */
  function arm() {
    // Measured per run: the row height changes with the breakpoint, and a
    // stale offset would land the rows between slots.
    const tops = rows.map((r) => r.offsetTop);
    const slotOf = ARRIVAL.slice();
    const cur = [];
    slotOf.forEach((slot, i) => { cur[slot] = i; });
    const to = (i, slot) => tops[slot] - tops[i];

    rows.forEach((row, i) => gsap.set(row, { y: to(i, slotOf[i]), opacity: 0 }));
    // The rows move under the pointer, so a hover during the sort would
    // report whichever row happened to slide beneath the cursor.
    list.style.pointerEvents = 'none';
    return { cur, slotOf, to };
  }

  function play() {
    tl?.kill();
    const { cur, slotOf, to } = arm();
    setStatus('sorting');

    tl = gsap.timeline({
      onComplete: () => {
        list.style.pointerEvents = '';
        setStatus('done');
      },
    });

    // ---- ingest: the records land in arrival order, top to bottom, so
    // the numbers are read out of sequence before anything moves.
    [...rows]
      .sort((a, b) => slotOf[rows.indexOf(a)] - slotOf[rows.indexOf(b)])
      .forEach((row, n) => {
        tl.to(row, { opacity: 1, duration: IN_DUR, ease: 'none' }, n * IN_STAGGER);
      });

    // ---- sort: each exchange moves both rows at once, which is what makes
    // it read as two records trading places rather than a list reshuffling.
    const start = rows.length * IN_STAGGER + IN_DUR;
    // The live slot map is walked alongside the solved exchanges, so the
    // rows animated at each step are the ones actually standing there.
    const live = cur.slice();
    const moved = new Set();
    solve(cur).forEach(([a, b], n) => {
      const at = start + n * SWAP_STAGGER;
      const rowA = rows[live[a]];
      const rowB = rows[live[b]];
      [live[a], live[b]] = [live[b], live[a]];
      moved.add(rowA).add(rowB);

      // Two rows trading slots have to pass through each other. The one
      // going down gives way: it drops behind and dims through the crossing,
      // so the moment reads as one record passing another rather than as two
      // lines colliding.
      tl.to(rowA, { y: to(live[b], b), duration: SWAP_DUR, ease: 'power2.inOut' }, at);
      tl.to(rowA, {
        opacity: PASS, duration: SWAP_DUR / 2, repeat: 1, yoyo: true, ease: 'none',
      }, at);
      tl.set(rowA, { zIndex: 0 }, at);
      tl.set(rowA, { zIndex: '' }, at + SWAP_DUR);
      tl.set(rowB, { zIndex: 1 }, at);
      tl.to(rowB, { y: to(live[a], a), duration: SWAP_DUR, ease: 'power2.inOut' }, at);
      // The accent names the pair being exchanged. It is the one thing on
      // screen doing that, which is the only reason it earns the colour.
      tl.to([rowA, rowB].map((r) => r.querySelector('.work-num')), {
        color: 'var(--accent)',
        duration: FLASH,
        repeat: 1,
        yoyo: true,
        ease: 'none',
        clearProps: 'color',
      }, at);
    });

    // A row the exchanges never touch would hold its arrival offset for
    // good. The current constant leaves none, but the sort is the thing
    // being trusted here, not the constant.
    const swaps = solve(cur).length;
    const end = start + Math.max(0, swaps - 1) * SWAP_STAGGER;
    rows.filter((row) => !moved.has(row))
      .forEach((row) => tl.to(row, { y: 0, duration: SWAP_DUR, ease: 'power2.inOut' }, end));
  }

  arm();
  setStatus('queued');

  const trigger = ScrollTrigger.create({
    trigger: list,
    start: 'top 80%',
    // Replayed in both directions, like the rest of the section motion:
    // scrolling back to the work is arriving at it again.
    onEnter: play,
    onEnterBack: play,
  });

  return () => {
    tl?.kill();
    trigger.kill();
    gsap.set(rows, { clearProps: 'transform,opacity' });
    list.style.pointerEvents = '';
  };
}
