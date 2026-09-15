// Text splitting + scroll-triggered reveals.
//
// Headlines are split down to individual characters (inside per-word masks,
// so letters rise out of a clipped box rather than just fading) which reads
// far more deliberate than a word-level reveal — the eye follows the line
// being written rather than blocks appearing.

// Splits an element's text into word masks containing character spans,
// walking nested markup so inline elements like <em> survive intact.
export function splitText(el) {
  function wrapTextNode(node) {
    const frag = document.createDocumentFragment();
    node.textContent.split(/(\s+)/).forEach((chunk) => {
      if (!chunk) return;
      if (/^\s+$/.test(chunk)) {
        frag.appendChild(document.createTextNode(chunk));
        return;
      }
      const word = document.createElement('span');
      word.className = 'split-word';
      chunk.split('').forEach((ch) => {
        const char = document.createElement('span');
        char.className = 'char';
        char.textContent = ch;
        word.appendChild(char);
      });
      frag.appendChild(word);
    });
    node.parentNode.replaceChild(frag, node);
  }

  function walk(parent) {
    // Snapshot first: wrapTextNode mutates the child list as it goes.
    Array.from(parent.childNodes).forEach((node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        if (node.textContent.trim()) wrapTextNode(node);
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        walk(node);
      }
    });
  }

  walk(el);
  return el.querySelectorAll('.char');
}

export function createReveals(gsap, ScrollTrigger, prefersReducedMotion) {
  // The hero is split even under reduced motion so its markup matches what
  // the entrance timeline in main.js expects; it just isn't animated there.
  document.querySelectorAll('.hero h1 .split-line > span').forEach((line) => splitText(line));

  if (prefersReducedMotion) return;

  document.querySelectorAll('[data-split]').forEach((el) => {
    const chars = splitText(el);
    el.classList.add('is-masking');
    gsap.from(chars, {
      yPercent: 115,
      opacity: 0,
      duration: 1,
      ease: 'power4.out',
      stagger: 0.018,
      scrollTrigger: { trigger: el, start: 'top 85%' },
      onComplete: () => el.classList.remove('is-masking'),
    });
  });

  // Sections dissolve in with a touch of scale + blur rather than a plain
  // fade, so one scene feels like it's settling into focus from the last.
  gsap.utils.toArray('[data-reveal]').forEach((el) => {
    gsap.from(el, {
      y: 36,
      scale: 0.97,
      opacity: 0,
      filter: 'blur(6px)',
      duration: 1.1,
      ease: 'power3.out',
      scrollTrigger: { trigger: el, start: 'top 88%' },
    });
  });

  gsap.utils.toArray('[data-reveal-group]').forEach((group) => {
    gsap.from(group.children, {
      y: 30,
      scale: 0.97,
      opacity: 0,
      filter: 'blur(5px)',
      duration: 0.85,
      ease: 'power3.out',
      stagger: 0.08,
      scrollTrigger: { trigger: group, start: 'top 85%' },
    });
  });
}
