// SECTION 02 — THE SKILL NETWORK.
//
// A map of where the work actually concentrates, not a list of proficiencies.
//
// The architecture is split deliberately, and it is the part worth
// understanding before changing anything here:
//
//   the nodes  are real DOM buttons, positioned over the canvas.
//   the edges  and the pulses travelling along them are drawn on the canvas,
//              underneath.
//
// The nodes do not drift. An earlier version floated them gently, on the
// theory that movement reads as alive — it does not, it reads as unfinished,
// and it costs something real: a control that never stops moving is harder to
// hit for everyone and genuinely difficult for anyone with a motor
// impairment. A machine's architecture holds still; its traffic is what
// moves. So the topology is fixed and the pulses carry the life, which is
// both more legible and more honest about what the diagram is saying.
//
// The obvious build is to draw everything on the canvas. It is also
// unreachable: a network painted into a bitmap has no labels, no focus, no
// tab order and nothing for a screen reader to announce, so the entire
// section — which is the one making the argument about how the work connects
// — simply does not exist for anyone not using a mouse. Promoting the nodes
// to DOM buys keyboard navigation, focus rings, accessible names and hover
// for free, and costs eleven transform writes a frame.
//
// The canvas keeps the edges because they are the thing DOM is bad at: a
// hundred hairlines and a dozen travelling pulses as elements would be far
// more expensive than the same thing as paths.

/** Pulse travel, in fractions of an edge per second. */
const PULSE_SPEED = 0.55;
const PULSE_INTERVAL = 900;

