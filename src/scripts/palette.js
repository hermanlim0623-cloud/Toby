// ⌘K / Ctrl-K command palette.
//
// The command index is serialized into the page at build time, so opening
// the palette is a class toggle and a filter over an in-memory array — no
// fetch, no spinner. It has to feel like a keyboard shortcut rather than a
// search page, and anything that can show a loading state doesn't.

/**
 * Subsequence match — "sldb" finds "Sales Dashboard". Returns a score
 * (lower is better) or null when the query doesn't fit at all. Matches
 * that land on word boundaries score better, so typing "re" surfaces
 * "Reporting" ahead of a mid-word hit elsewhere.
 */
function fuzzyScore(query, text) {
  if (!query) return 0;
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  let score = 0;
  let ti = 0;
  for (const ch of q) {
    const found = t.indexOf(ch, ti);
    if (found === -1) return null;
    const isBoundary = found === 0 || /[\s\-/]/.test(t[found - 1]);
    score += found - ti + (isBoundary ? 0 : 1);
    ti = found + 1;
  }
  return score;
}

export function createPalette(signal) {
  const root = document.querySelector('[data-palette]');
  const commands = window.__TOBY_COMMANDS__;
  if (!root || !Array.isArray(commands)) return;

  const input = root.querySelector('[data-palette-input]');
  const list = root.querySelector('[data-palette-list]');
  const empty = root.querySelector('[data-palette-empty]');
  const backdrop = root.querySelector('[data-palette-backdrop]');
  const opts = { signal };

  let results = [];
  let cursor = 0;
  let lastFocused = null;

  function render() {
    list.innerHTML = '';
    let group = null;
    results.forEach((cmd, i) => {
      if (cmd.group !== group) {
        group = cmd.group;
        const head = document.createElement('li');
        head.className = 'palette-group';
        head.setAttribute('role', 'presentation');
        head.textContent = group;
        list.appendChild(head);
      }
      const item = document.createElement('li');
      item.className = 'palette-item' + (i === cursor ? ' is-active' : '');
      item.id = `palette-opt-${i}`;
      item.setAttribute('role', 'option');
      item.setAttribute('aria-selected', String(i === cursor));
      item.innerHTML = `<span class="palette-item-label"></span><span class="palette-item-hint"></span>`;
      item.querySelector('.palette-item-label').textContent = cmd.label;
      item.querySelector('.palette-item-hint').textContent = cmd.hint;
      item.addEventListener('click', () => run(cmd), opts);
      item.addEventListener('mousemove', () => {
        if (cursor === i) return;
        cursor = i;
        render();
      }, opts);
      list.appendChild(item);
    });

    empty.hidden = results.length > 0;
    input.setAttribute('aria-activedescendant', results.length ? `palette-opt-${cursor}` : '');
    list.querySelector('.is-active')?.scrollIntoView({ block: 'nearest' });
  }

  function filter(query) {
    const scored = commands
      .map((cmd) => {
        const score = fuzzyScore(query, `${cmd.label} ${cmd.hint} ${cmd.group}`);
        return score === null ? null : { ...cmd, score };
      })
      .filter(Boolean)
      .sort((a, b) => a.score - b.score)
      .slice(0, 8);

    // Rank groups by their best hit, then keep each group's rows together.
    // Sorting on score alone interleaves them, and the renderer would emit
    // the same group heading twice — which reads as a rendering bug even
    // though the ordering underneath it is correct.
    const groupRank = new Map();
    scored.forEach((cmd) => {
      if (!groupRank.has(cmd.group)) groupRank.set(cmd.group, cmd.score);
    });
    results = scored.sort(
      (a, b) => groupRank.get(a.group) - groupRank.get(b.group) || a.score - b.score
    );

    cursor = 0;
    render();
  }

  function open() {
    if (!root.hidden) return;
    lastFocused = document.activeElement;
    root.hidden = false;
    document.documentElement.classList.add('palette-open');
    input.value = '';
    filter('');
    // The panel animates in; focusing on the next frame avoids the browser
    // scrolling the page to a still-offscreen input.
    requestAnimationFrame(() => input.focus());
  }

  function close() {
    if (root.hidden) return;
    root.hidden = true;
    document.documentElement.classList.remove('palette-open');
    // Return focus where it came from, or the palette swallows the
    // keyboard visitor's place in the page.
    if (lastFocused instanceof HTMLElement) lastFocused.focus();
  }

  function run(cmd) {
    close();
    if (!cmd) return;
    window.location.href = cmd.href;
  }

  document.addEventListener('keydown', (event) => {
    const mod = event.metaKey || event.ctrlKey;
    if (mod && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      if (root.hidden) open();
      else close();
      return;
    }
    if (root.hidden) return;

    if (event.key === 'Escape') {
      event.preventDefault();
      close();
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      cursor = (cursor + 1) % Math.max(results.length, 1);
      render();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      cursor = (cursor - 1 + results.length) % Math.max(results.length, 1);
      render();
    } else if (event.key === 'Enter') {
      event.preventDefault();
      run(results[cursor]);
    } else if (event.key === 'Tab') {
      // The dialog is modal: keep focus in the input rather than letting
      // Tab walk into the page behind it.
      event.preventDefault();
      input.focus();
    }
  }, opts);

  input.addEventListener('input', () => filter(input.value), opts);
  backdrop?.addEventListener('click', close, opts);
  document.querySelectorAll('[data-palette-open]').forEach((btn) =>
    btn.addEventListener('click', open, opts)
  );

  signal?.addEventListener('abort', close);
}
