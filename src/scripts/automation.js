// SECTION 05 — AUTOMATION: an animated pipeline (INPUT -> PROCESS ->
// DECISION -> ACTION -> OUTPUT) with particles flowing along the SVG path.
//
// The stage labels are lit in sequence by sectionFx.js and the figures
// roll by odometer.js; this module owns the path and its particles.
export function createAutomationPipeline(gsap, ScrollTrigger, prefersReducedMotion) {
  const root = document.querySelector('[data-automation]');
  if (!root) return;

  const path = root.querySelector('[data-flow-path]');
  const dots = root.querySelectorAll('[data-flow-dot]');
  const stages = root.querySelectorAll('[data-stage]');

  if (prefersReducedMotion || !path) {
    stages.forEach((s) => (s.style.opacity = 1));
    return;
  }

  const len = path.getTotalLength();

  stages.forEach((s) => {
    gsap.fromTo(s, { opacity: 0, y: 18 }, {
      opacity: 1, y: 0, duration: 0.7, ease: 'power3.out',
      scrollTrigger: { trigger: s, start: 'top 82%' },
    });
  });

  // Particles flow along the path via a manual per-frame loop (avoids
  // pulling in the MotionPathPlugin just for this).
  let raf;
  function loop() {
    const t = performance.now() / 1000;
    dots.forEach((dot, i) => {
      const offset = ((t * 0.09) + i / dots.length) % 1;
      const point = path.getPointAtLength(offset * len);
      dot.setAttribute('cx', point.x);
      dot.setAttribute('cy', point.y);
    });
    raf = requestAnimationFrame(loop);
  }
  ScrollTrigger.create({
    trigger: root,
    start: 'top 90%',
    end: 'bottom top',
    onEnter: () => { if (!raf) loop(); },
    onEnterBack: () => { if (!raf) loop(); },
    onLeave: () => { cancelAnimationFrame(raf); raf = null; },
    onLeaveBack: () => { cancelAnimationFrame(raf); raf = null; },
  });

  // The particle loop is driven by ScrollTrigger enter/leave, so killing
  // the triggers alone would leave it running against detached nodes after
  // a navigation — hand the caller a way to stop it outright.
  const stop = () => { cancelAnimationFrame(raf); raf = null; };

  // Counters are handled by odometer.js — see the note there on why a
  // rolling column reads as arrival where a number tween reads as noise.

  return { destroy: stop };
}
