// Derives the work list's hover thumbnails from the project covers.
//
// The two places a project's image appears want wildly different sizes: the
// case study shows it across the full content width, and the hover preview
// shows it at around 270px. One file cannot serve both, and the preview is
// the expensive one, because `.work-preview` is position:fixed, so the
// browser treats it as on-screen and `loading="lazy"` never defers anything.
// Every preview downloads on the first paint of the index page whether or
// not anyone hovers a row.
//
// So the covers stay full size for the case study, and this writes a small
// 4:3 crop beside each one for the list. Re-run after adding or replacing a
// cover:
//
//   npm run covers
import { readdir, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const DIR = fileURLToPath(new URL('../public/images/work/', import.meta.url));
const SUFFIX = '-thumb.webp';
// 4:3 to match the preview panel's aspect, at twice its widest rendered
// size so it stays sharp on a 2x display.
const W = 600;
const H = 450;

let files;
try {
  files = await readdir(DIR);
} catch {
  console.log('No public/images/work/ yet, nothing to do.');
  process.exit(0);
}

const covers = files.filter((f) => f.endsWith('.webp') && !f.endsWith(SUFFIX));
if (!covers.length) {
  console.log('No covers found in public/images/work/.');
  process.exit(0);
}

for (const file of covers) {
  const from = DIR + file;
  const to = DIR + file.replace(/\.webp$/, SUFFIX);

  // Skip anything already newer than its source, so re-running is cheap and
  // does not rewrite files git would then see as changed.
  try {
    const [src, out] = await Promise.all([stat(from), stat(to)]);
    if (out.mtimeMs >= src.mtimeMs) {
      console.log(`${file}: thumb up to date`);
      continue;
    }
  } catch { /* no thumb yet */ }

  const info = await sharp(from)
    // `cover` here matches the CSS: the panel crops rather than squashes,
    // so the crop is baked in at the same anchor the browser would use.
    .resize(W, H, { fit: 'cover', position: 'centre' })
    .webp({ quality: 82, effort: 6 })
    .toFile(to);

  const before = Math.round((await stat(from)).size / 1024);
  console.log(`${file}: ${before}KB → thumb ${Math.round(info.size / 1024)}KB`);
}
