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
    /**
     * The project stated as a machine: what goes in, what happens to it, what
     * the system decides, what comes out.
     *
     * Required rather than optional on purpose. The gallery renders every
     * project as this diagram, and a card with an empty one would be a hole
     * in the middle of the section making the argument — better that the
     * build fails than that a project quietly renders as a blank frame.
     *
     * Each line is deliberately short. These are read at a glance across
     * seven cards; a sentence that needs two lines is a sentence that belongs
     * in the case study body instead.
     */
    machine: z.object({
      input: z.string().max(60),
      process: z.string().max(60),
      decision: z.string().max(60),
      output: z.string().max(60),
    }),
  }),
});

export const collections = { work };