export function createSkillNetwork(host, nodes, { prefersReducedMotion, signal } = {}) {
  const canvas = host?.querySelector('canvas');
  const layer = host?.querySelector('[data-skill-nodes]');
  if (!canvas || !layer) return null;

  const ctx = canvas.getContext('2d');
  const dpr = Math.min(window.devicePixelRatio || 1, 1.6);
  const panel = document.querySelector('[data-skill-panel]');

  let w = 0;
  let h = 0;
  let raf = null;
  let focused = null; // node id, from hover or keyboard focus
  let pulses = [];
  let lastPulse = 0;

  const byId = new Map(nodes.map((n) => [n.id, n]));

  // Undirected, whatever the data says. Relationships are mutual by nature,
  // and a link listed on only one side would light from one end and not the
  // other — a difference nobody would read as "asymmetric", only as a bug.
  const neighbours = new Map(nodes.map((n) => [n.id, new Set(n.links)]));
  nodes.forEach((n) => {
    n.links.forEach((other) => neighbours.get(other)?.add(n.id));
  });

  // One entry per undirected pair, so an edge is never drawn twice at
  // double opacity.
  const edges = [];
  const seen = new Set();
  neighbours.forEach((set, id) => {
    set.forEach((other) => {
      const key = id < other ? `${id}|${other}` : `${other}|${id}`;
      if (seen.has(key)) return;
      seen.add(key);
      edges.push({ a: id, b: other });
    });
  });

  const state = nodes.map((n, i) => ({
    ...n,
    index: i,
    x: 0.5,
    y: 0.5,
    ox: 0,
    oy: 0,
    el: null,
  }));
  const stateById = new Map(state.map((n) => [n.id, n]));

  // Laid out on a jittered ellipse so connections read as a network rather
  // than a grid, with the heaviest nodes pulled slightly inward — the centre
  // of the picture should be where the work concentrates.
  state.forEach((n, i) => {
    const angle = (i / state.length) * Math.PI * 2 - Math.PI / 2;
    const pull = 1 - n.weight * 0.22;
    const r = (0.3 + (i % 3) * 0.055) * pull;
    n.ox = 0.5 + Math.cos(angle) * r;
    n.oy = 0.5 + Math.sin(angle) * r * 0.74;
    n.x = n.ox;
    n.y = n.oy;
  });

  // --- the nodes, as real controls -------------------------------------

  state.forEach((n) => {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'skill-node';
    el.dataset.skillNode = n.id;
    // Size carries the weight. It is set here rather than in CSS because it
    // is data, not styling.
    el.style.setProperty('--node-size', `${8 + n.weight * 9}px`);
    el.innerHTML = `<span class="skill-node-dot"></span><span class="skill-node-label">${n.label}</span>`;
    // The accessible name has to say what the control *does*, not just repeat
    // the label already in the button.
    el.setAttribute('aria-label', `${n.label}. ${n.desc}`);
    el.setAttribute('aria-describedby', 'skill-readout');
    layer.appendChild(el);
    n.el = el;

    const focus = () => setFocus(n.id);
    const blur = () => { if (focused === n.id) setFocus(null); };
    el.addEventListener('pointerenter', focus, { signal });
    el.addEventListener('pointerleave', blur, { signal });
    // Keyboard focus drives exactly the same state as hover. Anything else
    // means the keyboard path is a second, lesser experience.
    el.addEventListener('focus', focus, { signal });
    el.addEventListener('blur', blur, { signal });
  });

  function setFocus(id) {
    if (focused === id) return;
    focused = id;

    state.forEach((n) => {
      const related = id !== null && (n.id === id || neighbours.get(id)?.has(n.id));
      n.el.classList.toggle('is-focused', n.id === id);
      n.el.classList.toggle('is-related', Boolean(related) && n.id !== id);
      // Dimming the rest is what turns a highlight into an answer: the
      // question is "what does this connect to", and the unrelated nodes
      // receding is the half of it that a brighter node cannot say.
      n.el.classList.toggle('is-dimmed', id !== null && !related);
    });

    if (!panel) return;
    if (id === null) {
      panel.classList.remove('is-visible');
      return;
    }
    const n = byId.get(id);
    const linked = [...(neighbours.get(id) ?? [])].map((x) => byId.get(x).label);
    panel.querySelector('[data-skill-name]').textContent = n.label;
    panel.querySelector('[data-skill-desc]').textContent = n.desc;
    panel.querySelector('[data-skill-related]').textContent = n.related.join(' · ');
    panel.querySelector('[data-skill-links]').textContent = linked.join(' · ');
    panel.classList.add('is-visible');

    if (!prefersReducedMotion) emitPulses(id);
  }

  /** A burst of signal from the focused node out along each of its edges. */
  function emitPulses(id) {
    neighbours.get(id)?.forEach((other) => {
      pulses.push({ from: id, to: other, t: 0 });
    });
  }

  // --- layout and drawing ----------------------------------------------

  function resize() {
    const rect = host.getBoundingClientRect();
    w = rect.width;
    h = rect.height;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    placeNodes();
  }

  function placeNodes() {
    state.forEach((n) => {
      n.el.style.transform = `translate(${n.x * w}px, ${n.y * h}px)`;
    });
  }

  function edgeAlpha(a, b) {
    if (focused === null) return 0.1;
    if (a === focused || b === focused) return 0.55;
    return 0.035;
  }

  function draw(now) {
    ctx.clearRect(0, 0, w, h);

    edges.forEach(({ a, b }) => {
      const na = stateById.get(a);
      const nb = stateById.get(b);
      const alpha = edgeAlpha(a, b);
      // Weight of the connection follows the lighter of the two ends: a link
      // is only as load-bearing as its weaker side.
      const strength = Math.min(na.weight, nb.weight);
      ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
      ctx.lineWidth = 0.5 + strength * (a === focused || b === focused ? 1.3 : 0.5);
      ctx.beginPath();
      ctx.moveTo(na.x * w, na.y * h);
      ctx.lineTo(nb.x * w, nb.y * h);
      ctx.stroke();
    });

    if (!prefersReducedMotion) {
      // An idle heartbeat along one random edge, so the network reads as
      // carrying traffic even when nobody is pointing at it.
      if (focused === null && now - lastPulse > PULSE_INTERVAL && edges.length) {
        const e = edges[Math.floor(Math.random() * edges.length)];
        pulses.push({ from: e.a, to: e.b, t: 0 });
        lastPulse = now;
      }

      pulses = pulses.filter((p) => {
        p.t += PULSE_SPEED / 60;
        if (p.t >= 1) return false;
        const na = stateById.get(p.from);
        const nb = stateById.get(p.to);
        const x = (na.x + (nb.x - na.x) * p.t) * w;
        const y = (na.y + (nb.y - na.y) * p.t) * h;
        // Fades in and out across its run, so it reads as something passing
        // rather than as a dot that appears and vanishes.
        const fade = Math.sin(p.t * Math.PI);
        ctx.beginPath();
        ctx.arc(x, y, 1.8, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${0.85 * fade})`;
        ctx.fill();
        return true;
      });
    }

    raf = requestAnimationFrame(draw);
  }

  resize();
  window.addEventListener('resize', resize, { signal });

  // Pointing at the background, rather than at any node, clears the focus.
  host.addEventListener('pointerleave', () => {
    if (!state.some((n) => n.el === document.activeElement)) setFocus(null);
  }, { signal });

  if (prefersReducedMotion) {
    draw(0);
    cancelAnimationFrame(raf);
    raf = null;
  } else {
    raf = requestAnimationFrame(draw);
  }

  return {
    destroy() {
      if (raf) cancelAnimationFrame(raf);
      state.forEach((n) => n.el.remove());
    },
  };
}

