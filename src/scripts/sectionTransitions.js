// Section-boundary camera moves: axis changes and pin releases dramatized
// as physical camera turns rather than eased fades.
//
// The site's existing premise is "the page is underwater, so light is what
// moves" (see sectionFx.js). These two effects extend it with a second half
// of the same idea: the current also turns. Direction changes get a felt
// camera move, matching how depth and light already carry the rest of the
// dive's emotional weight.
//
// Neither effect adds scroll distance: both scrub across ground the page
// already travels — the natural gap before the gallery pin engages, and the
// pin's own release point — so cinema.js's scroll -> video-time mapping is
// untouched. Both are desktop-only, matching horizontal.js's own breakpoint:
// below it the gallery is a plain scroll-snap row, so there's no axis change
// to dramatize.
const AXIS_ROTATION = 78;

/**
 * 02 -> 03: the skill matrix's vertical network gives way to the pinned
 * horizontal gallery. The handoff plays as a hinge turning on the seam
 * between them — the skill stage swings away like a door shutting, the
 * gallery swings into place like the next one opening — scrubbed across
 * exactly the natural, unpinned scroll distance between the skill matrix
 * ending and the gallery pin engaging.
 */
export function createAxisTurn(gsap, ScrollTrigger, prefersReducedMotion) {
  if (prefersReducedMotion) return;

  const outgoing = document.querySelector('.skill-stage');
  const incoming = document.querySelector('.gallery-viewport');
  const pin = document.querySelector('.gallery-pin');
  if (!outgoing || !incoming || !pin) return;

  ScrollTrigger.matchMedia({
    '(min-width: 761px)': function () {
      const hinge = document.createElement('span');
      hinge.className = 'axis-hinge';
      hinge.setAttribute('aria-hidden', 'true');
      outgoing.insertAdjacentElement('afterend', hinge);

      gsap.set([outgoing, incoming], { transformPerspective: 1400 });

      // Driven with a plain onUpdate + gsap.set rather than a scrubbed
      // fromTo: values are computed straight from self.progress every
      // frame, so there's no "from" state for ScrollTrigger.refresh() to
      // re-apply out of turn (the trap documented on the tech-chip
      // assemble in sectionFx.js) — refresh only changes where progress
      // 0 and 1 fall, never what gets rendered at a given progress.
      const trigger = ScrollTrigger.create({
        trigger: outgoing,
        start: 'bottom 92%',
        endTrigger: pin,
        end: 'top top',
        scrub: 0.35,
        onUpdate(self) {
          const p = self.progress;
          const turning = p > 0.02 && p < 0.98;
          outgoing.classList.toggle('is-turning', turning);
          incoming.classList.toggle('is-turning', turning);

          gsap.set(outgoing, {
            rotateY: -AXIS_ROTATION * p,
            transformOrigin: 'right center',
            filter: `blur(${(p * 6).toFixed(2)}px)`,
            opacity: 1 - p * 0.75,
          });
          gsap.set(incoming, {
            rotateY: AXIS_ROTATION * 0.85 * (1 - p),
            transformOrigin: 'left center',
            filter: `blur(${((1 - p) * 6).toFixed(2)}px)`,
            opacity: 0.25 + p * 0.75,
          });
          // The hinge only reads as a hinge while the turn is actually
          // happening — lit at the start and end of the scrub, dark once
          // either panel has settled.
          const hingeVisibility = Math.max(0, Math.min(p * 4, 1, (1 - p) * 4));
          gsap.set(hinge, { scaleY: hingeVisibility, opacity: hingeVisibility });
        },
      });

      return () => {
        trigger.kill();
        hinge.remove();
        outgoing.classList.remove('is-turning');
        incoming.classList.remove('is-turning');
        gsap.set([outgoing, incoming], { clearProps: 'transform,filter,opacity' });
      };
    },
  });
}

/**
 * 03 -> 04: the gallery pin releases and the camera turns back to face
 * forward. A quick iris punctuates the release — the visible cue for
 * anyone without the water shader (mobile, low-power, a lost WebGL
 * context) — and the same moment fires a decaying pressure-wave pulse
 * through the shader itself for everyone who has it (see waterShader.js).
 */
export function createGalleryTurnabout(gsap, ScrollTrigger, prefersReducedMotion) {
  if (prefersReducedMotion) return;

  const pin = document.querySelector('.gallery-pin');
  const iris = document.querySelector('[data-boundary-iris]');
  if (!pin) return;

  ScrollTrigger.matchMedia({
    '(min-width: 761px)': function () {
      // 'bottom top' on the pinned element fires exactly when its pinned
      // distance (100vh + the scrub track) has fully passed — the moment
      // horizontal.js releases the pin.
      const trigger = ScrollTrigger.create({
        trigger: pin,
        start: 'bottom top',
        onEnter: () => {
          window.dispatchEvent(new CustomEvent('cinema:boundary', { detail: { kind: 'turn' } }));
          if (!iris) return;
          iris.classList.remove('is-firing');
          // Force a reflow so the animation restarts if the boundary is
          // crossed again later in the same page life (scrolling back up
          // and back down).
          void iris.offsetWidth;
          iris.classList.add('is-firing');
        },
      });

      return () => trigger.kill();
    },
  });
}
