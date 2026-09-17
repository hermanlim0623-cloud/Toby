import type { ImageMetadata } from 'astro';

/**
 * A project's cover, by convention.
 *
 * Dropping `src/assets/work/<id>.webp` is all it takes: the file is matched
 * to the project by its own id, so there is no frontmatter to keep in sync
 * and no way for the two to drift apart. A project without one renders a
 * typographic plate instead, so the gallery never has a hole in it.
 *
 * Covers live in `src/assets` rather than `public` so that `astro:assets`
 * owns them: every size and format the pages ask for is derived from these
 * originals at build time, and the URLs come back content-hashed. That is
 * what replaced the hand-run `npm run covers` step, which wrote a second
 * cropped file beside each cover and had to be remembered after every
 * change.
 *
 * Eager, because the value is needed while the page renders rather than
 * behind an await, and there are seven of them.
 */
const covers = import.meta.glob<{ default: ImageMetadata }>('../assets/work/*.webp', {
  eager: true,
});

export function coverFor(entry: { id: string; data: { cover?: ImageMetadata } }) {
  // An explicit `cover:` still wins, for a file that does not follow the
  // convention; the content schema resolves it to the same kind of value.
  return entry.data.cover ?? covers[`../assets/work/${entry.id}.webp`]?.default;
}
