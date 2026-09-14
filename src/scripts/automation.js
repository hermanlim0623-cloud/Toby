// SECTION 05 — AUTOMATION: an animated pipeline (INPUT -> PROCESS ->
// DECISION -> ACTION -> OUTPUT) with particles flowing along the SVG path
// and counters that tick up once the section is in view.
export function createAutomationPipeline(gsap, ScrollTrigger, prefersReducedMotion) {
  const root = document.querySelector('[data-automation]');
  if (!root) return;

  const path = root.querySelector('[data-flow-path]');
  const dots = root.querySelectorAll('[data-flow-dot]');
  const counters = root.querySelectorAll('[data-counter]');
  const stages = root.querySelectorAll('[data-stage]');

  if (prefersReducedMotion || !path) {
    counters.forEach((c) => (c.textContent = c.dataset.counter));
    stages.forEach((s) => (s.style.opacity = 1));
    return;
  }

  const len = path.getTotalLength();

  stages.forEach((s, i) => {
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

  counters.forEach((el) => {
    const target = parseInt(el.dataset.counter, 10);
    if (Number.isNaN(target)) return;
    const obj = { val: 0 };
    gsap.to(obj, {
      val: target,
      duration: 1.6,
      ease: 'power2.out',
      scrollTrigger: { trigger: el, start: 'top 90%', once: true },
      onUpdate() { el.textContent = Math.round(obj.val).toLocaleString(); },
    });
  });
}
