// The ink reveal.
//
// Three layers, composited once per frame:
//
//   art    the artwork, drawn once by the caller and never moved again
//   ink    an alpha buffer the pointer paints into, and which decays back to
//          empty a little every frame
//   stage  the art, masked by the ink, which is all the visitor ever sees
//
// The art never moves. A `destination-in` composite is what makes the reveal
// local: whatever the brush has not touched has no alpha, and what has no
// alpha is not merely faint, it is absent. That is the difference between
// discovering something and being shown it.
//
// Canvas rather than a CSS mask, because the ink has to *accumulate* and
// then decay. CSS can move a mask but it cannot remember where the mask has
// been, and the short memory is the whole feel of the effect.
//
// Two artworks share this: the hero's diagonal band and the footer's field.
// Only the drawing differs, so only the drawing is passed in.

/** Reveal radius in CSS pixels at the reference width. Larger than the
 *  cursor ring on purpose: the ring is the tip, this is the influence. */
const BRUSH = 108;
/** How long ink lingers after the brush has passed. */
const FADE = 0.42;
/** Stamp spacing as a fraction of the brush radius. */
const SPACING = 0.16;
/** The width the brush size is quoted against. */
const REF_WIDTH = 1440;
/** How long the loop keeps going after the last stroke. Comfortably past
 *  the decay, at the end of which the buffer is wiped outright. */
const QUIET = 2600;

/** A soft, slightly irregular brush, baked once. */
function makeBrush(radius) {
  const size = radius * 2;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');

  const core = g.createRadialGradient(radius, radius, 0, radius, radius, radius);
  core.addColorStop(0, 'rgba(255,255,255,1)');
  core.addColorStop(0.35, 'rgba(255,255,255,0.72)');
  core.addColorStop(0.7, 'rgba(255,255,255,0.22)');
  core.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = core;
  g.fillRect(0, 0, size, size);

  // A few offset lobes break the perfect circle. Without them the reveal
  // reads as a spotlight; with them it reads as something soaking through.
  for (let i = 0; i < 6; i += 1) {
    const a = (i / 6) * Math.PI * 2 + 0.6;
    const d = radius * (0.3 + (i % 3) * 0.13);
    const r = radius * (0.34 + (i % 4) * 0.06);
    const x = radius + Math.cos(a) * d;
    const y = radius + Math.sin(a) * d;
    const lobe = g.createRadialGradient(x, y, 0, x, y, r);
    lobe.addColorStop(0, 'rgba(255,255,255,0.34)');
    lobe.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = lobe;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }

  return c;
}

/** Fine grain, baked once, so a flat plate of accent is never quite flat. */
export function makeGrain(size = 140) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const img = g.createImageData(size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 226 + Math.random() * 29;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 26;
  }
  g.putImageData(img, 0, 0);
  return c;
}

/**
 * Mounts an ink reveal on a canvas.
 *
 * @param {HTMLCanvasElement} canvas the element composited into
 * @param {(ctx: CanvasRenderingContext2D, size: {w:number,h:number,dpr:number,
 *   grain:HTMLCanvasElement}) => void} drawArt paints the artwork, in device
 *   pixels, whenever the size changes
 * @param {{signal?: AbortSignal, brush?: number, fade?: number}} [opts]
 * @returns {() => void} disposes of the loop
 */
