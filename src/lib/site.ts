export const SITE = {
  name: 'Ethereal',
  tagline: 'Weight loss, done properly.',
  description:
    'Free, science-backed weight-loss planning. A personal calorie and protein plan, a food diary with barcode scanning and 1,500+ foods, 68 recipes and a day planner that hit your targets, a weight tracker that sees through daily noise, and a two-week check that tells you what to change. No sign-up, no ads, runs in your browser.',
  author: 'Ethereal',
  locale: 'en_US',
  twitter: '',
  themeColor: '#15996b',
} as const;

export const NAV = [
  { href: '/today/', label: 'Today' },
  { href: '/plan/', label: 'Plan' },
  { href: '/track/', label: 'Track' },
  { href: '/recipes/', label: 'Recipes' },
  { href: '/tools/', label: 'Tools' },
  { href: '/guides/', label: 'Guides' },
] as const;
