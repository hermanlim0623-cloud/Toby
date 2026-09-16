// The full-screen menu.
//
// `inert` does the accessibility work: while closed the panel is not
// focusable, not read, and not reachable, which is the part an off-screen
// transform alone never gets right.
export function createMenu(signal) {
  const menu = document.querySelector('[data-menu]');
  const open = document.querySelector('[data-menu-open]');
  const close = document.querySelector('[data-menu-close]');
  if (!menu || !open) return;

  let last = null;

  function setOpen(next) {
    if (next) {
      last = document.activeElement;
      menu.removeAttribute('inert');
      menu.dataset.open = '';
      document.documentElement.style.overflow = 'hidden';
      menu.querySelector('a')?.focus();
    } else {
      delete menu.dataset.open;
      menu.setAttribute('inert', '');
      document.documentElement.style.overflow = '';
      last?.focus();
    }
    open.setAttribute('aria-expanded', String(next));
  }

  open.addEventListener('click', () => setOpen(true), { signal });
  close?.addEventListener('click', () => setOpen(false), { signal });
  // Following a link inside the menu should leave it closed behind you.
  menu.querySelectorAll('[data-menu-link]').forEach((a) => {
    a.addEventListener('click', () => setOpen(false), { signal });
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && menu.dataset.open !== undefined) setOpen(false);
  }, { signal });
}
