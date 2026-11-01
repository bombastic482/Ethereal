import type { Site } from '@/lib/body';

/** How to measure each site, with a short label and a typical starting value per build. */
export const SITES: Record<
  Site,
  { label: string; short: string; how: string[]; start: { male: number; female: number } }
> = {
  neckCm: {
    label: 'Neck',
    short: 'Neck',
    how: [
      'Just below the Adam’s apple.',
      'Slope the tape slightly down towards the front.',
      'Snug, not tight. Look straight ahead, shoulders relaxed.',
    ],
    start: { male: 39, female: 33 },
  },
  waistCm: {
    label: 'Waist at the navel',
    short: 'Waist',
    how: [
      'Level all the way round, across the navel.',
      'Breathe out normally and read it at the end of the breath.',
      'No sucking in: the honest number is the useful one.',
    ],
    start: { male: 96, female: 86 },
  },
  waistNarrowCm: {
    label: 'Waist at the narrowest',
    short: 'Narrow waist',
    how: [
      'At the narrowest point, usually just above the navel.',
      'Breathe out normally and read it at the end of the breath.',
      'Keep the tape level front to back.',
    ],
    start: { male: 90, female: 76 },
  },
  hipsCm: {
    label: 'Hips',
    short: 'Hips',
    how: ['Around the widest part of your bottom.', 'Feet together, tape level all the way round.'],
    start: { male: 102, female: 102 },
  },
  chestCm: {
    label: 'Chest',
    short: 'Chest',
    how: ['Under the armpits and across the nipples.', 'Read it after a normal breath out.'],
    start: { male: 102, female: 94 },
  },
  armCm: {
    label: 'Upper arm',
    short: 'Arm',
    how: ['Halfway between shoulder and elbow.', 'Arm hanging relaxed. Same arm every time.'],
    start: { male: 33, female: 29 },
  },
  thighCm: {
    label: 'Thigh',
    short: 'Thigh',
    how: [
      'Around the top of the thigh, just below the bottom.',
      'Weight on both feet. Same leg every time.',
    ],
    start: { male: 57, female: 57 },
  },
};

export const ALL_SITES: Site[] = [
  'neckCm',
  'chestCm',
  'armCm',
  'waistNarrowCm',
  'waistCm',
  'hipsCm',
  'thighCm',
];

/** Sites the Navy estimate needs, then the optional ones, for a build. */
export function sitesFor(sex: 'male' | 'female'): { required: Site[]; optional: Site[] } {
  return sex === 'male'
    ? { required: ['neckCm', 'waistCm'], optional: ['hipsCm', 'chestCm', 'armCm', 'thighCm'] }
    : {
        required: ['neckCm', 'waistNarrowCm', 'hipsCm'],
        optional: ['waistCm', 'chestCm', 'armCm', 'thighCm'],
      };
}
