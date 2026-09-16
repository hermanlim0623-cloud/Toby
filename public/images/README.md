# Hero ink plates

The hero's ink reveal (`src/scripts/heroInk.js`) composites two images:

| File | What it is |
| --- | --- |
| `hero-plate-top.jpg` | the plate the visitor lands on — the clean wordmark |
| `hero-plate-under.jpg` | the plate underneath — the wordmark over the machinery |

Both are authored the same way: **a black TOBY on white**. The site is black,
so the upper plate is drawn as its *negative* — TOBY arrives white on black,
and dragging the cursor paints ink into an alpha channel that lets the lower
plate through, which flips the wordmark back to black over the machinery under
your hand. The stroke bleeds away again over a few seconds.

Set `data-plate-top-invert="false"` on the `[data-hero-ink]` element if you
ever supply an upper plate that is already white-on-black.

Both plates should be the **same framing at the same size** — the reveal is a
straight swap between them, so anything that does not line up reads as a
misregistered print rather than as ink. Landscape, ~2400×1400, is the right
shape for the hero; they are drawn `cover`, so they are cropped rather than
stretched if the aspect does not match.

`hero-plate-top.jpg` is optional: with only the lower plate present, the upper
one is derived as its negative. Until `hero-plate-under.jpg` exists the stage
removes itself and the hero renders exactly
as it does without it — no broken image, no empty box.
