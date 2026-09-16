# TOBY — portfolio

An editorial portfolio for a creative technologist working in food &
beverage operations. The design is Swiss grid, brutalist type and a 1px rule
system on a light ground: there are no cards, no gradients, no shadows and no
rounded corners anywhere, and the page carries its weight in alignment,
scale and whitespace instead.

Built with [Astro](https://astro.build), [GSAP](https://gsap.com) +
ScrollTrigger and [Lenis](https://lenis.darkroom.engineering). No UI
framework and no runtime framework — the pages ship as static HTML plus one
bundled module.

```bash
npm install
npm run dev        # http://localhost:4321
```

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run build` | Static build into `dist/` |
| `npm run preview` | Serve the build |
| `npm run check` | Astro/TypeScript diagnostics |
| `npm run lint` | ESLint |
| `npm test` | Playwright, against a real production build |
| `npm run verify` | check + lint + build + test |
| `npm run plates` | Re-encode the About figure's ink plates |

## The system

Everything visual resolves through a small set of tokens in
`src/styles/global.css`. Changing the design means changing those, not
hunting through components.

**Colour** — six values. `--bg #F4F4F4`, `--text #404040`, `--muted`,
`--dark #161819`, `--black`, `--white`, plus one accent `--accent #055DFF`
used sparingly enough that a screen showing it twice is a screen doing it
wrong.

> The brief this was built to specifies `#B3B3B3` for muted text. On
> `#F4F4F4` that measures 1.86:1 against a 4.5:1 floor, so it is split:
> `--muted` is the darkest grey that still reads as a clear step below the
> text colour while passing AA at 10px, and `--muted-line` keeps the
> specified tone for rules, which are not text.

**Type** — three faces, three jobs. `--font-main` for language,
`--font-mono` for anything the machine counts or indexes, `--font-tech` for
the 7–10px micro UI. The brief names Switzer, Orbit Mono and DT-sys11; those
are licensed or unreachable from this environment, so the roles are filled
by Inter (named as the fallback in the brief), Martian Mono and IBM Plex
Mono. Swapping a real face in is a `@font-face` and one token.

**Grid** — one primitive. `.grid` is 12 columns on desktop, 8 on tablet and
4 on mobile; a child names its span with `--c` and its start column with
`--s`, and `--c-m` overrides the span below the tablet breakpoint. Nothing
on the page is positioned any other way, which is what keeps the left margin
a single unbroken line from the header to the footer.

**Rules** — one border width exists, and `.rule` is the horizontal line
between sections and rows. It draws from zero width on reveal.

**Inversion** — `.on-dark` redefines the tokens rather than just `color`,
so an inverted block is the same design rather than a second one.

## Structure

```
src/
├── components/   Header, SectionLabel, Seo
├── content/work/ Seven projects as Markdown, with the schema in
│                 content.config.ts driving the counters, the technology
│                 list and the project rows
├── layouts/      Base — head, header, footer, the one script entry
├── pages/        index, work/[...slug], 404
├── scripts/      One module per behaviour, all torn down on navigation
└── styles/       global.css — the whole system
```

The content collection is the source of truth for anything countable. The
hero's project count, the technology archive and the work rows are all
derived from it, so adding a project updates the page rather than leaving a
hand-typed number to go stale.

## Motion

Reveals are once-only and built from four moves: text rises out of a
word-level mask, rules draw from zero width, blocks lift and fade, counters
run up from zero. Editorial images un-crop out of a slight over-scale.
Everything is `transform` and `opacity`.

`prefers-reduced-motion` is a supported mode, not an afterthought: the
opening curtain does not exist, the cursor never mounts, smooth scroll is
off, and every reveal lands on its end state. It has its own Playwright
project so it is tested rather than assumed.

## Images

The About figure composites two plates of the wordmark under a brush — see
`public/images/README.md`. Project rows show a hover preview built from each
project's own number, title and category; add `cover: "/images/work/x.webp"`
to a project's frontmatter and it shows that instead, on both the row
preview and the case-study page, with no code change.

## Tests

`npm test` runs against a real production build across three profiles:
desktop, reduced motion and mobile. The suite tests the design system rather
than the markup — that nothing overflows at any breakpoint, that every
section label starts on the same x, that no gradient exists anywhere, that
every border is 1px, that the inverted block inverts its tokens, that the
header names the section you are actually in, and that the counters still
equal what the content collection contains — plus axe-core WCAG A/AA passes
on every page type.
