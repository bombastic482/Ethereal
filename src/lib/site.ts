export const SITE = {
  name: 'Ethereal',
  tagline: 'Weight loss, done properly.',
  description:
    'Free, science-backed weight-loss calculators and guides. Calories, macros, BMI, body fat, protein and a realistic timeline to your goal. No sign-up, no ads, no nonsense.',
  author: 'Ethereal',
  locale: 'en_US',
  twitter: '',
  themeColor: '#0f766e',
} as const;

export const NAV = [
  { href: '/tools/', label: 'Tools' },
  { href: '/guides/', label: 'Guides' },
  { href: '/about/', label: 'About' },
] as const;
