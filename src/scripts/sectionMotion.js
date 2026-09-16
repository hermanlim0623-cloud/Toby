// Per-section motion.
//
// Every section is its own scene with its own lifecycle, and nothing here
// is play-once. A section that has been scrolled past and returned to plays
// again, in either direction, indefinitely — there is deliberately no
// `hasPlayed` flag anywhere in this file.
//
// Two effects, and only two:
//
//   focus      a scrub. The section is sharp while it owns the viewport and
//              softens as it enters and leaves, continuously, following the
//              scroll position rather than firing once on entry.
//   odometers  a replay. Entering the section resets its numbers to zero
//              and rolls them to their values again.
//
// ScrollTrigger drives both rather than IntersectionObserver: it is already
// wired to Lenis and the GSAP ticker, so its notion of scroll position is
// the same one the rest of the site animates against. An observer would be
// a second, slightly-out-of-step source of truth.

/** How soft a section gets once it is out of the focal area. */
const BLUR = 4;
const DIM = 0.35;
const SHRINK = 0.97;

/**
 * The focus scrub.
 *
 * The timeline is laid out with a plateau in the middle rather than a
 * single sharp point: without it, a section taller than the viewport would
 * only be legible at the instant its centre crossed the screen's centre and
 * would be soft for the whole time it was actually being read.
 */
function focusFor(gsap, ScrollTrigger, section) {
  const soft = { filter: `blur(${BLUR}px)`, opacity: DIM, scale: SHRINK };
  const sharp = { filter: 'blur(0px)', opacity: 1, scale: 1 };

  return gsap.timeline({
      scrollTrigger: {
        trigger: section,
        // Across the section's whole passage, so progress 0.5 is its centre
        // at the viewport's centre whatever its height.
        start: 'top bottom',
        end: 'bottom top',
        scrub: 0.4,
      },
      defaults: { ease: 'none' },
    })
    .fromTo(section, soft, { ...sharp, duration: 0.3 })
    .to(section, { ...sharp, duration: 0.4 })
    .to(section, { ...soft, duration: 0.3 });
}

/**
 * Binds one section's odometers to its own entry and exit.
 *
 * `onEnter` and `onEnterBack` both replay, which is what makes this work
 * scrolling up as well as down; `onLeave` and `onLeaveBack` rewind so the
 * next entry starts from zero rather than from the settled value.
 */
function odometersFor(ScrollTrigger, section, group) {
  // A guard rather than a debounce: a fast scroll can cross the start and
  // end edges within one tick, and without this the section would reset
  // itself immediately after playing and show nothing at all.
  let live = false;

  const enter = () => {
    if (live) return;
    live = true;
    group.play();
  };
  const leave = () => {
    if (!live) return;
    live = false;
    group.reset();
  };

  ScrollTrigger.create({
    trigger: section,
    // The activation band: the section has to be meaningfully on screen,
    // not merely touching an edge, before its numbers are worth rolling.
    start: 'top 75%',
    end: 'bottom 25%',
    onEnter: enter,
    onEnterBack: enter,
    onLeave: leave,
    onLeaveBack: leave,
  });

  // A section already inside the band on load has no crossing to react to.
  if (ScrollTrigger.isInViewport(section, 0.25)) enter();
}

export function createSectionMotion(gsap, ScrollTrigger, reduced, buildOdometers) {
  const sections = gsap.utils.toArray('[data-motion]');
  if (!sections.length) return;

  sections.forEach((section) => {
    const group = buildOdometers(section);
    if (group) {
      if (reduced) group.reset();
      else odometersFor(ScrollTrigger, section, group);
    }
    // Reduced motion keeps the layout and drops the scrub entirely: a
    // section is simply always sharp.
    if (!reduced) focusFor(gsap, ScrollTrigger, section);
  });
}
