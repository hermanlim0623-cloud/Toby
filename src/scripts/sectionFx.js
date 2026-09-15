// Section-level motion, built on one idea rather than six unrelated ones:
// the page is underwater, so light is the thing that moves. Every effect
// here is a variation on light arriving — sweeping across a headline,
// travelling down a timeline, igniting a stage as data reaches it.
//
// Each effect is a no-op when its markup is absent, so the case-study
// pages can share this module without carrying the dive's sections.

/**
 * A band of light sweeping across a heading, character by character.
 *
 * Every section heading is already split into `.char` spans by reveals.js
 * for the rise-in. Rather than add a second competing animation, the
 * shimmer rides the same spans: each one's `--lit` goes 0 -> 1 -> 0 on a
 * stagger, so the highlight reads as one band crossing the words.
 */
export function createHeadingShimmer(gsap, ScrollTrigger, prefersReducedMotion) {
  if (prefersReducedMotion) return;

  gsap.utils.toArray('[data-split]').forEach((heading) => {
    const chars = heading.querySelectorAll('.char');
    if (!chars.length) return;

    gsap.fromTo(
      chars,
      { '--lit': 0 },
      {
        '--lit': 1,
        duration: 0.5,
        ease: 'sine.inOut',
        stagger: { each: 0.03, from: 'start' },
        // Light passes over; it does not stay on. The yoyo return is what
        // makes it a sweep rather than a permanent glow.
        repeat: 1,
        yoyo: true,
        scrollTrigger: { trigger: heading, start: 'top 80%', once: true },
      }
    );
  });
}

/**
 * The tech chips converge into place instead of fading in.
 *
 * Scatter is seeded per index rather than random so the assembly is
 * identical on every visit — a layout that reshuffles itself each reload
 * reads as a glitch, not as choreography.
 */
export function createTechAssemble(gsap, ScrollTrigger, prefersReducedMotion) {
  const cloud = document.querySelector('[data-tech-cloud]');
  if (!cloud) return;

  const chips = gsap.utils.toArray('.tech-chip', cloud);
  if (!chips.length) return;

  if (prefersReducedMotion) {
    chips.forEach((c) => { c.style.opacity = '1'; });
    return;
  }

  // Scatter is kept deliberately tight: a wider one threw chips across the
  // body copy above and below the cloud, which reads as a broken layout
  // rather than as assembly.
  //
  // `fromTo` rather than `from`, and with immediateRender off. A `from`
  // tween re-applies its start values on every ScrollTrigger.refresh() —
  // and this page refreshes after the boot sequence and again on load — which
  // left the chips parked at the scattered state with the tween reporting
  // itself complete. Naming both ends removes the ambiguity.
  gsap.fromTo(chips,
    {
      x: (i) => (i % 2 ? 1 : -1) * (18 + (i % 4) * 10),
      y: (i) => (i % 3 ? -1 : 1) * (14 + (i % 3) * 8),
      rotation: (i) => (i % 2 ? 1 : -1) * (3 + (i % 3) * 2),
      scale: 0.88,
      opacity: 0,
      filter: 'blur(5px)',
    },
    {
      x: 0,
      y: 0,
      rotation: 0,
      scale: 1,
      opacity: 1,
      filter: 'blur(0px)',
      duration: 0.8,
      ease: 'power3.out',
      stagger: { each: 0.04, from: 'center' },
      immediateRender: false,
      scrollTrigger: { trigger: cloud, start: 'top 85%', once: true },
    });
}

/**
 * The pipeline stages ignite in sequence as the section is scrolled, so
 * the five labels read as one process running rather than five boxes
 * appearing. Scrubbed, not timed: the reader controls the throughput.
 */
export function createPipelineIgnition(gsap, ScrollTrigger, prefersReducedMotion) {
  const stages = gsap.utils.toArray('[data-stage]');
  if (!stages.length) return;

  if (prefersReducedMotion) {
    stages.forEach((s) => s.classList.add('is-live'));
    return;
  }

  const section = document.querySelector('[data-automation]');
  ScrollTrigger.create({
    trigger: section || stages[0],
    start: 'top 70%',
    end: 'bottom 60%',
    scrub: true,
    onUpdate(self) {
      // One stage per equal slice of the section's travel.
      const lit = Math.floor(self.progress * stages.length + 0.0001);
      stages.forEach((stage, i) => stage.classList.toggle('is-live', i < lit));
    },
  });
}

/**
 * A light travelling down the timeline spine, with each entry's node
 * igniting as it passes. Scales to however many entries exist.
 */
export function createTimelineSpine(gsap, ScrollTrigger, prefersReducedMotion) {
  const timeline = document.querySelector('[data-timeline]');
  if (!timeline) return;

  const fill = timeline.querySelector('[data-timeline-fill]');
  const rows = gsap.utils.toArray('.timeline-row', timeline);

  if (prefersReducedMotion) {
    if (fill) fill.style.transform = 'scaleY(1)';
    rows.forEach((r) => r.classList.add('is-reached'));
    return;
  }

  if (fill) {
    gsap.fromTo(fill, { scaleY: 0 }, {
      scaleY: 1,
      ease: 'none',
      scrollTrigger: { trigger: timeline, start: 'top 75%', end: 'bottom 70%', scrub: 0.5 },
    });
  }

  rows.forEach((row) => {
    ScrollTrigger.create({
      trigger: row,
      start: 'top 72%',
      onEnter: () => row.classList.add('is-reached'),
      onLeaveBack: () => row.classList.remove('is-reached'),
    });
  });
}
