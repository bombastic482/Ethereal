import type { APIRoute } from 'astro';
import { SITE } from '@/lib/site';
import { withBase } from '@/lib/url';

export const GET: APIRoute = () =>
  new Response(
    JSON.stringify({
      name: `${SITE.name} — ${SITE.tagline}`,
      short_name: SITE.name,
      description: SITE.description,
      start_url: withBase('/'),
      scope: withBase('/'),
      display: 'standalone',
      background_color: '#f7f4ee',
      theme_color: SITE.themeColor,
      icons: [
        { src: withBase('/icons/icon-192.png'), sizes: '192x192', type: 'image/png' },
        {
          src: withBase('/icons/icon-512.png'),
          sizes: '512x512',
          type: 'image/png',
          purpose: 'any maskable',
        },
      ],
    }),
    { headers: { 'content-type': 'application/manifest+json' } },
  );
