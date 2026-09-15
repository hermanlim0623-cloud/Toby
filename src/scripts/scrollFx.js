// Scroll-reactive motion that isn't tied to any one section: content takes
// on a slight vertical stretch when the page is thrown, sections drift at
// different rates so the page has parallax depth, and a hairline rail
// reports overall progress through the dive.
export function createScrollFx(gsap, ScrollTrigger, prefersReducedMotion) {
  const rail = document.querySelector('[data-progress-rail]');

  if (rail) {
    gsap.to(rail, {
      scaleY: 1,
      ease: 'none',
      scrollTrigger: { start: 0, end: 'max', scrub: 0.4 },
    });
  }

  if (prefersReducedMotion) return;

  // Parallax: anything marked with a depth factor moves against the scroll,
  // so foreground copy and background furniture separate as you travel.
  gsap.utils.toArray('[data-parallax]').forEach((el) => {
    const factor = parseFloat(el.dataset.parallax) || 0.15;
    gsap.fromTo(el,
      { yPercent: -factor * 50 },
      {
        yPercent: factor * 50,
        ease: 'none',
        scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom top', scrub: 0.6 },
      });
  });

  // Velocity stretch: a fast flick squashes content very slightly along the
  // travel axis and releases as the scroll settles. Kept subtle — it should
  // register as weight, not as a visible wobble.
  const targets = gsap.utils.toArray('main section .wrap');
  if (!targets.length) return;

  const setters = targets.map((el) => gsap.quickSetter(el, 'scaleY'));
  let current = 1;

  ScrollTrigger.create({
    start: 0,
    end: 'max',
    onUpdate(self) {
      const velocity = self.getVelocity();
      const stretch = gsap.utils.clamp(-0.045, 0.045, velocity / 26000);
      current += (1 + stretch - current) * 0.2;
      setters.forEach((set) => set(current));
    },
  });

  // Ease back to rest when scrolling stops, otherwise the last frame's
  // stretch would stay baked in.
  let settleRaf = null;
  function settle() {
    current += (1 - current) * 0.08;
    setters.forEach((set) => set(current));
    if (Math.abs(current - 1) > 0.0005) settleRaf = requestAnimationFrame(settle);
    else settleRaf = null;
  }
  ScrollTrigger.addEventListener('scrollEnd', () => {
    if (!settleRaf) settleRaf = requestAnimationFrame(settle);
  });
}
