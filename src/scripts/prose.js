// The prose lands on a measure that is drawn first.
//
// This is the only section on the page set as long-form text, so it gets a
// move about reading rather than about lists. A 1px rule is drawn across the
// measure for each line, the line settles onto it, and the rule withdraws:
// the structure states itself, then the content arrives in it, which is the
// argument the rest of the page makes with its grid.
//
// Lines are found by measuring, not assumed. The words are wrapped and then
// grouped by the top they actually resolve to, so the rules match however
// the browser broke the text, at any width and in any font.

const LINE_STAGGER = 0.06;
const RULE_DRAW = 0.26;
const TEXT_DUR = 0.34;
const RULE_FADE = 0.30;
/** How long a rule stands empty before its line lands on it. The whole
 *  point is the drawn measure being legible on its own, so the text waits
 *  for the rule to finish rather than chasing it. */
const LEAD = 0.22;
/** An extra beat at a paragraph break, so the cascade reads as prose
 *  rather than as one undifferentiated block of lines. */
const PARA_GAP = 0.09;

/** Wraps each word so line boxes can be measured. Whitespace is left as
 *  text nodes, so the browser breaks the paragraph exactly as it would
 *  have done untouched. */
function splitWords(el) {
  if (el.dataset.prose === 'done') return [...el.querySelectorAll('.pw')];
  const source = el.textContent.replace(/\s+/g, ' ').trim();
  el.textContent = '';
  source.split(' ').forEach((word, i, all) => {
    const span = document.createElement('span');
    span.className = 'pw';
    span.textContent = word;
    el.appendChild(span);
    if (i < all.length - 1) el.appendChild(document.createTextNode(' '));
  });
  el.dataset.prose = 'done';
  return [...el.querySelectorAll('.pw')];
}

/** Groups words into the lines the browser actually laid them out on. */
function linesOf(words) {
  const rows = new Map();
  words.forEach((w) => {
    const top = Math.round(w.offsetTop);
    if (!rows.has(top)) rows.set(top, []);
    rows.get(top).push(w);
  });
  return [...rows.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([top, items]) => ({ top, words: items, height: items[0].offsetHeight }));
}

export function createProse(gsap, ScrollTrigger, reduced) {
  const blocks = [...document.querySelectorAll('[data-prose]')];
  if (!blocks.length || reduced) return undefined;

  const built = [];

  function build(block) {
    block.querySelectorAll('.pl').forEach((r) => r.remove());

    // One cascade down the whole block rather than one per paragraph: the
    // three of them sit within a screen of each other, so separate triggers
    // fire together and the top-to-bottom reading is lost.
    const paras = [...block.querySelectorAll('p')];
    const lines = [];
    paras.forEach((para, pi) => {
      linesOf(splitWords(para)).forEach((line, li) => {
        const rule = document.createElement('span');
        rule.className = 'pl';
        rule.setAttribute('aria-hidden', 'true');
        // Sat on the line's own bottom edge, so the rule is the baseline the
        // text comes down to rather than a decoration near it.
        rule.style.top = `${line.top + line.height - 1}px`;
        para.appendChild(rule);
        lines.push({ ...line, rule, para: pi, first: li === 0 });
      });
    });

    const tl = gsap.timeline({
      scrollTrigger: { trigger: block, start: 'top 86%', once: true },
    });
    let at = 0;
    lines.forEach((line) => {
      if (line.first && line.para > 0) at += PARA_GAP;
      tl.fromTo(line.rule, { scaleX: 0 }, {
        scaleX: 1, duration: RULE_DRAW, ease: 'expo.out',
      }, at);
      tl.from(line.words, {
        y: 10, opacity: 0, duration: TEXT_DUR, ease: 'power2.out',
      }, at + LEAD);
      tl.to(line.rule, {
        opacity: 0, duration: RULE_FADE, ease: 'none',
      }, at + LEAD + TEXT_DUR * 0.6);
      at += LINE_STAGGER;
    });
    return tl;
  }

  blocks.forEach((block) => built.push({ block, tl: build(block) }));

  // The line boxes are a function of the width, so a resize invalidates
  // every rule that was drawn against the old one.
  let pending = null;
  const onResize = () => {
    clearTimeout(pending);
    pending = setTimeout(() => {
      built.forEach((entry) => {
        entry.tl.scrollTrigger?.kill();
        entry.tl.kill();
        // Whatever the rebuild does, the words it inherits are already
        // revealed; only the rules are drawn again.
        entry.tl = build(entry.block);
        entry.tl.progress(1);
      });
      ScrollTrigger.refresh();
    }, 180);
  };
  window.addEventListener('resize', onResize);

  return () => {
    clearTimeout(pending);
    window.removeEventListener('resize', onResize);
    built.forEach(({ tl }) => { tl.scrollTrigger?.kill(); tl.kill(); });
    blocks.forEach((b) => b.querySelectorAll('.pl').forEach((r) => r.remove()));
  };
}
