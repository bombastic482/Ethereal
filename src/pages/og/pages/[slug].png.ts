/** Open Graph cards for top-level pages, rendered at build time (see src/lib/og-pages.ts). */
import type { APIRoute, GetStaticPaths } from 'astro';
import { ogPng, type OgCard } from '@/lib/og';
import { OG_PAGES } from '@/lib/og-pages';

export const getStaticPaths: GetStaticPaths = () =>
  Object.entries(OG_PAGES).map(([slug, card]) => ({ params: { slug }, props: { card } }));

export const GET: APIRoute = ({ props }) => ogPng(props.card as OgCard);
