// Ocean atmosphere: a handful of CSS-driven rising bubbles (injected once,
// animated purely by CSS keyframes — no per-frame JS cost) plus a small
// depth-meter readout tied to scroll position, selling "the deeper you
// scroll, the deeper you go" cheaply without a real 3D water simulation.
const MAX_DEPTH_M = 340;

export function createOceanAtmosphere(prefersReducedMotion) {
  const bubbleHost = document.querySelector('#bubbles');
  if (bubbleHost && !prefersReducedMotion) {
    const count = window.innerWidth < 700 ? 8 : 16;
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
  if (!depthEl) return;

  function update() {
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const progress = docHeight > 0 ? Math.min(Math.max(window.scrollY / docHeight, 0), 1) : 0;
    // Dive down through ~80% of the page, then rise back toward the
    // surface for the closing transmission/shutdown stretch.
    const depthCurve = progress <= 0.8 ? progress / 0.8 : 1 - (progress - 0.8) / 0.2;
    depthEl.textContent = `${Math.round(depthCurve * MAX_DEPTH_M)}m`;
  }

  let ticking = false;
  window.addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => { update(); ticking = false; });
  }, { passive: true });
  update();
}
