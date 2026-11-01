export const SITE = {
  name: 'Ethereal',
  tagline: "Become who you're working toward.",
  description:
    'A calm coach for your whole self. Home workouts with animated demos that grow with you, a food diary with barcode scanning and 1,400+ halal-friendly foods, recipes and a day planner that hit your targets, a weight trend that sees through daily noise, and a clear next step every day. No sign-up, no ads, runs in your browser.',
  author: 'Ethereal',
  locale: 'en_US',
  twitter: '',
  themeColor: '#15996b',
} as const;

export type Section = 'today' | 'train' | 'eat' | 'progress' | 'you';

interface SectionPage {
  href: string;
  label: string;
  /** A shorter label for the phone tab row, when the full one would not fit. */
  short?: string;
}

/**
 * The app's five sections, each with its pages in order. The first page is the section's home;
 * the phone tab bar, the header and the in-page section switcher are all built from this.
 */
export const SECTIONS: Record<
  Section,
  {
    label: string;
    icon: 'flame' | 'dumbbell' | 'utensils' | 'chart' | 'user';
    pages: SectionPage[];
  }
> = {
  today: { label: 'Today', icon: 'flame', pages: [{ href: '/today/', label: 'Today' }] },
  train: {
    label: 'Train',
    icon: 'dumbbell',
    pages: [
      { href: '/train/', label: 'Your plan' },
      { href: '/train/exercises/', label: 'Exercises' },
    ],
  },
  eat: {
    label: 'Eat',
    icon: 'utensils',
    pages: [
      { href: '/eat/', label: 'Plan my day' },
      { href: '/recipes/', label: 'Recipes' },
      { href: '/eating-out/', label: 'Eating out' },
    ],
  },
  progress: {
    label: 'Progress',
    icon: 'chart',
    pages: [
      { href: '/progress/', label: 'Overview' },
      { href: '/track/', label: 'Weight & photos', short: 'Weight' },
      { href: '/progress/body/', label: 'Body' },
      { href: '/review/', label: 'Weekly review', short: 'Review' },
    ],
  },
  you: {
    label: 'You',
    icon: 'user',
    pages: [
      { href: '/you/', label: 'Profile' },
      { href: '/you/health/', label: 'Health' },
      { href: '/you/mind/', label: 'Mind' },
      { href: '/settings/', label: 'Settings & data' },
    ],
  },
};

/** The section a path belongs to, if any. Paths are without the base. */
export function sectionOf(path: string): Section | undefined {
  const clean = path.endsWith('/') ? path : `${path}/`;
  for (const [key, s] of Object.entries(SECTIONS) as [Section, (typeof SECTIONS)[Section]][]) {
    if (s.pages.some((p) => clean.startsWith(p.href))) return key;
  }
  return undefined;
}

export const NAV = [
  { href: '/today/', label: 'Today' },
  { href: '/train/', label: 'Train' },
  { href: '/eat/', label: 'Eat' },
  { href: '/progress/', label: 'Progress' },
  { href: '/guides/', label: 'Guides' },
  { href: '/tools/', label: 'Tools' },
] as const;
