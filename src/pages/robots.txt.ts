import type { APIRoute } from 'astro';
import { absoluteUrl } from '@/lib/url';

export const GET: APIRoute = ({ site }) =>
  new Response(`User-agent: *\nAllow: /\n\nSitemap: ${absoluteUrl('/sitemap-index.xml', site)}\n`, {
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  });
