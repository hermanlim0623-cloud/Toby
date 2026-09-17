/**
 * The social card, built as the site's own dark plate.
 *
 * `.case-plate` is what a case study renders when a project has no cover:
 * the number, the title, and the one-line facts on `--dark`. Reusing that
 * composition here means a shared link and the page it opens are visibly
 * the same object, and there is no second visual language to keep in sync.
 *
 * Satori lays this out with a flexbox subset, so every node that holds more
 * than one child declares `display: flex` explicitly; the CSS shorthands the
 * stylesheet uses are not all available here, which is why the values below
 * are spelled out rather than imported from `global.css`.
 */
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';

/** Mirrors the `:root` tokens in global.css that this composition uses. */
const DARK = '#161819';
const WHITE = '#FFFFFF';
const ACCENT = '#055DFF';
const MUTED = '#8A8A8A';
const RULE = 'rgba(255,255,255,0.16)';

/** The size every social scraper expects, and what Seo.astro declares. */
const WIDTH = 1200;
const HEIGHT = 630;

const PAD = 64;

const require = createRequire(import.meta.url);

/**
 * IBM Plex Mono is `--font-tech`, the face the site already uses for labels
 * and anything the machine counts, so the card needs no font the project
 * does not ship.
 *
 * The `.woff` files specifically: Satori reads ttf/otf/woff, and the
 * variable Fontsource packages publish woff2 only, which it cannot parse.
 */
async function loadFonts() {
  const file = (weight: number) =>
    require.resolve(`@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-${weight}-normal.woff`);
  const [regular, semibold] = await Promise.all([readFile(file(400)), readFile(file(600))]);
  return [
    { name: 'IBM Plex Mono', data: regular, weight: 400 as const, style: 'normal' as const },
    { name: 'IBM Plex Mono', data: semibold, weight: 600 as const, style: 'normal' as const },
  ];
}

/** Fonts are parsed once per build, not once per project. */
let fontsPromise: ReturnType<typeof loadFonts> | undefined;

/**
 * A browser falls back to another installed face for a glyph the page font
 * lacks; a raster card has nowhere to fall back to, and Satori draws the
 * missing glyph as a tofu box. The copy uses a real arrow, and the Latin
 * subset shipped with IBM Plex Mono has no U+2192, so it becomes the ASCII
 * arrow here — which is what a monospaced technical card would have used
 * anyway. Anything else outside the subset is better caught than silently
 * rendered as a box, so it is left alone and shows up in review.
 */
function ascii(text: string) {
  return text.replace(/→/g, '->');
}

type Node = { type: string; props: Record<string, unknown> };

function h(type: string, style: Record<string, unknown>, children?: unknown): Node {
  return { type, props: { style, children } };
}

/** A row of micro type, letterspaced the way `.t-label` sets it. */
function label(text: string, color: string) {
  return h(
    'div',
    {
      display: 'flex',
      fontSize: 15,
      fontWeight: 600,
      letterSpacing: 1.6,
      color,
    },
    ascii(text),
  );
}

export interface OgCardData {
  /** Zero-padded position in the gallery, e.g. "03". */
  num: string;
  /** Zero-padded gallery size, e.g. "07". */
  total: string;
  title: string;
  /** The project in one sentence; wraps to at most three lines. */
  summary: string;
  tag: string;
  status: string;
  timeframe: string;
  /** The site, set against the facts at the foot of the card. */
  site: string;
}

/**
 * Title sizing is stepped rather than fluid: Satori has no text measurement
 * to fit against, so the length decides the step. The thresholds are set so
 * that the longest project name in the collection still sits on one line.
 */
function titleSize(title: string) {
  if (title.length > 34) return 56;
  if (title.length > 22) return 68;
  return 84;
}

export function card(d: OgCardData): Node {
  const size = titleSize(d.title);

  return h(
    'div',
    {
      width: WIDTH,
      height: HEIGHT,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      backgroundColor: DARK,
      color: WHITE,
      padding: PAD,
      fontFamily: 'IBM Plex Mono',
    },
    [
      // The wordmark and the project's index, either end of the top rule.
      h('div', { display: 'flex', flexDirection: 'column' }, [
        h(
          'div',
          {
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingBottom: 20,
          },
          [label('TOBY', WHITE), label(`${d.num} / ${d.total}`, MUTED)],
        ),
        h('div', { display: 'flex', height: 1, backgroundColor: RULE }),
      ]),

      // The mark, then what it is. The accent slash is the page's own, and it
      // appears exactly once here, which is the rule the stylesheet sets for it.
      h('div', { display: 'flex', flexDirection: 'column' }, [
        h('div', { display: 'flex', alignItems: 'flex-start' }, [
          h(
            'div',
            {
              display: 'flex',
              fontSize: size,
              fontWeight: 600,
              color: ACCENT,
              lineHeight: 1.05,
              paddingRight: 18,
            },
            '/',
          ),
          h(
            'div',
            {
              display: 'flex',
              fontSize: size,
              fontWeight: 600,
              lineHeight: 1.05,
              letterSpacing: -1,
            },
            d.title,
          ),
        ]),
        h(
          'div',
          {
            display: 'flex',
            fontSize: 22,
            lineHeight: 1.5,
            color: MUTED,
            // Held short of the full measure: a social card is read at a glance
            // and a line running the whole 1072px is a line nobody finishes.
            maxWidth: 820,
            paddingTop: 24,
          },
          ascii(d.summary),
        ),
      ]),

      // The facts, under the closing rule.
      h('div', { display: 'flex', flexDirection: 'column' }, [
        h('div', { display: 'flex', height: 1, backgroundColor: RULE, marginBottom: 20 }),
        h(
          'div',
          {
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          },
          [
            label([d.tag, d.status, d.timeframe].join('  ·  ').toUpperCase(), MUTED),
            label(d.site.toUpperCase(), WHITE),
          ],
        ),
      ]),
    ],
  );
}

/**
 * Renders the card to PNG bytes.
 *
 * resvg returns a Node Buffer, whose element type is `ArrayBufferLike` and
 * so could in principle be backed by a SharedArrayBuffer, which `BodyInit`
 * does not accept. Re-wrapping pins it to a plain ArrayBuffer so the
 * endpoint can hand it straight to `Response`; the copy is one 30KB image
 * per project at build time.
 */
export async function renderCard(d: OgCardData): Promise<Uint8Array<ArrayBuffer>> {
  fontsPromise ??= loadFonts();
  const svg = await satori(card(d) as never, {
    width: WIDTH,
    height: HEIGHT,
    fonts: await fontsPromise,
  });
  // `fitTo` at the card's own width keeps resvg from rescaling the layout
  // Satori already solved at exactly this size.
  return new Uint8Array(
    new Resvg(svg, { fitTo: { mode: 'width', value: WIDTH } }).render().asPng(),
  );
}
