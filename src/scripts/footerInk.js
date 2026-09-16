// The footer's hidden field.
//
// The hero hides a band; the footer hides the whole plate. Drag across it
// and the wordmark is there, repeated edge to edge, packed tight and offset
// row by row so it reads as a field rather than as a table.
//
// It is the last thing on the page and it is the same gesture as the first,
// which is the point: the site opens with the mark being found and closes
// the same way, at the size the closing deserves.

import { createInkReveal, inkSupported } from './inkReveal.js';

/** A wider brush than the hero's. The area is larger and the type is
 *  smaller, so the same radius would read as a pinhole. */
const BRUSH = 150;
/** A slower decay, because there is more to find here than in a band. */
const FADE = 0.62;

/** Paints the plate once. Everything here is fixed; only the mask changes. */
function drawField(ctx, { w, h, dpr, grain }) {
  // The plate. Flat accent, edge to edge: the footer's own dark is what
  // the brush is lifting off it.
  //
  // Not quite opaque, and the alpha is a contrast budget rather than a
  // taste. The footer's text stands on whatever the brush has revealed, and
  // at full strength the accent drops the small labels to 2.69:1. Held here,
  // everything the footer says clears 5.5:1 on the plate and 16:1 off it.
  ctx.fillStyle = 'rgba(5,93,255,0.85)';
  ctx.fillRect(0, 0, w, h);

  const size = Math.max(26, Math.min(w * 0.032, 58)) * dpr;
  ctx.font = `700 ${size}px "Inter Variable", Inter, system-ui, sans-serif`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';

  const stepX = ctx.measureText('TOBY').width + size * 0.42;
  const stepY = size * 1.12;

  // The wordmark is cut *into* the plate rather than laid on it. Set in
  // white, as the hero's band has it, the brightest glyphs would pass behind
  // the footer's own text and take it to about 1.2:1; darker than the plate,
  // the worst background anything here stands on is the plate itself.
  for (let row = 0, y = stepY * 0.5; y < h + stepY; row += 1, y += stepY) {
    // Alternate rows are offset by half a word and cut a little deeper, so
    // the field has a weave instead of columns of identical letters.
    const offset = row % 2 ? -stepX / 2 : 0;
    ctx.fillStyle = row % 2 ? 'rgba(0,10,40,0.34)' : 'rgba(0,10,40,0.20)';
    for (let x = offset - stepX; x < w + stepX; x += stepX) ctx.fillText('TOBY', x, y);
  }

  // Grain, so the plate is never quite flat.
  ctx.globalCompositeOperation = 'overlay';
  ctx.fillStyle = ctx.createPattern(grain, 'repeat');
  ctx.fillRect(0, 0, w, h);
  ctx.globalCompositeOperation = 'source-over';
}

export function createFooterInk(signal, reduced) {
  const root = document.querySelector('[data-foot-ink]');
  if (!root) return undefined;

  const canvas = root.querySelector('[data-foot-ink-canvas]');
  if (!canvas) return undefined;

  // Without a fine pointer the footer is simply the footer, which is
  // already the default state, so there is nothing to fall back to.
  if (!inkSupported(reduced)) {
    root.remove();
    return undefined;
  }

  return createInkReveal(canvas, drawField, { signal, brush: BRUSH, fade: FADE });
}
