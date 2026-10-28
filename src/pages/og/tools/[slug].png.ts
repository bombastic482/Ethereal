/** Open Graph card for each calculator, rendered at build time (see src/lib/og.ts). */
import type { APIRoute, GetStaticPaths } from 'astro';
import { ogPng } from '@/lib/og';
import { TOOLS, type ToolMeta } from '@/lib/tools';

export const getStaticPaths: GetStaticPaths = () =>
  TOOLS.map((t) => ({ params: { slug: t.slug }, props: { tool: t } }));

export const GET: APIRoute = ({ props }) => {
  const t = props.tool as ToolMeta;
  return ogPng({
    kicker: `Free calculator · ${t.short}`,
    title: t.name,
    summary: t.description,
  });
};
