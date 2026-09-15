// The readouts that tell the visitor where in the machine they are: the layer
// indicator, the drifting carrier particles, and the scrim that keeps copy
// legible as the environment brightens and darkens under it.
//
// All three read the same scroll progress the camera reads, so the number in
// the corner, the vignette and what is actually on screen can never disagree.
// That is the only reason the indicator is trustworthy — it is not a separate
// estimate of position, it is the same one.

/** The narrative layers, in order. These are the sections of the page. */
const LAYERS = [
  'IDENTITY',
  'CAPABILITIES',
  'WORK',
  'MACHINES',
  'SYSTEMS',
  'TRANSMISSION',
  'CONTACT',
];

export function createTelemetry(prefersReducedMotion) {
  const carrierHost = document.querySelector('#bubbles');
  if (carrierHost && !prefersReducedMotion) {
    const count = window.innerWidth < 700 ? 6 : 12;
    for (let i = 0; i < count; i++) {
      const b = document.createElement('span');
      b.className = 'bubble';
      const size = 4 + Math.random() * 10;
      b.style.setProperty('--bs', `${size}px`);
      b.style.setProperty('--bd', `${14 + Math.random() * 14}s`);
      b.style.setProperty('--bt', `${Math.random() * -20}s`);
      b.style.setProperty('--bx', `${(Math.random() - 0.5) * 60}px`);
      b.style.left = `${Math.random() * 100}%`;
      carrierHost.appendChild(b);
    }
  }

  const layerEl = document.querySelector('[data-depth-meters]');
  const nameEl = document.querySelector('[data-layer-name]');
  const root = document.documentElement;
  let smoothed = 0;
  let raf = null;
  let shownLayer = -1;

  function tick() {
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const progress = docHeight > 0 ? Math.min(Math.max(window.scrollY / docHeight, 0), 1) : 0;

    // Ease in — a descent accelerates: the first screens pass quickly, and
    // the machine keeps opening up the longer you keep going. The closing
    // stretch reverses, so the readout climbs back toward the entry layer as
    // the copy talks about output and completion rather than contradicting it.
    let eased;
    if (progress <= 0.82) {
      eased = Math.pow(progress / 0.82, 1.35);
    } else {
      const riseT = (progress - 0.82) / 0.18;
      eased = 1 - riseT * 0.92;
    }
    const target = Math.max(eased, 0);

    smoothed += (target - smoothed) * (prefersReducedMotion ? 1 : 0.07);

    // Quantised to the layer, and only written when it changes. A readout
    // that reprints an identical string sixty times a second is churn the
    // browser has to do nothing useful with, and it makes the one moment
    // that *does* matter — crossing into a new layer — impossible to notice.
    const index = Math.min(
      LAYERS.length - 1,
      Math.max(0, Math.round(smoothed * (LAYERS.length - 1))),
    );
    if (index !== shownLayer) {
      shownLayer = index;
      if (layerEl) {
        layerEl.textContent = `${String(index + 1).padStart(2, '0')} / ${LAYERS.length}`;
      }
      if (nameEl) nameEl.textContent = LAYERS[index];
    }

    // The scrim deepens with descent so copy stays legible against whatever
    // the environment is doing, without ever going opaque enough to hide
    // that there is something rendering behind it.
    root.style.setProperty('--scrim-a', (0.24 + smoothed * 0.3).toFixed(3));

    raf = requestAnimationFrame(tick);
  }
  raf = requestAnimationFrame(tick);

  return { destroy() { cancelAnimationFrame(raf); } };
}
