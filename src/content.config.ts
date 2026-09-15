import { defineCollection } from 'astro:content';
import { z } from 'zod';
import { glob } from 'astro/loaders';

// The seven projects used to live as an array literal inside index.astro,
// which capped each one at a single sentence. As a collection they get a
// real body — problem, build, result — and a page of their own, while the
// schema keeps the card data that the gallery still needs.
const work = defineCollection({
  loader: glob({ base: './src/content/work', pattern: '**/*.md' }),
  schema: z.object({
    title: z.string(),
    tag: z.string(),
    /** Which generative card visual ProjectVisual.astro should draw. */
    world: z.enum(['control', 'editorial', 'bot', 'report', 'tracker', 'system']),
    /** Gallery order — lowest first. */
    order: z.number(),
    summary: z.string(),
    impact: z.string(),
    stack: z.array(z.string()).nonempty(),
    role: z.string(),
    timeframe: z.string(),
    status: z.enum(['Live', 'In use', 'Maintained', 'Retired']).default('In use'),
    metrics: z
      .array(z.object({ label: z.string(), value: z.string() }))
      .max(3)
      .default([]),
  }),
});

export const collections = { work };