export function createInkReveal(canvas, drawArt, opts = {}) {
  const { signal, brush: brushBase = BRUSH, fade = FADE } = opts;

  const ctx = canvas.getContext('2d');
  const art = document.createElement('canvas');
  const artCtx = art.getContext('2d');
  const ink = document.createElement('canvas');
  const inkCtx = ink.getContext('2d');
  const grain = makeGrain();

  let w = 0;
  let h = 0;
  let dpr = 1;
  let brush = null;
  let brushR = brushBase;
  let last = null;
  let pending = [];
  let dirty = false;
  let lastPaint = 0;
  let raf = 0;
  let prev = performance.now();

  function resize() {
    const cw = canvas.clientWidth;
    const ch = canvas.clientHeight;
    if (!cw || !ch) return;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = Math.round(cw * dpr);
    h = Math.round(ch * dpr);
    [canvas, art, ink].forEach((c) => { c.width = w; c.height = h; });
    brushR = Math.max(72, (cw / REF_WIDTH) * brushBase) * dpr;
    brush = makeBrush(Math.round(brushR));
    last = null;
    artCtx.setTransform(1, 0, 0, 1, 0, 0);
    artCtx.clearRect(0, 0, w, h);
    drawArt(artCtx, { w, h, dpr, grain });
    artCtx.setTransform(1, 0, 0, 1, 0, 0);
    dirty = true;
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
      const gap = Math.max(brushR * SPACING, 1);
      for (let d = gap; d < dist; d += gap) {
        stamp(last.x + (dx * d) / dist, last.y + (dy * d) / dist);
      }
    }
    stamp(x, y);
    last = { x, y };
  }

  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min((now - prev) / 1000, 0.1);
    prev = now;
    if (!w || !h) return;

    if (pending.length) {
      pending.forEach((p) => strokeTo(p.x, p.y));
      pending = [];
      dirty = true;
    }

    // Nothing painted and nothing left to fade: skip the composite entirely
    // rather than clearing and redrawing an empty canvas sixty times a second.
    if (!dirty) return;

    // The memory, decaying. This is what returns the canvas to clean without
    // anyone having to leave.
    inkCtx.globalCompositeOperation = 'destination-out';
    inkCtx.fillStyle = `rgba(0,0,0,${1 - Math.exp(-dt / fade)})`;
    inkCtx.fillRect(0, 0, w, h);
    inkCtx.globalCompositeOperation = 'source-over';

    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(art, 0, 0);
    // The reveal: the art keeps only the alpha the brush has laid down.
    ctx.globalCompositeOperation = 'destination-in';
    ctx.drawImage(ink, 0, 0);
    ctx.globalCompositeOperation = 'source-over';

    // More frames of decay are still owed after the last stroke; the loop
    // stops once the buffer has gone quiet.
    if (pending.length) return;
    if (now - lastPaint < QUIET) return;

    // The wipe. `destination-out` removes a *proportion* of the alpha, so in
    // an 8-bit buffer the decay floors out: taking 2.7% of an alpha of 16
    // is 0.43, which truncates to nothing, and the stroke is left as a faint
    // permanent stain that every later stroke adds to. The decay handles
    // everything a visitor can see; this is what actually reaches empty.
    inkCtx.clearRect(0, 0, w, h);
    ctx.clearRect(0, 0, w, h);
    dirty = false;
  }

  function onMove(e) {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    // A pointer further away than the brush can reach cannot mark this
    // canvas, so a page with two of these does not run both at once.
    const margin = (brushR / dpr) * 1.2;
    if (e.clientX < rect.left - margin || e.clientX > rect.right + margin
      || e.clientY < rect.top - margin || e.clientY > rect.bottom + margin) {
      last = null;
      return;
    }
    pending.push({
      x: ((e.clientX - rect.left) / rect.width) * w,
      y: ((e.clientY - rect.top) / rect.height) * h,
    });
    lastPaint = performance.now();
  }

  resize();
  window.addEventListener('pointermove', onMove, { passive: true, signal });
  window.addEventListener('resize', resize, { passive: true, signal });
  document.addEventListener('pointerleave', () => { last = null; }, { signal });

  raf = requestAnimationFrame(frame);

  return () => cancelAnimationFrame(raf);
}

/** Whether this visitor gets an ink reveal at all. There is no pointer to
 *  paint with on a touchscreen, and reduced motion asked for less movement,
 *  not a new kind of it. */
export function inkSupported(reduced) {
  return !reduced && window.matchMedia('(hover: hover) and (pointer: fine)').matches;
}
