// Floating nav: toggles a "scrolled" glass background, highlights the
// active section link, and drives the mobile menu open/close.
//
// Nav hrefs are absolute (`/#work`) rather than bare hashes, because the
// same nav now renders on the case-study pages where a bare `#work` would
// point at nothing. That means every href has to be resolved against the
// current URL before it can be treated as an in-page anchor.

/** Returns the element a link points at, but only if it's on this page. */
function samePageTarget(href) {
  const url = new URL(href, window.location.href);
  if (url.pathname !== window.location.pathname || !url.hash) return null;
  try {
    return document.querySelector(url.hash);
  } catch {
    return null;
  }
}

export function createNav(signal) {
  const nav = document.querySelector('.nav');
  const links = [...document.querySelectorAll('.nav-links a, .mobile-menu a')];
  const toggle = document.querySelector('.nav-toggle');
  const menu = document.querySelector('.mobile-menu');

  if (!nav) return;

  const opts = { signal };

  window.addEventListener('scroll', () => {
    nav.classList.toggle('is-scrolled', window.scrollY > 40);
  }, { passive: true, signal });

  const watched = links
    .map((a) => ({ link: a, section: samePageTarget(a.getAttribute('href')) }))
    .filter((entry) => entry.section);

  if ('IntersectionObserver' in window && watched.length) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const id = '#' + entry.target.id;
          links.forEach((a) => {
            const match = new URL(a.href, window.location.href).hash === id;
            a.classList.toggle('is-active', match);
            // Screen readers get the same "you are here" signal the
            // underline gives sighted visitors.
            if (match) a.setAttribute('aria-current', 'true');
            else a.removeAttribute('aria-current');
          });
        });
      },
      { rootMargin: '-45% 0px -45% 0px' }
    );
    watched.forEach((entry) => io.observe(entry.section));
    signal?.addEventListener('abort', () => io.disconnect());
  }

  // ---- mobile menu ----
  function setMenu(open) {
    if (!menu) return;
    menu.classList.toggle('is-open', open);
    // `inert` keeps the off-screen menu out of the tab order entirely —
    // without it, a keyboard visitor tabs into links they cannot see.
    if (open) menu.removeAttribute('inert');
    else menu.setAttribute('inert', '');
    toggle?.setAttribute('aria-expanded', String(open));
    document.documentElement.classList.toggle('menu-open', open);
    if (open) menu.querySelector('a')?.focus();
  }

  toggle?.addEventListener('click', () => {
    setMenu(!menu?.classList.contains('is-open'));
  }, opts);

  menu?.querySelectorAll('a').forEach((a) =>
    a.addEventListener('click', () => setMenu(false), opts)
  );

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && menu?.classList.contains('is-open')) {
      setMenu(false);
      toggle?.focus();
    }
  }, opts);

  // ---- smooth in-page anchors ----
  document.querySelectorAll('a[href*="#"]').forEach((link) => {
    link.addEventListener('click', (event) => {
      const target = samePageTarget(link.getAttribute('href'));
      if (!target) return; // cross-page link: let the router handle it
      event.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      history.replaceState(null, '', new URL(link.href).hash);
    }, opts);
  });
}
