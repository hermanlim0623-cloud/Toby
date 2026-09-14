// Ocean atmosphere: a handful of CSS-driven rising bubbles (injected once,
// animated purely by CSS keyframes — no per-frame JS cost), a depth-meter
// readout, and the scrim's darkening — all three read the same scroll
// progress as the cinema controller so the numbers, the vignette and the
// footage always agree about how deep the dive currently is.
const MAX_DEPTH_M = 2000;

export function createOceanAtmosphere(prefersReducedMotion) {
  const bubbleHost = document.querySelector('#bubbles');
  if (bubbleHost && !prefersReducedMotion) {
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
      bubbleHost.appendChild(b);
    }
  }

  const depthEl = document.querySelector('[data-depth-meters]');
  const root = document.documentElement;
  let smoothedDepth = 0;
  let raf = null;

  function tick() {
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const progress = docHeight > 0 ? Math.min(Math.max(window.scrollY / docHeight, 0), 1) : 0;
    // Ease in — a dive accelerates: the first screens go shallow fast,
    // the abyss keeps opening up further the longer you keep scrolling.
    // The cinematic footage itself stays linear all the way through (it
    // has no "ascent" clip), but the depth reading — like the closing
    // copy — recedes through the transmission/shutdown stretch so the
    // numbers agree with "returning to surface" rather than contradicting it.
    let eased;
    if (progress <= 0.82) {
      eased = Math.pow(progress / 0.82, 1.35);
    } else {
      const riseT = (progress - 0.82) / 0.18;
      eased = 1 - riseT * 0.92;
    }
    const target = Math.max(eased, 0) * MAX_DEPTH_M;

    smoothedDepth += (target - smoothedDepth) * (prefersReducedMotion ? 1 : 0.07);
    if (depthEl) depthEl.textContent = `${Math.round(smoothedDepth)}m`;

    // The vignette darkens with depth so HTML content stays legible
    // against whatever the current clip is doing, without ever going
    // fully opaque (the footage should still read through).
    root.style.setProperty('--scrim-a', (0.28 + eased * 0.5).toFixed(3));

    raf = requestAnimationFrame(tick);
  }
  raf = requestAnimationFrame(tick);

  return { destroy() { cancelAnimationFrame(raf); } };
}
