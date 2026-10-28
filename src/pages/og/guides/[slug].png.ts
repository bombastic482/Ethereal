/** Open Graph card for each guide, rendered at build time (see src/lib/og.ts). */
import type { APIRoute, GetStaticPaths } from 'astro';
import { getCollection } from 'astro:content';
import { ogPng } from '@/lib/og';
import { readingTime } from '@/lib/reading-time';

export const getStaticPaths: GetStaticPaths = async () => {
  const guides = await getCollection('guides', ({ data }) => !data.draft);
  return guides.map((g) => ({
    params: { slug: g.id },
    props: {
      title: g.data.title,
      category: g.data.category,
      minutes: readingTime(g.body ?? ''),
      description: g.data.description,
    },
  }));
};

export const GET: APIRoute = ({ props }) => {
  const p = props as { title: string; category: string; minutes: number; description: string };
  return ogPng({
    kicker: `Guide · ${p.category} · ${p.minutes} min read`,
    title: p.title,
    summary: p.description,
  });
};
