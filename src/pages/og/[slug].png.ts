/**
 * One social card per project, written at build time.
 *
 * Every case study used to share `/og.jpg`, so seven different links
 * previewed as the same image. These are static files like any other page
 * output: the endpoint runs during `astro build` and nothing renders at
 * request time.
 */
import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';

import { renderCard } from '../../lib/ogCard';
import { SITE } from '../../consts';

export async function getStaticPaths() {
  const work = (await getCollection('work')).sort((a, b) => a.data.order - b.data.order);
  return work.map((entry, i) => ({
    params: { slug: entry.id },
    // Position is a property of the sorted gallery, not of the entry, so it
    // is resolved here rather than re-deriving it inside the endpoint.
    props: { entry, index: i + 1, total: work.length },
  }));
}

export const GET: APIRoute = async ({ props }) => {
  const { entry, index, total } = props as {
    entry: Awaited<ReturnType<typeof getCollection<'work'>>>[number];
    index: number;
    total: number;
  };
  const d = entry.data;

  const png = await renderCard({
    num: String(index).padStart(2, '0'),
    total: String(total).padStart(2, '0'),
    title: d.title,
    summary: d.summary,
    tag: d.tag,
    status: d.status,
    timeframe: d.timeframe,
    site: new URL(SITE.url).host,
  });

  return new Response(png, {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
};
