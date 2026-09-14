// SECTION 02 — IDENTITY: a machine "scanning" and progressively printing
// out who TOBY is. Pure DOM/CSS/GSAP — a scanline sweep, monospace
// terminal lines typed in one at a time, then the capability tags snap in.
export function createIdentityScan(gsap, ScrollTrigger, prefersReducedMotion) {
  const root = document.querySelector('[data-identity]');
  if (!root) return;

  const lines = root.querySelectorAll('[data-id-line]');
  const tags = root.querySelectorAll('[data-id-tag]');
  const scanline = root.querySelector('.id-scanline');

  if (prefersReducedMotion) {
    lines.forEach((l) => (l.style.opacity = 1));
    tags.forEach((t) => (t.style.opacity = 1));
    return;
  }

  const tl = gsap.timeline({
    scrollTrigger: { trigger: root, start: 'top 65%', once: true },
  });

  tl.fromTo(scanline, { yPercent: -100, opacity: 0.9 }, { yPercent: 2000, duration: 1.6, ease: 'power1.inOut' }, 0);

  lines.forEach((line, i) => {
    const full = line.dataset.idLine || line.textContent;
    line.textContent = '';
    line.style.opacity = 1;
    tl.to(line, {
      duration: Math.min(full.length * 0.02, 0.9),
      ease: 'none',
      onUpdate() {
        const p = this.progress();
        line.textContent = full.slice(0, Math.round(full.length * p));
      },
    }, i === 0 ? 0.4 : '+=0.05');
  });

  tl.fromTo(tags, {
    opacity: 0, y: 14, filter: 'blur(4px)',
  }, {
    opacity: 1, y: 0, filter: 'blur(0px)', duration: 0.6, stagger: 0.07, ease: 'power3.out',
  }, '-=0.1');
}
