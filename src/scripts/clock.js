// The visitor's own local time, in the header.
//
// Their clock, not a server's: a portfolio that claims to be a running
// system should not be showing a time that is wrong for the person reading it.
export function createClock(signal) {
  const el = document.querySelector('[data-clock]');
  if (!el) return;

  const pad = (n) => String(n).padStart(2, '0');
  function tick() {
    const d = new Date();
    el.textContent = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    el.dateTime = d.toISOString();
  }

  tick();
  const id = setInterval(tick, 1000);
  signal?.addEventListener('abort', () => clearInterval(id), { once: true });
}
