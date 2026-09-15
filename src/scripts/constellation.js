// SECTION 03 — SKILL MATRIX: a floating node/edge network on a 2D canvas
// (cheap enough to run alongside the hero's Three.js scene). Nodes drift
// slowly in place; the cursor perturbs nearby nodes and brightens their
// connections; clicking/hovering a node surfaces its detail panel.
export function createConstellation(canvas, nodes, { prefersReducedMotion } = {}) {
  if (!canvas) return null;
  const ctx = canvas.getContext('2d');
  const dpr = Math.min(window.devicePixelRatio || 1, 1.6);
  const panel = document.querySelector('[data-skill-panel]');

  let w = 0, h = 0;
  let pointer = { x: -9999, y: -9999 };
  let raf = null;
  let active = null;

  const state = nodes.map((n, i) => ({
    ...n,
    id: i,
    x: 0.5, y: 0.5, // normalized home position, set below
    ox: 0, oy: 0,
    vx: (Math.random() - 0.5) * 0.0003,
    vy: (Math.random() - 0.5) * 0.0003,
    phase: Math.random() * Math.PI * 2,
  }));

  // Lay nodes on a jittered circle so connections read as a network, not a grid.
  state.forEach((n, i) => {
    const angle = (i / state.length) * Math.PI * 2;
    const r = 0.28 + (i % 3) * 0.07;
    n.x = 0.5 + Math.cos(angle) * r;
    n.y = 0.5 + Math.sin(angle) * r * 0.72;
    n.ox = n.x;
    n.oy = n.y;
  });

  function resize() {
    const rect = canvas.parentElement.getBoundingClientRect();
    w = rect.width;
    h = rect.height;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize();
  window.addEventListener('resize', resize);

  canvas.addEventListener('pointermove', (e) => {
    const rect = canvas.getBoundingClientRect();
    pointer.x = e.clientX - rect.left;
    pointer.y = e.clientY - rect.top;
  });
  canvas.addEventListener('pointerleave', () => {
    pointer.x = -9999; pointer.y = -9999;
    setActive(null);
  });
  canvas.addEventListener('click', () => {
    if (active !== null) return;
  });

  function setActive(id) {
    if (active === id) return;
    active = id;
    if (!panel) return;
    if (id === null) {
      panel.classList.remove('is-visible');
      return;
    }
    const n = state[id];
    panel.querySelector('[data-skill-name]').textContent = n.label;
    panel.querySelector('[data-skill-desc]').textContent = n.desc;
    panel.querySelector('[data-skill-related]').textContent = n.related.join(' · ');
    panel.classList.add('is-visible');
  }

  function draw(t) {
    ctx.clearRect(0, 0, w, h);

    // gentle organic drift
    state.forEach((n) => {
      n.x = n.ox + Math.sin(t * 0.00015 + n.phase) * 0.02;
      n.y = n.oy + Math.cos(t * 0.00013 + n.phase) * 0.02;
    });

    let hovered = null;
    let bestDist = 46;
    state.forEach((n) => {
      const px = n.x * w, py = n.y * h;
      const d = Math.hypot(px - pointer.x, py - pointer.y);
      if (d < bestDist) { bestDist = d; hovered = n.id; }
    });
    if (hovered !== active) setActive(hovered);

    // edges
    state.forEach((n, i) => {
      n.links.forEach((j) => {
        if (j <= i) return;
        const m = state[j];
        const p1x = n.x * w, p1y = n.y * h;
        const p2x = m.x * w, p2y = m.y * h;
        const isHot = active === i || active === j;
        ctx.strokeStyle = isHot ? 'rgba(111,232,255,0.8)' : 'rgba(255,255,255,0.14)';
        ctx.lineWidth = isHot ? 1.4 : 0.8;
        ctx.beginPath();
        ctx.moveTo(p1x, p1y);
        ctx.lineTo(p2x, p2y);
        ctx.stroke();
      });
    });

    // nodes
    state.forEach((n) => {
      const px = n.x * w, py = n.y * h;
      const isActive = active === n.id;
      const r = isActive ? 7 : 4.2;
      ctx.beginPath();
      ctx.arc(px, py, r + (isActive ? 8 : 0), 0, Math.PI * 2);
      ctx.fillStyle = isActive ? 'rgba(111,232,255,0.18)' : 'rgba(111,232,255,0.0)';
      ctx.fill();

      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.fillStyle = isActive ? '#6FE8FF' : 'rgba(243,244,240,0.8)';
      ctx.fill();

      ctx.font = `${isActive ? 600 : 400} ${isActive ? 12 : 10.5}px "IBM Plex Mono", monospace`;
      ctx.fillStyle = isActive ? '#F3F4F0' : 'rgba(159,182,198,0.9)';
      ctx.textAlign = 'center';
      ctx.shadowColor = 'rgba(2,24,39,0.9)';
      ctx.shadowBlur = 6;
      ctx.fillText(n.label, px, py - r - 10);
      ctx.shadowBlur = 0;
    });

    raf = requestAnimationFrame(draw);
  }

  if (prefersReducedMotion) {
    draw(0);
  } else {
    raf = requestAnimationFrame(draw);
  }

  return {
    destroy() {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    },
  };
}
