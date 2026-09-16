// Hero ink reveal.
//
// Two images stacked: the plate the visitor lands on, and the plate
// underneath it. The pointer is a brush — wherever it has been, the ink
// soaks through and the lower plate shows instead. With the two plates being
// the same wordmark in white and in black, the effect is that dragging
// across the hero flips TOBY from white to black under your hand.
//
// It is one canvas doing three draws per frame:
//
//   ink      an offscreen alpha channel the pointer paints into, and which
//            bleeds back to nothing over a few seconds
//   reveal   the lower plate, clipped to that alpha
//   stage    the upper plate, with the clipped lower plate composited on top
//
// Painting into an alpha channel rather than clipping the visible canvas
// directly is what lets the edge be soft: the brush is a radial gradient, so
// the boundary between the plates is a bleed rather than a cut.

const BRUSH = 150;        // brush radius in CSS pixels at a 1200px-wide stage
const REST = 0.34;        // how present the upper plate is before it is touched
const BLEED = 0.985;      // per-frame ink retention — how long a stroke lasts
const SPACING = 0.22;     // stamp spacing as a fraction of the brush radius

function loadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/** The photographic negative of an image, as a canvas ready to draw. */
function invert(img) {
  const c = document.createElement('canvas');
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  const g = c.getContext('2d');
  g.filter = 'invert(1)';
  g.drawImage(img, 0, 0);
  // drawCover reads naturalWidth/naturalHeight, which a canvas does not have.
  c.naturalWidth = c.width;
  c.naturalHeight = c.height;
  return c;
}

/** A soft, slightly irregular brush stamp, baked once into its own canvas. */
function makeBrush(radius) {
  const size = radius * 2;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');

  const grad = g.createRadialGradient(radius, radius, 0, radius, radius, radius);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.45, 'rgba(255,255,255,0.85)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);

  // A handful of offset blobs break the perfect circle, so a slow stroke
  // reads as ink spreading into paper rather than as an airbrush.
  for (let i = 0; i < 7; i += 1) {
    const a = (i / 7) * Math.PI * 2;
    const d = radius * (0.34 + (i % 3) * 0.12);
    const r = radius * (0.3 + (i % 4) * 0.07);
    const x = radius + Math.cos(a) * d;
    const y = radius + Math.sin(a) * d;
    const blob = g.createRadialGradient(x, y, 0, x, y, r);
    blob.addColorStop(0, 'rgba(255,255,255,0.5)');
    blob.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = blob;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }

  return c;
}

/**
 * Mounts the reveal on `[data-hero-ink]`, which names its two plates via
 * `data-plate-top` and `data-plate-under`.
 *
 * Returns a teardown function. If either plate is missing or fails to load,
 * the stage removes itself and the hero is exactly what it was without it —
 * this is decoration, and it is never allowed to be the reason the hero is
 * blank.
 */
