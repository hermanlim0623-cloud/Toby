# TOBY — portfolio

A scroll-driven cinematic portfolio for a creative technologist working in
food & beverage operations. The whole site is one continuous dive: scroll
position is the depth of the water, and the water is generated on the GPU —
there is no footage, no video element and nothing to download.

Built with [Astro](https://astro.build), [Three.js](https://threejs.org)
(WebGPU renderer, TSL), [GSAP](https://gsap.com) + ScrollTrigger and
[Lenis](https://lenis.darkroom.engineering). No UI framework, no runtime JS
framework — the pages ship as static HTML plus one bundled module and a
renderer chunk that only the dive page loads.

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

The dive is a single fullscreen raymarch. Scroll maps to one float — `depth`,
0 at the surface and 1 at the seafloor — which is handed to the GPU, and
every visual in the scene is a function of it: the light falloff, the colour
of the water, the god rays, the density of the murk, the drift of the marine
snow, and the readout in the depth HUD. Keeping them in agreement is not
something the code has to arrange; they are all reading the same number.

This replaced a scroll-scrubbed `<video>`, and what it removed is the point:

- **No seeking.** Driving a playhead meant an all-intra encode (every frame a
  keyframe, so any seek was instant), a policy that kept exactly one seek in
  flight because stacking them made the browser throw away decoded work, and
  a decoder-priming hack because WebKit will not paint a frame of a video
  that has never played. A generated frame is reachable at the same cost as
  any other, so all of that is gone along with `seekPolicy.js`.
- **No download.** The two encodes were 5.6MB. The scene is code.
- **No resolution ceiling.** The old mobile path served a 480p encode; the
  raymarch is resolution-independent and is instead scaled by pixel ratio,
  which is a dial rather than a second asset.

The shader is written in [TSL](https://github.com/mrdoob/three.js/wiki/Three.js-Shading-Language)
rather than raw GLSL, so the one node graph compiles to WGSL on WebGPU and to
GLSL on the WebGL2 fallback. That is what makes a single shader source viable
here — hand-written GLSL would have needed a second WGSL copy to reach
WebGPU at all.

### Holding the frame rate

`renderer.js` watches real frame time and moves the pixel ratio to fit. Two
things in there are worth knowing before changing them:

1. **It measures the gap between rAF timestamps, not its own callback.** GPU
   work is queued rather than awaited, so timing the render call reports a
   few idle milliseconds no matter how badly the device is struggling. The
   only honest signal is how long the *previous* frame took to arrive.
2. **Catastrophic frames are judged one at a time.** The normal path is
   hysteretic — a single slow frame is noise, and reacting to it makes the
   resolution visibly pump — but on a machine rendering at a fraction of a
   frame per second, frames are the scarce resource, and requiring 45 of
   them to agree can take a minute of wall clock to establish what the first
   one already proved. Past 400ms the ratio halves immediately, and once the
   floor cannot save it either the scene is torn down in favour of the
   static gradient. A still image beats a page that never repaints.

## The opening

The preloader splits loading in two rather than waiting for everything:

| | |
| --- | --- |
| **Blocking** | The heading font, and a real first frame out of the renderer — which includes shader compilation, the long pole, and the one thing that cannot be deferred without revealing a black rectangle. |
| **Non-blocking** | Marine snow, and anything else that enriches a picture already complete. Started early, but never gates the curtain; it fades in under a visitor who is already scrolling. |

The curtain therefore lifts at roughly four-fifths of the total work. What
makes that safe is that the boundary is drawn around *what has to be on
screen*, not around a percentage — gating on a raw 80% would happily lift the
curtain mid-compile.

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
| `prefers-reduced-motion` | No smooth scroll, no entrance timelines, no bubbles, no marine snow, no pointer parallax, no view-transition animation. Depth tracks scroll directly instead of easing. |
| Low power / small screen / `saveData` | Fewer raymarch steps, fewer particles and a lower pixel-ratio ceiling — the same scene, costed down, rather than a second asset. |
| A GPU that cannot hold a watchable frame rate | The pixel ratio walks down; if the floor is not enough the scene is dropped for the stage's static gradient. |
| No WebGPU and no WebGL2 | That same gradient, which is why it is a designed image rather than a placeholder colour. |
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
    abyss/
      index.js         Scroll -> depth controller
      renderer.js      Backend selection + adaptive quality
      scene.js         The TSL scene: water column, god rays, marine snow
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
site. Three's WebGPU build is the largest thing in it, so the dive imports it
dynamically: `boot.js` stays small and the case-study pages never download a
renderer they do not construct. Set `site` in [`astro.config.mjs`](astro.config.mjs) to the real domain
first: canonical URLs, the sitemap and the absolute Open Graph image URLs are
all derived from it, and social scrapers reject relative image paths.
