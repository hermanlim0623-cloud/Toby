// The cursor system.
//
// One element, one rAF loop, one state machine. Every pointer affordance on
// the site resolves through here — there is no second follower and no
// per-section special case, which is the only way a cursor stays coherent
// once a site has more than a couple of interactive surfaces.
//
// The default is a technical crosshair: a registration mark, not a pointer.
// It says the page is an instrument you are aiming at rather than a document
// you are poking. Every other state is that same mark resolving into the
// control the thing under it actually is.
//
//   default   crosshair + centre dot
//   link      a directional arrow
//   project   a bordered control reading VIEW →, with the project's
//             own preview riding above it
//   image     a bordered control reading OPEN
//   drag      a bordered control reading ← DRAG →
//   active    any of the above, compressed, while the button is down
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

// The shapes live inside their own wrapper. The press compression scales
// the wrapper, so it composes with whatever transform the current state has
// on the shape itself rather than competing with it for specificity — which
// is why the box did not compress when the two were on the same element.
const SHAPES = `
  <div class="cur-inner">
  <svg class="cur-cross" viewBox="0 0 28 28" aria-hidden="true">
    <path d="M14 0v7M14 21v7M0 14h7M21 14h7M7 7h14v14H7z" />
    <circle class="cur-dot" cx="14" cy="14" r="1.25" />
  </svg>
  <svg class="cur-arrow" viewBox="0 0 28 28" aria-hidden="true">
    <path d="M9 19L19 9M13 9h6v6" />
  </svg>
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

  // The native pointer is only hidden once the replacement is actually in
  // the document. Doing it from CSS alone would leave a page with no cursor
  // at all on any path where this module did not run.
  document.documentElement.classList.add('has-cursor');

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
    // Above the control by default — the ASCII in the brief has the preview
    // over the cursor, and it keeps the panel off the row being read.
    let y = cy - h - 34;
    if (y < EDGE) y = cy + 34;

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
      // by construction — it cannot overshoot, which is what keeps this
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
    document.documentElement.classList.remove('has-cursor');
  };
}
