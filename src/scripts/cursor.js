// The cursor system.
//
// The native pointer is left exactly as the operating system draws it. A
// replacement mark, however well drawn, always trails the real pointer by
// its own easing, and the eye tracks the drawn thing rather than the true
// position, which is what makes an otherwise smooth custom cursor feel
// slightly wrong to use.
//
// So nothing here draws a pointer. What follows the mouse is only the
// information the pointer cannot carry by itself: a small technical control
// naming what the thing underneath does, and, over a project row, that
// project's own preview. Over everything else there is nothing at all and
// the page behaves like any other page.
//
//   default   nothing: the system arrow, unmodified
//   link      nothing: the arrow already becomes a hand
//   project   a bordered control reading VIEW →, with the project's
//             own preview riding above it
//   image     a bordered control reading OPEN
//   drag      a bordered control reading ← DRAG →
//   active    the control compresses while the button is down
//
// Position is interpolated on rAF with an exponential filter rather than a
// per-frame fraction, so the inertia is the same ~95ms on a 60Hz panel and
// a 144Hz one instead of being three times snappier on the faster display.

/** Time constant of the follow. ~95ms: inside the brief's 80–120ms. */
const TAU = 0.095;
/** Keep-out margin for the preview against the viewport edge. */
const EDGE = 24;
/** Preview tilt ceiling, in degrees. */
const MAX_TILT = 3;

// The ring sits outside that wrapper: it is the one thing that shows in
// every state, including the default one where there is no control at all.
// The native pointer is left visible inside it rather than replaced, which
// is what keeps the pointer itself lag-free while the ring eases.
// The shapes live inside their own wrapper. The press compression scales
// the wrapper, so it composes with whatever transform the current state has
// on the shape itself rather than competing with it for specificity, which
// is why the box did not compress when the two were on the same element.
// The press compression scales the wrapper rather than the control itself,
// so it composes with the state's own transform instead of competing with
// it for specificity.
const SHAPES = `
  <span class="cur-ring"></span>
  <div class="cur-inner">
  <div class="cur-box">
    <span class="cur-pre"></span>
    <span class="cur-label"></span>
    <span class="cur-post"></span>
  </div>
  </div>
`;

/** What each state writes into the control. */
const LABELS = {
  project: { pre: '', label: 'VIEW', post: '→' },
  image: { pre: '', label: 'OPEN', post: '' },
  drag: { pre: '←', label: 'DRAG', post: '→' },
};

/**
 * Resolves the state for whatever is under the pointer.
 *
 * An explicit `data-cursor` always wins, so a row can say it is a project
 * even though it is also a link. Everything else that is genuinely
 * clickable falls back to the link arrow rather than needing to be
 * annotated one by one.
 */
function stateFor(target) {
  if (!(target instanceof Element)) return 'default';
  const named = target.closest('[data-cursor]');
  if (named) return named.dataset.cursor;
  return target.closest('a, button, [role="button"], summary') ? 'link' : 'default';
}

/** The theme of the block under the pointer; light unless a block says otherwise. */
function themeFor(target) {
  if (!(target instanceof Element)) return 'light';
  return target.closest('[data-cursor-theme]')?.dataset.cursorTheme ?? 'light';
}

