export const SITE = {
  name: 'Ethereal',
  tagline: 'Weight loss, done properly.',
  description:
    'Free, science-backed weight-loss planning. A personal calorie and protein plan, a weight tracker that sees through daily noise, a two-week check that tells you what to change, plus calculators and guides. No sign-up, no ads, runs in your browser.',
  author: 'Ethereal',
  locale: 'en_US',
  twitter: '',
  themeColor: '#3f7a52',
} as const;

export const NAV = [
  { href: '/today/', label: 'Today' },
  { href: '/plan/', label: 'Plan' },
  { href: '/track/', label: 'Track' },
  { href: '/tools/', label: 'Tools' },
  { href: '/guides/', label: 'Guides' },
] as const;
