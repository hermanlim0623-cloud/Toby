import { defineCollection } from 'astro:content';
import { z } from 'zod';
import { glob } from 'astro/loaders';

// The seven projects used to live as an array literal inside index.astro,
// which capped each one at a single sentence. As a collection they get a
// real body (problem, build, result) and a page of their own, while the
// schema keeps the card data that the gallery still needs.
const work = defineCollection({
  loader: glob({ base: './src/content/work', pattern: '**/*.md' }),
  schema: z.object({
    title: z.string(),
    tag: z.string(),
    /**
     * Optional path to a real screenshot, e.g. "/images/work/sales.webp".
     * When present the work list's hover preview shows it; when absent the
     * preview is built from the project's own number, title and category,
     * so the interaction works before any photography exists and improves
     * the day a file is dropped in.
     */
    cover: z.string().optional(),
    /** Gallery order: lowest first. */
    order: z.number(),
    summary: z.string(),
    /**
     * Real technologies only. A project whose language or runtime is not
     * documented leaves this empty rather than guessing: an empty BUILT WITH
     * row is honest, an invented one is not. Capabilities belong below.
     */
    stack: z.array(z.string()).default([]),
    /**
     * What the project does, as opposed to what it is written in. These used
     * to be mixed into `stack`, which listed "Automation" and "Bots" beside
     * "Python" and read as though they were languages.
     */
    capabilities: z.array(z.string()).nonempty(),
    /** Where it sits in the operation, e.g. "Daily sales reporting". */
    use: z.string(),
    /** The manual situation the tool replaced, in one line. */
    before: z.string(),
    /** What the situation is now, in one line. */
    after: z.string(),
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
     * in the middle of the section making the argument: better that the
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
