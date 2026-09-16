// The hero's hidden slash.
//
// Three layers, composited once per frame:
//
//   art    the slash itself, drawn once: a fixed diagonal band of accent
//          blue carrying the repeated wordmark, with a soft edge and a
//          little grain so it reads as ink rather than as a filled rect
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

/** Reveal radius in CSS pixels, at a 1440-wide hero. Larger than the cursor
 *  ring on purpose: the ring is the tip, this is the influence. */
const BRUSH = 108;
/** How long ink lingers after the brush has passed. */
const FADE = 0.42;
/** Stamp spacing as a fraction of the brush radius. */
const SPACING = 0.16;
/** The band's angle, matching the typographic slash the hero opens with. */
const ANGLE = (20 * Math.PI) / 180;

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

/** Fine grain, baked once and tiled over the band. */
function makeGrain(size = 140) {
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

export function createHeroSlash(signal, reduced) {
  const root = document.querySelector('[data-hero-slash]');
  if (!root) return;

  const canvas = root.querySelector('[data-hero-slash-canvas]');
  const hero = root.closest('.hero');
  if (!canvas || !hero) return;

  // Desktop only. There is no pointer to paint with on a touchscreen, and
  // reduced motion asked for less movement, not a new kind of it. In both
  // cases the hero is simply the hero, which is already the default state.
  if (reduced || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    root.remove();
    return;
  }

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
  let brushR = BRUSH;
  let last = null;
  let pending = [];
  let dirty = false;
  let raf = 0;
  let prev = performance.now();

  /** Paints the band once. Everything here is fixed; only the mask changes. */
  function drawArt() {
    artCtx.setTransform(1, 0, 0, 1, 0, 0);
    artCtx.clearRect(0, 0, w, h);

    const bandW = Math.max(190, Math.min(w * 0.19, 300)) * dpr;
    // One fixed position: a little right of centre, where it crosses the
    // open space between the wordmark and the standfirst.
    const cx = w * 0.58;
    const cy = h / 2;
    const len = Math.hypot(w, h) * 1.3;

    artCtx.translate(cx, cy);
    artCtx.rotate(ANGLE);

    // The band, with a soft edge across its width rather than a hard one.
    const edge = artCtx.createLinearGradient(-bandW / 2, 0, bandW / 2, 0);
    edge.addColorStop(0, 'rgba(5,93,255,0)');
    edge.addColorStop(0.22, 'rgba(5,93,255,0.92)');
    edge.addColorStop(0.5, 'rgba(5,93,255,1)');
    edge.addColorStop(0.78, 'rgba(5,93,255,0.92)');
    edge.addColorStop(1, 'rgba(5,93,255,0)');
    artCtx.fillStyle = edge;
    artCtx.fillRect(-bandW / 2, -len / 2, bandW, len);

    // The wordmark, repeated down the band and clipped to it, so the type is
    // inside the ink rather than sitting on top of it.
    artCtx.save();
    artCtx.beginPath();
    artCtx.rect(-bandW / 2, -len / 2, bandW, len);
    artCtx.clip();

    const size = Math.max(34, Math.min(w * 0.046, 76)) * dpr;
    const step = size * 1.16;
    artCtx.font = `700 ${size}px "Inter Variable", Inter, system-ui, sans-serif`;
    artCtx.textAlign = 'center';
    artCtx.textBaseline = 'middle';
    for (let i = 0, y = -len / 2 + step; y < len / 2; i += 1, y += step) {
      artCtx.fillStyle = i % 2 ? 'rgba(255,255,255,0.30)' : 'rgba(255,255,255,0.62)';
      artCtx.fillText('TOBY', 0, y);
    }
    artCtx.restore();

    // Grain, clipped to the band, so the blue is not a flat plate.
    artCtx.save();
    artCtx.beginPath();
    artCtx.rect(-bandW / 2, -len / 2, bandW, len);
    artCtx.clip();
    artCtx.globalCompositeOperation = 'overlay';
    const pattern = artCtx.createPattern(grain, 'repeat');
    artCtx.fillStyle = pattern;
    artCtx.fillRect(-bandW / 2, -len / 2, bandW, len);
    artCtx.restore();

    artCtx.setTransform(1, 0, 0, 1, 0, 0);
  }

  function resize() {
    const cw = canvas.clientWidth;
    const ch = canvas.clientHeight;
    if (!cw || !ch) return;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = Math.round(cw * dpr);
    h = Math.round(ch * dpr);
    [canvas, art, ink].forEach((c) => { c.width = w; c.height = h; });
    brushR = Math.max(72, (cw / 1440) * BRUSH) * dpr;
    brush = makeBrush(Math.round(brushR));
    last = null;
    drawArt();
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
    // rather than clearing and redrawing an empty hero sixty times a second.
    if (!dirty) return;

    // The memory, decaying. This is what returns the hero to clean without
    // anyone having to leave.
    inkCtx.globalCompositeOperation = 'destination-out';
    inkCtx.fillStyle = `rgba(0,0,0,${1 - Math.exp(-dt / FADE)})`;
    inkCtx.fillRect(0, 0, w, h);
    inkCtx.globalCompositeOperation = 'source-over';

    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(art, 0, 0);
    // The reveal: the art keeps only the alpha the brush has laid down.
    ctx.globalCompositeOperation = 'destination-in';
    ctx.drawImage(ink, 0, 0);
    ctx.globalCompositeOperation = 'source-over';

    // One more frame of decay is still owed after the last stroke; the loop
    // stops once the buffer has gone quiet.
    if (!pending.length) {
      dirty = now - (frame.lastPaint || 0) < 4000;
    } else {
      frame.lastPaint = now;
    }
  }

  function onMove(e) {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    pending.push({
      x: ((e.clientX - rect.left) / rect.width) * w,
      y: ((e.clientY - rect.top) / rect.height) * h,
    });
    frame.lastPaint = performance.now();
  }

  resize();
  window.addEventListener('pointermove', onMove, { passive: true, signal });
  window.addEventListener('resize', resize, { passive: true, signal });
  document.addEventListener('pointerleave', () => { last = null; }, { signal });

  raf = requestAnimationFrame(frame);

  return () => {
    cancelAnimationFrame(raf);
  };
}
