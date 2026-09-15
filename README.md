# TOBY — portfolio

A scroll-driven cinematic portfolio for a creative technologist working in
food & beverage operations. The whole site is one continuous dive: scroll
flies a camera down a procedural canyon, through water that is raymarched on
the GPU and snow that is simulated on it. There is no footage, no video
element and nothing to download.

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

Scroll drives a real perspective camera down a 260-unit canyon on a spline.
That matters more than any single effect: a camera in a scene buys parallax
(the near wall slides past far faster than the far one) and occlusion (things
get in front of other things), and those are the two cues a fullscreen shader
can never fake, however good its fog is.

Five parts, each on its own render path:

| | |
| --- | --- |
| `camera.js` | The rig. Position and aim are *separate* curves — see below. |
| `atmosphere.js` | The water column: a raymarched volume of murk and god rays, installed as the scene's `backgroundNode`. |
| `terrain.js` | Canyon walls and seafloor, displaced by noise in the vertex shader. |
| `particles.js` | Marine snow on a curl-noise flow field and a boids school, simulated in compute shaders. |
| `post.js` | Bloom. |
| `water.js` | What all of the above agree on. |

`water.js` is the load-bearing one. Three completely different render paths
have to agree on what "600 metres down" looks like, or the geometry visibly
floats in front of the background instead of being submerged in it. Sharing a
palette is not enough — they share the *functions*: `depthAt`, `daylightAt`,
`backdropAt` and `submerge`.

The shaders are written in [TSL](https://github.com/mrdoob/three.js/wiki/Three.js-Shading-Language)
rather than raw GLSL, so one node graph compiles to WGSL on WebGPU and GLSL on
the WebGL2 fallback. That is what makes a single shader source viable here;
hand-written GLSL would have needed a second WGSL copy to reach WebGPU at all.

### Things that are easy to get wrong here

Four of these cost real time to find, and all four look like the obvious
choice until you see the result:

1. **The aim curve must not sit under the path.** Pointing the camera at a
   curve directly below it is the intuitive way to "look down as you
   descend", and it points the camera at its own feet: the walls never enter
   frame, the parallax that justifies the geometry is invisible, and the dive
   becomes a long look at the floor. The aim swings wall to wall instead and
   stays only a little below the camera.
2. **Geometry fogs toward the backdrop along the view ray**, not toward the
   water at its own depth. The latter is the intuitive version and it is
   wrong in a way that only shows when you look down: distant deep geometry
   fogs to near-black while the water above it is still bright, and the two
   meet along a hard horizon line no amount of fog can hide.
3. **The palette is linear, and the frame is sRGB-encoded on the way to the
   screen.** A linear 0.09 lands near 0.33 on the display, so numbers that
   look like a reasonable dark blue arrive as a swimming pool. Any change has
   to be judged on a canvas capture; a render-target readback shows the raw
   linear values and will tell you the scene is far darker than it is.
4. **Bloom's threshold sits above the water, not above zero.** Almost the
   whole frame is a dim blue field, so a threshold low enough to "catch the
   dark scene" catches all of it and returns a flat sheet of cyan.

### The simulation

Marine snow and the fish school live in storage buffers that never travel back
to JavaScript: a compute pass advances them, and the vertex stage reads the
same buffer. That is what makes them simulation rather than animation —
nothing is uploaded per frame, so a particle costs a few ALU ops instead of a
slot in a buffer the CPU has to rewrite.

The snow is advected by the **curl** of a noise field rather than the field
itself. Curl is divergence-free by construction, so the snow tumbles without
ever collecting: straight noise has sources and sinks, particles pile into its
valleys, and the result reads as wind over terrain instead of water.

The school runs three rules against every other fish. The O(n²) neighbour loop
is the honest version and is affordable at these counts precisely because it
never leaves the GPU; a spatial hash is the right answer at ten times as many
and would cost more code than it saves here.

WebGL2 has no compute shaders, so it gets an analytic snow fallback — the same
silhouette, derived from time and a seed, with no simulation behind it. Fish
are dropped there entirely: a school that cannot see its neighbours is just
drifting confetti, and confetti shaped like fish is worse than no fish.

### Holding the frame rate

`renderer.js` watches real frame time and moves the pixel ratio to fit. Two
things in there are worth knowing before changing them:

1. **It measures the gap between rAF timestamps, not its own callback.** GPU
   work is queued rather than awaited, so timing the render call reports a few
   idle milliseconds no matter how badly the device is struggling. The only
   honest signal is how long the *previous* frame took to arrive.
2. **Catastrophic frames are judged one at a time.** The normal path is
   hysteretic — a single slow frame is noise, and reacting to it makes the
   resolution visibly pump — but on a machine rendering at a fraction of a
   frame per second, frames are the scarce resource, and requiring 45 of them
   to agree can take a minute of wall clock to establish what the first one
   already proved. Past 400ms the ratio halves immediately, and once the floor
   cannot save it either the scene is torn down for the static gradient.

Everything else scales by tier: raymarch steps, wall subdivision, particle
counts, and whether the grade runs at all.

## The opening

The preloader splits loading in two rather than waiting for everything:

| | |
| --- | --- |
| **Blocking** | The heading font, and a real first frame out of the renderer — which includes compiling the scene *and* the post chain, the long pole, and the one thing that cannot be deferred without revealing a black rectangle. |
| **Non-blocking** | Anything that enriches a picture already complete. Started early, but never gates the curtain; it arrives under a visitor who is already scrolling. |

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
| `prefers-reduced-motion` | No smooth scroll, no entrance timelines, no bubbles, no particles at all, no pointer parallax, no view-transition animation. The camera tracks scroll directly instead of easing. |
| No WebGPU (WebGL2 fallback) | Analytic marine snow instead of simulated; no fish. Everything else is identical — the TSL graph compiles to GLSL. |
| Low power / small screen / `saveData` | Fewer raymarch steps, coarser walls, fewer particles, no grade, lower pixel-ratio ceiling — the same scene, costed down, rather than a second asset. |
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
      index.js         Scroll -> camera controller
      renderer.js      Backend selection, capability detection, adaptive quality
      scene.js         Assembly and the shared uniforms
      camera.js        The spline rig
      water.js         Depth, light and fog — what every path agrees on
      atmosphere.js    Raymarched water column and god rays
      terrain.js       Canyon walls and seafloor
      particles.js     Compute-simulated snow and boids
      post.js          Bloom
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
