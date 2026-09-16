// Encodes the hero ink plates for delivery.
//
// The originals live in src/assets/hero-plates/ and are never served: they are
// multi-megabyte PNGs, and public/ ships verbatim, so leaving them there would
// put ~2.8MB of artwork on the critical path for an effect that needs 150KB.
//
// heroInk.js draws both plates greyscale, so colour is dead weight and is
// dropped here rather than at render time. Re-run after replacing a plate:
//
//   npm run plates
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const SRC = fileURLToPath(new URL('../src/assets/hero-plates/', import.meta.url));
const OUT = fileURLToPath(new URL('../public/images/', import.meta.url));

await mkdir(OUT, { recursive: true });

for (const plate of ['hero-plate-top', 'hero-plate-under']) {
  const info = await sharp(`${SRC}${plate}.png`)
    .grayscale()
    // The stage is drawn `cover`, so the plate only ever needs to out-resolve
    // the widest hero at a sane DPR; beyond that it is bytes nobody can see.
    .resize({ width: 2200, withoutEnlargement: true })
    .webp({ quality: 88, effort: 6 })
    .toFile(`${OUT}${plate}.webp`);
  console.log(`${plate}.webp — ${Math.round(info.size / 1024)}KB`);
}
