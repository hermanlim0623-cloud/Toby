# Hero ink plates

The hero's ink reveal (`src/scripts/heroInk.js`) composites two plates of the
wordmark. **The files here are generated — do not edit them.** The originals
live in `src/assets/hero-plates/` and are never served:

| Original (`src/assets/hero-plates/`) | Served (`public/images/`) | What it is |
| --- | --- | --- |
| `hero-plate-top.png` | `hero-plate-top.webp` | the plate the visitor lands on — the clean wordmark |
| `hero-plate-under.png` | `hero-plate-under.webp` | the plate underneath — the wordmark over the machinery |

Both are authored the same way: **a black TOBY on white**. The site is black,
so the upper plate is drawn as its *negative* — TOBY arrives white on black —
and held back to about a third of full strength, so it reads as texture the
headline sits on rather than as a second headline competing with the real one.
Dragging the cursor paints ink into an alpha channel that lets the lower plate
through at full contrast, which flips the wordmark to black over the machinery
under your hand and bleeds away again over a few seconds.

## Replacing a plate

Drop the new PNG into `src/assets/hero-plates/` under the same name, then:

    npm run plates

That encodes the served WebPs: greyscale (the canvas draws them greyscale
anyway, so colour is dead weight) and capped at 2200px wide. It is worth the
step — the two PNGs are 2.8MB together and the WebPs are 153KB, and `public/`
ships verbatim, so the originals sitting there would have put the whole 2.8MB
on the critical path for an effect that needs a tenth of it.

Both plates must share the **same framing at the same size** — the reveal is a
straight swap between them, so anything that does not line up reads as a
misregistered print rather than as ink. They are drawn `cover`, so a plate
whose aspect does not match the hero is cropped rather than stretched.

## Knobs

Set these on the `[data-hero-ink]` element in `src/pages/index.astro`:

| Attribute | Default | What it does |
| --- | --- | --- |
| `data-plate-rest` | `0.34` | how present the upper plate is before it is touched |
| `data-plate-top-invert` | on | drop it to `"false"` for an upper plate already white-on-black |

`hero-plate-top` is optional: with only the lower plate present, the upper one
is derived as its negative. Until `hero-plate-under.webp` exists the stage
removes itself and the hero renders exactly as it does without it — no broken
image, no empty box.