export function createCursor(signal, reduced) {
  // A follower on a touchscreen is a bug: there is no pointer to follow, and
  // hiding the native cursor on a device that has none is a no-op at best.
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

  const root = document.createElement('div');
  root.className = 'cur';
  root.dataset.state = 'default';
  root.dataset.theme = 'light';
  root.setAttribute('aria-hidden', 'true');
  root.innerHTML = SHAPES;
  document.body.appendChild(root);

  const pre = root.querySelector('.cur-pre');
  const label = root.querySelector('.cur-label');
  const post = root.querySelector('.cur-post');

  // ---- the project preview ------------------------------------------------
  // The panel and its frames are rendered by the page from the work
  // collection; this only moves them and decides which one is showing. Rows
  // and frames are paired by the project's own id, so the association
  // survives reordering and never becomes a list of hard-coded cases.
  const preview = document.querySelector('[data-work-preview]');
  const frames = new Map();
  if (preview) {
    preview.querySelectorAll('[data-preview]').forEach((f) => frames.set(f.dataset.preview, f));
    // Reparented to the body, and this is load-bearing rather than tidy.
    // The panel is position:fixed and placed in viewport coordinates, but a
    // transformed ancestor becomes the containing block for fixed children,
    // and the section focus scrub puts a scale on every section. Left inside
    // the work section the panel resolves against that section instead of
    // the window, so it drifts with the scrub and the edge clamping computed
    // here means nothing.
    document.body.appendChild(preview);
  }

  let px = window.innerWidth / 2;
  let py = window.innerHeight / 2;
  let cx = px;
  let cy = py;
  let vx = 0;
  let tilt = 0;
  let last = performance.now();
  let raf = 0;
  let state = 'default';
  let shownPreview = null;

  function setState(next, target) {
    if (next !== state) {
      state = next;
      root.dataset.state = next;
      const copy = LABELS[next];
      if (copy) {
        pre.textContent = copy.pre;
        label.textContent = copy.label;
        post.textContent = copy.post;
      }
    }

    // The preview belongs to the project state and to a row that names one.
    const row = target instanceof Element ? target.closest('[data-preview]') : null;
    const id = next === 'project' ? row?.dataset.preview ?? null : null;
    if (id === shownPreview) return;

    frames.get(shownPreview)?.classList.remove('is-on');
    shownPreview = id;
    if (id) frames.get(id)?.classList.add('is-on');
    preview?.classList.toggle('is-on', Boolean(id));
  }

  /**
   * Places the preview near the pointer without letting it leave the
   * viewport. The panel prefers to sit above the control; when that would
   * clip it, it flips below, and it is clamped on both axes so a pointer in
   * any corner still shows the whole image.
   */
  function placePreview() {
    if (!preview || !shownPreview) return;
    const w = preview.offsetWidth;
    const h = preview.offsetHeight;

    let x = cx - w / 2;
    // Above the control by default: it keeps the panel off the row being
    // read. Near the top of the window there is no room for that, so it
    // flips below; the clearance there has to clear the control itself,
    // which sits 16px under the pointer and is 26px tall. At the original
    // 34px the panel landed on top of it and VIEW → became unreadable over
    // the photograph.
    let y = cy - h - 34;
    if (y < EDGE) y = cy + 56;

    x = Math.min(Math.max(x, EDGE), window.innerWidth - w - EDGE);
    y = Math.min(Math.max(y, EDGE), window.innerHeight - h - EDGE);

    preview.style.transform = `translate3d(${x}px, ${y}px, 0) rotate(${tilt}deg)`;
  }

  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;

    if (reduced) {
      cx = px;
      cy = py;
    } else {
      // Exponential smoothing: frame-rate independent, and critically damped
      // by construction: it cannot overshoot, which is what keeps this
      // reading as precision rather than as bounce.
      const k = 1 - Math.exp(-dt / TAU);
      const nx = cx + (px - cx) * k;
      vx = nx - cx;
      cx = nx;
      cy += (py - cy) * k;
      tilt += (Math.max(-MAX_TILT, Math.min(MAX_TILT, vx * 0.22)) - tilt) * k;
    }

    root.style.transform = `translate3d(${cx}px, ${cy}px, 0)`;
    placePreview();
  }

  window.addEventListener('pointermove', (e) => {
    px = e.clientX;
    py = e.clientY;
    setState(stateFor(e.target), e.target);
    root.dataset.theme = themeFor(e.target);
  }, { passive: true, signal });

  // Focus gets the same preview a pointer does, so tabbing the work list is
  // not a quietly different section.
  document.addEventListener('focusin', (e) => {
    const row = e.target instanceof Element ? e.target.closest('[data-preview]') : null;
    if (row) setState('project', row);
  }, { signal });

  window.addEventListener('pointerdown', () => root.classList.add('is-active'), { passive: true, signal });
  window.addEventListener('pointerup', () => root.classList.remove('is-active'), { passive: true, signal });
  // A drag that ends outside the window never fires pointerup on it.
  window.addEventListener('blur', () => root.classList.remove('is-active'), { signal });

  document.addEventListener('pointerleave', () => root.classList.add('is-gone'), { signal });
  document.addEventListener('pointerenter', () => root.classList.remove('is-gone'), { signal });

  raf = requestAnimationFrame(frame);

  return () => {
    cancelAnimationFrame(raf);
    root.remove();
  };
}
