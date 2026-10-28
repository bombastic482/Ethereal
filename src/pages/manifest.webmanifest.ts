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
      orientation: 'portrait',
      categories: ['health', 'fitness', 'lifestyle'],
      shortcuts: [
        {
          name: 'Today',
          short_name: 'Today',
          url: withBase('/today/'),
          description: 'Log food, exercise and water',
        },
        {
          name: 'Weigh in',
          short_name: 'Track',
          url: withBase('/track/'),
          description: 'Log a weigh-in',
        },
        {
          name: 'My plan',
          short_name: 'Plan',
          url: withBase('/plan/'),
          description: 'Targets and progress',
        },
        {
          name: 'Weekly review',
          short_name: 'Review',
          url: withBase('/review/'),
          description: 'The week in five minutes',
        },
      ],
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
