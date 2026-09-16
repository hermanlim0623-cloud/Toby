// The technology section classifies itself.
//
// The brief this section answers is an argument: what a thing is built with
// and what it does are different claims, and listing "Automation" beside
// "Python" makes one look like the other. So the section makes that argument
// rather than presenting its conclusion.
//
// The inventory arrives undivided, with no headings and no gaps, and its
// numbering visibly repeats: 01-08, then 01-05, then 01-08 again. A single
// list has no business counting like that. The partition is what resolves
// it, opening the three groups apart and writing their names into the space
// that appears.
//
// The gaps are opened with transforms against the finished layout rather
// than by animating margins, so twenty-one items never reflow.

const IN_STAGGER = 0.014;
const IN_DUR = 0.22;
/** The beat between the inventory landing and the split beginning. Long
 *  enough for the repeating numbers to be noticed, which is the whole
 *  reason the undivided state is worth showing. */
const HOLD = 0.22;
const SPLIT_DUR = 0.46;
const SPLIT_STAGGER = 0.07;
const HEAD_DUR = 0.34;

export function createTechPartition(gsap, ScrollTrigger, reduced) {
  const section = document.querySelector('[data-tech]');
  if (!section) return undefined;

  const groups = [...section.querySelectorAll('.tech-group')];
  const heads = groups.map((g) => g.querySelector('.tech-head'));
  const items = [...section.querySelectorAll('.tech-item')];
  if (groups.length < 2 || heads.some((h) => !h) || reduced) return undefined;

  let tl = null;

  /** Closes the section back into one undivided list. */
  function arm() {
    // Measured per run: the heading block's height moves with the
    // breakpoint, and a stale figure would leave a gap half open.
    const gap = parseFloat(getComputedStyle(groups[0].querySelector('.tech-list')).rowGap) || 0;
    let acc = 0;
    const closed = groups.map((_, g) => {
      const cs = getComputedStyle(heads[g]);
      acc += parseFloat(cs.marginTop) + heads[g].offsetHeight + parseFloat(cs.marginBottom);
      // Pulled up by every heading block above it and its own, then given
      // back one row gap so the seam matches the spacing inside a list.
      return -acc + (g + 1) * gap;
    });

    groups.forEach((group, g) => gsap.set(group, { y: closed[g] }));
    gsap.set(heads, { opacity: 0 });
    gsap.set(items, { opacity: 0, y: 10 });
    return closed;
  }

  function play() {
    tl?.kill();
    arm();
    tl = gsap.timeline();

    // ---- inventory: one continuous stagger straight through the group
    // boundaries, because at this point there are no groups.
    items.forEach((item, i) => {
      tl.to(item, {
        opacity: 1, y: 0, duration: IN_DUR, ease: 'power2.out',
      }, i * IN_STAGGER);
    });

    // ---- partition: the groups come apart from the top down, each one
    // carrying everything below it, and the names arrive in the new space.
    const split = items.length * IN_STAGGER + IN_DUR + HOLD;
    groups.forEach((group, g) => {
      const at = split + g * SPLIT_STAGGER;
      tl.to(group, { y: 0, duration: SPLIT_DUR, ease: 'power3.out' }, at);
      tl.to(heads[g], {
        opacity: 1, duration: HEAD_DUR, ease: 'none',
      }, at + SPLIT_DUR * 0.35);
    });
  }

  arm();

  const trigger = ScrollTrigger.create({
    trigger: section,
    start: 'top 70%',
    // Replayed in both directions, like the rest of the section motion.
    onEnter: play,
    onEnterBack: play,
  });

  return () => {
    tl?.kill();
    trigger.kill();
    gsap.set([...groups, ...heads, ...items], { clearProps: 'transform,opacity' });
  };
}
