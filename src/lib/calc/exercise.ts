import { round } from './units';

export interface Activity {
  key: string;
  label: string;
  met: number;
  group: 'Walking & running' | 'Cycling' | 'Gym' | 'Sports' | 'Everyday';
}

/** Compendium of Physical Activities MET values (2011 update), rounded. */
export const ACTIVITIES: readonly Activity[] = [
  { key: 'walk-slow', label: 'Walking, easy (3 km/h)', met: 2.8, group: 'Walking & running' },
  { key: 'walk-brisk', label: 'Walking, brisk (5.5 km/h)', met: 4.3, group: 'Walking & running' },
  { key: 'walk-fast', label: 'Walking, fast (6.5 km/h)', met: 5.0, group: 'Walking & running' },
  { key: 'hike', label: 'Hiking, hills', met: 6.0, group: 'Walking & running' },
  { key: 'jog', label: 'Jogging (8 km/h)', met: 8.3, group: 'Walking & running' },
  { key: 'run-10', label: 'Running (10 km/h)', met: 9.8, group: 'Walking & running' },
  { key: 'run-12', label: 'Running (12 km/h)', met: 11.5, group: 'Walking & running' },
  { key: 'cycle-easy', label: 'Cycling, leisurely', met: 4.0, group: 'Cycling' },
  { key: 'cycle-moderate', label: 'Cycling, moderate (20 km/h)', met: 8.0, group: 'Cycling' },
  { key: 'cycle-hard', label: 'Cycling, vigorous (25+ km/h)', met: 10.0, group: 'Cycling' },
  { key: 'spin', label: 'Indoor cycling / spin class', met: 8.5, group: 'Cycling' },
  { key: 'weights', label: 'Weight training, general', met: 3.5, group: 'Gym' },
  { key: 'weights-hard', label: 'Weight training, vigorous', met: 6.0, group: 'Gym' },
  { key: 'hiit', label: 'HIIT / circuit training', met: 8.0, group: 'Gym' },
  { key: 'elliptical', label: 'Elliptical trainer', met: 5.0, group: 'Gym' },
  { key: 'rowing', label: 'Rowing machine, moderate', met: 7.0, group: 'Gym' },
  { key: 'stairs', label: 'Stair climber', met: 9.0, group: 'Gym' },
  { key: 'yoga', label: 'Yoga', met: 2.5, group: 'Gym' },
  { key: 'pilates', label: 'Pilates', met: 3.0, group: 'Gym' },
  { key: 'stretch', label: 'Stretching / mobility', met: 2.3, group: 'Gym' },
  { key: 'swim-easy', label: 'Swimming, leisurely', met: 6.0, group: 'Sports' },
  { key: 'swim-laps', label: 'Swimming, laps, moderate', met: 8.3, group: 'Sports' },
  { key: 'football', label: 'Football / soccer', met: 7.0, group: 'Sports' },
  { key: 'basketball', label: 'Basketball', met: 6.5, group: 'Sports' },
  { key: 'tennis', label: 'Tennis, singles', met: 8.0, group: 'Sports' },
  { key: 'badminton', label: 'Badminton', met: 5.5, group: 'Sports' },
  { key: 'golf', label: 'Golf, walking', met: 4.8, group: 'Sports' },
  { key: 'dance', label: 'Dancing, general', met: 5.5, group: 'Sports' },
  { key: 'boxing', label: 'Boxing, bag work', met: 5.5, group: 'Sports' },
  { key: 'martial', label: 'Martial arts', met: 10.3, group: 'Sports' },
  { key: 'climb', label: 'Rock climbing', met: 7.5, group: 'Sports' },
  { key: 'skate', label: 'Skating / rollerblading', met: 7.0, group: 'Sports' },
  { key: 'housework', label: 'Housework, general', met: 3.3, group: 'Everyday' },
  { key: 'garden', label: 'Gardening', met: 3.8, group: 'Everyday' },
  { key: 'mow', label: 'Mowing the lawn', met: 5.5, group: 'Everyday' },
  { key: 'play-kids', label: 'Playing with children, active', met: 3.5, group: 'Everyday' },
  { key: 'shopping', label: 'Shopping, walking', met: 2.3, group: 'Everyday' },
  { key: 'stand-work', label: 'Standing work', met: 2.0, group: 'Everyday' },
];

export function activity(key: string): Activity | undefined {
  return ACTIVITIES.find((a) => a.key === key);
}

/** Gross kcal for an activity: MET × 3.5 × kg / 200 per minute. Resting cost is included, as apps report it. */
export function exerciseKcal(met: number, weightKg: number, minutes: number): number {
  if (!(met > 0) || !(weightKg > 0) || !(minutes > 0)) return 0;
  return round(((met * 3.5 * weightKg) / 200) * minutes);
}

/** Net kcal above rest (what a deficit should actually count); roughly (MET − 1). */
export function exerciseNetKcal(met: number, weightKg: number, minutes: number): number {
  return exerciseKcal(Math.max(0, met - 1), weightKg, minutes);
}
