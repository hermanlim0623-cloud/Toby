// The hero's hidden slash.
//
// A fixed diagonal band of accent blue carrying the repeated wordmark, with
// a soft edge and a little grain so it reads as ink rather than as a filled
// rect. The band never moves; the brush does. The reveal itself lives in
// inkReveal.js, which the footer's field shares.

import { createInkReveal, inkSupported } from './inkReveal.js';

/** The band's angle, matching the typographic slash the hero opens with. */
const ANGLE = (20 * Math.PI) / 180;

/** Paints the band once. Everything here is fixed; only the mask changes. */
function drawBand(ctx, { w, h, dpr, grain }) {
  const bandW = Math.max(190, Math.min(w * 0.19, 300)) * dpr;
  // One fixed position: a little right of centre, where it crosses the
  // open space between the wordmark and the standfirst.
  const cx = w * 0.58;
  const cy = h / 2;
  const len = Math.hypot(w, h) * 1.3;

  ctx.translate(cx, cy);
  ctx.rotate(ANGLE);

  // The band, with a soft edge across its width rather than a hard one.
  const edge = ctx.createLinearGradient(-bandW / 2, 0, bandW / 2, 0);
  edge.addColorStop(0, 'rgba(5,93,255,0)');
  edge.addColorStop(0.22, 'rgba(5,93,255,0.92)');
  edge.addColorStop(0.5, 'rgba(5,93,255,1)');
  edge.addColorStop(0.78, 'rgba(5,93,255,0.92)');
  edge.addColorStop(1, 'rgba(5,93,255,0)');
  ctx.fillStyle = edge;
  ctx.fillRect(-bandW / 2, -len / 2, bandW, len);

  // The wordmark, repeated down the band and clipped to it, so the type is
  // inside the ink rather than sitting on top of it.
  ctx.save();
  ctx.beginPath();
  ctx.rect(-bandW / 2, -len / 2, bandW, len);
  ctx.clip();

  const size = Math.max(34, Math.min(w * 0.046, 76)) * dpr;
  const step = size * 1.16;
  ctx.font = `700 ${size}px "Inter Variable", Inter, system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let i = 0, y = -len / 2 + step; y < len / 2; i += 1, y += step) {
    ctx.fillStyle = i % 2 ? 'rgba(255,255,255,0.30)' : 'rgba(255,255,255,0.62)';
    ctx.fillText('TOBY', 0, y);
  }
  ctx.restore();

  // Grain, clipped to the band, so the blue is not a flat plate.
  ctx.save();
  ctx.beginPath();
  ctx.rect(-bandW / 2, -len / 2, bandW, len);
  ctx.clip();
  ctx.globalCompositeOperation = 'overlay';
  ctx.fillStyle = ctx.createPattern(grain, 'repeat');
  ctx.fillRect(-bandW / 2, -len / 2, bandW, len);
  ctx.restore();
}

export function createHeroSlash(signal, reduced) {
  const root = document.querySelector('[data-hero-slash]');
  if (!root) return undefined;

  const canvas = root.querySelector('[data-hero-slash-canvas]');
  const hero = root.closest('.hero');
  if (!canvas || !hero) return undefined;

  // Without a fine pointer the hero is simply the hero, which is already
  // the default state, so there is nothing to fall back to.
  if (!inkSupported(reduced)) {
    root.remove();
    return undefined;
  }

  return createInkReveal(canvas, drawBand, { signal });
}
