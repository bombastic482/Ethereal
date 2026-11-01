import type { DayKind } from '@/lib/day';
import { Icon, type IconName } from '../ui/Icon';

/** The icon for each kind of moment in a day. Colours live in CSS as .kind-<kind>. */
export const KIND_ICON: Record<DayKind, IconName> = {
  wake: 'sun',
  meal: 'utensils',
  med: 'pill',
  prayer: 'moon',
  workout: 'dumbbell',
  walk: 'walk',
  weigh: 'scale',
  photo: 'camera',
  measure: 'ruler',
  wind: 'leaf',
  sleep: 'bed',
  busy: 'clock',
};

export function KindIcon({ kind, size = 18 }: { kind: DayKind; size?: number }) {
  return <Icon name={KIND_ICON[kind]} size={size} />;
}

/** "07:30" in the device's own clock style. */
export function clock(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  return new Date(2000, 0, 1, h, m).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}
