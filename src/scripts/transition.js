// Route transitions.
//
// The router swaps the document; this covers the swap so the change reads
// as one page turning rather than as content blinking. The curtain is the
// same dark block the loader and the footer use, so navigation is the
// system's own vocabulary rather than a separate effect.
//
// It is deliberately short. A transition longer than the navigation it
// hides is a delay the visitor pays for twice.
export function createTransitions(reduced) {
  if (reduced) return;

  const curtain = document.createElement('div');
  curtain.className = 'curtain on-dark';
  curtain.setAttribute('aria-hidden', 'true');
  document.body.appendChild(curtain);

  // `before-preparation` fires before the new document is fetched, and
  // `after-swap` once it is in place — which is exactly the window the
  // curtain needs to cover.
  document.addEventListener('astro:before-preparation', () => {
    curtain.dataset.on = '';
  });
  document.addEventListener('astro:after-swap', () => {
    // The new document arrives at the top; scrolling there before the
    // curtain lifts stops the page appearing to jump under it.
    window.scrollTo(0, 0);
    requestAnimationFrame(() => { delete curtain.dataset.on; });
  });
}