export function createHeroInk(root, { prefersReducedMotion, signal } = {}) {
  if (!root) return () => {};

  const canvas = root.querySelector('[data-hero-ink-canvas]');
  const topSrc = root.dataset.plateTop;
  const underSrc = root.dataset.plateUnder;
  // Both plates are authored the same way — a black wordmark on white — but
  // the site is black, so the landing plate is shown as its negative: TOBY
  // comes up white on black, and the brush is what turns it black again.
  const invertTop = root.dataset.plateTopInvert !== 'false';
  // At full strength the plate's wordmark is a second headline competing with
  // the real one for the same space. Held back to a ghost, it is texture the
  // H1 sits on — and the brush is then the only thing in the hero at full
  // contrast, which is what makes the reveal read as a reveal.
  const rest = Number(root.dataset.plateRest ?? REST);
  // Only the lower plate is required; `data-plate-top` is optional and is
  // synthesised as its negative when it is absent.
  if (!canvas || !underSrc) return () => {};

  let raf = 0;
  let disposed = false;

  Promise.all([topSrc ? loadImage(topSrc) : Promise.resolve(null), loadImage(underSrc)]).then(([loadedTop, under]) => {
    if (disposed) return;
    // The lower plate is the one that has to exist: it is the artwork. The
    // upper plate is its inverse, so if only one file has been dropped in,
    // derive the other rather than refusing to run — the whole effect is a
    // swap between a mark and its negative, and a negative is computable.
    const top = loadedTop
      ? (invertTop ? invert(loadedTop) : loadedTop)
      : (under && invert(under));
    if (!top || !under) { root.remove(); return; }

    root.classList.add('is-ready');

    const ctx = canvas.getContext('2d');
    const ink = document.createElement('canvas');
    const inkCtx = ink.getContext('2d');
    const reveal = document.createElement('canvas');
    const revealCtx = reveal.getContext('2d');

    let dpr = 1;
    let w = 0;
    let h = 0;
    let brush = null;
    let brushR = BRUSH;

    // Pointer state is kept in device pixels, and `last` is what lets a fast
    // drag be a continuous stroke: stamps are interpolated between frames
    // rather than left as a dotted line of wherever the events happened to fire.
    let last = null;
    let pending = [];

    function resize() {
      const rect = root.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = Math.round(rect.width * dpr);
      h = Math.round(rect.height * dpr);
      [canvas, ink, reveal].forEach((c) => { c.width = w; c.height = h; });

      // The brush scales with the stage so the effect reads the same on a
      // phone as on a wide display, rather than covering the whole hero.
      brushR = Math.max(60, (rect.width / 1200) * BRUSH) * dpr;
      brush = makeBrush(Math.round(brushR));
      last = null;
    }

    /** Draws an image as `cover` — cropped to fill, never stretched. */
    function drawCover(target, img) {
      const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight);
      const dw = img.naturalWidth * scale;
      const dh = img.naturalHeight * scale;
      target.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
    }

    function stamp(x, y) {
      const r = brush.width / 2;
      inkCtx.drawImage(brush, x - r, y - r);
    }

    function strokeTo(x, y) {
      if (last) {
        const dx = x - last.x;
        const dy = y - last.y;
        const dist = Math.hypot(dx, dy);
        const step = Math.max(brushR * SPACING, 1);
        for (let d = step; d < dist; d += step) {
          stamp(last.x + (dx * d) / dist, last.y + (dy * d) / dist);
        }
      }
      stamp(x, y);
      last = { x, y };
    }

    function frame() {
      if (disposed) return;
      raf = requestAnimationFrame(frame);
      if (!w || !h) return;

      pending.forEach((p) => strokeTo(p.x, p.y));
      pending = [];

      // The bleed: every frame takes a little alpha back out of the ink, so
      // a stroke closes behind the visitor instead of accumulating until the
      // whole hero has flipped and the effect has nothing left to show.
      inkCtx.globalCompositeOperation = 'destination-out';
      inkCtx.fillStyle = `rgba(0,0,0,${1 - BLEED})`;
      inkCtx.fillRect(0, 0, w, h);
      inkCtx.globalCompositeOperation = 'source-over';

      revealCtx.clearRect(0, 0, w, h);
      drawCover(revealCtx, under);
      revealCtx.globalCompositeOperation = 'destination-in';
      revealCtx.drawImage(ink, 0, 0);
      revealCtx.globalCompositeOperation = 'source-over';

      ctx.clearRect(0, 0, w, h);
      ctx.globalAlpha = rest;
      drawCover(ctx, top);
      ctx.globalAlpha = 1;
      ctx.drawImage(reveal, 0, 0);
    }

    function onPointer(e) {
      const rect = root.getBoundingClientRect();
      pending.push({ x: (e.clientX - rect.left) * dpr, y: (e.clientY - rect.top) * dpr });
    }

    resize();

    if (prefersReducedMotion) {
      // No brush, no loop: the upper plate is drawn once and that is the hero.
      ctx.globalAlpha = rest;
      drawCover(ctx, top);
      ctx.globalAlpha = 1;
      return;
    }

    root.addEventListener('pointermove', onPointer, { passive: true, signal });
    root.addEventListener('pointerleave', () => { last = null; }, { passive: true, signal });
    window.addEventListener('resize', resize, { passive: true, signal });

    raf = requestAnimationFrame(frame);
  });

  return () => {
    disposed = true;
    cancelAnimationFrame(raf);
  };
}
