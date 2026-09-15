# TOBY — portfolio

A scroll-scrubbed cinematic portfolio for a creative technologist working in
food & beverage operations. The whole site is one continuous dive: scroll
position drives the playhead of a single video, which is rendered through a
hand-written GLSL water shader, with the copy layered on top.

Built with [Astro](https://astro.build), [GSAP](https://gsap.com) +
ScrollTrigger, [Lenis](https://lenis.darkroom.engineering) and
[OGL](https://github.com/oframe/ogl). No UI framework, no runtime JS
framework — the pages ship as static HTML plus one bundled module.

```bash
npm install
npm run dev        # http://localhost:4321
```

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run build` | Static build into `dist/` |
| `npm run preview` | Serve the built output |
| `npm run check` | `astro check` — typechecks `.astro` and `.ts` |
| `npm run lint` | ESLint over scripts, pages and components |
| `npm run format` | Prettier (the stylesheet is deliberately excluded) |
| `npm test` | Playwright: E2E + `axe-core` accessibility assertions |
| `npm run verify` | All of the above, in the order CI runs them |

## How the dive works

The effect that carries the site is a `<video>` whose `currentTime` is driven
by scroll position rather than by playback. Three things make it smooth, and
all three matter:

1. **The encode, more than the JavaScript.** A normal H.264 stream has a
   keyframe every few seconds, so seeking to an arbitrary frame means
   rewinding to the last keyframe and decoding forward. That is what makes
   most scroll-scrubbed video judder. Both clips in `public/videos/` are
   encoded **all-intra** — every frame is a keyframe — so any seek is
   effectively instant. The exact ffmpeg invocations are documented at the
   top of [`src/scripts/cinema.js`](src/scripts/cinema.js); re-encoding the
   footage any other way brings the judder straight back.
2. **One seek in flight at a time.** Assigning a new `currentTime` while the
   previous seek is still resolving makes the browser throw away work it had
   already started, so the controller waits for `seeked` before issuing the
   next one.
3. **Frame-rate-independent easing.** The playhead eases toward the scroll
   target with a factor scaled by real delta time, so the feel is identical
   on a 60 Hz and a 120 Hz display instead of getting twice as twitchy on
   the latter.

The footage is drawn to a WebGL canvas through a refraction shader
([`waterShader.js`](src/scripts/waterShader.js)) that reads the same depth
value the atmosphere and the depth HUD read, so the distortion, the vignette
and the metre readout always agree about how deep the dive currently is. If
WebGL is unavailable or the context is lost, the plain `<video>` underneath
is what the visitor sees — same footage, no distortion, nothing breaks.

## Section motion

Every section effect is a variation on one idea — the page is underwater,
so light is the thing that moves:

| Section | Effect |
| --- | --- |
| Every heading | A band of light sweeps the characters as the heading enters |
| 03 Work | Cards tilt in perspective with a specular highlight tracking the pointer, on top of the existing depth grading |
| 04 Automation | Stages ignite in sequence as the section is scrubbed; the figures roll on odometer columns |
| 05 Stack | Chips converge into the layout from a tight, deterministic scatter |
| 06 Evolution | Light runs down the timeline spine, igniting each entry's node as it passes |
| 07 Transmission | The status line decodes out of random glyphs |

Two conventions hold this together. The card grading (`horizontal.js`) and
the pointer tilt (`pointerFx.js`) both write CSS custom properties and
neither writes `transform` — the stylesheet composes them, so neither can
erase the other. And scroll-triggered tweens use `fromTo` with
`immediateRender: false` rather than `from`: a `from` tween re-applies its
start values on every `ScrollTrigger.refresh()`, and this page refreshes
twice during startup, which once left the tech chips parked at their
scattered start state while reporting themselves complete.

## Degradation, deliberately

| Condition | What happens |
| --- | --- |
| `prefers-reduced-motion` | No smooth scroll, no entrance timelines, no bubbles, no view-transition animation. The playhead tracks scroll directly instead of easing. |
| Low power / small screen / `saveData` | A 480p encode instead of the full clip, and the water shader is skipped entirely. |
| No WebGL, or a lost context | The unshaded video stays visible. |
| No JavaScript | Static HTML: all content, all links, all case studies. |

These paths are tested, not assumed — `reduced-motion` and `mobile` are
separate Playwright projects in [`playwright.config.ts`](playwright.config.ts).

## Structure

```
src/
  content/work/*.md    Case studies — frontmatter feeds the gallery cards,
                       the body becomes /work/<slug>
  content.config.ts    Typed schema for the above
  layouts/Base.astro   Shell: head, SEO, nav, atmosphere, palette, footer
  pages/
    index.astro        The dive
    work/[...slug]     Generated case-study pages
    404.astro
  scripts/
    boot.js            Lifecycle — see below
    cinema.js          Scroll-driven video playhead
    waterShader.js     GLSL refraction pass
    palette.js         ⌘K command palette
    ...                One module per effect
  styles/global.css    Whole visual system, one file
```

### Lifecycle

With Astro's view-transition router in play, a "page load" happens many times
per visit, so [`boot.js`](src/scripts/boot.js) splits initialisation in two:
Lenis and the GSAP ticker are created **once** and kept (tearing smooth scroll
down and rebuilding it per navigation is what makes view-transition sites feel
like they stutter on arrival), while everything bound to swapped DOM is
re-created on each `astro:page-load` behind an `AbortSignal`, so a navigation
cancels its listeners instead of stacking a second copy on top.

Adding an effect means writing a module that takes that signal, and calling it
from `initPage`.

### Adding a case study

Drop a Markdown file in `src/content/work/`. The frontmatter is schema-checked
at build time — a missing field or an unknown `world` fails the build rather
than rendering a blank card. `order` controls gallery position; the gallery,
the command palette, the sitemap and the next/previous links all follow from
the collection, so there is nothing else to update.

## Accessibility

Tested with `axe-core` against WCAG 2.1 A and AA on every page type, in
addition to a skip link, `inert` on the closed mobile menu, `aria-current` on
the active section, visible focus rings and Escape handling on both modal
surfaces. The `--ink-faint` token and the card mock labels were both raised
above the 4.5:1 contrast floor after the audit flagged them.

## Deploying

The build is fully static, so any static host works — `dist/` is the entire
site. Set `site` in [`astro.config.mjs`](astro.config.mjs) to the real domain
first: canonical URLs, the sitemap and the absolute Open Graph image URLs are
all derived from it, and social scrapers reject relative image paths.
