// Pins the project gallery and scrubs its horizontal track against
// vertical scroll progress, desktop-only — on narrow screens the CSS
// falls back to plain horizontal scroll-snap, so this is skipped there.
//
// While the track moves, each card is graded by how close it is to the
// centre of the viewport: the one being looked at sits forward, sharp and
// full-contrast, and the rest recede. That turns the pinned scroll into a
// camera passing objects at depth rather than a strip sliding sideways.
export function createHorizontalGallery(gsap, ScrollTrigger, prefersReducedMotion) {
  const pin = document.querySelector('.gallery-pin');
  const track = document.querySelector('.gallery-track');
  const bar = document.querySelector('.gallery-progress-bar');
  if (!pin || !track) return;

  ScrollTrigger.matchMedia({
    '(min-width: 761px)': function () {
      const distance = () => track.scrollWidth - pin.clientWidth;
      const cards = gsap.utils.toArray('.project-card');

      function grade() {
        if (prefersReducedMotion) return;
        const mid = window.innerWidth / 2;
        cards.forEach((card) => {
          const rect = card.getBoundingClientRect();
          const centre = rect.left + rect.width / 2;
          // 0 at dead centre, 1 once a full card-width off to either side.
          const offset = Math.min(Math.abs(centre - mid) / (rect.width || 1), 1);
          const eased = offset * offset;
          // Written straight to style rather than through GSAP: the track
          // (the cards' parent) is the thing GSAP is tweening, and these
          // are plain per-frame reads of layout, not an animation of their
          // own that needs easing or a timeline.
          // Custom properties rather than `transform`: the pointer tilt
          // (pointerFx.js) writes its own rotation vars, and the
          // stylesheet composes both into a single transform. Writing
          // the shorthand here would silently drop the tilt.
          card.style.setProperty('--g-scale', (1 - eased * 0.07).toFixed(4));
          card.style.setProperty('--g-y', `${(eased * 26).toFixed(2)}px`);
          card.style.opacity = String(1 - eased * 0.4);
          card.style.filter = eased > 0.02 ? `blur(${(eased * 3).toFixed(2)}px)` : 'none';
        });
      }

      const tween = gsap.to(track, {
        x: () => -distance(),
        ease: 'none',
        scrollTrigger: {
          trigger: pin,
          start: 'top top',
          end: () => '+=' + distance(),
          scrub: 0.6,
          pin: true,
          invalidateOnRefresh: true,
          onUpdate: (self) => {
            if (bar) bar.style.width = (self.progress * 100) + '%';
            grade();
          },
          onRefresh: grade,
        },
      });
      grade();

      return () => {
        tween.scrollTrigger?.kill();
        // Leave no inline grading behind when the media query flips to the
        // mobile layout, or the cards would stay dimmed and blurred there.
        cards.forEach((card) => {
          card.style.removeProperty('--g-scale');
          card.style.removeProperty('--g-y');
          card.style.opacity = '';
          card.style.filter = '';
        });
      };
    },
  });
}
