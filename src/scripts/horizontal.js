// Pins the project gallery and scrubs its horizontal track against
// vertical scroll progress, desktop-only — on narrow screens the CSS
// falls back to plain horizontal scroll-snap, so this is skipped there.
export function createHorizontalGallery(gsap, ScrollTrigger) {
  const pin = document.querySelector('.gallery-pin');
  const track = document.querySelector('.gallery-track');
  const bar = document.querySelector('.gallery-progress-bar');
  if (!pin || !track) return;

  ScrollTrigger.matchMedia({
    '(min-width: 761px)': function () {
      const distance = () => track.scrollWidth - pin.clientWidth;

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
          },
        },
      });

      return () => tween.scrollTrigger && tween.scrollTrigger.kill();
    },
  });
}
